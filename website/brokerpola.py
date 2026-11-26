"""Pola Broker: akumulasi/distribusi tiap broker per bulan (tahun berjalan) dari Stockbit broker activity.

build() menyimpan per broker per bulan net beli/jual per saham (lot, nominal, harga rata-rata beli dan jual),
25 teratas tiap sisi, ke .broker-pola.json. Bulan yang sudah lewat cukup dihitung sekali; bulan berjalan
diperbarui. Fungsi pengambil data (fetch) disuntikkan dari server.py.
"""
from __future__ import annotations

import calendar
import json
import re
import time
from datetime import date

TOP = 25
# Saham likuid untuk mengumpulkan daftar kode broker (Stockbit tidak menyediakan endpoint daftar broker).
SEED = ["BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "BUMI", "GOTO", "ANTM", "ADRO", "MDKA", "BRPT",
        "AMMN", "CUAN", "PTRO", "BRIS", "UNVR", "ICBP", "INCO", "PGAS"]


def months(today: date) -> list[tuple[int, str, str]]:
    """[(bulan, dari, sampai)] untuk tahun berjalan s.d. hari ini."""
    out = []
    for m in range(1, today.month + 1):
        last = calendar.monthrange(today.year, m)[1]
        to = min(date(today.year, m, last), today)
        out.append((m, f"{today.year}-{m:02}-01", to.isoformat()))
    return out


def broker_codes(fetch, today: date) -> dict[str, str]:
    """{kode: jenis} dari ringkasan broker saham-saham likuid sepanjang tahun berjalan."""
    codes: dict[str, str] = {}
    for sym in SEED:
        try:
            bs = (fetch(f"/marketdetectors/{sym}?from={today.year}-01-01&to={today.isoformat()}&transaction_type=TRANSACTION_TYPE_NET"
                        f"&market_board=MARKET_BOARD_REGULER&investor_type=INVESTOR_TYPE_ALL&limit=100").get("data") or {}).get("broker_summary") or {}
            for side in ("brokers_buy", "brokers_sell"):
                for x in bs.get(side) or []:
                    c = x.get("netbs_broker_code")
                    if c:
                        codes.setdefault(c, x.get("type") or "")
        except Exception:
            pass
        time.sleep(0.2)
    return codes


def _avg(val: float, lot: float) -> float | None:
    return round(val / (lot * 100), 1) if lot else None


def net_month(resp: dict) -> dict:
    """Net beli/jual per saham dari respons broker activity (gabungan satu rentang tanggal).
    Tiap baris: s (saham), lot (net), val (net Rp), avgB/avgS (harga rata-rata beli/jual), bl/sl (lot beli/jual)."""
    d = resp.get("data") or {}
    t = d.get("broker_activity_transaction") or {}
    agg: dict[str, dict] = {}
    for side in ("brokers_buy", "brokers_sell"):
        for x in t.get(side) or []:
            s = x.get("stock_code")
            if not s:
                continue
            a = agg.setdefault(s, {"bl": 0.0, "bv": 0.0, "sl": 0.0, "sv": 0.0})
            lot, val = abs(float(x.get("lot") or 0)), abs(float(x.get("value") or 0))
            if side == "brokers_buy":
                a["bl"] += lot; a["bv"] += val
            else:
                a["sl"] += lot; a["sv"] += val
    rows = [{"s": s, "lot": int(a["bl"] - a["sl"]), "val": round(a["bv"] - a["sv"]),
             "avgB": _avg(a["bv"], a["bl"]), "avgS": _avg(a["sv"], a["sl"]), "bl": int(a["bl"]), "sl": int(a["sl"])}
            for s, a in agg.items()]
    return {"nama": d.get("broker_name") or "",
            "beli": sorted([r for r in rows if r["val"] > 0], key=lambda r: -r["val"])[:TOP],
            "jual": sorted([r for r in rows if r["val"] < 0], key=lambda r: r["val"])[:TOP],
            "gross": round(sum(a["bv"] + a["sv"] for a in agg.values()))}


REPO = re.compile(r"repo|gadai|jaminan|pledge|agunan", re.I)


