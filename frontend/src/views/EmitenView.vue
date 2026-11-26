<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, itemOf, pandanganOf, storyOf, autoRefresh, loadStories, toggleCompare } from '../store.js'
import { fmtDate, rp, scoreOf, statusOf, STATUS_LABEL, tglHargaAcuan } from '../lib/domain.js'
import SikapTag from '../components/SikapTag.vue'
import StageTrack from '../components/StageTrack.vue'
import OwnershipFlow from '../components/OwnershipFlow.vue'
import TabRingkasan from '../components/emiten/TabRingkasan.vue'
import TabStory from '../components/emiten/TabStory.vue'
import TabAset from '../components/emiten/TabAset.vue'
import PembaruanBanner from '../components/emiten/PembaruanBanner.vue'
import TabAnalisa from '../components/emiten/TabAnalisa.vue'
import TabTeknikal from '../components/emiten/TabTeknikal.vue'
import TabSpekulasi from '../components/emiten/TabSpekulasi.vue'
import TabProfil from '../components/emiten/TabProfil.vue'
import TabBerita from '../components/emiten/TabBerita.vue'
import TabIntel from '../components/emiten/TabIntel.vue'
import TabDownload from '../components/emiten/TabDownload.vue'
import TabInsider from '../components/emiten/TabInsider.vue'
import TabVideo from '../components/emiten/TabVideo.vue'
import TabSlides from '../components/emiten/TabSlides.vue'
import { SLIDE_TABS } from '../lib/slideTabs.js'
import { api } from '../api.js'

const props = defineProps({ ticker: { type: String, required: true } })
// Tampilan tab: 'slide' (ringkas interaktif) atau 'lengkap' (teks penuh); pilihan diingat per perangkat.
const view = ref((() => { try { return localStorage.getItem('emitenView') || 'slide' } catch { return 'slide' } })())
watch(view, v => { try { localStorage.setItem('emitenView', v) } catch { /* penyimpanan tidak tersedia */ } })
const slideOn = computed(() => view.value === 'slide' && SLIDE_TABS.includes(tab.value) && known.value)
const route = useRoute()
const router = useRouter()

const TABS = [
  // Urutan alur analisa: gambaran umum → perusahaan → pengendali → pergerakan → berita → nilai → waktu masuk
  // → spekulasi → data pasar; Video dan Download merangkum semuanya (urutan presentasi mengikuti daftar ini).
  { id: 'ringkasan', name: 'Ringkasan' },
  { id: 'profil', name: 'Profil' },
  { id: 'story', name: 'Story & Pengendali' },
  { id: 'aset', name: 'Aset' },
  { id: 'insider', name: 'Insider Activity' },
  { id: 'berita', name: 'Berita' },
  { id: 'analisa', name: 'Analisa' },
  { id: 'teknikal', name: 'Teknikal' },
  { id: 'spekulasi', name: 'Spekulasi' },
  { id: 'intel', name: 'Intel Pasar' },
  { id: 'video', name: 'Video' },
  { id: 'download', name: 'Download' },
]

const T = computed(() => props.ticker.toUpperCase())
const item = computed(() => itemOf(T.value))
const pv = computed(() => pandanganOf(T.value))
const story = computed(() => storyOf(T.value))
const known = computed(() => !!(item.value || pv.value || store.verified[T.value]))
// Kode di luar radar tetap bisa dianalisa selama formatnya kode saham BEI (4 huruf).
const valid = computed(() => /^[A-Z]{4}$/.test(T.value))
// Tab yang hanya berisi data radar/story; untuk kode bebas ditulis "belum ada".
const RADAR_ONLY = ['ringkasan', 'story']

// Saham di luar radar (hasil pencarian) hanya menampilkan berita terakhir dan analisanya.
const TABS_TAMPIL = computed(() => known.value ? TABS : TABS.filter(t => t.id === 'berita'))
const tab = computed(() => TABS_TAMPIL.value.some(t => t.id === route.query.tab) ? route.query.tab : known.value ? 'ringkasan' : 'berita')
function pick(id) { router.replace({ query: { ...route.query, tab: id } }) }

// Panah kiri/kanan, Home/End di daftar tab (pola tab WAI-ARIA, aktivasi otomatis).
const tabEls = ref([])
function onTabKey(e, i) {
  const n = TABS_TAMPIL.value.length
  const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
  if (j === undefined) return
  e.preventDefault()
  pick(TABS_TAMPIL.value[j].id)
  nextTick(() => tabEls.value[j]?.focus())
}

const dm = iso => new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const tenderUntil = computed(() => {
  const end = item.value?.tender?.end
  return end && end.slice(0, 10) >= new Date().toISOString().slice(0, 10) ? 's.d. ' + dm(end) : ''
})

const lama = computed(() => story.value?.lama || '')
const baru = computed(() => story.value?.baru || store.verified[T.value]?.baru || '')

