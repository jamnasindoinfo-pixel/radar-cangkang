import { describe, it, expect } from 'vitest'
import { pdPerluTarikUlang, pdPerluPantau, pdCakupan } from '../povDalamStatus.js'

describe('pdPerluTarikUlang', () => {
  it('hanya untuk analisa tersimpan yang ketinggalan data baru, sekali saja', () => {
    const basi = { status: 'selesai', basi: 'Ada data baru sejak analisa ini: RUPS (2026-11-05).' }
    expect(pdPerluTarikUlang(basi, false)).toBe(true)
    expect(pdPerluTarikUlang(basi, true)).toBe(false)
    expect(pdPerluTarikUlang({ ...basi, segarkan: { langkah: 2 } }, false)).toBe(false)
    expect(pdPerluTarikUlang({ ...basi, galatSegar: 'antre' }, false)).toBe(false)
    expect(pdPerluTarikUlang({ status: 'selesai' }, false)).toBe(false)
    expect(pdPerluTarikUlang(null, false)).toBe(false)
  })
})

describe('pdPerluPantau', () => {
  it('memantau analisa pertama dan tarik ulang', () => {
    expect(pdPerluPantau({ status: 'jalan' })).toBe(true)
    expect(pdPerluPantau({ status: 'selesai', segarkan: { langkah: 1 } })).toBe(true)
    expect(pdPerluPantau({ status: 'selesai' })).toBe(false)
    expect(pdPerluPantau({ status: 'kosong' })).toBe(false)
  })
})

describe('pdCakupan', () => {
  it('menyebut jumlah tersimpan dan sisanya', () => {
    expect(pdCakupan({ tersimpan: 120, total: 950 })).toBe('Analisa tersimpan: 120 dari 950 saham BEI; 830 lainnya ditarik bertahap di latar.')
    expect(pdCakupan({ tersimpan: 950, total: 950 })).toBe('Analisa tersimpan: 950 dari 950 saham BEI.')
    expect(pdCakupan({ tersimpan: 0, total: 0 })).toBe('')
    expect(pdCakupan()).toBe('')
  })
})
