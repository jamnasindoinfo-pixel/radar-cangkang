// Halaman Harmonic Pattern (gaya TradingView): gambar otomatis dari swing harga terakhir. Fungsi murni.
// Masukan bars [{d,o,h,l,c,v}] urut waktu; keluaran berisi indeks bar (i) dan harga (p) untuk digambar di chart.
//
// Rasio pola mengikuti Scott M. Carney, "Harmonic Trading Vol. 1" (Gartley, Bat, Butterfly, Crab, Deep Crab, AB=CD),
// artikel Astronacci "Belajar Harmonic Pattern" dan "Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry"
// (Cypher, PRZ, stop, target 0,382/0,618 AD), serta tabel ilustrasi pola (Alternate Bat, Shark) yang dilampirkan
// pengguna. Notasi: b = AB/XA, c = BC/AB, d = AD/XA, e = CD/BC (proyeksi BC), cx = XC/XA, dc = CD/XC.
import { ceilTick, ema, floorTick, tick } from './ta.js'

export const POLA = {
  gartley: { nama: 'Gartley', b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786], e: [1.13, 1.618], abcd: [1, 1.27],
    ket: 'Pola retracement klasik: B tepat 0,618 XA, D di 0,786 XA. D tidak boleh melewati X.' },
  bat: { nama: 'Bat', b: [0.382, 0.5], c: [0.382, 0.886], d: [0.886, 0.886], e: [1.618, 2.618], abcd: [1, 1.27],
    ket: 'Retracement dalam: B di bawah 0,618 XA (ideal 0,382–0,5), D di 0,886 XA. D tidak boleh melewati X.' },
  altbat: { nama: 'Alternate Bat', b: [0.382, 0.382], c: [0.382, 0.886], d: [1.13, 1.13], e: [2.0, 3.618], abcd: [1, 1.618],
    ket: 'Varian Bat: B dangkal 0,382 XA, D melewati X sampai 1,13 XA.' },
  butterfly: { nama: 'Butterfly', b: [0.786, 0.786], c: [0.382, 0.886], d: [1.27, 1.414], e: [1.618, 2.24], abcd: [1, 1.27],
    ket: 'Pola ekstensi: B tepat 0,786 XA, D melewati X di 1,27 XA. Muncul di area ekstrem.' },
  crab: { nama: 'Crab', b: [0.382, 0.618], c: [0.382, 0.886], d: [1.618, 1.618], e: [2.618, 3.618], abcd: [1.27, 1.618],
    ket: 'Proyeksi paling ekstrem: D di 1,618 XA. Pembalikan sering tajam, disiplin stop penting.' },
  deepcrab: { nama: 'Deep Crab', b: [0.886, 0.886], c: [0.382, 0.886], d: [1.618, 1.618], e: [2.24, 3.618], abcd: [1.27, 1.618],
    ket: 'Seperti Crab dengan B dalam di 0,886 XA; D tetap 1,618 XA.' },
  cypher: { nama: 'Cypher', b: [0.382, 0.618], cx: [1.272, 1.414], dc: [0.786, 0.786],
    ket: 'C melewati A (1,272–1,414 XA); D di 0,786 kaki XC. Muncul di pasar dengan swing kompleks.' },
  shark: { nama: 'Shark', b: [0.382, 0.886], c: [1.13, 1.618], dc: [0.886, 1.13], e: [1.618, 2.24],
    ket: 'C melewati A (1,13–1,618 AB); D kembali ke sekitar level X (0,886–1,13 XC).' },
  // 5-0 (lembar pola): B melewati X (1,13–1,618 XA), C melewati A (1,618–2,24 AB), D = retracement 0,50 kaki BC.
  fiveo: { nama: '5-0', b: [1.13, 1.618], c: [1.618, 2.24], dbc: [0.5, 0.5],
    ket: 'Pola koreksi setelah gerak berlebihan: B melewati X, C melewati A, lalu D di retracement 0,50 kaki BC.' },
}
// Pola yang D-nya melewati atau menyentuh X: stop memakai sisi luar PRZ, bukan X.
export const STOP_PRZ = new Set(['altbat', 'butterfly', 'crab', 'deepcrab', 'shark'])
export const TOL = 0.05          // toleransi relatif batas rasio (±5%)
export const ABCD_TOL = 0.15    // AB=CD di dalam pola: CD minimal 0,85 AB (sama dengan website/harmonik.py)
export const PRZ_LEBAR = 0.03    // PRZ minimal = ±3% kaki acuan di sekitar level D
export const MENUJU_MAKS = 0.25  // jarak harga terakhir ke tepi PRZ yang masih digambar sebagai pola "menuju"
// Ambang zigzag (pembalikan minimal) per timeframe, dari swing kecil ke besar. SKALA dipakai alat yang butuh beberapa
// skala tetap (Fibonacci, posisi, Elliott, swing terakhir).
export const SKALA = { D: [0.04, 0.06, 0.1, 0.15], W: [0.08, 0.12, 0.18, 0.25], M: [0.12, 0.18, 0.25, 0.35] }
// Pencarian pola memakai skala rapat. Satu pantulan bisa memecah kaki di satu ambang tetapi tidak di ambang sebelahnya,
// jadi skala yang jarang melewatkan pola: KOTA Nov 2026 (Shark 71-210-140-252-50, pantulan 81 → 104 naik 28% di kaki
// C→D) hanya terbaca di sekitar 30%, AKRA (Gartley 1165-1475-1275-1370-1240) di 7%. Audit 953 saham BEI: skala
// 4/6/10/15/20/30% melewatkan sekitar 670 pola dibanding pemindaian setiap 0,5%. Sama dengan SKALA di website/harmonik.py.
const rentang = (a, b, s) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, j) => Math.round((a + j * s) * 1000) / 1000)
export const SKALA_POLA = { D: rentang(0.04, 0.5, 0.005), W: rentang(0.08, 0.6, 0.01), M: rentang(0.12, 0.7, 0.01) }
export const TF = [{ k: 'D', nama: 'Harian', pendek: '1D' }, { k: 'W', nama: 'Mingguan', pendek: '1W' }, { k: 'M', nama: 'Bulanan', pendek: '1M' }]

export const FIB_RET = [0, 0.236, 0.382, 0.5, 0.618, 0.707, 0.786, 0.886, 1, 1.13, 1.27, 1.414, 1.618]
export const FIB_EXT = [0, 0.382, 0.618, 0.786, 1, 1.13, 1.27, 1.414, 1.618, 2, 2.24, 2.618]
export const FIB_KUNCI = [0.618, 0.786, 0.886, 1.27, 1.618]

// ------------------------------------------------------------------ timeframe ----
// Senin minggu itu (UTC) untuk tanggal YYYY-MM-DD.
function senin(d) {
  const t = new Date(d.slice(0, 10) + 'T00:00:00Z'), w = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - w)
  return t.toISOString().slice(0, 10)
}
// Gabung candle harian menjadi mingguan (W) atau bulanan (M); tanggal = hari bursa pertama periode.
export function kelompokBar(bars = [], tf = 'D') {
  if (tf === 'D') return bars.map(b => ({ ...b, d: String(b.d).slice(0, 10) }))
  const kunci = tf === 'W' ? b => senin(String(b.d)) : b => String(b.d).slice(0, 7)
  const out = []
  let k0 = null
  for (const b of bars) {
    const k = kunci(b)
    if (k !== k0) { out.push({ d: String(b.d).slice(0, 10), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 }); k0 = k; continue }
    const x = out[out.length - 1]
    x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v || 0
  }
  return out
}

// ------------------------------------------------------------------- zigzag ----
// Pivot bergantian H/L: berganti bila harga berbalik >= th dari ekstrem terakhir. Pivot terakhir = ekstrem
// berjalan (tentatif), belum terkonfirmasi pembalikan. Sama dengan website/harmonik.py.
// Pivot terakhir bergeser ke candle i (harga melewatinya lagi sesudah outside bar). Pivot sebelumnya dicek ulang sampai
// candle i-1, supaya tetap titik paling ekstrem di antara tetangganya (misalnya low outside bar yang lebih rendah).
function geser(bars, out, i, k) {
  const akhir = out.length - 1, prev = out[akhir - 1]
  if (prev) for (let j = out[akhir].i; j < i; j++)
    if (k === 'H' ? bars[j].l < out[akhir - 1].p : bars[j].h > out[akhir - 1].p) out[akhir - 1] = { i: j, p: k === 'H' ? bars[j].l : bars[j].h, k: prev.k }
  out[akhir] = { i, p: k === 'H' ? bars[i].h : bars[i].l, k }
}

