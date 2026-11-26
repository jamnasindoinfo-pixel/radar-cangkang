// Presentasi PDF: menggambar ulang slide pptxgenjs yang sudah dibangun buildDeck (deck.js) dengan jsPDF,
// sehingga isi dan tema PDF sama dengan .pptx tanpa konversi di server. Yang didukung hanya bentuk, teks,
// dan grafik yang dipakai deck.js; grafik native digambar ulang sebagai vektor sederhana.
// Satuan: inci (sama dengan koordinat pptxgenjs). Ukuran huruf & tebal garis dalam poin.

const PT = 1 / 72

// Font standar PDF hanya memuat WinAnsi; karakter lain dipetakan ke padanan yang aman.
const CHAR_MAP = { '→': '->', '←': '<-', '↑': '^', '↓': 'v', '≥': '>=', '≤': '<=', '≈': '~', '≠': '!=', '−': '-', '‒': '-',
  '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '⚠': '!', 'Δ': 'Delta ', ' ': ' ', ' ': ' ', '​': '', '⤨': '' }
const CP1252 = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
export function pdfText(s) {
  return String(s ?? '').replace(/[^\x00-\xFF]/gu, ch => CHAR_MAP[ch] ?? (CP1252.has(ch) ? ch : '?'))
}

const SERIF = /cambria|bookman|century|times|georgia|garamond/i
const fontOf = face => SERIF.test(face || '') ? 'times' : 'helvetica'
const styleOf = (b, i) => b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal'
const hex = c => '#' + String(c || '000000').replace('#', '').slice(0, 6).padStart(6, '0')

// Transparansi (0–100, gaya PowerPoint) lewat GState; dikembalikan dengan restoreGraphicsState.
function withAlpha(doc, fillTr, lineTr, draw) {
  const fo = 1 - (fillTr || 0) / 100, so = 1 - (lineTr || 0) / 100
  if (fo >= 1 && so >= 1) return draw()
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: fo, 'stroke-opacity': so }))
  draw()
  doc.restoreGraphicsState()
}

// Gaya isian/garis dari opsi pptxgenjs; mengembalikan mode jsPDF ('F', 'S', 'FD') atau null bila tidak terlihat.
function paint(doc, o) {
  const fill = o.fill?.color && (o.fill.transparency ?? 0) < 100 ? o.fill : null
  const ln = o.line?.color && (o.line.width ?? 0.75) > 0 && (o.line.transparency ?? 0) < 100 ? o.line : null
  if (fill) doc.setFillColor(hex(fill.color))
  if (ln) {
    doc.setDrawColor(hex(ln.color)); doc.setLineWidth((ln.width ?? 0.75) * PT)
    doc.setLineDashPattern(ln.dashType && ln.dashType !== 'solid' ? [0.06, 0.04] : [], 0)
  }
  return { mode: fill && ln ? 'FD' : fill ? 'F' : ln ? 'S' : null, ftr: fill?.transparency || 0, ltr: ln?.transparency || 0 }
}

// Poligon dari titik absolut (diputar di sekitar pusat kotak bila ada rotate).
function poly(doc, pts, mode, o) {
  if (o.rotate) {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2, a = o.rotate * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
    pts = pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c])
  }
  const d = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]])
  doc.lines(d, pts[0][0], pts[0][1], [1, 1], mode, true)
}

function shapePoints(kind, { x, y, w, h }) {
  switch (kind) {
    case 'hexagon': { const a = Math.min(w, h) * 0.25; return [[x + a, y], [x + w - a, y], [x + w, y + h / 2], [x + w - a, y + h], [x + a, y + h], [x, y + h / 2]] }
    case 'triangle': return [[x + w / 2, y], [x + w, y + h], [x, y + h]]
    case 'mathPlus': {
      const t = Math.min(w, h) * 0.2352, cx = x + w / 2, cy = y + h / 2, l = x + w * 0.12, r = x + w * 0.88, tp = y + h * 0.12, b = y + h * 0.88
      return [[cx - t / 2, tp], [cx + t / 2, tp], [cx + t / 2, cy - t / 2], [r, cy - t / 2], [r, cy + t / 2], [cx + t / 2, cy + t / 2],
        [cx + t / 2, b], [cx - t / 2, b], [cx - t / 2, cy + t / 2], [l, cy + t / 2], [l, cy - t / 2], [cx - t / 2, cy - t / 2]]
    }
    case 'wave': {
      const a = h * 0.125, n = 24, top = [], bot = []
      for (let i = 0; i <= n; i++) { const t = i / n, dy = a * Math.sin(2 * Math.PI * t); top.push([x + w * t, y + a - dy]); bot.push([x + w * t, y + h - a - dy]) }
      return [...top, ...bot.reverse()]
    }
    default: return null
  }
}

