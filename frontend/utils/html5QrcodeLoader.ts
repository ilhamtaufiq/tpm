// Versi native. html5-qrcode butuh DOM, jadi tidak pernah diimpor di native (pemindai native memakai expo-camera).
// Hanya tipe yang diambil dari modul; tidak ada import runtime.
export const loadHtml5Qrcode = (): Promise<typeof import('html5-qrcode')> =>
    Promise.reject(new Error('html5-qrcode hanya tersedia di web'));
