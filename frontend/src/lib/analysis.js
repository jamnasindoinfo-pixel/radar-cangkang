// Analisa Emiten (port buildAnalysis dari app.js lama). Kerangka: enam dimensi (pengendali, substansi aset,
// posisi harga, struktur, katalis, fundamental), masing-masing 0–10, lalu disintesis menjadi sikap,
// tesis naik/turun, skenario harga, dan daftar periksa.
import { num, fmt, fmtDate, rp, big, x2, stageOf } from './domain.js'

// Kurs asumsi untuk mengonversi nominal injeksi valas.
// Catatan: story.js (nominalOf) memakai kurs USD 16.000 untuk membandingkan besaran; di sini 16.500. Dibiarkan seperti versi lama.
export const KURS = { USD: 16500, SGD: 12700 }
// "Rp14,57 T", "maks. USD125 juta", "±USD100 juta (PAA) + Rp172,25 M" → total rupiah (null bila tak ada angka).
export function nominalRp(s) {
  if (!s) return null
  let total = 0, hit = false
  const re = /(Rp|USD|US\$|SGD)\s?([\d.,]+)\s*(triliun|miliar|juta|million|T|M)?/gi
  // Isi dalam kurung adalah padanan/keterangan (mis. "USD100 juta (±Rp1,6 T)"), bukan nilai tambahan.
  for (const m of String(s).replace(/\([^)]*\)/g, '').matchAll(re)) {
    const v = parseFloat(m[2].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    if (isNaN(v)) continue
    const u = (m[3] || '').toLowerCase()
    const mult = u === 't' || u === 'triliun' ? 1e12 : u === 'm' || u === 'miliar' ? 1e9 : u === 'juta' || u === 'million' ? 1e6 : 1
    const cur = m[1].toUpperCase().replace('US$', 'USD')
    total += v * mult * (KURS[cur] || 1); hit = true
  }
  return hit ? total : null
}
export const clamp10 = v => Math.max(0, Math.min(10, Math.round(v * 10) / 10))
const pct0 = v => v == null ? '–' : (v >= 0 ? '+' : '') + Math.round(v * 100) + '%'
const normName = s => String(s || '').toUpperCase().replace(/\bPT\.?\s*|\bTBK\.?|[.,]/g, ' ').replace(/\s+/g, ' ').trim()
const RED_RE = /(dilusi|dilutif|leverage|tanpa RUPS|deportasi|gagal kuorum|ekuitas (induk )?negatif|tidak jelas|bertentangan|ditahan OJK|OJK (sedang )?(memeriksa|menahan)|suspensi|diskon|utang pemegang saham|tanpa penjelasan|tersangka|red flag)/i
const GOOD_RE = /(strategic buyer|pembeli strategis|akuisisi strategis|tercatat di LSE|bayar tunai|tunai di harga sekitar pasar|aset riil|kredibel|Sinar Mas|Grup Astra|FrieslandCampina)/i
const NEG_GOOD = /(tidak|kurang|belum|bukan) (\w+ )?kredibel/i
const HI_SIGNAL = /(transaksi material|perubahan kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penempatan terbatas)/i
const NOISE = /(volatilitas|permintaan penjelasan bursa)/i
// Pecah kalimat tanpa memotong singkatan nama badan hukum (Pte., Ltd., Tbk., B.V., Co.).
export const sentences = s => String(s || '').split(/(?<!\b(?:Pte|Ltd|Co|Tbk|Inc|B\.V|No|dkk|mis|Jl|maks|min|dll|dst|vs|s\.d)\.)(?<=\.)\s+(?=[A-Z0-9(])/).filter(Boolean)

// Input: profile = respons /api/profile, reports = laporan emiten (urut terbaru dulu), insider = /api/insider,
// quote = /api/quote, benchmark = data pembanding (deals); verified/pengendali/pandangan = peta per kode, analisa = analisa.json.
// Catatan satuan: item.mcap tersimpan dalam Rp miliar, sedangkan profile.stats.marketCap dalam rupiah (karena itu × 1e9).
// Bobot sintesis skor: mencerminkan apa yang terbukti menggerakkan harga backdoor (aset & pengendali).
export const W = { "Pengendali": 0.25, "Substansi aset": 0.25, "Posisi harga": 0.2, "Struktur & likuiditas": 0.1, "Katalis": 0.1, "Fundamental": 0.1 };

export function buildAnalysis({ ticker: t, item: d, profile: p, reports: reps = [], insider: ins = null, quote: qt = null,
  verified = {}, pengendali = {}, pandangan = {}, analisa = null, benchmark: bm = null }) {
  const m = p.metrics || {}, st = p.stats || {};
  // Harga: penutupan terbaru dari grafik Stockbit (lebih mutakhir dari harga tersimpan saat sinkron terakhir).
  const lastBar = p.chart?.length ? p.chart[p.chart.length - 1] : null;
  const price = lastBar?.v ?? num(d?.price);
  const priceDate = lastBar?.d || "";
  const mcap = st.marketCap ?? (num(d?.mcap) != null ? num(d.mcap) * 1e9 : null);
  const flt = st.freeFloat ?? num(d?.float);
  const sv = verified[t], pv = pengendali[t];
  const ctrlH = (p.shareholders || []).filter(h => h.pengendali);
  // Pengendali terverifikasi (pengendali-verified.json) mengalahkan badge profil Stockbit yang bisa tertinggal.
  const ctrlPct = pv?.ctrlPct != null ? num(pv.ctrlPct) : ctrlH.length ? ctrlH.reduce((s, h) => s + (parseFloat(h.pct) || 0), 0) : num(d?.ctrlPct);
  const ctrlName = pv?.ctrlName || ctrlH.map(h => h.name).join(", ") || d?.ctrlName || "";
  const deal = bm?.deals?.find(r => r.ticker === t);
  const tender = d?.tender?.price ? d.tender : null;
  const ms = d?.ms || {};
  const isRadar = !!d && stageOf(d) !== "radar";
  const pvText = pv ? [pv.siapa, pv.grup, pv.rencana, pv.catatan].join(" ") : "";
  const injRp = nominalRp(sv?.nominal);
  const injRatio = injRp && mcap ? injRp / mcap : null;
  // Injeksi dianggap tereksekusi bila ditandai di story-verified.json (executed) atau tahapannya tercapai.
  const executed = !!(sv?.executed || ms.inbreng || ms.bisnis);
  const foreignSpv = /\b(PTE|LTD|LIMITED|B\.V\.|INC|HOLDINGS? LIMITED)\b/i.test(ctrlName) && !/^PT\b/i.test(ctrlName.trim());
  const notTaker = !!pv?.bukanPengambilAlih;
  const now = new Date().toISOString().slice(0, 10);
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const rep30 = reps.filter(r => String(r.date) >= d30);
  const hi30 = rep30.filter(r => HI_SIGNAL.test(r.title) && !NOISE.test(r.title));
  const noise30 = rep30.filter(r => NOISE.test(r.title));
  const ptwActive = tender && tender.start <= now && now <= (tender.paydate || tender.end || tender.start);
  const vsPtw = tender && price ? price / tender.price : null;
  const toPeak = deal && price ? deal.peak / price - 1 : (m.high52 && price ? m.high52 / price - 1 : null);
  const loss = m.netIncomeTtm != null && m.netIncomeTtm < 0;
  const negEq = m.equity != null && m.equity < 0;
  const redLines = pv ? sentences(pv.catatan + " " + pv.grup).filter(s => RED_RE.test(s)) : [];
  // Kalimat positif hanya dihitung bila tidak sekaligus memuat red flag atau penyangkalan.
  const goodLines = pv ? sentences(pvText).filter(s => GOOD_RE.test(s) && !RED_RE.test(s) && !NEG_GOOD.test(s)) : [];
  const dims = [], bull = [], bear = [], checks = [], exits = [];
  // Langkah hitung tiap dimensi (ditampilkan saat nilai diklik): set = nilai ditetapkan, v = tambah/kurang.
  const mk = () => { const st = []; return { st, set: (v, t) => { st.push({ t, set: v }); return v; }, add: (v, t) => { st.push({ t, v }); return v; } }; };

  // Pergerakan pemegang ≥5% (365 hari): pengendali menambah/menjual, dan penjual besar lain (mis. pengendali lama).
  // Keterbukaan ≥5% berhenti begitu porsi turun di bawah 5%, sehingga porsi terakhir bisa basi. Pemegang yang tidak
  // lagi tercantum di daftar pemegang ≥5% Stockbit ditandai below5 (porsi kini di bawah 5%).
  const curKeys = (p.shareholders || []).map(h => normName(h.name)).filter(k => k.length > 3);
  const listedNow = n => curKeys.some(k => n.includes(k) || k.includes(n));
  // Porsi terkini diambil dari daftar pemegang ≥1% KSEI bila tercantum di sana.
  const one = (p.holders1 || []).map(h => ({ ...h, key: normName(h.name) }));
  const nowPct = n => one.find(h => h.key.length > 3 && (n.includes(h.key) || h.key.includes(n)))?.pct ?? null;
  const holders = (ins?.holders || []).map(h => {
    if (!curKeys.length || h.to < 5 || listedNow(normName(h.name))) return h;
    return { ...h, below5: true, now: nowPct(normName(h.name)) };
  });
  const ctrlKeys = ctrlName.split(/,\s*(?=[A-Z])/).map(normName).filter(k => k.length > 3);
  const isCtrlH = h => { const n = normName(h.name); return ctrlKeys.some(k => n.includes(k) || k.includes(n)); };
  const ctrlMoves = holders.filter(isCtrlH);
  const ctrlNet = ctrlMoves.reduce((s, h) => s + (h.change || 0), 0);
  const ctrlAddedLater = ctrlMoves.some(h => h.from > 0 && h.change > 0.5);
  const bigSellers = holders.filter(h => !isCtrlH(h) && h.change <= -2);
  // Likuiditas: nilai transaksi harian rata-rata dan hari untuk keluar dari posisi Rp100 juta (maks. 20% volume harian).
  const avgVal = qt?.avgVolume && (qt.price || price) ? qt.avgVolume * (qt.price || price) : null;
  const exitDays = avgVal ? 1e8 / (0.2 * avgVal) : null;

  // 1. Pengendali: siapa, kredibilitas, keselarasan kepentingan.
  {
    let s = 5; const why = []; const c = mk(); c.set(5, "Nilai awal");
    if (ctrlNet < -1) {
      s += c.add(-3, "Pengendali mengurangi porsi lebih dari 1 poin dalam 365 hari"); why.push(`Pengendali mengurangi porsi ${fmt(ctrlNet, 2)} poin dalam 365 hari.`);
      bear.push(`Pengendali menjual: porsi turun ${fmt(-ctrlNet, 2)} poin — sinyal terkuat bahwa insider tidak sepakat dengan harga pasar.`);
      exits.push("Pengendali melanjutkan penjualan saham di pasar.");
    } else if (ctrlAddedLater) {
      s += c.add(1, "Pengendali menambah porsi setelah masuk"); why.push("Pengendali menambah porsi setelah masuk.");
      bull.push("Pengendali menambah porsi lewat pasar setelah akuisisi — keselarasan kepentingan dengan publik.");
    }
    if (!isRadar) { s = c.set(5, "Bukan saham backdoor di radar"); why.push("Bukan saham backdoor di radar; dinilai dari struktur kepemilikan."); }
    if (notTaker) { s += c.add(-1, "Transaksi pengendali belum/tidak terjadi"); why.push("Nama di kolom pengendali adalah pengendali lama/penjual — transaksi belum/tidak terjadi."); }
    if (goodLines.length) { s += c.add(3, "Ada pembeli kredibel/strategis"); why.push("Ada indikasi pembeli kredibel/strategis."); bull.push("Pengendali kredibel: " + goodLines[0]); }
    if (foreignSpv) { s += c.add(-2, "Pengendali SPV luar negeri"); why.push("Pengendali SPV luar negeri (median 0,78× harga PTW di 9 transaksi)."); bear.push("Pengendali SPV luar negeri; UBO dan rekam jejak di Indonesia lebih sulit diverifikasi."); }
    else if (ctrlName && isRadar) { s += c.add(1, "Pengendali badan usaha dalam negeri/perorangan"); why.push("Pengendali badan usaha dalam negeri/perorangan."); }
    if (redLines.length) { s += c.add(-Math.min(4, redLines.length * 1.5), `${redLines.length} catatan risiko pengendali (−1,5 per catatan, maks. −4)`); redLines.slice(0, 3).forEach(l => bear.push(l)); }
    if (pv && /tidak diungkap/i.test(pv.grup)) { s += c.add(-1, "Latar belakang grup/UBO tidak diungkap"); why.push("Latar belakang grup/UBO tidak diungkap."); }
    dims.push({ k: "Pengendali", s: clamp10(s), why, steps: c.st, raw: s });
  }
  // 2. Substansi aset: besar-kecil injeksi terhadap kapitalisasi dan status eksekusinya.
  {
    let s; const why = []; const c = mk();
    if (sv?.injectType) {
      if (injRatio != null) {
        s = c.set(injRatio >= 1 ? 8 : injRatio >= 0.3 ? 6 : 3, `Injeksi ${x2(injRatio)} kapitalisasi (≥1× = 8; 0,3–1× = 6; <0,3× = 3)`);
        why.push(`Injeksi ${sv.nominal} ≈ ${x2(injRatio)} kapitalisasi pasar.`);
        if (injRatio >= 1) bull.push(`Injeksi ${sv.injectTarget || sv.injectType} (${sv.nominal}) setara ${x2(injRatio)} kapitalisasi — bila dieksekusi di valuasi wajar, skala usaha berubah total.`);
        if (injRatio < 0.3) bear.push(`Injeksi kecil (${sv.nominal}, ${x2(injRatio)} kapitalisasi): kelompok injeksi kecil median 0,68× harga PTW.`);
      } else { s = c.set(4, "Injeksi diumumkan tanpa nilai"); why.push("Injeksi diumumkan tetapi nilainya belum disebut."); bear.push("Nilai injeksi belum disebut: pasar memperdagangkan harapan, bukan aset."); }
      if (executed) { s += c.add(2, "Injeksi/konsolidasi sudah tercapai"); why.push("Tahapan injeksi/konsolidasi sudah tercapai."); }
      else { why.push("Belum dieksekusi: injeksi besar yang baru diumumkan median 0,78× vs 2,24× setelah eksekusi."); checks.push("Laporan penilai independen (KJPP) atas aset injeksi dan kelipatan valuasinya terhadap emiten sejenis."); }
    } else if (isRadar) {
      s = c.set(m.netIncomeTtm > 0 ? 6 : 2, m.netIncomeTtm > 0 ? "Tanpa injeksi, usaha laba" : "Tanpa injeksi, usaha belum laba");
      why.push(m.netIncomeTtm > 0 ? "Tanpa injeksi, tetapi usaha berjalan dan laba — lebih mirip akuisisi strategis." : "Belum ada injeksi aset yang diumumkan: nilai bertumpu pada rencana pengendali.");
      if (!(m.netIncomeTtm > 0)) bear.push("Belum ada aset yang diumumkan untuk diinjeksikan.");
    } else {
      s = c.set(m.netIncomeTtm > 0 ? 6 : 3, m.netIncomeTtm > 0 ? "Bukan backdoor, usaha laba" : "Bukan backdoor, usaha belum laba");
      why.push("Tidak ada transaksi backdoor tercatat; dinilai dari usaha yang berjalan.");
    }
    dims.push({ k: "Substansi aset", s: clamp10(s), why, steps: c.st, raw: s });
  }
  // 3. Posisi harga: terhadap harga PTW (biaya pengendali), siklus, dan kenaikan pra-PTW.
  {
    let s = 5; const why = []; const c = mk(); c.set(5, "Nilai awal");
    if (vsPtw != null) {
      s = c.set(vsPtw <= 1 ? 7 : vsPtw <= 1.3 ? 6 : vsPtw <= 2 ? 4 : 2, `Harga ${x2(vsPtw)} harga PTW (≤1× = 7; ≤1,3× = 6; ≤2× = 4; >2× = 2)`);
      why.push(`Harga ${x2(vsPtw)} harga PTW (${rp(tender.price)}).`);
      if (vsPtw < 1) { why.push("Di bawah biaya masuk pengendali: pasar meragukan eksekusi, tetapi risiko turun lebih terbatas."); bull.push(`Harga ${pct0(vsPtw - 1)} di bawah harga PTW — pengendali membayar lebih mahal dari pasar hari ini.`); }
      if (vsPtw > 2) bear.push(`Harga sudah ${x2(vsPtw)} harga PTW: optimisme besar sudah dibayar di muka.`);
    }
    if (deal) {
      why.push(`Kenaikan pra-rumor ke puncak ${x2(deal.runupX)}; harga kini ${x2(deal.postX)} harga saat PTW.`);
      if (deal.runupX >= 13) { s += c.add(-2, `Kenaikan pra-PTW ${x2(deal.runupX)} (≥13×)`); bear.push(`Kenaikan pra-PTW ${x2(deal.runupX)}: kelompok ≥13× median hanya 0,85× harga PTW sesudahnya.`); }
      if (price && deal.peak) why.push(`Jarak ke puncak siklus ${pct0(deal.peak / price - 1)}.`);
    } else if (m.high52 && m.low52 && price) {
      const pos = (price - m.low52) / (m.high52 - m.low52 || 1);
      why.push(`Posisi dalam rentang 52 minggu: ${Math.round(pos * 100)}% (terendah ${rp(m.low52)}, tertinggi ${rp(m.high52)}).`);
      s = c.set(pos < 0.3 ? 6 : pos > 0.8 ? 3 : 5, `Posisi ${Math.round(pos * 100)}% dalam rentang 52 minggu (<30% = 6; >80% = 3; lainnya 5)`);
    }
    if (m.pbv != null) { why.push(`PBV ${x2(m.pbv)}.`); if (m.pbv > 5) { s += c.add(-1, `PBV ${x2(m.pbv)} (>5×)`); bear.push(`Valuasi ${x2(m.pbv)} nilai buku — jauh di atas aset yang ada sekarang.`); } }
    dims.push({ k: "Posisi harga", s: clamp10(s), why, steps: c.st, raw: s });
  }
  // 4. Struktur: porsi publik, konsentrasi, dilusi.
  {
    let s = 6; const why = []; const c = mk(); c.set(6, "Nilai awal");
    if (flt != null) {
      why.push(`Porsi publik ${fmt(flt, 2)}%; pengendali ${ctrlPct != null ? fmt(ctrlPct, 2) + "%" : "–"}.`);
      if (flt < 7.5) { s = c.set(2, `Porsi publik ${fmt(flt, 2)}% (<7,5%, wajib refloat)`); bear.push(`Porsi publik ${fmt(flt, 2)}% di bawah 7,5%: wajib refloat — pasokan saham, biasanya dengan diskon.`); checks.push("Jadwal dan harga refloat (penjualan kembali saham ke publik)."); }
      else if (flt < 15) { s = c.set(4, `Porsi publik ${fmt(flt, 2)}% (<15%)`); why.push("Porsi publik tipis: harga mudah digerakkan, sulit keluar saat ramai jual."); }
      else if (flt > 50) { s = c.set(6, `Porsi publik ${fmt(flt, 2)}% (>50%)`); why.push("Porsi publik besar: pengendali minoritas, kendali kurang kuat."); }
      else s = c.set(7, `Porsi publik ${fmt(flt, 2)}% (15–50%)`);
    }
    if (/dilusi|HMETD|penempatan terbatas|private placement|konversi utang/i.test(pvText + " " + (sv?.injectType || ""))) {
      s += c.add(-1.5, "Rencana/riwayat penerbitan saham baru"); why.push("Ada rencana/riwayat penerbitan saham baru (HMETD/penempatan terbatas/konversi).");
      checks.push("Harga pelaksanaan saham baru dibanding harga pasar, dan apakah pengendali menyetor uang segar di harga yang sama dengan publik.");
    }
    if (bigSellers.length) {
      s += c.add(-1, "Pemegang besar non-pengendali melepas saham");
      const h = bigSellers[0];
      why.push(`${bigSellers.length} pemegang besar non-pengendali melepas saham.`);
      bear.push(`${h.name} melepas ${fmt(h.from, 2)}% → ${fmt(h.to, 2)}% (${h.sells}× jual, terakhir ${fmtDate(h.lastDate)}): pasokan dari pemegang lama menekan harga.`);
    }
    if (avgVal != null) {
      why.push(`Nilai transaksi harian rata-rata ${big(avgVal)}; keluar dari posisi Rp100 juta ±${exitDays < 1 ? "<1" : fmt(exitDays, 0)} hari (20% volume).`);
      if (avgVal < 5e8) { s += c.add(-1.5, "Transaksi harian rata-rata < Rp500 juta"); bear.push(`Likuiditas tipis: transaksi harian rata-rata ${big(avgVal)} — posisi sulit dikeluarkan saat sentimen berbalik.`); }
    }
    dims.push({ k: "Struktur & likuiditas", s: clamp10(s), why, steps: c.st, raw: s });
  }
  // 5. Katalis: jadwal yang bisa mengubah nilai dalam waktu dekat.
  {
    let s = 3; const why = []; const c = mk(); c.set(3, "Nilai awal");
    const tgt = sv?.target || "";
    if (ptwActive) { s += c.add(3, "PTW sedang berjalan"); why.push(`PTW sedang berjalan (pembayaran ${fmtDate(tender.paydate || tender.end)}).`); exits.push("Setelah PTW tuntas penopang harga hilang — waspadai pelemahan bila tidak ada katalis lanjutan."); }
    if (tgt) { s += c.add(2, "Ada target/jadwal berikutnya"); why.push("Target/jadwal berikutnya: " + tgt + "."); }
    const rups = (pv?.rencana || "").match(/RUPSLB?[^.;]*?\d{1,2} \w+ 20\d\d/);
    if (rups) { s += c.add(1, "Jadwal RUPSLB tercantum"); why.push(rups[0] + "."); checks.push("Hasil " + rups[0].replace(/\s+/g, " ") + "."); }
    if (hi30.length) { s += c.add(Math.min(2, hi30.length * 0.5), `${hi30.length} laporan bersinyal tinggi 30 hari (+0,5 per laporan, maks. +2)`); why.push(`${hi30.length} laporan bersinyal tinggi dalam 30 hari.`); }
    if (noise30.length >= 2) why.push(`${noise30.length} penjelasan volatilitas/permintaan bursa dalam 30 hari — harga sudah bergerak, belum tentu nilai.`);
    dims.push({ k: "Katalis", s: clamp10(s), why, steps: c.st, raw: s });
  }
  // 6. Fundamental saat ini.
  {
    let s = 5; const why = []; const c = mk(); c.set(5, "Nilai awal (data laba belum tersedia)");
    if (negEq) { s = c.set(1, "Ekuitas negatif"); bear.push("Ekuitas negatif: tanpa injeksi aset, perseroan tidak punya penyangga."); }
    else if (loss) { s = c.set(3, "Rugi bersih TTM"); why.push(`Rugi bersih TTM ${big(-m.netIncomeTtm).replace("Rp", "−Rp")}.`); }
    else if (m.netIncomeTtm > 0) { s = c.set(7, "Laba bersih TTM"); why.push(`Laba bersih TTM ${big(m.netIncomeTtm)}.`); if (m.per) why.push(`PER ${x2(m.per)}.`); }
    if (m.revGrowth) why.push(`Pertumbuhan pendapatan YoY ${m.revGrowth}.`);
    if (m.cash != null && mcap) why.push(`Kas ${big(m.cash)} (${Math.round(m.cash / mcap * 100)}% kapitalisasi).`);
    dims.push({ k: "Fundamental", s: clamp10(s), why, steps: c.st, raw: s });
  }

  // Sintesis: bobot mencerminkan apa yang terbukti menggerakkan harga backdoor (aset & pengendali).
  const score = Math.round(dims.reduce((s, x) => s + x.s * W[x.k], 0) * 10);
  const stance = score >= 65 ? { id: "good", t: "Asimetri positif — layak dipelajari lebih dalam" }
    : score >= 45 ? { id: "warn", t: "Netral — tunggu konfirmasi katalis" }
    : { id: "bad", t: "Spekulatif tinggi — risiko lebih besar dari potensi keuntungan" };

  // Skenario harga dari level emiten sendiri.
  const levels = [];
  if (price) {
    const bearLv = tender && tender.price < price ? tender.price : deal?.base ?? m.low52 ?? null;
    const bearLbl = tender && tender.price < price ? "Kembali ke harga PTW (biaya masuk pengendali)" : deal ? "Kembali ke harga pra-rumor (rencana tidak dieksekusi)" : "Kembali ke terendah 52 minggu";
    if (bearLv) levels.push(["Skenario turun", bearLbl, bearLv]);
    if (deal?.base && bearLv !== deal.base) levels.push(["Skenario terburuk", "Harga pra-rumor: kembali ke cangkang", deal.base]);
    const bullLv = deal?.peak ?? m.high52 ?? null;
    if (bullLv && bullLv > price) levels.push(["Skenario naik", deal ? "Kembali ke puncak siklus backdoor" : "Kembali ke tertinggi 52 minggu", bullLv]);
    // PTW di atas harga kini tetap ditampilkan sebagai acuan biaya masuk pengendali.
    if (tender && tender.price >= price) levels.push(["Harga PTW", "Biaya masuk pengendali — kini di atas harga pasar", tender.price]);
    if (m.bvps) levels.push(["Nilai buku", "PBV 1× (aset saat ini)", m.bvps]);
  }
  const down = levels.find(l => l[0] === "Skenario turun"), up = levels.find(l => l[0] === "Skenario naik");
  const rr = down && up && price > down[2] ? (up[2] - price) / (price - down[2]) : null;
  if (rr != null) (rr >= 2 ? bull : bear).push(`Rasio risk/reward ${rr.toFixed(1).replace(".", ",")} : 1 (naik ke ${rp(up[2])} vs turun ke ${rp(down[2])}).`);

  // Tesis satu paragraf.
  const parts = [];
  if (isRadar) parts.push(`${t} adalah ${notTaker ? "emiten dengan perubahan pengendali yang belum tuntas" : "saham backdoor"}${sv?.baru ? ` yang bertransformasi ke ${/^[A-Z][a-z]/.test(sv.baru) ? sv.baru[0].toLowerCase() + sv.baru.slice(1) : sv.baru}` : ""}.`);
  else parts.push(`${t} (${[p.sector, p.industry].filter(Boolean).join(" · ") || "sektor tidak tersedia"}) tidak tercatat sebagai transaksi backdoor di radar.`);
  if (pv?.siapa) parts.push(sentences(pv.siapa)[0]);
  if (sv?.injectType) parts.push(injRatio != null ? `Inti nilainya ada pada ${sv.injectTarget || sv.injectType} senilai ${sv.nominal} (≈${x2(injRatio)} kapitalisasi), ${executed ? "yang sudah dieksekusi" : "yang belum dieksekusi"}.` : `Injeksi ${sv.injectTarget || sv.injectType} diumumkan tanpa nilai.`);
  if (vsPtw != null) parts.push(`Harga kini ${x2(vsPtw)} harga PTW.`);
  if (isRadar) {
    parts.push(score >= 65 ? "Kombinasi pengendali, aset, dan harga memberi asimetri yang layak diteliti — dengan disiplin pada daftar periksa." : score >= 45 ? "Ceritanya ada, tetapi bukti belum cukup: biarkan katalis yang membuktikan, bukan harga." : "Terlalu banyak yang harus berjalan benar; risiko kehilangan modal lebih besar dari potensinya.");
  } else {
    // Saham di luar radar: nilai kemungkinan menjadi cangkang/target pengambilalihan.
    const shell = (mcap && mcap < 5e11 ? 1 : 0) + (ctrlPct >= 60 ? 1 : 0) + (loss || negEq ? 1 : 0) + (price && price <= 100 ? 1 : 0);
    parts.push(`Indikator profil cangkang: ${shell}/4 (kapitalisasi < Rp500 M, pengendali ≥60%, merugi/ekuitas negatif, harga ≤ Rp100).`);
    parts.push(shell >= 3 ? "Profil cangkang kuat: kandidat target backdoor, tetapi tanpa pengumuman perubahan pengendali ini spekulasi murni — tunggu PPJB atau keterbukaan resmi." : shell === 2 ? "Sebagian ciri cangkang terpenuhi; pantau keterbukaan perubahan pengendali, anomali volume, dan UMA." : "Bukan profil cangkang: nilai saham ini ditentukan kinerja usahanya, bukan cerita pengambilalihan — gunakan analisa fundamental biasa.");
  }

  // Daftar periksa & sinyal keluar standar.
  if (tender) exits.push(`Harga ditutup di bawah ${rp(tender.price)} (harga PTW) secara konsisten: pasar menolak rencana pengendali.`);
  exits.push("RUPSLB/transaksi ditunda berulang, atau nilai penilai jauh di bawah nilai yang diumumkan.");
  exits.push("Pengendali atau afiliasinya menjual saham di pasar, atau porsi pengendali menyusut tanpa penjelasan.");
  checks.push("Laporan keuangan pertama yang mengonsolidasikan usaha baru: laba bersih aset baru dibanding kapitalisasi pasar.");
  if (pv?.catatan) { const pantau = pv.catatan.match(/Pantau ([^.]+)\./i); if (pantau) checks.unshift("Pantau " + pantau[1] + "."); }

  const notes = analisa ? Object.entries(analisa).filter(([k]) => k !== "_info").flatMap(([, a]) => (a.pantau || []).filter(x => x.t === t).map(x => x.txt)) : [];
  return { holders, isCtrlH, avgVal, exitDays, pa: pandangan[t] || null,
    shares: st.shares ?? (mcap && price ? mcap / price : null), equity: m.equity ?? null,
    t, d, p, price, priceDate, mcap, flt, ctrlPct, ctrlName, sv, pv, deal, tender, dims, score, stance, bull, bear, checks: [...new Set(checks)], exits: [...new Set(exits)], levels, rr, thesis: parts.join(" "), reps: reps.slice(0, 8), hi30, notes, injRp };
}
