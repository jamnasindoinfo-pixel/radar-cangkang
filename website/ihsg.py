"""Kondisi IHSG untuk Seasonality: tren & support/resistance (harga harian 1 tahun), sentimen berita pasar, dan
probabilitas pola musiman berulang berdasarkan kondisi tren yang sama di tahun-tahun lalu. Modul murni."""
from __future__ import annotations

import re
import statistics


def ema(xs: list[float], n: int) -> list[float]:
    k, out = 2 / (n + 1), []
    for i, x in enumerate(xs):
        out.append(x if i == 0 else x * k + out[-1] * (1 - k))
    return out


def pivots(bars: list[dict], w: int = 5) -> tuple[list[float], list[float]]:
    lows, highs = [], []
    for i in range(w, len(bars) - w):
        seg = bars[i - w:i + w + 1]
        if bars[i]["l"] == min(b["l"] for b in seg):
            lows.append(bars[i]["l"])
        if bars[i]["h"] == max(b["h"] for b in seg):
            highs.append(bars[i]["h"])
    return lows, highs


def cluster(levels: list[float], tol: float = 0.015) -> list[dict]:
    """Gabungkan titik balik yang berdekatan (selisih <= 1,5%) menjadi satu level beserta jumlah sentuhan."""
    out: list[dict] = []
    for v in sorted(levels):
        if out and abs(v / out[-1]["v"] - 1) <= tol:
            c = out[-1]; c["n"] += 1; c["v"] = c["v"] + (v - c["v"]) / c["n"]
        else:
            out.append({"v": v, "n": 1})
    return out


def technical(bars: list[dict]) -> dict | None:
    """Tren (harga vs EMA50/EMA200 dan kemiringan EMA50), support/resistance terdekat, dan rekomendasi teknikal."""
    if len(bars) < 60:
        return None
    c = [b["c"] for b in bars]
    e20, e50, e200 = ema(c, 20), ema(c, 50), ema(c, 200)
    p = c[-1]
    slope = (e50[-1] / e50[-11] - 1) * 100 if len(e50) > 11 else 0
    if p > e50[-1] > e200[-1] and slope > 0:
        tren, nada = "Uptrend", "good"
    elif p < e50[-1] < e200[-1] and slope < 0:
        tren, nada = "Downtrend", "bad"
    else:
        tren, nada = "Sideways", "warn"
    lows, highs = pivots(bars[-140:])
    sup = sorted([x for x in cluster(lows) if x["v"] < p], key=lambda x: -x["v"])[:2]
    res = sorted([x for x in cluster(highs) if x["v"] > p], key=lambda x: x["v"])[:2]
    s1 = sup[0]["v"] if sup else min(b["l"] for b in bars[-60:])
    r1 = res[0]["v"] if res else max(b["h"] for b in bars[-60:])
    jarakS, jarakR = (p / s1 - 1) * 100, (r1 / p - 1) * 100
    if tren == "Uptrend":
        rek = "Buy on weakness: tren naik; cicil beli mendekati support, batas risiko di bawah support." if jarakS <= 2.5 \
            else "Ikuti tren dengan disiplin: tunggu koreksi ke support atau tembus resistance untuk menambah posisi."
    elif tren == "Downtrend":
        rek = "Wait and see: tren turun; kurangi eksposur, tunggu harga kembali di atas EMA50 atau tembus resistance sebelum agresif."
    else:
        rek = "Trading range: beli dekat support, ambil untung dekat resistance; tunggu tembus salah satu untuk arah baru."
    return {
        "harga": p, "tanggal": bars[-1]["d"], "tren": tren, "nada": nada, "ema20": round(e20[-1], 1), "ema50": round(e50[-1], 1),
        "ema200": round(e200[-1], 1), "slope50": round(slope, 2),
        "support": [{"v": round(x["v"], 1), "n": x["n"]} for x in sup], "resistance": [{"v": round(x["v"], 1), "n": x["n"]} for x in res],
        "jarakSupport": round(jarakS, 1), "jarakResistance": round(jarakR, 1), "rekomendasi": rek,
        "tinggi52": max(b["h"] for b in bars[-250:]), "rendah52": min(b["l"] for b in bars[-250:]),
        # Seri ringkas untuk grafik (tutup + EMA), maks. 260 titik.
        "seri": [{"d": b["d"], "c": b["c"], "e50": round(e50[i], 1), "e200": round(e200[i], 1)} for i, b in enumerate(bars)][-260:],
    }


