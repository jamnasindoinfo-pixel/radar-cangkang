import { describe, it, expect } from 'vitest'
import { riCase, riCalc, riRange, riVerdict, riPriceNeeded, riScenarios, riExercise, asetLaba, riTrading, riRating, riLevels } from '../rightsIssue.js'

// Data mirip NINE: PMHMETD I 2,44 miliar saham, asumsi harga Rp81, aset tambang ±Rp2,475 T lewat inbreng tahap II.
const A = {
  shares: 2157e6, price: 73, mcap: 157e9, flt: 58.91, ctrlPct: 35.85, equity: 26e9, injRp: null, reps: [],
  pa: {
    dilusi: { berlaku: true, sahamSekarang: 2157e6, sahamBaru: 2440e6, porsiPublikSekarang: 58.91, asumsi: 'PMHMETD I penuh 2,44 miliar saham pada harga pasar Rp81 (asumsi; belum ada harga resmi).' },
    kalkulator: { kasSegar: 197.64e9, hargaPelaksanaan: 81, dasar: 'Jumlah saham maks. 2,44 miliar; harga Rp81 adalah asumsi. PMHMETD I hingga 2,44 miliar saham (nominal Rp10).' },
  },
}
const aset = { transaksi: { nilaiRp: 2475e9, caraBayar: 'Inbreng/integrasi aset melalui rights issue (PMHMETD) tahap kedua' }, kjpp: { status: 'belum', nilaiRp: null } }
const sv = { injectTarget: 'Aset tambang Poh Group (PGGR), Mongolia', target: 'RUPSLB 18 November 2026' }

describe('riCase', () => {
  const c = riCase(A, { aset, sv })
  it('mengenali PMHMETD dan mengambil data kurasi', () => {
    expect(c).toMatchObject({ kind: 'PMHMETD', status: 'rencana', S0: 2157e6, N: 2440e6, ex: 81, exAssumed: true, nominal: 10, inj: 2475e9, inbreng: true, laterInj: 2475e9 })
  })
  it('null bila tidak ada rencana penambahan modal', () => {
    expect(riCase({ ...A, pa: { dilusi: { berlaku: false } } }, {})).toBeNull()
  })
  it('PMTHMETD dikenali dari teks', () => {
    expect(riCase({ ...A, pa: { kalkulator: { kasSegar: 28e9, dasar: 'Hasil PMTHMETD 66,67 jt saham' } } }, {}).kind).toBe('PMTHMETD')
  })
})

describe('riCalc', () => {
  const c = riCase(A, { aset, sv })
  const r = riCalc(c, 81, 0)
  it('menghitung kebutuhan dana, rasio, TERP, dan siapa menyetor', () => {
    expect(r.total).toBeCloseTo(2440e6 * 81)
    expect(r.tunai).toBeCloseTo(r.total)
    expect(r.ratio).toBeCloseTo(2440 / 2157)
    expect(r.terp).toBeCloseTo((2157e6 * 73 + 2440e6 * 81) / 4597e6)
    expect(r.ctrlPart).toBeCloseTo(0.3585 * r.total)
    expect(r.standby).toBeCloseTo(0.5891 * r.total)
    expect(r.pubAfter).toBeCloseTo(0.5891 * 2157 / 4597)
    expect(r.pubAfterInj).toBeLessThan(r.pubAfter)
  })
  it('publik menebus penuh menjaga porsinya', () => {
    expect(riCalc(c, 81, 1).pubAfter).toBeCloseTo(0.5891)
  })
  it('rentang slider tidak dibatasi nominal', () => {
    expect(riRange(c)).toMatchObject({ lo: 1, start: 81, hi: 10000 })
    expect(riVerdict(c, r)).toMatch(/kapitalisasi pasar/)
  })
})

