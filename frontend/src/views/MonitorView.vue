<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, markSeen, pandanganOf, autoRefresh, userRefresh, canSync, storyOf, loadStories, getBenchmark, benchmarkDeals } from '../store.js'
import { stageOf, trackIndex, fairGap, num, progressOf, dealOf, posisiOf, scoreOf, statusOf, potensiOf, sessionLabel, SIGNALS, isNewSince } from '../lib/domain.js'
import { nominalRp } from '../lib/analysis.js'
import StageTrack from '../components/StageTrack.vue'
import SikapTag from '../components/SikapTag.vue'
import FairBar from '../components/FairBar.vue'
import CycleChart from '../components/CycleChart.vue'
import Timeline from '../components/monitor/Timeline.vue'
import AgendaBlock from '../components/monitor/AgendaBlock.vue'
import ProgressCells from '../components/monitor/ProgressCells.vue'
import TodayCards from '../components/monitor/TodayCards.vue'
import Modal from '../components/emiten/Modal.vue'
import PotensiCells from '../components/monitor/PotensiCells.vue'
import StoryCells from '../components/monitor/StoryCells.vue'
import NetworkMap from '../components/NetworkMap.vue'
import AuditBox from '../components/monitor/AuditBox.vue'

const TRACK = ['PPJB', 'PTW', 'RUPSLB', 'Injeksi', 'Selesai']
const SIKAP = [['Hindari', 'Hindari'], ['Spekulatif tinggi', 'Spekulatif'], ['Netral', 'Netral'], ['Asimetri positif', 'Asimetri+']]
const STATUS = [['', 'Semua'], ['proses', 'Proses'], ['selesai', 'Selesai']]

const q = ref('')
const stage = ref(-1)
const sikap = ref('')
const deal = ref('')
const special = ref('')

const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

// Tampilan: Hari ini (kartu; bawaan di HP), lalu set kolom tabel Ringkas (bawaan), Progress, Potensi, Story. Diingat di browser; ?set= di URL menang (peta hash lama).
const SETS = [['hari', 'Hari ini'], ['ringkas', 'Ringkas'], ['progress', 'Progress'], ['potensi', 'Potensi'], ['story', 'Story']]
const LS_SET = 'radar-cangkang.monSet'
const route = useRoute(), router = useRouter()
const validSet = v => SETS.some(([id]) => id === v) ? v : null
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches
const set = ref(validSet(route.query.set) || validSet(lsGet(LS_SET, '')) || (narrow() ? 'hari' : 'ringkas'))
watch(() => route.query.set, v => { if (validSet(v)) set.value = v })
// Set Story butuh profil & riwayat pemegang dari Stockbit; loadStories hanya menarik yang belum ada/basi.
watch(() => set.value === 'story' && store.ready, on => { if (on) loadStories() }, { immediate: true })
const box = ref(null)
// Isi tampilan (kartu/tabel) tertutup saat halaman dibuka; muncul setelah salah satu pilihan diklik, dan klik pilihan
// yang sedang aktif menutupnya lagi. ?set= di URL membukanya langsung.
const buka = ref(!!validSet(route.query.set))
function pilihSet(id) {
  if (buka.value && set.value === id) { buka.value = false; return }
  buka.value = true
  setSet(id)
}
function setSet(id) {
  set.value = id
  if (box.value) box.value.scrollLeft = 0
  lsSet(LS_SET, id)
  router.replace({ query: { ...route.query, set: id === 'ringkas' ? undefined : id } })
}

// Saringan injeksi aset: beberapa bisa aktif sekaligus (logika DAN). Pilihan & rentang diingat di browser ini.
const LS_INJ = 'radar-cangkang.progInj'
const saved = lsGet(LS_INJ, {})
const inj = ref(Array.isArray(saved.on) ? saved.on : [])
const ptw = ref(saved.ptw || '')
const pg = ref({ lo: 40, hi: 60, ...saved.pg })
watch([inj, ptw, pg], () => lsSet(LS_INJ, { on: inj.value, ptw: ptw.value, pg: pg.value }), { deep: true })
const today = () => new Date().toISOString().slice(0, 10)
// Status PTW sejak pengendali masuk: belum dibuka, sedang berjalan, atau selesai (dibayar / masa tender lewat).
function ptwOf(item, ms) {
  const t = item.tender || {}
  if (ms.to_selesai || (t.end && t.end.slice(0, 10) < today())) return 'selesai'
  if (ms.to_umum || (t.start && t.start.slice(0, 10) <= today())) return 'sedang'
  return 'belum'
}
// Nilai aset injeksi: data aset terverifikasi, bila kosong dari nominal story.
const asetRp = t => store.aset[t]?.transaksi?.nilaiRp ?? nominalRp(store.verified[t]?.nominal) ?? 0
const INJ = {
  nonHsc: { label: 'Injeksi aset non-HSC', tip: 'Ada data aset injeksi terverifikasi dan bukan saham HSC BEI',
    test: r => !!store.aset[r.t] && !store.hsc.kode.includes(r.t) },
  ctrlIn: { label: 'Pengendali sudah masuk', tip: 'Akuisisi oleh pengendali baru sudah efektif; PTW belum dibuka, sedang berjalan, atau selesai',
    test: r => !!r.prog.ms.akuisisi && !store.pengendali[r.t]?.bukanPengambilAlih && (!ptw.value || r.ptw === ptw.value) },
  big: { label: 'Aset ≥ Rp1 T', tip: 'Nilai aset atau transaksi injeksi minimal Rp1 triliun', test: r => asetRp(r.t) >= 1e12 },
  prog: { label: 'Progress', tip: 'Penyelesaian transaksi (bukan perkiraan) dalam rentang ini',
    test: r => !r.prog.est && r.prog.pct >= pg.value.lo && r.prog.pct <= pg.value.hi },
}
const PTW = [['', 'PTW apa saja'], ['belum', 'PTW belum'], ['sedang', 'PTW berjalan'], ['selesai', 'PTW selesai']]
const passInj = (r, keys = inj.value) => keys.every(k => !INJ[k] || INJ[k].test(r))
function toggleInj(k) { inj.value = inj.value.includes(k) ? inj.value.filter(x => x !== k) : [...inj.value, k] }

