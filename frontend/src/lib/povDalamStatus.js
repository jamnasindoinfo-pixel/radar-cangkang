// Status analisa mendalam POV dari /api/pov-dalam: kapan meminta tarik ulang, kapan terus memantau, dan teks cakupan.

// Analisa tersimpan yang ketinggalan data baru diminta ditarik ulang sekali per pembukaan (hasil lama tetap tampil).
export function pdPerluTarikUlang(st, sudahDiminta) {
  return !!(st && st.status === 'selesai' && st.basi && !st.segarkan && !st.galatSegar && !sudahDiminta)
}

// Dipantau tiap beberapa detik selama ada pekerjaan berjalan (analisa pertama atau tarik ulang).
export function pdPerluPantau(st) {
  return !!(st && (st.status === 'jalan' || st.segarkan))
}

export function pdCakupan(c) {
  if (!c?.total) return ''
  const sisa = Math.max(0, c.total - c.tersimpan)
  return `Analisa tersimpan: ${c.tersimpan} dari ${c.total} saham BEI` +
    (sisa ? `; ${sisa} lainnya ditarik bertahap di latar.` : '.')
}
