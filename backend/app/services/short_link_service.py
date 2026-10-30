"""Kode pendek untuk link struk publik. Tidak mengubah data transaksi, hanya menyimpan pemetaan kode."""
import re
import secrets
import string
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.short_link import ShortLink

# Huruf kecil dan angka saja: kode di database tidak peka huruf besar/kecil.
ALPHABET = string.ascii_lowercase + string.digits
PANJANG_KODE = 7
TIPE_VALID = {"bengkel", "mobil", "jasa_angkut", "piutang", "hutang"}
TARGET_VALID = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")


class ShortLinkService:
    def __init__(self, db: Session):
        self.db = db

    def _cari(self, tipe: str, target: str) -> Optional[ShortLink]:
        return self.db.query(ShortLink).filter(ShortLink.tipe == tipe, ShortLink.target == target).first()

    def buat_atau_ambil(self, tipe: str, target: str) -> ShortLink:
        if tipe not in TIPE_VALID:
            raise ValueError("Tipe struk tidak dikenal")
        if not TARGET_VALID.match(target):
            raise ValueError("Target struk tidak valid")

        existing = self._cari(tipe, target)
        if existing:
            return existing

        for _ in range(5):
            kode = "".join(secrets.choice(ALPHABET) for _ in range(PANJANG_KODE))
            link = ShortLink(kode=kode, tipe=tipe, target=target)
            self.db.add(link)
            try:
                self.db.commit()
                return link
            except IntegrityError:
                # Kode bentrok, atau link untuk target ini dibuat bersamaan oleh permintaan lain.
                self.db.rollback()
                existing = self._cari(tipe, target)
                if existing:
                    return existing
        raise RuntimeError("Gagal membuat kode pendek")

    def ambil(self, kode: str) -> Optional[ShortLink]:
        return self.db.query(ShortLink).filter(ShortLink.kode == kode.lower()).first()
