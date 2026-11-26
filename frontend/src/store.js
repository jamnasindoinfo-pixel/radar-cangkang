// State bersama aplikasi. Data radar (items, updates) tinggal di SQLite server
// (/api/items, /api/updates); file JSON terverifikasi dibaca apa adanya.
import { reactive } from 'vue'
import { api, loadJson } from './api.js'
import { deriveStory } from './lib/story.js'
import { syncReports, syncStockbit, syncTenders } from './lib/sync.js'
import { stageOf } from './lib/domain.js'
import { buildRelasi, layoutRows, buildEntityIndex, entityKey } from './lib/relasiAuto.js'

const LS_ITEMS = 'radar-cangkang.v1'
const LS_UPD = 'radar-cangkang.updates.v1'
const LS_SEEN = 'radar-cangkang.seen'
const AUTO_KEY = 'radar-cangkang.autoSync'
const AUTO_GAP = 15 * 60e3

const ls = {
  get(k, d) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// Data awal bila server dan browser sama-sama kosong (sama dengan versi lama).
const SEED_ITEMS = [
  { id: 'NAYZ', ticker: 'NAYZ', name: 'PT Hassana Boga Sejahtera Tbk', price: 73, mcap: null, float: null, stage: 'tender',
    acquirer: 'Saiko Consultancy (Singapura)', flags: { akuisisi: true, kbli: true, rights: true },
    ms: { spa: true, akuisisi: true, to_umum: true }, updatedAt: '2026-10-14T03:30:00Z',
    notes: 'Harga Rp73 per 2 Okt 2026. Akuisisi 29,41% pada 19 Agt 2026; penawaran tender wajib Rp75, 5 Okt–3 Nov 2026. Rencana inbreng perusahaan teknologi dan PMHMETD. Sumber: KabarBursa, 2 Okt 2026.' },
  { id: 'BIKE', ticker: 'BIKE', name: 'PT Sepeda Bersama Indonesia Tbk', price: null, mcap: null, float: null, stage: 'spa',
    acquirer: 'PT Penajam Makmur Jaya', flags: { akuisisi: true }, ms: { spa: true, akuisisi: true }, updatedAt: '2026-10-14T03:30:00Z',
    notes: 'Akuisisi 71,22% (921,5 juta saham) pada 15 Apr 2026 melalui pasar negosiasi. Penawaran tender wajib direncanakan; status terbaru perlu diverifikasi. Sumber: Bareksa, 17 Apr 2026.' },
]

export const store = reactive({
  ready: false,
  // Kandidat otomatis dari /api/kandidat (pemindaian seluruh BEI di server).
  kandidat: { items: [], hidden: [], asOf: '', loading: true, error: '' },
  // Emiten yang sedang dibandingkan (maks. 3), diingat di browser ini.
  compare: ls.get('radar-cangkang.compare', []),
  // Perubahan per emiten dari snapshot harian (/api/diff), per rentang hari: { 1: {...}, 7: {...} }.
  diff: {},
  items: [],
  updates: [],
  verified: {},
  pandangan: {},
  analisa: {},
  pengendali: {},
  relasi: {},
  aset: {},        // aset-verified.json: aset injeksi, KJPP, mekanisme transaksi per emiten
  riset: {},       // aset-riset.json: riset aset lintas sumber (jurnal, media, situs perusahaan, regulator)
  riDoc: {},       // ri-dokumen.json: fakta penambahan modal & kewajaran aset dari dokumen asli (lampiran PDF)
  profil: {},      // profil-pengendali.json: orang di balik pengendali per emiten
  hsc: { kode: [] }, // hsc.json: saham konsentrasi kepemilikan tinggi (dikeluarkan dari IHSG)
  changelog: {},   // changelog.json: panel Pembaruan
  status: null,
  features: {},
  // Penanda "sudah dilihat" browser ini (diset lewat tombol, bukan otomatis saat tab ditutup):
  // dasar penanda "baru" di Monitor, Berita, dan rail. Belum pernah diset = 24 jam terakhir.
  seenAt: ls.get(LS_SEEN, '') || new Date(Date.now() - 864e5).toISOString(),
  newVersion: false,  // deploy baru sudah live, tab ini masih kode lama (lihat loadStatus)
  busy: { stockbit: false, reports: false, story: false },
  toasts: [],
  syncNote: '',
})

export function markSeen() {
  store.seenAt = new Date().toISOString()
  ls.set(LS_SEEN, store.seenAt)
}

let toastId = 0
export function toast(text, warn = false) {
  const id = ++toastId
  store.toasts.push({ id, text, warn })
  setTimeout(() => { store.toasts = store.toasts.filter(t => t.id !== id) }, warn ? 9000 : 5000)
}

// Toast progres ("Memperbarui i/n") yang teksnya diganti di tempat dan tetap tampil sampai done().
function progressToast() {
  let id = 0
  return {
    set(text) {
      const t = id && store.toasts.find(x => x.id === id)
      if (t) t.text = text
      else { id = ++toastId; store.toasts.push({ id, text }) }
    },
    done() { if (id) store.toasts = store.toasts.filter(x => x.id !== id) },
  }
}

export const itemOf = t => store.items.find(i => i.ticker === t)
// Versi publik (domain lewat Cloudflare): server menolak penulisan dan tidak memanggil Stockbit.
export const readOnly = () => !!store.status?.readOnly
export const pandanganOf = t => store.pandangan[t] || null

const storyMemo = new Map()
export function storyOf(t) {
  const it = itemOf(t)
  if (!it) return null
  const key = it.updatedAt + '|' + (it.storyAuto?.at || '') + '|' + store.updates.length
  const hit = storyMemo.get(t)
  if (hit && hit.key === key) return hit.v
  const v = deriveStory(it, { verified: store.verified, updates: store.updates })
  storyMemo.set(t, { key, v })
  return v
}

export async function saveItem(item) {
  if (readOnly()) return
  const i = store.items.findIndex(x => x.ticker === item.ticker)
  if (i >= 0) store.items[i] = item
  else store.items.push(item)
  await api.put('/api/items/' + item.ticker, item)
}

// Simpan hanya item yang berubah supaya tidak menimpa suntingan anggota tim lain.
export async function saveItems(list) {
  if (readOnly()) return
  // Sinkron berjalan di atas salinan lama; story yang tersimpan selama sinkron
  // (loadStories) lebih baru dari salinan itu, jadi dipertahankan.
  const cur = new Map(store.items.map(i => [i.ticker, i]))
  list = list.map(i => {
    const c = cur.get(i.ticker)
    return c?.storyAuto && (c.storyAuto.at || 0) > (i.storyAuto?.at || 0) ? { ...i, storyAuto: c.storyAuto } : i
  })
  const before = new Map(store.items.map(i => [i.ticker, JSON.stringify(i)]))
  const gone = store.items.filter(i => !list.some(x => x.ticker === i.ticker))
  store.items = list
  const changed = list.filter(i => before.get(i.ticker) !== JSON.stringify(i))
  await Promise.all([...changed.map(i => api.put('/api/items/' + i.ticker, i)),
    ...gone.map(i => api.del('/api/items/' + i.ticker))])
}

export async function saveUpdates(list) {
  if (readOnly()) return
  const known = new Map(store.updates.map(u => [u.id, JSON.stringify(u)]))
  const changed = list.filter(u => known.get(u.id) !== JSON.stringify(u))
  store.updates = list
  // Dikirim bertahap: sinkron berita bisa menghasilkan ribuan update sekaligus.
  for (let i = 0; i < changed.length; i += 200) await api.post('/api/updates', changed.slice(i, i + 200))
}

// Data radar dari server. Kunjungan pertama setelah refaktor: kirim isi localStorage lama sekali.
async function loadData() {
  let [items, updates] = await Promise.all([api.get('/api/items'), api.get('/api/updates')])
  if (!items.length && !readOnly()) {
    const oldItems = ls.get(LS_ITEMS, null)
    const oldUpd = ls.get(LS_UPD, []).filter(u => /^(sb-report-|news-)/.test(u.id))
    const payload = { items: oldItems && oldItems.length ? oldItems : SEED_ITEMS, updates: oldUpd }
    const res = await api.post('/api/migrate', payload)
    if (res.migrated) {
      if (oldItems) toast(`Data lama dipindah ke server: ${res.items} emiten, ${res.updates} berita.`)
      ;[items, updates] = await Promise.all([api.get('/api/items'), api.get('/api/updates')])
    }
  }
  store.items = items
  store.updates = updates
}

export async function loadStatus() {
  try { store.status = await api.get('/api/status') } catch { store.status = null }
  // Deploy baru sudah live tetapi tab ini masih menjalankan kode lama (aplikasi satu halaman tidak memuat ulang sendiri).
  const dep = store.status?.deploy
  const build = typeof __BUILD__ === 'string' ? __BUILD__ : ''
  store.newVersion = !!(build && dep?.hasil === 'live' && dep.commit && String(dep.commit).slice(0, 7) !== build)
}

export async function init() {
  const [verified, pandangan, analisa, pengendali, relasi, aset, profil, hsc, changelog, riDoc, riset] = await Promise.all(
    ['story-verified.json', 'pandangan-analis.json', 'analisa.json', 'pengendali-verified.json', 'relasi-verified.json',
      'aset-verified.json', 'profil-pengendali.json', 'hsc.json', 'changelog.json', 'ri-dokumen.json', 'aset-riset.json'].map(loadJson))
  Object.assign(store, { verified, pandangan, analisa, pengendali, relasi, aset, profil, hsc: hsc.kode ? hsc : { kode: [] }, changelog, riDoc, riset })
  await loadStatus()  // dulu: perlu tahu mode publik sebelum migrasi
  try { await loadData() } catch (e) { toast('Gagal memuat data dari server: ' + e.message, true) }
  try { store.features = await api.get('/api/features') } catch {}
  store.ready = true
  setInterval(loadStatus, 5 * 60e3)
  // Ambil ulang data tim saat tab kembali aktif, supaya suntingan anggota lain terlihat.
  let terakhir = Date.now()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - terakhir < 3 * 60e3) return
    terakhir = Date.now()
    loadData().catch(() => {}); loadStatus()
  })
}

