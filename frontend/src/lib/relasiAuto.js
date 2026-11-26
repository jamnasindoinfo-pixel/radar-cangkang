// Diagram alur saham otomatis dari data yang sudah ada (profil-pengendali, aset-verified,
// pengendali-verified, story, item). Dipakai untuk emiten yang belum punya kurasi manual
// di relasi-verified.json, supaya panel Alur saham konsisten di semua emiten.
// Bentuk keluaran sama dengan relasi-verified: { nodes:[{id,x,y,t,s,k}], edges:[[dari,ke,jenis,label]], info:{} }.

const pctOf = s => (String(s || '').match(/(\d+(?:[.,]\d+)?)\s*%/) || [])[1]?.replace('.', ',') || ''
// Nama pendek untuk kotak: buang keterangan dalam kurung dan setelah ";" / " — ".
const short = (s, n = 46) => {
  // Potong di keterangan pertama: " (", " — ", ";", ", ", " / ", " → " (kurung bisa bersarang, jadi tidak diregex berpasangan).
  const t = String(s || '').split(/\s[—–-]\s|;|\s\(|,\s|\s\/\s|\s→\s|\sdan\s/)[0].trim()
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t
}
const clip = (s, n = 70) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }
const srcText = s => Array.isArray(s) ? s.slice(0, 3).join(' · ') : String(s || '')

// Posisi x tengah untuk n kotak dalam satu baris, berpusat di 680 (sama dengan diagram kurasi).
const rowXs = (n, gap = 320) => Array.from({ length: n }, (_, i) => 680 + (i - (n - 1) / 2) * gap)
const ROW_Y = [164, 374, 616, 844]
const ROW_Y_RISET = [120, 400, 680, 960]  // hasil riset: baris lebih renggang untuk label garis

