// 全局交互：根据当前路径高亮导航链接 & 显示登录状态
(function () {
  const currentPath = location.pathname.replace(/\/$/, "") || "/";

  function markActiveNavLinks() {
    try {
      document.querySelectorAll("nav a[href]").forEach((a) => {
        const href = (a.getAttribute("href") || "").replace(/\/$/, "") || "/";
        if (href === currentPath) {
          a.classList.add("active");
        }
      });
    } catch (e) {
      console.debug("main.js nav highlight skipped:", e);
    }
  }

  // 先高亮一次（静态导航）
  markActiveNavLinks();

  try {
    const authContainer = document.getElementById("auth-status");
    const heroActions = document.getElementById("hero-auth-actions");
    if (!authContainer && !heroActions) return;

    function setContainerHtml(container, html) {
      if (!container) return;
      container.innerHTML = html;
      container.classList.remove("is-hidden");
      markActiveNavLinks();
    }

    function renderLoggedOut() {
      setContainerHtml(
        authContainer,
        `
        <a href="/auth/login" class="topnav-login-link">登录</a>
        <a href="/auth/register" class="topnav-register-btn">注册</a>
      `
      );
      setContainerHtml(
        heroActions,
        `
        <a href="/auth/login" class="btn btn-secondary">登录</a>
        <a href="/auth/register" class="btn btn-primary">注册</a>
      `
      );
    }

    function bindUserMenu(container, user) {
      if (!container) return;
      const uid = Math.random().toString(36).slice(2);
      setContainerHtml(
        container,
        `
        <div class="topnav-user-menu">
          <button id="auth-user-trigger-${uid}" type="button" class="topnav-user-trigger">
            <span>欢迎，<span class="topnav-user-name">${user.username}</span></span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
          </button>
          <div id="auth-user-dropdown-${uid}" class="topnav-user-dropdown is-hidden">
            <a href="/settings" class="topnav-user-dropdown-link">个人设置</a>
            <button id="logout-btn-${uid}" type="button">退出登录</button>
          </div>
        </div>
      `
      );

      const trigger = document.getElementById(`auth-user-trigger-${uid}`);
      const dropdown = document.getElementById(`auth-user-dropdown-${uid}`);
      const logoutBtn = document.getElementById(`logout-btn-${uid}`);

      if (trigger && dropdown) {
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.classList.toggle("is-hidden");
        });
        document.addEventListener("click", () => dropdown.classList.add("is-hidden"));
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

    function renderLoggedIn(user) {
      bindUserMenu(authContainer, user);
      setContainerHtml(
        heroActions,
        `
        <a href="/profile" class="btn btn-secondary">进入个人中心</a>
      `
      );
    }

    if (typeof apiGet !== "function") {
      renderLoggedOut();
      return;
    }

    let cachedUser = null;
    try {
      const raw = localStorage.getItem("optlab_user");
      if (raw) cachedUser = JSON.parse(raw);
    } catch {
      cachedUser = null;
    }

    if (cachedUser) renderLoggedIn(cachedUser);
    else renderLoggedOut();

    apiGet("/auth/me")
      .then((user) => {
        try {
          localStorage.setItem("optlab_user", JSON.stringify(user));
        } catch {}
        renderLoggedIn(user);
      })
      .catch(() => {
        if (typeof clearStoredAuth === "function") {
          clearStoredAuth();
        }
        renderLoggedOut();
      });
  } catch (e) {
    console.debug("main.js auth init skipped:", e);
  }
})();
