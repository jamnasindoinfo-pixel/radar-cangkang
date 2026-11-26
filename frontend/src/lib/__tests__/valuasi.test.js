import { describe, it, expect } from 'vitest'
import { valuasiSim, bandarView } from '../valuasi.js'

// Mirip NAYZ: 2,55 miliar saham, harga Rp77, pengendali 29,41% masuk di Rp23,5; RI Rp2,24 T (aset Rp1,79 T + tunai Rp448 M) pada Rp75.
const c = { S0: 2.55e9, price: 77, equity: 63e9, ctrlPct: 29.41 }
const r = { S1: 2.55e9 + 29.88e9, total: 2.24e12, aset: 1.79e12, tunai: 0.45e12, terp: 75 }

describe('valuasiSim', () => {
  it('valuasi Rp2,5 T: harga per saham, kelipatan, PBV tersirat', () => {
    const v = valuasiSim(c, r, { target: 2.5e12 })
    expect(Math.round(v.harga)).toBe(77)
    expect(v.pbv).toBeCloseTo(2.5e12 / 2.303e12, 2)
  })
  it('valuasi Rp5 T dan pengendali mengambil Rp1 T: jual saham vs RI baru', () => {
    const v = valuasiSim(c, r, { target: 5e12, ambil: 1e12 })
    expect(v.jual.pctPerusahaan).toBeCloseTo(0.2, 5)
    expect(v.ri.dilusi).toBeCloseTo(1 / 6, 5)
    expect(v.x).toBeCloseTo(v.harga / 77, 5)
  })
})

describe('bandarView', () => {
  it('modal masuk, saham inbreng, harga impas, kelipatan modal awal', () => {
    const b = bandarView(c, r, 75, { porsiPersen: 29.41, hargaMasuk: 23.5 })
    expect(Math.round(b.sahamInbreng / 1e9)).toBe(24)
    expect(b.kelipatanAwal).toBeCloseTo(77 / 23.5, 5)
    expect(b.impas).toBeGreaterThan(23.5)
    expect(b.impas).toBeLessThan(75)
  })
})
