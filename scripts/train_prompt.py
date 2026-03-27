import os
import sys
import json
import asyncio
import platformdirs
from openai import OpenAI
from typing import List, Union, Optional
from dotenv import load_dotenv
from tqdm import tqdm, trange

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
        "你是一名优化方法课程助教，负责为学生生成客观、准确、可评阅的完整实验记录报告。\n"
        "写作规范（每条必须严格遵守）：\n"
        "1. 禁止使用 Markdown 标题符号（#）和加粗符号（*或**），禁止使用无序列表符号（-或*）。\n"
        "   章节标题用【】括起来单独成行，如：【实验参数】\n"
        "   列表项直接用数字序号（1. 2. 3.）或中文顿号分隔，不用符号开头。\n"
        "2. 数学公式必须用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$。\n"
        "   普通文本中的数字不要加 $，只有数学符号、变量、公式才用 LaTeX。\n"
        "3. 只写实验数据支持的内容。数值必须与提供的数据完全一致，不得捏造或估算。\n"
        "   若某项数据缺失，直接写'未记录'，不做推断。\n"
        "4. 禁止使用套话和 AI 腔调，包括但不限于：\n"
        "   '本次实验''通过本实验''可以看出''值得注意的是''综上所述''总的来说'\n"
        "   '验证了''体现了''充分说明''清晰展示''令人满意'等修辞性短语。\n"
        "5. 语言风格：陈述句为主，直接给出数据和结论，不加修饰。\n"
        "   例如：'黄金分割法经 12 次迭代后区间长度收缩至 0.0008，收缩比稳定在 0.618。'\n"
        "6. 严格按照结构模板的章节顺序撰写，不增删章节，不改变章节名称。\n"
        "7. 笔记标题须含算法/实验名与目标函数或问题简述；含函数或约束时须用 LaTeX，如：\n"
        "   '黄金分割法 — $f(x)=x^2-4x+4$ 实验记录'\n"
        "   '单纯形法 — 2变量3约束最大化实验记录'\n"
        "8. 表格使用 Markdown 表格语法（| 符号），这是唯一允许使用的 Markdown 格式。\n"
        "9. 篇幅：正文总字数不少于约 1950 汉字；各【】章节须有实质正文。\n"
        "10. 主结论章节须含理论对照与数据核对；有行为记录时在分析或「操作与现象对照」中体现联系。\n"
        "11. 数字须来自所给数据；缺失写未记录。\n"
        "12. 按本实验【结构模板】撰写，勿套用其他实验章节。\n"
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
    for epoch in trange(epochs, desc="Training"):
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
                               "scripts/optimized_prompt.txt")
    print(f"Optimization complete. Optimized prompt saved to {output_path}")
    with open(output_path, "w+", encoding="utf-8") as f:
        f.write(system_prompt_var.value)


if __name__ == "__main__":
    train()
