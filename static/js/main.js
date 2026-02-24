// 全局交互：根据当前路径高亮导航链接
(function () {
  try {
    const path = location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('nav a[href]').forEach((a) => {
      const href = a.getAttribute('href').replace(/\/$/, '') || '/';
      if (href === path) {
        a.classList.add('text-amber-primary', 'font-semibold');
      }
    });
  } catch (e) {
    // 静默失败以避免阻塞页面
    console.debug('main.js init skipped:', e);
  }
})();
