"""Uji endpoint data radar (items, updates, migrate, layout) dan perbaikan server.

Jalankan: python3 website/test_server.py
"""
import json
import time
import tempfile
import threading
import unittest
import unittest.mock
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from datetime import datetime, timedelta
import server

# Data contoh tradersaham untuk tes (file asli tsa-*.json tidak dilacak git).
_TSA_TMP = tempfile.TemporaryDirectory()
for _n, _d in {"signals": {"ASPI": {"regimeSignal": "BULL"}}, "gems": {}, "foreign-flow": [],
               "broker-scanner": {"stocks": []}, "meta": {"sumber": "tes"}}.items():
    (Path(_TSA_TMP.name) / f"tsa-{_n}.json").write_text(json.dumps(_d))
server.TSA_DIR = Path(_TSA_TMP.name)
server._TSA_MEMO.clear()


class DataApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        server.DATA_DB = Path(cls.tmp.name) / "radar.sqlite"
        server._data = None
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.tmp.cleanup()

    def call(self, method, path, body=None, ctype="application/json", public=False):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if public:
            req.add_header("Cf-Connecting-Ip", "203.0.113.9")  # seperti request lewat Cloudflare Tunnel
        if ctype:
            req.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"null")

    def test_01_migrate_once_then_items(self):
        payload = {"items": [{"ticker": "NAYZ", "stage": "tender"}, {"ticker": "bad"}],
                   "updates": [{"id": "news-1", "date": "2026-10-13", "ticker": "KETR"}]}
        st, res = self.call("POST", "/api/migrate", payload)
        self.assertEqual((st, res["migrated"], res["items"], res["updates"]), (200, True, 1, 1))
        st, res = self.call("POST", "/api/migrate", payload)
        self.assertFalse(res["migrated"])
        st, items = self.call("GET", "/api/items")
        self.assertEqual([i["ticker"] for i in items], ["NAYZ"])

    def test_09_public_ohlc_any_bei_code(self):
        # Halaman Harmonic Pattern publik: candle /api/ohlc boleh diambil untuk kode BEI mana pun (jalur cache + jatah),
        # kode di luar BEI tetap hanya dari cache.
        seen = []
        def fake(t, tf="1y", fresh=False):
            seen.append((t, tf, fresh, getattr(server._req, "public_fetch", None)))
            return [{"d": "2026-11-11", "o": 1, "h": 1, "l": 1, "c": 1, "v": 1}]
        with unittest.mock.patch.object(server, "get_ohlc", fake), unittest.mock.patch.object(server, "get_token", lambda: "x"),                 unittest.mock.patch.object(server, "bei_kode_load", lambda: {"ZZZA"}):
            st, res = self.call("GET", "/api/ohlc?ticker=ZZZA&tf=3y&fresh=1", public=True)
            self.assertEqual((st, res["tf"], len(res["bars"])), (200, "3y", 1))
            self.call("GET", "/api/ohlc?ticker=ZZZB&tf=3y", public=True)
        self.assertEqual(seen, [("ZZZA", "3y", False, True), ("ZZZB", "3y", False, False)])

    def test_02_put_delete_item(self):
        st, _ = self.call("PUT", "/api/items/BIKE", {"ticker": "BIKE", "notes": "x"})
        self.assertEqual(st, 200)
        st, _ = self.call("PUT", "/api/items/BIKE", {"ticker": "NAYZ"})
        self.assertEqual(st, 400)  # ticker di body harus sama dengan path
        st, _ = self.call("PUT", "/api/items/bike", {"ticker": "bike"})
        self.assertEqual(st, 404)
        self.call("DELETE", "/api/items/BIKE", ctype=None)
        _, items = self.call("GET", "/api/items")
        self.assertNotIn("BIKE", [i["ticker"] for i in items])

    def test_03_content_type_required(self):
        st, _ = self.call("PUT", "/api/items/NAYZ", {"ticker": "NAYZ"}, ctype="text/plain")
        self.assertEqual(st, 400)

    def test_04_updates_and_layout(self):
        st, _ = self.call("POST", "/api/updates", [{"id": "sb-1", "date": "2026-10-14"}])
        self.assertEqual(st, 200)
        st, _ = self.call("POST", "/api/updates", [{"date": "x"}])
        self.assertEqual(st, 400)
        self.call("PUT", "/api/layout/NAYZ", {"saiko": {"x": 1, "y": 2}})
        _, lay = self.call("GET", "/api/layout/NAYZ")
        self.assertEqual(lay, {"saiko": {"x": 1, "y": 2}})

    def test_05_ohlc_bad_ticker_not_500(self):
        st, _ = self.call("GET", "/api/ohlc?ticker=xx&tf=3m", ctype=None)
        self.assertIn(st, (400, 401))

    def test_06_tsa_summary_endpoint(self):
        st, res = self.call("GET", "/api/tsa/summary?ticker=ASPI", ctype=None)
        self.assertEqual(st, 200)
        self.assertEqual(res["ticker"], "ASPI")
        self.assertTrue(res["ada"])
        st, _ = self.call("GET", "/api/tsa/summary?ticker=bad", ctype=None)
        self.assertEqual(st, 400)
        st, res = self.call("GET", "/api/tsa/signals", ctype=None)
        self.assertEqual((st, res["rows"][0]["regimeSignal"]), (200, "BULL"))
        st, res = self.call("GET", "/api/tsa/broker-scanner", ctype=None)
        self.assertEqual((st, res["rows"]), (200, []))
        st, _ = self.call("GET", "/api/tsa/rahasia", ctype=None)
        self.assertNotEqual(st, 200)  # hanya 4 sumber yang dikenal

    def test_07_public_is_read_only(self):
        st, res = self.call("PUT", "/api/items/NAYZ", {"ticker": "NAYZ"}, public=True)
        self.assertEqual(st, 403)
        st, res = self.call("GET", "/api/status", ctype=None, public=True)
        self.assertTrue(res["readOnly"])
        st, res = self.call("GET", "/api/status", ctype=None)
        self.assertFalse(res["readOnly"])
        st, items = self.call("GET", "/api/items", ctype=None, public=True)
        self.assertEqual(st, 200)

    def test_08_kandidat_hide(self):
        req = lambda m: urllib.request.urlopen(urllib.request.Request(
            self.base + "/api/kandidat/hidden/ABCD", data=b"{}" if m == "PUT" else None, method=m,
            headers={"Content-Type": "application/json"}))
        self.assertEqual(json.loads(req("PUT").read())["ok"], True)
        self.assertEqual(server.data_rows("SELECT ticker FROM kandidat_hidden"), [("ABCD",)])
        req("DELETE")
        self.assertEqual(server.data_rows("SELECT ticker FROM kandidat_hidden"), [])

    def test_09_diff_since_snapshot(self):
        server.item_put({"id": "DIFX", "ticker": "DIFX", "stage": "tender", "price": 100, "ctrlPct": 50,
                         "ms": {"spa": True}, "flags": {}})
        server.snapshot_today(force=True)
        server.item_put({"id": "DIFX", "ticker": "DIFX", "stage": "tender", "price": 120, "ctrlPct": 75,
                         "ms": {"spa": True, "akuisisi": True}, "flags": {}})
        d = {x["ticker"]: x["changes"] for x in server.get_diff(1)["items"]}
        kinds = {c["k"]: c for c in d["DIFX"]}
        self.assertEqual(kinds["price"]["pct"], 20.0)
        self.assertEqual((kinds["ctrl"]["from"], kinds["ctrl"]["to"]), (50, 75))
        self.assertEqual(kinds["ms"]["added"], ["akuisisi"])
        server.data_exec("DELETE FROM items WHERE ticker=?", [("DIFX",)])

    def test_06_static_traversal_blocked(self):
        st, _ = self.call("GET", "/..%2fserver.py", ctype=None)
        self.assertEqual(st, 404)
        for f in ("/server.py", "/tsa_refresh.py", "/test_server.py", "/tsa-signals.json"):
            st, _ = self.call("GET", f, ctype=None)
            self.assertEqual(st, 404, f)


class CacheTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        server.CACHE_DB = Path(self.tmp.name) / "cache.sqlite"
        server._db = None
        server._fail_until.clear()

    def tearDown(self):
        server._db = None
        self.tmp.cleanup()

    def test_fresh_reuses_recent_copy(self):
        calls = []
        f = lambda: calls.append(1) or "body"
        url = "https://exodus.stockbit.com/emitten/NAYZ/profile"
        self.assertEqual(server.cached_text(url, f), "body")
        self.assertEqual(server.cached_text(url, f, fresh=True), "body")
        self.assertEqual(len(calls), 1)  # salinan < 5 menit dipakai walau fresh

    def test_public_reads_cache_only(self):
        url = "https://exodus.stockbit.com/emitten/BBCA/profile"
        server._req.public = True
        try:
            with self.assertRaises(server.PublicNoCache):
                server.cached_text(url, lambda: self.fail("tidak boleh memanggil Stockbit"))
            server.cache_write(url, "lama")
            self.assertEqual(server.cached_text(url, lambda: self.fail("tidak boleh memanggil")), "lama")
        finally:
            server._req.public = False

    def test_public_fetch_radar_with_budget(self):
        url = "https://exodus.stockbit.com/emitten/APEX/profile"
        server._req.public, server._req.public_fetch = True, True
        old = server.PUBLIC_BUDGET
        try:
            calls = []
            self.assertEqual(server.cached_text(url, lambda: calls.append(1) or "baru"), "baru")
            self.assertEqual(server.cached_text(url, lambda: calls.append(1) or "lagi"), "baru")  # TTL biasa
            self.assertEqual(len(calls), 1)
            server.PUBLIC_BUDGET = 0  # jatah habis: tanpa cache = PublicNoCache
            with self.assertRaises(server.PublicNoCache):
                server.cached_text(url + "x", lambda: self.fail("jatah habis, tidak boleh memanggil"))
        finally:
            server.PUBLIC_BUDGET = old
            server._req.public, server._req.public_fetch = False, False

    def test_prune_and_memo_cap(self):
        server.cache_write("https://x/lama", "a")
        server.cache_write("https://x/baru", "b")
        con = server.db()
        con.execute("UPDATE http_cache SET fetched_at=0 WHERE url='https://x/lama'")
        con.commit()
        self.assertEqual(server.cache_prune(), 1)
        self.assertIsNone(server.cache_read("https://x/lama", 0))
        self.assertEqual(server.cache_read("https://x/baru", 0), "b")
        old = server._benchmark
        server._benchmark = lambda deals, fresh=False: {"n": len(deals)}
        try:
            server._bm_memo.clear()
            for i in range(server.BM_MEMO_MAX + 10):
                server.get_benchmark([f"ABCD:2026-01-{i:02d}"])
            self.assertEqual(len(server._bm_memo), server.BM_MEMO_MAX)
        finally:
            server._benchmark = old
            server._bm_memo.clear()

    def test_failure_backoff_uses_stale(self):
        url = "https://exodus.stockbit.com/stream/v3/symbol/NAYZ"
        server.cache_write(url, "lama")
        con = server.db()
        con.execute("UPDATE http_cache SET fetched_at=0")
        con.commit()
        calls = []

        def boom():
            calls.append(1)
            raise RuntimeError("401")
        self.assertEqual(server.cached_text(url, boom), "lama")
        self.assertEqual(server.cached_text(url, boom), "lama")
        self.assertEqual(len(calls), 1)  # percobaan kedua tidak memanggil Stockbit


class KandidatTest(unittest.TestCase):
    def test_tts_set_key_guards(self):
        old_cfg, old_try = server.tts_config, server.tts_try_key
        try:
            server.tts_try_key = lambda k, r: False
            self.assertEqual(server.tts_set_key({"key": "pendek"}, True, "1.1.1.1")[0], 400)          # format salah
            server.tts_config = lambda: ("x" * 32, "southeastasia")
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.2")[0], 403)          # publik tidak boleh mengganti
            server.tts_config = lambda: None
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.3")[0], 400)          # ditolak Azure, tidak disimpan
            for _ in range(5):
                server.tts_set_key({"key": "A" * 32}, True, "1.1.1.4")
            self.assertEqual(server.tts_set_key({"key": "A" * 32}, True, "1.1.1.4")[0], 429)          # batas percobaan
        finally:
            server.tts_config, server.tts_try_key = old_cfg, old_try

    def test_tts_cache_and_fallback(self):
        import tempfile
        from pathlib import Path
        old_dir, old_cfg = server.TTS_DIR, server.tts_config
        with tempfile.TemporaryDirectory() as d:
            server.TTS_DIR = Path(d)
            try:
                server.tts_config = lambda: None
                self.assertIsNone(server.tts_audio("Halo"))            # tanpa kunci: frontend pakai suara browser
                import hashlib
                p = Path(d) / (hashlib.sha1(f"{server.TTS_VOICE}|Halo dunia".encode()).hexdigest() + ".mp3")
                p.write_bytes(b"ID3x")
                self.assertEqual(server.tts_audio("  Halo   dunia "), b"ID3x")   # cache dipakai tanpa kunci
                self.assertEqual(server.tts_usage()["karakter"], 0)
            finally:
                server.TTS_DIR, server.tts_config = old_dir, old_cfg

    def test_catchup_plan(self):
        now = datetime(2026, 10, 23, 12, 0).timestamp()
        self.assertEqual(server.catchup_plan("2026-10-23T08:00:00.000Z", now)[0], 1)
        self.assertEqual(server.catchup_plan("2026-10-15T08:00:00.000Z", now), (server.CATCHUP_PAGES, "2026-10-15"))
        self.assertEqual(server.catchup_plan(None, now)[0], server.CATCHUP_PAGES)

    def test_sb_news_pages_stop_at_since(self):
        calls = []
        def fake(url, fresh=False):
            calls.append(url)
            n = len(calls)
            return {"data": {"stream": [{"stream_id": n, "title": f"Berita {n}", "created_at": f"2026-10-{24 - n * 3:02d} 10:00:00", "content": ""}],
                             "pagination": {"is_last_page": False, "next_cursor": 100 + n}}}
        old, server.stockbit_api = server.stockbit_api, fake
        try:
            out = server.get_sb_news({"url": "https://x/stream/v3/symbol/{ticker}?category=STREAM_CATEGORY_REPORTS&report_type=REPORT_TYPE_ALL&last_stream_id=0&limit=30"},
                                     "DOOH", pages=4, since="2026-10-16")
        finally:
            server.stockbit_api = old
        self.assertEqual(len(calls), 3)            # 21, 18, lalu 15 < 16: berhenti
        self.assertIn("last_stream_id=101", calls[1])
        self.assertTrue(all("STREAM_CATEGORY_NEWS" in c and "report_type" not in c for c in calls))
        self.assertEqual(len(out), 3)

    def test_sb_news_convert(self):
        res = {"data": {"stream": [{"stream_id": 9, "title": "DOOH Teken MoU AI Data Center", "created_at": datetime.now().strftime("%Y-%m-%d 10:00:00"),
                                    "content": "PT Era Media Sejahtera Tbk (DOOH) menandatangani tiga nota kesepahaman ...", "news_feed": {"label": "emitennews"}},
                                   {"stream_id": 8, "title": "Lama", "created_at": "2000-01-01 10:00:00", "content": ""}]}}
        out = server.convert_sb_news(res, "DOOH")
        self.assertEqual([x["id"] for x in out], ["sb-news-9"])
        self.assertEqual(out[0]["source"], "StockbitNews · emitennews")
        self.assertFalse(out[0]["summary"].endswith("..."))

    def test_title_signals(self):
        f = server.kandidat_sigs
        self.assertEqual(f("Keterbukaan Informasi Negosiasi Perubahan Pengendali"), ["akuisisi"])
        self.assertIn("kbli", f("RUPSLB Perubahan Kegiatan Usaha dan Nama Perseroan"))
        self.assertEqual(f("Rencana PMHMETD I"), ["rights"])
        self.assertEqual(f("Perubahan Susunan Anggota Direksi"), ["direksi"])
        self.assertEqual(f("Penghentian Sementara Perdagangan Efek"), ["uma"])
        self.assertEqual(f("Laporan Keuangan Interim"), [])


class HolderNameTest(unittest.TestCase):
    def test_urutan_kata_tertukar_digabung(self):
        rows = [{"ticker": "MEJA", "name": "TRIPLE BERKAH BERSAMA"}, {"ticker": "MEJA", "name": "TRIPLE BERKAH BERSAMA"},
                {"ticker": "MEJA", "name": "TRIPLE BERSAMA BERKAH"}, {"ticker": "MEJA", "name": "PT INTERRA DJAYA KARYA"}]
        server.canon_names(rows)
        self.assertEqual({r["name"] for r in rows}, {"TRIPLE BERKAH BERSAMA", "PT INTERRA DJAYA KARYA"})
        self.assertEqual(server.holder_key("PT Triple Bersama Berkah Tbk"), server.holder_key("TRIPLE BERKAH BERSAMA"))


class HscAnalisaTest(unittest.TestCase):
    def test_kontribusi_dan_kesimpulan(self):
        hs = json.loads((Path(server.__file__).parent / "hsc.json").read_text(encoding="utf-8"))["kode"]
        hg = {t: {"h": 100, "d": -2.0, "w": -4.0, "m": -10.0, "y": -20.0, "tgl": "2026-10-29"} for t in hs}
        hg.update({t: {"h": 5000, "d": 1.0, "w": 2.0, "m": 3.0, "y": 4.0, "tgl": "2026-10-29"} for t in ("BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM")})
        lama = (server.harga_semua, server.broker_data, server.LIVE.get("harga"))
        server.harga_semua, server.broker_data, server.LIVE["harga"] = (lambda: hg), (lambda: {}), {"harga": 5000.0}
        try:
            r = server.hsc_analisa()
        finally:
            server.harga_semua, server.broker_data, server.LIVE["harga"] = lama
        self.assertEqual(r["bank4"]["sens"], 13.7)                       # 27,45% x 5000 / 100
        self.assertEqual(r["bank4"]["ret"]["1W"], 2.0)
        bbca = next(x for x in r["penggerak"] if x["t"] == "BBCA")
        self.assertEqual(bbca["poin"]["w"], 9.0)                        # 9% x 2% x 5000
        self.assertEqual(r["keranjang"]["hsc"]["1M"]["median"], -10.0)
        self.assertTrue(any("sepekan" in k["teks"] for k in r["kesimpulan"]))


class HarianSimpanTest(unittest.TestCase):
    def test_simpan_tiap_hari_dan_hari_gagal_dilewati(self):
        import brokerpola as BP
        def fetch(p, f=False):
            if "from=2026-10-29" in p:
                raise RuntimeError("HTTP Error 401")
            return {"data": {"broker_activity_transaction": {"brokers_buy": [{"stock_code": "BBCA", "value": "1000", "lot": "1", "avg_price": "10"}], "brokers_sell": []}}}
        disimpan = []
        d = BP.build_harian(fetch, {}, {"AA": {}, "BB": {}}, ["2026-10-30", "2026-10-29", "2026-10-28"], set(), pause=0,
                            log=lambda m: None, simpan=lambda x: disimpan.append(sorted(x["hari"])))
        self.assertEqual(disimpan, [["2026-10-30"], ["2026-10-28", "2026-10-30"]])
        self.assertNotIn("2026-10-29", d["hari"])