describe('merger dan inbreng', () => {
  it('merger tanpa harga memakai harga tersirat nilai aset ÷ saham baru', () => {
    const c = riCase({ shares: 47.77e9, price: 3180, mcap: 150e12, flt: 18.88, ctrlPct: 48.37, reps: [],
      pa: { dilusi: { berlaku: true, sahamBaru: 24.12e9, asumsi: 'Merger sudah efektif 22 Apr 2026' }, kalkulator: { kasSegar: 0 } } },
      { aset: { transaksi: { nilaiRp: 10.42e12, caraBayar: 'Saham: penerbitan saham baru' } }, sv: { injectType: 'Merger (penggabungan usaha) dibayar saham baru' } })
    expect(c).toMatchObject({ kind: 'merger', status: 'tereksekusi' })
    expect(riRange(c).start).toBe(432)
    const r = riCalc(c, 432)
    expect(r.aset).toBeCloseTo(r.total)
    expect(r.standby).toBeNull()
  })
  it('inbreng + tunai dipisah dari nilai penerbitan', () => {
    const c = riCase({ shares: 11.6e9, price: 2150, mcap: 25e12, flt: 17.92, ctrlPct: 53.17, reps: [],
      pa: { dilusi: { berlaku: true, sahamBaru: 7.88e9 }, kalkulator: { nilaiDibayarSaham: 14.57e12, kasSegar: 2.37e12, hargaPelaksanaan: 2150, dasar: 'inbreng Rp14,57 T' } } },
      { aset: { transaksi: { nilaiRp: 14.57e12, caraBayar: 'inbreng 100% saham FFI dalam PMHMETD IV' } } })
    const r = riCalc(c, 2150)
    expect(r.aset).toBeCloseTo(14.57e12)
    expect(r.tunai).toBeCloseTo(7.88e9 * 2150 - 14.57e12)
  })
})

describe('rincian aset injeksi', () => {
  it('kisaran nilai dari beberapa sumber (USD dan Rupiah)', async () => {
    const { valuesOf, asetDetail } = await import('../rightsIssue.js')
    const t = 'Indikatif USD150 juta (Rp2,51 triliun) menurut pengumuman Desember 2025; IDX Channel Oktober 2026 menyebut indikatif USD100 juta (Rp1,8 triliun). Konversi Rp16.500: USD150 juta = Rp2.475.000.000.000'
    const v = valuesOf(t)
    expect(Math.min(...v)).toBeCloseTo(1.65e12)
    expect(Math.max(...v)).toBeCloseTo(2.51e12)
    const d = asetDetail({ aset: { nama: 'PGGR', tambang: { produksi: '>20 juta ton', cadangan: null } }, transaksi: { nilai: t, caraBayar: 'Inbreng' },
      kjpp: { status: 'belum' }, tidakDitemukan: ['kjpp: dua penilai independen belum diumumkan'] }, 2475e9)
    expect(d).toMatchObject({ spread: true, cara: 'Inbreng', gaps: ['dua penilai independen belum diumumkan'] })
    expect(d.facts).toEqual([['Produksi', '>20 juta ton']])
  })
})

describe('presentasi analisa rights issue', () => {
  it('membangun 13 slide tanpa ukuran negatif atau NaN', async () => {
    const PptxGenJS = (await import('pptxgenjs')).default
    const { buildRiDeck, riDeckFileName } = await import('../deck.js')
    const { THEMES, SECTORS } = await import('../deckThemes.js')
    const c = riCase(A, { aset: { ...aset, aset: { nama: 'PGGR', jenis: 'Tambang' }, tidakDitemukan: ['kjpp: belum'] }, sv })
    const pres = buildRiDeck(PptxGenJS, { t: 'NINE', name: 'Techno9', date: '2026-10-22', sector: SECTORS[1], c, P: 81, U: 0 }, THEMES.batubara[0])
    expect(pres.slides.length).toBe(13)
    const json = JSON.stringify(pres.slides.map(s => s._slideObjects.map(o => o.options)))
    expect(json).not.toMatch(/"[wh]":-|NaN/)
    expect(riDeckFileName('NINE', '2026-10-22', { name: 'Arang & Amber' })).toBe('NINE_RightsIssue_2026-10-22_Arang-Amber.pptx')
  })
})