function drawShape(doc, o) {
  const kind = o.shape, opt = o.options
  if (kind === 'line') return drawLine(doc, opt)
  const p = paint(doc, opt)
  const box = { x: opt.x, y: opt.y, w: opt.w, h: opt.h }
  // Bayangan kartu: salinan bentuk bergeser tipis, sangat transparan.
  if (opt.shadow && p.mode && (kind === 'roundRect' || kind === 'rect')) {
    doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.07 })); doc.setFillColor('#000000')
    const r = Math.min(opt.rectRadius || 0, box.w / 2, box.h / 2), dy = 0.018
    if (kind === 'roundRect' && r > 0) doc.roundedRect(box.x, box.y + dy, box.w, box.h, r, r, 'F'); else doc.rect(box.x, box.y + dy, box.w, box.h, 'F')
    doc.restoreGraphicsState()
    paint(doc, opt)
  }
  if (!p.mode) return
  withAlpha(doc, p.ftr, p.ltr, () => {
    if (kind === 'roundRect') {
      const r = Math.min(opt.rectRadius ?? 0.08, box.w / 2, box.h / 2)
      doc.roundedRect(box.x, box.y, box.w, box.h, r, r, p.mode)
    } else if (kind === 'ellipse') doc.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, p.mode)
    else {
      const pts = shapePoints(kind, box)
      if (pts) poly(doc, pts, p.mode, opt)
      else doc.rect(box.x, box.y, box.w, box.h, p.mode)
    }
  })
  doc.setLineDashPattern([], 0)
}

function drawLine(doc, o) {
  const ln = o.line || {}
  if (!ln.color) return
  let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h
  if (o.flipH) [x1, x2] = [x2, x1]
  if (o.flipV) [y1, y2] = [y2, y1]
  const lw = (ln.width ?? 0.75) * PT
  withAlpha(doc, ln.transparency, ln.transparency, () => {
    doc.setDrawColor(hex(ln.color)); doc.setLineWidth(lw)
    doc.setLineDashPattern(ln.dashType && ln.dashType !== 'solid' ? [0.06, 0.04] : [], 0)
    doc.line(x1, y1, x2, y2)
    doc.setLineDashPattern([], 0)
    if (ln.endArrowType) {
      // Mata panah segitiga di ujung garis.
      const a = Math.atan2(y2 - y1, x2 - x1), L = Math.max(0.09, lw * 4), Wd = L * 0.6
      const bx = x2 - Math.cos(a) * L, by = y2 - Math.sin(a) * L, nx = -Math.sin(a) * Wd, ny = Math.cos(a) * Wd
      doc.setFillColor(hex(ln.color))
      doc.triangle(x2, y2, bx + nx, by + ny, bx - nx, by - ny, 'F')
    }
  })
}

// ---------- Teks ----------

// Run pptxgenjs → paragraf berisi segmen bergaya. breakLine dan '\n' memulai paragraf baru.
function paragraphsOf(o) {
  const box = o.options, runs = Array.isArray(o.text) ? o.text : [{ text: String(o.text ?? ''), options: {} }]
  const paras = [], start = ro => ({ segs: [], bullet: ro.bullet, indentLevel: ro.indentLevel || 0, after: ro.paraSpaceAfter ?? box.paraSpaceAfter ?? 0, align: ro.align || box.align || 'left' })
  let cur = null
  for (const r of runs) {
    const ro = r.options || {}
    const parts = String(r.text ?? '').split('\n')
    parts.forEach((t, i) => {
      if (!cur || i > 0) { cur = start(ro); paras.push(cur) }
      cur.segs.push({ text: pdfText(t), size: ro.fontSize ?? box.fontSize ?? 12, bold: ro.bold ?? box.bold, italic: ro.italic ?? box.italic,
        color: ro.color && !(ro.color === '000000' && box.color) ? ro.color : box.color || '000000', font: fontOf(ro.fontFace || box.fontFace),
        cs: (ro.charSpacing ?? box.charSpacing ?? 0) * PT * 0.7 })
    })
    if (ro.breakLine) cur = null
  }
  return paras
}

