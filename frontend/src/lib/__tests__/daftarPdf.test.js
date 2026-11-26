import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { daftarPdf, daftarPdfName, miliar, pct } from '../daftarPdf.js'

describe('daftarPdf', () => {
  it('membuat PDF dengan tabel berhalaman dan bagian kosong', async () => {
    const cols = [{ t: 'Saham', w: 30 }, { t: 'Harga', w: 40, align: 'right' }, { t: 'Net', w: 112, align: 'right' }]
    const rows = Array.from({ length: 120 }, (_, i) => [{ t: 'K' + i, bold: true }, '1.000', { t: miliar(-2e9) }])
    const doc = await daftarPdf({ seri: 'Riset Uji', judul: 'Uji', label: 'UJI', updated: '2026-10-30', box: [['A', '1']],
      bagian: [{ judul: 'Isi', ket: 'Keterangan', cols, rows }, { judul: 'Kosong', cols, rows: [] }] }, jsPDF)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(5)
    expect(pct(1.234)).toBe('+1,2%')
    expect(daftarPdfName('Low')).toMatch(/^Riset-Low_\d{4}-\d\d-\d\d\.pdf$/)
  })
})
