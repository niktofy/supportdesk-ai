/* SupportDesk AI — embeddable chat widget.
 * Usage:
 *   <script>window.SupportDesk = { endpoint: "http://localhost:8787/chat",
 *                                  title: "Store Support", accent: "#6C5CE7" };</script>
 *   <script src="widget.js" defer></script>
 */
(function () {
  const cfg = Object.assign(
    { endpoint: "/chat", title: "Support", accent: "#6C5CE7",
      greeting: "Hi! How can I help you today?" },
    window.SupportDesk || {}
  );

  const css = `
  .sd-bubble{position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;
    background:${cfg.accent};border:none;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.35);
    display:flex;align-items:center;justify-content:center;z-index:99998;transition:transform .2s;}
  .sd-bubble:hover{transform:scale(1.07);}
  .sd-bubble svg{width:26px;height:26px;fill:#fff;}
  .sd-panel{position:fixed;bottom:94px;right:22px;width:350px;max-width:calc(100vw - 44px);
    height:480px;max-height:70vh;background:#fff;border-radius:16px;z-index:99999;
    box-shadow:0 18px 60px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;
    font-family:system-ui,-apple-system,'Segoe UI',sans-serif;}
  .sd-panel.open{display:flex;}
  .sd-head{background:${cfg.accent};color:#fff;padding:14px 16px;font-weight:600;font-size:15px;
    display:flex;justify-content:space-between;align-items:center;}
  .sd-head small{display:block;font-weight:400;opacity:.85;font-size:11.5px;margin-top:2px;}
  .sd-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;opacity:.85;}
  .sd-log{flex:1;overflow-y:auto;padding:14px;background:#F5F6FA;}
  .sd-msg{max-width:82%;padding:9px 13px;border-radius:14px;margin-bottom:8px;font-size:13.5px;
    line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}
  .sd-msg.bot{background:#fff;color:#1e2430;border-bottom-left-radius:4px;
    box-shadow:0 1px 3px rgba(0,0,0,.08);}
  .sd-msg.user{background:${cfg.accent};color:#fff;margin-left:auto;border-bottom-right-radius:4px;}
  .sd-src{font-size:10.5px;color:#9aa1b0;margin:-4px 0 10px 4px;}
  .sd-typing{display:inline-block;padding:10px 14px;}
  .sd-typing i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#b9bfcc;
    margin:0 2px;animation:sd-b 1.2s infinite;}
  .sd-typing i:nth-child(2){animation-delay:.15s}.sd-typing i:nth-child(3){animation-delay:.3s}
  @keyframes sd-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
  .sd-form{display:flex;gap:8px;padding:12px;background:#fff;border-top:1px solid #e8eaf0;}
  .sd-form input{flex:1;border:1px solid #d9dde6;border-radius:10px;padding:10px 12px;
    font-size:13.5px;outline:none;}
  .sd-form input:focus{border-color:${cfg.accent};}
  .sd-form button{background:${cfg.accent};color:#fff;border:none;border-radius:10px;
    padding:0 16px;font-size:14px;cursor:pointer;}
  .sd-powered{text-align:center;font-size:10px;color:#b6bcc9;padding:0 0 8px;background:#fff;}`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.className = "sd-bubble";
  bubble.setAttribute("aria-label", "Open support chat");
  bubble.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.5 21l3.7-1.6c1.2.4 2.5.6 3.8.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3z"/></svg>';

  const panel = document.createElement("div");
  panel.className = "sd-panel";
  panel.innerHTML = `
    <div class="sd-head"><div>${cfg.title}<small>Usually replies instantly</small></div>
      <button class="sd-close" aria-label="Close chat">✕</button></div>
    <div class="sd-log"></div>
    <form class="sd-form"><input type="text" placeholder="Type your question…" autocomplete="off">
      <button type="submit">➤</button></form>
    <div class="sd-powered">powered by SupportDesk AI</div>`;

  document.body.append(bubble, panel);
  const log = panel.querySelector(".sd-log");
  const form = panel.querySelector(".sd-form");
  const input = form.querySelector("input");

  function add(kind, text, source) {
    const m = document.createElement("div");
    m.className = "sd-msg " + kind;
    m.textContent = text;
    log.appendChild(m);
    if (source && source.startsWith("kb/")) {
      const s = document.createElement("div");
      s.className = "sd-src";
      s.textContent = "📄 " + source;
      log.appendChild(s);
    }
    log.scrollTop = log.scrollHeight;
  }

  let greeted = false;
  function toggle(open) {
    panel.classList.toggle("open", open);
    if (open && !greeted) { add("bot", cfg.greeting); greeted = true; }
    if (open) input.focus();
  }
  bubble.addEventListener("click", () => toggle(!panel.classList.contains("open")));
  panel.querySelector(".sd-close").addEventListener("click", () => toggle(false));

  async function send(text) {
    add("user", text);
    const typing = document.createElement("div");
    typing.className = "sd-msg bot sd-typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;
    try {
      const r = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
      typing.remove();
      add("bot", d.reply, d.source);
    } catch (e) {
      typing.remove();
      add("bot", "Connection problem — please try again in a moment.");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    send(text);
  });

  // scripted demo mode: ?autodemo=1 plays a real conversation
  if (new URLSearchParams(location.search).has("autodemo")) {
    toggle(true);
    const script = ["How long does delivery take?", "Can I return an item?"];
    script.forEach((q, i) => setTimeout(() => send(q), 900 + i * 2200));
  }
})();