export const canSync = () => {
  const s = store.status
  return !!s && !s.readOnly && s.configured && !(s.needsToken && !s.tokenLoaded)
}

export async function runSyncStockbit() {
  if (store.busy.stockbit) return
  store.busy.stockbit = true
  const prog = progressToast()
  try {
    // sync.js mencatat kegagalan per emiten (mis. 401) ke `errors` dan berhenti tanpa melempar.
    const errors = []
    const before = new Set(store.items.map(i => i.ticker))
    let items = store.items
    if (store.status?.tenders) items = await syncTenders(items, api, { errors })
    const added = items.filter(i => !before.has(i.ticker)).length
    items = await syncStockbit(items, api, { errors, onProgress: (i, n) => prog.set(`Memperbarui harga ${i}/${n}`) })
    await saveItems(items)
    prog.done()
    toast(`Stockbit: ${store.status?.tenders ? added + ' emiten baru, ' : ''}harga dan kepemilikan diperbarui.`)
    for (const e of errors.slice(0, 3)) toast(`${e.source}: ${e.error}`, true)
  } catch (e) {
    toast(e.status === 401 ? 'Token Stockbit ditolak atau belum ada.' : 'Gagal memperbarui dari Stockbit: ' + e.message, true)
  } finally {
    prog.done()
    store.busy.stockbit = false
  }
}

