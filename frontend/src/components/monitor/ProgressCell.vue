<script setup>
import { MILESTONES, fmtDate } from '../../lib/domain.js'

// Bar penyelesaian + katalis berikutnya + rincian bobot tahapan dan asal datanya.
// kjpp = data KJPP dari aset-verified (status, tanggalLaporan, nama).
const props = defineProps({ prog: Object, kjpp: Object })
function srcOf(m, ok) {
  const k = props.kjpp
  if (m.id === 'kjpp' && k) {
    // Dicentang karena injeksi sudah dieksekusi (inbreng wajib berdasar laporan KJPP) walau dokumennya tidak ditemukan.
    if (ok && k.status !== 'terbit') return 'dianggap terbit: injeksi sudah dieksekusi, dokumen laporan tidak ditemukan'
    if (k.status === 'terbit') return `terbit${k.tanggalLaporan ? ' ' + fmtDate(k.tanggalLaporan) : ''}${k.nama ? ' · ' + k.nama : ''}`
    return k.status === 'ditunjuk' ? `KJPP${k.nama ? ' ' + k.nama : ''} ditunjuk, laporan belum terbit` : 'belum ada penunjukan KJPP'
  }
  const a = props.prog.auto?.[m.id]
  return ok && a ? 'terdeteksi dari laporan ' + fmtDate(String(a).slice(0, 10)) : ''
}
</script>

<template>
  <div class="pc">
    <div class="row"><span class="n">{{ prog.pct }}%</span><span class="pbar" :class="{ est: prog.est }"><i :style="{ width: prog.pct + '%' }"></i></span></div>
    <small class="muted">{{ prog.est ? 'Estimasi berbasis tahap; tahapan transaksi belum terverifikasi'
      : prog.next ? 'Katalis berikutnya: ' + prog.next.label : prog.pct >= 100 ? 'Transaksi tuntas (pascatransaksi)' : 'Belum ada jadwal transaksi' }}</small>
    <details v-if="!prog.est" class="det">
      <summary>Rincian {{ prog.pct }}%</summary>
      <p v-if="prog.noInject" class="muted small">Akuisisi strategis tanpa rencana injeksi: dihitung dari tahapan pengambilalihan saja.</p>
      <ul>
        <li v-for="m in (prog.applicable || MILESTONES)" :key="m.id" :class="prog.ms[m.id] ? 'ok' : 'no'">
          <span class="mk" :aria-label="prog.ms[m.id] ? 'Tercapai' : 'Belum'"></span>
          <b>{{ m.w }}%</b>
          <span>{{ m.label }}<em v-if="srcOf(m, !!prog.ms[m.id])">{{ srcOf(m, !!prog.ms[m.id]) }}</em></span>
        </li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.pc{min-width:220px;max-width:300px}
.row{display:flex;align-items:center;gap:8px}
.n{font:700 16px var(--f-display);min-width:38px}
.pbar{flex:1;height:6px;border-radius:3px;background:var(--rule-2);overflow:hidden}
.pbar i{display:block;height:100%;background:var(--accent);border-radius:3px}
.pbar.est i{background:repeating-linear-gradient(90deg,var(--accent) 0 4px,transparent 4px 7px)}
small{display:block;font-size:12px;line-height:1.35;margin-top:2px}
.det summary{cursor:pointer;font-size:12px;color:var(--accent);margin-top:3px}
.det ul{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:3px;font-size:12px}
.det li{display:grid;grid-template-columns:12px 30px 1fr;gap:6px;align-items:baseline}
.det li.no{color:var(--ink-2)}
.det em{display:block;font-style:normal;color:var(--ink-2);font-size:11.5px}
/* Penanda tercapai: lingkaran terisi dengan centang; belum: lingkaran kosong. */
.mk{width:11px;height:11px;border-radius:50%;border:1.5px solid var(--rule);align-self:start;margin-top:3px;position:relative}
.ok .mk{background:var(--accent);border-color:var(--accent)}
.ok .mk::after{content:"";position:absolute;left:3px;top:1px;width:3px;height:5px;border:solid var(--accent-ink);border-width:0 1.5px 1.5px 0;transform:rotate(45deg)}
</style>
