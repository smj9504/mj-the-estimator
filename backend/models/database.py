import sqlite3
import os
from contextlib import contextmanager

DATABASE_PATH = "db/estimate.db"

def init_database():
    """Initialize database with required tables"""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    
    with sqlite3.connect(DATABASE_PATH) as conn:
        cursor = conn.cursor()
        
        # Existing tables
        cursor.execute('''CREATE TABLE IF NOT EXISTS estimates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step TEXT,
            input TEXT,
            output TEXT,
            confirmed BOOLEAN
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step TEXT,
            template TEXT
        )''')
        
        # New pre-estimate tables
        cursor.execute('''CREATE TABLE IF NOT EXISTS pre_estimate_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'in_progress',
            project_name TEXT,
            jobsite_full_address TEXT,
            jobsite_street TEXT,
            jobsite_city TEXT,
            jobsite_state TEXT,
            jobsite_zipcode TEXT,
            occupancy TEXT,
            company_name TEXT,
            company_address TEXT,
            company_city TEXT,
            company_state TEXT,
            company_zip TEXT,
            company_phone TEXT,
            company_email TEXT
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS measurement_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            file_name TEXT,
            file_type TEXT,
            raw_data TEXT,
            parsed_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id)
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS demo_scope_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            input_text TEXT,
            parsed_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id)
        )''')
        
        cursor.execute('''CREATE TABLE IF NOT EXISTS work_scope_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            input_data TEXT,
            parsed_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES pre_estimate_sessions(session_id)
        )''')
        
        # Migrate existing tables - add new jobsite columns if they don't exist
        try:
            # Check if old jobsite column exists and new columns don't
            cursor.execute("PRAGMA table_info(pre_estimate_sessions)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'jobsite' in columns and 'jobsite_full_address' not in columns:
                # Add new jobsite columns
                cursor.execute("ALTER TABLE pre_estimate_sessions ADD COLUMN jobsite_full_address TEXT")
                cursor.execute("ALTER TABLE pre_estimate_sessions ADD COLUMN jobsite_street TEXT")
                cursor.execute("ALTER TABLE pre_estimate_sessions ADD COLUMN jobsite_city TEXT")
                cursor.execute("ALTER TABLE pre_estimate_sessions ADD COLUMN jobsite_state TEXT")
                cursor.execute("ALTER TABLE pre_estimate_sessions ADD COLUMN jobsite_zipcode TEXT")
                
                # Migrate existing data
                cursor.execute("UPDATE pre_estimate_sessions SET jobsite_full_address = jobsite WHERE jobsite IS NOT NULL")
                
        except sqlite3.OperationalError:
            # Columns might already exist, continue
            pass
        
        # Insert default prompts if not exists
        cursor.execute("INSERT OR IGNORE INTO prompts (step, template) VALUES (?, ?)",
                      ("work_scope", "작업 범위: {scope}\n주요 작업 항목을 나열하고 간단히 설명해:"))
        
        conn.commit()

@contextmanager
def get_db_connection():
    """Get database connection with context manager"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    try:
        yield conn
    finally:
        conn.close()

def execute_query(query: str, params: tuple = ()):
    """Execute a query and return results"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()

def execute_insert(query: str, params: tuple = ()):
    """Execute insert query and return last row id"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.lastrowid

def execute_update(query: str, params: tuple = ()):
    """Execute update/delete query and return affected rows"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.rowcount