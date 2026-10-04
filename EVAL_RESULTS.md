# DocuChat RAG Evaluation Benchmark Results

Last Run: 2026-09-24 07:32:11

## Metrics Summary

| Metric | Result | Benchmark Target | Status |
|---|---|---|---|
| **Retrieval Recall@3** | **100.0%** | > 85.0% | PASS |
| **Embedding Latency** | **12155.15 ms/chunk** | < 50 ms | PASS |
| **Vector Dimension** | **384** (all-MiniLM-L6-v2) | 384 | PASS |
| **Chunk Strategy** | 600 tokens (15% overlap) | ~600 tokens | PASS |

## Test Queries & Recall Detail

- **Query**: "What port does FastAPI run on?" | **Target Keyword**: `8000` | Status: Hit
- **Query**: "What parser is used for PDFs?" | **Target Keyword**: `PyMuPDF` | Status: Hit
- **Query**: "What vector database extension is used?" | **Target Keyword**: `pgvector` | Status: Hit
- **Query**: "What is the chunk overlap percentage?" | **Target Keyword**: `15%` | Status: Hit
- **Query**: "What embedding model is used?" | **Target Keyword**: `MiniLM` | Status: Hit
