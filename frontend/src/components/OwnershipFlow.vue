<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { VueFlow, useVueFlow, BaseEdge, EdgeLabelRenderer } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { store, relasiOf, alsoIn } from '../store.js'
import { api } from '../api.js'
import { lensOf, lensesOf, transfersOf, layoutFor, mergeLayout } from '../lib/relasiAuto.js'

const props = defineProps({
  ticker: { type: String, required: true },
  focus: { type: String, default: null },
})
const emit = defineEmits(['close'])

const KINDS = [['own', 'kepemilikan'], ['role', 'jabatan'], ['plan', 'transaksi rencana'], ['void', 'batal']]
const REL = Object.fromEntries(KINDS)
const sizeOf = k => (k === 'main' ? { w: 280, h: 104 } : { w: 236, h: 80 })

const flowId = 'alur-' + props.ticker
const data = computed(() => relasiOf(props.ticker))
const byId = computed(() => Object.fromEntries((data.value?.nodes || []).map(n => [n.id, n])))
// Lensa: subset node/garis per sudut pandang, masing-masing dengan tata letak tersimpan sendiri.
const lenses = computed(() => lensesOf(data.value))
const lens = ref(lenses.value[0]?.[0] || 'semua')
const view = computed(() => lensOf(data.value, lens.value))
const saved = ref({})
const xfers = computed(() => lens.value === 'arus' ? transfersOf(data.value, selId.value) : [])
const nameOf = id => byId.value[id]?.t || id || 'tidak diungkap'

// JSON & server menyimpan titik TENGAH; vue-flow memakai pojok kiri atas.
function toNodes(saved = {}) {
  return view.value.nodes.map(n => {
    const { w, h } = sizeOf(n.k)
    const c = saved[n.id] || n
    return { id: n.id, type: 'card', position: { x: c.x - w / 2, y: c.y - h / 2 }, data: n }
  })
}
const nodes = ref([])
const edges = computed(() => (view.value?.edges || []).map(([source, target, kind, label], i) =>
  ({ id: 'e' + i, source, target, type: 'rel', data: { kind, label } })))
const ready = ref(false)
const selId = ref(props.focus)

const { fitView, zoomIn, zoomOut, viewport, getNodes } = useVueFlow(flowId)
const zoomPct = computed(() => Math.round(viewport.value.zoom * 100) + '%')
const fit = () => fitView({ padding: 0.08, duration: 200 })

// Tepi kotak terdekat di garis pusat-ke-pusat, supaya panah berhenti di tepi kartu.
function center(node) {
  const { w, h } = sizeOf(node.data.k)
  return { x: node.computedPosition.x + w / 2, y: node.computedPosition.y + h / 2, w, h }
}
function clip(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.min(dx ? (a.w / 2 + 3) / Math.abs(dx) : 1e9, dy ? (a.h / 2 + 3) / Math.abs(dy) : 1e9)
  return { x: a.x + dx * t, y: a.y + dy * t }
}
// Posisi label tiap garis: dicoba di beberapa titik sepanjang garis, dipilih yang tidak
// menimpa label lain maupun kotak. Dihitung ulang saat kotak digeser (getNodes reaktif).
const labelPos = computed(() => {
  const nodes = getNodes.value
  if (!nodes.length || !view.value?.edges) return {}
  const rect = {}
  for (const n of nodes) { const c = center(n); rect[n.id] = c }
  const cards = Object.values(rect).map(c => [c.x - c.w / 2 - 4, c.y - c.h / 2 - 4, c.x + c.w / 2 + 4, c.y + c.h / 2 + 4])
  const labels = []
  const area = (b, q) => Math.max(0, Math.min(b[2], q[2]) - Math.max(b[0], q[0])) * Math.max(0, Math.min(b[3], q[3]) - Math.max(b[1], q[1]))
  // Skor tumpang tindih: menimpa label lain jauh lebih buruk daripada menyentuh tepi kotak.
  const cost = b => labels.reduce((t, q) => t + area(b, q) * 20, 0) + cards.reduce((t, q) => t + area(b, q), 0)
  const out = {}
  view.value.edges.forEach(([src, tgt, , label], i) => {
    const a = rect[src], b = rect[tgt]
    if (!a || !b) return
    const s = clip(a, b), e = clip(b, a)
    const w = String(label || '').length * 6.6 + 14, h = 18
    let best = null
    for (const t of [0.5, 0.38, 0.62, 0.28, 0.72, 0.2, 0.8]) {
      const x = s.x + (e.x - s.x) * t, y = s.y + (e.y - s.y) * t
      // garis pendek mendatar: label boleh naik/turun sedikit dari garis
      for (const dy of Math.abs(e.y - s.y) < 4 ? [0, -16, 16] : [0]) {
        const box = [x - w / 2, y + dy - h / 2, x + w / 2, y + dy + h / 2]
        const c = cost(box)
        if (!best || c < best.c) best = { x, y: y + dy, box, c }
        if (c === 0) break
      }
      if (best.c === 0) break
    }
    labels.push(best.box)
    out['e' + i] = { x: best.x, y: best.y }
  })
  return out
})

