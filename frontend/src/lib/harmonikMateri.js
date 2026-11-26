// Materi presentasi tab "Materi" halaman Harmonic Pattern, disusun seperti presentasi makalah/penelitian:
// Pendahuluan, Landasan Teori dan Pembahasan Pola (ringkasan Bab 1–12 Scott M. Carney, Harmonic Trading Vol. 1,
// terjemahan Indonesia; di materiCarney16.js dan materiCarney712.js), Metodologi (cara halaman ini bekerja),
// Penerapan di Saham BEI, Penutup, dan Lampiran (daftar periksa, rencana belajar). Semua ditulis ulang dengan
// kata sendiri. Data murni.
//
// Skema slide: id, bagian, judul, sub, paragraf [..], poin [..], tabel { kolom, baris }, pola (diagram ideal:
// kunci POLA harmonikAlat atau 'abcd'), alat (tombol "Coba di chart"), rujukan, periksa/belajar (bisa dicentang).
import { BAB_1_6 } from './materiCarney16.js'
import { BAB_7_12 } from './materiCarney712.js'
import { POLA_TAMBAHAN } from './materiPolaTambahan.js'

export const BAGIAN = ['Pendahuluan', 'Landasan Teori', 'Pembahasan Pola', 'Eksekusi dan Manajemen', 'Metodologi', 'Penerapan di Saham BEI', 'Penutup', 'Lampiran']

