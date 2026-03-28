import os
import sys
import json
import platformdirs
from openai import OpenAI
from typing import List, Union, Optional
from dotenv import load_dotenv

# 将项目根目录添加到 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 加载环境变量
load_dotenv()

try:
    import textgrad as tg
    from textgrad.engine.base import EngineLM, CachedEngine
except ImportError:
    print("Error: textgrad not installed. Please install it using 'pip install textgrad'.")
    sys.exit(1)


class CustomOpenAIEngine(EngineLM, CachedEngine):
    """
    通用的 OpenAI 兼容引擎，用于支持 DeepSeek 和 Gitee AI。
    继承自 EngineLM 和 CachedEngine 以支持 textgrad 的缓存机制。
    """
    DEFAULT_SYSTEM_PROMPT = "You are a helpful, creative, and smart assistant."

    def __init__(
            self,
            model_string: str,
            api_key: str,
            base_url: str,
            system_prompt: str = DEFAULT_SYSTEM_PROMPT,
            default_headers: Optional[dict] = None,
            **kwargs
    ):
        root = platformdirs.user_cache_dir("textgrad")
        cache_path = os.path.join(root, f"cache_{model_string}.db")
        super().__init__(cache_path=cache_path)

        self.system_prompt = system_prompt
        self.model_string = model_string
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            default_headers=default_headers
        )

    def generate(self, content: Union[str, List[Union[str, bytes]]], system_prompt: str = None, **kwargs):
        if isinstance(content, str):
            return self._generate_from_single_prompt(content, system_prompt=system_prompt, **kwargs)
        else:
            # 暂不支持多模态，简单处理
            raise NotImplementedError("Multimodal generation is not implemented in this custom engine.")

    def _generate_from_single_prompt(
            self, prompt: str, system_prompt: str = None, temperature=0.7, max_tokens=2048, top_p=0.9
    ):
        sys_prompt_arg = system_prompt if system_prompt else self.system_prompt

        # 检查缓存
        cache_key = sys_prompt_arg + str(prompt) + self.model_string
        cache_or_none = self._check_cache(cache_key)
        if cache_or_none is not None:
            return cache_or_none

        # 调用 API
        response = self.client.chat.completions.create(
            model=self.model_string,
            messages=[
                {"role": "system", "content": sys_prompt_arg},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p
        )

        result = response.choices[0].message.content

        # 保存缓存
        self._save_cache(cache_key, result)
        return result

    def __call__(self, prompt, **kwargs):
        return self.generate(prompt, **kwargs)


from core.note_generator import (
    _summarize_iterations,
    _summarize_behavior,
    _EXPERIMENT_TEMPLATES,
    _TEMPLATE_ENRICHERS
)


def train():
    """
    使用 textgrad 优化实验笔记生成器的 System Prompt。
    """
    # 1. 初始化引擎
    # 学生模型：DeepSeek-Chat
    student_engine = CustomOpenAIEngine(
        model_string="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    )

    # 教师模型：Gitee AI Qwen3-32B
    teacher_engine = CustomOpenAIEngine(
        model_string="Qwen3-32B",
        api_key=os.getenv("GITEE_API_KEY"),
        base_url=os.getenv("GITEE_BASE_URL", "https://ai.gitee.com/v1"),
        default_headers={"X-Failover-Enabled": "true"}
    )

    # 封装学生模型实例，将待优化的 system_prompt_var 绑定为系统提示词
    # 放在 system_prompt_var 定义之后初始化 student_model

    # 2. 定义待优化的 System Prompt 变量
    initial_prompt = (
"""
你是一名优化方法课程助手，负责为学生生成客观、准确、可评阅的完整实验记录报告。  
写作规范（每条必须严格遵守）：  
1. 禁止使用 Markdown 标题符号（#）和加粗符号（*或**），禁止使用无序列表符号（-或*）。  
   章节标题用【】括起来单独成行，列表项用数字序号（1. 2. 3.）或中文顿号分隔。  
2. 数学公式必须用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$。普通文本中的数字不加 $，仅数学符号、变量、公式使用 LaTeX。  
3. 所有内容必须基于实验数据，数字必须与提供的数据完全一致。缺失数据写「未记录」，不推断。  
4. 禁止使用套话和 AI 腔调（如「综上所述」「令人满意」等）。语言风格为陈述句，直接陈述数据与结论。  
5. 严格按照【结构模板】撰写，不增删章节，不改变章节名称。  
6. 笔记标题必须包含算法/实验名与目标函数简述，含函数时用 LaTeX 表达。  
7. 表格使用 Markdown 表格语法（| 符号)，参数表必须包含三列：参数名、当前值、说明，并标注可编辑字段（如「α=0.01 [可调]」）。**新增「推荐范围」列**，例如：  
   | 参数名 | 当前值 | 推荐范围 | 说明 |  
   | :--- | :--- | :--- | :--- |  
   | $C$ | 1 [可调] | [0.1, 10] | 惩罚系数，增大 $C$ 会提升对误分类的惩罚，但可能过拟合 |  
   | $tol$ | 0.01 [可调] | [1e-3, 1e-2] | KKT 条件容忍度，减小 $tol$ 会延长收敛时间 |  
8. **理论-实际对比强化规则**：当理论值存在但实际数据缺失时，必须使用占位符表格列（如 `| 理论值 | 实际值（待填写）| 偏离分析 |`），并在表格注释中标明「需用户补充数据后自动对齐」。  
9. **操作记录诊断逻辑**：  
   - 【操作触发】记录时间戳与操作类型（如「播放」）。  
   - 【结果映射】每项操作必须包含：  
     1. 预期结果（如「启动迭代」）。  
     2. 实际结果（如「无数据」）。  
     3. 问题定位（如「参数未配置」）及修复建议（如「请填写 f(x)」）。  
10. **视觉化未运行状态**：  
    - 用 `[!]` 标记未运行（如「[!] 黄金分割法」）。  
    - 用 `[原因]` 注释问题（如「[原因] 参数未配置」）。  
    - 用 `[建议]` 行动建议（如「[建议] 请填写 f(x)」）。  
    所有符号必须用 Markdown 注释块（`> [!] ...`）呈现。  
11. **模块化算法描述与关键步骤合并**：  
    - 每个算法单独成节（如「【梯度下降法】」），包含：  
      1. 理论收缩比（如 `0.618`）。  
      2. 核心公式（如 `x_{k+1} = x_k - αf'(x_k)`）。  
      3. 适用场景（如「仅需函数值」）。  
      4. **关键步骤解析**：必须包含第1步、终止步的公式验证与数据对照（如「第1步验证 $x_{k+1}=x_k-αf'(x_k)$ 与数据一致」）。  
    - 算法名称在全文中至少出现 3 次（标题、参数表、分析段落）。  
12. **动态检查清单**：  
    - 插入【实验准备状态】模块，用 Markdown 表格呈现：  
      | 参数 | 状态 | 建议 |  
      | :--- | :--- | :--- |  
      | f(x) | ❌ 未配置 | 请填写 f(x) |  
    - 缺失项自动标记 ❌，完成项标记 ✅。  
13. **收敛曲线文本模板化**：  
    - 若数据缺失，必须插入：  
      - 收敛曲线描述：`需插入图表位置`。  
      - 公式验证：`需补充 x_{k+1} = x_k − αf'(x_k) 与数据的一致性分析`。  
    - 占位符用 `[需补充]` 标记，供后续编辑。  
14. **主结论章节要求**：  
    - 必须包含理论对照与数据核对。  
    - 若数据允许，补充参数敏感性分析（如「假设 α=0.05，预计收敛速度提升 X 倍」）或表格对比不同参数结果。**必须包含参数敏感性讨论**，例如：  
      - "若 $C=10$，支持向量约束会更严格，可能导致更多迭代但更小的分类边界；若 $C=0.1$，模型会容忍更多误分类，可能减少迭代次数但扩大分类边界。"  
      - **要求引用实验数据**（如当前 $C=1$ 的迭代次数为 23，若 $C=10$ 预计迭代次数增加 X 倍）。  
    - 有行为记录时，在分析或「操作与现象对照」中体现联系。  
    - **模块化标签**：使用 `<分析-算法名>` 标签分段（如 `<分析-梯度下降法>`）。  
15. **参数无关性标注**：若参数与当前算法无关（如割线法参数在梯度下降法中未使用），需添加注释「该参数未启用」。  
16. **时间戳映射简化**：将时间戳与现象的对照表改为纯文本描述（如“用户在15s配置 $x_{-1}=0.8$，22s点击播放触发迭代”），删除中间调整过程。  
17. **操作记录表格化**：  
    - 使用三列表格：`| 操作 | 预期结果 |
"""
    )

    system_prompt_var = tg.Variable(
        initial_prompt,
        role_description="实验笔记生成器的系统提示词，负责控制格式、风格、内容准确性和篇幅",
        requires_grad=True
    )

    student_model = tg.BlackboxLLM(student_engine, system_prompt=system_prompt_var)

    # 3. 设计评估器 (Loss Function)
    # ... (evaluation_instruction 定义保持不变) ...
    evaluation_instruction = """
你是一位实验报告评审专家。请评估以下学生LLM生成的实验笔记。

【评价标准】
1. 完整性（1-5分）：是否包含实验参数、迭代关键节点、实验结果、简要分析？
2. 准确性（1-5分）：数值是否与提供的实验数据一致？有无捏造或错误？
3. 结构清晰度（1-5分）：章节组织是否合理？表格和列表是否清晰易读？
4. 篇幅适中（1-5分）：目标字数 600-1000 字，是否在此范围内？若偏离请说明。
5. 可编辑性（1-5分）：内容是否模块化，方便用户修改或补充？

【实验数据】
{experiment_data}

【生成的笔记】
{generated_note}

请输出：
1. 每个维度的分数（格式：完整性: X/5, ...）
2. 总体评价（2-3句话，指出主要优点和不足）
3. 具体的改进建议（针对初始提示词，如“应增加对迭代关键节点的强调”或“应明确要求避免使用加粗符号”）

输出格式：
分数: ...
总体评价: ...
改进建议: ...
    """
    # 4. 设置优化器
    optimizer = tg.TGD(parameters=[system_prompt_var], engine=teacher_engine)

    # 5. 加载数据集
    # 优先加载当前目录下导出的数据，如果没有则寻找 datasets 目录
    data_files = [f for f in os.listdir(".") if f.startswith("train_") and f.endswith(".json")]
    if not data_files:
        dataset_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")
        if os.path.exists(dataset_dir):
            data_files = [os.path.join(dataset_dir, f) for f in os.listdir(dataset_dir) if
                          f.endswith(".json") or f.endswith(".jsonl")]

    if not data_files:
        print("Error: No training data found. Please export data from the web interface first.")
        return

    dataset = []
    for f_path in data_files:
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                if f_path.endswith(".jsonl"):
                    for line in f:
                        if line.strip():
                            dataset.append(json.loads(line))
                else:
                    dataset.append(json.loads(f.read()))
        except Exception as e:
            print(f"Warning: Failed to load {f_path}: {e}")

    if not dataset:
        print("Error: Dataset is empty.")
        return

    print(f"Loaded {len(dataset)} training samples.")

    # 6. 训练循环
    epochs = 1
    for epoch in range(epochs):
        print(f"Starting Epoch {epoch + 1}/{epochs}")
        for i, item in enumerate(dataset):
            exp_key = item["experiment_key"]
            label = item.get("label", "实验")
            exp_data = item["experiment_data"]

            # 数据预处理
            behavior_raw = exp_data.get("_behavior", [])
            iteration_log = exp_data.get("iteration_log", [])

            iter_summary = _summarize_iterations(iteration_log)
            bh_summary = _summarize_behavior(behavior_raw)

            params_data = {k: v for k, v in exp_data.items() if k not in ("iteration_log", "_behavior")}
            params_str = json.dumps(params_data, ensure_ascii=False, indent=2)

            template = _EXPERIMENT_TEMPLATES.get(exp_key, "【实验目的】\n【实验参数】\n【迭代过程】\n【结论】")
            template_for_prompt = template + _TEMPLATE_ENRICHERS.get(exp_key, "")

            user_prompt = (
                f"实验页面：{label}\n"
                f"实验标识：{exp_key}\n"
                f"【结构模板】：\n{template_for_prompt}\n\n"
                f"【实验参数数据】：\n{params_str}\n\n"
                f"【迭代数据摘要】：\n{iter_summary}\n\n"
                f"【用户操作行为记录】：\n{bh_summary}\n"
                "请按以上要求生成笔记。"
            )

            # 前向传播
            print(f"  Step {i + 1}/{len(dataset)} - Generating response...")
            # 使用 student_model 直接生成 Variable，确保梯度链条完整
            user_prompt_var = tg.Variable(user_prompt, role_description="用户输入的实验数据和笔记要求")
            prediction = student_model(user_prompt_var)
            prediction.role_description = "生成的实验笔记内容"

            # 计算损失
            # 动态构建评估指令，填入当前步的实验数据
            current_evaluation_instruction = evaluation_instruction.format(
                experiment_data=user_prompt,
                generated_note="{generated_note}"
            )
            step_evaluator = tg.TextLoss(current_evaluation_instruction, engine=teacher_engine)
            loss = step_evaluator(prediction)

            # 反向传播：明确指定使用教师引擎提供文本反馈
            print(f"  Step {i + 1}/{len(dataset)} - Backpropagating...")
            loss.backward(engine=teacher_engine)

            # 优化步进
            optimizer.step()
            optimizer.zero_grad()

            print(f"  Step {i + 1}/{len(dataset)} - Loss processed.")

    # 7. 保存结果
    output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "output/optimized_prompt.txt")
    print(f"Optimization complete. Optimized prompt saved to {output_path}")
    with open(output_path, "w+", encoding="utf-8") as f:
        f.write(system_prompt_var.value)


if __name__ == "__main__":
    train()
