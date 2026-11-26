<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { api } from '../../api.js'
import { store, itemOf } from '../../store.js'
import { big, fmt, fmtDate, num, pctTxt, progressOf, rp, x2 } from '../../lib/domain.js'
import { MECH_LABEL, dilusi, flowOf, injSteps, kjppStatus, mechOf, peerMultiples, reservesOf, simDefaults, simKjpp, toM, txValue } from '../../lib/emitenExtra.js'
import { KURS } from '../../lib/analysis.js'
import { faktaAset, laporanMaterial } from '../../lib/pembaruan.js'

// Tab Aset: seluruh analisa aset yang akan/sudah diinjeksi. Sumber: riset aset (aset-riset.json: jurnal, media, situs
// perusahaan, regulator, aset lain milik pengendali), aset-verified.json (transaksi, KJPP, mekanisme), dan
// relasi-verified.json → <T>.injeksi bila ada. Simulasi nilai KJPP dihitung otomatis tanpa isian manual.
const props = defineProps({ ticker: { type: String, required: true } })
const rs = computed(() => store.riset?.[props.ticker] || null)
const src = i => rs.value?.sumber?.[i]
const JENIS = { jurnal: 'jurnal', media: 'media', dokumen: 'dokumen', 'situs perusahaan': 'perusahaan', regulator: 'regulator' }
const TB_R = [['komoditas', 'Komoditas'], ['lokasi', 'Lokasi'], ['izin', 'Izin'], ['luas', 'Luas'], ['cadangan', 'Cadangan'], ['sumberDaya', 'Sumber daya'],
  ['standar', 'Standar pelaporan'], ['kualitas', 'Kualitas'], ['produksi', 'Produksi'], ['umur', 'Umur tambang'], ['stripRatio', 'Stripping ratio'], ['infrastruktur', 'Infrastruktur']]

const a = computed(() => store.aset[props.ticker] || null)
const r = computed(() => store.relasi[props.ticker]?.injeksi || null)
const sv = computed(() => store.verified[props.ticker] || null)
const item = computed(() => itemOf(props.ticker))
const pa = computed(() => store.pandangan[props.ticker] || null)
const af = computed(() => store.profil[props.ticker]?.afiliasi || null)

const ast = computed(() => a.value?.aset || {})
const fin = computed(() => ast.value.keuangan || {})
const k = computed(() => a.value?.kjpp || {})
const ks = computed(() => kjppStatus(a.value?.kjpp))
const mcapRp = computed(() => num(item.value?.mcap) != null ? num(item.value.mcap) * 1e9 : null)
const val = computed(() => txValue(a.value, sv.value))
const title = computed(() => r.value?.judul || ast.value.nama || sv.value?.injectTarget || 'Data aset belum ada')
const sub = computed(() => r.value?.sub || [ast.value.jenis, ast.value.sektor, ast.value.lokasi].filter(Boolean).join(' · '))

const FIN = [['pendapatan', 'Pendapatan'], ['ebitda', 'EBITDA'], ['labaBersih', 'Laba bersih'], ['totalAset', 'Total aset'], ['ekuitas', 'Ekuitas'], ['utang', 'Utang']]
const hasFin = computed(() => FIN.some(([f]) => fin.value[f] != null))
const TB = [['cadangan', 'Cadangan'], ['sumberDaya', 'Sumber daya'], ['kalori', 'Kalori'], ['produksi', 'Produksi'], ['iup', 'Izin']]

// Bagan mekanisme transaksi.
const kc = computed(() => pa.value?.kalkulator || {})
const executed = computed(() => !!(kc.value.sudahTereksekusi || sv.value?.executed))
const mech = computed(() => mechOf(a.value, sv.value))
const pubText = computed(() => {
  const dl = pa.value?.dilusi || {}, f = num(item.value?.float)
  if (executed.value) return f != null ? `porsi publik kini ${fmt(f, 1)}%` : ''
  return dl.berlaku && dl.porsiPublikSetelah != null ? `porsi publik ${fmt(dl.porsiPublikSekarang ?? f ?? 0, 1)}% → ${fmt(dl.porsiPublikSetelah, 1)}%` : ''
})
const flow = computed(() => (a.value || sv.value?.injectType) ? flowOf({
  t: props.ticker, mech: mech.value, aset: a.value, sv: sv.value, ctrlName: item.value?.ctrlName || item.value?.acquirer,
  owner: String(af.value?.pemilikAset || '').slice(0, 34), hargaPelaksanaan: kc.value.hargaPelaksanaan, pubText: pubText.value,
}) : null)
// Tahapan dari progressOf (memasukkan KJPP terbit di aset-verified dan injeksi tereksekusi), bukan item.ms mentah.
const steps = computed(() => injSteps(mech.value, { sv: sv.value, ms: progressOf(item.value || { ticker: props.ticker }, { aset: store.aset, verified: store.verified }).ms }))
const flowLabel = computed(() => flow.value ? [...flow.value.boxes.map(b => `${b.t1} (${b.t2})`), ...flow.value.arrows.map(x => x.lines.join(' '))].join('; ') : '')

