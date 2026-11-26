"""Time Series: model runtun waktu klasik untuk memproyeksikan IHSG (tanpa pustaka luar).

Model dihitung pada log harga penutupan harian 1 tahun:
  AR(p)        - return hari ini dipengaruhi return p hari sebelumnya (p dipilih AIC, OLS)
  MA(1)        - return dipengaruhi kejutan (residual) hari sebelumnya (conditional least squares)
  ARMA(1,1)    - pada deviasi log harga dari rata-ratanya (asumsi stasioner: harga kembali ke rata-rata)
  ARIMA(1,1,1) - ARMA(1,1) pada selisih log harga (differencing d=1, data non-stasioner)
  SARIMA       - ARIMA(1,1,0) + komponen musiman mingguan (lag 5 hari bursa) + kecenderungan bulan kalender (10 tahun)
  Pemulusan eksponensial - Simple (SES), Holt linear (teredam), Holt-Winters aditif (musim 5 hari)
  Theta        - SES + separuh tren linier (pemenang kompetisi M3)
  Regresi tren - garis tren 60 hari diteruskan
  Random walk + drift - patokan dasar; model yang galatnya lebih besar dari ini tidak menambah informasi
  GARCH(1,1)   - bukan model arah: memperkirakan volatilitas ke depan untuk lebar kisaran proyeksi

Setiap model diuji mundur (walk-forward) pada 40 hari terakhir: galat rata-rata (MAPE) 1 hari & 5 hari dan
ketepatan arah 1 hari. Proyeksi gabungan = rata-rata tertimbang (bobot 1/MAPE 5 hari), lalu ditambah faktor
sentimen berita, flow asing, dan musiman bulan. Ini perkiraan statistik, bukan kepastian.
"""
from __future__ import annotations

import math

UJI = 40          # jumlah titik uji mundur
H = (1, 5, 21)    # horizon proyeksi: esok, 1 minggu, 1 bulan (hari bursa)


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _sd(xs):
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / max(1, len(xs) - 1)) if len(xs) > 1 else 0.0


def _ols(X: list[list[float]], y: list[float]) -> list[float] | None:
    """Kuadrat terkecil biasa lewat persamaan normal (eliminasi Gauss)."""
    k = len(X[0])
    A = [[sum(r[i] * r[j] for r in X) for j in range(k)] + [sum(r[i] * v for r, v in zip(X, y))] for i in range(k)]
    for c in range(k):
        p = max(range(c, k), key=lambda r: abs(A[r][c]))
        if abs(A[p][c]) < 1e-12:
            return None
        A[c], A[p] = A[p], A[c]
        for r in range(k):
            if r != c:
                f = A[r][c] / A[c][c]
                A[r] = [a - f * b for a, b in zip(A[r], A[c])]
    return [A[i][k] / A[i][i] for i in range(k)]


# ---------- model: masing-masing mengembalikan fungsi ramalan log harga h langkah & sigma residual return ----------

def m_ar(y: list[float]) -> dict:
    r = [b - a for a, b in zip(y, y[1:])]
    best = None
    for p in range(1, 6):
        X = [[1.0] + [r[t - i] for i in range(1, p + 1)] for t in range(p, len(r))]
        Y = r[p:]
        b = _ols(X, Y)
        if not b:
            continue
        res = [v - sum(bi * xi for bi, xi in zip(b, x)) for x, v in zip(X, Y)]
        s2 = max(1e-12, sum(e * e for e in res) / len(res))
        aic = len(res) * math.log(s2) + 2 * (p + 1)
        if not best or aic < best[0]:
            best = (aic, p, b, math.sqrt(s2))
    _, p, b, sig = best

    def f(h):
        rr, out, lv = r[-p:], [], y[-1]
        for _ in range(h):
            nx = b[0] + sum(b[i] * rr[-i] for i in range(1, p + 1))
            rr = rr + [nx]
            lv += nx
            out.append(lv)
        return out
    return {"f": f, "sig": sig, "param": f"p={p}, φ1={b[1]:+.3f}"}


def _css_ma(r: list[float], mu: float, th: float, phi: float = 0.0) -> tuple[float, float]:
    """Jumlah kuadrat residual ARMA(1,1) bersyarat; kembalikan (SSE, residual terakhir)."""
    e_prev, sse = 0.0, 0.0
    for t in range(1, len(r)):
        e = r[t] - mu - phi * (r[t - 1] - mu) - th * e_prev
        sse += e * e
        e_prev = e
    return sse, e_prev


