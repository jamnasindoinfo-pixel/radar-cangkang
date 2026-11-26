// Berita: filter relevansi backdoor dan analisa singkat per berita (port dari app.js lama).
import { num, big, x2, stageOf } from './domain.js'
import { nominalRp } from './analysis.js'

// Berita tanpa kode saham tetap relevan bila judulnya memang membahas backdoor/ganti pengendali.
export const BACKDOOR_TOPIC = /backdoor|ganti pengendali|pengendali baru|reverse takeover|pintu belakang/i
// Rangkuman pasar harian hanya menyebut kode saham sambil lalu; bukan berita tentang emiten itu.
export const MARKET_WRAP = /\bIHSG\b|top gainers|top losers|\bLQ45\b|rekomendasi saham|saham pilihan|cek saham/i
export const backdoorTickers = items => new Set(items.filter(d => stageOf(d) !== 'radar').map(d => d.ticker))
const nameCore = (t, items) => { const d = items.find(x => x.ticker === t); return d ? (d.name || '').replace(/^PT\.?\s*|\s*Tbk\.?$/gi, '').trim() : '' }
// Kode saham di berita media harus muncul dalam konteks saham ("Tbk (ASPI)", "saham ASPI", "ASPI Tbk", "$ASPI")
// atau nama perusahaannya disebut; "(ASPI)" saja tidak cukup (bisa Asosiasi Sistem Pembayaran Indonesia).
export const tickerInContext = (t, text, items = []) => {
  if (new RegExp(`Tbk\\.?\\s*\\(${t}\\)|\\b(saham|emiten|kode|ticker|perseroan)\\s+${t}\\b|\\b${t}\\s+Tbk\\b|\\$${t}\\b`, 'i').test(text)) return true
  const core = nameCore(t, items)
  return core.length >= 4 && text.toLowerCase().includes(core.toLowerCase())
}
// Halaman berita hanya untuk saham backdoor (emiten yang sudah lewat tahap radar).
export const isBackdoorNews = (u, items = [], set = backdoorTickers(items)) => {
  const text = `${u.title} ${u.summary || ''}`
  if (!u.ticker) return BACKDOOR_TOPIC.test(text)
  if (!set.has(u.ticker)) return false
  if (/^sb-report-/.test(u.id)) return true                // Stockbit Reports sudah ditandai Stockbit untuk emiten itu
  // StockbitNews juga ditandai Stockbit, tetapi rangkuman pasar (IHSG, saham pilihan) hanya menyebut kode sambil lalu.
  if (/^sb-news-/.test(u.id)) return !MARKET_WRAP.test(u.title) || BACKDOOR_TOPIC.test(text)
  if (!tickerInContext(u.ticker, text, items)) return false  // berita media: kode harus benar-benar merujuk ke emiten
  return !MARKET_WRAP.test(u.title) || BACKDOOR_TOPIC.test(text)
}

