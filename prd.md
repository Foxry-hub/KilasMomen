# PRD — Localhost Photobooth Kios

| Atribut | Nilai |
|---|---|
| **Nama Sistem** | Localhost Photobooth Kios |
| **Versi Dokumen** | 1.0 (Draft untuk review) |
| **Tanggal** | 13 Oktober 2026 |
| **Peran Penyusun** | Senior Product Manager & Lead System Architect |
| **Dokumen Terkait** | `design.md` (Technical & UI/UX Design Specification) |
| **Status** | Siap dipakai sebagai acuan pengembangan MVP |

---

## Ringkasan Eksekutif

**Localhost Photobooth Kios** adalah aplikasi web photobooth yang berjalan **sepenuhnya di localhost** pada satu laptop, dengan satu smartphone Android sebagai kamera (DroidCam via kabel USB). Pengunjung menyelesaikan alur *bayar → pilih frame → 5× jepret → pilih 2 foto → filter → cetak + QR invoice* tanpa bantuan teknis. Operator hanya memverifikasi pembayaran dan menjaga hardware.

Prinsip utama produk:

1. **Offline-first**: seluruh alur inti (kamera, canvas, database, cetak) tidak butuh internet.
2. **Hemat modal**: 1 laptop + 1 HP + 1 printer. Tidak ada biaya langganan SaaS.
3. **Cepat**: target satu sesi ≤ 3 menit sejak tombol "MULAI FOTO" sampai kertas keluar.
4. **Aman**: tidak ada foto tanpa transaksi `PAID`. Link invoice berbasis token acak yang tidak bisa ditebak.
5. **Tahan banting**: UI Neo-Brutalism yang tegas, ramah sentuh, dan sulit salah tekan.

---

## 1. Problem Statement

### 1.1 Latar Belakang

Bisnis photobooth di event (bazaar, pernikahan, kampus, mall, pameran) sedang tumbuh. Namun operator kecil menghadapi tiga hambatan klasik:

- **Konektivitas venue tidak bisa diandalkan.** Banyak lokasi outdoor atau hall padat dengan sinyal lemah. Solusi photobooth berbasis cloud (upload dulu, edit di server) gagal tepat saat antrean paling panjang.
- **Modal awal dan biaya berulang tinggi.** Booth komersial memakai kamera DSLR, PC khusus, dan lisensi software bulanan. Banyak calon wirausahawan tidak punya modal sebesar itu.
- **Proses manual memperlambat antrean.** Operator memindahkan file, mengedit, mencetak, lalu mengirim hasil lewat WhatsApp. Satu pelanggan bisa memakan 6–10 menit dan rawan salah kirim.

### 1.2 Pain Point dan Arah Solusi

| # | Masalah di Lapangan | Dampak Bisnis | Respons Produk |
|---|---|---|---|
| P1 | Internet venue lambat atau mati | Booth berhenti, pelanggan pergi | Arsitektur **localhost + offline-first**. Font, ikon, dan library di-bundle. Database dan file ada di laptop |
| P2 | Perangkat mahal | Modal sulit kembali | **HP Android sebagai webcam** (DroidCam USB) dan laptop yang sudah ada |
| P3 | Antrean panjang karena alur manual | Omzet per jam rendah | Alur otomatis 6 langkah dengan timer, render canvas, dan cetak otomatis |
| P4 | Pembayaran tercecer atau dimanipulasi | Kebocoran pendapatan | **State machine transaksi**. Sesi foto terkunci sampai status `PAID` dikonfirmasi operator ber-PIN |
| P5 | Pelanggan ingin salinan digital tetapi tidak ada cloud | Kepuasan rendah, tidak ada efek viral | **QR Invoice** ke halaman publik via Cloudflare Tunnel (hasil foto bisa diunduh dari HP pelanggan) |
| P6 | URL hasil foto mudah ditebak (`/foto/1`, `/foto/2`) | Risiko privasi | **Tokenized invoice URL**: token acak ≥ 128-bit, ada masa berlaku, bisa dicabut |

### 1.3 Value Proposition

> "Photobooth lengkap dengan pembayaran, cetak, dan QR download, yang hidup di satu laptop dan satu HP, dan tetap jalan walau Wi-Fi venue mati."

---

## 2. Goals & Objectives

### 2.1 Tujuan Bisnis

- Menyediakan photobooth siap operasi dengan **modal perangkat minimal** (laptop + HP Android + printer foto).
- Meningkatkan **throughput per jam** dengan alur otomatis yang konsisten.
- Menghilangkan kebocoran pembayaran lewat **kontrol berbasis status transaksi**.

### 2.2 Tujuan Produk

| ID | Tujuan | Penjelasan |
|---|---|---|
| G1 | Efisiensi antrean | Sesi cepat, antarmuka tidak butuh instruksi lisan, auto-reset ke landing |
| G2 | Keandalan offline | Seluruh alur inti berjalan tanpa internet dan pulih dari crash tanpa kehilangan sesi berbayar |
| G3 | Keamanan invoice & transaksi | Tidak ada foto tanpa `PAID`. Invoice hanya bisa diakses dengan token acak. Area operator tidak terekspos ke internet |
| G4 | Kualitas hasil | Foto cetak tajam (1200×1800 px, 300 DPI untuk 4R) dengan komposisi frame dan filter konsisten |
| G5 | Operasional mudah | Setup di venue ≤ 10 menit. Konfigurasi harga, QRIS, frame, dan PIN tanpa mengubah kode |

