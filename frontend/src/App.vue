<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { store, toast, loadKandidat, autoKandidat } from './store.js'
import { stageOf, isNewSince } from './lib/domain.js'
import ChangelogPanel from './components/ChangelogPanel.vue'
import TokenPanel from './components/TokenPanel.vue'
import TickerJump from './components/TickerJump.vue'

const router = useRouter()
const now = ref(Date.now())
let timer

const nRadar = computed(() => store.items.filter(i => stageOf(i) === 'radar').length)
const nKandidat = computed(() => nRadar.value + autoKandidat().length)
const nMonitor = computed(() => store.items.length - nRadar.value)
const nBaru = computed(() => store.updates.filter(u => isNewSince(u, store.seenAt)).length)

// Status token Stockbit (masa berlaku ±24 jam) di kaki rail.
const token = computed(() => {
  const exp = store.status?.tokenExp
  if (!exp) return null
  const left = exp * 1000 - now.value
  const until = new Date(exp * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const h = Math.floor(left / 3600e3), m = Math.max(0, Math.floor(left % 3600e3 / 60e3))
  if (left <= 0) {
    // Sinkron terakhir yang berhasil; setelah token diganti server mengejar ketertinggalan otomatis.
    const ok = store.status?.sinkronStockbit
    const last = ok ? new Date(ok).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    return { cls: 'bad', text: `Token Stockbit kedaluwarsa: harga dan laporan bisa basi sampai token diperbarui${last ? `. Sinkron terakhir ${last}; ketertinggalan dikejar otomatis setelah token baru` : ''}` }
  }
  if (left < 2 * 3600e3) return { cls: 'warn', text: `Token habis dalam ${h ? h + ' jam ' : ''}${m} menit (${until})` }
  return { cls: 'ok', text: `Token berlaku s.d. ${until}` }
})

// Masalah sumber data (bukan mode publik): teks untuk kaki rail dan spanduk di HP.
const dataWarn = computed(() => {
  const st = store.status
  if (st?.readOnly) return ''
  if (store.ready && !st) return 'Server tidak terhubung'
  if (st && !st.configured) return 'Data Stockbit belum diatur di server'
  if (st && !st.tokenLoaded) return 'Data Stockbit tidak aktif: harga dan laporan bisa basi'
  return token.value?.cls === 'bad' ? token.value.text : ''
})

// Peringatan sekali saat sisa token < 1 jam; diulang hanya setelah token diganti (sisa > 2 jam lagi).
let tokenWarned = false
watch([() => store.status?.tokenExp, now], ([exp, t]) => {
  if (!exp || store.status?.readOnly) return
  const left = exp * 1000 - t
  if (left > 0 && left < 3600e3 && !tokenWarned) {
    tokenWarned = true
    toast(`Token Stockbit habis dalam ${Math.floor(left / 60e3)} menit. Isi token baru lewat tombol Token Stockbit di kiri bawah`, true)
  }
  if (left > 2 * 3600e3) tokenWarned = false
}, { immediate: true })

const theme = ref(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  if (theme.value === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  try { localStorage.setItem('radar-cangkang.theme', theme.value) } catch {}
}

// Layar penuh (semua halaman): menyembunyikan menu kiri agar konten memakai seluruh lebar, sekaligus masuk
// mode layar penuh browser bila didukung. Keluar lewat tombol, tombol F, atau Esc (browser keluar layar penuh).
const penuh = ref(false)
try { penuh.value = localStorage.getItem('radar-cangkang.penuh') === '1' } catch {}
watch(penuh, v => { try { localStorage.setItem('radar-cangkang.penuh', v ? '1' : '0') } catch {} })
function togglePenuh() {
  penuh.value = !penuh.value
  try {
    if (penuh.value && !document.fullscreenElement) document.documentElement.requestFullscreen?.()?.catch?.(() => {})
    else if (!penuh.value && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
  } catch {}
}
// Esc keluar dari layar penuh browser: menu kiri ikut ditampilkan lagi.
function onFs() { if (!document.fullscreenElement && penuh.value) penuh.value = false }

// Pintasan: Ctrl/⌘ K buka emiten, / cari, 1–3 pindah menu, F layar penuh. Tidak aktif saat mengetik atau dialog terbuka.
// Muat ulang ke versi terbaru (mempertahankan halaman yang sedang dibuka).
function reloadApp() { location.reload() }
const jump = ref(false)
// Kosongkan daftar saham yang dibandingkan (tray Bandingkan hilang).
function kosongkanBanding() {
  store.compare = []
  try { localStorage.setItem('radar-cangkang.compare', '[]') } catch {}
}
function onKey(e) {
  // Ctrl/⌘ K: lompat ke emiten dari halaman mana pun.
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); jump.value = true; return }
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('[role="dialog"]')) return
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); togglePenuh(); return }
  const to = { 1: '/berita', 2: '/', 3: '/kandidat' }[e.key]   // mengikuti urutan menu
  if (to) { router.push(to); return }
  if (e.key === '/') {
    e.preventDefault()
    const q = document.querySelector('[data-search]')
    if (q) q.focus()
    else router.push('/').then(() => setTimeout(() => document.querySelector('[data-search]')?.focus(), 50))
  }
}

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 60e3)
  addEventListener('keydown', onKey)
  document.addEventListener('fullscreenchange', onFs)
})
// Pemindaian kandidat bisa lama saat belum ada hasil jadi: mulai setelah data utama termuat
// supaya tidak memakan jatah koneksi browser saat pemuatan awal.
watch(() => store.ready, r => r && loadKandidat(), { immediate: true })
onBeforeUnmount(() => { clearInterval(timer); removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs) })
</script>