# Kata kunci sentimen pasar (judul berita). Netral bila tidak ada atau seimbang.
POS = r"menguat|naik|rebound|reli|rally|hijau|melesat|melonjak|net buy|inflow|asing (borong|beli)|suku bunga (turun|dipangkas)|rate cut|stimulus|" \
      r"surplus|investment grade|upgrade|cetak rekor|all time high|ath|optimis|positif|membaik|pemangkasan bunga|dovish"
NEG = r"melemah|turun|merosot|anjlok|ambles|longsor|zona merah|memerah|(dibuka|ditutup|berakhir) merah|net sell|outflow|asing (lepas|jual|kabur)|suku bunga naik|hawkish|" \
      r"defisit|downgrade|resesi|perang|konflik|krisis|tekanan|pesimis|negatif|ancaman|standalone|frontier|gagal bayar|inflasi naik|phk"


# Topik berita pasar (judul + ringkasan) beserta kalimat implikasi bila dominan positif / negatif.
TOPIK = [
    ("Arus dana asing", r"asing|net sell|net buy|foreign|outflow|inflow",
     "Arus dana asing masuk mendukung saham berkapitalisasi besar dan IHSG.", "Keluarnya dana asing menekan saham berkapitalisasi besar (perbankan) dan IHSG."),
    ("Suku bunga & The Fed", r"suku bunga|the fed|bi rate|fomc|bunga acuan|imbal hasil|yield",
     "Arah bunga melunak memberi ruang kenaikan valuasi saham.", "Bunga tinggi lebih lama menahan minat pada saham dan rupiah."),
    ("Rupiah & makro", r"rupiah|dolar|inflasi|pdb|neraca|defisit|surplus|cadangan devisa|apbn|ekonomi",
     "Data makro dan rupiah yang membaik menopang IHSG.", "Pelemahan rupiah dan data makro yang lemah menambah tekanan jual."),
    ("MSCI & indeks", r"msci|ftse|rebalancing|standalone|frontier|lq45|indeks global|bobot",
     "Kabar positif terkait indeks global dapat menarik dana pasif.", "Risiko perubahan status di indeks global dapat memicu arus keluar dana pasif."),
    ("Komoditas", r"batu bara|minyak|nikel|emas|cpo|sawit|lng|komoditas|timah|tembaga",
     "Harga komoditas yang naik mendukung saham energi dan tambang.", "Harga komoditas yang turun membebani saham energi dan tambang."),
    ("Geopolitik & global", r"perang|konflik|tarif|china|tiongkok|amerika|global|wall street|eropa|geopolitik|bursa asia|"
                            r"bursa saham asia|regional|nikkei|kospi|hang seng|saham as\b|nasdaq|dow jones",
     "Sentimen global yang membaik mengurangi tekanan pada pasar berkembang.", "Ketegangan global meningkatkan penghindaran risiko di pasar berkembang."),
    ("Emiten & aksi korporasi", r"dividen|laba|rights issue|buyback|ipo|akuisisi|kinerja|emiten|saham pilihan|rekomendasi",
     "Kinerja dan aksi korporasi emiten memberi peluang selektif.", "Kinerja emiten yang melemah menambah alasan berhati-hati."),
]