def nego_month(resp: dict) -> dict:
    """Pasar negosiasi satu saham satu bulan: nilai total dan crossing (broker sama di sisi beli dan jual,
    lot hampir sama) yang lazim pada repo/gadai atau pengalihan blok."""
    bs = (resp.get("data") or {}).get("broker_summary") or {}
    num = lambda v: float(v or 0)
    buy = {x.get("netbs_broker_code"): x for x in bs.get("brokers_buy") or []}
    sell = {x.get("netbs_broker_code"): x for x in bs.get("brokers_sell") or []}
    cross = []
    for c, b in buy.items():
        s_ = sell.get(c)
        if not c or not s_:
            continue
        bl, sl = num(b.get("blot")), num(s_.get("slot"))
        if bl and sl and min(bl, sl) / max(bl, sl) >= 0.9 and num(b.get("bval")) >= 1e9:
            cross.append({"b": c, "lot": int(min(bl, sl)), "val": round(min(num(b.get("bval")), num(s_.get("sval"))))})
    return {"val": round(sum(num(x.get("bval")) for x in buy.values())), "cross": sorted(cross, key=lambda z: -z["val"])[:3]}


def build(fetch, old: dict, today: date | None = None, pause: float = 0.3, log=print, insider=None) -> dict:
    today = today or date.today()
    year = str(today.year)
    data = old if old.get("tahun") == year else {"tahun": year, "broker": {}}
    data.setdefault("broker", {})
    for c, jenis in broker_codes(fetch, today).items():
        b = data["broker"].setdefault(c, {"jenis": jenis, "bulan": {}})
        b["jenis"] = jenis or b.get("jenis", "")
    cur = today.month
    for i, c in enumerate(sorted(data["broker"])):
        b = data["broker"][c]
        for m, fr, to in months(today):
            # Bulan lewat yang sudah lengkap tidak diambil ulang; bulan berjalan dan bulan lalu diperbarui.
            if b["bulan"].get(str(m)) and m < cur - 1:
                continue
            try:
                r = net_month(fetch(f"/order-trade/broker/activity?broker_code={c}&from={fr}&to={to}"))
                b["nama"] = r.pop("nama") or b.get("nama", "")
                b["bulan"][str(m)] = {**r, "sampai": to}
            except Exception as e:
                log(f"[broker-pola] {c} {m}: {e}")
            time.sleep(pause)
        if i and i % 20 == 0:
            log(f"[broker-pola] {i}/{len(data['broker'])} broker")
    # Potensi repo untuk saham yang paling diakumulasi/didistribusi tiap bulan.
    data.setdefault("nego", {}); data.setdefault("repo", {})
    kand = set()
    for m, fr, to in months(today):
        v = view(data, m, None)
        sm = [a["s"] for a in (v.get("saham") or {}).get("akumulasi", [])[:40] + (v.get("saham") or {}).get("distribusi", [])[:40]]
        kand |= set(sm)
        nm = data["nego"].setdefault(str(m), {})
        for sym in sm:
            if sym in nm and m < cur - 1:
                continue
            try:
                nm[sym] = nego_month(fetch(f"/marketdetectors/{sym}?from={fr}&to={to}&transaction_type=TRANSACTION_TYPE_GROSS"
                                           f"&market_board=MARKET_BOARD_NEGO&investor_type=INVESTOR_TYPE_ALL&limit=25"))
            except Exception as e:
                log(f"[broker-pola] nego {sym} {m}: {e}")
            time.sleep(pause)
    if insider:
        for sym in sorted(kand):
            try:
                data["repo"][sym] = [{"tgl": r["date"], "nama": r["name"], "tujuan": r["purpose"], "chg": r["chg"]}
                                     for r in insider(sym) if r["date"].startswith(year) and REPO.search(r.get("purpose") or "")][:10]
            except Exception as e:
                log(f"[broker-pola] insider {sym}: {e}")
            time.sleep(pause)
    data["updated"] = time.strftime("%Y-%m-%d %H:%M")
    return data


