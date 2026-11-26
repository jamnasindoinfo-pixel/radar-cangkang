<script setup>
// Simulasi valuasi target (mis. Rp2,5 T atau Rp5 T) dan pengendali mengambil dana, serta sudut pandang
// pengendali/bandar: modal masuk, saham yang didapat, harga impas, dan laba kertas.
import { computed, ref, watch } from 'vue'
import { fmt, rp, big } from '../../lib/domain.js'
import { valuasiSim, bandarView } from '../../lib/valuasi.js'

// part = valuasi (simulasi valuasi target) | bandar (sudut pandang pengendali); kosong = keduanya.
const props = defineProps({ part: { type: String, default: '' }, c: { type: Object, required: true }, r: { type: Object, default: null }, P: { type: Number, required: true }, labaSetahun: { type: Number, default: null } })
// Isian dalam triliun rupiah; bawaan: valuasi = nilai penerbitan + kapitalisasi kini (dibulatkan), ambil = 20% valuasi.
const T = ref(0), AMBIL = ref(0)
watch(() => props.c, c => {
  const base = ((props.r?.total || 0) + (c.mcap || 0)) / 1e12
  T.value = base > 0 ? Math.max(0.1, Math.round(base * 10) / 10) : 1
  AMBIL.value = Math.round(T.value * 0.2 * 10) / 10
}, { immediate: true })
const v = computed(() => valuasiSim(props.c, props.r, { target: (+T.value || 0) * 1e12, ambil: (+AMBIL.value || 0) * 1e12, labaSetahun: props.labaSetahun }))
const b = computed(() => bandarView(props.c, props.r, props.P, props.c.doc?.pengendali || {}, (+T.value || 0) * 1e12))
// Harga per saham dengan desimal bila tidak bulat (mis. Rp23,5).
const rpD = x => x == null ? '–' : Number.isInteger(+x) ? rp(x) : 'Rp' + fmt(x, 2)
const pc = x => x == null ? '–' : fmt(x * 100, x < 0.1 ? 2 : 1) + '%'
const xs = x => x == null ? '–' : fmt(x, x >= 10 ? 0 : 2) + '×'
const sh = x => x == null ? '–' : x >= 1e9 ? fmt(x / 1e9, 2) + ' miliar' : fmt(x / 1e6, 0) + ' jt'
const sgn = x => x == null ? '–' : (x >= 0 ? '+' : '−') + big(Math.abs(x))
const name = computed(() => props.c.doc?.pengendali?.nama || '')
// Ukuran kewajaran: PBV nilai buku riil bila tersedia, selain itu PBV nilai transaksi.
const pbvU = computed(() => v.value?.pbvReal || v.value?.pbv || null)
</script>

