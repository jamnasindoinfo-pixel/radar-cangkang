<script setup>
// Tombol rail "Token Stockbit" + panel kanan untuk mengisi token akses dan refresh token dari UI (POST /api/token).
// Hanya tampil di luar versi publik; server juga menolak penulisan lewat domain publik. Isi token tidak pernah
// ditampilkan balik: panel hanya menunjukkan masa berlaku dan keadaan watcher bawaan dari /api/status.
import { computed, nextTick, ref } from 'vue'
import { api } from '../api.js'
import { loadStatus, store, toast } from '../store.js'

const open = ref(false)
const panel = ref(null)
const token = ref(''), refresh = ref(''), busy = ref(false), pesan = ref(''), galat = ref('')
let opener = null

const tgl = s => new Date(s * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const st = computed(() => {
  const s = store.status || {}, w = s.watcher || {}, exp = s.tokenExp
  const sisa = exp ? exp * 1000 - Date.now() : null
  return {
    token: !exp ? 'Belum ada token.' : sisa <= 0 ? `Kedaluwarsa sejak ${tgl(exp)}.` : `Berlaku sampai ${tgl(exp)} (${Math.floor(sisa / 3600e3)} jam lagi).`,
    bad: !exp || sisa <= 0,
    refresh: w.refreshAda ? 'Ada: token diperpanjang otomatis sebelum habis.' : 'Belum ada: token tidak bisa diperpanjang otomatis.',
    watcher: w.bawaan?.pesan || '',
    watcherBad: w.bawaan?.ok === false,
  }
})

function show(e) {
  opener = e.currentTarget
  open.value = true
  pesan.value = galat.value = ''
  loadStatus()
  nextTick(() => panel.value?.focus())
}
function close() { open.value = false; token.value = refresh.value = ''; opener?.focus() }

async function simpan() {
  busy.value = true
  pesan.value = galat.value = ''
  try {
    const r = await api.post('/api/token', { token: token.value, refresh: refresh.value })
    token.value = refresh.value = ''
    const p = r.perpanjang
    pesan.value = [r.token && 'Token akses tersimpan.', r.refresh && 'Refresh token tersimpan.', p?.pesan].filter(Boolean).join(' ')
    if (p && p.ok === false) galat.value = p.pesan
    await loadStatus()
    toast('Token Stockbit diperbarui.')
  } catch (e) {
    galat.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button type="button" class="tk-btn" :class="{ bad: st.bad }" aria-haspopup="dialog" :aria-expanded="String(open)" @click="show">
    Token Stockbit <span class="cnt">{{ st.bad ? 'perlu diisi' : 'ganti' }}</span>
  </button>
  <Teleport to="body"><div v-if="open" class="tk-scrim" @click.self="close" @keydown.esc="close">
    <aside ref="panel" class="tk-panel" role="dialog" aria-modal="true" aria-labelledby="tk-h" tabindex="-1">
      <header class="tk-head">
        <h2 id="tk-h">Token Stockbit</h2>
        <button type="button" class="btn" @click="close">Tutup</button>
      </header>

      <dl class="st">
        <dt>Token akses</dt><dd :class="{ bad: st.bad }">{{ st.token }}</dd>
        <dt>Refresh token</dt><dd :class="{ bad: !store.status?.watcher?.refreshAda }">{{ st.refresh }}</dd>
        <template v-if="st.watcher"><dt>Watcher</dt><dd :class="{ bad: st.watcherBad }">{{ st.watcher }}</dd></template>
      </dl>

      <form class="isi" @submit.prevent="simpan">
        <label for="tk-ref">Refresh token <span class="tag t-good">disarankan</span></label>
        <input id="tk-ref" v-model="refresh" type="password" autocomplete="off" spellcheck="false" placeholder="eyJ…" />
        <p class="small muted">Dengan refresh token, server memperpanjang token sendiri setiap kali sisanya kurang dari 2 jam, jadi token tidak habis. <b>Ambil dari jendela incognito, lalu tutup jendela itu tanpa logout.</b> Refresh token dari browser yang masih Anda pakai akan saling mencabut dengan server. Isi di satu mesin saja; token baru menyebar ke mesin lain lewat sinkron.</p>

        <label for="tk-tok">Token akses (Bearer)</label>
        <input id="tk-tok" v-model="token" type="password" autocomplete="off" spellcheck="false" placeholder="eyJ… (boleh dengan awalan Bearer)" />
        <p class="small muted">Cukup bila hanya perlu cepat. Tanpa refresh token, token ini habis lagi dalam beberapa hari.</p>

        <button type="submit" class="btn pri" :disabled="busy || (!token.trim() && !refresh.trim())">{{ busy ? 'Menyimpan…' : 'Simpan' }}</button>
        <p v-if="galat" class="err" role="alert">{{ galat }}</p>
        <p v-else-if="pesan" class="ok" role="status">{{ pesan }}</p>
      </form>

      <details class="cara">
        <summary>Cara mengambil token</summary>
        <p class="lbl">Refresh token</p>
        <ol>
          <li>Buka jendela incognito, login stockbit.com, tekan F12 dan buka tab Network.</li>
          <li>Muat ulang halaman, cari request <code>login/refresh</code>.</li>
          <li>Di tab Response, salin nilai di field yang namanya mengandung <code>refresh</code> (diawali <code>eyJ</code>).</li>
          <li>Tempel di atas dan simpan, lalu tutup jendela incognito tanpa logout. Refresh token berganti setiap dipakai, jadi sesi browser itu jangan dipakai lagi.</li>
        </ol>
        <p class="lbl">Token akses</p>
        <ol>
          <li>Di stockbit.com, F12 tab Network, klik salah satu request ke <code>exodus.stockbit.com</code>.</li>
          <li>Salin nilai header <code>Authorization</code> (diawali <code>Bearer eyJ</code>).</li>
        </ol>
      </details>
    </aside>
  </div></Teleport>
</template>

<style scoped>
.tk-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:4px 0;min-height:24px;border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;color:var(--rail-mute);cursor:pointer;text-align:left}
.tk-btn:hover{color:var(--rail-ink)}
.tk-btn .cnt{font-weight:600;color:var(--rail-ink);border:1px solid var(--rail-rule);border-radius:999px;padding:0 7px;font-size:11px}
.tk-btn.bad .cnt{border-color:var(--strong);color:var(--rail-ink);background:var(--strong)}
@media (max-width:760px){.tk-btn{width:auto}}
.tk-scrim{position:fixed;inset:0;z-index:40;background:rgb(15 32 25 / .45);display:flex;justify-content:flex-end}
.tk-panel{background:var(--sheet);color:var(--ink);width:min(440px,100%);height:100%;overflow:auto;padding:18px 20px 32px;box-shadow:var(--shadow);outline:none;box-sizing:border-box;display:flex;flex-direction:column;gap:14px}
.tk-head{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.tk-head h2{margin:0;margin-right:auto}
.small{font-size:12px}.muted{color:var(--ink-2)}
.st{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0;font-size:13px}
.st dt{color:var(--ink-2);font-weight:600}
.st dd{margin:0}
.st dd.bad{color:var(--strong)}
.isi{display:flex;flex-direction:column;gap:6px}
.isi label{font-weight:700;font-size:13px;display:flex;gap:6px;align-items:center;margin-top:6px}
.isi input{font:13px var(--f-data);padding:7px 9px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet-2);color:var(--ink)}
.isi p{margin:0}
.btn.pri{align-self:flex-start;margin-top:8px;background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.btn.pri:disabled{opacity:.5;cursor:default}
.err{color:var(--strong);margin:0;font-size:13px}
.ok{color:var(--good);margin:0;font-size:13px}
.cara{border-top:1px solid var(--rule-2);padding-top:10px;font-size:13px}
.cara summary{cursor:pointer;font-weight:700}
.cara ol{margin:4px 0 8px;padding-left:18px;display:grid;gap:3px;line-height:1.5}
.lbl{margin:8px 0 0;font-size:12px;font-weight:700;color:var(--ink-2)}
code{font-family:var(--f-data);font-size:12px}
</style>
