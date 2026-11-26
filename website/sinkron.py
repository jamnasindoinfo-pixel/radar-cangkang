"""Sinkron dua arah antara dua server Radar (mis. jni-server dan laptop) lewat jaringan pribadi (Tailscale).

Logika murni (tanpa jaringan), dipakai server.py:
- Berkas data hasil hitungan (daftar putih DAFTAR_BERKAS + folder DAFTAR_FOLDER): yang lebih baru (mtime) menang.
- Data tim (SQLite): item radar, posisi diagram, dan kandidat tersembunyi digabung per kunci memakai catatan waktu
  suntingan manual (tabel jejak, termasuk penghapusan) sehingga pembaruan harga otomatis tidak menimpa suntingan tim
  dan item yang dihapus tidak muncul lagi. Berita (updates) digabung per id; snapshot harian digabung (yang belum ada).
- Token Stockbit: masa berlaku (exp) paling lama menang.
Rahasia (token, kunci) tidak pernah masuk daftar berkas; endpoint sinkron hanya untuk permintaan lokal/Tailscale berkunci.
"""
from __future__ import annotations

import os
from pathlib import Path

# Data runtime hasil hitungan yang aman dipindahkan (bukan rahasia). Cache HTTP (.cache.sqlite) tidak ikut: besar,
# dan tiap sisi mengisinya sendiri.
DAFTAR_BERKAS = (
    ".pov-dalam-pemicu.json", ".harmonik.json", ".seasonality.json", ".broker-pola.json", ".broker-harian.json",
    ".recovery.json", ".saham50.json", ".saham50-riwayat.json", ".lk-laporan.json", ".lk-kuartal.json",
    ".lk-keystats.json", ".bei-kode.json", ".sektor.json", ".profil-indeks.json", ".ihsg.json", ".pov.json",
    ".pindai.json", ".ramalan-log.json", ".kakdr-riwayat.json",
)
DAFTAR_FOLDER = (".pov-dalam",)
TOLERANSI = 2          # detik: selisih mtime lebih kecil dianggap sama
TABEL_JEJAK = ("items", "layout", "hidden")


def berkas_sah(rel: str) -> bool:
    """Path relatif (pemisah '/') yang boleh dipindahkan: nama di daftar putih, atau <folder>/<nama>.json satu tingkat."""
    if not isinstance(rel, str) or "\\" in rel or ".." in rel or rel.startswith("/"):
        return False
    if rel in DAFTAR_BERKAS:
        return True
    parts = rel.split("/")
    return (len(parts) == 2 and parts[0] in DAFTAR_FOLDER and parts[1].endswith(".json")
            and not parts[1].startswith(".") and parts[1].replace(".json", "").isalnum())


def manifest(root: Path) -> dict[str, list]:
    """{path relatif: [mtime (detik, bulat), ukuran]} untuk semua berkas sinkron yang ada."""
    out = {}
    for n in DAFTAR_BERKAS:
        f = root / n
        if f.is_file():
            st = f.stat()
            out[n] = [int(st.st_mtime), st.st_size]
    for d in DAFTAR_FOLDER:
        folder = root / d
        if folder.is_dir():
            for f in folder.glob("*.json"):
                rel = f"{d}/{f.name}"
                if berkas_sah(rel):
                    st = f.stat()
                    out[rel] = [int(st.st_mtime), st.st_size]
    return out


def rencana(lokal: dict, remote: dict, toleransi: int = TOLERANSI) -> tuple[list[str], list[str]]:
    """(tarik, kirim): berkas yang lebih baru di peer ditarik, yang lebih baru di sini dikirim."""
    tarik, kirim = [], []
    for rel in sorted(set(lokal) | set(remote)):
        if not berkas_sah(rel):
            continue
        a, b = lokal.get(rel), remote.get(rel)
        if b and (not a or b[0] > a[0] + toleransi):
            tarik.append(rel)
        elif a and (not b or a[0] > b[0] + toleransi):
            kirim.append(rel)
    return tarik, kirim


def tulis_atomik(f: Path, isi: bytes, mtime: int | None = None) -> None:
    """Tulis lewat berkas sementara lalu ganti; mtime disamakan dengan sumber agar tidak bolak-balik."""
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_name(f.name + ".sinkron-tmp")
    tmp.write_bytes(isi)
    if mtime:
        os.utime(tmp, (mtime, mtime))
    tmp.replace(f)


