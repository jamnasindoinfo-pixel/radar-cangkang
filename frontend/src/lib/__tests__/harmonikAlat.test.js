import { describe, expect, it } from 'vitest'
import { cariPola, diagramIdeal as diagramIdeal2, konfirmasiD as konfirmasiD2, skenarioD as skenarioD2, labPola, rasioContoh, jarakElliott, nilaiTren, trenBesar, alasanPola, alasanX, candleBalik, skenarioD, konfirmasiD, rsi, aturanElliott, cariElliott, cariXabcd, diagramIdeal, fibExtension, fibRetracement, kelompokBar, przPola, rencanaPosisi, zigzag, basi, SKALA_POLA } from '../harmonikAlat.js'

// Bar sintetis: harga bergerak lurus antar titik, 10 bar per kaki, tanggal hari kerja berurutan.
function bangun(titik, per = 10) {
  const harga = [titik[0]]
  for (let k = 1; k < titik.length; k++)
    for (let j = 1; j <= per; j++) harga.push(titik[k - 1] + (titik[k] - titik[k - 1]) * j / per)
  const t0 = Date.UTC(2026, 0, 5)
  let hari = 0
  return harga.map((c, i) => {
    let d
    do { d = new Date(t0 + hari++ * 864e5) } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
    const o = i ? harga[i - 1] : c
    return { d: d.toISOString().slice(0, 10), o, h: Math.max(o, c), l: Math.min(o, c), c, v: 1000 }
  })
}

// Gartley bullish: X 100, A 200, B 0,618 XA, C 0,618 AB, D 0,786 XA.
const X = 100, A = 200, B = 200 - 61.8, C = B + 0.618 * 61.8, D = 200 - 78.6

describe('kelompokBar', () => {
  it('menggabung harian jadi mingguan dan bulanan', () => {
    const b = bangun([100, 110, 105], 10)
    const w = kelompokBar(b, 'W')
    expect(w.length).toBe(Math.ceil(b.length / 5))
    expect(w[0]).toMatchObject({ d: b[0].d, o: b[0].o, c: b[4].c, v: 5000 })
    expect(w[0].h).toBe(Math.max(...b.slice(0, 5).map(x => x.h)))
    const m = kelompokBar(b, 'M')
    // 21 hari bursa mulai 5 Jan 2026: Januari (19 hari) dan awal Februari.
    expect(m.map(x => x.d)).toEqual(['2026-01-05', '2026-02-02'])
    expect(m[0].l).toBe(Math.min(...b.slice(0, 19).map(x => x.l)))
  })
})

describe('zigzag', () => {
  it('menandai pivot bergantian dan ekstrem berjalan sebagai tentatif', () => {
    const pv = zigzag(bangun([150, X, A, B, C, D]), 0.04)
    expect(pv.map(x => x.k).join('')).toBe('HLHLHL')
    expect(pv.map(x => Math.round(x.p * 10) / 10)).toEqual([150, X, A, B, C, D].map(v => Math.round(v * 10) / 10))
    expect(pv.at(-1).tentatif).toBe(true)
  })
})

describe('zigzag: pivot tertembus dan outside bar', () => {
  const bar = (d, o, h, l, c) => ({ d, o, h, l, c, v: 1000 })
  // Contoh AKRA 4-9 Nov 2026: lembah 1.280, pantulan 1.365, lalu outside bar 6 Nov (1.370 / 1.275).
  const akra = [bar('a1', 1450, 1475, 1440, 1460), bar('a2', 1460, 1460, 1380, 1390), bar('a3', 1390, 1395, 1300, 1310),
    bar('a4', 1310, 1350, 1280, 1300), bar('a5', 1300, 1365, 1305, 1340), bar('a6', 1340, 1370, 1275, 1360),
    bar('a7', 1360, 1370, 1320, 1330), bar('a8', 1330, 1335, 1240, 1250)]
  it('setiap pivot adalah titik paling ekstrem di antara tetangganya', () => {
    for (const th of [0.04, 0.06]) {
      const pv = zigzag(akra, th)
      for (let j = 1; j < pv.length - 1; j++) {
        const [a, t, b] = [pv[j - 1], pv[j], pv[j + 1]]
        const antara = akra.slice(a.i + 1, b.i)
        if (t.k === 'L') expect(Math.min(...antara.map(x => x.l))).toBe(t.p)
        else expect(Math.max(...antara.map(x => x.h))).toBe(t.p)
        expect(a.i).toBeLessThan(t.i)
      }
    }
  })
  it('D basi: pivot searah sesudahnya lebih ekstrem', () => {
    const pv = [{ i: 0, p: 100, k: 'L' }, { i: 5, p: 120, k: 'H' }, { i: 9, p: 95, k: 'L' }]
    expect(basi(pv, { i: 1, p: 100, k: 'L' }, 2)).toBe(true)
    expect(basi(pv, { i: 1, p: 90, k: 'L' }, 2)).toBe(false)
  })
  it('lembah 1.275 di outside bar menjadi pivot, bukan tertelan', () => {
    expect(zigzag(akra, 0.04).some(p => p.k === 'L' && p.p === 1275)).toBe(true)
  })
})

