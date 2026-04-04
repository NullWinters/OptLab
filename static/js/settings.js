function setMsg(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-hidden", !msg);
    el.classList.toggle("is-visible", !!msg);
    if (msg) {
        el.classList.toggle("is-error", !ok);
        el.classList.toggle("is-success", !!ok);
    } else {
        el.classList.remove("is-error", "is-success");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const usernameForm = document.getElementById("username-form");
    const passwordForm = document.getElementById("password-form");
    const usernameInput = document.getElementById("new-username");

    const usernameErr = document.getElementById("username-error");
    const usernameOk = document.getElementById("username-success");
    const passwordErr = document.getElementById("password-error");
    const passwordOk = document.getElementById("password-success");

    if (!getStoredToken || !getStoredToken()) {
        location.href = "/auth/login";
        return;
    }

    try {
        const me = await apiGet("/auth/me");
        if (usernameInput && me && me.username) usernameInput.value = me.username;
    } catch {
        location.href = "/auth/login";
        return;
    }

    usernameForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg(usernameErr, "", false);
        setMsg(usernameOk, "", true);
        const username = (usernameInput?.value || "").trim();
        if (!username) {
            setMsg(usernameErr, "请输入新用户名", false);
            return;
        }
        try {
            const user = await apiPatch("/auth/username", {username});
            const token = getStoredToken();
            setStoredAuth(token, user);
            setMsg(usernameOk, "用户名修改成功", true);
        } catch (err) {
            setMsg(usernameErr, err?.message || "修改用户名失败", false);
        }
    });

    passwordForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        setMsg(passwordErr, "", false);
        setMsg(passwordOk, "", true);

        const current_password = document.getElementById("current-password")?.value || "";
        const new_password = document.getElementById("new-password")?.value || "";
        const confirm_password = document.getElementById("confirm-password")?.value || "";

        if (!current_password || !new_password || !confirm_password) {
            setMsg(passwordErr, "请完整填写密码字段", false);
            return;
        }

        try {
            const res = await apiPatch("/auth/password", {
                current_password,
                new_password,
                confirm_password,
            });
            setMsg(passwordOk, res?.message || "密码修改成功，请重新登录", true);
            clearStoredAuth();
            setTimeout(() => {
                location.href = "/auth/login";
            }, 1000);
        } catch (err) {
            setMsg(passwordErr, err?.message || "修改密码失败", false);
        }
    });
});
