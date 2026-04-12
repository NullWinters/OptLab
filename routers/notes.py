"""实验笔记条目路由 - 支持多条笔记的 CRUD 和 AI 生成。"""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from dependencies import get_session
from models.user import User
from repository.note_item_repo import NoteItemRepository
from schemas.note_item import NoteItemCreate, NoteItemUpdate, NoteItemOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notes", tags=["notes"])


def _is_ai_provider_auth_error(exc: Exception) -> bool:
    text = f"{type(exc).__name__}: {str(exc)}".lower()
    markers = (
        "authenticationerror",
        "invalid api key",
        "api key",
        "unauthorized",
        "401",
        "incorrect api key",
        "鉴权",
        "密钥",
    )
    return any(marker in text for marker in markers)


# ── 固定路径路由必须在通配路由之前注册，避免被 /{experiment_key} 误匹配 ──
@router.put(
    "/item/{item_id}",
    response_model=NoteItemOut,
    summary="更新某条笔记（标题或内容）",
)
async def update_note(
    item_id: int,
    payload: NoteItemUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NoteItemOut:
    repo = NoteItemRepository(session)
    item = await repo.update(
        item_id=item_id,
        user_id=current_user.id,
        title=payload.title,
        content=payload.content,
        sort_order=payload.sort_order,
    )
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="笔记不存在。",
        )
    return NoteItemOut.model_validate(item)


