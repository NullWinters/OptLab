#!/usr/bin/env python3
"""统一构建实验评测集并对 AI 实验报告执行自动评分。"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = ["数学原理", "实验数据", "实验总结"]
DEFAULT_RUBRIC_PATH = Path(__file__).parent / "evaluation" / "default_rubric.v1.json"
DEFAULT_PROFILES_PATH = Path(__file__).parent / "evaluation" / "experiment_profiles.v1.json"
SUPPORTED_RECORD_SUFFIXES = {".csv", ".json"}


def _is_blank_row(row: list[str]) -> bool:
    return all((str(cell).strip() == "") for cell in row)


def _deserialize_value(raw: str) -> Any:
    text = (raw or "").strip()
    if text == "":
        return ""
    if text.startswith("{") or text.startswith("["):
        try:
            return json.loads(text)
        except Exception:
            return text
    if text.lower() in {"true", "false"}:
        return text.lower() == "true"
    if re.fullmatch(r"[-+]?\d+", text):
        try:
            return int(text)
        except Exception:
            return text
    if re.fullmatch(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", text):
        try:
            return float(text)
        except Exception:
            return text
    return text


def _normalize_case_id(stem: str) -> str:
    text = stem
    for suffix in (
        "-record",
        "_record",
        "-records",
        "_records",
        "-export",
        "_export",
        "-report",
        "_report",
        "-ai-report",
        "_ai_report",
        "-notes",
        "_notes",
    ):
        if text.endswith(suffix):
            text = text[: -len(suffix)]
    return text


def _pick_first_non_empty(*values: Any) -> str:
    for val in values:
        if val is None:
            continue
        s = str(val).strip()
        if s:
            return s
    return ""


def _extract_numbers(text: str) -> list[float]:
    matches = re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", text or "")
    out: list[float] = []
    for m in matches:
        try:
            out.append(float(m))
        except Exception:
            continue
    return out


def _normalize_heading(h: str) -> str:
    return re.sub(r"[\s:：\-—_]+", "", h or "").strip().lower()


def _normalize_match_text(text: str) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", (text or "").casefold())


def _looks_like_internal_identifier(text: str) -> bool:
    s = (text or "").strip()
    if not s:
        return False
    # 类似 line-search.range_search.comparison 这类页面键不应强制出现在报告正文中
    if re.fullmatch(r"[a-z0-9_.\-/]+", s.casefold()) and ("." in s or "/" in s or "_" in s):
        return True
    return False


def _canonical_header_label(text: str) -> str:
    s = _normalize_match_text(text)
    if not s:
        return ""

    rules: list[tuple[str, tuple[str, ...]]] = [
        ("iter", ("iter", "iteration", "step", "epoch", "轮", "次", "迭代", "k")),
        ("a", ("left", "lower", "xmin", "xlow", "左端", "下界", "a")),
        ("b", ("right", "upper", "xmax", "xup", "右端", "上界", "b")),
        ("x", ("xstar", "xopt", "argmin", "最优点", "最优x", "x")),
        ("fx", ("fx", "f(x)", "objective", "obj", "目标函数值", "函数值", "z", "w")),
        ("grad", ("grad", "gradient", "导数", "梯度", "df")),
        ("acc", ("accuracy", "acc", "正确率", "准确率", "精度")),
        ("alpha", ("alpha", "α")),
        ("beta", ("beta", "β")),
        ("epsilon", ("epsilon", "eps", "tol", "误差", "阈值", "精度阈值")),
        ("time", ("time", "耗时", "ms", "秒")),
    ]
    for label, kws in rules:
        if any(_normalize_match_text(k) in s for k in kws if k):
            return label
    return s


def _extract_markdown_table_headers(text: str) -> list[str]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    table_lines = [ln for ln in lines if ln.startswith("|") and ln.endswith("|")]
    if not table_lines:
        return []
    header_line = table_lines[0]
    cells = [c.strip() for c in header_line.strip("|").split("|")]
    return [c for c in cells if c]


def _fact_variants(expected: str) -> list[str]:
    base = (expected or "").strip()
    if not base:
        return []
    variants = {base}
    suffix_terms = ["性质对比", "对比实验", "观察实验", "可视化实验", "可视化", "实验", "方法"]
    for term in suffix_terms:
        if base.endswith(term):
            cut = base[: -len(term)].strip()
            if len(cut) >= 2:
                variants.add(cut)
    # 英文/路径风格字段，补充分词片段
    for tk in re.split(r"[._\-/\s]+", base):
        t = tk.strip()
        if len(t) >= 3:
            variants.add(t)
    return [v for v in variants if v]


def _parse_markdown_sections(md_text: str) -> dict[str, str]:
    pattern = re.compile(r"^##\s+(.+?)\s*$", flags=re.MULTILINE)
    matches = list(pattern.finditer(md_text))
    if not matches:
        return {}
    sections: dict[str, str] = {}
    for idx, m in enumerate(matches):
        title = m.group(1).strip()
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(md_text)
        sections[title] = md_text[start:end].strip()
    return sections


def _extract_markdown_table_rows(text: str) -> int:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    table_lines = [ln for ln in lines if ln.startswith("|") and ln.endswith("|")]
    if len(table_lines) < 2:
        return 0
    # 常见至少包括表头和分隔线
    return max(0, len(table_lines) - 2)


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for ln in f:
            line = ln.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def _format_summary_value(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        try:
            return json.dumps(v, ensure_ascii=False)
        except Exception:
            return str(v)
    return str(v)


def _is_list_of_dicts(v: Any) -> bool:
    return isinstance(v, list) and len(v) > 0 and all(isinstance(item, dict) for item in v)


def _flatten_payload(obj: Any, prefix: str = "payload", out: dict[str, Any] | None = None) -> dict[str, Any]:
    if out is None:
        out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}"
            if isinstance(v, dict):
                _flatten_payload(v, key, out)
            else:
                out[key] = v
    else:
        out[prefix] = obj
    return out


def _extract_iteration_tables_from_obj(
    obj: Any, prefix: str = "payload"
) -> dict[str, dict[str, Any]]:
    tables: dict[str, dict[str, Any]] = {}
    if not isinstance(obj, dict):
        return tables
    for k, v in obj.items():
        path = f"{prefix}.{k}"
        key_lower = str(k).lower()
        if _is_list_of_dicts(v) and (
            "iteration" in key_lower
            or "history" in key_lower
            or "tableau" in key_lower
            or "process" in key_lower
            or "log" in key_lower
        ):
            first = v[0]
            headers = [str(col) for col in first.keys()]
            rows = [[str(item.get(col, "")) for col in first.keys()] for item in v]
            tables[path] = {"headers": headers, "rows": rows}
            continue
        if isinstance(v, dict):
            tables.update(_extract_iteration_tables_from_obj(v, path))
    return tables


def _load_profile_config(path: Path) -> dict[str, Any]:
    cfg = _load_json(path)
    profiles_raw = cfg.get("profiles", []) if isinstance(cfg, dict) else []
    profiles: dict[str, dict[str, Any]] = {}
    alias_map: dict[str, str] = {}
    for item in profiles_raw:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key", "")).strip()
        if not key:
            continue
        profiles[key] = item
        for alias in item.get("aliases", []) or []:
            alias_text = str(alias).strip()
            if alias_text:
                alias_map[alias_text] = key
    return {
        "id": str(cfg.get("id", "profiles-v1")) if isinstance(cfg, dict) else "profiles-v1",
        "default": (cfg.get("default", {}) if isinstance(cfg, dict) else {}) or {},
        "profiles": profiles,
        "alias_to_key": alias_map,
    }


def _resolve_experiment_profile(experiment_key: str, profile_config: dict[str, Any]) -> tuple[str, dict[str, Any], bool]:
    aliases = profile_config.get("alias_to_key", {}) or {}
    profiles = profile_config.get("profiles", {}) or {}
    default_profile = profile_config.get("default", {}) or {}
    canonical = aliases.get(experiment_key, experiment_key)
    profile = profiles.get(canonical)
    if isinstance(profile, dict):
        return canonical, profile, True
    return canonical, default_profile, False


@dataclass
class ParsedRecordExport:
    summary: dict[str, str]
    payload_flat: dict[str, Any]
    iteration_tables: dict[str, dict[str, Any]]
    raw_text: str
    record_format: str


def parse_record_export_csv(path: Path) -> ParsedRecordExport:
    raw_csv = path.read_text(encoding="utf-8-sig", errors="replace")
    rows = list(csv.reader(raw_csv.splitlines()))

    summary: dict[str, str] = {}
    payload_flat: dict[str, Any] = {}
    iteration_tables: dict[str, dict[str, Any]] = {}

    i = 0
    n = len(rows)

    # 1) 摘要区
    if i < n and len(rows[i]) >= 2 and rows[i][0].strip() == "项目":
        i += 1
        while i < n and not _is_blank_row(rows[i]):
            row = rows[i]
            key = row[0].strip() if row else ""
            val = row[1].strip() if len(row) > 1 else ""
            if key:
                summary[key] = val
            i += 1

    while i < n and _is_blank_row(rows[i]):
        i += 1

    # 2) 字段扁平区
    if i < n and len(rows[i]) >= 2 and rows[i][0].strip() == "字段路径":
        i += 1
        while i < n and not _is_blank_row(rows[i]):
            row = rows[i]
            key = row[0].strip() if row else ""
            val = row[1].strip() if len(row) > 1 else ""
            if key:
                payload_flat[key] = _deserialize_value(val)
            i += 1

    # 3) 多段迭代表
    while i < n:
        while i < n and _is_blank_row(rows[i]):
            i += 1
        if i >= n:
            break

        title = "payload.iteration_data"
        row = rows[i]
        if row and row[0].strip().startswith("迭代数据："):
            title = row[0].strip().replace("迭代数据：", "", 1).strip() or title
            i += 1
            if i >= n:
                break
            headers = rows[i]
            i += 1
        else:
            headers = row
            i += 1

        table_rows: list[list[str]] = []
        while i < n:
            cur = rows[i]
            if _is_blank_row(cur):
                i += 1
                break
            if cur and cur[0].strip().startswith("迭代数据："):
                break
            table_rows.append(cur)
            i += 1

        if headers:
            iteration_tables[title] = {"headers": headers, "rows": table_rows}

    if not summary and not payload_flat and not iteration_tables and rows:
        header = [str(x) for x in rows[0]]
        body = [[str(x) for x in r] for r in rows[1:] if not _is_blank_row(r)]
        if header:
            iteration_tables["raw.table"] = {"headers": header, "rows": body}

    return ParsedRecordExport(
        summary=summary,
        payload_flat=payload_flat,
        iteration_tables=iteration_tables,
        raw_text=raw_csv,
        record_format="csv",
    )


def parse_record_export_json(path: Path) -> ParsedRecordExport:
    raw_text = path.read_text(encoding="utf-8", errors="replace")
    try:
        obj = json.loads(raw_text)
    except Exception:
        obj = {}

    source_page = ""
    payload: dict[str, Any] = {}
    if isinstance(obj, dict):
        if isinstance(obj.get("payload"), dict):
            payload = obj.get("payload") or {}
            source_page = str(obj.get("source_page") or "")
        else:
            payload = obj
            source_page = str(obj.get("source_page") or "")

    payload_flat = _flatten_payload(payload, "payload")
    if source_page and "payload.source_page" not in payload_flat:
        payload_flat["payload.source_page"] = source_page

    summary = {
        "原函数/目标": _format_summary_value(
            payload.get("test_function") or payload.get("function") or ""
        ),
        "算法": _format_summary_value(
            payload.get("algorithm_name") or payload.get("algorithm") or ""
        ),
        "初始参数": _format_summary_value(
            payload.get("initial_state") or payload.get("initial_params") or {}
        ),
        "来源页面": _format_summary_value(
            source_page or payload.get("source_page") or payload.get("experiment_module") or ""
        ),
    }
    iteration_tables = _extract_iteration_tables_from_obj(payload, "payload")
    return ParsedRecordExport(
        summary=summary,
        payload_flat=payload_flat,
        iteration_tables=iteration_tables,
        raw_text=raw_text,
        record_format="json",
    )


def parse_record_export(path: Path) -> ParsedRecordExport:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return parse_record_export_csv(path)
    if suffix == ".json":
        return parse_record_export_json(path)
    raise ValueError(f"不支持的实验导出文件类型: {path.name}")


def build_expected_answer(
    parsed: ParsedRecordExport,
    *,
    experiment_key: str,
    profile: dict[str, Any],
) -> dict[str, Any]:
    summary = parsed.summary
    flat = parsed.payload_flat

    def pick_from_flat(paths: list[str]) -> Any:
        for p in paths:
            if p in flat and flat[p] not in (None, ""):
                return flat[p]
        return None

    algorithm = _pick_first_non_empty(
        summary.get("算法"),
        flat.get("payload.algorithm_name"),
        flat.get("payload.algorithm"),
    )
    objective = _pick_first_non_empty(
        summary.get("原函数/目标"),
        flat.get("payload.test_function"),
        flat.get("payload.function"),
    )
    source_page = _pick_first_non_empty(
        summary.get("来源页面"),
        flat.get("payload.source_page"),
        flat.get("payload.experiment_module"),
    )

    required_facts: list[dict[str, Any]] = []
    seen_fact_expected: set[str] = set()

    def append_fact(
        field_name: str,
        expected_val: Any,
        *,
        path: str = "",
        importance: str = "normal",
    ) -> None:
        if isinstance(expected_val, (int, float, bool, dict, list)) or expected_val is None:
            return
        text = _pick_first_non_empty(expected_val)
        if not text:
            return
        if _looks_like_internal_identifier(text):
            return
        if len(text) > 160:
            return
        key = text.casefold()
        if key in seen_fact_expected:
            return
        seen_fact_expected.add(key)
        required_facts.append(
            {
                "field": field_name,
                "path": path,
                "expected": text,
                "match_type": "fuzzy_contains",
                "importance": importance,
            }
        )

    if algorithm:
        append_fact("algorithm", algorithm, importance="high")
    if objective:
        append_fact("objective", objective, importance="normal")

    report_fact_paths = [
        str(x)
        for x in (profile.get("report_fact_paths", []) or [])
        if isinstance(x, str)
    ]
    if not report_fact_paths:
        candidate_paths = [
            str(x)
            for x in (profile.get("required_fact_paths", []) or [])
            if isinstance(x, str)
        ]
        fact_hint_terms = (
            "status",
            "accuracy",
            "x_star",
            "objective",
            "profit",
            "price",
            "sample_count",
            "dataset",
            "source",
            "phase1",
            "phase2",
        )
        report_fact_paths = [p for p in candidate_paths if any(t in p.casefold() for t in fact_hint_terms)]
        if not report_fact_paths:
            report_fact_paths = candidate_paths[:2]
    for idx, path in enumerate(report_fact_paths):
        if not isinstance(path, str):
            continue
        if path.startswith("summary."):
            val = summary.get(path.replace("summary.", "", 1))
        else:
            val = flat.get(path)
        path_l = path.casefold()
        importance = "normal" if any(k in path_l for k in ("algorithm", "function", "status", "dataset")) else "low"
        append_fact(
            f"profile_fact_{idx+1}",
            val,
            path=path,
            importance=importance,
        )

    if len(required_facts) > 4:
        importance_rank = {"high": 0, "normal": 1, "low": 2}
        required_facts = sorted(
            required_facts,
            key=lambda x: (
                importance_rank.get(str(x.get("importance", "normal")).lower(), 3),
                len(str(x.get("expected", ""))),
            ),
        )[:4]

    patterns = profile.get("numeric_patterns", []) or [
        "x_star",
        "objective_value",
        "accuracy",
        "result",
        "final",
        "iteration",
        "sample_count",
        "length",
        "epsilon",
        "alpha",
        "beta",
        "c",
    ]
    pattern_scores: dict[str, int] = {str(p).lower(): 12 - i for i, p in enumerate(patterns)}

    preferred_numeric_paths = [
        str(x)
        for x in (profile.get("numeric_priority_paths", []) or [])
        if isinstance(x, str)
    ]
    numeric_expectations: list[dict[str, Any]] = []
    seen_numeric_name: set[str] = set()

    for path in preferred_numeric_paths:
        val = flat.get(path)
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            continue
        numeric_expectations.append(
            {"name": path, "value": float(val), "abs_tolerance": 1e-6, "rel_tolerance": 0.02}
        )
        seen_numeric_name.add(path)

    numeric_candidates: list[tuple[int, str, float]] = []
    for key, val in flat.items():
        if key in seen_numeric_name:
            continue
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            continue
        score = 1
        k_lower = key.lower()
        for ptn, p_score in pattern_scores.items():
            if ptn and ptn in k_lower:
                score = max(score, int(p_score))
        numeric_candidates.append((score, key, float(val)))
    numeric_candidates.sort(key=lambda x: (-x[0], x[1]))

    max_numeric = int(profile.get("max_numeric_expectations", 12))
    for _, key, val in numeric_candidates[:max(0, max_numeric - len(numeric_expectations))]:
        numeric_expectations.append(
            {"name": key, "value": val, "abs_tolerance": 1e-6, "rel_tolerance": 0.02}
        )

    table_titles: list[str] = []
    table_headers: list[str] = []
    table_sample_numbers: list[float] = []
    total_iteration_rows = 0
    for title, table in parsed.iteration_tables.items():
        if not isinstance(table, dict):
            continue
        rows = table.get("rows", [])
        headers = table.get("headers", [])
        if isinstance(rows, list):
            total_iteration_rows += len(rows)
        if isinstance(title, str) and title:
            table_titles.append(title)
        if isinstance(headers, list):
            for h in headers:
                hs = str(h).strip()
                if hs and hs not in table_headers:
                    table_headers.append(hs)
        if isinstance(rows, list):
            for row in rows[:8]:
                if not isinstance(row, list):
                    continue
                for cell in row:
                    nums = _extract_numbers(str(cell))
                    for n in nums:
                        if n not in table_sample_numbers:
                            table_sample_numbers.append(n)
                        if len(table_sample_numbers) >= 20:
                            break
                    if len(table_sample_numbers) >= 20:
                        break
                if len(table_sample_numbers) >= 20:
                    break

    require_data_table = profile.get("require_data_table")
    if require_data_table is None:
        require_data_table = total_iteration_rows > 0
    min_rows = int(profile.get("min_table_rows", 1 if require_data_table else 0))
    min_math_chars = int(profile.get("min_math_chars", 40))
    min_data_chars = int(profile.get("min_data_chars", 30))

    constraints = {
        "math_principle_disallow_terms": ["待补充"],
        "expected_summary_placeholder": "（由用户填写）",
    }
    constraints.update(dict(profile.get("constraints", {}) or {}))

    expected_header_canonicals = list(
        dict.fromkeys(_canonical_header_label(h) for h in table_headers if _canonical_header_label(h))
    )
    anchor_keywords = (
        "x_star",
        "xopt",
        "optimal",
        "objective",
        "accuracy",
        "profit",
        "price",
        "final",
        "result",
        "epsilon",
        "tol",
        "beta",
        "alpha",
        "w",
        "b",
    )
    preferred_anchors = []
    for x in numeric_expectations:
        if not isinstance(x, dict):
            continue
        name = str(x.get("name", "")).casefold()
        value = x.get("value")
        if isinstance(value, (int, float)) and any(k in name for k in anchor_keywords):
            preferred_anchors.append(float(value))

    numeric_anchors = list(
        dict.fromkeys(
            preferred_anchors[:8] + table_sample_numbers[:8]
        )
    )[:14]

    return {
        "must_include_sections": list(profile.get("must_include_sections", REQUIRED_SECTIONS)),
        "required_facts": required_facts,
        "numeric_expectations": numeric_expectations,
        "data_table_expectation": {
            "required": bool(require_data_table),
            "min_rows": min_rows,
        },
        "data_evidence_expectations": {
            "expected_table_titles": table_titles,
            "expected_headers": table_headers,
            "expected_header_canonicals": expected_header_canonicals,
            "expected_total_rows": total_iteration_rows,
            "sample_numbers": table_sample_numbers[:20],
            "numeric_anchors": numeric_anchors,
        },
        "section_quality_expectations": {
            "min_math_chars": min_math_chars,
            "min_data_chars": min_data_chars,
            "prefer_formula_markers": bool(profile.get("prefer_formula_markers", True)),
        },
        "constraints": constraints,
        "profile_context": {
            "experiment_key": experiment_key,
            "profile_name": str(profile.get("name", "default")),
        },
    }


def _norm_compact_text(text: str) -> str:
    return re.sub(r"[^0-9a-z]+", "", (text or "").casefold())


def _infer_key_by_keyword_score(
    combined_text: str,
    profile_config: dict[str, Any] | None,
) -> str:
    if not profile_config:
        return ""
    profiles = profile_config.get("profiles", {}) or {}
    if not isinstance(profiles, dict) or not profiles:
        return ""

    keyword_hints: dict[str, list[str]] = {
        "line-search.range_search.observation": ["黄金分割法", "斐波那契", "二分法", "区间", "单谷函数"],
        "line-search.range_search.comparison": ["区间收缩法", "对比", "黄金分割法", "斐波那契", "二分法"],
        "line-search.point_search.observation": ["梯度下降法", "牛顿法", "割线法", "点搜索"],
        "line-search.point_search.comparison": ["点搜索", "对比", "梯度下降法", "牛顿法", "割线法"],
        "line-search.application.main": ["需求曲线", "拟合", "利润", "定价", "beta", "alpha", "价格"],
        "linear-programming.simplex": ["单纯形法", "线性规划", "tableau", "max z", "min z"],
        "linear-programming.two_phase": ["两阶段法", "phase1", "phase2", "人工变量"],
        "svm-smo.smo_iteration.observation": ["smo", "支持向量机", "svm", "accuracy", "对偶"],
        "svm-smo.kernel_trick.visualization": ["核技巧", "kernel", "升维", "平面", "映射"],
        "neural-network.gd": ["神经网络", "梯度下降优化", "optimizer", "adam", "momentum", "rmsprop", "epoch", "学习率", "loss", "全连接", "激活函数"],
    }

    text_cf = (combined_text or "").casefold()
    text_compact = _norm_compact_text(combined_text or "")
    best_key = ""
    best_score = 0
    for key in profiles.keys():
        score = 0
        hints = keyword_hints.get(key, [])
        for kw in hints:
            kw_cf = str(kw).casefold()
            kw_compact = _norm_compact_text(kw)
            if kw_cf and kw_cf in text_cf:
                score += 3
            elif kw_compact and kw_compact in text_compact:
                score += 2
        key_tokens = re.split(r"[^a-z]+", key.casefold())
        for token in key_tokens:
            if len(token) < 4:
                continue
            if token in text_cf:
                score += 1
        if score > best_score:
            best_key = key
            best_score = score
    return best_key if best_score > 0 else ""


def infer_experiment_key(
    parsed: ParsedRecordExport,
    *,
    report_markdown: str = "",
    profile_config: dict[str, Any] | None = None,
    case_id: str = "",
    record_name: str = "",
    report_name: str = "",
) -> str:
    summary = parsed.summary
    flat = parsed.payload_flat
    direct = _pick_first_non_empty(
        summary.get("来源页面"),
        flat.get("payload.source_page"),
        flat.get("payload.experiment_module"),
    )
    if direct:
        return direct

    keys = set(flat.keys())

    def has_prefix(prefix: str) -> bool:
        return any(k.startswith(prefix) for k in keys)

    def pick_text(*vals: Any) -> str:
        return _pick_first_non_empty(*vals).casefold()

    algo_text = pick_text(
        summary.get("算法"),
        flat.get("payload.algorithm_name"),
        flat.get("payload.algorithm"),
    )
    objective_text = pick_text(
        summary.get("原函数/目标"),
        flat.get("payload.test_function"),
        flat.get("payload.function"),
    )

    # linear-programming.two_phase
    if (
        has_prefix("payload.phase1_iteration_data")
        or has_prefix("payload.phase2_iteration_data")
        or has_prefix("payload.phase1_result")
        or has_prefix("payload.phase2_result")
        or "两阶段法" in algo_text
    ):
        return "linear-programming.two_phase"

    # linear-programming.simplex
    if (
        has_prefix("payload.result.objective_value")
        or has_prefix("payload.result.status")
        or has_prefix("payload.initial_state.solve_type")
        or "单纯形法" in algo_text
    ):
        return "linear-programming.simplex"

    # line-search.application.main
    if (
        has_prefix("payload.ls.")
        or has_prefix("payload.profit.")
        or "l(β)" in objective_text
        or "π" in objective_text
    ):
        return "line-search.application.main"

    # line-search.range_search.comparison
    if (
        has_prefix("payload.iteration_log.golden")
        and has_prefix("payload.iteration_log.fibonacci")
        and has_prefix("payload.iteration_log.bisection")
    ) or "区间收缩法性质对比" in algo_text:
        return "line-search.range_search.comparison"

    # line-search.point_search.comparison
    if "点搜索三算法对比" in algo_text:
        return "line-search.point_search.comparison"

    # svm-smo.kernel_trick.visualization
    if (
        has_prefix("payload.map_expression")
        or has_prefix("payload.plane_params")
        or has_prefix("payload.current_accuracy_percent")
    ):
        return "svm-smo.kernel_trick.visualization"

    # svm-smo.smo_iteration.observation
    if (
        has_prefix("payload.dataset_meta.sample_count")
        and has_prefix("payload.final_result.accuracy")
    ) or ("smo" in algo_text):
        return "svm-smo.smo_iteration.observation"

    # neural-network.gd
    if (
        has_prefix("payload.optimizer")
        and has_prefix("payload.loss_function")
        and (has_prefix("payload.loss_history") or has_prefix("payload.network_structure"))
    ) or ("神经网络" in algo_text or "梯度下降优化" in algo_text):
        return "neural-network.gd"

    # line-search.range_search.observation
    if (
        has_prefix("payload.initial_state.initial_a")
        and has_prefix("payload.initial_state.initial_b")
        and ("黄金分割法" in algo_text or "斐波那契" in algo_text or "二分法" in algo_text)
    ):
        return "line-search.range_search.observation"

    # line-search.point_search.observation
    if (
        has_prefix("payload.initial_state.x_0")
        and ("梯度下降法" in algo_text or "牛顿法" in algo_text or "割线法" in algo_text)
    ):
        return "line-search.point_search.observation"

    # 文件名/CaseID 命中（支持把实验键写进文件名）
    aliases = (profile_config or {}).get("alias_to_key", {}) if profile_config else {}
    profiles = (profile_config or {}).get("profiles", {}) if profile_config else {}
    haystacks = [
        _norm_compact_text(case_id),
        _norm_compact_text(record_name),
        _norm_compact_text(report_name),
    ]
    for alias, canonical in aliases.items():
        a = _norm_compact_text(alias)
        if not a:
            continue
        if any(a in h for h in haystacks if h):
            return canonical
    for key in profiles.keys():
        k = _norm_compact_text(key)
        if not k:
            continue
        if any(k in h for h in haystacks if h):
            return key

    # 报告文本关键词兜底
    combined = "\n".join(
        [
            _pick_first_non_empty(summary.get("算法"), flat.get("payload.algorithm_name"), flat.get("payload.algorithm")),
            _pick_first_non_empty(summary.get("原函数/目标"), flat.get("payload.test_function"), flat.get("payload.function")),
            report_markdown or "",
            " ".join(flat.keys()),
        ]
    )
    by_kw = _infer_key_by_keyword_score(combined, profile_config)
    if by_kw:
        return by_kw

    # 结构匹配兜底：按各 profile 关键字段命中率选最可能实验
    profiles_dict = (profile_config or {}).get("profiles", {}) if profile_config else {}
    if isinstance(profiles_dict, dict) and profiles_dict:
        best_key = ""
        best_score = 0
        for p_key, p_conf in profiles_dict.items():
            if not isinstance(p_conf, dict):
                continue
            score = 0
            for path in p_conf.get("required_fact_paths", []) or []:
                if not isinstance(path, str):
                    continue
                v = summary.get(path.replace("summary.", "", 1)) if path.startswith("summary.") else flat.get(path)
                if v not in (None, "", [], {}):
                    score += 3
            for path in p_conf.get("numeric_priority_paths", []) or []:
                if not isinstance(path, str):
                    continue
                v = flat.get(path)
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    score += 2
            if score > best_score:
                best_score = score
                best_key = p_key
        if best_score > 0 and best_key:
            return best_key

    return "unknown.experiment"


def pair_case_files(
    records_dir: Path,
    reports_dir: Path,
    record_globs: list[str],
    report_globs: list[str],
) -> tuple[dict[str, Path], dict[str, Path]]:
    record_map: dict[str, Path] = {}
    for pattern in record_globs:
        for p in sorted(records_dir.glob(pattern)):
            if not p.is_file():
                continue
            if p.suffix.lower() not in SUPPORTED_RECORD_SUFFIXES:
                continue
            record_map[_normalize_case_id(p.stem)] = p

    report_map: dict[str, Path] = {}
    for pattern in report_globs:
        for p in sorted(reports_dir.glob(pattern)):
            if p.is_file():
                report_map[_normalize_case_id(p.stem)] = p
    return record_map, report_map


def cmd_build(args: argparse.Namespace) -> int:
    records_dir = Path(args.records_dir).resolve()
    reports_dir = Path(args.reports_dir).resolve()
    out_jsonl = Path(args.out_jsonl).resolve()
    out_manifest = Path(args.out_manifest).resolve() if args.out_manifest else None
    profiles_path = (
        Path(args.profiles).resolve() if args.profiles else DEFAULT_PROFILES_PATH.resolve()
    )
    profile_config = _load_profile_config(profiles_path)

    record_map, report_map = pair_case_files(
        records_dir=records_dir,
        reports_dir=reports_dir,
        record_globs=args.record_glob,
        report_globs=args.report_glob,
    )

    common_ids = sorted(set(record_map.keys()) & set(report_map.keys()))
    missing_report = sorted(set(record_map.keys()) - set(report_map.keys()))
    missing_record = sorted(set(report_map.keys()) - set(record_map.keys()))
    profile_coverage: dict[str, int] = {}
    unknown_profile_cases: list[str] = []

    dataset_rows: list[dict[str, Any]] = []
    for case_id in common_ids:
        record_path = record_map[case_id]
        report_path = report_map[case_id]
        parsed = parse_record_export(record_path)
        report_md = report_path.read_text(encoding="utf-8", errors="replace")
        sections = _parse_markdown_sections(report_md)
        inferred_experiment_key = infer_experiment_key(
            parsed,
            report_markdown=report_md,
            profile_config=profile_config,
            case_id=case_id,
            record_name=record_path.name,
            report_name=report_path.name,
        )
        canonical_key, profile, profile_known = _resolve_experiment_profile(
            inferred_experiment_key, profile_config
        )
        expected = build_expected_answer(
            parsed,
            experiment_key=canonical_key,
            profile=profile,
        )
        experiment_key = canonical_key
        profile_coverage[experiment_key] = profile_coverage.get(experiment_key, 0) + 1
        if not profile_known:
            unknown_profile_cases.append(case_id)

        dataset_rows.append(
            {
                "id": case_id,
                "experiment_key": experiment_key,
                "experiment_profile": {
                    "config_id": profile_config.get("id"),
                    "profile_name": str(profile.get("name", "default")),
                    "profile_known": profile_known,
                    "inferred_key_raw": inferred_experiment_key,
                },
                "source": {
                    "record_export_file": str(record_path),
                    "ai_report_file": str(report_path),
                },
                "raw_input": {
                    "record_summary": parsed.summary,
                    "record_payload_flat": parsed.payload_flat,
                    "record_iteration_tables": parsed.iteration_tables,
                    "record_export_raw": parsed.raw_text,
                    "record_export_format": parsed.record_format,
                },
                "raw_output": {
                    "ai_report_markdown": report_md,
                    "ai_report_sections": sections,
                },
                "expected_answer": expected,
                "scoring_rubric_id": args.rubric_id,
            }
        )

    _write_jsonl(out_jsonl, dataset_rows)

    if out_manifest:
        _write_json(
            out_manifest,
            {
                "total_cases": len(dataset_rows),
                "matched_case_ids": common_ids,
                "missing_report_for_case_ids": missing_report,
                "missing_record_for_case_ids": missing_record,
                "records_dir": str(records_dir),
                "reports_dir": str(reports_dir),
                "dataset_jsonl": str(out_jsonl),
                "rubric_id": args.rubric_id,
                "profiles_file": str(profiles_path),
                "profile_coverage": profile_coverage,
                "unknown_profile_case_ids": unknown_profile_cases,
            },
        )

    print(f"[build] 已生成 {len(dataset_rows)} 条评测样本: {out_jsonl}")
    if missing_report:
        print(f"[build] 缺少报告文件的 case: {missing_report}")
    if missing_record:
        print(f"[build] 缺少实验导出文件的 case: {missing_record}")
    if unknown_profile_cases:
        print(f"[build] 存在未命中专属实验配置的 case: {unknown_profile_cases}")
        if args.strict_profiles:
            print("[build] strict_profiles=true，因存在未命中 profile 的样本而失败。")
            return 2
    return 0


def _score_structure(sections: dict[str, str], expected_sections: list[str]) -> tuple[float, dict[str, Any]]:
    normalized_present = {_normalize_heading(k) for k in sections.keys()}
    normalized_expected = [_normalize_heading(x) for x in expected_sections]
    hit = [x for x in normalized_expected if x in normalized_present]
    score = 100.0 * (len(hit) / len(normalized_expected)) if normalized_expected else 100.0
    return score, {"present_sections": list(sections.keys()), "hit_count": len(hit), "expected_count": len(normalized_expected)}


def _get_section_content(sections: dict[str, str], section_name: str) -> str:
    target = _normalize_heading(section_name)
    for name, content in sections.items():
        if _normalize_heading(name) == target:
            return content or ""
    return ""


def _score_facts(report_text: str, required_facts: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    if not required_facts:
        return 100.0, {"matched": 0, "total": 0, "misses": [], "weighted_matched": 0.0, "weighted_total": 0.0}
    report_cf = report_text.casefold()
    report_norm = _normalize_match_text(report_text)
    hit = 0
    weight_hit = 0.0
    weight_total = 0.0
    quality_sum = 0.0
    match_records: list[dict[str, Any]] = []
    misses: list[dict[str, Any]] = []
    weight_map = {"high": 2.0, "normal": 1.0, "low": 0.6}
    for fact in required_facts:
        expected = str(fact.get("expected", "")).strip()
        if not expected:
            continue
        importance = str(fact.get("importance", "normal")).strip().lower()
        weight = float(weight_map.get(importance, 1.0))
        weight_total += weight

        exp_cf = expected.casefold()
        exp_norm = _normalize_match_text(expected)
        matched = False
        match_quality = 0.0
        match_method = ""
        variants = _fact_variants(expected)
        for var in variants:
            var_cf = var.casefold()
            var_norm = _normalize_match_text(var)
            if var_cf and var_cf in report_cf:
                matched = True
                match_quality = 1.0 if var == expected else 0.9
                match_method = "exact_phrase" if var == expected else "variant_phrase"
                break
            if var_norm and var_norm in report_norm:
                matched = True
                match_quality = 0.95 if var == expected else 0.85
                match_method = "normalized" if var == expected else "variant_normalized"
                break
        if (not matched) and len(exp_norm) >= 8:
            # 对较长短语做片段命中，降低“措辞略有差异”的误伤
            for win in (8, 6, 4):
                if len(exp_norm) < win:
                    continue
                if any(exp_norm[i : i + win] in report_norm for i in range(0, len(exp_norm) - win + 1)):
                    matched = True
                    match_quality = 0.72
                    match_method = "fragment"
                    break

        if matched:
            hit += 1
            weight_hit += (weight * match_quality)
            quality_sum += match_quality
            match_records.append(
                {
                    "field": fact.get("field"),
                    "path": fact.get("path"),
                    "expected": expected,
                    "importance": importance,
                    "method": match_method,
                    "quality": round(match_quality, 3),
                }
            )
        else:
            misses.append(fact)
    score = (100.0 * (weight_hit / weight_total)) if weight_total > 0 else 100.0
    # 当可评估事实过少时，不给满分，避免所有样本都 100 分
    if weight_total <= 2.1:
        score = min(score, 95.0)
    elif weight_total <= 3.2:
        score = min(score, 97.0)
    return score, {
        "matched": hit,
        "total": len(required_facts),
        "misses": misses,
        "weighted_matched": round(weight_hit, 3),
        "weighted_total": round(weight_total, 3),
        "avg_match_quality": round((quality_sum / hit), 3) if hit else 0.0,
        "matches": match_records,
    }


def _score_numeric(report_text: str, numeric_expectations: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    if not numeric_expectations:
        return 100.0, {"matched": 0, "total": 0, "misses": []}
    report_numbers = _extract_numbers(report_text)
    if not report_numbers:
        return 0.0, {"matched": 0, "total": len(numeric_expectations), "misses": numeric_expectations}

    matched = 0
    misses: list[dict[str, Any]] = []
    for item in numeric_expectations:
        val = item.get("value")
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            continue
        target = float(val)
        atol = float(item.get("abs_tolerance", 1e-6))
        rtol = float(item.get("rel_tolerance", 0.02))
        tol = max(atol, abs(target) * rtol)
        ok = any(math.isfinite(num) and abs(num - target) <= tol for num in report_numbers)
        if ok:
            matched += 1
        else:
            misses.append(item)
    total = len(numeric_expectations)
    return 100.0 * (matched / total) if total else 100.0, {"matched": matched, "total": total, "misses": misses}


def _score_data_evidence(sections: dict[str, str], table_expectation: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    data_section = _get_section_content(sections, "实验数据")
    rows = _extract_markdown_table_rows(data_section)
    required = bool(table_expectation.get("required", False))
    min_rows = int(table_expectation.get("min_rows", 0))
    if not required:
        return 100.0, {"required": False, "table_rows": rows, "min_rows": min_rows}
    score = 100.0 if rows >= min_rows else (40.0 if rows > 0 else 0.0)
    return score, {"required": True, "table_rows": rows, "min_rows": min_rows}


def _score_data_alignment(
    sections: dict[str, str],
    data_expectations: dict[str, Any],
) -> tuple[float, dict[str, Any]]:
    data_section = _get_section_content(sections, "实验数据")
    if not data_section.strip():
        return 0.0, {"matched_numbers": 0, "total_numbers": 0, "header_hits": 0, "header_total": 0}

    expected_numbers_raw = data_expectations.get("numeric_anchors", []) or data_expectations.get("sample_numbers", []) or []
    expected_numbers = [
        float(x)
        for x in expected_numbers_raw
        if isinstance(x, (int, float)) and not isinstance(x, bool)
    ][:10]
    report_numbers = _extract_numbers(data_section)

    matched = 0
    for target in expected_numbers:
        tol = max(1e-6, abs(target) * 0.05)
        if any(math.isfinite(v) and abs(v - target) <= tol for v in report_numbers):
            matched += 1

    expected_headers_raw = data_expectations.get("expected_header_canonicals", []) or data_expectations.get("expected_headers", []) or []
    expected_headers = list(
        dict.fromkeys(
            _canonical_header_label(str(x).strip()) for x in expected_headers_raw if str(x).strip()
        )
    )[:8]
    report_headers = list(
        dict.fromkeys(
            _canonical_header_label(x) for x in _extract_markdown_table_headers(data_section) if _canonical_header_label(x)
        )
    )
    report_header_set = set(report_headers)
    header_hits = sum(1 for h in expected_headers if h in report_header_set)
    report_rows = _extract_markdown_table_rows(data_section)
    expected_total_rows = int(data_expectations.get("expected_total_rows", 0) or 0)
    target_rows = min(max(1, expected_total_rows), 5) if expected_total_rows > 0 else 2
    row_ratio = min(1.0, report_rows / max(1, target_rows))

    num_ratio = (matched / len(expected_numbers)) if expected_numbers else 1.0
    header_ratio = (header_hits / len(expected_headers)) if expected_headers else 1.0
    if not expected_numbers and not expected_headers:
        # 无明确对齐目标时，按数据章节信息量给保守分，避免虚高到 100
        baseline = 65.0
        score = baseline + min(20.0, report_rows * 8.0) + min(10.0, len(report_headers) * 2.0)
    else:
        score = (num_ratio * 35.0) + (header_ratio * 45.0) + (row_ratio * 20.0)
    signal_count = len(expected_numbers) + len(expected_headers)
    if signal_count <= 2:
        score = min(score, 92.0)
    elif signal_count <= 4:
        score = min(score, 96.0)
    return score, {
        "matched_numbers": matched,
        "total_numbers": len(expected_numbers),
        "header_hits": header_hits,
        "header_total": len(expected_headers),
        "expected_headers": expected_headers,
        "report_headers": report_headers,
        "report_rows": report_rows,
        "target_rows": target_rows,
        "row_ratio": round(row_ratio, 4),
        "signal_count": signal_count,
    }


def _score_section_quality(
    sections: dict[str, str],
    quality_expectations: dict[str, Any],
) -> tuple[float, dict[str, Any]]:
    math_text = _get_section_content(sections, "数学原理")
    data_text = _get_section_content(sections, "实验数据")
    summary_text = _get_section_content(sections, "实验总结")

    min_math_chars = int(quality_expectations.get("min_math_chars", 40))
    min_data_chars = int(quality_expectations.get("min_data_chars", 30))
    prefer_formula_markers = bool(quality_expectations.get("prefer_formula_markers", True))

    math_len = len(math_text.strip())
    data_len = len(data_text.strip())
    has_formula_marker = any(x in math_text for x in ("$", "\\(", "\\[", "=", "∇", "f(", "L("))
    has_summary = len(summary_text.strip()) > 0

    math_score = 100.0 if math_len >= min_math_chars else max(0.0, (math_len / max(1, min_math_chars)) * 100.0)
    data_score = 100.0 if data_len >= min_data_chars else max(0.0, (data_len / max(1, min_data_chars)) * 100.0)
    formula_score = 100.0 if (not prefer_formula_markers or has_formula_marker) else 45.0
    summary_score = 100.0 if has_summary else 20.0

    score = (math_score * 0.35) + (data_score * 0.35) + (formula_score * 0.2) + (summary_score * 0.1)
    return score, {
        "math_len": math_len,
        "data_len": data_len,
        "min_math_chars": min_math_chars,
        "min_data_chars": min_data_chars,
        "has_formula_marker": has_formula_marker,
        "has_summary_content": has_summary,
    }


def _score_constraints(sections: dict[str, str], constraints: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    penalty = 0.0
    violations: list[str] = []

    math_text = ""
    summary_text = ""
    for name, content in sections.items():
        n = _normalize_heading(name)
        if n == _normalize_heading("数学原理"):
            math_text = content or ""
        elif n == _normalize_heading("实验总结"):
            summary_text = content or ""

    disallow_terms = constraints.get("math_principle_disallow_terms", []) or []
    for term in disallow_terms:
        if str(term).strip() and str(term) in math_text:
            penalty += 40.0
            violations.append(f"数学原理包含禁用词: {term}")

    expected_summary_placeholder = str(constraints.get("expected_summary_placeholder", "")).strip()
    if expected_summary_placeholder and expected_summary_placeholder not in summary_text:
        penalty += 35.0
        violations.append("实验总结未保留预期占位内容")

    score = max(0.0, 100.0 - penalty)
    return score, {"violations": violations}


def _weighted_total(dimension_scores: dict[str, float], weights: dict[str, float]) -> float:
    if not weights:
        return 0.0
    total_weight = sum(max(0.0, float(w)) for w in weights.values())
    if total_weight <= 0:
        return 0.0
    value = 0.0
    for dim, weight in weights.items():
        value += float(dimension_scores.get(dim, 0.0)) * float(weight)
    return value / total_weight


def _build_dimension_explanations(
    dimension_scores: dict[str, float],
    details: dict[str, Any],
) -> list[dict[str, Any]]:
    explanations: list[dict[str, Any]] = []

    facts = details.get("facts", {}) or {}
    explanations.append(
        {
            "dimension": "fact_consistency",
            "score": round(float(dimension_scores.get("fact_consistency", 0.0)), 2),
            "summary": f"命中事实 {facts.get('matched', 0)}/{facts.get('total', 0)}",
            "improvement": "补充缺失的关键事实字段（算法、状态、核心结论）",
            "evidence": {
                "matched": facts.get("matched", 0),
                "total": facts.get("total", 0),
                "misses": facts.get("misses", []),
            },
        }
    )

    align = details.get("data_alignment", {}) or {}
    explanations.append(
        {
            "dimension": "data_alignment",
            "score": round(float(dimension_scores.get("data_alignment", 0.0)), 2),
            "summary": (
                f"表头命中 {align.get('header_hits', 0)}/{align.get('header_total', 0)}，"
                f"数值命中 {align.get('matched_numbers', 0)}/{align.get('total_numbers', 0)}"
            ),
            "improvement": "补充实验数据表头并覆盖更多关键数值与代表性迭代行",
            "evidence": {
                "expected_headers": align.get("expected_headers", []),
                "report_headers": align.get("report_headers", []),
                "report_rows": align.get("report_rows", 0),
                "target_rows": align.get("target_rows", 0),
            },
        }
    )
    return explanations


def score_case(
    item: dict[str, Any],
    rubric: dict[str, Any],
    *,
    attach_expected: bool = True,
) -> dict[str, Any]:
    expected = item.get("expected_answer", {}) or {}
    raw_output = item.get("raw_output", {}) or {}
    report_text = str(raw_output.get("ai_report_markdown", "") or "")
    sections = _parse_markdown_sections(report_text)

    structure_score, structure_detail = _score_structure(
        sections, list(expected.get("must_include_sections", REQUIRED_SECTIONS))
    )
    facts_score, facts_detail = _score_facts(report_text, list(expected.get("required_facts", [])))
    numeric_score, numeric_detail = _score_numeric(
        report_text, list(expected.get("numeric_expectations", []))
    )
    data_score, data_detail = _score_data_evidence(
        sections, dict(expected.get("data_table_expectation", {}))
    )
    data_alignment_score, data_alignment_detail = _score_data_alignment(
        sections, dict(expected.get("data_evidence_expectations", {}))
    )
    section_quality_score, section_quality_detail = _score_section_quality(
        sections, dict(expected.get("section_quality_expectations", {}))
    )
    constraint_score, constraint_detail = _score_constraints(
        sections, dict(expected.get("constraints", {}))
    )

    dimension_scores = {
        "structure_compliance": structure_score,
        "fact_consistency": facts_score,
        "numeric_consistency": numeric_score,
        "data_evidence": data_score,
        "data_alignment": data_alignment_score,
        "section_quality": section_quality_score,
        "constraint_compliance": constraint_score,
    }
    for k in list(dimension_scores.keys()):
        v = float(dimension_scores[k])
        dimension_scores[k] = max(0.0, min(100.0, v))
    weights = rubric.get("weights", {})
    total_score = _weighted_total(dimension_scores, weights)
    pass_threshold = float(rubric.get("pass_threshold", 75.0))

    hard_rules = dict(rubric.get("hard_rules", {}))
    hard_fail_reasons: list[str] = []
    if hard_rules.get("require_all_sections", True):
        if structure_detail.get("hit_count", 0) < structure_detail.get("expected_count", 0):
            hard_fail_reasons.append("缺少必需章节")
    if hard_rules.get("require_data_table_when_expected", True):
        if data_detail.get("required") and data_detail.get("table_rows", 0) < data_detail.get("min_rows", 0):
            hard_fail_reasons.append("实验数据表格不足")
    min_fact_score = float(hard_rules.get("min_fact_consistency_score", 0))
    if facts_score < min_fact_score:
        hard_fail_reasons.append(f"事实一致性低于阈值({min_fact_score})")
    min_numeric_score = float(hard_rules.get("min_numeric_consistency_score", 0))
    if numeric_score < min_numeric_score:
        hard_fail_reasons.append(f"数值一致性低于阈值({min_numeric_score})")
    if hard_rules.get("fail_on_constraint_violation", False) and constraint_detail.get("violations"):
        hard_fail_reasons.append("存在约束违规项")

    details = {
        "structure": structure_detail,
        "facts": facts_detail,
        "numeric": numeric_detail,
        "data_evidence": data_detail,
        "data_alignment": data_alignment_detail,
        "section_quality": section_quality_detail,
        "constraints": constraint_detail,
    }
    result = {
        "id": item.get("id"),
        "experiment_key": item.get("experiment_key"),
        "scoring_rubric_id": item.get("scoring_rubric_id", rubric.get("id", "default-v1")),
        "total_score": round(total_score, 2),
        "passed": (total_score >= pass_threshold) and (len(hard_fail_reasons) == 0),
        "dimension_scores": {k: round(v, 2) for k, v in dimension_scores.items()},
        "hard_fail_reasons": hard_fail_reasons,
        "details": details,
        "dimension_explanations": _build_dimension_explanations(dimension_scores, details),
    }
    if attach_expected:
        result["expected_answer"] = expected
        result["standard_answer"] = {
            "required_sections": list(expected.get("must_include_sections", [])),
            "key_facts": list(expected.get("required_facts", [])),
            "key_numbers": list(expected.get("numeric_expectations", [])),
            "data_expectation": {
                "table_requirement": dict(expected.get("data_table_expectation", {})),
                "alignment_targets": dict(expected.get("data_evidence_expectations", {})),
            },
            "constraints": dict(expected.get("constraints", {})),
        }
        ep = item.get("experiment_profile", {}) or {}
        result["experiment_adaptation"] = {
            "experiment_key": item.get("experiment_key"),
            "profile_name": ep.get("profile_name"),
            "profile_known": ep.get("profile_known"),
            "inferred_key_raw": ep.get("inferred_key_raw"),
            "profile_context": dict(expected.get("profile_context", {})),
        }
        result["scoring_reference"] = {
            "rubric_id": rubric.get("id", "default-v1"),
            "rubric_name": rubric.get("name", ""),
            "pass_threshold": pass_threshold,
            "weights": dict(rubric.get("weights", {})),
            "dimensions": dict(rubric.get("dimensions", {})),
        }
    return result


def cmd_score(args: argparse.Namespace) -> int:
    dataset_jsonl = Path(args.dataset_jsonl).resolve()
    score_jsonl = Path(args.out_jsonl).resolve()
    summary_json = Path(args.out_summary).resolve() if args.out_summary else None
    rubric_path = Path(args.rubric).resolve() if args.rubric else DEFAULT_RUBRIC_PATH.resolve()

    rows = _read_jsonl(dataset_jsonl)
    rubric = _load_json(rubric_path)

    scored = [
        score_case(item, rubric, attach_expected=(not args.no_attach_expected))
        for item in rows
    ]
    _write_jsonl(score_jsonl, scored)

    if summary_json:
        total = len(scored)
        avg = (sum(x["total_score"] for x in scored) / total) if total else 0.0
        passed = sum(1 for x in scored if x.get("passed"))
        by_exp: dict[str, dict[str, Any]] = {}
        for row in scored:
            ek = str(row.get("experiment_key", "unknown.experiment"))
            if ek not in by_exp:
                by_exp[ek] = {"count": 0, "avg_score": 0.0, "pass_count": 0}
            by_exp[ek]["count"] += 1
            by_exp[ek]["avg_score"] += float(row.get("total_score", 0.0))
            by_exp[ek]["pass_count"] += 1 if row.get("passed") else 0
        for ek, item2 in by_exp.items():
            c = int(item2["count"]) or 1
            item2["avg_score"] = round(float(item2["avg_score"]) / c, 2)
            item2["pass_rate"] = round(float(item2["pass_count"]) / c, 4)

        score_buckets = {
            "90_100": 0,
            "80_89": 0,
            "70_79": 0,
            "60_69": 0,
            "0_59": 0,
        }
        for row in scored:
            s = float(row.get("total_score", 0.0))
            if s >= 90:
                score_buckets["90_100"] += 1
            elif s >= 80:
                score_buckets["80_89"] += 1
            elif s >= 70:
                score_buckets["70_79"] += 1
            elif s >= 60:
                score_buckets["60_69"] += 1
            else:
                score_buckets["0_59"] += 1
        _write_json(
            summary_json,
            {
                "total_cases": total,
                "average_score": round(avg, 2),
                "pass_count": passed,
                "pass_rate": round((passed / total) if total else 0.0, 4),
                "rubric_file": str(rubric_path),
                "score_jsonl": str(score_jsonl),
                "score_distribution": score_buckets,
                "per_experiment": by_exp,
            },
        )

    print(f"[score] 已完成 {len(scored)} 条样本评分: {score_jsonl}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="构建统一实验评测集（原始输入输出+期望答案）并执行自动评分。"
    )
    sp = p.add_subparsers(dest="command", required=True)

    p_build = sp.add_parser("build", help="从实验导出文件和 AI 报告构建统一评测集 JSONL")
    p_build.add_argument("--records-dir", required=True, help="实验导出文件目录（CSV/JSON）")
    p_build.add_argument("--reports-dir", required=True, help="AI 实验报告目录（Markdown）")
    p_build.add_argument(
        "--record-glob",
        action="append",
        default=["*.csv", "*.json"],
        help="实验导出文件匹配模式（可重复传入，多次 --record-glob）",
    )
    p_build.add_argument(
        "--report-glob",
        action="append",
        default=["*.md"],
        help="报告文件匹配模式（可重复传入，多次 --report-glob）",
    )
    p_build.add_argument("--profiles", help="实验适配配置 JSON 路径（默认内置 profiles.v1）")
    p_build.add_argument(
        "--strict-profiles",
        action="store_true",
        help="若样本未命中专属实验配置则返回非 0 退出码",
    )
    p_build.add_argument("--rubric-id", default="default-v1", help="评分规则 ID")
    p_build.add_argument("--out-jsonl", required=True, help="输出评测集 JSONL 路径")
    p_build.add_argument("--out-manifest", help="输出构建清单 JSON 路径")
    p_build.set_defaults(func=cmd_build)

    p_score = sp.add_parser("score", help="对评测集中的 AI 报告自动评分")
    p_score.add_argument("--dataset-jsonl", required=True, help="评测集 JSONL 路径")
    p_score.add_argument("--rubric", help="评分规则 JSON 路径（默认使用内置 default_v1）")
    p_score.add_argument(
        "--no-attach-expected",
        action="store_true",
        help="输出评分结果时不附带 expected_answer 与评分参考（默认附带）",
    )
    p_score.add_argument("--out-jsonl", required=True, help="输出评分结果 JSONL 路径")
    p_score.add_argument("--out-summary", help="输出评分汇总 JSON 路径")
    p_score.set_defaults(func=cmd_score)
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
