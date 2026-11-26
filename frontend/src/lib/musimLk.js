// Musim laporan keuangan menurut kalender batas penyampaian BEI: Jan-Mar laporan tahunan (FY tahun lalu = Q4),
// Apr-Jun Q1 (3M), Jul-Sep Q2 (1H), Okt-Des Q3 (9M). Dipakai untuk nama tab "Kinerja Qn" dan periode bawaan.
export function musimLk(now = new Date()) {
  const m = now.getMonth() + 1, y = now.getFullYear()
  const [q, kode, tahun] = m <= 3 ? [4, 'FY', y - 1] : m <= 6 ? [1, '3M', y] : m <= 9 ? [2, '1H', y] : [3, '9M', y]
  const yy = String(tahun).slice(2)
  // Pola periode laporan yang setara (mis. 1H = 6M, 3M = 1Q).
  const pola = { FY: ['FY'], '3M': ['3M', '1Q'], '1H': ['1H', '6M'], '9M': ['9M'] }[kode].map(k => k + yy)
  return { q, kode: kode + yy, tahun, pola, label: `Kinerja Q${q}`, judul: `Q${q} ${tahun} (${kode + yy})` }
}
