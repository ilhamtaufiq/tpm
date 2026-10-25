// Hanya untuk web. Metro memilih file .web.ts di web, jadi html5-qrcode tidak masuk bundle native.
// @ts-expect-error -- dynamic import fine for web build
export const loadHtml5Qrcode = (): Promise<typeof import('html5-qrcode')> => import('html5-qrcode');