export function zigzag(bars = [], th = 0.06) {
  const n = bars.length
  if (n < 3) return []
  const out = []
  let mode = 0, hi = 0, lo = 0, ext = 0
  for (let i = 1; i < n; i++) {
    const h = bars[i].h, l = bars[i].l
    if (mode === 0) {
      if (h > bars[hi].h) hi = i
      if (l < bars[lo].l) lo = i
      if (bars[lo].l > 0 && bars[hi].h >= bars[lo].l * (1 + th)) {
        if (lo < hi) { out.push({ i: lo, p: bars[lo].l, k: 'L' }); mode = 1; ext = hi }
        else { out.push({ i: hi, p: bars[hi].h, k: 'H' }); mode = -1; ext = lo }
      }
    } else if (mode === 1) {
      // Mode naik: ext = puncak sementara sejak lembah terakhir L0 (ext < 0: belum ada, dicari mulai candle ini).
      // Harga menembus L0 sebelum puncak terkonfirmasi: puncak sementara langsung terkonfirmasi, supaya setiap pivot
      // tetap titik paling ekstrem di antara tetangganya. Outside bar (puncak baru sekaligus menembus L0): puncak sementara
      // terkonfirmasi dan low candle ini menjadi lembah berikutnya; high candle itu sendiri tidak dipakai, karena dua pivot
      // tidak boleh di candle yang sama.
      const L0 = out[out.length - 1].p
      if (ext < 0) { if (l < L0) geser(bars, out, i, 'L'); else ext = i; continue }
      const naik = h >= bars[ext].h, tembus = l < L0
      if (naik && tembus) {
        out.push({ i: ext, p: bars[ext].h, k: 'H' }, { i, p: l, k: 'L' }); ext = -1
      } else if (naik) ext = i
      else if (tembus || l <= bars[ext].h * (1 - th)) { out.push({ i: ext, p: bars[ext].h, k: 'H' }); mode = -1; ext = i }
    } else {
      const H0 = out[out.length - 1].p
      if (ext < 0) { if (h > H0) geser(bars, out, i, 'H'); else ext = i; continue }
      const turun = l <= bars[ext].l, tembus = h > H0
      if (turun && tembus) {
        out.push({ i: ext, p: bars[ext].l, k: 'L' }, { i, p: h, k: 'H' }); ext = -1
      } else if (turun) ext = i
      else if (tembus || h >= bars[ext].l * (1 + th)) { out.push({ i: ext, p: bars[ext].l, k: 'L' }); mode = 1; ext = i }
    }
  }
  // ext < 0: pivot terakhir ada di candle terakhir dan menjadi ekstrem berjalan (ditandai tentatif).
  if (mode && ext >= 0) out.push({ i: ext, p: mode === 1 ? bars[ext].h : bars[ext].l, k: mode === 1 ? 'H' : 'L', tentatif: true })
  else if (mode) out[out.length - 1].tentatif = true
  return out
}

// ------------------------------------------------------------------- XABCD ----
const r3 = v => v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000
// Jarak relatif nilai ke rentang (0 bila di dalam).
export const jarak = (v, [lo, hi]) => v < lo ? (lo - v) / lo : v > hi ? (v - hi) / hi : 0

export function rasioXabcd(X, A, B, C, D = null) {
  const xa = Math.abs(A - X), ab = Math.abs(B - A), bc = Math.abs(C - B), xc = Math.abs(C - X)
  return {
    b: r3(ab / xa), c: r3(bc / ab), cx: r3(xc / xa),
    d: D == null ? null : r3(Math.abs(A - D) / xa),
    e: D == null ? null : r3(Math.abs(D - C) / bc),
    dc: D == null ? null : r3(Math.abs(D - C) / xc),
    dbc: D == null ? null : r3(Math.abs(D - C) / bc),
    cd: D == null ? null : r3(Math.abs(D - C) / ab),   // AB=CD di dalam pola (CD/AB)
  }
}

// Rentang harga D (PRZ) dari X, A, B, C untuk satu pola; null bila rasio XA/XC dan proyeksi BC tidak bertemu.
export function przPola(k, X, A, B, C, tol = TOL) {
  const p = POLA[k], xa = Math.abs(A - X), s = Math.sign(A - X)
  let rg, acuan
  if (p.d) { rg = [A - s * xa * p.d[0], A - s * xa * p.d[1]]; acuan = xa }
  else if (p.dbc) { rg = [C + (B - C) * p.dbc[0], C + (B - C) * p.dbc[1]]; acuan = Math.abs(B - C) }
  else { rg = [C - (C - X) * p.dc[0], C - (C - X) * p.dc[1]]; acuan = Math.abs(C - X) }
  rg = [Math.min(...rg), Math.max(...rg)]
  if (rg[1] - rg[0] < 2 * PRZ_LEBAR * acuan) {
    const m = (rg[0] + rg[1]) / 2
    rg = [m - PRZ_LEBAR * acuan, m + PRZ_LEBAR * acuan]
  }
  if (p.e) {
    const pr = [C + (B - C) * p.e[0] * (1 - tol), C + (B - C) * p.e[1] * (1 + tol)].sort((a, b) => a - b)
    const lo = Math.max(rg[0], pr[0]), hi = Math.min(rg[1], pr[1])
    if (lo > hi) return null
    // Pertemuan sempit tetap diberi lebar minimal di sekitar titik temu.
    if (hi - lo < PRZ_LEBAR * acuan) {
      const m = (lo + hi) / 2
      return [Math.max(rg[0], m - PRZ_LEBAR * acuan / 2), Math.min(rg[1], m + PRZ_LEBAR * acuan / 2)]
    }
    return [lo, hi]
  }
  return rg
}

// ------------------------------------------------------- jarak candle kaki ----
// Carney (hal. 129): durasi tiap kaki tidak harus sama persis, tetapi setiap bagian pola harus jelas simetris.
// Swing yang terlalu dekat (kaki < KAKI_MIN candle) atau kaki terpendek jauh lebih singkat dari kaki terpanjang
// membuat pola tampak berimpitan. Pola tetap tampil, tetapi diberi peringatan dan turun peringkat.
// Sama dengan jarak_kaki di website/harmonik.py.
export const KAKI_MIN = 3, KAKI_TIMPANG = 0.2, KAKI_KURANG = 0.33
// Jumlah candle per kaki dari titik pola (indeks bar i); titik akhir yang masih proyeksi tidak dihitung.
export function kakiCandle(titik = []) {
  const t = titik.filter(z => z && Number.isFinite(z.i) && !z.proyeksi)
  return t.slice(1).map((z, j) => z.i - t[j].i)
}
// Penilaian keseimbangan kaki: { kaki, nama, rasio, tingkat: 'seimbang' | 'kurang' | 'timpang', teks } atau null.
// row.kaki (dari screening server) dipakai bila ada; selain itu dihitung dari row.titik.
export function jarakKaki(row) {
  const t = (row?.titik || []).filter(z => z && !z.proyeksi)
  const kaki = Array.isArray(row?.kaki) ? row.kaki : kakiCandle(t)
  if (kaki.length < 2 || kaki.some(n => !(n > 0))) return null
  const nama = kaki.map((_, j) => `${t[j]?.n ?? j}→${t[j + 1]?.n ?? j + 1}`)
  const pendek = Math.min(...kaki), panjang = Math.max(...kaki), rasio = Math.round(pendek / panjang * 100) / 100
  const jk = kaki.indexOf(pendek), jp = kaki.indexOf(panjang)
  const daftar = kaki.map((n, j) => `${nama[j]} ${n}`).join(', ')
  let tingkat = 'seimbang', teks = `Jarak candle seimbang: ${daftar} candle.`
  if (pendek < KAKI_MIN) {
    tingkat = 'timpang'
    teks = `Swing terlalu dekat: kaki ${nama[jk]} hanya ${pendek} candle (${daftar}). Swing yang jelas biasanya dipisah beberapa candle.`
  } else if (rasio < KAKI_TIMPANG) {
    tingkat = 'timpang'
    teks = `Jarak candle tidak seimbang: kaki ${nama[jk]} ${pendek} candle, kaki ${nama[jp]} ${panjang} candle (${Math.round(rasio * 100)}%). Urutan kaki: ${daftar}.`
  } else if (rasio < KAKI_KURANG) {
    tingkat = 'kurang'
    teks = `Jarak candle kurang seimbang: kaki ${nama[jk]} ${pendek} candle, kaki ${nama[jp]} ${panjang} candle (${Math.round(rasio * 100)}%).`
  }
  return { kaki, nama, rasio, tingkat, teks }
}
// Cara mengenali swing (materi latihan pengguna, bukan dari buku Carney; Carney hanya meminta kaki simetris dan
// rasio Fibonacci yang tepat): swing high = puncak (sumbu atas) tidak lebih rendah dari 2 candle di kiri
// dan 2 candle di kanannya; swing low = dasar (sumbu bawah) tidak lebih tinggi dari 2 candle di kiri dan kanannya.
// Ayunan di bawah 5% sebaiknya diabaikan. Titik yang belum punya 2 candle di kanannya (masih terbentuk) atau masih
// proyeksi tidak dinilai sisi kanannya. Keluaran: daftar teks peringatan (kosong = semua titik swing yang jelas).
export const SWING_SISI = 2, AYUN_MIN = 0.05
export function swingLemah(bars = [], titik = []) {
  const t = titik.filter(z => z && Number.isFinite(z.i) && !z.proyeksi && bars[z.i])
  const out = []
  t.forEach((z, j) => {
    const tetangga = t[j - 1] || t[j + 1]
    if (!tetangga) return
    const atas = z.p > tetangga.p
    const kiri = bars.slice(Math.max(0, z.i - SWING_SISI), z.i), kanan = bars.slice(z.i + 1, z.i + 1 + SWING_SISI)
    const sisi = [kiri, kanan.length >= SWING_SISI ? kanan : []].flat()
    const lewat = atas ? sisi.some(b => b.h > bars[z.i].h) : sisi.some(b => b.l < bars[z.i].l)
    if (lewat) out.push(`Titik ${z.n} bukan swing ${atas ? 'high' : 'low'} yang jelas: ada candle dalam 2 candle di kiri/kanannya yang ${atas ? 'puncaknya lebih tinggi' : 'dasarnya lebih rendah'}.`)
  })
  t.slice(1).forEach((z, j) => {
    const ayun = Math.abs(z.p / t[j].p - 1)
    if (ayun < AYUN_MIN) out.push(`Ayunan ${t[j].n}→${z.n} hanya ${(Math.round(ayun * 1000) / 10).toLocaleString('id-ID')}%, di bawah 5% (ayunan kecil sebaiknya diabaikan).`)
  })
  return out
}
const timpang = row => (jarakKaki(row)?.tingkat === 'timpang' || row?.swingLemah?.length ? 1 : 0)