### 2.3 Indikator Keberhasilan (KPI)

| KPI | Target MVP | Cara Mengukur |
|---|---|---|
| Durasi sesi rata-rata (tap "MULAI FOTO" → cetak keluar) | **≤ 3 menit 00 detik** | Selisih `Transaction.createdAt` dan `PhotoSession.completedAt` |
| Throughput kios | **≥ 15 sesi/jam** (termasuk pergantian pelanggan) | Jumlah sesi `COMPLETED` per jam di dashboard |
| Keberhasilan alur inti tanpa internet | **100%** (uji dengan Wi-Fi dan data seluler dimatikan) | Skenario UAT-OFFLINE |
| Sesi foto tanpa transaksi `PAID` | **0** | Query integritas harian, guard server-side |
| Tingkat keberhasilan sesi (selesai tanpa intervensi teknis) | **≥ 98%** | `COMPLETED` / (`COMPLETED` + `ABORTED`) |
| Keberhasilan cetak percobaan pertama | **≥ 99%** | `PrintJob.status = SENT` pada percobaan awal |
| Latensi jepret (timer 0 → frame tertangkap) | **≤ 100 ms (p95)** | `performance.now()` di Camera Service |
| Keamanan token invoice | Entropi **≥ 128-bit**. 0 akses tanpa token valid | Code review, tes enumerasi |
| Kehilangan data saat crash/mati listrik | **0 sesi `PAID` hilang** | Tes *kill process* dan cabut kabel saat sesi berjalan |

### 2.4 Non-Goals

Rincian fitur yang sengaja tidak dibuat ada di **Bagian 7 (Scope Out)**.

---

## 3. Target User

### 3.1 Segmentasi

| Segmen | Peran | Konteks Penggunaan |
|---|---|---|
| **Pengunjung / Konsumen** | Pengguna akhir yang berfoto | Event ramai, berdiri di depan layar sentuh, 1–4 orang per sesi, kemampuan teknis beragam, waktu terbatas |
| **Operator / Admin** | Pemilik atau staf booth | Berdiri di dekat kios, verifikasi pembayaran, isi ulang kertas, menjaga HP dan kabel |

### 3.2 Persona

**Persona 1: Nadia (21), Pengunjung Bazar Kampus**
- Datang bersama 2–3 teman, ingin hasil bagus untuk Instagram Story.
- Tidak mau membaca instruksi panjang. Menyukai tombol besar, countdown jelas, dan hasil cepat.
- Kebutuhan: alur intuitif, preview filter instan, cetakan fisik, QR untuk simpan digital.
- Frustrasi: antre lama, tidak tahu harus menekan apa, hasil tidak bisa diunduh.

**Persona 2: Budi (28), Pemilik & Operator Booth**
- Menjalankan booth di 3–5 event per bulan dengan modal terbatas.
- Perlu satu orang bisa mengelola kios: terima uang, tekan konfirmasi, ganti kertas.
- Kebutuhan: setup cepat, status hardware terlihat, pembayaran tercatat, cetak ulang tanpa drama, rekap harian.
- Frustrasi: kamera putus di tengah antrean, pelanggan klaim "sudah bayar", printer macet, hasil sesi hilang.

### 3.3 Lingkungan dan Perangkat Referensi

| Komponen | Spesifikasi Referensi |
|---|---|
| Laptop | Windows 10/11, Intel Core i5 gen-8 atau setara, RAM 8 GB, SSD, layar 1366×768 hingga 1920×1080 (idealnya touchscreen) |
| Kamera | HP Android + DroidCam (USB debugging aktif), dipasang di tripod/holder, dicolok ke daya |
| Printer | Printer foto 4R (dye-sublimation atau inkjet foto) dengan driver terpasang dan menjadi *default printer* |
| Browser | Google Chrome atau Microsoft Edge versi terbaru, mode kiosk |
| Jaringan | **Tidak wajib** untuk alur inti. Internet (hotspot HP kedua / Wi-Fi venue) hanya dipakai agar QR invoice bisa dibuka publik |

---

## 4. User Stories

### 4.1 Pengunjung

