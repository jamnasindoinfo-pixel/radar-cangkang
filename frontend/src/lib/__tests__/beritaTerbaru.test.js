import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { beritaTerakhir, analisaBerita } from '../beritaTerbaru.js'
import { beritaPdf, beritaPdfName } from '../beritaPdf.js'

const updates = [
  { id: 'sb-news-1', ticker: 'NAYZ', date: '2026-11-02', title: 'Berita media NAYZ', summary: 'Isi berita.' },
  { id: 'sb-report-2', ticker: 'NAYZ', date: '2026-11-02', type: 'lainnya', title: 'Pendirian Anak Usaha dari Perseroan', url: 'https://stockbit.com/post/2',
    summary: 'NAYZ mendirikan anak usaha PT Integrasi Sistem Digital. Inti: Pendirian anak usaha baru dengan porsi 99,6% (Ringkasan AI Stockbit)',
    points: 'Porsi kepemilikan saham perseroan mencapai 2.490 lembar saham atau 99,6% · Total modal ditempatkan 2.500 lembar saham' },
  { id: 'sb-report-3', ticker: 'NAYZ', date: '2026-10-22', title: 'Laporan lama' },
  { id: 'sb-report-4', ticker: 'BBCA', date: '2026-11-03', title: 'Emiten lain' },
]
const pandangan = { NAYZ: { sikap: 'Spekulatif tinggi', ringkas: 'Ringkas tesis.', asOf: '2026-10-22', hargaAcuan: 77,
  nilaiWajar: { bawah: 58, atas: 75 }, variabelKunci: ['KJPP independen'], tesisSalahBila: ['Valuasi terkonfirmasi'] } }
const items = [{ ticker: 'NAYZ', price: 76, mcap: 190 }]

// Data kurasi untuk penyelidikan tujuan.
const pengendali = { NAYZ: { siapa: 'Saiko Consultancy Pte. Ltd. membeli 29,41% saham. UBO Sawin Laosethakul.', rencana: 'Mengubah NAYZ dari makanan bayi menjadi perusahaan telekomunikasi; bisnis makanan bayi dialihkan ke pihak lain.' } }
const relasi = { NAYZ: { nodes: [{ t: 'Sawin Laosethakul', s: 'UBO Saiko · Komisaris NAYZ' }] } }
const verified = { NAYZ: { baru: 'Telekomunikasi dan teknologi' } }

describe('selidik tujuan', () => {
  it('menghimpun temuan dari relasi dan menguji dugaan tujuan', () => {
    const u = { ...updates[1], summary: 'NAYZ mendirikan anak usaha PT Integrasi Sistem Digital yang bergerak di bidang perdagangan peralatan listrik.', points: 'Sawin Laosethakul memiliki 10 lembar saham · Total modal ditempatkan 2.500 lembar saham' }
    const a = analisaBerita(u, { items, pandangan, updates, pengendali, relasi, verified })
    expect(a.cari.some(x => x.sumber === 'Peta relasi' && /Sawin Laosethakul/.test(x.teks))).toBe(true)
    expect(a.cari.find(x => x.sumber === 'Profil pengendali').teks).toMatch(/Pte\. Ltd\. membeli/)
    const div = a.selidiki.find(d => /diversifikasi/.test(d.dugaan))
    expect(div.nilai).toBe('Belum didukung')
    expect(a.tujuan.keyakinan).not.toBe('Rendah')
    expect(a.selidiki.find(d => /tahap awal/.test(d.dugaan)).bukti[0].teks).toMatch(/2\.500 lembar/)
  })
})

describe('analisa berita terbaru', () => {
  it('memilih dokumen terbaru emiten, keterbukaan resmi didahulukan pada tanggal sama', () => {
    expect(beritaTerakhir(updates, 'NAYZ').id).toBe('sb-report-2')
    expect(beritaTerakhir(updates, 'XXXX')).toBeNull()
  })
  it('menyusun ringkasan, poin, dampak, dan kaitan tesis', () => {
    const a = analisaBerita(beritaTerakhir(updates, 'NAYZ'), { items, pandangan, updates })
    expect(a.dampak.positif.some(x => /anak usaha baru/.test(x))).toBe(true)
    expect(a.dampak.positif.some(x => /99,6%/.test(x))).toBe(true)
    expect(a.dampak.negatif.some(x => /belum diungkap/.test(x))).toBe(true)
    expect(a.riwayat.map(r => r.judul)).toEqual(['Laporan lama'])
    expect(a.implikasi[0]).toMatch(/-1,3%/)
    expect(a.tujuan.utama).toBeTruthy()
    expect(['Tinggi', 'Sedang', 'Rendah']).toContain(a.tujuan.keyakinan)
    expect(a.cari[0].sumber).toBe('Dokumen')
    expect(a.ringkas).toBe('NAYZ mendirikan anak usaha PT Integrasi Sistem Digital.')
    expect(a.poin).toHaveLength(2)
    expect(['Positif', 'Netral', 'Negatif']).toContain(a.dampak.label)
    expect(a.tesis.baru).toBe(true)
    expect(a.tesis.posisi).toMatch(/di atas rentang nilai wajar/)
    expect(a.pantau).toContain('KJPP independen')
    expect(a.kesimpulan).toMatch(/terbit setelah analisa kurasi 2026-10-22/)
  })
  it('membuat PDF analisa', async () => {
    const a = analisaBerita(beritaTerakhir(updates, 'NAYZ'), { items, pandangan })
    const doc = await beritaPdf(a, jsPDF)
    expect(doc.getNumberOfPages()).toBe(3)
    expect(beritaPdfName(a)).toBe('Analisa-NAYZ_Berita-2026-11-02.pdf')
    const b = analisaBerita(updates[0], {})
    expect((await beritaPdf(b, jsPDF)).getNumberOfPages()).toBe(3)
  })
})

describe('transaksi saham orang dalam', () => {
  const u = { id: 'sb-news-9', ticker: 'RELF', date: '2026-10-30', title: 'Investasi Perdana, Komut RELF Caplok 1,43 Persen Saham',
    summary: 'Komisaris Utama membeli 1,43 persen saham perseroan dalam investasi perdananya.' }
  it('pembelian oleh komisaris tidak dibaca negatif', () => {
    const a = analisaBerita(u, {})
    expect(a.dampak.label).toBe('Positif')
    expect(a.dampak.negatif).toEqual([])
    expect(a.tujuan.utama).toMatch(/menambah kepemilikan/)
  })
  it('teks asli RELF: "aksi pembelian saham" oleh Komisaris Utama', () => {
    const a = analisaBerita({ ...u, summary: 'EmitenNews.com - Komisaris Utama PT Graha Mitra Asia Tbk. (RELF), Achmad Machlus Sadat terpantau melakukan aksi pembelian saham pertama kalinya di saham milik perseroan.' }, {})
    expect(a.jenisAksi).toBe('insider')
    expect(a.tujuan.utama).toMatch(/menambah kepemilikan/)
  })
  it('penjualan oleh direktur netral', () => {
    const a = analisaBerita({ ...u, title: 'Direktur ABCD menjual 2 persen saham', summary: 'Direktur ABCD melepas 2% saham.' }, {})
    expect(a.dampak.label).toBe('Netral')
  })
})
