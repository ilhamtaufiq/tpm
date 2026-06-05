# Backup Perubahan FAB Bengkel

## Perilaku Sebelum Diubah

Tombol FAB `+` di halaman `frontend/app/bengkel/index.tsx` membuka form order bengkel di bottom sheet.

```tsx
<Pressable
    onPress={() => handlePresentModalPress('form')}
```

`handlePresentModalPress('form')` membuka bottom sheet dengan konten:

```tsx
<BengkelForm
    initialData={view === 'edit' ? selectedItem : null}
    onSuccess={handleClosePress}
/>
```

Artinya FAB `+` sebelumnya membuka `Input Order Baru` melalui `BengkelForm` di bottom sheet.

## Perubahan Baru

FAB `+` diarahkan ke halaman transaksi bengkel:

```tsx
router.push('/bengkel/transaksi')
```
