"""Analisa AH (Andry Hakim): portofolio dari data KSEI >=1% (profil Stockbit), ciri saham pilihannya, dan screening
saham BEI yang mirip: saham beredar sedikit, porsi publik kecil, nilai float tipis, pemegang menyusut, dan pemegang
yang sering muncul bersama AH. Fungsi murni; data dimasukkan oleh server (indeks profil, Key Stats, harga)."""
from __future__ import annotations

import re
import statistics

PUBLIK_RX = re.compile(r"masyarakat|publik|public", re.I)


def _kuartal_urut(vals: dict) -> list[tuple[str, float]]:
    """{"Q326": v, "Q425": v} -> urut lama ke baru."""
    def kunci(k):
        m = re.match(r"Q(\d)(\d\d)$", k)
        return (int(m.group(2)), int(m.group(1))) if m else (0, 0)
    return sorted(((k, v) for k, v in (vals or {}).items() if re.match(r"Q\d\d\d$", k)), key=lambda kv: kunci(kv[0]))


def tren_pemegang(jumlah: list) -> dict | None:
    """jumlah = [[tanggal, n], ...] terbaru dulu. Bandingkan dengan data ~3 bulan sebelumnya."""
    j = [x for x in jumlah or [] if x and x[1]]
    if len(j) < 2:
        return None
    kini, lalu = j[0], j[min(3, len(j) - 1)]
    return {"kini": int(kini[1]), "tgl": kini[0], "lalu": int(lalu[1]), "tglLalu": lalu[0],
            "ubah": round((kini[1] - lalu[1]) / lalu[1] * 100, 1), "seri": [[d, int(n)] for d, n in j[:6]]}


def struktur(t: str, k: dict, harga: dict) -> dict:
    """Saham beredar, free float, saham publik (lembar), nilai float (Rp), harga."""
    saham, ff, mcap = k.get("saham"), k.get("freeFloat"), k.get("mcap")
    h = (harga.get(t) or {}).get("h") or k.get("hargaKira")
    kira = False
    if not saham and mcap and h:                    # Key Stats kadang tanpa jumlah saham: turunkan dari kapitalisasi / harga
        saham, kira = round(mcap / h), True
    elif h and saham:
        mcap = h * saham
    publik = saham * ff / 100 if saham and ff is not None else None
    return {"saham": saham, "ff": ff, "harga": h, "mcap": mcap, "publik": publik,
            "nilaiFloat": publik * h if publik and h else None, "sahamKira": kira}


def laba(k: dict) -> list:
    return [[q, v] for q, v in _kuartal_urut((k.get("kuartal") or {}).get("Net Income"))[-4:]]


def cocok_nama(nama: str, pola: list[str]) -> bool:
    n = nama.upper()
    return any(p.upper() in n for p in pola)


def portofolio(cfg: dict, pidx: dict) -> list[dict]:
    """Saham yang dipegang AH: atas nama pribadi (KSEI >=1%), lewat entitas terkait (indikasi), dan tambahan kurasi."""
    pola = cfg.get("polaNama") or []
    ent = {e["nama"].upper(): e for e in cfg.get("entitas") or []}
    out: dict[str, dict] = {}
    for t, v in pidx.items():
        for nm, pct, *_ in v.get("pemegang") or []:
            if cocok_nama(nm, pola):
                out.setdefault(t, {"t": t, "jalur": []})["jalur"].append(
                    {"nama": nm, "pct": pct, "jenis": "pribadi", "status": "KSEI", "ket": f"KSEI ≥1% per {(v.get('jumlah') or [['']])[0][0] or v.get('at', '')}"})
            elif nm.upper() in ent:
                e = ent[nm.upper()]
                out.setdefault(t, {"t": t, "jalur": []})["jalur"].append(
                    {"nama": nm, "pct": pct, "jenis": "PT", "status": e.get("status", "indikasi"), "ket": e.get("ket", "")})
    for x in cfg.get("tambahan") or []:
        r = out.setdefault(x["t"], {"t": x["t"], "jalur": []})
        r["jalur"].append({"nama": "belum terdeteksi", "pct": None, "jenis": "kurasi", "status": x.get("status", "indikasi"),
                           "ket": x.get("ket", ""), "sumber": x.get("sumber") or []})
    return sorted(out.values(), key=lambda r: -max([j["pct"] or 0 for j in r["jalur"]] or [0]))