| ID | User Story | Prioritas | FR Terkait |
|---|---|---|---|
| US-V01 | As a **pengunjung**, I want to **melihat tombol "MULAI FOTO" yang besar di landing page**, so that **saya bisa mulai tanpa bertanya ke operator**. | Must | FR-01, FR-02 |
| US-V02 | As a **pengunjung**, I want to **melihat total harga dan membayar via QRIS atau tunai**, so that **saya tahu pasti biaya sebelum foto diambil**. | Must | FR-03, FR-04 |
| US-V03 | As a **pengunjung**, I want to **memilih frame favorit**, so that **hasil foto sesuai tema dan selera saya**. | Must | FR-08 |
| US-V04 | As a **pengunjung**, I want to **melihat pratinjau kamera langsung dengan hitung mundur 3-2-1**, so that **saya siap berpose sebelum jepret**. | Must | FR-09, FR-10, FR-11 |
| US-V05 | As a **pengunjung**, I want to **mengambil 5 foto lalu memilih 2 yang terbaik**, so that **hasil akhir memuaskan dan tidak ada foto jelek yang tercetak**. | Must | FR-11, FR-14 |
| US-V06 | As a **pengunjung**, I want to **menerapkan filter warna dengan pratinjau instan**, so that **suasana foto sesuai keinginan saya**. | Must | FR-15 |
| US-V07 | As a **pengunjung**, I want to **mendapat cetakan fisik dalam hitungan detik**, so that **saya bisa langsung membawa pulang kenangan**. | Must | FR-21 |
| US-V08 | As a **pengunjung**, I want to **memindai QR untuk mengunduh foto digital di HP saya**, so that **saya bisa menyimpan dan membagikannya ke media sosial**. | Must | FR-18, FR-19 |
| US-V09 | As a **pengunjung**, I want to **link foto saya bersifat privat**, so that **orang asing tidak bisa membuka foto saya**. | Must | FR-18, NFR-S01–S05 |
| US-V10 | As a **pengunjung**, I want to **mendapat pesan error yang jelas dan sesi saya tidak hangus bila kamera atau printer bermasalah**, so that **saya tidak kehilangan uang yang sudah dibayar**. | Should | FR-13, FR-23, FR-25 |

### 4.2 Operator

| ID | User Story | Prioritas | FR Terkait |
|---|---|---|---|
| US-O01 | As an **operator**, I want to **menekan "Konfirmasi Bayar" setelah memverifikasi uang atau mutasi QRIS**, so that **hanya pelanggan yang sudah bayar yang bisa memakai booth**. | Must | FR-05, FR-07 |
| US-O02 | As an **operator**, I want to **menekan "Batal" atau membiarkan transaksi kedaluwarsa**, so that **antrean tidak macet oleh transaksi yang tidak jadi**. | Must | FR-05, FR-06 |
| US-O03 | As an **operator**, I want to **melihat status kamera, printer, tunnel, dan disk**, so that **saya bisa memperbaiki masalah sebelum mengganggu antrean**. | Should | FR-24 |
| US-O04 | As an **operator**, I want to **mencetak ulang foto dari dashboard**, so that **cetakan gagal tidak perlu membuat pelanggan membayar lagi**. | Must | FR-22, FR-24 |
| US-O05 | As an **operator**, I want to **melanjutkan sesi yang terputus (browser crash/refresh)**, so that **pelanggan yang sudah bayar tidak dirugikan**. | Should | FR-25 |
| US-O06 | As an **operator**, I want to **melihat rekap transaksi harian dan mengekspor CSV**, so that **saya bisa mencocokkan kas, mutasi QRIS, dan jumlah cetak**. | Should | FR-24 |
| US-O07 | As an **operator**, I want to **mengatur harga, gambar QRIS, PIN, kamera, dan masa berlaku invoice tanpa mengubah kode**, so that **saya bisa menyesuaikan booth di tiap event**. | Should | FR-24 |
| US-O08 | As an **operator**, I want to **menghapus (void) sesi atas permintaan pelanggan**, so that **saya bisa menghormati permintaan privasi**. | Could | FR-24, NFR-PV03 |
| US-O09 | As an **operator**, I want to **menjalankan seluruh sistem dengan satu script startup**, so that **setup di venue selesai ≤ 10 menit**. | Should | NFR-M03 |

---

## 5. Functional Requirements (FR)

Skala prioritas **MoSCoW**: **M** = Must (wajib MVP), **S** = Should, **C** = Could.

### 5.1 Landing Page

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-01 | Landing page menampilkan branding, harga per sesi, ringkasan langkah, dan tombol **"MULAI FOTO"**. | M | Tombol ≥ 96 px tinggi dan terlihat tanpa scroll di 1366×768. Teks utama berbahasa Indonesia |
| FR-02 | Menekan "MULAI FOTO" membuat `Transaction` berstatus `PENDING` dan menavigasi ke halaman pembayaran. | M | Tap ganda dalam 400 ms hanya membuat **1** transaksi. Kegagalan DB menampilkan pesan error ramah, bukan stack trace |
| FR-02a | Landing menampilkan notifikasi persetujuan singkat ("Foto Anda disimpan sementara untuk keperluan unduhan dan dihapus otomatis"). | S | Teks terlihat di footer landing. Durasi retensi sesuai pengaturan |
| FR-02b | Indikator status hardware (kamera, printer, tunnel) ukuran kecil di pojok untuk operator. | S | Indikator tidak menghalangi tombol utama. Warna + label teks (tidak hanya warna) |