# Berita dianggap berdampak ke IHSG bila membahas indeks/pasar secara luas, arus asing, makro, kebijakan, atau global
# (judul + 300 karakter awal ringkasan). Kinerja satu emiten tanpa kaitan pasar tidak dihitung.
IHSG_REL = re.compile(
    r"ihsg|indeks harga saham gabungan|indeks komposit|\bbursa\b|\bbei\b|pasar saham|pasar modal|investor asing|dana asing|"
    r"\basing\b|net (buy|sell)|inflow|outflow|rupiah|suku bunga|bi rate|bunga acuan|the fed|\bfed\b|fomc|inflasi|\bpdb\b|"
    r"neraca (perdagangan|pembayaran)|cadangan devisa|\bapbn\b|defisit|msci|ftse|rebalancing|wall street|bursa (asia|global|regional)|"
    r"\bojk\b|danantara|kebijakan|stimulus|tarif|perang|geopolitik|resesi|lq45|big caps?|saham (perbankan|bank besar)|yield|\bsbn\b", re.I)


# Nada bergantung konteks: arah IHSG di judul paling menentukan; kata "menguat/naik" pada dolar, yield, inflasi, atau bunga justru menekan IHSG.
NEG_CTX = r"ihsg[^.,]{0,25}\b(melemah|turun|anjlok|ambles|amblas|merosot|terkoreksi|terpeleset|tergelincir|memerah|dibuka merah|ditutup merah)|" \
          r"(dolar|us\$|usd|greenback)[^.,]{0,30}\b(menguat|naik|perkasa|melonjak)|rupiah[^.,]{0,30}\b(melemah|tertekan|tertahan|turun|anjlok|ambles|loyo)|" \
          r"(yield|imbal hasil)[^.,]{0,40}\b(naik|melonjak|tertinggi)|inflasi[^.,]{0,20}\b(naik|melonjak|tinggi)|" \
          r"suku bunga[^.,]{0,30}\b(naik|dinaikkan|tetap tinggi|bertahan tinggi)"
POS_CTX = r"ihsg[^.,]{0,25}\b(menguat|naik|rebound|menghijau|melesat|melonjak|berbalik naik|ditutup hijau|dibuka hijau)|" \
          r"rupiah[^.,]{0,30}\b(menguat|perkasa|naik|rebound)|(dolar|us\$|usd)[^.,]{0,30}\b(melemah|turun|loyo)|" \
          r"(yield|imbal hasil)[^.,]{0,40}\b(turun|melandai)|inflasi[^.,]{0,20}\b(turun|melandai|terkendali)|suku bunga[^.,]{0,30}\b(turun|dipangkas)"


def _nada(teks: str) -> tuple[str, list[str]]:
    """(nada, kata kunci) — konteks mata uang/yield/bunga lebih dulu, lalu kata kunci umum."""
    for rx_p, rx_n in ((POS_CTX, NEG_CTX), (POS, NEG)):
        a, b = len(re.findall(rx_p, teks)), len(re.findall(rx_n, teks))
        if a != b:
            nada = "positif" if a > b else "negatif"
            return nada, [m.group(0) for m in re.finditer(rx_p if a > b else rx_n, teks)][:3]
    return "netral", []


