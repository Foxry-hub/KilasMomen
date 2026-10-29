# Design Requirements — Responsivitas, Auto Layout & Grid (Happy Click)

> Dokumen pelengkap dari [`design.md`](./design.md). `design.md` mendefinisikan **bahasa visual** (Neo-Brutalism, warna, tipografi, motion). Dokumen ini mendefinisikan **aturan teknis layout** (Auto Layout, Responsivitas Multi-Device, Sistem Grid) dengan contoh class Tailwind CSS siap pakai.
>
> **Tujuan utama:** memastikan tampilan aplikasi **TIDAK TERPOTONG** (tidak ada konten/ tombol utama yang terpotong atau tersembunyi) di semua perangkat target — dari HP pengunjung, kiosk touchscreen, laptop 14", laptop 15.6", hingga TV/display eksternal.

| Atribut | Nilai |
|---|---|
| **Nama Produk** | Happy Click (Localhost Photobooth Kios) |
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 18 Oktober 2026 |
| **Dokumen Terkait** | [`design.md`](./design.md) (Design System Neo-Brutalism) |
| **Stack** | Next.js (App Router) · Tailwind CSS · CSS Variables |

---

## Daftar Isi

1. [Target Perangkat & Breakpoints (Tailwind CSS)](#1-target-perangkat--breakpoints-tailwind-css)
2. [Aturan Auto Layout & Container Fleksibel](#2-aturan-auto-layout--container-fleksibel)
3. [Skala Neo-Brutalisme Sesuai Ukuran Layar](#3-skala-neo-brutalisme-sesuai-ukuran-layar)
4. [Checklist Penjagaan Border & Overflow (Safe Guards)](#4-checklist-penjagaan-border--overflow-safe-guards)
5. [Resep Layout Per-Rute](#5-resep-layout-per-rute)
6. [Konfigurasi Tailwind Tambahan](#6-konfigurasi-tailwind-tambahan)

---

## 0. Golden Rules (Wajib Dipatuhi)

| # | Aturan | Konsekuensi jika dilanggar |
|---|---|---|
| 1 | **Mobile-first.** Tulis class untuk layar terkecil dulu, lalu naik dengan `md: lg: xl: 2xl:`. | Layout default rusak di 14" karena base hanya dirancang untuk 15.6". |
| 2 | **Tidak ada tinggi/lebar hardcode di konteks layout utama.** Gunakan `w-full`, `max-w-*`, `flex-1`, `min-h-0`. | Konten terpotong di layar kecil / muncul scrollbar tak diinginkan. |
| 3 | **Setiap parent flex/grid yang akan di-scroll wajib punya `min-h-0` / `min-w-0`.** | Anak `flex-1` tidak bisa menyusut → overflow meluber keluar layar. |
| 4 | **Aksi utama (tombol besar) selalu di dalam safe area & terlihat tanpa scroll.** | Tombol "CETAK / BAYAR" tertutup taskbar Windows → transaksi gagal. |
| 5 | **Gunakan unit viewport dinamis (`svh`/`dvh`), bukan `vh` murni, pada Kiosk.** | Perbedaan tinggi toolbar browser membuat layout Kiosk terpotong. |
| 6 | **Semua modal/popup dibatasi `max-h-[90vh]` + `overflow-y-auto`.** | Dialog meluber keluar layar 14", tombol OK tidak terjangkau. |

---

## 1. Target Perangkat & Breakpoints (Tailwind CSS)

### 1.0 Ringkasan Breakpoint

| # | Perangkat | Resolusi Fisik | Prefix Tailwind | Rentang Lebar | Area Aplikasi Utama |
|---|---|---|---|---|---|
| 1 | TV / Monitor Eksternal / Display Promosi | ≥ 1920×1080 | `2xl:` | `≥ 1536px` | Display promosi, layar tambahan Operator |
| 2 | Laptop Utama 15.6 inci | 1920×1080 | `xl:` | `1280px – 1535px` | **Base layout standar** Operator & Kiosk desktop |
| 3 | Laptop Ringkas 14 inci | 1366×768 (scaling 125%) | `lg:` | `1024px – 1279px` | **Zona rawan terpotong vertikal** |
| 4 | Touchscreen Kiosk Tablet/Monitor | 768×1024 s.d. 1024×768 | `md:` | `768px – 1023px` | Kiosk sentuh (touch target ≥ 48px) |
| 5 | HP Pengunjung | 360×640 s.d. 430×932 | `sm:` / base | `< 768px` | Halaman publik `/invoice/[token]` |

> **Catatan:** Breakpoint mengikuti default Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`). Karena laptop 14" dengan scaling 125% efektif berjalan di sekitar **1366×768 CSS px**, ia jatuh di breakpoint `lg:` dan inilah konfigurasi paling sering bermasalah.

---

### 1.1 Layar Besar / TV / Monitor Eksternal (`2xl:` · ≥ 1536px)

Digunakan untuk **Display Promosi** dan **Layar Tambahan Operator**. Karena ruang lega, layout menggunakan padding & gap lebih renggang serta font *scaled up*.

**Aturan:**
- Padding & gap lebih besar (`2xl:p-16`, `2xl:gap-12`).
- Font dan shadow naik satu tingkat (`2xl:text-3xl`, `2xl:shadow-brut-lg`).
- Container tetap dibatasi (`max-w-screen-2xl mx-auto`) agar konten tidak "melar" tak berujung di TV ultrawide.

```tsx
{/* Display promosi / landing pada TV */}
<main className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-center gap-8 p-8 2xl:gap-12 2xl:p-16">
  <h1 className="font-display text-5xl uppercase leading-none tracking-tight text-ink xl:text-6xl 2xl:text-8xl">
    Happy Click
  </h1>

  <button className="w-full max-w-md border-4 border-black bg-brand-yellow px-8 py-6
                     font-display text-2xl uppercase shadow-[4px_4px_0_0_#000]
                     xl:shadow-[6px_6px_0_0_#000] 2xl:w-auto 2xl:max-w-2xl 2xl:px-16 2xl:py-8 2xl:text-4xl">
    Mulai Foto
  </button>
</main>
```

---

### 1.2 Laptop Utama 15.6 inci (`xl:` · 1280px – 1535px · 1920×1080)

**Base layout standar** untuk Operator & Kiosk desktop. Semua desain di `design.md` dikalibrasi di ukuran ini.

**Aturan:**
- Ini adalah acuan "1.0×": ukuran border `border-4`, shadow default `shadow-[4px_4px_0_0_#000]`.
- Layout 2 kolom (mis. Editor Kios) aman ditampilkan penuh di sini (`grid-cols-2`).
- Gunakan `xl:` hanya untuk *enhancement* (mis. menaikkan shadow ke `6px`), bukan untuk memperbaiki layout rusak.

```tsx
{/* Editor Kios: 2 kolom di ≥ 1024px */}
<div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 xl:gap-10">
  {/* Kolom preview */}
  <section className="flex min-h-0 flex-col gap-4">
    {/* gambar dibatasi max-h agar tidak mendorong tombol keluar layar */}
    <img
      src={previewUrl}
      alt="Preview"
      className="mx-auto max-h-[60vh] w-full max-w-xl border-4 border-black object-contain shadow-[4px_4px_0_0_#000] xl:shadow-[6px_6px_0_0_#000]"
    />
  </section>

  {/* Kolom kontrol */}
  <section className="flex min-h-0 flex-col gap-4">
    {/* ...toolbar filter... */}
  </section>
</div>
```

---

### 1.3 Laptop Ringkas 14 inci (`lg:` · 1024px – 1279px · 1366×768 / scaling 125%)

> ⚠️ **Aturan Krusial:** Konten **TIDAK BOLEH terpotong vertikal**. Tinggi efektif hanya ±768 CSS px, sehingga header + konten + footer mudah melewati batas layar.

**Aturan wajib:**
1. Gunakan unit fleksibel: `vh` / `svh` / `%` / `flex-1` — bukan tinggi tetap.
2. Batasi ukuran gambar/frame dengan `max-h-[...]` (mis. `max-h-[60vh]` atau `max-h-[calc(100svh-16rem)]`).
3. Tombol utama harus **terlihat tanpa scroll** → letakkan pada baris aksi `sticky`/`shrink-0` di bagian bawah, dan buat area konten di atasnya `flex-1 min-h-0 overflow-y-auto`.
4. Bila ruang makin sempit, turunkan ukuran gambar, bukan menambah scrollbar pada tombol.

**Pola "Sticky Action Bar" (aman di 14"):**

```tsx
{/* Shell halaman Kios/Editor: header tetap, konten fleksibel, aksi selalu terlihat */}
<div className="flex h-[100svh] flex-col overflow-hidden bg-paper">
  {/* Header — tidak boleh menyusut */}
  <header className="shrink-0 border-b-4 border-black bg-white p-4 lg:p-6">
    <h2 className="font-display text-xl uppercase lg:text-2xl xl:text-3xl">Editor Foto</h2>
  </header>

  {/* Konten — menyusut & scroll internal bila perlu */}
  <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-6">
    <img
      src={previewUrl}
      alt="Preview"
      className="mx-auto w-full max-w-xl max-h-[55vh] border-4 border-black object-contain
                 shadow-[4px_4px_0_0_#000] lg:max-h-[52vh] xl:max-h-[60vh]"
    />
  </main>

  {/* Action bar — SELALU terlihat tanpa scroll */}
  <footer className="shrink-0 border-t-4 border-black bg-white p-4 lg:p-6">
    <button className="w-full border-4 border-black bg-brand-green py-4 font-display text-xl uppercase
                       shadow-[4px_4px_0_0_#000] xl:text-2xl">
      Lanjut ke Cetak
    </button>
  </footer>
</div>
```

**Helper: rumus tinggi konten agar tidak overflow**

```tsx
{/* Sisa tinggi = viewport - header - footer - padding. Dipakai untuk mengunci gambar. */}
<div className="flex h-[100svh] flex-col">
  <header className="h-16 shrink-0 lg:h-20" />
  <main className="min-h-0 flex-1">
    <img className="h-full w-auto max-w-full object-contain" />
  </main>
  <footer className="h-24 shrink-0 lg:h-28" />
</div>
```

---

### 1.4 Touchscreen Kiosk Tablet / Monitor (`md:` · 768px – 1023px)

Kiosk disentuh dengan jari (bukan mouse), sehingga **area ketuk minimum 48×48 px** wajib.

**Aturan:**
- Semua elemen interaktif minimal `min-h-12 min-w-12` (48px) — idealnya lebih besar untuk tombol utama.
- Jarak antar target ketuk ≥ `gap-3` (12px), rekomendasi `gap-4` (16px) seperti di `design.md` §4.1.1.
- Tidak ada interaksi bergantung *hover*.
- Layout utama masih ada di mode sentuh: gunakan 1–2 kolom fleksibel.

```tsx
{/* Grid tombol yang ramah sentuh */}
<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
  <button className="flex min-h-[48px] min-w-[48px] items-center justify-center border-4 border-black
                     bg-white px-4 py-3 font-display text-lg uppercase shadow-[3px_3px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none">
    Ubah Frame
  </button>
</div>

{/* Tab bar kiosk: target ≥ 48px + tidak bergantung hover */}
<nav className="flex shrink-0 gap-3 border-t-4 border-black bg-white p-3">
  <button className="min-h-12 flex-1 border-4 border-black bg-brand-cyan font-display uppercase">Foto</button>
  <button className="min-h-12 flex-1 border-4 border-black bg-brand-yellow font-display uppercase">Filter</button>
  <button className="min-h-12 flex-1 border-4 border-black bg-brand-green font-display uppercase">Cetak</button>
</nav>
```

---

### 1.5 Mobile HP Pengunjung (`sm:` / `< 768px`)

Dipakai untuk halaman publik **`/invoice/[token]`** yang dibuka pengunjung via scan QR.

**Aturan:**
- Layout **1 kolom penuh (single column)** — jangan paksakan 2 kolom.
- Padding rapat (`px-4`, `p-4`), teks proporsional agar tidak horizontal-scroll.
- Tombol unduh/lihat foto **berukuran penuh (`w-full`)**.
- Gambar invoice `w-full h-auto object-contain` tanpa lebar tetap.

```tsx
{/* /invoice/[token] — 1 kolom penuh, tanpa overflow horizontal */}
<main className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col gap-5 overflow-x-hidden bg-paper p-4">
  <h1 className="text-center font-display text-2xl uppercase leading-tight">Invoice Foto Anda</h1>

  <img
    src={`/api/public/invoice/${token}/image`}
    alt="Hasil foto"
    className="w-full border-4 border-black bg-white object-contain shadow-[3px_3px_0_0_#000]"
  />

  <div className="flex flex-col gap-3">
    <a
      href={`/api/public/invoice/${token}/image?download=1`}
      className="flex min-h-[48px] w-full items-center justify-center border-4 border-black bg-brand-green py-4
                 text-center font-display text-lg uppercase shadow-[3px_3px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      Unduh Foto
    </a>
    <a
      href="/"
      className="flex min-h-[48px] w-full items-center justify-center border-4 border-black bg-white py-4
                 text-center font-display text-lg uppercase"
    >
      Buka Lagi
    </a>
  </div>
</main>
```

> **Anti-pattern:** `grid-cols-2` pada HP, `w-[360px]`, atau `whitespace-nowrap` panjang → menyebabkan horizontal scroll pada `/invoice`.
> **Guard:** pasang `overflow-x-hidden` pada wrapper utama dan pastikan semua gambar `max-w-full`.

---

## 2. Aturan Auto Layout & Container Fleksibel

### 2.1 Larangan Hardcode Width / Height

**DILARANG** pada konteks layout utama:
- `w-[1200px]`, `w-[800px]`, `h-[800px]`, `h-[600px]`, `min-w-[1000px]`
- Width/height pixel tetap untuk container, kartu, kolom, atau panel.

**WAJIB** gunakan kombinasi:

| Kebutuhan | Gunakan | Contoh |
|---|---|---|
| Mengisi ruang tersedia | `w-full` / `h-full` | `<section className="w-full">` |
| Membatasi lebar maksimum | `max-w-*` | `max-w-md`, `max-w-screen-lg`, `max-w-[80ch]` |
| Membagi sisa ruang flex | `flex-1` + `min-h-0` / `min-w-0` | `<main className="min-h-0 flex-1">` |
| Ukuran gambar proporsional | `object-contain` + `max-h-[..]` | `max-h-[60vh] w-auto object-contain` |
| Membatasi tinggi panel | `max-h-[..]` + `overflow-y-auto` | `max-h-[70vh] overflow-y-auto` |

```tsx
{/* ✅ BENAR — fleksibel untuk semua ukuran layar */}
<div className="flex min-h-0 w-full flex-col gap-4">
  <div className="w-full max-w-3xl flex-1 border-4 border-black bg-white p-4 lg:p-6">
    Konten
  </div>
  <img className="max-h-[60vh] w-full max-w-lg object-contain" src={src} alt="" />
</div>
```

```tsx
{/* ❌ SALAH — hardcode piksel, pasti terpotong di 14" */}
<div className="h-[800px] w-[1200px]">
  Konten
</div>
```

> **Pengecualian sah:** ukuran ikon kecil (`size-6`), ketebalan border, dan nilai dekoratif non-layout (mis. `w-[6px]` untuk garis aksen) tetap boleh dalam piksel.

### 2.2 Viewport Lock untuk Mode Kiosk (`/kiosk`)

Antarmuka Kiosk harus pas 100% di layar **tanpa scrollbar browser**.

```tsx
{/* /kiosk — viewport lock penuh, no-scroll */}
<div className="flex h-screen h-[100svh] w-full flex-col overflow-hidden bg-paper">
  <header className="shrink-0 border-b-4 border-black bg-white p-4">Judul / Stepper</header>

  {/* Preview foto: proporsional & tidak mendorong layout keluar */}
  <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
    <img
      src={previewUrl}
      alt="Preview"
      className="max-h-[60vh] w-auto max-w-full border-4 border-black object-contain shadow-[4px_4px_0_0_#000]"
    />
  </main>

  <footer className="shrink-0 border-t-4 border-black bg-white p-4">
    <button className="w-full border-4 border-black bg-brand-yellow py-4 font-display text-xl uppercase">
      Ambil Foto
    </button>
  </footer>
</div>
```

**Aturan tambahan:**
- Kombinasikan `h-[100svh]` (small viewport height) agar tidak "melompat" saat toolbar browser mobile muncul/hilang.
- `overflow-hidden` hanya pada shell Kiosk; **jangan** diterapkan ke kontainer yang memang butuh scroll internal.
- Elemen `<img>` preview: selalu `object-contain` + `max-h-[60vh]` agar proporsional di 14" maupun 15.6".
- Untuk frame overlay PNG, gunakan `absolute inset-0 object-contain` di dalam wrapper `relative`.

```tsx
{/* Frame overlay proporsional mengikuti preview */}
<div className="relative mx-auto max-h-[60vh] w-full max-w-xl">
  <img src={photoUrl} className="h-full w-full border-4 border-black object-contain" alt="" />
  <img src={frameUrl} className="pointer-events-none absolute inset-0 h-full w-full object-contain" alt="" />
</div>
```

### 2.3 Scrollable Area untuk Panel Operator (`/operator`)

Tabel antrean transaksi & daftar template frame boleh scroll **independen**, dengan scrollbar Neo-Brutalisme (border hitam).

```tsx
{/* /operator — 2 kolom; masing-masing punya scroll sendiri */}
<div className="grid h-[100svh] w-full grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[2fr_1fr]">
  {/* Tabel transaksi — scroll independen */}
  <section className="flex min-h-0 flex-col border-4 border-black bg-white">
    <header className="shrink-0 border-b-4 border-black bg-brand-yellow p-3 font-display uppercase">
      Antrean Transaksi
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-brut">
      {/* <table> ... baris transaksi ... */}
    </div>
  </section>

  {/* Daftar template frame — scroll independen */}
  <section className="flex min-h-0 flex-col border-4 border-black bg-white">
    <header className="shrink-0 border-b-4 border-black bg-brand-cyan p-3 font-display uppercase">
      Template Frame
    </header>
    <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 scrollbar-brut">
      {/* item frame */}
    </ul>
  </section>
</div>
```

**CSS scrollbar Neo-Brutalisme** (definisikan sekali di `globals.css`):

```css
/* Chrome / Edge / Safari */
.scrollbar-brut::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}
.scrollbar-brut::-webkit-scrollbar-track {
  background: #fff;
  border-left: 3px solid #000;   /* garis pemisah tegas */
}
.scrollbar-brut::-webkit-scrollbar-thumb {
  background: #000;              /* blok hitam */
  border: 3px solid #000;
}
.scrollbar-brut::-webkit-scrollbar-thumb:hover {
  background: #333;
}

/* Firefox */
.scrollbar-brut {
  scrollbar-width: thin;
  scrollbar-color: #000 #fff;
}

/* Sembunyikan scrollbar khusus area Kiosk (tetap bisa scroll programatik) */
.scrollbar-hidden::-webkit-scrollbar { display: none; }
.scrollbar-hidden { scrollbar-width: none; -ms-overflow-style: none; }
```

> **Penting:** Parent scroll (`overflow-y-auto`) **harus** punya `min-h-0` saat berada di dalam rantai flex, jika tidak kontainer tidak akan menyusut dan scroll tidak akan muncul.

### 2.4 Referensi Unit Viewport (Kiosk)

| Unit | Arti | Kapan dipakai |
|---|---|---|
| `vh` | 1% tinggi viewport **terbesar** | Hindari pada Kiosk (bisa overflow saat toolbar muncul). |
| `svh` | 1% tinggi viewport **terkecil** (aman) | **Default untuk layout lock Kiosk** (`h-[100svh]`). |
| `dvh` | Tinggi viewport **dinamis** | Konten yang boleh ikut berubah saat toolbar berubah. |
| `%` | Relatif terhadap parent | Tinggi anak di dalam parent ber-tinggi pasti. |

**Aturan emas:** shell layar penuh Kiosk = `h-[100svh]` (± fallback `h-screen`), bukan `h-[800px]`.

### 2.5 Safe Area (Anti Taskbar Windows)

Tombol utama tidak boleh tertutup taskbar Windows (≈ 40–48px di bawah) atau *home indicator* HP.

```tsx
{/* Padding bawah ekstra aman + iOS safe-area */}
<footer
  className="shrink-0 border-t-4 border-black bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
>
  <button className="w-full border-4 border-black bg-brand-green py-5 font-display text-xl uppercase
                     shadow-[4px_4px_0_0_#000]">
    Selesai
  </button>
</footer>
```

> Untuk aplikasi Kiosk desktop jalankan Chrome dalam mode `--kiosk --start-fullscreen` (lihat `design.md` §6.3) sehingga taskbar Windows tidak muncul sama sekali.

---

## 3. Skala Neo-Brutalisme Sesuai Ukuran Layar

Nilai border, hard shadow, tipografi, dan spacing **diskala** mengikuti ukuran layar agar proporsional di HP hingga TV.

### 3.1 Border

| Perangkat | Class Tailwind | Nilai |
|---|---|---|
| Mobile (HP) | `border-2 border-black` | 2px |
| Desktop / Laptop (14" & 15.6") | `border-4 border-black` | 4px |
| TV / Display (opsional) | `border-4 border-black 2xl:border-[6px]` | 4–6px |

```tsx
<div className="border-2 border-black md:border-4">
  Kartu
</div>

{/* Judul/divider juga menyesuaikan */}
<h1 className="border-b-2 border-black pb-2 font-display uppercase md:border-b-4">Happy Click</h1>
```

### 3.2 Hard Shadow

| Perangkat | Class Tailwind | Nilai |
|---|---|---|
| Mobile (HP) | `shadow-[3px_3px_0_0_#000]` | 3px |
| Laptop 14" (`lg:`) | `shadow-[4px_4px_0_0_#000]` | 4px |
| Laptop 15.6" / TV (`xl:`) | `shadow-[6px_6px_0_0_#000]` | 6px |

```tsx
{/* Skala shadow bertingkat dari HP → TV */}
<button className="border-2 border-black bg-brand-yellow px-5 py-3 font-display uppercase
                   shadow-[3px_3px_0_0_#000]
                   md:border-4
                   lg:shadow-[4px_4px_0_0_#000]
                   xl:shadow-[6px_6px_0_0_#000]">
  Ambil Foto
</button>
```

> **Efek tekan** tetap konsisten di semua skala: `active:translate-x-1 active:translate-y-1 active:shadow-none` (geser 4px & shadow hilang, sesuai `design.md` §4.1.4).
>
> **Catatan token:** bila memakai token dari `design.md` (`shadow-brut-sm/md/lg/xl`), petakan sebagai: HP → `shadow-brut-sm`, 14" → `shadow-brut`, 15.6"/TV → `shadow-brut-lg`. Nilai literal di atas boleh dipakai bila ingin angka persis `3/4/6px`.

### 3.3 Typo Scaling

Gunakan class Tailwind **dinamis** agar ukuran huruf menyesuaikan tinggi layar secara otomatis.

| Elemen | Mobile | Kiosk Tablet | 14" | 15.6" | TV |
|---|---|---|---|---|---|
| Judul Halaman | `text-xl` | `text-2xl` | `text-3xl` | `text-4xl` | `text-5xl` |
| Sub Judul | `text-base` | `text-lg` | `text-xl` | `text-2xl` | `text-3xl` |
| Tombol | `text-base` | `text-lg` | `text-xl` | `text-2xl` | `text-3xl` |
| Body/Label | `text-sm` | `text-base` | `text-base` | `text-lg` | `text-xl` |

```tsx
{/* Judul — menyesuaikan tinggi layar tanpa media query manual */}
<h1 className="font-display uppercase leading-none tracking-tight
               text-2xl sm:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl">
  Selamat Datang di Happy Click
</h1>

{/* Tombol utama */}
<button className="font-display uppercase text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl">
  Cetak Sekarang
</button>

{/* Label/bantuan */}
<p className="text-sm md:text-base lg:text-base xl:text-lg 2xl:text-xl">
  Pilih 2 foto terbaik Anda
</p>
```

> **Aturan tinggi layar:** pada laptop 14" yang rendah, **batasi juga tinggi teks** — hindari `text-6xl+` di dalam area `max-h-[60vh]`, karena teks besar + gambar besar membuat konten melebihi tinggi layar.

### 3.4 Spacing, Padding, Gap

| Konteks | Mobile | 14" (`lg:`) | 15.6" (`xl:`) | TV (`2xl:`) |
|---|---|---|---|---|
| Padding halaman | `p-4` | `p-6` | `p-8` | `p-12` |
| Padding kartu | `p-4` | `p-5` | `p-6` | `p-8` |
| Gap antar elemen | `gap-3` | `gap-4` | `gap-6` | `gap-8` |

```tsx
<div className="flex flex-col gap-3 p-4 lg:gap-4 lg:p-6 xl:gap-6 xl:p-8 2xl:gap-8 2xl:p-12">
  {/* konten */}
</div>
```

### 3.5 Tabel Ringkas Mapping Neo-Brutalisme per Breakpoint

| Properti | Base / HP (`sm:`) | Tablet (`md:`) | 14" (`lg:`) | 15.6" (`xl:`) | TV (`2xl:`) |
|---|---|---|---|---|---|
| Border | `border-2` | `border-2` → `md:border-4` | `border-4` | `border-4` | `border-4` (`border-[6px]`) |
| Shadow | `shadow-[3px_3px_0_0_#000]` | `3px` | `shadow-[4px_4px_0_0_#000]` | `shadow-[6px_6px_0_0_#000]` | `shadow-[6px_6px_0_0_#000]` |
| Judul | `text-2xl` | `text-3xl` | `text-4xl` | `text-5xl` | `text-6xl` |
| Radius | `rounded-none` | `rounded-none` | `rounded-none` | `rounded-none` | `rounded-none` |
| Touch target | `min-h-12` | `min-h-12` | `min-h-12` | `min-h-12` | `min-h-12` |

---

## 4. Checklist Penjagaan Border & Overflow (Safe Guards)

Checklist wajib dijalankan developer **sebelum** menandai tugas selesai.

### 4.1 Checklist Inti

- [ ] Apakah semua tombol utama berada di dalam **safe area** (tidak tertutup taskbar Windows / home indicator)?
- [ ] Apakah modal / popup menggunakan `max-h-[90vh]` dan `overflow-y-auto`?
- [ ] Apakah layout 2 kolom di halaman **Editor Kios** berganti menjadi `flex-col` saat diakses di layar **< 1024px**?
- [ ] Apakah setiap parent flex yang punya anak `flex-1` sudah diberi **`min-h-0`** (vertikal) / **`min-w-0`** (horizontal)?
- [ ] Apakah shell Kiosk memakai `h-[100svh]` + `overflow-hidden` sehingga **tidak ada scrollbar browser**?
- [ ] Apakah gambar/frame preview dibatasi `max-h-[60vh]` + `object-contain`?
- [ ] Apakah **tidak ada** `w-[...px]` / `h-[...px]` pada container layout utama?
- [ ] Apakah panel Operator yang panjang memakai `overflow-y-auto` (scroll independen) + scrollbar Neo-Brutalisme?
- [ ] Apakah setiap elemen interaktif di mode sentuh punya area ≥ `min-h-12 min-w-12` (48px)?
- [ ] Apakah halaman `/invoice/[token]` 1 kolom penuh dengan tombol `w-full`, dan tidak ada horizontal scroll?
- [ ] Apakah tidak ada `overflow-hidden` yang tidak sengaja memotong konten penting (mis. menutup shadow/border tebal)?
- [ ] Apakah shadow/border tebal (mis. `shadow-[6px_6px_0_0_#000]`) tidak terpotong oleh parent `overflow-hidden`?

### 4.2 Checklist Test Multi-Device

Uji dengan DevTools → Device Toolbar pada resolusi berikut:

| Perangkat | Viewport Uji | Yang diverifikasi |
|---|---|---|
| HP Pengunjung | 360×640, 390×844 | `/invoice/[token]` 1 kolom, tombol `w-full`, tanpa scroll horizontal |
| Tablet Kiosk | 768×1024 (portrait & landscape) | Touch target ≥ 48px, layout tidak pecah |
| Laptop 14" | **1366×768** | Tidak ada konten terpotong vertikal, tombol utama terlihat tanpa scroll |
| Laptop 15.6" | 1920×1080 | Base layout tampil penuh, 2 kolom seimbang |
| TV / Display | 2560×1440 | Padding/gap lega, konten tetap `max-w-*` (tidak melar) |

### 4.3 Anti-Pattern & Perbaikannya

| ❌ Anti-Pattern | Kenapa rusak | ✅ Perbaikan |
|---|---|---|
| `h-[800px]`, `w-[1200px]` | Memaksa ukuran tetap → terpotong di layar lebih kecil | `h-[100svh]`, `w-full max-w-*` |
| `flex-1` tanpa `min-h-0` | Anak flex tidak menyusut → overflow meluber | `min-h-0 flex-1` |
| `h-screen` tanpa `overflow-hidden` pada Kiosk | Muncul scrollbar browser | `h-[100svh] overflow-hidden` |
| Modal tanpa batas tinggi | Dialog meluber keluar layar 14" | `max-h-[90vh] overflow-y-auto` |
| `grid-cols-2` dipaksa di HP | Konten sempit, terpotong / scroll horizontal | `grid-cols-1 lg:grid-cols-2` |
| Gambar tanpa `max-h-*` | Gambar besar mendorong tombol keluar layar | `max-h-[60vh] object-contain` |
| `text-6xl` di dalam panel rendah | Teks besar memaksa konten melebihi layar | Skala responsif `xl:text-5xl 2xl:text-6xl` |
| `overflow-hidden` pada parent berisi shadow | Hard shadow tebal terpotong | Pindahkan `overflow-hidden` ke level yang tepat / tambah padding |

---

## 5. Resep Layout Per-Rute

Ringkasan pola layout siap pakai untuk tiap area (nama rute mengikuti spesifikasi produk; padanannya di `design.md` §1.6 adalah area Kios `/` dan area Operator `/user`).

| Rute | Mode | Shell | Aturan Kunci |
|---|---|---|---|
| `/kiosk` (Landing/Payment) | Viewport Lock | `h-[100svh] overflow-hidden flex-col` | Header & footer `shrink-0`, konten `min-h-0 flex-1`, tombol utama `w-full` |
| `/kiosk` Editor (2 kolom) | Viewport Lock | `grid-cols-1 lg:grid-cols-2` | Preview `max-h-[60vh] object-contain`, flex-col di < 1024px |
| `/kiosk` Result | Viewport Lock | `h-[100svh]` | QR code ukuran tetap (`size-64`), teks fleksibel |
| `/operator` | Panel Scrollable | `grid-cols-1 lg:grid-cols-[2fr_1fr]` | Tiap panel `min-h-0 flex-1 overflow-y-auto` + `scrollbar-brut` |
| `/invoice/[token]` | Mobile Publik | `flex-col min-h-[100svh] max-w-md mx-auto` | 1 kolom, `w-full` tombol, `overflow-x-hidden` |

**Contoh modal universal (aman di semua layar):**

```tsx
{/* Modal: batas tinggi + scroll internal + tombol tetap terlihat */}
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
  <div className="flex max-h-[90vh] w-full max-w-2xl flex-col border-4 border-black bg-white shadow-[8px_8px_0_0_#000]">
    <header className="shrink-0 border-b-4 border-black bg-brand-yellow p-4 font-display uppercase">
      Konfirmasi
    </header>

    {/* Isi modal bisa di-scroll jika konten panjang */}
    <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-brut">
      {/* konten panjang */}
    </div>

    {/* Aksi selalu terlihat */}
    <footer className="flex shrink-0 gap-3 border-t-4 border-black p-4">
      <button className="w-full border-4 border-black bg-white py-3 font-display uppercase">Batal</button>
      <button className="w-full border-4 border-black bg-brand-green py-3 font-display uppercase">Konfirmasi</button>
    </footer>
  </div>
</div>
```

---

## 6. Konfigurasi Tailwind Tambahan

Token di bawah adalah tambahan opsional untuk mendukung aturan di dokumen ini (melengkapi token yang sudah ada di `design.md` §4.1.8).

```ts
// tailwind.config.ts (tambahan — opsional)
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Breakpoint eksplisit (sama dengan default Tailwind, ditulis agar terdokumentasi)
      screens: {
        sm: "640px",   // HP besar
        md: "768px",   // Kiosk tablet (touch target 48px)
        lg: "1024px",  // Laptop 14" (1366x768 @125%)
        xl: "1280px",  // Laptop 15.6" (1920x1080)
        "2xl": "1536px", // TV / display eksternal
      },
      // Hard shadow skala layar
      boxShadow: {
        "brut-xs": "3px 3px 0 0 #000",  // Mobile
        "brut-md": "4px 4px 0 0 #000",  // Laptop 14"
        "brut-xl2": "6px 6px 0 0 #000", // Laptop 15.6" / TV
      },
      // Tinggi yang mengikuti viewport dinamis
      height: {
        screen: "100vh",
        "screen-svh": "100svh",
        "screen-dvh": "100dvh",
      },
      minHeight: {
        touch: "48px", // Touch target kiosk minimum
      },
      minWidth: {
        touch: "48px",
      },
    },
  },
  plugins: [],
};

export default config;
```

**Global CSS pendukung:**

```css
/* globals.css */
html,
body {
  /* Cegah bounce/scroll tak diinginkan pada Kiosk */
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Pastikan konten tidak pernah melebar melewati viewport */
#__next,
body > div {
  max-width: 100vw;
}

/* Batasi gambar agar selalu proporsional */
img,
video,
canvas {
  max-width: 100%;
  height: auto;
}
```

---

## Lampiran: Ringkasan Cepat (Cheat Sheet)

| Kebutuhan | Class Tailwind |
|---|---|
| Shell layar penuh Kiosk | `flex h-[100svh] flex-col overflow-hidden` |
| Header/footer tidak menyusut | `shrink-0` |
| Konten mengisi sisa & scroll internal | `min-h-0 flex-1 overflow-y-auto` |
| Gambar proporsional terbatas | `max-h-[60vh] w-auto object-contain` |
| Grid responsif 2 kolom | `grid grid-cols-1 lg:grid-cols-2` |
| Touch target kiosk | `min-h-12 min-w-12` |
| Modal aman | `max-h-[90vh] overflow-y-auto` |
| Border skala layar | `border-2 md:border-4` |
| Shadow skala layar | `shadow-[3px_3px_0_0_#000] lg:shadow-[4px_4px_0_0_#000] xl:shadow-[6px_6px_0_0_#000]` |
| Typo skala layar | `text-base md:text-lg lg:text-xl xl:text-2xl` |
| Tombol unduh mobile | `w-full min-h-[48px]` |
| Scrollbar Neo-Brutalisme | `scrollbar-brut` |

---

*Dokumen ini bersifat normatif untuk implementasi UI Happy Click. Setiap penyimpangan harus dicatat sebagai keputusan desain eksplisit.*
