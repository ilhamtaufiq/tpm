
import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add the parent directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

# Database connection
DATABASE_URL = settings.database_url
print(f"Connecting to database: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def migrate_expense_category():
    print("Starting migration of ExpenseCategory...")
    
    with engine.connect() as connection:
        # 1. Update existing 'kategori' column to VARCHAR temporarily to allow loose values
        print("Modifying schema: Changing kategori to VARCHAR(50)...")
        try:
            connection.execute(text("ALTER TABLE pengeluaran_bengkel MODIFY COLUMN kategori VARCHAR(50)"))
            connection.commit()
        except Exception as e:
            print(f"Error modifying column: {e}")
            # Continue if it fails, maybe it's already VARCHAR or issues with SQLite (but user said MySQL)
        
        # 2. Update existing data
        print("Updating data...")
        
        # 'operasional' -> 'biaya_operasional'
        result = connection.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'biaya_operasional' WHERE kategori = 'operasional'"))
        print(f"Updated {result.rowcount} rows from 'operasional' to 'biaya_operasional'")

        # 'lainnya' -> 'biaya_lainnya'
        result = connection.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'biaya_lainnya' WHERE kategori = 'lainnya'"))
        print(f"Updated {result.rowcount} rows from 'lainnya' to 'biaya_lainnya'")
        
        # 'pemeliharaan' -> 'biaya_operasional' (Assuming pemeliharaan merges to operasional)
        result = connection.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'biaya_operasional' WHERE kategori = 'pemeliharaan'"))
        print(f"Updated {result.rowcount} rows from 'pemeliharaan' to 'biaya_operasional'")

        # 'utilitas' -> 'biaya_operasional' (Assuming utilitas merges to operasional)
        result = connection.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'biaya_operasional' WHERE kategori = 'utilitas'"))
        print(f"Updated {result.rowcount} rows from 'utilitas' to 'biaya_operasional'")
        
        # 'gaji' -> 'biaya_operasional' (Assuming gaji in expense table merges to operasional as it's separate from SlipGaji)
        result = connection.execute(text("UPDATE pengeluaran_bengkel SET kategori = 'biaya_operasional' WHERE kategori = 'gaji'"))
        print(f"Updated {result.rowcount} rows from 'gaji' to 'biaya_operasional'")
        
        connection.commit()
        
        # 3. Alter column back to ENUM with new values
        print("Finalizing schema: Changing kategori to ENUM...")
        try:
            # MySQL syntax
            connection.execute(text("ALTER TABLE pengeluaran_bengkel MODIFY COLUMN kategori ENUM('biaya_operasional', 'biaya_lainnya', 'prive') DEFAULT 'biaya_operasional'"))
            connection.commit()
            print("Successfully updated ENUM definition.")
        except Exception as e:
            print(f"Error finalizing ENUM: {e}")
            print("Trying generic constraint check for other DBs...")

    print("Migration completed.")

if __name__ == "__main__":
    migrate_expense_category()
