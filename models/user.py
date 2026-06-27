from datetime import datetime
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.sql import func
from pwdlib import PasswordHash
from . import Base

password_hash = PasswordHash.recommended()


class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    username: Mapped[str] = mapped_column(String(255), unique=True)
    _password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, password):
        self._password = password_hash.hash(password)

    def check_password(self, password):
        return password_hash.verify(password, self.password)
