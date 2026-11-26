// Analisa penambahan modal: PMHMETD (rights issue), PMTHMETD (private placement), atau penerbitan saham untuk
// merger, dihitung otomatis dari data kurasi (pandangan-analis: dilusi & kalkulator, aset-verified: transaksi &
// KJPP, story-verified) dan profil Stockbit (saham beredar, harga, porsi pengendali/publik).
// Model: nilai penerbitan = saham baru × harga pelaksanaan, terdiri dari setoran aset (inbreng) dan tunai.
// Harga pelaksanaan bisa digeser untuk simulasi.

const PMT_RE = /PMTHMETD|tanpa (memberikan )?HMETD|private placement|penempatan terbatas/i
const PMH_RE = /PMHMETD|rights? issue|dengan (memberikan )?HMETD|\bHMETD\s+[IVX]+\b/i
const MERGER_RE = /merger|penggabungan usaha|peleburan/i
const DONE_RE = /(hasil|pengumuman hasil) (PMHMETD|PMTHMETD|penambahan modal)|telah (selesai|dicatatkan)/i
const EFFECTIVE_RE = /(sudah|telah) (efektif|tereksekusi|dicatatkan|selesai)/i

// Angka "nominal Rp10" pertama di teks: batas bawah harga pelaksanaan.
const nominalOf = s => { const m = String(s || '').match(/nominal\s*Rp\s?([\d.]+)/i); return m ? +m[1].replace(/\./g, '') || null : null }

// Semua angka nilai di teks bebas → Rupiah (USD dikonversi pada kurs asumsi). Dipakai untuk kisaran nilai aset
// bila sumber berbeda-beda (mis. "USD150 juta (Rp2,51 triliun) ... USD100 juta (Rp1,8 triliun)").
export const KURS_USD = 16500
const UNIT = { triliun: 1e12, t: 1e12, miliar: 1e9, m: 1e9, juta: 1e6, jt: 1e6 }
const numId = s => +String(s).replace(/\./g, '').replace(',', '.')
export function valuesOf(text) {
  const out = []
  const s = String(text || '')
  for (const m of s.matchAll(/(USD|US\$|\$)\s?([\d.,]+)\s*(triliun|miliar|juta|T|M|jt)?\b/gi)) {
    const u = UNIT[String(m[3] || '').toLowerCase()] || 1
    const v = numId(m[2]) * u * KURS_USD
    if (v > 1e9) out.push(v)
  }
  for (const m of s.matchAll(/Rp\s?([\d.,]+)\s*(triliun|miliar|juta|T|M|jt)?\b/gi)) {
    const u = UNIT[String(m[2] || '').toLowerCase()] || 1
    const v = numId(m[1]) * u
    if (v > 1e9) out.push(v)
  }
  return out
}

// Rincian aset injeksi dari aset-verified: kisaran nilai antar-sumber, profil aset, data tambang/keuangan yang
// tersedia, cara bayar, status penilaian, dan data yang belum diungkap.
const TAMBANG = { cadangan: 'Cadangan', sumberDaya: 'Sumber daya', kalori: 'Kalori', produksi: 'Produksi', iup: 'Izin/konsesi' }
const KEU = { pendapatan: 'Pendapatan', ebitda: 'EBITDA', labaBersih: 'Laba bersih', totalAset: 'Total aset', ekuitas: 'Ekuitas', utang: 'Utang' }
export function asetDetail(aset, inj) {
  if (!aset) return null
  const a = aset.aset || {}, t = aset.transaksi || {}, k = aset.kjpp || {}
  // Hanya angka di sekitar nilai transaksi (0,5×–2×) yang dianggap versi lain dari nilai yang sama; angka komponen
  // (biaya, sebagian aset, kurs) diabaikan agar kisaran tidak menyesatkan.
  const vals = [...valuesOf(t.nilai).filter(v => !inj || (v >= inj * 0.5 && v <= inj * 2)), ...(inj ? [inj] : [])]
  const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null
  const facts = [
    ...Object.entries(TAMBANG).filter(([f]) => a.tambang?.[f]).map(([f, l]) => [l, a.tambang[f]]),
    ...Object.entries(KEU).filter(([f]) => a.keuangan?.[f] != null).map(([f, l]) => [l + (a.keuangan.periode ? ` (${a.keuangan.periode})` : ''), a.keuangan[f]]),
  ]
  return {
    nama: a.nama || '', jenis: a.jenis || '', lokasi: a.lokasi || '', porsi: a.porsi || '', deskripsi: a.deskripsi || '',
    lo, hi, spread: lo && hi && hi > lo * 1.05, nilaiText: t.nilai || '', cara: t.caraBayar || '',
    facts, kjpp: { status: k.status || '', nama: k.nama || '', nilai: k.nilaiRp || null, metode: k.metode || '', ket: k.kesimpulan || k.dasar || '' },
    gaps: (aset.tidakDitemukan || []).map(g => String(g).replace(/^[\w.\/]+:\s*/, '')),
  }
}

// Keterbukaan terkait penambahan modal (bukan laporan penggunaan dana IPO).
const RI_REP = /HMETD|rights? issue|penambahan modal|PMTHMETD|PMHMETD|prospektus|pernyataan efektif|pembeli siaga|private placement|penempatan terbatas|penawaran umum terbatas/i
const NOT_RI = /penggunaan dana hasil penawaran umum(?! terbatas)/i
const REP_DONE = /hasil (pelaksanaan )?(penambahan modal|PMTHMETD|PMHMETD|penawaran umum terbatas|private placement)|penambahan jumlah saham setelah|(private placement|rights? issue|PMTHMETD|PMHMETD)[^.]*\btuntas\b|pencatatan saham (baru )?hasil/i
const REP_EXEC = /prospektus|pernyataan efektif|jadwal (pelaksanaan|perdagangan)|perdagangan HMETD/i
const RUPS_OK = /risalah RUPS|hasil RUPS|ringkasan risalah/i
const STANDBY_NO = /(belum ada|tanpa|tidak ada|belum ditunjuk|belum menunjuk)\s+(adanya\s+)?pembeli siaga/gi

