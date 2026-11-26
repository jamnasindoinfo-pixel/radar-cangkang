import { describe, expect, it } from 'vitest'
import { RINGKAS } from '../presentasiRingkas.js'
import { BAGIAN, butirSlide } from '../harmonikMateri.js'
import { diagramIdeal } from '../harmonikAlat.js'

describe('presentasi ringkas', () => {
  it('sekitar 20 slide, urut per bagian, skema sama dengan materi lengkap', () => {
    expect(RINGKAS.length).toBeGreaterThanOrEqual(15)
    expect(RINGKAS.length).toBeLessThanOrEqual(25)
    expect(new Set(RINGKAS.map(s => s.id)).size).toBe(RINGKAS.length)
    const urut = RINGKAS.map(s => BAGIAN.indexOf(s.bagian))
    expect(urut.every(i => i >= 0)).toBe(true)
    expect(urut).toEqual([...urut].sort((a, b) => a - b))
    for (const s of RINGKAS) {
      expect(butirSlide(s).length, s.id).toBeGreaterThan(0)
      if (s.tabel) s.tabel.baris.forEach(b => expect(b, s.id).toHaveLength(s.tabel.kolom.length))
      if (s.pola) expect(s.pola === 'abcd' || diagramIdeal(s.pola), s.id).toBeTruthy()
    }
  })
  it('memuat satu slide untuk tiap pola utama Carney', () => {
    const pola = RINGKAS.map(s => s.pola).filter(Boolean)
    for (const k of ['abcd', 'gartley', 'bat', 'crab', 'butterfly']) expect(pola).toContain(k)
  })
})
