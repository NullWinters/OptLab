from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import create_access_token, get_current_user
from dependencies import get_session
from models.user import User
from repository.user_repo import UserRepository
from schemas.user import LoginIn, LoginOut, RegisterIn, UserCreateSchema, UserSchema

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register_user(
    register_in: RegisterIn,
    session: AsyncSession = Depends(get_session),
) -> UserSchema:
    """
    用户注册：仅返回必要的账号信息，所有错误文案使用简洁的书面中文。
    """
    repo = UserRepository(session)

    if await repo.email_is_exist(register_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册，请更换邮箱。",
        )

    if await repo.username_is_exist(register_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户名已被占用，请更换用户名。",
        )

    user_create = UserCreateSchema(
        email=register_in.email,
        username=register_in.username,
        password=register_in.password,
    )
    user = await repo.create(user_create)
    return UserSchema(id=user.id, email=user.email, username=user.username)


@router.post("/login", response_model=LoginOut)
async def login_user(
    login_in: LoginIn,
    session: AsyncSession = Depends(get_session),
) -> LoginOut:
    """
    用户登录：支持使用邮箱或用户名作为账号标识。
    """
    repo = UserRepository(session)

    identifier = login_in.identifier
    if "@" in identifier:
        user = await repo.get_by_email(identifier)
    else:
        user = await repo.get_by_username(identifier)

    if user is None or not user.check_password(login_in.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码不正确，请重新输入。",
        )

    token = create_access_token({"sub": str(user.id), "email": user.email})
    user_schema = UserSchema(id=user.id, email=user.email, username=user.username)
    return LoginOut(user=user_schema, token=token)


@router.get("/me", response_model=UserSchema)
async def read_current_user(current_user: User = Depends(get_current_user)) -> UserSchema:
    """
    获取当前登录用户的基础信息。
    """
    return UserSchema(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
    )

