// Ringkasan Bab 7–12 Scott M. Carney, Harmonic Trading Vol. 1 (terjemahan Indonesia) sebagai slide tab Materi:
// Pembahasan Pola (Bab 7–8) serta Eksekusi dan Manajemen (Bab 9–12). Ditulis ulang dengan kata sendiri; angka dari teks
// buku, contoh yang angkanya bertentangan di buku tidak dipakai. Skema slide: lihat harmonikMateri.js. Data murni.
export const BAB_7_12 = [
  // ---------------- Bab 7: Pola Kepiting ----------------
  {
    id: 'b7-definisi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola Kepiting (Crab)',
    sub: 'Struktur ekstensi lima titik yang bertumpu pada proyeksi 1,618 XA',
    paragraf: [
      'Carney memperkenalkan pola Kepiting pada tahun 2000 sebagai struktur ekstensi lima titik (X, A, B, C, D) yang secara khusus memakai proyeksi 1,618 dari kaki XA. Proyeksi inilah yang menjadi batas penentu Zona Potensi Pembalikan (PRZ), sedangkan proyeksi BC yang ekstrem (2,618, 3,14, atau 3,618) berfungsi melengkapinya.',
      'Berbeda dengan pola lain, AB=CD justru menjadi unsur paling lemah di dalam PRZ Kepiting. Penyelesaian AB=CD minimum tetap disyaratkan, tetapi yang paling sering muncul adalah variasi Alternatif 1,27 atau 1,618, dengan 1,618 AB=CD sebagai yang paling umum. Penulis menyarankan menunggu sampai level 1,618 XA benar-benar teruji, dengan konvergensi proyeksi BC sebagai syarat minimum bahwa pola telah selesai.',
      'Karena proyeksinya ekstrem, pergerakan harga menjelang dan di dalam PRZ Kepiting cenderung paling tajam dibanding pola harmonik lainnya, dan pembalikannya sering dramatis.'
    ],
    tabel: {
      kolom: ['Titik / ukuran', 'Syarat menurut Carney'],
      baris: [
        ['Titik B', 'Retracement 0,618 dari XA atau lebih kecil (0,382 dan 0,50 umum ditemui)'],
        ['Titik C', 'Retracement 0,382 sampai 0,886 dari AB'],
        ['Proyeksi BC', 'Ekstrem: 2,618, 3,14, atau 3,618 (kadang 2,24)'],
        ['AB=CD', 'Minimal setara; yang umum Alternatif 1,27 atau 1,618'],
        ['Titik D', 'Proyeksi 1,618 XA, angka penentu PRZ']
      ]
    },
    pola: 'crab',
    alat: 'xabcd',
    rujukan: 'Carney, Bab 7'
  },
  {
    id: 'b7-retrace-ekstensi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola Retracement dan Pola Ekstensi',
    sub: 'Mengapa titik X kurang menentukan pada Kepiting',
    paragraf: [
      'Pada pola retracement seperti Bat dan Gartley, titik D berada di dalam kaki XA sehingga titik awal X menjadi batas yang tegas: bila harga melampaui X, pola dianggap gagal dan stop loss dijalankan. Parameter risikonya relatif jelas.',
      'Pola ekstensi seperti Kepiting menyelesaikan titik D di luar X. Akibatnya X tidak lagi menjadi tingkat validasi yang bermakna, penempatan stop loss lebih subjektif, dan reaksi harga di PRZ perlu dibaca dengan cara berbeda. Carney mencatat bahwa memastikan validitas pola ekstensi bisa menuntut risiko eksekusi yang lebih besar dibanding kebanyakan pola retracement; pengelolaannya dirinci pada Bab 11.'
    ],
    tabel: {
      kolom: ['Aspek', 'Pola retracement (Bat, Gartley)', 'Pola ekstensi (Kepiting, Kupu-kupu)'],
      baris: [
        ['Letak titik D', 'Di dalam kaki XA', 'Di luar titik X'],
        ['Peran titik X', 'Batas validasi yang tegas', 'Kurang menentukan'],
        ['Stop loss', 'Relatif jelas (di luar X)', 'Lebih subjektif'],
        ['Aksi harga di PRZ', 'Lebih teratur', 'Cenderung tajam dan ekstrem']
      ]
    },
    poin: [
      'Di saham BEI, pergerakan ekstrem menuju PRZ pola ekstensi dapat bertepatan dengan auto reject bawah (ARB); jarak stop yang lebih lebar perlu dikompensasi dengan jumlah lot yang lebih kecil.'
    ],
    rujukan: 'Carney, Bab 7'
  },
  {
    id: 'b7-contoh',
    bagian: 'Pembahasan Pola',
    judul: 'Contoh Kepiting Bullish dan Bearish',
    sub: 'Konvergensi 1,618 XA dan proyeksi BC sebagai inti PRZ',
    paragraf: [
      'Seluruh contoh di buku menunjukkan pola yang sama: harga bergerak tajam ke PRZ, berhenti setelah semua angka di zona teruji, lalu berbalik dengan tegas. Pada beberapa kasus AB=CD Alternatif tidak berimpit dengan dua angka lainnya, tetapi PRZ tetap akurat karena ditentukan terutama oleh proyeksi XA dan BC.',
      'Contoh ES juga memperlihatkan dua catatan metodologis. Titik X boleh berupa titik perantara, bukan titik terendah absolut, selama penjajaran rasionya tepat. Selain itu, level psikologis seperti 50, 100, atau 1000 yang berimpit dengan PRZ patut dihormati sebagai penguat.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['Apple (AAPL), bullish', '15 menit', '1,618 XA dan 3,14 BC tepat di atas 162; Alt 1,618 AB=CD di batas atas', 'Turun tajam ke PRZ, stabil, lalu berbalik naik'],
        ['General Electric (GE), bullish', '60 menit', '1,618 XA di 10,75 dan 2,618 BC', 'Berbalik dalam beberapa hari setelah tes awal'],
        ['Mini S&P 500 (ES_U3), bullish', '10 menit', '1,618 XA dan 3,14 BC di 1000', 'Selesai pada sesi semalam lalu naik; tanpa uji ulang untuk entri'],
        ['Qualcomm (QCOM), bearish', '60 menit', '1,618 XA, 2,618 BC, Alt 1,618 AB=CD di 42,75-43,70', 'Dibuka sedikit di atas PRZ, gagal melanjutkan, lalu turun'],
        ['Minyak mentah (CL_#F), bearish', '15 menit', '1,618 XA dan proyeksi BC', 'Reli tajam berhenti di batas atas PRZ'],
        ['Mini NASDAQ 100 (NQ_Z3), bearish', '5 menit', '1,618 XA dan proyeksi BC di 1420', 'Pembalikan tepat; pola terbentuk dalam sekitar 30 jam termasuk sesi semalam']
      ]
    },
    rujukan: 'Carney, Bab 7'
  },
  {
    id: 'b7-dalam',
    bagian: 'Pembahasan Pola',
    judul: 'Kepiting Dalam (Deep Crab)',
    sub: 'Varian Kepiting dengan titik B pada retracement 0,886',
    paragraf: [
      'Kepiting Dalam lahir dari pengamatan terhadap Kelelawar yang tidak valid dan jenis Kepiting tertentu. Ia tetap memakai proyeksi 1,618 XA sebagai level penentu, tetapi titik B harus berupa retracement 0,886 dari XA; dalam praktik B kerap sedikit melewati 0,886 tanpa menembus X.',
      'Ketika kaki CD menembus titik B sekaligus titik X, harga melanggar dua support atau resistance penting berturut-turut, sehingga pergerakannya sering cepat meluas sampai 1,618 XA. Pada varian ini AB=CD lebih berperan dibanding Kepiting biasa (umumnya Alternatif 1,27), sedangkan proyeksi BC lebih jinak: minimum 2,24 dan dapat mencapai 3,618, tergantung AB=CD mana yang paling dekat dengan 1,618 XA.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['Mini NASDAQ 100 (NQ_Z3), Deep bullish', '15 menit', '1,618 XA, 1,27 AB=CD, 3,14 BC tepat di atas 1427; tiga angka dalam 1 tick', 'Naik tepat dari titik penyelesaian'],
        ['Anadarko Petroleum (APC), Deep bearish', 'Harian', '1,618 XA, Alt 1,27 AB=CD, 2,24 BC di 78,80; PRZ selebar 30 sen dari pola sekitar 30 poin', 'Sedikit melewati PRZ, menguji level psikologis 80, lalu turun tajam']
      ]
    },
    rujukan: 'Carney, Bab 7'
  },
  {
    id: 'b7-sempurna',
    bagian: 'Pembahasan Pola',
    judul: 'Kepiting Sempurna dan Ringkasan',
    sub: 'Perpaduan Phi (1,618) dan Pi (3,14)',
    paragraf: [
      'Kepiting Sempurna memadukan retracement B tepat 0,618, proyeksi 1,618 XA, dan proyeksi 3,14 BC, ditambah 1,618 AB=CD dan titik C pada kisaran 0,50 sampai 0,618. Penjajaran dua bilangan yang sangat harmonis ini menghasilkan zona yang presisi, meskipun aksi harga di titik penyelesaiannya biasanya tetap tajam.',
      'Sebagai ringkasan, Carney menempatkan Kepiting sebagai alat untuk menandai kondisi jenuh jual atau jenuh beli yang ekstrem. Variasi Kepiting tampak serupa, tetapi rasio di setiap titik membedakannya, dan pembalikan dari PRZ-nya cenderung keras.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['Home Depot (HD), sempurna bullish', '15 menit', 'B 0,618; 1,618 XA, Alt 1,618 AB=CD, 3,14 BC di 32,50-32,75', 'Berbalik hampir tepat di 1,618 XA (32,55)'],
        ['Nokia (NOK), sempurna bearish', '5 menit', 'B 0,618; 1,618 XA di batas atas, Alt 1,618 AB=CD dan 3,14 BC di sekitar 17,20', 'Gap naik ke PRZ saat pembukaan, lalu berhenti dan berbalik']
      ]
    },
    poin: [
      'B: tepat 0,618 atau lebih kecil (0,382 dan 0,50 umum).',
      'BC: 2,618, 3,14, atau 3,618 (kadang 2,24).',
      'AB=CD: minimal setara; Alternatif 1,27 atau 1,618 paling umum.',
      'C: 0,382 sampai 0,886.',
      'Sifat pola ekstrem; siapkan diri untuk pembalikan yang keras.'
    ],
    rujukan: 'Carney, Bab 7'
  },

  // ---------------- Bab 8: Pola Kupu-Kupu Ideal ----------------
  {
    id: 'b8-definisi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola Kupu-Kupu Ideal (Butterfly)',
    sub: 'Retracement B 0,786 dan proyeksi 1,27 XA',
    paragraf: [
      'Struktur Kupu-kupu pertama kali ditemukan oleh Bryce Gilmore melalui perangkat lunak Wave Trader dengan banyak kombinasi Fibonacci. Carney mempersempitnya menjadi versi ideal dengan menetapkan rasio di setiap titik, dan unsur penentunya adalah retracement B sebesar 0,786 dari XA.',
      'Angka paling penting di PRZ adalah proyeksi 1,27 XA, dilengkapi proyeksi BC yang relatif jinak (umumnya 1,618, 2,00, atau 2,24; 2,618 sesekali dipakai) dan AB=CD. AB=CD setara adalah syarat minimum, tetapi Alternatif 1,27 AB=CD lebih sering muncul, dan pola yang valid jarang melampaui titik tersebut. Menurut Carney, Kupu-kupu ideal bekerja baik di wilayah harga tertinggi atau terendah baru karena sering menandai akhir tren dominan.'
    ],
    tabel: {
      kolom: ['Titik / ukuran', 'Syarat menurut Carney'],
      baris: [
        ['Titik B', 'Tepat 0,786 dari XA'],
        ['Titik C', '0,382 sampai 0,886 (0,618 lebih disukai)'],
        ['Proyeksi BC', 'Minimal 1,618; sebaiknya selesai rapat dengan 1,27 XA'],
        ['AB=CD', 'Setara sebagai minimum; Alternatif 1,27 paling umum'],
        ['Titik D', 'Proyeksi 1,27 XA; tidak memakai 1,618 XA']
      ]
    },
    pola: 'butterfly',
    alat: 'xabcd',
    rujukan: 'Carney, Bab 8'
  },
  {
    id: 'b8-banding',
    bagian: 'Pembahasan Pola',
    judul: 'Membedakan Kepiting dan Kupu-Kupu',
    sub: 'Dua pola ekstensi yang mirip bentuk, berbeda ukuran',
    paragraf: [
      'Kepiting dan Kupu-kupu sama-sama pola ekstensi, sehingga sekilas tampak serupa. Pembedanya ada pada ukuran: Kepiting memakai 1,618 XA dan bersifat reaksioner terhadap kondisi jenuh yang ekstrem, sedangkan Kupu-kupu ideal hanya memakai 1,27 XA dan dikunci oleh titik B 0,786.',
      'Dalam hal syarat titik B yang ketat, Kupu-kupu lebih mirip Gartley. Penetapan 0,786 menyaring banyak struktur yang hanya berpura-pura menjadi pola valid. Konsekuensinya peluang yang tersaring menjadi lebih sedikit, tetapi situasi tidak valid yang tampak serupa ikut berkurang.'
    ],
    tabel: {
      kolom: ['Ukuran', 'Kepiting', 'Kepiting Dalam', 'Kupu-kupu ideal'],
      baris: [
        ['Retracement B', '0,618 atau kurang', '0,886', 'Tepat 0,786'],
        ['Proyeksi XA di D', '1,618', '1,618', '1,27 (tanpa 1,618)'],
        ['Proyeksi BC', '2,618 / 3,14 / 3,618', 'Minimal 2,24, sampai 3,618', 'Minimal 1,618; umumnya 1,618 / 2,00 / 2,24'],
        ['AB=CD umum', 'Alternatif 1,618', 'Alternatif 1,27', 'Alternatif 1,27'],
        ['Peran AB=CD', 'Paling tidak penting', 'Lebih penting', 'Elemen penting']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 7 dan Bab 8'
  },
  {
    id: 'b8-contoh',
    bagian: 'Pembahasan Pola',
    judul: 'Contoh Kupu-Kupu Bullish dan Bearish',
    sub: 'Prinsip yang sama pada kerangka waktu berbeda',
    paragraf: [
      'Contoh di buku mencakup grafik 60 menit hingga mingguan. Kupu-kupu mingguan Citigroup dan Kupu-kupu 60 menit Franc Swiss memiliki penjajaran yang hampir identik dan sifat pembalikan yang mirip, sehingga Carney menyimpulkan bahwa kaidah harmonik berlaku seragam lintas pasar dan kerangka waktu.',
      'Tanda pembalikan yang sehat berulang di setiap contoh: harga menguji seluruh angka, lalu ditutup kembali di sisi yang benar dari PRZ. Pola tidak menjamin keberhasilan, tetapi ciri-ciri tersebut menandai peluang terbaik.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['SPY, bullish', 'Harian', '1,27 XA di batas bawah; Alt 1,27 AB=CD dan 1,618 BC tepat di bawah 70', 'Menandai titik terendah pasar bearish 2009'],
        ['American Express (AXP), bullish', '60 menit', '1,618 BC dan Alt 1,618 AB=CD di sekitar 32, rentang sekitar sepuluh sen', 'Naik segera setelah pola selesai'],
        ['Petrobras (PBR), bullish', 'Harian', '1,27 XA 82,75; 1,27 AB=CD 83,45; 1,618 BC 84,06', 'Turun tajam ke PRZ lalu ditutup di atasnya'],
        ['Mini S&P 500 (ES_U9), bullish', '60 menit', '2,0 BC dan AB=CD di 977', 'Butuh dua tes PRZ; support tepat di bawah 980'],
        ['Citigroup (C), bearish', 'Mingguan', '1,27 XA dan Alt 1,27 AB=CD berimpit di 55,80', 'Bar mingguan ditutup di bawah PRZ; puncak sebelum penurunan besar'],
        ['Franc Swiss (CHF), bearish', '60 menit', 'Kisaran angka yang rapat', 'Berhenti dan berbalik setelah seluruh PRZ teruji']
      ]
    },
    rujukan: 'Carney, Bab 8'
  },
  {
    id: 'b8-sempurna',
    bagian: 'Pembahasan Pola',
    judul: 'Kupu-Kupu Sempurna dan Ringkasan',
    sub: 'Versi paling ketat dari Kupu-kupu',
    paragraf: [
      'Kupu-kupu Sempurna mempersempit variasi: B tepat 0,786, D hanya pada 1,27 XA, BC tepat 1,618, AB=CD wajib Alternatif 1,27, dan C antara 0,50 sampai 0,886. Pada Kupu-kupu ideal proyeksi BC boleh sampai 2,24, sedangkan versi sempurna hanya menerima 1,618.',
      'Dalam ringkasannya Carney juga menyebut bahwa proyeksi BC Kupu-kupu dapat berkisar 1,13 sampai 3,618 bergantung pada retracement C, meskipun tidak seekstrem Kepiting. Bagi pembaca grafik BEI, kerangka ini paling berguna untuk menyaring kandidat: B yang jauh dari 0,786 sebaiknya tidak dipaksakan menjadi Kupu-kupu.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['Yen Jepang (JPY), sempurna bullish', '15 menit', '1,27 XA, 1,618 BC, Alt 1,27 AB=CD di sekitar 93,50', 'Konsolidasi singkat, uji ulang penuh, lalu naik tajam'],
        ['Indeks S&P 500 ($SPX), sempurna bearish', '5 menit', '1,27 XA di 1005,48 sebagai batas atas, dilengkapi Alt 1,27 AB=CD', 'Butuh uji kedua intrahari sebelum berbalik lebih besar']
      ]
    },
    rujukan: 'Carney, Bab 8'
  },

  // ---------------- Bab 9: Eksekusi Perdagangan ----------------
  {
    id: 'b9-taktik',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Taktik Perdagangan dan Model Aksi-Tugas',
    sub: 'Mengidentifikasi pola baru separuh pekerjaan',
    paragraf: [
      'Carney menegaskan bahwa hasil sebuah transaksi ditentukan oleh dua hal: reaksi pasar terhadap area harmonik dan respons pedagang terhadap aksi harga di PRZ. Karena pola yang sama dapat berakhir berbeda, pedagang memerlukan seperangkat aturan yang disusun sebelum pasar bergerak, bukan tebakan saat harga berjalan.',
      'Gagasan ini dirumuskan sebagai Model Proses Perdagangan Aksi-Tugas. Aksi adalah persiapan: memastikan struktur valid, menghitung PRZ, dan menetapkan entri, stop loss, serta target. Tugas adalah pelaksanaan posisi berdasarkan aksi harga saat pola selesai. Penyelesaian pola membuka jendela teknis singkat yang memberi banyak informasi tentang arah berikutnya.'
    ],
    poin: [
      'Prinsip yang dikutip penulis dari rekannya: keuntungan hanya dapat diraih dari hal yang sudah diantisipasi.',
      'Pembalikan yang kuat dan cepat cenderung menghasilkan pergerakan yang lebih besar.',
      'Harga yang berkali-kali menguji PRZ tanpa membalikkan tren adalah tanda pola yang berpotensi gagal.'
    ],
    rujukan: 'Carney, Bab 9'
  },
  {
    id: 'b9-kemungkinan',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Kemungkinan Setelah Entri',
    sub: 'Tiga skenario dan harga tick berikutnya',
    paragraf: [
      'Setelah posisi diambil di PRZ, aksi harga hanya memiliki tiga kemungkinan. Hasil akhirnya pun hanya tiga: untung, rugi, atau impas. Dengan memetakan semuanya sejak awal, keputusan saat pasar bergerak tinggal menjalankan rencana.',
      'Carney juga membahas harga informasi teknis, yaitu tick berikutnya. Setiap bar setelah tes awal PRZ menambah informasi, tetapi menunggu konfirmasi berarti menanggung biaya peluang berupa harga entri atau keluar yang lebih buruk. Ketegangan ini paling terasa ketika target laba sudah tercapai dan keserakahan mendorong untuk menunggu lebih lama.'
    ],
    tabel: {
      kolom: ['Skenario', 'Tindakan menurut Carney'],
      baris: [
        ['Harga melampaui PRZ masuk Zona Stop Loss', 'Ambil kerugian dan beralih ke peluang berikutnya; kerugian bagian dari bisnis'],
        ['Mundur sedikit dari PRZ lalu konsolidasi', 'Amankan keuntungan cepat sebelum berubah menjadi rugi'],
        ['Berbalik tegas dan memberi bantalan laba', 'Terapkan manajemen perdagangan untuk memaksimalkan laba']
      ]
    },
    poin: [
      'Di BEI, fraksi harga yang berjenjang membuat satu tick pada saham murah bernilai persentase besar; biaya peluang tick berikutnya perlu dihitung dalam persen, bukan rupiah.'
    ],
    rujukan: 'Carney, Bab 9'
  },
  {
    id: 'b9-prz',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Eksekusi di PRZ dan Tes Awal',
    sub: 'Menentukan prioritas angka di dalam zona',
    paragraf: [
      'Inti Harmonic Trading adalah mengeksekusi di PRZ. Bila harga berbalik dari zona yang berisi banyak angka, PRZ menjadi titik balik penting; bila tidak, itu tanda tren dominan cukup kuat. Untuk menilai zona, Carney memberi beberapa pedoman prioritas.',
      'Tes awal PRZ adalah momen paling kritis. PRZ yang terdefinisi baik umumnya memberi reaksi yang dapat diperdagangkan, tetapi reaksi itu harus jelas menjauh dari seluruh rentang angka. Harga yang hanya berkonsolidasi di PRZ lalu melanjutkan tren adalah tanda kegagalan yang umum. Bar yang terbentuk pada tes awal dijadikan titik terminal untuk mengukur pembalikan.'
    ],
    poin: [
      'Cari area konvergensi proyeksi rasio dan penyelesaian pola.',
      'Cari tempat bertemunya kelompok perhitungan terbesar.',
      'Angka dari kaki harga yang lebih besar lebih signifikan; pola mingguan lebih kuat dari harian, pola besar lebih kuat dari pola kecil di dalamnya.',
      'Makin banyak angka dalam PRZ, makin penting level tersebut.',
      'Pembalikan paling mungkin terjadi di tempat sebagian besar angka berdekatan.',
      'Siapkan daftar pantau kandidat; tes awal bisa terjadi sangat cepat dan mudah terlewat.'
    ],
    alat: 'xabcd',
    rujukan: 'Carney, Bab 9'
  },
  {
    id: 'b9-kesemek',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Efek Kesemek dan Tinjauan 20/20',
    sub: 'Keraguan sebagai kegagalan menjalankan Tugas',
    paragraf: [
      'Carney meminjam istilah Efek Kesemek dari J. M. Hurst (The Profit Magic of Stock Transaction Timing): sinyal beli terbaik justru datang ketika saham tampak paling tidak menarik, sehingga pedagang ragu menarik pelatuk. Dalam kerangka Aksi-Tugas, keraguan adalah kegagalan menjalankan Tugas meskipun Aksi sudah disiapkan.',
      'Solusinya adalah pembelajaran dan pengkondisian emosi: menguasai identifikasi, eksekusi, dan manajemen sebelum memakai uang nyata, serta menerima bahwa tidak setiap pola harus diperdagangkan. Persiapan yang matang membuat harga di PRZ terasa lebih lambat karena semua parameter sudah ditentukan.',
      'Pola juga selalu tampak lebih rapi jika dilihat ke belakang. Untuk mendekati keberhasilan 20/20, Carney menyarankan tiga hal: bersiap lebih awal dengan daftar kandidat dan alarm harga, menerima bahwa sebagian transaksi akan terlewat, dan meninjau transaksi masa lalu untuk memperbaiki kesalahan.'
    ],
    rujukan: 'Carney, Bab 9'
  },
  {
    id: 'b9-jurnal',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Jurnal, Daftar Periksa, dan Psikologi',
    sub: 'Alat persiapan dan evaluasi diri',
    paragraf: [
      'Jurnal perdagangan mencatat jenis pola, titik penyelesaian AB=CD, retracement Fibonacci di zona pembalikan, serta pikiran dan perasaan sebelum, selama, dan sesudah transaksi, termasuk alasan menolak suatu setup. Carney menampilkan contoh jurnalnya sendiri, misalnya AB=CD pada ES_Z9 di 1032,75 dengan retracement 0,618 di 1028,25, dan Kepiting Bullish 60 menit pada QQQ di sekitar 33.',
      'Daftar periksa sepuluh butir merangkum proses penilaian menjadi format ringkas, sementara pedoman psikologi menekankan kesederhanaan, disiplin pada rencana, jeda dari trading, dan sikap nyaris tanpa emosi setelah parameter ditetapkan. Penulis juga menyertakan kuesioner tujuh belas pertanyaan untuk meninjau motivasi dan kebiasaan trading secara berkala.'
    ],
    tabel: {
      kolom: ['No', 'Butir daftar periksa'],
      baris: [
        ['1-2', 'Adakah pola, dan pola apa?'],
        ['3-4', 'Adakah AB=CD, dan di mana selesainya?'],
        ['5-6', 'Adakah tiga angka atau lebih yang konvergen di PRZ, dan berapa nilainya?'],
        ['7', 'Apa yang ditunjukkan siklus waktu (simetri)?'],
        ['8', 'Adakah tanda peringatan?'],
        ['9', 'Di titik mana PRZ tidak berlaku lagi (stop loss)?'],
        ['10', 'Berapa yang dipertaruhkan, dan apakah risikonya dapat diterima?']
      ]
    },
    rujukan: 'Carney, Bab 9'
  },

  // ---------------- Bab 10: Aksi Harga di PRZ ----------------
  {
    id: 'b10-ideal',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Pembalikan Ideal dan T-bar',
    sub: 'Bar yang menguji seluruh PRZ',
    paragraf: [
      'Pembalikan ideal menguji semua angka di PRZ pada tes awal, lalu tren dominan berbalik dan langsung bergerak ke arah baru. Bar yang menyentuh seluruh angka itu disebut Terminal Price Bar atau T-bar. Penentunya bukan seberapa kuat harga datang ke PRZ, melainkan reaksinya setelah pola selesai.',
      'Pada pola bullish, T-bar harus stabil setelah menyelesaikan tes. Pada pola bearish, kondisi terbaik adalah T-bar ditutup di bawah kisaran angka harmonik. Ujung T-bar (puncak pada pola bearish, dasar pada pola bullish) menjadi level yang membatalkan zona; jika ditembus, validitas transaksi dipertanyakan dan bahkan dapat menjadi sinyal membalik posisi (dibahas di Bab 12).'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Pola', 'Pengamatan'],
      baris: [
        ['Dow Jones Industrial Average', 'Mingguan (dibaca juga di harian)', 'Kelelawar Bullish setelah rendah 2003', 'Aksi jual tajam ke support, lalu stabil dan berbalik setelah T-bar terbentuk'],
        ['Pepsi (PEP)', '15 menit', 'Kupu-kupu Bearish', 'Reli tajam berhenti setelah menguji semua angka; puncak T-bar menjadi batas pembatal']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 10'
  },
  {
    id: 'b10-gap',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Tanda Peringatan: Gap Melalui PRZ',
    sub: 'Membedakan gap ke dalam PRZ dan gap menembus PRZ',
    paragraf: [
      'Carney menyebut situasi ketika harga menembus PRZ secara meyakinkan sebagai ledakan (blowout). Salah satu pemicunya adalah gap. Gap yang melompati seluruh rentang angka sehingga sebagian besar angka tidak pernah teruji membatalkan titik penyelesaian pola. Sebaliknya, gap yang terjadi di dalam PRZ masih bisa menghasilkan pembalikan valid; dalam kasus ini sebaiknya menunggu bar berikutnya.',
      'Gap yang meledakkan PRZ bearish bahkan dapat menjadi sinyal kelanjutan tren yang kuat. Fokus penilaian tetap pada aksi harga di tes awal angka harmonik.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Pola', 'Pengamatan'],
      baris: [
        ['Wal-Mart (WMT)', 'Harian', 'Gartley Bullish, tiga angka di sekitar 52,20', 'Dibuka di bawah PRZ dan turun beberapa hari kemudian; pola batal meski sempat memantul'],
        ['Microsoft (MSFT)', '60 menit', 'Kepiting Bearish', 'Gap melewati PRZ saat pembukaan dan langsung naik lebih tinggi']
      ]
    },
    poin: [
      'Konteks BEI: gap pada sesi pra-pembukaan atau saham yang langsung menyentuh ARB/ARA dapat melompati seluruh PRZ tanpa kesempatan transaksi; menurut kaidah Carney, kondisi seperti ini diperlakukan sebagai pola batal, bukan peluang beli murah.'
    ],
    rujukan: 'Carney, Bab 10'
  },
  {
    id: 'b10-ekspansi',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Tanda Peringatan: Ekspansi Harga Ekstrem',
    sub: 'Momentum yang menembus PRZ dan berlanjut',
    paragraf: [
      'Pengaturan yang tidak valid sering ditandai bar ekspansi besar yang cepat melintasi PRZ lalu terus bergerak searah tren dominan. Ekspansi seperti ini sulit dipastikan sebelum terjadi; penentunya adalah momentum saat tes awal dan apakah harga berlanjut setelah seluruh rentang angka teruji.',
      'Carney menutup bab ini dengan menegaskan bahwa jenis bar yang terbentuk di titik penyelesaian memberi informasi luas tentang aksi harga berikutnya. Membedakan pembalikan valid dari kegagalan menuntut pengalaman, tetapi sinyal pelanggaran yang jelas harus dihormati.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik', 'Pola', 'Pengamatan'],
      baris: [
        ['Coca-Cola (KO)', 'Mingguan', 'Gartley Bullish', 'Tes awal langsung menembus seluruh angka dan terus turun'],
        ['Dow Jones Industrials ($INDU)', '15 menit', 'Gartley Bearish, konvergensi tepat di atas 9900', 'Bar ekspansi menembus PRZ, ditutup di atas batas atas, lalu terus naik']
      ]
    },
    poin: [
      'Pembalikan valid: harga menguji semua angka, lalu ditutup kembali di sisi pola.',
      'Peringatan: bar sangat panjang, penutupan di luar PRZ, dan kelanjutan searah tren lama.'
    ],
    rujukan: 'Carney, Bab 10'
  },

  // ---------------- Bab 11: Sistem Manajemen Perdagangan Harmonis ----------------
  {
    id: 'b11-asal',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Latar Sistem Manajemen: Kasus Redhat',
    sub: 'Keluar karena emosi, bukan karena sinyal',
    paragraf: [
      'Sistem ini lahir dari pengalaman Carney pada saham Redhat (RHAT). Ia membeli 1.200 saham di 74 3/4 pada AB=CD bullish di retracement 0,618 di bawah 75. Harga sempat naik hampir 15 poin, lalu bergerak menyamping, dan ia menutup seluruh posisi. Dalam bulan berikutnya saham itu naik lebih dari dua kali lipat.',
      'Pelajaran yang ditarik: tanpa aturan untuk membaca informasi pasar, keputusan menutup posisi sebagian besar bersifat emosional. Ia lalu mengembangkan garis tren, target Fibonacci, dan trailing stop agar aksi harga yang memberi sinyal kapan posisi ditutup.'
    ],
    poin: [
      'Untuk saham BEI, pembagian posisi menjadi dua atau tiga bagian perlu memperhitungkan satuan lot (100 saham) agar setiap bagian tetap dapat dieksekusi.'
    ],
    alat: 'long',
    rujukan: 'Carney, Bab 11'
  },
  {
    id: 'b11-istilah',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Istilah Inti: PRZ, IPO, PPZ, SLZ',
    sub: 'Kosakata Sistem Manajemen Perdagangan Harmonis',
    paragraf: [
      'Sistem manajemen Carney menetapkan seluruh parameter relatif terhadap struktur pola. IPO diukur dari batas tertinggi dan terendah pola; yang paling sering dipakai adalah retracement 0,382 atau 0,618. Bila pembalikan melewati 0,382 secara eksplosif (gap, rentang ekstrem, atau penutupan ekor), target IPO digeser ke 0,618. Sebaliknya, bila harga menyentuh level IPO tetapi tidak berlanjut, sebagian atau seluruh posisi ditutup.',
      'PPZ menerapkan aturan yang dianggap paling penting dalam pendekatan ini: keuntungan tidak boleh dibiarkan berubah menjadi kerugian. Strategi ini kadang membuat posisi tertutup sebelum pembalikan sesungguhnya, tetapi dalam jangka panjang mencegah bertahan pada posisi yang akhirnya gagal.'
    ],
    tabel: {
      kolom: ['Istilah', 'Pengertian'],
      baris: [
        ['PRZ (Potential Reversal Zone)', 'Area konvergensi pola dan proyeksi Fibonacci; ditembusnya PRZ menandakan tren utama kuat'],
        ['IPO (Initial Profit Objective)', 'Target laba pertama, umumnya retracement 0,382 atau 0,618 dari rentang pola; dapat juga berupa patahnya garis tren setelah target awal terlampaui'],
        ['PPZ (Profit Protection Zone)', 'Level di luar titik eksekusi setelah laba kecil tercapai, untuk melindungi laba'],
        ['SLZ (Stop Loss Zone)', 'Area di luar PRZ yang menandakan setup tidak valid; posisi ditutup rugi']
      ]
    },
    alat: 'long',
    rujukan: 'Carney, Bab 11'
  },
  {
    id: 'b11-trailing',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Membagi Posisi dan Trailing Stop 0,382',
    sub: 'Mengamankan laba sambil memberi ruang pembalikan',
    paragraf: [
      'Posisi lazim dibagi menjadi dua atau tiga bagian. Bagian pertama ditutup di IPO, idealnya dengan limit order di 0,382 dan 0,618, sehingga sebagian transaksi pasti untung. Sisanya dibiarkan berjalan tanpa beban sampai aksi harga memberi bukti untuk ditutup. Cara ini mengurangi keuntungan yang tertinggal dan membuat keputusan merespons pasar, bukan emosi.',
      'Trailing stop 0,382 dipasang setelah IPO tercapai. Ukurannya diambil dari titik pembalikan ke titik ekstrem pembalikan (tertinggi untuk setup bullish, terendah untuk setup bearish). Pembalikan yang kuat biasanya hanya terkoreksi sampai level ini; bila harga terus menembus 38,2%, posisi ditutup. Setelah 0,618 terlampaui, target berikutnya mengikuti deret 0,786, 0,886, 1,0, 1,27, dan seterusnya.'
    ],
    poin: [
      'Bagian 1: limit order di IPO 0,382 atau 0,618.',
      'Bagian 2: dikelola dengan garis tren dan trailing stop 0,382.',
      'Penulis sendiri mencontohkan sistem dua unit untuk kesederhanaan.'
    ],
    alat: 'long',
    rujukan: 'Carney, Bab 11'
  },
  {
    id: 'b11-tren-waktu',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Garis Tren, Sudut, dan Simetri Waktu',
    sub: 'Membedakan pergerakan besar dari reaksi kecil',
    paragraf: [
      'Ada dua jenis garis tren. Yang pertama mengikuti pembalikan dari PRZ dan berguna untuk menangkap reaksi singkat yang kemudian kembali ke tren dominan. Yang kedua ditarik dari titik A dan C (pada pola bullish: garis tren turun dari dua puncak); garis ini sering bertemu IPO 0,382 dan menjadi batas tegas. Pembalikan yang mampu melampauinya berpeluang menjadi gerakan besar. Sudut juga diperhatikan: pembalikan valid umumnya bergaris tren curam, sedangkan gerak menyamping adalah tanda awal kegagalan.',
      'Untuk waktu, durasi X ke B diproyeksikan dari B untuk memperkirakan penyelesaian D (proyeksi setara 1,0). Perhitungan alternatif memakai rasio 0,382 sampai 1,618. Minimal, pola belum dianggap selesai sebelum proyeksi waktu 0,382: jika X ke B memakan sepuluh hari, D belum layak sebelum sekitar empat hari setelah B. Kaki CD yang terlalu cepat adalah tanda bahaya. Proyeksi setara juga membantu menentukan PPZ, meskipun Carney menegaskan bahwa waktu tidak sepenting harga.'
    ],
    tabel: {
      kolom: ['Ukuran waktu', 'Cara hitung', 'Fungsi'],
      baris: [
        ['Proyeksi setara (1,0)', 'Durasi X ke B diproyeksikan dari B', 'Perkiraan penyelesaian D pada pola paling simetris; acuan PPZ'],
        ['Proyeksi alternatif', 'Rasio 0,382 sampai 1,618 dari durasi X ke B', 'Rentang waktu penyelesaian yang dapat diterima'],
        ['Minimum 0,382', '0,382 x durasi X ke B', 'Filter pola yang selesai terlalu cepat']
      ]
    },
    alat: 'long',
    rujukan: 'Carney, Bab 11'
  },
  {
    id: 'b11-contoh-ge',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Contoh Terapan: General Electric',
    sub: 'Kelelawar Bullish harian, rekomendasi 17 Oktober 2003',
    paragraf: [
      'Contoh GE memperlihatkan seluruh sistem bekerja. PRZ ditentukan oleh konvergensi beberapa angka di bawah 28, transaksi dieksekusi di batas bawah zona, dan stop loss dinaikkan bertahap sehingga PPZ makin lebar. Rekomendasi awal juga menyebut stop di 25,50 (risiko sekitar 2 poin) dan target laba awal 32,80.',
      'Aspek waktunya patut dicatat: kaki CD selesai setelah proyeksi waktu minimum 0,382, tetapi lonjakan baru terjadi setelah proyeksi setara 1,0 tercapai beberapa minggu kemudian. Sampai titik itu, laba kecil seharusnya dilindungi. Setelahnya, posisi dipertahankan selama garis tren naik dan trailing stop 0,382 belum ditembus.'
    ],
    tabel: {
      kolom: ['Unsur', 'Nilai di buku'],
      baris: [
        ['PRZ', '0,886 XA di 27,50; 1,618 BC di 27,65; Alt 1,27 AB=CD di 28,05'],
        ['Eksekusi', '18 November di 27,50 (retracement 0,886)'],
        ['IPO 0,382', '29,50, berimpit dengan garis tren turun dari puncak pola'],
        ['Target 0,618', 'Tercapai cepat dengan kelanjutan bullish kuat'],
        ['Geser stop (24 November)', 'Dari 27,50 ke 28,50, mengunci 1 poin'],
        ['Geser stop (18 Desember)', 'Dari 28,50 ke 30, mengunci 3 poin']
      ]
    },
    alat: 'long',
    rujukan: 'Carney, Bab 11'
  },
  {
    id: 'b11-contoh-lain',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Contoh Lain dan Tips Manajemen',
    sub: 'Dari reaksi kecil sampai pembalikan home-run',
    paragraf: [
      'Tiga contoh berikut menunjukkan spektrum hasil. NQ dan ES hanya menghasilkan reaksi terbatas yang ditutup sekitar IPO, sedangkan DIA menjadi pembalikan besar yang melewati semua target. Carney menekankan bahwa kasus seperti ES lebih mewakili kebanyakan pola harmonik daripada skenario home-run, terutama pada grafik intrahari, sehingga laba parsial di IPO perlu diambil secara agresif.',
      'Tips penutupnya: bersiap untuk segala kemungkinan, ikuti aturan, hormati bar harga di level harmonik, cari kelanjutan, terima kerugian sebagai bagian dari bisnis, dan bila ragu, keluar.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik dan pola', 'Angka kunci', 'Hasil manajemen'],
      baris: [
        ['Mini NASDAQ (NQ_Z3)', '30 menit, Kepiting Bullish', '1,618 XA 1360,40; 3,618 BC 1362; IPO 0,382 di 1377', 'Lewat IPO, gagal ke 0,618, garis tren naik patah; posisi long ditutup'],
        ['Mini S&P 500 (ES_U3)', '15 menit, Gartley Bearish', 'PRZ 1018-1019,25; IPO 0,382 di 1015,68', 'Tertahan di IPO; short ditutup sekitar 1015 dengan laba kecil'],
        ['Dow Diamonds (DIA)', '30 menit, Kupu-kupu Bearish', '1,27 XA 96,07; 2,24 BC; IPO 0,382 di 95,70', 'Berbalik tepat pada waktu 1,0; melewati 0,618, 0,886, hingga di luar 1,618; keluar via trailing 0,382 di 94,25']
      ]
    },
    alat: 'short',
    rujukan: 'Carney, Bab 11'
  },

  // ---------------- Bab 12: Pelanggaran Pola ----------------
  {
    id: 'b12-konsep',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Pelanggaran Pola sebagai Sinyal Kelanjutan',
    sub: 'Kegagalan pola mengungkap kekuatan tren dominan',
    paragraf: [
      'Antisipasi terhadap pola yang tampak sempurna dapat membuat penilaian bias. Pola harmonik memang menandai level kritis, tetapi tren dominan pada akhirnya sering menembus level tersebut. Carney memandang kegagalan pola bukan semata kerugian, melainkan bukti kuatnya tren yang dapat dimanfaatkan.',
      'Strategi ini bersikap netral: eksekusi tidak terbatas pada titik penyelesaian, tetapi juga pada aksi harga di luar PRZ yang dilanggar. Karena ruang geraknya sempit, manajemen perdagangan dan stop loss yang ketat menjadi lebih penting, dan stop-out berulang sebelum tren berlanjut adalah risiko yang harus diterima.'
    ],
    poin: [
      'Dua aturan yang ditekankan penulis: tidak semua pola sama, dan tidak semua pembalikan sama.',
      'Bagi investor ritel BEI yang aksesnya ke transaksi short terbatas, pelanggaran pola bullish lebih realistis dipakai sebagai sinyal keluar atau menahan diri daripada membuka posisi jual.'
    ],
    rujukan: 'Carney, Bab 12'
  },
  {
    id: 'b12-tips',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Kaidah Membalik Posisi pada Pola Gagal',
    sub: 'T-bar sebagai batas pelanggaran',
    paragraf: [
      'Pola baru dianggap gagal setelah seluruh PRZ teruji dan memberi reaksi awal yang lengkap, lalu harga melanjutkan tren melewati zona. T-bar, yaitu bar pertama yang menguji seluruh PRZ, menjadi batas penentu pelanggaran sekaligus acuan entri posisi berlawanan.',
      'Transaksi pembalikan umumnya dilakukan satu atau dua bar setelah T-bar ditembus, dan pelanggaran idealnya ditutup di luar zona. Stop loss ditetapkan sejak awal berdasarkan rentang PRZ sebelumnya dan ekstrem T-bar, kemudian digeser mengikuti bar sebelumnya selama harga terus bergerak searah tren.'
    ],
    tabel: {
      kolom: ['Kaidah', 'Pola bullish gagal', 'Pola bearish gagal'],
      baris: [
        ['Gejala awal', 'Reaksi impuls 1-2 bar lalu berguling; garis tren cepat patah, rendah bar sebelumnya ditembus', 'Reaksi awal lalu kembali menguji PRZ'],
        ['Pemicu', 'Penutupan di bawah T-bar dan PRZ', 'Penembusan di atas T-bar (breakout harmonik)'],
        ['Stop loss awal', 'Di atas rentang PRZ sebelumnya / ekstrem T-bar', 'Di bawah rentang PRZ sebelumnya / ekstrem T-bar'],
        ['Lanjutan', 'Stop mengikuti bar sebelumnya', 'Stop mengikuti bar sebelumnya']
      ]
    },
    alat: 'short',
    rujukan: 'Carney, Bab 12'
  },
  {
    id: 'b12-contoh',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'Contoh Pola Bullish dan Bearish yang Gagal',
    sub: 'Pantulan singkat, uji ulang PRZ, lalu T-bar ditembus',
    paragraf: [
      'Pada contoh bullish, pola sempat memberi pantulan yang menguntungkan, tetapi gagal melanjutkan setelah minggu kedua dan kembali menguji seluruh PRZ. Uji ulang ini sudah menjadi tanda bahaya; posisi long semestinya keluar di PPZ, dan posisi short baru dibenarkan setelah T-bar ditembus.',
      'Pada contoh bearish, Carney menyebut pelanggaran ke atas sebagai breakout harmonik. Penembusan ini dinilai sangat berarti pada pola retracement seperti Bat dan Gartley. Kelanjutan tajam biasanya baru terjadi setelah T-bar terlampaui.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik dan pola', 'Level kunci', 'Hasil'],
      baris: [
        ['Dow Jones ($INDU)', 'Mingguan, Kepiting Bullish', 'Keluar PPZ dekat 11.200; T-bar ditembus di 10.700; stop short di atas 11.300', 'Turun tajam pada pasar bearish 2009; stop 1-bar sudah memadai'],
        ['IBM', 'Mingguan, Kupu-kupu Bullish (1,27 XA, 1,618 BC, AB=CD tepat di bawah 80)', 'Naik ke 85; keluar PPZ antara 80 dan entri di bawah 77; T-bar ditembus di 76', 'Pantulan sekitar 9 poin, lalu turun mengikuti garis tren turun'],
        ['Intel (INTC)', '60 menit, AB=CD gagal', 'T-bar ditembus di atas 16,65; gap naik hari berikutnya', 'Naik berlanjut dengan dukungan garis tren'],
        ['Amazon (AMZN)', 'Mingguan, Kupu-kupu Bearish (zona short 25,75-26,95)', 'T-bar ditembus di atas 28', 'Reli berlanjut selama beberapa minggu']
      ]
    },
    alat: 'short',
    rujukan: 'Carney, Bab 12'
  },
  {
    id: 'b12-sr',
    bagian: 'Eksekusi dan Manajemen',
    judul: 'PRZ Lama: Support Menjadi Resistance',
    sub: 'Pola sebagai peta tindakan di masa depan',
    paragraf: [
      'Prinsip klasik analisis teknikal menyatakan support yang ditembus menjadi resistance, dan sebaliknya. Carney menerapkannya pada PRZ: setelah pola bullish dilanggar, support harmonik lama cenderung menjadi resistance saat diuji ulang; setelah pola bearish dilanggar, resistance harmonik lama cenderung menjadi support.',
      'Menurut penulis, inilah alasan pola harmonik disebut peta tindakan di masa depan. Bahkan ketika pembalikan gagal, perilaku harga di titik penyelesaian memberi sinyal jelas tentang kelanjutan tren, dan PRZ lama tetap layak digabungkan dengan pola yang sedang terbentuk untuk menentukan peluang berikutnya.'
    ],
    tabel: {
      kolom: ['Pasar / kode', 'Grafik dan pola', 'Pengamatan'],
      baris: [
        ['Mini NASDAQ (NQ_#F)', '15 menit, Kelelawar Bullish di sekitar 1780', 'Support jebol pada pra-pasar; reli kemudian tertahan di support lama yang kini menjadi resistance'],
        ['Semiconductor HOLDRs (SMH)', '10 menit, Kepiting Bearish Dalam', 'Gap jauh di atas PRZ; isi gap lalu memantul di resistance lama yang kini menjadi support']
      ]
    },
    poin: [
      'Untuk saham BEI, PRZ yang ditembus dapat dicatat sebagai level penting dan ditandai di grafik untuk uji ulang berikutnya.'
    ],
    alat: 'xabcd',
    rujukan: 'Carney, Bab 12'
  }
]
