#!/usr/bin/env python3
"""Pemeriksaan pasca-deploy (dipanggil deploy/deploy.sh setelah server hidup kembali).

Kritis (gagal = deploy dikembalikan ke versi sebelumnya): halaman utama dan berkas JS-nya tidak bisa dimuat.
Peringatan (deploy tetap live, dicatat di .ci/status.json): data penting kosong atau jauh di bawah biasanya,
misalnya karena token kedaluwarsa atau pembaruan malam gagal.

Keluaran: baris JSON {"kritis": [...], "peringatan": [...]}; kode keluar 2 bila ada yang kritis.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request

# (jalur API, label, cara menghitung isi, batas minimal)
DATA = [
    ("api/items", "Radar backdoor", lambda d: len(d) if isinstance(d, list) else 0, 1),
    ("api/updates", "Feed berita", lambda d: len(d) if isinstance(d, list) else 0, 1),
    ("api/lk", "Kinerja LK", lambda d: d.get("n", 0), 100),
    ("api/saham50", "Saham 50", lambda d: d.get("n", 0), 20),
    ("api/broker-pola", "Pola Broker", lambda d: len(d.get("brokers") or []), 20),
    ("api/seasonality", "Seasonality", lambda d: d.get("total", 0), 100),
    ("api/kode-bei", "Kode BEI", lambda d: len(d.get("kode") or []), 500),
]


def periksa(ambil) -> dict:
    """ambil(jalur) -> (kode_http, bytes). Dipisah dari HTTP agar bisa diuji."""
    kritis, peringatan = [], []
    kode, isi = ambil("")
    teks = isi.decode("utf-8", "replace")
    if kode != 200 or '<div id="app"' not in teks:
        kritis.append(f"halaman utama tidak termuat (HTTP {kode})")
    else:
        for js in re.findall(r'src="\.?/?(assets/[^"]+\.js)"', teks)[:3]:
            k, _ = ambil(js)
            if k != 200:
                kritis.append(f"berkas {js} tidak termuat (HTTP {k})")
    for jalur, label, hitung, minimal in DATA:
        kode, isi = ambil(jalur)
        try:
            d = json.loads(isi) if kode == 200 else None
        except ValueError:
            d = None
        if d is None:
            peringatan.append(f"{label}: API gagal (HTTP {kode})")
            continue
        n = hitung(d)
        if n < minimal:
            sebab = f" ({d['error'][:80]})" if isinstance(d, dict) and d.get("error") else ""
            peringatan.append(f"{label}: isi {n}, di bawah batas {minimal}{sebab}")
    return {"kritis": kritis, "peringatan": peringatan}


def main() -> int:
    port = sys.argv[1] if len(sys.argv) > 1 else "8765"

    def ambil(jalur: str):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/{jalur}", timeout=30) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, b""
        except Exception:
            return 0, b""

    hasil = periksa(ambil)
    print(json.dumps(hasil, ensure_ascii=False))
    return 2 if hasil["kritis"] else 0


if __name__ == "__main__":
    sys.exit(main())
