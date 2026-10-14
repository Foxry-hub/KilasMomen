\# PRD — Localhost Photobooth Kios



| Atribut | Nilai |

|---|---|

| \*\*Nama Sistem\*\* | Localhost Photobooth Kios |

| \*\*Versi Dokumen\*\* | 1.1 (Updated — No PIN \& Dashboard Operator) |

| \*\*Tanggal\*\* | 13 Oktober 2026 |

| \*\*Peran Penyusun\*\* | Senior Product Manager \& Lead System Architect |

| \*\*Dokumen Terkait\*\* | `design.md` (Technical \& UI/UX Design Specification) |

| \*\*Status\*\* | Siap dipakai sebagai acuan pengembangan MVP |



\---



\## Ringkasan Eksekutif



\*\*Localhost Photobooth Kios\*\* adalah aplikasi web photobooth yang berjalan \*\*sepenuhnya di localhost\*\* pada satu laptop, dengan satu smartphone Android sebagai kamera (DroidCam via kabel USB)\[cite: 4]. Pengunjung menyelesaikan alur \*bayar → pilih frame → 5× jepret → pilih 2 foto → filter → cetak + QR invoice\* tanpa bantuan teknis\[cite: 4]. Operator cukup \*standby\* di samping laptop untuk memverifikasi pembayaran dan menjaga hardware\[cite: 4].



Prinsip utama produk:



1\. \*\*Offline-first\*\*: seluruh alur inti (kamera, canvas, database, cetak) tidak butuh internet\[cite: 4].

2\. \*\*Hemat modal\*\*: 1 laptop + 1 HP + 1 printer. Tidak ada biaya langganan SaaS\[cite: 4].

3\. \*\*Cepat\*\*: target satu sesi ≤ 3 menit sejak tombol "MULAI FOTO" sampai kertas keluar\[cite: 4].

4\. \*\*Aman\*\*: tidak ada foto tanpa transaksi `PAID`. Link invoice berbasis token acak yang tidak bisa ditebak\[cite: 4].

5\. \*\*Tahan banting\*\*: UI Neo-Brutalism yang tegas, ramah sentuh, dan sulit salah tekan\[cite: 4].



\---



\## 1. Problem Statement



\### 1.1 Latar Belakang



Bisnis photobooth di event (bazaar, pernikahan, kampus, mall, pameran) sedang tumbuh\[cite: 4]. Namun operator kecil menghadapi tiga hambatan klasik:



\- \*\*Konektivitas venue tidak bisa diandalkan.\*\* Banyak lokasi outdoor atau hall padat dengan sinyal lemah. Solusi photobooth berbasis cloud (upload dulu, edit di server) gagal tepat saat antrean paling panjang\[cite: 4].

\- \*\*Modal awal dan biaya berulang tinggi.\*\* Booth komersial memakai kamera DSLR, PC khusus, dan lisensi software bulanan\[cite: 4].

\- \*\*Proses manual memperlambat antrean.\*\* Operator memindahkan file, mengedit, mencetak, lalu mengirim hasil lewat WhatsApp\[cite: 4]. Satu pelanggan bisa memakan 6–10 menit\[cite: 4].



\### 1.2 Pain Point dan Arah Solusi



| # | Masalah di Lapangan | Dampak Bisnis | Respons Produk |

|---|---|---|---|

| P1 | Internet venue lambat atau mati | Booth berhenti, pelanggan pergi | Arsitektur \*\*localhost + offline-first\*\*. Font, ikon, dan library di-bundle. Database dan file ada di laptop |

| P2 | Perangkat mahal | Modal sulit kembali | \*\*HP Android sebagai webcam\*\* (DroidCam USB) dan laptop yang sudah ada |

| P3 | Antrean panjang karena alur manual | Omzet per jam rendah | Alur otomatis 6 langkah dengan timer, render canvas, dan cetak otomatis |

