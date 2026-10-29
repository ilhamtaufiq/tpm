"""Angka ke kalimat Bahasa Indonesia, untuk nominal di faktur/kwitansi."""

_SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"]


def _ratusan(n: int) -> str:
    """Terbilang untuk 0 <= n < 1000."""
    if n < 12:
        return _SATUAN[n]
    if n < 20:
        return f"{_ratusan(n - 10)} belas"
    if n < 100:
        sisa = f" {_ratusan(n % 10)}" if n % 10 else ""
        return f"{_ratusan(n // 10)} puluh{sisa}"
    if n < 200:
        sisa = f" {_ratusan(n - 100)}" if n - 100 else ""
        return f"seratus{sisa}"
    sisa = f" {_ratusan(n % 100)}" if n % 100 else ""
    return f"{_ratusan(n // 100)} ratus{sisa}"


def terbilang(angka: int) -> str:
    """Contoh: 1250000 -> 'satu juta dua ratus lima puluh ribu'. Hanya bilangan bulat >= 0."""
    if angka < 0:
        raise ValueError("terbilang hanya untuk bilangan >= 0")
    if angka == 0:
        return "nol"
    bagian = []
    sisa = angka
    for nilai, nama in [(10**12, "triliun"), (10**9, "miliar"), (10**6, "juta"), (1000, "ribu")]:
        if sisa >= nilai:
            q, sisa = divmod(sisa, nilai)
            bagian.append("seribu" if (q == 1 and nama == "ribu") else f"{_ratusan(q)} {nama}")
    if sisa:
        bagian.append(_ratusan(sisa))
    return " ".join(bagian)