const setSeg = (doc, s, scale = 1) => { doc.setFont(s.font, styleOf(s.bold, s.italic)); doc.setFontSize(s.size * scale) }
const segW = (doc, s, t, scale) => { setSeg(doc, s, scale); return doc.getTextWidth(t) + s.cs * t.length }

// Pemenggalan baris dengan segmen bergaya campuran; kata yang lebih panjang dari kotak dipotong per huruf.
function layout(doc, paras, width, scale) {
  const lines = []
  for (const p of paras) {
    const ind = p.bullet ? 12 * PT * (p.bullet.indent ? p.bullet.indent / 12 : 1) : 0
    const lvl = p.indentLevel * 12 * PT
    const avail = Math.max(0.1, width - ind - lvl)
    let line = { items: [], w: 0, size: 0, para: p, first: true }
    const push = () => { lines.push(line); line = { items: [], w: 0, size: 0, para: p, first: false } }
    for (const s of p.segs) {
      const words = s.text.split(/(\s+)/).filter(x => x !== '')
      for (let wd of words) {
        let ww = segW(doc, s, wd, scale)
        if (/^\s+$/.test(wd) && !line.items.length) continue
        if (line.w + ww > avail + 1e-6 && line.items.length) {
          push()
          if (/^\s+$/.test(wd)) continue
        }
        while (ww > avail && wd.length > 1) {
          let k = wd.length
          while (k > 1 && segW(doc, s, wd.slice(0, k), scale) > avail - line.w) k--
          line.items.push({ s, t: wd.slice(0, k) }); line.size = Math.max(line.size, s.size * scale); push()
          wd = wd.slice(k); ww = segW(doc, s, wd, scale)
        }
        line.items.push({ s, t: wd }); line.w += ww; line.size = Math.max(line.size, s.size * scale)
      }
    }
    if (!line.items.length) line.size = (p.segs[0]?.size || 12) * scale
    // Spasi di akhir baris tidak dihitung untuk perataan.
    const last = line.items[line.items.length - 1]
    if (last && /^\s+$/.test(last.t)) { line.w -= segW(doc, last.s, last.t, scale); line.items.pop() }
    lines.push(line)
    line.lastOfPara = true
    lines.forEach(l => { if (l.para === p) { l.ind = ind; l.lvl = lvl } })
  }
  for (const l of lines) {
    const last = l.items[l.items.length - 1]
    if (last && /^\s+$/.test(last.t)) { l.w -= segW(doc, last.s, last.t, scale); l.items.pop() }
  }
  return lines
}

const LH = 1.2
const linesHeight = lines => lines.reduce((h, l) => h + l.size * PT * LH + (l.lastOfPara ? l.para.after * PT : 0), 0) - (lines.length ? lines[lines.length - 1].para.after * PT : 0)

function drawCheck(doc, o, glyph) {
  const { x, y, w, h } = o.options, size = (o.options.fontSize || 11) * PT * 0.75, cx = x + w / 2, cy = y + h / 2
  const run = Array.isArray(o.text) ? o.text[0]?.options : null
  doc.setDrawColor(hex(run?.color || o.options.color)); doc.setLineWidth(size * 0.16); doc.setLineCap('round'); doc.setLineJoin('round')
  if (glyph === '✓') doc.lines([[size * 0.32, size * 0.32], [size * 0.6, -size * 0.7]], cx - size * 0.45, cy, [1, 1], 'S', false)
  else { doc.line(cx - size * 0.35, cy - size * 0.35, cx + size * 0.35, cy + size * 0.35); doc.line(cx + size * 0.35, cy - size * 0.35, cx - size * 0.35, cy + size * 0.35) }
  doc.setLineCap('butt'); doc.setLineJoin('miter')
}