describe('cariXabcd', () => {
  it('menemukan Gartley bullish dengan D di PRZ', () => {
    const rows = cariXabcd(bangun([150, X, A, B, C, D]))
    const g = rows.find(r => r.pola === 'gartley')
    expect(g).toBeTruthy()
    expect(g).toMatchObject({ arah: 'bullish', status: 'prz' })
    expect(g.titik.map(t => t.n).join('')).toBe('XABCD')
    expect(g.rasio.b).toBeCloseTo(0.618, 2)
    expect(g.rasio.d).toBeCloseTo(0.786, 2)
    expect(g.stop).toBe(X)
    // Target 0,382 dan 0,618 kaki AD, dibulatkan ke bawah ke fraksi harga (bullish).
    expect(g.target[0]).toBe(151)   // 121,4 + 78,6 x 0,382 = 151,4
    expect(g.target[1]).toBe(169)   // 121,4 + 78,6 x 0,618 = 169,97 -> fraksi 1 -> 169
  })
  it('memproyeksikan D saat harga masih menuju PRZ', () => {
    const rows = cariXabcd(bangun([150, X, A, B, C, 140]))
    const g = rows.find(r => r.pola === 'gartley')
    expect(g.status).toBe('menuju')
    expect(g.titik[4].proyeksi).toBe(true)
    expect(g.titik[4].p).toBeGreaterThan(g.prz[0] - 1e-9)
    expect(g.titik[4].p).toBeLessThan(g.prz[1] + 1e-9)
  })
  it('PRZ Gartley berada di sekitar 0,786 XA', () => {
    const prz = przPola('gartley', X, A, B, C)
    expect(prz[0]).toBeLessThan(D)
    expect(prz[1]).toBeGreaterThan(D)
  })
  it('pola batal (close menembus stop setelah D) tidak ditampilkan', () => {
    // Gartley bullish lengkap, lalu harga naik sedikit dan jatuh menembus X (stop).
    const rows = cariXabcd(bangun([150, X, A, B, C, D, D + 10, 90]), [0.04])
    expect(rows.find(r => r.pola === 'gartley' && r.titik[0].p === X)).toBeUndefined()
  })
  it('kosong bila data terlalu pendek', () => {
    expect(cariXabcd(bangun([100, 120], 5))).toEqual([])
  })
})

describe('SKALA_POLA', () => {
  it('harian 4% sampai 50% setiap 0,5%', () => {
    expect(SKALA_POLA.D.length).toBe(93)
    expect([SKALA_POLA.D[0], SKALA_POLA.D[1], SKALA_POLA.D.at(-1)]).toEqual([0.04, 0.045, 0.5])
    expect(SKALA_POLA.D).toContain(0.07)
  })
})

