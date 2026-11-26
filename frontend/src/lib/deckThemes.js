// Tema presentasi unduhan: dipilih sesuai bisnis emiten, dan bervariasi tiap unduhan
// (varian berbeda dari unduhan sebelumnya). Warna hex tanpa '#', font hanya yang aman di Office.

// Kelompok sektor: kata kunci dicocokkan ke teks bisnis baru/aset/sektor Stockbit. Urutan = prioritas.
export const SECTORS = [
  // Pelayaran/logistik didahulukan: perusahaan angkutan batu bara tetap bisnis pelayaran, bukan tambang.
  { id: 'logistik', label: 'Logistik & pelayaran', motif: 'waves', re: /pelayaran|kapal|shipping|logistik|logistic|pelabuhan|\bport\b|angkutan|transport|kurir|tanker|galangan|tongkang|barge/i },
  { id: 'batubara', label: 'Tambang batu bara', motif: 'strata', re: /batu ?bara|coal|thermal/i },
  { id: 'logam', label: 'Logam, mineral & manufaktur', motif: 'hex', re: /pengecoran|casting|permesinan|mekanikal|manufaktur|komponen|nikel|nickel|smelter|baterai|battery|kobalt|cobalt|bauksit|emas|gold|tembaga|copper|mineral|tambang|mining|logam/i },
  { id: 'energi', label: 'Energi & migas', motif: 'rings', re: /energi|energy|minyak|migas|oil|gas|panas bumi|geothermal|listrik|pembangkit|ebt|surya|solar|hidro/i },
  { id: 'kesehatan', label: 'Kesehatan & farmasi', motif: 'plus', re: /rumah sakit|kesehatan|klinik|farmasi|obat|medis|health|hospital|jantung|pharma/i },
  { id: 'teknologi', label: 'Teknologi & telekomunikasi', motif: 'network', re: /teknologi|technology|digital|data center|pusat data|telekomunikasi|fiber|internet|software|aplikasi|platform|\bai\b|kripto|crypto|media|hiburan|entertain/i },
  { id: 'keuangan', label: 'Keuangan & investasi', motif: 'bars', re: /bank|keuangan|finance|financial|asuransi|investasi|investment|holding|modal ventura|sekuritas|leasing|pembiayaan/i },
  { id: 'properti', label: 'Properti & konstruksi', motif: 'blocks', re: /properti|property|real estate|hotel|konstruksi|construction|kawasan|perumahan|semen|beton|baja|kontraktor|infrastruktur/i },
  { id: 'konsumer', label: 'Konsumer & pangan', motif: 'dots', re: /makanan|minuman|food|beverage|pangan|ritel|retail|restoran|kuliner|susu|dairy|udang|shrimp|perikanan|agri|sawit|cpo|kemasan|fmcg|otomotif|dealer|tekstil|garmen|furnitur|mebel/i },
  { id: 'umum', label: 'Umum', motif: 'grid', re: /.^/ },
]

