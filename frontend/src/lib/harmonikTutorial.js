// Tutorial Harmonic: alat gambar manual. Titik diklik pengguna di chart, ditempelkan ke high/low candle, lalu dibangun
// ke bentuk yang sama dengan alat otomatis di harmonikAlat.js supaya digambar dan dijelaskan dengan format yang sama.
// Tombol Cek menilai tarikan: benar atau belum, masuk pola harmonic apa, dan saran perbaikan (yang masih kurang).
// Aturan sama dengan pemindai (Carney Vol. 1 + lembar pola): rasio, AB=CD, PRZ, stop, target 0,382/0,618 AD.
// Fungsi murni: masukan bars [{d,o,h,l,c,v}] (v dalam lot) dan titik [{n,i,p,sisi}].
import {
  ABCD_TOL, FIB_EXT, FIB_RET, POLA, SKALA_POLA, STOP_PRZ, TOL, aturanElliott, bentukOk, cariXabcd, garisXabcd, jarak, konfirmasiD,
  przPola, rasioXabcd, skorPola, targetStop,
} from './harmonikAlat.js'
import { tick } from './ta.js'

// Jumlah titik dan nama titik tiap alat. Alat swing (XABCD, Fib, Ext, Elliott) menempel ke high/low candle secara
// bergantian; Long/Short memakai harga klik yang dibulatkan ke fraksi harga BEI.
export const JUMLAH = { xabcd: 5, fib: 2, ext: 3, elliott: 6, long: 4, short: 4 }
export const NAMA_TITIK = {
  xabcd: ['X', 'A', 'B', 'C', 'D'], fib: ['awal', 'akhir'], ext: ['1', '2', '3'], elliott: ['0', '1', '2', '3', '4', '5'],
  long: ['Entry', 'Stop', 'TP1', 'TP2'], short: ['Entry', 'Stop', 'TP1', 'TP2'],
}
const SWING = new Set(['xabcd', 'fib', 'ext', 'elliott'])
export const PETUNJUK = {
  xabcd: 'Klik lima titik berurutan dari kiri ke kanan: X (awal dorongan besar), A, B, C, lalu D. X sampai C menempel ke puncak/lembah candle; D bebas di harga mana saja, juga di area kanan setelah candle terakhir, untuk mencoba apakah D masuk PRZ.',
  fib: 'Klik dua titik: awal dan akhir kaki yang diukur. Untuk harmonic, tarik dari X ke A.',
  ext: 'Klik tiga titik: awal kaki (1), akhir kaki (2), dan titik koreksi (3). Untuk AB=CD: A, B, lalu C.',
  elliott: 'Klik enam titik: 0 (awal impuls), 1, 2, 3, 4, dan 5.',
  long: 'Klik empat harga: entry, stop loss (di bawah entry), TP1, lalu TP2 (di atas entry).',
  short: 'Klik empat harga: entry, stop loss (di atas entry), TP1, lalu TP2 (di bawah entry).',
}

const fh = p => p == null || !isFinite(p) ? '–' : Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })
const rg = r => r[0] === r[1] ? fr(r[0]) : `${fr(r[0])}–${fr(r[1])}`
const tgl = (bars, i) => String(bars[i]?.d || '').slice(0, 10)
const bulatTick = p => { const t = tick(p); return Math.round(p / t) * t }
const pct = (a, b) => Math.round((b / a - 1) * 1000) / 10

// Titik baru dari klik di bar i pada harga tertentu. Alat swing menempel ke high atau low: titik pertama ke sisi yang
// lebih dekat dengan klik, titik berikutnya bergantian (puncak, lembah, puncak, ...).
// D pada XABCD bebas (tidak menempel candle): titik rencana untuk dicek terhadap PRZ, boleh di area kanan chart
// (paling jauh MASA_DEPAN candle setelah candle terakhir), harga dibulatkan ke fraksi BEI.
export const MASA_DEPAN = 60
export const dBebas = (k, j) => k === 'xabcd' && j === 4
export function tempel(bars, k, titik, i, harga) {
  const n = bars.length
  if (!n || titik.length >= JUMLAH[k]) return null
  const j = titik.length, nama = NAMA_TITIK[k][j]
  if (dBebas(k, j)) {
    const awal = titik[j - 1].i + 1
    i = Math.max(awal, Math.min(n - 1 + MASA_DEPAN, Math.round(i)))
    return { n: nama, i, p: bulatTick(Math.max(harga, 1)), sisi: titik[j - 1].sisi === 'H' ? 'L' : 'H', bebas: true }
  }
  i = Math.max(0, Math.min(n - 1, Math.round(i)))
  const b = bars[i]
  if (!SWING.has(k)) return { n: nama, i, p: bulatTick(Math.max(harga, 1)) }
  const sisi = j === 0 ? (Math.abs(harga - b.h) <= Math.abs(harga - b.l) ? 'H' : 'L') : titik[j - 1].sisi === 'H' ? 'L' : 'H'
  return { n: nama, i, p: sisi === 'H' ? b.h : b.l, sisi }
}

// ------------------------------------------------------------ cek swing ----
function ekstremDi(bars, i0, i1, sisi) {
  let j = i0
  for (let i = i0; i <= i1; i++) if (sisi === 'H' ? bars[i].h > bars[j].h : bars[i].l < bars[j].l) j = i
  return j
}

