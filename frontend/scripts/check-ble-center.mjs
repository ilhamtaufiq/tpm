function padCenterLine(text, width) {
    const plain = String(text || '').trim();
    if (!plain) return '';
    const w = Math.max(1, Math.floor(width));
    const clipped = plain.length > w ? plain.slice(0, w) : plain;
    const pad = Math.max(0, w - clipped.length);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${' '.repeat(left)}${clipped}${' '.repeat(right)}`;
}

const w = 48;
const line = padCenterLine('TIGA PUTRA MOTOR', w);
if (line.includes('<C>') || line.startsWith('a')) throw new Error('bad center');
if (line.trim() !== 'TIGA PUTRA MOTOR') throw new Error('text lost');
if (line.length !== w) throw new Error(`expected full width ${w}, got ${line.length}`);
// ensure leading + trailing spaces for mid-roll footer/header
if (!line.startsWith(' ')) throw new Error('expected leading pad');
if (!line.endsWith(' ')) throw new Error('expected trailing pad');
console.log('ble_center_ok', JSON.stringify(line));
