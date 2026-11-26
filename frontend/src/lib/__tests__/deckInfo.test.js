import { describe, expect, it } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import { buildInfoDeck, infoFileName } from '../deckInfo.js'
import { THEMES, SECTORS } from '../deckThemes.js'

describe('infografis (slide 16:9 grafis)', () => {
  it('12 slide 16:9, PDF sama jumlah halamannya', async () => {
    const { recommend } = await import('../recommend.js')
    const { jsPDF } = await import('jspdf')
    const { deckToPdf } = await import('../deckPdf.js')
    const d = { t: 'ABCD', name: 'PT Abcd Tbk', sector: SECTORS.find(s => s.id === 'umum'), date: '2026-10-28',
      A: { score: 50, price: 100, dims: [], p: { metrics: {}, stats: {} }, sv: {}, levels: [], checks: [], exits: [] },
      pa: { nilaiWajar: { bawah: 90, atas: 150 } }, pc: { pros: [], cons: [] }, deep: [], steps: [], milestones: [], reports: [] }
    d.rec = recommend(d)
    const pres = buildInfoDeck(PptxGenJS, d, Object.values(THEMES).flat()[0])
    expect(pres.slides.length).toBe(12)
    const L = pres._presLayout || pres.presLayout
    expect(L.width).toBeGreaterThan(L.height)
    const pdf = await deckToPdf(pres, jsPDF)
    expect(pdf.getNumberOfPages()).toBe(12)
    expect(infoFileName('ABCD', '2026-10-28', { name: 'Biru Laut' })).toBe('ABCD_Infografis_2026-10-28_Biru-Laut.pptx')
  }, 60000)
})
