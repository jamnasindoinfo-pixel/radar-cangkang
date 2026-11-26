import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { chartPdf } from '../harmonikPdf.js'

const tgl = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
const bars = Array.from({ length: 150 }, (_, i) => { const c = 100 + 20 * Math.sin(i / 9); return { d: tgl(i), o: c * 0.99, h: c * 1.01, l: c * 0.98, c, v: 1e5 } })
const titik = [['X', 60], ['A', 75], ['B', 90], ['C', 105], ['D', 120]].map(([n, i]) => ({ n, d: tgl(i), p: Math.round(bars[i].c) }))

describe('chartPdf (chart cadangan PDF)', () => {
  it('menggambar pola dengan PRZ, stop, dan target', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    chartPdf(doc, bars, { titik, prz: [90, 95], stop: 85, target: [105, 112] }, [], 14, 30, 182, 92)
    const isi = doc.output()
    expect(isi).toContain('PRZ')
    expect(isi).toContain('Stop 85')
  })
  it('tanpa pola: swing terakhir saja', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    expect(() => chartPdf(doc, bars, null, titik, 14, 30, 182, 92)).not.toThrow()
    expect(doc.output()).not.toContain('PRZ')
  })
})
