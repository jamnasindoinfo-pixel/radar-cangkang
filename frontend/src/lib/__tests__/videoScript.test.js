import { describe, it, expect } from 'vitest'
import { speakable, sentences, buildVideo, lineSecs, toSrt, toScript } from '../videoScript.js'

describe('speakable', () => {
  it('angka dibaca terbilang, satuan dan simbol diucapkan wajar', () => {
    expect(speakable('Nilai Rp2,48 T dan Rp197,6 M, porsi 58,9% → 27,6%, 15,3× kapitalisasi'))
      .toBe('Nilai dua koma empat puluh delapan triliun rupiah dan seratus sembilan puluh tujuh koma enam miliar rupiah, porsi lima puluh delapan koma sembilan persen menjadi dua puluh tujuh koma enam persen, lima belas koma tiga kali kapitalisasi')
    expect(speakable('Kisaran Rp11–Rp49 · PMHMETD belum dinilai KJPP')).toBe('Kisaran sebelas rupiah hingga empat puluh sembilan rupiah, raits isyu belum dinilai ka je pe pe')
  })
  it('ribuan bertitik, tanda minus, tanggal ISO, satuan, singkatan', () => {
    expect(speakable('IHSG 5.282 (-3,35%) pada 2026-10-28')).toBe('i ha es ge lima ribu dua ratus delapan puluh dua, minus tiga koma tiga puluh lima persen, pada dua puluh delapan Oktober dua ribu dua puluh enam')
    expect(speakable('IUP 11.640 ha, 2.600 kkal/kg')).toBe('i u pe sebelas ribu enam ratus empat puluh hektare, dua ribu enam ratus kilokalori per kilogram')
    expect(speakable('RUPSLB dan USD100 juta')).toBe('rups el be dan seratus juta dolar Amerika')
    expect(speakable('IHSG pukul 13.39 di 5.212')).toBe('i ha es ge pukul tiga belas lewat tiga puluh sembilan menit di lima ribu dua ratus dua belas')
    expect(speakable('pukul 09:00')).toBe('pukul sembilan tepat')
    expect(speakable('Lim Shrimp Org Pte. Ltd. di Kec. Utan, Kab. Sumbawa dll.')).toBe('Lim Shrimp Organization pi ti i limited di kecamatan Utan, kabupaten Sumbawa dan lain-lain')
    expect(speakable('Laba USD1,2 Bn')).toBe('Laba satu koma dua miliar dolar Amerika')
  })
})

describe('sentences', () => {
  it('tidak memotong singkatan nama perusahaan', () => {
    expect(sentences('Poh Holdings Pte. Ltd. masuk bertahap. Porsinya 35,85%.')).toEqual(['Poh Holdings Pte. Ltd. masuk bertahap.', 'Porsinya 35,85%.'])
  })
})

describe('buildVideo', () => {
  const d = {
    t: 'ABCD', name: 'PT Abcd Tbk', sector: { label: 'Umum' }, date: '2026-10-22',
    A: { price: 100, mcap: 1e11, ctrlPct: 40, ctrlName: 'PT X', flt: 50, score: 55, tender: { price: 120 }, levels: [['Harga PTW', 'Biaya masuk pengendali', 120], ['Skenario turun', 'kembali ke harga awal', 60]],
      dims: [{ k: 'Pengendali', s: 5, why: ['a.'] }, { k: 'Fundamental', s: 3, why: ['b.'] }], checks: ['KJPP terbit'], exits: ['Harga di bawah PTW'] },
    pa: { sikap: 'Netral', ringkas: 'Ringkasan singkat.', tesis: 'Kalimat satu. Kalimat dua.', nilaiWajar: { bawah: 80, atas: 110, metode: 'Nilai buku.' } },
    aset: { aset: { nama: 'PT Aset' }, transaksi: { nilaiRp: 5e11 } },
    rec: { label: 'Menunggu konfirmasi, belum membeli', entry: [110, null], stop: 90, targets: [{ p: 120, l: 'harga PTW' }], porsi: '0% pada saat ini', holder: 'Bagi pemegang saham, tahan.', triggers: ['KJPP terbit'], exits: ['Harga di bawah PTW'] },
  }
  it('versi ringkas lebih pendek dari lengkap, keduanya diawali pembuka dan diakhiri penutup', () => {
    const r = buildVideo(d, 'ringkas'), l = buildVideo(d, 'lengkap')
    expect(r[0].id).toBe('buka'); expect(r.at(-1).id).toBe('penutup')
    expect(l.length).toBeGreaterThan(r.length)
    const secs = sc => sc.flatMap(s => s.lines).reduce((a, x) => a + lineSecs(x), 0)
    expect(secs(l)).toBeGreaterThan(secs(r))
    expect(r.find(s => s.id === 'rekomendasi').lines[0]).toMatch(/menunggu konfirmasi/)
  })
  it('subtitle dan naskah terbentuk', () => {
    const sc = buildVideo(d, 'ringkas')
    expect(toSrt(sc)).toMatch(/^1\n00:00:00,000 --> /)
    expect(toScript(sc, d)).toMatch(/1\. Pembuka/)
  })
})