<template>
  <div class="vs">
    <template v-if="part !== 'bandar'">
    <h3 class="lbl">Simulasi valuasi target dan pengendali mengambil dana</h3>
    <div class="inp">
      <label>Valuasi setelah RI (Rp triliun)<input v-model.number="T" type="number" min="0.01" step="0.1" class="pin"></label>
      <label>Dana yang diambil pengendali (Rp triliun)<input v-model.number="AMBIL" type="number" min="0" step="0.1" class="pin"></label>
      <span class="small muted">Harga pelaksanaan simulasi {{ rp(P) }} · saham setelah RI {{ sh(r?.S1) }}</span>
    </div>
    <template v-if="v">
      <table class="ledger st">
        <tbody>
          <tr><td>Harga per saham pada valuasi {{ big(v.target) }}</td><td class="num"><b>{{ rp(Math.round(v.harga)) }}</b></td><td class="small muted">valuasi ÷ {{ sh(v.S1) }} saham setelah RI</td></tr>
          <tr><td>Harga ditarik ke berapa kali harga kini</td><td class="num"><b :class="v.x >= 1 ? 'c-good' : 'c-strong'">{{ xs(v.x) }}</b></td><td class="small muted">potensi {{ v.upside >= 0 ? 'kenaikan' : 'penurunan' }} {{ pc(Math.abs(v.upside)) }} dari {{ rp(c.price) }}</td></tr>
          <tr v-if="v.vsTerp"><td>Dibanding harga teoretis setelah RI</td><td class="num">{{ xs(v.vsTerp) }}</td><td class="small muted">harga teoretis {{ rp(Math.round(r.terp)) }}</td></tr>
          <tr v-if="v.pbv"><td>PBV tersirat (aset pada nilai transaksi)</td><td class="num">{{ xs(v.pbv) }}</td><td class="small muted">ekuitas setelah transaksi ±{{ big(v.eqPost) }} (nilai buku/saham {{ rp(Math.round(v.bvps)) }})</td></tr>
          <tr v-if="v.pbvReal"><td>PBV terhadap nilai buku riil</td><td class="num"><b>{{ xs(v.pbvReal) }}</b></td><td class="small muted">ekuitas emiten + nilai buku aset {{ big(v.asetBook) }} = ±{{ big(v.eqReal) }}</td></tr>
          <tr v-if="v.per"><td>PER tersirat</td><td class="num">{{ xs(v.per) }}</td><td class="small muted">laba setahun setelah aset masuk {{ big(v.labaSetahun) }}</td></tr>
        </tbody>
      </table>
      <p class="small"><b>Wajar atau tidak:</b>
        <template v-if="pbvU">valuasi {{ big(v.target) }} setara {{ xs(pbvU) }} {{ v.pbvReal ? 'nilai buku riil' : 'nilai buku setelah transaksi' }}{{ v.per ? ` dan ${xs(v.per)} laba` : '' }}.
          {{ pbvU <= 1.5 ? 'Masih dekat nilai buku: relatif wajar bila nilai aset terbukti.' : pbvU <= 3 ? 'Di atas nilai buku: perlu laba aset yang nyata untuk membenarkannya.' : 'Jauh di atas nilai buku: bertumpu pada harapan, bukan aset atau laba saat ini.' }}
          <template v-if="v.pbvReal && v.pbv && v.pbvReal > v.pbv * 2"> PBV versi nilai transaksi ({{ xs(v.pbv) }}) terlihat rendah hanya karena aset dicatat sebesar harga yang dibayar.</template></template>
        <template v-else>ekuitas emiten belum tersedia; bandingkan dengan kewajaran aset di atas.</template>
      </p>
      <div v-if="v.jual" class="two">
        <div>
          <h4>A. Pengendali menjual saham (distribusi)</h4>
          <p class="small">Mengambil {{ big(v.ambil) }} pada {{ rp(Math.round(v.harga)) }} berarti menjual <b>{{ sh(v.jual.saham) }} saham</b> = <b>{{ pc(v.jual.pctPerusahaan) }}</b> perusahaan, yang harus diserap pembeli di pasar.</p>
        </div>
        <div>
          <h4>B. Menghimpun dana lewat RI baru</h4>
          <p class="small">RI baru pada valuasi {{ big(v.target) }}: harga {{ rp(Math.round(v.ri.harga)) }}, <b>{{ sh(v.ri.saham) }} saham baru</b>, dilusi {{ pc(v.ri.dilusi) }}; valuasi setelah dana masuk {{ big(v.ri.postMoney) }}.</p>
        </div>
      </div>
    </template>

    </template>
    <template v-if="b && part !== 'valuasi'">
      <h3 class="lbl">Sudut pandang pengendali<template v-if="name"> ({{ name }})</template></h3>
      <table class="ledger st">
        <tbody>
          <tr><td>Saham awal</td><td class="num">{{ sh(b.sahamAwal) }} ({{ fmt(b.porsi, 2) }}%)</td><td class="small muted"><template v-if="b.hargaMasuk">masuk di {{ rpD(b.hargaMasuk) }} · modal {{ big(b.modalAwal) }}</template><template v-else>harga masuk belum diungkap</template></td></tr>
          <tr v-if="b.sahamInbreng"><td>Saham dari inbreng aset</td><td class="num">{{ sh(b.sahamInbreng) }}</td><td class="small muted">aset {{ big(b.asetDisetor) }} ÷ {{ rp(P) }} (asumsi aset milik pengendali/afiliasi)</td></tr>
          <tr v-if="b.sahamTebus"><td>Saham dari menebus porsi tunai</td><td class="num">{{ sh(b.sahamTebus) }}</td><td class="small muted">setor {{ big(b.tunaiPorsi) }}</td></tr>
          <tr><td>Total saham &amp; porsi setelah RI</td><td class="num"><b>{{ sh(b.totalSaham) }}</b></td><td class="small muted">{{ pc(b.porsiSetelah) }} perusahaan</td></tr>
          <tr><td>Total modal disetor</td><td class="num">{{ big(b.totalModal) }}</td><td class="small muted">modal awal + tunai + nilai aset</td></tr>
          <tr><td>Harga impas pengendali</td><td class="num"><b>{{ rp(Math.round(b.impas)) }}</b></td><td class="small muted">total modal ÷ total saham</td></tr>
          <tr v-if="b.kelipatanAwal"><td>Untung modal awal di harga kini</td><td class="num">{{ xs(b.kelipatanAwal) }}</td><td class="small muted">{{ rp(c.price) }} ÷ harga masuk {{ rpD(b.hargaMasuk) }}</td></tr>
          <tr><td>Laba kertas</td><td class="num" colspan="2">
            <span class="small">harga kini: <b>{{ sgn(b.labaKini) }}</b></span>
            <span v-if="b.labaTerp != null" class="small"> · harga teoretis: <b>{{ sgn(b.labaTerp) }}</b></span>
            <span v-if="b.labaTarget != null" class="small"> · valuasi target ({{ rp(Math.round(b.hargaTarget)) }}): <b>{{ sgn(b.labaTarget) }}</b></span>
          </td></tr>
        </tbody>
      </table>
      <p class="small"><b>Cara pandang bandar:</b> pengendali sudah aman bila harga pasar di atas harga impas {{ rp(Math.round(b.impas)) }}<template v-if="b.hargaMasuk">, dan modal awalnya sudah berlipat {{ xs(b.kelipatanAwal) }}</template>. Makin besar saham yang didapat dari inbreng pada harga RI yang tinggi, makin kecil dorongan menaikkan harga; sebaliknya harga RI rendah dengan aset bernilai tinggi memperbesar porsi pengendali dan peluang distribusi setelah harga dinaikkan.</p>
    </template>
  </div>
</template>

<style scoped>
.vs{margin:12px 0}
.inp{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:flex-end;margin:6px 0}
.inp label{display:flex;flex-direction:column;font-size:12px;gap:3px}
.pin{width:140px;font:600 13px var(--f-display)}
.st td{vertical-align:top}
.st .num{text-align:right;white-space:nowrap}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
h4{margin:8px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.c-good{color:var(--good)} .c-strong{color:var(--strong)}
</style>
