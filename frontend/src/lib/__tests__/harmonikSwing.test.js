import { describe, expect, it } from 'vitest'
import { jarakKaki, kakiCandle, swingLemah } from '../harmonikAlat.js'
import { kekuatanPola } from '../harmonikCekSilang.js'

const titik = (...ip) => ip.map(([i, p], j) => ({ n: 'XABCD'[j], i, p }))

describe('jarakKaki', () => {
  it('BBCA Shark (20 Nov 2026): kaki 5/10/45/32 candle timpang', () => {
    const jk = jarakKaki({ titik: titik([0, 4820], [5, 6550], [15, 5550], [60, 6850], [92, 4740]) })
    expect(jk.kaki).toEqual([5, 10, 45, 32])
    expect(jk.tingkat).toBe('timpang')
    expect(jk.teks).toMatch(/X→A 5 candle, kaki B→C 45 candle/)
  })

  it('kaki kurang dari 3 candle: swing terlalu dekat', () => {
    const jk = jarakKaki({ titik: titik([0, 100], [2, 120], [12, 108], [22, 118], [32, 104]) })
    expect(jk.tingkat).toBe('timpang')
    expect(jk.teks).toMatch(/Swing terlalu dekat: kaki X→A hanya 2 candle/)
  })

  it('kaki seimbang dan kurang seimbang', () => {
    expect(jarakKaki({ titik: titik([0, 1], [8, 2], [14, 1.5], [22, 1.9], [30, 1.2]) }).tingkat).toBe('seimbang')
    expect(jarakKaki({ titik: titik([0, 1], [4, 2], [20, 1.5], [36, 1.9]) }).tingkat).toBe('kurang')
  })

  it('titik akhir proyeksi tidak dihitung; kaki dari server dipakai bila ada', () => {
    const t = titik([0, 1], [8, 2], [14, 1.5], [22, 1.9], [99, 1.2])
    t[4].proyeksi = true
    expect(kakiCandle(t)).toEqual([8, 6, 8])
    expect(jarakKaki({ titik: [{ n: 'X' }, { n: 'A' }, { n: 'B' }, { n: 'C' }], kaki: [5, 30, 12] }).tingkat).toBe('timpang')
    expect(jarakKaki({ titik: [] })).toBeNull()
  })
})

describe('swingLemah', () => {
  const bar = (h, l) => ({ h, l, o: l, c: h })
  // Swing low di indeks 3 (dasar 90) dan swing high di indeks 8 (puncak 110), dua candle di kiri/kanan masing-masing.
  const bars = [bar(105, 100), bar(103, 97), bar(100, 94), bar(98, 90), bar(99, 93), bar(102, 95),
    bar(106, 99), bar(108, 102), bar(110, 104), bar(109, 103), bar(107, 100), bar(104, 97)]

  it('swing jelas: tidak ada catatan', () => {
    expect(swingLemah(bars, [{ n: 'A', i: 3, p: 90 }, { n: 'B', i: 8, p: 110 }])).toEqual([])
  })

  it('titik yang dilewati candle tetangganya bukan swing jelas', () => {
    const out = swingLemah(bars, [{ n: 'A', i: 4, p: 93 }, { n: 'B', i: 8, p: 110 }])
    expect(out[0]).toMatch(/Titik A bukan swing low yang jelas/)
  })

  it('ayunan di bawah 5% dicatat', () => {
    const out = swingLemah(bars, [{ n: 'A', i: 3, p: 90 }, { n: 'B', i: 5, p: 93 }])
    expect(out.some(t => /Ayunan A→B hanya 3,3%/.test(t))).toBe(true)
  })

  it('titik terakhir yang belum punya 2 candle di kanan tidak dinilai sisi kanannya', () => {
    // Candle terakhir puncak tertinggi dibanding 2 candle di kirinya; di kanannya belum ada candle.
    const naik = [...bars.slice(0, 10), bar(112, 106)]
    expect(swingLemah(naik, [{ n: 'A', i: 3, p: 90 }, { n: 'B', i: 10, p: 112 }]).filter(t => /Titik B/.test(t))).toEqual([])
    // Puncak yang sudah dilewati candle di kirinya tetap dicatat walau sisi kanan belum ada.
    expect(swingLemah(bars, [{ n: 'A', i: 3, p: 90 }, { n: 'B', i: 11, p: 104 }]).some(t => /Titik B/.test(t))).toBe(true)
  })
})

describe('kekuatanPola dengan catatan swing', () => {
  it('jarak candle timpang menjadi syarat berat', () => {
    const row = { pola: 'gartley', status: 'prz', prz: [119, 124], titik: titik([0, 100], [3, 200], [40, 138.2], [70, 175.3], [100, 121.4]) }
    const k = kekuatanPola(row)
    expect(k.alasan.some(a => a.berat && /Jarak candle tidak seimbang/.test(a.teks))).toBe(true)
    expect(k.tingkat).not.toBe('kuat')
  })
})