// Kondisi khusus (pilih satu), port SPECIAL PR #1.
const SPECIAL = {
  belowPtw: { label: 'Di bawah harga PTW', test: r => { const p = num(r.item.price), t = r.item.tender?.price; return !!(p && t && p < t) } },
  lowFloat: { label: 'Porsi publik < 7,5%', test: r => num(r.item.float) != null && num(r.item.float) < 7.5 },
  uma: { label: 'UMA / anomali volume', test: r => !!(r.item.flags?.uma || r.item.flags?.volume) },
  guess: { label: 'Pengendali belum terverifikasi', test: r => !!r.item.ctrlGuess || num(r.item.ctrlPct) == null },
  highScore: { label: 'Skor ≥ 65', test: r => r.score >= 65 },
}

const fmtChg = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'
const shortDate = iso => new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Laporan terbaru per kode dari feed; cadangan dari sumberTambahan "Judul — Sumber, YYYY-MM-DD".
const latestUpd = computed(() => {
  const m = {}
  for (const u of store.updates) {
    if (!u.ticker || !u.date) continue
    const cur = m[u.ticker]
    if (!cur || u.date > cur.date || (u.date === cur.date && (u.updatedAt || '') > (cur.updatedAt || ''))) m[u.ticker] = u
  }
  return m
})
function lastReport(t) {
  const u = latestUpd.value[t]
  if (u) return { date: u.date.slice(0, 10), title: u.title || '', src: u.source || '', stamp: u.updatedAt || u.date, upd: u }
  let best = null
  for (const s of store.verified[t]?.sumberTambahan || []) {
    if (typeof s !== 'string' || /diakses/i.test(s)) continue
    const m = s.match(/^(.*) — (.*), (\d{4}-\d\d-\d\d)$/)
    if (m && (!best || m[3] > best.date)) best = { date: m[3], title: m[1], src: m[2], stamp: m[3] }
  }
  return best
}

// Benchmark siklus harga: hanya dimuat saat set Potensi dibuka (ditarik dari Stockbit per emiten).
const bm = ref(null), bmLoading = ref(false), bmError = ref('')
const bmDeals = computed(() => benchmarkDeals())
watch([set, bmDeals], async ([s, deals]) => {
  if (s !== 'potensi' || !deals || bmLoading.value) return
  bmLoading.value = true; bmError.value = ''
  try { bm.value = await getBenchmark(deals) } catch (e) { bmError.value = e.message }
  bmLoading.value = false
}, { immediate: true })
const bmByT = computed(() => new Map((bm.value?.deals || []).map(r => [r.ticker, r])))

const all = computed(() => store.items.filter(i => stageOf(i) !== 'radar').map(item => {
  const t = item.ticker
  const ctx = { aset: store.aset, verified: store.verified }
  const prog = progressOf(item, ctx)
  const pa = pandanganOf(t)
  const price = num(item.price) ?? pa?.hargaAcuan ?? null
  const lo = pa?.nilaiWajar?.bawah ?? null, hi = pa?.nilaiWajar?.atas ?? null
  const rep = lastReport(t)
  const score = scoreOf(item)
  const b = bmByT.value.get(t)
  const pp = { price: num(item.price) ?? b?.last ?? null, peak: b?.peak ?? null, ptw: item.tender?.price ?? null, base: b?.base ?? null }
  return { item, t, prog, deal: dealOf(item, prog, ctx), pos: posisiOf(item, prog, ctx), ptw: ptwOf(item, prog.ms), sikap: pa?.sikap || '', price, lo, hi, gap: fairGap(price, lo, hi), ti: trackIndex(item, ctx), rep,
    score, status: statusOf(score), pot: { ...pp, ...potensiOf(pp) },
    isNew: isNewSince(rep?.upd, store.seenAt) }
}))