export async function runSyncReports() {
  if (store.busy.reports) return
  store.busy.reports = true
  const prog = progressToast()
  try {
    // Tanpa `tickers`: sync.js memakai daftar emiten backdoor (di luar tahap penyaringan), seperti versi lama.
    const res = await syncReports(store.items, store.updates, api, { news: !!store.status?.news, reports: !!store.status?.reports,
      onProgress: (i, n) => prog.set(`Memperbarui laporan ${i}/${n}`) })
    await saveItems(res.items)
    await saveUpdates(res.updates)
    prog.done()
    toast(`Diperbarui: ${res.added} laporan Stockbit, ${res.addedNews} berita media baru.`)
    for (const e of res.errors || []) toast(`${e.source}: ${e.error}`, true)
    loadStories().catch(() => {})
  } catch (e) {
    toast('Gagal memperbarui berita: ' + e.message, true)
  } finally {
    prog.done()
    store.busy.reports = false
  }
}

// Paling sering sekali per 15 menit per jenis data per browser, supaya Stockbit tidak dibanjiri.
const RUN = { reports: () => runSyncReports(), story: () => refreshStories(), stockbit: () => runSyncStockbit() }

// kind: 'stockbit' | 'reports' | 'story'.
export function autoRefresh(kind) {
  if (!RUN[kind]) return
  if (!canSync()) return
  const last = ls.get(AUTO_KEY, {})
  if (Date.now() - (last[kind] || 0) < AUTO_GAP) return
  if (kind === 'reports' && !(store.status.reports || store.status.news)) return
  if (store.busy[kind]) return
  // Catat waktu percobaan lebih dulu: bila gagal (mis. token kedaluwarsa), tidak diulang terus-menerus.
  ls.set(AUTO_KEY, { ...last, [kind]: Date.now() })
  RUN[kind]().catch(() => {})
}