class LiveTertahanTest(unittest.TestCase):
    def test_peringatan_token_ditolak(self):
        lama = (dict(server.SB_LIVE), server.token_exp)
        try:
            server.token_exp = lambda: time.time() + 3600
            server.SB_LIVE.update(ok=time.time() - 400, gagal=time.time() - 10, pesan="HTTP Error 401: Unauthorized")
            self.assertEqual(server.live_tertahan(True)["alasan"], "token Stockbit ditolak")
            self.assertIsNone(server.live_tertahan(False))
            server.SB_LIVE.update(ok=time.time(), gagal=0)
            self.assertIsNone(server.live_tertahan(True))
            server.token_exp = lambda: time.time() - 10
            self.assertEqual(server.live_tertahan(False)["alasan"], "token Stockbit kedaluwarsa")
        finally:
            server.SB_LIVE.clear(); server.SB_LIVE.update(lama[0]); server.token_exp = lama[1]


class HargaRadarTest(unittest.TestCase):
    def wib(self, *a):
        return datetime(*a, tzinfo=server.WIB)

    def test_jadwal(self):
        kamis_siang = self.wib(2026, 11, 5, 10, 0)
        self.assertTrue(server.harga_perlu(kamis_siang, None))
        self.assertFalse(server.harga_perlu(kamis_siang, kamis_siang.timestamp() - 600))
        self.assertTrue(server.harga_perlu(kamis_siang, kamis_siang.timestamp() - server.HARGA_GAP))
        # Sesudah tutup: sekali lagi bila terakhir diambil sebelum penutupan, lalu berhenti.
        kamis_malam = self.wib(2026, 11, 5, 19, 0)
        self.assertTrue(server.harga_perlu(kamis_malam, self.wib(2026, 11, 5, 16, 20).timestamp()))
        self.assertFalse(server.harga_perlu(kamis_malam, self.wib(2026, 11, 5, 16, 40).timestamp()))
        # Pagi sebelum buka dan akhir pekan: patokannya penutupan hari bursa terakhir.
        jumat_pagi = self.wib(2026, 11, 6, 7, 0)
        self.assertFalse(server.harga_perlu(jumat_pagi, self.wib(2026, 11, 5, 16, 40).timestamp()))
        self.assertTrue(server.harga_perlu(jumat_pagi, self.wib(2026, 11, 5, 15, 0).timestamp()))
        minggu = self.wib(2026, 11, 8, 12, 0)
        self.assertFalse(server.harga_perlu(minggu, self.wib(2026, 11, 6, 16, 45).timestamp()))
        self.assertTrue(server.harga_perlu(minggu, self.wib(2026, 11, 6, 14, 0).timestamp()))

    def test_gabung(self):
        it = {"ticker": "ULTJ", "name": "Ultra Jaya", "price": 2020, "mcap": 20000, "float": 30,
              "ctrlName": "PT X", "flags": {"akuisisi": True, "volume": True}, "notes": "catatan tim"}
        q = {"price": 2100.0, "pctChange": 1.45, "volume": 100.0, "avgVolume": 200.0, "uma": True, "name": "lain"}
        new = server.harga_gabung(it, q)
        self.assertEqual((new["price"], new["chgPct"], new["volRatio"]), (2100.0, 1.45, 0.5))
        self.assertEqual(new["flags"], {"akuisisi": True, "volume": True, "uma": True})  # volume tidak dimatikan
        self.assertEqual((new["name"], new["ctrlName"], new["notes"], new["mcap"]), ("Ultra Jaya", "PT X", "catatan tim", 20000))
        self.assertEqual(it["price"], 2020)  # input tidak dimutasi
        o = {"marketCap": 20.79e12, "freeFloat": 31.5, "controllerName": "PT Y"}
        new = server.harga_gabung(it, {"price": None}, o)
        self.assertEqual((new["price"], new["mcap"], new["float"], new["ctrlName"]), (2020, 20790.0, 31.5, "PT X"))

    def test_segarkan_baca_ulang(self):
        disimpan = []
        baris = [{"ticker": "ULTJ", "price": 2020, "notes": "lama"}]
        terbaru = {"ticker": "ULTJ", "price": 2020, "notes": "diubah tim"}
        with unittest.mock.patch.object(server, "items_all", return_value=baris), \
                unittest.mock.patch.object(server, "get_token", return_value=None), \
                unittest.mock.patch.object(server, "page_quote", return_value={"price": 2100.0}), \
                unittest.mock.patch.object(server, "data_rows", return_value=[(json.dumps(terbaru),)]), \
                unittest.mock.patch.object(server, "item_put", side_effect=disimpan.append):
            self.assertEqual(server.segarkan_harga(delay=0), 1)
        self.assertEqual((disimpan[0]["price"], disimpan[0]["notes"]), (2100.0, "diubah tim"))
        self.assertIn("updatedAt", disimpan[0])


class SinkronTest(unittest.TestCase):
    """Sinkron dua arah antarserver (sinkron.py + endpoint /api/sinkron/*)."""

    def test_berkas_dan_rencana(self):
        import sinkron
        self.assertTrue(sinkron.berkas_sah(".harmonik.json"))
        self.assertTrue(sinkron.berkas_sah(".pov-dalam/INDS.json"))
        for buruk in (".stockbit-token", ".sinkron-kunci", "../x.json", ".pov-dalam/../a.json", ".radar.sqlite", ".cache.sqlite", "server.py"):
            self.assertFalse(sinkron.berkas_sah(buruk), buruk)
        lokal = {".harmonik.json": [100, 1], ".pov.json": [500, 1], ".pov-dalam/AAAA.json": [300, 1]}
        remote = {".harmonik.json": [200, 1], ".pov.json": [501, 1], ".pov-dalam/BBBB.json": [50, 1], ".stockbit-token": [999, 1]}
        self.assertEqual(sinkron.rencana(lokal, remote), ([".harmonik.json", ".pov-dalam/BBBB.json"], [".pov-dalam/AAAA.json"]))

    def test_gabung_data_tim(self):
        import sinkron
        it = lambda t, catatan, at=1: {"ticker": t, "data": {"ticker": t, "notes": catatan}, "updated_at": at}
        lokal = {"items": [it("AAAA", "lama"), it("BBBB", "harga otomatis", 900), it("CCCC", "sini"), it("DDDD", "akan dihapus")],
                 "jejak": [{"tabel": "items", "kunci": "AAAA", "at": 10, "hapus": 0}],
                 "updates": [{"id": "u1", "updatedAt": "2026-11-01"}], "layout": {}, "hidden": {"EEEE": 5}, "snapshots": []}
        remote = {"items": [it("AAAA", "disunting tim"), it("BBBB", "versi peer"), it("FFFF", "baru di peer")],
                  "jejak": [{"tabel": "items", "kunci": "AAAA", "at": 20, "hapus": 0},
                            {"tabel": "items", "kunci": "DDDD", "at": 30, "hapus": 1},
                            {"tabel": "hidden", "kunci": "EEEE", "at": 40, "hapus": 1}],
                  "updates": [{"id": "u1", "updatedAt": "2026-11-05"}, {"id": "u2", "updatedAt": "2026-11-05"}],
                  "layout": {"AAAA": {"x": 1}}, "hidden": {}, "snapshots": [{"day": "2026-11-05", "ticker": "AAAA", "taken_at": 1, "data": "{}"}]}
        ops = sinkron.gabung(lokal, remote)
        jenis = [(o[0], o[1] if isinstance(o[1], str) else o[1].get("id", o[1].get("ticker"))) for o in ops]
        self.assertIn(("item", "AAAA"), jenis)          # suntingan peer lebih baru
        self.assertIn(("item_hapus", "DDDD"), jenis)    # dihapus di peer
        self.assertIn(("hidden_hapus", "EEEE"), jenis)
        self.assertIn(("item", "FFFF"), jenis)          # item baru ditambahkan
        self.assertNotIn(("item", "BBBB"), jenis)       # tanpa jejak: pembaruan harga otomatis tidak saling menimpa
        self.assertNotIn(("item_hapus", "CCCC"), jenis)
        self.assertIn(("update", "u1"), jenis)          # berita peer lebih baru
        self.assertIn(("update", "u2"), jenis)
        self.assertIn(("layout", "AAAA"), jenis)
        self.assertIn(("snapshot", "AAAA"), jenis)
        # Sinkron pertama (awal=True): data lama yang berbeda mengikuti peer.
        self.assertIn(("item", "BBBB"), [(o[0], o[1]) for o in sinkron.gabung(lokal, remote, awal=True) if isinstance(o[1], str)])
        # Arah sebaliknya: jejak sini (AAAA at 10) lebih lama dari peer, jadi peer tidak menerima versi lama.
        self.assertNotIn(("item", "AAAA"), [(o[0], o[1]) for o in sinkron.gabung(remote, lokal) if isinstance(o[1], str)])
        self.assertEqual(sinkron.arah_token(1000, 5000), "tarik")
        self.assertEqual(sinkron.arah_token(5000, 1000), "kirim")
        self.assertEqual(sinkron.arah_token(1000, 1030), "")

    def test_endpoint_dijaga_kunci(self):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        root = Path(tmp.name)
        (root / ".sinkron-kunci").write_text("kunci-rahasia-uji-123456")
        (root / ".harmonik.json").write_text("{}")
        srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_address[1]}"

        def get(path, kunci=None, publik=False, body=None):
            req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(),
                                         method="GET" if body is None else "POST", headers={"Content-Type": "application/json"})
            if kunci:
                req.add_header("X-Sinkron-Kunci", kunci)
            if publik:
                req.add_header("Cf-Connecting-Ip", "203.0.113.9")
            try:
                with urllib.request.urlopen(req) as r:
                    return r.status, json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                return e.code, None
        try:
            with unittest.mock.patch.object(server, "ROOT", root), \
                    unittest.mock.patch.object(server, "SINKRON_KUNCI_PATH", root / ".sinkron-kunci"), \
                    unittest.mock.patch.object(server, "TOKEN_PATH", root / ".stockbit-token"):
                self.assertEqual(get("/api/sinkron/manifest")[0], 403)                                   # tanpa kunci
                self.assertEqual(get("/api/sinkron/manifest", "salah-kunci-xxxxxxxx")[0], 403)
                self.assertEqual(get("/api/sinkron/manifest", "kunci-rahasia-uji-123456", publik=True)[0], 404)   # domain publik
                st, m = get("/api/sinkron/manifest", "kunci-rahasia-uji-123456")
                self.assertEqual((st, list(m["berkas"])), (200, [".harmonik.json"]))
                self.assertEqual(get("/api/sinkron/berkas?p=.stockbit-token", "kunci-rahasia-uji-123456")[1], {"error": "Tidak ditemukan."})
                # Kiriman berkas dengan mtime peer; berkas di luar daftar putih ditolak.
                import base64 as b64
                st, r = get("/api/sinkron/berkas", "kunci-rahasia-uji-123456", body={"p": ".pov-dalam/ZZZZ.json", "mtime": 1790000000,
                                                                                     "b64": b64.b64encode(b"{\"a\": 1}").decode()})
                self.assertEqual(st, 200)
                self.assertEqual(int((root / ".pov-dalam" / "ZZZZ.json").stat().st_mtime), 1790000000)
                self.assertEqual(get("/api/sinkron/berkas", "kunci-rahasia-uji-123456", body={"p": ".stockbit-token", "mtime": 1, "b64": ""})[0], 400)
                self.assertEqual(get("/api/sinkron/berkas", "kunci-rahasia-uji-123456", publik=True, body={"p": ".pov.json", "mtime": 1, "b64": ""})[0], 403)
        finally:
            srv.shutdown()
            srv.server_close()
            tmp.cleanup()


class TokenUiTest(unittest.TestCase):
    """Isi token dari UI (POST /api/token) dan watcher bawaan (token_perbarui) tanpa memanggil Stockbit sungguhan."""

    @staticmethod
    def jwt(**klaim):
        import base64 as b64
        enc = lambda d: b64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
        return f"{enc({'alg': 'HS256', 'typ': 'JWT'})}.{enc(klaim)}.tandatanganuji123"

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.root = Path(self.tmp.name)
        self.patch = [unittest.mock.patch.object(server, "ROOT", self.root),
                      unittest.mock.patch.object(server, "TOKEN_PATH", self.root / ".stockbit-token"),
                      unittest.mock.patch.object(server, "_wmod", None),
                      unittest.mock.patch.object(server, "data_susulan", return_value=False)]
        for x in self.patch:
            x.start()
        self.addCleanup(self.tmp.cleanup)

    def tearDown(self):
        for x in self.patch:
            x.stop()

    def test_token_bersih(self):
        t = self.jwt(exp=int(time.time()) + 3600)
        self.assertEqual(server.token_bersih("Bearer " + t), t)
        self.assertIsNone(server.token_bersih("bukan token"))
        self.assertIsNone(server.token_bersih(self.jwt(sub="x")))              # token akses wajib punya exp
        self.assertIsNotNone(server.token_bersih(self.jwt(sub="x"), butuh_exp=False))

    def test_endpoint_simpan_token(self):
        srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_address[1]}"

        def post(body, publik=False):
            req = urllib.request.Request(base + "/api/token", data=json.dumps(body).encode(), method="POST",
                                         headers={"Content-Type": "application/json"})
            if publik:
                req.add_header("Cf-Connecting-Ip", "203.0.113.9")
            try:
                with urllib.request.urlopen(req) as r:
                    return r.status, json.loads(r.read())
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read() or b"null")
        try:
            baru = self.jwt(exp=int(time.time()) + 86400)
            self.assertEqual(post({"token": baru}, publik=True)[0], 403)        # domain publik tetap hanya baca
            self.assertFalse((self.root / ".stockbit-token").exists())
            self.assertEqual(post({"token": self.jwt(exp=int(time.time()) - 10)})[0], 400)
            self.assertEqual(post({"token": "acak"})[0], 400)
            self.assertEqual(post({})[0], 400)
            st, r = post({"token": "Bearer " + baru})
            self.assertEqual((st, r["token"]), (200, True))
            self.assertEqual(server.read_token(self.root / ".stockbit-token"), baru)
            self.assertNotIn(baru, json.dumps(r))                              # token tidak pernah dikembalikan
        finally:
            srv.shutdown()
            srv.server_close()

    def test_perbarui_lewat_refresh(self):
        lama = self.jwt(exp=int(time.time()) + 600)                           # sisa 10 menit: perlu diperpanjang
        (self.root / ".stockbit-token").write_text(lama + "\n")
        akses, ref2 = self.jwt(exp=int(time.time()) + 86400), self.jwt(exp=int(time.time()) + 30 * 86400)
        self.assertIsNone(server.token_perbarui()["ok"])                       # belum ada refresh token
        (self.root / ".stockbit-refresh").write_text(self.jwt(exp=int(time.time()) + 86400) + "\n")
        respons = json.dumps({"data": {"access": {"token": akses}, "refresh": {"token": ref2}}}).encode()
        wm = Path(server.__file__).resolve().parent.parent / "stockbit-token-watcher.py"
        with unittest.mock.patch.object(server, "refresh_post", return_value=respons) as rp, \
                unittest.mock.patch.object(server, "token_uji", return_value=True):
            # Parser respons ada di stockbit-token-watcher.py repo, bukan di folder uji.
            import importlib.util
            spec = importlib.util.spec_from_file_location("wm_uji", wm)
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            with unittest.mock.patch.object(server, "_wmod", m):
                st = server.token_perbarui()
                self.assertTrue(st["ok"], st["pesan"])
                self.assertEqual(rp.call_count, 1)
                self.assertEqual(server.read_token(self.root / ".stockbit-token"), akses)
                self.assertEqual(server.read_token(self.root / ".stockbit-refresh"), ref2)
                # Token baru masih lama berlaku: tidak memanggil Stockbit lagi.
                self.assertTrue(server.token_perbarui()["ok"])
                self.assertEqual(rp.call_count, 1)

    def test_token_baru_ditolak_token_lama_dipertahankan(self):
        lama = self.jwt(exp=int(time.time()) + 600)
        (self.root / ".stockbit-token").write_text(lama + "\n")
        (self.root / ".stockbit-refresh").write_text(self.jwt(exp=int(time.time()) + 86400) + "\n")
        akses, ref2 = self.jwt(exp=int(time.time()) + 86400), self.jwt(exp=int(time.time()) + 30 * 86400)
        respons = json.dumps({"data": {"access": {"token": akses}, "refresh": {"token": ref2}}}).encode()
        import importlib.util
        spec = importlib.util.spec_from_file_location("wm_uji2", Path(server.__file__).resolve().parent.parent / "stockbit-token-watcher.py")
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        with unittest.mock.patch.object(server, "refresh_post", return_value=respons), \
                unittest.mock.patch.object(server, "_wmod", m), \
                unittest.mock.patch.object(server, "token_uji", return_value=False):
            st = server.token_perbarui()
        self.assertIs(st["ok"], False)
        self.assertIn("incognito", st["pesan"])
        self.assertEqual(server.read_token(self.root / ".stockbit-token"), lama)      # token lama tetap dipakai
        self.assertEqual(server.read_token(self.root / ".stockbit-refresh"), ref2)    # refresh baru tetap disimpan

    def test_token_uji(self):
        galat = lambda kode: urllib.error.HTTPError(server.SB, kode, "x", {}, None)
        with unittest.mock.patch.object(server, "http_get_api", return_value="{}"):
            self.assertTrue(server.token_uji("t"))
        with unittest.mock.patch.object(server, "http_get_api", side_effect=galat(401)):
            self.assertFalse(server.token_uji("t"))
        with unittest.mock.patch.object(server, "http_get_api", side_effect=galat(500)):
            self.assertTrue(server.token_uji("t"))                                   # gangguan server: jangan buang token
        with unittest.mock.patch.object(server, "http_get_api", side_effect=OSError("putus")):
            self.assertTrue(server.token_uji("t"))

    def test_simpan_keduanya_tidak_memaksa_refresh(self):
        baru = self.jwt(exp=int(time.time()) + 86400)
        with unittest.mock.patch.object(server, "refresh_post") as rp:
            code, res = server.token_simpan({"token": baru, "refresh": self.jwt(exp=int(time.time()) + 86400)})
        self.assertEqual(code, 200)
        rp.assert_not_called()                                                         # token masih lama: refresh menunggu
        self.assertEqual(server.read_token(self.root / ".stockbit-token"), baru)

    def test_refresh_ditolak(self):
        (self.root / ".stockbit-refresh").write_text(self.jwt(exp=int(time.time()) + 86400) + "\n")
        galat = urllib.error.HTTPError(server.REFRESH_URL, 401, "Unauthorized", {}, None)
        with unittest.mock.patch.object(server, "refresh_post", side_effect=galat):
            st = server.token_perbarui(paksa=True)
        self.assertIs(st["ok"], False)
        self.assertIn("401", st["pesan"])