def rekan(porto: list[dict], pidx: dict, cfg: dict) -> dict:
    """Pemegang >=1% (selain AH dan entitasnya) yang muncul di >=2 saham portofolio AH -> {nama: [kode]}."""
    pola = cfg.get("polaNama") or []
    ent = {e["nama"].upper() for e in cfg.get("entitas") or []}
    hit: dict[str, set] = {}
    for r in porto:
        for nm, *_ in (pidx.get(r["t"]) or {}).get("pemegang") or []:
            if cocok_nama(nm, pola) or nm.upper() in ent or PUBLIK_RX.search(nm):
                continue
            hit.setdefault(nm.upper(), set()).add(r["t"])
    return {n: sorted(s) for n, s in sorted(hit.items()) if len(s) >= 2}


def _id(v: float, d: int = 0) -> str:
    """Format angka gaya Indonesia: 1.234,5."""
    return f"{v:,.{d}f}".replace(",", "#").replace(".", ",").replace("#", ".")


BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def _tgl(s: str) -> str:
    """2026-06-30 -> 30 Jun 2026."""
    m = re.match(r"(\d{4})-(\d\d)-(\d\d)$", s or "")
    return f"{int(m.group(3))} {BLN[int(m.group(2)) - 1]} {m.group(1)}" if m else (s or "")


def skor(st: dict, tren: dict | None, jejak: list) -> tuple[int, list[str]]:
    """Skor kemiripan dengan saham pilihan AH (0-100) + alasan."""
    s, why = 0, []
    saham, ff, nf = st.get("saham"), st.get("ff"), st.get("nilaiFloat")
    if saham:
        p = 30 if saham <= 5e8 else 22 if saham <= 1e9 else 12 if saham <= 1.5e9 else 0
        if p:
            s += p
            why.append(f"saham beredar sedikit ({_id(saham / 1e6)} juta lembar)")
    if ff is not None:
        p = 25 if ff <= 15 else 20 if ff <= 25 else 14 if ff <= 30 else 6 if ff <= 40 else 0
        if p:
            s += p
            why.append(f"porsi publik kecil ({_id(ff, 1)}%)")
    if nf:
        p = 20 if nf <= 5e10 else 14 if nf <= 1.5e11 else 8 if nf <= 3e11 else 0
        if p:
            s += p
            why.append(f"nilai float tipis (Rp{_id(nf / 1e9)} M)")
    if tren and tren["ubah"] <= -5:
        s += 10 if tren["ubah"] <= -10 else 5
        why.append(f"jumlah pemegang turun {_id(abs(tren['ubah']), 1)}% dalam ±3 bulan")
    if jejak:
        s += 15
        why.append("ada pemegang yang juga muncul di saham AH: " + ", ".join(j["nama"] for j in jejak))
    return min(s, 100), why


def ringkasan(st: dict, tren: dict | None, lb: list) -> list[str]:
    """Kalimat baku untuk analisa lebih dalam."""
    out = []
    if st.get("saham") and st.get("publik") is not None:
        nilai = f" senilai ±Rp{_id(st['nilaiFloat'] / 1e9, 1)} M" if st.get("nilaiFloat") else ""
        tipis = (" Barang beredar yang tipis membuat harga mudah digerakkan oleh sedikit modal, naik maupun turun."
                 if st["saham"] <= 2e9 else "")
        kira = " (perkiraan dari kapitalisasi dibagi harga)" if st.get("sahamKira") else ""
        out.append(f"Saham beredar {_id(st['saham'] / 1e6)} juta lembar{kira}; porsi publik {_id(st['ff'], 1)}% atau "
                   f"±{_id(st['publik'] / 1e6, 1)} juta lembar{nilai}.{tipis}")
    if tren:
        arah = "turun" if tren["ubah"] < 0 else "naik"
        baca = ("biasanya dibaca sebagai saham terkumpul ke lebih sedikit tangan (akumulasi)" if tren["ubah"] <= -5 else
                "biasanya dibaca sebagai saham menyebar ke ritel (distribusi)" if tren["ubah"] >= 5 else "relatif stabil")
        out.append(f"Jumlah pemegang {arah} dari {_id(tren['lalu'])} ({_tgl(tren['tglLalu'])}) ke {_id(tren['kini'])} ({_tgl(tren['tgl'])}), "
                   f"{'+' if tren['ubah'] > 0 else ''}{_id(tren['ubah'], 1)}%: {baca}.")
    if lb:
        rugi = sum(1 for _, v in lb if v < 0)
        if rugi == len(lb):
            out.append(f"Rugi bersih di {rugi} kuartal terakhir: nilai saham lebih bergantung pada aksi korporasi daripada kinerja.")
        elif rugi:
            out.append(f"Rugi bersih di {rugi} dari {len(lb)} kuartal terakhir.")
        else:
            out.append(f"Laba bersih positif di {len(lb)} kuartal terakhir.")
    return out