// Batas mundur titik pertama (X): sampai harga sebelumnya sudah setengah jalan menuju titik kedua (ayunan
// sebelumnya), tetapi paling jauh sepanjang jarak X ke titik ketiga (B). Simetri waktu Carney: X yang terlalu jauh di
// belakang (dasar harga berbulan-bulan) membuat X→B jauh lebih panjang daripada B→D, jadi bukan X pola ini.
function awalX(bars, titik) {
  const t = titik[0]
  let i0 = t.i
  if (!titik[1]) return i0
  const tengah = (t.p + titik[1].p) / 2, batas = Math.max(0, t.i - ((titik[2] || titik[1]).i - t.i))
  while (i0 > batas && (t.sisi === 'L' ? bars[i0 - 1].h < tengah : bars[i0 - 1].l > tengah)) i0--
  return i0
}

// Titik pertama sebagai "titik perantara" (Carney Bab 7, hal. 256; materi Menentukan Titik X): boleh tidak paling
// ekstrem, asalkan ujung ayunan yang jelas, yaitu dipisahkan dari ekstrem e sebelumnya oleh pantulan minimal minBalik
// ke dua arah. Mengembalikan keterangan, atau null bila titik itu masih di tengah dorongan.
export function perantara(bars, t, e, minBalik = 0.04) {
  if (e == null || e >= t.i - 1) return null
  let m = e + 1
  for (let i = e + 1; i < t.i; i++) if (t.sisi === 'H' ? bars[i].l < bars[m].l : bars[i].h > bars[m].h) m = i
  const pe = t.sisi === 'H' ? bars[e].h : bars[e].l, pm = t.sisi === 'H' ? bars[m].l : bars[m].h
  const balik1 = t.sisi === 'H' ? 1 - pm / pe : pm / pe - 1, balik2 = t.sisi === 'H' ? t.p / pm - 1 : 1 - t.p / pm
  if (balik1 < minBalik || balik2 < minBalik) return null
  return { e, pe, m, pm, balik: Math.round(Math.min(balik1, balik2) * 1000) / 10 }
}

// Urutan kiri ke kanan, puncak/lembah bergantian, dan setiap titik benar-benar ujung ayunan di antara tetangganya.
// Titik pertama boleh titik perantara (lihat perantara()).
export function cekSwing(bars, titik, k = 'xabcd', minBalik = 0.04) {
  const salah = [], n = bars.length
  for (let j = 1; j < titik.length; j++) {
    if (titik[j].i <= titik[j - 1].i) salah.push(`Titik ${titik[j].n} harus berada di kanan titik ${titik[j - 1].n} (urutan dari kiri ke kanan).`)
    else if (titik[j].sisi === 'H' ? titik[j].p <= titik[j - 1].p : titik[j].p >= titik[j - 1].p)
      salah.push(`Titik ${titik[j].n} harus lebih ${titik[j].sisi === 'H' ? 'tinggi' : 'rendah'} dari titik ${titik[j - 1].n}.`)
  }
  if (salah.length) return salah
  for (let j = 0; j < titik.length; j++) {
    // Titik pertama juga dicek ke belakang (sepanjang kaki pertama): X yang diambil di tengah dorongan ketahuan.
    // Batas ke belakang: sampai harga sebelumnya sudah setengah jalan menuju titik kedua (ayunan sebelumnya).
    // Candle milik titik tetangga tidak ikut: candle bersumbu panjang bisa memuat puncak dan lembah sekaligus,
    // dan urutannya di dalam candle tidak diketahui.
    const t = titik[j], i1 = Math.min(n - 1, j < titik.length - 1 ? Math.max(t.i, titik[j + 1].i - 1) : n - 1)
    if (t.bebas || t.i > n - 1) continue   // D bebas: titik rencana, bukan ujung ayunan candle
    const i0 = j ? Math.min(t.i, titik[j - 1].i + 1) : awalX(bars, titik)
    const e = ekstremDi(bars, i0, i1, t.sisi), pe = t.sisi === 'H' ? bars[e].h : bars[e].l
    if (pe === t.p) continue
    if (j === 0 && e < t.i && perantara(bars, t, e, minBalik)) continue
    const jenis = t.sisi === 'H' ? 'puncak' : 'lembah', arah = t.sisi === 'H' ? 'lebih tinggi' : 'lebih rendah'
    if (j === 0)
      salah.push(`Titik ${t.n} belum ${jenis} ${t.sisi === 'H' ? 'tertinggi' : 'terendah'} di awal dorongan: ada ${jenis} ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke sana, karena ${t.n} harus ujung paling ekstrem sebelum dorongan dimulai.`)
    else if (j === titik.length - 1)
      salah.push(`Setelah titik ${t.n}, harga bergerak ${arah} ke ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke ${jenis} itu${k === 'xabcd' ? ', atau polanya sudah gagal' : ''}.`)
    else
      salah.push(`Titik ${t.n} belum ${jenis} ${t.sisi === 'H' ? 'tertinggi' : 'terendah'} di antara ${j ? titik[j - 1].n : t.n} dan ${titik[j + 1].n}: ada ${jenis} ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke sana.`)
  }
  return salah
}

// ---------------------------------------------------------------- XABCD ----
const LABEL = { b: 'Titik B (AB/XA)', c: 'Titik C (BC/AB)', cx: 'Titik C (XC/XA)', d: 'Titik D (AD/XA)', dc: 'Titik D (CD/XC)',
  dbc: 'Titik D (DC/BC)', e: 'Proyeksi BC (CD/BC)', abcd: 'AB=CD (CD/AB)' }
