# OptLab 后端技术手册（认证 · 数据持久化 · AI 集成）

> 面向：需要在自有项目中对接 OptLab、或基于用户实验数据做 AI 分析与迭代的研究/工程合作者。  
> 版本：与仓库代码一致；若接口有变，以 `routers/`、`schemas/`、`models/` 为准。

**相关文档**：[`OPTLAB_DATABASE_GUIDE.md`](./OPTLAB_DATABASE_GUIDE.md) — 数据库连接、建表、表结构字段说明、事务与 JSON 列、SQLite 操作、备份与扩展表流程。

---

## 1. 文档目的

本手册说明 OptLab **后端**的：

- **登录与注册**、**JWT 身份验证**机制；
- **SQLite / 可切换数据库**与核心**表结构**；
- **实验笔记、实验记录、AI 助手、AI 生成笔记**等接口的职责边界；
- 前端（浏览器）如何存储 Token 与调用受保护接口；
- 合作者扩展「从用户数据学习 / 迭代」时的**推荐接入方式**与**合规注意**。

---

## 2. 技术栈速览

| 组件 | 说明 |
|------|------|
| 框架 | FastAPI（异步） |
| ORM | SQLAlchemy 2.x，`AsyncSession` |
| 数据库 | 默认 `sqlite+aiosqlite`（`optlab.db`），可通过环境变量换 PostgreSQL 等 |
| 密码 | `pwdlib`（Argon2 等推荐算法） |
| 令牌 | JWT（`python-jose`，算法 `HS256`） |
| AI | DeepSeek（`langchain-deepseek`），见 `settings` 与 `core/` |

入口：`main.py` 挂载静态资源、注册路由：`/auth`、`/experiments`、`/notes`、`/api/assistant`。

---

## 3. 环境变量（`.env`，勿提交仓库）

项目根目录 `.env` 由 `settings/__init__.py` 加载（**已被 `.gitignore` 忽略**）。

| 变量 | 含义 | 默认 |
|------|------|------|
| `OPTLAB_DB_URI` | 异步 SQLAlchemy 连接串 | `sqlite+aiosqlite:///./optlab.db` |
| `OPTLAB_SECRET_KEY` | JWT 签名密钥 | `CHANGE_ME_TO_A_SECURE_RANDOM_KEY`（生产必须改） |
| `OPTLAB_ACCESS_TOKEN_MINUTES` | Access Token 有效期（分钟） | `30` |
| `DEEPSEEK_API_KEY` | 大模型 API Key | 占位符（真实调用前必须配置） |
| `DEEPSEEK_MODEL` | 模型名 | `deepseek-chat` |
| `DEEPSEEK_TEMPERATURE` | 温度 | `0.7`（助手）；笔记生成在代码中另有覆盖 |

**生产环境**：务必设置足够长的随机 `OPTLAB_SECRET_KEY`，并限制 `.env` 文件权限。

---

## 4. 数据库初始化

```bash
# 项目根目录，激活虚拟环境后
python scripts/init_db.py
```

作用：根据 `models/` 中 `Base.metadata` **创建表**（无 Alembic 迁移文件时，以代码模型为准）。

**默认库文件**：`optlab.db`（同样在 `.gitignore` 中，不随 Git 上传）。

---

## 5. 核心表与关系（逻辑 ER）

### 5.1 `user`

| 字段 | 说明 |
|------|------|
| `id` | 主键 |
| `email` | 唯一 |
| `username` | 展示名（注册时唯一性在业务层检查） |
| `_password` | 密码哈希（通过模型 `password` 赋值器写入） |

删除用户时，关联数据通过 `ondelete="CASCADE"` 级联删除（见各子表外键）。

### 5.2 `experiment_note`（偏「单条笔记 + JSON 扩展」）

- `user_id` + `experiment_key` 维度；
- `reflection`：长文本感想；
- `extra_data`：可选 JSON（如分题答案）。

**接口前缀**：`/experiments/notes/...`（见下）。

### 5.3 `experiment_record`（个人中心「保存的实验运行结果」）

- `alias`：用户起的别名；
- `source_page`：页面/实验标识字符串（如 `line-search.range_search.observation`）；
- `payload`：**JSON**，存算法名、函数、迭代日志、初始参数等（结构由前端约定）。

**接口前缀**：`/experiments/records`。

### 5.4 `note_item`（某实验下**多条**笔记条目）

