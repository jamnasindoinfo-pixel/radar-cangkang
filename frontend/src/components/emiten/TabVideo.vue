<script setup>
// Video rangkuman analisis: adegan animasi + narasi suara Bahasa Indonesia (Web Speech API browser) + teks di layar.
// Naskah disusun otomatis dari data analisis yang sama dengan tab Analisa/presentasi. Versi Ringkas (±4 menit)
// atau Lengkap (±15–18 menit, isi dan urutan sama dengan presentasi). Tanpa suara Indonesia di perangkat, video tetap berjalan dengan teks dan waktu perkiraan.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildVideo, speakable, lineSecs, toSrt, toScript } from '../../lib/videoScript.js'
import SceneVisual from '../SceneVisual.vue'

const props = defineProps({ ticker: { type: String, required: true } })
const loading = ref(true), error = ref(''), step = ref('')
const data = shallowRef(null)
const mode = ref('ringkas')
const scenes = computed(() => data.value ? buildVideo(data.value, mode.value) : [])
const si = ref(0), li = ref(0), playing = ref(false), rate = ref(1)
const stage = ref(null)

// ---- suara ----
// Utama: suara pria "Ardi" dari server (Azure Speech, sama di semua perangkat). Cadangan: suara browser.
const SERVER = 'Ardi · pria (server)'
const serverTts = computed(() => !!store.status?.tts)
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
const voices = ref([]), voiceName = ref('')
function loadVoices() {
  const all = synth ? synth.getVoices().filter(v => /^id(-|_|$)/i.test(v.lang)) : []
  // Utamakan suara laki-laki (Edge: Ardi Online; Windows: Andika), lalu suara alami lainnya.
  const rank = v => (MALE.test(v.name) ? 0 : 2) + (/(online|natural)/i.test(v.name) ? 0 : 1)
  voices.value = [...(serverTts.value ? [{ name: SERVER, server: true }] : []), ...all.sort((a, b) => rank(a) - rank(b))]
  if (!voices.value.some(v => v.name === voiceName.value) || (serverTts.value && !voiceName.value)) voiceName.value = voices.value[0]?.name || ''
}
watch(serverTts, v => { loadVoices(); if (v) voiceName.value = SERVER })
const MALE = /\b(ardi|andika|male|pria|laki)\b/i
const voice = computed(() => voices.value.find(v => v.name === voiceName.value) || null)
// Suara browser terbaik untuk cadangan bila audio server gagal.
const browserVoice = computed(() => voices.value.find(v => !v.server) || null)
const ttsUrl = text => '/api/tts?t=' + encodeURIComponent(speakable(text))
let audio = null

// Suara pria gratis hanya ada di Microsoft Edge ("Ardi"). Di browser lain tampil tombol buka di Edge
// (Windows: skema microsoft-edge: membuka halaman yang sama langsung di Edge).
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isEdge = /\bEdg(e|A|iOS)?\//.test(ua)
const isWindows = /Windows/.test(ua)
const hasMale = computed(() => voices.value.some(v => v.server || MALE.test(v.name)))
const edgeHref = computed(() => 'microsoft-edge:' + (typeof location !== 'undefined' ? location.href : ''))

// Aktifkan suara pria: pemilik menempel KEY 1 Azure Speech; server mengujinya lalu menyimpannya.
const keyForm = ref({ open: false, key: '', region: 'southeastasia', busy: false, msg: '', ok: false })
async function pasangKunci() {
  const k = keyForm.value
  k.busy = true; k.msg = ''
  try {
    await api.post('/api/tts-key', { key: k.key.trim(), region: k.region.trim() })
    store.status = await api.get('/api/status')
    k.ok = true; k.key = ''; k.msg = 'Suara pria aktif. Tekan putar untuk mendengar.'
  } catch (e) { k.msg = e?.message || String(e) } finally { k.busy = false }
}

async function load() {
  loading.value = true; error.value = ''; stop()
  try {
    data.value = await collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep: s => { step.value = s } })
    si.value = 0; li.value = 0
  } catch (e) { error.value = e?.message || String(e) } finally { loading.value = false }
}
onMounted(() => { loadVoices(); if (synth) synth.onvoiceschanged = loadVoices; load() })
watch(() => props.ticker, load)
watch(mode, () => { stop(); si.value = 0; li.value = 0 })
onBeforeUnmount(() => { stop(); if (synth) synth.onvoiceschanged = null })

