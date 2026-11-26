"""Audit data Monitor: mencocokkan tonggak setiap item backdoor dengan bukti resmi (daftar tender offer Stockbit dan
judul keterbukaan/berita Stockbit emiten itu), lalu menghasilkan daftar temuan "perlu dicek" untuk tim. Tidak mengubah
data tim; logika murni tanpa akses jaringan (server.py yang mengumpulkan bahannya)."""
import re
from datetime import date

RX_TO = re.compile(r"penawaran tender|tender offer|tender (wajib|sukarela)|\bPTW\b|\bMTO\b", re.I)
RX_TO_RENCANA = re.compile(r"rencana|siapkan|siap|akan|jadwal ulang|menunda|tunda", re.I)
RX_PENGENDALI = re.compile(r"(?<!tetap )(?<!tetap men)jadi(kan)? pengendali|pengendali baru|perubahan pengendali|ganti pengendali|"
                           r"resmi (mengambil ?alih|diambil ?alih)|dicaplok", re.I)
RX_BATAL = re.compile(r"(pengakhiran|pembatalan|batal|dibatalkan|urung|tidak jadi)\s+(atas\s+)?(rencana\s+)?(pengambilalihan|akuisisi|mengakuisisi|caplok|mencaplok|tender offer|penawaran tender)\b([^,;]*)", re.I)
RX_BELUM = re.compile(r"belum (ditemukan|terverifikasi)", re.I)
JENIS = {
    "to_belum": "Tender offer belum tercatat",
    "to_selesai_belum": "Tender offer sudah berakhir",
    "to_tanpa_bukti": "Tender offer tanpa bukti",
    "to_rencana": "Tender offer baru rencana",
    "batal": "Rencana pengambilalihan dibatalkan",
    "pengendali_belum": "Perubahan pengendali belum tercatat",
    "catatan_usang": "Catatan sudah usang",
    "rencana_belum": "Item otomatis belum terkonfirmasi",
    "rencana_ditolak": "Item otomatis ternyata keliru",
}


def _rp(v) -> str:
    return f"{round(v):,}".replace(",", ".")


def _sebut(t: str, nama: str, judul: str) -> bool:
    """Judul menyebut emiten t (kode atau kata pertama nama yang panjangnya >= 5)."""
    if re.search(rf"\b{t}\b", judul):
        return True
    w = next((x for x in re.findall(r"[A-Za-z]+", nama or "") if len(x) >= 5 and x.lower() not in ("bank", "indonesia")), "")
    return bool(w) and w.lower() in judul.lower()


