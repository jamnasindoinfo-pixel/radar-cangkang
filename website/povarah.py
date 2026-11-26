"""Membaca arah pengendali (lanjutan analisa mendalam POV): bandarmologi, jejak volume, preseden grup, dan
skenario ke mana saham dibawa. Aturan otomatis murni (tanpa HTTP) agar bisa diuji; data dikumpulkan server.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from statistics import median

KONGLO_NAMA = re.compile(r"\b(salim|sinar ?mas|widjaja|djarum|hartono|barito|prajogo|pangestu|bakrie|mnc|tanoesoedibjo|lippo|riady|"
                         r"adaro|thohir|garibaldi|saratoga|soeryadjaya|merdeka|emtek|sariaatmadja|triputra|rachmat|harita|medco|"
                         r"panigoro|indika|sudwikatmono|isam|jhonlin|hapsoro|agung sedayu|ciputra|gudang garam|risjad|napan|tahir|"
                         r"mayapada|ct corp|tanjung|wings|katuari|kalla|bosowa|rajawali|sampoerna|astra|wilmar|kuok)\b", re.I)


def broker_parse(resp: dict) -> dict | None:
    """Ringkasan broker satu periode (marketdetectors): pembeli/penjual teratas dengan nilai, lot, harga rata-rata, jenis."""
    data = (resp or {}).get("data") or {}
    bs = data.get("broker_summary") or {}

    def angka(x, *k):
        for kk in k:
            try:
                return abs(float(x[kk]))
            except (KeyError, TypeError, ValueError):
                continue
        return 0.0
    beli = [{"b": x.get("netbs_broker_code"), "val": angka(x, "bval", "value"), "lot": angka(x, "blot", "lot"),
             "avg": angka(x, "netbs_buy_avg_price", "avg_price") or None, "jenis": str(x.get("type") or "")}
            for x in bs.get("brokers_buy") or [] if x.get("netbs_broker_code")]
    jual = [{"b": x.get("netbs_broker_code"), "val": angka(x, "sval", "value"), "lot": angka(x, "slot", "lot"),
             "avg": angka(x, "netbs_sell_avg_price", "avg_price") or None, "jenis": str(x.get("type") or "")}
            for x in bs.get("brokers_sell") or [] if x.get("netbs_broker_code")]
    if not beli and not jual:
        return None
    beli.sort(key=lambda z: -z["val"])
    jual.sort(key=lambda z: -z["val"])
    b3, j3 = beli[:3], jual[:3]
    wa = lambda zs: round(sum(z["val"] for z in zs) / sum(z["val"] / z["avg"] for z in zs)) if zs and all(z["avg"] for z in zs) else None
    tot_b, tot_j = sum(z["val"] for z in beli), sum(z["val"] for z in jual)
    asing = sum(z["val"] for z in beli if "asing" in z["jenis"].lower() or "foreign" in z["jenis"].lower()) \
        - sum(z["val"] for z in jual if "asing" in z["jenis"].lower() or "foreign" in z["jenis"].lower())
    return {"bandar": round(sum(z["val"] for z in b3) - sum(z["val"] for z in j3)), "akum": [z["b"] for z in b3], "dist": [z["b"] for z in j3],
            "avgAkum": wa(b3), "avgDist": wa(j3), "konsentrasi": round(sum(z["val"] for z in b3) / tot_b * 100, 1) if tot_b else None,
            "asing": round(asing), "nilaiBeli": round(tot_b), "nilaiJual": round(tot_j)}


def _ubah(bars: list[dict], hari: int) -> float | None:
    """Perubahan harga (%) n hari bursa terakhir."""
    if len(bars) <= hari:
        return None
    a, b = bars[-hari - 1]["c"], bars[-1]["c"]
    return round((b / a - 1) * 100, 1) if a else None


def bandarmologi(brokers: dict, bars: list[dict], harga: float | None) -> dict:
    """brokers = {5: ringkasan, 30: ..., 90: ...}. Fase bandar per periode, posisi modal bandar, broker yang konsisten."""
    fase, catatan = [], []
    for hari, label in ((5, "1 minggu"), (30, "1 bulan"), (90, "3 bulan")):
        r = brokers.get(hari) or brokers.get(str(hari))
        if not r:
            continue
        ub = _ubah(bars, {5: 5, 30: 21, 90: 63}[hari])
        if r["bandar"] > 0 and (ub is None or ub <= 2):
            arti = "akumulasi diam-diam: bandar mengumpulkan saat harga datar/turun"
        elif r["bandar"] > 0:
            arti = "akumulasi sambil mengangkat harga (markup)"
        elif r["bandar"] < 0 and (ub or 0) > 2:
            arti = "distribusi saat harga naik: barang dilepas ke pembeli ritel"
        elif r["bandar"] < 0:
            arti = "distribusi/keluar saat harga melemah"
        else:
            arti = "seimbang"
        posisi = None
        if harga and r.get("avgAkum"):
            posisi = round((harga / r["avgAkum"] - 1) * 100, 1)
        fase.append({"periode": label, "hari": hari, "bandar": r["bandar"], "harga": ub, "arti": arti, "akum": r["akum"], "dist": r["dist"],
                     "avgAkum": r.get("avgAkum"), "posisi": posisi, "konsentrasi": r.get("konsentrasi"), "asing": r.get("asing")})
    # Broker yang konsisten di sisi beli/jual lintas periode.
    cnt_b, cnt_j = {}, {}
    for f in fase:
        for b in f["akum"]:
            cnt_b[b] = cnt_b.get(b, 0) + 1
        for b in f["dist"]:
            cnt_j[b] = cnt_j.get(b, 0) + 1
    konsisten_b = [b for b, n in cnt_b.items() if n >= 2]
    konsisten_j = [b for b, n in cnt_j.items() if n >= 2]
    if konsisten_b:
        catatan.append(f"Broker {', '.join(konsisten_b)} konsisten di sisi beli pada {max(cnt_b[b] for b in konsisten_b)} periode: indikasi pihak yang sama terus mengumpulkan.")
    if konsisten_j:
        catatan.append(f"Broker {', '.join(konsisten_j)} konsisten di sisi jual: pihak yang sama terus melepas.")
    for f in fase:
        if f["posisi"] is not None and f["hari"] >= 30:
            catatan.append(f"Harga sekarang {'+' if f['posisi'] >= 0 else ''}{f['posisi']}% dari modal rata-rata pembeli utama {f['periode']} "
                           f"(Rp{rp(f['avgAkum'])})" + (": bandar masih rugi, cenderung menahan atau mengangkat harga." if f["posisi"] < -5
                           else ": bandar sudah untung, waspada distribusi." if f["posisi"] > 15 else "."))
            break
    if fase and fase[0].get("konsentrasi") and fase[0]["konsentrasi"] >= 60:
        catatan.append(f"Tiga pembeli teratas menguasai {fase[0]['konsentrasi']}% nilai beli {fase[0]['periode']}: transaksi terkonsentrasi (ciri saham yang dikendalikan).")
    return {"fase": fase, "catatan": catatan}


def jejak_volume(bars: list[dict], kejadian: list[dict]) -> list[dict]:
    """Hari bervolume >= 3x median 60 hari (1 tahun), dicocokkan dengan kejadian (keterbukaan/kepemilikan) <= 7 hari sesudahnya:
    volume naik SEBELUM pengumuman = kemungkinan ada pihak yang tahu lebih dulu."""
    out = []
    for i in range(60, len(bars)):
        ref = median([b["v"] for b in bars[i - 60:i] if b["v"]] or [0])
        if not ref or bars[i]["v"] < 3 * ref:
            continue
        d = bars[i]["d"]
        ch = round((bars[i]["c"] / bars[i - 1]["c"] - 1) * 100, 1) if bars[i - 1]["c"] else None
        dt = datetime.strptime(d, "%Y-%m-%d")
        sesudah = [k for k in kejadian if k.get("date") and d < k["date"] <= (dt + timedelta(days=7)).strftime("%Y-%m-%d")]
        out.append({"d": d, "kali": round(bars[i]["v"] / ref, 1), "ubah": ch, "sebelum": sesudah[0]["teks"][:140] if sesudah else ""})
    out.sort(key=lambda x: -x["kali"])
    return sorted(out[:10], key=lambda x: x["d"], reverse=True)


def preseden(grup_aksi: list[dict]) -> list[str]:
    """Pola aksi korporasi di emiten lain milik pemegang yang sama (2 tahun)."""
    JN = {"akuisisi": "perubahan pengendali/akuisisi", "rights": "penambahan modal/HMETD/inbreng", "kbli": "ganti kegiatan usaha/nama",
          "direksi": "ganti pengurus"}
    per: dict = {}
    for a in grup_aksi:
        for j in a.get("jenis") or []:
            if j in JN:
                per.setdefault(a["t"], {}).setdefault(j, a["date"])
    return [f"{t}: " + "; ".join(f"{JN[j]} ({d[:7]})" for j, d in sorted(js.items(), key=lambda kv: kv[1], reverse=True)) for t, js in per.items()]


def arah(c: dict) -> dict:
    """Skenario ke mana saham dibawa pengendali (skor 0-100 dari bukti) dan narasi bertahap.
    c: ringkasan dari povdalam.analyze + bandarmologi + preseden."""
    sk = []
    ff, fe, af = c.get("ff"), c.get("ffEfektif"), c.get("afiliasi") or 0
    bm = c.get("bandar") or {}
    f30 = next((f for f in bm.get("fase") or [] if f["hari"] == 30), None)
    f90 = next((f for f in bm.get("fase") or [] if f["hari"] == 90), None)
    akum = any(f["bandar"] > 0 for f in (f30, f90) if f)
    dist = any(f["bandar"] < 0 for f in (f30, f90) if f)
    pres = c.get("preseden") or []
    pres_txt = " ".join(pres).lower()
    rules = [
        ("Injeksi aset / backdoor ke perusahaan ini", [
            (30, bool(c.get("ambil")), "Ada pihak yang baru masuk/menguatkan kendali (melewati 20%/50%)."),
            (25, bool(c.get("rights")), "Ada rencana penambahan modal/HMETD/inbreng dalam 180 hari."),
            (15, bool(c.get("kbli")), "Ada perubahan kegiatan usaha/nama."),
            (15, "inbreng" in pres_txt or "penambahan modal" in pres_txt, "Pemegang yang sama pernah menambah modal/injeksi di emiten lain."),
            (15, "perubahan pengendali" in pres_txt, "Pemegang yang sama baru terlibat perubahan pengendali/akuisisi di emiten lain (pola backdoor berulang)."),
            (25, "kandidat cangkang berikutnya" in pres_txt, "Pemegang yang sama pernah melepas emiten lain saat emiten itu di-backdoor."),
            (10, (c.get("mcap") or 9e18) < 1e12, "Kapitalisasi di bawah Rp1 T: cangkang murah untuk dimasuki aset."),
            (10, akum, "Bandar mengumpulkan barang (1-3 bulan)."),
            (20, bool(c.get("konversi")), "Pemegang besar mengonversi saham warkat ke scripless: saham siap dialihkan ke calon pengendali baru."),
        ], ["Keterbukaan rencana transaksi material/inbreng", "Jadwal RUPSLB dan HMETD", "Penunjukan penilai independen atas aset target",
            "PPJB/pengalihan saham pengendali ke pihak baru"]),
        ("Go private / tender offer sukarela", [
            (40, af >= 90, f"Pihak terafiliasi sudah {af:.1f}% saham."),
            (20, bool(c.get("insiderBeli")), "Pemegang utama terus menambah saham."),
            (15, akum, "Bandar mengumpulkan barang."),
        ], ["Pengumuman penawaran tender sukarela / rencana delisting", "Pembelian kembali saham (buyback) besar"]),
        ("Distribusi untuk memenuhi free float / menjual ke publik", [
            (40, ff is not None and ff < 7.5, f"Free float {ff}% di bawah 7,5%." if ff is not None else ""),
            (25, fe is not None and fe < 15, f"Free float efektif {fe}%."),
            (20, bool(c.get("insiderJual")), "Pemegang utama melepas saham bertahap."),
            (15, dist, "Bandar mendistribusikan barang."),
        ], ["Private placement / penjualan saham pendiri", "Masuknya pemegang baru < 5%", "Kenaikan free float di data KSEI"]),
        ("Pengendali/pemegang lama keluar (exit)", [
            (35, bool(c.get("insiderJual")), "Penjualan bertahap oleh pemegang utama."),
            (20, bool(c.get("habisBulan")), "Dengan laju jual sekarang kepemilikan akan habis dalam beberapa bulan."),
            (20, dist, "Bandar distribusi."),
            (15, bool(c.get("lepas")), "Ada pihak yang turun melewati 20%/50%."),
            (25, bool(c.get("konversi")), "Pemegang besar mengonversi saham warkat ke scripless: persiapan menjual di pasar atau ke pengendali baru."),
        ], ["Keterbukaan PPJB penjualan saham pengendali", "Calon pembeli (investor strategis) diumumkan"]),
        ("Konsolidasi / sinergi dalam grup", [
            (30, bool(c.get("bersama")), "Emiten lain dimiliki bersama oleh pemegang yang sama."),
            (20, (c.get("grupN") or 0) >= 2, "Pemegang utama punya beberapa emiten lain."),
            (20, bool(c.get("konglo")), "Ada nama grup/konglomerat besar di struktur kepemilikan."),
            (15, "akuisisi" in pres_txt or "pengendali" in pres_txt, "Grup pernah melakukan akuisisi/pengalihan pengendali di emiten lain."),
        ], ["Transaksi afiliasi antar emiten grup", "Merger/penggabungan usaha", "Pengurus yang sama di emiten grup"]),
    ]
    for nama, poin, konf in rules:
        bukti = [t for v, ok, t in poin if ok and t]
        skor = min(100, sum(v for v, ok, _ in poin if ok))
        if skor:
            sk.append({"nama": nama, "skor": skor, "bukti": bukti, "konfirmasi": konf})
    sk.sort(key=lambda x: -x["skor"])
    narasi = []
    if c.get("pengendaliTeks"):
        narasi.append(c["pengendaliTeks"])
    if c.get("jaringanTeks"):
        narasi.append(c["jaringanTeks"])
    if pres:
        narasi.append("Preseden grup (2 tahun): " + " | ".join(pres[:4]) + ". Pola yang pernah dijalankan pemegang yang sama cenderung diulang.")
    if c.get("aktivitasTeks"):
        narasi.append(c["aktivitasTeks"])
    if bm.get("fase"):
        narasi.append("Bandarmologi: " + "; ".join(f"{f['periode']} {f['arti']} (net Rp{f['bandar'] / 1e9:.2f} M, harga {f['harga'] if f['harga'] is not None else '-'}%)"
                                                  for f in bm["fase"]) + ". " + " ".join(bm.get("catatan") or []))
    if c.get("volumeTeks"):
        narasi.append(c["volumeTeks"])
    if sk:
        a = sk[0]
        narasi.append(f"Membaca arahnya: pola data paling sejalan dengan skenario \"{a['nama']}\" (skor {a['skor']}), karena "
                      + "; ".join(x.rstrip(".") for x in a["bukti"]) + "."
                      + (f" Skenario berikutnya: \"{sk[1]['nama']}\" (skor {sk[1]['skor']})." if len(sk) > 1 else "")
                      + f" Yang akan mengonfirmasi: {', '.join(a['konfirmasi'][:3]).lower()}.")
    if c.get("publikTeks"):
        narasi.append(c["publikTeks"])
    return {"skenario": sk[:5], "narasi": narasi}


def rp(v: float) -> str:
    """Angka rupiah gaya Indonesia (titik ribuan) tanpa mengubah tanda baca kalimat."""
    return f"{v:,.0f}".replace(",", ".")


def sudut_lain(c: dict) -> list[str]:
    """Hal yang jarang dihitung ritel: posisi untung/rugi orang dalam, biaya go private, harga perusahaan vs nilai bukunya,
    saham dijaminkan, pemain baru, pergantian pengurus, lonjakan volume sebelum pengumuman."""
    out, harga = [], c.get("harga")
    for a in (c.get("insider") or [])[:4]:
        if harga and a.get("harga"):
            p = round((harga / a["harga"] - 1) * 100, 1)
            sisi = "membeli" if a["chg"] > 0 else "menjual"
            out.append(f"{a['nama']} {sisi} di harga rata-rata ±Rp{rp(a['harga'])}; harga sekarang {'+' if p >= 0 else ''}{p}% dari itu"
                       + (" (pembeli besar masih rugi di kertas: biasanya tidak membiarkan harga jatuh lebih jauh)." if sisi == "membeli" and p < -5
                          else " (penjual melepas di bawah harga sekarang: ada yang mau keluar walau lebih murah)." if sisi == "menjual" and p > 5 else "."))
    mcap, ek, fe = c.get("mcap"), c.get("ekuitas"), c.get("ffEfektif")
    if mcap and ek and ek > 0:
        out.append(f"Pasar menilai seluruh perusahaan Rp{rp(mcap / 1e9)} M, ekuitasnya Rp{rp(ek / 1e9)} M ({mcap / ek:.2f}x)"
                   + (": membeli seluruh perusahaan lebih murah dari nilai bukunya." if mcap < ek else "."))
    if mcap and fe is not None:
        out.append(f"Untuk menguasai seluruh saham publik (free float efektif {fe:.2f}%) cukup ±Rp{rp(mcap * fe / 100 / 1e9)} M pada harga sekarang"
                   ": ukuran 'biaya go private' atau biaya mengendalikan pasar sahamnya.")
    jamin = [r for r in c.get("insiderRaw") or [] if re.search(r"jaminan|gadai|repo|pledge|agunan", r.get("purpose") or "", re.I)]
    if jamin:
        r = jamin[0]
        out.append(f"Ada saham yang dijaminkan/repo ({r['name']}, {r['date']}): risiko jual paksa bila harga jatuh (margin call).")
    baru = c.get("pemainBaru") or []
    if baru:
        out.append("Pemain baru dalam 3 tahun: " + "; ".join(baru[:4]) + ". Pihak baru biasanya masuk dengan rencana.")
    if c.get("pengurusBaru"):
        out.append(f"Perubahan pengurus {c['pengurusBaru']}: pergantian direksi/komisaris sering mendahului aksi korporasi besar.")
    vol = [v for v in c.get("volume") or [] if v["sebelum"]]
    if vol:
        v = vol[0]
        out.append(f"Lonjakan volume {v['kali']}x pada {v['d']} ({'+' if (v['ubah'] or 0) >= 0 else ''}{v['ubah']}%) terjadi sebelum: {v['sebelum']}. "
                   "Volume yang naik sebelum pengumuman bisa menandakan ada pihak yang tahu lebih dulu.")
    return out


def target_harga(c: dict) -> list[dict]:
    """Skenario target harga (bukan rekomendasi): nilai buku (titik distribusi pengendali), harga orang dalam, harga aksi
    korporasi di keterbukaan, modal bandar + margin distribusi, tertinggi 52 minggu. Potensi = selisih dari harga sekarang."""
    h, out = c.get("harga"), []
    if not h:
        return out

    def tambah(label, harga, dasar):
        if harga and harga > 0 and not any(abs(x["harga"] - harga) / harga < 0.02 for x in out):
            out.append({"label": label, "harga": round(harga), "potensi": round((harga / h - 1) * 100, 1), "dasar": dasar})
    if c.get("bvps"):
        tambah("Nilai buku (PBV 1x)", c["bvps"], "Titik wajar distribusi pengendali/pemenuhan free float: pengendali jarang melepas jauh di bawah nilai buku.")
    ins = [a for a in c.get("insider") or [] if a.get("harga")]
    if ins:
        a = max(ins, key=lambda a: a["harga"])
        tambah("Harga transaksi orang dalam", a["harga"], f"Harga rata-rata tertinggi transaksi {a['nama']} (180 hari).")
    for x in c.get("aksi") or []:
        m = re.search(r"(?:harga (?:pelaksanaan|penawaran|tender)|seharga|@)\s*rp\s?([\d.]+)", f"{x.get('judul', '')} {x.get('inti', '')}", re.I)
        if m:
            tambah("Harga di keterbukaan aksi korporasi", float(m.group(1).replace(".", "")), f"{x.get('date')}: {x.get('judul', '')[:90]}")
            break
    f90 = next((f for f in (c.get("bandar") or {}).get("fase") or [] if f["hari"] == 90 and f.get("avgAkum")), None)
    if f90 and f90["bandar"] > 0:
        tambah("Modal bandar + margin distribusi 30%", f90["avgAkum"] * 1.3, f"Modal rata-rata pembeli utama 3 bulan Rp{rp(f90['avgAkum'])} ditambah ruang untung untuk dibagikan.")
    return sorted(out, key=lambda x: x["harga"])


GENERIK = {"INDONESIA", "INTERNATIONAL", "INTERNASIONAL", "INVESTAMA", "INVESTINDO", "GROUP", "GRUP", "HOLDING", "HOLDINGS", "CAPITAL",
           "PERSADA", "SEJAHTERA", "MANDIRI", "ABADI", "GLOBAL", "PRIMA", "UTAMA", "JAYA", "MAKMUR", "SENTOSA", "NUSANTARA", "ASIA",
           "CORPORATION", "LIMITED", "INVESTMENT", "INVESTMENTS", "MULIA", "PERKASA", "BERSAMA", "SUKSES", "LESTARI", "TBK", "PTE", "LTD"}


KUSTODIAN_RX = re.compile(r"\b(UOB|DBS|HSBC|CITIBANK|CITI|STANDARD CHARTERED|JPMORGAN|J\.?P\.? MORGAN|BNY|MELLON|STATE STREET|"
                          r"DEUTSCHE|NOMINEES?|CUSTOD|KUSTODIAN|SECURITIES|SEKURITAS|KAY HIAN|MAYBANK|CGS|PHILLIP|MORGAN STANLEY|"
                          r"GOLDMAN|CREDIT SUISSE|UBS|NOMURA|ASABRI|TASPEN|BPJS|DANA PENSIUN|DAPEN|ASURANSI|INSURANCE|BANK|"
                          r"REKSA ?DANA|FUND|CLIENT|NON[- ]?WARKAT|SCRIPLESS|TREASURY|TREASURI|MASYARAKAT|PUBLIK)\b", re.I)


def bukan_kustodian(nama: str) -> bool:
    return not KUSTODIAN_RX.search(nama or "")


def afiliasi(pemegang: list[dict], insider: list[dict], keluarga: list[dict], bersama: list[dict]) -> dict:
    """Peta afiliasi: kelompok nama mirip, pihak yang bergerak di tanggal sama (acting in concert), pengurus-pemegang,
    keluarga, kepemilikan bersama di emiten lain. Tiap kelompok dengan total persen."""
    kel = []
    pemegang = [p for p in pemegang if bukan_kustodian(p["name"])]
    insider = [r for r in insider if bukan_kustodian(r["name"])]
    # Nama mirip: kata khas yang sama (mis. RELIFE PROPERTY & RELIFE REALTY INDONESIA).
    kata: dict = {}
    for p in pemegang:
        for w in set(re.findall(r"[A-Z]{5,}", p["name"].upper())) - GENERIK:
            kata.setdefault(w, []).append(p)
    for w, ps in kata.items():
        if len(ps) >= 2 and not all(p.get("keluarga") for p in ps):
            kel.append({"jenis": "nama mirip", "dasar": f"kata '{w}' di nama", "anggota": [p["name"] for p in ps],
                        "pct": round(sum(p["pct"] for p in ps), 2)})
    # Bergerak di tanggal yang sama (masuk/naik/keluar bersamaan).
    tgl: dict = {}
    import povdalam as _PD
    for r in insider:
        if abs((r.get("cur") or 0) - (r.get("prev") or 0)) >= 1 and _PD.masuk_terverifikasi(r, insider):
            tgl.setdefault(r["date"], {})[r["name"]] = r
    for d, rs in sorted(tgl.items(), reverse=True):
        if len(rs) >= 2:
            arah_ = {("masuk" if (x.get("prev") or 0) == 0 else "naik" if x["cur"] > x["prev"] else "keluar" if x["cur"] == 0 else "turun") for x in rs.values()}
            kel.append({"jenis": "bergerak bersamaan", "dasar": f"{d}: {', '.join(sorted(arah_))} di tanggal yang sama",
                        "anggota": list(rs), "pct": round(sum(x.get("cur") or 0 for x in rs.values()), 2)})
    for p in pemegang:
        if p.get("pengurus"):
            kel.append({"jenis": "pemegang = pengurus", "dasar": f"juga {p['pengurus']}", "anggota": [p["name"]], "pct": p["pct"]})
    for k in keluarga:
        kel.append({"jenis": "keluarga", "dasar": f"nama belakang {k['nama']}", "anggota": k["anggota"], "pct": k["pct"]})
    for b in bersama:
        kel.append({"jenis": "kepemilikan bersama", "dasar": f"bersama-sama memegang {b['t']}", "anggota": b["pemegang"],
                    "pct": round(sum(p["pct"] for p in pemegang if p["name"] in b["pemegang"]), 2)})
    semua = {n for k in kel for n in k["anggota"]}
    return {"kelompok": kel[:12], "totalTerhubung": round(sum(p["pct"] for p in pemegang if p["name"] in semua), 2)}


def market_maker(insider: list[dict], bandar: dict) -> list[str]:
    """Broker yang dipakai pemegang utama/orang dalam saat bertransaksi (keterbukaan), dicocokkan dengan broker bandar teratas."""
    pakai: dict = {}
    for r in insider:
        # Satu keterbukaan bisa memuat beberapa kode broker ("IU, AN"): dihitung per broker.
        for b in {x.strip() for x in re.split(r"[,/;\s]+", r.get("broker") or "") if x.strip()}:
            pakai.setdefault(b, []).append(r)
    top = {}
    for f in bandar.get("fase") or []:
        for b in f["akum"]:
            top.setdefault(b, []).append(f"beli {f['periode']}")
        for b in f["dist"]:
            top.setdefault(b, []).append(f"jual {f['periode']}")
    out = []
    for b, rs in sorted(pakai.items(), key=lambda kv: -len(kv[1])):
        nama = sorted({r["name"] for r in rs})
        if b in top:
            out.append(f"Broker {b} dipakai {', '.join(nama[:3])} ({len(rs)} transaksi) dan juga tercatat {', '.join(top[b])}: "
                       "kemungkinan broker yang dipakai pihak pengendali untuk menggerakkan harga.")
        else:
            out.append(f"Broker {b} dipakai {', '.join(nama[:3])} ({len(rs)} transaksi keterbukaan); belum tampak di broker bandar teratas.")
    return out[:6]


def jejak_cangkang(jaringan: list[dict], grup_aksi: list[dict], t: str) -> list[dict]:
    """Pemegang saham ini yang melepas/keluar dari emiten lain di sekitar (<= 6 bulan) perubahan pengendali emiten itu:
    pola membangun cangkang lalu menjualnya ke pembeli backdoor. Saham ini berpola sama -> calon cangkang berikutnya."""
    ubah = {}
    for a in grup_aksi:
        if "akuisisi" in (a.get("jenis") or []):
            ubah.setdefault(a["t"], []).append(a)
    out = []
    for r in [r for r in jaringan if bukan_kustodian(r["nama"])]:
        for e in (r.get("keluar") or []) + [x for x in r.get("emiten") or [] if str(x.get("aksi") or "").upper() in ("SELL", "JUAL")]:
            ev = ubah.get(e["t"]) or []
            tgl = str(e.get("tgl") or "")[:10]
            dekat = [a for a in ev if not tgl or abs((datetime.strptime(a["date"][:10], "%Y-%m-%d")
                                                     - datetime.strptime(tgl, "%Y-%m-%d")).days) <= 183]
            if dekat and not any(o["pemegang"] == r["nama"] and o["t"] == e["t"] for o in out):
                a = sorted(dekat, key=lambda a: a["date"])[-1]
                out.append({"pemegang": r["nama"], "t": e["t"], "tgl": tgl, "sisa": e.get("pct"), "peristiwa": a["judul"], "tglPeristiwa": a["date"],
                            "teks": f"{r['nama']} melepas {e['t']}{' (' + tgl + ')' if tgl else ''}, sisa {e.get('pct') or 0:.2f}%, "
                                    f"bersamaan dengan perubahan pengendali di {e['t']} ({a['date'][:10]}: {a['judul'][:90]}). "
                                    f"Pola membangun lalu menjual cangkang; {t} dipegang pihak yang sama: kandidat cangkang berikutnya."})
    return out[:6]


def potensi_backdoor(c: dict) -> dict:
    """Skor potensi backdoor / ganti pengendali (0-100) dari tanda-tanda yang biasa mendahului."""
    baru = [r for r in c.get("ambil") or [] if r.get("date", "") >= c.get("batas12", "")]
    tanda = [
        # Inti (kejadian nyata, 12 bulan terakhir bila bertanggal).
        (30, bool(c.get("jejakCangkang")), "Rekam jejak: pemegang yang sama pernah melepas emiten lain saat emiten itu berganti pengendali (penjual cangkang)."),
        (25, bool(baru), "Ada pihak yang melewati 20%/50% dalam 12 bulan (pengendali baru/menguat)."),
        (20, bool(c.get("masukBersama")), "Beberapa pihak masuk/naik di tanggal yang sama dalam 12 bulan (acting in concert)."),
        (15, bool(c.get("rupsBerubah")), "Agenda RUPS/keterbukaan: perubahan anggaran dasar, kegiatan usaha, pengurus, atau pengendali."),
        (15, bool(c.get("rights")), "Rencana penambahan modal/HMETD/inbreng (180 hari)."),
        (10, "perubahan pengendali" in " ".join(c.get("preseden") or []).lower(), "Pemegang yang sama terlibat perubahan pengendali di emiten lain."),
        # Pendukung (umum; bobot kecil).
        (5, bool(c.get("pemainBaru")), "Pemegang >= 5% baru muncul dalam 3 tahun."),
        (5, bool(c.get("pengurusBaru")), "Pengurus berganti."),
        (5, (c.get("mcap") or 9e18) < 5e11, "Kapitalisasi di bawah Rp500 M (cangkang murah)."),
        (5, bool(c.get("akum")), "Bandar mengumpulkan barang (1-3 bulan)."),
        (20, bool(c.get("konversi")), "Pemegang besar mengonversi saham warkat ke scripless dalam 12 bulan (saham siap dijual/dialihkan): "
                                      + "; ".join(c.get("konversi") or [])),
    ]
    bukti = [t for v, ok, t in tanda if ok]
    total = sum(v for v, ok, _ in tanda if ok)
    return {"skor": min(100, round(total * 100 / 110)), "bukti": bukti}



ASET_RX = re.compile(r"transaksi material|inbreng|penyertaan (modal|saham)|akuisisi|pengambilalihan|pembelian (saham|aset)|"
                     r"pengalihan aset|aset baru|anak usaha baru|pendirian anak|konsesi|tambang baru|merger|penggabungan usaha|"
                     r"injeksi|private placement|hmetd|penambahan modal|rights issue", re.I)
# Keterbukaan rutin bukan aksi korporasi (laporan keuangan, volatilitas, laporan bulanan, jadwal RUPS, iklan).
RUTIN_RX = re.compile(r"laporan keuangan|volatilitas|laporan bulanan|registrasi pemegang|bukti iklan|jadwal|pemanggilan|"
                      r"pemberitahuan rencana rapat|public expose|penggunaan dana", re.I)
NILAI_RX = re.compile(r"(?:rp|idr|us\$|usd)\s?[\d.,]+\s?(?:miliar|milyar|triliun|juta|m|t|b|million|billion)\b", re.I)


def _k(s: str) -> str:
    return " ".join(sorted(re.sub(r"[^A-Z0-9]+", " ", re.sub(r"\b(PT|TBK|LTD|PTE)\b", " ", (s or "").upper())).split()))


def pertanyaan_kunci(c: dict) -> list[dict]:
    """Jawaban berbasis data untuk lima pertanyaan inti: pembelian selesai?, distribusi tersembunyi?, tujuan pembeli?,
    kaitan aksi korporasi?, aset/bisnis yang berpotensi masuk (pemilik & nilai)."""
    t, out = c.get("t", ""), []
    ins, raw = c.get("ins") or [], c.get("insiderRaw") or []
    fase = {f["hari"]: f for f in (c.get("bandar") or {}).get("fase") or []}
    beli = sorted([a for a in ins if a["chg"] > 0], key=lambda a: -a["chg"])
    kini = c.get("kini") or datetime.now()
    brk_of = lambda nama: {x.strip() for r in raw if r["name"] == nama for x in re.split(r"[,/;\s]+", r.get("broker") or "") if x.strip()}
    # 1. Pembelian sudah selesai?
    if beli:
        a = beli[0]
        hari = (kini - datetime.strptime(a["akhir"], "%Y-%m-%d")).days
        brk = brk_of(a["nama"])
        masih = brk & set((fase.get(5) or {}).get("akum") or [])
        jaw = (f"Belum tampak selesai: broker {', '.join(sorted(masih))} yang dipakai {a['nama']} masih menjadi pembeli utama 1 minggu terakhir."
               if masih else f"Tampak melambat/berhenti: pembelian terakhir {a['nama']} {hari} hari lalu ({a['akhir']})"
               + (", dan broker yang dipakainya tidak lagi muncul sebagai pembeli utama." if brk else "."))
        kini_pct = a.get("sisaPct") or 0
        ambang = next((b for b in (20, 25, 50) if kini_pct < b), None)
        if ambang and ambang - kini_pct <= 5:
            jaw += (f" Kepemilikan {kini_pct:.2f}% tinggal {ambang - kini_pct:.2f} poin dari ambang {ambang}%"
                    + (" (wajib penawaran tender bila melewati 50%)." if ambang == 50 else " (ambang pengendali)."))
        f5 = fase.get(5)
        if f5:
            jaw += f" Bandar 1 minggu: {f5['arti']}."
        out.append({"q": "Apakah pembelian sudah selesai?", "a": jaw,
                    "bukti": [f"{a['nama']} +{a['chg']:.2f} poin dalam {a['n']} transaksi (180 hari), kini {kini_pct:.2f}%"
                              + (f", rata-rata ±Rp{a['harga']}" if a.get("harga") else "") + (f", laju {a['laju'] / 1e6:.1f} juta lembar/bulan" if a.get("laju") else ""),
                              f"Broker yang dipakai: {', '.join(sorted(brk)) or 'tidak tercatat'}; pembeli utama 1 minggu: {', '.join((fase.get(5) or {}).get('akum') or []) or '-'}"]})
    else:
        out.append({"q": "Apakah pembelian sudah selesai?", "a": "Tidak ada pembelian orang dalam/pemegang utama yang tercatat dalam 180 hari.", "bukti": []})
    # 2. Distribusi yang belum terlihat?
    jual_kt = [a for a in ins if a["chg"] < 0]
    dist = [f for f in (fase.get(30), fase.get(90)) if f and f["bandar"] < 0]
    if dist and not jual_kt:
        jaw = ("Ya, kemungkinan: bandar mendistribusikan barang di pasar (" + "; ".join(f"{f['periode']} Rp{f['bandar'] / 1e9:.2f} M via {', '.join(f['dist'])}" for f in dist)
               + ") padahal tidak ada penjualan pemegang besar di keterbukaan; penjual bisa pemegang < 5%, nominee, atau pihak terafiliasi yang tidak wajib lapor.")
    elif dist:
        jaw = "Distribusi terlihat dan sejalan dengan penjualan yang dilaporkan: " + "; ".join(f"{a['nama']} {a['chg']:.2f} poin" for a in jual_kt[:3]) + "."
    elif fase:
        jaw = "Tidak tampak: net bandar 1-3 bulan " + ("akumulasi." if any(f["bandar"] > 0 for f in fase.values()) else "seimbang.")
    else:
        jaw = "Data broker belum tersedia."
    if dist:
        lapor = sum(a.get("nilai") or 0 for a in jual_kt)
        bandar_dist = max(-f["bandar"] for f in dist)
        if bandar_dist > lapor:
            jaw += f" Perkiraan distribusi yang tidak tercatat di keterbukaan: ±Rp{(bandar_dist - lapor) / 1e9:.2f} M (distribusi bandar Rp{bandar_dist / 1e9:.2f} M vs penjualan dilaporkan Rp{lapor / 1e9:.2f} M)."
    if c.get("konversi"):
        jaw += (" Pasokan potensial: pemegang besar baru mengonversi saham warkat ke scripless (" + "; ".join(c["konversi"])
                + "), sehingga saham itu kini bisa dijual di pasar atau dialihkan ke pengendali baru.")
    out.append({"q": "Apakah masih ada distribusi yang belum terlihat?", "a": jaw,
                "bukti": [f"{f['periode']}: {f['arti']} (net Rp{f['bandar'] / 1e9:.2f} M; jual {', '.join(f['dist'])})" for f in fase.values()]})
    # 3. Tujuan pembeli jangka panjang?
    if beli:
        a = beli[0]
        tuj = [r.get("purpose") for r in raw if r["name"] == a["nama"] and r.get("purpose")]
        jar = next((r for r in c.get("jaringan") or [] if _k(r["nama"]) == _k(a["nama"])), None)
        keluar = (jar or {}).get("keluar") or []
        bukti = [f"Tujuan yang dilaporkan: {tuj[-1][:140]}"] if tuj else ["Tujuan transaksi tidak dicantumkan di keterbukaan."]
        if jar and jar.get("emiten"):
            bukti.append("Masih memegang: " + ", ".join(f"{e['t']} sejak {str(e.get('sejak') or '-')[:7]}" for e in jar["emiten"][:5]))
        if keluar:
            def bulan(e):
                try:
                    return round((datetime.strptime(str(e["tgl"])[:10], "%Y-%m-%d") - datetime.strptime(str(e["sejak"])[:10], "%Y-%m-%d")).days / 30.4)
                except (KeyError, TypeError, ValueError):
                    return None
            bukti.append("Pernah melepas: " + ", ".join(f"{e['t']} ({e.get('tgl') or '-'}" + (f", dipegang ±{bulan(e)} bulan" if bulan(e) is not None else "") + ")" for e in keluar[:5]))
        if any(_k(a["nama"]) == _k(j.get("pemegang", "")) for j in c.get("jejakData") or []):
            jaw = "Cenderung bukan jangka panjang: pihak ini pernah melepas emiten saat emiten itu berganti pengendali (pola membangun lalu menjual cangkang)."
        elif tuj and re.search(r"pengendali|jangka panjang|strategis", " ".join(tuj), re.I):
            jaw = "Dilaporkan sebagai investasi strategis/pengendalian: indikasi jangka panjang."
        elif keluar:
            jaw = "Belum pasti: pihak ini punya riwayat keluar dari emiten lain; perhatikan lama kepemilikannya."
        else:
            jaw = "Indikasi jangka panjang: tidak ada riwayat melepas emiten lain di data keterbukaan."
        out.append({"q": "Apakah pembeli memiliki tujuan investasi jangka panjang?", "a": jaw, "bukti": bukti})
    # 4. Berkaitan dengan aksi korporasi?
    if beli:
        a = beli[0]
        tgl_beli = sorted({r["date"] for r in raw if r["name"] == a["nama"] and (r.get("cur") or 0) > (r.get("prev") or 0)})
        dekat = []
        for x in [x for x in c.get("aksiSemua") or [] if not RUTIN_RX.search(x.get("judul") or "")]:
            for tb in tgl_beli:
                if x.get("date") and abs((datetime.strptime(x["date"][:10], "%Y-%m-%d") - datetime.strptime(tb, "%Y-%m-%d")).days) <= 60:
                    dekat.append(f"{x['date']}: {x['judul'][:100]} (pembelian {tb})")
                    break
        rups = c.get("rups") or []
        jaw = ("Ya, berdekatan (<= 60 hari) dengan keterbukaan aksi korporasi." if dekat else
               "Ada agenda RUPS/perubahan yang perlu dicocokkan waktunya." if rups else "Belum tampak kaitan dengan aksi korporasi yang sudah diumumkan.")
        out.append({"q": "Apakah pembelian tersebut berkaitan dengan aksi korporasi?", "a": jaw, "bukti": (dekat + rups)[:5]})
    # 5. Aset/bisnis yang berpotensi masuk, pemilik, nilai ekonomi.
    dok = [f"{u.get('date')}: {u.get('title')} {u.get('inti') or ''}".strip() for u in c.get("laporan") or []
           if not RUTIN_RX.search(u.get("title") or "") and ASET_RX.search(f"{u.get('title')} {u.get('inti') or ''}")]
    dok += [f"{b.get('date')}: {b.get('judul')} ({b.get('sumber')})" for b in c.get("beritaLuar") or [] if ASET_RX.search(b.get("judul") or "")]
    nilai = list(dict.fromkeys(m.group(0) for x in dok for m in NILAI_RX.finditer(x)))
    pemilik = [f"{p['name']} ({p['pct']:.2f}%)" for p in (c.get("pemegang") or [])[:3]] + [f"UBO {u}" for u in c.get("ubo") or []]
    usaha = [f"{r['nama']}: {', '.join(e['t'] for e in r['emiten'][:4])}" for r in c.get("jaringan") or [] if r.get("emiten")]
    usaha += [f"{g['t']} ({g.get('sektor') or 'sektor ?'})" for g in (c.get("grup") or [])[:4]]
    jaw = ("Dokumen/berita menyebut rencana aset atau transaksi" + (f" senilai {', '.join(nilai[:3])}" if nilai else " (nilai belum disebut)") + "."
           if dok else "Belum ada dokumen yang menyebut aset/bisnis yang akan masuk. Kandidat paling mungkin: usaha milik pemegang utama atau grupnya"
           + (f" ({'; '.join(usaha[:3])})" if usaha else "") + ".")
    out.append({"q": f"Apa aset atau bisnis yang berpotensi masuk ke {t}, siapa pemiliknya, dan berapa nilai ekonominya?", "a": jaw,
                "bukti": dok[:5] + [f"Pemilik yang menentukan: {', '.join(pemilik)}"]
                + ([f"Preseden grup: {' | '.join((c.get('preseden') or [])[:3])}"] if c.get("preseden") else [])})
    return out