// Emiten tanpa harga tersimpan (kandidat baru, kode bebas, atau versi publik yang tidak menyinkronkan):
// ambil harga terakhir langsung dari Stockbit untuk ditampilkan saja, tanpa menyimpan.
const live = ref(null)
watch(T, async t => {
  live.value = null
  if (item.value?.price != null) return
  try { const q = await api.get('/api/quote', { ticker: t }); if (t === T.value && q?.price != null) live.value = q } catch {}
}, { immediate: true })
const price = computed(() => item.value?.price ?? live.value?.price ?? pv.value?.hargaAcuan ?? null)
const priceNote = computed(() => {
  const it = item.value, p = pv.value
  if (it?.price == null && live.value?.price != null) {
    const c = live.value.pctChange
    return 'harga terakhir Stockbit' + (c != null ? ` · ${c > 0 ? '+' : ''}${String(c).replace('.', ',')}%` : '')
  }
  if (it?.price != null) {
    const at = it.updatedAt ? new Date(it.updatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const ref = p?.hargaAcuan != null && p.hargaAcuan !== it.price ? ` · acuan analisa ${rp(p.hargaAcuan)} (${fmtDate(tglHargaAcuan(p))})` : ''
    return `harga radar${at ? ', diperbarui ' + at : ''}${ref}`
  }
  return p?.hargaAcuan != null ? `harga acuan analisa ${fmtDate(tglHargaAcuan(p))}` : 'belum ada harga'
})

const score = computed(() => item.value ? scoreOf(item.value) : null)

// Riwayat kode yang pernah dianalisa (maks. 8, terbaru di depan), per browser.
const RECENT_KEY = 'radar-cangkang.anRecent'
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => /^[A-Z]{4}$/.test(x)) : [] } catch { return [] } }
const recent = ref(readRecent())
watch(() => [T.value, tab.value], ([t, tb]) => {
  if (tb !== 'analisa' || !valid.value) return
  recent.value = [t, ...readRecent().filter(x => x !== t)].slice(0, 8)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)) } catch {}
}, { immediate: true })

const flow = ref(false)
const flowFocus = ref(null)
function openFlow(focus = null) { flowFocus.value = focus; flow.value = true }
// Panel ditutup saat pindah emiten atau tab (lewat URL), supaya tidak menutupi konten baru.
watch(() => [route.params.ticker, route.query.tab, route.query.flow], () => { flow.value = !!route.query.flow })

onMounted(() => {
  autoRefresh('reports'); loadStories([props.ticker]).catch(() => {})
  // ?flow=1 (mis. dari panel Pembaruan) langsung membuka panel Alur saham.
  if (route.query.flow) openFlow()
})
watch(() => props.ticker, t => loadStories([t]).catch(() => {}))
</script>

