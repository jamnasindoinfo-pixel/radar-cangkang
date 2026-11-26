"""Galian lanjutan analisa mendalam POV (aturan otomatis, tanpa HTTP; data dikumpulkan server):

1. Jejak pengurus lintas emiten     5. Identitas broker / sekuritas grup
2. Alamat & telepon kantor sama     6. Deteksi nominee
3. Harga pengalihan vs pasar        7. Tren jumlah pemegang saham (ritel) KSEI
4. Kalender tahapan backdoor        8. Rekam jejak UBO & emiten jaringannya
"""
from __future__ import annotations

import re
from datetime import datetime

import povarah as PA

# Pemegang institusi (bukan pihak pengendali): tidak ditelusuri lintas emiten.
BADAN_ORANG_RX = re.compile(r"\b(FUND|BANK|AG|BRANCH|DJS|BPJS|PROGRAM|DANA|REKSA|SEKURITAS|SECURITIES|NEGARA|KOPERASI|YAYASAN|"
                            r"ASURANSI|INSURANCE|PENSIUN|JAMINAN|NOMINEES?|CUSTODY|TRUST)\b", re.I)
# ---------------------------------------------------------------- umum ----
GELAR_RX = re.compile(r"\b(PT|TBK|DR|DRS|DRA|IR|H|HJ|SH|SE|MM|MBA|MSC|ST|AK|CPA|PROF|MR|MRS|MS|BSC|MH|MSI|SKOM|SSI|SPD|MT)\b\.?", re.I)


def kunci_orang(s: str) -> str:
    """Nama orang tanpa gelar/tanda baca, kata diurutkan: 'Ir. Budi Santoso, MBA' -> 'BUDI SANTOSO'."""
    s = re.sub(r"\(.*?\)", " ", s or "")
    s = GELAR_RX.sub(" ", s.upper())
    return " ".join(sorted(w for w in re.sub(r"[^A-Z ]+", " ", s).split() if len(w) >= 2))


