<script setup>
// Lab pola interaktif (presentasi Materi): geser rasio titik B (AB/XA), C (BC/AB), dan D (AD/XA), lihat bentuk
// X-A-B-C-D berubah dan pola mana yang cocok menurut aturan pendeteksi (harmonikAlat.labPola). Tombol pola memasang
// rasio idealnya dengan animasi.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { POLA, labPola, rasioContoh } from '../lib/harmonikAlat.js'

const props = defineProps({ awal: { type: String, default: 'gartley' } })
const PILIHAN = ['gartley', 'bat', 'altbat', 'butterfly', 'crab', 'deepcrab', 'cypher', 'shark', 'fiveo']
const b = ref(0.618), c = ref(0.618), d = ref(0.786)
let raf = 0
const reduksi = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
// Pasang rasio contoh sebuah pola, dengan transisi halus 600 ms.
function pasang(k) {
  const r = rasioContoh(k)
  if (!r) return
  cancelAnimationFrame(raf)
  if (reduksi) { b.value = r.b; c.value = r.c; d.value = r.d; return }
  const dari = { b: b.value, c: c.value, d: d.value }, t0 = performance.now()
  const langkah = now => {
    const t = Math.min(1, (now - t0) / 600), e = 1 - (1 - t) ** 3
    b.value = dari.b + (r.b - dari.b) * e; c.value = dari.c + (r.c - dari.c) * e; d.value = dari.d + (r.d - dari.d) * e
    if (t < 1) raf = requestAnimationFrame(langkah)
  }
  raf = requestAnimationFrame(langkah)
}
watch(() => props.awal, k => pasang(POLA[k] ? k : 'gartley'), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))

const hasil = computed(() => labPola(b.value, c.value, d.value))
// Koordinat SVG: x merata, y dari nilai harga (X 0, A 1) dengan ruang di atas/bawah.
const W = 300, H = 190, P = 22
const geom = computed(() => {
  const t = hasil.value.titik, nilai = Object.values(t), lo = Math.min(...nilai), hi = Math.max(...nilai)
  const y = v => P + (H - 2 * P) * (1 - (v - lo) / (hi - lo || 1))
  const pts = ['X', 'A', 'B', 'C', 'D'].map((n, j) => ({ n, x: P + j * (W - 2 * P) / 4, y: y(t[n]), v: t[n] }))
  return { pts, yX: y(t.X) }
})
const f = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })
const cocok = computed(() => hasil.value.cocok)
</script>

<template>
  <div class="lab">
    <svg :viewBox="`0 0 ${W} ${H}`" class="gb" aria-label="Bentuk X-A-B-C-D dari rasio yang dipilih">
      <line :x1="P" :x2="W - P" :y1="geom.yX" :y2="geom.yX" class="lx" />
      <polygon :points="geom.pts.slice(0, 3).map(p => `${p.x},${p.y}`).join(' ')" class="seg" />
      <polygon :points="geom.pts.slice(2).map(p => `${p.x},${p.y}`).join(' ')" class="seg" />
      <polyline :points="geom.pts.map(p => `${p.x},${p.y}`).join(' ')" class="jl" />
      <line :x1="geom.pts[0].x" :y1="geom.pts[0].y" :x2="geom.pts[2].x" :y2="geom.pts[2].y" class="rs" />
      <line :x1="geom.pts[0].x" :y1="geom.pts[0].y" :x2="geom.pts[4].x" :y2="geom.pts[4].y" class="rs" />
      <g v-for="(p, j) in geom.pts" :key="p.n">
        <circle :cx="p.x" :cy="p.y" r="4.5" :class="j === 4 ? 'td' : 'tt'" />
        <text :x="p.x" :y="p.y + (j % 2 ? -9 : 17)" class="nt">{{ p.n }}</text>
      </g>
    </svg>
    <div class="kontrol">
      <label>Titik B: AB/XA <b>{{ f(b) }}</b><input v-model.number="b" type="range" min="0.2" max="1" step="0.001" /></label>
      <label>Titik C: BC/AB <b>{{ f(c) }}</b><input v-model.number="c" type="range" min="0.3" max="1.7" step="0.001" /></label>
      <label>Titik D: AD/XA <b>{{ f(d) }}</b><input v-model.number="d" type="range" min="0.5" max="1.8" step="0.001" /></label>
      <p class="hasil" :class="{ ok: cocok.length }">
        <template v-if="cocok.length">Cocok: <b>{{ cocok.map(x => x.nama).join(', ') }}</b></template>
        <template v-else>Belum cocok pola mana pun. Geser titik B dulu, lalu D.</template>
        <span class="rasioE">CD/BC {{ f(hasil.rasio.e) }}</span>
      </p>
      <div class="pasang" role="group" aria-label="Pasang rasio ideal pola">
        <button v-for="k in PILIHAN" :key="k" type="button" :class="{ on: cocok.some(x => x.k === k) }" @click="pasang(k)">{{ POLA[k].nama }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab{display:grid;gap:10px}
.gb{width:100%;height:auto;background:var(--sheet-2);border:1px solid var(--rule);border-radius:8px}
.lx{stroke:var(--ink-2);stroke-dasharray:2 4;stroke-width:1}
.seg{fill:var(--viz-a);fill-opacity:.13}
.jl{fill:none;stroke:var(--viz-a);stroke-width:2.5;stroke-linejoin:round}
.rs{stroke:var(--viz-a);stroke-dasharray:3 4;stroke-width:1;opacity:.7}
.tt{fill:var(--sheet);stroke:var(--viz-a);stroke-width:2}.td{fill:var(--good);stroke:var(--good)}
.nt{font:800 12px var(--f-data);fill:var(--ink);text-anchor:middle}
.kontrol{display:grid;gap:6px;font-size:.92em}
.kontrol label{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;color:var(--ink-2)}
.kontrol label b{font-family:var(--f-data);color:var(--ink)}
.kontrol input{grid-column:1 / -1;width:100%;accent-color:var(--accent)}
.hasil{margin:2px 0;padding:6px 8px;border-radius:6px;background:var(--strong-bg);color:var(--strong);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.hasil.ok{background:var(--good-bg);color:var(--good)}
.rasioE{font-family:var(--f-data);color:var(--ink-2)}
.pasang{display:flex;flex-wrap:wrap;gap:4px}
.pasang button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:12px;padding:3px 9px;font:600 .85em var(--f-body);cursor:pointer}
.pasang button.on{background:var(--good-bg);color:var(--good);border-color:var(--good)}
</style>
