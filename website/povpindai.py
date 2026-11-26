"""Pemindai calon cangkang (malam hari) dan turunannya: alarm penjual cangkang, alarm broker market maker,
peta grup pengendali, ringkasan harian. Fungsi murni atas hasil povdalam.analyze (tanpa HTTP) agar bisa diuji.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

import povarah as PA
import povdalam as PD


def baris(h: dict, kini: datetime | None = None) -> dict:
    """Ringkasan satu hasil analisa untuk tabel pemindai."""
    kini = kini or datetime.now()
    b30 = (kini - timedelta(days=30)).strftime("%Y-%m-%d")
    bd = h.get("backdoor") or {}
    sk = (h.get("arah") or {}).get("skenario") or []
    fase = {f["hari"]: f for f in (h.get("bandarmologi") or {}).get("fase") or []}
    afil = h.get("afiliasi") or {}
    p0 = ((h.get("kepemilikan") or {}).get("pemegang") or [{}])[0]
    bersamaan = [k for k in afil.get("kelompok") or [] if k["jenis"] == "bergerak bersamaan" and k["dasar"][:10] >= b30]
    ganti = [r for r in h.get("riwayat") or [] if r.get("lewat") and r["date"] >= b30]
    return {
        "t": h["t"], "versi": h.get("versi"), "nama": h.get("nama") or "", "dibuat": h.get("dibuat"), "skor": bd.get("skor", 0), "bukti": (bd.get("bukti") or [])[:4],
        "arah": sk[0]["nama"] if sk else "", "skorArah": sk[0]["skor"] if sk else 0,
        "pengendali": p0.get("name", ""), "pctPengendali": p0.get("pct"), "terafiliasi": (h.get("kepemilikan") or {}).get("nonPublik"),
        "ffEfektif": (h.get("kepemilikan") or {}).get("ffEfektif"), "terhubung": afil.get("totalTerhubung"),
        "jejak": [j["teks"] for j in h.get("jejakCangkang") or []][:3],
        "bandar5": (fase.get(5) or {}).get("bandar"), "bandar30": (fase.get(30) or {}).get("bandar"), "arti30": (fase.get(30) or {}).get("arti", ""),
        "akum5": (fase.get(5) or {}).get("akum") or [],
        "mm": [m for m in h.get("marketMaker") or [] if "kemungkinan broker" in m][:3],
        "bersamaan": [f"{k['dasar']}: {', '.join(k['anggota'])}" for k in bersamaan][:3],
        "gantiPengendali": [f"{r['date']}: {r['teks']}" for r in ganti][:3],
        "radar": bool(h.get("radar")),
        # Jaringan ringkas untuk peta grup dan daftar penjual cangkang.
        "jaringan": [{"nama": r["nama"], "pct": r["pct"], "emiten": [[e["t"], e["pct"]] for e in r.get("emiten") or []],
                      "keluar": [[e["t"], e.get("tgl")] for e in r.get("keluar") or []]} for r in h.get("jaringan") or []],
        "jejakData": [{"pemegang": j["pemegang"], "t": j["t"], "tgl": j.get("tgl"), "tglPeristiwa": j.get("tglPeristiwa")}
                      for j in h.get("jejakCangkang") or []],
    }


def alarm_broker(rows: dict) -> list[dict]:
    """Broker yang dipakai orang dalam (market maker) kembali muncul sebagai pembeli utama 1 minggu terakhir."""
    out = []
    for t, r in rows.items():
        for m in r.get("mm") or []:
            b = m.split()[1].rstrip(",") if m.startswith("Broker ") else ""
            if b and b in (r.get("akum5") or []) and (r.get("bandar5") or 0) >= 1e8:
                out.append({"jenis": "broker market maker", "t": t, "teks": f"{t}: broker {b} (dipakai orang dalam saat transaksi) kembali menjadi "
                                                                            f"pembeli utama 1 minggu terakhir; net bandar 1 minggu Rp{(r.get('bandar5') or 0) / 1e9:.2f} M."})
    return out


def penjual_cangkang(rows: dict) -> dict:
    """Pihak yang pernah melepas emiten saat emiten itu berganti pengendali: {nama: [{t, tgl, dari}]}."""
    out: dict = {}
    for t, r in rows.items():
        for j in r.get("jejakData") or []:
            out.setdefault(j["pemegang"], [])
            if not any(x["t"] == j["t"] for x in out[j["pemegang"]]):
                out[j["pemegang"]].append({"t": j["t"], "tgl": j.get("tgl") or j.get("tglPeristiwa"), "dari": t})
    return out


def alarm_penjual(penjual: dict, feed: list[dict]) -> list[dict]:
    """Penjual cangkang yang masuk/menambah kepemilikan di emiten lain (feed keterbukaan seluruh pasar)."""
    out = []
    for r in feed:
        if (r.get("cur") or 0) <= (r.get("prev") or 0):
            continue
        for nama, asal in penjual.items():
            if not PA.bukan_kustodian(nama):
                continue
            if PD._cocok_nama(nama, r["name"]) and r["ticker"] not in {a["t"] for a in asal}:
                out.append({"jenis": "penjual cangkang", "t": r["ticker"], "tanggal": r["date"],
                            "teks": f"{r['date']}: {r['name']} {'masuk' if not r.get('prev') else 'menambah'} {r['ticker']} "
                                    f"{r.get('prev') or 0:.2f}% -> {r['cur']:.2f}%. Pihak ini pernah melepas "
                                    f"{', '.join(a['t'] for a in asal)} saat emiten itu berganti pengendali: {r['ticker']} kandidat cangkang berikutnya."})
                break
    return sorted(out, key=lambda a: a["tanggal"], reverse=True)[:30]


def peta_grup(rows: dict) -> list[dict]:
    """Pihak (badan/orang) dan semua emiten yang dipegang/dilepasnya, digabung dari seluruh saham yang dianalisa."""
    peta: dict = {}
    for t, r in rows.items():
        for j in r.get("jaringan") or []:
            if not PA.bukan_kustodian(j["nama"]):
                continue
            k = PD._kunci(j["nama"])
            e = peta.setdefault(k, {"nama": j["nama"], "aktif": {}, "keluar": {}})
            if j.get("pct"):
                e["aktif"][t] = j["pct"]
            for s, p in j.get("emiten") or []:
                e["aktif"].setdefault(s, p)
            for s, tgl in j.get("keluar") or []:
                if s not in e["aktif"]:
                    e["keluar"][s] = tgl
    out = [{"nama": e["nama"], "aktif": sorted(e["aktif"].items(), key=lambda kv: -(kv[1] or 0)), "keluar": sorted(e["keluar"].items())}
           for e in peta.values() if len(e["aktif"]) + len(e["keluar"]) >= 2]
    return sorted(out, key=lambda e: -(len(e["aktif"]) + len(e["keluar"])))[:80]


def ringkasan(rows: dict, lalu: dict, alarm: list[dict], kini: datetime | None = None) -> dict:
    """Ringkasan harian: skor backdoor naik, pihak masuk bersamaan, pengendali berganti, alarm. Teks siap salin."""
    kini = kini or datetime.now()
    naik = sorted(([t, r["skor"], lalu.get(t)] for t, r in rows.items() if lalu.get(t) is not None and r["skor"] - lalu[t] >= 10),
                  key=lambda x: -(x[1] - x[2]))[:10]
    tinggi = sorted(([t, r["skor"]] for t, r in rows.items() if r["skor"] >= 70), key=lambda x: -x[1])[:10]
    bersama = [(t, x) for t, r in rows.items() for x in r.get("bersamaan") or []][:10]
    ganti = [(t, x) for t, r in rows.items() for x in r.get("gantiPengendali") or []][:10]
    baris_ = [f"RINGKASAN RADAR BACKDOOR · {kini.strftime('%d %b %Y')}"]
    if tinggi:
        baris_.append("Skor backdoor tertinggi: " + ", ".join(f"{t} {s}" for t, s in tinggi))
    if naik:
        baris_.append("Skor naik: " + ", ".join(f"{t} {a}->{b}" for t, b, a in naik))
    for t, x in bersama:
        baris_.append(f"Masuk bersamaan {t}: {x}")
    for t, x in ganti:
        baris_.append(f"Ganti pengendali {t}: {x}")
    for a in alarm[:10]:
        baris_.append(f"ALARM {a['jenis']}: {a['teks']}")
    if len(baris_) == 1:
        baris_.append("Belum ada perubahan penting sejak pemindaian terakhir.")
    baris_.append("Disusun otomatis; bukan rekomendasi beli/jual.")
    return {"naik": naik, "tinggi": tinggi, "bersama": bersama, "ganti": ganti, "teks": "\n".join(baris_)}
