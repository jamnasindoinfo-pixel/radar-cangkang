"""Seasonality: pola return bulanan berulang untuk IHSG, indeks sektor, dan saham (data Stockbit /seasonality).

Data mentah (return % per bulan per tahun, aksi korporasi, indeks keanggotaan) dikumpulkan Senin-Sabtu pukul 00.01 WIB oleh
build() ke .seasonality.json; analyze() menghitung peringkat untuk bulan dan rentang tahun yang dipilih.
Modul ini murni: fungsi pengambil data (fetch) disuntikkan dari server.py.
"""
from __future__ import annotations

import json
import math
import statistics
import time
from datetime import date

MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Indeks sektor IDX-IC (tersedia sejak 2021).
SECTORS = {
    "IDXENERGY": "Energi", "IDXBASIC": "Barang Baku", "IDXINDUST": "Perindustrian", "IDXNONCYC": "Konsumen Primer",
    "IDXCYCLIC": "Konsumen Non-Primer", "IDXHEALTH": "Kesehatan", "IDXFINANCE": "Keuangan", "IDXPROPERT": "Properti",
    "IDXTECHNO": "Teknologi", "IDXINFRA": "Infrastruktur", "IDXTRANS": "Transportasi & Logistik",
}
INDEXES = ["IHSG", *SECTORS]
# Sektor dari data tradersaham (teks bebas) -> indeks sektor.
SECTOR_WORDS = [("energ", "IDXENERGY"), ("basic", "IDXBASIC"), ("baku", "IDXBASIC"), ("industr", "IDXINDUST"),
                ("non-cyclical", "IDXNONCYC"), ("non cyclical", "IDXNONCYC"), ("non-primer", "IDXCYCLIC"),
                ("non primer", "IDXCYCLIC"), ("primer", "IDXNONCYC"), ("cyclical", "IDXCYCLIC"), ("health", "IDXHEALTH"), ("sehat", "IDXHEALTH"),
                ("financ", "IDXFINANCE"), ("keuangan", "IDXFINANCE"), ("propert", "IDXPROPERT"), ("real estate", "IDXPROPERT"),
                ("techno", "IDXTECHNO"), ("teknolog", "IDXTECHNO"), ("infra", "IDXINFRA"), ("transport", "IDXTRANS"), ("logist", "IDXTRANS")]
WEIGHTS = {"pola": 45, "sektor": 15, "ihsg": 10, "broker": 20, "katalis": 10}


def parse_season(resp: dict, is_index: bool, today: date) -> dict[str, dict[str, float]]:
    """{tahun: {bulan(1-12): return%}}. Bulan berjalan dan bulan mendatang tidak dihitung; untuk saham, nilai
    tepat 0,00 dianggap tidak ada perdagangan (suspensi/belum tercatat) sehingga diabaikan."""
    out: dict[str, dict[str, float]] = {}
    for row in (resp.get("data") or {}).get("price_change") or []:
        y = int(row.get("row") or 0)
        for c in row.get("columns") or []:
            if c.get("name") not in MON:
                continue
            m = MON.index(c["name"]) + 1
            if (y, m) >= (today.year, today.month):
                continue
            try:
                v = float(c.get("value"))
            except (TypeError, ValueError):
                continue
            if not is_index and v == 0.0:
                continue
            out.setdefault(str(y), {})[str(m)] = v
    return out


