"""Harmonic Pattern dari bar harian: pivot zigzag lalu pencocokan rasio Fibonacci tiap pola. Aturan sama dengan
frontend/src/lib/harmonikAlat.js (tab Saham), supaya tab Screening dan chart memberi hasil yang sama.

Pola: Gartley, Bat, Alternate Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0 (lima titik X-A-B-C-D), Three
Drives (enam titik), AB=CD dan Alternate AB=CD (empat titik). Rasio dari materi: Carney, Harmonic Trading Vol. 1;
Astronacci (Cypher, PRZ, konfirmasi, stop, target 0,382/0,618); lembar pola yang dilampirkan pengguna (Alternate Bat,
Shark, 5-0, Three Drives). Target alternatif titik C lalu A dari Maxco. Pola batal bila setelah titik akhir ada
penutupan yang menembus stop. Fungsi murni: masukan bars [{d,o,h,l,c,v}] (v dalam lot), keluaran baris screening.

Arah: bullish bila titik akhir berupa lembah (area potensi berbalik naik), bearish bila puncak.
"""
from __future__ import annotations


# Notasi rasio (sama dengan frontend/src/lib/harmonikAlat.js): b = AB/XA, c = BC/AB, d = AD/XA (D diukur dari A ke arah X),
# bc = CD/BC (proyeksi BC), cx = XC/XA (C melewati A), dxc = CD/XC, dbc = DC/BC (D retracement kaki BC),
# cd = CD/AB (AB=CD di dalam pola; Carney: AB=CD setara syarat minimum setiap pola, Crab memakai 1,27-1,618).
# Rasio mengikuti materi: Carney, Harmonic Trading Vol. 1 (Gartley, Bat, Butterfly, Crab, Deep Crab), Astronacci
# (Cypher), dan lembar pola yang dilampirkan pengguna (Alternate Bat, Shark, 5-0).
POLA = {
    "gartley": {"nama": "Gartley", "b": (0.618, 0.618), "c": (0.382, 0.886), "d": (0.786, 0.786), "bc": (1.13, 1.618), "abcd": (1.0, 1.27),
                "ket": "Pola retracement klasik: B tepat 0,618 XA, D di 0,786 XA. D tidak boleh melewati X."},
    "bat": {"nama": "Bat", "b": (0.382, 0.50), "c": (0.382, 0.886), "d": (0.886, 0.886), "bc": (1.618, 2.618), "abcd": (1.0, 1.27),
            "ket": "Retracement dalam: B di bawah 0,618 XA (ideal 0,382-0,5), D di 0,886 XA. D tidak boleh melewati X."},
    "altbat": {"nama": "Alternate Bat", "b": (0.382, 0.382), "c": (0.382, 0.886), "d": (1.13, 1.13), "bc": (2.0, 3.618), "abcd": (1.0, 1.618),
               "ket": "Varian Bat: B dangkal 0,382 XA, D melewati X sampai 1,13 XA."},
    "butterfly": {"nama": "Butterfly", "b": (0.786, 0.786), "c": (0.382, 0.886), "d": (1.27, 1.414), "bc": (1.618, 2.24), "abcd": (1.0, 1.27),
                  "ket": "Pola ekstensi: B tepat 0,786 XA, D melewati X di 1,27 XA. Muncul di area ekstrem."},
    "crab": {"nama": "Crab", "b": (0.382, 0.618), "c": (0.382, 0.886), "d": (1.618, 1.618), "bc": (2.618, 3.618), "abcd": (1.27, 1.618),
             "ket": "Proyeksi paling ekstrem: D di 1,618 XA. Pembalikan sering tajam, disiplin stop penting."},
    "deepcrab": {"nama": "Deep Crab", "b": (0.886, 0.886), "c": (0.382, 0.886), "d": (1.618, 1.618), "bc": (2.24, 3.618), "abcd": (1.27, 1.618),
                 "ket": "Seperti Crab dengan B dalam di 0,886 XA; D tetap 1,618 XA."},
    "cypher": {"nama": "Cypher", "b": (0.382, 0.618), "cx": (1.272, 1.414), "dxc": (0.786, 0.786),
               "ket": "C melewati A (1,272-1,414 XA); D di 0,786 kaki XC. Muncul di pasar dengan swing kompleks."},
    "shark": {"nama": "Shark", "b": (0.382, 0.886), "c": (1.13, 1.618), "dxc": (0.886, 1.13), "bc": (1.618, 2.24),
              "ket": "C melewati A (1,13-1,618 AB); D kembali ke sekitar level X (0,886-1,13 XC)."},
    "fiveo": {"nama": "5-0", "b": (1.13, 1.618), "c": (1.618, 2.24), "dbc": (0.5, 0.5),
              "ket": "Pola koreksi setelah gerak berlebihan: B melewati X, C melewati A, lalu D di retracement 0,50 kaki BC."},
}
# Pola di luar kerangka X-A-B-C-D: AB=CD (Carney Bab 4) dan Three Drives (lembar pola).
POLA_LAIN = {
    "abcd": {"nama": "AB=CD", "cd": (1.0, 1.0),
             "ket": "Pola empat titik paling dasar: kaki CD sama panjang dengan AB setelah koreksi C 0,382-0,886."},
    "altabcd": {"nama": "Alternate AB=CD", "cd": (1.27, 1.618),
                "ket": "Varian AB=CD: kaki CD memanjang 1,27-1,618 kali AB."},
    "tigadorongan": {"nama": "Three Drives", "dorong": (1.27, 1.618), "level": (1.27, 1.618),
                     "ket": "Tiga dorongan searah; dorongan kedua 1,27-1,618 kali koreksi, dorongan ketiga selesai di 1,27 atau 1,618 kali koreksi."},
}
ABCD_C, ABCD_E = (0.382, 0.886), (1.13, 2.618)
STOP_PRZ = {"altbat", "butterfly", "crab", "deepcrab", "shark"}   # D melewati/menyentuh X: stop di sisi luar PRZ
# Versi aturan pemindai: naikkan setiap kali pola/rasio/aturan berubah. Server memindai ulang saat start bila hasil
# tersimpan (.harmonik.json) dibuat dengan versi lain, tanpa menunggu jadwal malam.
VERSI_ATURAN = 8   # 8: skala zigzag rapat 4–50% setiap 0,5%; 7: skala zigzag harian 20% dan 30% untuk saham bergerak lebar; 6: catatan swing (kaki, swingLemah) dan pola "cek swing" turun peringkat; 5: zigzag pindah pivot yang tertembus, D basi dibuang, skala 4%, umur 30 bar; 4: cek AB=CD (CD/AB) di pola XABCD; 3: AB=CD hanya di PRZ/berbalik; PRZ Three Drives 1,27/1,618
TOL = 0.05            # toleransi relatif batas rasio (±5%)
ABCD_TOL = 0.15       # AB=CD di dalam pola: CD minimal 0,85 AB (kaki CD berakhir di ekstrem swing yang beragam)
PRZ_LEBAR = 0.03      # lebar PRZ = ±3% panjang kaki acuan di sekitar level D
# Ambang zigzag (pembalikan minimal) 4% sampai 50% setiap 0,5%, dari swing kecil ke besar; sama dengan SKALA_POLA.D di
# harmonikAlat.js. Skala yang jarang melewatkan pola karena satu pantulan bisa memecah kaki di satu ambang saja
# (KOTA Nov 2026: Shark 71-210-140-252-50 hanya terbaca di sekitar 30%; AKRA Gartley di 7%).
SKALA = tuple(round(0.04 + j * 0.005, 3) for j in range(93))
MENUJU_MAKS = 12.0    # % jarak harga ke PRZ yang masih ditampilkan sebagai "menuju PRZ"
BERBALIK_BAR = 30     # D terkonfirmasi paling lama sekian bar lalu (sama dengan umurD tab Saham harian)
BAR_SIMPAN = 250      # bar terakhir yang disimpan/dikirim untuk chart analisa
MIN_NILAI = 1e9       # rata-rata nilai transaksi 20 hari (Rp); saham tidak likuid membentuk XABCD yang kurang representatif
# Cara mengenali swing dan jarak candle antarkaki (sama dengan harmonikAlat.js). Carney hal. 129: durasi kaki tidak
# harus sama persis, tetapi setiap bagian pola harus jelas simetris. Pola tetap tampil, diberi catatan, turun peringkat.
KAKI_MIN, KAKI_TIMPANG = 3, 0.2   # kaki < 3 candle atau kaki terpendek < 20% kaki terpanjang: "timpang"
SWING_SISI, AYUN_MIN = 2, 0.05    # swing = puncak/dasar tidak dilewati 2 candle kiri-kanan; ayunan < 5% diabaikan


