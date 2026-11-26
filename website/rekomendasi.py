"""Rekomendasi harian: menggabungkan hasil screening yang sudah ada di website (Harmonic Pattern, Recovery, Seasonality,
Pola Broker, laporan keuangan, Saham 50, KakdrWay) dan sinyal backdoor (Monitor, Kandidat, POV-Dalam, pengendali
terverifikasi) menjadi satu daftar saham terbaik beserta alasannya. Logika murni tanpa akses jaringan; server.py
mengumpulkan datanya dari berkas lokal lalu memanggil nilai().

Skor = jumlah poin dari setiap sumber yang mendukung (maks. per sumber pada BOBOT) dikurangi poin risiko. Saham hanya
masuk daftar bila harganya di bawah batas harga, didukung minimal dua sumber, dan punya rencana dengan target 1 naik
10-20% serta target 2 naik 25-100% dari entry (R:R minimal 1, stop paling jauh 15%), skornya minimal SKOR_MIN, dan
tidak sedang ada pola harmonik bearish di PRZ atau yang sudah berbalik turun. Bukan saran investasi personal."""
import re
from datetime import date

# Naikkan bila aturan berubah: rekomendasi hari ini yang tersimpan dengan versi lama dihitung ulang.
VERSI = 13
BOBOT = {"harmonik": 25, "recovery": 20, "backdoor": 20, "seasonality": 15, "broker": 15, "lk": 15, "saham50": 10, "kakdr": 10,
         "momentum": 15, "broksum": 15}
NAMA_SUMBER = {"harmonik": "Harmonic Pattern", "recovery": "Recovery", "backdoor": "Backdoor", "seasonality": "Seasonality",
               "broker": "Pola Broker", "lk": "Laporan keuangan", "saham50": "Saham 50", "kakdr": "KakdrWay",
               "momentum": "Momentum", "broksum": "Broksum harian"}
# Tonggak backdoor di Monitor (item.ms), dari yang paling lanjut; poin bila tercatat. Label tahap Monitor ("tender")
# terlalu lebar (akuisisi pun masuk tahap tender), jadi teks memakai tonggak yang benar-benar tercatat.
TONGGAK = [("bisnis", "perubahan bisnis selesai", 0), ("inbreng", "inbreng aset", 20), ("kjpp", "penilaian aset oleh KJPP", 20),
           ("rights", "rights issue", 20), ("rupslb", "RUPSLB", 20), ("to_selesai", "tender offer selesai", 20),
           ("to_umum", "pengumuman tender offer", 18), ("akuisisi", "akuisisi (pengambilalihan)", 16), ("spa", "perjanjian jual beli (SPA)", 14)]
SINYAL = {"akuisisi": "akuisisi", "kbli": "perubahan KBLI", "rights": "rights issue", "direksi": "pergantian pengurus", "uma": "UMA"}
# Syarat rencana: naik target 1 dan target 2 dari entry (persen), R:R minimal ke target 1, stop terjauh di bawah entry,
# dan entry paling jauh di bawah harga terakhir (rencana "tunggu turun ke area entry").
TARGET1, TARGET2 = (10, 20), (25, 100)
RR_MIN, STOP_MAKS, ENTRY_BAWAH = 1.0, 15, 5
SKOR_MIN = 20      # skor gabungan minimal supaya sinyal lemah tidak ikut direkomendasikan
# Pantauan: saham berpotensi yang belum masuk daftar utama (cadangan di luar 5 besar, atau skor tinggi tetapi belum ada
# rencana yang memenuhi syarat), plus sinyal tunggal yang kuat (poin sumber minimal PANTAU_SINYAL dari bobotnya).
PANTAU_MAKS, PANTAU_SINYAL = 10, 0.6      # PANTAU_MAKS per jenis (cadangan / belum masuk) per kelompok
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def _rp(v) -> str:
    return "–" if v is None else f"{round(v):,}".replace(",", ".")


def _tgl(d) -> str:
    """'2026-11-11' -> '11 Nov'; tanggal di luar tahun berjalan diberi tahun ('2025-12-16' -> '16 Des 2025')."""
    try:
        teks = f"{int(str(d)[8:10])} {BULAN[int(str(d)[5:7]) - 1][:3]}"
        return teks if str(d)[:4] == str(date.today().year) else f"{teks} {str(d)[:4]}"
    except (ValueError, IndexError):
        return str(d)


def _miliar(v) -> str:
    return f"Rp{abs(v) / 1e9:.1f} M".replace(".", ",")