| P4 | Pembayaran tercecer atau dimanipulasi | Kebocoran pendapatan | \*\*State machine transaksi\*\*. Sesi foto terkunci sampai status `PAID` dikonfirmasi operator |

| P5 | Pelanggan ingin salinan digital tetapi tidak ada cloud | Kepuasan rendah, tidak ada efek viral | \*\*QR Invoice\*\* ke halaman publik via Cloudflare Tunnel (hasil foto bisa diunduh dari HP pelanggan) |

| P6 | URL hasil foto mudah ditebak (`/foto/1`, `/foto/2`) | Risiko privasi | \*\*Tokenized invoice URL\*\*: token acak ≥ 128-bit, ada masa berlaku, bisa dicabut |



\### 1.3 Value Proposition



> "Photobooth lengkap dengan pembayaran, cetak, dan QR download, yang hidup di satu laptop dan satu HP, dan tetap jalan walau Wi-Fi venue mati."



\---



\## 2. Goals \& Objectives



\### 2.1 Tujuan Bisnis



\- Menyediakan photobooth siap operasi dengan \*\*modal perangkat minimal\*\* (laptop + HP Android + printer foto)\[cite: 4].

\- Meningkatkan \*\*throughput per jam\*\* dengan alur otomatis yang konsisten\[cite: 4].

\- Menghilangkan kebocoran pembayaran lewat \*\*kontrol berbasis status transaksi\*\*\[cite: 4].



\### 2.2 Tujuan Produk



| ID | Tujuan | Penjelasan |

|---|---|---|

| G1 | Efisiensi antrean | Sesi cepat, antarmuka tidak butuh instruksi lisan, auto-reset ke landing |

| G2 | Keandalan offline | Seluruh alur inti berjalan tanpa internet dan pulih dari crash tanpa kehilangan sesi berbayar |

| G3 | Keamanan invoice \& transaksi | Tidak ada foto tanpa `PAID`. Invoice hanya bisa diakses dengan token acak |

| G4 | Kualitas hasil | Foto cetak tajam (1200×1800 px, 300 DPI untuk 4R) dengan komposisi frame dan filter konsisten |

| G5 | Operasional mudah | Setup di venue ≤ 10 menit. Konfigurasi harga, QRIS, dan frame tanpa mengubah kode |



\### 2.3 Indikator Keberhasilan (KPI)



| KPI | Target MVP | Cara Mengukur |

|---|---|---|

| Durasi sesi rata-rata (tap "MULAI FOTO" → cetak keluar) | \*\*≤ 3 menit 00 detik\*\* | Selisih `Transaction.createdAt` dan `PhotoSession.completedAt` |

| Throughput kios | \*\*≥ 15 sesi/jam\*\* (termasuk pergantian pelanggan) | Jumlah sesi `COMPLETED` per jam |

| Keberhasilan alur inti tanpa internet | \*\*100%\*\* (uji dengan Wi-Fi dan data seluler dimatikan) | Skenario UAT-OFFLINE |

| Sesi foto tanpa transaksi `PAID` | \*\*0\*\* | Query integritas harian, guard server-side |

| Tingkat keberhasilan sesi | \*\*≥ 98%\*\* | `COMPLETED` / (`COMPLETED` + `ABORTED`) |

| Keberhasilan cetak percobaan pertama | \*\*≥ 99%\*\* | `PrintJob.status = SENT` pada percobaan awal |

| Latensi jepret (timer 0 → frame tertangkap) | \*\*≤ 100 ms (p95)\*\* | `performance.now()` di Camera Service |



\---



\## 3. Target User



\### 3.1 Segmentasi



| Segmen | Peran | Konteks Penggunaan |

|---|---|---|

| \*\*Pengunjung / Konsumen\*\* | Pengguna akhir yang berfoto | Event ramai, berdiri di depan layar sentuh, 1–4 orang per sesi |

