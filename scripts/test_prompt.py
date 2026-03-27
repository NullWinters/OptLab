import os
import sys
import json
import asyncio

# 将项目根目录添加到 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.note_generator import generate_experiment_note

async def test():
    """
    使用优化后的 Prompt 进行测试生成。
    """
    # 1. 寻找优化后的 prompt 文件
    prompt_path = "scripts/optimized_prompt.txt"
    custom_prompt = None
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            custom_prompt = f.read()
        print(f"Loaded optimized prompt from {prompt_path}")
    else:
        print("Optimized prompt not found. Using default prompt from note_generator.py")

    # 2. 寻找测试数据
    data_files = [f for f in os.listdir(".") if f.startswith("train_") and f.endswith(".json")]
    if not data_files:
        dataset_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")
        if os.path.exists(dataset_dir):
            data_files = [os.path.join(dataset_dir, f) for f in os.listdir(dataset_dir) if f.endswith(".json") or f.endswith(".jsonl")]
    
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
        print("Error: No valid test cases found.")
        return

    print(f"Running {len(test_cases)} test cases...")

    # 3. 执行测试
    output_dir = "scripts/output"
    os.makedirs(output_dir, exist_ok=True)

    for i, item in enumerate(test_cases):
        exp_key = item["experiment_key"]
        label = item.get("label", "实验")
        exp_data = item["experiment_data"]
        
        print(f"[{i+1}/{len(test_cases)}] Testing: {label} ({exp_key})")
        
        try:
            title, content = await generate_experiment_note(
                experiment_key=exp_key,
                experiment_data=exp_data,
                custom_prompt=custom_prompt
            )
            
            # 保存生成结果
            safe_label = "".join([c for c in label if c.isalnum() or c in (" ", "-", "_")]).strip().replace(" ", "_")
            filename = f"{output_dir}/{exp_key}_{safe_label}.md"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n{content}")
            
            print(f"  Success! Generated title: {title[:30]}...")
            print(f"  Result saved to {filename}")
            print(f"  Content length: {len(content)} characters")
            
        except Exception as e:
            print(f"  Error testing {exp_key}: {e}")

    print(f"\nAll tests completed. Results are in {output_dir}")

if __name__ == "__main__":
    asyncio.run(test())