def momentum(bars: list[dict], hari: int = 5) -> dict | None:
    """Volume besar dan breakout dalam `hari` bar terakhir (bar harian {d,o,h,l,c,v}, terlama ke terbaru):
    volume terbesar dibanding rata-rata 20 bar sebelumnya, penutupan pertama di atas tertinggi 20 bar sebelumnya,
    penutupan terakhir di atas puncak 60 bar sebelum jendela, dan penutupan di bawah terendah 20 bar (breakdown)."""
    b = [x for x in bars or [] if x.get("v") is not None and x.get("c") is not None]
    if len(b) < 30:
        return None
    vol, vtgl, bo, bdown = 0.0, None, None, None
    for k in range(len(b) - hari, len(b)):
        prev = b[k - 20:k]
        rata = sum(x["v"] for x in prev) / 20
        r = b[k]["v"] / rata if rata else 0
        if r > vol:
            vol, vtgl = r, b[k]["d"]
        if bo is None and b[k]["c"] > max(x["h"] for x in prev):
            bo = b[k]["d"]
        if b[k]["c"] < min(x["l"] for x in prev):
            bdown = b[k]["d"]
    atas60 = b[-1]["c"] > max(x["h"] for x in b[-65:-hari]) if len(b) > hari + 20 else False
    return {"vol": round(vol, 1), "volTgl": vtgl, "breakout": bo, "atas60": atas60, "breakdown": bdown}


def resistensi(bars: list[dict], lebar: int = 5, abaikan: int = 5) -> list[tuple]:
    """Puncak-puncak sebelumnya (swing high: lebih tinggi dari `lebar` bar ke kiri dan kanan) di luar `abaikan` bar
    terakhir, sebagai level resistance nyata dari chart: [(harga, tanggal)], dari yang terendah."""
    b = [x for x in bars or [] if x.get("h") is not None]
    out = []
    for i in range(lebar, len(b) - max(lebar, abaikan)):
        h = b[i]["h"]
        if h > max(x["h"] for j, x in enumerate(b[i - lebar:i + lebar + 1]) if j != lebar):
            out.append((h, b[i]["d"]))
    return sorted(set(out))


def _rentang(lo, hi) -> str:
    return _rp(lo) if lo is not None and hi is not None and round(lo) == round(hi) else f"{_rp(lo)}–{_rp(hi)}"


def _pct(v) -> str:
    return "–" if v is None else (f"{v:+.1f}".replace(".", ",") + "%")


def _lebih(v, batas) -> str:
    """Persen yang melewati batas, cukup desimal supaya tidak tampil sama dengan batasnya (15,04 -> '15,04', bukan '15,0')."""
    for n in (1, 2, 3):
        t = f"{v:.{n}f}"
        if float(t) > batas:
            break
    return t.replace(".", ",")


def _r(v) -> str:
    return f"{v:.2f}".replace(".", ",")


def periksa(r: dict, batas_harga: float, items: dict | None = None) -> list[str]:
    """Pemeriksaan mandiri satu baris rekomendasi sebelum ditampilkan: angka rencana harus konsisten dengan syarat, dan
    klaim backdoor di alasan harus sesuai data Monitor. Hasil: daftar masalah (kosong = lolos)."""
    salah = []
    h, p = r.get("harga"), r.get("plan") or {}
    e, sl, t1, t2 = p.get("entry"), p.get("stop"), p.get("tp1"), p.get("tp2")
    if not (h and 0 < h < batas_harga):
        salah.append(f"harga {h} di luar batas")
    if not all(isinstance(x, (int, float)) and x > 0 for x in (e, sl, t1, t2)):
        return salah + ["angka rencana tidak lengkap"]
    if not sl < e < t1 < t2:
        salah.append(f"urutan stop {sl} < entry {e} < target 1 {t1} < target 2 {t2} tidak terpenuhi")
    if not (h * (1 - ENTRY_BAWAH / 100) <= e <= h * 1.02):
        salah.append(f"entry {e} terlalu jauh dari harga {h}")
    n1, n2, st = (t1 / e - 1) * 100, (t2 / e - 1) * 100, (1 - sl / e) * 100
    if not TARGET1[0] - 0.05 <= n1 <= TARGET1[1] + 0.05:
        salah.append(f"target 1 naik {n1:.1f}% di luar {TARGET1[0]}-{TARGET1[1]}%")
    if not TARGET2[0] - 0.05 <= n2 <= TARGET2[1] + 0.05:
        salah.append(f"target 2 naik {n2:.1f}% di luar {TARGET2[0]}-{TARGET2[1]}%")
    if st > STOP_MAKS + 0.05:
        salah.append(f"stop {st:.1f}% di bawah entry, lebih dari {STOP_MAKS}%")
    rr = (t1 - e) / (e - sl) if e > sl else 0
    if rr < RR_MIN - 0.005 or abs(rr - (p.get("rr") or 0)) > 0.01:
        salah.append(f"R:R {rr:.2f} tidak sesuai syarat atau angka tampilan")
    for k, n in (("naik1", n1), ("naik2", n2)):
        if abs((p.get(k) or 0) - n) > 0.1:
            salah.append(f"{k} tampilan {p.get(k)} tidak sama dengan hitungan {n:.1f}")
    if not p.get("tp1Ket") or not p.get("tp2Ket"):
        salah.append("asal target tidak disebut")
    if (r.get("skor") or 0) < SKOR_MIN or (r.get("jumlahSumber") or 0) < 2:
        salah.append("skor atau jumlah sumber di bawah syarat")
    # Klaim backdoor: tahap dan tender offer harus berasal dari item Monitor yang bukan deteksi otomatis belum terkonfirmasi.
    it = (items or {}).get(r.get("t")) or {}
    teks = " ".join(r.get("alasan") or [])
    if "Di Monitor backdoor tercatat" in teks and (not it or it.get("autoJenis") in ("rencana", "rencana-ditolak")):
        salah.append("klaim tahap backdoor tanpa item Monitor terkonfirmasi")
    m = re.search(r"tender offer Rp([\d.]+) periode", teks)
    if m and _rp((it.get("tender") or {}).get("price") or 0) != m.group(1):
        salah.append(f"harga tender offer Rp{m.group(1)} tidak sama dengan data Monitor")
    return salah


