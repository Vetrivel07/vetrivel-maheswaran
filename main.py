import os
import json
import re
import numpy as np
import faiss
import requests
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

# ---------------- CORS (local dev) ----------------
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return resp

# ---------------- RAG store ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

RAG_DIR = os.path.join(BASE_DIR, "rag", "rag_store")
INDEX_PATH = os.path.join(RAG_DIR, "index.faiss")
META_PATH  = os.path.join(RAG_DIR, "meta.json")


_index = None
_meta = None

def load_rag():
    global _index, _meta
    if _index is None:
        if not os.path.exists(INDEX_PATH):
            raise FileNotFoundError(f"Missing index: {INDEX_PATH}. Run: python rag_build.py")
        _index = faiss.read_index(INDEX_PATH)
    if _meta is None:
        if not os.path.exists(META_PATH):
            raise FileNotFoundError(f"Missing meta: {META_PATH}. Run: python rag_build.py")
        with open(META_PATH, "r", encoding="utf-8") as f:
            _meta = json.load(f)

def embed_query(q: str, openai_key: str) -> np.ndarray:
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        },
        json={"model": "text-embedding-3-small", "input": [q]},
        timeout=60
    )
    r.raise_for_status()
    v = np.array(r.json()["data"][0]["embedding"], dtype="float32").reshape(1, -1)
    faiss.normalize_L2(v)
    return v

def retrieve(q: str, openai_key: str, k=5):
    load_rag()
    v = embed_query(q, openai_key)
    scores, idxs = _index.search(v, k)
    results = []
    for score, idx in zip(scores[0], idxs[0]):
        if idx == -1:
            continue
        results.append((float(score), _meta[int(idx)]))
    return results

# ---------------- Chat endpoint ----------------
@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return ("", 204)

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return jsonify({"error": "OPENAI_API_KEY not set"}), 500

    body = request.get_json(silent=True) or {}
    messages = body.get("messages", [])
    if not isinstance(messages, list):
        return jsonify({"error": "messages must be an array"}), 400

    # latest user question
    user_q = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            user_q = m.get("content", "")
            break
    

    GREET_RE = re.compile(r"^\s*(hi|hello|hey|hai|hii|hiii|good\s*(morning|afternoon|evening)|yo|sup)\b", re.I)

    def is_greeting(q: str) -> bool:
        if not q:
            return False
        q = q.strip()
        # short messages like "hi", "hello", "hey mahi"
        if len(q) <= 20 and GREET_RE.search(q):
            return True
        return False

    if is_greeting(user_q):
        return jsonify({
            "reply": (
                "Hi! What would you like to know?"
            )
        })
    # Retrieve context
    try:
        hits = retrieve(user_q, openai_key, k=5)
    except Exception as e:
        return jsonify({"error": f"RAG retrieval failed: {str(e)}"}), 500

    context_blocks = []
    pages = []  # pages from retrieved chunks (truth)

    for score, doc in hits:
        page = doc.get("page", "unknown")
        pages.append(page)
        context_blocks.append(f"[Source: {page}]\n{doc['text']}")

    context = "\n\n---\n\n".join(context_blocks)

    # unique pages, keep order
    unique_pages = [p for p in dict.fromkeys(pages) if p != "unknown"]

    # keep sources tight (optional but recommended)
    top_pages = unique_pages[:2] if unique_pages else ["contact.html"]



    # Abstain if weak retrieval (prevents hallucination)
    min_score = 0.35  # tune 0.25–0.45
    top_score = hits[0][0] if hits else 0.0
    if (not hits) or (top_score < min_score):
        return jsonify({
            "reply": "I don’t have enough information in the portfolio to answer that. Please check Projects/Work pages or use Contact."
        })

    context_blocks = []
    citations = []
    for score, doc in hits:
        citations.append(f"{doc.get('page', 'unknown')}")
        context_blocks.append(f"[Source: {doc.get('page','unknown')}]\n{doc['text']}")


    context = "\n\n---\n\n".join(context_blocks)

    system = f"""
ROLE
You are MAHI AI — the portfolio assistant for Vetrivel Maheswaran.

CONTEXT
You are an AI Assistant for Vetrivel Portfolio. you gonna work like a chatbot. 
then, You will be given:
1) The user’s question
2) Retrieved PORTFOLIO CONTEXT snippets (the only ground truth)

Your job is to answer ONLY using the provided PORTFOLIO CONTEXT and additionally, you can greet the people, respond to basic chats like hi, what can you do?, something like that...

INSTRUCTIONS
1) Grounding (must-follow)
- Use ONLY the PORTFOLIO CONTEXT to answer.
- If the answer is not explicitly supported by the PORTFOLIO CONTEXT, say you don’t know and direct the user to the relevant page(s).

2) Source linking (must-follow)
- Use ONLY these page labels in Sources (do NOT use “portfolio_kb#…”):
  - index.html
  - about.html
  - projects.html
  - work.html
  - contact.html
  Make sure, you should not give multiple pages as sources. it will be only one source. so understand well before you do.
- Map the answer to the right page(s):
  - Intro / headline / overview → index.html
  - About / education / skills summary / Who is Vetrivel→ about.html
  - Projects (academic/personal, dates, stack) → projects.html
  - Work/experience/roles/dates → work.html
  - Contact/social links/email → contact.html

3) Time-based questions (must-follow)
- If the user asks “recent”, “latest”, “last”, or a specific year/range:
  - Prefer entries with the latest dates that appear in PORTFOLIO CONTEXT.
  - If dates are missing or ambiguous, say it’s unclear and point to the correct page in Sources.
- Never guess dates or reorder timelines without evidence.

4) Project questions (must-follow)
- If asked about “latest project”, “recent project”, or “projects in 2025/2024/etc.”:
  - Select only projects whose dates match the user’s timeframe in PORTFOLIO CONTEXT.
  - If the user asks “academic vs personal”, label them correctly ONLY if the context explicitly indicates it.

5) Contact questions (must-follow)
- Use social/contact info ONLY if it exists in PORTFOLIO CONTEXT.
- If not present, direct to contact.html.

6) Guardrails (must-follow)
- If the question is unrelated to the portfolio (general AI questions, random topics, etc.), refuse politely and say you can only answer portfolio-related questions. Point to contact.html if they want to reach out.
- No storytelling, no invented facts, no assumptions, no outside knowledge.

OUTPUT FORMAT
- Keep answers concise (2–8 bullets or a short paragraph).
- Do NOT write a “Sources:” line. The server will append Sources automatically.

CONTEXT:
{context}
""".strip()

    payload = {
        "model": "gpt-4o-mini",
        "temperature": 0.2,
        "messages": [{"role": "system", "content": system}, *messages][-20:]
    }

    try:
        r = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {openai_key}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=60
        )
        data = r.json()
    except requests.RequestException:
        return jsonify({"error": "Network error calling OpenAI"}), 502
    except ValueError:
        return jsonify({"error": f"OpenAI returned non-JSON (HTTP {r.status_code})"}), 502

    if r.status_code != 200:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else None
        return jsonify({"error": msg or str(data)}), r.status_code

    reply = data["choices"][0]["message"]["content"].strip()
    # reply += "\n\nSources: " + ", ".join(top_pages)
    return jsonify({"reply": reply})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