export function userRefresh(kind) {
  api.freshFor(120e3)
  return (RUN[kind] || RUN.stockbit)()
}

// Data otomatis story (profil + riwayat pemegang saham) dari /api/story, disimpan 7 hari di item.
// Dimuat ulang bila belum ada, sudah basi, atau patokannya (nama pengendali/tanggal PTW) berubah.
let storyLoading = false
// STORY_V dinaikkan bila aturan /api/story berubah (mis. penentuan pengendali lama) agar semua story dimuat ulang.
const STORY_V = 2
const storyKey = d => `${(d.ctrlGuess ? '' : d.ctrlName) || d.acquirer || ''}|${d.tender?.start || ''}|v${STORY_V}`
export async function loadStories(tickers = null, force = false) {
  if (storyLoading || !canSync()) return
  const todo = store.items.filter(d => (tickers ? tickers.includes(d.ticker) : stageOf(d) !== 'radar') &&
    (force || !d.storyAuto || d.storyAuto.key !== storyKey(d) || Date.now() - (d.storyAuto.at || 0) > 7 * 864e5))
  if (!todo.length) return
  storyLoading = true
  try {
    for (const d of todo) {
      try {
        const s = await api.get('/api/story', { ticker: d.ticker,
          controller: (d.ctrlGuess ? '' : d.ctrlName) || (d.acquirer || '').replace(/\s*\(.*\)$/, ''), near: d.tender?.start || '' })
        const cur = itemOf(d.ticker)
        if (cur) await saveItem({ ...cur, storyAuto: { ...s, at: Date.now(), key: storyKey(d) } })
      } catch (e) {
        if (e.status === 401) { toast('Token Stockbit ditolak; story tidak bisa dimuat', true); break }
      }
      if (todo.length > 1) await new Promise(r => setTimeout(r, 300))
    }
  } finally {
    storyLoading = false
  }
}

// "Perbarui semua story": tarik ulang Stockbit Reports, tunggu pemuatan story yang sedang jalan
// (runSyncReports memicunya sendiri), lalu muat ulang profil & riwayat pengendali semua emiten backdoor.
export async function refreshStories() {
  if (store.busy.story) return
  store.busy.story = true
  try {
    await runSyncReports()
    while (storyLoading) await new Promise(r => setTimeout(r, 500))
    await loadStories(null, true)
  } finally {
    store.busy.story = false
  }
}

// Relasi untuk diagram Alur saham: kurasi manual di relasi-verified.json bila ada,
// selain itu dibangun otomatis dari profil, aset, pengendali, dan story.
const relasiMemo = new Map()
export function relasiOf(t) {
  const cur = store.relasi[t]
  if (cur?.nodes) {
    const hit = relasiMemo.get('cur:' + t)
    if (hit && hit.src === cur) return hit.v
    const v = layoutRows(cur)
    relasiMemo.set('cur:' + t, { src: cur, v })
    return v
  }
  const it = itemOf(t)
  const key = [it?.updatedAt, it?.storyAuto?.at, !!store.profil[t], !!store.aset[t]].join('|')
  const hit = relasiMemo.get(t)
  if (hit && hit.key === key) return hit.v
  const v = buildRelasi(t, { profil: store.profil, aset: store.aset, pengendali: store.pengendali, verified: store.verified, item: it,
    story: it ? storyOf(t) : null, pandangan: store.pandangan[t] })
  relasiMemo.set(t, { key, v })
  return v
}