def nilai(src: dict, batas_harga: float = 2000, jumlah: int = 10) -> dict:
    """src berisi (semua opsional):
    harga {t: {h}}, nama {t: nama}, bulan (1-12),
    harmonik [baris .harmonik.json], recovery [saham recovery_api], seasonality [saham season_api],
    broker {"bulan": m, "akumulasi": [{s, bandar}], "distribusi": [{s, bandar}]}, lk [baris lk_api],
    saham50 [baris], kakdr [baris], momentum {t: momentum() + res, l5, c} (ringkasan dari pemindaian Harmonic malam),
    bars {t: bar harian} (cadangan bila ringkasan momentum belum ada), broksum {"tanggal": [...], "saham": {t: {net, hariAkum, kemarin}}},
    items [Monitor], kandidat [item kandidat], backdoor_pd {t: skor 0-100},
    pengendali {t: {...}} (pengendali-verified.json), sikap {t: sikap pandangan analis}, hsc [kode saham HSC].
    Hasil: rows = Non HSC terbaik, hsc = HSC terbaik (masing-masing paling banyak `jumlah`, peringkat sendiri)."""
    harga = {t: (v or {}).get("h") for t, v in (src.get("harga") or {}).items()}
    nama = dict(src.get("nama") or {})
    acc: dict[str, dict] = {}

    def tambah(t, sumber, poin, alasan):
        a = acc.setdefault(t, {"komponen": {}, "alasan": [], "risiko": [], "plan": None})
        if poin > a["komponen"].get(sumber, 0):
            a["komponen"][sumber] = round(min(poin, BOBOT[sumber]), 1)
            a["alasan"] = [x for x in a["alasan"] if x[0] != sumber] + [(sumber, alasan)]

    def risiko(t, poin, teks):
        a = acc.setdefault(t, {"komponen": {}, "alasan": [], "risiko": [], "plan": None})
        a["risiko"].append((poin, teks))

    calon: dict[str, list] = {}      # calon rencana per saham: (prioritas, entry, stop, [(target, keterangan)], sumber)
    level: dict[str, list] = {}      # semua level target per saham dari semua sumber

    def rencana(t, prioritas, entry, stop, target, sumber):
        tg = [(x, k) for x, k in target if x]
        level.setdefault(t, []).extend(tg)
        if stop and tg:
            calon.setdefault(t, []).append((prioritas, entry, stop, tg, sumber))

    # Harmonic Pattern: satu pola bullish terbaik per saham dipakai untuk alasan sekaligus rencana; bearish di PRZ = risiko.
    STATUS = {"berbalik": (25, "sudah berbalik dari D"), "prz": (20, "harga sedang di PRZ"), "menuju": (8, "harga menuju PRZ")}
    terbaik: dict[str, tuple] = {}
    bearish: set[str] = set()
    for r in src.get("harmonik") or []:
        t, st = r.get("t"), r.get("status")
        if not t or st not in STATUS:
            continue
        pola = r.get("polaNama") or r.get("nama") or r.get("pola") or "pola harmonik"
        if r.get("arah") != "bullish":
            if st in ("prz", "berbalik"):
                bearish.add(t)   # pola bearish aktif: bertentangan dengan rencana beli, saham tidak direkomendasikan
            continue
        if st == "menuju" and (r.get("jarak") or 99) > 5:
            continue
        tg = r.get("target") or [None, None]
        h = r.get("harga") or harga.get(t)
        lewat = bool(tg[0] and h and h >= tg[0])
        poin = 5 if lewat else STATUS[st][0]
        if (r.get("abcd") or {}).get("ok") is False:
            poin -= 6   # AB=CD di dalam pola belum terpenuhi (Carney: syarat minimum): pola lebih lemah
        if t not in terbaik or poin > terbaik[t][0]:
            terbaik[t] = (poin, lewat, pola, r)
    for t, (poin, lewat, pola, r) in terbaik.items():
        st, prz, tg = r["status"], r.get("prz") or [None, None], r.get("target") or [None, None]
        if lewat:
            # Harga sudah melewati target pertama: kesempatan dari pola ini sudah berjalan, poin kecil dan tanpa rencana.
            tambah(t, "harmonik", poin, f"Pola {pola} bullish sudah berbalik dari PRZ {_rentang(*prz)} dan harga sudah melewati target pertama {_rp(tg[0])}; kesempatan dari pola ini sudah berjalan.")
            continue
        ab = r.get("abcd") or {}
        lemah = f" AB=CD belum terpenuhi (CD {str(ab.get('rasio')).replace('.', ',')} kali AB), pola lebih lemah." if ab.get("ok") is False else ""
        tambah(t, "harmonik", poin, f"Pola {pola} bullish, {STATUS[st][1]}. PRZ {_rentang(*prz)}, target {_rp(tg[0])} dan {_rp(tg[1])}, batal di bawah {_rp(r.get('stop'))}.{lemah}")
        masuk = r.get("harga") if st != "menuju" else prz[1]
        ca = [(x, f"target lanjutan pola {pola}") for x in (r.get("targetCA") or [])]
        rencana(t, 3, masuk, r.get("stop"), [(tg[0], f"0,382 kaki AD pola {pola}"), (tg[1], f"0,618 kaki AD pola {pola}")] + ca, f"Harmonic {pola}")

    # Recovery: saham yang turun dalam dan mulai pulih.
    for r in src.get("recovery") or []:
        t, sk, st = r.get("t"), r.get("skor") or 0, r.get("status") or ""
        if not t or st not in ("Siap rebound", "Mulai pulih"):
            continue
        tek, al = r.get("tek") or {}, [str(x) for x in r.get("alasan") or []]
        turun = next((x for x in al if x.lower().startswith("turun")), f"Turun {abs(round(tek.get('turun') or 0))}% dari puncak 52 minggu")
        teknik = next((x for x in al if x.lower().startswith("teknikal")), "")
        tambah(t, "recovery", sk * 0.2, f"Recovery {st.lower()} (skor {round(sk)}). {turun}." + (f" {teknik}." if teknik else ""))
        p = r.get("plan") or {}
        e = p.get("entry") or [None, None]
        rencana(t, 2, e[1] if isinstance(e, list) else e, p.get("sl"), [(p.get("tp1"), "target 1 Recovery"), (p.get("tp2"), "target 2 Recovery")], "Recovery")

    # Seasonality bulan berjalan.
    bln = src.get("bulan")
    for r in src.get("seasonality") or []:
        t, prob = r.get("t"), r.get("prob") or 0
        if not t or prob < 60:
            continue
        nb = BULAN[bln - 1] if bln else "bulan ini"
        tambah(t, "seasonality", (r.get("skor") or 0) * 0.15, f"Seasonality {nb}: naik {r.get('up')} kali dari {r.get('n')} tahun ({round(prob)}%), median {_pct(r.get('median'))}.")
        p = r.get("plan") or {}
        e = p.get("entry") or [None, None]
        rencana(t, 1, e[1] if isinstance(e, list) else e, p.get("sl"), [(p.get("tp1"), "target 1 Seasonality"), (p.get("tp2"), "target 2 Seasonality")], "Seasonality")

    # Pola Broker bulan terakhir: peringkat akumulasi bandar; distribusi = risiko.
    bro = src.get("broker") or {}
    nb = BULAN[bro["bulan"] - 1] if bro.get("bulan") else "bulan terakhir"
    akum = bro.get("akumulasi") or []
    for i, r in enumerate(akum):
        if (r.get("bandar") or 0) > 0:
            tambah(r["s"], "broker", 15 - 10 * i / max(1, len(akum) - 1), f"Bandar akumulasi di {nb} (peringkat {i + 1} dari {len(akum)} saham).")
    for r in bro.get("distribusi") or []:
        risiko(r["s"], 8, f"Bandar distribusi di {nb}.")

    # Laporan keuangan terbaru.
    LK = {"berbalik": (15, "berbalik untung"), "bagus": (12, "laba naik kuat"), "naik": (8, "laba naik")}   # bagus = naik >= 20%
    for r in src.get("lk") or []:
        t, k = r.get("t"), r.get("kategori")
        if not t:
            continue
        laba = r.get("laba") or {}
        if k in LK:
            # Laba naik di bawah 20%: poin sebanding kenaikannya (naik 1% hampir tidak berarti).
            poin = LK[k][0] if k != "naik" else 2 + 6 * min(max(laba.get("pct") or 0, 0), 20) / 20
            tambah(t, "lk", poin, f"Laporan {r.get('periode') or 'terbaru'}: {LK[k][1]}{' ' + _pct(laba.get('pct')) if laba.get('pct') is not None else ''}.")
        elif k == "rugi":
            risiko(t, 6, f"Laporan {r.get('periode') or 'terbaru'} masih rugi.")
        elif k == "turun":
            risiko(t, 4, f"Laba laporan {r.get('periode') or 'terbaru'} turun.")

    # Saham 50 (harga Rp50 ke bawah).
    for r in src.get("saham50") or []:
        t, sk = r.get("t"), r.get("skor") or 0
        if t and (r.get("target") or {}).get("harga"):
            level.setdefault(t, []).append((r["target"]["harga"], f"Saham 50: {r['target'].get('dasar') or 'resistance'}"))
        if t and sk >= 50:
            tambah(t, "saham50", sk * 0.1, f"Saham 50 skor {round(sk)}: {(r.get('potensi') or ['potensi kenaikan dari harga dasar'])[0]}")

    # Momentum harian: volume besar (>= 2x rata-rata 20 hari) dan breakout tertinggi 20 hari dalam 5 hari bursa terakhir.
    # Puncak sebelumnya di chart (resistance) masuk ke kumpulan level target semua saham yang punya bar harian.
    mom = dict(src.get("momentum") or {})
    for t, bars in (src.get("bars") or {}).items():
        m = momentum(bars)
        if m and t not in mom:
            b5 = [x for x in bars[-5:] if x.get("l") is not None]
            b20 = [x for x in bars[-20:] if x.get("l") is not None]
            mom[t] = {**m, "res": resistensi(bars), "l5": min(x["l"] for x in b5) if b5 else None,
                      "l20": min(x["l"] for x in b20) if b20 else None, "c": bars[-1].get("c")}
    for t, m in mom.items():
        res = [tuple(x) for x in m.get("res") or []]
        level.setdefault(t, []).extend((h, f"resistance puncak {_tgl(d)}") for h, d in res)
        if m["breakdown"] and not m["breakout"]:
            risiko(t, 5, f"Harga menembus ke bawah terendah 20 hari pada {_tgl(m['breakdown'])}.")
            continue
        poin, teks = 0.0, []
        if m["vol"] >= 2:
            poin += 2 + 6 * min(m["vol"], 8) / 8
            teks.append(f"volume {_r(m['vol']).rstrip('0').rstrip(',')} kali rata-rata 20 hari pada {_tgl(m['volTgl'])}")
        if m["breakout"]:
            poin += 5
            teks.append(f"harga menembus tertinggi 20 hari pada {_tgl(m['breakout'])}")
        if m["atas60"] and teks:
            poin += 2
            teks.append("penutupan terakhir di atas puncak 60 hari")
        if teks:
            tambah(t, "momentum", poin, "Momentum: " + ", ".join(teks) + ".")
        # Rencana dari chart: entry di harga terakhir, stop di terendah 5 hari terakhir, target dari resistance (puncak
        # sebelumnya). Untuk saham bermomentum prioritasnya di atas Seasonality; untuk saham lain jadi cadangan terakhir
        # supaya saham berskor tinggi tanpa pola/recovery tetap punya rencana bila chart-nya memenuhi syarat.
        # Harga di terendah 5 hari (stop = entry): stop pindah ke terendah 20 hari.
        e = harga.get(t) or m.get("c")
        sl, lbl = next(((x, k) for x, k in ((m.get("l5"), "5"), (m.get("l20"), "20")) if x and e and x < e * 0.995), (None, ""))
        if sl:
            rencana(t, 1.5 if teks else 0.5, e, sl, [(h, f"resistance puncak {_tgl(d)}") for h, d in res if h > e],
                    f"Momentum (stop di terendah {lbl} hari)" if teks else f"Support-resistance chart (stop di terendah {lbl} hari)")

    # Broksum harian beberapa hari bursa terakhir: akumulasi bersih menambah poin, distribusi bersih jadi risiko.
    bs = src.get("broksum") or {}
    nh = len(bs.get("tanggal") or []) or 5
    for t, o in (bs.get("saham") or {}).items():
        net, ha = o.get("net") or 0, o.get("hariAkum") or 0
        kmr = " termasuk kemarin" if (o.get("kemarin") or 0) > 0 else ""
        if net > 0:
            tambah(t, "broksum", 3 + 6 * min(net / 1e10, 1) + 1.2 * ha,
                   f"Broksum {nh} hari bursa terakhir: akumulasi bersih {_miliar(net)}, akumulasi {ha} dari {nh} hari{kmr}.")
        elif net < 0:
            risiko(t, 5 + 5 * min(-net / 1e10, 1), f"Broksum {nh} hari bursa terakhir: distribusi bersih {_miliar(net)}.")

    # KakdrWay (valuasi dan kualitas).
    for r in src.get("kakdr") or []:
        t, sk = r.get("t"), r.get("skor") or 0
        if t:
            tambah(t, "kakdr", sk, f"KakdrWay skor {_r(sk)} dari 10: PBV {_r(r['pbv']) if r.get('pbv') is not None else '–'}, ROE {_pct(r.get('roe'))}.")

    # Backdoor: tahap di Monitor, sinyal Kandidat, skor POV-Dalam, pengendali terverifikasi.
    bd: dict[str, list] = {}
    for it in src.get("items") or []:
        t, ms, auto = it.get("ticker"), it.get("ms") or {}, it.get("msAuto") or {}
        if not t or ms.get("bisnis") or it.get("stage") == "selesai":
            continue
        # Item otomatis dari berita yang belum terkonfirmasi KSEI (atau sudah ditolak saat dicek ulang) tidak dihitung:
        # judul berita bisa salah tangkap (emiten itu pembeli, atau berita tentang emiten lain).
        if it.get("autoJenis") in ("rencana", "rencana-ditolak"):
            continue
        top = next((x for x in TONGGAK if ms.get(x[0])), None)
        if top:
            k, label, poin = top
            belum = bool(re.search(r"belum (terverifikasi|ditemukan)", it.get("notes") or "", re.I))
            td = it.get("tender") or {}
            if k == "to_umum":
                # Tender offer: dengan data tender sebut periode dan harganya; tanpa data, baru rencana yang diumumkan.
                label = (f"tender offer Rp{_rp(td['price'])} periode {_tgl(td['start'])}–{_tgl(td['end'])}" if td.get("price") and td.get("start") and td.get("end")
                         else "rencana tender offer wajib yang sudah diumumkan (belum ada pelaksanaan tender offer di Stockbit)")
            teks = f"Di Monitor backdoor tercatat {label}"
            if k in auto:
                teks += f" (terdeteksi otomatis {_tgl(auto[k])})"
                poin -= 2
            if it.get("ctrlName"):
                teks += f"; pengendali {it['ctrlName']}" + (f" {str(round(it['ctrlPct'], 2)).replace('.', ',')}%" if it.get("ctrlPct") else "")
            if belum:
                teks += "; catatan tim: tahap belum terverifikasi"
                poin = min(poin, 10)
            bd.setdefault(t, []).append((poin, teks + "."))
        else:
            fl = [SINYAL[k] for k, v in (it.get("flags") or {}).items() if v and k in SINYAL]
            bd.setdefault(t, []).append((10 + 2 * len(fl), "Masuk radar backdoor" + (f" dengan sinyal {', '.join(fl)}." if fl else ".")))
    for it in src.get("kandidat") or []:
        t = it.get("ticker")
        sig = [SINYAL[k] for k, v in (it.get("signals") or {}).items() if (v or {}).get("st") == "on" and k in SINYAL]
        if t and sig:
            bd.setdefault(t, []).append((4 * len(sig) + (6 if it.get("pengendaliBaru") else 0), f"Kandidat backdoor: {', '.join(sig)}" + (", ada pengendali baru." if it.get("pengendaliBaru") else ".")))
    for t, sk in (src.get("backdoor_pd") or {}).items():
        if sk and sk >= 50:
            bd.setdefault(t, []).append((sk * 0.2, f"Skor backdoor POV-Dalam {round(sk)} dari 100."))
    for t, v in (src.get("pengendali") or {}).items():
        if isinstance(v, dict) and t != "_info" and not v.get("bukanPengambilAlih") and v.get("siapa"):
            # Nama pihaknya saja: sampai sebelum keterangan pertama (kurung, koma, atau kata kerja).
            siapa = re.split(r" \(|, | membeli| mengambil| melalui| yang | sebagai ", v["siapa"])[0].strip()
            tgl = f" (sumber {_tgl(v['sumberTanggal'])} {str(v['sumberTanggal'])[:4]})" if v.get("sumberTanggal") else ""
            bd.setdefault(t, []).append((8, f"Pengendali baru terverifikasi{tgl}: {siapa}."))
    for t, xs in bd.items():
        xs.sort(key=lambda x: -x[0])
        tambah(t, "backdoor", sum(p for p, _ in xs[:2]), " ".join(s for _, s in xs[:2]))

    for t, s in (src.get("sikap") or {}).items():
        if s and "hindari" in str(s).lower():
            risiko(t, 15, "Pandangan analis: hindari.")

    def pilih_rencana(t, h):
        """Rencana dengan prioritas sumber tertinggi yang memenuhi syarat: stop paling jauh STOP_MAKS% di bawah entry,
        entry paling jauh ENTRY_BAWAH% di bawah harga terakhir, target 1 naik TARGET1% dan target 2 naik TARGET2% dari
        entry, R:R ke target 1 minimal RR_MIN. Target diambil dari sumber rencana itu dulu, lalu dari level sumber lain.
        Hasil: (rencana, None) atau (None, sebab tidak ada rencana) untuk daftar Pantauan."""
        sebab = []
        if not calon.get(t):
            return None, "belum ada entry dan stop dari sumber mana pun (Harmonic, Recovery, Momentum, Seasonality)"
        for p, e, sl, tg, sumber in sorted(calon.get(t) or [], key=lambda c: -c[0]):
            e = e or h
            nm = sumber.split(" (")[0]
            if not (sl and e and sl < e):
                sebab.append(f"{nm}: stop tidak di bawah entry")
                continue
            if not (e <= h * 1.02 and e >= h * (1 - ENTRY_BAWAH / 100)):
                sebab.append(f"{nm}: entry {_rp(e)} jauh dari harga {_rp(h)}")
                continue
            if (1 - sl / e) * 100 > STOP_MAKS:
                sebab.append(f"{nm}: stop {_rp(sl)} turun {_lebih((1 - sl / e) * 100, STOP_MAKS)}% dari entry, lebih dari {STOP_MAKS}%")
                continue
            naik = lambda x: (x / e - 1) * 100
            def cari(lo, hi, min_harga):
                for daftar in (tg, level.get(t) or []):
                    ok = sorted((x for x in daftar if lo <= naik(x[0]) <= hi and x[0] > min_harga), key=lambda x: x[0])
                    if ok:
                        return ok[0]
                return None
            t1 = cari(*TARGET1, e)
            t2 = cari(*TARGET2, t1[0]) if t1 else None
            if not t1 or not t2:
                sebab.append(f"{nm}: tidak ada level target " + (f"1 naik {TARGET1[0]}–{TARGET1[1]}%" if not t1 else f"2 naik {TARGET2[0]}–{TARGET2[1]}%")
                             + f" dari entry {_rp(e)}")
                continue
            rr = (t1[0] - e) / (e - sl)
            if rr < RR_MIN:
                sebab.append(f"{nm}: R:R {_r(rr)} di bawah {RR_MIN:g}")
                continue
            return {"entry": e, "stop": sl, "tp1": t1[0], "tp1Ket": t1[1], "tp2": t2[0], "tp2Ket": t2[1], "sumber": sumber,
                    "rr": round(rr, 2), "naik1": round(naik(t1[0]), 1), "naik2": round(naik(t2[0]), 1), "turunStop": round((sl / e - 1) * 100, 1)}, None
        return None, "; ".join(dict.fromkeys(sebab))

    rows, dibuang = [], []
    item_by = {it.get("ticker"): it for it in src.get("items") or [] if it.get("ticker")}
    pantau = []
    hsc = set(src.get("hsc") or [])

    def calon_pantau(t, a, h, skor, sebab):
        """Saham yang tidak masuk daftar utama tetap dicatat bila berpotensi: skor sudah memenuhi, atau ada satu sinyal kuat."""
        kuat = [NAMA_SUMBER[k] for k, v in a["komponen"].items() if v >= BOBOT[k] * PANTAU_SINYAL]
        if skor < SKOR_MIN and not kuat:
            return
        urut = sorted(a["alasan"], key=lambda x: -a["komponen"].get(x[0], 0))
        pantau.append({"t": t, "nama": nama.get(t, ""), "harga": h, "skor": skor, "hsc": t in hsc, "jenis": "belum",
                       "komponen": {NAMA_SUMBER[k]: v for k, v in sorted(a["komponen"].items(), key=lambda x: -x[1])},
                       "alasan": [s for _, s in urut][:2], "risiko": [s for _, s in a["risiko"]][:2], "sebab": sebab})

    for t, a in acc.items():
        h = harga.get(t)
        if not h or h >= batas_harga:
            continue
        kurang = sum(p for p, _ in a["risiko"])
        skor = round(sum(a["komponen"].values()) - kurang, 1)
        if t in bearish:
            calon_pantau(t, a, h, skor, "ada pola harmonik bearish yang aktif (di PRZ atau sudah berbalik turun)")
            continue
        if len(a["komponen"]) < 2:
            calon_pantau(t, a, h, skor, "baru didukung satu sumber; tunggu konfirmasi sumber lain")
            continue
        if skor < SKOR_MIN:
            calon_pantau(t, a, h, skor, f"skor {_r(skor).rstrip('0').rstrip(',')} di bawah syarat {SKOR_MIN}")
            continue
        plan, sebab = pilih_rencana(t, h)
        if plan is None:
            calon_pantau(t, a, h, skor, "rencana belum memenuhi syarat: " + sebab)
            continue      # tidak ada rencana dengan target 1 naik 10-20% dan target 2 naik 25-100%
        if plan["entry"] < h * 0.99:
            a["risiko"].append((0, f"Entry {_rp(plan['entry'])} di bawah harga terakhir {_rp(h)}: tunggu harga turun ke area entry, jangan dikejar."))
        urut = sorted(a["alasan"], key=lambda x: -a["komponen"].get(x[0], 0))
        rows.append({"t": t, "nama": nama.get(t, ""), "harga": h, "skor": skor,
                     "komponen": {NAMA_SUMBER[k]: v for k, v in sorted(a["komponen"].items(), key=lambda x: -x[1])},
                     "jumlahSumber": len(a["komponen"]), "alasan": [s for _, s in urut], "risiko": [s for _, s in a["risiko"]], "plan": plan})
        salah = periksa(rows[-1], batas_harga, item_by)
        if salah:
            rows.pop()      # gagal pemeriksaan mandiri: tidak ditampilkan, alasannya dicatat
            dibuang.append({"t": t, "skor": skor, "masalah": salah})
    rows.sort(key=lambda r: (-r["skor"], -r["jumlahSumber"], r["t"]))
    # Saham HSC (konsentrasi kepemilikan tinggi, dikeluarkan dari IHSG) diperingkat terpisah dari saham Non HSC.
    for r in rows:
        r["hsc"] = r["t"] in hsc
    non, dgn = [r for r in rows if not r["hsc"]], [r for r in rows if r["hsc"]]
    # Yang lolos semua syarat tetapi di luar daftar utama menjadi cadangan di Pantauan (rencana lengkap ikut).
    for r in non[jumlah:] + dgn[jumlah:]:
        pantau.append({**r, "jenis": "cadangan", "alasan": r["alasan"][:2], "risiko": r["risiko"][:2],
                       "sebab": f"lolos semua syarat, di luar {jumlah} besar"})
    non, dgn = non[:jumlah], dgn[:jumlah]
    for grup in (non, dgn):
        for i, r in enumerate(grup):
            r["peringkat"] = i + 1
    # Cadangan dulu, lalu yang belum masuk; masing-masing jenis per kelompok paling banyak PANTAU_MAKS (skor tertinggi),
    # supaya hari dengan banyak cadangan tidak menyingkirkan saham berskor tinggi yang belum punya rencana.
    pantau.sort(key=lambda r: (r["jenis"] != "cadangan", -r["skor"], r["t"]))
    pantau = [r for k in (False, True) for j in ("cadangan", "belum")
              for r in [x for x in pantau if x["hsc"] == k and x["jenis"] == j][:PANTAU_MAKS]]
    return {"versi": VERSI, "syarat": {"target1": TARGET1, "target2": TARGET2, "rrMin": RR_MIN, "stopMaks": STOP_MAKS, "skorMin": SKOR_MIN}, "batasHarga": batas_harga, "dinilai": len(acc), "lolos": sum(not r["hsc"] for r in rows), "lolosHsc": sum(r["hsc"] for r in rows),
            "rows": non, "hsc": dgn, "bobot": {NAMA_SUMBER[k]: v for k, v in BOBOT.items()},
            "dibuang": sorted(dibuang, key=lambda x: -x["skor"])[:20], "pantauan": pantau,
            "syaratPantau": {"maks": PANTAU_MAKS, "sinyal": PANTAU_SINYAL}}
