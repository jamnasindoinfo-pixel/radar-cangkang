<script setup>
// Stockbit Reports per emiten radar (halaman Berita): laporan terakhir tiap emiten beserta analisa otomatisnya
// (jenis, nada & dasarnya, angka kunci, arti bagi radar, yang dipantau), lalu laporan lain 30 hari terakhir.
// Analisa hanya dari judul, ringkasan AI Stockbit, dan butir laporan (lib/laporanAnalisa.js).
import { computed, ref } from 'vue'
import { store } from '../store.js'
import { fmtDate, stageOf, STAGES } from '../lib/domain.js'
import { laporanPerEmiten, analisaLaporan, JENIS_LAPORAN } from '../lib/laporanAnalisa.js'

const props = defineProps({ q: { type: String, default: '' } })
const NADA = { perhatian: ['Perlu perhatian', 't-warn'], positif: ['Positif', 't-good'], netral: ['Netral', 't-calm'] }
const tahap = it => STAGES.find(s => s.id === stageOf(it || {}))?.name || ''

const semua = computed(() => laporanPerEmiten(store.updates, store.items))
const fJenis = ref(''), fNada = ref('')
const daftar = computed(() => {
  const w = props.q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return semua.value.filter(p => (!fJenis.value || p.analisa.jenis.id === fJenis.value) && (!fNada.value || p.analisa.nada === fNada.value)
    && w.every(x => [p.t, p.item?.name, p.terakhir.title, p.terakhir.summary].join(' ').toLowerCase().includes(x)))
})
const hitung = (k, v) => semua.value.filter(p => (k === 'jenis' ? p.analisa.jenis.id : p.analisa.nada) === v).length
const buka = ref({})
</script>

<template>
  <section class="ls" aria-label="Stockbit Reports per emiten">
    <p class="small muted intro">Laporan terakhir dari Stockbit Reports untuk {{ semua.length }} emiten di radar, beserta analisa otomatis dari judul
      dan ringkasan AI Stockbit. Analisa ini titik awal; baca dokumen aslinya sebelum mengambil keputusan.</p>
    <div class="seg">
      <span class="lbl">Jenis</span>
      <button type="button" class="pill sm" :aria-pressed="String(!fJenis)" @click="fJenis = ''">Semua <b>{{ semua.length }}</b></button>
      <template v-for="j in JENIS_LAPORAN" :key="j.id">
        <button v-if="hitung('jenis', j.id)" type="button" class="pill sm" :aria-pressed="String(fJenis === j.id)" @click="fJenis = j.id">{{ j.nama }} <b>{{ hitung('jenis', j.id) }}</b></button>
      </template>
    </div>
    <div class="seg">
      <span class="lbl">Nada</span>
      <button type="button" class="pill sm" :aria-pressed="String(!fNada)" @click="fNada = ''">Semua</button>
      <button v-for="(v, k) in NADA" :key="k" type="button" class="pill sm" :aria-pressed="String(fNada === k)" @click="fNada = k">{{ v[0] }} <b>{{ hitung('nada', k) }}</b></button>
    </div>
    <p v-if="!daftar.length" class="muted empty">Tidak ada laporan yang cocok.</p>
    <article v-for="p in daftar" :key="p.t" class="kartu">
      <header class="kh">
        <RouterLink class="tk" :to="{ path: '/emiten/' + p.t, query: { tab: 'berita' } }">{{ p.t }}</RouterLink>
        <span class="muted nm">{{ p.item?.name }}</span>
        <span v-if="tahap(p.item)" class="tag t-calm">{{ tahap(p.item) }}</span>
        <span class="small muted kanan">{{ p.total }} laporan tersimpan</span>
      </header>
      <div class="lap">
        <div class="lt"><span class="d">{{ fmtDate(String(p.terakhir.date).slice(0, 10)) }}</span>
          <a :href="p.terakhir.url" target="_blank" rel="noopener"><b>{{ p.terakhir.title }}</b></a></div>
        <p v-if="p.analisa.inti" class="inti"><span class="ik">Inti (ringkasan AI Stockbit)</span>{{ p.analisa.inti }}</p>
        <p v-else-if="p.analisa.ringkasan" class="inti">{{ p.analisa.ringkasan }}</p>
        <ul v-if="p.analisa.butir.length" class="small butir"><li v-for="b in p.analisa.butir" :key="b">{{ b }}</li></ul>
      </div>
      <div class="an">
        <div class="tags">
          <span class="tag t-now">{{ p.analisa.jenis.nama }}</span>
          <span class="tag" :class="NADA[p.analisa.nada][1]">{{ NADA[p.analisa.nada][0] }}</span>
          <span v-for="j in p.analisa.jenisLain" :key="j" class="tag">{{ j }}</span>
        </div>
        <p class="small"><b>Dasar nada:</b> {{ p.analisa.dasar.join('; ') }}.</p>
        <p v-if="p.analisa.angka.length" class="small angka"><b>Angka kunci:</b>
          <span v-for="a in p.analisa.angka" :key="a.v" class="ak">{{ a.v }}</span></p>
        <p class="small"><b>Arti bagi radar:</b> {{ p.analisa.jenis.arti }}</p>
        <p class="small"><b>Pantau berikutnya:</b> {{ p.analisa.jenis.pantau }}</p>
      </div>
      <details v-if="p.lain.length" class="small lain" :open="buka[p.t]" @toggle="buka[p.t] = $event.target.open">
        <summary>{{ p.lain.length }} laporan lain dalam 30 hari terakhir</summary>
        <ul><li v-for="u in p.lain" :key="u.id"><span class="d">{{ fmtDate(String(u.date).slice(0, 10)) }}</span>
          <a :href="u.url" target="_blank" rel="noopener">{{ u.title }}</a>
          <span class="tag sm">{{ analisaLaporan(u).jenis.nama }}</span></li></ul>
      </details>
    </article>
  </section>
