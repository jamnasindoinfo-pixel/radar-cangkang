<script setup>
// Sel harga seragam: harga penutupan terakhir + perubahan harian, dan (bila ada avg broker) posisi harga terhadap avg.
// Dipakai bersama tab HSC, Pola Broker, Recovery, dan Low agar harga di semua tab sama dan saling terhubung.
import { computed } from 'vue'
import { fmt } from '../lib/domain.js'
import { hargaSaham } from '../lib/hargaSaham.js'

const props = defineProps({ kode: { type: String, required: true }, avg: { type: Number, default: null } })
const x = computed(() => hargaSaham(props.kode))
const rp = v => 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1) + '%'
const nada = v => v > 0 ? 'c-good' : v < 0 ? 'c-strong' : 'muted'
const vsAvg = computed(() => x.value && props.avg ? (x.value.h / props.avg - 1) * 100 : null)
const judul = computed(() => x.value ? [['1W', x.value.w], ['1M', x.value.m], ['YTD', x.value.y]]
  .filter(([, v]) => v != null).map(([k, v]) => `${k} ${pct(v)}`).join(' · ') + ` · penutupan ${x.value.tgl || '–'}` : '')
</script>

<template>
  <span v-if="!x" class="muted">–</span>
  <span v-else class="hs" :title="judul">
    <b>{{ rp(x.h) }}</b>
    <span v-if="x.d != null" class="small ln" :class="nada(x.d)">{{ pct(x.d) }} 1D</span>
    <span v-if="vsAvg != null" class="small muted ln">{{ pct(vsAvg) }} vs avg</span>
  </span>
</template>

<style scoped>
.hs{white-space:nowrap;display:inline-block;line-height:1.3}.ln{display:block}
</style>