class SusulanDataTest(unittest.TestCase):
    """Data harian yang dibangun saat token mati (harga tertahan) dibangun ulang begitu token berlaku lagi."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / ".recovery.json"
        p = unittest.mock.patch.object(server, "RECOVERY_PATH", self.path)
        p.start()
        self.addCleanup(p.stop)

    def tulis(self, *tanggal):
        self.path.write_text(json.dumps({"tek": {f"K{i:03d}": {"tanggal": t} for i, t in enumerate(tanggal)}}))

    def test_hari_bursa_mundur(self):
        from datetime import date
        self.assertEqual(server.hari_bursa_mundur(date(2026, 11, 26), 2), date(2026, 11, 24))   # Kamis -> Selasa
        self.assertEqual(server.hari_bursa_mundur(date(2026, 11, 23), 2), date(2026, 11, 19))   # Senin -> Kamis

    def test_data_tertinggal(self):
        from datetime import datetime, timezone
        kamis = datetime(2026, 11, 26, 5, 0, tzinfo=timezone.utc)                                  # 12.00 WIB
        self.assertFalse(server.data_tertinggal(kamis))                                         # belum ada data
        self.tulis("2026-11-20", "2026-11-19")
        self.assertTrue(server.data_tertinggal(kamis))                                          # tertahan sejak Jumat
        self.tulis("2026-11-20", "2026-11-25")
        self.assertFalse(server.data_tertinggal(kamis))                                         # normal: candle kemarin
        self.tulis("2026-11-20")
        senin = datetime(2026, 11, 23, 1, 0, tzinfo=timezone.utc)
        self.assertFalse(server.data_tertinggal(senin))                                         # akhir pekan bukan tertinggal

    def test_susulan_sekali_lalu_jeda(self):
        self.tulis("2020-01-02")
        with unittest.mock.patch.object(server, "get_token", return_value="t"), \
                unittest.mock.patch.object(server, "token_expired", return_value=False), \
                unittest.mock.patch.object(server, "_susulan_at", 0.0), \
                unittest.mock.patch.object(server, "daily_builds") as db:
            self.assertTrue(server.data_susulan("uji"))
            self.assertFalse(server.data_susulan("uji"))                                        # masih dalam jeda 6 jam
            self.assertTrue(server.data_susulan("uji", paksa=True))                             # token baru dari UI
            for th in [t for t in threading.enumerate() if t.name == "susulan"]:
                th.join(5)
            self.assertEqual(db.call_count, 2)
        with unittest.mock.patch.object(server, "get_token", return_value="t"), \
                unittest.mock.patch.object(server, "token_expired", return_value=True):
            self.assertFalse(server.data_susulan("uji", paksa=True))                            # token mati: jangan bangun


class LanjutanHarianTest(unittest.TestCase):
    """Harmonic/Rekomendasi/audit yang terputus setelah Recovery selesai dilanjutkan, tanpa dobel saat rangkaian jalan."""

    def test_lanjutan(self):
        import os
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            root = Path(d)
            p = {n: root / n for n in (".recovery.json", ".harmonik.json", ".rekomendasi.json", ".audit-monitor.json")}
            for f in p.values():
                f.write_text("{}")
            sekarang = time.time()
            os.utime(p[".recovery.json"], (sekarang, sekarang))
            lama = sekarang - 12 * 3600
            for n in (".harmonik.json", ".rekomendasi.json"):
                os.utime(p[n], (lama, lama))
            dipanggil = []
            with unittest.mock.patch.multiple(server, RECOVERY_PATH=p[".recovery.json"], HARMONIK_PATH=p[".harmonik.json"],
                                              REKO_PATH=p[".rekomendasi.json"], AUDIT_PATH=p[".audit-monitor.json"],
                                              harmonik_build=lambda: dipanggil.append("h"),
                                              rekomendasi_build=lambda: dipanggil.append("r"),
                                              audit_monitor_build=lambda: dipanggil.append("a"),
                                              get_token=lambda: "t", token_expired=lambda: False, _susulan_at=0.0):
                self.assertEqual(len(server.lanjutan_tertunda()), 2)                            # audit masih segar
                with server._harian_lock:
                    self.assertFalse(server.data_lanjutan("uji"))                               # rangkaian sedang jalan
                self.assertTrue(server.data_lanjutan("uji"))
                for th in [t for t in threading.enumerate() if t.name == "susulan"]:
                    th.join(5)
                self.assertEqual(dipanggil, ["h", "r"])
                self.assertFalse(server.data_lanjutan("uji"))                                   # jeda 6 jam


class Saham50SusulanTest(unittest.TestCase):
    """Saham 50 yang tertinggal (jadwal sore terlewat saat token mati) disusun tanpa menunggu pukul 17.00."""

    def test_s50_tertinggal(self):
        import os
        from datetime import datetime, timezone
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            f = Path(d) / ".saham50.json"
            with unittest.mock.patch.object(server, "S50_PATH", f):
                kamis = datetime(2026, 11, 26, 5, 0, tzinfo=timezone.utc)                       # Kamis 12.00 WIB
                self.assertFalse(server.s50_tertinggal(kamis))                                  # belum ada berkas
                f.write_text("{}")
                jumat = datetime(2026, 11, 21, 10, 29, tzinfo=timezone.utc).timestamp()         # Sabtu 21 Nov 17.29 WIB
                os.utime(f, (jumat, jumat))
                self.assertTrue(server.s50_tertinggal(kamis))
                rabu = datetime(2026, 11, 25, 10, 5, tzinfo=timezone.utc).timestamp()           # Rabu 17.05 WIB
                os.utime(f, (rabu, rabu))
                self.assertFalse(server.s50_tertinggal(kamis))                                  # normal: dibuat kemarin sore


class WatcherSymlinkTest(unittest.TestCase):
    """stockbit-token-watcher.py menulis ke berkas tujuan symlink, bukan mengganti symlink-nya."""

    def test_write_secret_mengikuti_symlink(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("wm_symlink", Path(server.__file__).resolve().parent.parent / "stockbit-token-watcher.py")
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as d:
            root = Path(d)
            asli, tautan = root / "asli-token", root / ".stockbit-token"
            asli.write_text("lama\n")
            try:
                tautan.symlink_to(asli)
            except OSError:
                self.skipTest("membuat symlink butuh hak khusus di sistem ini")
            m.write_secret(tautan, "baru")
            self.assertTrue(tautan.is_symlink())
            self.assertEqual(asli.read_text(), "baru\n")
            m.write_secret(root / ".stockbit-refresh", "ref")           # berkas biasa tetap ditulis seperti dulu
            self.assertEqual((root / ".stockbit-refresh").read_text(), "ref\n")


class HarmonikTest(unittest.TestCase):
    """Screening Harmonic Pattern: Gartley bullish sintetis X 100, A 200, B 138,2 (0,618), C 175,3, D 121,4 (0,786)."""

    @staticmethod
    def bars(titik, ekor=(), vol=1e5, n=10):
        cl = [a + (b - a) * k / n for a, b in zip(titik, titik[1:]) for k in range(n)] + [titik[-1], *ekor]
        return [{"d": f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", "o": c, "h": c * 1.004, "l": c * 0.996, "c": c, "v": vol}
                for i, c in enumerate(cl)]

    def test_zigzag_outside_bar(self):
        """Pivot tertembus langsung mengonfirmasi pivot sementara; outside bar tidak menyelipkan lembah di antara pivot
        (contoh AKRA 4-9 Nov 2026). Hasilnya sama dengan zigzag di harmonikAlat.js."""
        import harmonik
        b = lambda o, h, l, c: {"d": "x", "o": o, "h": h, "l": l, "c": c, "v": 1000}
        akra = [b(1450, 1475, 1440, 1460), b(1460, 1460, 1380, 1390), b(1390, 1395, 1300, 1310), b(1310, 1350, 1280, 1300),
                b(1300, 1365, 1305, 1340), b(1340, 1370, 1275, 1360), b(1360, 1370, 1320, 1330), b(1330, 1335, 1240, 1250)]
        for th in (0.04, 0.06):
            pv = harmonik.zigzag(akra, th)
            for a, t, c in zip(pv, pv[1:], pv[2:]):
                antara = akra[a["i"] + 1:c["i"]]
                self.assertEqual(t["p"], min(x["l"] for x in antara) if t["k"] == "L" else max(x["h"] for x in antara))
        self.assertTrue(any(p["k"] == "L" and p["p"] == 1275 for p in harmonik.zigzag(akra, 0.04)))

    def test_jarak_kaki_dan_swing(self):
        """Catatan swing sama dengan harmonikAlat.js: BBCA Shark 20 Nov 2026 (kaki 5/10/45/32) timpang, kaki < 3 candle
        timpang; swing = puncak/dasar tidak dilewati 2 candle kiri-kanan, ayunan < 5% dicatat."""
        import harmonik
        self.assertEqual(harmonik.jarak_kaki([5, 10, 45, 32]), "timpang")
        self.assertEqual(harmonik.jarak_kaki([2, 10, 10]), "timpang")
        self.assertEqual(harmonik.jarak_kaki([4, 16, 16]), "kurang")
        self.assertEqual(harmonik.jarak_kaki([8, 6, 8, 8]), "seimbang")
        self.assertIsNone(harmonik.jarak_kaki([5]))
        b = lambda h, l: {"d": "x", "o": l, "h": h, "l": l, "c": h, "v": 1}
        bars = [b(105, 100), b(103, 97), b(100, 94), b(98, 90), b(99, 93), b(102, 95), b(106, 99), b(108, 102),
                b(110, 104), b(109, 103), b(107, 100), b(104, 97)]
        self.assertEqual(harmonik.swing_lemah(bars, [{"n": "A", "i": 3, "p": 90}, {"n": "B", "i": 8, "p": 110}]), [])
        self.assertIn("Titik A bukan swing low",
                      harmonik.swing_lemah(bars, [{"n": "A", "i": 4, "p": 93}, {"n": "B", "i": 8, "p": 110}])[0])
        self.assertTrue(any("Ayunan A→B hanya 3,3%" in t for t in
                            harmonik.swing_lemah(bars, [{"n": "A", "i": 3, "p": 90}, {"n": "B", "i": 5, "p": 93}])))
        naik = bars[:10] + [b(112, 106)]
        self.assertEqual([t for t in harmonik.swing_lemah(naik, [{"n": "A", "i": 3, "p": 90}, {"n": "B", "i": 10, "p": 112}])
                          if "Titik B" in t], [])

    def test_skala_besar_saham_lebar(self):
        """Skala rapat 4–50% setiap 0,5% sama dengan SKALA_POLA.D di harmonikAlat.js. Meniru KOTA 2026: Shark
        71-210-140-252-50 dengan pantulan 81 → 104 (naik 28%) di kaki C→D hanya terbaca di sekitar 30%."""
        import harmonik
        self.assertEqual((len(harmonik.SKALA), harmonik.SKALA[0], harmonik.SKALA[1], harmonik.SKALA[-1]), (93, 0.04, 0.045, 0.5))
        kota = self.bars([120, 71, 210, 140, 252, 81, 104, 50, 75])
        self.assertFalse(any(r["pola"] == "shark" for r in harmonik.cari(kota, skala=(0.04, 0.06, 0.10, 0.15), min_nilai=0)))
        s = next(r for r in harmonik.cari(kota, min_nilai=0) if r["pola"] == "shark")
        self.assertEqual(s["arah"], "bullish")
        self.assertGreater(s["skala"], 0.28)
        for t, v in zip(s["titik"], (71, 210, 140, 252, 50)):   # high/low sintetis ±0,4%, dibulatkan ke fraksi harga
            self.assertAlmostEqual(t["p"], v, delta=v * 0.01)

    def test_baris_membawa_catatan_swing(self):
        """Baris screening membawa kaki (candle per kaki) dan swingLemah; pola "menuju" tanpa titik D."""
        import harmonik
        hasil = harmonik.cari(self.bars([100, 200, 138.2, 175.3, 121.4], ekor=(124, 126)), min_nilai=0)
        self.assertTrue(hasil)
        for r in hasil:
            self.assertEqual(len(r["kaki"]), len(r["titik"]) - 1)
            self.assertIsInstance(r["swingLemah"], list)

    def test_rasio_kaki_nol(self):
        """C tepat di harga X (saham SICO): rasio CD/XC tidak terdefinisi, bukan error pembagian nol."""
        import harmonik
        r = harmonik.rasio(100, 120, 110, 100, 105)
        self.assertIsNone(r["dxc"])
        self.assertEqual(r["b"], 0.5)

    def test_d_basi_dibuang(self):
        """Titik akhir terkonfirmasi yang sudah dilewati ekstrem searah sesudahnya tidak lagi dipakai."""
        import harmonik
        pv = [{"i": 0, "p": 100, "k": "L"}, {"i": 5, "p": 120, "k": "H"}, {"i": 9, "p": 95, "k": "L"}]
        self.assertTrue(harmonik._basi(pv, {"i": 1, "p": 100, "k": "L"}, 2))
        self.assertFalse(harmonik._basi(pv, {"i": 1, "p": 90, "k": "L"}, 2))

    def test_gartley_di_prz(self):
        import harmonik
        r = harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4]))
        g = next(x for x in r if x["pola"] == "gartley")
        self.assertEqual((g["arah"], g["status"]), ("bullish", "prz"))
        self.assertTrue(g["prz"][0] <= 121.4 <= g["prz"][1])
        self.assertEqual([x["n"] for x in g["titik"]], list("XABCD"))
        self.assertEqual(g["stop"], 100)                                      # sedikit di balik X
        self.assertTrue(121.4 < g["target"][0] < g["target"][1] < 200)        # 0,382 lalu 0,618 kaki AD
        self.assertEqual(g["targetCA"], [176, 201])                          # titik C lalu A

    def test_abcd_di_dalam_pola(self):
        """AB=CD (Carney: syarat minimum) dicek: CD 0,87 AB lolos, CD 0,65 AB ditandai belum terpenuhi dan turun peringkat."""
        import harmonik
        g = next(x for x in harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4])) if x["pola"] == "gartley")
        self.assertTrue(g["abcd"]["ok"])
        self.assertEqual(g["abcd"]["kriteria"], [1.0, 1.27])
        # C dangkal (0,382 AB): CD hanya 40,4 dibanding AB 61,8.
        h = next(x for x in harmonik.cari(self.bars([150, 100, 200, 138.2, 161.8, 121.4])) if x["pola"] == "gartley")
        self.assertFalse(h["abcd"]["ok"])
        self.assertTrue(any("belum terpenuhi" in a for a in h["alasan"]))
        self.assertGreater(h["skor"], g["skor"])

    def test_menuju_dan_tidak_likuid(self):
        import harmonik
        r = harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 135]))
        g = next(x for x in r if x["pola"] == "gartley")
        self.assertEqual(g["status"], "menuju")
        self.assertGreater(g["jarak"], 0)
        # Nilai transaksi rata-rata < Rp1 miliar: tidak disaring.
        self.assertEqual(harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4], vol=10)), [])
        # D menembus X: bukan Gartley lagi.
        self.assertFalse([x for x in harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 95])) if x["pola"] == "gartley"])

    def test_pola_tambahan(self):
        import harmonik
        # 5-0 bullish: X 150, A 200, B 130 (1,4 XA), C 263 (1,9 AB), D 196,5 (0,50 BC).
        r = next(x for x in harmonik.cari(self.bars([180, 150, 200, 130, 263, 196.5])) if x["pola"] == "fiveo")
        self.assertEqual((r["arah"], r["status"]), ("bullish", "prz"))
        self.assertAlmostEqual(r["rasio"]["dbc"], 0.5, delta=0.02)          # bar uji punya ekor ±0,4%
        c_ = r["titik"][3]["p"]                                     # target 2 = titik C, dibulatkan ke bawah ke fraksi 2
        self.assertTrue(c_ - 2 < r["target"][1] <= c_)
        # AB=CD bullish: A 200, B 150, C 180,9 (0,618 AB), D 130,9 (CD = AB).
        c = 150 + 0.618 * 50
        r = next(x for x in harmonik.cari(self.bars([170, 200, 150, c, c - 50])) if x["pola"] == "abcd")
        self.assertEqual((r["arah"], r["status"], [t["n"] for t in r["titik"]]), ("bullish", "prz", list("ABCD")))
        self.assertTrue(any(a.startswith("CD/AB 0,99") and "kriteria 1)" in a for a in r["alasan"]))
        # Three Drives bearish: dorongan naik 1,27 kali koreksi.
        P = [110, 100, 150, 150 - 0.618 * 50]
        P += [P[3] + 1.27 * (150 - P[3])]
        P += [P[4] - 0.618 * (P[4] - P[3])]
        P += [P[5] + 1.27 * (P[4] - P[5])]
        r = next(x for x in harmonik.cari(self.bars(P)) if x["pola"] == "tigadorongan")
        self.assertEqual((r["arah"], r["status"]), ("bearish", "prz"))
        self.assertEqual([t["n"] for t in r["titik"]], ["0", "1", "A", "2", "B", "3"])
        self.assertGreater(r["stop"], r["titik"][-1]["p"])

    def test_rapikan_abcd_dan_tiga_dorongan(self):
        import harmonik
        c = 150 + 0.618 * 50
        # AB=CD belum sampai PRZ: tidak ditampilkan.
        self.assertFalse([x for x in harmonik.cari(self.bars([170, 200, 150, c, c - 25])) if x["pola"] in ("abcd", "altabcd")])
        # Three Drives di level 1,618: PRZ sempit (±3% kaki koreksi B) dan alasan menyebut level itu.
        P = [110, 100, 150, 150 - 0.618 * 50]
        P += [P[3] + 1.27 * (150 - P[3])]
        P += [P[4] - 0.618 * (P[4] - P[3])]
        P += [P[5] + 1.618 * (P[4] - P[5])]
        r = next(x for x in harmonik.cari(self.bars(P)) if x["pola"] == "tigadorongan")
        self.assertLess(r["prz"][1] - r["prz"][0], 0.07 * (P[4] - P[5]) + 1)
        self.assertTrue(r["alasan"][-1].endswith("(kriteria 1,618)"))

    def test_pola_batal(self):
        import harmonik
        # Gartley lengkap lalu harga turun menembus X (stop): tidak tampil lagi.
        r = harmonik.cari(self.bars([150, 100, 200, 138.2, 175.3, 121.4, 130, 90]))
        self.assertFalse([x for x in r if x["pola"] == "gartley" and x["titik"][0]["p"] == 100])

    def test_screening_memindai_semua_kode_bei(self):
        """Screening memindai universe Recovery ditambah semua kode BEI (KOTA di luar Seasonality tetap dipindai);
        ringkasan momentum Rekomendasi tetap hanya untuk universe Recovery."""
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        jalur, dipanggil = Path(tmp.name) / ".harmonik.json", []
        kota = self.bars([120, 71, 210, 140, 252, 81, 104, 50, 75], vol=1e9)
        def ohlc(t, tf):
            dipanggil.append(t)
            if t == "BBBB":
                raise RuntimeError("HTTP 401 Unauthorized")             # kode tambahan tanpa cache: dilewati
            return kota if t == "KOTA" else self.bars([100, 120, 110], vol=1e9)
        with unittest.mock.patch.object(server, "HARMONIK_PATH", jalur),                 unittest.mock.patch.object(server, "recovery_universe", lambda: ["AAAA"]),                 unittest.mock.patch.object(server, "bei_kode_load", lambda: {"KOTA": "2026-11-20", "AAAA": "2026-11-20", "BBBB": "", "X1": ""}),                 unittest.mock.patch.object(server, "get_ohlc", ohlc),                 unittest.mock.patch.object(server.RK, "momentum", lambda bb: {"m": 1}),                 unittest.mock.patch.object(server.RK, "resistensi", lambda bb: None):
            server.harmonik_build(delay=0)
            d = json.loads(jalur.read_text(encoding="utf-8"))
        self.assertEqual(dipanggil, ["AAAA", "BBBB", "KOTA"])               # kode bukan 4 huruf dilewati
        self.assertEqual(d["dinilai"], 2)
        self.assertTrue(any(r["t"] == "KOTA" and r["pola"] == "shark" for r in d["rows"]))
        self.assertEqual(list(d["momentum"]), ["AAAA"])

    def test_pindai_ulang_bila_aturan_berubah(self):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        jalur = Path(tmp.name) / ".harmonik.json"
        with unittest.mock.patch.object(server, "HARMONIK_PATH", jalur):
            self.assertFalse(server.harmonik_usang())                       # belum ada hasil: dibangun oleh loop awal
            jalur.write_text(json.dumps({"updated": "x", "rows": []}), encoding="utf-8")
            self.assertTrue(server.harmonik_usang())                        # hasil lama tanpa versi
            jalur.write_text(json.dumps({"versi": server.HM.VERSI_ATURAN, "rows": []}), encoding="utf-8")
            self.assertTrue(server.harmonik_usang())                        # belum ada ringkasan momentum Rekomendasi
            jalur.write_text(json.dumps({"versi": server.HM.VERSI_ATURAN, "versiMomentum": server.RK.VERSI, "rows": []}), encoding="utf-8")
            self.assertFalse(server.harmonik_usang())
        tmp.cleanup()

    def test_candle_balik(self):
        import harmonik
        pin = [{"o": 10, "h": 10.2, "l": 9.8, "c": 9.9}, {"o": 10, "h": 10.1, "l": 9.0, "c": 10.05}]
        self.assertEqual(harmonik.candle_balik(pin, 1, True), "pin bar")
        eng = [{"o": 10, "h": 10.1, "l": 9.4, "c": 9.5}, {"o": 9.45, "h": 10.3, "l": 9.4, "c": 10.2}]
        self.assertEqual(harmonik.candle_balik(eng, 1, True), "bullish engulfing")
        self.assertEqual(harmonik.candle_balik(eng, 1, False), "")

    def test_api_urut_dan_nama(self):
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        f = Path(tmp.name) / ".harmonik.json"
        f.write_text(json.dumps({"updated": "2026-11-05 00:40", "dinilai": 2, "rows": [
            {"t": "BBBB", "status": "menuju", "jarak": 4.0}, {"t": "AAAA", "status": "prz", "jarak": 0}]}))
        with unittest.mock.patch.object(server, "HARMONIK_PATH", f), \
                unittest.mock.patch.object(server, "nama_semua", return_value={"AAAA": "Aaaa Tbk"}), \
                unittest.mock.patch.object(server, "radar_tickers", return_value={"BBBB"}):
            r = server.harmonik_api()
        tmp.cleanup()
        self.assertEqual([(x["t"], x["nama"], x["radar"]) for x in r["rows"]], [("AAAA", "Aaaa Tbk", False), ("BBBB", "", True)])
        self.assertEqual({p["k"] for p in r["pola"]}, {"gartley", "bat", "altbat", "butterfly", "crab", "deepcrab", "cypher", "shark",
                                                      "fiveo", "abcd", "altabcd", "tigadorongan"})

    def test_saham_live_dan_cadangan(self):
        bars = self.bars([150, 100, 200, 138.2, 175.3, 121.4])
        tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        f = Path(tmp.name) / ".harmonik.json"
        f.write_text(json.dumps({"rows": [], "bars": {"AAAA": bars}}))
        with unittest.mock.patch.object(server, "HARMONIK_PATH", f), \
                unittest.mock.patch.object(server, "nama_semua", return_value={"AAAA": "Aaaa Tbk"}):
            with unittest.mock.patch.object(server, "get_ohlc", return_value=bars):
                r = server.harmonik_saham("AAAA")
            self.assertEqual((r["sumber"], r["nama"], r["likuid"]), ("harga harian Stockbit", "Aaaa Tbk", True))
            self.assertIn("gartley", [x["pola"] for x in r["rows"]])
            self.assertTrue(r["pivot"] and r["pivot"][-1]["tentatif"])
            # Cache kosong (mis. pengunjung publik): pakai salinan dari screening malam.
            with unittest.mock.patch.object(server, "get_ohlc", side_effect=server.PublicNoCache("kosong")):
                self.assertEqual(server.harmonik_saham("AAAA")["sumber"], "salinan screening malam")
                with self.assertRaises(server.PublicNoCache):
                    server.harmonik_saham("BBBB")
        tmp.cleanup()


class AutoMonitorTest(unittest.TestCase):
    """Kandidat otomatis masuk Monitor: pergantian pengendali terkonfirmasi, atau rencana pengambilalihan (DGIK)."""

    def kd(self, t, teks, d="2026-11-04", nc=None):
        return {"ticker": t, "name": t + " Tbk", "flags": {"akuisisi": True}, **({"pengendaliBaru": nc} if nc else {}),
                "signals": {"akuisisi": {"st": "on", "d": d, "ev": [{"d": d, "text": teks, "src": "https://stockbit.com/post/1"}]}}}

    def jalan(self, items, ada=(), sembunyi=()):
        simpan = []
        with unittest.mock.patch.object(server, "items_all", return_value=[{"ticker": t} for t in ada]), \
                unittest.mock.patch.object(server, "data_rows", return_value=[(t,) for t in sembunyi]), \
                unittest.mock.patch.object(server, "item_put", side_effect=simpan.append):
            hasil = server.auto_monitor({"items": items}, now=datetime(2026, 11, 6))
        return hasil, simpan

    def test_rencana_pengambilalihan(self):
        hasil, simpan = self.jalan([
            self.kd("DGIK", "Tokyu Construction Siap Caplok 25 Persen Saham Nusa Konstruksi (DGIK)"),
            self.kd("BUMI", "BUMI Akuisisi Tambang Emas di Australia"),                        # BUMI pembeli, bukan target
            self.kd("LAMA", "Penawaran Tender Wajib atas Saham PT Lama Tbk", d="2026-10-01"),  # lebih dari 14 hari
            self.kd("TRSY", "Keterbukaan Informasi Pengalihan Saham Hasil Pembelian Kembali Saham"),
            self.kd("BUMX", "Pengambilalihan Mount Margaret"),                                 # BUMI mengambil alih pihak lain
            self.kd("CSIS", "Investor Hong Kong Batal Akuisisi 86 Persen Saham Puri Sentul (KDTN)"),  # batal & emiten lain
            self.kd("IPAC", "Penyampaian Salinan Pernyataan Penawaran Tender Sukarela atas Saham-Saham PT Era Graharealty Tbk (IPAC)"),
            self.kd("SMBR", "Semen Baturaja (SMBR) Caplok Anak Usaha, Begini Alasannya"),     # SMBR pembeli
            self.kd("BYAN", "Usai Dicaplok Haji Isam, Bayan (BYAN) Rombak Direksi-Komisaris"),  # pasif: BYAN target
        ])
        self.assertEqual(hasil, ["DGIK", "IPAC", "BYAN"])
        self.assertEqual((simpan[0]["stage"], simpan[0]["auto"], simpan[0]["autoJenis"]), ("spa", True, "rencana"))
        # Tahap sesuai bukti: DGIK PPJB, IPAC tender diumumkan, BYAN pengendalian efektif.
        self.assertEqual([(x["ticker"], x["stage"], x["ms"]) for x in simpan],
                         [("DGIK", "spa", {"spa": True}), ("IPAC", "tender", {"to_umum": True}), ("BYAN", "tender", {"akuisisi": True})])
        self.assertIn("belum terkonfirmasi di KSEI", simpan[0]["notes"])

    def test_terkonfirmasi_dan_lewati(self):
        nc = {"date": "2026-11-03", "name": "Pt Baru", "pct": 30, "text": "Pt Baru masuk: 0% → 30% (KSEI)"}
        hasil, simpan = self.jalan([self.kd("AAAA", "Perubahan Pengendali", nc=nc),
                                    self.kd("BBBB", "Tokyu Akan Akuisisi 25% Saham BBBB"),     # sudah di Monitor
                                    self.kd("CCCC", "X Siap Caplok 30 Persen Saham CCCC")],    # disembunyikan tim
                                   ada=["BBBB"], sembunyi=["CCCC"])
        self.assertEqual(hasil, ["AAAA"])
        self.assertNotIn("autoJenis", simpan[0])
        self.assertEqual((simpan[0]["stage"], simpan[0]["ms"]), ("tender", {"akuisisi": True}))
        self.assertIn("terkonfirmasi", simpan[0]["notes"])

    def test_naikkan_tahap_item_otomatis_lama(self):
        lama = [{"ticker": "IPAC", "auto": True, "autoJenis": "rencana", "stage": "radar", "ms": {},
                 "notes": "Otomatis: rencana pengambilalihan. Pernyataan Penawaran Tender Sukarela atas Saham IPAC"},
                {"ticker": "ANDI", "auto": True, "stage": "radar", "ms": {}, "notes": "Otomatis: pergantian pengendali terkonfirmasi."},
                {"ticker": "TIMX", "auto": True, "stage": "spa", "ms": {"spa": True}},              # sudah diatur, tidak disentuh
                {"ticker": "MANU", "stage": "radar", "ms": {}, "notes": "PPJB"}]                  # bukan otomatis
        simpan = []
        with unittest.mock.patch.object(server, "items_all", return_value=lama), \
                unittest.mock.patch.object(server, "data_rows", return_value=[]), \
                unittest.mock.patch.object(server, "item_put", side_effect=simpan.append):
            server.auto_monitor({"items": []})
        self.assertEqual([(x["ticker"], x["stage"], x["ms"]) for x in simpan],
                         [("IPAC", "tender", {"to_umum": True}), ("ANDI", "tender", {"akuisisi": True})])

    def test_kasus_salah_deteksi_nyata(self):
        """Judul nyata yang dulu salah masuk Monitor: emiten pembeli (RAJA, COIN), berita emiten lain (BNII, MSCI),
        pengendali lama menambah porsi (ENRG). Yang benar tetap lolos (INET target, TGUK tender wajib)."""
        tolak = [("RAJA", "Emiten Hapsoro Caplok 90 Persen Saham Kapalindo, Simak Tujuannya", "Rukun Raharja Tbk."),
                 ("COIN", "Strategis, Indokripto Caplok 10 Persen Saham MIG", "Indokripto Koin Semesta Tbk."),
                 ("BNII", "Raih utang bank, RAJA milik Hapsoro caplok Kapalindo Nusantara", "Bank Maybank Indonesia Tbk."),
                 ("MSCI", "Pengendali Gelontor Triliunan Rupiah Beli 5,84% Saham ENRG Jelang MSCI", "Indosterling Technomedia Tbk."),
                 ("ENRG", "Pengendali Gelontor Triliunan Rupiah Beli 5,84% Saham ENRG Jelang MSCI", "Energi Mega Persada Tbk.")]
        for t, j, n in tolak:
            self.assertFalse(server.rencana_cocok(t, j, n), t)
        self.assertTrue(server.rencana_cocok("INET", "DOOH Caplok INET, Nilai Transaksi Capai Rp2 Triliun", "Sinergi Inti Andalan Prima Tbk."))
        self.assertTrue(server.rencana_cocok("TGUK", "VCG Tawarkan Tender Wajib TGUK Rp56 per Saham", "Platinum Wahab Nusantara Tbk."))
        # Kalimat pasif dengan emiten sebagai pelaku ("Sahamnya Dicaplok AKR (AKRA)"): AKRA pembeli, bukan target.
        self.assertFalse(server.rencana_cocok("AKRA", "BP Cabut dari Bisnis SPBU di RI, Sahamnya Dicaplok AKR (AKRA)", "AKR Corporindo Tbk."))
        self.assertTrue(server.rencana_cocok("BYAN", "Usai Dicaplok Haji Isam, Bayan (BYAN) Rombak Direksi-Komisaris", "Bayan Resources Tbk."))
        # Keterbukaan resmi emiten sendiri tanpa kode: PPJB atas saham perseroan dihitung, pengambilalihan PT lain tidak.
        self.assertTrue(server.rencana_cocok("HRME", "Keterbukaan Informasi atas Penandatanganan Perjanjian Pengikatan Jual Beli Saham "
                                                     "oleh PT Wijaya Wisesa Realty", "Menteng Heritage Realty Tbk.", True))
        self.assertFalse(server.rencana_cocok("RAJA", "Pengambilalihan saham sebesar 90% dalam PT Kapalindo Nusantara Jaya oleh PT Banawa",
                                              "Rukun Raharja Tbk.", True))
        self.assertFalse(server.rencana_cocok("HRME", "Keterbukaan Informasi atas Penandatanganan Perjanjian Pengikatan Jual Beli Saham "
                                                      "oleh PT Wijaya Wisesa Realty", "Menteng Heritage Realty Tbk."))

    def test_cek_ulang_item_rencana_lama(self):
        awal = "Otomatis: rencana pengambilalihan, belum terkonfirmasi di KSEI. "
        lama = [{"ticker": "RAJA", "name": "Rukun Raharja Tbk.", "auto": True, "autoJenis": "rencana", "stage": "spa", "ms": {"spa": True},
                 "notes": awal + "Emiten Hapsoro Caplok 90 Persen Saham Kapalindo, Simak Tujuannya (2026-11-09)."},
                {"ticker": "INET", "name": "Sinergi Inti Andalan Prima Tbk.", "auto": True, "autoJenis": "rencana", "stage": "spa", "ms": {"spa": True},
                 "notes": awal + "DOOH Caplok INET, Nilai Transaksi Capai Rp2 Triliun (2026-11-06)."}]
        simpan = []
        with unittest.mock.patch.object(server, "items_all", return_value=lama),                 unittest.mock.patch.object(server, "data_rows", return_value=[]),                 unittest.mock.patch.object(server, "item_put", side_effect=simpan.append):
            server.auto_monitor({"items": []})
        self.assertEqual([(x["ticker"], x["stage"], x["ms"], x["autoJenis"]) for x in simpan], [("RAJA", "radar", {}, "rencana-ditolak")])
        self.assertIn("Tinjau lalu hapus", simpan[0]["notes"])

    def test_item_ditolak_tidak_naik_tahap_lagi(self):
        """Item yang sudah ditandai keliru tidak boleh dinaikkan tahapnya lagi; yang terlanjur terisi dikosongkan."""
        lama = [{"ticker": "RAJA", "name": "Rukun Raharja Tbk.", "auto": True, "autoJenis": "rencana-ditolak", "stage": "spa",
                 "ms": {"spa": True}, "notes": "Otomatis: rencana pengambilalihan. Emiten Hapsoro Caplok 90 Persen Saham Kapalindo"},
                {"ticker": "COIN", "name": "Indokripto Koin Semesta Tbk.", "auto": True, "autoJenis": "rencana-ditolak", "stage": "radar",
                 "ms": {}, "notes": "Otomatis: rencana pengambilalihan. Strategis, Indokripto Caplok 10 Persen Saham MIG"}]
        simpan = []
        with unittest.mock.patch.object(server, "items_all", return_value=lama),                 unittest.mock.patch.object(server, "data_rows", return_value=[]),                 unittest.mock.patch.object(server, "item_put", side_effect=simpan.append):
            server.auto_monitor({"items": []})
        self.assertEqual([(x["ticker"], x["stage"], x["ms"], x["autoJenis"]) for x in simpan], [("RAJA", "radar", {}, "rencana-ditolak")])

    def test_batas_per_putaran(self):
        items = [self.kd(f"A{c}AA", f"Investor Siap Caplok 20 Persen Saham A{c}AA") for c in "BCDEFGH"]
        hasil, _ = self.jalan(items)
        self.assertEqual(len(hasil), server.RENCANA_MAKS)


class AuditDataTest(unittest.TestCase):
    """Audit Monitor terhadap daftar tender offer Stockbit dan judul keterbukaan/berita (kasus nyata November 2026)."""

    def item(self, t, nama, ms=None, stage="radar", notes="", **kw):
        return {"ticker": t, "name": nama, "ms": ms or {}, "stage": stage, "notes": notes, **kw}

    def jalan(self, items, tenders=None, laporan=None):
        import auditdata
        return [(x["t"], x["jenis"]) for x in auditdata.audit_monitor(items, tenders or {}, laporan or {}, "2026-11-17")]

    def test_tender_offer(self):
        to = {"TGUK": {"price": 56, "start": "2026-11-09", "end": "2026-12-08"},
              "NAYZ": {"price": 75, "start": "2026-10-05", "end": "2026-11-03"}}
        hasil = self.jalan([self.item("TGUK", "Platinum Wahab Nusantara Tbk.", {"spa": True}),
                            self.item("NAYZ", "Hassana Boga Sejahtera Tbk.", {"to_umum": True}),
                            self.item("DPUM", "Dua Putra Utama Makmur Tbk.", {"akuisisi": True, "to_umum": True}),
                            self.item("XXXX", "Contoh Tbk.", {"to_umum": True})], to,
                           {"DPUM": [{"date": "2026-08-29", "title": "Kebakaran Pabrik, Rama Indonesia Jadwal Ulang Tender Offer Saham DPUM"}]})
        self.assertEqual(hasil, [("TGUK", "to_belum"), ("NAYZ", "to_selesai_belum"), ("XXXX", "to_tanpa_bukti"), ("DPUM", "to_rencana")])

    def test_pengendali_dan_positif_palsu(self):
        lap = {"ULTJ": [{"date": "2026-11-10", "title": "FrieslandCampina Jadi Pengendali ULTJ, Sabana Prawirawidjaja Tetap Jabat Presiden Direktur"}],
               "LOPI": [{"date": "2026-11-01", "title": "Pemegang Saham Lama Tetap Jadi Pengendali LOPI"}],
               "BNII": [{"date": "2026-11-09", "title": "Pengambilalihan saham dalam PT Maybank Finance oleh BNII"}]}
        hasil = self.jalan([self.item("ULTJ", "Ultra Jaya Milk Industry Tbk."), self.item("LOPI", "Logisticsplus International Tbk."),
                            self.item("BNII", "Bank Maybank Indonesia Tbk.")], laporan=lap)
        self.assertEqual(hasil, [("ULTJ", "pengendali_belum")])

    def test_batal(self):
        nama = "Puri Sentul Permai Tbk."
        lap = {"KDTN": [{"date": "2026-11-05", "title": "Pengakhiran atas Rencana Pengambilalihan PT Puri Sentul Permai Tbk oleh Ruby Mining "
                                                        "Hongkong Limited (Calon Pengendali Baru)"},
                        {"date": "2026-06-22", "title": "KDTN Rombak Manajemen, Perubahan Pengendali Semakin Dekat"}],
               # Objek yang batal emiten lain, dan sesudahnya ada tender offer: bukan pembatalan NAYZ.
               "NAYZ": [{"date": "2026-04-24", "title": "Batal Akuisisi SPRE, Saiko Bidik HBS Food (NAYZ)"}],
               "PTMR": [{"date": "2026-03-03", "title": "Bahas Akuisisi dan Jual Aset, PTMR Malah Batal RUPSLB dan RUPS Independen Hari Ini!"}]}
        belum = "Penawaran tender wajib belum ditemukan di Stockbit; tahap belum terverifikasi."
        hasil = self.jalan([self.item("KDTN", nama, {"spa": True, "akuisisi": True}, "tender", belum),
                            self.item("NAYZ", "Hassana Boga Sejahtera Tbk.", {"spa": True}, "spa"),
                            self.item("PTMR", "Master Print Tbk.", {"spa": True}, "spa")], laporan=lap)
        self.assertEqual(hasil, [("KDTN", "batal")])

    def test_item_otomatis(self):
        hasil = self.jalan([self.item("AKRA", "AKR Corporindo Tbk.", autoJenis="rencana-ditolak"),
                            self.item("INET", "Sinergi Inti Andalan Prima Tbk.", {"spa": True}, "spa", autoJenis="rencana")])
        self.assertEqual(hasil, [("INET", "rencana_belum"), ("AKRA", "rencana_ditolak")])


    def test_build_dan_api(self):
        """Bangun audit dari data tiruan (tanpa Stockbit), simpan, lalu API hanya menampilkan item yang masih ada di Monitor."""
        items = [{"ticker": "TGUK", "name": "Platinum Wahab Nusantara Tbk.", "ms": {"spa": True}},
                 {"ticker": "LAMA", "name": "Lama Tbk.", "ms": {"to_umum": True, "to_selesai": True}}]
        tender = {"items": [{"ticker": "TGUK", "price": 56, "start": "2026-11-09", "end": "2099-12-08"},
                            {"ticker": "LAMA", "price": 99, "start": "2020-01-01", "end": "2020-02-01"}]}  # TO lama diabaikan
        with tempfile.TemporaryDirectory() as d,                 unittest.mock.patch.object(server, "AUDIT_PATH", Path(d) / ".audit-monitor.json"),                 unittest.mock.patch.object(server, "items_all", return_value=items),                 unittest.mock.patch.object(server, "load_config", return_value={}),                 unittest.mock.patch.object(server, "tender_data", return_value=tender),                 unittest.mock.patch.object(server, "berita_saham", return_value={"items": []}),                 unittest.mock.patch.object(server.time, "sleep"):
            res = server.audit_monitor_build()
            self.assertEqual([(x["t"], x["jenis"]) for x in res["temuan"]], [("TGUK", "to_belum"), ("LAMA", "to_tanpa_bukti")])
            with unittest.mock.patch.object(server, "items_all", return_value=items[:1]):
                self.assertEqual([x["t"] for x in server.audit_monitor_api()["temuan"]], ["TGUK"])


class PovDalamLatarTest(unittest.TestCase):
    """Analisa mendalam tersimpan per saham, ditarik ulang hanya bila ada data baru atau umurnya lewat batas."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        d = Path(self.tmp.name)
        self.patches = [unittest.mock.patch.object(server, k, v) for k, v in (
            ("PD_DIR", d / ".pov-dalam"), ("PD_LAMA", d / ".pov-dalam.json"), ("PD_PEMICU_PATH", d / ".pov-dalam-pemicu.json"),
            ("_pd_indeks", None), ("_pd_jobs", {}), ("_pd_gagal_latar", {}), ("_pd_mulai", []))]
        for p in self.patches:
            p.start()
        self.v = server.PD.VERSI

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_pecah_format_lama(self):
        server.PD_LAMA.write_text(json.dumps({"AAAA": {"at": 100.0, "hasil": {"versi": self.v}}, "bad": {}}), encoding="utf-8")
        self.assertEqual(server.pd_indeks(), {"AAAA": {"at": 100.0, "versi": self.v}})
        self.assertFalse(server.PD_LAMA.exists())
        self.assertEqual(server.pd_baca("AAAA")["hasil"]["versi"], self.v)

    def test_pemicu_dan_basi(self):
        kemarin = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        hari = datetime.now().strftime("%Y-%m-%d")
        # Pencatatan pertama memakai awal tanggal baris: analisa yang dibuat sesudahnya tetap berlaku.
        server.pd_pemicu_catat([("AAAA", "u1", kemarin, "Hasil RUPS")])
        server.pd_simpan("AAAA", {"versi": self.v})
        simpan = server.pd_baca("AAAA")
        self.assertEqual(server.pd_basi("AAAA", simpan), "")
        # Baris yang sama tidak dicatat dua kali; baris baru sesudah analisa membuatnya basi.
        self.assertEqual(server.pd_pemicu_catat([("AAAA", "u1", kemarin, "Hasil RUPS")]), 0)
        self.assertEqual(server.pd_pemicu_catat([("AAAA", "u2", hari, "Pengambilalihan")], now=simpan["at"] + 60), 1)
        self.assertIn("Pengambilalihan", server.pd_basi("AAAA", simpan))
        # Tanpa data baru, analisa berumur > PD_MAKS_UMUR tetap ditarik ulang.
        self.assertIn("hari", server.pd_basi("BBBB", {"at": 1.0}, {}, now=server.PD_MAKS_UMUR + 10))

    def test_urutan_latar(self):
        now = time.time()
        for t in ("AAAA", "BBBB", "DDDD", "EEEE"):
            server.pd_simpan(t, {"versi": self.v})
        server._pd_indeks["DDDD"]["at"] = now - server.PD_MAKS_UMUR - 10
        server._pd_indeks["EEEE"]["versi"] = "lama"
        server.PD_PEMICU_PATH.write_text(json.dumps({"BBBB": [{"k": "x", "waktu": now + 5, "tgl": "2026-11-05", "teks": "RUPS"}]}))
        server._pd_gagal_latar["FFFF"] = now
        with unittest.mock.patch.object(server, "items_all", return_value=[{"ticker": "ZZZZ"}]), \
                unittest.mock.patch.object(server, "radar_tickers", return_value={"ZZZZ"}), \
                unittest.mock.patch.object(server, "bei_kode_load",
                                           return_value={t: "" for t in ("AAAA", "BBBB", "CCCC", "DDDD", "EEEE", "FFFF")}):
            # data baru > belum ada/versi lama (radar dulu) > terlalu lama; AAAA masih berlaku, FFFF baru gagal.
            self.assertEqual(server.pd_urutan(now + 10), ["BBBB", "ZZZZ", "CCCC", "EEEE", "DDDD"])

    def test_api_tampil_lama_sambil_tarik_ulang(self):
        server.pd_simpan("AAAA", {"versi": self.v, "t": "AAAA"})
        at = server.pd_baca("AAAA")["at"]
        server.PD_PEMICU_PATH.write_text(json.dumps({"AAAA": [{"k": "x", "waktu": at + 5, "tgl": "2026-11-05", "teks": "PPJB"}]}))
        with unittest.mock.patch.object(server, "bei_kode_load", return_value={"AAAA": ""}):
            r = server.pov_dalam_api("AAAA", False)
            self.assertEqual((r["status"], r["hasil"]["t"], r["cakupan"]["tersimpan"]), ("selesai", "AAAA", 1))
            self.assertIn("PPJB", r["basi"])
            self.assertNotIn("segarkan", r)
            with unittest.mock.patch.object(server, "get_token", return_value="x"), \
                    unittest.mock.patch.object(server, "token_expired", return_value=False), \
                    unittest.mock.patch.object(server.threading, "Thread") as th:
                r = server.pov_dalam_api("AAAA", True)
            th.return_value.start.assert_called_once()
            self.assertEqual((r["status"], r["segarkan"]["langkah"]), ("selesai", 0))
            # Pekerjaan latar tidak menghabiskan jatah pengunjung.
            server._pd_jobs["AAAA"]["latar"] = True
            self.assertIn("segarkan", server.pov_dalam_api("AAAA", False))
            self.assertEqual(server.pov_dalam_api("BBBB", False)["status"], "kosong")

    def test_folder_titik_tidak_disajikan(self):
        root = Path(self.tmp.name)
        (root / ".pov-dalam").mkdir(exist_ok=True)
        (root / ".pov-dalam" / "AAAA.json").write_text("{}")
        (root / "data.json").write_text("{}")
        srv = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_address[1]}"
        kode = {}
        try:
            with unittest.mock.patch.object(server, "ROOT", root), unittest.mock.patch.object(server, "DIST", root / "dist"):
                for p in ("/.pov-dalam/AAAA.json", "/data.json"):
                    try:
                        with urllib.request.urlopen(base + p) as r:
                            kode[p] = r.status
                    except urllib.error.HTTPError as e:
                        kode[p] = e.code
        finally:
            srv.shutdown()
            srv.server_close()
        self.assertEqual(kode, {"/.pov-dalam/AAAA.json": 404, "/data.json": 200})


