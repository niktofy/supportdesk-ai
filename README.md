# SupportDesk AI 💬

An embeddable customer-support chatbot that answers **from your own docs** — so it never makes things up.

![demo](https://niktofy.github.io/Portofolio/assets/supportdesk.png)

## How it works

- Drop your FAQ / policies as markdown files into `kb/`
- The server indexes every section (TF-IDF) and retrieves the best match for each question
- Answers cite their source (`kb/shipping.md — Delivery times`) so customers can trust them
- **Optional AI mode:** set `ANTHROPIC_API_KEY` and Claude composes the answer, strictly constrained to the retrieved context — with automatic fallback to retrieval mode if the API is down

## Quick start

```
python server.py
# → http://localhost:8787/demo.html  (demo store with the widget)
```

Zero dependencies — Python stdlib only.

## Embed on any site

```html
<script>
  window.SupportDesk = {
    endpoint: "https://your-server.com/chat",
    title: "Store Support",
    accent: "#6C5CE7",
    greeting: "Hi! How can I help?"
  };
</script>
<script src="widget.js" defer></script>
```

The widget is a single JS file: floating bubble, typing indicator, source citations, mobile-friendly, brandable colors.

## Why retrieval-first

Pure-LLM support bots hallucinate policies and prices. SupportDesk retrieves the answer from *your* knowledge base first — the AI (when enabled) only rephrases grounded context. Cheap, safe, auditable.

---

**Vadim Melnic** — full-stack developer · [Portfolio](https://niktofy.github.io/Portofolio/) · vadimash204@gmail.com