def _arma11(x: list[float], with_phi: bool = True) -> tuple[float, float, float, float, float]:
    mu = _mean(x)
    best = None
    phis = [i / 10 for i in range(-9, 10)] if with_phi else [0.0]
    for phi in phis:
        for j in range(-9, 10):
            th = j / 10
            sse, e = _css_ma(x, mu, th, phi)
            if not best or sse < best[0]:
                best = (sse, phi, th, e)
    sse, phi, th, e = best
    return mu, phi, th, e, math.sqrt(sse / max(1, len(x) - 3))


def m_ma(y: list[float]) -> dict:
    r = [b - a for a, b in zip(y, y[1:])]
    mu, _, th, e, sig = _arma11(r, with_phi=False)

    def f(h):
        lv, out = y[-1], []
        for i in range(h):
            lv += mu + (th * e if i == 0 else 0.0)
            out.append(lv)
        return out
    return {"f": f, "sig": sig, "param": f"θ1={th:+.2f}"}


def m_arma(y: list[float]) -> dict:
    """ARMA(1,1) pada level log harga (asumsi stasioner): ramalan kembali menuju rata-rata 1 tahun."""
    mu, phi, th, e, sig = _arma11(y)
    phi = min(phi, 0.99)

    def f(h):
        dev, out = y[-1] - mu, []
        for i in range(h):
            dev = phi * dev + (th * e if i == 0 else 0.0)
            out.append(mu + dev)
        return out
    # Sigma dinyatakan sebagai perubahan harian agar sebanding dengan model lain.
    r = [b - a for a, b in zip(y, y[1:])]
    return {"f": f, "sig": _sd(r), "param": f"φ1={phi:+.2f}, θ1={th:+.2f}"}


def m_arima(y: list[float]) -> dict:
    r = [b - a for a, b in zip(y, y[1:])]
    mu, phi, th, e, sig = _arma11(r)

    def f(h):
        lv, last, out = y[-1], r[-1], []
        for i in range(h):
            nx = mu + phi * (last - mu) + (th * e if i == 0 else 0.0)
            lv += nx
            last = nx
            out.append(lv)
        return out
    return {"f": f, "sig": sig, "param": f"φ1={phi:+.2f}, θ1={th:+.2f}, d=1"}


def m_sarima(y: list[float], musim_bln: float = 0.0) -> dict:
    """ARIMA(1,1,0)(1,0,0)[5] lewat OLS + kecenderungan bulan kalender (median return bulan ini, 10 tahun)."""
    r = [b - a for a, b in zip(y, y[1:])]
    X = [[1.0, r[t - 1], r[t - 5]] for t in range(5, len(r))]
    b = _ols(X, r[5:]) or [_mean(r), 0.0, 0.0]
    res = [v - sum(bi * xi for bi, xi in zip(b, x)) for x, v in zip(X, r[5:])]
    harian = math.log(1 + musim_bln / 100) / 21 if musim_bln else 0.0

    def f(h):
        rr, lv, out = list(r), y[-1], []
        for _ in range(h):
            # Konstanta diganti separuh drift musiman bulan berjalan (kombinasi data 1 tahun & pola 10 tahun).
            nx = 0.5 * b[0] + 0.5 * harian + b[1] * rr[-1] + b[2] * rr[-5]
            rr.append(nx)
            lv += nx
            out.append(lv)
        return out
    return {"f": f, "sig": _sd(res), "param": f"φ1={b[1]:+.2f}, Φ5={b[2]:+.2f}"}


def _grid(n=9):
    return [round((i + 1) / (n + 1), 2) for i in range(n)]


def m_ses(y: list[float]) -> dict:
    best = None
    for a in _grid():
        l, sse = y[0], 0.0
        for v in y[1:]:
            sse += (v - l) ** 2
            l = a * v + (1 - a) * l
        if not best or sse < best[0]:
            best = (sse, a, l)
    sse, a, l = best
    return {"f": lambda h: [l] * h, "sig": math.sqrt(sse / len(y)), "param": f"α={a}"}