class LkTest(unittest.TestCase):
    """Laporan keuangan seluruh BEI dari akun StockbitReports: urai ringkasan AI menjadi angka dan kategori."""

    def post(self, title, judul, summary, points, sid=1, topic="AKPI"):
        return {"stream_id": sid, "title": f"{title} [{topic}]", "topics": [topic], "created_at": "2026-11-02 11:56:00",
                "summary": {"title": judul, "summary": summary, "key_points": points, "key_takeaway": "Laba naik karena margin melebar"}}

    def test_laba_naik(self):
        r = server.lk_parse(self.post("Penyampaian Laporan Keuangan Interim Yang Tidak Diaudit", "Laba Bersih Naik 3.408,3% 9M26",
            "AKPI (Argha Karya Prima Industry) membukukan laba bersih bertambah 3.408,3% menjadi Rp 110,75 miliar, dengan pendapatan meningkat 24,25% menjadi Rp 2,77 triliun.",
            ["Laba bersih meningkat 3.408,3% YoY dari Rp 3,16 miliar menjadi Rp 110,75 miliar", "Margin kotor naik dari 10,44% menjadi 13,39%"]))
        self.assertEqual((r["t"], r["periode"], r["kategori"], r["nama"]), ("AKPI", "9M26", "bagus", "Argha Karya Prima Industry"))
        self.assertAlmostEqual(r["laba"]["pct"], 3408.3)
        self.assertAlmostEqual(r["laba"]["dari"]["v"], 3.16e9)
        self.assertAlmostEqual(r["laba"]["ke"]["v"], 110.75e9)
        self.assertAlmostEqual(r["pendapatan"]["pct"], 24.25)
        self.assertEqual(r["marginKotor"], {"dari": 10.44, "ke": 13.39})
        self.assertTrue(any("Basis tahun lalu kecil" in c for c in r["catatan"]))

    def test_kategori_lain(self):
        base = ("Penyampaian Laporan Keuangan Interim", "", "XXXX (Contoh) membukukan.", [])
        cek = lambda judul: server.lk_parse(self.post(base[0], judul, base[2], base[3], topic="XXXX"))["kategori"]
        self.assertEqual(cek("Rugi Bersih Berbalik Laba 9M26"), "berbalik")
        self.assertEqual(cek("Laba Bersih Berbalik Rugi 9M26"), "rugi")
        self.assertEqual(cek("Laba Bersih Turun 22,15% 9M26"), "turun")
        self.assertEqual(cek("Laba Bersih Bertambah 5% 9M26"), "naik")
        self.assertIsNone(server.lk_parse(self.post("Bukti Iklan Laporan Keuangan", "Penyampaian Bukti Iklan Laporan Keuangan", "x", [])))
        self.assertIsNone(server.lk_parse(self.post("Laporan Bulanan Registrasi", "Laba Bersih Naik 5%", "x", [])))

    def test_periode_dan_format_nilai(self):
        self.assertEqual([server.lk_periode(j) for j in ("Laba Bersih Naik 20% 9M26", "Rugi Bersih Turun 48,59% Q1 26",
                                                          "Laba Bersih Naik 5% H1 2026", "Laba Bersih Naik 5% FY25")], ["9M26", "3M26", "1H26", "FY25"])
        d, k = server.lk_nilai_laba(["Laba bersih naik 16,8% YoY menjadi Rp 84,53 miliar dari Rp 72,39 miliar"])
        self.assertEqual((d["v"], k["v"]), (72.39e9, 84.53e9))
        # Tanpa pembanding: angka sesudah "mencapai", bukan angka pendapatan; periode lalu diturunkan dari % YoY.
        r = server.lk_parse(self.post("Laporan Keuangan", "Laba Neto Naik 25% 1H26",
            "BSSR (Baramulti) membukukan laba bersih naik 25% mencapai US$ 62,5 juta, dengan pendapatan menjadi US$ 361 juta.", []))
        self.assertEqual(r["periode"], "1H26")
        self.assertAlmostEqual(r["laba"]["ke"]["v"], 62.5e6)
        self.assertAlmostEqual(r["laba"]["dari"]["v"], 50e6)

    def test_q3_murni_melemah(self):
        # 9M naik 20% (100 -> 120) tetapi 1H naik lebih besar (60 -> 90): Q3 tahun lalu 40, Q3 kini 30 (turun 25%).
        r9 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 20% 9M26", "AKPI (A) x.",
                                       ["Laba bersih naik 20% YoY dari Rp 100 miliar menjadi Rp 120 miliar"], sid=9))
        r6 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 50% 1H26", "AKPI (A) x.",
                                       ["Laba bersih naik 50% YoY dari Rp 60 miliar menjadi Rp 90 miliar"], sid=6))
        r3 = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 10% 3M26", "AKPI (A) x.",
                                       ["Laba bersih naik 10% YoY dari Rp 40 miliar menjadi Rp 44 miliar"], sid=3))
        k = server.lk_kuartal(r9, r6, r3)
        self.assertAlmostEqual(k["laba"], 30e9)
        self.assertAlmostEqual(k["labaLalu"], 40e9)
        self.assertEqual((k["yoy"], k["status"], k["melemah"]), (-25.0, "turun", True))
        self.assertAlmostEqual(k["labaSebelum"], 46e9)
        r6["tgl"], r3["tgl"] = "2026-07-30", "2026-04-30"
        with unittest.mock.patch.object(server, "items_all", return_value=[]):
            row = server.lk_api({x["id"]: x for x in (r9, r6, r3)}, kuartalan={}, keystats={})["rows"][0]
        self.assertEqual(row["periode"], "9M26")
        self.assertTrue(row["kuartal"]["melemah"])

    def test_q3_berbalik_rugi(self):
        r9 = server.lk_parse(self.post("Laporan Keuangan", "Rugi Bersih Berbalik Laba 9M26", "AKPI (A) x.",
                                       ["Laba bersih berbalik dari rugi Rp 10 miliar menjadi laba Rp 5 miliar"], sid=19))
        r9["laba"]["dari"], r9["laba"]["ke"] = {"v": 10e9, "mata": "Rp"}, {"v": 5e9, "mata": "Rp"}
        r6 = server.lk_parse(self.post("Laporan Keuangan", "Rugi Bersih Turun 50% 1H26", "AKPI (A) x.",
                                       ["Rugi bersih turun 50% YoY dari Rp 8 miliar menjadi Rp 4 miliar"], sid=16))
        k = server.lk_kuartal(r9, r6, None)
        self.assertAlmostEqual(k["laba"], 9e9)          # 5 - (-4)
        self.assertAlmostEqual(k["labaLalu"], -2e9)     # -10 - (-8)
        self.assertEqual(k["status"], "berbalik")

    def test_berbalik_dan_basis_kecil(self):
        # AMMN: "berbalik menjadi laba US$871,47 juta dari rugi US$178,54 juta".
        d, k = server.lk_nilai_laba(["Rugi bersih berbalik menjadi laba US$ 871,47 juta dari rugi US$ 178,54 juta"])
        self.assertEqual((d["v"], k["v"]), (178.54e6, 871.47e6))
        # ARII: basis tahun lalu sangat kecil (0,29 jt) vs tabel (0,66 jt) tetap dianggap cocok terhadap laba 9M (16,24 jt).
        r = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Bertambah 5.537,85% 9M26", "ARII (A) x.",
                                      ["Laba bersih naik 5.537,85% YoY dari US$ 288.000 menjadi US$ 16,24 juta"], topic="ARII"))
        fd = {"mata": "Rp", "pend": {}, "laba": {"Laba Bersih": {"Q125": 11.35e6, "Q225": -7.92e6, "Q325": -2.77e6, "Q425": 1.71e6,
                                                                   "Q126": 9.7e6, "Q226": 2.17e6}}}
        q = server.lk_kuartal_fd(r, fd)
        self.assertEqual(q["status"], "berbalik")
        self.assertAlmostEqual(q["laba"], 4.37e6)

    def test_api_satu_per_emiten(self):
        a = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 30% 6M26", "AKPI (A) x.", [], sid=1))
        b = server.lk_parse(self.post("Laporan Keuangan", "Laba Bersih Naik 40% 9M26", "AKPI (A) x.", [], sid=2))
        a["tgl"] = "2026-08-01"
        with unittest.mock.patch.object(server, "items_all", return_value=[]):
            r = server.lk_api({a["id"]: a, b["id"]: b}, kuartalan={}, keystats={})
        self.assertEqual(r["n"], 1)
        self.assertEqual(r["rows"][0]["periode"], "9M26")
        self.assertEqual(r["hitung"], {"bagus": 1})