// Keterbukaan terakhir, tahap proses, dan sinyal pembeli siaga untuk menilai apakah dana bisa terkumpul.
function fundingFacts(reports, texts) {
  const reps = (reports || []).filter(x => RI_REP.test(x.title || '') && !NOT_RI.test(x.title || ''))
    .map(x => ({ date: String(x.date || '').slice(0, 10), title: String(x.title || '').replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => b.date.localeCompare(a.date))
  // Persetujuan RUPS harus sesudah pengumuman rencana terakhir (risalah RUPS lama tidak dihitung).
  const plan = reps.find(x => !REP_DONE.test(x.title) && !REP_EXEC.test(x.title))?.date || ''
  const rupsOk = (reports || []).some(x => RUPS_OK.test(x.title || '') && plan && String(x.date || '').slice(0, 10) > plan) ||
    /(telah |sudah )?disetujui (dalam |oleh )?RUPS|RUPSLB[^.]{0,60}menyetujui/i.test(texts)
  const stage = reps.some(x => REP_DONE.test(x.title)) ? 'tereksekusi'
    : reps.some(x => REP_EXEC.test(x.title)) || /cum[- ]?date|pernyataan efektif/i.test(texts) ? 'pelaksanaan' : rupsOk ? 'disetujui' : 'rencana'
  // Pembeli siaga: "belum ada/tanpa pembeli siaga" = tidak; penyebutan lain = ada/direncanakan.
  const noSb = STANDBY_NO.test(texts); STANDBY_NO.lastIndex = 0
  const rest = texts.replace(STANDBY_NO, ' ')
  // Kalimat asumsi/syarat ("pengendali atau pembeli siaga menyerap", "pantau komitmen ...") bukan komitmen.
  const sbSentence = (rest.match(/[^.]*(pembeli siaga|standby buyer)[^.]*\./gi) || [])
    .find(x => !/asumsi|diasumsikan|\batau pembeli siaga|pantau|\bbila\b|\bjika\b|kemungkinan|seandainya/i.test(x))
  return { last: reps[0] || null, nReps: reps.length, stage, rupsOk, standby: sbSentence ? 'ya' : noSb ? 'tidak' : '', standbyText: (sbSentence || '').trim() }
}

// Kasus penambahan modal untuk satu emiten, atau null bila tidak ada rencana yang relevan.
// A: hasil buildAnalysis; ctx: { aset, sv, item, reports }.
export function riCase(A, { aset = null, sv = null, item = null, reports = [], pv = null, doc = null } = {}) {
  if (!A) return null
  // doc = fakta dari dokumen asli (ri-dokumen.json); bila ada, angkanya didahulukan atas asumsi narasi.
  const dk = doc && typeof doc === 'object' && !Array.isArray(doc) ? doc : null
  // Dokumen menyatakan belum ada penambahan modal: asumsi rights issue di narasi diabaikan.
  if (dk && (!dk.jenis || /batal/i.test(dk.status || ''))) return null
  const pa = A.pa || {}, dl = pa.dilusi || {}, k = pa.kalkulator || {}
  const sigEv = (item?.signals?.rights?.ev || []).map(e => e.text)
  // Hanya keterbukaan setahun terakhir; narasi yang menyangkal ("tanpa rights issue") diabaikan.
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
  const repT = (reports || []).filter(r => !r.date || String(r.date) >= yearAgo).slice(0, 40).map(r => r.title)
  const strip = s => String(s || '').replace(/(tanpa|bukan|belum ada|tidak ada|tidak melalui)\s+(rights? issue|PMHMETD|PMTHMETD|HMETD|private placement)/gi, ' ')
  const cara = `${aset?.transaksi?.caraBayar || ''} ${sv?.injectType || ''}`
  const spec = strip([cara, k.dasar, dl.asumsi, dl.catatan, sv?.note].filter(Boolean).join(' · '))
  const evidence = [spec, ...sigEv, ...repT].join(' · ')
  const inbreng = /inbreng|tukar saham|integrasi aset|penyetoran (saham )?(dalam bentuk )?(lain )?selain uang|konversi utang/i.test(`${cara} ${k.dasar || ''}`)
  const merger = MERGER_RE.test(cara)
  const isH = PMH_RE.test(evidence)
  const isT = PMT_RE.test(evidence) || (inbreng && !PMH_RE.test(spec))
  const dHp = dk?.hargaPelaksanaan || {}, dSet = dk?.setoran || {}, dAs = dk?.aset || {}
  const exDoc = dHp.nilai > 0 && /resmi|indikatif/i.test(dHp.status || '') ? dHp.nilai : null
  const inj = dAs.nilaiTransaksiRp || aset?.transaksi?.nilaiRp || A.injRp || null
  // Setoran dari dokumen: aset (inbreng/konversi) dan tunai dalam penerbitan ini. 0 = dinyatakan tidak ada;
  // null = belum diungkap (memakai asumsi narasi). Bila harga resmi dan saham maksimum diketahui, porsi tunai
  // yang tidak disebut = nilai penerbitan maksimum − aset.
  const numOr = v => typeof v === 'number' && isFinite(v) ? v : null
  const vDoc = numOr(dSet.asetRp), cDoc = numOr(dSet.tunaiRp)
  const fromDoc = vDoc != null || cDoc != null
  const Nmax = dk?.sahamBaruMaks > 0 ? dk.sahamBaruMaks : null
  const total0 = exDoc && Nmax ? exDoc * Nmax : null
  const V = vDoc ?? (k.nilaiDibayarSaham || 0)
  const cash = cDoc ?? (total0 != null && vDoc != null ? Math.max(0, total0 - V) : k.kasSegar || 0)
  // Jumlah saham baru = setoran ÷ harga (dibatasi maksimum dokumen); tanpa setoran: maksimum dokumen/asumsi narasi.
  const N = dk && (V + cash) > 0 ? null : Nmax || (dl.berlaku ? dl.sahamBaru || null : null)
  // Perlu bukti konkret: jumlah saham baru, kas, nilai setoran, atau jenis penambahan modal + nilai aset.
  if (!dk && !N && !cash && !V && !((isT || isH) && inj)) return null
  const dKind = /^(PMHMETD|PMTHMETD|campuran|merger)$/.test(dk?.jenis || '') ? dk.jenis : dk?.jenis === 'inbreng' ? 'PMHMETD' : null
  const kind = dKind || (merger ? 'merger' : isH && isT ? 'campuran' : isT ? 'PMTHMETD' : 'PMHMETD')
  const S0 = dk?.sahamBeredar || dl.sahamSekarang || A.shares || null
  const price = A.price || null
  const exAssumed = exDoc ? false : /asumsi/i.test(`${k.dasar || ''} ${dl.asumsi || ''}`) || !!dk
  const nominal = dk?.nominal || nominalOf(spec) || nominalOf(repT.join(' '))
  const dStat = String(dk?.status || '')
  const done = /tereksekusi/i.test(dStat) || (!dk && (!!k.sudahTereksekusi || EFFECTIVE_RE.test(`${dl.asumsi || ''} ${k.dasar || ''}`) || (DONE_RE.test(repT.slice(0, 15).join(' ')) && !N)))
  // Dokumen belum menetapkan harga: asumsi narasi tetap dipakai sebagai titik awal simulasi (bertanda asumsi).
  const ex = exDoc || k.hargaPelaksanaan || null
  // Harga pelaksanaan: resmi/indikatif dokumen → asumsi narasi → tersirat (nilai aset ÷ saham baru) → harga pasar.
  const implied = !ex && inj && N ? inj / N : null
  return {
    kind, label: { PMTHMETD: 'PMTHMETD (private placement)', campuran: 'PMHMETD & PMTHMETD', merger: 'penerbitan saham merger', PMHMETD: 'PMHMETD (rights issue)' }[kind],
    status: done ? 'tereksekusi' : item?.ms?.rights || /RUPS|efektif|pendaftaran/i.test(dStat) ? 'berjalan' : 'rencana',
    jadwal: sv?.target || '', S0, N, Nmax, price, ex, exAssumed, implied, nominal,
    V, cash, inj, injCara: aset?.transaksi?.caraBayar || '', injTarget: dAs.nama || sv?.injectTarget || aset?.aset?.nama || '', inbreng: inbreng || vDoc > 0,
    // Aset dibayar saham pada tahap terpisah (bukan bagian dari saham baru N), mis. NINE tahap II.
    laterInj: !fromDoc && inbreng && inj && !V && (N || cash) && !implied && kind !== 'merger' ? inj : null,
    kjpp: dAs.kjpp?.nilaiRp || aset?.kjpp?.nilaiRp || null, kjppStatus: dAs.kjpp?.status || aset?.kjpp?.status || '',
    doc: dk,
    ctrlPct: A.ctrlPct ?? null, float: A.flt ?? dl.porsiPublikSekarang ?? null, mcap: A.mcap || null, equity: A.equity ?? null,
    notes: [k.dasar, dl.asumsi].filter(Boolean),
    detail: asetDetail(aset, inj),
    // Sumber keterbukaan di data kurasi (story-verified) ikut dihitung bila tidak ada di daftar laporan.
    funding: fundingFacts([...(reports || []), ...(sv?.sourceTitle ? [{ date: sv.sourceDate, title: sv.sourceTitle }] : [])], [spec, pv && [pv.siapa, pv.grup, pv.rencana, pv.catatan].join(' '), pa.tesis, pa.ringkas, ...sigEv].filter(Boolean).join(' ')),
    // Perubahan bersih porsi pengendali 365 hari (keterbukaan ≥5%); negatif = pengendali menjual.
    ctrlNet: typeof A.isCtrlH === 'function' ? (A.holders || []).filter(A.isCtrlH).reduce((s, h) => s + (h.change || 0), 0) : null,
    avgVal: A.avgVal ?? null,
    // Laba bersih emiten 12 bulan terakhir (sebelum aset masuk).
    labaEmiten: A.p?.metrics?.netIncomeTtm ?? null,
  }
}

// Harga saham yang dibutuhkan agar dana tunai rights issue tercapai. Publik hanya rasional menebus bila harga pasar
// di atas harga pelaksanaan; rights issue lazim diberi diskon 10–30% terhadap harga pasar.
// - pMin: harga pelaksanaan terendah agar seluruh setoran (aset + tunai) muat dalam saham maksimum dokumen
//   (tanpa batas saham: nilai nominal).
// - need: harga pasar minimum pada diskon 10/20/30% untuk harga pelaksanaan simulasi P (dan untuk pMin).
// - gap: kenaikan harga yang masih dibutuhkan dari harga kini ke patokan diskon 20%.
export const RI_DISKON = [0.1, 0.2, 0.3]
export function riPriceNeeded(c, P) {
  if (!c || !(P > 0) || noRights(c)) return null
  // Porsi tunai: dari data; bila jumlah saham tetap (harga resmi), sisa nilai penerbitan setelah inbreng.
  const cash = c.cash || (c.N ? Math.max(0, c.N * P - (c.V || 0)) : 0), total = (c.V || 0) + cash
  if (!(cash > 0)) return null
  const nom = c.nominal || 1
  const pMin = Math.max(nom, c.Nmax ? total / c.Nmax : nom)
  const at = p => RI_DISKON.map(d => ({ d, price: p / (1 - d) }))
  const ref = P / (1 - 0.2)
  const now = c.price || null
  const gap = now ? ref / now - 1 : null
  // Harga pelaksanaan simulasi di bawah pMin: saham maksimum tidak cukup untuk seluruh setoran.
  const short = c.Nmax && P < pMin ? { maxDana: c.Nmax * P, kurang: total - c.Nmax * P } : null
  return {
    cash, pMin, minNeed: pMin / (1 - 0.2), need: at(P), ref, now, gap, short,
    status: now == null ? 'tidak diketahui' : now >= ref ? 'cukup' : now > P ? 'tipis' : 'kurang',
  }
}

// Simulasi skenario: untuk setoran tetap (aset + tunai), rasio saham baru per saham lama menentukan harga RI;
// harga RI menentukan harga saham yang dibutuhkan (diskon 20%) dan harga teoretis setelah RI (TERP).
// Dana = saham baru × harga RI, sehingga harga RI = setoran ÷ (rasio × saham beredar).
export const RI_RASIO = [0.25, 0.5, 1, 2, 3, 5, 10, 20]
export function riScenarios(c, P = null) {
  if (!c || !(c.S0 > 0)) return null
  // Setoran tetap: jumlah saham × harga resmi bila keduanya ada; selain itu aset + tunai (atau nilai aset).
  const total = c.N && c.ex ? c.N * c.ex : (c.V || 0) + (c.cash || 0) || c.inj || 0
  if (!(total > 0)) return null
  const S0 = c.S0, now = c.price || null, nom = c.nominal || null
  const row = (N, tag) => {
    const p = total / N
    const need = p / (1 - 0.2)
    return {
      tag, ratio: N / S0, N, P: p, dana: total, need, naik: now ? need / now - 1 : null,
      terp: now ? (S0 * now + total) / (S0 + N) : null, dilusi: N / (S0 + N),
      bawahNominal: nom != null && p < nom, lewatMaks: !!(c.Nmax && N > c.Nmax),
    }
  }
  const rows = RI_RASIO.map(r => row(r * S0, ''))
  // Baris acuan: harga RI = harga kini, dan harga RI simulasi yang sedang dipilih.
  if (now) rows.push(row(total / now, 'harga RI = harga kini'))
  if (P > 0) rows.push(row(total / P, 'simulasi pilihan'))
  if (c.Nmax) rows.push(row(c.Nmax, 'saham maksimum dokumen'))
  rows.sort((a, b) => a.N - b.N)
  return { total, tunai: Math.max(0, total - (c.V || 0)), aset: Math.min(c.V || 0, total), S0, now, nom, rows }
}

// Dasar perhitungan harga pelaksanaan: harga = target dana ÷ (rasio HMETD × saham beredar).
// Skenario A = seluruh nilai penerbitan (aset + tunai); B = porsi tunai saja. B hanya konsisten bila aset
// dibayar dengan saham terpisah; bila inbreng juga melalui HMETD yang sama, semua saham baru terbit pada satu harga (A).
export function riExercise(c, ratio = 1) {
  if (!c || !(c.S0 > 0) || !(ratio > 0)) return null
  const total = c.N && c.ex ? c.N * c.ex : (c.V || 0) + (c.cash || 0) || c.inj || 0
  if (!(total > 0)) return null
  const aset = Math.min(c.V || 0, total), tunai = Math.max(0, total - aset)
  const N = ratio * c.S0
  const sc = target => {
    const P = target / N, up = Math.ceil(P)
    return { target, P, up, check: up * N, belowNominal: c.nominal ? up < c.nominal : false, need: up / 0.8, naik: c.price ? up / 0.8 / c.price - 1 : null }
  }
  const sameIssue = aset > 0 && c.kind !== 'PMTHMETD' && c.kind !== 'merger'
  return {
    ratio, S0: c.S0, N, total, aset, tunai, nominal: c.nominal || null, price: c.price || null,
    kurs: c.doc?.kurs?.nilai ? c.doc.kurs : null, A: sc(total), B: tunai > 0 && aset > 0 ? sc(tunai) : null,
    // Skenario yang konsisten dengan struktur dokumen.
    consistent: aset > 0 ? (sameIssue ? 'A' : 'B') : 'A',
  }
}

// Faktor penyetahunan dari teks periode laporan: "(6 bulan)" → ×2, "1H"/"semester" → ×2, "Q1"/"3 bulan" → ×4.
export function annualFactor(periode) {
  const s = String(periode || '')
  const m = s.match(/(\d{1,2})\s*bulan/i)
  if (m && +m[1] > 0 && +m[1] < 12) return 12 / +m[1]
  if (/\b(1H|H1|semester)\b/i.test(s)) return 2
  if (/\bQ[1-4]\b|kuartal|triwulan/i.test(s)) return 4
  return 1
}

// Perhitungan laba aset injeksi dari laporan keuangan di dokumen: laba & pendapatan disetahunkan, margin, ROE,
// laba porsi yang diambil, PER implisit (nilai transaksi ÷ laba porsi), dan laba per saham emiten setelah
// penerbitan (post = { S1: saham setelah penerbitan, P: harga RI }).
export function asetLaba(doc, post = {}) {
  const a = doc?.aset || {}, ke = a.keuangan || {}
  const laba = typeof ke.labaBersihRp === 'number' ? ke.labaBersihRp : null
  const pend = typeof ke.pendapatanRp === 'number' ? ke.pendapatanRp : null
  if (laba == null && pend == null) return null
  const f = annualFactor(ke.periode)
  const porsi = a.porsiPersen > 0 ? a.porsiPersen / 100 : null
  // Laba/pendapatan 12 bulan terakhir dari dokumen (bila ada) didahulukan atas penyetahunan periode parsial.
  const ltmL = typeof ke.labaSetahunRp === 'number' ? ke.labaSetahunRp : null, ltmP = typeof ke.pendapatanSetahunRp === 'number' ? ke.pendapatanSetahunRp : null
  const labaThn = ltmL ?? (laba != null ? laba * f : null), pendThn = ltmP ?? (pend != null ? pend * f : null)
  const labaPorsi = labaThn != null ? labaThn * (porsi ?? 1) : null
  const nilai = a.nilaiTransaksiRp || null
  return {
    periode: ke.periode || '', f: ltmL != null ? 1 : f, ltm: ltmL != null ? ke.setahunKet || '12 bulan terakhir' : '', laba, pend, labaThn, pendThn, porsi,
    margin: laba != null && pend > 0 ? laba / pend : null,
    roe: labaThn != null && ke.ekuitasRp > 0 ? labaThn / ke.ekuitasRp : null,
    labaPorsi, nilai,
    per: nilai && labaPorsi > 0 ? nilai / labaPorsi : null,
    ps: nilai && pendThn > 0 ? nilai / (pendThn * (porsi ?? 1)) : null,
    eps: labaPorsi != null && post.S1 > 0 ? labaPorsi / post.S1 : null,
    epsYield: labaPorsi != null && post.S1 > 0 && post.P > 0 ? labaPorsi / post.S1 / post.P : null,
    rugi: laba != null && laba < 0, catatan: ke.catatan || '',
  }
}

// Laba emiten sebelum vs setelah aset masuk: laba setahun, jumlah saham, laba per saham (EPS), dan PER.
// Sebelum = laba emiten TTM ÷ saham beredar pada harga kini; setelah = (laba emiten + laba porsi aset) ÷ saham
// setelah penerbitan pada harga teoretis (TERP).
export function labaSebelumSesudah(c, r, lb) {
  if (!c || !r || c.labaEmiten == null || !lb || lb.labaPorsi == null) return null
  const before = { laba: c.labaEmiten, saham: c.S0, eps: c.labaEmiten / c.S0, harga: c.price || null }
  const lAfter = c.labaEmiten + lb.labaPorsi
  const after = { laba: lAfter, saham: r.S1, eps: lAfter / r.S1, harga: r.terp || null }
  before.per = before.harga && before.eps > 0 ? before.harga / before.eps : null
  after.per = after.harga && after.eps > 0 ? after.harga / after.eps : null
  const dEps = before.eps !== 0 ? after.eps / Math.abs(before.eps) - (before.eps > 0 ? 1 : -1) : null
  return { before, after, dLaba: lAfter - c.labaEmiten, dEps, akresi: after.eps > before.eps }
}

// Kesimpulan layak investasi atau tidak: skor dari kewajaran aset, KJPP, afiliasi, laba aset, perubahan EPS,
// harga kini vs harga teoretis, pembeli siaga, dan status transaksi. Mengembalikan { key, label, tone, score, reasons }.
export function riLayak(c, r, lb, ls) {
  if (!c) return null
  const why = [], d = c.doc || {}, kw = d.kewajaran?.putusan || ''
  let sc = 0
  const plus = (n, t) => { sc += n; why.push({ s: Math.sign(n), t }) }
  const adaAset = (c.V || 0) > 0 || (c.inj || 0) > 0
  if (/^wajar/i.test(kw)) plus(2, 'Nilai aset dinilai wajar berdasarkan dokumen.')
  else if (/cenderung mahal/i.test(kw)) plus(-1, 'Nilai aset cenderung mahal dibanding laba/ekuitasnya.')
  else if (/tidak wajar/i.test(kw)) plus(-3, 'Nilai aset tidak wajar: harga jauh di atas dasar nilai yang terukur.')
  else if (/belum dapat dinilai/i.test(kw)) plus(-1, 'Kewajaran aset belum dapat dinilai: data inti (laba, KJPP) belum diungkap.')
  if (adaAset) {
    const kj = d.aset?.kjpp?.status || c.kjppStatus || ''
    if (/terbit/i.test(kj)) plus(1, 'Penilai independen (KJPP) sudah menerbitkan laporan.')
    else plus(-1, 'Belum ada laporan penilai independen (KJPP).')
    if (d.aset?.afiliasi === true) plus(-1, 'Aset dibeli dari pihak terafiliasi pengendali.')
  }
  const hk = (d.hukum?.daftar || []).filter(h => /berjalan|putusan/i.test(h.status || ''))
  if (hk.length) plus(-1, `Ada ${hk.length} catatan hukum/regulasi yang masih berjalan atau sudah diputus: ${hk.slice(0, 2).map(h => h.isu).join('; ')}`)
  else if (d.hukum?.tidakDitemukan) plus(0, 'Tidak ditemukan riwayat masalah hukum di dokumen keterbukaan.')
  if (lb) {
    if (lb.rugi) plus(-2, 'Aset yang masuk masih merugi.')
    else if (lb.per != null) plus(lb.per <= 15 ? 1 : lb.per > 40 ? -1 : 0, `PER implisit transaksi ${lb.per.toLocaleString('id-ID', { maximumFractionDigits: 1 })}×${lb.per <= 15 ? ' (wajar)' : lb.per > 40 ? ' (mahal)' : ''}.`)
  } else if (adaAset) plus(-1, 'Laba aset belum diungkap.')
  if (ls) plus(ls.akresi ? 1 : -1, ls.akresi ? 'Laba per saham emiten naik setelah aset masuk (akresi).' : 'Laba per saham emiten turun setelah penerbitan (dilutif).')
  if (r?.terp && c.price) {
    const prem = c.price / r.terp - 1
    const asm = c.exAssumed && r.N && r.total ? ` (memakai harga RI asumsi Rp${Math.round(r.total / r.N).toLocaleString('id-ID')}; harga resmi belum ditetapkan)` : ''
    if (prem > 0.3) plus(-1, `Harga kini ${Math.round(prem * 100)}% di atas harga teoretis setelah RI${asm}: risiko turun setelah cum date.`)
    else if (prem < -0.1) plus(1, 'Harga kini di bawah harga teoretis setelah RI.')
  }
  // Pembeli siaga hanya menentukan bila porsi tunai berarti (> 30% penerbitan); sisanya disetor pemilik aset.
  const tunaiShare = r?.total > 0 ? (r.tunai || 0) / r.total : 1
  if ((c.cash || 0) > 0 && tunaiShare > 0.3 && c.kind !== 'PMTHMETD' && c.kind !== 'merger' && c.status !== 'tereksekusi') {
    const sb = d.pembeliSiaga?.ada
    if (sb === true) plus(1, 'Ada pembeli siaga untuk dana tunai.')
    else plus(-1, 'Belum ada pembeli siaga: dana tunai tidak terjamin.')
  }
  if (c.status === 'tereksekusi') plus(1, 'Transaksi sudah tereksekusi; risiko batal tidak ada.')
  const key = sc >= 2 ? 'layak' : sc >= -1 ? 'spekulatif' : 'tidak'
  return {
    key, score: sc, reasons: why,
    // Menilai skenario membeli dan menahan melewati rights issue (atau ikut menebus), bukan trading jangka pendek.
    label: { layak: 'OVERWEIGHT: layak menebus HMETD', spekulatif: 'NEUTRAL: menebus dengan porsi terbatas', tidak: 'UNDERWEIGHT: tidak disarankan menebus atau menahan melewati cum date' }[key],
    tone: { layak: 'good', spekulatif: 'warn', tidak: 'strong' }[key],
  }
}

// Peluang trading jangka pendek memanfaatkan aksi korporasi (berbeda dari menahan melewati rights issue):
// ada katalis terjadwal di depan, likuiditas cukup, dan transaksi belum tereksekusi. Mengembalikan
// { key: ada|tipis|tidak, label, tone, reasons, aturan } beserta aturan main keluar sebelum cum date.
const BULAN_TR = { jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6, agu: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11 }
function tglDari(s) {
  const m = String(s || '').match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(20\d\d)/)
  if (!m || BULAN_TR[m[2].toLowerCase()] == null) return null
  return new Date(+m[3], BULAN_TR[m[2].toLowerCase()], +m[1])
}
export function riTrading(c, r, now = new Date()) {
  if (!c) return null
  const why = [], add = (s, t) => why.push({ s, t })
  if (c.status === 'tereksekusi') {
    return { key: 'tidak', label: 'Tidak ada lagi katalis aksi korporasi', tone: 'warn', reasons: [{ s: 0, t: 'Penambahan modal sudah tereksekusi; sentimen aksi korporasi sudah lewat.' }], aturan: [] }
  }
  // Katalis terjadwal di depan (dari jadwal dokumen yang belum selesai).
  const jd = (c.doc?.jadwal || []).filter(j => j.status !== 'selesai')
  const dated = jd.map(j => ({ ...j, t: tglDari(j.waktu) })).filter(j => j.t && j.t >= now).sort((a, b) => a.t - b.t)
  const next = dated[0] || jd[0] || null
  const kapan = w => !w ? '' : /\d/.test(w) && !/^(belum|paling lambat|selambatnya)/i.test(w) ? ` pada ${w}` : ` (waktu: ${String(w).replace(/^./, x => x.toLowerCase())})`
  if (next) add(1, `Katalis yang dapat menggerakkan harga: ${next.tahap}${kapan(next.waktu)}.`)
  else add(-1, 'Belum ada katalis terjadwal yang jelas.')
  const liq = c.avgVal
  if (liq != null) {
    if (liq >= 1e9) add(1, `Likuiditas ramai, mudah masuk dan keluar: nilai transaksi rata-rata ±Rp${(liq / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M/hari.`)
    else if (liq < 2e8) add(-1, 'Likuiditas tipis: sulit keluar saat berbalik.')
  }
  if (r?.terp && c.price && c.price > r.terp * 1.3) add(-1, 'Semua posisi harus ditutup sebelum cum date: setelah itu harga cenderung turun ke harga teoretis.')
  if (c.exAssumed) add(0, 'Harga RI resmi belum ditetapkan; pengumuman harga yang jauh di bawah pasar biasanya menekan harga.')
  const pos = why.filter(x => x.s > 0).length, neg = why.filter(x => x.s < 0).length
  const key = next && pos >= neg ? 'ada' : next ? 'tipis' : 'tidak'
  return {
    key, reasons: why,
    label: { ada: 'TRADING BUY: momentum aksi korporasi jangka pendek', tipis: 'TRADING BUY terbatas: momentum lemah', tidak: 'Belum ada setup trading' }[key],
    tone: { ada: 'warn', tipis: 'warn', tidak: 'strong' }[key],
    aturan: key === 'tidak' ? [] : [
      'Hanya porsi kecil (misalnya maks. 1–2% modal) dan uang dingin.',
      next ? `Fokus pada katalis terdekat, ${next.tahap}${kapan(next.waktu)}; ambil untung bertahap saat harga naik menjelang katalis.` : 'Ambil untung bertahap saat harga naik.',
      'Keluar seluruhnya sebelum cum date, atau segera bila harga RI resmi diumumkan jauh di bawah harga pasar.',
      'Pasang batas rugi tegas (misalnya 8–10% dari harga masuk).',
    ],
  }
}

// Rekomendasi bergaya manajer investasi dari dua penilaian: kelayakan menahan/ikut rights issue (riLayak) dan
// potensi trading aksi korporasi (riTrading). rating = BUY | TRADING BUY | SPECULATIVE BUY | AVOID;
// partisipasi = sikap atas rights issue (OVERWEIGHT | NEUTRAL | UNDERWEIGHT).
export function riRating(ly, tr, c = null, r = null) {
  if (!ly) return null
  const part = { layak: 'OVERWEIGHT', spekulatif: 'NEUTRAL', tidak: 'UNDERWEIGHT' }[ly.key]
  const done = tr?.key === 'tidak' && /tereksekusi/.test(tr?.reasons?.[0]?.t || '') || null
  let partTxt = {
    OVERWEIGHT: 'Partisipasi rights issue: OVERWEIGHT (layak menebus HMETD).',
    NEUTRAL: 'Partisipasi rights issue: NEUTRAL (menebus dengan porsi terbatas).',
    UNDERWEIGHT: 'Partisipasi rights issue: UNDERWEIGHT (tidak disarankan menebus atau menahan melewati cum date).',
  }[part]
  // Transaksi yang sudah terlaksana atau tanpa HMETD (private placement/merger): publik tidak lagi dapat menebus.
  const pp = noRights(c), batas = pp ? 'pencatatan saham baru' : 'cum date'
  if (done) partTxt = `Penambahan modal sudah terlaksana; sikap ${part} kini berarti ${part === 'OVERWEIGHT' ? 'layak menambah posisi' : part === 'NEUTRAL' ? 'cukup menahan posisi yang ada' : 'mengurangi posisi'}.`
  else if (pp) partTxt = `Tanpa HMETD (publik tidak dapat ikut menebus): ${part}, ${part === 'OVERWEIGHT' ? 'layak menahan melewati pencatatan saham baru' : part === 'NEUTRAL' ? 'tahan dengan porsi terbatas' : 'tidak disarankan menahan melewati pencatatan saham baru'}.`
  const kat = tr?.reasons?.find(x => /^Katalis/.test(x.t))?.t.replace(/^Katalis yang dapat menggerakkan harga:\s*/, '').replace(/\.$/, '')
  let rating, tone, sub
  if (ly.key === 'layak') { rating = 'BUY'; tone = 'good'; sub = done ? 'Penambahan modal sudah terlaksana dan fundamental transaksinya mendukung; layak dikoleksi untuk jangka menengah.' : 'Fundamental transaksi mendukung; partisipasi rights issue layak dipertimbangkan.' }
  else if (tr?.key === 'ada') { rating = 'TRADING BUY (Spekulatif)'; tone = 'warn'; sub = `Horizon jangka pendek${kat ? ' menjelang ' + kat : ''}; realisasikan keuntungan sebelum ${batas}.` }
  else if (ly.key === 'spekulatif') { rating = 'SPECULATIVE BUY'; tone = 'warn'; sub = 'Potensi ada, namun eksposur dibatasi sampai katalis terkonfirmasi.' }
  else { rating = 'AVOID'; tone = 'strong'; sub = 'Belum ada katalis yang menopang harga dalam waktu dekat.' }
  const lv = riLevels(c, r, rating)
  // Risiko terbesar (turun ke harga teoretis) ikut tertulis di kalimat utama rekomendasi.
  const drop = lv.angka.find(x => x.bad)
  if (drop && rating !== 'BUY') sub += ` ${drop.k.replace('Potensi turun', `Potensi turun ${drop.v}`)}${lv.asumsi ? ' (memakai harga pelaksanaan asumsi)' : ''}.`
  return { rating, tone, sub, partisipasi: part, partTxt, text: `${rating}: ${sub}`, ...lv }
}

// Fraksi harga BEI (tick) untuk membulatkan batas rugi ke harga yang bisa diorder.
const tick = p => p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25
const rpN = v => 'Rp' + Math.round(v).toLocaleString('id-ID')

// Angka pendukung rekomendasi: harga kini vs harga teoretis setelah rights issue, potensi turun bila ditahan
// melewati cum date, batas rugi dalam rupiah, asumsi yang dipakai, dan risiko kunci dari dokumen.
export function riLevels(c, r, rating) {
  if (!c) return { angka: [], risiko: [], asumsi: null }
  const doc = c.doc || {}, angka = [], risiko = []
  const p = c.price, terp = r?.terp
  const done = c.status === 'tereksekusi', pp = noRights(c)
  // Private placement/merger tidak punya cum date; acuannya pencatatan saham baru.
  const batas = pp ? 'pencatatan saham baru' : 'cum date'
  if (p) angka.push({ k: 'Harga sekarang', v: rpN(p) })
  if (p && terp && !done) {
    const chg = terp / p - 1
    angka.push({ k: pp ? 'Harga teoretis setelah saham baru tercatat' : 'Harga teoretis setelah rights issue', v: rpN(terp) })
    if (chg < -0.05) angka.push({ k: `Potensi turun bila ditahan melewati ${batas}`, v: `±${Math.round(-chg * 100)}%`, bad: true })
    else if (chg > 0.05) risiko.push(`Harga pelaksanaan di atas harga pasar (harga teoretis ${rpN(terp)} > harga sekarang): publik cenderung tidak menebus, sehingga porsi publik bisa menyusut.`)
  }
  if (p && /TRADING|SPECULATIVE/.test(rating || '')) {
    const sl = Math.floor(p * 0.9 / tick(p)) * tick(p)
    angka.push({ k: 'Batas rugi', v: `${rpN(sl)} (−10%)` })
  }
  const cum = (doc.jadwal || []).find(j => /cum/i.test(j.tahap || '') && tglDari(j.waktu))
  if (!done && rating !== 'BUY') angka.push({ k: 'Keluar paling lambat', v: cum ? `sebelum cum date ${cum.waktu}` : `sebelum ${batas} (tanggal belum ditetapkan)` })
  // Harga pelaksanaan asumsi harus terbaca sebagai asumsi, bukan fakta.
  const asumsi = !done && c.exAssumed && r?.N && r?.total
    ? `Harga rights issue resmi belum ditetapkan; perhitungan memakai asumsi ${rpN(r.total / r.N)} per saham, sehingga harga teoretis dan potensi turun dapat berubah saat harga resmi diumumkan.`
    : null
  if (!done && !pp && doc.pembeliSiaga && doc.pembeliSiaga.ada === false) risiko.push('Belum ada pembeli siaga: dana tunai tidak terjamin.')
  if (/konversi|dikonversi/i.test(`${doc.komitmenPengendali || ''} ${doc.setoran?.keterangan || ''}`)) risiko.push('Utang ke pengendali dapat dikonversi menjadi saham melalui rights issue: pengendali bisa menambah porsi tanpa setoran tunai baru.')
  if (!done && !pp && r?.pubAfter != null && r.pubAfter < 0.075) risiko.push(`Bila publik tidak menebus, porsi publik turun ke ${r.pubAfter < 0.001 ? 'kurang dari 0,1' : (r.pubAfter * 100).toFixed(1).replace('.', ',')}% (di bawah batas free float 7,5%).`)
  if (/waran/i.test(String(doc.rasio || ''))) risiko.push('Rights issue disertai waran: menambah dilusi bila waran dilaksanakan.')
  if (/kedaluwarsa/i.test(String(doc.status || ''))) risiko.push('Persetujuan RUPS atas rights issue sudah kedaluwarsa; jadwal bergantung RUPSLB ulang.')
  return { angka, risiko: risiko.slice(0, 4), asumsi }
}

// Warna putusan kewajaran aset injeksi dari dokumen (wajar/cenderung mahal/tidak wajar/belum dapat dinilai).
export const kewajaranTone = p => /^wajar/i.test(p || '') ? 'good' : /tidak wajar/i.test(p || '') ? 'bad' : 'warn'

// Penilaian: apakah dana penambahan modal kemungkinan terkumpul, berdasarkan keterbukaan terakhir dan struktur
// transaksi. Mengembalikan { key, label, tone, score, reasons: [{ s: +1|-1|0, t }], last }.
export function riFunding(c, r) {
  if (!c || !r) return null
  const f = c.funding || {}
  const why = []
  const add = (s, t) => why.push({ s, t })
  const done = c.status === 'tereksekusi' || f.stage === 'tereksekusi'
  if (done) {
    add(1, f.last && REP_DONE.test(f.last.title) ? `Keterbukaan hasil pelaksanaan sudah terbit (${f.last.title}).` : 'Penambahan modal sudah tereksekusi; saham baru sudah tercatat.')
    if (c.kind === 'PMTHMETD' || c.kind === 'merger') add(1, 'Penyerap saham baru sudah ditentukan sejak awal (bukan dana publik).')
    return { key: 'done', label: 'Sudah tercapai', tone: 'good', score: 9, reasons: why, last: f.last }
  }
  let sc = 0
  const plus = (n, t) => { sc += n; add(n > 0 ? 1 : n < 0 ? -1 : 0, t) }
  const asetShare = r.total > 0 ? r.aset / r.total : 0
  const nonCash = asetShare >= 0.95
  const tunaiMcap = c.mcap ? r.tunai / c.mcap : null
  if (asetShare >= 0.8) plus(2, `${nonCash ? 'Hampir seluruh' : Math.round(asetShare * 100) + '%'} penerbitan disetor aset (${bigTxt(r.aset)}) oleh pemilik aset, bukan dana pasar.`)
  if (!nonCash && tunaiMcap != null) {
    if (tunaiMcap > 3) plus(-3, `Dana tunai ${fx(tunaiMcap)} kapitalisasi pasar: terlalu besar untuk diserap pasar tanpa penyandang dana kuat.`)
    else if (tunaiMcap > 1) plus(-2, `Dana tunai ${fx(tunaiMcap)} kapitalisasi pasar: besar dibanding nilai emiten.`)
    else if (tunaiMcap > 0.3) plus(0, `Dana tunai ${Math.round(tunaiMcap * 100)}% kapitalisasi pasar: moderat.`)
    else plus(1, `Dana tunai hanya ${Math.round(tunaiMcap * 100)}% kapitalisasi pasar: relatif kecil.`)
  }
  if (c.kind !== 'PMTHMETD' && c.kind !== 'merger' && !nonCash) {
    if (f.standby === 'ya') plus(2, `Ada pembeli siaga/komitmen penyerapan: ${shortTxt(f.standbyText, 160)}`)
    else if (f.standby === 'tidak') plus(-2, 'Belum ada pembeli siaga: bila publik tidak menebus, dana tidak terjamin.')
    else plus(-1, 'Pembeli siaga belum diungkap di keterbukaan.')
  } else if (c.kind === 'PMTHMETD' && !nonCash) {
    plus(f.standby === 'ya' || /diserap|investor/i.test(c.notes.join(' ')) ? 1 : 0, 'PMTHMETD: dana bergantung pada investor yang ditunjuk, bukan publik.')
  }
  if (r.disc != null && !nonCash) {
    if (r.disc > 0.05) plus(-2, `Harga pelaksanaan ${Math.round(r.disc * 100)}% di atas harga pasar: publik cenderung tidak menebus.`)
    else if (r.disc < -0.2) plus(1, `Harga pelaksanaan diskon ${Math.round(-r.disc * 100)}% dari pasar: menarik untuk ditebus.`)
  }
  if (c.ctrlNet != null && c.ctrlNet < -1) plus(-1, `Pengendali justru mengurangi porsi ${Math.abs(c.ctrlNet).toFixed(1).replace('.', ',')} poin dalam setahun.`)
  else if (c.ctrlNet != null && c.ctrlNet > 1) plus(1, `Pengendali menambah porsi ${c.ctrlNet.toFixed(1).replace('.', ',')} poin dalam setahun.`)
  // RUPS yang dijadwalkan di masa depan berarti rencana belum disetujui.
  const rupsLater = /RUPS/i.test(c.jadwal || '') && (dateIn(c.jadwal) || '') > new Date().toISOString().slice(0, 10)
  if (f.stage === 'pelaksanaan') plus(1, 'Sudah masuk tahap pelaksanaan (prospektus/pernyataan efektif).')
  else if (f.rupsOk && !rupsLater) plus(1, 'Rencana sudah disetujui RUPS.')
  else plus(0, `Belum disetujui RUPS${c.jadwal ? ` (${shortTxt(c.jadwal, 60)})` : ''}; rencana masih bisa berubah atau batal.`)
  if (c.inj && c.kjppStatus === 'belum' && (c.V || c.laterInj)) plus(-1, 'Nilai aset belum dinilai KJPP: jadwal bisa mundur.')
  if (!f.last) plus(-1, 'Belum ada keterbukaan resmi tentang penambahan modal di Stockbit Reports.')
  const key = sc >= 3 ? 'likely' : sc >= 0 ? 'maybe' : 'doubt'
  return {
    key, score: sc, last: f.last, reasons: why,
    label: { likely: 'Kemungkinan besar tercapai', maybe: 'Bisa tercapai, bersyarat', doubt: 'Diragukan tercapai' }[key],
    tone: { likely: 'good', maybe: 'warn', doubt: 'strong' }[key],
  }
}
// Tanggal pertama "18 November 2026" / "18 Nov 2026" di teks → YYYY-MM-DD.
const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']
function dateIn(s) {
  const m = String(s || '').match(/(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|ags|sep|okt|nov|des)\w*\s+(\d{4})/i)
  if (!m) return null
  const mo = BULAN.indexOf(m[2].toLowerCase().replace('ags', 'agu')) + 1
  return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
const bigTxt = v => v >= 1e12 ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T` : `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
const fx = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '×'
const shortTxt = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, t.lastIndexOf(' ', n - 1) > n * 0.6 ? t.lastIndexOf(' ', n - 1) : n - 1) + '…' : t }