function drawText(doc, o) {
  const opt = o.options
  const raw = Array.isArray(o.text) ? o.text.map(r => r.text).join('') : String(o.text ?? '')
  if (!raw.trim()) return
  if (raw.trim() === '✓' || raw.trim() === '✗') return drawCheck(doc, o, raw.trim())
  // Margin pptxgenjs dalam poin; tanpa margin = sisipan bawaan PowerPoint (0,1" kiri/kanan, 0,05" atas/bawah).
  const m = opt.margin
  const [ml, mr, mt, mb] = m == null ? [0.1, 0.1, 0.05, 0.05] : Array.isArray(m) ? [m[0] * PT, m[1] * PT, m[2] * PT, m[3] * PT] : [m * PT, m * PT, m * PT, m * PT]
  const x = opt.x + ml, y = opt.y + mt, w = Math.max(0.05, opt.w - ml - mr), h = Math.max(0.05, opt.h - mt - mb)
  const paras = paragraphsOf(o)
  let scale = 1, lines = layout(doc, paras, w, scale)
  // fit: 'shrink' — perkecil huruf sampai muat (seperti "Shrink text on overflow").
  if (opt.fit === 'shrink') while (linesHeight(lines) > h + 0.01 && scale > 0.45) { scale -= 0.05; lines = layout(doc, paras, w, scale) }
  const total = linesHeight(lines)
  const va = opt.valign || 'top'
  let cy = va === 'middle' ? y + (h - total) / 2 : va === 'bottom' ? y + h - total : y
  for (const l of lines) {
    const lh = l.size * PT * LH
    const base = cy + lh / 2 + l.size * PT * 0.33
    const avail = w - l.ind - l.lvl
    const align = l.para.align
    let cx = x + l.ind + l.lvl + (align === 'center' ? (avail - l.w) / 2 : align === 'right' ? avail - l.w : 0)
    if (l.para.bullet && l.first) {
      const s = l.items[0]?.s || l.para.segs[0]
      if (s) { setSeg(doc, s, scale); doc.setTextColor(hex(s.color)); doc.text('•', x + l.lvl, base) }
    }
    // Kata bergaya sama digabung menjadi satu panggilan text(): lebar hasil ukur jsPDF memakai kerning,
    // sedangkan penampil PDF tidak, sehingga penempatan per kata membuat jarak antarkata tidak rata.
    const groups = []
    for (const it of l.items) {
      const g = groups[groups.length - 1]
      if (g && g.s === it.s) g.t += it.t; else groups.push({ s: it.s, t: it.t })
    }
    for (const it of groups) {
      setSeg(doc, it.s, scale); doc.setTextColor(hex(it.s.color))
      doc.text(it.t, cx, base, it.s.cs ? { charSpace: it.s.cs } : undefined)
      cx += doc.getTextWidth(it.t) + it.s.cs * it.t.length
    }
    cy += lh + (l.lastOfPara ? l.para.after * PT : 0)
  }
}

// Teks sederhana satu baris/terbungkus untuk grafik.
function label(doc, t, x, y, { size = 8, color = '666666', align = 'left', bold = false, font = 'helvetica', maxW = 0, baseline = 'middle' } = {}) {
  doc.setFont(font, bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(hex(color))
  let s = pdfText(t)
  if (maxW) while (s.length > 2 && doc.getTextWidth(s) > maxW) s = s.slice(0, -2) + '…'
  doc.text(s, x, y, { align, baseline })
}

// ---------- Grafik ----------

function niceScale(min, max, n = 5) {
  if (min === max) { max = min + 1; min = Math.min(0, min - 1) }
  const span = max - min, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10))
  return { lo, hi, ticks, step }
}

