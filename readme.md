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
- **线性规划（单纯形法）**：提供表格输入界面，支持单纯形法流程演示、二维变量问题几何解释及结果文字说明 (待完善)
- **有约束非线性优化（支持向量机与SMO）**：支持上传自定义数据集，提供核技巧三维可视化、分离超平面与间隔边界可视化及SMO迭代流程动画 (开发中)

### 2. 用户系统与实验记录

- 用户注册/登录（JWT 认证）
- 实验数据保存
- 一键导出 CSV 格式实验数据

### 3. AI 助教

基于 LangChain Agent 实现的智能助教，支持以下功能：

| 功能 | 描述 |
|------|------|
| 知识问答 | AI 助教可以实时感知实验进程，回答关于算法原理或实验数据的问题 |
| 交互引导 | 通过高亮显示网页交互控件（按钮、滑块等），引导用户进行实验操作 |
| 智能总结 | 分析用户操作数据，个性化生成实验总结，并将实验关键点提炼为实验笔记 |

用户可通过侧边对话栏与 AI 助教交互，AI 助教会在对话框中说明实验目标和步骤，并高亮需要互动的控件。

---

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| FastAPI | Web 框架 |
| SQLAlchemy | ORM（异步模式） |
| PostgreSQL | 关系型数据库 |
| LangChain | AI Agent 开发 |
| langchain-deepseek | DeepSeek LLM 集成 |
| python-jose | JWT 用户认证 |

### 前端

| 技术 | 用途 |
|------|------|
| HTML5 + CSS3 | 页面结构与样式 |
| Tailwind CSS | Utility-first CSS 框架 |
| JavaScript (ES6+) | 交互逻辑 |
| D3.js v7 | 数据可视化 |
| Three.js | 三维可视化|
| Math.js | 数学表达式解析 |

---


## 项目结构

```text
OptLab/
├── core/                   # 核心 Agent 逻辑
├── models/                 # 数据库 ORM 模型
├── repository/             # 数据库 CRUD 操作层
├── routers/                # API 路由
├── schemas/                # Pydantic 数据验证模型
├── settings/               # 全局配置
├── static/                 # 静态资源中心
│   ├── css/
│   │   ├── base/               # 全局基础样式 (index, courses, sub-courses)
│   │   ├── components/         # 公共组件样式 (ai-sidebar, font-awesome)
│   │   └── courses/            # 各业务模块专用的样式
│   │       └── line-search/    # 一维搜索相关样式 (common, observation, comparison)
│   ├── js/
│   │   ├── lib/                # 第三方库 (d3.js, math.js, MathJax)
│   │   ├── common/             # 项目公共逻辑 (ai-sidebar.js)
│   │   └── courses/            # 实验业务逻辑 (从原 templates 迁入)
│   │       └── line-search/    # 一维搜索逻辑 (range-search, point-search, application)
│   ├── vendor/
│   │   └── three/              # Three.js 本地文件（用于 SVM 三维实验）
│   └── webfonts/               # 字体资源 (FontAwesome)
├── templates/                  # 页面模板中心 (Jinja2)
│   ├── base.html               # 基础母版 (包含全局导航与 AI 侧栏容器)
│   ├── components/             # 可复用的局部模板 (_ai_sidebar.html)
│   └── courses/                # 业务页面
│       ├── index.html          # 课程中心
│       ├── line-search/        # 一维搜索系列页面
│       │   ├── range-search/   # 区间收缩法 (introduction, observation, comparison)
│       │   └── point-search/   # 点搜索法
│       ├── linear-programming/ # 线性规划 (simplex)
│       └── svm-smo/            # 支持向量机 (kernel-trick, smo)
├── docs/                       # 项目文档与实验指导书
│   ├── 公式/                   # 算法数学原理
│   └── 实验指导书/             # Agent 使用的业务文档
├── main.py                     # FastAPI 入口文件
├── pyproject.toml              # 依赖管理 (uv)
└── readme.md                   # 项目说明文档
```

---

## 快速开始

### 环境要求

- Python 3.13+
- PostgreSQL 14+（开发环境可用 SQLite）

### 安装

```bash
# 1. 克隆项目
git clone <repository-url>
cd OptLab

# 2. 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 3. 安装依赖
pip install -e .

# 4. 配置环境变量（见下方说明）

# 5. 运行开发服务器
uvicorn main:app --reload --port 8001
```

### 配置 AI 助手

项目使用 DeepSeek 大模型为流程观察页面提供 AI 操作引导。

**第一步：获取 API Key**

前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 注册并创建 API Key。

**第二步：设置 `.env` 文件**

将项目根目录下的 `.env.template` 改名为 `.env`，并填写 DeepSeek API Key：

```env
# 从 https://platform.deepseek.com/api_keys 获取（必填）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

```

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API 密钥 |
| `DEEPSEEK_MODEL` | ❌ | 模型名称，默认 `deepseek-chat` |
| `DEEPSEEK_TEMPERATURE` | ❌ | 生成温度，值越低回答越确定，默认 `0.7` |



## 许可证

MIT License

---

## 致谢

- [D3.js](https://d3js.org/) — 数据可视化
- [Math.js](https://mathjs.org/) — 数学表达式解析
- [FastAPI](https://fastapi.tiangolo.com/) — 高性能 Web 框架
- [Tailwind CSS](https://tailwindcss.com/) — CSS 框架
