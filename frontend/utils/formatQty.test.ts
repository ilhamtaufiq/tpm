import { formatQty } from './format';

const cases: [unknown, string][] = [
    [1, '1'],
    [0.5, '0.5'],
    ['0.5', '0.5'],
    ['1.00', '1'],
    [2.25, '2.25'],
    ['1.234', '1.23'],
    [0, '0'],
    ['', '0'],
    [null, '0'],
    [undefined, '0'],
    ['abc', '0'],
];

for (const [input, expected] of cases) {
    const actual = formatQty(input);
    if (actual !== expected) {
        throw new Error(`formatQty(${JSON.stringify(input)}) => ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    }
}

// Regresi: formatNumber membuang desimal, formatQty tidak — keduanya harus tetap terpisah.
if (formatQty(0.5) === '0') {
    throw new Error('formatQty must not truncate 0.5 to 0');
}

console.log(`formatQty: ${cases.length} cases passed`);