### 5.2 Payment Confirmation Flow

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-03 | Halaman pembayaran menampilkan total, kode transaksi, gambar **QRIS statis** (disimpan lokal), dan instruksi pembayaran tunai. | M | Gambar QRIS dimuat dari `public/` atau `storage/`. **Tidak ada** request ke jaringan eksternal |
| FR-04 | Pengunjung atau operator memilih metode `QRIS` atau `CASH`. Metode tercatat di transaksi. | M | `Transaction.paymentMethod` terisi saat konfirmasi |
| FR-05 | Tombol **"Konfirmasi Bayar"** dan **"Batal"** untuk operator dilindungi **PIN 4–6 digit** (modal numpad) dan/atau hotkey (`F2` = konfirmasi, `Esc` = batal, tetap meminta PIN). | M | PIN salah 5× → terkunci 60 detik. Konfirmasi sukses mengubah status `PENDING → PAID` dan mencatat `confirmedAt` |
| FR-06 | Transaksi `PENDING` otomatis `EXPIRED` setelah batas waktu (default **3 menit**, dapat diatur). Hitung mundur tampil di layar. | M | Setelah expired, tombol Konfirmasi dinonaktifkan dan layar kembali ke landing |
| FR-07 | **Guard server-side:** endpoint dan rute sesi foto menolak akses jika transaksi bukan `PAID`. | M | Akses langsung ke `/session/...` tanpa `PAID` → redirect ke landing. API → `403` |
| FR-07a | Setiap perubahan status transaksi tercatat (waktu, status lama/baru, sumber aksi). | S | Tabel atau log terstruktur dapat diekspor |

### 5.3 Pilih Frame

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-08 | Menampilkan grid frame aktif dari database. Pengunjung memilih satu frame. | M | Minimal 3 frame seed. Frame terpilih punya penanda visual jelas. `PhotoSession.frameId` tersimpan |

### 5.4 Camera Feed Integration

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-09 | Sistem mengenali perangkat video via `navigator.mediaDevices.enumerateDevices()` dan memilih otomatis perangkat berlabel **"DroidCam"**. Operator dapat memilih manual di pengaturan. | M | Resolusi diminta ideal 1280×720 (naik ke 1920×1080 bila tersedia). Pilihan device tersimpan di `Setting` |
| FR-10 | Viewfinder menampilkan feed **mirror** (CSS `scaleX(-1)`) dengan **crop guide** sesuai rasio slot frame. | M | Rasio guide sama dengan slot. Feed ≥ 24 fps |
| FR-11 | **Sesi 5× jepret**: countdown **3-2-1** besar, efek flash, jeda review 1,5 detik, lalu foto berikutnya otomatis hingga 5 foto. | M | Total 5 foto tersimpan (`shotIndex` 1–5). Indikator progres "FOTO n/5" |
| FR-12 | Capture memakai `drawImage(video)` ke offscreen canvas, lalu `toBlob(JPEG, 0.92)`. Blob disimpan di memori dan **di-upload async** ke server tanpa memblokir UI. | M | Latensi p95 ≤ 100 ms. Kegagalan upload di-retry otomatis (3×). Opsi `mirrorOutput` (default: tidak mirror) |
| FR-13 | Deteksi kamera putus (`track.onended`, `devicechange`). Sesi dijeda dan overlay error ditampilkan. Operator bisa "Sambungkan Ulang" tanpa menghanguskan sesi `PAID`. | M | Setelah reconnect, sesi lanjut dari foto terakhir yang tersimpan |

### 5.5 Seleksi Foto dan Filter

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-14 | Menampilkan 5 thumbnail, pengunjung memilih **tepat 2** (sesuai `slotCount` frame). Urutan pilih menentukan urutan slot. | M | Tombol "LANJUT" nonaktif sampai tepat 2 terpilih. Pilihan bisa dibatalkan dan diganti |
| FR-15 | Filter warna pada hasil komposisi: **Original, B&W, Sepia, Vintage, Warm, Cool, Vivid, Fade**. Satu filter global per sesi. | M | Pratinjau berubah ≤ 200 ms. Filter terpilih tersimpan di `PhotoSession.filter` |

### 5.6 Canvas Rendering

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-16 | Render final di **HTML5 Canvas / Fabric.js**: foto ditempatkan pada slot (cover-fit), filter diterapkan, overlay PNG frame di atas, teks tanggal/nama event opsional. | M | Output **1200×1800 px** (4R @ 300 DPI). Render ≤ 3 detik |
| FR-17 | Hasil final di-export ke JPEG (q ≈ 0,95) dan disimpan ke `storage/sessions/{sessionId}/final.jpg`. Hash SHA-256 dicatat. | M | File ada di disk sebelum UI berpindah ke layar QR |

