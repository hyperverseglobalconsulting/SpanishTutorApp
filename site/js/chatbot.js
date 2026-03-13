// ─── CHATBOT with Profesora Luna headshot ────────────────────────────────────
const Chatbot = (() => {
  let messages = [];
  let isOpen = false;
  let isTyping = false;

  const TUTOR_AVATAR = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#FF6B35"/>
    <circle cx="18" cy="14" r="7" fill="#FFF5EE"/>
    <path d="M8 32c0-5.523 4.477-10 10-10s10 4.477 10 10" fill="#FFF5EE"/>
    <circle cx="15" cy="13" r="1.2" fill="#333"/>
    <circle cx="21" cy="13" r="1.2" fill="#333"/>
    <path d="M15.5 16.5c0 0 1.2 1.5 2.5 1.5s2.5-1.5 2.5-1.5" stroke="#333" stroke-width="0.8" stroke-linecap="round" fill="none"/>
    <path d="M11 9c1-3 4-5 7-5s6 2 7 5" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <circle cx="27" cy="10" r="2" fill="#FFB347"/>
  </svg>`;

  const USER_AVATAR = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="18" fill="#4A9EFF"/>
    <circle cx="18" cy="14" r="6" fill="#E8F0FE"/>
    <path d="M9 32c0-5 4-9 9-9s9 4 9 9" fill="#E8F0FE"/>
  </svg>`;

  function init() {
    const fab = document.createElement("div");
    fab.id = "chat-fab";
    fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    fab.onclick = toggle;
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.id = "chat-panel";
    panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-left">
          <div class="chat-avatar">${TUTOR_AVATAR}</div>
          <div>
            <div class="chat-name">Profesora Luna</div>
            <div class="chat-status">Spanish Tutor</div>
          </div>
        </div>
        <button class="chat-close" onclick="Chatbot.toggle()">✕</button>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg bot">
          <div class="chat-msg-avatar">${TUTOR_AVATAR}</div>
          <div class="chat-bubble bot">¡Hola! 👋 I'm <strong>Profesora Luna</strong>, your Spanish tutor. Ask me anything about Spanish vocabulary, grammar, or just practice chatting in Spanish! ¿Cómo te puedo ayudar? (How can I help you?)</div>
        </div>
      </div>
      <div class="chat-input-wrap">
        <input type="text" id="chat-input" placeholder="Ask Profesora Luna..." onkeydown="if(event.key==='Enter')Chatbot.send()"/>
        <button class="chat-send" onclick="Chatbot.send()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>`;
    document.body.appendChild(panel);

    messages = [
      { role: "assistant", content: "¡Hola! 👋 I'm Profesora Luna, your Spanish tutor. Ask me anything about Spanish vocabulary, grammar, or just practice chatting in Spanish! ¿Cómo te puedo ayudar? (How can I help you?)" }
    ];
  }

  function toggle() {
    isOpen = !isOpen;
    const panel = document.getElementById("chat-panel");
    const fab = document.getElementById("chat-fab");
    panel.classList.toggle("open", isOpen);
    fab.classList.toggle("active", isOpen);
    if (isOpen) document.getElementById("chat-input")?.focus();
  }

  async function send() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text || isTyping) return;
    input.value = "";

    // Add user message
    messages.push({ role: "user", content: text });
    appendMessage("user", text);

    // Show typing indicator
    isTyping = true;
    appendTyping();

    try {
      if (!Auth.isLoggedIn()) {
        throw new Error("Please sign in to chat with Profesora Luna");
      }
      const token = Auth.getIdToken();
      const res = await fetch(`${APP_CONFIG.API_ENDPOINT}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: messages.filter(m => m.role !== "system") }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();

      messages.push({ role: "assistant", content: data.reply });
      removeTyping();
      appendMessage("bot", data.reply);
    } catch (e) {
      removeTyping();
      appendMessage("bot", `⚠️ ${e.message}. Please try again.`);
    }
    isTyping = false;
  }

  function appendMessage(type, text) {
    const container = document.getElementById("chat-messages");
    const avatar = type === "bot" ? TUTOR_AVATAR : USER_AVATAR;
    const div = document.createElement("div");
    div.className = `chat-msg ${type}`;
    div.innerHTML = `<div class="chat-msg-avatar">${avatar}</div><div class="chat-bubble ${type}">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function appendTyping() {
    const container = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className = "chat-msg bot";
    div.id = "typing-indicator";
    div.innerHTML = `<div class="chat-msg-avatar">${TUTOR_AVATAR}</div><div class="chat-bubble bot typing"><span></span><span></span><span></span></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    document.getElementById("typing-indicator")?.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  return { init, toggle, send };
})();
