import os
import sys
import json
import asyncio
from dotenv import load_dotenv
from openai import OpenAI
from typing import List, Union, Optional

# 将项目根目录添加到 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from core.note_generator import (
    generate_experiment_note,
    _summarize_iterations,
    _summarize_behavior
)


class TeacherEvaluator:
    """
    简易的教师模型评估器，调用 Gitee AI 的 Qwen3-32B。
    """

    def __init__(self):
        self.model_string = "Qwen3-32B"
        self.client = OpenAI(
            api_key=os.getenv("GITEE_API_KEY"),
            base_url=os.getenv("GITEE_BASE_URL", "https://ai.gitee.com/v1"),
            default_headers={"X-Failover-Enabled": "true"}
        )

    def evaluate(self, experiment_data_str: str, generated_note: str) -> str:
        evaluation_instruction = f"""
你是一位实验报告评审专家。请评估以下学生LLM生成的实验笔记。

【实验数据背景】
{experiment_data_str}

【生成的笔记内容】
{generated_note}

请严格按以下格式输出评估：
1. 分数（1-5分）：分别对完整性、准确性、结构清晰度、篇幅适中度评分。
2. 总体评价：简述优缺点。
3. 改进建议：针对提示词的优化方案。
"""
        response = self.client.chat.completions.create(
            model=self.model_string,
            messages=[
                {"role": "system", "content": "你是一名严谨的实验报告评审专家。"},
                {"role": "user", "content": evaluation_instruction},
            ],
            temperature=0.7
        )
        return response.choices[0].message.content


async def test():
    """使用优化后的 Prompt 进行测试，并获取教师反馈。"""
    # 1. 寻找优化后的 prompt
    prompt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               "output/optimized_prompt.txt")

    custom_prompt = None
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            custom_prompt = f.read()
        print(f"Loaded optimized prompt from {prompt_path}")

    # 2. 初始化教师评估器
    evaluator = TeacherEvaluator()

    # 3. 寻找测试数据
    data_files = [f for f in os.listdir(".") if f.startswith("train_") and f.endswith(".json")]
    if not data_files:
        dataset_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")
        if os.path.exists(dataset_dir):
            data_files = [os.path.join(dataset_dir, f) for f in os.listdir(dataset_dir) if
                          f.endswith(".json") or f.endswith(".jsonl")]

    if not data_files:
        print("Error: No test data found. Please export data from the web interface first.")
        return

    test_cases = []
    for f_path in data_files:
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                if f_path.endswith(".jsonl"):
                    for line in f:
                        if line.strip():
                            test_cases.append(json.loads(line))
                else:
                    test_cases.append(json.loads(f.read()))
        except Exception as e:
            print(f"Warning: Failed to load {f_path}: {e}")

    if not test_cases:
        print("Error: Dataset is empty.")
        return

    print(f"Loaded {len(test_cases)} testing samples.")
    # 4. 执行测试与反馈收集
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
    os.makedirs(output_dir, exist_ok=True)

    for i, item in enumerate(test_cases):
        exp_key = item["experiment_key"]
        label = item.get("label", "实验")
        exp_data = item["experiment_data"]

        print(f"[{i + 1}/{len(test_cases)}] Testing & Evaluating: {label}")

        try:
            # A. 调用学生模型生成笔记
            title, content = await generate_experiment_note(
                experiment_key=exp_key,
                experiment_data=exp_data,
                custom_prompt=custom_prompt
            )

            # B. 准备实验数据摘要供教师评估
            iter_summary = _summarize_iterations(exp_data.get("iteration_log", []))
            bh_summary = _summarize_behavior(exp_data.get("_behavior", {}))
            params_str = json.dumps({k: v for k, v in exp_data.items() if k not in ("iteration_log", "_behavior")},
                                    ensure_ascii=False)
            exp_context = f"参数：{params_str}\n迭代摘要：{iter_summary}\n行为记录：{bh_summary}"

            # C. 获取教师评估结果
            feedback = evaluator.evaluate(exp_context, content)

            # D. 保存结果与反馈
            safe_label = "".join([c for c in label if c.isalnum() or c in (" ", "-")]).strip().replace(" ", "_")
            filename = f"{output_dir}/{exp_key}_{safe_label}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n{content}\n\n---\n## 教师模型 (Qwen3-32B) 评估反馈\n\n{feedback}")

            print(f"  Success! Result saved to {filename}")

        except Exception as e:
            print(f"  Error: {e}")


if __name__ == "__main__":
    asyncio.run(test())
