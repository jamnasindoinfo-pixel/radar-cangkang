import { describe, it, expect } from 'vitest'
import { kjppStatus, mechOf, flowOf, annualFactor, reservesOf, peerMultiples, simDefaults, simKjpp, dilusi,
  analysisProsCons, ctrlProsCons, clip, relationTone, deepView, storyValuation, radarGeom, injSteps, peerNote } from '../emitenExtra.js'

describe('peerNote', () => {
  it('hanya menyebut pembanding yang datanya terbaca', () => {
    expect(peerNote({ peers: ['CMRY', 'ICBP'], peersOk: ['CMRY', 'ICBP'] })).toBe('Kelipatan pembanding: median 2 emiten (CMRY, ICBP).')
    expect(peerNote({ peers: ['CMRY', 'ICBP', 'MYOR'], peersOk: ['ICBP'] })).toBe('Kelipatan pembanding: median 1 emiten (ICBP); data CMRY, MYOR tidak tersedia.')
  })
  it('tidak menulis "median 0 emiten" saat data kosong (versi publik)', () => {
    expect(peerNote({ peers: ['CMRY', 'ICBP', 'MYOR'], peersOk: [] })).toBe('Kelipatan pembanding: data CMRY, ICBP, MYOR tidak tersedia, jadi tidak dipakai.')
    expect(peerNote({ peers: [] })).toBe('Kelipatan pembanding: belum ditentukan.')
    expect(peerNote()).toBe('Kelipatan pembanding: belum ditentukan.')
  })
})

describe('kjppStatus & storyValuation', () => {
  it('memetakan status', () => {
    expect(kjppStatus({ status: 'terbit' }).tone).toBe('good')
    expect(kjppStatus({ status: 'ditunjuk' }).tone).toBe('warn')
    expect(kjppStatus({ status: 'belum' }).id).toBe('belum')
    expect(kjppStatus(null).id).toBe('belum')
  })
  it('kelipatan kapitalisasi dari nilai transaksi, jatuh ke nominal story', () => {
    expect(storyValuation({ aset: { sektor: 'batu bara' }, transaksi: { nilaiRp: 2e12 } }, { mcapRp: 1e12 }).ratio).toBe(2)
    expect(storyValuation({ transaksi: {} }, { sv: { nominal: 'Rp500 miliar' }, mcapRp: 1e12 }).ratio).toBe(0.5)
    expect(storyValuation(null)).toBe(null)
  })
})

describe('mekanisme', () => {
  it('membaca cara bayar', () => {
    expect(mechOf({ transaksi: { caraBayar: 'Tukar saham (inbreng) melalui rights issue' } })).toBe('inbreng')
    expect(mechOf({ transaksi: { caraBayar: 'Penggabungan usaha' } })).toBe('merger')
    expect(mechOf({ transaksi: { caraBayar: 'utang dikonversi menjadi saham' } })).toBe('konversi')
    expect(mechOf(null, { injectType: 'PMHMETD' })).toBe('rights')
    expect(mechOf({ transaksi: { caraBayar: 'kas internal' } })).toBe('tunai')
  })
  it('bagan: pemilik aset dari riset afiliasi, publik muncul untuk rights', () => {
    const f = flowOf({ t: 'MEJA', mech: 'inbreng', aset: { aset: { nama: 'PT Trimata Coal Perkasa (TCP)', porsi: '45% (pengendali)' }, transaksi: { nilaiRp: 1.6e12 } }, owner: 'Subagio (98,33%)', hargaPelaksanaan: 450 })
    expect(f.boxes.map(b => b.t1)).toContain('MEJA')
    expect(f.boxes[0].t2).toBe('Subagio (98,33%)')
    expect(f.arrows[0].lines).toEqual(['serahkan saham 45%', 'Rp1,6 T'])
    expect(f.arrows[1].lines[0]).toBe('saham baru @Rp450')
    expect(flowOf({ t: 'X', mech: 'rights' }).boxes).toHaveLength(5)
    expect(flowOf({ t: 'X', mech: 'tunai' }).boxes).toHaveLength(4)
  })
  it('langkah mengikuti tonggak', () => {
    const s = injSteps('inbreng', { sv: { injectType: 'Tambang' }, ms: { rupslb: true } })
    expect(s.map(x => x.done)).toEqual([true, false, true, false, false, false])
  })
})

