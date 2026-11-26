// Logika murni untuk fitur emiten tambahan: aset injeksi & KJPP (aset-verified.json), profil pengendali
// (profil-pengendali.json), bagan mekanisme transaksi, simulasi nilai KJPP, kelebihan/kekurangan, dan sudut pandang.
import { big, fmt, progressOf, rp, x2 } from './domain.js'
import { cycleModel, daysSince, dayTxt, phaseName, phaseOf } from './cycle.js'
import { KURS, nominalRp, sentences } from './analysis.js'

const RED_RE = /(dilusi|dilutif|leverage|tanpa RUPS|deportasi|gagal kuorum|ekuitas (induk )?negatif|tidak jelas|bertentangan|ditahan OJK|OJK (sedang )?(memeriksa|menahan)|suspensi|diskon|utang pemegang saham|tanpa penjelasan|tersangka|red flag)/i
const GOOD_RE = /(strategic buyer|pembeli strategis|akuisisi strategis|tercatat di LSE|bayar tunai|tunai di harga sekitar pasar|aset riil|kredibel|Sinar Mas|Grup Astra|FrieslandCampina)/i
const NEG_GOOD = /(tidak|kurang|belum|bukan) (\w+ )?kredibel/i
const VERIFIED = /terverifikasi/i
// Potong teks di batas kata, tambahkan elipsis bila terpotong.
export const clip = (t, n) => { t = String(t || ''); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(' ') > n * 0.6 ? c.lastIndexOf(' ') : n).replace(/[\s,;:.]+$/, '') + '…' }

// ---------- KJPP & valuasi ringkas ----------

// Status KJPP → label + nada (penilaian = tint semantik).
export function kjppStatus(k) {
  if (k?.status === 'terbit') return { id: 'terbit', label: 'Penilaian KJPP terbit', tone: 'good' }
  if (k?.status === 'ditunjuk') return { id: 'ditunjuk', label: 'KJPP ditunjuk, laporan belum terbit', tone: 'warn' }
  return { id: 'belum', label: 'Belum ada penilaian KJPP', tone: 'strong' }
}

// Nilai transaksi dalam rupiah: angka terverifikasi aset dulu, lalu teks nominal story.
export const txValue = (aset, sv) => aset?.transaksi?.nilaiRp ?? nominalRp(sv?.nominal) ?? null

// Ringkasan untuk kartu Story: sektor aset, kelipatan terhadap kapitalisasi, status KJPP.
export function storyValuation(aset, { sv, mcapRp } = {}) {
  if (!aset) return null
  const val = txValue(aset, sv)
  return { sektor: aset.aset?.sektor || '', val, ratio: val && mcapRp ? val / mcapRp : null, kjpp: kjppStatus(aset.kjpp) }
}

// ---------- Mekanisme transaksi ----------

// Jenis mekanisme dibaca dari cara bayar & jenis injeksi terverifikasi.
export function mechOf(aset, sv) {
  const s = `${aset?.transaksi?.caraBayar || ''} ${sv?.injectType || ''} ${sv?.note || ''}`.toLowerCase()
  if (/merger|penggabungan/.test(s)) return 'merger'
  if (/konversi utang|dikonversi|pmthmetd.*utang|utang.*konversi/.test(s)) return 'konversi'
  if (/inbreng|tukar saham|share swap|selain uang/.test(s)) return 'inbreng'
  if (/hmetd|rights|pmhmetd|penempatan terbatas|private placement/.test(s)) return 'rights'
  return 'tunai'
}
export const MECH_LABEL = {
  inbreng: 'Inbreng (tukar saham)', merger: 'Merger (penggabungan usaha)', konversi: 'Konversi utang menjadi saham',
  rights: 'Dana HMETD/penempatan terbatas untuk membeli aset', tunai: 'Pembelian tunai',
}

