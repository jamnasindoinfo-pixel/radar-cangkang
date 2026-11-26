<script setup>
// Tanggapan emiten atas permintaan penjelasan BEI yang terakhir (ri-dokumen.json → penjelasanBursa), disajikan
// sebagai memo riset: kesimpulan dan dampak terhadap tesis di depan, lalu poin utama, implikasi investasi,
// hal yang belum terjawab (otomatis dari poin[].kurang), dan yang dipantau. Tanya-jawab lengkap jadi lampiran.
import { fmtDate, PB_NADA, PB_DASAR, PB_KRITERIA } from '../../lib/domain.js'
import { computed } from 'vue'
const props = defineProps({ pb: { type: Object, required: true } })
const memo = computed(() => props.pb.memo || null)
// Yang tidak dijawab sama sekali didahulukan, lalu yang dijawab sebagian.
const belum = computed(() => (props.pb.poin || []).filter(x => x.jawaban !== 'lengkap' && x.kurang)
  .sort((p, q) => (p.jawaban === 'tidak' ? 0 : 1) - (q.jawaban === 'tidak' ? 0 : 1)))
const lengkap = computed(() => (props.pb.poin || []).filter(x => x.jawaban === 'lengkap').length)
const DAMPAK = { negatif: ['Negatif', 't-strong'], netral: ['Netral', 't-calm'], positif: ['Positif', 't-good'] }
const dampak = computed(() => DAMPAK[props.pb.dampak] || DAMPAK.netral)
// Nomor pertanyaan BEI (1a, 2b, ...) bila datanya tersedia.
const adaNo = computed(() => (props.pb.poin || []).some(x => x.no))
const n = x => PB_NADA[x] || PB_NADA.netral
</script>

<template>
  <section class="pb rule-top">
    <div class="hd">
      <h2 class="lbl">Memo riset: tanggapan atas permintaan penjelasan bursa</h2>
      <span class="small muted">
        {{ pb.tanggal ? fmtDate(pb.tanggal) : '' }} · {{ (pb.poin || []).length }} butir pertanyaan BEI
        <a v-if="/^https:\/\/(emitten-announcement\.stockbit\.com|www\.idx\.co\.id\/StaticData)\//.test(pb.url || '')" :href="pb.url" target="_blank" rel="noopener">PDF</a>
      </span>
    </div>

    <!-- Kesimpulan di depan: judul memo + dampak terhadap tesis. -->
    <div class="top" :class="'k-' + (pb.dampak || 'netral')">
      <div class="row">
        <b class="ttl">{{ memo?.judul || pb.ringkas }}</b>
        <span class="tag" :class="dampak[1]">Dampak terhadap tesis: {{ dampak[0] }}</span>
      </div>
      <p v-if="pb.kesimpulan" class="small">{{ pb.kesimpulan }}</p>
    </div>

    <div v-if="memo" class="grid">
      <div class="card">
        <h3>Poin utama</h3>
        <ul><li v-for="x in memo.inti" :key="x">{{ x }}</li></ul>
      </div>
      <div class="card">
        <h3>Implikasi investasi</h3>
        <ul><li v-for="x in memo.implikasi" :key="x">{{ x }}</li></ul>
      </div>
      <div class="card">
        <h3>Belum terjawab <span class="muted small">({{ lengkap }} dari {{ (pb.poin || []).length }} butir dijawab lengkap)</span></h3>
        <ul v-if="belum.length"><li v-for="x in belum" :key="x.topik"><b>{{ x.no ? x.no + '. ' : '' }}{{ x.topik }}:</b> {{ x.kurang }}</li></ul>
        <p v-else class="small muted">Seluruh pertanyaan dijawab lengkap.</p>
      </div>
      <div class="card">
        <h3>Yang dipantau</h3>
        <ul><li v-for="x in memo.pantau" :key="x">{{ x }}</li></ul>
      </div>
    </div>

    <!-- Lampiran: tanya-jawab lengkap untuk verifikasi. -->
    <details class="lamp" open>
      <summary>Analisa per pertanyaan BEI ({{ (pb.poin || []).length }} butir)</summary>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th v-if="adaNo">No</th><th>Topik</th><th>Pertanyaan BEI</th><th>Jawaban emiten</th><th>Nada</th><th>Analisa</th></tr></thead>
          <tbody>
            <tr v-for="(x, i) in pb.poin || []" :key="i">
              <td v-if="adaNo" class="num">{{ x.no }}</td>
              <td><b>{{ x.topik }}</b></td>
              <td class="small">{{ x.tanya }}</td>
              <td class="small">{{ x.jawab }}</td>
              <td><span class="tag" :class="'t-' + n(x.nada)[1]">{{ n(x.nada)[0] }}</span><div v-if="PB_DASAR[x.dasar]" class="dasar"><b>{{ PB_DASAR[x.dasar] }}</b><span v-if="x.alasanNada">: {{ x.alasanNada }}</span></div></td>
              <td class="small">{{ x.analisa }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">{{ PB_KRITERIA }}</p>
    </details>
  </section>
</template>

<style scoped>
.pb{margin-bottom:14px}
.hd{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.top{margin:8px 0 12px;padding:12px 14px;border:1px solid var(--rule);border-left:4px solid var(--rule-2);background:var(--sheet)}
.top .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}
.top .ttl{font:700 16px var(--f-display)}
.top p{margin:6px 0 0;max-width:110ch}
.k-negatif{border-left-color:var(--strong)} .k-positif{border-left-color:var(--good)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (max-width:700px){.grid{grid-template-columns:1fr}}
.card{border:1px solid var(--rule);padding:10px 12px;background:var(--sheet)}
.card h3{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em}
.card ul{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.card li+li{margin-top:4px}
.lamp{margin-top:12px}
.lamp summary{cursor:pointer;font-weight:600}
.pb td{vertical-align:top}
.dasar{font-size:11px;color:var(--muted);margin-top:3px;min-width:170px;max-width:240px}
</style>
