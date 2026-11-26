<script setup>
// Visual satu adegan/slide (dari lib/videoScript.js: title | kpis | bars | compare | ladder | list | rec).
// Dipakai pemutar Video dan mode Slide di halaman emiten.
import { computed } from 'vue'
import AnimNum from './AnimNum.vue'
// step: jumlah poin daftar yang sudah dibacakan (video); tanpa step semua poin tampil (slide).
const props = defineProps({ scene: { type: Object, required: true }, step: { type: Number, default: Infinity } })
const v = computed(() => props.scene.visual || {})
const pctW = (x, max) => `${Math.max(2, Math.min(100, (+x || 0) / (max || 1) * 100))}%`
const rpS = x => x == null ? '–' : 'Rp' + Math.round(x).toLocaleString('id-ID')
const ladder = computed(() => {
  if (v.value.type !== 'ladder') return null
  const vals = [v.value.price, ...v.value.levels.map(l => l.v)].filter(x => x > 0), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const y = x => 92 - (x - lo) / span * 84
  return { price: v.value.price, py: y(v.value.price), levels: v.value.levels.map(l => ({ ...l, y: y(l.v) })).sort((a, b) => a.y - b.y) }
})
</script>

<template>
  <div v-if="v.type === 'title'" class="v-title">
    <b class="tk">{{ v.t }}</b>
    <span class="nm">{{ v.name }}</span>
    <span class="meta">{{ [v.sector, v.sikap, v.score != null ? `Skor ${v.score}/100` : ''].filter(Boolean).join(' · ') }}</span>
  </div>

  <div v-else-if="v.type === 'kpis'" class="v-kpis">
    <div v-for="(k, i) in v.items" :key="i" class="kpi" :style="{ animationDelay: i * 0.15 + 's' }"><b><AnimNum :text="k[0]" /></b><span>{{ k[1] }}</span></div>
  </div>

  <div v-else-if="v.type === 'bars'" class="v-bars">
    <div v-for="(b, i) in v.items" :key="i" class="br" :style="{ animationDelay: i * 0.12 + 's' }">
      <span class="bl">{{ b.label }}</span>
      <span class="track">
        <i v-if="b.from != null" class="from" :style="{ width: pctW(b.from, v.max || 100) }" />
        <i class="to" :style="{ width: pctW(b.to, v.max || 100), animationDelay: i * 0.12 + 0.1 + 's' }" />
      </span>
      <span class="bv">{{ b.from != null ? `${b.from.toLocaleString('id-ID', { maximumFractionDigits: 2 })}${v.unit} → ` : '' }}{{ (+b.to).toLocaleString('id-ID', { maximumFractionDigits: 2 }) }}{{ v.unit }}</span>
    </div>
  </div>

  <div v-else-if="v.type === 'compare'" class="v-cmp">
    <div class="cmp">
      <div class="col"><b><AnimNum :text="v.from.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'" /></b><span>{{ v.from.l }}</span><i :style="{ height: pctW(v.from.v, 100) }" /></div>
      <div class="col"><b><AnimNum :text="v.to.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'" /></b><span>{{ v.to.l }}</span><i :style="{ height: pctW(v.to.v, 100), animationDelay: '.3s' }" /></div>
      <div v-if="v.extra" class="col"><b>{{ v.extra.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}%</b><span>{{ v.extra.l }}</span><i :style="{ height: pctW(v.extra.v, 100), animationDelay: '.6s' }" /></div>
    </div>
    <div class="mini"><div v-for="(k, i) in v.kpis" :key="i" class="kpi sm" :style="{ animationDelay: 0.4 + i * 0.2 + 's' }"><b>{{ k[0] }}</b><span>{{ k[1] }}</span></div></div>
  </div>

  <div v-else-if="v.type === 'ladder' && ladder" class="v-ladder">
    <div class="axis">
      <div v-for="(l, i) in ladder.levels" :key="i" class="lv" :style="{ top: l.y + '%', animationDelay: i * 0.15 + 's' }"><span class="ln" /><b>{{ rpS(l.v) }}</b> <span>{{ l.l }}</span></div>
      <div class="now" :style="{ top: ladder.py + '%' }"><span class="dot" /> <b>Harga kini {{ rpS(ladder.price) }}</b></div>
    </div>
  </div>

  <ul v-else-if="v.type === 'list'" class="v-list">
    <li v-for="(x, i) in v.items" v-show="i <= step" :key="i" :class="{ cur: step !== Infinity && i === Math.min(step, v.items.length - 1) }" :style="{ animationDelay: (step === Infinity ? i * 0.2 : 0) + 's' }">{{ x }}</li>
  </ul>

  <div v-else-if="v.type === 'rec'" class="v-rec">
    <b class="act">{{ v.rec.label }}</b>
    <div class="v-kpis">
      <div class="kpi"><b>{{ v.rec.entry ? (v.rec.entry[1] ? `${rpS(v.rec.entry[0])}–${rpS(v.rec.entry[1])}` : `> ${rpS(v.rec.entry[0])}`) : 'Tidak ada' }}</b><span>Area beli</span></div>
      <div class="kpi" style="animation-delay:.2s"><b>{{ rpS(v.rec.stop) }}</b><span>Batas risiko</span></div>
      <div class="kpi" style="animation-delay:.4s"><b>{{ v.rec.targets[0] ? rpS(v.rec.targets[0].p) : '–' }}</b><span>Target</span></div>
    </div>
    <span class="por">{{ v.rec.porsi }}</span>
  </div>
</template>

<style scoped>
.v-title{display:flex;flex-direction:column;gap:.4em;margin-top:3%}
.v-title .tk{font-family:Cambria,Georgia,serif;font-size:clamp(48px,9vw,120px);line-height:1;color:#0f766e;animation:rise .8s ease}
.v-title .nm{font-size:clamp(16px,2.4vw,30px);animation:rise 1s ease}
.v-title .meta{font-size:clamp(12px,1.5vw,18px);opacity:.75;animation:rise 1.2s ease}
.v-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(22%,1fr));gap:2.5%}
.kpi{background:#fff;border:1px solid #d3e9e6;border-top:4px solid #0d9488;padding:4% 5%;display:flex;flex-direction:column;gap:.4em;animation:rise .7s ease both}
.kpi b{font-family:Cambria,Georgia,serif;font-size:clamp(18px,3.2vw,42px);color:#1f2937}
.kpi span{font-size:clamp(10px,1.3vw,16px);opacity:.75}
.kpi.sm b{font-size:clamp(14px,2vw,26px)}
.v-bars{display:grid;gap:3%}
.br{display:grid;grid-template-columns:28% 1fr 20%;gap:2%;align-items:center;font-size:clamp(10px,1.3vw,16px);animation:rise .6s ease both}
.bl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{position:relative;height:clamp(10px,1.6vw,20px);background:#e6eef3;border-radius:999px;overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.track .from{background:#bcccdc}
.track .to{background:#0d9488;opacity:.85;animation:grow 1.2s ease both}
.bv{text-align:right;font-weight:700}
.v-cmp{display:grid;grid-template-columns:1.2fr 1fr;gap:4%;flex:1;min-height:0}
.cmp{display:flex;gap:6%;align-items:flex-end;height:100%}
.col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;font-size:clamp(10px,1.2vw,15px);text-align:center}
.col b{font-family:Cambria,Georgia,serif;font-size:clamp(16px,2.4vw,32px)}
.col i{display:block;background:#0d9488;margin-top:.4em;border-radius:4px 4px 0 0;animation:growUp 1.2s ease both}
.col:first-child i{background:#486581}
.mini{display:grid;gap:4%;align-content:center}
.v-ladder{flex:1;position:relative;min-height:200px}
.axis{position:absolute;inset:2% 0;border-left:3px solid #bcccdc;margin-left:6%}
.lv{position:absolute;left:0;right:0;display:flex;align-items:center;gap:1%;font-size:clamp(10px,1.3vw,16px);transform:translateY(-50%);animation:rise .6s ease both}
.lv .ln{width:5%;border-top:2px dashed #94a3b8}
.lv span{opacity:.75}
.now{position:absolute;left:-1%;display:flex;align-items:center;gap:1%;transform:translateY(-50%);font-size:clamp(11px,1.5vw,18px);color:#0f766e}
.now .dot{width:clamp(10px,1.4vw,18px);height:clamp(10px,1.4vw,18px);border-radius:50%;background:#0f766e;animation:pulse 1.4s infinite}
.v-list{list-style:none;margin:0;padding:0;display:grid;gap:2.5%}
.v-list li{background:#fff;border-left:4px solid #0d9488;padding:1.4% 2%;font-size:clamp(11px,1.5vw,18px);animation:rise .6s ease both;transition:box-shadow .3s,transform .3s}
.v-list li.cur{box-shadow:0 4px 14px rgba(15,118,110,.25);transform:translateX(6px);border-left-color:#f59e0b}
.v-rec{display:flex;flex-direction:column;gap:3%}
.v-rec .act{font-family:Cambria,Georgia,serif;font-size:clamp(20px,3.4vw,44px);color:#0f766e;animation:rise .7s ease}
.v-rec .por{font-size:clamp(11px,1.4vw,17px);opacity:.8}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes grow{from{width:0}}
@keyframes growUp{from{height:0}}
@keyframes pulse{50%{transform:scale(1.3);opacity:.6}}
@media (max-width:760px){ .v-cmp{grid-template-columns:1fr}.br{grid-template-columns:34% 1fr 26%} }
</style>
