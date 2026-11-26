// Cek silang pola harmonik otomatis: pemindai cukup longgar (toleransi 5%, pola "menuju" belum dicek AB=CD), jadi
// setiap pola diberi label kekuatan beserta alasannya, ditambah skenario lain yang tidak ikut tampil (pola arah
// sebaliknya atau X berbeda yang PRZ-nya masih jauh), dan titik untuk dicek ulang di tab Tutorial.
// Fungsi murni. Baris pola bisa dari cariXabcd (klien) atau /api/harmonik (server): keduanya punya pola, status,
// rasio, prz, dan titik [{n, p}].
import { ABCD_TOL, MENUJU_MAKS, POLA, SKALA_POLA, TOL, cariXabcd, jarak, jarakKaki, rasioXabcd } from './harmonikAlat.js'
import { tick } from './ta.js'

export const PAS = 0.02           // rasio ideal berupa angka tunggal (Gartley B 0,618): selisih sampai 2% masih dianggap pas
export const KASAR_MAKS = 0.03     // satu fraksi harga lebih dari 3% kaki XA: rasio terlalu kasar untuk dipercaya
export const SKENARIO_MAKS = 0.5   // skenario lain: PRZ sampai 50% dari harga (pemindai utama hanya 25%)
export const TINGKAT = {
  kuat: { nama: 'Kuat', ket: 'rasio di dalam rentang ideal dan AB=CD terpenuhi' },
  sedang: { nama: 'Sedang', ket: 'ada rasio yang hanya lolos toleransi atau satu syarat penting belum terpenuhi' },
  lemah: { nama: 'Lemah', ket: 'beberapa syarat belum terpenuhi; pakai sebagai gambaran, bukan dasar transaksi' },
}

const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })
const rg = r => r[0] === r[1] ? fr(r[0]) : `${fr(r[0])}–${fr(r[1])}`
const fh = p => p == null || !isFinite(p) ? '–' : Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })

// Satu rasio: ok = di dalam rentang ideal (atau pas untuk angka tunggal); lolos toleransi = ringan; di luar = berat.
function nilaiRasio(nama, v, batas, tol = TOL) {
  if (v == null || !batas) return null
  const j = jarak(v, batas)
  if (j === 0) return { ok: true, teks: `${nama} ${fr(v)} di dalam rentang ideal ${rg(batas)}.` }
  if (batas[0] === batas[1] && j <= PAS) return { ok: true, teks: `${nama} ${fr(v)} pas dengan ideal ${rg(batas)} (selisih di bawah 2%).` }
  if (j <= tol) return { ok: false, ringan: true, teks: `${nama} ${fr(v)} hanya lolos toleransi (ideal ${rg(batas)}).` }
  return { ok: false, berat: true, teks: `${nama} ${fr(v)} di luar rentang (ideal ${rg(batas)}).` }
}

