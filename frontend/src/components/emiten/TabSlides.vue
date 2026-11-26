<script setup>
// Mode Slide: isi tab ditampilkan per slide (visual + maks. 3 poin), navigasi ← →, titik, dan "Lihat detail"
// untuk kalimat analisa lengkap; tombol "Versi lengkap" membuka tampilan teks tab ini (tidak ada isi yang dihapus).
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildVideo } from '../../lib/videoScript.js'
import { scenesFor, insiderScenes, intelScenes, asetScenes } from '../../lib/slideTabs.js'
import { faktaAset, laporanMaterial } from '../../lib/pembaruan.js'
import SceneVisual from '../SceneVisual.vue'

const props = defineProps({ ticker: { type: String, required: true }, tab: { type: String, required: true } })
const emit = defineEmits(['full'])
const loading = ref(true), error = ref(''), step = ref('')
const slides = shallowRef([])
const i = ref(0), open = ref(false)

// Data analisa dikumpulkan sekali per emiten lalu dipakai ulang antar tab.
const cache = new Map()
async function deckOf(t) {
  if (!cache.has(t)) cache.set(t, collectDeck(t, { store, api, storyOf, getBenchmark, onStep: s => { step.value = s } }).catch(e => { cache.delete(t); throw e }))
  return cache.get(t)
}
let seq = 0
async function load() {
  const my = ++seq, t = props.ticker, tab = props.tab
  loading.value = true; error.value = ''; i.value = 0; open.value = false
  try {
    let s
    if (tab === 'insider') s = insiderScenes((await api.get('/api/insider-rows', { ticker: t })).rows, t)
    else if (tab === 'intel') s = intelScenes(await api.get('/api/tsa/summary', { ticker: t }), t)
    else if (tab === 'aset') s = asetScenes(t, { riset: store.riset?.[t], aset: store.aset?.[t],
      fakta: faktaAset(laporanMaterial(store.updates, t), { asOf: store.riset?.[t]?.asOf || '' }) })
    else s = scenesFor(tab, buildVideo(await deckOf(t), 'lengkap'))
    if (my === seq) slides.value = s
  } catch (e) { if (my === seq) error.value = e?.message || String(e) } finally { if (my === seq) loading.value = false }
}
watch(() => [props.ticker, props.tab], load, { immediate: true })

const cur = computed(() => slides.value[i.value] || null)
const poin = computed(() => (cur.value?.lines || []).slice(0, 3))
const lebih = computed(() => (cur.value?.lines || []).slice(3))
function go(n) { if (n >= 0 && n < slides.value.length) { i.value = n; open.value = false } }
// Panah kiri/kanan berpindah slide (kecuali saat mengetik di kolom isian).
function onKey(e) {
  if (/input|select|textarea/i.test(e.target?.tagName || '')) return
  if (e.key === 'ArrowRight') go(i.value + 1)
  else if (e.key === 'ArrowLeft') go(i.value - 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <section class="slides">
    <p v-if="loading" class="muted">Menyiapkan slide: {{ step || 'memuat data analisis' }}…</p>
    <p v-else-if="error" class="muted">Slide belum bisa disiapkan: {{ error }}. <button type="button" class="linkbtn" @click="emit('full')">Buka versi lengkap</button></p>
    <p v-else-if="!slides.length" class="muted">Belum ada slide untuk tab ini. <button type="button" class="linkbtn" @click="emit('full')">Buka versi lengkap</button></p>
    <template v-else-if="cur">
      <div class="stage" aria-roledescription="slide" :aria-label="`${i + 1} dari ${slides.length}: ${cur.judul}`">
        <div :key="cur.id" class="scene">
          <div class="chap">{{ i + 1 }} / {{ slides.length }} · {{ cur.bab }}</div>
          <h3 class="ttl">{{ cur.judul }}</h3>
          <div class="vis"><SceneVisual :scene="cur" /></div>
          <ul v-if="poin.length" class="poin"><li v-for="x in poin" :key="x">{{ x }}</li></ul>
        </div>
        <button type="button" class="nav prev" :disabled="i === 0" aria-label="Slide sebelumnya" @click="go(i - 1)">‹</button>
        <button type="button" class="nav next" :disabled="i === slides.length - 1" aria-label="Slide berikutnya" @click="go(i + 1)">›</button>
      </div>

      <div class="ctl">
        <div class="dots" role="tablist" aria-label="Daftar slide">
          <button v-for="(s, k) in slides" :key="s.id" type="button" role="tab" :aria-selected="k === i" :title="s.judul" :class="{ on: k === i }" @click="go(k)" />
        </div>
        <button v-if="lebih.length" type="button" class="btn sm" :aria-expanded="String(open)" @click="open = !open">{{ open ? 'Tutup detail' : `Lihat detail (${lebih.length})` }}</button>
        <button type="button" class="btn sm" @click="emit('full')">Versi lengkap tab ini</button>
      </div>
      <div v-if="open && lebih.length" class="detail">
        <ul><li v-for="x in lebih" :key="x">{{ x }}</li></ul>
      </div>
      <p class="small muted">Gunakan tombol panah ← → untuk berpindah slide. Disusun otomatis dari data analisis; bukan anjuran membeli atau menjual efek.</p>
    </template>
  </section>
</template>

<style scoped>
.slides{margin-top:4px}
.stage{position:relative;aspect-ratio:16/9;min-height:360px;background:#f4f9fb;border:1px solid var(--rule);overflow:hidden;color:#1f2937}
.scene{position:absolute;inset:0;padding:3% 7% 3%;display:flex;flex-direction:column;animation:fade .45s ease}
.chap{font-size:clamp(10px,1.1vw,13px);letter-spacing:.18em;text-transform:uppercase;color:#0f766e;font-weight:700}
.ttl{font-family:Cambria,Georgia,serif;font-size:clamp(18px,2.6vw,34px);margin:.25em 0 .5em;color:#1f2937}
.vis{flex:1;min-height:0;display:flex;flex-direction:column}
.poin{margin:.6em 0 0;padding-left:1.2em;font-size:clamp(11px,1.25vw,15px);line-height:1.45}
.poin li+li{margin-top:.25em}
.nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:56px;border:0;background:rgba(15,118,110,.12);color:#0f766e;font-size:30px;cursor:pointer}
.nav:disabled{opacity:.25;cursor:default}
.nav.prev{left:0}.nav.next{right:0}
.ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0}
.dots{display:flex;gap:6px;flex-wrap:wrap;flex:1}
.dots button{width:12px;height:12px;border-radius:50%;border:1px solid #0f766e;background:transparent;padding:0;cursor:pointer}
.dots button.on{background:#0f766e}
.btn.sm{padding:4px 10px}
.detail{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px;margin-bottom:8px}
.detail ul{margin:0;padding-left:18px;line-height:1.5}
.detail li+li{margin-top:4px}
.linkbtn{background:none;border:0;padding:0;color:var(--now-ink);text-decoration:underline;cursor:pointer;font:inherit}
@keyframes fade{from{opacity:0}to{opacity:1}}
@media (max-width:760px){ .stage{aspect-ratio:auto;min-height:520px}.scene{position:relative;inset:auto;min-height:520px} }
</style>