// Unsur pembentuk PRZ untuk ditampilkan: level rasio utama D (garis tunggal atau rentang) dan proyeksi kaki yang
// ikut mempersempit zona. Tiap unsur { k, teks, lo, hi } (lo = hi untuk satu level harga). Kosong bila tidak dikenal.
const unsur = (k, teks, a, b) => ({ k, teks, lo: Math.min(a, b), hi: Math.max(a, b) })
export function komponenPrz(row) {
  const t = row?.titik || [], out = []
  if (!row?.prz || !t.length) return out
  const p = POLA[row.pola]
  if (p && t.length === 5) {
    const [X, A, B, C] = t.map(z => z.p), xa = Math.abs(A - X), s = Math.sign(A - X)
    if (p.d) out.push(unsur('d', `${teksRg(p.d)} XA`, A - s * xa * p.d[0], A - s * xa * p.d[1]))
    else if (p.dbc) out.push(unsur('dbc', `${teksRg(p.dbc)} BC`, C + (B - C) * p.dbc[0], C + (B - C) * p.dbc[1]))
    else if (p.dc) out.push(unsur('dc', `${teksRg(p.dc)} XC`, C - (C - X) * p.dc[0], C - (C - X) * p.dc[1]))
    if (p.e) out.push(unsur('e', `proyeksi BC ${teksRg(p.e)}`, C + (B - C) * p.e[0], C + (B - C) * p.e[1]))
    return out
  }
  const q = POLA_LAIN[row.pola]
  if (q?.bentuk === 'abcd' && t.length === 4) {
    const [A, B, C] = t.map(z => z.p), ab = B - A
    out.push(unsur('cd', `CD = ${teksRg(q.cd)} AB`, C + ab * q.cd[0], C + ab * q.cd[1]))
    out.push(unsur('e', `proyeksi BC ${teksRg(ABCD_E)}`, C + (B - C) * ABCD_E[0], C + (B - C) * ABCD_E[1]))
  } else if (q?.bentuk === 'tigadorongan' && t.length === 6 && row.level) {
    const P3 = t[3].p, P4 = t[4].p, v = P4 + (P3 - P4) * row.level
    out.push(unsur('lv', `${teksRg([row.level, row.level])} × koreksi B`, v, v))
  }
  return out
}

// Skor ketidakcocokan X-A-B-C (dan D bila ada) terhadap satu pola; null bila ada rasio di luar toleransi.
export function skorPola(k, r, tol = TOL) {
  const p = POLA[k], cek = []
  cek.push([r.b, p.b])
  if (p.cx) cek.push([r.cx, p.cx])
  else cek.push([r.c, p.c])
  if (r.d != null) {
    if (p.d) cek.push([r.d, p.d])
    if (p.dc) cek.push([r.dc, p.dc])
    if (p.dbc) cek.push([r.dbc, p.dbc])
    if (p.e) cek.push([r.e, p.e])
  }
  let s = 0
  for (const [v, rg] of cek) {
    if (v == null) return null
    const j = jarak(v, rg)
    // Proyeksi BC lebih longgar (2x) karena D diukur dari ujung swing yang berbeda-beda.
    if (j > (rg === p.e ? tol * 2 : tol)) return null
    s += j
  }
  return Math.round(s * 1000) / 1000
}

// Bentuk dasar: C di antara A dan B (pola retracement C), kecuali Cypher/Shark yang C-nya melewati A.
export function bentukOk(k, X, A, B, C) {
  const s = Math.sign(A - X)
  if (!s || Math.sign(B - A) !== -s || Math.sign(C - B) !== s) return false
  const lewatA = s > 0 ? C > A : C < A
  if (k === 'fiveo') return lewatA && (s > 0 ? B < X : B > X)   // 5-0: B melewati X dan C melewati A
  return k === 'cypher' || k === 'shark' ? lewatA : !lewatA
}

const bulatArah = (t, bull) => bull ? floorTick(t) : ceilTick(t)
export function targetStop(k, X, A, B, C, D, prz, bull) {
  // 5-0: harga diharapkan kembali ke C; target 0,618 kaki DC lalu titik C, stop di retracement 0,618 kaki BC.
  if (k === 'fiveo') return { target: [D + (C - D) * 0.618, C].map(t => bulatArah(t, bull)), stop: C + (B - C) * 0.618 }
  const acuan = k === 'cypher' ? C : A
  // Target dibulatkan ke fraksi harga BEI ke arah konservatif (bullish ke bawah, bearish ke atas).
  const target = [0.382, 0.618].map(r => D + (acuan - D) * r).map(t => bulatArah(t, bull))
  const stopMentah = STOP_PRZ.has(k) ? (bull ? prz[0] : prz[1]) : X
  return { target, stop: stopMentah }
}
const KAKI = { cypher: 'CD', fiveo: 'DC' }

// Garis rasio (indeks titik) yang digambar di chart, mengikuti kriteria pola: B, C, D, dan proyeksi BC.
export function garisXabcd(k, r) {
  const p = POLA[k] || { c: 1, d: 1, e: 1 }
  return [{ a: 0, b: 2, v: r.b, k: 'AB/XA' },
    p.cx ? { a: 0, b: 3, v: r.cx, k: 'XC/XA' } : { a: 1, b: 3, v: r.c, k: 'BC/AB' },
    p.dc ? { a: 3, b: 4, v: r.dc, k: 'CD/XC' } : p.dbc ? { a: 2, b: 4, v: r.dbc, k: 'DC/BC' } : { a: 0, b: 4, v: r.d, k: 'AD/XA' },
    ...(p.e ? [{ a: 2, b: 4, v: r.e, k: 'CD/BC' }] : [])].filter(g => g.v != null)
}

// Semua pola XABCD aktif di ujung data (paling relevan dulu):
//  - "di PRZ": D sedang terbentuk (ekstrem berjalan) dan berada di PRZ;
//  - "berbalik": D terkonfirmasi di PRZ, harga sudah berbalik;
//  - "menuju": X-A-B-C terbentuk, harga bergerak ke PRZ (D diproyeksikan).
// menujuMaks: jarak maksimal harga ke tepi PRZ untuk pola "menuju" (default MENUJU_MAKS; cek silang memakai batas lebih longgar).
export function cariXabcd(bars = [], skala = SKALA_POLA.D, umurD = 30, menujuMaks = MENUJU_MAKS) {
  const n = bars.length
  if (n < 30) return []
  const akhir = bars[n - 1].c, hasil = new Map()
  for (const th of skala) {
    const pv = zigzag(bars, th)
    const jendela = []
    if (pv.length >= 5) jendela.push({ w: pv.slice(-5), mode: 'jalan' })
    // D terkonfirmasi: satu sampai dua swing sebelum ekstrem berjalan, selama D masih dalam umurD bar terakhir.
    for (let m = 1; m <= 2 && pv.length >= 5 + m; m++) {
      const w = pv.slice(-5 - m, -m)
      if (w[4].i >= n - umurD && !basi(pv, w[4], m)) jendela.push({ w, mode: 'tetap' })
    }
    for (const { w, mode } of jendela) {
      const [X, A, B, C, D] = w, bull = A.p > X.p
      for (const k of Object.keys(POLA)) {
        if (!bentukOk(k, X.p, A.p, B.p, C.p)) continue
        const prz = przPola(k, X.p, A.p, B.p, C.p)
        if (!prz) continue
        const r = rasioXabcd(X.p, A.p, B.p, C.p, D.p)
        const diPrz = D.p >= prz[0] && D.p <= prz[1]
        const lewat = bull ? D.p < prz[0] : D.p > prz[1]
        let status, skor, titikD
        if (diPrz && (skor = skorPola(k, r)) != null) {
          status = mode === 'jalan' ? 'prz' : 'berbalik'
          titikD = { n: 'D', i: D.i, p: D.p }
        } else if (mode === 'jalan' && !lewat && !diPrz) {
          // Kaki C→D belum sampai PRZ: cocokkan X-A-B-C saja, D = pusat PRZ (proyeksi).
          skor = skorPola(k, { ...r, d: null, e: null, dc: null })
          if (skor == null) continue
          const tepi = bull ? prz[1] : prz[0]
          if ((bull ? akhir < tepi : akhir > tepi) || Math.abs(akhir / tepi - 1) > menujuMaks) continue
          status = 'menuju'
          titikD = { n: 'D', i: Math.max(n - 1, C.i) + Math.max(3, Math.round((C.i - B.i) * 0.8)), p: (prz[0] + prz[1]) / 2, proyeksi: true,
            jalan: { i: D.i, p: D.p } }   // D yang sedang berjalan (belum sampai PRZ), untuk dicek ulang di Tutorial
        } else continue
        if ((k === 'gartley' || k === 'bat') && (bull ? titikD.p < X.p : titikD.p > X.p)) continue
        const { target, stop } = targetStop(k, X.p, A.p, B.p, C.p, titikD.p, prz, bull)
        // Pola batal: setelah D ada penutupan yang menembus stop (X / sisi luar PRZ); bukan pola aktif lagi.
        if (!titikD.proyeksi && bars.slice(D.i + 1).some(b => bull ? b.c < stop : b.c > stop)) continue
        // Kunci tanpa X/A: skala zigzag berbeda bisa memilih bar berbeda untuk harga ekstrem yang sama (harga kembar),
        // padahal B, C, D-nya sama; pola itu cukup tampil sekali.
        const kunci = `${k}|${bull ? 'b' : 's'}|${B.i}|${C.i}|${titikD.proyeksi ? 'p' : D.i}`
        // AB=CD (Carney: syarat minimum) tidak membuang pola, tapi menurunkan peringkat bila belum terpenuhi.
        const abcd = POLA[k].abcd && !titikD.proyeksi ? { rasio: r.cd, kriteria: POLA[k].abcd, ok: jarak(r.cd, POLA[k].abcd) <= ABCD_TOL } : null
        if (abcd) skor = Math.round((skor + jarak(r.cd, POLA[k].abcd)) * 1000) / 1000
        const row = {
          kunci, pola: k, nama: POLA[k].nama, ket: POLA[k].ket, arah: bull ? 'bullish' : 'bearish', status, skala: th, skor, abcd,
          titik: [{ n: 'X', i: X.i, p: X.p }, { n: 'A', i: A.i, p: A.p }, { n: 'B', i: B.i, p: B.p }, { n: 'C', i: C.i, p: C.p }, titikD],
          rasio: status === 'menuju' ? rasioXabcd(X.p, A.p, B.p, C.p) : r, prz, target, stop, harga: akhir,
          kaki: KAKI[k] || 'AD',   // kaki acuan target
          ketTarget: k === 'fiveo' ? ['0,618 DC', 'titik C'] : [`0,382 ${KAKI[k] || 'AD'}`, `0,618 ${KAKI[k] || 'AD'}`],
          bentuk: 'xabcd', segi: [[0, 1, 2], [2, 3, 4]],
        }
        row.garis = garisXabcd(k, row.rasio)
        const lama = hasil.get(kunci)
        if (!lama || row.skor < lama.skor) hasil.set(kunci, row)
      }
    }
  }
  const urut = { prz: 0, berbalik: 1, menuju: 2 }
  return [...hasil.values()].map(r => ({ ...r, swingLemah: swingLemah(bars, r.titik) }))
    .sort((a, b) => urut[a.status] - urut[b.status] || a.skor - b.skor || b.titik[0].i - a.titik[0].i)
}

