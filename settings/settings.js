document.addEventListener('DOMContentLoaded', () => {
  // 1. 自动国际化渲染 (i18n)
  const renderI18n = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(key);
      if (msg) el.innerText = msg;
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      const attrData = el.getAttribute('data-i18n-attr');
      if (attrData && attrData.includes('|')) {
        const [attr, key] = attrData.split('|');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.setAttribute(attr, msg);
      }
    });
  };

  renderI18n();

  // 2. 初始化回显设置
  chrome.storage.sync.get(['apiKey', 'customModel', 'defaultPrompt'], r => {
    if (r.apiKey) document.getElementById('apiKey').value = r.apiKey;
    if (r.customModel) document.getElementById('customModel').value = r.customModel;
    
    if (r.defaultPrompt) {
      document.getElementById('defaultPrompt').value = r.defaultPrompt;
    } else {
      const i18nDefaultPrompt = chrome.i18n.getMessage("defaultPromptValue"); 
      document.getElementById('defaultPrompt').value = i18nDefaultPrompt || "翻译并列出重点词汇";
    }
  });

  // 3. 动态黑名单逻辑（解决生效延迟与刷新问题）
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const hostEl = document.getElementById('currentHost');
    const toggle = document.getElementById('blacklistToggle');
    const currentTabId = tabs[0]?.id;

    if (tabs[0] && tabs[0].url) {
      try {
        const url = new URL(tabs[0].url);
        
        if (url.protocol.startsWith('http')) {
          const host = url.hostname;
          if (hostEl) hostEl.innerText = host;

          chrome.storage.sync.get(['blacklist'], (res) => {
            const blacklist = res.blacklist || [];
            if (toggle) toggle.checked = blacklist.includes(host);
          });

          // 核心改进：开关切换时实时通知
          toggle.onchange = (e) => {
            const isEnabled = e.target.checked;
            chrome.storage.sync.get(['blacklist'], (res) => {
              let list = res.blacklist || [];
              if (isEnabled) {
                if (!list.includes(host)) list.push(host);
              } else {
                list = list.filter(i => i !== host);
              }
              
              // 1. 保存到存储
              chrome.storage.sync.set({ blacklist: list }, () => {
                // 2. 核心补丁：主动向当前网页发送信号，无需刷新即刻生效
                if (currentTabId) {
                  chrome.tabs.sendMessage(currentTabId, { 
                    type: "BLACKLIST_UPDATED", 
                    isBlocked: isEnabled 
                  }).catch(err => console.log("静默处理：页面未注入脚本或未刷新"));
                }
              });
            });
          };
        } else {
          if (hostEl) hostEl.innerText = chrome.i18n.getMessage("statusSystemPage") || "System Page";
          if (toggle) toggle.disabled = true;
        }
      } catch (err) {
        if (hostEl) hostEl.innerText = "URL Error";
      }
    }
  });

  // 4. 保存按钮逻辑
  document.getElementById('saveBtn').onclick = () => {
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('customModel').value.trim();
    const prompt = document.getElementById('defaultPrompt').value.trim();
    
    chrome.storage.sync.set({ apiKey: key, customModel: model, defaultPrompt: prompt }, () => {
      const msg = document.getElementById('saved');
      if (msg) {
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 2000);
      }
    });
  };
});