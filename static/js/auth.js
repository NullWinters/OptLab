function setAlert(el, msg, ok) {
  if (!el) return;
  el.innerHTML = msg || "";
  el.classList.toggle("is-visible", !!msg);
  el.classList.toggle("is-hidden", !msg);
  if (msg) {
    el.classList.toggle("is-error", !ok);
    el.classList.toggle("is-success", !!ok);
  } else {
    el.classList.remove("is-error", "is-success");
  }
}

function getErrorMessage(err, defaultMessage) {
  if (!err) return defaultMessage;
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  return defaultMessage;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const identifier =
    form.querySelector('input[name="identifier"]')?.value || "";
  const password =
    form.querySelector('input[name="password"]')?.value || "";
  const errorBox = document.getElementById("auth-error");

  if (errorBox) {
    setAlert(errorBox, "", false);
  }

  if (!identifier || !password) {
    if (errorBox) {
      setAlert(errorBox, "请输入账号和密码", false);
    }
    return;
  }

  try {
    const data = await apiPost("/auth/login", { identifier, password });
    if (data && data.token && data.user) {
      setStoredAuth(data.token, data.user);
      window.location.href = "/";
    } else {
      throw new Error("登录失败，请稍后重试");
    }
  } catch (err) {
    if (errorBox) {
      const msg = getErrorMessage(err, "登录失败，请检查账号和密码");
      setAlert(errorBox, msg.replace(/\n/g, "<br>"), false);
    }
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.querySelector('input[name="email"]')?.value || "";
  const username =
    form.querySelector('input[name="username"]')?.value || "";
  const password =
    form.querySelector('input[name="password"]')?.value || "";
  const confirmPassword =
    form.querySelector('input[name="confirm_password"]')?.value || "";
  const errorBox = document.getElementById("auth-error");
  const successBox = document.getElementById("auth-success");

  if (errorBox) {
    setAlert(errorBox, "", false);
  }
  if (successBox) {
    setAlert(successBox, "", true);
  }

  if (!email || !username || !password || !confirmPassword) {
    if (errorBox) {
      setAlert(errorBox, "请完整填写所有字段", false);
    }
    return;
  }

  try {
    await apiPost("/auth/register", {
      email,
      username,
      password,
      confirm_password: confirmPassword,
    });
    if (successBox) {
      setAlert(successBox, "注册成功，请前往登录", true);
    }
    setTimeout(() => {
      window.location.href = "/auth/login";
    }, 1000);
  } catch (err) {
    if (errorBox) {
      const msg = getErrorMessage(err, "注册失败，请稍后重试");
      setAlert(errorBox, msg.replace(/\n/g, "<br>"), false);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }
});