// ------------------------------------------------- AB=CD dan Three Drives ----
// Pola di luar kerangka X-A-B-C-D. AB=CD (Carney Bab 4): C retracement 0,382–0,886 AB, proyeksi BC 1,13–2,618, dan
// CD setara AB (AB=CD) atau 1,27–1,618 AB (Alternate AB=CD); hanya tampil setelah D sampai di PRZ (pola empat titik
// yang belum selesai terlalu banyak dan kurang bernilai). Three Drives (lembar pola): dorongan kedua 1,27–1,618 kali
// koreksi A; dorongan ketiga selesai di level 1,27 atau 1,618 kali koreksi B (PRZ sempit di sekitar level itu).
export const POLA_LAIN = {
  abcd: { nama: 'AB=CD', bentuk: 'abcd', cd: [1, 1],
    ket: 'Pola empat titik paling dasar: kaki CD sama panjang dengan AB setelah koreksi C 0,382–0,886.' },
  altabcd: { nama: 'Alternate AB=CD', bentuk: 'abcd', cd: [1.27, 1.618],
    ket: 'Varian AB=CD: kaki CD memanjang 1,27–1,618 kali AB, umum di saham yang bergerak kuat.' },
  tigadorongan: { nama: 'Three Drives', bentuk: 'tigadorongan', dorong: [1.27, 1.618], level: [1.27, 1.618],
    ket: 'Tiga dorongan searah yang makin melemah; dorongan kedua 1,27–1,618 kali koreksi, dorongan ketiga selesai di 1,27 atau 1,618 kali koreksi, lalu tren berbalik.' },
}
const ABCD_C = [0.382, 0.886], ABCD_E = [1.13, 2.618]
export const namaPola = k => POLA[k]?.nama || POLA_LAIN[k]?.nama || ''

// Jendela pivot N titik: titik akhir = ekstrem berjalan, atau terkonfirmasi satu sampai dua swing lalu (umurD bar).
function jendela(pv, N, n, umurD) {
  const out = []
  if (pv.length >= N) out.push({ w: pv.slice(-N), mode: 'jalan' })
  for (let m = 1; m <= 2 && pv.length >= N + m; m++) {
    const w = pv.slice(-N - m, -m)
    if (w[N - 1].i >= n - umurD && !basi(pv, w[N - 1], m)) out.push({ w, mode: 'tetap' })
  }
  return out
}
// Titik akhir terkonfirmasi sudah basi bila pivot searah sesudahnya lebih ekstrem (harga sudah melewati D):
// D yang berlaku adalah ekstrem baru itu, dinilai di jendela lain.
export function basi(pv, akhir, m) {
  return pv.slice(-m).some(q => q.k === akhir.k && (q.k === 'L' ? q.p < akhir.p : q.p > akhir.p))
}
const irisan = (a, b) => { const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); return lo > hi ? null : [lo, hi] }
const urutkan = (a, b) => [Math.min(a, b), Math.max(a, b)]

// Status titik akhir pola (sama dengan XABCD): di PRZ, berbalik, atau menuju (titik akhir diproyeksikan).
function statusAkhir({ bars, mode, akhirPt, prz, bull, lengkapOk, iProyeksi, label }) {
  const n = bars.length, akhir = bars[n - 1].c
  const diPrz = akhirPt.p >= prz[0] && akhirPt.p <= prz[1]
  const lewat = bull ? akhirPt.p < prz[0] : akhirPt.p > prz[1]
  if (diPrz && lengkapOk) return { status: mode === 'jalan' ? 'prz' : 'berbalik', titik: { n: label, i: akhirPt.i, p: akhirPt.p } }
  if (mode !== 'jalan' || lewat || diPrz) return null
  const tepi = bull ? prz[1] : prz[0]
  if ((bull ? akhir < tepi : akhir > tepi) || Math.abs(akhir / tepi - 1) > MENUJU_MAKS) return null
  return { status: 'menuju', titik: { n: label, i: iProyeksi, p: (prz[0] + prz[1]) / 2, proyeksi: true } }
}
const batal = (bars, t, stop, bull) => !t.proyeksi && bars.slice(t.i + 1).some(b => bull ? b.c < stop : b.c > stop)
const cekRasio = (teks, v, rg, longgar = 1) => v == null ? null : { teks, aktual: v, ideal: teksRg(rg), ok: jarak(v, rg) <= TOL * longgar }

export function cariAbcd(bars = [], skala = SKALA_POLA.D, umurD = 30) {
  const n = bars.length
  if (n < 30) return []
  const hasil = new Map()
  for (const th of skala) {
    for (const { w, mode } of jendela(zigzag(bars, th), 4, n, umurD)) {
      const [A, B, C, D] = w, bull = A.p > B.p   // A puncak, D lembah: bullish
      const ab = B.p - A.p
      if (!ab || C.p === B.p) continue   // kaki nol (harga datar): rasio tidak terdefinisi, sama dengan harmonik.py
      const c = r3(Math.abs(C.p - B.p) / Math.abs(ab))
      if (jarak(c, ABCD_C) > TOL) continue
      const proyBC = urutkan(C.p + (B.p - C.p) * ABCD_E[0] * (1 - 2 * TOL), C.p + (B.p - C.p) * ABCD_E[1] * (1 + 2 * TOL))
      for (const k of ['abcd', 'altabcd']) {
        const p = POLA_LAIN[k]
        const prz = irisan(urutkan(C.p + ab * p.cd[0] * (1 - TOL), C.p + ab * p.cd[1] * (1 + TOL)), proyBC)
        if (!prz) continue
        const r = { c, cd: r3(Math.abs(D.p - C.p) / Math.abs(ab)), e: r3(Math.abs(D.p - C.p) / Math.abs(C.p - B.p)) }
        const lengkapOk = jarak(r.cd, p.cd) <= TOL && jarak(r.e, ABCD_E) <= TOL * 2
        const st = statusAkhir({ bars, mode, akhirPt: D, prz, bull, lengkapOk, label: 'D',
          iProyeksi: Math.max(n - 1, C.i) + Math.max(3, Math.round((C.i - B.i) * 0.8)) })
        if (!st || st.status === 'menuju') continue   // AB=CD hanya bila D sudah di PRZ atau berbalik
        const Dt = st.titik, stop = bull ? prz[0] : prz[1]
        if (batal(bars, Dt, stop, bull)) continue
        const rasio = st.status === 'menuju' ? { c } : r
        const kunci = `${k}|${bull ? 'b' : 's'}|${B.i}|${C.i}|${Dt.proyeksi ? 'p' : D.i}`
        const row = {
          kunci, pola: k, bentuk: 'abcd', nama: p.nama, ket: p.ket, arah: bull ? 'bullish' : 'bearish', status: st.status, skala: th,
          skor: Math.round((jarak(c, ABCD_C) + (st.status === 'menuju' ? 0 : jarak(r.cd, p.cd) + jarak(r.e, ABCD_E))) * 1000) / 1000,
          titik: [{ n: 'A', i: A.i, p: A.p }, { n: 'B', i: B.i, p: B.p }, { n: 'C', i: C.i, p: C.p }, Dt],
          rasio, prz, stop, harga: bars[n - 1].c, kaki: 'AD', ketTarget: ['0,382 AD', '0,618 AD'],
          target: [0.382, 0.618].map(x => bulatArah(Dt.p + (A.p - Dt.p) * x, bull)),
          segi: [[0, 1, 2], [1, 2, 3]],
          garis: [{ a: 0, b: 2, v: rasio.c, k: 'BC/AB' }, { a: 1, b: 3, v: rasio.e, k: 'CD/BC' }, { a: 0, b: 3, v: rasio.cd, k: 'CD/AB' }].filter(g => g.v != null),
          alasan: [cekRasio('Titik C: retracement BC/AB', c, ABCD_C), cekRasio('Panjang CD/AB', rasio.cd, p.cd),
            cekRasio('Proyeksi CD/BC', rasio.e, ABCD_E, 2)].filter(Boolean),
        }
        const lama = hasil.get(kunci)
        if (!lama || row.skor < lama.skor) hasil.set(kunci, row)
      }
    }
  }
  return [...hasil.values()].map(r => ({ ...r, swingLemah: swingLemah(bars, r.titik) }))
}