// ---- pemutar ----
let timer = null, token = 0
const scene = computed(() => scenes.value[si.value] || null)
const line = computed(() => scene.value?.lines[li.value] || '')
// Poin daftar muncul sebanding kemajuan narasi adegan; kalimat terakhir menampilkan semuanya.
const vStep = computed(() => {
  const n = scene.value?.visual?.items?.length || 0, L = scene.value?.lines.length || 1
  if (li.value >= L - 1) return Infinity
  return Math.max(0, Math.ceil((li.value + 1) / L * n) - 1)
})
function stop() { playing.value = false; token++; clearTimeout(timer); synth?.cancel(); if (audio) { audio.pause(); audio = null } }
function next() {
  const sc = scenes.value[si.value]
  if (!sc) return stop()
  if (li.value < sc.lines.length - 1) li.value++
  else if (si.value < scenes.value.length - 1) { si.value++; li.value = 0 }
  else { stop(); return }
  speak()
}
// Kalimat berikutnya (untuk memuat audio server lebih dulu agar tidak ada jeda).
function upcoming() {
  const sc = scenes.value[si.value]
  if (!sc) return ''
  return li.value < sc.lines.length - 1 ? sc.lines[li.value + 1] : scenes.value[si.value + 1]?.lines[0] || ''
}
// Jeda alami: antar-kalimat singkat, antar-adegan lebih panjang (seperti narator berganti topik).
const jeda = () => (li.value >= (scene.value?.lines.length || 1) - 1 ? 800 : 350) / rate.value
function speakBrowser(text, my, v) {
  if (synth && v) {
    const u = new SpeechSynthesisUtterance(speakable(text))
    // Pitch normal: menurunkan pitch suara lain membuatnya terdengar tidak alami.
    u.lang = v.lang; u.voice = v; u.rate = rate.value; u.pitch = 1
    u.onend = () => { if (my === token && playing.value) timer = setTimeout(next, jeda()) }
    u.onerror = () => { if (my === token && playing.value) timer = setTimeout(next, lineSecs(text, rate.value) * 1000) }
    synth.speak(u)
  } else timer = setTimeout(() => { if (my === token) next() }, lineSecs(text, rate.value) * 1000)
}
function speak() {
  const my = ++token
  clearTimeout(timer); synth?.cancel(); if (audio) { audio.pause(); audio = null }
  const text = line.value
  if (!playing.value || !text) return
  if (voice.value?.server) {
    const a = new Audio(ttsUrl(text))
    audio = a
    a.playbackRate = rate.value
    a.onended = () => { if (my === token && playing.value) timer = setTimeout(next, jeda()) }
    // Server tidak tersedia (204/kuota habis/jaringan): kalimat ini dibacakan suara browser.
    a.onerror = () => { if (my === token && playing.value) speakBrowser(text, my, browserVoice.value) }
    a.play().catch(() => { if (my === token && playing.value) speakBrowser(text, my, browserVoice.value) })
    const nx = upcoming()
    if (nx) { const pre = new Audio(ttsUrl(nx)); pre.preload = 'auto' }
    return
  }
  speakBrowser(text, my, voice.value)
}
function play() { if (!scenes.value.length) return; if (si.value >= scenes.value.length) { si.value = 0; li.value = 0 } playing.value = true; speak() }
function toggle() { playing.value ? stop() : play() }
function goScene(i) { const was = playing.value; stop(); si.value = i; li.value = 0; if (was) play() }
function prevLine() { const was = playing.value; stop(); if (li.value > 0) li.value--; else if (si.value > 0) { si.value--; li.value = scenes.value[si.value].lines.length - 1 } if (was) play() }
function nextLine() { const was = playing.value; stop(); next(); if (was) play() }
watch(rate, () => { if (audio) audio.playbackRate = rate.value; else if (playing.value) speak() })
watch(voiceName, () => { if (playing.value) speak() })

