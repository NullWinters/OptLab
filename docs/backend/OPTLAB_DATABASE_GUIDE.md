# OptLab 数据库使用说明与教程

> 说明：异步 SQLAlchemy 2.x，`AsyncSession`；默认 SQLite；生产可换 PostgreSQL。  
> 与代码一致：`models/`、`repository/`、`models/__init__.py`（引擎与会话）。

---

## 1. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  settings.DB_URI  →  create_async_engine(engine)              │
│                         ↓                                    │
│              AsyncSessionFactory (sessionmaker)              │
│                         ↓                                    │
│  FastAPI Depends(get_session) → yield AsyncSession → 关闭    │
└─────────────────────────────────────────────────────────────┘
```

- **引擎**：`models/__init__.py` 中 `engine = create_async_engine(DB_URI, ...)`。
- **会话**：每个请求通过 `dependencies.get_session()` 获取独立 `AsyncSession`，用完关闭。
- **仓库层**：`repository/*.py` 封装对表的增删改查，路由层只调仓库，不直接写原始 SQL。

---

## 2. 连接配置（环境变量）

| 变量 | 作用 |
|------|------|
| `OPTLAB_DB_URI` | SQLAlchemy **异步**连接串；未设置时默认 `sqlite+aiosqlite:///./optlab.db` |

**SQLite 默认（开发）**  
- 相对路径 `./optlab.db` 表示**进程当前工作目录**下的文件；一般从项目根目录启动 `uvicorn`，则库文件在**项目根**。  
- 该文件已在 `.gitignore`，**不会随 Git 提交**。

**PostgreSQL 示例（生产）**  
```text
postgresql+asyncpg://用户:密码@主机:5432/数据库名
```
启用后 `models/__init__.py` 会为引擎增加 `pool_size`、`max_overflow` 等连接池参数（SQLite 不使用这些参数）。

---

## 3. 初始化与建表

### 3.1 建表脚本

```bash
python scripts/init_db.py
```

内部执行：`async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)`  
即根据 `Base` 元数据**创建尚不存在的表**，**不会**删数据；若表已存在则跳过。

### 3.2 模型注册

所有 ORM 类需继承 `models` 包中的 `Base`，并在 `models/__init__.py` 中 `import` 对应模块，否则 `create_all` 可能**看不到**新表。

当前已导入：`User`、`ExperimentNote`、`ExperimentRecord`、`NoteItem`。

---

## 4. 表结构详解

### 4.1 `user`（用户）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | 自增主键 |
| `email` | String(255) UNIQUE | 登录邮箱，唯一 |
| `username` | String(255) | 用户名（唯一性在业务层校验） |
| `_password` | String(255) | 密码哈希（勿直接读明文；赋值用 `user.password = plain`） |

**关系**：`User` 通过 `backref` 可访问 `experiment_notes`、`experiment_records`、`note_items`（惰性加载，按需使用）。

---

### 4.2 `experiment_note`（实验单条感想 + 可选 JSON）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | |
| `user_id` | FK → `user.id` ON DELETE CASCADE | 索引 |
| `experiment_key` | String(255) | 实验标识，如 `line-search.range_search.observation`；索引 |
| `reflection` | `String`（无长度上限在 SQLite 中即 TEXT） | 长文本感想 |
| `extra_data` | JSON nullable | 结构化扩展（分题答案等） |
| `created_at` | DateTime(timezone) | 服务器默认 `now()` |
| `updated_at` | DateTime(timezone) | 更新时 `onupdate` |

**业务语义**：一个 `(user_id, experiment_key)` 对应**一条**记录；更新走 `upsert` 逻辑（见 `ExperimentNoteRepository`）。

---

### 4.3 `experiment_record`（个人中心「保存的运行快照」）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | |
| `user_id` | FK → `user.id` ON DELETE CASCADE | 索引 |
| `alias` | String(255) | 用户起的别名 |
| `source_page` | String(255) | 来源页面标识；索引 |
| `payload` | JSON **非空** | 整次实验的 JSON 快照（算法、迭代、参数等） |
| `created_at` | DateTime(timezone) | 创建时间 |

**业务语义**：同一用户可有多条记录；`payload` 结构由**前端约定**，后端只做存储与导出（CSV 时按字段名解析）。

---

### 4.4 `note_item`（某实验下多条笔记）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | Integer PK | |
| `user_id` | FK → `user.id` ON DELETE CASCADE | 索引 |
| `experiment_key` | String(255) | 索引 |
| `title` | String(500) | 标题 |
| `content` | Text | 正文（Markdown/LaTeX 文本等） |
| `sort_order` | Integer | 排序 |
| `created_at` / `updated_at` | DateTime(timezone) | |

**业务语义**：同一 `(user_id, experiment_key)` 可**多条**；列表按 `sort_order`、`created_at` 排序。

---

## 5. 外键与级联

- 子表 `user_id` 均 `ForeignKey("user.id", ondelete="CASCADE")`。  
- **删除用户**时，该用户的 `experiment_note`、`experiment_record`、`note_item` 会一并删除（由数据库外键保证，需在支持 FK 的 SQLite 配置下开启；SQLite 默认对 ORM 创建的表通常已启用）。

---

## 6. 会话与事务（Repository 中的常见模式）

仓库方法内普遍使用：

```python
async with self.session.begin():
    # 查询 / 修改 / flush
```

`begin()` 会开启事务；块正常结束则**提交**，异常则**回滚**。

部分操作在 `flush()` 后 `refresh()` 对象，以便拿到数据库生成的 `id` 与默认值。

**注意**：路由层 `get_session` 对每个请求 `yield` 一个 session；若仓库内部已 `begin()` 并提交，与 FastAPI 生命周期兼容，但避免在同一次请求中嵌套混乱的事务边界——当前项目以 **仓库内 `begin()`** 为主。

---

## 7. JSON 列使用说明

- **ORM**：`Mapped[dict[str, Any]]` + `mapped_column(JSON)`（见 `ExperimentNote.extra_data`、`ExperimentRecord.payload`）。
- **SQLite**：JSON 以 TEXT 存储；SQLAlchemy 负责序列化。
- **查询**：复杂条件建议用 Python 侧过滤或换 PostgreSQL + JSONB 运算符（需自行扩展）。

**`payload` 建议字段**（与导出/前端兼容，非强制）：  
`algorithm_name`、`test_function` / `function`、`initial_state` / `initial_params`、`iteration_data` / `iterationLog` 等（见 `routers/experiments.py` 导出逻辑）。

---

## 8. 本地查看 SQLite（命令行）

```bash
# 项目根目录，库文件存在时
sqlite3 optlab.db

# 常用命令
.tables
.schema user
SELECT id, email, username FROM user LIMIT 5;
.quit
```

---

## 9. 备份与迁移

**备份（SQLite）**  
- 停服务或确保无写入时，复制 `optlab.db` 文件即可。

**迁移**  
- 仓库**未内置 Alembic**；模型变更后需：  
  - 开发环境：可删库重建 `init_db.py`（**数据清空**）；  
  - 生产环境：应引入 Alembic 或手工 `ALTER` SQL，**勿**随意删库。

---

## 10. 合作者扩展：新增表/字段

1. 在 `models/` 新建模型文件，继承 `Base`。  
2. 在 `models/__init__.py` 中 `import` 新模型。  
3. 新增 `repository/` 封装访问。  
4. 路由 `Depends(get_session)` + `Depends(get_current_user)`（若需登录）。  
5. 执行 `python scripts/init_db.py` 创建新表（已有表不覆盖列结构——**加列**需迁移工具或手工 SQL）。

---

## 11. 与「AI 汲取用户数据」相关的数据入口

| 数据 | 表 | 主要用途 |
|------|-----|----------|
| 实验运行快照 | `experiment_record` | `payload` 全量 JSON，适合离线特征抽取 |
| 用户笔记 | `note_item` / `experiment_note` | 文本监督、行为分析 |
| 账号 | `user` | 与用户 ID 关联；**禁止**泄露密码哈希 |

批量导出建议：**服务端只读脚本**或 **已认证 API**（`/experiments/records`），并遵守隐私合规。

---

## 12. 相关源码路径

| 内容 | 路径 |
|------|------|
| 引擎与会话 | `models/__init__.py` |
| 配置 | `settings/__init__.py` |
| 建表脚本 | `scripts/init_db.py` |
| 用户仓库 | `repository/user_repo.py` |
| 实验笔记/记录 | `repository/experiment_repo.py` |
| 多条笔记 | `repository/note_item_repo.py` |

---

*文档结束。*