const PENDAHULUAN = [
  {
    id: 'judul', bagian: 'Pendahuluan', judul: 'Harmonic Pattern pada Saham Bursa Efek Indonesia',
    sub: 'Kajian Harmonic Trading Vol. 1 (Scott M. Carney) dan penerapannya di Radar Backdoor',
    paragraf: [
      'Harmonic Pattern adalah pola harga lima titik (X, A, B, C, D) yang divalidasi dengan rasio Fibonacci untuk menemukan zona tempat harga berpeluang berbalik arah, lengkap dengan batas rugi dan target yang bisa dihitung sebelum transaksi.',
      'Presentasi ini merangkum dua belas bab buku Harmonic Trading Vol. 1 karya Scott M. Carney, lalu menjelaskan bagaimana konsepnya diterapkan secara otomatis pada saham Bursa Efek Indonesia (BEI) di halaman ini.',
      'Susunannya mengikuti format makalah: latar belakang dan rumusan masalah, landasan teori, pembahasan tiap pola, eksekusi dan manajemen posisi, metodologi penerapan, penerapan pada saham BEI, lalu kesimpulan dan saran.',
    ],
    tabel: { kolom: ['Bagian', 'Isi'], baris: [
      ['I. Pendahuluan', 'Apa itu Harmonic Pattern, latar belakang, rumusan masalah, tujuan, ruang lingkup'],
      ['II. Landasan Teori', 'Perdagangan harmonis, rasio Fibonacci, identifikasi pola (Bab 1–3)'],
      ['III. Pembahasan Pola', 'AB=CD, Bat, Gartley, Crab, Butterfly (Bab 4–8), lalu pola tambahan: Alternate Bat, Shark, 5-0, Three Drives'],
      ['IV. Eksekusi dan Manajemen', 'Eksekusi, aksi harga di PRZ, manajemen, pelanggaran pola (Bab 9–12)'],
      ['V. Metodologi', 'Data, deteksi swing, pencocokan rasio, konfirmasi, rencana posisi'],
      ['VI. Penerapan di Saham BEI', 'Penyesuaian karakter BEI dan cara membaca hasil'],
      ['VII. Penutup', 'Kesimpulan, keterbatasan, saran, daftar pustaka'],
    ] },
  },
  {
    id: 'apa', bagian: 'Pendahuluan', judul: 'Apa itu Harmonic Pattern?', sub: 'Definisi, fungsi, dan arti tiap titik',
    paragraf: [
      'Harmonic Pattern adalah pola grafik harga berbentuk lima titik (X, A, B, C, D) yang panjang tiap gelombangnya saling berhubungan dengan rasio Fibonacci tertentu. Bila semua rasio itu terpenuhi, titik D menandai zona tempat harga berpeluang besar berbalik arah, yang disebut PRZ (Potential Reversal Zone).',
      'Akar polanya dari H.M. Gartley (1935); Scott M. Carney kemudian menetapkan rasio yang presisi untuk tiap pola dan menyusunnya menjadi metode Harmonic Trading. Pola dibaca dari aksi harga saja, tanpa bergantung pada berita.',
    ],
    poin: [
      'Fungsi 1: menemukan area beli (pola bullish) atau area jual dan ambil untung (pola bearish) sebelum harga sampai di sana.',
      'Fungsi 2: menentukan stop loss yang objektif, yaitu batas tempat pola dinyatakan batal.',
      'Fungsi 3: menentukan target terukur (retracement 0,382 dan 0,618 kaki AD) serta menghitung rasio untung-rugi dan jumlah lot sebelum transaksi.',
    ],
    pola: 'gartley', alat: 'xabcd', rujukan: 'Carney, Bab 1 dan 3',
  },
  {
    id: 'istilah', bagian: 'Pendahuluan', judul: 'Arti setiap titik dan istilah', sub: 'Bahasa dasar untuk membaca semua pola',
    tabel: { kolom: ['Istilah', 'Keterangan'], baris: [
      ['X', 'Titik awal pola: swing low untuk pola bullish, swing high untuk pola bearish'],
      ['A', 'Ujung gerak pertama; kaki XA menjadi penggaris semua rasio'],
      ['B', 'Koreksi dari kaki XA; rasio B paling menentukan jenis pola'],
      ['C', 'Koreksi dari kaki AB'],
      ['D', 'Titik akhir pola, tempat harga diperkirakan berbalik'],
      ['PRZ', 'Zona di sekitar D tempat beberapa angka Fibonacci bertemu; area entry'],
      ['Bullish / bearish', 'D berupa lembah (potensi naik) / D berupa puncak (potensi turun)'],
      ['Retracement / ekstensi', 'D di dalam kaki XA (Gartley, Bat) / D melewati X (Butterfly, Crab)'],
    ] },
    pola: 'gartley', rujukan: 'Carney, Bab 3',
  },
  {
    id: 'latar', bagian: 'Pendahuluan', judul: 'Latar belakang', sub: 'Mengapa pendekatan harmonik relevan untuk saham',
    paragraf: [
      'Pergerakan harga saham sering tampak acak, sehingga banyak keputusan beli dan jual diambil berdasarkan perasaan, rumor, atau mengikuti keramaian. Akibatnya titik masuk, batas rugi, dan target sering tidak ditentukan sebelum transaksi.',
      'Harmonic trading menawarkan kerangka yang terukur: struktur harga tertentu dikenali, lalu divalidasi dengan rasio Fibonacci yang spesifik. Dari struktur itu diperoleh zona pembalikan potensial (PRZ), batas batal pola, dan target yang semuanya dapat dihitung di depan.',
      'Buku Carney banyak memakai contoh pasar Amerika Serikat dan berbagai instrumen. Saham BEI memiliki karakter sendiri, seperti fraksi harga, batas auto reject, likuiditas yang timpang antarsaham, dan keterbatasan short selling, sehingga penerapannya perlu disesuaikan.',
    ],
  },
  {
    id: 'rumusan', bagian: 'Pendahuluan', judul: 'Rumusan masalah', sub: 'Pertanyaan yang dijawab presentasi ini',
    poin: [
      'Bagaimana struktur dan aturan rasio pola harmonik (AB=CD, Bat, Gartley, Crab, Butterfly) menurut Carney?',
      'Bagaimana menentukan zona pembalikan potensial (PRZ) dan mengeksekusi transaksi di zona itu?',
      'Bagaimana mengelola posisi setelah entry dan mengenali pola yang gagal?',
      'Bagaimana pola harmonik dideteksi secara otomatis pada saham BEI, dan apa batasannya?',
    ],
  },
  {
    id: 'tujuan', bagian: 'Pendahuluan', judul: 'Tujuan dan manfaat', sub: 'Yang ingin dicapai dan siapa yang terbantu',
    paragraf: [
      'Tujuan presentasi ini adalah menjelaskan aturan pola harmonik secara lengkap, menunjukkan cara mengeksekusi dan mengelolanya, serta memaparkan metode deteksi otomatis yang dipakai di halaman ini beserta penyesuaiannya untuk saham BEI.',
    ],
    tabel: { kolom: ['Pihak', 'Manfaat'], baris: [
      ['Investor dan trader saham', 'Kerangka keputusan yang terukur: entry, stop loss, dan target ditentukan sebelum transaksi'],
      ['Tim Radar Backdoor', 'Screening pola harian untuk seluruh saham likuid BEI dan analisa per saham yang konsisten'],
      ['Pembelajar', 'Materi berurutan dari teori, contoh, sampai latihan langsung di chart'],
    ] },
  },
  {
    id: 'lingkup', bagian: 'Pendahuluan', judul: 'Ruang lingkup dan batasan', sub: 'Apa yang dibahas dan apa yang tidak',
    poin: [
      'Objek: saham yang tercatat di BEI, memakai candle harian (1 tahun) dan mingguan (3 tahun) dari Stockbit; candle bulanan disusun dari candle mingguan.',
      'Pola utama dari Carney: AB=CD, Bat, Gartley, Crab, dan Butterfly. Halaman ini juga mengenali Alternate Bat, Deep Crab, Cypher, Shark, 5-0, dan Three Drives dari sumber pelengkap.',
      'Elliott wave dan EMA50/EMA200 dipakai sebagai konteks tren, bukan syarat pola.',
      'Timeframe intraday (menit atau jam) tidak dibahas karena datanya tidak tersedia di sumber yang dipakai.',
      'Materi ini adalah bahan belajar analisa teknikal, bukan saran membeli atau menjual efek.',
    ],
  },
]

