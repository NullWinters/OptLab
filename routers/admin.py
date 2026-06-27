"""管理员路由：注册 / 登录 / 仪表盘 / 用户管理 / 实验管理 / 环境变量 / 评测工作台 / 系统状态"""

import logging
import os
import secrets
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import text

from core.env_manager import (
    get_env_path,
    hash_password,
    read_env_vars,
    verify_password,
    write_env_vars,
)
from dependencies import get_session
from models import AsyncSession
from repository.admin_repo import AdminRepository
from settings import ADMIN_JWT_SECRET, ACCESS_TOKEN_EXPIRE_DELTA, ALGORITHM, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ═══════════════════════════════════════════════════════════════
# 认证工具
# ═══════════════════════════════════════════════════════════════


def _get_admin_jwt_secret() -> str:
    secret = ADMIN_JWT_SECRET
    if not secret:
        env_vars = read_env_vars()
        secret = env_vars.get("OPTLAB_ADMIN_JWT_SECRET", "")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="管理员 JWT 密钥未配置，请检查 .env 文件。",
        )
    return secret


async def get_admin_auth(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供管理员认证令牌。",
        )
    token = auth_header[7:]
    try:
        secret = _get_admin_jwt_secret()
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        if payload.get("sub") != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的管理员令牌。")
        return {"username": payload.get("username", "")}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="管理员令牌无效或已过期。")


def _create_admin_token(username: str) -> str:
    secret = _get_admin_jwt_secret()
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE_DELTA
    payload = {"sub": "admin", "username": username, "exp": expire}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def _admin_repo(session: AsyncSession = Depends(get_session)) -> AdminRepository:
    return AdminRepository(session)


# ═══════════════════════════════════════════════════════════════
# Pydantic 模型
# ═══════════════════════════════════════════════════════════════


class AdminStatusOut(BaseModel):
    configured: bool
    setup_required: bool = False
    setup_hint: str = ""
    admin_count: int = 0


class AdminRegisterIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=50)
    confirm_password: str
    setup_key: str = Field("", description="一次性设置密钥，从服务端控制台获取")


class AdminResetIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=50)
    confirm_password: str
    setup_key: str = Field(..., description="设置密钥，从服务端控制台获取")


class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminAuthOut(BaseModel):
    token: str
    username: str


class SetupKeyOut(BaseModel):
    setup_key: str
    hint: str


class EnvVarsUpdate(BaseModel):
    vars: dict[str, str]


# ── 分页 ──