<template>
  <div class="em">
    <RouterLink to="/" class="back">‹ Monitor</RouterLink>

    <section v-if="!valid && !known" class="empty rule-top">
      <h1>{{ T }}</h1>
      <p>{{ T }} bukan kode saham BEI. Kode saham terdiri dari 4 huruf, misalnya BBCA.</p>
      <RouterLink to="/">Kembali ke Monitor</RouterLink>
    </section>

    <template v-else>
      <header class="hd">
        <div class="id">
          <div class="line1">
            <h1 class="tk">{{ T }}</h1>
            <SikapTag :sikap="pv?.sikap" />
            <span v-if="score != null" class="tag score" :class="'st-' + statusOf(score)">Skor {{ score }} · {{ STATUS_LABEL[statusOf(score)] }}</span>
            <span v-if="!known" class="tag t-calm">di luar radar</span>
            <span v-if="item" class="stage"><StageTrack :item="item" /><span v-if="tenderUntil" class="tag t-now">{{ tenderUntil }}</span></span>
          </div>
          <p class="nm">
            <span v-if="item?.name">{{ item.name }}</span>
            <span v-if="lama || baru" class="biz">
              {{ lama || 'usaha lama belum ada' }}
              <svg width="16" height="10" viewBox="0 0 16 10" aria-label="menjadi" role="img"><path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
              {{ baru || 'usaha baru belum ada' }}
            </span>
          </p>
        </div>
        <div class="right">
          <button v-if="item" type="button" class="btn" :aria-pressed="String(store.compare.includes(T))" @click="toggleCompare(T)">
            {{ store.compare.includes(T) ? '✓ Dibandingkan' : '+ Bandingkan' }}
          </button>
          <button type="button" class="btn primary" aria-haspopup="dialog" @click="openFlow()">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="4" cy="4" r="2.2" /><circle cx="14" cy="4" r="2.2" /><circle cx="9" cy="14" r="2.2" /><path d="M5.5 5.6 8 12M12.5 5.6 10 12" /></svg>
            Alur saham
          </button>
          <div class="px">
            <div class="pv">{{ price != null ? rp(price) : 'belum ada' }}</div>
            <div class="small muted">{{ priceNote }}</div>
          </div>
        </div>
      </header>
      <div class="recent">
        <nav v-if="recent.length" class="chips" aria-label="Riwayat analisa">
          <RouterLink v-for="t in recent" :key="t" class="chip" :class="{ on: t === T }" :aria-current="t === T ? 'page' : undefined"
            :to="{ path: '/emiten/' + t, query: { tab: 'analisa' } }">{{ t }}</RouterLink>
        </nav>
      </div>

      <!-- Laporan Stockbit baru sejak analisa/riset kurasi: tampil di semua tab agar tidak ada yang tertinggal. -->
      <PembaruanBanner :ticker="T" />

      <div class="tabs" role="tablist" aria-label="Bagian emiten">
        <button v-for="(t, i) in TABS_TAMPIL" :key="t.id" :ref="el => (tabEls[i] = el)" type="button" role="tab" class="tab"
          :id="'tab-' + t.id" :aria-selected="tab === t.id" :aria-controls="'panel-' + t.id" :tabindex="tab === t.id ? 0 : -1"
          @click="pick(t.id)" @keydown="onTabKey($event, i)">{{ t.name }}</button>
      </div>

      <div v-if="SLIDE_TABS.includes(tab)" class="viewsw" role="group" aria-label="Tampilan">
        <button type="button" class="pill sm" :aria-pressed="String(view === 'slide')" @click="view = 'slide'">Slide</button>
        <button type="button" class="pill sm" :aria-pressed="String(view === 'lengkap')" @click="view = 'lengkap'">Lengkap</button>
      </div>
      <div :id="'panel-' + tab" role="tabpanel" :aria-labelledby="'tab-' + tab" class="panel">
        <TabSlides v-if="slideOn" :ticker="T" :tab="tab" @full="view = 'lengkap'" />
        <p v-else-if="!known && RADAR_ONLY.includes(tab)" class="muted none">{{ T }} belum ada di radar, jadi {{ tab === 'story' ? 'story dan pengendali' : 'ringkasan transaksi' }} belum ada. Tab Analisa, Teknikal, Spekulasi, Profil, dan Berita tetap memakai data Stockbit.</p>
        <TabRingkasan v-else-if="tab === 'ringkasan'" :ticker="T" />
        <TabStory v-else-if="tab === 'story'" :ticker="T" @flow="openFlow" />
        <TabAset v-else-if="tab === 'aset'" :ticker="T" />
        <TabInsider v-else-if="tab === 'insider'" :ticker="T" />
        <TabAnalisa v-else-if="tab === 'analisa'" :ticker="T" />
        <TabVideo v-else-if="tab === 'video'" :ticker="T" />
        <TabTeknikal v-else-if="tab === 'teknikal'" :ticker="T" />
        <TabSpekulasi v-else-if="tab === 'spekulasi'" :ticker="T" @goto="pick" />
        <TabProfil v-else-if="tab === 'profil'" :ticker="T" />
        <TabIntel v-else-if="tab === 'intel'" :ticker="T" />
        <TabBerita v-else-if="tab === 'berita'" :ticker="T" />
        <TabDownload v-else-if="tab === 'download'" :ticker="T" />
      </div>
    </template>

    <OwnershipFlow v-if="flow" :key="T" :ticker="T" :focus="flowFocus" @close="flow = false" />
  </div>
</template>

<style scoped>
.viewsw{display:flex;gap:6px;justify-content:flex-end;margin:8px 0 0}
.em{display:flex;flex-direction:column;gap:16px;max-width:1200px}
.back{font-size:13px;text-decoration:none;align-self:flex-start}
.back:hover{text-decoration:underline}
.empty{display:grid;gap:8px;justify-items:start}
.hd{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between}
.id{min-width:0;flex:1 1 520px}
.line1{display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap}
.tk{font-size:40px;line-height:1}
.stage{display:inline-flex;align-items:center;gap:10px}
.nm{margin:6px 0 0;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 14px}
.biz{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.biz svg{color:var(--ink-2);flex:none}
.right{display:flex;gap:20px;align-items:flex-end;flex:none;margin-left:auto}
.right .btn{min-height:40px}
.px{text-align:right}
.pv{font:700 36px/1 var(--f-display)}
.panel{min-width:0}
.score{border-radius:999px;padding:2px 10px}
.none{padding:14px 0;margin:0;max-width:72ch}
.recent{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;margin-top:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--rule);border-radius:999px;padding:2px 10px;font:700 13px var(--f-display);letter-spacing:.02em;color:var(--ink);text-decoration:none;background:var(--sheet);min-height:28px;display:inline-flex;align-items:center}
.chip:hover{border-color:var(--ink)}
.chip.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
@media (max-width:760px){
  .hd{align-items:flex-start}
  .right{width:100%;justify-content:space-between}
  .tabs{flex-wrap:nowrap;overflow-x:auto}
  .tab{white-space:nowrap}
}
</style>