const METODOLOGI = [
  {
    id: 'm-data', bagian: 'Metodologi', judul: 'Data dan sumber', sub: 'Candle Stockbit dan screening malam',
    paragraf: [
      'Analisa per saham memakai candle harian satu tahun terakhir untuk timeframe 1D, dan candle mingguan tiga tahun untuk 1W. Candle bulanan (1M) disusun dari candle mingguan, sehingga minggu yang melewati pergantian bulan dihitung ke bulan sebelumnya.',
      'Screening malam memindai seluruh saham BEI dengan nilai transaksi rata-rata minimal sekitar Rp1 miliar per hari. Batas ini dipakai karena swing pada saham yang sepi transaksi cenderung acak dan kurang representatif.',
    ],
  },
  {
    id: 'm-swing', bagian: 'Metodologi', judul: 'Identifikasi swing (zigzag)', sub: 'Menentukan titik X, A, B, C, D secara objektif',
    paragraf: [
      'Titik-titik pola diambil dari swing harga yang ditemukan dengan metode zigzag: sebuah puncak atau lembah baru diakui bila harga berbalik minimal sekian persen dari ekstrem sebelumnya. Gerak kecil di bawah ambang itu diabaikan.',
      'Beberapa ambang dipakai sekaligus agar pola kecil dan besar sama-sama terbaca. Titik terakhir adalah ekstrem yang masih berjalan, sehingga bisa bergeser selama harga belum berbalik sebesar ambang.',
    ],
    tabel: { kolom: ['Timeframe', 'Ambang pembalikan yang dipakai'], baris: [
      ['Harian (1D)', '4%, 6%, 10%, 15%'],
      ['Mingguan (1W)', '8%, 12%, 18%, 25%'],
      ['Bulanan (1M)', '12%, 18%, 25%, 35%'],
    ] },
    alat: 'xabcd',
  },
  {
    id: 'm-rasio', bagian: 'Metodologi', judul: 'Pencocokan rasio dan PRZ', sub: 'Aturan yang dipakai mesin pendeteksi',
    paragraf: [
      'Untuk lima swing terakhir dihitung rasio AB/XA (titik B), BC/AB (titik C), AD/XA (titik D), dan CD/BC (proyeksi BC). Sebuah pola dinyatakan cocok bila setiap rasio berada dalam rentang baku dengan toleransi ±5% (proyeksi BC ±10%).',
      'PRZ adalah irisan antara rentang harga D dari kaki XA dan rentang proyeksi BC. Bila irisannya kosong, pola tidak dianggap terbentuk. Pola dinyatakan batal bila setelah D ada harga penutupan yang menembus batas batal.',
    ],
    tabel: { kolom: ['Pola', 'Titik B (XA)', 'Titik C', 'Titik D', 'Proyeksi BC'], baris: [
      ['Gartley', '0,618', '0,382–0,886 AB', '0,786 XA', '1,13–1,618'],
      ['Bat', '0,382–0,5', '0,382–0,886 AB', '0,886 XA', '1,618–2,618'],
      ['Alternate Bat', '0,382', '0,382–0,886 AB', '1,13 XA', '2,0–3,618'],
      ['Butterfly', '0,786', '0,382–0,886 AB', '1,27–1,414 XA', '1,618–2,24'],
      ['Crab', '0,382–0,618', '0,382–0,886 AB', '1,618 XA', '2,618–3,618'],
      ['Deep Crab', '0,886', '0,382–0,886 AB', '1,618 XA', '2,24–3,618'],
      ['Cypher', '0,382–0,618', '1,272–1,414 XA (melewati A)', '0,786 XC', '–'],
      ['Shark', '0,382–0,886', '1,13–1,618 AB (melewati A)', '0,886–1,13 XC', '1,618–2,24'],
      ['5-0', '1,13–1,618 (melewati X)', '1,618–2,24 AB (melewati A)', '0,50 kaki BC', '–'],
      ['AB=CD', '–', '0,382–0,886 AB', 'CD = AB', '1,13–2,618'],
      ['Alternate AB=CD', '–', '0,382–0,886 AB', 'CD = 1,27–1,618 AB', '1,13–2,618'],
      ['Three Drives', '–', 'Koreksi A dan B', 'Dorongan 3 di 1,27 atau 1,618 koreksi B', '–'],
    ] },
  },
  {
    id: 'm-status', bagian: 'Metodologi', judul: 'Status pola', sub: 'Di mana posisi harga terhadap pola',
    tabel: { kolom: ['Status', 'Arti', 'Yang dilakukan'], baris: [
      ['Menuju PRZ', 'X, A, B, C sudah terbentuk; D masih proyeksi di tengah PRZ', 'Siapkan rencana, tunggu harga masuk PRZ'],
      ['Di PRZ', 'Swing terakhir (calon D) sedang berada di dalam PRZ', 'Pantau konfirmasi pembalikan'],
      ['Berbalik dari PRZ', 'D terkonfirmasi di PRZ dan harga sudah berbalik', 'Nilai sisa jarak ke target dan R:R'],
      ['Batal', 'Harga penutupan menembus batas batal setelah D', 'Pola tidak ditampilkan lagi'],
    ] },
  },
  {
    id: 'm-konfirmasi', bagian: 'Metodologi', judul: 'Konfirmasi dan penyaring', sub: 'Membedakan pola yang layak dari yang lemah',
    paragraf: [
      'Setelah D terbentuk, empat konfirmasi dicek otomatis: candle pembalikan sejak D (pin bar, engulfing, atau outside bar), divergence RSI antara B dan D, penutupan yang menembus puncak atau lembah tiga candle sebelum D, dan volume di sekitar D minimal 1,5 kali rata-rata 20 candle.',
      'Tiga penyaring lain ikut ditampilkan: posisi harga terhadap EMA50 dan EMA200 (searah atau melawan tren besar), likuiditas saham, dan rasio untung-rugi. Penyaring ini tidak membatalkan pola, tetapi menentukan seberapa layak pola diambil.',
    ],
    tabel: { kolom: ['Konfirmasi terpenuhi', 'Penilaian'], baris: [['3–4', 'Kuat'], ['2', 'Sedang'], ['0–1', 'Lemah, tunggu konfirmasi']] },
  },
  {
    id: 'm-posisi', bagian: 'Metodologi', judul: 'Rencana posisi', sub: 'Entry, stop loss, target, dan ukuran lot',
    tabel: { kolom: ['Komponen', 'Aturan di halaman ini'], baris: [
      ['Entry', 'Di titik D; bila D masih proyeksi, di tepi PRZ yang paling dekat dengan harga'],
      ['Stop loss', 'Satu fraksi harga di balik X (Gartley, Bat, Cypher) atau di balik sisi luar PRZ (pola ekstensi dan Shark)'],
      ['Target 1 dan 2', 'Retracement 0,382 dan 0,618 kaki AD (Cypher: kaki CD), dibulatkan ke fraksi harga BEI'],
      ['Target lanjutan', 'Titik C, bila lebih jauh dari target 2'],
      ['Ukuran posisi', 'Lot = (modal × risiko per transaksi) ÷ (jarak entry ke stop × 100 lembar)'],
      ['Tanpa pola searah', 'Entry harga terakhir, stop di balik swing terdekat; tidak dihitung bila stop lebih dari 25% dari harga'],
    ] },
    alat: 'long',
  },
  {
    id: 'm-alur', bagian: 'Metodologi', judul: 'Alur kerja di halaman ini', sub: 'Dari pemilihan saham sampai kesimpulan',
    tabel: { kolom: ['Langkah', 'Tombol', 'Hasil'], baris: [
      ['1', 'Pilih saham dan gaya trading', 'Timeframe menyesuaikan (swing 1D, invest 1W)'],
      ['2', 'XABCD', 'Nama pola, arah, PRZ, alasan rasio, alasan titik X, konfirmasi, tren'],
      ['3', 'Fib retracement', 'Letak B dan D pada kaki XA'],
      ['4', 'Trend-based fib extension', 'Proyeksi AB=CD dan pertemuannya dengan PRZ'],
      ['5', 'Elliott', 'Konteks gelombang tren'],
      ['6', 'Long atau Short', 'Entry, stop loss, target, R:R, jumlah lot'],
      ['7', 'Unduh analisa (PDF)', 'Dokumen analisa untuk dicatat di jurnal'],
    ] },
  },
]

