"""管理员路由：注册 / 登录 / 环境变量管理"""

import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from core.env_manager import (
    get_env_path,
    hash_password,
    read_env_vars,
    verify_password,
    write_env_vars,
)
from settings import ADMIN_JWT_SECRET, ACCESS_TOKEN_EXPIRE_DELTA, ALGORITHM

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


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


class AdminStatusOut(BaseModel):
    configured: bool


class AdminRegisterIn(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=50)
    confirm_password: str


class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminAuthOut(BaseModel):
    token: str
    username: str


class EnvVarsUpdate(BaseModel):
    vars: dict[str, str]


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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的管理员令牌。",
            )
        return {"username": payload.get("username", "")}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="管理员令牌无效或已过期。",
        )


def _create_admin_token(username: str) -> str:
    secret = _get_admin_jwt_secret()
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE_DELTA
    payload = {"sub": "admin", "username": username, "exp": expire}
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


@router.post("/status", response_model=AdminStatusOut)
async def check_admin_status() -> AdminStatusOut:
    env_vars = read_env_vars()
    configured = bool(
        env_vars.get("OPTLAB_ADMIN_USERNAME")
        and env_vars.get("OPTLAB_ADMIN_PASSWORD_HASH")
    )
    return AdminStatusOut(configured=configured)


@router.post("/register", response_model=AdminAuthOut)
async def register_admin(payload: AdminRegisterIn) -> AdminAuthOut:
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="两次输入的密码不一致。",
        )
    env_vars = read_env_vars()
    if env_vars.get("OPTLAB_ADMIN_USERNAME"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="管理员已注册，请直接登录。",
        )
    password_hash = hash_password(payload.password)
    jwt_secret = secrets.token_urlsafe(32)
    write_env_vars({
        "OPTLAB_ADMIN_USERNAME": payload.username,
        "OPTLAB_ADMIN_PASSWORD_HASH": password_hash,
        "OPTLAB_ADMIN_JWT_SECRET": jwt_secret,
    })
    token = _create_admin_token(payload.username)
    return AdminAuthOut(token=token, username=payload.username)


@router.post("/login", response_model=AdminAuthOut)
async def login_admin(payload: AdminLoginIn) -> AdminAuthOut:
    env_vars = read_env_vars()
    stored_username = env_vars.get("OPTLAB_ADMIN_USERNAME", "")
    stored_hash = env_vars.get("OPTLAB_ADMIN_PASSWORD_HASH", "")
    if not stored_username or not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="管理员尚未注册，请先完成首次配置。",
        )
    if payload.username != stored_username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不正确。",
        )
    if not verify_password(payload.password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不正确。",
        )
    token = _create_admin_token(payload.username)
    return AdminAuthOut(token=token, username=payload.username)


@router.get("/env")
async def get_env_vars(auth: dict = Depends(get_admin_auth)) -> dict[str, str]:
    env_vars = read_env_vars()
    sensitive_keys = {"OPTLAB_ADMIN_PASSWORD_HASH", "OPTLAB_ADMIN_JWT_SECRET"}
    result = {}
    for key, value in env_vars.items():
        if key in sensitive_keys:
            result[key] = "********"
        else:
            result[key] = value
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="无法写入 .env 文件，请检查文件权限。",
        )
    except Exception as e:
        logger.exception("Failed to write env vars")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"写入环境变量失败：{e}",
        )
    return {"message": "环境变量已保存。部分更改可能需要重启服务后生效。"}
