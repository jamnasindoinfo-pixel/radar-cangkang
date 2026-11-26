// Kesimpulan akhir tab Berita: rangkuman deterministik dari laporan dan berita satu emiten.
import { UTYPES, fmtDate } from './domain.js'

const DAY = 864e5
// Huruf awal dikecilkan kecuali singkatan (RUPSLB, UMA).
const typeName = id => { const n = (UTYPES.find(t => t.id === id) || { name: 'Lainnya' }).name; return /^[A-Z]{2,}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1) }
const day = u => String(u.date || '').slice(0, 10)
const isReport = u => /^sb-report-/.test(String(u.id))
// "Inti: ..." dari ringkasan AI Stockbit pada laporan.
const intiOf = u => (String(u.summary || '').match(/Inti:\s*(.+?)\s*(\(Ringkasan AI Stockbit\))?$/) || [])[1] || ''

// Tafsiran per jenis keterbukaan terbaru; urutan = prioritas.
const READ = [
  ['tender', 'Proses penawaran tender wajib sedang berjalan atau baru diumumkan, sehingga harga pelaksanaan tender menjadi acuan utama pergerakan harga.'],
  ['pengendali', 'Isu perubahan pengendalian masih menjadi pokok pemberitaan; kepastian transaksi perlu dikonfirmasi melalui keterbukaan resmi berikutnya.'],
  ['rights', 'Pemberitaan bergeser ke penambahan modal dan injeksi aset, yang menandakan transaksi memasuki tahap pendanaan.'],
  ['rupslb', 'Agenda RUPSLB menjadi titik penentu, karena persetujuan pemegang saham diperlukan sebelum rencana aksi korporasi dapat dilaksanakan.'],
  ['uma', 'Terdapat peringatan UMA atau suspensi dari bursa, sehingga volatilitas harga perlu diwaspadai.'],
  ['regulasi', 'Pemberitaan didominasi isu regulasi dan pasar yang dapat memengaruhi jadwal aksi korporasi.'],
]

// list = laporan & berita satu emiten (urutan bebas); now = tanggal acuan (untuk pengujian).
export function newsConclusion(list, { ticker = '', now = Date.now() } = {}) {
  const rows = [...(list || [])].filter(u => u && u.title).sort((a, b) => day(b).localeCompare(day(a)))
  if (!rows.length) return null
  const dated = rows.filter(u => day(u))
  const nRep = rows.filter(isReport).length, nNews = rows.length - nRep
  const paras = []

  // 1. Cakupan.
  const span = dated.length ? ` dalam periode ${fmtDate(day(dated.at(-1)))} hingga ${fmtDate(day(dated[0]))}` : ''
  const parts = [nRep && `${nRep} keterbukaan informasi Stockbit`, nNews && `${nNews} berita media`].filter(Boolean)
  paras.push(`Terdapat ${rows.length} laporan dan berita mengenai ${ticker}${span}, ${parts.length > 1 ? 'terdiri atas ' + parts.join(' dan ') : 'seluruhnya berupa ' + parts[0].replace(/^\d+ /, '')}.`)

  // 2. Topik dominan (di luar "lainnya").
  const cnt = {}
  for (const u of rows) if (u.type && u.type !== 'lainnya') cnt[u.type] = (cnt[u.type] || 0) + 1
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])
  if (top.length) paras.push(`Topik yang paling sering muncul adalah ${top.slice(0, 3).map(([t, n]) => `${typeName(t)} (${n})`).join(', ')}.`)
  else paras.push('Sebagian besar keterbukaan bersifat administratif dan belum menyinggung aksi korporasi yang material.')

  // 3. Perkembangan material 30 hari terakhir.
  const recent = dated.filter(u => u.type && u.type !== 'lainnya' && now - Date.parse(day(u)) <= 30 * DAY)
  const points = recent.slice(0, 3).map(u => `${fmtDate(day(u))}: ${u.title}`)
  // Inti dari keterbukaan terbaru (30 hari) yang memiliki ringkasan, apa pun jenisnya.
  const inti = intiOf(dated.find(u => now - Date.parse(day(u)) <= 30 * DAY && intiOf(u)) || {})
  if (inti) paras.push(`Inti keterbukaan material terakhir: ${inti.replace(/\.?$/, '.')}`)

  // 4. Kesimpulan.
  const kinds = new Set(recent.map(u => u.type))
  const read = READ.find(([k]) => kinds.has(k))
  const last = dated[0] ? Math.round((now - Date.parse(day(dated[0]))) / DAY) : null
  const verdict = read ? read[1]
    : last != null && last > 30 ? `Tidak ada keterbukaan baru selama ${last} hari terakhir; aksi korporasi tampak berada dalam fase tenang.`
    : 'Belum ada keterbukaan material dalam 30 hari terakhir; aksi korporasi tampak berada dalam fase tenang.'
  return { paras, points, verdict, tone: read ? (read[0] === 'uma' ? 'warn' : 'now') : 'calm' }
}
