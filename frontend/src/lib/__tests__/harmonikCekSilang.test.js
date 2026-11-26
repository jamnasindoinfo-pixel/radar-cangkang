import { describe, expect, it } from 'vitest'
import { cariPola, SKALA_POLA } from '../harmonikAlat.js'
import { kekuatanPola, skenarioLain, titikTutorial } from '../harmonikCekSilang.js'

// Bar sintetis: harga bergerak lurus antar titik, 10 bar per kaki (indeks titik 0, 10, 20, ...).
function bangun(titik, per = 10) {
  const harga = [titik[0]]
  for (let k = 1; k < titik.length; k++)
    for (let j = 1; j <= per; j++) harga.push(titik[k - 1] + (titik[k] - titik[k - 1]) * j / per)
  return harga.map((c, i) => {
    const o = i ? harga[i - 1] : c
    return { d: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, o, h: Math.max(o, c), l: Math.min(o, c), c, v: 1e5 }
  })
}
const baris = (pola, status, titik, rasio, prz, arah = 'bullish') => ({ pola, status, arah, rasio, prz, titik: titik.map((p, j) => ({ n: 'XABCD'[j], p, i: j * 10 })) })

describe('kekuatanPola', () => {
  it('Gartley ideal dengan AB=CD terpenuhi: Kuat', () => {
    const r = baris('gartley', 'prz', [1000, 2000, 1382, 1868, 1214], { b: 0.618, c: 0.786, d: 0.786, cd: 1 }, [1184, 1244])
    const k = kekuatanPola(r)
    expect(k.tingkat).toBe('kuat')
    expect(k.alasan.every(a => a.ok)).toBe(true)
  })

  it('B hanya lolos toleransi: Sedang', () => {
    const r = baris('gartley', 'prz', [1000, 2000, 1360, 1868, 1214], { b: 0.64, c: 0.786, d: 0.786, cd: 1.05 }, [1184, 1244])
    const k = kekuatanPola(r)
    expect(k.tingkat).toBe('sedang')
    expect(k.alasan.find(a => a.ringan).teks).toMatch(/B 0,64 hanya lolos toleransi/)
    // Selisih di bawah 2% dari angka tunggal masih pas.
    expect(kekuatanPola({ ...r, rasio: { ...r.rasio, b: 0.625 } }).tingkat).toBe('kuat')
  })

  it('pola menuju: AB=CD dihitung dari PRZ; harga rendah ditandai kasar (contoh Bat ANDI)', () => {
    const r = baris('bat', 'menuju', [42, 26, 33, 29], { b: 0.438, c: 0.571 }, [39.7, 40.1], 'bearish')
    const k = kekuatanPola(r)
    expect(k.tingkat).toBe('lemah')
    expect(k.alasan.some(a => a.berat && /AB=CD tidak akan terpenuhi/.test(a.teks))).toBe(true)
    expect(k.alasan.some(a => a.berat && /Rasio kasar/.test(a.teks))).toBe(true)
  })

  it('baris server memakai dxc untuk D Cypher dan pola di luar XABCD bernilai null', () => {
    const r = baris('cypher', 'prz', [1000, 1500, 1250, 1650, 1155], { b: 0.5, cx: 1.3, dxc: 0.786 }, [1140, 1170])
    expect(kekuatanPola(r).alasan.some(a => /D \(CD\/XC\) 0,786/.test(a.teks))).toBe(true)
    expect(kekuatanPola({ pola: 'abcd', titik: [], prz: [1, 2] })).toBe(null)
  })
})

describe('skenarioLain', () => {
  it('Gartley yang PRZ-nya lebih dari 25% dari harga tidak ada di daftar utama, tetapi muncul sebagai skenario', () => {
    // X 1000, A 2000, B 1382, C 1868, lalu turun ke 1650: PRZ sekitar 1184–1244, harga perlu turun sekitar 25%.
    const bars = bangun([1200, 1000, 2000, 1382, 1868, 1650])
    const utama = cariPola(bars, SKALA_POLA.D, 30)
    expect(utama.some(r => r.pola === 'gartley' && r.arah === 'bullish')).toBe(false)
    const lain = skenarioLain(bars, utama, SKALA_POLA.D, 30)
    const g = lain.find(r => r.pola === 'gartley' && r.arah === 'bullish')
    expect(g).toBeTruthy()
    expect(g.geser).toBeLessThan(-20)
    expect(g.teks).toMatch(/harga perlu turun sekitar/)
    expect(g.kekuatan).toBeTruthy()
  })
})

describe('titikTutorial', () => {
  it('titik otomatis jadi tarikan manual; D proyeksi tidak ikut', () => {
    const r = { pola: 'bat', arah: 'bearish', titik: [{ n: 'X', i: 1, p: 42 }, { n: 'A', i: 5, p: 26 }, { n: 'B', i: 9, p: 33 }, { n: 'C', i: 12, p: 29 }, { n: 'D', i: 20, p: 40, proyeksi: true }] }
    expect(titikTutorial(r).map(t => t.n + t.sisi)).toEqual(['XH', 'AL', 'BH', 'CL'])
    expect(titikTutorial({ ...r, arah: 'bullish' })[0].sisi).toBe('L')
    expect(titikTutorial({ pola: 'abcd', titik: [] })).toEqual([])
    // Pola menuju: D yang sedang berjalan ikut sebagai titik kelima.
    const jalan = { ...r, titik: [...r.titik.slice(0, 4), { ...r.titik[4], jalan: { i: 15, p: 31 } }] }
    expect(titikTutorial(jalan).at(-1)).toMatchObject({ n: 'D', i: 15, p: 31, sisi: 'H' })
  })
})