export function cariTigaDorongan(bars = [], skala = SKALA_POLA.D, umurD = 30) {
  const n = bars.length
  if (n < 30) return []
  const p = POLA_LAIN.tigadorongan, hasil = new Map()
  for (const th of skala) {
    for (const { w, mode } of jendela(zigzag(bars, th), 6, n, umurD)) {
      const [P0, P1, P2, P3, P4, P5] = w, s = Math.sign(P1.p - P0.p), bull = s < 0   // dorongan naik: bearish
      // Dorongan makin tinggi (atau makin rendah) dan koreksi tidak menembus titik awal dorongan sebelumnya.
      if (!(s * (P3.p - P1.p) > 0 && s * (P2.p - P0.p) > 0 && s * (P4.p - P2.p) > 0)) continue
      if (P1.p === P2.p || P3.p === P4.p) continue   // kaki koreksi nol (harga datar)
      const r1 = r3(Math.abs(P3.p - P2.p) / Math.abs(P1.p - P2.p))
      if (jarak(r1, p.dorong) > TOL) continue
      // PRZ sempit (±PRZ_LEBAR kaki koreksi B) di level 1,27 lalu 1,618; dipakai level pertama yang cocok/belum terlewati.
      const r2 = r3(Math.abs(P5.p - P4.p) / Math.abs(P3.p - P4.p)), kakiB = Math.abs(P3.p - P4.p)
      let st = null, prz = null, lv = null
      for (const L of p.level) {
        const pusat = P4.p + (P3.p - P4.p) * L, rg = [pusat - PRZ_LEBAR * kakiB, pusat + PRZ_LEBAR * kakiB]
        const s2 = statusAkhir({ bars, mode, akhirPt: P5, prz: rg, bull, lengkapOk: true, label: '3',
          iProyeksi: Math.max(n - 1, P4.i) + Math.max(3, P3.i - P2.i) })
        if (s2) { st = s2; prz = rg; lv = L; break }
      }
      if (!st) continue
      const T = st.titik, stop = bull ? prz[0] : prz[1]
      if (batal(bars, T, stop, bull)) continue
      const rasio = st.status === 'menuju' ? { r1 } : { r1, r2 }
      const kunci = `tigadorongan|${bull ? 'b' : 's'}|${P2.i}|${P4.i}|${T.proyeksi ? 'p' : P5.i}`
      const row = {
        kunci, pola: 'tigadorongan', bentuk: 'tigadorongan', nama: p.nama, ket: p.ket, arah: bull ? 'bullish' : 'bearish', status: st.status,
        skala: th, skor: Math.round((jarak(r1, p.dorong) + (rasio.r2 != null ? Math.abs(r2 / lv - 1) : 0)) * 1000) / 1000, level: lv,
        titik: [{ n: '0', i: P0.i, p: P0.p }, { n: '1', i: P1.i, p: P1.p }, { n: 'A', i: P2.i, p: P2.p }, { n: '2', i: P3.i, p: P3.p },
          { n: 'B', i: P4.i, p: P4.p }, T],
        rasio, prz, stop, harga: bars[n - 1].c, kaki: '0–3', ketTarget: ['0,382 pola', '0,618 pola'],
        target: [0.382, 0.618].map(x => bulatArah(T.p + (P0.p - T.p) * x, bull)),
        segi: [],
        garis: [{ a: 1, b: 3, v: rasio.r1, k: 'Dorongan 2' }, { a: 3, b: 5, v: rasio.r2, k: 'Dorongan 3' }].filter(g => g.v != null),
        alasan: [cekRasio('Dorongan 2: (2 − A) / (1 − A)', r1, p.dorong), cekRasio('Dorongan 3: (3 − B) / (2 − B)', rasio.r2, [lv, lv])].filter(Boolean),
      }
      const lama = hasil.get(kunci)
      if (!lama || row.skor < lama.skor) hasil.set(kunci, row)
    }
  }
  return [...hasil.values()].map(r => ({ ...r, swingLemah: swingLemah(bars, r.titik) }))
}

// Semua pola aktif (XABCD, Three Drives, AB=CD): status dulu, lalu pola lima/enam titik sebelum AB=CD, lalu skor.
export function cariPola(bars = [], skala = SKALA_POLA.D, umurD = 30) {
  const urut = { prz: 0, berbalik: 1, menuju: 2 }, kelas = { xabcd: 0, tigadorongan: 1, abcd: 2 }
  return [...cariXabcd(bars, skala, umurD), ...cariTigaDorongan(bars, skala, umurD), ...cariAbcd(bars, skala, umurD)]
    .sort((a, b) => urut[a.status] - urut[b.status] || kelas[a.bentuk] - kelas[b.bentuk] || timpang(a) - timpang(b) || a.skor - b.skor)
}

// Swing X-A-B-C-D terakhir apa adanya (dengan rasio sebenarnya) saat tidak ada pola yang cocok. Dengan daftar skala:
// skala terbesar yang masih punya lima swing, supaya gambarnya terbaca (bukan gerak kecil di ujung chart).
export function swingXabcd(bars = [], th = 0.06) {
  const daftar = Array.isArray(th) ? [...th].sort((a, b) => b - a) : [th]
  th = daftar.find(t => zigzag(bars, t).length >= 5) ?? daftar[daftar.length - 1]
  const pv = zigzag(bars, th)
  if (pv.length < 5) return null
  const w = pv.slice(-5), [X, A, B, C, D] = w
  return { pola: null, nama: 'Swing terakhir', arah: A.p > X.p ? 'bullish' : 'bearish', status: 'tidak cocok', skala: th,
    titik: w.map((x, j) => ({ n: 'XABCD'[j], i: x.i, p: x.p })), rasio: rasioXabcd(X.p, A.p, B.p, C.p, D.p), prz: null,
    bentuk: 'xabcd', segi: [[0, 1, 2], [2, 3, 4]], garis: garisXabcd(null, rasioXabcd(X.p, A.p, B.p, C.p, D.p)) }
}

// ---------------------------------------------------------------- Fibonacci ----
// Leg terakhir yang sudah selesai pada skala sedang (pivot sebelum ekstrem berjalan).
function legTerakhir(bars, th, jumlah) {
  const pv = zigzag(bars, th)
  const tetap = pv.filter(x => !x.tentatif)
  return tetap.length >= jumlah ? tetap.slice(-jumlah) : null
}

// Fib retracement: 1 = titik awal, 0 = titik akhir leg. Dengan pola harmonik: leg X→A (tempat B dan D diukur).
export function fibRetracement(bars = [], pola = null, th = 0.1) {
  let a, b, dasar
  if (pola?.titik?.length >= 2 && pola.pola) {
    a = pola.titik[0]; b = pola.titik[1]; dasar = `kaki ${a.n}${b.n} pola ${pola.nama}`
  } else {
    const leg = legTerakhir(bars, th, 2) || legTerakhir(bars, th / 2, 2)
    if (!leg) return null
    ;[a, b] = leg; dasar = 'swing terakhir yang sudah selesai'
  }
  const level = FIB_RET.map(r => ({ r, p: b.p - (b.p - a.p) * r })).filter(l => l.p > 0)
  const akhir = bars[bars.length - 1]?.c
  return { a: { i: a.i, p: a.p }, b: { i: b.i, p: b.p }, level, dasar, naik: b.p > a.p,
    posisi: akhir == null ? null : r3((b.p - akhir) / (b.p - a.p)) }
}

// Trend-based fib extension: leg pertama (titik 1→2) diproyeksikan dari titik 3. Dengan pola: A→B diproyeksikan
// dari C (AB=CD), sehingga level 1 = CD sama panjang dengan AB.
export function fibExtension(bars = [], pola = null, th = 0.1) {
  let p1, p2, p3, dasar
  if (pola?.bentuk === 'abcd') {
    ;[p1, p2, p3] = pola.titik; dasar = `A→B diproyeksikan dari C pola ${pola.nama}`
  } else if (pola?.titik?.length === 5 && pola.pola && !['cypher', 'shark', 'fiveo'].includes(pola.pola)) {
    ;[, p1, p2, p3] = pola.titik; dasar = `A→B diproyeksikan dari C (AB=CD) pola ${pola.nama}`
  } else {
    const leg = legTerakhir(bars, th, 3) || legTerakhir(bars, th / 2, 3)
    if (!leg) return null
    ;[p1, p2, p3] = leg
    dasar = pola?.pola ? `tiga swing terakhir yang sudah selesai (pola ${pola.nama} tidak memakai AB=CD)` : 'tiga swing terakhir yang sudah selesai'
  }
  const k = p2.p - p1.p
  const level = FIB_EXT.map(r => ({ r, p: p3.p + k * r })).filter(l => l.p > 0)   // harga di bawah nol tidak mungkin
  return { titik: [p1, p2, p3].map((x, j) => ({ n: String(j + 1), i: x.i, p: x.p })), level, dasar, naik: k > 0 }
}

// ------------------------------------------------------------ Elliott wave ----
// Aturan baku impuls: gelombang 2 tidak melewati awal gelombang 1, gelombang 3 bukan yang terpendek, dan
// gelombang 4 tidak masuk wilayah gelombang 1. Rasio panduan (bukan aturan) ikut dihitung.
export function aturanElliott(w) {
  const s = Math.sign(w[1].p - w[0].p), L = (a, b) => Math.abs(w[b].p - w[a].p)
  const w1 = L(0, 1), w3 = L(2, 3), w5 = w.length > 5 ? L(4, 5) : null
  const aturan = [
    { teks: 'Gelombang 2 tidak melewati awal gelombang 1', ok: s * (w[2].p - w[0].p) > 0 },
    { teks: 'Gelombang 3 melewati puncak gelombang 1', ok: s * (w[3].p - w[1].p) > 0 },
    { teks: 'Gelombang 3 bukan yang terpendek', ok: w5 == null ? w3 >= w1 * 0.618 : !(w3 < w1 && w3 < w5) },
  ]
  if (w.length > 4) aturan.push({ teks: 'Gelombang 4 tidak masuk wilayah gelombang 1', ok: s * (w[4].p - w[1].p) > 0 })
  const panduan = [{ k: 'W2/W1', v: r3(L(1, 2) / w1), ideal: '0,5–0,618' }, { k: 'W3/W1', v: r3(w3 / w1), ideal: '1,618' }]
  if (w.length > 4) panduan.push({ k: 'W4/W3', v: r3(L(3, 4) / w3), ideal: '0,382' })
  if (w5 != null) panduan.push({ k: 'W5/W1', v: r3(w5 / w1), ideal: '0,618–1' })
  return { aturan, panduan, valid: aturan.every(a => a.ok), naik: s > 0 }
}

