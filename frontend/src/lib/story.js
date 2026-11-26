// Story emiten: bisnis lama → baru, pengendali lama, injeksi aset, nominal, target (port deriveStory dari app.js lama).
// Prioritas: koreksi manual (item.story) > data terverifikasi (story-verified.json) > deteksi otomatis dari laporan.
import { fmtDate, progressOf, dealOf } from './domain.js'

const BIZ_RE = /kegiatan usaha|KBLI|bidang usaha|maksud dan tujuan|beralih|transformasi|bisnis baru|model bisnis|fokus bisnis|lini bisnis|ekspansi ke|masuk ke (sektor|bisnis|industri)|perubahan nama|menjadi (platform|pemain|penyedia|perusahaan|superholding|holding)/i;
const INJ_RE = /inbreng|penyetoran.*selain uang|HMETD|PMTHMETD|rights issue|private placement|penempatan terbatas|akuisisi|akusisi|pengambilalihan (saham|grup|PT|\w+ dan)|CSPA|PPJB|penyertaan|suntikan/i;
// Jenis aset yang diinjeksi, dari kata kunci (urutan penting: yang spesifik dulu).
const ASSET_TYPES = [
  [/batu ?bara|\bcoal\b/i, "Tambang batu bara"], [/nikel|nickel/i, "Tambang nikel"], [/\bemas\b|\bgold\b/i, "Tambang emas"],
  [/tambang|pertambangan|mining|mineral|bauksit|tembaga/i, "Tambang"],
  [/rumah sakit|\bRS\b|medika|klinik|hospital|kesehatan/i, "Rumah sakit / kesehatan"],
  [/data ?cent(er|re)|pusat data/i, "Data center"], [/\bAI\b|[Kk]ecerdasan buatan|[Aa]rtificial [Ii]ntelligence/, "Infrastruktur AI"], // "AI" harus huruf besar
  [/telekomunikasi|\btelko|menara|tower|fiber optik|tellink/i, "Telekomunikasi"],
  [/udang|shrimp|akuakultur|aquaculture|perikanan|tambak/i, "Akuakultur"],
  [/sawit|perkebunan|\bCPO\b|agribisnis/i, "Perkebunan"],
  [/minyak|\bmigas\b|\bgas bumi|LNG|energi|EBT|PLT[SUBAG]|listrik|\bpower\b|solar/i, "Energi"],
  [/properti|real estat|real estate|hotel|kawasan industri|apartemen/i, "Properti"],
  [/pelayaran|kapal|shipping|logistik|transportasi/i, "Logistik / pelayaran"],
  [/teknologi|digital|software|platform|aplikasi/i, "Teknologi"],
  [/makanan|minuman|\bF&B\b|food/i, "Makanan & minuman"],
  [/fintech|\bbank\b|asuransi|multifinance|pembiayaan/i, "Keuangan"],
  [/konstruksi|infrastruktur|jalan tol/i, "Konstruksi / infrastruktur"],
  [/superholding|holding|perusahaan afiliasi/i, "Holding (perusahaan afiliasi)"],
];
const assetTypeOf = text => (ASSET_TYPES.find(([re]) => re.test(text || "")) || [])[1] || "";
// Nama perusahaan target pertama yang bukan emiten itu sendiri, mis. "PT Aztech Pandu Persada".
const targetCoOf = (text, d) => {
  const own = (d.name || "").toUpperCase().replace(/^PT\.?\s*|\s*TBK\.?$/g, "").trim();
  // Kata nama: huruf kapital di depan lalu huruf kecil (Aztech), atau singkatan pendek (PAA, GMP). "Tbk" tidak dihitung.
  const W = "(?!Tbk\\b|TBK\\b)(?:[A-Z][a-z][\\w&.\\-]*|[A-Z]{2,5}\\b)";
  for (const m of String(text || "").matchAll(new RegExp(`\\b(PT|Grup|grup)\\s+(${W}(?:\\s+${W}){0,4})`, "g"))) {
    const nm = m[2].replace(/[.,]$/, "");
    if (own && own.includes(nm.toUpperCase().split(" ")[0])) continue;
    return (m[1].toLowerCase() === "grup" ? "Grup " : "PT ") + nm;
  }
  // Singkatan target tanpa "PT", mis. "75% saham BTL" (bukan kode emiten itu sendiri).
  const ab = String(text || "").match(/saham\s+([A-Z]{2,6})\b/);
  if (ab && ab[1] !== d.ticker && !/^(HMETD|PMTHMETD|PMHMETD|CSPA|PPJB|RUPS|RUPSLB|BEI|OJK|IDX)$/.test(ab[1])) return ab[1];
  return "";
};

