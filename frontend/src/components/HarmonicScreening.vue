<script setup>
// Tab Screening halaman Harmonic Pattern: saham BEI yang sedang membentuk pola harmonik dari screening malam server
// (/api/harmonik, saham likuid), dengan alasan (rasio aktual vs kriteria pola, konfirmasi di D, jarak ke PRZ).
// Klik baris membuka chart saham itu di tab Saham dengan XABCD aktif.
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'
import { HM_STATUS, hitungSaring, lolosSaring, rentang } from '../lib/harmonik.js'
import { kekuatanPola } from '../lib/harmonikCekSilang.js'
import { jarakKaki } from '../lib/harmonikAlat.js'

const emit = defineEmits(['buka'])
const data = ref(null), err = ref('')
onMounted(() => api.get('/api/harmonik').then(v => { data.value = v }, e => { err.value = e.message || String(e) }))

const fStatus = ref('semua'), fArah = ref('semua'), fRadar = ref(false), q = ref(''), fPola = ref(''), fKuat = ref('semua')
const rows = computed(() => data.value?.rows || [])
// Cek silang: label kekuatan per pola XABCD (rasio ideal atau hanya lolos toleransi, AB=CD, fraksi harga).
const kuat = computed(() => new Map(rows.value.map(r => [r, kekuatanPola(r)])))
const kuatOf = r => kuat.value.get(r)?.tingkat || ''
const saring = computed(() => ({ status: fStatus.value, arah: fArah.value, pola: fPola.value, kuat: fKuat.value, radar: fRadar.value, q: q.value }))
// Angka di tombol mengikuti saringan lain yang aktif (mis. Bullish + Kuat: angka Kuat = pola kuat yang bullish).
const hitung = computed(() => hitungSaring(rows.value, saring.value, kuatOf))
// Catatan swing per baris (semua jenis pola): jarak candle antarkaki dan titik yang bukan swing jelas (dari server).
const swing = computed(() => new Map(rows.value.map(r => {
  const jk = jarakKaki(r), teks = [...(jk && jk.tingkat !== 'seimbang' ? [jk.teks] : []), ...(r.swingLemah || [])]
  return [r, teks.length ? teks.join('\n') : '']
})))
const tipKuat = k => k ? [`${k.nama}: ${k.ket}.`, ...k.alasan.map(a => `${a.ok ? '✓' : a.berat ? '✗' : '~'} ${a.teks}`)].join('\n') : ''
const tampil = computed(() => rows.value.filter(r => lolosSaring(r, saring.value, kuatOf)))
const kriteria = computed(() => Object.fromEntries((data.value?.pola || []).map(p => [p.k, p])))
// Jenis pola yang muncul di hasil, untuk saringan.
const jenisPola = computed(() => [...new Set(rows.value.map(r => r.pola))].map(k => ({ k, nama: kriteria.value[k]?.nama || k, n: hitung.value.pola[k] || 0 })))
const fh = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: v < 200 ? 1 : 0 })
const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })

// Alasan: rasio terukur dibanding kriteria pola di server (B dari XA, C dari AB atau XC dari XA).
function alasan(r) {
  if (r.alasan?.length) return r.alasan.join(' · ')   // server baru: rasio aktual vs kriteria materi
  const p = kriteria.value[r.pola] || {}, a = r.rasio || {}, out = []
  if (a.b != null) out.push(`B ${fr(a.b)} XA (kriteria ${rentang(p.b)})`)
  if (a.c != null) out.push(`C ${fr(a.c)} AB (kriteria ${rentang(p.c)})`)
  if (a.cx != null) out.push(`C ${fr(a.cx)} XA, melewati A (kriteria ${rentang(p.cx)})`)
  if (p.d) out.push(`D di ${rentang(p.d)} XA`)
  if (p.dxc) out.push(`D di ${rentang(p.dxc)} XC`)
  return out.join(' · ')
}
const posisi = r => r.status === 'menuju' ? `${fh(r.jarak)}% dari PRZ` : r.status === 'berbalik' && r.reaksi != null ? `reaksi ${r.reaksi > 0 ? '+' : ''}${fh(r.reaksi)}% dari D` : 'di dalam PRZ'
</script>