describe('simulasi KJPP', () => {
  it('faktor penyetahunan & cadangan', () => {
    expect(annualFactor('7 bulan 2026 (Januari–Juli 2026)')).toBeCloseTo(12 / 7)
    expect(annualFactor('1H 2026')).toBe(2)
    expect(annualFactor('FY2025')).toBe(1)
    expect(reservesOf({ cadangan: '±400 juta ton (cadangan tertambang)' })).toEqual({ mt: 400, kind: 'cadangan' })
    expect(reservesOf({ sumberDaya: '693,7 juta ton' })).toEqual({ mt: 693.7, kind: 'sumber daya' })
    expect(reservesOf({})).toBe(null)
  })
  it('kelipatan pembanding: median, nilai ekstrem dibuang', () => {
    const m = peerMultiples([{ metrics: { per: 10, pbv: 2, revenueTtm: 100 }, stats: { marketCap: 200 } }, { metrics: { per: 20, pbv: 50 } }, null, { metrics: { per: 500 } }])
    expect(m).toEqual({ n: 3, per: 15, ps: 2, pbv: 2 })
  })
  it('nilai awal dari aset-verified', () => {
    const d = simDefaults({ aset: { porsi: '100% (24.440 saham)', keuangan: { periode: '7 bulan 2026', labaBersih: 439.52e9 } }, transaksi: { nilaiRp: 14.57e12 } })
    expect(d.tx).toBe(14570); expect(d.porsi).toBe(100); expect(d.laba).toBeCloseTo(753.5, 0)
  })
  it('tanpa data keuangan → tidak ada nilai tengah, harga tersirat per ton tetap dihitung', () => {
    const r = simKjpp({ tx: 1600, porsi: 45, res: 400 })
    expect(r.mid).toBe(null)
    expect(r.implied).toBeCloseTo(1600e9 / (400e6 * 0.45))
  })
  it('median pendekatan, rentang ±25%, vonis mahal/murah/wajar', () => {
    const base = { porsi: 100, laba: 100, per: 10, pend: 1000, ps: 1.2, eq: 500, pbv: 2 }   // 1000, 1200, 1000 → median 1000 M
    const wajar = simKjpp({ ...base, tx: 1100 })
    expect(wajar.mid).toBe(1000e9); expect(wajar.lo).toBe(750e9); expect(wajar.hi).toBe(1250e9)
    expect(wajar.verdict.tone).toBe('good'); expect(wajar.conf).toBe('tinggi')
    expect(simKjpp({ ...base, tx: 2000 }).verdict.tone).toBe('strong')
    expect(simKjpp({ ...base, tx: 500 }).verdict.t).toMatch(/di bawah/)
    expect(simKjpp({ ...base, tx: '' }).verdict.tone).toBe('warn')
    expect(simKjpp({ laba: 100, per: 10, porsi: 50 }).mid).toBe(500e9)
    expect(simKjpp({ laba: 100, per: 10 }).conf).toBe('rendah')
  })
})

describe('dilusi', () => {
  it('saham baru, porsi publik, nilai buku per saham', () => {
    const r = dilusi({ S0: 1000, E0: 1000, f: 0.5, V: 1000, C: 0, P: 1, tk: 0, h: 1 })
    expect(r.N).toBe(1000); expect(r.S1).toBe(2000); expect(r.pubAfter).toBe(0.25); expect(r.vps).toBe(1)
    expect(dilusi({ S0: 1000, f: 0.5, V: 1000, P: 1, tk: 1 }).pubAfter).toBe(0.5)
    expect(dilusi({ S0: 1000, V: 1000, P: 0 })).toBe(null)
  })
})

