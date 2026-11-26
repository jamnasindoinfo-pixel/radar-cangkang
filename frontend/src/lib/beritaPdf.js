// Analisa berita/laporan terbaru satu emiten (PDF, A4 tegak, maks. 3 halaman) dengan format riset Seasonality:
// 1 sampul berpita; 2 kesimpulan, Tujuannya apa?, Cari tahu (temuan), Selidiki (uji dugaan); 3 isi dokumen,
// dampak positif | negatif, implikasi, tesis, pantauan, disclaimer ringkas.
// Data dari analisaBerita() (lib/beritaTerbaru.js). Tanpa warna merah; faktor negatif memakai oranye.
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, LINE, frame, heading, para, block } from './ihsgPdf.js'
import { sampul } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const warna = cls => cls === 'good' ? GOOD : cls === 'bad' ? BAD : MUTED
const potong = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s }
const BAWAH = 270   // batas isi halaman (di atas garis kaki)

// Judul kecil berwarna dengan garis bawah.
function sub(doc, text, x, y, w, color = PRIMER) {
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(color); doc.text(pdfText(text), x, y)
  doc.setDrawColor(color); doc.setLineWidth(0.4); doc.line(x, y + 1.6, x + w, y + 1.6)
  return y + 7
}

// Daftar butir dalam lebar tertentu; berhenti sebelum melewati batas bawah. Mengembalikan y akhir.
function butir(doc, rows, x, y, w, { size = 9, color = INK, tanda = '•' } = {}) {
  for (const r of rows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size)   // ukuran huruf diset sebelum teks dipecah per baris
    const lines = doc.splitTextToSize(pdfText(`${tanda} ${r}`), w)
    const h = lines.length * size * 0.3528 * 1.4 + 1.6
    if (y + h > BAWAH) break
    doc.setTextColor(color)
    doc.text(lines, x, y, { lineHeightFactor: 1.4 }); y += h
  }
  return y
}