// Target gelombang 5 dari ujung gelombang 4: sama panjang dengan W1, atau 0,618 x jarak 0->3.
function proyeksiW5(w, naik) {
  const s = naik ? 1 : -1, w1 = Math.abs(w[1].p - w[0].p), r03 = Math.abs(w[3].p - w[0].p)
  return [{ k: 'W5 = W1', p: w[4].p + s * w1 }, { k: 'W5 = 0,618 × (0→3)', p: w[4].p + s * 0.618 * r03 }]
}

// Impuls 0-1-2-3-4-5 terbaru yang lolos aturan; bila belum ada, impuls 0-4 yang sedang membentuk gelombang 5
// beserta proyeksinya (W5 = W1 dan W5 = 0,618 × jarak 0→3).
export function cariElliott(bars = [], skala = SKALA.D, mundur = 6) {
  const n = bars.length
  let best = null
  for (const th of skala) {
    const pv = zigzag(bars, th)
    for (let akhir = pv.length; akhir >= Math.max(6, pv.length - mundur); akhir--) {
      const w = pv.slice(akhir - 6, akhir)
      if (w.length < 6) break
      const a = aturanElliott(w)
      if (!a.valid) continue
      const kand = { status: w[5].tentatif ? 'gelombang 5 berjalan' : 'lengkap', skala: th, ...a,
        titik: w.map((x, j) => ({ n: String(j), i: x.i, p: x.p })) }
      if (w[5].tentatif) kand.proyeksi = proyeksiW5(w, a.naik)
      if (!best || w[5].i > best.titik[5].i || (w[5].i === best.titik[5].i && th > best.skala)) best = kand
      break
    }
  }
  // Impuls berumur (selesai jauh sebelum akhir data) kalah dari impuls 0-4 yang masih berjalan.
  if (best && best.titik[5].i >= n - Math.max(20, n * 0.15)) return best
  let jalan = null
  for (const th of skala) {
    const pv = zigzag(bars, th)
    if (pv.length < 5) continue
    const w = pv.slice(-5)
    if (!w[4].tentatif && pv.length > 5) continue
    const a = aturanElliott(w)
    if (!a.valid) continue
    const proyeksi = proyeksiW5(w, a.naik)
    const kand = { status: 'menuju gelombang 5', skala: th, ...a, proyeksi,
      titik: w.map((x, j) => ({ n: String(j), i: x.i, p: x.p })) }
    if (!jalan || w[4].i > jalan.titik[4].i) jalan = kand
  }
  return jalan || best
}

// ------------------------------------------------------- Long / Short position ----
const bulat = (p, atas) => atas ? ceilTick(p) : floorTick(p)
export const STOP_MAKS = 0.25   // stop swing lebih jauh dari 25% harga dianggap tidak realistis
const fmt1 = v => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })
const pct = (a, b) => Math.round((b / a - 1) * 1000) / 10

// Rencana posisi dari pola harmonik searah (Long: bullish, Short: bearish): entry di D (atau tepi PRZ bila D masih
// proyeksi), stop di balik X / sisi luar PRZ, target 0,382 dan 0,618 kaki AD. Tanpa pola searah: swing terakhir
// (stop di balik swing low/high, target swing berlawanan terdekat lalu 2R).
export function rencanaPosisi(bars = [], arah = 'long', polaList = [], th = 0.06) {
  const n = bars.length
  if (!n) return null
  const long = arah === 'long', akhir = bars[n - 1].c
  const pola = polaList.find(r => r.arah === (long ? 'bullish' : 'bearish'))
  let entry, stop, target, i0, dasar, polaRef = null
  if (pola) {
    const D = pola.titik[pola.titik.length - 1]
    entry = D.proyeksi ? (long ? pola.prz[1] : pola.prz[0]) : D.p
    stop = pola.stop
    target = pola.target
    i0 = D.proyeksi ? n - 1 : D.i
    dasar = `pola ${pola.nama} ${pola.arah}`
    polaRef = pola
  } else {
    const pv = zigzag(bars, th).filter(x => !x.tentatif)
    const sisiStop = pv.filter(x => x.k === (long ? 'L' : 'H') && (long ? x.p < akhir : x.p > akhir))
    if (!sisiStop.length) return { arah, kosong: true, dasar: 'swing terakhir', catatan: long ? 'Belum ada swing low di bawah harga terakhir.' : 'Belum ada swing high di atas harga terakhir.' }
    entry = akhir
    stop = sisiStop[sisiStop.length - 1].p
    const r = Math.abs(entry - stop)
    // Stop swing terlalu jauh: rencana tidak realistis (target bisa di bawah nol untuk short).
    if (r / entry > STOP_MAKS) return { arah, kosong: true, dasar: 'swing terakhir', catatan: `Belum ada pola harmonik ${long ? 'bullish' : 'bearish'}, dan swing ${long ? 'low' : 'high'} terdekat ${fmt1(r / entry * 100)}% dari harga terakhir: terlalu jauh untuk stop loss. Tunggu pola atau swing baru.` }
    // TP1 = swing berlawanan terdekat yang minimal 1R dari entry (swing yang terlalu dekat tidak sebanding stop).
    const lawan = pv.filter(x => x.k === (long ? 'H' : 'L') && Math.abs(x.p - entry) >= r && (long ? x.p > entry : x.p < entry)).map(x => x.p)
    const t1 = lawan.length ? (long ? Math.min(...lawan) : Math.max(...lawan)) : entry + (long ? 1 : -1) * r * 1.5
    target = [t1, entry + (long ? 1 : -1) * Math.max(2 * r, Math.abs(t1 - entry) * 1.5)].map(t => Math.max(t, tick(entry)))
    i0 = n - 1
    dasar = 'swing terakhir (belum ada pola harmonik ' + (long ? 'bullish' : 'bearish') + ')'
  }
  // Pembulatan ke fraksi harga BEI; stop digeser satu fraksi di balik level.
  entry = bulat(entry, !long)
  // Satu fraksi di balik level, memakai fraksi pada harga hasil (aman di batas pita fraksi BEI).
  if (long) stop = floorTick(floorTick(stop) - 1e-9)
  else { const c = ceilTick(stop); stop = c + tick(c) }
  target = target.map(t => bulat(t, !long))
  const risiko = Math.abs(entry - stop)
  return {
    arah, dasar, pola: polaRef, entry, stop, target, i0, harga: akhir,
    stopPct: pct(entry, stop), targetPct: target.map(t => pct(entry, t)),
    rr: target.map(t => risiko ? Math.round(Math.abs(t - entry) / risiko * 100) / 100 : null),
    aktif: polaRef ? (polaRef.titik.at(-1).proyeksi ? 'menunggu harga masuk PRZ' : polaRef.status === 'prz' ? 'harga di PRZ' : 'sudah berbalik dari D') : 'harga terakhir',
  }
}

// ------------------------------------------------- diagram ideal & alasan ----
// Ciri pembeda tiap pola (Carney: lihat titik B dulu, lalu titik D).
export const PEMBEDA = {
  gartley: 'B tepat 0,618 XA dan D di 0,786 XA, tidak melewati X.',
  bat: 'B di bawah 0,618 XA (0,382–0,5) dan D dalam di 0,886 XA.',
  altbat: 'B dangkal 0,382 XA, tetapi D melewati X sampai 1,13 XA.',
  butterfly: 'B tepat 0,786 XA dan D melewati X di 1,27–1,414 XA.',
  crab: 'B 0,618 XA atau kurang, D jauh melewati X di 1,618 XA.',
  deepcrab: 'B dalam di 0,886 XA, D di 1,618 XA.',
  cypher: 'C melewati A (1,272–1,414 XA), D di 0,786 kaki XC.',
  shark: 'C melewati A (1,13–1,618 AB), D kembali ke sekitar level X (0,886–1,13 XC).',
  fiveo: 'B melewati X (1,13–1,618 XA), C melewati A (1,618–2,24 AB), dan D tepat di retracement 0,50 kaki BC.',
  abcd: 'Hanya empat titik: C koreksi 0,382–0,886 AB dan kaki CD sama panjang dengan AB.',
  altabcd: 'Empat titik seperti AB=CD, tetapi kaki CD memanjang 1,27–1,618 kali AB.',
  tigadorongan: 'Tiga dorongan searah; dorongan kedua dan ketiga masing-masing 1,27–1,618 kali koreksi sebelumnya.',
}
const tgh = r => r ? (r[0] + r[1]) / 2 : null
const teksRg = r => r[0] === r[1] ? String(r[0]).replace('.', ',') : `${String(r[0]).replace('.', ',')}–${String(r[1]).replace('.', ',')}`