describe('kelebihan vs kekurangan', () => {
  const dims = [{ k: 'Pengendali', s: 7, why: ['Ada pembeli strategis.'] }, { k: 'Fundamental', s: 2, why: ['Rugi.'] }]
  it('analisa: KJPP, aset besar, harga di bawah PTW, HSC, risiko pengendali', () => {
    const a = { t: 'ABCD', dims, mcap: 1e12, price: 80, tender: { price: 100 }, sv: { injectType: 'Tambang' }, d: { ms: {} } }
    const profil = { pengendali: [{ nama: 'Budi', risiko: 'Tidak ditemukan kasus hukum. RUPSLB gagal kuorum dua kali.', jaringan: [{ dengan: 'A', keyakinan: 'terverifikasi' }, { dengan: 'B', keyakinan: 'terverifikasi' }] }],
      afiliasi: { hubungan: 'Penjual adalah milik pengendali yang sama.' } }
    const { pros, cons } = analysisProsCons(a, { profil, aset: { kjpp: { status: 'ditunjuk', nama: 'KJPP X' }, transaksi: { nilaiRp: 2e12 } }, hsc: ['ABCD'] })
    const pt = pros.map(x => x.t), ct = cons.map(x => x.t)
    expect(pt).toContain('Pengendali kredibel')
    expect(pt).toContain('Jaringan bisnis pengendali terverifikasi')
    expect(pt.some(t => /Potensi aset besar/.test(t))).toBe(true)
    expect(pt).toContain('Harga 20% di bawah harga PTW')
    expect(ct).toContain('Laporan KJPP belum terbit (KJPP X)')
    expect(ct).toContain('Aset dibeli dari pihak afiliasi')
    expect(ct).toContain('Termasuk saham HSC BEI')
    expect(ct).toContain('Fundamental lemah')
    expect(cons.find(x => x.t === 'Catatan risiko Budi').d).toBe('RUPSLB gagal kuorum dua kali.')
  })
  it('KJPP terbit masuk kelebihan; kosong tetap aman', () => {
    expect(analysisProsCons({ t: 'X', dims: [] }, { aset: { kjpp: { status: 'terbit', nama: 'KJPP Y' } } }).pros[0].t).toBe('Penilaian KJPP terbit')
    expect(analysisProsCons({ t: 'X' })).toEqual({ pros: [], cons: [] })
  })
  it('hubungan afiliasi', () => {
    expect(relationTone('Tidak terafiliasi menurut pernyataan resmi.')).toBe(null)
    expect(relationTone('Tidak terafiliasi. Catatan kritis: diteken 18 hari setelah akuisisi.')).toBe('kritis')
    expect(relationTone('Aset milik pengendali.')).toBe('afiliasi')
  })
  it('pengendali: pengalaman, jaringan media, UBO kosong, emiten radar lain', () => {
    const profil = { pengendali: [{ nama: 'Budi', pengalaman: 'Bankir 20 tahun. Lainnya.', jaringan: [{ dengan: 'Z', keyakinan: 'disebut media' }], risiko: 'Tidak ditemukan.' }] }
    const { pros, cons } = ctrlProsCons({ profil, c: { name: 'ABC PTE LTD', beneficiary: [] }, active: [{ symbol: 'EPAC' }], exited: [1, 2, 3], radarTickers: ['EPAC'], group: ['GPSO'] })
    expect(pros.map(x => x.t)).toEqual(['Pengalaman Budi', 'Grup juga mengendalikan GPSO'])
    expect(pros[0].d).toBe('Bankir 20 tahun.')
    expect(cons.map(x => x.t)).toEqual(['1 hubungan hanya disebut media', 'UBO tidak tercatat di Stockbit', 'SPV luar negeri', 'Memegang 1 emiten radar lain', 'Pernah keluar dari 3 emiten'])
  })
})

