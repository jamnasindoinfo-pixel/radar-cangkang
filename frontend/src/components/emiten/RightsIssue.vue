<script setup>
// Analisa PMHMETD / PMTHMETD / penerbitan saham merger: nilai injeksi aset, nilai penerbitan (aset + tunai),
// siapa harus menyetor, TERP & nilai HMETD, dampak per lot, dan porsi publik. Harga pelaksanaan dan tingkat
// penebusan publik bisa digeser untuk simulasi; nilai awal dari data kurasi.
import { computed, ref, watch } from 'vue'
import { fmt, rp, big } from '../../lib/domain.js'
import { riCalc, riRange, riVerdict, noRights, riFunding, riPriceNeeded, riScenarios, riExercise, asetLaba, labaSebelumSesudah, riLayak, riTrading, riRating } from '../../lib/rightsIssue.js'
import { fmtDate } from '../../lib/domain.js'
import { store, storyOf } from '../../store.js'
import { buildRiDeck, riDeckFileName } from '../../lib/deck.js'
import { sectorOf, pickTheme } from '../../lib/deckThemes.js'
import DeckDownload from './DeckDownload.vue'
import RiDokumen from './RiDokumen.vue'
import RencanaKorporasi from './RencanaKorporasi.vue'
import RiValuasi from './RiValuasi.vue'

const props = defineProps({ c: { type: Object, required: true }, ticker: { type: String, default: '' }, name: { type: String, default: '' } })
const range = computed(() => riRange(props.c))
// Batas atas slider ikut melebar bila harga yang diketik melebihi rentang bawaan.
const hiP = computed(() => Math.max(range.value.hi, Math.ceil(+P.value || 0)))
const P = ref(0), U = ref(0)
watch(() => props.c, c => { P.value = riRange(c).start; U.value = 0 }, { immediate: true })
const r = computed(() => riCalc(props.c, +P.value, (+U.value || 0) / 100))
const verdict = computed(() => riVerdict(props.c, r.value))
// Apakah dana kemungkinan terkumpul (mengikuti simulasi harga & penebusan yang dipilih).
const fund = computed(() => riFunding(props.c, r.value))
const nr = computed(() => noRights(props.c))
// Harga saham yang dibutuhkan agar dana tunai tercapai (mengikuti harga pelaksanaan simulasi).
const need = computed(() => riPriceNeeded(props.c, +P.value))
// Tabel skenario rasio → harga RI → harga saham yang dibutuhkan → TERP → dilusi.
const scen = computed(() => riScenarios(props.c, +P.value))
// Catatan tambahan simulasi: nilai HMETD, porsi wajib pengendali, dan beban likuiditas pasar.
const extra = computed(() => {
  const x = r.value, c = props.c
  if (!x || !scen.value) return null
  const tunai = x.tunai || 0
  return {
    hak: x.hak, ctrlCash: c.ctrlPct != null ? tunai * c.ctrlPct / 100 : null, ctrlPct: c.ctrlPct,
    days: c.avgVal > 0 ? tunai / c.avgVal : null, avgVal: c.avgVal || null, tunai,
    uses: (c.doc?.penggunaanDana || []).slice(0, 4),
  }
})
// Rasio lama : baru tanpa nol desimal yang tidak perlu (1 : 1, 1 : 2,5, 4 : 1).
const num = v => fmt(v, Number.isInteger(+v.toFixed(2)) ? 0 : 2)
// Dasar perhitungan harga pelaksanaan pada rasio pilihan (1 saham lama : R saham baru; bawaan 1 : 1).
// Laba sebelum/sesudah aset masuk dan kesimpulan layak investasi (mengikuti simulasi harga yang dipilih).
const lbA = computed(() => props.c.doc ? asetLaba(props.c.doc, { S1: r.value?.S1, P: +P.value }) : null)
const ls = computed(() => labaSebelumSesudah(props.c, r.value, lbA.value))
const layak = computed(() => riLayak(props.c, r.value, lbA.value, ls.value))
// Skenario kedua: trading jangka pendek memanfaatkan aksi korporasi.
const trade = computed(() => riTrading(props.c, r.value))
// Rekomendasi bergaya manajer investasi (rating + sikap atas partisipasi rights issue).
const rating = computed(() => riRating(layak.value, trade.value, props.c, r.value))
// Alasan searah putusan (utama) dipisah dari faktor sebaliknya agar poin positif tidak tercantum di bawah "Tidak layak, karena".
const layakWhy = computed(() => {
  const rs = layak.value?.reasons || [], pos = layak.value?.key === 'layak'
  return { utama: rs.filter(x => pos ? x.s >= 0 : x.s <= 0), lawan: rs.filter(x => pos ? x.s < 0 : x.s > 0) }
})
const R = ref(1)
const ex = computed(() => riExercise(props.c, +R.value))
const rp2 = v => 'Rp' + fmt(v, 2)
const ratioTxt = r => r >= 1 ? `1 : ${num(r)}` : `${num(1 / r)} : 1`
const NEED = { cukup: ['Harga kini sudah cukup', 'good'], tipis: ['Selisih harga tipis', 'warn'], kurang: ['Harga kini belum cukup', 'strong'], 'tidak diketahui': ['Harga belum tersedia', 'warn'] }
const pct = (v, d = 1) => v == null ? '–' : fmt(v * 100, d) + '%'
const sh = v => v == null ? '–' : v >= 1e9 ? fmt(v / 1e9, 2) + ' miliar' : fmt(v / 1e6, 0) + ' jt'
const pSrc = computed(() => {
  const c = props.c, p = +P.value
  if (c.ex && p === Math.round(c.ex)) return c.exAssumed ? 'asumsi data' : `dokumen: ${c.doc?.hargaPelaksanaan?.status || 'resmi'}`
  if (c.implied && p === Math.round(c.implied)) return 'tersirat: nilai aset ÷ saham baru'
  return 'simulasi'
})
// Komposisi nilai penerbitan vs nilai aset injeksi (lebar relatif 0–100).
const bars = computed(() => {
  const x = r.value
  if (!x) return null
  const m = Math.max(x.total, props.c.inj || 0) || 1
  return { aset: x.aset / m * 100, tunai: x.tunai / m * 100, inj: (props.c.inj || 0) / m * 100 }
})
const STATUS = { rencana: 'Rencana', berjalan: 'Berjalan', tereksekusi: 'Sudah tereksekusi' }
const d = computed(() => props.c.detail)

