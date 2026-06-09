# AGENTS.md — OptLab 代码库指南

> 最优化实验室 (OptLab) — 基于 Web 的交互式最优化算法教学实验平台。

## 项目概览

- **类型**：全栈 Web 应用（FastAPI + Jinja2 + 原生 JavaScript）
- **Python**：3.13+
- **数据库**：SQLite（开发）/ PostgreSQL（生产），异步驱动（SQLAlchemy 2.0 + aiosqlite/asyncpg）
- **认证**：JWT（python-jose），OAuth2PasswordBearer
- **AI**：LangChain + DeepSeek（langchain-deepseek）
- **定时任务**：APScheduler（AsyncIOScheduler），每日凌晨清理过期消息
- **前端**：HTML 模板（Jinja2）、CSS、ES6+ JavaScript、D3.js v7、Three.js、Math.js、MathJax
- **包管理**：uv（通过 `pyproject.toml`）

## 启动方式

```bash
# 一键启动 — 创建虚拟环境、安装依赖、初始化数据库、启动 uvicorn（端口 8001）
python scripts/launch.py

# 或手动操作：
python scripts/init_db.py          # 初始化/迁移数据库
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

项目未配置测试框架（`tests/` 目录已在 `.gitignore` 中排除，`.pytest_cache/` 也被忽略）。

## 架构

### 后端分层结构

```
routers/    →  core/  →  repository/  →  models/
(API 路由)     (业务逻辑)   (CRUD)          (SQLAlchemy ORM)
               schemas/
               (Pydantic 数据验证)