export function buildRelasi(t, { profil = {}, aset = {}, pengendali = {}, verified = {}, item = null, story = null, pandangan = null } = {}) {
  const pf = profil[t] || {}, as = aset[t] || {}, pv = pengendali[t] || {}, sv = verified[t] || {}
  const people = (pf.pengendali || []).slice(0, 4)
  if (!people.length && !pv.siapa && !item?.ctrlName) return null

  const nodes = [], edges = [], info = {}
  const add = (id, row, t0, s, k, inf) => { nodes.push({ id, row, t: t0, s, k }); if (inf) info[id] = inf }

  // Baris 0: orang (UBO / pemegang kendali / wakil pengendali).
  people.forEach((p, i) => {
    add('p' + i, 0, short(p.nama), clip([p.peran, pctOf(p.porsi) && pctOf(p.porsi) + '%'].filter(Boolean).join(' · '), 44), '', {
      kind: 'Orang · ' + (p.peran || 'pihak pengendali'),
      who: p.latar || '',
      role: [p.entitas && `Lewat ${p.entitas}.`, p.porsi && `Porsi: ${p.porsi}.`].filter(Boolean).join(' '),
      flag: p.risiko || '',
      trackTitle: 'Rekam jejak',
      track: [
        ...(p.pengalaman ? [['—', p.pengalaman]] : []),
        ...(p.jaringan || []).map(j => [j.keyakinan === 'terverifikasi' ? 'terverifikasi' : 'disebut media', `${j.dengan}: ${j.hubungan}`]),
      ],
      note: p.karakteristik || '',
      open: (pf.tidakDitemukan || []).filter(x => x.toLowerCase().includes(String(p.nama).split(/\s+/)[0].toLowerCase())),
      src: srcText(p.sumber),
    })
  })

  // Baris 1: kendaraan pengambilalihan (entitas para orang, atau nama pengendali di item).
  const ents = [...new Set(people.map(p => short(p.entitas)).filter(Boolean))].slice(0, 2)
  if (!ents.length) ents.push(short(item?.ctrlName || item?.acquirer || pv.siapa))
  ents.forEach((e, i) => add('e' + i, 1, e, i === 0 ? clip(pv.grup || 'pengendali baru', 44) : 'pengendali baru', 'key', {
    kind: 'Pengendali baru',
    who: pv.siapa || '',
    role: pv.rencana || '',
    flag: pv.bukanPengambilAlih ? 'Bukan pengambilalihan: transaksi ini tidak mengubah pengendali secara efektif.' : '',
    trackTitle: 'Catatan', track: pv.catatan ? [['—', pv.catatan]] : [],
    open: [], src: [pv.sumberJudul, pv.sumberTanggal].filter(Boolean).join(', '),
  }))
  people.forEach((p, i) => {
    const e = ents.indexOf(short(p.entitas))
    edges.push(['p' + i, 'e' + Math.max(0, e), 'own', /wakil/i.test(p.peran || '') ? 'wakil' : (pctOf(p.porsi) ? 'UBO ' + pctOf(p.porsi) + '%' : 'UBO')])
  })

  // Baris 2: pengendali lama, emiten, pihak lawan transaksi.
  const ctrlPct = item?.ctrlPct != null ? String(item.ctrlPct).replace('.', ',') + '%' : (pctOf(people[0]?.porsi) ? pctOf(people[0].porsi) + '%' : '')
  add('em', 2, t, clip([item?.name, story?.baru && '→ ' + story.baru].filter(Boolean).join(' '), 46), 'main', {
    kind: 'Emiten BEI', who: pf.ringkas || '',
    role: story?.baru ? `Bisnis lama: ${story.lama || 'belum ada'}. Bisnis baru: ${story.baru}.` : '',
    trackTitle: 'Pengurus',
    track: [...(pf.pengurus?.direksi || []).map(d => [d.jabatan || 'Direksi', d.nama + (d.orangPengendaliBaru ? ' (orang pengendali baru)' : '')]),
      ...(pf.pengurus?.komisaris || []).map(d => [d.jabatan || 'Komisaris', d.nama + (d.orangPengendaliBaru ? ' (orang pengendali baru)' : '')])],
    open: pf.tidakDitemukan || [], src: '',
  })
  edges.push(['e0', 'em', 'own', ctrlPct || 'pengendali'])
  if (story?.oldName) {
    // Beberapa nama pengendali lama: tampilkan nama pertama + "dkk", nama lengkap di laci.
    const olds = String(story.oldName).split(/,\s*/)
    add('old', 2, short(olds[0]) + (olds.length > 1 ? ' dkk' : ''), story.oldInferred ? 'pengendali lama (perkiraan)' : 'pengendali lama', '', {
      kind: 'Pengendali lama', who: story.oldName, role: story.oldPct ? `Porsi sebelum pengambilalihan ±${String(story.oldPct).replace('.', ',')}%.` : '',
      trackTitle: 'Catatan', track: [], open: story.oldInferred ? ['Nama pengendali lama disimpulkan dari riwayat pemegang saham'] : [], src: 'Stockbit',
    })
    edges.push(['old', 'em', 'own', story.oldPct ? `dulu ${String(story.oldPct).replace('.', ',')}%` : 'dulu'])
  } else {
    add('old', 2, 'Pengendali lama', 'belum ada di data Stockbit', 'none', {
      kind: 'Pengendali lama', who: 'Riwayat pemegang saham Stockbit belum menunjukkan pengendali sebelum pengambilalihan.',
      role: '', trackTitle: 'Catatan', track: [], open: ['Nama dan porsi pengendali lama'], src: 'Stockbit',
    })
  }
  const af = { ...(pf.afiliasi || {}) }  // salinan: pihakLawan bisa dikosongkan di bawah
  const affiliated = /afiliasi/i.test(af.hubungan || '') && !/tidak\s+(ter)?afiliasi/i.test(af.hubungan || '')
  // "Tidak ada injeksi aset" / "Belum ada …" bukan nama pihak.
  if (/^\s*(tidak|belum)\s+ada\b|^\s*-?\s*$/i.test(af.pihakLawan || '')) af.pihakLawan = ''
  if (af.pihakLawan) {
    add('lawan', 2, short(af.pihakLawan), clip(af.karakteristik || 'pihak lawan transaksi', 46), affiliated ? 'void' : '', {
      kind: 'Pihak lawan transaksi', who: af.pihakLawan,
      role: af.hubungan || '', flag: affiliated ? 'Transaksi dengan pihak terafiliasi pengendali.' : '',
      trackTitle: 'Pemilik', track: [af.pemilikAset && ['Pemilik aset', af.pemilikAset], af.pengendaliPihakLawan && ['Pengendali', af.pengendaliPihakLawan]].filter(Boolean),
      open: [], src: srcText(af.sumber),
    })
    if (affiliated) edges.push(['e0', 'lawan', 'role', 'afiliasi'])
  }

  // Baris 3: aset yang diinjeksi dan masyarakat.
  if (as.aset?.nama) {
    const k = as.kjpp || {}
    add('aset', 3, short(as.aset.nama), clip([as.aset.sektor, k.status === 'terbit' ? 'KJPP terbit' : 'KJPP belum terbit'].filter(Boolean).join(' · '), 44), '', {
      kind: 'Aset yang diinjeksi', who: as.aset.jenis || '', role: as.aset.deskripsi || '',
      flag: k.status === 'terbit' ? '' : 'Laporan penilai independen (KJPP) belum terbit.',
      trackTitle: 'Transaksi', track: [as.transaksi?.nilai && ['Nilai', as.transaksi.nilai], as.transaksi?.caraBayar && ['Cara bayar', as.transaksi.caraBayar], k.nilai && ['KJPP', k.nilai]].filter(Boolean),
      open: [], src: k.sumber || '',
    })
    edges.push(['aset', 'em', 'plan', clip(as.transaksi?.nilai || 'injeksi', 30)])
    if (af.pihakLawan) edges.push(['lawan', 'aset', 'own', 'pemilik'])
  } else if (sv.injectTarget) {
    // Belum ada di aset-verified: pakai target injeksi dari story-verified (Stockbit Reports).
    add('aset', 3, short(sv.injectTarget), clip([sv.injectType, sv.nominal].filter(Boolean).join(' · '), 44), '', {
      kind: 'Aset yang diinjeksi', who: sv.injectTarget, role: sv.note || '',
      flag: 'Data aset dan KJPP belum dicek; ringkasan dari laporan Stockbit.',
      trackTitle: 'Transaksi', track: [sv.injectType && ['Skema', sv.injectType], sv.nominal && ['Nilai', sv.nominal], sv.target && ['Target', sv.target]].filter(Boolean),
      open: ['Status KJPP', 'Laporan keuangan aset'], src: [sv.sourceTitle, sv.sourceDate].filter(Boolean).join(', '),
    })
    edges.push(['aset', 'em', 'plan', clip(sv.nominal || 'injeksi', 30)])
  } else {
    // Tidak ada aset yang disuntik: tetap tampil sebagai kotak keterangan supaya diagram tiap emiten sama bentuknya.
    const why = pv.bukanPengambilAlih ? 'bukan pengambilalihan untuk backdoor'
      : /^tetap/i.test(sv.baru || '') ? 'bisnis lama dipertahankan' : 'belum ada rencana yang diumumkan'
    add('aset', 3, 'Tanpa injeksi aset', why, 'none', {
      kind: 'Aset yang diinjeksi', who: 'Tidak ada aset yang disuntik ke emiten menurut data saat ini.',
      role: sv.baru ? `Arah usaha: ${sv.baru}` : '', trackTitle: 'Catatan', track: sv.note ? [['—', sv.note]] : [],
      open: ['Rencana injeksi aset di keterbukaan informasi berikutnya'], src: [sv.sourceTitle, sv.sourceDate].filter(Boolean).join(', '),
    })
  }
  const pub = pandangan?.dilusi?.porsiPublikSekarang
  add('pub', 3, 'Masyarakat', pub != null ? `porsi publik ${String(pub).replace('.', ',')}%` : 'pemegang saham publik', '', {
    kind: 'Pemegang saham publik', who: '', role: pandangan?.dilusi?.berlaku && pandangan.dilusi.porsiPublikSetelah != null
      ? `Porsi publik ${String(pub).replace('.', ',')}% turun ke ±${String(pandangan.dilusi.porsiPublikSetelah).replace('.', ',')}% bila inbreng terjadi sesuai asumsi analis.` : '',
    trackTitle: 'Catatan', track: [], open: [], src: 'pandangan-analis.json',
  })
  edges.push(['pub', 'em', 'own', pub != null ? String(pub).replace('.', ',') + '%' : 'publik'])

  // Tata letak: tiap baris dipusatkan; emiten selalu di tengah baris 2.
  for (let r = 0; r < 4; r++) {
    const row = nodes.filter(n => n.row === r)
    if (r === 2) {
      const order = ['old', 'em', 'lawan'].map(id => row.find(n => n.id === id)).filter(Boolean)
      const xs = order.length === 3 ? [200, 680, 1160] : order[0]?.id === 'em' ? [680, 1160] : [200, 680]
      order.forEach((n, i) => { n.x = order.length === 1 ? 680 : xs[i]; n.y = ROW_Y[r] })
    } else if (r === 3) {
      // Masyarakat tepat di bawah emiten; aset di bawah pihak lawan (kanan) supaya garis tidak bersilang.
      row.forEach(n => { n.x = n.id === 'pub' ? 680 : 1160; n.y = ROW_Y[r] })
    } else rowXs(row.length).forEach((x, i) => { row[i].x = x; row[i].y = ROW_Y[r] })
  }
  nodes.forEach(n => delete n.row)
  return { auto: true, nodes, edges, info }
}

