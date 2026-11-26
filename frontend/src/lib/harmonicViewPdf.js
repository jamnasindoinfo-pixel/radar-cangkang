// Unduhan analisa halaman Harmonic Pattern (PDF, A4 tegak), fokus teknikal harmonic: chart seperti di layar (dengan
// gambar alat yang aktif), pola XABCD dan alasannya (rasio aktual vs ideal, kenapa titik X), PRZ dengan konfirmasi
// Fibonacci (retracement XA, proyeksi AB=CD), konteks Elliott singkat, dan rencana Long/Short. Format sama dengan
// PDF riset lain (sampul berpita, halaman berbingkai, disclaimer).
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, frame, heading, para, kpi } from './ihsgPdf.js'
import { sampul, tabel, disclaimer } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'
import { chartPdf } from './harmonikPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(String(d || '').slice(0, 10)); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const n = v => v == null || !isFinite(v) ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: v < 200 ? 1 : 0 })
const r3 = v => v == null ? '-' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const p1 = v => v == null ? '-' : (v > 0 ? '+' : '') + Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const BAWAH = 272

// s: { t, nama, tfNama, bars, hasil, rasio (baris tabel), alasan, teksX, pembeda, status, kesimpulan, foto, lot }
export function harmonicViewPdf(s, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const { hasil: h, bars } = s, x = h.xabcd, akhir = bars[bars.length - 1] || {}
  const seri = `Harmonic Pattern ${s.t} · ${s.tfNama}`
  let hal = 1, y = 0, judulKini = ''
  const halaman = judul => { judulKini = judul; doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  const ruang = tinggi => { if (y + tinggi > BAWAH) halaman(`${judulKini.replace(/ \(lanjutan\)$/, '')} (lanjutan)`) }
  const sub = (t, warna = PRIMER) => {
    ruang(20)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(warna); doc.text(pdfText(t), 14, y)
    doc.setDrawColor(warna); doc.setLineWidth(0.4); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }
  const butir = (rows, warna = INK) => {
    for (const t of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8)
      const lines = doc.splitTextToSize(pdfText(`• ${t}`), 178), tinggi = lines.length * 8.8 * 0.3528 * 1.4 + 1.4
      ruang(tinggi)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(warna)
      doc.text(lines, 18, y, { lineHeightFactor: 1.4 }); y += tinggi
    }
  }
  const tbl = (cols, rows) => { ruang(16); y = tabel(doc, 14, y + 2, cols, rows, 8.5, { baru: () => { halaman(`${judulKini} (lanjutan)`); return y }, bawah: BAWAH }) + 2 }

  const judulPola = x?.pola ? `${x.nama} ${x.arah}` : 'Belum ada pola harmonik'
  sampul(doc, {
    besar: s.t, judul: 'Analisa Harmonic Pattern', label: `${s.nama || s.t} · ${s.tfNama} · ${tgl(akhir.d)}`,
    sub: x?.pola ? `${judulPola}, ${s.status}. PRZ ${n(x.prz[0])}–${n(x.prz[1])}, stop ${n(x.stop)}, target ${n(x.target[0])} / ${n(x.target[1])}.`
      : 'Lima swing terakhir belum memenuhi rasio pola harmonik baku (toleransi ±5%).',
    updated: String(akhir.d || '').slice(0, 10), seri: bars.slice(-120).map(b => b.c),
    box: [['Pola', judulPola], ['Status', x?.pola ? s.status : '-'], ['Timeframe', s.tfNama], ['Harga terakhir', n(akhir.c)]],
    catatan: `Disusun otomatis dari candle Stockbit (${bars.length} bar ${s.tfNama.toLowerCase()}) di halaman Harmonic Pattern Radar Backdoor. Bukan ajakan membeli atau menjual efek.`,
  })

  // Chart: foto chart di layar (dengan gambar alat aktif) bila ada; cadangan chart vektor XABCD.
  halaman('Chart dan pola')
  if (s.foto?.url) {
    const w = 182, tinggi = Math.min(120, w * s.foto.h / s.foto.w)
    doc.addImage(s.foto.url, s.foto.jenis || 'PNG', 14, y - 2, w, tinggi)
    y += tinggi + 2
    y = para(doc, `Chart ${s.tfNama.toLowerCase()} seperti di layar. Alat yang tampil: ${s.alatAktif.length ? s.alatAktif.join(', ') : 'tidak ada'}.`, 14, y + 2, 182, 8, MUTED) + 2
  } else {
    const row = x ? { ...x, titik: x.titik.filter(t => !t.proyeksi).map(t => ({ n: t.n, d: bars[t.i]?.d, p: t.p })) } : null
    chartPdf(doc, bars, x?.pola ? row : null, x ? row.titik : [], 14, y - 2, 182, 92)
    y += 107
  }

  sub(`XABCD: ${judulPola}`)
  if (x?.pola) {
    butir([`Kenapa ${x.nama}: ${s.pembeda}`, `Status: ${s.status}.`, ...(s.tren ? [`Tren besar (EMA50/EMA200): ${s.tren}`] : [])])
    tbl([{ t: 'Rasio', w: 70 }, { t: 'Aktual', w: 30, align: 'right' }, { t: 'Ideal', w: 50, align: 'right' }, { t: 'Cocok', w: 32 }],
      s.alasan.map(a => [{ t: a.teks, bold: true }, r3(a.aktual), a.ideal, { t: a.ok ? 'ya' : 'mendekati', color: a.ok ? GOOD : GOLD }]))
  } else {
    butir(['Rasio lima swing terakhir belum masuk rentang pola mana pun. Pola harmonik jarang terbentuk sempurna; jangan dipaksakan. Pantau lagi setelah swing baru terbentuk.'])
    tbl([{ t: 'Rasio', w: 90 }, { t: 'Aktual', w: 92, align: 'right' }], s.rasio.map(r => [{ t: r[0], bold: true }, r3(r[1])]))
  }
  if (x?.pola) {
    sub(s.konf ? `Konfirmasi di D: ${s.konf.jumlah} dari ${s.konf.total} (${s.konf.label})` : 'Konfirmasi di D')
    butir(s.konf ? [...s.konf.cek.map(c => `${c.ok ? 'Ada' : 'Belum'}: ${c.teks}.`), 'Entry setelah minimal dua konfirmasi; PRZ adalah area, bukan sinyal beli/jual otomatis.']
      : ['D belum terbentuk. Konfirmasi (candle pembalikan, divergence RSI, tembus struktur minor, volume) dinilai setelah harga masuk PRZ.'])
  }
  sub('Titik pola')
  tbl([{ t: 'Titik', w: 18 }, { t: 'Tanggal', w: 40 }, { t: 'Harga', w: 34, align: 'right' }, { t: 'Keterangan', w: 90 }],
    (x?.titik || []).map((t, j, ts) => [{ t: t.n, bold: true }, t.proyeksi ? 'proyeksi' : tgl(bars[t.i]?.d), n(t.p),
      j === 0 ? 'awal pola, swing ' + (ts[1].p > t.p ? 'low' : 'high') : j === ts.length - 1 ? (t.proyeksi ? 'pusat PRZ (belum terbentuk)' : 'akhir pola, area pembalikan') : '']))
  sub('Kenapa titik X di sini')
  butir(s.teksX)

  // Konfirmasi Fibonacci di PRZ.
  halaman('PRZ dan konfirmasi Fibonacci')
  if (x?.pola) {
    const kw = 43.25
    kpi(doc, 14, y - 4, kw, 'PRZ', `${n(x.prz[0])}–${n(x.prz[1])}`, GOLD)
    kpi(doc, 14 + (kw + 3.7), y - 4, kw, 'Stop (pola batal)', n(x.stop), BAD)
    kpi(doc, 14 + 2 * (kw + 3.7), y - 4, kw, `Target 1 (${x.ketTarget?.[0] || '0,382 AD'})`, n(x.target[0]), GOOD)
    kpi(doc, 14 + 3 * (kw + 3.7), y - 4, kw, `Target 2 (${x.ketTarget?.[1] || '0,618 AD'})`, n(x.target[1]), GOOD)
    y += 24
  }
  for (const [k, judul] of [['fib', 'Fib retracement'], ['ext', 'Trend-based fib extension']]) {
    const f = h[k]
    if (!f) continue
    sub(`${judul}: ${f.dasar}`)
    const diPrz = l => x?.prz && l.p >= x.prz[0] && l.p <= x.prz[1]
    tbl([{ t: 'Level', w: 40 }, { t: 'Harga', w: 50, align: 'right' }, { t: 'Catatan', w: 92 }],
      f.level.map(l => [{ t: String(l.r).replace('.', ','), bold: [0.618, 0.786, 0.886, 1.27, 1.618].includes(l.r) }, n(l.p), diPrz(l) ? { t: 'di dalam PRZ', color: GOLD } : '']))
  }
  butir(['Makin banyak level Fibonacci (retracement XA, proyeksi AB=CD) yang berkumpul di PRZ, makin kuat zonanya (Carney). PRZ adalah area, bukan satu harga.'], MUTED)

  // Rencana posisi.
  halaman('Konteks tren dan rencana posisi')
  const e = h.elliott
  sub('Konteks Elliott wave')
  if (e) {
    butir([`Impuls ${e.naik ? 'naik' : 'turun'}, ${e.status}. ` + e.aturan.map(a => `${a.ok ? 'sesuai' : 'tidak sesuai'}: ${a.teks.toLowerCase()}`).join('; ') + '.',
      'Rasio: ' + e.panduan.map(p => `${p.k} ${r3(p.v)} (panduan ${p.ideal})`).join(', ') + '.',
      ...(e.proyeksi ? ['Proyeksi gelombang 5: ' + e.proyeksi.map(p => `${p.k} ${n(p.p)}`).join(', ') + '.'] : []),
      ...(s.ketElliott ? [s.ketElliott] : []),
      'Pola harmonik searah tren di akhir gelombang 2 atau 4 lebih layak daripada di akhir gelombang 5.'])
  } else butir(['Belum ada rangkaian swing terbaru yang memenuhi aturan impuls lima gelombang di timeframe ini.'])

  for (const k of ['long', 'short']) {
    const p = h[k]
    sub(k === 'long' ? 'Long position' : 'Short position', k === 'long' ? GOOD : BAD)
    if (!p || p.kosong) { butir([p?.catatan || 'Rencana belum bisa dihitung.']); continue }
    butir([`Dasar: ${p.dasar} (${p.aktif}).`])
    const lot = s.lot[k]
    tbl([{ t: 'Komponen', w: 50 }, { t: 'Harga', w: 40, align: 'right' }, { t: 'Jarak dari entry', w: 46, align: 'right' }, { t: 'R:R', w: 46, align: 'right' }], [
      [{ t: 'Entry', bold: true }, n(p.entry), '', ''],
      [{ t: 'Stop loss', bold: true }, n(p.stop), { t: p1(p.stopPct), color: BAD }, ''],
      [{ t: 'Take profit 1', bold: true }, n(p.target[0]), { t: p1(p.targetPct[0]), color: GOOD }, String(p.rr[0] ?? '-').replace('.', ',')],
      [{ t: 'Take profit 2', bold: true }, n(p.target[1]), { t: p1(p.targetPct[1]), color: GOOD }, String(p.rr[1] ?? '-').replace('.', ',')],
    ])
    if (lot) butir([`Ukuran posisi dengan modal Rp${n(s.modal)} dan risiko ${s.risiko}% per transaksi: ${lot.lot.toLocaleString('id-ID')} lot (Rp${n(lot.nilai)}), rugi maksimal bila kena stop Rp${n(lot.rugiMaks)}.`])
    if (k === 'short') butir(['Short selling di BEI hanya untuk saham dalam daftar efek short selling dan lewat anggota bursa berizin. Bagi yang tidak bisa short, pakai sebagai rencana jual atau ambil untung.'], MUTED)
  }
  sub('Kesimpulan', GOLD)
  butir(s.kesimpulan)

  disclaimer(doc, ++hal, String(akhir.d || '').slice(0, 10),
    'Pola dideteksi otomatis dari pivot zigzag beberapa skala dengan toleransi rasio ±5%. Rasio mengikuti Scott M. Carney, Harmonic Trading Vol. 1, '
    + 'artikel Astronacci tentang harmonic pattern dan area entry (PRZ, stop, target 0,382/0,618 AD), serta artikel Maxco. ')
  return doc
}

export const harmonicViewPdfName = (t, tf) => `Harmonic-${t}-${tf}_${new Date().toISOString().slice(0, 10)}.pdf`
