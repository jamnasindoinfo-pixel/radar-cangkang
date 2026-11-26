<script setup>
// Astronacci: gabungan siklus bulan (Financial Astrology) dan Fibonacci untuk IHSG dari /api/ihsg-astro.
// Level harga Fibonacci (retracement/ekstensi), hitungan waktu Fibonacci dari titik balik utama, fase bulan
// berikutnya (dihitung astronomis), jendela waktu bila keduanya berdekatan, dan uji historis keandalannya.
import { computed, ref } from 'vue'
import RamalanRiwayat from './RamalanRiwayat.vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'

const d = ref(null), err = ref('')
const URL_DATA = '/api/ihsg-astro'
api.get(URL_DATA).then(r => { if (r.error) err.value = r.error; else d.value = r }, e => { err.value = e.message || String(e) })

const n0 = v => v == null ? '–' : Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const IKON = { 'Bulan baru': '●', 'Kuartal pertama': '◐', Purnama: '○', 'Kuartal akhir': '◑' }
const hariIni = new Date().toISOString().slice(0, 10)

// Tangga level: gabungan level dua ayunan + harga kini, urut dari atas.
const tangga = computed(() => {
  if (!d.value) return []
  const rows = d.value.ayunan.flatMap(a => a.level.map(l => ({ ...l, ay: a.nama.startsWith('Ayunan besar') ? '1 tahun' : '60 hari' })))
  rows.push({ v: d.value.harga, kini: true })
  return rows.sort((a, b) => b.v - a.v)
})
const jarak = v => (v / d.value.harga - 1) * 100

// Unduh riset (PDF, format sama dengan "Unduh riset IHSG"): harga IHSG disegarkan dulu agar data terbaru.
const busy = ref(false), errPdf = ref('')
async function unduh() {
  busy.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), import('../lib/ihsgModelPdf.js')])
    try { await api.get('/api/ihsg-outlook', { segar: 1 }) } catch { /* gagal segarkan: pakai data tersimpan */ }
    let data = d.value
    try { const r = await api.get(URL_DATA); if (!r.error) { data = r; d.value = r } } catch { /* pakai data yang tampil */ }
    ;(await mod.astroPdf(data, jsPDF)).save(mod.astroPdfName())
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busy.value = false }
}

