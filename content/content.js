(function () {
  'use strict';
  let state = { selectedText: "", lastRange: null, dialog: null, isProcessing: false };
  const isContextValid = () => !!chrome.runtime?.id;

  const init = () => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleOuterClick);
  };

  const handleMouseUp = (e) => {
    if (!isContextValid()) return; 
    if (state.dialog && state.dialog.contains(e.target)) return;
    const sidebar = document.getElementById('ai-result-sidebar');
    if (sidebar && sidebar.contains(e.target)) return;
    
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 0) {
      state.selectedText = text;
      // 核心优化：精准保存划词 Range，防止 Notion 插入位置偏移
      state.lastRange = selection.getRangeAt(0).cloneRange();
      renderPopup(e.clientX, e.clientY);
    }
  };

  const handleOuterClick = (e) => {
    if (state.isProcessing) return; 
    if (state.dialog && !state.dialog.contains(e.target)) destroyDialog();
  };

  const renderPopup = (x, y) => {
    if (!isContextValid()) return;
    destroyDialog();
    state.dialog = document.createElement('div');
    state.dialog.id = 'ai-ext-popup';
    
    const PW = 340, PH = 310;
    const vw = window.innerWidth, vh = window.innerHeight;
    let posX = Math.max(10, Math.min(x, vw - PW - 10));
    let posY = (y - PH - 10 > 0) ? y - PH - 10 : y + 15;
    state.dialog.style.left = `${posX}px`;
    state.dialog.style.top = `${posY}px`;

    // 国际化逻辑加固：增加兜底文字
    const headerTitle = chrome.i18n.getMessage("aiHeader") || "✦ Notion Assistant";
    const btnSendText = chrome.i18n.getMessage("btnSend") || "发送";
    const statusReadyText = chrome.i18n.getMessage("statusReady") || "准备就绪";

    state.dialog.innerHTML = `
      <div class="ai-header"><span>${headerTitle}</span><a href="https://xhslink.com/m/16xjFq87q7b" target="_blank" class="user-link">@Zane同学</a></div>
      <div class="ai-selection-wrapper">
        <div class="ai-selection-preview" id="ai-preview"></div>
        <button id="ai-speak-btn" title="${chrome.i18n.getMessage("ttsTooltip") || '朗读'}">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13.5V10.5C3 9.67157 3.67157 9 4.5 9H7.5L12.7929 3.70711C13.4229 3.07714 14.5 3.52331 14.5 4.41421V19.5858C14.5 20.4767 13.4229 20.9229 12.7929 20.2929L7.5 15H4.5C3.67157 15 3 14.3284 3 13.5Z" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.0711 19.0711C20.6332 17.509 21.5 15.387 21.5 13C21.5 10.613 20.6332 8.49103 19.0711 6.92896" stroke="#888" stroke-width="2" stroke-linecap="round"/><path d="M16.2426 16.2426C16.8674 15.6178 17.25 14.803 17.25 13.9C17.25 12.997 16.8674 12.1822 16.2426 11.5574" stroke="#888" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <textarea id="ai-input"></textarea>
      <button id="ai-send-btn">${btnSendText}</button>
      <div id="ai-status">${statusReadyText}</div>
    `;
    document.body.appendChild(state.dialog);
    document.getElementById('ai-preview').textContent = state.selectedText;

    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');

    // 核心优先级：用户保存设置 > 国际化默认值 > 硬编码兜底
    chrome.storage.sync.get(['defaultPrompt'], (r) => {
      const i18nPromptValue = chrome.i18n.getMessage("defaultPromptValue");
      aiInput.value = r.defaultPrompt || i18nPromptValue || "翻译英文 并且列出重点单词或者词组 简短";
      checkInput();
    });

    function checkInput() {
      const isEmpty = aiInput.value.trim().length === 0;
      aiSendBtn.disabled = isEmpty;
      isEmpty ? aiSendBtn.classList.add('disabled') : aiSendBtn.classList.remove('disabled');
    }

    aiInput.addEventListener('input', checkInput);
    document.getElementById('ai-speak-btn').onclick = speakText;
    aiInput.addEventListener('keydown', (e) => e.stopPropagation());
    aiSendBtn.onclick = doCallAI;
  };

  const showSidebarResult = (content) => {
    let sidebar = document.getElementById('ai-result-sidebar');
    if (!sidebar) { sidebar = document.createElement('div'); sidebar.id = 'ai-result-sidebar'; document.body.appendChild(sidebar); }
    
    const sidebarTitle = chrome.i18n.getMessage("sidebarHeader") || "AI 分析结果";
    const copyBtnText = chrome.i18n.getMessage("btnCopy") || "复制结果";

    sidebar.innerHTML = `
      <div class="sidebar-header"><span>${sidebarTitle}</span><button id="sidebar-close">&times;</button></div>
      <div class="sidebar-body">${content.split('\n').map(l => `<p>${l}</p>`).join('')}</div>
      <div class="sidebar-footer"><button id="ai-copy-btn">${copyBtnText}</button></div>
    `;
    setTimeout(() => sidebar.classList.add('show'), 10);
    
    document.getElementById('sidebar-close').onclick = () => sidebar.classList.remove('show');
    document.getElementById('ai-copy-btn').onclick = () => { 
      navigator.clipboard.writeText(content); 
      const statusCopiedText = chrome.i18n.getMessage("statusCopied") || "已复制";
      document.getElementById('ai-copy-btn').innerText = "✓ " + statusCopiedText; 
    };
  };

  function speakText() {
    const speakBtn = document.getElementById('ai-speak-btn');
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }

    const text = state.selectedText;
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 语种自动识别逻辑
    if (/[\u4e00-\u9fa5]/.test(text)) utterance.lang = 'zh-CN';
    else if (/[\u3040-\u30ff]/.test(text)) utterance.lang = 'ja-JP';
    else if (/[\uac00-\ud7af]/.test(text)) utterance.lang = 'ko-KR';
    else if (/[\u0e00-\u0e7f]/.test(text)) utterance.lang = 'th-TH';
    else utterance.lang = 'en-US';

    // 强制寻找系统优质语音包
    const voices = speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => 
      v.lang.replace('_', '-').startsWith(utterance.lang) && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft'))
    );

    if (premiumVoice) utterance.voice = premiumVoice;
    utterance.rate = 0.95; 
    
    utterance.onstart = () => speakBtn.classList.add('speaking');
    utterance.onend = () => speakBtn.classList.remove('speaking');
    utterance.onerror = () => speakBtn.classList.remove('speaking');
    speechSynthesis.speak(utterance);
  }

  const destroyDialog = () => { if (state.dialog) { state.dialog.remove(); state.dialog = null; } state.isProcessing = false; };

  async function doCallAI() {
    const btn = document.getElementById('ai-send-btn');
    const status = document.getElementById('ai-status');
    const promptValue = document.getElementById('ai-input').value;
    state.isProcessing = true;
    btn.disabled = true;
    btn.classList.add('disabled');
    btn.innerText = chrome.i18n.getMessage("btnProcessing") || "处理中...";

    chrome.storage.sync.get(['apiKey', 'customModel'], async (r) => {
      try {
        const key = r.apiKey || "sk-8oB2nv3YNSmD65j9ALs7lcsLovddCwyzRTCaiLOVIKQvqeb7";
        const model = r.customModel || "deepseek-v4-think";
        status.innerText = chrome.i18n.getMessage("statusThinking") || "AI 思考中...";

        const res = await fetch("https://llm.whitedream.top/v1/chat/completions", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ model: model, messages: [{ role: "user", content: `${promptValue}:\n\n${state.selectedText}` }] })
        });
        
        const data = await res.json();
        const aiResult = data.choices?.[0]?.message?.content || '';
        if (aiResult) {
          if (window.location.host.includes("notion.so")) { 
            insertToNotion(aiResult); 
            destroyDialog(); 
          } else { 
            destroyDialog(); 
            showSidebarResult(aiResult); 
          }
        }
      } catch (err) { 
        status.innerText = "❌ " + err.message; 
        btn.disabled = false; 
        btn.classList.remove('disabled'); 
        btn.innerText = chrome.i18n.getMessage("btnSend") || "发送"; 
        state.isProcessing = false; 
      }
    });
  }

  function insertToNotion(content) {
    if (!state.lastRange) return;
    
    // 稳定性提升：重置选区到划词处，确保粘贴位置正确
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(state.lastRange);

    const html = `<div style="border-left:3px solid #2eaadc;padding:12px;margin:10px 0;background:rgba(46,170,220,0.05);border-radius:4px;">${content.split('\n').map(l => `<p style="margin:2px 0;">${l}</p>`).join('')}</div>`;
    const dt = new DataTransfer(); 
    dt.setData('text/html', html); 
    dt.setData('text/plain', content);
    
    // 模拟粘贴动作并触发 Notion 内部渲染
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }

  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
  }

  init();
})();