import os
import json
import re
import time
import numpy as np
import faiss
import requests
from dotenv import load_dotenv

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# -------- Config --------
SOURCES = [
    ("rag/rag_data/portfolio_kb.txt", "portfolio_kb"),
]

OUT_DIR = "rag/rag_store"
INDEX_PATH = os.path.join(OUT_DIR, "index.faiss")
META_PATH  = os.path.join(OUT_DIR, "meta.json")

DEBUG_EXTRACT_DIR = os.path.join(OUT_DIR, "extracted_text")
DEBUG_CHUNKS_DIR  = os.path.join(OUT_DIR, "chunks")

EMBED_MODEL = "text-embedding-3-small"
BATCH_SIZE = 64

CHUNK_SIZE = 1000
OVERLAP = 150

# Matches ANY line that contains one of these html filenames,
# regardless of the rest of the line content.
# Works with your format: [Source Page: about.html] :contentReference[oaicite:3]{index=3}
PAGE_MARK_RE = re.compile(
    r"(?im)^.*\b(index\.html|about\.html|project\.html|projects\.html|work\.html|contact\.html)\b.*$"
)

def safe_name(s: str) -> str:
    return s.replace("/", "_").replace("\\", "_").replace(" ", "_").strip()

def ensure_dirs():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(DEBUG_EXTRACT_DIR, exist_ok=True)
    os.makedirs(DEBUG_CHUNKS_DIR, exist_ok=True)

def write_text(path: str, text: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

def write_chunks(path: str, chunks: list[str]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for i, ch in enumerate(chunks):
            f.write(f"\n===== CHUNK {i} =====\n")
            f.write(ch)
            f.write("\n")

def file_to_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text: str, chunk_size=CHUNK_SIZE, overlap=OVERLAP) -> list[str]:
    chunks = []
    i = 0
    n = len(text)
    step = max(1, chunk_size - overlap)
    while i < n:
        ch = text[i:i + chunk_size].strip()
        if ch:
            chunks.append(ch)
        i += step
    return chunks

def split_by_page_markers(text: str):
    """
    Splits a single KB into [(page, section_text)] using lines that contain *.html.
    The page is the FIRST matched filename on the marker line.
    """
    lines = text.split("\n")
    sections = []
    current_page = None
    buf = []

    def flush():
        nonlocal buf, current_page
        if current_page and buf:
            section = "\n".join(buf).strip()
            if section:
                sections.append((current_page, section))
        buf = []

    for line in lines:
        m = PAGE_MARK_RE.match(line.strip())
        if m:
            flush()
            current_page = m.group(1)
            continue
        buf.append(line)

    flush()

    # If no markers found, fallback to unknown
    if not sections:
        return [("unknown", text.strip())]

    return sections

def embed_batch(texts: list[str]) -> np.ndarray:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set in .env")

    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": EMBED_MODEL, "input": texts},
        timeout=60,
    )

    if r.status_code != 200:
        try:
            j = r.json()
            msg = j.get("error", {}).get("message") or str(j)
        except Exception:
            msg = r.text
        raise RuntimeError(f"Embeddings request failed (HTTP {r.status_code}): {msg}")

    data = r.json()["data"]
    vecs = [d["embedding"] for d in data]
    return np.array(vecs, dtype="float32")

def main():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set in .env")

    ensure_dirs()

    meta = []
    texts = []

    for path, source_name in SOURCES:
        if not os.path.exists(path):
            print(f"Skipping missing source: {path}")
            continue

        full_text = file_to_text(path)

        # Debug: save whole KB text
        write_text(os.path.join(DEBUG_EXTRACT_DIR, safe_name(source_name) + ".txt"), full_text)

        # Split by [Source Page: *.html] markers
        sections = split_by_page_markers(full_text)

        for detected_page, section_text in sections:
            chunks = chunk_text(section_text)

            # Debug: save chunks per page
            write_chunks(
                os.path.join(DEBUG_CHUNKS_DIR, f"{safe_name(source_name)}_{safe_name(detected_page)}_chunks.txt"),
                chunks
            )

            for ci, ch in enumerate(chunks):
                meta.append({
                    "source": source_name,
                    "page": detected_page,
                    "path": path,
                    "chunk_id": ci,
                    "text": ch,
                })
                texts.append(ch)

    if not texts:
        raise RuntimeError("No text found to index. Check rag/rag_data/portfolio_kb.txt")

    # Embed in batches
    t0 = time.time()
    vectors = []
    for i in range(0, len(texts), BATCH_SIZE):
        vectors.append(embed_batch(texts[i:i + BATCH_SIZE]))
    X = np.vstack(vectors)

    # Cosine similarity via normalize + inner product
    faiss.normalize_L2(X)
    dim = X.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(X)

    faiss.write_index(index, INDEX_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    elapsed = time.time() - t0
    print(f"RAG built: {len(meta)} chunks")
    print(f"Index: {INDEX_PATH}")
    print(f"Meta:  {META_PATH}")
    print(f"Time:  {elapsed:.2f}s")

    if (not os.path.exists(INDEX_PATH)) or os.path.getsize(INDEX_PATH) < 1000:
        raise RuntimeError(f"{INDEX_PATH} looks empty/corrupt. Rebuild.")

if __name__ == "__main__":
    main()