function fmtNum(v, code) {
  if (v == null || isNaN(v)) return ''
  const dec = /0\.(0+)/.exec(code || '')?.[1].length ?? (Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 1 : 0)
  return v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function drawChart(doc, o, rel) {
  const opt = rel?.opts || o.options, data = rel?.data || []
  let { x, y, w, h } = o.options
  const type = opt._type, colors = (opt.chartColors || ['4472C4', 'ED7D31', 'A5A5A5']).map(hex)
  const font = fontOf(opt.titleFontFace || opt.legendFontFace)
  const pad = 0.06
  x += pad; w -= 2 * pad; y += pad; h -= 2 * pad
  // Judul.
  if (opt.showTitle && opt.title) {
    const ts = opt.titleFontSize || 14
    label(doc, opt.title, x + w / 2, y + ts * PT * 0.6, { size: ts, color: opt.titleColor || '333333', align: 'center', font, maxW: w })
    y += ts * PT * 1.5; h -= ts * PT * 1.5
  }
  const labels = (data[0]?.labels?.[0] || data[0]?.labels || []).map(l => Array.isArray(l) ? l.join(' ') : String(l))
  // Legenda di bawah.
  if (opt.showLegend) {
    const names = type === 'doughnut' || type === 'pie' ? labels : data.map(d => d.name)
    const ls = opt.legendFontSize || 9
    doc.setFont(font, 'normal'); doc.setFontSize(ls)
    const items = names.map((n, i) => ({ n: pdfText(n), c: colors[i % colors.length], w: 0.14 + doc.getTextWidth(pdfText(n)) + 0.18 }))
    const tot = items.reduce((s, it) => s + it.w, 0)
    let lx = x + Math.max(0, (w - tot) / 2)
    const ly = y + h - ls * PT * 0.7
    for (const it of items) {
      doc.setFillColor(it.c); doc.rect(lx, ly - 0.045, 0.09, 0.09, 'F')
      label(doc, it.n, lx + 0.13, ly, { size: ls, color: opt.legendColor || '555555', font })
      lx += it.w
    }
    h -= ls * PT * 2
  }
  if (type === 'doughnut' || type === 'pie') return doughnut(doc, opt, data[0], { x, y, w, h }, colors, font)
  if (type === 'bar') return bars(doc, opt, data, labels, { x, y, w, h }, colors, font)
  if (type === 'line') return lineChart(doc, opt, data, labels, { x, y, w, h }, colors, font)
}

function doughnut(doc, opt, ser, { x, y, w, h }, colors, font) {
  const vals = (ser?.values || []).map(v => Math.max(0, +v || 0)), sum = vals.reduce((a, b) => a + b, 0)
  if (!sum) return
  const r = Math.min(w, h) / 2 * 0.92, ri = r * (opt.holeSize ?? 50) / 100, cx = x + w / 2, cy = y + h / 2
  let a0 = -Math.PI / 2
  vals.forEach((v, i) => {
    if (!v) return
    const a1 = a0 + v / sum * Math.PI * 2, n = Math.max(4, Math.ceil((a1 - a0) / 0.05)), pts = []
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) }
    for (let k = n; k >= 0; k--) { const a = a0 + (a1 - a0) * k / n; pts.push([cx + Math.cos(a) * ri, cy + Math.sin(a) * ri]) }
    doc.setFillColor(colors[i % colors.length]); doc.setDrawColor('#FFFFFF'); doc.setLineWidth(0.75 * PT)
    poly(doc, pts, 'FD', {})
    if (opt.showPercent && v / sum >= 0.02) {
      const am = (a0 + a1) / 2, rm = (r + ri) / 2
      label(doc, `${Math.round(v / sum * 100)}%`, cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, { size: opt.dataLabelFontSize || 9, color: opt.dataLabelColor || 'FFFFFF', align: 'center', font })
    }
    a0 = a1
  })
}