class PaginationOut(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PaginatedUsersOut(BaseModel):
    users: list[dict]
    pagination: dict


class PaginatedExperimentsOut(BaseModel):
    experiments: list[dict]
    pagination: dict


class PaginatedNotesOut(BaseModel):
    notes: list[dict]
    pagination: dict


# ═══════════════════════════════════════════════════════════════
# 多管理员工具
# ═══════════════════════════════════════════════════════════════

import json as _json


def _list_admins(env_vars: dict) -> list[dict]:
    """返回所有管理员列表（优先从 JSON 读取，兼容旧格式）。"""
    extra_raw = env_vars.get("OPTLAB_ADMIN_EXTRA_USERS", "")
    admins = []
    # 主管理员（旧格式）
    primary_user = env_vars.get("OPTLAB_ADMIN_USERNAME", "")
    primary_hash = env_vars.get("OPTLAB_ADMIN_PASSWORD_HASH", "")
    if primary_user and primary_hash:
        admins.append({"username": primary_user, "password_hash": primary_hash, "is_primary": True})
    # 额外管理员（JSON 格式）
    if extra_raw:
        try:
            unescaped = extra_raw.replace('\\"', '"').replace('\\\\', '\\')
            extra_list = _json.loads(unescaped)
            for a in extra_list:
                a["is_primary"] = False
                admins.append(a)
        except Exception:
            pass
    return admins


def _find_admin(env_vars: dict, username: str) -> dict | None:
    for a in _list_admins(env_vars):
        if a["username"] == username:
            return a
    return None


def _add_extra_admin(username: str, password_hash: str, env_vars: dict) -> None:
    extra_raw = env_vars.get("OPTLAB_ADMIN_EXTRA_USERS", "")
    extra_list = []
    if extra_raw:
        try:
            extra_list = _json.loads(extra_raw.replace('\\"', '"').replace('\\\\', '\\'))
        except Exception:
            extra_list = []
    # 检查是否已存在
    for a in extra_list:
        if a["username"] == username:
            a["password_hash"] = password_hash
            write_env_vars({"OPTLAB_ADMIN_EXTRA_USERS": _json.dumps(extra_list, ensure_ascii=False)})
            return
    extra_list.append({"username": username, "password_hash": password_hash, "created_at": datetime.now(timezone.utc).isoformat()})
    write_env_vars({"OPTLAB_ADMIN_EXTRA_USERS": _json.dumps(extra_list, ensure_ascii=False)})


def _update_admin_password(env_vars: dict, username: str, password_hash: str) -> bool:
    """更新指定管理员的密码，返回是否成功。"""
    # 检查主管理员
    primary_user = env_vars.get("OPTLAB_ADMIN_USERNAME", "")
    if primary_user == username:
        write_env_vars({"OPTLAB_ADMIN_PASSWORD_HASH": password_hash})
        return True
    # 检查额外管理员
    extra_raw = env_vars.get("OPTLAB_ADMIN_EXTRA_USERS", "")
    if extra_raw:
        try:
            extra_list = _json.loads(extra_raw.replace('\\"', '"').replace('\\\\', '\\'))
            for a in extra_list:
                if a["username"] == username:
                    a["password_hash"] = password_hash
                    write_env_vars({"OPTLAB_ADMIN_EXTRA_USERS": _json.dumps(extra_list, ensure_ascii=False)})
                    return True
        except Exception:
            pass
    return False


def _get_or_gen_setup_key(env_vars: dict) -> str:
    key = env_vars.get("OPTLAB_ADMIN_SETUP_KEY", "")
    if not key:
        key = secrets.token_urlsafe(24)
        write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": key})
    return key


def _log_setup_key(setup_key: str, purpose: str = "管理员注册") -> None:
    logger.warning(
        "\n╔══════════════════════════════════════════════════╗\n"
        "║  🔐 %s一次性设置密钥                  ║\n"
        "║  Setup Key: %s  ║\n"
        "║  请在管理员页面输入此密钥完成操作                     ║\n"
        "╚══════════════════════════════════════════════════╝\n",
        purpose.ljust(16),
        setup_key.ljust(20),
    )
    print(
        f"\n{'='*60}\n"
        f"  🔐 {purpose}设置密钥:\n"
        f"  {setup_key}\n"
        f"  请在浏览器中打开 /admin 并输入此密钥完成操作。\n"
        f"{'='*60}\n"
    )


# ═══════════════════════════════════════════════════════════════
# 认证端点
# ═══════════════════════════════════════════════════════════════


@router.post("/status", response_model=AdminStatusOut)
async def check_admin_status() -> AdminStatusOut:
    env_vars = read_env_vars()
    admins = _list_admins(env_vars)
    configured = len(admins) > 0

    if configured:
        return AdminStatusOut(configured=True, admin_count=len(admins))

    setup_key = _get_or_gen_setup_key(env_vars)
    _log_setup_key(setup_key, "管理员首次注册")
    return AdminStatusOut(
        configured=False,
        setup_required=True,
        setup_hint=setup_key[:6] + "..." + setup_key[-4:],
    )


@router.post("/register", response_model=AdminAuthOut)
async def register_admin(payload: AdminRegisterIn) -> AdminAuthOut:
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="两次输入的密码不一致。")
    env_vars = read_env_vars()
    # 验证设置密钥
    expected_key = env_vars.get("OPTLAB_ADMIN_SETUP_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设置密钥未生成，请先访问管理后台首页。")
    if not payload.setup_key or payload.setup_key.strip() != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="设置密钥不正确。请在服务端控制台查看正确的密钥。")

    password_hash = hash_password(payload.password)
    # 用户名已存在 → 覆盖密码
    existing = _find_admin(env_vars, payload.username)
    if existing:
        _update_admin_password(env_vars, payload.username, password_hash)
        write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": ""})
        token = _create_admin_token(payload.username)
        return AdminAuthOut(token=token, username=payload.username)

    configured = bool(env_vars.get("OPTLAB_ADMIN_USERNAME"))
    if not configured:
        jwt_secret = secrets.token_urlsafe(32)
        write_env_vars({
            "OPTLAB_ADMIN_USERNAME": payload.username,
            "OPTLAB_ADMIN_PASSWORD_HASH": password_hash,
            "OPTLAB_ADMIN_JWT_SECRET": jwt_secret,
            "OPTLAB_ADMIN_SETUP_KEY": "",
        })
    else:
        _add_extra_admin(payload.username, password_hash, env_vars)
        write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": ""})

    token = _create_admin_token(payload.username)
    return AdminAuthOut(token=token, username=payload.username)