export function rincian(k, r) {
  const p = POLA[k]
  const kunci = ['b', p.cx ? 'cx' : 'c', p.d ? 'd' : p.dc ? 'dc' : 'dbc', ...(p.e ? ['e'] : []), ...(p.abcd ? ['abcd'] : [])]
  return kunci.map(x => {
    const v = x === 'abcd' ? r.cd : r[x], batas = p[x], tol = x === 'e' ? TOL * 2 : x === 'abcd' ? ABCD_TOL : TOL
    return { x, teks: LABEL[x], v, rg: batas, ideal: rg(batas), ok: v != null && jarak(v, batas) <= tol, arah: v == null ? '' : v < batas[0] ? 'kecil' : v > batas[1] ? 'besar' : '' }
  })
}

function saranRasio(k, b, r, harga) {
  const nama = POLA[k].nama, v = fr(b.v), id = b.ideal
  const lain = x => Object.keys(POLA).filter(q => q !== k && POLA[q][x] && jarak(r[x], POLA[q][x]) <= TOL).map(q => POLA[q].nama)
  switch (b.x) {
    case 'b': {
      const alt = lain('b')
      return `B ${v} terlalu ${b.arah === 'besar' ? 'dalam' : 'dangkal'} untuk ${nama} (ideal ${id}).` + (alt.length ? ` Angka B ini cocok untuk ${alt.join(', ')}.` : ' Cek lagi titik X dan A.')
    }
    case 'c': case 'cx': return `C ${v} di luar rentang ${nama} (ideal ${id}). Pastikan C adalah ${b.arah === 'besar' ? 'pantulan yang belum melewati A' : 'pantulan yang cukup tinggi dari B'}.`
    case 'd': case 'dc': case 'dbc':
      return b.arah === 'besar' ? `D ${v} sudah melewati batas ${nama} (ideal ${id}). Kemungkinan polanya lain atau sudah gagal.`
        : `D ${v} belum sampai (ideal ${id}). ` + (harga != null ? `Untuk ${nama}, D diharapkan di sekitar ${fh(harga)}; tunggu harga sampai di sana.` : 'Tunggu harga bergerak lebih jauh.')
    case 'e': return `Kaki CD ${v} kali BC, ${b.arah === 'besar' ? 'terlalu panjang' : 'terlalu pendek'} untuk ${nama} (ideal ${id}).`
    default: return `CD baru ${v} kali AB (kriteria ${id}). Menurut Carney AB=CD wajib ada; pola ini lebih lemah.`
  }
}

// Bangun objek XABCD (bentuk sama dengan baris cariXabcd) dari lima titik manual, dengan pola paling cocok bila ada.
export function bangunXabcd(bars, titik) {
  if (titik.length < 5) return null
  const [X, A, B, C, D] = titik.map(t => t.p), bull = A > X, n = bars.length
  const r = rasioXabcd(X, A, B, C, D)
  const kand = Object.keys(POLA).filter(k => bentukOk(k, X, A, B, C)).map(k => {
    const tolakX = (k === 'gartley' || k === 'bat') && (bull ? D < X : D > X)
    return { k, skor: tolakX ? null : skorPola(k, r), jauh: skorPola(k, r, 99) ?? 99 }
  }).sort((a, b) => (a.skor == null) - (b.skor == null) || (a.skor ?? a.jauh) - (b.skor ?? b.jauh))
  const dasar = { titik: titik.map(({ n: nm, i, p, bebas }) => ({ n: nm, i, p, ...(bebas ? { bebas } : {}) })), rasio: r, arah: bull ? 'bullish' : 'bearish', bentuk: 'xabcd',
    segi: [[0, 1, 2], [2, 3, 4]], harga: bars[n - 1]?.c, manual: true, kandidat: kand }
  const cocok = kand.find(x => x.skor != null)
  if (!cocok) return { ...dasar, pola: null, nama: 'Tarikan manual', status: 'tidak cocok', prz: null, garis: garisXabcd(null, r), terdekat: kand[0]?.k || null }
  const k = cocok.k, p = POLA[k]
  const prz = przPola(k, X, A, B, C) || [D, D]
  const { target, stop } = targetStop(k, X, A, B, C, D, prz, bull)
  const diPrz = D >= prz[0] && D <= prz[1]
  const abcd = p.abcd ? { rasio: r.cd, kriteria: p.abcd, ok: jarak(r.cd, p.abcd) <= ABCD_TOL } : null
  return { ...dasar, pola: k, nama: p.nama, ket: p.ket, status: diPrz ? (titik[4].i < n - 1 && !titik[4].bebas ? 'berbalik' : 'prz') : 'tidak cocok', skor: cocok.skor,
    prz, target, stop, abcd, kaki: k === 'cypher' ? 'CD' : 'AD', ketTarget: k === 'fiveo' ? ['0,618 DC', 'titik C'] : ['0,382 AD', '0,618 AD'],
    targetCA: ['cypher', 'fiveo'].includes(k) ? null : [C, A], garis: garisXabcd(k, r), diPrz }
}

function nilaiHarian(bars) {
  const xs = bars.slice(-20)
  return xs.length ? xs.reduce((a, x) => a + x.c * x.v * 100, 0) / xs.length : null
}

