<script setup>
// Diagram pola harmonik ideal (bentuk dari nilai tengah rasio baku): garis pola, garis rasio putus-putus
// berlabel rentang, dan titik akhir (D) berwarna arah. Masukan dari diagramIdeal() atau diagramAbcd().
const props = defineProps({
  diagram: { type: Object, required: true },
  w: { type: Number, default: 224 },
  h: { type: Number, default: 112 },
  pad: { type: Number, default: 16 },
  animasi: { type: Boolean, default: false },   // garis pola tergambar bertahap, label rasio muncul berurutan
})
const dx = v => props.pad + v * (props.w - 2 * props.pad)
const dy = v => props.pad + v * (props.h - 2 * props.pad)
// Label titik di atas puncak dan di bawah lembah (dibanding titik sebelumnya/sesudahnya).
const posLabel = (t, j) => {
  const ts = props.diagram.titik, akhir = j === ts.length - 1
  if (akhir) return { x: dx(t.x) + 10, y: dy(t.y) + 4 }
  const tetangga = ts[j - 1] || ts[j + 1]
  return { x: dx(t.x), y: t.y <= tetangga.y ? dy(t.y) - 6 : dy(t.y) + 13 }
}
</script>

<template>
  <svg :viewBox="`0 0 ${w} ${h}`" class="pd" :class="{ anim: animasi }" aria-hidden="true">
    <g v-for="(g, j) in diagram.garis" :key="j" class="rg" :style="{ '--d': 1.2 + j * 0.35 + 's' }">
      <line :x1="dx(g.a.x)" :y1="dy(g.a.y)" :x2="dx(g.b.x)" :y2="dy(g.b.y)" class="r" />
      <text :x="(dx(g.a.x) + dx(g.b.x)) / 2" :y="(dy(g.a.y) + dy(g.b.y)) / 2 - 2" class="rt">{{ g.teks }}</text>
    </g>
    <polyline :points="diagram.titik.map(t => `${dx(t.x)},${dy(t.y)}`).join(' ')" class="j" pathLength="1" />
    <circle :cx="dx(diagram.titik.at(-1).x)" :cy="dy(diagram.titik.at(-1).y)" r="6" :class="diagram.bull ? 'dg' : 'ds'" />
    <text v-for="(t, j) in diagram.titik" :key="t.n" v-bind="posLabel(t, j)" class="t" :style="{ '--d': j * 0.28 + 's' }">{{ t.n }}</text>
  </svg>
</template>

<style scoped>
.pd{width:100%;height:auto;display:block}
.j{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
.r{stroke:var(--ink-2);stroke-dasharray:3 3;stroke-width:1}
.rt{font:600 9px var(--f-data);fill:var(--ink);text-anchor:middle;paint-order:stroke;stroke:var(--sheet);stroke-width:3px}
.t{font:800 11px var(--f-data);fill:var(--ink);text-anchor:middle}
.dg{fill:var(--good);opacity:.55}.ds{fill:var(--strong);opacity:.55}
/* Animasi: garis pola tergambar (pathLength 1), titik dan label rasio muncul berurutan. */
.anim .j{stroke-dasharray:1;stroke-dashoffset:1;animation:gambar 1.3s ease-out forwards}
.anim .t,.anim .rg{opacity:0;animation:muncul .45s ease-out forwards;animation-delay:var(--d)}
.anim circle{opacity:0;animation:muncul .4s ease-out 1.2s forwards}
@keyframes gambar{to{stroke-dashoffset:0}}
@keyframes muncul{to{opacity:1}}
@media (prefers-reduced-motion: reduce){.anim .j,.anim .t,.anim .rg,.anim circle{animation:none;opacity:1;stroke-dashoffset:0}}
</style>