```

### 核心模块说明

| 模块 | 职责 |
|---|---|
| `main.py` | FastAPI 应用初始化、静态文件挂载、Jinja2 模板渲染 |
| `dependencies.py` | `get_session()` — 每个请求创建并关闭的异步数据库会话 |
| `settings/__init__.py` | 从 `.env` 加载所有配置（数据库 URI、JWT 密钥、DeepSeek API Key、聊天历史窗口） |
| `core/auth.py` | JWT 创建/解析，`get_current_user()` 依赖注入 |
| `core/agent.py` | LangChain Agent + `ask_assistant()` — 调用 DeepSeek 结构化输出 |
| `core/chat_service.py` | 滑动窗口会话记忆（WINDOW_MESSAGES = CHAT_HISTORY_WINDOW_ROUNDS × 2） |
| `core/note_generator.py` | LLM 生成实验笔记，含截断逻辑 + 结构化输出调用 |
| `core/scheduler.py` | APScheduler cron 任务 — 每天凌晨 3 点清理过期非活跃消息 |
| `repository/*.py` | 异步 SQLAlchemy CRUD — 均使用 `async with session.begin():` 模式 |
| `models/__init__.py` | 引擎/会话工厂初始化；连接池参数仅在 PostgreSQL 下启用（pool_size, max_overflow 等） |
| `routers/agent.py` | `/api/assistant/*` — 聊天会话 + 带上下文历史的 AI 助手 |

### 数据库模式

- 所有模型继承 `models/__init__.py` 中的 `Base`（DeclarativeBase）
- 引擎为异步：`create_async_engine(DB_URI, ...)`
- 会话：`sessionmaker(bind=engine, class_=AsyncSession, autoflush=True, expire_on_commit=False)`
- 每个 repository 方法用 `async with session.begin():` 开启事务
- 软删除：`is_active=False` + `deleted_at=datetime.now()`（chat_session、chat_message 无硬删除）
- `init_db.py` 在 `Base.metadata.create_all` 后通过原生 SQL 创建索引，含 `text_blocks` 列迁移

### 密码哈希

使用 `pwdlib.PasswordHash`（Argon2）—— `User.password` 是属性 setter，赋值时自动哈希。

### 认证流程

1. 登录 → `POST /auth/login` → 返回 JWT（payload 含 `{sub: user_id, email: user_email}`）
2. `OAuth2PasswordBearer(tokenUrl="/auth/login")` 提取 Bearer Token
3. `get_current_user()` 依赖注入解码 JWT、查询数据库，失败则返回 401
4. 所有受保护路由依赖 `current_user: User = Depends(get_current_user)`

## 代码规范

### Python
- 全异步（`async def` / `await`）
- 类型注解配合 `Annotated` + `Field` 为 Pydantic schema 添加元数据
- Repository 类在 `__init__` 中接收 `AsyncSession`，方法均为 `async`
- 配置通过 `python-dotenv` 在 `settings/__init__.py` 中加载（显式传入项目根目录路径）
- 日志使用标准库 `logging`，搭配 `TimedRotatingFileHandler`（按天轮转，保留 30 天）

### 前端（JavaScript）
- 原生 ES6+，位于 `static/js/`
- `api.js` 封装所有 fetch 调用，自动注入 Bearer Token，含中文错误信息映射
- 认证 token 存储在 `localStorage`（`optlab_token` / `optlab_user`）
- 错误响应从 FastAPI `detail` 字段解析，经 `toChinese()` 映射后展示
- 2D 可视化用 D3.js，3D（ SVM 核技巧）用 Three.js

### Jinja2 模板
- 存放于 `templates/`
- **路径分隔符必须用正斜杠 `/`** — `main.py` 中已做 Windows 路径兼容处理
- 课程子页面模板响应带上 `NO_CACHE` 响应头
- `{% block head %}` 用于页面级 `<link>` 和 `<script>`；`{% block scripts %}` 用于底部脚本
- MathJax 等大型第三方库**按需引入**，不要加入 `base.html`（见下方静态资源规范）

### CSS
- 全局样式采用 BEM-ish 命名，位于 `static/css/base/`
- 各课程专用样式位于 `static/css/courses/`

## 开发规范

### Git 工作流
- 功能开发在独立分支进行，命名格式：`feat/`、`fix/`、`chore/`
- 统一提交信息使用中文，格式：`类型：简短描述`
- 禁止提交 `.env`、`.db` 文件及 `__pycache__/` 目录
- 提交前确认无未解决的 lint/diagnostic 问题

### 新增页面的静态资源引入规范

| 资源类型 | 大小 | 引入位置 |
|---------|------|---------|
| D3.js（~286 KB） | 大 | 仅在需要可视化数据的页面引入（simplex、observation、comparison 等） |
| Three.js（~1.3 MB） | 很大 | 仅在 SVM 核技巧页面引入（introduction、kernel-trick） |
| MathJax（~1.1 MB） | 很大 | 仅在含 LaTeX 公式的 introduction 页面引入 |
| Math.js（~295 KB） | 大 | 仅在需要数学表达式解析的页面引入（observation、comparison、application） |
| Font Awesome | 小 | 可全局引入 |
| marked.js | 小 | base.html 全局引入（AI 侧边栏和笔记渲染需要） |

**引入方式**：在页面的 `{% block head %}` 中通过 `<script>` 标签引入，不使用 `importmap`（除非是 Three.js 的 ES Module）。

### 静态文件缓存规范
- `/static/` 下的文件响应带有 `Cache-Control: public, max-age=31536000, immutable`
- 修改静态文件后**必须重启服务**或让用户强制刷新（Ctrl+Shift+R）
- 如需精细化缓存策略，可在 `main.py` 的 `CachedStaticFiles` 类中按文件类型或路径定制响应头

### 新增实验页面的 AI 笔记支持
在 `routers/notes.py` 的 `ai_generate_note` 路由中，每个 `experiment_key` 都有硬编码的数据校验逻辑。新增实验页面时需同步补充：

1. 判断是否有实验数据（检查 `iteration_log`、`convergence_result` 或页面特有字段如 `sample_count`）
2. 无数据时返回 400 错误，说明具体原因
3. 校验通过后才调用 `note_generator.py` 生成笔记

### 错误处理规范
- 路由层统一使用 `HTTPException`，避免裸露的 `try/except` 吞掉异常
- 业务逻辑层（`core/`、`repository/`）使用 `try/except` 记录日志后重新抛出
- 前端 `api.js` 对 FastAPI 返回的 `detail` 字段做中文映射，`toChinese()` 函数覆盖所有常见英文错误提示

### 路由注册顺序
- **固定路径路由必须在通配路由之前注册**（如 `notes.py` 中 `/item/{item_id}` 在 `/{experiment_key}` 之前），避免被误匹配

### 注释规范

#### Python
- **不主动添加注释**：代码本身应足够清晰，注释只在以下情况添加：
  - 函数/类的业务含义不直观时（如数学公式推导、算法选择理由）
  - 非 очевидный 的边界条件或 hack 时
  - 需要解释"为什么这样做"而非"做什么"时
- 文档字符串仅在 `core/` 和 `repository/` 层补充简要描述（用中文）；`routers/` 层不写 docstring，直接在路由函数上写一行中文说明
- 禁止无意义注释如 `# 关闭会话`、`# 增加计数`
- 不要注释掉未使用的代码，直接删除（git 历史会保留）

#### JavaScript
- 仅在业务逻辑复杂或非标准写法处添加简要注释
- 函数/模块顶部可加一行中文用途说明
- 禁止多行注释包裹大段代码做"注释掉"——直接删除，用 git 恢复
- D3.js 链式调用中可在关键 transform 处加简短注释说明意图

#### HTML（Jinja2 模板）
- Jinja2 块标签 `{% block %}` 前后不需注释，块名本身即文档
- 仅在 HTML 结构复杂、不易理解处加 `<!-- 中文说明 -->` 注释

#### 总体原则
- 注释解释 **why**，不解释 **what**（代码本身应自解释）
- 宁可代码写得清晰，也不靠注释补说明
- 新增第三方依赖或非标准用法时，注释说明来源和选择理由

## 容易被忽略的细节

1. **`session.begin()` 与事务边界**：Repository 方法始终在 `async with session.begin():` 块内操作——不要在 begin 块外直接调用 `session.commit()`，除非有明确的显式事务管理。

2. **SQLite 连接池**：代码在 `models/__init__.py` 中显式检查 `url.get_backend_name().startswith("postgresql")`，确认是 PostgreSQL 才添加 pool 相关参数。给 SQLite 加 pool 参数会报错。

3. **`pwdlib.PasswordHash` 是模块级单例**：`password_hash = PasswordHash.recommended()` 在 `models/user.py` 模块加载时实例化一次。`User.password` 属性 setter 在赋值时自动哈希，`check_password` 校验哈希值。

4. **聊天滑动窗口计算**：`ChatService.WINDOW_MESSAGES = CHAT_HISTORY_WINDOW_ROUNDS × 2`（每轮含 user + assistant 两条消息）。超出窗口的消息通过 `apply_sliding_window()` 软删除（`is_active=False`）。滑动窗口在**保存新用户消息后、获取上下文前**执行。

5. **AI 聊天会话创建时机**：会话在用户发第一条消息时才创建，不是调用专门接口。创建新会话时会自动软删除该 `(user_id, page_id)` 下所有旧会话。

6. **`.env` 已加入 gitignore** — 不要提交密钥，模板是 `.env.template`。

7. **`optlab.db` 已加入 gitignore** — 本地 SQLite 开发数据库不可提交。

8. **占位页面返回 FileResponse**：`main.py` 对不存在的课程路径返回 `courses/placeholder.html`（状态码 404），这是 `FileResponse` 对象而非字典错误响应。

9. **`TemplateResponse` 中的模板路径**：始终使用正斜杠 `courses/line-search/index.html`，不要用 OS 原生反斜杠。Jinja2 路径在所有平台下都按 POSIX 风格解析。

10. **`note_generator.py` 的 API Key 检查**：第 96 行检查 `settings.DEEPSEEK_API_KEY.strip()` 是否等于占位符 `"CHANGE_ME_DEEPSEEK_KEY"`——仅做 `if not api_key` 检查不够，因为占位符是非空字符串。

11. **实验笔记 AI 生成的前置校验**：每个 `experiment_key` 在 `routers/notes.py` 中有硬编码的校验逻辑（如单纯形法需 `iteration_card_count > 0`，核技巧需 `sample_count > 0`）。新增实验页面可能需要在此补充对应校验。

12. **LangChain Agent 是死代码**：`core/agent.py` 在模块级别实例化了 `create_agent()`，但 `routers/agent.py` 调用的是 `ask_assistant()`（直接用 `llm.with_structured_output()`），完全绕过了 Agent。Agent 的 import 没有实际使用。

13. **未配置 CORS**：`main.py` 中没有 `CORSMiddleware`，跨域请求会被浏览器拦截。

14. **静态文件缓存后需重启服务**：`CachedStaticFiles` 以服务启动时的文件状态为准，修改 CSS/JS 后不重启服务，浏览器仍会使用缓存的旧文件。

## 目录结构速查

```
main.py                    # 应用入口、静态文件/模板挂载、页面路由
scripts/launch.py          # 跨平台启动脚本（venv + pip + 数据库 + uvicorn）
scripts/init_db.py         # 数据库初始化 + 索引创建 + text_blocks 列迁移
dependencies.py            # get_session() 依赖注入
settings/__init__.py       # 所有 .env 配置（数据库、JWT、DeepSeek、聊天窗口）

core/                      # 业务逻辑层
  auth.py                  # JWT + get_current_user
  agent.py                 # LangChain + DeepSeek 结构化输出（实际未被使用）
  chat_service.py          # 会话/消息 CRUD + 滑动窗口
  note_generator.py        # LLM 实验笔记生成
  scheduler.py             # APScheduler cron 任务（每日凌晨 3 点清理）

models/                    # SQLAlchemy ORM（Base、引擎、会话工厂、所有表模型）
routers/                   # FastAPI APIRouter 端点
  auth.py                  # /auth/*
  experiments.py          # /experiments/*（实验记录 CRUD + CSV 导出）
  notes.py                 # /notes/*（笔记条目 CRUD + AI 生成 + 导出）
  agent.py                 # /api/assistant/*（聊天会话 + AI 对话）

repository/                # 按模型分组的异步 SQLAlchemy CRUD
schemas/                   # Pydantic 请求/响应模型
static/                    # CSS、JS、第三方库、favicon
templates/                 # Jinja2 HTML 页面
```