export async function beritaPdf(a, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = `Analisa ${a.ticker}`
  const d = a.dampak
  sampul(doc, {
    besar: a.ticker, judul: 'Analisa berita terbaru', label: `${a.jenis} · ${tgl(a.tanggal)}`,
    sub: a.judul, updated: tgl(a.tanggal), seri: [],
    box: [['Sinyal', a.sinyal.label], ['Dampak bagi publik', d.label], ['Faktor + / -', `${d.positif.length} / ${d.negatif.length}`], ['Sikap analisa', a.tesis?.sikap || 'Belum dianalisa']],
    catatan: `Disusun otomatis dari ${a.laporan ? 'keterbukaan informasi' : 'berita'} ${a.sumber} dan analisa kurasi Radar Backdoor. Bukan ajakan membeli atau menjual efek.`,
  })

  // ---- Halaman 2: tujuan dan penyelidikannya (Tujuannya apa? -> Cari tahu -> Selidiki).
  doc.addPage(); frame(doc, 'Tujuan dan penyelidikan', 2, seri); heading(doc, 'Tujuan dan penyelidikan', 26)
  let y = block(doc, 'Kesimpulan', a.kesimpulan, 37) + 1
  const t = a.tujuan
  y = sub(doc, `Tujuannya apa?  (keyakinan ${t.keyakinan.toLowerCase()})`, 14, y + 2, 182, PRIMER)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(INK)
  const ut = doc.splitTextToSize(pdfText(t.utama), 178); doc.text(ut, 18, y, { lineHeightFactor: 1.35 }); y += ut.length * 4.9 + 1
  if (t.alasan) y = para(doc, t.alasan, 18, y, 178, 9)
  if (t.alternatif.length) y = para(doc, `Kemungkinan lain: ${t.alternatif.join('; ')}.`, 18, y, 178, 8.5, MUTED)
  y = sub(doc, 'Cari tahu: temuan dari dokumen dan data kurasi', 14, y + 2, 182)
  y = butir(doc, a.cari.map(x => `[${x.sumber}] ${potong(x.teks, 260)}`), 18, y, 178, { size: 8.5 }) + 1
  y = sub(doc, 'Selidiki: uji dugaan tujuan', 14, y + 2, 182, GOLD)
  for (const g of a.selidiki) {
    if (y > BAWAH - 12) break
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(g.skor >= 2 ? GOOD : g.skor === 1 ? GOLD : MUTED)
    const h = doc.splitTextToSize(pdfText(`${g.dugaan} - ${g.nilai}`), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.4 + 0.6
    y = butir(doc, g.bukti.map(b => b.teks), 22, y, 174, { size: 8.5, tanda: '›' }) + 1.5
  }
  if (!a.selidiki.length) y = para(doc, 'Belum ada bukti yang cukup untuk menguji dugaan tujuan.', 18, y, 178, 9, MUTED)

  // ---- Halaman 3: isi dokumen, dampak dua sisi, implikasi, tesis, pantauan, disclaimer ringkas.
  doc.addPage(); frame(doc, 'Dampak dan tesis', 3, seri); heading(doc, 'Dampak dan tesis', 26)
  y = 37
  if (a.ringkas) y = block(doc, 'Isi dokumen', potong(a.ringkas, 360), y) + 1
  if (a.poin.length) y = butir(doc, a.poin.slice(0, 5), 18, y, 178, { size: 8.5 }) + 1
  y = sub(doc, `Dampak bagi pemegang saham publik: ${d.label} (${a.sinyal.label.toLowerCase()})`, 14, y + 2, 182, warna(d.cls))
  if (d.catatan) y = para(doc, d.catatan, 14, y, 182, 9, MUTED)
  else {
    const y0 = y
    const yl = butir(doc, d.positif.length ? d.positif : ['Tidak teridentifikasi dari isi dokumen.'], 14, sub(doc, 'Dampak positif', 14, y0, 88, GOOD), 88, { size: 8.5, tanda: '+' })
    const yr = butir(doc, d.negatif.length ? d.negatif : ['Tidak teridentifikasi dari isi dokumen.'], 108, sub(doc, 'Dampak negatif / risiko', 108, y0, 88, BAD), 88, { size: 8.5, tanda: '-' })
    y = Math.max(yl, yr) + 1
  }
  if (a.implikasi.length) { y = sub(doc, 'Implikasi', 14, y + 2, 182); y = butir(doc, a.implikasi, 18, y, 178, { size: 8.5 }) + 1 }
  if (a.tesis) y = block(doc, `Tesis analisa per ${tgl(a.tesis.asOf)} · ${a.tesis.sikap}`, [potong(a.tesis.ringkas, 280), a.tesis.posisi].filter(Boolean).join(' '), y + 3) + 1
  // Pantauan dan tesis salah bila dua kolom.
  if (y < BAWAH - 30) {
    const y0 = y + 1
    const yl = butir(doc, a.pantau.slice(0, 3).map(p => potong(p, 160)), 14, sub(doc, 'Yang dipantau', 14, y0, 88), 88, { size: 8 })
    const yr = butir(doc, (a.salahBila.length ? a.salahBila : ['Belum ada kriteria dari analisa kurasi.']).slice(0, 2).map(p => potong(p, 180)), 108, sub(doc, 'Tesis salah bila', 108, y0, 88, GOLD), 88, { size: 8 })
    y = Math.max(yl, yr) + 3
  }

  // Disclaimer ringkas di bawah halaman terakhir.
  const dis = `Sumber: ${a.sumber}, ${tgl(a.tanggal)}${a.url ? ' (' + a.url + ')' : ''}. Tingkat sinyal, arah dampak, dan faktor positif/negatif dibaca otomatis dari judul, ringkasan, dan poin kunci dokumen; kaitan tesis dari analisa kurasi terakhir. `
    + 'Disusun otomatis oleh Radar Backdoor; tidak ada jaminan atas ketepatan atau kelengkapannya. Bukan penawaran, ajakan, atau rekomendasi membeli atau menjual efek; keputusan investasi sepenuhnya tanggung jawab pembaca.'
  const lines = doc.splitTextToSize(pdfText(dis), 182)
  const yd = Math.max(y, BAWAH + 4 - lines.length * 3.4)
  doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.line(14, yd - 4, 196, yd - 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED); doc.text(lines, 14, yd, { lineHeightFactor: 1.35 })
  return doc
}

export const beritaPdfName = a => `Analisa-${a.ticker}_Berita-${a.tanggal || new Date().toISOString().slice(0, 10)}.pdf`
