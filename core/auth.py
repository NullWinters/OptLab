from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import get_session
from models.user import User
from settings import ACCESS_TOKEN_EXPIRE_DELTA, ALGORITHM, SECRET_KEY

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    从 JWT 中解析当前登录用户。

    若令牌无效或用户不存在，统一返回中文的未认证提示。
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="身份验证失败，请重新登录。",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise credentials_exception

    async with session.begin():
        stmt = select(User).where(User.id == user_id)
        user = await session.scalar(stmt)

    if user is None:
        raise credentials_exception

    return user

