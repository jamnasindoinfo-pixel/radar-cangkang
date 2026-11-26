// Pendalaman topik Wawasan per menu Radar (lib/wawasan.js): penjelasan lebih panjang, contoh, dan kesalahan umum,
// dicocokkan lewat id topik. Contoh berangka rekaan diberi label "contoh rekaan"; contoh HRME dan KOTA berasal dari
// pembahasan chart 25 November 2026 (data harian Stockbit). Data murni.

export const DETAIL = {
  'berita-sumber': {
    detail: [
      'Keterbukaan informasi adalah dokumen yang wajib disampaikan emiten ke OJK dan BEI, misalnya laporan keuangan, rencana RUPS, transaksi material, dan perubahan pengendali. Isinya mengikat secara hukum.',
      'Bila harga dan volume bergerak tidak wajar, bursa mengumumkan Unusual Market Activity (UMA) dan bisa meminta penjelasan emiten. Jawaban emiten atas permintaan itu sering menjadi sumber paling jujur: apakah memang ada rencana aksi korporasi atau tidak.',
      'Media arus utama biasanya mengutip keterbukaan atau wawancara direksi. Forum dan grup paling cepat tetapi paling sering keliru; anggap sebagai petunjuk untuk dicek, bukan fakta.',
    ],
    keliru: ['Membeli hanya karena judul berita tanpa membuka dokumen aslinya', 'Menganggap bantahan emiten sebagai konfirmasi terselubung'],
  },
  'berita-harga': {
    detail: [
      'Pasar memperhitungkan informasi secepat mungkin. Pihak yang tahu lebih dulu (orang dalam, pemodal besar) sering sudah masuk sebelum berita resmi keluar, sehingga harga naik duluan.',
      'Cara memeriksa: buka grafik harian dan tandai tanggal berita. Bila harga sudah naik jauh dengan volume besar dalam 5 sampai 10 hari sebelumnya, kemungkinan besar berita itu dipakai untuk menjual.',
    ],
    contoh: 'Contoh rekaan: harga naik dari Rp100 ke Rp160 dalam seminggu, lalu berita akuisisi keluar dan harga dibuka Rp165 kemudian turun ke Rp140. Pembeli di hari berita langsung rugi sekitar 15%.',
    keliru: ['Mengejar harga di hari berita keluar', 'Tidak mencatat reaksi harga setelah berita untuk belajar'],
  },
  'monitor-to': {
    detail: [
      'Pengambilalihan terjadi ketika ada pihak yang menjadi pengendali baru perusahaan terbuka. POJK 9/POJK.04/2018 mewajibkan pengendali baru itu melakukan penawaran tender wajib kepada pemegang saham publik, dengan beberapa pengecualian.',
      'Harga penawaran tender wajib mengacu pada harga pasar dan harga yang dibayar pengendali baru dalam periode tertentu sebelum pengambilalihan, sesuai rumus di POJK. Harga ini sering menjadi acuan harga terendah saat proses berjalan.',
      'Bila setelah tender offer porsi publik terlalu kecil, pengendali baru wajib mengalihkan kembali sebagian saham ke publik dalam jangka waktu tertentu. Fase ini kadang memunculkan tekanan jual.',
    ],
    keliru: ['Mengira tender offer pasti di harga jauh di atas pasar', 'Lupa memeriksa pengecualian kewajiban tender offer'],
  },
  'monitor-transaksi': {
    detail: [
      'Transaksi material adalah transaksi yang nilainya melewati batas tertentu dibanding ekuitas perusahaan. Di atas batas tertentu wajib memakai penilai independen dan persetujuan RUPS (POJK 17/POJK.04/2020).',
      'Transaksi afiliasi melibatkan pihak yang punya hubungan dengan pengendali atau pengurus. Bila mengandung benturan kepentingan, wajib persetujuan pemegang saham independen (POJK 42/POJK.04/2020). Pemegang saham independen adalah pihak yang tidak terlibat dalam transaksi itu.',
      'Peta waktu yang khas: keterbukaan rencana, laporan penilai, pengumuman dan panggilan RUPS, hasil RUPS, penyelesaian transaksi. Tiap tahap meninggalkan dokumen di IDX yang bisa dipantau.',
    ],
    keliru: ['Mengabaikan syarat persetujuan pemegang saham independen', 'Tidak membaca ringkasan laporan penilai'],
  },
  'monitor-aset': {
    detail: [
      'Penilai (KJPP) memakai tiga pendekatan: pendapatan (arus kas masa depan didiskonto), pasar (dibanding transaksi atau perusahaan sejenis), dan biaya (biaya membangun ulang). Pendekatan pendapatan paling peka terhadap asumsi pertumbuhan.',
      'Tanda nilai yang dibesar-besarkan: asumsi pertumbuhan pendapatan jauh di atas sejarahnya, aset belum menghasilkan laba, atau nilai jauh di atas perusahaan sejenis yang sudah tercatat.',
    ],
    contoh: 'Contoh rekaan: aset tambak dinilai Rp1 triliun, padahal laba bersihnya Rp20 miliar per tahun. Itu setara PER 50 kali, jauh di atas emiten sejenis di kisaran 10 sampai 15 kali.',
    keliru: ['Menerima nilai KJPP tanpa membandingkan dengan laba dan arus kas', 'Mengira aset besar otomatis membuat saham murah'],
  },
  'monitor-gagal': {
    detail: [
      'Base rate adalah frekuensi kejadian dalam populasi. Tanpa base rate, cerita sukses beberapa backdoor terkenal membuat peluang terasa lebih besar dari kenyataannya.',
      'Catatan sederhana yang cukup: kode, tanggal masuk radar, tahap terakhir, hasil (selesai, batal, tertunda), harga saat masuk radar, harga 6 dan 12 bulan kemudian.',
    ],
    keliru: ['Hanya mengingat kasus yang berhasil', 'Menganggap semua penundaan sebagai tanda akan berhasil'],
  },
  'kandidat-freefloat': {
    detail: [
      'Peraturan Pencatatan BEI Nomor I-A mengatur syarat minimal saham publik (free float) dan jumlah pemegang saham agar emiten tetap tercatat. Emiten yang tidak memenuhinya bisa diberi notasi khusus dan sanksi.',
      'Notasi khusus adalah huruf di belakang kode saham yang memberi tanda kondisi tertentu, misalnya ekuitas negatif, opini auditor tidak wajar, atau belum menyampaikan laporan keuangan. Daftar arti hurufnya ada di idx.co.id.',
      'Papan Pemantauan Khusus menampung saham dengan kondisi tertentu (misalnya harga sangat rendah dan likuiditas tipis) dan diperdagangkan dengan full call auction.',
    ],
    keliru: ['Membeli saham bernotasi khusus tanpa tahu artinya', 'Mengira saham berporsi publik kecil pasti akan dibackdoor'],
  },
  'kandidat-likuid': {
    detail: [
      'Patokan praktis (bukan aturan): besar posisi tidak melebihi sebagian kecil dari nilai transaksi harian rata-rata, supaya bisa keluar dalam satu sampai dua hari tanpa menekan harga.',
      'Spread adalah jarak harga bid dan offer. Di saham sepi, spread beberapa tick sudah berarti biaya beberapa persen setiap kali masuk dan keluar.',
    ],
    contoh: 'Contoh rekaan: nilai transaksi harian rata-rata Rp200 juta. Posisi Rp100 juta setara separuh transaksi harian, sehingga sulit dijual cepat tanpa menurunkan harga.',
    keliru: ['Melihat volume satu hari yang melonjak sebagai likuiditas normal'],
  },
  'ihsg-makro': {
    detail: [
      'Suku bunga naik membuat obligasi dan deposito lebih menarik serta menaikkan biaya utang emiten, sehingga valuasi saham cenderung turun. Suku bunga turun sebaliknya.',
      'Rupiah melemah menekan emiten yang berutang dalam dolar dan pengimpor bahan baku, tetapi menguntungkan eksportir. Arus asing bersih banyak memengaruhi saham berkapitalisasi besar.',
      'Harga batu bara, CPO, dan nikel menggerakkan sektor energi, perkebunan, dan logam. Ketiganya punya bobot besar di IHSG.',
    ],
    keliru: ['Memakai pola musiman tanpa melihat kondisi makro tahun berjalan'],
  },
  'ihsg-statistik': {
    detail: [
      'Dengan 10 data, satu tahun yang ekstrem bisa mengubah rata-rata secara besar. Median dan sebaran (misalnya rentang terendah sampai tertinggi) lebih jujur daripada rata-rata saja.',
      'Overfitting terjadi bila aturan dibuat terlalu pas dengan data lama sehingga gagal di data baru. Uji out-of-sample memakai data yang tidak dipakai untuk membuat aturan. Walk-forward mengulang uji itu bergeser maju dalam waktu.',
      'Sebagai pembanding: bila IHSG naik di sekitar separuh bulan dalam sejarahnya, maka bulan yang naik 6 dari 10 tahun belum tentu istimewa.',
    ],
    contoh: 'Contoh rekaan: suatu bulan naik 8 dari 10 tahun dengan rata-rata +3%, tetapi satu tahun naik +15% sementara tujuh tahun lain hanya +0,5% sampai +1%. Mediannya sekitar +1%, jauh lebih kecil dari kesan rata-rata.',
    keliru: ['Menganggap "naik 8 dari 10 tahun" sebagai kepastian', 'Menguji dan membuat aturan di data yang sama'],
  },
  'ihsg-indeks': {
    detail: [
      'IHSG dihitung dari kapitalisasi pasar saham konstituennya, dengan penyesuaian free float. Saham berkapitalisasi sangat besar, terutama bank besar, menentukan sebagian besar arah indeks.',
      'Market breadth membandingkan jumlah saham naik dan turun. Indeks naik dengan breadth negatif berarti hanya sedikit saham besar yang naik.',
      'Saham HSC (konsentrasi kepemilikan tinggi) dikeluarkan dari perhitungan IHSG sehingga pergerakannya tidak lagi tercermin di indeks.',
    ],
    keliru: ['Mengira IHSG naik berarti mayoritas saham kecil juga naik'],
  },
  'ihsg-lk': {
    detail: [
      'Kualitas laba diukur dari seberapa besar laba didukung arus kas operasi. Rasio sederhana: arus kas operasi dibagi laba bersih. Di bawah 1 terus-menerus perlu diperiksa.',
      'Pos luar biasa seperti laba penjualan aset, selisih kurs, atau keuntungan revaluasi menaikkan laba sekali saja. Laba usaha lebih menggambarkan bisnis inti.',
      'DER (Debt to Equity Ratio) = utang berbunga dibagi ekuitas. Bandingkan dengan perusahaan sejenis; perbankan dan properti punya struktur utang yang berbeda.',
    ],
    contoh: 'Contoh rekaan: laba bersih Rp50 miliar, termasuk laba penjualan tanah Rp40 miliar. Laba bisnis intinya hanya sekitar Rp10 miliar.',
    keliru: ['Menganggap berbalik laba sebagai pemulihan bisnis tanpa melihat sumber labanya'],
  },
  'ihsg-broker': {
    detail: [
      'Broker summary mencatat transaksi per kode broker. Satu kode bisa mewakili banyak nasabah, termasuk ritel. Akumulasi kode tertentu belum tentu satu pihak.',
      'Pasar negosiasi dan crossing (pembeli dan penjual di broker yang sama) dipakai untuk memindahkan saham dalam jumlah besar. Transaksi seperti ini tidak selalu berarti minat beli baru.',
      'Konfirmasi yang lebih kuat datang dari data kepemilikan: kenaikan porsi pemegang saham di KSEI atau keterbukaan kepemilikan 5%.',
    ],
    keliru: ['Menyimpulkan bandar akumulasi dari satu hari data', 'Mengabaikan transaksi pasar negosiasi'],
  },
  'ihsg-astro': {
    detail: [
      'Uji yang adil membandingkan hasil metode dengan tebakan acak pada periode yang sama. Bila hasilnya tidak lebih baik dari acak, metode itu tidak menambah informasi.',
    ],
    keliru: ['Mengingat kecocokan dan melupakan kegagalan'],
  },
  'harmonic-reaksi': {
    detail: [
      'Reaksi adalah pantulan awal dari PRZ, biasanya sampai sekitar 0,382 sampai 0,618 dari kaki A ke D. Pembalikan berarti tren berubah dan harga melampaui titik C atau lebih jauh.',
      'Pengelolaan yang umum: ambil sebagian posisi di target reaksi, geser stop ke harga masuk, lalu biarkan sisanya mengejar target lebih jauh.',
    ],
    contoh: 'Contoh dari pembahasan HRME 25 November 2026: setelah D di 71 masuk PRZ 68–78, harga turun ke 53. Itu baru reaksi; pembalikan penuh baru terbukti bila harga terus turun melewati target berikutnya.',
    keliru: ['Menahan seluruh posisi menunggu pembalikan besar sampai reaksi habis'],
  },
  'harmonic-swing': {
    detail: [
      'Titik X sampai D harus berada di ujung sumbu candle swing: low terendah atau high tertinggi di antara dua titik tetangganya, dan harus bergantian high dan low.',
      'Swing yang dibentuk satu sumbu panjang (misalnya B HRME di 51 pada 28 September 2026, ditutup 42) sah tetapi lemah. Swing yang dibentuk beberapa candle lebih bisa dipercaya.',
      'Proporsi waktu: kaki yang terlalu cepat dibanding kaki lain (C ke D 2 minggu, X ke A 5 bulan pada HRME) biasanya didorong berita atau lonjakan volume, bukan ayunan harga biasa.',
    ],
    contoh: 'Contoh KOTA 25 November 2026: titik yang benar 71-210-140-252-50; tarikan manual 72-139-250-49 sudah di candle yang benar tetapi tidak menempel tepat di ujung sumbu.',
    keliru: ['Menarik titik di badan candle', 'Memilih titik X terlalu dekat sehingga pola belum lengkap'],
  },
  'harmonic-indikator': {
    detail: [
      'Divergensi bullish: harga membuat low lebih rendah di D, sementara RSI membuat low lebih tinggi. Divergensi bearish kebalikannya. Divergensi menandakan momentum melemah.',
      'Carney memperkenalkan RSI BAMM di Harmonic Trading Vol. 2 untuk menilai kondisi RSI di sekitar pola. Isinya belum dirangkum di website.',
    ],
    keliru: ['Menunggu semua indikator setuju sehingga entry terlambat'],
  },
  'harmonic-data': {
    detail: [
      'Platform grafik biasanya menyesuaikan harga lama setelah stock split atau rights issue. Bila satu platform menyesuaikan dan yang lain tidak, titik pola bisa berbeda jauh.',
      'Selisih 1 sampai 2 poin bisa datang dari sumber data yang berbeda atau dari titik yang tidak menempel ke ujung candle. Cocokkan angka H dan L candle sebelum menghitung rasio.',
    ],
    keliru: ['Mencampur data dua platform dalam satu pola'],
  },
  'harmonic-statistik': {
    detail: [
      'Winrate adalah persentase transaksi yang untung. Expectancy = (winrate x rata-rata untung) dikurangi (persentase rugi x rata-rata rugi). Strategi dengan winrate 40% tetap menguntungkan bila untungnya jauh lebih besar dari ruginya.',
      'R-multiple menyatakan hasil dalam satuan risiko. Untung 2R berarti untung dua kali jarak stop.',
    ],
    contoh: 'Contoh rekaan: 20 transaksi, 8 untung rata-rata 2R, 12 rugi rata-rata 1R. Expectancy = 0,4 x 2 − 0,6 x 1 = 0,2R per transaksi.',
    keliru: ['Menilai strategi dari winrate saja'],
  },
  'rek-risiko': {
    detail: [
      'Risiko per transaksi = jarak entry ke stop x jumlah saham. Patokan yang sering dipakai pedagang adalah 1 sampai 2% modal per transaksi, tetapi angka ini pilihan pribadi.',
      'Total risiko terbuka adalah jumlah risiko semua posisi. Saham satu grup pengendali atau satu sektor sering jatuh bersamaan, jadi anggap risikonya bertumpuk.',
      'Drawdown 50% butuh kenaikan 100% untuk kembali ke modal awal. Menjaga kerugian kecil lebih penting daripada mengejar untung besar.',
    ],
    contoh: 'Contoh rekaan: modal Rp100 juta, risiko 1% = Rp1 juta. Entry Rp200, stop Rp184 (jarak Rp16). Jumlah saham = 1.000.000 / 16 = 62.500 lembar = 625 lot.',
    keliru: ['Menentukan jumlah lot dari keyakinan, bukan dari jarak stop', 'Memegang banyak saham dari satu grup sekaligus'],
  },
  'rek-bursa': {
    detail: [
      'Stop tidak dijamin terisi di harga yang direncanakan. Bila harga dibuka di bawah stop atau langsung turun ke batas auto rejection bawah dengan antrean jual menumpuk, posisi bisa tertahan.',
      'Saham yang disuspensi tidak bisa dijual sampai suspensi dibuka. Saham di full call auction hanya dipertemukan pada waktu tertentu.',
    ],
    keliru: ['Memperlakukan stop seperti jaminan', 'Membeli besar di saham yang sering disuspensi'],
  },
  'rek-evaluasi': {
    detail: [
      'Catat setiap rekomendasi yang diikuti: tanggal, harga, sumber sinyal, rencana, dan hasil. Setelah puluhan transaksi, hitung expectancy per sumber sinyal.',
      'Bedakan keputusan buruk dari hasil buruk. Mengikuti rencana lalu kena stop adalah keputusan yang baik; melanggar rencana lalu kebetulan untung adalah keputusan yang buruk.',
    ],
    keliru: ['Mengganti metode setelah beberapa kali rugi tanpa data yang cukup'],
  },
}