### 5.7 Invoice QR Code Generation

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-18 | Setelah render, server membuat **Invoice**: nomor unik (`INV-YYYYMMDD-NNNN`), **token acak ≥ 128-bit**, masa berlaku (default 7 hari). URL: `{PUBLIC_BASE_URL}/invoice/{token}`. QR dibuat **lokal** di browser. | M | QR dibuat ≤ 500 ms. Tidak ada panggilan layanan QR eksternal. Level koreksi error M atau Q |
| FR-19 | **Halaman invoice publik** `/invoice/[token]`: foto final, nomor invoice, tanggal, total, metode bayar, tombol **Unduh**. Responsif untuk mobile. | M | Token tidak valid, kedaluwarsa, atau dicabut → halaman 404 seragam. Header `noindex` dan `no-referrer` terpasang |
| FR-20 | Opsi mencetak QR kecil di footer cetakan fisik. | C | Dapat diaktifkan di Setting. Default nonaktif |
| FR-20a | Jika tunnel mati saat sesi selesai, layar QR menampilkan lencana **"Link aktif saat internet tersambung"**. Invoice tetap dibuat dan tersimpan. | S | Tidak ada error. QR tetap valid begitu tunnel hidup |

### 5.8 Printing Trigger

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-21 | Cetak otomatis setelah render sukses: halaman cetak (iframe tersembunyi, `@page` 4×6 in, margin 0) dipanggil dengan `window.print()`. Chrome dijalankan dengan `--kiosk-printing` agar tanpa dialog. | M | Kertas keluar tanpa dialog. Ukuran dan skala benar (tanpa shrink/crop) |
| FR-22 | Jumlah salinan (default 1, bisa 1–3) dan **cetak ulang** oleh operator dari dashboard. Semua percobaan dicatat sebagai `PrintJob`. | M | Cetak ulang tidak membuat transaksi baru |
| FR-23 | Jika cetak gagal atau printer offline, UI menampilkan peringatan ke operator dan tombol **"Cetak Ulang"**. Foto dan QR tetap tersedia. | S | Sesi berakhir `COMPLETED`, dengan `PrintJob.status = FAILED` yang bisa dicetak ulang |

### 5.9 Operasional

| ID | Requirement | Prio | Acceptance Criteria |
|---|---|---|---|
| FR-24 | **task owner**: daftar transaksi, status hardware, cetak ulang, void, rekap harian + ekspor CSV, (harga, QRIS, kamera, base URL, masa berlaku, retensi). | S | Hanya dapat diakses dari localhost (bukan via tunnel) |
| FR-25 | **Crash recovery**: sesi `PAID` yang belum selesai dapat dilanjutkan setelah refresh/restart (state di DB + `sessionStorage`). | S | Dapat dilanjutkan dalam 15 menit. Foto yang sudah terunggah tidak hilang |
| FR-26 | **Auto-reset**: idle 60 detik di layar non-kritis → kembali ke Landing. Pada sesi `PAID` aktif, layar memberi peringatan dan hanya operator yang dapat membatalkan. | S | Tidak ada sesi `PAID` yang hilang akibat auto-reset |
| FR-27 | **Retensi data**: foto dan invoice dihapus otomatis setelah N hari (default 30). | C | Job pembersihan harian. Catatan transaksi (tanpa foto) tetap ada |

---

## 6. Non-Functional Requirements (NFR)

### 6.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-P01 | **Latensi jepret**: timer menyentuh 0 hingga frame tertangkap sebagai Blob di memori | **≤ 100 ms (p95)** pada 1280×720 |
| NFR-P02 | Frame rate viewfinder | ≥ 24 fps di laptop referensi |
| NFR-P03 | Transisi antar layar (tanpa fetch jaringan eksternal) | ≤ 300 ms |
| NFR-P04 | Render canvas final 1200×1800 | ≤ 3 detik |
| NFR-P05 | Ganti filter pada pratinjau | ≤ 200 ms |
| NFR-P06 | Generasi QR | ≤ 500 ms |
| NFR-P07 | Trigger cetak sampai masuk spooler | ≤ 2 detik |
| NFR-P08 | Cold start aplikasi (script startup → landing siap) | ≤ 15 detik |
| NFR-P09 | Upload foto mentah ke server lokal berjalan di latar dan tidak memblokir countdown berikutnya | 100% async |

### 6.2 Reliability (Offline-First)

| ID | Requirement | Target / Cara Uji |
|---|---|---|
| NFR-R01 | Alur inti (landing → bayar → frame → foto → seleksi → filter → render → cetak) berjalan **tanpa internet**. | Uji dengan semua koneksi dimatikan. 0 request keluar |
| NFR-R02 | **Zero external runtime dependency**: font, ikon, library JS, gambar QRIS, dan frame di-bundle lokal. | DevTools → Network → Offline: tidak ada resource gagal |
| NFR-R03 | **Durabilitas data**: file foto ditulis ke disk sebelum UI maju. SQLite memakai mode WAL. | Uji *kill process* saat jepret ke-3: foto 1–3 pulih |
| NFR-R04 | **Auto-restart** server (PM2, NSSM, atau Task Scheduler) bila proses mati. | Server naik kembali ≤ 15 detik |
| NFR-R05 | **Graceful degradation**: kamera putus → jeda sesi. Printer error → antrean cetak ulang. Tunnel mati → invoice tersimpan, QR aktif saat online. DB terkunci → retry dengan backoff. | Lihat matriks di `design.md` §1.4 |
| NFR-R06 | **Backup** harian otomatis file DB dan `storage/` ke folder/USB cadangan. | Job terjadwal, log tersedia |
| NFR-R07 | Ketersediaan selama event 8 jam. | ≥ 99% tanpa restart manual |
| NFR-R08 | Nonaktifkan sleep/hibernate dan layar mati otomatis di laptop (bagian dari checklist setup). | Checklist setup tercentang |

