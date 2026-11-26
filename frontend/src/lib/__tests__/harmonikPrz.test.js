import { describe, expect, it } from 'vitest'
import { komponenPrz, przPola } from '../harmonikAlat.js'

const titik = ps => ps.map((p, j) => ({ n: 'XABCD'[j] || String(j), i: j * 10, p }))

describe('komponenPrz', () => {
  it('Gartley bullish: level 0,786 XA dan proyeksi BC, PRZ ada di dalam keduanya', () => {
    const [X, A, B, C] = [100, 200, 138.2, 180]
    const prz = przPola('gartley', X, A, B, C)
    const u = komponenPrz({ pola: 'gartley', titik: titik([X, A, B, C, 120]), prz })
    expect(u.map(z => z.teks)).toEqual(['0,786 XA', 'proyeksi BC 1,13–1,618'])
    expect(u[0].lo).toBeCloseTo(121.4, 1)
    expect(u[0].lo).toBe(u[0].hi)
    expect(u[1].lo).toBeLessThan(u[1].hi)
    expect(prz[0]).toBeLessThanOrEqual(u[0].lo)
    expect(prz[1]).toBeGreaterThanOrEqual(u[0].lo)
  })

  it('5-0: D di retracement 0,5 kaki BC', () => {
    const [X, A, B, C] = [200, 150, 210, 100]
    const u = komponenPrz({ pola: 'fiveo', titik: titik([X, A, B, C, 155]), prz: [150, 160] })
    expect(u).toEqual([{ k: 'dbc', teks: '0,5 BC', lo: 155, hi: 155 }])
  })

  it('AB=CD: CD setara AB dan proyeksi BC', () => {
    const u = komponenPrz({ pola: 'abcd', titik: titik([200, 150, 180, 130]), prz: [128, 132] })
    expect(u[0]).toEqual({ k: 'cd', teks: 'CD = 1 AB', lo: 130, hi: 130 })
    expect(u[1].teks).toBe('proyeksi BC 1,13–2,618')
  })

  it('tanpa PRZ atau pola tidak dikenal: kosong', () => {
    expect(komponenPrz({ pola: 'gartley', titik: titik([1, 2, 3, 4, 5]), prz: null })).toEqual([])
    expect(komponenPrz({ pola: 'entah', titik: titik([1, 2, 3, 4, 5]), prz: [1, 2] })).toEqual([])
    expect(komponenPrz(null)).toEqual([])
  })
})
