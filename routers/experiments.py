import csv
import io
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from dependencies import get_session
from models.user import User
from repository.experiment_repo import ExperimentRecordRepository
from schemas.experiment_record import (
    ExperimentRecordCreate,
    ExperimentRecordAliasUpdate,
    ExperimentRecordDetail,
    ExperimentRecordListItem,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])




# ---------- 实验记录（保存至个人中心） ----------


@router.post(
    "/records",
    response_model=ExperimentRecordDetail,
    status_code=status.HTTP_201_CREATED,
    summary="保存实验数据至个人中心",
)
async def create_experiment_record(
    payload_in: ExperimentRecordCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExperimentRecordDetail:
    repo = ExperimentRecordRepository(session)
    record = await repo.create(
        user_id=current_user.id,
        alias=payload_in.alias,
        source_page=payload_in.source_page,
        payload=payload_in.payload,
    )
    return ExperimentRecordDetail.model_validate(record)


@router.get(
    "/records",
    response_model=list[ExperimentRecordListItem],
    summary="获取当前用户的实验记录列表",
)
async def list_experiment_records(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ExperimentRecordListItem]:
    repo = ExperimentRecordRepository(session)
    records = await repo.list_by_user(current_user.id)
    return [ExperimentRecordListItem.model_validate(r) for r in records]


@router.get(
    "/records/{record_id}",
    response_model=ExperimentRecordDetail,
    summary="查看单条实验数据",
)
async def get_experiment_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExperimentRecordDetail:
    repo = ExperimentRecordRepository(session)
    record = await repo.get_by_id_and_user(record_id, current_user.id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到该实验记录。",
        )
    return ExperimentRecordDetail.model_validate(record)


def _format_summary_value(v: Any) -> str:
    """格式化摘要中的值，便于阅读。"""
    if v is None:
        return ""
    try:
        if isinstance(v, dict):
            return json.dumps(v, ensure_ascii=False, indent=None)
        if isinstance(v, (list, tuple)):
            return json.dumps(v, ensure_ascii=False, indent=None)
        s = str(v)
        return s if isinstance(s, str) else s.decode("utf-8", errors="replace")
    except Exception:
        return str(v) if v is not None else ""


def _build_export_summary(payload: dict[str, Any], source_page: str) -> list[list[str]]:
    """构建与实验中心一致的导出摘要行（原函数、算法、初始参数、来源等）。"""
    rows = [["项目", "值"]]
    # 原函数/目标（与实验中心“函数”列含义一致）
    func = payload.get("test_function") or payload.get("function") or ""
    rows.append(["原函数/目标", _format_summary_value(func)])
    # 算法
    rows.append(["算法", _format_summary_value(payload.get("algorithm_name") or "")])
    # 初始参数
    init = payload.get("initial_state") or payload.get("initial_params") or {}
    rows.append(["初始参数", _format_summary_value(init)])
    # 来源页面
    rows.append(["来源页面", _format_summary_value(source_page or "")])
    return rows


def _to_csv_cell(v: Any) -> str:
    """将任意值转为可写入 CSV 的字符串。"""
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        try:
            return json.dumps(v, ensure_ascii=False, indent=None)
        except Exception:
            return str(v)
    s = str(v)
    return s if isinstance(s, str) else s.decode("utf-8", errors="replace")


def _is_list_of_dicts(v: Any) -> bool:
    return isinstance(v, list) and len(v) > 0 and all(isinstance(item, dict) for item in v)


def _extract_iteration_tables(
    obj: Any,
    prefix: str = "payload",
) -> list[tuple[str, list[str], list[list[str]]]]:
    """递归提取可表格化的迭代/过程数据。"""
    tables: list[tuple[str, list[str], list[list[str]]]] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = str(k)
            path = f"{prefix}.{key}"
            k_lower = key.lower()
            if _is_list_of_dicts(v) and (
                "iteration" in k_lower
                or "history" in k_lower
                or "tableau" in k_lower
                or "process" in k_lower
            ):
                first = v[0]
                headers = [_to_csv_cell(col) for col in first.keys()]
                rows = [[_to_csv_cell(item.get(col)) for col in first.keys()] for item in v]
                tables.append((path, headers, rows))
            elif isinstance(v, dict):
                tables.extend(_extract_iteration_tables(v, path))
    return tables


def _flatten_payload_rows(
    obj: Any,
    prefix: str = "payload",
    *,
    rows: list[list[str]] | None = None,
) -> list[list[str]]:
    """将 payload 展平为 path/value 行，保证导出字段完整可追溯。"""
    if rows is None:
        rows = []

    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}"
            if isinstance(v, dict):
                _flatten_payload_rows(v, path, rows=rows)
            elif _is_list_of_dicts(v):
                rows.append([path, f"共 {len(v)} 条记录（详见下方迭代表）"])
            elif isinstance(v, list):
                rows.append([path, _format_summary_value(v)])
            else:
                rows.append([path, _format_summary_value(v)])
    else:
        rows.append([prefix, _format_summary_value(obj)])
    return rows