// Pencarian juga mencakup isi story (bisnis lama/baru, pengendali lama, injeksi).
const searched = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return all.value
  return all.value.filter(r => {
    const st = storyOf(r.t) || {}
    return [r.t, r.item.name, r.item.acquirer, r.item.ctrlName, st.lama, st.baru, st.oldName, st.inject, st.injType, st.injCo]
      .some(v => (v || '').toLowerCase().includes(s))
  })
})

// Semua kelompok saringan digabung (DAN). skip = kelompok yang diabaikan, untuk angka di tombol kelompok itu.
const pass = (r, skip) =>
  (skip === 'deal' || !deal.value || r.deal === deal.value) &&
  (skip === 'stage' || stage.value < 0 || r.ti === stage.value) &&
  (skip === 'sikap' || !sikap.value || r.sikap === sikap.value) &&
  (skip === 'special' || !special.value || SPECIAL[special.value].test(r)) &&
  (skip === 'inj' || passInj(r))
const countBy = (skip, test) => searched.value.filter(r => pass(r, skip) && test(r)).length

const dealPills = computed(() => STATUS.map(([id, label]) => ({ id, label, n: countBy('deal', r => !id || r.deal === id) })))
const stagePills = computed(() => [{ i: -1, label: 'Semua', n: countBy('stage', () => true) },
  ...TRACK.slice(0, -1).map((label, i) => ({ i, label, n: countBy('stage', r => r.ti === i) }))])  // "Selesai" ada di saringan Status
const sikapPills = computed(() => SIKAP.map(([id, label]) => ({ id, label, n: countBy('sikap', r => r.sikap === id) })))
const specialPills = computed(() => Object.entries(SPECIAL).map(([id, f]) => ({ id, label: f.label, n: countBy('special', f.test) })))
// Dasar hitungan tombol injeksi: semua saringan lain aktif, injeksi diabaikan.
const baseInj = computed(() => searched.value.filter(r => pass(r, 'inj')))
// Angka di tombol injeksi = jumlah emiten bila tombol itu ikut digabung dengan pilihan aktif.
const injPills = computed(() => Object.entries(INJ).map(([k, f]) => ({ k, ...f, on: inj.value.includes(k),
  n: baseInj.value.filter(r => passInj(r, [...new Set([...inj.value, k])])).length })))
const ptwPills = computed(() => PTW.map(([id, label]) => ({ id, label,
  n: baseInj.value.filter(r => passInj(r, inj.value.filter(k => k !== 'ctrlIn')) && r.prog.ms.akuisisi && !store.pengendali[r.t]?.bukanPengambilAlih && (!id || r.ptw === id)).length })))
