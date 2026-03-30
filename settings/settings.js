document.addEventListener('DOMContentLoaded', () => {
  // --- 1. 国际化初始化 (Controller 填充 View) ---
  
  // 自动翻译所有带有 data-i18n 属性的文字内容
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) {
      el.innerText = message;
    }
  });

  // 自动翻译所有带有 data-i18n-attr 属性的标签属性 (如 placeholder)
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const attrData = el.getAttribute('data-i18n-attr').split('|');
    if (attrData.length === 2) {
      const attrName = attrData[0]; // 例如 'placeholder'
      const msgKey = attrData[1];   // 例如 'placeholderKey'
      const message = chrome.i18n.getMessage(msgKey);
      if (message) {
        el.setAttribute(attrName, message);
      }
    }
  });

  // --- 2. 核心业务逻辑 (保持你原来的逻辑不变) ---

  // 从 Model (chrome.storage) 读取配置并回显
  chrome.storage.sync.get(['apiKey', 'customModel'], r => {
    if (r.apiKey) {
      document.getElementById('apiKey').value = r.apiKey;
    }
    if (r.customModel) {
      document.getElementById('customModel').value = r.customModel;
    }
  });

  // 处理保存按钮点击事件
  document.getElementById('saveBtn').onclick = () => {
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('customModel').value.trim();
    
    // 将数据存入 Model
    chrome.storage.sync.set({ apiKey: key, customModel: model }, () => {
      // 显示保存成功提示
      const msg = document.getElementById('saved');
      if (msg) {
        msg.classList.add('show');
        // 2秒后自动隐藏提示
        setTimeout(() => msg.classList.remove('show'), 2000);
      }
    });
  };
});