// Tata letak untuk relasi hasil riset yang hanya menyebut `row` (0–3) tanpa koordinat:
// tiap baris dipusatkan di x=680, emiten di tengah baris 2, jarak antar-kotak menyempit bila baris padat.
export function layoutRows(rel) {
  if (!rel?.nodes || rel.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))) return rel
  const nodes = rel.nodes.map(n => ({ ...n }))
  let y = ROW_Y_RISET[0]
  for (let r = 0; r < 4; r++) {
    const row = nodes.filter(n => (n.row ?? 3) === r)
    // Baris > MAX_PER_ROW dipecah jadi beberapa sub-baris supaya diagram tidak melebar.
    const subs = []
    if (r === 2) {
      // Emiten di tengah sub-baris pertama, diapit maksimal 2 kotak tiap sisi; sisanya di bawah.
      const em = row.find(n => n.id === 'em'), rest = row.filter(n => n !== em)
      const side = em ? Math.min(2, Math.floor(rest.length / 2)) : 0
      const first = em ? [...rest.slice(0, side), em, ...rest.slice(side, side * 2)] : []
      subs.push(...(first.length ? [first] : []), ...chunk(rest.slice(em ? side * 2 : 0), MAX_PER_ROW))
    } else subs.push(...chunk(row, MAX_PER_ROW))
    subs.forEach((sub, k) => {
      // Jarak lega (≥ 400) supaya label garis antar-kotak bersebelahan tidak tertutup kotak;
      // sub-baris ganjil digeser setengah jarak agar garis vertikal lewat di sela kotak.
      const gap = Math.max(400, Math.min(460, 2000 / sub.length))
      const shift = k % 2 ? gap / 2 : 0
      sub.forEach((n, i) => { n.x = 680 + shift + (i - (sub.length - 1) / 2) * gap; n.y = y + k * SUB_ROW_GAP })
    })
    y += Math.max(0, subs.length - 1) * SUB_ROW_GAP + (ROW_Y_RISET[1] - ROW_Y_RISET[0])
  }
  return { ...rel, nodes }
}

