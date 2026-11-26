import { describe, it, expect } from 'vitest'
import { recommend } from '../recommend.js'

const base = {
  A: { price: 73, score: 56, levels: [['Skenario turun', '', 55], ['Skenario naik', '', 326], ['Harga PTW', '', 131]],
    bull: ['Aset besar'], bear: ['Pengendali SPV'], checks: ['KJPP terbit'], exits: ['Harga di bawah PTW'], sv: { target: 'RUPSLB 18 November 2026' } },
  pa: { sikap: 'Spekulatif tinggi', nilaiWajar: { bawah: 11, atas: 49 } },
  tech: { sig: { score: -4, sig: ['Jual kuat', 'bad'] }, verdict: 'tren turun', plan: { entry: null, stop: 68, sar: 96, note: 'Kurangi saat rebound', s: { res: 92, sup: 68 } } },
  pos: { next: 'PMHMETD berjalan' },
}

describe('recommend', () => {
  it('tren turun tanpa setup: tunggu konfirmasi, area beli di atas SAR', () => {
    const r = recommend(base)
    expect(r.tier).toBe('tunggu')
    expect(r.entry).toEqual([96, null])
    expect(r.stop).toBe(68)
    expect(r.targets.map(t => t.p)).toEqual([131, 326])
    expect(r.horizon).toBe('Sampai RUPSLB 18 November 2026')
    expect(r.why.some(w => /di atas nilai wajar/.test(w.t))).toBe(true)
  })
  it('sikap hindari selalu hindari', () => {
    expect(recommend({ ...base, pa: { sikap: 'Hindari' } }).tier).toBe('hindari')
  })
  it('setup beli + skor tinggi + teknikal naik: akumulasi; diturunkan bila dana rights issue diragukan', () => {
    const up = { ...base, pa: { sikap: 'Asimetris menarik' }, tech: { sig: { score: 3, sig: ['Beli', 'good'] }, plan: { entry: 75, entryLo: 72, entryHi: 76, stop: 66, tp1: 90, tp2: 110, s: {} } }, A: { ...base.A, score: 62 } }
    expect(recommend(up)).toMatchObject({ tier: 'akumulasi', entry: [72, 76] })
    expect(recommend({ ...up, riF: { key: 'doubt', label: 'Diragukan tercapai' } }).tier).toBe('spekulatif')
  })
})