// Bentuk ideal pola (nilai tengah tiap rentang rasio) dalam kotak 0..1: titik X-A-B-C-D (x, y; y 0 = atas) dan garis
// rasio putus-putus berlabel rentang baku, seperti tabel ilustrasi pola.
export function diagramIdeal(k, arah = 'bullish') {
  if (POLA_LAIN[k]) return diagramLain(k, arah)
  const p = POLA[k]
  if (!p) return null
  const v = { X: 0, A: 1 }
  v.B = 1 - tgh(p.b)
  if (p.cx) v.C = tgh(p.cx)
  else v.C = v.B + tgh(p.c) * (1 - v.B)
  v.D = p.d ? 1 - tgh(p.d) : p.dbc ? v.C + (v.B - v.C) * tgh(p.dbc) : v.C - tgh(p.dc) * (v.C - v.X)
  const nilai = Object.values(v), lo = Math.min(...nilai), hi = Math.max(...nilai)
  const bull = arah === 'bullish'
  const titik = ['X', 'A', 'B', 'C', 'D'].map((n, j) => {
    const t = (v[n] - lo) / (hi - lo)
    return { n, x: j / 4, y: bull ? 1 - t : t }
  })
  const [X, A, B, C, D] = titik
  const garis = [{ a: X, b: B, teks: teksRg(p.b) }]
  if (p.cx) garis.push({ a: X, b: C, teks: teksRg(p.cx) })
  else garis.push({ a: A, b: C, teks: teksRg(p.c) })
  if (p.e) garis.push({ a: B, b: D, teks: teksRg(p.e) })
  if (p.dbc) garis.push({ a: B, b: D, teks: teksRg(p.dbc) })
  else garis.push({ a: p.d ? X : C, b: D, teks: teksRg(p.d || p.dc) })
  return { titik, garis, bull }
}

// Bentuk ideal AB=CD (empat titik) dan Three Drives (enam titik) dalam kotak 0..1; bullish = titik akhir di bawah.
function diagramLain(k, arah) {
  const p = POLA_LAIN[k], bull = arah === 'bullish'
  let nama, v, garis
  if (p.bentuk === 'abcd') {
    const cd = tgh(p.cd), c = 0.618
    v = [1, 0, c, c - cd]; nama = ['A', 'B', 'C', 'D']
    garis = [[0, 2, teksRg(ABCD_C)], [1, 3, teksRg(ABCD_E)], [0, 3, 'CD ' + teksRg(p.cd) + ' AB']]
  } else {   // Three Drives turun (bullish): koreksi 0,618, dorongan tengah rentang
    const d = tgh(p.dorong)
    const P = [1, 0.45]
    P.push(P[1] + 0.618 * (P[0] - P[1])); P.push(P[2] - d * (P[2] - P[1]))
    P.push(P[3] + 0.618 * (P[2] - P[3])); P.push(P[4] - d * (P[4] - P[3]))
    v = P; nama = ['0', '1', 'A', '2', 'B', '3']
    garis = [[1, 3, teksRg(p.dorong)], [3, 5, teksRg(p.dorong)]]
  }
  const lo = Math.min(...v), hi = Math.max(...v), N = v.length
  // v makin besar makin tinggi; bullish = titik akhir terendah, bearish dibalik.
  const titik = v.map((x, j) => { const t = (x - lo) / (hi - lo); return { n: nama[j], x: j / (N - 1), y: bull ? 1 - t : t } })
  return { titik, garis: garis.map(([a, b, teks]) => ({ a: titik[a], b: titik[b], teks })), bull }
}

// Alasan pola terdeteksi: tiap rasio aktual dibanding rentang baku pola (dengan toleransi TOL).
export function alasanPola(row, tol = TOL) {
  if (row?.alasan) return row.alasan
  const p = row && POLA[row.pola]
  if (!p) return []
  const r = row.rasio || {}, out = []
  const tambah = (teks, v, rg, longgar = 1) => {
    if (v == null || !rg) return
    out.push({ teks, aktual: v, ideal: teksRg(rg), ok: jarak(v, rg) <= tol * longgar })
  }
  tambah('Titik B: retracement AB/XA', r.b, p.b)
  if (p.cx) tambah('Titik C: XC/XA (melewati A)', r.cx, p.cx)
  else tambah(p.c[0] > 1 ? 'Titik C: BC/AB (melewati A)' : 'Titik C: retracement BC/AB', r.c, p.c)
  if (r.d != null) {
    if (p.d) tambah('Titik D: AD/XA', r.d, p.d)
    if (p.dc) tambah('Titik D: CD/XC', r.dc, p.dc)
    if (p.dbc) tambah('Titik D: retracement DC/BC', r.dbc, p.dbc)
    if (p.e) tambah('Proyeksi CD/BC', r.e, p.e, 2)
    // AB=CD di dalam pola: syarat minimum menurut Carney (Crab 1,27-1,618); toleransi selonggar proyeksi BC.
    if (p.abcd) tambah('AB=CD: CD/AB', r.cd, p.abcd, ABCD_TOL / tol)
  }
  return out
}

// Penjelasan kenapa titik X berada di situ: X = swing awal pola (lembah untuk bullish, puncak untuk bearish) yang
// ditemukan zigzag, dan kaki XA menjadi "penggaris" semua rasio. Mengembalikan kalimat untuk panel/inset.
export function alasanX(row, bars = []) {
  const t = row?.titik
  if (!t || t.length < 2) return []
  const [x, a] = t, bull = a.p > x.p, tgl = i => String(bars[i]?.d || '').slice(0, 10)
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const naik = Math.abs(a.p / x.p - 1) * 100
  const X = x.n, A = a.n   // nama titik awal (X, A, atau 0) dan titik kedua pola
  const out = [
    `${X} = ${bull ? 'swing low' : 'swing high'} ${fh(x.p)} (${tgl(x.i)}): ${bull ? 'titik terendah' : 'titik tertinggi'} sebelum harga ${bull ? 'naik' : 'turun'} ${naik.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% ke ${A} ${fh(a.p)} (${tgl(a.i)}). Di antara ${X} dan ${A} tidak ada harga yang ${bull ? 'lebih rendah dari ' + X : 'lebih tinggi dari ' + X}.`,
    `Swing dicari otomatis dengan zigzag: titik baru diakui bila harga berbalik minimal ${Math.round((row.skala || 0) * 100)}% dari ekstrem sebelumnya, sehingga gerak kecil diabaikan.`,
  ]
  if (row.pola) {
    out.push(`${X} dipakai karena dari kaki ${X}${A} inilah titik-titik berikutnya cocok dengan rasio ${row.nama}. Swing lain sebelum atau sesudahnya tidak menghasilkan rasio yang cocok.`)
    out.push(row.stop === x.p
      ? `${X} juga batas batal: bila harga menembus ${fh(x.p)}, pola ${row.nama} gugur.`
      : `Batas batal ${row.nama} ada di ${fh(row.stop)} (${STOP_PRZ.has(row.pola) || POLA_LAIN[row.pola] ? 'sisi luar PRZ' : 'aturan pola'}), bukan di ${X}.`)
  } else {
    out.push('Rasio dari kaki XA ini belum cocok dengan pola baku, jadi X di sini hanya awal lima swing terakhir, bukan awal pola.')
  }
  return out
}

// ------------------------------------------------------- konfirmasi di D ----
// RSI Wilder per bar (null sebelum cukup data). Sama dengan website/harmonik.py.
export function rsi(closes = [], n = 14) {
  const out = Array(closes.length).fill(null)
  if (closes.length <= n) return out
  let g = 0, l = 0
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0) }
  g /= n; l /= n
  for (let i = n; i < closes.length; i++) {
    if (i > n) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n }
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}

// Candle pembalikan di bar i searah pembalikan: pin bar, engulfing, atau outside bar ('' bila tidak ada).
export function candleBalik(bars, i, bull) {
  if (i < 1 || i >= bars.length) return ''
  const b = bars[i], a = bars[i - 1], rng = b.h - b.l, badan = Math.abs(b.c - b.o)
  if (rng <= 0) return ''
  const bawah = Math.min(b.o, b.c) - b.l, atas = b.h - Math.max(b.o, b.c), ekor = bull ? bawah : atas
  if (ekor >= 2 * Math.max(badan, rng * 0.05) && ekor >= 0.6 * rng) return 'pin bar'
  if (bull && a.c < a.o && b.c > b.o && b.c >= a.o && b.o <= a.c) return 'bullish engulfing'
  if (!bull && a.c > a.o && b.c < b.o && b.c <= a.o && b.o >= a.c) return 'bearish engulfing'
  if (b.h > a.h && b.l < a.l && (bull ? b.c > b.o : b.c < b.o)) return 'outside bar'
  return ''
}