describe('sudut pandang & radar', () => {
  it('narasi berangka', () => {
    const parts = deepView({ t: 'ABCD', mcap: 1e12, price: 100, tender: { price: 75 }, pv: { siapa: 'Masuk di Rp20/saham.' }, pa: { tesisSalahBila: ['KJPP rendah'], variabelKunci: ['RUPS'] } },
      { profil: { ringkas: 'Dikendalikan Budi.' }, aset: { aset: { nama: 'PT Tambang', sektor: 'batu bara' }, transaksi: { nilaiRp: 2e12 }, kjpp: { status: 'ditunjuk' } } })
    expect(parts.map(p => p[0])).toEqual(['Pengendali dan motifnya', 'Aset yang masuk dan nilainya', 'Pihak yang diuntungkan oleh struktur transaksi', 'Kondisi yang menggugurkan tesis dan hal yang perlu dipantau'])
    expect(parts[1][1]).toMatch(/PT Tambang \(batu bara\) senilai Rp2 T, setara 2× kapitalisasi ABCD/)
    expect(parts[2][1]).toMatch(/^Pengendali masuk di Rp20 per saham, PTW Rp75, harga kini Rp100\./)
    expect(deepView({ t: 'X' })).toEqual([])
  })
  it('radar: sumbu pertama tegak ke atas, skor 10 di tepi', () => {
    const g = radarGeom([{ k: 'A', s: 10 }, { k: 'B', s: 0 }, { k: 'C', s: 5 }, { k: 'D', s: 5 }, { k: 'E', s: 5 }, { k: 'F', s: 5 }])
    expect(g.dots[0].x).toBeCloseTo(130); expect(g.dots[0].y).toBeCloseTo(116 - 92)
    expect(g.dots[1].x).toBeCloseTo(130); expect(g.dots[0].anchor).toBe('middle')
    expect(g.rings).toHaveLength(4)
  })
})

describe('clip', () => {
  it('memotong di batas kata', () => {
    expect(clip('satu dua tiga empat', 12)).toBe('satu dua…')
    expect(clip('pendek', 20)).toBe('pendek')
  })
})

describe('fase siklus di analisa', () => {
  // Lima transaksi sintetis: harga ÷ PTW konstan k sepanjang -200..+400 hari.
  const mk = (t, k) => ({ ticker: t, p0: 100, last: 100 * k, peak: 100 * k, base: 50, baseDay: -150, peakDay: -20,
    series: Array.from({ length: 31 }, (_, i) => [-200 + i * 20, k]) })
  const bm = { deals: [1, 2, 3, 4, 5].map(k => mk('D' + k, k)) }
  const now = new Date('2026-10-21T00:00:00').getTime()
  const start = new Date(now - 100 * 864e5).toISOString().slice(0, 10)
  const base = { t: 'ABCD', dims: [], d: { ticker: 'ABCD', tender: { start, price: 100 }, price: 90, ms: {} } }
  it('pros/cons per fase', () => {
    expect(analysisProsCons(base, { bm, now }).pros.map(x => x.t)).toContain('Siklus: Di bawah harga PTW')
    expect(analysisProsCons({ ...base, d: { ...base.d, price: 900 } }, { bm, now }).cons.map(x => x.t)).toContain('Siklus: Euforia berlanjut')
    expect(analysisProsCons(base, { bm, now, aset: { kjpp: { status: 'terbit' } } }).pros.map(x => x.t)).toContain('Siklus: Injeksi aset (gelombang 2)')
    expect(analysisProsCons(base, { now }).pros.some(x => /Siklus/.test(x.t))).toBe(false)
  })
  it('deepView: nama fase, jumlah kasus, titik dasar & puncak median', () => {
    const [h, t] = deepView(base, { bm, now }).find(p => /siklus/.test(p[0]))
    expect(h).toBe('Posisi dalam siklus backdoor')
    expect(t).toMatch(/^10[01] hari sejak PTW dimulai; fase: Di bawah harga PTW\. Pada 5 kasus, titik dasar median 150 hari sebelum PTW \(0,5×\) dan puncak median 20 hari sebelum PTW \(3×\)\. Pasar meragukan/)
  })
})