const MAX_PER_ROW = 5
const SUB_ROW_GAP = 190
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

// Lensa Alur saham: relasi kurasi yang padat dipilah per sudut pandang. Node memilih lensanya
// lewat `l: ['kendali', ...]` dan boleh pindah baris per lensa lewat `lr: { pengurus: 1 }` atau diberi posisi tengah
// tetap `lp: { pengurus: [x, y] }` (dipakai hanya bila semua node lensa itu punya lp); garis boleh
// membatasi diri lewat elemen ke-5 `[dari, ke, jenis, label, [lensa]]`.
// Kotak emiten selalu tampil; node tanpa `l` hanya tampil di "Semua".
export const LENSES = [['kendali', 'Kendali'], ['arus', 'Arus saham'], ['pengurus', 'Pengurus'], ['aset', 'Aset'], ['semua', 'Semua']]
export const lensesOf = rel => LENSES.filter(([k]) => k !== 'semua' && rel?.nodes?.some(n => n.l?.includes(k)))

export function lensOf(rel, lens) {
  if (!rel?.nodes || !lens || lens === 'semua') return rel
  // Koordinat lama dibuang supaya layoutRows menata ulang subset tanpa celah.
  const nodes = rel.nodes.filter(n => n.id === 'em' || n.l?.includes(lens))
    .map(({ x, y, ...n }) => {
      const p = n.lp?.[lens]
      return p ? { ...n, x: p[0], y: p[1] } : { ...n, row: n.lr?.[lens] ?? n.row }
    })
  const ids = new Set(nodes.map(n => n.id))
  const edges = (rel.edges || []).filter(e => ids.has(e[0]) && ids.has(e[1]) && (!e[4] || e[4].includes(lens)))
  return layoutRows({ ...rel, nodes, edges })
}