// Waktu: perkiraan dari jumlah kata (durasi suara sebenarnya bergantung mesin suara perangkat).
const durs = computed(() => scenes.value.map(s => s.lines.map(l => lineSecs(l, rate.value))))
const total = computed(() => durs.value.flat().reduce((a, b) => a + b, 0))
const elapsed = computed(() => durs.value.slice(0, si.value).flat().reduce((a, b) => a + b, 0) + (durs.value[si.value] || []).slice(0, li.value).reduce((a, b) => a + b, 0))
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
function seek(e) {
  const r = e.currentTarget.getBoundingClientRect(), target = (e.clientX - r.left) / r.width * total.value
  let t = 0
  for (let i = 0; i < durs.value.length; i++) for (let j = 0; j < durs.value[i].length; j++) {
    if (t + durs.value[i][j] > target) { const was = playing.value; stop(); si.value = i; li.value = j; if (was) play(); return }
    t += durs.value[i][j]
  }
}
function fullscreen() { const el = stage.value; if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.() }
function save(name, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const fileBase = computed(() => `${props.ticker}_Video-${mode.value === 'lengkap' ? 'Lengkap' : 'Ringkas'}_${new Date().toISOString().slice(0, 10)}`)

</script>

<template>
  <section class="rule-top vid">
    <div class="bar">
      <h2 class="lbl">Video rangkuman {{ ticker }}</h2>
      <div role="group" aria-label="Versi video" class="grp">
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'ringkas')" @click="mode = 'ringkas'">Ringkas</button>
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'lengkap')" @click="mode = 'lengkap'">Lengkap</button>
      </div>
    </div>

    <p v-if="loading" class="muted">Menyiapkan video: {{ step || 'memuat data analisis' }}…</p>
    <p v-else-if="error" class="muted">Video belum bisa disiapkan: {{ error }}</p>
    <template v-else-if="scene">
      <!-- Layar video 16:9 -->
      <div ref="stage" class="stage" @click="toggle">
        <div :key="scene.id + mode" class="scene">
          <div class="chap">{{ si + 1 }}. {{ scene.bab }}</div>
          <h3 class="ttl">{{ scene.judul }}</h3>

          <SceneVisual :scene="scene" :step="vStep" />
        </div>
        <!-- Penanda kalimat dalam adegan ini. -->
        <div class="ticks" aria-hidden="true"><i v-for="(l, k) in scene.lines" :key="k" :class="{ on: k <= li }" /></div>
        <div class="caption" aria-live="polite"><span :key="si + '-' + li" class="cap">{{ line }}</span></div>
        <button v-if="!playing" type="button" class="bigplay" aria-label="Putar" @click.stop="play">▶</button>
      </div>

      <!-- Kontrol -->
      <div class="ctl">
        <button type="button" class="btn" @click="prevLine" aria-label="Kalimat sebelumnya">⏮</button>
        <button type="button" class="btn play" @click="toggle">{{ playing ? '⏸ Jeda' : '▶ Putar' }}</button>
        <button type="button" class="btn" @click="nextLine" aria-label="Kalimat berikutnya">⏭</button>
        <div class="prog" role="slider" :aria-valuenow="Math.round(elapsed)" :aria-valuemax="Math.round(total)" aria-label="Posisi video" @click="seek">
          <i :style="{ width: (elapsed / total * 100) + '%' }" />
        </div>
        <span class="time small">{{ mmss(elapsed) }} / {{ mmss(total) }}</span>
        <label class="small">Kecepatan
          <select v-model.number="rate" class="field sm"><option :value="0.85">0,85×</option><option :value="1">1×</option><option :value="1.15">1,15×</option><option :value="1.3">1,3×</option></select>
        </label>
        <label v-if="voices.length > 1" class="small">Suara
          <select v-model="voiceName" class="field sm"><option v-for="v in voices" :key="v.name" :value="v.name">{{ v.name }}</option></select>
        </label>
        <button type="button" class="btn" @click="fullscreen">Layar penuh</button>
      </div>
      <div v-if="!serverTts" class="keybox small">
        <button v-if="!keyForm.open && !keyForm.ok" type="button" class="linkbtn" @click="keyForm.open = true">Aktifkan suara pria "Ardi" (Azure Speech)</button>
        <form v-if="keyForm.open && !keyForm.ok" class="kf" @submit.prevent="pasangKunci">
          <span class="muted">Tempel KEY 1 dari portal.azure.com › Speech service › Keys and Endpoint. Kunci diuji ke Azure lalu disimpan di server; tidak ditampilkan lagi.</span>
          <input v-model="keyForm.key" type="password" autocomplete="off" placeholder="KEY 1" class="field sm" required>
          <input v-model="keyForm.region" type="text" placeholder="region" class="field sm" style="width:140px">
          <button type="submit" class="btn" :disabled="keyForm.busy || !keyForm.key">{{ keyForm.busy ? 'Menguji…' : 'Pasang' }}</button>
        </form>
        <p v-if="keyForm.msg" :class="keyForm.ok ? 'c-good' : 'c-strong'">{{ keyForm.msg }}</p>
      </div>
      <p v-if="!hasMale && !isEdge" class="edge small">
        <a v-if="isWindows" :href="edgeHref" class="btn">Buka di Edge (suara pria)</a>
        <span class="muted">Browser ini hanya memiliki suara wanita. Suara pria "Ardi" gratis tersedia di Microsoft Edge{{ isWindows ? '' : ' (buka tautan halaman ini di Edge)' }}.</span>
      </p>
      <p v-if="!voices.length" class="small muted">Perangkat ini belum memiliki suara Bahasa Indonesia, sehingga video berjalan tanpa suara (teks tetap tampil). Gunakan Chrome atau Edge terbaru, atau pasang paket suara Indonesia di pengaturan sistem.</p>

      <!-- Bab -->
      <ol class="chaps">
        <li v-for="(s, i) in scenes" :key="s.id"><button type="button" :class="{ on: i === si }" @click="goScene(i)"><span class="n">{{ i + 1 }}</span>{{ s.bab }}<small>{{ mmss(durs[i].reduce((a, b) => a + b, 0)) }}</small></button></li>
      </ol>
      <div class="dl small">
        <button type="button" class="linkbtn" @click="save(fileBase + '.txt', toScript(scenes, data))">Unduh naskah (.txt)</button>
        <button type="button" class="linkbtn" @click="save(fileBase + '.srt', toSrt(scenes, rate), 'application/x-subrip')">Unduh subtitle (.srt)</button>
        <span class="muted">Video dibuat otomatis dari data analisis terbaru; bukan anjuran membeli atau menjual efek.</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.edge{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}
