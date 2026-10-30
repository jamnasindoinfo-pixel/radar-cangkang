#!/usr/bin/env python3
"""Server lokal + proxy Stockbit untuk Radar Cangkang (pemakaian pribadi).

Penggati serve.ps1: port Python stdlib murni (tanpa dependensi eksternal),
concurrency beneran (ThreadingHTTPServer), cache SQLite, fallback halaman publik.

Jalankan:
  python3 server.py            # hanya komputer ini (localhost)
  python3 server.py --lan      # terbuka untuk jaringan lokal (LAN/Tailscale)
  python3 server.py --port 8765

Token Stockbit dibaca dari env STOCKBIT_TOKEN atau file .stockbit-token di folder ini.
Token hanya dipakai server ini untuk memanggil Stockbit; tidak pernah dikirim ke browser.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import html as html_mod
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import brokerpola as BP
import beritapasar as BN
import ihsg as IH
import astro as AS
import recovery as RC
import runtun as TS
import seasonality as SZ

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "stockbit.config.json"
TOKEN_PATH = ROOT / ".stockbit-token"
CACHE_DB = ROOT / ".cache.sqlite"
DIST = ROOT / "dist"
CGNAT = ipaddress.ip_network("100.64.0.0/10")

UA_BROWSER = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
UA_PAGE = "Mozilla/5.0 RadarCangkang/1.0"

# ---------------------------------------------------------------- token ----

def read_token(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        # utf-8-sig: file token dari aplikasi lain (mis. trade-platform) bisa diawali BOM.
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                return re.sub(r"(?i)^bearer\s+", "", s)
    except OSError:
        pass
    return None


def get_token() -> str | None:
    t = os.environ.get("STOCKBIT_TOKEN")
    return t or read_token(TOKEN_PATH)


def token_exp() -> int | None:
    t = get_token()
    if not t or "." not in t:
        return None
    try:
        p = t.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
        return int(payload["exp"]) if payload.get("exp") else None
    except Exception:
        return None

# ------------------------------------------------------- watcher token ----
def watcher_status() -> dict:
    """Keadaan stockbit-token-watcher tanpa membuka rahasia: hanya keberadaan file, waktu ubah,
    dan waktu terbit/kedaluwarsa token (klaim iat/exp JWT)."""
    def mtime(p: Path) -> str | None:
        try:
            return datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")
        except OSError:
            return None
    iat = None
    t = get_token()
    if t and "." in t:
        try:
            p = t.split(".")[1]
            iat = int(json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4))).get("iat") or 0) or None
        except Exception:
            iat = None
    ref = ROOT / ".stockbit-refresh"
    return {
        "refreshAda": ref.is_file() and ref.stat().st_size > 20,
        "refreshDiubah": mtime(ref),                                # berubah tiap refresh sukses (token berotasi)
        "tokenDiubah": mtime(TOKEN_PATH),
        "tokenTerbit": datetime.fromtimestamp(iat, timezone.utc).isoformat(timespec="seconds") if iat else None,
        "menungguIsiManual": (ROOT / ".stockbit-notify-stamp").exists() or (ROOT.parent / ".stockbit-notify-stamp").exists(),
    }


# ------------------------------------------------------------ suara TTS ----
# Narasi video dengan suara pria Indonesia (Azure Speech, id-ID-ArdiNeural). Kunci dibaca dari env
# AZURE_SPEECH_KEY + AZURE_SPEECH_REGION atau file .azure-speech (baris 1 kunci, baris 2 region); file
# tidak pernah di-commit atau disajikan. Audio per kalimat disimpan di .tts-cache/ sehingga kalimat yang
# sama tidak dibuat ulang. Pengaman kuota: batas karakter per bulan (TTS_MONTHLY_CHARS) dan per pengunjung.
TTS_DIR = ROOT / ".tts-cache"
TTS_KEY_FILE = ROOT / ".azure-speech"
TTS_VOICE = os.environ.get("AZURE_SPEECH_VOICE", "id-ID-ArdiNeural")
TTS_MONTHLY_CHARS = int(os.environ.get("TTS_MONTHLY_CHARS", "450000"))   # kuota gratis Azure F0: 500 ribu/bulan
TTS_MAX_TEXT = 700
TTS_IP_WINDOW, TTS_IP_LIMIT = 600, 400          # maks. 400 kalimat baru per pengunjung per 10 menit
_tts_lock = threading.Lock()
_tts_ip: dict = {}


def tts_config() -> tuple[str, str] | None:
    key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    if not (key and region):
        try:
            lines = [x.strip() for x in TTS_KEY_FILE.read_text(encoding="utf-8-sig").splitlines() if x.strip() and not x.startswith("#")]
            key, region = (lines + ["", ""])[:2]
        except OSError:
            return None
    return (key, region) if key and region else None


def tts_usage(add: int = 0) -> dict:
    """Pemakaian karakter bulan ini (file .tts-cache/usage.json); add > 0 menambah pemakaian."""
    month = datetime.now().strftime("%Y-%m")
    p = TTS_DIR / "usage.json"
    with _tts_lock:
        try:
            u = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            u = {}
        if u.get("bulan") != month:
            u = {"bulan": month, "karakter": 0}
        if add:
            u["karakter"] += add
            TTS_DIR.mkdir(exist_ok=True)
            p.write_text(json.dumps(u), encoding="utf-8")
        return u


_tts_key_tries: dict = {}


def tts_try_key(key: str, region: str) -> bool:
    """Uji kunci Azure dengan satu kalimat pendek (tanpa menyimpan)."""
    ssml = f"<speak version='1.0' xml:lang='id-ID'><voice name='{TTS_VOICE}'>Tes suara.</voice></speak>".encode()
    req = urllib.request.Request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml, method="POST", headers={
        "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "radar-backdoor"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200 and len(r.read()) > 500
    except Exception:
        return False


def tts_set_key(body, public: bool, ip: str) -> tuple[int, dict]:
    """Pasang kunci Azure dari halaman Video. Publik: hanya sekali (saat belum ada kunci), maks. 5 percobaan/jam."""
    if not isinstance(body, dict):
        return 400, {"error": "Data tidak valid."}
    key = str(body.get("key") or "").strip()
    region = str(body.get("region") or "southeastasia").strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9]{20,100}", key) or not re.fullmatch(r"[a-z0-9]{3,30}", region):
        return 400, {"error": "Format KEY 1 atau region tidak sesuai."}
    if public and tts_config():
        return 403, {"error": "Suara pria sudah aktif. Mengganti kunci hanya bisa dari jaringan server."}
    now = time.time()
    with _tts_lock:
        tries = [t for t in _tts_key_tries.get(ip, []) if t > now - 3600]
        if len(tries) >= 5:
            return 429, {"error": "Terlalu banyak percobaan. Coba lagi dalam satu jam."}
        _tts_key_tries[ip] = tries + [now]
    if not tts_try_key(key, region):
        return 400, {"error": "Kunci ditolak Azure. Periksa KEY 1 dan region (mis. southeastasia)."}
    old = os.umask(0o077)
    try:
        TTS_KEY_FILE.write_text(f"{key}\n{region}\n", encoding="utf-8")
    finally:
        os.umask(old)
    try:
        os.chmod(TTS_KEY_FILE, 0o600)
    except OSError:
        pass
    return 200, {"ok": True}


def tts_audio(text: str, ip: str = "") -> bytes | None:
    """MP3 untuk satu kalimat (dari cache bila ada). None = TTS tidak tersedia (frontend memakai suara browser)."""
    text = re.sub(r"\s+", " ", text or "").strip()[:TTS_MAX_TEXT]
    if not text:
        return None
    path = TTS_DIR / (hashlib.sha1(f"{TTS_VOICE}|{text}".encode()).hexdigest() + ".mp3")
    if path.is_file():
        return path.read_bytes()
    cfg = tts_config()
    if not cfg or tts_usage()["karakter"] + len(text) > TTS_MONTHLY_CHARS:
        return None
    now = time.time()
    with _tts_lock:
        calls = [t for t in _tts_ip.get(ip, []) if t > now - TTS_IP_WINDOW]
        if len(calls) >= TTS_IP_LIMIT:
            return None
        _tts_ip[ip] = calls + [now]
    key, region = cfg
    esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    ssml = (f"<speak version='1.0' xml:lang='id-ID'><voice name='{TTS_VOICE}'>"
            f"<prosody rate='-4%'>{esc}</prosody></voice></speak>").encode("utf-8")
    req = urllib.request.Request(f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml, method="POST", headers={
        "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "radar-backdoor"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            audio = r.read()
    except Exception as e:  # kunci salah/kuota habis/jaringan: diam-diam kembali ke suara browser
        print(f"[tts] gagal: {str(e)[:120]}", file=sys.stderr)
        return None
    if not audio:
        return None
    TTS_DIR.mkdir(exist_ok=True)
    path.write_bytes(audio)
    tts_usage(len(text))
    return audio


# ---------------------------------------------------------------- cache ----
# Respons Stockbit dan sumber berita disimpan di .cache.sqlite sehingga semua
# perangkat memakai salinan yang sama; Stockbit hanya dipanggil saat kedaluwarsa.

_db_lock = threading.Lock()
_db: sqlite3.Connection | None = None


def db() -> sqlite3.Connection | None:
    global _db
    with _db_lock:
        if _db is None:
            try:
                _db = sqlite3.connect(CACHE_DB, check_same_thread=False)
                _db.execute("PRAGMA journal_mode=WAL")
                _db.execute("CREATE TABLE IF NOT EXISTS http_cache("
                            "url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL)")
                _db.commit()
            except sqlite3.Error as e:
                print(f"[cache] SQLite tidak tersedia, server jalan tanpa cache: {e}", file=sys.stderr)
                _db = None if _db is None else _db
        return _db


def market_open() -> bool:
    n = datetime.now()
    if n.weekday() >= 5:
        return False
    return 8 * 60 + 45 <= n.hour * 60 + n.minute <= 16 * 60 + 15


def cache_ttl(url: str) -> int:
    # Data yang jarang berubah (profil, kepemilikan, aksi korporasi) disimpan setengah hari;
    # harga/candle 10 menit saat bursa buka dan sampai sesi berikutnya saat tutup.
    if re.search(r"corpaction|tenderoffer|majorholder|emitten|profile|keystats|financial|shareholding", url):
        return 12 * 3600
    if "/stream/" in url:
        return 60 * 60
    if "timeframe=3y" in url:
        # Deret 3 tahun untuk siklus/benchmark: candle hari ini tidak mengubah polanya.
        return 12 * 3600
    if re.search(r"stockbit\.com/symbol/|chartbit|/charts/|prices|orderbook|running|marketdetector", url):
        return 10 * 60 if market_open() else 12 * 3600
    return 60 * 60


# Statistik pemakaian Stockbit (1 jam terakhir) untuk /api/status.
FRESH_MIN_AGE = 5 * 60  # fresh=1 tidak memanggil ulang salinan yang umurnya < 5 menit
# Pengecualian tab Live: grafik IHSG intraday boleh diambil ulang bila salinan > 15 detik (hanya oleh live_loop).
LIVE_URL = re.compile(r"/charts/IHSG/daily\?timeframe=(today|1d)$|/company-price-feed/v2/orderbook/companies/\w+$")
LIVE_FRESH_AGE = 15
FAIL_BACKOFF = 5 * 60   # jeda setelah panggilan gagal sebelum mencoba Stockbit lagi
_fail_until: dict[str, int] = {}
_stats_lock = threading.Lock()
_upstream: list[float] = []
_upstream_n = 0  # total panggilan Stockbit sejak server jalan (tidak berkurang)
_hits: list[float] = []


def _stat(bucket: list[float]) -> None:
    now = time.time()
    with _stats_lock:
        bucket.append(now)
        while bucket and bucket[0] < now - 3600:
            bucket.pop(0)


def stats_1h() -> dict:
    now = time.time()
    with _stats_lock:
        return {"upstream": sum(1 for t in _upstream if t >= now - 3600),
                "cacheHits": sum(1 for t in _hits if t >= now - 3600)}


def cache_read(url: str, min_time: int) -> str | None:
    con = db()
    if not con:
        return None
    with _db_lock:
        row = con.execute("SELECT body FROM http_cache WHERE url=? AND fetched_at>=?",
                          (url, min_time)).fetchone()
    return row[0] if row else None


CACHE_KEEP_DAYS = 14   # salinan cache yang tidak disegarkan selama ini dibuang (batas umur data basi)


def cache_prune(days: int = CACHE_KEEP_DAYS) -> int:
    """Hapus salinan cache yang lebih tua dari `days` hari; kembalikan jumlah baris terhapus."""
    con = db()
    if not con:
        return 0
    with _db_lock:
        n = con.execute("DELETE FROM http_cache WHERE fetched_at < ?", (int(time.time()) - days * 86400,)).rowcount
        con.commit()
    now = int(time.time())
    for u in [u for u, t in _fail_until.items() if t < now]:
        _fail_until.pop(u, None)
    return n


def cache_write(url: str, body: str) -> None:
    con = db()
    if not con:
        return
    with _db_lock:
        con.execute("INSERT OR REPLACE INTO http_cache VALUES(?,?,?)",
                    (url, body, int(time.time())))
        con.commit()


# ----------------------------------------------------------------- data ----
# Data radar tim (item, update, posisi node diagram). Terpisah dari cache supaya
# .cache.sqlite boleh dihapus tanpa kehilangan catatan tim.

DATA_DB = ROOT / ".radar.sqlite"
TICKER_RE = re.compile(r"^[A-Z]{4}$")
MAX_BODY = 8_000_000
_data_lock = threading.Lock()
_data: sqlite3.Connection | None = None


def data_db() -> sqlite3.Connection:
    global _data
    with _data_lock:
        if _data is None:
            _data = sqlite3.connect(DATA_DB, check_same_thread=False)
            _data.execute("PRAGMA journal_mode=WAL")
            _data.executescript(
                "CREATE TABLE IF NOT EXISTS items(ticker TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);"
                "CREATE TABLE IF NOT EXISTS updates(id TEXT PRIMARY KEY, data TEXT NOT NULL, date TEXT);"
                "CREATE TABLE IF NOT EXISTS layout(ticker TEXT PRIMARY KEY, data TEXT NOT NULL);"
                "CREATE TABLE IF NOT EXISTS kandidat_hidden(ticker TEXT PRIMARY KEY, hidden_at INTEGER NOT NULL);"
                "CREATE TABLE IF NOT EXISTS snapshots(day TEXT NOT NULL, ticker TEXT NOT NULL, taken_at INTEGER NOT NULL,"
                " data TEXT NOT NULL, PRIMARY KEY(day, ticker));")
            _data.commit()
        return _data


def data_rows(sql: str, args: tuple = ()) -> list:
    con = data_db()
    with _data_lock:
        return con.execute(sql, args).fetchall()


def data_exec(sql: str, rows: list[tuple]) -> None:
    con = data_db()
    with _data_lock:
        con.executemany(sql, rows)
        con.commit()


def items_all() -> list[dict]:
    return [json.loads(r[0]) for r in data_rows("SELECT data FROM items ORDER BY ticker")]


def item_put(item: dict) -> None:
    data_exec("INSERT OR REPLACE INTO items VALUES(?,?,?)",
              [(item["ticker"], json.dumps(item, ensure_ascii=False), int(time.time()))])


def updates_all() -> list[dict]:
    return [json.loads(r[0]) for r in data_rows("SELECT data FROM updates ORDER BY date DESC")]


def updates_put(ups: list[dict]) -> None:
    data_exec("INSERT OR REPLACE INTO updates VALUES(?,?,?)",
              [(str(u["id"]), json.dumps(u, ensure_ascii=False), str(u.get("date") or "")) for u in ups])


def valid_item(it) -> bool:
    return isinstance(it, dict) and isinstance(it.get("ticker"), str) and bool(TICKER_RE.match(it["ticker"]))


def valid_update(u) -> bool:
    return isinstance(u, dict) and isinstance(u.get("id"), (str, int)) and str(u["id"]) != ""


def migrate(payload: dict) -> dict:
    """Impor data localStorage lama. Hanya berjalan bila tabel items masih kosong,
    supaya perangkat kedua tidak menimpa data tim."""
    if data_rows("SELECT 1 FROM items LIMIT 1"):
        return {"migrated": False, "reason": "sudah ada data di server"}
    items = [it for it in (payload.get("items") or []) if valid_item(it)]
    ups = [u for u in (payload.get("updates") or []) if valid_update(u)]
    for it in items:
        item_put(it)
    if ups:
        updates_put(ups)
    return {"migrated": True, "items": len(items), "updates": len(ups)}


class Stale(Exception):
    """Dibangkitkan fetch untuk menandakan salinan lama boleh dipakai."""


class PublicNoCache(Exception):
    """Pengunjung publik meminta data yang belum ada di cache."""


# Pengunjung lewat domain publik (Cloudflare Tunnel) tidak boleh menulis data tim. Membaca data
# Stockbit/berita boleh, tetapi dibatasi: hanya untuk emiten di radar (atau permintaan tanpa kode),
# memakai TTL cache biasa (tanpa "fresh"), dan dalam jatah panggilan sumber per jendela waktu.
# Di luar itu (kode di luar radar, jatah habis) pengunjung hanya mendapat salinan cache.
_req = threading.local()
PUBLIC_BUDGET = 150          # panggilan sumber dari pengunjung publik per jendela
PUBLIC_WINDOW = 600          # detik
_pub_calls: list[float] = []
_pub_lock = threading.Lock()


def is_public_request() -> bool:
    return getattr(_req, "public", False)


def public_budget_ok() -> bool:
    now = time.time()
    with _pub_lock:
        while _pub_calls and _pub_calls[0] < now - PUBLIC_WINDOW:
            _pub_calls.pop(0)
        if len(_pub_calls) >= PUBLIC_BUDGET:
            return False
        _pub_calls.append(now)
        return True


def radar_tickers() -> set[str]:
    """Emiten yang boleh diambil datanya oleh pengunjung publik: data tim + kandidat otomatis."""
    t = {i["ticker"] for i in items_all()}
    if _kd_memo:
        t |= {k["ticker"] for k in _kd_memo[1].get("items", [])}
    return t


# ---- Data intel pasar dari tradersaham.com (snapshot JSON statis) ----------------
_TSA_MEMO: dict[str, tuple[float, dict]] = {}
TSA_DIR = ROOT  # tempat tsa-*.json (ditulis tsa_refresh.py)


def tsa_load(name: str) -> dict:
    """Muat tsa-<name>.json dengan memo 5 menit; bila file hilang, kembalikan {}."""
    now = time.time()
    hit = _TSA_MEMO.get(name)
    if hit and now - hit[0] < 300:
        return hit[1]
    try:
        data = json.loads((TSA_DIR / f"tsa-{name}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    _TSA_MEMO[name] = (now, data)
    return data


TSA_SETS = ("signals", "gems", "foreign-flow", "broker-scanner")


def tsa_full(name: str) -> dict:
    """Dataset penuh satu sumber tradersaham sebagai daftar baris + meta (halaman Intel Pasar)."""
    d = tsa_load(name)
    rows = list(d.values()) if isinstance(d, dict) and name in ("signals", "gems") else \
        d.get("stocks", []) if isinstance(d, dict) else d
    return {"name": name, "meta": tsa_load("meta"), "rows": rows}


def tsa_summary(ticker: str) -> dict:
    """Gabungkan seluruh data tradersaham untuk satu emiten: teknikal+broker (signals),
    skor gems, arus asing list, dan net broker scanner bila tersedia."""
    ticker = ticker.upper()
    sig = tsa_load("signals").get(ticker)
    gm = tsa_load("gems").get(ticker)
    ff = next((x for x in tsa_load("foreign-flow") if x.get("stock_code") == ticker), None)
    bs = next((x for x in tsa_load("broker-scanner").get("stocks", [])
               if x.get("stockCode") == ticker), None)
    return {
        "ticker": ticker,
        "meta": tsa_load("meta"),
        "ada": bool(sig or gm or ff or bs),
        "signals": sig,
        "gems": gm,
        "foreignFlow": ff,
        "brokerScanner": bs,
    }


def cached_text(url: str, fetch, fresh: bool = False) -> str:
    """Ambil dari cache bila segar; bila tidak, jalankan fetch lalu simpan.
    Bila fetch gagal, salinan lama dipakai daripada error."""
    now = int(time.time())
    if is_public_request() and not getattr(_req, "public_fetch", False):
        hit = cache_read(url, 0)
        if hit is None:
            raise PublicNoCache("Data ini belum tersedia di versi publik.")
        _stat(_hits)
        return hit
    # fresh=1 (tombol "Perbarui") tetap memakai salinan yang baru diambil < 5 menit lalu,
    # supaya klik berulang atau beberapa perangkat sekaligus tidak memanggil Stockbit lagi.
    umur = (LIVE_FRESH_AGE if LIVE_URL.search(url) else FRESH_MIN_AGE) if fresh else cache_ttl(url)
    hit = cache_read(url, now - umur)
    if hit is None and _fail_until.get(url, 0) > now:
        # Baru saja gagal (mis. token kedaluwarsa): jangan ulangi selama jeda, pakai salinan lama.
        hit = cache_read(url, 0)
    if hit is not None:
        _stat(_hits)
        return hit
    if is_public_request() and not public_budget_ok():
        hit = cache_read(url, 0)
        if hit is None:
            raise PublicNoCache("Versi publik sedang ramai; coba lagi beberapa menit lagi.")
        return hit
    global _upstream_n
    try:
        _stat(_upstream)
        _upstream_n += 1
        body = fetch()
    except Exception as e:
        _fail_until[url] = now + FAIL_BACKOFF
        # Galat terakhir (tanpa token/kueri) untuk /api/status: jalur URL, waktu, dan pesan singkat.
        _galat.append({"waktu": datetime.now(timezone(timedelta(hours=7))).strftime("%H:%M:%S"),
                       "jalur": re.sub(r"\?.*$", "", url.replace(SB, ""))[:80], "pesan": str(e)[:120]})
        del _galat[:-15]
        old = cache_read(url, 0)
        if old is not None:
            print(f"[cache] basi dipakai ({e}): {url}", file=sys.stderr)
            return old
        raise
    _fail_until.pop(url, None)
    cache_write(url, body)
    return body

# ------------------------------------------------------------- http util ----

_galat: list[dict] = []
_inflight: dict[str, threading.Lock] = {}
_inflight_lock = threading.Lock()


def http_get(url: str, headers: dict, timeout: int = 20) -> str:
    """GET dengan dedup in-flight: request identik paralel menunggu satu fetch."""
    with _inflight_lock:
        lock = _inflight.setdefault(url, threading.Lock())
    with lock:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        finally:
            with _inflight_lock:
                if _inflight.get(url) is lock and not lock.locked():
                    _inflight.pop(url, None)


def http_get_api(url: str, token: str) -> str:
    return http_get(url, {
        "Authorization": f"Bearer {token}", "Accept": "application/json",
        "Origin": "https://stockbit.com", "Referer": "https://stockbit.com/",
        "User-Agent": UA_BROWSER,
    }, timeout=15)

# ----------------------------------------------------------- stockbit API ----


def page_props(ticker: str, fresh: bool = False) -> dict:
    """__NEXT_DATA__ dari halaman publik stockbit.com/symbol/XXXX (tanpa token)."""
    url = f"https://stockbit.com/symbol/{ticker}"
    raw = cached_text(url, lambda: http_get(url, {"User-Agent": UA_PAGE}), fresh)
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)
    if not m:
        raise RuntimeError("Format halaman Stockbit berubah (__NEXT_DATA__ tidak ditemukan).")
    return json.loads(m.group(1))["props"]["pageProps"]


def page_quote(ticker: str, fresh: bool = False) -> dict:
    """Quote tanpa token dari halaman publik; bentuk sama dengan jalur API."""
    co = page_props(ticker, fresh).get("company", {})

    def numv(v):
        try:
            return float(v) if v not in ("", None) else None
        except (TypeError, ValueError):
            return None

    price = numv(co.get("lastprice")) or numv(co.get("price"))
    return {
        "ticker": ticker, "name": co.get("name") or "", "price": price, "mcap": None,
        "float": None, "uma": co.get("uma") is True,
        "corpAction": (co.get("corp_action") or {}).get("active") is True,
        "volume": numv(co.get("volume")), "avgVolume": numv(co.get("average")),
        "change": numv(co.get("change")), "pctChange": numv(co.get("percentage_change")),
        "pageFallback": True,
    }


class NoToken(Exception):
    pass


class Upstream401(Exception):
    pass


def stockbit_api(full_url: str, fresh: bool = False) -> dict:
    """Panggil endpoint API Stockbit dengan token Bearer; JSON kembali."""
    token = get_token()
    if not token:
        raise NoToken()
    if fresh or token_expired():
        # Token kedaluwarsa: coba dulu (server mungkin menerima), gagal → fallback lewat Stale.
        pass
    text = cached_text(full_url, lambda: http_get_api(full_url, token), fresh)
    return json.loads(text)


def token_expired() -> bool:
    exp = token_exp()
    return bool(exp and exp < time.time())

# ------------------------------------------------------------- kategori ----


def news_type(title: str) -> str:
    t = title.lower()
    if re.search(r"tender|\bmto\b", t):
        return "tender"
    if re.search(r"pengalihan saham|pengambilalihan|pengendali|akuisisi|akusisi|acquisition|caplok|negosiasi|backdoor|"
                 r"cessie|pengalihan (hak )?(tagih|piutang)|perubahan kreditur", t):
        return "pengendali"
    if re.search(r"hmetd|hak memesan|rights issue|penambahan modal|private placement|inbreng", t):
        return "rights"
    if re.search(r"rups|rapat umum", t):
        return "rupslb"
    if re.search(r"\buma\b|suspensi|penghentian sementara|unusual|volatilitas", t):
        return "uma"
    return "lainnya"


def clean_text(s: str) -> str:
    s = re.sub(r"<!\[CDATA\[|\]\]>", "", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s)
    return html_mod.unescape(s).strip()


def source_articles(src: dict) -> list[dict]:
    url = src["url"]
    raw = cached_text(url, lambda: http_get(url, {"User-Agent": UA_BROWSER}, 15))
    out = []
    if src.get("type") == "rss":
        for m in re.finditer(r"<item>([\s\S]*?)</item>", raw):
            x = m.group(1)
            title = clean_text(re.search(r"<title>([\s\S]*?)</title>", x).group(1)) \
                if re.search(r"<title>([\s\S]*?)</title>", x) else ""
            link_m = re.search(r"<link>([\s\S]*?)</link>", x)
            desc_m = re.search(r"<description>([\s\S]*?)</description>", x)
            pub_m = re.search(r"<pubDate>([\s\S]*?)</pubDate>", x)
            date = None
            if pub_m and pub_m.group(1).strip():
                try:
                    from email.utils import parsedate_to_datetime
                    date = parsedate_to_datetime(pub_m.group(1).strip()).astimezone().strftime("%Y-%m-%d")
                except Exception:
                    pass
            if title and link_m:
                out.append({"title": title, "url": clean_text(link_m.group(1)),
                            "desc": clean_text(desc_m.group(1)) if desc_m else "", "date": date})
    else:
        seen = set()
        pat = re.compile(src.get("pattern", r"$^"))
        for m in re.finditer(r'<a\b([^>]*?)href="([^"#]+)"([^>]*)>([\s\S]{0,2500}?)</a>', raw):
            href = m.group(2)
            if not pat.search(href) or href in seen:
                continue
            inner = m.group(4)
            alt = re.search(r'\balt="([^"]{20,})"', inner)
            title = clean_text(alt.group(1)) if alt else clean_text(inner)
            if not (25 <= len(title) <= 250):
                continue
            seen.add(href)
            out.append({"title": title, "url": href, "desc": "", "date": None})
    return out


def get_news(cfg_news: dict, tickers: list[str], fresh: bool = False) -> dict:
    kw = cfg_news.get("keywords", r"$^")
    items, errors = [], []
    tick_re = (re.compile(
        r"Tbk\.?\s*\((" + "|".join(tickers) + r")\)|\b(?:saham|emiten|kode|perseroan)\s+("
        + "|".join(tickers) + r")\b|\b(" + "|".join(tickers) + r")\s+Tbk\b", re.I)
        if tickers else None)
    today = datetime.now().strftime("%Y-%m-%d")
    for src in cfg_news.get("sources", []):
        try:
            for a in source_articles(src):
                text = f"{a['title']} {a['desc']}"
                hit = ""
                if tick_re and (m := tick_re.search(text)):
                    hit = next(g for g in m.groups() if g).upper()
                if not (re.search(kw, text, re.I) or hit):
                    continue
                if not hit:
                    m = re.search(r"\(([A-Z]{4})\)", a["title"])
                    hit = m.group(1) if m else ""
                nid = hashlib.md5(a["url"].encode()).hexdigest()[:16]
                desc = a["desc"] or ""
                items.append({
                    "id": f"news-{nid}", "date": a["date"] or today, "ticker": hit,
                    "type": news_type(a["title"]), "title": a["title"],
                    "summary": desc[:300] if len(desc) > 20 else "",
                    "source": src["name"], "url": a["url"],
                })
        except Exception as e:
            code = f"HTTP {getattr(getattr(e, 'reason', None), 'code', '')}" if isinstance(e, urllib.error.URLError) else str(e)
            errors.append({"source": src["name"], "error": code})
    return {"items": items, "errors": errors}

# ------------------------------------------------ data profil & skeleton ----

SB = "https://exodus.stockbit.com"


def get_by_path(obj, path: str):
    cur = obj
    for seg in path.split("."):
        if cur is None:
            return None
        cur = cur[int(seg)] if isinstance(cur, list) and seg.isdigit() else \
            (cur.get(seg) if isinstance(cur, dict) else None)
    return cur


def to_num(s):
    if s is None or str(s).strip() in ("-", "", "None"):
        return None
    s = str(s)
    neg = bool(re.match(r"^\(.*\)$", s)) or s.strip().startswith("-")
    m = re.search(r"([\d.,]+)\s*([KMBT])?", s)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    v *= {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}.get(m.group(2) or "", 1)
    return -v if neg else v


def sb_fetch(path: str, fresh: bool = False) -> dict:
    return stockbit_api(SB + path, fresh)


def insider_moves(ticker: str, max_pages: int = 8, fresh: bool = False) -> list[dict]:
    out = []
    for pg in range(1, max_pages + 1):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        out += j.get("data", {}).get("movement") or []
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    return out


def norm_name(s: str) -> str:
    s = re.sub(r"\b(PT|TBK|LTD|PTE|LIMITED|INC)\b", "", (s or "").upper())
    return re.sub(r"[^A-Z0-9]", "", s)


def holder_key(s: str) -> str:
    """Kunci pemegang yang tahan urutan kata: keterbukaan kadang menulis nama yang sama dengan kata tertukar
    (mis. "TRIPLE BERKAH BERSAMA" vs "TRIPLE BERSAMA BERKAH")."""
    s = re.sub(r"\b(PT|TBK|LTD|PTE|LIMITED|INC)\b", " ", (s or "").upper())
    return " ".join(sorted(re.sub(r"[^A-Z0-9]+", " ", s).split()))


def canon_names(rows: list[dict]) -> list[dict]:
    """Seragamkan nama pemegang dengan kunci sama (per emiten) ke ejaan yang paling sering muncul."""
    count: dict = {}
    for r in rows:
        k = (r.get("ticker", ""), holder_key(r["name"]))
        count.setdefault(k, {}).setdefault(r["name"], 0)
        count[k][r["name"]] += 1
    best = {k: max(v.items(), key=lambda x: x[1])[0] for k, v in count.items()}
    for r in rows:
        r["name"] = best[(r.get("ticker", ""), holder_key(r["name"]))]
    return rows


def parse_pct(s) -> float:
    return float(re.sub(r"[^\d.]", "", str(s)) or 0)


def parse_date_ddmmyy(s):
    for fmt in ("%d %b %y", "%d %B %y"):
        try:
            return datetime.strptime(str(s).strip(), fmt)
        except ValueError:
            continue
    return None


# Stockbit memisahkan jabatan pengurus per kunci; Direktur/Komisaris Utama ada di kunci tersendiri.
EXEC_DIR = [("president_director", "Direktur Utama"), ("vice_president", "Wakil Direktur Utama"), ("director", "")]
EXEC_COM = [("president_commissioner", "Komisaris Utama"), ("independent_president_commissioner", "Komisaris Utama, independen"),
            ("vice_president_commissioner", "Wakil Komisaris Utama"),
            ("independent_vice_president_commissioner", "Wakil Komisaris Utama, independen"),
            ("commissioner", ""), ("independent_commissioner", "independen")]


def exec_names(ke: dict, keys: list) -> list:
    """Nama pengurus berurutan dari jabatan tertinggi, dengan label jabatan khusus dalam kurung."""
    out, seen = [], set()
    for k, label in keys:
        for x in ke.get(k) or []:
            name = re.sub(r"\s+", " ", str((x or {}).get("value") or "")).strip()
            if not name or name.upper() in seen:
                continue
            seen.add(name.upper())
            out.append(f"{name} ({label})" if label else name)
    return out


def holders_one_pct(p: dict) -> list:
    """Pemegang ≥1% (KSEI bulanan) dari profil Stockbit."""
    rows = (p.get("shareholder_one_percent") or {}).get("shareholder") or []
    return [{"name": str(s.get("name") or "").strip(), "pct": to_num(str(s.get("percentage") or "").rstrip("%")),
             "shares": to_num(str(s.get("value") or "").replace(",", ""))} for s in rows if s.get("name")]


def get_profile(ticker: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    k = sb_fetch(f"/keystats/ratio/v1/{ticker}?year_limit=10", fresh).get("data", {})
    kv = {}
    for g in k.get("closure_fin_items_results") or []:
        for f in g.get("fin_name_results") or []:
            fi = f.get("fitem") or {}
            kv[fi.get("name") or ""] = fi.get("value")
    year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    prices = [x for x in chart_prices(ticker, fresh) if x["d"] >= year_ago]
    step = max(1, len(prices) // 60)
    chart = prices[::step] + prices[-1:]
    ke = p.get("key_executive") or {}
    stats = k.get("stats") or {}
    return {
        "ticker": ticker,
        "background": re.sub(r"\s+", " ", str(p.get("background") or "")).strip(),
        "sector": (p.get("classification") or {}).get("sector", {}).get("name", ""),
        "subSector": (p.get("classification") or {}).get("sub_sector", {}).get("name", ""),
        "industry": (p.get("classification") or {}).get("industry", {}).get("name", ""),
        "website": ((p.get("address") or [{}])[0].get("website") or "").strip(),
        "office": ((p.get("address") or [{}])[0].get("office") or "").strip(),
        "shareholders": [{"name": s.get("name"), "pct": s.get("percentage"),
                          "value": s.get("value"),
                          "pengendali": "pengendali" in (s.get("badges") or [])}
                         for s in p.get("shareholder") or []],
        "beneficiary": [b.get("name") for b in p.get("beneficiary") or []],
        "directors": exec_names(ke, EXEC_DIR),
        "commissioners": exec_names(ke, EXEC_COM),
        "holders1": holders_one_pct(p),
        "stats": {"marketCap": to_num(stats.get("market_cap")),
                  "shares": to_num(stats.get("current_share_outstanding")),
                  "freeFloat": to_num(stats.get("free_float")),
                  "ev": to_num(stats.get("enterprise_value"))},
        "metrics": {"pbv": to_num(kv.get("Current Price to Book Value")),
                    "bvps": to_num(kv.get("Current Book Value Per Share")),
                    "epsAnn": to_num(kv.get("Current EPS (Annualised)")),
                    "per": to_num(kv.get("Current PE Ratio (Annualised)")),
                    "equity": to_num(kv.get("Total Equity")),
                    "cash": to_num(kv.get("Cash (Quarter)")),
                    "assets": to_num(kv.get("Total Assets (Quarter)")),
                    "revenueTtm": to_num(kv.get("Revenue (TTM)")),
                    "netIncomeTtm": to_num(kv.get("Net Income (TTM)")),
                    "revGrowth": kv.get("Revenue (Quarter YoY Growth)"),
                    "netMargin": kv.get("Net Profit Margin (Quarter)"),
                    "high52": to_num(kv.get("52 Week High")),
                    "low52": to_num(kv.get("52 Week Low")),
                    "ret1y": kv.get("1 Year Price Returns"),
                    "ret3m": kv.get("3 Month Price Returns"),
                    "ytd": kv.get("Year to Date Price Returns")},
        "chart": chart,
    }


chart_mem: dict[str, tuple[float, list]] = {}
chart_mem_lock = threading.Lock()


def chart_prices(ticker: str, fresh: bool = False) -> list[dict]:
    with chart_mem_lock:
        c = chart_mem.get(ticker)
        if c and time.time() - c[0] < 6 * 3600 and not fresh:
            return c[1]
    res = sb_fetch(f"/charts/{ticker}/daily?timeframe=3y", fresh)
    prices = [{"d": x.get("formatted_date"), "v": float(x["value"])}
              for x in (res.get("data", {}).get("prices") or [])
              if x.get("formatted_date") and x.get("value")]
    with chart_mem_lock:
        chart_mem[ticker] = (time.time(), prices)
    return prices


ohlc_mem: dict[str, tuple[float, list]] = {}


def get_ohlc(ticker: str, tf: str = "1y", fresh: bool = False) -> list[dict]:
    key = f"{ticker}|{tf}"
    c = ohlc_mem.get(key)
    if c and time.time() - c[0] < 30 * 60 and not fresh:
        return c[1]
    res = sb_fetch(f"/charts/{ticker}/daily?timeframe={tf}&chart_type=PRICE_CHART_TYPE_CANDLE", fresh)
    bars = []
    for x in res.get("data", {}).get("prices") or []:
        if not (x.get("formatted_date") and x.get("value")):
            continue
        cl = float(x["value"])
        o = float(x["open"]) if x.get("open") else cl
        bars.append({"d": x["formatted_date"], "o": o, "h": float(x["high"]) if x.get("high") else cl,
                     "l": float(x["low"]) if x.get("low") else cl, "c": cl,
                     "v": float(x.get("volume") or 0)})
    ohlc_mem[key] = (time.time(), bars)
    return bars


def get_ownership(ticker: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    k = sb_fetch(f"/keystats/ratio/v1/{ticker}?year_limit=10", fresh).get("data", {})
    ctrl = [s for s in p.get("shareholder") or [] if "pengendali" in (s.get("badges") or [])]
    guess = False
    if not ctrl:
        ctrl = sorted((s for s in p.get("shareholder") or []
                       if not re.search(r"MASYARAKAT|PUBLIK|PUBLIC", str(s.get("name", "")), re.I)),
                      key=lambda s: parse_pct(s.get("percentage")), reverse=True)[:1]
        guess = bool(ctrl)
    stats = k.get("stats") or {}
    return {"ticker": ticker, "controllerGuess": guess,
            "marketCap": to_num(stats.get("market_cap")),
            "freeFloat": to_num(stats.get("free_float")),
            "controllerPct": round(sum(parse_pct(s.get("percentage")) for s in ctrl), 2) if ctrl else None,
            "controllerName": ", ".join(str(s.get("name")) for s in ctrl) if ctrl else ""}


def get_story(ticker: str, controller: str, near: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    bg = re.sub(r"\s+", " ", str(p.get("background") or "")).strip()
    moves = insider_moves(ticker, 8, fresh)
    rows = []
    for m in moves:
        d = parse_date_ddmmyy(m.get("date"))
        if not d:
            continue
        prev, cur = parse_pct((m.get("previous") or {}).get("percentage")), parse_pct((m.get("current") or {}).get("percentage"))
        if prev > 100 or cur > 100:
            continue
        rows.append({"date": d, "name": str(m.get("name", "")).strip(), "prev": prev,
                     "cur": cur, "action": m.get("action_type") or ""})
    nc = norm_name(controller or "")
    kor = koreksi_registrasi(ticker)
    buys = sorted((r for r in rows if "SELL" not in r["action"] and r["cur"] > r["prev"]
                   and r["date"].strftime("%Y-%m-%d") not in kor),
                  key=lambda r: r["cur"] - r["prev"], reverse=True)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", near or ""):
        nd = datetime.strptime(near, "%Y-%m-%d")
        win = [b for b in buys if nd - timedelta(days=240) <= b["date"] <= nd + timedelta(days=15)]
        if win:
            buys = win
    is_ctrl = lambda n: bool(nc) and (nc in norm_name(n) or norm_name(n) in nc)
    buy = next((b for b in buys if is_ctrl(b["name"])), None)
    if not buy:
        big = sorted((b for b in buys if b["cur"] - b["prev"] >= 15), key=lambda b: b["date"], reverse=True)
        buy = big[0] if big else None
    old = []
    if buy:
        win = [r for r in rows if r["cur"] < r["prev"] and abs((r["date"] - buy["date"]).days) <= 45
               and norm_name(r["name"]) != norm_name(buy["name"])]
        groups: dict[str, list] = {}
        for r in win:
            groups.setdefault(r["name"], []).append(r)
        old = [{"name": n, "before": max(x["prev"] for x in g), "after": min(x["cur"] for x in g),
                "gap": min(abs((x["date"] - buy["date"]).days) for x in g)}
               for n, g in groups.items() if max(x["prev"] for x in g) >= 5]
        # Bila ada penjual besar (≥20%), itulah pengendali lama; pemegang kecil yang keluar beberapa minggu
        # sebelumnya bukan bagian dari pengalihan (mis. GPSO: dua pemegang 7,5% keluar Sep 2025, akuisisi Okt).
        if any(o["before"] >= 20 for o in old):
            old = [o for o in old if o["before"] >= 20 or o["gap"] <= 7]
        for o in old:
            o.pop("gap", None)
        # Porsi pembeli setelah pengalihan: puncak dari seluruh pembelian pembeli dalam 7 hari (transaksi bisa dipecah).
        same = [r for r in rows if norm_name(r["name"]) == norm_name(buy["name"]) and 0 <= (r["date"] - buy["date"]).days <= 7]
        if same:
            buy = {**buy, "cur": max(r["cur"] for r in same)}
        old = sorted(old, key=lambda o: o["before"], reverse=True)[:4]
        if not old:
            prior = sorted((r for r in rows if r["date"] < buy["date"]
                            and max(r["prev"], r["cur"]) >= 20
                            and norm_name(r["name"]) != norm_name(buy["name"])),
                           key=lambda r: r["date"], reverse=True)
            if prior:
                old = [{"name": prior[0]["name"], "before": max(prior[0]["prev"], prior[0]["cur"]),
                        "after": None, "inferred": True}]
    cls = p.get("classification") or {}
    takeover = {"date": buy["date"].strftime("%Y-%m-%d"), "buyer": buy["name"],
                "before": buy["prev"], "after": buy["cur"]} if buy else None
    return {"ticker": ticker,
            "sector": cls.get("sector", {}).get("name", ""),
            "subSector": cls.get("sub_sector", {}).get("name", ""),
            "industry": cls.get("industry", {}).get("name", ""),
            "background": bg[:420] + "…" if len(bg) > 420 else bg,
            "takeover": takeover, "oldControllers": old}


def get_controller(ticker: str, name: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    nc = norm_name(name or "")
    hid, hname = None, name or ""
    for pg in range(1, 9):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        hit = next((m for m in j.get("data", {}).get("movement") or []
                    if nc and (nc in norm_name(m.get("name")) or norm_name(m.get("name")) in nc)), None)
        if hit:
            hid, hname = str(hit.get("id")), str(hit.get("name", "")).strip()
            break
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    holdings = []
    if hid:
        moves = []
        for pg in range(1, 7):
            j = sb_fetch(f"/insider/company/majorholder?insider={hid}&page={pg}", fresh)
            moves += j.get("data", {}).get("movement") or []
            if not j.get("data", {}).get("is_more"):
                break
            time.sleep(0.2)
        rows = []
        for m in moves:
            d = parse_date_ddmmyy(m.get("date"))
            if d and m.get("symbol"):
                rows.append({"symbol": m["symbol"], "date": d,
                             "cur": parse_pct((m.get("current") or {}).get("percentage")),
                             "action": str(m.get("action_type", "")).replace("ACTION_TYPE_", ""), "_i": len(rows)})
        by: dict[str, list] = {}
        for r in rows:
            by.setdefault(r["symbol"], []).append(r)
        holdings = sorted(({"symbol": s, "pct": g[0]["cur"],
                            "lastDate": g[0]["date"].strftime("%Y-%m-%d"),
                            "lastAction": g[0]["action"],
                            "since": g[-1]["date"].strftime("%Y-%m-%d")}
                           for s, g in by.items()), key=lambda h: h["pct"], reverse=True)
    ke = p.get("key_executive") or {}
    ctrl = next((s for s in p.get("shareholder") or []
                 if nc and (nc in norm_name(s.get("name")) or norm_name(s.get("name")) in nc)), None)
    return {"ticker": ticker, "name": hname, "holderId": hid,
            "pct": ctrl.get("percentage") if ctrl else "",
            "shares": ctrl.get("value") if ctrl else "",
            "nationality": ctrl.get("nationality") if ctrl else "",
            "beneficiary": [b.get("name") for b in p.get("beneficiary") or []],
            "directors": exec_names(ke, EXEC_DIR),
            "commissioners": exec_names(ke, EXEC_COM),
            "holdings": holdings}


def get_insider(ticker: str, days: int = 180, fresh: bool = False) -> dict:
    cutoff = datetime.now() - timedelta(days=days)
    rows = []
    for pg in range(1, 9):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        page = j.get("data", {}).get("movement") or []
        for m in page:
            d = parse_date_ddmmyy(m.get("date"))
            if not d:
                continue
            prev, cur = to_num((m.get("previous") or {}).get("percentage")), to_num((m.get("current") or {}).get("percentage"))
            if (prev or 0) > 100 or (cur or 0) > 100:
                continue
            rows.append({"date": d, "name": str(m.get("name", "")).strip(),
                         "action": str(m.get("action_type", "")).replace("ACTION_TYPE_", ""),
                         "prev": prev or 0, "cur": cur or 0,
                         "price": to_num((m.get("price_formatted") or ""))})
        if not j.get("data", {}).get("is_more") or (rows and min(r["date"] for r in rows) < cutoff):
            break
        time.sleep(0.2)
    recent = canon_names([r for r in rows if r["date"] >= cutoff])
    groups: dict[str, list] = {}
    for r in recent:
        groups.setdefault(r["name"], []).append(r)
    holders = sorted(({
        "name": n, "from": g[-1]["prev"], "to": g[0]["cur"],
        "change": round(g[0]["cur"] - g[-1]["prev"], 2),
        "buys": sum(1 for x in g if x["action"] == "BUY"),
        "sells": sum(1 for x in g if x["action"] == "SELL"),
        "lastDate": g[0]["date"].strftime("%Y-%m-%d"),
        "firstDate": g[-1]["date"].strftime("%Y-%m-%d"),
        "lastPrice": g[0]["price"],
    } for n, g in groups.items()), key=lambda h: abs(h["change"]), reverse=True)
    return {"ticker": ticker, "days": days, "holders": holders}


def insider_row(m: dict) -> dict | None:
    """Satu baris keterbukaan pemegang saham (IDX/KSEI) Stockbit dalam bentuk ringkas untuk tab Insider Activity."""
    d = parse_date_ddmmyy(m.get("date"))
    if not d:
        return None
    pv, cv, ch = m.get("previous") or {}, m.get("current") or {}, m.get("changes") or {}
    prev, cur = to_num(pv.get("percentage")), to_num(cv.get("percentage"))
    if (prev or 0) > 100 or (cur or 0) > 100:
        return None
    sh = lambda o: to_num(str(o.get("value") or "").replace(",", "").replace("+", ""))
    return {
        "date": d.strftime("%Y-%m-%d"), "ticker": str(m.get("symbol") or "").upper(),
        "name": re.sub(r"\s+", " ", str(m.get("name") or "")).strip(),
        "prev": prev or 0, "cur": cur or 0, "chg": round((cur or 0) - (prev or 0), 4),
        "prevShares": sh(pv), "curShares": sh(cv), "chgShares": sh(ch),
        "price": to_num(((m.get("price") or {}).get("raw") or {}).get("value")),
        "estPrice": bool(m.get("is_estimated_price")),
        "value": to_num(((m.get("value") or {}).get("raw") or {}).get("value")),
        "action": str(m.get("action_type") or "").replace("ACTION_TYPE_", ""),
        "purpose": str(m.get("purpose") or "").strip(),
        "source": "KSEI" if "KSEI" in str((m.get("data_source") or {}).get("type")) else "IDX",
        "broker": str((m.get("broker_detail") or {}).get("code") or ""),
        "foreign": "FOREIGN" in str(m.get("nationality") or ""),
        "role": ("direksi" if any("DIREKTUR" in b for b in m.get("badges") or [])
                 else "komisaris" if any("KOMISARIS" in b for b in m.get("badges") or []) else ""),
    }


def merge_ksei(rows: list[dict]) -> list[dict]:
    """Data KSEI dicatat per rekening efek: satu pemegang di satu tanggal muncul beberapa baris berantai
    (mis. 0→4,28, 4,28→4,97, 4,97→5,13). Baris pertama selalu mulai dari 0 sehingga tampak seperti pembelian
    besar. Gabungkan menjadi satu baris per pemegang per tanggal: porsi akhir = ujung rantai. Porsi awal 0 diganti
    porsi akhir tanggal KSEI sebelumnya (bila ada di data); rantai multi-rekening tanpa riwayat → prevUnknown=True."""
    out, groups = [], {}
    for r in canon_names(rows):
        if r["source"] != "KSEI":
            out.append(r)
            continue
        k = (r["ticker"], r["name"].upper(), r["date"])
        if k not in groups:
            groups[k] = []
            out.append(k)
        groups[k].append(r)
    merged: dict = {}
    for k, g in groups.items():
        prevs = {round(x["prev"], 4) for x in g}
        end = next((x for x in g if round(x["cur"], 4) not in prevs or len(g) == 1), g[0])
        start = min(g, key=lambda x: x["prev"]) if len(g) > 1 else g[0]
        m = {**end, "prev": start["prev"], "prevShares": start["prevShares"],
             "chgShares": (end["curShares"] or 0) - (start["prevShares"] or 0),
             "value": sum(x["value"] or 0 for x in g) or None,
             "broker": ", ".join(dict.fromkeys(x["broker"] for x in g if x["broker"])), "accounts": len(g)}
        merged[k] = m
    # Porsi awal dari tanggal KSEI sebelumnya untuk pemegang yang sama (data terurut terbaru dulu).
    by_holder: dict = {}
    for k in sorted(merged, key=lambda k: k[2]):
        hk = (k[0], k[1])
        m, last = merged[k], by_holder.get(hk)
        if m["prev"] == 0:
            if last is not None:
                m["prev"], m["prevShares"] = last["cur"], last["curShares"]
                m["chgShares"] = (m["curShares"] or 0) - (last["curShares"] or 0)
            elif m["accounts"] > 1:
                m["prevUnknown"] = True
        m["chg"] = round(m["cur"] - m["prev"], 4)
        by_holder[hk] = m
    return [merged[x] if isinstance(x, tuple) else x for x in out]


def get_insider_rows(ticker: str, fresh: bool = False) -> dict:
    """Semua keterbukaan pemegang saham satu emiten (maks. 8 halaman, terbaru dulu)."""
    return {"ticker": ticker, "rows": merge_ksei([r for r in (insider_row(m) for m in insider_moves(ticker, 8, fresh)) if r])}


def get_insider_feed(days: int = 14, fresh: bool = False) -> dict:
    """Keterbukaan pemegang saham seluruh pasar (feed InsiderNews Stockbit) untuk `days` hari terakhir."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    rows, pages = [], 0
    for pg in range(1, 61):
        j = sb_fetch(f"/insider/company/majorholder?page={pg}", fresh)
        pages = pg
        page = [r for r in (insider_row(m) for m in j.get("data", {}).get("movement") or []) if r]
        rows += page
        if not j.get("data", {}).get("is_more") or (page and min(r["date"] for r in page) < cutoff):
            break
        time.sleep(0.15)
    return {"days": days, "since": cutoff, "pages": pages, "rows": merge_ksei([r for r in rows if r["date"] >= cutoff])}


