<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { store, autoRefresh, userRefresh, markSeen } from '../store.js'
import { UTYPES, fmtDate, isNewSince } from '../lib/domain.js'
import { isBackdoorNews } from '../lib/news.js'
import Modal from '../components/emiten/Modal.vue'
import NewsItem from '../components/NewsItem.vue'
import TabBerita from '../components/emiten/TabBerita.vue'
import LaporanStockbit from '../components/LaporanStockbit.vue'
import { api } from '../api.js'

const typeName = id => (UTYPES.find(t => t.id === id) || UTYPES[UTYPES.length - 1]).name
// Sumber dari prefiks id: "sb-report-" = Stockbit Reports, "sb-news-" = StockbitNews, "news-" = media.
const srcOf = u => /^sb-report-/.test(u.id) ? 'stockbit' : /^(news-|sb-news-)/.test(u.id) ? 'media' : ''

const type = ref('')
// Mode tampilan: semua berita (urut tanggal) atau Stockbit Reports per emiten (laporan terakhir + analisa).
const mode = ref('semua')
const src = ref('')
const q = ref('')
// Saham di luar radar (seluruh kode BEI, /api/kode-bei): dipilih dari saran pencarian lalu ditampilkan di halaman ini
// dengan format yang sama seperti tab Berita emiten (analisa berita terbaru + PDF + daftar berita). Tidak masuk radar.
const kodeBei = ref(null), pilih = ref('')
watch(q, v => {
  if (v.trim() && kodeBei.value === null) {
    kodeBei.value = []
    api.get('/api/kode-bei').then(r => { kodeBei.value = r.kode || [] }, () => { kodeBei.value = [] })
  }
})
const luarRadar = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (s.length < 2 || !kodeBei.value) return []
  const radar = new Set(store.items.map(i => i.ticker))
  const cocok = kodeBei.value.filter(k => !radar.has(k.t) && (k.t.toLowerCase().startsWith(s) || (s.length >= 3 && (k.nama || '').toLowerCase().includes(s))))
  return cocok.sort((a, b) => (b.t.toLowerCase() === s) - (a.t.toLowerCase() === s) || a.t.localeCompare(b.t)).slice(0, 8)
})
const namaPilih = computed(() => (kodeBei.value || []).find(k => k.t === pilih.value)?.nama || '')

const feed = computed(() => store.updates.filter(u => isBackdoorNews(u, store.items)))
// Angka jenis mengikuti saringan sumber yang aktif (dan sebaliknya di srcs).
const bySrc = computed(() => feed.value.filter(u => !src.value || srcOf(u) === src.value))
const types = computed(() => [{ id: '', name: 'Semua', n: bySrc.value.length },
  ...UTYPES.map(t => ({ ...t, n: bySrc.value.filter(u => u.type === t.id).length })).filter(t => t.n || t.id === type.value)])

const SRC = [['', 'Semua sumber'], ['stockbit', 'Stockbit Reports'], ['media', 'Media']]
const srcs = computed(() => SRC.map(([id, name]) => ({ id, name,
  n: feed.value.filter(u => (!id || srcOf(u) === id) && (!type.value || u.type === type.value)).length })))
// Saringan di panel; di halaman hanya tombol Saring + chip aktif (klik = hapus).
const fOpen = ref(false)
const chips = computed(() => [
  type.value && { key: 'type', label: typeName(type.value), clear: () => { type.value = '' } },
  src.value && { key: 'src', label: SRC.find(x => x[0] === src.value)[1], clear: () => { src.value = '' } },
].filter(Boolean))
function clearFilters() { type.value = ''; src.value = '' }

const nameOf = computed(() => new Map(store.items.map(i => [i.ticker, i.name || ''])))
// Pencarian: kode, nama emiten, judul, ringkasan, atau nama sumber.
const hay = u => [u.ticker, nameOf.value.get(u.ticker), u.title, u.summary, u.source].join(' ').toLowerCase()