def analisa(cfg: dict, pidx: dict, ks: dict, harga: dict, nama: dict, radar: set, batas: int = 60) -> dict:
    porto = portofolio(cfg, pidx)
    rk = rekan(porto, pidx, cfg)
    milik = {r["t"] for r in porto}

    def baris(t):
        k, v = ks.get(t) or {}, pidx.get(t) or {}
        st = struktur(t, k, harga)
        tr = tren_pemegang(v.get("jumlah"))
        jejak = [{"nama": nm, "pct": pct, "di": [x for x in rk[nm.upper()] if x != t]}
                 for nm, pct, *_ in v.get("pemegang") or [] if nm.upper() in rk]
        sk, why = skor(st, tr, jejak)
        lb = laba(k)
        return {"t": t, "nama": nama.get(t, ""), **st, "tren": tr, "laba": lb, "jejak": jejak, "skor": sk, "alasan": why,
                "pemegang": [{"nama": nm, "pct": pct, "jenis": jn} for nm, pct, _, jn in (v.get("pemegang") or [])[:10]],
                "ringkas": ringkasan(st, tr, lb), "radar": t in radar}

    riwayat = {x["t"]: x for x in cfg.get("riwayat") or []}
    for r in porto:
        r.update(baris(r["t"]))
        if r["t"] in riwayat:
            r["riwayat"] = riwayat[r["t"]]
    # Saham yang pernah/masih dipegang di luar daftar >=1% terkini (kurasi berita): struktur kini + status + sumber.
    pernah = []
    for t, x in riwayat.items():
        if t in milik:
            continue
        r = baris(t)
        r.update(status=x.get("status", "disebut media"), ket=x.get("ket", ""), sumber=x.get("sumber") or [])
        pernah.append(r)
    milik |= set(riwayat)
    # Ciri saham pilihan AH (median portofolio).
    ciri = {}
    for f in ("saham", "ff", "nilaiFloat", "mcap"):
        vals = [r[f] for r in porto if r.get(f)]
        ciri[f] = statistics.median(vals) if vals else None
    rows, lain = [], []
    for t in set(ks) | set(pidx):
        if t in milik or t.startswith("X"):        # kode X…: ETF/reksa dana, bukan saham
            continue
        k = ks.get(t) or {}
        st = struktur(t, k, harga)
        if not st["saham"] or st["saham"] > 2e9:
            continue
        if k.get("freeFloat") is None:
            # Bersaham sedikit menurut Key Stats tetapi free float kosong: tampil terpisah, belum diberi skor penuh.
            r = baris(t)
            r.update(alasan=r["alasan"] + ["free float belum ada di Key Stats"], asal="Key Stats Stockbit")
            lain.append(r)
            continue
        if k["freeFloat"] > 40:
            continue
        r = baris(t)
        if r["skor"] >= 50:
            rows.append(r)
    # Kode tanpa Key Stats di server tetapi tercatat bersaham sedikit (data kurasi): tampil dengan catatan free float.
    tamb = cfg.get("sahamSedikit") or {}
    for t, (saham, h) in (tamb.get("data") or {}).items():
        if t in milik or (ks.get(t) or {}).get("saham") or any(x["t"] == t for x in lain):
            continue
        r = baris(t)
        st = struktur(t, {"saham": saham, "hargaKira": h, "freeFloat": None}, harga)
        sk, why = skor(st, r["tren"], r["jejak"])
        r.update(st, skor=sk, alasan=why + ["free float belum ada di data server"],
                 ringkas=[f"Saham beredar {_id(saham / 1e6, 2)} juta lembar menurut screener Stockbit; free float belum diketahui."]
                 + r["ringkas"][1:], kurasi=True, asal=tamb.get("sumber", ""))
        lain.append(r)
    rows.sort(key=lambda r: (-r["skor"], r["nilaiFloat"] or 9e18))
    return {"profil": {k: cfg.get(k) for k in ("nama", "julukan", "peran", "peranSumber", "entitas", "riwayat", "catatan", "asOf")},
            "portofolio": porto, "pernah": pernah, "ciri": ciri, "rekan": [{"nama": n, "di": d} for n, d in rk.items()],
            "dinilai": sum(1 for t in ks if not t.startswith("X") and struktur(t, ks[t] or {}, harga)["saham"]), "rows": rows[:batas],
            "tanpaFF": sorted(lain, key=lambda r: r["saham"]), "tanpaFFSumber": tamb.get("sumber", ""),
            "kurangData": sorted(t for t in set(ks) | set(pidx) if not t.startswith("X") and t not in milik
                                 and (not struktur(t, ks.get(t) or {}, harga)["saham"] or (ks.get(t) or {}).get("freeFloat") is None))}