// Unduhan khusus analisa ini (bukan presentasi lengkap); memakai harga & penebusan simulasi yang sedang dipilih.
const sector = computed(() => {
  const t = props.ticker, it = store.items.find(x => x.ticker === t), a = store.aset?.[t]?.aset
  return sectorOf({ baru: (it ? storyOf(t)?.baru : '') || store.verified?.[t]?.baru, aset: [a?.sektor, a?.nama].filter(Boolean).join(' '), nama: it?.name || props.name })
})
async function build({ PptxGenJS, choose, lastId, onStep }) {
  const theme = pickTheme(sector.value.id, { lastId, choose })
  const date = new Date().toISOString().slice(0, 10)
  onStep('Menyusun slide')
  const pres = buildRiDeck(PptxGenJS, { t: props.ticker, name: props.name, date, sector: sector.value, c: props.c, P: +P.value, U: +U.value }, theme)
  return { pres, file: riDeckFileName(props.ticker, date, theme), theme, sector: sector.value.label }
}
</script>

<template>
  <section class="rule-top ri">
    <div class="hd">
      <h2>Analisa {{ c.label }}</h2>
      <span class="tag" :class="c.status === 'tereksekusi' ? 't-good' : c.status === 'berjalan' ? 't-now' : 't-warn'">{{ STATUS[c.status] }}</span>
      <span v-if="c.jadwal" class="small muted">{{ c.jadwal }}</span>
    </div>
    <p class="small muted">Disusun seperti karya ilmiah: gambaran, data, analisa, lalu kesimpulan di akhir; setiap topik hanya muncul sekali. Angka mengikuti simulasi di bagian 5.</p>

    <h3 class="sec">1. Gambaran penambahan modal</h3>
    <div v-if="r" class="kpi">
      <div v-if="c.inj" class="k">
        <span class="lbl">Nilai transaksi injeksi aset</span>
        <b>{{ big(c.inj) }}</b>
        <em class="small muted">{{ c.injTarget || 'aset injeksi' }}<template v-if="c.kjpp"> · KJPP {{ big(c.kjpp) }} ({{ c.inj >= c.kjpp ? '+' : '' }}{{ fmt((c.inj / c.kjpp - 1) * 100, 0) }}%)</template><template v-else-if="c.kjppStatus === 'belum'"> · KJPP belum terbit</template></em>
      </div>
      <div class="k">
        <span class="lbl">Nilai penerbitan saham</span>
        <b>{{ big(r.total) }}</b>
        <em class="small muted">{{ sh(r.N) }} saham × {{ rp(P) }}<template v-if="r.vsMcap != null"> · {{ fmt(r.vsMcap, 1) }}× kapitalisasi</template></em>
      </div>
      <div class="k">
        <span class="lbl">Kebutuhan dana tunai</span>
        <b>{{ big(r.tunai) }}</b>
        <em class="small muted"><template v-if="r.aset">sisanya {{ big(r.aset) }} disetor non-tunai (aset/konversi utang)</template><template v-else>seluruhnya tunai</template></em>
      </div>
      <div class="k">
        <span class="lbl">Harga pelaksanaan</span>
        <b>{{ rp(P) }}</b>
        <em class="small muted">{{ pSrc }}<template v-if="r.disc != null"> · {{ r.disc >= 0 ? 'premi' : 'diskon' }} {{ fmt(Math.abs(r.disc) * 100, 0) }}% vs pasar {{ rp(c.price) }}</template></em>
      </div>
    </div>
    <!-- Struktur rencana korporasi (langkah berurutan dari dokumen), bila tersedia. -->
    <RencanaKorporasi v-if="c.doc?.rencanaKorporasi" :rk="c.doc.rencanaKorporasi" />

    <h3 class="sec">2. Pengendali dan key person</h3>
    <RiDokumen v-if="c.doc" :doc="c.doc" part="pengendali" />
    <RiValuasi v-if="r" part="bandar" :c="c" :r="r" :P="+P" />

    <h3 class="sec">3. Aset injeksi dan laba</h3>
    <RiDokumen v-if="c.doc" :doc="c.doc" part="aset" :post="{ S1: r?.S1, P: +P }" />
    <!-- Rincian nilai aset injeksi: kisaran antar-sumber, profil aset, cara bayar, penilaian, data belum diungkap. -->
    <div v-if="!c.doc && d && (d.nama || d.lo)" class="aset">
      <h3 class="lbl">Rincian nilai aset injeksi</h3>
      <div class="ag">
        <div class="ac val">
          <span class="small muted">Nilai {{ d.spread ? 'indikatif (beda antar-sumber)' : 'transaksi' }}</span>
          <b>{{ d.spread ? `${big(d.lo)} – ${big(d.hi)}` : big(d.hi) }}</b>
          <span v-if="d.spread" class="small muted">Dipakai di hitungan: {{ big(c.inj) }}</span>
          <span v-if="d.nilaiText" class="small">{{ d.nilaiText }}</span>
        </div>
        <div v-if="d.nama" class="ac">
          <span class="small muted">Aset</span>
          <b class="nm">{{ d.nama }}</b>
          <span v-if="d.jenis" class="small">{{ d.jenis }}</span>
          <span class="small muted">{{ [d.lokasi, d.porsi].filter(Boolean).join(' · ') }}</span>
        </div>
        <div v-if="d.cara" class="ac">
          <span class="small muted">Cara bayar</span>
          <span class="small">{{ d.cara }}</span>
        </div>
        <div class="ac">
          <span class="small muted">Penilaian independen (KJPP)</span>
          <b :class="d.kjpp.status === 'terbit' ? 'ok' : 'wait'">{{ d.kjpp.status === 'terbit' ? (d.kjpp.nilai ? big(d.kjpp.nilai) : 'Terbit') : d.kjpp.status === 'ditunjuk' ? 'Penilai ditunjuk' : 'Belum ada' }}</b>
          <span v-if="d.kjpp.nama" class="small">{{ d.kjpp.nama }}<template v-if="d.kjpp.metode"> · {{ d.kjpp.metode }}</template></span>
          <span v-if="d.kjpp.ket" class="small muted">{{ d.kjpp.ket }}</span>
        </div>
      </div>
      <dl v-if="d.facts.length" class="facts">
        <div v-for="[l, v] in d.facts" :key="l"><dt class="small muted">{{ l }}</dt><dd class="small">{{ typeof v === 'number' ? big(v) : v }}</dd></div>
      </dl>
      <div v-if="d.gaps.length" class="gaps">
        <span class="small muted">Belum diungkap ke publik:</span>
        <span v-for="g in d.gaps" :key="g" class="tag t-warn">{{ g }}</span>
      </div>
    </div>
    <!-- Tahap I (dana) vs tahap II (aset) agar tidak tertukar. -->
    <div v-if="r && c.laterInj" class="tahap">
      <div class="tc">
        <span class="lbl">Tahap I · {{ c.label }}</span>
        <b>{{ big(r.total) }}</b>
        <span class="small">{{ sh(r.N) }} saham × {{ rp(P) }}<template v-if="c.jadwal"> · {{ c.jadwal }}</template></span>
        <span class="small muted">Dana tunai, bukan untuk membeli aset.</span>
      </div>
      <span class="arr" aria-hidden="true">+</span>
      <div class="tc">
        <span class="lbl">Tahap II · injeksi aset</span>
        <b>{{ big(c.laterInj) }}</b>
        <span class="small">dibayar ±{{ sh(r.injShares) }} saham baru pada {{ rp(P) }}</span>
        <span class="small muted">Porsi publik bisa turun ke {{ pct(r.pubAfterInj, 1) }}.</span>
      </div>
    </div>
    <template v-if="r">
      <!-- Laba emiten sebelum vs setelah aset masuk. -->
      <div v-if="ls" class="dasar">
        <h3 class="lbl">Laba sebelum dan setelah aset masuk</h3>
        <div class="scroll">
          <table class="ledger st">
            <thead><tr><th></th><th class="num">Sebelum</th><th class="num">Setelah</th><th class="num">Perubahan</th></tr></thead>
            <tbody>
              <tr><td>Laba bersih setahun</td><td class="num">{{ big(ls.before.laba) }}</td><td class="num"><b>{{ big(ls.after.laba) }}</b></td><td class="num" :class="ls.dLaba >= 0 ? 'c-good' : 'c-strong'">{{ ls.dLaba >= 0 ? '+' : '' }}{{ big(ls.dLaba) }}</td></tr>
              <tr><td>Jumlah saham</td><td class="num">{{ sh(ls.before.saham) }}</td><td class="num">{{ sh(ls.after.saham) }}</td><td class="num">+{{ fmt((ls.after.saham / ls.before.saham - 1) * 100, 0) }}%</td></tr>
              <tr><td>Laba per saham (EPS)</td><td class="num">Rp{{ fmt(ls.before.eps, 2) }}</td><td class="num"><b>Rp{{ fmt(ls.after.eps, 2) }}</b></td><td class="num" :class="ls.akresi ? 'c-good' : 'c-strong'">{{ (ls.akresi ? 'naik ' : 'turun ') + (ls.dEps != null ? fmt(Math.abs(ls.dEps) * 100, 0) + '%' : '') }}</td></tr>
              <tr><td>Harga acuan</td><td class="num">{{ rp(ls.before.harga) }} <span class="small muted">kini</span></td><td class="num">{{ rp(Math.round(ls.after.harga)) }} <span class="small muted">teoretis</span></td><td></td></tr>
              <tr><td>PER</td><td class="num">{{ ls.before.per ? fmt(ls.before.per, 1) + '×' : 'rugi' }}</td><td class="num">{{ ls.after.per ? fmt(ls.after.per, 1) + '×' : 'rugi' }}</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <p class="small">Setelah = laba emiten 12 bulan terakhir + laba porsi aset {{ big(lbA.labaPorsi) }} setahun, dibagi seluruh saham setelah penerbitan pada harga RI {{ rp(P) }}. <b>{{ ls.akresi ? 'Transaksi menaikkan laba per saham (akresi).' : 'Transaksi menurunkan laba per saham (dilutif): tambahan laba tidak sebanding dengan tambahan saham.' }}</b></p>
      </div>
      <p v-else-if="c.doc && c.labaEmiten != null && !lbA" class="small muted">Laba sebelum vs setelah aset masuk belum dapat dihitung: laba aset belum diungkap di dokumen.</p>
    </template>

    <h3 class="sec">4. Struktur penerbitan dan dana</h3>
    <RiDokumen v-if="c.doc" :doc="c.doc" part="fakta" />
    <template v-if="r">
      <!-- Komposisi penerbitan vs nilai aset. -->
      <div v-if="bars" class="fund">
        <div v-if="c.inj" class="row"><span class="small">Nilai aset injeksi</span><div class="track"><i class="inj" :style="{ width: bars.inj + '%' }" /></div><b>{{ big(c.inj) }}</b></div>
        <div class="row"><span class="small">Nilai penerbitan</span>
          <div class="track"><i class="as" :style="{ width: bars.aset + '%' }" /><i class="tu" :style="{ width: bars.tunai + '%' }" /></div><b>{{ big(r.total) }}</b></div>
        <p class="small muted legend"><i class="sw as" />non-tunai (inbreng/konversi utang) <i class="sw tu" />tunai
          <template v-if="c.laterInj"> · Aset {{ big(c.laterInj) }} dibayar saham di tahap lanjutan: setara {{ sh(r.injShares) }} saham pada {{ rp(P) }}.</template>
          <template v-else-if="r.gap > c.inj * 0.05"> · Kekurangan {{ big(r.gap) }} harus ditutup utang, kas internal, atau tahap lanjutan.</template>
        </p>
        <p v-if="c.injCara" class="small muted">{{ c.injCara }}</p>
      </div>
      <div class="grid">
        <div v-if="!nr" class="box">
          <h3 class="lbl">Siapa harus menyetor</h3>
          <table class="ledger">
            <tbody>
              <tr><td>Bagian pengendali ({{ fmt(c.ctrlPct || 0, 2) }}%)</td><td class="r num">{{ big(r.ctrlPart) }}</td></tr>
              <tr><td>Bagian publik ({{ fmt(c.float || 0, 2) }}%) bila menebus semua</td><td class="r num">{{ big(r.pubPart) }}</td></tr>
              <tr><td>Sisa publik diserap pembeli siaga/pengendali</td><td class="r num"><b>{{ big(r.standby) }}</b></td></tr>
              <tr><td>Porsi pengendali bila menyerap sisa</td><td class="r num">{{ fmt(c.ctrlPct || 0, 2) }}% → <b>{{ pct(r.ctrlAfterAbsorb, 2) }}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div v-else class="box">
          <h3 class="lbl">{{ c.kind === 'merger' ? 'Pemegang saham pihak yang digabung' : 'Investor baru' }}</h3>
          <table class="ledger">
            <tbody>
              <tr><td>Porsi penerima saham baru</td><td class="r num"><b>{{ pct(r.newHolder, 2) }}</b></td></tr>
              <tr><td>Porsi pengendali sekarang → setelah</td><td class="r num">{{ fmt(c.ctrlPct || 0, 2) }}% → {{ pct(r.ctrlAfterNr, 2) }}</td></tr>
              <tr><td>{{ r.aset ? 'Nilai aset masuk' : 'Dana masuk' }}</td><td class="r num">{{ big(r.total) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <h3 class="sec">5. Simulasi harga pelaksanaan, dana, dan valuasi</h3>
    <!-- Simulasi. -->
    <div class="sim">
      <label class="sl">
        <span class="small">Harga pelaksanaan <b>{{ rp(P) }}</b>
          <input v-model.number="P" type="number" min="1" step="1" class="pin" aria-label="Ketik harga pelaksanaan (Rp)"></span>
        <input v-model.number="P" type="range" :min="range.lo" :max="hiP" :step="range.step" aria-label="Harga pelaksanaan">
        <span class="ends small muted"><span>{{ rp(range.lo) }}</span><span v-if="c.price">pasar {{ rp(c.price) }}</span><span>{{ rp(hiP) }}</span></span>
        <span v-if="c.nominal && P < c.nominal" class="small c-strong">Di bawah nilai nominal {{ rp(c.nominal) }}: secara aturan saham tidak dapat diterbitkan di bawah nominal (simulasi saja).</span>
      </label>
      <label v-if="!nr" class="sl">
        <span class="small">Publik menebus <b>{{ U }}%</b></span>
        <input v-model.number="U" type="range" min="0" max="100" step="5" aria-label="Persentase publik menebus">
        <span class="ends small muted"><span>0% (tidak ikut)</span><span>100%</span></span>
      </label>
      <p v-if="!c.N" class="small muted span">Jumlah saham baru belum diumumkan: dihitung dari nilai yang perlu dibiayai ÷ harga pelaksanaan.</p>
    </div>
    <template v-if="r">
      <!-- Harga saham potensi agar dana tunai rights issue tercapai. -->
      <div v-if="need" class="fund-ok need" :class="NEED[need.status][1]">
        <div class="fh">
          <span class="small muted">Harga saham agar dana {{ big(need.cash) }} tercapai</span>
          <b>{{ NEED[need.status][0] }}</b>
        </div>
        <p class="small">Publik hanya akan menebus bila harga pasar berada di atas harga pelaksanaan. Pada harga pelaksanaan <b>{{ rp(P) }}</b>, harga saham yang dibutuhkan:</p>
        <div class="nd">
          <div v-for="x in need.need" :key="x.d" class="ndc" :class="{ ref: x.d === 0.2 }">
            <span class="small muted">diskon {{ Math.round(x.d * 100) }}%</span>
            <b>{{ rp(Math.ceil(x.price)) }}</b>
            <span v-if="need.now" class="small" :class="need.now >= x.price ? 'c-good' : 'c-strong'">{{ need.now >= x.price ? 'sudah tercapai' : 'perlu naik ' + fmt((x.price / need.now - 1) * 100, 0) + '%' }}</span>
          </div>
          <div class="ndc">
            <span class="small muted">harga kini</span>
            <b>{{ rp(need.now) }}</b>
            <span class="small muted">{{ need.now ? (need.now > P ? 'di atas' : 'di bawah') + ' harga pelaksanaan' : '' }}</span>
          </div>
        </div>
        <p class="small">
          Patokan wajar (diskon 20%): harga saham minimal <b>{{ rp(Math.ceil(need.ref)) }}</b><template v-if="need.gap != null">; <template v-if="need.gap > 0">harga kini perlu naik {{ fmt(need.gap * 100, 0) }}%</template><template v-else>harga kini sudah {{ fmt(-need.gap * 100, 0) }}% di atasnya</template></template>.
          <template v-if="c.Nmax"> Agar seluruh setoran {{ big(c.V + c.cash) }} muat dalam maksimum {{ sh(c.Nmax) }} saham, harga pelaksanaan minimal <b>{{ rp(Math.ceil(need.pMin)) }}</b>, sehingga harga saham perlu ±{{ rp(Math.ceil(need.minNeed)) }}.</template>
        </p>
        <p v-if="need.short" class="small c-strong">Pada {{ rp(P) }}, saham maksimum hanya menghasilkan {{ big(need.short.maxDana) }}; kurang {{ big(need.short.kurang) }}.</p>
      </div>
      <!-- Dasar perhitungan harga pelaksanaan: rumus, asumsi, skenario A (seluruh nilai) dan B (tunai saja). -->
      <div v-if="ex" class="dasar">
        <h3 class="lbl">Dasar perhitungan harga pelaksanaan</h3>
        <p class="small">Harga pelaksanaan dihitung dengan membagi target dana dengan jumlah saham baru yang diterbitkan:</p>
        <p class="rumus"><b>Harga pelaksanaan = Target dana ÷ (Rasio HMETD × Saham beredar)</b></p>
        <ul class="small">
          <li><b>Saham beredar</b> {{ sh(ex.S0) }} lembar.</li>
          <li><b>Target dana</b> {{ big(ex.total) }}<template v-if="ex.aset"> = aset/inbreng {{ big(ex.aset) }} + tunai {{ big(ex.tunai) }}</template><template v-if="ex.kurs"> (kurs dokumen {{ rp(ex.kurs.nilai) }}/{{ ex.kurs.mataUang || 'USD' }})</template>.</li>
          <li><b>Rasio HMETD</b> 1 saham lama : <input v-model.number="R" type="number" min="0.01" step="0.25" class="pin rin" aria-label="Rasio saham baru per saham lama"> saham baru<template v-if="c.doc?.rasio"> (dokumen: {{ c.doc.rasio }})</template><template v-else> — rasio final belum diumumkan</template>.</li>
        </ul>
        <div class="scroll">
          <table class="ledger st">
            <thead><tr><th>Skenario dana</th><th class="num">Target dana</th><th class="num">Saham baru</th><th class="num">Harga pelaksanaan</th><th class="num">Dibulatkan ke atas</th><th class="num">Harga saham dibutuhkan (diskon 20%)</th></tr></thead>
            <tbody>
              <tr :class="{ hl: ex.consistent === 'A' }">
                <td>A. Seluruh nilai penerbitan<span v-if="ex.consistent === 'A'" class="small muted"> · sesuai struktur dokumen</span></td>
                <td class="num">{{ big(ex.A.target) }}</td><td class="num">{{ sh(ex.N) }}</td><td class="num">{{ rp2(ex.A.P) }}</td>
                <td class="num"><b>{{ rp(ex.A.up) }}</b><span v-if="ex.A.belowNominal" class="small c-strong"> &lt; nominal</span></td>
                <td class="num">{{ rp(Math.ceil(ex.A.need)) }}<template v-if="ex.A.naik != null"> ({{ ex.A.naik > 0 ? '+' + fmt(ex.A.naik * 100, 0) + '%' : 'tercapai' }})</template></td>
              </tr>
              <tr v-if="ex.B" :class="{ hl: ex.consistent === 'B' }">
                <td>B. Porsi tunai saja<span v-if="ex.consistent === 'B'" class="small muted"> · sesuai struktur dokumen</span></td>
                <td class="num">{{ big(ex.B.target) }}</td><td class="num">{{ sh(ex.N) }}</td><td class="num">{{ rp2(ex.B.P) }}</td>
                <td class="num"><b>{{ rp(ex.B.up) }}</b><span v-if="ex.B.belowNominal" class="small c-strong"> &lt; nominal</span></td>
                <td class="num">{{ rp(Math.ceil(ex.B.need)) }}<template v-if="ex.B.naik != null"> ({{ ex.B.naik > 0 ? '+' + fmt(ex.B.naik * 100, 0) + '%' : 'tercapai' }})</template></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="small">Pembulatan ke atas agar dana tetap tercapai: {{ rp(ex.A.up) }} × {{ sh(ex.N) }} = {{ big(ex.A.check) }}.</p>
        <p v-if="ex.B" class="small">
          <template v-if="ex.consistent === 'A'"><b>Catatan:</b> skenario B hanya berlaku bila aset dibayar dengan saham terpisah. Menurut dokumen, inbreng juga dilakukan melalui HMETD yang sama, sehingga seluruh saham baru terbit pada satu harga; harga yang konsisten adalah skenario A. Pada harga B ({{ rp(ex.B.up) }}), penerbitan {{ sh(ex.N) }} saham hanya menghasilkan {{ big(ex.B.check) }} dan tidak cukup membayar aset {{ big(ex.aset) }}.</template>
          <template v-else><b>Catatan:</b> aset dibayar dengan penerbitan terpisah, sehingga harga HMETD dihitung dari porsi tunai (skenario B).</template>
        </p>
      </div>
      <!-- Skenario: rasio, harga RI, dana, harga saham yang dibutuhkan, dibanding saham beredar. -->
      <div v-if="scen" class="scen">
        <h3 class="lbl">Simulasi harga RI, kebutuhan dana, dan harga saham</h3>
        <p class="small">
          Setoran yang harus ditutup penerbitan: <b>{{ big(scen.total) }}</b><template v-if="scen.aset"> ({{ big(scen.aset) }} aset/inbreng + {{ big(scen.tunai) }} tunai)</template>.
          Saham beredar {{ sh(scen.S0) }}, harga kini {{ rp(scen.now) }}. Rumusnya: <b>harga RI = setoran ÷ jumlah saham baru</b>; makin sedikit saham baru, makin tinggi harga RI dan makin tinggi harga saham yang harus dicapai agar publik mau menebus.
        </p>
        <div class="scroll">
          <table class="ledger st">
            <thead><tr>
              <th>Rasio (lama : baru)</th><th class="num">Saham baru</th><th class="num">× saham beredar</th><th class="num">Harga RI</th>
              <th class="num">Harga saham dibutuhkan<br><span class="muted">(diskon 20%)</span></th><th class="num">Kenaikan dari harga kini</th>
              <th class="num">Harga teoretis setelah RI</th><th class="num">Dilusi bila tidak menebus</th>
            </tr></thead>
            <tbody>
              <tr v-for="x in scen.rows" :key="x.N + x.tag" :class="{ hl: x.tag, bad: x.bawahNominal || x.lewatMaks }">
                <td>{{ ratioTxt(x.ratio) }}<span v-if="x.tag" class="small muted"> · {{ x.tag }}</span></td>
                <td class="num">{{ sh(x.N) }}</td>
                <td class="num">{{ fmt(x.ratio, x.ratio >= 10 ? 0 : 2) }}×</td>
                <td class="num"><b>{{ rp(Math.round(x.P)) }}</b><span v-if="x.bawahNominal" class="small c-strong"> &lt; nominal</span></td>
                <td class="num">{{ rp(Math.ceil(x.need)) }}</td>
                <td class="num" :class="x.naik > 0 ? 'c-strong' : 'c-good'">{{ x.naik == null ? '–' : x.naik > 0 ? '+' + fmt(x.naik * 100, 0) + '%' : 'sudah tercapai' }}</td>
                <td class="num">{{ rp(Math.round(x.terp)) }}</td>
                <td class="num">{{ fmt(x.dilusi * 100, 1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="small notes">
          <li>Harga yang "diangkat" sebelum RI tidak bertahan: setelah cum date harga cenderung turun ke <b>harga teoretis</b>. Bila saham baru jauh lebih banyak dari saham beredar, harga teoretis hampir sama dengan harga RI.</li>
          <li>Hanya porsi tunai ({{ big(scen.tunai) }}) yang membutuhkan uang pemegang saham; porsi aset dibayar dengan saham kepada pemilik aset, tetapi tetap mendilusi.</li>
          <li v-if="scen.nom">Harga RI tidak boleh di bawah nilai nominal {{ rp(scen.nom) }}; baris bertanda "&lt; nominal" tidak dapat dilaksanakan.</li>
          <template v-if="extra">
            <li v-if="extra.hak != null">Nilai HMETD per lembar pada harga RI {{ rp(P) }} = harga teoretis − harga RI = <b>{{ rp(Math.round(extra.hak)) }}</b><template v-if="extra.hak < 1"> (hampir tidak bernilai: insentif menebus sangat kecil)</template>.</li>
            <li v-if="extra.ctrlCash != null && extra.tunai > 0">Porsi wajib pengendali ({{ fmt(extra.ctrlPct, 2) }}%) atas dana tunai: <b>{{ big(extra.ctrlCash) }}</b>; sisanya {{ big(extra.tunai - extra.ctrlCash) }} bergantung pada publik atau pembeli siaga.</li>
            <li v-if="extra.days != null && extra.tunai > 0">Dana tunai {{ big(extra.tunai) }} setara <b>{{ fmt(extra.days, extra.days < 10 ? 1 : 0) }} hari</b> nilai transaksi rata-rata ({{ big(extra.avgVal) }}/hari): makin besar, makin berat pasar menyerapnya.</li>
            <li v-if="extra.uses.length">Ke mana dana dipakai (dokumen): {{ extra.uses.map(u => u.pos + (u.nilaiRp ? ' ' + big(u.nilaiRp) : u.persen ? ' ' + fmt(u.persen, 0) + '%' : '')).join('; ') }}. Waspadai bila dana kembali ke pengendali atau afiliasinya.</li>
          </template>
        </ul>
      </div>
      <RiValuasi part="valuasi" :c="c" :r="r" :P="+P" :laba-setahun="ls ? ls.after.laba : null" />
    </template>
    <p v-else class="small muted">Jumlah saham baru atau nilai dana belum diketahui dari keterbukaan; perhitungan menunggu prospektus.</p>

    <h3 class="sec">6. Dampak bagi investor</h3>
    <template v-if="r">
      <div class="grid">
        <div class="box">
          <h3 class="lbl">Untuk investor (per 1 lot = 100 saham)</h3>
          <table class="ledger">
            <tbody>
              <tr v-if="!nr"><td>HMETD diterima</td><td class="r num">{{ fmt(r.perLot.hak, 1) }} hak <span class="small muted">(rasio {{ fmt(r.ratio, 2) }}:1)</span></td></tr>
              <tr v-if="!nr"><td>Dana untuk menebus semua hak</td><td class="r num">{{ rp(r.perLot.dana) }}</td></tr>
              <tr v-if="r.terp != null"><td>Harga teoretis setelah penerbitan (TERP)</td><td class="r num"><b>{{ rp(r.terp) }}</b> <span class="small muted">{{ r.terp >= c.price ? '+' : '' }}{{ pct(r.terp / c.price - 1, 0) }}</span></td></tr>
              <tr v-if="!nr && r.hak != null"><td>Nilai teoretis 1 HMETD</td><td class="r num">{{ r.hak > 0 ? rp(r.hak) : 'Rp0 (harga tebus ≥ TERP)' }}</td></tr>
              <tr><td>Porsi kepemilikan bila tidak ikut</td><td class="r num">turun {{ pct(r.dilusi) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="steps">
        <div class="st"><span class="small muted">Publik sekarang</span><b>{{ fmt(c.float || 0, 2) }}%</b></div>
        <span class="arr" aria-hidden="true">→</span>
        <div class="st"><span class="small muted">Setelah penerbitan{{ nr ? '' : ` (publik menebus ${U}%)` }}</span><b :class="{ warn: r.pubAfter < 0.075 }">{{ pct(r.pubAfter, 2) }}</b></div>
        <template v-if="r.pubAfterInj != null">
          <span class="arr" aria-hidden="true">→</span>
          <div class="st"><span class="small muted">Setelah injeksi aset tahap lanjutan</span><b :class="{ warn: r.pubAfterInj < 0.075 }">{{ pct(r.pubAfterInj, 2) }}</b></div>
        </template>
      </div>
    </template>

    <h3 class="sec">7. Kesimpulan investasi</h3>
    <template v-if="r">
      <!-- Rekomendasi bergaya manajer investasi: rating + sikap atas partisipasi rights issue. -->
      <div v-if="rating" class="fund-ok rating" :class="rating.tone">
        <div class="fh">
          <span class="small muted">Rekomendasi</span>
          <b>{{ rating.rating }}</b>
        </div>
        <p class="small">{{ rating.sub }}</p>
        <!-- Angka kunci rekomendasi: harga, harga teoretis, potensi turun, batas rugi, batas waktu keluar. -->
        <dl v-if="rating.angka.length" class="lv small">
          <template v-for="x in rating.angka" :key="x.k"><dt>{{ x.k }}</dt><dd :class="{ bad: x.bad }">{{ x.v }}</dd></template>
        </dl>
        <p v-if="rating.asumsi" class="small muted">{{ rating.asumsi }}</p>
        <template v-if="rating.risiko.length">
          <p class="small"><b>Risiko kunci:</b></p>
          <ul class="small risk"><li v-for="x in rating.risiko" :key="x">{{ x }}</li></ul>
        </template>
        <p class="small"><b>{{ rating.partTxt }}</b></p>
      </div>
      <!-- Skenario kedua: trading jangka pendek memanfaatkan aksi korporasi. -->
      <div v-if="trade" class="fund-ok" :class="trade.tone">
        <div class="fh">
          <span class="small muted">Strategi trading jangka pendek</span>
          <b>{{ trade.label }}</b>
        </div>
        <ul class="why">
          <li v-for="(x, i) in trade.reasons" :key="i" :class="x.s > 0 ? 'p' : x.s < 0 ? 'n' : 'z'">
            <span class="ic" aria-hidden="true">{{ x.s > 0 ? '+' : x.s < 0 ? '−' : '·' }}</span>{{ x.t }}
          </li>
        </ul>
        <template v-if="trade.aturan.length">
          <p class="small"><b>Strategi eksekusi:</b></p>
          <ol class="small aturan"><li v-for="x in trade.aturan" :key="x">{{ x }}</li></ol>
        </template>
        <p class="small muted">Aksi korporasi sering mendorong harga menjelang katalis; peluang terbesarnya ada pada momentum sebelum cum date.</p>
      </div>
      <!-- Kesimpulan akhir: layak investasi atau tidak. -->
      <div v-if="layak" class="fund-ok" :class="layak.tone">
        <div class="fh">
          <span class="small muted">Partisipasi rights issue (menebus / menahan melewati cum date)</span>
          <b>{{ layak.label }}</b>
        </div>
        <p class="small"><b>{{ layak.key === 'layak' ? 'Faktor pendukung:' : 'Faktor risiko:' }}</b></p>
        <ol class="why abc">
          <li v-for="(x, i) in layakWhy.utama" :key="i" :class="x.s > 0 ? 'p' : x.s < 0 ? 'n' : 'z'">
            <span class="ic" aria-hidden="true">{{ 'ABCDEFGHIJ'[i] }}.</span>{{ x.t }}
          </li>
        </ol>
        <template v-if="layakWhy.lawan.length">
          <p class="small"><b>{{ layak.key === 'layak' ? 'Faktor risiko' : 'Faktor pendukung' }}:</b></p>
          <ul class="why">
            <li v-for="(x, i) in layakWhy.lawan" :key="i" :class="x.s > 0 ? 'p' : 'n'"><span class="ic" aria-hidden="true">{{ x.s > 0 ? '+' : '−' }}</span>{{ x.t }}</li>
          </ul>
        </template>
        <p class="small muted">Skor {{ layak.score }} (≥ 2 layak dipertimbangkan; −1 s.d. 1 spekulatif; ≤ −2 tidak layak). Menilai skenario membeli lalu <b>menahan melewati rights issue atau ikut menebus</b>. Kerangka analisis otomatis dari dokumen dan simulasi, bukan anjuran membeli atau menjual efek.</p>
      </div>
      <p v-if="verdict" class="verdict"><b>Kesimpulan:</b> {{ verdict }}</p>
      <p class="small muted">Catatan: <b>skor enam dimensi</b> di atas menilai profil saham backdoor secara umum, <b>sikap analis</b> adalah penilaian manual, dan <b>kesimpulan investasi</b> ini khusus menilai transaksi penambahan modal dan asetnya. Bila berbeda, kesimpulan ini yang menentukan kelayakan ikut serta dalam rights issue.</p>
    </template>
    <template v-if="r">
      <!-- Pengumpulan dana: tercapai atau tidak, berdasarkan keterbukaan terakhir. -->
      <div v-if="fund" class="fund-ok" :class="fund.tone">
        <div class="fh">
          <span class="small muted">Pengumpulan dana</span>
          <b>{{ fund.label }}</b>
        </div>
        <p class="small last">
          <template v-if="fund.last">Keterbukaan terakhir: <b>{{ fmtDate(fund.last.date) }}</b> · {{ fund.last.title }}</template>
          <template v-else>Belum ada keterbukaan resmi tentang penambahan modal; penilaian memakai data kurasi.</template>
        </p>
        <ul class="why">
          <li v-for="(x, i) in fund.reasons" :key="i" :class="x.s > 0 ? 'p' : x.s < 0 ? 'n' : 'z'">
            <span class="ic" aria-hidden="true">{{ x.s > 0 ? '+' : x.s < 0 ? '−' : '·' }}</span>{{ x.t }}
          </li>
        </ul>
        <p v-if="fund.key !== 'done'" class="small muted">Penilaian mengikuti simulasi harga {{ rp(P) }}<template v-if="!nr"> dan publik menebus {{ U }}%</template>; berubah bila slider digeser.</p>
      </div>
    </template>

    <h3 class="sec">8. Sumber dokumen</h3>
    <RiDokumen v-if="c.doc" :doc="c.doc" part="sumber" />
    <details v-if="c.notes.length" class="small muted src"><summary>Dasar angka</summary><p v-for="n in c.notes" :key="n">{{ n }}</p></details>

    <div v-if="ticker" class="dl">
      <h3 class="lbl">Unduh analisa {{ c.label }}</h3>
      <p class="small muted">Khusus analisa ini, urutannya sama dengan bagian di atas: angka kunci, struktur rencana korporasi, pengendali, aset & laba,
        penerbitan & dana, simulasi (harga potensi, tabel rasio, valuasi), dampak investor, lalu kelayakan dan kesimpulan. Memakai simulasi saat ini: harga {{ rp(P) }}<template v-if="!nr">, publik menebus {{ U }}%</template>.</p>
      <DeckDownload :sector-id="sector.id" :build="build" label="analisa" />
    </div>
  </section>
</template>

<style scoped>
.lv{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin:8px 0}
.lv dt{color:var(--muted)} .lv dd{margin:0;font-weight:700} .lv dd.bad{color:var(--strong)}
.risk{margin:4px 0 8px;padding-left:18px}
.sec{margin:22px 0 8px;padding-top:10px;border-top:2px solid var(--rule);font:700 15px var(--f-display)}
.hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.hd h2{margin:0}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:12px}
.k{background:var(--sheet);border:1px solid var(--rule);padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.k b{font-size:22px;line-height:1.2}
.k .lbl{margin:0}
.sim{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 20px;background:var(--sheet);border:1px solid var(--rule);padding:12px;margin-bottom:12px}
.sim .span{grid-column:1/-1;margin:0}
.sl{display:flex;flex-direction:column;gap:4px}
.sl input{width:100%;accent-color:var(--now-ink)}
.ends{display:flex;justify-content:space-between}
.fund{margin-bottom:12px}
.fund .row{display:grid;grid-template-columns:150px 1fr 110px;gap:10px;align-items:center;margin-bottom:6px}
.fund .row b{text-align:right}
.track{height:12px;background:var(--rule-2);border-radius:6px;overflow:hidden;display:flex}
.track i{display:block;height:100%}
.inj,.sw.inj{background:var(--ink);opacity:.55}
.as,.sw.as{background:var(--warn, #c98a1b)}
.tu,.sw.tu{background:var(--good)}
.legend .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 8px;vertical-align:middle}
.legend .sw:first-child{margin-left:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:12px}
.box .lbl{margin:0 0 6px}
.steps{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.st{background:var(--sheet);border:1px solid var(--rule);padding:8px 12px;display:flex;flex-direction:column;min-width:140px}
.st b{font-size:20px}
.st b.warn{color:var(--strong, #c0392b)}
.arr{align-self:center;opacity:.5}
.verdict{margin:6px 0}
.dasar{margin:12px 0}
.rumus{margin:6px 0;padding:8px 12px;background:var(--sheet-2);border-left:3px solid var(--ink-2)}
.rin{width:80px;margin:0 4px}
.scen{margin:12px 0}
.st th,.st td{white-space:nowrap}
.st .num{text-align:right}
.st tr.hl td{background:var(--sheet-2);font-weight:600}
.st tr.bad td{opacity:.6}
.notes{margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:3px;max-width:100ch}
.pin{width:110px;margin-left:8px;font:600 13px var(--f-display)}
.aturan{margin:2px 0 6px;padding-left:20px}
.nd{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin:6px 0}
.ndc{display:flex;flex-direction:column;padding:6px 8px;border:1px solid var(--rule-2);background:var(--paper, transparent)}
.ndc.ref{border-color:var(--ink-2)}
.ndc b{font:700 17px var(--f-display)}
.c-good{color:var(--good)} .c-strong{color:var(--strong)}
.fund-ok{border:1px solid var(--rule);border-left:4px solid var(--rule-2);background:var(--sheet);padding:10px 12px;margin:8px 0}
.fund-ok.good{border-left-color:var(--good)}
.fund-ok.warn{border-left-color:var(--warn, #c98a1b)}
.fund-ok.strong{border-left-color:var(--strong, #c0392b)}
.fh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.fh b{font-size:18px}
.fund-ok.good .fh b{color:var(--good)}
.fund-ok.warn .fh b{color:var(--warn, #c98a1b)}
.fund-ok.strong .fh b{color:var(--strong, #c0392b)}
.fund-ok .last{margin:4px 0 6px}
.why{list-style:none;margin:0 0 6px;padding:0;display:grid;gap:3px}
.why li{display:grid;grid-template-columns:18px 1fr;font-size:13px}
.why .ic{font-weight:700;text-align:center}
.why li.p .ic{color:var(--good)}
.why li.n .ic{color:var(--strong, #c0392b)}
.why li.z .ic{opacity:.5}
.dl{margin-top:14px;background:var(--sheet);border:1px solid var(--rule);padding:14px}
.dl .lbl{margin:0 0 4px}
.dl > p{margin:0 0 10px}
.aset{margin-bottom:12px}
.aset .lbl{margin:0 0 6px}
.ag{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.ac{background:var(--sheet);border:1px solid var(--rule);padding:10px 12px;display:flex;flex-direction:column;gap:3px}
.ac.val b{font-size:20px}
.ac .nm{font-size:14px}
.ac b.ok{color:var(--good)}
.ac b.wait{color:var(--warn, #c98a1b)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 12px;margin:8px 0 0}
.facts div{display:flex;flex-direction:column}
.facts dd{margin:0}
.gaps{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-top:8px}
.tahap{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-bottom:12px}
.tc{flex:1 1 240px;background:var(--sheet);border:1px solid var(--rule);padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.tc b{font-size:20px}
.tc .lbl{margin:0}
.src p{margin:4px 0}
@media (max-width:760px){ .fund .row{grid-template-columns:1fr 90px}.fund .row .track{grid-column:1/-1;grid-row:2} }
</style>
