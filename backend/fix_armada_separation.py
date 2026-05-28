from sqlalchemy import text
from app.database import engine

def migrate():
    print("Starting migration: Separating Armada in Jasa Angkut...")

    with engine.connect() as connection:
        # 1. Create armada_jasa_angkut table
        print("Creating table 'armada_jasa_angkut'...")
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS armada_jasa_angkut (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nama VARCHAR(100) NOT NULL,
                nopol VARCHAR(20) NOT NULL UNIQUE,
                jenis VARCHAR(50) NULL,
                is_active BOOLEAN DEFAULT TRUE,
                catatan TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at DATETIME NULL,
                INDEX (nama),
                INDEX (nopol)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """))
        print("  ✓ Table 'armada_jasa_angkut' created or already exists")

        # 2. Add armada_id to muatan_jasa_angkut
        print("Adding 'armada_id' to 'muatan_jasa_angkut'...")
        try:
            connection.execute(text("ALTER TABLE muatan_jasa_angkut ADD COLUMN armada_id INT NULL"))
            connection.execute(text("ALTER TABLE muatan_jasa_angkut ADD CONSTRAINT fk_muatan_armada FOREIGN KEY (armada_id) REFERENCES armada_jasa_angkut(id)"))
            print("  ✓ armada_id added to muatan_jasa_angkut")
        except Exception as e:
            print(f"  - muatan_jasa_angkut.armada_id: {e if 'Duplicate column' not in str(e) else 'Already exists'}")

        # 3. Add armada_default_id to supir
        print("Adding 'armada_default_id' to 'supir'...")
        try:
            connection.execute(text("ALTER TABLE supir ADD COLUMN armada_default_id INT NULL"))
            connection.execute(text("ALTER TABLE supir ADD CONSTRAINT fk_supir_armada FOREIGN KEY (armada_default_id) REFERENCES armada_jasa_angkut(id)"))
            print("  ✓ armada_default_id added to supir")
        except Exception as e:
            print(f"  - supir.armada_default_id: {e if 'Duplicate column' not in str(e) else 'Already exists'}")

        connection.commit()

    print("Migration completed!")

if __name__ == "__main__":
    migrate()
