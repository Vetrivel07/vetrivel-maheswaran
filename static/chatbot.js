// ===== Chat Drawer (OpenAI backend) =====
const promptBox = document.querySelector('.promptBox');
const promptInput = document.getElementById('promptInput');
const promptBtn = document.getElementById('promptBtn');

const chatOverlay = document.getElementById('chatOverlay');
const chatDrawer  = document.getElementById('chatDrawer');
const chatClose   = document.getElementById('chatClose');
const chatBody    = document.getElementById('chatBody');
const chatInput   = document.getElementById('chatInput');
const chatSend    = document.getElementById('chatSend');

let messages = []; 

const API_BASE =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : ''; // Render (same-origin) -> '/api/chat'

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;');
}

function renderChat() {
  if (!chatBody) return;
  chatBody.innerHTML = '';
  for (const m of messages) {
    // if (m._id) continue;
    const row = document.createElement('div');
    row.className = `msgRow ${m.role === 'user' ? 'user' : 'bot'}`;

    const bubble = document.createElement('div');
    bubble.className = `msg ${m.role === 'user' ? 'user' : 'bot'}`;
    bubble.innerHTML = escapeHtml(m.content);

    row.appendChild(bubble);
    chatBody.appendChild(row);
  }
  chatBody.scrollTop = chatBody.scrollHeight;
}

function openChat() {
  if (!chatOverlay || !chatDrawer || !chatInput) return;
  document.body.classList.add('chatOpen');
  chatOverlay.setAttribute('aria-hidden', 'false');
  chatDrawer.setAttribute('aria-hidden', 'false');

  // If first open and no messages, seed a greeting:
  if (messages.length === 0) {
    messages.push({
      role: 'assistant',
      content: "Hi, I’m Mahi AI — Vetrivel’s AI assistant. Curious about Vetrivel? I can help you learn more about him."
    });
  }
  renderChat();
  setTimeout(() => chatInput.focus(), 50);
}

function closeChat() {
  if (!chatOverlay || !chatDrawer) return;
  document.body.classList.remove('chatOpen');
  chatOverlay.setAttribute('aria-hidden', 'true');
  chatDrawer.setAttribute('aria-hidden', 'true');
}

// Make prompt box act like a launcher (click textarea OR Run)
if (promptBox) {
  promptBox.addEventListener('click', () => openChat());
}
if (promptBtn) {
  promptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    // If user typed something in the "Try it" box, send it as first message:
    const first = (promptInput?.value || '').trim();
    openChat();
    if (first) {
      sendMessage(first);
      if (promptInput) promptInput.value = '';
    }
  });
}

// Close handlers
chatOverlay?.addEventListener('click', closeChat);
chatClose?.addEventListener('click', closeChat);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('chatOpen')) closeChat();
});

// Send message helpers
async function sendMessage(text) {
  const userText = (text || '').trim();
  if (!userText) return;

  messages.push({ role: 'user', content: userText });
  renderChat();

  // show typing indicator
  const typingId = crypto?.randomUUID?.() || String(Date.now());
  messages.push({ role: 'assistant', content: '...' , _id: typingId });
  renderChat();

  try {
    // Send last N turns to control cost
    const recent = messages
      .filter(m => !m._id)
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: recent })
    });

    let data = {};
    try { data = await resp.json(); } catch { data = {}; }

    if (!resp.ok) {
        const msg = data?.error || data?.message || `HTTP ${resp.status}`;
        throw new Error(msg);
    }

    const reply = data?.reply || 'No reply returned.';

    // replace typing
    const idx = messages.findIndex(m => m._id === typingId);
    if (idx !== -1) messages.splice(idx, 1);
    messages.push({ role: 'assistant', content: reply });
    renderChat();
  } catch (err) {
    const idx = messages.findIndex(m => m._id === typingId);
    if (idx !== -1) messages.splice(idx, 1);
    messages.push({
      role: 'assistant',
      content: `Error: ${err?.message || 'Request failed'}.`
    });
    renderChat();
  }
}

// send button
chatSend?.addEventListener('click', () => {
  if (!chatInput) return;
  const t = chatInput.value;
  chatInput.value = '';
  sendMessage(t);
});

// Enter to send (Shift+Enter = newline)
chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatSend.click();
  }
});

