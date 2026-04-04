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


def _payload_to_iteration_table(payload: dict[str, Any]) -> tuple[list[str], list[list[str]]] | None:
    """从 payload 提取迭代表头与行。若有迭代数据则返回 (headers, rows)，否则返回 None。"""
    iteration_data = payload.get("iteration_data") or payload.get("iterationLog") or []
    if not isinstance(iteration_data, list) or len(iteration_data) == 0:
        return None
    first = iteration_data[0]
    if not isinstance(first, dict):
        return None
    key_list = list(first.keys())
    headers = [_to_csv_cell(k) for k in key_list]
    rows = []
    for row in iteration_data:
        if not isinstance(row, dict):
            continue
        rows.append([_to_csv_cell(row.get(h)) for h in key_list])
    return headers, rows


def _payload_to_fallback_rows(payload: dict[str, Any]) -> tuple[list[str], list[list[str]]]:
    """无迭代数据时的 key/value 摘要行。"""
    headers = ["key", "value"]
    rows = []
    for k, v in payload.items():
        key_str = _to_csv_cell(k)
        if k in ("iteration_data", "iterationLog") and isinstance(v, list):
            rows.append([key_str, f"共 {len(v)} 条迭代记录"])
        else:
            rows.append([key_str, _format_summary_value(v)])
    return headers, rows


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

        # 2. 迭代表或 key/value 兜底
        iter_table = _payload_to_iteration_table(payload)
        if iter_table is not None:
            headers, rows = iter_table
            writer.writerow(headers)
            writer.writerows(rows)
        else:
            headers, rows = _payload_to_fallback_rows(payload)
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

