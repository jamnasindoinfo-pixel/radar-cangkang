// Unduhan tab Materi sebagai dokumen bergaya makalah (PDF, A4 tegak): sampul, daftar isi per bagian, isi tiap slide
// (judul, paragraf, poin, tabel, rujukan) bab demi bab. Format sama dengan
// PDF riset lain (sampul berpita, halaman berbingkai).
import { MUTED, INK, PRIMER, GOLD, frame, heading } from './ihsgPdf.js'
import { sampul, tabel } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'

const BAWAH = 272
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

// Lebar kolom tabel sebanding panjang isi terpanjang tiap kolom (minimal 18 mm), total 182 mm.
export function lebarKolom(kolom, baris, total = 182) {
  const panjang = kolom.map((k, i) => Math.max(k.length, ...baris.map(b => String(b[i] ?? '').length), 6))
  const akar = panjang.map(p => Math.sqrt(p)), jumlah = akar.reduce((a, b) => a + b, 0)
  const w = akar.map(a => Math.max(18, a / jumlah * total))
  const skala = total / w.reduce((a, b) => a + b, 0)
  return w.map(x => x * skala)
}

export function materiPdf({ slide, bagian }, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = 'Materi Harmonic Pattern'
  let hal = 1, y = 0, judulKini = ''
  const halaman = judul => { judulKini = judul; doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  const ruang = h => { if (y + h > BAWAH) halaman(`${judulKini.replace(/ \(lanjutan\)$/, '')} (lanjutan)`) }
  const teks = (t, { size = 9.5, warna = INK, font = 'normal', indent = 14, lebar = 182, jarak = 2 } = {}) => {
    doc.setFont('helvetica', font); doc.setFontSize(size)
    const lines = doc.splitTextToSize(pdfText(t), lebar), h = lines.length * size * 0.3528 * 1.45
    ruang(h + jarak)
    doc.setFont('helvetica', font); doc.setFontSize(size); doc.setTextColor(warna)
    doc.text(lines, indent, y, { lineHeightFactor: 1.45 }); y += h + jarak
  }
  const sub = t => {
    ruang(22)
    doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(PRIMER); doc.text(pdfText(t), 14, y)
    doc.setDrawColor(PRIMER); doc.setLineWidth(0.3); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }

  sampul(doc, {
    besar: 'XABCD', judul: 'Harmonic Pattern pada Saham BEI', label: 'Kajian Harmonic Trading Vol. 1 (Scott M. Carney)',
    sub: 'Pendahuluan, landasan teori, pembahasan pola, eksekusi dan manajemen, metodologi deteksi otomatis, penerapan di saham Bursa Efek Indonesia, dan penutup.',
    updated: new Date().toISOString().slice(0, 10), seri: [],
    box: [['Bagian', String(bagian.length)], ['Slide', String(slide.length)], ['Sumber utama', 'Carney (2010)']],
    catatan: 'Ringkasan dengan kata sendiri, disesuaikan untuk saham BEI. Bahan belajar analisa teknikal, bukan saran membeli atau menjual efek.',
  })

  // Daftar isi.
  halaman('Daftar isi')
  bagian.forEach((b, n) => {
    const isi = slide.filter(s => s.bagian === b)
    if (!isi.length) return
    teks(`${ROMAWI[n]}. ${b}`, { size: 11, font: 'bold', warna: PRIMER, jarak: 1 })
    for (const s of isi) teks(s.judul, { size: 9.5, indent: 22, lebar: 170, jarak: 0.5 })
    y += 2
  })

  // Isi per bagian: setiap bagian mulai di halaman baru.
  bagian.forEach((b, n) => {
    const isi = slide.filter(s => s.bagian === b)
    if (!isi.length) return
    halaman(`${ROMAWI[n]}. ${b}`)
    for (const s of isi) {
      sub(s.judul)
      if (s.sub) teks(s.sub, { size: 9, warna: MUTED, font: 'italic' })
      for (const p of s.paragraf || []) teks(p, { size: 9.8, jarak: 2.4 })
      for (const p of s.poin || []) teks(`• ${p}`, { size: 9.5, indent: 18, lebar: 176, jarak: 1 })
      if (s.tabel) {
        ruang(18)
        const w = lebarKolom(s.tabel.kolom, s.tabel.baris)
        const baris = s.tabel.baris.map(b => b.map((t, i) => ({ t, bold: i === 0 })))   // kolom pertama tebal
        y = tabel(doc, 14, y + 4, s.tabel.kolom.map((t, i) => ({ t, w: w[i] })), baris, 8.3,
          { baru: () => { halaman(`${judulKini.replace(/ \(lanjutan\)$/, '')} (lanjutan)`); return y }, bawah: BAWAH }) + 1
      }
      if (s.rujukan) teks(`Rujukan: ${s.rujukan}`, { size: 8, warna: GOLD })
      y += 3
    }
  })

  return doc
}

export const materiPdfName = () => `Materi-Harmonic-Pattern_${new Date().toISOString().slice(0, 10)}.pdf`
