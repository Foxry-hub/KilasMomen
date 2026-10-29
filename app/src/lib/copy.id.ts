/**
 * Kamus teks UI Bahasa Indonesia (Q23).
 * Seluruh teks UI bersumber dari berkas ini; satu-satunya pengecualian adalah brand "Happy Click".
 */
export const copy = {
  brand: {
    name: "Happy Click",
    short: "HC",
    tagline: "Abadikan Momenmu",
  },

  common: {
    back: "Kembali",
    cancel: "Batal",
    close: "Tutup",
    save: "Simpan",
    delete: "Hapus",
    edit: "Ubah",
    confirm: "Konfirmasi",
    yes: "Ya",
    no: "Tidak",
    loading: "Memuat...",
    retry: "Coba Lagi",
    search: "Cari",
    all: "Semua",
    download: "Unduh",
    print: "Cetak",
    none: "Tidak ada",
    optional: "opsional",
    connecting: "Menghubungkan ulang...",
  },

  status: {
    PENDING: "MENUNGGU BAYAR",
    PAID: "SUDAH BAYAR",
    PROCESSING: "DIPROSES",
    COMPLETED: "SELESAI",
    CANCELLED: "DIBATALKAN",
    /** Label tambahan untuk pembatalan setelah bayar. */
    VOID: "HANGUS",
    /** Transaksi PROCESSING yang lebih tua dari softcopy.maxHours. */
    STALE: "MENGGANTUNG",
  },

  cancelReason: {
    TIMEOUT: "Kedaluwarsa waktu",
    OPERATOR: "Dibatalkan operator",
    KIOSK_IDLE: "Kios tidak aktif",
    OPERATOR_AFTER_PAYMENT: "Hangus (dibatalkan setelah bayar)",
  },

  paymentMethod: {
    CASH: "Tunai",
    QRIS: "QRIS",
  },

  filter: {
    ORIGINAL: "Asli",
    BW: "Hitam Putih",
    VIVID: "Cerah",
    SEPIA: "Sepia",
    VINTAGE: "Vintage",
    WARM: "Hangat",
    COOL: "Dingin",
    FADE: "Pudar",
  },

  frameCategory: {
    ALL: "Semua",
    TWO: "2 Frame",
    THREE: "3 Frame",
    MANY: "Frame Banyak",
    REKOMENDASI: "Rekomendasi",
  },

  processingStage: {
    FRAME: "Pilih Frame",
    PHOTO: (n: number) => `Foto ${n}/6`,
    REVIEW: "Tinjau / Edit",
    READY: "Hasil Siap",
  },

  kiosk: {
    splash: {
      start: "Sentuh untuk Mulai",
      subtitle: "Abadikan Momenmu",
    },
    package: {
      title: "Pilih Paket Foto",
      strips: (n: number) => `${n}x Strip`,
      continue: "Lanjut ke Pembayaran",
      perPackage: "Setiap paket berisi cetakan 4R + soft copy",
    },
    payment: {
      title: "Pembayaran",
      instruction: "Silakan Lakukan Pembayaran ke Operator",
      scanQris: "Pindai kode QRIS di bawah ini",
      cashNote: "Bayar tunai langsung ke operator",
      waiting: "Menunggu konfirmasi pembayaran...",
      remaining: "Sisa waktu",
    },
    frame: {
      title: "Pilih Frame Favoritmu",
      slots: (n: number) => `${n} foto`,
    },
    capture: {
      shot: (n: number, total: number) => `Foto ke-${n} dari ${total}`,
      getReady: "Bersiap...",
    },
    review: {
      title: "Tinjau Foto Kamu",
      retake: "Foto Ulang",
      retakeLeft: (n: number) => `Sisa foto ulang: ${n} dari 3`,
      retakeEmpty: "Kuota foto ulang habis",
      continue: "Lanjut",
    },
    editor: {
      title: "Atur Posisi Foto",
      chooseSlot: "Ketuk slot pada pratinjau untuk menempatkan foto",
      filterTitle: "Pilih Filter",
      finish: "Simpan & Lanjut",
    },
    done: {
      title: "Silakan Ambil Hasil Foto di Operator",
      resetting: "Kembali ke awal dalam",
    },
    sessionEnded: "Sesi Berakhir",
    idleWarning: "Masih di sini? Sentuh layar untuk melanjutkan",
    connectingOverlay: "Menghubungkan ulang...",
  },

  operator: {
    login: {
      title: "Masuk Panel Operator",
      pin: "PIN",
      submit: "Masuk",
      wrong: "PIN salah",
    },
    nav: {
      queue: "Antrean",
      frames: "Frame",
      history: "Riwayat",
      settings: "Pengaturan",
      logout: "Keluar",
    },
    event: {
      active: (since: string) => `EVENT: AKTIF sejak ${since}`,
      inactive: "EVENT: BELUM AKTIF",
      close: "Akhiri Event",
    },
    kiosk: {
      online: "Kios terhubung",
      offline: "Kios tidak terhubung",
    },
    tunnel: {
      online: "Tunnel aktif",
      offline: "Tunnel offline",
      warning: "Tunnel offline, link belum bisa dibuka pengunjung",
    },
    actions: {
      confirmCash: "Konfirmasi Bayar (Tunai)",
      confirmQris: "Konfirmasi Bayar (QRIS)",
      cancel: "Batalkan",
      cancelVoid: "Batalkan (Hangus)",
      cancelVoidDialog:
        "Pembayaran HANGUS dan tidak dikembalikan. Lanjutkan?",
      showQr: "Tampilkan QR Code Soft Copy",
      printLocal: "Cetak ke Printer Lokal",
      sendFotocopy: "Kirim ke Tukang Fotokopi",
      markDone: "Tandai Selesai",
    },
    queue: {
      title: "Antrean Transaksi",
      empty: "Belum ada transaksi",
      noPackage: "Belum pilih paket",
    },
    frames: {
      title: "Manajemen Frame",
      upload: "Unggah Frame",
      uploadHint: "PNG transparan, ukuran bebas",
      analyze: "Analisis Berkas",
      recommend: "Set sebagai Rekomendasi",
      active: "Aktif",
      slots: "Slot",
      format: "Format",
      save: "Simpan Frame",
      dpiWarn: "Resolusi rendah untuk kertas ini",
      nonRect: "Ada slot dengan bentuk tidak persegi",
      margins: "Ada margin putih pada kertas ini",
    },
    settings: {
      title: "Pengaturan",
      pricing: "Harga Paket",
      payment: "Pembayaran",
      camera: "Kamera",
      fotocopy: "Fotokopi",
      print: "Cetak",
      event: "Event",
      tunnel: "Tunnel",
      security: "Keamanan",
      backup: "Cadangkan Sekarang",
    },
    history: {
      title: "Riwayat & Rekap",
      exportCsv: "Ekspor CSV",
      income: "Pemasukan",
      orders: "Jumlah Pesanan",
      voided: "Hangus",
      cancelledBeforePaid: "Batal sebelum bayar",
      totalPrints: "Total Cetakan",
    },
  },

  invoice: {
    ready: "Foto Kamu Siap Diunduh!",
    choose: "Silakan pilih opsi unduh di bawah ini.",
    downloadFramed: "Unduh Foto Berframe",
    downloadRaw: "Unduh Semua Foto Asli",
    reminder:
      "Unduh foto sekarang. Link ini hanya aktif selama jam event dan akan nonaktif setelah event ditutup.",
    expired: "Link tidak ditemukan atau sudah tidak berlaku.",
  },

  errors: {
    notFound: "Data tidak ditemukan",
    statusConflict: "Status transaksi sudah berubah",
    unauthorized: "Tidak memiliki akses",
    generic: "Terjadi kesalahan. Coba lagi.",
  },
} as const;

export type Copy = typeof copy;
