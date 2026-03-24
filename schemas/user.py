from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Annotated
from settings import REGISTER_USERNAME, REGISTER_PASSWORD

UsernameStr = Annotated[str, Field(**REGISTER_USERNAME, description="Username for user registration")]
PasswordStr = Annotated[str, Field(**REGISTER_PASSWORD, description="Password for user registration")]


class RegisterIn(BaseModel):
    email: EmailStr
    username: UsernameStr
    password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def password_is_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserCreateSchema(BaseModel):
    email: EmailStr
    username: UsernameStr
    password: PasswordStr


class LoginIn(BaseModel):
    identifier: str
    password: PasswordStr


class UpdateUsernameIn(BaseModel):
    username: UsernameStr


class UpdatePasswordIn(BaseModel):
    current_password: PasswordStr
    new_password: PasswordStr
    confirm_password: PasswordStr

    @model_validator(mode="after")
    def password_is_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
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
