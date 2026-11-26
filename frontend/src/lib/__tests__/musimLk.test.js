import { describe, it, expect } from 'vitest'
import { musimLk } from '../musimLk.js'

describe('musimLk', () => {
  it('mengikuti musim laporan BEI', () => {
    expect(musimLk(new Date(2026, 10, 2))).toMatchObject({ q: 3, kode: '9M26', label: 'Kinerja Q3' })
    expect(musimLk(new Date(2027, 1, 10))).toMatchObject({ q: 4, kode: 'FY26', label: 'Kinerja Q4' })
    expect(musimLk(new Date(2027, 4, 1))).toMatchObject({ q: 1, kode: '3M27', pola: ['3M27', '1Q27'] })
    expect(musimLk(new Date(2027, 7, 1))).toMatchObject({ q: 2, kode: '1H27', pola: ['1H27', '6M27'] })
  })
})