// Grafik: harga 120 hari + garis level Fibonacci ayunan terakhir, penanda fase bulan & tanggal Fibonacci ke depan,
// dan jalur proyeksi. Sumbu X = hari bursa (Senin–Jumat); tanggal ke depan dipetakan dengan menghitung hari kerja.
const CW = 760, CH = 280, PL = 40, PR = 50
const chart = computed(() => {
  if (!d.value?.riwayat?.length) return null
  const h = d.value.riwayat, n = h.length, last = new Date(h[n - 1].d + 'T00:00:00')
  const pr = d.value.proyeksi || { jalur: [] }
  const idxOf = tgl => {
    const t = new Date(tgl + 'T00:00:00')
    if (t <= last) { const i = h.findIndex(x => x.d >= tgl); return i < 0 ? n - 1 : i }
    let k = 0
    for (const x = new Date(last); x < t;) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++ }
    return n - 1 + k
  }
  const ends = [...pr.jalur.map(j => j.tgl), ...d.value.fase.map(f => f.tgl), ...d.value.waktu.map(w => w.tgl)]
  const total = Math.min(n + 60, Math.max(n + 10, ...ends.map(idxOf)) + 2)
  const lv = d.value.ayunan[1].level.concat(d.value.ayunan[0].level.filter(l => l.rasio === 0.618 || l.rasio === 0.382))
  const vals = [...h.flatMap(x => [x.h, x.l]), ...pr.jalur.map(j => j.v)]
  const lo = Math.min(...vals) * 0.98, hi = Math.max(...vals) * 1.02
  const X = i => PL + (i / (total - 1)) * (CW - PL - PR), Y = v => 12 + (1 - (v - lo) / (hi - lo)) * (CH - 42)
  const inX = i => i >= 0 && i < total
  const fibs = [...new Map(lv.filter(l => l.v > lo && l.v < hi).map(l => [l.v, l])).values()]
    .map(l => ({ y: Y(l.v), t: `${(l.rasio * 100).toFixed(1).replace('.', ',')}% · ${n0(l.v)}`, ext: l.jenis === 'ekstensi' }))
  const kl = (d.value.klaster || []).map(k => ({ x1: X(idxOf(k.dari)) - 3, x2: X(idxOf(k.sampai)) + 3, sup: k.label === 'Time support', t: `${k.label} ${fmtDate(k.tgl)}`, i: idxOf(k.tgl) })).filter(k => inX(k.i))
  const moons = d.value.fase.filter(f => f.utama).map(f => ({ x: X(idxOf(f.tgl)), ik: IKON[f.fase], t: f.fase + ' ' + fmtDate(f.tgl), i: idxOf(f.tgl) })).filter(m => inX(m.i))
  const times = d.value.waktu.map(w => ({ x: X(idxOf(w.tgl)), on: !!w.bulan, t: `${fmtDate(w.tgl)} · Fibonacci ${w.hitungan} hari dari ${w.dari}`, i: idxOf(w.tgl) })).filter(m => inX(m.i))
  return {
    harga: h.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x.c).toFixed(1)}`).join(''),
    proy: pr.jalur.map((j, i) => `${i ? 'L' : 'M'}${X(idxOf(j.tgl)).toFixed(1)},${Y(j.v).toFixed(1)}`).join(''),
    titik: pr.jalur.filter(j => j.fase).map(j => ({ x: X(idxOf(j.tgl)), y: Y(j.v) })),
    fibs, moons, times, kl, xNow: X(n - 1), yNow: Y(h[n - 1].c), dAwal: h[0].d, dNow: h[n - 1].d,
    target: pr.target ? { x: X(idxOf(pr.jalur.at(-1).tgl)), y: Y(pr.target) } : null,
  }
})
</script>

<template>
  <section class="as">
    <div class="unduh">
      <button type="button" class="btn" :disabled="busy || !d" @click="unduh">{{ busy ? 'Menyiapkan PDF…' : '⬇ Unduh riset Astronacci (PDF)' }}</button>
      <span v-if="errPdf" class="small muted">{{ errPdf }}</span>
    </div>
    <p class="small muted intro">Perhitungan <b>Astronacci</b>: menggabungkan <b>siklus bulan</b> (Financial Astrology) dengan <b>Fibonacci</b> harga dan waktu untuk IHSG.
      Fase bulan dihitung astronomis (waktu WIB); level dan tanggal Fibonacci dihitung otomatis dari titik balik harga harian 1 tahun.</p>
    <p v-if="err" class="muted">{{ err }}</p>
    <p v-else-if="!d" class="muted">Menghitung siklus bulan dan Fibonacci…</p>
    <template v-else>
      <div class="top">
        <article class="card">
          <div class="lbl">IHSG {{ fmtDate(d.tanggal) }}</div>
          <div class="big">{{ n0(d.harga) }}</div>
          <div class="small">Support Fibonacci: <b>{{ d.support.map(n0).join(' · ') || '–' }}</b></div>
          <div class="small">Resistance Fibonacci: <b>{{ d.resistance.map(n0).join(' · ') || '–' }}</b></div>
        </article>
        <article class="card">
          <div class="lbl">Fase bulan berikutnya</div>
          <ul class="fase">
            <li v-for="f in d.fase" :key="f.tgl + f.fase" :class="{ utama: f.utama }"><span class="ik" aria-hidden="true">{{ IKON[f.fase] }}</span>
              <b>{{ f.fase }}</b> <span class="muted">{{ fmtDate(f.tgl) }} · {{ f.jam }} WIB</span></li>
          </ul>
        </article>
        <article class="card">
          <div class="lbl">Jendela waktu (Fibonacci × bulan)</div>
          <ul v-if="d.jendela.length" class="fase">
            <li v-for="w in d.jendela" :key="w.tgl + w.dari" :class="{ dekat: w.tgl >= hariIni }"><b>{{ fmtDate(w.tgl) }}</b>
              <span class="small muted">· {{ w.hitungan }} hari bursa dari {{ w.dari }} · dekat {{ fmtDate(w.bulan) }}</span></li>
          </ul>
          <p v-else class="small muted">Tidak ada tanggal Fibonacci yang berdekatan dengan bulan baru/purnama dalam 75 hari ke depan.</p>
        </article>
      </div>

      <div v-if="d.rekomendasi" class="rek">
        <div class="lbl">Rekomendasi IHSG</div>
        <div class="rt"><b>{{ d.rekomendasi.tindakan }}</b> <span class="tag t-calm">keyakinan {{ d.rekomendasi.keyakinan }}</span></div>
        <p class="rd">{{ d.rekomendasi.detail }}</p>
        <ul class="kf"><li v-for="k in d.rekomendasi.konfirmasi" :key="k.nama">{{ k.nama }}: <b :class="/naik|positif/.test(k.arah) ? 'c-good' : /turun|negatif/.test(k.arah) ? 'c-strong' : 'muted'">{{ k.arah }}</b><template v-if="k.nilai != null"> ({{ pct(k.nilai) }})</template></li></ul>
        <p class="small muted">{{ d.rekomendasi.catatan }}</p>
      </div>

      <div v-if="d.klaster?.length" class="kl">
        <h3 class="lbl">Time cluster (fase bulan + deklinasi bulan + Fibonacci)</h3>
        <div class="klg">
          <article v-for="k in d.klaster" :key="k.tgl" class="kc" :class="k.label === 'Time support' ? 'sup' : 'res'">
            <div class="small lbl">{{ k.label }}</div>
            <div class="kt">{{ fmtDate(k.tgl) }}</div>
            <div class="small muted">{{ k.dari === k.sampai ? '' : fmtDate(k.dari) + '–' + fmtDate(k.sampai) + ' · ' }}{{ k.kekuatan }} siklus</div>
            <ul class="small"><li v-for="x in k.siklus" :key="x">{{ x }}</li></ul>
          </article>
        </div>
        <p class="small muted">Time support = perkiraan waktu dasar (harga yang turun menuju tanggal ini berpeluang berbalik naik); time resistance = perkiraan waktu puncak.
          Label berselang-seling mulai dari arah 10 hari terakhir. Uji 1 tahun: titik balik terjadi di sekitar {{ d.ujiKlaster.balik }}% dari {{ d.ujiKlaster.n }} klaster bulan,
          dibanding {{ d.ujiKlaster.acak }}% pada hari acak.</p>
      </div>

      <div v-if="d.proyeksi" class="proy">
        <div class="pk">
          <div class="lbl">Proyeksi Astronacci</div>
          <div class="big" :class="d.proyeksi.bias === 'naik' ? 'c-good' : d.proyeksi.bias === 'turun' ? 'c-strong' : 'muted'">{{ d.proyeksi.bias === 'naik' ? 'Bias naik' : d.proyeksi.bias === 'turun' ? 'Bias turun' : 'Mendatar' }}</div>
          <div class="small">Perkiraan <b>{{ n0(d.proyeksi.target) }}</b> ({{ pct(d.proyeksi.ubah) }}) sampai fase {{ fmtDate(d.proyeksi.sampai) }}</div>
          <div class="small muted">Ayunan acuan: {{ d.proyeksi.ayunan }}</div>
        </div>
        <ul class="sk"><li v-for="x in d.proyeksi.skenario" :key="x.nama"><b>{{ x.nama }}:</b> {{ x.t }}</li></ul>
      </div>

      <div v-if="chart" class="chartbox">
        <svg :viewBox="`0 0 ${CW} ${CH}`" role="img" :aria-label="'Grafik IHSG dengan level Fibonacci, fase bulan, dan proyeksi Astronacci: ' + (d.proyeksi?.bias || '')">
          <g v-for="f in chart.fibs" :key="f.t"><line :x1="PL" :x2="CW - PR" :y1="f.y" :y2="f.y" class="fib" :class="{ ext: f.ext }" /><text :x="CW - PR + 3" :y="f.y + 3" class="ax">{{ f.t.split(' · ')[1] }}</text><text :x="PL + 2" :y="f.y - 2" class="ax sm">{{ f.t.split(' · ')[0] }}</text></g>
          <rect v-for="k in chart.kl" :key="k.t" :x="k.x1" y="12" :width="Math.max(6, k.x2 - k.x1)" :height="CH - 42" :class="k.sup ? 'ksup' : 'kres'"><title>{{ k.t }}</title></rect>
          <g v-for="t in chart.times" :key="t.t"><line :x1="t.x" :x2="t.x" y1="12" :y2="CH - 30" class="ft" :class="{ on: t.on }"><title>{{ t.t }}</title></line></g>
          <g v-for="m in chart.moons" :key="m.t"><line :x1="m.x" :x2="m.x" y1="12" :y2="CH - 30" class="mn" /><text :x="m.x" :y="CH - 18" class="moon" text-anchor="middle"><title>{{ m.t }}</title>{{ m.ik }}</text></g>
          <line :x1="chart.xNow" :x2="chart.xNow" y1="8" :y2="CH - 30" class="now" />
          <path :d="chart.harga" class="hist" />
          <path :d="chart.proy" class="pj" />
          <circle v-for="(t, i) in chart.titik" :key="i" :cx="t.x" :cy="t.y" r="3" class="pjd" />
          <circle :cx="chart.xNow" :cy="chart.yNow" r="3.5" class="nowd" />
          <text :x="PL" :y="CH - 4" class="ax">{{ fmtDate(chart.dAwal) }}</text>
          <text :x="chart.xNow" :y="CH - 4" class="ax" text-anchor="middle">{{ fmtDate(chart.dNow) }}</text>
        </svg>
        <p class="small muted leg"><span class="k hist" /> IHSG <span class="k pj" /> proyeksi <span class="k fib" /> level Fibonacci <span class="k mn" /> bulan baru ● / purnama ○ <span class="k ft" /> tanggal Fibonacci (tebal = dekat fase bulan) <span class="k ksup" /> time support <span class="k kres" /> time resistance</p>
        <p class="small muted">{{ d.proyeksi?.cara }}</p>
      </div>

      <div class="grid2">
        <div>
          <h3 class="lbl">Tangga level Fibonacci</h3>
          <table class="ledger">
            <thead><tr><th>Level</th><th>Ayunan</th><th class="r">Harga</th><th class="r">Jarak</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in tangga" :key="i" :class="{ kini: l.kini }">
                <td v-if="l.kini" colspan="2"><b>Harga kini</b></td>
                <template v-else><td>{{ l.jenis }} {{ fmt(l.rasio * 100, 1) }}%</td><td class="small muted">{{ l.ay }}</td></template>
                <td class="r num">{{ n0(l.v) }}</td>
                <td class="r small" :class="l.kini ? '' : jarak(l.v) > 0 ? 'c-good' : 'c-strong'">{{ l.kini ? '' : pct(jarak(l.v)) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-for="a in d.ayunan" :key="a.nama" class="small muted">{{ a.nama }}: {{ a.arah }} dari {{ fmtDate(a.dari) }} ke {{ fmtDate(a.ke) }} ({{ n0(a.rendah) }}–{{ n0(a.tinggi) }}).</p>
        </div>
        <div>
          <h3 class="lbl">Hitungan waktu Fibonacci</h3>
          <table class="ledger">
            <thead><tr><th>Tanggal</th><th>Dari titik balik</th><th class="r">Hitungan</th></tr></thead>
            <tbody>
              <tr v-for="w in d.waktu" :key="w.tgl + w.dari" :class="{ kini: w.bulan }">
                <td><b>{{ fmtDate(w.tgl) }}</b><span v-if="w.bulan" class="tag t-calm">dekat fase bulan</span></td>
                <td class="small">{{ w.dari }}</td><td class="r">{{ w.hitungan }}</td>
              </tr>
            </tbody>
          </table>

          <h3 class="lbl">Uji historis 1 tahun</h3>
          <table class="ledger">
            <thead><tr><th>Fase</th><th class="r">Kejadian</th><th class="r" title="Persentase fase bulan yang diikuti titik balik IHSG dalam ±2 hari bursa">Titik balik ±2 hari</th><th class="r">Hari acak</th><th class="r">Return 5 hari</th></tr></thead>
            <tbody>
              <tr v-for="u in d.uji" :key="u.fase">
                <td>{{ IKON[u.fase] }} {{ u.fase }}</td><td class="r">{{ u.n }}</td>
                <td class="r" :class="u.balik - u.acak >= 10 ? 'c-good' : 'muted'"><b>{{ u.balik }}%</b></td><td class="r muted">{{ u.acak }}%</td>
                <td class="r small">{{ pct(u.ret5) }} <span class="muted">(naik {{ u.naik5 }}%)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="verdict">{{ d.kesimpulan }}</p>
      <p class="small muted">{{ d.catatan }}</p>
    </template>
    <RamalanRiwayat jenis="astro" />
  </section>
</template>

<style scoped>
.intro{margin:0 0 12px;max-width:95ch}
.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 10px}
.top{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px}
.big{font:700 28px/1.1 var(--f-display);margin:4px 0}
.fase{list-style:none;margin:6px 0 0;padding:0;font-size:13px}.fase li{padding:3px 0;border-bottom:1px solid var(--rule-2)}
.fase li.utama b,.fase li.dekat b{color:var(--now-ink)}
.ik{display:inline-block;width:18px;text-align:center}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.r{text-align:right}.num{font-weight:700;white-space:nowrap}
tr.kini td{background:var(--accent-soft)}
.tag{margin-left:6px}
.lbl{margin:10px 0 6px}
.rek{border:2px solid var(--now-ink);background:var(--sheet);padding:10px 14px;margin-bottom:12px}
.rt{font:700 20px var(--f-display);margin:2px 0}.rt .tag{font-size:11px;vertical-align:middle}
.rd{margin:4px 0;font-size:14px}.kf{margin:4px 0;padding-left:18px;font-size:13px}
.kl{margin-bottom:12px}.klg{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.kc{border:1px solid var(--rule);background:var(--sheet);padding:8px 10px;border-top:3px solid var(--rule)}
.kc.sup{border-top-color:var(--good)}.kc.res{border-top-color:var(--warn)}
.kc ul{margin:4px 0 0;padding-left:16px}.kt{font:700 17px var(--f-display)}
.ksup{fill:var(--good);opacity:.12}.kres{fill:var(--warn);opacity:.12}
.k.ksup{background:var(--good);opacity:.4;height:8px}.k.kres{background:var(--warn);opacity:.4;height:8px}
.proy{display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:12px;margin-bottom:12px}
.pk{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px}
.sk{margin:0;padding:10px 14px 10px 30px;border:1px solid var(--rule);background:var(--sheet);font-size:13.5px}.sk li{margin:4px 0}
.chartbox{border:1px solid var(--rule);background:var(--sheet);padding:8px 10px;margin-bottom:14px}
.chartbox svg{display:block;width:100%;height:auto}
.ax{font:10.5px var(--f-body);fill:var(--muted)}.ax.sm{font-size:9px}
.fib{stroke:var(--accent);stroke-width:1;stroke-dasharray:4 3;opacity:.55}.fib.ext{stroke:var(--warn);opacity:.5}
.ft{stroke:var(--rule);stroke-width:1}.ft.on{stroke:var(--now-ink);stroke-width:2;opacity:.6}
.mn{stroke:var(--muted);stroke-width:1;stroke-dasharray:1 3}
.moon{font-size:12px;fill:var(--ink)}
.now{stroke:var(--muted);stroke-dasharray:3 3}
.hist{fill:none;stroke:var(--ink);stroke-width:1.6}
.pj{fill:none;stroke:var(--now-ink);stroke-width:2.4;stroke-dasharray:6 4}
.pjd{fill:var(--now-ink)}.nowd{fill:var(--ink)}
.leg{margin:4px 0 0}.k{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 4px 0 10px;background:var(--ink)}
.k.pj{background:var(--now-ink)}.k.fib{background:var(--accent)}.k.mn{background:var(--muted)}.k.ft{background:var(--now-ink);opacity:.6}
@media (max-width:700px){.proy{grid-template-columns:1fr}}
.verdict{padding:8px 12px;background:var(--sheet);border-left:3px solid var(--now-ink);font-weight:600}
@media (max-width:860px){.grid2{grid-template-columns:1fr}}
</style>
