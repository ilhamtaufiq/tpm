// Impor ikon lucide per file (lihat codemod): paket lucide membatasi deep import lewat "exports",
// jadi tipe setiap file ikon didefinisikan di sini sebagai LucideIcon.
declare module 'lucide-react-native/dist/esm/icons/*.js' {
    import type { ForwardRefExoticComponent } from 'react';
    import type { LucideProps } from 'lucide-react-native';
    const Icon: ForwardRefExoticComponent<LucideProps>;
    export default Icon;
}