// Simulasi nilai KJPP otomatis (tanpa isian manual): data aset (aset-verified), kelipatan median pembanding Stockbit,
// dan acuan USD/ton cadangan untuk tambang. Satuan Rp miliar.
const si = reactive({ tx: null, porsi: 100, laba: null, pend: null, eq: null, res: null, usdTon: null, per: null, ps: null, pbv: null })
const sd = computed(() => simDefaults(a.value, sv.value))
Object.assign(si, Object.fromEntries(Object.entries(sd.value).filter(([key]) => key in si)))
const res = computed(() => reservesOf(ast.value.tambang))
const mining = computed(() => res.value || /tambang|batu bara|nikel/i.test(ast.value.sektor || ''))
const sim = computed(() => simKjpp(si))
const peers = computed(() => (a.value?.pembanding || []).filter(t => /^[A-Z]{4}$/.test(t)).slice(0, 5))
const peerNote = ref('')
const peerUsed = ref([])
const prof = ref(null)
const SIM_IN = computed(() => [
  ['tx', 'Nilai transaksi diumumkan (Rp miliar)', 'nilai yang dibayar/diinbrengkan'],
  ['porsi', 'Porsi diambil (%)', 'bagian aset yang masuk'],
  ['laba', 'Laba bersih aset 100% (Rp miliar/tahun)', perHint.value],
  ['pend', 'Pendapatan aset 100% (Rp miliar/tahun)', perHint.value],
  ['eq', 'Ekuitas aset 100% (Rp miliar)', 'nilai buku'],
  ...(mining.value ? [['res', 'Cadangan aset 100% (juta ton)', res.value ? [res.value.kind, String(ast.value.tambang?.kalori || '').slice(0, 40)].filter(Boolean).join(' · ') : 'belum diungkap'],
    ['usdTon', 'Nilai per ton cadangan (USD/ton)', sd.value.usdTonNote || 'tidak ada acuan untuk komoditas ini']] : []),
  ['per', 'PER pembanding (×)', peerNote.value],
  ['ps', 'P/S pembanding (×)', peerNote.value],
  ['pbv', 'PBV pembanding (×)', peerNote.value],
])
const perHint = computed(() => fin.value.periode ? `${fin.value.periode}${sd.value.af !== 1 ? ` · disetahunkan ×${fmt(sd.value.af, 2)}` : ''}` : 'belum diungkap')
// Tampilan nilai yang dipakai (hanya baca).
const showVal = (key, v) => v == null || v === '' ? 'belum ada' : key === 'porsi' ? fmt(v, 1) + '%' : ['per', 'ps', 'pbv'].includes(key) ? fmt(v, 2) + '×'
  : key === 'res' ? fmt(v, 1) + ' juta ton' : key === 'usdTon' ? 'USD' + fmt(v, 2) : 'Rp' + fmt(v, 1) + ' M'

// Dampak ke saham emiten (otomatis): nilai dibayar dengan saham = nilai transaksi (atau nilai tengah simulasi bila
// transaksi belum diumumkan), kas dari kalkulator analis, harga pelaksanaan = harga analis/PTW/harga pasar, publik tidak menebus.
const dl = computed(() => ({ V: toM(kc.value.nilaiDibayarSaham ?? val.value ?? sim.value.mid) ?? 0, C: toM(kc.value.kasSegar) ?? 0,
  P: kc.value.hargaPelaksanaan || item.value?.tender?.price || num(item.value?.price) || 0, T: 0 }))
const dlSrc = computed(() => ({ V: kc.value.nilaiDibayarSaham != null ? 'kalkulator analis' : val.value ? 'nilai transaksi diumumkan' : sim.value.mid != null ? 'nilai tengah simulasi' : 'belum ada',
  C: kc.value.kasSegar != null ? 'kalkulator analis' : 'tidak ada setoran tunai', P: kc.value.hargaPelaksanaan ? 'kalkulator analis' : item.value?.tender?.price ? 'harga PTW' : 'harga pasar terakhir', T: 'skenario terburuk bagi publik' }))
const base = computed(() => {
  // Stockbit dulu, lalu data radar, lalu angka di pandangan analis.
  const st = prof.value?.stats || {}, pd = pa.value?.dilusi || {}, price = num(item.value?.price) ?? pa.value?.hargaAcuan ?? null
  const S0 = st.shares ?? pd.sahamSekarang ?? (mcapRp.value && price ? mcapRp.value / price : null)
  return { S0, E0: prof.value?.metrics?.equity ?? 0, f: (st.freeFloat ?? num(item.value?.float) ?? pd.porsiPublikSekarang ?? 0) / 100, price }
})
const out = computed(() => {
  const b = base.value, V = (+dl.value.V || 0) * 1e9, C = (+dl.value.C || 0) * 1e9
  const d = dilusi({ S0: b.S0, E0: b.E0, f: b.f, V, C, P: +dl.value.P, tk: (+dl.value.T || 0) / 100, h: 1 })
  if (!d) return null
  // Nilai buku per saham bila aset bernilai sebesar nilai tengah simulasi (bukan nilai transaksi).
  const vpsSim = sim.value.mid != null ? ((b.E0 || 0) + sim.value.mid + C) / d.S1 : null
  return { ...d, vpsSim }
})
const DL_IN = [['V', 'Nilai dibayar dengan saham baru'], ['C', 'Kas segar masuk'], ['P', 'Harga pelaksanaan'], ['T', 'Publik menebus']]
const dlShow = (key, v) => key === 'P' ? rp(v) : key === 'T' ? fmt(v) + '%' : 'Rp' + fmt(v, 1) + ' M'

