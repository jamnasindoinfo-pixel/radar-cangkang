"""Recovery: saham yang sudah turun dalam dan berpotensi rebound karena didukung Seasonality dan Pola Broker.

Teknikal harian (turun dari puncak 52 minggu, jarak dari dasar, RSI, EMA, pantulan) dihitung saat pembaruan malam;
skor digabung saat diminta dengan peluang Seasonality bulan terpilih dan akumulasi broker (net bandar) terbaru.
Skor 0-100 = kedalaman turun (30) + Seasonality (25) + akumulasi broker (25) + konfirmasi teknikal (20).
"""
from __future__ import annotations

import json

MIN_TURUN = 30.0  # % dari puncak 52 minggu agar dianggap "sudah turun banyak"
MAX_DARI_DASAR = 40.0  # % di atas dasar kejatuhan; lebih dari ini = sudah pulih/lonjakan, bukan kandidat rebound
LOMPATAN = -45.0  # perubahan harian <= -45% = kemungkinan aksi korporasi (stock split/reverse), data tidak sebanding
# Kategori "Sudah di dasar": turun dalam dari puncak 52 minggu dan harga masih menempel titik terendah setahun.
DASAR_TURUN = 50.0     # % di bawah puncak 52 minggu
DASAR_JARAK = 10.0     # % maksimal di atas titik terendah 52 minggu
# Periode kinerja (hari bursa) seperti tabel kinerja aplikasi saham: 1D, 1W, 1M, 3M, 6M, 1Y (+ YTD dihitung terpisah).
PERIODE = (("1D", 1), ("1W", 5), ("1M", 21), ("3M", 63), ("6M", 126), ("1Y", 245))


def _ema(xs: list[float], n: int) -> list[float]:
    k, out = 2 / (n + 1), []
    for i, x in enumerate(xs):
        out.append(x if i == 0 else x * k + out[-1] * (1 - k))
    return out


def _rsi(xs: list[float], n: int = 14) -> float | None:
    if len(xs) <= n:
        return None
    gain = loss = 0.0
    for a, b in zip(xs[-n - 1:-1], xs[-n:]):
        d = b - a
        gain += max(d, 0)
        loss += max(-d, 0)
    if loss == 0:
        return 100.0
    return round(100 - 100 / (1 + gain / loss), 1)


def technical(bars: list[dict]) -> dict | None:
    """Ringkasan teknikal 1 tahun untuk satu saham (bars = OHLC harian, terlama dulu)."""
    if len(bars) < 60:
        return None
    c = [b["c"] for b in bars]
    y = bars[-250:]
    p = c[-1]
    # Puncak 52 minggu, lalu dasar kejatuhan = titik terendah SETELAH puncak (bukan dasar sebelum lonjakan).
    i_hi = max(range(len(y)), key=lambda i: y[i]["h"])
    hi = y[i_hi]["h"]
    seg = y[i_hi:]
    i_lo = min(range(len(seg)), key=lambda i: seg[i]["l"])
    lo = seg[i_lo]["l"]
    if not p or not hi or not lo:
        return None
    e20, e50 = _ema(c, 20), _ema(c, 50)
    hari_dari_dasar = len(seg) - 1 - i_lo
    lompat = min((b["c"] / a["c"] - 1) * 100 for a, b in zip(y[:-1], y[1:]) if a["c"])
    # Higher low: dasar 20 hari terakhir di atas dasar 20 hari sebelumnya.
    low_a, low_b = min(b["l"] for b in bars[-20:]), min(b["l"] for b in bars[-40:-20])
    # Kinerja per periode & YTD (harga penutupan terakhir tahun lalu sebagai dasar YTD).
    ret = {k: round((p / c[-1 - n] - 1) * 100, 2) for k, n in PERIODE if len(c) > n and c[-1 - n]}
    # Data harian 1 tahun Stockbit kadang < 246 bar (hari libur): 1Y memakai bar paling awal bila rentangnya ~setahun.
    if "1Y" not in ret and len(c) >= 200 and c[0]:
        ret["1Y"] = round((p / c[0] - 1) * 100, 2)
    tahun = str(bars[-1]["d"])[:4]
    sebelum = [b["c"] for b in bars if str(b["d"])[:4] < tahun]
    if sebelum and sebelum[-1]:
        ret["YTD"] = round((p / sebelum[-1] - 1) * 100, 2)
    rendah_th = min(b["l"] for b in y if b["l"])
    # Laju 10 hari terakhir (rata-rata perubahan harian) untuk perkiraan kecepatan pulih.
    harian = [(b["c"] / a["c"] - 1) for a, b in zip(bars[-11:-1], bars[-10:]) if a["c"]]
    vol20 = sum(b["v"] for b in bars[-20:]) / 20
    vol60 = sum(b["v"] for b in bars[-80:-20]) / 60 if len(bars) >= 80 else vol20
    return {
        "harga": p, "tanggal": bars[-1]["d"], "tinggi52": hi, "rendah52": lo,
        "turun": round((1 - p / hi) * 100, 1),            # % di bawah puncak 52 minggu
        "dariDasar": round((p / lo - 1) * 100, 1),         # % di atas dasar 52 minggu
        "hariDariDasar": hari_dari_dasar,
        "ret20": round((p / c[-21] - 1) * 100, 1), "ret60": round((p / c[-61] - 1) * 100, 1),
        "rsi": _rsi(c), "ema20": round(e20[-1], 1), "ema50": round(e50[-1], 1),
        "diAtasEma20": p > e20[-1], "higherLow": low_a > low_b,
        "volRasio": round(vol20 / vol60, 2) if vol60 else None,
        "lompatan": round(lompat, 1) <= LOMPATAN,
        "ret": ret, "rendahTahun": rendah_th, "dariRendah": round((p / rendah_th - 1) * 100, 1) if rendah_th else None,
        "laju10": round(sum(harian) / len(harian) * 100, 3) if harian else None, "hariNaik10": sum(1 for x in harian if x > 0),
    }