def audit_monitor(items: list[dict], tenders: dict, laporan: dict, hari_ini: str | None = None) -> list[dict]:
    """items: item Monitor; tenders: {kode: tender Stockbit (price, start, end, paydate)} hanya yang punya tanggal;
    laporan: {kode: [{date, title}]} keterbukaan dan berita terbaru. Hasil: [{t, jenis, label, teks, bukti}]."""
    hari_ini = hari_ini or date.today().isoformat()
    out = []

    def temuan(t, jenis, teks, bukti=None):
        out.append({"t": t, "jenis": jenis, "label": JENIS[jenis], "teks": teks, "bukti": bukti or []})

    for it in items:
        t = it.get("ticker")
        if not t:
            continue
        ms = {k for k, v in (it.get("ms") or {}).items() if v}
        nama, notes, aj = it.get("name") or "", it.get("notes") or "", it.get("autoJenis")
        lap = [x for x in laporan.get(t) or [] if x.get("title")]
        to = tenders.get(t)
        td = it.get("tender") or {}
        if aj == "rencana-ditolak":
            temuan(t, "rencana_ditolak", "Hasil cek ulang otomatis: berita yang memasukkan emiten ini ke Monitor bukan tentang "
                                         "pengambilalihan emiten ini. Hapus dari Monitor bila memang tidak relevan.")
            continue
        if aj == "rencana":
            temuan(t, "rencana_belum", "Masuk Monitor otomatis dari judul berita dan belum terkonfirmasi KSEI. "
                                       "Konfirmasi tahapnya, atau hapus bila tidak relevan.", [notes[:200]])
        # Tender offer ada di Stockbit tetapi tonggaknya belum dicentang.
        if to and not ({"to_umum", "to_selesai"} & ms):
            temuan(t, "to_belum", f"Tender offer Rp{_rp(to['price'])} periode {to['start']} s.d. {to['end']} ada di daftar Stockbit, "
                                  "tetapi tonggak tender offer belum dicentang di Monitor.")
        # Periode tender offer sudah berakhir, tonggak selesai belum dicentang.
        akhir = (to or {}).get("end") or td.get("end")
        if akhir and akhir < hari_ini and "to_umum" in ms and "to_selesai" not in ms:
            temuan(t, "to_selesai_belum", f"Periode tender offer berakhir {akhir}, tonggak tender offer selesai belum dicentang.")
        # Tonggak tender offer tanpa data tender: cari buktinya di judul laporan.
        if {"to_umum", "to_selesai"} & ms and not to and not td.get("start"):
            bukti = [x for x in lap if RX_TO.search(x["title"]) and _sebut(t, nama, x["title"]) or RX_TO.search(x["title"]) and "Stockbit Reports" in (x.get("source") or "")]
            if not bukti:
                temuan(t, "to_tanpa_bukti", "Tonggak tender offer dicentang, tetapi tidak ada tender offer di daftar Stockbit dan tidak ada "
                                            "keterbukaan tender offer di laporan terbaru emiten ini.")
            elif all(RX_TO_RENCANA.search(x["title"]) for x in bukti):
                temuan(t, "to_rencana", "Tender offer baru berupa rencana (belum ada pelaksanaan di daftar Stockbit). "
                                        "Tulis sebagai rencana, jangan sebagai tender offer yang sudah berjalan.",
                       [f"{x['date']}: {x['title']}" for x in bukti[:3]])
        # Rencana pengambilalihan/tender offer diakhiri atau batal, sementara item masih tercatat aktif.
        # Objek yang batal diambil alih harus emiten ini ("Batal Akuisisi SPRE, ... Bidik NAYZ" bukan pembatalan NAYZ), dan
        # tidak ada kabar pengambilalihan/tender offer yang lebih baru sesudahnya.
        batal = [x for x in lap if (m := RX_BATAL.search(x["title"])) and _sebut(t, nama, m.group(5))]
        if batal:
            akhir = max(x["date"] or "" for x in batal)
            if any((x["date"] or "") > akhir and (RX_TO.search(x["title"]) or RX_PENGENDALI.search(x["title"])) and _sebut(t, nama, x["title"])
                   for x in lap):
                batal = []
        if batal and (ms or (it.get("stage") or "radar") != "radar"):
            temuan(t, "batal", "Ada keterbukaan atau berita bahwa rencana pengambilalihan/tender offer dibatalkan atau diakhiri. "
                               "Periksa apakah tahap dan catatan item masih benar.", [f"{x['date']}: {x['title']}" for x in batal[:3]])
        # Ada berita/keterbukaan perubahan pengendali, tonggak akuisisi belum dicentang.
        if not ({"akuisisi", "to_umum", "to_selesai", "rupslb", "rights", "inbreng", "kjpp", "bisnis"} & ms):
            bukti = [x for x in lap if RX_PENGENDALI.search(x["title"]) and not RX_BATAL.search(x["title"]) and _sebut(t, nama, x["title"])]
            if bukti:
                temuan(t, "pengendali_belum", "Ada berita atau keterbukaan perubahan pengendali, tetapi tonggak akuisisi belum dicentang.",
                       [f"{x['date']}: {x['title']}" for x in bukti[:3]])
        # Catatan "belum ditemukan/terverifikasi" padahal buktinya sudah ada.
        if RX_BELUM.search(notes) and not batal:
            bukti = [x for x in lap if (RX_TO.search(x["title"]) or RX_PENGENDALI.search(x["title"])) and not RX_BATAL.search(x["title"])
                     and _sebut(t, nama, x["title"])]
            if to:
                bukti = [{"date": to["start"], "title": f"Tender offer Rp{_rp(to['price'])} di daftar Stockbit"}] + bukti
            if bukti:
                temuan(t, "catatan_usang", "Catatan item menyebut bukti belum ditemukan, padahal sudah ada. Perbarui catatannya.",
                       [f"{x['date']}: {x['title']}" for x in bukti[:3]])
    urut = list(JENIS)
    out.sort(key=lambda x: (urut.index(x["jenis"]), x["t"]))
    return out