def m_holt(y: list[float], fi: float = 0.9) -> dict:
    best = None
    for a in _grid():
        for b in (0.05, 0.1, 0.2, 0.3):
            l, t, sse = y[0], y[1] - y[0], 0.0
            for v in y[1:]:
                fc = l + fi * t
                sse += (v - fc) ** 2
                ln = a * v + (1 - a) * fc
                t = b * (ln - l) + (1 - b) * fi * t
                l = ln
            if not best or sse < best[0]:
                best = (sse, a, b, l, t)
    sse, a, b, l, t = best

    def f(h):
        out, acc = [], 0.0
        for i in range(1, h + 1):
            acc += fi ** i
            out.append(l + acc * t)
        return out
    return {"f": f, "sig": math.sqrt(sse / len(y)), "param": f"α={a}, β={b}, φ={fi}"}


def m_hw(y: list[float], m: int = 5) -> dict:
    best = None
    s0 = [y[i] - _mean(y[:m]) for i in range(m)]
    for a in _grid(6):
        for b in (0.05, 0.1, 0.2):
            for g in (0.05, 0.1, 0.3):
                l, t, s, sse = _mean(y[:m]), (_mean(y[m:2 * m]) - _mean(y[:m])) / m, list(s0), 0.0
                for i in range(m, len(y)):
                    v, si = y[i], s[i % m]
                    fc = l + 0.9 * t + si
                    sse += (v - fc) ** 2
                    ln = a * (v - si) + (1 - a) * (l + 0.9 * t)
                    t = b * (ln - l) + (1 - b) * 0.9 * t
                    s[i % m] = g * (v - ln) + (1 - g) * si
                    l = ln
                if not best or sse < best[0]:
                    best = (sse, a, b, g, l, t, list(s))
    sse, a, b, g, l, t, s = best
    n = len(y)

    def f(h):
        out, acc = [], 0.0
        for i in range(1, h + 1):
            acc += 0.9 ** i
            out.append(l + acc * t + s[(n - 1 + i) % m])
        return out
    return {"f": f, "sig": math.sqrt(sse / max(1, n - m)), "param": f"α={a}, β={b}, γ={g}, musim {m} hari"}


def m_rw(y: list[float]) -> dict:
    """Random walk + drift: harga esok = harga hari ini + rata-rata perubahan harian (patokan dasar)."""
    r = [b - a for a, b in zip(y, y[1:])]
    mu = _mean(r[-120:])
    return {"f": lambda h: [y[-1] + mu * (i + 1) for i in range(h)], "sig": _sd(r), "param": f"drift {mu * 100:+.3f}%/hari"}


def m_theta(y: list[float]) -> dict:
    """Metode Theta (Assimakopoulos & Nikolopoulos 2000): SES ditambah separuh kemiringan tren linier."""
    n = len(y)
    t = list(range(n))
    tm, ym = _mean(t), _mean(y)
    b = sum((ti - tm) * (yi - ym) for ti, yi in zip(t, y)) / sum((ti - tm) ** 2 for ti in t)
    ses = m_ses(y)
    a = float(ses["param"].split("=")[1])
    lv = ses["f"](1)[0]
    k = 1 / a - (1 - a) ** n / a
    return {"f": lambda h: [lv + b / 2 * (i + k) for i in range(h)], "sig": ses["sig"], "param": f"α={a}, tren {b * 100:+.3f}%/hari"}


def m_lr(y: list[float], w: int = 60) -> dict:
    """Regresi tren linier 60 hari terakhir pada log harga."""
    z = y[-w:]
    t = list(range(len(z)))
    tm, zm = _mean(t), _mean(z)
    b = sum((ti - tm) * (zi - zm) for ti, zi in zip(t, z)) / sum((ti - tm) ** 2 for ti in t)
    a0 = zm - b * tm
    res = [zi - (a0 + b * ti) for ti, zi in zip(t, z)]
    # Mulai dari harga terakhir (bukan garis regresi) agar tidak melompat; lanjutkan kemiringannya.
    return {"f": lambda h: [y[-1] + b * (i + 1) for i in range(h)], "sig": _sd([x - y_ for x, y_ in zip(res[1:], res)]),
            "param": f"tren {b * 100:+.3f}%/hari ({w} hari)"}


