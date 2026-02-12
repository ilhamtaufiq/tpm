# TPM Super App Design System (Stitch UI)

Sistem desain ini menggunakan pendekatan **Premium Bento Layout** dengan sentuhan **Glassmorphism** dan **Dark UI Hybrid**. Fokus utama adalah pada kejelasan data, hierarki visual yang kuat, dan estetika modern "Apple-like".

## 🎨 Color Palette

### Core Colors
- **Primary (TPM Blue):** `#023C69` (Gunakan untuk aksi utama, FAB, dan identitas brand)
- **Secondary (Emerald):** `#10B981` (Gunakan untuk indikator positif, saldo, atau status tersedia)
- **Surface:** `#F8F9FA` (Background halaman utama agar kartu terlihat "pop-out")
- **Dark Surface:** `#121212` / `#1A1A1A` (Background header premium)

---

## 📐 Layout & Spacing

### Bento Grid Principles
- **Grid Gap:** Default `16px` (space-x-4 / space-y-4)
- **Rounding:** 
  - **Main Cards:** `rounded-[32px]` atau `rounded-[48px]` (Sangat tumpul untuk kesan modern)
  - **Bento Stats:** `rounded-[24px]`
  - **Inputs/Buttons:** `rounded-2xl`
- **Header:** `rounded-b-[48px]` (Header melengkung ke bawah, memberikan transisi mulus ke konten)

---

## 💎 Flexible Component Patterns

### 1. Adaptive Premium Header
Gunakan pattern ini untuk menyesuaikan stats berdasarkan konteks halaman (Inventori, Antrian, atau Finansial).
- **Stats Slot (Count):** Gunakan label uppercase kecil di atas angka besar.
- **Stats Slot (Currency):** Gunakan prefix "Rp" kecil dan bold untuk angka finansial.

```tsx
{/* Header Container */}
<View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
    {/* Navigation Row */}
    <View className="flex-row items-center justify-between mb-8">
        <View className="flex-row items-center">
            <TouchableOpacity className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5">
                <ChevronLeft size={24} color="white" />
            </TouchableOpacity>
            <View>
                <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Title</Typography>
                <Typography className="text-white/50 text-xs mt-0.5">Context Description</Typography>
            </View>
        </View>
    </View>

    {/* Dynamic Stats Row (Adaptive) */}
    <View className="flex-row justify-between">
        <View className="flex-1 bg-white/10 p-4 rounded-[24px] border border-white/5 mr-2">
            <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1">Label</Typography>
            <Typography weight="bold" className="text-white text-xl">Value</Typography>
        </View>
    </View>
</View>
```

### 2. Floating Search & Filter Overlay
Gunakan overlay ini untuk memberikan akses cepat pada data tanpa memakan space permanen di konten.
```tsx
<View className="px-6 -mt-6 z-10">
    <View className="bg-white p-2 rounded-3xl shadow-xl flex-row items-center border border-gray-50">
        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
            <Search size={18} color="#9CA3AF" />
            <TextInput placeholder="Search data..." className="flex-1 ml-3 text-sm font-medium" />
        </View>
        <TouchableOpacity className="ml-2 w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center">
            <Filter size={20} color="#023C69" />
        </TouchableOpacity>
    </View>
</View>
```

### 3. Entity/Transaction Card (Flexible List Item)
Kartu dengan hierarki data 3-level: Visual ID, Info Utama, Info Sekunder.
```tsx
<TouchableOpacity className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center">
    {/* Identification Slot (Icon/Short Text) */}
    <View className="w-16 h-16 bg-emerald-50 rounded-[20px] items-center justify-center mr-4">
        {/* Content */}
    </View>
    
    <View className="flex-1">
        {/* Main Info + Status Badge */}
        <View className="flex-row items-center justify-between mb-2">
            <Typography variant="body1" weight="bold">Title</Typography>
            {/* Glass Badge */}
        </View>
        
        {/* Secondary Details */}
        <Typography variant="caption" className="text-textGray">Detail 1 • Detail 2</Typography>
        
        {/* Footer/Financial Row */}
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50/50">
            {/* Timestamp/Icons */}
            {/* Price/Amount (if needed) */}
        </View>
    </View>
</TouchableOpacity>
```

### 4. Premium Segmented Tabs (Menu Tabs)
Gunakan untuk navigasi antar kategori atau filter data yang tidak memakan tempat banyak.
```tsx
<Tabs
    items={[
        { label: 'Category 1', value: '1', icon: Icon1 },
        { label: 'Category 2', value: '2', icon: Icon2 },
    ]}
    value={activeTab}
    onChange={setActiveTab}
    className="mb-8"
/>
```

### 5. Glassmorphism Badge
Untuk status di atas gambar atau background gelap.
```tsx
<View className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
    <Typography className="text-white uppercase text-[8px] tracking-widest font-bold">STATUS</Typography>
</View>
```

### 6. Premium Global Modal (AlertDialog & BaseModal)
Gunakan pattern ini untuk konfirmasi aksi, peringatan, atau input data modular.
- **Backdrop:** `rgba(0,0,0,0.6)`
- **Roundness:** `rounded-[48px]` (Super tumpul)
- **Icon Container (Alert):** `rounded-[32px]` (Bento Tile style) dengan border tipis sewarna icon.
- **Buttons:** `rounded-2xl` dengan tinggi `h-14` untuk kemudahan interaksi.

**AlertDialog Pattern (Konfirmasi):**
```tsx
<AlertDialog
    visible={visible}
    title="Success"
    message="Action completed successfully"
    variant="success"
    onClose={...}
/>
```

**BaseModal Pattern (Custom Content):**
```tsx
<BaseModal visible={visible} onClose={...} title="Payment Info">
    {/* Custom Content Here */}
</BaseModal>
```

---

## 📝 Typography Hierarchy

| Level | Size | Weight | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | `text-3xl` | Bold | `tracking-tighter` | Page Titles |
| **H2** | `text-2xl` | Bold | `tracking-tight` | Screen Headers |
| **H3** | `text-xl` | Bold | `tracking-normal` | Section Titles |
| **Body1** | `text-base` | Bold/Medium | Default | List Item Titles |
| **Caption** | `text-xs` | Bold | `tracking-widest` | Meta-data / Labels |

---

## ✨ Design Principles for Data
1. **No Visual Noise:** Jangan gunakan border solid hitam. Gunakan bayangan (`shadow-sm` ke `shadow-xl`) dan warna border `gray-50` atau `white/5`.
2. **Contextual Icons:** Setiap stats atau action card harus memiliki ikon visual yang membantu scan-ability.
3. **Empty states are Premium:** Gunakan `EmptyState` dengan ilustrasi ikon yang pudar (`opacity-10`) dan `tracking-[4px]` pada teksnya.
4. **Loading Shimmer:** Gunakan `SkeletonCard` yang mengikuti bentuk bento agar transisi terasa halus.
