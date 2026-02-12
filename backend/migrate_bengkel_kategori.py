"""
Migration: Add kategori, muatan_id, mobil_id to transaksi_penjualan_bengkel table

This migration adds category support to bengkel transactions, allowing them to be linked to
either Jasa Angkut (transport) or Jual Beli Mobil (car trading) transactions.
"""
from sqlalchemy import text
from app.database.session import engine


def migrate():
    print("Starting migration: Add kategori fields to transaksi_penjualan_bengkel...")

    with engine.connect() as connection:
        try:
            # Add kategori column
            print("Adding 'kategori' column...")
            connection.execute(text(
                "ALTER TABLE transaksi_penjualan_bengkel "
                "ADD COLUMN kategori VARCHAR(30) DEFAULT 'umum' NOT NULL"
            ))
            print("  ✓ kategori column added")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("  - kategori column already exists, skipping")
            else:
                print(f"  ✗ Error: {e}")

        try:
            # Add muatan_id column
            print("Adding 'muatan_id' column...")
            connection.execute(text(
                "ALTER TABLE transaksi_penjualan_bengkel "
                "ADD COLUMN muatan_id INT NULL"
            ))
            print("  ✓ muatan_id column added")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("  - muatan_id column already exists, skipping")
            else:
                print(f"  ✗ Error: {e}")

        try:
            # Add mobil_id column
            print("Adding 'mobil_id' column...")
            connection.execute(text(
                "ALTER TABLE transaksi_penjualan_bengkel "
                "ADD COLUMN mobil_id INT NULL"
            ))
            print("  ✓ mobil_id column added")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("  - mobil_id column already exists, skipping")
            else:
                print(f"  ✗ Error: {e}")

        try:
            # Add foreign key for muatan_id
            print("Adding FK constraint for muatan_id...")
            connection.execute(text(
                "ALTER TABLE transaksi_penjualan_bengkel "
                "ADD CONSTRAINT fk_bengkel_muatan "
                "FOREIGN KEY (muatan_id) REFERENCES muatan(id) ON DELETE SET NULL"
            ))
            print("  ✓ FK muatan_id added")
        except Exception as e:
            if "Duplicate" in str(e) or "already exists" in str(e):
                print("  - FK muatan_id already exists, skipping")
            else:
                print(f"  ✗ Error: {e}")

        try:
            # Add foreign key for mobil_id
            print("Adding FK constraint for mobil_id...")
            connection.execute(text(
                "ALTER TABLE transaksi_penjualan_bengkel "
                "ADD CONSTRAINT fk_bengkel_mobil "
                "FOREIGN KEY (mobil_id) REFERENCES mobil(id) ON DELETE SET NULL"
            ))
            print("  ✓ FK mobil_id added")
        except Exception as e:
            if "Duplicate" in str(e) or "already exists" in str(e):
                print("  - FK mobil_id already exists, skipping")
            else:
                print(f"  ✗ Error: {e}")

        connection.commit()

    print("Migration completed successfully!")


if __name__ == "__main__":
    migrate()