### 6.3 Usability (Neo-Brutalism, Kiosk Touch)

| ID | Requirement | Target |
|---|---|---|
| NFR-U01 | Gaya visual **Neo-Brutalism**: border solid 3–4 px hitam, *hard shadow* `4px 4px 0 #000`, palet kontras tinggi, tipografi tebal, sudut tajam (radius 0). | Sesuai Design System di `design.md` §4 |
| NFR-U02 | **Touch target** minimum 64×64 px. Tombol aksi utama ≥ 96 px tinggi. Jarak antar target ≥ 16 px. | Inspeksi layout |
| NFR-U03 | Ukuran teks isi ≥ 20 px. Judul ≥ 40 px. Countdown ≥ 240 px. | Inspeksi CSS |
| NFR-U04 | Kontras teks dan latar ≥ **7:1** (AAA) untuk teks utama. | Pengecekan kontras |
| NFR-U05 | Tidak ada interaksi *hover-only*. Efek tekan terlihat (tombol "tenggelam" ke bayangan). | Uji sentuh |
| NFR-U06 | Satu instruksi singkat per layar (≤ 1 kalimat). Bahasa Indonesia sehari-hari. | Review copy |
| NFR-U07 | Proteksi kiosk: tanpa seleksi teks, context menu, pinch-zoom, swipe-back, dan *drag* gambar. Tombol navigasi browser tidak tersedia (mode kiosk). | Uji manual |
| NFR-U08 | Debounce tombol utama 400 ms untuk mencegah tap ganda tidak sengaja. | Uji manual |
| NFR-U09 | Layout responsif landscape 1366×768 sampai 1920×1080. Halaman invoice publik mobile-first. | Uji viewport |
| NFR-U10 | Hormati `prefers-reduced-motion` (animasi non-esensial dimatikan). | Uji pengaturan OS |

### 6.4 Security

| ID | Requirement | Target |
|---|---|---|
| NFR-S01 | **Tokenized invoice URL**: token dari CSPRNG (`crypto.randomBytes(16+)`, base64url), unik, tidak berurutan, tidak memuat data pelanggan. Nomor invoice **tidak** dipakai di URL. | Entropi ≥ 128-bit |
| NFR-S02 | Invoice punya **masa berlaku** (default 7 hari) dan dapat **dicabut** oleh operator. | Token expired/revoked → 404 seragam |
| NFR-S03 | **Anti-enumerasi**: respons token salah, expired, dan revoked identik (404 generik). Rate limit 30 req/menit/IP pada endpoint publik. | Uji brute-force ringan |
| NFR-S04 | Header respons invoice: `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`. | Inspeksi header |
| NFR-S05 | PIN operator disimpan sebagai **hash** (argon2/bcrypt). Lockout setelah 5 percobaan salah. | Code review |
| NFR-S06 | Semua input divalidasi (zod). File upload dibatasi tipe (JPEG) dan ukuran (≤ 8 MB/foto). Path file dibangun di server (tanpa path dari klien). | Code review, uji payload |
| NFR-S07 | File foto **tidak** disajikan sebagai direktori statis publik. Akses hanya melalui API yang memeriksa token (publik) atau sesi operator (lokal). | Tidak ada directory listing |
| NFR-S08 | Secret (`.env`, kredensial tunnel) di luar repositori dan tidak di-commit. | `.gitignore`, secret scan |

### 6.5 Privasi dan Data

| ID | Requirement | Target |
|---|---|---|
| NFR-PV01 | Foto wajah termasuk data pribadi. Terapkan prinsip minimisasi dan retensi sesuai semangat **UU PDP (UU No. 27 Tahun 2022)**. | Kebijakan retensi terdokumentasi |
| NFR-PV02 | Pemberitahuan penggunaan data di landing page. | FR-02a |
| NFR-PV03 | Operator dapat menghapus sesi (foto + invoice) atas permintaan. | Fitur void di dashboard |
| NFR-PV04 | Tidak ada pengiriman data ke pihak ketiga (analytics, CDN, font). | Network audit |

### 6.6 Compatibility, Maintainability, Observability

| ID | Requirement | Target |
|---|---|---|
| NFR-C01 | OS Windows 10/11 (utama). Chrome/Edge terbaru. Node.js LTS. DroidCam Client + aplikasi Android. | Matriks uji |
| NFR-M01 | TypeScript *strict*, ESLint, Prettier, skema validasi bersama (zod). | CI lokal lulus |
| NFR-M02 | Migrasi DB terversi (Prisma Migrate). Seed frame dan setting awal. | `prisma migrate deploy` + `seed` |
| NFR-M03 | Script startup tunggal (`start-kiosk.bat`) menjalankan server, tunnel, dan Chrome kiosk. | Setup ≤ 10 menit |
| NFR-M04 | Konfigurasi lewat `.env` dan tabel `Setting`. Tidak ada nilai *hard-coded*. | Review |
| NFR-O01 | Log terstruktur (pino → file harian) untuk event penting: transaksi, capture, render, print, error hardware. | Log dapat dibaca operator |
| NFR-O02 | Endpoint `/api/health` (DB, storage, disk space, status tunnel). | Ditampilkan di dashboard |

