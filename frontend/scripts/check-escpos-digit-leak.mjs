/**
 * Guard: ESC 2 / ESC 3 must not leave printable ASCII digits in sanitized body.
 * Run: node scripts/check-escpos-digit-leak.mjs
 */

function sanitizeEscPosBuffer(buffer) {
    const out = [];
    for (let i = 0; i < buffer.length; i += 1) {
        if (buffer[i] === 0x1b && i + 1 < buffer.length) {
            const cmd = buffer[i + 1];
            if (cmd === 0x32) {
                i += 1;
                continue;
            }
            if (cmd === 0x33 && i + 2 < buffer.length) {
                i += 2;
                continue;
            }
        }
        out.push(buffer[i]);
    }
    return Buffer.from(out);
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

// Simulated EPToolkit-ish body: init, ESC 2, center, company name
const company = Buffer.from('TIGA PUTRA MOTOR', 'latin1');
const raw = Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from([0x1b, 0x32]), // ESC 2 — was replaced with ESC 3 and leaked "3"
    Buffer.from([0x1b, 0x61, 0x01]),
    company,
    Buffer.from([0x0a]),
]);

const cleaned = sanitizeEscPosBuffer(raw);
const asText = cleaned.toString('latin1');

assert(!asText.includes('3TIGA'), 'must not prefix company with digit 3');
assert(!asText.includes('2TIGA'), 'must not prefix company with digit 2');
assert(asText.includes('TIGA PUTRA MOTOR'), 'company name preserved');
assert(!cleaned.includes(0x32) || cleaned[cleaned.indexOf(0x32) - 1] !== 0x1b, 'ESC 2 stripped');

// ESC 3 n must be fully stripped (not leave ASCII 3)
const withEsc3 = Buffer.concat([
    Buffer.from([0x1b, 0x40, 0x1b, 0x33, 28]),
    company,
]);
const cleaned3 = sanitizeEscPosBuffer(withEsc3).toString('latin1');
assert(cleaned3.startsWith('\x1b@TIGA') || cleaned3.includes('TIGA PUTRA MOTOR'), 'name ok after ESC 3 strip');
assert(!cleaned3.startsWith('3') && !cleaned3.includes('3TIGA'), 'no leading 3 from ESC 3');

console.log('check-escpos-digit-leak.mjs: all checks passed');
