import { describe, expect, it } from 'vitest'
import { bankAsuransi, grupKonglo, komoditas, terbaikPerKelompok } from './kelompokLk.js'

const r = (t, pe, extra = {}) => ({ t, nama: '', kuartal: { pe }, ...extra })
const lolos = () => []
const pilih = (rows, gagal = lolos) => Object.fromEntries(terbaikPerKelompok(rows, gagal).map(g => [g.k, g.x?.t || null]))

describe('kelompokLk', () => {
  it('konglo dan pengecualian bank/asuransi', () => {
    expect(grupKonglo('SIMP')).toBe('Salim')
    expect(bankAsuransi({ nama: 'Bank Woori Saudara' })).toBe(true)
    expect(bankAsuransi({ kelas: { sub: 'Asuransi' } })).toBe(true)
    expect(bankAsuransi({ nama: 'Mitrabara Adiperdana', kelas: { ind: 'Batu Bara' } })).toBe(false)
  })

  it('satu saham per kelompok, PE terendah, tidak dipakai dua kali', () => {
    const rows = [
      r('SIMP', 3.1), r('LSIP', 4.1),
      r('MBAP', 5, { kelas: { ind: 'Batu Bara' } }),
      r('NAYZ', 9, { radar: true, backdoor: true }),
      r('KOTA', 6, { radar: true }),   // baru bersinyal di radar: bukan backdoor
      r('TLKM', 12, { kelas: { ind: 'Jasa Telekomunikasi' } }),
      r('BBRI', 2, { nama: 'Bank Rakyat Indonesia', kelas: { ind: 'Bank' } }),
    ]
    expect(pilih(rows)).toEqual({ konglo: 'SIMP', cpo: 'LSIP', backdoor: 'NAYZ', batubara: 'MBAP', emas: null, nikel: null, logam: null, telko: 'TLKM' })
  })

  it('SMAR masuk CPO walau profilnya produk makanan', () => {
    expect(pilih([r('SIMP', 3.1), r('SMAR', 3.87, { kelas: { ind: 'Produk Makanan Pertanian' } }), r('CSRA', 3.89)]).cpo).toBe('SMAR')
  })

  it('tambang dipisah batu bara, emas, nikel', () => {
    const h = pilih([r('PSAB', 3), r('INCO', 8), r('PTBA', 7), r('XYZA', 4, { kelas: { ind: 'Logam & Mineral' }, ringkas: 'produksi nikel naik' })])
    expect([h.batubara, h.emas, h.nikel]).toEqual(['PTBA', 'PSAB', 'XYZA'])
    expect(komoditas('MDKA')).toBe('Emas')
    expect(komoditas('ANTM')).toBe('Nikel, Emas')
    expect(pilih([r('ANTM', 6)]).emas).toBe('ANTM')   // emas didahulukan
    expect(pilih([r('ANTM', 6), r('PSAB', 3)]).emas).toBe('PSAB')
    expect(pilih([r('TINS', 5.6), r('AMMN', 11.9)]).logam).toBe('TINS')
  })

  it('telekomunikasi termasuk produsen kabel', () => {
    expect(pilih([r('SCCO', 4.96), r('KBLI', 5.83)]).telko).toBe('SCCO')
  })

  it('alternatif dan kandidat terdekat beserta alasan', () => {
    const g = terbaikPerKelompok([r('FITT', 20.9, { backdoor: true }), r('BLUE', 49.5, { backdoor: true }), r('STAR', 50.4, { backdoor: true }),
      r('NICL', 18.5), r('INCO', 11.9)], x => x.t === 'NICL' ? ['pendapatan turun'] : x.t === 'INCO' ? ['Q3 < Q2', 'x'] : [])
    const bd = g.find(x => x.k === 'backdoor'), nk = g.find(x => x.k === 'nikel')
    expect(bd.alt.map(x => x.t)).toEqual(['BLUE', 'STAR'])
    expect(nk.x).toBe(null)
    expect(nk.dekat.map(a => a.r.t)).toEqual(['NICL', 'INCO'])
    expect(nk.dekat[0].g).toEqual(['pendapatan turun'])
  })
})
