// Presentasi versi infografis: format slide 16:9 dengan urutan bagian seperti presentasi lengkap, tetapi setiap slide
// berbentuk grafis (ikon, angka besar, diagram, garis waktu, batang, kartu skenario) dan hampir tanpa paragraf.
// Isi mengikuti format riset manajer investasi: rekomendasi & target, data saham, tesis, pandangan berbeda dari pasar,
// katalis, skenario bear/base/bull, risiko & kriteria tesis batal; ditambah analogi rumah untuk transaksi backdoor.
// Bentuk yang dipakai hanya persegi, persegi bundar, lingkaran, segitiga, garis, teks, dan grafik agar PDF identik.
import { rpS, bigS, short } from './deck.js'
import { fmtDate } from './domain.js'

const W = 10, H = 5.625, M = 0.45, CW = W - 2 * M, TOP = 1.15
const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d })
const pctS = v => v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${id(v * 100, 0)}%`
const ent = s => String(s || '').replace(/\s*\(.*?\)/g, '').replace(/^\s*(grup|melalui)\s+/i, '').trim()
// Nama dari kurasi bisa berupa kalimat ("PT X mengakuisisi 753 juta saham ..."): ambil nama inti sebelum kata kerja/koma.
const nama = (s, n = 60) => short(ent(s).split(/\s+(menuntaskan|mengakuisisi|membeli|mengambil|melalui|yang|selaku|sebagai)\b|[,;:]/)[0].trim(), n)
// Buang poin yang maknanya sama (mis. "Laporan KJPP" vs "Laporan KJPP terbit"): dua kata pertama dianggap kunci.
const unik = list => {
  const seen = new Set()
  return list.filter(Boolean).filter(t => {
    const k = String(t).toLowerCase().replace(/^(berikutnya|batal bila):\s*/, '').split(/\s+/).slice(0, 2).join(' ')
    return !seen.has(k) && seen.add(k)
  })
}
const kalimat = t => String(t || '').split(/(?<!\b(?:No|Tbk|Pte|Ltd|PT|Kec|Kab|dr|Sdn|Bhd|Co|Inc|vs|dkk|mis))[.;]\s+(?=[A-Z])/)
  .map(x => x.trim().replace(/[.;]?$/, '.')).filter(x => x.length > 15)

// Angka utama untuk kartu aset: utamakan angka bersatuan (umur -> "tahun"), abaikan tahun kalender (2024, 2026).
const SATUAN_RX = /[±~]?\d[\d.,]*\s*(juta ton|juta MT|ton|ha|hektare|MW|MMSCFD|liter\/detik|tahun|%|kolam|unit|km|triliun|miliar|T|M)(?![A-Za-z])/gi
function angkaUtama(label, v) {
  const t = String(v || '')
  const all = [...t.matchAll(SATUAN_RX)].map(m => m[0].trim())
  const pick = /umur/i.test(label) ? all.find(x => /tahun/i.test(x)) : all.find(x => !/^\d{4}\s*tahun$/i.test(x))
  if (pick) return pick
  // Umur tanpa angka bersatuan tahun (mis. hanya masa izin "s.d. 2035"): jangan ambil tahun kalender.
  if (/umur/i.test(label)) return 'belum dapat dihitung'
  const n = [...t.matchAll(/[±~]?\d[\d.,]*/g)].map(m => m[0]).find(x => !/^(19|20)\d{2}$/.test(x))
  return n || short(t, 18)
}

// Skenario valuasi bear/base/bull dari rekomendasi & nilai wajar analis (harga per saham).
function skenario(d) {
  const A = d.A || {}, rc = d.rec || {}, nw = d.pa?.nilaiWajar || {}, p = A.price
  const tg = (rc.targets || []).map(t => t.p).filter(x => x > 0)
  const bear = rc.stop || (nw.bawah && nw.bawah < p ? nw.bawah : null) || A.p?.metrics?.low52 || null
  const base = tg[0] || (nw.bawah && nw.atas ? (nw.bawah + nw.atas) / 2 : null)
  const bull = tg[1] || nw.atas || null
  return [['Bear', bear, 'batas risiko / nilai bawah'], ['Base', base, tg[0] ? 'target pertama' : 'tengah nilai wajar'], ['Bull', bull, tg[1] ? 'target kedua' : 'nilai wajar atas']]
    .map(([n, v, k]) => ({ n, v, k, r: v && p ? v / p - 1 : null }))
}

function kit(PptxGenJS, d, th, title) {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  pres.author = 'Radar Backdoor'
  pres.company = 'Radar Backdoor'
  pres.title = title
  const S = pres.shapes
  let page = 0
  const T = (s, text, o = {}) => s.addText(text, { isTextBox: true, margin: 0, fontFace: th.body, color: th.ink, valign: 'top', fit: 'shrink', fontSize: 11, ...o })
  const box = (s, x, y, w, h, fill, o = {}) => s.addShape(o.round === false ? S.RECTANGLE : S.ROUNDED_RECTANGLE,
    { x, y, w, h, rectRadius: o.r ?? 0.08, fill: { color: fill, transparency: o.tr || 0 }, line: { color: o.line || fill, width: o.lw || 0.75, transparency: o.line ? 0 : o.tr || 0 } })
  const dot = (s, cx, cy, r, fill, o = {}) => s.addShape(S.OVAL, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r,
    fill: { color: fill, transparency: o.tr || 0 }, line: { color: o.line || fill, width: o.lw || 0.75, transparency: o.line ? 0 : o.tr || 0 } })
  // Garis dengan panah; arah ke kiri/atas lewat flipH/flipV (ukuran negatif merusak berkas).
  const arrow = (s, x, y, w, h, color, o = {}) => s.addShape(S.LINE, { x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h),
    flipH: w < 0, flipV: h < 0, line: { color, width: o.w || 2.5, endArrowType: o.noArrow ? undefined : 'triangle' } })
  // Panah melengkung: kurva kuadratik digambar sebagai rangkaian garis pendek; segmen terakhir berujung panah.
  const arc = (s, x1, y1, cx, cy, x2, y2, color, wd = 7) => {
    const n = 14, pts = []
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2]) }
    pts.slice(1).forEach(([x, y], i) => arrow(s, pts[i][0], pts[i][1], x - pts[i][0], y - pts[i][1], color, { w: wd, noArrow: i < n - 1 }))
  }
  // Ikon = lingkaran berisi singkatan teks (simbol khusus tidak tersedia di font PDF).
  const icon = (s, cx, cy, r, txt, fill, ink = 'FFFFFF') => {
    dot(s, cx, cy, r, fill)
    T(s, txt, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fontSize: Math.max(7, Math.round(r * 32)), bold: true, color: ink, align: 'center', valign: 'middle' })
  }
  // Ikon gambar sederhana dari bentuk: rumah, orang, kotak aset.
  const rumah = (s, cx, cy, sz, col) => {
    s.addShape(S.ISOSCELES_TRIANGLE || S.TRIANGLE, { x: cx - sz * 0.62, y: cy - sz * 0.75, w: sz * 1.24, h: sz * 0.55, fill: { color: col }, line: { color: col, width: 0.5 } })
    box(s, cx - sz * 0.48, cy - sz * 0.22, sz * 0.96, sz * 0.7, col, { r: 0.02 })
    box(s, cx - sz * 0.12, cy + sz * 0.1, sz * 0.24, sz * 0.38, 'FFFFFF', { r: 0.02 })
  }
  const orang = (s, cx, cy, sz, col) => { dot(s, cx, cy - sz * 0.42, sz * 0.22, col); box(s, cx - sz * 0.32, cy - sz * 0.15, sz * 0.64, sz * 0.62, col, { r: 0.12 }) }
  const kotak = (s, cx, cy, sz, col) => { box(s, cx - sz * 0.55, cy - sz * 0.4, sz * 1.1, sz * 0.8, col, { r: 0.03 }); box(s, cx - sz * 0.08, cy - sz * 0.4, sz * 0.16, sz * 0.8, th.warn, { r: 0 }) }
  // Kerangka slide isi: label bagian bernomor, judul besar, kaki halaman (tanpa paragraf penutup).
  let sec = ''
  const slide = (label, title) => {
    const s = pres.addSlide(); page++
    s.background = { color: th.bg }
    box(s, 0, 0, 0.16, H, th.accent, { round: false })
    T(s, `${page - 1}. ${label}`.toUpperCase(), { x: M, y: 0.28, w: 6, h: 0.22, fontSize: 9.5, bold: true, color: th.accent, charSpacing: 4 })
    if (sec) T(s, sec.toUpperCase(), { x: W - M - 3, y: 0.28, w: 3, h: 0.22, fontSize: 8, bold: true, color: th.muted, charSpacing: 3, align: 'right' })
    T(s, title, { x: M, y: 0.5, w: CW, h: 0.55, fontFace: th.head, fontSize: 24, bold: true, valign: 'middle' })
    T(s, `${d.t} | Infografis Radar Backdoor | Data per ${fmtDate(d.date)}`, { x: M, y: 5.27, w: 6, h: 0.2, fontSize: 7.5, color: th.muted })
    T(s, String(page), { x: W - M - 0.5, y: 5.27, w: 0.5, h: 0.2, fontSize: 7.5, color: th.muted, align: 'right' })
    return s
  }
  return { pres, S, T, box, dot, arrow, arc, icon, rumah, orang, kotak, slide, setSec: v => { sec = v }, bump: () => ++page }
}

export function buildInfoDeck(PptxGenJS, d, th) {
  const K = kit(PptxGenJS, d, th, `${d.t}: Infografis Riset Backdoor Listing`)
  const { pres, T, box, dot, arrow, arc, icon, rumah, orang, kotak, slide } = K
  const A = d.A || {}, st = d.story || {}, sv = A.sv || {}, pv = d.pv || {}, pa = d.pa || {}, rc = d.rec, rs = d.riset || {}
  const m = A.p?.metrics || {}, sx = A.p?.stats || {}, p = A.price
  const nilai = d.tx || d.ri?.inj || null
  const who = nama(pv.siapa || A.ctrlName || d.item?.acquirer || 'belum diketahui')
  const injT = nama(d.ri?.injTarget || sv.injectTarget || d.aset?.aset?.nama || st.inject || '', 80)
  const sk = skenario(d), base = sk[1]
  const rcol = rc?.tone === 'good' ? th.good : rc?.tone === 'bad' ? th.bad : th.warn
  const pct1 = v => v == null ? '–' : id(v, 1) + '%'

  // ===== 1. Sampul =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    dot(s, 8.3, 1.2, 2.4, th.accent, { tr: 40 })
    dot(s, 9.4, 4.8, 1.4, th.accent2, { tr: 75 })
    T(s, 'INFOGRAFIS RISET · BACKDOOR LISTING', { x: 0.7, y: 0.85, w: 6, h: 0.28, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, d.t, { x: 0.7, y: 1.2, w: 5.5, h: 1.15, fontFace: th.head, fontSize: 70, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, short(d.name || '', 60), { x: 0.7, y: 2.4, w: 6, h: 0.35, fontSize: 15, color: th.accent2 })
    // Lencana rekomendasi + harga/target/potensi.
    box(s, 0.7, 3.05, 5.6, 0.5, rcol)
    T(s, short(rc?.label || pa.sikap || 'Belum ada rekomendasi', 50), { x: 0.85, y: 3.05, w: 5.3, h: 0.5, fontSize: 15, bold: true, color: 'FFFFFF', valign: 'middle' })
    ;[['HARGA', rpS(p)], ['TARGET', base.v ? rpS(base.v) : '–'], ['POTENSI', base.r != null ? pctS(base.r) : '–'], ['SKOR', A.score != null ? `${A.score}/100` : '–']].forEach(([l, v], i) => {
      const x = 0.7 + i * 1.42
      T(s, l, { x, y: 3.75, w: 1.35, h: 0.2, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, v, { x, y: 3.95, w: 1.35, h: 0.45, fontFace: th.head, fontSize: 20, bold: true, color: 'FFFFFF', valign: 'middle' })
    })
    T(s, `${d.sector?.label || 'Umum'} · Data per ${fmtDate(d.date)}`, { x: 0.7, y: 4.85, w: 6, h: 0.25, fontSize: 9.5, color: 'DCE7F3' })
  }

  // ===== 2. Analogi rumah =====
  K.setSec('Ringkasan')
  {
    const s = slide('Analogi', `Memahami ${d.t} lewat analogi rumah`)
    const sc = [
      [rumah, 'Rumah lama', 'emiten sebelum diambil alih', short(st.lama || 'usaha lama belum diketahui', 55)],
      [orang, 'Pembeli rumah', 'pengendali baru', `${short(who, 30)} · ${pct1(A.ctrlPct)}${A.tender?.price ? ` · PTW ${rpS(A.tender.price)}` : ''}`],
      [kotak, 'Perabot baru', 'aset yang diinjeksi', `${short(injT || 'belum diungkap', 34)}${nilai ? ` · ${bigS(nilai)}` : ''}`],
      [rumah, 'Rumah baru', 'bisnis setelah transformasi', `${short(st.baru || sv.baru || 'belum diungkap', 40)} · renovasi ${d.prog ? d.prog.pct + '%' : '–'}`],
    ]
    const cw = CW / 4
    sc.forEach(([ik, judul, istilah, isi], i) => {
      const cx = M + cw * i + cw / 2, cy = TOP + 0.95
      dot(s, cx, cy, 0.78, th.accent2, { tr: 45 })
      ik(s, cx, cy + 0.05, 0.75, i === 3 ? th.good : th.accent)
      T(s, judul, { x: cx - cw / 2 + 0.05, y: cy + 0.9, w: cw - 0.1, h: 0.36, fontFace: th.head, fontSize: 16, bold: true, color: th.accent, align: 'center', valign: 'middle' })
      T(s, istilah, { x: cx - cw / 2 + 0.05, y: cy + 1.26, w: cw - 0.1, h: 0.2, fontSize: 8.5, bold: true, align: 'center' })
      T(s, isi, { x: cx - cw / 2 + 0.1, y: cy + 1.48, w: cw - 0.2, h: 0.5, fontSize: 8.5, color: th.muted, align: 'center' })
      if (i < 3) arc(s, cx + 0.62, cy - 0.55, cx + cw / 2, cy - 1.05, cx + cw - 0.62, cy - 0.55, th.good, 5)
    })
    box(s, M, 4.45, CW, 0.62, th.card, { line: th.line })
    orang(s, M + 0.35, 4.8, 0.4, th.muted); orang(s, M + 0.62, 4.83, 0.36, th.muted)
    T(s, [{ text: `Penghuni lain = publik (${pct1(A.flt)}). `, options: { bold: true } },
      { text: 'Renovasi dengan patungan (rights issue) tanpa ikut = bagian mengecil (dilusi). Nilai rumah ditaksir juru taksir independen (KJPP).' }],
      { x: M + 1.0, y: 4.5, w: CW - 1.1, h: 0.52, fontSize: 9, valign: 'middle' })
  }

  // ===== 3. Ringkasan transaksi (diagram) =====
  {
    const s = slide('Ringkasan transaksi', 'Transaksi dalam satu gambar')
    const bw = 2.3, bh = 0.72, ex = W / 2 - 1.2, ew = 2.4, cy = TOP + 1.25
    box(s, M, TOP + 0.05, bw, bh, th.card, { line: th.line })
    T(s, 'PENGENDALI LAMA', { x: M + 0.12, y: TOP + 0.11, w: bw - 0.24, h: 0.16, fontSize: 7, bold: true, color: th.muted, charSpacing: 2 })
    T(s, short(nama(st.oldName, 45) || 'belum diketahui', 40) + (st.oldPct ? ` (${st.oldPct})` : ''), { x: M + 0.12, y: TOP + 0.3, w: bw - 0.24, h: 0.4, fontSize: 10, bold: true, valign: 'middle' })
    arrow(s, M + bw / 2, TOP + 0.05 + bh, 0, 0.3, th.muted)
    box(s, M, cy - bh / 2 + 0.25, bw, bh, th.accent)
    T(s, 'PENGENDALI BARU', { x: M + 0.12, y: cy - bh / 2 + 0.31, w: bw - 0.24, h: 0.16, fontSize: 7, bold: true, color: th.accent2, charSpacing: 2 })
    T(s, short(who, 40), { x: M + 0.12, y: cy - bh / 2 + 0.5, w: bw - 0.24, h: 0.4, fontSize: 10, bold: true, color: 'FFFFFF', valign: 'middle' })
    box(s, ex, TOP + 0.35, ew, 1.6, th.dark)
    T(s, d.t, { x: ex, y: TOP + 0.45, w: ew, h: 0.5, fontFace: th.head, fontSize: 26, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: 'Lama: ', options: { bold: true, color: th.accent2 } }, { text: short(st.lama || 'belum diketahui', 40), options: { breakLine: true } },
      { text: 'Baru: ', options: { bold: true, color: th.accent2 } }, { text: short(st.baru || sv.baru || 'belum diungkap', 40) }],
      { x: ex + 0.12, y: TOP + 1.0, w: ew - 0.24, h: 0.85, fontSize: 9, color: 'FFFFFF', valign: 'middle' })
    arrow(s, M + bw, cy + 0.25, ex - M - bw, 0, th.accent)
    T(s, pct1(A.ctrlPct), { x: M + bw, y: cy + 0.0, w: ex - M - bw, h: 0.2, fontSize: 9, bold: true, color: th.accent, align: 'center' })
    const ax = W - M - bw
    box(s, ax, TOP + 0.75, bw, bh + 0.05, th.card, { line: th.accent, lw: 1.5 })
    T(s, 'ASET INJEKSI', { x: ax + 0.12, y: TOP + 0.81, w: bw - 0.24, h: 0.16, fontSize: 7, bold: true, color: th.accent, charSpacing: 2 })
    T(s, short(injT || (d.ri ? 'Penambahan modal' : 'belum diungkap'), 50), { x: ax + 0.12, y: TOP + 1.0, w: bw - 0.24, h: 0.45, fontSize: 10, bold: true, valign: 'middle' })
    arrow(s, ax, TOP + 0.75 + bh / 2, ex + ew - ax, 0, th.accent)
    T(s, nilai ? bigS(nilai) : '', { x: ex + ew, y: TOP + 0.75 + bh / 2 - 0.25, w: ax - ex - ew, h: 0.2, fontSize: 9, bold: true, color: th.accent, align: 'center' })
    // Empat angka transaksi.
    const k4 = [['Tx', nilai ? bigS(nilai) : 'belum ada', 'nilai transaksi'], ['x', nilai && A.mcap ? id(nilai / A.mcap, 1) + 'x' : '–', 'terhadap kapitalisasi'],
      ['%', d.prog ? d.prog.pct + '%' : '–', 'progres tahapan'], ['Rp', A.tender?.price ? pctS(p / A.tender.price - 1) : '–', 'harga kini vs PTW']]
    const kw = (CW - 0.45) / 4
    k4.forEach(([g, v, l], i) => {
      const x = M + i * (kw + 0.15)
      box(s, x, 3.6, kw, 1.05, th.card, { line: th.line })
      icon(s, x + 0.4, 4.12, 0.24, g, th.accent)
      T(s, v, { x: x + 0.75, y: 3.72, w: kw - 0.85, h: 0.48, fontFace: th.head, fontSize: 18, bold: true, valign: 'middle' })
      T(s, l, { x: x + 0.75, y: 4.2, w: kw - 0.85, h: 0.35, fontSize: 8.5, color: th.muted })
    })
  }

  // ===== 4. Data saham =====
  K.setSec('Profil')
  {
    const s = slide('Data saham', `${d.t} dalam angka`)
    const tiles = [
      ['Rp', rpS(p), 'harga terakhir', A.tender?.price ? `PTW ${rpS(A.tender.price)}` : ''],
      ['Kap', bigS(sx.marketCap || A.mcap), 'kapitalisasi pasar', m.pbv != null ? `PBV ${id(m.pbv, 2)}x` : ''],
      ['52m', m.low52 ? `${rpS(m.low52)}–${rpS(m.high52)}` : '–', 'rentang 52 minggu', m.ret1y ? `1 tahun ${m.ret1y}` : ''],
      ['Ctl', pct1(A.ctrlPct), 'porsi pengendali', short(who, 26)],
      ['Pub', pct1(A.flt), 'porsi publik', A.flt != null && A.flt < 7.5 ? 'di bawah 7,5%' : ''],
      ['Skr', A.score != null ? `${A.score}/100` : '–', 'skor analisis', short(pa.sikap || '', 26)],
    ]
    const tw = (CW - 0.3) / 3, th2 = 1.05
    tiles.forEach(([g, v, l, n], i) => {
      const x = M + (i % 3) * (tw + 0.15), y = TOP + Math.floor(i / 3) * (th2 + 0.15)
      box(s, x, y, tw, th2, th.card, { line: th.line })
      icon(s, x + 0.45, y + th2 / 2, 0.3, g, i === 5 ? th.good : th.accent)
      T(s, v, { x: x + 0.88, y: y + 0.1, w: tw - 0.98, h: 0.45, fontFace: th.head, fontSize: 19, bold: true, valign: 'middle' })
      T(s, l.toUpperCase(), { x: x + 0.88, y: y + 0.56, w: tw - 0.98, h: 0.17, fontSize: 7, bold: true, color: th.accent, charSpacing: 2 })
      if (n) T(s, n, { x: x + 0.88, y: y + 0.75, w: tw - 0.98, h: 0.2, fontSize: 8, color: th.muted })
    })
    // Pemegang saham (batang) + grafik harga.
    const y2 = TOP + 2.45, hw = CW / 2 - 0.1
    T(s, 'PEMEGANG SAHAM UTAMA', { x: M, y: y2, w: hw, h: 0.2, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    const holders = (d.profile?.shareholders || []).map(h => ({ ...h, pct: parseFloat(String(h.pct).replace(',', '.')) })).filter(h => h.pct > 0).slice(0, 4)
    holders.forEach((h, i) => {
      const yy = y2 + 0.28 + i * 0.3
      T(s, short(h.name, 30), { x: M, y: yy, w: 1.9, h: 0.22, fontSize: 8, bold: !!h.pengendali, valign: 'middle' })
      box(s, M + 1.95, yy + 0.06, hw - 2.6, 0.12, th.line, { r: 0.06 })
      box(s, M + 1.95, yy + 0.06, Math.max(0.06, (hw - 2.6) * h.pct / 100), 0.12, h.pengendali ? th.accent : th.muted, { r: 0.06 })
      T(s, id(h.pct, 1) + '%', { x: M + hw - 0.6, y: yy, w: 0.6, h: 0.22, fontSize: 8.5, bold: true, align: 'right', valign: 'middle' })
    })
    if (!holders.length) T(s, 'Data pemegang saham belum tersedia.', { x: M, y: y2 + 0.3, w: hw, h: 0.25, fontSize: 9, color: th.muted })
    T(s, 'HARGA 1 TAHUN', { x: M + hw + 0.2, y: y2, w: hw, h: 0.2, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    const bars = (d.tech?.bars || []).filter(b => b.c > 0)
    if (bars.length > 20) {
      const stp = Math.max(1, Math.floor(bars.length / 60)), pts = bars.filter((_, i) => i % stp === 0 || i === bars.length - 1)
      s.addChart(pres.charts.LINE, [{ name: d.t, labels: pts.map(b => String(b.d || '').slice(5, 10)), values: pts.map(b => b.c) }], {
        x: M + hw + 0.15, y: y2 + 0.2, w: hw + 0.05, h: 1.35, lineSize: 2, lineDataSymbol: 'none', chartColors: [th.accent], showLegend: false,
        catAxisHidden: true, valAxisLabelFontSize: 7, valAxisLabelColor: th.muted, valGridLine: { color: th.line, size: 0.5 }, catGridLine: { style: 'none' } })
    } else T(s, 'Data harga belum tersedia.', { x: M + hw + 0.2, y: y2 + 0.3, w: hw, h: 0.25, fontSize: 9, color: th.muted })
  }

  // ===== 5. Aset dalam angka =====
  K.setSec('Aset')
  {
    const s = slide('Aset', short(injT || rs.entitas?.[0]?.nama || 'Aset yang diinjeksi', 60))
    const tb = rs.tambang
    const angka = (tb ? [['Cadangan', tb.cadangan], ['Umur tambang', tb.umur], ['Produksi', tb.produksi], ['Luas / izin', tb.luas || tb.izin]] : [])
      .concat((rs.operasional || []).map(o => [o.l, o.t])).filter(x => x[1] && /\d/.test(x[1])).slice(0, 4)
    const aw = (CW - 0.45) / 4
    angka.forEach(([l, v], i) => {
      const x = M + i * (aw + 0.15)
      box(s, x, TOP, aw, 1.75, th.card, { line: th.line })
      dot(s, x + aw / 2, TOP + 0.45, 0.32, th.accent2, { tr: 30 })
      T(s, String(i + 1), { x: x + aw / 2 - 0.32, y: TOP + 0.13, w: 0.64, h: 0.64, fontFace: th.head, fontSize: 16, bold: true, color: th.accent, align: 'center', valign: 'middle' })
      T(s, short(angkaUtama(l, v), 18), { x: x + 0.08, y: TOP + 0.85, w: aw - 0.16, h: 0.42, fontFace: th.head, fontSize: 17, bold: true, color: th.accent, align: 'center', valign: 'middle' })
      T(s, l.toUpperCase(), { x: x + 0.08, y: TOP + 1.3, w: aw - 0.16, h: 0.17, fontSize: 7, bold: true, align: 'center', charSpacing: 1 })
      T(s, short(v, 60), { x: x + 0.1, y: TOP + 1.48, w: aw - 0.2, h: 0.25, fontSize: 7, color: th.muted, align: 'center' })
    })
    if (!angka.length) T(s, 'Angka aset belum diungkap di sumber publik.', { x: M, y: TOP + 0.3, w: CW, h: 0.3, color: th.muted })
    // Aset lain milik pengendali (kartu).
    const pa2 = (rs.pengendaliAset || []).slice(0, 3)
    T(s, 'ASET LAIN MILIK PENGENDALI', { x: M, y: TOP + 1.95, w: CW, h: 0.2, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    const pw = (CW - 0.3) / 3
    ;(pa2.length ? pa2 : [{ nama: 'Belum ditemukan di sumber publik' }]).forEach((e, i) => {
      const x = M + i * (pw + 0.15)
      box(s, x, TOP + 2.22, pw, 1.55, th.card, { line: th.line })
      kotak(s, x + 0.4, TOP + 2.62, 0.45, th.muted)
      T(s, short(e.nama, 55), { x: x + 0.75, y: TOP + 2.32, w: pw - 0.85, h: 0.45, fontSize: 9, bold: true, valign: 'middle' })
      T(s, short([e.jenis, e.lokasi].filter(Boolean).join(' · '), 60), { x: x + 0.15, y: TOP + 2.88, w: pw - 0.3, h: 0.2, fontSize: 7.5, color: th.accent })
      T(s, short(e.detail || e.hubungan || '', 120), { x: x + 0.15, y: TOP + 3.1, w: pw - 0.3, h: 0.6, fontSize: 7.5, color: th.muted })
    })
  }

  // ===== 6. Garis waktu transaksi =====
  K.setSec('Story & Pengendali')
  {
    const s = slide('Garis waktu', `Progres transaksi ${d.prog ? d.prog.pct + '%' : ''}`)
    const ms = (d.prog?.applicable || d.milestones || []).slice(0, 8)
    if (ms.length) {
      const y = TOP + 1.35, gap = CW / ms.length
      box(s, M + gap / 2, y - 0.05, gap * (ms.length - 1), 0.1, th.line, { r: 0.05 })
      const done = ms.filter(x => d.prog?.ms?.[x.id]).length
      if (done > 1) box(s, M + gap / 2, y - 0.05, gap * (done - 1), 0.1, th.good, { r: 0.05 })
      ms.forEach((mm, i) => {
        const cx = M + gap * i + gap / 2, ok = !!d.prog?.ms?.[mm.id]
        dot(s, cx, y, 0.26, ok ? th.good : th.card, { line: ok ? th.good : th.muted, lw: 2 })
        T(s, ok ? 'v' : String(i + 1), { x: cx - 0.26, y: y - 0.26, w: 0.52, h: 0.52, fontSize: 12, bold: true, color: ok ? 'FFFFFF' : th.muted, align: 'center', valign: 'middle' })
        const up = i % 2 === 0
        T(s, short(mm.label, 50), { x: cx - gap / 2 + 0.03, y: up ? y - 1.05 : y + 0.4, w: gap - 0.06, h: 0.65, fontSize: 8.5, bold: ok, color: ok ? th.ink : th.muted, align: 'center', valign: up ? 'bottom' : 'top' })
        const a = d.prog?.auto?.[mm.id]
        if (ok && a) T(s, fmtDate(String(a).slice(0, 10)), { x: cx - gap / 2, y: up ? y + 0.32 : y - 0.52, w: gap, h: 0.18, fontSize: 7, color: th.muted, align: 'center' })
      })
    } else T(s, 'Tonggak transaksi belum dipantau.', { x: M, y: TOP + 0.4, w: CW, h: 0.3, color: th.muted })
    if (d.pos?.next) {
      box(s, M, 4.45, CW, 0.6, th.dark)
      T(s, [{ text: 'TAHAP BERIKUTNYA   ', options: { bold: true, color: th.accent2, fontSize: 9 } }, { text: short(d.pos.next, 90), options: { bold: true, color: 'FFFFFF', fontSize: 13 } }],
        { x: M + 0.2, y: 4.45, w: CW - 0.4, h: 0.6, valign: 'middle' })
    }
  }

  // ===== 7. Tesis & pandangan berbeda =====
  K.setSec('Analisa')
  {
    const s = slide('Tesis investasi', 'Kenapa layak diperhatikan')
    const tesis = (kalimat(pa.tesis).length ? kalimat(pa.tesis) : [...(A.bull || []), ...(d.pc?.pros || []).map(x => x.t)]).slice(0, 3)
    const tw = (CW - 0.3) / 3
    ;(tesis.length ? tesis : ['Tesis analis belum tersedia.']).forEach((t, i) => {
      const x = M + i * (tw + 0.15)
      box(s, x, TOP, tw, 1.9, th.card, { line: th.line })
      icon(s, x + tw / 2, TOP + 0.45, 0.3, String(i + 1), th.accent)
      T(s, short(t, 140), { x: x + 0.15, y: TOP + 0.85, w: tw - 0.3, h: 0.98, fontSize: 10, align: 'center', valign: 'middle' })
    })
    // Pandangan berbeda: harga pasar vs nilai wajar (batang perbandingan).
    const nw = pa.nilaiWajar
    T(s, 'PANDANGAN BERBEDA DARI PASAR', { x: M, y: TOP + 2.1, w: CW, h: 0.2, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    const vs = [['Harga pasar', p, th.dark], nw?.bawah && ['Nilai wajar bawah', nw.bawah, th.warn], nw?.atas && ['Nilai wajar atas', nw.atas, th.good]].filter(Boolean)
    const mx = Math.max(...vs.map(x => x[1] || 0)) * 1.15 || 1
    vs.forEach(([l, v, col], i) => {
      const y = TOP + 2.4 + i * 0.36
      T(s, l, { x: M, y, w: 1.6, h: 0.3, fontSize: 9, bold: i === 0, valign: 'middle' })
      box(s, M + 1.65, y + 0.06, Math.max(0.06, (CW - 3.2) * (v || 0) / mx), 0.2, col, { r: 0.04 })
      T(s, `${rpS(v)}${i ? ` (${pctS(v / p - 1)})` : ''}`, { x: M + 1.72 + (CW - 3.2) * (v || 0) / mx, y, w: 1.5, h: 0.3, fontSize: 9, bold: true, valign: 'middle' })
    })
    if (!nw) T(s, 'Nilai wajar analis belum ditetapkan.', { x: M, y: TOP + 2.8, w: CW, h: 0.25, fontSize: 9, color: th.muted })
  }

  // ===== 8. Katalis vs risiko =====
  {
    const s = slide('Katalis vs risiko', 'Yang ditunggu dan yang diwaspadai')
    const next = (d.prog?.applicable || []).filter(x => !d.prog?.ms?.[x.id]).slice(0, 2).map(x => x.label)
    const kat = unik([d.pos?.next, ...next, ...(pa.variabelKunci || []), ...(A.bull || [])]).slice(0, 4)
    const risk = unik([...(pa.tesisSalahBila || []).map(x => 'Batal bila: ' + x), ...(A.bear || []), ...(d.pc?.cons || []).map(x => x.t), ...(rs.risiko || [])]).slice(0, 4)
    const hw = CW / 2 - 0.1
    ;[[kat, '+', th.good, 'KATALIS', M], [risk, '!', th.bad, 'RISIKO & TESIS BATAL', M + hw + 0.2]].forEach(([list, g, col, lbl, x]) => {
      box(s, x, TOP, hw, 3.9, th.card, { line: col, lw: 1.5 })
      box(s, x, TOP, hw, 0.55, col)
      icon(s, x + 0.35, TOP + 0.275, 0.18, g, 'FFFFFF', col)
      T(s, lbl, { x: x + 0.65, y: TOP, w: hw - 0.8, h: 0.55, fontSize: 11, bold: true, color: 'FFFFFF', charSpacing: 2, valign: 'middle' })
      ;(list.length ? list : ['Belum ada yang menonjol.']).forEach((t, i) => {
        const y = TOP + 0.75 + i * 0.78
        icon(s, x + 0.35, y + 0.25, 0.17, String(i + 1), col)
        T(s, short(t, 110), { x: x + 0.65, y, w: hw - 0.8, h: 0.6, fontSize: 9.5, valign: 'middle' })
      })
    })
  }

  // ===== 9. Skenario valuasi =====
  K.setSec('Spekulasi')
  {
    const s = slide('Skenario valuasi', 'Bear, base, dan bull')
    const cw3 = (CW - 0.3) / 3
    sk.forEach((x, i) => {
      const col = [th.bad, th.accent, th.good][i], cx = M + i * (cw3 + 0.15), hgt = [2.2, 2.75, 3.3][i]
      box(s, cx, TOP + 3.4 - hgt, cw3, hgt, col, { tr: 82 })
      box(s, cx, TOP + 3.4 - hgt, cw3, 0.5, col)
      T(s, x.n.toUpperCase(), { x: cx, y: TOP + 3.4 - hgt, w: cw3, h: 0.5, fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', charSpacing: 3 })
      T(s, x.v ? rpS(x.v) : '–', { x: cx, y: TOP + 3.4 - hgt + 0.65, w: cw3, h: 0.6, fontFace: th.head, fontSize: 28, bold: true, align: 'center', valign: 'middle' })
      T(s, x.r != null ? pctS(x.r) : '', { x: cx, y: TOP + 3.4 - hgt + 1.25, w: cw3, h: 0.4, fontFace: th.head, fontSize: 18, bold: true, color: col, align: 'center', valign: 'middle' })
      T(s, x.k, { x: cx + 0.1, y: TOP + 3.4 - hgt + 1.68, w: cw3 - 0.2, h: 0.3, fontSize: 8.5, color: th.muted, align: 'center' })
    })
    T(s, `Harga kini ${rpS(p)}`, { x: M, y: TOP + 3.5, w: CW, h: 0.3, fontSize: 11, bold: true, align: 'center' })
  }

  // ===== 10. Peta harga =====
  {
    const s = slide('Peta harga', 'Di mana harga sekarang')
    const lv = [
      rc?.stop && ['Batas risiko', rc.stop, th.bad],
      rc?.entry?.[0] && ['Area beli', rc.entry[0], th.accent],
      A.tender?.price && ['Harga PTW', A.tender.price, th.muted],
      pa.nilaiWajar?.bawah && ['Nilai wajar bawah', pa.nilaiWajar.bawah, th.warn],
      pa.nilaiWajar?.atas && ['Nilai wajar atas', pa.nilaiWajar.atas, th.good],
      ...(rc?.targets || []).slice(0, 2).map((t, i) => ['Target ' + (i + 1), t.p, th.good]),
      p && ['Harga kini', p, th.dark],
    ].filter(Boolean).sort((a, b) => a[1] - b[1])
    if (lv.length > 1 && p) {
      const mx = Math.max(...lv.map(x => x[1])) * 1.12, bx = M + 1.75, bwid = CW - 3.1, rh = Math.min(0.48, 3.8 / lv.length)
      lv.forEach(([l, v, col], i) => {
        const y = TOP + i * rh, now = l === 'Harga kini'
        T(s, l, { x: M, y, w: 1.7, h: rh - 0.05, fontSize: 10, bold: now, valign: 'middle' })
        box(s, bx, y + rh * 0.18, Math.max(0.06, bwid * v / mx), rh * 0.6, col, { r: 0.05 })
        T(s, `${rpS(v)}${now ? '' : '  ' + pctS(v / p - 1)}`, { x: bx + bwid * v / mx + 0.08, y, w: 1.4, h: rh - 0.05, fontSize: 10, bold: true, valign: 'middle' })
      })
    } else T(s, 'Level harga acuan belum tersedia.', { x: M, y: TOP + 0.3, w: CW, h: 0.3, color: th.muted })
  }

  // ===== 11. Rekomendasi =====
  K.setSec('Penutup')
  {
    const s = slide('Rekomendasi', 'Rekomendasi investasi')
    box(s, M, TOP, 3.2, 3.85, rcol)
    T(s, 'TINDAKAN', { x: M + 0.25, y: TOP + 0.3, w: 2.7, h: 0.25, fontSize: 9, bold: true, color: 'FFFFFF', charSpacing: 4 })
    T(s, short(rc?.label || 'Belum ada rekomendasi', 45), { x: M + 0.25, y: TOP + 0.65, w: 2.7, h: 1.5, fontFace: th.head, fontSize: 24, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, short(`Porsi: ${rc?.porsi || '–'}`, 90), { x: M + 0.25, y: TOP + 2.35, w: 2.7, h: 0.6, fontSize: 9, color: 'FFFFFF' })
    T(s, short(`Horizon: ${rc?.horizon || '–'}`, 90), { x: M + 0.25, y: TOP + 3.0, w: 2.7, h: 0.6, fontSize: 9, color: 'FFFFFF' })
    const x0 = M + 3.4, cw = (CW - 3.4 - 0.3) / 3
    ;[
      ['Beli', 'AREA BELI', rc?.entry ? (rc.entry[1] ? `${rpS(rc.entry[0])}–${rpS(rc.entry[1])}` : `> ${rpS(rc.entry[0])}`) : 'Tunggu', th.accent],
      ['Tgt', 'TARGET', base.v ? rpS(base.v) : '–', th.good],
      ['Stop', 'BATAS RISIKO', rc?.stop ? rpS(rc.stop) : '–', th.bad],
    ].forEach(([g, l, v, col], i) => {
      const x = x0 + i * (cw + 0.15)
      box(s, x, TOP, cw, 2.1, th.card, { line: col, lw: 1.5 })
      icon(s, x + cw / 2, TOP + 0.55, 0.36, g, col)
      T(s, l, { x, y: TOP + 1.0, w: cw, h: 0.22, fontSize: 8, bold: true, color: col, align: 'center', charSpacing: 2 })
      T(s, v, { x: x + 0.05, y: TOP + 1.25, w: cw - 0.1, h: 0.6, fontFace: th.head, fontSize: 18, bold: true, align: 'center', valign: 'middle' })
    })
    box(s, x0, TOP + 2.3, CW - 3.4, 1.55, th.card, { line: th.line })
    T(s, 'TESIS BATAL BILA', { x: x0 + 0.2, y: TOP + 2.4, w: 3, h: 0.22, fontSize: 8, bold: true, color: th.bad, charSpacing: 2 })
    const exits = [...(pa.tesisSalahBila || []), ...(rc?.exits || [])].filter(Boolean).slice(0, 3)
    ;(exits.length ? exits : ['Belum ada kriteria tertulis.']).forEach((t, i) => {
      dot(s, x0 + 0.3, TOP + 2.83 + i * 0.32, 0.05, th.bad)
      T(s, short(t, 100), { x: x0 + 0.45, y: TOP + 2.72 + i * 0.32, w: CW - 3.4 - 0.6, h: 0.28, fontSize: 9, valign: 'middle' })
    })
  }

  // ===== 12. Penutup (gelap) =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    dot(s, 8.6, 1.0, 2.0, th.accent, { tr: 45 })
    T(s, 'KESIMPULAN', { x: 0.7, y: 0.7, w: 5, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, short(pa.sikap || A.stance?.t || rc?.label || 'Kesimpulan', 40), { x: 0.7, y: 1.05, w: 6.5, h: 0.8, fontFace: th.head, fontSize: 32, bold: true, color: 'FFFFFF', valign: 'middle' })
    ;[['Harga', rpS(p)], ['Target', base.v ? rpS(base.v) : '–'], ['Potensi', base.r != null ? pctS(base.r) : '–'], ['Skor', A.score != null ? `${A.score}/100` : '–']].forEach(([l, v], i) => {
      const x = 0.7 + i * 1.75
      dot(s, x + 0.55, 2.75, 0.55, th.accent, { tr: 20 })
      T(s, v, { x: x - 0.1, y: 2.5, w: 1.3, h: 0.5, fontFace: th.head, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, l.toUpperCase(), { x: x - 0.1, y: 3.4, w: 1.3, h: 0.22, fontSize: 8, bold: true, color: th.accent2, align: 'center', charSpacing: 2 })
    })
    const n = (rs.sumber || []).length
    T(s, `Disusun otomatis dari Stockbit, keterbukaan informasi${n ? `, dan ${n} sumber riset aset` : ''}. Bukan ajakan membeli atau menjual efek.`,
      { x: 0.7, y: 4.75, w: 8.5, h: 0.3, fontSize: 8.5, color: 'DCE7F3' })
  }
  return pres
}

export const infoFileName = (t, date, theme) => `${t}_Infografis_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`