const PENERAPAN = [
  {
    id: 'saham', bagian: 'Penerapan di Saham BEI', judul: 'Penyesuaian untuk saham BEI', sub: 'Yang berbeda dari contoh di buku',
    paragraf: [
      'Prinsip Carney berlaku di semua pasar dan timeframe, tetapi karakter saham BEI mengubah cara menerapkannya. Bagian ini merangkum penyesuaian yang dipakai di halaman ini.',
    ],
    poin: [
      'Utamakan candle harian dan mingguan. Saham hanya diperdagangkan di jam bursa dan sering gap antarhari, jadi timeframe kecil penuh pola palsu.',
      'Pilih saham likuid (nilai transaksi rata-rata minimal sekitar Rp1 miliar per hari); swing saham sepi tidak representatif.',
      'Cek tren besar: pola bullish di atas EMA200 (atau bearish di bawahnya) searah tren dan lebih layak; yang melawan tren besar lebih sering hanya memberi reaksi singkat. Garis EMA50/EMA200 muncul saat XABCD aktif.',
      'Waspadai ARB/ARA dan gap pagi yang melompati PRZ. Tunggu bar berikutnya sebelum memutuskan.',
      'Pastikan swing X sampai D tidak terpotong aksi korporasi (stock split, rights issue) yang mengubah harga historis.',
      'Pola bearish bagi investor ritel adalah tanda ambil untung atau menunda beli; short selling di BEI terbatas.',
      'Ambil hanya bila R:R target 2 minimal 2 dan ada minimal dua konfirmasi di D (candle pembalikan, divergence RSI, struktur minor, volume).',
      'Cek notasi khusus, UMA, dan suspensi; saham yang disuspensi tidak bisa dijual di stop loss.',
    ],
  },
  {
    id: 'saham-tf', bagian: 'Penerapan di Saham BEI', judul: 'Timeframe menurut gaya trading', sub: 'Pola di timeframe besar lebih kuat',
    paragraf: [
      'Carney menekankan bahwa kaki harga yang lebih besar menghasilkan angka yang lebih signifikan, sehingga pola mingguan lebih berbobot daripada pola harian. Prinsip praktisnya: cari pola di timeframe utama, lalu pastikan arahnya tidak melawan timeframe di atasnya.',
    ],
    tabel: { kolom: ['Gaya', 'Timeframe utama', 'Konfirmasi', 'Ketersediaan di halaman ini'], baris: [
      ['Scalping', '1–5 menit', '15 menit', 'Belum tersedia; 1D hanya untuk peta area'],
      ['Intraday', '15 menit–1 jam', '4 jam / 1D', 'Belum tersedia; 1D untuk arah dan area'],
      ['Swing', '1D', '1W', 'Tersedia'],
      ['Invest', '1W', '1M', 'Tersedia'],
    ] },
  },
  {
    id: 'saham-baca', bagian: 'Penerapan di Saham BEI', judul: 'Cara membaca hasil screening', sub: 'Contoh baris screening tanggal 12 November 2026',
    paragraf: [
      'Tab Screening menampilkan setiap pola aktif beserta alasannya. Contoh di bawah diambil dari hasil screening Radar Backdoor tanggal 12 November 2026 untuk AYLS, dan dipakai hanya untuk menunjukkan cara membaca kolom-kolomnya.',
    ],
    tabel: { kolom: ['Kolom', 'Isi contoh', 'Cara membaca'], baris: [
      ['Pola', 'Gartley bearish', 'Struktur Gartley dengan D sebagai puncak: area potensi berbalik turun'],
      ['Status', 'Berbalik dari PRZ', 'D sudah terkonfirmasi dan harga mulai turun dari zona'],
      ['PRZ', '201–204', 'Zona tempat rasio XA dan proyeksi BC bertemu'],
      ['Konfirmasi', 'pin bar 6 Nov 2026', 'Ada candle pembalikan di D; divergence RSI tidak ada'],
      ['Tindak lanjut', 'Klik baris', 'Chart terbuka di tab Saham dengan XABCD aktif untuk dicek ulang'],
    ] },
    alat: 'xabcd',
  },
]

