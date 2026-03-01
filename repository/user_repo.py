from models import AsyncSession
from models.user import User
from sqlalchemy import select, exists
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
        async with self.session.begin():
            stmt = select(User).where(User.email == email)
            return await self.session.scalar(stmt)

    async def email_is_exist(self, email: str) -> bool:
        async with self.session.begin():
            stmt = select(exists().where(User.email == email))
            return await self.session.scalar(stmt)