describe('cariXabcd: skala besar untuk saham bergerak lebar', () => {
  // Meniru KOTA 2026: Shark X 71, A 210, B 140, C 252, D 50, dengan pantulan 81 → 104 (naik 28%) di tengah kaki C→D.
  const kota = bangun([120, 71, 210, 140, 252, 81, 104, 50, 75])
  it('pantulan 28% memecah kaki C→D di skala jarang 4–25%', () => {
    expect(cariXabcd(kota, [0.04, 0.06, 0.1, 0.15, 0.2, 0.25]).find(r => r.pola === 'shark')).toBeUndefined()
  })
  it('skala rapat membaca Shark-nya di sekitar 30%', () => {
    const s = cariXabcd(kota).find(r => r.pola === 'shark')
    expect(s).toMatchObject({ arah: 'bullish', status: 'berbalik' })
    expect(s.skala).toBeGreaterThan(0.28)
    expect(s.titik.map(t => Math.round(t.p))).toEqual([71, 210, 140, 252, 50])
  })
})

describe('Fibonacci', () => {
  const bars = bangun([150, X, A, B, C, D])
  const g = cariXabcd(bars).find(r => r.pola === 'gartley')
  it('retracement memakai kaki XA pola', () => {
    const f = fibRetracement(bars, g)
    expect(f.a.p).toBe(X)
    expect(f.b.p).toBe(A)
    expect(f.level.find(l => l.r === 0.618).p).toBeCloseTo(A - 61.8, 5)
    expect(f.level.find(l => l.r === 0.786).p).toBeCloseTo(D, 5)
  })
  it('extension memproyeksikan AB dari C', () => {
    const f = fibExtension(bars, g)
    expect(f.titik.map(t => t.p)).toEqual([A, B, C])
    expect(f.level.find(l => l.r === 1).p).toBeCloseTo(C + (B - A), 5)
  })
  it('tanpa pola memakai swing terakhir yang sudah selesai', () => {
    const f = fibRetracement(bars, null, 0.04)
    expect(f.dasar).toMatch(/swing/)
    expect([f.a.p, f.b.p]).toEqual([B, C])
  })
})

describe('Elliott', () => {
  it('impuls naik yang memenuhi aturan', () => {
    const e = cariElliott(bangun([100, 150, 125, 220, 190, 250, 245]), [0.04])
    expect(e.valid).toBe(true)
    expect(e.naik).toBe(true)
    expect(e.titik.map(t => t.p)).toEqual([100, 150, 125, 220, 190, 250])
  })
  it('gelombang 4 yang masuk wilayah gelombang 1 melanggar aturan', () => {
    const a = aturanElliott([100, 150, 125, 220, 140, 250].map((p, i) => ({ i, p })))
    expect(a.valid).toBe(false)
    expect(a.aturan.find(x => /Gelombang 4/.test(x.teks)).ok).toBe(false)
  })
  it('gelombang 5 yang masih berjalan diberi proyeksi', () => {
    const e = cariElliott(bangun([100, 150, 125, 220, 190, 200]), [0.04])
    expect(e.status).toBe('gelombang 5 berjalan')
    expect(e.proyeksi[0].p).toBeCloseTo(240, 5)
  })
  it('impuls 0-4 (gelombang 4 berjalan) menunggu gelombang 5', () => {
    const e = cariElliott(bangun([100, 150, 125, 220, 190]), [0.04])
    expect(e.status).toBe('menuju gelombang 5')
    expect(e.titik).toHaveLength(5)
  })
})

describe('rencanaPosisi', () => {
  const bars = bangun([150, X, A, B, C, D])
  const rows = cariXabcd(bars)
  it('long dari pola bullish: entry di D, stop di balik X, target 0,382/0,618 AD', () => {
    const p = rencanaPosisi(bars, 'long', rows)
    expect(p.dasar).toMatch(/bullish/)
    expect(p.entry).toBe(121)
    expect(p.stop).toBe(99)
    expect(p.target[0]).toBeGreaterThan(p.entry)
    expect(p.rr[0]).toBeGreaterThan(1)
    expect(p.stopPct).toBeLessThan(0)
  })
  it('stop swing terlalu jauh: rencana tidak dihitung', () => {
    const p = rencanaPosisi(bangun([300, 150, 160]), 'short', [], 0.04)
    expect(p.kosong).toBe(true)
    expect(p.catatan).toMatch(/terlalu jauh/)
  })
  it('short tanpa pola bearish memakai swing terakhir', () => {
    const p = rencanaPosisi(bangun([100, 130, 115, 125, 118]), 'short', [], 0.04)
    expect(p.dasar).toMatch(/swing/)
    expect(p.stop).toBe(126)          // satu fraksi di atas swing high 125
    // Swing low 115 hanya 3 poin (< 1R = 8) dari entry 118: dilewati, TP1 ke swing low 100.
    expect(p.target[0]).toBe(100)
    expect(p.target[1]).toBeLessThan(p.target[0])
  })
})

