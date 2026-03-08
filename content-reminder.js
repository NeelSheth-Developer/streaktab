/**
 * StreakTab - Content script for reminder popup on web pages
 * Uses Shadow DOM popup — Chrome 92+ blocks iframe.contentWindow.alert() from cross-origin iframes.
 */
(function () {
  function showShadowDomPopup(text) {
    const t = String(text || 'Reminder');
    const host = document.createElement('div');
    host.id = 'streaktab-reminder-root';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:auto';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .modal {
          background: #fff;
          padding: 20px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.3);
          max-width: 90vw;
          max-height: 80vh;
          overflow: auto;
        }
        .text { font-size: 16px; color: #333; margin-bottom: 16px; white-space: pre-wrap; }
        .btn {
          display: block;
          width: 100%;
          padding: 10px 16px;
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }
        .btn:hover { background: #1d4ed8; }
      </style>
      <div class="overlay">
        <div class="modal">
          <div class="text"></div>
          <button class="btn">OK</button>
        </div>
      </div>
    `;

    const textEl = shadow.querySelector('.text');
    textEl.textContent = t;

    const dismiss = () => {
      host.remove();
      chrome.runtime.sendMessage({ type: 'REMINDER_POPUP_DISMISSED' }).catch(() => {});
    };

    shadow.querySelector('.btn').addEventListener('click', dismiss);
    shadow.querySelector('.overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('overlay')) dismiss();
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SHOW_REMINDER_POPUP') {
      showShadowDomPopup(msg.text);
    }
  });
})();