// Aturan berurutan; dua poin pertama yang cocok ditampilkan. Level: 3 = sinyal tinggi, 2 = sedang, 1 = rutin, 0 = noise.
export const NEWS_RULES = [
  [/pengendali baru|perubahan pengendali|pengambilalihan|akuisisi saham .*pengendali|ppjb|cspa|perjanjian (jual beli|pengalihan) saham/i, 3, "Perubahan kendali: siapa pembelinya, berapa harga per saham, dan apakah wajib PTW — harga beli pengendali menjadi patokan nilai."],
  [/penawaran tender|tender offer|\bPTW\b|\bMTO\b/i, 3, "Tender wajib: harga tender adalah biaya masuk pengendali, bukan lantai harga setelah periode tender selesai."],
  [/inbreng|setoran modal dalam bentuk selain uang/i, 3, "Inbreng: nilai aset ditukar saham baru — uji laporan penilai (KJPP) dan rasio terhadap kapitalisasi; penilaian tinggi = dilusi diam-diam."],
  [/transaksi material|perubahan kegiatan usaha|KBLI/i, 3, "Transaksi material/perubahan usaha: inti story backdoor — baca nilai transaksi, pihak lawan, dan apakah butuh RUPS independen."],
  [/tanpa (hak memesan|HMETD)|PMTHMETD|penempatan terbatas|private placement/i, 3, "Saham baru tanpa hak publik: cek harga pelaksanaan vs pasar dan siapa pembelinya — di bawah pasar ke afiliasi = transfer nilai dari publik."],
  [/HMETD|rights issue|PMHMETD/i, 3, "Rights issue: publik yang tidak menebus terdilusi; harga pelaksanaan jauh di bawah pasar menekan harga teoretis ex-rights."],
  [/cessie|pengalihan (hak )?(tagih|piutang)|perubahan kreditur|kreditur baru/i, 3, "Pengalihan piutang (cessie): pihak baru membeli utang emiten — sering langkah awal pengambilalihan; kreditur baru bisa menukar piutang menjadi saham atau menjadi pengendali. Cek siapa pembelinya dan kaitannya dengan calon pengendali."],
  [/konversi utang|obligasi wajib konversi|\bOWK\b/i, 2, "Konversi menjadi saham: bandingkan harga konversi dengan harga pasar dan jumlah saham baru terhadap saham beredar."],
  [/transaksi afiliasi|benturan kepentingan/i, 2, "Transaksi afiliasi: uji kewajaran harga — nilai bisa berpindah ke pengendali tanpa persetujuan publik."],
  [/suspensi|penghentian sementara|disuspen/i, 2, "Suspensi: posisi tidak bisa dijual sampai dibuka — risiko likuiditas penuh; cek alasan dan jadwal pembukaan."],
  [/terkonsentrasi/i, 2, "Kepemilikan terkonsentrasi: free float sangat tipis, harga mudah digerakkan; pencabutan status berarti saham publik bertambah."],
  [/(pemegang saham|pengendali|direksi|komisaris).{0,60}(jual|lepas|kurangi|divestasi)|(jual|lepas|kurangi).{0,40}(porsi|kepemilikan)/i, 2, "Pemegang besar melepas saham: perhatikan apakah berulang — penjualan insider adalah sinyal paling jujur."],
  [/(pemegang saham|pengendali|direksi|komisaris).{0,60}(beli|tambah|perbesar|akumulasi)|(perbesar|tambah) porsi/i, 2, "Pemegang besar menambah porsi: sinyal keyakinan bila harga belinya dekat harga pasar dan dilakukan berulang."],
  [/akuisisi|mengambil alih/i, 2, "Akuisisi: ukur nilai aset yang masuk terhadap kapitalisasi dan sumber dananya (kas, utang pengendali, atau saham baru)."],
  [/RUPSLB|RUPS Luar Biasa|pemanggilan RUPS|rencana (rapat|RUPS)/i, 2, "RUPS: agenda (KBLI, pengurus, modal dasar, rights) menunjukkan langkah berikutnya; penundaan berulang = dokumen belum siap."],
  [/public expose/i, 2, "Public expose: cari target terukur (nilai, jadwal) — janji tanpa angka tidak menambah nilai."],
  [/pencatatan saham|penambahan saham|tambahan saham/i, 2, "Penambahan saham beredar: lihat proporsinya terhadap total saham — kecil = tidak material."],
  [/perubahan (anggota )?(direksi|dewan komisaris|pengurus)/i, 2, "Perombakan pengurus: orang pengendali baru masuk — konfirmasi arah usaha baru."],
  [/perubahan nama|logo|anggaran dasar/i, 1, "Perubahan nama/anggaran dasar: kosmetik; bermakna hanya bila diikuti aset baru."],
  [/laporan keuangan|kinerja|laba|rugi|pendapatan/i, 1, "Kinerja: bandingkan laba/pendapatan dengan kapitalisasi pasar — pada saham backdoor harga jarang bertumpu pada laba lama."],
  [/pinjaman|fasilitas kredit|obligasi|sukuk|ijarah|MTN/i, 1, "Pendanaan utang: rutin, kecuali utang dari pengendali yang nantinya dikonversi menjadi saham."],
  [/volatilitas|permintaan penjelasan bursa|\bUMA\b|unusual market/i, 0, "Penjelasan volatilitas/permintaan bursa: harga sudah bergerak lebih dulu — bukan informasi nilai, sering pertanda spekulasi."],
];
export const NEWS_LEVEL = [["Noise", "bad"], ["Rutin", "calm"], ["Sinyal sedang", "warn"], ["Sinyal tinggi", "good"]];
// Arah dampak tiap aturan NEWS_RULES (urutan sama): 1 positif bagi publik, -1 negatif/risiko, 0 perlu dicermati.
const NEWS_TONE = [1, 0, 1, 1, -1, -1, 0, -1, -1, -1, -1, -1, 1, 1, 0, 0, 0, 1, 0, 0, 0, -1]
const KINERJA = NEWS_RULES.findIndex(r => /kinerja/.test(r[0].source))
function toneOf(rule, text) {
  // Kinerja: arah dari isi berita (laba/naik vs rugi/turun).
  if (NEWS_RULES.indexOf(rule) === KINERJA) return /rugi|turun|merosot|anjlok/i.test(text) ? -1 : /laba (bersih )?(naik|tumbuh|melonjak)|berbalik laba|naik \d/i.test(text) ? 1 : 0
  return NEWS_TONE[NEWS_RULES.indexOf(rule)] ?? 0
}

// Nominal terbesar dalam teks (Rp/USD) → rupiah.
export function maxAmountRp(s) {
  let best = null
  for (const m of String(s || '').matchAll(/(Rp|USD|US\$|SGD)\s?[\d.,]+\s*(triliun|miliar|juta|million|T|M)?/gi)) {
    const v = nominalRp(m[0])
    if (v != null && (best == null || v > best)) best = v
  }
  return best
}

