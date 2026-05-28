# TPM Application Design System & Guidelines

Dokumen ini memuat panduan struktur desain (*design system*) dan UI/UX yang diimplementasikan pada halaman-halaman utama aplikasi (seperti **Home**, **Jasa Angkut**, **Bengkel**, dan **Mobil**). 

Tujuan dari dokumen ini adalah untuk memastikan konsistensi antarmuka (*interface*) saat melakukan pengembangan fitur atau halaman baru.

---

## 1. Konsep Utama (Core Concept)

Aplikasi ini menggunakan pendekatan **"Premium & Modern"** dengan perpaduan elemen *Glassmorphism*, *Soft Shadows*, dan *Rounded Corners* yang ekstrem (hingga `48px` dan `32px`). Framework styling yang digunakan adalah **Tailwind CSS** (via NativeWind).

### Ciri Khas Desain:
- **Clean & Spacious**: Penggunaan *whitespace* / *padding* yang lega.
- **High Contrast Headers**: Bagian atas (header) menggunakan warna gelap (Primary) dengan teks putih, kontras dengan latar belakang aplikasi yang terang (`bg-surface` atau `bg-gray-50`).
- **Hybrid UI (Web & Mobile)**: Pendekatan responsif yang memanfaatkan fungsi *Modal* kustom di Web dan *BottomSheet* di Mobile untuk fitur-fitur sekunder seperti "Dompet" atau form *Quick Actions*.

---

## 2. Struktur Halaman (Page Structure)

Sebuah halaman utama biasanya memiliki struktur berikut:

```tsx
<View className="flex-1 bg-surface">
    <StatusBar barStyle="light-content" />

    {/* 1. Premium Header */}
    <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
        {/* Konten Header & Glassmorphism Cards */}
    </View>

    {/* 2. Main Content (ScrollView) */}
    <ScrollView className="flex-1 px-6 -mt-6">
        {/* Daftar Menu / Kartu */}
    </ScrollView>
</View>
```

---

## 3. Komponen Visual Kunci

### A. Premium Header & Glassmorphism
Bagian *header* selalu menggunakan warna utama (`bg-primary`) dan melengkung tajam di bagian bawah (`rounded-b-[48px]`).
Di dalam header, informasi *stats* atau saldo ditampilkan menggunakan efek *Glassmorphism*:
- Latar belakang tembus pandang: `bg-white/10`
- Garis tepi tipis: `border border-white/10`
- Teks putih dengan opacity: `text-white/50` atau `text-white/60`

### B. Typography & Text Styling
Aplikasi menggunakan komponen `<Typography>` kustom.
- **Judul Halaman (H2/H3)**: `text-2xl tracking-tighter text-white`
- **Sub-judul (Kategori)**: Selalu menggunakan huruf kapital (*uppercase*) dengan jarak antar huruf lebar (`tracking-[2px]` atau `tracking-widest`), ukuran font kecil (`text-[10px]`), dan `font-black`.
- **Mata Uang / Angka Saldo**: `text-3xl tracking-tight text-white weight="bold"`.

### C. Menu Cards (Kartu Menu)
Untuk daftar menu atau list (seperti di daftar master data, menu jasa angkut, dll):
- Latar belakang putih mutlak: `bg-white`
- Padding besar: `p-5` atau `p-6`
- Lengkungan: `rounded-[32px]`
- Bayangan halus: `shadow-sm`
- Border sangat tipis: `border border-gray-50`

**Ikon Menu:**
Setiap ikon di dalam kartu dibungkus dengan kontainer berbentuk *squircle* atau kotak membulat:
- Warna latar belakang mengikuti warna ikon dengan opacity sangat rendah (contoh: `bg-blue-50`).
- Border senada: `border border-blue-100/50`.
- Ikon dari **Lucide React Native** dengan ukuran seragam (biasanya `size={32}`).

### D. Dompet & Bottom Sheet (Fitur Interaktif)
Fitur interaktif seperti **Dompet Bengkel** atau **Dompet Jasa Angkut** tidak me-render halaman baru, melainkan muncul ke atas permukaan (overlay).
- **Mobile**: Menggunakan `@gorhom/bottom-sheet` (`<BottomSheet>`).
- **Web**: Menggunakan `<Modal>` dengan penyesuaian khusus.
  
**Aturan Modal di Web (Penting):**
Agar *modal* tidak terpotong (offset) saat konten di dalamnya sangat panjang (seperti riwayat aktivitas), struktur yang digunakan *wajib* seperti ini:
```tsx
<Modal visible={visible} transparent animationType="slide">
    <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={closeModal} />
        <View 
            className="bg-white rounded-t-[48px] shadow-2xl relative overflow-hidden" 
            style={{ maxWidth: 640, alignSelf: 'center', width: '100%', maxHeight: '90%' }}
        >
            <ScrollView showsVerticalScrollIndicator={false}>
                <View className="pt-16 px-9 pb-12">
                    {/* Konten Dompet / Form */}
                </View>
            </ScrollView>
        </View>
    </View>
</Modal>
```

---

## 4. Palet Warna (Color Scheme)

Walaupun mendukung kustomisasi tema dinamis, palet dasar yang sering digunakan sebagai aksen bawaan adalah:
1. **Primary**: Biru gelap (`#023C69`) - digunakan di Header dan Saldo Kas.
2. **Success (Dana Masuk)**: Emerald (`bg-emerald-50`, text: `text-emerald-600`, icon: `#10B981`).
3. **Danger (Dana Keluar / Pengeluaran)**: Rose (`bg-rose-50`, text: `text-rose-600`, icon: `#E11D48`).
4. **Warning (Hutang/Vendor)**: Amber (`bg-amber-50`, icon: `#F59E0B`).
5. **Info (Menu Alternatif)**: Purple / Blue.
6. **Muted / Gray**: `text-textGray/40` atau `text-gray-400` untuk teks placeholder dan sub-teks sekunder.

---

## 5. Ringkasan Implementasi

Jika membuat halaman baru untuk modul/unit bisnis lain di masa depan:
1. Duplikasi struktur dari `jasa-angkut/index.tsx` atau `bengkel/index.tsx`.
2. Ganti warna ikon sesuai tema unit bisnis tersebut.
3. Gunakan *Glassmorphism* untuk *dashboard stats* utama di header.
4. Gunakan `BottomSheet` (kombinasi Modal Web) untuk fitur yang menuntut aksi cepat (quick actions) seperti pengeluaran kas atau filter laporan.
5. Pertahankan lengkungan ekstrim (`rounded-[32px]` dan `rounded-[48px]`) untuk menjaga konsistensi bentuk elemen UI yang terkesan tebal dan premium.