def sentiment(posts: list[dict], limit: int = 15) -> dict:
    """Sentimen IHSG: hanya berita yang berdampak ke IHSG (IHSG_REL), nada dari judul (ringkasan dipakai bila judul
    netral). Tiap berita bernada membawa kata kunci penentu nada, topik, dan dampaknya ke IHSG."""
    pos, neg, semua = [], [], []
    for p in posts:
        t = re.sub(r"\s+", " ", str(p.get("title") or "")).strip()
        rk = str(p.get("ringkas") or "")
        lo, lr = t.lower(), rk.lower()
        if not IHSG_REL.search(lo + " " + lr[:300]):
            continue
        nada, kunci = _nada(lo)
        if nada == "netral":
            nada, kunci = _nada(lr)
        it = {"d": p.get("d"), "t": p.get("t") or p.get("d") or "", "judul": t[:160], "ringkas": rk, "sumber": p.get("sumber") or "",
              "url": p.get("url"), "nada": nada, "kunci": list(dict.fromkeys(kunci))}
        semua.append(it)
    topik = []
    # Topik dari judul; ringkasan isi hanya dipakai bila judul tidak cocok dengan topik mana pun.
    for x in semua:
        x["topik"] = ([nm for nm, rx, _, _ in TOPIK if re.search(rx, x["judul"].lower())]
                      or [nm for nm, rx, _, _ in TOPIK if re.search(rx, x["ringkas"][:200].lower())][:1])
        imp = {nm: (ip, ineg) for nm, _, ip, ineg in TOPIK}
        if x["nada"] != "netral":
            naik = x["nada"] == "positif"
            # Berita langsung tentang arah IHSG: dampaknya momentum; selain itu implikasi topiknya.
            langsung = bool(x["kunci"]) and x["kunci"][0].startswith("ihsg")
            bagian = ["Momentum jangka pendek IHSG " + ("menguat; peluang lanjut naik selama bertahan di atas pivot." if naik
                      else "melemah; waspadai uji support berikutnya.")] if langsung else []
            # Topik "Emiten" hanya kinerja satu perusahaan: tidak dijadikan dampak ke IHSG.
            if x["topik"] and x["topik"][0] != "Emiten & aksi korporasi":
                ip, ineg = imp[x["topik"][0]]
                bagian.append(ip if naik else ineg)
            if not bagian:
                # Tanpa arah IHSG langsung dan tanpa topik pasar (mis. kinerja/transaksi satu emiten): tidak dihitung sentimen IHSG.
                x["nada"], x["kunci"] = "netral", []
                continue
            x["dampak"] = " ".join(bagian)
            (pos if x["nada"] == "positif" else neg).append(x)
    for nama, rx, imp_pos, imp_neg in TOPIK:
        xs = [x for x in semua if nama in x["topik"]]
        if not xs:
            continue
        np_, nn = sum(x["nada"] == "positif" for x in xs), sum(x["nada"] == "negatif" for x in xs)
        topik.append({"nama": nama, "n": len(xs), "nPos": np_, "nNeg": nn,
                      "arah": "positif" if np_ > nn else "negatif" if nn > np_ else "netral",
                      "implikasi": imp_pos if np_ > nn else imp_neg if nn > np_ else "Kabar beragam; dampaknya belum searah.",
                      # Berita bernada (positif/negatif) lebih dulu, lalu terbaru.
                      "berita": sorted(sorted(xs, key=lambda x: x["t"], reverse=True), key=lambda x: x["nada"] == "netral")[:6]})
    topik.sort(key=lambda z: -z["n"])
    pos.sort(key=lambda x: x["t"], reverse=True)
    neg.sort(key=lambda x: x["t"], reverse=True)
    n = len(pos) + len(neg)
    skor = round((len(pos) - len(neg)) / n * 100) if n else 0
    return {"positif": pos[:limit], "negatif": neg[:limit], "nPos": len(pos), "nNeg": len(neg), "skor": skor,
            "arah": "positif" if skor >= 20 else "negatif" if skor <= -20 else "netral", "topik": topik, "total": len(semua),
            "totalSemua": len(posts)}


def monthly_levels(series: dict) -> list[tuple[int, int, float]]:
    """Indeks bulanan relatif dari return % (tahun, bulan, level), urut waktu."""
    lv, out = 100.0, []
    for y in sorted(series, key=int):
        for m in sorted(series[y], key=int):
            lv *= 1 + series[y][m] / 100
            out.append((int(y), int(m), lv))
    return out