<template>
  <section class="sc">
    <header class="kepala">
      <div>
        <h2>Screening Harmonic Pattern</h2>
        <p class="small mute" v-if="data">Diperbarui {{ data.updated || '–' }} · {{ data.dinilai }} saham likuid dinilai (nilai transaksi rata-rata minimal Rp{{ fh((data.minNilai || 1e9) / 1e9) }} miliar per hari) · {{ rows.length }} pola aktif. Klik baris untuk membuka chartnya.</p>
      </div>
    </header>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <p v-else-if="!data" class="small mute">Memuat hasil screening…</p>
    <template v-else>
      <div class="saring">
        <div class="seg" role="group" aria-label="Status pola">
          <button v-for="s in ['semua', 'prz', 'berbalik', 'menuju']" :key="s" type="button" :class="{ on: fStatus === s }" @click="fStatus = s">
            {{ s === 'semua' ? 'Semua' : HM_STATUS[s][0] }} <b>{{ hitung.status[s] || 0 }}</b></button>
        </div>
        <div class="seg" role="group" aria-label="Arah pola">
          <button v-for="a in ['semua', 'bullish', 'bearish']" :key="a" type="button" :class="{ on: fArah === a }" @click="fArah = a">{{ a === 'semua' ? 'Semua arah' : a }} <b v-if="a !== 'semua'">{{ hitung.arah[a] || 0 }}</b></button>
        </div>
        <div class="seg" role="group" aria-label="Kekuatan pola">
          <button v-for="k in ['semua', 'kuat', 'sedang', 'lemah']" :key="k" type="button" :class="{ on: fKuat === k }" @click="fKuat = k">{{ k === 'semua' ? 'Semua kekuatan' : k }} <b v-if="k !== 'semua'">{{ hitung.kuat[k] || 0 }}</b></button>
        </div>
        <select v-model="fPola" class="sel" aria-label="Jenis pola">
          <option value="">Semua pola</option>
          <option v-for="p in jenisPola" :key="p.k" :value="p.k">{{ p.nama }} ({{ p.n }})</option>
        </select>
        <label class="small"><input v-model="fRadar" type="checkbox" /> Hanya saham radar</label>
        <input v-model="q" class="q" placeholder="Cari kode/nama" aria-label="Cari kode atau nama saham" />
      </div>
      <div class="wrap">
        <table class="tb">
          <thead><tr><th>Saham</th><th>Pola</th><th>Status</th><th class="r">Harga</th><th class="r">PRZ</th><th>Posisi harga</th><th>Alasan</th><th>Konfirmasi di D</th><th class="r">Stop / Target</th></tr></thead>
          <tbody>
            <tr v-for="r in tampil" :key="[r.t, r.pola, r.arah, r.status, ...r.titik.map(x => x.d)].join('|')" tabindex="0" @click="emit('buka', r)" @keydown.enter="emit('buka', r)">
              <td><b class="kode">{{ r.t }}</b><span v-if="r.radar" class="tag">radar</span><br><span class="small mute">{{ r.nama }}</span></td>
              <td :class="r.arah === 'bullish' ? 'up' : 'dn'"><b>{{ kriteria[r.pola]?.nama || r.pola }}</b><br>{{ r.arah }}
                <span v-if="kuat.get(r)" class="kk" :class="kuat.get(r).tingkat" :title="tipKuat(kuat.get(r))">{{ kuat.get(r).nama }}</span>
                <span v-if="swing.get(r)" class="kk cs" :title="swing.get(r)">cek swing</span></td>
              <td><span class="st" :class="r.status">{{ HM_STATUS[r.status][0] }}</span></td>
              <td class="r">{{ fh(r.harga) }}</td>
              <td class="r">{{ fh(r.prz[0]) }}–{{ fh(r.prz[1]) }}</td>
              <td class="small">{{ posisi(r) }}</td>
              <td class="small">{{ alasan(r) }}</td>
              <td class="small">{{ r.konfirmasi?.length ? r.konfirmasi.join(', ') : (r.status === 'menuju' ? 'D belum terbentuk' : 'belum ada') }}</td>
              <td class="r small"><span class="dn">{{ fh(r.stop) }}</span> / <span class="up">{{ fh(r.target?.[0]) }}, {{ fh(r.target?.[1]) }}</span></td>
            </tr>
            <tr v-if="!tampil.length"><td colspan="9" class="small mute">Tidak ada pola yang cocok dengan saringan ini.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="small mute">Screening malam memakai aturan yang sama dengan tab Saham: Gartley, Bat, Alternate Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0, Three Drives, AB=CD, dan Alternate AB=CD pada candle harian (maksimal empat pola per saham; pola "menuju" hanya bila harga dalam 12% dari PRZ; AB=CD hanya bila D sudah di PRZ). Status: Di PRZ = D sedang terbentuk di zona; Berbalik = D terkonfirmasi dan harga mulai berbalik; Menuju = X-A-B-C terbentuk, D belum. Kekuatan (pola XABCD): Kuat = rasio di dalam rentang ideal dan AB=CD terpenuhi; Sedang = ada rasio yang hanya lolos toleransi atau satu syarat penting belum terpenuhi; Lemah = beberapa syarat belum terpenuhi, termasuk rasio kasar pada saham berharga rendah. Label "cek swing" (rasio dan PRZ tetap menurut Carney): titik pola belum memenuhi cara mengenali swing dari materi latihan (puncak/dasar melewati 2 candle di kiri dan kanan, ayunan minimal 5%) atau jarak candle antarkaki tidak seimbang (Carney hal. 129: tiap kaki sebaiknya simetris; kaki kurang dari 3 candle, atau kaki terpendek di bawah 20% kaki terpanjang); pola tetap tampil tetapi turun peringkat. Arahkan kursor ke label untuk melihat alasannya; buka chart lalu tekan Cek di Tutorial untuk menilai ulang.</p>
    </template>
  </section>