def repo_flag(data: dict, sym: str, month: int) -> dict | None:
    """Tanda potensi repo: keterbukaan bertujuan repo/gadai di bulan itu, atau crossing nego oleh broker yang sama."""
    ks = [r for r in data.get("repo", {}).get(sym, []) if int(r["tgl"][5:7]) == month]
    ng = (data.get("nego", {}).get(str(month)) or {}).get(sym)
    if ks:
        return {"kuat": True, "alasan": [f"Keterbukaan {r['tgl']}: {r['nama']} ({r['tujuan']})" for r in ks[:2]]}
    if ng and ng.get("cross"):
        return {"kuat": False, "alasan": [f"Crossing nego broker {c['b']}: {c['lot']:,} lot".replace(",", ".") + f" (Rp{c['val'] / 1e9:,.1f} M)".replace(",", "X").replace(".", ",").replace("X", ".") for c in ng["cross"][:2]]}
    return None


def domestik(jenis: str) -> bool:
    return str(jenis).lower() != "asing"


def view(data: dict, month: int | None, broker: str | None, jenis: str = "", batas: int | None = 40) -> dict:
    """Per broker (semua bulan) dan/atau per saham (agregat broker pada satu bulan).
    jenis: "" semua, "asing", atau "domestik" (lokal + pemerintah). batas=None: semua saham tiap sisi."""
    semua = data.get("broker") or {}
    bro = {c: b for c, b in semua.items() if not jenis or (jenis == "asing") != domestik(b.get("jenis", ""))}
    lst = sorted(({"kode": c, "nama": b.get("nama", ""), "jenis": b.get("jenis", ""),
                   "gross": sum((x or {}).get("gross", 0) for x in b.get("bulan", {}).values())} for c, b in bro.items()),
                 key=lambda x: -x["gross"])
    out = {"jenis": jenis, "tahun": data.get("tahun"), "updated": data.get("updated"), "brokers": lst,
           "bulanAda": sorted({int(m) for b in bro.values() for m in b.get("bulan", {})})}
    if broker and broker in semua:
        b = semua[broker]
        bl = {}
        for m in sorted(b.get("bulan", {}), key=int):
            x = b["bulan"][m]
            bl[m] = {**x, **{side: [{**r, "repo": repo_flag(data, r["s"], int(m))} for r in x.get(side) or []] for side in ("beli", "jual")}}
        out["broker"] = {"kode": broker, "nama": b.get("nama", ""), "jenis": b.get("jenis", ""), "bulan": bl}
    if month:
        agg: dict[str, dict] = {}
        for c, b in bro.items():
            x = b.get("bulan", {}).get(str(month))
            if not x:
                continue
            for side, key in (("beli", "akum"), ("jual", "dist")):
                for r in x.get(side) or []:
                    a = agg.setdefault(r["s"], {"s": r["s"], "net": 0, "lot": 0, "asing": 0, "domestik": 0, "akum": [], "dist": []})
                    a["net"] += r["val"]; a["lot"] += r["lot"]
                    a["domestik" if domestik(b.get("jenis", "")) else "asing"] += r["val"]
                    a[key].append({"b": c, "j": b.get("jenis", ""), "val": r["val"], "lot": r["lot"], "avg": r.get("avgB") if key == "akum" else r.get("avgS")})
        rows = list(agg.values())
        for a in rows:
            a["repo"] = repo_flag(data, a["s"], month)
            a["nAkum"], a["nDist"] = len(a["akum"]), len(a["dist"])
            a["akum"] = sorted(a["akum"], key=lambda z: -z["val"])[:3]
            a["dist"] = sorted(a["dist"], key=lambda z: z["val"])[:3]
            # Ukuran bandar: net 3 broker pembeli teratas + net 3 broker penjual teratas (gaya Bandar Detector);
            # net seluruh broker pada dasarnya nol karena setiap beli punya lawan jual.
            a["bandar"] = sum(z["val"] for z in a["akum"]) + sum(z["val"] for z in a["dist"])
            a["bandarLot"] = sum(z["lot"] for z in a["akum"]) + sum(z["lot"] for z in a["dist"])
            # Harga rata-rata gabungan broker pembeli / penjual utama (tertimbang nilai).
            wa = lambda zs: round(sum(abs(z["val"]) for z in zs) / sum(abs(z["val"]) / z["avg"] for z in zs), 1)                 if zs and all(z.get("avg") for z in zs) else None
            a["avgAkum"], a["avgDist"] = wa(a["akum"]), wa(a["dist"])
        out["saham"] = {"akumulasi": sorted([a for a in rows if a["bandar"] > 0], key=lambda a: -a["bandar"])[:batas],
                        "distribusi": sorted([a for a in rows if a["bandar"] < 0], key=lambda a: a["bandar"])[:batas]}
    return out


