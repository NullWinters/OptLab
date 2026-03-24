const TOKEN_KEY = "optlab_token";
const USER_KEY = "optlab_user";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredAuth(token, user) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function clearStoredAuth() {
  setStoredAuth(null, null);
}

async function apiRequest(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getStoredToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    let message = `请求失败（状态码 ${response.status}）`;

    // 将常见英文错误提示映射为正式书面中文
    const toChinese = (s) => {
      if (!s || typeof s !== "string") return "";
      let r = s;
      r = r.replace(
        "String should have at least",
        "长度不能少于",
      );
      r = r.replace(
        "String should have at most",
        "长度不能大于",
      );
      r = r.replace("characters", "个字符");
      r = r.replace(
        "value is not a valid email address",
        "邮箱格式不正确",
      );
      r = r.replace("field required", "该字段为必填项");
      r = r.replace("Input should be at least", "输入值不能小于");
      r = r.replace("Input should be at most", "输入值不能大于");
      r = r.replace(
        "Could not validate credentials",
        "身份验证失败，请重新登录。",
      );
      r = r.replace(
        "Not authenticated",
        "未认证访问，请先登录。",
      );
      r = r.replace(
        "Incorrect email/username or password",
        "账号或密码不正确，请重新输入。",
      );
      return r;
    };

    if (data) {
      const detail = data.detail ?? data;

      if (Array.isArray(detail)) {
        // FastAPI / Pydantic 校验错误：detail 是数组
        const msgs = detail
          .map((item) => {
            if (!item) return "";
            const locArray = Array.isArray(item.loc) ? item.loc : [];

            let fieldLabel = "";
            if (locArray.includes("email")) fieldLabel = "邮箱";
            else if (locArray.includes("username")) fieldLabel = "用户名";
            else if (locArray.includes("password")) fieldLabel = "密码";
            else if (locArray.includes("confirm_password"))
              fieldLabel = "确认密码";
            else if (locArray.includes("identifier")) fieldLabel = "账号";

            const rawMsg =
              (typeof item.msg === "string" && item.msg) ||
              (typeof item.detail === "string" && item.detail) ||
              "";
            if (!rawMsg) return "";

            // 明确处理密码一致性错误，始终给出统一中文提示
            if (rawMsg.includes("Passwords do not match")) {
              return "两次输入的密码不一致";
            }

            let zh = toChinese(rawMsg);

            if (fieldLabel) {
              zh = `${fieldLabel}：${zh}`;
            }
            return zh;
          })
          .filter(Boolean);
        if (msgs.length) {
          // 冒号后换行，并在每条错误之间空一行，结构清晰
          message =
            "注册/提交信息存在以下问题：\n\n" + msgs.join("\n\n");
        }
      } else if (typeof detail === "string") {
        // 后端显式给出的 detail 文案（已经是中文时不会被破坏）
        message = toChinese(detail) || detail;
      } else if (typeof data.message === "string") {
        message = toChinese(data.message) || data.message;
      }
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function apiGet(path) {
  return apiRequest(path, { method: "GET" });
}

function apiPost(path, body) {
  return apiRequest(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function apiPatch(path, body) {
  return apiRequest(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