| \*\*Operator / Admin\*\* | Pemilik atau staf booth | Berdiri di samping kios, verifikasi pembayaran, isi ulang kertas |



\### 3.2 Persona



\*\*Persona 1: Nadia (21), Pengunjung Bazar Kampus\*\*

\- Datang bersama 2–3 teman, ingin hasil bagus untuk Instagram Story\[cite: 4].

\- Menyukai tombol besar, countdown jelas, dan hasil cepat\[cite: 4].



\*\*Persona 2: Budi (28), Pemilik \& Operator Booth\*\*

\- Menjalankan booth di event dengan 1 laptop \& 1 HP Android\[cite: 4].

\- Perlu alur serba praktis: terima uang, pencet konfirmasi bayar di laptop, lalu biarkan pelanggan berfoto mandiri\[cite: 1, 4].



\---



\## 4. User Stories



\### 4.1 Pengunjung



| ID | User Story | Prioritas | FR Terkait |

|---|---|---|---|

| US-V01 | As a \*\*pengunjung\*\*, I want to \*\*melihat tombol "MULAI FOTO" yang besar di landing page\*\*, so that \*\*saya bisa mulai tanpa bertanya ke operator\*\*. | Must | FR-01, FR-02 |

| US-V02 | As a \*\*pengunjung\*\*, I want to \*\*melihat total harga dan membayar via QRIS atau tunai\*\*, so that \*\*saya tahu pasti biaya sebelum foto diambil\*\*. | Must | FR-03, FR-04 |

| US-V03 | As a \*\*pengunjung\*\*, I want to \*\*memilih frame favorit\*\*, so that \*\*hasil foto sesuai tema dan selera saya\*\*. | Must | FR-08 |

| US-V04 | As a \*\*pengunjung\*\*, I want to \*\*melihat pratinjau kamera langsung dengan hitung mundur 3-2-1\*\*, so that \*\*saya siap berpose sebelum jepret\*\*. | Must | FR-09, FR-10, FR-11 |

| US-V05 | As a \*\*pengunjung\*\*, I want to \*\*mengambil 5 foto lalu memilih 2 yang terbaik\*\*, so that \*\*hasil akhir memuaskan\*\*. | Must | FR-11, FR-14 |

| US-V06 | As a \*\*pengunjung\*\*, I want to \*\*menerapkan filter warna dengan pratinjau instan\*\*, so that \*\*suasana foto sesuai keinginan saya\*\*. | Must | FR-15 |

| US-V07 | As a \*\*pengunjung\*\*, I want to \*\*mendapat cetakan fisik dalam hitungan detik\*\*, so that \*\*saya bisa langsung membawa pulang kenangan\*\*. | Must | FR-21 |

| US-V08 | As a \*\*pengunjung\*\*, I want to \*\*memindai QR untuk mengunduh foto digital di HP saya\*\*, so that \*\*saya bisa menyimpan dan membagikannya ke media sosial\*\*. | Must | FR-18, FR-19 |



\### 4.2 Operator



| ID | User Story | Prioritas | FR Terkait |

|---|---|---|---|

| US-O01 | As an \*\*operator\*\*, I want to \*\*menekan "Konfirmasi Bayar" setelah menerima uang/bukti transfer\*\*, so that \*\*pelanggan bisa langsung masuk ke sesi foto\*\*. | Must | FR-05, FR-07 |

| US-O02 | As an \*\*operator\*\*, I want to \*\*menekan "Batal" jika pelanggan tidak jadi bayar\*\*, so that \*\*layar kembali ke tampilan awal tanpa hambatan\*\*. | Must | FR-05, FR-06 |

| US-O03 | As an \*\*operator\*\*, I want to \*\*mencetak ulang foto jika kertas macet atau habis\*\*, so that \*\*pelanggan tetap mendapatkan hasil foto\*\*. | Must | FR-22 |



\---



\## 5. Functional Requirements (FR)



\### 5.1 Landing Page

