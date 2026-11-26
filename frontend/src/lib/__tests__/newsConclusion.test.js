import { describe, it, expect } from 'vitest'
import { newsConclusion } from '../newsConclusion.js'

const now = Date.parse('2026-10-22')
describe('newsConclusion', () => {
  it('kosong menghasilkan null', () => {
    expect(newsConclusion([], { now })).toBeNull()
  })
  it('merangkum cakupan, topik, inti, dan tafsiran terbaru', () => {
    const r = newsConclusion([
      { id: 'sb-report-1', date: '2026-10-20', type: 'rights', title: 'Prospektus HMETD', summary: 'Ringkas. Inti: Dana dipakai untuk akuisisi tambang (Ringkasan AI Stockbit)' },
      { id: 'sb-report-2', date: '2026-09-01', type: 'pengendali', title: 'Pengambilalihan' },
      { id: 'news-a', date: '2026-08-01', type: 'lainnya', title: 'Berita umum' },
    ], { ticker: 'ABCD', now })
    expect(r.paras[0]).toMatch(/Terdapat 3 laporan dan berita mengenai ABCD.*2 keterbukaan informasi Stockbit dan 1 berita media/)
    expect(r.paras[1]).toMatch(/penambahan modal\/injeksi aset \(1\)/)
    expect(r.paras[2]).toBe('Inti keterbukaan material terakhir: Dana dipakai untuk akuisisi tambang.')
    expect(r.points).toHaveLength(1)
    expect(r.verdict).toMatch(/tahap pendanaan/)
  })
  it('tanpa keterbukaan baru menyatakan fase tenang', () => {
    const r = newsConclusion([{ id: 'x', date: '2026-07-01', type: 'lainnya', title: 'Laporan bulanan' }], { now })
    expect(r.verdict).toMatch(/Tidak ada keterbukaan baru selama 113 hari/)
    expect(r.tone).toBe('calm')
  })
})