const PENUTUP = [
  {
    id: 'simpulan', bagian: 'Penutup', judul: 'Kesimpulan', sub: 'Jawaban atas rumusan masalah',
    paragraf: [
      'Pola harmonik adalah struktur lima titik (atau empat titik untuk AB=CD) yang hanya sah bila rasio Fibonacci tiap titiknya sesuai aturan pola. Titik B dan titik D adalah pembeda utama: Gartley di 0,618 dan 0,786, Bat di bawah 0,618 dan 0,886, Butterfly di 0,786 dan 1,27, Crab di 0,618 atau kurang dan 1,618. Di dalam setiap pola harus ada AB=CD: kaki CD minimal sama panjang dengan AB (Crab 1,27–1,618 kali AB); pola yang belum memenuhinya ditandai dan turun peringkat.',
      'Nilai sebuah pola terletak pada PRZ, yaitu zona tempat beberapa angka Fibonacci berkumpul. Eksekusi yang baik menunggu harga menguji seluruh zona dan menunjukkan pembalikan, dengan stop loss di luar X untuk Gartley dan Bat, atau di luar PRZ untuk pola yang D-nya melewati X, dan target di retracement 0,382 lalu 0,618 dari kaki AD.',
      'Pada saham BEI, aturan itu dapat dijalankan secara otomatis dengan tambahan penyaring likuiditas, tren besar, konfirmasi di D, dan pembulatan fraksi harga, sehingga hasilnya dapat diulang dan diperiksa.',
    ],
  },
  {
    id: 'keterbatasan', bagian: 'Penutup', judul: 'Keterbatasan', sub: 'Yang perlu diingat saat memakai hasilnya',
    poin: [
      'Deteksi bergantung pada ambang zigzag; swing yang berbeda dapat menghasilkan titik X atau A yang berbeda.',
      'Data hanya candle harian dan mingguan; pola intraday tidak terbaca, dan candle bulanan disusun dari candle mingguan.',
      'Toleransi ±5% memberi ruang pada rasio; pola yang lolos belum tentu sama rapinya dengan contoh di buku.',
      'Konfirmasi dan tren adalah penyaring statistik sederhana, bukan jaminan arah harga.',
      'Hasil historis dan contoh di buku tidak membuktikan keandalan pola di masa depan.',
    ],
  },
  {
    id: 'saran', bagian: 'Penutup', judul: 'Saran', sub: 'Langkah selanjutnya untuk pemakai',
    poin: [
      'Berlatih di grafik historis lebih dulu: temukan dua contoh untuk tiap pola, catat rasio dan reaksi harganya.',
      'Selalu tulis entry, stop loss, target, dan ukuran lot sebelum transaksi, lalu catat hasilnya di jurnal.',
      'Utamakan pola di timeframe besar yang searah tren besar dan memiliki minimal dua konfirmasi di D.',
      'Lewati peluang dengan R:R di bawah 2 atau pada saham yang sepi, bernotasi khusus, atau rawan suspensi.',
    ],
  },
  {
    id: 'pustaka', bagian: 'Penutup', judul: 'Daftar pustaka', sub: 'Sumber yang dirangkum',
    poin: [
      'Carney, Scott M. (2010). Harmonic Trading, Volume One: Profiting from the Natural Order of the Financial Markets. FT Press. Terjemahan Indonesia: Harmonic Trading Vol. 1.',
      'Astronacci. (31 Juli 2026). Belajar Harmonic Pattern: Pengertian, Cara Kerja, dan Jenis-Jenisnya.',
      'Astronacci. (7 Agustus 2026). Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry.',
      'Maxco. Cara Mudah Belajar Harmonic Pattern: Panduan Praktis Trading untuk Pemula.',
      'Harmonic Pattern: Seni Membaca Ritme Market Biar Gak Cuma Tebak-tebakan (artikel).',
      'Harmonic Pattern Next Level dari Fibonacci Retracement dan Extension (materi video, lembar contekan pola).',
    ],
  },
]