function cekXabcd(bars, titik, skala) {
  const row = bangunXabcd(bars, titik), n = bars.length
  const minBalik = (skala || SKALA_POLA.D)[0]
  const benar = [], kurang = cekSwing(bars, titik, 'xabcd', minBalik)
  const [X, A, B, C, D] = titik.map(t => t.p), bull = A > X, xa = Math.abs(A - X)
  const bebasD = !!titik[4]?.bebas
  if (!kurang.length) benar.push(bebasD ? 'X, A, B, C adalah ujung ayunan (puncak dan lembah) yang benar, berurutan dari kiri ke kanan. D adalah titik rencana yang Anda letakkan sendiri.'
    : 'Kelima titik adalah ujung ayunan (puncak dan lembah) yang benar, berurutan dari kiri ke kanan.')
  if (bebasD && titik[4].i > n - 1) benar.push(`D diletakkan ${titik[4].i - (n - 1)} candle setelah candle terakhir: Cek menilai apakah harga D itu masuk PRZ, belum ada candle sungguhan di sana.`)
  const ia = awalX(bars, titik), eX = ekstremDi(bars, ia, Math.max(titik[0].i, titik[1].i - 1), titik[0].sisi)
  const pr = (bull ? bars[eX].l : bars[eX].h) !== X && eX < titik[0].i ? perantara(bars, titik[0], eX, minBalik) : null
  if (pr) benar.push(`X ${fh(X)} adalah titik perantara: ada ${bull ? 'lembah lebih rendah' : 'puncak lebih tinggi'} ${fh(pr.pe)} pada ${tgl(bars, pr.e)}, dipisahkan pantulan ${fr(pr.balik)}%. Menurut Carney ini boleh selama rasio cocok. Dengan X di ${fh(pr.pe)}, B menjadi ${fr(Math.round(Math.abs(A - B) / Math.abs(A - pr.pe) * 1000) / 1000)} XA; pilih X yang membuat rasio paling selaras.`)
  const lainCocok = (row.kandidat || []).filter(x => x.skor != null && x.k !== row.pola).map(x => POLA[x.k].nama)
  if (row.pola && lainCocok.length) benar.push(`Titik yang sama juga memenuhi rasio ${lainCocok.join(', ')}. ${row.nama} dipilih karena rasionya paling dekat.`)
  if (xa / Math.min(X, A) < 0.05) kurang.push(`Kaki XA hanya ${fr(Math.round(xa / Math.min(X, A) * 1000) / 10)}%: terlalu kecil. Pilih dorongan yang lebih besar, minimal sekitar 5–10% di chart harian.`)
  else benar.push(`Kaki XA ${fr(Math.round(xa / Math.min(X, A) * 1000) / 10)}% cukup besar sebagai penggaris pola.`)
  const r = row.rasio, rek = []
  let pola = null
  if (row.pola) {
    pola = `${row.nama} ${row.arah}`
    for (const b of rincian(row.pola, r)) {
      if (b.ok) benar.push(`${b.teks} ${fr(b.v)}: sesuai ${row.nama} (ideal ${b.ideal}).`)
      else kurang.push(saranRasio(row.pola, b, r))
    }
    if (row.diPrz) benar.push(`D ${fh(D)} berada di PRZ ${fh(row.prz[0])}–${fh(row.prz[1])}.`)
    else kurang.push(`D ${fh(D)} di luar PRZ ${fh(row.prz[0])}–${fh(row.prz[1])}. D harus berada di PRZ.`)
  } else if (row.terdekat) {
    const k = row.terdekat, nama = POLA[k].nama, s = bull ? 1 : -1
    kurang.unshift(`Rasio belum memenuhi pola mana pun. Yang paling dekat: ${nama} ${bull ? 'bullish' : 'bearish'}.`)
    for (const b of rincian(k, r)) {
      if (b.ok) benar.push(`${b.teks} ${fr(b.v)}: sudah sesuai ${nama}.`)
      else kurang.push(saranRasio(k, b, r, b.x === 'd' ? A - s * xa * POLA[k].d[0] : null))
    }
  } else kurang.unshift('Bentuk titik belum membentuk pola harmonic: B harus di antara X dan A, C di antara A dan B (kecuali Cypher, Shark, 5-0).')
  // Rekomendasi: daftar periksa kualitas pola (materi Hari 3) bila polanya cocok.
  if (row.pola) {
    const akhir = bars[n - 1].c, t1 = row.target[0], stop = row.stop
    const rr = bull ? (t1 - akhir) / (akhir - stop) : (akhir - t1) / (stop - akhir)
    const lari = Math.abs(akhir / D - 1) * 100
    const nilai = nilaiHarian(bars)
    const konf = titik[4].bebas ? null : konfirmasiD(bars, { ...row, titik: row.titik })
    const cek = [
      { ok: true, teks: `Angka B dan D cocok dengan ${row.nama}` },
      { ok: !row.abcd || row.abcd.ok, teks: row.abcd ? `AB=CD: CD ${fr(r.cd)} kali AB (kriteria ${rg(row.abcd.kriteria)})` : 'AB=CD tidak dipakai pola ini' },
      { ok: row.diPrz, teks: 'D berada di PRZ' },
      { ok: lari <= 5, teks: `Harga terakhir ${fh(akhir)}, ${fr(Math.round(lari * 10) / 10)}% dari D (maksimal sekitar 5%)` },
      { ok: rr >= 1, teks: `Dari harga terakhir: untung ke target 1 (${fh(t1)}) dibanding rugi ke stop (${fh(stop)}) = ${isFinite(rr) ? fr(Math.round(rr * 100) / 100) : '–'} banding 1 (minimal 1)` },
      { ok: nilai != null && nilai >= 1e9, teks: `Likuiditas: rata-rata nilai transaksi ${nilai == null ? '–' : 'Rp' + fr(Math.round(nilai / 1e8) / 10) + ' miliar'} per hari (minimal Rp1 miliar)` },
      { ok: !!konf && konf.jumlah >= 2, teks: konf ? `Tanda berbalik di D: ${konf.jumlah} dari ${konf.total} (${konf.label})` : 'Tanda berbalik di D: belum bisa dinilai' },
    ]
    const gagal = cek.filter(c => !c.ok)
    rek.push(...cek.map(c => ({ ...c })))
    row.kesimpulan = !gagal.length ? 'Layak dipertimbangkan. Tetap pasang stop sejak awal.'
      : gagal.length === 1 ? `Hampir layak. Yang kurang: ${gagal[0].teks.toLowerCase()}.` : `Lewati dulu: ${gagal.length} syarat belum terpenuhi.`
    row.rencana = { prz: row.prz, stop, target: row.target, rr: isFinite(rr) ? Math.round(rr * 100) / 100 : null,
      stopKet: STOP_PRZ.has(row.pola) ? 'sedikit di luar PRZ (D sudah melewati X)' : row.pola === 'fiveo' ? '0,618 kaki BC' : 'di balik X' }
  }
  // Pembanding: apakah pemindai otomatis menemukan pola yang sama (B, C, D di bar yang berdekatan)?
  const auto = cariXabcd(bars, skala || SKALA_POLA.D)
  const sama = auto.find(a => a.pola === row.pola && [2, 3, 4].every(j => Math.abs(a.titik[j].i - titik[j].i) <= 3))
  const sistem = sama ? `Pemindai sistem juga menemukan ${sama.nama} ${sama.arah} di titik yang sama.`
    : auto.length ? `Pemindai sistem saat ini menemukan: ${auto.slice(0, 3).map(a => `${a.nama} ${a.arah} (X ${tgl(bars, a.titik[0].i)})`).join('; ')}. Bandingkan titiknya dengan tarikan Anda.`
      : 'Pemindai sistem tidak menemukan pola aktif di saham dan timeframe ini.'
  const nilaiAkhir = kurang.length === 0 ? 'benar' : row.pola && cekSwing(bars, titik).length === 0 ? 'hampir' : 'perlu'
  return { alat: 'xabcd', nilai: nilaiAkhir, pola, benar, kurang, rekomendasi: rek, kesimpulan: row.kesimpulan || null, rencana: row.rencana || null, sistem, objek: row }
}

