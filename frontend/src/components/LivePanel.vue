<script setup>
// Live: grafik IHSG intraday (diperbarui server tiap menit saat jam bursa) + gabungan sinyal Astronacci, Time Series,
// Seasonality, Pola Broker, Recovery, dan pergerakan hari ini dari /api/ihsg-live, dengan narasi suara kondisi IHSG
// (naik/turun, potensi rebound atau potensi turun lagi). Suara memakai mesin suara browser (utamakan pria "Ardi").
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'
import { speakable } from '../lib/ucapan.js'

const data = ref(null), err = ref(''), loading = ref(true)
let poll = null
async function load() {
  try {
    const r = await api.get('/api/ihsg-live')
    if (r.error) { err.value = r.error } else { data.value = r; err.value = '' }
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
// Muat ulang tiap 10 detik saat jam bursa (server memperbarui tiap 20 detik), 5 menit di luar jam bursa; jeda saat tab tersembunyi.
function jadwal() {
  clearTimeout(poll)
  poll = setTimeout(async () => { if (!document.hidden) await load(); jadwal() }, data.value?.jamBursa === false ? 300000 : 10000)
}
onMounted(async () => { await load(); jadwal(); loadVoices(); synth?.addEventListener?.('voiceschanged', loadVoices) })
onBeforeUnmount(() => { clearTimeout(poll); synth?.cancel(); synth?.removeEventListener?.('voiceschanged', loadVoices) })

// Salin ringkasan kondisi IHSG sebagai teks biasa (siap tempel ke chat/WhatsApp).
const disalin = ref(false)
async function salin() {
  const d = data.value
  if (!d) return
  const t = [`IHSG ${d.tanggal || ''} ${d.waktu ? d.waktu.slice(11, 16) + ' WIB' : ''}`.trim(),
    `Harga: ${angka(d.harga)} (${d.ubahPct > 0 ? '+' : ''}${angka(d.ubahPct)}%)`,
    `Kesimpulan: ${d.label} (skor ${d.skor})`,
    d.arahTransaksi ? `Arah transaksi real time: ${d.arahTransaksi.label}` : null,
    d.support?.length ? `Support: ${d.support.slice(0, 2).map(v => angka(v, 0)).join(' / ')}` : null,
    d.resistance?.length ? `Resistance: ${d.resistance.slice(0, 2).map(v => angka(v, 0)).join(' / ')}` : null,
    '', ...(d.narasi || []).map(x => '- ' + x),
    '', 'https://saham.aseprudal.web.id/#/seasonality?tab=live'].filter(x => x !== null).join('\n')
  try { await navigator.clipboard.writeText(t); disalin.value = true; setTimeout(() => { disalin.value = false }, 2500) } catch { disalin.value = false }
}
const angka = (v, dp = 2) => v == null ? '–' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const toneOf = s => s > 0.15 ? 'c-good' : s < -0.15 ? 'c-strong' : 'muted'
const arahIkon = a => a === 'naik' ? '▲' : a === 'turun' ? '▼' : '◆'
const jam = t => (String(t).match(/(\d{1,2}:\d{2})/) || [])[1] || ''

// ---- grafik intraday (SVG) ----
const W = 800, H = 300, PAD = { l: 8, r: 64, t: 14, b: 26 }
const chart = computed(() => {
  const d = data.value
  const pts = d?.titik?.length ? d.titik : d ? [{ t: '', v: d.prev ?? d.harga }, { t: '', v: d.harga }] : []
  if (!pts.length) return null
  const vals = pts.map(p => p.v).concat(d.prev != null ? [d.prev] : [])
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const span = Math.max(hi - lo, d.harga * 0.004)
  lo -= span * 0.12; hi += span * 0.12
  const x = i => PAD.l + i / Math.max(1, pts.length - 1) * (W - PAD.l - PAD.r)
  const y = v => PAD.t + (hi - v) / (hi - lo) * (H - PAD.t - PAD.b)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${H - PAD.b}L${x(0).toFixed(1)},${H - PAD.b}Z`
  // Label waktu: ±5 titik merata dari stempel jam data.
  const lbl = []
  const step = Math.max(1, Math.floor(pts.length / 5))
  for (let i = 0; i < pts.length; i += step) if (jam(pts[i].t)) lbl.push({ x: x(i), t: jam(pts[i].t) })
  // Level support/resistance harian yang berada di rentang grafik.
  const lv = [...(d.support || []).map(v => ({ v, k: 'S' })), ...(d.resistance || []).map(v => ({ v, k: 'R' }))]
    .filter(l => l.v > lo && l.v < hi).map(l => ({ ...l, y: y(l.v) }))
  const naik = d.prev == null || d.harga >= d.prev
  return { line, area, lbl, lv, naik, yPrev: d.prev != null ? y(d.prev) : null, last: { x: x(pts.length - 1), y: y(d.harga) }, lo, hi }
})

// ---- suara ----
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
const MALE = /\b(ardi|andika|male|pria|laki)\b/i
const voice = ref(null)
function loadVoices() {
  const all = synth ? synth.getVoices().filter(v => /^id(-|_|$)/i.test(v.lang)) : []
  const rank = v => (MALE.test(v.name) ? 0 : 2) + (/(online|natural)/i.test(v.name) ? 0 : 1)
  voice.value = all.sort((a, b) => rank(a) - rank(b))[0] || null
}
const bicara = ref(false)
function suarakan() {
  if (!synth || !data.value) return
  synth.cancel()
  bicara.value = true
  const lines = data.value.narasi || []
  lines.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(speakable(t))
    u.lang = voice.value?.lang || 'id-ID'
    if (voice.value) u.voice = voice.value
    u.rate = 1; u.pitch = 1
    if (i === lines.length - 1) { u.onend = () => { bicara.value = false }; u.onerror = () => { bicara.value = false } }
    synth.speak(u)
  })
}
function diam() { synth?.cancel(); bicara.value = false }
// Suara otomatis: kondisi IHSG dibacakan tiap ada data menit baru (server memperbarui tiap menit saat jam bursa).
const otomatis = ref(false)
let terakhir = null
function cekOtomatis() {
  const d = data.value
  if (!otomatis.value || !d) return
  const kini = `${d.titik?.at(-1)?.t || d.waktu}|${d.harga}`
  if (kini !== terakhir) { terakhir = kini; suarakan() }
}
function toggleOtomatis() { otomatis.value = !otomatis.value; terakhir = null; if (otomatis.value) cekOtomatis(); else diam() }
watch(data, cekOtomatis)
</script>

<template>
  <section class="lv">
    <p class="small muted intro">Grafik IHSG berjalan (diperbarui otomatis tiap 20 detik saat jam bursa) dan kesimpulan gabungan dari
      <b>Astronacci</b>, <b>Time Series</b>, <b>Seasonality</b>, <b>Pola Broker</b>, <b>Recovery</b>, serta pergerakan hari ini —
      lengkap dengan suara kondisi IHSG. Aktifkan <b>Suara tiap menit</b> untuk mendengar kondisi terbaru setiap menit.</p>

    <p v-if="loading" class="muted">Memuat data Live…</p>
    <p v-else-if="err && !data" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Peringatan data tidak diperbarui (token ditolak / Stockbit tidak merespons). -->
      <p v-if="data.tertahan" class="tahan" role="alert">⚠ {{ data.tertahan.teks }}</p>
      <div class="top">
        <div class="harga">
          <div class="small muted">IHSG · {{ data.jamBursa ? 'jam bursa' : 'pasar tutup' }} · {{ data.tanggal }}</div>
          <div class="big">{{ angka(data.harga) }}</div>
          <div :class="(data.ubahPct ?? 0) >= 0 ? 'c-good' : 'c-strong'"><b>{{ data.ubah > 0 ? '+' : '' }}{{ angka(data.ubah) }} ({{ pct(data.ubahPct) }})</b>
            <span class="small muted"> vs penutupan {{ angka(data.prev) }}</span></div>
          <div class="small muted">Tertinggi {{ angka(data.tinggi) }} · terendah {{ angka(data.rendah) }}</div>
        </div>
        <div class="vonis" :class="'n-' + data.nada">
          <div class="small">Kesimpulan gabungan</div>
          <div class="lbl">{{ data.label }}</div>
          <div class="skor">Skor <b>{{ data.skor > 0 ? '+' : '' }}{{ data.skor }}</b> <span class="small">/ ±100</span></div>
          <div class="meter" aria-hidden="true"><span :style="{ left: (50 + data.skor / 2) + '%' }"></span></div>
        </div>
        <div class="suara">
          <button type="button" class="pill" :aria-pressed="String(bicara)" :disabled="!synth" @click="bicara ? diam() : suarakan()">{{ bicara ? '■ Hentikan suara' : '🔊 Suarakan kondisi' }}</button>
          <button type="button" class="pill" @click="salin">{{ disalin ? '✓ Tersalin' : '📋 Salin ringkasan' }}</button>
          <button type="button" class="pill" :aria-pressed="String(otomatis)" :disabled="!synth" @click="toggleOtomatis">Suara tiap menit: {{ otomatis ? 'aktif' : 'mati' }}</button>
          <span class="small muted">{{ voice ? voice.name : (synth ? 'Suara browser bawaan' : 'Browser tidak mendukung suara') }}</span>
        </div>
      </div>

      <figure class="grafik">
        <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`Grafik IHSG intraday, ${angka(data.harga)}`">
          <path :d="chart.area" :class="chart.naik ? 'ar-up' : 'ar-dn'" />
          <template v-for="l in chart.lv" :key="l.k + l.v">
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="l.y" :y2="l.y" class="lvl" />
            <text :x="W - PAD.r + 4" :y="l.y + 4" class="tx">{{ l.k }} {{ angka(l.v, 0) }}</text>
          </template>
          <template v-if="chart.yPrev != null">
            <line :x1="PAD.l" :x2="W - PAD.r" :y1="chart.yPrev" :y2="chart.yPrev" class="prev" />
            <text :x="W - PAD.r + 4" :y="chart.yPrev + 4" class="tx">{{ angka(data.prev, 0) }}</text>
          </template>
          <path :d="chart.line" :class="chart.naik ? 'ln-up' : 'ln-dn'" />
          <circle :cx="chart.last.x" :cy="chart.last.y" r="4" :class="chart.naik ? 'dot-up' : 'dot-dn'"><animate v-if="data.jamBursa" attributeName="r" values="4;7;4" dur="1.6s" repeatCount="indefinite" /></circle>
          <text v-for="l in chart.lbl" :key="l.x" :x="l.x" :y="H - 8" class="tx" text-anchor="middle">{{ l.t }}</text>
        </svg>
        <figcaption class="small muted">Garis putus = penutupan sebelumnya; S/R = support/resistance harian. Sumber: {{ data.sumber }} · diperbarui {{ data.waktu }}
          <template v-if="err"> · {{ err }}</template></figcaption>
      </figure>

      <div class="narasi">
        <p v-for="(t, i) in data.narasi" :key="i">{{ t }}</p>
      </div>

      <h2>Sinyal per analisa</h2>
      <div class="mods">
        <article v-for="m in data.modul" :key="m.kunci" class="mod">
          <div class="mh"><b>{{ m.nama }}</b><span class="small muted">bobot {{ m.bobot }}%</span></div>
          <div :class="toneOf(m.skor)" class="ar">{{ arahIkon(m.arah) }} {{ m.arah }} <span class="small">({{ m.skor > 0 ? '+' : '' }}{{ Math.round(m.skor * 100) }})</span></div>
          <div class="bar" aria-hidden="true"><span :class="m.skor >= 0 ? 'pos' : 'neg'" :style="{ width: Math.abs(m.skor) * 50 + '%', left: m.skor >= 0 ? '50%' : (50 - Math.abs(m.skor) * 50) + '%' }"></span></div>
          <p class="small">{{ m.teks }}</p>
        </article>
      </div>
      <p class="small muted">{{ data.catatan }} Kesimpulan: saat IHSG turun, skor ≥ +15 = <b>potensi rebound</b>, ≤ −15 = <b>potensi turun lagi</b>;
        saat naik, ≥ +15 = potensi lanjut naik, ≤ −15 = rawan berbalik turun.</p>
    </template>
  </section>
</template>

<style scoped>
.intro{max-width:120ch;margin:6px 0 12px}
.top{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:stretch;margin-bottom:12px}
.harga,.vonis,.suara{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px}
.big{font-size:34px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}
.vonis .lbl{font-size:22px;font-weight:700;margin:2px 0}
.n-good{border-color:var(--good);background:var(--good-bg)}.n-good .lbl{color:var(--good)}
.n-bad{border-color:var(--strong);background:var(--strong-bg)}.n-bad .lbl{color:var(--strong)}
.n-warn{border-color:var(--warn);background:var(--warn-bg)}.n-warn .lbl{color:var(--warn)}
.meter{position:relative;height:6px;margin-top:8px;background:linear-gradient(90deg,var(--strong),var(--warn),var(--good));border-radius:3px}
.meter span{position:absolute;top:-4px;width:4px;height:14px;margin-left:-2px;background:var(--ink);border-radius:2px;transition:left .6s}
.suara{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.grafik{margin:0 0 12px;border:1px solid var(--rule);background:var(--sheet);padding:6px}
.grafik svg{width:100%;height:auto;display:block}
.ar-up{fill:var(--good);opacity:.1}.ar-dn{fill:var(--strong);opacity:.1}
.ln-up{fill:none;stroke:var(--good);stroke-width:2}.ln-dn{fill:none;stroke:var(--strong);stroke-width:2}
.dot-up{fill:var(--good)}.dot-dn{fill:var(--strong)}
.prev{stroke:var(--ink);stroke-dasharray:5 4;opacity:.5}
.lvl{stroke:var(--accent);stroke-dasharray:2 4;opacity:.6}
.tx{font-size:11px;fill:var(--ink);opacity:.7}
.narasi{border-left:3px solid var(--accent);padding:4px 12px;margin-bottom:14px}.narasi p{margin:4px 0}
.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:10px}
.mod{border:1px solid var(--rule);background:var(--sheet);padding:10px 12px}.mod p{margin:6px 0 0}
.mh{display:flex;justify-content:space-between;gap:8px}
.ar{font-weight:700;text-transform:capitalize;margin-top:2px}
.bar{position:relative;height:6px;background:var(--rule);margin-top:6px;border-radius:3px}
.bar span{position:absolute;top:0;height:100%;border-radius:3px}.bar .pos{background:var(--good)}.bar .neg{background:var(--strong)}
h2{margin:6px 0 8px}
.tahan{margin:0 0 10px;padding:8px 12px;border-radius:8px;background:var(--warn-bg);color:var(--warn);font-weight:600}
</style>