function geom(p) {
  const a = center(p.sourceNode), b = center(p.targetNode)
  const s = clip(a, b), e = clip(b, a)
  const ang = Math.atan2(e.y - s.y, e.x - s.x), L = 11, W = 6
  // garis berhenti di pangkal kepala panah
  const bx = e.x - Math.cos(ang) * L, by = e.y - Math.sin(ang) * L
  const nx = -Math.sin(ang) * W, ny = Math.cos(ang) * W
  return {
    path: `M${s.x},${s.y} L${bx},${by}`,
    head: `${e.x},${e.y} ${bx + nx},${by + ny} ${bx - nx},${by - ny}`,
    lx: labelPos.value[p.id]?.x ?? (s.x + e.x) / 2, ly: labelPos.value[p.id]?.y ?? (s.y + e.y) / 2,
  }
}

const sel = computed(() => {
  const id = selId.value, n = byId.value[id]
  if (!n) return null
  const I = data.value.info?.[id] || {}
  const links = data.value.edges.filter(e => e[0] === id || e[1] === id).map(([f, to, kind, label]) => ({
    kind, other: byId.value[f === id ? to : f]?.t || (f === id ? to : f),
    text: (f === id ? 'ke ' : 'dari ') + REL[kind] + ': ' + label,
  }))
  return { ...I, t: n.t, trackTitle: I.trackTitle || 'Rekam jejak', track: I.track || [], open: I.open || [], links, also: id === 'em' ? [] : alsoIn(n.t, props.ticker) }
})

// Simpan posisi tengah semua node, ditunda supaya seretan beruntun jadi satu PUT.
let saveTimer = 0
function onDragStop() {
  clearTimeout(saveTimer)
  const l = lens.value, cur = nodes.value  // dikunci sekarang: lensa bisa diganti sebelum timer jalan
  saveTimer = setTimeout(() => {
    const body = Object.fromEntries(cur.map(n => {
      const c = center({ data: n.data, computedPosition: n.position })
      return [n.id, { x: Math.round(c.x), y: Math.round(c.y) }]
    }))
    saved.value = mergeLayout(saved.value, l, body)
    if (!store.status?.readOnly) api.put('/api/layout/' + props.ticker, saved.value).catch(e => console.warn('Gagal menyimpan tata letak', e))
  }, 400)
}
async function resetLayout() {
  clearTimeout(saveTimer)
  nodes.value = toNodes()
  saved.value = mergeLayout(saved.value, lens.value, {})
  if (!store.status?.readOnly) api.put('/api/layout/' + props.ticker, saved.value).catch(e => console.warn('Gagal menghapus tata letak', e))
  await nextTick()
  requestAnimationFrame(fit)
}

function setLens(k) {
  lens.value = k
  nodes.value = toNodes(layoutFor(saved.value, k))
  // Tabel arus saham mengubah tinggi kanvas; tunggu ResizeObserver vue-flow sebelum fit.
  clearTimeout(fitTimer)
  fitTimer = setTimeout(fit, 150)
}

let fitTimer = 0
const dlg = ref(null)
let opener = null
function onKey(e) {
  if (e.key !== 'Escape') return
  e.stopPropagation()
  if (selId.value) selId.value = null
  else emit('close')
}

onMounted(async () => {
  opener = document.activeElement
  dlg.value?.focus()
  if (!data.value) return
  try { saved.value = (await api.get('/api/layout/' + props.ticker)) || {} } catch (e) { console.warn('Gagal memuat tata letak', e) }
  nodes.value = toNodes(layoutFor(saved.value, lens.value))
  ready.value = true
  // Muat langsung (bukan dari navigasi): ukuran kanvas kadang belum final saat nodes-initialized.
  fitTimer = setTimeout(fit, 350)
})
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  clearTimeout(fitTimer)
  opener?.focus?.()
})
</script>

