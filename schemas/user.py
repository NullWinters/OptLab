from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from settings import REGISTER_PASSWORD, REGISTER_USERNAME

UsernameStr = Annotated[str, Field(**REGISTER_USERNAME, description="Username for user registration")]
PasswordStr = Annotated[str, Field(**REGISTER_PASSWORD, description="Password for user registration")]


class RegisterIn(BaseModel):
    email: EmailStr
    username: UsernameStr
    password: PasswordStr
    confirm_password: PasswordStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def password_is_match(self):
        if self.password != self.confirm_password:
            raise ValueError("两次输入的密码不一致")
        return self


class UserCreateSchema(BaseModel):
    email: EmailStr
    username: UsernameStr
    password: PasswordStr


class LoginIn(BaseModel):
    identifier: str
    password: PasswordStr

    @field_validator("identifier", mode="before")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class UpdateUsernameIn(BaseModel):
    username: UsernameStr

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class UpdatePasswordIn(BaseModel):
    current_password: PasswordStr
    new_password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def password_is_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("两次输入的密码不一致")
        return self


class ActionOut(BaseModel):
    message: str


class UserSchema(BaseModel):
    id: Annotated[int, Field(..., description="User ID")]
    email: EmailStr
    username: UsernameStr


class LoginOut(BaseModel):
    user: UserSchema
    token: str
