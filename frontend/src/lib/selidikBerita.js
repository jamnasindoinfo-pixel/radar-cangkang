// Penyelidikan tujuan aksi pada berita/laporan terbaru: menghimpun temuan dari data kurasi (Cari tahu), menguji
// dugaan tujuan dengan bukti pro/kontra (Selidiki), lalu menyimpulkan tujuan paling mungkin (Tujuannya apa?).
// Sumber: dokumen itu sendiri, profil & rencana pengendali (pengendali-verified.json), peta relasi pihak
// (relasi-verified.json), story transaksi (story-verified.json), dan keterbukaan 90 hari sebelumnya.
// Deterministik dan netral: keterlibatan pihak terafiliasi dicatat sebagai fakta, bukan otomatis negatif.
import { maxAmountRp } from './news.js'

const kata = s => new Set((String(s || '').toLowerCase().match(/[a-z]{5,}/g) || []).filter(w => !UMUM.has(w)))
const UMUM = new Set(['dalam', 'untuk', 'dengan', 'sebagai', 'perseroan', 'perusahaan', 'saham', 'usaha', 'bidang', 'kegiatan', 'menjadi', 'tersebut', 'melalui', 'terhadap', 'sebesar', 'sebanyak', 'rencana', 'baru', 'anak', 'emiten', 'modal', 'nilai', 'tahun', 'bulan', 'oktober', 'november', 'september', 'agustus', 'desember', 'januari', 'pihak', 'secara', 'serta', 'telah', 'akan', 'jakarta', 'indonesia', 'persen', 'miliar', 'triliun', 'sepekan', 'pasar', 'investor', 'harga', 'kinerja', 'laporan'])
// Kata yang sama di dua teks, tanpa kata dari nama emiten (agar nama perusahaan sendiri tidak dihitung kecocokan).
const irisan = (a, b, buang = '') => { const x = kata(buang); return [...kata(a)].filter(w => kata(b).has(w) && !x.has(w)) }
// Kalimat pertama tanpa terpotong di singkatan (Pte., Ltd., Tbk., PT.); dibatasi ±240 karakter di batas kata.
const kalimat1 = s => {
  const t = String(s || '').trim()
  const m = t.match(/^.+?(?<!\b(?:Pte|Ltd|Tbk|PT|Co|No|maks|Rp))\.(?=\s+[A-Z(]|$)/)
  const k = m ? m[0] : t
  return k.length > 240 ? k.slice(0, 240).replace(/\s+\S*$/, '') + '…' : k
}
const big = v => v >= 1e12 ? `Rp${(v / 1e12).toFixed(2).replace('.', ',')} T` : `Rp${(v / 1e9).toFixed(1).replace('.', ',')} M`

// Jenis aksi utama dokumen (urutan = prioritas).
import { INSIDER_BELI, INSIDER_JUAL } from './insider.js'

const JENIS = [
  ['insider', new RegExp(INSIDER_BELI.source + '|' + INSIDER_JUAL.source, 'i')],
  ['anakUsaha', /pendirian anak usaha|mendirikan anak usaha|anak usaha baru/i],
  ['akuisisi', /akuisisi|mengakuisisi|pengambilalihan|inbreng|pengalihan saham|caplok/i],
  ['saham', /hmetd|pmthmetd|private placement|rights issue|penambahan modal/i],
  ['tender', /penawaran tender|tender offer/i],
  ['pinjaman', /pinjaman|kredit|fasilitas pembiayaan/i],
  ['kontrak', /kontrak|proyek|kantongi|pesanan/i],
  ['pengurus', /direksi|komisaris|pengurus/i],
  ['rups', /\brups|rapat umum/i],
  ['bursa', /permintaan penjelasan bursa|\buma\b|volatilitas/i],
  ['kinerja', /laporan keuangan|laba (bersih|usaha|tahun)|rugi bersih|pendapatan (naik|turun|tumbuh|sebesar|melonjak)/i],
]

// Konteks yang dipakai semua dugaan.
function konteks(u, { pengendali, relasi, story, riwayat, pa, nama = '' }) {
  const text = `${u.title || ''} ${u.summary || ''} ${u.points || ''}`
  const bidang = (text.match(/bergerak di bidang\s+([^.;·]+?)(?:\s*[.;·]|$)/i) || [])[1] || ''
  const rencana = [pengendali?.rencana, story?.baru, story?.injectTarget].filter(Boolean).join(' ')
  const lama = (String(pengendali?.rencana || '').match(/dari\s+(.+?)\s+menjadi/i) || [])[1] || ''
  // Pihak dalam peta relasi / profil pengendali yang disebut dokumen.
  const orang = (relasi?.nodes || []).filter(n => n.t && n.t.length > 4 && !/^[A-Z]{4}$/.test(n.t) && text.includes(n.t))
    .map(n => ({ nama: n.t, peran: n.s || '' }))
  // Jumlah saham terbesar yang disebut (= total modal ditempatkan).
  const lembar = Math.max(0, ...[...text.matchAll(/(\d[\d.]*)\s*lembar saham/gi)].map(m => +m[1].replace(/\./g, ''))) || null
  return {
    text, bidang, rencana, lama, baru: story?.baru || '', orang, amt: maxAmountRp(text), lembar, nama, resmi: /^sb-report-/.test(String(u.id || '')),
    terkait: (riwayat || []).filter(r => /pengendali|tender|pengalihan|inbreng|hmetd|rups|akuisisi|penawaran/i.test(r.judul)),
    adaPengendali: !!(pengendali?.siapa || pa), pengendali,
  }
}

// Dugaan tujuan: [id, berlaku untuk jenis, teks dugaan, fungsi bukti(c) → [{teks, arah}]].
const DUGAAN = [
  ['insider', ['insider'], c => INSIDER_BELI.test(c.text) ? 'Orang dalam menambah kepemilikan saham (sinyal keyakinan terhadap prospek perseroan)'
    : 'Orang dalam mengurangi kepemilikan saham (kebutuhan pribadi atau penyesuaian portofolio; perlu dicermati)', c => {
    const b = [{ teks: 'Dokumen menyebut transaksi saham oleh komisaris/direksi/pengendali.', arah: 1 }]
    const p = (c.text.match(/(\d+(?:[.,]\d+)?)\s*(?:persen|%)/i) || [])[1]
    if (p) b.push({ teks: `Porsi yang ditransaksikan sekitar ${p}% saham.`, arah: 1 })
    for (const o of c.orang) b.push({ teks: `${o.nama} (${o.peran}) terkait transaksi ini.`, arah: 1 })
    return b
  }],
  ['rencana', null, c => `Bagian dari rencana pengendali${c.baru ? ` mengubah arah usaha ke ${c.baru.toLowerCase()}` : ''}`, c => {
    if (!c.adaPengendali) return []
    const b = []
    for (const o of c.orang) b.push({ teks: `${o.nama} (${o.peran}) terlibat langsung dalam aksi ini.`, arah: 1 })
    if (c.terkait.length) b.push({ teks: `Terjadi di tengah proses peralihan: ${c.terkait.length} keterbukaan terkait pengendali/transaksi dalam 90 hari terakhir.`, arah: 1 })
    const ir = irisan(`${c.bidang} ${c.text}`, c.rencana, c.nama)
    if (c.rencana) b.push(ir.length >= 2 ? { teks: `Objek aksi sejalan dengan rencana pengendali (kata kunci sama: ${ir.slice(0, 4).join(', ')}).`, arah: 1 }
      : { teks: `Bidang/objek aksi${c.bidang ? ` (${c.bidang})` : ''} tidak disebut dalam rencana pengendali yang sudah diungkap.`, arah: -1 })
    return b
  }],
  ['pendukung', ['anakUsaha'], () => 'Wadah pendukung tahap awal (pengadaan, instalasi, atau layanan) bagi usaha yang direncanakan', c => {
    const b = []
    if (c.lembar != null && c.lembar <= 100000) b.push({ teks: `Modal ditempatkan hanya ${c.lembar.toLocaleString('id-ID')} lembar saham dan nilainya tidak diungkap: entitas masih tahap pendirian.`, arah: 1 })
    else if (!c.amt) b.push({ teks: 'Nilai investasi tidak diungkap: skala usaha belum terlihat.', arah: 1 })
    if (c.bidang && c.rencana && !irisan(c.bidang, c.rencana).length) b.push({ teks: `Bidang ${c.bidang} dapat menjadi kegiatan penunjang, tetapi kaitannya belum dinyatakan emiten.`, arah: 0 })
    if (c.orang.length) b.push({ teks: 'Pemegang saham minoritas anak usaha berasal dari kelompok pengendali, sehingga anak usaha sepenuhnya dikendalikan kelompok yang sama.', arah: 1 })
    return b
  }],
  ['diversifikasi', ['anakUsaha', 'kontrak'], () => 'Pengembangan atau diversifikasi usaha lama perseroan', c => {
    const b = []
    if (/kontrak|proyek|kantongi|pesanan/i.test(c.text)) b.push({ teks: 'Dokumen menyebut kontrak/proyek baru dari kegiatan usaha.', arah: 1 })
    if (c.lama) {
      const ir = irisan(`${c.bidang} ${c.text}`, c.lama, c.nama)
      b.push(ir.length ? { teks: `Bidang aksi berkaitan dengan usaha lama (${c.lama}).`, arah: 1 } : { teks: `Bidang aksi tidak berkaitan dengan usaha lama (${c.lama}).`, arah: -1 })
      b.push({ teks: 'Rencana pengendali justru mengalihkan usaha lama ke pihak lain.', arah: /dialihkan|dilepas|divestasi/i.test(c.pengendali?.rencana || '') ? -1 : 0 })
    } else if (c.amt) b.push({ teks: `Nilai ${big(c.amt)} disebut dalam dokumen.`, arah: 1 })
    return b
  }],
  ['injeksi', ['akuisisi', 'saham'], c => `Injeksi aset${c.baru ? '/usaha ' + c.baru.toLowerCase() : ''} ke perseroan (jalur backdoor listing)`, c => {
    const b = []
    if (/akuisisi|mengakuisisi|pengambilalihan|caplok/i.test(c.text)) b.push({ teks: 'Dokumen menyebut pengambilalihan saham/usaha pihak lain.', arah: 1 })
    const target = String(c.pengendali?.rencana || '') + ' ' + (c.rencana || '')
    const ir = irisan(c.text, target, c.nama)
    if (target.trim()) b.push(ir.length >= 2 ? { teks: `Objek transaksi cocok dengan rencana injeksi yang sudah diungkap (${ir.slice(0, 4).join(', ')}).`, arah: 1 } : { teks: 'Objek transaksi tidak cocok dengan rencana injeksi yang sudah diungkap.', arah: -1 })
    if (/inbreng|hmetd|saham baru/i.test(c.text)) b.push({ teks: 'Pembayaran melibatkan inbreng atau saham baru.', arah: 1 })
    for (const o of c.orang) b.push({ teks: `Pihak ${o.nama} (${o.peran}) berada dalam kelompok pengendali (transaksi afiliasi, wajib memenuhi POJK 42/2020).`, arah: 1 })
    return b
  }],
  ['dana', ['saham', 'pinjaman'], () => 'Menghimpun dana untuk modal kerja atau ekspansi', c => {
    const b = []
    if (/private placement|pmthmetd|hmetd|rights issue|penambahan modal/i.test(c.text)) b.push({ teks: 'Dokumen menyebut penambahan modal melalui penerbitan saham baru.', arah: 1 })
    if (/pinjaman|kredit|fasilitas pembiayaan/i.test(c.text)) b.push({ teks: 'Dokumen menyebut pinjaman/fasilitas pembiayaan.', arah: 1 })
    if (c.amt) b.push({ teks: `Nilai ${big(c.amt)} disebut dalam dokumen.`, arah: 1 })
    if (/penggunaan dana|modal kerja|ekspansi|pengembangan/i.test(c.text)) b.push({ teks: 'Dokumen menyebut penggunaan dana untuk modal kerja/ekspansi.', arah: 1 })
    if (/inbreng/i.test(c.text)) b.push({ teks: 'Sebagian setoran berupa inbreng, bukan dana tunai.', arah: -1 })
    return b
  }],
  ['kewajiban', ['tender', 'rups', 'bursa', 'kinerja', 'pengurus'], (c, j) => ({
    tender: 'Memenuhi kewajiban penawaran tender wajib setelah pengambilalihan',
    rups: 'Memperoleh persetujuan pemegang saham atas agenda perseroan',
    bursa: 'Menanggapi permintaan penjelasan bursa',
    kinerja: 'Memenuhi kewajiban pelaporan kinerja berkala',
    pengurus: 'Menyelaraskan pengurus dengan arah perseroan',
  })[j], (c, j) => [{ teks: {
    tender: 'Dokumen menyebut penawaran tender atas saham publik.',
    rups: 'Dokumen menyebut agenda rapat umum pemegang saham.',
    bursa: 'Dokumen merupakan tanggapan atas pertanyaan bursa.',
    kinerja: 'Dokumen memuat angka kinerja keuangan.',
    pengurus: 'Dokumen menyebut perubahan susunan direksi/komisaris.',
  }[j], arah: 1 },
    ...(c.resmi ? [{ teks: 'Keterbukaan ini merupakan kewajiban/prosedur yang diatur regulator.', arah: 1 }] : []),
    ...(j === 'pengurus' && c.orang.length ? [{ teks: `Pengurus yang disebut (${c.orang.map(o => o.nama).join(', ')}) berasal dari kelompok pengendali.`, arah: 1 }] : [])]],
]

export function selidikBerita(u, ctx = {}) {
  const c = konteks(u, ctx)
  // Jenis aksi dibaca dari isi (ringkasan + poin) lebih dulu; judul media sering memakai kata dramatis.
  const isi = `${u.summary || ''} ${u.points || ''}`
  // Transaksi saham orang dalam dikenali dari seluruh teks (judul media sering memuat pelakunya, ringkasan memuat aksinya).
  const cocok = JENIS[0][1].test(c.text) ? JENIS[0]
    : JENIS.find(([, rx]) => rx.test(isi)) || JENIS.find(([, rx]) => rx.test(c.text)) || ['lainnya']
  const jenis = cocok[0]

  // Cari tahu: temuan dari setiap sumber.
  const cari = []
  const inti = (String(u.summary || '').match(/Inti:\s*(.+?)\s*(\(Ringkasan AI Stockbit\))?$/) || [])[1]
  cari.push({ sumber: 'Dokumen', teks: (inti || kalimat1(u.summary) || u.title).replace(/\.?$/, '.') })
  if (c.bidang) cari.push({ sumber: 'Dokumen', teks: `Bidang usaha yang disebut: ${c.bidang}.` })
  for (const o of c.orang) cari.push({ sumber: 'Peta relasi', teks: `${o.nama}: ${o.peran}.` })
  if (ctx.pengendali?.siapa) cari.push({ sumber: 'Profil pengendali', teks: kalimat1(ctx.pengendali.siapa) })
  if (ctx.pengendali?.rencana) cari.push({ sumber: 'Rencana pengendali', teks: kalimat1(ctx.pengendali.rencana) })
  else if (c.baru) cari.push({ sumber: 'Story transaksi', teks: `Arah usaha baru: ${c.baru}${ctx.story?.injectTarget ? `; aset yang akan masuk: ${ctx.story.injectTarget}` : ''}.` })
  if (c.terkait.length) cari.push({ sumber: 'Keterbukaan 90 hari', teks: c.terkait.slice(0, 2).map(r => `${r.tanggal}: ${r.judul}`).join('; ') + '.' })
  const kosong = [!c.amt && 'nilai investasi/transaksi', /anak usaha/i.test(c.text) && 'rencana usaha dan target pendapatan'].filter(Boolean)
  if (kosong.length) cari.push({ sumber: 'Belum diungkap', teks: `Dokumen tidak memuat ${kosong.join(' maupun ')}.` })

  // Selidiki: uji setiap dugaan yang berlaku.
  const selidiki = DUGAAN.filter(([, berlaku]) => !berlaku || berlaku.includes(jenis))
    .map(([id, , teks, bukti]) => {
      const b = bukti(c, jenis).slice(0, 4)
      const skor = b.reduce((s, x) => s + x.arah, 0)
      return { id, dugaan: teks(c, jenis), bukti: b, skor, nilai: skor >= 2 ? 'Didukung' : skor === 1 ? 'Sebagian didukung' : 'Belum didukung' }
    })
    .filter(d => d.bukti.length)
    .sort((a, b) => b.skor - a.skor)

  // Tujuannya apa?: dugaan dengan bukti terkuat.
  const top = selidiki[0]
  const tujuan = top && top.skor > 0 ? {
    utama: top.dugaan + '.',
    keyakinan: top.skor >= 3 ? 'Tinggi' : top.skor === 2 ? 'Sedang' : 'Rendah',
    alasan: top.bukti.filter(x => x.arah > 0).map(x => x.teks).slice(0, 2).join(' '),
    alternatif: selidiki.slice(1).filter(d => d.skor > 0).map(d => d.dugaan),
  } : { utama: 'Tujuan belum dapat disimpulkan dari data yang ada; dokumen tidak menyatakan tujuan secara eksplisit.', keyakinan: 'Rendah', alasan: '', alternatif: [] }
  return { jenisAksi: jenis, tujuan, cari, selidiki: selidiki.slice(0, 3) }
}