def _tick(v: float) -> int:
    """Pembulatan ke fraksi harga BEI."""
    f = 1 if v < 200 else 2 if v < 500 else 5 if v < 2000 else 10 if v < 5000 else 25
    return int(round(v / f) * f)


def plan(t: dict, avg_bandar: float | None) -> dict:
    """Trading plan rebound: area beli dekat harga/dasar, target retracement 38,2% & 50% dari jatuhnya (dibatasi +25% /
    +60% dari harga agar realistis untuk perdagangan pemulihan), batas rugi di bawah dasar kejatuhan."""
    p, hi, lo = t["harga"], t["tinggi52"], t["rendah52"]
    jatuh = hi - lo
    tp1 = min(max(lo + jatuh * 0.382, p * 1.05), p * 1.25)
    if avg_bandar and p * 1.03 < avg_bandar < tp1:
        tp1 = avg_bandar  # harga rata-rata broker akumulasi sebagai target pertama bila lebih dekat
    tp2 = min(max(lo + jatuh * 0.5, tp1 * 1.08), p * 1.6)
    entry = [_tick(max(lo, p * 0.96)), _tick(p)]
    sl = _tick(max(min(lo * 0.95, entry[0] * 0.92), entry[0] * 0.85))
    risk = entry[1] - sl
    return {"entry": entry, "tp1": _tick(tp1), "tp2": _tick(tp2), "sl": sl,
            "rr": round((_tick(tp1) - entry[1]) / risk, 2) if risk > 0 else None}


def score(t: dict, season: dict | None, bro: dict | None) -> dict:
    """Skor & status satu saham. season = baris Seasonality (prob, median, ...); bro = {net, avg, bulan, dist}."""
    turun = min(t["turun"], 70) / 70 * 30
    prob = season.get("prob") if season else None
    musim = (prob or 0) / 100 * 25
    akum = bool(bro and bro.get("net", 0) > 0)
    broker = 0.0
    if akum:
        broker = 18.0
        if bro.get("avg") and t["harga"] <= bro["avg"] * 1.05:
            broker += 7  # harga masih dekat/di bawah modal rata-rata broker pengakumulasi
    tek = 0.0
    if t["rsi"] is not None and t["rsi"] < 35:
        tek += 5
    if t["diAtasEma20"]:
        tek += 7
    if t["higherLow"] or t["dariDasar"] >= 8:
        tek += 8
    skor = round(turun + musim + broker + tek)
    dukung = [x for x, ok in (("Seasonality", (prob or 0) >= 60), ("Akumulasi broker", akum),
                                 ("Konfirmasi teknikal", t["diAtasEma20"] and (t["higherLow"] or t["dariDasar"] >= 8))) if ok]
    status = "Siap rebound" if len(dukung) == 3 else "Mulai pulih" if len(dukung) == 2 else "Pantau"
    alasan = [f"Turun {t['turun']:.0f}% dari puncak 52 minggu Rp{t['tinggi52']:,.0f}; kini {t['dariDasar']:.0f}% di atas dasar kejatuhan Rp{t['rendah52']:,.0f} ({t['hariDariDasar']} hari lalu)".replace(",", ".")]
    if prob is not None:
        alasan.append(f"Seasonality: naik {season['up']} dari {season['n']} tahun ({prob}%), median {season['median']:+.2f}%".replace(".", ",", 1))
    if akum:
        alasan.append(f"Broker akumulasi bulan {bro['bulanNama']}: net bandar Rp{bro['net'] / 1e9:,.1f} M".replace(",", "X").replace(".", ",").replace("X", ".")
                      + (f" di avg Rp{bro['avg']:,.0f}".replace(",", ".") if bro.get("avg") else ""))
    elif bro and bro.get("dist"):
        alasan.append(f"Broker masih distribusi bulan {bro['bulanNama']}")
    cek = []
    if t["rsi"] is not None:
        cek.append(f"RSI {t['rsi']:.0f}" + (" (jenuh jual)" if t["rsi"] < 35 else ""))
    cek.append("di atas EMA20" if t["diAtasEma20"] else "di bawah EMA20")
    if t["higherLow"]:
        cek.append("higher low")
    alasan.append("Teknikal: " + ", ".join(cek))
    return {"skor": skor, "status": status, "dukung": dukung, "alasan": alasan,
            "komponen": {"turun": round(turun, 1), "seasonality": round(musim, 1), "broker": round(broker, 1), "teknikal": round(tek, 1)}}