export const noRights = c => c?.kind === 'PMTHMETD' || c?.kind === 'merger'

// Hitungan pada harga pelaksanaan P dan tingkat penebusan publik u (0–1).
export function riCalc(c, P, u = 0) {
  if (!c || !(P > 0) || !(c.S0 > 0)) return null
  // Saham baru: dari data; bila belum ada, (setoran aset + tunai, atau nilai aset) ÷ P, dibatasi maksimum dokumen.
  const N0 = c.N || ((c.V || 0) + (c.cash || 0) || c.inj || 0) / P
  const N = c.Nmax && !c.N ? Math.min(N0, c.Nmax) : N0
  if (!(N > 0)) return null
  const S0 = c.S0, S1 = S0 + N, total = N * P
  const aset = Math.min(c.V || (c.kind === 'merger' ? total : 0), total), tunai = total - aset
  const ctrl = (c.ctrlPct || 0) / 100, pub = (c.float || 0) / 100
  const nr = noRights(c)
  // TERP: harga teoretis setelah penerbitan = (nilai pasar lama + nilai baru) ÷ total saham.
  const terp = c.price ? (S0 * c.price + total) / S1 : null
  const pubAfter = nr ? pub * S0 / S1 : (pub * S0 + pub * N * u) / S1
  const injShares = c.laterInj ? c.laterInj / P : 0
  return {
    N, S1, total, aset, tunai, ratio: N / S0, terp, hak: terp != null && !nr ? terp - P : null, disc: c.price ? P / c.price - 1 : null,
    ctrlPart: nr ? null : ctrl * total, pubPart: nr ? null : pub * total, standby: nr ? null : pub * total * (1 - u),
    ctrlAfterAbsorb: nr ? null : (ctrl * S0 + ctrl * N + pub * N * (1 - u)) / S1,
    newHolder: N / S1, ctrlAfterNr: ctrl * S0 / S1,
    pubAfter, injShares, pubAfterInj: injShares ? pubAfter * S1 / (S1 + injShares) : null,
    dilusi: 1 - S0 / S1, perLot: { hak: 100 * N / S0, dana: 100 * N / S0 * P },
    cover: c.inj ? total / c.inj : null, gap: c.inj ? c.inj - total : null,
    vsMcap: c.mcap ? total / c.mcap : null,
  }
}