// Batang horizontal ('bar') atau tegak ('col'); mendukung nilai negatif dan susunan bertumpuk.
function bars(doc, opt, data, labels, { x, y, w, h }, colors, font) {
  const horiz = opt.barDir === 'bar', stacked = /stacked/.test(opt.barGrouping || ''), n = labels.length
  if (!n) return
  let lo = 0, hi = 0
  for (let i = 0; i < n; i++) {
    if (stacked) {
      lo = Math.min(lo, data.reduce((s, d) => s + Math.min(0, +d.values[i] || 0), 0)); hi = Math.max(hi, data.reduce((s, d) => s + Math.max(0, +d.values[i] || 0), 0))
    } else data.forEach(d => { lo = Math.min(lo, +d.values[i] || 0); hi = Math.max(hi, +d.values[i] || 0) })
  }
  const sc = niceScale(lo, hi), code = opt.valAxisLabelFormatCode
  const cs = opt.catAxisLabelFontSize || 8, vs = opt.valAxisLabelFontSize || 8, lblCol = opt.catAxisLabelColor || '666666'
  const grid = opt.valGridLine?.color ? hex(opt.valGridLine.color) : '#DDDDDD'
  const showVal = opt.showValue, dls = opt.dataLabelFontSize || 9
  doc.setFont(font, 'normal'); doc.setFontSize(cs)
  if (horiz) {
    const lw = Math.min(w * 0.4, Math.max(...labels.map(l => doc.getTextWidth(pdfText(l)))) + 0.1)
    const px = x + lw, pw = w - lw - (showVal ? 0.45 : 0.1), py = y, ph = h - vs * PT * 2
    const X = v => px + (v - sc.lo) / (sc.hi - sc.lo) * pw
    doc.setLineWidth(0.5 * PT)
    for (const t of sc.ticks) { doc.setDrawColor(grid); doc.line(X(t), py, X(t), py + ph); label(doc, fmtNum(t, code), X(t), py + ph + vs * PT * 0.9, { size: vs, color: opt.valAxisLabelColor || lblCol, align: 'center', font }) }
    doc.setDrawColor('#999999'); doc.line(X(0), py, X(0), py + ph)
    const band = ph / n, bw = band / (1 + (opt.barGapWidthPct ?? 150) / 100), per = stacked ? 1 : data.length
    for (let i = 0; i < n; i++) {
      // PowerPoint menaruh kategori pertama di bawah.
      const by = py + ph - (i + 1) * band + (band - bw) / 2
      label(doc, labels[i], px - 0.08, by + bw / 2, { size: cs, color: lblCol, align: 'right', font, maxW: lw - 0.1 })
      let pos = 0, neg = 0
      data.forEach((d, k) => {
        const v = +d.values[i] || 0
        if (!v) return
        let a, b
        if (stacked) { if (v > 0) { a = pos; b = pos += v } else { a = neg + v; b = neg; neg += v } } else { a = Math.min(0, v); b = Math.max(0, v) }
        const yy = stacked ? by : by + k * bw / per, hh = bw / per
        doc.setFillColor(colors[(data.length > 1 ? k : 0) % colors.length]); doc.rect(X(a), yy, X(b) - X(a), hh, 'F')
        if (showVal) label(doc, fmtNum(v, opt.dataLabelFormatCode !== '#,##0' ? opt.dataLabelFormatCode : code), v >= 0 ? X(b) + 0.05 : X(a) - 0.05, yy + hh / 2, { size: dls, color: opt.dataLabelColor || '333333', align: v >= 0 ? 'left' : 'right', font })
      })
    }
  } else {
    doc.setFontSize(vs)
    const lw = Math.max(...sc.ticks.map(t => doc.getTextWidth(fmtNum(t, code)))) + 0.1
    const px = x + lw, pw = w - lw, py = y + (showVal ? 0.2 : 0.05), ph = h - (showVal ? 0.2 : 0.05) - cs * PT * 3.2
    const Y = v => py + ph - (v - sc.lo) / (sc.hi - sc.lo) * ph
    doc.setLineWidth(0.5 * PT)
    for (const t of sc.ticks) { doc.setDrawColor(grid); doc.line(px, Y(t), px + pw, Y(t)); label(doc, fmtNum(t, code), px - 0.06, Y(t), { size: vs, color: opt.valAxisLabelColor || lblCol, align: 'right', font }) }
    doc.setDrawColor('#999999'); doc.line(px, Y(0), px + pw, Y(0))
    const band = pw / n, bw = band / (1 + (opt.barGapWidthPct ?? 150) / 100), per = stacked ? 1 : data.length
    for (let i = 0; i < n; i++) {
      const bx = px + i * band + (band - bw) / 2
      // Label kategori dibungkus maksimal dua baris di bawah sumbu.
      doc.setFont(font, 'normal'); doc.setFontSize(cs)
      const ls = doc.splitTextToSize(pdfText(labels[i]), band - 0.04).slice(0, 2)
      ls.forEach((t, j) => label(doc, t, bx + bw / 2, py + ph + cs * PT * (1 + j * 1.2), { size: cs, color: lblCol, align: 'center', font }))
      let pos = 0, neg = 0
      data.forEach((d, k) => {
        const v = +d.values[i] || 0
        if (!v) return
        let a, b
        if (stacked) { if (v > 0) { a = pos; b = pos += v } else { a = neg + v; b = neg; neg += v } } else { a = Math.min(0, v); b = Math.max(0, v) }
        const xx = stacked ? bx : bx + k * bw / per, ww = bw / per
        doc.setFillColor(colors[(data.length > 1 ? k : 0) % colors.length]); doc.rect(xx, Y(b), ww, Y(a) - Y(b), 'F')
        if (showVal) label(doc, fmtNum(v, code), xx + ww / 2, v >= 0 ? Y(b) - 0.08 : Y(a) + 0.08, { size: dls, color: opt.dataLabelColor || '333333', align: 'center', font })
      })
    }
  }
}

