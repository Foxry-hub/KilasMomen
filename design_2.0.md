\# Design Specification — Localhost Photobooth Kios



| Atribut | Nilai |

|---|---|

| \*\*Nama Sistem\*\* | Localhost Photobooth Kios |

| \*\*Versi Dokumen\*\* | 1.1 (Updated — No PIN \& Dashboard Operator) |

| \*\*Tanggal\*\* | 13 Oktober 2026 |

| \*\*Peran Penyusun\*\* | Lead System Architect \& Senior Product Manager |

| \*\*Dokumen Terkait\*\* | `prd.md` (Product Requirement Document) |



\---



\## 1. Arsitektur \& Struktur Proyek



\### 1.1 Ringkasan Sistem

Aplikasi \*Modular Monolith\* Next.js (App Router) yang berjalan penuh di `localhost:3000`\[cite: 3]. Pengolahan kamera dan canvas dilakukan di browser klien, sementara server lokal bertugas menyimpan file dan metadata SQLite\[cite: 3].



\### 1.2 Struktur Folder



```text

photobooth/

├─ prisma/

│  ├─ schema.prisma

│  └─ seed.ts                      # frame default + setting awal

├─ storage/                        # penyimpanan file foto lokal

│  └─ sessions/{sessionId}/

├─ public/

│  ├─ frames/                      # overlay PNG frame

│  └─ qris/qris.png                # gambar QRIS statis

├─ src/

│  ├─ app/

│  │  ├─ (kiosk)/

│  │  │  ├─ page.tsx               # Landing Page

│  │  │  ├─ payment/\[transactionId]/page.tsx # Halaman Pembayaran

│  │  │  └─ session/\[sessionId]/

│  │  │     ├─ frame/page.tsx

│  │  │     ├─ capture/page.tsx

│  │  │     ├─ select/page.tsx

│  │  │     ├─ filter/page.tsx

│  │  │     └─ result/page.tsx     # QR + Status Cetak

│  │  ├─ invoice/\[token]/page.tsx  # Halaman Unduh Publik (HP Pengunjung)

│  │  └─ api/

│  │     ├─ transactions/...

│  │     ├─ sessions/...

│  │     ├─ public/invoice/\[token]/route.ts

│  │     └─ health/route.ts

│  ├─ components/ui/               # Button, Card, Badge, Stepper, ...

│  ├─ features/                    # camera, canvas, print, invoice

│  └─ lib/                         # prisma, logger, storage

├─ scripts/

│  └─ start-kiosk.bat              # script startup otomatis

└─ .env


+----------------------------------------------------------------------------+
| STEP 1/6  PEMBAYARAN                                     SISA WAKTU  02:45 |
| -------------------------------------------------------------------------- |
|                                                                            |
| +----------------------------------+  +----------------------------------+ |
| | SCAN QRIS                        |  | RINGKASAN                        | |
| +----------------------------------+  +----------------------------------+ |
| |                                  |  | Kode   : TRX-20261013-0007       | |
| |      [ GAMBAR QRIS LOKAL ]       |  | Metode : [QRIS]  [TUNAI]         | |
| |                                  |  | Status : MENUNGGU PEMBAYARAN     | |
| |        TOTAL   Rp 25.000         |  |                                  | |
| |   atau bayar TUNAI ke operator   |  | Silakan bayar ke operator.       | |
| +----------------------------------+  +----------------------------------+ |
|                                                                            |
| +------------------------------------------------------------------------+ |
| |               +----------------------------+  +------------------+     | |
| |               |     KONFIRMASI BAYAR      |  |      BATAL       |     | |
| |               +----------------------------+  +------------------+     | |
| |               (Operator tekan tombol ini setelah menerima uang)        | |
| +------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------+
