"""Berita pasar saham & IHSG dari RSS media nasional, dengan ringkasan isi artikel (paragraf pembuka).

Hanya feed RSS resmi; situs yang memblokir (403) diambil lewat RSS Google News per situs. Isi artikel
diambil dari halaman publiknya (paragraf <p>) dan disimpan di memori agar tiap artikel cukup diambil sekali.
"""
from __future__ import annotations

import html
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

WIB = timezone(timedelta(hours=7))
UA = "Mozilla/5.0 (compatible; RadarBackdoor/1.0; +https://saham.aseprudal.web.id)"
GN = "https://news.google.com/rss/search?hl=id&gl=ID&ceid=ID:id&q="

# (nama sumber, url RSS, saring relevansi). Feed umum (ekonomi/bisnis) disaring agar hanya berita saham/IHSG.
FEEDS = [
    ("CNBC Indonesia", "https://www.cnbcindonesia.com/market/rss", False),
    ("Bloomberg Technoz", "https://www.bloombergtechnoz.com/rss", True),
    ("IDX Channel", "https://www.idxchannel.com/rss/market-news", False),
    ("CNN Indonesia", "https://www.cnnindonesia.com/ekonomi/rss", True),
    ("Kontan", "https://investasi.kontan.co.id/rss", False),
    ("detikFinance", "https://finance.detik.com/rss", True),
    ("Katadata", "https://katadata.co.id/rss", True),
    ("Investor.id", "https://www.investor.id/rss/market", True),
    ("Liputan6", "https://feed.liputan6.com/rss/saham", False),
    ("Okezone", "https://sindikasi.okezone.com/index.php/rss/11/RSS2.0", True),
    ("Tempo", "https://rss.tempo.co/bisnis", True),
    ("Antara", "https://www.antaranews.com/rss/ekonomi-bursa.xml", False),
    # Bisnis.com & EmitenNews menolak akses RSS langsung (403/500): pakai RSS Google News per situs.
    ("Bisnis.com", GN + "(IHSG+OR+saham)+site:market.bisnis.com+when:3d", False),
    ("EmitenNews.com", GN + "(IHSG+OR+saham)+site:emitennews.com+when:3d", False),
]

RELEVAN = re.compile(
    r"ihsg|saham|bursa|\bbei\b|emiten|indeks|investor asing|\basing\b|net (buy|sell)|lq45|idx|msci|ftse|dividen|"
    r"rights issue|\bipo\b|buyback|obligasi|\bsbn\b|yield|rupiah|suku bunga|bi rate|the fed|fomc|\bojk\b|"
    r"wall street|komoditas|batu bara|nikel|\bcpo\b|\bemas\b|\bminyak\b", re.I)
IHSG_JUDUL = re.compile(r"ihsg|indeks|bursa|\basing\b|rupiah|dolar|suku bunga|the fed|bi rate|msci|wall street|yield|inflasi", re.I)
# Pembuka artikel yang bukan isi: "Reporter: .. | Editor: ..", "KONTAN.CO.ID - JAKARTA.", "Jakarta, CNBC Indonesia -".
PEMBUKA = re.compile(r"^(?:.{0,160}?(?:KONTAN\.CO\.ID\s*-\s*[A-Z ]+\.|Bisnis\.com,\s*[A-Z ]+\s*[-–—]|IDXChannel\s*[-–—]|"
                     r"Liputan6\.com,\s*\w+\s*[-–—]|[A-Z]{3,},\s*[a-z][\w.]+\.(?:id|com)\s*[-–—]|[A-Z][\w.]+(?: [\w.]+){0,3},\s*[A-Z][\w.]+(?: [\w.]+){0,3}\s*[-–—])\s*)")


def bersih(teks: str) -> str:
    return PEMBUKA.sub("", teks or "", count=1).strip()
SAMPAH = re.compile(r"^(baca juga|untuk masuk dan daftar|advertisement|scroll to|simak|lihat juga|copyright|©|tonton|ikuti|follow|"
                    r"disclaimer|artikel ini|sumber:|editor:|penulis:)", re.I)
_artikel: dict[str, str] = {}


def _get(url: str, limit: int = 2_000_000) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "id,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=12) as r:
        raw = r.read(limit)
        cs = r.headers.get_content_charset() or "utf-8"
    return raw.decode(cs, "replace")


def _txt(s: str) -> str:
    s = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", s or "", flags=re.S)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


def _tag(item: str, name: str) -> str:
    m = re.search(rf"<{name}\b[^>]*>(.*?)</{name}>", item, re.S)
    return m.group(1) if m else ""


