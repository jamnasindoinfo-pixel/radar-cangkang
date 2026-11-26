<script setup>
// Detail satu akun POV: profil gaya, rekam jejak panggilan saham (hit/gagal), potensi saham, dan pelajaran.
import { computed, onMounted, ref } from 'vue'
import Modal from './emiten/Modal.vue'
import SikapTag from './SikapTag.vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { fmt, fmtDate } from '../lib/domain.js'

const props = defineProps({ u: { type: Object, required: true } })
const emit = defineEmits(['close'])
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bulanDepan = (new Date().getMonth() + 1) % 12 + 1
// Pola musiman bulan depan untuk saham incaran (dari Seasonality), bila datanya ada.
const season = ref({})
onMounted(async () => {
  try {
    const r = await api.get('/api/seasonality', { bulan: bulanDepan, tahun: 10 })
    season.value = Object.fromEntries((r.saham || []).map(x => [x.t, x]))
  } catch { /* data seasonality belum siap */ }
})
const sikap = t => store.pandangan?.[t]?.sikap || ''
const STATUS = { hit: ['Hit', 't-good'], gagal: ['Gagal', 't-strong'], netral: ['Tidak bergerak 10%', 't-calm'], belum: ['Belum terbukti', 't-calm'] }
const st = x => STATUS[x?.status] || ['Tidak ada data harga', 't-calm']
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const tick = computed(() => props.u.tickers || [])
const hit = computed(() => props.u.hit || {})
const tercatat = computed(() => tick.value.filter(e => e.track))
const best = computed(() => [...tercatat.value].filter(e => e.track.status === 'hit').sort((a, b) => (b.track.arah === 'bear' ? -b.track.trough : b.track.peak) - (a.track.arah === 'bear' ? -a.track.trough : a.track.peak))[0])
const worst = computed(() => [...tercatat.value].filter(e => e.track.status === 'gagal').sort((a, b) => a.track.ret - b.track.ret)[0])

// Potensi: incaran bullish yang belum gagal, diberi poin bila sejalan radar / pola musiman bulan depan.
const potensi = computed(() => tick.value.filter(e => e.nada !== 'bearish' && e.track?.status !== 'gagal').map(e => {
  const s = season.value[e.t], why = []
  if (e.track?.status === 'hit') why.push(`panggilan terbukti (${pct(e.track.arah === 'bear' ? e.track.trough : e.track.peak)} dalam ${e.track.hari} hari bursa)`)
  if (s) why.push(s.prob >= 60 ? `pola ${BLN[bulanDepan - 1]} kuat: naik ${s.up}/${s.n} tahun, median ${pct(s.median)}` : `catatan: pola ${BLN[bulanDepan - 1]} lemah (naik ${s.up}/${s.n} tahun)`)
  if (sikap(e.t)) why.push(`analisa radar: ${sikap(e.t)}`)
  if (e.n >= 3) why.push(`disebut ${e.n} kali`)
  return { ...e, why, poin: (e.track?.status === 'hit' ? 2 : 0) + (s && s.prob >= 60 ? 2 : 0) + (/asimetri/i.test(sikap(e.t)) ? 1 : 0) - (/hindari/i.test(sikap(e.t)) ? 1 : 0) + Math.min(2, e.n / 3) }
}).filter(e => e.why.length).sort((a, b) => b.poin - a.poin).slice(0, 5))

const GAYA = {
  'Aksi korporasi': 'Membaca keterbukaan informasi (RUPS, rights issue, akuisisi) sebagai katalis; pelajari cara menilai nilai transaksi dan pihak yang diuntungkan.',
  Momentum: 'Mengikuti arus harga dan volume; pelajari disiplin masuk saat breakout dan keluar cepat saat momentum habis.',
  Bandarmologi: 'Membaca akumulasi/distribusi broker; cocokkan dengan tab Pola Broker untuk melihat broker yang sama.',
  Fundamental: 'Menilai laba, valuasi, dan neraca; pelajari cara membandingkan harga dengan nilai wajar.',
  'Makro & sentimen': 'Mengaitkan saham dengan kondisi makro dan berita; pelajari sektor yang paling sensitif terhadap kabar tersebut.',
  Teknikal: 'Memakai indikator dan pola grafik; pelajari titik masuk, batas rugi, dan target yang konsisten.',
}
const pelajaran = computed(() => {
  const u = props.u, out = []
  const s1 = (u.styles || []).find(x => x.n)
  if (s1) out.push(`Gaya utama ${s1.k.toLowerCase()} (${s1.pct}% posting): ${GAYA[s1.k] || ''}`)
  if (hit.value.rate != null) out.push(hit.value.rate >= 60
    ? `Ketepatan relatif tinggi (${hit.value.rate}% dari panggilan yang sudah terbukti arahnya). Layak dipelajari alasan masuknya, tetapi tetap konfirmasi dengan data.`
    : hit.value.rate >= 40 ? `Ketepatan sedang (${hit.value.rate}%). Pakai sebagai sumber ide, lalu saring dengan analisa sendiri.`
      : `Ketepatan rendah (${hit.value.rate}%). Perlakukan sebagai indikator sentimen, bukan sinyal beli.`)
  if (best.value) out.push(`Panggilan terbaik: ${best.value.t} (${pct(best.value.track.arah === 'bear' ? best.value.track.trough : best.value.track.peak)} dalam ${best.value.track.hari} hari bursa sejak ${fmtDate(best.value.track.d0)}). Baca posting awalnya untuk melihat alasan yang dipakai.`)
  if (worst.value) out.push(`Panggilan terlemah: ${worst.value.t} (sekarang ${pct(worst.value.track.ret)}). Pelajari tanda yang terlewat; pasang batas rugi saat mengikuti ide serupa.`)
  if (/scalping|harian/i.test(u.horizon || '')) out.push('Horizon sangat pendek: ide akun ini cepat kedaluwarsa; jangan ikut masuk bila harga sudah jauh dari titik sebut.')
  if (u.avgChars < 90) out.push('Posting singkat tanpa argumen panjang: verifikasi sendiri dokumen dan angka sebelum memakai idenya.')
  if ((u.radarHits || []).length) out.push(`Banyak membahas saham backdoor (${u.radarHits.slice(0, 5).join(', ')}): bandingkan pandangannya dengan kewajaran aset di tab Analisa.`)
  return out
})
</script>