def dasar(t: dict) -> bool:
    """Sudah di dasar: turun >= DASAR_TURUN% dari puncak 52 minggu dan <= DASAR_JARAK% di atas terendah setahun."""
    return (t.get("turun") or 0) >= DASAR_TURUN and t.get("dariRendah") is not None and t["dariRendah"] <= DASAR_JARAK and not t.get("lompatan")


def kecepatan(t: dict, pl: dict) -> dict:
    """Potensi pulih tercepat: sinyal momentum (0-100) dan perkiraan hari bursa menuju target pertama bila laju
    10 hari terakhir bertahan. Perkiraan kasar, bukan kepastian; None bila laju belum positif."""
    sinyal = []
    sk = 0
    if t.get("diAtasEma20"):
        sk += 25; sinyal.append("di atas EMA20")
    if t.get("higherLow"):
        sk += 20; sinyal.append("higher low")
    if (t.get("ret20") or 0) > 0:
        sk += 15; sinyal.append(f"naik {t['ret20']:.1f}% 20 hari".replace(".", ","))
    if (t.get("volRasio") or 0) >= 1.2:
        sk += 15; sinyal.append(f"volume {t['volRasio']:.1f}x rata-rata".replace(".", ","))
    if t.get("rsi") is not None and 40 <= t["rsi"] <= 65:
        sk += 15; sinyal.append(f"RSI pulih {t['rsi']:.0f}")
    if (t.get("hariNaik10") or 0) >= 6:
        sk += 10; sinyal.append(f"{t['hariNaik10']} dari 10 hari terakhir naik")
    laju = (t.get("laju10") or 0) / 100
    tp1, p = (pl or {}).get("tp1"), t.get("harga")
    hari = None
    if laju > 0.001 and tp1 and p and tp1 > p:
        import math
        hari = max(1, min(250, math.ceil(math.log(tp1 / p) / math.log(1 + laju))))
    return {"skor": sk, "sinyal": sinyal, "estimasiHari": hari, "tp1": tp1}


def potensi(t: dict) -> dict:
    """Ringkasan untuk tab Low: potensi rebound (pantulan dari titik terendah) dan potensi recovery (momentum pulih).
    Rebound 0-100: RSI jenuh jual (<30: 30, <40: 20), dekat terendah setahun (<=5%: 20, <=15%: 10), sudah memantul
    seminggu terakhir (1W > 0: 20), higher low 15, volume >= 1,5x rata-rata 15. Recovery memakai kecepatan()."""
    pl = plan(t, None)
    sk, al = 0, []
    rsi = t.get("rsi")
    if rsi is not None and rsi < 30:
        sk += 30; al.append(f"RSI jenuh jual {rsi:.0f}")
    elif rsi is not None and rsi < 40:
        sk += 20; al.append(f"RSI rendah {rsi:.0f}")
    dr = t.get("dariRendah")
    if dr is not None and dr <= 5:
        sk += 20; al.append("menempel titik terendah")
    elif dr is not None and dr <= 15:
        sk += 10; al.append("dekat titik terendah")
    if ((t.get("ret") or {}).get("1W") or 0) > 0:
        sk += 20; al.append("mulai memantul sepekan")
    if t.get("higherLow"):
        sk += 15; al.append("higher low")
    if (t.get("volRasio") or 0) >= 1.5:
        sk += 15; al.append(f"volume {t['volRasio']:.1f}x".replace(".", ","))
    p, tp1 = t.get("harga"), pl.get("tp1")
    kc = kecepatan(t, pl)
    return {"rebound": {"skor": sk, "label": "Tinggi" if sk >= 60 else "Sedang" if sk >= 35 else "Rendah", "alasan": al,
                        "naik": round((tp1 / p - 1) * 100, 1) if p and tp1 else None, "tp1": tp1},
            "pulih": {"skor": kc["skor"], "label": "Mulai pulih" if kc["skor"] >= 50 else "Awal" if kc["skor"] >= 25 else "Belum",
                      "estimasiHari": kc["estimasiHari"], "sinyal": kc["sinyal"]}}


def load(path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
