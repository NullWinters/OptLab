// 全局交互：根据当前路径高亮导航链接 & 显示登录状态
(function () {
  try {
    const path = location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll("nav a[href]").forEach((a) => {
      const href = a.getAttribute("href").replace(/\/$/, "") || "/";
      if (href === path) {
        a.classList.add("text-amber-primary", "font-semibold");
      }
    });
  } catch (e) {
    // 静默失败
    console.debug("main.js nav init skipped:", e);
  }

  // 登录状态渲染
  try {
    const authContainer = document.getElementById("auth-status");
    if (!authContainer) return;

    function renderLoggedOut() {
      authContainer.innerHTML = `
        <a href="/auth/login" class="hover:text-amber-primary transition">登录</a>
        <a href="/auth/register" class="bg-amber-primary text-white px-4 py-2 rounded-full text-sm font-semibold shadow hover:bg-amber-700 transition">注册</a>
      `;
    }

    function renderLoggedIn(user) {
      authContainer.innerHTML = `
        <div class="relative">
          <button id="auth-user-trigger" type="button" class="flex items-center gap-1 text-sm text-gray-700 hover:text-amber-primary transition focus:outline-none">
            <span>欢迎，<span class="font-semibold">${user.username}</span></span>
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
          <div id="auth-user-dropdown" class="hidden absolute right-0 mt-1 py-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
            <button id="logout-btn" type="button" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-primary">退出登录</button>
          </div>
        </div>
      `;
      const trigger = document.getElementById("auth-user-trigger");
      const dropdown = document.getElementById("auth-user-dropdown");
      const logoutBtn = document.getElementById("logout-btn");
      if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.classList.toggle("hidden");
        });
        document.addEventListener("click", () => dropdown.classList.add("hidden"));
      }
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
          if (typeof clearStoredAuth === "function") {
            clearStoredAuth();
          }
          location.href = "/";
        });
      }
    }

    // 如果 api.js 不存在，则只显示未登录状态入口
    if (typeof apiGet !== "function") {
      renderLoggedOut();
      return;
    }

    // 优先使用本地缓存用户信息，随后尝试向后端校验
    let cachedUser = null;
    try {
      const raw = localStorage.getItem("optlab_user");
      if (raw) {
        cachedUser = JSON.parse(raw);
      }
    } catch {
      cachedUser = null;
    }

    if (cachedUser) {
      renderLoggedIn(cachedUser);
    } else {
      renderLoggedOut();
    }

    // 后台刷新当前用户信息（如果有 token）
    apiGet("/auth/me")
      .then((user) => {
        try {
          localStorage.setItem("optlab_user", JSON.stringify(user));
        } catch {
          // ignore
        }
        renderLoggedIn(user);
      })
      .catch(() => {
        // token 无效则清理
        if (typeof clearStoredAuth === "function") {
          clearStoredAuth();
        }
        renderLoggedOut();
      });
  } catch (e) {
    console.debug("main.js auth init skipped:", e);
  }
})();

