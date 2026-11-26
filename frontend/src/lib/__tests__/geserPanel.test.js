import { describe, expect, it } from 'vitest'
import { bacaPosisi, geserPanel, jepitPanel } from '../geserPanel.js'

const U = { w: 244, h: 300 }, W = { w: 900, h: 500 }

describe('panel yang bisa ditarik', () => {
  it('menggeser sebesar selisih pointer', () => {
    expect(geserPanel({ x: 8, y: 52 }, { x: 100, y: 100 }, { x: 400, y: 90 }, U, W)).toEqual({ x: 308, y: 42 })
  })

  it('dijepit agar tetap di dalam chart (kiri, kanan, atas, bawah)', () => {
    expect(geserPanel({ x: 8, y: 52 }, { x: 0, y: 0 }, { x: -500, y: -500 }, U, W)).toEqual({ x: 0, y: 0 })
    expect(geserPanel({ x: 8, y: 52 }, { x: 0, y: 0 }, { x: 2000, y: 2000 }, U, W)).toEqual({ x: 656, y: 200 })
  })

  it('panel lebih besar dari chart ditempel di 0; posisi lama dijepit saat chart menyempit', () => {
    expect(jepitPanel({ x: 50, y: 50 }, { w: 400, h: 600 }, { w: 300, h: 500 })).toEqual({ x: 0, y: 0 })
    expect(jepitPanel({ x: 656, y: 100 }, U, { w: 500, h: 500 })).toEqual({ x: 256, y: 100 })
  })

  it('posisi tersimpan: hanya angka sah yang dipakai', () => {
    expect(bacaPosisi('{"x":10,"y":20}')).toEqual({ x: 10, y: 20 })
    expect(bacaPosisi(null)).toBeNull()
    expect(bacaPosisi('rusak')).toBeNull()
    expect(bacaPosisi('{"x":"a","y":1}')).toBeNull()
  })
})
