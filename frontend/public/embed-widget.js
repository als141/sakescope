/**
 * Sakescope Voice Widget Embed Script
 *
 * Usage:
 * <script src="https://your-domain.com/embed-widget.js" data-sakescope-host="https://your-domain.com"></script>
 */

(function() {
  'use strict';

  // Configuration
  const scriptTag = document.currentScript;
  const host = scriptTag?.getAttribute('data-sakescope-host') || 'http://localhost:3000';
  const position = scriptTag?.getAttribute('data-position') || 'bottom-right'; // bottom-right, bottom-left
  const theme = scriptTag?.getAttribute('data-theme') || 'gradient'; // gradient, solid

  // Widget state
  let isOpen = false;
  let widget = null;
  let toggleBtn = null;

  // Create widget container
  function createWidget() {
    const container = document.createElement('div');
    container.id = 'sakescope-widget';
    container.style.cssText = `
      position: fixed;
      ${position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;'}
      ${position.includes('right') ? 'right: 22px;' : 'left: 22px;'}
      width: 400px;
      height: 600px;
      max-width: calc(100vw - 44px);
      max-height: calc(100vh - 120px);
      border: 2px solid #0a6bff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      background: white;
      overflow: hidden;
      z-index: 999999;
      display: none;
      transition: transform 0.3s ease, opacity 0.3s ease;
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'sakescope-iframe';
    iframe.src = `${host}/embed/voice?mode=widget`;
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
    iframe.setAttribute('allow', 'microphone');

    container.appendChild(iframe);
    document.body.appendChild(container);

    return container;
  }

  // Create toggle button
  function createToggleButton() {
    const button = document.createElement('button');
    button.id = 'sakescope-toggle';
    button.setAttribute('aria-label', 'Sakescopeを開く');

    const bgStyle = theme === 'gradient'
      ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'
      : 'background: #667eea;';

    button.style.cssText = `
      position: fixed;
      ${position.includes('right') ? 'right: 22px;' : 'left: 22px;'}
      ${position.includes('bottom') ? 'bottom: 22px;' : 'top: 22px;'}
      width: 60px;
      height: 60px;
      border-radius: 50%;
      ${bgStyle}
      color: #fff;
      border: none;
      display: grid;
      place-items: center;
      font-weight: 900;
      font-size: 24px;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      z-index: 1000000;
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    button.textContent = '🎤';

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    button.addEventListener('click', toggleWidget);

    document.body.appendChild(button);
    return button;
  }

  // Toggle widget visibility
  function toggleWidget() {
    isOpen = !isOpen;

    if (widget) {
      widget.style.display = isOpen ? 'block' : 'none';
      if (isOpen) {
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(10px)';
        setTimeout(() => {
          widget.style.opacity = '1';
          widget.style.transform = 'translateY(0)';
        }, 10);
      }
    }

    if (toggleBtn) {
      toggleBtn.textContent = isOpen ? '✕' : '🎤';
      toggleBtn.setAttribute('aria-label', isOpen ? 'Sakescopeを閉じる' : 'Sakescopeを開く');
    }
  }

  // Listen for messages from iframe
  function setupMessageListener() {
    window.addEventListener('message', (event) => {
      // Security: validate origin in production
      // if (event.origin !== host) return;

      const { type, data } = event.data;

      // Dispatch custom events for the parent site to listen
      switch (type) {
        case 'sakescope:sakeRecommended':
          window.dispatchEvent(new CustomEvent('sakescope:sakeRecommended', {
            detail: event.data
          }));
          console.log('[Sakescope] Sake recommended:', event.data.sake);
          break;

        case 'sakescope:shopClick':
          window.dispatchEvent(new CustomEvent('sakescope:shopClick', {
            detail: event.data
          }));
          console.log('[Sakescope] Shop clicked:', event.data.sake, event.data.shop);
          break;

        case 'sakescope:connectionChange':
          window.dispatchEvent(new CustomEvent('sakescope:connectionChange', {
            detail: event.data
          }));
          console.log('[Sakescope] Connection status:', event.data.connected);
          break;
      }
    });
  }

  // Initialize widget
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    console.log('[Sakescope] Initializing widget...');

    widget = createWidget();
    toggleBtn = createToggleButton();
    setupMessageListener();

    console.log('[Sakescope] Widget initialized successfully');
  }

  // Auto-initialize
  init();

  // Expose API
  window.Sakescope = {
    open: () => {
      if (!isOpen) toggleWidget();
    },
    close: () => {
      if (isOpen) toggleWidget();
    },
    toggle: toggleWidget,
    isOpen: () => isOpen
  };
})();