// Tiga varian per sektor, semuanya palet terang yang tenang (tanpa merah, ungu, cokelat).
// dark = warna sampul, panel, dan pita kesimpulan (cukup pekat untuk teks putih); accent = angka & label;
// accent2 = sorotan muda; bg = latar slide isi; card = kartu; ink/muted = teks.
// good/warn/bad: hijau / emas / jingga (bukan merah) untuk penanda positif, waspada, dan negatif.
const T = (id, name, c) => ({ id, name, good: '16A34A', warn: 'CA8A04', bad: 'EA7317', card: 'FFFFFF', ink: '1F2937', muted: '5B6573', ...c })
export const THEMES = {
  batubara: [
    T('batubara-biru-laut', 'Biru Laut', { dark: '1D4E89', dark2: '1D4E89', accent: '2B6CB0', accent2: 'BFDBFE', bg: 'F5F9FD', line: 'DCE6F1', head: 'Cambria', body: 'Calibri' }),
    T('batubara-toska-tambang', 'Toska Tambang', { dark: '0F766E', dark2: '0F766E', accent: '0D9488', accent2: '99F6E4', bg: 'F3FAF9', line: 'D3E9E6', head: 'Century Schoolbook', body: 'Calibri' }),
    T('batubara-langit-pagi', 'Langit Pagi', { dark: '0369A1', dark2: '0369A1', accent: '0284C7', accent2: 'BAE6FD', bg: 'F4F9FD', line: 'D6E6F2', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  logam: [
    T('logam-hijau-nikel', 'Hijau Nikel', { dark: '166534', dark2: '166534', accent: '16A34A', accent2: 'BBF7D0', bg: 'F4FAF5', line: 'D7E8DB', head: 'Cambria', body: 'Calibri' }),
    T('logam-biru-kobalt', 'Biru Kobalt', { dark: '1E40AF', dark2: '1E40AF', accent: '2563EB', accent2: 'BFDBFE', bg: 'F5F8FE', line: 'D9E2F3', head: 'Century Schoolbook', body: 'Calibri' }),
    T('logam-sian-logam', 'Sian Logam', { dark: '0E7490', dark2: '0E7490', accent: '0891B2', accent2: 'A5F3FC', bg: 'F2FAFC', line: 'D1E7EC', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  energi: [
    T('energi-biru-emas-surya', 'Biru & Emas Surya', { dark: '1E3A8A', dark2: '1E3A8A', accent: 'B7791F', accent2: 'FDE68A', bg: 'F7F8FC', line: 'DDE2EE', head: 'Cambria', body: 'Calibri' }),
    T('energi-hidro', 'Hidro', { dark: '0369A1', dark2: '0369A1', accent: '0284C7', accent2: 'BAE6FD', bg: 'F4F9FD', line: 'D6E6F2', head: 'Century Schoolbook', body: 'Calibri' }),
    T('energi-hijau-energi', 'Hijau Energi', { dark: '166534', dark2: '166534', accent: '16A34A', accent2: 'BBF7D0', bg: 'F4FAF5', line: 'D7E8DB', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  kesehatan: [
    T('kesehatan-toska-medis', 'Toska Medis', { dark: '0F766E', dark2: '0F766E', accent: '0D9488', accent2: '99F6E4', bg: 'F3FAF9', line: 'D3E9E6', head: 'Cambria', body: 'Calibri' }),
    T('kesehatan-biru-klinis', 'Biru Klinis', { dark: '1E40AF', dark2: '1E40AF', accent: '2563EB', accent2: 'BFDBFE', bg: 'F5F8FE', line: 'D9E2F3', head: 'Century Schoolbook', body: 'Calibri' }),
    T('kesehatan-mint-segar', 'Mint Segar', { dark: '047857', dark2: '047857', accent: '10B981', accent2: 'A7F3D0', bg: 'F2FBF7', line: 'D1EBDF', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  teknologi: [
    T('teknologi-biru-sian', 'Biru Sian', { dark: '0E7490', dark2: '0E7490', accent: '0891B2', accent2: 'A5F3FC', bg: 'F2FAFC', line: 'D1E7EC', head: 'Cambria', body: 'Calibri' }),
    T('teknologi-biru-digital', 'Biru Digital', { dark: '1E40AF', dark2: '1E40AF', accent: '2563EB', accent2: 'BFDBFE', bg: 'F5F8FE', line: 'D9E2F3', head: 'Century Schoolbook', body: 'Calibri' }),
    T('teknologi-hijau-data', 'Hijau Data', { dark: '047857', dark2: '047857', accent: '10B981', accent2: 'A7F3D0', bg: 'F2FBF7', line: 'D1EBDF', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  keuangan: [
    T('keuangan-biru-tua-emas', 'Biru Tua & Emas', { dark: '1E3A8A', dark2: '1E3A8A', accent: 'B7791F', accent2: 'FDE68A', bg: 'F7F8FC', line: 'DDE2EE', head: 'Cambria', body: 'Calibri' }),
    T('keuangan-zamrud', 'Zamrud', { dark: '065F46', dark2: '065F46', accent: '059669', accent2: 'A7F3D0', bg: 'F2FAF6', line: 'D2E8DE', head: 'Century Schoolbook', body: 'Calibri' }),
    T('keuangan-biru-baja', 'Biru Baja', { dark: '334E68', dark2: '334E68', accent: '486581', accent2: 'BCCCDC', bg: 'F5F7FA', line: 'DAE1E8', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  logistik: [
    T('logistik-samudra', 'Samudra', { dark: '0369A1', dark2: '0369A1', accent: '0284C7', accent2: 'BAE6FD', bg: 'F4F9FD', line: 'D6E6F2', head: 'Cambria', body: 'Calibri' }),
    T('logistik-laut-toska', 'Laut Toska', { dark: '0F766E', dark2: '0F766E', accent: '0D9488', accent2: '99F6E4', bg: 'F3FAF9', line: 'D3E9E6', head: 'Century Schoolbook', body: 'Calibri' }),
    T('logistik-pelabuhan-biru', 'Pelabuhan Biru', { dark: '1E40AF', dark2: '1E40AF', accent: '2563EB', accent2: 'BFDBFE', bg: 'F5F8FE', line: 'D9E2F3', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  properti: [
    T('properti-batu-biru', 'Batu Biru', { dark: '334E68', dark2: '334E68', accent: '486581', accent2: 'BCCCDC', bg: 'F5F7FA', line: 'DAE1E8', head: 'Cambria', body: 'Calibri' }),
    T('properti-beton-hijau', 'Beton & Hijau', { dark: '166534', dark2: '166534', accent: '16A34A', accent2: 'BBF7D0', bg: 'F4FAF5', line: 'D7E8DB', head: 'Century Schoolbook', body: 'Calibri' }),
    T('properti-langit-kota', 'Langit Kota', { dark: '0369A1', dark2: '0369A1', accent: '0284C7', accent2: 'BAE6FD', bg: 'F4F9FD', line: 'D6E6F2', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  konsumer: [
    T('konsumer-daun-segar', 'Daun Segar', { dark: '166534', dark2: '166534', accent: '16A34A', accent2: 'BBF7D0', bg: 'F4FAF5', line: 'D7E8DB', head: 'Cambria', body: 'Calibri' }),
    T('konsumer-toska-segar', 'Toska Segar', { dark: '0F766E', dark2: '0F766E', accent: '0D9488', accent2: '99F6E4', bg: 'F3FAF9', line: 'D3E9E6', head: 'Century Schoolbook', body: 'Calibri' }),
    T('konsumer-biru-cerah', 'Biru Cerah', { dark: '1D4E89', dark2: '1D4E89', accent: '2B6CB0', accent2: 'BFDBFE', bg: 'F5F9FD', line: 'DCE6F1', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  umum: [
    T('umum-biru-netral', 'Biru Netral', { dark: '334E68', dark2: '334E68', accent: '486581', accent2: 'BCCCDC', bg: 'F5F7FA', line: 'DAE1E8', head: 'Cambria', body: 'Calibri' }),
    T('umum-samudra-tenang', 'Samudra Tenang', { dark: '1D4E89', dark2: '1D4E89', accent: '2B6CB0', accent2: 'BFDBFE', bg: 'F5F9FD', line: 'DCE6F1', head: 'Century Schoolbook', body: 'Calibri' }),
    T('umum-hutan-muda', 'Hutan Muda', { dark: '047857', dark2: '047857', accent: '10B981', accent2: 'A7F3D0', bg: 'F2FBF7', line: 'D1EBDF', head: 'Bookman Old Style', body: 'Arial' }),
  ],
}

// Sektor dari teks bisnis: bisnis baru (story), aset injeksi, lalu sektor/industri Stockbit, lalu nama.
export function sectorOf({ baru = '', aset = '', sektor = '', industri = '', nama = '' } = {}) {
  for (const src of [baru, aset, sektor + ' ' + industri, nama]) {
    const s = String(src || '')
    if (!s.trim()) continue
    const hit = SECTORS.find(x => x.id !== 'umum' && x.re.test(s))
    if (hit) return hit
  }
  return SECTORS.find(x => x.id === 'umum')
}

// Varian: pilihan pengguna bila ada; selain itu acak di sektor itu, tidak sama dengan unduhan sebelumnya.
export function pickTheme(sectorId, { lastId = '', choose = '', rand = Math.random } = {}) {
  const list = THEMES[sectorId] || THEMES.umum
  const all = Object.values(THEMES).flat()
  if (choose) return all.find(t => t.id === choose) || list[0]
  const pool = list.filter(t => t.id !== lastId)
  return pool[Math.floor(rand() * pool.length) % pool.length] || list[0]
}
