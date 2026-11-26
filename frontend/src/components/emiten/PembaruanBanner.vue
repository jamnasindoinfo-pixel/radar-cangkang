<script setup>
// Penanda laporan baru: laporan Stockbit material yang terbit setelah tanggal analisa/riset kurasi emiten ini.
// Data dari sinkron server tiap 2 jam (store.updates), sehingga setiap laporan baru langsung terlihat di semua tab.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { store } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import { laporanBaru } from '../../lib/pembaruan.js'

const props = defineProps({ ticker: { type: String, required: true } })
const lb = computed(() => laporanBaru(store.updates, props.ticker, { pandangan: store.pandangan, riset: store.riset }))
const buka = ref(false)
const route = useRoute()
</script>

<template>
  <aside v-if="lb" class="pb" role="status">
    <button type="button" class="hd" :aria-expanded="String(buka)" @click="buka = !buka">
      <b>{{ lb.items.length }} laporan baru sejak {{ lb.jenis }} per {{ fmtDate(lb.sejak) }}</b>
      <span class="small">terbaru {{ fmtDate(lb.items[0].date) }}: {{ lb.items[0].points[0] || lb.items[0].title }}</span>
      <span class="car" aria-hidden="true">{{ buka ? '▾' : '▸' }}</span>
    </button>
    <ol v-if="buka" class="ls">
      <li v-for="x in lb.items" :key="x.url"><span class="d">{{ fmtDate(x.date) }}</span>
        <div><a :href="x.url" target="_blank" rel="noopener"><b>{{ x.title }}</b></a>
          <ul v-if="x.points.length" class="small"><li v-for="p in x.points" :key="p">{{ p }}</li></ul>
          <p v-else class="small muted">{{ x.summary }}</p></div></li>
    </ol>
    <p v-if="buka" class="small muted nt">Angka dan fakta aset dari laporan ini otomatis tampil di tab Aset; narasi analisa diperbarui pada kurasi berikutnya.
      <RouterLink :to="{ query: { ...route.query, tab: 'berita' } }">Analisa berita terbaru + unduh PDF →</RouterLink></p>
  </aside>
</template>

<style scoped>
.pb{border:1px solid var(--now-ink);border-left-width:4px;background:var(--sheet);margin:10px 0}
.hd{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;width:100%;text-align:left;background:none;border:0;padding:8px 12px;cursor:pointer;font:inherit;color:inherit}
.hd b{color:var(--now-ink)}.hd .small{flex:1;min-width:200px;color:var(--ink-2)}.car{color:var(--muted)}
.ls{list-style:none;margin:0;padding:0 12px}.ls>li{display:grid;grid-template-columns:90px 1fr;gap:10px;padding:7px 0;border-top:1px solid var(--rule-2)}
.d{font:600 12px var(--f-display);color:var(--ink-2)}.ls ul{margin:4px 0 0;padding-left:18px}
.nt{padding:0 12px 8px;margin:0}
</style>
