# TextGrad 提示词优化训练指导手册

本手册介绍如何使用 `textgrad` 框架优化实验笔记生成器的 `system_prompt`。通过自动化反馈循环，我们可以引导 LLM 生成更符合学术规范、字数达标且无 AI 腔调的实验报告。

## 1. 准备阶段

### 1.1 安装依赖
优化过程依赖 `textgrad` 库和高性能 LLM（建议使用 GPT-4o 或 Claude 3.5 Sonnet 作为评估器）。

```bash
pip install textgrad
```

### 1.2 环境配置
设置你计划使用的 LLM 引擎的 API Key。

```bash
export OPENAI_API_KEY="your-api-key"
# 或者使用 DeepSeek
export DEEPSEEK_API_KEY="your-api-key"
```

指定 textgrad 使用的引擎（默认为 `gpt-4o`）：
```bash
export TEXTGRAD_ENGINE="gpt-4o"
```

## 2. 获取训练数据

利用网页端的“开发者导出”功能获取真实的操作数据。

1.  **开启开发者模式**：访问任何实验页面，在 URL 后添加 `?dev=1`。
    *   例如：`http://localhost:8000/courses/line-search/range-search/observation?dev=1`
2.  **模拟用户操作**：在页面上进行参数调整、点击运行、切换视图等操作。
3.  **导出数据**：点击左侧新增的“导出开发数据”按钮。
4.  **准备数据集**：将导出的 `.json` 文件放入项目的 `datasets/` 目录，或者直接放在 `scripts/` 目录下。

## 3. 运行训练脚本

训练脚本 `scripts/train_prompt.py` 会模拟生成过程，并由一个“严格评估员”给出改进梯度。

```bash
python scripts/train_prompt.py
```

### 训练逻辑说明：
*   **前向传播**：使用当前的 `system_prompt` 生成实验笔记。
*   **评估 (Loss)**：评估器根据 12 条准则检查生成的笔记，特别是字数（1950字要求）和禁用符号。
*   **反向传播**：评估器给出具体的改进建议。
*   **更新**：`textgrad` 根据建议修正 `system_prompt` 的措辞。

训练完成后，优化后的提示词将保存在 `scripts/optimized_prompt.txt`。

## 4. 验证与应用

### 4.1 运行测试脚本
使用 `scripts/test_prompt.py` 验证优化后的提示词效果。

```bash
python scripts/test_prompt.py
```

测试结果将保存在 `scripts/output/` 目录下，以 `.md` 文件形式呈现。

### 4.2 更新生产提示词
如果你对 `optimized_prompt.txt` 中的内容满意，请将其手动更新到 `core/note_generator.py` 中的 `system_prompt` 默认值中（约 474 行）。

## 5. 调优建议

*   **字数问题**：如果生成的笔记字数仍然不足，可以在 `train_prompt.py` 的 `evaluation_instruction` 中增加更严厉的反馈，例如：“字数严重不足，必须命令助教在【结果分析】中增加对每一行迭代数据的理论解释。”
*   **格式问题**：如果仍然出现 `#` 或 `*`，请在评估指令中强调“禁止任何形式的 Markdown 装饰性符号”。
*   **样本多样性**：建议至少收集 5-10 个不同算法、不同复杂程度的样本进行训练，以保证提示词的泛化能力。