def conditional(series: dict, month: int, state_now: str, years: int = 10) -> dict:
    """Peluang IHSG naik pada `month` di tahun-tahun ketika kondisi tren akhir bulan sebelumnya sama dengan sekarang.
    Kondisi tren bulanan: level di atas/bawah rata-rata 10 bulan (SMA10), padanan EMA200 harian."""
    lv = monthly_levels(series)
    idx = {(y, m): i for i, (y, m, _) in enumerate(lv)}
    hits = []
    for (y, m), i in idx.items():
        if m != month or i < 11:
            continue
        prev = lv[i - 1][2]
        sma = statistics.mean(x[2] for x in lv[i - 11:i - 1])
        st = "atas" if prev > sma else "bawah"
        hits.append({"tahun": y, "kondisi": st, "ret": round(lv[i][2] / prev * 100 - 100, 2)})
    sama = [h for h in hits if h["kondisi"] == state_now]
    up = sum(1 for h in sama if h["ret"] > 0)
    # Semua bulan dengan kondisi yang sama (sampel lebih besar) sebagai pembanding.
    allm = []
    for i in range(11, len(lv)):
        prev, sma = lv[i - 1][2], statistics.mean(x[2] for x in lv[i - 11:i - 1])
        if ("atas" if prev > sma else "bawah") == state_now:
            allm.append(lv[i][2] > prev)
    return {"kondisi": state_now, "n": len(sama), "up": up, "prob": round(up / len(sama) * 100) if sama else None,
            "tahun": sama, "semuaBulanN": len(allm), "semuaBulanProb": round(sum(allm) / len(allm) * 100) if allm else None}


def verdict(base: dict | None, cond: dict, sent: dict) -> dict:
    """Probabilitas pola berulang: rata-rata tertimbang peluang musiman (bobot 0,5), peluang pada kondisi tren yang
    sama (0,3; bila sampel >= 3), dan arah sentimen (0,2: positif 65, netral 50, negatif 35)."""
    parts = []
    if base and base.get("prob") is not None:
        parts.append((base["prob"], 0.5, "pola musiman"))
    if cond.get("prob") is not None and cond.get("n", 0) >= 3:
        parts.append((cond["prob"], 0.3, "kondisi tren sama"))
    parts.append(({"positif": 65, "netral": 50, "negatif": 35}[sent["arah"]], 0.2, "sentimen"))
    w = sum(p[1] for p in parts)
    prob = round(sum(p[0] * p[1] for p in parts) / w)
    label = "Tinggi" if prob >= 60 else "Sedang" if prob >= 45 else "Rendah"
    return {"prob": prob, "label": label, "komponen": [{"nama": n, "nilai": v, "bobot": b} for v, b, n in parts]}


def pattern(bars: list[dict], w: int = 5) -> dict:
    """Struktur harga dari titik balik 140 hari terakhir: higher high / lower low dan double bottom/top
    (dua titik balik berselisih <= 3%, berjarak >= 10 hari bursa; neckline = titik ekstrem di antaranya)."""
    b = bars[-140:]
    lo = [(i, x["l"]) for i, x in enumerate(b) if w <= i < len(b) - w and x["l"] == min(y["l"] for y in b[i - w:i + w + 1])]
    hi = [(i, x["h"]) for i, x in enumerate(b) if w <= i < len(b) - w and x["h"] == max(y["h"] for y in b[i - w:i + w + 1])]
    out = {"hh": hi[-1][1] > hi[-2][1] if len(hi) >= 2 else None, "ll": lo[-1][1] < lo[-2][1] if len(lo) >= 2 else None, "pola": None}
    p = b[-1]["c"]
    if len(lo) >= 2:
        (i1, a), (i2, c) = lo[-2], lo[-1]
        if i2 - i1 >= 10 and abs(c / a - 1) <= 0.03:
            neck = max(x["h"] for x in b[i1:i2 + 1])
            out["pola"] = {"jenis": "double bottom", "dasar": round(min(a, c), 1), "neckline": round(neck, 1),
                           "status": "sudah break neckline" if p > neck else "menunggu break neckline"}
    if not out["pola"] and len(hi) >= 2:
        (i1, a), (i2, c) = hi[-2], hi[-1]
        if i2 - i1 >= 10 and abs(c / a - 1) <= 0.03:
            neck = min(x["l"] for x in b[i1:i2 + 1])
            out["pola"] = {"jenis": "double top", "puncak": round(max(a, c), 1), "neckline": round(neck, 1),
                           "status": "sudah break neckline ke bawah" if p < neck else "menunggu konfirmasi"}
    return out