.keybox{margin:6px 0}.kf{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.lbl{margin:0}.grp{display:flex;gap:6px}
.stage{position:relative;aspect-ratio:16/9;background:linear-gradient(120deg,#f4f9fb,#e6f4f1,#f4f9fb);background-size:300% 300%;animation:drift 18s ease infinite;border:1px solid var(--rule);overflow:hidden;cursor:pointer;color:#1f2937}
.stage:fullscreen{border:0}
.scene{position:absolute;inset:0;padding:4% 5% 14%;display:flex;flex-direction:column;animation:enter .7s cubic-bezier(.2,.7,.2,1)}
.ticks{position:absolute;left:5%;right:5%;bottom:13%;display:flex;gap:4px}
.ticks i{flex:1;height:3px;background:rgba(15,118,110,.18);border-radius:2px;transition:background .4s}
.ticks i.on{background:#0f766e}
.cap{display:inline-block;animation:capIn .5s ease}
.chap{font-size:clamp(10px,1.2vw,14px);letter-spacing:.2em;text-transform:uppercase;color:#0f766e;font-weight:700}
.ttl{font-family:Cambria,Georgia,serif;font-size:clamp(18px,3vw,38px);margin:.3em 0 .6em;color:#1f2937;animation:rise .7s ease}
.caption{position:absolute;left:0;right:0;bottom:0;padding:1.2% 5%;background:#0f766e;color:#fff;font-size:clamp(12px,1.6vw,20px);line-height:1.4;min-height:12%}
.bigplay{position:absolute;inset:0;margin:auto;width:84px;height:84px;border-radius:50%;border:0;background:rgba(15,118,110,.9);color:#fff;font-size:34px;cursor:pointer}
.ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.ctl .play{min-width:96px;font-weight:600}
.prog{flex:1;min-width:140px;height:8px;background:var(--rule-2);border-radius:4px;cursor:pointer;position:relative;overflow:hidden}
.prog i{position:absolute;left:0;top:0;bottom:0;background:var(--now-ink)}
.time{white-space:nowrap}
.field.sm{padding:2px 4px;margin-left:4px}
.chaps{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}
.chaps button{width:100%;display:grid;grid-template-columns:22px 1fr auto;gap:6px;align-items:center;text-align:left;background:var(--sheet);border:1px solid var(--rule);padding:6px 8px;cursor:pointer;font:inherit;color:inherit}
.chaps button.on{outline:2px solid var(--now-ink);outline-offset:-1px}
.chaps .n{font-weight:700;opacity:.6}
.chaps small{opacity:.6}
.dl{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;align-items:center}
.linkbtn{background:none;border:0;padding:0;color:var(--now-ink);text-decoration:underline;cursor:pointer;font:inherit}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes enter{from{opacity:0;transform:translateX(4%) scale(.98)}to{opacity:1;transform:none}}
@keyframes capIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes drift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@media (prefers-reduced-motion:reduce){.stage,.scene,.cap{animation:none}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
</style>