// Laporan "rencana/strategi" lebih informatif daripada tanggapan rutin; dipakai untuk memilih laporan terbaik.
// Laporan rutin/administratif (bukti iklan, perkembangan negosiasi, tanggapan bursa) berisi sedikit informasi baru.
const LOW_INFO = /bukti iklan|perkembangan negosiasi|volatilitas|permintaan penjelasan|laporan bulanan|penggunaan dana/i;
const isInformative = u => !LOW_INFO.test(u.title || "");
const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const sentenceWith = (text, re) => (String(text || "").split(/(?<=[.!?])\s+/).find(s => re.test(s)) || "").trim();
export const nominalOf = text => {
  // Ambil nominal rupiah terbesar dari teks, mis. "Rp1,54 triliun", "Rp 87,67 miliar".
  let best = null;
  const num = s => parseFloat(s.replace(/\.(?=\d{3})/g, "").replace(",", "."));
  const UNIT = { triliun: 1e12, t: 1e12, miliar: 1e9, m: 1e9, juta: 1e6, billion: 1e9, million: 1e6, bn: 1e9, mn: 1e6 };
  for (const m of String(text || "").matchAll(/Rp\s?([\d.,]+)\s?(triliun|miliar|juta|T|M)\b/gi)) {
    const v = num(m[1]) * (UNIT[m[2].toLowerCase()] || 1);
    if (!best || v > best.v) best = { v, txt: m[0].replace(/\s+/g, " ") };
  }
  // Catatan: kurs 16.000 di sini berbeda dengan KURS.USD 16.500 di analysis.js (dibiarkan seperti versi lama).
  // Nilai dalam dolar AS (kurs kasar Rp16.000 hanya untuk membandingkan besarnya; teks asli yang ditampilkan).
  for (const m of String(text || "").matchAll(/(?:US\$|USD)\s?([\d.,]+)\s?(miliar|juta|billion|million|bn|mn)\b/gi)) {
    const v = num(m[1]) * (UNIT[m[2].toLowerCase()] || 1) * 16000;
    if (!best || v > best.v) best = { v, txt: m[0].replace(/\s+/g, " ") };
  }
  return best;
};
const futureDateOf = text => {
  const today = new Date().toISOString().slice(0, 10); let best = null;
  const consider = (iso, txt) => { if (iso >= today && (!best || iso < best.iso)) best = { iso, txt }; };
  for (const m of String(text || "").matchAll(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(20\d\d)/gi))
    consider(`${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, m[0]);
  // Kuartal / semester, mis. "kuartal pertama 2027", "Q1 2027", "2H 2026": dipakai akhir periodenya.
  const QEND = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };
  const qn = s => ({ pertama: 1, i: 1, kedua: 2, ii: 2, ketiga: 3, iii: 3, keempat: 4, iv: 4 }[s.toLowerCase()] || +s);
  for (const m of String(text || "").matchAll(/(?:kuartal|triwulan)\s+(pertama|kedua|ketiga|keempat|IV|III|II|I|[1-4])\s+(?:tahun\s+)?(20\d\d)|\bQ([1-4])\s?(20\d\d)/gi)) {
    const q = qn(m[1] || m[3]), y = m[2] || m[4]; if (q >= 1 && q <= 4) consider(`${y}-${QEND[q]}`, m[0]);
  }
  for (const m of String(text || "").matchAll(/\b([12])H\s?(20\d\d)|semester\s+(pertama|kedua|I{1,2})\s+(?:tahun\s+)?(20\d\d)/gi)) {
    const h = m[1] ? +m[1] : (/kedua|II/i.test(m[3]) ? 2 : 1), y = m[2] || m[4]; consider(`${y}-${h === 1 ? "06-30" : "12-31"}`, m[0]);
  }
  return best;
};

export function deriveStory(d, { verified = {}, updates = [] } = {}) {
  // Item mentah (tanpa prog/deal hasil penilaian) tetap bisa dipakai.
  if (!d.prog || !d.deal) { const prog = d.prog || progressOf(d); d = { ...d, prog, deal: d.deal || dealOf(d, prog) }; }
  const a = d.storyAuto || {}, man = d.story || {};
  const reps = updates.filter(u => u.ticker === d.ticker).sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  const txt = u => `${u.title}. ${u.summary || ""} ${u.points || ""}`;
  // Bersihkan teks: label "(Ringkasan AI Stockbit)" dan nama emiten sendiri (mis. "SMKM (Sumber Mas Konstruksi)")
  // supaya tidak terbaca sebagai jenis aset atau nama target.
  const core = (d.name || "").replace(/^PT\.?\s*|\s*Tbk\.?$/gi, "").trim();
  const clean = s => String(s || "").replace(/\(Ringkasan AI Stockbit\)/gi, " ").replace(/\b[A-Z]{4}\s*\([^)]*\)/g, " ")
    .replace(core ? new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : /$^/, " ");
  // Bisnis lama: industri di profil + kalimat "bergerak di bidang" dari latar belakang.
  const lamaAuto = a.industry ? `${a.industry}${a.subSector && a.subSector !== a.industry ? " · " + a.subSector : ""}` : "";
  const lamaNote = sentenceWith(a.background, /bergerak|kegiatan usaha|bidang usaha|usaha utama/i) || "";
  // Bisnis baru: kalimat dari laporan/berita/catatan yang menyebut perubahan kegiatan usaha atau injeksi aset.
  // Pilih laporan TERBARU yang cocok, melewati laporan rutin; bila hanya ada laporan rutin, pakai yang terbaru.
  // (reps sudah urut tanggal terbaru dulu)
  const best = re => { const m = reps.filter(u => re.test(txt(u))); return m.find(isInformative) || m[0]; };
  const bizRep = best(BIZ_RE);
  const injRep = best(INJ_RE);
  const baruAuto = (bizRep && sentenceWith(bizRep.summary, BIZ_RE)) || sentenceWith(d.notes, /bergeser|beralih|bisnis|usaha/i) || (bizRep ? bizRep.title : "");
  const injAuto = (injRep && (sentenceWith(injRep.summary, INJ_RE) || injRep.title)) || "";
  // Nominal hanya dari laporan injeksi terpilih, atau laporan/berita lain yang menyebut TARGET YANG SAMA.
  // Angka dari laporan lain (mis. harga beli saham oleh pengendali, nilai PTW) tidak dipakai.
  let nominal = injRep ? nominalOf(txt(injRep)) : null;
  const injTarget = injRep ? targetCoOf(clean(txt(injRep)), d) : "";
  if (!nominal && injTarget) {
    const key = injTarget.replace(/^(PT|Grup)\s+/, "");
    nominal = nominalOf(reps.filter(u => u !== injRep && txt(u).includes(key)).map(txt).join(" "));
  }
  // Target: pembayaran PTW bila masih proses, jadwal terdekat di laporan, atau katalis berikutnya.
  let targetAuto = "";
  if (d.deal === "proses" && d.tender?.paydate) targetAuto = `Pembayaran PTW ${fmtDate(d.tender.paydate)}`;
  else {
    // Jadwal terdekat yang disebut laporan terkait transformasi/injeksi (mis. "kuartal pertama 2027").
    // Utamakan jadwal di laporan injeksi aset terpilih; bila tidak ada, laporan transformasi/injeksi lain.
    const f = (injRep && futureDateOf(txt(injRep))) || futureDateOf(reps.filter(u => BIZ_RE.test(txt(u)) || INJ_RE.test(txt(u))).map(txt).join(" "));
    if (f) targetAuto = f.txt.charAt(0).toUpperCase() + f.txt.slice(1);
  }
  const old = (a.oldControllers || [])[0];
  // Ringkasan singkat injeksi: jenis aset (+ perusahaan target). Teks injeksi dulu, lalu bisnis baru sebagai cadangan.
  const injText = clean(man.inject || injAuto), injAll = clean(injRep ? txt(injRep) : injText);
  let injType = assetTypeOf(injText) || assetTypeOf(injAll) || assetTypeOf(clean(man.baru || baruAuto)) ||
    (/inbreng|penyetoran.*selain uang/i.test(injText || injAll) ? "Inbreng saham" :
     /HMETD|rights issue|PMTHMETD|private placement|penempatan terbatas/i.test(injAll) ? "Penambahan modal" :
     /pinjaman/i.test(injAll) ? "Pinjaman ke afiliasi" :
     /CSPA|PPJB|pengambilalihan|akuisisi|akusisi/i.test(injAll) ? "Akuisisi (aset belum disebut)" : "Aksi korporasi");
  let injCo = targetCoOf(injText, d) || targetCoOf(injAll, d);
  // Data terverifikasi (story-verified.json, hasil pengecekan Stockbit Reports) mengalahkan data otomatis;
  // koreksi manual tetap paling atas. Bila terverifikasi, nominal/target kosong berarti memang belum disebut.
  const v = verified[d.ticker];
  const vSrc = v && v.sourceDate ? { date: v.sourceDate, title: v.sourceTitle || "Stockbit Reports", url: `https://stockbit.com/symbol/${d.ticker}` } : null;
  if (v && !man.inject) { injType = v.injectType || ""; injCo = v.injectTarget || ""; }
  if (v && !man.nominal) nominal = v.nominal ? { txt: v.nominal } : null;
  if (v && !man.target && !(d.deal === "proses" && d.tender?.paydate)) targetAuto = v.target || "";
  return {
    injType, injCo, verified: !!v, vSrc, vNote: v?.note || "",
    lama: man.lama || lamaAuto, lamaNote: man.lama ? "" : lamaNote, lamaEdited: !!man.lama,
    baru: man.baru || (v ? v.baru : baruAuto), baruSrc: man.baru ? null : (v ? (v.baru ? vSrc : null) : (bizRep || null)), baruEdited: !!man.baru,
    oldName: man.oldName || v?.oldName || (a.oldControllers || []).map(o => o.name).slice(0, 3).join(", "),
    oldPct: man.oldPct != null && man.oldPct !== "" ? +man.oldPct : v?.oldPct != null ? +v.oldPct
      : (a.oldControllers || []).slice(0, 3).reduce((s, o) => s + (o.before || 0), 0) || null,
    oldInferred: !man.oldName && !v?.oldName && !!old?.inferred, oldEdited: !!man.oldName,
    takeoverDate: v?.takeoverDate || a.takeover?.date,
    // Terverifikasi: injeksi hanya bila memang disebut di laporan; detail = kalimat laporan terbaru bila ada.
    inject: man.inject || (v ? (v.injectType ? (injAuto || [v.injectType, v.injectTarget].filter(Boolean).join(" · ")) : "") : injAuto),
    injectEdited: !!man.inject, injectSrc: man.inject ? null : (v ? vSrc : (injRep || null)),
    nominal: man.nominal || (nominal ? nominal.txt : ""), nominalEdited: !!man.nominal,
    // "Transaksi tuntas" hanya bila progres memang 100%; emiten tahap awal tanpa tonggak berikutnya belum punya jadwal.
    target: man.target || targetAuto || (d.prog?.next ? "Belum ada jadwal · berikutnya: " + d.prog.next.label
      : (d.prog?.pct ?? 0) >= 100 ? "Transaksi tuntas" : "Belum ada jadwal transaksi"), targetEdited: !!man.target,
    loaded: !!d.storyAuto,
  };
}
