<script setup>
// Rekomendasi harian: 5 saham Non HSC dan 5 saham HSC terbaik dengan harga di bawah Rp2.000, gabungan semua screening Radar (Harmonic,
// Recovery, Seasonality, Pola Broker, laporan keuangan, Saham 50, KakdrWay) dan sinyal backdoor. Dihitung server sekali
// sehari (/api/rekomendasi, website/rekomendasi.py); halaman ini hanya menampilkan peringkat, alasan, risiko, dan rencana.
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'
import WawasanPanel from '../components/WawasanPanel.vue'

const data = ref(null), err = ref('')
onMounted(() => api.get('/api/rekomendasi').then(v => { data.value = v }, e => { err.value = e.message || String(e) }))
// Kelompok: Non HSC (masuk IHSG) dan HSC (konsentrasi kepemilikan tinggi, dikeluarkan dari IHSG), peringkat terpisah.
const KELOMPOK = [{ k: 'non', nama: 'Non HSC' }, { k: 'hsc', nama: 'HSC' }]
const kel = ref('non')
// Tab halaman: Rekomendasi (daftar harian) dan Wawasan (ilmu yang masih kurang di setiap menu Radar, lib/wawasan.js).
const HALAMAN = [{ k: 'rek', nama: 'Rekomendasi' }, { k: 'wawasan', nama: 'Wawasan' }]
const hal = ref('rek')
const daftarKel = k => (k === 'hsc' ? data.value?.hsc : data.value?.rows) || []
const rows = computed(() => daftarKel(kel.value))
// Pantauan: saham berpotensi di luar daftar utama (cadangan yang lolos syarat, atau sinyal kuat yang belum punya rencana).
const pantau = computed(() => (data.value?.pantauan || []).filter(r => !!r.hsc === (kel.value === 'hsc')))
const maks = computed(() => Math.max(1, ...rows.value.map(r => r.skor)))
const rp = v => v == null ? '–' : 'Rp' + Number(v).toLocaleString('id-ID', { maximumFractionDigits: v < 200 ? 1 : 0 })
const n1 = v => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })
const pct = (a, b) => a && b ? `${a >= b ? '+' : ''}${n1((a / b - 1) * 100)}%` : ''
</script>