const LAMPIRAN = [
  {
    id: 'periksa', bagian: 'Lampiran', judul: 'Daftar periksa sebelum masuk', sub: 'Centang satu per satu sebelum entry', periksa: true,
    poin: [
      'Ada pola, dan saya tahu namanya.',
      'Saya tahu di mana AB=CD selesai.',
      'Tiga angka Fibonacci atau lebih berkumpul di PRZ.',
      'Simetri waktu (X ke B) masuk akal.',
      'Tidak ada tanda bahaya: gap besar, ARB/ARA, ekspansi ekstrem.',
      'Batas batal pola (stop loss) sudah ditentukan.',
      'Risiko per transaksi dan jumlah lot sudah dihitung.',
      'Alasan masuk atau lewati sudah dicatat di jurnal.',
    ],
  },
  {
    id: 'belajar', bagian: 'Lampiran', judul: 'Rencana belajar 7 hari', sub: 'Centang hari yang sudah selesai', belajar: true,
    tabel: { kolom: ['Hari', 'Fokus', 'Latihan di halaman ini'], baris: [
      ['1', 'Konsep dan rasio Fibonacci (Bab 1–3)', 'Hafalkan tabel rasio; klik Fib di beberapa saham'],
      ['2', 'Pola AB=CD (Bab 4)', 'Klik Ext, cek level 1 dan 1,27 dekat PRZ'],
      ['3', 'Gartley dan Bat (Bab 5–6)', 'Cari Gartley/Bat di tab Screening, buka chartnya'],
      ['4', 'Butterfly dan Crab (Bab 7–8)', 'Bandingkan titik B dan D pada pola ekstensi'],
      ['5', 'Eksekusi dan PRZ (Bab 9–10)', 'Baca konfirmasi di D pada 5 saham'],
      ['6', 'Manajemen posisi dan pola gagal (Bab 11–12)', 'Klik Long/Short, hitung lot dan R:R'],
      ['7', 'Latihan terpadu dan jurnal', 'Unduh PDF analisa 10 saham, catat hasilnya'],
    ] },
  },
]

