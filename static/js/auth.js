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
    errorBox.innerHTML = "";
    errorBox.classList.add("hidden");
  }

  if (!identifier || !password) {
    if (errorBox) {
      errorBox.textContent = "请输入账号和密码";
      errorBox.classList.remove("hidden");
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
      errorBox.innerHTML = msg.replace(/\n/g, "<br>");
      errorBox.classList.remove("hidden");
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
    errorBox.innerHTML = "";
    errorBox.classList.add("hidden");
  }
  if (successBox) {
    successBox.innerHTML = "";
    successBox.classList.add("hidden");
  }

  if (!email || !username || !password || !confirmPassword) {
    if (errorBox) {
      errorBox.textContent = "请完整填写所有字段";
      errorBox.classList.remove("hidden");
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
      successBox.textContent = "注册成功，请前往登录";
      successBox.classList.remove("hidden");
    }
    setTimeout(() => {
      window.location.href = "/auth/login";
    }, 1000);
  } catch (err) {
    if (errorBox) {
      const msg = getErrorMessage(err, "注册失败，请稍后重试");
      errorBox.innerHTML = msg.replace(/\n/g, "<br>");
      errorBox.classList.remove("hidden");
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

