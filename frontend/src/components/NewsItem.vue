<script setup>
// Satu pengumuman/berita beserta bacaan otomatisnya (sinyal, arah dampak, poin, sikap emiten).
// Dipakai halaman Berita dan tab Berita tiap emiten.
import { computed, ref } from 'vue'
import { store } from '../store.js'
import { UTYPES, isNewSince, SIKAP_CLS, fmtDate } from '../lib/domain.js'
import { newsTake } from '../lib/news.js'

const props = defineProps({ u: { type: Object, required: true }, showTicker: { type: Boolean, default: true }, daftar: { type: Array, default: null } })

const TAG = { good: 't-good', warn: 't-warn', bad: 't-strong', calm: 't-calm' }
// Arah dampak tiap poin terhadap pemegang saham publik; bentuk SVG: segitiga naik, segitiga turun, bulat.
const TONE = {
  1: { cls: 'pos', name: 'Positif', d: 'M5 1.5 9 8.5H1z' },
  '-1': { cls: 'neg', name: 'Negatif atau risiko', d: 'M1 1.5h8L5 8.5z' },
  0: { cls: 'mid', name: 'Perlu dicermati', d: 'M5 1.75a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 1 0 0-6.5z' },
}
const typeName = id => (UTYPES.find(t => t.id === id) || UTYPES[UTYPES.length - 1]).name

const take = computed(() => newsTake(props.u, { items: store.items, pandangan: store.pandangan }))
const points = computed(() => take.value.points.map((text, i) => ({ text, tone: TONE[take.value.tones[i]] })))
const fresh = computed(() => isNewSince(props.u, store.seenAt))