- 支持同一 `experiment_key` 下多条 `title` + `content`；
- 与 `experiment_note` 并存：业务上前者更偏「结构化多条 + 导出」，后者偏「单条 reflection + extra」；合作者接入时以实际调用的 API 为准。

**接口前缀**：`/notes`。

---

## 6. 认证流程详解

### 6.1 注册 `POST /auth/register`

**请求体（JSON）**：

- `email`：合法邮箱；
- `username`：长度 3～50（见 `settings.REGISTER_USERNAME`）；
- `password` / `confirm_password`：8～50 字符，且须一致。

**成功**：`201`，返回 `UserSchema`（`id, email, username`），**无 Token**（需再登录）。

**常见错误**：`400`，邮箱或用户名已存在（中文 `detail`）。

### 6.2 登录 `POST /auth/login`

**请求体（JSON）**：

- `identifier`：**邮箱或用户名**（后端用是否含 `@` 区分）；
- `password`。

**成功**：`200`，返回：

```json
{
  "user": { "id": 1, "email": "...", "username": "..." },
  "token": "<JWT>"
}
```

**失败**：`401`，`detail` 为「账号或密码不正确…」。

**注意**：代码里 `OAuth2PasswordBearer(tokenUrl="/auth/login")` 仅用于 OpenAPI/依赖注入约定；**实际登录是 JSON**，不是 OAuth2 的 `application/x-www-form-urlencoded`。在 Swagger UI 中需自行用「Authorize」粘贴 Bearer Token，或使用 `/auth/login` 拿到 token 后填入。

### 6.3 JWT 内容

- `sub`：用户 ID 的**字符串**；
- `email`：用户邮箱；
- `exp`：过期时间（UTC）。

签发：`core/auth.create_access_token`，过期时间 `ACCESS_TOKEN_EXPIRE_DELTA`。

### 6.4 获取当前用户 `GET /auth/me`

**请求头**：`Authorization: Bearer <token>`

**成功**：`200`，`UserSchema`。

**失败**：`401`（无效、过期、用户不存在等，文案为中文「身份验证失败，请重新登录。」）。

### 6.5 依赖项 `get_current_user`

所有标注 `Depends(get_current_user)` 的路由均需有效 Bearer Token；否则 **401**。

---

## 7. 前端约定（合作者做 Web 对接时必看）

文件：`static/js/api.js`

- Token：`localStorage` 键名 **`optlab_token`**；
- 用户信息：`optlab_user`（JSON 字符串）；
- 任意 `apiRequest` 若存在 token，自动加头：`Authorization: Bearer ...`。

合作者自研前端时，只要保持**相同键名与 Header 格式**，即可与现有后端兼容。

---

## 8. 实验相关 API 摘要

### 8.1 实验感想（单条 + extra）`/experiments/notes/{experiment_key}`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/experiments/notes/{experiment_key}` | 是 | 获取当前用户该实验笔记 |
| PUT | `/experiments/notes/{experiment_key}` | 是 | 创建或更新（body：`reflection`, `extra_data`） |
| GET | `/experiments/notes/{experiment_key}/export` | 是 | 下载 Markdown 报告 |

### 8.2 实验记录（个人中心快照）`/experiments/records`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/experiments/records` | 是 | 新建记录（`alias`, `source_page`, `payload`） |
| GET | `/experiments/records` | 是 | 当前用户列表 |
| GET | `/experiments/records/{record_id}` | 是 | 详情（含完整 `payload`） |
| PATCH | `/experiments/records/{record_id}` | 是 | 仅更新 `alias` |
| DELETE | `/experiments/records/{record_id}` | 是 | 删除 |
| GET | `/experiments/records/{record_id}/export` | 是 | CSV 导出（摘要 + 迭代表或 key-value） |

`payload` 为 **灵活 JSON**：导出逻辑会识别 `iteration_data` / `iterationLog`、`test_function` / `function`、`initial_state` 等字段（见 `routers/experiments.py`）。

### 8.3 多条笔记 `note_item` `/notes/...`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/notes/{experiment_key}` | 是 | 列表 |
| POST | `/notes/{experiment_key}` | 是 | 新建（`title`, `content`, `sort_order`） |
| PUT | `/notes/item/{item_id}` | 是 | 更新 |
| DELETE | `/notes/item/{item_id}` | 是 | 删除 |
| GET | `/notes/{experiment_key}/export` | 是 | 合并导出 Markdown |
| POST | `/notes/{experiment_key}/ai-generate` | 是 | **AI 根据 body 生成一条笔记并落库** |