<template>
  <div class="flow-scrim" @click.self="emit('close')">
    <div ref="dlg" class="flow-dlg" role="dialog" aria-modal="true" aria-labelledby="flowT" tabindex="-1" @keydown="onKey">
      <header class="flow-bar">
        <h2 id="flowT" class="cond">{{ ticker }} · alur saham</h2>
        <div v-if="lenses.length" class="lens" role="group" aria-label="Lensa">
          <button v-for="[k, t] in [...lenses, ['semua', 'Semua']]" :key="k" type="button"
            :class="['btn', { on: lens === k }]" :aria-pressed="lens === k" @click="setLens(k)">{{ t }}</button>
        </div>
        <div class="legend">
          <span v-for="[k, t] in KINDS" :key="k"><i :class="'ln k-' + k" /> {{ t }}</span>
        </div>
        <div class="tools">
          <template v-if="ready">
            <button type="button" class="btn icon" aria-label="Perkecil" @click="zoomOut()">−</button>
            <span class="cond pct" aria-live="polite">{{ zoomPct }}</span>
            <button type="button" class="btn icon" aria-label="Perbesar" @click="zoomIn()">+</button>
            <button type="button" class="btn" @click="fit">Pas layar</button>
            <button type="button" class="btn" @click="resetLayout">Atur ulang</button>
          </template>
          <button type="button" class="btn icon close" aria-label="Tutup alur saham" @click="emit('close')">×</button>
        </div>
      </header>

      <p v-if="!data" class="empty">Belum ada data relasi untuk {{ ticker }}. Tambahkan di website/relasi-verified.json.</p>

      <div v-else class="flow-body">
        <div class="stage">
        <div class="canvas">
          <VueFlow v-if="ready" :id="flowId" v-model:nodes="nodes" :edges="edges"
            :min-zoom="0.3" :max-zoom="2.5" :node-drag-threshold="4"
            :elements-selectable="false" :nodes-connectable="false" :edges-updatable="false"
            :zoom-on-double-click="false"
            @nodes-initialized="fit" @node-drag-stop="onDragStop" @node-click="({ node }) => (selId = node.id)">
            <template #node-card="{ data: n }">
              <div :class="['card', n.k && 'k-' + n.k, { on: selId === n.id }]"
                :style="{ width: sizeOf(n.k).w + 'px', height: sizeOf(n.k).h + 'px' }">
                <b>{{ n.t }}</b><span>{{ n.s }}</span>
              </div>
            </template>
            <template #edge-rel="p">
              <template v-for="g in [geom(p)]" :key="p.id">
                <BaseEdge :path="g.path" :class="'rel k-' + p.data.kind" :interaction-width="0" />
                <polygon :points="g.head" :class="'head k-' + p.data.kind" />
                <EdgeLabelRenderer>
                  <div :class="'elab k-' + p.data.kind"
                    :style="{ transform: `translate(-50%,-50%) translate(${g.lx}px,${g.ly}px)` }">{{ p.data.label }}</div>
                </EdgeLabelRenderer>
              </template>
            </template>
          </VueFlow>
          <div class="hint">Klik kotak untuk detail · seret kotak untuk memindah · seret latar untuk menggeser · scroll untuk zoom · Esc untuk menutup</div>
        </div>
        <section v-if="lens === 'arus' && data.transfers?.length" class="xfer" aria-labelledby="xferT">
          <h4 id="xferT" class="lbl">Arus saham{{ selId ? ' · ' + nameOf(selId) : '' }} <span class="muted">({{ xfers.length }} transaksi)</span></h4>
          <table>
            <thead><tr><th>Tanggal</th><th>Dari → ke</th><th class="num">Saham</th><th class="num">Harga</th><th class="num">Nilai</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr v-for="(t, i) in xfers" :key="i">
                <td class="cond">{{ t.tgl }}</td>
                <td>{{ nameOf(t.dari) }} → {{ nameOf(t.ke) }}</td>
                <td class="num">{{ t.saham }}</td><td class="num">{{ t.harga }}</td><td class="num">{{ t.nilai }}</td>
                <td class="muted">{{ t.ket }}<span v-if="t.src" class="src"> · {{ t.src }}</span></td>
              </tr>
            </tbody>
          </table>
          <p v-if="!xfers.length" class="muted">Tidak ada transaksi untuk pihak ini.</p>
        </section>
        </div>

        <aside v-if="sel" class="drawer" aria-labelledby="selT">
          <div class="d-head">
            <div>
              <div class="small muted">{{ sel.kind }}</div>
              <h3 id="selT" class="cond">{{ sel.t }}</h3>
            </div>
            <button type="button" class="btn icon" aria-label="Tutup detail" @click="selId = null">×</button>
          </div>
          <p v-if="sel.who">{{ sel.who }}</p>
          <section class="rule-top">
            <h4 class="lbl">Peran di kasus {{ ticker }}</h4>
            <p>{{ sel.role || 'belum ada' }}</p>
          </section>
          <p v-if="sel.flag" class="flag">{{ sel.flag }}</p>
          <section class="rule-top">
            <h4 class="lbl">Hubungan di diagram</h4>
            <div v-for="(l, i) in sel.links" :key="i" class="row link">
              <i :class="'ln k-' + l.kind" />
              <span><b>{{ l.other }}</b> <span class="muted">· {{ l.text }}</span></span>
            </div>
            <p v-if="!sel.links.length" class="muted">belum ada</p>
          </section>
          <section v-if="sel.also.length" class="rule-top">
            <h4 class="lbl">Juga muncul di emiten lain</h4>
            <div class="also">
              <RouterLink v-for="t in sel.also" :key="t" class="chip" :to="{ path: '/emiten/' + t, query: { flow: '1' } }">{{ t }}</RouterLink>
            </div>
          </section>
          <section class="rule-top">
            <h4 class="lbl">{{ sel.trackTitle }}</h4>
            <div v-for="([d, t], i) in sel.track" :key="i" class="row track">
              <span class="cond">{{ d }}</span><span>{{ t }}</span>
            </div>
            <p v-if="!sel.track.length" class="muted">belum ada</p>
            <p v-if="sel.note" class="note">{{ sel.note }}</p>
          </section>
          <section v-if="sel.open.length" class="opn">
            <h4 class="lbl">Belum terverifikasi</h4>
            <ul><li v-for="(o, i) in sel.open" :key="i">{{ o }}</li></ul>
          </section>
          <div v-if="sel.src" class="small muted">Sumber: {{ sel.src }}</div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-scrim{position:fixed;inset:0;z-index:40;background:rgb(15 32 25 / .55);display:flex;padding:20px}