// ------------------------------------------------------------- Fib, Ext ----
export function bangunFib(bars, titik) {
  if (titik.length < 2) return null
  const [a, b] = titik, akhir = bars[bars.length - 1]?.c
  const level = FIB_RET.map(r => ({ r, p: b.p - (b.p - a.p) * r })).filter(l => l.p > 0)
  return { a: { i: a.i, p: a.p }, b: { i: b.i, p: b.p }, level, dasar: 'tarikan manual', naik: b.p > a.p, manual: true,
    posisi: akhir == null ? null : Math.round((b.p - akhir) / (b.p - a.p) * 1000) / 1000 }
}
export function bangunExt(titik) {
  if (titik.length < 3) return null
  const [p1, p2, p3] = titik, k = p2.p - p1.p
  return { titik: titik.map((x, j) => ({ n: String(j + 1), i: x.i, p: x.p })), level: FIB_EXT.map(r => ({ r, p: p3.p + k * r })).filter(l => l.p > 0),
    dasar: 'tarikan manual', naik: k > 0, manual: true }
}

function cekFib(bars, titik, xabcd) {
  const o = bangunFib(bars, titik), kurang = cekSwing(bars, titik, 'fib'), benar = []
  const [a, b] = titik, besar = Math.abs(b.p - a.p) / Math.min(a.p, b.p) * 100
  if (!kurang.length) benar.push('Fib ditarik dari ujung ayunan ke ujung ayunan berikutnya.')
  if (besar < 5) kurang.push(`Kaki yang diukur hanya ${fr(Math.round(besar * 10) / 10)}%: terlalu kecil untuk dibaca.`)
  if (xabcd?.titik?.length === 5) {
    const [X, A] = xabcd.titik
    if (a.i === X.i && b.i === A.i) benar.push('Fib ditarik dari X ke A: B dan D bisa dibaca langsung di level 0,618, 0,786, 0,886, 1,27, dan 1,618.')
    else kurang.push(`Untuk membaca pola harmonic, tarik Fib dari X (${tgl(bars, X.i)}) ke A (${tgl(bars, A.i)}).`)
  }
  const rek = []
  if (o.posisi != null) {
    const dekat = o.level.reduce((m, l) => Math.abs(l.r - o.posisi) < Math.abs(m.r - o.posisi) ? l : m, o.level[0])
    rek.push({ ok: true, teks: `Harga terakhir di retracement ${fr(o.posisi)}, paling dekat dengan level ${fr(dekat.r)} (${fh(dekat.p)}).` })
  }
  return { alat: 'fib', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, rekomendasi: rek, objek: o }
}

function cekExt(bars, titik, xabcd) {
  const o = bangunExt(titik), kurang = cekSwing(bars, titik, 'ext'), benar = []
  const [p1, p2, p3] = titik, c = Math.abs(p3.p - p2.p) / Math.abs(p2.p - p1.p)
  if (!kurang.length) benar.push('Ketiga titik adalah ujung ayunan yang benar.')
  if (c >= 0.382 * 0.95 && c <= 0.886 * 1.05) benar.push(`Titik 3 memantul ${fr(Math.round(c * 1000) / 1000)} dari kaki 1–2, sesuai rentang AB=CD (0,382–0,886).`)
  else kurang.push(`Titik 3 memantul ${fr(Math.round(c * 1000) / 1000)} dari kaki 1–2, di luar 0,382–0,886. Untuk AB=CD, titik 3 harus pantulan sebagian.`)
  if (xabcd?.titik?.length === 5) {
    const [, A, B, C] = xabcd.titik
    if (p1.i === A.i && p2.i === B.i && p3.i === C.i) benar.push('Ext ditarik dari A, B, ke C: level 1 adalah titik D bila AB=CD setara, level 1,27 dan 1,618 untuk versi panjang.')
    else kurang.push('Untuk mengecek AB=CD di pola harmonic, tarik Ext dari A ke B, lalu klik C.')
  }
  const l1 = o.level.find(l => l.r === 1), l127 = o.level.find(l => l.r === 1.27)
  return { alat: 'ext', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, objek: o,
    rekomendasi: [{ ok: true, teks: `Proyeksi setara (level 1) di ${fh(l1?.p)}, versi 1,27 di ${fh(l127?.p)}. Bandingkan dengan PRZ pola.` }] }
}

