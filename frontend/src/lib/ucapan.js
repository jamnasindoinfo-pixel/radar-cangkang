// Pengubah teks ke ucapan bahasa Indonesia untuk narasi video (suara browser "Ardi" atau Azure). Mesin suara membaca
// angka, singkatan, dan simbol apa adanya sehingga ejaannya sering salah ("5.282", "-3,35%", "IUP", "kkal/kg").
// Di sini semuanya dijadikan kata yang diucapkan orang Indonesia: angka → terbilang, singkatan → nama huruf
// Indonesia, satuan → kata lengkap, istilah Inggris → ejaan yang terbaca wajar, tanda baca → jeda.

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

// Terbilang bilangan bulat (0 sampai < 1.000 triliun).
export function terbilang(n) {
  n = Math.floor(Math.abs(+n))
  if (n === 0) return 'nol'
  const t = x => {
    if (x < 12) return SATUAN[x]
    if (x < 20) return `${SATUAN[x - 10]} belas`
    if (x < 100) return `${SATUAN[Math.floor(x / 10)]} puluh${x % 10 ? ' ' + SATUAN[x % 10] : ''}`
    if (x < 200) return `seratus${x - 100 ? ' ' + t(x - 100) : ''}`
    if (x < 1000) return `${SATUAN[Math.floor(x / 100)]} ratus${x % 100 ? ' ' + t(x % 100) : ''}`
    if (x < 2000) return `seribu${x - 1000 ? ' ' + t(x - 1000) : ''}`
    if (x < 1e6) return `${t(Math.floor(x / 1000))} ribu${x % 1000 ? ' ' + t(x % 1000) : ''}`
    if (x < 1e9) return `${t(Math.floor(x / 1e6))} juta${x % 1e6 ? ' ' + t(x % 1e6) : ''}`
    if (x < 1e12) return `${t(Math.floor(x / 1e9))} miliar${x % 1e9 ? ' ' + t(x % 1e9) : ''}`
    return `${t(Math.floor(x / 1e12))} triliun${x % 1e12 ? ' ' + t(x % 1e12) : ''}`
  }
  return t(n)
}

// Angka format Indonesia ("5.282", "2,48", "0,05") → kata; desimal dibaca per angka ("koma empat delapan").
export function angkaKata(s) {
  const [bulat, des] = String(s).replace(/\./g, '').split(',')
  let out = terbilang(+bulat || 0)
  if (des) out += ' koma ' + (des.length === 1 || /^0/.test(des) ? [...des].map(c => c === '0' ? 'nol' : SATUAN[+c]).join(' ')
    : des.length === 2 ? terbilang(+des) : [...des].map(c => c === '0' ? 'nol' : SATUAN[+c]).join(' '))
  return out
}

// Nama huruf Indonesia untuk mengeja singkatan.
const HURUF = { A: 'a', B: 'be', C: 'ce', D: 'de', E: 'e', F: 'ef', G: 'ge', H: 'ha', I: 'i', J: 'je', K: 'ka', L: 'el', M: 'em', N: 'en', O: 'o',
  P: 'pe', Q: 'ki', R: 'er', S: 'es', T: 'te', U: 'u', V: 'fe', W: 'we', X: 'eks', Y: 'ye', Z: 'zet' }
const eja = s => [...s].map(c => HURUF[c] || c).join(' ')
// Singkatan yang lazim diucapkan sebagai kata (bukan dieja).
const KATA = { RUPS: 'rups', RUPSLB: 'rups el be', RUPST: 'rups te', EBITDA: 'ebitda', JORC: 'jork', KCMI: 'ka ce em i', ASEAN: 'asean', NASDAQ: 'nasdak',
  SPAC: 'spek', COD: 'ce o de', PHK: 'pe ha ka', BUMN: 'be u em en', SIUPAL: 'siupal', AMDAL: 'amdal', HPAL: 'ha pal', IPIP: 'i pe i pe',
  PMHMETD: 'raits isyu', PMTHMETD: 'praivet plesmen', HMETD: 'ha em e te de', PTW: 'pe te we', MTO: 'em te o', USD: 'dolar Amerika',
  BUY: 'bai', SELL: 'sel', HOLD: 'hold', AVOID: 'avoid', OVERWEIGHT: 'ouver weit', UNDERWEIGHT: 'ander weit', NEUTRAL: 'netral', WAIT: 'weit',
  CEO: 'si i o', CFO: 'si ef o', AI: 'e i' }
