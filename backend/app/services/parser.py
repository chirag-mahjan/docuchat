import os
import fitz  # PyMuPDF
import docx
from typing import List, Dict, Any

class DocumentParser:
    @staticmethod
    def parse_file(file_path: str) -> List[Dict[str, Any]]:
        """
        Parses a file based on its extension.
        Returns a list of dicts: [{"page_number": int, "text": str}]
        """
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return DocumentParser._parse_pdf(file_path)
        elif ext in [".docx", ".doc"]:
            return DocumentParser._parse_docx(file_path)
        elif ext in [".txt", ".md"]:
            return DocumentParser._parse_txt(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def _parse_pdf(file_path: str) -> List[Dict[str, Any]]:
        pages = []
        doc = fitz.open(file_path)
        for i, page in enumerate(doc):
            text = page.get_text("text").strip()
            if text:
                pages.append({
                    "page_number": i + 1,
                    "text": text
                })
        doc.close()
        return pages

    @staticmethod
    def _parse_docx(file_path: str) -> List[Dict[str, Any]]:
        doc = docx.Document(file_path)
        pages = []
        current_page_text = []
        page_num = 1
        
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                current_page_text.append(text)
            # Estimate ~300 words per page if docx has no page breaks
            full_text = "\n".join(current_page_text)
            if len(full_text.split()) > 350:
                pages.append({"page_number": page_num, "text": full_text})
                page_num += 1
                current_page_text = []
                
        if current_page_text:
            pages.append({"page_number": page_num, "text": "\n".join(current_page_text)})

        return pages

    @staticmethod
    def _parse_txt(file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read().strip()
            
        # Split text into page-sized blocks (~2000 chars per page)
        chunk_size = 2000
        pages = []
        for i in range(0, len(text), chunk_size):
            pages.append({
                "page_number": (i // chunk_size) + 1,
                "text": text[i:i + chunk_size].strip()
            })
        return pages if pages else [{"page_number": 1, "text": text}]
