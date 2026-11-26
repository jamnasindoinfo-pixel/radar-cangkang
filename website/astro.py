"""Astronacci: siklus bulan (Financial Astrology) + Fibonacci harga & waktu untuk IHSG.

- Fase bulan (bulan baru, kuartal pertama, purnama, kuartal akhir) dihitung dengan algoritme Meeus
  (Astronomical Algorithms bab 49, suku koreksi utama; galat beberapa menit), dikonversi ke WIB.
- Fibonacci harga: retracement & ekstensi dari ayunan besar 1 tahun dan ayunan terakhir.
- Fibonacci waktu: hitungan 8, 13, 21, 34, 55, 89, 144 hari bursa dari titik balik utama.
- Jendela waktu: tanggal Fibonacci yang berdekatan (±2 hari bursa) dengan fase bulan utama.
- Uji historis 1 tahun: seberapa sering titik balik IHSG terjadi di sekitar bulan baru/purnama dibanding hari acak,
  dan rata-rata return 5 hari setelahnya. Hasilnya ditampilkan apa adanya (bisa tidak signifikan).
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

FASE = {0.0: "Bulan baru", 0.25: "Kuartal pertama", 0.5: "Purnama", 0.75: "Kuartal akhir"}
FIB_T = (8, 13, 21, 34, 55, 89, 144)
FIB_RET = (0.236, 0.382, 0.5, 0.618, 0.786)
FIB_EXT = (1.272, 1.618)
WIB = timezone(timedelta(hours=7))


def _jde_phase(k: float) -> float:
    """JDE fase bulan untuk k (bilangan bulat + 0/.25/.5/.75), Meeus bab 49."""
    T = k / 1236.85
    jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3
    E = 1 - 0.002516 * T - 0.0000074 * T * T
    r = math.radians
    M = r((2.5534 + 29.10535670 * k - 0.0000014 * T * T) % 360)
    Mp = r((201.5643 + 385.81693528 * k + 0.0107582 * T * T) % 360)
    F = r((160.7108 + 390.67050284 * k - 0.0016118 * T * T) % 360)
    Om = r((124.7746 - 1.56375588 * k + 0.0020672 * T * T) % 360)
    f = k % 1
    if f in (0.0, 0.5):
        a = (-0.40720, -0.40614) if f == 0 else (-0.40614, -0.40614)
        c = -0.40720 if f == 0 else -0.40614
        s1 = 0.17241 if f == 0 else 0.17302
        s2 = 0.01608 if f == 0 else 0.01614
        s3 = 0.01039 if f == 0 else 0.01043
        s4 = 0.00739 if f == 0 else 0.00734
        s5 = -0.00514 if f == 0 else -0.00515
        corr = (c * math.sin(Mp) + s1 * E * math.sin(M) + s2 * math.sin(2 * Mp) + s3 * math.sin(2 * F)
                + s4 * E * math.sin(Mp - M) + s5 * E * math.sin(Mp + M) + 0.00208 * E * E * math.sin(2 * M)
                - 0.00111 * math.sin(Mp - 2 * F) - 0.00057 * math.sin(Mp + 2 * F) + 0.00056 * E * math.sin(2 * Mp + M)
                - 0.00042 * math.sin(3 * Mp) + 0.00042 * E * math.sin(M + 2 * F) - 0.00017 * math.sin(Om))
        del a
    else:
        corr = (-0.62801 * math.sin(Mp) + 0.17172 * E * math.sin(M) - 0.01183 * E * math.sin(Mp + M)
                + 0.00862 * math.sin(2 * Mp) + 0.00804 * math.sin(2 * F) + 0.00454 * E * math.sin(Mp - M)
                + 0.00204 * E * E * math.sin(2 * M) - 0.00180 * math.sin(Mp - 2 * F) - 0.00070 * math.sin(Mp + 2 * F)
                - 0.00017 * math.sin(Om))
        W = 0.00306 - 0.00038 * E * math.cos(M) + 0.00026 * math.cos(Mp) - 0.00002 * math.cos(Mp - M) \
            + 0.00002 * math.cos(Mp + M) + 0.00002 * math.cos(2 * F)
        corr += W if f == 0.25 else -W
    return jde + corr


def _jd_to_wib(jd: float) -> datetime:
    # JDE ≈ JD (selisih TT-UT ~70 detik diabaikan pada resolusi harian).
    return (datetime(2000, 1, 1, 12, tzinfo=timezone.utc) + timedelta(days=jd - 2451545.0)).astimezone(WIB)


def moon_phases(start: date, end: date) -> list[dict]:
    """Seluruh fase bulan utama di antara start..end (WIB)."""
    k0 = math.floor((start.year + (start.timetuple().tm_yday - 1) / 365.25 - 2000) * 12.3685) - 1
    out = []
    k = k0
    while True:
        for f in (0.0, 0.25, 0.5, 0.75):
            t = _jd_to_wib(_jde_phase(k + f))
            if t.date() > end:
                return out
            if t.date() >= start:
                out.append({"tgl": t.strftime("%Y-%m-%d"), "jam": t.strftime("%H:%M"), "fase": FASE[f], "utama": f in (0.0, 0.5)})
        k += 1


def moon_declination(day: date) -> float:
    """Deklinasi bulan (derajat) pukul 12.00 WIB, suku utama Meeus bab 47 (galat ~0,3°, cukup untuk titik ekstrem harian)."""
    jd = 2451545.0 + (datetime(day.year, day.month, day.day, 5, tzinfo=timezone.utc) - datetime(2000, 1, 1, 12, tzinfo=timezone.utc)).total_seconds() / 86400
    T = (jd - 2451545.0) / 36525
    r = math.radians
    Lp = 218.3164477 + 481267.88123421 * T
    D = r(297.8501921 + 445267.1114034 * T)
    M = r(357.5291092 + 35999.0502909 * T)
    Mp = r(134.9633964 + 477198.8675055 * T)
    F = r(93.2720950 + 483202.0175233 * T)
    lam = r(Lp + 6.289 * math.sin(Mp) + 1.274 * math.sin(2 * D - Mp) + 0.658 * math.sin(2 * D) + 0.214 * math.sin(2 * Mp)
            - 0.186 * math.sin(M) - 0.114 * math.sin(2 * F))
    bet = r(5.128 * math.sin(F) + 0.281 * math.sin(Mp + F) + 0.278 * math.sin(Mp - F) + 0.173 * math.sin(2 * D - F))
    eps = r(23.439291 - 0.0130042 * T)
    return math.degrees(math.asin(math.sin(bet) * math.cos(eps) + math.cos(bet) * math.sin(eps) * math.sin(lam)))


def declination_events(start: date, end: date) -> list[dict]:
    """Deklinasi maksimum utara/selatan dan saat bulan melintasi ekuator langit (deklinasi 0°)."""
    days = [start + timedelta(days=i) for i in range(-1, (end - start).days + 2)]
    dec = [moon_declination(x) for x in days]
    out = []
    for i in range(1, len(days) - 1):
        if not (start <= days[i] <= end):
            continue
        if dec[i] > dec[i - 1] and dec[i] >= dec[i + 1]:
            out.append({"tgl": days[i].isoformat(), "jenis": "Deklinasi maksimum utara", "v": round(dec[i], 1)})
        elif dec[i] < dec[i - 1] and dec[i] <= dec[i + 1]:
            out.append({"tgl": days[i].isoformat(), "jenis": "Deklinasi maksimum selatan", "v": round(dec[i], 1)})
        if dec[i - 1] * dec[i] < 0:
            out.append({"tgl": days[i].isoformat(), "jenis": "Melintasi ekuator", "v": round(dec[i], 1)})
    return out


def time_clusters(start: date, end: date, fib_dates: list[dict] | None = None, tol: int = 2) -> list[dict]:
    """Time cluster: tanggal yang berdekatan (±tol hari kalender) dengan >= 2 jenis siklus berbeda:
    fase bulan utama (bulan baru/purnama), titik deklinasi bulan, dan hitungan waktu Fibonacci."""
    ev = [{"tgl": f["tgl"], "jenis": f["fase"], "grup": "fase"} for f in moon_phases(start, end) if f["utama"]]
    ev += [{"tgl": e["tgl"], "jenis": e["jenis"], "grup": "deklinasi"} for e in declination_events(start, end)]
    ev += [{"tgl": w["tgl"], "jenis": f"Fibonacci {w['hitungan']} hari ({w['dari']})", "grup": "fibonacci"} for w in (fib_dates or [])]
    ev.sort(key=lambda e: e["tgl"])
    out, used = [], set()
    for i, e in enumerate(ev):
        if i in used:
            continue
        t0 = date.fromisoformat(e["tgl"])
        grp = [j for j, x in enumerate(ev) if abs((date.fromisoformat(x["tgl"]) - t0).days) <= tol]
        kinds = {ev[j]["grup"] for j in grp}
        if len(kinds) >= 2:
            used.update(grp)
            ds = sorted(date.fromisoformat(ev[j]["tgl"]) for j in grp)
            pusat = ds[len(ds) // 2]
            out.append({"tgl": pusat.isoformat(), "dari": ds[0].isoformat(), "sampai": ds[-1].isoformat(),
                        "siklus": [ev[j]["jenis"] for j in grp], "kekuatan": len(grp)})
    return out


def _trading_days_after(d: date, n: int) -> date:
    """Tanggal n hari bursa (Senin–Jumat) setelah d; libur bursa diabaikan (perkiraan)."""
    x = d
    while n > 0:
        x += timedelta(days=1)
        if x.weekday() < 5:
            n -= 1
    return x


def _pivots(c: list[float], w: int = 5) -> list[tuple[int, str]]:
    out = []
    for i in range(w, len(c) - w):
        seg = c[i - w:i + w + 1]
        if c[i] == max(seg):
            out.append((i, "puncak"))
        elif c[i] == min(seg):
            out.append((i, "lembah"))
    return out


def fib_levels(hi: float, lo: float, naik: bool) -> list[dict]:
    """Retracement & ekstensi. naik=True: ayunan lembah→puncak (retracement di bawah puncak)."""
    rng = hi - lo
    out = []
    for r in FIB_RET:
        out.append({"rasio": r, "jenis": "retracement", "v": round(hi - rng * r if naik else lo + rng * r)})
    for e in FIB_EXT:
        out.append({"rasio": e, "jenis": "ekstensi", "v": round(lo + rng * e if naik else hi - rng * e)})
    return out


def projection(p0: float, last: date, fase: list[dict], uji: list[dict], support: list[int], resist: list[int], ayunan: dict) -> dict:
    """Jalur proyeksi: dari harga kini melewati bulan baru/purnama berikutnya; tiap fase menggeser harga sebesar median
    return 5 hari setelah fase itu (uji historis), dibatasi level Fibonacci terdekat. Bias & skenario dari arah jalur."""
    med = {u["fase"]: u["median5"] for u in uji}
    utama = [f for f in fase if f["utama"] and date.fromisoformat(f["tgl"]) > last][:4]
    lo_b = support[-1] if support else p0 * 0.85
    hi_b = resist[-1] if resist else p0 * 1.15
    jalur, harga = [{"tgl": last.isoformat(), "v": round(p0)}], p0
    for f in utama:
        t = date.fromisoformat(f["tgl"])
        jalur.append({"tgl": t.isoformat(), "v": round(harga), "fase": f["fase"]})
        harga = min(hi_b, max(lo_b, harga * (1 + (med.get(f["fase"]) or 0) / 100)))
        jalur.append({"tgl": _trading_days_after(t, 5).isoformat(), "v": round(harga)})
    ubah = (harga / p0 - 1) * 100
    bias = "naik" if ubah > 0.5 else "turun" if ubah < -0.5 else "mendatar"
    s1, r1 = (support[0] if support else None), (resist[0] if resist else None)
    s2, r2 = (support[1] if len(support) > 1 else None), (resist[1] if len(resist) > 1 else None)
    tgl = utama[-1]["tgl"] if utama else None
    n = lambda v: f"{v:,}".replace(",", ".")
    if bias == "naik":
        sk = [{"nama": "Skenario utama", "t": f"Menguat menuju resistance Fibonacci {n(r1)}" + (f", lalu {n(r2)}" if r2 else "") + (f", selama bertahan di atas {n(s1)}." if s1 else ".") if r1 else "Menguat bertahap."},
              {"nama": "Batal bila", "t": f"Ditutup di bawah {n(s1)}" + (f"; ruang turun ke {n(s2)}." if s2 else ".") if s1 else "Harga jebol dasar ayunan."}]
    elif bias == "turun":
        sk = [{"nama": "Skenario utama", "t": f"Melemah menguji support Fibonacci {n(s1)}" + (f", lalu {n(s2)}" if s2 else "") + (f", selama tertahan di bawah {n(r1)}." if r1 else ".") if s1 else "Melemah bertahap."},
              {"nama": "Batal bila", "t": f"Ditutup di atas {n(r1)}" + (f"; ruang naik ke {n(r2)}." if r2 else ".") if r1 else "Harga tembus puncak ayunan."}]
    else:
        sk = [{"nama": "Skenario utama", "t": f"Bergerak mendatar di kisaran {n(s1)}–{n(r1)}." if r1 and s1 else "Mendatar."},
              {"nama": "Pemicu arah", "t": "Tembus atas kisaran membuka ruang naik; jebol bawah membuka ruang turun."}]
    return {"bias": bias, "ubah": round(ubah, 2), "target": round(harga), "sampai": tgl, "jalur": jalur, "skenario": sk,
            "ayunan": f"{ayunan['arah']} {n(ayunan['rendah'])}–{n(ayunan['tinggi'])}",
            "cara": "Tiap bulan baru/purnama berikutnya menggeser harga sebesar median return 5 hari setelah fase yang sama dalam 1 tahun terakhir, "
                    "dibatasi level Fibonacci terluar. Bias = arah jalur sampai fase keempat."}


def rekomendasi(a: dict, ts: dict | None = None, sent: dict | None = None) -> dict:
    """Rekomendasi tindakan IHSG dari Astronacci (time cluster + level Fibonacci), dikonfirmasi Time Series & sentimen."""
    p0, sup, res = a["harga"], a["support"], a["resistance"]
    s1, s2 = (sup + [None, None])[:2]
    r1, r2 = (res + [None, None])[:2]
    n = lambda v: "–" if v is None else f"{v:,}".replace(",", ".")
    kl = a.get("klaster") or []
    k0 = kl[0] if kl else None
    bias_a = a["proyeksi"]["bias"]
    ts_ubah = None
    if ts and ts.get("proyeksi"):
        ts_ubah = next((x["ubah"] for x in ts["proyeksi"] if x["h"] == 21), None)
    bias_t = None if ts_ubah is None else "naik" if ts_ubah > 0.5 else "turun" if ts_ubah < -0.5 else "mendatar"
    arah_s = (sent or {}).get("arah")
    suara = [x for x in (bias_a, bias_t, {"positif": "naik", "negatif": "turun"}.get(arah_s, "mendatar")) if x]
    naik, turun = suara.count("naik"), suara.count("turun")
    jarak_s1 = (p0 / s1 - 1) * 100 if s1 else None
    if k0 and k0["label"] == "Time support" and naik >= turun:
        tindakan = "Akumulasi bertahap"
        detail = (f"Masuk bertahap di sekitar time support {k0['tgl'][8:]}/{k0['tgl'][5:7]} pada area {n(s1)}–{n(round(p0))}; "
                  f"batas risiko bila ditutup di bawah {n(s2 or s1)}; target {n(r1)} lalu {n(r2)} menuju time cluster berikutnya.")
    elif k0 and k0["label"] == "Time resistance" and turun >= naik:
        tindakan = "Kurangi posisi / ambil untung"
        detail = (f"Kurangi posisi menjelang time resistance {k0['tgl'][8:]}/{k0['tgl'][5:7]}, terutama bila harga mendekati {n(r1)}; "
                  f"masuk kembali di support {n(s1)} bila bertahan.")
    elif naik > turun:
        tindakan = "Beli saat koreksi"
        detail = f"Bias naik, tetapi tunggu harga mendekati support {n(s1)} untuk rasio untung-rugi lebih baik; target {n(r1)}, batas risiko di bawah {n(s2 or s1)}."
    elif turun > naik:
        tindakan = "Tunggu / defensif"
        detail = f"Bias turun: hindari menambah posisi sampai harga bertahan di atas {n(r1)} atau menyentuh support {n(s1)} pada time support berikutnya."
    else:
        tindakan = "Netral, perdagangan rentang"
        detail = f"Sinyal belum searah: beli dekat {n(s1)}, jual dekat {n(r1)}; keluar bila salah satu batas jebol."
    konfirmasi = [
        {"nama": "Astronacci (fase bulan + Fibonacci)", "arah": bias_a},
        {"nama": "Time Series (gabungan model, 1 bulan)", "arah": bias_t or "–", "nilai": ts_ubah},
        {"nama": "Sentimen berita IHSG", "arah": arah_s or "–"},
    ]
    keyakinan = "tinggi" if max(naik, turun) == 3 else "sedang" if max(naik, turun) == 2 else "rendah"
    return {"tindakan": tindakan, "detail": detail, "konfirmasi": konfirmasi, "keyakinan": keyakinan,
            "jarakSupport": None if jarak_s1 is None else round(jarak_s1, 1),
            "catatan": "Rekomendasi otomatis untuk IHSG secara umum (bukan saham tertentu). Gunakan batas risiko; siklus waktu bersifat perkiraan ±2 hari."}


def build(bars: list[dict], today: date | None = None) -> dict | None:
    bars = [b for b in bars if b.get("c")]
    if len(bars) < 120:
        return None
    today = today or datetime.now(WIB).date()
    c = [b["c"] for b in bars]
    d = [date.fromisoformat(b["d"][:10]) for b in bars]
    p0 = c[-1]

    # Ayunan besar 1 tahun & ayunan terakhir (60 hari).
    ih, il = max(range(len(c)), key=lambda i: bars[i]["h"]), min(range(len(c)), key=lambda i: bars[i]["l"])
    hi, lo = bars[ih]["h"], bars[il]["l"]
    naik_besar = il < ih
    r0 = len(c) - 60
    jh = max(range(r0, len(c)), key=lambda i: bars[i]["h"])
    jl = min(range(r0, len(c)), key=lambda i: bars[i]["l"])
    hi2, lo2 = bars[jh]["h"], bars[jl]["l"]
    naik_kini = jl < jh
    ayunan = [
        {"nama": "Ayunan besar 1 tahun", "dari": d[il if naik_besar else ih].isoformat(), "ke": d[ih if naik_besar else il].isoformat(),
         "tinggi": round(hi), "rendah": round(lo), "arah": "naik" if naik_besar else "turun", "level": fib_levels(hi, lo, naik_besar)},
        {"nama": "Ayunan terakhir (60 hari)", "dari": d[jl if naik_kini else jh].isoformat(), "ke": d[jh if naik_kini else jl].isoformat(),
         "tinggi": round(hi2), "rendah": round(lo2), "arah": "naik" if naik_kini else "turun", "level": fib_levels(hi2, lo2, naik_kini)},
    ]
    # Level terdekat di atas/bawah harga kini (gabungan dua ayunan).
    # Level = retracement/ekstensi + titik puncak/lembah ayunan itu sendiri (0% dan 100%).
    semua = sorted({x["v"] for a in ayunan for x in a["level"]} | {a[k] for a in ayunan for k in ("tinggi", "rendah")})
    support = [v for v in semua if v < p0][-2:][::-1]
    resist = [v for v in semua if v > p0][:2]

    # Fibonacci waktu dari titik balik utama (puncak/lembah 1 tahun & ayunan terakhir).
    jangkar = {d[ih]: "puncak 1 tahun", d[il]: "lembah 1 tahun", d[jh]: "puncak 60 hari", d[jl]: "lembah 60 hari"}
    akhir = today + timedelta(days=75)
    fase = moon_phases(today - timedelta(days=3), akhir)
    utama = [date.fromisoformat(f["tgl"]) for f in fase if f["utama"]]
    waktu = []
    for a, nm in jangkar.items():
        for n in FIB_T:
            t = _trading_days_after(a, n)
            if today <= t <= akhir:
                dekat = min(utama, key=lambda u: abs((u - t).days)) if utama else None
                cocok = dekat is not None and abs((dekat - t).days) <= 3
                waktu.append({"tgl": t.isoformat(), "dari": nm, "hitungan": n, "bulan": dekat.isoformat() if cocok else None})
    waktu.sort(key=lambda x: x["tgl"])
    jendela = [w for w in waktu if w["bulan"]]

    # Uji historis: titik balik (pivot w=3) dalam ±2 hari bursa dari bulan baru/purnama vs peluang hari acak.
    hist = moon_phases(d[0], d[-1])
    idx = {x: i for i, x in enumerate(d)}

    def near_idx(t: date):
        for k in range(0, 4):
            for s in (t + timedelta(days=k), t - timedelta(days=k)):
                if s in idx:
                    return idx[s]
        return None
    piv = {i for i, _ in _pivots(c)}
    base_rate = len(piv) / max(1, len(c) - 6)
    rows = {}
    for f in hist:
        if not f["utama"]:
            continue
        i = near_idx(date.fromisoformat(f["tgl"]))
        if i is None or i < 3 or i + 5 >= len(c):
            continue
        r = rows.setdefault(f["fase"], {"n": 0, "balik": 0, "ret": []})
        r["n"] += 1
        r["balik"] += any(j in piv for j in range(i - 2, i + 3))
        r["ret"].append((c[i + 5] / c[i] - 1) * 100)
    # Peluang hari acak berada dalam ±2 hari dari titik balik = 1 - (1 - base)^5.
    acak = (1 - (1 - base_rate) ** 5) * 100
    uji = []
    for nm, r in rows.items():
        if not r["n"]:
            continue
        s = sorted(r["ret"])
        uji.append({"fase": nm, "n": r["n"], "balik": round(r["balik"] / r["n"] * 100), "acak": round(acak),
                    "ret5": round(sum(r["ret"]) / len(r["ret"]), 2), "naik5": round(sum(x > 0 for x in r["ret"]) / len(r["ret"]) * 100),
                    "median5": round(s[len(s) // 2], 2)})
    lebih = [u for u in uji if u["balik"] - u["acak"] >= 10 and u["n"] >= 8]
    kesimpulan = (
        "Dalam 1 tahun terakhir, titik balik IHSG di sekitar " + " dan ".join(u["fase"].lower() for u in lebih)
        + " lebih sering dari hari acak; jendela waktu di bawah layak dipantau sebagai konfirmasi, bukan sinyal tunggal."
        if lebih else
        "Dalam 1 tahun terakhir, titik balik IHSG di sekitar bulan baru/purnama tidak lebih sering dari hari acak "
        "(selisih < 10 poin persentase). Siklus bulan dipakai sebagai penanda waktu tambahan; keputusan tetap bertumpu pada level Fibonacci dan konfirmasi harga."
    )
    nxt = [f for f in fase if date.fromisoformat(f["tgl"]) >= today][:6]

    # Time cluster ke depan; label berselang-seling mulai dari arah 10 hari terakhir: harga yang sedang turun menuju
    # klaster = calon time support (dasar), yang sedang naik = calon time resistance (puncak).
    klaster = [k for k in time_clusters(today, akhir, waktu) if k["tgl"] >= today.isoformat()][:6]
    turun10 = c[-1] < c[-11]
    for i, k in enumerate(klaster):
        sup = turun10 if i % 2 == 0 else not turun10
        k["label"] = "Time support" if sup else "Time resistance"
    # Uji historis: klaster bulan (fase + deklinasi) 1 tahun lalu vs titik balik ±2 hari bursa.
    kh = time_clusters(d[0], d[-1])
    hit = 0
    nk = 0
    for k in kh:
        i = near_idx(date.fromisoformat(k["tgl"]))
        if i is None or i < 5 or i + 5 >= len(c):
            continue
        nk += 1
        hit += any(j in piv for j in range(i - 2, i + 3))
    uji_klaster = {"n": nk, "balik": round(hit / nk * 100) if nk else None, "acak": round(acak)}
    dekl = declination_events(today, today + timedelta(days=45))
    proy = projection(p0, d[-1], fase, uji, support, resist, ayunan[1])
    return {"tanggal": bars[-1]["d"], "harga": p0, "ayunan": ayunan, "support": support, "resistance": resist, "proyeksi": proy,
            "klaster": klaster, "ujiKlaster": uji_klaster, "deklinasi": dekl,
            "riwayat": [{"d": b["d"][:10], "c": b["c"], "h": b["h"], "l": b["l"]} for b in bars[-120:]],
            "fase": nxt, "waktu": waktu[:14], "jendela": jendela[:8], "uji": uji, "acak": round(acak),
            "kesimpulan": kesimpulan,
            "catatan": "Fase bulan dihitung astronomis (Meeus, WIB). Hitungan hari bursa mengabaikan libur nasional, sehingga tanggal bisa bergeser 1–2 hari. "
                       "Financial astrology belum terbukti secara ilmiah; uji historis di atas ditampilkan agar keandalannya bisa dinilai sendiri."}