@router.post("/login", response_model=AdminAuthOut)
async def login_admin(payload: AdminLoginIn) -> AdminAuthOut:
    env_vars = read_env_vars()
    admin = _find_admin(env_vars, payload.username)
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码不正确。")
    if not verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码不正确。")
    token = _create_admin_token(payload.username)
    return AdminAuthOut(token=token, username=payload.username)


@router.post("/reset-password", response_model=AdminAuthOut)
async def reset_admin_password(payload: AdminResetIn) -> AdminAuthOut:
    """忘记密码：使用设置密钥重置管理员密码"""
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="两次输入的密码不一致。")
    env_vars = read_env_vars()
    # 验证设置密钥
    expected_key = env_vars.get("OPTLAB_ADMIN_SETUP_KEY", "")
    if not expected_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有有效的设置密钥。请先从后台管理页面生成。")
    if not payload.setup_key or payload.setup_key.strip() != expected_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="设置密钥不正确。请在服务端控制台查看正确的密钥。")
    # 检查用户名是否存在
    admin = _find_admin(env_vars, payload.username)
    if not admin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该管理员用户名不存在。")
    password_hash = hash_password(payload.password)
    _update_admin_password(env_vars, payload.username, password_hash)
    write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": ""})
    token = _create_admin_token(payload.username)
    return AdminAuthOut(token=token, username=payload.username)


@router.post("/request-reset-key", response_model=SetupKeyOut)
async def request_reset_key() -> SetupKeyOut:
    """公开端点：请求生成设置密钥（用于忘记密码流程）。密钥仅写入 .env 并输出到控制台，不返回明文。"""
    setup_key = secrets.token_urlsafe(24)
    write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": setup_key})
    _log_setup_key(setup_key, "密码重置")
    return SetupKeyOut(setup_key="", hint=setup_key[:6] + "..." + setup_key[-4:])


@router.post("/setup-key/generate", response_model=SetupKeyOut)
async def generate_setup_key(auth: dict = Depends(get_admin_auth)) -> SetupKeyOut:
    """已认证管理员生成新的一次性设置密钥，用于添加其他管理员"""
    setup_key = secrets.token_urlsafe(24)
    write_env_vars({"OPTLAB_ADMIN_SETUP_KEY": setup_key})
    _log_setup_key(setup_key, "添加管理员")
    return SetupKeyOut(setup_key=setup_key, hint=setup_key[:6] + "..." + setup_key[-4:])


@router.get("/admins")
async def list_admin_users(auth: dict = Depends(get_admin_auth)) -> list[dict]:
    """列出所有管理员"""
    env_vars = read_env_vars()
    return _list_admins(env_vars)


