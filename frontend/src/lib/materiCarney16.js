// Ringkasan Bab 1–6 Scott M. Carney, Harmonic Trading Vol. 1 (terjemahan Indonesia) sebagai slide tab Materi:
// Landasan Teori (Bab 1–3) dan Pembahasan Pola (Bab 4–6). Ditulis ulang dengan kata sendiri; angka dari teks buku,
// contoh yang angkanya bertentangan di buku tidak dipakai. Skema slide: lihat harmonikMateri.js. Data murni.
export const BAB_1_6 = [
  // ===================== BAB 1: PERDAGANGAN HARMONIS =====================
  {
    id: 'b1-definisi',
    bagian: 'Landasan Teori',
    judul: 'Hakikat Harmonic Trading',
    sub: 'Pengenalan struktur harga yang diukur dengan rasio Fibonacci berurutan',
    paragraf: [
      'Carney mendefinisikan Harmonic Trading sebagai metodologi yang mengenali struktur harga tertentu, yaitu struktur yang titik-titiknya memenuhi rangkaian rasio Fibonacci yang khas dan berurutan. Rangkaian rasio inilah yang sekaligus mengukur dan memvalidasi sebuah pola harmonik, lalu dipakai untuk memperkirakan titik pembalikan yang berpeluang tinggi.',
      'Asumsi dasarnya adalah bahwa pola dan siklus harga, seperti banyak siklus pertumbuhan di alam, cenderung berulang. Aksi harga dipandang sebagai rekaman kolektif keputusan beli dan jual yang digerakkan rasa takut dan serakah, sehingga tahap pertumbuhan dan penurunannya dapat diukur secara relatif dengan proporsi Fibonacci.',
      'Penulis menekankan bahwa menguasai syarat setiap struktur baru langkah awal. Dibutuhkan pengalaman untuk membedakan struktur yang sungguh layak diperdagangkan dari struktur yang hanya mirip.'
    ],
    poin: [
      'Objek analisis: struktur harga dengan penjajaran (alignment) rasio Fibonacci yang spesifik.',
      'Tujuan: menemukan area pembalikan dengan pertimbangan risiko terhadap imbal hasil yang menguntungkan.',
      'Grafik harga diperlakukan sebagai sumber sinyal; pola adalah "rambu" teknis atas kemungkinan aksi harga berikutnya.',
      'Pada saham BEI, prinsip yang sama dapat diterapkan pada grafik harian maupun mingguan, karena kerangka ini tidak terikat pada satu pasar.'
    ],
    rujukan: 'Carney, Bab 1'
  },
  {
    id: 'b1-keteraturan',
    bagian: 'Landasan Teori',
    judul: 'Keteraturan dalam Kekacauan Pasar',
    sub: 'Posisi Harmonic Trading terhadap Teori Jalan Acak',
    paragraf: [
      'Bab ini menempatkan Harmonic Trading berhadapan dengan Teori Jalan Acak yang dipopulerkan lewat buku suntingan Paul H. Cootner (MIT Press, 1964). Teori tersebut menganggap pergerakan harga sebagai rangkaian yang saling bebas sehingga riwayat harga tidak dapat diandalkan untuk menduga harga berikutnya.',
      'Carney mengakui bahwa apa pun bisa terjadi di pasar, tetapi berargumen bahwa di dalam keacakan itu tetap ada tingkat pengulangan. Ia mencontohkan level support dan resistance serta garis tren yang berulang kali memengaruhi aksi harga, dan pola musiman seperti koreksi yang kerap terjadi pada bulan Oktober.',
      'Keunggulan metode ini, menurut penulis, terletak pada ketepatan identifikasi pola. Setiap pola berfungsi sebagai model yang mendasari keputusan, dan setelah pola teridentifikasi, posisi dikelola dengan aturan yang khusus untuk situasi tersebut.'
    ],
    poin: [
      'Premis: pola harga yang terbukti berulang secara historis dapat dikenali dalam keacakan pasar.',
      'Ketepatan penjajaran rasio menghasilkan pendekatan yang konsisten dan dapat diulang.',
      'Setiap jenis pola membawa seperangkat aturan pengelolaan posisi tersendiri.'
    ],
    rujukan: 'Carney, Bab 1'
  },
  {
    id: 'b1-tiga-tahap',
    bagian: 'Landasan Teori',
    judul: 'Tiga Tahapan Harmonic Trading',
    sub: 'Identifikasi, eksekusi, dan manajemen perdagangan',
    paragraf: [
      'Carney menegaskan bahwa identifikasi pola yang valid belum cukup. Sistem perdagangan apa pun harus menemukan peluang, memutuskan eksekusi, lalu mengelola posisi sampai ditutup; Harmonic Trading menata ketiganya dengan aturan yang tegas.',
      'Bagi pembaca yang baru mengenal pendekatan ini, penulis menyarankan agar identifikasi pola dipahami tuntas sebelum mencoba bertransaksi. Inti metode ini adalah kemampuan membedakan struktur harga berdasarkan penjajaran rasio Fibonacci berurutan yang spesifik, sedangkan eksekusi dan manajemen menjadi syarat untuk memperoleh hasil secara konsisten.'
    ],
    tabel: {
      kolom: ['Tahap', 'Pertanyaan pokok', 'Isi menurut Carney'],
      baris: [
        ['1. Identifikasi', 'Apakah ada pola yang valid?', 'Mengenali dan membedakan pola harmonik yang dikuantifikasi oleh penjajaran rasio Fibonacci; memanfaatkan sinyal jenuh beli dan jenuh jual dari aksi harga.'],
        ['2. Eksekusi', 'Apakah perdagangan dijalankan?', 'Menilai validitas pola dalam rentang waktu yang ditentukan oleh peluang, lalu memutuskan masuk atau tidak.'],
        ['3. Manajemen', 'Bagaimana posisi dikelola?', 'Mengelola posisi dengan aturan khusus untuk memaksimalkan keuntungan sekaligus menekan risiko.']
      ]
    },
    rujukan: 'Carney, Bab 1'
  },

  // ===================== BAB 2: ANGKA FIBONACCI =====================
  {
    id: 'b2-deret',
    bagian: 'Landasan Teori',
    judul: 'Deret Fibonacci dan Rasio Emas',
    sub: 'Dari soal kelinci Liber Abaci ke konstanta 0,618 dan 1,618',
    paragraf: [
      'Deret Fibonacci berasal dari Leonardo de Pisa (sekitar 1170-1240) dalam Liber Abaci, salah satu naskah Latin awal tentang sistem bilangan Hindu-Arab. Deret ini lahir sebagai jawaban atas soal pertumbuhan pasangan kelinci, dengan aturan setiap suku merupakan jumlah dua suku sebelumnya: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, dan seterusnya.',
      'Setelah beberapa langkah awal, perbandingan suku-suku yang bertetangga menjadi relatif konstan. Pembagian suatu suku dengan suku sesudahnya mendekati 0,618, sedangkan pembagian sebaliknya mendekati 1,618. Dalam matematika, 1,618 dikenal sebagai Phi atau angka emas, dan kebalikannya 0,618 sering disebut phi kecil.',
      'Konsep bagian emas memperlihatkan bahwa sebuah garis dapat dibagi sehingga perbandingan bagian kecil terhadap bagian besar sama dengan perbandingan bagian besar terhadap keseluruhan. Dari pembagian ini muncul pula 0,382 dan 2,618 (1 + 1,618).'
    ],
    tabel: {
      kolom: ['Perhitungan', 'Hasil', 'Pembulatan'],
      baris: [
        ['34 / 55', '0,618181', '0,618'],
        ['55 / 89', '0,617978', '0,618'],
        ['89 / 55', '1,618182', '1,618'],
        ['1 / 0,382', '2,618', '1 + 1,618']
      ]
    },
    alat: 'fib',
    rujukan: 'Carney, Bab 2'
  },
  {
    id: 'b2-alam',
    bagian: 'Landasan Teori',
    judul: 'Proporsi Emas di Alam dan Batas Penafsirannya',
    sub: 'Contoh empiris yang dikutip Carney sebagai latar filosofis',
    paragraf: [
      'Carney menghimpun sejumlah contoh untuk menunjukkan bahwa angka Fibonacci dan proporsi emas muncul berulang di alam: susunan biji dan kelopak tumbuhan, spiral cangkang Nautilus, proporsi tubuh manusia, hingga perbandingan periode orbit planet. Contoh-contoh ini berfungsi sebagai argumen bahwa siklus pertumbuhan alami dapat diukur dengan rasio relatif.',
      'Meski demikian, penulis mengingatkan agar pembaca tidak terjebak pada pertanyaan mengapa hubungan ini ada. Mengikuti sikap W. D. Gann, fokusnya adalah penerapan strategi yang bekerja secara konsisten, bukan pembenaran filosofis. Ia juga menegaskan bahwa Harmonic Trading bukan astrologi dan tidak berkaitan dengan keselarasan planet.'
    ],
    tabel: {
      kolom: ['Contoh', 'Keterangan dalam buku'],
      baris: [
        ['Phyllotaxis', 'Survei 650 spesies dan 12.500 spesimen (R. V. Jean, 1994) memperkirakan sekitar 92% memiliki pola Fibonacci.'],
        ['Kelopak bunga', 'Buttercup 5 kelopak, lili 3, sebagian delphinium 8, aster 34, 55, atau 89.'],
        ['Orbit Venus', '225 / 365 = 0,616 (mendekati 0,618); kebalikannya 365 / 225 = 1,622 (mendekati 1,618).'],
        ['DNA', 'Satu siklus heliks ganda berukuran 34 x 21 angstrom, dua suku Fibonacci yang berurutan.'],
        ['Cangkang Nautilus', 'Titik potong luar berjarak sekitar 1,618 kali dari pusat dibanding titik potong dalam.']
      ]
    },
    rujukan: 'Carney, Bab 2'
  },
  {
    id: 'b2-rasio',
    bagian: 'Landasan Teori',
    judul: 'Rasio Baku Harmonic Trading',
    sub: 'Satu-satunya himpunan rasio yang dipakai untuk mendefinisikan pola',
    paragraf: [
      'Semua rasio Harmonic Trading diturunkan, langsung atau tidak langsung, dari dua rasio utama 0,618 dan 1,618. Carney mencatat bahwa sebagian rasio seperti Pi (3,14) lebih terkait dengan geometri kuno daripada dihitung dari deret, tetapi tetap efektif bila digabung dengan rasio utama.',
      'Penulis menyatakan bahwa 0,618 dan 1,618 sudah lama dipakai dalam Teori Gelombang Elliott, sehingga keunikan Harmonic Trading bukan pada angkanya, melainkan pada kombinasi penjajaran rasio yang spesifik untuk tiap pola. Rasio seperti 0,886 dan kebalikannya 1,13 disebut khas metode ini.'
    ],
    tabel: {
      kolom: ['Kelompok', 'Rasio', 'Asal'],
      baris: [
        ['Utama', '0,618', 'Rasio primer, langsung dari deret Fibonacci'],
        ['Utama', '1,618', 'Proyeksi primer, langsung dari deret Fibonacci'],
        ['Turunan primer', '0,786', 'Akar kuadrat 0,618'],
        ['Turunan primer', '0,886', 'Akar pangkat empat 0,618 (akar kuadrat 0,786)'],
        ['Turunan primer', '1,13', 'Akar pangkat empat 1,618 (akar kuadrat 1,27)'],
        ['Turunan primer', '1,27', 'Akar kuadrat 1,618'],
        ['Pelengkap', '0,382', '1 - 0,618, atau 0,618 kuadrat'],
        ['Pelengkap', '0,50 dan 0,707', '0,707 kuadrat = 0,50; 0,707 = akar kuadrat 0,50'],
        ['Pelengkap', '1,41', 'Akar kuadrat 2,0'],
        ['Pelengkap', '2,0 dan 2,24', '1 + 1; akar kuadrat 5'],
        ['Pelengkap', '2,618', '1,618 kuadrat'],
        ['Pelengkap', '3,14 dan 3,618', 'Pi; 1 + 2,618']
      ]
    },
    alat: 'fib',
    rujukan: 'Carney, Bab 2'
  },
  {
    id: 'b2-retracement',
    bagian: 'Landasan Teori',
    judul: 'Fungsi Setiap Level Retracement',
    sub: '0,618, 0,786, 0,886 sebagai penentu; 0,382, 0,50, 0,707 sebagai pembeda',
    paragraf: [
      'Retracement 0,618 adalah ciri penentu pola Gartley dan Crab pada titik B, serta menjadi titik C dalam AB=CD yang ideal. Turunannya, 0,786 dan 0,886, tampak berdekatan tetapi menurut Carney selisih 78,6% dan 88,6% bukan sekadar 10%: 0,886 adalah level yang membedakan pola Bat dari pola Gartley.',
      'Penulis lebih mengutamakan 0,886 karena dinilai lebih kritis di sebagian besar pola, sedangkan 0,786 hanya menjadi angka harmonik yang cukup penting pada Gartley ideal. Asal-usul 0,886 dijelaskan sebagai hasil kerja sama Carney dengan Jim Kane, yang menghitungnya sebagai akar pangkat empat 0,618. Retracement sekunder tidak pernah dipakai sendirian untuk eksekusi, tetapi penting untuk membedakan struktur yang serupa.'
    ],
    tabel: {
      kolom: ['Level', 'Peran dalam pola menurut Carney'],
      baris: [
        ['0,618', 'Titik B wajib pada Gartley (nyaris tepat); titik B pada Crab; titik C dalam AB=CD ideal.'],
        ['0,786', 'Titik D pada Gartley ideal; selain itu umumnya pelengkap.'],
        ['0,886', 'Retracement terpenting pola Bat; angka kritis pada Deep Crab di titik B.'],
        ['0,382 dan 0,50', 'Titik B wajib pada Bat (dan sering pada Crab); 0,50 lebih umum. 0,382 juga target keuntungan awal setelah pembalikan.'],
        ['0,707', 'Retracement perantara di dalam struktur 5 titik; jarang dipakai.']
      ]
    },
    alat: 'fib',
    rujukan: 'Carney, Bab 2'
  },
  {
    id: 'b2-proyeksi',
    bagian: 'Landasan Teori',
    judul: 'Fungsi Setiap Level Proyeksi',
    sub: 'Dari 1,13 hingga angka ekstrem 3,618',
    paragraf: [
      'Proyeksi 1,618 menandai keadaan aksi harga yang ekstrem dan sering menjadi angka paling kritis dalam Zona Pembalikan Potensial (PRZ). Carney mencatat bahwa 1,618 lebih sering dipakai sebagai titik masuk dibanding kebalikannya, 0,618, yang lebih berfungsi mendefinisikan struktur.',
      'Proyeksi lain bersifat pelengkap: nilainya muncul ketika berkumpul dengan angka yang lebih penting di PRZ. Angka-angka ekstrem (2,618, 3,14, 3,618) terutama dipakai sebagai proyeksi BC pada pola Crab dan Deep Crab. Untuk saham BEI yang bergerak dengan fraksi harga tertentu, konvergensi beberapa proyeksi sebaiknya dibaca sebagai zona, bukan satu angka tunggal.'
    ],
    tabel: {
      kolom: ['Proyeksi', 'Peran dalam pola menurut Carney'],
      baris: [
        ['1,618', 'Penentu pada Crab dan Deep Crab; elemen penting pada Bat; efektif di kerangka intra-hari.'],
        ['1,13 dan 1,27', 'Kurang penting dibanding 1,618; 1,27 XA adalah angka utama PRZ Butterfly; proyeksi BC 1,27 sering muncul pada Gartley ideal.'],
        ['1,41', 'Umum pada Gartley dan AB=CD; efektif bila melengkapi angka lain.'],
        ['2,0 dan 2,24', 'Melengkapi proyeksi yang lebih ekstrem pada Bat, Butterfly, dan Crab; pada AB=CD biasanya terkait aksi harga ekstrem.'],
        ['2,618, 3,14, 3,618', 'Angka ekstrem; terutama sebagai proyeksi BC pada Crab dan Deep Crab. 3,618 umumnya hanya pelengkap.']
      ]
    },
    alat: 'ext',
    rujukan: 'Carney, Bab 2'
  },

  // ===================== BAB 3: IDENTIFIKASI POLA =====================
  {
    id: 'b3-definisi',
    bagian: 'Landasan Teori',
    judul: 'Pola Harmonik sebagai Entitas Teknis',
    sub: 'Struktur harga yang setiap titiknya diukur dengan Fibonacci',
    paragraf: [
      'Pola harmonik didefinisikan sebagai struktur harga yang memuat kombinasi retracement dan proyeksi Fibonacci yang berbeda dan berurutan. Dengan menghitung aspek-aspek Fibonacci tersebut, pola menunjuk area tertentu yang perlu diamati sebagai calon titik balik.',
      'Seperti pola klasik Head and Shoulders atau wedge, bentuk aksi harga menjadi faktor validasi utama. Bedanya, setiap titik pola harmonik diukur dengan rasio tertentu sehingga struktur yang tampak mirip dapat dikategorikan sebagai entitas teknis yang berbeda, masing-masing dengan strategi sendiri.'
    ],
    poin: [
      'Titik-titik pola diberi huruf X, A, B, C, D, dan setiap kaki ditulis XA, AB, BC, CD.',
      'Titik tengah B disebut titik paling signifikan dalam semua pola harmonik, karena paling menentukan jenis pola.',
      'Penjajaran setiap pola bersifat tepat dan tidak boleh dilanggar.',
      'Struktur yang serupa belum tentu sama; setiap pola harus didefinisikan secara presisi.'
    ],
    alat: 'xabcd',
    rujukan: 'Carney, Bab 3'
  },
  {
    id: 'b3-elliott-gann',
    bagian: 'Landasan Teori',
    judul: 'Akar Teoretis: Elliott, Gann, dan Hurst',
    sub: 'Posisi Harmonic Trading di antara pendahulunya',
    paragraf: [
      'Carney menyebut analisis struktur harmonik bertumpu pada geometri sederhana dan menyerupai teknik pengukuran Elliott Wave. Pola korektif "M" dan "W" (abc maupun abcde) dalam Elliott dipersempit oleh Harmonic Trading menjadi pola-pola unik yang setiap aspeknya dikuantifikasi. Perbedaannya, Elliott memberi ruang variasi yang lebih besar, sedangkan Harmonic Trading tidak mengizinkan penyimpangan dari penjajaran yang ditetapkan.',
      'W. D. Gann ditempatkan sebagai salah satu pelopor, karena dalam The Tunnel Thru the Air (1927) ia menyebut analisis harmonik dan teori siklus sebagai dasar untuk memahami masa depan. Buku ini juga mencatat kinerja Gann pada 1933: 479 transaksi, 422 menang dan 57 kalah, dengan rujukan ke situs W. D. Gann. Kontribusi J. M. Hurst dibahas pada slide berikutnya.'
    ],
    tabel: {
      kolom: ['Aspek', 'Elliott Wave dasar', 'Harmonic Trading'],
      baris: [
        ['Fokus', 'Hitungan gelombang dan struktur umum', 'Pergerakan harga tertentu dengan rasio tepat'],
        ['Penamaan', 'Angka dan huruf gelombang', 'Huruf titik: XA, AB, BC, CD'],
        ['Toleransi variasi', 'Relatif longgar', 'Tidak ada variasi dari penjajaran yang ditetapkan'],
        ['Titik terpenting', 'Bergantung hitungan', 'Titik B (titik tengah)']
      ]
    },
    rujukan: 'Carney, Bab 3'
  },
  {
    id: 'b3-harmonisitas',
    bagian: 'Landasan Teori',
    judul: 'Prinsip Harmonisitas dan Diferensiasi Pola',
    sub: 'Gelombang tetangga saling berkaitan; struktur mirip belum tentu sama',
    paragraf: [
      'Prinsip Harmonisitas berasal dari J. M. Hurst dalam Cycles Course (1973). Intinya, periode gelombang harga yang bertetangga cenderung berhubungan dengan perbandingan bilangan bulat kecil. Carney memakai prinsip ini sebagai premis: gelombang harga saling terkait, dan rasio Fibonacci dipakai untuk mengukur hubungan tersebut serta menentukan lokasi titik balik.',
      'Konsekuensinya, keputusan didasarkan pada aksi harga murni, bukan berita. Pola menciptakan "bidang perdagangan" yang batasnya ditentukan sebelumnya: titik eksekusi, batas stop loss, dan target keuntungan semuanya relatif terhadap struktur. Sinyal berasal dari pasar, karena harga harus memenuhi kondisi pola sebelum tindakan diambil.',
      'Diferensiasi disebut kunci keberhasilan. Penerapan aturan yang ketat memang dapat membuat sebagian peluang terlewat, tetapi menghilangkan tafsir longgar yang berbahaya. Contoh yang terus diulang Carney adalah kekeliruan umum menyebut pola Bat sebagai Gartley.'
    ],
    poin: [
      'Struktur valid menjadi sinyal hanya jika seluruh syaratnya terpenuhi.',
      'Membedakan struktur yang mirip dapat menurunkan risiko karena PRZ menjadi lebih tepat.',
      'Penerapan sistem yang ketat menjadi dasar kinerja yang konsisten.'
    ],
    alat: 'xabcd',
    rujukan: 'Carney, Bab 3'
  },
  {
    id: 'b3-prz',
    bagian: 'Landasan Teori',
    judul: 'Zona Pembalikan Potensial (PRZ)',
    sub: 'Konvergensi tiga atau lebih angka harmonik dalam satu area',
    paragraf: [
      'PRZ, yang pertama kali diuraikan dalam The Harmonic Trader (1999), adalah area tempat beberapa angka Fibonacci dari satu struktur berkumpul. Bila tiga, empat, atau lima angka bertemu dalam rentang sempit, peluang terjadinya pembalikan dianggap tinggi. Struktur dengan tiga angka atau lebih dalam area yang ditentukan menjadi dasar pendefinisian zona ini.',
      'Kata potensial dipakai karena zona tersebut masih harus diuji oleh aksi harga. PRZ berfungsi sebagai jendela untuk mengamati apakah kondisi jenuh beli atau jenuh jual berbalik, setidaknya kembali ke keseimbangan. Hasil aksi harga di dalam zona ini menjadi unsur penentu berikutnya, bukan sekadar angka di atas kertas.'
    ],
    poin: [
      'PRZ adalah area, bukan satu harga; batas-batasnya berasal dari angka harmonik yang berbeda.',
      'Pengamatan dipusatkan pada perilaku harga setelah seluruh angka di zona diuji.',
      'Pada saham BEI, rentang PRZ yang terlalu sempit perlu dibandingkan dengan fraksi harga agar zona tetap bermakna.'
    ],
    alat: 'xabcd',
    rujukan: 'Carney, Bab 3'
  },

  // ===================== BAB 4: POLA AB=CD =====================
  {
    id: 'b4-definisi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola AB=CD',
    sub: 'Struktur 4 titik yang menjadi fondasi semua pola harmonik',
    paragraf: [
      'AB=CD adalah struktur 4 titik: kaki awal AB dikoreksi sebagian hingga titik C, lalu disusul kaki CD yang panjangnya setara dengan AB. Carney menyebutnya fondasi bagi semua pola harmonik, karena dukungan atau tahanan pada akhir dua kaki harga yang berurutan adalah inti seluruh pendekatan.',
      'Titik C menjadi level yang menentukan bagi penyelesaian pola. Meskipun proyeksi BC penting, angka yang paling signifikan adalah titik penyelesaian AB=CD itu sendiri; penyelesaian ini diperlakukan sebagai syarat wajib sebelum bertransaksi, dan proyeksi BC harus melengkapinya.'
    ],
    poin: [
      'Retracement titik C terhadap AB: 0,382 sampai 0,886 (0,382, 0,50, 0,618, 0,707, 0,786, atau 0,886).',
      'Proyeksi BC yang berpasangan: 1,13, 1,27, 1,41, 1,618, 2,0, 2,24, atau 2,618; dalam kasus jarang 3,14.',
      'Bullish: D di bawah C, mencari area beli setelah aksi jual yang jelas. Bearish: D di atas C, mencari area jual.',
      'Simetri kedua kaki boleh bervariasi, tetapi struktur dasar ini adalah syarat minimum setiap pola harmonik.'
    ],
    pola: 'abcd',
    alat: 'ext',
    rujukan: 'Carney, Bab 4'
  },
  {
    id: 'b4-timbal-balik',
    bagian: 'Pembahasan Pola',
    judul: 'Rasio Timbal Balik AB=CD',
    sub: 'Retracement titik C menentukan proyeksi BC yang dipakai',
    paragraf: [
      'Carney menjelaskan bahwa penjajaran rasio dalam AB=CD biasanya menunjukkan hubungan timbal balik: makin dalam retracement titik C, makin kecil proyeksi BC yang mendekati titik penyelesaian. Contoh yang disebut eksplisit dalam teks adalah retracement 0,618 yang berpasangan dengan proyeksi BC 1,618.',
      'Hubungan ini membantu menentukan penyelesaian pola, tetapi pertimbangan utamanya tetap sama: proyeksi BC harus konvergen erat dengan titik penyelesaian AB=CD. Bila keduanya berjauhan, PRZ menjadi lebar dan kualitas struktur menurun.'
    ],
    tabel: {
      kolom: ['Retracement titik C', 'Proyeksi BC timbal balik'],
      baris: [
        ['0,382', '2,24 atau 2,618'],
        ['0,50', '2,0'],
        ['0,618', '1,618'],
        ['0,707', '1,41'],
        ['0,786', '1,27'],
        ['0,886', '1,13']
      ]
    },
    alat: 'ext',
    rujukan: 'Carney, Bab 4'
  },
  {
    id: 'b4-contoh',
    bagian: 'Pembahasan Pola',
    judul: 'Contoh AB=CD di Pasar Saham dan Indeks',
    sub: 'Ilustrasi dari buku: angka penyelesaian, proyeksi BC, dan hasil',
    paragraf: [
      'Contoh-contoh Carney mencakup grafik 5 menit hingga mingguan, dan ia menegaskan bahwa prinsip penilaian PRZ sama di semua kerangka waktu; yang berbeda hanya lamanya. Pada contoh Google, setiap kaki turun membutuhkan sekitar 6 bulan, dan harga sempat menembus sedikit di bawah titik penyelesaian 267 sebelum stabil seminggu setelah PRZ teruji penuh.',
      'Buku juga memuat contoh valas (EUR, AUD) dan kontrak mini S&P 500 dengan pola yang sama. Untuk saham BEI, padanan paling langsung adalah grafik harian dan mingguan, dengan catatan bahwa pembalikan kadang membutuhkan konsolidasi beberapa bar.'
    ],
    tabel: {
      kolom: ['Kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['GOOG (bullish)', 'Mingguan', 'AB=CD 267; BC 1,618 di 295 (PRZ sekitar 30 poin)', 'Stabil di sisi bawah zona, lalu reli membalik tren turun'],
        ['$INDU (bullish)', '5 menit', 'AB=CD 9306,75; BC 2,0 di 9312,21', 'Stabil tepat di atas 9300, reli intra-hari; kaki AB 8 bar, CD 7 bar'],
        ['NQ mini (bullish)', '15 menit', 'AB=CD dan BC 1,618 di sekitar 1353', 'Butuh beberapa uji dan konsolidasi sebelum berbalik'],
        ['GS (bearish)', '15 menit', 'AB=CD 147,28; BC 1,41 di 146,95', 'Tertahan di area 147, berbalik beberapa bar kemudian'],
        ['XAU (bearish)', 'Harian', 'C 0,618, BC 1,618; AB=CD 81,35 sebagai batas atas', 'Berbalik 1 poin di atas 81,35; AB 7 hari, CD 8 hari']
      ]
    },
    alat: 'ext',
    rujukan: 'Carney, Bab 4'
  },
  {
    id: 'b4-variasi',
    bagian: 'Pembahasan Pola',
    judul: 'AB=CD Alternatif dan AB=CD Sempurna',
    sub: 'Variasi panjang kaki CD dan bentuk paling harmonis',
    paragraf: [
      'AB=CD alternatif mengukur kaki CD sebagai kelipatan AB, terutama 1,27 atau 1,618. Variasi ini biasanya muncul pada pola dengan kaki CD yang memanjang, misalnya Crab dan Butterfly, dan berfungsi sebagai pelengkap angka lain di PRZ. Carney membedakan dua pola yang mirip lewat syarat ini: Gartley memakai AB=CD setara, sedangkan Bat umumnya memakai alternatif 1,27 AB=CD. Pada sebagian besar setup, AB=CD setara tetap syarat minimum.',
      'AB=CD sempurna memiliki titik C tepat di retracement 0,618, yang berpasangan dengan proyeksi BC 1,618, dan durasi kedua kaki yang setara. Pada versi bullish, titik penyelesaian AB=CD menjadi angka terendah di PRZ; pada versi bearish menjadi angka tertinggi. Contoh buku: kontrak mini NASDAQ 100 (grafik 10 menit) dengan kaki AB dan CD masing-masing enam bar dan penyelesaian di 1379.'
    ],
    tabel: {
      kolom: ['Jenis', 'Syarat utama', 'Catatan Carney'],
      baris: [
        ['AB=CD setara', 'CD = AB', 'Syarat minimum sebagian besar setup; dipakai Gartley'],
        ['Alternatif 1,27', 'CD = 1,27 x AB', 'Paling umum pada Bat; juga sering pada Butterfly'],
        ['Alternatif 1,618', 'CD = 1,618 x AB', 'Lebih jarang dipakai dibanding kombinasi AB=CD lain'],
        ['AB=CD sempurna', 'C = 0,618; BC = 1,618; durasi kaki setara', 'Struktur paling simetris; bearish sempurna sering menandai puncak intra-hari di pasar berjangka']
      ]
    },
    alat: 'ext',
    rujukan: 'Carney, Bab 4'
  },
  {
    id: 'b4-ringkasan',
    bagian: 'Pembahasan Pola',
    judul: 'Ringkasan dan Kekeliruan Umum AB=CD',
    sub: 'Syarat minimum dan cara menilai aksi harga di PRZ',
    paragraf: [
      'Carney mengkritik penyederhanaan yang menganggap setiap AB=CD yang selesai layak ditransaksikan. AB=CD membutuhkan konfirmasi berupa retracement atau proyeksi Fibonacci lain yang melengkapi titik penyelesaian; tanpa itu, struktur tersebut hanya kerangka dasar.',
      'Validitas pembalikan baru dapat dinilai setelah seluruh angka di PRZ diuji. Sebagian pembalikan terjadi seketika, sebagian lain membutuhkan konsolidasi atau beberapa kali uji; lama waktu yang wajar umumnya sebanding dengan ukuran pola. Penurunan yang sangat tajam menuju PRZ merupakan tanda peringatan, tetapi kemampuan harga untuk segera stabil di zona tersebut menjadi indikasi kuat pembalikan yang sah.'
    ],
    poin: [
      'Penyelesaian AB=CD minimum dengan kaki-kaki harga yang setara.',
      'Retracement titik C antara 0,382 dan 0,886; 0,618 lebih disukai.',
      'Proyeksi BC antara 1,13 dan 3,618, bergantung pada retracement titik C.',
      'Terdapat variasi AB=CD alternatif.',
      'Pembalikan yang sah ditandai harga mulai tertahan di angka-angka PRZ dan arah tren dominan berubah.'
    ],
    rujukan: 'Carney, Bab 4'
  },

  // ===================== BAB 5: POLA KELELAWAR (BAT) =====================
  {
    id: 'b5-definisi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola Kelelawar (Bat)',
    sub: 'Struktur korektif 5 titik dengan retracement 0,886 XA sebagai penentu',
    paragraf: [
      'Pola Bat diperkenalkan Carney pada 2001 dan disebutnya mungkin pola paling akurat dalam Harmonic Trading. Pola ini biasanya mewakili uji ulang yang dalam terhadap support atau resistance, dan pembalikan dari PRZ-nya kerap cepat serta tajam.',
      'Ciri utamanya adalah titik B yang retracement-nya kurang dari 0,618 kaki XA, idealnya 0,50, dan titik D pada retracement 0,886 XA. Jika sebuah pola terbentuk dengan titik B tepat di 0,50, besar kemungkinan pola itu Bat. Karena akurasinya, pola ini umumnya membutuhkan stop loss yang lebih kecil dibanding sebagian besar pola lain.'
    ],
    tabel: {
      kolom: ['Elemen', 'Syarat pola Bat'],
      baris: [
        ['Titik B', 'Kurang dari 0,618 XA; lebih disukai 0,50 atau 0,382'],
        ['Titik C', 'Retracement 0,382 sampai 0,886 dari AB'],
        ['Proyeksi BC', 'Minimal 1,618, dapat mencapai 2,618; paling ideal 1,618 atau 2,0. Proyeksi 1,27 membatalkan struktur'],
        ['AB=CD', 'Biasanya memanjang, ideal alternatif 1,27; AB=CD setara adalah syarat minimum'],
        ['Titik D', 'Retracement 0,886 XA, angka terpenting dan batas penentu PRZ']
      ]
    },
    pola: 'bat',
    alat: 'xabcd',
    rujukan: 'Carney, Bab 5'
  },
  {
    id: 'b5-prz',
    bagian: 'Pembahasan Pola',
    judul: 'Karakter PRZ dan Aksi Harga pada Bat',
    sub: 'Menunggu seluruh zona teruji, uji sekunder, dan harga di atas waktu',
    paragraf: [
      'Karena 0,886 XA berada dekat titik awal X, pembalikan pada Bat mencerminkan tantangan besar terhadap support atau resistance sebelumnya, sehingga sinyalnya dinilai lebih kuat daripada uji ulang biasa. Carney lebih suka menunggu seluruh rentang PRZ diuji sebelum menganggap pola selesai; menurutnya Bat bearish cenderung menguji seluruh PRZ lebih sering dibanding pola lain, berbeda dengan Gartley yang diperlakukan lebih longgar.',
      'Pembalikan yang sah sering didahului reaksi pada uji pertama, konsolidasi, lalu uji ulang yang menandai percepatan pembalikan. Pada contoh EUR 60 menit, sebuah Bat kecil terbentuk di dalam uji sekunder Bat yang lebih besar; Carney menyebut konvergensi semacam ini konfirmasi struktural tambahan.',
      'Penulis juga menegaskan prioritas harga di atas waktu. Ukuran waktu dapat melengkapi pola, tetapi keputusan eksekusi harus berpijak pada level harga.'
    ],
    poin: [
      '0,886 XA adalah batas penentu PRZ dan biasanya area eksekusi paling optimal.',
      'Bullish Bat sering terbentuk pada support yang sudah mapan; bearish Bat setelah harga menelusuri kembali puncak kritis.',
      'Pola yang valid biasanya terbentuk di tengah tren yang sudah mapan.',
      'Pada saham BEI yang rawan gap, uji PRZ yang terlalu cepat tetap dinilai dari stabilisasi setelah zona teruji.'
    ],
    rujukan: 'Carney, Bab 5'
  },
  {
    id: 'b5-contoh',
    bagian: 'Pembahasan Pola',
    judul: 'Contoh Pola Bat di Saham dan Indeks',
    sub: 'Ilustrasi dari buku pada grafik harian dan mingguan',
    paragraf: [
      'Contoh-contoh berikut memperlihatkan bahwa 0,886 XA hampir selalu menjadi angka yang menentukan, sementara angka lain melengkapinya. Pada Chevron-Texaco, alternatif 1,618 AB=CD berada sekitar 2 poin di bawah dua angka lain; Carney menjadikannya alasan untuk memperhatikan seluruh rentang PRZ, bukan satu angka saja.',
      'Contoh Coca-Cola menonjol karena strukturnya terbentuk dalam kurun sekitar tujuh tahun dan tren naik berbalik pada minggu harga mencapai titik penyelesaian. Buku juga memuat contoh valas (GBP 15 menit dengan PRZ 1,6218-1,6242, CHF 60 menit, dan EUR 60 menit).'
    ],
    tabel: {
      kolom: ['Kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['DJI (bullish)', 'Mingguan', '1,618 AB=CD di 7500; BC 2,24 dan 0,886 tepat di bawah 7400', 'Berbalik hampir tepat di 0,886; menandai awal pasar bullish 2003'],
        ['GS (bullish)', 'Harian', 'AB=CD setara; BC 1,618; 0,886 tepat di atas 61', 'Reli meyakinkan setelah seluruh PRZ diuji'],
        ['CVX (bullish)', 'Harian', 'B 0,50; 0,886 bertemu BC 2,0; alternatif 1,618 AB=CD di 56,50', 'Peluang beli tepat di bawah $60; pembalikan terkonfirmasi beberapa hari kemudian'],
        ['JPM (bearish)', 'Mingguan', 'PRZ 47,20-48,05; 1,618 AB=CD dan BC 2,0; 0,886 di 47,70', 'Berbalik cepat setelah seluruh PRZ diuji'],
        ['KO (bearish)', 'Mingguan', 'PRZ 34,55-36,30; B 0,50, alternatif 1,27 AB=CD, BC 2,0', 'Tren naik berbalik setelah semua angka di zona teruji']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 5'
  },
  {
    id: 'b5-sempurna',
    bagian: 'Pembahasan Pola',
    judul: 'Bat Sempurna',
    sub: 'Penjajaran paling ketat: B 0,50, BC 2,0, alternatif 1,27 AB=CD',
    paragraf: [
      'Bat sempurna adalah Bat dengan tiga angka PRZ yang berkumpul sangat rapat. Titik B harus tepat pada retracement 0,50, dan alternatif 1,27 AB=CD serta proyeksi BC 2,0 harus selesai dekat retracement 0,886 XA. Satu-satunya keleluasaan yang diizinkan adalah titik C di rentang 0,50-0,618, karena rentang inilah yang paling ideal untuk menghasilkan proyeksi BC 2,0.',
      'Dua contoh dalam buku memperlihatkan kerapatan tersebut. Pada Intel (60 menit), alternatif 1,27 AB=CD di 15,75 bertemu proyeksi BC 2,0 dan 0,886 di 15,80, lalu harga stabil dan berbalik dari retracement 88,6%. Pada QQQQ (5 menit), ketiga angka berada dalam rentang 10 sen tepat di atas $30 dan menandai area jual yang optimal.'
    ],
    tabel: {
      kolom: ['Syarat', 'Bat biasa', 'Bat sempurna'],
      baris: [
        ['Titik B', 'Kurang dari 0,618 (0,50 atau 0,382 disukai)', 'Wajib tepat 0,50'],
        ['Titik C', '0,382 sampai 0,886', '0,50 sampai 0,618'],
        ['Proyeksi BC', 'Minimal 1,618 (hingga 2,618)', '2,0'],
        ['AB=CD', 'Minimal setara; alternatif 1,27 disukai', 'Alternatif 1,27 wajib'],
        ['Titik D', '0,886 XA', '0,886 XA sebagai batas penentu']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 5'
  },
  {
    id: 'b5-ringkasan',
    bagian: 'Pembahasan Pola',
    judul: 'Ringkasan Pola Bat',
    sub: 'Lima syarat yang dirangkum Carney',
    paragraf: [
      'Bat dirangkum sebagai pola presisi yang sering menghasilkan pembalikan tepat dan tajam. Retracement 0,886 menjadi titik penyelesaian yang kuat sekaligus batas penentu PRZ, sementara titik B di bawah 0,618 adalah pembeda utamanya dari Gartley.',
      'Carney menutup bab dengan menyebut Bat mungkin pola harmonik terbaik, dengan catatan bahwa struktur terbaik adalah yang jelas bentuknya dan penjajaran rasionya tepat. Untuk penerapan pada saham BEI, syarat-syarat di bawah dapat dijadikan daftar periksa sebelum menandai sebuah struktur sebagai Bat.'
    ],
    poin: [
      'Titik B kurang dari 0,618 XA, dengan 0,50 atau 0,382 lebih disukai.',
      'Titik D tepat pada retracement 0,886 XA sebagai batas penentu PRZ.',
      'Proyeksi BC minimal 1,618, dengan kemungkinan ekstensi ekstrem 2,0-2,618.',
      'AB=CD setara adalah batas minimum; varian 1,27 kali AB justru yang paling sering dan paling disukai pada Bat.',
      'Retracement titik C dapat bervariasi antara 0,382 dan 0,886.'
    ],
    pola: 'bat',
    rujukan: 'Carney, Bab 5'
  },

  // ===================== BAB 6: POLA GARTLEY =====================
  {
    id: 'b6-kontroversi',
    bagian: 'Pembahasan Pola',
    judul: 'Kontroversi Besar Gartley',
    sub: 'Asal-usul struktur dan siapa yang menetapkan rasionya',
    paragraf: [
      'H. M. Gartley pertama kali menggambarkan kerangka pola ini dalam Profits in the Stock Market (Lambert-Gann Publishing, 1935) halaman 222. Carney menegaskan, berdasarkan buku yang ia miliki, bahwa Gartley sama sekali tidak menyebut rasio Fibonacci; anggapan bahwa Gartley yang menetapkan rasionya adalah keliru.',
      'Pihak lain kemudian menempelkan berbagai angka Fibonacci di titik D sehingga hampir setiap AB=CD disebut Gartley, dengan anggapan pembalikan di 0,618 atau 0,786 selalu sah tanpa melihat struktur keseluruhan. Menurut Carney, aturan tepat titik B di 0,618 dan titik D di 0,786 baru ditetapkan dalam The Harmonic Trader (1999), dan penjajaran inilah yang kini menjadi standar.'
    ],
    poin: [
      'Pokok kontroversi: tidak semua struktur berbentuk "M" atau "W" adalah Gartley.',
      'Syarat B 0,618 hanyalah satu kondisi; AB=CD dan batas proyeksi BC juga wajib dipenuhi.',
      'Gartley disebut sebagai salah satu jenis pola korektif "M" atau "W" dalam Elliott Wave.'
    ],
    rujukan: 'Carney, Bab 6'
  },
  {
    id: 'b6-definisi',
    bagian: 'Pembahasan Pola',
    judul: 'Pola Gartley',
    sub: 'Titik B 0,618 yang tepat dan PRZ dari AB=CD setara bersama 0,786 XA',
    paragraf: [
      'Gartley memerlukan penjajaran titik B paling tepat di antara semua pola harmonik: retracement 0,618 kaki XA. PRZ-nya dibentuk oleh AB=CD setara yang konvergen dengan retracement 0,786 XA; kedua angka ini adalah syarat minimum Gartley yang valid, dan tumpang tindih keduanya biasanya menjadi level penentu PRZ.',
      'Proyeksi BC berperan lebih kecil dibanding pada pola lain, tetapi batasnya penting: tidak boleh melebihi 1,618. Proyeksi BC di atas 1,618 umumnya menandakan struktur Bat. Pengalaman Carney, struktur yang tidak memenuhi penjajaran ideal Gartley biasanya berlanjut menjadi koreksi yang lebih dalam, sehingga mendukung penyelesaian Bat.'
    ],
    tabel: {
      kolom: ['Elemen', 'Syarat pola Gartley'],
      baris: [
        ['Titik B', 'Retracement 0,618 XA yang tepat'],
        ['Titik C', 'Retracement 0,382 sampai 0,886 dari AB'],
        ['Proyeksi BC', '1,13, 1,27, 1,41, atau 1,618; tidak boleh melebihi 1,618'],
        ['AB=CD', 'Setara (CD = AB), paling umum dan wajib'],
        ['Titik D', 'Retracement 0,786 XA']
      ]
    },
    pola: 'gartley',
    alat: 'xabcd',
    rujukan: 'Carney, Bab 6'
  },
  {
    id: 'b6-beda-bat',
    bagian: 'Pembahasan Pola',
    judul: 'Membedakan Gartley dan Bat',
    sub: 'Dua struktur korektif 5 titik yang sering tertukar',
    paragraf: [
      'Bentuk Gartley dan Bat sangat mirip ketika selesai, sehingga Carney berulang kali menekankan bahwa pembedanya adalah rasio, bukan bentuk. Elemen terpenting adalah titik B: 0,618 untuk Gartley, kurang dari 0,618 (idealnya 0,50) untuk Bat.',
      'Salah menamai pola berakibat langsung pada eksekusi. Bila sebuah struktur sebenarnya Bat, proyeksi BC dan alternatif 1,27 AB=CD akan menghasilkan PRZ yang lebih dalam; sebaliknya, memperlakukan Gartley sebagai Bat dapat membuat peluang terlewat. Carney juga mencatat bahwa memakai 0,886 dalam struktur yang benar dapat mengurangi risiko sekitar 10% dibanding setup Gartley yang tidak dibedakan.'
    ],
    tabel: {
      kolom: ['Aspek', 'Gartley', 'Bat'],
      baris: [
        ['Titik B (dari XA)', 'Tepat 0,618', 'Kurang dari 0,618; ideal 0,50 atau 0,382'],
        ['Titik D (dari XA)', '0,786', '0,886'],
        ['Proyeksi BC', 'Maksimal 1,618 (umumnya 1,13-1,618)', 'Minimal 1,618 (hingga 2,618); 1,27 membatalkan'],
        ['AB=CD', 'Setara', 'Umumnya alternatif 1,27; setara sebagai minimum'],
        ['Angka paling kritis', 'Penyelesaian AB=CD bersama 0,786', 'Retracement 0,886'],
        ['Perlakuan PRZ', 'Sering berbalik setelah AB=CD dan 0,786 teruji', 'Lebih ketat; menunggu seluruh PRZ teruji']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 2, Bab 5, dan Bab 6'
  },
  {
    id: 'b6-contoh',
    bagian: 'Pembahasan Pola',
    judul: 'Contoh Pola Gartley di Saham dan Indeks',
    sub: 'Konvergensi AB=CD dan 0,786 XA sebagai inti PRZ',
    paragraf: [
      'Contoh-contoh Gartley dalam buku menunjukkan pola yang konsisten: harga berbalik setelah titik penyelesaian AB=CD dan retracement 0,786 XA teruji, bahkan ketika proyeksi BC belum tersentuh. Pada contoh franc Swiss (60 menit), 0,786 dan BC 1,618 berkumpul di bagian bawah zona, tetapi pembalikan baru terjadi setelah AB=CD selesai; Carney menjadikannya bukti bahwa AB=CD adalah syarat wajib di PRZ Gartley.',
      'Contoh S&P 500 mingguan menonjol karena penyelesaian Gartley bearish berlangsung di puncak tertinggi sepanjang masa indeks dan menandai awal pasar bearish tiga tahun. Harga sempat melampaui batas atas zona, dan pembalikan baru terjadi seminggu setelah seluruh PRZ teruji.'
    ],
    tabel: {
      kolom: ['Kode', 'Grafik', 'Angka di PRZ', 'Hasil'],
      baris: [
        ['NEM (bullish)', 'Mingguan', 'AB=CD 19,30; 0,786 di 19,35; BC 1,41 di 18,70', 'Zona sedikit ditembus; berbalik setelah beberapa minggu konsolidasi'],
        ['NQ_U3 (bullish)', 'Harian', 'PRZ 1203,40-1213,50; BC 1,41 sebagai pelengkap', 'Berbalik tajam setelah AB=CD dan 0,786 teruji; BC 1,41 tidak tersentuh'],
        ['DIA (bullish)', 'Harian', 'Tiga angka di 118-120; B 0,618 sempurna', 'Menandai titik rendah kritis pasar bearish'],
        ['MSFT (bullish)', '60 menit', 'AB=CD, 0,786, BC 1,41 di 23,15-23,25', 'Reli dua minggu setelah seluruh PRZ teruji'],
        ['SPX (bearish)', 'Mingguan', 'AB=CD dan 0,786 dilengkapi BC 1,27, tepat di atas 1500', 'Puncak tertinggi sepanjang masa; awal pasar bearish tiga tahun'],
        ['USO (bearish)', 'Intra-hari', 'AB=CD dan 0,786 di area 44', 'Berbalik pada pembukaan hari berikutnya setelah PRZ teruji']
      ]
    },
    alat: 'xabcd',
    rujukan: 'Carney, Bab 6'
  },
  {
    id: 'b6-sempurna',
    bagian: 'Pembahasan Pola',
    judul: 'Gartley Sempurna dan Ringkasan Bab',
    sub: 'Gabungan B 0,618 yang nyaris tepat dengan AB=CD sempurna',
    paragraf: [
      'Gartley sempurna menggabungkan Gartley ideal dengan AB=CD sempurna (0,618/1,618): titik B hampir tepat 0,618, titik C tepat 0,618, proyeksi BC 1,618 wajib, dan kedua kaki AB serta CD simetris dalam durasi. Struktur ini jarang, tetapi disebut sebagai penjajaran terbaik dari semua variasi Gartley. Contoh dalam buku: SPY 5 menit dengan PRZ dalam rentang sekitar 15 sen tepat di bawah 87,50, dan GBP 15 menit dengan batas penentu di area 1,3830.',
      'Dalam ringkasan bab, Carney menegaskan bahwa meskipun 0,786 XA penting, titik penyelesaian AB=CD setara adalah angka paling kritis di PRZ Gartley dan merupakan syarat minimum. Ia juga mengingatkan bahwa pada pola dengan PRZ rapat, uji cepat di titik penyelesaian dapat membuat peluang eksekusi sangat singkat, sehingga harga target perlu diutamakan di atas proyeksi waktu.'
    ],
    tabel: {
      kolom: ['Syarat', 'Gartley ideal', 'Gartley sempurna'],
      baris: [
        ['Titik B', '0,618 tepat (sedikit variasi)', '0,618 nyaris tepat'],
        ['Titik C', '0,382 sampai 0,886', 'Tepat 0,618'],
        ['Proyeksi BC', '1,27 atau 1,618 (tidak melebihi 1,618)', '1,618 wajib'],
        ['AB=CD', 'Setara', 'Setara dan sempurna, durasi kaki setara'],
        ['Titik D', '0,786 XA', '0,786 XA']
      ]
    },
    pola: 'gartley',
    alat: 'xabcd',
    rujukan: 'Carney, Bab 6'
  }
]