class UpdatesUnikTest(unittest.TestCase):
    def test_ganda_disaring_resmi_didahulukan(self):
        ups = [{"id": "sb-news-1", "ticker": "VISI", "date": "2026-11-02", "title": "Raffi Ahmad Borong Saham VISI"},
               {"id": "sb-report-2", "ticker": "VISI", "date": "2026-11-02", "title": "Raffi  Ahmad borong saham VISI"},
               {"id": "sb-news-3", "ticker": "VISI", "date": "2026-11-01", "title": "Raffi Ahmad Borong Saham VISI"},
               {"id": "sb-news-4", "ticker": "MKNT", "date": "2026-11-02", "title": "Raffi Ahmad Borong Saham VISI"}]
        self.assertEqual([u["id"] for u in server.updates_unik(ups)], ["sb-report-2", "sb-news-3", "sb-news-4"])


class CekPascaDeployTest(unittest.TestCase):
    """deploy/cek_pasca.py: halaman utama/JS = kritis, data kosong = peringatan."""

    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("cek_pasca", Path(__file__).resolve().parent.parent / "deploy" / "cek_pasca.py")
        self.cek = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.cek)

    def jawab(self, ubah=None):
        isi = {"": (200, b'<div id="app"></div><script type="module" src="./assets/index-A.js"></script>'),
               "assets/index-A.js": (200, b"x"),
               "api/items": (200, b'[{"ticker": "AGAR"}]'), "api/updates": (200, b'[{"id": 1}]'),
               "api/lk": (200, b'{"n": 800}'), "api/saham50": (200, b'{"n": 150}'),
               "api/broker-pola": (200, json.dumps({"brokers": [{}] * 90}).encode()),
               "api/seasonality": (200, b'{"total": 239}'),
               "api/kode-bei": (200, json.dumps({"kode": [{}] * 1000}).encode())}
        isi.update(ubah or {})
        return lambda p: isi.get(p, (404, b""))

    def test_semua_lulus(self):
        self.assertEqual(self.cek.periksa(self.jawab()), {"kritis": [], "peringatan": []})

    def test_js_hilang_kritis(self):
        r = self.cek.periksa(self.jawab({"assets/index-A.js": (404, b"")}))
        self.assertEqual(len(r["kritis"]), 1)

    def test_data_kosong_peringatan(self):
        r = self.cek.periksa(self.jawab({"api/broker-pola": (200, b'{"error": "Data pola broker sedang disiapkan"}'),
                                         "api/lk": (500, b"")}))
        self.assertEqual(r["kritis"], [])
        self.assertEqual(len(r["peringatan"]), 2)
        self.assertIn("Pola Broker", r["peringatan"][1] + r["peringatan"][0])


class LkTumbuhTest(unittest.TestCase):
    def test_definisi(self):
        t = server.lk_tumbuh
        self.assertTrue(t({"status": "naik", "laba": 9, "labaSebelum": 9, "qoq": 1.4})["tumbuh"])      # EPS lebih presisi
        self.assertFalse(t({"status": "naik", "laba": 45, "labaSebelum": 46, "qoq": -3.1})["tumbuh"])  # AKPI: Q3 < Q2
        k = t({"status": "berbalik", "laba": 20, "labaSebelum": -2, "qoq": None})                       # FITT
        self.assertTrue(k["tumbuh"] and k["berbalikQoq"])
        self.assertFalse(t({"status": "turun", "laba": 5, "labaSebelum": 1, "qoq": 400})["tumbuh"])    # turun YoY
        self.assertIsNone(t(None))