describe('diagram ideal dan alasan', () => {
  it('Butterfly bullish: D di bawah X, label rasio baku', () => {
    const d = diagramIdeal('butterfly', 'bullish')
    const y = Object.fromEntries(d.titik.map(t => [t.n, t.y]))
    expect(y.A).toBe(0)          // puncak di atas
    expect(y.D).toBeGreaterThan(y.X)   // D lebih rendah dari X (ekstensi)
    expect(d.garis.map(g => g.teks)).toEqual(['0,786', '0,382–0,886', '1,618–2,24', '1,27–1,414'])
  })
  it('bearish dibalik vertikal', () => {
    const a = diagramIdeal('gartley', 'bullish'), b = diagramIdeal('gartley', 'bearish')
    a.titik.forEach((t, j) => expect(b.titik[j].y).toBeCloseTo(1 - t.y, 9))
  })
  it('alasan memuat rasio aktual vs ideal', () => {
    const g = cariXabcd(bangun([150, X, A, B, C, D])).find(r => r.pola === 'gartley')
    const al = alasanPola(g)
    expect(al[0]).toMatchObject({ ideal: '0,618', ok: true })
    expect(al.every(x => x.ok)).toBe(true)
    expect(al.some(x => /AD\/XA/.test(x.teks))).toBe(true)
  })
})

describe('AB=CD di dalam pola', () => {
  it('CD minimal 0,85 AB; yang lebih pendek ditandai, tidak dibuang', () => {
    const g = cariXabcd(bangun([150, X, A, B, C, D])).find(r => r.pola === 'gartley')
    expect(g.abcd).toMatchObject({ kriteria: [1, 1.27], ok: true })
    const pendek = cariXabcd(bangun([150, X, A, B, B + 0.45 * 61.8, D])).find(r => r.pola === 'gartley')
    expect(pendek.abcd.ok).toBe(false)
    expect(alasanPola(pendek).find(a => /AB=CD/.test(a.teks))).toMatchObject({ ok: false, ideal: '1–1,27' })
    expect(pendek.skor).toBeGreaterThan(g.skor)
  })
})