// --------------------------------------------------------------- Elliott ----
export function bangunElliott(titik) {
  if (titik.length < 6) return null
  return { status: 'tarikan manual', ...aturanElliott(titik), titik: titik.map((x, j) => ({ n: String(j), i: x.i, p: x.p })), manual: true }
}
function cekElliott(bars, titik) {
  const o = bangunElliott(titik), kurang = cekSwing(bars, titik, 'elliott'), benar = []
  if (!kurang.length) benar.push('Keenam titik adalah ujung ayunan yang benar.')
  for (const a of o.aturan) {
    if (a.ok) benar.push(a.teks + '.')
    else kurang.push(`${a.teks}: belum terpenuhi. Coba geser penomoran gelombang, atau ini bukan impuls lima gelombang.`)
  }
  return { alat: 'elliott', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, objek: o,
    rekomendasi: o.panduan.map(p => ({ ok: true, teks: `${p.k} ${fr(p.v)} (panduan ${p.ideal})` })) }
}

// ----------------------------------------------------------- Long / Short ----
export function bangunPosisi(bars, k, titik, pola = null) {
  if (titik.length < 4) return null
  const long = k === 'long', [e, s, t1, t2] = titik.map(t => t.p), risiko = Math.abs(e - s), n = bars.length
  return { arah: k, dasar: 'tarikan manual', pola: pola && pola.arah === (long ? 'bullish' : 'bearish') && pola.pola ? pola : null,
    entry: e, stop: s, target: [t1, t2], i0: titik[0].i, harga: bars[n - 1]?.c, stopPct: pct(e, s), targetPct: [pct(e, t1), pct(e, t2)],
    rr: [t1, t2].map(t => risiko ? Math.round(Math.abs(t - e) / risiko * 100) / 100 : null), aktif: 'tarikan manual', manual: true }
}
function cekPosisi(bars, k, titik, xabcd) {
  const o = bangunPosisi(bars, k, titik, xabcd), long = k === 'long', benar = [], kurang = []
  const { entry: e, stop: s, target: [t1, t2] } = o
  const urut = long ? s < e && e < t1 && t1 < t2 : s > e && e > t1 && t1 > t2
  if (!urut) kurang.push(long ? 'Urutan harga Long harus: stop di bawah entry, TP1 di atas entry, dan TP2 di atas TP1.' : 'Urutan harga Short harus: stop di atas entry, TP1 di bawah entry, dan TP2 di bawah TP1.')
  else benar.push('Urutan entry, stop, TP1, dan TP2 sudah benar.')
  if (urut) {
    if (o.rr[0] >= 1) benar.push(`R:R ke TP1 ${fr(o.rr[0])}: target sebanding dengan risiko.`)
    else kurang.push(`R:R ke TP1 hanya ${fr(o.rr[0])}: untung lebih kecil dari risiko. Dekatkan entry ke stop atau pilih target lebih jauh.`)
    if (o.rr[1] >= 2) benar.push(`R:R ke TP2 ${fr(o.rr[1])}, minimal 2 terpenuhi.`)
    else kurang.push(`R:R ke TP2 ${fr(o.rr[1])} di bawah 2.`)
    if (Math.abs(o.stopPct) > 25) kurang.push(`Stop ${fr(Math.abs(o.stopPct))}% dari entry: terlalu jauh.`)
  }
  const p = o.pola
  if (p) {
    const D = p.titik[4].p
    if (e >= p.prz[0] * 0.98 && e <= p.prz[1] * 1.02) benar.push(`Entry dekat PRZ pola ${p.nama} (${fh(p.prz[0])}–${fh(p.prz[1])}).`)
    else kurang.push(`Entry ${fh(e)} jauh dari PRZ pola ${p.nama} (${fh(p.prz[0])}–${fh(p.prz[1])}). Entry yang baik di dekat D (${fh(D)}).`)
    if (long ? s <= p.stop : s >= p.stop) benar.push(`Stop di balik batas batal pola (${fh(p.stop)}).`)
    else kurang.push(`Stop ${fh(s)} belum di balik batas batal pola ${p.nama} (${fh(p.stop)}): ${STOP_PRZ.has(p.pola) ? 'di luar PRZ' : 'di balik X'}.`)
    const dekat = (a, b) => Math.abs(a / b - 1) <= 0.03
    if (dekat(t1, p.target[0]) && dekat(t2, p.target[1])) benar.push('TP1 dan TP2 sesuai target pola (0,382 dan 0,618 kaki AD).')
    else kurang.push(`Target pola ${p.nama}: TP1 ${fh(p.target[0])} (0,382 AD) dan TP2 ${fh(p.target[1])} (0,618 AD).`)
  } else if (xabcd?.pola) kurang.push(`Arah ${long ? 'Long' : 'Short'} berlawanan dengan pola ${xabcd.nama} ${xabcd.arah} yang Anda tarik.`)
  else kurang.push('Belum ada pola harmonic yang cocok dari tarikan XABCD Anda; rencana ini belum punya dasar pola.')
  if (!long) benar.push('Catatan: short selling di BEI terbatas. Bagi yang tidak bisa short, pakai sebagai rencana jual atau ambil untung.')
  return { alat: k, nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, rekomendasi: [], objek: o }
}

