(function () {
  'use strict';

  let state = { selectedText: "", lastRange: null, dialog: null };

  const init = () => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleOuterClick);
  };

  const handleMouseUp = (e) => {
    if (state.dialog && state.dialog.contains(e.target)) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 0) {
      state.selectedText = text;
      state.lastRange = selection.getRangeAt(0).cloneRange();
      renderPopup(e.clientX, e.clientY);
    }
  };

  const handleOuterClick = (e) => {
    if (state.dialog && !state.dialog.contains(e.target)) destroyDialog();
  };

  // --- View & Controller: 渲染弹窗 ---
  const renderPopup = (x, y) => {
    destroyDialog();
    state.dialog = document.createElement('div');
    state.dialog.id = 'ai-ext-popup';

    const PW = 340, PH = 310;
    const vw = window.innerWidth, vh = window.innerHeight;
    let posX = Math.max(10, Math.min(x, vw - PW - 10));
    let posY = (y - PH - 10 > 0) ? y - PH - 10 : y + 15;
    posY = Math.max(10, Math.min(posY, vh - PH - 10));

    state.dialog.style.left = `${posX}px`;
    state.dialog.style.top = `${posY}px`;

    // --- 修改：在预览区域加入了喇叭图标 (使用 SVG 确保清晰度) ---
    const ttsTooltip = chrome.i18n.getMessage("ttsTooltip") || "Click to read";
    
    state.dialog.innerHTML = `
      <div class="ai-header">
        <span>${chrome.i18n.getMessage("aiHeader")}</span>
        <a href="https://xhslink.com/m/16xjFq87q7b" target="_blank" class="user-link">${chrome.i18n.getMessage("userName")}</a>
      </div>
      
      <div class="ai-selection-wrapper">
        <div class="ai-selection-preview" id="ai-preview"></div>
        <button id="ai-speak-btn" title="${ttsTooltip}">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 13.5V10.5C3 9.67157 3.67157 9 4.5 9H7.5L12.7929 3.70711C13.4229 3.07714 14.5 3.52331 14.5 4.41421V19.5858C14.5 20.4767 13.4229 20.9229 12.7929 20.2929L7.5 15H4.5C3.67157 15 3 14.3284 3 13.5Z" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.0711 19.0711C20.6332 17.509 21.5 15.387 21.5 13C21.5 10.613 20.6332 8.49103 19.0711 6.92896" stroke="#888" stroke-width="2" stroke-linecap="round"/>
            <path d="M16.2426 16.2426C16.8674 15.6178 17.25 14.803 17.25 13.9C17.25 12.997 16.8674 12.1822 16.2426 11.5574" stroke="#888" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <textarea id="ai-input">${chrome.i18n.getMessage("defaultPrompt")}</textarea>
      <button id="ai-send-btn">${chrome.i18n.getMessage("btnSend")}</button>
      <div id="ai-status">${chrome.i18n.getMessage("statusReady")}</div>
    `;

    document.body.appendChild(state.dialog);
    
    // 注入选中文本
    document.getElementById('ai-preview').textContent = 
      state.selectedText.length > 120 ? state.selectedText.slice(0, 120) + '…' : state.selectedText;

    // --- 修改：绑定 TTS 点击事件 ---
    document.getElementById('ai-speak-btn').onclick = speakText;

    const aiInput = document.getElementById('ai-input');
    aiInput.addEventListener('keydown', (e) => e.stopPropagation());
    document.getElementById('ai-send-btn').onclick = doCallAI;
  };

  // --- Controller: 处理朗读逻辑 ---
  function speakText() {
    const speakBtn = document.getElementById('ai-speak-btn');
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(state.selectedText);
  const voices = speechSynthesis.getVoices();

  // 核心优化：优先选择自然度高的在线语音包
  const hasChinese = /[\u4e00-\u9fa5]/.test(state.selectedText);
  if (hasChinese) {
    utterance.voice = voices.find(v => v.name.includes('Xiaoxiao') || v.name.includes('Mainland')) || voices[0];
    utterance.lang = 'zh-CN';
  } else {
    utterance.voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural')) || voices[0];
    utterance.lang = 'en-US';
  }

  // 参数微调：让声音更柔和
  utterance.rate = 0.9;  // 稍微减慢语速，听起来更清晰
  utterance.pitch = 1.0; // 音调保持自然

  utterance.onstart = () => speakBtn.classList.add('speaking');
  utterance.onend = () => speakBtn.classList.remove('speaking');
  speechSynthesis.speak(utterance);
  }

  // --- 以下逻辑保持不变 ---
  const destroyDialog = () => {
    speechSynthesis.cancel(); // 销毁弹窗时停止朗读
    if (state.dialog) { state.dialog.remove(); state.dialog = null; }
  };

  async function doCallAI() {
    const btn = document.getElementById('ai-send-btn');
    const status = document.getElementById('ai-status');
    const promptValue = document.getElementById('ai-input').value;

    btn.disabled = true;
    btn.innerText = chrome.i18n.getMessage("btnProcessing");

    chrome.storage.sync.get(['apiKey', 'customModel'], async (r) => {
      try {
        const key = r.apiKey || "sk-8oB2nv3YNSmD65j9ALs7lcsLovddCwyzRTCaiLOVIKQvqeb7";
        const model = r.customModel || "deepseek-v4-think";
        status.innerText = chrome.i18n.getMessage("statusThinking");

        const res = await fetch("https://llm.whitedream.top/v1/chat/completions", {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "developer", content: "Translation assistant. Concise." },
              { role: "user", content: `${promptValue}:\n\n${state.selectedText}` }
            ]
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Error');
        const aiResult = data.choices?.[0]?.message?.content || '';
        if (aiResult) {
          insertToNotion(aiResult);
          destroyDialog();
        }
      } catch (err) {
        status.innerText = "❌ " + err.message;
        btn.disabled = false;
        btn.innerText = chrome.i18n.getMessage("btnSend");
      }
    });
  }

  function insertToNotion(content) {
    if (!state.lastRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(state.lastRange); sel.collapseToEnd();
    const html = `<div style="border-left:3px solid #2eaadc;padding:12px;margin:10px 0;background:rgba(46,170,220,0.05);border-radius:4px;">${content.split('\n').map(l => `<p style="margin:2px 0;">${l}</p>`).join('')}</div>`;
    const dt = new DataTransfer();
    dt.setData('text/html', html); dt.setData('text/plain', content);
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }

  init();
})();