function lineChart(doc, opt, data, labels, { x, y, w, h }, colors, font) {
  const all = data.flatMap(d => d.values.map(Number).filter(v => !isNaN(v)))
  if (!all.length) return
  const sc = niceScale(Math.min(...all), Math.max(...all)), code = opt.valAxisLabelFormatCode
  const cs = opt.catAxisLabelFontSize || 8, vs = opt.valAxisLabelFontSize || 8, lblCol = opt.catAxisLabelColor || '666666'
  doc.setFont(font, 'normal'); doc.setFontSize(vs)
  const lw = Math.max(...sc.ticks.map(t => doc.getTextWidth(fmtNum(t, code)))) + 0.1
  const px = x + lw, pw = w - lw - 0.1, py = y + 0.05, ph = h - 0.05 - cs * PT * 2.6
  const n = labels.length, X = i => px + (n > 1 ? i / (n - 1) : 0.5) * pw, Y = v => py + ph - (v - sc.lo) / (sc.hi - sc.lo) * ph
  const grid = opt.valGridLine?.color ? hex(opt.valGridLine.color) : '#DDDDDD'
  doc.setLineWidth(0.5 * PT)
  for (const t of sc.ticks) { doc.setDrawColor(grid); doc.line(px, Y(t), px + pw, Y(t)); label(doc, fmtNum(t, code), px - 0.06, Y(t), { size: vs, color: opt.valAxisLabelColor || lblCol, align: 'right', font }) }
  const f = opt.catAxisLabelFrequency || Math.max(1, Math.round(n / 6))
  for (let i = 0; i < n; i += f) label(doc, labels[i], X(i), py + ph + cs * PT * 1.6, { size: cs, color: lblCol, align: 'center', font })
  data.forEach((d, k) => {
    const pts = d.values.map((v, i) => [X(i), Y(+v)]).filter(p => !isNaN(p[1]))
    if (pts.length < 2) return
    doc.setDrawColor(colors[k % colors.length]); doc.setLineWidth((opt.lineSize || 2) * PT); doc.setLineJoin('round')
    doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'S', false)
    doc.setLineJoin('miter')
  })
}

// ---------- Deck ----------

export async function deckToPdf(pres, jsPDF) {
  const L = pres._presLayout || pres.presLayout
  const W = L?.width ? L.width / 914400 : 10, H = L?.height ? L.height / 914400 : 5.625
  // Orientasi mengikuti ukuran halaman (presentasi 16:9 = landscape, infografis poster A4 = portrait).
  const ori = W >= H ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation: ori, unit: 'in', format: [W, H], compress: true })
  pres.slides.forEach((s, i) => {
    if (i) doc.addPage([W, H], ori)
    const bg = s._background?.color || s.background?.color
    if (bg) { doc.setFillColor(hex(bg)); doc.rect(0, 0, W, H, 'F') }
    let ci = 0
    for (const o of s._slideObjects || []) {
      // Grafik dicocokkan dengan _relsChart menurut urutan (rId tidak selalu sama dengan chartRid).
      if (o._type === 'chart') { drawChart(doc, o, s._relsChart?.[ci++]); continue }
      if (o._type !== 'text') continue
      const hasText = Array.isArray(o.text) ? o.text.some(r => String(r.text ?? '').trim()) : !!String(o.text ?? '').trim()
      if (!o.options?.isTextBox) drawShape(doc, o)
      if (hasText) drawText(doc, o)
    }
  })
  return doc
}

export const pdfFileName = pptxName => String(pptxName).replace(/\.pptx$/i, '') + '.pdf'