class PovDiskTest(unittest.TestCase):
    def test_pulih_dari_disk_setelah_restart(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / ".pov.json"
            res = {"asOf": "2026-11-03T08:00:00", "users": [{"username": "athira"}], "consensus": [], "errors": []}
            with unittest.mock.patch.object(server, "POV_PATH", p), unittest.mock.patch.object(server, "_pov_memo", None):
                server._pov_ke_disk(123.0, res)
                with unittest.mock.patch.object(server, "is_public_request", return_value=True):
                    self.assertEqual(server.get_pov()["users"][0]["username"], "athira")   # tanpa memanggil Stockbit

    def test_publik_tidak_menunggu_kunci(self):
        with tempfile.TemporaryDirectory() as d, \
                unittest.mock.patch.object(server, "POV_PATH", Path(d) / ".pov.json"), \
                unittest.mock.patch.object(server, "_pov_memo", None), \
                unittest.mock.patch.object(server, "is_public_request", return_value=True):
            with server._pov_lock:   # seolah pov_loop sedang menghitung
                r = server.get_pov()
            self.assertEqual(r["users"], [])
            self.assertIn("disiapkan", r["errors"][0]["error"])


class BeritaSahamTest(unittest.TestCase):
    def test_gabung_tanpa_simpan(self):
        lap = [{"id": "sb-report-1", "ticker": "RELF", "date": "2026-10-01", "title": "Laporan Bulanan"}]
        news = [{"id": "sb-news-2", "ticker": "RELF", "date": "2026-11-01", "title": "RELF masuk UMA"},
                {"id": "sb-news-3", "ticker": "RELF", "date": "2026-10-01", "title": "Laporan bulanan"}]
        with unittest.mock.patch.object(server, "load_config", return_value={"reports": {"url": "x"}}),                 unittest.mock.patch.object(server, "get_reports", return_value=lap),                 unittest.mock.patch.object(server, "get_sb_news", return_value=news),                 unittest.mock.patch.object(server, "nama_semua", return_value={"RELF": "Graha Mitra Asia Tbk"}),                 unittest.mock.patch.object(server, "updates_put") as simpan:
            r = server.berita_saham("RELF")
        self.assertEqual([u["id"] for u in r["items"]], ["sb-news-2", "sb-report-1"])
        self.assertEqual(r["nama"], "Graha Mitra Asia Tbk")
        simpan.assert_not_called()   # tidak masuk feed radar

    def test_cache(self):
        server._berita_cache.clear()
        isi = {"ticker": "RELF", "items": [{"id": "a"}]}
        with unittest.mock.patch.object(server, "berita_saham", return_value=isi) as ambil:
            server.berita_saham_cache("RELF")
            server.berita_saham_cache("RELF")
            self.assertEqual(ambil.call_count, 1)          # pencarian kedua dari cache
            server.berita_saham_cache("RELF", fresh=True)
            self.assertEqual(ambil.call_count, 2)
        with unittest.mock.patch.object(server, "berita_saham", return_value={"ticker": "NAYZ", "items": []}) as ambil:
            server.berita_saham_cache("NAYZ")
            server.berita_saham_cache("NAYZ")
            self.assertEqual(ambil.call_count, 2)          # hasil kosong tidak di-cache
        server._berita_cache.clear()


class GalianTest(unittest.TestCase):
    """Galian lanjutan POV (povgali): delapan analisa lintas emiten, harga, tahapan, broker, nominee, ritel, rekam jejak."""

    def test_kalender_backdoor(self):
        import povgali
        from datetime import datetime
        lap = [{"date": "2026-08-01", "title": "Penandatanganan PPJB saham pengendali"},
               {"date": "2026-09-10", "title": "Pengumuman penawaran tender wajib"},
               {"date": "2026-10-01", "title": "Laporan Keuangan Interim"}]
        k = povgali.kalender_backdoor({"kini": datetime(2026, 11, 4), "laporan": lap, "konversi": ["2026-05-01: ENAM BERLIAN 46.72%"]})
        self.assertEqual(k["posisi"], 4)
        self.assertEqual([x["status"] for x in k["tahap"][:4]], ["terjadi", "belum", "terjadi", "terjadi"])
        self.assertIn("RUPSLB", k["berikut"])
        self.assertEqual(povgali.kalender_backdoor({"kini": datetime(2026, 11, 4)})["posisi"], 0)

    def test_harga_pengalihan(self):
        import povgali
        ins = [{"date": "2026-09-02", "name": "PT BARU", "chg": 25.0, "price": 150, "estPrice": False, "value": 5e10},
               {"date": "2026-09-03", "name": "TUAN KECIL", "chg": 0.01, "price": 90, "estPrice": False, "value": 1e6}]
        bars = [{"d": "2026-09-01", "c": 100}, {"d": "2026-09-02", "c": 100}]
        lap = [{"date": "2026-10-01", "title": "Keterbukaan tender", "summary": "Harga penawaran tender Rp 1.250 per saham"}]
        h = povgali.harga_pengalihan(ins, bars, lap, 120)
        self.assertEqual(len(h["rows"]), 1)
        self.assertEqual(h["rows"][0]["selisih"], 50.0)
        self.assertEqual(h["dokumen"][0]["harga"], 1250)
        self.assertEqual(h["acuan"]["harga"], 1250)
        self.assertTrue(any("premi" in x for x in h["catatan"]))

    def test_pengurus_alamat_nominee(self):
        import povgali
        idx = {"AAAA": {"pengurus": ["Ir. Budi Santoso, MBA"], "alamat": "Menara Satu Lt. 12, Jl. Sudirman Kav. 5, Jakarta", "telp": "021-5551234",
                        "pemegang": []},
               "BBBB": {"pengurus": ["BUDI SANTOSO"], "alamat": "Menara Satu Lantai 12 Jl Sudirman Kav 5 Jakarta Selatan", "telp": "(021) 555 1234",
                        "pemegang": [["SITI AMINAH", 7.5, "INDONESIA", "Individual"]]},
               "CCCC": {"pengurus": ["ANDI"], "alamat": "Jl. Lain No. 9 Surabaya", "telp": "031-1112222", "pemegang": []}}
        p = povgali.pengurus_lintas("AAAA", ["BUDI SANTOSO (Direktur Utama)"], ["SITI AMINAH"], idx)
        self.assertEqual({x["nama"] for x in p}, {"BUDI SANTOSO", "SITI AMINAH"})
        self.assertEqual([x["t"] for x in povgali.alamat_sama("AAAA", idx)], ["BBBB"])
        pm = [{"name": "GOLDEN SPV LTD", "pct": 12.0}, {"name": "SITI AMINAH", "pct": 6.0}, {"name": "PT INDUK", "pct": 50.0, "pengendali": True}]
        det = {povgali.kunci_orang("GOLDEN SPV LTD"): {"dom": "BRITISH VIRGIN ISLANDS", "kls": "Corporate"},
               povgali.kunci_orang("SITI AMINAH"): {"dom": "INDONESIA", "kls": "Individual"}}
        nm = {x["nama"]: x for x in povgali.nominee(pm, det, [], [], [], [], [])}
        self.assertIn("GOLDEN SPV LTD", nm)
        self.assertIn("SITI AMINAH", nm)
        self.assertNotIn("PT INDUK", nm)

    def test_broker_ritel_rekam(self):
        import povgali
        bandar = {"fase": [{"hari": 30, "periode": "1 bulan", "bandar": 5e9, "akum": ["DH", "MG"], "dist": ["XL", "YP"]}]}
        b = povgali.broker_grup(bandar, [], ["PT SINAR MAS MULTIARTHA"])
        self.assertTrue(b["rows"][0]["satuGrup"])
        self.assertTrue(any("Sinar Mas" in x for x in b["catatan"]))
        self.assertTrue(any("lokal non-ritel" in x for x in b["catatan"]))
        r = povgali.tren_ritel([("2026-06-30", 1000), ("2026-07-31", 1100), ("2026-08-31", 1300), ("2026-09-30", 1500)],
                               [{"d": "2026-06-30", "c": 200}, {"d": "2026-09-30", "c": 150}])
        self.assertIn("distribusi", r["catatan"][0])
        harga = [{"d": f"2024-{(i % 12) + 1:02d}-01", "v": v} for i, v in enumerate([100] * 10 + [500] * 10 + [40] * 10)]
        nb = povgali.nasib_emiten(harga, "2025-01-01")
        self.assertIn("gocap", nb["pola"])
        rj = povgali.rekam_jejak([{"nama": "PT X", "emiten": [], "keluar": [{"t": "ZZZZ"}]}], {"ZZZZ": nb},
                                 [{"judul": "Bos PT X jadi tersangka korupsi", "url": "u"}, {"judul": "PT X raih penghargaan", "url": "v"}])
        self.assertEqual(len(rj["emiten"]), 1)
        self.assertEqual([x["kategori"] for x in rj["berita"]], [["hukum"]])
        self.assertTrue(rj["catatan"])

    def test_kakdr_riwayat(self):
        with tempfile.TemporaryDirectory() as d, unittest.mock.patch.object(server, "KAKDR_RIWAYAT_PATH", Path(d) / "r.json"):
            (Path(d) / "r.json").write_text(json.dumps({"2000-01-01": ["AAAA", "BBBB"]}))
            baru, keluar = server.kakdr_riwayat(["BBBB", "CCCC"])
        self.assertEqual((baru, keluar), (["CCCC"], ["AAAA"]))

    def test_profil_ringkas(self):
        p = {"key_executive": {"director": [{"value": "ANDI"}], "commissioner": [{"value": "BUDI"}]},
             "address": [{"office": "Jl. A\nNo. 1", "phone": "021-1"}],
             "shareholder_one_percent": {"shareholder": [{"name": "X LTD", "percentage": "12.5%", "domicile": "SEYCHELLES", "classification": "Corporate"}]},
             "shareholder_numbers": [{"shareholder_date": "30 Sep 2026", "total_share": "5,996"}]}
        r = server.profil_ringkas(p)
        self.assertEqual(r["pengurus"], ["ANDI", "BUDI"])
        self.assertEqual(r["alamat"], "Jl. A No. 1")
        self.assertEqual(r["pemegang"][0][:3], ["X LTD", 12.5, "SEYCHELLES"])
        self.assertEqual(r["jumlah"], [["2026-09-30", 5996]])


class KakdrScreenTest(unittest.TestCase):
    def test_screening(self):
        ks = {"AAAA": {"hargaKira": 400, "rasio": {"Current Price to Book Value": 0.6, "Debt to Equity Ratio (Quarter)": 0.4,
                                                   "Return on Equity (TTM)": 12.0, "Dividend Yield": 5.0, "52 Week High": 1000}},
              "BBBB": {"hargaKira": 900, "rasio": {"Current Price to Book Value": 3.0, "Debt to Equity Ratio (Quarter)": 2.5,
                                                   "Return on Equity (TTM)": -4.0, "Dividend Yield": 0, "52 Week High": 1000}}}
        with unittest.mock.patch.object(server, "lks_load", return_value=ks), \
                unittest.mock.patch.object(server, "harga_semua", return_value={}), \
                unittest.mock.patch.object(server, "sektor_load", return_value={}), \
                unittest.mock.patch.object(server, "nama_semua", return_value={}), \
                unittest.mock.patch.object(server, "_kakdr_memo", (0.0, None)):
            r = server.kakdr_screen()
        self.assertEqual([x["t"] for x in r["rows"]], ["AAAA"])
        self.assertEqual(r["rows"][0]["skor"], 10.0)
        self.assertTrue(all(r["rows"][0]["lolos"].values()))


class PovAhTest(unittest.TestCase):
    """povah.analisa: portofolio AH (pribadi, lewat PT indikasi, kurasi), rekan pemegang, dan screening saham beredar sedikit."""

    def test_analisa(self):
        import povah
        cfg = {"polaNama": ["ANDRY HAKIM"], "entitas": [{"nama": "HAKIMSON GROWTH CAPITAL", "status": "indikasi", "ket": "x"}],
               "tambahan": [{"t": "SOTS", "status": "indikasi", "ket": "kurasi"}],
               "sahamSedikit": {"sumber": "s", "data": {"UNIT": [75420000, 316]}},
               "riwayat": [{"t": "RMKO", "status": "keluar dari ≥1%", "ket": "2,4%", "sumber": [{"url": "u"}]}, {"t": "AIMS", "ket": "catatan AIMS"}]}
        pidx = {"AIMS": {"pemegang": [["AIMS INDO INVESTAMA", 35.75, "INDONESIA", "Corporate"], ["DELTA WIBAWA BERSAMA", 31.13, "INDONESIA", "Corporate"],
                                      ["ANDRY HAKIM", 1.05, "INDONESIA", "Individual"]], "jumlah": [["2026-10-31", 1811], ["2026-07-31", 1666]]},
                "FLMC": {"pemegang": [["DELTA WIBAWA BERSAMA", 3.84, "INDONESIA", "Corporate"], ["ANDRY HAKIM", 1.13, "INDONESIA", "Individual"]]},
                "TRUK": {"pemegang": [["HAKIMSON GROWTH CAPITAL", 5.01, "INDONESIA", "Corporate"]]},
                "ZZZZ": {"pemegang": [["DELTA WIBAWA BERSAMA", 2.0, "INDONESIA", "Corporate"]], "jumlah": [["2026-10-31", 800], ["2026-09-30", 900],
                                                                                                  ["2026-08-31", 950], ["2026-07-31", 1000]]},
                "BESR": {"pemegang": []}}
        ks = {"AIMS": {"saham": 220e6, "freeFloat": 22.07, "hargaKira": 940, "kuartal": {"Net Income": {"Q126": -375e6, "Q226": -90e6}}},
              "FLMC": {"saham": 781.25e6, "freeFloat": 49.64, "hargaKira": 160}, "TRUK": {"saham": 435e6, "freeFloat": 29.82, "hargaKira": 6025},
              "SOTS": {"saham": 1e9, "freeFloat": 20.18, "hargaKira": 530},
              "ZZZZ": {"saham": 300e6, "freeFloat": 10.0, "hargaKira": 100}, "RMKO": {"saham": 300e6, "freeFloat": 10.0, "hargaKira": 100},
              "ASBI": {"saham": None, "freeFloat": 14.73, "mcap": 137e9},           # jumlah saham kosong: diturunkan dari mcap / harga
              "PLAS": {"saham": 1.18e9, "freeFloat": None, "hargaKira": 50},          # free float kosong -> tanpaFF (Key Stats)
              "XCLQ": {"saham": 106e6, "freeFloat": 10.0, "hargaKira": 100},          # ETF: diabaikan
              "BESR": {"saham": 9e9, "freeFloat": 10.0, "hargaKira": 100}}
        r = povah.analisa(cfg, pidx, ks, {"AIMS": {"h": 1175}, "ASBI": {"h": 394}}, {}, {"ZZZZ"})
        porto = {x["t"]: x for x in r["portofolio"]}
        self.assertEqual(set(porto), {"AIMS", "FLMC", "TRUK", "SOTS"})
        self.assertEqual(porto["TRUK"]["jalur"][0]["status"], "indikasi")
        self.assertEqual(porto["SOTS"]["jalur"][0]["jenis"], "kurasi")
        self.assertEqual(porto["AIMS"]["harga"], 1175)                      # harga terbaru menang atas perkiraan Key Stats
        self.assertEqual(porto["AIMS"]["laba"], [["Q126", -375e6], ["Q226", -90e6]])
        self.assertEqual(r["rekan"], [{"nama": "DELTA WIBAWA BERSAMA", "di": ["AIMS", "FLMC"]}])
        self.assertEqual([x["t"] for x in r["rows"]], ["ZZZZ", "ASBI"])      # BESR: saham beredar terlalu banyak; XCLQ: ETF
        a = r["rows"][1]
        self.assertTrue(a["sahamKira"])
        self.assertEqual(a["saham"], round(137e9 / 394))
        self.assertIn("perkiraan", a["ringkas"][0])
        x = r["rows"][0]
        self.assertEqual(x["skor"], 100)                                     # 30 + 25 + 20 + 10 (pemegang -20%) + 15 (rekan)
        self.assertTrue(x["radar"])
        self.assertEqual(x["tren"]["ubah"], -20.0)
        self.assertIn("akumulasi", x["ringkas"][1])
        self.assertEqual([(y["t"], y["asal"]) for y in r["tanpaFF"]], [("UNIT", "s"), ("PLAS", "Key Stats Stockbit")])
        self.assertEqual(r["kurangData"], ["PLAS"])
        # Riwayat: yang tidak di portofolio kini tampil di "pernah" (bukan screening); yang masih dipegang menempel di portofolio.
        self.assertEqual([(y["t"], y["status"]) for y in r["pernah"]], [("RMKO", "keluar dari ≥1%")])
        self.assertEqual(r["pernah"][0]["saham"], 300e6)
        self.assertEqual(porto["AIMS"]["riwayat"]["ket"], "catatan AIMS")


class PovAhIsiTest(unittest.TestCase):
    """Hasil POV AH dari memo tetap memicu pengisian status di latar untuk permintaan internal, tidak untuk publik."""

    def test_memo_tetap_memicu_isi(self):
        from unittest import mock
        lama = (server._ah_memo, server._ah_belum)
        try:
            server._ah_memo, server._ah_belum = (time.time(), {"rows": []}), ["CNTB"]
            with mock.patch.object(server, "ah_isi_status") as isi, mock.patch.object(server, "get_token", return_value="t"),                     mock.patch.object(server, "token_expired", return_value=False):
                with mock.patch.object(server, "is_public_request", return_value=True):
                    self.assertEqual(server.ah_screen(), {"rows": []})
                isi.assert_not_called()
                with mock.patch.object(server, "is_public_request", return_value=False):
                    self.assertEqual(server.ah_screen(), {"rows": []})
                    time.sleep(0.05)
                isi.assert_called_once_with(["CNTB"])
        finally:
            server._ah_memo, server._ah_belum = lama


class PovDalamTest(unittest.TestCase):
    """povdalam.analyze: contoh AKPI (pendiri 95,72%, jaringan Risjad/Henry Pribadi, posting komunitas)."""

    def data(self):
        from datetime import datetime
        return {"t": "AKPI", "nama": "Argha Karya Prima Industry", "profil": {
            "sector": "Barang Baku", "industry": "Wadah & Kemasan", "stats": {"freeFloat": 4.28, "marketCap": 1e12},
            "metrics": {"pbv": 0.2}, "beneficiary": [], "directors": ["Dina Risjad (Direktur Utama)"], "commissioners": [],
            "shareholders": [{"name": "PT Tiara Intimahkota", "pct": "36.11", "pengendali": True}],
            "holders1": [{"name": "Prismatama Nugraha PT", "pct": 27.28}, {"name": "Nawa Panduta, PT", "pct": 15.05},
                         {"name": "PT Gitanirwana Mandrasakti", "pct": 4.19}, {"name": "Dina Risjad", "pct": 1.70},
                         {"name": "Masyarakat", "pct": 4.28}], "chart": [{"d": "2026-11-03", "v": 510}]},
            "insider": [{"date": "2026-10-01", "name": "Nawa Panduta, PT", "prev": 10, "cur": 15.05, "chg": 5.05, "role": "", "value": 1e9}],
            "jaringan": {"Nawa Panduta, PT": [{"symbol": "LSIP", "pct": 2.1, "since": "2010-01-01"}, {"symbol": "SCMA", "pct": 1.5}],
                         "PT Tiara Intimahkota": [{"symbol": "LSIP", "pct": 1.2}]},
            "laporan": [{"date": "2026-10-20", "title": "Rencana penambahan modal HMETD", "jenis": ["rights"], "inti": "", "url": "u"}],
            "posts": [{"user": "athira", "d": "2026-10-22", "likes": 40, "url": "p",
                       "txt": "$AKPI Saat ini pak henry pribadi, pak risjad dan pak henry liem ada di akpi lewat napan (nawa panduta). "
                              "Pak henry pribadi bersama pak risjad dulu akuisisi $LSIP. Pendiri dan keluarga 95,72% free float. "
                              "Henry Liem melalui PT Gitanirwana Mandrasakti masih menjual, tersisa 26 juta lembar."}],
            "lk": {"kuartal": {"tumbuh": True, "q": 3}}}, datetime(2026, 11, 3)

    def test_analisa(self):
        import povdalam
        d, kini = self.data()
        r = povdalam.analyze(d, kini)
        self.assertAlmostEqual(r["kepemilikan"]["nonPublik"], 80.14, places=2)   # >=5% + pengurus (Dina Risjad)
        self.assertEqual(r["kepemilikan"]["pemegang"][4]["pengurus"], "Dina Risjad")
        self.assertEqual(r["bersama"][0]["t"], "LSIP")                      # dimiliki dua pemegang AKPI
        judul = " | ".join(g["judul"] for g in r["dugaan"])
        self.assertIn("free float", judul.lower())
        self.assertIn("jaringan", judul.lower())
        self.assertIn("HMETD", " ".join(b for g in r["dugaan"] for b in g["bukti"]))
        nama = {e["nama"]: e["terverifikasi"] for e in r["komunitas"]["nama"]}
        self.assertIn("Henry Pribadi", nama)
        self.assertEqual(r["komunitas"]["terkait"][0]["t"], "LSIP")
        rel = r["komunitas"]["relasi"]
        self.assertTrue(any(x["orang"] == "Henry Liem" and "GITANIRWANA" in x["badan"] and x["terverifikasi"] for x in rel), rel)
        self.assertTrue(any("26 juta lembar" in c["teks"] for c in r["komunitas"]["klaim"]))

    def test_cek_klaim(self):
        import povdalam
        from datetime import datetime
        d = {"t": "PTIS", "nama": "", "profil": {"stats": {"freeFloat": 9.0}, "metrics": {"pbv": 0.4, "bvps": 1500},
             "shareholders": [{"name": "PT Anugerah Salim Investama", "pct": "60"}], "holders1": [], "chart": [{"v": 500}]},
             "posts": [{"user": "PMFernandoR", "d": "2026-10-21", "likes": 9, "url": "u", "txt":
                        "Maybe next $PTIS, 1000% saya yakin ini sahamnya punya konglo itu. Alasan beli: 1. Ada 2 Konglo Tier 1 di sini. "
                        "2. Saham gak liquid/gorengan tapi valuasi murah. 3. Valuasi wajarnya di 3x harga sekarang."}]}
        r = povdalam.analyze(d, datetime(2026, 11, 3))
        st = {c["jenis"]: c["status"] for c in r["klaim"]}
        self.assertEqual(st["konglo"], "didukung data")      # pemegang bernama Salim
        self.assertNotIn("murah", st)                         # valuasi (fundamental) tidak dicek lagi
        self.assertEqual(st["likuid"], "didukung data")      # free float efektif 40% tidak, tetapi ff 9% < 10
        self.assertNotIn("fokusPosts", r["komunitas"])

    def test_arah_pengendali(self):
        import povarah
        bm = povarah.bandarmologi({30: {"bandar": 2e9, "akum": ["YP", "PD"], "dist": ["MG"], "avgAkum": 480, "konsentrasi": 70, "asing": 0},
                                   90: {"bandar": 5e9, "akum": ["YP"], "dist": ["KK"], "avgAkum": 450, "konsentrasi": 55, "asing": 0}},
                                  [{"d": "2026-01-01", "c": 500, "v": 1}] * 100, 500)
        self.assertIn("akumulasi diam-diam", bm["fase"][0]["arti"])
        self.assertTrue(any("YP" in x for x in bm["catatan"]))
        a = povarah.arah({"ff": 4.3, "ffEfektif": 4.3, "afiliasi": 95.7, "insiderJual": [1], "habisBulan": True, "bandar": bm})
        self.assertEqual(a["skenario"][0]["nama"], "Distribusi untuk memenuhi free float / menjual ke publik")
        t = povarah.target_harga({"harga": 500, "bvps": 3160, "high52": 800})
        self.assertEqual([x["harga"] for x in t], [3160])          # tanpa titik teknikal 52 minggu
        self.assertEqual(t[0]["potensi"], 532.0)

    def test_afiliasi_dan_market_maker(self):
        import povarah
        pm = [{"name": "PT RELIFE PROPERTY", "pct": 19.44}, {"name": "PT RELIFE REALTY INDONESIA", "pct": 9.43},
              {"name": "GHOFAR ROZAQ NAZILA", "pct": 10.77, "pengurus": "GHOFAR ROZAQ NAZILA"}]
        ins = [{"date": "2026-03-10", "name": n, "prev": 0, "cur": c, "broker": "IU"} for n, c in
               (("RELIFE PROPERTY", 19.44), ("RELIFE REALTY INDONESIA", 9.43), ("GHOFAR ROZAQ NAZILA", 10.77))]
        a = povarah.afiliasi(pm, ins, [], [])
        jenis = {k["jenis"] for k in a["kelompok"]}
        self.assertTrue({"nama mirip", "bergerak bersamaan", "pemegang = pengurus"} <= jenis, jenis)
        mm = povarah.market_maker(ins, {"fase": [{"periode": "1 bulan", "akum": ["IU"], "dist": []}]})
        self.assertIn("kemungkinan broker", mm[0])
        # Tanda umum saja (pemain baru, kapitalisasi kecil) bernilai kecil; tanda inti menaikkan skor tajam.
        self.assertLess(povarah.potensi_backdoor({"pemainBaru": [1], "mcap": 1.5e11})["skor"], 15)
        bd = povarah.potensi_backdoor({"masukBersama": [1], "jejakCangkang": [1], "batas12": "2026-01-01",
                                       "ambil": [{"date": "2026-10-01"}], "pemainBaru": [1], "mcap": 1.5e11})
        self.assertGreaterEqual(bd["skor"], 70)
        self.assertFalse(povarah.bukan_kustodian("UOB KAY HIAN PRIVATE LIMITED"))

    def test_pemegang_ganda_dan_keluarga(self):
        import povdalam
        from datetime import datetime
        d = {"t": "XXXX", "profil": {"stats": {}, "metrics": {},
             "shareholders": [{"name": "STRAITS CORPORATION PTE. LTD.", "pct": "81.82", "pengendali": True}],
             "holders1": [{"name": "Straits Corporation Pte Ltd", "pct": 81.82}, {"name": "AMIRSYAH RISJAD", "pct": 1.7},
                          {"name": "DINA RISJAD", "pct": 1.7}, {"name": "DEDEY RISJAD", "pct": 1.7}]}}
        r = povdalam.analyze(d, datetime(2026, 11, 4))
        self.assertEqual(len(r["kepemilikan"]["pemegang"]), 4)                    # Straits sekali, 3 Risjad
        self.assertEqual(r["kepemilikan"]["keluarga"][0]["anggota"].__len__(), 3)
        self.assertLessEqual(r["kepemilikan"]["nonPublik"], 100)

    def test_pertanyaan_dan_pemindai(self):
        import povdalam, povpindai
        from datetime import datetime
        d, k = self.data()
        d["insider"].append({"date": "2026-10-01", "name": "PT Tiara Intimahkota", "prev": 30, "cur": 36.11, "chg": 6.11, "broker": "YP", "purpose": "Investasi"})
        d["brokers"] = {5: {"bandar": 1e9, "akum": ["YP"], "dist": ["MG"], "avgAkum": 480}, 30: {"bandar": -2e9, "akum": ["PD"], "dist": ["MG"], "avgAkum": 480}}
        h = povdalam.analyze(d, k)
        q = {x["q"][:20]: x["a"] for x in h["pertanyaan"]}
        self.assertIn("Belum tampak selesai", q["Apakah pembelian sud"])
        self.assertIn("tidak tercatat", q["Apakah masih ada dis"])
        h["radar"] = True
        rows = {"AKPI": povpindai.baris(h, k)}
        self.assertEqual(rows["AKPI"]["t"], "AKPI")
        feed = [{"date": "2026-11-03", "name": "PT NAWA PANDUTA", "ticker": "ZZZZ", "prev": 0, "cur": 9.5}]
        al = povpindai.alarm_penjual({"Nawa Panduta, PT": [{"t": "NAYZ", "tgl": "2026-08-19", "dari": "AKPI"}]}, feed)
        self.assertEqual(al[0]["t"], "ZZZZ")
        self.assertIn("RINGKASAN", povpindai.ringkasan(rows, {"AKPI": 0}, al)["teks"])

    def test_masuk_terverifikasi(self):
        import povdalam
        from datetime import datetime
        ins = [{"date": "2026-09-11", "name": "ENAM BERLIAN SINERGI", "prev": 0, "cur": 46.72, "chg": 46.72, "source": "KSEI"},
               {"date": "2026-09-17", "name": "ENAM BERLIAN SINERGI", "prev": 46.72, "cur": 45.22, "chg": -1.5, "source": "IDX"},
               {"date": "2026-10-23", "name": "CENTRAL ENERGI PRATAMA", "prev": 0, "cur": 49.73, "source": "IDX"}]
        r = povdalam._riwayat(ins, datetime(2026, 11, 4))
        enam = next(x for x in r if x["nama"].startswith("ENAM"))
        self.assertTrue(enam.get("pertama"))
        self.assertIsNone(enam["lewat"])                                          # bukan pengendali baru
        cep = next(x for x in r if x["nama"].startswith("CENTRAL"))
        self.assertEqual(cep["lewat"], 20)                                        # masuk baru terverifikasi IDX
        ins180 = {x["nama"]: x for x in povdalam._insider180(ins, datetime(2026, 11, 4))}
        self.assertLess(ins180["ENAM BERLIAN SINERGI"]["chg"], 0)               # penjualan, bukan pembelian +46%
        self.assertIn("scripless", enam["teks"])
        import povarah
        bd = povarah.potensi_backdoor({"konversi": ["2026-09-11: ENAM BERLIAN SINERGI 46.72%"]})
        self.assertTrue(any("scripless" in b for b in bd["bukti"]))

    def test_keluarga(self):
        import povdalam
        pm = [{"name": n, "pct": 1.7} for n in ("AMIRSYAH RISJAD", "DINA RISJAD", "DEDEY RISJAD", "SELVIYA RISJAD DANANTO")]
        pm.append({"name": "PT NAWA PANDUTA", "pct": 15.05})
        k = povdalam.keluarga(pm)
        self.assertEqual((k[0]["nama"], len(k[0]["anggota"]), k[0]["pct"]), ("Risjad", 4, 6.8))
        self.assertEqual(povdalam.nama_disebut("pak komisaris aris bilang"), [])

    def test_nama_disebut(self):
        import povdalam
        self.assertEqual(povdalam.nama_disebut("pak djuhar sutanto dan pak ibrahim risjad yg tergabung"),
                         ["Djuhar Sutanto", "Ibrahim Risjad"])


class JadwalTerlewatTest(unittest.TestCase):
    def test_terlewat(self):
        import os
        from datetime import datetime, timezone
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.json"
            p.write_text("{}")
            t = datetime(2026, 11, 1, 17, 21, tzinfo=timezone.utc).timestamp()   # Senin 2 Nov 00.21 WIB
            os.utime(p, (t, t))
            self.assertTrue(server.jadwal_terlewat(p, datetime(2026, 11, 3, 9, 0, tzinfo=timezone.utc)))    # 3 Nov 16.00 WIB
            self.assertFalse(server.jadwal_terlewat(p, datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)))   # 2 Nov 16.00 WIB


