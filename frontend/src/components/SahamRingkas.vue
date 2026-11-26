<script setup>
// Panel rincian satu saham (klik baris/kartu di Seasonality, Pola Broker, Recovery): alasan (turun dari puncak,
// Seasonality bulan terpilih, broker bulan terakhir, teknikal), komponen skor, dan trading plan dari /api/saham-detail.
// plan=false menyembunyikan trading plan (dipakai bila induknya sudah menampilkan plan sendiri).
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { isHsc } from '../lib/hsc.js'

const props = defineProps({ kode: { type: String, required: true }, bulan: { type: Number, default: 0 }, plan: { type: Boolean, default: true } })
const d = ref(null), err = ref('')
const cache = new Map()
watch(() => [props.kode, props.bulan], async ([k, b]) => {
  err.value = ''
  const key = k + '|' + b
  if (cache.has(key)) { d.value = cache.get(key); return }
  d.value = null
  try {
    const r = await api.get('/api/saham-detail', b ? { kode: k, bulan: b } : { kode: k })
    if (r.error) err.value = r.error; else { cache.set(key, r); d.value = r }
  } catch (e) { err.value = e.message || String(e) }
}, { immediate: true })

const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const cls = s => s === 'Siap rebound' ? 'c-good' : s === 'Mulai pulih' ? 'c-warn' : 'muted'
</script>

<template>
  <div class="sr">
    <p v-if="err" class="small muted">{{ err }}</p>
    <p v-else-if="!d" class="small muted">Memuat rincian {{ kode }}…</p>
    <div v-else class="dg">
      <div>
        <h4>Alasan <span v-if="d.status" class="small" :class="cls(d.status)" title="Status & skor Recovery (turun 30 + Seasonality 25 + broker 25 + teknikal 20)">· status rebound: {{ d.status }}<template v-if="d.skor != null"> (skor {{ d.skor }})</template></span>
          <span v-if="isHsc(kode)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span></h4>
        <ul class="small"><li v-for="a in d.alasan" :key="a">{{ a }}</li></ul>
        <p v-if="d.broker?.broker?.length" class="small muted">Broker utama {{ d.broker.dist ? 'distribusi' : 'akumulasi' }}: {{ d.broker.broker.join(', ') }}</p>
        <p v-if="d.komponen" class="small muted">Komponen skor: turun {{ d.komponen.turun }}/30 · Seasonality {{ d.komponen.seasonality }}/25 · broker {{ d.komponen.broker }}/25 · teknikal {{ d.komponen.teknikal }}/20</p>
      </div>
      <div v-if="plan">
        <h4>Trading plan{{ d.planSeason ? ' (Seasonality)' : d.planRebound ? ' rebound' : '' }}</h4>
        <dl v-if="d.planSeason" class="small pl">
          <dt>Area beli</dt><dd>{{ rp(d.planSeason.entry[0]) }}–{{ rp(d.planSeason.entry[1]) }}</dd>
          <dt>Ambil untung</dt><dd class="c-good">{{ rp(d.planSeason.tp1) }} lalu {{ rp(d.planSeason.tp2) }}</dd>
          <dt>Batas rugi</dt><dd class="c-strong">{{ rp(d.planSeason.sl) }} ({{ d.planSeason.slPct }}%)</dd>
          <dt>R/R</dt><dd>{{ d.planSeason.rr ?? '–' }}</dd>
          <dt>Masuk / keluar</dt><dd>{{ d.planSeason.masuk }} · {{ d.planSeason.keluar }}</dd>
        </dl>
        <dl v-else-if="d.planRebound" class="small pl">
          <dt>Area beli</dt><dd>{{ rp(d.planRebound.entry[0]) }}–{{ rp(d.planRebound.entry[1]) }}</dd>
          <dt>Ambil untung</dt><dd class="c-good">{{ rp(d.planRebound.tp1) }} lalu {{ rp(d.planRebound.tp2) }}</dd>
          <dt>Batas rugi</dt><dd class="c-strong">{{ rp(d.planRebound.sl) }} (tutup harian di bawahnya)</dd>
          <dt>R/R</dt><dd>{{ d.planRebound.rr ?? '–' }}</dd>
        </dl>
        <p v-else class="small muted">Belum ada trading plan: saham tidak termasuk pola Seasonality bulan ini dan belum turun ≥ 30% dari puncaknya.</p>
        <dl v-if="d.tek" class="small pl">
          <dt>Harga</dt><dd>{{ rp(d.tek.harga) }} <span class="muted">({{ d.tek.tanggal }})</span></dd>
          <dt>Puncak / dasar</dt><dd>{{ rp(d.tek.tinggi52) }} / {{ rp(d.tek.rendah52) }}</dd>
          <dt>EMA20 / EMA50</dt><dd>{{ rp(d.tek.ema20) }} / {{ rp(d.tek.ema50) }}</dd>
        </dl>
      </div>
      <p class="small lk"><RouterLink :to="{ path: '/emiten/' + kode, query: { tab: 'analisa' } }">Buka analisa {{ kode }} ›</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
.sr{padding:6px 2px}
.dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px 18px}
.dg h4{margin:4px 0}.dg ul{margin:0;padding-left:18px}
.pl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0 0 6px}.pl dt{color:var(--muted)}.pl dd{margin:0;font-weight:600}
.lk{grid-column:1/-1;margin:2px 0 0}.tag{margin-left:6px}
.c-warn{color:var(--warn,#c79a1a)}
</style>