// Analisa singkat satu berita → { level, label, cls, points (maks. 3), tones (arah tiap poin: 1/0/-1),
// arah { label, cls, pos, neg }, nominalText, sikapLine, canAnalyze }.
export function newsTake(u, { items = [], pandangan = {} } = {}) {
  const text = `${u.title || ''} ${u.summary || ''}`
  const hits = NEWS_RULES.filter(r => r[0].test(text))
  const level = hits.length ? Math.max(...hits.map(r => r[1])) : 1
  const pts = hits.slice(0, 2).map(r => r[2])
  const tones = hits.slice(0, 2).map(r => toneOf(r, text))
  // Nominal transaksi dibanding kapitalisasi pasar emiten (item.mcap dalam Rp miliar → × 1e9).
  const d = u.ticker ? items.find(x => x.ticker === u.ticker) : null
  const amt = maxAmountRp(text), mcap = num(d?.mcap) != null ? num(d.mcap) * 1e9 : null
  let nominalText = ''
  if (amt && mcap && amt >= 1e9) {
    const r = amt / mcap
    const rTxt = r >= 0.1 ? x2(r) : r < 0.001 ? '<0,1%' : (r * 100).toFixed(1).replace('.', ',') + '%'
    nominalText = `Nominal ${big(amt)} ≈ ${rTxt} kapitalisasi ${u.ticker} (${big(mcap)}) — ${r >= 1 ? 'mengubah skala perusahaan' : r >= 0.2 ? 'material' : 'kecil terhadap nilai pasar'}.`
    pts.unshift(nominalText)
    tones.unshift(r >= 0.2 ? 1 : 0)
  }
  if (!pts.length) { pts.push('Tidak ada aksi korporasi yang mengubah nilai; perlakukan sebagai informasi rutin.'); tones.push(0) }
  // Ringkasan arah: jumlah poin positif vs negatif dari poin yang tampil.
  const t3 = tones.slice(0, 3), pos = t3.filter(t => t > 0).length, neg = t3.filter(t => t < 0).length
  const arah = pos > neg ? { label: 'Cenderung positif', cls: 'good', pos, neg }
    : neg > pos ? { label: 'Cenderung negatif', cls: 'bad', pos, neg } : { label: 'Berimbang', cls: 'warn', pos, neg }
  const pa = u.ticker ? pandangan[u.ticker] : null
  const ringkas = String(pa?.ringkas || '')
  const sikapLine = pa ? {
    ticker: u.ticker, sikap: pa.sikap,
    cls: /asimetri/i.test(pa.sikap) ? 'good' : /netral/i.test(pa.sikap) ? 'warn' : 'bad',
    ringkas: ringkas.slice(0, 140) + (ringkas.length > 140 ? '…' : ''),
  } : null
  // Rincian untuk panel "penjelasan lengkap": semua poin yang cocok, alasan tingkat sinyal, hal yang perlu dipantau.
  const all = [...(nominalText ? [{ text: nominalText, tone: tones[0] }] : []), ...hits.map(r => ({ text: r[2], tone: toneOf(r, text) }))]
  const detail = { all: all.length ? all : [{ text: pts[0], tone: 0 }], levelWhy: LEVEL_WHY[level], watch: WATCH[u.type] || '', ringkas, sikap: pa?.sikap || '' }
  return { level, label: NEWS_LEVEL[level][0], cls: NEWS_LEVEL[level][1], points: pts.slice(0, 3), tones: t3, arah, nominalText, sikapLine, canAnalyze: !!d, detail }
}

const LEVEL_WHY = [
  'Tanggapan atas pergerakan harga atau permintaan bursa; bukan informasi nilai dan sering menjadi pertanda spekulasi.',
  'Informasi administratif atau kinerja yang jarang menggerakkan harga saham backdoor.',
  'Aksi korporasi atau pergerakan pemegang saham yang perlu dicermati, tetapi belum langsung mengubah nilai saham.',
  'Menyangkut perubahan kendali, penawaran tender, injeksi aset, atau penerbitan saham baru yang langsung memengaruhi nilai saham.',
]
const WATCH = {
  pengendali: 'Keterbukaan akuisisi final, harga per saham yang dibayar pengendali baru, dan pengumuman penawaran tender wajib.',
  tender: 'Harga dan periode penawaran tender, serta porsi saham publik yang ikut dijual.',
  rights: 'Pernyataan efektif OJK, harga pelaksanaan, tanggal cum-date, dan pihak pembeli siaga.',
  rupslb: 'Hasil RUPSLB: persetujuan perubahan kegiatan usaha, pengurus, dan penambahan modal.',
  uma: 'Jawaban emiten atas permintaan penjelasan bursa dan jadwal pembukaan suspensi.',
}