onMounted(async () => {
  peerNote.value = peers.value.length ? 'memuat pembanding…' : 'pembanding belum ditentukan'
  const [own, ...ps] = await Promise.all([props.ticker, ...peers.value].map(t => api.get('/api/profile', { ticker: t }).catch(() => null)))
  prof.value = own
  if (!peers.value.length) return
  const m = peerMultiples(ps)
  peerUsed.value = ps.filter(Boolean).map(p => p.ticker).filter(Boolean)
  for (const key of ['per', 'ps', 'pbv']) if (m[key] != null && si[key] == null) si[key] = Math.round(m[key] * 100) / 100
  peerNote.value = m.n ? `median ${m.n} pembanding Stockbit` : 'data pembanding kosong'
})
// Fakta aset dari laporan terakhir (semua emiten): poin kunci laporan Stockbit yang disinkronkan server tiap 2 jam
// (store.updates); bila belum ada di store, diambil langsung dari Stockbit. Lihat lib/pembaruan.js.
const fakta = ref([])
watch(() => [props.ticker, store.updates.length], async ([t]) => {
  const asOf = rs.value?.asOf || ''
  let reps = laporanMaterial(store.updates, t)
  if (!reps.length) {
    try { reps = (await api.get('/api/reports', { ticker: t })).items || [] } catch { reps = [] }
  }
  fakta.value = faktaAset(reps, { asOf })
}, { immediate: true })

// Unduh riset aset (PDF, format riset IHSG): fakta laporan diambil segar dari Stockbit saat tombol ditekan.
const busyPdf = ref(false), errPdf = ref('')
async function unduhPdf() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, { asetPdf, asetPdfName }] = await Promise.all([import('jspdf'), import('../../lib/asetPdf.js')])
    let fk = fakta.value
    try { const r = await api.get('/api/reports', { ticker: props.ticker, fresh: 1 }); if (r.items?.length) fk = faktaAset(r.items, { asOf: rs.value?.asOf || '' }) } catch { /* pakai fakta yang tampil */ }
    const o = out.value
    const dampak = executed.value ? [['Status', 'Penerbitan saham baru sudah tereksekusi; jumlah saham dan porsi publik kini sudah memuat dilusinya.']]
      : o ? [['Saham baru', `${fmt(o.N / 1e6)} jt (${x2(o.N / o.S0)} saham sekarang)`], ['Porsi publik', `${fmt(o.f * 100, 2)}% menjadi ${fmt(o.pubAfter * 100, 2)}% bila publik tidak menebus`],
        ['Nilai buku per saham', `${rp(o.vps)} (aset diakui sebesar nilai dibayar)`], ...(o.vpsSim != null ? [['Nilai buku per saham (simulasi)', `${rp(o.vpsSim)} (aset sebesar nilai tengah simulasi)`]] : [])] : null
    const doc = await asetPdf({ t: props.ticker, riset: rs.value, aset: a.value, fakta: fk, ks: ks.value, sim: sim.value, nilai: val.value, mcap: mcapRp.value, dampak }, jsPDF)
    doc.save(asetPdfName(props.ticker))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}

const sources = computed(() => [...(rs.value?.sumber || []).map(x => ({ t: x.t, url: x.url, ket: JENIS[x.jenis] || x.jenis })),
  ...(a.value?.sumber || []).map(t => ({ t })), ...(r.value?.sumber || [])])
</script>