`NoteItemCreate/Update` 对文本做了 **HTML 转义**，降低存储型 XSS 风险；内容仍可含 LaTeX/Markdown 文本。

---

## 9. AI 能力（两条线）

### 9.1 页面助手 `POST /api/assistant/chat`

- **无需登录**（当前实现未接 `get_current_user`）。
- 请求体：`AssistantRequest`（`message`, `page_id`, `guidebook`, `buttons[]`）。
- 返回：结构化结果（`text` + `highlight_ids`），用于高亮页面控件。
- 服务端：`core/agent.py` 使用 DeepSeek + 部分 `page_id` 映射到 `docs/` 下静态说明文件。

**合作者注意**：若要对助手也做审计或限流，需自行加中间件或依赖。

### 9.2 AI 生成实验笔记 `POST /notes/{experiment_key}/ai-generate`

- **需要登录**。
- Body：任意 **JSON 对象**（字典），通常包含：
  - 实验参数、迭代摘要字段；
  - `iteration_log`：迭代数组；
  - `_behavior`：行为追踪（`events`, `session_duration_s` 等，见 `core/note_generator.py`）。

流程：`core/note_generator.generate_experiment_note` 调用 LLM → 写入 `note_item`。

**合作者做「用用户数据训练/迭代」**：  
- 合规前提下，可对 **`experiment_record.payload`**、**导出 API**、或**服务端批量脚本**读库做离线分析；  
- 本仓库**未内置**向量库、联邦学习或自动训练管道，需在独立服务中实现。

---

## 10. 合作者扩展：基于用户数据的「迭代/学习」建议架构

1. **数据出口**（推荐）  
   - 用户授权后，用 **`GET /experiments/records`**、**`GET /experiments/records/{id}`** 拉取 JSON；  
   - 或使用服务器侧只读连接只读库（注意隔离与安全）。

2. **特征与标注**  
   - `source_page` + `payload` 内算法/函数/迭代可构造特征；  
   - `note_item` / `experiment_note` 可作为文本监督信号。

3. **与 OptLab 解耦**  
   - 将「模型训练 / RAG 索引 / 报表」放在**独立微服务**，通过 API 或消息队列与本项目同步，避免直接改核心路由。

4. **隐私与合规**  
   - 用户数据属个人；对外共享或用于训练前需**明示同意**与**脱敏**策略。

---

## 11. 安全清单（简）

- 生产必须更换 `OPTLAB_SECRET_KEY`；HTTPS 部署；限制 CORS（若前后端分离需配置）。
- JWT 为 **Bearer**，注意 XSS 窃取 `localStorage` 的风险（CSP、HttpOnly Cookie 迁移等属进阶改造）。
- AI Key 仅存环境变量，勿写入前端或 Git。

---

## 12. 常见问题

**Q：`tokenUrl=/auth/login` 与 JSON 登录不一致？**  
A：历史原因与 OpenAPI 展示；客户端以 **JSON POST + Bearer** 为准。

**Q：为何有两套笔记（experiment_note vs note_item）？**  
A：演进产物；新功能多集中在 `note_item` 与 AI 生成；对接前确认前端实际调用的路径。

**Q：Python 版本？**  
A：`pyproject.toml` 声明 `requires-python >= 3.13`，部署时请使用匹配版本。

---

## 13. 相关文件索引

| 模块 | 路径 |
|------|------|
| 路由 | `routers/auth.py`, `experiments.py`, `notes.py`, `agent.py` |
| JWT / 用户依赖 | `core/auth.py` |
| 用户模型与仓库 | `models/user.py`, `repository/user_repo.py` |
| 会话 | `dependencies.py`, `models/__init__.py` |
| 配置 | `settings/__init__.py` |
| AI 助手 | `core/agent.py` |
| AI 笔记 | `core/note_generator.py` |

---

## 14. 数据库层（教程索引）

完整内容见 **[`OPTLAB_DATABASE_GUIDE.md`](./OPTLAB_DATABASE_GUIDE.md)**，主要包括：

- 异步引擎与 `AsyncSession` 生命周期、`OPTLAB_DB_URI`（SQLite / PostgreSQL）；
- `scripts/init_db.py` 建表与模型注册约定；
- 四张表字段级说明、外键级联、JSON 列与 `payload` 约定字段；
- 仓库层事务模式、`sqlite3` 命令行查看、备份与迁移注意；
- 合作者新增表/字段的步骤。

---

*文档结束。*
