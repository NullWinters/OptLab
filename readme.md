# 最优化实验室 (OptLab)

> 基于 Web 的交互式最优化理论教学实验平台

[![Python Version](https://img.shields.io/badge/python-3.13+-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128+-green)](https://fastapi.tiangolo.com/)
[![D3.js](https://img.shields.io/badge/D3.js-v7-orange)](https://d3js.org/)

## 项目简介

OptLab 是一个面向《最优化理论与方法》课程的在线教学实验平台，旨在通过交互式可视化降低最优化算法的学习门槛。平台提供算法流程动态演示、参数交互调节、实验记录持久化及
AI 助教辅助功能。

---

## 功能特性

### 1. 教学中心

提供一系列算法实验，当前教学实验开发计划：

- **无约束优化（一维搜索方法）**：包含黄金分割法、斐波那契数列法、二分法、梯度下降法、牛顿法、割线法 (已完成)
- **线性规划（单纯形法）**：提供表格输入界面，支持单纯形法、两阶段法流程演示、二维变量问题几何解释及结果文字说明 (已完成)
- **有约束非线性优化（支持向量机与SMO）**
  ：支持上传自定义数据集，提供核技巧三维可视化、分离超平面与间隔边界可视化及SMO迭代流程动画 (已完成)

### 2. 用户系统与实验记录

- 用户注册/登录（JWT 认证）
- 实验数据保存
- 一键导出 CSV 格式实验数据

### 3. AI 助教

基于通用大语言模型（LLM）与前端感知能力实现的智能助教，支持以下功能：

| 功能     | 描述                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 交互引导 | AI 操作助手通过感知页面控件表单与 SVG 图形元数据，解析用户自然语言指令，返回高亮 ID 列表与文字说明，前端依次高亮控件并支持点击转移，引导用户完成实验操作      |
| 智能总结 | 位于实验笔记区域的“AI总结”按钮，自动合并当前实验数据（算法参数、迭代日志、收敛结果）与用户行为追踪数据（点击、参数调整等），调用 LLM 生成结构化实验笔记并保存 |

用户可通过侧边对话栏与 AI 助教交互，AI 助教在对话框中说明实验目标与步骤，并高亮需要操作的控件或图形元素。

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

| 技术              | 用途           |
| ----------------- | -------------- |
| HTML5 + CSS3      | 页面结构与样式 |
| JavaScript (ES6+) | 交互逻辑       |
| D3.js v7          | 数据可视化     |
| Three.js          | 三维可视化     |
| Math.js           | 数学表达式解析 |
| MathJax           | 公式渲染       |

---

## 项目结构

```text
OptLab/
├── core/                       # 核心逻辑
│   ├── agent.py                # AI Agent 实现
│   ├── auth.py                 # 认证逻辑
│   ├── chat_service.py         # 聊天服务
│   ├── note_generator.py       # 实验笔记生成器
│   └── scheduler.py            # 任务调度器
├── models/                     # 数据库 ORM 模型
│   ├── user.py                 # 用户模型
│   ├── experiment.py           # 实验模型
│   ├── experiment_record.py    # 实验记录模型
│   ├── note_item.py            # 笔记条目模型
│   ├── chat_session.py         # 聊天会话模型
│   └── chat_message.py         # 聊天消息模型
├── repository/                 # 数据库 CRUD 操作层
│   ├── user_repo.py            # 用户数据访问
│   ├── experiment_repo.py      # 实验数据访问
│   └── note_item_repo.py       # 笔记数据访问
├── routers/                    # API 路由
│   ├── auth.py                 # 认证路由
│   ├── experiments.py          # 实验路由
│   ├── notes.py                # 笔记路由
│   └── agent.py                # AI Agent 路由
├── schemas/                    # Pydantic 数据验证模型
│   ├── user.py
│   ├── experiment.py
│   ├── experiment_record.py
│   ├── note_item.py
│   ├── agent.py
│   └── chat.py                 # 聊天相关模型
├── settings/                   # 全局配置
│   └── __init__.py
├── static/                     # 静态资源中心
│   ├── css/
│   │   ├── base/               # 全局基础样式
│   │   ├── components/         # 公共组件样式
│   │   ├── courses/            # 各业务模块专用样式
│   │   │   ├── line-search/    # 一维搜索
│   │   │   ├── linear-programming/ # 线性规划
│   │   │   └── svm-smo/        # SVM
│   │   └── vendors/            # 第三方样式库
│   ├── js/
│   │   ├── common/             # 公共逻辑组件
│   │   │   ├── ai-sidebar.js   # AI 侧边栏
│   │   │   ├── experiment-notes.js # 实验笔记
│   │   │   └── login-modal.js  # 登录弹窗
│   │   ├── courses/            # 实验业务逻辑
│   │   │   ├── line-search/    # 一维搜索 (含 range-search/, point-search/)
│   │   │   ├── linear-programming/
│   │   │   └── svm-smo/
│   │   ├── vendors/            # 第三方库 (D3.js, Three.js, MathJax 等)
│   │   ├── api.js              # API 封装
│   │   ├── auth.js             # 认证逻辑
│   │   ├── main.js             # 主入口
│   │   ├── profile.js          # 个人中心
│   │   └── settings.js         # 设置页面
│   └── favicon.ico
├── templates/                  # 页面模板 (Jinja2)
│   ├── base.html               # 基础母版
│   ├── index.html              # 首页
│   ├── profile.html            # 个人中心
│   ├── settings.html           # 设置页面
│   ├── auth/                   # 认证页面
│   ├── components/             # 可复用组件
│   └── courses/                # 业务页面
│       ├── line-search/        # 一维搜索 (含 range-search/, point-search/)
│       ├── linear-programming/
│       └── svm-smo/
├── datasets/                   # 数据集存储
├── logs/                       # 日志文件
├── tests/                      # 测试文件
├── scripts/                    # 工具脚本
├── dependencies.py             # 依赖注入
├── main.py                     # FastAPI 入口
├── pyproject.toml              # 依赖管理
└── .env.template               # 环境变量模板
```

---

## 快速开始

### 环境要求

- Python 3.13+
- PostgreSQL 14+（开发环境可用 SQLite）

### 安装

#### 1. 克隆项目

```bash
git clone https://github.com/NullWinters/OptLab.git
cd OptLab
```

#### 2. 创建虚拟环境

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate   # Windows
```

#### 3. 安装依赖

- 使用pip
```bash
pip install -e .
```

- 或使用uv
```bash
uv sync
```

#### 4. 配置环境变量

前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 注册并创建 API Key。
将项目根目录下的 `.env.template` 改名为 `.env`，并填写 DeepSeek API Key 和 数据库 URI

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
OPTLAB_DB_URI="postgresql+asyncpg://username:password@address/database"
```

#### 5. 初始化数据库

```bash
python scripts/init_db.py
```

#### 6. 运行服务器

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

## 许可证

MIT License

---

## 致谢

- [D3.js](https://d3js.org/) — 数据可视化
- [Math.js](https://mathjs.org/) — 数学表达式解析
- [FastAPI](https://fastapi.tiangolo.com/) — 高性能 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