class Saham50TambahTest(unittest.TestCase):
    def test_riwayat_skor(self):
        from datetime import date
        with tempfile.TemporaryDirectory() as d, unittest.mock.patch.object(server, "S50_RIWAYAT_PATH", Path(d) / "r.json"):
            server.s50_riwayat([{"t": "PURA", "skor": 30}], date(2026, 10, 27))
            rows = [{"t": "PURA", "skor": 43}, {"t": "BARU", "skor": 10}]
            server.s50_riwayat(rows, date(2026, 11, 3))
            self.assertEqual((rows[0]["skorLalu"], rows[0]["skorTgl"]), (30, "2026-10-27"))
            self.assertNotIn("skorLalu", rows[1])

    def test_broker_per_saham(self):
        resp = {"data": {"broker_summary": {
            "brokers_buy": [{"netbs_broker_code": "YP", "bval": "500000000"}, {"netbs_broker_code": "PD", "bval": "100000000"}],
            "brokers_sell": [{"netbs_broker_code": "CC", "sval": "-2e+08"}]}}}
        b = server.s50_broker_parse(resp)
        self.assertEqual((b["bandar"], b["akum"], b["dist"]), (400000000, ["YP", "PD"], ["CC"]))
        self.assertIsNone(server.s50_broker_parse({"data": {}}))

    def test_broker(self):
        data = {"tahun": "2026", "broker": {
            "YP": {"jenis": "Lokal", "bulan": {"10": {"beli": [{"s": "PURA", "val": 5e8, "lot": 100}], "jual": []}}},
            "CC": {"jenis": "Lokal", "bulan": {"10": {"beli": [], "jual": [{"s": "PURA", "val": -1e8, "lot": 20}]}}}}}
        with unittest.mock.patch.object(server, "broker_data", return_value=data):
            b = server.s50_broker({"PURA"})["PURA"]
        self.assertEqual(b[-1]["bulan"], 10)
        self.assertEqual(b[-1]["akum"], ["YP"])
        self.assertGreater(b[-1]["bandar"], 0)