<template>
  <div class="rk">
    <nav class="hal" role="tablist" aria-label="Bagian halaman">
      <button v-for="x in HALAMAN" :key="x.k" type="button" role="tab" :aria-selected="String(hal === x.k)" :class="{ on: hal === x.k }" @click="hal = x.k">{{ x.nama }}</button>
    </nav>
    <WawasanPanel v-if="hal === 'wawasan'" />
    <template v-else>
    <header>
      <p class="small ket">Paling banyak 5 saham terbaik per kelompok hari ini dengan harga di bawah {{ rp(data?.batasHarga || 2000) }}, dipisah antara saham Non HSC dan HSC, dipilih dari gabungan semua screening Radar dan sinyal backdoor. Hanya saham dengan target 1 naik 10–20% dan target 2 naik 25–100% dari entry, R:R minimal 1, dan stop paling jauh 15%. Diperbarui setiap hari pukul 00.01 WIB.</p>
      <p v-if="data" class="small muted">Dihitung {{ data.updated }} · {{ data.dinilai }} saham dinilai; lolos syarat {{ data.lolos }} Non HSC dan {{ data.lolosHsc ?? 0 }} HSC (harga di bawah batas dan didukung minimal dua sumber).</p>
    </header>
    <div v-if="data" class="kel" role="tablist" aria-label="Kelompok saham">
      <button v-for="x in KELOMPOK" :key="x.k" type="button" role="tab" :aria-selected="String(kel === x.k)" :class="{ on: kel === x.k }" @click="kel = x.k">
        {{ x.nama }} <b>{{ daftarKel(x.k).length }}</b></button>
    </div>
    <p v-if="data" class="small muted kelket">{{ kel === 'hsc'
      ? 'Saham HSC: konsentrasi kepemilikan tinggi dan dikeluarkan dari perhitungan IHSG. Biasanya lebih tidak likuid dan mudah digerakkan, jadi pakai posisi lebih kecil.'
      : 'Saham Non HSC: masih masuk perhitungan IHSG, kepemilikan publik lebih tersebar.' }}</p>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <p v-else-if="!data" class="small muted">Menghitung rekomendasi…</p>
    <p v-else-if="!rows.length" class="small muted">Belum ada saham {{ kel === 'hsc' ? 'HSC' : 'Non HSC' }} yang memenuhi syarat hari ini.</p>
    <ol v-else class="daftar">
      <li v-for="r in rows" :key="r.t" class="kartu">
        <div class="atas">
          <span class="no">{{ r.peringkat }}</span>
          <div class="id">
            <RouterLink class="ticker big" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink>
            <span class="small muted">{{ r.nama }}</span>
          </div>
          <div class="harga"><b>{{ rp(r.harga) }}</b><span class="small muted">harga terakhir</span></div>
          <div class="skor" :title="'Skor gabungan ' + n1(r.skor)">
            <span class="small muted">Skor</span><b>{{ n1(r.skor) }}</b>
            <i class="bar"><i :style="{ width: (r.skor / maks * 100) + '%' }"></i></i>
          </div>
        </div>
        <div class="chips">
          <span v-for="(v, k) in r.komponen" :key="k" class="chip">{{ k }} <b>{{ n1(v) }}</b></span>
        </div>
        <div class="isi">
          <div>
            <p class="lbl">Alasan</p>
            <ul class="alasan"><li v-for="(a, i) in r.alasan" :key="i">{{ a }}</li></ul>
            <template v-if="r.risiko.length">
              <p class="lbl warn">Yang perlu diwaspadai</p>
              <ul class="risiko"><li v-for="(a, i) in r.risiko" :key="i">{{ a }}</li></ul>
            </template>
          </div>
          <div class="plan">
            <p class="lbl">Rencana</p>
            <template v-if="r.plan">
              <table>
                <tr><td>Entry</td><td>{{ rp(r.plan.entry) }}</td><td></td></tr>
                <tr><td>Stop</td><td>{{ rp(r.plan.stop) }}</td><td class="dn">{{ pct(r.plan.stop, r.plan.entry) }}</td></tr>
                <tr><td>Target 1</td><td>{{ rp(r.plan.tp1) }}</td><td class="up">{{ pct(r.plan.tp1, r.plan.entry) }}</td></tr>
                <tr v-if="r.plan.tp1Ket" class="ketT"><td colspan="3">{{ r.plan.tp1Ket }}</td></tr>
                <tr v-if="r.plan.tp2"><td>Target 2</td><td>{{ rp(r.plan.tp2) }}</td><td class="up">{{ pct(r.plan.tp2, r.plan.entry) }}</td></tr>
                <tr v-if="r.plan.tp2Ket" class="ketT"><td colspan="3">{{ r.plan.tp2Ket }}</td></tr>
                <tr v-if="r.plan.rr != null"><td>R:R target 1</td><td>{{ n1(r.plan.rr) }}</td><td></td></tr>
              </table>
              <p class="small muted">Entry dan stop dari {{ r.plan.sumber }}.</p>
            </template>
            <p v-else class="small muted">Belum ada rencana entry yang memenuhi syarat. Pantau dulu di halaman emiten.</p>
          </div>
        </div>
      </li>
    </ol>
    <section v-if="data && pantau.length" class="pantau" aria-labelledby="pantauJudul">
      <h2 id="pantauJudul">Pantauan {{ kel === 'hsc' ? 'HSC' : 'Non HSC' }} <b>{{ pantau.length }}</b></h2>
      <p class="small muted">Saham berpotensi yang belum masuk daftar di atas, supaya tidak terlewat: cadangan yang sudah lolos semua syarat, lalu saham dengan skor tinggi atau satu sinyal kuat yang belum punya rencana sesuai syarat. Sebabnya ditulis per saham; pantau sampai syaratnya terpenuhi.</p>
      <div class="tabel">
        <table>
          <thead><tr><th>Saham</th><th class="n">Harga</th><th class="n">Skor</th><th>Sumber</th><th>Alasan utama</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="r in pantau" :key="r.t">
              <td><RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink><span class="small muted nm">{{ r.nama }}</span></td>
              <td class="n">{{ rp(r.harga) }}</td>
              <td class="n">{{ n1(r.skor) }}</td>
              <td class="small">{{ Object.keys(r.komponen).join(', ') }}</td>
              <td class="small">{{ r.alasan[0] }}</td>
              <td class="small">
                <span class="tag" :class="r.jenis === 'cadangan' ? 't-calm' : 't-warn'">{{ r.jenis === 'cadangan' ? 'Cadangan' : 'Belum masuk' }}</span>
                <span class="muted"> {{ r.sebab }}</span>
                <span v-if="r.plan" class="rnc">Entry {{ rp(r.plan.entry) }} · stop {{ rp(r.plan.stop) }} · target {{ rp(r.plan.tp1) }} ({{ pct(r.plan.tp1, r.plan.entry) }}) dan {{ rp(r.plan.tp2) }} ({{ pct(r.plan.tp2, r.plan.entry) }})</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <details v-if="data" class="cara">
      <summary>Cara menghitung</summary>
      <p class="small">Setiap sumber memberi poin sampai batas bobotnya. Skor adalah jumlah poin dikurangi poin risiko (distribusi bandar bulanan, broksum harian distribusi bersih 5 hari terakhir, harga menembus terendah 20 hari, laba turun atau rugi, pandangan analis "hindari"). Momentum memberi poin untuk volume minimal 2 kali rata-rata 20 hari dan harga menembus tertinggi 20 hari dalam 5 hari bursa terakhir; Broksum harian memberi poin untuk akumulasi bersih 5 hari terakhir. Saham hanya masuk bila harganya di bawah batas, didukung minimal dua sumber, skornya minimal 20, tidak sedang ada pola harmonik bearish yang aktif, dan punya rencana dengan target 1 naik 10–20% serta target 2 naik 25–100% dari entry (R:R minimal 1, stop paling jauh 15%). Entry dan stop diambil dari satu sumber (urutan Harmonic, Recovery, Momentum, Seasonality, lalu support-resistance chart: entry di harga terakhir, stop di terendah 5 hari atau 20 hari); target diambil dari sumber itu dulu, lalu dari level sumber lain termasuk puncak-puncak sebelumnya di chart (resistance), dengan keterangan asalnya.</p>
      <table class="bobot">
        <tr><th>Sumber</th><th>Bobot maks.</th></tr>
        <tr v-for="(v, k) in data.bobot" :key="k"><td>{{ k }}</td><td>{{ v }}</td></tr>
      </table>
      <p class="small">Sebelum tampil, setiap saham diperiksa ulang: urutan stop, entry, dan target; persen target dan stop sesuai syarat; R:R dan persen yang ditampilkan sama dengan hitungannya; asal target disebut; dan klaim tahap backdoor atau tender offer cocok dengan data Monitor yang sudah terkonfirmasi. Saham yang gagal diganti saham berikutnya.</p>
      <template v-if="data.dibuang?.length">
        <p class="small"><b>Tidak lolos pemeriksaan hari ini:</b></p>
        <ul class="small muted">
          <li v-for="x in data.dibuang" :key="x.t"><b>{{ x.t }}</b>: {{ x.masalah.join('; ') }}</li>
        </ul>
      </template>
      <p class="small muted">Bahan belajar dan kerangka berpikir, bukan rekomendasi beli atau jual. Tetap tunggu konfirmasi dan pasang stop.</p>
    </details>
    </template>
  </div>