// Istilah Inggris → ejaan yang terbaca wajar oleh suara Indonesia.
const INGGRIS = [
  [/\bbackdoor listing\b/gi, 'bekdor listing'], [/\bbackdoor\b/gi, 'bekdor'], [/\brights issue\b/gi, 'raits isyu'], [/\bprivate placement\b/gi, 'praivet plesmen'],
  [/\btrading plan\b/gi, 'treding plen'], [/\btrading\b/gi, 'treding'], [/\bbreakout\b/gi, 'breikaut'], [/\bbreakdown\b/gi, 'breikdaun'], [/\brebound\b/gi, 'ribaun'],
  [/\bsupport\b/gi, 'sapot'], [/\bresistance\b/gi, 'resistens'], [/\bfree float\b/gi, 'fri flout'], [/\bstop loss\b/gi, 'setop los'], [/\btake profit\b/gi, 'teik profit'],
  [/\btender offer\b/gi, 'tender ofer'], [/\bholding\b/gi, 'holding'], [/\bpublic expose\b/gi, 'publik ekspos'], [/\bupside\b/gi, 'apsaid'], [/\bdownside\b/gi, 'daunsaid'],
  [/\bbullish\b/gi, 'bulis'], [/\bbearish\b/gi, 'beris'], [/\bsideways\b/gi, 'saidweis'], [/\bbear\b/gi, 'ber'], [/\bbull\b/gi, 'bul'], [/\bbase case\b/gi, 'beis keis'],
  [/\bsmart money\b/gi, 'smart mani'], [/\bwhale\b/gi, 'weil'], [/\bdata center\b/gi, 'data senter'], [/\bsmelter\b/gi, 'smelter'], [/\binbreng\b/gi, 'inbreng'],
  [/\bjoint venture\b/gi, 'join venture'], [/\bstandby buyer\b/gi, 'stendbai baier'], [/\bdue diligence\b/gi, 'dyu diligens'], [/\bgoodwill\b/gi, 'gudwil'],
  [/\bcum date\b/gi, 'kam deit'], [/\bex date\b/gi, 'eks deit'], [/\brecording date\b/gi, 'rekording deit'], [/\bhybrid\b/gi, 'haibrid'], [/\bshare swap\b/gi, 'syer swop'],
  [/\bstandby\b/gi, 'stendbai'], [/\bcut loss\b/gi, 'kat los'], [/\btarget price\b/gi, 'target prais'], [/\bupdate\b/gi, 'apdet'], [/\bbuyback\b/gi, 'baibek'],
  [/\bstock split\b/gi, 'stok split'], [/\bwaran\b/gi, 'waran'], [/\bmarket cap\b/gi, 'market kep'], [/\bcash\b/gi, 'kes'], [/\bfeedstock\b/gi, 'fidstok'],
  [/\bonline\b/gi, 'onlain'], [/\boffline\b/gi, 'oflain'], [/\bplatform\b/gi, 'platform'], [/\bfull service\b/gi, 'ful servis'], [/\bsmart aquaculture\b/gi, 'smart akuakultur'],
  // Singkatan huruf kecil yang tetap dieja.
  [/\biup\b/g, 'i u pe'], [/\biujp\b/g, 'i u je pe'], [/\brkab\b/g, 'er ka a be'], [/\bkjpp\b/g, 'ka je pe pe'],
]
// Singkatan umum yang salah dibaca mesin suara (mis. "Org" terbaca "orang", "Kab." terbaca "kab").
const SINGKAT = [
  [/\bOrg\b\.?/g, 'Organization'], [/\bCorp\b\.?/g, 'Corporation'], [/\bInc\b\.?/g, 'Incorporated'], [/\bCo\.(?=\s|$|,)/g, 'Company'],
  [/\bSdn\.?\s*Bhd\.?/g, 'Sendirian Berhad'], [/\bBhd\b\.?/g, 'Berhad'], [/\bLLC\b/g, 'el el si'], [/\bGrp\b\.?/g, 'Group'], [/\bInt'?l\b\.?/g, 'International'],
  [/\bJl\.\s*/g, 'jalan '], [/\bKab\.\s*/g, 'kabupaten '], [/\bKec\.\s*/g, 'kecamatan '], [/\bKel\.\s*/g, 'kelurahan '], [/\bProv\.\s*/g, 'provinsi '],
  [/\bDs\.\s*/g, 'desa '], [/\bKota\s+Adm\.\s*/g, 'kota administrasi '], [/\bNo\.\s*(?=\d)/g, 'nomor '],
  [/\bdll\b\.?/g, 'dan lain-lain'], [/\bdsb\b\.?/g, 'dan sebagainya'], [/\bdkk\b\.?/g, 'dan kawan-kawan'], [/\btsb\b\.?/g, 'tersebut'],
  [/\byg\b/g, 'yang'], [/\bdg\b/g, 'dengan'], [/\bdgn\b/g, 'dengan'], [/\bmis\.\s*/g, 'misalnya '], [/\bmaks\.\s*/g, 'maksimal '], [/\bmin\.\s*/g, 'minimal '],
  [/\bvs\.?(?=\s)/gi, 'versus'], [/\ba\.n\.\s*/g, 'atas nama '], [/\ba\.l\.\s*/g, 'antara lain '], [/\bu\.p\.\s*/g, 'untuk perhatian '],
  [/(\d)\s*Bn\b/g, '$1 miliar'], [/(\d)\s*bn\b/g, '$1 miliar'], [/(\d)\s*mn\b/g, '$1 juta'], [/(\d)\s*Mn\b/g, '$1 juta'],
  [/\bDr\.\s*/g, 'doktor '], [/\bIr\.\s*/g, 'insinyur '], [/\bProf\.\s*/g, 'profesor '],
]
const SATUAN_UKUR = [
  [/(\d)\s*kkal\/kg\b/gi, '$1 kilokalori per kilogram'], [/(\d)\s*juta\s*MT\b/g, '$1 juta metrik ton'], [/(\d)\s*MT\b/g, '$1 metrik ton'],
  [/(\d)\s*MMSCFD\b/g, '$1 juta kaki kubik per hari'], [/(\d)\s*MVA\b/g, '$1 mega volt ampere'], [/(\d)\s*MW\b/g, '$1 megawatt'], [/(\d)\s*GW\b/g, '$1 gigawatt'],
  [/(\d)\s*Tbps\b/g, '$1 terabit per detik'], [/(\d)\s*Gbps\b/g, '$1 gigabit per detik'], [/(\d)\s*km2\b/g, '$1 kilometer persegi'], [/(\d)\s*m²/g, '$1 meter persegi'],
  [/(\d)\s*km\b/g, '$1 kilometer'], [/(\d)\s*ha\b/g, '$1 hektare'], [/(\d)\s*kg\b/g, '$1 kilogram'], [/(\d)\s*kWh\b/g, '$1 kilowatt jam'],
  [/(\d)\s*(x|×)(?![a-z])/gi, '$1 kali'], [/(\d)\s*°/g, '$1 derajat'], [/(\d)\s*hari\/tahun/g, '$1 hari per tahun'], [/(\d)\s*ton\/tahun/g, '$1 ton per tahun'],
  [/\/ton\b/g, ' per ton'], [/\/tahun\b/g, ' per tahun'], [/\/hari\b/g, ' per hari'], [/\/bulan\b/g, ' per bulan'], [/\/saham\b/g, ' per saham'], [/\/lembar\b/g, ' per lembar'],
]
const UANG = [
  [/Rp\s?(\d(?:[\d.,]*\d)?)\s*\/\s*(USD|US\$)/g, '$1 rupiah per dolar Amerika'],
  [/S\$\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu)?/g, '$1 $2 dolar Singapura'],
  [/(USD|US\$|\$)\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu|triliun)/gi, '$2 $3 dolar Amerika'], [/(USD|US\$|\$)\s?(\d(?:[\d.,]*\d)?)/gi, '$2 dolar Amerika'],
  [/SGD\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu)?/gi, '$1 $2 dolar Singapura'], [/RMB\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu)?/gi, '$1 $2 yuan'],
  [/(EUR|€)\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu)?/gi, '$2 $3 euro'], [/AUD\s?(\d(?:[\d.,]*\d)?)\s*(miliar|juta|ribu)?/gi, '$1 $2 dolar Australia'],
  [/Rp\s?(\d(?:[\d.,]*\d)?)\s*T\b/g, '$1 triliun rupiah'], [/Rp\s?(\d(?:[\d.,]*\d)?)\s*M\b/g, '$1 miliar rupiah'], [/Rp\s?(\d(?:[\d.,]*\d)?)\s*(jt|juta)\b/g, '$1 juta rupiah'],
  [/Rp\s?(\d(?:[\d.,]*\d)?)\s*(triliun|miliar|ribu)\b/g, '$1 $2 rupiah'], [/Rp\s?(\d(?:[\d.,]*\d)?)/g, '$1 rupiah'],
]

