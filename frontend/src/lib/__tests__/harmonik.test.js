import { describe, it, expect } from 'vitest'
import { hitungHarmonik, hitungSaring, lolosSaring, rentang, idxTanggal, HM_STATUS } from '../harmonik.js'

const rows = [
  { t: 'AAAA', status: 'prz', arah: 'bullish' },
  { t: 'BBBB', status: 'menuju', arah: 'bearish' },
  { t: 'CCCC', status: 'menuju', arah: 'bullish' },
]

describe('screening harmonik', () => {
  it('menghitung per status dan arah', () => {
    expect(hitungHarmonik(rows)).toEqual({ semua: 3, prz: 1, berbalik: 0, menuju: 2, bullish: 2, bearish: 1 })
    expect(hitungHarmonik()).toEqual({ semua: 0, prz: 0, berbalik: 0, menuju: 0, bullish: 0, bearish: 0 })
  })
  it('label status lengkap', () => {
    expect(Object.keys(HM_STATUS)).toEqual(['prz', 'berbalik', 'menuju'])
  })
  it('rentang rasio format Indonesia', () => {
    expect(rentang([0.618, 0.618])).toBe('0,618')
    expect(rentang([0.382, 0.886])).toBe('0,382–0,886')
    expect(rentang(undefined)).toBe('–')
  })
  it('idxTanggal mencari bar pada/sesudah tanggal', () => {
    const bars = ['2026-01-02', '2026-01-05', '2026-01-06'].map(d => ({ d }))
    expect(idxTanggal(bars, '2026-01-03')).toBe(1)
    expect(idxTanggal(bars, '2026-01-06')).toBe(2)
    expect(idxTanggal(bars, '2099-01-01')).toBe(2)
  })
})

describe('saringan Screening', () => {
  // Data seperti Screening 24 Nov 2026: dua pola kuat, satu bullish (ADMR) dan satu bearish (INTP).
  const rows = [
    { t: 'ADMR', nama: 'Alamtri Minerals', pola: 'shark', arah: 'bullish', status: 'menuju' },
    { t: 'INTP', nama: 'Indocement', pola: 'gartley', arah: 'bearish', status: 'prz' },
    { t: 'AUTO', nama: 'Astra Otoparts', pola: 'bat', arah: 'bullish', status: 'prz', radar: true },
    { t: 'BBRI', nama: 'Bank Rakyat', pola: 'bat', arah: 'bearish', status: 'menuju' },
  ]
  const tingkat = { ADMR: 'kuat', INTP: 'kuat', AUTO: 'sedang', BBRI: 'lemah' }
  const kuatOf = r => tingkat[r.t] || ''

  it('angka Kuat mengikuti saringan arah yang aktif', () => {
    const f = { arah: 'bullish', kuat: 'kuat' }
    expect(hitungSaring(rows, f, kuatOf).kuat.kuat).toBe(1)
    expect(rows.filter(r => lolosSaring(r, f, kuatOf)).map(r => r.t)).toEqual(['ADMR'])
    // Tanpa saringan arah, kedua pola kuat terhitung dan tampil.
    expect(hitungSaring(rows, { kuat: 'kuat' }, kuatOf).kuat.kuat).toBe(2)
  })

  it('angka di satu kelompok tidak tersaring oleh pilihan di kelompok itu sendiri', () => {
    const h = hitungSaring(rows, { arah: 'bullish', kuat: 'kuat' }, kuatOf)
    // Kelompok arah dihitung dari pola kuat: 1 bullish, 1 bearish.
    expect(h.arah.bullish).toBe(1)
    expect(h.arah.bearish).toBe(1)
    // Kelompok status dihitung dari pola bullish dan kuat saja.
    expect(h.status.semua).toBe(1)
    expect(h.status.menuju).toBe(1)
  })

  it('jenis pola, radar, dan pencarian ikut dihitung', () => {
    expect(hitungSaring(rows, { arah: 'bearish' }, kuatOf).pola).toEqual({ gartley: 1, bat: 1 })
    expect(rows.filter(r => lolosSaring(r, { radar: true }, kuatOf)).map(r => r.t)).toEqual(['AUTO'])
    expect(rows.filter(r => lolosSaring(r, { q: 'indo' }, kuatOf)).map(r => r.t)).toEqual(['INTP'])
    expect(rows.filter(r => lolosSaring(r, { q: 'ad' }, kuatOf)).map(r => r.t)).toEqual(['ADMR'])
  })

  it('angka yang tertulis sama dengan jumlah baris saat tombol itu dipilih', () => {
    const dasar = { arah: 'bearish', status: 'semua' }
    const h = hitungSaring(rows, dasar, kuatOf)
    for (const k of ['kuat', 'sedang', 'lemah']) {
      expect(rows.filter(r => lolosSaring(r, { ...dasar, kuat: k }, kuatOf)).length).toBe(h.kuat[k] || 0)
    }
  })
})