// Pola tambahan disisipkan di akhir bagian Pembahasan Pola (setelah Butterfly, sebelum Bab 9).
const iEksekusi = BAB_7_12.findIndex(s => s.bagian === 'Eksekusi dan Manajemen')
export const SLIDE = [...PENDAHULUAN, ...BAB_1_6, ...BAB_7_12.slice(0, iEksekusi), ...POLA_TAMBAHAN, ...BAB_7_12.slice(iEksekusi),
  ...METODOLOGI, ...PENERAPAN, ...PENUTUP, ...LAMPIRAN]

export const totalSlide = SLIDE.length

// Bentuk AB=CD ideal (C 0,618 AB, CD = AB) dalam kotak 0..1 untuk diagram slide.
export function diagramAbcd(arah = 'bullish') {
  const bull = arah === 'bullish'
  const v = { A: 1, B: 0.3, C: 0.3 + 0.618 * 0.7, D: 0.3 + 0.618 * 0.7 - 0.7 }
  const lo = Math.min(...Object.values(v)), hi = Math.max(...Object.values(v))
  // y 0 = atas: bullish (A puncak, D lembah terendah) dibalik dari nilai harga.
  const titik = ['A', 'B', 'C', 'D'].map((n, j) => { const t = (v[n] - lo) / (hi - lo); return { n, x: j / 3, y: bull ? 1 - t : t } })
  return { titik, garis: [{ a: titik[0], b: titik[2], teks: '0,382–0,886' }, { a: titik[1], b: titik[3], teks: '1,13–2,618' }], bull }
}

// Butir yang muncul bertahap di mode presentasi: tiap paragraf, tiap poin, lalu tiap baris tabel. Slide yang bisa
// dicentang (daftar periksa, rencana belajar) tampil utuh sekaligus.
export function butirSlide(s) {
  if (!s || s.periksa || s.belajar) return []
  return [...(s.paragraf || []).map((t, i) => ({ jenis: 'p', i })), ...(s.poin || []).map((t, i) => ({ jenis: 'li', i })),
    ...(s.tabel?.baris || []).map((t, i) => ({ jenis: 'tr', i }))]
}