def series(data: dict, sym: str, jenis: str = "") -> list[dict]:
    """Net bandar satu saham per bulan (tahun berjalan): net 3 pembeli + 3 penjual teratas, avg broker pembeli/penjual,
    net Asing/Domestik, dan broker utama tiap bulan; untuk grafik bulanan di Pola Broker."""
    out = []
    for m in sorted({int(k) for b in (data.get("broker") or {}).values() for k in b.get("bulan", {})}):
        a = next((x for side in ("akumulasi", "distribusi") for x in (view(data, m, None, jenis).get("saham") or {}).get(side, [])
                  if x["s"] == sym), None)
        out.append({"bulan": m, "bandar": a["bandar"] if a else 0, "avgAkum": a and a.get("avgAkum"), "avgDist": a and a.get("avgDist"),
                    "asing": a["asing"] if a else 0, "domestik": a["domestik"] if a else 0,
                    "akum": [z["b"] for z in a["akum"]] if a else [], "dist": [z["b"] for z in a["dist"]] if a else []})
    return out


def harian_ke_data(hari: dict, tanggal: str, brokers: dict) -> dict:
    """Bentuk data satu hari agar bisa memakai view(): tiap broker punya satu "bulan" (kunci "1") berisi net hari itu."""
    rec = hari.get(tanggal) or {}
    return {"broker": {c: {"jenis": (brokers.get(c) or {}).get("jenis", ""), "nama": (brokers.get(c) or {}).get("nama", ""), "bulan": {"1": x}}
                       for c, x in (rec.get("broker") or {}).items()}, "repo": {}, "nego": {}}


def view_harian(hd: dict, tanggal: str, brokers: dict, jenis: str = "") -> dict:
    """Akumulasi/distribusi per saham pada satu hari bursa (agregat semua broker sesuai jenis)."""
    ada = sorted((d for d, x in (hd.get("hari") or {}).items() if x.get("broker")), reverse=True)
    if tanggal not in ada:
        tanggal = ada[0] if ada else ""
    v = view(harian_ke_data(hd.get("hari") or {}, tanggal, brokers), 1, None, jenis) if tanggal else {"saham": None, "brokers": []}
    v.pop("bulanAda", None)
    return {**v, "harian": True, "tanggal": tanggal, "tanggalAda": ada, "updated": hd.get("updated"),
            "diag": None if ada else (hd.get("diag") or [])[:6]}


def series_harian(hd: dict, sym: str, brokers: dict, jenis: str = "") -> list[dict]:
    """Net bandar satu saham per hari bursa (hari tersimpan, terlama ke terbaru) untuk grafik harian."""
    out = []
    for d in sorted(d for d, x in (hd.get("hari") or {}).items() if x.get("broker")):
        s = view(harian_ke_data(hd["hari"], d, brokers), 1, None, jenis).get("saham") or {}
        a = next((x for side in ("akumulasi", "distribusi") for x in s.get(side, []) if x["s"] == sym), None)
        out.append({"tanggal": d, "bandar": a["bandar"] if a else 0, "avgAkum": a and a.get("avgAkum"), "avgDist": a and a.get("avgDist"),
                    "asing": a["asing"] if a else 0, "domestik": a["domestik"] if a else 0,
                    "akum": [z["b"] for z in a["akum"]] if a else [], "dist": [z["b"] for z in a["dist"]] if a else []})
    return out


def _rapikan_harian(data: dict) -> dict:
    """Salinan siap simpan: diag 30 terakhir, maks. 40 hari terbaru, stempel waktu."""
    keep = sorted(data["hari"], reverse=True)[:40]
    return {**data, "diag": data["diag"][-30:], "hari": {d: data["hari"][d] for d in keep}, "updated": time.strftime("%Y-%m-%d %H:%M")}


