import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { hscPdf, hscPdfName } from '../hscPdf.js'

// Data contoh berbentuk /api/hsc-analisa + hsc.json + /api/harga-saham.
const per = { '1D': { median: -1.2, naik: 30, n: 82 }, '1W': { median: -3, naik: 25, n: 82 }, '1M': { median: -9, naik: 20, n: 82 }, YTD: { median: -15, naik: 18, n: 82 } }
const a = {
  ihsg: 5015, ihsgSumber: 'Live', updated: '2026-10-29', bulanBroker: 'Oktober',
  bank4: { dari: 24.33, ke: 27.45, kode: ['BBCA', 'BBRI', 'BMRI', 'BBNI'], ret: { '1D': -1, '1W': -2, '1M': -4, YTD: -6 }, sens: 13.8 },
  penggerak: [{ t: 'BBCA', dari: 8.75, ke: 9, harga: 7000, ret: { d: -1, w: -2, m: -3, y: -4 }, poin: { d: -0.5, w: -0.9, m: -1.4, y: -1.8 }, poinLama: { d: -0.4, w: -0.9, m: -1.3, y: -1.8 }, arus: { asing: -2e11 } },
    { t: 'BBNI', dari: 2.08, ke: 2.5, turunan: true, harga: 4000, ret: { d: null, w: 1, m: 2, y: 3 }, poin: { d: null, w: 0.1, m: 0.3, y: 0.4 }, poinLama: { d: null, w: 0.1, m: 0.2, y: 0.3 }, arus: null }],
  skenario: [-3, -2, -1, 1, 2, 3].map(g => ({ gerak: g, poin: g * 13.8, level: 5015 + g * 13.8 })),
  keranjang: { hsc: per, non: per }, terburuk: [{ t: 'BREN', m: -33.1 }], terbaik: [{ t: 'AGAR', m: 12 }], sorot: [{ t: 'BREN', m: -33.1 }],
  narasi: [{ judul: 'Apa yang berubah', teks: 'Bobot bergeser.' }, { judul: 'Yang perlu dipantau', poin: ['Rupiah', 'Asing'] }],
  exHsc: [{ periode: '1M', ihsg: -5, hsc: -9, ex: -4.1, selisih: 0.9 }], bobotHsc: 18,
  sektor: [{ sektor: 'Energi', n: 3, m: -10, kode: ['BREN', 'BYAN', 'DSSA'] }], asingBeli: [{ t: 'BREN', asing: 3e10 }], asingJual: [],
  kesimpulan: [{ nada: 'turun', teks: 'Big-4 bank bergerak −2,0% sepekan; setara −27,6 poin IHSG.' }, { nada: 'netral', teks: 'Hari terakhir: 30% saham HSC naik.' }],
}
const h = {
  berlaku: '2 November 2026', kode: Array.from({ length: 82 }, (_, i) => 'K' + String(i).padStart(3, '0')), nama: { K000: 'Contoh Tbk' },
  analisa: { ringkas: 'BEI menyesuaikan divisor.', fakta: ['Fakta 1'], implikasi: ['Implikasi 1'] },
}

describe('hscPdf', () => {
  it('membuat PDF berhalaman banyak dengan daftar 82 saham', async () => {
    const doc = await hscPdf(a, h, { K000: { h: 1000, d: 1.5 } }, jsPDF)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6)
    expect(hscPdfName()).toMatch(/^Riset-IHSG_Tanpa-HSC_\d{4}-\d\d-\d\d\.pdf$/)
  })
})