// Unduh analisa berita ini (PDF format riset: tujuan, temuan, uji dugaan, dampak dua sisi, tesis). daftar = feed tempat
// berita ini berada (saham di luar radar memakai daftar hasil pencarian) untuk konteks keterbukaan sebelumnya.
const unduhBusy = ref(false), unduhErr = ref('')
async function unduhAnalisa() {
  unduhBusy.value = true; unduhErr.value = ''
  try {
    const [{ jsPDF }, B, P] = await Promise.all([import('jspdf'), import('../lib/beritaTerbaru.js'), import('../lib/beritaPdf.js')])
    const daftar = props.daftar || store.updates
    const a = B.analisaBerita(props.u, { items: store.items, pandangan: store.pandangan, updates: daftar,
      pengendali: store.pengendali, relasi: store.relasi, verified: store.verified })
    ;(await P.beritaPdf(a, jsPDF)).save(P.beritaPdfName(a))
  } catch (e) { unduhErr.value = 'PDF gagal: ' + (e.message || e) } finally { unduhBusy.value = false }
}
const url = computed(() => /^https?:\/\//.test(props.u.url || '') ? props.u.url : '')
const inItems = computed(() => store.items.some(i => i.ticker === props.u.ticker))
// Klik berita = buka/tutup penjelasan lengkap (kecuali klik pada tautan).
const open = ref(false)
function toggle(e) { if (!e.target.closest('a')) open.value = !open.value }
// Ringkasan AI Stockbit: "… Inti: …(Ringkasan AI Stockbit)" dipisah menjadi isi dan inti.
const parts = computed(() => {
  const s = String(props.u.summary || '').replace(/\s*\(Ringkasan AI Stockbit\)\s*$/, '')
  const [isi, inti] = s.split(/\s*Inti:\s*/)
  return { isi: isi || '', inti: inti || '', ai: /Ringkasan AI Stockbit/.test(props.u.summary || '') }
})
const keyPoints = computed(() => String(props.u.points || '').split(' · ').map(x => x.trim()).filter(Boolean))
const source = computed(() => props.u.source || (/^sb-report-/.test(props.u.id) ? 'Stockbit Reports' : 'Sumber belum ada'))
</script>

<template>
  <article class="item" :class="{ fresh, solo: !showTicker, open }" @click="toggle">
    <div v-if="showTicker" class="tk">
      <RouterLink v-if="u.ticker && inItems" class="ticker" :to="'/emiten/' + u.ticker">{{ u.ticker }}</RouterLink>
      <span v-else-if="u.ticker" class="ticker" title="Emiten belum ada di radar">{{ u.ticker }}</span>
    </div>
    <div class="body">
      <a v-if="url" class="title" :href="url" target="_blank" rel="noopener">{{ u.title || 'Tanpa judul' }}</a>
      <span v-else class="title">{{ u.title || 'Tanpa judul' }}</span>
      <p v-if="u.summary && !open" class="sum muted">{{ u.summary }}</p>
      <div class="small muted">{{ source }}</div>
      <div class="take small">
        <div class="tags">
          <span class="tag" :class="TAG[take.cls]">{{ take.label }}</span>
          <span class="tag" :class="TAG[take.arah.cls]" :title="`${take.arah.pos} poin positif, ${take.arah.neg} poin negatif`">{{ take.arah.label }}</span>
          <button type="button" class="more" :aria-expanded="String(open)" @click.stop="open = !open">{{ open ? 'Tutup penjelasan' : 'Penjelasan lengkap' }}</button>
          <RouterLink v-if="showTicker && take.canAnalyze" class="an" :to="{ path: '/emiten/' + u.ticker, query: { tab: 'analisa' } }">Analisa {{ u.ticker }}</RouterLink>
          <button v-if="u.ticker" type="button" class="more" :disabled="unduhBusy" title="Unduh analisa berita ini (PDF)" @click.stop="unduhAnalisa">{{ unduhBusy ? 'Menyiapkan PDF…' : '⬇ Unduh analisa' }}</button>
          <span v-if="unduhErr" class="small c-strong">{{ unduhErr }}</span>
        </div>
        <ul v-if="!open" class="pts">
          <li v-for="(p, i) in points" :key="i" :title="p.tone.name">
            <svg class="tone" :class="p.tone.cls" viewBox="0 0 10 10" role="img" :aria-label="p.tone.name"><path :d="p.tone.d" /></svg>
            <span>{{ p.text }}</span>
          </li>
        </ul>
        <p v-if="take.sikapLine && !open" class="sk"><span class="tag" :class="SIKAP_CLS[take.sikapLine.sikap] || TAG[take.sikapLine.cls]">{{ take.sikapLine.ticker }} · {{ take.sikapLine.sikap }}</span> <span class="muted">{{ take.sikapLine.ringkas }}</span></p>
      </div>
      <div v-if="open" class="detail small" @click.stop>
        <section v-if="parts.isi">
          <h4>Ringkasan isi</h4>
          <p>{{ parts.isi }}</p>
          <p v-if="parts.inti"><b>Inti:</b> {{ parts.inti }}</p>
          <p v-if="parts.ai" class="muted note">Ringkasan disusun oleh AI Stockbit dari dokumen keterbukaan.</p>
        </section>
        <section v-if="keyPoints.length">
          <h4>Poin kunci dokumen</h4>
          <ul class="bul"><li v-for="(k, i) in keyPoints" :key="i">{{ k }}</li></ul>
        </section>
        <section>
          <h4>Analisis dampak</h4>
          <ul class="pts">
            <li v-for="(p, i) in take.detail.all" :key="i" :title="TONE[p.tone].name">
              <svg class="tone" :class="TONE[p.tone].cls" viewBox="0 0 10 10" role="img" :aria-label="TONE[p.tone].name"><path :d="TONE[p.tone].d" /></svg>
              <span>{{ p.text }}</span>
            </li>
          </ul>
          <p class="muted note">{{ take.label }}: {{ take.detail.levelWhy }} Arah dampak {{ take.arah.label.toLowerCase() }} ({{ take.arah.pos }} poin positif, {{ take.arah.neg }} poin negatif).</p>
        </section>
        <section v-if="take.detail.watch">
          <h4>Yang perlu dipantau berikutnya</h4>
          <p>{{ take.detail.watch }}</p>
        </section>
        <section v-if="take.detail.ringkas">
          <h4>Pandangan analis atas {{ u.ticker }}<span v-if="take.detail.sikap"> · {{ take.detail.sikap }}</span></h4>
          <p>{{ take.detail.ringkas }}</p>
        </section>
        <p class="muted meta">
          {{ u.date ? fmtDate(String(u.date).slice(0, 10)) : 'Tanpa tanggal' }} · {{ typeName(u.type) }} · {{ source }}
          <template v-if="url"> · <a :href="url" target="_blank" rel="noopener">Buka dokumen asli</a></template>
          <template v-if="!showTicker || take.canAnalyze"> · <RouterLink :to="{ path: '/emiten/' + u.ticker, query: { tab: 'analisa' } }">Analisa {{ u.ticker }}</RouterLink></template>
        </p>
      </div>
    </div>
    <span class="tag t-calm ty">{{ typeName(u.type) }}</span>
  </article>
</template>

<style scoped>
.item{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:4px 14px;padding:12px 16px;border-bottom:1px solid var(--rule-2);align-items:baseline}
.item.solo{grid-template-columns:minmax(0,1fr) auto}
.item.fresh{background:var(--now-bg)}
.title{font-weight:600;color:var(--ink)}
a.title{text-decoration:none}
a.title:hover{text-decoration:underline}
.sum{max-width:78ch;margin:2px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden}
.take{margin-top:6px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.pts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
/* Penanda arah: bentuk + warna, jadi tetap terbaca tanpa membedakan warna. */
.pts li{display:flex;gap:7px;align-items:baseline}
.tone{flex:none;width:9px;height:9px;fill:var(--warn);transform:translateY(1px)}
.tone.pos{fill:var(--good)}
.tone.neg{fill:var(--strong)}
.an{color:var(--accent);font-weight:600;text-underline-offset:3px;align-self:center}
.sk{margin:0}
.item{cursor:pointer}
.item.open{background:var(--sheet-2)}
.more{border:0;background:none;padding:0;color:var(--accent);font:inherit;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px;align-self:center}
.detail{margin-top:10px;padding:12px 14px;background:var(--sheet);border:1px solid var(--rule);cursor:auto;display:flex;flex-direction:column;gap:10px;max-width:90ch}
.detail h4{margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--ink)}
.detail p{margin:0 0 4px;line-height:1.55}
.detail .note{font-size:11.5px}
.bul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:3px}
.meta{margin:0;font-size:11.5px}
@media (max-width:760px){
  .item,.item.solo{grid-template-columns:1fr}
  .ty{justify-self:start}
}
</style>