def garch(y: list[float]) -> dict:
    """GARCH(1,1) dengan variance targeting: perkiraan volatilitas harian ke depan untuk kisaran proyeksi."""
    r = [b - a for a, b in zip(y, y[1:])]
    mu = _mean(r)
    e = [x - mu for x in r]
    v0 = _mean([x * x for x in e])
    best = None
    for al in (0.03, 0.05, 0.08, 0.1, 0.15, 0.2):
        for be in (0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.95):
            if al + be >= 0.999:
                continue
            om, v, ll = v0 * (1 - al - be), v0, 0.0
            for x in e:
                ll += -0.5 * (math.log(v) + x * x / v)
                v = om + al * x * x + be * v
            if not best or ll > best[0]:
                best = (ll, al, be, om, v)
    _, al, be, om, v = best

    def sig(h):
        """Akar jumlah varians h hari ke depan (bukan sigma × √h)."""
        tot, vv = 0.0, v
        for _ in range(h):
            tot += vv
            vv = om + (al + be) * vv
        return math.sqrt(tot)
    return {"sig": sig, "harian": math.sqrt(v) * 100, "panjang": math.sqrt(v0) * 100, "alpha": al, "beta": be}


MODELS = [
    ("ar", "AR (Autoregressive)", "Nilai hari ini dipengaruhi nilai beberapa hari sebelumnya (p).", m_ar),
    ("ma", "MA (Moving Average)", "Nilai hari ini dipengaruhi kejutan (residual) hari sebelumnya (q).", m_ma),
    ("arma", "ARMA", "Gabungan AR dan MA untuk data stasioner: harga diasumsikan kembali ke rata-rata 1 tahun.", m_arma),
    ("arima", "ARIMA", "ARMA ditambah differencing (d=1) agar data yang non-stasioner menjadi stasioner.", m_arima),
    ("sarima", "SARIMA", "ARIMA dengan pola musiman: siklus mingguan (5 hari bursa) dan kecenderungan bulan kalender 10 tahun.", m_sarima),
    ("ses", "Pemulusan eksponensial sederhana", "Bobot menurun secara eksponensial pada data lama; ramalan datar.", m_ses),
    ("holt", "Holt linear (teredam)", "Pemulusan eksponensial dengan komponen tren yang meredup.", m_holt),
    ("hw", "Holt-Winters", "Pemulusan eksponensial dengan tren dan musim (siklus 5 hari bursa).", m_hw),
    ("theta", "Theta", "Pemulusan eksponensial ditambah separuh tren linier; unggul di kompetisi peramalan M3.", m_theta),
    ("lr", "Regresi tren linier", "Garis tren 60 hari terakhir diteruskan ke depan.", m_lr),
    ("rw", "Random walk + drift (patokan)", "Harga esok = harga hari ini + rata-rata perubahan harian. Model lain baru bernilai bila galatnya lebih kecil dari ini.", m_rw),
]


def _fit(key, fn, y, musim):
    return fn(y, musim) if key == "sarima" else fn(y)


def backtest(key, fn, y, musim) -> dict:
    e1, e5, arah = [], [], []
    for k in range(UJI, 0, -1):
        cut = len(y) - k
        if cut < 120 or cut + 1 > len(y):
            continue
        m = _fit(key, fn, y[:cut], musim)
        fc = m["f"](5)
        a1 = y[cut]
        e1.append(abs(math.exp(fc[0]) / math.exp(a1) - 1))
        arah.append((fc[0] - y[cut - 1]) * (a1 - y[cut - 1]) > 0)
        if cut + 4 < len(y):
            e5.append(abs(math.exp(fc[4]) / math.exp(y[cut + 4]) - 1))
    return {"mape1": round(_mean(e1) * 100, 2) if e1 else None, "mape5": round(_mean(e5) * 100, 2) if e5 else None,
            "arah": round(sum(arah) / len(arah) * 100) if arah else None, "n": len(e1)}


