// Pemantau dokumen: keterbukaan material (Stockbit Reports) yang terbit setelah analisa dokumen terakhir
// (ri-dokumen.json, kolom asOf), atau dalam 120 hari terakhir bila emiten belum punya analisa dokumen.
// Tujuannya agar keterbukaan penting (mis. siaran pers perkembangan akuisisi) tidak terlewat dari analisa.

export const MATERIAL = /press rilis|siaran pers|fakta material|informasi material|transaksi|akuisisi|pengambilalihan|inbreng|HMETD|penilai|perjanjian|kegiatan usaha|nota kesepahaman|\bmou\b|divestasi|tender|pengendali|permintaan penjelasan|penambahan modal|prospektus|pernyataan efektif|private placement|penempatan terbatas|restrukturisasi|keterbukaan informasi/i
export const ROUTINE = /pemberitahuan rencana|panggilan|pemanggilan|ringkasan risalah|penggunaan dana|jadwal|bukti iklan|laporan bulanan|volatilitas|dividen|pengunduran diri|perubahan susunan|logo/i

const day = d => String(d || '').slice(0, 10)

// updates: store.updates; doc: entri ri-dokumen emiten (boleh null). Hasil: terbaru dulu.
export function dokumenBaru(t, updates, doc, { days = 120, today = new Date() } = {}) {
  const since = doc?.asOf || new Date(today.getTime() - days * 864e5).toISOString().slice(0, 10)
  return (updates || [])
    .filter(u => u.ticker === t && /^sb-report-/.test(String(u.id)) && day(u.date) > since && MATERIAL.test(u.title || '') && !ROUTINE.test(u.title || ''))
    .sort((a, b) => day(b.date).localeCompare(day(a.date)))
}
