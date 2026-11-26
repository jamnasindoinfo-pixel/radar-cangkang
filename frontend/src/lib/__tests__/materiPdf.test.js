import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { lebarKolom, materiPdf } from '../materiPdf.js'
import { BAGIAN, SLIDE } from '../harmonikMateri.js'

describe('materiPdf', () => {
  it('lebar kolom total 182 mm, minimal 18 mm', () => {
    const w = lebarKolom(['A', 'Keterangan panjang'], [['1', 'teks yang cukup panjang untuk kolom kedua']])
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(182, 5)
    expect(Math.min(...w)).toBeGreaterThanOrEqual(18 * 182 / w.reduce((a, b) => a + b, 0) - 1e-9)
  })
  it('membuat dokumen bergaya makalah dari seluruh slide', () => {
    const doc = materiPdf({ slide: SLIDE, bagian: BAGIAN }, jsPDF)
    expect(doc.getNumberOfPages()).toBeGreaterThan(BAGIAN.length)
    const isi = doc.output()
    expect(isi).toContain('Daftar isi')
    expect(isi).not.toContain('Kuis')
  })
})
