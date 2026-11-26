// Analisa khusus insider (PDF, A4 tegak), terpisah dari analisa mendalam: pemegang baru >=5% dan petunjuknya,
// pergerakan per pihak 30/90/180 hari, daftar keterbukaan terbaru, catatan insider dari analisa mendalam (bila ada),
// dan yang perlu dicek. Data dari analisaInsider (lib/insiderAnalisa.js). Gaya sama dengan povDalamPdf.
import { MUTED, GOOD, INK, PRIMER, GOLD, LINE, frame, heading, para } from './ihsgPdf.js'
import { sampul } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'
import { tglPendek } from './insiderAnalisa.js'

const BAWAH = 272
const p2 = v => (+v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(+v || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })
const jt = v => v == null ? '-' : (Math.abs(v) / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt'
const ACT = { BUY: 'beli', SELL: 'jual', CROSS: 'crossing', TRANSFER: 'pengalihan', PRIVATE_PLACEMENT: 'private placement', RIGHT_ISSUE: 'rights issue', TENDER_OFFER: 'tender offer' }

// t = kode saham, nama = nama emiten, a = analisaInsider(...).
export async function insiderPdf({ t, nama = '', a }, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = `Analisa insider ${t}`
  let hal = 1, y = 0, judulKini = ''
  const halaman = judul => { doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  const ruang = h => { if (y + h > BAWAH) halaman(`${judulKini} (lanjutan)`) }
  const sub = (text, color = PRIMER) => {
    ruang(26)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(color); doc.text(pdfText(text), 14, y)
    doc.setDrawColor(color); doc.setLineWidth(0.4); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }
  const butir = (rows, { size = 8.8, color = INK, tanda = '•', x = 18, w = 178 } = {}) => {
    for (const r of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const lines = doc.splitTextToSize(pdfText(`${tanda} ${r}`), w)
      const h = lines.length * size * 0.3528 * 1.4 + 1.4
      ruang(h)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(color)
      doc.text(lines, x, y, { lineHeightFactor: 1.4 }); y += h
    }
  }
  const teks = (s, size = 9, color = INK) => { ruang(10); y = para(doc, s, 18, y, 178, size, color) }

  const dataAkhir = a.akhirData ? tglPendek(a.akhirData) : '-'
  sampul(doc, {
    besar: t, judul: 'Analisa insider', label: `${nama || t} · data sampai ${dataAkhir}`,
    sub: a.baru.length ? `Pemegang baru ≥5%: ${a.baru.map(b => `${b.nama} ${p2(b.cur)}`).join(', ')}.` : 'Tidak ada pemegang baru ≥5% dalam 90 hari.',
    updated: a.akhirData, seri: [],
    box: [['Pemegang baru ≥5%', String(a.baru.length)], ['Pihak bergerak', String(a.pihak.length)],
      ['Keterbukaan', String(a.terbaru.length)], ['Analisa mendalam', a.analisa?.dibuat ? tglPendek(a.analisa.dibuat) : 'belum ada']],
    catatan: 'Disusun otomatis dari keterbukaan pemegang saham IDX dan KSEI (Stockbit InsiderNews) dan, bila ada, analisa mendalam emiten. '
      + 'Petunjuk di dokumen ini adalah kecocokan angka yang perlu dicek, bukan kesimpulan. Bukan ajakan membeli atau menjual efek.',
  })

  // ---- Pemegang baru dan petunjuknya.
  judulKini = 'Pemegang baru ≥5%'; halaman(judulKini)
  if (!a.baru.length) teks('Tidak ada pihak yang baru melewati 5% dalam 90 hari terakhir.', 9, MUTED)
  for (const b of a.baru) {
    sub(`${b.nama}${b.asing ? ' (asing)' : ''}: ${p2(b.prev)} → ${p2(b.cur)}, ${tglPendek(b.date)}`, GOLD)
    butir([
      `Jumlah: ${b.lembar ? jt(b.lembar) + ' lembar' : '-'}${b.harga ? `; harga ${b.hargaPerkiraan ? 'perkiraan ' : ''}Rp${b.harga.toLocaleString('id-ID')}` : ''}`
        + `${b.nilai ? `; nilai ±Rp${(b.nilai / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} miliar` : ''}.`,
      `Sumber: ${b.sumber}${b.broker ? `, broker ${b.broker}` : ''}. ${b.terverifikasi ? 'Ada keterbukaan IDX dari pihak ini.' : 'Belum ada keterbukaan IDX dari pihak ini.'}`,
      `Tafsiran: ${b.tafsir}`,
      ...(b.brokerSama.length ? [`Broker sama: ${b.broker} juga dipakai ${b.brokerSama.join(', ')} dalam 180 hari.`] : []),
      ...b.mirip.map(m => `Lembar mirip: ${m.jenis} ${m.nama} ${jt(m.lembar)} lembar pada ${tglPendek(m.date)} (selisih ${Math.abs(m.lembar / b.lembar - 1).toLocaleString('id-ID', { style: 'percent', maximumFractionDigits: 1 })}).`),
      ...b.aksiMirip.map(x => `Keterbukaan ${tglPendek(x.date)} dengan jumlah lembar mirip: ${x.judul}${x.inti ? ' — ' + x.inti : ''}`),
    ], { size: 8.6 })
    y += 1
  }

  // ---- Pergerakan per pihak.
  judulKini = 'Pergerakan pemegang saham'; halaman(judulKini)
  sub('Perubahan bersih per pihak (poin persen)')
  if (!a.pihak.length) teks('Tidak ada keterbukaan pemegang saham dalam 180 hari.', 9, MUTED)
  butir(a.pihak.slice(0, 12).map(p => `${p.nama}: 30 hari ${sgn(p.ubah[30])}, 90 hari ${sgn(p.ubah[90])}, 180 hari ${sgn(p.ubah[180])}; kini ${p2(p.kini)} (terakhir ${tglPendek(p.akhir)}, ${p.n} baris)`), { size: 8.6 })
  sub('Keterbukaan terbaru')
  butir(a.terbaru.slice(0, 25).map(r => `${tglPendek(r.date)}: ${r.name}${r.foreign ? ' (asing)' : ''} ${r.prevUnknown ? '?' : p2(r.prev)} → ${p2(r.cur)}`
    + `${r.chgShares ? `, ${sgn(r.chgShares / 1e6)} jt lembar` : ''}${r.price ? `, Rp${r.price.toLocaleString('id-ID')}${r.estPrice ? ' (perkiraan)' : ''}` : ''}`
    + `, ${ACT[r.action] || 'aksi belum ada'}, ${r.source}${r.broker ? ' · ' + r.broker : ''}${r.purpose ? '; ' + r.purpose : ''}`), { size: 8.2 })

  // ---- Dari analisa mendalam.
  if (a.analisa) {
    judulKini = 'Catatan dari analisa mendalam'; halaman(judulKini)
    if (a.analisa.lama) teks(`Analisa mendalam dibuat ${tglPendek(a.analisa.dibuat)}, sebelum keterbukaan terakhir (${dataAkhir}); bagian ini belum memuat data terbaru.`, 8.8, GOLD)
    if (a.analisa.pemegang.length) { sub('Pemegang saham tercatat (profil)'); butir(a.analisa.pemegang.map(s => `${s.name}: ${p2(s.pct)}`), { size: 8.6 }) }
    if (a.analisa.insider.length) {
      sub('Transaksi orang dalam 180 hari (dihitung analisa mendalam)')
      butir(a.analisa.insider.map(x => `${x.nama}: ${sgn(x.chg)} poin dalam ${x.n} transaksi, terakhir ${tglPendek(x.akhir)}${x.harga ? `, rata-rata ±Rp${x.harga}` : ''}${x.tujuan ? '; ' + x.tujuan : ''}`), { size: 8.6 })
    }
    if (a.analisa.riwayat.length) { sub('Peristiwa kepemilikan penting'); butir(a.analisa.riwayat.map(r => `${tglPendek(r.date)}: ${r.teks}`), { size: 8.4 }) }
    if (a.analisa.marketMaker.length) { sub('Broker yang dipakai orang dalam'); butir(a.analisa.marketMaker, { size: 8.4 }) }
    if (a.analisa.harga.length) { sub('Harga masuk pihak besar'); butir(a.analisa.harga, { size: 8.4 }) }
  }

  // ---- Yang perlu dicek.
  judulKini = 'Yang perlu dicek'; if (y > 200) halaman(judulKini); else sub(judulKini, GOOD)
  if (!a.cek.length) teks('Tidak ada petunjuk khusus dari data insider periode ini.', 9, MUTED)
  butir(a.cek, { size: 8.8 })

  const dis = 'Disusun otomatis oleh Radar Backdoor dari keterbukaan pemegang saham IDX dan KSEI (Stockbit InsiderNews). Data KSEI dicatat per rekening; '
    + 'pemegang yang baru tercatat di KSEI tanpa keterbukaan IDX bisa pembeli baru atau pemegang lama yang mengonversi saham warkat. '
    + 'Kecocokan broker atau jumlah lembar adalah petunjuk, bukan bukti hubungan antarpihak. Bukan penawaran, ajakan, atau rekomendasi membeli atau menjual efek.'
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const lines = doc.splitTextToSize(pdfText(dis), 182)
  ruang(lines.length * 3.4 + 6)
  doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.line(14, y + 1, 196, y + 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED); doc.text(lines, 14, y + 5, { lineHeightFactor: 1.35 })
  return doc
}

export const insiderPdfName = (t, a) => `Analisa-Insider-${t}_${a.akhirData || new Date().toISOString().slice(0, 10)}.pdf`