</template>

<style scoped>
.rk{display:flex;flex-direction:column;gap:14px}
header h1{margin:0}
.hal{display:flex;gap:22px;align-items:baseline}
.hal button{border:0;background:none;padding:0 0 4px;cursor:pointer;font:700 30px var(--f-display);color:var(--ink-2);border-bottom:3px solid transparent;line-height:1.1}
.hal button.on{color:var(--ink);border-bottom-color:var(--accent)}
.hal button:hover{color:var(--ink)}
.ket{margin:4px 0 2px;max-width:760px}
.muted{color:var(--ink-2)}.small{font-size:12px}.err{color:var(--strong)}
.kel{display:flex;gap:4px}
.kel button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:16px;padding:5px 14px;cursor:pointer;font:600 13px var(--f-body)}
.kel button.on{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.kel b{font-family:var(--f-data);margin-left:3px}
.kelket{margin:-6px 0 0}
.daftar{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.kartu{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:14px 16px;box-shadow:var(--shadow);display:grid;gap:10px}
.atas{display:grid;grid-template-columns:auto minmax(0,1fr) auto 160px;gap:14px;align-items:center}
.no{width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--sheet);display:grid;place-items:center;font:700 15px var(--f-data)}
.id{display:flex;flex-direction:column;min-width:0}
.ticker.big{font:700 18px var(--f-data)}
.harga{display:flex;flex-direction:column;text-align:right}
.harga b{font:700 16px var(--f-data)}
.skor{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}
.skor b{font:700 18px var(--f-data);color:var(--accent);text-align:right}
.bar{grid-column:1/-1;display:block;height:5px;background:var(--rule-2);border-radius:3px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12px;padding:2px 9px;border-radius:12px;background:var(--accent-soft);color:var(--accent)}
.chip b{font-family:var(--f-data);margin-left:2px}
.isi{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:18px}
.lbl{margin:0 0 4px;font-size:12px;font-weight:700;color:var(--ink-2)}
.lbl.warn{color:var(--warn);margin-top:8px}
.alasan,.risiko{margin:0;padding-left:18px;display:grid;gap:3px;font-size:13.5px;line-height:1.5}
.risiko{color:var(--ink-2)}
.plan table{border-collapse:collapse;font-size:13px;width:100%}
.plan td{padding:3px 4px;border-bottom:1px solid var(--rule-2)}
.plan td:nth-child(2){font-family:var(--f-data);text-align:right}
.plan td:nth-child(3){font-family:var(--f-data);text-align:right;font-size:12px}
.plan p{margin:6px 0 0}
.plan tr.ketT td{font:11px var(--f-body);color:var(--ink-2);text-align:left;padding-top:0;border-bottom:1px solid var(--rule-2)}
.up{color:var(--good)}.dn{color:var(--strong)}
.pantau{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:12px 16px}
.pantau h2{margin:0 0 4px;font-size:17px}
.pantau h2 b{font-family:var(--f-data);color:var(--ink-2);margin-left:4px}
.pantau p{margin:0 0 8px}
.tabel{overflow-x:auto}
.tabel table{border-collapse:collapse;width:100%;min-width:760px;font-size:13px}
.tabel th{text-align:left;font-size:12px;color:var(--ink-2);padding:4px 8px;border-bottom:1px solid var(--rule)}
.tabel td{padding:6px 8px;border-bottom:1px solid var(--rule-2);vertical-align:top}
.tabel .n{text-align:right;font-family:var(--f-data);white-space:nowrap}
.tabel .nm{display:block;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tabel td:nth-child(5){max-width:260px}
.tabel td:nth-child(6){min-width:280px}
.rnc{display:block;margin-top:2px;font-family:var(--f-data)}
.cara{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:10px 14px}
.cara summary{cursor:pointer;font-weight:700}
.bobot{border-collapse:collapse;font-size:13px;margin:6px 0}
.bobot td,.bobot th{padding:3px 12px 3px 0;text-align:left;border-bottom:1px solid var(--rule-2)}
@media (max-width: 760px){
  .atas{grid-template-columns:auto minmax(0,1fr) auto}
  .skor{grid-column:1/-1}
  .isi{grid-template-columns:1fr}
}
</style>
