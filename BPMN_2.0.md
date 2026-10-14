flowchart TD

&#x20;   START(\["Kios Idle"]) --> L1



&#x20;   subgraph LANE\_V\["Lane Pengunjung \& UI Kios"]

&#x20;       L1\["Landing Page<br/>Tombol MULAI FOTO"]

&#x20;       P1\["Halaman Pembayaran<br/>QRIS / Cash"]

&#x20;       F1\["Pilih Frame"]

&#x20;       C1\["Viewfinder Kamera DroidCam"]

&#x20;       C2\["Sesi Foto 5x (Timer 3-2-1)"]

&#x20;       S1\["Seleksi 2 Foto Terbaik"]

&#x20;       FL1\["Pilih Filter Warna"]

&#x20;       R1\["Render Canvas Final (1200x1800)"]

&#x20;       QR1\["Tampilkan QR Code Invoice \& Cetak Foto"]

&#x20;       DONE(\["Selesai - Auto Reset"])

&#x20;   end



&#x20;   subgraph LANE\_O\["Lane Operator"]

&#x20;       D1{"Terima Uang / Transfer"}

&#x20;       OP1\["Klik 'Konfirmasi Bayar'"]

&#x20;       OP2\["Klik 'Batal'"]

&#x20;   end



&#x20;   subgraph LANE\_S\["Backend Localhost \& Hardware"]

&#x20;       T1\["Buat Transaction (PENDING)"]

&#x20;       T2\["Update Transaction (PAID)"]

&#x20;       PR1\["Trigger Auto-Print"]

&#x20;   end



&#x20;   L1 -->|"Tap MULAI FOTO"| T1

&#x20;   T1 --> P1

&#x20;   P1 --> D1

&#x20;   D1 -->|"Pembayaran Sesuai"| OP1

&#x20;   D1 -->|"Batal"| OP2

&#x20;   OP1 --> T2

&#x20;   OP2 --> L1

&#x20;   T2 --> F1

&#x20;   F1 --> C1

&#x20;   C1 --> C2

&#x20;   C2 --> S1

&#x20;   S1 --> FL1

&#x20;   FL1 --> R1

&#x20;   R1 --> QR1

&#x20;   QR1 --> PR1

&#x20;   PR1 --> DONE

&#x20;   DONE --> START

