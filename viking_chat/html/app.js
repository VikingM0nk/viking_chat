(() => {
  const root = document.getElementById('root');
  const feed = document.getElementById('feed');
  const composer = document.getElementById('composer');
  const input = document.getElementById('chat-input');
  const suggestionsEl = document.getElementById('suggestions');
  const modeLabel = document.getElementById('mode-label');

  let messageDuration = 7000;
  let maxVisible = 8;
  let forceHidden = false;
  let showInput = false;
  let modes = [{ name: 'all', displayName: 'Say', color: '#c9a227' }];
  let modeIdx = 0;
  let suggestions = [];
  let sugIdx = -1;
  let msgSeq = 0;

  const COLOR_MAP = {
    '0': 'c-0', '1': 'c-1', '2': 'c-2', '3': 'c-3', '4': 'c-4',
    '5': 'c-5', '6': 'c-6', '7': 'c-7', '8': 'c-8', '9': 'c-9',
    w: 'c-w', r: 'c-r', g: 'c-g', y: 'c-y', b: 'c-b',
  };

  function resourceName() {
    try {
      if (typeof GetParentResourceName === 'function') {
        return GetParentResourceName();
      }
    } catch (_) {}
    return 'chat';
  }

  function post(name, data) {
    fetch(`https://${resourceName()}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data || {}),
    }).catch(() => {});
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function colorize(text) {
    let html = '';
    let open = false;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '^' && i + 1 < s.length) {
        const code = s[i + 1];
        const cls = COLOR_MAP[code];
        if (cls) {
          if (open) html += '</span>';
          html += `<span class="${cls}">`;
          open = true;
          i++;
          continue;
        }
      }
      html += escapeHtml(s[i]);
    }
    if (open) html += '</span>';
    return html;
  }

  function applyTemplate(template, args, params) {
    let out = template;
    if (params && typeof params === 'object') {
      for (const [k, v] of Object.entries(params)) {
        out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), escapeHtml(String(v)));
      }
    }
    if (Array.isArray(args)) {
      args.forEach((arg, i) => {
        out = out.replace(new RegExp(`\\{${i}\\}`, 'g'), colorize(arg));
      });
    }
    return out;
  }

  function renderMessageHtml(message) {
    if (message.template) {
      return applyTemplate(message.template, message.args || [], message.params);
    }

    if (message.templateId === 'print') {
      const body = colorize((message.args && message.args[0]) || '');
      return `<span class="body">${body}</span>`;
    }

    const args = message.args || [];
    if (args.length >= 2) {
      const author = escapeHtml(String(args[0]));
      const body = colorize(args[1]);
      return `<span class="author">${author}</span><span class="body">${body}</span>`;
    }
    if (args.length === 1) {
      return `<span class="body">${colorize(args[0])}</span>`;
    }
    return `<span class="body"></span>`;
  }

  function updateFeedVisibility() {
    root.classList.remove('hidden-feed', 'force-hide', 'open');

    if (forceHidden) {
      root.classList.add('force-hide');
      return;
    }

    if (showInput) {
      root.classList.add('open');
      return;
    }

    const hasLive = feed.querySelector('.msg:not(.fading)');
    if (!hasLive) root.classList.add('hidden-feed');
  }

  function pruneFeed() {
    while (feed.children.length > maxVisible) {
      feed.removeChild(feed.firstChild);
    }
  }

  function addMessage(message) {
    if (forceHidden && !showInput) return;

    const el = document.createElement('div');
    el.className = 'msg';
    el.dataset.id = String(++msgSeq);

    if (message.templateId === 'print') el.classList.add('print');
    if (!message.args || message.args.length < 2) el.classList.add('system');

    if (Array.isArray(message.color) && message.color.length >= 3 && message.args && message.args.length >= 2) {
      // tint author if a color tuple is provided
    }

    el.innerHTML = renderMessageHtml(message);
    feed.appendChild(el);
    pruneFeed();
    updateFeedVisibility();

    const duration = showInput ? Math.max(messageDuration, 60000) : messageDuration;
    const fadeAt = setTimeout(() => {
      if (showInput) return;
      el.classList.add('fading');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        updateFeedVisibility();
      }, 850);
    }, duration);

    el._fadeTimer = fadeAt;
  }

  function clearMessages() {
    feed.innerHTML = '';
    updateFeedVisibility();
  }

  function currentMode() {
    return modes[modeIdx] || modes[0];
  }

  function refreshModeLabel() {
    const m = currentMode();
    modeLabel.textContent = m.displayName || m.name || 'Say';
    modeLabel.style.color = m.color || '#c9a227';
  }

  function openChat() {
    showInput = true;
    composer.classList.remove('hidden');
    root.classList.add('open');
    root.classList.remove('hidden-feed');
    refreshModeLabel();
    input.value = '';
    sugIdx = -1;
    renderSuggestions();
    setTimeout(() => input.focus(), 20);
    updateFeedVisibility();
  }

  function closeChat(canceled, message) {
    showInput = false;
    composer.classList.add('hidden');
    suggestionsEl.classList.add('hidden');
    input.value = '';
    sugIdx = -1;
    updateFeedVisibility();
    post('chatResult', {
      canceled: !!canceled,
      message: message || '',
      mode: currentMode().name,
    });
  }

  function filteredSuggestions() {
    const raw = input.value.trim();
    if (!raw.startsWith('/')) return [];
    const q = raw.toLowerCase();
    return suggestions
      .filter((s) => s.name && s.name.toLowerCase().startsWith(q))
      .slice(0, 8);
  }

  function renderSuggestions() {
    const list = filteredSuggestions();
    if (!list.length) {
      suggestionsEl.classList.add('hidden');
      suggestionsEl.innerHTML = '';
      sugIdx = -1;
      return;
    }
    if (sugIdx >= list.length) sugIdx = list.length - 1;
    suggestionsEl.classList.remove('hidden');
    suggestionsEl.innerHTML = list
      .map((s, i) => {
        const help = s.help ? `<span class="sug-help">${escapeHtml(s.help)}</span>` : '';
        return `<div class="sug${i === sugIdx ? ' active' : ''}" data-idx="${i}">
          <span class="sug-name">${escapeHtml(s.name)}</span>${help}
        </div>`;
      })
      .join('');
  }

  function applySuggestion() {
    const list = filteredSuggestions();
    if (sugIdx < 0 || !list[sugIdx]) return;
    input.value = list[sugIdx].name + ' ';
    renderSuggestions();
  }

  input.addEventListener('input', () => {
    sugIdx = -1;
    renderSuggestions();
  });

  input.addEventListener('keydown', (e) => {
    const list = filteredSuggestions();

    if (e.key === 'Escape') {
      e.preventDefault();
      closeChat(true, '');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) {
        closeChat(true, '');
        return;
      }
      closeChat(false, msg);
      return;
    }

    if (e.key === 'ArrowUp' && list.length) {
      e.preventDefault();
      sugIdx = sugIdx <= 0 ? list.length - 1 : sugIdx - 1;
      renderSuggestions();
      return;
    }

    if (e.key === 'ArrowDown' && list.length) {
      e.preventDefault();
      sugIdx = sugIdx >= list.length - 1 ? 0 : sugIdx + 1;
      renderSuggestions();
      return;
    }

    if (e.key === 'Tab' && list.length) {
      e.preventDefault();
      if (sugIdx < 0) sugIdx = 0;
      applySuggestion();
      return;
    }

    if (e.key === 'PageUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      if (modes.length > 1) {
        modeIdx = (modeIdx - 1 + modes.length) % modes.length;
        refreshModeLabel();
      }
      return;
    }

    if (e.key === 'PageDown') {
      e.preventDefault();
      if (modes.length > 1) {
        modeIdx = (modeIdx + 1) % modes.length;
        refreshModeLabel();
      }
    }
  });

  suggestionsEl.addEventListener('click', (e) => {
    const row = e.target.closest('.sug');
    if (!row) return;
    sugIdx = Number(row.dataset.idx);
    applySuggestion();
    input.focus();
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    switch (data.type) {
      case 'ON_MESSAGE':
        addMessage(data.message || {});
        break;
      case 'ON_CLEAR':
        clearMessages();
        break;
      case 'ON_OPEN':
        openChat();
        break;
      case 'ON_SUGGESTION_ADD': {
        const s = data.suggestion;
        if (Array.isArray(s)) {
          s.forEach((item) => {
            suggestions = suggestions.filter((x) => x.name !== item.name);
            suggestions.push(item);
          });
        } else if (s && s.name) {
          suggestions = suggestions.filter((x) => x.name !== s.name);
          suggestions.push(s);
        }
        if (showInput) renderSuggestions();
        break;
      }
      case 'ON_SUGGESTION_REMOVE':
        suggestions = suggestions.filter((x) => x.name !== data.name);
        if (showInput) renderSuggestions();
        break;
      case 'ON_MODE_ADD':
        if (data.mode && data.mode.name) {
          modes = modes.filter((m) => m.name !== data.mode.name);
          modes.push(data.mode);
          refreshModeLabel();
        }
        break;
      case 'ON_MODE_REMOVE':
        if (data.mode && data.mode.name) {
          modes = modes.filter((m) => m.name !== data.mode.name);
          if (!modes.length) modes = [{ name: 'all', displayName: 'Say', color: '#c9a227' }];
          modeIdx = 0;
          refreshModeLabel();
        }
        break;
      case 'ON_FORCE_HIDE':
        forceHidden = !!data.hidden;
        updateFeedVisibility();
        break;
      case 'ON_CONFIG':
        if (typeof data.messageDuration === 'number') messageDuration = data.messageDuration;
        if (typeof data.maxVisible === 'number') maxVisible = data.maxVisible;
        break;
      default:
        break;
    }
  });

  post('loaded', {});
})();
