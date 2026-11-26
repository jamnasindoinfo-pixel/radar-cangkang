// Analisa otomatis keterbukaan Stockbit Reports (halaman Berita): jenis, nada beserta dasarnya, angka kunci, arti
// bagi radar backdoor, dan yang perlu dipantau. Sumbernya hanya judul, ringkasan AI Stockbit ("Inti: ..."), dan butir
// laporan; tidak menambah fakta di luar teks itu. Fungsi murni.

// Urutan = prioritas (yang pertama cocok dipakai sebagai jenis utama).
export const JENIS_LAPORAN = [
  { id: 'tender', nama: 'Penawaran tender', rx: /penawaran tender|tender wajib|tender sukarela|\bmto\b/i,
    arti: 'Penawaran tender: harga tender sering menjadi patokan bawah selama periode tender, dan hasilnya mengubah porsi publik (free float).',
    pantau: 'Periode dan harga tender, jumlah saham yang ditawarkan publik, serta laporan hasil tender.' },
  { id: 'pengendali', nama: 'Pengendalian & akuisisi', rx: /pengambilalihan|pengendali|akuisisi|jual beli saham|\bppjb\b|pengalihan saham|pembelian saham/i,
    arti: 'Perubahan kepemilikan atau pengambilalihan: inti siklus backdoor bila emiten ini yang diambil alih; bila emiten yang membeli, ini ekspansi usaha.',
    pantau: 'Penyelesaian transaksi, perubahan pengendali di data KSEI, dan pernyataan penawaran tender wajib bila pengendali berganti.' },
  { id: 'rights', nama: 'Penambahan modal', rx: /hmetd|penambahan modal|rights issue|private placement|penempatan terbatas|inbreng|prospektus|pernyataan efektif/i,
    arti: 'Penerbitan saham baru: sumber dana atau jalur injeksi aset ke emiten; porsi pemegang lama terdilusi bila tidak ikut menebus.',
    pantau: 'Harga pelaksanaan, rasio, pembeli siaga, jadwal cum/ex, dan penggunaan dana.' },
  { id: 'usaha', nama: 'Perubahan kegiatan usaha', rx: /kegiatan usaha|\bkbli\b|perubahan nama|nama perseroan|anggaran dasar/i,
    arti: 'Perubahan arah bisnis atau identitas: sering menjadi tanda transformasi setelah pengendali baru masuk.',
    pantau: 'Persetujuan RUPS dan rencana usaha baru yang dijalankan (kontrak, aset, atau anak usaha).' },
  { id: 'pendanaan', nama: 'Pendanaan & utang', rx: /pinjam|minjam|fasilitas|utang|obligasi|sukuk|\bmtn\b|konversi/i,
    arti: 'Pendanaan dari pemegang saham atau kreditur: menunjukkan sumber dana rencana usaha; perhatikan opsi konversi utang menjadi saham.',
    pantau: 'Penarikan dana, jadwal pelunasan, dan perjanjian konversi (bila ada).' },
  { id: 'dana', nama: 'Penggunaan dana', rx: /penggunaan dana|realisasi dana|realokasi/i,
    arti: 'Perubahan atau realisasi penggunaan dana hasil penawaran umum.',
    pantau: 'Persetujuan RUPS atas perubahan penggunaan dana dan laporan realisasinya.' },
  { id: 'rups', nama: 'RUPS', rx: /\brups|rapat umum/i,
    arti: 'Agenda atau hasil RUPS: tempat persetujuan perubahan usaha, pengurus, dan aksi korporasi.',
    pantau: 'Mata acara yang disetujui atau ditolak, serta tindak lanjutnya.' },
  { id: 'lk', nama: 'Laporan keuangan', rx: /laporan keuangan|laba|rugi|pendapatan/i,
    arti: 'Kinerja keuangan: menunjukkan apakah usaha lama atau baru sudah menghasilkan.',
    pantau: 'Tren laba dan pendapatan kuartal berikutnya serta catatan auditor.' },
  { id: 'pengurus', nama: 'Pengurus', rx: /direksi|komisaris|komite|pengunduran diri|pengangkatan/i,
    arti: 'Perubahan pengurus: pada backdoor sering menandai pengendali baru menempatkan orangnya.',
    pantau: 'Latar belakang pengurus baru dan afiliasinya dengan pengendali.' },
  { id: 'uma', nama: 'Volatilitas & bursa', rx: /volatilitas|unusual|\buma\b|suspensi|penghentian sementara|permintaan penjelasan/i,
    arti: 'Pergerakan harga atau aktivitas tidak wajar yang dipantau bursa.',
    pantau: 'Jawaban emiten atas permintaan penjelasan dan status suspensi.' },
]
const LAINNYA = { id: 'lainnya', nama: 'Keterbukaan lain', arti: 'Keterbukaan informasi umum.', pantau: 'Keterbukaan lanjutan dengan topik yang sama.' }