def build(bars: list[dict], musim_bln: float = 0.0) -> dict | None:
    """Fit seluruh model + uji mundur. musim_bln = median return bulan berjalan (%) dari 10 tahun."""
    c = [b["c"] for b in bars if b.get("c")]
    if len(c) < 160:
        return None
    y = [math.log(v) for v in c]
    p0 = c[-1]
    out = []
    for key, nama, ket, fn in MODELS:
        m = _fit(key, fn, y, musim_bln)
        fc = m["f"](max(H))
        bt = backtest(key, fn, y, musim_bln)
        out.append({"kunci": key, "nama": nama, "ket": ket, "param": m["param"], "uji": bt,
                    "sig": m["sig"], "proy": {str(h): round(math.exp(fc[h - 1])) for h in H},
                    "jalur": [round(math.exp(v)) for v in fc]})
    g = garch(y)
    return {"tanggal": bars[-1]["d"], "harga": p0, "n": len(c), "model": out,
            "garch": {"harian": round(g["harian"], 2), "panjang": round(g["panjang"], 2), "alpha": g["alpha"], "beta": g["beta"],
                      "sig": {str(h): g["sig"](h) for h in H}},
            "riwayat": [{"d": b["d"], "c": b["c"]} for b in bars[-120:]], "musimBulan": musim_bln}


def combine(base: dict, sent: dict | None, flow: dict | None) -> dict:
    """Proyeksi gabungan (bobot 1/MAPE 5 hari) + faktor sentimen, flow asing (musiman sudah ada di SARIMA)."""
    ms = [m for m in base["model"] if m["uji"].get("mape5")]
    w = {m["kunci"]: 1 / m["uji"]["mape5"] for m in ms}
    tw = sum(w.values()) or 1
    p0 = base["harga"]
    sig = _mean([m["sig"] for m in base["model"]]) or 0.01
    # Faktor sentimen: skor berita (-100..100) & flow asing digeser ke drift harian dalam satuan sigma, efeknya
    # meluruh (berita cepat basi): total geser = s * sigma * sqrt(h) dibatasi.
    s_sent = (sent or {}).get("skor", 0) / 100 * 0.15
    s_flow = 0.0 if not flow else (0.08 if flow.get("asing", 0) > 0 else -0.08)
    hasil = []
    for h in H:
        murni = sum(math.log(m["proy"][str(h)]) * w[m["kunci"]] for m in ms) / tw
        geser = (s_sent + s_flow) * sig * math.sqrt(h)
        adj = murni + geser
        gs = (base.get("garch") or {}).get("sig", {}).get(str(h))
        band = 1.28 * (gs if gs else sig * math.sqrt(h))   # kisaran ~80%, volatilitas GARCH(1,1) bila ada
        naik = sum(w[m["kunci"]] for m in ms if m["proy"][str(h)] > p0) / tw * 100
        hasil.append({"h": h, "nama": {1: "Esok", 5: "1 minggu", 21: "1 bulan"}[h], "murni": round(math.exp(murni)),
                      "sentimen": round(math.exp(adj)), "ubah": round((math.exp(adj) / p0 - 1) * 100, 2),
                      "bawah": round(math.exp(adj - band)), "atas": round(math.exp(adj + band)), "setuju": round(naik)})
    faktor = [
        {"nama": "Sentimen berita IHSG", "nilai": (sent or {}).get("skor", 0), "arah": (sent or {}).get("arah", "netral"),
         "efek": f"{s_sent * sig * 100:+.2f}% per √hari"},
        {"nama": "Flow asing bulan berjalan", "nilai": (flow or {}).get("asing"), "arah": "positif" if s_flow > 0 else "negatif" if s_flow < 0 else "netral",
         "efek": f"{s_flow * sig * 100:+.2f}% per √hari"},
        {"nama": "Musiman bulan kalender (10 tahun)", "nilai": base.get("musimBulan"), "arah": "positif" if (base.get("musimBulan") or 0) > 0 else "negatif" if (base.get("musimBulan") or 0) < 0 else "netral",
         "efek": "masuk ke model SARIMA"},
    ]
    terbaik = sorted(ms, key=lambda m: m["uji"]["mape5"])[:3]
    rw = next((m for m in base["model"] if m["kunci"] == "rw"), None)
    for m in base["model"]:
        m["kalahPatokan"] = bool(rw and m is not rw and m["uji"].get("mape5") and rw["uji"].get("mape5") and m["uji"]["mape5"] > rw["uji"]["mape5"])
    return {"proyeksi": hasil, "bobot": {k: round(v / tw * 100) for k, v in w.items()}, "faktor": faktor,
            "terbaik": [m["nama"] for m in terbaik]}