// ------------------------------------------------------------- pintu masuk ----
// Objek gambar untuk alat yang titiknya sudah lengkap (bentuk sama dengan alat otomatis).
export function bangunManual(bars, k, titik, xabcd = null) {
  if (!titik || titik.length < JUMLAH[k]) return null
  if (k === 'xabcd') return bangunXabcd(bars, titik)
  if (k === 'fib') return bangunFib(bars, titik)
  if (k === 'ext') return bangunExt(titik)
  if (k === 'elliott') return bangunElliott(titik)
  return bangunPosisi(bars, k, titik, xabcd)
}

// Hasil cek satu alat: { nilai: 'benar' | 'hampir' | 'perlu', benar[], kurang[], rekomendasi[], ... }.
export function cekManual(bars, k, titik, { xabcd = null, skala = null } = {}) {
  if (!titik || titik.length < JUMLAH[k]) return { alat: k, nilai: 'belum', benar: [], kurang: [`Titik belum lengkap: ${titik?.length || 0} dari ${JUMLAH[k]}. ${PETUNJUK[k]}`], rekomendasi: [] }
  if (k === 'xabcd') return cekXabcd(bars, titik, skala)
  if (k === 'fib') return cekFib(bars, titik, xabcd)
  if (k === 'ext') return cekExt(bars, titik, xabcd)
  if (k === 'elliott') return cekElliott(bars, titik)
  return cekPosisi(bars, k, titik, xabcd)
}

// ------------------------------------------------------------- proyeksi ----
// Tombol Proyeksi (alat XABCD): menunjukkan pola yang benar dari tarikan pengguna.
//  1. X, A, B, C dirapikan ke ujung ayunan sebenarnya (puncak/lembah paling ekstrem di jendelanya, aturan cekSwing).
//  2. Pola dipilih dari rasio B dan C saja (D belum dipakai), lalu PRZ dihitung dari X, A, B, C.
//  3. D proyeksi: candle pertama setelah C yang menyentuh PRZ; bila belum ada, waktu D diperkirakan
//     C + lama kaki AB (simetri waktu AB=CD) dan harga diharapkan di level D pola.
// Bila tarikan tidak masuk pola mana pun, dipakai pola temuan pemindai sistem. Hasil null bila tidak ada keduanya.
function rapikan(bars, titik, minBalik = 0.04) {
  const n = bars.length, out = titik.map(t => ({ ...t }))
  for (let j = 0; j < out.length; j++) {
    // Candle milik titik tetangga tidak ikut: candle bersumbu panjang bisa memuat puncak dan lembah sekaligus,
    // dan urutannya di dalam candle tidak diketahui.
    const t = out[j], i1 = Math.min(n - 1, j < out.length - 1 ? Math.max(t.i, out[j + 1].i - 1) : n - 1)
    if (t.bebas || t.i > n - 1) continue   // D bebas: titik rencana, bukan ujung ayunan candle
    const i0 = j ? Math.min(t.i, out[j - 1].i + 1) : awalX(bars, out)
    if (i1 < i0) return null
    const e = ekstremDi(bars, i0, i1, t.sisi), pe = t.sisi === 'H' ? bars[e].h : bars[e].l
    if (j === 0 && e < t.i && perantara(bars, t, e, minBalik)) continue   // X perantara: sah, tidak dipindah
    if (pe !== t.p) out[j] = { ...t, i: e, p: pe, dari: { i: t.i, p: t.p } }
  }
  return out
}