@router.delete("/admins/{username}")
async def delete_admin(username: str, auth: dict = Depends(get_admin_auth)):
    """删除管理员（不能删除自己，不能删除主管理员除非自己是主管理员）"""
    env_vars = read_env_vars()
    admin = _find_admin(env_vars, username)
    if not admin:
        raise HTTPException(status_code=404, detail="管理员不存在。")
    if admin["is_primary"]:
        raise HTTPException(status_code=400, detail="不能删除主管理员。请先将主管理员身份转让给其他管理员。")
    if username == auth["username"]:
        raise HTTPException(status_code=400, detail="不能删除自己。")
    extra_raw = env_vars.get("OPTLAB_ADMIN_EXTRA_USERS", "")
    if extra_raw:
        try:
            extra_list = _json.loads(extra_raw.replace('\\"', '"').replace('\\\\', '\\'))
            extra_list = [a for a in extra_list if a["username"] != username]
            write_env_vars({"OPTLAB_ADMIN_EXTRA_USERS": _json.dumps(extra_list, ensure_ascii=False)})
        except Exception:
            pass
    return {"message": f"管理员 {username} 已删除。"}


class TransferPrimaryIn(BaseModel):
    new_primary: str


@router.post("/admins/transfer-primary")
async def transfer_primary(payload: TransferPrimaryIn, auth: dict = Depends(get_admin_auth)):
    """将主管理员身份转让给另一个管理员"""
    env_vars = read_env_vars()
    current_primary = env_vars.get("OPTLAB_ADMIN_USERNAME", "")
    new_primary = payload.new_primary.strip()

    if current_primary == new_primary:
        raise HTTPException(status_code=400, detail="该用户已是主管理员。")

    # 找到目标管理员
    target = _find_admin(env_vars, new_primary)
    if not target:
        raise HTTPException(status_code=404, detail="目标管理员不存在。")

    # 构建新的额外管理员列表：移除目标，加入原主管理员
    extra_raw = env_vars.get("OPTLAB_ADMIN_EXTRA_USERS", "")
    extra_list = []
    if extra_raw:
        try:
            extra_list = _json.loads(extra_raw.replace('\\"', '"').replace('\\\\', '\\'))
        except Exception:
            extra_list = []

    # 移除目标管理员（如果他是额外管理员）
    extra_list = [a for a in extra_list if a["username"] != new_primary]
    # 将原主管理员降为额外管理员
    now = datetime.now(timezone.utc).isoformat()
    extra_list.append({"username": current_primary, "password_hash": env_vars.get("OPTLAB_ADMIN_PASSWORD_HASH", ""), "created_at": now})

    # 将目标管理员提升为主管理员
    # 获取目标管理员的密码哈希
    target_hash = target["password_hash"]
    if target["is_primary"]:
        target_hash = env_vars.get("OPTLAB_ADMIN_PASSWORD_HASH", "")

    write_env_vars({
        "OPTLAB_ADMIN_USERNAME": new_primary,
        "OPTLAB_ADMIN_PASSWORD_HASH": target_hash,
        "OPTLAB_ADMIN_EXTRA_USERS": _json.dumps(extra_list, ensure_ascii=False),
    })

    return {"message": f"主管理员已转让给 {new_primary}。{current_primary} 已降为额外管理员。"}


# ═══════════════════════════════════════════════════════════════
# 仪表盘
# ═══════════════════════════════════════════════════════════════


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    return await repo.dashboard_stats()


# ═══════════════════════════════════════════════════════════════
# 用户管理
# ═══════════════════════════════════════════════════════════════