// Benchmark siklus dari transaksi backdoor di daftar (kode:tanggal mulai PTW). Satu cache untuk
// semua halaman (Monitor, Siklus, Analisa, Profil) + permintaan yang sedang jalan dipakai bersama.
const bmCache = new Map(), bmInflight = new Map()
export const benchmarkDeals = () => store.items.filter(d => d.tender?.start)
  .map(d => `${d.ticker}:${String(d.tender.start).slice(0, 10)}`).sort().join(',')
export async function getBenchmark(deals = benchmarkDeals()) {
  if (!deals) return null
  const hit = bmCache.get(deals)
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v
  if (!bmInflight.has(deals)) {
    bmInflight.set(deals, api.get('/api/benchmark', { deals })
      .then(v => { bmCache.set(deals, { v, at: Date.now() }); return v })
      .finally(() => bmInflight.delete(deals)))
  }
  return bmInflight.get(deals)
}

// Emiten lain tempat pihak yang sama muncul (jaringan lintas emiten di panel Alur saham).
let entIdx = null, entSrc = null
export function alsoIn(title, ticker) {
  if (entSrc !== store.relasi) { entIdx = buildEntityIndex(store.relasi); entSrc = store.relasi }
  return [...(entIdx.get(entityKey(title)) || [])].filter(t => t !== ticker).sort()
}

let kandidatReq = null
export function loadKandidat() {
  kandidatReq ||= api.get('/api/kandidat')
    .then(r => Object.assign(store.kandidat, { items: r.items || [], hidden: r.hidden || [], asOf: r.asOf || '' }))
    .catch(e => { store.kandidat.error = e.message; kandidatReq = null })
    .finally(() => { store.kandidat.loading = false })
  return kandidatReq
}

// Kandidat otomatis yang belum dilacak, dalam bentuk item radar.
export function autoKandidat() {
  const known = new Set(store.items.map(i => i.ticker))
  return store.kandidat.items.filter(k => !known.has(k.ticker))
    .map(k => ({ id: k.ticker, ticker: k.ticker, name: k.name || '', price: k.price, stage: 'radar', flags: k.flags || {}, ms: {}, signals: k.signals || {}, auto: true }))
}

// Sembunyikan kandidat otomatis yang tidak relevan (tersimpan di server, berlaku untuk semua);
// pulihkan mengembalikannya ke daftar.
export async function hideKandidat(k) {
  await api.put('/api/kandidat/hidden/' + k.ticker, {})
  const kd = store.kandidat
  kd.items = kd.items.filter(x => x.ticker !== k.ticker)
  kd.hidden = [...kd.hidden, { ticker: k.ticker, name: k.name || '', at: Date.now() / 1000 }]
}
export async function unhideKandidat(h) {
  await api.del('/api/kandidat/hidden/' + h.ticker)
  const kd = store.kandidat
  kd.hidden = kd.hidden.filter(x => x.ticker !== h.ticker)
  // Data sinyalnya tidak ikut dikirim untuk yang tersembunyi: muat ulang daftar.
  kandidatReq = null
  await loadKandidat()
}

// Diff harian per rentang (1 = sejak kemarin, 7 = seminggu); dimuat sekali per sesi per rentang.
const diffReq = {}
export function loadDiff(days = 1) {
  diffReq[days] ||= api.get('/api/diff', { days })
    .then(r => { store.diff[days] = r })
    .catch(e => { store.diff[days] = { error: e.message, items: [] }; diffReq[days] = null })
  return diffReq[days]
}
export const diffOf = (t, days = 1) => (store.diff[days]?.items || []).find(x => x.ticker === t)?.changes || []

export const COMPARE_MAX = 3
export function toggleCompare(t) {
  const c = store.compare
  store.compare = c.includes(t) ? c.filter(x => x !== t) : [...c, t].slice(-COMPARE_MAX)
  ls.set('radar-cangkang.compare', store.compare)
}