---

## 7. Scope

### 7.1 Scope In (MVP)

| Area | Fitur MVP |
|---|---|
| Kios | Landing, pembayaran manual (QRIS statis + tunai) dengan konfirmasi operator ber-PIN, pilih frame, viewfinder DroidCam, sesi 5× jepret dengan timer 3-2-1, seleksi 2 foto, 8 filter warna |
| Rendering | Komposisi Canvas/Fabric.js 1200×1800, overlay frame PNG, export JPEG |
| Invoice | Invoice bertoken, QR lokal, halaman publik via Cloudflare Tunnel, masa berlaku, pencabutan |
| Cetak | Cetak otomatis (kiosk-printing), cetak ulang, log `PrintJob` |
| Teknis | Next.js App Router, Tailwind (Neo-Brutalism), Prisma + SQLite (MySQL opsional), offline-first |

### 7.2 Scope Out (Sengaja Tidak Dibuat di MVP)

| Fitur | Alasan |
|---|---|
| **Payment gateway otomatis** (Midtrans, Xendit, webhook QRIS dinamis) | Butuh internet stabil, biaya MDR, kompleksitas rekonsiliasi. Bertentangan dengan prinsip offline-first MVP |
| **Multi-laptop / multi-kios sync** | Satu kios, satu laptop, satu sumber data. Sinkronisasi menambah kompleksitas konflik data |
| Penyimpanan cloud permanen (S3/R2) dan akun pengguna | Di luar kebutuhan MVP. Invoice hidup selama laptop dan tunnel aktif |
| Editor frame di UI (drag-and-drop) | Frame ditambahkan lewat file PNG + konfigurasi slot (seed atau dashboard sederhana) |
| Video, GIF, boomerang, stiker AR, deteksi wajah | Fokus pada foto statis |
| Pengiriman hasil via WhatsApp/Email otomatis | Memerlukan internet dan API pihak ketiga |
| Beberapa printer atau antrean cetak lintas perangkat | Satu printer default |
| Analytics cloud dan monitoring jarak jauh | Konflik dengan prinsip privasi dan offline |
| Aplikasi native | Web saja |

### 7.3 Roadmap Lanjutan (Indikatif)

- **Phase 2**: sinkronisasi hasil ke cloud storage saat internet tersedia (invoice tetap hidup walau laptop mati), editor frame, QRIS dinamis semi-otomatis.
- **Phase 3**: multi-kios dengan sync, voucher/promo, laporan multi-event.

---

## 8. Asumsi, Dependensi, dan Batasan

**Asumsi**
- Laptop Windows dengan Chrome/Edge, printer foto 4R sudah terpasang dengan driver dan menjadi default printer.
- DroidCam Client dan aplikasi Android sudah terpasang. USB debugging aktif di HP dan HP selalu terhubung ke daya.
- QRIS yang dipakai adalah QRIS statis milik merchant, diverifikasi manual oleh operator (notifikasi m-banking atau mutasi).
- Satu operator hadir di dekat kios selama operasi.

**Dependensi**
- DroidCam (versi gratis umumnya membatasi resolusi dan fitur. Verifikasi dan pertimbangkan versi berbayar untuk HD stabil), `cloudflared`, domain di Cloudflare (untuk named tunnel dengan hostname tetap).

**Batasan**
- **Invoice publik hanya dapat dibuka selama laptop menyala dan tunnel tersambung ke internet.** Ini konsekuensi arsitektur localhost. Mitigasi di §9, solusi permanen di roadmap Phase 2.
- Pelanggan membutuhkan internet di HP mereka untuk membuka link invoice.
- Satu sesi aktif pada satu waktu.

---

## 9. Risiko dan Mitigasi

