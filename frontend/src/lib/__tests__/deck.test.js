import { describe, it, expect } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import { sectorOf, pickTheme, THEMES, SECTORS } from '../deckThemes.js'
import { short, buildDeck, deckFileName } from '../deck.js'

describe('sectorOf', () => {
  it('mengenali bisnis dari teks', () => {
    expect(sectorOf({ baru: 'tambang batu bara di Kalimantan' }).id).toBe('batubara')
    expect(sectorOf({ aset: 'smelter nikel' }).id).toBe('logam')
    expect(sectorOf({ baru: 'rumah sakit jantung' }).id).toBe('kesehatan')
    expect(sectorOf({ sektor: 'Technology', industri: 'Software' }).id).toBe('teknologi')
  })
  it('pelayaran pengangkut batu bara tetap logistik', () => {
    expect(sectorOf({ baru: 'pelayaran tongkang batu bara' }).id).toBe('logistik')
  })
  it('jatuh ke umum bila tidak ada petunjuk', () => {
    expect(sectorOf({ nama: 'PT Xyz Tbk' }).id).toBe('umum')
    expect(sectorOf().id).toBe('umum')
  })
})

describe('pickTheme', () => {
  it('setiap sektor punya tiga varian dengan id unik', () => {
    for (const s of SECTORS) expect(THEMES[s.id]?.length).toBe(3)
    const ids = Object.values(THEMES).flat().map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('tidak mengulang tema unduhan sebelumnya', () => {
    for (const r of [0, 0.5, 0.99]) {
      const last = THEMES.batubara[0].id
      expect(pickTheme('batubara', { lastId: last, rand: () => r }).id).not.toBe(last)
    }
  })
  it('pilihan manual dihormati, termasuk tema sektor lain', () => {
    expect(pickTheme('batubara', { choose: THEMES.kesehatan[1].id }).id).toBe(THEMES.kesehatan[1].id)
  })
})

describe('short', () => {
  it('teks pendek tidak diubah', () => expect(short('Halo dunia', 20)).toBe('Halo dunia'))
  it('tidak memotong kalimat: ambil kalimat lengkap yang muat', () => {
    expect(short('Pengendali baru masuk lewat tender wajib. Inbreng aset tambang menyusul tahun depan.', 50)).toBe('Pengendali baru masuk lewat tender wajib.')
  })
  it('kalimat pertama yang panjang tetap utuh, tanpa elipsis', () => {
    const t = 'Inbreng 45% TCP senilai Rp1,6 T pada harga indikatif Rp450–550, jauh di atas harga Rp106.'
    expect(short(t, 60)).toBe(t)
  })
  it('singkatan "maks." bukan akhir kalimat', () => {
    expect(short('Nilai injeksi BTL (maks. USD125 juta) besar. Pantau KJPP.', 45)).toBe('Nilai injeksi BTL (maks. USD125 juta) besar.')
  })
})

describe('buildDeck', () => {
  // Data minimal: slide yang datanya kosong harus dilewati tanpa galat.
  const d = {
    t: 'ABCD', name: 'PT Abcd Tbk', sector: SECTORS.find(s => s.id === 'umum'), date: '2026-10-21',
    A: { score: 50, verdict: 'Netral', dims: [], p: {}, sv: {} }, pc: { pros: [], cons: [] }, deep: [], steps: [], milestones: [],
  }
  it('menghasilkan slide tanpa ukuran negatif atau NaN', async () => {
    for (const th of Object.values(THEMES).flat().slice(0, 3)) {
      const pres = buildDeck(PptxGenJS, d, th)
      expect(pres.slides.length).toBeGreaterThan(1)
      const json = JSON.stringify(pres.slides.map(s => s._slideObjects.map(o => o.options)))
      expect(json).not.toMatch(/"[wh]":-|NaN/)
    }
  })
  it('nama berkas aman', () => {
    expect(deckFileName('ABCD', '2026-10-21', { name: 'Arang & Amber' })).toBe('ABCD_Analisa_2026-10-21_Arang-Amber.pptx')
  })
})

describe('buildDeck: rekomendasi & PDF', () => {
  it('ringkasan & rekomendasi di bagian penutup (setelah analisa), PDF sama jumlah halamannya', async () => {
    const { recommend } = await import('../recommend.js')
    const { jsPDF } = await import('jspdf')
    const { deckToPdf } = await import('../deckPdf.js')
    const d2 = { t: 'ABCD', name: 'PT Abcd Tbk', sector: SECTORS.find(s => s.id === 'umum'), date: '2026-10-22',
      A: { score: 50, price: 100, dims: [{ k: 'Pengendali', s: 5, why: ['a.', 'b.'] }], p: { metrics: { pbv: 1.2, per: 10, equity: 1e11, cash: 1e10 } }, sv: {}, levels: [['Harga PTW', '', 120]], checks: ['x'], exits: ['y'] },
      pa: { sikap: 'Netral', tesis: 'Kalimat pertama yang cukup panjang. Kalimat kedua yang juga cukup panjang.', variabelKunci: ['v'], tesisSalahBila: ['w'] },
      pc: { pros: [], cons: [] }, deep: [], steps: [], milestones: [], reports: [] }
    d2.rec = recommend(d2)
    const pres = buildDeck(PptxGenJS, d2, Object.values(THEMES).flat()[0])
    const titles = pres.slides.map(s => s._slideObjects.map(o => o.text?.[0]?.text || '').join(' '))
    // Ringkasan rekomendasi di awal (setelah sampul); rekomendasi lengkap tetap di akhir, sebelum kesimpulan.
    expect(titles.findIndex(t => /RINGKASAN REKOMENDASI/.test(t))).toBe(1)
    const iRek = titles.findIndex(t => /\d+\. REKOMENDASI/.test(t)), iSkor = titles.findIndex(t => /SKOR ANALISIS/.test(t))
    expect(iRek).toBeGreaterThan(iSkor)
    expect(iRek).toBeGreaterThan(titles.length - 6)
    expect((await deckToPdf(pres, jsPDF)).getNumberOfPages()).toBe(pres.slides.length)
  })
})
