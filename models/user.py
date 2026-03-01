from sqlalchemy import Integer, String
from sqlalchemy.orm import mapped_column, Mapped
from pwdlib import PasswordHash
from . import Base

password_hash = PasswordHash.recommended()


class User(Base):
    __tablename__ = "user"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    username: Mapped[str] = mapped_column(String(255))
    _password: Mapped[str] = mapped_column(String(255))

    @property
    def password(self):
        return self._password

    @password.setter
    def password(self, password):
        self._password = password_hash.hash(password)

    def check_password(self, password):
        return password_hash.verify(password, self.password)