<template>
  <div class="shell" :class="{ penuh }">
    <nav v-show="!penuh" class="rail" aria-label="Menu utama">
      <div class="brand">
        <b>Radar Backdoor</b>
        <span>Pengambilalihan emiten · BEI</span>
      </div>
      <button type="button" class="jump" aria-label="Buka emiten (Ctrl K)" @click="jump = true"><span class="jl">Buka emiten</span><svg class="ji" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg><kbd>Ctrl K</kbd></button>
      <RouterLink class="nav" to="/berita" active-class="on">Berita <span class="cnt">{{ nBaru || '' }}</span></RouterLink>
      <RouterLink class="nav" to="/" :class="{ on: $route.name === 'monitor' || $route.name === 'emiten' }">Monitor <span class="cnt">{{ nMonitor }}</span></RouterLink>
      <RouterLink class="nav" to="/kandidat" active-class="on">Kandidat <span class="cnt">{{ nKandidat }}</span></RouterLink>
      <RouterLink class="nav" to="/seasonality" active-class="on">IHSG <span class="cnt"></span></RouterLink>
      <RouterLink class="nav" to="/harmonic" active-class="on">Harmonic Pattern <span class="cnt"></span></RouterLink>
      <RouterLink class="nav" to="/rekomendasi" active-class="on">Rekomendasi <span class="cnt"></span></RouterLink>
      <div class="foot">
        <ChangelogPanel />
        <TokenPanel v-if="store.status && !store.status.readOnly" />
        <span v-if="store.status?.readOnly" class="tok">Versi publik · hanya baca</span>
        <span v-else-if="token && token.cls !== 'bad'" class="tok" :class="token.cls">{{ token.text }}</span>
        <span v-else-if="dataWarn" class="tok bad">{{ dataWarn }}</span>
        <span>Ctrl K buka emiten · / cari · 1–3 menu · F layar penuh</span>
        <button type="button" class="theme" @click="toggleTheme">{{ theme === 'dark' ? 'Tema terang' : 'Tema gelap' }}</button>
      </div>
    </nav>
    <main class="content">
      <button type="button" class="fs" :aria-pressed="String(penuh)" :title="penuh ? 'Kembali: tampilkan menu kiri (F atau Esc)' : 'Sembunyikan menu kiri, layar penuh (F)'" @click="togglePenuh">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path v-if="!penuh" d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path v-else d="M5 1v4H1M13 5H9V1M9 13V9h4M1 9h4v4" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
        {{ penuh ? 'Kembali' : 'Layar penuh' }}
      </button>
      <p v-if="store.newVersion" class="newver" role="status">
        Versi baru website tersedia; tab ini masih memakai versi lama.
        <button type="button" class="btn" @click="reloadApp">Muat ulang</button>
      </p>
      <p v-if="dataWarn" class="mwarn" role="status">{{ dataWarn }}</p>
      <div v-if="!store.ready" class="skel" aria-busy="true">
        <span class="sr-only">Memuat data…</span>
        <div class="sk sk-h"></div>
        <div class="sk-row"><div v-for="i in 3" :key="i" class="sk sk-card"></div></div>
        <div class="sk sk-bar"></div>
        <div class="sk-tab"><div v-for="i in 8" :key="i" class="sk sk-line" :style="{ width: 100 - (i % 3) * 7 + '%' }"></div></div>
      </div>
      <RouterView v-else />
    </main>
    <TickerJump v-if="jump" @close="jump = false" />
    <!-- Bandingkan hanya tampil di halaman emiten (tempat memilih saham pembanding); × mengosongkan daftar. -->
    <div v-if="store.compare.length && $route.name === 'emiten'" class="cmp-tray">
      <RouterLink :to="{ path: '/bandingkan', query: { t: store.compare.join(',') } }">Bandingkan <b>{{ store.compare.join(' · ') }}</b> →</RouterLink>
      <button type="button" class="cmp-x" title="Kosongkan daftar bandingkan" aria-label="Kosongkan daftar bandingkan" @click="kosongkanBanding">×</button>
    </div>
    <div class="toasts" aria-live="polite">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="{ warn: t.warn }">{{ t.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.shell{display:flex;flex-wrap:wrap;align-content:flex-start;min-height:100vh}
.rail{flex:1 1 216px;max-width:232px;background:var(--rail);color:var(--rail-ink);padding:22px 12px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;height:100vh;box-sizing:border-box}
.brand{padding:0 12px 18px;display:grid;gap:2px}
.brand b{font-family:var(--f-display);font-size:24px;line-height:1;color:#fff}
.brand span{font-size:12px;color:var(--rail-mute)}
.nav{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:3px;color:var(--rail-mute);text-decoration:none;font-weight:600;min-height:24px;box-shadow:inset 3px 0 0 transparent}
.nav:hover{color:var(--rail-ink);background:var(--rail-2)}
.nav.on{color:#fff;background:var(--rail-2);box-shadow:inset 3px 0 0 var(--now)}
.cnt{font-family:var(--f-display);font-weight:700}
.jump{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 10px;padding:8px 12px;border:1px solid var(--rail-rule);border-radius:3px;background:none;color:var(--rail-mute);font:inherit;font-size:13px;cursor:pointer;text-align:left}
.jump:hover{color:var(--rail-ink);border-color:var(--rail-mute)}
.jump .ji{display:none}
.jump kbd{font:600 11px var(--f-data);padding:1px 5px;border:1px solid var(--rail-rule);border-radius:3px}
.foot{margin-top:auto;padding:12px;border-top:1px solid var(--rail-rule);display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--rail-mute)}
.tok{font-weight:600}
.tok.ok{color:#bfe6d1}.tok.warn{color:#ffd28a}.tok.bad{color:#ffb4a9}
.theme{align-self:flex-start;background:none;border:1px solid var(--rail-rule);color:var(--rail-ink);border-radius:3px;padding:5px 10px;cursor:pointer}
.content{flex:999 1 560px;min-width:0;padding:22px 28px 48px;box-sizing:border-box;position:relative}
/* Tombol layar penuh: pojok kanan atas konten, tetap terlihat saat menggulir. */
.fs{position:fixed;top:10px;right:14px;z-index:40;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;font:600 12px var(--f-data, inherit);
  background:var(--sheet);color:var(--ink);border:1px solid var(--rule);border-radius:3px;box-shadow:var(--shadow);cursor:pointer;opacity:.85}
.fs:hover,.fs[aria-pressed="true"]{opacity:1}
.penuh .content{padding-top:40px}
.skel{display:flex;flex-direction:column;gap:18px}
.sk{background:linear-gradient(90deg,var(--rule-2) 0 40%,var(--sheet-2) 50%,var(--rule-2) 60% 100%) 0 0/300% 100%;border-radius:3px;animation:sk 1.4s ease-in-out infinite}
.sk-h{height:34px;width:38%}
.sk-row{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.sk-card{height:150px}
.sk-bar{height:34px;width:60%}
.sk-tab{display:flex;flex-direction:column;gap:10px;padding:14px;background:var(--sheet);border:1px solid var(--rule)}
.sk-line{height:28px}
@keyframes sk{from{background-position:100% 0}to{background-position:0 0}}
@media (prefers-reduced-motion:reduce){.sk{animation:none}}
.mwarn{display:none}
.newver{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:8px 12px;background:var(--now-bg, var(--sheet-2));border:1px solid var(--rule);font-weight:600;font-size:13px;border-radius:3px}
.cmp-tray{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:45;display:flex;gap:8px;align-items:center;padding:10px 16px;border-radius:999px;background:var(--accent);color:var(--accent-ink);text-decoration:none;font-weight:600;box-shadow:var(--shadow)}
.cmp-tray b{font-family:var(--f-display);letter-spacing:.03em}
.cmp-tray a{color:inherit;text-decoration:none}.cmp-x{background:none;border:0;color:inherit;font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 4px;opacity:.8}
.cmp-x:hover{opacity:1}
.cmp-tray ~ .toasts{bottom:76px}
@media (max-width:760px){.cmp-tray{left:14px;right:14px;transform:none;justify-content:center;font-size:14px}}
.toasts{position:fixed;right:18px;bottom:18px;display:flex;flex-direction:column;gap:8px;z-index:50;max-width:380px}
.toast{background:var(--ink);color:var(--paper);padding:10px 14px;border-radius:3px;box-shadow:var(--shadow)}
.toast.warn{background:var(--strong)}
@media (max-width:760px){
  .rail{position:sticky;top:0;z-index:20;height:auto;max-width:none;flex-basis:100%;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:2px;padding:6px 8px;overflow-x:auto;scrollbar-width:none}
  .brand{flex:none;padding:0 8px 0 4px}.brand span{display:none}.brand b{font-size:19px}
  .nav{flex:none;padding:9px 10px;box-shadow:inset 0 -3px 0 transparent}.nav.on{box-shadow:inset 0 -3px 0 var(--now)}
  .jump{order:0;flex:none;margin:0 4px 0 0;padding:7px 9px}.jump kbd,.jump .jl{display:none}.jump .ji{display:block}
  .foot{display:none}
  .content{padding:14px 14px 40px}
  .fs{top:auto;bottom:14px;right:14px}
  .mwarn{display:block;margin:0 0 12px;padding:8px 12px;background:var(--strong-bg);color:var(--strong);font-weight:600;font-size:13px;border-radius:3px}
  .sk-row{grid-template-columns:1fr}.sk-card:nth-child(n+2){display:none}
}
</style>
