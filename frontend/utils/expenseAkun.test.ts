import { AKUN, akunUntukUnit, metodeDariAkun } from './expenseAkun';

// Kasus asal KAS2609150042: akun kas + TRANSFER menghasilkan pengeluaran yang
// memotong KAS_UTAMA padahal uangnya keluar dari bank.
const cases: [string | null | undefined, string][] = [
    ['KAS_UTAMA', 'TUNAI'],
    ['BANK_UTAMA', 'TRANSFER'],
    ['KAS_UNIT_BENGKEL', 'TUNAI'],
    ['KAS_UNIT_JASA_ANGKUT', 'TUNAI'],
    ['KAS_UNIT_MOBIL', 'TUNAI'],
    [null, 'TUNAI'],
    [undefined, 'TUNAI'],
];

for (const [input, expected] of cases) {
    const actual = metodeDariAkun(input);
    if (actual !== expected) {
        throw new Error(`metodeDariAkun(${JSON.stringify(input)}) => ${actual}, expected ${expected}`);
    }
}

// Setiap akun di picker harus menghasilkan metode yang sah.
for (const opt of AKUN) {
    const metode = metodeDariAkun(opt.value);
    const harusTransfer = opt.value === 'BANK_UTAMA';
    if (metode !== (harusTransfer ? 'TRANSFER' : 'TUNAI')) {
        throw new Error(`akun ${opt.value} => ${metode}, expected ${harusTransfer ? 'TRANSFER' : 'TUNAI'}`);
    }
}

// Tidak boleh ada dua akun bernama sama di picker.
const unik = new Set(AKUN.map((o) => o.value));
if (unik.size !== AKUN.length) {
    throw new Error('ada nilai akun duplikat di AKUN');
}

const unitCases: [string, string | undefined][] = [
    ['jasa_angkut', 'KAS_UNIT_JASA_ANGKUT'],
    ['bengkel', 'KAS_UNIT_BENGKEL'],
    ['jual_beli_mobil', 'KAS_UNIT_MOBIL'],
    ['umum', undefined],
];
for (const [kat, expected] of unitCases) {
    const actual = akunUntukUnit(kat);
    if (actual !== expected) {
        throw new Error(`akunUntukUnit(${kat}) => ${actual}, expected ${expected}`);
    }
}

// Regresi inti: akun kas tidak boleh pernah menghasilkan TRANSFER.
for (const akun of ['KAS_UTAMA', 'KAS_UNIT_BENGKEL', 'KAS_UNIT_JASA_ANGKUT', 'KAS_UNIT_MOBIL']) {
    if (metodeDariAkun(akun) === 'TRANSFER') {
        throw new Error(`${akun} menghasilkan TRANSFER — bug KAS2609150042 kembali`);
    }
}

console.log(`expenseAkun: ${cases.length + unitCases.length} cases passed`);
