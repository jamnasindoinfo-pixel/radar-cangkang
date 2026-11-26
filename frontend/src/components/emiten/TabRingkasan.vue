<script setup>
import { computed } from 'vue'
import { itemOf, pandanganOf, store } from '../../store.js'
import { STAGE_TRACK, fairGap, fmtDate, rp, trackIndex, tglHargaAcuan } from '../../lib/domain.js'

const props = defineProps({ ticker: { type: String, required: true } })
const pv = computed(() => pandanganOf(props.ticker))
const item = computed(() => itemOf(props.ticker))

const rpd = v => 'Rp' + (+v).toLocaleString('id-ID', { maximumFractionDigits: 2 })
const pct = v => (+v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'
const miliar = v => (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' miliar'

const kini = computed(() => item.value?.price ?? pv.value?.hargaAcuan ?? null)

// Tangga harga: hanya angka yang memang ada di data. Label di bawah garis; bila bertabrakan pindah ke atas,
// lalu ke baris bawah kedua. Lebar label diperkirakan 12% skala.
const ladder = computed(() => {
  const p = pv.value
  if (!p) return null
  const nw = p.nilaiWajar || {}
  const pts = []
  if (nw.bawah != null) pts.push({ v: nw.bawah, l: 'wajar bawah' })
  if (nw.atas != null) pts.push({ v: nw.atas, l: 'wajar atas' })
  if (p.dilusi?.berlaku && p.dilusi.nilaiPerSaham != null) pts.push({ v: p.dilusi.nilaiPerSaham, l: 'nilai/saham', soft: true })
  if (item.value?.tender?.price) pts.push({ v: item.value.tender.price, l: 'PTW' })
  const now = kini.value
  if (!pts.length || now == null) return null
  // Level dengan harga sama digabung jadi satu label ("wajar atas · PTW"), supaya tidak bertumpuk.
  for (let i = pts.length - 1; i > 0; i--) {
    const j = pts.findIndex(x => x.v === pts[i].v)
    if (j < i) { pts[j] = { ...pts[j], l: pts[j].l + ' · ' + pts[i].l, soft: pts[j].soft && pts[i].soft }; pts.splice(i, 1) }
  }
  // Skala dipotong di sekitar level yang ada (bukan dari 0) supaya tick tidak menumpuk di kanan.
  const vals = [now, ...pts.map(x => x.v)]
  const hi = Math.max(...vals), lo = Math.min(...vals)
  const pad = Math.max((hi - lo) * 0.12, hi * 0.02)
  const at = v => 3 + (v - (lo - pad)) / ((hi + pad) - (lo - pad)) * 94
  const GAP = 12
  const last = { below0: -99, above: at(now), below1: -99 } // "kini" selalu di atas
  const ticks = [...pts].sort((a, b) => a.v - b.v).map(x => {
    const x0 = at(x.v)
    const row = ['below0', 'below1', 'above'].find(r => Math.abs(x0 - last[r]) >= GAP) || 'above'
    last[row] = x0
    return { ...x, x: x0, row }
  })
  return {
    ticks, now: at(now), nowV: now,
    zone: nw.bawah != null && nw.atas != null ? { l: at(nw.bawah), w: at(nw.atas) - at(nw.bawah) } : null,
    gap: fairGap(now, nw.bawah, nw.atas), lo: nw.bawah, hi: nw.atas,
  }
})
const clampX = x => Math.min(96, Math.max(4, x)) + '%'

// Linimasa dari trek 5 ruas item + tanggal tonggak yang diketahui.
const steps = computed(() => {
  const it = item.value
  if (!it) return []
  const idx = trackIndex(it, { aset: store.aset, verified: store.verified }), ma = it.msAuto || {}, t = it.tender || {}
  const d = v => /^\d{4}-\d\d-\d\d/.test(v || '') ? fmtDate(v.slice(0, 10)) : ''
  const NAME = { spa: 'PPJB', tender: 'PTW', rupslb: 'RUPSLB', injeksi: 'Injeksi', selesai: 'Selesai' }
  return STAGE_TRACK.map((id, i) => {
    let title = NAME[id], when = ''
    if (id === 'spa') when = d(ma.spa) || d(ma.akuisisi)
    if (id === 'tender') {
      if (t.price) title += ' ' + rp(t.price)
      when = t.start && t.end ? `${d(t.start)} – ${d(t.end)}` : d(ma.to_umum)
    }
    if (id === 'rupslb') when = d(ma.rupslb)
    if (id === 'injeksi') when = d(ma.inbreng) || d(ma.rights)
    if (id === 'selesai') when = d(ma.bisnis)
    const state = i < idx ? 'done' : i === idx ? 'cur' : 'plan'
    return { id, title, when: when || (state === 'plan' ? 'belum ada jadwal' : 'tanggal belum ada'), state }
  })
})
</script>

<template>
  <p v-if="!pv" class="muted">Belum ada pandangan analis untuk {{ ticker }}.</p>

  <div v-else class="rk">
    <p class="lead">{{ pv.ringkas }}</p>
    <div v-if="(pv.pembaruan || []).length" class="small"><b>Pembaruan {{ fmtDate(pv.asOf) }}:</b>
      <ul><li v-for="x in pv.pembaruan" :key="x">{{ x }}</li></ul></div>
    <p v-if="pv.asOf" class="small muted asof">Pandangan per {{ fmtDate(pv.asOf) }}<template v-if="pv.hargaAcuan != null && item?.price != null && pv.hargaAcuan !== item.price"> pada harga Rp{{ pv.hargaAcuan.toLocaleString('id-ID') }}<template v-if="pv.hargaAsOf"> (per {{ fmtDate(tglHargaAcuan(pv)) }})</template>; harga kini Rp{{ Number(item.price).toLocaleString('id-ID') }}</template>.</p>

    <section class="rule-top" aria-labelledby="rk-ladder">
      <h2 id="rk-ladder" class="lbl">Harga terhadap level kunci (Rp)</h2>
      <template v-if="ladder">
        <div class="ladder" role="img" :aria-label="`Harga kini ${rpd(ladder.nowV)}; ` + ladder.ticks.map(t => `${t.l} ${rpd(t.v)}`).join(', ')">
          <div class="track"></div>
          <div v-if="ladder.zone" class="zone" :style="{ left: ladder.zone.l + '%', width: ladder.zone.w + '%' }"></div>
          <template v-for="t in ladder.ticks" :key="t.l">
            <div class="tk" :class="{ soft: t.soft }" :style="{ left: t.x + '%' }"></div>
            <div class="tl" :class="t.row" :style="{ left: clampX(t.x) }"><b>{{ rpd(t.v) }}</b><span>{{ t.l }}</span></div>
          </template>
          <div class="tk now" :style="{ left: ladder.now + '%' }"></div>
          <div class="tl nowl" :style="{ left: clampX(ladder.now) }">{{ rpd(ladder.nowV) }} kini</div>
        </div>
        <p class="small muted">
          <template v-if="ladder.zone">Hijau = rentang nilai wajar {{ rpd(ladder.lo) }}–{{ (+ladder.hi).toLocaleString('id-ID') }}. </template>
          <template v-if="ladder.gap > 0">Harga kini <b class="up">{{ ladder.gap }}% di atas</b> batas atas.</template>
          <template v-else-if="ladder.gap < 0">Harga kini <b class="down">{{ -ladder.gap }}% di bawah</b> batas bawah.</template>
          <template v-else-if="ladder.gap === 0">Harga kini di dalam rentang.</template>
        </p>
        <p v-if="pv.nilaiWajar?.metode" class="small muted">{{ pv.nilaiWajar.metode }}</p>
      </template>
      <p v-else class="muted">Harga atau nilai wajar belum ada.</p>
    </section>

    <div class="grid3">
      <section v-if="pv.dilusi?.berlaku" class="rule-top" aria-labelledby="rk-dil">
        <h2 id="rk-dil" class="lbl">Dilusi porsi publik</h2>
        <div class="row"><span>Sekarang</span><b>{{ pct(pv.dilusi.porsiPublikSekarang) }}</b></div>
        <div class="bar" aria-hidden="true"><i :style="{ width: pv.dilusi.porsiPublikSekarang + '%' }"></i></div>
        <div class="row"><span>Setelah (asumsi)</span><b class="up">±{{ pct(pv.dilusi.porsiPublikSetelah) }}</b></div>
        <div class="bar" aria-hidden="true"><i class="red" :style="{ width: pv.dilusi.porsiPublikSetelah + '%' }"></i></div>
        <p v-if="pv.dilusi.sahamBaru && pv.dilusi.sahamSekarang" class="small muted">
          +{{ miliar(pv.dilusi.sahamBaru) }} saham baru di atas {{ miliar(pv.dilusi.sahamSekarang) }} saham.
        </p>
      </section>
      <section class="rule-top" aria-labelledby="rk-ctrl">
        <h2 id="rk-ctrl" class="lbl">Pergerakan pengendali</h2>
        <p>{{ pv.pengendaliBergerak || 'belum ada' }}</p>
      </section>
      <section class="rule-top" aria-labelledby="rk-liq">
        <h2 id="rk-liq" class="lbl">Likuiditas</h2>
        <p>{{ pv.likuiditas || 'belum ada' }}</p>
      </section>
    </div>

    <section v-if="steps.length" class="rule-top" aria-labelledby="rk-tl">
      <h2 id="rk-tl" class="lbl">Linimasa</h2>
      <ol class="steps">
        <li v-for="s in steps" :key="s.id" :class="s.state">
          <b>{{ s.title }}</b>
          <span>{{ s.when }}</span>
          <span class="sr-only">{{ s.state === 'done' ? '(selesai)' : s.state === 'cur' ? '(tahap sekarang)' : '(rencana)' }}</span>
        </li>
      </ol>
    </section>

    <div class="grid2">
      <section class="rule-top" aria-labelledby="rk-pantau">
        <h2 id="rk-pantau" class="lbl">Pantau</h2>
        <ul v-if="pv.variabelKunci?.length"><li v-for="v in pv.variabelKunci" :key="v">{{ v }}</li></ul>
        <p v-else class="muted">belum ada</p>
      </section>
      <section class="rule-top judge" aria-labelledby="rk-gugur">
        <h2 id="rk-gugur" class="lbl">Tesis gugur bila</h2>
        <ul v-if="pv.tesisSalahBila?.length"><li v-for="v in pv.tesisSalahBila" :key="v">{{ v }}</li></ul>
        <p v-else class="muted">belum ada</p>
      </section>
    </div>

    <details class="more">
      <summary>Tesis lengkap dan asumsi</summary>
      <p>{{ pv.tesis || 'belum ada' }}</p>
      <template v-if="pv.dilusi?.berlaku">
        <h3 class="lbl">Asumsi dilusi</h3>
        <p>{{ pv.dilusi.asumsi || 'belum ada' }}</p>
        <p v-if="pv.dilusi.catatan">{{ pv.dilusi.catatan }}</p>
      </template>
    </details>

    <p class="small muted">Sumber: pandangan-analis.json (asOf {{ fmtDate(pv.asOf) }}).</p>
  </div>
</template>

<style scoped>
.asof{margin:-4px 0 0}
.rk{display:flex;flex-direction:column;gap:20px}
.lead{margin:0;font-size:16px;max-width:900px}
section p{margin:0 0 6px;max-width:80ch}
.lbl{margin:0 0 10px}
.ladder{position:relative;height:156px;margin:16px 8px 0}
.track{position:absolute;left:0;right:0;top:54px;height:14px;background:var(--rule-2);border-radius:2px}
.zone{position:absolute;top:54px;height:14px;background:var(--range)}
.tk{position:absolute;top:46px;height:30px;width:2px;margin-left:-1px;background:var(--ink)}
.tk.soft{background:var(--ink-2)}
.tk.now{top:36px;height:46px;width:4px;margin-left:-2px;background:var(--strong)}
.tl{position:absolute;transform:translateX(-50%);font-size:12px;white-space:nowrap;text-align:center;line-height:1.25;display:flex;flex-direction:column}
.tl span{color:var(--ink-2)}
.tl.below0{top:82px}
.tl.below1{top:82px;transform:translate(-50%,36px)}
.tl.above{top:4px}
.tl.nowl{top:-14px;color:var(--strong);font-weight:700;font-size:14px}
.up{color:var(--strong)}
.down{color:var(--good)}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}
.row{display:flex;justify-content:space-between;font-size:13px}
.row b{font:700 16px var(--f-display)}
.bar{height:12px;background:var(--rule-2);border-radius:2px;margin:3px 0 10px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.bar i.red{background:var(--strong)}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.steps li{padding-top:8px;border-top:4px solid var(--rule);font-size:12.5px;display:flex;flex-direction:column}
.steps li span{color:var(--ink-2)}
.steps li.done{border-top-color:var(--accent)}
.steps li.cur{border-top-color:var(--now)}
.steps li.cur span{color:var(--now-ink)}
.judge{background:var(--sheet-2);padding:12px 14px}
ul{margin:0;padding-left:18px}
li{margin:3px 0}
.more{border-top:1px solid var(--rule);padding-top:10px}
.more summary{cursor:pointer;font-weight:600;min-height:28px}
.more p{max-width:900px}
@media (max-width:760px){
  .steps{grid-template-columns:1fr;gap:0}
  .steps li{border-top:0;border-left:4px solid var(--rule);padding:4px 0 8px 10px}
  .steps li.done{border-left-color:var(--accent)}
  .steps li.cur{border-left-color:var(--now)}
  .grid2{grid-template-columns:1fr}
}
</style>
