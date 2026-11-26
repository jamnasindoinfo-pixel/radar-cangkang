// Pembuat presentasi analisa emiten (.pptx) dengan pptxgenjs. Prinsip: analisa dalam, teks sedikit —
// angka besar, meteran, diagram, dan grafik PowerPoint asli (bisa diklik/diedit). Satu pesan per slide,
// pita KESIMPULAN di bawah. Dipakai di browser (unduhan) dan di Node (uji).
import { fmtDate, PB_NADA, PB_DASAR, tglHargaAcuan } from './domain.js'
import { PT_STATUS, ptStatusTxt, confLvl } from './patterns.js'
import { phaseName } from './cycle.js'
import { mergeBoard } from './profil.js'
import { riCalc, riVerdict, noRights, riFunding, asetDetail, riPriceNeeded, riScenarios, asetLaba, labaSebelumSesudah, riLayak, riExercise, riTrading, riRating } from './rightsIssue.js'
import { valuasiSim, bandarView } from './valuasi.js'
import { sentences } from './analysis.js'
import { peerNote } from './emitenExtra.js'

const W = 10, H = 5.625, M = 0.45, CW = W - 2 * M
const TOP = 1.2, BOT = 4.6

// ---- format angka singkat ----
const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 })
export const rpS = v => v == null || isNaN(v) ? '–' : 'Rp' + id(Math.round(v))
// Nilai negatif ditulis −Rp12,3 M (bukan Rp-12,3 M).
export const bigS = v => v == null || isNaN(v) ? '–' : v < 0 ? '−' + bigS(-v) : v >= 1e12 ? `Rp${id(v / 1e12, 2)} T` : v >= 1e9 ? `Rp${id(v / 1e9, 1)} M` : `Rp${id(v / 1e6, 0)} jt`
const pctS = (v, d = 0) => v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${id(v * 100, d)}%`
const xS = v => v == null || isNaN(v) ? '–' : id(v, 2) + '×'
// Teks ringkas tanpa kalimat terpotong: utuh bila muat; bila tidak, kalimat-kalimat lengkap pertama yang muat;
// bila kalimat pertama saja sudah lebih panjang, kalimat itu tetap ditampilkan utuh (kotak teks mengecilkan huruf).
// Teks sangat panjang tanpa batas kalimat (> 2,5× batas) berhenti di batas anak kalimat yang utuh.
export function short(s, n = 90) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  // Kalimat lengkap (singkatan seperti "maks." atau "Pte." tidak dianggap akhir kalimat), lalu anak kalimat
  // yang dipisah titik koma: keduanya pernyataan utuh, jadi aman dipakai tanpa elipsis.
  const sents = sentences(t)
  let out = ''
  for (const x of sents) { const next = out ? out + ' ' + x : x; if (next.length > n) break; out = next }
  if (out) return out
  const parts = sents[0].split(/;\s+/)
  for (const x of parts) { const next = out ? out + '; ' + x : x; if (next.length > n) break; out = next }
  if (out && out.length >= n * 0.35) return /[.!?]$/.test(out) ? out : out + '.'
  if (sents[0].length <= n * 2.5) return sents[0]
  // Sangat panjang tanpa batas kalimat: berhenti di batas anak kalimat (koma, titik koma, titik dua, atau
  // sebelum kurung) yang tanda kurungnya seimbang, sehingga yang tampil tetap frasa utuh tanpa elipsis.
  const head = t.slice(0, Math.round(n * 2.5))
  const cuts = [...head.matchAll(/[,;:](?=\s)|\s(?=\()/g)].map(m => m.index)
    .filter(i => i >= n * 0.6 && (head.slice(0, i).match(/\(/g) || []).length === (head.slice(0, i).match(/\)/g) || []).length)
  if (cuts.length) return head.slice(0, cuts.pop()).replace(/[,;:\s]+$/, '')
  const sp = head.lastIndexOf(' ')
  return (sp > n ? head.slice(0, sp) : head).replace(/[,;:\s]+$/, '') + '…'
}
// Faktor pengecil huruf (0,6–1) agar teks muat di kotaknya. Perkiraan: lebar rata-rata huruf ±0,5 em,
// tinggi baris 1,2× ukuran huruf; poin daftar diberi jarak antarparagraf. Tanpa ukuran kotak: tidak diubah.
function fitScale(text, o) {
  if (!o.w || !o.h || o.fit === 'none') return 1
  const size = o.fontSize || 12
  // Huruf judul (serif) dan huruf tebal lebih lebar dari huruf isi.
  const em = 0.5 + (o.fontFace ? 0.08 : 0) + (o.bold ? 0.03 : 0)
  const paras = Array.isArray(text)
    ? text.reduce((acc, r) => { acc[acc.length - 1] += String(r?.text ?? r ?? ''); if (r?.options?.breakLine) acc.push(''); return acc }, [''])
    : String(text ?? '').split('\n')
  const need = k => {
    const cpl = Math.max(1, Math.floor(o.w * 72 / (size * k * em)))
    const lines = paras.reduce((a, p) => a + Math.max(1, Math.ceil(p.length / cpl)), 0)
    return lines * size * k * 1.2 / 72 + (paras.length - 1) * (Array.isArray(text) ? 0.06 : 0)
  }
  let k = 1
  while (k > 0.6 && need(k) > o.h + 0.02) k -= 0.05
  return k
}
// Nama badan usaha tanpa keterangan dalam kurung (termasuk kurung terpotong) dan tanpa "melalui …".
const entName = s => String(s || '').replace(/\s*\(.*$/, '').replace(/^\s*(grup|melalui)\s+/i, '').replace(/\s+(melalui|via)\s.*$/i, '').trim()
// Porsi tanpa rincian dalam kurung: "39,31% (±1,03 miliar saham) via Triple B" -> "39,31%".
const porsiS = s => String(s || '').replace(/\s*\(.*?\)/g, '').replace(/\s+(melalui|via)\s.*$/i, '').trim()
// Gabungkan potongan teks berurutan selama muat n karakter; potongan yang tidak muat dipotong rapi.
const clip = (arr, n) => {
  let out = ''
  for (const t of (arr || []).map(x => String(x || '').trim()).filter(Boolean)) {
    const next = out ? out + ' ' + t : t
    if (next.length <= n) { out = next; continue }
    if (!out) out = short(t, n)
    break
  }
  return out
}
// Judul keterbukaan berhuruf kapital semua → huruf kalimat, dengan nama emiten & singkatan baku dipulihkan.
const ABBR = /\b(pt|tbk|hmetd|pmhmetd|pmthmetd|rups|rupslb|rupst|ojk|bei|kjpp|ptw|ipo)\b/g
function calmTitle(t, name = '') {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  if (s.length < 40 || s !== s.toUpperCase()) return s
  let out = s.charAt(0) + s.slice(1).toLowerCase()
  const nm = String(name || '').replace(/\.$/, '')
  if (nm) out = out.replace(new RegExp(nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'), nm)
  return out.replace(ABBR, w => w === 'tbk' ? 'Tbk' : w.toUpperCase())
}
// Persen dari Stockbit ("-84.72%") ke format Indonesia ("−84,72%").
const pctId = v => String(v || '').replace(/(\d)\.(\d)/, '$1,$2')
// Gaya tulisan ilmiah: tanda pisah panjang di tengah kalimat diganti koma.
const prose = v => typeof v === 'string' ? v.replace(/\s+[—]\s+/g, ', ').replace(/\s—(?=\S)/g, ', ')
  : Array.isArray(v) ? v.map(r => (r && typeof r === 'object' ? { ...r, text: prose(r.text) } : r)) : v
const KJPP_SHORT = { terbit: 'Terbit', ditunjuk: 'Ditunjuk', belum: 'Belum ada' }
const initials = s => String(s || '?').replace(/^(PT|CV)\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
const yk = k => /terverifikasi/i.test(k || '') ? 'ok' : /indikasi/i.test(k || '') ? 'ind' : 'media'
const YK_LABEL = { ok: 'terverifikasi', ind: 'indikasi', media: 'disebut media' }

// Perangkat gambar bersama (presentasi + helper slide) untuk semua jenis presentasi unduhan.
function makeKit(PptxGenJS, d, th, title) {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  pres.author = 'Radar Backdoor'
  pres.company = 'Radar Backdoor'
  pres.title = title
  const S = pres.shapes
  let page = 0

  // ---- perangkat gambar ----
  // Teks satu warna (tidak warna-warni): warna penanda (aksen, positif, waspada, negatif) menjadi tinta gelap;
  // sorotan muda (accent2 dan warna terang lain), yang hanya dipakai di panel berwarna, menjadi putih.
  // Warna tema tetap dipakai pada bentuk (panel, batang, garis), bukan pada teks.
  const LIGHT = new Set(['FFFFFF', 'F8FAFC', 'EAF2FA', 'DCE7F3', 'BBF7D0', 'FDE68A', th.accent2])
  const mono = c => !c || c === th.ink || c === th.muted ? c : LIGHT.has(c) ? 'FFFFFF' : th.ink
  const monoRuns = v => Array.isArray(v) ? v.map(r => (r && typeof r === 'object' && r.options?.color ? { ...r, options: { ...r.options, color: mono(r.options.color) } } : r)) : v
  const T = (s, text, o = {}) => {
    const t = monoRuns(prose(text)), k = fitScale(t, o)
    const runs = k < 1 && Array.isArray(t) ? t.map(r => (r?.options?.fontSize ? { ...r, options: { ...r.options, fontSize: Math.round(r.options.fontSize * k * 2) / 2 } } : r)) : t
    return s.addText(runs, { isTextBox: true, margin: 0, fontFace: th.body, color: th.ink, valign: 'top', fit: 'shrink', ...o,
      fontSize: Math.round((o.fontSize || 12) * k * 2) / 2, ...(o.color ? { color: mono(o.color) } : {}) })
  }
  const shadow = () => ({ type: 'outer', blur: 3, offset: 1, angle: 90, color: '000000', opacity: 0.1 })
  const card = (s, x, y, w, h, o = {}) => s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.07,
    fill: { color: o.fill || th.card, transparency: o.tr || 0 }, line: { color: o.line || o.fill || th.line, width: 0.75 }, shadow: o.flat ? undefined : shadow() })
  const pill = (s, x, y, text, color, o = {}) => {
    const w = o.w || Math.max(0.7, 0.11 + String(text).length * 0.068 * (o.size || 9) / 9)
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h: o.h || 0.24, rectRadius: 0.12, fill: { color }, line: { color, width: 0.5 } })
    T(s, text, { x, y, w, h: o.h || 0.24, fontSize: o.size || 9, bold: true, color: o.ink || 'FFFFFF', align: 'center', valign: 'middle' })
    return w
  }
  const dot = (s, x, y, r, color, o = {}) => s.addShape(S.OVAL, { x: x - r, y: y - r, w: 2 * r, h: 2 * r, fill: { color, transparency: o.tr || 0 }, line: { color: o.line || color, width: o.lw || 0.75, transparency: o.ltr || 0 } })
  const line = (s, x, y, w, h, color, o = {}) => lineShape(s, S, x, y, w, h, color, o)
  const tone = v => v === 'good' ? th.good : v === 'warn' ? th.warn : v === 'bad' || v === 'strong' ? th.bad : th.muted
  const sikapTone = s => /asimetri/i.test(s || '') ? th.good : /netral/i.test(s || '') ? th.warn : s ? th.bad : th.muted
  const scoreTone = v => v >= 65 ? th.good : v >= 45 ? th.warn : th.bad
  const dimTone = v => v >= 6.5 ? th.good : v >= 4.5 ? th.warn : th.bad
  const chartBase = () => ({ catAxisLabelColor: th.muted, valAxisLabelColor: th.muted, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
    catAxisLabelFontFace: th.body, valAxisLabelFontFace: th.body, legendFontFace: th.body, dataLabelFontFace: th.body,
    valGridLine: { color: th.line, size: 0.5 }, catGridLine: { style: 'none' }, legendFontSize: 9, legendColor: th.muted })

  let sec = ''
  // Kerangka slide isi: label bagian, judul, pita kesimpulan, kaki halaman.
  function slide(eyebrow, title, take) {
    const s = pres.addSlide()
    page++
    s.background = { color: th.bg }
    // Label bagian bernomor seperti bab/subbab laporan.
    T(s, `${page - 1}. ${eyebrow}`.toUpperCase(), { x: M, y: 0.28, w: CW, h: 0.22, fontSize: 9.5, bold: true, color: th.accent, charSpacing: 4 })
    // Bagian presentasi (mengikuti urutan tab di website) di pojok kanan atas.
    if (sec) T(s, sec.toUpperCase(), { x: W - M - 3, y: 0.28, w: 3, h: 0.22, fontSize: 8, bold: true, color: th.muted, charSpacing: 3, align: 'right' })
    T(s, title, { x: M, y: 0.5, w: CW, h: 0.58, fontFace: th.head, fontSize: 25, bold: true, color: th.ink, valign: 'middle', fit: 'shrink' })
    if (take) {
      s.addShape(S.ROUNDED_RECTANGLE, { x: M, y: 4.72, w: CW, h: 0.42, rectRadius: 0.06, fill: { color: th.dark }, line: { color: th.dark, width: 0.5 } })
      T(s, 'KESIMPULAN', { x: M + 0.18, y: 4.72, w: 1.5, h: 0.42, fontSize: 8.5, bold: true, color: th.accent2, charSpacing: 3, valign: 'middle' })
      // Kesimpulan panjang (dua kalimat) dikecilkan agar muat dua baris, bukan dipotong.
      const long = take.length > 145
      T(s, short(take, long ? 300 : 145), { x: M + 1.75, y: 4.72, w: CW - 1.9, h: 0.42, fontSize: long ? 8.5 : 10.5, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    }
    T(s, `${d.t} | Riset Ekuitas Radar Backdoor | Data per ${fmtDate(d.date)}`, { x: M, y: 5.24, w: 6, h: 0.22, fontSize: 8, color: th.muted })
    T(s, String(page), { x: W - M - 0.5, y: 5.24, w: 0.5, h: 0.22, fontSize: 8, color: th.muted, align: 'right' })
    return s
  }
  // Kartu angka besar.
  function kpi(s, x, y, w, h, val, label, color = th.accent) {
    card(s, x, y, w, h)
    // Ukuran huruf menyesuaikan panjang nilai dan lebar kartu (agar tidak meluber).
    const per = String(val).length / Math.max(0.8, w - 0.3), base = h > 1.2 ? 26 : 20
    const fs = per <= 4.2 ? base : per <= 6 ? base * 0.78 : per <= 9 ? base * 0.6 : 11
    T(s, val, { x: x + 0.18, y: y + 0.12, w: w - 0.3, h: h * 0.5, fontFace: th.head, fontSize: Math.round(fs), bold: true, color, valign: 'middle' })
    T(s, short(label, 70), { x: x + 0.18, y: y + h * 0.58, w: w - 0.3, h: h * 0.38, fontSize: 9.5, color: th.muted })
  }
  // Batang horizontal (nilai 0..1).
  function hbar(s, x, y, w, frac, color, h = 0.14) {
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: th.line }, line: { color: th.line, width: 0.25 } })
    const fw = Math.max(h, w * Math.max(0, Math.min(1, frac)))
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: fw, h, rectRadius: h / 2, fill: { color }, line: { color, width: 0.25 } })
  }

  // Lingkaran ikon berisi simbol sederhana (motif visual yang diulang di semua slide).
  function icon(s, cx, cy, r, glyph, color, ink = 'FFFFFF') {
    dot(s, cx, cy, r, color)
    T(s, glyph, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fontSize: Math.round(r * 46), bold: true, color: ink, align: 'center', valign: 'middle' })
  }
  // Alur kartu kiri ke kanan (mis. bisnis lama → pengendali → aset → bisnis baru): ikon, judul, isi singkat, panah.
  function flow(s, y, h, items) {
    const n = items.length, gap = 0.36, w = (CW - gap * (n - 1)) / n
    items.forEach((it, i) => {
      const x = M + i * (w + gap), dark = !!it.dark
      card(s, x, y, w, h, dark ? { fill: th.dark, line: th.dark } : {})
      icon(s, x + 0.34, y + 0.34, 0.2, it.icon || String(i + 1), dark ? th.accent2 : (it.color || th.accent), dark ? th.dark : 'FFFFFF')
      T(s, it.title, { x: x + 0.62, y: y + 0.12, w: w - 0.72, h: 0.44, fontSize: 11, bold: true, color: dark ? 'FFFFFF' : th.ink, valign: 'middle', fit: 'shrink' })
      T(s, it.text || '–', { x: x + 0.16, y: y + 0.66, w: w - 0.3, h: h - (it.tag ? 1.04 : 0.74), fontSize: 9.5, color: dark ? 'EAF2FA' : th.ink, fit: 'shrink' })
      if (it.tag) T(s, it.tag, { x: x + 0.16, y: y + h - 0.36, w: w - 0.3, h: 0.26, fontSize: 8.5, bold: true, color: dark ? th.accent2 : th.accent, fit: 'shrink' })
      if (i < n - 1) line(s, x + w + 0.04, y + h / 2, gap - 0.08, 0, th.muted, { arrow: true, w: 1.75 })
    })
  }
  // Kartu poin: ikon + judul, lalu maksimal beberapa poin singkat (bukan paragraf).
  function pointCard(s, x, y, w, h, glyph, color, title, pts, o = {}) {
    card(s, x, y, w, h)
    icon(s, x + 0.36, y + 0.34, 0.2, glyph, color)
    T(s, title, { x: x + 0.66, y: y + 0.12, w: w - 0.8, h: 0.44, fontSize: 12, bold: true, valign: 'middle' })
    const list = (pts || []).filter(Boolean).slice(0, o.max || 4)
    T(s, list.length ? list.map((t, i, a) => ({ text: short(t, o.n || 90), options: { bullet: { indent: 12 }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } })) : (o.empty || 'Tidak ada yang menonjol.'),
      { x: x + 0.22, y: y + 0.66, w: w - 0.4, h: h - 0.76, fontSize: o.size || 10.5, color: list.length ? th.ink : th.muted, fit: 'shrink' })
  }

  return { pres, S, T, card, pill, dot, line, tone, sikapTone, scoreTone, dimTone, chartBase, slide, kpi, hbar, icon, flow, pointCard, bump: () => ++page, setSec: v => { sec = v } }
}

// opt.info = true: versi infografis (visual, angka besar, diagram & grafik; slide teks panjang dilewati).
export function buildDeck(PptxGenJS, d, th, opt = {}) {
  const info = !!opt.info
  const K = makeKit(PptxGenJS, d, th, `${d.t}: ${info ? 'Infografis' : 'Laporan'} Riset Ekuitas Backdoor Listing`)
  const { pres, S, T, card, pill, dot, line, tone, sikapTone, scoreTone, dimTone, chartBase, slide, kpi, hbar, icon, flow, pointCard } = K
  const A = d.A || {}
  const hasDoc = !!(d.ri?.doc || d.riDoc)

  const recTone = t => t === 'good' ? th.good : t === 'bad' ? th.bad : th.warn

  // ===== 1. Sampul (gelap, motif sesuai sektor) =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line)
    T(s, 'RISET EKUITAS · BACKDOOR LISTING', { x: 0.7, y: 1.0, w: 5.2, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, d.t, { x: 0.7, y: 1.35, w: 5.2, h: 1.2, fontFace: th.head, fontSize: 66, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, info ? 'Infografis Riset Investasi' : 'Laporan Riset Investasi', { x: 0.7, y: 2.55, w: 5.6, h: 0.5, fontFace: th.head, fontSize: 22, color: 'FFFFFF' })
    T(s, d.name || '', { x: 0.7, y: 3.1, w: 5.2, h: 0.35, fontSize: 15, color: th.accent2 })
    const topics = ['Pengendali', d.aset || A.sv?.injectType ? 'Aset injeksi' : null, 'Valuasi', 'Teknikal', 'Skenario'].filter(Boolean)
    T(s, topics.join('  •  '), { x: 0.7, y: 3.55, w: 5.4, h: 0.3, fontSize: 11, color: 'EAF2FA' })
    pill(s, 0.7, 4.0, d.sector?.label || 'Umum', th.accent, { size: 9 })
    T(s, `Data per ${fmtDate(d.date)}  |  Harga terakhir ${rpS(A.price)}${A.priceDate ? ' (' + fmtDate(A.priceDate) + ')' : ''}`, { x: 0.7, y: 4.95, w: 6, h: 0.25, fontSize: 9.5, color: 'DCE7F3' })
    if (d.pa?.asOf) T(s, `Narasi analis per ${fmtDate(d.pa.asOf)}${d.pa.hargaAcuan ? ' pada harga acuan ' + rpS(d.pa.hargaAcuan) + (d.pa.hargaAsOf ? ' (' + fmtDate(tglHargaAcuan(d.pa)) + ')' : '') : ''}`, { x: 0.7, y: 5.2, w: 6, h: 0.22, fontSize: 8.5, color: 'DCE7F3' })
  }

  // ---------- Bagian: Ringkasan eksekutif (headline transaksi + rekomendasi di awal; rincian di bagian berikutnya) ----------
  K.setSec('Ringkasan')
  headlineSlides(K, th, d)
  if (info) infoStatsSlide(K, th, d)

  // ---------- Bagian: Profil (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Profil')
  // ===== 12b. Profil perusahaan: angka kunci, pemegang saham utama, potensi target harga =====
  {
    const m = A.p?.metrics || {}, st = A.p?.stats || {}, p = d.profile || A.p || {}
    const tiles = [
      [st.marketCap || A.mcap ? bigS(st.marketCap || A.mcap) : null, `Kapitalisasi pasar${st.freeFloat != null ? ' · free float ' + id(st.freeFloat, 1) + '%' : ''}`, th.ink],
      [m.pbv != null ? id(m.pbv, 2) + '×' : null, `PBV · nilai buku ${rpS(m.bvps)}/saham`, m.pbv > 3 ? th.bad : th.ink],
      [m.netMargin ? pctId(m.netMargin) : m.per != null ? id(m.per, 1) + '×' : null, m.netMargin ? 'Margin laba bersih' : 'PER', /^-/.test(m.netMargin || '') || m.per < 0 ? th.bad : th.good],
      [m.ret1y ? pctId(m.ret1y) : null, `Harga 1 tahun · ${rpS(m.low52)}–${rpS(m.high52)}`, /^-/.test(m.ret1y || '') ? th.bad : th.good],
    ].filter(t => t[0] != null)
    const holders = (p.shareholders || []).map(h => ({ ...h, pct: parseFloat(String(h.pct).replace(',', '.')) })).filter(h => h.pct > 0).slice(0, 5)
    const lv = priceLevels(d)
    if (tiles.length >= 2 || holders.length || lv.length) {
      const nw = d.pa?.nilaiWajar
      const s = slide('Profil perusahaan', 'Profil Perusahaan dan Fundamental', nw ? `Nilai wajar kasar ${rpS(nw.bawah)}–${rpS(nw.atas)}, harga kini ${rpS(A.price)}.` : p.sector ? `Sektor ${p.sector}${p.industry ? ' · ' + p.industry : ''}; harga kini ${rpS(A.price)}.` : '')
      const w4 = (CW - 0.15 * (tiles.length - 1)) / tiles.length
      tiles.forEach(([v, l, col], i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.0, v, l, col))
      const y = TOP + 1.15, h = 2.2, hw = CW / 2 - 0.1
      // Pemegang saham utama: nama + batang porsi.
      card(s, M, y, hw, h)
      icon(s, M + 0.36, y + 0.32, 0.18, '●', th.accent)
      T(s, 'Pemegang saham utama', { x: M + 0.64, y: y + 0.14, w: hw - 0.8, h: 0.36, fontSize: 11.5, bold: true, valign: 'middle' })
      holders.forEach((x, i) => {
        const ry = y + 0.6 + i * 0.31
        T(s, short(x.name, 30), { x: M + 0.2, y: ry, w: 2.15, h: 0.24, fontSize: 9, bold: !!x.pengendali, valign: 'middle' })
        hbar(s, M + 2.4, ry + 0.06, hw - 3.25, x.pct / 100, x.pengendali ? th.accent : th.muted, 0.12)
        T(s, id(x.pct, 1) + '%', { x: M + hw - 0.8, y: ry, w: 0.65, h: 0.24, fontSize: 9.5, bold: true, align: 'right', valign: 'middle' })
      })
      if ((p.beneficiary || []).length) T(s, 'Pemilik manfaat: ' + short(p.beneficiary.join(', '), 70), { x: M + 0.2, y: y + h - 0.36, w: hw - 0.4, h: 0.26, fontSize: 9, bold: true, color: th.accent })
      if (!holders.length) T(s, 'Data pemegang saham belum tersedia.', { x: M + 0.2, y: y + 0.65, w: hw - 0.4, h: 0.3, fontSize: 9.5, color: th.muted })
      // Potensi target harga: level acuan dibanding harga kini.
      const rx = M + hw + 0.2
      card(s, rx, y, hw, h)
      icon(s, rx + 0.36, y + 0.32, 0.18, '▲', th.good)
      T(s, 'Potensi target harga', { x: rx + 0.64, y: y + 0.14, w: hw - 0.8, h: 0.36, fontSize: 11.5, bold: true, valign: 'middle' })
      lv.slice(-5).forEach(([l, v], i) => {
        const ry = y + 0.6 + i * 0.31, ch = A.price ? v / A.price - 1 : null
        T(s, l, { x: rx + 0.2, y: ry, w: hw - 2.2, h: 0.24, fontSize: 9, valign: 'middle' })
        T(s, rpS(v), { x: rx + hw - 2.0, y: ry, w: 0.95, h: 0.24, fontSize: 9.5, bold: true, align: 'right', valign: 'middle' })
        T(s, ch == null ? '' : pctS(ch), { x: rx + hw - 1.0, y: ry, w: 0.85, h: 0.24, fontSize: 9.5, bold: true, color: ch >= 0 ? th.good : th.bad, align: 'right', valign: 'middle' })
      })
    }
  }

  // ===== 7. Pengurus (kartu, bukan tabel) =====
  // Pengurus riset dilengkapi daftar terkini Stockbit; yang tidak lagi tercantum tidak ditampilkan.
  const mb = mergeBoard(d.profil?.pengurus, d.profile)
  const board = [...mb.direksi.map(x => ({ ...x, g: 'Direksi' })), ...mb.komisaris.map(x => ({ ...x, g: 'Komisaris' }))].filter(x => !x.notListed)
  if (!info && board.length) {
    const nb = board.filter(x => x.orangPengendaliBaru).length
    const s = slide('Pengurus', 'Susunan Direksi dan Dewan Komisaris', `Sebanyak ${nb} dari ${board.length} anggota pengurus berasal dari pihak pengendali baru${board.some(x => (x.rangkap || []).length) ? ', dan sebagian merangkap jabatan di emiten lain' : ''}.`)
    // Kartu mengisi tinggi area: 1 baris bila ≤4 orang (kartu tinggi, dengan latar singkat), 2 baris bila lebih.
    const list = board.slice(0, 8), cols = 4, rows = Math.ceil(list.length / cols)
    const cw = (CW - 0.15 * (cols - 1)) / cols, ch = rows === 1 ? 3.3 : 1.6
    list.forEach((x, i) => {
      const cx = M + (i % cols) * (cw + 0.15), cy = TOP + Math.floor(i / cols) * (ch + 0.1)
      card(s, cx, cy, cw, ch)
      dot(s, cx + 0.32, cy + 0.32, 0.2, x.orangPengendaliBaru ? th.accent : th.muted)
      T(s, initials(x.nama), { x: cx + 0.12, y: cy + 0.12, w: 0.4, h: 0.4, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, short(x.nama, 34), { x: cx + 0.6, y: cy + 0.1, w: cw - 0.68, h: 0.46, fontSize: 9.5, bold: true, valign: 'middle' })
      T(s, short(x.jabatan || x.g, 34), { x: cx + 0.15, y: cy + 0.6, w: cw - 0.3, h: 0.22, fontSize: 8.5, color: th.muted })
      let tw = pill(s, cx + 0.15, cy + 0.88, x.orangPengendaliBaru ? 'pengendali baru' : 'pengurus lama', x.orangPengendaliBaru ? th.accent : th.muted, { size: 7.5, h: 0.2 })
      if (x.independen) pill(s, cx + 0.22 + tw, cy + 0.88, 'independen', th.good, { size: 7.5, h: 0.2 })
      let y = cy + 1.16
      if ((x.rangkap || []).length) { T(s, 'Rangkap: ' + short(x.rangkap[0], rows === 1 ? 70 : 30), { x: cx + 0.15, y, w: cw - 0.3, h: rows === 1 ? 0.42 : 0.22, fontSize: 7.5, color: th.warn, bold: true }); y += rows === 1 ? 0.48 : 0.24 }
      if (rows === 1 && x.latar) T(s, short(x.latar, 110), { x: cx + 0.15, y, w: cw - 0.3, h: cy + ch - y - 0.1, fontSize: 8, color: th.muted })
      else if (rows > 1 && x.hubungan && String(x.hubungan).length <= 60 && y < cy + ch - 0.25) T(s, x.hubungan, { x: cx + 0.15, y, w: cw - 0.3, h: 0.22, fontSize: 7.5, color: th.muted })
    })
  }

  // ---------- Bagian: Story & Pengendali (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Story & Pengendali')
  // ===== 4. Struktur pengendali (diagram alur) =====
  {
    const pf = d.profil || {}, persons = (pf.pengendali || []).slice(0, 3), st = d.story || {}
    const s = slide('Pengendali', 'Struktur Kepemilikan dan Pihak Terkait', pf.ringkas || d.pv?.siapa || `Pengendali ${A.ctrlName || 'belum diketahui'}`)
    const ent = short(entName(persons[0]?.entitas) || entName(A.ctrlName) || 'Pengendali', 40)
    const lx = M, lw = 2.75, mx = M + 3.45, mw = 2.1, rx = M + 6.25, rw = CW - 6.25
    const n = Math.max(1, persons.length), bh = 0.62, gap = (2.05 - n * bh) / Math.max(1, n - 1)
    const midY = TOP + 0.6
    persons.forEach((o, i) => {
      const y = n === 1 ? midY + 0.12 : TOP + i * (bh + gap)
      card(s, lx, y, lw, bh)
      T(s, short(o.nama, 34), { x: lx + 0.12, y: y + 0.07, w: lw - 0.24, h: 0.26, fontSize: 11, bold: true, align: 'center' })
      T(s, short([o.peran, porsiS(o.porsi)].filter(Boolean).join(' · '), 40), { x: lx + 0.12, y: y + 0.34, w: lw - 0.24, h: 0.22, fontSize: 9, color: th.muted, align: 'center' })
      line(s, lx + lw, y + bh / 2, mx - lx - lw, midY + 0.42 - (y + bh / 2), th.muted, { arrow: true, w: 1.5 })
    })
    if (!persons.length) { card(s, lx, TOP + 0.75, lw, bh); T(s, short(A.ctrlName || 'belum ada', 34), { x: lx, y: TOP + 0.9, w: lw, h: 0.3, fontSize: 11, bold: true, align: 'center' }); line(s, lx + lw, TOP + 1.06, mx - lx - lw, 0.11, th.muted, { arrow: true }) }
    s.addShape(S.ROUNDED_RECTANGLE, { x: mx, y: midY, w: mw, h: 0.85, rectRadius: 0.07, fill: { color: th.accent }, line: { color: th.accent, width: 0.5 } })
    T(s, ent, { x: mx + 0.1, y: midY + 0.08, w: mw - 0.2, h: 0.7, fontSize: 11.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fit: 'shrink' })
    line(s, mx + mw, midY + 0.42, rx - mx - mw, 0, th.accent, { arrow: true, w: 2 })
    T(s, A.ctrlPct != null ? id(A.ctrlPct, 1) + '%' : '', { x: mx + mw + 0.05, y: midY + 0.1, w: rx - mx - mw - 0.1, h: 0.25, fontSize: 10, bold: true, color: th.accent, align: 'center' })
    card(s, rx, midY - 0.25, rw, 1.35, { fill: th.dark, line: th.dark })
    T(s, d.t, { x: rx, y: midY - 0.15, w: rw, h: 0.45, fontSize: 22, bold: true, color: 'FFFFFF', align: 'center' })
    T(s, `Pengendali ${A.ctrlPct != null ? id(A.ctrlPct, 2) + '%' : '–'}`, { x: rx, y: midY + 0.32, w: rw, h: 0.25, fontSize: 10.5, color: 'FFFFFF', align: 'center' })
    T(s, `Publik ${A.flt != null ? id(A.flt, 2) + '%' : '–'}`, { x: rx, y: midY + 0.58, w: rw, h: 0.25, fontSize: 10.5, color: th.accent2, align: 'center' })
    const cards = [
      ['Pengendali lama', st.oldName ? `${short(st.oldName, 40)}${st.oldPct ? ' (' + st.oldPct + ')' : ''}` : 'belum ada'],
      ['Masuk sejak', st.takeoverDate ? fmtDate(st.takeoverDate) : 'belum ada'],
      ['Harga PTW vs kini', A.tender?.price ? `${rpS(A.tender.price)} → ${rpS(A.price)} (${pctS(A.price / A.tender.price - 1)})` : 'belum ada PTW'],
    ]
    cards.forEach(([h, v], i) => {
      const x = M + i * (CW / 3 + 0.075), w = CW / 3 - 0.1
      card(s, x, 3.4, w, 1.15)
      T(s, h, { x: x + 0.18, y: 3.5, w: w - 0.3, h: 0.25, fontSize: 9.5, bold: true, color: th.accent })
      T(s, v, { x: x + 0.18, y: 3.78, w: w - 0.3, h: 0.65, fontSize: 11, bold: true })
    })
  }

  // ===== 6. Profil pengendali (1 slide; dilewati bila slide pengendali dari dokumen tersedia) =====
  for (const o of hasDoc || info ? [] : (d.profil?.pengendali || []).slice(0, 1)) {
    const rj = (o.rekamJejak || []).slice(0, 5)
    const s = slide('Profil pengendali', short(o.nama, 44), o.karakteristik || o.risiko)
    card(s, M, TOP, 3.55, 3.35)
    dot(s, M + 0.62, TOP + 0.6, 0.38, th.accent)
    T(s, initials(o.nama), { x: M + 0.24, y: TOP + 0.36, w: 0.76, h: 0.48, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, short(o.nama, 40), { x: M + 1.15, y: TOP + 0.3, w: 2.25, h: 0.3, fontSize: 12, bold: true })
    T(s, short([o.peran, porsiS(o.porsi)].filter(Boolean).join(' · '), 44), { x: M + 1.15, y: TOP + 0.6, w: 2.25, h: 0.3, fontSize: 9, color: th.muted })
    T(s, [{ text: 'Latar  ', options: { bold: true, color: th.accent } }, { text: short(o.latar, 150) }], { x: M + 0.2, y: TOP + 1.12, w: 3.15, h: 0.85, fontSize: 9.5 })
    const per = (o.perkara || []).length, risk = o.perkara ? (per ? `${per} perkara/sanksi tercatat` : 'Bersih dari perkara publik') : 'Perkara belum diriset'
    pill(s, M + 0.2, TOP + 2.05, risk, o.perkara ? (per ? th.bad : th.good) : th.muted, { size: 8.5 })
    const net = (o.jaringan || []).length, co = (o.perusahaan || []).length
    T(s, `${rj.length ? (o.rekamJejak.length + ' rekam jejak · ') : ''}${co ? co + ' perusahaan · ' : ''}${net} jaringan`, { x: M + 0.2, y: TOP + 2.42, w: 3.15, h: 0.25, fontSize: 9.5, bold: true, color: th.ink })
    T(s, short(o.pengalaman, 110), { x: M + 0.2, y: TOP + 2.7, w: 3.15, h: 0.6, fontSize: 9, color: th.muted })
    // Garis waktu rekam jejak.
    const tx = M + 3.85, tw = CW - 3.85
    T(s, rj.length ? 'Rekam jejak' : 'Rekam jejak belum ditemukan', { x: tx, y: TOP, w: tw, h: 0.25, fontSize: 11, bold: true, color: th.accent })
    if (rj.length) line(s, tx + 0.12, TOP + 0.42, 0, 2.85, th.line, { w: 2 })
    rj.forEach((r, i) => {
      const y = TOP + 0.35 + i * 0.6, c = yk(r.keyakinan) === 'ok' ? th.good : yk(r.keyakinan) === 'ind' ? th.muted : th.warn
      dot(s, tx + 0.12, y + 0.1, 0.08, c)
      T(s, `${r.kode ? r.kode + ' · ' : ''}${short(entName(r.entitas), 44)}`, { x: tx + 0.32, y, w: tw - 2.0, h: 0.22, fontSize: 10, bold: true })
      T(s, short(String(r.periode || '').replace(/\s*\(.*$/, ''), 26), { x: tx + tw - 1.7, y, w: 1.7, h: 0.22, fontSize: 8.5, color: th.muted, align: 'right' })
      T(s, short(r.hasil, 80), { x: tx + 0.32, y: y + 0.22, w: tw - 0.35, h: 0.36, fontSize: 8.5, color: th.muted })
    })
  }

  // Pengendali, key person, dan riwayat hukum dari dokumen (bagian Story & Pengendali, bukan Analisa).
  if (!info) personSlide(K, th, d.ri?.doc || d.riDoc)

  // ===== 10. Transformasi bisnis: bisnis lama → pengendali baru → aset injeksi → bisnis baru (alur) =====
  {
    const st = d.story || {}, sv = A.sv || {}, pv = d.pv || {}, af = d.profil?.afiliasi || {}
    const lama = st.lama, baru = st.baru || sv.baru
    const inj = [sv.injectType, sv.injectTarget].filter(Boolean).join(' · ') || st.inject || d.aset?.aset?.nama
    const nominal = sv.nominal || st.nominal, target = sv.target || st.target
    if (lama || baru || inj) {
      const who = pv.siapa || A.ctrlName || d.item?.acquirer
      const s = slide('Transformasi bisnis', 'Dari Bisnis Lama ke Bisnis Baru', target ? `Target: ${target}` : baru ? `Arah bisnis baru: ${baru}` : 'Arah bisnis baru belum diungkap.')
      flow(s, TOP, 1.6, [
        { title: 'Bisnis lama', text: short(lama || 'belum diketahui', 90), tag: st.oldName ? 'Pengendali lama: ' + short(st.oldName, 26) : '' },
        { title: 'Pengendali baru', text: short(String(who || 'belum diketahui').replace(/\s*\(.*?\)/g, ''), 80), tag: A.ctrlPct != null ? `Porsi ${id(A.ctrlPct, 1)}%` : '' },
        { title: 'Aset injeksi', text: short(inj || 'belum diungkap', 90), tag: nominal ? 'Nilai ' + (typeof nominal === 'number' ? bigS(nominal) : short(String(nominal), 24)) : af.pihakLawan ? 'Pihak lawan: ' + short(af.pihakLawan, 24) : '' },
        { icon: '★', title: 'Bisnis baru', text: short(baru || 'belum diungkap', 90), tag: target ? short(target, 32) : '', dark: true },
      ])
      const rencana = points(pv.rencana, 3), catatan = points(pv.catatan, 3)
      pointCard(s, M, TOP + 1.75, CW / 2 - 0.1, 1.6, '→', th.accent, 'Rencana pengendali', rencana, { max: 2, n: 120, size: 9.5, empty: 'Rencana belum diungkap.' })
      pointCard(s, M + CW / 2 + 0.1, TOP + 1.75, CW / 2 - 0.1, 1.6, '!', th.warn, 'Yang perlu dicermati', catatan.length ? catatan : [st.lamaNote, af.hubungan].filter(Boolean), { max: 2, n: 120, size: 9.5 })
    }
  }

  // ===== 11. Progres transaksi (donat + langkah) =====
  if (d.prog) {
    const p = d.prog, ms = p.applicable || d.milestones
    const s = slide('Kemajuan transaksi', `Kemajuan Transaksi: ${p.pct}% dari Seluruh Tahapan`, d.pos?.next ? `Tahap berikutnya adalah ${d.pos.next}.` : 'Seluruh tahapan transaksi telah selesai.')
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Progres', labels: ['Tercapai', 'Belum'], values: [p.pct, 100 - p.pct] }], {
      x: M, y: TOP + 0.1, w: 2.9, h: 2.6, holeSize: 70, chartColors: [th.accent, th.line], showLegend: false, showPercent: false, showValue: false, dataLabelColor: th.bg })
    T(s, `${p.pct}%`, { x: M, y: TOP + 1.05, w: 2.9, h: 0.6, fontFace: th.head, fontSize: 30, bold: true, color: th.accent, align: 'center', valign: 'middle' })
    T(s, `Posisi: ${short(d.pos?.now || '', 60)}`, { x: M, y: TOP + 2.8, w: 2.9, h: 0.5, fontSize: 9.5, bold: true, align: 'center' })
    const lx = M + 3.2, rowH = Math.min(0.37, 3.3 / ms.length)
    ms.forEach((m, i) => {
      const y = TOP + i * rowH, ok = !!p.ms[m.id], a = p.auto?.[m.id]
      dot(s, lx + 0.12, y + rowH / 2, 0.1, ok ? th.good : th.card, { line: ok ? th.good : th.line, lw: 1.5 })
      T(s, `${m.w}%`, { x: lx + 0.32, y, w: 0.45, h: rowH, fontSize: 9, bold: true, color: ok ? th.good : th.muted, valign: 'middle' })
      T(s, short(m.label, 70), { x: lx + 0.8, y, w: 3.7, h: rowH, fontSize: 9.5, color: ok ? th.ink : th.muted, valign: 'middle', bold: ok })
      if (ok && a) T(s, fmtDate(String(a).slice(0, 10)), { x: lx + 4.55, y, w: CW - 3.2 - 4.55, h: rowH, fontSize: 8, color: th.muted, valign: 'middle', align: 'right' })
    })
  }

  // ---------- Bagian: Berita (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Berita')
  // ===== 11c. Perkembangan berita terkini & kesimpulannya =====
  if (!info && d.newsSum && (d.newsRecent || []).length) {
    const ns = d.newsSum, rows = d.newsRecent
    const s = slide('Berita terkini', 'Perkembangan Berita Terkini', ns.verdict)
    const lw = 5.75, rh = Math.min(0.68, 3.35 / rows.length)
    rows.forEach(({ u, take }, i) => {
      const y = TOP + i * rh
      card(s, M, y, lw, rh - 0.08, { flat: true })
      T(s, fmtDate(String(u.date || '').slice(0, 10)), { x: M + 0.12, y: y + 0.05, w: 1.0, h: 0.22, fontSize: 8, bold: true, color: th.accent })
      pill(s, M + 1.12, y + 0.05, take.label, take.level >= 3 ? th.good : take.level === 2 ? th.warn : th.muted, { size: 7, h: 0.2 })
      T(s, short(calmTitle(u.title, d.name), 95), { x: M + 0.12, y: y + 0.27, w: lw - 0.24, h: 0.2, fontSize: 9, bold: true, color: th.ink })
      if (rh > 0.6) T(s, short(take.points[0] || '', 120), { x: M + 0.12, y: y + 0.45, w: lw - 0.24, h: 0.18, fontSize: 7.5, color: th.muted })
    })
    const rx = M + lw + 0.2, rw = CW - lw - 0.2
    const pb = (d.pa?.pembaruan || []).slice(0, 2)
    const h1 = pb.length ? 1.95 : 3.35
    card(s, rx, TOP, rw, h1)
    T(s, 'KESIMPULAN BERITA', { x: rx + 0.15, y: TOP + 0.1, w: rw - 0.3, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    T(s, ns.paras.slice(0, 3).map(x => short(x, 170)).join('\n\n'), { x: rx + 0.15, y: TOP + 0.36, w: rw - 0.3, h: h1 - 0.45, fontSize: 8.5, color: th.ink, fit: 'shrink' })
    if (pb.length) {
      card(s, rx, TOP + 2.05, rw, 1.3, { fill: th.dark, line: th.dark })
      T(s, `PEMBARUAN ANALISA ${fmtDate(d.pa.asOf).toUpperCase()}`, { x: rx + 0.15, y: TOP + 2.13, w: rw - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, pb.map(x => short(x, 185)).join('\n'), { x: rx + 0.15, y: TOP + 2.37, w: rw - 0.3, h: 0.92, fontSize: 7.5, color: 'FFFFFF', fit: 'shrink' })
    }
  }

  // ===== 11d. Analisa penjelasan atas permintaan penjelasan bursa (terakhir) =====
  {
    const pb = (d.ri?.doc || d.riDoc)?.penjelasanBursa
    if (!info && pb && (pb.poin || []).length) {
      // Memo riset gaya fund manager: kesimpulan + dampak terhadap tesis, poin utama, implikasi, belum terjawab, dipantau.
      const m = pb.memo || {}
      const belum = pb.poin.filter(x => x.jawaban !== 'lengkap' && x.kurang)
      const lengkap = pb.poin.filter(x => x.jawaban === 'lengkap').length
      const DMP = { negatif: ['Negatif', th.bad], positif: ['Positif', th.good], netral: ['Netral', th.muted] }[pb.dampak] || ['Netral', th.muted]
      const s = slide('Penjelasan bursa', short(m.judul || 'Tanggapan atas Permintaan Penjelasan Bursa', 70), pb.kesimpulan)
      T(s, `Memo riset · tanggapan atas permintaan penjelasan BEI ${pb.tanggal ? fmtDate(pb.tanggal) : ''} · ${lengkap} dari ${pb.poin.length} butir dijawab lengkap`, { x: M, y: TOP - 0.05, w: CW - 2.6, h: 0.22, fontSize: 8.5, color: th.muted })
      pill(s, W - M - 2.5, TOP - 0.05, `Dampak terhadap tesis: ${DMP[0]}`, DMP[1], { size: 7.5, h: 0.22, w: 2.5 })
      const gw = (CW - 0.16) / 2, gh = 1.52, y0 = TOP + 0.26
      pointCard(s, M, y0, gw, gh, '1', th.accent, 'Poin utama', m.inti, { max: 3, n: 150, size: 8.5 })
      pointCard(s, M + gw + 0.16, y0, gw, gh, '2', th.accent, 'Implikasi investasi', m.implikasi, { max: 3, n: 150, size: 8.5 })
      pointCard(s, M, y0 + gh + 0.12, gw, gh, '!', th.bad, 'Belum terjawab', [...belum].sort((p, q) => (p.jawaban === 'tidak' ? 0 : 1) - (q.jawaban === 'tidak' ? 0 : 1)).map(x => `${x.no ? x.no + '. ' : ''}${x.topik} (${x.jawaban === 'tidak' ? 'tidak dijawab' : 'dijawab sebagian'})`), { max: 5, n: 90, size: 8.5, empty: 'Seluruh pertanyaan dijawab lengkap.' })
      pointCard(s, M + gw + 0.16, y0 + gh + 0.12, gw, gh, '→', th.accent, 'Yang dipantau', m.pantau, { max: 3, n: 130, size: 8.5 })

      // Analisa per pertanyaan BEI (semua butir, 8 per slide): nada objektif + dasarnya, jawaban emiten, dan analisa.
      const col = x => x === 'positif' ? th.good : x === 'negatif' ? th.bad : th.muted
      const pages = []
      for (let i = 0; i < pb.poin.length; i += 8) pages.push(pb.poin.slice(i, i + 8))
      pages.forEach((rows, p) => {
        const last = p === pages.length - 1
        const s2 = slide('Penjelasan bursa', `Analisa Penjelasan atas Permintaan Penjelasan Bursa${pages.length > 1 ? ` (${p + 1}/${pages.length})` : ''}`, last ? pb.kesimpulan : null)
        T(s2, `${pb.tanggal ? fmtDate(pb.tanggal) + ' · ' : ''}${short(pb.judul || '', 90)}`, { x: M, y: TOP - 0.05, w: CW, h: 0.22, fontSize: 8.5, color: th.muted })
        const rh = 3.05 / 8
        if (last) T(s2, 'Dasar nada · Negatif: tidak dijawab/ditunda, atau fakta merugikan yang dinyatakan emiten · Netral: fakta/prosedur/kepatuhan · Positif: pengungkapan spesifik, kepastian, atau perlindungan bagi publik · Kolom kanan: analisa', { x: M, y: TOP + 3.32, w: CW, h: 0.18, fontSize: 7, color: th.muted, fit: 'shrink' })
        rows.forEach((x, i) => {
          const y = TOP + 0.25 + i * rh
          if (i) line(s2, M, y, CW, 0, th.line, { w: 0.5 })
          pill(s2, M, y + (rh - 0.2) / 2 - (PB_DASAR[x.dasar] ? 0.06 : 0), (PB_NADA[x.nada] || PB_NADA.netral)[0], col(x.nada), { size: 7, h: 0.2, w: 0.75 })
          if (PB_DASAR[x.dasar]) T(s2, PB_DASAR[x.dasar], { x: M - 0.05, y: y + (rh - 0.2) / 2 + 0.15, w: 0.85, h: 0.14, fontSize: 5.5, color: th.muted, align: 'center', fit: 'shrink' })
          T(s2, short(`${x.no ? x.no + '. ' : ''}${x.topik}`, 38), { x: M + 0.85, y, w: 1.6, h: rh, fontSize: 8.5, bold: true, color: th.ink, valign: 'middle', fit: 'shrink' })
          T(s2, short(x.kurang ? `${x.jawab} Belum dijawab: ${x.kurang.charAt(0).toLowerCase() + x.kurang.slice(1)}` : x.jawab, 340), { x: M + 2.5, y, w: 3.25, h: rh, fontSize: 7.5, color: th.ink, valign: 'middle', fit: 'shrink' })
          T(s2, short(x.analisa, 240), { x: M + 5.85, y, w: CW - 5.85, h: rh, fontSize: 7.5, color: th.muted, valign: 'middle', fit: 'shrink' })
        })
      })
    }
  }

  // ---------- Bagian: Analisa (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Analisa')
  // ===== 2b. Tesis analis (lengkap, per kalimat bernomor) =====
  if (!info && d.pa?.tesis) {
    const pts = String(d.pa.tesis).split(/(?<=[.;])\s+(?=[A-Z0-9])/).map(x => x.trim()).filter(x => x.length > 15).slice(0, 4)
    const s = slide('Tesis analis', 'Dasar Penilaian Analis', d.pa.ringkas || '')
    const cols = pts.length > 3 ? 2 : 1, rows = Math.ceil(pts.length / cols)
    const cw = (CW - 0.2 * (cols - 1)) / cols, ch = (3.35 - 0.12 * (rows - 1)) / rows
    pts.forEach((p, i) => {
      const x = M + (i % cols) * (cw + 0.2), y = TOP + Math.floor(i / cols) * (ch + 0.12)
      card(s, x, y, cw, ch)
      icon(s, x + 0.32, y + ch / 2, 0.19, String(i + 1), th.accent)
      T(s, short(p, 150), { x: x + 0.6, y: y + 0.12, w: cw - 0.75, h: ch - 0.2, fontSize: 11, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
  }
  // ===== 3. Skor enam dimensi =====
  if ((A.dims || []).length) {
    const dims = A.dims
    const best = [...dims].sort((a, b) => b.s - a.s)[0], worst = [...dims].sort((a, b) => a.s - b.s)[0]
    const s = slide('Skor analisis', 'Penilaian Enam Dimensi', `Dimensi terkuat adalah ${best.k} (${id(best.s, 1)}), sedangkan yang terlemah adalah ${worst.k} (${id(worst.s, 1)}). Skor total ${A.score}/100.`)
    dims.forEach((x, i) => {
      const y = TOP + 0.05 + i * 0.55
      T(s, x.k, { x: M, y, w: 2.0, h: 0.22, fontSize: 11, bold: true })
      T(s, id(x.s, 1), { x: M + 5.35, y: y - 0.02, w: 0.6, h: 0.26, fontSize: 13, bold: true, color: dimTone(x.s), align: 'right' })
      hbar(s, M + 2.05, y + 0.04, 3.2, x.s / 10, dimTone(x.s))
      T(s, short((x.why || [])[0] || '', 85), { x: M, y: y + 0.24, w: 5.95, h: 0.22, fontSize: 9, color: th.muted })
    })
    const cx = M + 7.25, cy = TOP + 1.45
    dot(s, cx, cy, 1.15, th.card, { line: th.line })
    dot(s, cx, cy, 0.95, scoreTone(A.score), { tr: 85, line: scoreTone(A.score), lw: 3 })
    T(s, String(A.score ?? '–'), { x: cx - 0.9, y: cy - 0.45, w: 1.8, h: 0.65, fontFace: th.head, fontSize: 40, bold: true, color: scoreTone(A.score), align: 'center', valign: 'middle' })
    T(s, 'dari 100', { x: cx - 0.9, y: cy + 0.2, w: 1.8, h: 0.25, fontSize: 10, color: th.muted, align: 'center' })
    T(s, short(A.stance?.t || '', 60), { x: cx - 1.35, y: cy + 1.3, w: 2.7, h: 0.5, fontSize: 10.5, bold: true, align: 'center', color: th.ink })
  }

  // ===== 8. Aset injeksi & mekanisme (langkah bergambar) =====
  if (!d.ri && (d.aset || A.sv?.injectType)) {
    const as = d.aset || {}, mcap = A.mcap
    const s = slide('Aset injeksi', short(as.aset?.nama || A.sv?.injectTarget || A.sv?.injectType || 'Rencana injeksi aset', 50), (d.deep.find(x => /^Aset yang masuk/.test(x[0])) || [])[1])
    const k = [[bigS(d.tx), 'Nilai transaksi/aset', th.accent], [d.tx && mcap ? xS(d.tx / mcap) : '–', 'Terhadap kapitalisasi pasar', th.accent],
      [KJPP_SHORT[d.kjpp?.id] || '–', `Penilaian KJPP${d.aset?.kjpp?.nama ? ' · ' + short(d.aset.kjpp.nama, 30) : ''}`, tone(d.kjpp?.tone)]]
    k.forEach(([v, l, c], i) => kpi(s, M + i * (CW / 3), TOP, CW / 3 - 0.15, 1.05, v, l, c))
    T(s, `Mekanisme: ${d.mechLabel || 'belum diungkap'}`, { x: M, y: TOP + 1.25, w: CW, h: 0.25, fontSize: 11, bold: true, color: th.accent })
    const steps = d.steps || [], sw = CW / Math.max(1, steps.length)
    steps.forEach((st, i) => {
      const cx = M + sw * i + sw / 2, cy = TOP + 1.85
      if (i) line(s, cx - sw + 0.22, cy, sw - 0.44, 0, st.done ? th.good : th.line, { w: 2.5 })
      dot(s, cx, cy, 0.2, st.done ? th.good : th.card, { line: st.done ? th.good : th.line, lw: 2 })
      T(s, st.done ? '✓' : String(i + 1), { x: cx - 0.2, y: cy - 0.2, w: 0.4, h: 0.4, fontSize: 11, bold: true, color: st.done ? 'FFFFFF' : th.muted, align: 'center', valign: 'middle' })
      T(s, st.t, { x: cx - sw / 2 + 0.05, y: cy + 0.28, w: sw - 0.1, h: 0.55, fontSize: 8.5, align: 'center', color: st.done ? th.ink : th.muted, bold: st.done })
    })
    const desc = [as.aset?.sektor && `Sektor: ${as.aset.sektor}`, as.aset?.porsi && `Porsi: ${short(as.aset.porsi, 40)}`, as.aset?.deskripsi && short(as.aset.deskripsi, 120)].filter(Boolean).join('  ·  ')
    if (desc) T(s, desc, { x: M, y: TOP + 2.75, w: CW, h: 0.55, fontSize: 9.5, color: th.muted })
  }

  // ===== 8b. Rincian nilai aset injeksi (kisaran antar-sumber, cara bayar, KJPP, data belum diungkap) =====
  // Dilewati bila fakta dokumen tersedia: slide Kewajaran & Fakta dokumen sudah memuat nilainya.
  if (!info && !d.ri && !hasDoc) {
    const inj = d.ri?.inj || d.aset?.transaksi?.nilaiRp || null
    const det = d.ri?.detail || asetDetail(d.aset, inj)
    if (det && (det.lo || det.nama)) {
      const kj = det.kjpp
      const s = slide('Aset injeksi', 'Rincian Nilai Aset Injeksi', det.spread
        ? `Nilai aset masih indikatif, berkisar ${bigS(det.lo)} hingga ${bigS(det.hi)} menurut sumber yang berbeda; perhitungan memakai ${bigS(inj || det.hi)}.`
        : kj.status === 'terbit' ? `Nilai aset telah dinilai KJPP${kj.nilai ? ' sebesar ' + bigS(kj.nilai) : ''}.` : 'Nilai aset belum diuji oleh penilai independen (KJPP).')
      card(s, M, TOP, 3.3, 3.35, { fill: th.dark, line: th.dark })
      T(s, det.spread ? 'NILAI INDIKATIF (BERBEDA ANTARSUMBER)' : 'NILAI TRANSAKSI', { x: M + 0.2, y: TOP + 0.18, w: 2.9, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, det.spread ? `${bigS(det.lo)} – ${bigS(det.hi)}` : bigS(det.hi || inj), { x: M + 0.2, y: TOP + 0.45, w: 2.9, h: 0.7, fontFace: th.head, fontSize: det.spread ? 19 : 26, bold: true, color: 'FFFFFF', valign: 'middle' })
      if (det.spread && inj) T(s, `Dipakai dalam perhitungan: ${bigS(inj)}`, { x: M + 0.2, y: TOP + 1.15, w: 2.9, h: 0.25, fontSize: 9.5, color: th.accent2 })
      if (det.nilaiText) T(s, short(det.nilaiText, 260), { x: M + 0.2, y: TOP + 1.5, w: 2.9, h: 1.75, fontSize: 9, color: 'EAF2FA' })
      const cx = M + 3.5, cw = CW - 3.5
      const boxes = [
        ['Aset', [det.nama, det.jenis, [det.lokasi, det.porsi].filter(Boolean).join(' · '), ...det.facts.map(([l, v]) => `${l}: ${typeof v === 'number' ? bigS(v) : v}`)].filter(Boolean).join(' · ')],
        ['Cara bayar', det.cara],
        ['Penilaian independen (KJPP)', `${KJPP_SHORT[kj.status] || 'Belum ada'}${kj.nama ? ' · ' + kj.nama : ''}${kj.nilai ? ' · ' + bigS(kj.nilai) : ''}${kj.ket ? '. ' + kj.ket : ''}`],
      ].filter(b => b[1])
      // Tinggi kotak mengikuti panjang teks (±95 karakter per baris pada lebar ini).
      const lines = boxes.map(([, v]) => Math.min(3, Math.ceil(short(v, 280).length / 95)))
      const room = det.gaps.length ? 2.3 : 3.35
      const unit = (room - 0.1 * (boxes.length - 1) - 0.36 * boxes.length) / lines.reduce((a, b) => a + b, 0)
      let by = TOP
      boxes.forEach(([h, v], i) => {
        const bh = 0.36 + lines[i] * Math.min(0.2, unit)
        card(s, cx, by, cw, bh)
        T(s, h.toUpperCase(), { x: cx + 0.15, y: by + 0.07, w: cw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
        T(s, short(v, 280), { x: cx + 0.15, y: by + 0.28, w: cw - 0.3, h: bh - 0.32, fontSize: 8.5, color: th.ink, fit: 'shrink' })
        by += bh + 0.1
      })
      if (det.gaps.length) {
        const gy = Math.max(by + 0.05, TOP + 2.2)
        T(s, 'BELUM DIUNGKAP KE PUBLIK', { x: cx, y: gy, w: cw, h: 0.2, fontSize: 7.5, bold: true, color: th.bad, charSpacing: 2 })
        T(s, det.gaps.slice(0, 4).map((g, i, a) => ({ text: short(g, 95), options: { bullet: { indent: 10 }, breakLine: i < a.length - 1, paraSpaceAfter: 2 } })),
          { x: cx, y: gy + 0.24, w: cw, h: TOP + 3.35 - gy - 0.24, fontSize: 8.5, color: th.muted })
      }
    }
  }

  // ===== 8b2. Kewajaran aset & fakta dokumen asli (bila sudah diekstrak) =====
  // Bila ada rights issue, kewajaran, fakta dokumen, dan valuasi tampil di bagian Rights Issue.
  if (!info && !d.ri) { docSlides(K, th, d.riDoc); penilaianSlide(K, th, d.riDoc) }

  // ===== 9. Simulasi nilai KJPP (grafik) =====
  if (!d.ri && d.sim?.rows?.length) {
    const sm = d.sim
    const s = slide('Valuasi aset', 'Simulasi Nilai Wajar terhadap Harga Transaksi', sm.verdict?.t)
    const labels = [...sm.rows.map(r => short(r.k, 32)), 'Harga transaksi']
    const vals = [...sm.rows.map(r => +(r.v / 1e9).toFixed(1)), sm.tx ? +(sm.tx / 1e9).toFixed(1) : 0]
    s.addChart(pres.charts.BAR, [{ name: 'Rp miliar', labels, values: vals }], { ...chartBase(), x: M, y: TOP, w: 6.0, h: 3.35, barDir: 'bar',
      chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, valAxisLabelFormatCode: '#,##0', showLegend: false,
      showTitle: true, title: 'Nilai porsi aset (Rp miliar)', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
    kpi(s, M + 6.2, TOP, CW - 6.2, 1.05, sm.prem != null ? pctS(sm.prem) : '–', 'Selisih harga transaksi vs median simulasi', sm.prem > 0.15 ? th.bad : th.good)
    kpi(s, M + 6.2, TOP + 1.2, CW - 6.2, 1.05, sm.mid ? bigS(sm.mid) : '–', `Median simulasi · keyakinan ${sm.conf || '–'}`)
    T(s, `${peerNote(sm)} Ini simulasi, bukan laporan KJPP.`, { x: M + 6.2, y: TOP + 2.45, w: CW - 6.2, h: 0.85, fontSize: 9, color: th.muted })
  }

  // ===== 12. Valuasi & dilusi (grafik batang harga) =====
  {
    const pa = d.pa || {}, nw = pa.nilaiWajar || {}, dl = pa.dilusi || {}
    const pts = [['Harga kini', A.price], ['Harga PTW', A.tender?.price], ['Nilai wajar bawah', nw.bawah], ['Nilai wajar atas', nw.atas], ['Nilai/saham pasca transaksi', dl.nilaiPerSaham]].filter(x => x[1] > 0)
    if (pts.length >= 2 && !d.ri) {
      const s = slide('Valuasi dan dilusi', 'Perbandingan Harga dengan Patokan Nilai', nw.metode || dl.catatan)
      s.addChart(pres.charts.BAR, [{ name: 'Rp per saham', labels: pts.map(x => x[0]), values: pts.map(x => Math.round(x[1])) }], { ...chartBase(), x: M, y: TOP, w: 5.6, h: 3.35,
        barDir: 'col', chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, showLegend: false, valAxisLabelFormatCode: '#,##0',
        showTitle: true, title: 'Rupiah per saham', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
      const rx = M + 5.8, rw = CW - 5.8
      if (dl.berlaku && dl.porsiPublikSekarang != null && dl.porsiPublikSetelah != null) {
        card(s, rx, TOP, rw, 1.55)
        T(s, 'Porsi publik bila tidak ikut menebus', { x: rx + 0.18, y: TOP + 0.12, w: rw - 0.3, h: 0.25, fontSize: 9.5, bold: true, color: th.accent })
        T(s, `${id(dl.porsiPublikSekarang, 1)}%`, { x: rx + 0.18, y: TOP + 0.45, w: 1.2, h: 0.6, fontFace: th.head, fontSize: 24, bold: true, color: th.ink })
        line(s, rx + 1.4, TOP + 0.75, 0.45, 0, th.muted, { arrow: true, w: 2 })
        T(s, `${id(dl.porsiPublikSetelah, 1)}%`, { x: rx + 1.95, y: TOP + 0.45, w: 1.3, h: 0.6, fontFace: th.head, fontSize: 24, bold: true, color: th.bad })
        T(s, short(dl.asumsi || '', 80), { x: rx + 0.18, y: TOP + 1.08, w: rw - 0.3, h: 0.42, fontSize: 8, color: th.muted })
      }
      kpi(s, rx, TOP + 1.7, rw, 1.0, nw.bawah != null ? `${rpS(nw.bawah)}–${rpS(nw.atas)}` : '–', 'Rentang nilai wajar (pandangan analis)')
      T(s, A.price && nw.bawah ? `Harga kini ${pctS(A.price / nw.atas - 1)} dari batas atas` : '', { x: rx, y: TOP + 2.85, w: rw, h: 0.4, fontSize: 9.5, color: th.muted })
    }
  }

  // ===== 18. Kasus naik vs kasus turun (sama dengan tab Analisa), poin singkat =====
  {
    const bull = (A.bull || []).length ? A.bull : (d.pc?.pros || []).map(p => p.t)
    const bear = (A.bear || []).length ? A.bear : (d.pc?.cons || []).map(p => p.t)
    if (!info && (bull.length || bear.length)) {
      const notes = (A.notes || []).slice(0, 2)
      const s = slide('Kasus naik dan turun', 'Pendorong Kenaikan dan Risiko Penurunan', `Terdapat ${bull.length} pendorong kenaikan dan ${bear.length} risiko penurunan${bear.length > bull.length ? '; risiko lebih dominan' : ''}.`)
      const h = notes.length ? 2.6 : 3.35
      pointCard(s, M, TOP, CW / 2 - 0.1, h, '▲', th.good, 'Kasus naik', bull, { max: 5, n: 130 })
      pointCard(s, M + CW / 2 + 0.1, TOP, CW / 2 - 0.1, h, '!', th.bad, 'Kasus turun dan tanda bahaya', bear, { max: 5, n: 130 })
      if (notes.length) {
        card(s, M, TOP + 2.75, CW, 0.6, { fill: th.dark, line: th.dark })
        T(s, 'CATATAN ANALIS', { x: M + 0.2, y: TOP + 2.75, w: 1.6, h: 0.6, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2, valign: 'middle' })
        T(s, notes.map(x => short(x, 95)).join('   ·   '), { x: M + 1.85, y: TOP + 2.75, w: CW - 2.0, h: 0.6, fontSize: 9.5, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
      }
    }
  }

  // ---------- Bagian: Rights Issue (isi sama dengan analisa rights issue di website) ----------
  if (d.ri) riSlides(K, th, { ...d, c: d.ri, P: d.riP, U: 0 }, { inFull: true, info })

  // ---------- Bagian: Teknikal (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Teknikal')
  // ===== 13. Harga 1 tahun & posisi siklus (grafik garis) =====
  if (d.tech?.bars?.length) {
    const B = d.tech.bars, step = Math.max(1, Math.round(B.length / 60)), sm = B.filter((_, i) => i % step === 0 || i === B.length - 1)
    const labels = sm.map(b => fmtDate(b.d).replace(/ 20(\d\d)$/, " '$1")), close = sm.map(b => b.c)
    const series = [{ name: 'Harga penutupan', labels, values: close }]
    if (A.tender?.price) series.push({ name: 'Harga PTW', labels, values: sm.map(() => A.tender.price) })
    const cyc = d.cyc, ph = cyc ? phaseName(cyc.ph) : ''
    const s = slide('Harga dan siklus', ph ? `Posisi dalam Siklus: ${ph}` : 'Pergerakan Harga Satu Tahun Terakhir', cyc ? `${cyc.day} hari sejak PTW; puncak median kasus serupa ${cyc.model.peakDay != null ? Math.abs(Math.round(cyc.model.peakDay)) + ' hari ' + (cyc.model.peakDay < 0 ? 'sebelum' : 'sesudah') + ' PTW' : '–'}.` : d.tech.verdict)
    s.addChart(pres.charts.LINE, series, { ...chartBase(), x: M, y: TOP, w: 6.3, h: 3.35, lineSize: 2, lineDataSymbol: 'none', chartColors: [th.accent, th.warn],
      showLegend: true, legendPos: 'b', catAxisLabelFrequency: Math.max(1, Math.round(sm.length / 6)), valAxisLabelFormatCode: '#,##0',
      showTitle: true, title: 'Harga harian 1 tahun (Rp)', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
    const hi = Math.max(...B.map(b => b.h)), lo = Math.min(...B.map(b => b.l)), c = B[B.length - 1].c
    const rx = M + 6.5, rw = CW - 6.5
    kpi(s, rx, TOP, rw, 1.0, A.tender?.price ? pctS(c / A.tender.price - 1) : '–', 'Harga kini vs harga PTW', A.tender?.price && c < A.tender.price ? th.bad : th.good)
    kpi(s, rx, TOP + 1.15, rw, 1.0, `${rpS(lo)}–${rpS(hi)}`, 'Rentang terendah–tertinggi setahun')
    T(s, 'Posisi dalam rentang setahun', { x: rx, y: TOP + 2.35, w: rw, h: 0.22, fontSize: 9, bold: true, color: th.accent })
    hbar(s, rx, TOP + 2.65, rw, (c - lo) / ((hi - lo) || 1), th.accent, 0.16)
    T(s, `${Math.round((c - lo) / ((hi - lo) || 1) * 100)}% dari dasar ke puncak`, { x: rx, y: TOP + 2.88, w: rw, h: 0.25, fontSize: 9, color: th.muted })
  }

  // ===== 15. Teknikal (meteran sinyal + indikator) =====
  if (d.tech) {
    const { sig, verdict } = d.tech
    const s = slide('Teknikal', `Analisis Teknikal: Sinyal ${sig.sig?.[0] || '–'}`, verdict)
    // Meteran −6..+6 dalam 5 ruas warna.
    const gx = M, gw = 5.2, gy = TOP + 0.3
    const seg = [th.bad, 'E8888F', th.line, '8FD1AE', th.good], segW = gw / 5
    seg.forEach((c, i) => s.addShape(S.RECTANGLE, { x: gx + i * segW, y: gy, w: segW - 0.03, h: 0.3, fill: { color: c }, line: { color: c, width: 0.25 } }))
    ;['Jual kuat', 'Jual', 'Netral', 'Beli', 'Beli kuat'].forEach((t, i) => T(s, t, { x: gx + i * segW, y: gy + 0.36, w: segW, h: 0.2, fontSize: 8, align: 'center', color: th.muted }))
    const mx = gx + (sig.score + 6) / 12 * gw
    s.addShape(S.ISOSCELES_TRIANGLE, { x: mx - 0.12, y: gy - 0.28, w: 0.24, h: 0.22, rotate: 180, fill: { color: th.ink }, line: { color: th.ink, width: 0.5 } })
    T(s, `${sig.score > 0 ? '+' : ''}${sig.score} dari ±6`, { x: gx, y: gy + 0.62, w: gw, h: 0.3, fontSize: 12, bold: true, align: 'center' })
    // Suara tiap indikator sebagai kartu kecil.
    ;(sig.votes || []).slice(0, 6).forEach((v, i) => {
      const cw = (gw - 0.3) / 3, x = gx + (i % 3) * (cw + 0.15), y = TOP + 1.45 + Math.floor(i / 3) * 0.95, c = v.s > 0 ? th.good : v.s < 0 ? th.bad : th.muted
      card(s, x, y, cw, 0.82)
      T(s, v.k, { x: x + 0.12, y: y + 0.08, w: cw - 0.24, h: 0.22, fontSize: 9, bold: true })
      pill(s, x + 0.12, y + 0.33, v.s > 0 ? 'Beli' : v.s < 0 ? 'Jual' : 'Netral', c, { size: 8, h: 0.2, w: 0.65 })
      T(s, short(v.txt, 40), { x: x + 0.12, y: y + 0.56, w: cw - 0.24, h: 0.24, fontSize: 7, color: th.muted })
    })
    const rx = M + 5.5, rw = CW - 5.5
    ;[['Resistance terdekat', sig.res, th.bad], ['Support terdekat', sig.sup, th.good], ['Batas invalidasi', sig.stop, th.warn]].forEach(([l, v, c], i) =>
      kpi(s, rx, TOP + i * 1.12, rw, 1.0, rpS(v), `${l}${v && d.tech.bars ? ' · ' + pctS(v / d.tech.bars[d.tech.bars.length - 1].c - 1, 1) : ''}`, c))
  }

  // ===== 17. Trading plan (tangga harga) =====
  if (d.tech?.plan) {
    const pl = d.tech.planPola || d.tech.plan, c = d.tech.bars[d.tech.bars.length - 1].c
    const s = slide('Rencana transaksi', short(pl.type || 'Rencana Transaksi', 54), d.rec?.holder || pl.note)
    const vals = [pl.stop, pl.entryLo, pl.entryHi, pl.tp1, pl.tp2, c].filter(v => v > 0)
    if (pl.entry && vals.length >= 3) {
      const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03, x0 = M + 0.2, x1 = M + CW - 0.2, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), y = TOP + 0.9
      line(s, x0, y, x1 - x0, 0, th.line, { w: 4 })
      s.addShape(S.RECTANGLE, { x: X(pl.entryLo), y: y - 0.2, w: Math.max(0.06, X(pl.entryHi) - X(pl.entryLo)), h: 0.4, fill: { color: th.accent, transparency: 55 }, line: { color: th.accent, width: 0.5 } })
      const marks = [['Stop', pl.stop, th.bad], ['Entry', pl.entry, th.accent], ['Target 1', pl.tp1, th.good], ['Target 2', pl.tp2, th.good]]
      // Label bergantian atas/bawah; bila berdekatan (< 1,25") dengan label lain di sisi yang sama, pindah sisi,
      // dan bila kedua sisi penuh, ditumpuk satu tingkat lebih jauh dari garis (mis. Entry = Target 1).
      const dipakai = { atas: [], bawah: [] }
      marks.forEach(([l, v, col], i) => {
        if (!(v > 0)) return
        const x = X(v), dekat = sisi => dipakai[sisi].filter(p => Math.abs(p - x) < 1.25).length
        let sisi = i % 2 ? 'bawah' : 'atas'
        if (dekat(sisi) && !dekat(sisi === 'atas' ? 'bawah' : 'atas')) sisi = sisi === 'atas' ? 'bawah' : 'atas'
        const tingkat = dekat(sisi)
        dipakai[sisi].push(x)
        line(s, x, y - 0.35, 0, 0.7, col, { w: 2 })
        const yl = sisi === 'bawah' ? y + 0.42 + tingkat * 0.42 : y - 0.68 - tingkat * 0.42
        T(s, l, { x: x - 0.6, y: yl, w: 1.2, h: 0.2, fontSize: 9, bold: true, color: col, align: 'center' })
        T(s, rpS(v), { x: x - 0.6, y: yl + 0.2, w: 1.2, h: 0.2, fontSize: 9.5, bold: true, align: 'center' })
      })
      dot(s, X(c), y, 0.09, th.dark)
    }
    if (pl.entry) {
      const rows = [['Zona entry', `${rpS(pl.entryLo)}–${rpS(pl.entryHi)}`], ['Stop loss', `${rpS(pl.stop)} (${pctS(pl.stop / pl.entry - 1, 1)})`],
        ['Target 1', pl.tp1 ? `${rpS(pl.tp1)} (${pctS(pl.tp1 / pl.entry - 1, 1)})` : '–'], ['Target 2', pl.tp2 ? `${rpS(pl.tp2)} (${pctS(pl.tp2 / pl.entry - 1, 1)})` : '–']]
      rows.forEach(([k, v], i) => kpi(s, M + i * (CW / 4), TOP + 2.0, CW / 4 - 0.15, 1.2, v, k, i === 1 ? th.bad : i >= 2 ? th.good : th.accent))
    } else {
      // Tanpa setup beli: rencana bagi pemegang — area jual saat rebound, batas keluar, dan syarat masuk kembali.
      const sig = d.tech.sig
      kpi(s, M, TOP, CW / 3 - 0.1, 1.3, rpS(sig.res), `Area kurangi posisi saat rebound · ${pctS(sig.res / c - 1, 1)}`, th.warn)
      kpi(s, M + CW / 3 + 0.05, TOP, CW / 3 - 0.1, 1.3, rpS(pl.stop), `Keluar penuh bila ditutup di bawah · ${pctS(pl.stop / c - 1, 1)}`, th.bad)
      kpi(s, M + 2 * CW / 3 + 0.1, TOP, CW / 3 - 0.1, 1.3, rpS(c), 'Harga kini', th.ink)
      T(s, 'Syarat masuk kembali', { x: M, y: TOP + 1.55, w: CW, h: 0.25, fontSize: 11, bold: true, color: th.accent })
      ;['Parabolic SAR berbalik ke bawah harga', 'MACD memotong ke atas garis sinyal', `Harga ditutup di atas ${rpS(sig.res)} dengan volume ≥ 1,5× rata-rata`].forEach((t, i) => {
        const x = M + i * (CW / 3 + 0.05), w = CW / 3 - 0.1
        card(s, x, TOP + 1.9, w, 0.9, { flat: true })
        dot(s, x + 0.3, TOP + 2.35, 0.15, th.accent)
        T(s, String(i + 1), { x: x + 0.15, y: TOP + 2.2, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
        T(s, t, { x: x + 0.6, y: TOP + 1.95, w: w - 0.7, h: 0.8, fontSize: 9.5, valign: 'middle' })
      })
    }
  }

  // ---------- Bagian: Spekulasi (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Spekulasi')
  // ===== 14. Skenario harga (tangga level) =====
  if ((A.levels || []).length && A.price) {
    const lv = A.levels.slice(0, 5)
    const s = slide('Skenario', 'Analisis Skenario Harga', A.rr != null ? `Dari harga saat ini (${rpS(A.price)}), rasio imbal hasil terhadap risiko adalah ${id(A.rr, 1)} : 1.` : '')
    // Batang divergen: tiap level satu baris (tertinggi di atas); hijau ke kanan = naik, merah ke kiri = turun dari harga kini.
    const rows = [...lv.map(l => ({ k: l[0], why: l[1], v: l[2] })), { k: 'Harga kini', why: A.priceDate ? fmtDate(A.priceDate) : '', v: A.price, now: true }]
      .sort((a, b) => b.v - a.v)
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.v / A.price - 1)), 0.05)
    const lblW = 3.3, axis = M + lblW + 1.0 + (CW - lblW - 1.0) / 2, half = (CW - lblW - 1.0) / 2 - 0.65
    const rh = Math.min(0.6, 3.3 / rows.length)
    line(s, axis, TOP - 0.05, 0, rows.length * rh + 0.05, th.ink, { w: 1.25 })
    rows.forEach((r, i) => {
      const y = TOP + i * rh, ch = r.v / A.price - 1, c = r.now ? th.dark : ch >= 0 ? th.good : th.bad
      T(s, r.k, { x: M, y: y + 0.02, w: lblW, h: 0.22, fontSize: 10, bold: true, color: r.now ? th.ink : th.ink })
      T(s, short(r.why, 60), { x: M, y: y + 0.24, w: lblW, h: 0.22, fontSize: 8, color: th.muted })
      T(s, rpS(r.v), { x: M + lblW, y: y + 0.08, w: 0.95, h: 0.3, fontSize: 12, bold: true, color: c, align: 'right' })
      if (r.now) { dot(s, axis, y + rh / 2 - 0.04, 0.11, th.dark); return }
      const bw = Math.max(0.05, Math.abs(ch) / maxAbs * half)
      s.addShape(S.RECTANGLE, { x: ch >= 0 ? axis : axis - bw, y: y + 0.1, w: bw, h: rh - 0.24, fill: { color: c, transparency: 15 }, line: { color: c, width: 0.25 } })
      T(s, pctS(ch), { x: ch >= 0 ? axis + bw + 0.06 : axis - bw - 0.66, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 10, bold: true, color: c, align: ch >= 0 ? 'left' : 'right' })
    })
  }

  // ---------- Bagian: Penutup (struktur karya ilmiah: kesimpulan di akhir) ----------
  K.setSec('Penutup')
  // ===== 1b. Rekomendasi (tindakan, area harga, porsi, alasan) =====
  if (!info && d.rec) {
    const rc = d.rec, col = recTone(rc.tone)
    const s = slide('Rekomendasi', 'Rekomendasi Investasi', rc.holder)
    card(s, M, TOP, 3.35, 3.35, { fill: th.dark, line: th.dark })
    T(s, 'TINDAKAN', { x: M + 0.2, y: TOP + 0.18, w: 3, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 3 })
    T(s, rc.label, { x: M + 0.2, y: TOP + 0.42, w: 2.95, h: 0.85, fontFace: th.head, fontSize: 20, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    ;[['Porsi maksimal', rc.porsi], ['Profil risiko', rc.profil], ['Horizon', short(rc.horizon, 64)]].forEach(([k, v], i) => {
      const y = TOP + 1.38 + i * 0.64
      T(s, k.toUpperCase(), { x: M + 0.2, y, w: 2.95, h: 0.2, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, v, { x: M + 0.2, y: y + 0.2, w: 2.95, h: 0.42, fontSize: 9.5, color: 'F8FAFC' })
    })
    const x = M + 3.5, w = CW - 3.5, bw = (w - 0.3) / 3
    const tg = rc.targets.map(t => `${rpS(t.p)} ${A.price ? '(' + pctS(t.p / A.price - 1, 0) + ')' : ''}`).join(' · ')
    ;[
      ['Area beli', rc.entry ? (rc.entry[1] ? `${rpS(rc.entry[0])}–${rpS(rc.entry[1])}` : `> ${rpS(rc.entry[0])}`) : 'Tidak ada', short(rc.entryNote || 'belum ada setup beli', 80), th.accent],
      ['Batas risiko', rpS(rc.stop), A.price && rc.stop ? `${pctS(rc.stop / A.price - 1, 1)} dari harga kini ${rpS(A.price)}` : '', th.bad],
      ['Target', rc.targets[0] ? rpS(rc.targets[0].p) : '–', short(tg || 'belum ada target', 80), th.good],
    ].forEach(([k, v, n, c2], i) => {
      const bx = x + i * (bw + 0.15)
      card(s, bx, TOP, bw, 1.35)
      T(s, k.toUpperCase(), { x: bx + 0.15, y: TOP + 0.12, w: bw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, v, { x: bx + 0.15, y: TOP + 0.34, w: bw - 0.3, h: 0.5, fontFace: th.head, fontSize: 18, bold: true, color: c2, valign: 'middle', fit: 'shrink' })
      T(s, n, { x: bx + 0.15, y: TOP + 0.86, w: bw - 0.3, h: 0.45, fontSize: 8, color: th.muted })
    })
    card(s, x, TOP + 1.5, w, 1.85)
    T(s, 'ALASAN UTAMA', { x: x + 0.18, y: TOP + 1.6, w: w - 0.36, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
    T(s, rc.why.slice(0, 4).map((r, i, a) => ({ text: `${r.s > 0 ? 'Pendukung: ' : r.s < 0 ? 'Risiko: ' : 'Catatan: '}${short(r.t, 95)}`, options: { color: r.s > 0 ? th.good : r.s < 0 ? th.bad : th.ink, breakLine: i < a.length - 1, paraSpaceAfter: 3 } })),
      { x: x + 0.18, y: TOP + 1.84, w: w - 0.36, h: 1.45, fontSize: 9 })
  }

  // ===== 20b. Rencana aksi: bila terkonfirmasi / sekarang / bila gagal =====
  if (!info && d.rec) {
    const rc = d.rec
    const s = slide('Rencana tindakan', 'Rencana Tindakan Berdasarkan Skenario', rc.catalyst ? `Katalis berikutnya adalah ${rc.catalyst}.` : rc.holder)
    const cw = (CW - 0.3) / 3
    const tg = rc.targets.map(t => `${rpS(t.p)} (${t.l})`)
    ;[
      ['BILA TERKONFIRMASI', th.good, 'Syarat:', [...rc.triggers, ...(d.pa?.variabelKunci || [])].slice(0, 3), `Tindakan: ${rc.tier === 'akumulasi' ? 'tambah posisi bertahap' : 'mulai posisi kecil'}${rc.entry ? ` di area ${rc.entry[1] ? rpS(rc.entry[0]) + '–' + rpS(rc.entry[1]) : 'di atas ' + rpS(rc.entry[0])}` : ''}; target ${tg[0] || '–'}.`],
      ['KONDISI SEKARANG', recTone(rc.tone), 'Rekomendasi:', [rc.label, `Porsi: ${rc.porsi}`, `Profil risiko: ${rc.profil}`], rc.holder],
      ['BILA TESIS GAGAL', th.bad, 'Sinyal keluar:', [...rc.exits, ...(d.pa?.tesisSalahBila || [])].slice(0, 3), `Tindakan: keluar/hindari; batas risiko ${rpS(rc.stop)}.`],
    ].forEach(([h, col, sub, list, act], i) => {
      const x = M + i * (cw + 0.15)
      card(s, x, TOP, cw, 3.35)
      s.addShape(S.RECTANGLE, { x, y: TOP, w: cw, h: 0.08, fill: { color: col }, line: { color: col, width: 0 } })
      T(s, h, { x: x + 0.18, y: TOP + 0.2, w: cw - 0.36, h: 0.22, fontSize: 8.5, bold: true, color: col, charSpacing: 2 })
      T(s, sub, { x: x + 0.18, y: TOP + 0.48, w: cw - 0.36, h: 0.2, fontSize: 8, bold: true, color: th.muted })
      T(s, (list.length ? list : ['belum ada']).map((t, k, a) => ({ text: short(t, 130), options: { bullet: { indent: 10 }, breakLine: k < a.length - 1, paraSpaceAfter: 3 } })),
        { x: x + 0.18, y: TOP + 0.7, w: cw - 0.36, h: 1.75, fontSize: 8.5, color: th.ink, fit: 'shrink' })
      T(s, short(act, 170), { x: x + 0.18, y: TOP + 2.5, w: cw - 0.36, h: 0.78, fontSize: 8.5, bold: true, color: th.ink })
    })
  }

  // ===== 21. Kesimpulan (gelap) =====
  {
    const pa = d.pa || {}
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line, true)
    T(s, 'KESIMPULAN', { x: 0.7, y: 0.6, w: 5, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, short(pa.sikap || A.stance?.t || 'Kesimpulan', 40), { x: 0.7, y: 0.95, w: 6.2, h: 0.8, fontFace: th.head, fontSize: 34, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    const pts = [pa.ringkas, A.stance?.t, d.pos?.next ? 'Berikutnya: ' + d.pos.next : null, (pa.variabelKunci || [])[0] ? 'Kunci: ' + pa.variabelKunci[0] : null].filter(Boolean).slice(0, 4)
    pts.forEach((p, i) => {
      const y = 2.0 + i * 0.62
      dot(s, 0.85, y + 0.17, 0.08, th.accent2)
      T(s, short(p, 170), { x: 1.1, y, w: 5.6, h: 0.58, fontSize: 11.5, color: 'F8FAFC' })
    })
    T(s, `${d.rec ? 'Rekomendasi: ' + d.rec.label + '  ·  ' : ''}Skor ${A.score ?? '–'}/100  ·  Harga ${rpS(A.price)}`, { x: 0.7, y: 4.65, w: 6.2, h: 0.3, fontSize: 11, bold: true, color: th.accent2 })
    T(s, 'Laporan ini disusun secara otomatis dari data Stockbit dan sumber publik dengan kerangka analisis yang terukur. Laporan ini bukan merupakan rekomendasi untuk membeli atau menjual efek.', { x: 0.7, y: 5.0, w: 6.5, h: 0.3, fontSize: 8.5, color: 'DCE7F3' })
  }

  // ===== 22. Lampiran: sumber & batasan =====
  if (!info) {
    const pf = d.profil || {}
    const src = [...new Set([...(pf.pengendali || []).flatMap(o => o.sumber || []), ...(pf.afiliasi?.sumber || []), ...(d.aset?.sumber ? [].concat(d.aset.sumber) : [])])].slice(0, 7)
    const reps = (d.reports || []).slice(0, 6).map(r => `${fmtDate(String(r.date).slice(0, 10))} · ${r.title}`)
    const gaps = (pf.tidakDitemukan || []).slice(0, 6)
    const s = slide('Lampiran', 'Sumber Data dan Batasan Analisis', '')
    ;[['Sumber riset', src], ['Keterbukaan informasi terbaru', reps], ['Belum ditemukan di sumber publik', gaps]].forEach(([h, list], k) => {
      const x = M + k * (CW / 3), w = CW / 3 - 0.15
      card(s, x, TOP, w, 3.75)
      T(s, h, { x: x + 0.15, y: TOP + 0.12, w: w - 0.3, h: 0.25, fontSize: 10, bold: true, color: th.accent })
      T(s, list.length ? list.map((t, i) => ({ text: short(t, 95), options: { bullet: { indent: 12 }, breakLine: i < list.length - 1, paraSpaceAfter: 4 } })) : 'belum ada',
        { x: x + 0.15, y: TOP + 0.45, w: w - 0.3, h: 3.2, fontSize: 8, color: th.muted })
    })
  }

  return pres
}

// Teks panjang → poin per kalimat (untuk kartu poin).
const points = (t, n = 3) => sentences(t).map(x => x.trim().replace(/\.$/, '')).filter(x => x.length > 12).slice(0, n)

// Level acuan harga (seperti "Potensi target harga" di tab Profil), urut dari terendah.
function priceLevels(d) {
  const A = d.A || {}, m = A.p?.metrics || {}, nw = d.pa?.nilaiWajar || {}, rows = []
  if (m.bvps > 0) rows.push(['Nilai buku (PBV 1×)', m.bvps])
  if (A.tender?.price) rows.push(['Harga penawaran tender', A.tender.price])
  if (m.low52 > 0) rows.push(['Terendah 52 minggu', m.low52])
  if (m.high52 > 0) rows.push(['Tertinggi 52 minggu', m.high52])
  if (nw.bawah > 0) rows.push(['Nilai wajar bawah (analis)', nw.bawah])
  if (nw.atas > 0) rows.push(['Nilai wajar atas (analis)', nw.atas])
  return rows.sort((a, b) => a[1] - b[1])
}

// Versi infografis: enam angka kunci besar berikon (harga, kapitalisasi, pengendali, publik, nilai transaksi, skor).
function infoStatsSlide(K, th, d) {
  const { T, card, icon, slide, hbar } = K
  const A = d.A || {}, m = A.p?.metrics || {}, st = A.p?.stats || {}
  const nilai = d.tx || d.ri?.inj || null
  const tiles = [
    ['Rp', rpS(A.price), 'Harga terakhir', A.tender?.price ? `PTW ${rpS(A.tender.price)} (${pctS(A.price / A.tender.price - 1)})` : m.ret1y ? `1 tahun ${pctId(m.ret1y)}` : ''],
    ['Kap', bigS(st.marketCap || A.mcap), 'Kapitalisasi pasar', m.pbv != null ? `PBV ${id(m.pbv, 2)}×` : ''],
    ['Ctl', A.ctrlPct != null ? id(A.ctrlPct, 1) + '%' : '–', 'Porsi pengendali', short(entName(A.ctrlName || ''), 34)],
    ['Pub', A.flt != null ? id(A.flt, 1) + '%' : '–', 'Porsi publik', A.flt != null && A.flt < 7.5 ? 'di bawah syarat 7,5%' : ''],
    ['Tx', nilai ? bigS(nilai) : 'belum ada', 'Nilai transaksi/aset', nilai && A.mcap ? `${xS(nilai / A.mcap)} kapitalisasi` : ''],
    ['Skor', A.score != null ? `${A.score}/100` : '–', 'Skor analisis', d.prog ? `progres transaksi ${d.prog.pct}%` : ''],
  ]
  const s = slide('Angka kunci', `${d.t} dalam Angka`, d.rec ? `Rekomendasi: ${d.rec.label}.` : '')
  const cw = (CW - 0.3) / 3, ch = 1.6
  tiles.forEach(([g, v, l, n], i) => {
    const x = M + (i % 3) * (cw + 0.15), y = TOP + Math.floor(i / 3) * (ch + 0.15)
    card(s, x, y, cw, ch)
    // Singkatan teks (bukan simbol) agar tampil sama di PPTX dan PDF.
    icon(s, x + 0.42, y + 0.42, 0.24, g, i === 5 ? th.good : th.accent)
    T(s, v, { x: x + 0.8, y: y + 0.16, w: cw - 0.95, h: 0.55, fontFace: th.head, fontSize: 24, bold: true, valign: 'middle', fit: 'shrink' })
    T(s, l.toUpperCase(), { x: x + 0.2, y: y + 0.82, w: cw - 0.4, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    T(s, n || '', { x: x + 0.2, y: y + 1.06, w: cw - 0.4, h: 0.26, fontSize: 9, color: th.muted, fit: 'shrink' })
    if (i === 5 && A.score != null) hbar(s, x + 0.2, y + 1.36, cw - 0.4, A.score / 100, A.score >= 65 ? th.good : A.score >= 45 ? th.warn : th.bad, 0.1)
    if (i === 2 && A.ctrlPct != null) hbar(s, x + 0.2, y + 1.36, cw - 0.4, A.ctrlPct / 100, th.accent, 0.1)
    if (i === 3 && A.flt != null) hbar(s, x + 0.2, y + 1.36, cw - 0.4, A.flt / 100, th.muted, 0.1)
  })
}

// Ringkasan eksekutif di awal presentasi: (1) headline transaksi/rencana korporasi dengan diagram struktur
// pengendali → emiten ← aset injeksi, plus angka kunci; (2) rekomendasi investasi singkat. Rincian tetap di slide bagian berikutnya.
function headlineSlides(K, th, d) {
  const { T, card, pill, line, slide, icon } = K
  const A = d.A || {}, st = d.story || {}, sv = A.sv || {}, pv = d.pv || {}, af = d.profil?.afiliasi || {}
  const ri = d.ri, riR = d.riR
  const injT = ri?.injTarget || sv.injectTarget || d.aset?.aset?.nama || st.inject
  const inj = [sv.injectType, injT].filter(Boolean).join(' · ')
  const nilai = d.tx || ri?.inj || null
  const who = String(pv.siapa || A.ctrlName || d.item?.acquirer || '').replace(/\s*\(.*?\)/g, '').trim()
  const baru = st.baru || sv.baru

  // ===== 1a. Headline transaksi / rencana korporasi (diagram struktur) =====
  if (who || inj || ri) {
    const jenis = ri ? (ri.kind === 'merger' ? 'Merger' : /pmthmetd|tanpa hmetd/i.test(ri.jenis || '') ? 'Penambahan modal tanpa HMETD' : 'Rights issue')
      : inj ? 'Injeksi aset' : 'Pengambilalihan pengendali'
    const head = `${d.t}: ${jenis}${injT ? ' untuk ' + entName(injT) : who ? ' oleh ' + entName(who) : ''}${nilai ? ' senilai ' + bigS(nilai) : ''}`
    // Laporan terbaru (lebih baru dari analisa) didahulukan agar ringkasan tidak tertinggal.
    const lb = d.lapBaru?.items?.[0]
    const take = lb ? `Laporan ${fmtDate(lb.date)}: ${lb.points[0] || lb.title}.${d.pos?.next ? ' Tahap berikutnya: ' + d.pos.next + '.' : ''}`
      : d.pos?.next ? `Posisi saat ini: ${d.pos.now || '–'}. Tahap berikutnya: ${d.pos.next}.` : (pv.rencana ? points(pv.rencana, 1)[0] : '')
    const s = slide('Ringkasan transaksi', short(head, 90), take)

    // Diagram: pengendali lama ↓ pengendali baru → EMITEN ← aset injeksi (↑ pemilik/penjual aset).
    const bw = 2.45, bh = 0.72, cy = TOP + 1.5
    const lx = M, ex = M + 3.25, ew = 2.6, rx = W - M - bw
    const node = (x, y, title, sub, o = {}) => {
      card(s, x, y, bw, bh, o.fill ? { fill: o.fill, line: o.fill } : {})
      T(s, title.toUpperCase(), { x: x + 0.14, y: y + 0.07, w: bw - 0.28, h: 0.18, fontSize: 7, bold: true, color: o.fill ? 'FFFFFF' : th.accent, charSpacing: 2 })
      T(s, short(sub || 'belum diungkap', 60), { x: x + 0.14, y: y + 0.26, w: bw - 0.28, h: bh - 0.32, fontSize: 9.5, bold: true, color: o.fill ? 'FFFFFF' : th.ink, valign: 'middle', fit: 'shrink' })
    }
    if (st.oldName) {
      node(lx, TOP, 'Pengendali lama', `${entName(st.oldName)}${st.oldPct ? ' (' + pctId(st.oldPct) + (/%/.test(st.oldPct) ? '' : '%') + ')' : ''}`)
      line(s, lx + bw / 2, TOP + bh, 0, cy - bh / 2 - TOP - bh, th.muted, { arrow: true, w: 1.5 })
      T(s, 'melepas saham', { x: lx + bw / 2 + 0.08, y: TOP + bh + 0.02, w: 1.4, h: 0.2, fontSize: 7.5, color: th.muted })
    }
    node(lx, cy - bh / 2, 'Pengendali baru', who || 'belum diketahui', { fill: th.accent })
    line(s, lx + bw, cy, ex - lx - bw, 0, th.accent, { arrow: true, w: 2 })
    T(s, A.ctrlPct != null ? `kuasai ${id(A.ctrlPct, 1)}%` : 'ambil alih', { x: lx + bw, y: cy - 0.26, w: ex - lx - bw, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, align: 'center' })
    // Emiten (pusat diagram): kode, nama, bisnis lama → baru.
    card(s, ex, TOP + 0.5, ew, 1.78, { fill: th.dark, line: th.dark })
    T(s, d.t, { x: ex, y: TOP + 0.65, w: ew, h: 0.5, fontFace: th.head, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, short(d.name, 40), { x: ex + 0.1, y: TOP + 1.13, w: ew - 0.2, h: 0.22, fontSize: 8.5, color: 'DCE7F3', align: 'center' })
    T(s, [{ text: 'Bisnis lama: ', options: { bold: true, color: th.accent2 } }, { text: short(st.lama || 'belum diketahui', 50), options: { breakLine: true } },
      { text: 'Bisnis baru: ', options: { bold: true, color: th.accent2 } }, { text: short(baru || 'belum diungkap', 50) }],
      { x: ex + 0.15, y: TOP + 1.42, w: ew - 0.3, h: 0.95, fontSize: 8.5, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    if (inj || ri) {
      node(rx, cy - bh / 2, ri && !inj ? 'Penambahan modal' : 'Aset injeksi', inj || (riR ? `Penerbitan ${bigS(riR.total)}` : jenis))
      line(s, rx, cy, ex + ew - rx, 0, th.accent, { arrow: true, w: 2 })
      T(s, nilai ? bigS(nilai) : 'masuk ke emiten', { x: ex + ew, y: cy - 0.26, w: rx - ex - ew, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, align: 'center' })
      if (af.pihakLawan) {
        node(rx, TOP, 'Pemilik/penjual aset', af.pihakLawan)
        line(s, rx + bw / 2, TOP + bh, 0, cy - bh / 2 - TOP - bh, th.muted, { arrow: true, w: 1.5 })
      }
    }

    // Angka kunci transaksi.
    const p = d.prog
    const tiles = [
      ['Nilai transaksi', nilai ? bigS(nilai) : riR ? bigS(riR.total) : 'belum diungkap', nilai && A.mcap ? `${xS(nilai / A.mcap)} kapitalisasi pasar` : ''],
      ['Mekanisme', d.mechLabel || (ri ? jenis : st.takeoverDate ? 'Akuisisi saham' : 'belum diungkap'), riR?.dilusi != null ? `dilusi ${id(riR.dilusi * 100, 1)}% bila tidak ikut` : ''],
      ['Progres', p ? `${p.pct}% tahapan` : 'belum dipantau', short(d.pos?.now || '', 50)],
      ['Harga kini vs PTW', rpS(A.price), A.tender?.price ? `PTW ${rpS(A.tender.price)} (${pctS(A.price / A.tender.price - 1)})` : st.takeoverDate ? 'masuk ' + fmtDate(st.takeoverDate) : ''],
    ]
    const tw = (CW - 0.45) / 4, ty = TOP + 2.45
    tiles.forEach(([k, v, n], i) => {
      const x = M + i * (tw + 0.15)
      card(s, x, ty, tw, 0.98)
      T(s, k.toUpperCase(), { x: x + 0.14, y: ty + 0.08, w: tw - 0.28, h: 0.18, fontSize: 7, bold: true, color: th.accent, charSpacing: 2 })
      T(s, v, { x: x + 0.14, y: ty + 0.27, w: tw - 0.28, h: 0.36, fontSize: 12, bold: true, valign: 'middle', fit: 'shrink' })
      T(s, n, { x: x + 0.14, y: ty + 0.64, w: tw - 0.28, h: 0.28, fontSize: 7.5, color: th.muted, fit: 'shrink' })
    })
  }

  // ===== 1b. Rekomendasi investasi singkat (rincian lengkap di bagian Penutup) =====
  const rc = d.rec
  if (rc) {
    const pa = d.pa || {}, col = rc.tone === 'good' ? th.good : rc.tone === 'bad' ? th.bad : th.warn
    const s = slide('Ringkasan rekomendasi', `Rekomendasi Investasi: ${rc.label}`, pa.ringkas || rc.holder)
    // Kiri: tindakan, sikap analis, nilai wajar, porsi & horizon.
    card(s, M, TOP, 3.2, 3.35, { fill: th.dark, line: th.dark })
    icon(s, M + 0.42, TOP + 0.42, 0.22, rc.tone === 'good' ? '▲' : rc.tone === 'bad' ? '▼' : '■', col)
    T(s, 'TINDAKAN', { x: M + 0.75, y: TOP + 0.22, w: 2.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 3 })
    T(s, rc.label, { x: M + 0.75, y: TOP + 0.42, w: 2.3, h: 0.45, fontFace: th.head, fontSize: 16, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    const nw = pa.nilaiWajar
    ;[['Sikap analis', pa.sikap || A.stance?.t], ['Nilai wajar', nw ? `${rpS(nw.bawah)}–${rpS(nw.atas)} (kini ${rpS(A.price)})` : null],
      ['Porsi maksimal', rc.porsi], ['Horizon', rc.horizon], ['Skor', A.score != null ? `${A.score}/100` : null]].filter(x => x[1]).slice(0, 5).forEach(([k, v], i) => {
      const y = TOP + 1.0 + i * 0.47
      T(s, k.toUpperCase(), { x: M + 0.2, y, w: 2.8, h: 0.17, fontSize: 7, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, short(v, 60), { x: M + 0.2, y: y + 0.17, w: 2.8, h: 0.25, fontSize: 9, color: 'F8FAFC', fit: 'shrink' })
    })
    // Kanan atas: area beli, batas risiko, target.
    const x = M + 3.35, w = CW - 3.35, bw = (w - 0.3) / 3
    ;[
      ['Area beli', rc.entry ? (rc.entry[1] ? `${rpS(rc.entry[0])}–${rpS(rc.entry[1])}` : `> ${rpS(rc.entry[0])}`) : 'Tunggu', short(rc.entryNote || '', 60)],
      ['Batas risiko', rc.stop ? rpS(rc.stop) : 'belum ada', A.price && rc.stop ? `${pctS(rc.stop / A.price - 1, 1)} dari harga kini` : ''],
      rc.targets?.[0] ? ['Target', rpS(rc.targets[0].p), rc.targets.slice(0, 2).map(t => `${rpS(t.p)}${A.price ? ' (' + pctS(t.p / A.price - 1) + ')' : ''}`).join(' · ')]
        : ['Target', nw?.atas ? rpS(nw.atas) : 'belum ada', nw?.atas && A.price ? `nilai wajar atas analis (${pctS(nw.atas / A.price - 1)})` : ''],
    ].forEach(([k, v, n], i) => {
      const bx = x + i * (bw + 0.15)
      card(s, bx, TOP, bw, 1.15)
      T(s, k.toUpperCase(), { x: bx + 0.14, y: TOP + 0.1, w: bw - 0.28, h: 0.18, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, v, { x: bx + 0.14, y: TOP + 0.3, w: bw - 0.28, h: 0.42, fontFace: th.head, fontSize: 16, bold: true, valign: 'middle', fit: 'shrink' })
      T(s, n, { x: bx + 0.14, y: TOP + 0.74, w: bw - 0.28, h: 0.36, fontSize: 7.5, color: th.muted, fit: 'shrink' })
    })
    // Kanan bawah: alasan pendukung vs risiko.
    const why = rc.why || [], pro = why.filter(r => r.s > 0).map(r => r.t), con = why.filter(r => r.s < 0).map(r => r.t)
    const hw = (w - 0.15) / 2
    K.pointCard(s, x, TOP + 1.3, hw, 2.05, '+', th.good, 'Alasan berinvestasi', [pro, A.bull, (d.pc?.pros || []).map(p => p.t)].find(x => x?.length) || [], { max: 3, n: 110, size: 8.5, empty: 'Belum ada pendukung kuat.' })
    K.pointCard(s, x + hw + 0.15, TOP + 1.3, hw, 2.05, '!', th.bad, 'Risiko utama', [con, A.bear, (d.pc?.cons || []).map(p => p.t)].find(x => x?.length) || [], { max: 3, n: 110, size: 8.5, empty: 'Tidak ada risiko menonjol.' })
  }
}

// Garis dari (x,y) sejauh (w,h). PowerPoint menolak ukuran negatif (berkas dianggap rusak), jadi arah
// ke kiri/atas dinyatakan dengan flipH/flipV dan kotak garisnya dinormalkan.
function lineShape(s, S, x, y, w, h, color, o = {}) {
  const flipH = w < 0, flipV = h < 0
  return s.addShape(S.LINE, { x: flipH ? x + w : x, y: flipV ? y + h : y, w: Math.abs(w), h: Math.abs(h), flipH, flipV,
    line: { color, width: o.w || 1.25, dashType: o.dash || 'solid', endArrowType: o.arrow ? 'triangle' : undefined, transparency: o.tr || 0 } })
}

// Motif sampul sesuai sektor bisnis (bentuk sederhana, warna aksen tema).
function coverArt(s, motif, th, S, dot, line, small = false) {
  // Versi kecil (slide kesimpulan) digeser ke kanan agar tidak menabrak teks.
  const cx = small ? 8.55 : 7.6, cy = 2.8, k = small ? 0.62 : 1
  const a = th.accent, b = th.accent2
  switch (motif) {
    case 'strata':
      for (let i = 0; i < 6; i++) s.addShape(S.RECTANGLE, { x: cx - 2.2 * k + i * 0.12, y: cy - 1.6 * k + i * 0.55 * k, w: (4.4 - i * 0.24) * k, h: 0.38 * k, fill: { color: i % 2 ? a : b, transparency: 30 + i * 10 }, line: { color: a, width: 0.5, transparency: 60 } })
      break
    case 'hex':
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s.addShape(S.HEXAGON, { x: cx - 1.9 * k + c * 1.25 * k + (r % 2) * 0.62 * k, y: cy - 1.7 * k + r * 1.08 * k, w: 1.15 * k, h: 1.0 * k, fill: { color: (r + c) % 3 ? a : b, transparency: (r + c) % 3 ? 55 : 20 }, line: { color: b, width: 1 } })
      break
    case 'rings':
      ;[2.2, 1.65, 1.1].forEach((r, i) => dot(s, cx, cy, r * k, a, { tr: 100, line: i ? a : b, lw: 1.5, ltr: 20 * i }))
      dot(s, cx, cy, 0.55 * k, b, { tr: 10 })
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4; line(s, cx + Math.cos(ang) * 0.7 * k, cy + Math.sin(ang) * 0.7 * k, Math.cos(ang) * 0.35 * k, Math.sin(ang) * 0.35 * k, b, { w: 2 }) }
      break
    case 'plus':
      ;[[0, 0, 1.6], [-1.6, -1.1, 0.8], [1.5, 1.2, 0.9], [1.4, -1.4, 0.55]].forEach(([dx, dy, z], i) => s.addShape(S.MATH_PLUS, { x: cx + dx * k - z * k / 2, y: cy + dy * k - z * k / 2, w: z * k, h: z * k, fill: { color: i ? a : b, transparency: i ? 40 : 0 }, line: { color: b, width: 0.5 } }))
      dot(s, cx, cy, 1.9 * k, a, { tr: 100, line: a, lw: 1.5 })
      break
    case 'network':
      ;[2.2, 1.6, 1.0].forEach(r => dot(s, cx, cy, r * k, a, { tr: 100, line: a, lw: 1.25 }))
      dot(s, cx, cy, 0.5 * k, a, { line: b, lw: 2 })
      ;[[-1.7, -1.4], [1.4, -1.6], [2.1, 0.5], [-1.4, 1.6], [1.0, 1.9], [-2.1, 0.2]].forEach(([dx, dy]) => { line(s, cx, cy, dx * k, dy * k, a, { dash: 'dash', w: 0.75 }); dot(s, cx + dx * k, cy + dy * k, 0.1 * k, b) })
      break
    case 'bars':
      ;[0.9, 1.4, 1.2, 2.0, 2.6, 3.2].forEach((h, i) => s.addShape(S.RECTANGLE, { x: cx - 2.0 * k + i * 0.68 * k, y: cy + 1.6 * k - h * k, w: 0.5 * k, h: h * k, fill: { color: i === 5 ? b : a, transparency: i === 5 ? 0 : 35 }, line: { color: a, width: 0.5 } }))
      line(s, cx - 2.1 * k, cy + 1.0 * k, 4.2 * k, -2.3 * k, b, { w: 2.5, arrow: true })
      break
    case 'waves':
      for (let i = 0; i < 5; i++) s.addShape(S.WAVE, { x: cx - 2.3 * k, y: cy - 1.5 * k + i * 0.62 * k, w: 4.6 * k, h: 0.55 * k, fill: { color: i % 2 ? a : b, transparency: 25 + i * 12 }, line: { color: a, width: 0.5, transparency: 50 } })
      break
    case 'blocks':
      ;[[0, 2.6], [0.75, 1.8], [1.5, 3.2], [2.25, 2.2], [3.0, 1.4]].forEach(([dx, h], i) => {
        s.addShape(S.RECTANGLE, { x: cx - 1.85 * k + dx * k, y: cy + 1.6 * k - h * k, w: 0.62 * k, h: h * k, fill: { color: i === 2 ? b : a, transparency: i === 2 ? 0 : 30 }, line: { color: b, width: 0.5 } })
        for (let w = 0; w < Math.floor(h / 0.45); w++) s.addShape(S.RECTANGLE, { x: cx - 1.75 * k + dx * k, y: cy + 1.45 * k - h * k + 0.25 * k + w * 0.42 * k, w: 0.12 * k, h: 0.16 * k, fill: { color: th.dark, transparency: 30 }, line: { color: th.dark, width: 0.25 } })
      })
      break
    case 'dots':
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const z = 0.12 + ((r * 3 + c * 7) % 5) * 0.06; dot(s, cx - 1.8 * k + c * 0.9 * k, cy - 1.8 * k + r * 0.9 * k, z * k, (r + c) % 3 ? a : b, { tr: (r + c) % 3 ? 30 : 0 }) }
      break
    default:
      for (let i = 0; i < 5; i++) { line(s, cx - 2 * k + i * k, cy - 2 * k, 0, 4 * k, a, { w: 0.75, tr: 40 }); line(s, cx - 2 * k, cy - 2 * k + i * k, 4 * k, 0, a, { w: 0.75, tr: 40 }) }
      ;[[0, 0], [1, -1], [-1, 1], [2, 1], [-2, -1]].forEach(([dx, dy], i) => dot(s, cx + dx * k, cy + dy * k, (i ? 0.12 : 0.3) * k, i ? b : a))
  }
}

// Penilaian aset injeksi: angka kunci simulasi, yang sudah diungkap, dan yang harus diuji di laporan penilai.
function penilaianSlide(K, th, doc) {
  const pn = doc?.aset?.penilaian
  if (!pn) return
  const { T, kpi, pointCard, slide } = K
  const s = slide('Penilaian aset', pn.judul || 'Penilaian Aset Injeksi', pn.kesimpulan || pn.ringkas)
  const val = m => m.nilai == null ? '–' : /^Rp/.test(m.satuan || '') ? `Rp${id(m.nilai, m.nilai >= 100 ? 0 : 1)}${(m.satuan || '').slice(2)}` : id(m.nilai, m.nilai >= 100 ? 0 : 1) + (m.satuan || '')
  const sim = (pn.simulasi || []).slice(0, 8)
  const pick = re => sim.find(m => re.test(m.nama))
  const tiles = [pick(/dalam rupiah/i), pick(/ekuitas/i), pick(/PER 8/i), pick(/minimum agar publik/i)].filter(Boolean)
  const w4 = (CW - 0.15 * (tiles.length - 1)) / Math.max(1, tiles.length)
  tiles.forEach((m, i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.15, val(m), m.nama, i === tiles.length - 1 ? th.bad : th.accent))
  const y = TOP + 1.3, h = 3.35 - 1.3, hw = CW / 2 - 0.1
  pointCard(s, M, y, hw, h, 'i', th.accent, 'Yang sudah diungkap', (pn.diketahui || []).map(t => t.replace(/\s*\((KI|tanggapan)[^)]*\)\.?$/, '')), { max: 3, n: 120, size: 9.5 })
  pointCard(s, M + hw + 0.2, y, hw, h, '?', th.warn, 'Harus diuji di laporan penilai', pn.dicermati || [], { max: 3, n: 120, size: 9.5 })
}

// Model bisnis aset, perhitungan laba aset, dan proyeksi laba dari dokumen.
function bisnisSlide(K, th, doc, r, P) {
  const bs = doc?.bisnis, lb = doc ? asetLaba(doc, { S1: r?.S1, P }) : null
  if (!bs && !lb) return
  const { T, card, slide } = K
  const s = slide('Model bisnis', 'Cara Menghasilkan Laba dan Proyeksinya',
    lb?.per ? `Harga transaksi setara ${id(lb.per, 1)} kali laba porsi yang diambil.` : lb?.rugi ? 'Aset yang masuk masih merugi; harga tidak ditopang laba.' : 'Laba aset belum diungkap di dokumen.')
  // Tanpa proyeksi di dokumen: isi dilebarkan ke seluruh slide (tanpa kotak proyeksi kosong).
  const pj = (bs?.proyeksi || []).slice(0, 8)
  const lw = pj.length ? 5.2 : CW
  const txt = [bs?.model, (bs?.sumberPendapatan || []).length ? 'Sumber pendapatan: ' + bs.sumberPendapatan.join('; ') + '.' : null,
    (bs?.proyek || []).length ? 'Proyek: ' + bs.proyek.slice(0, 3).map(p => p.nama + (p.status ? ` (${p.status})` : '')).join('; ') + '.' : null].filter(Boolean)
  T(s, 'MODEL BISNIS', { x: M, y: TOP, w: lw, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
  T(s, txt.length ? txt.map((t, i) => ({ text: short(t, 260), options: { breakLine: i < txt.length - 1, paraSpaceAfter: 5 } })) : 'Belum diungkap di dokumen.',
    { x: M, y: TOP + 0.24, w: lw, h: 1.75, fontSize: 9, color: th.ink, fit: 'shrink' })
  const rows = lb ? [
    lb.pend != null && ['Pendapatan' + (lb.periode ? ` (${lb.periode})` : ''), bigS(lb.pend) + (lb.ltm ? ` · setahun ${bigS(lb.pendThn)}` : lb.f !== 1 ? ` · setahun ${bigS(lb.pendThn)}` : '')],
    lb.laba != null && ['Laba bersih', bigS(lb.laba) + (lb.ltm || lb.f !== 1 ? ` · setahun ${bigS(lb.labaThn)}` : '')],
    lb.margin != null && ['Margin laba bersih', id(lb.margin * 100, 1) + '%'],
    lb.roe != null && ['ROE', id(lb.roe * 100, 1) + '%'],
    lb.labaPorsi != null && ['Laba porsi diambil', bigS(lb.labaPorsi)],
    lb.per != null && ['PER implisit transaksi', id(lb.per, 1) + '×'],
  ].filter(Boolean) : []
  T(s, 'PERHITUNGAN LABA ASET', { x: M, y: TOP + 2.08, w: lw, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
  T(s, rows.length ? rows.map((rw, i) => ({ text: `${rw[0]}: ${rw[1]}`, options: { breakLine: i < rows.length - 1 } })) : 'Laba dan pendapatan aset belum diungkap; proyeksi laba juga belum diungkap di dokumen.',
    { x: M, y: TOP + 2.32, w: lw, h: 1.0, fontSize: 8.5, color: th.ink, fit: 'shrink' })
  if (!pj.length) return
  const x = M + lw + 0.2, w = CW - lw - 0.2
  card(s, x, TOP, w, 3.35)
  T(s, 'PROYEKSI LABA', { x: x + 0.15, y: TOP + 0.1, w: w - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
  T(s, pj.length ? pj.map((p, i) => ({ text: `${p.tahun}: laba ${p.labaBersihRp != null ? bigS(p.labaBersihRp) : '–'}${p.pendapatanRp != null ? ' · pendapatan ' + bigS(p.pendapatanRp) : ''}`, options: { breakLine: i < pj.length - 1, paraSpaceAfter: 2 } }))
    : 'Proyeksi laba belum diungkap di dokumen.', { x: x + 0.15, y: TOP + 0.36, w: w - 0.3, h: 2.4, fontSize: 9, color: th.ink, fit: 'shrink' })
  if (pj[0]?.sumber) T(s, 'Sumber: ' + short(pj[0].sumber, 90), { x: x + 0.15, y: TOP + 2.85, w: w - 0.3, h: 0.4, fontSize: 7.5, color: th.muted })
}

// Dasar perhitungan harga pelaksanaan pada rasio 1:1: skenario A (seluruh nilai penerbitan) dan B (tunai saja).
function dasarSlide(K, th, c) {
  const ex = riExercise(c, 1)
  if (!ex) return
  const { T, card, slide } = K
  const sh = v => v >= 1e9 ? id(v / 1e9, 2) + ' miliar' : id(v / 1e6, 0) + ' jt'
  const s = slide('Dasar perhitungan', 'Dasar Perhitungan Harga Pelaksanaan',
    `Pada rasio 1:1, harga pelaksanaan ${rpS(ex.A.up)}${ex.B ? ` (seluruh nilai) atau ${rpS(ex.B.up)} (tunai saja)` : ''}.`)
  T(s, 'Harga pelaksanaan = Target dana ÷ (Rasio HMETD × Saham beredar)', { x: M, y: TOP, w: CW, h: 0.4, fontFace: th.head, fontSize: 15, bold: true, color: th.ink })
  T(s, `Saham beredar ${sh(ex.S0)} lembar · target dana ${bigS(ex.total)}${ex.aset ? ` (aset ${bigS(ex.aset)} + tunai ${bigS(ex.tunai)})` : ''}${ex.kurs ? ` · kurs dokumen ${rpS(ex.kurs.nilai)}/${ex.kurs.mataUang || 'USD'}` : ''} · rasio 1 lama : 1 baru (ilustrasi).`,
    { x: M, y: TOP + 0.45, w: CW, h: 0.4, fontSize: 9.5, color: th.muted })
  const rows = [['A. Seluruh nilai penerbitan', ex.A], ...(ex.B ? [['B. Porsi tunai saja', ex.B]] : [])]
  const w2 = (CW - 0.2) / rows.length
  rows.forEach(([l, v], i) => {
    const x = M + i * (w2 + 0.2), on = (i === 0 && ex.consistent === 'A') || (i === 1 && ex.consistent === 'B')
    card(s, x, TOP + 0.95, w2, 1.75, on ? { line: th.accent } : {})
    T(s, l + (on ? ' · sesuai dokumen' : ''), { x: x + 0.18, y: TOP + 1.05, w: w2 - 0.3, h: 0.25, fontSize: 9, bold: true, color: th.accent })
    T(s, rpS(v.up), { x: x + 0.18, y: TOP + 1.32, w: w2 - 0.3, h: 0.55, fontFace: th.head, fontSize: 24, bold: true, color: th.ink })
    T(s, [`Target ${bigS(v.target)} ÷ ${sh(ex.N)} saham = Rp${id(v.P, 2)}, dibulatkan ke atas`,
      `Harga saham dibutuhkan (diskon 20%): ${rpS(Math.ceil(v.need))}${v.naik != null ? (v.naik > 0 ? ` (+${id(v.naik * 100, 0)}%)` : ' (tercapai)') : ''}`].join('\n'),
      { x: x + 0.18, y: TOP + 1.9, w: w2 - 0.3, h: 0.75, fontSize: 8.5, color: th.ink, fit: 'shrink' })
  })
  if (ex.B) T(s, ex.consistent === 'A'
    ? `Skenario B hanya berlaku bila aset dibayar dengan saham terpisah. Menurut dokumen, inbreng juga melalui HMETD yang sama, sehingga harga yang konsisten adalah skenario A; pada harga B, penerbitan hanya menghasilkan ${bigS(ex.B.check)}.`
    : 'Aset dibayar dengan penerbitan terpisah, sehingga harga HMETD dihitung dari porsi tunai (skenario B).',
    { x: M, y: TOP + 2.82, w: CW, h: 0.5, fontSize: 8.5, color: th.muted })
}

// Harga per saham dengan desimal bila tidak bulat (mis. Rp23,5).
const rpD = v => v == null ? '–' : Number.isInteger(+v) ? rpS(v) : 'Rp' + id(v, 2)

// Slide pengendali/key person/riwayat hukum (dari dokumen) dan simulasi valuasi + sudut pandang pengendali.
function personSlide(K, th, doc) {
  const pg = doc?.pengendali, kp = doc?.keyPerson || [], hk = doc?.hukum
  if (!pg && !kp.length && !hk) return
  const { T, card, slide } = K
  const hkList = (hk?.daftar || []).slice(0, 4)
  const s = slide('Pengendali', 'Pengendali, Key Person, dan Riwayat Hukum',
    hkList.length ? `Tercatat ${hk.daftar.length} catatan hukum/regulasi di dokumen keterbukaan.` : hk?.tidakDitemukan ? 'Tidak ditemukan riwayat masalah hukum di dokumen keterbukaan.' : pg?.rencana || '')
  const lw = 4.4
  card(s, M, TOP, lw, 3.35, { fill: th.dark, line: th.dark })
  T(s, 'PENGENDALI', { x: M + 0.18, y: TOP + 0.12, w: lw - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
  T(s, short(pg?.nama || 'belum diungkap', 60), { x: M + 0.18, y: TOP + 0.36, w: lw - 0.3, h: 0.45, fontFace: th.head, fontSize: 15, bold: true, color: 'FFFFFF', fit: 'shrink' })
  const rows = pg ? [
    pg.ubo?.length && ['UBO', pg.ubo.join(', ')],
    pg.porsiPersen != null && ['Porsi', id(pg.porsiPersen, 2) + '%'],
    (pg.hargaMasuk || pg.nilaiMasukRp) && ['Harga masuk', [pg.hargaMasuk && rpD(pg.hargaMasuk) + '/saham', pg.nilaiMasukRp && bigS(pg.nilaiMasukRp)].filter(Boolean).join(' · ')],
    pg.hargaPTW && ['Harga tender', rpD(pg.hargaPTW)],
    pg.rencana && ['Rencana', pg.rencana],
  ].filter(Boolean) : []
  T(s, rows.map((r2, i) => ({ text: `${r2[0]}: ${short(r2[1], 120)}`, options: { breakLine: i < rows.length - 1, paraSpaceAfter: 4 } })),
    { x: M + 0.18, y: TOP + 0.9, w: lw - 0.3, h: 2.35, fontSize: 8.5, color: 'EAF2FA', fit: 'shrink' })
  const x = M + lw + 0.2, w = CW - lw - 0.2
  T(s, 'KEY PERSON', { x, y: TOP, w, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
  const kl = kp.slice(0, 6)
  T(s, kl.length ? kl.map((p, i) => ({ text: `${p.nama} · ${p.jabatan}${p.afiliasi ? ' (' + short(p.afiliasi, 40) + ')' : ''}`, options: { breakLine: i < kl.length - 1, paraSpaceAfter: 2 } })) : 'Belum diungkap.',
    { x, y: TOP + 0.24, w, h: 1.5, fontSize: 8.5, color: th.ink, fit: 'shrink' })
  T(s, 'RIWAYAT HUKUM DAN REGULASI', { x, y: TOP + 1.85, w, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
  T(s, hkList.length ? hkList.map((h, i) => ({ text: `${h.tanggal ? fmtDate(h.tanggal) + ' · ' : ''}${h.jenis} (${h.status}): ${short(h.isu, 110)}`, options: { breakLine: i < hkList.length - 1, paraSpaceAfter: 2 } }))
    : hk?.tidakDitemukan ? 'Tidak ditemukan di dokumen keterbukaan yang diperiksa.' : 'Belum diperiksa.',
    { x, y: TOP + 2.09, w, h: 1.25, fontSize: 8, color: th.ink, fit: 'shrink' })
}

function valuasiSlide(K, th, c, r, P) {
  if (!c || !r) return
  const target = Math.max(0.1e12, Math.round(((r.total || 0) + (c.mcap || 0)) / 1e11) * 1e11)
  const v = valuasiSim(c, r, { target, ambil: target * 0.2 })
  const b = bandarView(c, r, P, c.doc?.pengendali || {}, target)
  if (!v) return
  const { T, card, slide, kpi } = K
  const sh = x => x == null ? '–' : x >= 1e9 ? id(x / 1e9, 2) + ' miliar' : id(x / 1e6, 0) + ' jt'
  const s = slide('Valuasi', 'Simulasi Valuasi dan Sudut Pandang Pengendali',
    `Pada valuasi ${bigS(target)}, harga ${rpS(Math.round(v.harga))}${v.x ? ` (${id(v.x, 2)}× harga kini)` : ''}${b ? `; harga impas pengendali ${rpS(Math.round(b.impas))}` : ''}.`)
  const w4 = (CW - 0.45) / 4
  ;[
    [rpS(Math.round(v.harga)), `Harga per saham pada valuasi ${bigS(target)}`],
    [v.x ? id(v.x, 2) + '×' : '–', `Kelipatan dari harga kini ${rpS(c.price)}`],
    [(v.pbvReal || v.pbv) ? id(v.pbvReal || v.pbv, 1) + '×' : '–', v.pbvReal ? 'PBV terhadap nilai buku riil' : 'PBV tersirat (ekuitas setelah transaksi)'],
    [b ? rpS(Math.round(b.impas)) : '–', 'Harga impas pengendali'],
  ].forEach(([val, l], i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.2, val, l))
  const rows = [
    v.jual && `A. Pengendali mengambil ${bigS(v.ambil)} lewat penjualan saham: ${sh(v.jual.saham)} saham (${id(v.jual.pctPerusahaan * 100, 1)}% perusahaan).`,
    v.ri && `B. Lewat RI baru pada valuasi ${bigS(target)}: harga ${rpS(Math.round(v.ri.harga))}, ${sh(v.ri.saham)} saham baru, dilusi ${id(v.ri.dilusi * 100, 1)}%.`,
    b && `Pengendali: saham awal ${sh(b.sahamAwal)}${b.hargaMasuk ? ` di ${rpD(b.hargaMasuk)}` : ''} + inbreng ${sh(b.sahamInbreng)} + tebus ${sh(b.sahamTebus)} = ${sh(b.totalSaham)} (${id(b.porsiSetelah * 100, 1)}%); modal ${bigS(b.totalModal)}.`,
    b && `Laba kertas pengendali: harga kini ${bigS(b.labaKini)}${b.labaTarget != null ? `, valuasi target ${bigS(b.labaTarget)}` : ''}${b.kelipatanAwal ? `; modal awal sudah ${id(b.kelipatanAwal, 2)}×` : ''}.`,
    // Skenario kedua: valuasi 2× dengan pengendali mengambil 20% (mis. Rp5 T dan Rp1 T).
    (v2 => v2 && `Skenario 2×: valuasi ${bigS(v2.target)} → harga ${rpS(Math.round(v2.harga))} (${id(v2.x, 2)}× harga kini, PBV riil ${v2.pbvReal ? id(v2.pbvReal, 1) + '×' : '–'}); pengendali mengambil ${bigS(v2.ambil)} = jual ${id(v2.jual.pctPerusahaan * 100, 1)}% perusahaan atau RI baru ${id(v2.ri.dilusi * 100, 1)}% dilusi.`)(valuasiSim(c, r, { target: target * 2, ambil: target * 0.4 })),
  ].filter(Boolean)
  card(s, M, TOP + 1.35, CW, 2.0, { flat: true })
  T(s, rows.map((t, i) => ({ text: short(t, 200), options: { breakLine: i < rows.length - 1, paraSpaceAfter: 5 } })),
    { x: M + 0.18, y: TOP + 1.45, w: CW - 0.36, h: 1.8, fontSize: 9, color: th.ink, fit: 'shrink' })
}

// Dua slide dari dokumen asli (ri-dokumen.json): kewajaran nilai aset injeksi, lalu fakta dokumen & jadwal.
// Dipakai presentasi lengkap dan presentasi penambahan modal.
// Struktur rencana korporasi (langkah berurutan dari dokumen): satu slide, ikut di presentasi lengkap dan rights issue.
function rencanaSlide(K, th, doc) {
  const rk = doc?.rencanaKorporasi
  if (!rk || !(rk.langkah || []).length) return
  const { T, card, slide } = K
  {
    const st = rk.langkah.slice(0, 9)
    const s = slide('Rencana korporasi', 'Struktur Rencana Korporasi', rk.ringkas)
    const rh = 3.35 / st.length
    const col = x => x === 'selesai' ? th.good : x === 'berjalan' ? th.accent : th.warn
    st.forEach((x, i) => {
      const y = TOP + i * rh, bh = Math.min(0.3, rh - 0.08)
      card(s, M + 0.05, y + (rh - bh) / 2, 0.3, bh, { fill: col(x.status), line: col(x.status), flat: true })
      T(s, String(i + 1), { x: M + 0.05, y: y + (rh - bh) / 2, w: 0.3, h: bh, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, [{ text: short(x.judul, 60), options: { bold: true } }, { text: `  ${x.status || 'rencana'}${x.waktu && x.waktu !== '–' ? ' · ' + short(x.waktu, 40) : ''}`, options: { color: th.muted } }],
        { x: M + 0.5, y, w: 4.6, h: rh * 0.5, fontSize: 8.5, color: th.ink, valign: 'bottom', fit: 'shrink' })
      T(s, short(x.nilai && x.nilai !== '–' ? x.nilai : x.pihak || '', 90), { x: M + 0.5, y: y + rh * 0.5, w: 4.6, h: rh * 0.48, fontSize: 7.5, color: th.muted, valign: 'top', fit: 'shrink' })
      T(s, short(x.ket || '', 190), { x: M + 5.2, y, w: CW - 5.2, h: rh, fontSize: 7.5, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
  }
}

function docSlides(K, th, doc, which = '') {
  if (!doc) return
  const { T, card, pill, slide } = K
  const kw = doc.kewajaran, a = doc.aset || {}
  const tone = /^wajar/i.test(kw?.putusan || '') ? th.good : /tidak wajar/i.test(kw?.putusan || '') ? th.bad : th.warn
  if (kw && which !== 'fakta') {
    const s = slide('Kewajaran aset', 'Kewajaran Nilai Aset Injeksi', kw.ringkas)
    card(s, M, TOP, 3.0, 3.35, { fill: th.dark, line: th.dark })
    T(s, 'PUTUSAN', { x: M + 0.2, y: TOP + 0.18, w: 2.6, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 3 })
    T(s, kw.putusan.charAt(0).toUpperCase() + kw.putusan.slice(1), { x: M + 0.2, y: TOP + 0.42, w: 2.6, h: 0.75, fontFace: th.head, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    pill(s, M + 0.2, TOP + 1.22, a.kjpp?.status === 'terbit' ? 'KJPP terbit' : 'Belum dinilai KJPP', a.kjpp?.status === 'terbit' ? th.good : tone, { size: 8 })
    T(s, short([a.nama, a.dasarNilai].filter(Boolean).join('. '), 230), { x: M + 0.2, y: TOP + 1.6, w: 2.6, h: 1.65, fontSize: 8.5, color: 'EAF2FA', fit: 'shrink' })
    const x = M + 3.2, w = CW - 3.2
    const met = (kw.metrik || []).slice(0, 3)
    const mh = met.length ? 0.5 : 0
    met.forEach((m, i) => {
      const y = TOP + i * mh
      card(s, x, y, w, mh - 0.06, { flat: true })
      const mv = m.nilai == null ? '–' : /^Rp/.test(m.satuan || '') ? `Rp${id(m.nilai, 0)}${m.satuan.slice(2)}` : `${id(m.nilai, m.nilai >= 100 ? 0 : 1)}${m.satuan || ''}`
      T(s, mv, { x: x + 0.12, y, w: 1.0, h: mh - 0.06, fontFace: th.head, fontSize: mv.length > 9 ? 9 : mv.length > 6 ? 12 : 15, bold: true, color: th.ink, valign: 'middle' })
      T(s, [{ text: m.nama, options: { bold: true, breakLine: true } }, { text: short([m.rumus, m.pembanding && 'pembanding: ' + m.pembanding].filter(Boolean).join(' · '), 150) }],
        { x: x + 1.15, y: y + 0.03, w: w - 1.25, h: mh - 0.1, fontSize: 8, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
    const ay = TOP + met.length * mh + 0.06, ah = TOP + 3.35 - ay
    T(s, 'ALASAN', { x, y: ay, w, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
    // Jumlah alasan menyesuaikan ruang (±2 baris per alasan) agar tidak menimpa pita kesimpulan.
    const al = (kw.alasan || []).slice(0, Math.max(2, Math.floor((ah - 0.22) / 0.36)))
    T(s, al.map((t, i) => ({ text: short(t, 150), options: { bullet: { type: 'number' }, breakLine: i < al.length - 1, paraSpaceAfter: 2 } })),
      { x, y: ay + 0.22, w, h: ah - 0.22, fontSize: 8, color: th.ink, fit: 'shrink' })
  }
  // Fakta dokumen & jadwal.
  if (which !== 'kewajaran') {
    const hp = doc.hargaPelaksanaan || {}, ke = a.keuangan || {}
    const rows = [
      ['Saham baru maksimum', doc.sahamBaruMaks ? `${id(doc.sahamBaruMaks / 1e9, 2)} miliar${doc.rasio ? ' · rasio ' + doc.rasio : ''}` : 'belum diungkap'],
      ['Harga pelaksanaan', hp.nilai ? `${rpS(hp.nilai)} (${hp.status})` : 'belum ditetapkan'],
      ['Dana / setoran', [doc.danaMaksRp && 'dana maks. ' + bigS(doc.danaMaksRp), doc.setoran?.asetRp && 'aset ' + bigS(doc.setoran.asetRp), doc.setoran?.tunaiRp && 'tunai ' + bigS(doc.setoran.tunaiRp)].filter(Boolean).join(' · ') || 'belum diungkap'],
      ['Kurs dokumen', doc.kurs?.nilai ? `${rpS(doc.kurs.nilai)}/${doc.kurs.mataUang || 'USD'}` : null],
      ['Nilai aset', [a.nilai100Rp && '100%: ' + bigS(a.nilai100Rp), a.nilaiTransaksiRp && `porsi ${a.porsiPersen ? id(a.porsiPersen, 0) + '%' : 'diambil'}: ` + bigS(a.nilaiTransaksiRp)].filter(Boolean).join(' · ') || null],
      ['Keuangan aset', [ke.periode, ke.ekuitasRp != null && 'ekuitas ' + bigS(ke.ekuitasRp), ke.totalAsetRp != null && 'aset ' + bigS(ke.totalAsetRp), ke.labaBersihRp != null && 'laba ' + bigS(ke.labaBersihRp)].filter(Boolean).join(' · ') || null],
      ['Laba aset', (lb => !lb ? 'belum diungkap' : [lb.laba != null && `${lb.periode ? lb.periode + ': ' : ''}laba ${bigS(lb.laba)}`, lb.f !== 1 && lb.labaThn != null && `setahun ${bigS(lb.labaThn)}`, lb.margin != null && `margin ${id(lb.margin * 100, 1)}%`, lb.per != null ? `PER implisit ${id(lb.per, 1)}×` : lb.rugi ? 'merugi' : null].filter(Boolean).join(' · '))(asetLaba(doc))],
      ['Pembeli siaga', doc.pembeliSiaga ? (doc.pembeliSiaga.ada === true ? 'ada' + (doc.pembeliSiaga.pihak ? ': ' + doc.pembeliSiaga.pihak : '') : doc.pembeliSiaga.ada === false ? 'tidak ada' : 'belum diungkap') : null],
      ['Penggunaan dana', (doc.penggunaanDana || []).slice(0, 3).map(p => p.pos + (p.nilaiRp ? ' ' + bigS(p.nilaiRp) : p.persen ? ` ${id(p.persen, 0)}%` : '')).join('; ') || null],
    ].filter(r => r[1])
    const s = slide('Dasar dokumen', 'Fakta dari Dokumen Keterbukaan', doc.dampakPublik || `Diekstrak dari ${(doc.sumber || []).length} dokumen keterbukaan per ${fmtDate(doc.asOf || '')}.`)
    const lw = 5.6, rh = Math.min(0.42, 3.35 / rows.length)
    rows.forEach(([k, v], i) => {
      const y = TOP + i * rh
      T(s, k, { x: M, y, w: 1.55, h: rh, fontSize: 8.5, bold: true, color: th.muted, valign: 'middle' })
      T(s, short(v, 120), { x: M + 1.6, y, w: lw - 1.6, h: rh, fontSize: 9, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
    const x = M + lw + 0.2, w = CW - lw - 0.2
    const jd = (doc.jadwal || []).slice(0, 6)
    card(s, x, TOP, w, 3.35)
    T(s, 'JADWAL MENURUT DOKUMEN', { x: x + 0.15, y: TOP + 0.1, w: w - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
    T(s, jd.length ? jd.map((j, i) => ({ text: `${j.waktu}: ${short(j.tahap, 60)}`, options: { bullet: { indent: 10 }, breakLine: i < jd.length - 1, paraSpaceAfter: 3 } })) : 'Jadwal belum diungkap.',
      { x: x + 0.15, y: TOP + 0.36, w: w - 0.3, h: 1.6, fontSize: 8.5, color: th.ink, fit: 'shrink' })
    const src = (doc.sumber || []).slice(0, 4)
    T(s, 'SUMBER', { x: x + 0.15, y: TOP + 2.05, w: w - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
    T(s, src.map((r, i) => ({ text: `${r.tanggal ? fmtDate(r.tanggal) + ': ' : ''}${short(r.judul, 55)}${r.hal ? ' (hal. ' + r.hal + ')' : ''}`, options: { breakLine: i < src.length - 1 } })),
      { x: x + 0.15, y: TOP + 2.27, w: w - 0.3, h: 1.0, fontSize: 7.5, color: th.muted, fit: 'shrink' })
  }
}

// Presentasi khusus analisa penambahan modal (PMHMETD/PMTHMETD/merger), bukan presentasi analisa lengkap.
// d: { t, name, date, sector, A, c, P, U } dengan c = riCase(...), P = harga pelaksanaan, U = % publik menebus
// (0–100), sama seperti simulasi di layar.
export function buildRiDeck(PptxGenJS, d, th) {
  const c = d.c
  const K = makeKit(PptxGenJS, d, th, `${d.t}: Analisis ${c.label}`)
  const { pres, S, T, card, pill, dot, line, chartBase, slide, kpi, hbar } = K
  const P = d.P, u = (d.U || 0) / 100
  const r = riCalc(c, P, u)
  const nr = noRights(c), det = c.detail
  const pc = v => v == null || isNaN(v) ? '–' : id(v * 100, v < 0.1 ? 2 : 1) + '%'
  const shS = v => v == null ? '–' : v >= 1e9 ? id(v / 1e9, 2) + ' miliar' : id(v / 1e6, 0) + ' jt'
  const B = v => Math.round(v / 1e9 * 10) / 10
  const verdict = riVerdict(c, r)
  const fund = riFunding(c, r)
  const STATUS = { rencana: 'Rencana', berjalan: 'Berjalan', tereksekusi: 'Sudah tereksekusi' }
  const what = nr ? (c.kind === 'merger' ? 'penerbitan merger' : 'PMTHMETD') : 'rights issue'

  // ===== 1. Sampul =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line)
    T(s, 'ANALISIS PENAMBAHAN MODAL', { x: 0.7, y: 1.0, w: 5.2, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, d.t, { x: 0.7, y: 1.35, w: 5.2, h: 1.2, fontFace: th.head, fontSize: 66, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, c.label.charAt(0).toUpperCase() + c.label.slice(1), { x: 0.7, y: 2.55, w: 5.6, h: 0.5, fontFace: th.head, fontSize: 24, color: 'FFFFFF', fit: 'shrink' })
    T(s, d.name || '', { x: 0.7, y: 3.1, w: 5.2, h: 0.35, fontSize: 15, color: th.accent2 })
    T(s, ['Nilai aset', 'Kebutuhan dana', 'Kewajiban penyetoran', 'Dampak per lot', 'Sensitivitas harga'].join('  •  '), { x: 0.7, y: 3.55, w: 5.6, h: 0.3, fontSize: 11, color: 'EAF2FA' })
    const w0 = pill(s, 0.7, 4.0, STATUS[c.status], c.status === 'tereksekusi' ? th.good : th.accent, { size: 9 })
    if (c.jadwal) T(s, short(c.jadwal, 70), { x: 0.85 + w0, y: 4.0, w: 5, h: 0.24, fontSize: 9.5, color: 'EAF2FA', valign: 'middle' })
    T(s, `Data per ${fmtDate(d.date)}  |  Harga terakhir ${rpS(c.price)}  |  Simulasi harga pelaksanaan ${rpS(P)}`, { x: 0.7, y: 4.95, w: 7, h: 0.25, fontSize: 9.5, color: 'DCE7F3' })
  }
  if (!r) return pres
  riSlides(K, th, d)
  return pres
}

// Isi analisa penambahan modal (tanpa sampul). opt.inFull = bagian dari presentasi lengkap: semua slide berlabel
// "Rights Issue", slide pengendali dan penutup gelap dilewati karena sudah ada di presentasi lengkap.
function riSlides(K, th, d, opt = {}) {
  const c = d.c
  const { pres, S, T, card, pill, dot, line, chartBase, slide, kpi, hbar } = K
  const P = d.P, u = (d.U || 0) / 100
  const r = riCalc(c, P, u)
  const nr = noRights(c), det = c.detail
  const pc = v => v == null || isNaN(v) ? '–' : id(v * 100, v < 0.1 ? 2 : 1) + '%'
  const shS = v => v == null ? '–' : v >= 1e9 ? id(v / 1e9, 2) + ' miliar' : id(v / 1e6, 0) + ' jt'
  const B = v => Math.round(v / 1e9 * 10) / 10
  const verdict = riVerdict(c, r)
  const fund = riFunding(c, r)
  const STATUS = { rencana: 'Rencana', berjalan: 'Berjalan', tereksekusi: 'Sudah tereksekusi' }
  const what = nr ? (c.kind === 'merger' ? 'penerbitan merger' : 'PMTHMETD') : 'rights issue'
  const sec = name => K.setSec(opt.inFull ? 'Rights Issue' : name)
  if (!r) return

  // ---------- Bagian: Gambaran umum (struktur karya ilmiah: kesimpulan di akhir) ----------
  sec('Gambaran umum')
  // ===== 2. Angka kunci =====
  {
    const s = slide('Angka kunci', 'Ringkasan Angka Penambahan Modal', verdict)
    const w4 = (CW - 0.45) / 4
    ;[
      [c.inj ? bigS(c.inj) : '–', `Nilai transaksi injeksi aset${c.injTarget ? ' · ' + short(c.injTarget, 40) : ''}`, th.accent],
      [bigS(r.total), `Nilai penerbitan · ${shS(r.N)} saham × ${rpS(P)}`, th.accent],
      [bigS(r.tunai), r.aset ? `Dana tunai; ${bigS(r.aset)} disetor non-tunai` : 'Dana tunai (seluruhnya)', th.accent],
      [rpS(P), `Harga pelaksanaan${r.disc != null ? ` · ${r.disc >= 0 ? 'premi' : 'diskon'} ${id(Math.abs(r.disc) * 100, 0)}% vs pasar` : ''}`, r.disc != null && r.disc < -0.3 ? th.bad : th.accent],
    ].forEach(([v, l, col], i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.5, v, l, col))
    ;[
      [nr ? pc(r.newHolder) : `${id(r.ratio, 2)} : 1`, nr ? 'Porsi penerima saham baru' : 'Rasio HMETD per saham lama', th.ink],
      [pc(r.dilusi), 'Dilusi bila tidak ikut menebus', th.warn],
      [`${pc((c.float || 0) / 100)} → ${pc(r.pubAfter)}`, 'Porsi publik sekarang → setelah', r.pubAfter < 0.075 ? th.bad : th.ink],
      [r.vsMcap != null ? id(r.vsMcap, 1) + '×' : '–', 'Nilai penerbitan dibanding kapitalisasi pasar', r.vsMcap >= 1 ? th.bad : th.ink],
    ].forEach(([v, l, col], i) => kpi(s, M + i * (w4 + 0.15), TOP + 1.7, w4, 1.5, v, l, col))
  }

  // Struktur rencana korporasi tepat setelah angka kunci (sama dengan urutan di website).
  rencanaSlide(K, th, c.doc)

  // ---------- Bagian: Pengendali (urutan sama dengan analisa rights issue di website) ----------
  sec('Pengendali')
  if (!opt.inFull) personSlide(K, th, c.doc)

  // ---------- Bagian: Aset dan laba (urutan sama dengan analisa rights issue di website) ----------
  sec('Aset dan laba')
  docSlides(K, th, c.doc, 'kewajaran')
  penilaianSlide(K, th, c.doc)

  // ===== 3. Rincian nilai aset injeksi =====
  if (!c.doc && det && (det.nama || det.lo)) {
    const kj = det.kjpp
    const s = slide('Aset injeksi', short(det.nama || 'Rincian nilai aset injeksi', 52),
      kj.status === 'terbit' ? `KJPP terbit${kj.nilai ? ': ' + bigS(kj.nilai) : ''}.` : kj.ket || 'Nilai aset belum diuji penilai independen.')
    card(s, M, TOP, 3.3, 3.35, { fill: th.dark, line: th.dark })
    T(s, det.spread ? 'NILAI INDIKATIF (BEDA ANTAR-SUMBER)' : 'NILAI TRANSAKSI', { x: M + 0.2, y: TOP + 0.18, w: 2.9, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
    T(s, det.spread ? `${bigS(det.lo)} – ${bigS(det.hi)}` : bigS(det.hi), { x: M + 0.2, y: TOP + 0.45, w: 2.9, h: 0.7, fontFace: th.head, fontSize: det.spread ? 19 : 26, bold: true, color: 'FFFFFF', valign: 'middle' })
    if (det.spread) T(s, `Dipakai di hitungan: ${bigS(c.inj)}`, { x: M + 0.2, y: TOP + 1.15, w: 2.9, h: 0.25, fontSize: 9.5, color: th.accent2 })
    T(s, short(det.nilaiText, 260), { x: M + 0.2, y: TOP + 1.5, w: 2.9, h: 1.75, fontSize: 9, color: 'EAF2FA' })
    const cx = M + 3.5, cw = CW - 3.5
    const boxes = [
      ['Aset', [det.jenis, [det.lokasi, det.porsi].filter(Boolean).join(' · '), ...det.facts.map(([l, v]) => `${l}: ${typeof v === 'number' ? bigS(v) : v}`)].filter(Boolean).join(' · ')],
      ['Cara bayar', det.cara],
      ['Penilaian independen (KJPP)', `${KJPP_SHORT[kj.status] || 'Belum ada'}${kj.nama ? ' · ' + kj.nama : ''}${kj.nilai ? ' · ' + bigS(kj.nilai) : ''}`],
    ].filter(b => b[1])
    // Tinggi kotak mengikuti panjang teks (±95 karakter per baris pada lebar ini).
    const lines = boxes.map(([, v]) => Math.min(3, Math.ceil(short(v, 280).length / 95)))
    const room = det.gaps.length ? 2.3 : 3.35
    const unit = (room - 0.1 * (boxes.length - 1) - 0.36 * boxes.length) / lines.reduce((a, b) => a + b, 0)
    let by = TOP
    boxes.forEach(([h, v], i) => {
      const bh = 0.36 + lines[i] * Math.min(0.2, unit)
      card(s, cx, by, cw, bh)
      T(s, h.toUpperCase(), { x: cx + 0.15, y: by + 0.07, w: cw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, short(v, 280), { x: cx + 0.15, y: by + 0.28, w: cw - 0.3, h: bh - 0.32, fontSize: 8.5, color: th.ink, fit: 'shrink' })
      by += bh + 0.1
    })
    if (det.gaps.length) {
      const gy = Math.max(by + 0.05, TOP + 2.2)
      T(s, 'BELUM DIUNGKAP KE PUBLIK', { x: cx, y: gy, w: cw, h: 0.2, fontSize: 7.5, bold: true, color: th.bad, charSpacing: 2 })
      T(s, det.gaps.slice(0, 4).map((g, i, a) => ({ text: short(g, 95), options: { bullet: { indent: 10 }, breakLine: i < a.length - 1, paraSpaceAfter: 2 } })),
        { x: cx, y: gy + 0.24, w: cw, h: TOP + 3.35 - gy - 0.24, fontSize: 8.5, color: th.muted })
    }
  }

  // ===== 2c. Model bisnis, perhitungan laba aset, dan proyeksi (dari dokumen) =====
  bisnisSlide(K, th, c.doc, r, P)

  // ---------- Bagian: Penerbitan dan dana (urutan sama dengan analisa rights issue di website) ----------
  sec('Penerbitan dan dana')
  if (!opt.inFull) docSlides(K, th, c.doc, 'fakta')

  // ===== 4. Komposisi penerbitan vs nilai aset; tahap I vs II =====
  {
    const take = c.laterInj ? `Tahap I ${bigS(r.total)} tunai bukan untuk membeli aset; aset ${bigS(c.laterInj)} dibayar ±${shS(r.injShares)} saham baru.`
      : r.gap > (c.inj || 0) * 0.05 ? `Kekurangan ${bigS(r.gap)} harus ditutup utang, kas internal, atau tahap lanjutan.`
        : r.aset >= r.total * 0.95 ? 'Seluruh penerbitan dibayar dengan aset (non-tunai).' : 'Nilai penerbitan menutup nilai aset.'
    const s = slide('Kebutuhan dana', c.laterInj ? 'Tahapan Pendanaan dan Injeksi Aset' : 'Perbandingan Nilai Penerbitan dan Nilai Aset', take)
    const cats = c.inj ? ['Nilai aset injeksi', 'Nilai penerbitan'] : ['Nilai penerbitan']
    const series = [
      { name: 'Non-tunai (inbreng/konversi utang)', labels: cats, values: c.inj ? [0, B(r.aset)] : [B(r.aset)] },
      { name: 'Tunai', labels: cats, values: c.inj ? [0, B(r.tunai)] : [B(r.tunai)] },
      ...(c.inj ? [{ name: 'Nilai aset', labels: cats, values: [B(c.inj), 0] }] : []),
    ]
    s.addChart(pres.charts.BAR, series, { ...chartBase(), x: M, y: TOP, w: c.laterInj ? 5.0 : CW, h: 3.3, barDir: 'bar', barGrouping: 'stacked',
      chartColors: [th.warn, th.good, th.muted], showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0' })
    T(s, 'Rp miliar', { x: M, y: TOP + 3.32, w: 2, h: 0.2, fontSize: 8, color: th.muted })
    if (c.laterInj) {
      const x = M + 5.2, w = CW - 5.2
      ;[
        ['TAHAP I · ' + c.label.toUpperCase(), bigS(r.total), `${shS(r.N)} saham × ${rpS(P)}${c.jadwal ? ' · ' + short(c.jadwal, 40) : ''}`, 'Dana tunai, bukan untuk membeli aset.', th.accent],
        ['TAHAP II · INJEKSI ASET', bigS(c.laterInj), `dibayar ±${shS(r.injShares)} saham baru pada ${rpS(P)}`, `Porsi publik bisa turun ke ${pc(r.pubAfterInj)}.`, r.pubAfterInj < 0.075 ? th.bad : th.accent],
      ].forEach(([h, v, a, b, col], i) => {
        const y = TOP + i * 1.7
        card(s, x, y, w, 1.55)
        T(s, h, { x: x + 0.18, y: y + 0.12, w: w - 0.3, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2, fit: 'shrink' })
        T(s, v, { x: x + 0.18, y: y + 0.36, w: w - 0.3, h: 0.5, fontFace: th.head, fontSize: 22, bold: true, color: col, valign: 'middle' })
        T(s, a, { x: x + 0.18, y: y + 0.9, w: w - 0.3, h: 0.28, fontSize: 9, color: th.ink })
        T(s, b, { x: x + 0.18, y: y + 1.17, w: w - 0.3, h: 0.28, fontSize: 9, color: th.muted })
      })
    }
  }

  // ===== 5. Siapa harus menyetor / penerima saham baru =====
  if (opt.inFull) { /* ringkas: dilewati di presentasi lengkap */ } else if (!nr) {
    const s = slide('Kewajiban penyetoran', 'Kewajiban Penyetoran Dana',
      `Bila publik menebus ${d.U || 0}%, pembeli siaga/pengendali harus menyerap ${bigS(r.standby)}; porsi pengendali ${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterAbsorb)}.`)
    s.addChart(pres.charts.BAR, [{ name: 'Rp miliar', labels: ['Sisa publik diserap siaga', `Publik (${id(c.float || 0, 1)}%)`, `Pengendali (${id(c.ctrlPct || 0, 1)}%)`], values: [B(r.standby), B(r.pubPart), B(r.ctrlPart)] }],
      { ...chartBase(), x: M, y: TOP, w: 5.4, h: 3.3, barDir: 'bar', chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, dataLabelFormatCode: '#,##0.0', valAxisLabelFormatCode: '#,##0', showLegend: false })
    T(s, 'Rp miliar', { x: M, y: TOP + 3.32, w: 2, h: 0.2, fontSize: 8, color: th.muted })
    const x = M + 5.6, w = CW - 5.6
    card(s, x, TOP, w, 3.3)
    T(s, 'PORSI PENGENDALI', { x: x + 0.2, y: TOP + 0.18, w: w - 0.4, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    ;[['Sekarang', (c.ctrlPct || 0) / 100, th.muted], ['Bila menyerap sisa publik', r.ctrlAfterAbsorb, th.accent]].forEach(([l, v, col], i) => {
      const y = TOP + 0.6 + i * 1.15
      T(s, l, { x: x + 0.2, y, w: w - 0.4, h: 0.25, fontSize: 9.5, color: th.muted })
      T(s, pc(v), { x: x + 0.2, y: y + 0.25, w: w - 0.4, h: 0.45, fontFace: th.head, fontSize: 24, bold: true, color: col })
      hbar(s, x + 0.2, y + 0.78, w - 0.4, v, col)
    })
  } else {
    const s = slide('Penerima saham baru', c.kind === 'merger' ? 'Pemegang Saham Pihak yang Digabungkan' : 'Komposisi Penerima Saham Baru',
      `Penerima saham baru memegang ${pc(r.newHolder)}; porsi pengendali lama ${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterNr)}.`)
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Porsi', labels: ['Pemegang lama', 'Penerima saham baru'], values: [Math.round((1 - r.newHolder) * 1000) / 10, Math.round(r.newHolder * 1000) / 10] }],
      { x: M, y: TOP, w: 3.6, h: 3.3, holeSize: 58, chartColors: [th.line, th.accent], showPercent: true, showLegend: true, legendPos: 'b', legendFontFace: th.body, dataLabelColor: th.ink })
    kpi(s, M + 3.9, TOP, CW - 3.9, 1.55, bigS(r.total), r.aset ? 'Nilai aset masuk (dibayar saham)' : 'Dana masuk', th.accent)
    kpi(s, M + 3.9, TOP + 1.75, CW - 3.9, 1.55, `${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterNr)}`, 'Porsi pengendali lama sesudah penerbitan', th.warn)
  }

  // ---------- Bagian: Simulasi (urutan sama dengan analisa rights issue di website) ----------
  sec('Simulasi')
  // ===== 6a. Dasar perhitungan harga pelaksanaan: skenario A (seluruh nilai) dan B (tunai saja), rasio 1:1 =====
  if (!opt.inFull) dasarSlide(K, th, c)

  // ===== 6b. Harga saham agar dana tunai tercapai =====
  const nd = riPriceNeeded(c, P)
  if (nd && !opt.inFull) {
    const take = nd.gap == null ? `Patokan harga saham minimal ${rpS(Math.ceil(nd.ref))} (diskon 20%).`
      : nd.gap > 0 ? `Harga saham perlu naik ${id(nd.gap * 100, 0)}% ke ${rpS(Math.ceil(nd.ref))} agar publik terdorong menebus.`
      : `Harga kini ${rpS(nd.now)} sudah di atas patokan ${rpS(Math.ceil(nd.ref))}; dana dapat tercapai bila minat menebus ada.`
    const s = slide('Harga potensi', 'Harga Saham agar Dana Rights Issue Tercapai', take)
    T(s, `Dana tunai yang ingin dihimpun ${bigS(nd.cash)} pada harga pelaksanaan ${rpS(P)}. Publik hanya rasional menebus bila harga pasar di atas harga pelaksanaan; rights issue lazim diberi diskon 10–30%.`,
      { x: M, y: TOP, w: CW, h: 0.45, fontSize: 10, color: th.ink })
    const cols = [...nd.need.map(x => [`Diskon ${Math.round(x.d * 100)}%`, x.price]), ['Harga kini', nd.now]]
    const w4 = (CW - 0.15 * (cols.length - 1)) / cols.length
    cols.forEach(([l, v], i) => {
      const ok = l === 'Harga kini' ? null : nd.now != null && nd.now >= v
      kpi(s, M + i * (w4 + 0.15), TOP + 0.6, w4, 1.3, rpS(Math.ceil(v)),
        l === 'Harga kini' ? 'Harga pasar saat ini' : `${l}: ${ok ? 'sudah tercapai' : nd.now ? 'perlu naik ' + id((v / nd.now - 1) * 100, 0) + '%' : ''}`,
        ok == null ? th.ink : ok ? th.good : th.bad)
    })
    const notes = [
      c.Nmax ? `Agar seluruh setoran ${bigS((c.V || 0) + c.cash)} muat dalam maksimum ${id(c.Nmax / 1e9, 2)} miliar saham, harga pelaksanaan minimal ${rpS(Math.ceil(nd.pMin))}, sehingga harga saham perlu sekitar ${rpS(Math.ceil(nd.minNeed))}.` : null,
      nd.short ? `Pada ${rpS(P)}, saham maksimum hanya menghasilkan ${bigS(nd.short.maxDana)}; kekurangan ${bigS(nd.short.kurang)}.` : null,
      'Patokan yang dipakai adalah diskon 20%; diskon lebih besar menarik penebus tetapi menambah jumlah saham baru dan dilusi.',
    ].filter(Boolean)
    T(s, notes.map((t, i) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: i < notes.length - 1, paraSpaceAfter: 4 } })),
      { x: M, y: TOP + 2.1, w: CW, h: 1.25, fontSize: 9.5, color: th.ink })
  }

  // ===== 6c. Simulasi rasio → harga RI → harga saham yang dibutuhkan (baris bentuk, bukan tabel, agar sama di PDF) =====
  const sc = riScenarios(c, P)
  if (sc) {
    const rows = sc.rows.slice(0, 10)
    const s = slide('Simulasi', 'Simulasi Harga RI, Kebutuhan Dana, dan Harga Saham',
      `Setoran ${bigS(sc.total)} (tunai ${bigS(sc.tunai)}); makin sedikit saham baru, makin tinggi harga RI dan harga saham yang dibutuhkan.`)
    const cols = [['Rasio lama : baru', 1.55], ['Saham baru', 1.1], ['× beredar', 0.8], ['Harga RI', 1.0], ['Harga dibutuhkan (diskon 20%)', 1.45], ['Kenaikan', 1.0], ['Harga teoretis', 1.05], ['Dilusi', 0.85]]
    const tw = cols.reduce((a, x) => a + x[1], 0), k = CW / tw
    const rh = Math.min(0.29, 3.05 / (rows.length + 1))
    const ratio = r => r >= 1 ? `1 : ${id(r, Number.isInteger(+r.toFixed(2)) ? 0 : 2)}` : `${id(1 / r, Number.isInteger(+(1 / r).toFixed(2)) ? 0 : 1)} : 1`
    let x = M
    cols.forEach(([h, w]) => { T(s, h, { x, y: TOP, w: w * k, h: rh + 0.08, fontSize: 7.5, bold: true, color: th.muted, valign: 'bottom', align: h === 'Rasio lama : baru' ? 'left' : 'right' }); x += w * k })
    rows.forEach((row, i) => {
      const y = TOP + (i + 1) * rh + 0.1
      if (row.tag) s.addShape(S.RECTANGLE, { x: M, y, w: CW, h: rh, fill: { color: th.card }, line: { color: th.line, width: 0.5 } })
      const vals = [ratio(row.ratio) + (row.tag ? ` · ${row.tag}` : ''), shS(row.N), `${id(row.ratio, row.ratio >= 10 ? 0 : 2)}×`,
        rpS(Math.round(row.P)) + (row.bawahNominal ? ' (<nominal)' : ''), rpS(Math.ceil(row.need)),
        row.naik == null ? '–' : row.naik > 0 ? '+' + id(row.naik * 100, 0) + '%' : 'tercapai', rpS(Math.round(row.terp)), id(row.dilusi * 100, 1) + '%']
      let xx = M
      cols.forEach(([, w], j) => {
        T(s, vals[j], { x: xx, y, w: w * k, h: rh, fontSize: 8, bold: !!row.tag || j === 3, color: j === 5 && row.naik > 0 ? th.bad : th.ink, valign: 'middle', align: j === 0 ? 'left' : 'right', fit: 'shrink' })
        xx += w * k
      })
    })
    T(s, `Harga yang diangkat sebelum RI cenderung turun ke harga teoretis setelah cum date. Harga RI tidak boleh di bawah nominal${sc.nom ? ' ' + rpS(sc.nom) : ''}.`,
      { x: M, y: TOP + (rows.length + 1) * rh + 0.18, w: CW, h: 0.3, fontSize: 8, color: th.muted })
  }

  valuasiSlide(K, th, c, r, P)

  // ---------- Bagian: Dampak investor (urutan sama dengan analisa rights issue di website) ----------
  sec('Dampak investor')
  // ===== 6. Untuk investor per 1 lot =====
  if (!opt.inFull) {
    const s = slide('Investor ritel', 'Dampak terhadap Investor per Satu Lot', r.hak != null
      ? (r.hak > 0 ? `Nilai teoretis 1 HMETD ${rpS(r.hak)}.` : 'Harga tebus di atas TERP: HMETD secara teoretis tidak bernilai.')
      : `Tanpa hak tebus; kepemilikan turun ${pc(r.dilusi)}.`)
    const tiles = [
      !nr && [id(r.perLot.hak, 1), 'HMETD diterima per lot'],
      !nr && [rpS(r.perLot.dana), 'Dana untuk menebus semua hak'],
      r.terp != null && [rpS(r.terp), `Harga teoretis setelah penerbitan (TERP) · ${pctS(r.terp / c.price - 1, 0)} vs pasar`],
      !nr && r.hak != null && [r.hak > 0 ? rpS(r.hak) : 'Rp0', 'Nilai teoretis 1 HMETD'],
      [pc(r.dilusi), 'Kepemilikan turun bila tidak ikut'],
    ].filter(Boolean)
    const n = tiles.length, w = (CW - 0.15 * (n - 1)) / n
    tiles.forEach(([v, l], i) => kpi(s, M + i * (w + 0.15), TOP + 0.4, w, 2.2, v, l, i === n - 1 ? th.warn : th.accent))
  }

  // ===== 8. Porsi publik bertahap =====
  if (!opt.inFull) {
    const labels = ['Sekarang', 'Setelah penerbitan', ...(r.pubAfterInj != null ? ['Setelah injeksi tahap lanjutan'] : [])]
    const vals = [c.float || 0, r.pubAfter * 100, ...(r.pubAfterInj != null ? [r.pubAfterInj * 100] : [])].map(v => Math.round(v * 100) / 100)
    const low = Math.min(...vals) < 7.5
    const s = slide('Porsi publik', 'Porsi Kepemilikan Publik setelah Penerbitan', low
      ? 'Porsi publik bisa turun di bawah batas free float 7,5%: risiko likuiditas dan kewajiban menambah saham publik.'
      : `Porsi publik ${id(vals[0], 2)}% → ${id(vals[vals.length - 1], 2)}%.`)
    s.addChart(pres.charts.BAR, [{ name: 'Porsi publik (%)', labels, values: vals }], { ...chartBase(), x: M, y: TOP, w: 6.2, h: 3.3, barDir: 'col',
      chartColors: [low ? th.bad : th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: th.ink, dataLabelFormatCode: '0.0', showLegend: false, valAxisMinVal: 0, valAxisLabelFormatCode: '0' })
    const x = M + 6.4, w = CW - 6.4
    card(s, x, TOP, w, 3.3)
    T(s, 'BATAS FREE FLOAT', { x: x + 0.2, y: TOP + 0.2, w: w - 0.4, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    T(s, '7,5%', { x: x + 0.2, y: TOP + 0.45, w: w - 0.4, h: 0.6, fontFace: th.head, fontSize: 30, bold: true, color: low ? th.bad : th.good })
    T(s, nr ? 'Penerbitan tanpa hak tebus: porsi publik pasti turun.' : `Simulasi: publik menebus ${d.U || 0}%. Bila publik menebus penuh, porsinya tetap ${id(c.float || 0, 2)}%.`,
      { x: x + 0.2, y: TOP + 1.15, w: w - 0.4, h: 1.0, fontSize: 9.5, color: th.muted })
  }

  // ---------- Bagian: Penutup (urutan sama dengan analisa rights issue di website) ----------
  sec('Penutup')
  // ===== 6b2. Laba sebelum/sesudah aset masuk & kesimpulan layak investasi =====
  {
    const lbA = c.doc ? asetLaba(c.doc, { S1: r.S1, P }) : null
    const ls = labaSebelumSesudah(c, r, lbA)
    const ly = riLayak(c, r, lbA, ls)
    const rt = riRating(ly, riTrading(c, r), c, r)
    if (ly) {
      const s = slide('Kelayakan', 'Laba Setelah Aset Masuk dan Rekomendasi Investasi', rt.partTxt)
      const lw = 5.0
      if (ls) {
        const rows = [['', 'Sebelum', 'Setelah'], ['Laba bersih setahun', bigS(ls.before.laba), bigS(ls.after.laba)], ['Jumlah saham', shS(ls.before.saham), shS(ls.after.saham)],
          ['Laba per saham', 'Rp' + id(ls.before.eps, 2), 'Rp' + id(ls.after.eps, 2)], ['Harga acuan', rpS(ls.before.harga) + ' (kini)', rpS(Math.round(ls.after.harga)) + ' (teoretis)'],
          ['PER', ls.before.per ? id(ls.before.per, 1) + '×' : 'rugi', ls.after.per ? id(ls.after.per, 1) + '×' : 'rugi']]
        rows.forEach((rw, i) => {
          const y = TOP + i * 0.42
          if (i) line(s, M, y, lw, 0, th.line, { w: 0.5 })
          rw.forEach((v, j) => T(s, v, { x: M + (j ? 1.6 + (j - 1) * 1.7 : 0), y, w: j ? 1.65 : 1.6, h: 0.42, fontSize: i ? 9.5 : 8, bold: !i || j === 2, color: i ? th.ink : th.muted, valign: 'middle', align: j ? 'right' : 'left' }))
        })
        T(s, ls.akresi ? 'Transaksi menaikkan laba per saham (akresi).' : 'Transaksi menurunkan laba per saham (dilutif).', { x: M, y: TOP + 6 * 0.42 + 0.05, w: lw, h: 0.4, fontSize: 9.5, bold: true, color: ls.akresi ? th.good : th.bad })
      } else T(s, 'Laba sebelum vs setelah aset masuk belum dapat dihitung: laba aset belum diungkap di dokumen.', { x: M, y: TOP, w: lw, h: 0.6, fontSize: 10, color: th.muted })
      const x = M + lw + 0.25, w = CW - lw - 0.25
      card(s, x, TOP, w, 3.35, { fill: th.dark, line: th.dark })
      T(s, 'REKOMENDASI', { x: x + 0.18, y: TOP + 0.12, w: w - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, rt.rating, { x: x + 0.18, y: TOP + 0.36, w: w - 0.3, h: 0.45, fontFace: th.head, fontSize: 18, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
      T(s, rt.sub, { x: x + 0.18, y: TOP + 0.82, w: w - 0.3, h: 0.42, fontSize: 8.5, color: 'EAF2FA', fit: 'shrink' })
      T(s, `Partisipasi rights issue: ${rt.partisipasi}`, { x: x + 0.18, y: TOP + 1.26, w: w - 0.3, h: 0.24, fontSize: 8.5, bold: true, color: th.accent2 })
      const rs = ly.reasons.slice(0, 5)
      T(s, rs.map((x2, i) => ({ text: `${x2.s > 0 ? '+' : x2.s < 0 ? '−' : '·'} ${short(x2.t, 95)}`, options: { breakLine: i < rs.length - 1, paraSpaceAfter: 2 } })),
        { x: x + 0.18, y: TOP + 1.55, w: w - 0.3, h: 1.75, fontSize: 7.5, color: 'EAF2FA', fit: 'shrink' })
    }
  }

  // ===== 9. Kesimpulan (gelap) =====
  if (!opt.inFull) {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    T(s, 'KESIMPULAN', { x: 0.7, y: 0.6, w: 5, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    if (fund) {
      // Pengumpulan dana: tercapai atau tidak, dengan keterbukaan terakhir dan alasan utama.
      const fc = { good: th.good, warn: th.warn, strong: th.bad }[fund.tone] || th.accent2
      const fx = 6.95, fw = W - fx - 0.4
      s.addShape(S.ROUNDED_RECTANGLE, { x: fx, y: 0.6, w: fw, h: 4.35, rectRadius: 0.08, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: fc, width: 1.5 } })
      T(s, 'PENGUMPULAN DANA', { x: fx + 0.18, y: 0.75, w: fw - 0.36, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 3 })
      T(s, fund.label, { x: fx + 0.18, y: 1.0, w: fw - 0.36, h: 0.62, fontFace: th.head, fontSize: 17, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
      T(s, fund.last ? `Keterbukaan terakhir ${fmtDate(fund.last.date)}: ${short(fund.last.title, 90)}` : 'Belum ada keterbukaan resmi tentang penambahan modal.',
        { x: fx + 0.18, y: 1.66, w: fw - 0.36, h: 0.62, fontSize: 8, color: 'DCE7F3' })
      const rs = [...fund.reasons].sort((a, b) => Math.abs(b.s) - Math.abs(a.s)).slice(0, 5)
      T(s, rs.map((x, i) => ({ text: `${x.s > 0 ? 'Pendukung: ' : x.s < 0 ? 'Risiko: ' : 'Catatan: '}${short(x.t, 95)}`, options: { color: x.s > 0 ? 'BBF7D0' : x.s < 0 ? 'FDE68A' : 'EAF2FA', breakLine: i < rs.length - 1, paraSpaceAfter: 4 } })),
        { x: fx + 0.18, y: 2.32, w: fw - 0.36, h: 2.55, fontSize: 8.5 })
    } else coverArt(s, d.sector?.motif, th, S, dot, line, true)
    T(s, `${d.t}: ${c.label}`, { x: 0.7, y: 0.95, w: 6.0, h: 0.8, fontFace: th.head, fontSize: 30, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    const pts = [
      `Nilai ${what} ${bigS(r.total)} (${shS(r.N)} saham × ${rpS(P)}); dana tunai ${bigS(r.tunai)}.`,
      c.inj ? `Aset injeksi ${!c.doc && det?.spread ? bigS(det.lo) + '–' + bigS(det.hi) : bigS(c.inj)}${c.doc?.kewajaran?.putusan ? ' (' + c.doc.kewajaran.putusan + ')' : ''}${c.laterInj ? `, dibayar ±${shS(r.injShares)} saham di tahap lanjutan` : ''}.` : null,
      `Porsi publik ${pc((c.float || 0) / 100)} → ${pc(r.pubAfterInj ?? r.pubAfter)}${r.pubAfterInj != null ? ' setelah semua tahap' : ''}.`,
      fund ? `Pengumpulan dana: ${fund.label.toLowerCase()}.` : null,
      ...verdict.split(/(?<=\.)\s+/).filter(Boolean),
      c.jadwal ? `Berikutnya: ${c.jadwal}.` : null,
    ].filter(Boolean).slice(0, 5)
    pts.forEach((p, i) => {
      const y = 1.9 + i * 0.5
      dot(s, 0.85, y + 0.15, 0.07, th.accent2)
      T(s, short(p, 120), { x: 1.1, y, w: 5.6, h: 0.46, fontSize: 10.5, color: 'F8FAFC' })
    })
    T(s, short(c.notes.join(' '), 260), { x: 0.7, y: 4.5, w: 6.5, h: 0.5, fontSize: 8.5, color: 'DCE7F3' })
    T(s, 'Simulasi ini disusun dari data kurasi dan keterbukaan informasi publik. Angka bersifat indikatif hingga prospektus dan laporan KJPP terbit, dan bukan merupakan anjuran membeli atau menjual efek.', { x: 0.7, y: 5.05, w: 6.5, h: 0.3, fontSize: 8, color: 'DCE7F3' })
  }

}

export const riDeckFileName = (t, date, theme) => `${t}_RightsIssue_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`

// Nama berkas unduhan.
export const deckFileName = (t, date, theme, info = false) => `${t}_${info ? 'Infografis' : 'Analisa'}_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`
