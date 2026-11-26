// Hasil audit harian Monitor (/api/audit-monitor, website/auditdata.py) dikelompokkan per emiten untuk kotak "Perlu dicek".

// Tingkat perhatian per jenis temuan: strong = kemungkinan data salah, warn = data tertinggal, calm = perlu konfirmasi.
export const TINGKAT = {
  rencana_ditolak: 'strong', batal: 'strong', to_tanpa_bukti: 'strong',
  to_belum: 'warn', to_selesai_belum: 'warn', pengendali_belum: 'warn', to_rencana: 'warn',
  catatan_usang: 'calm', rencana_belum: 'calm',
}
const URUT = { strong: 0, warn: 1, calm: 2 }

// [{t, jenis, label, teks, bukti}] -> [{t, tingkat, temuan: [...]}], emiten dengan temuan terberat di atas.
export function kelompokAudit(temuan) {
  const by = new Map()
  for (const x of temuan || []) {
    if (!x?.t) continue
    if (!by.has(x.t)) by.set(x.t, [])
    by.get(x.t).push({ ...x, tingkat: TINGKAT[x.jenis] || 'calm' })
  }
  return [...by].map(([t, xs]) => {
    xs.sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat])
    return { t, tingkat: xs[0].tingkat, temuan: xs }
  }).sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat] || a.t.localeCompare(b.t))
}
