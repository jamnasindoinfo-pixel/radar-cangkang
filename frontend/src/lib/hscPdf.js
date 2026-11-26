// Riset "IHSG tanpa saham HSC" (PDF, A4 tegak) dengan format yang sama seperti riset IHSG/Astronacci/Time Series:
// sampul, penggerak baru & skenario big-4 bank, kesimpulan, keranjang HSC vs non-HSC, daftar saham HSC, disclaimer.
// Data dari /api/hsc-analisa dan hsc.json (diambil segar saat tombol ditekan). Tanpa warna merah.
import { MUTED, GOOD, BAD, GOLD, frame, heading, para, block } from './ihsgPdf.js'
import { sampul, tabel, disclaimer } from './ihsgModelPdf.js'

const n0 = v => v == null || isNaN(v) ? '-' : Math.round(v).toLocaleString('id-ID')
const n2 = (v, d = 2) => v == null || isNaN(v) ? '-' : (+v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = v => v == null || isNaN(v) ? '-' : `${v > 0 ? '+' : ''}${n2(v, 1)}%`
const poin = v => v == null || isNaN(v) ? '-' : `${v > 0 ? '+' : ''}${n2(v, 1)}`
const warna = v => v == null ? undefined : v > 0 ? GOOD : v < 0 ? BAD : MUTED
const miliar = v => v == null ? '-' : `${v < 0 ? '-' : '+'}Rp${n2(Math.abs(v) / 1e9, 1)} M`

export async function hscPdf(a, h, hg, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const an = h.analisa || {}, b4 = a.bank4 || {}
  sampul(doc, {
    judul: 'IHSG tanpa Saham HSC', label: `BERLAKU ${String(h.berlaku || '2 November 2026').toUpperCase()} · KOMPOSISI BARU`,
    sub: an.ringkas || '', updated: a.updated, seri: [],
    box: [['IHSG', n0(a.ihsg)], ['Bobot big-4 bank', `${n2(b4.ke)}%`], ['1% big-4 bank', `~${n2(b4.sens, 1)} poin`], ['Saham HSC', `${(h.kode || []).length} emiten`]],
    catatan: 'Disusun otomatis dari daftar HSC BEI, harga harian saham (Stockbit), Pola Broker, dan estimasi bobot dari media. Bukan ajakan membeli atau menjual efek.',
  })

  // 2) Penggerak baru, skenario, dan kesimpulan.
  let page = 2
  doc.addPage(); frame(doc, 'Penggerak Baru IHSG', page, 'Riset HSC')
  heading(doc, 'Penggerak baru IHSG', 28)
  let y = para(doc, `Poin = bobot x perubahan harga x IHSG ${n0(a.ihsg)} (${a.ihsgSumber}). Bobot lama vs baru adalah estimasi; `
    + `arus asing dari Pola Broker bulan ${a.bulanBroker || '-'}.`, 14, 37, 182, 9, MUTED)
  y = tabel(doc, 14, y + 2, [{ t: 'Saham', w: 20 }, { t: 'Harga', w: 22, align: 'right' }, { t: 'Bobot', w: 30, align: 'right' }, { t: '1D', w: 16, align: 'right' },
    { t: '1W', w: 16, align: 'right' }, { t: '1M', w: 16, align: 'right' }, { t: 'Poin 1W', w: 22, align: 'right' }, { t: 'Asing (bln)', w: 40, align: 'right' }],
  (a.penggerak || []).map(x => [{ t: x.t + (x.turunan ? '*' : ''), bold: true }, n0(x.harga), `${n2(x.dari)}% → ${n2(x.ke)}%`,
    { t: pct(x.ret.d), color: warna(x.ret.d) }, { t: pct(x.ret.w), color: warna(x.ret.w) }, { t: pct(x.ret.m), color: warna(x.ret.m) },
    { t: poin(x.poin.w), color: warna(x.poin.w) }, { t: x.arus ? miliar(x.arus.asing) : '-', color: warna(x.arus?.asing) }]), 8.5)
  y = para(doc, `Big-4 bank (${(b4.kode || []).join(', ')}): bobot ${n2(b4.dari)}% → ${n2(b4.ke)}%; kinerja tertimbang 1D ${pct(b4.ret?.['1D'])}, `
    + `1W ${pct(b4.ret?.['1W'])}, 1M ${pct(b4.ret?.['1M'])}. * Bobot BBNI diturunkan dari total big-4 bank.`, 14, y, 182, 8.5, MUTED)

  heading(doc, 'Skenario big-4 bank', y + 6, 15); y += 15
  y = tabel(doc, 14, y, [{ t: 'Gerak big-4 bank', w: 60 }, { t: 'Dampak ke IHSG', w: 60, align: 'right' }, { t: 'Level IHSG', w: 62, align: 'right' }],
    (a.skenario || []).map(s => [`${s.gerak > 0 ? '+' : ''}${s.gerak}%`, { t: `${poin(s.poin)} poin`, color: warna(s.poin) }, n0(s.level)]), 9)

  heading(doc, 'Kesimpulan', y + 6, 15); y += 15
  for (const k of a.kesimpulan || []) {
    doc.setFillColor(k.nada === 'naik' ? GOOD : k.nada === 'turun' ? BAD : MUTED); doc.circle(17, y - 1.3, 1.3, 'F')
    y = para(doc, k.teks, 21, y, 175, 9.5) - 1
  }

  // 3) Analisa naratif dan estimasi IHSG tanpa HSC.
  doc.addPage(); frame(doc, 'Analisa', ++page, 'Riset HSC')
  heading(doc, 'Analisa dampak', 28); y = 40
  for (const n of a.narasi || []) {
    if (y > 250) { doc.addPage(); frame(doc, 'Analisa', ++page, 'Riset HSC'); y = 28 }
    y = block(doc, n.judul, n.teks || (n.poin || []).map(p => '- ' + p).join('\n'), y) + 2
  }
  if (a.exHsc?.length) {
    if (y > 220) { doc.addPage(); frame(doc, 'Analisa', ++page, 'Riset HSC'); y = 22 }
    heading(doc, 'Estimasi IHSG tanpa HSC', y + 6, 15); y += 15
    y = tabel(doc, 14, y, [{ t: 'Periode', w: 30 }, { t: 'IHSG aktual', w: 38, align: 'right' }, { t: 'Median HSC', w: 38, align: 'right' },
      { t: 'Estimasi ex-HSC', w: 40, align: 'right' }, { t: 'Selisih', w: 36, align: 'right' }],
    a.exHsc.map(x => [{ t: x.periode, bold: true }, { t: pct(x.ihsg), color: warna(x.ihsg) }, { t: pct(x.hsc), color: warna(x.hsc) },
      { t: pct(x.ex), color: warna(x.ex), bold: true }, { t: `${poin(x.selisih)} pp`, color: warna(x.selisih) }]), 9)
    y = para(doc, `ex-HSC = (IHSG - ${a.bobotHsc}% x median HSC) / ${100 - a.bobotHsc}%. Median dipakai sebagai proksi kinerja HSC karena kapitalisasi tiap saham belum tersedia; hasilnya perkiraan arah.`, 14, y, 182, 8.5, MUTED)
  }

  // 4) Keranjang HSC vs non-HSC, sektor, asing, sorotan, dan catatan sumber.
  doc.addPage(); frame(doc, 'Keranjang HSC', ++page, 'Riset HSC')
  heading(doc, 'Saham HSC vs non-HSC', 28)
  y = para(doc, 'Median perubahan harga dan persentase saham yang naik per periode (data harian terakhir).', 14, 37, 182, 9, MUTED)
  const kh = a.keranjang?.hsc || {}, kn = a.keranjang?.non || {}
  y = tabel(doc, 14, y + 2, [{ t: 'Periode', w: 30 }, { t: 'Median HSC', w: 38, align: 'right' }, { t: 'Median non-HSC', w: 38, align: 'right' },
    { t: 'HSC naik', w: 38, align: 'right' }, { t: 'Non-HSC naik', w: 38, align: 'right' }],
  ['1D', '1W', '1M', 'YTD'].map(p => [{ t: p, bold: true }, { t: pct(kh[p]?.median), color: warna(kh[p]?.median) }, { t: pct(kn[p]?.median), color: warna(kn[p]?.median) },
    `${kh[p]?.naik ?? '-'}% (${kh[p]?.n ?? 0})`, `${kn[p]?.naik ?? '-'}% (${kn[p]?.n ?? 0})`]), 9)
  const daftar = xs => (xs || []).map(x => `${x.t} ${pct(x.m)}`).join(', ')
  y = block(doc, 'Saham HSC paling turun sebulan', daftar(a.terburuk), y + 4)
  y = block(doc, 'Saham HSC paling naik sebulan', daftar(a.terbaik), y + 2)
  if (a.sorot?.length) y = block(doc, 'Sorotan bobot besar', daftar(a.sorot), y + 2)
  const uang = xs => (xs || []).map(x => `${x.t} ${miliar(x.asing)}`).join(', ') || '-'
  if (a.asingBeli?.length || a.asingJual?.length) {
    y = block(doc, `Asing net beli terbesar di saham HSC (${a.bulanBroker})`, uang(a.asingBeli), y + 2)
    y = block(doc, `Asing net jual terbesar di saham HSC (${a.bulanBroker})`, uang(a.asingJual), y + 2)
  }
  const baruAn = () => { doc.addPage(); frame(doc, 'Keranjang HSC', ++page, 'Riset HSC'); return 22 }
  if (a.sektor?.length) {
    if (y > 230) y = baruAn()
    heading(doc, 'Sektor saham HSC', y + 6, 15); y += 15
    y = tabel(doc, 14, y, [{ t: 'Sektor', w: 50 }, { t: 'Emiten', w: 18, align: 'right' }, { t: 'Median 1M', w: 24, align: 'right' }, { t: 'Kode', w: 90 }],
      a.sektor.map(s => [{ t: s.sektor, bold: true }, String(s.n), { t: pct(s.m), color: warna(s.m) }, s.kode.join(', ')]), 8, { baru: baruAn })
  }
  if (y > 240) y = baruAn()
  heading(doc, 'Catatan sumber', y + 6, 15); y += 15
  for (const t of [...(an.fakta || []), ...(an.implikasi || [])]) {
    doc.setFillColor(GOLD); doc.circle(17, y - 1.3, 1.1, 'F')
    y = para(doc, t, 21, y, 175, 9) - 1
  }

  // 4) Daftar saham HSC (urut alfabet) dengan harga terakhir.
  const baru = () => { doc.addPage(); frame(doc, 'Daftar Saham HSC', ++page, 'Riset HSC'); return 22 }
  y = baru()
  heading(doc, `Daftar ${(h.kode || []).length} saham HSC`, y + 6); y += 16
  tabel(doc, 14, y, [{ t: 'No', w: 12, align: 'right' }, { t: 'Kode', w: 20 }, { t: 'Nama perusahaan', w: 100 }, { t: 'Harga', w: 25, align: 'right' }, { t: '1D', w: 25, align: 'right' }],
    [...(h.kode || [])].sort().map((t, i) => [String(i + 1), { t, bold: true }, h.nama?.[t] || '-', n0(hg[t]?.h), { t: pct(hg[t]?.d), color: warna(hg[t]?.d) }]),
    8.5, { baru })

  disclaimer(doc, ++page, a.updated, 'Bobot indeks adalah estimasi media sebelum publikasi resmi BEI; kontribusi poin dihitung sederhana (bobot x perubahan harga) dan mengabaikan perubahan bobot harian.')
  return doc
}

export const hscPdfName = () => `Riset-IHSG_Tanpa-HSC_${new Date().toISOString().slice(0, 10)}.pdf`