def _tgl(s: str) -> datetime | None:
    for f in ("%Y-%m-%d", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(str(s or "")[:11].strip(), f)
        except ValueError:
            continue
    return None


# ------------------------------------------------- 1. pengurus lintas emiten ----
def pengurus_lintas(t: str, pengurus: list[str], pemegang: list[str], indeks: dict) -> list[dict]:
    """Direksi/komisaris emiten ini yang juga menjadi pengurus atau pemegang saham di emiten lain (indeks profil BEI),
    serta pemegang saham perorangan emiten ini yang duduk sebagai pengurus emiten lain. Nama minimal 2 kata."""
    sasaran: dict[str, dict] = {}
    for n in pengurus:
        k = kunci_orang(n)
        if len(k.split()) >= 2:
            sasaran.setdefault(k, {"nama": re.sub(r"\s*\(.*\)$", "", n).strip(), "peran": "pengurus " + t})
    for n in pemegang:
        k = kunci_orang(n)
        # Perorangan & badan usaha pengendali; kustodian, dana pensiun/BPJS, bank, dan sekuritas tidak dihitung.
        if len(k.split()) >= 2 and not BADAN_ORANG_RX.search(n) and PA.bukan_kustodian(n):
            sasaran.setdefault(k, {"nama": n, "peran": "pemegang saham " + t})
    out = []
    for k, s in sasaran.items():
        di = []
        for e, v in indeks.items():
            if e == t:
                continue
            if any(kunci_orang(p) == k for p in v.get("pengurus") or []):
                di.append({"t": e, "sebagai": "pengurus"})
            elif any(kunci_orang(p[0]) == k for p in v.get("pemegang") or []):
                pct = next(p[1] for p in v["pemegang"] if kunci_orang(p[0]) == k)
                di.append({"t": e, "sebagai": f"pemegang {pct:.2f}%" if pct else "pemegang"})
        if di:
            out.append({**s, "emiten": di[:10]})
    out.sort(key=lambda r: -len(r["emiten"]))
    return out[:12]


# --------------------------------------------------- 2. alamat kantor sama ----
ALAMAT_UMUM = {"JL", "JLN", "JALAN", "NO", "NOMOR", "KAV", "KAVLING", "LT", "LANTAI", "FLOOR", "RT", "RW", "KEL", "KEC", "KELURAHAN",
               "KECAMATAN", "KOTA", "KAB", "KABUPATEN", "PROVINSI", "DKI", "JAKARTA", "INDONESIA", "SELATAN", "UTARA", "BARAT", "TIMUR",
               "PUSAT", "TOWER", "GEDUNG", "GD", "GDG", "BLOK", "BLOCK", "THE", "DAN", "DI", "RAYA", "PLAZA", "BUILDING", "SUITE", "UNIT"}


def _token_alamat(s: str) -> set[str]:
    return {w for w in re.sub(r"[^A-Z0-9]+", " ", (s or "").upper()).split() if w not in ALAMAT_UMUM and len(w) >= 2}


def _lantai(s: str) -> str:
    m = re.search(r"\b(?:LT|LANTAI|LEVEL|FLOOR|FL)\.?\s*(\d+)|\b(\d+)(?:ST|ND|RD|TH)\s+FLOOR", (s or "").upper())
    return (m.group(1) or m.group(2)) if m else ""


def _telp(s: str) -> str:
    d = re.sub(r"\D", "", (s or "").split("/")[0].split(",")[0])
    return d[-8:] if len(d) >= 8 else ""


def alamat_sama(t: str, indeks: dict) -> list[dict]:
    """Emiten lain berkantor di alamat yang sama (>= 70% kata khas alamat sama, minimal 4 kata termasuk nomor) atau
    bernomor telepon sama: sering satu grup/pengendali walau nama berbeda."""
    me = indeks.get(t) or {}
    ta, tel = _token_alamat(me.get("alamat")), _telp(me.get("telp"))
    out = []
    for e, v in indeks.items():
        if e == t:
            continue
        dasar = []
        if tel and _telp(v.get("telp")) == tel:
            dasar.append("telepon sama")
        tb = _token_alamat(v.get("alamat"))
        sama = ta & tb
        # Gedung perkantoran dihuni banyak perusahaan: bila ada nomor lantai, lantainya harus sama.
        la, lb = _lantai(me.get("alamat")), _lantai(v.get("alamat"))
        if ta and tb and len(sama) >= 4 and any(re.search(r"\d", w) for w in sama) and len(sama) / min(len(ta), len(tb)) >= 0.7 \
                and la == lb:
            dasar.append("alamat kantor sama" + (f" (lantai {la})" if la else ""))
        if dasar:
            out.append({"t": e, "dasar": " & ".join(dasar), "alamat": (v.get("alamat") or "")[:140]})
    return sorted(out, key=lambda r: -len(r["dasar"]))[:12]


# ------------------------------------------------ 3. harga pengalihan vs pasar ----
HARGA_DOK_RX = re.compile(r"harga\s+(?:penawaran(?:\s+tender)?|pelaksanaan|pengalihan|pembelian|jual\s*beli|transaksi|per\s+saham)"
                          r"[^.;]{0,60}?rp\.?\s?([\d.,]+)", re.I)


def _angka_id(s: str) -> float | None:
    s = s.strip(".,")
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", s):
        return float(re.sub(r"[.,]", "", s))
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def harga_pengalihan(insider: list[dict], bars: list[dict], laporan: list[dict], harga: float | None) -> dict:
    """Harga transaksi pemegang besar/orang dalam (keterbukaan, bukan harga perkiraan) dibanding harga penutupan pasar
    hari itu, ditambah harga tender/pelaksanaan yang disebut dokumen. Premi besar = pembeli strategis berani bayar mahal;
    diskon besar = pengalihan internal/nominee atau penjual butuh keluar."""
    tutup = {b["d"]: b["c"] for b in bars if b.get("c")}
    hari = sorted(tutup)

    def pasar(d):
        sebelum = [x for x in hari if x <= d]
        return tutup[sebelum[-1]] if sebelum else None
    rows, ada = [], set()
    for r in sorted(insider, key=lambda r: r["date"], reverse=True):
        if not r.get("price") or r.get("estPrice") or (abs(r.get("chg") or 0) < 0.3 and (r.get("value") or 0) < 1e9):
            continue
        k = (r["name"], r["date"])
        if k in ada:
            continue
        ada.add(k)
        ps = pasar(r["date"])
        rows.append({"date": r["date"], "nama": r["name"], "arah": "beli" if (r.get("chg") or 0) > 0 else "jual", "harga": r["price"],
                     "pasar": ps, "selisih": round((r["price"] / ps - 1) * 100, 1) if ps else None, "chg": r.get("chg"),
                     "nilai": r.get("value")})
    dok = []
    for u in laporan:
        teks = f"{u.get('title', '')}. {u.get('summary') or ''}"
        for m in HARGA_DOK_RX.finditer(teks):
            v = _angka_id(m.group(1))
            if v and v >= 1:
                dok.append({"date": u.get("date"), "judul": (u.get("title") or "")[:120], "harga": v, "url": u.get("url"),
                            "konteks": m.group(0)[:100]})
                break
    catatan = []
    besar = [r for r in rows if abs(r.get("chg") or 0) >= 1 and r["selisih"] is not None]
    for r in besar[:3]:
        if r["selisih"] >= 15:
            catatan.append(f"{r['date']}: {r['nama']} {r['arah']} di Rp{r['harga']:,.0f}, premi {r['selisih']:+.1f}% dari harga pasar "
                           f"(Rp{r['pasar']:,.0f}): pihak itu menilai saham jauh di atas harga pasar.".replace(",", "."))
        elif r["selisih"] <= -15:
            catatan.append(f"{r['date']}: {r['nama']} {r['arah']} di Rp{r['harga']:,.0f}, diskon {r['selisih']:.1f}% dari harga pasar "
                           f"(Rp{r['pasar']:,.0f}): ciri pengalihan internal grup/nominee atau penjual yang perlu cepat keluar.".replace(",", "."))
    acuan = None
    kandidat = [(r["date"], r["harga"], f"transaksi {r['nama']} {r['date']}") for r in besar] + \
               [(d["date"] or "", d["harga"], f"dokumen {d['date']}: {d['judul'][:60]}") for d in dok]
    if kandidat:
        acuan = max(kandidat, key=lambda x: x[0])
        if harga:
            catatan.append(f"Harga kini Rp{harga:,.0f} = {(harga / acuan[1] - 1) * 100:+.1f}% dari harga acuan pengalihan terakhir "
                           f"Rp{acuan[1]:,.0f} ({acuan[2]}).".replace(",", "."))
    return {"rows": rows[:12], "dokumen": dok[:6], "catatan": catatan,
            "acuan": {"harga": acuan[1], "dasar": acuan[2]} if acuan else None}


# ------------------------------------------------- 4. kalender tahapan backdoor ----
TAHAP = [
    ("Persiapan cangkang", "Pemegang lama merapikan saham: konversi warkat ke scripless, melepas bertahap, membersihkan aset/utang.",
     r"pelepasan aset|divestasi|penjualan aset|restrukturisasi|penyelesaian utang|kuasi reorganisasi", "1–6 bulan"),
    ("Akumulasi & negosiasi", "Bandar mengumpulkan barang; calon pembeli bernegosiasi (MoU, term sheet, pengalihan piutang).",
     r"negosiasi|nota kesepahaman|\bmou\b|term sheet|calon (investor|pengendali|pembeli)|cessie|pengalihan (hak )?(tagih|piutang)|"
     r"kreditur baru|perjanjian pendahuluan", "1–3 bulan"),
    ("Pengalihan pengendali (PPJB / akuisisi)", "Saham pengendali berpindah: PPJB, jual beli saham, pengendali baru diumumkan.",
     r"ppjb|pengikatan jual beli|jual beli saham|pengalihan saham|pengambilalihan|perubahan pengendali|pengendali baru|akuisisi", "1–3 bulan"),
    ("Penawaran tender wajib", "Pengendali baru membeli saham publik (tender offer) sesuai POJK 9/2018.",
     r"penawaran tender|tender offer|\bmto\b", "1–3 bulan"),
    ("RUPSLB: pengurus, anggaran dasar, nama, usaha", "Pengurus diganti orang pengendali baru; nama, kegiatan usaha (KBLI), dan anggaran dasar diubah.",
     r"perubahan (susunan )?(anggota )?(direksi|dewan komisaris|pengurus)|anggaran dasar|kegiatan usaha|\bkbli\b|perubahan nama|nama perseroan|"
     r"rupslb|rapat umum pemegang saham luar biasa", "3–12 bulan"),
    ("Injeksi aset / penambahan modal", "Aset/usaha pengendali baru dimasukkan: inbreng, transaksi material, HMETD, private placement.",
     r"inbreng|transaksi material|hmetd|hak memesan|rights issue|private placement|penambahan modal|penyertaan (modal|saham)|"
     r"penggabungan usaha|merger", "6–12 bulan"),
    ("Re-rating: bisnis baru tercermin di kinerja", "Pendapatan/laba dari usaha baru mulai tercatat; pasar menilai ulang.", r"$^", "-"),
]


def kalender_backdoor(c: dict) -> dict:
    """Posisi emiten di urutan tahapan backdoor yang lazim (bukti 24 bulan terakhir) dan tahap berikutnya yang ditunggu.
    c: konversi, insiderJual, ambil, bandar, laporan, pengurusBaru, tumbuh, kini."""
    kini = c.get("kini") or datetime.now()
    batas = (kini.replace(year=kini.year - 2)).strftime("%Y-%m-%d")
    lap = [u for u in c.get("laporan") or [] if (u.get("date") or "") >= batas]
    bukti: list[list[tuple[str, str]]] = [[] for _ in TAHAP]
    for i, (_, _, rx, _) in enumerate(TAHAP):
        for u in lap:
            if re.search(rx, f"{u.get('title', '')} {u.get('inti') or ''}", re.I) and not re.search(
                    r"laporan keuangan|volatilitas|laporan bulanan|registrasi pemegang|bukti iklan", u.get("title") or "", re.I):
                bukti[i].append((u.get("date") or "", f"{u.get('date')}: {(u.get('title') or '')[:110]}"))
    for k in c.get("konversi") or []:
        bukti[0].append((k[:10], f"{k} (konversi warkat ke scripless)"))
    for a in (c.get("insiderJual") or [])[:2]:
        bukti[0].append((a.get("akhir") or "", f"{a['nama']} melepas {abs(a['chg']):.2f} poin bertahap (terakhir {a.get('akhir')})"))
    for f in (c.get("bandar") or {}).get("fase") or []:
        if f["hari"] >= 30 and f["bandar"] > 0:
            bukti[1].append((kini.strftime("%Y-%m-%d"), f"Bandar {f['periode']} akumulasi Rp{f['bandar'] / 1e9:.2f} M via {', '.join(f['akum'])}"))
            break
    for r in c.get("ambil") or []:
        if r["date"] >= batas:
            bukti[2].append((r["date"], f"{r['date']}: {r['teks'][:120]}"))
    if c.get("tumbuh") and any(bukti[i] for i in (2, 4, 5)):
        bukti[6].append((kini.strftime("%Y-%m-%d"), "Laba kuartal terakhir naik dari tahun lalu dan kuartal sebelumnya setelah perubahan struktur."))
    tahap = []
    for i, (nama, arti, _, jeda) in enumerate(TAHAP):
        bs = sorted(bukti[i], key=lambda x: x[0], reverse=True)
        tahap.append({"n": i + 1, "nama": nama, "arti": arti, "jeda": jeda, "status": "terjadi" if bs else "belum",
                      "tgl": bs[0][0][:10] if bs else "", "bukti": list(dict.fromkeys(b for _, b in bs))[:4]})
    terjadi = [x for x in tahap if x["status"] == "terjadi"]
    posisi = max((x["n"] for x in terjadi), default=0)
    # Tahap ke-0/1 saja (persiapan/akumulasi) belum cukup disebut proses backdoor berjalan.
    if not terjadi:
        ringkas = "Belum ada tahapan backdoor yang terdeteksi dalam 24 bulan."
        berikut = "Tunggu tanda awal: konversi saham pengendali ke scripless, akumulasi bandar, atau MoU/negosiasi calon investor."
    else:
        kini_t = tahap[posisi - 1]
        lompat = [x["nama"] for x in tahap[:posisi - 1] if x["status"] == "belum"]
        ringkas = (f"Posisi saat ini: tahap {posisi} dari 7 ({kini_t['nama']}, terakhir {kini_t['tgl'] or '-'})."
                   + (f" Tahap yang belum terlihat sebelumnya: {', '.join(lompat)}." if lompat else ""))
        if posisi < len(TAHAP):
            nx = tahap[posisi]
            berikut = f"Tahap berikutnya: {nx['nama']} — {nx['arti']} Jeda lazim dari tahap sebelumnya {kini_t['jeda']}."
        else:
            berikut = "Seluruh tahap sudah terlihat; perhatikan konsistensi kinerja bisnis baru."
    return {"tahap": tahap, "posisi": posisi, "ringkas": ringkas, "berikut": berikut}


# --------------------------------------------------- 5. broker / sekuritas grup ----
# Nama anggota bursa per kode broker BEI; jenis: asing (institusi asing), ritel (platform ritel daring), bumn, lokal.
BROKER = {
    "AK": ("UBS Sekuritas", "asing"), "BK": ("J.P. Morgan Sekuritas", "asing"), "ML": ("Merrill Lynch Sekuritas", "asing"),
    "MS": ("Morgan Stanley Sekuritas", "asing"), "GW": ("HSBC Sekuritas", "asing"), "KZ": ("CLSA Sekuritas", "asing"),
    "RX": ("Macquarie Sekuritas", "asing"), "YU": ("CGS International Sekuritas", "asing"), "ZP": ("Maybank Sekuritas", "asing"),
    "AI": ("UOB Kay Hian Sekuritas", "asing"), "DR": ("RHB Sekuritas", "asing"), "TP": ("OCBC Sekuritas", "asing"),
    "FS": ("Yuanta Sekuritas", "asing"), "HD": ("KGI Sekuritas", "asing"), "AH": ("Shinhan Sekuritas", "asing"),
    "AG": ("Kiwoom Sekuritas", "asing"), "XA": ("NH Korindo Sekuritas", "asing"), "BQ": ("Korea Investment & Sekuritas", "asing"),
    "YP": ("Mirae Asset Sekuritas", "ritel"), "XL": ("Stockbit Sekuritas", "ritel"), "XC": ("Ajaib Sekuritas", "ritel"),
    "PD": ("Indo Premier Sekuritas", "ritel"), "KK": ("Phillip Sekuritas", "ritel"),
    "CC": ("Mandiri Sekuritas", "bumn"), "NI": ("BNI Sekuritas", "bumn"), "OD": ("BRI Danareksa Sekuritas", "bumn"),
    "DX": ("Bahana Sekuritas", "bumn"),
    "DH": ("Sinarmas Sekuritas", "lokal"), "EP": ("MNC Sekuritas", "lokal"), "SQ": ("BCA Sekuritas", "lokal"),
    "CD": ("Mega Capital Sekuritas", "lokal"), "GR": ("Panin Sekuritas", "lokal"), "LS": ("Reliance Sekuritas", "lokal"),
    "KS": ("Kresna Sekuritas", "lokal"), "IF": ("Samuel Sekuritas", "lokal"), "AT": ("Phintraco Sekuritas", "lokal"),
    "HP": ("Henan Putihrai Sekuritas", "lokal"), "LG": ("Trimegah Sekuritas", "lokal"), "AZ": ("Sucor Sekuritas", "lokal"),
    "MG": ("Semesta Indovest Sekuritas", "lokal"), "KI": ("Ciptadana Sekuritas", "lokal"), "CP": ("KB Valbury Sekuritas", "lokal"),
    "BB": ("Verdhana Sekuritas", "lokal"), "II": ("Danatama Makmur Sekuritas", "lokal"), "EL": ("Evergreen Sekuritas", "lokal"),
    "SS": ("Supra Sekuritas", "lokal"), "AO": ("Erdikha Elit Sekuritas", "lokal"), "IN": ("Investindo Nusantara Sekuritas", "lokal"),
    "BZ": ("Batavia Prosperindo Sekuritas", "lokal"), "PP": ("Aldiracita Sekuritas", "lokal"), "MU": ("Minna Padi Investama Sekuritas", "lokal"),
    "YJ": ("Lotus Andalan Sekuritas", "lokal"), "RF": ("Buana Capital Sekuritas", "lokal"), "TF": ("Universal Broker Indonesia", "lokal"),
    "BS": ("Equity Sekuritas", "lokal"), "AP": ("Pacific Sekuritas", "lokal"), "SH": ("Artha Sekuritas", "lokal"),
    "ZR": ("Bumiputera Sekuritas", "lokal"), "OK": ("NET Sekuritas", "lokal"), "DD": ("Makindo Sekuritas", "lokal"),
    "BF": ("Inti Fikasa Sekuritas", "lokal"), "PC": ("FAC Sekuritas", "lokal"), "FZ": ("Waterfront Sekuritas", "lokal"),
    "PO": ("Pilarmas Investindo Sekuritas", "lokal"), "IU": ("Indo Capital Sekuritas", "lokal"),
}
# Sekuritas milik grup usaha: kode -> (grup, pola nama pengendali/UBO/pemegang yang menandakan grup yang sama).
BROKER_GRUP = {
    "DH": ("Sinar Mas", r"sinar ?mas|widjaja"), "EP": ("MNC", r"\bmnc\b|tanoesoedibjo|tanoe"), "SQ": ("Djarum / BCA", r"djarum|hartono|\bbca\b"),
    "CD": ("CT Corp", r"ct corp|tanjung|\bmega\b"), "GR": ("Panin", r"panin|gunawan"), "LS": ("Reliance", r"reliance"),
    "KS": ("Kresna", r"kresna"), "IF": ("Samuel", r"samuel"), "AT": ("Phintraco", r"phintraco"), "HP": ("Henan Putihrai", r"henan|putihrai"),
    "CC": ("BUMN (Mandiri)", r"\(persero\)|negara republik|danantara|\bbumn\b"), "NI": ("BUMN (BNI)", r"\(persero\)|negara republik|danantara|\bbumn\b"),
    "OD": ("BUMN (BRI)", r"\(persero\)|negara republik|danantara|\bbumn\b"), "DX": ("BUMN (Bahana)", r"\(persero\)|negara republik|danantara|\bbumn\b"),
}


def nama_broker(b: str) -> str:
    n = BROKER.get(b)
    return f"{b} ({n[0]})" if n else b


def broker_grup(bandar: dict, insider: list[dict], nama_struktur: list[str]) -> dict:
    """Identitas broker bandar & orang dalam: nama sekuritas, jenis (asing/ritel/BUMN/lokal), grup pemiliknya,
    dan apakah sekuritas itu satu grup dengan pengendali/UBO/pemegang saham emiten ini."""
    struktur = " | ".join(nama_struktur)
    peran: dict[str, list[str]] = {}
    for f in bandar.get("fase") or []:
        for b in f["akum"]:
            peran.setdefault(b, []).append(f"beli {f['periode']}")
        for b in f["dist"]:
            peran.setdefault(b, []).append(f"jual {f['periode']}")
    for r in insider:
        for b in {x.strip() for x in re.split(r"[,/;\s]+", r.get("broker") or "") if x.strip()}:
            peran.setdefault(b, []).append(f"dipakai {r['name'][:40]}")
    rows, catatan = [], []
    for b, ps in peran.items():
        nama, jenis = BROKER.get(b, ("", "tidak diketahui"))
        grup, rx = BROKER_GRUP.get(b, ("", ""))
        satu = bool(rx and re.search(rx, struktur, re.I))
        rows.append({"b": b, "nama": nama, "jenis": jenis, "grup": grup, "satuGrup": satu, "peran": list(dict.fromkeys(ps))[:5]})
        if satu:
            catatan.append(f"Broker {nama_broker(b)} milik grup {grup}, satu grup dengan nama di struktur kepemilikan; tercatat "
                           f"{', '.join(dict.fromkeys(ps))[:120]}: transaksi kemungkinan dari pihak internal grup.")
    for f in bandar.get("fase") or []:
        if f["hari"] < 30:
            continue
        jenis_b = [BROKER.get(b, ("", "tidak diketahui"))[1] for b in f["akum"]]
        jenis_j = [BROKER.get(b, ("", "tidak diketahui"))[1] for b in f["dist"]]
        if f["akum"] and all(j in ("lokal", "tidak diketahui") for j in jenis_b) and f["bandar"] > 0:
            catatan.append(f"Pembeli utama {f['periode']} ({', '.join(map(nama_broker, f['akum']))}) seluruhnya broker lokal non-ritel: "
                           "ciri akumulasi oleh pihak tertentu/market maker, bukan arus ritel atau institusi asing.")
        if f["bandar"] < 0 and sum(1 for b in f["akum"] if BROKER.get(b, ("", ""))[1] == "ritel") >= 2:
            catatan.append(f"Sisi beli {f['periode']} didominasi broker ritel ({', '.join(b for b in f['akum'] if BROKER.get(b, ('', ''))[1] == 'ritel')}) "
                           f"saat penjual utama {', '.join(map(nama_broker, f['dist']))}: barang mengalir dari bandar ke ritel (distribusi).")
        if f["dist"] and all(j == "asing" for j in jenis_j):
            catatan.append(f"Penjual utama {f['periode']} seluruhnya broker asing: institusi/rekening luar negeri keluar.")
        break
    rows.sort(key=lambda r: (not r["satuGrup"], -len(r["peran"])))
    return {"rows": rows[:12], "catatan": list(dict.fromkeys(catatan))}


# ------------------------------------------------------- 6. deteksi nominee ----
SURGA_PAJAK = re.compile(r"VIRGIN|BVI|CAYMAN|SEYCHELLES|MAURITIUS|SAMOA|LABUAN|MARSHALL|BELIZE|ANGUILLA|PANAMA|BERMUDA|BAHAMAS|"
                         r"JERSEY|GUERNSEY|ISLE OF MAN|LIECHTENSTEIN|VANUATU|CURACAO|NEVIS|MALTA", re.I)
TITIP_RX = re.compile(r"\bS/A\b|\bA/C\b|\bQQ\b|\bNOMINEES?\b|\bFOR\s+(THE\s+)?(ACCOUNT|BENEFIT)|\bCLIENT\b|\bTRUST(EE)?\b", re.I)
SPV_RX = re.compile(r"\b(LTD|LIMITED|PTE|INC|CORP|HOLDINGS?|INVESTMENTS?|CAPITAL|VENTURES?|GLOBAL|INTERNATIONAL)\b", re.I)


def nominee(pemegang: list[dict], detail: dict, jaringan: list[dict], pengurus: list[str], ubo: list[str],
            insider: list[dict], kelompok: list[dict]) -> list[dict]:
    """Indikasi pemegang yang mewakili pihak lain (nominee/SPV): rekening titipan, SPV di negara surga pajak, badan asing
    tanpa jejak, perorangan >= 5% tanpa jejak di emiten lain dan bukan pengurus/keluarga, atau masuk bersamaan
    dengan pihak lain. Indikasi, bukan kesimpulan."""
    jar = {r["nama"]: r for r in jaringan}
    bersama = {n for k in kelompok if k["jenis"] == "bergerak bersamaan" for n in k["anggota"]}
    out = []
    for p in pemegang:
        if p["pct"] < 1:
            continue
        n, tanda = p["name"], []
        dt = detail.get(kunci_orang(n)) or {}
        dom, kls = (dt.get("dom") or "").upper(), (dt.get("kls") or "")
        if TITIP_RX.search(n):
            tanda.append("nama rekening titipan (S/A, A/C, QQ, nominee, trust)")
        if SURGA_PAJAK.search(dom) or SURGA_PAJAK.search(n):
            tanda.append(f"berdomisili di yurisdiksi surga pajak ({dom.title() or 'nama'})")
        elif dom and dom != "INDONESIA" and SPV_RX.search(n) and not (jar.get(n) or {}).get("emiten"):
            tanda.append(f"badan asing ({dom.title()}) tanpa kepemilikan lain di BEI: kemungkinan SPV")
        perorangan = kls.lower() == "individual" or not re.search(r"\b(PT|TBK|LTD|LIMITED|PTE|INC|CORP|FUND|BANK|CV|KOPERASI|YAYASAN)\b", n, re.I)
        if perorangan and p["pct"] >= 5 and not p.get("pengurus") and not p.get("keluarga") and not p.get("pengendali") \
                and not any(kunci_orang(u) == kunci_orang(n) for u in ubo) and not (jar.get(n) or {}).get("emiten") \
                and not (jar.get(n) or {}).get("keluar"):
            tanda.append("perorangan >= 5% tanpa jejak di emiten lain dan bukan pengurus/keluarga/UBO")
        if n in bersama:
            tanda.append("masuk/bergerak di tanggal yang sama dengan pihak lain")
        if any(r["name"] == n and (r.get("chg") or 0) >= 5 and not r.get("purpose") for r in insider):
            tanda.append("membeli >= 5 poin tanpa menyebut tujuan transaksi")
        if tanda:
            out.append({"nama": n, "pct": p["pct"], "tanda": tanda, "kuat": len(tanda) >= 2})
    return sorted(out, key=lambda r: (-len(r["tanda"]), -r["pct"]))[:10]


# --------------------------------------------------- 7. tren pemegang ritel ----
def tren_ritel(jumlah: list[tuple[str, float]], bars: list[dict]) -> dict:
    """Jumlah pemegang saham bulanan (KSEI, via Stockbit) dibanding harga. Jumlah pemegang naik saat harga turun = barang
    mengalir ke ritel (distribusi); jumlah turun saat harga naik/datar = barang terkumpul ke sedikit tangan (akumulasi)."""
    seri = sorted(((d, n) for d, n in jumlah if d and n), key=lambda x: x[0])
    if len(seri) < 2:
        return {"seri": [], "catatan": []}
    tutup = {b["d"][:7]: b["c"] for b in bars if b.get("c")}
    out, catatan = [], []
    for d, n in seri[-24:]:
        out.append({"d": d, "n": n, "harga": tutup.get(d[:7])})
    akhir = out[-1]
    for bulan in (3, 6, 12):
        if len(out) <= bulan:
            continue
        a = out[-1 - bulan]
        dn = (akhir["n"] / a["n"] - 1) * 100 if a["n"] else None
        dh = (akhir["harga"] / a["harga"] - 1) * 100 if a.get("harga") and akhir.get("harga") else None
        if dn is None:
            continue
        teks = f"{bulan} bulan: pemegang {a['n']:,.0f} -> {akhir['n']:,.0f} ({dn:+.1f}%)".replace(",", ".")
        if dh is not None:
            teks += f", harga {dh:+.1f}%"
            if dn >= 10 and dh <= -5:
                teks += ": ritel bertambah saat harga turun, barang mengalir ke ritel (distribusi)."
            elif dn <= -5 and dh >= -2:
                teks += ": ritel berkurang saat harga naik/datar, barang terkumpul ke sedikit tangan (akumulasi)."
            elif dn >= 10 and dh >= 10:
                teks += ": ritel ramai masuk mengikuti kenaikan (euforia; waspada distribusi)."
            else:
                teks += "."
        catatan.append(teks)
    return {"seri": out, "catatan": catatan}


# ------------------------------------------------- 8. rekam jejak UBO / grup ----
KATEGORI_BERITA = [
    ("hukum", r"tersangka|ditahan|\bkpk\b|kejagung|kejaksaan|penyidik|korupsi|pidana|digugat|gugatan|sengketa|dipolisikan|vonis"),
    ("suspensi/delisting", r"suspensi|suspend|delisting|dihapus|penghentian sementara|didepak"),
    ("pailit/PKPU", r"pailit|\bpkpu\b|gagal bayar|default"),
    ("sanksi OJK/BEI", r"sanksi|denda|\bojk\b|\buma\b|teguran"),
    ("akuisisi/backdoor", r"akuisisi|caplok|backdoor|ambil alih|mengambil alih|pengendali baru|tender offer|borong|lepas saham|jual saham"),
    ("saham gorengan", r"gocap|goreng|pump|bandar|melonjak|ara\b|arb\b|terjun bebas|anjlok"),
]


def nasib_emiten(prices: list[dict], keluar_tgl: str = "") -> dict | None:
    """Ringkasan 3 tahun harga satu emiten jaringan: awal, puncak, kini, dan pola (pompa-buang, gocap, berlipat)."""
    p = [x for x in prices if x.get("v")]
    if len(p) < 20:
        return {"pola": "tidak ada perdagangan 3 tahun (kemungkinan suspensi/delisting)", "kini": None}
    awal, kini = p[0]["v"], p[-1]["v"]
    pk = max(p, key=lambda x: x["v"])
    pola = ""
    if kini <= 50 and pk["v"] / kini >= 3:
        pola = "naik lalu jatuh ke harga gocap"
    elif pk["v"] / awal >= 3 and kini / pk["v"] <= 0.4:
        pola = "naik berlipat lalu turun dalam (pola pompa-buang)"
    elif kini / awal >= 2:
        pola = "naik berlipat dan bertahan"
    elif kini / awal <= 0.5:
        pola = "turun lebih dari separuh"
    else:
        pola = "relatif datar"
    out = {"awal": awal, "puncak": pk["v"], "tglPuncak": pk["d"], "kini": kini, "pola": pola}
    if keluar_tgl:
        dulu = [x for x in p if x["d"] <= keluar_tgl[:10]]
        if dulu:
            out["sejakKeluar"] = round((kini / dulu[-1]["v"] - 1) * 100, 1)
    return out


def rekam_jejak(jaringan: list[dict], nasib: dict, berita: list[dict]) -> dict:
    """Nasib emiten lain yang pernah/masih dipegang pihak yang sama + pemberitaan lama (hukum, suspensi, pailit, backdoor)
    tentang UBO/pemegang utama: menebak masa depan dari pola masa lalu."""
    emiten = []
    for r in jaringan:
        for e, jenis in [(e, "dipegang") for e in r.get("emiten") or []] + [(e, "dilepas") for e in r.get("keluar") or []]:
            nb = nasib.get(e["t"])
            if not nb:
                continue
            teks = f"{e['t']} ({jenis} {r['nama'][:40]}): {nb['pola']}"
            if nb.get("kini"):
                teks += f"; Rp{nb['awal']:,.0f} -> puncak Rp{nb['puncak']:,.0f} ({nb['tglPuncak'][:7]}) -> kini Rp{nb['kini']:,.0f}".replace(",", ".")
            if nb.get("sejakKeluar") is not None:
                teks += f"; {nb['sejakKeluar']:+.1f}% sejak dilepas"
            if not any(x["t"] == e["t"] for x in emiten):
                emiten.append({"t": e["t"], "jenis": jenis, "pemegang": r["nama"], "pola": nb["pola"], "teks": teks})
    beri = []
    for b in berita:
        kat = [k for k, rx in KATEGORI_BERITA if re.search(rx, b.get("judul") or "", re.I)]
        if kat:
            beri.append({**b, "kategori": kat})
    pola = [e["pola"] for e in emiten]
    catatan = []
    buruk = sum(1 for x in pola if "pompa" in x or "gocap" in x or "suspensi" in x)
    if buruk:
        catatan.append(f"{buruk} dari {len(pola)} emiten jaringan berpola pompa-buang, jatuh ke gocap, atau tidak diperdagangkan: "
                       "pihak yang sama pernah meninggalkan emiten dalam kondisi buruk.")
    baik = sum(1 for x in pola if "bertahan" in x)
    if baik:
        catatan.append(f"{baik} emiten jaringan naik berlipat dan bertahan: pihak yang sama pernah membangun nilai.")
    for k in ("hukum", "pailit/PKPU", "suspensi/delisting"):
        n = sum(1 for b in beri if k in b["kategori"])
        if n:
            catatan.append(f"{n} berita {k} terkait nama di struktur (cek isi beritanya; nama bisa sama dengan orang lain).")
    return {"emiten": emiten[:12], "berita": beri[:15], "catatan": catatan}