def nilai_rata(bars: list[dict], n: int = 20) -> float:
    """Rata-rata nilai transaksi harian (Rp) n bar terakhir; volume Stockbit dalam lot (100 lembar)."""
    xs = bars[-n:]
    return sum(b["c"] * b["v"] * 100 for b in xs) / len(xs) if xs else 0.0


def rsi(closes: list[float], n: int = 14) -> list[float | None]:
    """RSI Wilder per bar (None sebelum cukup data)."""
    out: list[float | None] = [None] * len(closes)
    if len(closes) <= n:
        return out
    g = sum(max(closes[i] - closes[i - 1], 0) for i in range(1, n + 1)) / n
    lo = sum(max(closes[i - 1] - closes[i], 0) for i in range(1, n + 1)) / n
    for i in range(n, len(closes)):
        if i > n:
            d = closes[i] - closes[i - 1]
            g = (g * (n - 1) + max(d, 0)) / n
            lo = (lo * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if lo == 0 else 100 - 100 / (1 + g / lo)
    return out


def candle_balik(bars: list[dict], i: int, bull: bool) -> str:
    """Candle pembalikan di bar i: pin bar, engulfing, atau inside/outside bar searah pembalikan ('' bila tidak ada)."""
    if i < 1 or i >= len(bars):
        return ""
    b, a = bars[i], bars[i - 1]
    rng, badan = b["h"] - b["l"], abs(b["c"] - b["o"])
    if rng <= 0:
        return ""
    ekor_bawah, ekor_atas = min(b["o"], b["c"]) - b["l"], b["h"] - max(b["o"], b["c"])
    if bull:
        if ekor_bawah >= 2 * max(badan, rng * 0.05) and ekor_bawah >= 0.6 * rng:
            return "pin bar"
        if a["c"] < a["o"] and b["c"] > b["o"] and b["c"] >= a["o"] and b["o"] <= a["c"]:
            return "bullish engulfing"
        if b["h"] > a["h"] and b["l"] < a["l"] and b["c"] > b["o"]:
            return "outside bar"
    else:
        if ekor_atas >= 2 * max(badan, rng * 0.05) and ekor_atas >= 0.6 * rng:
            return "pin bar"
        if a["c"] > a["o"] and b["c"] < b["o"] and b["c"] <= a["o"] and b["o"] >= a["c"]:
            return "bearish engulfing"
        if b["h"] > a["h"] and b["l"] < a["l"] and b["c"] < b["o"]:
            return "outside bar"
    return ""


def konfirmasi(bars: list[dict], rs: list, B: dict, D: dict, bull: bool) -> list[str]:
    """Konfirmasi di area PRZ (Astronacci): candle pembalikan sejak D, divergence RSI D terhadap B, dan
    tembusnya struktur minor (penutupan melewati puncak/lembah 3 bar sebelum D)."""
    out = []
    for i in range(D["i"], len(bars)):
        c = candle_balik(bars, i, bull)
        if c:
            out.append(f"{c} {bars[i]['d'][:10]}")
            break
    rb, rd = rs[B["i"]], rs[D["i"]]
    if rb is not None and rd is not None:
        if bull and D["p"] < B["p"] and rd > rb:
            out.append(f"divergence RSI (RSI D {rd:.0f} > B {rb:.0f})")
        if not bull and D["p"] > B["p"] and rd < rb:
            out.append(f"divergence RSI (RSI D {rd:.0f} < B {rb:.0f})")
    awal = bars[max(0, D["i"] - 3):D["i"]]
    if awal and D["i"] < len(bars) - 1:
        batas = max(x["h"] for x in awal) if bull else min(x["l"] for x in awal)
        if (bars[-1]["c"] > batas) if bull else (bars[-1]["c"] < batas):
            out.append("struktur minor tembus")
    return out


def _geser(bars: list[dict], out: list[dict], i: int, k: str) -> None:
    """Pivot terakhir bergeser ke candle i; pivot sebelumnya dicek ulang sampai candle i-1 supaya tetap paling ekstrem."""
    if len(out) >= 2:
        for j in range(out[-1]["i"], i):
            if (bars[j]["l"] < out[-2]["p"]) if k == "H" else (bars[j]["h"] > out[-2]["p"]):
                out[-2] = {"i": j, "p": bars[j]["l"] if k == "H" else bars[j]["h"], "k": out[-2]["k"]}
    out[-1] = {"i": i, "p": bars[i]["h"] if k == "H" else bars[i]["l"], "k": k}


def zigzag(bars: list[dict], th: float) -> list[dict]:
    """Pivot bergantian H/L: berganti bila harga berbalik >= th dari ekstrem terakhir. Pivot terakhir = ekstrem
    berjalan (tentatif=True), belum terkonfirmasi pembalikan."""
    n = len(bars)
    if n < 3:
        return []
    out: list[dict] = []
    mode, hi, lo, ext = 0, 0, 0, 0
    for i in range(1, n):
        h, lw = bars[i]["h"], bars[i]["l"]
        if mode == 0:
            if h > bars[hi]["h"]:
                hi = i
            if lw < bars[lo]["l"]:
                lo = i
            if bars[lo]["l"] > 0 and bars[hi]["h"] >= bars[lo]["l"] * (1 + th):
                if lo < hi:
                    out.append({"i": lo, "p": bars[lo]["l"], "k": "L"})
                    mode, ext = 1, hi
                else:
                    out.append({"i": hi, "p": bars[hi]["h"], "k": "H"})
                    mode, ext = -1, lo
        elif mode == 1:
            # Mode naik: ext = puncak sementara sejak lembah terakhir L0 (ext < 0: belum ada). Harga menembus L0 sebelum
            # puncak terkonfirmasi: puncak sementara langsung terkonfirmasi. Outside bar: puncak sementara terkonfirmasi dan
            # low candle ini menjadi lembah berikutnya (dua pivot tidak boleh di candle sama). Sama dengan harmonikAlat.js.
            L0 = out[-1]["p"]
            if ext < 0:
                if lw < L0:
                    _geser(bars, out, i, "L")
                else:
                    ext = i
                continue
            naik, tembus = h >= bars[ext]["h"], lw < L0
            if naik and tembus:
                out.append({"i": ext, "p": bars[ext]["h"], "k": "H"})
                out.append({"i": i, "p": lw, "k": "L"})
                ext = -1
            elif naik:
                ext = i
            elif tembus or lw <= bars[ext]["h"] * (1 - th):
                out.append({"i": ext, "p": bars[ext]["h"], "k": "H"})
                mode, ext = -1, i
        else:
            H0 = out[-1]["p"]
            if ext < 0:
                if h > H0:
                    _geser(bars, out, i, "H")
                else:
                    ext = i
                continue
            turun, tembus = lw <= bars[ext]["l"], h > H0
            if turun and tembus:
                out.append({"i": ext, "p": bars[ext]["l"], "k": "L"})
                out.append({"i": i, "p": h, "k": "H"})
                ext = -1
            elif turun:
                ext = i
            elif tembus or h >= bars[ext]["l"] * (1 + th):
                out.append({"i": ext, "p": bars[ext]["l"], "k": "L"})
                mode, ext = 1, i
    if mode and ext >= 0:   # ext < 0: pivot terakhir ada di candle terakhir dan menjadi ekstrem berjalan
        out.append({"i": ext, "p": bars[ext]["h" if mode == 1 else "l"], "k": "H" if mode == 1 else "L", "tentatif": True})
    elif mode:
        out[-1]["tentatif"] = True
    return out


def _jarak(v: float, rg: tuple[float, float]) -> float:
    """Jarak relatif nilai ke rentang (0 bila di dalam)."""
    if v < rg[0]:
        return (rg[0] - v) / rg[0]
    if v > rg[1]:
        return (v - rg[1]) / rg[1]
    return 0.0


def _dalam(v: float, rg: tuple[float, float], tol: float = TOL) -> bool:
    return _jarak(v, rg) <= tol


def _r3(v):
    return None if v is None else round(v, 3)


def rasio(X: float, A: float, B: float, C: float, D: float | None = None) -> dict:
    xa, ab, bc, xc = abs(A - X), abs(A - B), abs(C - B), abs(C - X)
    # Kaki nol (misalnya C tepat di harga X): rasio tidak terdefinisi (None), pola itu otomatis tidak cocok.
    bagi = lambda a, b: _r3(a / b) if b else None
    return {"b": bagi(ab, xa), "c": bagi(bc, ab), "cx": bagi(xc, xa),
            "d": None if D is None else bagi(abs(A - D), xa), "bc": None if D is None else bagi(abs(D - C), bc),
            "dxc": None if D is None else bagi(abs(D - C), xc), "dbc": None if D is None else bagi(abs(D - C), bc),
            "cd": None if D is None else bagi(abs(D - C), ab)}


def prz_pola(k: str, X: float, A: float, B: float, C: float, tol: float = TOL) -> list[float] | None:
    """Rentang harga D (PRZ) satu pola; None bila rentang rasio D dan proyeksi BC tidak bertemu."""
    p, xa = POLA[k], abs(A - X)
    s = 1 if A > X else -1
    if "d" in p:
        rg, acuan = [A - s * xa * p["d"][0], A - s * xa * p["d"][1]], xa
    elif "dbc" in p:
        rg, acuan = [C + (B - C) * p["dbc"][0], C + (B - C) * p["dbc"][1]], abs(B - C)
    else:
        rg, acuan = [C - (C - X) * p["dxc"][0], C - (C - X) * p["dxc"][1]], abs(C - X)
    rg = sorted(rg)
    if rg[1] - rg[0] < 2 * PRZ_LEBAR * acuan:
        m = (rg[0] + rg[1]) / 2
        rg = [m - PRZ_LEBAR * acuan, m + PRZ_LEBAR * acuan]
    if "bc" in p:
        pr = sorted([C + (B - C) * p["bc"][0] * (1 - tol), C + (B - C) * p["bc"][1] * (1 + tol)])
        lo, hi = max(rg[0], pr[0]), min(rg[1], pr[1])
        if lo > hi:
            return None
        if hi - lo < PRZ_LEBAR * acuan:
            m = (lo + hi) / 2
            return [max(rg[0], m - PRZ_LEBAR * acuan / 2), min(rg[1], m + PRZ_LEBAR * acuan / 2)]
        return [lo, hi]
    return rg


def skor_pola(k: str, r: dict, tol: float = TOL) -> float | None:
    """Jumlah jarak rasio ke rentang pola; None bila ada yang di luar toleransi (proyeksi BC 2x lebih longgar)."""
    p = POLA[k]
    cek = [(r["b"], p["b"], 1), (r["cx"], p["cx"], 1) if "cx" in p else (r["c"], p["c"], 1)]
    if r.get("d") is not None:
        for kunci in ("d", "dxc", "dbc"):
            if kunci in p:
                cek.append((r[kunci], p[kunci], 1))
        if "bc" in p:
            cek.append((r["bc"], p["bc"], 2))
    s = 0.0
    for v, rg, longgar in cek:
        if v is None or _jarak(v, rg) > tol * longgar:
            return None
        s += _jarak(v, rg)
    return round(s, 3)


def _bentuk_ok(k: str, X: float, A: float, B: float, C: float) -> bool:
    s = 1 if A > X else -1
    if (B - A) * s >= 0 or (C - B) * s <= 0:
        return False
    lewat_a = C > A if s > 0 else C < A
    if k == "fiveo":
        return lewat_a and (B < X if s > 0 else B > X)
    return lewat_a if k in ("cypher", "shark") else not lewat_a


def _bulat(v: float) -> float:
    return round(v, 2) if v < 10 else round(v)


def _fraksi(p: float) -> int:
    return 1 if p < 200 else 2 if p < 500 else 5 if p < 2000 else 10 if p < 5000 else 25


def _bulat_arah(t: float, bull: bool) -> float:
    """Target dibulatkan ke fraksi harga BEI ke arah konservatif (bullish ke bawah, bearish ke atas)."""
    f = _fraksi(t)
    return (t // f) * f if bull else -((-t) // f) * f


def _teks(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".").replace(".", ",")


def _rg(rg: tuple[float, float]) -> str:
    return _teks(rg[0]) if rg[0] == rg[1] else f"{_teks(rg[0])}-{_teks(rg[1])}"


def _jendela(pv: list[dict], N: int, n: int):
    """Titik akhir = ekstrem berjalan, atau terkonfirmasi satu sampai dua swing lalu (paling lama BERBALIK_BAR bar)."""
    out = []
    if len(pv) >= N:
        out.append((pv[-N:], "jalan"))
    for m in (1, 2):
        if len(pv) >= N + m:
            w = pv[-N - m:-m]
            if w[-1]["i"] >= n - BERBALIK_BAR and not _basi(pv, w[-1], m):
                out.append((w, "tetap"))
    return out


def _basi(pv: list[dict], akhir: dict, m: int) -> bool:
    """Titik akhir terkonfirmasi sudah basi bila pivot searah sesudahnya lebih ekstrem (harga sudah melewati D)."""
    return any(q["k"] == akhir["k"] and (q["p"] < akhir["p"] if q["k"] == "L" else q["p"] > akhir["p"]) for q in pv[-m:])


def _status(bars: list[dict], mode: str, akhir_pt: dict, prz: list[float], bull: bool, lengkap_ok: bool):
    """Status titik akhir pola: 'prz' (berjalan di PRZ), 'berbalik' (terkonfirmasi di PRZ), atau 'menuju' (belum sampai)."""
    di_prz = prz[0] <= akhir_pt["p"] <= prz[1]
    lewat = akhir_pt["p"] < prz[0] if bull else akhir_pt["p"] > prz[1]
    if di_prz and lengkap_ok:
        return "prz" if mode == "jalan" else "berbalik"
    if mode != "jalan" or lewat or di_prz:
        return None
    akhir, tepi = bars[-1]["c"], (prz[1] if bull else prz[0])
    jarak = (akhir / tepi - 1) * 100
    if jarak * (1 if bull else -1) < 0 or abs(jarak) > MENUJU_MAKS:
        return None
    return "menuju"


def jarak_kaki(kaki: list[int]) -> str | None:
    """Tingkat keseimbangan kaki: "timpang" (kaki < KAKI_MIN candle atau terpendek < KAKI_TIMPANG terpanjang),
    "kurang" (< 0,33), "seimbang", atau None bila kurang dari dua kaki. Sama dengan jarakKaki di harmonikAlat.js."""
    if len(kaki) < 2 or any(n <= 0 for n in kaki):
        return None
    r = round(min(kaki) / max(kaki), 2)
    return "timpang" if min(kaki) < KAKI_MIN or r < KAKI_TIMPANG else "kurang" if r < 0.33 else "seimbang"


def swing_lemah(bars: list[dict], titik: list[dict]) -> list[str]:
    """Catatan titik pola yang bukan swing jelas (puncak/dasar dilewati candle dalam SWING_SISI candle di kiri, atau di
    kanan bila sudah ada SWING_SISI candle) dan ayunan antartitik di bawah AYUN_MIN. Sama dengan swingLemah di
    harmonikAlat.js. titik: [{"n", "i", "p"}]."""
    out = []
    for j, z in enumerate(titik):
        tetangga = titik[j - 1] if j > 0 else (titik[j + 1] if len(titik) > 1 else None)
        if tetangga is None:
            continue
        atas, i = z["p"] > tetangga["p"], z["i"]
        kanan = bars[i + 1:i + 1 + SWING_SISI]
        sisi = bars[max(0, i - SWING_SISI):i] + (kanan if len(kanan) >= SWING_SISI else [])
        if any(b["h"] > bars[i]["h"] for b in sisi) if atas else any(b["l"] < bars[i]["l"] for b in sisi):
            out.append(f"Titik {z['n']} bukan swing {'high' if atas else 'low'} yang jelas: ada candle dalam 2 candle di "
                       f"kiri/kanannya yang {'puncaknya lebih tinggi' if atas else 'dasarnya lebih rendah'}.")
    for a, z in zip(titik, titik[1:]):
        ayun = abs(z["p"] / a["p"] - 1)
        if ayun < AYUN_MIN:
            out.append(f"Ayunan {a['n']}→{z['n']} hanya {str(round(ayun * 100, 1)).replace('.', ',')}%, di bawah 5% "
                       f"(ayunan kecil sebaiknya diabaikan).")
    return out


def _baris(bars, rs, k, nama, bull, status, th, w, label, prz, stop, target, rasio_d, alasan, skor, target_ca=None):
    """Baris screening seragam untuk semua pola; titik akhir yang masih proyeksi tidak ikut dicantumkan."""
    akhir = bars[-1]["c"]
    tepi = prz[1] if bull else prz[0]
    titik = [{"n": nm, "d": bars[x["i"]]["d"][:10], "p": _bulat(x["p"])} for nm, x in zip(label, w)]
    if status == "menuju":
        titik = titik[:-1]
    D = w[-1]
    # Titik nyata pola (tanpa titik akhir bila masih "menuju") untuk catatan jarak candle dan swing.
    nyata = [{"n": nm, "i": x["i"], "p": x["p"]} for nm, x in zip(label, w)][:len(titik)]
    kaki = [b["i"] - a["i"] for a, b in zip(nyata, nyata[1:])]
    return {"pola": k, "nama": nama, "arah": "bullish" if bull else "bearish", "status": status, "harga": akhir,
            "prz": [_bulat(prz[0]), _bulat(prz[1])], "jarak": round(abs((akhir / tepi - 1) * 100), 1) if status == "menuju" else 0.0,
            "reaksi": round((akhir / D["p"] - 1) * 100, 1) if status == "berbalik" else None,
            "rasio": {x: v for x, v in rasio_d.items() if v is not None}, "skala": th, "skor": skor, "titik": titik,
            "target": [_bulat(t) for t in target], "targetCA": target_ca, "stop": _bulat(stop),
            "alasan": alasan, "kaki": kaki, "swingLemah": swing_lemah(bars, nyata),
            "konfirmasi": konfirmasi(bars, rs, w[-3], D, bull) if status != "menuju" else []}


def _batal(bars: list[dict], D: dict, stop: float, bull: bool) -> bool:
    """Pola batal: setelah titik akhir ada penutupan yang menembus stop."""
    return any((b["c"] < stop) if bull else (b["c"] > stop) for b in bars[D["i"] + 1:])


def _cari_xabcd(bars, rs, th, pv, hasil):
    n = len(bars)
    for w, mode in _jendela(pv, 5, n):
        X, A, B, C, D = w
        bull = A["p"] > X["p"]
        for k, p in POLA.items():
            if not _bentuk_ok(k, X["p"], A["p"], B["p"], C["p"]):
                continue
            prz = prz_pola(k, X["p"], A["p"], B["p"], C["p"])
            if not prz:
                continue
            r = rasio(X["p"], A["p"], B["p"], C["p"], D["p"])
            skor = skor_pola(k, r)
            status = _status(bars, mode, D, prz, bull, skor is not None)
            if not status:
                continue
            if status == "menuju":
                skor = skor_pola(k, {**r, "d": None})
                if skor is None:
                    continue
                r = rasio(X["p"], A["p"], B["p"], C["p"])
            d_ref = D["p"] if status != "menuju" else (prz[0] + prz[1]) / 2
            if k in ("gartley", "bat") and (d_ref < X["p"] if bull else d_ref > X["p"]):
                continue
            if k == "fiveo":
                target = [d_ref + (C["p"] - d_ref) * 0.618, C["p"]]
                stop = C["p"] + (B["p"] - C["p"]) * 0.618
            else:
                acuan = C["p"] if k == "cypher" else A["p"]
                target = [d_ref + (acuan - d_ref) * x for x in (0.382, 0.618)]
                stop = (prz[0] if bull else prz[1]) if k in STOP_PRZ else X["p"]
            target = [_bulat_arah(t, bull) for t in target]
            if status != "menuju" and _batal(bars, D, stop, bull):
                continue
            label = {"b": "B AB/XA", "c": "C BC/AB", "cx": "C XC/XA", "d": "D AD/XA", "dxc": "D CD/XC", "dbc": "D DC/BC", "bc": "CD/BC"}
            alasan = [f"{label[x]} {_teks(r[x])} (kriteria {_rg(p[x])})" for x in ("b", "c", "cx", "d", "dxc", "dbc", "bc")
                      if x in p and r.get(x) is not None]
            # AB=CD di dalam pola (Carney: syarat minimum). Pola tidak dibuang, tapi ditandai dan turun peringkat.
            abcd = None
            if "abcd" in p and status != "menuju":
                cd = _r3(abs(D["p"] - C["p"]) / abs(A["p"] - B["p"]))
                ok = _jarak(cd, p["abcd"]) <= ABCD_TOL
                abcd = {"rasio": cd, "kriteria": list(p["abcd"]), "ok": ok}
                alasan.append(f"AB=CD CD/AB {_teks(cd)} (kriteria {_rg(p['abcd'])}" + (")" if ok else ", belum terpenuhi)"))
                skor = round(skor + _jarak(cd, p["abcd"]), 3)
            ca = [_bulat(C["p"]), _bulat(A["p"])] if k not in ("cypher", "fiveo") else None
            row = _baris(bars, rs, k, p["nama"], bull, status, th, w, "XABCD", prz, stop, target, r, alasan, skor, ca)
            if abcd:
                row["abcd"] = abcd
            kunci = (k, row["arah"], B["i"], C["i"], "p" if status == "menuju" else D["i"])
            if kunci not in hasil or row["skor"] < hasil[kunci]["skor"]:
                hasil[kunci] = row


def _cari_abcd(bars, rs, th, pv, hasil):
    n = len(bars)
    for w, mode in _jendela(pv, 4, n):
        A, B, C, D = w
        bull = A["p"] > B["p"]   # A puncak, D lembah: bullish
        ab = B["p"] - A["p"]
        if not ab or C["p"] == B["p"]:   # kaki nol (harga datar): rasio tidak terdefinisi
            continue
        c = _r3(abs(C["p"] - B["p"]) / abs(ab))
        if not _dalam(c, ABCD_C):
            continue
        proy = sorted([C["p"] + (B["p"] - C["p"]) * ABCD_E[0] * (1 - 2 * TOL), C["p"] + (B["p"] - C["p"]) * ABCD_E[1] * (1 + 2 * TOL)])
        for k in ("abcd", "altabcd"):
            p = POLA_LAIN[k]
            rg = sorted([C["p"] + ab * p["cd"][0] * (1 - TOL), C["p"] + ab * p["cd"][1] * (1 + TOL)])
            lo, hi = max(rg[0], proy[0]), min(rg[1], proy[1])
            if lo > hi:
                continue
            prz = [lo, hi]
            cd, e = _r3(abs(D["p"] - C["p"]) / abs(ab)), _r3(abs(D["p"] - C["p"]) / abs(C["p"] - B["p"]))
            status = _status(bars, mode, D, prz, bull, _dalam(cd, p["cd"]) and _dalam(e, ABCD_E, 2 * TOL))
            if not status or status == "menuju":   # AB=CD hanya bila D sudah di PRZ atau berbalik
                continue
            d_ref = D["p"] if status != "menuju" else (lo + hi) / 2
            stop = prz[0] if bull else prz[1]
            if status != "menuju" and _batal(bars, D, stop, bull):
                continue
            target = [_bulat_arah(d_ref + (A["p"] - d_ref) * x, bull) for x in (0.382, 0.618)]
            r = {"c": c} if status == "menuju" else {"c": c, "cd": cd, "bc": e}
            alasan = [f"C BC/AB {_teks(c)} (kriteria {_rg(ABCD_C)})"]
            if status != "menuju":
                alasan += [f"CD/AB {_teks(cd)} (kriteria {_rg(p['cd'])})", f"CD/BC {_teks(e)} (kriteria {_rg(ABCD_E)})"]
            skor = round(_jarak(c, ABCD_C) + (0 if status == "menuju" else _jarak(cd, p["cd"]) + _jarak(e, ABCD_E)), 3)
            row = _baris(bars, rs, k, p["nama"], bull, status, th, w, "ABCD", prz, stop, target, r, alasan, skor)
            kunci = (k, row["arah"], B["i"], C["i"], "p" if status == "menuju" else D["i"])
            if kunci not in hasil or row["skor"] < hasil[kunci]["skor"]:
                hasil[kunci] = row


def _cari_tiga_dorongan(bars, rs, th, pv, hasil):
    n, p = len(bars), POLA_LAIN["tigadorongan"]
    for w, mode in _jendela(pv, 6, n):
        P0, P1, P2, P3, P4, P5 = w
        s = 1 if P1["p"] > P0["p"] else -1
        bull = s < 0   # dorongan naik: pembalikan turun (bearish)
        if not (s * (P3["p"] - P1["p"]) > 0 and s * (P2["p"] - P0["p"]) > 0 and s * (P4["p"] - P2["p"]) > 0):
            continue
        if P1["p"] == P2["p"] or P3["p"] == P4["p"]:   # kaki koreksi nol (harga datar): rasio tidak terdefinisi
            continue
        r1 = _r3(abs(P3["p"] - P2["p"]) / abs(P1["p"] - P2["p"]))
        if not _dalam(r1, p["dorong"]):
            continue
        # PRZ sempit (±PRZ_LEBAR kaki koreksi B) di level 1,27 lalu 1,618; dipakai level pertama yang cocok/belum terlewati.
        r2, kaki_b = _r3(abs(P5["p"] - P4["p"]) / abs(P3["p"] - P4["p"])), abs(P3["p"] - P4["p"])
        status = prz = lv = None
        for L in p["level"]:
            pusat = P4["p"] + (P3["p"] - P4["p"]) * L
            rg = [pusat - PRZ_LEBAR * kaki_b, pusat + PRZ_LEBAR * kaki_b]
            status = _status(bars, mode, P5, rg, bull, True)
            if status:
                prz, lv = rg, L
                break
        if not status:
            continue
        d_ref = P5["p"] if status != "menuju" else (prz[0] + prz[1]) / 2
        stop = prz[0] if bull else prz[1]
        if status != "menuju" and _batal(bars, P5, stop, bull):
            continue
        target = [_bulat_arah(d_ref + (P0["p"] - d_ref) * x, bull) for x in (0.382, 0.618)]
        r = {"r1": r1} if status == "menuju" else {"r1": r1, "r2": r2}
        alasan = [f"Dorongan 2 {_teks(r1)} x koreksi (kriteria {_rg(p['dorong'])})"]
        if status != "menuju":
            alasan.append(f"Dorongan 3 {_teks(r2)} x koreksi (kriteria {_teks(lv)})")
        skor = round(_jarak(r1, p["dorong"]) + (0 if status == "menuju" else abs(r2 / lv - 1)), 3)
        row = _baris(bars, rs, "tigadorongan", p["nama"], bull, status, th, w, ["0", "1", "A", "2", "B", "3"], prz, stop, target, r, alasan, skor)
        kunci = ("tigadorongan", row["arah"], P2["i"], P4["i"], "p" if status == "menuju" else P5["i"])
        if kunci not in hasil or row["skor"] < hasil[kunci]["skor"]:
            hasil[kunci] = row


def cari(bars: list[dict], skala: tuple[float, ...] = SKALA, min_nilai: float = MIN_NILAI) -> list[dict]:
    """Pola harmonik aktif di ujung data (XABCD termasuk 5-0, Three Drives, AB=CD): status "prz" (titik akhir sedang di
    PRZ), "berbalik" (titik akhir terkonfirmasi di PRZ dalam BERBALIK_BAR bar terakhir), atau "menuju" (titik akhir belum
    terbentuk, harga bergerak ke PRZ). Aturan sama dengan frontend/src/lib/harmonikAlat.js."""
    if len(bars) < 30 or nilai_rata(bars) < min_nilai:
        return []
    rs = rsi([b["c"] for b in bars])
    hasil: dict[tuple, dict] = {}
    for th in skala:
        pv = zigzag(bars, th)
        _cari_xabcd(bars, rs, th, pv, hasil)
        _cari_tiga_dorongan(bars, rs, th, pv, hasil)
        _cari_abcd(bars, rs, th, pv, hasil)
    urut, kelas = {"prz": 0, "berbalik": 1, "menuju": 2}, {"abcd": 2, "altabcd": 2, "tigadorongan": 1}
    cek = lambda r: 1 if jarak_kaki(r["kaki"]) == "timpang" or r["swingLemah"] else 0   # pola "cek swing" turun peringkat
    return sorted(hasil.values(), key=lambda r: (urut[r["status"]], kelas.get(r["pola"], 0), cek(r), r["jarak"], r["skor"]))[:4]


def ringkas_pola() -> list[dict]:
    """Tabel rasio untuk tampilan screening (sama dengan materi)."""
    out = []
    for k, p in POLA.items():
        out.append({"k": k, "nama": p["nama"], "ket": p["ket"], **{x: list(p[x]) for x in ("b", "c", "d", "bc", "cx", "dxc", "dbc") if x in p}})
    for k, p in POLA_LAIN.items():
        out.append({"k": k, "nama": p["nama"], "ket": p["ket"]})
    return out