.flow-dlg{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--paper);border-radius:4px;overflow:hidden;outline:none;box-shadow:var(--shadow)}
.flow-bar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;padding:12px 16px;background:var(--sheet);border-bottom:1px solid var(--rule)}
.flow-bar h2{font-size:24px;line-height:1}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:12.5px;color:var(--ink-2);align-items:center}
.tools{margin-left:auto;display:flex;gap:6px;align-items:center}
.tools .btn.icon{font-size:18px}
.tools .close{margin-left:6px;font-size:20px}
.pct{width:48px;text-align:center;font-size:15px;font-weight:700}
.empty{margin:auto;padding:24px;color:var(--ink-2);text-align:center}

/* contoh garis per jenis: legenda dan daftar hubungan */
.ln{display:inline-block;width:22px;height:0;border-top:2px solid var(--ink);vertical-align:middle}
.ln.k-role{border-top:2px dashed var(--ink-2)}
.ln.k-plan{border-top:2px dashed var(--now)}
.ln.k-void{border-top:2px dashed var(--strong)}

.flow-body{flex:1;min-height:0;display:flex}
.stage{flex:1;min-width:0;display:flex;flex-direction:column}
.canvas{position:relative;flex:1;min-width:0;min-height:0;background-image:radial-gradient(var(--rule) 1px,transparent 1px);background-size:24px 24px}
.hint{position:absolute;left:12px;bottom:10px;font-size:12px;color:var(--ink-2);background:color-mix(in oklab,var(--paper) 90%,transparent);padding:4px 8px;border-radius:3px;pointer-events:none}

/* lensa */
.lens{display:flex;gap:4px;flex-wrap:wrap}
.lens .btn{font-size:13px;padding:4px 10px}
.lens .btn.on{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}