@router.get(
    "/records/{record_id}/export",
    summary="导出单条实验数据为 CSV（含原函数、算法、初始参数等，与实验中心一致）",
)
async def export_experiment_record_csv(
    record_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    repo = ExperimentRecordRepository(session)
    record = await repo.get_by_id_and_user(record_id, current_user.id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到该实验记录。",
        )
    try:
        # 从 record 取出为普通 Python 类型，避免 session/懒加载或类型异常
        raw_payload = getattr(record, "payload", None)
        if isinstance(raw_payload, dict):
            payload = dict(raw_payload)
        elif isinstance(raw_payload, str):
            try:
                payload = json.loads(raw_payload)
                if not isinstance(payload, dict):
                    payload = {}
            except Exception:
                payload = {}
        else:
            payload = {}
        source_page = str(record.source_page) if getattr(record, "source_page", None) else ""
        alias_raw = getattr(record, "alias", None)
        safe_alias = (str(alias_raw).replace('"', "'").strip() or "data") if alias_raw else "data"
    except Exception:
        payload = {}
        source_page = ""
        safe_alias = "data"

    try:
        buf = io.StringIO()
        writer = csv.writer(buf)

        # 1. 摘要块：原函数、算法、初始参数、来源（与实验中心信息一致）
        summary = _build_export_summary(payload, source_page)
        writer.writerows(summary)
        writer.writerow([])  # 空行分隔

        # 2. 完整字段详情（不丢失参数、迭代函数、分算法配置等）
        writer.writerow(["字段路径", "值"])
        detail_rows = _flatten_payload_rows(payload)
        writer.writerows(detail_rows)

        # 3. 迭代/过程表（多段）
        iter_tables = _extract_iteration_tables(payload)
        if iter_tables:
            for title, headers, rows in iter_tables:
                writer.writerow([])
                writer.writerow([f"迭代数据：{title}"])
                writer.writerow(headers)
                writer.writerows(rows)

        csv_content = buf.getvalue()
        filename = f"experiment-record-{record_id}-{safe_alias}.csv"
        # 文件名去掉换行等非法字符
        filename = "".join(c for c in filename if c not in '\n\r\t\\')
        return Response(
            content=csv_content.encode("utf-8-sig"),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )
    except Exception as e:
        logger.exception("export_experiment_record_csv failed: record_id=%s", record_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出失败，请稍后重试。",
        ) from e


@router.patch(
    "/records/{record_id}",
    response_model=ExperimentRecordDetail,
    summary="更新实验记录别名（备注名）",
)
async def update_experiment_record_alias(
    record_id: int,
    payload_in: ExperimentRecordAliasUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExperimentRecordDetail:
    repo = ExperimentRecordRepository(session)
    record = await repo.update_alias(
        record_id=record_id, user_id=current_user.id, alias=payload_in.alias
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到该实验记录。",
        )
    return ExperimentRecordDetail.model_validate(record)


@router.delete(
    "/records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除单条实验记录",
)
async def delete_experiment_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    repo = ExperimentRecordRepository(session)
    deleted = await repo.delete_by_id_and_user(record_id=record_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到该实验记录。",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
