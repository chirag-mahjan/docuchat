from typing import List, Dict, Any

class DocumentChunker:
    def __init__(self, chunk_size: int = 2400, chunk_overlap: int = 360):
        """
        chunk_size: approximate character count (~600 tokens)
        chunk_overlap: 15% overlap (~360 chars / ~90 tokens)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_pages(self, pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes page list: [{"page_number": int, "text": str}]
        Returns chunk list: [{"content": str, "page_number": int, "chunk_index": int}]
        """
        all_chunks = []
        global_chunk_idx = 0

        for page in pages:
            page_num = page["page_number"]
            text = page["text"]

            if not text or not text.strip():
                continue

            page_chunks = self._split_text(text)
            for idx, chunk_text in enumerate(page_chunks):
                if chunk_text.strip():
                    all_chunks.append({
                        "content": chunk_text.strip(),
                        "page_number": page_num,
                        "chunk_index": global_chunk_idx
                    })
                    global_chunk_idx += 1

        return all_chunks

    def _split_text(self, text: str) -> List[str]:
        if len(text) <= self.chunk_size:
            return [text]

        chunks = []
        start = 0
        text_length = len(text)

        while start < text_length:
            end = start + self.chunk_size
            if end >= text_length:
                chunks.append(text[start:])
                break

            # Try to break at paragraph boundary, sentence, or space
            break_pos = text.rfind("\n\n", start, end)
            if break_pos == -1 or break_pos <= start:
                break_pos = text.rfind("\n", start, end)
            if break_pos == -1 or break_pos <= start:
                break_pos = text.rfind(". ", start, end)
            if break_pos == -1 or break_pos <= start:
                break_pos = text.rfind(" ", start, end)

            if break_pos == -1 or break_pos <= start:
                break_pos = end

            chunks.append(text[start:break_pos])
            start = max(start + 1, break_pos - self.chunk_overlap)

        return chunks