def _jejak_peta(rows) -> dict:
    return {(r["tabel"], r["kunci"]): r for r in rows or []}


def gabung(lokal: dict, remote: dict, awal: bool = False) -> list[tuple]:
    """Operasi untuk menerapkan data tim `remote` ke `lokal` (format ekspor server: items, jejak, layout, hidden,
    updates, snapshots). Aturan per kunci tabel ber-jejak:
    - jejak peer lebih baru dari jejak sini -> ikuti peer (simpan item/posisi/tanda sembunyi, atau hapus);
    - tanpa jejak di kedua sisi (data lama) -> hanya menambah yang belum ada di sini, tidak menimpa; dengan awal=True
      (sinkron pertama, mengadopsi data peer) baris lama yang berbeda juga mengikuti peer;
    - selain itu biarkan data sini.
    Operasi: ("item", ticker, data, updated_at) ("item_hapus", ticker) ("layout", ticker, data) ("hidden", ticker, at)
    ("hidden_hapus", ticker) ("jejak", tabel, kunci, at, hapus) ("update", data) ("snapshot", row)."""
    ops: list[tuple] = []
    jl, jr = _jejak_peta(lokal.get("jejak")), _jejak_peta(remote.get("jejak"))
    li = {x["ticker"]: x for x in lokal.get("items") or []}
    ri = {x["ticker"]: x for x in remote.get("items") or []}
    tabel = {
        "items": (li, ri),
        "layout": (lokal.get("layout") or {}, remote.get("layout") or {}),
        "hidden": (lokal.get("hidden") or {}, remote.get("hidden") or {}),
    }
    for nama, (lk, rk) in tabel.items():
        kunci = set(lk) | set(rk) | {k for (t, k) in jl if t == nama} | {k for (t, k) in jr if t == nama}
        for k in sorted(kunci):
            a, b = jl.get((nama, k)), jr.get((nama, k))
            if b and (not a or b["at"] > a["at"]):
                if b.get("hapus"):
                    if k in lk:
                        ops.append(({"items": "item_hapus", "layout": "layout_hapus", "hidden": "hidden_hapus"}[nama], k))
                elif k in rk:
                    if nama == "items":
                        ops.append(("item", k, rk[k]["data"], rk[k].get("updated_at") or b["at"]))
                    elif nama == "layout":
                        ops.append(("layout", k, rk[k]))
                    else:
                        ops.append(("hidden", k, rk[k]))
                else:
                    continue   # jejak tanpa baris (tidak lengkap): abaikan
                ops.append(("jejak", nama, k, b["at"], 1 if b.get("hapus") else 0))
            elif not a and not b and k in rk and (k not in lk or (awal and _isi(lk[k]) != _isi(rk[k]))):
                if nama == "items":
                    ops.append(("item", k, rk[k]["data"], rk[k].get("updated_at") or 0))
                elif nama == "layout":
                    ops.append(("layout", k, rk[k]))
                else:
                    ops.append(("hidden", k, rk[k]))
    lu = {str(u.get("id")): u for u in lokal.get("updates") or []}
    for u in remote.get("updates") or []:
        uid = str(u.get("id"))
        mine = lu.get(uid)
        if mine is None or str(u.get("updatedAt") or "") > str(mine.get("updatedAt") or ""):
            ops.append(("update", u))
    ls = {(s["day"], s["ticker"]) for s in lokal.get("snapshots") or []}
    for s in remote.get("snapshots") or []:
        if (s["day"], s["ticker"]) not in ls:
            ops.append(("snapshot", s))
    return ops


def _isi(x):
    return x.get("data") if isinstance(x, dict) and "data" in x and "ticker" in x else x


def arah_token(exp_lokal: int | None, exp_remote: int | None, sisa_min: int = 60) -> str:
    """'tarik' bila token peer berlaku lebih lama, 'kirim' bila token sini lebih lama, '' bila sama/tidak ada."""
    a, b = exp_lokal or 0, exp_remote or 0
    if b > a + sisa_min:
        return "tarik"
    if a > b + sisa_min:
        return "kirim"
    return ""
