<script setup>
// Angka berhitung naik: bagian angka pertama dalam teks (format Indonesia, mis. "Rp2,05 T", "±91%", "1.253")
// dianimasikan dari 0 ke nilainya; teks di sekitarnya tetap. Hormati prefers-reduced-motion.
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ text: { type: [String, Number], default: '' }, ms: { type: Number, default: 900 } })
const out = ref(String(props.text ?? ''))
let raf = 0
function run() {
  cancelAnimationFrame(raf)
  const s = String(props.text ?? ''), m = s.match(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!m || reduce) { out.value = s; return }
  const raw = m[0], dec = (raw.split(',')[1] || '').length, thou = raw.includes('.')
  const target = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  const fmtN = v => v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: thou })
  const pre = s.slice(0, m.index), post = s.slice(m.index + raw.length), t0 = performance.now()
  const tick = now => {
    const p = Math.min(1, (now - t0) / props.ms), e = 1 - Math.pow(1 - p, 3)
    out.value = pre + fmtN(target * e) + post
    if (p < 1) raf = requestAnimationFrame(tick); else out.value = s
  }
  raf = requestAnimationFrame(tick)
}
watch(() => props.text, run, { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template><span>{{ out }}</span></template>