export function speakable(text) {
  let s = String(text || '')
  // Jam "pukul 13.39" / "13:39" dibaca "pukul tiga belas lewat tiga puluh sembilan menit" (bukan angka desimal).
  s = s.replace(/\bpukul\s+(\d{1,2})[.:](\d{2})\b/gi, (_, h, m) => `pukul ${Number(h)}` + (Number(m) ? ` lewat ${Number(m)} menit` : ' tepat'))
  // Pengali bahasa Inggris (Bn/mn) dijadikan kata lebih dulu agar pola uang membacanya ("USD1,2 Bn" → "1,2 miliar dolar Amerika").
  s = s.replace(/(\d)\s*[Bb]n\b/g, '$1 miliar').replace(/(\d)\s*[Mm]n\b/g, '$1 juta')
  // Tanggal ISO dan penanda kuartal/semester.
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => `${+d} ${BULAN[+m - 1] || m} ${y}`)
  s = s.replace(/\bQ([1-4])\b/g, (_, q) => `kuartal ${['satu', 'dua', 'tiga', 'empat'][q - 1]}`).replace(/\b([1-2])H\b/g, (_, h) => `semester ${h === '1' ? 'satu' : 'dua'}`)
  // Angka Romawi setelah kuartal/semester/tahap/fase/seri ("Kuartal IV", "PMHMETD II").
  const ROMAWI = { I: 'satu', II: 'dua', III: 'tiga', IV: 'empat', V: 'lima', VI: 'enam' }
  s = s.replace(/\b(kuartal|semester|tahap|fase|seri|triwulan|jilid|bab)\s+(I{1,3}|IV|VI?)\b/gi, (_, k, r) => `${k} ${ROMAWI[r.toUpperCase()]}`)
  s = s.replace(/\b(PMHMETD|PMTHMETD|HMETD|Rights Issue)\s+(I{1,3}|IV|V)\b/g, (_, k, r) => `${k} ${ROMAWI[r]}`)
  // Singkatan bulan setelah tanggal ("1 Okt 2026" → "1 Oktober 2026").
  const BLN3 = { Jan: 'Januari', Feb: 'Februari', Mar: 'Maret', Apr: 'April', Jun: 'Juni', Jul: 'Juli', Agu: 'Agustus', Agt: 'Agustus', Ags: 'Agustus', Sep: 'September', Sept: 'September', Okt: 'Oktober', Nov: 'November', Des: 'Desember' }
  s = s.replace(/(\d)\s+(Jan|Feb|Mar|Apr|Jun|Jul|Agu|Agt|Ags|Sept?|Okt|Nov|Des)\b\.?/g, (_, d, b) => `${d} ${BLN3[b]}`)
  // Rentang antartanggal/kata bulan ("Maret–16 April") dan tanda pisah panjang sebagai jeda.
  s = s.replace(/(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s*[–-]\s*(?=\d)/g, '$1 hingga ')
  // Rentang ("Rp11–Rp49", "1–2%") terbaca "hingga"; "s.d." = sampai dengan.
  s = s.replace(/(\d)\s*[–-]\s*(Rp\s?|USD\s?)?(\d)/g, '$1 hingga $2$3').replace(/\bs\.d\.?/gi, 'sampai dengan').replace(/\s*[—–]\s*/g, ', ')
  for (const [rx, r] of UANG) s = s.replace(rx, r)
  for (const [rx, r] of SATUAN_UKUR) s = s.replace(rx, r)
  // Persen dengan tanda: "+1,1%" → "plus satu koma satu persen".
  s = s.replace(/(^|[\s(])\+\s?(?=\d)/g, '$1plus ').replace(/(^|[\s(])[−-]\s?(?=\d)/g, '$1minus ').replace(/(\d)\s*%/g, '$1 persen')
  // Simbol & tanda baca → kata atau jeda.
  s = s.replace(/\s*@\s*/g, ' pada harga ').replace(/\s*=\s*/g, ' sama dengan ').replace(/≈/g, ' sekitar ').replace(/\s*×\s*/g, ' kali ')
    .replace(/\s+\+\s+|(?<=[A-Za-z])\+(?=[A-Za-z])/g, ' dan ').replace(/%/g, ' persen')
  s = s.replace(/→|->/g, ' menjadi ').replace(/≥/g, ' minimal ').replace(/≤/g, ' maksimal ').replace(/±|~/g, ' sekitar ').replace(/&/g, ' dan ')
    .replace(/\s*[·|•]\s*/g, ', ').replace(/\s*\(\s*/g, ', ').replace(/\s*\)\s*/g, ', ').replace(/\s*;\s*/g, ', ')
    .replace(/([A-Za-z])\/([A-Za-z])/g, '$1 atau $2').replace(/\s*\/\s*/g, ' per ').replace(/["“”]/g, '')
  s = s.replace(/\bTbk\.?/g, 'te be ka').replace(/\bPte\.?\s*Ltd\.?/g, 'pi ti i limited').replace(/\bLtd\.?/g, 'limited').replace(/\bPT\b\.?/g, 'pe te')
  for (const [rx, r] of SINGKAT) s = s.replace(rx, r)
  for (const [rx, r] of INGGRIS) s = s.replace(rx, r)
  s = s.replace(/\b([A-Z]{1,5})(\d{1,3})\b/g, (_, h, n) => `${KATA[h] || eja(h)} ${n}`)
  // Singkatan/kata huruf kapital (2–12 huruf, mis. PMTHMETD, UNDERWEIGHT): kata lazim atau dieja per huruf Indonesia.
  s = s.replace(/\b[A-Z]{2,12}\b/g, w => KATA[w] || eja(w))
  // Angka → kata (setelah semua pola satuan/uang ditangani).
  s = s.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g, m => angkaKata(m))
  return s.replace(/\s+,/g, ',').replace(/,\s*,+/g, ',').replace(/\s+/g, ' ').replace(/^,\s*/, '').replace(/,\s*([.!?])/g, '$1').trim()
}