<template>
  <Modal labelledby="povTitle" close-label="Tutup detail akun" @close="emit('close')">
    <div class="pd">
      <h2 id="povTitle"><a :href="u.url" target="_blank" rel="noopener">@{{ u.username }}</a>
        <span v-if="u.priority" class="tag t-now">prioritas</span><span v-if="u.trending" class="tag t-warn">trending</span></h2>
      <div class="kpi">
        <div><b>{{ hit.rate != null ? hit.rate + '%' : '–' }}</b><span>ketepatan panggilan ({{ hit.hit || 0 }} hit / {{ hit.gagal || 0 }} gagal)</span></div>
        <div><b>{{ u.posts }}</b><span>posting ide · {{ fmt(u.perDay, 1) }}/hari</span></div>
        <div><b>{{ fmt(u.avgLikes, 0) }}</b><span>rata-rata suka</span></div>
        <div><b>{{ u.horizon || '–' }}</b><span>horizon</span></div>
      </div>
      <div class="sty">
        <span v-for="s in u.styles.filter(x => x.n)" :key="s.k" class="st"><i :style="{ width: Math.max(4, s.pct) + '%' }"></i>{{ s.k }} {{ s.pct }}%</span>
      </div>

      <h3>Yang bisa dipelajari</h3>
      <ul class="small"><li v-for="x in pelajaran" :key="x">{{ x }}</li></ul>

      <h3>Potensi saham dari akun ini</h3>
      <ul v-if="potensi.length" class="small pot">
        <li v-for="e in potensi" :key="e.t"><RouterLink :to="{ path: '/emiten/' + e.t, query: { tab: 'analisa' } }" @click="emit('close')"><b>{{ e.t }}</b></RouterLink>: {{ e.why.join('; ') }}</li>
      </ul>
      <p v-else class="small muted">Belum ada saham incaran yang didukung bukti tambahan.</p>

      <h3>Rekam jejak panggilan saham</h3>
      <p class="small muted">Diuji dari sebutan berarah pertama: Hit bila dalam 20 hari bursa harga lebih dulu bergerak 10% searah (naik untuk bullish, turun untuk bearish); Gagal bila 10% berlawanan lebih dulu.</p>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th class="num">Sebutan</th><th>Nada</th><th>Pertama disebut</th><th>Hasil</th><th class="num">Puncak / terendah 20 hari</th><th class="num">Sejak disebut</th><th>Radar</th></tr></thead>
          <tbody>
            <tr v-for="e in tick" :key="e.t">
              <td><RouterLink :to="{ path: '/emiten/' + e.t, query: { tab: 'analisa' } }" @click="emit('close')"><b>{{ e.t }}</b></RouterLink></td>
              <td class="num">{{ e.n }}</td>
              <td><span class="tag" :class="e.nada === 'bullish' ? 't-good' : e.nada === 'bearish' ? 't-strong' : 't-calm'">{{ e.nada }}</span></td>
              <td class="small">{{ e.track ? fmtDate(e.track.d0) + ' · ' + rp(e.track.p0) : (e.first ? fmtDate(e.first) : '–') }}</td>
              <td><span class="tag" :class="st(e.track)[1]">{{ st(e.track)[0] }}</span><span v-if="e.track?.hari" class="small muted"> {{ e.track.hari }} hari</span></td>
              <td class="num small">{{ e.track ? pct(e.track.peak) + ' / ' + pct(e.track.trough) : '–' }}</td>
              <td class="num" :class="e.track && e.track.ret >= 0 ? 'c-good' : 'c-strong'">{{ e.track ? pct(e.track.ret) : '–' }}</td>
              <td><SikapTag v-if="sikap(e.t)" :sikap="sikap(e.t)" /><span v-else class="muted small">–</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 v-if="u.latest?.length">Posting terbaru</h3>
      <ul class="small"><li v-for="p in u.latest" :key="p.url"><a :href="p.url" target="_blank" rel="noopener">{{ fmtDate(p.d) }}</a> · {{ p.text }}</li></ul>
      <p class="small muted">Dihitung otomatis dari posting ide publik dan harga penutupan harian; bukan rekomendasi beli/jual.</p>
    </div>
  </Modal>
</template>

<style scoped>
.pd{max-width:980px;display:flex;flex-direction:column;gap:8px}
.pd h2{margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pd h3{margin:10px 0 2px;font-size:14px;text-transform:uppercase;letter-spacing:.04em}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.kpi div{border:1px solid var(--rule);border-top:3px solid var(--good);padding:8px 10px;display:flex;flex-direction:column}
.kpi b{font-size:22px}.kpi span{font-size:12px;color:var(--muted)}
.sty{display:flex;flex-direction:column;gap:3px}
.st{position:relative;font-size:12px;padding:1px 6px}.st i{position:absolute;left:0;top:0;bottom:0;background:var(--rule);z-index:-1}
.pot li{margin:3px 0}
</style>