_bm_memo: dict[str, tuple[float, dict]] = {}
BM_MEMO_MAX = 32


def get_benchmark(deals: list[str], fresh: bool = False) -> dict:
    # Hasil dihitung ulang paling sering 10 menit sekali untuk kumpulan transaksi yang sama.
    key = ",".join(sorted(deals))
    hit = _bm_memo.get(key)
    if hit and not fresh and time.time() - hit[0] < 600:
        return hit[1]
    res = _benchmark(deals, fresh)
    _bm_memo[key] = (time.time(), res)
    # Kunci berasal dari parameter pengunjung (deals): batasi jumlahnya supaya memori tidak membengkak.
    while len(_bm_memo) > BM_MEMO_MAX:
        _bm_memo.pop(min(_bm_memo, key=lambda k: _bm_memo[k][0]))
    return res


def _benchmark(deals: list[str], fresh: bool = False) -> dict:
    rows = []
    for dl in deals:
        if ":" not in dl:
            continue
        sym, start = dl.split(":", 1)
        if not (re.match(r"^[A-Z]{4}$", sym) and re.match(r"^\d{4}-\d{2}-\d{2}$", start)):
            continue
        calls0 = _upstream_n  # bukan "before": nama itu dipakai untuk deret harga di bawah
        try:
            pr = chart_prices(sym, fresh)
            d0 = datetime.strptime(start, "%Y-%m-%d")
            pre_from = (d0 - timedelta(days=240)).strftime("%Y-%m-%d")
            run_to = (d0 + timedelta(days=90)).strftime("%Y-%m-%d")
            before = [x for x in pr if pre_from <= x["d"] < start]
            after = [x for x in pr if x["d"] >= start]
            if len(before) < 20 or len(after) < 5:
                continue
            base = min(x["v"] for x in before)
            base_date = next(x["d"] for x in before if x["v"] == base)
            peak = max(x["v"] for x in pr if base_date <= x["d"] <= run_to)
            p0, last = after[0]["v"], after[-1]["v"]
            if base <= 0 or p0 <= 0:
                continue
            peak_date = next((x["d"] for x in pr if base_date <= x["d"] <= run_to and x["v"] == peak), None)

            def day_of(s: str) -> int:
                return (datetime.strptime(s, "%Y-%m-%d") - d0).days

            # Deret siklus: harga ÷ harga saat PTW dimulai, per hari dari awal PTW
            # (tiap 3 bar bursa supaya respons ringan).
            win = [x for x in pr if x["d"] >= pre_from]
            series = [[day_of(win[i]["d"]), round(win[i]["v"] / p0, 4)] for i in range(0, len(win), 3)]
            rows.append({"ticker": sym, "start": start, "base": base, "peak": peak, "p0": p0,
                         "last": last, "runupX": round(peak / base, 2), "postX": round(last / p0, 2),
                         "baseDay": day_of(base_date), "peakDay": day_of(peak_date) if peak_date else None,
                         "lastDay": day_of(after[-1]["d"]), "series": series})
        except Exception:
            continue
        finally:
            # Jeda sopan hanya bila benar-benar memanggil Stockbit (bukan dari cache).
            if _upstream_n > calls0:
                time.sleep(0.2)

    def quart(arr, f):
        s = sorted(arr)
        if not s:
            return None
        i = (len(s) - 1) * f
        lo, hi = int(i // 1), int(-(-i // 1))
        return round(s[lo] + (s[hi] - s[lo]) * (i - lo), 2)

    rx = [r["runupX"] for r in rows]
    px = [r["postX"] for r in rows]
    return {"n": len(rows), "runupQ1": quart(rx, 0.25), "runupMedian": quart(rx, 0.5),
            "runupQ3": quart(rx, 0.75), "postMedian": quart(px, 0.5), "deals": rows}


def convert_reports(res: dict, ticker: str, cfg_reports: dict) -> list[dict]:
    days = int(cfg_reports.get("days") or 180)
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    skip = str(cfg_reports.get("skipTitle") or "")
    out = []
    for s in res.get("data", {}).get("stream") or []:
        title = re.sub(r"\s*\[[A-Z0-9-]+\]\s*$", "", str(s.get("title") or "")).strip()
        created = str(s.get("created_at") or "")
        date = created[:10] if len(created) >= 10 else created
        if not title or date < cutoff or (skip and re.search(skip, title)):
            continue
        t = news_type(title)
        _sum = s.get("summary") or {}
        text = [x for x in [_sum.get("summary"),
                            ("Inti: " + _sum["key_takeaway"]) if _sum.get("key_takeaway") else None] if x]
        points = " · ".join(x for x in (_sum.get("key_points") or []) if x)
        out.append({"id": f"sb-report-{s.get('stream_id')}", "date": date, "ticker": ticker,
                    "type": t, "title": title, "summary": (" ".join(text) + " (Ringkasan AI Stockbit)") if text else "",
                    "points": points, "source": "Stockbit Reports",
                    "url": f"https://stockbit.com/post/{s.get('stream_id')}"})
    return out

def convert_sb_news(res: dict, ticker: str, days: int = 365) -> list[dict]:
    """Berita StockbitNews yang ditandai Stockbit untuk satu emiten (sumber asli: katadata, emitennews, dst.)."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    out = []
    for s in res.get("data", {}).get("stream") or []:
        title = str(s.get("title") or "").strip()
        date = str(s.get("created_at") or "")[:10]
        if not title or date < cutoff:
            continue
        body = re.sub(r"\s+", " ", str(s.get("content") or "")).strip().rstrip(".").removesuffix("...").strip()
        # Cuplikan Stockbit terpotong ("..."): simpan sampai kalimat lengkap terakhir.
        cut = max(body.rfind(". "), body.rfind("! "), body.rfind("? "))
        if body and body[-1] not in ".!?" and cut > 40:
            body = body[:cut + 1]
        src = (s.get("news_feed") or {}).get("label") or (s.get("news_feed") or {}).get("source") or ""
        out.append({"id": f"sb-news-{s.get('stream_id')}", "date": date, "ticker": ticker, "type": news_type(title),
                    "title": title, "summary": body[:400] if len(body) > 20 else "",
                    "source": "StockbitNews" + (f" · {src}" if src else ""),
                    "url": f"https://stockbit.com/post/{s.get('stream_id')}"})
    return out


def get_sb_news(cfg_reports: dict, ticker: str, fresh: bool = False, pages: int = 1, since: str = "") -> list[dict]:
    """Berita StockbitNews per emiten (30 per halaman): endpoint sama dengan laporan, kategori NEWS.
    pages > 1 dipakai saat mengejar ketertinggalan; berhenti setelah melewati tanggal `since`."""
    base = re.sub(r"category=[A-Z_]+", "category=STREAM_CATEGORY_NEWS", cfg_reports["url"])
    base = re.sub(r"&report_type=[A-Z_]+", "", base).replace("{ticker}", ticker)
    days = int(cfg_reports.get("days") or 365)
    out, cursor = [], 0
    for _ in range(max(1, pages)):
        res = stockbit_api(re.sub(r"last_stream_id=\d+", f"last_stream_id={cursor}", base), fresh)
        out += convert_sb_news(res, ticker, days)
        page = res.get("data", {}).get("stream") or []
        pag = res.get("data", {}).get("pagination", {})
        dates = [str(x.get("created_at") or "")[:10] for x in page if x.get("created_at")]
        if pag.get("is_last_page") or not page or (since and dates and min(dates) < since):
            break
        cursor = pag.get("next_cursor") or 0
        time.sleep(0.25)
    return out


def get_reports(cfg_reports: dict, ticker: str, fresh: bool = False, max_pages: int | None = None) -> list[dict]:
    """Keterbukaan informasi satu emiten dari stream Stockbit (beberapa halaman, sampai batas hari)."""
    max_pages = max_pages or int(cfg_reports.get("maxPages") or 1)
    days = int(cfg_reports.get("days") or 180)
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    all_pg, cursor = [], 0
    for _ in range(max_pages):
        url = re.sub(r"last_stream_id=\d+", f"last_stream_id={cursor}", cfg_reports["url"]).replace("{ticker}", ticker)
        res = stockbit_api(url, fresh)
        page = res.get("data", {}).get("stream") or []
        all_pg += page
        dates = [str(x.get("created_at") or "")[:10] for x in page if x.get("created_at")]
        if res.get("data", {}).get("pagination", {}).get("is_last_page") or not page or (dates and min(dates) < cutoff):
            break
        cursor = res.get("data", {}).get("pagination", {}).get("next_cursor") or 0
        time.sleep(0.25)
    return convert_reports({"data": {"stream": all_pg}}, ticker, cfg_reports)


# ------------------------------------------------------------- kandidat ----
# Calon cangkang otomatis: emiten di luar radar yang punya sinyal awal di data seluruh bursa
# (rights issue, UMA, berita), lalu diperiksa keterbukaan informasinya di Stockbit.

KANDIDAT_SIG = [
    ("akuisisi", r"pengendali|pengambilalihan|akuisisi|negosiasi|pengalihan saham|penjualan saham|jual beli saham|"
                 r"ppjb|term sheet|nota kesepahaman|\bmou\b|investor strategis|tender|\bmto\b|backdoor|caplok|"
                 # Sinyal dini: kreditur/utang berpindah ke pihak baru (mis. ANDI: cessie 21 Okt -> pengendali baru 26 Okt).
                 r"cessie|pengalihan (hak )?(tagih|piutang)|perubahan kreditur|kreditur baru|konversi (utang|piutang|pinjaman)|"
                 r"restrukturisasi (utang|pinjaman|kredit)|\bpkpu\b|calon (investor|pengendali)|pemegang saham (utama )?baru"),
    ("kbli", r"kegiatan usaha|\bkbli\b|perubahan nama|nama perseroan"),
    ("rights", r"hmetd|hak memesan|rights issue|penambahan modal|private placement|inbreng"),
    ("direksi", r"perubahan (susunan )?(anggota )?(direksi|dewan komisaris|komisaris|pengurus)|"
                r"pengunduran diri (anggota )?(direk|komisaris)|pengangkatan (direk|komisaris)"),
    ("uma", r"\buma\b|unusual market|suspensi|penghentian sementara|volatilitas"),
]


def market_reports(days: int = 14, pages: int = 40, fresh: bool = False) -> list[dict]:
    """Keterbukaan seluruh BEI dari akun StockbitReports (terbaru dulu) dalam `days` hari:
    [{ticker, date, title, url}]. Dipakai Kandidat agar laporan pergantian pengendali emiten mana pun tertangkap."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    out, cursor = [], 0
    for _ in range(pages):
        j = stockbit_post_api("https://exodus.stockbit.com/stream/v3/user/StockbitReports",
                              {"category": "STREAM_CATEGORY_MAIN_IDEAS", "last_stream_id": cursor, "limit": 100}, fresh)
        d = j.get("data") or {}
        page = d.get("stream") or []
        for p in page:
            day = str(p.get("created_at") or "")[:10]
            title = re.sub(r"\s*\[[A-Z0-9]{4}\]\s*$", "", str(p.get("title") or p.get("content") or "").split(chr(10))[0]).strip()
            for t in p.get("topics") or []:
                if TICKER_RE.match(str(t)) and day >= cutoff:
                    out.append({"ticker": t, "date": day, "title": title[:200], "url": f"https://stockbit.com/post/{p.get('stream_id')}"})
        if not page or (d.get("pagination") or {}).get("is_last_page") or str(page[-1].get("created_at") or "")[:10] < cutoff:
            break
        cursor = (d.get("pagination") or {}).get("next_cursor") or page[-1].get("stream_id")
        time.sleep(0.3)
    return out


def koreksi_registrasi(ticker: str) -> set[str]:
    """Tanggal (± 1 hari) laporan "Registrasi Pemegang Efek (KOREKSI)" emiten ini. Pada tanggal itu KSEI bisa mencatat
    pemegang lama seolah baru masuk dari 0% (mis. ANDI 23 Okt 2026: Central Energi Pratama 0% → 49,73%)."""
    # Laporan registrasi bulanan disaring dari tabel berita (skipTitle), jadi dibaca langsung dari stream Stockbit.
    out = set()
    cfg = (load_config() or {}).get("reports") or {}
    if not cfg.get("url"):
        return out
    try:
        url = re.sub(r"last_stream_id=\d+", "last_stream_id=0", cfg["url"]).replace("{ticker}", ticker)
        page = (stockbit_api(url).get("data") or {}).get("stream") or []
    except Exception:
        return out
    for x in page:
        title = str(x.get("title") or "")
        if re.search(r"registrasi", title, re.I) and re.search(r"koreksi", title, re.I):
            try:
                d0 = datetime.strptime(str(x.get("created_at") or "")[:10], "%Y-%m-%d")
            except ValueError:
                continue
            out |= {(d0 + timedelta(days=k)).strftime("%Y-%m-%d") for k in range(-1, 2)}
    return out


def new_controller(ticker: str, days: int = 45, fresh: bool = False) -> dict | None:
    """Pemegang baru >= 20% (dari < 5%) di keterbukaan KSEI/IDX emiten ini dalam `days` hari terakhir.
    Lonjakan pada tanggal laporan registrasi koreksi diabaikan (pemegang lama yang tercatat ulang)."""
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    kor = koreksi_registrasi(ticker)
    for r in (r for r in (insider_row(m) for m in insider_moves(ticker, 1, fresh)) if r):
        if r["date"] >= cutoff and r["prev"] < 5 and r["cur"] >= 20 and r["date"] not in kor:
            return {"date": r["date"], "name": r["name"].title(), "pct": r["cur"],
                    "text": f"{r['name'].title()} masuk: {r['prev']:g}% → {r['cur']:g}% ({r['source']})"}
    return None


def big_holder_moves(fresh: bool = False, pages: int = 60) -> list[dict]:
    """Perpindahan blok besar: pemegang baru naik ke ≥ 20%, atau pemegang ≥ 20% turun ≥ 10 poin.
    Entri yang dibalik pada tanggal yang sama (koreksi data) dan persentase > 100 diabaikan."""
    raw = []
    for pg in range(1, pages + 1):
        j = sb_fetch(f"/insider/company/majorholder?page={pg}", fresh)
        raw += j.get("data", {}).get("movement") or []
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    rows = []
    for m in raw:
        d = parse_date_ddmmyy(m.get("date"))
        prev = to_num((m.get("previous") or {}).get("percentage")) or 0
        cur = to_num((m.get("current") or {}).get("percentage")) or 0
        if d and prev <= 100 and cur <= 100:
            rows.append((d.strftime("%Y-%m-%d"), str(m.get("symbol") or ""), str(m.get("name") or "").strip(), prev, cur,
                         str(m.get("price_formatted") or "")))
    keys = {(d, t, n, p, c) for d, t, n, p, c, _ in rows}
    out, seen = [], set()
    for d, t, n, p, c, price in rows:
        if (d, t, n, c, p) in keys or (d, t, n, p, c) in seen:
            continue  # pasangan koreksi atau duplikat
        seen.add((d, t, n, p, c))
        if (p < 5 and c >= 20) or (p >= 20 and p - c >= 10):
            verb = "masuk" if c > p else "melepas"
            out.append({"ticker": t, "date": d,
                        "text": f"{n.title()} {verb}: {p:g}% → {c:g}%" + (f" @Rp{price}" if price else "")})
    return out


def kandidat_sigs(title: str) -> list[str]:
    t = (title or "").lower()
    return [sid for sid, rx in KANDIDAT_SIG if re.search(rx, t)]


_kd_memo: tuple[float, dict] | None = None
_kd_lock = threading.Lock()
KANDIDAT_MAX = 40


def get_kandidat(cfg: dict, fresh: bool = False) -> dict:
    # Dihitung ulang paling sering 6 jam sekali; satu perhitungan berjalan pada satu waktu.
    global _kd_memo
    with _kd_lock:
        public = is_public_request()
        if _kd_memo and (public or (not fresh and time.time() - _kd_memo[0] < 3 * 3600)):
            return _kd_memo[1]
        res = _kandidat(cfg, fresh)
        if not public:  # versi publik hanya membaca cache; hasilnya tidak lengkap, jangan disimpan
            _kd_memo = (time.time(), res)
        return res


# ------------------------------------------------------- diff harian ----
# Snapshot ringkas tiap emiten sekali sehari (dini hari), supaya Monitor bisa menunjukkan apa yang berubah
# sejak kemarin atau sejak N hari: harga, porsi pengendali, tonggak transaksi, tender, laporan baru.

SNAP_KEEP_DAYS = 60


def snap_of(item: dict) -> dict:
    return {"price": item.get("price"), "ctrlPct": item.get("ctrlPct"), "ctrlName": item.get("ctrlName") or "",
            "ms": sorted(k for k, v in (item.get("ms") or {}).items() if v),
            "tender": (item.get("tender") or {}).get("price"), "stage": item.get("stage") or ""}


def snapshot_today(force: bool = False) -> str:
    day = datetime.now().strftime("%Y-%m-%d")
    if not force and data_rows("SELECT 1 FROM snapshots WHERE day=? LIMIT 1", (day,)):
        return day
    now = int(time.time())
    data_exec("INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?)",
              [(day, i["ticker"], now, json.dumps(snap_of(i), ensure_ascii=False)) for i in items_all()])
    cutoff = (datetime.now() - timedelta(days=SNAP_KEEP_DAYS)).strftime("%Y-%m-%d")
    data_exec("DELETE FROM snapshots WHERE day < ?", [(cutoff,)])
    return day


def snapshot_loop() -> None:
    """Ambil snapshot saat server mulai (bila hari ini belum ada), lalu tiap hari pukul 00:05."""
    while True:
        try:
            snapshot_today()
            n = cache_prune()
            if n:
                print(f"[cache] {n} salinan lebih tua dari {CACHE_KEEP_DAYS} hari dihapus")
        except Exception as e:
            print(f"[snapshot] gagal: {e}", file=sys.stderr)
        nxt = (datetime.now() + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        time.sleep(max(60, (nxt - datetime.now()).total_seconds()))


def tsa_loop(interval: int = 3600) -> None:
    """Segarkan data intel pasar tradersaham tiap `interval` detik (default 1 jam).

    Menjalankan tsa_refresh.py sebagai proses anak; kegagalan jaringan/auth
    tidak mematikan loop — dicatat ke stderr dan dicoba lagi pada siklus
    berikutnya. File tsa-*.json ditimpa di tempat oleh script, dan pembacaan
    di sisi server pakai memo 5 menit, jadi tidak perlu restart.
    """
    script = ROOT / "tsa_refresh.py"
    if not script.exists():
        print("[tsa] tsa_refresh.py tidak ada — loop dimatikan", file=sys.stderr)
        return
    while True:
        try:
            r = subprocess.run([sys.executable, str(script)], capture_output=True, text=True,
                               timeout=600)
            if r.returncode == 0:
                print(f"[tsa] refresh OK: {r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''}")
            else:
                print(f"[tsa] refresh gagal ({r.returncode}): {(r.stderr or r.stdout).strip()[-300:]}",
                      file=sys.stderr)
        except Exception as e:
            print(f"[tsa] refresh error: {e}", file=sys.stderr)
        time.sleep(interval)


def get_diff(days: int = 1) -> dict:
    """Perubahan tiap emiten dibanding snapshot `days` hari lalu (1 = snapshot dini hari ini = tutup kemarin)."""
    target = (datetime.now() - timedelta(days=max(0, days - 1))).strftime("%Y-%m-%d")
    row = data_rows("SELECT day, MIN(taken_at) FROM snapshots WHERE day <= ? GROUP BY day ORDER BY day DESC LIMIT 1", (target,))
    if not row:
        row = data_rows("SELECT day, MIN(taken_at) FROM snapshots GROUP BY day ORDER BY day ASC LIMIT 1")
    if not row:
        return {"base": None, "items": []}
    base_day, taken = row[0]
    base = {t: json.loads(d) for t, d in data_rows("SELECT ticker, data FROM snapshots WHERE day=?", (base_day,))}
    since_iso = datetime.fromtimestamp(taken, timezone.utc).isoformat().replace("+00:00", "Z")
    new_reports: dict[str, int] = {}
    for u in updates_all():
        if u.get("ticker") and str(u.get("updatedAt") or "") > since_iso:
            new_reports[u["ticker"]] = new_reports.get(u["ticker"], 0) + 1
    out = []
    for item in items_all():
        t, cur, old = item["ticker"], snap_of(item), base.get(item["ticker"])
        ch = []
        if old is None:
            ch.append({"k": "new"})
        else:
            p0, p1 = old.get("price"), cur["price"]
            if p0 and p1 and p0 != p1:
                ch.append({"k": "price", "from": p0, "to": p1, "pct": round((p1 - p0) / p0 * 100, 1)})
            if old.get("ctrlPct") != cur["ctrlPct"] and cur["ctrlPct"] is not None:
                ch.append({"k": "ctrl", "from": old.get("ctrlPct"), "to": cur["ctrlPct"],
                           "name": cur["ctrlName"] if cur["ctrlName"] != old.get("ctrlName") else ""})
            added = [m for m in cur["ms"] if m not in (old.get("ms") or [])]
            if added:
                ch.append({"k": "ms", "added": added})
            if old.get("tender") != cur["tender"] and cur["tender"]:
                ch.append({"k": "tender", "from": old.get("tender"), "to": cur["tender"]})
        if new_reports.get(t):
            ch.append({"k": "reports", "n": new_reports[t]})
        if ch:
            out.append({"ticker": t, "changes": ch})
    return {"base": base_day, "since": since_iso, "items": out}


def deploy_status() -> dict | None:
    """Status CD lokal terakhir (.ci/status.json ditulis deploy/deploy.sh), bila ada."""
    try:
        return json.loads((ROOT.parent / ".ci" / "status.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


PENGENDALI_RX = re.compile(r"pengendali|pengambilalihan|akuisisi", re.I)


def auto_monitor(kd: dict) -> list[str]:
    """Masukkan ke Monitor (tahap radar) emiten dengan pergantian pengendali terkonfirmasi: pemegang baru >= 20%
    di KSEI/IDX dan keterbukaan BEI tentang pengendali/pengambilalihan. Data yang sudah ada tidak ditimpa."""
    ada = {i["ticker"] for i in items_all()}
    added = []
    for k in kd.get("items") or []:
        t = k["ticker"]
        ev = (k.get("signals") or {}).get("akuisisi", {}).get("ev") or []
        lap = [e for e in ev if "stockbit.com/post/" in (e.get("src") or "") and PENGENDALI_RX.search(e.get("text") or "")]
        if t in ada or not k.get("pengendaliBaru") or not lap:
            continue
        nc = k["pengendaliBaru"]
        item_put({"id": t, "ticker": t, "name": k.get("name") or "", "stage": "radar", "flags": k.get("flags") or {"akuisisi": True},
                  "ms": {}, "signals": k.get("signals") or {}, "auto": True,
                  "notes": f"Otomatis: pergantian pengendali terkonfirmasi. {nc['text']} pada {nc['date']}; keterbukaan: {lap[0]['text']} ({lap[0]['d']}).",
                  "updatedAt": datetime.now(timezone.utc).isoformat()})
        added.append(t)
    if added:
        print(f"[kandidat] otomatis masuk Monitor: {', '.join(added)}")
    return added


STORY_V = 2  # sama dengan STORY_V di frontend/src/store.js (kunci story otomatis)


def verified_pengendali() -> dict:
    try:
        return json.loads((ROOT / "pengendali-verified.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
STORY_TTL_MS = 7 * 86400 * 1000


def lengkapi_items(tickers: list[str] | None = None, delay: float = 0.6) -> list[str]:
    """Lengkapi otomatis item Monitor yang masih kosong (situs publik baca-saja tidak bisa memuatnya dari browser):
    harga/kapitalisasi, pengendali (pemegang baru >= 20% di KSEI bila ada, selain itu profil emiten), dan story
    otomatis (pengendali lama, pengambilalihan, bisnis lama). Isian yang sudah ada tidak ditimpa; story dimuat ulang
    bila basi (> 7 hari) atau patokannya berubah."""
    done = []
    for it in items_all():
        t = it["ticker"]
        if tickers and t not in tickers or not TICKER_RE.match(t):
            continue
        new = dict(it)
        pv = verified_pengendali().get(t) or {}
        if pv.get("ctrlName"):
            # Pengendali terverifikasi (pengendali-verified.json) mengalahkan data otomatis KSEI/profil.
            new.update(ctrlName=pv["ctrlName"], ctrlPct=pv.get("ctrlPct"), ctrlGuess=False)
        if isinstance(pv.get("ms"), dict):
            # Tonggak terverifikasi hanya ditambahkan (tidak pernah mematikan tonggak yang sudah tercatat).
            new["ms"] = {**(new.get("ms") or {}), **{k: True for k, v in pv["ms"].items() if v}}
        try:
            if new.get("price") in (None, ""):
                q = page_quote(t)
                if q.get("price") is not None:
                    new["price"] = q["price"]
                if q.get("pctChange") is not None:
                    new["chgPct"] = q["pctChange"]
                if not new.get("name") and q.get("name"):
                    new["name"] = q["name"]
            if not (new.get("ctrlName") or new.get("acquirer")):
                nc = new_controller(t, days=180)
                o = get_ownership(t)
                if o.get("marketCap") and new.get("mcap") in (None, ""):
                    new["mcap"] = round(o["marketCap"] / 1e8) / 10  # rupiah -> Rp miliar
                if o.get("freeFloat") is not None and new.get("float") in (None, ""):
                    new["float"] = o["freeFloat"]
                if nc:  # pengendali baru tercatat KSEI lebih baru dari profil emiten
                    new.update(ctrlName=nc["name"], ctrlPct=nc["pct"], ctrlGuess=False)
                elif o.get("controllerName"):
                    new.update(ctrlName=o["controllerName"], ctrlPct=o.get("controllerPct"), ctrlGuess=bool(o.get("controllerGuess")))
            ctrl = ("" if new.get("ctrlGuess") else new.get("ctrlName") or "") or new.get("acquirer") or ""
            near = (new.get("tender") or {}).get("start") or ""
            key = f"{ctrl}|{near}|v{STORY_V}"
            sa = new.get("storyAuto") or {}
            if not sa or sa.get("key") != key or time.time() * 1000 - (sa.get("at") or 0) > STORY_TTL_MS:
                st = get_story(t, re.sub(r"\s*\(.*\)$", "", ctrl), near)
                new["storyAuto"] = {**st, "at": int(time.time() * 1000), "key": key}
        except Exception as e:
            print(f"[lengkapi] {t} gagal: {str(e)[:120]}", file=sys.stderr)
            if "401" in str(e):
                break
        if new != it:
            new["updatedAt"] = datetime.now(timezone.utc).isoformat()
            item_put(new)
            done.append(t)
        time.sleep(delay)
    if done:
        print(f"[lengkapi] item dilengkapi otomatis: {', '.join(done)}", file=sys.stderr)
    return done


def kandidat_loop() -> None:
    """Hitung kandidat di latar belakang (setelah start, lalu tiap 6 jam) supaya halaman
    Kandidat — termasuk versi publik yang hanya membaca hasil jadi — tidak menunggu pemindaian."""
    time.sleep(20)
    while True:
        cfg = load_config()
        if cfg and get_token():
            try:
                auto_monitor(get_kandidat(cfg))
                lengkapi_items()
            except Exception as e:
                print(f"[kandidat] gagal: {e}", file=sys.stderr)
        time.sleep(3 * 3600 + 60)


# Pembaruan berita di server: situs publik bersifat baca-saja sehingga tidak bisa memicu sinkron dari browser.
NEWS_GAP = 2 * 3600
NEWS_STATE: dict = {"at": None, "added": 0, "addedNews": 0, "errors": []}
# Tonggak yang menandakan emiten sudah keluar dari tahap penyaringan (sama dengan MS_STAGE di frontend).
MS_KEYS = ("bisnis", "inbreng", "kjpp", "rights", "rupslb", "to_selesai", "to_umum", "akuisisi", "spa")


def backdoor_tickers() -> list[str]:
    out = []
    for it in items_all():
        ms = it.get("ms") or {}
        if any(ms.get(k) for k in MS_KEYS) or (it.get("stage") or "radar") != "radar":
            out.append(it["ticker"])
    return out


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


# Stempel sinkron Stockbit terakhir yang berhasil (tidak di-commit). Bila celahnya > CATCHUP_GAP
# (mis. token habis saat libur), sinkron berikutnya mengambil CATCHUP_PAGES halaman per emiten.
SYNC_STATE = ROOT / ".sync-state.json"
CATCHUP_GAP = 2 * 86400
CATCHUP_PAGES = 4


def sync_state() -> dict:
    try:
        return json.loads(SYNC_STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def catchup_plan(last_ok: str | None, now: float | None = None) -> tuple[int, str]:
    """(jumlah halaman per emiten, tanggal batas) dari stempel sinkron terakhir yang berhasil."""
    now = time.time() if now is None else now
    try:
        ts = datetime.fromisoformat(str(last_ok).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return CATCHUP_PAGES, ""
    return (CATCHUP_PAGES, str(last_ok)[:10]) if now - ts > CATCHUP_GAP else (1, str(last_ok)[:10])


def sync_updates(cfg: dict, delay: float = 0.4) -> dict:
    """Setara syncReports di browser: keterbukaan Stockbit per emiten backdoor + berita media,
    digabung ke tabel updates berdasarkan id (stempel updatedAt laporan lama dipertahankan)."""
    old = {str(u["id"]): u for u in updates_all()}
    changed, errors, added, added_news = [], [], 0, 0
    # Semua emiten di monitor (termasuk tahap radar) agar keterbukaan & berita tidak ada yang terlewat.
    codes = [t for t in dict.fromkeys(it["ticker"] for it in items_all()) if TICKER_RE.match(t)]
    st = sync_state()
    pages, since = catchup_plan(st.get("sbOk"))
    ok_any, unauth = False, False
    # Token kedaluwarsa: lewati Stockbit (data cache lama tidak dihitung sebagai sinkron berhasil).
    if cfg.get("reports") and get_token() and not token_expired():
        if pages > 1:
            print(f"[berita] mengejar ketertinggalan sejak {since or 'awal'}: {pages} halaman per emiten", file=sys.stderr)
        for t in codes:
            try:
                # Keterbukaan (Stockbit Reports) + berita StockbitNews yang ditandai untuk emiten ini.
                rows = get_reports(cfg["reports"], t, fresh=True, max_pages=pages) + get_sb_news(cfg["reports"], t, fresh=True, pages=pages, since=since)
                ok_any = True
                for it in rows:
                    prev = old.get(it["id"])
                    if prev is None:
                        added += 1
                        new = {**it, "updatedAt": iso_now()}
                    else:
                        new = {**prev, **it, "updatedAt": prev.get("updatedAt") or iso_now()}
                    if new != prev:
                        changed.append(new)
                        old[it["id"]] = new
            except Exception as e:
                errors.append({"source": t, "error": str(e)[:120]})
                if "401" in str(e):
                    unauth = True
                    break
            time.sleep(delay)
        # Stempel hanya bila seluruh emiten tersinkron dengan token yang masih berlaku.
        if ok_any and not unauth and not token_expired():
            st["sbOk"] = iso_now()
            try:
                SYNC_STATE.write_text(json.dumps(st), encoding="utf-8")
            except OSError:
                pass
    if cfg.get("news"):
        try:
            res = get_news(cfg["news"], codes, fresh=True)
            for it in res["items"]:
                prev = old.get(it["id"])
                if prev is None:
                    added_news += 1
                    new = {**it, "updatedAt": iso_now()}
                else:
                    # Tanggal artikel HTML = tanggal pertama kali terlihat; jangan ditimpa.
                    new = {**prev, **it, "date": prev.get("date") or it["date"]}
                if new != prev:
                    changed.append(new)
                    old[it["id"]] = new
            errors += res["errors"]
        except Exception as e:
            errors.append({"source": "Berita media", "error": str(e)[:120]})
    if changed:
        updates_put(changed)
    try:
        added += sync_akun_reports(cfg)
    except Exception as e:
        errors.append({"source": "Akun StockbitReports", "error": str(e)[:120]})
    NEWS_STATE.update({"at": iso_now(), "added": added, "addedNews": added_news, "errors": errors[:5],
                       "sbOk": st.get("sbOk"), "catchUp": pages > 1 and ok_any})
    return NEWS_STATE


def sync_akun_reports(cfg: dict, days: int = 3, pages: int = 6) -> int:
    """Sinkron cepat: postingan akun StockbitReports (seluruh BEI, terbaru dulu) untuk emiten di monitor.
    Laporan sering muncul di akun ini lebih dulu daripada di kategori REPORTS per emiten (mis. MEJA 28 Okt 2026
    "Rencana Penyelenggaraan Public Expose"), jadi dibaca terpisah agar tidak tertinggal. Mengembalikan jumlah baru."""
    if not (cfg.get("reports") and get_token() and not token_expired()):
        return 0
    codes = {t for t in (it["ticker"] for it in items_all()) if TICKER_RE.match(t)}
    old = {str(u["id"]): u for u in updates_all()}
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    changed, added, cursor = [], 0, 0
    for _ in range(pages):
        j = stockbit_post_api("https://exodus.stockbit.com/stream/v3/user/StockbitReports",
                              {"category": "STREAM_CATEGORY_MAIN_IDEAS", "last_stream_id": cursor, "limit": 100}, True)
        d = j.get("data") or {}
        page = d.get("stream") or []
        for p in page:
            for t in p.get("topics") or []:
                if t not in codes:
                    continue
                for it in convert_reports({"data": {"stream": [p]}}, t, cfg["reports"]):
                    prev = old.get(it["id"])
                    # Ringkasan AI Stockbit kadang menyusul: lengkapi baris lama yang masih kosong.
                    new = {**it, "updatedAt": iso_now()} if prev is None else {**prev, **{k: v for k, v in it.items() if v}}
                    if new != prev:
                        added += prev is None
                        changed.append(new)
                        old[it["id"]] = new
        if not page or (d.get("pagination") or {}).get("is_last_page") or str(page[-1].get("created_at") or "")[:10] < cutoff:
            break
        cursor = (d.get("pagination") or {}).get("next_cursor") or page[-1].get("stream_id")
        time.sleep(0.3)
    if changed:
        updates_put(changed)
    return added


# Sinkron cepat akun StockbitReports tiap 15 menit pada jam aktif (06.00–22.00 WIB); sinkron penuh tetap tiap NEWS_GAP.
QUICK_GAP = 15 * 60


def news_loop() -> None:
    """Segarkan laporan dan berita tiap NEWS_GAP detik supaya tab Berita di situs publik tetap terbaru.
    Bila token Stockbit diganti (mis. sepulang libur), sinkron langsung dijalankan tanpa menunggu siklus."""
    time.sleep(60)
    while True:
        tok = get_token()
        cfg = load_config()
        if cfg:
            try:
                r = sync_updates(cfg)
                print(f"[berita] {r['added']} laporan, {r['addedNews']} berita baru{' (mengejar ketertinggalan)' if r.get('catchUp') else ''}", file=sys.stderr)
                # Ada laporan baru: lengkapi ulang story/pengendali/harga saat itu juga (tidak menunggu siklus 3 jam).
                if r.get("added") and get_token():
                    lengkapi_items()
            except Exception as e:
                print(f"[berita] gagal: {e}", file=sys.stderr)
        waited = 0
        while waited < NEWS_GAP:
            time.sleep(60)
            waited += 60
            if get_token() != tok:
                print("[berita] token baru terdeteksi: sinkron segera", file=sys.stderr)
                break
            jam = datetime.now(timezone(timedelta(hours=7))).hour
            if waited % QUICK_GAP == 0 and 6 <= jam < 22 and cfg:
                try:
                    n = sync_akun_reports(cfg)
                    if n:
                        print(f"[berita] sinkron cepat: {n} laporan baru dari akun StockbitReports", file=sys.stderr)
                        if get_token():
                            lengkapi_items()
                except Exception as e:
                    print(f"[berita] sinkron cepat gagal: {e}", file=sys.stderr)


# ------------------------------------------------------------------- POV ----
# Sudut pandang (POV) akun Stockbit yang diprioritaskan + akun trending: saham yang mereka incar, gaya analisa,
# horizon, dan nada (bullish/bearish). Hanya posting ide publik yang dianalisis; tidak ada data pribadi.

# Urutan tampil kartu POV mengikuti daftar ini.
POV_PRIORITY = ["athira", "majoindonangega", "zeinihzafahrozi", "PMFernandoR", "kakdr"]
POV_PAGES, POV_DAYS, POV_TRENDING = 5, 60, 5
POV_NOT_STOCK = {"IHSG", "LQ45", "IDXV", "IDXG", "JII7"}
POV_STYLE = [
    ("Teknikal", r"support|resist|breakout|break out|breakdown|\bma ?\d+|\bema\b|\brsi\b|macd|stoch|fibo|pola|pattern|candle|doji|hammer|trendline|channel|pullback|retest|double (top|bottom)|bollinger|volume|chart"),
    ("Bandarmologi", r"bandar|broker|akumulasi|\bakum|distribusi|\bdistri|\basing\b|foreign|net ?buy|net ?sell|antri|order ?book|haka|haki|tektok|guyur|serok|mark ?up|goreng|big ?player|whale|\bbid\b|\boffer\b"),
    ("Fundamental", r"laba|rugi|pendapatan|revenue|net ?profit|\bper\b|\bpbv\b|\broe\b|dividen|dividend|laporan keuangan|\blk\b|kinerja|margin|valuasi|undervalue|overvalue|cash ?flow|ekuitas|\beps\b"),
    ("Aksi korporasi", r"right ?issue|\bri\b|hmetd|pmhmetd|pmthmetd|private placement|akuisisi|backdoor|back door|tender|\bmto\b|\bptw\b|inbreng|pengendali|\brups|stock split|buyback|merger|\bipo\b|cum ?date|ex ?date|waran"),
    ("Momentum", r"\bara\b|\barb\b|scalp|day ?trade|fast ?trade|\bcuan|\btp\b|take profit|cut ?loss|\bcl\b|terbang|to the moon|nanjak|meroket|jebol|\bhit\b|\bgas\b"),
    ("Makro & sentimen", r"ihsg|indeks|bi ?rate|suku bunga|the fed|\bfed\b|inflasi|rupiah|dolar|global|wall street|nasdaq|msci|sentimen|makro|komoditas|batu ?bara|nikel|\bcpo\b|emas"),
]
POV_HORIZON = [
    ("jangka sangat pendek (scalping/harian)", r"scalp|day ?trade|fast ?trade|intraday|sesi \d|hari ini|besok"),
    ("jangka pendek-menengah (swing)", r"swing|minggu|beberapa hari|short term|jangka pendek"),
    ("jangka panjang (investasi)", r"jangka panjang|long term|value investing|dividen|tahunan|bertahun"),
]
POV_BULL = r"\bbuy\b|\bbeli|akum|\bhold|\btp\b|target|naik|breakout|rebound|bullish|serok|haka|mantap|\bgas\b|terbang|\bara\b|undervalue|cuan|reversal|uptrend|lanjut"
POV_BEAR = r"\bjual|\bsell|\bcl\b|cut ?loss|distribusi|turun|breakdown|bearish|hindari|hati-hati|hati2|waspada|\barb\b|guyur|jebol|overvalue|keluar|downtrend|nyangkut|bubar"


def stockbit_post_api(url: str, body: dict, fresh: bool = False) -> dict:
    """POST ke API Stockbit (token Bearer) dengan cache seperti GET; kunci cache = URL + isi permintaan."""
    token = get_token()
    if not token:
        raise NoToken()
    key = url + "#" + json.dumps(body, sort_keys=True)

    def fetch():
        req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST", headers={
            "Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json",
            "Origin": "https://stockbit.com", "Referer": "https://stockbit.com/", "User-Agent": UA_BROWSER})
        for i in range(3):
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    return r.read().decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                if e.code not in (502, 503, 504) or i == 2:
                    raise
                time.sleep(2 + 3 * i)
    return json.loads(cached_text(key, fetch, fresh))


def pov_posts_public(user: str, fresh: bool = False) -> list[dict]:
    """Cadangan tanpa token: 30 posting terbaru dari endpoint publik Stockbit (untuk pengunjung belum login).
    Bentuk datanya berbeda; diseragamkan ke kolom yang dipakai pov_user."""
    url = f"https://exodus.stockbit.com/stream/non-login/user/{user}"
    raw = cached_text(url, lambda: http_get(url, {"User-Agent": UA_BROWSER, "Accept": "application/json"}, 20), fresh)
    out = []
    for p in json.loads(raw).get("data") or []:
        if str(p.get("replyto") or "0") not in ("0", "", "None"):
            continue  # balasan, bukan ide utama
        try:
            topics = json.loads(p.get("topics") or "[]") if isinstance(p.get("topics"), str) else p.get("topics") or []
        except ValueError:
            topics = re.findall(r"\$([A-Z]{4})\b", str(p.get("content_original") or ""))
        out.append({"stream_id": p.get("postid"), "created_at": p.get("created"), "content_original": p.get("content_original"),
                    "content": p.get("content"), "topics": topics, "total_likes": p.get("likes"), "_pub": True})
    return out


def pov_posts(user: str, fresh: bool = False) -> list[dict]:
    """Posting ide utama (bukan balasan) satu akun, terbaru dulu, maks. POV_PAGES halaman dalam POV_DAYS hari.
    Bila endpoint bertoken ditolak (mis. 401), memakai cadangan publik (30 posting terbaru)."""
    try:
        return _pov_posts_token(user, fresh)
    except Exception as e:
        print(f"[pov] {user}: endpoint bertoken gagal ({e}); memakai endpoint publik", file=sys.stderr)
        return pov_posts_public(user, fresh)


def _pov_posts_token(user: str, fresh: bool = False) -> list[dict]:
    cutoff = (datetime.now() - timedelta(days=POV_DAYS)).strftime("%Y-%m-%d")
    out, cursor = [], 0
    for _ in range(POV_PAGES):
        j = stockbit_post_api(f"https://exodus.stockbit.com/stream/v3/user/{user}",
                              {"category": "STREAM_CATEGORY_MAIN_IDEAS", "last_stream_id": cursor, "limit": 20}, fresh)
        d = j.get("data") or {}
        page = d.get("stream") or []
        out += page
        if not page or (d.get("pagination") or {}).get("is_last_page") or str(page[-1].get("created_at") or "")[:10] < cutoff:
            break
        cursor = (d.get("pagination") or {}).get("next_cursor") or page[-1].get("stream_id")
        time.sleep(0.3)
    return [p for p in out if str(p.get("created_at") or "")[:10] >= cutoff]


def pov_user(user: str, radar: set, fresh: bool = False) -> dict:
    try:
        prof = stockbit_api(f"https://exodus.stockbit.com/user/profile/{user}", fresh).get("data") or {}
    except Exception:
        prof = {}
    posts = pov_posts(user, fresh)
    style = {k: 0 for k, _ in POV_STYLE}
    hor = {k: 0 for k, _ in POV_HORIZON}
    tick: dict = {}
    likes, chars = 0, 0
    latest = []
    for p in posts:
        txt = re.sub(r"\s+", " ", str(p.get("content_original") or p.get("content") or "")).strip()
        low = txt.lower()
        chars += len(txt)
        likes += int(p.get("total_likes") or 0)
        for k, rx in POV_STYLE:
            if re.search(rx, low):
                style[k] += 1
        for k, rx in POV_HORIZON:
            if re.search(rx, low):
                hor[k] += 1
        bull, bear = bool(re.search(POV_BULL, low)), bool(re.search(POV_BEAR, low))
        day = str(p.get("created_at") or "")[:10]
        for t in [x for x in (p.get("topics") or []) if TICKER_RE.match(str(x)) and x not in POV_NOT_STOCK]:
            e = tick.setdefault(t, {"t": t, "n": 0, "bull": 0, "bear": 0, "last": day, "first": day, "calls": [], "sample": "", "url": ""})
            e["n"] += 1
            e["first"] = min(e["first"], day)
            if len(e["calls"]) < 20:
                e["calls"].append({"d": day, "s": "bull" if bull and not bear else "bear" if bear and not bull else "netral"})
            e["bull"] += bull and not bear
            e["bear"] += bear and not bull
            e["last"] = max(e["last"], day)
            if not e["sample"] and len(txt) >= 15:
                e["sample"], e["url"] = txt[:220], f"https://stockbit.com/post/{p.get('stream_id')}"
        if len(latest) < 5 and len(txt) >= 20:
            latest.append({"d": day, "text": txt[:240], "topics": p.get("topics") or [], "url": f"https://stockbit.com/post/{p.get('stream_id')}"})
    n = len(posts)
    days = None
    if n:
        d0 = datetime.strptime(str(posts[-1]["created_at"])[:10], "%Y-%m-%d")
        d1 = datetime.strptime(str(posts[0]["created_at"])[:10], "%Y-%m-%d")
        days = max(1, (d1 - d0).days + 1)
    tickers = sorted(tick.values(), key=lambda e: (-e["n"], e["t"]))
    for e in tickers:
        e["radar"] = e["t"] in radar
        e["nada"] = "bullish" if e["bull"] > e["bear"] else "bearish" if e["bear"] > e["bull"] else "netral"
    for e in tickers[:12]:
        try:
            e["track"] = pov_track(e, chart_prices(e["t"]))
        except Exception:
            e["track"] = None
    st = sorted(({"k": k, "n": v, "pct": round(v / n * 100) if n else 0} for k, v in style.items()), key=lambda x: -x["n"])
    hz = max(hor.items(), key=lambda x: x[1])
    stats = prof.get("statistics") or {}
    return {
        "username": user, "url": f"https://stockbit.com/{user}", "followers": int(stats.get("follower_count") or 0),
        "posts": n, "from": str(posts[-1]["created_at"])[:10] if n else None, "to": str(posts[0]["created_at"])[:10] if n else None,
        "perDay": round(n / days, 1) if days else 0, "avgLikes": round(likes / n, 1) if n else 0, "avgChars": round(chars / n) if n else 0,
        "styles": st, "horizon": hz[0] if hz[1] >= 3 else "", "tickers": tickers[:12], "latest": latest,
        "radarHits": [e["t"] for e in tickers if e["radar"]],
        "hit": pov_hit_rate(tickers[:12]),
        # True = memakai cadangan publik (hanya posting terbaru), bukan riwayat 60 hari.
        "terbatas": any(p.get("_pub") for p in posts),
    }


def pov_track(e: dict, prices: list[dict], target: float = 0.10, window: int = 20) -> dict | None:
    """Uji panggilan akun: dari sebutan berarah pertama (bullish/bearish; bila tidak ada, sebutan pertama dianggap
    bullish), apakah dalam `window` hari bursa harga lebih dulu bergerak +-`target` searah (hit) atau berlawanan (gagal)."""
    if not prices:
        return None
    calls = sorted(e.get("calls") or [], key=lambda c: c["d"])
    c0 = next((c for c in calls if c["s"] != "netral"), calls[0] if calls else {"d": e.get("first"), "s": "netral"})
    arah = "bear" if c0["s"] == "bear" else "bull"
    i0 = next((i for i, p in enumerate(prices) if p["d"] >= c0["d"]), None)
    if i0 is None:
        return None
    p0, now = prices[i0]["v"], prices[-1]["v"]
    seg = prices[i0 + 1:i0 + 1 + window]
    status, hari = "belum", None
    for k, p in enumerate(seg, 1):
        r = p["v"] / p0 - 1
        if (r >= target and arah == "bull") or (r <= -target and arah == "bear"):
            status, hari = "hit", k
            break
        if (r <= -target and arah == "bull") or (r >= target and arah == "bear"):
            status, hari = "gagal", k
            break
    if status == "belum" and len(seg) >= window:
        status = "netral"  # jendela habis tanpa gerakan 10%
    pk = max([p["v"] for p in seg] or [p0])
    tr = min([p["v"] for p in seg] or [p0])
    return {"d0": prices[i0]["d"], "arah": arah, "p0": p0, "now": now, "ret": round((now / p0 - 1) * 100, 1),
            "peak": round((pk / p0 - 1) * 100, 1), "trough": round((tr / p0 - 1) * 100, 1), "status": status, "hari": hari}


def pov_hit_rate(tickers: list[dict]) -> dict:
    st = [((e.get("track") or {}).get("status")) for e in tickers]
    h, g = st.count("hit"), st.count("gagal")
    return {"hit": h, "gagal": g, "netral": st.count("netral"), "belum": st.count("belum"),
            "rate": round(h / (h + g) * 100) if h + g else None}


_pov_memo: tuple | None = None
_pov_lock = threading.Lock()


def get_pov(fresh: bool = False) -> dict:
    """Hasil POV disimpan di memori (dihitung ulang tiap 6 jam oleh pov_loop); versi publik hanya membaca."""
    global _pov_memo
    with _pov_lock:
        if _pov_memo and (is_public_request() or (not fresh and time.time() - _pov_memo[0] < 6 * 3600)):
            return _pov_memo[1]
        if is_public_request():
            return {"asOf": None, "users": [], "consensus": [], "errors": [{"source": "POV", "error": "Data POV sedang disiapkan."}]}
        radar = {i["ticker"] for i in items_all()}
        users, errors = [], []
        trending, tfol = [], {}
        try:
            tl = stockbit_api("https://exodus.stockbit.com/user/trending?key=1W", fresh).get("data") or []
            trending = [x["username"] for x in tl]
            tfol = {x["username"]: int((x.get("statistics") or {}).get("follower_count") or 0) for x in tl}
        except Exception as e:
            errors.append({"source": "Trending", "error": str(e)[:120]})
        names = POV_PRIORITY + [u for u in trending if u.lower() not in {p.lower() for p in POV_PRIORITY}][:POV_TRENDING]
        for u in names:
            try:
                r = pov_user(u, radar, fresh)
                r["priority"] = u in POV_PRIORITY
                r["trending"] = u in trending
                r["followers"] = r["followers"] or tfol.get(u, 0)
                users.append(r)
            except Exception as e:
                errors.append({"source": u, "error": str(e)[:120]})
        # Konsensus: saham yang dibahas oleh ≥2 akun.
        agg: dict = {}
        for u in users:
            for e in u["tickers"]:
                a = agg.setdefault(e["t"], {"t": e["t"], "users": [], "n": 0, "bull": 0, "bear": 0, "radar": e["radar"], "last": e["last"]})
                a["users"].append(u["username"])
                a["n"] += e["n"]
                a["bull"] += e["bull"]
                a["bear"] += e["bear"]
                a["last"] = max(a["last"], e["last"])
        cons = sorted((a for a in agg.values() if len(a["users"]) >= 2), key=lambda a: (-len(a["users"]), -a["n"]))
        for a in cons:
            a["nada"] = "bullish" if a["bull"] > a["bear"] else "bearish" if a["bear"] > a["bull"] else "netral"
        res = {"asOf": datetime.now().isoformat(timespec="seconds"), "users": users, "consensus": cons[:20], "errors": errors}
        # Hasil gagal total (mis. token kedaluwarsa) tidak menimpa hasil lama yang masih berguna.
        if users or not _pov_memo:
            _pov_memo = (time.time() if users else 0, res)
        return _pov_memo[1] if not users and _pov_memo[1].get("users") else res


# ------------------------------------------------------------- seasonality ----
# Pola bulanan berulang IHSG, sektor, dan saham. Data mentah dikumpulkan mingguan ke .seasonality.json
# (seasonality.build); permintaan pengunjung hanya membaca file itu, tanpa memanggil Stockbit.
SEASON_PATH = ROOT / ".seasonality.json"
_season_memo: tuple[float, dict] = (0.0, {})


def season_data() -> dict:
    global _season_memo
    try:
        m = SEASON_PATH.stat().st_mtime
    except OSError:
        return {}
    if _season_memo[0] != m:
        _season_memo = (m, SZ.load(SEASON_PATH))
    return _season_memo[1]


def season_universe() -> list[str]:
    """Saham yang dihitung: semua saham di data tradersaham (likuid) + radar + kandidat."""
    t = set(tsa_load("signals").keys()) | radar_tickers()
    return sorted(x for x in t if re.match(r"^[A-Z]{4}$", x))


WIB = timezone(timedelta(hours=7))


def season_next_run(now: datetime) -> datetime:
    """Jadwal pembaruan: Senin-Sabtu pukul 00.01 WIB (Sabtu memuat data penutupan Jumat); Minggu libur."""
    t = now.astimezone(WIB).replace(hour=0, minute=1, second=0, microsecond=0)
    if t <= now.astimezone(WIB):
        t += timedelta(days=1)
    while t.weekday() == 6:  # 6 = Minggu
        t += timedelta(days=1)
    return t


def season_build() -> None:
    uni = season_universe()
    print(f"[seasonality] membangun data {len(uni)} saham")
    data = SZ.build(lambda p: sb_fetch(p), uni, log=lambda m: print(m, file=sys.stderr))
    # Hasil gagal/kosong (mis. token ditolak) tidak disimpan agar dicoba lagi.
    if "IHSG" not in data["index"] or len(data["stock"]) < min(20, len(uni) // 2):
        raise RuntimeError(f"data tidak lengkap ({len(data['stock'])} saham)")
    tmp = SEASON_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(SEASON_PATH)
    print(f"[seasonality] selesai: {len(data['stock'])} saham")


BROKER_PATH = ROOT / ".broker-pola.json"
_broker_memo: tuple[float, dict] = (0.0, {})


def broker_data() -> dict:
    global _broker_memo
    try:
        m = BROKER_PATH.stat().st_mtime
    except OSError:
        return {}
    if _broker_memo[0] != m:
        _broker_memo = (m, BP.load(BROKER_PATH))
    return _broker_memo[1]


BROKER_HARIAN_PATH = ROOT / ".broker-harian.json"
BROKER_HARIAN_HARI = 20          # hari bursa yang disimpan/diisi ulang
_broker_harian_memo: tuple = (None, {})


def broker_harian_data() -> dict:
    global _broker_harian_memo
    try:
        m = BROKER_HARIAN_PATH.stat().st_mtime
    except OSError:
        return {}
    if _broker_harian_memo[0] != m:
        _broker_harian_memo = (m, BP.load(BROKER_HARIAN_PATH))
    return _broker_harian_memo[1]


def broker_daftar() -> dict:
    """{kode: {jenis, nama}} dari data Pola Broker bulanan."""
    return {c: {"jenis": b.get("jenis", ""), "nama": b.get("nama", "")} for c, b in (broker_data().get("broker") or {}).items()}


def broker_harian_build() -> None:
    """Pola Broker harian: net beli/jual tiap broker per hari bursa (20 hari terakhir). Hari ini hanya diambil setelah
    16.45 WIB (data broker hari berjalan baru lengkap setelah bursa tutup); hari ini & kemarin selalu diperbarui."""
    brokers = broker_daftar()
    if len(brokers) < 20:
        raise RuntimeError("daftar broker belum tersedia")
    now = datetime.now(WIB)
    akhir = now.date() if (now.hour, now.minute) >= (16, 45) else now.date() - timedelta(days=1)
    dates, d = [], akhir
    while len(dates) < BROKER_HARIAN_HARI:
        if d.weekday() < 5:
            dates.append(d.isoformat())
        d -= timedelta(days=1)
    fresh = set(dates[:2])
    # Saat jam bursa hanya 2 hari terakhir (±180 panggilan) agar tidak menahan data Live; 20 hari penuh setelah bursa tutup.
    if ihsg_jam_bursa():
        dates = dates[:2]
    data = BP.build_harian(lambda p, f=False: sb_fetch(p, f), broker_harian_data(), brokers, dates, fresh,
                           pause=1.0, log=lambda m: print(m, file=sys.stderr))
    tmp = BROKER_HARIAN_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(BROKER_HARIAN_PATH)


def broker_harian_loop() -> None:
    """Isi awal 20 hari (sekali), lalu tiap hari bursa setelah 16.45 WIB dan sekali lagi setelah 19.30 WIB."""
    time.sleep(240)
    selesai = set()
    while True:
        try:
            now = datetime.now(WIB)
            kunci = None
            if now.weekday() < 5 and (now.hour, now.minute) >= (19, 30):
                kunci = now.strftime("%Y-%m-%d") + "b"
            elif now.weekday() < 5 and (now.hour, now.minute) >= (16, 45):
                kunci = now.strftime("%Y-%m-%d") + "a"
            hd = broker_harian_data()
            kurang = sum(1 for x in (hd.get("hari") or {}).values() if x.get("broker") or x.get("libur")) < BROKER_HARIAN_HARI
            # Isi ulang bila data belum ada/versi lama/kurang dari 20 hari, paling sering tiap 2 jam.
            awal = (not BROKER_HARIAN_PATH.exists() or hd.get("versi") != 2 or kurang) and time.time() - LIVE.get("harianIsiT", 0) > 7200
            if get_token() and broker_data() and (awal or (kunci and kunci not in selesai)):
                LIVE["harianIsiT"] = time.time()
                broker_harian_build()
                if kunci:
                    selesai.add(kunci)
        except Exception as e:
            print(f"[broker-harian] gagal: {e}", file=sys.stderr)
        time.sleep(600)


def broker_build() -> None:
    data = BP.build(lambda p: sb_fetch(p), BP.load(BROKER_PATH), log=lambda m: print(m, file=sys.stderr),
                    insider=lambda t: [r for r in (insider_row(m) for m in insider_moves(t, 2)) if r])
    if len(data.get("broker", {})) < 20:
        raise RuntimeError(f"data broker tidak lengkap ({len(data.get('broker', {}))} broker)")
    tmp = BROKER_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(BROKER_PATH)
    print(f"[broker-pola] selesai: {len(data['broker'])} broker")


RECOVERY_PATH = ROOT / ".recovery.json"


def recovery_universe() -> list[str]:
    """Saham Seasonality + saham yang muncul di akumulasi/distribusi Pola Broker (semua bulan)."""
    uni = set((season_data().get("stock") or {}).keys())
    for b in (broker_data().get("broker") or {}).values():
        for x in (b.get("bulan") or {}).values():
            uni |= {r["s"] for r in (x.get("beli") or []) + (x.get("jual") or [])}
    return sorted(t for t in uni if re.match(r"^[A-Z]{4}$", t))


def kinerja_panjang(t: str) -> dict:
    """Kinerja 3Y/5Y/10Y dari deret harga penutupan Stockbit (timeframe terpanjang yang tersedia); periode yang
    datanya tidak mencakup rentang itu dilewati (tidak ditebak)."""
    out, deret = {}, []
    for tf in ("10y", "5y", "3y"):
        try:
            res = sb_fetch(f"/charts/{t}/daily?timeframe={tf}")
            pr = [(str(x["formatted_date"])[:10], float(x["value"])) for x in (res.get("data", {}).get("prices") or []) if x.get("formatted_date") and x.get("value")]
        except Exception:
            pr = []
        if len(pr) > len(deret):
            deret = sorted(pr)
        if deret and deret[0][0] <= (datetime.now() - timedelta(days=365 * 9.5)).strftime("%Y-%m-%d"):
            break
    if not deret:
        return out
    akhir = deret[-1][1]
    for label, th in (("3Y", 3), ("5Y", 5), ("10Y", 10)):
        batas = (datetime.now() - timedelta(days=365 * th)).strftime("%Y-%m-%d")
        lama = [v for d, v in deret if d <= batas]
        if lama and lama[-1] and deret[0][0] <= batas:
            out[label] = round((akhir / lama[-1] - 1) * 100, 2)
    return out


def recovery_build(delay: float = 0.25) -> None:
    """Teknikal harian 1 tahun tiap saham untuk tab Recovery (dijalankan setelah Seasonality & Pola Broker)."""
    out = {}
    for t in recovery_universe():
        try:
            tek = RC.technical(get_ohlc(t, "1y"))
            if tek:
                out[t] = tek
        except Exception as e:
            if "401" in str(e):
                raise
        time.sleep(delay)
    if not out:
        raise RuntimeError("data teknikal kosong")
    # Kinerja 3Y/5Y/10Y hanya untuk kategori "Sudah di dasar" (maks. 60 saham) agar panggilan Stockbit tetap hemat.
    panjang = {}
    for t in sorted((t for t, x in out.items() if RC.dasar(x)), key=lambda t: -out[t]["turun"])[:60]:
        try:
            kp = kinerja_panjang(t)
            if kp:
                panjang[t] = kp
        except Exception as e:
            if "401" in str(e):
                break
        time.sleep(delay)
    data = {"updated": time.strftime("%Y-%m-%d %H:%M"), "tek": out, "panjang": panjang}
    tmp = RECOVERY_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(RECOVERY_PATH)
    print(f"[recovery] {len(out)} saham", file=sys.stderr)


def recovery_ctx(month: int) -> tuple[dict, dict, int | None]:
    """(baris Seasonality per kode untuk bulan terpilih, broker per kode bulan terakhir, bulan broker)."""
    sea = season_api(month, 10)
    srow = {x["t"]: x for x in sea.get("saham") or []}
    # Broker: bulan terakhir yang ada; akumulasi = net bandar positif, distribusi = negatif.
    bd = broker_data()
    bro, bulan_b = {}, None
    if bd:
        v = BP.view(bd, None, None, "")
        bulan_b = max(v.get("bulanAda") or [0]) or None
        if bulan_b:
            v = BP.view(bd, bulan_b, None, "")
            BL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
            for x in (v.get("saham") or {}).get("akumulasi") or []:
                bro[x["s"]] = {"net": x["bandar"], "avg": x.get("avgAkum"), "bulanNama": BL[bulan_b - 1], "broker": [z["b"] for z in x.get("akum") or []]}
            for x in (v.get("saham") or {}).get("distribusi") or []:
                bro.setdefault(x["s"], {"net": x["bandar"], "avg": None, "dist": True, "bulanNama": BL[bulan_b - 1],
                                        "broker": [z["b"] for z in x.get("dist") or []]})
    return srow, bro, bulan_b


def nama_saham(t: str, srow: dict | None = None) -> str:
    """Nama perusahaan: baris Seasonality, data Seasonality lengkap, lalu snapshot tradersaham (signals/gems)."""
    se = (srow or {}).get(t) or {}
    return (se.get("nama") or ((season_data().get("stock") or {}).get(t) or {}).get("name")
            or (tsa_load("signals").get(t) or {}).get("companyName") or (tsa_load("gems").get(t) or {}).get("stockName") or "")


_nama_memo: tuple = (0.0, {})


def nama_semua() -> dict:
    """{kode: nama perusahaan} dari Seasonality + snapshot tradersaham (signals/gems); memo 30 menit."""
    global _nama_memo
    if time.time() - _nama_memo[0] < 1800 and _nama_memo[1]:
        return _nama_memo[1]
    out = {}
    for t, x in (tsa_load("gems") or {}).items():
        if isinstance(x, dict) and x.get("stockName"):
            out[t] = x["stockName"]
    for t, x in (tsa_load("signals") or {}).items():
        if isinstance(x, dict) and x.get("companyName"):
            out[t] = x["companyName"]
    for t, x in (season_data().get("stock") or {}).items():
        if x.get("name"):
            out[t] = x["name"]
    _nama_memo = (time.time(), out)
    return out


def recovery_api(month: int) -> dict:
    """Saham turun >= 30% dari puncak 52 minggu, diberi skor dukungan Seasonality (bulan terpilih) & Pola Broker."""
    rd = RC.load(RECOVERY_PATH)
    if not rd.get("tek"):
        return {"error": "Data Recovery sedang disiapkan (pembaruan otomatis Senin-Sabtu pukul 00.01 WIB). Coba lagi beberapa menit lagi."}
    srow, bro, bulan_b = recovery_ctx(month)
    rows = []
    for t, tek in rd["tek"].items():
        # Hanya yang sudah turun dalam, masih dekat dasar kejatuhan, dan tanpa lompatan harga akibat aksi korporasi.
        if tek["turun"] < RC.MIN_TURUN or tek["dariDasar"] > RC.MAX_DARI_DASAR or tek.get("lompatan"):
            continue
        se, b = srow.get(t), bro.get(t)
        sc = RC.score(tek, se, b)
        rows.append({"t": t, "nama": nama_saham(t, srow), "sektorNama": (se or {}).get("sektorNama") or "",
                     "radar": (se or {}).get("radar") or "", "tek": tek,
                     "season": {k: se[k] for k in ("n", "up", "prob", "median", "worst")} if se else None,
                     "broker": b, "plan": RC.plan(tek, (b or {}).get("avg") if b and not b.get("dist") else None), **sc})
    # Didukung lebih banyak (Seasonality, broker, teknikal) lebih dulu, lalu skor.
    rows.sort(key=lambda r: (-len(r["dukung"]), -r["skor"]))
    # Kategori "Recovery tercepat": kandidat dengan momentum pulih (skor kecepatan) dan perkiraan hari ke target 1.
    for r in rows:
        r["cepat"] = RC.kecepatan(r["tek"], r["plan"])
    cepat = sorted((r for r in rows if r["cepat"]["estimasiHari"] and r["cepat"]["skor"] >= 50),
                   key=lambda r: (r["cepat"]["estimasiHari"], -r["cepat"]["skor"]))[:40]
    # Kategori "Sudah di dasar": seluruh saham terpantau (tidak harus lolos filter kandidat rebound).
    pj = rd.get("panjang") or {}
    dasar = []
    for t, tek in rd["tek"].items():
        if not RC.dasar(tek):
            continue
        se = srow.get(t)
        dasar.append({"t": t, "nama": nama_saham(t, srow), "sektorNama": (se or {}).get("sektorNama") or "", "radar": (se or {}).get("radar") or "",
                      "tek": tek, "ret": {**(tek.get("ret") or {}), **pj.get(t, {})}, "broker": bro.get(t), "potensi": RC.potensi(tek)})
    dasar.sort(key=lambda r: -r["tek"]["turun"])
    # Tab "Low per periode": kinerja per periode semua saham terpantau (ringkas) untuk saringan low 1D..10Y di peramban.
    low = [{"t": t, "nama": nama_saham(t, srow), "harga": tek.get("harga"), "turun": tek.get("turun"),
            "dariRendah": tek.get("dariRendah"), "ret": {**(tek.get("ret") or {}), **pj.get(t, {})}, "potensi": RC.potensi(tek)}
           for t, tek in rd["tek"].items() if tek.get("ret") and not tek.get("lompatan")]
    return {"updated": rd["updated"], "bulan": month, "bulanBroker": bulan_b, "minTurun": RC.MIN_TURUN, "maxDariDasar": RC.MAX_DARI_DASAR,
            "dasarTurun": RC.DASAR_TURUN, "dasarJarak": RC.DASAR_JARAK, "skemaLama": not any("ret" in x for x in list(rd["tek"].values())[:5]),
            "total": len(rd["tek"]), "saham": rows, "cepat": [r["t"] for r in cepat], "dasar": dasar[:80], "low": low}


def saham_detail(t: str, month: int) -> dict:
    """Rincian satu saham untuk panel klik di Seasonality, Pola Broker, dan Recovery: alasan (turun/dasar, Seasonality,
    broker, teknikal), komponen skor, trading plan Seasonality (bila ada) dan plan rebound (bila turun >= 30%)."""
    rd = RC.load(RECOVERY_PATH)
    tek = (rd.get("tek") or {}).get(t)
    if not tek:
        try:
            tek = RC.technical(get_ohlc(t, "1y"))
        except Exception:
            tek = None
    srow, bro, bulan_b = recovery_ctx(month)
    se, b = srow.get(t), bro.get(t)
    out = {"t": t, "bulan": month, "bulanBroker": bulan_b, "season": None, "broker": b, "tek": tek,
           "planSeason": (se or {}).get("plan"), "planRebound": None, "updated": rd.get("updated")}
    if se:
        out["season"] = {k: se.get(k) for k in ("n", "up", "prob", "median", "worst", "best", "skor", "sektorNama", "nama", "radar")}
    if not tek:
        out["alasan"] = ["Data harga harian belum tersedia."]
        return out
    sc = RC.score(tek, se, b)
    out.update(alasan=sc["alasan"], komponen=sc["komponen"], status=sc["status"], dukung=sc["dukung"], skor=sc["skor"])
    if tek["turun"] >= RC.MIN_TURUN and tek["dariDasar"] <= RC.MAX_DARI_DASAR and not tek.get("lompatan"):
        out["planRebound"] = RC.plan(tek, (b or {}).get("avg") if b and not b.get("dist") else None)
    return out


def daily_builds() -> None:
    """Pembaruan terjadwal: Seasonality, Pola Broker, lalu Recovery; masing-masing dicoba ulang tiap 30 menit (maks. 3 jam)."""
    for fn in (season_build, broker_build, recovery_build):
        for _ in range(6):
            try:
                fn()
                break
            except Exception as e:
                print(f"[{fn.__name__}] gagal: {e}; dicoba lagi 30 menit", file=sys.stderr)
                time.sleep(1800)


IHSG_PATH = ROOT / ".ihsg.json"


def ihsg_refresh() -> None:
    """Harga harian IHSG 1 tahun + judul berita pasar terbaru (stream IHSG) untuk kartu kondisi IHSG di Seasonality."""
    bars = get_ohlc("IHSG", "1y", True)
    tek = IH.technical(bars)
    if tek:
        tek["pola"] = IH.pattern(bars)
    posts, cursor = [], 0
    for _ in range(6):
        j = sb_fetch(f"/stream/v3/symbol/IHSG?category=STREAM_CATEGORY_NEWS&last_stream_id={cursor}&limit=20", True)
        page = (j.get("data") or {}).get("stream") or []
        for p in page:
            isi = re.sub(r"\s+", " ", str(p.get("content_original") or p.get("content") or "")).strip()
            # "Jakarta, CNBC Indonesia - ..." -> sumber berita dari pembuka paragraf.
            m = re.match(r"^[A-Z][A-Za-z .]+,\s*([A-Z][\w .]{2,40}?)\s*[-–—]\s*", isi) or re.match(r"^([A-Z][\w]+(?:\.com|\.co\.id|\.id))\s*[-–—]\s*", isi)
            posts.append({"d": str(p.get("created_at") or "")[:10], "t": str(p.get("created_at") or "")[:16].replace("T", " "),
                          "title": str(p.get("title") or isi).split(chr(10))[0],
                          "ringkas": (isi[m.end():] if m else isi)[:900].rstrip(". ") + "…" if isi else "",
                          "sumber": m.group(1).strip() if m else "", "url": f"https://stockbit.com/post/{p.get('stream_id')}"})
        if not page:
            break
        cursor = page[-1].get("stream_id")
        time.sleep(0.3)
    # Media nasional (CNBC, Bloomberg Technoz, IDX Channel, CNN, Kontan, detik, Bisnis, EmitenNews, Katadata, dll.).
    try:
        media = BN.collect(days=3, log=lambda s: print(s, file=sys.stderr))
    except Exception as e:
        print(f"[ihsg] berita media gagal: {e}", file=sys.stderr)
        media = []
    cutoff = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
    berita, seen = [], set()
    # Judul sama di Stockbit & media: utamakan tautan media aslinya (media diproses lebih dulu).
    for p in media + posts:
        k = BN._kunci(p["title"])
        if p["d"] >= cutoff and k not in seen:
            seen.add(k)
            berita.append(p)
    berita.sort(key=lambda x: x.get("t") or x["d"], reverse=True)
    data = {"updated": time.strftime("%Y-%m-%d %H:%M"), "tek": tek, "proj": IH.projection_base(bars), "berita": berita[:400],
            "bars": [{k: b[k] for k in ("d", "o", "h", "l", "c")} for b in bars]}
    tmp = IHSG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(IHSG_PATH)


IHSG_LOCK = threading.Lock()
IHSG_SEGAR_MIN = 5 * 60  # tombol unduh/perbarui: data dianggap segar bila < 5 menit


def ihsg_jam_bursa(now: datetime | None = None) -> bool:
    """Senin–Jumat 08.45–16.30 WIB."""
    w = (now or datetime.now(timezone.utc)).astimezone(timezone(timedelta(hours=7)))
    return w.weekday() < 5 and (8, 45) <= (w.hour, w.minute) <= (16, 30)


def ihsg_segarkan(public: bool = False) -> None:
    """Perbarui .ihsg.json bila lebih tua dari 5 menit; satu proses sekaligus. Pengunjung publik diizinkan
    memicu pengambilan khusus data IHSG (harga + berita, ±7 panggilan, tetap dibatasi PUBLIC_BUDGET)."""
    try:
        if time.time() - IHSG_PATH.stat().st_mtime < IHSG_SEGAR_MIN:
            return
    except OSError:
        pass
    with IHSG_LOCK:
        try:
            if time.time() - IHSG_PATH.stat().st_mtime < IHSG_SEGAR_MIN:
                return  # sudah diperbarui permintaan lain saat menunggu kunci
        except OSError:
            pass
        old = getattr(_req, "public_fetch", False)
        _req.public_fetch = old or public
        try:
            if get_token():
                ihsg_refresh()
        except Exception as e:
            print(f"[ihsg] segarkan gagal: {e}", file=sys.stderr)
        finally:
            _req.public_fetch = old


def ihsg_loop() -> None:
    time.sleep(60)
    while True:
        try:
            if get_token():
                with IHSG_LOCK:
                    ihsg_refresh()
        except Exception as e:
            print(f"[ihsg] gagal: {e}", file=sys.stderr)
        # Jam bursa tiap 30 menit agar harga & berita mendekati realtime; di luar jam bursa tiap 2 jam.
        time.sleep(1800 if ihsg_jam_bursa() else 2 * 3600)


# ------------------------------------------------------------------ Live ----
# Tab Live (Seasonality): harga IHSG intraday (diperbarui tiap menit saat jam bursa oleh live_loop, di luar
# permintaan pengunjung) + gabungan sinyal Astronacci, Time Series, Seasonality, Pola Broker, Recovery, dan
# pergerakan hari ini menjadi satu kesimpulan: potensi rebound, potensi turun lagi, lanjut naik, atau netral.
WIB = timezone(timedelta(hours=7))
LIVE: dict = {"harga": None, "modul": None, "modulT": 0.0, "harianT": 0.0, "harian": []}
LIVE_LOCK = threading.Lock()
LIVE_TF = ("today", "1d")          # timeframe intraday Stockbit yang dicoba berurutan
LIVE_BOBOT = {"astro": 0.15, "ts": 0.2, "season": 0.2, "broker": 0.15, "recovery": 0.15, "hariini": 0.15, "transaksi": 0.2}
# Saham kapitalisasi terbesar penggerak IHSG: transaksi broker hari ini dipantau tiap LIVE_TRX_GAP detik.
LIVE_BESAR = ["BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "AMMN", "BREN", "DSSA", "TPIA"]
LIVE_TRX_GAP = 120
BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def _idn(v: float, dp: int = 2) -> str:
    """Angka format Indonesia: 7123.4 -> '7.123,40'."""
    return f"{v:,.{dp}f}".replace(",", "#").replace(".", ",").replace("#", ".")


def _klip(x: float) -> float:
    return max(-1.0, min(1.0, x))


def live_intraday() -> tuple[str | None, list[dict], dict]:
    """Titik harga sesi terakhir dari grafik intraday Stockbit. Hanya titik bertanggal sama dengan titik terakhir
    yang dipakai; deret harian (satu titik per hari) ditolak agar tidak dikira intraday."""
    for tf in LIVE_TF:
        try:
            res = sb_fetch(f"/charts/IHSG/daily?timeframe={tf}", True)
        except Exception as e:
            print(f"[live] intraday {tf} gagal: {e}", file=sys.stderr)
            continue
        d = res.get("data") or {}
        pts = []
        for x in d.get("prices") or []:
            t, v = x.get("formatted_date") or x.get("date"), x.get("value") or x.get("close")
            try:
                if t and v:
                    pts.append({"t": str(t), "v": float(v)})
            except (TypeError, ValueError):
                continue
        if len(pts) < 2:
            continue
        hari = pts[-1]["t"][:10]
        sesi = [p for p in pts if p["t"][:10] == hari]
        if len(sesi) >= 2:
            meta = {k: v for k, v in d.items() if isinstance(v, (int, float, str)) and not isinstance(v, bool)}
            return tf, sesi, meta
    return None, [], {}


def live_harga() -> dict:
    """Harga terkini IHSG: intraday bila tersedia, cadangan candle harian terbaru (bar hari ini ikut bergerak)."""
    now = time.time()
    if now - LIVE["harianT"] > 600 or not LIVE["harian"]:
        try:
            LIVE["harian"] = get_ohlc("IHSG", "1y", True)
            LIVE["harianT"] = now
        except Exception as e:
            print(f"[live] harian gagal: {e}", file=sys.stderr)
    bars = LIVE["harian"] or ihsg_bars()
    tf, sesi, meta = live_intraday()
    today = datetime.now(WIB).strftime("%Y-%m-%d")
    tgl_sesi = sesi[-1]["t"][:10] if sesi and sesi[-1]["t"][:4].isdigit() else today
    prev = next((float(v) for k, v in meta.items() if re.search(r"prev", k, re.I) and re.match(r"^[\d.]+$", str(v))), None)
    if prev is None and bars:
        lalu = [b for b in bars if str(b["d"])[:10] < tgl_sesi]
        prev = lalu[-1]["c"] if lalu else None
    if sesi:
        harga, sumber = sesi[-1]["v"], f"intraday ({tf})"
    else:
        harga, sumber = (bars[-1]["c"] if bars else None), "candle harian"
        tgl_sesi = str(bars[-1]["d"])[:10] if bars else today
        if bars and len(bars) > 1:
            prev = bars[-2]["c"]
    # Harga realtime dari orderbook IHSG: grafik intraday Stockbit bisa tertinggal (mis. saat banyak panggilan lain),
    # orderbook selalu memuat harga terakhir. Titik menit berjalan ditambahkan/diganti di ujung grafik.
    if ihsg_jam_bursa():
        try:
            ob = _orderbook("IHSG")
        except Exception as e:
            ob = None
            print(f"[live] orderbook IHSG gagal: {e}", file=sys.stderr)
        if ob and ob["harga"]:
            harga, prev = ob["harga"], ob.get("prev") or prev
            if sesi and sesi[-1]["t"][:10] != today:
                sesi = []
            menit = datetime.now(WIB).strftime("%Y-%m-%d %H:%M:00")
            if sesi and sesi[-1]["t"][:16] >= menit[:16]:
                sesi = sesi[:-1] + [{"t": sesi[-1]["t"], "v": harga}]
            else:
                sesi = sesi + [{"t": menit, "v": harga}]
            tgl_sesi = today
            sumber = "orderbook realtime" + (f" + grafik intraday ({tf})" if tf else "")
    if harga is None:
        return {}
    vs = [p["v"] for p in sesi] or [harga]
    return {"harga": harga, "prev": prev, "ubah": round(harga - prev, 2) if prev else None,
            "ubahPct": round((harga / prev - 1) * 100, 2) if prev else None, "tinggi": max(vs), "rendah": min(vs),
            "titik": sesi, "tanggal": tgl_sesi, "sumber": sumber, "jamBursa": ihsg_jam_bursa(),
            "waktu": datetime.now(WIB).strftime("%Y-%m-%d %H:%M:%S")}


def live_modul() -> list[dict]:
    """Sinyal per modul (skor -1..1) dari data harian yang sudah dihitung halaman lain."""
    out, m = [], datetime.now(WIB).month
    try:
        a = astro_api()
        if not a.get("error"):
            pr, rk = a["proyeksi"], a.get("rekomendasi") or {}
            out.append({"kunci": "astro", "nama": "Astronacci", "arah": pr["bias"], "skor": {"naik": 0.8, "turun": -0.8}.get(pr["bias"], 0.0),
                        "teks": f"Bias {pr['bias']} ({pr['ubah']:+.1f}%) menuju {_idn(pr['target'], 0)}" +
                                (f" sampai {pr['sampai'][8:]}/{pr['sampai'][5:7]}" if pr.get("sampai") else "") + (f"; {rk['tindakan'].lower()}." if rk.get("tindakan") else ".")})
    except Exception as e:
        print(f"[live] astro gagal: {e}", file=sys.stderr)
    try:
        ts = runtun_api()
        if not ts.get("error"):
            p1 = next((x for x in ts["proyeksi"] if x["h"] == 1), None)
            p5 = next((x for x in ts["proyeksi"] if x["h"] == 5), None)
            if p5:
                arah = "naik" if p5["ubah"] > 0.3 else "turun" if p5["ubah"] < -0.3 else "mendatar"
                out.append({"kunci": "ts", "nama": "Time Series", "arah": arah, "skor": round(_klip(p5["ubah"] / 1.5), 2),
                            "teks": f"Gabungan model: esok {p1['ubah']:+.2f}%, 1 minggu {p5['ubah']:+.2f}% ke {_idn(p5['sentimen'], 0)}; "
                                    f"{p5['setuju']}% model memproyeksikan naik."})
    except Exception as e:
        print(f"[live] time series gagal: {e}", file=sys.stderr)
    ih = {}
    try:
        ih = ihsg_api(m)
        if not ih.get("error"):
            esok = next((h for h in (ih.get("proyeksi") or {}).get("horizon") or [] if h["kunci"] == "esok"), None)
            mu = ih.get("musiman") or {}
            pe = esok["prob"] if esok else 50
            out.append({"kunci": "season", "nama": "Seasonality", "arah": "naik" if pe >= 55 else "turun" if pe <= 45 else "mendatar",
                        "skor": round(_klip((pe - 50) / 20), 2),
                        "teks": f"Peluang naik esok {pe}%" + (f"; {BULAN_ID[m - 1]} naik {mu['up']} dari {mu['n']} tahun (median {mu['median']:+.2f}%)" if mu.get("n") else "") + "."})
    except Exception as e:
        print(f"[live] seasonality gagal: {e}", file=sys.stderr)
    fl = (ih or {}).get("flow")
    if fl:
        net = fl.get("asing") or 0
        out.append({"kunci": "broker", "nama": "Pola Broker", "arah": "naik" if net > 0 else "turun" if net < 0 else "mendatar",
                    "skor": round(_klip(net / 2e12), 2) if net else 0.0,
                    "teks": f"Asing net {'beli' if net > 0 else 'jual'} Rp{_idn(abs(net) / 1e12, 2)} triliun ({fl.get('bulanNama')}); "
                            f"domestik net {'beli' if (fl.get('domestik') or 0) > 0 else 'jual'} Rp{_idn(abs(fl.get('domestik') or 0) / 1e12, 2)} triliun."})
    try:
        tek = (RC.load(RECOVERY_PATH).get("tek") or {}).values()
        tek = [x for x in tek if x.get("ema20")]
        if tek:
            luas = sum(1 for x in tek if x.get("diAtasEma20")) / len(tek) * 100
            pulih = sum(1 for x in tek if x["turun"] >= RC.MIN_TURUN and x.get("diAtasEma20") and x.get("higherLow"))
            dasar = sum(1 for x in tek if RC.dasar(x))
            out.append({"kunci": "recovery", "nama": "Recovery", "arah": "naik" if luas >= 55 else "turun" if luas <= 45 else "mendatar",
                        "skor": round(_klip((luas - 50) / 25), 2),
                        "teks": f"{luas:.0f}% saham di atas EMA20".replace(".", ",") + f"; {pulih} saham turun dalam mulai pulih, {dasar} saham masih di dasar."})
    except Exception as e:
        print(f"[live] recovery gagal: {e}", file=sys.stderr)
    return out


def live_hari_ini(h: dict, tek: dict | None) -> dict:
    """Sinyal pergerakan sesi berjalan: posisi terhadap support/resistance harian dan momentum ±30 titik terakhir."""
    p, vs = h["harga"], [x["v"] for x in h.get("titik") or []]
    sup = [x["v"] for x in (tek or {}).get("support") or []]
    res = [x["v"] for x in (tek or {}).get("resistance") or []]
    sk, cat = 0.0, []
    mom = (p / vs[-min(30, len(vs))] - 1) * 100 if len(vs) >= 5 else (h.get("ubahPct") or 0)
    sk += _klip(mom / 0.6) * 0.5
    cat.append(f"momentum terakhir {mom:+.2f}%".replace(".", ","))
    if sup and p < sup[0] * 0.998:
        sk -= 0.5; cat.append(f"di bawah support {_idn(sup[0], 0)}")
    elif sup and p <= sup[0] * 1.007 and vs and p > min(vs) * 1.003:
        sk += 0.5; cat.append(f"memantul dekat support {_idn(sup[0], 0)}")
    if res and p > res[0] * 1.002:
        sk += 0.4; cat.append(f"menembus resistance {_idn(res[0], 0)}")
    elif res and p >= res[0] * 0.995:
        sk -= 0.2; cat.append(f"mendekati resistance {_idn(res[0], 0)}")
    sk = _klip(sk)
    return {"kunci": "hariini", "nama": "Pergerakan hari ini", "arah": "naik" if sk > 0.15 else "turun" if sk < -0.15 else "mendatar",
            "skor": round(sk, 2), "teks": "; ".join(cat).capitalize() + "."}


def _num(v) -> float:
    try:
        return abs(float(v or 0))
    except (TypeError, ValueError):
        return 0.0


def _rupiah(v: float) -> str:
    """Nilai rupiah ringkas: >= 1 triliun ditulis triliun, selain itu miliar."""
    v = abs(v)
    return f"Rp{_idn(v / 1e12, 2)} triliun" if v >= 1e12 else f"Rp{_idn(v / 1e9, 1)} miliar"


def _f(v) -> float:
    """Angka dari teks Stockbit ("6,083,300", "-4.27", "") ke float."""
    try:
        return float(str(v).replace(",", "")) if v not in (None, "", "-") else 0.0
    except ValueError:
        return 0.0


def _orderbook(sym: str) -> dict | None:
    """Orderbook realtime Stockbit: harga, nilai beli/jual asing hari ini (fbuy/fsell/fnet), dan antrean bid/offer."""
    d = sb_fetch(f"/company-price-feed/v2/orderbook/companies/{sym}", True).get("data") or {}
    if not d.get("lastprice"):
        return None
    bid = sum(_f(x.get("volume")) for x in d.get("bid") or [])
    off = sum(_f(x.get("volume")) for x in d.get("offer") or [])
    return {"s": sym, "harga": _f(d.get("lastprice")), "ubahPct": _f(d.get("percentage_change")),
            "fbuy": _f(d.get("fbuy")), "fsell": _f(d.get("fsell")), "asing": _f(d.get("fnet")) or _f(d.get("fbuy")) - _f(d.get("fsell")),
            "bid": bid, "offer": off, "tekanan": round(bid / (bid + off) * 100) if bid + off else None,
            "porsiAsing": _f(d.get("foreign")) or None, "frekuensi": _f(d.get("frequency")), "prev": _f(d.get("previous")) or None}


def live_transaksi() -> dict | None:
    """Transaksi berjalan di saham penggerak IHSG dari orderbook realtime Stockbit: net asing hari ini, antrean
    bid vs offer (tekanan beli/jual), dan arah harga. IHSG sendiri dicoba untuk net asing seluruh pasar."""
    rows = []
    for sym in LIVE_BESAR:
        try:
            ob = _orderbook(sym)
            if ob:
                rows.append(ob)
        except Exception as e:
            print(f"[live] orderbook {sym} gagal: {e}", file=sys.stderr)
        time.sleep(0.15)
    if not rows:
        return None
    pasar = None
    try:
        ob = _orderbook("IHSG")
        if ob and (ob["fbuy"] or ob["fsell"]):
            pasar = {"asing": ob["asing"], "fbuy": ob["fbuy"], "fsell": ob["fsell"]}
    except Exception:
        pass
    total = sum(x["asing"] for x in rows)
    bid, off = sum(x["bid"] for x in rows), sum(x["offer"] for x in rows)
    hari = datetime.now(WIB).strftime("%Y-%m-%d")
    # Riwayat net asing hari ini untuk melihat arah ±15 menit terakhir (asing makin banyak beli atau jual).
    acuan = pasar["asing"] if pasar else total
    rw = [x for x in LIVE.get("trxRiwayat") or [] if x[0][:10] == hari]
    rw.append((datetime.now(WIB).strftime("%Y-%m-%d %H:%M"), acuan))
    LIVE["trxRiwayat"] = rw[-240:]
    return {"tanggal": hari, "waktu": datetime.now(WIB).strftime("%H:%M:%S"), "saham": sorted(rows, key=lambda x: -abs(x["asing"])),
            "asing": total, "pasar": pasar, "asingBeli": sum(1 for x in rows if x["asing"] > 0), "asingJual": sum(1 for x in rows if x["asing"] < 0),
            "naik": sum(1 for x in rows if x["ubahPct"] > 0), "turun": sum(1 for x in rows if x["ubahPct"] < 0),
            "tekanan": round(bid / (bid + off) * 100) if bid + off else None, "n": len(rows)}


def arah_asing(net: float, tren: float) -> str:
    """Perubahan net asing dalam kalimat: beli/jual asing bertambah atau mulai berkurang."""
    if tren > 0:
        return "beli asing bertambah" if net >= 0 else "jual asing mulai berkurang"
    return "jual asing bertambah" if net < 0 else "beli asing mulai berkurang"


def live_trx_modul(tx: dict | None) -> dict | None:
    """Sinyal transaksi: net asing (45%), arah harga saham penggerak (25%), tekanan antrean bid vs offer (15%),
    dan perubahan net asing ±15 menit terakhir (15%)."""
    if not tx:
        return None
    net = tx["pasar"]["asing"] if tx.get("pasar") else tx["asing"]
    rw = LIVE.get("trxRiwayat") or []
    batas = (datetime.now(WIB) - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M")
    lalu = next((v for t, v in reversed(rw) if t <= batas), None)
    tren = None if lalu is None else net - lalu
    sk = 0.45 * _klip(net / 500e9) + 0.25 * (tx["naik"] - tx["turun"]) / max(1, tx["n"])
    if tx.get("tekanan") is not None:
        sk += 0.15 * _klip((tx["tekanan"] - 50) / 20)
    if tren is not None:
        sk += 0.15 * _klip(tren / 100e9)
    sk = _klip(sk)
    m = _rupiah
    teks = (f"{'Seluruh pasar' if tx.get('pasar') else str(tx['n']) + ' saham penggerak IHSG'}: asing net {'beli' if net >= 0 else 'jual'} {m(net)}; "
            f"saham penggerak {tx['naik']} naik, {tx['turun']} turun")
    if tx.get("tekanan") is not None:
        teks += f"; antrean beli {tx['tekanan']}% vs jual {100 - tx['tekanan']}%"
    if tren is not None and abs(tren) >= 5e9:
        teks += f"; 15 menit terakhir {arah_asing(net, tren)} ({m(tren)})"
    return {"kunci": "transaksi", "nama": "Transaksi hari ini", "arah": "naik" if sk > 0.15 else "turun" if sk < -0.15 else "mendatar",
            "skor": round(sk, 2), "teks": teks + ".", "tren": tren, "net": net}


def live_refresh() -> None:
    h = live_harga()
    if h:
        LIVE["harga"] = h
    if time.time() - LIVE["modulT"] > 300 or LIVE["modul"] is None:
        LIVE["modul"] = live_modul()
        LIVE["modulT"] = time.time()
    # Transaksi broker hari ini: hanya saat jam bursa (atau sekali bila belum ada), tiap LIVE_TRX_GAP detik.
    if (ihsg_jam_bursa() or not LIVE.get("trx")) and time.time() - LIVE.get("trxT", 0) > LIVE_TRX_GAP:
        LIVE["trxT"] = time.time()
        tx = live_transaksi()
        if tx:
            LIVE["trx"] = tx


def live_loop() -> None:
    time.sleep(30)
    while True:
        try:
            if get_token():
                with LIVE_LOCK:
                    live_refresh()
        except Exception as e:
            print(f"[live] gagal: {e}", file=sys.stderr)
        # Jam bursa tiap 20 detik (mendekati realtime); di luar jam bursa tiap 30 menit (harga penutupan sudah final).
        time.sleep(20 if ihsg_jam_bursa() else 1800)


def live_api() -> dict:
    h = LIVE.get("harga")
    if not h:
        return {"error": "Data Live IHSG sedang disiapkan (diperbarui tiap menit saat jam bursa). Coba lagi sebentar lagi."}
    tek = IH_load().get("tek")
    trx = LIVE.get("trx")
    tm = live_trx_modul(trx)
    modul = list(LIVE.get("modul") or []) + [live_hari_ini(h, tek)] + ([tm] if tm else [])
    w = sum(LIVE_BOBOT.get(x["kunci"], 0.1) for x in modul) or 1
    skor = round(sum(x["skor"] * LIVE_BOBOT.get(x["kunci"], 0.1) for x in modul) / w * 100)
    for x in modul:
        x["bobot"] = round(LIVE_BOBOT.get(x["kunci"], 0.1) / w * 100)
        x["teks"] = re.sub(r"(\d)\.(\d+%)", r"\1,\2", x["teks"])  # desimal persen gaya Indonesia (+1,1%)
    ch = h.get("ubahPct") or 0
    kondisi = "naik" if ch > 0.15 else "turun" if ch < -0.15 else "datar"
    if kondisi == "turun":
        label = "Potensi rebound" if skor >= 15 else "Potensi turun lagi" if skor <= -15 else "Turun, belum ada arah"
    elif kondisi == "naik":
        label = "Potensi lanjut naik" if skor >= 15 else "Rawan berbalik turun" if skor <= -15 else "Naik, belum ada arah"
    else:
        label = "Cenderung naik" if skor >= 15 else "Cenderung turun" if skor <= -15 else "Netral, menunggu arah"
    nada = "good" if skor >= 15 else "bad" if skor <= -15 else "warn"
    sup = [x["v"] for x in (tek or {}).get("support") or []]
    res = [x["v"] for x in (tek or {}).get("resistance") or []]
    # Narasi suara: hanya kondisi IHSG saat ini (tanpa menyebut nama analisa) agar bisa dibacakan tiap menit.
    vs = [x["v"] for x in h.get("titik") or []]
    jam_t = (re.search(r"(\d{1,2}):(\d{2})", (h.get("titik") or [{}])[-1].get("t", "")) if h.get("titik") else None)
    pukul = f"pukul {jam_t.group(1)}.{jam_t.group(2)}" if jam_t and h.get("jamBursa") else ("saat ini" if h.get("jamBursa") else "pada penutupan terakhir")
    gerak = (f"{'naik' if ch > 0 else 'turun'} {_idn(abs(ch))} persen" if abs(ch) >= 0.01 else "tidak berubah") + " dari penutupan kemarin"
    narasi = [f"IHSG {pukul} di {_idn(h['harga'], 0)}, {gerak}."]
    if h.get("jamBursa") and len(vs) >= 6:
        m5 = (vs[-1] / vs[-6] - 1) * 100
        narasi.append("Beberapa menit terakhir " + ("sedang menguat." if m5 > 0.05 else "sedang melemah." if m5 < -0.05 else "bergerak datar."))
    # Arah transaksi real time (net asing, antrean bid/offer, arah saham penggerak): cukup potensi naik/turun.
    arah_trx = None
    if tm:
        arah_trx = {"label": "Potensi naik" if tm["skor"] > 0.15 else "Potensi turun" if tm["skor"] < -0.15 else "Belum ada arah",
                    "nada": "good" if tm["skor"] > 0.15 else "bad" if tm["skor"] < -0.15 else "warn", "waktu": trx.get("waktu")}
        narasi.append(f"Arah transaksi real time: {arah_trx['label'].lower()}.")
    narasi.append(f"Kondisi saat ini: {label.lower()}.")
    if label == "Potensi rebound" and sup:
        narasi.append(f"Perhatikan pantulan di {_idn(sup[0], 0)}" + (f", target terdekat {_idn(res[0], 0)}." if res else "."))
    elif label in ("Potensi turun lagi", "Rawan berbalik turun") and sup:
        narasi.append(f"Waspadai turun ke {_idn(sup[0], 0)}" + (f", lalu {_idn(sup[1], 0)}." if len(sup) > 1 else "."))
    elif label == "Potensi lanjut naik" and res:
        narasi.append(f"Ruang naik menuju {_idn(res[0], 0)}.")
    return {**h, "skor": skor, "label": label, "nada": nada, "kondisi": kondisi, "modul": modul, "transaksi": trx, "arahTransaksi": arah_trx, 
            "support": sup, "resistance": res, "narasi": narasi,
            "catatan": "Skor gabungan -100 sampai +100 dari bobot tiap modul. Analisa otomatis berbasis data historis dan harga berjalan, bukan rekomendasi beli/jual."}


def ihsg_api(month: int) -> dict:
    d = IH_load()
    if not d.get("tek"):
        return {"error": "Data kondisi IHSG sedang disiapkan. Coba lagi beberapa menit lagi."}
    tek = d["tek"]
    series = (season_data().get("index") or {}).get("IHSG") or {}
    base = SZ.month_stats(series, month, 10, datetime.now().date()) if series else None
    state = "atas" if tek["harga"] > tek["ema200"] else "bawah"
    cond = IH.conditional(series, month, state) if series else {"kondisi": state, "n": 0, "prob": None, "tahun": []}
    sent = IH.sentiment(d.get("berita") or [])
    ber = IH.verdict(base, cond, sent)
    flow = BP.market_flow(broker_data()) if broker_data() else None
    BL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    riset = IH.narrative(tek, tek.get("pola") or {}, flow, ber, BL[month - 1])
    proyeksi = IH.projection(d.get("proj"), tek, sent, flow, ber)
    return {"updated": d.get("updated"), "bulan": month, "tek": tek, "sentimen": sent, "kondisi": cond,
            "musiman": base and {k: base[k] for k in ("n", "up", "prob", "median")}, "berulang": ber, "flow": flow, "riset": riset,
            "proyeksi": proyeksi, "berita": (d.get("berita") or [])[:40],
            "sumberBerita": sorted({p.get("sumber") or "Stockbit" for p in d.get("berita") or []})}


_ts_memo: dict = {}


def ihsg_bars() -> list[dict]:
    """Candle harian IHSG 1 tahun dari .ihsg.json (diperbarui ihsg_loop); bila belum ada, ambil langsung."""
    b = IH_load().get("bars")
    return b if b else get_ohlc("IHSG", "1y")


def runtun_api() -> dict:
    """Time Series: model runtun waktu klasik + faktor sentimen. Dihitung ulang hanya bila data IHSG berubah."""
    d = IH_load()
    key = ("ts", d.get("updated"), datetime.now().strftime("%Y-%m-%d"))
    if _ts_memo.get("ts", (None,))[0] == key:
        return _ts_memo["ts"][1]
    bars = ihsg_bars()
    month = datetime.now().month
    series = (season_data().get("index") or {}).get("IHSG") or {}
    ms = SZ.month_stats(series, month, 10, datetime.now().date()) if series else None
    base = TS.build(bars, (ms or {}).get("median") or 0.0)
    if not base:
        return {"error": "Data harga IHSG belum cukup untuk model runtun waktu. Coba lagi beberapa menit lagi."}
    sent = IH.sentiment(d.get("berita") or [])
    flow = BP.market_flow(broker_data()) if broker_data() else None
    out = {"updated": d.get("updated"), **base, **TS.combine(base, sent, flow),
           "sentimen": {k: sent.get(k) for k in ("skor", "arah", "nPos", "nNeg")}}
    _ts_memo["ts"] = (key, out)
    return out


def astro_api() -> dict:
    """Astronacci: fase bulan + Fibonacci harga & waktu IHSG."""
    d = IH_load()
    key = ("as", d.get("updated"), datetime.now().strftime("%Y-%m-%d"))
    if _ts_memo.get("as", (None,))[0] == key:
        return _ts_memo["as"][1]
    out = AS.build(ihsg_bars())
    if not out:
        return {"error": "Data harga IHSG belum cukup untuk perhitungan Astronacci. Coba lagi beberapa menit lagi."}
    out["updated"] = d.get("updated")
    try:
        ts = runtun_api()
    except Exception as e:
        print(f"[astro] time series gagal: {e}", file=sys.stderr)
        ts = None
    out["rekomendasi"] = AS.rekomendasi(out, ts if ts and not ts.get("error") else None, IH.sentiment(d.get("berita") or []))
    _ts_memo["as"] = (key, out)
    return out


def IH_load() -> dict:
    try:
        return json.loads(IHSG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def season_loop() -> None:
    time.sleep(120)  # beri waktu loop kandidat/tsa mengisi universe lebih dulu
    # Recovery versi lama (tanpa kinerja per periode): bangun ulang sekali agar kategori Dasar/Tercepat langsung terisi.
    try:
        rd0 = RC.load(RECOVERY_PATH)
        if rd0.get("tek") and not any("ret" in x for x in list(rd0["tek"].values())[:5]) and get_token():
            recovery_build()
    except Exception as e:
        print(f"[recovery] bangun ulang skema gagal: {e}", file=sys.stderr)
    # Belum ada data sama sekali: bangun sekarang agar halaman tidak kosong, lalu ikuti jadwal.
    for path, fn in ((SEASON_PATH, season_build), (BROKER_PATH, broker_build), (RECOVERY_PATH, recovery_build)):
        while not path.exists():
            try:
                if get_token():
                    fn()
                    break
            except Exception as e:
                print(f"[{fn.__name__}] gagal: {e}; dicoba lagi 30 menit", file=sys.stderr)
            time.sleep(1800)
    while True:
        nxt = season_next_run(datetime.now(timezone.utc))
        time.sleep(max(1.0, (nxt - datetime.now(timezone.utc)).total_seconds()))
        daily_builds()


def season_api(month: int, years: int) -> dict:
    data = season_data()
    if not data:
        return {"error": "Data seasonality sedang disiapkan (pembaruan otomatis Senin-Sabtu pukul 00.01 WIB). Coba lagi beberapa menit lagi."}
    kd = {k["ticker"] for k in (_kd_memo[1].get("items", []) if _kd_memo else [])}
    return SZ.analyze(data, month, years, tsa_load("signals"), {i["ticker"] for i in items_all()}, kd)


def pov_loop() -> None:
    """Hitung POV di latar belakang (setelah start, lalu tiap 6 jam) supaya halaman publik tidak menunggu.
    Bila gagal (mis. token kedaluwarsa), dicoba lagi tiap 30 menit sehingga pulih sendiri setelah token diganti."""
    time.sleep(90)
    while True:
        ok = False
        if get_token():
            try:
                ok = bool(get_pov(fresh=True).get("users")) and _pov_memo and _pov_memo[0] > 0
            except Exception as e:
                print(f"[pov] gagal: {e}", file=sys.stderr)
        time.sleep(6 * 3600 + 120 if ok else 1800)


def _kandidat(cfg: dict, fresh: bool = False) -> dict:
    bd = cfg.get("backdoor") or {}
    skip = {i["ticker"] for i in items_all() if i.get("stage") != "radar"} | set(bd.get("include") or []) \
        | set(bd.get("exclude") or [])
    found: dict[str, dict] = {}
    errors: list[dict] = []

    def add(t: str, sid: str, d: str, text: str, src: str) -> None:
        if not TICKER_RE.match(t or "") or t in skip:
            return
        k = found.setdefault(t, {"ticker": t, "signals": {}})
        sig = k["signals"].setdefault(sid, {"st": "on", "d": d, "ev": []})
        if not any(e["text"] == text for e in sig["ev"]):
            sig["ev"].append({"d": d, "text": text, "src": src})
        sig["d"] = max(sig["d"], d)

    today = datetime.now().strftime("%Y-%m-%d")
    # 0) Perpindahan blok pemegang saham besar di seluruh BEI (data KSEI/IDX via Stockbit).
    try:
        for m in big_holder_moves(fresh):
            add(m["ticker"], "akuisisi", m["date"], m["text"], "https://stockbit.com/symbol/" + m["ticker"])
    except Exception as e:
        errors.append({"source": "Pemegang saham besar", "error": str(e)})
    # 1) Rights issue seluruh BEI: hanya yang mendilusi besar (≥ 1 saham baru per saham lama).
    try:
        for r in (stockbit_api(SB + "/corpaction/rightissue?limit=100", fresh).get("data") or {}).get("rightissue") or []:
            try:
                ratio = float(r.get("rightissue_new") or 0) / float(r.get("rightissue_old") or 1)
            except ValueError:
                continue
            if ratio >= 1:
                add(r.get("company_symbol"), "rights", r.get("rightissue_cumdate") or today,
                    f"Rights issue {r.get('rightissue_ratio')} @Rp{r.get('rightissue_price_formatted')} (cum {r.get('rightissue_cumdate')})",
                    "https://stockbit.com/symbol/" + str(r.get("company_symbol")))
    except Exception as e:
        errors.append({"source": "Rights issue", "error": str(e)})
    # 2) UMA seluruh BEI.
    try:
        uma = stockbit_api(SB + "/corpaction/uma?limit=100", fresh).get("data") or []
        for u in uma if isinstance(uma, list) else []:
            t = u.get("company_symbol") or u.get("symbol")
            add(t, "uma", str(u.get("uma_date") or u.get("date") or today)[:10], "Unusual Market Activity (BEI)",
                "https://stockbit.com/symbol/" + str(t))
    except Exception as e:
        errors.append({"source": "UMA", "error": str(e)})
    # 3) Berita yang menyebut kode saham di judul.
    if cfg.get("news"):
        try:
            for n in get_news(cfg["news"], [], fresh)["items"]:
                for sid in kandidat_sigs(n["title"]):
                    add(n["ticker"], sid, n["date"], n["title"], n["url"])
        except Exception as e:
            errors.append({"source": "Berita", "error": str(e)})

    # 3b) Keterbukaan seluruh BEI (StockbitReports): pengambilalihan, rights issue, perubahan usaha.
    try:
        for r in market_reports(fresh=fresh):
            for sid in kandidat_sigs(r["title"]):
                if sid in ("akuisisi", "rights", "kbli"):
                    add(r["ticker"], sid, r["date"], r["title"], r["url"])
    except Exception as e:
        errors.append({"source": "Keterbukaan BEI", "error": str(e)})

    # 4) Periksa keterbukaan informasi tiap calon; data harga dari halaman Stockbit.
    out = []
    # Sinyal pengendalian (termasuk sinyal dini kreditur) diperiksa lebih dulu agar tidak terpotong KANDIDAT_MAX.
    for t in sorted(found, key=lambda x: (-("akuisisi" in found[x]["signals"]), -len(found[x]["signals"])))[:KANDIDAT_MAX]:
        k = found[t]
        try:
            if cfg.get("reports"):
                for r in get_reports(cfg["reports"], t, fresh, max_pages=1):
                    for sid in kandidat_sigs(r["title"]):
                        add(t, sid, r["date"], r["title"], r["url"])
            # Feed pasar KSEI bisa tertinggal: periksa langsung pemegang baru >= 20% di emiten ini.
            if "akuisisi" in k["signals"]:
                nc = new_controller(t, fresh=fresh)
                if nc:
                    add(t, "akuisisi", nc["date"], nc["text"], "https://stockbit.com/symbol/" + t)
                    k["pengendaliBaru"] = nc
            co = page_props(t, fresh).get("company") or {}
            k["name"] = co.get("name") or ""
            k["price"] = float(co["lastprice"]) if co.get("lastprice") not in (None, "") else None
        except PublicNoCache:
            pass
        except Exception as e:
            errors.append({"source": t, "error": str(e)[:120]})
        sig = k["signals"]
        # Rights issue saja pada saham mahal biasanya penggalangan dana biasa, bukan cangkang.
        if set(sig) == {"rights"} and (k.get("price") is None or k["price"] > 300):
            continue
        for v in sig.values():
            v["ev"].sort(key=lambda e: e["d"], reverse=True)
            del v["ev"][5:]
        k["flags"] = {sid: True for sid in sig}
        out.append(k)
    return {"asOf": datetime.now().isoformat(timespec="seconds"), "items": out, "errors": errors}

# ---------------------------------------------------------------- server ----


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "RadarCangkang/2.0"

    # ---- helpers
    def reply(self, body: bytes, status: int = 200, ctype: str = "application/json; charset=utf-8") -> None:
        # Cloudflare mengganti 502 dari origin dengan halaman error-nya sendiri; untuk pengunjung
        # publik, kegagalan data (biasanya: belum ada di cache) dikirim sebagai 503 agar pesannya sampai.
        if status == 502 and is_public_request():
            status = 503
        try:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def reply_json(self, obj, status: int = 200) -> None:
        self.reply(json.dumps(obj, ensure_ascii=False).encode(), status)

    def qs(self, name: str) -> str:
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get(name, [""])[0]

    def is_local(self) -> bool:
        # IP privat, loopback, link-local, dan CGNAT 100.64/10 (Tailscale). Alamat IPv4
        # yang dipetakan ke IPv6 (::ffff:a.b.c.d) dibuka dulu.
        try:
            ip = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            return False
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip in CGNAT

    # ---- HTTP
    def is_public(self) -> bool:
        # cloudflared selalu menambahkan Cf-Connecting-Ip; akses LAN/Tailscale langsung tidak.
        return bool(self.headers.get("Cf-Connecting-Ip"))

    def do_GET(self) -> None:  # noqa: N802
        _req.public = self.is_public()
        _req.public_fetch = False
        try:
            if not self.is_local():
                self.reply(b"", 403)
                return
            path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path.lstrip("/"))
            fresh = self.qs("fresh") == "1" and not _req.public
            if _req.public and path.startswith("api/"):
                # Pengunjung publik boleh memicu ambil data untuk emiten di radar (lihat cached_text).
                t = self.qs("ticker").upper()
                deals = [d.split(":")[0] for d in self.qs("deals").upper().split(",") if d]
                wanted = ([t] if t else []) + deals
                _req.public_fetch = all(x in radar_tickers() for x in wanted)
            if path.startswith("api/"):
                self.handle_api(path, fresh)
                return
            self.serve_static(path)
        except PublicNoCache as e:
            self.reply_json({"error": str(e) or "Data ini belum tersedia di versi publik."}, 503)
        except Exception as e:
            print(f"[error] {self.path}: {e}", file=sys.stderr)
            try:
                self.reply_json({"error": f"Server error: {e}"}, 500)
            except Exception:
                pass

    def do_PUT(self) -> None:  # noqa: N802
        self.handle_write("PUT")

    def do_POST(self) -> None:  # noqa: N802
        self.handle_write("POST")

    def do_DELETE(self) -> None:  # noqa: N802
        self.handle_write("DELETE")

    def read_json(self):
        """Body JSON penulisan. Content-Type wajib application/json: permintaan lintas situs
        dengan tipe ini selalu butuh preflight CORS, yang tidak dijawab server ini."""
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            raise ValueError("Content-Type harus application/json.")
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("Body terlalu besar.")
        return json.loads(self.rfile.read(n) or b"null")

    def handle_write(self, method: str) -> None:
        try:
            # Pasang kunci suara pria dari halaman Video (lihat tts_set_key: publik hanya sekali).
            if urllib.parse.urlparse(self.path).path.strip("/") == "api/tts-key" and method == "POST" and self.is_local():
                code, res = tts_set_key(self.read_json(), self.is_public(), self.headers.get("Cf-Connecting-Ip") or self.client_address[0])
                self.reply_json(res, code)
                return
            if self.is_public():
                self.reply_json({"error": "Versi publik hanya baca."}, 403)
                return
            if not self.is_local():
                self.reply(b"", 403)
                return
            path = urllib.parse.urlparse(self.path).path.strip("/")
            parts = path.split("/")
            body = None if method == "DELETE" else self.read_json()
            if len(parts) == 3 and parts[:2] == ["api", "items"] and TICKER_RE.match(parts[2]):
                t = parts[2]
                if method == "DELETE":
                    data_exec("DELETE FROM items WHERE ticker=?", [(t,)])
                    self.reply_json({"ok": True})
                elif method == "PUT" and valid_item(body) and body["ticker"] == t:
                    item_put(body)
                    self.reply_json({"ok": True})
                else:
                    self.reply_json({"error": "Item tidak valid."}, 400)
            elif path == "api/updates" and method == "POST":
                if not isinstance(body, list) or not all(valid_update(u) for u in body):
                    self.reply_json({"error": "Update tidak valid."}, 400)
                    return
                updates_put(body)
                self.reply_json({"ok": True, "count": len(body)})
            elif path == "api/migrate" and method == "POST" and isinstance(body, dict):
                self.reply_json(migrate(body))
            elif (len(parts) == 4 and parts[:3] == ["api", "kandidat", "hidden"] and TICKER_RE.match(parts[3])
                  and method in ("PUT", "DELETE")):
                # Kandidat otomatis yang disembunyikan tim (tidak relevan); DELETE memulihkan.
                if method == "PUT":
                    data_exec("INSERT OR REPLACE INTO kandidat_hidden VALUES(?,?)", [(parts[3], int(time.time()))])
                else:
                    data_exec("DELETE FROM kandidat_hidden WHERE ticker=?", [(parts[3],)])
                self.reply_json({"ok": True})
            elif (len(parts) == 3 and parts[:2] == ["api", "layout"] and TICKER_RE.match(parts[2])
                  and method == "PUT" and isinstance(body, dict)):
                data_exec("INSERT OR REPLACE INTO layout VALUES(?,?)",
                          [(parts[2], json.dumps(body, ensure_ascii=False))])
                self.reply_json({"ok": True})
            else:
                self.reply_json({"error": "Tidak ditemukan."}, 404)
        except (ValueError, json.JSONDecodeError) as e:
            self.reply_json({"error": str(e)}, 400)
        except Exception as e:
            print(f"[error] {method} {self.path}: {e}", file=sys.stderr)
            self.reply_json({"error": f"Server error: {e}"}, 500)

    def serve_static(self, path: str) -> None:
        # Hasil build Vue (dist/) didahulukan; file data JSON tetap dari ROOT.
        if path == "":
            path = "index.html"
        f = None
        for base in (DIST, ROOT):
            cand = (base / path).resolve()
            if cand.is_relative_to(base) and cand.is_file():
                f = cand
                break
        name = f.name if f else ""
        # Kode server/skrip (.py, .ps1), dotfile (token, kredensial, DB), dan config tidak pernah disajikan.
        # tsa-*.json tidak disajikan mentah; datanya lewat /api/tsa/<sumber> dan /api/tsa/summary.
        blocked = (not f or name.startswith(".") or f.suffix.lower() in (".py", ".ps1", ".pyc")
                   or name == "stockbit.config.json" or (name.startswith("tsa-") and name.endswith(".json")))
        if blocked:
            self.reply(b"", 404)
            return
        ext = f.suffix.lower()
        types = {".html": "text/html; charset=utf-8", ".css": "text/css",
                 ".js": "text/javascript", ".mjs": "text/javascript",
                 ".png": "image/png", ".svg": "image/svg+xml",
                 ".json": "application/json", ".ico": "image/x-icon",
                 ".woff2": "font/woff2", ".map": "application/json",
                 ".webmanifest": "application/manifest+json"}
        try:
            self.reply(f.read_bytes(), 200, types.get(ext, "application/octet-stream"))
        except OSError:
            self.reply(b"", 404)

    # ---- API
    def handle_api(self, path: str, fresh: bool) -> None:
        cfg = load_config()
        ticker = self.qs("ticker").upper()

        if path == "api/tts":
            # Narasi video (suara pria). 204 = tidak tersedia; frontend lalu memakai suara browser.
            audio = tts_audio(self.qs("t"), self.headers.get("Cf-Connecting-Ip") or self.client_address[0])
            if not audio:
                self.reply(b"", 204)
                return
            try:
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(audio)))
                self.send_header("Cache-Control", "public, max-age=2592000, immutable")
                self.end_headers()
                self.wfile.write(audio)
            except (BrokenPipeError, ConnectionResetError):
                pass
        elif path == "api/items":
            self.reply_json(items_all())
        elif path == "api/updates":
            self.reply_json(updates_all())
        elif path.startswith("api/layout/"):
            t = path.rsplit("/", 1)[1]
            if not TICKER_RE.match(t):
                self.reply_json({"error": "Kode saham harus 4 huruf."}, 400)
                return
            rows = data_rows("SELECT data FROM layout WHERE ticker=?", (t,))
            self.reply_json(json.loads(rows[0][0]) if rows else {})
        elif path == "api/features":
            self.reply_json(cfg.get("features") or {})
        elif path == "api/status":
            exp = token_exp()
            self.reply_json({
                "ok": True, "tokenLoaded": bool(get_token()), "tokenExp": exp,
                "sinkronStockbit": NEWS_STATE.get("sbOk") or sync_state().get("sbOk"),
                "tts": bool(tts_config()) and tts_usage()["karakter"] < TTS_MONTHLY_CHARS,
                "watcher": watcher_status(),
                "deploy": deploy_status(),
                "tokenStale": bool(exp and exp < time.time()),
                "pageFallback": False,
                "needsToken": bool(cfg and cfg.get("quote", {}).get("source") != "page"),
                "configured": bool(cfg and cfg.get("quote", {}).get("url")
                                   and "GANTI" not in cfg["quote"]["url"]),
                "reports": bool(cfg.get("reports", {}).get("url")) if cfg else False,
                "news": bool(cfg.get("news", {}).get("sources")) if cfg else False,
                "tenders": bool(cfg.get("tenders", {}).get("url")) if cfg else False,
                "stockbit1h": stats_1h(),
                "galatStockbit": _galat[-8:],
                "readOnly": is_public_request(),
                "newsAt": NEWS_STATE["at"],
            })
        elif path == "api/tenders":
            self.api_tenders(cfg, fresh)
        elif path == "api/ohlc":
            tf = self.qs("tf") if self.qs("tf") in ("3m", "6m", "1y", "3y") else "1y"
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                {"ticker": ticker, "tf": tf, "bars": get_ohlc(ticker, tf, fresh)})
        elif path == "api/insider":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_insider(ticker, max(30, min(720, int(self.qs("days") or 180))), fresh))
        elif path == "api/insider-rows":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(get_insider_rows(ticker, fresh))
        elif path == "api/insider-feed":
            self.guard_token() or self.reply_json(get_insider_feed(max(1, min(60, int(self.qs("days") or 14))), fresh))
        elif path == "api/controller":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_controller(ticker, self.qs("name"), fresh))
        elif path == "api/story":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_story(ticker, self.qs("controller"), self.qs("near"), fresh))
        elif path == "api/ownership":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_ownership(ticker, fresh))
        elif path in ("api/profile", "api/benchmark"):
            if not self.guard_token():
                if path == "api/profile":
                    if not self.guard_ticker(ticker):
                        self.reply_json(get_profile(ticker, fresh))
                else:
                    deals = [d for d in self.qs("deals").split(",") if d]
                    self.reply_json(get_benchmark(deals, fresh))
        elif path == "api/news":
            if not cfg or not cfg.get("news"):
                self.reply_json({"error": "Bagian news belum ada di stockbit.config.json."}, 500)
                return
            tickers = [t for t in self.qs("tickers").upper().split(",") if re.match(r"^[A-Z]{4}$", t)]
            self.reply_json(get_news(cfg["news"], tickers, fresh))
        elif path == "api/reports":
            self.api_reports(cfg, ticker, fresh)
        elif path == "api/diff":
            try:
                days = max(1, min(SNAP_KEEP_DAYS, int(self.qs("days") or 1)))
            except ValueError:
                days = 1
            self.reply_json(get_diff(days))
        elif path == "api/seasonality":
            try:
                month = min(12, max(1, int(self.qs("bulan") or 0) or datetime.now().month % 12 + 1))
                years = 5 if self.qs("tahun") == "5" else 10
            except ValueError:
                month, years = datetime.now().month % 12 + 1, 10
            self.reply_json(season_api(month, years))
        elif path == "api/ihsg-runtun":
            self.reply_json(runtun_api())
        elif path == "api/ihsg-astro":
            self.reply_json(astro_api())
        elif path == "api/nama-saham":
            self.reply_json(nama_semua())
        elif path == "api/ihsg-live":
            self.reply_json(live_api())
        elif path == "api/ihsg-outlook":
            try:
                month = min(12, max(1, int(self.qs("bulan") or 0) or datetime.now().month % 12 + 1))
            except ValueError:
                month = datetime.now().month % 12 + 1
            if self.qs("segar") == "1":
                ihsg_segarkan(public=_req.public)
            self.reply_json(ihsg_api(month))
        elif path == "api/saham-detail":
            kode = (self.qs("kode") or "").upper()
            try:
                month = min(12, max(1, int(self.qs("bulan") or 0) or datetime.now().month % 12 + 1))
            except ValueError:
                month = datetime.now().month % 12 + 1
            if not re.match(r"^[A-Z]{4}$", kode):
                self.reply_json({"error": "Kode saham tidak valid."}, 400)
            else:
                self.reply_json(saham_detail(kode, month))
        elif path == "api/recovery":
            try:
                month = min(12, max(1, int(self.qs("bulan") or 0) or datetime.now().month % 12 + 1))
            except ValueError:
                month = datetime.now().month % 12 + 1
            self.reply_json(recovery_api(month))
        elif path == "api/broker-pola":
            d = broker_data()
            if not d:
                self.reply_json({"error": "Data pola broker sedang disiapkan (pembaruan otomatis Senin-Sabtu pukul 00.01 WIB). Coba lagi beberapa menit lagi."})
            else:
                try:
                    month = int(self.qs("bulan") or 0) or None
                except ValueError:
                    month = None
                bro = (self.qs("broker") or "").upper()
                jn = self.qs("jenis") if self.qs("jenis") in ("asing", "domestik") else ""
                sym = (self.qs("saham") or "").upper()
                harian = self.qs("harian") == "1"
                if harian and not broker_harian_data().get("hari"):
                    self.reply_json({"error": "Data harian sedang disiapkan (20 hari bursa terakhir, diperbarui tiap hari bursa setelah 16.45 WIB). Coba lagi beberapa menit lagi."})
                elif harian and re.match(r"^[A-Z]{4}$", sym):
                    self.reply_json({"saham": sym, "jenis": jn, "harian": True, "seri": BP.series_harian(broker_harian_data(), sym, broker_daftar(), jn)})
                elif harian:
                    tg = self.qs("tanggal") or ""
                    self.reply_json(BP.view_harian(broker_harian_data(), tg if re.match(r"^\d{4}-\d\d-\d\d$", tg) else "", broker_daftar(), jn))
                elif re.match(r"^[A-Z]{4}$", sym):
                    self.reply_json({"saham": sym, "jenis": jn, "tahun": d.get("tahun"), "seri": BP.series(d, sym, jn)})
                else:
                    self.reply_json(BP.view(d, month, bro if re.match(r"^[A-Z0-9]{2}$", bro) else None, jn))
        elif path == "api/seasonality-detail":
            sym = (self.qs("kode") or "").upper()
            d = SZ.detail(season_data(), sym, 5 if self.qs("tahun") == "5" else 10) if re.match(r"^[A-Z0-9]{3,10}$", sym) else None
            self.reply_json(d or {"error": "Kode tidak ada di data seasonality."}, 200 if d else 404)
        elif path == "api/pov":
            self.reply_json(get_pov(fresh and not is_public_request()))
        elif path == "api/kandidat":
            if not self.guard_token():
                res = get_kandidat(cfg, fresh)
                # Penyaringan "disembunyikan" di luar memo supaya langsung berlaku.
                hidden = {t: at for t, at in data_rows("SELECT ticker, hidden_at FROM kandidat_hidden")}
                self.reply_json({**res, "items": [k for k in res["items"] if k["ticker"] not in hidden],
                                 "hidden": [{"ticker": t, "at": at, "name": next((k.get("name") for k in res["items"]
                                             if k["ticker"] == t), "")} for t, at in sorted(hidden.items())]})
        elif path == "api/viz/summary":
            # Agregat lokal untuk infografis: komposisi tahap emiten dari story-verified.json +
            # daftar backdoor di config — tanpa token Stockbit.
            bd = (cfg.get("backdoor") or {})
            include = [x for x in (bd.get("include") or []) if TICKER_RE.match(str(x))]
            stages = {"spa": 0, "tender": 0, "rupslb": 0, "injeksi": 0, "selesai": 0}
            verified = 0
            try:
                sv = json.loads((ROOT / "story-verified.json").read_text(encoding="utf-8"))
                for tkr, st in sv.items():
                    if tkr not in include or not isinstance(st, dict):
                        continue
                    verified += 1
                    # tahap ditentukan field yang terisi: target/nominal terisi = injeksi;
                    # ada normalized data lain = tender; kosong semua = spa (negosiasi).
                    if (str(st.get("target") or "")).strip() or (str(st.get("injectTarget") or "")).strip():
                        stages["injeksi"] += 1
                    elif (str(st.get("nominal") or "")).strip():
                        stages["tender"] += 1
                    else:
                        stages["spa"] += 1
            except Exception:
                pass
            rest = max(0, len(include) - verified)
            stages["spa"] += rest
            self.reply_json({
                "total": len(include),
                "verified": verified,
                "stages": [
                    {"label": "PPJB/negosiasi", "value": stages["spa"]},
                    {"label": "PTW/tender", "value": stages["tender"]},
                    {"label": "RUPSLB", "value": stages["rupslb"]},
                    {"label": "Injeksi aset", "value": stages["injeksi"]},
                    {"label": "Selesai", "value": stages["selesai"]},
                ],
                "generated": int(time.time()),
            })
        elif path.startswith("api/tsa/") and path.rsplit("/", 1)[1] in TSA_SETS:
            # Dataset penuh dari file lokal (tidak memanggil tradersaham per pengunjung).
            self.reply_json(tsa_full(path.rsplit("/", 1)[1]))
        elif path == "api/tsa/summary":
            # Data intel pasar dari tradersaham.com (snapshot tsa-*.json) untuk emiten radar.
            if not self.guard_ticker(ticker):
                self.reply_json(tsa_summary(ticker))
        elif path == "api/raw":
            if self.guard_ticker(ticker):
                return
            try:
                pp = page_props(ticker, fresh)
                pp.pop("posts", None)   # postingan pengguna tidak ikut dikirim
                self.reply_json(pp)
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
        else:
            self.api_quote(cfg, ticker, fresh)

    def guard_token(self) -> bool:
        """True bila error sudah dikirim (token hilang/ditolak)."""
        if get_token():
            return False
        self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
        return True

    def guard_ticker(self, ticker: str) -> bool:
        if re.match(r"^[A-Z]{4}$", ticker):
            return False
        self.reply_json({"error": "Kode saham harus 4 huruf."}, 400)
        return True

    def api_quote(self, cfg, ticker: str, fresh: bool) -> None:
        if not self.guard_ticker(ticker):
            if not cfg or not cfg.get("quote"):
                self.reply_json({"error": "stockbit.config.json belum diisi."}, 500)
                return
            q = cfg["quote"]
            if q.get("source") == "page":
                try:
                    self.reply_json(self.page_quote_fields(q, ticker, fresh))
                except Exception as e:
                    self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
                return
            # source=api → fallback halaman publik bila token hilang/kedaluwarsa/ditolak.
            try:
                res = stockbit_api(q["url"].replace("{ticker}", ticker), fresh)
            except (NoToken, Upstream401):
                try:
                    self.reply_json(page_quote(ticker, fresh))
                except NoToken:
                    self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
                except Exception as e:
                    self.reply_json({"error": f"Token ditolak Stockbit dan fallback gagal: {e}"}, 502)
                return
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
                return
            self.reply_json(self.map_fields(q, res))

    def page_quote_fields(self, q, ticker: str, fresh: bool) -> dict:
        pp = page_props(ticker, fresh)
        f = q.get("fields", {})
        # Field config ditulis relatif ke root __NEXT_DATA__ (mis. props.pageProps.company.name);
        # fallback tanpa prefix bila field ditulis relatif ke company.
        cp = {"company": pp.get("company", {})}

        def num(v):
            try:
                return float(v) if v not in ("", None) else None
            except (TypeError, ValueError):
                return None

        def val(key: str, dflt_path: str):
            raw = get_by_path(pp, f.get(key) or "") if f.get(key) else None
            if raw is None:
                raw = get_by_path(cp, dflt_path)
            return raw

        mcap = num(val("mcap", "") or None)
        return {"ticker": ticker,
                "name": val("name", "company.name"),
                "price": num(val("price", "company.lastprice")),
                "mcap": (mcap / float(q["mcapDivisor"])) if mcap is not None and q.get("mcapDivisor") else mcap,
                "float": num(val("float", "")),
                "uma": val("uma", "company.uma") is True,
                "corpAction": val("corpAction", "company.corp_action.active") is True,
                "volume": num(val("volume", "company.volume")),
                "avgVolume": num(val("avgVolume", "company.average")),
                # perubahan harga sesi terakhir (%) dari halaman Stockbit
                "pctChange": num(get_by_path(cp, "company.percentage_change"))}

    def map_fields(self, q, res) -> dict:
        f = q.get("fields", {})

        def num(v):
            if v in ("", None):
                return None
            try:
                return float(re.sub(r"[^\d.\-]", "", str(v)))
            except ValueError:
                return None

        mcap = num(get_by_path(res, f.get("mcap") or ""))
        if mcap is not None and q.get("mcapDivisor"):
            mcap = mcap / float(q["mcapDivisor"])
        return {"ticker": self.qs("ticker").upper(),
                "name": get_by_path(res, f.get("name") or ""),
                "price": num(get_by_path(res, f.get("price") or "")),
                "mcap": mcap, "float": num(get_by_path(res, f.get("float") or "")),
                "uma": get_by_path(res, f.get("uma") or "") is True,
                "corpAction": get_by_path(res, f.get("corpAction") or "") is True,
                "volume": num(get_by_path(res, f.get("volume") or "")),
                "avgVolume": num(get_by_path(res, f.get("avgVolume") or ""))}

    def api_tenders(self, cfg, fresh: bool) -> None:
        if not cfg or not cfg.get("tenders"):
            self.reply_json({"error": "Bagian tenders belum ada di stockbit.config.json."}, 500)
            return
        try:
            res = stockbit_api(cfg["tenders"]["url"], fresh)
        except NoToken:
            self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
            return
        except urllib.error.HTTPError as e:
            if e.code == 401:
                self.reply_json({"error": "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru."}, 401)
            else:
                self.reply_json({"error": f"Gagal memanggil Stockbit: HTTP {e.code}"}, 502)
            return
        except Exception as e:
            self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
            return
        min_pct = float(cfg["tenders"].get("minPercent") or 0)
        by = {}
        for t in res.get("data", {}).get("tender") or []:
            sym = str(t.get("company_symbol") or "")
            if not re.match(r"^[A-Z]{4}$", sym):
                continue
            try:
                if float(t.get("tender_percentage") or 0) < min_pct:
                    continue
            except (TypeError, ValueError):
                continue
            if sym not in by or str(t.get("tender_start") or "") > str(by[sym].get("start") or ""):
                by[sym] = {"ticker": sym, "name": t.get("company_name"),
                           "price": float(t.get("tender_price") or 0),
                           "percent": float(t.get("tender_percentage") or 0),
                           "shares": str(t.get("tender_shares") or ""),
                           "start": str(t.get("tender_start") or ""),
                           "end": str(t.get("tender_end") or ""),
                           "paydate": str(t.get("tender_paydate") or ""),
                           "active": bool(t.get("corp_action_active"))}
        bd = cfg.get("backdoor") or {}
        include = [s for s in (bd.get("include") or []) if re.match(r"^[A-Z]{4}$", str(s))]
        for sym in include:
            if sym in by:
                by[sym]["confirmed"] = True
                continue
            entry = {"ticker": sym, "name": "", "confirmed": True}
            try:
                ca = stockbit_api(bd.get("corpactionUrl", "").replace("{ticker}", sym), fresh)
                tos = sorted((a.get("action_info", {}).get("tenderoffer")
                              for a in ca.get("data") or []
                              if a.get("action_type") == "tenderoffer" and a.get("action_info")),
                             key=lambda t: str(t.get("tender_start") or ""), reverse=True)
                if tos:
                    to = tos[0]
                    entry.update({"name": to.get("company_name"),
                                  "price": float(to.get("tender_price") or 0),
                                  "percent": float(to.get("tender_percentage") or 0),
                                  "shares": str(to.get("tender_shares") or ""),
                                  "start": str(to.get("tender_start") or ""),
                                  "end": str(to.get("tender_end") or ""),
                                  "paydate": str(to.get("tender_paydate") or ""),
                                  "active": bool(to.get("corp_action_active"))})
            except Exception:
                pass
            by[sym] = entry
            time.sleep(0.3)
        for x in bd.get("exclude") or []:
            by.pop(str(x), None)
        self.reply_json({"items": list(by.values()), "exclude": bd.get("exclude") or []})

    def api_reports(self, cfg, ticker: str, fresh: bool) -> None:
        if not cfg.get("reports"):
            self.reply_json({"error": "Bagian reports belum ada di stockbit.config.json."}, 500)
            return
        if not self.guard_ticker(ticker):
            try:
                self.reply_json({"ticker": ticker, "items": get_reports(cfg["reports"], ticker, fresh)})
            except NoToken:
                self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
            except urllib.error.HTTPError as e:
                self.reply_json({"error": f"Token ditolak Stockbit (HTTP {e.code})." if e.code == 401
                                 else f"Gagal memanggil Stockbit: HTTP {e.code}"}, 401 if e.code == 401 else 502)
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)

    def log_message(self, fmt, *args):  # quiet
        pass


def num_get(obj, path):
    v = get_by_path(obj, path or "")
    if v in ("", None):
        return None
    try:
        return float(re.sub(r"[^\d.\-]", "", str(v)))
    except ValueError:
        return None


_config_cache: tuple[float, dict | None] | None = None
_config_lock = threading.Lock()


def load_config() -> dict | None:
    global _config_cache
    with _config_lock:
        try:
            m = CONFIG_PATH.stat().st_mtime
            if _config_cache and _config_cache[0] == m:
                return _config_cache[1]
            cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            _config_cache = (m, cfg)
            return cfg
        except Exception:
            return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Radar Cangkang server")
    ap.add_argument("--lan", action="store_true", help="terbuka untuk jaringan lokal")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    try:
        srv = ThreadingHTTPServer((host, args.port), Handler)
    except OSError as e:
        print(f"Port {args.port} sedang dipakai ({e}). Tutup proses lain dulu.", file=sys.stderr)
        return 1
    daemon = threading.Thread(target=srv.serve_forever, daemon=False)
    daemon.start()
    threading.Thread(target=kandidat_loop, daemon=True).start()
    threading.Thread(target=news_loop, daemon=True).start()
    threading.Thread(target=pov_loop, daemon=True).start()
    threading.Thread(target=season_loop, daemon=True).start()
    threading.Thread(target=ihsg_loop, daemon=True).start()
    threading.Thread(target=live_loop, daemon=True).start()
    threading.Thread(target=broker_harian_loop, daemon=True).start()
    threading.Thread(target=snapshot_loop, daemon=True).start()
    threading.Thread(target=tsa_loop, daemon=True).start()
    print(f"Radar Backdoor berjalan di http://localhost:{args.port}")
    print(f"Token Stockbit: {'terbaca' if get_token() else 'belum ada (tidak wajib untuk mode page)'}")
    if args.lan:
        import socket
        ips = set()
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                ip = info[4][0]
                if not ip.startswith("127."):
                    ips.add(ip)
        except OSError:
            pass
        if ips:
            print("\nBuka dari perangkat lain di jaringan lokal:")
            for ip in sorted(ips):
                print(f"  http://{ip}:{args.port}/")
    try:
        daemon.join()
    except KeyboardInterrupt:
        print("\nServer dimatikan.")
        srv.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
