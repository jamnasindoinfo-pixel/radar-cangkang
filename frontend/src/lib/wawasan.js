// Menu Wawasan: untuk setiap menu Radar (Berita, Monitor, Kandidat, IHSG, Harmonic Pattern, Rekomendasi) dicatat apa
// yang sudah tersedia, ilmu yang masih kurang, dan wawasan baru yang perlu didalami supaya isi menu itu terpakai penuh.
// Hanya memuat sumber yang bisa dicek (nama peraturan, judul buku, halaman Radar); topik yang belum dirangkum di
// website ditandai "belum dirangkum". Pendalaman tiap topik (penjelasan, contoh, kesalahan umum) ada di wawasanDetail.js;
// ilmu dasar pasar modal di luar menu Radar ada di wawasanDunia.js. Data murni + fungsi pengurut, diuji di
// __tests__/wawasan.test.js.
import { DETAIL } from './wawasanDetail.js'
import { DUNIA } from './wawasanDunia.js'

// prioritas: 1 = dalami dulu (dipakai hampir setiap hari), 2 = penting, 3 = pelengkap.
export const PRIORITAS = { 1: 'Dalami dulu', 2: 'Penting', 3: 'Pelengkap' }

const MENU = [
  {
    id: 'berita', menu: 'Berita', rute: '/berita',
    inti: 'Berita adalah bahan mentah. Nilainya bergantung pada kemampuan memilah fakta resmi dari rumor dan menghubungkannya dengan pergerakan harga.',
    sudah: ['Kumpulan berita dan laporan Stockbit per emiten', 'Ringkasan dan kesimpulan berita otomatis', 'Penanda berita baru sejak kunjungan terakhir'],
    kurang: [
      {
        id: 'berita-sumber', prioritas: 1, judul: 'Membedakan keterbukaan resmi, media, dan rumor',
        kenapa: 'Harga saham kecil sering bergerak lebih dulu karena rumor. Keputusan yang bersandar pada kabar tanpa dokumen resmi mudah berbalik merugikan.',
        wawasan: 'Urutan kekuatan sumber: keterbukaan informasi di IDX dan KSEI, lalu jawaban emiten atas permintaan penjelasan bursa, lalu media arus utama, terakhir forum dan grup. Klaim penting baru dianggap pasti setelah ada dokumen di IDX.',
        pelajari: ['Membaca keterbukaan informasi di idx.co.id per emiten', 'Arti permintaan penjelasan bursa dan Unusual Market Activity (UMA)', 'Menelusuri asal berita sampai ke dokumen aslinya'],
        sumber: ['idx.co.id, menu Keterbukaan Informasi', 'Tab Berita dan Insider Activity di halaman emiten Radar'],
      },
      {
        id: 'berita-harga', prioritas: 2, judul: 'Berita yang sudah tercermin di harga',
        kenapa: 'Banyak berita bagus muncul setelah harga naik. Membeli saat berita keluar sering berarti membeli dari pihak yang sudah masuk lebih awal.',
        wawasan: 'Bandingkan tanggal berita dengan grafik harga dan volume. Bila harga dan volume sudah melonjak beberapa hari sebelumnya, berita itu kemungkinan hanya mengonfirmasi, bukan pemicu baru.',
        pelajari: ['Pola "buy the rumor, sell the news"', 'Membaca lonjakan volume sebelum pengumuman', 'Mencatat reaksi harga 1, 5, dan 20 hari setelah berita penting'],
        sumber: ['Tab Teknikal dan Insider Activity di halaman emiten Radar'],
      },
    ],
  },
  {
    id: 'monitor', menu: 'Monitor', rute: '/',
    inti: 'Monitor memantau emiten yang sedang atau akan diambil alih. Yang menentukan hasil akhirnya adalah aturan main pengambilalihan dan kualitas aset yang masuk.',
    sudah: ['Tahap tiap emiten di radar dan progresnya', 'Story dan jaringan pengendali', 'Insider Activity (KSEI dan keterbukaan)', 'Simulasi rights issue (TERP, HMETD) dan valuasi target'],
    kurang: [
      {
        id: 'monitor-to', prioritas: 1, judul: 'Aturan pengambilalihan dan tender offer wajib',
        kenapa: 'Saat pengendali berganti, pengendali baru umumnya wajib melakukan tender offer kepada pemegang saham publik. Harga dan jadwalnya menentukan peluang dan batas bawah harga.',
        wawasan: 'Pelajari kapan tender offer wajib muncul, cara harga tender offer dihitung, dan pengecualiannya. Dengan begitu harga wajar saat akuisisi bisa diperkirakan, tidak hanya ditebak dari rumor.',
        pelajari: ['Definisi pengendali dan pengambilalihan', 'Kewajiban, harga, dan jadwal tender offer wajib', 'Kewajiban mengalihkan kembali saham bila porsi publik terlalu kecil'],
        sumber: ['POJK 9/POJK.04/2018 tentang Pengambilalihan Perusahaan Terbuka'],
      },
      {
        id: 'monitor-transaksi', prioritas: 1, judul: 'Transaksi material, afiliasi, dan perubahan kegiatan usaha',
        kenapa: 'Backdoor listing biasanya berjalan lewat injeksi aset, merger, atau perubahan bisnis inti. Transaksi ini wajib melewati keterbukaan, penilai independen, dan sering RUPS.',
        wawasan: 'Urutan dokumen yang muncul (keterbukaan rencana, laporan penilai, panggilan RUPS, hasil RUPS) adalah peta waktu backdoor. Bila satu tahap tertunda lama, peluang batal ikut naik.',
        pelajari: ['Batas nilai transaksi material yang wajib RUPS', 'Transaksi afiliasi dan benturan kepentingan', 'Membaca ringkasan laporan penilai (KJPP)'],
        sumber: ['POJK 17/POJK.04/2020 tentang Transaksi Material dan Perubahan Kegiatan Usaha', 'POJK 42/POJK.04/2020 tentang Transaksi Afiliasi dan Transaksi Benturan Kepentingan'],
      },
      {
        id: 'monitor-aset', prioritas: 2, judul: 'Menilai aset yang diinjeksi',
        kenapa: 'Nilai backdoor bergantung pada aset yang masuk. Aset yang dinilai terlalu tinggi berarti pemegang saham publik membayar mahal untuk aset biasa.',
        wawasan: 'Bandingkan nilai dari penilai independen dengan laba dan arus kas aset itu, lalu dengan perusahaan sejenis yang sudah tercatat. Kalau tidak ada laba atau arus kasnya, nilai itu hanya proyeksi.',
        pelajari: ['Metode penilaian KJPP: pendapatan, pasar, biaya', 'Valuasi relatif: PER, PBV, EV/EBITDA', 'Tanda nilai aset dibesar-besarkan'],
        sumber: ['Tab Aset, Analisa, dan simulasi valuasi di halaman emiten Radar'],
      },
      {
        id: 'monitor-gagal', prioritas: 2, judul: 'Belajar dari backdoor yang batal',
        kenapa: 'Radar mencatat rencana yang berjalan, tetapi belum mencatat statistik berapa rencana yang batal atau mengecewakan setelah selesai.',
        wawasan: 'Catat hasil akhir setiap emiten yang keluar dari radar: selesai, batal, atau tertunda, beserta harga 6 dan 12 bulan sesudahnya. Dari situ terlihat peluang nyata, bukan hanya cerita yang berhasil.',
        pelajari: ['Base rate: seberapa sering rencana selesai', 'Ciri rencana yang batal: pendanaan, izin, sengketa', 'Bias survivorship dalam cerita sukses backdoor'],
        sumber: ['Riwayat item radar di Monitor (data tim)'],
      },
    ],
  },
  {
    id: 'kandidat', menu: 'Kandidat', rute: '/kandidat',
    inti: 'Kandidat menyaring emiten yang berciri cangkang. Ciri itu perlu dibaca bersama aturan bursa supaya tidak terjebak di saham yang sulit diperdagangkan.',
    sudah: ['Pemindaian ciri cangkang: saham beredar sedikit, porsi publik kecil, nilai pasar kecil', 'POV AH: emiten dengan ciri serupa', 'Saham HSC dan Saham 50 di menu IHSG'],
    kurang: [
      {
        id: 'kandidat-freefloat', prioritas: 1, judul: 'Free float, notasi khusus, dan risiko delisting',
        kenapa: 'Porsi publik yang kecil membuat saham mudah digerakkan, tetapi juga bisa membuatnya masuk pengawasan bursa atau terancam delisting.',
        wawasan: 'Periksa apakah emiten memenuhi syarat free float minimum, punya notasi khusus, atau masuk Papan Pemantauan Khusus. Cangkang yang menarik adalah yang masih "bersih" secara aturan.',
        pelajari: ['Syarat free float minimum dan jumlah pemegang saham', 'Arti notasi khusus di belakang kode saham', 'Papan Pemantauan Khusus dan suspensi'],
        sumber: ['Peraturan Pencatatan BEI Nomor I-A', 'idx.co.id, daftar notasi khusus dan Papan Pemantauan Khusus'],
      },
      {
        id: 'kandidat-likuid', prioritas: 2, judul: 'Likuiditas dan biaya keluar',
        kenapa: 'Saham cangkang sering sepi. Harga di layar bisa jauh dari harga yang benar-benar bisa didapat saat menjual dalam jumlah besar.',
        wawasan: 'Ukur nilai transaksi harian rata-rata dan tebal antrean bid sebelum masuk. Besar posisi sebaiknya hanya sebagian kecil dari nilai transaksi harian supaya bisa keluar tanpa menekan harga.',
        pelajari: ['Nilai transaksi harian dan spread', 'Membaca order book (antrean bid dan offer)', 'Full call auction di Papan Pemantauan Khusus'],
        sumber: ['Data nilai transaksi di Screening Harmonic dan halaman emiten Radar'],
      },
    ],
  },
  {
    id: 'ihsg', menu: 'IHSG', rute: '/seasonality',
    inti: 'Menu IHSG sudah kaya: Seasonality, Live, Astronacci, Time Series, HSC, serta enam penyaring saham. Yang kurang adalah alasan di balik pola, dan cara menguji apakah sebuah pola cukup kuat untuk dipercaya.',
    sudah: ['Seasonality IHSG, sektor, dan saham (5/10 tahun)', 'Live, Astronacci, dan Time Series yang diuji mundur', 'Dampak HSC terhadap penggerak indeks', 'Penyaring saham: laporan keuangan, Saham 50, Pola Broker, Recovery, Low, POV'],
    kurang: [
      {
        id: 'ihsg-makro', prioritas: 1, judul: 'Makro dan likuiditas: penggerak di luar pola musiman',
        kenapa: 'Seasonality menjawab "kapan biasanya naik", bukan "kenapa". Pola musiman bisa gagal ketika suku bunga, kurs, atau arus asing berubah tajam.',
        wawasan: 'Sebelum memakai pola musiman, cek empat hal: arah BI-Rate, kurs rupiah terhadap dolar AS, arus asing bersih, dan harga komoditas utama (batu bara, CPO, nikel). Kalau keempatnya berlawanan dengan pola, kurangi keyakinan.',
        pelajari: ['Hubungan suku bunga, kurs, dan valuasi saham', 'Arus asing dan bobot bank besar di IHSG', 'Siklus komoditas dan sektor yang terdampak'],
        sumber: ['bi.go.id (BI-Rate)', 'Tab Live dan HSC di menu IHSG Radar'],
      },
      {
        id: 'ihsg-statistik', prioritas: 1, judul: 'Membaca statistik dengan sampel kecil',
        kenapa: 'Seasonality 10 tahun berarti hanya 10 data untuk tiap bulan. "Naik 8 dari 10 tahun" terdengar kuat, tetapi bisa saja kebetulan.',
        wawasan: 'Perhatikan besar kenaikan rata-rata dan sebarannya, bukan hanya persentase tahun naik. Uji mundur yang baik memisahkan data untuk membangun pola dan data untuk mengujinya (out-of-sample).',
        pelajari: ['Ukuran sampel, rata-rata, median, dan sebaran', 'Overfitting dan data-snooping', 'Uji out-of-sample dan walk-forward'],
        sumber: ['Tab Seasonality (heatmap tahun x bulan) dan Time Series (uji mundur) di menu IHSG Radar'],
      },
      {
        id: 'ihsg-indeks', prioritas: 2, judul: 'Cara IHSG dihitung dan siapa penggeraknya',
        kenapa: 'IHSG dibobot kapitalisasi pasar, sehingga beberapa saham besar bisa mengangkat atau menekan indeks walau mayoritas saham bergerak sebaliknya.',
        wawasan: 'Bandingkan IHSG dengan jumlah saham naik dan turun (market breadth). IHSG naik dengan breadth lemah artinya kenaikan hanya ditopang sedikit saham, dan sinyal itu kurang sehat untuk saham kecil.',
        pelajari: ['Bobot kapitalisasi dan free float dalam indeks', 'Market breadth: advance/decline', 'Dampak keluarnya saham HSC dari perhitungan indeks'],
        sumber: ['idx.co.id, metodologi indeks', 'Tab HSC di menu IHSG Radar'],
      },
      {
        id: 'ihsg-lk', prioritas: 2, judul: 'Laporan keuangan lebih dalam dari laba',
        kenapa: 'Penyaring laporan keuangan menyorot laba naik dan berbalik laba. Laba bisa naik karena pos sekali terjadi, sementara arus kas tetap lemah.',
        wawasan: 'Cocokkan laba bersih dengan arus kas operasi, lalu periksa utang dan piutang. Laba yang tidak diikuti arus kas atau ditopang pendapatan lain-lain perlu dicurigai.',
        pelajari: ['Laporan arus kas dan kualitas laba', 'Rasio utang (DER) dan kemampuan bayar bunga', 'Pos luar biasa dan laba kuartal murni'],
        sumber: ['Tab laporan keuangan di menu IHSG Radar', 'Laporan keuangan lengkap di idx.co.id'],
      },
      {
        id: 'ihsg-broker', prioritas: 2, judul: 'Bandarmologi: batas membaca kode broker',
        kenapa: 'Pola Broker menunjukkan akumulasi dan distribusi per broker. Satu kode broker berisi ribuan nasabah, dan transaksi bisa dipindah lewat pasar negosiasi atau crossing.',
        wawasan: 'Akumulasi lebih bisa dipercaya bila terjadi di pasar reguler, berlangsung beberapa minggu, dan disertai kenaikan kepemilikan di data KSEI. Akumulasi satu-dua hari bisa jadi pengalihan biasa.',
        pelajari: ['Pasar reguler, negosiasi, dan crossing', 'Menggabungkan broker summary dengan data kepemilikan KSEI', 'Tanda distribusi terselubung'],
        sumber: ['Tab Pola Broker di menu IHSG dan Insider Activity di halaman emiten Radar'],
      },
      {
        id: 'ihsg-astro', prioritas: 3, judul: 'Menimbang Astronacci dengan uji historis',
        kenapa: 'Siklus bulan dan hitungan waktu Fibonacci tidak punya mekanisme ekonomi yang jelas. Mudah sekali hanya mengingat kejadian yang cocok.',
        wawasan: 'Pakai panel Astronacci sebagai penanda waktu waspada, bukan alasan utama transaksi. Lihat angka uji historisnya: bila tingkat kecocokannya tidak jauh dari tebakan acak, beri bobot kecil.',
        pelajari: ['Bias konfirmasi', 'Membandingkan hasil dengan tebakan acak (baseline)'],
        sumber: ['Tab Astronacci (bagian uji historis) di menu IHSG Radar'],
      },
    ],
  },
  {
    id: 'harmonic', menu: 'Harmonic Pattern', rute: '/harmonic',
    inti: 'Harmonic Pattern sudah merangkum Carney Vol. 1 Bab 1 sampai 12, pola tambahan, screening semua saham BEI, tutorial, dan quiz. Yang belum ada adalah materi lanjutan Carney dan pengukuran hasil pola di saham BEI.',
    sudah: ['Materi Carney Vol. 1 Bab 1–12', 'Pola tambahan: Alternate Bat, Shark, 5-0, Three Drives, AB=CD', 'Screening semua kode BEI dan cek silang skenario', 'Tutorial tarik manual dan Quiz'],
    kurang: [
      {
        id: 'harmonic-reaksi', prioritas: 1, judul: 'Reaksi atau pembalikan di PRZ',
        kenapa: 'Tidak semua pantulan dari PRZ berlanjut jadi pembalikan tren. Banyak yang hanya bereaksi lalu harga kembali ke arah semula.',
        wawasan: 'Bedakan target jangka pendek (reaksi awal) dari pembalikan penuh. Ambil sebagian untung di reaksi awal dan pindahkan stop ke titik impas sebelum mengharapkan pembalikan besar.',
        pelajari: ['Reaksi awal dan zona konfirmasi setelah D', 'Membagi posisi dan trailing stop (sudah ada di materi Bab 10–11)', 'Kapan pola dianggap gagal'],
        sumber: ['Scott M. Carney, Harmonic Trading Vol. 3: Reaction vs. Reversal (belum dirangkum di website)'],
      },
      {
        id: 'harmonic-swing', prioritas: 1, judul: 'Kualitas swing dan proporsi waktu antar kaki',
        kenapa: 'Rasio harga bisa cocok walau bentuk polanya timpang. Contoh HRME (25 November 2026): kaki X ke A sekitar 5 bulan, kaki C ke D hanya sekitar 2 minggu.',
        wawasan: 'Selain rasio harga, nilai juga lama tiap kaki dan apakah titiknya swing yang jelas (bukan satu ekor candle). Pola dengan waktu sangat timpang atau titik dari satu sumbu panjang diberi bobot lebih kecil.',
        pelajari: ['Simetri waktu (baru disinggung di slide Garis Tren, Sudut, dan Simetri Waktu)', 'Swing utama dan swing minor', 'Menempelkan titik tepat di ujung sumbu (Strong magnet)'],
        sumber: ['Materi Carney Vol. 1 Bab 11 di tab Materi Radar', 'Tutorial tarik manual Radar'],
      },
      {
        id: 'harmonic-indikator', prioritas: 2, judul: 'Konfirmasi indikator di PRZ (RSI)',
        kenapa: 'PRZ menunjukkan tempat, bukan waktu. Indikator momentum membantu menilai apakah tekanan di PRZ benar-benar melemah.',
        wawasan: 'Cari divergensi RSI saat harga menyentuh D. Konfirmasi ini menyaring sebagian pola yang tembus PRZ tanpa reaksi.',
        pelajari: ['Divergensi RSI di titik D', 'RSI BAMM (Bat Action Magnet Move)', 'Bahaya terlalu banyak indikator'],
        sumber: ['Scott M. Carney, Harmonic Trading Vol. 2 (belum dirangkum di website)'],
      },
      {
        id: 'harmonic-data', prioritas: 2, judul: 'Data harga dan penyesuaian aksi korporasi',
        kenapa: 'Stock split, reverse split, dan rights issue mengubah harga historis setelah disesuaikan. Titik X sampai D bisa berbeda antar platform. Contoh KOTA (25 November 2026): TradingView 72-139-250-49, data Stockbit 71-140-252-50.',
        wawasan: 'Selalu cek apakah ada aksi korporasi di rentang pola, dan pakai satu sumber data secara konsisten. Selisih kecil tidak mengubah bentuk pola, tetapi bisa menggeser rasio di batas kriteria.',
        pelajari: ['Harga disesuaikan dan tidak disesuaikan', 'Dampak rights issue pada harga teoretis (TERP)', 'Memeriksa OHLC candle sebelum menarik titik'],
        sumber: ['Tab Rights Issue di halaman emiten Radar', 'Halaman Saham di Harmonic Pattern Radar'],
      },
      {
        id: 'harmonic-statistik', prioritas: 2, judul: 'Mengukur hasil pola di saham BEI',
        kenapa: 'Screening menemukan ratusan pola, tetapi website belum mencatat berapa yang mencapai target dan berapa yang kena stop.',
        wawasan: 'Catat setiap pola yang dipakai: tanggal, jenis, PRZ, hasil target atau stop. Setelah puluhan contoh, terlihat pola dan timeframe mana yang paling cocok untuk saham BEI.',
        pelajari: ['Winrate dan expectancy per jenis pola', 'R-multiple', 'Jurnal transaksi (Bab 9 Carney di tab Materi)'],
        sumber: ['Screening Harmonic Radar', 'Materi Carney Vol. 1 Bab 9 di tab Materi Radar'],
      },
    ],
  },
  {
    id: 'rekomendasi', menu: 'Rekomendasi', rute: '/rekomendasi',
    inti: 'Rekomendasi sudah memberi peringkat, alasan, risiko, dan rencana entry. Yang menentukan hasil akhirnya adalah besar posisi, eksekusi di bursa, dan disiplin mengevaluasi.',
    sudah: ['5 saham Non HSC dan 5 saham HSC per hari dari gabungan semua screening', 'Target, stop, dan R:R minimal 1', 'Ukuran lot rencana posisi di Harmonic Pattern'],
    kurang: [
      {
        id: 'rek-risiko', prioritas: 1, judul: 'Manajemen risiko portofolio',
        kenapa: 'Rencana per saham sudah ada, tetapi belum ada aturan berapa risiko total yang boleh dipikul sekaligus. Beberapa saham dari satu grup bisa jatuh bersamaan.',
        wawasan: 'Batasi kerugian per transaksi pada persentase kecil dari modal, batasi total risiko terbuka, dan hindari menumpuk saham dari satu grup pengendali atau satu sektor.',
        pelajari: ['Risiko per transaksi dan total eksposur', 'Korelasi antarsaham dan grup pengendali', 'Drawdown dan cara pulih darinya'],
        sumber: ['Rencana posisi (lot) di Harmonic Pattern Radar', 'Jaringan pengendali di halaman emiten Radar'],
      },
      {
        id: 'rek-bursa', prioritas: 1, judul: 'Mekanisme perdagangan BEI',
        kenapa: 'Stop dan target di atas kertas bisa meleset di bursa karena fraksi harga, batas auto rejection, sesi pra-penutupan, dan suspensi.',
        wawasan: 'Saat menyusun rencana, cek apakah stop masih di dalam batas auto rejection harian, dan apakah saham itu diperdagangkan lewat full call auction. Kalau ya, stop bisa terlewati dalam satu hari.',
        pelajari: ['Fraksi harga dan batas auto rejection atas/bawah', 'Sesi pra-pembukaan dan pra-penutupan', 'Suspensi dan full call auction'],
        sumber: ['idx.co.id, peraturan perdagangan', 'Bagian Penyesuaian untuk saham BEI di tab Materi Radar'],
      },
      {
        id: 'rek-evaluasi', prioritas: 2, judul: 'Mengevaluasi rekomendasi',
        kenapa: 'Peringkat harian berubah terus. Tanpa catatan hasil, sulit tahu sumber sinyal mana yang paling berguna.',
        wawasan: 'Simpan rekomendasi yang diikuti beserta hasilnya, lalu kelompokkan menurut sumber sinyal (Harmonic, Recovery, Seasonality, Pola Broker, backdoor). Sumber yang konsisten merugi bisa diberi bobot lebih kecil.',
        pelajari: ['Jurnal transaksi', 'Evaluasi per sumber sinyal', 'Psikologi: disiplin mengikuti rencana'],
        sumber: ['Menu Rekomendasi Radar', 'Bab 9 Carney (jurnal dan psikologi) di tab Materi Radar'],
      },
    ],
  },
]

// Menu Radar ditambah bagian Dunia saham; tiap topik digabung dengan pendalamannya.
export const BAGIAN = [...MENU, DUNIA].map(b => ({ ...b, kurang: b.kurang.map(k => ({ ...k, ...(DETAIL[k.id] || {}) })) }))

// Semua topik kurang, diurutkan prioritas lalu urutan menu: dipakai sebagai "urutan belajar".
export function urutanBelajar(bagian = BAGIAN) {
  return bagian.flatMap((b, bi) => b.kurang.map((k, ki) => ({ ...k, menu: b.menu, rute: b.rute, urut: bi * 100 + ki })))
    .sort((a, b) => a.prioritas - b.prioritas || a.urut - b.urut)
}

// Jumlah topik per prioritas (untuk ringkasan di atas halaman).
export function hitungPrioritas(bagian = BAGIAN) {
  const n = { 1: 0, 2: 0, 3: 0 }
  for (const b of bagian) for (const k of b.kurang) n[k.prioritas]++
  return n
}