<template>
  <div class="tab-aset">
    <header class="hd rule-top">
      <div class="unduh">
        <button type="button" class="btn" :disabled="busyPdf || (!a && !rs)" @click="unduhPdf">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh riset aset (PDF)' }}</button>
        <span v-if="errPdf" class="small muted">{{ errPdf }}</span>
      </div>
      <div class="lbl">Aset yang diinjeksi ke {{ ticker }}</div>
      <h2 id="injTitle" class="t">{{ title }}</h2>
      <div v-if="sub" class="small muted">{{ sub }}</div>
      <div v-if="a" class="tags"><span class="tag" :class="'t-' + ks.tone">{{ ks.label }}</span><span v-if="ast.porsi" class="tag t-calm">porsi {{ ast.porsi.split(/[(;]/)[0].trim() }}</span></div>
    </header>

    <!-- Riset aset dari berbagai sumber (jurnal, media, situs perusahaan, regulator). -->
    <template v-if="rs">
      <section class="sec">
        <h3 class="lbl">Ringkasan riset aset <span class="small muted">per {{ fmtDate(rs.asOf) }}</span></h3>
        <p class="desc">{{ rs.ringkasan }}</p>
      </section>
      <section v-if="rs.entitas?.length" class="sec">
        <h3 class="lbl">Entitas aset</h3>
        <div class="ent">
          <article v-for="e in rs.entitas" :key="e.nama" class="ec">
            <b>{{ e.nama }}</b><div class="small muted">{{ e.peran }}</div>
            <div v-if="e.lokasi" class="small">Lokasi: {{ e.lokasi }}</div>
            <div v-if="e.berdiri && !/tidak diungkap/i.test(e.berdiri)" class="small">Berdiri: {{ e.berdiri }}</div>
            <div v-if="e.kegiatan" class="small">{{ e.kegiatan }}</div>
          </article>
        </div>
      </section>
      <section v-if="rs.operasional?.length || fakta.length" class="sec">
        <h3 class="lbl">Operasional</h3>
        <dl class="kv">
          <div v-for="f in fakta" :key="f.d + f.t" class="lap"><dt>{{ f.l }}<small>laporan {{ fmtDate(f.d) }}</small></dt>
            <dd>{{ f.t }} <a :href="f.url" target="_blank" rel="noopener" class="sx" :title="f.judul">[laporan]</a><span v-if="f.baru" class="tag t-good">terbaru</span></dd></div>
          <div v-for="o in rs.operasional || []" :key="o.l"><dt>{{ o.l }}</dt><dd>{{ o.t }}<sup v-if="src(o.s)" class="sx" :title="src(o.s).t">[{{ o.s + 1 }}]</sup></dd></div>
        </dl>
      </section>
      <section v-if="rs.tambang" class="sec">
        <h3 class="lbl">Tambang: lokasi, cadangan, dan umur</h3>
        <dl class="kv"><template v-for="[f, l] in TB_R" :key="f"><div v-if="rs.tambang[f]"><dt>{{ l }}</dt><dd>{{ rs.tambang[f] }}</dd></div></template></dl>
      </section>
      <section v-if="rs.pasar" class="sec">
        <h3 class="lbl">Pasar dan pelanggan</h3>
        <p class="desc">{{ rs.pasar }}</p>
      </section>
      <section v-if="rs.keuangan?.length" class="sec">
        <h3 class="lbl">Keuangan aset (riset)</h3>
        <dl class="kv"><div v-for="o in rs.keuangan" :key="o.l"><dt>{{ o.l }}</dt><dd>{{ o.t }}<sup v-if="src(o.s)" class="sx" :title="src(o.s).t">[{{ o.s + 1 }}]</sup></dd></div></dl>
      </section>
      <section v-if="rs.pengendaliAset?.length" class="sec">
        <h3 class="lbl">Aset lain milik pengendali</h3>
        <div class="ent">
          <article v-for="e in rs.pengendaliAset" :key="e.nama" class="ec">
            <b>{{ e.nama }}</b><div class="small muted">{{ [e.jenis, e.lokasi].filter(Boolean).join(' · ') }}</div>
            <div v-if="e.detail" class="small">{{ e.detail }}</div>
            <div v-if="e.hubungan" class="small muted">Kaitan: {{ e.hubungan }}</div>
          </article>
        </div>
      </section>
      <section v-if="rs.jurnal?.length" class="sec">
        <h3 class="lbl">Temuan jurnal ilmiah</h3>
        <ul class="jr">
          <li v-for="j in rs.jurnal" :key="j.judul"><a v-if="j.url" :href="j.url" target="_blank" rel="noopener"><b>{{ j.judul }}</b></a><b v-else>{{ j.judul }}</b>
            <div class="small muted">{{ [j.penulis, j.tahun, j.terbitan].filter(Boolean).join(' · ') }}</div>
            <div class="small">{{ j.temuan }}</div></li>
        </ul>
      </section>
      <section v-if="rs.positif?.length || rs.risiko?.length" class="sec pr">
        <div><h3 class="lbl">Pendukung nilai aset</h3><ul><li v-for="x in rs.positif" :key="x">{{ x }}</li></ul></div>
        <div><h3 class="lbl">Risiko aset</h3><ul><li v-for="x in rs.risiko" :key="x">{{ x }}</li></ul></div>
      </section>
    </template>
    <template v-else>
      <p class="small muted">Riset aset lintas sumber untuk {{ ticker }} belum tersedia; data di bawah dari keterbukaan informasi.</p>
      <section v-if="fakta.length" class="sec">
        <h3 class="lbl">Operasional (dari laporan terakhir)</h3>
        <dl class="kv"><div v-for="f in fakta" :key="f.d + f.t" class="lap"><dt>{{ f.l }}<small>laporan {{ fmtDate(f.d) }}</small></dt>
          <dd>{{ f.t }} <a :href="f.url" target="_blank" rel="noopener" class="sx" :title="f.judul">[laporan]</a></dd></div></dl>
      </section>
    </template>

    <p v-if="!a && !r && !rs" class="muted">Data aset untuk {{ ticker }} belum ada.</p>

    <template v-if="a">
      <section class="sec">
        <h3 class="lbl">Aset dan transaksi</h3>
        <p v-if="ast.deskripsi" class="desc">{{ ast.deskripsi }}</p>
        <dl class="kv">
          <div><dt>Nilai transaksi</dt><dd><b>{{ val ? big(val) : 'belum ada' }}</b><template v-if="val && mcapRp"> · {{ x2(val / mcapRp) }} kapitalisasi {{ ticker }}</template>
            <div v-if="a.transaksi?.nilai" class="small muted">{{ a.transaksi.nilai }}</div></dd></div>
          <div><dt>Cara bayar</dt><dd>{{ a.transaksi?.caraBayar || 'belum ada' }}</dd></div>
          <div><dt>Porsi</dt><dd>{{ ast.porsi || 'belum ada' }}</dd></div>
          <template v-for="[f, l] in TB" :key="f"><div v-if="ast.tambang?.[f]"><dt>{{ l }}</dt><dd>{{ ast.tambang[f] }}</dd></div></template>
          <div v-if="a.pembanding?.length"><dt>Pembanding</dt><dd>{{ a.pembanding.join(', ') }}</dd></div>
        </dl>
        <template v-if="hasFin">
          <h4 class="lbl sub">Keuangan aset target<template v-if="fin.periode"> · {{ fin.periode }}</template></h4>
          <table class="ledger">
            <tbody><tr v-for="[f, l] in FIN" :key="f"><td>{{ l }}</td><td class="r num" :class="{ muted: fin[f] == null }">{{ fin[f] != null ? big(fin[f]) : 'belum ada' }}</td></tr></tbody>
          </table>
        </template>
        <p v-else class="small muted">Laporan keuangan aset target belum ada di sumber publik.</p>
      </section>

      <section class="sec">
        <h3 class="lbl">Status penilaian KJPP</h3>
        <dl class="kv">
          <div><dt>Status</dt><dd><span class="tag" :class="'t-' + ks.tone">{{ ks.label }}</span></dd></div>
          <div><dt>KJPP</dt><dd>{{ k.nama || 'belum ada' }}</dd></div>
          <div><dt>Tanggal laporan</dt><dd>{{ k.tanggalLaporan ? fmtDate(k.tanggalLaporan) : 'belum ada' }}<template v-if="k.cutOff"> · posisi {{ fmtDate(k.cutOff) }}</template></dd></div>
          <div><dt>Nilai</dt><dd>{{ k.nilai || (k.nilaiRp ? big(k.nilaiRp) : 'belum ada') }}</dd></div>
          <div><dt>Metode</dt><dd>{{ k.metode || 'belum ada' }}</dd></div>
          <div><dt>Kesimpulan</dt><dd>{{ k.kesimpulan || 'belum ada' }}</dd></div>
          <div v-if="k.dasar"><dt>Catatan</dt><dd class="warn">{{ k.dasar }}</dd></div>
          <div v-if="k.sumber"><dt>Sumber</dt><dd class="small">{{ k.sumber }}</dd></div>
        </dl>
      </section>
    </template>

    <section v-if="flow" class="sec">
      <h3 class="lbl">Bagan mekanisme transaksi</h3>
      <p class="small"><b>{{ MECH_LABEL[mech] }}</b></p>
      <div class="flow">
        <svg viewBox="0 0 900 250" role="img" :aria-label="'Bagan mekanisme ' + MECH_LABEL[mech] + ' ' + ticker + ': ' + flowLabel">
          <defs><marker :id="'fh-' + ticker" class="mk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" /></marker></defs>
          <g v-for="(x, i) in flow.arrows" :key="'a' + i" class="arr" :class="x.cls">
            <line :x1="x.x1" :y1="x.y1" :x2="x.x2" :y2="x.y2" :marker-end="`url(#fh-${ticker})`" />
            <text :x="(x.x1 + x.x2) / 2" :y="/back/.test(x.cls) ? (x.y1 + x.y2) / 2 + 14 : (x.y1 + x.y2) / 2 - 7 - (x.lines.length - 1) * 12" text-anchor="middle">
              <tspan v-for="(ln, j) in x.lines" :key="j" :x="(x.x1 + x.x2) / 2" :dy="j ? 12 : 0">{{ ln }}</tspan>
            </text>
          </g>
          <g v-for="(b, i) in flow.boxes" :key="'b' + i" class="box" :class="b.cls">
            <rect :x="b.x" :y="b.y" :width="b.w" height="54" rx="3" />
            <text :x="b.x + b.w / 2" :y="b.y + 23" text-anchor="middle" class="t1">{{ b.t1 }}</text>
            <text :x="b.x + b.w / 2" :y="b.y + 41" text-anchor="middle" class="t2">{{ b.t2 }}</text>
          </g>
        </svg>
      </div>
      <ol class="steps">
        <li v-for="s in steps" :key="s.t" :class="{ done: s.done }"><span class="sr-only">{{ s.done ? 'sudah' : 'belum' }}:</span>{{ s.t }}</li>
      </ol>
    </section>

    <section v-if="a || sv?.injectType" class="sec">
      <h3 class="lbl">Simulasi nilai KJPP <span class="tag t-warn">simulasi</span></h3>
      <p class="small muted">
        <template v-if="ks.id === 'terbit'">Penilaian KJPP resmi tersedia<template v-if="k.nilaiRp"> ({{ big(k.nilaiRp) }})</template>. Simulasi di bawah sebagai pembanding.</template>
        <template v-else-if="ks.id === 'ditunjuk'">KJPP<template v-if="k.nama"> {{ k.nama }}</template> sudah ditunjuk dan laporannya belum terbit. Simulasi ini memperkirakan hasilnya.</template>
        <template v-else>Belum ada laporan penilaian KJPP. Simulasi memperkirakan nilai wajar dengan pendekatan penilai.</template>
        Angka di sini tidak resmi dan tidak menambah progress.
      </p>
      <p v-if="ast.nama" class="small">Aset: <b>{{ ast.nama }}</b><template v-if="ast.porsi"> · porsi {{ ast.porsi }}</template><template v-if="ast.sektor"> · sektor {{ ast.sektor }}</template></p>
      <!-- Data yang dipakai: otomatis dari dokumen aset dan Stockbit (tidak ada isian manual). -->
      <dl class="inputs">
        <div v-for="[key, label, hint] in SIM_IN" :key="key" class="in">
          <dt class="small">{{ label }}</dt>
          <dd class="v1" :class="{ muted: si[key] == null }">{{ showVal(key, si[key]) }}</dd>
          <dd class="small muted">{{ hint }}</dd>
        </div>
      </dl>
      <p class="small muted">{{ peerUsed.length ? 'Pembanding (Stockbit): ' + peerUsed.join(', ') : 'Pembanding: ' + (a?.pembanding?.join(', ') || 'belum ditentukan') }}</p>
      <p v-if="sim.implied" class="small">Nilai transaksi tersirat <b>Rp{{ fmt(Math.round(sim.implied)) }}/ton</b> (sekitar USD{{ fmt(sim.implied / KURS.USD, 2) }}/ton) atas {{ fmt(si.res * sim.por, 1) }} juta ton porsi yang masuk.</p>
      <p v-if="sim.mid == null" class="note">
        <template v-if="si.laba > 0 || si.pend > 0 || si.eq > 0">Belum bisa disimulasikan: kelipatan pembanding (PER, P/S, atau PBV) dari Stockbit belum tersedia.</template>
        <template v-else>Belum bisa disimulasikan: data keuangan aset target (laba, pendapatan, atau ekuitas) belum diungkap<template v-if="mining"> dan cadangan tambang belum diungkap</template>. Simulasi terhitung otomatis begitu datanya terbit (keterbukaan informasi / laporan KJPP).</template>
      </p>
      <template v-else>
        <table class="ledger">
          <tbody>
            <tr v-for="x in sim.rows" :key="x.k"><td><b>{{ x.k }}</b><div class="small muted">{{ x.how }} · porsi {{ fmt(sim.por * 100) }}%</div></td><td class="r num">{{ big(x.v) }}</td></tr>
            <tr class="tot"><td><b>Kisaran nilai wajar simulasi</b><div class="small muted">nilai tengah ±25%</div></td><td class="r num">{{ big(sim.lo) }} – {{ big(sim.hi) }}</td></tr>
            <tr v-if="sim.tx"><td><b>Nilai transaksi diumumkan</b></td><td class="r num">{{ big(sim.tx) }}</td></tr>
          </tbody>
        </table>
        <p class="verdict" :class="'v-' + sim.verdict.tone">{{ sim.verdict.t }}</p>
        <p class="small muted">Keyakinan simulasi <b>{{ sim.conf }}</b> ({{ sim.rows.length }} pendekatan punya data). Kelipatan pembanding belum memasukkan premi kendali atau merek strategis yang biasa dipakai penilai.</p>
      </template>

      <h4 class="lbl sub">Dampak ke saham {{ ticker }}</h4>
      <p v-if="executed" class="small muted">Penerbitan saham baru sudah tereksekusi, jadi jumlah saham dan porsi publik saat ini sudah memuat dilusinya.</p>
      <template v-else>
        <dl class="inputs">
          <div v-for="[key, label] in DL_IN" :key="key" class="in">
            <dt class="small">{{ label }}</dt>
            <dd class="v1">{{ dlShow(key, dl[key]) }}</dd>
            <dd class="small muted">{{ dlSrc[key] }}</dd>
          </div>
        </dl>
        <p v-if="!base.S0" class="small muted">Jumlah saham {{ ticker }} belum ada, jadi dilusi belum bisa dihitung.</p>
        <p v-else-if="!out" class="small muted">Harga pelaksanaan belum tersedia.</p>
        <dl v-else class="out" aria-live="polite">
          <div><dt>Saham baru</dt><dd><b>{{ fmt(out.N / 1e6) }} jt</b><span>{{ x2(out.N / out.S0) }} saham sekarang</span></dd></div>
          <div><dt>Porsi publik</dt><dd><b>{{ fmt(out.pubAfter * 100, 2) }}%</b><span>dari {{ fmt(out.f * 100, 2) }}%</span></dd></div>
          <div><dt>Nilai buku per saham</dt><dd><b>{{ rp(out.vps) }}</b><span>aset diakui sebesar nilai dibayar<template v-if="base.price"> · {{ pctTxt(out.vps, base.price) }} vs harga {{ rp(base.price) }}</template></span></dd></div>
          <div v-if="out.vpsSim != null"><dt>Nilai buku per saham (simulasi)</dt><dd><b>{{ rp(out.vpsSim) }}</b><span>aset diakui sebesar nilai tengah simulasi<template v-if="base.price"> · {{ pctTxt(out.vpsSim, base.price) }}</template></span></dd></div>
        </dl>
        <p class="small muted">Model sederhana: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.<template v-if="!prof"> Ekuitas {{ ticker }} dari Stockbit belum termuat, dihitung nol.</template></p>
      </template>
    </section>

    <template v-if="r">
      <section v-if="r.nilai?.length" class="sec">
        <h3 class="lbl">Nilai dan skema bayar</h3>
        <dl class="facts">
          <div v-for="n in r.nilai" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="r.nilaiCatatan">{{ r.nilaiCatatan }}</p>
      </section>

      <section v-if="r.valuasi?.baris?.length" class="sec">
        <h3 class="lbl">{{ r.valuasi.judul || 'Pembanding valuasi' }}</h3>
        <div v-for="b in r.valuasi.baris" :key="b.l" class="vrow">
          <div class="vh"><span>{{ b.l }}</span><b>{{ b.teks }}</b></div>
          <div class="bar" aria-hidden="true"><i :class="{ main: b.utama }" :style="{ width: (b.v / Math.max(...r.valuasi.baris.map(y => y.v)) * 100) + '%' }"></i></div>
        </div>
        <p v-if="r.valuasi.catatan" class="small muted">{{ r.valuasi.catatan }}</p>
      </section>

      <section v-if="r.kinerja" class="sec">
        <h3 class="lbl">{{ r.kinerja.judul || 'Kinerja keuangan' }}</h3>
        <p v-if="r.kinerja.peringatan || r.kinerja.peringatanTegas" class="alert"><b>{{ r.kinerja.peringatanTegas }}</b>{{ r.kinerja.peringatan }}</p>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Data</th><th class="lbl">Isi</th><th class="lbl">Keandalan</th></tr></thead>
            <tbody>
              <tr v-for="x in r.kinerja.baris" :key="x.data">
                <td>{{ x.data }}</td>
                <td :class="{ muted: !x.isi }">{{ x.isi || 'belum ada' }}</td>
                <td :class="{ rendah: 'warn', 'sangat-rendah': 'strong' }[x.level] || 'muted'">{{ x.andal }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="r.operasional?.length" class="sec">
        <h3 class="lbl">Operasional</h3>
        <dl class="kv"><div v-for="o in r.operasional" :key="o.l"><dt>{{ o.l }}</dt><dd>{{ o.t }}</dd></div></dl>
      </section>

      <section v-if="r.dampak?.length" class="sec">
        <h3 class="lbl">Dampak ke {{ ticker }}</h3>
        <dl class="facts">
          <div v-for="n in r.dampak" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="r.dampakCatatan">{{ r.dampakCatatan }}</p>
      </section>

      <section v-if="r.dokumen?.length" class="sec">
        <h3 class="lbl">Dokumen yang ditunggu</h3>
        <ul><li v-for="x in r.dokumen" :key="x">{{ x }}</li></ul>
      </section>
    </template>

    <details v-if="a?.tidakDitemukan?.length || rs?.belumDitemukan?.length" class="more">
      <summary>Data yang belum diungkap ({{ (a?.tidakDitemukan?.length || 0) + (rs?.belumDitemukan?.length || 0) }})</summary>
      <ul class="small"><li v-for="x in [...(rs?.belumDitemukan || []), ...(a?.tidakDitemukan || [])]" :key="x">{{ x }}</li></ul>
    </details>

    <section v-if="sources.length" class="sec">
      <h3 class="lbl">Sumber</h3>
      <ol class="small">
        <li v-for="s in sources" :key="s.t">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.t }}</a><template v-else>{{ s.t }}</template>
          <template v-if="s.ket"> · {{ s.ket }}</template>
        </li>
      </ol>
      <p v-if="r?.asOf" class="small muted">Data relasi per {{ fmtDate(r.asOf) }}.</p>
    </section>
  </div>