export function proyeksiXabcd(bars, titik, { skala = null } = {}) {
  const n = bars.length
  if (!n || !titik || titik.length < 4) return null
  const catatan = []
  // Urutan harus benar dulu (kiri ke kanan, puncak-lembah bergantian); titik yang salah urut tidak bisa dirapikan.
  // Urutan kiri ke kanan dengan puncak-lembah bergantian; harga dicek lagi setelah dirapikan.
  const naikTurun = ts => ts.every((t, j) => !j || (t.i > ts[j - 1].i && t.sisi !== ts[j - 1].sisi && (t.sisi === 'H' ? t.p > ts[j - 1].p : t.p < ts[j - 1].p)))
  const urut = titik.slice(0, 4).every((t, j) => !j || (t.i > titik[j - 1].i && t.sisi !== titik[j - 1].sisi))
  let rapi = urut ? rapikan(bars, titik.slice(0, 5), (skala || SKALA_POLA.D)[0]) : null
  if (rapi && !naikTurun(rapi.slice(0, 4))) rapi = null
  let pilih = null, semua = []
  if (rapi) {
    const [X, A, B, C] = rapi.slice(0, 4).map(t => t.p), r = rasioXabcd(X, A, B, C)
    semua = Object.keys(POLA).filter(k => bentukOk(k, X, A, B, C)).map(k => {
      const p = POLA[k], jb = jarak(r.b, p.b), jc = p.cx ? jarak(r.cx, p.cx) : jarak(r.c, p.c)
      return { k, j: jb + jc, ok: jb <= TOL && jc <= TOL, prz: przPola(k, X, A, B, C) }
    }).filter(x => x.ok && x.prz).sort((a, b) => a.j - b.j)
    pilih = semua[0] || null
    if (pilih) {
      for (const t of rapi.slice(0, 4)) if (t.dari)
        catatan.push(`${t.n} dipindah dari ${fh(t.dari.p)} (${tgl(bars, t.dari.i)}) ke ${fh(t.p)} (${tgl(bars, t.i)}): ${t.sisi === 'H' ? 'puncak' : 'lembah'} sebenarnya ada di sana.`)
      const p = POLA[pilih.k]
      const tol = (v, x) => jarak(v, x) > 0 ? ', masih dalam toleransi 5%' : ''
      catatan.push(`B ${fr(r.b)} XA cocok untuk ${p.nama} (${rg(p.b)}${tol(r.b, p.b)}).`)
      catatan.push(p.cx ? `C ${fr(r.cx)} XA sesuai (${rg(p.cx)}${tol(r.cx, p.cx)}).` : `C ${fr(r.c)} AB sesuai (${rg(p.c)}${tol(r.c, p.c)}).`)
      if (semua.length > 1) catatan.push(`Titik X, A, B, C yang sama juga memenuhi ${semua.slice(1).map(x => POLA[x.k].nama).join(', ')}; ${p.nama} dipakai karena rasionya paling dekat.`)
    }
  }
  let k, ts, prz, sumber = 'tarikan'
  if (pilih) {
    k = pilih.k; ts = rapi.slice(0, 4).map(({ n: nm, i, p, sisi, dari }) => ({ n: nm, i, p, sisi, dipindah: !!dari })); prz = pilih.prz
  } else {
    const auto = cariXabcd(bars, skala || SKALA_POLA.D)[0]
    if (!auto) return { sumber: 'kosong', catatan: [
      urut ? 'Dari titik X, A, B, C ini belum ada pola yang cocok, walaupun titiknya sudah dirapikan ke puncak dan lembah sebenarnya.' : 'Urutan titik belum benar (kiri ke kanan, puncak dan lembah bergantian), jadi belum bisa diproyeksikan.',
      'Pemindai sistem juga tidak menemukan pola aktif di saham dan timeframe ini. Coba saham atau timeframe lain.'] }
    sumber = 'sistem'; k = auto.pola; prz = auto.prz
    ts = auto.titik.slice(0, 4).map((t, j) => ({ n: t.n, i: t.i, p: t.p, sisi: (j % 2 === 0) === (auto.arah === 'bullish') ? 'L' : 'H' }))
    catatan.push(urut ? 'Titik X, A, B, C Anda belum masuk pola mana pun, walaupun sudah dirapikan ke puncak dan lembah sebenarnya.' : 'Urutan titik Anda belum benar (kiri ke kanan, puncak dan lembah bergantian).')
    catatan.push(`Yang ditampilkan adalah pola temuan pemindai sistem: ${auto.nama} ${auto.arah}, X pada ${tgl(bars, ts[0].i)}.`)
  }
  const p = POLA[k], [X, A, B, C] = ts.map(t => t.p), bull = A > X, s = bull ? 1 : -1, xa = Math.abs(A - X)
  // Harga D yang diharapkan: level XA pola (dijepit ke PRZ), atau tengah PRZ untuk pola yang D-nya dari XC/BC.
  const level = p.d ? A - s * xa * p.d[0] : (prz[0] + prz[1]) / 2
  const dHarga = Math.min(prz[1], Math.max(prz[0], level))
  let sampai = null, tembus = null
  for (let i = ts[3].i + 1; i < n; i++) {
    if (!sampai && (bull ? bars[i].l <= prz[1] : bars[i].h >= prz[0])) sampai = i
    if (bull ? bars[i].l < prz[0] * (1 - TOL) : bars[i].h > prz[1] * (1 + TOL)) { tembus = i; break }
  }
  const lamaAB = Math.max(1, ts[2].i - ts[1].i)
  const D = sampai != null ? { n: 'D', i: sampai, p: bull ? Math.max(bars[sampai].l, prz[0]) : Math.min(bars[sampai].h, prz[1]), sisi: bull ? 'L' : 'H' }
    : { n: 'D', i: ts[3].i + lamaAB, p: dHarga, sisi: bull ? 'L' : 'H', perkiraan: true }
  const ketD = p.d ? `${rg(p.d)} XA` : p.dc ? `${rg(p.dc)} XC` : `${rg(p.dbc)} kaki BC`
  catatan.push(`D seharusnya di PRZ ${fh(prz[0])}–${fh(prz[1])} (D ${ketD}${p.e ? `, proyeksi BC ${rg(p.e)}` : ''}).`)
  if (sampai != null) catatan.push(`Harga sudah masuk PRZ pada ${tgl(bars, sampai)}${tembus != null ? `, tetapi lalu menembus PRZ pada ${tgl(bars, tembus)}: pola gagal` : ''}.`)
  else if (tembus == null) catatan.push(`Harga belum sampai PRZ. Kalau waktunya seimbang dengan kaki AB, D diperkirakan sekitar ${lamaAB} candle setelah C.`)
  const dUser = sumber === 'tarikan' && titik[4] ? titik[4] : null
  if (dUser) {
    const di = dUser.p >= prz[0] && dUser.p <= prz[1]
    catatan.push(di ? `D Anda ${fh(dUser.p)} sudah berada di PRZ.`
      : `D Anda ${fh(dUser.p)} ${bull === (dUser.p > prz[1]) ? 'belum sampai' : 'sudah melewati'} PRZ, selisih ${fr(Math.abs(pct(dUser.p, dUser.p > prz[1] ? prz[1] : prz[0])))}%.`)
  }
  return { sumber, pola: k, nama: p.nama, arah: bull ? 'bullish' : 'bearish', titik: [...ts, D], prz, dHarga, sampai, gagal: tembus != null, catatan, cocok: sumber === 'tarikan' ? semua.map(x => x.k) : [k] }
}
