// Kuis hafalan pola harmonik. Angka diambil langsung dari POLA (harmonikAlat.js) supaya soal selalu sama
// dengan aturan pemindai. Semua fungsi murni; rng bisa diganti untuk tes.
import { POLA, STOP_PRZ, diagramIdeal } from './harmonikAlat.js'

export const TINGKAT = {
  utama: { nama: '4 pola utama', pola: ['gartley', 'bat', 'butterfly', 'crab'] },
  semua: { nama: '6 pola', pola: ['gartley', 'bat', 'altbat', 'butterfly', 'crab', 'deepcrab'] },
}
export const JUMLAH_SOAL = 10

// Kalimat pengingat, sama dengan materi "Cara menghafal" (Gartley 6→7, Bat 5→8, Butterfly 7→1,27, Crab 6→1,6).
export const PENGINGAT = {
  gartley: 'Gartley 6→7: B 0,618, D 0,786. D belum sampai X.',
  bat: 'Bat 5→8: B paling dalam 0,5, D 0,886. Hampir sampai X, tapi belum lewat.',
  altbat: 'Alternate Bat: B 0,382, D 1,13. Bat yang kebablasan sedikit melewati X.',
  butterfly: 'Butterfly 7→1,27: B 0,786 (angka D Gartley), D 1,27 sampai 1,414. Lewat X.',
  crab: 'Crab 6→1,6: B 0,382–0,618, D 1,618. Lewat X paling jauh.',
  deepcrab: 'Deep Crab: B 0,886 (angka D Bat), D 1,618. Crab dengan B yang dalam.',
}

const JENIS = ['namaDariAngka', 'dDariNama', 'bDariNama', 'gambar', 'lewatX', 'stop']

export const angka = v => String(v).replace('.', ',')
export const rentang = ([lo, hi]) => lo === hi ? angka(lo) : `${angka(lo)}–${angka(hi)}`
export const lewatX = k => POLA[k].d[0] > 1

function acak(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Pilihan: jawaban benar + pengecoh berbeda teks, maksimal 4, diacak. Kembalikan { pilihan, benar }.
function susun(jawab, pengecoh, rng, maks = 4) {
  const lain = acak([...new Set(pengecoh)].filter(t => t !== jawab), rng).slice(0, maks - 1)
  const pilihan = acak([jawab, ...lain], rng)
  return { pilihan, benar: pilihan.indexOf(jawab) }
}

// Satu soal untuk pola k dengan jenis tertentu. kumpulan = pola yang boleh jadi pengecoh.
export function soal(k, jenis, kumpulan, rng = Math.random) {
  const p = POLA[k], lain = kumpulan.filter(x => x !== k)
  const dasar = { pola: k, jenis, pengingat: PENGINGAT[k] }
  if (jenis === 'namaDariAngka') {
    return { ...dasar, tanya: `B ${rentang(p.b)} XA dan D ${rentang(p.d)} XA. Pola apa?`,
      ...susun(p.nama, lain.map(x => POLA[x].nama), rng) }
  }
  if (jenis === 'gambar') {
    const d = diagramIdeal(k, rng() < 0.5 ? 'bullish' : 'bearish')
    return { ...dasar, tanya: 'Bentuk ini pola apa? (angka disembunyikan)',
      diagram: { ...d, garis: d.garis.map(g => ({ ...g, teks: '' })) },
      ...susun(p.nama, lain.map(x => POLA[x].nama), rng) }
  }
  if (jenis === 'dDariNama') {
    return { ...dasar, tanya: `Pada pola ${p.nama}, D berada di berapa XA?`,
      ...susun(rentang(p.d), kumpulan.map(x => rentang(POLA[x].d)), rng) }
  }
  if (jenis === 'bDariNama') {
    return { ...dasar, tanya: `Pada pola ${p.nama}, B berada di berapa XA?`,
      ...susun(rentang(p.b), kumpulan.map(x => rentang(POLA[x].b)), rng) }
  }
  if (jenis === 'lewatX') {
    const pilihan = ['Di dalam X, belum melewati X', 'Melewati X']
    return { ...dasar, tanya: `Pada pola ${p.nama}, di mana titik D?`, pilihan, benar: lewatX(k) ? 1 : 0 }
  }
  if (jenis === 'stop') {
    const pilihan = ['Sedikit di luar titik X', 'Sedikit di luar sisi jauh PRZ']
    return { ...dasar, tanya: `Pada pola ${p.nama}, stop loss dipasang di mana?`, pilihan,
      benar: STOP_PRZ.has(k) ? 1 : 0,
      pengingat: PENGINGAT[k] + (STOP_PRZ.has(k) ? ' D sudah lewat X, jadi stop di luar PRZ.' : ' Stop di luar X.') }
  }
  return null
}

// Satu putaran: n soal, pola dan jenis disebar rata lalu diacak; tidak ada pasangan pola+jenis yang kembar.
export function buatSoal(rng = Math.random, tingkat = 'utama', n = JUMLAH_SOAL) {
  const pola = TINGKAT[tingkat]?.pola || TINGKAT.utama.pola
  const pasangan = acak(pola.flatMap(k => JENIS.map(j => [k, j])), rng)
  const out = [], hitungPola = {}, hitungJenis = {}
  const batasPola = Math.ceil(n / pola.length), batasJenis = Math.ceil(n / JENIS.length)
  for (const [k, j] of pasangan) {
    if (out.length >= n) break
    if ((hitungPola[k] || 0) >= batasPola || (hitungJenis[j] || 0) >= batasJenis) continue
    hitungPola[k] = (hitungPola[k] || 0) + 1
    hitungJenis[j] = (hitungJenis[j] || 0) + 1
    out.push(soal(k, j, pola, rng))
  }
  // Cadangan bila batas sebaran membuat soal kurang: isi dari pasangan yang belum terpakai.
  for (const [k, j] of pasangan) {
    if (out.length >= n) break
    if (!out.some(q => q.pola === k && q.jenis === j)) out.push(soal(k, j, pola, rng))
  }
  return out
}

// Putaran ulang hanya dari soal yang salah: pola dan jenis sama, pilihan diacak ulang.
export function ulangSoal(salah = [], rng = Math.random, tingkat = 'utama') {
  const pola = TINGKAT[tingkat]?.pola || TINGKAT.utama.pola
  return acak(salah, rng).map(s => soal(s.pola, s.jenis, pola, rng))
}

// Nilai akhir dan pola yang paling sering salah (urut dari yang terbanyak). jawaban: soal + { dipilih, tepat }.
export function rekap(jawaban = []) {
  const benar = jawaban.filter(j => j.tepat).length
  const salahPer = {}
  for (const j of jawaban) if (!j.tepat) salahPer[j.pola] = (salahPer[j.pola] || 0) + 1
  const lemah = Object.entries(salahPer).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, nama: POLA[k].nama, n }))
  return { benar, total: jawaban.length, persen: jawaban.length ? Math.round(benar / jawaban.length * 100) : 0, lemah }
}