</template>

<style scoped>
.tab-aset{display:flex;flex-direction:column;gap:16px}
.hd{padding-top:10px;position:relative}
.unduh{float:right;display:flex;align-items:center;gap:8px;margin:0 0 6px 12px}
.ent{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:6px}
.ec{border:1px solid var(--rule);background:var(--sheet);padding:8px 12px;display:flex;flex-direction:column;gap:3px}
.lap dt small{display:block;font:500 11px var(--f-body);text-transform:none;letter-spacing:0;color:var(--muted)}
.lap .tag{margin-left:6px}
.sx{color:var(--accent);font-size:10px;margin-left:2px;cursor:help}
.jr{list-style:none;padding:0}.jr li{border-bottom:1px solid var(--rule-2);padding:6px 0}
.pr{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media (max-width:760px){.pr{grid-template-columns:1fr}}
.t{font-size:30px;line-height:1.05;margin:2px 0}
.lbl{margin:0 0 6px}
.lbl.sub{margin:14px 0 6px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.sec{border-top:2px solid var(--ink);padding-top:10px}
.sec p{margin:8px 0 0;font-size:13px}
.desc{max-width:80ch}
.kv{margin:8px 0 0;font-size:13.5px}
.kv>div{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.kv dt{font:600 12.5px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;max-width:80ch}
.ledger{font-size:13px;margin-top:4px}
.r{text-align:right}
.num{font:700 15px var(--f-display);white-space:nowrap}
.tot td{border-top:1px solid var(--ink)}
.warn{color:var(--warn)}
.strong{color:var(--strong)}

/* Bagan alur: kotak pihak di atas lembar, panah tinta, label kecil. */
.flow{overflow-x:auto;margin-top:8px;border:1px solid var(--rule);background:var(--sheet-2)}
.flow svg{display:block;width:100%;min-width:640px;height:auto}
.box rect{fill:var(--sheet);stroke:var(--rule);stroke-width:1.2}
.box.em rect{stroke:var(--ink);stroke-width:2}
.box.as rect{fill:var(--good-bg);stroke:var(--good)}
.box.pub rect{fill:var(--calm-bg);stroke:var(--calm)}
.t1{font:700 15px var(--f-display);fill:var(--ink)}
.t2{font:500 12px var(--f-body);fill:var(--ink-2)}
.arr line{stroke:var(--ink-2);stroke-width:1.6}
.arr.dash line{stroke-dasharray:5 4}
.arr text{font:500 12px var(--f-body);fill:var(--ink)}
.mk path{fill:var(--ink-2)}
.steps{list-style:none;counter-reset:st;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:2px;margin:10px 0 0;padding:0}
.steps li{counter-increment:st;font:600 12px/1.25 var(--f-display);text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;border:1px dashed var(--rule);border-radius:2px;color:var(--ink-2)}
.steps li::before{content:counter(st) ". "}
.steps li.done{background:var(--accent);border:1px solid var(--accent);color:var(--accent-ink)}

.inputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:3px 14px;margin:10px 0}
/* Subgrid: label, isian, dan petunjuk sejajar antar kolom walau label terlipat. */
.in{display:grid;grid-template-rows:subgrid;grid-row:span 3;align-items:end;margin-bottom:8px}
.in dd{margin:0;align-self:start}
.in .v1{font:700 16px var(--f-display);align-self:end}
.note{padding:8px 12px;background:var(--warn-bg);color:var(--warn)}
.verdict{padding:8px 12px;font-weight:600}
.v-good{background:var(--good-bg);color:var(--good)}
.v-warn{background:var(--warn-bg);color:var(--warn)}
.v-strong{background:var(--strong-bg);color:var(--strong)}
.out{display:grid;grid-template-columns:repeat(2,1fr);margin:10px 0 0;border-top:1px solid var(--rule)}
.out div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 16px 7px 0;border-bottom:1px solid var(--rule-2)}
.out dt{color:var(--ink-2);font-size:13px}
.out dd{margin:0;text-align:right;display:flex;flex-direction:column}
.out dd b{font:700 17px var(--f-display);white-space:nowrap}
.out dd span{font-size:12px;color:var(--ink-2)}

/* Baris fakta bergaris dari relasi-verified: label, angka besar, keterangan. */
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin:0;border-top:1px solid var(--rule-2)}
.facts>div{padding:8px 12px 8px 0;border-bottom:1px solid var(--rule-2)}
.facts dt,.facts dd{margin:0}
.v{font:700 24px/1.1 var(--f-display)}
.s{font-size:12px;color:var(--ink-2)}
.vrow{margin:6px 0;font-size:13px}
.vh{display:flex;justify-content:space-between;gap:12px}
.bar{height:6px;background:var(--rule-2);border-radius:3px;margin-top:3px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--rail-mute)}
.bar i.main{background:var(--accent)}
.alert{background:var(--strong-bg);padding:10px 14px;margin:0 0 8px!important}
.alert b{color:var(--strong)}
.scroll{overflow-x:auto}
.more summary{cursor:pointer;font-weight:600;min-height:28px}
ul{margin:0;padding-left:18px;font-size:13px}
li{margin:3px 0}
@media (max-width:760px){.kv>div{grid-template-columns:1fr;gap:2px}.out{grid-template-columns:1fr}}
</style>
