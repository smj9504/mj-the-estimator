import os
import uuid
import pandas as pd
from io import StringIO
from typing import Tuple, Optional

class FileService:
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    def save_uploaded_file(self, file_content: bytes, filename: str) -> str:
        """Save uploaded file and return the saved path"""
        # Generate unique filename to avoid conflicts
        file_ext = os.path.splitext(filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(self.upload_dir, unique_filename)
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
            
        return file_path
    
    def process_csv_content(self, csv_content: bytes) -> str:
        """Process CSV file content and return as text"""
        try:
            # Try to decode as UTF-8 first
            csv_text = csv_content.decode('utf-8')
            
            # Parse CSV to get structured data
            df = pd.read_csv(StringIO(csv_text))
            
            # Convert to readable text format
            result = []
            for index, row in df.iterrows():
                row_text = ", ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                result.append(f"Row {index + 1}: {row_text}")
            
            return "\n".join(result)
            
        except UnicodeDecodeError:
            # Try other encodings
            for encoding in ['latin-1', 'cp1252']:
                try:
                    csv_text = csv_content.decode(encoding)
                    df = pd.read_csv(StringIO(csv_text))
                    result = []
                    for index, row in df.iterrows():
                        row_text = ", ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                        result.append(f"Row {index + 1}: {row_text}")
                    return "\n".join(result)
                except:
                    continue
            
            return "Error: Could not decode CSV file"
            
        except Exception as e:
            return f"Error processing CSV: {str(e)}"
    
    def get_file_info(self, file_path: str) -> Tuple[bool, str]:
        """Check if file exists and get its size"""
        if os.path.exists(file_path):
            size = os.path.getsize(file_path)
            return True, f"{size} bytes"
        else:
            return False, "File not found"
    
    def cleanup_file(self, file_path: str) -> bool:
        """Delete a file and return success status"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False

# Global file service instance
file_service = FileService()