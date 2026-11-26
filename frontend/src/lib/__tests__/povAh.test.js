import { describe, expect, it } from 'vitest'
import { jalurTeks, lembar, saringAh, trenTeks } from '../povAh.js'

describe('povAh', () => {
  it('lembar', () => {
    expect(lembar(220e6)).toBe('220 jt lbr')
    expect(lembar(1.05e9)).toBe('1,05 M lbr')
    expect(lembar(null)).toBe('–')
  })
  it('jalurTeks', () => {
    expect(jalurTeks({ jenis: 'pribadi', pct: 10.02 })).toBe('pribadi 10,02% (KSEI)')
    expect(jalurTeks({ jenis: 'PT', nama: 'HAKIMSON GROWTH CAPITAL', pct: 5.01, status: 'indikasi' })).toBe('lewat HAKIMSON GROWTH CAPITAL 5,01% (indikasi)')
    expect(jalurTeks({ jenis: 'kurasi', status: 'indikasi' })).toMatch(/bawah 1%/)
  })
  it('saringAh', () => {
    const rows = [{ t: 'AKSI', nama: 'Maming', saham: 720e6, ff: 7.5, jejak: [] },
      { t: 'XXXX', nama: 'Contoh', saham: 300e6, ff: 25, jejak: [{ nama: 'DELTA' }] },
      { t: 'UNIT', saham: 75e6, ff: null }]
    expect(saringAh(rows, { maksSaham: 5e8 }).map(r => r.t)).toEqual(['XXXX', 'UNIT'])
    expect(saringAh(rows, { maksFF: 10 }).map(r => r.t)).toEqual(['AKSI', 'UNIT'])
    expect(saringAh(rows, { rekan: true }).map(r => r.t)).toEqual(['XXXX'])
    expect(saringAh(rows, { cari: 'mam' }).map(r => r.t)).toEqual(['AKSI'])
  })
  it('trenTeks', () => {
    expect(trenTeks({ ubah: -10.1 })).toEqual({ teks: '-10,1%', nada: 'akumulasi' })
    expect(trenTeks({ ubah: 6 })).toEqual({ teks: '+6%', nada: 'distribusi' })
    expect(trenTeks(null).teks).toBe('–')
  })
})