</template>

<style scoped>
.ls{display:flex;flex-direction:column;gap:10px}
.intro{margin:0}
.seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.lbl{font:700 11px var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);min-width:44px}
.pill b{margin-left:4px;font-weight:600;color:var(--ink-2)}
.kartu{background:var(--sheet);border:1px solid var(--rule);border-top:2px solid var(--ink);padding:12px 14px;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:6px 18px}
.kh{grid-column:1/-1;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.tk{font:800 18px var(--f-display);color:var(--ink);text-decoration:none}.tk:hover{text-decoration:underline}
.kanan{margin-left:auto}
.lt{display:flex;gap:10px;align-items:baseline}.lt a{color:var(--ink)}
.d{font:600 13px var(--f-display);color:var(--ink-2);white-space:nowrap}
.inti{margin:6px 0;font-size:14px}.ik{display:block;font:700 10.5px var(--f-data);letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:2px}
.butir{margin:4px 0;padding-left:18px;color:var(--ink-2)}
.an{border-left:3px solid var(--rule);padding-left:12px}.an p{margin:5px 0}
.tags{display:flex;flex-wrap:wrap;gap:4px}
.ak{display:inline-block;margin:2px 4px 0 0;padding:1px 7px;border:1px solid var(--rule);border-radius:9px;font-family:var(--f-data);background:var(--paper)}
.lain{grid-column:1/-1;border-top:1px dotted var(--rule);padding-top:6px}.lain summary{cursor:pointer;color:var(--ink-2)}
.lain ul{list-style:none;margin:6px 0 0;padding:0}.lain li{display:flex;gap:8px;align-items:baseline;padding:3px 0}
.lain a{color:var(--ink)}.tag.sm{font-size:11px}
.empty{padding:12px}
@media (max-width:860px){.kartu{grid-template-columns:1fr}.an{border-left:0;padding-left:0;border-top:1px dotted var(--rule);padding-top:6px}}
</style>