// Tata letak tersimpan satu objek per emiten: kunci `id` untuk "Semua", `lensa:id` untuk lensa lain.
export const layoutFor = (saved = {}, lens) => lens === 'semua'
  ? Object.fromEntries(Object.entries(saved).filter(([k]) => !k.includes(':')))
  : Object.fromEntries(Object.entries(saved).filter(([k]) => k.startsWith(lens + ':')).map(([k, v]) => [k.slice(lens.length + 1), v]))
export function mergeLayout(saved = {}, lens, pos) {
  const mine = k => (lens === 'semua' ? !k.includes(':') : k.startsWith(lens + ':'))
  const keep = Object.entries(saved).filter(([k]) => !mine(k))
  const add = Object.entries(pos).map(([id, v]) => [lens === 'semua' ? id : lens + ':' + id, v])
  return Object.fromEntries([...keep, ...add])
}

// Baris tabel arus saham; bila node dipilih, hanya baris yang melibatkan node itu.
export const transfersOf = (rel, id) => (rel?.transfers || []).filter(t => !id || t.dari === id || t.ke === id)

// Kunci pencocokan nama pihak lintas emiten: abaikan bentuk badan hukum dan tanda baca.
export const entityKey = s => String(s || '').toLowerCase()
  .replace(/\b(pt|tbk|ltd|pte|limited|holdings?|group|grup|inc|co)\b|[.,()]/g, ' ').replace(/\s+/g, ' ').trim()

// Indeks pihak → daftar emiten tempat pihak itu muncul (selain kotak emiten dan Masyarakat).
export function buildEntityIndex(relasi = {}) {
  const idx = new Map()
  for (const [t, v] of Object.entries(relasi)) {
    if (t.startsWith('_') || !v?.nodes) continue
    for (const n of v.nodes) {
      if (n.id === 'em' || n.k === 'none' || /^masyarakat$/i.test(n.t)) continue
      const k = entityKey(n.t)
      if (k.length < 6) continue
      if (!idx.has(k)) idx.set(k, new Set())
      idx.get(k).add(t)
    }
  }
  return idx
}
