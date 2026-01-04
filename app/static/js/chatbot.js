class PortfolioChatbot {
  constructor() {
    // DOM elements
    this.promptInput = document.getElementById('promptInput');
    this.promptBtn = document.getElementById('promptBtn');
    this.promptOut = document.getElementById('promptOut');
    
    this.chatOverlay = document.getElementById('chatOverlay');
    this.chatDrawer = document.getElementById('chatDrawer');
    this.chatClose = document.getElementById('chatClose');
    this.chatBody = document.getElementById('chatBody');
    this.chatInput = document.getElementById('chatInput');
    this.chatSend = document.getElementById('chatSend');
    
    // State
    this.sessionId = null;
    this.isStreaming = false;
    this.conversationHistory = [];
    
    // Initialize
    this.init();
  }
  
  init() {
    if (!this.promptBtn || !this.chatSend) return;
    const promptBox = document.querySelector('.promptBox');
    promptBox?.addEventListener('click', () => this.openChat());

    // Event listeners for prompt box (hero section)
    this.promptBtn.addEventListener('click', () => this.handlePromptSubmit());
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handlePromptSubmit();
      }
    });
    
    // Event listeners for chat drawer
    this.chatSend.addEventListener('click', () => this.handleChatSubmit());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleChatSubmit();
      }
    });
    
    // Close chat drawer
    this.chatClose.addEventListener('click', () => this.closeChat());
    this.chatOverlay.addEventListener('click', () => this.closeChat());
    
    // Auto-resize textareas
    this.setupAutoResize(this.promptInput);
    this.setupAutoResize(this.chatInput);
    
    // Show welcome message
    this.showWelcomeMessage();
  }
  
  setupAutoResize(textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
  }
  
  showWelcomeMessage() {
    if (this.chatBody.children.length === 0) {
      const welcome = this.createMessageElement(
        'assistant',
        '👋 Hi! I\'m MAHI AI, Vetrivel\'s AI assistant. Curious about Vetrivel? I can help you learn more about him.'
      );
      this.chatBody.appendChild(welcome);
    }
  }
  
  async handlePromptSubmit() {
    const message = this.promptInput.value.trim();
    if (!message || this.isStreaming) return;
    
    // Clear input
    this.promptInput.value = '';
    this.promptInput.style.height = 'auto';
    
    // Open chat drawer and send message
    this.openChat();
    await this.sendMessage(message);
  }
  
  async handleChatSubmit() {
    const message = this.chatInput.value.trim();
    if (!message || this.isStreaming) return;
    
    // Clear input
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    
    await this.sendMessage(message);
  }
  
  async sendMessage(message) {
    if (this.isStreaming) return;
    
    // Add user message to UI
    const userMsg = this.createMessageElement('user', message);
    this.chatBody.appendChild(userMsg);
    this.scrollToBottom();
    
    // Show typing indicator
    const typingIndicator = this.createTypingIndicator();
    this.chatBody.appendChild(typingIndicator);
    this.scrollToBottom();
    
    this.isStreaming = true;
    this.disableInputs();
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          session_id: this.sessionId
        })
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      // Remove typing indicator
      typingIndicator.remove();
      
      // Create assistant message element
      const assistantRow = this.createMessageElement('assistant', '');
      this.chatBody.appendChild(assistantRow);
      const assistantBubble = assistantRow.querySelector('.msg');
      await this.streamResponse(response, assistantBubble);

      
    } catch (error) {
      console.error('Error:', error);
      typingIndicator.remove();
      
      const errorMsg = this.createMessageElement(
        'assistant',
        'Sorry, I encountered an error. Please try again.'
      );
      this.chatBody.appendChild(errorMsg);
    } finally {
      this.isStreaming = false;
      this.enableInputs();
      this.scrollToBottom();
    }
  }
  
  async streamResponse(response, messageElement) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.chunk) {
           fullText += data.chunk;
            const clean = this.stripEmoji(fullText);
            messageElement.innerHTML = this.formatMessage(clean);

          }
          
          if (data.session_id && !this.sessionId) {
            this.sessionId = data.session_id;
          }
          
          if (data.error) {
            console.error('Stream error:', data.error);
          }
        }
      }
    }
  }
  
  createMessageElement(role, content) {
    const row = document.createElement('div');
    row.className = `msgRow ${role === 'user' ? 'user' : 'bot'}`;

    const bubble = document.createElement('div');
    bubble.className = `msg ${role === 'user' ? 'user' : 'bot'}`;

    // no emojis + formatted content
    const clean = (role === 'assistant') ? this.stripEmoji(content) : content;
    bubble.innerHTML = this.formatMessage(clean);

    row.appendChild(bubble);
    return row;
  }

  createTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'msgRow bot';
    row.dataset.typing = '1';

    const bubble = document.createElement('div');
    bubble.className = 'msg bot';
    bubble.textContent = '...';

    row.appendChild(bubble);
    return row;
  }

  
  formatMessage(text) {
    // Convert markdown-style formatting to HTML
    let formatted = this.escapeHtml(text);
    
    // Strip any HTML anchor tags coming from the model → keep text only
    formatted = formatted.replace(
      /&lt;a[^&]*&gt;([^&]*)&lt;\/a&gt;/gi,
      '$1'
    );

    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');

    // Auto-link known page phrases
    formatted = formatted.replace(
      /\b(Contact Page|contact page)\b/g,
      `<a href="${location.origin}/contact.html" class="chatLink">$1</a>`
    );

    formatted = formatted.replace(
      /\b(About Page|about section)\b/g,
      `<a href="${location.origin}/about.html" class="chatLink">$1</a>`
    );

    formatted = formatted.replace(
      /\b(Projects Page|project section)\b/g,
      `<a href="${location.origin}/projects.html" class="chatLink">$1</a>`
    );

    formatted = formatted.replace(
      /\b(Work Experience page|work page)\b/g,
      `<a href="${location.origin}/work.html" class="chatLink">$1</a>`
    );


    // Markdown links: [text](url)
    formatted = formatted.replace(
      /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\)]+)\)/g,
      '<a href="$2" class="chatLink" target="_blank" rel="noopener">$1</a>'
    );

    // Bullet points
    formatted = formatted.replace(/^• (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Auto-link internal navigation phrases
    const pageLinks = {
      'contact page': 'contact.html',
      'about page': 'about.html',
      'projects page': 'projects.html',
      'work page': 'work.html'
    };

    Object.entries(pageLinks).forEach(([text, href]) => {
      const regex = new RegExp(`\\b${text}\\b`, 'gi');
      formatted = formatted.replace(
        regex,
        `<a href="${location.origin}/${href}" class="chatLink">$&</a>`
      );
    });


    return formatted;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  stripEmoji(text) {
    return (text || '').replace(/[\p{Extended_Pictographic}]/gu, '').trim();
  }

  openChat() {
  document.body.classList.add('chatOpen');
  this.chatOverlay.setAttribute('aria-hidden', 'false');
  this.chatDrawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    this.chatInput.focus();
    this.scrollToBottom();
  }, 300);
}

  
  closeChat() {
    document.body.classList.remove('chatOpen');
    this.chatOverlay.setAttribute('aria-hidden', 'true');
    this.chatDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  
  scrollToBottom() {
    requestAnimationFrame(() => {
      this.chatBody.scrollTop = this.chatBody.scrollHeight;
    });
  }
  
  disableInputs() {
    this.promptBtn.disabled = true;
    this.chatSend.disabled = true;
    this.promptInput.disabled = true;
    this.chatInput.disabled = true;
  }
  
  enableInputs() {
    this.promptBtn.disabled = false;
    this.chatSend.disabled = false;
    this.promptInput.disabled = false;
    this.chatInput.disabled = false;
  }
}

// Initialize chatbot when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PortfolioChatbot();
  });
} else {
  new PortfolioChatbot();
}