| ID | Requirement | Prio | Acceptance Criteria |

|---|---|---|---|

| FR-01 | Landing page menampilkan branding, harga per sesi, dan tombol \*\*"MULAI FOTO"\*\*. | M | Tombol ≥ 96 px tinggi dan terlihat tanpa scroll |

| FR-02 | Menekan "MULAI FOTO" membuat `Transaction` berstatus `PENDING` dan masuk ke halaman pembayaran. | M | Tap ganda dalam 400 ms hanya membuat 1 transaksi |



\### 5.2 Payment Flow

| ID | Requirement | Prio | Acceptance Criteria |

|---|---|---|---|

| FR-03 | Halaman pembayaran menampilkan total, kode transaksi, dan gambar \*\*QRIS statis\*\* lokal. | M | Gambar QRIS dimuat dari `public/` lokal |

| FR-04 | Memilih metode `QRIS` atau `CASH`. | M | `Transaction.paymentMethod` terisi saat konfirmasi |

| FR-05 | Tombol \*\*"Konfirmasi Bayar"\*\* dan \*\*"Batal"\*\* dapat langsung ditekan oleh operator di samping kios (atau via hotkey `F2` = konfirmasi, `Esc` = batal). | M | Konfirmasi sukses mengubah status `PENDING → PAID` |

| FR-06 | Transaksi `PENDING` otomatis `EXPIRED` setelah batas waktu (default 3 menit). | M | Layar kembali ke landing page jika expired |

| FR-07 | \*\*Guard server-side:\*\* rute sesi foto menolak akses jika transaksi bukan `PAID`. | M | Akses langsung ke `/session/...` tanpa `PAID` → redirect ke landing |



\### 5.3 Frame, Capture, Filter, Cetak \& QR

| ID | Requirement | Prio | Acceptance Criteria |

|---|---|---|---|

| FR-08 | Pemilihan layout frame dari database. | M | Frame terpilih tersimpan di `PhotoSession.frameId` |

| FR-09 | Viewfinder menggunakan input video DroidCam USB (mirror + crop guide). | M | Feed ≥ 24 fps |

| FR-10 | Sesi 5x jepret otomatis dengan timer 3-2-1 dan flash. | M | 5 foto tersimpan di memori lokal |

| FR-11 | Seleksi tepat 2 foto favorit dari 5 jepretan. | M | Tombol "LANJUT" aktif setelah 2 foto dipilih |

| FR-12 | Penerapan filter warna real-time pada Canvas. | M | Pratinjau berubah ≤ 200 ms |

| FR-13 | Render final 1200×1800 px (4R @ 300 DPI) dan cetak otomatis via `window.print()`. | M | Kertas keluar tanpa dialog cetak |

| FR-14 | Generasi QR Code unik per invoice (`/invoice/{token}`) untuk unduh dari HP. | M | QR dibuat lokal di browser |



\---



\## 6. Non-Functional Requirements (NFR)



\- \*\*Performance\*\*: Latensi jepret ≤ 100 ms, render canvas ≤ 3 detik\[cite: 4].

\- \*\*Reliability\*\*: 100% offline-first untuk alur inti foto dan cetak\[cite: 4].

\- \*\*Usability\*\*: UI Neo-Brutalism (border solid 4px, hard shadow `4px 4px 0 #000`, warna kontras tinggi)\[cite: 4].

\- \*\*Security\*\*: Tokenized invoice URL (entropy ≥ 128-bit)\[cite: 4].



\---



\## 7. Scope MVP



\- \*\*Scope In\*\*: Landing page, konfirmasi bayar manual operator 1-klik, pilih frame, jepret 5x, pilih 2 foto, filter warna, render canvas 4R, auto-print, QR code invoice\[cite: 4].

\- \*\*Scope Out\*\*: Payment gateway otomatis, PIN login, Dashboard admin terpisah, online cloud sync\[cite: 4].