// Nada objektif dari kata di teks: perhatian (risiko/dilusi/beban) didahulukan atas positif.
const PERHATIAN = [[/\bdilusi|hmetd|penambahan modal/i, 'ada penerbitan saham baru (potensi dilusi)'],
  [/pinjam|minjam|utang|fasilitas kredit/i, 'menambah utang atau kewajiban'], [/\brugi\b|kerugian|defisiensi/i, 'menyebut rugi atau defisiensi'],
  [/\bpkpu\b|pailit|gugatan|sanksi/i, 'ada perkara hukum atau sanksi'], [/suspensi|penghentian sementara|volatilitas/i, 'dipantau bursa (volatilitas/suspensi)'],
  [/\bbatal|dibatalkan|pengunduran diri/i, 'ada pembatalan atau pengunduran diri']]
const POSITIF = [[/laba (bersih )?(naik|tumbuh|melonjak)|berbalik laba/i, 'laba naik atau berbalik laba'],
  [/kontrak baru|memperoleh kontrak|perjanjian kerja sama/i, 'memperoleh kontrak atau kerja sama'],
  [/penawaran tender/i, 'ada harga tender sebagai patokan'], [/dividen tunai/i, 'membagikan dividen']]

export const intiDari = s => (String(s || '').match(/Inti:\s*(.+?)\s*(\(Ringkasan AI Stockbit\))?$/) || [null, ''])[1]
const ringkasanDari = s => String(s || '').replace(/\s*Inti:.*$/, '').trim()

// Angka kunci dari ringkasan: nilai rupiah, persentase, jumlah saham, dan harga per saham (unik, urut kemunculan).
export function angkaKunci(teks) {
  const t = String(teks || ''), out = []
  const tambah = (k, v) => { if (!out.some(x => x.v === v)) out.push({ k, v }) }
  for (const m of t.matchAll(/Rp\s?\d[\d.,]*\s?(triliun|miliar|juta|T|M|B)?(?=[\s,.;)]|$)(\s?per (lembar )?saham)?/gi)) tambah(m[2] ? 'harga' : 'nilai', m[0].trim())
  for (const m of t.matchAll(/\d+(?:[.,]\d+)?\s?%/g)) tambah('persen', m[0].replace(/\s/g, ''))
  for (const m of t.matchAll(/\d[\d.,]*\s?(miliar|juta)?\s?(lembar )?saham/gi)) if (/\d/.test(m[0]) && /(miliar|juta|lembar|\d{4,})/i.test(m[0])) tambah('saham', m[0].trim())
  return out.slice(0, 8)
}

export function analisaLaporan(u) {
  if (!u) return null
  const teks = [u.title, u.summary, u.points].filter(Boolean).join(' · ')
  const jenisSemua = JENIS_LAPORAN.filter(j => j.rx.test(teks))
  const jenis = jenisSemua.find(j => j.rx.test(u.title || '')) || jenisSemua[0] || LAINNYA
  const perhatian = PERHATIAN.filter(([rx]) => rx.test(teks)).map(([, a]) => a)
  const positif = POSITIF.filter(([rx]) => rx.test(teks)).map(([, a]) => a)
  const nada = perhatian.length ? 'perhatian' : positif.length ? 'positif' : 'netral'
  return {
    jenis, jenisLain: jenisSemua.filter(j => j !== jenis).map(j => j.nama),
    nada, dasar: nada === 'perhatian' ? perhatian : nada === 'positif' ? positif : ['tidak ada kata yang menandai risiko atau kabar baik'],
    inti: intiDari(u.summary), ringkasan: ringkasanDari(u.summary),
    butir: String(u.points || '').split(' · ').map(s => s.trim()).filter(Boolean),
    angka: angkaKunci([u.summary, u.points].filter(Boolean).join(' ')),
  }
}

// Laporan Stockbit Reports per emiten: terbaru dulu; `items` = emiten Monitor/Kandidat (kode + nama + tahap).
// days = rentang laporan lain yang ikut ditampilkan di bawah laporan terakhir.
export function laporanPerEmiten(updates = [], items = [], { days = 30, today = new Date() } = {}) {
  const radar = new Map(items.map(i => [i.ticker, i]))
  const batas = new Date(today.getTime() - days * 864e5).toISOString().slice(0, 10)
  const per = new Map()
  for (const u of updates) {
    if (!/^sb-report-/.test(String(u.id)) || !u.ticker || !radar.has(u.ticker)) continue
    if (!per.has(u.ticker)) per.set(u.ticker, [])
    per.get(u.ticker).push(u)
  }
  return [...per.entries()].map(([t, us]) => {
    us.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))
    const terakhir = us[0]
    return { t, item: radar.get(t), terakhir, analisa: analisaLaporan(terakhir),
      lain: us.slice(1).filter(u => String(u.date).slice(0, 10) >= batas), total: us.length }
  }).sort((a, b) => String(b.terakhir.date).localeCompare(String(a.terakhir.date)) || a.t.localeCompare(b.t))
}
