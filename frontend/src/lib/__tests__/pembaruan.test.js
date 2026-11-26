import { describe, expect, it } from 'vitest'
import { laporanBaru, faktaAset, laporanMaterial } from '../pembaruan.js'

const U = [
  { id: 'sb-report-1', ticker: 'AAAA', date: '2026-10-23', title: 'Perubahan Kegiatan Usaha dan Pembelian Saham PT X',
    points: 'Akuisisi 100% saham PT X senilai Rp 1,4 T · Emisi PMHMETD II senilai Rp 8,2 T', url: 'u1' },
  { id: 'sb-report-2', ticker: 'AAAA', date: '2026-10-24', title: 'Penyampaian Bukti Iklan Pemberitahuan RUPS', points: 'Publikasi iklan', url: 'u2' },
  { id: 'sb-report-3', ticker: 'AAAA', date: '2026-10-01', title: 'Press Rilis', points: 'Lahan tambak 68,07 ha · Seluruh laba dialokasikan untuk dana cadangan', url: 'u3' },
  { id: 'news-1', ticker: 'AAAA', date: '2026-10-25', title: 'Berita media', url: 'u4' },
]

describe('pembaruan', () => {
  it('laporan material tanpa laporan rutin dan berita', () => {
    expect(laporanMaterial(U, 'AAAA').map(x => x.url)).toEqual(['u1', 'u3'])
  })
  it('laporan baru setelah tanggal kurasi tertua', () => {
    const lb = laporanBaru(U, 'AAAA', { pandangan: { AAAA: { asOf: '2026-10-22' } }, riset: { AAAA: { asOf: '2026-10-28' } } })
    expect(lb.sejak).toBe('2026-10-22')
    expect(lb.jenis).toBe('analisa')
    expect(lb.items.map(x => x.url)).toEqual(['u1'])
    expect(laporanBaru(U, 'AAAA', {})).toBeNull()
  })
  it('fakta aset: akuisisi, nilai, luas; tanpa dana cadangan', () => {
    const f = faktaAset(laporanMaterial(U, 'AAAA'), { asOf: '2026-10-22' })
    expect(f.map(x => x.l)).toEqual(['Akuisisi / kepemilikan', 'Nilai transaksi / pendanaan', 'Luas lahan / konsesi'])
    expect(f[0].baru).toBe(true)
    expect(f.some(x => /dana cadangan/.test(x.t))).toBe(false)
  })
})