class Saham50Test(unittest.TestCase):
    def test_teknikal(self):
        # 80 hari turun dari 60 ke 41, lalu naik ke 45: di atas EMA20, resistance 60 hari di atas harga.
        px = [{"d": f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", "v": 60 - i * 0.25} for i in range(77)]
        px += [{"d": "2026-03-25", "v": 43}, {"d": "2026-03-26", "v": 44}, {"d": "2026-03-27", "v": 45}]
        t = server.s50_teknikal(px)
        self.assertEqual(t["harga"], 45)
        self.assertEqual(t["rendah52"], 41.0)
        self.assertGreater(t["resistance"], 45)
        self.assertGreater(t["potensiTeknikal"], 0)
        self.assertFalse(t["datar"])
        self.assertIsNone(server.s50_teknikal(px[:10]))


class RamalanBuktiTest(unittest.TestCase):
    def test_ramalan_jatuh_tempo_dan_arah(self):
        bars = [{"d": f"2026-10-{i:02d}", "c": 5000 + i * 10} for i in range(1, 31)]
        log = {"2026-10-01": {"tanggal": "2026-10-01", "harga": 5010, "ts": {"1": 5030, "5": 4990, "21": 5200}, "astro": {"bias": "naik"}}}
        r = server.ramalan_api(log, bars)
        self.assertEqual(r["ts"]["ringkas"]["1"]["arahTepat"], 100)   # ramalan naik, aktual naik
        self.assertEqual(r["ts"]["ringkas"]["5"]["arahTepat"], 0)     # ramalan turun, aktual naik
        self.assertTrue(r["astro"]["baris"][0]["arahTepat"])

    def test_bukti_tanpa_melihat_tahun_berjalan(self):
        from datetime import date
        naik10 = {str(y): {"10": 1.0} for y in range(2016, 2026)}
        data = {"stock": {"BBBB": {"s": {**naik10, "2026": {"10": -3.0}}}}, "index": {}}
        r = server.season_bukti(None, data, date(2026, 11, 2))
        self.assertEqual((r["bulan"], r["tahun"]), (10, 2026))
        self.assertEqual(r["pilihan"][0]["prob"], 100)                # dihitung dari 2016-2025 saja
        self.assertFalse(r["pilihan"][0]["terbukti"])


class TsaSummaryTest(unittest.TestCase):
    """Data intel pasar tradersaham: helper tsa_summary (tanpa HTTP)."""

    def test_10_helper_known_and_unknown(self):
        s = server.tsa_summary("ASPI")
        self.assertTrue(s["ada"])
        self.assertEqual(s["ticker"], "ASPI")
        self.assertIn("regimeSignal", s["signals"])
        self.assertFalse(server.tsa_summary("ZZZZ")["ada"])


class TsaTokenTest(unittest.TestCase):
    def test_bearer_file_like_stockbit(self):
        import base64, tsa_refresh as tr
        def jwt(exp):
            body = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
            return f"h.{body}.s"
        with tempfile.TemporaryDirectory() as d:
            tr.BEARER_FILE, tr.CACHE_FILE, tr.REFRESH_FILE = (Path(d) / n for n in (".t", ".c", ".r"))
            tr.CREDS_FILE = Path(d) / ".creds"
            fresh = jwt(time.time() + 3600)
            tr.BEARER_FILE.write_text("\ufeffBearer " + fresh)       # BOM + prefix "Bearer " tetap terbaca
            self.assertEqual(tr.get_token(), fresh)
            tr.BEARER_FILE.write_text(jwt(time.time() - 10))       # kedaluwarsa, tanpa cadangan = berhenti
            with self.assertRaises(SystemExit):
                tr.get_token()


class RekomendasiTest(unittest.TestCase):
    """Rekomendasi harian: gabungan screening + backdoor, batas harga, minimal dua sumber, dan simpanan per hari."""

    def test_periksa_mandiri(self):
        """Baris dengan angka tidak konsisten atau klaim backdoor tanpa item terkonfirmasi tidak lolos."""
        import rekomendasi as RK
        plan = {"entry": 100, "stop": 90, "tp1": 115, "tp2": 140, "tp1Ket": "resistance", "tp2Ket": "resistance",
                "rr": 1.5, "naik1": 15.0, "naik2": 40.0, "turunStop": -10.0}
        baik = {"t": "AAAA", "harga": 100, "skor": 40, "jumlahSumber": 2, "alasan": ["Pola Bat."], "plan": plan}
        self.assertEqual(RK.periksa(baik, 2000), [])
        self.assertTrue(RK.periksa({**baik, "plan": {**plan, "tp1": 105, "naik1": 5.0, "rr": 0.5}}, 2000))   # target 1 < 10%
        self.assertTrue(RK.periksa({**baik, "plan": {**plan, "tp2": 110}}, 2000))                            # tp2 < tp1
        self.assertTrue(RK.periksa({**baik, "plan": {**plan, "tp1Ket": ""}}, 2000))                         # asal target kosong
        klaim = {**baik, "alasan": ["Di Monitor backdoor tercatat tender offer Rp56 periode 9 Nov–8 Des."]}
        self.assertTrue(RK.periksa(klaim, 2000, {"AAAA": {"ticker": "AAAA", "autoJenis": "rencana"}}))
        self.assertTrue(RK.periksa(klaim, 2000, {"AAAA": {"ticker": "AAAA", "tender": {"price": 60}}}))
        self.assertEqual(RK.periksa(klaim, 2000, {"AAAA": {"ticker": "AAAA", "tender": {"price": 56}}}), [])

    def src(self):
        import rekomendasi as RK  # noqa: F401
        return {
            "bulan": 11,
            "harga": {"AAAA": {"h": 500}, "BBBB": {"h": 1200}, "CCCC": {"h": 2500}, "DDDD": {"h": 300}, "EEEE": {"h": 800}, "FFFF": {"h": 900}},
            "nama": {"AAAA": "Alfa Tbk.", "BBBB": "Beta Tbk."},
            "harmonik": [
                {"t": "AAAA", "pola": "gartley", "nama": "Gartley", "arah": "bullish", "status": "prz", "harga": 500, "prz": [480, 505],
                 "target": [560, 600], "targetCA": [650, 700], "stop": 470},
                {"t": "FFFF", "pola": "bat", "nama": "Bat", "arah": "bearish", "status": "prz", "harga": 900, "prz": [890, 930]},
                {"t": "CCCC", "pola": "crab", "nama": "Crab", "arah": "bullish", "status": "berbalik", "harga": 2500, "prz": [2400, 2450],
                 "target": [2700, 2900], "stop": 2300},
            ],
            "recovery": [{"t": "AAAA", "skor": 80, "status": "Mulai pulih", "tek": {"turun": -60}, "dukung": ["Seasonality"], "alasan": ["Turun 60% dari puncak 52 minggu", "Teknikal: RSI naik dari jenuh jual"]},
                         {"t": "CCCC", "skor": 90, "status": "Siap rebound", "tek": {"turun": -50}},
                         {"t": "FFFF", "skor": 90, "status": "Siap rebound", "plan": {"entry": [880, 900], "sl": 820, "tp1": 1000, "tp2": 1200}},
                         {"t": "BBBB", "skor": 60, "status": "Mulai pulih", "alasan": ["Turun 40% dari puncak"],
                          "plan": {"entry": [1150, 1200], "sl": 1080, "tp1": 1350, "tp2": 1600}},
                         {"t": "EEEE", "skor": 70, "status": "Pantau"}],
            "broker": {"bulan": 11, "akumulasi": [{"s": "AAAA", "bandar": 5e9}, {"s": "BBBB", "bandar": 1e9}], "distribusi": [{"s": "DDDD", "bandar": -2e9}]},
            "lk": [{"t": "BBBB", "kategori": "bagus", "periode": "9M26", "laba": {"pct": 40}}, {"t": "FFFF", "kategori": "berbalik", "periode": "9M26"}, {"t": "DDDD", "kategori": "berbalik", "periode": "9M26"},
                   {"t": "EEEE", "kategori": "naik", "periode": "9M26"}],
            "items": [{"ticker": "BBBB", "stage": "spa", "ms": {"spa": True}}, {"ticker": "DDDD", "stage": "radar", "flags": {"rights": True}}],
            "backdoor_pd": {"EEEE": 30},
            "sikap": {"DDDD": "Hindari"},
            "hsc": ["BBBB"],
        }

    def test_skor_alasan_dan_filter(self):
        import rekomendasi as RK
        r = RK.nilai(self.src(), 2000, 10)
        kode = [x["t"] for x in r["rows"]]
        self.assertNotIn("CCCC", kode)               # harga 2.500 di atas batas
        self.assertNotIn("EEEE", kode)               # hanya satu sumber (Recovery "Pantau" tidak dihitung)
        self.assertEqual(kode[0], "AAAA")            # Harmonic di PRZ + Recovery + akumulasi broker
        a = r["rows"][0]
        self.assertEqual(a["peringkat"], 1)
        self.assertEqual(set(a["komponen"]), {"Harmonic Pattern", "Recovery", "Pola Broker"})
        self.assertTrue(any("Gartley bullish" in x for x in a["alasan"]))
        self.assertTrue(any("RSI naik" in x for x in a["alasan"]))
        self.assertEqual(a["plan"]["sumber"], "Harmonic Gartley")
        self.assertEqual((a["plan"]["tp1"], a["plan"]["tp2"]), (560, 650))     # target 1 +12%, target 2 +30% (target lanjutan)
        self.assertEqual((a["plan"]["naik1"], a["plan"]["naik2"]), (12.0, 30.0))
        self.assertIn("lanjutan", a["plan"]["tp2Ket"])
        self.assertAlmostEqual(a["plan"]["rr"], 2.0)
        self.assertNotIn("BBBB", kode)                # saham HSC dipisah dari daftar Non HSC
        self.assertEqual([x["t"] for x in r["hsc"]], ["BBBB"])
        self.assertEqual(r["hsc"][0]["peringkat"], 1)
        self.assertTrue(r["hsc"][0]["hsc"])
        self.assertFalse(a["hsc"])
        self.assertEqual(r["lolosHsc"], 1)
        b = r["hsc"][0]
        self.assertTrue(any("SPA" in x for x in b["alasan"]))
        self.assertEqual(b["skor"], round(sum(b["komponen"].values()), 1))
        self.assertNotIn("FFFF", kode)                # pola bearish aktif di PRZ: tidak direkomendasikan
        self.assertNotIn("DDDD", kode)                # tanpa rencana yang memenuhi syarat target

    def test_pantauan(self):
        """Saham berpotensi yang tidak masuk daftar utama tetap tampil di Pantauan beserta sebabnya; yang lolos semua
        syarat tetapi di luar jumlah daftar utama menjadi cadangan."""
        import rekomendasi as RK
        src = self.src()
        r = RK.nilai(src, 2000, 10)
        p = {x["t"]: x for x in r["pantauan"]}
        self.assertIn("bearish", p["FFFF"]["sebab"])                  # skor tinggi tetapi pola bearish aktif
        self.assertIn("di bawah syarat 20", p["DDDD"]["sebab"])       # sinyal laporan keuangan kuat, skor kurang
        self.assertNotIn("CCCC", p)                                   # di atas batas harga
        self.assertNotIn("AAAA", p)                                   # sudah di daftar utama
        # Satu saham per kelompok: AAAA tetap utama, sisanya cadangan dengan rencana lengkap.
        src["harga"]["GGGG"] = {"h": 400}
        src["recovery"].append({"t": "GGGG", "skor": 90, "status": "Mulai pulih", "plan": {"entry": [390, 400], "sl": 370, "tp1": 450, "tp2": 520}})
        src["broker"]["akumulasi"].append({"s": "GGGG", "bandar": 1e9})
        r = RK.nilai(src, 2000, 1)
        cad = [x for x in r["pantauan"] if x["jenis"] == "cadangan"]
        self.assertEqual([x["t"] for x in r["rows"]], ["AAAA"])
        self.assertEqual([x["t"] for x in cad], ["GGGG"])
        self.assertEqual(cad[0]["plan"]["tp1"], 450)
        self.assertEqual(r["pantauan"][0]["jenis"], "cadangan")       # cadangan di urutan pertama
        # Kuota per jenis: banyak cadangan tidak menyingkirkan saham "belum masuk".
        import unittest.mock as um
        with um.patch.object(RK, "PANTAU_MAKS", 1):
            r = RK.nilai(src, 2000, 0)
        jenis = [(x["hsc"], x["jenis"]) for x in r["pantauan"]]
        self.assertEqual(jenis.count((False, "cadangan")), 1)
        self.assertIn((False, "belum"), jenis)

    def test_rencana_support_resistance(self):
        """Saham berskor tinggi tanpa pola/recovery tetap dapat rencana dari chart: stop di terendah 5 hari, atau terendah
        20 hari bila harga sedang di terendah 5 hari; target dari puncak sebelumnya."""
        import rekomendasi as RK
        src = {"harga": {"HHHH": {"h": 100}}, "lk": [{"t": "HHHH", "kategori": "berbalik", "periode": "9M26"}],
               "broker": {"bulan": 11, "akumulasi": [{"s": "HHHH", "bandar": 1e9}]},
               "momentum": {"HHHH": {"vol": 1.0, "volTgl": None, "breakout": None, "atas60": False, "breakdown": None,
                                     "res": [[115, "2026-09-01"], [130, "2026-06-01"]], "l5": 100, "l20": 93, "c": 100}}}
        r = RK.nilai(src, 2000, 5)
        plan = r["rows"][0]["plan"]
        self.assertEqual((plan["entry"], plan["stop"], plan["tp1"], plan["tp2"]), (100, 93, 115, 130))
        self.assertEqual(plan["sumber"], "Support-resistance chart (stop di terendah 20 hari)")
        # Tanpa level target 10-20%: masuk Pantauan dengan sebabnya.
        src["momentum"]["HHHH"]["res"] = [[130, "2026-06-01"]]
        r = RK.nilai(src, 2000, 5)
        self.assertEqual(r["rows"], [])
        self.assertIn("tidak ada level target 1 naik 10–20%", r["pantauan"][0]["sebab"])
        # Persen stop satu desimal: 15,4% tidak tampil sebagai "turun 15%, lebih dari 15%".
        src["momentum"]["HHHH"].update({"res": [[115, "2026-09-01"], [130, "2026-06-01"]], "l5": 84.6, "l20": 84.6})
        r = RK.nilai(src, 2000, 5)
        self.assertIn("turun 15,4% dari entry, lebih dari 15%", r["pantauan"][0]["sebab"])

    def test_rencana_harus_masuk_akal(self):
        """Kasus DSSA: pola bullish sudah berbalik dan harga di atas kedua target. Rencana dari pola itu tidak dipakai
        (target di bawah entry), poin harmonik kecil, dan rencana diambil dari sumber lain bila ada."""
        import rekomendasi as RK
        src = {"harga": {"DSSA": {"h": 720}}, "bulan": 11,
               "harmonik": [{"t": "DSSA", "pola": "tigadorongan", "nama": "Three Drives", "arah": "bullish", "status": "berbalik", "harga": 720,
                             "prz": [560, 590], "target": [655, 710], "stop": 574}],
               "recovery": [{"t": "DSSA", "skor": 80, "status": "Mulai pulih", "alasan": ["Turun 50% dari puncak"],
                             "plan": {"entry": [690, 715], "sl": 640, "tp1": 820, "tp2": 900}}],
               "lk": [{"t": "DSSA", "kategori": "bagus", "periode": "9M26", "laba": {"pct": 30}}]}
        r = RK.nilai(src, 2000, 10)["rows"][0]
        self.assertEqual(r["komponen"]["Harmonic Pattern"], 5)
        self.assertTrue(any("melewati target pertama" in x for x in r["alasan"]))
        self.assertEqual(r["plan"]["sumber"], "Recovery")
        self.assertLess(r["plan"]["stop"], r["plan"]["entry"])
        self.assertLess(r["plan"]["entry"], r["plan"]["tp1"])
        self.assertEqual((r["plan"]["tp1"], r["plan"]["tp2"]), (820, 900))
        src.pop("recovery")
        src["seasonality"] = [{"t": "DSSA", "prob": 70, "skor": 60, "up": 7, "n": 10}]
        self.assertEqual(RK.nilai(src, 2000, 10)["rows"], [])   # tanpa rencana yang masuk akal: tidak direkomendasikan

    def test_syarat_target_dan_stop(self):
        """Kasus MINA: target 1 hanya +1,3% dan stop -26%: ditolak. Target dari sumber lain dipakai bila sumber utama
        tidak punya level yang memenuhi, dengan keterangan asalnya."""
        import rekomendasi as RK
        base = {"harga": {"MINA": {"h": 157}}, "lk": [{"t": "MINA", "kategori": "berbalik", "periode": "9M26"}],
                "harmonik": [{"t": "MINA", "pola": "tigadorongan", "nama": "Three Drives", "arah": "bullish", "status": "berbalik",
                              "harga": 157, "prz": [116, 117], "target": [159, 185], "stop": 116}]}
        self.assertEqual(RK.nilai(base, 2000, 10)["rows"], [])
        base["seasonality"] = [{"t": "MINA", "prob": 71, "skor": 48, "up": 5, "n": 7,
                                "plan": {"entry": [150, 157], "sl": 138, "tp1": 220, "tp2": 238}}]
        r = RK.nilai(base, 2000, 10)["rows"][0]["plan"]
        self.assertEqual(r["sumber"], "Seasonality")
        self.assertEqual(r["tp1"], 159 + 26)                     # 185 (+17,8%) dari level pola harmonik
        self.assertIn("Three Drives", r["tp1Ket"])
        self.assertEqual(r["tp2"], 220)                          # +40% dari target Seasonality
        self.assertLessEqual(-r["turunStop"], RK.STOP_MAKS)

    def test_momentum_dan_broksum(self):
        """Volume besar + breakout menambah poin Momentum; broksum akumulasi bersih menambah poin, distribusi jadi risiko."""
        import rekomendasi as RK
        bars = [{"d": f"2026-10-{i + 1:02d}", "o": 100, "h": 102, "l": 98, "c": 100, "v": 1000} for i in range(30)]
        bars += [{"d": "2026-11-16", "o": 101, "h": 112, "l": 100, "c": 110, "v": 5000}]     # volume 5x, tembus 102
        m = RK.momentum(bars)
        self.assertEqual((m["vol"], m["volTgl"], m["breakout"]), (5.0, "2026-11-16", "2026-11-16"))
        src = {"harga": {"AAAA": {"h": 110}, "BBBB": {"h": 110}}, "bars": {"AAAA": bars, "BBBB": bars},
               "broksum": {"tanggal": ["2026-11-16", "2026-11-13", "2026-11-12", "2026-11-11", "2026-11-10"],
                           "saham": {"AAAA": {"net": 2e10, "hariAkum": 4, "kemarin": 3e9}, "BBBB": {"net": -2e9, "hariAkum": 1, "kemarin": -2e9}}},
               "recovery": [{"t": t, "skor": 80, "status": "Mulai pulih", "plan": {"entry": [105, 110], "sl": 100, "tp1": 125, "tp2": 150}}
                            for t in ("AAAA", "BBBB")]}
        r = {x["t"]: x for x in RK.nilai(src, 2000, 10)["rows"]}
        a = r["AAAA"]
        self.assertEqual(a["komponen"]["Broksum harian"], 13.8)        # 3 + 6 + 4 x 1,2
        self.assertEqual(a["komponen"]["Momentum"], round(2 + 6 * 5 / 8 + 5 + 2, 1))   # + 2: di atas puncak 60 hari
        self.assertTrue(any("volume 5 kali" in x and "16 Nov" in x for x in a["alasan"]))
        self.assertTrue(any("akumulasi bersih Rp20,0 M" in x and "termasuk kemarin" in x for x in a["alasan"]))
        b = r["BBBB"]
        self.assertNotIn("Broksum harian", b["komponen"])
        self.assertTrue(any("distribusi bersih Rp2,0 M" in x for x in b["risiko"]))
        self.assertAlmostEqual(b["skor"], round(sum(b["komponen"].values()) - 6, 1))     # 5 + 5 x 0,2

    def test_rencana_breakout_dari_resistance(self):
        """Saham momentum tanpa rencana lain: entry penutupan terakhir, stop terendah 5 hari, target dari puncak
        sebelumnya di chart (bukan angka karangan)."""
        import rekomendasi as RK
        bars = []
        for i in range(60):    # dua puncak lama: 125 (hari ke-10) dan 140 (hari ke-30), lalu sideways di 100
            h = 125 if i == 10 else 140 if i == 30 else 102
            bars.append({"d": f"2026-09-{(i % 28) + 1:02d}", "o": 100, "h": h, "l": 98, "c": 100, "v": 1000})
        bars[-1] = {"d": "2026-11-16", "o": 101, "h": 111, "l": 99, "c": 110, "v": 6000}
        self.assertEqual([h for h, _ in RK.resistensi(bars)], [125, 140])
        src = {"harga": {"SMGR": {"h": 110}}, "bars": {"SMGR": bars},
               "broksum": {"tanggal": ["2026-11-16"], "saham": {"SMGR": {"net": 1.6e10, "hariAkum": 5, "kemarin": 3e9}}},
               "lk": [{"t": "SMGR", "kategori": "bagus", "periode": "9M26", "laba": {"pct": 25}}]}
        p = RK.nilai(src, 2000, 5)["rows"][0]["plan"]
        self.assertEqual((p["entry"], p["stop"], p["tp1"], p["tp2"]), (110, 98, 125, 140))
        self.assertTrue(p["sumber"].startswith("Momentum"))
        self.assertIn("resistance puncak", p["tp1Ket"])

    def test_tahap_backdoor_dari_tonggak(self):
        """Kasus DPUM: tahap Monitor "tender" tetapi tonggaknya akuisisi + pengumuman TO terdeteksi otomatis, dan catatan
        tim menyebut belum terverifikasi: teks tidak boleh menyebut "sudah tahap tender offer", poin dibatasi."""
        import rekomendasi as RK
        src = {"harga": {"DPUM": {"h": 92}, "SPAA": {"h": 100}},
               "items": [{"ticker": "DPUM", "stage": "tender", "ms": {"spa": True, "akuisisi": True, "to_umum": True},
                          "msAuto": {"akuisisi": "2026-01-22", "to_umum": "2026-08-28"}, "ctrlName": "PT RAMA INDONESIA", "ctrlPct": 59.24,
                          "notes": "Penawaran tender wajib dan laporan pengambilalihan belum ditemukan di Stockbit; tahap belum terverifikasi."},
                         {"ticker": "SPAA", "stage": "tender", "ms": {"spa": True}}],
               "lk": [{"t": t, "kategori": "berbalik", "periode": "9M26"} for t in ("DPUM", "SPAA")],
               "recovery": [{"t": t, "skor": 80, "status": "Mulai pulih", "plan": {"entry": [h - 2, h], "sl": h * 0.92, "tp1": h * 1.15, "tp2": h * 1.4}}
                            for t, h in (("DPUM", 92), ("SPAA", 100))]}
        r = {x["t"]: x for x in RK.nilai(src, 2000, 5)["rows"]}
        d = next(a for a in r["DPUM"]["alasan"] if "Monitor" in a)
        self.assertNotIn("sudah tahap tender offer", d)
        self.assertIn("rencana tender offer wajib yang sudah diumumkan (belum ada pelaksanaan tender offer di Stockbit) (terdeteksi otomatis 28 Agu)", d)
        self.assertIn("belum terverifikasi", d)
        self.assertEqual(r["DPUM"]["komponen"]["Backdoor"], 10)
        s = next(a for a in r["SPAA"]["alasan"] if "Monitor" in a)
        self.assertIn("perjanjian jual beli (SPA)", s)                   # label "tender" Monitor diabaikan, pakai tonggak
        self.assertEqual(r["SPAA"]["komponen"]["Backdoor"], 14)

    def test_item_otomatis_belum_terkonfirmasi_tidak_dihitung(self):
        import rekomendasi as RK
        src = {"harga": {"RAJA": {"h": 494}}, "lk": [{"t": "RAJA", "kategori": "berbalik", "periode": "9M26"}],
               "items": [{"ticker": "RAJA", "stage": "spa", "ms": {"spa": True}, "auto": True, "autoJenis": "rencana"}],
               "recovery": [{"t": "RAJA", "skor": 90, "status": "Mulai pulih", "plan": {"entry": [480, 494], "sl": 450, "tp1": 560, "tp2": 700}}]}
        r = RK.nilai(src, 2000, 5)["rows"]
        self.assertTrue(all("Backdoor" not in x["komponen"] for x in r))

    def test_label_tanggal_dengan_tahun(self):
        import rekomendasi as RK
        from datetime import date
        ini = date.today().year
        self.assertEqual(RK._tgl(f"{ini}-11-11"), "11 Nov")
        self.assertEqual(RK._tgl(f"{ini - 1}-12-16"), f"16 Des {ini - 1}")

    def test_jumlah_dibatasi(self):
        import rekomendasi as RK
        self.assertLessEqual(len(RK.nilai(self.src(), 2000, 1)["rows"]), 1)

    def test_api_hitung_ulang_sekali_per_hari(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / ".rekomendasi.json"
            f.write_text(json.dumps({"tanggal": datetime.now(server.WIB).strftime("%Y-%m-%d"), "rows": []}))  # versi lama tanpa HSC
            with unittest.mock.patch.object(server, "REKO_PATH", f),                     unittest.mock.patch.object(server, "rekomendasi_kumpul", return_value=(self.src(), {"harga": 5})) as kumpul:
                r1 = server.rekomendasi_api()
                r2 = server.rekomendasi_api()
            self.assertEqual(kumpul.call_count, 1)      # tanggal lama: dihitung ulang sekali, lalu dibaca dari berkas
            self.assertEqual(r1["tanggal"], r2["tanggal"])
            self.assertEqual(r1["rows"][0]["t"], "AAAA")
            self.assertEqual(r1["sumber"], {"harga": 5})


if __name__ == "__main__":
    unittest.main(verbosity=2)
