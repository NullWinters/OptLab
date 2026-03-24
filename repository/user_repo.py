from models import AsyncSession
from models.user import User
from sqlalchemy import exists, func, select
from schemas.user import UserCreateSchema


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user: UserCreateSchema) -> User:
        async with self.session.begin():
            user_data = user.model_dump()
            password = user_data.pop("password")
            new_user = User(**user_data)
            new_user.password = password
            self.session.add(new_user)
            return new_user

    async def get_by_email(self, email: str) -> User | None:
        normalized_email = email.strip().lower()
        async with self.session.begin():
            stmt = select(User).where(func.lower(User.email) == normalized_email)
            return await self.session.scalar(stmt)

    async def email_is_exist(self, email: str, exclude_user_id: int | None = None) -> bool:
        normalized_email = email.strip().lower()
        condition = func.lower(User.email) == normalized_email
        if exclude_user_id is not None:
            condition = condition & (User.id != exclude_user_id)
        async with self.session.begin():
            stmt = select(exists().where(condition))
            return await self.session.scalar(stmt)

    async def get_by_username(self, username: str) -> User | None:
        normalized_username = username.strip().lower()
        async with self.session.begin():
            stmt = select(User).where(func.lower(User.username) == normalized_username)
            return await self.session.scalar(stmt)

    async def username_is_exist(self, username: str, exclude_user_id: int | None = None) -> bool:
        normalized_username = username.strip().lower()
        condition = func.lower(User.username) == normalized_username
        if exclude_user_id is not None:
            condition = condition & (User.id != exclude_user_id)
        async with self.session.begin():
            stmt = select(exists().where(condition))
            return await self.session.scalar(stmt)
