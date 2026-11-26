<script setup>
import { computed, ref } from 'vue'
import { store, storyOf, itemOf } from '../../store.js'
import { STAGES, big, fmt, fmtDate, num, progressOf, stageOf, x2 } from '../../lib/domain.js'
import { storyValuation } from '../../lib/emitenExtra.js'
import ControllerDialog from './ControllerDialog.vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['flow'])

const story = computed(() => storyOf(props.ticker))
const pg = computed(() => store.pengendali[props.ticker] || null)
const v = computed(() => store.verified[props.ticker] || null)
// Kartu injeksi bisa diklik bila ada data aset (aset-verified.json), relasi injeksi, atau jenis injeksi terverifikasi.
const inj = computed(() => !!(store.aset[props.ticker] || store.relasi[props.ticker]?.injeksi || v.value?.injectType))
const sval = computed(() => {
  const mc = num(itemOf(props.ticker)?.mcap)
  return storyValuation(store.aset[props.ticker], { sv: v.value, mcapRp: mc != null ? mc * 1e9 : null })
})

const lama = computed(() => story.value?.lama || '')
const baru = computed(() => story.value?.baru || v.value?.baru || '')
const injText = computed(() => {
  if (v.value?.injectType || v.value?.injectTarget) return [v.value.injectType, v.value.injectTarget].filter(Boolean).join(' · ')
  return story.value?.inject || ''
})
const nominal = computed(() => v.value?.nominal || story.value?.nominal || '')
const it = computed(() => itemOf(props.ticker))
const ctrl = computed(() => it.value?.ctrlName || it.value?.acquirer || '')
const ctrlPct = computed(() => num(pg.value?.ctrlPct ?? it.value?.ctrlPct))
const oldPct = computed(() => story.value?.oldPct ? Math.min(100, story.value.oldPct) : null)
const prog = computed(() => it.value ? progressOf(it.value, { aset: store.aset, verified: store.verified }) : null)
const stageName = computed(() => it.value ? (STAGES.find(x => x.id === stageOf(it.value)) || STAGES[0]).name : '')
// Penanda asal data: koreksi manual ("diubah") atau laporan sumber ("sumber {tanggal}").
const srcTag = (edited, src) => edited ? { t: 'diubah' } : src ? { t: 'sumber ' + fmtDate(src.date), title: src.title, url: src.url } : null
const baruTag = computed(() => story.value && srcTag(story.value.baruEdited, story.value.baruSrc))
const injTag = computed(() => story.value && srcTag(story.value.injectEdited, story.value.injectSrc))
const target = computed(() => v.value?.target || story.value?.target || '')

const sources = computed(() => {
  const out = []
  if (pg.value?.sumberJudul) out.push(pg.value.sumberJudul + (pg.value.sumberTanggal ? ' · ' + fmtDate(pg.value.sumberTanggal) : ''))
  if (v.value?.sourceTitle) out.push(v.value.sourceTitle + (v.value.sourceDate ? ' · ' + fmtDate(v.value.sourceDate) : ''))
  for (const s of v.value?.sumberTambahan || []) if (!/diakses/i.test(s)) out.push(s)
  return [...new Set(out)]
})

// Isian otomatis bila belum ada data kurasi: dari keterbukaan BEI / berita emiten (store.updates), terbaru dulu.
const reps = computed(() => store.updates.filter(u => u.ticker === props.ticker).sort((a, b) => (b.date || '').localeCompare(a.date || '')))
const RUTIN = /bukti iklan|laporan bulanan|corporate secretary|sekretaris perusahaan|penjelasan atas permintaan penjelasan|volatilitas|registrasi pemegang efek/i
const RENCANA = /rencana|akan|tender|penawaran|hmetd|rights issue|pmthmetd|penambahan modal|rupslb|luar biasa|pengambilalihan|negosiasi|ppjb|cspa|cessie|kreditur|pengendali|perubahan (kegiatan|nama)/i
const kalimat = u => (u.summary || '').split(/(?<=[.!?])\s+/).find(x => x.length > 30) || u.title
const rencanaAuto = computed(() => {
  const u = reps.value.find(x => !RUTIN.test(x.title || '') && RENCANA.test(`${x.title} ${x.summary || ''}`))
  return u ? { teks: kalimat(u), u } : null
})
// Pengendali saat ini dari profil emiten (tebakan pemegang terbesar) belum tentu pengendali BARU.
// Dianggap pengendali BARU bila ada pengakuisisi, tahap sudah lewat penyaringan, atau pengambilalihan tercatat <= 1 tahun.
const baruTercatat = computed(() => {
  const d = story.value?.takeoverDate
  return !!it.value?.acquirer || (it.value && stageOf(it.value) !== 'radar') || (!!d && Date.now() - new Date(d) <= 365 * 864e5)
})
const ctrlBaru = computed(() => baruTercatat.value ? ctrl.value : '')
const ctrlKini = computed(() => !ctrlBaru.value && ctrl.value ? ctrl.value : '')
const sumberAuto = computed(() => reps.value.filter(x => !RUTIN.test(x.title || '')).slice(0, 4))