const head = (s, n, re = /[(;]/) => String(s || '').split(re)[0].trim().slice(0, n)

// Bagan alur sebagai data geometri (viewBox 900×250): kotak pihak dan panah berlabel.
// Label panah dipecah per " · " menjadi beberapa baris. cls: em (emiten), as (aset), pub (publik); back/dash untuk panah.
export function flowOf({ t, mech, aset, sv, ctrlName, owner, hargaPelaksanaan, pubText }) {
  const asetNm = head(aset?.aset?.nama || sv?.injectTarget || 'Aset target', 34)
  const porsi = head(aset?.aset?.porsi, 18)
  const nilai = aset?.transaksi?.nilaiRp ? big(aset.transaksi.nilaiRp) : head(sv?.nominal || 'nilai belum disebut', 22, /\s\(/)
  const harga = hargaPelaksanaan ? '@' + rp(hargaPelaksanaan) : ''
  const ctrl = head(ctrlName || 'Pengendali', 34, /[(,;]/)
  const B = (x, y, w, t1, t2, cls = '') => ({ x, y, w, t1, t2, cls })
  const A = (x1, y1, x2, y2, lbl, cls = '') => ({ x1, y1, x2, y2, lines: String(lbl).split(' · ').filter(Boolean), cls })
  const pub = pubText || ''
  if (mech === 'inbreng') return {
    boxes: [B(10, 20, 210, 'Pemilik ' + asetNm.replace(/^PT\s+/i, '').slice(0, 22), owner || 'pemegang saham aset target'),
      B(345, 20, 210, t, 'emiten (perseroan)', 'em'), B(680, 20, 210, asetNm, porsi || 'aset target', 'as'),
      B(345, 170, 210, 'Pemegang saham publik', pub || 'hak HMETD', 'pub')],
    arrows: [A(220, 38, 345, 38, `serahkan saham ${porsi || 'aset'} · ${nilai}`), A(345, 62, 220, 62, `saham baru ${harga}`.trim(), 'back'),
      A(555, 47, 680, 47, 'menjadi anak usaha'), A(450, 170, 450, 74, 'tebus HMETD atau terdilusi', 'dash')],
  }
  if (mech === 'merger') return {
    boxes: [B(20, 20, 260, asetNm, 'perusahaan yang melebur', 'as'), B(380, 20, 230, t, 'perusahaan penerima', 'em'),
      B(20, 170, 260, 'Pemegang saham ' + asetNm.slice(0, 14), owner || ctrl), B(380, 170, 230, 'Pemegang saham publik', pub || 'terdilusi saham baru', 'pub')],
    arrows: [A(280, 47, 380, 47, `melebur · ${nilai}`), A(495, 74, 230, 170, 'terima saham baru ' + t, 'back'), A(495, 170, 495, 74, 'kepemilikan terdilusi', 'dash')],
  }
  if (mech === 'konversi') return {
    boxes: [B(10, 20, 210, 'Afiliasi pengendali', ctrl), B(345, 20, 210, t, 'emiten (perseroan)', 'em'),
      B(680, 20, 210, asetNm, porsi || 'aset afiliasi', 'as'), B(345, 170, 210, 'Pemegang saham publik', pub || 'terdilusi', 'pub')],
    arrows: [A(220, 38, 345, 38, `jual aset · ${nilai} · (jadi utang)`), A(345, 62, 220, 62, `utang dikonversi · saham ${harga}`.trim(), 'back'),
      A(555, 47, 680, 47, 'dikonsolidasi'), A(450, 170, 450, 74, 'tanpa hak tebus', 'dash')],
  }
  const sumber = mech === 'rights' ? 'dana HMETD / penempatan terbatas'
    : /(pinjaman|utang)/i.test(aset?.transaksi?.caraBayar || '') ? 'pinjaman pengendali/bank' : 'kas perseroan'
  const boxes = [B(10, 20, 210, 'Sumber dana', sumber), B(345, 20, 210, t, 'emiten (perseroan)', 'em'),
    B(680, 20, 210, 'Penjual aset', owner || 'pemilik lama ' + asetNm.slice(0, 16)), B(680, 170, 210, asetNm, porsi || 'aset target', 'as')]
  const arrows = [A(220, 47, 345, 47, 'dana masuk'), A(555, 38, 680, 38, `bayar · ${nilai}`),
    A(680, 62, 555, 62, porsi ? `serahkan saham · ${porsi}` : 'serahkan saham', 'back'), A(450, 74, 680, 190, 'menjadi anak usaha', 'dash')]
  if (mech === 'rights') {
    boxes.push(B(345, 170, 210, 'Pemegang saham publik', pub || 'tebus HMETD atau terdilusi', 'pub'))
    arrows.push(A(450, 170, 450, 74, 'setor dana atau terdilusi', 'dash'))
  }
  return { boxes, arrows }
}

// Langkah transaksi injeksi beserta status dari tonggak item.
export function injSteps(mech, { sv, ms = {} } = {}) {
  return [
    ['Perjanjian (CSPA/PPJB) aset', !!sv?.injectType],
    ['Penilaian KJPP terbit', !!ms.kjpp],
    ['RUPS (independen) menyetujui', !!ms.rupslb],
    [mech === 'inbreng' || mech === 'rights' ? 'Pernyataan efektif & pelaksanaan HMETD' : mech === 'konversi' ? 'Konversi utang jadi saham' : 'Pembayaran / penyelesaian', !!(ms.rights || ms.inbreng)],
    ['Aset menjadi anak usaha (efektif)', !!ms.inbreng],
    ['Terkonsolidasi di laporan keuangan', !!ms.bisnis],
  ].map(([t, done]) => ({ t, done }))
}

// ---------- Simulasi nilai KJPP ----------

export const pctOf = s => { const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*%/); return m ? parseFloat(m[1].replace(',', '.')) : null }
// Rupiah → Rp miliar (1 desimal) untuk isian.
export const toM = v => v == null ? null : Math.round(v / 1e8) / 10

// Faktor penyetahunan laba/pendapatan dari keterangan periode ("1H 2026" ×2, "7 bulan" ×12/7, "Kuartal I" ×4).
export function annualFactor(periode) {
  const s = String(periode || '').toLowerCase()
  const bln = s.match(/(\d{1,2})\s*bulan/)
  if (bln) return 12 / +bln[1]
  if (/1h|semester i\b|h1/.test(s)) return 2
  if (/kuartal i\b|q1|kuartal pertama/.test(s)) return 4
  if (/9m|kuartal iii/.test(s)) return 4 / 3
  return 1
}

// Juta ton dari teks cadangan/sumber daya.
const mt = s => { const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*juta\s*(?:MT|ton|metrik)/i); return m ? parseFloat(m[1].replace(',', '.')) : null }
export function reservesOf(tambang) {
  const c = mt(tambang?.cadangan), r = mt(tambang?.sumberDaya)
  return c != null ? { mt: c, kind: 'cadangan' } : r != null ? { mt: r, kind: 'sumber daya' } : null
}

export const median = arr => {
  const s = arr.filter(x => x > 0 && isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Kelipatan pembanding dari profil Stockbit; nilai ekstrem dibuang.
export function peerMultiples(profiles) {
  const ps = profiles.filter(Boolean)
  return {
    n: ps.length,
    per: median(ps.map(p => p.metrics?.per).filter(x => x > 0 && x < 100)),
    ps: median(ps.map(p => p.stats?.marketCap && p.metrics?.revenueTtm > 0 ? p.stats.marketCap / p.metrics.revenueTtm : null).filter(x => x > 0 && x < 50)),
    pbv: median(ps.map(p => p.metrics?.pbv).filter(x => x > 0 && x < 30)),
  }
}

// Keterangan sumber kelipatan pembanding untuk slide simulasi. peersOk = pembanding yang profilnya terbaca;
// di versi publik profil di luar radar ditolak, jadi daftar ini bisa kosong walau pembanding sudah ditentukan.
export function peerNote({ peers = [], peersOk = [] } = {}) {
  if (!peers.length) return 'Kelipatan pembanding: belum ditentukan.'
  if (!peersOk.length) return `Kelipatan pembanding: data ${peers.join(', ')} tidak tersedia, jadi tidak dipakai.`
  const miss = peers.filter(p => !peersOk.includes(p))
  return `Kelipatan pembanding: median ${peersOk.length} emiten (${peersOk.join(', ')})` + (miss.length ? `; data ${miss.join(', ')} tidak tersedia.` : '.')
}

// Acuan nilai cadangan in-situ (USD per ton cadangan) dari transaksi akuisisi tambang sejenis di Indonesia.
// Perkiraan kasar dan konservatif; dipakai otomatis agar simulasi tidak bergantung pada isian manual.
export function autoUsdTon(aset) {
  const a = aset?.aset || {}, tb = a.tambang || {}, s = `${a.sektor || ''} ${a.nama || ''} ${tb.kalori || ''} ${tb.cadangan || ''}`.toLowerCase()
  if (/batu ?bara|coal/.test(s)) {
    const kal = +((String(tb.kalori || '').match(/(\d[\d.]{2,})\s*kkal/) || [])[1] || '').replace(/\./g, '') || null
    if (/kokas|coking|metalurgi/.test(s) || kal >= 6500) return { v: 3, note: 'acuan transaksi batu bara kalori tinggi/kokas ±USD3/ton' }
    if (kal >= 5000 || /> ?5\.000/.test(s)) return { v: 1.5, note: 'acuan transaksi batu bara kalori menengah ±USD1,5/ton' }
    return { v: 0.8, note: 'acuan transaksi batu bara kalori rendah ±USD0,8/ton' }
  }
  if (/nikel|nickel/.test(s)) return { v: 2, note: 'acuan transaksi bijih nikel ±USD2/ton' }
  if (/bauksit|bijih besi|iron ore/.test(s)) return { v: 1, note: 'acuan transaksi bijih mineral ±USD1/ton' }
  return null
}

// Nilai awal simulasi (Rp miliar per tahun, laba/pendapatan parsial disetahunkan). Semua otomatis dari data aset;
// kelipatan pembanding diisi dari median emiten pembanding Stockbit (peerMultiples) oleh pemanggil.
export function simDefaults(aset, sv) {
  const fin = aset?.aset?.keuangan || {}, af = annualFactor(fin.periode), ann = v => v == null ? null : v * af
  const res = reservesOf(aset?.aset?.tambang), ut = res ? autoUsdTon(aset) : null
  return {
    tx: toM(txValue(aset, sv)), porsi: pctOf(aset?.aset?.porsi) ?? pctOf(sv?.injectTarget) ?? 100,
    laba: toM(ann(fin.labaBersih)), pend: toM(ann(fin.pendapatan)), eq: toM(fin.ekuitas),
    res: res?.mt ?? null, usdTon: ut?.v ?? null, usdTonNote: ut?.note || '', per: null, ps: null, pbv: null, af,
  }
}

// Meniru tiga pendekatan penilai (laba × PER, pendapatan × P/S, ekuitas × PBV) plus nilai per ton cadangan.
// Isian dalam Rp miliar; hasil dalam rupiah. Rentang ±25% di sekitar median pendekatan.
export function simKjpp(i) {
  const n = v => (v === '' || v == null || isNaN(+v)) ? null : +v
  const tx = n(i.tx), por = (n(i.porsi) ?? 100) / 100, laba = n(i.laba), pend = n(i.pend), eq = n(i.eq)
  const per = n(i.per), ps = n(i.ps), pbv = n(i.pbv), res = n(i.res), usdTon = n(i.usdTon)
  const rows = [
    ['Pendekatan pasar, laba', laba > 0 && per ? laba * per : null, `laba Rp${fmt(laba, 1)} M × PER ${fmt(per, 1)}×`],
    ['Pendekatan pasar, pendapatan', pend > 0 && ps ? pend * ps : null, `pendapatan Rp${fmt(pend, 1)} M × P/S ${fmt(ps, 2)}×`],
    ['Pendekatan aset, nilai buku', eq > 0 && pbv ? eq * pbv : null, `ekuitas Rp${fmt(eq, 1)} M × PBV ${fmt(pbv, 2)}×`],
    ['Pendekatan cadangan, nilai per ton', res > 0 && usdTon > 0 ? res * 1e6 * usdTon * KURS.USD / 1e9 : null, `${fmt(res, 1)} juta ton × USD${fmt(usdTon, 2)}/ton`],
  ].filter(r => r[1] != null).map(([k, v, how]) => ({ k, how, v: v * por * 1e9 }))
  // Harga tersirat per ton dari nilai transaksi: pembanding cepat antar-transaksi tambang.
  const implied = tx > 0 && res > 0 ? (tx * 1e9) / (res * 1e6 * por) : null
  if (!rows.length) return { rows, implied, por, tx: tx ? tx * 1e9 : null, mid: null }
  const mid = median(rows.map(r => r.v)), prem = tx ? (tx * 1e9) / mid - 1 : null
  const verdict = prem == null ? { t: 'Nilai transaksi belum diumumkan', tone: 'warn' }
    : prem > 0.15 ? { t: `Transaksi ${Math.round(prem * 100)}% di atas simulasi. Mahal, risiko dilusi bagi publik.`, tone: 'strong' }
    : prem < -0.15 ? { t: `Transaksi ${Math.round(-prem * 100)}% di bawah simulasi. Murah, menguntungkan pemegang saham publik.`, tone: 'good' }
    : { t: 'Transaksi dalam kisaran wajar simulasi (±15%)', tone: 'good' }
  return { rows, implied, por, tx: tx ? tx * 1e9 : null, mid, lo: mid * 0.75, hi: mid * 1.25, prem, verdict,
    conf: rows.length >= 3 ? 'tinggi' : rows.length === 2 ? 'sedang' : 'rendah' }
}

// Kalkulator dilusi: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.
// S0 saham sekarang, E0 ekuitas (Rp), f porsi publik (0..1), V nilai dibayar dengan saham (Rp), C kas segar (Rp),
// P harga pelaksanaan, tk porsi publik yang menebus (0..1), h porsi nilai aset yang diakui (0..1).
export function dilusi({ S0, E0 = 0, f = 0, V = 0, C = 0, P, tk = 0, h = 1 }) {
  if (!P || !S0) return null
  const N = (V + C) / P, S1 = S0 + N
  return { N, S0, S1, f, pubAfter: (S0 * f + Math.min(1, tk) * f * N) / S1, vps: ((E0 || 0) + V * h + C) / S1 }
}

// ---------- Kelebihan vs kekurangan ----------

const riskText = p => sentences(p.risiko).filter(s => !/^tidak (ditemukan|ada)\b/i.test(s.trim())).join(' ').replace(/^Catatan:\s*/i, '')
const dedupe = arr => arr.filter((x, i) => x && arr.findIndex(y => y.t === x.t) === i).slice(0, 7)

// Hubungan penjual aset dengan pengendali: 'afiliasi' | 'kritis' | null.
export function relationTone(hub) {
  const h = String(hub || '')
  if (!/^\s*tidak terafiliasi/i.test(h) && /(?<!tidak )terafiliasi|afiliasi langsung|pengendali yang sama|milik pengendali/i.test(h)) return 'afiliasi'
  if (/catatan kritis/i.test(h)) return 'kritis'
  return null
}

// Fase siklus emiten ini dari benchmark (bm = /api/benchmark). null bila belum ada PTW atau kurva siklus.
export function cycleOf(a, { bm, aset, verified = {}, now = Date.now() } = {}) {
  if (!bm || !a.d?.tender?.start) return null
  const model = cycleModel(bm)
  if (!model.pts.length) return null
  const ms = progressOf(a.d, { aset: aset ? { [a.t]: aset } : {}, verified }).ms
  return { model, ph: phaseOf(a.d, model, { ms, verified, now }), day: daysSince(a.d.tender.start, now) }
}

// Sintesis dari skor dimensi, profil pengendali, aset & KJPP, dilusi, posisi harga, insider, likuiditas, HSC.
// a = hasil buildAnalysis.
export function analysisProsCons(a, { profil, aset, hsc = [], bm, verified, now } = {}) {
  const pros = [], cons = [], D = Object.fromEntries((a.dims || []).map(x => [x.k, x]))
  const k = aset?.kjpp || {}, dl = a.pa?.dilusi || {}
  if (D.Pengendali?.s >= 6.5) pros.push({ t: 'Pengendali kredibel', d: D.Pengendali.why.join(' ') })
  else if (D.Pengendali?.s <= 4) cons.push({ t: 'Kredibilitas pengendali lemah', d: D.Pengendali.why.join(' ') })
  const ver = (profil?.pengendali || []).flatMap(p => p.jaringan || []).filter(j => VERIFIED.test(j.keyakinan || ''))
  if (ver.length >= 2) pros.push({ t: 'Jaringan bisnis pengendali terverifikasi', d: ver.slice(0, 3).map(j => j.dengan).join(', ') })
  for (const p of profil?.pengendali || []) { const r = riskText(p); if (r) cons.push({ t: `Catatan risiko ${p.nama}`, d: clip(r, 180) }) }
  const hub = String(profil?.afiliasi?.hubungan || ''), rel = relationTone(hub)
  if (rel === 'afiliasi') cons.push({ t: 'Aset dibeli dari pihak afiliasi', d: clip(sentences(hub)[0], 180) })
  else if (rel === 'kritis') cons.push({ t: 'Struktur transaksi perlu dicermati', d: clip(hub.split(/catatan kritis:\s*/i)[1], 200) })
  const val = aset?.transaksi?.nilaiRp ?? a.injRp, ratio = val && a.mcap ? val / a.mcap : null
  const executed = !!(a.sv?.executed || a.d?.ms?.inbreng || a.d?.ms?.bisnis)
  if (ratio >= 1 && executed) pros.push({ t: `Aset besar sudah masuk (${x2(ratio)} kapitalisasi)`, d: 'Kelompok injeksi ≥Rp1 T yang tereksekusi median 2,24× harga saat PTW.' })
  else if (ratio >= 1) {
    pros.push({ t: `Potensi aset besar (${x2(ratio)} kapitalisasi)`, d: aset?.aset?.nama || a.sv?.injectTarget || '' })
    cons.push({ t: 'Injeksi belum dieksekusi', d: 'Injeksi besar yang baru diumumkan median 0,78× harga PTW sampai asetnya benar-benar masuk.' })
  } else if (ratio != null && ratio < 0.3) cons.push({ t: `Injeksi kecil (${x2(ratio)} kapitalisasi)`, d: 'Kelompok injeksi kecil median 0,68× harga PTW.' })
  if (k.status === 'terbit') pros.push({ t: 'Penilaian KJPP terbit', d: [k.nama, k.nilaiRp && big(k.nilaiRp)].filter(Boolean).join(' · ') })
  else if ((aset || a.sv?.injectType) && !executed) cons.push({
    t: k.status === 'ditunjuk' ? `Laporan KJPP belum terbit${k.nama ? ' (' + k.nama + ')' : ''}` : 'Belum ada penilai independen',
    d: 'Nilai aset belum diuji penilai independen; angka yang beredar masih klaim.',
  })
  if (dl.berlaku && dl.porsiPublikSetelah != null && dl.porsiPublikSekarang && dl.porsiPublikSetelah < dl.porsiPublikSekarang * 0.5)
    cons.push({ t: `Dilusi besar, publik ${fmt(dl.porsiPublikSekarang, 1)}% → ${fmt(dl.porsiPublikSetelah, 1)}%`, d: clip(String(dl.asumsi || ''), 150) })
  if (dl.nilaiPerSaham && a.price) {
    if (dl.nilaiPerSaham < a.price * 0.8) cons.push({ t: `Nilai per saham pasca-transaksi ${rp(dl.nilaiPerSaham)} di bawah harga ${rp(a.price)}`, d: 'Pasar sudah membayar di atas nilai buku hasil transaksi.' })
    else if (dl.nilaiPerSaham > a.price * 1.2) pros.push({ t: `Nilai per saham pasca-transaksi ${rp(dl.nilaiPerSaham)} di atas harga ${rp(a.price)}`, d: 'Bila aset bernilai sesuai klaim, transaksi akretif bagi publik.' })
  }
  const vsPtw = a.tender?.price && a.price ? a.price / a.tender.price : null
  if (vsPtw != null && vsPtw < 1) pros.push({ t: `Harga ${Math.round((1 - vsPtw) * 100)}% di bawah harga PTW`, d: 'Pengendali membayar lebih mahal dari pasar hari ini.' })
  if (vsPtw != null && vsPtw > 2) cons.push({ t: `Harga sudah ${x2(vsPtw)} harga PTW`, d: 'Optimisme besar sudah dibayar di muka.' })
  if (a.deal?.runupX >= 13) cons.push({ t: `Kenaikan pra-PTW ${x2(a.deal.runupX)}`, d: 'Kelompok ≥13× median 0,85× harga PTW sesudahnya.' })
  const isC = a.isCtrlH || (() => false), ctrlH = (a.holders || []).filter(isC), net = ctrlH.reduce((s, h) => s + (h.change || 0), 0)
  const moves = ctrlH.map(h => `${h.name}: ${fmt(h.from, 2)}% → ${fmt(h.to, 2)}%`).join('; ')
  if (net > 0.5 && ctrlH.some(h => h.from > 0)) pros.push({ t: 'Pengendali menambah porsi', d: moves })
  if (net < -1) cons.push({ t: 'Pengendali menjual saham', d: moves })
  const sellers = (a.holders || []).filter(h => !isC(h) && h.change <= -2)
  if (sellers.length) cons.push({ t: 'Pemegang besar lain melepas saham', d: sellers.slice(0, 2).map(h => `${h.name}: ${fmt(h.from, 2)}% → ${fmt(h.to, 2)}%`).join('; ') })
  if (a.avgVal != null) {
    if (a.avgVal < 5e8) cons.push({ t: `Likuiditas tipis (${big(a.avgVal)}/hari)`, d: 'Sulit keluar saat sentimen berbalik.' })
    else if (a.avgVal >= 5e9) pros.push({ t: `Likuid (${big(a.avgVal)}/hari)`, d: 'Posisi relatif mudah masuk dan keluar.' })
  }
  if (a.flt != null && a.flt < 7.5) cons.push({ t: `Porsi publik ${fmt(a.flt, 2)}%, wajib refloat`, d: 'Penjualan kembali saham biasanya dengan diskon.' })
  if (hsc.includes(a.t)) cons.push({ t: 'Termasuk saham HSC BEI', d: 'Kepemilikan terkonsentrasi tinggi; dikeluarkan dari perhitungan IHSG.' })
  if (D.Fundamental?.s >= 6.5) pros.push({ t: 'Fundamental berlaba', d: D.Fundamental.why.join(' ') })
  else if (D.Fundamental?.s <= 3) cons.push({ t: 'Fundamental lemah', d: D.Fundamental.why.join(' ') })
  const cy = cycleOf(a, { bm, aset, verified, now })
  if (cy) {
    const t = `Siklus: ${phaseName(cy.ph)}`
    if (cy.ph === 'inj') pros.push({ t, d: 'Nilai kini ditentukan kualitas aset yang masuk.' })
    if (cy.ph === 'bawah') pros.push({ t, d: 'Risiko turun relatif terbatas bila rencana pengendali tetap berjalan.' })
    if (cy.ph === 'euf') cons.push({ t, d: 'Harga di atas kuartil 3 kasus serupa, rawan koreksi.' })
    if (cy.ph === 'dist') cons.push({ t, d: 'Fase setelah puncak; mayoritas kasus serupa turun dari puncak.' })
  }
  if (a.pa?.sikap) {
    const x = { t: `Pandangan analis: ${a.pa.sikap}`, d: clip(String(a.pa.ringkas || ''), 170) }
    if (/asimetri/i.test(a.pa.sikap)) pros.push(x); else if (/hindari|spekulatif/i.test(a.pa.sikap)) cons.push(x)
  }
  return { pros: dedupe(pros), cons: dedupe(cons) }
}

// Kekuatan vs kelemahan pengendali: profil riset, catatan investor, data Stockbit (c), dan kepemilikan di emiten lain.
// active/exited = kepemilikan (selain emiten ini); radarTickers = kode emiten radar aktif; group = emiten radar dengan pengendali sama.
export function ctrlProsCons({ profil, pv, c, active = [], exited = [], radarTickers = [], group = [] }) {
  const pros = [], cons = []
  for (const p of profil?.pengendali || []) {
    if (p.pengalaman) pros.push({ t: `Pengalaman ${p.nama}`, d: clip(sentences(p.pengalaman)[0], 180) })
    const ver = (p.jaringan || []).filter(j => VERIFIED.test(j.keyakinan || ''))
    if (ver.length >= 2) pros.push({ t: `${ver.length} jaringan terverifikasi`, d: ver.slice(0, 3).map(j => j.dengan).join(', ') })
    const media = (p.jaringan || []).filter(j => /media/i.test(j.keyakinan || ''))
    if (media.length) cons.push({ t: `${media.length} hubungan hanya disebut media`, d: 'Belum terkonfirmasi dokumen resmi: ' + media.slice(0, 2).map(j => j.dengan).join(', ') })
    const r = riskText(p)
    if (r) cons.push({ t: `Catatan risiko ${p.nama}`, d: clip(r, 180) })
  }
  if (pv) {
    sentences(pv.catatan + ' ' + pv.grup).filter(s => RED_RE.test(s)).slice(0, 2).forEach(s => cons.push({ t: 'Red flag', d: clip(s, 180) }))
    sentences([pv.siapa, pv.grup, pv.rencana].join(' ')).filter(s => GOOD_RE.test(s) && !RED_RE.test(s) && !NEG_GOOD.test(s))
      .slice(0, 1).forEach(s => pros.push({ t: 'Pembeli kredibel/strategis', d: clip(s, 180) }))
    if (/tidak diungkap/i.test(pv.grup)) cons.push({ t: 'Latar grup/UBO tidak diungkap', d: 'Rekam jejak sulit diverifikasi.' })
    if (pv.bukanPengambilAlih) cons.push({ t: 'Pengambilalihan belum terjadi', d: 'Nama di kolom pengendali adalah pengendali lama/penjual.' })
  }
  if (c) {
    if (!(c.beneficiary || []).length) cons.push({ t: 'UBO tidak tercatat di Stockbit', d: 'Pemilik manfaat akhir perlu dicek di keterbukaan.' })
    if (/\b(PTE|LTD|LIMITED|INC)\b/i.test(c.name || '') && !/^PT\b/i.test(c.name || '')) cons.push({ t: 'SPV luar negeri', d: 'Median 0,78× harga PTW pada 9 transaksi serupa.' })
  }
  const inRadar = active.filter(h => radarTickers.includes(h.symbol))
  if (inRadar.length) cons.push({ t: `Memegang ${inRadar.length} emiten radar lain`, d: 'Pola pengumpul cangkang: ' + inRadar.map(h => h.symbol).join(', ') + '.' })
  else if (active.length) pros.push({ t: `Kepemilikan aktif di ${active.length} emiten lain`, d: active.slice(0, 4).map(h => h.symbol).join(', ') })
  if (exited.length >= 3) cons.push({ t: `Pernah keluar dari ${exited.length} emiten`, d: 'Cek apakah keluar setelah harga naik (pola masuk lalu jual).' })
  if (group.length) pros.push({ t: `Grup juga mengendalikan ${group.join(', ')}`, d: 'Rekam jejak eksekusi grup bisa dibandingkan.' })
  return { pros: dedupe(pros), cons: dedupe(cons) }
}

// ---------- Sudut pandang mendalam ----------

// Narasi berangka per emiten: [judul, teks][]. Bagian siklus butuh benchmark (bm).
export function deepView(a, { profil, aset, bm, verified, now } = {}) {
  const dl = a.pa?.dilusi || {}, k = aset?.kjpp || {}, out = []
  const who = profil?.ringkas || (a.pv?.siapa ? sentences(a.pv.siapa)[0] : '')
  if (who) out.push(['Pengendali dan motifnya', `${who}${a.pv?.rencana ? ' Rencana yang dinyatakan: ' + sentences(a.pv.rencana)[0] : ''}`])
  if (aset || a.sv?.injectType) {
    const val = aset?.transaksi?.nilaiRp ?? a.injRp, ratio = val && a.mcap ? val / a.mcap : null
    const kj = k.status === 'terbit' ? `Penilaian KJPP sudah terbit${k.nilaiRp ? ' (' + big(k.nilaiRp) + ')' : ''}.`
      : k.status === 'ditunjuk' ? 'KJPP sudah ditunjuk, laporannya belum terbit, jadi nilainya belum teruji.'
      : 'Belum ada penilai independen; nilainya masih klaim.'
    const hub = profil?.afiliasi?.hubungan ? ' Hubungan penjual: ' + sentences(profil.afiliasi.hubungan)[0] : ''
    out.push(['Aset yang masuk dan nilainya', `${aset?.aset?.nama || a.sv?.injectTarget || a.sv?.injectType}${aset?.aset?.sektor ? ' (' + aset.aset.sektor + ')' : ''}${val ? ` senilai ${big(val)}` : ', nilainya belum diungkap'}${ratio ? `, setara ${x2(ratio)} kapitalisasi ${a.t}` : ''}. ${kj}${hub}`])
  }
  const entry = String(a.pv?.siapa || '').match(/Rp\s?([\d.,]+)\s*(?:\/|per)\s*saham/i)
  const benefit = [entry && `Pengendali masuk di Rp${entry[1]} per saham`, a.tender?.price && `PTW ${rp(a.tender.price)}`, a.price && `harga kini ${rp(a.price)}`].filter(Boolean).join(', ')
  if (benefit || dl.berlaku) {
    const dil = dl.berlaku && dl.porsiPublikSetelah != null
      ? ` Bila publik tidak ikut menebus, porsinya turun dari ${fmt(dl.porsiPublikSekarang ?? a.flt ?? 0, 1)}% ke ${fmt(dl.porsiPublikSetelah, 1)}%${dl.nilaiPerSaham ? `, dengan nilai buku per saham pasca-transaksi sekitar ${rp(dl.nilaiPerSaham)}` : ''}.` : ''
    out.push(['Pihak yang diuntungkan oleh struktur transaksi', `${benefit}${benefit ? '.' : ''}${dil} Selisih harga masuk pengendali dan harga pasar adalah keuntungan yang sudah dikunci pengendali sebelum aset terbukti.`.trim()])
  }
  const cy = cycleOf(a, { bm, aset, verified, now })
  if (cy) {
    const { model: m, ph, day } = cy
    const vs = a.deal?.p0 && a.deal?.last ? `; harga kini ${x2(a.deal.last / a.deal.p0)} harga saat PTW` : ''
    out.push(['Posisi dalam siklus backdoor', `${day} hari sejak PTW dimulai; fase: ${phaseName(ph) || 'belum ada'}${vs}. Pada ${m.n} kasus, titik dasar median ${dayTxt(m.baseDay)} (${x2(m.baseX)}) dan puncak median ${dayTxt(m.peakDay)} (${x2(m.peakX)}). ${PHASE_NOTE[ph] || ''}`.trim()])
  } else if (a.deal?.p0 && a.deal?.last && a.d?.tender?.start) {
    out.push(['Posisi dalam siklus backdoor', `${daysSince(a.d.tender.start, now)} hari sejak PTW dimulai; harga kini ${x2(a.deal.last / a.deal.p0)} harga saat PTW.`])
  }
  const salah = a.pa?.tesisSalahBila || [], kunci = a.pa?.variabelKunci || []
  if (salah.length || kunci.length) out.push(['Kondisi yang menggugurkan tesis dan hal yang perlu dipantau', `${salah.join('; ')}${kunci.length ? `${salah.length ? '. ' : ''}Pantau: ${kunci.join('; ')}` : ''}.`])
  return out
}

const PHASE_NOTE = {
  pra: 'Emiten masih di fase awal: kenaikan terbesar historis justru terjadi sebelum PTW.',
  ptw: 'PTW menopang harga; setelah PTW selesai penopang ini hilang.',
  euf: 'Harga di atas kebanyakan kasus serupa, koreksi lebih mungkin daripada lanjutan.',
  dist: 'Mayoritas kasus serupa terus turun sampai ada katalis gelombang kedua (injeksi).',
  bawah: 'Pasar meragukan rencana; bukti eksekusi (KJPP atau RUPSLB) bisa memicu pembalikan.',
  inj: 'Nilai berikutnya ditentukan laba aset baru, bukan cerita.',
}

// ---------- Radar enam dimensi ----------

// Geometri radar (viewBox -56 -14 372 256), skor 0..10 per sumbu, sumbu pertama di atas.
export function radarGeom(dims, { R = 92, cx = 130, cy = 116 } = {}) {
  const n = dims.length
  const pt = (i, v) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(ang) * R * v / 10, cy + Math.sin(ang) * R * v / 10] }
  const pts = vs => vs.map((v, i) => pt(i, v).map(c => c.toFixed(1)).join(',')).join(' ')
  return {
    rings: [2.5, 5, 7.5, 10].map(v => pts(dims.map(() => v))),
    axes: dims.map((_, i) => pt(i, 10)),
    area: pts(dims.map(d => d.s)),
    dots: dims.map((d, i) => {
      const [x, y] = pt(i, d.s), [lx, ly] = pt(i, 12.4)
      return { k: d.k, s: d.s, x, y, lx, ly: ly + 3, anchor: lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle' }
    }),
    cx, cy,
  }
}