describe('PDF analisa rights issue', () => {
  it('13 halaman, sama dengan jumlah slide', async () => {
    const PptxGenJS = (await import('pptxgenjs')).default
    const { jsPDF } = await import('jspdf')
    const { buildRiDeck } = await import('../deck.js')
    const { deckToPdf } = await import('../deckPdf.js')
    const { THEMES, SECTORS } = await import('../deckThemes.js')
    const c = riCase(A, { aset: { ...aset, aset: { nama: 'PGGR' } }, sv })
    const pres = buildRiDeck(PptxGenJS, { t: 'NINE', name: 'Techno9', date: '2026-10-22', sector: SECTORS[1], c, P: 81, U: 0 }, THEMES.batubara[1])
    const doc = await deckToPdf(pres, jsPDF)
    expect(doc.getNumberOfPages()).toBe(13)
  })
})

describe('riFunding: apakah dana terkumpul', () => {
  it('keterbukaan hasil pelaksanaan = sudah tercapai', async () => {
    const { riFunding } = await import('../rightsIssue.js')
    const c = riCase({ ...A, pa: { kalkulator: { kasSegar: 28e9, hargaPelaksanaan: 427, dasar: 'PMTHMETD diserap PIMSF' } } },
      { reports: [{ date: '2026-07-17', title: 'Hasil Pelaksanaan Penambahan Modal Tanpa Hak Memesan Efek Terlebih Dahulu (PMTHMETD)' }] })
    const f = riFunding(c, riCalc(c, 427))
    expect(f).toMatchObject({ key: 'done', label: 'Sudah tercapai' })
    expect(f.last.date).toBe('2026-07-17')
  })
  it('asumsi analis bukan komitmen pembeli siaga; harga di atas pasar menurunkan skor', async () => {
    const { riFunding } = await import('../rightsIssue.js')
    const c = riCase(A, { aset, sv, reports: [{ date: '2026-10-12', title: 'Keterbukaan Informasi sehubungan dengan Rencana Penambahan Modal dengan HMETD' }] })
    expect(c.funding.standby).toBe('')
    const f = riFunding(c, riCalc(c, 81))
    expect(f.key).toBe('doubt')
    expect(f.reasons.some(x => /di atas harga pasar/.test(x.t))).toBe(true)
    expect(f.last.title).toMatch(/Rencana Penambahan Modal/)
  })
  it('pembeli siaga yang disebut tegas menaikkan skor', async () => {
    const { riFunding } = await import('../rightsIssue.js')
    const c = riCase(A, { aset, sv, pv: { rencana: 'Rights issue disetujui 21 Mei 2026, dengan AIC sebagai pembeli siaga.' } })
    expect(c.funding.standby).toBe('ya')
    expect(riFunding(c, riCalc(c, 50)).reasons.some(x => x.s > 0 && /pembeli siaga/.test(x.t))).toBe(true)
  })
})

describe('riPriceNeeded', () => {
  const c = { kind: 'PMHMETD', cash: 100e9, V: 0, price: 100, nominal: 10, Nmax: 2e9 }
  it('harga pasar minimum pada diskon 10/20/30% dan selisih ke harga kini', () => {
    const n = riPriceNeeded(c, 80)
    expect(n.need.map(x => Math.round(x.price))).toEqual([89, 100, 114])
    expect(n.ref).toBe(100)
    expect(n.status).toBe('cukup')
    expect(n.pMin).toBe(50)
  })
  it('harga pelaksanaan di bawah minimum: saham maksimum tidak cukup', () => {
    const n = riPriceNeeded(c, 40)
    expect(n.short.kurang).toBe(20e9)
  })
  it('tanpa dana tunai tidak dihitung', () => {
    expect(riPriceNeeded({ ...c, cash: 0, V: 50e9 }, 80)).toBeNull()
  })
})

describe('riScenarios', () => {
  it('harga RI = setoran ÷ saham baru; harga dibutuhkan = harga RI ÷ 0,8', () => {
    const s = riScenarios({ S0: 1e9, price: 100, nominal: 10, V: 0, cash: 100e9 }, null)
    const r1 = s.rows.find(x => x.ratio === 1)
    expect(r1.P).toBe(100); expect(r1.need).toBe(125); expect(r1.terp).toBe(100); expect(r1.dilusi).toBe(0.5)
    const r20 = s.rows.find(x => x.ratio === 20)
    expect(r20.bawahNominal).toBe(true)
    expect(s.rows.some(x => x.tag === 'harga RI = harga kini')).toBe(true)
  })
})