const list = computed(() => {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return feed.value
    .filter(u => (!type.value || u.type === type.value) && (!src.value || srcOf(u) === src.value) && words.every(w => hay(u).includes(w)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 200)
})

const groups = computed(() => {
  const out = []
  for (const u of list.value) {
    const d = (u.date || '').slice(0, 10)
    let g = out[out.length - 1]
    if (!g || g.d !== d) out.push(g = { d, label: d ? fmtDate(d) : 'Tanpa tanggal', rows: [] })
    g.rows.push(u)
  }
  return out
})

const nFresh = computed(() => feed.value.filter(u => isNewSince(u, store.seenAt)).length)
const canRefresh = computed(() => !!(store.status?.reports || store.status?.news))
onMounted(() => autoRefresh('reports'))
</script>

<template>
  <div class="ber">
    <header class="head">
      <div>
        <h1>Berita</h1>
        <p class="muted small sub">Stockbit Reports dan media, hanya emiten di radar atau judul yang cocok kata kunci backdoor.</p>
      </div>
      <div class="tools">
        <label for="nq" class="sr-only">Cari berita</label>
        <input id="nq" v-model="q" data-search type="search" class="field" placeholder="Cari kode, nama, atau judul (termasuk saham di luar radar)">
        <button v-if="!store.status?.readOnly" type="button" class="btn primary" :disabled="store.busy.reports || !canRefresh"
          :title="canRefresh ? 'Tarik laporan dan berita terbaru' : 'Sumber laporan dan berita belum aktif di server'" @click="userRefresh('reports')">
          {{ store.busy.reports ? 'Memperbarui…' : 'Perbarui berita' }}
        </button>
      </div>
    </header>

    <div role="group" aria-label="Mode berita" class="mode">
      <button type="button" class="pill" :aria-pressed="String(mode === 'semua')" @click="mode = 'semua'">Semua berita</button>
      <button type="button" class="pill" :aria-pressed="String(mode === 'laporan')" @click="mode = 'laporan'">Stockbit Reports per emiten</button>
    </div>

    <div v-if="luarRadar.length" class="luar" role="region" aria-label="Saham di luar radar">
      <span class="lbl">Di luar radar — lihat berita terakhir & analisa:</span>
      <button v-for="k in luarRadar" :key="k.t" type="button" class="sar" :class="{ on: pilih === k.t }" :title="k.nama" @click="pilih = k.t">
        <b>{{ k.t }}</b><span v-if="k.nama">{{ k.nama.replace(/ Tbk\.?$/i, '') }}</span></button>
    </div>

    <section v-if="pilih" class="luarpanel">
      <div class="lh"><h2>{{ pilih }}<span v-if="namaPilih" class="muted"> · {{ namaPilih }}</span></h2>
        <button type="button" class="btn" @click="pilih = ''">Tutup</button></div>
      <TabBerita :key="pilih" :ticker="pilih" />
    </section>

    <LaporanStockbit v-if="mode === 'laporan'" :q="q" />
    <template v-else>
    <div class="bar-row">
      <div class="fbar">
        <button type="button" class="btn" :aria-expanded="String(fOpen)" aria-haspopup="dialog" @click="fOpen = true">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 2.5h12M3.5 7h7M5.5 11.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          Filter<b v-if="chips.length" class="fcount">{{ chips.length }}</b>
        </button>
        <button v-for="c in chips" :key="c.key" type="button" class="pill chip" :aria-label="'Hapus filter ' + c.label" @click="c.clear()">{{ c.label }} <span aria-hidden="true">×</span></button>
        <button v-if="chips.length > 1" type="button" class="linkbtn small" @click="clearFilters">Hapus semua</button>
      </div>
      <span v-if="feed.length" class="muted small" aria-live="polite">{{ list.length }} pengumuman<template v-if="nFresh"> · {{ nFresh }} baru
        <button type="button" class="linkbtn small" @click="markSeen">Tandai sudah dilihat</button></template></span>
    </div>

    <Modal v-if="fOpen" labelledby="nfT" close-label="Tutup filter" @close="fOpen = false">
      <template #title><h2 id="nfT" class="ftitle">Filter berita</h2></template>
      <p class="small muted fnote">Angka di tiap pilihan = jumlah pengumuman bila pilihan itu dipakai, dengan filter lain tetap.</p>
      <div class="fgroups">
        <div role="group" aria-label="Filter jenis" class="grp">
          <span class="lbl">Jenis</span>
          <button v-for="t in types" :key="t.id" type="button" class="pill" :aria-pressed="String(type === t.id)" @click="type = t.id">{{ t.name }}<b>{{ t.n }}</b></button>
        </div>
        <div role="group" aria-label="Filter sumber" class="grp">
          <span class="lbl">Sumber</span>
          <button v-for="o in srcs" :key="o.id" type="button" class="pill" :aria-pressed="String(src === o.id)" :disabled="!o.n && src !== o.id" @click="src = o.id">{{ o.name }}<b>{{ o.n }}</b></button>
        </div>
      </div>
      <div class="ffoot">
        <button type="button" class="btn" :disabled="!chips.length" @click="clearFilters">Hapus semua</button>
        <button type="button" class="btn primary" @click="fOpen = false">Tampilkan {{ list.length }} pengumuman</button>
      </div>
    </Modal>

    <section aria-label="Daftar berita" class="sheet list">
      <p v-if="!feed.length" class="muted empty">Belum ada berita. Tekan Perbarui berita untuk menarik laporan Stockbit dan media.</p>
      <p v-else-if="!list.length" class="muted empty">Tidak ada berita yang cocok<template v-if="q.trim()"> dengan “{{ q.trim() }}”</template>. Ubah kata kunci atau filter.</p>
      <div v-for="g in groups" :key="g.d">
        <h2 class="lbl gd">{{ g.label }}</h2>
        <NewsItem v-for="u in g.rows" :key="u.id" :u="u" />
      </div>
    </section>
    <p class="muted foot">Latar oranye = belum dilihat sejak terakhir buka. Tingkat sinyal, arah dampak, dan poin dibaca otomatis dari judul dan ringkasan. Penanda poin: segitiga naik hijau = positif bagi pemegang saham publik, segitiga turun merah = negatif atau risiko, bulat kuning = perlu dicermati.</p>
    </template>
  </div>
</template>

<style scoped>
.mode{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}
.luar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 12px}
.luar .lbl{font-size:14px;color:var(--ink-2);width:100%}
/* Saran pencarian dibuat besar dan kontras agar mudah dibaca dan diklik. */
.sar{display:inline-flex;align-items:baseline;gap:8px;padding:8px 14px;border:1px solid var(--rule);border-left:4px solid var(--now-ink);
  border-radius:8px;background:var(--sheet);color:var(--ink);font:inherit;font-size:15px;cursor:pointer}
.sar b{font-size:16px;letter-spacing:.02em}.sar span{color:var(--ink-2);font-size:14px}
.sar:hover,.sar:focus-visible,.sar.on{border-color:var(--now-ink)}
.luarpanel{border:1px solid var(--rule);border-left:4px solid var(--now-ink);background:var(--sheet);padding:10px 14px;margin:0 0 14px}
.lh{display:flex;justify-content:space-between;align-items:center;gap:10px}.lh h2{margin:4px 0}
.ber{display:flex;flex-direction:column;gap:14px}
.head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.sub{margin:2px 0 0}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tools input{width:220px;max-width:100%}
.bar-row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
.list{border-radius:4px}
.empty{margin:0;padding:14px 16px}
.gd{margin:0;padding:10px 16px 6px;background:var(--sheet-2);border-bottom:1px solid var(--rule-2);font-family:var(--f-display);font-size:12.5px}
.foot{margin:0;font-size:12px}
</style>