</template>

<style scoped>
.sc{display:grid;gap:10px}
.kepala h2{font-family:var(--f-display);margin:0 0 2px}
.kepala p{margin:0}
.saring{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:flex;gap:2px;flex-wrap:wrap}
.seg button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:14px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body);text-transform:capitalize}
.seg button.on{background:var(--accent-soft);color:var(--accent-ink);border-color:transparent}
.seg b{font-family:var(--f-data);margin-left:2px}
.kk{display:inline-block;margin-top:2px;padding:0 6px;border-radius:8px;font:600 11px var(--f-body);background:var(--good-bg);color:var(--good)}
.kk.sedang{background:var(--warn-bg);color:var(--warn)}
.kk.lemah{background:var(--strong-bg);color:var(--strong)}
.kk.cs{margin-left:4px;background:var(--warn-bg);color:var(--warn)}
.sel{font:13px var(--f-body);padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink)}
.q{font:13px var(--f-body);padding:5px 10px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink);margin-left:auto}
.wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:8px;background:var(--sheet)}
.tb{border-collapse:collapse;width:100%;font-size:13px}
.tb th,.tb td{padding:7px 9px;border-bottom:1px solid var(--rule-2);text-align:left;vertical-align:top}
.tb th{background:var(--sheet-2);color:var(--ink-2);font-weight:600;white-space:nowrap;position:sticky;top:0}
.tb .r{text-align:right;white-space:nowrap}
.tb tbody tr{cursor:pointer}
.tb tbody tr:hover,.tb tbody tr:focus{background:var(--zebra);outline:none}
.kode{font-family:var(--f-data)}
.tag{margin-left:6px;font-size:10px;padding:1px 5px;border-radius:8px;background:var(--accent-soft);color:var(--accent-ink)}
.st{font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap}
.st.prz{background:var(--warn-bg);color:var(--warn)}.st.berbalik{background:var(--good-bg);color:var(--good)}.st.menuju{background:var(--calm-bg);color:var(--calm)}
.up{color:var(--good)}.dn{color:var(--strong)}.mute{color:var(--ink-2)}.small{font-size:12px}
.err{color:var(--strong)}
</style>