describe('riExercise', () => {
  it('contoh NAYZ: rasio 1:1, A = seluruh nilai, B = tunai saja; inbreng melalui HMETD → A konsisten', () => {
    const e = riExercise({ S0: 2.55e9, kind: 'campuran', V: 1.79e12, cash: 0.448e12, nominal: 10, price: 77 }, 1)
    expect(e.A.up).toBe(878)
    expect(e.B.up).toBe(176)
    expect(e.consistent).toBe('A')
  })
})

describe('asetLaba', () => {
  it('menyetahunkan laba 7 bulan, menghitung laba porsi dan PER implisit', () => {
    const l = asetLaba({ aset: { porsiPersen: 100, nilaiTransaksiRp: 14.57e12, keuangan: { periode: '31 Jul 2026 (7 bulan)', pendapatanRp: 7.79e12, labaBersihRp: 439.5e9, ekuitasRp: 4.18e12 } } }, { S1: 18.28e9, P: 2150 })
    expect(l.f).toBeCloseTo(12 / 7)
    expect(Math.round(l.labaThn / 1e9)).toBe(753)
    expect(l.per).toBeCloseTo(19.3, 1)
    expect(l.eps).toBeGreaterThan(40)
  })
  it('tanpa laba & pendapatan → null; aset rugi ditandai', () => {
    expect(asetLaba({ aset: { keuangan: {} } })).toBeNull()
    expect(asetLaba({ aset: { keuangan: { labaBersihRp: -12e9, periode: '4 bulan' } } }).rugi).toBe(true)
  })
})

describe('riTrading', () => {
  it('katalis di depan + likuiditas cukup = ada peluang trading; tereksekusi = tidak', () => {
    const c = { status: 'rencana', price: 264, avgVal: 5e9, exAssumed: true, doc: { jadwal: [{ tahap: 'RUPSLB', waktu: '9 Nov 2026', status: 'rencana' }] } }
    const t = riTrading(c, { terp: 25 }, new Date(2026, 9, 26))
    expect(t.key).toBe('ada')
    expect(t.aturan.join(' ')).toMatch(/sebelum cum date/)
    expect(riTrading({ ...c, status: 'tereksekusi' }, null).key).toBe('tidak')
  })
})

describe('riLevels / riRating (angka rekomendasi)', () => {
  const c = { price: 262, status: 'rencana', kind: 'PMHMETD', exAssumed: true, doc: { pembeliSiaga: { ada: false }, rasio: '1 : 20 HMETD (bersama Waran Seri II)' } }
  const r = { terp: 25, N: 154.78e9, total: 2012e9, pubAfter: 0.016 }
  it('menampilkan potensi turun, batas rugi ber-tick, asumsi, dan risiko kunci', () => {
    const lv = riLevels(c, r, 'TRADING BUY (Spekulatif)')
    const m = Object.fromEntries(lv.angka.map(x => [x.k, x.v]))
    expect(m['Potensi turun bila ditahan melewati cum date']).toBe('±90%')
    expect(m['Batas rugi']).toBe('Rp234 (−10%)')
    expect(lv.asumsi).toMatch(/asumsi Rp13/)
    expect(lv.risiko.join(' ')).toMatch(/pembeli siaga.*free float.*waran/s)
  })
  it('transaksi tereksekusi tidak memakai cum date dan teks partisipasinya disesuaikan', () => {
    const lv = riLevels({ ...c, status: 'tereksekusi' }, r, 'BUY')
    expect(lv.angka.map(x => x.k)).toEqual(['Harga sekarang'])
    const rt = riRating({ key: 'layak' }, { key: 'tidak', reasons: [{ s: 0, t: 'Penambahan modal sudah tereksekusi.' }] }, { ...c, status: 'tereksekusi' }, r)
    expect(rt.partTxt).toMatch(/sudah terlaksana/)
  })
})