// Rentang slider harga pelaksanaan: tidak dibatasi nominal, Rp1 sampai minimal Rp10.000 (atau 5× harga tertinggi
// yang relevan); harga di luar rentang tetap bisa diketik langsung.
export function riRange(c) {
  const start = Math.max(c?.nominal || 1, c?.ex || c?.implied || c?.price || 100)
  const top = Math.max(c?.price || 0, start)
  const lo = 1
  const hi = Math.max(10000, Math.round(top * 5))
  return { lo, hi, step: hi > 20000 ? 10 : 1, start: Math.round(start) }
}

const fmtX = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '×'
const pc = v => Math.round(v * 100) + '%'

// Kesimpulan singkat otomatis.
export function riVerdict(c, r) {
  if (!c || !r) return ''
  const out = []
  if (r.vsMcap != null) {
    if (r.aset >= r.total * 0.95) out.push(`Penerbitan dibayar aset senilai ${fmtX(r.vsMcap)} kapitalisasi pasar: nilai wajar aset menentukan apakah pemegang lama untung atau terdilusi.`)
    else out.push(r.vsMcap >= 1 ? `Dana tunai yang dibutuhkan ${fmtX(r.tunai / c.mcap)} kapitalisasi pasar: penyerapan sangat bergantung pada pengendali/pembeli siaga.` : `Nilai penerbitan setara ${pc(r.vsMcap)} kapitalisasi pasar.`)
  }
  if (r.cover != null && r.cover < 0.95 && !c.laterInj) out.push(`Nilai penerbitan hanya menutup ${pc(r.cover)} nilai aset; sisanya perlu utang, kas internal, atau tahap lanjutan.`)
  // Nilai KJPP kadang berupa harga per saham (mis. Rp296); bandingkan hanya bila setara nilai total transaksi.
  if (c.kjpp && c.inj && c.kjpp >= c.inj * 0.2) out.push(c.inj > c.kjpp * 1.05 ? `Harga aset ${pc(c.inj / c.kjpp - 1)} di atas penilaian KJPP.` : 'Harga aset sejalan dengan penilaian KJPP.')
  else if (c.inj && c.kjppStatus === 'belum') out.push('Nilai aset belum diuji KJPP.')
  if (r.disc != null && r.disc < -0.3) out.push(`Harga pelaksanaan diskon ${pc(-r.disc)} dari pasar: tekanan harga ke arah TERP.`)
  if (r.pubAfter < 0.075) out.push(`Bila publik tidak menebus, porsi publik turun ke ${(r.pubAfter * 100).toFixed(1).replace('.', ',')}% (di bawah batas free float 7,5%).`)
  return out.join(' ')
}
