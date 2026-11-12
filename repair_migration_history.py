import sqlite3
from pathlib import Path

db = Path("db.sqlite3")

if not db.exists():
    raise SystemExit("ERREUR : db.sqlite3 introuvable")

conn = sqlite3.connect(db)

try:
    conn.execute("BEGIN")

    conn.execute("DROP TABLE IF EXISTS accounts_userprofile")

    conn.execute(
        "DELETE FROM django_migrations WHERE app = ? AND name = ?",
        ("accounts", "0001_initial")
    )

    conn.commit()

    print("CORRECTION EFFECTUEE")
    print("Table UserProfile à recréer par Django.")
    print("Historique accounts.0001_initial corrigé.")

except Exception:
    conn.rollback()
    raise

finally:
    conn.close()