// Kekuatan pola XABCD. Null untuk pola di luar kerangka XABCD (AB=CD, Three Drives).
export function kekuatanPola(row) {
  const p = row && POLA[row.pola]
  if (!p || !row.titik || row.titik.length < 4 || !row.prz) return null
  const [X, A, B, C, D] = row.titik.map(t => t.p)
  const menuju = row.status === 'menuju' || row.titik.length < 5 || row.titik[4]?.proyeksi
  // Rasio yang tidak dikirim (baris server lama) dihitung ulang dari titik; rasio yang ada tetap dipakai.
  // Server menamai rasio D Cypher dxc (klien: dc).
  const kirim = { ...row.rasio }
  if (kirim.dxc != null && kirim.dc == null) kirim.dc = kirim.dxc
  const r = { ...rasioXabcd(X, A, B, C, menuju ? null : D), ...kirim }
  const alasan = []
  const tambah = x => { if (x) alasan.push(x) }
  tambah(nilaiRasio('B', r.b, p.b))
  tambah(p.cx ? nilaiRasio('C (XC/XA)', r.cx, p.cx) : nilaiRasio('C', r.c, p.c))
  if (!menuju) {
    if (p.d) tambah(nilaiRasio('D', r.d, p.d))
    if (p.dc) tambah(nilaiRasio('D (CD/XC)', r.dc, p.dc))
    if (p.dbc) tambah(nilaiRasio('D (DC/BC)', r.dbc, p.dbc))
  }
  // AB=CD (Carney: syarat minimum). D belum terbentuk: dihitung untuk seluruh PRZ, apakah ada harga D yang memenuhi.
  if (p.abcd) {
    const ab = Math.abs(B - A)
    if (!menuju && r.cd != null) {
      const ok = jarak(r.cd, p.abcd) <= ABCD_TOL
      alasan.push(ok ? { ok: true, teks: `AB=CD terpenuhi: CD ${fr(r.cd)} kali AB (syarat ${rg(p.abcd)}).` }
        : { ok: false, berat: true, teks: `AB=CD belum terpenuhi: CD ${fr(r.cd)} kali AB (syarat ${rg(p.abcd)}).` })
    } else if (ab > 0) {
      const cd = row.prz.map(z => Math.round(Math.abs(z - C) / ab * 100) / 100).sort((a, b) => a - b)
      const ok = cd[1] >= p.abcd[0] * (1 - ABCD_TOL) && cd[0] <= p.abcd[1] * (1 + ABCD_TOL)
      alasan.push(ok ? { ok: true, teks: `Kalau D di PRZ, CD ${rg(cd)} kali AB: AB=CD bisa terpenuhi (syarat ${rg(p.abcd)}).` }
        : { ok: false, berat: true, teks: `Kalau D di PRZ, CD ${rg(cd)} kali AB: AB=CD tidak akan terpenuhi (syarat ${rg(p.abcd)}).` })
    }
  }
  // Fraksi harga BEI dibanding panjang kaki XA: saham berharga rendah membuat rasio meloncat per fraksi.
  const xa = Math.abs(A - X), fraksi = tick(Math.min(X, A, B, C))
  if (xa > 0) {
    const g = fraksi / xa
    alasan.push(g > KASAR_MAKS
      ? { ok: false, berat: true, teks: `Rasio kasar: satu fraksi harga (Rp${fraksi}) sama dengan ${fr(Math.round(g * 1000) / 10)}% kaki XA, jadi rasio bisa bergeser sekitar ${fr(Math.round(g * 100) / 100)} per fraksi.` }
      : { ok: true, teks: `Fraksi harga Rp${fraksi} kecil dibanding kaki XA (${fr(Math.round(g * 1000) / 10)}%): rasio cukup presisi.` })
  }
  // Jarak candle antartitik (Carney hal. 129: tiap kaki sebaiknya simetris): timpang = syarat berat, kurang = ringan.
  const jk = jarakKaki(row)
  if (jk) alasan.push({ ok: jk.tingkat === 'seimbang', berat: jk.tingkat === 'timpang', ringan: jk.tingkat === 'kurang', teks: jk.teks })
  // Titik yang bukan swing jelas (2 candle kiri-kanan) atau ayunan di bawah 5%: satu syarat berat untuk semuanya.
  if (row.swingLemah?.length) alasan.push({ ok: false, berat: true, teks: row.swingLemah.join(' ') })
  const berat = alasan.filter(a => a.berat).length, ringan = alasan.filter(a => a.ringan).length
  const poin = berat + ringan * 0.5
  const tingkat = poin === 0 ? 'kuat' : poin <= 1 ? 'sedang' : 'lemah'
  return { tingkat, nama: TINGKAT[tingkat].nama, ket: TINGKAT[tingkat].ket, alasan }
}

// Skenario lain: pola XABCD "menuju" yang tidak ada di daftar utama, misalnya PRZ-nya lebih jauh dari batas
// pemindai (25%, di sini sampai SKENARIO_MAKS). Gerak harga berikutnya
// yang menentukan skenario mana yang jadi.
export function skenarioLain(bars = [], utama = [], skala = SKALA_POLA.D, umurD = 30) {
  const n = bars.length
  if (n < 30) return []
  const akhir = bars[n - 1].c, ada = new Set(utama.map(r => r.kunci))
  const sama = r => utama.some(u => u.pola === r.pola && u.arah === r.arah && u.titik?.[0]?.p === r.titik[0].p && u.titik?.[2]?.p === r.titik[2].p)
  return cariXabcd(bars, skala, umurD, SKENARIO_MAKS)
    .filter(r => r.status === 'menuju' && !ada.has(r.kunci) && !sama(r))
    .map(r => {
      const bull = r.arah === 'bullish', tepi = bull ? r.prz[1] : r.prz[0]
      const geser = Math.round((tepi / akhir - 1) * 1000) / 10
      return { ...r, geser, jauh: Math.abs(akhir / tepi - 1) > MENUJU_MAKS, kekuatan: kekuatanPola(r),
        teks: `${r.nama} ${r.arah}: X ${fh(r.titik[0].p)}, PRZ ${fh(r.prz[0])}–${fh(r.prz[1])}, harga perlu ${geser < 0 ? 'turun' : 'naik'} sekitar ${fr(Math.abs(geser))}% dulu.` }
    })
    .sort((a, b) => Math.abs(a.geser) - Math.abs(b.geser))
    .filter((r, j, xs) => xs.findIndex(y => y.pola === r.pola && y.arah === r.arah && y.titik[0].i === r.titik[0].i) === j)
    .slice(0, 3)
}

// Titik pola otomatis untuk tab Tutorial (format tarikan manual: {n, i, p, sisi}). D proyeksi diganti D yang sedang
// berjalan bila ada (pola "menuju"), supaya C dinilai sampai sebelum D seperti di pemindai; tanpa itu D tidak ikut.
export function titikTutorial(row) {
  if (!row?.titik || !POLA[row.pola]) return []
  const bull = row.arah === 'bullish'
  return row.titik.map(t => t.proyeksi ? (t.jalan ? { n: t.n, ...t.jalan } : null) : t).filter(t => t && t.i != null).slice(0, 5)
    .map((t, j) => ({ n: t.n, i: t.i, p: t.p, sisi: (j % 2 === 0) === bull ? 'L' : 'H' }))
}