| # | Risiko | Dampak | Prob. | Mitigasi |
|---|---|---|---|---|
| R1 | Kamera DroidCam putus (kabel longgar, HP panas) | Sesi macet | Sedang | Deteksi `track.onended`, overlay + reconnect, kabel berkualitas, holder berventilasi, HP dicolok daya |
| R2 | Resolusi DroidCam versi gratis rendah | Hasil cetak kurang tajam | Sedang | Uji di tahap PoC. Gunakan versi berbayar bila perlu. Kompensasi dengan framing dan crop yang tepat |
| R3 | Dialog cetak Windows muncul | Alur berhenti | Tinggi | Chrome `--kiosk-printing`, default printer diset, uji kertas 4×6 di milestone M2 |
| R4 | Tunnel/ internet mati saat pelanggan scan | Link tidak terbuka | Sedang | Lencana status di layar QR, instruksi "coba lagi bila internet tersambung", hotspot cadangan, roadmap cloud sync |
| R5 | Mati listrik / laptop crash | Kehilangan data sesi | Rendah–Sedang | SQLite WAL, tulis file sebelum UI maju, crash recovery, UPS/powerbank kecil bila memungkinkan |
| R6 | Pengunjung menekan Konfirmasi Bayar sendiri | Kebocoran pendapatan | Sedang | PIN operator, hotkey, tombol terpisah dari alur pengunjung, audit log |
| R7 | URL invoice bocor | Privasi | Rendah | Token ≥ 128-bit, expiry, revoke, header anti-index, rate limit |
| R8 | Kinerja render lambat di laptop lemah | UX turun | Sedang | Render di offscreen canvas, batasi resolusi preview, uji di laptop referensi, optimasi filter |
| R9 | Laptop masuk mode sleep di tengah event | Booth mati | Sedang | Checklist power plan, `Wake Lock` API pada halaman kios |
| R10 | Disk penuh | Gagal simpan foto | Rendah | Cek ruang disk di `/api/health`, peringatan operator pada ambang < 2 GB |

---

## 10. Rencana Rilis (Indikatif)

| Milestone | Durasi | Hasil | Definition of Done |
|---|---|---|---|
| **M0: PoC Hardware** | 3–4 hari | DroidCam → `getUserMedia` → capture → print 4×6 tanpa dialog | Latensi jepret diukur. Skala cetak benar |
| **M1: Core Flow** | 1 minggu | Landing, pembayaran + PIN, pilih frame, sesi 5× jepret, DB + storage | FR-01–FR-13 lulus |
| **M2: Canvas & Print** | 1 minggu | Seleksi, filter, render 1200×1800, cetak otomatis, cetak ulang | FR-14–FR-17, FR-21–FR-23 lulus |
| **M3: Invoice & Tunnel** | 1 minggu | Token, QR, halaman publik, Cloudflare Tunnel, middleware pemisah area | FR-18–FR-20a, NFR-S01–S05 lulus |
| **M4: Hardening & UAT** | 1 minggu | Dashboard, recovery, backup, uji offline, uji 8 jam, perbaikan UI | Semua KPI §2.3 terukur dan memenuhi target |

**Kriteria Go-Live MVP:** seluruh FR prioritas *Must* lulus, seluruh NFR Reliability dan Security lulus, UAT dengan ≥ 30 sesi berturut-turut dan skenario offline penuh.

---

## 11. Open Questions

| # | Pertanyaan | Pemilik | Dampak |
|---|---|---|---|
| Q1 | Ukuran kertas final: 4R penuh, atau strip 2×6 (2 strip per lembar)? | Product/Operator | Konfigurasi frame dan layout cetak |
| Q2 | Berapa harga per sesi, dan apakah ada paket (2 salinan, bundling)? | Owner | Setting harga, `copies` |
| Q3 | Apakah QR perlu dicetak di kertas fisik? | Owner | FR-20 |
| Q4 | Domain apa yang dipakai untuk named tunnel? | Owner | `PUBLIC_BASE_URL` |
| Q5 | Berapa lama invoice dan foto harus tetap tersedia? | Owner | Retensi dan expiry |
| Q6 | Model printer final? | Operator | Uji driver dan kalibrasi warna |

---

## Lampiran A: Status dan Definisi

| Entitas | Status | Arti |
|---|---|---|
| `Transaction` | `PENDING` | Dibuat, menunggu verifikasi pembayaran |
| | `PAID` | Dikonfirmasi operator, sesi foto boleh berjalan |
| | `CANCELLED` | Dibatalkan operator |
| | `EXPIRED` | Melewati batas waktu pembayaran |
| | `COMPLETED` | Sesi foto selesai dan foto final dibuat |
| | `VOIDED` | Dibatalkan pasca-bayar (kegagalan teknis fatal atau permintaan penghapusan) |
| `PhotoSession` | `FRAME_SELECT` → `CAPTURING` → `SELECTING` → `FILTERING` → `RENDERED` → `COMPLETED` | Tahapan alur sesi |
| | `ABORTED` | Sesi dihentikan (mis. void) |
| `PrintJob` | `QUEUED` / `SENT` / `FAILED` | Status percobaan cetak |

## Lampiran B: Glosarium

| Istilah | Definisi |
|---|---|
| **DroidCam** | Aplikasi yang menjadikan HP Android sebagai webcam virtual di laptop |
| **Kiosk mode** | Browser layar penuh tanpa kontrol navigasi |
| **QRIS** | Standar QR pembayaran Indonesia |
| **Cloudflare Tunnel** | Layanan `cloudflared` yang mengekspos localhost ke publik tanpa membuka port router |
| **Tokenized URL** | URL yang berisi token acak sebagai pengganti ID berurutan |
| **4R** | Ukuran foto 4×6 inci (≈ 102×152 mm). Pada 300 DPI = 1200×1800 px |
| **Offline-first** | Fungsi inti tidak bergantung pada jaringan eksternal |