// Empat konfirmasi pembalikan di titik D (Astronacci: candle pembalikan, divergence RSI, tembus struktur minor;
// ditambah volume di D sesuai materi). Pola "menuju" (D belum terbentuk) tidak punya konfirmasi.
export function konfirmasiD(bars = [], row = null) {
  const t = row?.titik
  if (!row?.pola || !t || t.length < 4 || t[t.length - 1].proyeksi) return null
  // B = swing sejenis sebelum titik akhir (dua titik sebelumnya), D = titik akhir pola.
  const bull = row.arah === 'bullish', B = t[t.length - 3], D = t[t.length - 1], n = bars.length
  const cek = []
  let candle = null
  for (let i = D.i; i < n; i++) { const c = candleBalik(bars, i, bull); if (c) { candle = { i, nama: c }; break } }
  cek.push({ k: 'candle', teks: candle ? `Candle pembalikan: ${candle.nama} (${String(bars[candle.i].d).slice(0, 10)})` : 'Candle pembalikan sejak D: belum ada', ok: !!candle, i: candle?.i ?? null, nama: candle?.nama })
  const rs = rsi(bars.map(b => b.c)), rb = rs[B.i], rd = rs[D.i]
  const div = rb != null && rd != null && (bull ? D.p < B.p && rd > rb : D.p > B.p && rd < rb)
  cek.push({ k: 'rsi', ok: div, teks: rb == null || rd == null ? 'Divergence RSI: data belum cukup'
    : `Divergence RSI: ${div ? 'ada' : 'tidak ada'} (RSI B ${Math.round(rb)}, RSI D ${Math.round(rd)})` })
  const awal = bars.slice(Math.max(0, D.i - 3), D.i)
  let tembus = false
  if (awal.length && D.i < n - 1) {
    const batas = bull ? Math.max(...awal.map(x => x.h)) : Math.min(...awal.map(x => x.l))
    tembus = bull ? bars[n - 1].c > batas : bars[n - 1].c < batas
  }
  cek.push({ k: 'struktur', ok: tembus, teks: `Struktur minor (puncak/lembah 3 bar sebelum D) ${tembus ? 'sudah' : 'belum'} ditembus harga terakhir` })
  const sebelum = bars.slice(Math.max(0, D.i - 20), D.i).map(b => b.v)
  const rataV = sebelum.length ? sebelum.reduce((a, v) => a + v, 0) / sebelum.length : 0
  const vMaks = Math.max(...bars.slice(D.i, Math.min(n, D.i + 3)).map(b => b.v))
  const kali = rataV ? vMaks / rataV : null
  cek.push({ k: 'volume', ok: kali != null && kali >= 1.5, teks: kali == null ? 'Volume di D: data belum cukup' : `Volume di D: ${kali.toLocaleString('id-ID', { maximumFractionDigits: 1 })}x rata-rata 20 bar` })
  const jumlah = cek.filter(c => c.ok).length
  return { cek, jumlah, total: cek.length, candle, label: jumlah >= 3 ? 'kuat' : jumlah === 2 ? 'sedang' : 'lemah' }
}

// -------------------------------------------------- panah skenario dari D ----
// Jalur yang mungkin setelah D (seperti panah skenario di materi): ke target 1 (0,382 AD), target 2 (0,618 AD),
// titik C sebagai target lanjutan (Maxco) bila lebih jauh dari target 2, dan jalur gagal bila harga menembus stop.
// Jarak waktu panah hanya ilustrasi (kelipatan durasi kaki CD), bukan proyeksi waktu.
export function skenarioD(row) {
  const t = row?.titik
  if (!row?.pola || !t || t.length < 4 || !row.target) return []
  const C = t[t.length - 2], D = t[t.length - 1], bull = row.arah === 'bullish', s = bull ? 1 : -1
  const ketT = row.ketTarget || ['0,382 ' + (row.kaki || 'AD'), '0,618 ' + (row.kaki || 'AD')]
  const lebar = Math.max(5, D.i - C.i), ke = k => D.i + Math.round(lebar * k)
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const out = [
    // Bullish: target naik (untuk beli/Long). Bearish: target turun (untuk jual, ambil untung, atau Short).
    { k: 't1', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} 1 (${ketT[0]}) ${fh(row.target[0])}`, dari: D, ke: { i: ke(0.6), p: row.target[0] } },
    { k: 't2', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} 2 (${ketT[1]}) ${fh(row.target[1])}`, dari: D, ke: { i: ke(1), p: row.target[1] } },
  ]
  if (s * (C.p - row.target[1]) > 0) out.push({ k: 'c', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} lanjutan: titik ${C.n} ${fh(C.p)}`, dari: D, ke: { i: ke(1.4), p: C.p } })
  // Jalur gagal: panah sedikit melewati level stop; level stop sendiri digambar sebagai garis batas berlabel.
  const lewat = Math.max(Math.abs(D.p - row.stop) * 0.35, D.p * 0.01)
  out.push({ k: 'gagal', jenis: 'gagal', label: `Batal bila close menembus ${fh(row.stop)}`, dari: D, ke: { i: ke(0.6), p: row.stop - s * lewat }, stop: row.stop })
  return out
}

// ------------------------------------------------------ tren besar EMA ----
// Posisi harga terhadap EMA50 dan EMA200 sebagai penyaring: pola harmonik mencari pembalikan, jadi tren tidak
// membatalkan pola, tetapi pola yang searah tren besar (bullish di atas EMA200, bearish di bawahnya) lebih layak;
// yang melawan tren besar lebih sering hanya memberi reaksi singkat. EMA200 butuh minimal 200 bar.
export function trenBesar(bars = []) {
  const cl = bars.map(b => b.c), n = cl.length
  if (n < 50) return null
  const e50 = ema(cl, 50)[n - 1], e200 = n >= 200 ? ema(cl, 200)[n - 1] : null, c = cl[n - 1]
  const acuan = e200 ?? e50
  const arah = c > acuan ? 'naik' : 'turun'
  const kuat = e200 != null && (arah === 'naik' ? c > e50 && e50 > e200 : c < e50 && e50 < e200)
  return { e50, e200, harga: c, arah, kuat, acuanNama: e200 != null ? 'EMA200' : 'EMA50' }
}

// Kalimat penilaian pola terhadap tren besar.
export function nilaiTren(tren, arahPola) {
  if (!tren || !arahPola) return null
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const searah = (arahPola === 'bullish') === (tren.arah === 'naik')
  const posisi = `Harga ${fh(tren.harga)} ${tren.arah === 'naik' ? 'di atas' : 'di bawah'} ${tren.acuanNama} ${fh(tren.e200 ?? tren.e50)}`
    + (tren.e200 != null ? ` (EMA50 ${fh(tren.e50)})` : ' (EMA200 belum bisa dihitung: data kurang dari 200 bar)')
  const teks = searah
    ? `${posisi}: pola ${arahPola} searah tren besar${tren.kuat ? ' yang kuat' : ''}, peluangnya lebih baik.`
    : `${posisi}: pola ${arahPola} melawan tren besar. Lebih sering hanya memberi reaksi singkat; kecilkan posisi atau tunggu konfirmasi lebih kuat.`
  return { searah, teks }
}

// Keterangan bila impuls Elliott terakhir sudah lama selesai (garisnya jauh dari swing terakhir/XABCD): kapan selesai,
// berapa bar lalu, dan kenapa swing sesudahnya tidak digambar. null bila impuls masih berjalan atau baru selesai.
export function jarakElliott(e, bars = [], satuan = 'bar') {
  if (!e?.titik?.length || /berjalan|menuju/.test(e.status)) return null
  const akhir = e.titik[e.titik.length - 1], umur = bars.length - 1 - akhir.i
  if (umur < 5) return null
  const iso = String(bars[akhir.i]?.d || '').slice(0, 10), [y, m, d] = iso.split('-')
  const tgl = y && m ? `${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1]} ${y}` : iso
  return { tgl, umur, i: akhir.i, teks: `Impuls ${e.naik ? 'naik' : 'turun'} ini selesai ${tgl} di gelombang 5 (${umur} ${satuan} lalu). `
    + 'Swing sesudahnya belum membentuk impuls lima gelombang baru yang memenuhi aturan, jadi tidak digambar. Menurut Elliott, '
    + 'setelah impuls selesai biasanya terjadi koreksi tiga gelombang (A-B-C), dan fase itulah yang berjalan sejak gelombang 5. '
    + 'Karena itu garis Elliott bisa jauh dari XABCD, yang selalu memakai lima swing terakhir.' }
}

// ------------------------------------------------------------ lab pola ----
// Lab interaktif (tab Materi): dari rasio pilihan pengguna AB/XA (b), BC/AB (c), dan AD/XA (d) dibentuk titik
// X-A-B-C-D bullish (X 0, A 1), lalu dicari pola yang cocok dengan aturan dan toleransi yang sama dengan pendeteksi.
export function labPola(b, c, d) {
  const X = 0, A = 1, B = A - b, C = B + c * (A - B), D = A - d
  const r = rasioXabcd(X, A, B, C, D)
  const cocok = Object.keys(POLA)
    .filter(k => bentukOk(k, X, A, B, C))
    .map(k => ({ k, nama: POLA[k].nama, skor: skorPola(k, r) }))
    .filter(x => x.skor != null)
    .sort((x, y) => x.skor - y.skor)
  return { titik: { X, A, B, C, D }, rasio: r, cocok }
}

// Contoh rasio ideal tiap pola untuk tombol "pasang" di lab (nilai tengah rentang; Cypher/Shark dari kaki XC).
export function rasioContoh(k) {
  const p = POLA[k], t = rg => (rg[0] + rg[1]) / 2
  if (!p) return null
  const b = t(p.b)
  if (p.dbc) {   // 5-0: C = B + c x (A - B) melewati A, D = retracement dbc kaki BC
    const B = 1 - b, c = t(p.c), C = B + c * (1 - B), D = C + (B - C) * t(p.dbc)
    return { b, c, d: 1 - D }
  }
  if (p.cx) {   // C = cx x XA di atas X; D = C - dc x XC
    const C = t(p.cx), B = 1 - b, c = (C - B) / (1 - B), D = C - t(p.dc) * C
    return { b, c, d: 1 - D }
  }
  if (p.dc) {   // Shark: D di dc x XC dari C; c dan b dipilih supaya CD/BC di tengah rentangnya
    const dc = t(p.dc), e = t(p.e)
    for (let i = 0; i <= 40; i++) {
      const bb = p.b[0] + (p.b[1] - p.b[0]) * i / 40, B = 1 - bb
      const c = dc * B / ((1 - B) * (e - dc))   // dari e = dc x C / (c x (A - B)), C = B + c x (A - B)
      if (c >= p.c[0] && c <= p.c[1]) { const C = B + c * (1 - B); return { b: bb, c, d: 1 - (C - dc * C) } }
    }
    return null
  }
  // C dipilih supaya proyeksi CD/BC jatuh di tengah rentangnya: e = (B - D) / (c x (A - B)) + 1.
  const B = 1 - b, D = 1 - t(p.d), cIdeal = (B - D) / ((t(p.e) - 1) * (1 - B))
  return { b, c: Math.min(p.c[1], Math.max(p.c[0], cIdeal)), d: t(p.d) }
}
