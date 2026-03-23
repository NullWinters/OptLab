# 最优化实验室 (OptLab)

> 基于 Web 的交互式最优化理论教学实验平台

[![Python Version](https://img.shields.io/badge/python-3.13+-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128+-green)](https://fastapi.tiangolo.com/)
[![D3.js](https://img.shields.io/badge/D3.js-v7-orange)](https://d3js.org/)

## 项目简介

OptLab 是一个面向《最优化理论与方法》课程的在线教学实验平台，旨在通过交互式可视化降低最优化算法的学习门槛。平台提供算法流程动态演示、参数交互调节、实验记录持久化及 AI 助教辅助功能。

---

## 功能特性

### 1. 教学中心

提供一系列算法实验，当前教学实验开发计划：

- **无约束优化（一维搜索方法）**：包含黄金分割法、斐波那契数列法、二分法、梯度下降法、牛顿法、割线法 (已完成)
- **线性规划（单纯形法）**：提供表格输入界面，支持单纯形法流程演示、二维变量问题几何解释及结果文字说明 (已完成)
- **有约束非线性优化（支持向量机与SMO）**：支持上传自定义数据集，提供核技巧三维可视化、分离超平面与间隔边界可视化及SMO迭代流程动画 (已完成)

### 2. 用户系统与实验记录

- 用户注册/登录（JWT 认证）
- 实验数据保存
- 一键导出 CSV 格式实验数据

### 3. AI 助教

基于 LangChain Agent 实现的智能助教，支持以下功能：

| 功能     | 描述                                                               |
| -------- | ------------------------------------------------------------------ |
| 知识问答 | AI 助教可以实时感知实验进程，回答关于算法原理或实验数据的问题      |
| 交互引导 | 通过高亮显示网页交互控件（按钮、滑块等），引导用户进行实验操作     |
| 智能总结 | 分析用户操作数据，个性化生成实验总结，并将实验关键点提炼为实验笔记 |

用户可通过侧边对话栏与 AI 助教交互，AI 助教会在对话框中说明实验目标和步骤，并高亮需要互动的控件。

---

## 技术栈

### 后端

| 技术               | 用途              |
| ------------------ | ----------------- |
| FastAPI            | Web 框架          |
| SQLAlchemy         | ORM（异步模式）   |
| PostgreSQL         | 关系型数据库      |
| LangChain          | AI Agent 开发     |
| langchain-deepseek | DeepSeek LLM 集成 |
| python-jose        | JWT 用户认证      |

### 前端

| 技术              | 用途                   |
| ----------------- | ---------------------- |
| HTML5 + CSS3      | 页面结构与样式         |
| Tailwind CSS      | Utility-first CSS 框架 |
| JavaScript (ES6+) | 交互逻辑               |
| D3.js v7          | 数据可视化             |
| Three.js          | 三维可视化             |
| Math.js           | 数学表达式解析         |
| MathJax           | 公式渲染               |

---


## 项目结构

```text
OptLab/
├── core/                       # 核心逻辑
│   ├── agent.py                # AI Agent 实现
│   ├── auth.py                 # 认证逻辑
│   └── note_generator.py       # 实验笔记生成器
├── models/                     # 数据库 ORM 模型
│   ├── user.py
│   ├── experiment.py
│   ├── experiment_record.py
│   └── note_item.py
├── repository/                 # 数据库 CRUD 操作层
│   ├── user_repo.py
│   ├── experiment_repo.py
│   └── note_item_repo.py
├── routers/                    # API 路由
│   ├── auth.py
│   ├── experiments.py
│   ├── notes.py
│   └── agent.py
├── schemas/                    # Pydantic 数据验证模型
│   ├── user.py
│   ├── experiment.py
│   ├── experiment_record.py
│   ├── note_item.py
│   └── agent.py
├── settings/                   # 全局配置
│   └── __init__.py
├── static/                     # 静态资源中心
│   ├── css/
│   │   ├── base/               # 全局基础样式
│   │   │   ├── style.css
│   │   │   ├── index.css
│   │   │   ├── courses.css
│   │   │   ├── sub-courses.css
│   │   │   └── placeholder.css
│   │   ├── components/         # 公共组件样式
│   │   │   ├── ai-sidebar.css
│   │   │   └── experiment-notes.css
│   │   └── courses/            # 各业务模块专用的样式
│   │       ├── line-search/    # 一维搜索样式
│   │       ├── linear-programming/ # 线性规划样式
│   │       └── svm-smo/        # SVM 样式
│   ├── js/
│   │   ├── common/             # 项目公共逻辑
│   │   │   ├── ai-sidebar.js
│   │   │   └── experiment-notes.js
│   │   └── courses/            # 实验业务逻辑
│   │       ├── line-search/    # 一维搜索逻辑
│   │       ├── linear-programming/ # 线性规划逻辑
│   │       └── svm-smo/        # SVM 逻辑
│   └── favicon.ico
├── templates/                  # 页面模板中心 (Jinja2)
│   ├── base.html               # 基础母版
│   ├── profile.html
│   ├── index.html
│   ├── auth/                   # 认证页面
│   │   ├── login.html
│   │   └── register.html
│   ├── components/             # 可复用的局部模板
│   │   ├── _ai_sidebar.html
│   │   └── _experiment_notes.html
│   └── courses/                # 业务页面
│       ├── index.html
│       ├── placeholder.html
│       ├── line-search/        # 一维搜索系列页面
│       ├── linear-programming/ # 线性规划
│       └── svm-smo/            # 支持向量机
├── docs/                       # 项目文档与实验指导书
│   ├── 公式/                   # 算法数学原理
│   ├── 实验指导书/             # Agent 使用的业务文档
│   ├── alembic_tutorial.md     # 数据库迁移教程
│   ├── 实验笔记添加.md
│   └── 侧栏添加.md
├── scripts/                    # 工具脚本
│   ├── init_db.py              # 数据库初始化
│   └── run_lan.sh              # 局域网运行脚本
├── dependencies.py             # 依赖注入
├── main.py                     # FastAPI 入口文件
├── pyproject.toml              # 依赖管理 (uv)
├── .env.template               # 环境变量模板
└── readme.md                   # 项目说明文档
```

---

## 快速开始

### 环境要求

- Python 3.13+
- PostgreSQL 14+（开发环境可用 SQLite）

### 安装


#### 1. 克隆项目
```bash
git clone <repository-url>
cd OptLab
```

# 2. 创建虚拟环境
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate   # Windows
```

# 3. 安装依赖
```bash
pip install -e .
```

# 4. 配置环境变量
前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 注册并创建 API Key。
将项目根目录下的 `.env.template` 改名为 `.env`，并填写 DeepSeek API Key 和 数据库 URI
```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
OTPLAB_DB_URI="postgresql+asyncpg://username:password@address/database"
```

# 5. 初始化数据库
```bash
python scripts/init_db.py
```

# 6. 运行服务器
```bash
uvicorn main:app --reload --port 8001
```

## 许可证

MIT License

---

## 致谢

- [D3.js](https://d3js.org/) — 数据可视化
- [Math.js](https://mathjs.org/) — 数学表达式解析
- [FastAPI](https://fastapi.tiangolo.com/) — 高性能 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