/* tabel arus saham */
.xfer{flex:0 0 auto;max-height:40%;overflow:auto;background:var(--sheet);border-top:1px solid var(--rule);padding:10px 16px}
.xfer h4{margin:0 0 6px}
.xfer table{width:100%;border-collapse:collapse;font-size:13px}
.xfer th{text-align:left;font-weight:700;color:var(--ink-2);border-bottom:1px solid var(--rule);padding:4px 8px;position:sticky;top:-10px;background:var(--sheet)}
.xfer td{border-top:1px solid var(--rule-2);padding:5px 8px;vertical-align:top}
.xfer .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.xfer .src{font-size:12px}

/* kartu node */
.card{box-sizing:border-box;padding:10px 12px;display:flex;flex-direction:column;justify-content:center;gap:2px;background:var(--sheet);color:var(--ink);border:1px solid var(--rule);border-radius:3px;cursor:pointer;text-align:left;outline-offset:2px}
.card b{font-size:14.5px;line-height:1.25}
.card span{font-size:12.5px;line-height:1.3;color:var(--ink-2)}
.card.k-key{border:2px solid var(--accent)}
.card.k-main{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.card.k-main b{font-family:var(--f-display);font-size:28px;line-height:1}
.card.k-main span{color:var(--accent-ink);opacity:.8}
.card.k-none{background:transparent;border:1px dashed var(--rule);color:var(--ink-2)}
.card.k-void{background:var(--strong-bg);border-color:color-mix(in oklab,var(--strong) 35%,var(--strong-bg))}
.card.k-void span{color:var(--strong)}
.card.on{outline:3px solid var(--now)}

/* drawer */
.drawer{flex:0 0 420px;max-width:46%;background:var(--sheet);border-left:1px solid var(--rule);overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:16px}
.drawer p{margin:0}
.drawer h4{margin:0 0 4px}
.d-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.d-head h3{font-size:26px;line-height:1.05}
.d-head .btn{flex:none;font-size:18px}
.rule-top{padding-top:8px}
.flag{background:var(--strong-bg);border:1px solid color-mix(in oklab,var(--strong) 35%,var(--strong-bg));border-radius:3px;padding:10px 12px;color:var(--strong)}
.row{display:grid;gap:8px;padding:6px 0;border-top:1px solid var(--rule-2)}
.link{grid-template-columns:14px 1fr;align-items:baseline}
.link .ln{width:12px;margin-bottom:4px}
.track{grid-template-columns:86px 1fr;gap:10px}
.track .cond{font-size:14.5px;font-weight:700}
.note{margin-top:6px!important;font-size:12.5px;color:var(--warn)}
.opn{border-top:1px solid var(--rule);padding-top:8px}
.opn ul{margin:0;padding-left:18px;color:var(--ink-2);font-size:13px}

/* garis & label edge (SVG dan HTML milik vue-flow, jadi lewat :deep) */
:deep(.vue-flow__edge-path.rel){stroke:var(--ink);stroke-width:2}
:deep(.vue-flow__edge-path.k-role){stroke:var(--ink-2);stroke-dasharray:6 4}
:deep(.vue-flow__edge-path.k-plan){stroke:var(--now);stroke-dasharray:6 4}
:deep(.vue-flow__edge-path.k-void){stroke:var(--strong);stroke-dasharray:6 4}
.head{fill:var(--ink)}
.head.k-role{fill:var(--ink-2)}
.head.k-plan{fill:var(--now)}
.head.k-void{fill:var(--strong)}
.elab{position:absolute;background:var(--paper);padding:1px 6px;border-radius:2px;font-size:12.5px;font-weight:600;white-space:nowrap;pointer-events:none;color:var(--ink)}
.elab.k-role{color:var(--ink-2)}
.elab.k-plan{color:var(--now-ink)}
.elab.k-void{color:var(--strong)}

/* buang krom bawaan vue-flow */
:deep(.vue-flow__node){padding:0;border:0;background:none;box-shadow:none;border-radius:0}
:deep(.vue-flow__node.dragging .card){box-shadow:var(--shadow);cursor:grabbing}
:deep(.vue-flow__handle){display:none}
:deep(.vue-flow__edge){pointer-events:none}

.also{display:flex;flex-wrap:wrap;gap:6px}
.also .chip{font:700 13px var(--f-display);letter-spacing:.03em;padding:3px 10px;border:1px solid var(--rule);border-radius:999px;color:var(--ink);text-decoration:none}
.also .chip:hover{border-color:var(--ink)}
</style>