@router.delete(
    "/item/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除某条笔记",
)
async def delete_note(
    item_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    repo = NoteItemRepository(session)
    deleted = await repo.delete_by_id_and_user(
        item_id=item_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="笔记不存在。",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{experiment_key}/export",
    summary="导出某实验下所有笔记为 Markdown",
)
async def export_notes(
    experiment_key: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Response:
    repo = NoteItemRepository(session)
    items = await repo.list_for_user_and_key(
        user_id=current_user.id,
        experiment_key=experiment_key,
    )
    if not items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该实验下暂无笔记，无法导出。",
        )

    lines: list[str] = []
    lines.append(f"# 实验笔记：{experiment_key}")
    lines.append("")
    lines.append(f"- 用户：{current_user.username}")
    lines.append(f"- 实验：{experiment_key}")
    lines.append("")

    for idx, item in enumerate(items, start=1):
        title = item.title.strip() or f"笔记 {idx}"
        lines.append(f"## {title}")
        lines.append("")
        lines.append(item.content.strip() or "（暂无内容）")
        lines.append("")
        lines.append(
            f"*最后更新：{item.updated_at.strftime('%Y-%m-%d %H:%M:%S')}*"
        )
        lines.append("")

    md_content = "\n".join(lines)
    filename = f"{experiment_key}-notes.md"

    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/{experiment_key}/ai-generate",
    response_model=NoteItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="AI 智能生成一条实验笔记并保存",
)
async def ai_generate_note(
    experiment_key: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NoteItemOut:
    """接收前端传来的实验数据与行为记录，调用 LLM 生成完整实验笔记后保存。"""
    logger.info(f"[Router] AI generate note request: experiment_key={experiment_key}, user_id={current_user.id}")
    logger.debug(f"[Router] Payload type: {type(payload)}, keys: {list(payload.keys()) if isinstance(payload, dict) else 'N/A'}")
    
    # 验证payload类型
    if not isinstance(payload, dict):
        logger.error(f"[Router] Payload is not dict: {type(payload)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请求数据格式错误：payload必须是JSON对象。",
        )

    def _has_non_empty_iteration_log(v: Any) -> bool:
        if isinstance(v, list):
            return len(v) > 0
        if isinstance(v, dict):
            # comparison 页面可能是 {golden: [...], fibonacci: [...]} 或其他分组结构
            for item in v.values():
                if isinstance(item, list) and len(item) > 0:
                    return True
            return False
        return False

    def _generic_has_iteration_and_log_data(obj: Any, depth: int = 4) -> bool:
        if depth < 0 or obj is None:
            return False
        if isinstance(obj, list):
            return False
        if isinstance(obj, dict):
            for k, v in obj.items():
                k_lower = str(k).lower()
                if "iteration" in k_lower and ("log" in k_lower or "data" in k_lower):
                    if _has_non_empty_iteration_log(v):
                        return True
                # 限深递归，避免大 payload
                if isinstance(v, (dict, list)):
                    if _generic_has_iteration_and_log_data(v, depth - 1):
                        return True
        return False

    # 兜底校验：避免仅包含元信息/初始输入导致空数据生成
    # 前端会做更细粒度的“按课程校验”，这里做后端防御，保证即使前端漏判也不会误触发。
    if experiment_key == "linear-programming.simplex":
        iteration_card_count = payload.get("iteration_card_count", 0)
        simplex_run_record = payload.get("simplex_run_record")
        simplex_tableau_steps = payload.get("simplex_tableau_steps", [])
        has_simplex_data = (
            isinstance(iteration_card_count, int) and iteration_card_count > 0
        ) or (simplex_run_record is not None) or (
            isinstance(simplex_tableau_steps, list) and len(simplex_tableau_steps) > 0
        )
        if not has_simplex_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前尚无实验数据，请先运行一次单纯形法求解。",
            )
    elif experiment_key == "linear-programming.two_phase":
        iteration_card_count = payload.get("iteration_card_count", 0)
        phase1_iteration_log = payload.get("phase1_iteration_log", [])
        phase2_iteration_log = payload.get("phase2_iteration_log", [])
        has_two_phase_data = (
            isinstance(iteration_card_count, int) and iteration_card_count > 0
        ) or (isinstance(phase1_iteration_log, list) and len(phase1_iteration_log) > 0) or (
            isinstance(phase2_iteration_log, list) and len(phase2_iteration_log) > 0
        )
        if not has_two_phase_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前尚无实验数据，请先运行一次两阶段法求解。",
            )

    elif experiment_key == "line-search.range_search.comparison":
        iteration_log = payload.get("iteration_log")
        has_progress = False
        if isinstance(iteration_log, dict):
            for algo_rows in iteration_log.values():
                if not isinstance(algo_rows, list):
                    continue
                for row in algo_rows:
                    if not isinstance(row, dict):
                        continue
                    iter_val = row.get("iteration", row.get("iter"))
                    try:
                        iter_num = float(iter_val)
                    except (TypeError, ValueError):
                        iter_num = -1
                    if iter_num > 0:
                        has_progress = True
                        break
                if has_progress:
                    break
        if not has_progress:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="暂无实验数据，请先运行实验。",
            )
    else:
        if experiment_key == "svm-smo.kernel_trick.visualization":
            # Kernel-trick 页面中可能会先 parse_csv，但尚未完成可视化。
            # 只有当 sample_count>0（即已生成样本点）时才允许生成笔记。
            sample_count = payload.get("sample_count", 0)
            has_points = (
                isinstance(sample_count, (int, float)) and sample_count > 0
            )
            if not has_points:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="未检测到可用数据，请先上传或加载预设数据集。",
                )

        # 通用：优先用 iteration_log / iterationLog 这类字段判断“是否有实验数据”
        if (
            not _generic_has_iteration_and_log_data(payload, depth=4)
            and not payload.get("convergence_result")
        ):
            # 仍然可能是 kernel-trick / 或部分页面没有 iteration_log 字段
            # 此时至少需要排除“只有元信息”的情况
            meta_keys = {"_behavior", "guidebook"}
            relevant_keys = [k for k in payload.keys() if k not in meta_keys]
            if not relevant_keys:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="缺少实验数据，无法生成笔记。",
                )
            # 有字段但未检测到迭代数据：也阻断，避免空数据 LLM 生成
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="缺少实验数据，无法生成笔记。",
            )

    # 通过上述校验后，进入 LLM 生成
    try:
        from core.note_generator import generate_experiment_note
        logger.info("[Router] Calling generate_experiment_note...")
        title, content = await generate_experiment_note(
            experiment_key=experiment_key,
            experiment_data=payload,
        )
        logger.info(f"[Router] Note generated successfully: title_len={len(title)}, content_len={len(content)}")
    except TypeError as e:
        logger.error(f"[Router] Type error in note generation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据格式错误：{str(e)}",
        )
    except Exception as e:
        logger.error(f"[Router] AI generate note failed: {type(e).__name__}: {str(e)[:200]}", exc_info=True)
        if _is_ai_provider_auth_error(e):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI 服务鉴权失败：请检查服务器 DEEPSEEK_API_KEY 是否有效且未过期。",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 生成笔记失败：{type(e).__name__}。请检查服务器日志。",
        )

    try:
        repo = NoteItemRepository(session)
        existing = await repo.list_for_user_and_key(
            user_id=current_user.id,
            experiment_key=experiment_key,
        )
        sort_order = len(existing)
        logger.debug(f"[Router] Existing notes count: {sort_order}")

        item = await repo.create(
            user_id=current_user.id,
            experiment_key=experiment_key,
            title=title,
            content=content,
            sort_order=sort_order,
        )
        logger.info(f"[Router] Note saved to DB: item_id={item.id}")
        
        # 验证返回对象
        result = NoteItemOut.model_validate(item)
        logger.debug(f"[Router] Response model validated: {type(result)}")
        return result
        
    except Exception as e:
        logger.error(f"[Router] Failed to save note to DB: {type(e).__name__}: {str(e)[:200]}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存笔记失败：{type(e).__name__}。请检查服务器日志。",
        )


# ── 通配路由放在最后 ──

@router.get(
    "/{experiment_key}",
    response_model=list[NoteItemOut],
    summary="获取当前用户在某实验下的所有笔记条目",
)
async def list_notes(
    experiment_key: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NoteItemOut]:
    repo = NoteItemRepository(session)
    items = await repo.list_for_user_and_key(
        user_id=current_user.id,
        experiment_key=experiment_key,
    )
    return [NoteItemOut.model_validate(i) for i in items]


@router.post(
    "/{experiment_key}",
    response_model=NoteItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="在某实验下新建一条笔记",
)
async def create_note(
    experiment_key: str,
    payload: NoteItemCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NoteItemOut:
    repo = NoteItemRepository(session)
    item = await repo.create(
        user_id=current_user.id,
        experiment_key=experiment_key,
        title=payload.title,
        content=payload.content,
        sort_order=payload.sort_order,
    )
    return NoteItemOut.model_validate(item)
