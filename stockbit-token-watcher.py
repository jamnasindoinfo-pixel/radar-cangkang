#!/usr/bin/env python3
"""Jaga token Stockbit radar tetap hidup.

Access token Stockbit berumur 24 jam. Script ini memperbaruinya lewat
POST https://exodus.stockbit.com/login/refresh (Bearer = refresh token) sebelum habis.

PENTING: refresh token BEROTASI. Tiap refresh sukses menerbitkan refresh token baru
dan mematikan yang lama, jadi file website/.stockbit-refresh selalu ditimpa dengan
yang terbaru. Sesi browser yang sama juga ikut me-refresh saat halaman Stockbit dibuka,
jadi ambil refresh token dari sesi khusus (jendela incognito) lalu jangan dipakai lagi.

Jalankan berkala (systemd timer tiap jam). Tanpa argumen: refresh hanya bila sisa
umur token < AMBANG. --force: refresh sekarang.
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

WEB = Path(__file__).resolve().parent / "website"
ACCESS_FILE = WEB / ".stockbit-token"
REFRESH_FILE = WEB / ".stockbit-refresh"
LAST_RESPONSE = WEB / ".stockbit-refresh-last.json"  # cadangan kalau parsing gagal
URL = "https://exodus.stockbit.com/login/refresh"
AMBANG = 3 * 3600  # refresh bila access token tinggal < 3 jam


def read_token(path: Path) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line.split()[-1]  # buang awalan "Bearer " kalau ada
    return None


def jwt_exp(token: str | None) -> int:
    try:
        p = token.split(".")[1]
        return int(json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))["exp"])
    except Exception:
        return 0


def write_secret(path: Path, value: str) -> None:
    # Tulis atomik dengan izin 600 supaya token tidak pernah setengah tertulis. Bila path symlink (.stockbit-token di
    # jni-server), yang diganti berkas tujuannya supaya symlink tetap utuh (sama dengan token_tulis di server.py).
    target = path.resolve() if path.is_symlink() else path
    tmp = target.with_name(target.name + ".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(value + "\n")
    os.replace(tmp, target)


def find_tokens(obj, path=""):
    """Kumpulkan semua string mirip JWT beserta path kuncinya.
    Nama field respons refresh belum terdokumentasi, jadi dicari secara struktural."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from find_tokens(v, f"{path}.{k}".lower())
    elif isinstance(obj, list):
        for v in obj:
            yield from find_tokens(v, path)
    elif isinstance(obj, str) and obj.count(".") == 2 and obj.startswith("eyJ"):
        yield path, obj


def pick(tokens, want_refresh: bool) -> str | None:
    hits = [t for p, t in tokens if ("refresh" in p) == want_refresh]
    # Kalau ada beberapa kandidat, ambil yang paling lama hidup.
    return max(hits, key=jwt_exp, default=None)


def notify(msg: str) -> None:
    print(msg, file=sys.stderr)
    try:
        subprocess.run(["notify-send", "-u", "critical", "Token Stockbit", msg], timeout=5)
    except Exception:
        pass


def refresh(refresh_token: str) -> None:
    req = urllib.request.Request(URL, data=b"", method="POST", headers={
        "Authorization": f"Bearer {refresh_token}",
        "Accept": "application/json",
        "Origin": "https://stockbit.com",
        "Referer": "https://stockbit.com/",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} dari /login/refresh; refresh token mati/terpakai, ambil ulang (lihat README).")

    # Simpan respons mentah dulu: refresh token lama sudah hangus, jangan sampai yang baru hilang.
    write_secret(LAST_RESPONSE, raw.decode("utf-8", "replace"))
    tokens = list(find_tokens(json.loads(raw)))
    new_access, new_refresh = pick(tokens, False), pick(tokens, True)
    if not new_access or not new_refresh:
        raise RuntimeError(f"Format respons tak dikenal; cek {LAST_RESPONSE.name} dan salin token manual.")
    write_secret(REFRESH_FILE, new_refresh)
    write_secret(ACCESS_FILE, new_access)


def main() -> int:
    access, ref = read_token(ACCESS_FILE), read_token(REFRESH_FILE)
    sisa = jwt_exp(access) - time.time()
    if "--force" not in sys.argv and sisa > AMBANG:
        print(f"Token masih {sisa / 3600:.1f} jam, tidak perlu refresh.")
        return 0
    if not ref:
        # Kondisi "menunggu diisi manusia", bukan kegagalan eksekusi: keluar 0 agar jurnal systemd
        # tidak menumpuk FAILURE tiap jam. Notifikasi desktop dibatasi sekali per hari.
        msg = (f"Refresh token belum ada di {REFRESH_FILE}; access token sisa {max(sisa, 0) / 3600:.1f} jam.")
        stamp = WEB / ".stockbit-notify-stamp"
        now = time.time()
        try:
            last = stamp.stat().st_mtime
        except OSError:
            last = 0.0
        if now - last > 86400 or "--force" in sys.argv:
            notify(msg)
            try:
                stamp.touch()
            except OSError:
                pass
        else:
            print(msg, file=sys.stderr)
        return 0
    try:
        refresh(ref)
    except Exception as e:
        notify(str(e))
        return 1
    print(f"Token diperbarui, berlaku sampai {time.ctime(jwt_exp(read_token(ACCESS_FILE)))}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