def _n(v: float) -> str:
    return f"{v:,.0f}".replace(",", ".")


def _rp(v: float) -> str:
    a = abs(v)
    s = f"Rp{a / 1e12:,.2f} T" if a >= 1e12 else f"Rp{a / 1e9:,.1f} M"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def narrative(tek: dict, pat: dict, flow: dict | None, berulang: dict, nama_bulan: str) -> dict:
    """Narasi Analisa Teknikal & Flow IHSG gaya riset (struktur, flow, rencana) + level area beli/target/risiko."""
    p, sup, res = tek["harga"], tek.get("support") or [], tek.get("resistance") or []
    s1 = sup[0]["v"] if sup else tek["rendah52"]
    s2 = sup[1]["v"] if len(sup) > 1 else s1 * 0.97
    r1 = res[0]["v"] if res else tek["tinggi52"]
    r2 = res[1]["v"] if len(res) > 1 else r1 * 1.03
    st = [f"IHSG secara struktur berada dalam fase {tek['tren'].lower()}: harga {_n(p)} {'di atas' if p > tek['ema50'] else 'di bawah'} "
          f"EMA50 ({_n(tek['ema50'])}) dan {'di atas' if p > tek['ema200'] else 'di bawah'} EMA200 ({_n(tek['ema200'])})."]
    if pat.get("hh") is not None and pat.get("ll") is not None:
        st.append("Titik balik terakhir membentuk " + ("higher high" if pat["hh"] else "lower high") + " dan "
                  + ("lower low" if pat["ll"] else "higher low") + ".")
    pl = pat.get("pola")
    if pl and pl["jenis"] == "double bottom":
        st.append(f"Terbentuk pola double bottom dengan dasar di area {_n(pl['dasar'])} dan neckline di {_n(pl['neckline'])} ({pl['status']}).")
    elif pl:
        st.append(f"Terbentuk pola double top dengan puncak di area {_n(pl['puncak'])} dan neckline di {_n(pl['neckline'])} ({pl['status']}).")
    st.append(f"Support terdekat di {_n(s1)} dan resistance terdekat di {_n(r1)}.")
    fl = []
    if flow:
        fl.append(f"Secara flow bulan {flow['bulanNama']} (s.d. {flow['sampai']}), broker asing tercatat {'net buy' if flow['asing'] > 0 else 'net sell'} "
                  f"{_rp(flow['asing'])} dan broker domestik {'net buy' if flow['domestik'] > 0 else 'net sell'} {_rp(flow['domestik'])} pada saham-saham teraktif.")
        if flow.get("brokerAsing"):
            fl.append("Broker asing terbesar: " + ", ".join(f"{b['kode']} {'net buy' if b['net'] > 0 else 'net sell'} {_rp(b['net'])}" for b in flow["brokerAsing"]) + ".")
        ak = [x for x in flow.get("sahamAsing") or [] if x.get("avg")]
        if ak:
            fl.append("Saham yang paling diakumulasi asing: " + ", ".join(f"{x['s']} ({_rp(x['net'])} di average {_n(x['avg'])})" for x in ak) + ".")
        if flow.get("sahamJualAsing"):
            fl.append("Distribusi asing terbesar di " + ", ".join(f"{x['s']} ({_rp(x['net'])})" for x in flow["sahamJualAsing"]) + ".")
    beli = [round(s1), round(s1 * 1.01)]
    # Batas risiko: support kedua bila dekat (<= 3% di bawah support pertama), selain itu 1,5% di bawah support pertama.
    risiko = round(s2) if s2 >= s1 * 0.97 else round(s1 * 0.985)
    if tek["tren"] == "Downtrend":
        rk = (f"Selama IHSG belum kembali di atas EMA50 ({_n(tek['ema50'])}), strategi yang disarankan adalah wait and see atau beli bertahap "
              f"dengan porsi kecil di area support {_n(beli[0])}–{_n(beli[1])}. Target pemulihan ke {_n(r1)} lalu {_n(r2)}; "
              f"risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    elif tek["tren"] == "Uptrend":
        rk = (f"Tren naik masih valid selama IHSG bertahan di atas {_n(s1)}. Akumulasi saat koreksi ke {_n(beli[0])}–{_n(beli[1])} "
              f"dengan target {_n(r1)} lalu {_n(r2)}; risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    else:
        rk = (f"IHSG bergerak dalam rentang {_n(s1)}–{_n(r1)}: beli dekat support {_n(beli[0])}–{_n(beli[1])}, ambil untung dekat {_n(r1)}; "
              f"tembus {_n(r1)} membuka ruang ke {_n(r2)}. Risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    rk += f" Probabilitas pola {nama_bulan} berulang: {berulang['prob']}% ({berulang['label'].lower()})."
    return {"struktur": " ".join(st), "flow": " ".join(fl), "rencana": rk,
            "level": {"beli": beli, "target": [round(r1), round(r2)], "risiko": risiko}}


def _atr(bars: list[dict], n: int = 14) -> float:
    tr = [max(b["h"] - b["l"], abs(b["h"] - a["c"]), abs(b["l"] - a["c"])) for a, b in zip(bars[:-1], bars[1:])]
    return sum(tr[-n:]) / min(n, len(tr)) if tr else 0.0


def projection_base(bars: list[dict]) -> dict | None:
    """Bahan proyeksi dari harga harian: pivot klasik untuk sesi berikutnya, ATR14, dan statistik empiris 1 tahun
    (peluang naik esok / 5 hari / 21 hari pada kondisi yang sama dengan hari ini)."""
    if len(bars) < 60:
        return None
    c = [b["c"] for b in bars]
    e20, e50 = ema(c, 20), ema(c, 50)
    h, l, cl = bars[-1]["h"], bars[-1]["l"], c[-1]
    pv = (h + l + cl) / 3
    # Kondisi hari ini: posisi terhadap EMA20 + arah perubahan harian -> peluang naik pada sesi berikutnya.
    def st1(i): return (c[i] > e20[i], c[i] > c[i - 1])
    def fwd(k, cond):
        xs = [c[i + k] / c[i] - 1 for i in range(50, len(c) - k) if cond(i)]
        if not xs:
            return {"n": 0, "naik": None, "median": None}
        s = sorted(xs)
        return {"n": len(xs), "naik": round(sum(x > 0 for x in xs) / len(xs) * 100), "median": round(s[len(s) // 2] * 100, 2)}
    now1, now50 = st1(len(c) - 1), c[-1] > e50[-1]
    return {
        "tanggal": bars[-1]["d"], "harga": cl, "atr": round(_atr(bars), 1),
        "ubah1": round((cl / c[-2] - 1) * 100, 2), "ubah5": round((cl / c[-6] - 1) * 100, 2),
        "pivot": {"p": round(pv), "r1": round(2 * pv - l), "s1": round(2 * pv - h), "r2": round(pv + h - l), "s2": round(pv - (h - l))},
        "esok": fwd(1, lambda i: st1(i) == now1), "minggu": fwd(5, lambda i: (c[i] > e50[i]) == now50),
        "bulan": fwd(21, lambda i: (c[i] > e50[i]) == now50),
        "kondisi": f"{'di atas' if now1[0] else 'di bawah'} EMA20 dan {'naik' if now1[1] else 'turun'} hari ini",
        "kondisi50": f"{'di atas' if now50 else 'di bawah'} EMA50",
    }


def _arah(p: int) -> str:
    return "Cenderung naik" if p >= 55 else "Cenderung turun" if p <= 45 else "Mendatar (sideways)"


def projection(base: dict | None, tek: dict, sent: dict, flow: dict | None, berulang: dict) -> dict | None:
    """Proyeksi arah IHSG (esok, 1 minggu, 1 bulan) sebagai rata-rata tertimbang komponen terukur. Ini perkiraan
    probabilistik, bukan kepastian: setiap komponen dan bobotnya ikut dikembalikan agar bisa diperiksa."""
    if not base:
        return None
    p, atr = base["harga"], base["atr"] or base["harga"] * 0.01
    tr = {"Uptrend": 60, "Downtrend": 40}.get(tek.get("tren"), 50)
    se = {"positif": 62, "netral": 50, "negatif": 38}[sent.get("arah", "netral")]
    fa = None if not flow else 58 if flow["asing"] > 0 else 42
    sup = [x["v"] for x in tek.get("support") or []]
    res = [x["v"] for x in tek.get("resistance") or []]

    def gabung(parts):
        parts = [x for x in parts if x[0] is not None]
        w = sum(x[1] for x in parts)
        return round(sum(x[0] * x[1] for x in parts) / w), [{"nama": n, "nilai": v, "bobot": b} for v, b, n in parts]

    def rentang(k):
        d = atr * k ** 0.5
        bawah, atas = p - d, p + d
        return {"bawah": round(bawah), "atas": round(atas),
                "level": [round(v) for v in sup + res if bawah <= v <= atas]}

    out = []
    for kunci, nama, k, parts in (
        ("esok", "Esok hari", 1, [(base["esok"]["naik"] if base["esok"]["n"] >= 15 else None, 0.45, f"empiris 1 hari ({base['kondisi']})"),
                                  (tr, 0.2, "tren"), (se, 0.2, "sentimen berita"), (fa, 0.15, "flow asing bulan berjalan")]),
        ("minggu", "1 minggu", 5, [(base["minggu"]["naik"] if base["minggu"]["n"] >= 15 else None, 0.4, f"empiris 5 hari ({base['kondisi50']})"),
                                   (tr, 0.25, "tren"), (se, 0.2, "sentimen berita"), (fa, 0.15, "flow asing bulan berjalan")]),
        ("bulan", "1 bulan", 21, [(base["bulan"]["naik"] if base["bulan"]["n"] >= 15 else None, 0.35, f"empiris 21 hari ({base['kondisi50']})"),
                                  (berulang.get("prob"), 0.35, "pola musiman berulang"), (tr, 0.2, "tren"), (fa, 0.1, "flow asing bulan berjalan")]),
    ):
        prob, komp = gabung(parts)
        st = base[kunci]
        out.append({"kunci": kunci, "nama": nama, "prob": prob, "arah": _arah(prob), **rentang(k),
                    "median": st["median"], "n": st["n"], "komponen": komp})
    pv = base["pivot"]
    e = out[0]
    if e["prob"] >= 55:
        sk = (f"Bias naik untuk sesi berikutnya. Selama IHSG bertahan di atas pivot {_n(pv['p'])}, ruang menuju {_n(pv['r1'])} lalu {_n(pv['r2'])}; "
              f"gagal bertahan di atas {_n(pv['s1'])} membatalkan skenario ini.")
    elif e["prob"] <= 45:
        sk = (f"Bias turun untuk sesi berikutnya. Selama IHSG di bawah pivot {_n(pv['p'])}, rawan menguji {_n(pv['s1'])} lalu {_n(pv['s2'])}; "
              f"penutupan di atas {_n(pv['r1'])} membatalkan skenario ini.")
    else:
        sk = (f"Belum ada bias kuat untuk sesi berikutnya. Kisaran wajar {_n(pv['s1'])}–{_n(pv['r1'])} dengan pivot {_n(pv['p'])}; "
              f"tembus {_n(pv['r1'])} membuka ruang ke {_n(pv['r2'])}, jebol {_n(pv['s1'])} membuka ruang ke {_n(pv['s2'])}.")
    return {"dasar": base["tanggal"], "harga": p, "atr": atr, "ubah1": base["ubah1"], "ubah5": base["ubah5"],
            "pivot": pv, "horizon": out, "skenarioEsok": sk,
            "catatan": "Perkiraan probabilistik dari data historis 1 tahun, tren, sentimen berita, dan flow broker; bukan kepastian arah."}
