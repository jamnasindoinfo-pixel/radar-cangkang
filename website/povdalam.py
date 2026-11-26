"""Analisa mendalam satu emiten untuk halaman POV (aturan otomatis, tanpa AI).

Server mengumpulkan data mentah (profil, pemegang saham, jaringan kepemilikan tiap pemegang di emiten lain,
keterbukaan informasi, berita, kinerja, posting publik Stockbit); analyze() menyusunnya menjadi temuan, dugaan
tujuan beserta buktinya, dan daftar hal yang perlu diselidiki. Fungsi di sini murni (tanpa HTTP) agar bisa diuji.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

import povarah as PA
import povgali as PG

# Naikkan bila isi analisa berubah: hasil tersimpan versi lama ditarik ulang saat dibuka.
VERSI = 21
PUBLIK_RX = re.compile(r"MASYARAKAT|PUBLIK|PUBLIC|SCRIPLESS|SCRIP\b", re.I)
# Kata kunci posting yang membahas struktur kepemilikan/aksi korporasi (dipakai mengurutkan relevansi).
TOPIK_RX = re.compile(r"pengendali|akuisisi|diakuisisi|pemilik|grup|group|konsorsium|backdoor|inbreng|rights|hmetd|tender|"
                      r"free ?float|ipo|merger|anak usaha|proyek|keluarga|sepupu|saudara|pendiri|ubo|beneficial|tukar guling|"
                      r"divestasi|caplok|private placement|injeksi|jv\b|joint venture", re.I)
NAMA_STOP = {"yang", "yg", "dan", "dg", "dengan", "lewat", "bersama", "di", "ke", "dari", "sebagai", "adalah", "juga", "sudah",
             "itu", "ini", "kemudian", "lalu", "dulu", "saat", "pernah", "dan", "atau", "akan", "masih", "sekarang", "nya",
             "the", "and", "via", "punya", "memiliki", "mendirikan", "sedangkan", "untuk", "pada", "tbk", "pt",
             "komis", "komisaris", "komut", "direktur", "dirut", "owner", "haji", "bos", "boss", "pemilik", "pengendali"}
BADAN_RX = re.compile(r"\b(PT|TBK|LTD|PTE|LIMITED|INC|CORP|CO|FUND|BANK|KOPERASI|YAYASAN|DANA PENSIUN|ASURANSI)\b", re.I)


def keluarga(pemegang: list[dict]) -> list[dict]:
    """Pemegang perorangan dengan nama belakang sama (>= 2 orang) dianggap satu keluarga: Risjad, Dananto, dst."""
    grup: dict = {}
    for p in pemegang:
        kata = re.sub(r"[^A-Za-z ]", " ", p["name"]).split()
        if BADAN_RX.search(p["name"]) or not 2 <= len(kata) <= 4:
            continue
        for w in {k.upper() for k in kata[1:]}:
            if len(w) >= 4:
                grup.setdefault(w, []).append(p)
    out, dipakai = [], set()
    for nama, ps in sorted(grup.items(), key=lambda kv: -len(kv[1])):
        ps = [p for p in ps if p["name"] not in dipakai]
        if len(ps) >= 2:
            dipakai |= {p["name"] for p in ps}
            out.append({"nama": nama.title(), "anggota": [p["name"] for p in ps], "pct": round(sum(p["pct"] for p in ps), 2)})
    return out
JENIS_AKSI = {"akuisisi": "Pengendali / akuisisi", "rights": "Modal (HMETD / private placement / inbreng)",
              "kbli": "Kegiatan usaha / nama", "direksi": "Pengurus", "uma": "UMA / suspensi"}


def _pct(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return float(re.sub(r"[^\d.]", "", str(v)) or 0)


def _kunci(s: str) -> str:
    s = re.sub(r"\b(PT|TBK|LTD|PTE|LIMITED|INC|BAPAK|IBU|PAK|BU)\b", " ", (s or "").upper())
    return " ".join(sorted(re.sub(r"[^A-Z0-9]+", " ", s).split()))


def _cocok_nama(a: str, b: str) -> bool:
    """Nama orang/badan sama walau urutan kata atau gelar berbeda (semua kata nama pendek ada di nama panjang)."""
    ka, kb = set(_kunci(a).split()), set(_kunci(b).split())
    if not ka or not kb:
        return False
    kecil, besar = (ka, kb) if len(ka) <= len(kb) else (kb, ka)
    return len(kecil) >= 2 and kecil <= besar if len(kecil) > 1 else kecil <= besar and len(next(iter(kecil))) >= 5


def nama_disebut(teks: str) -> list[str]:
    """Nama orang yang disebut di posting: "pak henry pribadi", "bu dina risjad" -> Henry Pribadi, Dina Risjad."""
    out = []
    for m in re.finditer(r"\b(?:pak|bu|bapak|ibu|om|mr\.?|mrs\.?)\s+([a-z][a-z'.-]+(?:\s+[a-z][a-z'.-]+){0,2})", teks, re.I):
        kata = []
        for w in m.group(1).split():
            if w.lower().strip(".") in NAMA_STOP or len(w) < 2:
                break
            kata.append(w.strip(".").capitalize())
        if kata and len(" ".join(kata)) >= 4:
            out.append(" ".join(kata))
    return out


def _jaringan(t: str, pemegang: list[dict], jar: dict) -> tuple[list[dict], list[dict]]:
    """Kepemilikan tiap pemegang (non-publik) di emiten lain + emiten yang dimiliki bersama oleh >= 2 pemegang."""
    rows, per_emiten = [], {}
    for p in pemegang:
        hold = [h for h in (jar.get(p["name"]) or []) if h.get("symbol") and h["symbol"] != t and _pct(h.get("pct")) > 0]
        hold.sort(key=lambda h: -_pct(h.get("pct")))
        keluar = [h for h in (jar.get(p["name"]) or []) if h.get("symbol") and h["symbol"] != t and _pct(h.get("pct")) <= 0
                  or str(h.get("lastAction") or "").upper() in ("SELL", "JUAL") and h.get("symbol") != t]
        rows.append({"nama": p["name"], "pct": p["pct"], "emiten": [{"t": h["symbol"], "pct": _pct(h.get("pct")), "sejak": h.get("since"),
                                                                     "aksi": h.get("lastAction"), "tgl": h.get("lastDate")} for h in hold[:15]],
                     "keluar": [{"t": h["symbol"], "pct": _pct(h.get("pct")), "aksi": h.get("lastAction"), "tgl": h.get("lastDate"), "sejak": h.get("since")}
                                for h in sorted(keluar, key=lambda h: str(h.get("lastDate") or ""), reverse=True)[:10]]})
        for h in hold:
            per_emiten.setdefault(h["symbol"], []).append(p["name"])
    bersama = sorted(({"t": s, "pemegang": ns} for s, ns in per_emiten.items() if len(ns) >= 2), key=lambda x: -len(x["pemegang"]))
    return rows, bersama


def masuk_terverifikasi(r: dict, insider: list[dict]) -> bool:
    """Baris 0% -> X% hanya dianggap MASUK BARU bila ada keterbukaan IDX pihak yang sama <= 10 hari di sekitarnya.
    Baris KSEI saja dengan sebelum 0% sering hanya catatan pertama pemegang lama (mis. pengendali REAL, Enam Berlian)."""
    if (r.get("prev") or 0) > 0 or r.get("source") != "KSEI":
        return True
    d0 = datetime.strptime(r["date"][:10], "%Y-%m-%d")
    k = _kunci(r["name"])
    return any(x.get("source") == "IDX" and _kunci(x["name"]) == k and (x.get("cur") or 0) > (x.get("prev") or 0)
               and abs((datetime.strptime(x["date"][:10], "%Y-%m-%d") - d0).days) <= 10 for x in insider)


def _riwayat(insider: list[dict], kini: datetime) -> list[dict]:
    """Peristiwa kepemilikan penting 3 tahun terakhir: pihak melewati 20%/50% (naik/turun) atau berubah >= 5 poin.
    0% -> X% tanpa keterbukaan IDX ditandai 'pertama tercatat' dan tidak dihitung sebagai pengendali/pemain baru."""
    batas = (kini - timedelta(days=3 * 365)).strftime("%Y-%m-%d")
    out, ada = [], set()
    for r in sorted(insider, key=lambda r: r["date"]):
        if r["date"] < batas:
            continue
        prev, cur = r.get("prev") or 0, r.get("cur") or 0
        kunci = (_kunci(r["name"]), round(prev, 1), round(cur, 1))
        if kunci in ada:
            continue
        ada.add(kunci)
        lewat = next((b for b in (50, 20) if (prev < b <= cur) or (cur < b <= prev)), None)
        if lewat or abs(cur - prev) >= 5:
            if not masuk_terverifikasi(r, insider):
                out.append({"date": r["date"], "nama": r["name"], "prev": prev, "cur": cur, "lewat": None, "pertama": True,
                            "teks": f"{r['name']} pertama tercatat di KSEI {cur:.2f}% tanpa keterbukaan IDX: kemungkinan konversi saham "
                                    f"warkat ke scripless (pemegang lama; saham menjadi siap dijual di pasar atau dialihkan)"})
                continue
            arah = "naik" if cur > prev else "turun"
            teks = f"{r['name']} {arah} {prev:.2f}% -> {cur:.2f}%" + (f" (melewati {lewat}%)" if lewat else "")
            if r.get("purpose"):
                teks += f"; tujuan: {r['purpose'][:120]}"
            out.append({"date": r["date"], "nama": r["name"], "prev": prev, "cur": cur, "lewat": lewat, "teks": teks})
    return out[-15:]


def kinerja_kuartal(ks: dict) -> list[dict]:
    """Laba bersih & pendapatan 8 kuartal terakhir dari Key Stats (Stockbit), dengan YoY dan QoQ laba."""
    ni = (ks.get("kuartal") or {}).get("Net Income") or {}
    rev = (ks.get("kuartal") or {}).get("Revenue") or {}
    kode = sorted(ni, key=lambda k: (k[-2:], k[1]))[-8:]
    out = []
    for k in kode:
        q, yy = int(k[1]), int(k[-2:])
        lalu = ni.get(f"Q{q}{yy - 1:02d}")
        sb = ni.get(f"Q{q - 1}{yy:02d}" if q > 1 else f"Q4{yy - 1:02d}")
        v = ni[k]
        yoy = round((v / lalu - 1) * 100, 1) if lalu and lalu > 0 else None
        qoq = round((v / sb - 1) * 100, 1) if sb and sb > 0 else None
        out.append({"q": k, "laba": v, "pendapatan": rev.get(k), "yoy": yoy, "qoq": qoq,
                    "catatan": "berbalik laba" if v > 0 and lalu is not None and lalu <= 0 else "rugi" if v <= 0 else ""})
    return out[::-1]


def _insider180(insider: list[dict], kini: datetime) -> list[dict]:
    """Transaksi 180 hari per pihak: perubahan persen, lembar, nilai, harga rata-rata, sisa saham, laju per bulan,
    dan perkiraan berapa bulan lagi kepemilikan habis bila laju jual sama (seperti hitungan komunitas)."""
    batas = (kini - timedelta(days=180)).strftime("%Y-%m-%d")
    agg: dict = {}
    for r in sorted(insider, key=lambda r: r["date"]):
        # Catatan pertama KSEI 0% tanpa keterbukaan IDX bukan pembelian (mis. pengendali lama REAL).
        if r["date"] < batas or not masuk_terverifikasi(r, insider):
            continue
        a = agg.setdefault(r["name"], {"nama": r["name"], "chg": 0.0, "n": 0, "role": r.get("role") or "", "nilai": 0.0,
                                       "lembar": 0.0, "awal": r["date"], "akhir": r["date"], "sisa": None, "sisaPct": None, "tujuan": ""})
        a["chg"] += r.get("chg") or 0
        a["n"] += 1
        a["lembar"] += r.get("chgShares") or 0
        a["nilai"] += abs(r.get("value") or 0)
        a["akhir"] = max(a["akhir"], r["date"])
        a["sisa"], a["sisaPct"] = r.get("curShares"), r.get("cur")
        a["tujuan"] = r.get("purpose") or a["tujuan"]
    out = []
    for a in agg.values():
        if abs(a["chg"]) < 0.01:
            continue
        bulan = max(1.0, (datetime.strptime(a["akhir"], "%Y-%m-%d") - datetime.strptime(a["awal"], "%Y-%m-%d")).days / 30.4)
        a["laju"] = round(a["lembar"] / bulan) if a["lembar"] else None
        a["harga"] = round(a["nilai"] / abs(a["lembar"])) if a["lembar"] and a["nilai"] else None
        a["habisBulan"] = round(a["sisa"] / -a["laju"], 1) if a["laju"] and a["laju"] < 0 and a["sisa"] else None
        out.append(a)
    return sorted(out, key=lambda a: -abs(a["chg"]))[:10]


RELASI_RX = re.compile(r"(?:pak|bu|bapak|ibu)?\s*([a-z][a-z'.-]+(?:\s+[a-z][a-z'.-]+){0,2})\s+(?:lewat|melalui|via|memiliki|punya|mengendalikan)\s+"
                       r"(?:anak usaha(?:nya)?\s+)?((?:pt\.?\s+)?[a-z][a-z.&]+(?:\s+[a-z][a-z.&]+){0,3})", re.I)
ANGKA_RX = re.compile(r"[^.!?]*\b(ipo|nilai buku|book value|bv|ekuitas|nominal|free ?float|harga (?:tender|pelaksanaan|wajar)|"
                      r"tersisa|sisa|lembar|miliar|triliun|juta)\b[^.!?]*\d[^.!?]*[.!?]?", re.I)


HUBUNG_RX = re.compile(r"\b(lewat|melalui|via|mengendalikan)\b", re.I)
BATAS_KATA = NAMA_STOP | {"masih", "sebesar", "sekitar", "sedangkan", "serta", "bersama", "kemudian", "lalu", "ada", "saat", "ini",
                          "itu", "tersebut", "sendiri", "anak", "usahanya", "usaha", "dimiliki", "milik", "nya", "ternyata", "namun", "tetapi",
                          "hanya", "tidak", "bahkan", "kini", "menurut", "konon", "katanya"}


def relasi_kalimat(teks: str, t: str = "") -> list[tuple[str, str]]:
    """Pasangan (orang, badan usaha) per kalimat: "Henry Liem ... melalui PT Gitanirwana Mandrasakti, ...".
    Orang = 2-3 kata tepat sebelum kata penghubung (tanpa kata umum/kode saham); badan = maks. 4 kata sesudahnya."""
    out = []
    for kal in re.split(r"[.!?;\n]+", teks):
        for m in HUBUNG_RX.finditer(kal):
            kiri = re.findall(r"[A-Za-z']+", kal[:m.start()])
            org = []
            for w in reversed(kiri):
                if w.lower() in BATAS_KATA or w.upper() == t or len(w) < 2:
                    break
                org.insert(0, w.capitalize())
                if len(org) == 3:
                    break
            if len(org) < 2:
                # Subjek jauh sebelum kata penghubung ("Henry Liem tidak hanya menjual ..., tetapi juga melalui PT ...").
                cand = re.findall(r"\b([A-Z][a-z']+(?:\s+[A-Z][a-z']+){1,3})\b", kal[:m.start()])
                org = [w for w in (cand[-1].split() if cand else []) if w.lower() not in BATAS_KATA and w.upper() != t][-3:]
            org = [w for w in org if w.lower() not in ("pak", "bu", "bapak", "ibu")]
            kanan = re.findall(r"[A-Za-z.&']+|,", kal[m.end():])
            bdn = []
            for w in kanan:
                if w == "," or (w.lower() in BATAS_KATA and w.lower() != "pt") or w.upper() == t:
                    break
                bdn.append(w.upper())
                if len(bdn) == 5:
                    break
            istilah = {"BACKDOOR", "LISTING", "SKEMA", "AKSI", "RIGHTS", "TENDER", "PASAR", "HARGA", "SAHAM", "BURSA", "IPO",
                       "MTO", "HMETD", "BROKER", "BANDAR", "TRANSAKSI", "SEKTOR", "PROYEK"}
            if len(org) >= 2 and len([w for w in bdn if w != "PT"]) >= 1 and len(" ".join(bdn)) >= 5 and not set(bdn) & istilah:
                out.append((" ".join(org), " ".join(bdn)))
    return out


# Nama konglomerat/keluarga/grup besar yang dikenal publik (dicocokkan ke pemegang, UBO, pengurus, jaringan).
KONGLO_RX = re.compile(r"\b(salim|anthoni|sudono|widjaja|sinar ?mas|hartono|djarum|prajogo|pangestu|barito|bakrie|tanoesoedibjo|"
                       r"tanoe|\bmnc\b|riady|lippo|thohir|garibaldi|adaro|hapsoro|isam|tahir|mayapada|risjad|wanandi|sampoerna|"
                       r"kalla|sariaatmadja|emtek|panigoro|medco|soeryadjaya|saratoga|triputra|rachmat|ciputra|sjamsul|gajah tunggal|"
                       r"tjiptadi|tanoto|sukanto|wilmar|kuok|bintoro|harita|lim hariyanto|kusnadi|sariatmadja|djuhar|sudwikatmono|"
                       r"henry pribadi|napan|sugianto|agung sedayu|arsjad|rasjid|bosowa|aksa mahmud|wings|katuari|tirtadjaja|"
                       r"gunawan|tjokrosaputro|rajawali|peter sondakh|cendana|humpuss|bimantara|chairul tanjung|ct corp)\b", re.I)
KLAIM = [
    ("pemilik", re.compile(r"owned by|dimiliki (oleh)?|(?:^|\s)milik\s|punya(nya)? (grup|group|keluarga|pak|bu)|pemilik(nya)? (adalah|itu)?|dibelakangnya|di belakangnya|bekingan|backing", re.I)),
    ("relasi", re.compile(r"kerja(nya)? (untuk|buat|sama)|klien(nya)?|pelanggan(nya)?|customer|kontrak(nya)? (dengan|dari|sama)|"
                          r"garap(an)? (proyek )?(milik|punya)|vendor|kontraktor (untuk|buat)|mitra(nya)?", re.I)),
    ("konglo", re.compile(r"konglo|taipan|\bnaga\b|grup besar|group besar|tier ?1|crazy rich", re.I)),
    ("murah", re.compile(r"murah|undervalue|valuasi|\b\d+(?:[.,]\d+)? ?x harga|nilai wajar|valuasi wajar|di bawah (nilai )?buku|\bpbv\b", re.I)),
    ("likuid", re.compile(r"(gak|tidak|kurang|belum) ?liquid|(gak|tidak|kurang) ?likuid|gorengan|sepi|tipis", re.I)),
    ("akuisisi", re.compile(r"akuisisi|diakuisisi|backdoor|pengendali baru|caplok|tender offer|\bmto\b", re.I)),
    ("laba", re.compile(r"laba (naik|tumbuh|melonjak)|kinerja (bagus|naik)|profit (naik|tumbuh)|turnaround", re.I)),
    ("aset", re.compile(r"inbreng|injeksi|suntik(an)? aset|proyek|tambang baru|anak usaha baru", re.I)),
]


def cek_klaim(posts: list[dict], data: dict) -> list[dict]:
    """Klaim di posting publik dicocokkan dengan data: didukung data / tidak didukung / belum bisa dicek."""
    out, ada = [], set()
    for p in posts:
        for kal in re.split(r"(?<=[.!?\n])\s+|\n", p["txt"]):
            kal = kal.strip(" -•*")
            if not 12 <= len(kal) <= 260 or (len(p["txt"]) < 150 and not p.get("likes")) \
                    or re.search(r"wk(wk)+|haha|hehe|gas+ ?(pol|keun)?\b|to the moon|🚀{2,}", kal, re.I):
                continue
            if any(c["klaim"] == kal for c in out) or re.search(r"…|\.\.\.\s*(sebanyak|seharga|oleh|lembar)|oleh\s*…", kal):
                continue
            for jenis, rx in KLAIM:
                if jenis in ("murah", "laba") or (jenis, p.get("user")) in ada or not rx.search(kal):
                    continue
                status, bukti = data_klaim(jenis, data, kal)
                ada.add((jenis, p.get("user")))
                out.append({"jenis": jenis, "klaim": kal, "user": p.get("user"), "d": p.get("d"), "url": p.get("url"),
                            "status": status, "bukti": bukti})
    urut = {"didukung data": 0, "sebagian didukung": 1, "tidak didukung": 2, "belum bisa dicek": 3}
    return sorted(out, key=lambda c: urut[c["status"]])[:14]


def nama_klaim(kal: str, rx: re.Pattern) -> list[str]:
    """Nama pihak yang disebut setelah kata kunci klaim: "Owned by Sinar Mas, Indra Widjaja, kerjanya untuk LTK dan Haji Isam"."""
    out = []
    for m in rx.finditer(kal):
        ekor = re.split(r"[.;:!?()]|\b(?:kerja\w*|yang|yg|karena|jadi|sehingga|tapi|namun|so|and so|klien\w*|pelanggan\w*)\b",
                        kal[m.end():], flags=re.I)[0]
        for bagian in re.split(r",|\bdan\b|\band\b|&|/", ekor, flags=re.I):
            n = re.sub(r"^(oleh|pak|bu|bapak|ibu|grup|group|keluarga|the)\s+", "", bagian.strip(), flags=re.I).strip(" -")
            umum = {"secara", "pribadi", "sendiri", "sekitar", "lebih", "sebesar", "lagi", "juga", "masih", "semua", "para", "orang"}
            if 2 <= len(n) <= 40 and len(n.split()) <= 4 and not set(n.lower().split()) & umum:
                out.append(n)
    return list(dict.fromkeys(out))[:5]


def nama_dari_posts(posts: list[dict], t: str) -> list[str]:
    """Nama pihak dalam klaim pemilik/hubungan usaha di posting yang membahas saham ini (untuk dicari di berita luar)."""
    out = []
    for p in posts:
        if not tentang(p, t):
            continue
        for kal in re.split(r"(?<=[.!?\n])\s+|\n", p["txt"]):
            for j, rx in KLAIM[:2]:
                if rx.search(kal):
                    out += nama_klaim(kal, rx)
    return list(dict.fromkeys(out))[:6]


def _ada_di(nama: str, teks: list[str]) -> str:
    """Teks pertama yang memuat semua kata penting nama (singkatan 2-4 huruf dicocokkan sebagai kata utuh)."""
    kata = [w for w in re.findall(r"[A-Za-z]+", nama) if len(w) >= 4 or (w.isupper() and len(w) >= 2)]
    if not kata:
        return ""
    for x in teks:
        if all(re.search(rf"\b{re.escape(w)}", x, re.I) for w in kata):
            return x
    return ""


def data_klaim(jenis: str, d: dict, kal: str = "") -> tuple[str, list[str]]:
    if jenis in ("pemilik", "relasi"):
        rx = next(r for j, r in KLAIM if j == jenis)
        nama = nama_klaim(kal, rx)
        if not nama:
            return "belum bisa dicek", ["Nama pihak tidak terbaca dari kalimat klaim."]
        b, cocok = [], 0
        for n in nama:
            h1 = _ada_di(n, d["nama_terkait"])
            h2 = _ada_di(n, d["dokumen"])
            if h1:
                cocok += 1
                b.append(f"{n}: tercatat di data kepemilikan/pengurus/jaringan ({h1[:80]})")
            elif h2:
                cocok += 1
                b.append(f"{n}: disebut di keterbukaan/berita ({h2[:120]})")
            else:
                b.append(f"{n}: tidak ditemukan di data kepemilikan langsung maupun keterbukaan/berita 1 tahun"
                         + (" (kepemilikan bisa lewat badan usaha perantara; cek UBO)" if jenis == "pemilik" else ""))
        if jenis == "pemilik" and not cocok:
            b.append("Pemegang saham tercatat: " + ", ".join(d["nama_terkait"][:4]))
        return ("didukung data" if cocok == len(nama) else "sebagian didukung" if cocok else "belum bisa dicek"), b
    if jenis == "konglo":
        hit = [n for n in d["nama_terkait"] if KONGLO_RX.search(n)]
        luas = [r for r in d["jaringan"] if len(r["emiten"]) >= 3]
        b = [f"Pihak terkait bernama grup/konglomerat: {', '.join(hit[:5])}"] if hit else []
        b += [f"{r['nama']} memegang {len(r['emiten'])} emiten lain ({', '.join(e['t'] for e in r['emiten'][:5])})" for r in luas[:2]]
        if hit:
            return "didukung data", b
        if luas:
            return "belum bisa dicek", b + ["Nama konglomerat tidak tercatat langsung; mungkin lewat badan usaha perantara (cek UBO)."]
        return "tidak didukung", ["Pemegang saham, UBO, pengurus, dan jaringannya tidak memuat nama grup/konglomerat yang dikenal."]
    if jenis == "murah":
        pbv, per, med = d.get("pbv"), d.get("per"), d.get("peMedian")
        b = [x for x in (f"PBV {pbv:.2f}x" if pbv else "", f"PER {per:.1f}x" if per else "", f"median PER IHSG {med:.1f}x" if med else "") if x]
        if not b:
            return "belum bisa dicek", ["Data valuasi belum tersedia."]
        murah = (pbv is not None and 0 < pbv < 1) or (per is not None and med and 0 < per < med)
        if d.get("bvps") and d.get("harga"):
            b.append(f"Nilai buku per saham Rp{d['bvps']:,.0f} = {d['bvps'] / d['harga']:.1f}x harga sekarang".replace(",", "."))
        return ("didukung data" if murah else "tidak didukung"), b
    if jenis == "likuid":
        ff, fe = d.get("ff"), d.get("ffEfektif")
        b = [x for x in (f"Free float Stockbit {ff:.2f}%" if ff is not None else "", f"free float efektif {fe:.2f}%" if fe is not None else "") if x]
        if d.get("broker") is not None:
            b.append(f"Nilai bandar 30 hari Rp{abs(d['broker']) / 1e9:.2f} M")
        tipis = (fe is not None and fe < 15) or (ff is not None and ff < 10)
        return ("didukung data" if tipis else "belum bisa dicek"), b or ["Data likuiditas belum tersedia."]
    if jenis == "akuisisi":
        b = d["ambil"][:2] + d["aksi_akuisisi"][:2]
        return ("didukung data" if b else "tidak didukung"), b or ["Tidak ada perubahan pengendali atau keterbukaan akuisisi yang tercatat."]
    if jenis == "laba":
        kw = d.get("kuartal") or {}
        if not kw:
            return "belum bisa dicek", ["Laba kuartal murni belum terhitung."]
        b = [f"Laba Q{kw.get('q')} murni {kw.get('status')} (YoY {kw.get('yoy')}%, QoQ {kw.get('qoq')}%)"]
        return ("didukung data" if kw.get("tumbuh") or kw.get("status") in ("naik", "berbalik") else "tidak didukung"), b
    if jenis == "aset":
        b = d["aksi_aset"][:3]
        return ("didukung data" if b else "belum bisa dicek"), b or ["Belum ada keterbukaan injeksi aset/proyek baru dalam 1 tahun."]
    return "belum bisa dicek", []


def tentang(p: dict, t: str) -> bool:
    """Posting membahas saham ini secara khusus, bukan sekadar menyebut di antara banyak kode."""
    kode = re.findall(r"\$([A-Z]{4})\b", p["txt"])
    lain = {k for k in kode if k != t}
    return (p["txt"][:80].find("$" + t) >= 0 or kode.count(t) >= 2) and len(lain) <= 4


def _komunitas(posts: list[dict], pemegang: list[dict], pengurus: list[str], jaringan_nama: list[str], t: str) -> dict:
    def skor(p):
        return len(p["txt"]) / 300 + (p.get("likes") or 0) / 15 + 2 * len(TOPIK_RX.findall(p["txt"])) + (5 if tentang(p, t) else 0)
    # Akun bot/rekap otomatis (banyak posting berformat sama) tidak dihitung sebagai analisa komunitas.
    per_akun: dict = {}
    for p in posts:
        per_akun[p.get("user")] = per_akun.get(p.get("user"), 0) + 1
    posts = [p for p in posts if not re.search(r"STOCKBOT|ANALYTICS|MARKET PULSE|SIGNAL BOT", p["txt"][:120])]
    fokus = [p for p in posts if tentang(p, t)]
    pilih = sorted((p for p in fokus if len(p["txt"]) >= 120), key=lambda p: -skor(p))[:8]
    nama: dict = {}
    terkait: dict = {}
    dikenal = [p["name"] for p in pemegang] + pengurus + jaringan_nama
    for p in fokus:
        for n in nama_disebut(p["txt"]):
            if " " not in n:
                continue   # satu kata (mis. "Henry") terlalu umum untuk dicocokkan
            e = nama.setdefault(n, {"nama": n, "n": 0, "terverifikasi": any(_cocok_nama(n, k) for k in dikenal)})
            e["n"] += 1
        for s in set(re.findall(r"\$([A-Z]{4})\b", p["txt"])) - {t}:
            terkait[s] = terkait.get(s, 0) + 1
    # Rantai orang -> badan usaha yang disebut komunitas ("Henry Liem melalui PT Gitanirwana Mandrasakti").
    relasi, klaim = [], []
    for p in fokus:
        for org, bdn in relasi_kalimat(p["txt"], t):
            ok = any(_cocok_nama(bdn, k) for k in dikenal) or any(_cocok_nama(org, k) for k in dikenal)
            if not any(r["orang"] == org and r["badan"] == bdn for r in relasi):
                relasi.append({"orang": org, "badan": bdn, "terverifikasi": ok, "user": p.get("user"), "url": p.get("url")})
        for m in ANGKA_RX.finditer(p["txt"]):
            k = re.sub(r"\s+", " ", m.group(0)).strip()
            if 25 <= len(k) <= 260 and not any(k == c["teks"] for c in klaim):
                klaim.append({"teks": k, "user": p.get("user"), "d": p.get("d"), "url": p.get("url"), "likes": p.get("likes") or 0})
    klaim.sort(key=lambda c: -c["likes"])
    return {"posts": [{**p, "txt": p["txt"][:900]} for p in pilih], "relasi": relasi[:12], "klaim": klaim[:10], "fokus": len(fokus), "fokusPosts": fokus[:60],
            "nama": sorted(nama.values(), key=lambda e: (-e["terverifikasi"], -e["n"]))[:12],
            "terkait": [{"t": s, "n": n} for s, n in sorted(terkait.items(), key=lambda z: -z[1])[:10]],
            "jumlah": len(posts)}


def analyze(d: dict, kini: datetime | None = None) -> dict:
    kini = kini or datetime.now()
    t, prof = d["t"], d.get("profil") or {}
    stats, met = prof.get("stats") or {}, prof.get("metrics") or {}
    # Pemegang: >= 5% dari profil (dengan tanda pengendali) digabung >= 1% KSEI; publik/masyarakat dipisah.
    pmg: dict = {}
    for s in prof.get("shareholders") or []:
        pmg[_kunci(s["name"])] = {"name": s["name"], "pct": _pct(s.get("pct")), "pengendali": bool(s.get("pengendali"))}
    for s in prof.get("holders1") or []:
        k = _kunci(s["name"])
        # Ejaan berbeda untuk pihak yang sama; anggota keluarga (nama belakang sama, porsi sama) tetap dihitung terpisah.
        if k not in pmg and not any(_cocok_nama(s["name"], p["name"]) or abs(_pct(s.get("pct")) - p["pct"]) < 0.02
                                    and len(set(k.split()) & set(_kunci(p["name"]).split())) >= 2 for p in pmg.values()):
            pmg[k] = {"name": s["name"], "pct": _pct(s.get("pct")), "pengendali": False}
    semua = sorted(pmg.values(), key=lambda p: -p["pct"])
    non_publik = [p for p in semua if not PUBLIK_RX.search(p["name"])]
    pengurus = [re.sub(r"\s*\(.*\)$", "", x) for x in (prof.get("directors") or []) + (prof.get("commissioners") or [])]
    for p in non_publik:
        p["pengurus"] = next((x for x in pengurus if _cocok_nama(x, p["name"])), "")
    kel = keluarga(non_publik)
    anggota_kel = {n: k["nama"] for k in kel for n in k["anggota"]}
    for p in non_publik:
        p["keluarga"] = anggota_kel.get(p["name"], "")
    # Terafiliasi (bukan free float menurut BEI): >= 5%, pengendali, pengurus, dan anggota keluarga pemegang tersebut.
    total_np = min(100.0, round(sum(p["pct"] for p in non_publik if p["pct"] >= 5 or p["pengendali"] or p["pengurus"] or p["keluarga"]), 2))
    ff_efektif = round(max(0.0, 100 - total_np), 2)
    # Jaringan: pemegang saham + orang dalam aktif yang ikut ditelusuri server (nama ada di data jaringan).
    sasaran = non_publik[:10] + [{"name": n, "pct": 0.0} for n in (d.get("jaringan") or {})
                                 if not any(_kunci(n) == _kunci(p["name"]) for p in non_publik[:10])]
    jar_rows, bersama = _jaringan(t, sasaran, d.get("jaringan") or {})
    riwayat = _riwayat(d.get("insider") or [], kini)
    ins = _insider180(d.get("insider") or [], kini)
    batas180 = (kini - timedelta(days=180)).strftime("%Y-%m-%d")
    aksi = [{"date": u.get("date"), "judul": u.get("title"), "jenis": u.get("jenis") or [], "inti": u.get("inti") or "", "url": u.get("url")}
            for u in d.get("laporan") or [] if u.get("jenis")][:20]
    jenis180 = {j for a in aksi if (a["date"] or "") >= batas180 for j in a["jenis"]}
    kom = _komunitas(d.get("posts") or [], non_publik, pengurus, [e["t"] for r in jar_rows for e in r["emiten"]], t)
    lk = d.get("lk") or {}
    kw = lk.get("kuartal") or {}
    ff = stats.get("freeFloat")

    dugaan = []

    def tambah(judul, bukti, arah=0):
        if bukti:
            dugaan.append({"judul": judul, "bukti": bukti, "arah": arah,
                           "keyakinan": "tinggi" if len(bukti) >= 3 else "sedang" if len(bukti) == 2 else "rendah"})
    b = []
    if ff is not None and ff < 7.5:
        b.append(f"Free float {ff:.2f}% di bawah ketentuan minimal 7,5% (Peraturan BEI I-A).")
    if ff_efektif < 15:
        b.append(f"Pihak terafiliasi (>= 5%, pengendali, pengurus, keluarga) menguasai {total_np:.2f}%; free float efektif hanya {ff_efektif:.2f}%.")
        b += [f"Keluarga {k['nama']}: {len(k['anggota'])} anggota memegang {k['pct']:.2f}% ({', '.join(k['anggota'][:6])})." for k in kel if k["pct"] >= 3]
    if b:
        b.append("Pemenuhan free float biasanya ditempuh lewat penjualan/distribusi saham pemegang utama atau penambahan saham baru ke publik.")
        tambah("Pemenuhan free float: pemegang utama berpotensi melepas saham ke publik", b, 0)
    ambil = [r for r in riwayat if r["lewat"] and r["cur"] > r["prev"]]
    lepas = [r for r in riwayat if r["lewat"] and r["cur"] < r["prev"]]
    if ambil:
        tambah("Perubahan atau penguatan pengendalian (akuisisi / backdoor)",
               [f"{r['date']}: {r['teks']}" for r in ambil[-3:]] + [f"{r['date']}: {r['teks']}" for r in lepas[-2:]], 1)
    beli = [a for a in ins if a["chg"] > 0]
    jual = [a for a in ins if a["chg"] < 0]
    if beli:
        tambah("Orang dalam / pemegang utama menambah kepemilikan (keyakinan terhadap prospek)",
               [f"{a['nama']}{' (' + a['role'] + ')' if a['role'] else ''} +{a['chg']:.2f} poin dalam {a['n']} transaksi (terakhir {a['akhir']})" for a in beli[:4]], 1)
    if jual:
        bk = []
        for a in jual[:4]:
            x = f"{a['nama']} {a['chg']:.2f} poin dalam {a['n']} transaksi (terakhir {a['akhir']})"
            if a.get("laju"):
                x += f"; rata-rata {abs(a['laju']) / 1e6:.1f} juta lembar/bulan"
            if a.get("sisa"):
                x += f"; sisa {a['sisa'] / 1e6:.1f} juta lembar ({(a['sisaPct'] or 0):.2f}%)"
            if a.get("habisBulan"):
                x += f"; habis dalam ± {a['habisBulan']:.0f} bulan bila laju sama"
            bk.append(x)
        bk += [f"Komunitas: {r['orang']} melalui {r['badan']} (@{r['user']})" for r in kom["relasi"] if any(_cocok_nama(r["orang"], a["nama"]) for a in jual)][:2]
        tambah("Pemegang utama melepas saham bertahap (perlu dicek alasannya: kebutuhan dana, pemenuhan free float, atau keluar)", bk, 0)
    if jenis180 & {"rights", "kbli"}:
        tambah("Aksi korporasi lanjutan: penambahan modal, injeksi aset, atau usaha baru",
               [f"{a['date']}: {a['judul']}" + (f" ({a['inti'][:140]})" if a["inti"] else "") for a in aksi if set(a["jenis"]) & {"rights", "kbli"}][:4], 1)
    if "akuisisi" in jenis180:
        tambah("Keterbukaan terkait pengendali / akuisisi dalam 180 hari",
               [f"{a['date']}: {a['judul']}" for a in aksi if "akuisisi" in a["jenis"]][:4], 1)
    grup = [r for r in jar_rows if len(r["emiten"]) >= 2]
    if grup or bersama:
        bk = [f"{r['nama']} juga memegang {', '.join(e['t'] + ' ' + format(e['pct'], '.2f') + '%' for e in r['emiten'][:6])}" for r in grup[:3]]
        bk += [f"{x['t']} dimiliki bersama oleh {', '.join(x['pemegang'])}" for x in bersama[:3]]
        tambah("Bagian dari jaringan/grup usaha: peluang sinergi atau pengalihan aset antar emiten grup", bk, 0)
    terv = [e for e in kom["nama"] if e["terverifikasi"]]
    if terv:
        tambah("Tokoh yang dibahas komunitas terkonfirmasi di data kepemilikan/pengurus",
               [f"{e['nama']} (disebut {e['n']}x di posting publik)" for e in terv[:5]], 0)
    pbv = met.get("pbv")
    if kw.get("tumbuh") and pbv and 0 < pbv < 1:
        tambah("Valuasi di bawah nilai buku dengan laba kuartal yang tumbuh",
               [f"PBV {pbv:.2f}x", f"Laba Q{kw.get('q')} murni naik dari tahun lalu dan dari kuartal sebelumnya"], 1)

    selidiki = []
    if non_publik:
        p0 = non_publik[0]
        selidiki.append(f"Siapa pemilik manfaat akhir (UBO) di balik {p0['name']} ({p0['pct']:.2f}%)? "
                        + (f"Profil mencatat UBO: {', '.join(prof.get('beneficiary') or [])}." if prof.get("beneficiary") else "UBO belum tercatat di profil."))
    for r in grup[:2]:
        selidiki.append(f"Apa peran {', '.join(e['t'] for e in r['emiten'][:4])} bagi {t}: pemasok, pelanggan, atau calon aset yang diinjeksikan?")
    if ff is not None and ff < 7.5:
        selidiki.append("Kapan dan dengan cara apa kewajiban free float dipenuhi (penjualan saham pendiri, private placement, atau HMETD)?")
    if jenis180 & {"rights", "kbli"}:
        selidiki.append("Rincian penggunaan dana, harga pelaksanaan, dan pihak siaga (standby buyer) aksi korporasi terakhir.")
    for e in [e for e in kom["nama"] if not e["terverifikasi"]][:3]:
        selidiki.append(f"Klaim komunitas tentang {e['nama']} belum terkonfirmasi di data kepemilikan; cek akta, laporan tahunan, atau keterbukaan.")
    if kom["terkait"]:
        selidiki.append(f"Hubungan dengan saham yang sering disebut bersamaan: {', '.join(x['t'] for x in kom['terkait'][:5])}.")
    selidiki.append("Cocokkan dengan dokumen sumber (keterbukaan BEI, laporan tahunan) sebelum mengambil keputusan.")

    harga = (prof.get("chart") or [{}])[-1].get("v") if prof.get("chart") else None
    # Skenario nilai: harga terhadap nilai buku per saham (PBV 1x) dan rentang 52 minggu.
    skenario = []
    bvps, hi, lo = met.get("bvps"), met.get("high52"), met.get("low52")
    if harga and bvps and bvps > 0:
        skenario.append({"label": "Harga di nilai buku (PBV 1x)", "harga": round(bvps), "selisih": round((bvps / harga - 1) * 100, 1)})
    if harga and hi:
        skenario.append({"label": "Tertinggi 52 minggu", "harga": hi, "selisih": round((hi / harga - 1) * 100, 1)})
    if harga and lo:
        skenario.append({"label": "Terendah 52 minggu", "harga": lo, "selisih": round((lo / harga - 1) * 100, 1)})
    bk = d.get("broker")
    if bk and bk.get("bandar", 0) > 0:
        tambah("Akumulasi broker 30 hari terakhir", [f"Net 3 pembeli + 3 penjual teratas Rp{bk['bandar'] / 1e9:.2f} M; pembeli utama {', '.join(bk['akum'])}"], 1)
    pa = d.get("pandangan") or {}
    nama_terkait = [p["name"] for p in non_publik] + list(prof.get("beneficiary") or []) + pengurus \
        + [r["nama"] for r in jar_rows] + [r["badan"] + " " + r["orang"] for r in kom.get("relasi") or []]
    klaim = cek_klaim(kom.get("fokusPosts") or [], {
        "nama_terkait": nama_terkait, "jaringan": jar_rows, "pbv": pbv, "per": met.get("per"), "peMedian": kw.get("peMedian"),
        "bvps": bvps, "harga": harga, "ff": ff, "ffEfektif": ff_efektif, "broker": (bk or {}).get("bandar"), "kuartal": kw,
        "ambil": [f"{r['date']}: {r['teks']}" for r in ambil],
        "aksi_akuisisi": [f"{a['date']}: {a['judul']}" for a in aksi if "akuisisi" in a["jenis"]],
        "aksi_aset": [f"{a['date']}: {a['judul']}" for a in aksi if set(a["jenis"]) & {"rights", "kbli"}],
        "dokumen": [f"{u.get('date')}: {u.get('title')} {u.get('summary') or ''}" for u in d.get("laporan") or []]
                   + [f"{u.get('date')}: {u.get('title')} {u.get('summary') or ''}" for u in d.get("berita") or []]
                   + [f"{u.get('date')}: {u.get('judul')} ({u.get('sumber')})" for u in d.get("beritaLuar") or []]})
    kom.pop("fokusPosts", None)   # hanya untuk cek klaim; posting tidak ditampilkan
    # Kronologi gabungan: perubahan kepemilikan dan aksi korporasi (terbaru dulu).
    kron = [{"date": r["date"], "jenis": "kepemilikan", "teks": r["teks"]} for r in riwayat]
    kron += [{"date": a["date"], "jenis": "aksi", "teks": a["judul"] + (f" — {a['inti'][:160]}" if a["inti"] else "")} for a in aksi]
    RUTIN = re.compile(r"registrasi pemegang|bukti iklan|laporan bulanan|pemanggilan rapat|jadwal|laporan keuangan|"
                       r"penyampaian laporan|public expose|volatilitas", re.I)
    sudah_k = {k["teks"][:60] for k in kron}
    kron += [{"date": u.get("date"), "jenis": "keterbukaan", "teks": u.get("title", "") + (f" — {u['inti'][:160]}" if u.get("inti") else "")}
             for u in d.get("laporan") or [] if not u.get("jenis") and not RUTIN.search(u.get("title", "")) and u.get("title", "")[:60] not in sudah_k]
    kron += [{"date": b.get("date"), "jenis": "berita", "teks": f"{b['judul']} ({b.get('sumber')})"} for b in (d.get("beritaLuar") or [])[:12]]
    kron = sorted((k for k in kron if k["date"]), key=lambda k: k["date"], reverse=True)[:35]

    # ---- Membaca arah pengendali: bandarmologi, jejak volume, preseden grup, sudut yang terlewat, skenario & target.
    bars = d.get("bars") or []
    bandar = PA.bandarmologi(d.get("brokers") or {}, bars, harga)
    volume = PA.jejak_volume(bars, kron)
    pres = PA.preseden(d.get("grupAksi") or [])
    p0 = non_publik[0] if non_publik else None
    konglo = []
    for n in [p["name"] for p in non_publik] + list(prof.get("beneficiary") or []) + pengurus:
        m = PA.KONGLO_NAMA.search(n)
        if m:
            kel_n = next((k["nama"] for k in kel if n in k["anggota"]), "")
            label = f"keluarga {kel_n}" if kel_n else n
            if label not in konglo:
                konglo.append(label)
    pengendali_teks = ""
    if p0:
        pengendali_teks = (f"Siapa pengendalinya: {p0['name']} ({p0['pct']:.2f}%)"
                           + (f", pemilik manfaat akhir {', '.join(prof.get('beneficiary') or [])}" if prof.get("beneficiary") else "")
                           + "".join(f"; keluarga {k['nama']} {k['pct']:.2f}% ({len(k['anggota'])} orang)" for k in kel)
                           + f". Pihak terafiliasi {total_np:.2f}%, free float efektif {ff_efektif:.2f}%"
                           + (f"; nama grup besar di struktur: {', '.join(dict.fromkeys(konglo))[:160]}" if konglo else "") + ".")
    jar_teks = "; ".join(f"{r['nama']} juga di {', '.join(e['t'] + ' ' + format(e['pct'], '.1f') + '%' for e in r['emiten'][:5])}"
                         for r in jar_rows if r["emiten"])
    akt = [f"{a['nama']} {'menambah' if a['chg'] > 0 else 'melepas'} {abs(a['chg']):.2f} poin" for a in ins[:3]]
    akt += [f"{a['date']}: {a['judul'][:80]}" for a in aksi[:2]]
    vol_teks = ""
    if volume:
        v = volume[0]
        vol_teks = (f"Jejak volume: {len(volume)} hari lonjakan >= 3x rata-rata dalam setahun; terbesar {v['kali']}x pada {v['d']}"
                    + (f", sebelum: {v['sebelum']}" if v["sebelum"] else "") + ".")
    terv = [r for r in kom.get("relasi") or [] if r["terverifikasi"]]
    didukung = [k for k in klaim if k["status"] == "didukung data" and k["jenis"] in ("pemilik", "relasi", "konglo", "akuisisi", "aset")]
    publik_teks = ""
    if terv or didukung:
        publik_teks = "Info publik yang terbukti: " + "; ".join(
            [f"{r['orang']} melalui {r['badan']}" for r in terv[:3]] + [f"“{k['klaim'][:90]}” (@{k['user']})" for k in didukung[:3]]) + "."
    batas12k = (kini - timedelta(days=365)).strftime("%Y-%m-%d")
    konversi = [r for r in riwayat if r.get("pertama") and r["cur"] >= 5 and r["date"] >= batas12k]
    c = {"ff": ff, "ffEfektif": ff_efektif, "afiliasi": total_np, "bandar": bandar, "preseden": pres, "ambil": ambil, "lepas": lepas,
         "konversi": [f"{r['date']}: {r['nama']} {r['cur']:.2f}%" for r in konversi],
         "rights": "rights" in jenis180, "kbli": "kbli" in jenis180, "mcap": stats.get("marketCap"), "pbv": pbv, "tumbuh": kw.get("tumbuh"),
         "insiderBeli": [a for a in ins if a["chg"] > 0], "insiderJual": [a for a in ins if a["chg"] < 0],
         "habisBulan": any(a.get("habisBulan") for a in ins), "bersama": bersama, "grupN": sum(1 for r in jar_rows if len(r["emiten"]) >= 1),
         "konglo": konglo, "pengendaliTeks": pengendali_teks, "jaringanTeks": ("Jejak di emiten lain: " + jar_teks + ".") if jar_teks else "",
         "aktivitasTeks": ("Yang sedang dilakukan: " + "; ".join(akt) + ".") if akt else "", "volumeTeks": vol_teks, "publikTeks": publik_teks,
         "harga": harga, "insider": ins, "ekuitas": met.get("equity"), "insiderRaw": d.get("insider") or [], "bvps": bvps, "high52": hi,
         "aksi": aksi, "pengurusBaru": next((a["date"] for a in aksi if "direksi" in a["jenis"]), ""),
         "pemainBaru": [f"{r['nama']} masuk {r['cur']:.2f}% ({r['date']})" for r in riwayat if r["prev"] == 0 and r["cur"] >= 5 and not r.get("pertama")]}
    # Rekam jejak penjual cangkang dihitung sebelum skenario arah agar ikut menentukan skor.
    jejak = PA.jejak_cangkang(jar_rows, d.get("grupAksi") or [], t)
    c["preseden"] = pres + [j["teks"] for j in jejak]
    arah_ = PA.arah(c)
    sudut = [x for x in PA.sudut_lain(c) if not x.startswith("Pasar menilai")]   # tanpa sudut fundamental
    target = PA.target_harga(c)
    # Fokus: peta afiliasi, potensi backdoor / ganti pengendali, market maker.
    afil = PA.afiliasi(non_publik, d.get("insider") or [], kel, bersama)
    batas12 = (kini - timedelta(days=365)).strftime("%Y-%m-%d")
    masuk_bersama = [k for k in afil["kelompok"] if k["jenis"] == "bergerak bersamaan" and k["dasar"][:10] >= batas12]
    RUPS_RX = re.compile(r"anggaran dasar|kegiatan usaha|maksud dan tujuan|perubahan (susunan )?(direksi|komisaris|pengurus)|"
                         r"pengendali|pengambilalihan|nama perseroan", re.I)
    rups = [f"{u.get('date')}: {u.get('title')}" for u in d.get("laporan") or []
            if RUPS_RX.search(f"{u.get('title', '')} {u.get('summary') or ''}")][:5]
    bd = PA.potensi_backdoor({**c, "batas12": batas12, "jejakCangkang": jejak, "masukBersama": masuk_bersama, "rupsBerubah": rups,
                              "akum": any(f["bandar"] > 0 for f in bandar.get("fase") or [] if f["hari"] >= 30)})
    bd["rups"] = rups
    mm = PA.market_maker(d.get("insider") or [], bandar)
    # Galian lanjutan: pengurus & alamat lintas emiten, harga pengalihan, kalender backdoor, broker grup, nominee,
    # tren pemegang ritel, rekam jejak UBO/emiten jaringan.
    idx = d.get("indeks") or {}
    ubo = list(prof.get("beneficiary") or [])
    gal_harga = PG.harga_pengalihan(d.get("insider") or [], bars, d.get("laporan") or [], harga)
    galian = {
        "kalender": PG.kalender_backdoor({"kini": kini, "laporan": d.get("laporan") or [], "konversi": c.get("konversi"),
                                          "insiderJual": c.get("insiderJual"), "bandar": bandar, "ambil": ambil, "tumbuh": kw.get("tumbuh")}),
        "harga": gal_harga,
        "rekam": PG.rekam_jejak(jar_rows, d.get("nasib") or {}, d.get("rekamBerita") or []),
        "pengurus": PG.pengurus_lintas(t, pengurus, [p["name"] for p in non_publik], idx),
        "alamat": PG.alamat_sama(t, idx),
        "broker": PG.broker_grup(bandar, d.get("insider") or [], [p["name"] for p in non_publik] + ubo + konglo + [d.get("nama") or ""]),
        "nominee": PG.nominee(non_publik, d.get("detailPemegang") or {}, jar_rows, pengurus, ubo, d.get("insider") or [], afil["kelompok"]),
        "ritel": PG.tren_ritel([tuple(x) for x in d.get("jumlahPemegang") or []], bars),
    }
    if gal_harga.get("acuan") and harga:
        ac = gal_harga["acuan"]
        target = target + [{"label": "Harga acuan pengalihan pengendali", "harga": ac["harga"],
                            "potensi": round((ac["harga"] / harga - 1) * 100, 1), "dasar": ac["dasar"]}]
    for n in [x for x in galian["nominee"] if x["kuat"]][:2]:
        selidiki.insert(-1, f"Siapa di balik {n['nama']} ({n['pct']:.2f}%)? Indikasi nominee: {'; '.join(n['tanda'])}.")
    for x in galian["pengurus"][:2]:
        selidiki.insert(-1, f"{x['nama']} ({x['peran']}) juga di {', '.join(e['t'] for e in x['emiten'][:5])}: cek apakah emiten itu satu grup/calon aset.")
    tanya = PA.pertanyaan_kunci({
        "t": t, "kini": kini, "ins": ins, "insiderRaw": d.get("insider") or [], "bandar": bandar, "jaringan": jar_rows, "jejakData": jejak,
        "aksiSemua": [{"date": u.get("date"), "judul": u.get("title", "")} for u in d.get("laporan") or []], "rups": rups,
        "laporan": d.get("laporan") or [], "beritaLuar": d.get("beritaLuar") or [], "pemegang": non_publik,
        "ubo": prof.get("beneficiary") or [], "preseden": c.get("preseden"), "grup": d.get("grupInfo") or [], "konversi": c.get("konversi")})
    ringkas = [f"{t} · {d.get('nama') or ''}".strip(" ·"),
               " / ".join(x for x in (prof.get("sector"), prof.get("industry")) if x)]
    if non_publik:
        ringkas.append(f"Pemegang utama {non_publik[0]['name']} {non_publik[0]['pct']:.2f}%; terafiliasi {total_np:.2f}% (free float efektif {ff_efektif:.2f}%)"
                       + (f"; free float {ff:.2f}%" if ff is not None else ""))
    ringkas.append("Tahapan backdoor: " + galian["kalender"]["ringkas"])
    if dugaan:
        ringkas.append("Dugaan terkuat: " + max(dugaan, key=lambda g: len(g["bukti"]))["judul"].split(":")[0])
    return {
        "t": t, "nama": d.get("nama") or "", "dibuat": kini.strftime("%Y-%m-%d %H:%M"), "ringkas": [x for x in ringkas if x],
        "identitas": {"sektor": prof.get("sector"), "subsektor": prof.get("subSector"), "industri": prof.get("industry"),
                      "latar": (prof.get("background") or "")[:900], "website": prof.get("website"), "harga": harga,
                      "mcap": stats.get("marketCap"), "saham": stats.get("shares"), "freeFloat": ff},
        "kepemilikan": {"pemegang": non_publik[:12], "publik": [p for p in semua if PUBLIK_RX.search(p["name"])][:3], "nonPublik": total_np, "ffEfektif": ff_efektif, "keluarga": kel,
                        "ubo": prof.get("beneficiary") or [], "direksi": prof.get("directors") or [], "komisaris": prof.get("commissioners") or []},
        "jaringan": jar_rows, "bersama": bersama[:10], "riwayat": riwayat, "insider": ins, "aksi": aksi,
        "berita": [{"date": u.get("date"), "judul": u.get("title"), "url": u.get("url")} for u in (d.get("berita") or [])[:10]],
        "kinerjaQ": kinerja_kuartal(d.get("keystats") or {}),
        "tokoh": d.get("tokoh") or [],
        "kinerja": {"periode": lk.get("periode"), "judul": lk.get("judul"), "kuartal": kw or None, "pbv": pbv, "per": met.get("per"),
                    "laba": met.get("netIncomeTtm"), "pendapatan": met.get("revenueTtm"), "ekuitas": met.get("equity"), "bvps": met.get("bvps")},
        "komunitas": kom, "dugaan": dugaan, "selidiki": selidiki, "skenario": skenario, "kronologi": kron, "broker": bk, "klaim": [k for k in klaim if k["status"] == "didukung data"], "beritaLuar": (d.get("beritaLuar") or [])[:25],
        "arah": arah_, "bandarmologi": bandar, "afiliasi": afil, "backdoor": bd, "marketMaker": mm, "jejakCangkang": jejak, "pertanyaan": tanya, "galian": galian, "volume": volume, "preseden": pres, "sudut": sudut, "target": target,
        "radarSikap": {"sikap": pa.get("sikap"), "ringkas": (pa.get("ringkas") or "")[:400], "nilaiWajar": pa.get("nilaiWajar")} if pa.get("sikap") else None,
        "sumber": {"pemegang": len(semua), "jaringan": sum(len(r["emiten"]) for r in jar_rows), "keterbukaan": len(d.get("laporan") or []),
                   "berita": len(d.get("berita") or []), "posting": kom["jumlah"], "insider": len(d.get("insider") or [])},
        "catatan": d.get("catatan") or [],
    }
