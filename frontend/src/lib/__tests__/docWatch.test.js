import { describe, it, expect } from 'vitest'
import { dokumenBaru } from '../docWatch.js'

const U = [
  { id: 'sb-report-1', ticker: 'SMKM', date: '2026-10-06', title: 'Penyampaian Press Rilis Perseroan' },
  { id: 'sb-report-2', ticker: 'SMKM', date: '2026-10-08', title: 'Laporan Bulanan Registrasi Pemegang Efek' },
  { id: 'sb-report-3', ticker: 'SMKM', date: '2026-09-01', title: 'Transaksi Afiliasi' },
  { id: 'news-1', ticker: 'SMKM', date: '2026-10-07', title: 'Akuisisi tambak' },
  { id: 'sb-report-4', ticker: 'PACK', date: '2026-10-23', title: 'Perubahan Kegiatan Usaha, Pembelian Saham PT Bukit Makmur' },
]

describe('dokumenBaru', () => {
  it('keterbukaan material setelah tanggal analisa dokumen, tanpa laporan rutin dan berita media', () => {
    expect(dokumenBaru('SMKM', U, { asOf: '2026-10-01' }).map(u => u.id)).toEqual(['sb-report-1'])
  })
  it('tanpa analisa dokumen: 120 hari terakhir', () => {
    expect(dokumenBaru('SMKM', U, null, { today: new Date('2026-10-23') }).map(u => u.id)).toEqual(['sb-report-1', 'sb-report-3'])
  })
  it('sudah dianalisa: kosong', () => {
    expect(dokumenBaru('PACK', U, { asOf: '2026-10-23' })).toEqual([])
  })
})
