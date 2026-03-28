# Rencana Implementasi "Near Real-time" API

Dokumen ini menjelaskan strategi untuk mengurangi delay data (sinkronisasi data lambat) pada TPM Super App melalui optimasi TanStack Query (React Query) di sisi Frontend.

## 1. Analisis Masalah
Saat ini, aplikasi menggunakan konfigurasi default yang tidak optimal untuk data yang sering berubah:
- **`staleTime` (10 Menit)**: Data dianggap valid selama 10 menit tanpa perlu di-refresh.
- **Auto-refetch (Disabled)**: `refetchOnWindowFocus` dan `refetchOnReconnect` dinonaktifkan.
- **Backend**: Tidak ada native WebSockets/SSE untuk push-notif.

## 2. Strategi "Near Real-time" (Polling & Sync)

### A. Optimasi Global (`frontend/app/_layout.tsx`)
Mengurangi masa berlaku cache dan mengaktifkan auto-update saat aplikasi dibuka kembali (foregrounding).

```typescript
// Target Perubahan di QueryClient config
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 10, // 10 detik
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 2,
        },
    },
});
```

### B. Implementasi Polling di Komponen Kritis
Komponen yang membutuhkan update instan akan menggunakan polling terjadwal.

#### 1. Wallet / Financial Dashboard (`frontend/hooks/useKeuangan.ts`)
```typescript
export const useKasBankBalances = (options?: { refetchInterval?: number }) => {
    return useQuery({
        queryKey: ['kas_bank_balances'],
        queryFn: () => keuanganService.getKasBankBalances(),
        refetchInterval: 5000, // Update setiap 5 detik
        ...options
    });
};
```

#### 2. Status Armada / Jasa Angkut (`frontend/hooks/useJasaAngkut.ts`)
```typescript
// Terapkan polling di halaman dashboard jasa angkut
const { data, isLoading } = useMuatanList({ 
    status: 'ACTIVE' 
}, { 
    refetchInterval: 10000 // Update setiap 10 detik
});
```

## 3. Tahap Implementasi
1. [x] **Fase 1**: Ubah konfigurasi global `staleTime` dan `refetchOnWindowFocus` di `_layout.tsx`. (Done)
2. [x] **Fase 2**: Implementasi `refetchInterval` pada hook `useKasBankBalances` (Dashboard Utama). (Done)
3. [x] **Fase 3**: Implementasi `refetchInterval` pada dashboard Jasa Angkut dan Showroom. (Done)
4. [x] **Fase 4**: Pengujian konsumsi baterai dan beban server (API monitoring). (Enabled & Testing)

## 4. Keuntungan
- **Tanpa Delay**: Pengguna tidak perlu me-refresh halaman secara manual.
- **Consistency**: Data di satu HP akan muncul di HP lain dalam hitungan detik (Sync).
- **Low Risk**: Tidak memerlukan perubahan infrastruktur backend (No WebSocket needed yet).

---
*Dibuat oleh: Horizon - AI Prompt Optimizer*
*Tanggal: 28 Maret 2026*
