import { describe, expect, it } from 'vitest'
import { BAGIAN, SLIDE, butirSlide, diagramAbcd, totalSlide } from '../harmonikMateri.js'
import { diagramIdeal } from '../harmonikAlat.js'

const KUNCI = new Set(['id', 'bagian', 'judul', 'sub', 'paragraf', 'poin', 'tabel', 'pola', 'alat', 'rujukan', 'periksa', 'belajar'])

describe('materi harmonic', () => {
  it('setiap slide valid: id unik, bagian dikenal, isi ada, tabel rapi', () => {
    expect(new Set(SLIDE.map(s => s.id)).size).toBe(SLIDE.length)
    for (const s of SLIDE) {
      for (const k of Object.keys(s)) expect(KUNCI.has(k), `${s.id}: kunci ${k}`).toBe(true)
      expect(BAGIAN, s.id).toContain(s.bagian)
      expect(s.judul, s.id).toBeTruthy()
      expect((s.paragraf?.length || 0) + (s.poin?.length || 0) + (s.tabel?.baris?.length || 0), s.id).toBeGreaterThan(0)
      if (s.paragraf) s.paragraf.forEach(p => expect(typeof p).toBe('string'))
      if (s.tabel) s.tabel.baris.forEach(b => expect(b, s.id).toHaveLength(s.tabel.kolom.length))
      if (s.pola) expect(s.pola === 'abcd' || diagramIdeal(s.pola), s.id).toBeTruthy()
      if (s.alat) expect(['xabcd', 'fib', 'ext', 'elliott', 'long', 'short']).toContain(s.alat)
    }
    expect(totalSlide).toBe(SLIDE.length)
  })
  it('urutan bagian mengikuti susunan makalah', () => {
    const urut = SLIDE.map(s => BAGIAN.indexOf(s.bagian))
    expect(urut).toEqual([...urut].sort((a, b) => a - b))
  })
  it('AB=CD bullish: A di atas, D paling bawah', () => {
    const d = diagramAbcd('bullish'), y = Object.fromEntries(d.titik.map(t => [t.n, t.y]))
    expect(y.A).toBe(0)
    expect(y.D).toBe(1)
    expect(y.B).toBeGreaterThan(y.C)
  })
})

describe('butir presentasi', () => {
  it('urutan: paragraf, poin, lalu baris tabel', () => {
    const b = butirSlide({ paragraf: ['a', 'b'], poin: ['c'], tabel: { kolom: ['x'], baris: [['1'], ['2']] } })
    expect(b.map(x => x.jenis + x.i).join(' ')).toBe('p0 p1 li0 tr0 tr1')
  })
  it('slide centang tampil utuh', () => {
    expect(butirSlide(SLIDE.find(s => s.periksa))).toEqual([])
    expect(butirSlide(null)).toEqual([])
  })
})