const dlg = ref('')
const route = useRoute(), router = useRouter()
// Analisa aset lengkap (riset, KJPP, mekanisme) ada di tab Aset.
const keAset = () => router.replace({ query: { ...route.query, tab: 'aset' } })
function toFlow(node) { dlg.value = ''; emit('flow', node) }
</script>

<template>
  <div class="st">
    <button type="button" class="card rule-top click" aria-haspopup="dialog" @click="dlg = 'ctrl'">
      <h2 class="lbl">Siapa pengendali baru<template v-if="story?.takeoverDate"> · sejak {{ fmtDate(story.takeoverDate) }}</template></h2>
      <p>{{ pg?.siapa || ctrlBaru || 'belum ada' }}<span v-if="!pg?.siapa && ctrlKini" class="small muted"> · pengendali saat ini: {{ ctrlKini }}</span></p>
      <div v-if="ctrlPct != null && (pg?.siapa || ctrlBaru)" class="own"><b class="num">{{ fmt(ctrlPct, 2) }}%</b><span class="hbar" aria-hidden="true"><i :style="{ width: Math.min(100, ctrlPct) + '%' }"></i></span></div>
      <span class="go">Lihat profil lengkap</span>
    </button>

    <section class="card rule-top">
      <h2 class="lbl">Pengendali lama<span v-if="story?.oldEdited" class="tag t-calm">diubah</span></h2>
      <p>{{ story?.oldName || (story?.loaded ? (story?.takeoverDate ? 'belum tercatat di KSEI' : 'belum ada') : 'memuat') }}
        <span v-if="story?.oldInferred" class="tag t-warn" title="Penjual tidak tercatat; ini pemegang saham 20% ke atas terakhir sebelum pengambilalihan">perkiraan</span></p>
      <div v-if="oldPct" class="own"><b class="num">{{ fmt(oldPct, 2) }}%</b><span class="hbar old" aria-hidden="true"><i :style="{ width: oldPct + '%' }"></i></span></div>
    </section>

    <section v-if="prog" class="card rule-top">
      <h2 class="lbl">Progress</h2>
      <div class="own"><b class="num big">{{ prog.pct }}%</b><span class="hbar" :class="{ est: prog.est }" aria-hidden="true"><i :style="{ width: prog.pct + '%' }"></i></span></div>
      <p class="small muted">{{ stageName }}<template v-if="prog.est"> · estimasi berbasis tahap</template></p>
    </section>

    <section class="card rule-top">
      <h2 class="lbl">Bisnis lama ke baru</h2>
      <div class="biz">
        <span class="chip old">{{ lama || 'belum ada' }}</span>
        <svg width="34" height="14" viewBox="0 0 34 14" role="img" aria-label="menjadi"><path d="M1 7h30M25 1.5 31 7l-6 5.5" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
        <span class="chip new">{{ baru || 'belum ada' }}</span>
      </div>
      <p class="tags small">
        <span v-if="story?.lamaEdited" class="tag t-calm">lama diubah</span>
        <template v-if="baruTag"><a v-if="baruTag.url" class="tag t-calm" :href="baruTag.url" :title="baruTag.title" target="_blank" rel="noopener">{{ baruTag.t }}</a><span v-else class="tag t-calm">{{ baruTag.t }}</span></template>
      </p>
      <p v-if="story?.lamaNote" class="small muted">{{ story.lamaNote.slice(0, 180) }}</p>
    </section>

    <component :is="inj ? 'button' : 'section'" :type="inj ? 'button' : undefined" class="card rule-top" :class="{ click: inj }"
      :title="inj ? 'Buka tab Aset' : undefined" @click="inj && keAset()">
      <h2 class="lbl">Injeksi<span v-if="injTag" class="tag t-calm" :title="injTag.title">{{ injTag.t }}</span></h2>
      <p>{{ injText || 'belum ada' }}<template v-if="nominal"> · {{ nominal }}</template></p>
      <p v-if="sval" class="val">
        <span v-if="sval.sektor" class="tag t-calm">{{ sval.sektor }}</span>
        <span v-if="sval.val" class="small"><b>{{ big(sval.val) }}</b><template v-if="sval.ratio"> · {{ x2(sval.ratio) }} kapitalisasi</template></span>
        <span class="tag" :class="'t-' + sval.kjpp.tone">{{ sval.kjpp.label }}</span>
      </p>
      <span v-if="inj" class="go">Lihat aset, KJPP, dan simulasi</span>
    </component>

    <section class="card rule-top">
      <h2 class="lbl">Rencana</h2>
      <p v-if="pg?.rencana">{{ pg.rencana }}</p>
      <p v-else-if="rencanaAuto">{{ rencanaAuto.teks }}
        <a class="tag t-calm" :href="rencanaAuto.u.url" :title="rencanaAuto.u.title" target="_blank" rel="noopener">sumber {{ fmtDate(rencanaAuto.u.date) }}</a></p>
      <p v-else>belum ada</p>
    </section>

    <section class="card rule-top judge">
      <h2 class="lbl">Catatan</h2>
      <p>{{ pg?.catatan || it?.notes || 'belum ada' }}</p>
    </section>

    <section class="card rule-top">
      <h2 class="lbl">Target<span v-if="story?.targetEdited" class="tag t-calm">diubah</span></h2>
      <p>{{ target || 'belum ada' }}</p>
    </section>

    <section class="card rule-top wide">
      <h2 class="lbl">Sumber</h2>
      <p v-if="story?.verified" class="vnote small"><b>Dicek dengan Stockbit Reports<template v-if="story.vSrc"> · {{ fmtDate(story.vSrc.date) }}</template></b>
        <span v-if="story.vNote" class="muted">{{ story.vNote }}</span></p>
      <ul v-if="sources.length" class="small"><li v-for="s in sources" :key="s">{{ s }}</li></ul>
      <ul v-else-if="sumberAuto.length" class="small">
        <li v-for="u in sumberAuto" :key="u.url"><a :href="u.url" target="_blank" rel="noopener">{{ u.title }}</a> <span class="muted">· {{ u.source || 'Stockbit' }} · {{ fmtDate(u.date) }}</span></li>
      </ul>
      <p v-else class="muted">belum ada</p>
    </section>

    <ControllerDialog v-if="dlg === 'ctrl'" :ticker="ticker" @close="dlg = ''" @flow="toFlow" />
  </div>