def wilson_low(up: int, n: int, z: float = 1.2816) -> float:
    """Batas bawah selang Wilson (±80%) untuk peluang naik: menghukum sampel kecil secara objektif."""
    if not n:
        return 0.0
    p = up / n
    d = 1 + z * z / n
    return max(0.0, (p + z * z / (2 * n) - z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d)


def month_stats(series: dict, month: int, years: int, today: date) -> dict | None:
    ys = [str(y) for y in range(today.year - years, today.year + 1)]
    vals = [(int(y), series[y][str(month)]) for y in ys if y in series and str(month) in series[y]]
    if not vals:
        return None
    rs = [v for _, v in vals]
    up = sum(1 for v in rs if v > 0)
    return {"n": len(rs), "up": up, "prob": round(up / len(rs) * 100), "median": round(statistics.median(rs), 2),
            "avg": round(sum(rs) / len(rs), 2), "worst": min(rs), "best": max(rs),
            "wl": round(wilson_low(up, len(rs)), 3), "vals": vals}


def sector_of(sig: dict | None, indexes: list | None) -> str | None:
    for ix in indexes or []:
        if ix in SECTORS:
            return ix
    s = str((sig or {}).get("sector") or "").lower()
    # Kata yang lebih spesifik ("non-cyclical") dicek lebih dulu daripada "cyclical".
    for w, ix in SECTOR_WORDS:
        if w in s:
            return ix
    return None


def corp_events(resp: dict) -> list[dict]:
    """Aksi korporasi -> [{jenis, tanggal}] memakai cum date (atau tanggal RUPS)."""
    out = []
    for x in (resp.get("data") or []):
        t = x.get("action_type")
        info = (x.get("action_info") or {}).get(t) or {}
        d = info.get(f"{t}_cumdate") or info.get("rups_date") or info.get(f"{t}_exdate")
        if t and d and str(d)[:4].isdigit():
            out.append({"jenis": t, "tanggal": str(d)[:10]})
    return out


JENIS = {"dividend": "cum dividen", "rups": "RUPS", "rightissue": "cum rights issue", "stocksplit": "stock split",
         "reversesplit": "reverse split", "bonus": "saham bonus", "warrant": "waran", "tender": "tender offer"}


def build(fetch, universe: list[str], today: date | None = None, pause: float = 0.25, log=print) -> dict:
    """Kumpulkan data mentah untuk indeks + universe saham. fetch(path) -> dict JSON Stockbit."""
    today = today or date.today()
    data = {"updated": time.strftime("%Y-%m-%d %H:%M"), "index": {}, "stock": {}}
    for sym in INDEXES:
        try:
            data["index"][sym] = parse_season(fetch(f"/seasonality/{sym}?years=10&year={today.year}"), True, today)
        except Exception as e:  # satu indeks gagal tidak menghentikan pembaruan
            log(f"[seasonality] {sym}: {e}")
        time.sleep(pause)
    for i, sym in enumerate(sorted(set(universe))):
        rec = {}
        try:
            rec["s"] = parse_season(fetch(f"/seasonality/{sym}?years=10&year={today.year}"), False, today)
            time.sleep(pause)
            rec["ca"] = corp_events(fetch(f"/corpaction/{sym}"))
            time.sleep(pause)
            info = (fetch(f"/emitten/{sym}/info").get("data") or {})
            rec["ix"] = [x for x in info.get("indexes") or [] if x in SECTORS]
            rec["name"] = info.get("name") or ""
            time.sleep(pause)
        except Exception as e:
            log(f"[seasonality] {sym}: {e}")
        if rec.get("s"):
            data["stock"][sym] = rec
        if i and i % 100 == 0:
            log(f"[seasonality] {i}/{len(universe)}")
    return data


def _tick(p: float) -> int:
    """Fraksi harga BEI."""
    return 1 if p < 200 else 2 if p < 500 else 5 if p < 2000 else 10 if p < 5000 else 25


def _rnd(p: float, up: bool = False) -> int:
    t = _tick(p)
    return int(math.ceil(p / t) * t) if up else int(math.floor(p / t) * t)


BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def trading_plan(st: dict, sig: dict | None, month: int, today: date) -> dict | None:
    """Rencana transaksi musiman dari data historis bulan itu + harga terkini (tradersaham):
    - area beli: harga terkini s.d. penopang terdekat (EMA20 bila di bawah harga, maks. 5% di bawah harga);
    - batas rugi: median penurunan pada tahun-tahun turun di bulan itu (dibatasi 4-10%);
    - ambil untung: TP1 = median kenaikan pada tahun-tahun naik, TP2 = kenaikan kuartil atas (persentil 75);
    - jangka waktu: masuk akhir bulan sebelumnya s.d. awal bulan, keluar paling lambat akhir bulan."""
    price = float((sig or {}).get("closePrice") or 0)
    if price <= 0:
        return None
    ema20 = float((sig or {}).get("priceEma20") or 0)
    ups = sorted(v for _, v in st["vals"] if v > 0)
    downs = sorted(v for _, v in st["vals"] if v <= 0)
    if not ups:
        return None
    lo = ema20 if 0 < ema20 < price else price * 0.97
    lo = max(lo, price * 0.95)
    e_lo, e_hi = _rnd(lo, up=True), _rnd(price)
    mid = (e_lo + e_hi) / 2
    sl_pct = min(-4.0, max(-10.0, statistics.median(downs) if downs else -6.0))
    tp1_pct = statistics.median(ups)
    q = sorted(ups)
    tp2_pct = q[min(len(q) - 1, int(round(0.75 * (len(q) - 1))))] if len(q) >= 3 else max(q)
    tp2_pct = max(tp2_pct, tp1_pct * 1.3)
    sl = _rnd(mid * (1 + sl_pct / 100))
    tp1, tp2 = _rnd(mid * (1 + tp1_pct / 100), up=True), _rnd(mid * (1 + tp2_pct / 100), up=True)
    risk, rew = mid - sl, tp1 - mid
    prev = BULAN_ID[(month - 2) % 12]
    jalan = month == today.month
    return {
        "harga": price, "entry": [e_lo, e_hi], "sl": sl, "slPct": round(sl_pct, 1),
        "tp1": tp1, "tp1Pct": round(tp1_pct, 1), "tp2": tp2, "tp2Pct": round(tp2_pct, 1),
        "rr": round(rew / risk, 2) if risk > 0 else None,
        "masuk": f"sisa {BULAN_ID[month - 1]} (bulan berjalan)" if jalan else f"akhir {prev} s.d. 3 hari bursa pertama {BULAN_ID[month - 1]}",
        "keluar": f"paling lambat hari bursa terakhir {BULAN_ID[month - 1]}",
        "timeframe": "swing ±1 bulan",
        # Uji historis sederhana (penutupan bulan): seberapa sering target tercapai dan batas rugi tertembus.
        "kenaTp1": sum(1 for _, v in st["vals"] if v >= tp1_pct), "kenaSl": sum(1 for _, v in st["vals"] if v <= sl_pct), "n": len(st["vals"]),
    }


def _broker_pts(sig: dict | None) -> tuple[float, str]:
    reg = str((sig or {}).get("regimeSignal") or "").upper()
    if not sig:
        return WEIGHTS["broker"] * 0.4, "data broker tidak ada"
    table = {"ACCUMULATION": (1, "akumulasi"), "ACCUM": (1, "akumulasi"), "FLIP_BUY": (0.8, "berbalik beli"),
             "MILD_ACCUMULATION": (0.7, "akumulasi ringan"), "NEUTRAL": (0.4, "netral"),
             "MILD_DISTRIBUTION": (0.15, "distribusi ringan"), "FLIP_SELL": (0.1, "berbalik jual"),
             "DISTRIBUTION": (0, "distribusi"), "DIST": (0, "distribusi")}
    f, label = table.get(reg, (0.4, reg.lower() or "netral"))
    return WEIGHTS["broker"] * f, label


def analyze(data: dict, month: int, years: int, signals: dict, radar: set, kandidat: set,
            today: date | None = None, min_years: int = 5, min_value: float = 1e9, top: int = 60) -> dict:
    today = today or date.today()
    ihsg_series = data.get("index", {}).get("IHSG", {})
    ihsg = month_stats(ihsg_series, month, years, today)
    ihsg_all = [month_stats(ihsg_series, m, years, today) for m in range(1, 13)]
    sektor = []
    for ix, nama in SECTORS.items():
        st = month_stats(data.get("index", {}).get(ix, {}), month, years, today)
        if st:
            sektor.append({"kode": ix, "nama": nama, **{k: st[k] for k in ("n", "up", "prob", "median", "worst")}})
    sektor.sort(key=lambda x: (-x["prob"], -x["median"]))
    sek_prob = {x["kode"]: x["prob"] / 100 for x in sektor}
    ihsg_by_year = {y: v for y, v in (ihsg or {}).get("vals", [])}

    rows = []
    for sym, rec in data.get("stock", {}).items():
        st = month_stats(rec.get("s") or {}, month, years, today)
        if not st or st["n"] < min(min_years, years):
            continue
        sig = signals.get(sym)
        liq = (sig or {}).get("avgDailyValue20d")
        if sig and liq is not None and float(liq) < min_value:
            continue
        # Berapa kali mengalahkan IHSG pada bulan dan tahun yang sama.
        beat = [v - ihsg_by_year[y] for y, v in st["vals"] if y in ihsg_by_year]
        sec = sector_of(sig, rec.get("ix"))
        # Aksi korporasi pada bulan ini di tahun-tahun lalu (alasan historis) dan yang akan datang (katalis).
        ev_hist, ev_next = {}, []
        for e in rec.get("ca") or []:
            y, m = int(e["tanggal"][:4]), int(e["tanggal"][5:7])
            if m == month and today.year - years <= y < today.year + 1 and e["tanggal"] < today.isoformat():
                ev_hist.setdefault(e["jenis"], set()).add(y)
            if e["tanggal"] >= today.isoformat():
                ev_next.append(e)
        up_years = [y for y, v in st["vals"] if v > 0]
        bersamaan = {j: len([y for y in up_years if y in ys]) for j, ys in ev_hist.items()}
        # Hanya aksi korporasi yang berulang (>= 2 tahun) yang dijadikan alasan historis.
        alasan = [f"{JENIS.get(j, j)} di bulan ini pada {len(ys)} dari {st['n']} tahun (saham naik pada {bersamaan[j]} di antaranya)"
                  for j, ys in sorted(ev_hist.items(), key=lambda kv: -len(kv[1])) if len(ys) >= 2]
        pts_pola = WEIGHTS["pola"] * st["wl"]
        pts_sek = WEIGHTS["sektor"] * sek_prob.get(sec, 0.5)
        pts_ihsg = WEIGHTS["ihsg"] * ((ihsg or {}).get("prob", 50) / 100)
        pts_br, br_label = _broker_pts(sig)
        nxt = [e for e in ev_next if int(e["tanggal"][5:7]) == month and int(e["tanggal"][:4]) <= today.year + 1]
        di_radar = sym in radar or sym in kandidat
        pts_kat = WEIGHTS["katalis"] * (1 if nxt else 0.5 if di_radar else 0)
        skor = round(pts_pola + pts_sek + pts_ihsg + pts_br + pts_kat)
        rows.append({
            "t": sym, "nama": rec.get("name") or (sig or {}).get("companyName") or "", "sektor": sec, "sektorNama": SECTORS.get(sec, ""),
            **{k: st[k] for k in ("n", "up", "prob", "median", "avg", "worst", "best")},
            "beat": sum(1 for d in beat if d > 0), "beatN": len(beat),
            "broker": br_label, "akumulasi": (sig or {}).get("netAccumulationScore"), "asing20": (sig or {}).get("foreignNetVal20d"),
            "radar": "radar" if sym in radar else "kandidat" if sym in kandidat else "",
            "alasan": alasan[:3], "bersamaan": bersamaan, "katalis": nxt[:3],
            "plan": trading_plan(st, sig, month, today),
            "skor": skor, "komponen": {"pola": round(pts_pola, 1), "sektor": round(pts_sek, 1), "ihsg": round(pts_ihsg, 1),
                                       "broker": round(pts_br, 1), "katalis": round(pts_kat, 1)},
        })
    rows.sort(key=lambda r: (-r["skor"], -r["prob"], -r["median"]))
    return {
        "updated": data.get("updated"), "bulan": month, "tahun": years, "bobot": WEIGHTS,
        "ihsg": ihsg and {k: ihsg[k] for k in ("n", "up", "prob", "median", "avg", "worst", "best")},
        "ihsgBulan": [s and {"bulan": i + 1, "prob": s["prob"], "median": s["median"], "n": s["n"]} for i, s in enumerate(ihsg_all)],
        "sektor": sektor, "saham": rows[:top], "total": len(rows),
    }


def detail(data: dict, sym: str, years: int, today: date | None = None) -> dict | None:
    """Heatmap tahun x bulan + ringkasan per bulan + aksi korporasi untuk satu kode (saham atau indeks)."""
    today = today or date.today()
    rec = data.get("stock", {}).get(sym) or ({"s": data["index"][sym]} if sym in data.get("index", {}) else None)
    if not rec:
        return None
    s = rec.get("s") or {}
    yrs = [y for y in sorted(s, reverse=True) if int(y) >= today.year - years]
    per = [month_stats(s, m, years, today) for m in range(1, 13)]
    return {"t": sym, "nama": rec.get("name") or SECTORS.get(sym, ""), "tahun": yrs,
            "heat": {y: s[y] for y in yrs},
            "bulan": [p and {k: p[k] for k in ("n", "up", "prob", "median", "avg")} for p in per],
            "aksi": [e for e in rec.get("ca") or [] if int(e["tanggal"][:4]) >= today.year - years]}


def load(path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