def build_harian(fetch, old: dict, brokers: dict, dates: list[str], fresh_dates: set, pause: float = 0.25, log=print,
                 simpan=None) -> dict:
    """Net beli/jual per broker per hari bursa: {"hari": {tanggal: {"broker": {kode: net_month(...)}} | {"libur": True}}}.
    Tanggal yang sudah lengkap tidak diambil ulang; tanggal di fresh_dates (hari ini/kemarin) diperbarui.
    simpan(data): dipanggil setiap satu hari selesai, agar kemajuan tidak hilang bila proses terhenti (mis. server restart)."""
    # Versi 2: data versi lama (hari gagal tercatat sebagai libur) dibuang dan diisi ulang.
    data = {"versi": 2, "hari": dict(old.get("hari") or {}) if old.get("versi") == 2 else {}, "diag": []}
    for d in dates:
        if d in data["hari"] and d not in fresh_dates:
            continue
        rec, gagal, kosong = {}, 0, 0
        for c in sorted(brokers):
            try:
                resp = fetch(f"/order-trade/broker/activity?broker_code={c}&from={d}&to={d}", d in fresh_dates)
                r = net_month(resp)
                r.pop("nama", None)
                if r["beli"] or r["jual"]:
                    rec[c] = r
                else:
                    kosong += 1
                    if kosong == 1:
                        t = (resp.get("data") or {}).get("broker_activity_transaction")
                        data["diag"].append({"tanggal": d, "broker": c, "kunci": sorted((resp.get("data") or {}).keys())[:12],
                                             "isi": {k: len(v) for k, v in t.items() if isinstance(v, list)} if isinstance(t, dict) else str(type(t))})
            except Exception as e:
                gagal += 1
                if gagal == 1:
                    data["diag"].append({"tanggal": d, "broker": c, "gagal": str(e)[:120]})
                log(f"[broker-harian] {c} {d}: {e}")
            time.sleep(pause)
        if rec:
            data["hari"][d] = {"broker": rec}
        elif gagal == 0:
            data["hari"][d] = {"libur": True}   # semua broker kosong tanpa galat = hari libur bursa
        # Banyak galat tanpa data: tanggal tidak dicatat agar dicoba lagi di putaran berikutnya.
        log(f"[broker-harian] {d}: {len(rec)} broker, {kosong} kosong, {gagal} gagal")
        if simpan and (rec or gagal == 0):
            simpan(_rapikan_harian(data))
        if gagal > 10 and not rec:
            break
    return _rapikan_harian(data)


def market_flow(data: dict) -> dict | None:
    """Flow pasar bulan terakhir: total net broker Asing vs Domestik (dari 25 saham teratas tiap broker), broker asing
    terbesar, dan saham paling diakumulasi/didistribusi asing."""
    bro = data.get("broker") or {}
    ms = sorted({int(m) for b in bro.values() for m in b.get("bulan", {})})
    if not ms:
        return None
    m = ms[-1]
    tot, per, sampai = {"asing": 0, "domestik": 0}, [], None
    for c, b in bro.items():
        x = b.get("bulan", {}).get(str(m))
        if not x:
            continue
        sampai = x.get("sampai") or sampai
        net = sum(r["val"] for r in x.get("beli") or []) + sum(r["val"] for r in x.get("jual") or [])
        k = "domestik" if domestik(b.get("jenis", "")) else "asing"
        tot[k] += net
        if k == "asing":
            per.append({"kode": c, "nama": b.get("nama", ""), "net": net})
    v = view(data, m, None, "asing").get("saham") or {}
    BL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    return {"bulan": m, "bulanNama": BL[m - 1], "sampai": sampai, "asing": tot["asing"], "domestik": tot["domestik"],
            "brokerAsing": sorted(per, key=lambda z: -abs(z["net"]))[:3],
            "sahamAsing": [{"s": a["s"], "net": a["bandar"], "avg": a.get("avgAkum")} for a in v.get("akumulasi", [])[:3]],
            "sahamJualAsing": [{"s": a["s"], "net": a["bandar"]} for a in v.get("distribusi", [])[:3]]}


def load(path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