describe('alasanX', () => {
  it('menjelaskan X sebagai swing low awal kaki XA dan batas batal Gartley', () => {
    const bars = bangun([150, X, A, B, C, D])
    const g = cariXabcd(bars).find(r => r.pola === 'gartley')
    const t = alasanX(g, bars)
    expect(t[0]).toMatch(/^X = swing low 100 \(2026-/)
    expect(t[0]).toMatch(/naik 100% ke A 200/)
    expect(t.join(' ')).toMatch(/batas batal/)
  })
})

describe('konfirmasi di D', () => {
  it('candle pembalikan: pin bar dan engulfing', () => {
    const pin = [{ o: 10, h: 10.5, l: 9.5, c: 10 }, { o: 10, h: 10.1, l: 8, c: 9.9 }]
    expect(candleBalik(pin, 1, true)).toBe('pin bar')
    const eng = [{ o: 10, h: 10.1, l: 9, c: 9.2 }, { o: 9.1, h: 10.4, l: 9.05, c: 10.3 }]
    expect(candleBalik(eng, 1, true)).toBe('bullish engulfing')
    expect(candleBalik(eng, 1, false)).toBe('')
  })
  it('RSI 100 saat harga hanya naik', () => {
    const r = rsi(Array.from({ length: 20 }, (_, i) => 100 + i))
    expect(r[13]).toBeNull()
    expect(r[19]).toBe(100)
  })
  it('pola dengan D terbentuk diberi empat cek; pola menuju tidak', () => {
    const bars = bangun([150, X, A, B, C, D, D + 20])
    bars.forEach(b => { b.v = 1000 })
    const iD = 50
    bars[iD + 1] = { ...bars[iD + 1], o: D - 1, l: D - 1.5, c: D + 4, h: D + 4.2, v: 3000 }  // bullish engulfing bervolume
    bars[iD] = { ...bars[iD], o: D + 1, c: D, h: D + 1.2, l: D }
    const g = cariXabcd(bars, [0.04]).find(r => r.pola === 'gartley')
    const k = konfirmasiD(bars, g)
    expect(k.total).toBe(4)
    expect(k.cek.find(c => c.k === 'candle').ok).toBe(true)
    expect(k.cek.find(c => c.k === 'volume').ok).toBe(true)
    expect(k.cek.find(c => c.k === 'struktur').ok).toBe(true)
    expect(konfirmasiD(bars, { ...g, titik: g.titik.map((t, j) => j === 4 ? { ...t, proyeksi: true } : t) })).toBeNull()
  })
})

describe('skenarioD', () => {
  it('panah ke TP1, TP2, C, dan jalur gagal di balik stop', () => {
    const g = cariXabcd(bangun([150, X, A, B, C, D])).find(r => r.pola === 'gartley')
    const sk = skenarioD(g)
    expect(sk.map(x => x.k)).toEqual(['t1', 't2', 'c', 'gagal'])
    expect(sk[0].ke.p).toBeCloseTo(g.target[0], 6)
    expect(sk[0].label).toMatch(/^Target naik 1/)
    expect(sk[2].ke.p).toBeCloseTo(C, 6)
    expect(sk[3].ke.p).toBeLessThan(g.stop)            // bullish: gagal = turun menembus stop
    expect(sk[3].stop).toBe(g.stop)
    expect(sk[3].label).toMatch(/Batal bila close menembus/)
    expect(sk.every(x => x.ke.i > g.titik[4].i)).toBe(true)
  })
  it('tanpa pola: tidak ada panah', () => {
    expect(skenarioD(null)).toEqual([])
    expect(skenarioD({ pola: null, titik: [] })).toEqual([])
  })
})

describe('perbaikan review', () => {
  it('stop di batas pita fraksi BEI tetap harga valid', () => {
    // floorTick(500,5) = 500 -> satu fraksi di bawahnya 498 (fraksi 2 di bawah 500), bukan 495.
    const bars = bangun([100, 130, 115, 125, 118])
    const tes = (stopMentah, arah) => rencanaPosisi(bars, arah, [{ arah: arah === 'long' ? 'bullish' : 'bearish', pola: 'bat', nama: 'Bat', status: 'prz',
      prz: [1, 2], stop: stopMentah, target: [stopMentah * (arah === 'long' ? 1.2 : 0.8), stopMentah * (arah === 'long' ? 1.3 : 0.7)],
      titik: [0, 1, 2, 3, { n: 'D', i: 40, p: stopMentah * (arah === 'long' ? 1.05 : 0.95) }] }]).stop
    expect(tes(500.5, 'long')).toBe(498)
    expect(tes(5003, 'long')).toBe(4990)
    expect(tes(499, 'short')).toBe(505)
    expect(tes(1999, 'short')).toBe(2010)
  })
  it('label target Cypher memakai kaki CD', () => {
    const sk = skenarioD({ pola: 'cypher', arah: 'bullish', kaki: 'CD', target: [150, 160], stop: 100,
      titik: [{ i: 0, p: 100 }, { i: 10, p: 200 }, { i: 20, p: 150 }, { i: 30, p: 234 }, { i: 40, p: 128 }] })
    expect(sk[0].label).toMatch(/0,382 CD/)
  })
})

describe('tren besar EMA', () => {
  const naik = Array.from({ length: 260 }, (_, i) => ({ c: 100 + i }))
  const turun = Array.from({ length: 260 }, (_, i) => ({ c: 400 - i }))
  it('harga di atas EMA50 dan EMA200 yang naik: tren naik kuat', () => {
    const t = trenBesar(naik)
    expect(t).toMatchObject({ arah: 'naik', kuat: true, acuanNama: 'EMA200' })
    expect(t.e50).toBeGreaterThan(t.e200)
  })
  it('bullish searah tren naik, bullish melawan tren turun', () => {
    expect(nilaiTren(trenBesar(naik), 'bullish').searah).toBe(true)
    const v = nilaiTren(trenBesar(turun), 'bullish')
    expect(v.searah).toBe(false)
    expect(v.teks).toMatch(/melawan tren besar/)
    expect(nilaiTren(trenBesar(turun), 'bearish').searah).toBe(true)
  })
  it('data kurang dari 200 bar memakai EMA50; kurang dari 50 bar tidak dinilai', () => {
    const t = trenBesar(naik.slice(0, 120))
    expect(t.e200).toBeNull()
    expect(t.acuanNama).toBe('EMA50')
    expect(nilaiTren(t, 'bullish').teks).toMatch(/EMA200 belum bisa dihitung/)
    expect(trenBesar(naik.slice(0, 30))).toBeNull()
  })
})

describe('jarakElliott', () => {
  it('impuls lama: tanggal selesai, umur, dan alasan', () => {
    const bars = bangun([100, 150, 125, 220, 190, 250, 200, 230, 210])   // impuls 0-5, lalu swing koreksi
    const e = { status: 'lengkap', naik: true, titik: [0, 10, 20, 30, 40, 50].map((i, j) => ({ n: String(j), i, p: bars[i].c })) }
    const j = jarakElliott(e, bars, 'hari bursa')
    expect(j.umur).toBe(bars.length - 1 - 50)
    const [y, m, d] = bars[50].d.split('-')
    expect(j.tgl).toBe(`${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1]} ${y}`)
    expect(j.teks).toMatch(/koreksi tiga gelombang \(A-B-C\)/)
  })
  it('impuls masih berjalan atau baru selesai: tanpa keterangan', () => {
    const bars = bangun([100, 150, 125, 220, 190, 250])
    expect(jarakElliott({ status: 'gelombang 5 berjalan', titik: [{ i: 50 }] }, bars)).toBeNull()
    expect(jarakElliott({ status: 'lengkap', titik: [{ i: 49 }] }, bars)).toBeNull()
    expect(jarakElliott(null, bars)).toBeNull()
  })
})

describe('lab pola', () => {
  it('rasio contoh tiap pola dikenali sebagai pola itu sendiri', () => {
    for (const k of ['gartley', 'bat', 'altbat', 'butterfly', 'crab', 'deepcrab', 'cypher', 'shark', 'fiveo']) {
      const r = rasioContoh(k)
      const hasil = labPola(r.b, r.c, r.d)
      expect(hasil.cocok.map(x => x.k), k).toContain(k)
    }
  })
  it('rasio acak yang tidak memenuhi aturan: tidak ada pola', () => {
    expect(labPola(0.95, 0.2, 0.5).cocok).toEqual([])
  })
  it('Gartley: B 0,618 dan D 0,786 dengan C 0,618', () => {
    const h = labPola(0.618, 0.618, 0.786)
    expect(h.cocok[0].k).toBe('gartley')
    expect(h.rasio.b).toBeCloseTo(0.618, 3)
  })
})

describe('pola tambahan: 5-0, AB=CD, Three Drives', () => {
  it('5-0 bullish: B melewati X, C melewati A, D di 0,50 BC', () => {
    // X 150, A 200, B 130 (1,4 XA), C 263 (1,9 AB), D = 263 - 0,5 x 133 = 196,5
    const rows = cariPola(bangun([180, 150, 200, 130, 263, 196.5]), [0.04])
    const r = rows.find(x => x.pola === 'fiveo')
    expect(r).toMatchObject({ arah: 'bullish', status: 'prz', bentuk: 'xabcd', kaki: 'DC' })
    expect(r.rasio.dbc).toBeCloseTo(0.5, 2)
    expect(r.stop).toBeCloseTo(263 + (130 - 263) * 0.618, 6)   // retracement 0,618 BC
    expect(r.ketTarget).toEqual(['0,618 DC', 'titik C'])
    expect(skenarioD2(r)[1].label).toMatch(/titik C/)
    expect(r.target[1]).toBe(262)                               // kembali ke C 263, dibulatkan ke fraksi 2 (bullish ke bawah)
  })
  it('AB=CD setara dan alternatif: empat titik, target dari kaki AD', () => {
    const C = 150 + 0.618 * 50
    const setara = cariPola(bangun([170, 200, 150, C, C - 50]), [0.04]).find(x => x.pola === 'abcd')
    expect(setara).toMatchObject({ arah: 'bullish', status: 'prz', bentuk: 'abcd' })
    expect(setara.titik.map(t => t.n).join('')).toBe('ABCD')
    expect(setara.rasio.cd).toBeCloseTo(1, 2)
    expect(setara.alasan.every(a => a.ok)).toBe(true)
    const alt = cariPola(bangun([170, 200, 150, C, C - 1.27 * 50]), [0.04]).find(x => x.pola === 'altabcd')
    expect(alt).toMatchObject({ arah: 'bullish', status: 'prz' })
    expect(alt.rasio.cd).toBeCloseTo(1.27, 2)
  })
  it('Three Drives bearish: tiga dorongan naik 1,27 kali koreksi', () => {
    const P = [110, 100, 150]
    P.push(150 - 0.618 * 50); P.push(P[3] + 1.27 * (150 - P[3])); P.push(P[4] - 0.618 * (P[4] - P[3])); P.push(P[5] + 1.27 * (P[4] - P[5]))
    const r = cariPola(bangun(P), [0.04]).find(x => x.pola === 'tigadorongan')
    expect(r).toMatchObject({ arah: 'bearish', status: 'prz', bentuk: 'tigadorongan' })
    expect(r.titik.map(t => t.n).join(' ')).toBe('0 1 A 2 B 3')
    expect(r.rasio.r1).toBeCloseTo(1.27, 2)
    expect(r.stop).toBeGreaterThan(r.titik[5].p)          // bearish: stop di atas dorongan ketiga
    expect(r.target[0]).toBeLessThan(r.titik[5].p)
  })
  it('AB=CD yang belum sampai PRZ tidak ditampilkan', () => {
    const C = 150 + 0.618 * 50
    expect(cariPola(bangun([170, 200, 150, C, C - 25]), [0.04]).filter(x => x.bentuk === 'abcd')).toEqual([])
  })
  it('Three Drives: dorongan ketiga di antara 1,27 dan 1,618 tidak dianggap di PRZ; PRZ sempit', () => {
    const dasar = [110, 100, 150]
    dasar.push(150 - 0.618 * 50); dasar.push(dasar[3] + 1.27 * (150 - dasar[3])); dasar.push(dasar[4] - 0.618 * (dasar[4] - dasar[3]))
    const antara = cariPola(bangun([...dasar, dasar[5] + 1.45 * (dasar[4] - dasar[5]), 120]), [0.04]).filter(x => x.pola === 'tigadorongan' && x.status !== 'menuju')
    expect(antara).toEqual([])
    const pas = cariPola(bangun([...dasar, dasar[5] + 1.618 * (dasar[4] - dasar[5])]), [0.04]).find(x => x.pola === 'tigadorongan')
    expect(pas.level).toBe(1.618)
    const kakiB = dasar[4] - dasar[5]
    expect(pas.prz[1] - pas.prz[0]).toBeCloseTo(2 * 0.03 * kakiB, 6)
  })
  it('pola empat titik tetap punya konfirmasi dan panah skenario', () => {
    const C = 150 + 0.618 * 50
    const bars = bangun([170, 200, 150, C, C - 50, C - 40])
    const r = cariPola(bars, [0.04]).find(x => x.pola === 'abcd' && x.status !== 'menuju')
    expect(konfirmasiD2(bars, r).total).toBe(4)
    expect(skenarioD2(r).map(x => x.k)).toContain('gagal')
    // Rencana posisi dari pola empat titik (sebelumnya membaca titik ke-5 yang tidak ada).
    const p = rencanaPosisi(bars, 'long', [r])
    expect(p.pola).toBe(r)
    expect(p.aktif).toMatch(/PRZ|berbalik/)
  })
  it('diagram ideal AB=CD dan Three Drives', () => {
    const a = diagramIdeal2('abcd', 'bullish'), t = diagramIdeal2('tigadorongan', 'bullish')
    expect(a.titik).toHaveLength(4)
    expect(a.titik[3].y).toBe(1)                          // D terendah
    expect(t.titik.map(x => x.n).join('')).toBe('01A2B3')
    expect(t.titik[5].y).toBe(1)
  })
})
