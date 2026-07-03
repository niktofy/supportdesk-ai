#!/usr/bin/env python3
"""SupportDesk AI — embeddable support chatbot with a knowledge-base brain.

Zero dependencies. Two answer engines:
  1. Retrieval mode (default): TF-IDF search over markdown files in ./kb —
     answers are always grounded in YOUR docs, no hallucinations, no API cost.
  2. AI mode (optional): set ANTHROPIC_API_KEY and answers are composed by
     Claude, constrained to the retrieved context.

Run:  python server.py          → http://localhost:8787 (demo page + API)
API:  POST /chat  {"message": "..."}  →  {"reply": "...", "source": "..."}
"""

import json
import math
import os
import re
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent
KB_DIR = ROOT / "kb"
PORT = 8787
API_KEY = os.environ.get("ANTHROPIC_API_KEY")

STOP = set("the a an is are was were be been of to in on for with and or if it this that at as by from you your our we i how what when can do does".split())


def tokenize(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in STOP]


class KnowledgeBase:
    """Chunked TF-IDF index over markdown files. Each '## heading' is a chunk."""

    def __init__(self, kb_dir: Path):
        self.chunks: list[dict] = []
        for f in sorted(kb_dir.glob("*.md")):
            raw = f.read_text(encoding="utf-8")
            for section in re.split(r"(?=^## )", raw, flags=re.M):
                section = section.strip()
                if not section:
                    continue
                title = section.splitlines()[0].lstrip("# ").strip()
                self.chunks.append({"file": f.stem, "title": title, "text": section})
        self._build_index()

    def _build_index(self):
        self.df: dict[str, int] = {}
        for c in self.chunks:
            c["tf"] = {}
            for w in tokenize(c["text"]):
                c["tf"][w] = c["tf"].get(w, 0) + 1
            for w in c["tf"]:
                self.df[w] = self.df.get(w, 0) + 1
        self.n = max(len(self.chunks), 1)

    def search(self, query: str, k: int = 2) -> list[dict]:
        q = tokenize(query)
        scored = []
        for c in self.chunks:
            score = sum(
                c["tf"].get(w, 0) * math.log(self.n / self.df.get(w, self.n))
                for w in q
            )
            if score > 0:
                scored.append((score, c))
        scored.sort(key=lambda x: -x[0])
        return [c for _, c in scored[:k]]


KB = KnowledgeBase(KB_DIR)

GREETING = (
    "Hi! I'm the SupportDesk assistant. Ask me about shipping, returns, "
    "payments or product care — I answer from the store's own docs."
)
FALLBACK = (
    "I couldn't find that in the knowledge base. Try rephrasing, or ask about "
    "shipping, returns, payments or product care. A human teammate can also "
    "help at support@example.com."
)


def strip_md(text: str) -> str:
    text = re.sub(r"^#{1,6} .*$", "", text, flags=re.M)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"^[-*] ", "• ", text, flags=re.M)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def answer_retrieval(message: str) -> dict:
    if re.fullmatch(r"\s*(hi|hello|hey|salut)[!. ]*\s*", message.lower()):
        return {"reply": GREETING, "source": "greeting"}
    hits = KB.search(message)
    if not hits:
        return {"reply": FALLBACK, "source": "fallback"}
    top = hits[0]
    return {
        "reply": strip_md(top["text"]),
        "source": f"kb/{top['file']}.md — {top['title']}",
    }


def answer_ai(message: str) -> dict:
    """Compose an answer with Claude, grounded in retrieved KB context."""
    hits = KB.search(message, k=3)
    if not hits:
        return {"reply": FALLBACK, "source": "fallback"}
    context = "\n\n---\n\n".join(h["text"] for h in hits)
    body = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 400,
        "system": (
            "You are a support agent. Answer ONLY from the provided context. "
            "If the context doesn't cover the question, say you don't know "
            "and suggest contacting support@example.com. Be brief and warm."
        ),
        "messages": [{"role": "user",
                      "content": f"Context:\n{context}\n\nQuestion: {message}"}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"content-type": "application/json", "x-api-key": API_KEY,
                 "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        return {"reply": data["content"][0]["text"],
                "source": f"claude + kb/{hits[0]['file']}.md"}
    except Exception:
        return answer_retrieval(message)  # graceful degradation


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path != "/chat":
            self.send_error(404)
            return
        length = int(self.headers.get("content-length", 0))
        try:
            message = json.loads(self.rfile.read(length))["message"][:2000]
        except Exception:
            self.send_error(400)
            return
        result = answer_ai(message) if API_KEY else answer_retrieval(message)
        payload = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print(f"[supportdesk] {fmt % args}")


if __name__ == "__main__":
    mode = "AI (Claude) + retrieval" if API_KEY else "retrieval (no API key)"
    print(f"SupportDesk AI · http://localhost:{PORT}/demo.html · engine: {mode}")
    print(f"Knowledge base: {len(KB.chunks)} sections from {KB_DIR}")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