def parse_rss(xml: str, sumber: str) -> list[dict]:
    """Item RSS 2.0 -> {t (ISO WIB), d, title, ringkas, sumber, url}. Parser regex (tanpa entitas XML)."""
    out = []
    for it in re.findall(r"<item\b.*?</item>", xml, re.S):
        title, url = _txt(_tag(it, "title")), _txt(_tag(it, "link"))
        if not title or not url.startswith("http"):
            continue
        try:
            t = parsedate_to_datetime(_txt(_tag(it, "pubDate"))).astimezone(WIB)
        except (TypeError, ValueError):
            continue
        src = sumber
        if url.startswith("https://news.google.com/"):
            # Judul Google News: "Judul - Nama Situs"; deskripsinya hanya tautan, jadi tidak dipakai.
            nama = _txt(_tag(it, "source"))
            i = title.rfind(" - " + nama) if nama else -1
            title = title[:i] if i > 0 else re.sub(r"\s+-\s+(Bisnis|Emiten)[\w. -]*$", "", title, flags=re.I)
            desk = ""
        else:
            desk = _txt(_tag(it, "content:encoded")) or _txt(_tag(it, "description"))
        out.append({"t": t.strftime("%Y-%m-%d %H:%M"), "d": t.strftime("%Y-%m-%d"), "title": title[:220],
                    "ringkas": bersih(desk)[:900], "sumber": src, "url": url})
    return out


def article_text(url: str, maks: int = 900) -> str:
    """Paragraf pembuka artikel (tanpa 'Baca juga', iklan, dsb.), maks. `maks` karakter. Kosong bila gagal."""
    if url in _artikel:
        return _artikel[url]
    teks = ""
    try:
        page = _get(url)
        page = re.sub(r"<(script|style|noscript|figure|aside)\b.*?</\1>", " ", page, flags=re.S | re.I)
        ps = [_txt(p) for p in re.findall(r"<p\b[^>]*>(.*?)</p>", page, re.S | re.I)]
        ps = [p for p in ps if len(p) >= 60 and not SAMPAH.match(p)]
        for p in ps:
            if len(teks) >= maks:
                break
            teks = (teks + " " + p).strip()
        teks = bersih(teks)
        teks = teks[:maks].rsplit(" ", 1)[0] + "…" if len(teks) > maks else teks
    except Exception:
        teks = ""
    if len(_artikel) > 800:
        _artikel.clear()
    _artikel[url] = teks
    return teks


def _kunci(title: str) -> str:
    return re.sub(r"[^a-z0-9]", "", title.lower())[:60]


def collect(days: int = 3, detail: int = 80, log=print) -> list[dict]:
    """Berita saham/IHSG terbaru dari semua feed (terbaru dulu, tanpa duplikat judul). `detail` berita teratas
    yang ringkasannya pendek dilengkapi paragraf pembuka artikel."""
    cutoff = (datetime.now(WIB) - timedelta(days=days)).strftime("%Y-%m-%d")

    def ambil(f):
        nama, url, saring = f
        try:
            xs = parse_rss(_get(url), nama)
        except Exception as e:
            log(f"[berita-pasar] {nama} gagal: {e}")
            return []
        return [x for x in xs if x["d"] >= cutoff and (not saring or RELEVAN.search(x["title"] + " " + x["ringkas"]))]

    with ThreadPoolExecutor(6) as ex:
        semua = [x for xs in ex.map(ambil, FEEDS) for x in xs]
    semua.sort(key=lambda x: x["t"], reverse=True)
    out, seen = [], set()
    for x in semua:
        k = _kunci(x["title"])
        if k not in seen:
            seen.add(k)
            out.append(x)
    # Isi artikel diambil untuk berita yang judulnya menyangkut IHSG/pasar lebih dulu, lalu sisanya (terbaru dulu).
    kandidat = [x for x in out if len(x["ringkas"]) < 300 and not x["url"].startswith("https://news.google.com/")]
    perlu = sorted(kandidat, key=lambda x: not IHSG_JUDUL.search(x["title"]))[:detail]
    with ThreadPoolExecutor(6) as ex:
        for x, teks in zip(perlu, ex.map(article_text, (x["url"] for x in perlu))):
            if len(teks) > len(x["ringkas"]):
                x["ringkas"] = teks
    return out


if __name__ == "__main__":
    t0 = time.time()
    xs = collect()
    from collections import Counter
    print(len(xs), "berita", round(time.time() - t0, 1), "detik", Counter(x["sumber"] for x in xs))
    for x in xs[:5]:
        print(x["t"], x["sumber"], x["title"][:80], "|", len(x["ringkas"]))
