<script setup>
// Cincin persentase kecil (0-100) dengan warna menurut ambang: >= 60 hijau, >= 45 kuning, di bawahnya merah.
import { computed } from 'vue'
const props = defineProps({ v: { type: Number, default: null }, size: { type: Number, default: 56 }, label: { type: String, default: '' } })
const r = 22, C = 2 * Math.PI * r
const warna = computed(() => props.v == null ? 'var(--rule)' : props.v >= 60 ? 'var(--good)' : props.v >= 45 ? 'var(--warn,#c79a1a)' : 'var(--strong)')
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 56 56" role="img" :aria-label="(label || 'Persentase') + ': ' + (v ?? '–') + '%'">
    <circle cx="28" cy="28" :r="r" fill="none" stroke="var(--rule)" stroke-width="6" />
    <circle cx="28" cy="28" :r="r" fill="none" :stroke="warna" stroke-width="6" stroke-linecap="round"
      :stroke-dasharray="`${C * Math.max(0, Math.min(100, v || 0)) / 100} ${C}`" transform="rotate(-90 28 28)" class="arc" />
    <text x="28" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">{{ v == null ? '–' : v + '%' }}</text>
  </svg>
</template>

<style scoped>
.arc{transition:stroke-dasharray .6s ease}
</style>