@router.get("/users")
async def list_users(
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    users, total = await repo.list_users(search=search, page=page, page_size=page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "users": users,
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    detail = await repo.get_user_detail(user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="用户不存在。")
    return detail


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    ok = await repo.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="用户不存在。")
    return {"message": "用户及其关联数据已删除。"}


# ═══════════════════════════════════════════════════════════════
# 实验管理
# ═══════════════════════════════════════════════════════════════


@router.get("/experiments")
async def list_experiments(
    source_page: str = "",
    user_id: str = "",
    page: int = 1,
    page_size: int = 20,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    records, total = await repo.list_experiments(
        source_page=source_page, user_id=user_id, page=page, page_size=page_size
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "experiments": records,
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
    }


@router.get("/experiments/stats")
async def get_experiment_stats(
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    stats = await repo.dashboard_stats()
    return {"experiments_by_type": stats["experiments_by_type"], "experiments_total": stats["experiments_total"]}


@router.delete("/experiments/{record_id}")
async def delete_experiment(
    record_id: int,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    ok = await repo.delete_experiment(record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="实验记录不存在。")
    return {"message": "实验记录已删除。"}


# ═══════════════════════════════════════════════════════════════
# 笔记管理（只读）
# ═══════════════════════════════════════════════════════════════


@router.get("/notes")
async def list_notes(
    experiment_key: str = "",
    user_id: str = "",
    page: int = 1,
    page_size: int = 20,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    notes, total = await repo.list_notes(
        experiment_key=experiment_key, user_id=user_id, page=page, page_size=page_size
    )
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "notes": notes,
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
    }


@router.get("/notes/{note_id}")
async def get_note_detail(
    note_id: int,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    note = await repo.get_note_detail(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在。")
    return note


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    ok = await repo.delete_note(note_id)
    if not ok:
        raise HTTPException(status_code=404, detail="笔记不存在。")
    return {"message": "笔记已删除。"}


# ═══════════════════════════════════════════════════════════════
# 聊天会话管理（管理员视图）
# ═══════════════════════════════════════════════════════════════


@router.get("/chats")
async def list_chats(
    user_id: str = "",
    page: int = 1,
    page_size: int = 20,
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    chats, total = await repo.list_chats(user_id=user_id, page=page, page_size=page_size)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "chats": chats,
        "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages},
    }


# ═══════════════════════════════════════════════════════════════
# 环境变量（保持不变）
# ═══════════════════════════════════════════════════════════════


@router.get("/env")
async def get_env_vars(auth: dict = Depends(get_admin_auth)) -> dict[str, str]:
    env_vars = read_env_vars()
    sensitive_keys = {"OPTLAB_ADMIN_PASSWORD_HASH", "OPTLAB_ADMIN_JWT_SECRET"}
    result = {}
    for key, value in env_vars.items():
        result[key] = "********" if key in sensitive_keys else value
    return result


@router.put("/env")
async def update_env_vars(
    payload: EnvVarsUpdate, auth: dict = Depends(get_admin_auth)
) -> dict:
    updates = dict(payload.vars)
    masked_keys = [k for k, v in updates.items() if v == "********"]
    for k in masked_keys:
        del updates[k]
    try:
        write_env_vars(updates)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="无法写入 .env 文件，请检查文件权限。")
    except Exception as e:
        logger.exception("Failed to write env vars")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"写入环境变量失败：{e}")
    return {"message": "环境变量已保存。部分更改可能需要重启服务后生效。"}


# ═══════════════════════════════════════════════════════════════
# 系统状态
# ═══════════════════════════════════════════════════════════════


@router.get("/system/status")
async def get_system_status(
    repo: AdminRepository = Depends(_admin_repo),
    auth: dict = Depends(get_admin_auth),
):
    db_status = await repo.system_status()
    # LLM API 检测
    llm_ok = False
    llm_msg = "未配置"
    if LLM_API_KEY and LLM_API_KEY not in ("CHANGE_ME_LLM_KEY", ""):
        try:
            import httpx
            base = (LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
            url = f"{base}/models"
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {LLM_API_KEY}"})
                llm_ok = resp.status_code == 200
                llm_msg = "连接正常" if llm_ok else f"HTTP {resp.status_code}"
        except Exception as e:
            llm_msg = str(e)[:120]
    else:
        llm_msg = "API Key 未配置"

    # 日志文件信息
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    log_file = os.path.join(log_dir, "optlab.log")
    log_info = {"path": log_file, "exists": os.path.exists(log_file)}
    if log_info["exists"]:
        log_info["size_kb"] = round(os.path.getsize(log_file) / 1024, 1)
        log_info["modified"] = datetime.fromtimestamp(os.path.getmtime(log_file)).isoformat()

    # 项目信息
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, ".env")

    return {
        "database": db_status["database"],
        "llm": {
            "ok": llm_ok,
            "message": llm_msg,
            "model": LLM_MODEL_ID,
            "base_url": LLM_BASE_URL or "(default)",
        },
        "logs": log_info,
        "env_file": {
            "path": env_path,
            "exists": os.path.exists(env_path),
        },
        "python_version": os.sys.version,
    }


# ═══════════════════════════════════════════════════════════════
# 系统日志查看
# ═══════════════════════════════════════════════════════════════


@router.get("/system/logs")
async def get_system_logs(
    lines: int = 100,
    auth: dict = Depends(get_admin_auth),
):
    log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
    log_file = os.path.join(log_dir, "optlab.log")
    if not os.path.exists(log_file):
        return {"logs": "", "message": "日志文件不存在。"}
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            all_lines = f.readlines()
        recent = all_lines[-lines:] if len(all_lines) > lines else all_lines
        return {"logs": "".join(recent), "total_lines": len(all_lines), "shown_lines": len(recent)}
    except Exception as e:
        return {"logs": "", "message": f"读取日志失败: {e}"}


# ═══════════════════════════════════════════════════════════════
# LLM 连通性测试
# ═══════════════════════════════════════════════════════════════


@router.post("/system/test-llm")
async def test_llm_connection(auth: dict = Depends(get_admin_auth)):
    if not LLM_API_KEY or LLM_API_KEY in ("CHANGE_ME_LLM_KEY", ""):
        return {"ok": False, "message": "LLM API Key 未配置"}
    try:
        import httpx
        base = (LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        # 尝试 list models
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{base}/models",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                models_count = len(data.get("data", []))
                return {"ok": True, "message": f"连接成功，可用模型数: {models_count}"}
            return {"ok": False, "message": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:200]}


# ═══════════════════════════════════════════════════════════════
# 评测工作台
# ═══════════════════════════════════════════════════════════════


_EVAL_PROFILES_CACHE: Optional[list[dict]] = None


def _load_eval_profiles() -> list[dict]:
    global _EVAL_PROFILES_CACHE
    if _EVAL_PROFILES_CACHE is not None:
        return _EVAL_PROFILES_CACHE
    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
    profiles_path = os.path.join(scripts_dir, "evaluation", "experiment_profiles.v1.json")
    if not os.path.exists(profiles_path):
        return []
    import json
    with open(profiles_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    profiles = []
    profiles_data = data.get("profiles", data)
    if isinstance(profiles_data, dict):
        for key, profile in profiles_data.items():
            if key == "default":
                continue
            profiles.append({"key": key, "name": profile.get("name", key)})
    elif isinstance(profiles_data, list):
        for p in profiles_data:
            if isinstance(p, dict) and p.get("key") != "default":
                profiles.append({"key": p.get("key", ""), "name": p.get("name", p.get("key", ""))})
    _EVAL_PROFILES_CACHE = profiles
    return profiles


@router.get("/evaluation/profiles")
async def get_eval_profiles(auth: dict = Depends(get_admin_auth)):
    profiles = _load_eval_profiles()
    return {"profiles": profiles, "count": len(profiles)}


@router.post("/evaluation/run")
async def run_evaluation(
    case_ids: list[str] = Form(...),
    strict_profiles: bool = Form(False),
    record_files: list[UploadFile] = File(...),
    report_files: list[UploadFile] = File(...),
    auth: dict = Depends(get_admin_auth),
):
    n = len(case_ids)
    if len(record_files) != n or len(report_files) != n:
        raise HTTPException(status_code=400, detail="case_ids、record_files、report_files 数量必须一致")
    if n == 0:
        raise HTTPException(status_code=400, detail="至少需要一组文件")

    scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
    profiles_path = os.path.join(scripts_dir, "evaluation", "experiment_profiles.v1.json")
    rubric_path = os.path.join(scripts_dir, "evaluation", "default_rubric.v1.json")
    eval_script = os.path.join(scripts_dir, "evaluation_dataset.py")

    if not os.path.exists(eval_script):
        raise HTTPException(status_code=503, detail="评测脚本 evaluation_dataset.py 不存在")

    with tempfile.TemporaryDirectory() as tmp:
        records_dir = os.path.join(tmp, "records")
        reports_dir = os.path.join(tmp, "reports")
        out_dir = os.path.join(tmp, "out")
        for d in (records_dir, reports_dir, out_dir):
            os.makedirs(d)

        for i, cid in enumerate(case_ids):
            safe = _sanitize_case_id(cid, i)
            rec_bytes = await record_files[i].read()
            rep_bytes = await report_files[i].read()
            rec_ext = _guess_ext(record_files[i].filename, ".csv")
            rep_ext = _guess_ext(report_files[i].filename, ".md")
            with open(os.path.join(records_dir, f"{safe}{rec_ext}"), "wb") as f:
                f.write(rec_bytes)
            with open(os.path.join(reports_dir, f"{safe}{rep_ext}"), "wb") as f:
                f.write(rep_bytes)

        dataset_jsonl = os.path.join(out_dir, "eval_dataset.jsonl")
        manifest_json = os.path.join(out_dir, "eval_manifest.json")
        scores_jsonl = os.path.join(out_dir, "eval_scores.jsonl")
        summary_json = os.path.join(out_dir, "eval_score_summary.json")

        try:
            build_cmd = [
                os.sys.executable, eval_script, "build",
                "--records-dir", records_dir,
                "--reports-dir", reports_dir,
                "--profiles", profiles_path,
                "--out-jsonl", dataset_jsonl,
                "--out-manifest", manifest_json,
            ]
            if strict_profiles:
                build_cmd.append("--strict-profiles")
            build = subprocess.run(build_cmd, capture_output=True, text=True, timeout=120)

            if build.returncode not in (0, 2):
                raise HTTPException(status_code=500, detail=f"构建评测集失败: {build.stderr[:500]}")

            score_cmd = [
                os.sys.executable, eval_script, "score",
                "--dataset-jsonl", dataset_jsonl,
                "--rubric", rubric_path,
                "--out-jsonl", scores_jsonl,
                "--out-summary", summary_json,
            ]
            score = subprocess.run(score_cmd, capture_output=True, text=True, timeout=120)
            if score.returncode != 0:
                raise HTTPException(status_code=500, detail=f"评分失败: {score.stderr[:500]}")

            manifest = _load_json(manifest_json)
            summary = _load_json(summary_json)
            scores = _load_jsonl(scores_jsonl)

            return {
                "manifest": manifest,
                "summary": summary,
                "scores": scores,
                "logs": {"build_stdout": build.stdout[-2000:], "score_stdout": score.stdout[-2000:]},
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Evaluation failed")
            raise HTTPException(status_code=500, detail=f"评测执行异常: {e}")


def _sanitize_case_id(raw: str, idx: int) -> str:
    import re
    safe = re.sub(r"[^\w\-.]", "_", raw.strip() or f"case_{idx}")
    return safe[:80]


def _guess_ext(filename: str | None, default: str) -> str:
    if filename and "." in filename:
        return os.path.splitext(filename)[1].lower()
    return default


def _load_json(path: str):
    import json
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_jsonl(path: str) -> list:
    import json
    items = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                items.append(json.loads(line))
    return items
