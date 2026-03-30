document.addEventListener('DOMContentLoaded', () => {
  // 1. 自动国际化渲染
  const renderI18n = () => {
    // 渲染普通文字
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(key);
      if (msg) el.innerText = msg;
    });

    // 渲染属性（如 input 的 placeholder）
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

  // 2. 初始化回显设置（含提示词国际化）
  chrome.storage.sync.get(['apiKey', 'customModel', 'defaultPrompt'], r => {
    if (r.apiKey) document.getElementById('apiKey').value = r.apiKey;
    if (r.customModel) document.getElementById('customModel').value = r.customModel;
    
    // 优先级逻辑：
    // 1. 优先使用用户在设置页手动修改并保存过的 prompt
    // 2. 其次使用当前浏览器语言包 (messages.json) 里的默认 prompt
    // 3. 最后使用一个硬编码的兜底字符串
    if (r.defaultPrompt) {
      document.getElementById('defaultPrompt').value = r.defaultPrompt;
    } else {
      const i18nDefaultPrompt = chrome.i18n.getMessage("defaultPromptValue"); 
      document.getElementById('defaultPrompt').value = i18nDefaultPrompt || "翻译并解析重点词汇";
    }
  });

  // 3. 保存按钮逻辑
  document.getElementById('saveBtn').onclick = () => {
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('customModel').value.trim();
    const prompt = document.getElementById('defaultPrompt').value.trim();
    
    chrome.storage.sync.set({ 
      apiKey: key, 
      customModel: model, 
      defaultPrompt: prompt 
    }, () => {
      const msg = document.getElementById('saved');
      if (msg) {
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 2000);
      }
    });
  };
});