import { describe, it, expect } from 'vitest'
import { ukuranPosisi } from '../harmonikBelajar.js'

describe('materi pemula harmonik', () => {
  it('ukuranPosisi: lot dari risiko per transaksi', () => {
    const u = ukuranPosisi({ modal: 10e6, risikoPct: 2, entry: 500, stop: 470, target: 590 })
    expect(u).toMatchObject({ risikoRp: 200000, lot: 66, nilai: 3300000, rugiMaks: 198000, rr: 3, cukup: true })
    expect(ukuranPosisi({ modal: 10e6, risikoPct: 2, entry: 500, stop: 500 })).toBeNull()
  })
})
