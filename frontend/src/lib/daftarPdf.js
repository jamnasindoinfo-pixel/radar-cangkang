// Riset daftar saham (PDF, A4 tegak) untuk tab Pola Broker, Recovery, dan Low, dengan format yang sama seperti
// riset IHSG: sampul, satu atau beberapa tabel berhalaman (judul kolom diulang), lalu disclaimer. Tanpa warna merah.
import { MUTED, GOOD, BAD, frame, heading, para } from './ihsgPdf.js'
import { sampul, tabel, disclaimer } from './ihsgModelPdf.js'

export const n0 = v => v == null || isNaN(v) ? '-' : Math.round(v).toLocaleString('id-ID')
export const pct = v => v == null || isNaN(v) ? '-' : `${v > 0 ? '+' : ''}${(+v).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
export const warna = v => v == null || isNaN(v) ? undefined : v > 0 ? GOOD : v < 0 ? BAD : MUTED
export const miliar = v => v == null ? '-' : `${v < 0 ? '-' : '+'}Rp${(Math.abs(v) / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`

// spec: { seri, judul, label, sub, updated, box: [[label, nilai]], bagian: [{ judul, ket, cols, rows }], metode }
export async function daftarPdf(spec, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  sampul(doc, { judul: spec.judul, label: spec.label, sub: spec.sub || '', updated: spec.updated, seri: [], box: spec.box || [],
    catatan: 'Disusun otomatis dari data Stockbit (harga harian, broker activity) dan Seasonality. Bukan ajakan membeli atau menjual efek.' })
  let page = 1
  for (const b of spec.bagian || []) {
    const baru = () => { doc.addPage(); frame(doc, b.judul, ++page, spec.seri); return 22 }
    let y = baru()
    heading(doc, b.judul, y + 6); y += 15
    if (b.ket) y = para(doc, b.ket, 14, y, 182, 8.5, MUTED)
    if (!b.rows.length) { para(doc, 'Tidak ada saham pada saringan ini.', 14, y + 2, 182, 9, MUTED); continue }
    tabel(doc, 14, y + 2, b.cols, b.rows, 8, { baru })
  }
  disclaimer(doc, ++page, spec.updated, spec.metode || '')
  return doc
}

export const daftarPdfName = nama => `Riset-${nama}_${new Date().toISOString().slice(0, 10)}.pdf`
