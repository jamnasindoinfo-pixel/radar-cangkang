import { describe, it, expect } from 'vitest'
import { analisaLaporan, angkaKunci, intiDari, laporanPerEmiten } from '../laporanAnalisa.js'

const DOOH_PINJAM = { id: 'sb-report-37250899', date: '2026-11-05', ticker: 'DOOH',
  title: 'Informasi Tambahan dan/ atau Perubahan atas keterbukaan Informasi Peminjaman Pemegang Saham',
  summary: 'DOOH (Era Media Sejahtera) menyampaikan informasi tambahan atas fasilitas pinjaman pemegang saham dari PT Sinergi Internasional Investama dengan plafon Rp 5 T berbunga 7,5% per tahun. Inti: DOOH menerima fasilitas pinjaman pemegang saham Rp 5 T dengan penarikan awal Rp 2 T untuk mendanai akuisisi 29,88% saham PT Sinergi Inti Andalan Prima Tbk (Ringkasan AI Stockbit)' }
const DOOH_AMBIL = { id: 'sb-report-37250852', date: '2026-11-05', ticker: 'DOOH',
  title: 'Informasi Tambahan dan/ atau Perubahan atas keterbukaan Informasi Pengambilalihan Saham PT Sinergi Inti Andalan Prima Tbk oleh PT Cakrawala Nexus Investama',
  summary: 'DOOH mengumumkan rencana pengambilalihan 6,69 miliar saham PT Sinergi Inti Andalan Prima Tbk senilai Rp 2,01 T. Inti: Anak usaha berencana membeli 29,88% saham (Ringkasan AI Stockbit)' }

describe('analisaLaporan', () => {
  it('jenis dari judul, nada perhatian dengan dasar, inti, dan angka kunci', () => {
    const a = analisaLaporan(DOOH_PINJAM)
    expect(a.jenis.id).toBe('pendanaan')
    expect(a.jenisLain).toContain('Pengendalian & akuisisi')
    expect(a.nada).toBe('perhatian')
    expect(a.dasar).toContain('menambah utang atau kewajiban')
    expect(a.inti).toMatch(/^DOOH menerima fasilitas pinjaman/)
    expect(a.angka.map(x => x.v)).toEqual(expect.arrayContaining(['Rp 5 T', 'Rp 2 T', '7,5%', '29,88%']))
  })
  it('pengambilalihan dan jumlah saham', () => {
    const a = analisaLaporan(DOOH_AMBIL)
    expect(a.jenis.id).toBe('pengendali')
    expect(a.nada).toBe('netral')
    expect(a.angka).toEqual(expect.arrayContaining([{ k: 'saham', v: '6,69 miliar saham' }, { k: 'nilai', v: 'Rp 2,01 T' }]))
  })
  it('tender positif, lainnya netral, kosong', () => {
    expect(analisaLaporan({ title: 'Laporan Hasil Penawaran Tender Wajib PT Era Media Sejahtera Tbk' })).toMatchObject({ nada: 'positif', jenis: { id: 'tender' } })
    expect(analisaLaporan({ title: 'Penyampaian Bukti Iklan' }).jenis.id).toBe('lainnya')
    expect(analisaLaporan(null)).toBeNull()
    expect(intiDari('tanpa inti')).toBe('')
    expect(angkaKunci('harga Rp 150 per saham')).toEqual([{ k: 'harga', v: 'Rp 150 per saham' }])
    expect(angkaKunci('senilai Rp 2,01 T atau Rp 300 per lembar saham')).toEqual([{ k: 'nilai', v: 'Rp 2,01 T' }, { k: 'harga', v: 'Rp 300 per lembar saham' }])
  })
})

describe('laporanPerEmiten', () => {
  it('laporan terakhir per emiten radar, laporan lain 30 hari, terbaru dulu', () => {
    const ups = [DOOH_PINJAM, DOOH_AMBIL, { id: 'sb-report-1', date: '2026-09-01', ticker: 'DOOH', title: 'Lama' },
      { id: 'sb-report-2', date: '2026-11-04', ticker: 'NAYZ', title: 'Hasil RUPS' },
      { id: 'news-1', date: '2026-11-06', ticker: 'NAYZ', title: 'Berita media' },
      { id: 'sb-report-3', date: '2026-11-06', ticker: 'XXXX', title: 'Di luar radar' }]
    const r = laporanPerEmiten(ups, [{ ticker: 'DOOH' }, { ticker: 'NAYZ' }], { today: new Date('2026-11-06') })
    expect(r.map(x => x.t)).toEqual(['DOOH', 'NAYZ'])
    expect(r[0].terakhir.id).toBe('sb-report-37250899')
    expect(r[0].lain.map(u => u.id)).toEqual(['sb-report-37250852'])
    expect(r[0].total).toBe(3)
  })
})