</template>

<style scoped>
.st{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px 20px}
.card{display:block;width:100%;text-align:left;font:inherit;color:inherit;background:none;border-left:0;border-right:0;border-bottom:0;padding:12px 0 0;margin:0}
.card p{margin:0 0 6px;max-width:80ch}
.lbl{margin:0 0 8px}
.click{cursor:pointer}
.click:hover .go{text-decoration:underline}
.click:hover{background:var(--accent-soft)}
.go{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-weight:600;color:var(--accent)}
.go::after{content:"";width:8px;height:8px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg)}
.biz{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.biz svg{color:var(--ink-2);flex:none}
.chip{padding:6px 10px;border-radius:3px}
.chip.old{background:var(--calm-bg)}
.chip.new{background:var(--accent-soft);border:1px solid var(--accent);font-weight:600}
.val{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.judge{background:var(--sheet-2);padding:12px 14px}
.wide{grid-column:1/-1}
.lbl .tag{margin-left:8px;text-transform:none;letter-spacing:0}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.tags:empty{display:none}
a.tag{text-decoration:none}
a.tag:hover{text-decoration:underline}
.own{display:flex;align-items:center;gap:10px;margin:4px 0 6px}
.num{font:700 15px var(--f-display);white-space:nowrap}
.num.big{font-size:24px}
.hbar{flex:1;max-width:260px;height:6px;background:var(--rule-2);border-radius:3px;overflow:hidden}
.hbar i{display:block;height:100%;background:var(--accent)}
.hbar.old i{background:var(--rail-mute)}
.hbar.est i{background:repeating-linear-gradient(90deg,var(--accent) 0 6px,transparent 6px 9px)}
.vnote{margin-bottom:8px;max-width:80ch}
.vnote b{color:var(--good);margin-right:6px}
ul{margin:0;padding-left:18px}
li{margin:3px 0}
@media (max-width:760px){.st{grid-template-columns:1fr}}
</style>