// Emiten yang hanya gagal SATU filter injeksi aktif, beserta alasannya — agar hasil filter bisa diperiksa.
const fmtT = v => v >= 1e12 ? 'Rp' + (v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' T' : 'Rp' + Math.round(v / 1e9).toLocaleString('id-ID') + ' M'
const WHY = {
  nonHsc: r => store.hsc.kode.includes(r.t) ? 'saham HSC' : 'tanpa data injeksi aset',
  ctrlIn: r => store.pengendali[r.t]?.bukanPengambilAlih ? 'bukan pengambilalihan' : !r.prog.ms.akuisisi ? 'akuisisi belum efektif' : 'PTW ' + r.ptw,
  big: r => asetRp(r.t) ? 'aset ' + fmtT(asetRp(r.t)) : 'nilai aset belum diungkap',
  prog: r => r.prog.est ? 'progress masih estimasi' : `progress ${r.prog.pct}%`,
}
const nearMiss = computed(() => inj.value.length < 1 ? [] : baseInj.value
  .map(r => ({ r, fail: inj.value.filter(k => INJ[k] && !INJ[k].test(r)) }))
  .filter(x => x.fail.length === 1)
  .map(({ r, fail }) => ({ t: r.t, why: WHY[fail[0]](r) })))
// Alasan bervariasi (mis. "progress 35%") disatukan per jenis filter supaya kelompoknya tidak pecah.
const nearGroups = computed(() => {
  const m = new Map()
  for (const n of nearMiss.value) {
    const why = /^progress/.test(n.why) ? 'di luar rentang progress' : n.why
    if (!m.has(why)) m.set(why, [])
    m.get(why).push(n.t)
  }
  return [...m].map(([why, t]) => ({ why, t, n: t.length })).sort((a, b) => b.n - a.n)
})
function setPg(k, v) {
  const n = Math.max(0, Math.min(100, Math.round(+v || 0)))
  pg.value = { ...pg.value, [k]: n }
  if (!inj.value.includes('prog')) inj.value = [...inj.value, 'prog']
}

// Kolom per set. k = kunci urut (kosong = tidak bisa diurutkan).
const COLS = {
  ringkas: [{ k: 'ticker', l: 'Kode' }, { k: 'pct', l: 'Tahap', tip: 'PPJB, PTW, RUPSLB, Injeksi, Selesai. Urut menurut persen penyelesaian' }, { l: 'Posisi', cls: 'c-pos' },
    { l: 'Selanjutnya', cls: 'c-next' }, { l: 'Sikap' }, { k: 'chg', l: 'Harga · Δ', cls: 'num', tip: 'Harga terakhir dan perubahan sesi terakhir (%). Vol ×n = volume dibanding rata-rata.' },
    { k: 'gap', l: 'Selisih nilai wajar', cls: 'c-opt', tip: 'Jarak harga dari batas rentang nilai wajar. 0% = di dalam rentang.' }, { k: 'date', l: 'Laporan terakhir', cls: 'wide' }],
  progress: [{ k: 'ticker', l: 'Emiten target' }, { k: 'stage', l: 'Status · tahap' }, { l: 'Jadwal', tl: true }, { k: 'pct', l: 'Penyelesaian' },
    { k: 'score', l: 'Skor · keyakinan' }, { k: 'mcap', l: 'Harga · kap. pasar', cls: 'num' }, { k: 'ctrl', l: 'Pengendali · publik', cls: 'num' }, { l: 'Faktor utama' }],
  potensi: [{ k: 'ticker', l: 'Emiten' }, { k: 'stage', l: 'Tahap' }, { l: 'Jadwal', tl: true }, { k: 'price', l: 'Harga', cls: 'num' }, { k: 'ptwgap', l: 'PTW', cls: 'num' },
    { l: 'Rentang', tip: 'Harga pra-rumor sampai puncak siklus (skala log); garis kuning = PTW, titik = harga kini' },
    { k: 'peak', l: 'Puncak', cls: 'num' }, { k: 'upside', l: 'Naik', cls: 'num', tip: 'Potensi naik ke puncak siklus' },
    { k: 'risk', l: 'Turun', cls: 'num', tip: 'Risiko turun ke harga PTW' }, { l: 'Katalis berikutnya' }],
  story: [{ k: 'ticker', l: 'Emiten' }, { l: 'Bisnis lama ke baru' }, { l: 'Pengendali lama' }, { k: 'ctrl', l: 'Pengendali baru' }, { l: 'Injeksi aset' }, { k: 'pct', l: 'Progress' }],
}
const SORT = {
  ticker: r => r.t, pct: r => r.prog.pct, stage: r => r.ti, score: r => r.score, gap: r => r.gap, date: r => r.rep?.date || null,
  chg: r => num(r.item.chgPct), price: r => r.pot.price, mcap: r => num(r.item.mcap), ctrl: r => num(r.item.ctrlPct),
  ptwgap: r => r.pot.ptw && r.pot.price ? r.pot.price / r.pot.ptw : null, peak: r => r.pot.runupPeak, upside: r => r.pot.up, risk: r => r.pot.down,
}
// Klik judul kolom: urut turun (kode: naik), klik lagi membalik. Tanpa pilihan: proses dulu, persen turun, PTW terbaru.
const sort = ref({ key: '', dir: -1 })
function sortBy(k) { sort.value = { key: k, dir: sort.value.key === k ? -sort.value.dir : (k === 'ticker' ? 1 : -1) } }
const sortOn = computed(() => (COLS[set.value] || []).some(c => c.k && c.k === sort.value.key) ? sort.value : null)
const ariaSort = k => sortOn.value?.key === k ? (sortOn.value.dir > 0 ? 'ascending' : 'descending') : 'none'

const rows = computed(() => {
  const list = searched.value.filter(r => pass(r))
  const s = sortOn.value
  if (!s) return list.sort((a, b) => (b.isNew - a.isNew) || (a.deal === b.deal ? 0 : a.deal === 'proses' ? -1 : 1) || b.prog.pct - a.prog.pct ||
    (b.item.tender?.start || '').localeCompare(a.item.tender?.start || ''))
  const f = SORT[s.key]
  return list.sort((a, b) => {
    const x = f(a), y = f(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * s.dir
  })
})
// Saringan dibuka lewat panel; di halaman hanya tombol Saring + chip saringan aktif (klik = hapus).
const fOpen = ref(false)
const chips = computed(() => {
  const out = []
  if (deal.value) out.push({ key: 'deal', label: STATUS.find(x => x[0] === deal.value)[1], clear: () => { deal.value = '' } })
  if (stage.value >= 0) out.push({ key: 'stage', label: 'Tahap ' + TRACK[stage.value], clear: () => { stage.value = -1 } })
  if (sikap.value) out.push({ key: 'sikap', label: SIKAP.find(x => x[0] === sikap.value)[1], clear: () => { sikap.value = '' } })
  if (special.value) out.push({ key: 'special', label: SPECIAL[special.value].label, clear: () => { special.value = '' } })
  for (const k of inj.value) {
    if (!INJ[k]) continue
    const ptwTxt = k === 'ctrlIn' && ptw.value ? ' · ' + PTW.find(x => x[0] === ptw.value)[1] : ''
    out.push({ key: 'inj-' + k, label: (k === 'prog' ? `Progress ${pg.value.lo}–${pg.value.hi}%` : INJ[k].label) + ptwTxt, clear: () => toggleInj(k) })
  }
  return out
})
function clearFilters() { deal.value = ''; stage.value = -1; sikap.value = ''; special.value = ''; inj.value = []; ptw.value = '' }
const nProses = computed(() => all.value.filter(r => r.deal === 'proses').length)
const countTxt = computed(() => rows.value.length === all.value.length
  ? `${nProses.value} proses · ${all.value.length - nProses.value} selesai` : `${rows.value.length} dari ${all.value.length} emiten`)
const maxCap = computed(() => Math.max(1, ...rows.value.map(r => num(r.item.mcap) || 0)))

// Ringkasan set Potensi: kasus pembanding dan posisi harga kelompok.
const fmtX = v => v == null ? '–' : String(v).replace('.', ',') + '×'
const potSum = computed(() => {
  const withUp = rows.value.filter(r => r.pot.up != null)
  return { n: bm.value?.n || 0, runup: fmtX(bm.value?.runupMedian), post: fmtX(bm.value?.postMedian),
    half: withUp.filter(r => r.pot.up >= 1).length, withUp: withUp.length, below: rows.value.filter(r => r.pot.down != null && r.pot.down > 0).length }
})

const seenTxt = computed(() => {
  if (!store.seenAt) return ''
  const d = new Date(store.seenAt)
  return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')
})
const nNew = computed(() => all.value.filter(r => r.isNew).length)
const agendaNote = computed(() => `${nNew.value ? nNew.value + ' emiten punya laporan baru' : 'Tidak ada laporan baru'} sejak ditandai dilihat ${seenTxt.value}`)

// Tanggal & sesi bursa di kepala halaman, diperbarui tiap menit.
const todayTxt = () => { const n = new Date(); return n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + sessionLabel(n) }
const nowTxt = ref(todayTxt())
let clock
onMounted(() => { clock = setInterval(() => { nowTxt.value = todayTxt() }, 60e3) })
onUnmounted(() => clearInterval(clock))

const syncTitle = computed(() => store.busy.stockbit ? 'Sedang memperbarui'
  : canSync() ? 'Tarik harga, kepemilikan, dan tender terbaru'
  : !store.status ? 'Server belum terhubung' : !store.status.configured ? 'Konfigurasi Stockbit belum diisi' : 'Token Stockbit belum dimuat')

// Grafik siklus baru dimuat saat dibuka: datanya ditarik dari Stockbit per emiten.
const cycOpen = ref(false)
// Peta jaringan juga baru dihitung saat dibuka (tata letak graf).
const netOpen = ref(false)

onMounted(() => autoRefresh('stockbit'))
</script>

<template>
  <div class="mon">
    <header class="head">
      <div class="ttl">
        <h1>Monitor</h1>
        <span class="today small">{{ nowTxt }}</span>
      </div>
      <div class="tools">
        <label for="mq" class="sr-only">Cari emiten</label>
        <input id="mq" v-model="q" data-search type="search" class="field" placeholder="Cari kode, pengendali, atau bisnis">
        <button v-if="!store.status?.readOnly" type="button" class="btn primary" :disabled="store.busy.stockbit || !canSync()" :title="syncTitle" @click="userRefresh('stockbit')">
          {{ store.busy.stockbit ? 'Memperbarui…' : 'Perbarui dari Stockbit' }}
        </button>
      </div>
    </header>

    <AgendaBlock v-if="!buka || set !== 'hari'":note="agendaNote" :can-mark="nNew > 0" @seen="markSeen" />
    <AuditBox />

    <div class="bar-row">
      <div class="fbar">
        <button id="progInj" type="button" class="btn" :aria-expanded="String(fOpen)" aria-haspopup="dialog" @click="fOpen = true">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 2.5h12M3.5 7h7M5.5 11.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          Filter<b v-if="chips.length" class="fcount">{{ chips.length }}</b>
        </button>
        <button v-for="c in chips" :key="c.key" type="button" class="pill chip" :aria-label="'Hapus filter ' + c.label" @click="c.clear()">{{ c.label }} <span aria-hidden="true">×</span></button>
        <button v-if="chips.length > 1" type="button" class="linkbtn small" @click="clearFilters">Hapus semua</button>
      </div>
      <div role="group" aria-label="Tampilan tabel" class="seg">
        <span class="lbl">Tampilan</span>
        <button v-for="[id, label] in SETS" :key="id" type="button" :aria-pressed="String(buka && set === id)" @click="pilihSet(id)">{{ label }}</button>
      </div>
      <span class="muted small" aria-live="polite">{{ countTxt }}</span>
    </div>
    <!-- Nyaris lolos dikelompokkan per alasan; daftar kode dilipat supaya tidak memenuhi halaman. -->
    <details v-if="buka && nearMiss.length" class="near small">
      <summary><b>{{ nearMiss.length }} emiten nyaris lolos</b> <span class="muted">(gagal 1 filter): {{ nearGroups.map(g => g.n + ' ' + g.why).join(', ') }}</span></summary>
      <div v-for="g in nearGroups" :key="g.why" class="ng"><span class="muted">{{ g.why }}:</span>
        <RouterLink v-for="t in g.t" :key="t" class="ticker" :to="'/emiten/' + t">{{ t }}</RouterLink></div>
    </details>

    <p v-if="buka && set === 'potensi'" class="potsum small">
      <template v-if="potSum.n">
        <b>{{ potSum.n }}</b> transaksi pembanding · kenaikan median pra-rumor ke puncak <b>{{ potSum.runup }}</b>
        · harga kini terhadap saat PTW <b>{{ potSum.post }}</b> (median)
        · turun 50% atau lebih dari puncak: <b>{{ potSum.half }} dari {{ potSum.withUp }}</b>
        · di bawah harga PTW: <b>{{ potSum.below }} saham</b>
      </template>
      <span v-else-if="bmLoading" class="muted">Data siklus harga: menghitung dari Stockbit…</span>
      <span v-else class="muted">Data siklus harga belum tersedia{{ bmError ? ': ' + bmError : '' }}. Butuh server dengan token Stockbit aktif.</span>
    </p>

    <p v-if="!buka" class="muted small tutup">Pilih Hari ini, Ringkas, Progress, Potensi, atau Story untuk menampilkan daftar emiten.</p>
    <TodayCards v-else-if="set === 'hari'" :rows="rows" />
    <section v-else id="progTable" ref="box" aria-label="Daftar emiten" class="sheet box">
      <table class="ledger" :class="'set-' + set">
        <thead><tr>
          <th v-for="(c, i) in COLS[set]" :key="set + i" class="lbl" :class="[c.cls, { tlh: c.tl }]" :title="c.tip" :aria-sort="c.k ? ariaSort(c.k) : undefined">
            <button v-if="c.k" type="button" class="sortb" :class="sortOn?.key === c.k ? (sortOn.dir > 0 ? 'asc' : 'desc') : ''" @click="sortBy(c.k)">{{ c.l }}</button>
            <template v-else>{{ c.l }}</template>
            <Timeline v-if="c.tl" head />
          </th>
        </tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.t">
            <template v-if="set === 'ringkas'">
              <td><RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink>
                <!-- Masuk otomatis dari Kandidat: "rencana" = pengambilalihan diumumkan, belum terkonfirmasi KSEI. -->
                <span v-if="r.item.auto" class="tag" :class="r.item.autoJenis === 'rencana' ? 't-warn' : 't-calm'" :title="r.item.notes">{{ r.item.autoJenis === 'rencana' ? 'rencana' : 'otomatis' }}</span></td>
              <td>
                <StageTrack :item="r.item" />
                <span class="pct small" :title="r.prog.est ? 'Perkiraan dari tahap; tahapan belum terisi' : 'Penyelesaian transaksi'">{{ r.prog.est ? '±' : '' }}{{ r.prog.pct }}%</span>
              </td>
              <td class="pos c-pos">
                <span v-if="r.deal === 'selesai'" class="tag done">Selesai</span>
                <span class="clamp">{{ r.pos.now }}</span>
              </td>
              <td class="nx c-next"><span class="clamp" :title="r.pos.next">{{ r.pos.next || '–' }}</span></td>
              <td><SikapTag :sikap="r.sikap" short /></td>
              <td class="num">
                <span class="price">{{ r.price != null ? r.price.toLocaleString('id-ID') : '–' }}</span>
                <span v-if="num(r.item.chgPct) != null" class="chg" :class="r.item.chgPct > 0 ? 'up' : r.item.chgPct < 0 ? 'dn' : ''">{{ fmtChg(r.item.chgPct) }}</span>
                <span v-if="r.item.volRatio >= 3" class="vol" :title="'Volume ' + r.item.volRatio + '× rata-rata'">vol {{ String(r.item.volRatio).replace('.', ',') }}×</span>
              </td>
              <td class="c-opt"><FairBar :price="r.price" :lo="r.lo" :hi="r.hi" /></td>
              <td class="rp">
                <div v-if="r.rep" class="rep">
                  <span class="dd" :class="{ now: r.isNew }">{{ shortDate(r.rep.date) }}</span>
                  <span class="ev">{{ r.rep.title }} <span v-if="r.rep.src" class="muted small">· {{ r.rep.src }}</span></span>
                </div>
                <span v-else class="muted small">belum ada</span>
              </td>
            </template>
            <ProgressCells v-else-if="set === 'progress'" :r="r" :max-cap="maxCap" />
            <PotensiCells v-else-if="set === 'potensi'" :r="r" />
            <StoryCells v-else :r="r" />
          </tr>
          <tr v-if="!rows.length"><td :colspan="COLS[set].length" class="muted empty">Tidak ada emiten yang cocok dengan filter ini.</td></tr>
        </tbody>
      </table>
    </section>
    <details id="cycleBox" class="sheet cyc" @toggle="cycOpen = cycOpen || $event.target.open">
      <summary><h2>Siklus saham backdoor</h2></summary>
      <CycleChart v-if="cycOpen" :items="store.items" />
    </details>
    <details id="netBox" class="sheet cyc" @toggle="netOpen = netOpen || $event.target.open">
      <summary><h2>Peta jaringan pengendali</h2></summary>
      <NetworkMap v-if="netOpen" :heading="false" />
    </details>
    <p v-if="buka && set === 'ringkas'" class="muted foot">Persen di kolom Tahap = penyelesaian transaksi (± = perkiraan dari tahap). Bar hijau = rentang nilai wajar dari pandangan analis, garis hitam = harga. Selisih merah = di atas batas atas, hijau = di bawah batas bawah, 0% = di dalam rentang. Tanggal oranye = laporan baru sejak ditandai dilihat; baris itu naik ke atas. Δ = perubahan harga sesi terakhir.</p>
    <details class="sheet cyc method">
      <summary><h2>Metodologi skor</h2></summary>
      <p class="muted small">Skor penyaringan = jumlah bobot faktor yang terpenuhi, total 100. Faktor otomatis dihitung dari data pasar.</p>
      <ul class="weights">
        <!-- Satu <span> per butir: li memakai grid 2 kolom (bobot | teks). -->
        <li v-for="s in SIGNALS" :key="s.id"><span class="w">+{{ s.w }}</span><span>{{ s.label }}<span v-if="s.auto" class="tag t-calm auto">otomatis</span></span></li>
      </ul>
      <div class="levels" role="list" aria-label="Tingkat keyakinan">
        <span class="lbl">Tingkat keyakinan</span>
        <span role="listitem" class="tag st-calm">Pemantauan · di bawah 35</span>
        <span role="listitem" class="tag st-warn">Daftar pantau · 35–64</span>
        <span role="listitem" class="tag st-strong">Keyakinan tinggi · 65 ke atas</span>
      </div>
    </details>
    <Modal v-if="fOpen" labelledby="fT" close-label="Tutup filter" @close="fOpen = false">
      <template #title><h2 id="fT" class="ftitle">Filter emiten</h2></template>
      <p class="small muted fnote">Angka di tiap pilihan = jumlah hasil bila pilihan itu dipakai, dengan filter lain tetap. Pilihan Injeksi bisa digabung.</p>
      <div class="fgroups">
        <div role="group" aria-label="Filter status transaksi" class="grp">
          <span class="lbl">Status</span>
          <button v-for="p in dealPills" :key="p.id" type="button" class="pill" :aria-pressed="String(deal === p.id)" :disabled="!p.n && deal !== p.id" @click="deal = p.id">{{ p.label }}<b>{{ p.n }}</b></button>
        </div>
        <div role="group" aria-label="Filter tahap" class="grp">
          <span class="lbl">Tahap</span>
          <button v-for="p in stagePills" :key="p.i" type="button" class="pill" :aria-pressed="String(stage === p.i)" :disabled="!p.n && stage !== p.i" @click="stage = p.i">{{ p.label }}<b>{{ p.n }}</b></button>
        </div>
        <div role="group" aria-label="Filter sikap" class="grp">
          <span class="lbl">Sikap</span>
          <button v-for="p in sikapPills" :key="p.id" type="button" class="pill" :aria-pressed="String(sikap === p.id)" :disabled="!p.n && sikap !== p.id" @click="sikap = sikap === p.id ? '' : p.id">{{ p.label }}<b>{{ p.n }}</b></button>
        </div>
        <div role="group" aria-label="Filter kondisi khusus" class="grp">
          <span class="lbl">Khusus</span>
          <button v-for="p in specialPills" :key="p.id" type="button" class="pill" :aria-pressed="String(special === p.id)" :disabled="!p.n && special !== p.id" @click="special = special === p.id ? '' : p.id">{{ p.label }}<b>{{ p.n }}</b></button>
        </div>
        <div role="group" aria-label="Filter injeksi aset, bisa digabung" class="grp">
          <span class="lbl">Injeksi</span>
          <button type="button" class="pill" :aria-pressed="String(!inj.length)" @click="inj = []">Semua<b>{{ baseInj.length }}</b></button>
          <template v-for="p in injPills" :key="p.k">
            <button type="button" class="pill" :aria-pressed="String(p.on)" :title="p.tip" :disabled="!p.n && !p.on" @click="toggleInj(p.k)">
              {{ p.k === 'prog' ? `Progress ${pg.lo}–${pg.hi}%` : p.label }}<b>{{ p.n }}</b>
            </button>
            <span v-if="p.k === 'ctrlIn' && p.on" class="sub" role="group" aria-label="Status PTW">
              <button v-for="o in ptwPills" :key="o.id" type="button" class="pill sm" :aria-pressed="String(ptw === o.id)" @click="ptw = o.id">{{ o.label }}<b>{{ o.n }}</b></button>
            </span>
            <span v-if="p.k === 'prog'" class="range">
              <label for="pglo" class="sr-only">Progress minimum (%)</label>
              <input id="pglo" class="field" type="number" min="0" max="100" step="5" :value="pg.lo" @change="setPg('lo', $event.target.value)">
              <span class="muted">–</span>
              <label for="pghi" class="sr-only">Progress maksimum (%)</label>
              <input id="pghi" class="field" type="number" min="0" max="100" step="5" :value="pg.hi" @change="setPg('hi', $event.target.value)">
              <span class="muted small">%</span>
            </span>
          </template>
        </div>
      </div>
      <div class="ffoot">
        <button type="button" class="btn" :disabled="!chips.length" @click="clearFilters">Hapus semua</button>
        <button type="button" class="btn primary" @click="fOpen = false">Tampilkan {{ rows.length }} emiten</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.mon{display:flex;flex-direction:column;gap:14px}
.near{margin:-6px 0 0;padding:6px 10px;border-left:3px solid var(--warn);background:var(--warn-bg);line-height:1.7}
.near summary{cursor:pointer}
.ng{margin-top:4px}
.ng .ticker{font-size:14px;margin-left:8px}
.head{display:flex;flex-wrap:wrap;gap:10px 24px;align-items:flex-end;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid var(--ink)}
.ttl{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px}
.today{color:var(--ink-2)}
.tools{display:flex;flex-wrap:wrap;gap:8px}
.tools .field{width:240px;max-width:100%}
.now{color:var(--now-ink)}
.grp{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.grp .lbl{margin-right:2px}
.box{overflow:auto;max-height:72vh}
.num{text-align:right}
.wide{width:24%}
.sub,.range{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}
.pill.sm{min-height:26px;font-size:12.5px;padding:2px 8px}
.range .field{width:64px;min-height:30px;padding:0 6px}
.pct{display:block;margin-top:2px;color:var(--ink-2);font-family:var(--f-display);font-weight:600}
.pos,.nx{min-width:140px;max-width:240px;font-size:13px}
.nx{color:var(--ink-2)}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden}
.done{background:var(--accent);color:var(--accent-ink);margin-bottom:2px}
.cyc{padding:0 16px}
.cyc summary{cursor:pointer;padding:12px 0;list-style-position:inside}
.cyc summary h2{display:inline;font-size:19px}
.cyc[open] summary{border-bottom:1px solid var(--rule-2);margin-bottom:12px}
@media (max-width:1199px){.c-opt{display:none}}
@media (max-width:1399px){.c-next{display:none}}
@media (max-width:760px){.pos{min-width:130px}}
.price{display:block;font:700 16px var(--f-display)}
.chg{display:block;font:600 12.5px var(--f-display);color:var(--ink-2)}
.chg.up{color:var(--good)}.chg.dn{color:var(--strong)}
.vol{display:inline-block;margin-top:2px;padding:0 4px;border-radius:2px;background:var(--now-bg);color:var(--now-ink);font:700 11.5px var(--f-display)}
@media (max-width:640px){.c-pos{display:none}}
.rep{display:flex;gap:10px;align-items:baseline}
.dd{flex:none;width:46px;font:700 15px var(--f-display);color:var(--ink-2)}
.dd.now{color:var(--now-ink)}
.rp{min-width:240px}  /* judul laporan maks. 2 baris, sama dengan kolom Selanjutnya */
.rep{min-width:0}
.ev{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;min-width:0}
.empty{padding:14px}
.foot{margin:0;font-size:12px}
.bar-row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
/* Kontrol segmen: tombol bersebelahan, satu aktif. */
.seg{display:flex;flex-wrap:wrap;align-items:center;gap:0}
.seg .lbl{margin-right:8px}
.seg button{min-height:32px;padding:0 14px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-weight:600;font-size:13.5px;cursor:pointer;margin-left:-1px}
.seg button:first-of-type{border-radius:3px 0 0 3px;margin-left:0}
.seg button:last-of-type{border-radius:0 3px 3px 0}
.seg button:hover{border-color:var(--ink);position:relative}
.seg button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper);position:relative}
.potsum{margin:0;padding:8px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);color:var(--ink-2)}
.potsum b{color:var(--ink);font-weight:600}
/* Set lebar menggeser horizontal di dalam kotaknya. */
.set-progress{min-width:1360px}
.set-potensi{min-width:1300px}
.set-story{min-width:1100px}
.ledger:not(.set-ringkas) :deep(td){vertical-align:top}
.tlh{min-width:220px}
.method ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:4px;max-width:80ch}
.method li{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:baseline;padding:4px 0;border-bottom:1px solid var(--rule-2)}
.method .auto{margin-left:8px}
.method .levels{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.method .w{font:700 15px var(--f-display);text-align:right}
.method p{margin:0 0 8px}
@media (max-width:640px){
  .box :deep(tbody td:first-child),.box thead th:first-child{position:sticky;left:0;z-index:1;background:var(--sheet)}
  .box thead th:first-child{z-index:2;background:var(--sheet-2)}
  .box :deep(tbody tr:nth-child(even) td:first-child){background:var(--zebra)}
  .box :deep(tbody tr:hover td:first-child){background:var(--accent-soft)}
  .box :deep(td.em){min-width:0;width:112px;max-width:112px}
  .box :deep(td.em .nm){max-width:96px}
}
</style>
