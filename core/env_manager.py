"""环境变量文件 .env 读写与管理"""

import os
import re
from pwdlib import PasswordHash

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(_project_root, ".env")

_password_hash = PasswordHash.recommended()


def get_env_path() -> str:
    return ENV_PATH


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _password_hash.verify(password, password_hash)


def read_env_vars() -> dict[str, str]:
    result: dict[str, str] = {}
    if not os.path.exists(ENV_PATH):
        return result
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            parsed = _parse_env_line(line)
            if parsed:
                key, value = parsed
                result[key] = value
    return result


def write_env_vars(updates: dict[str, str]) -> None:
    if not os.path.exists(ENV_PATH):
        lines: list[str] = []
    else:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()

    handled_keys: set[str] = set()
    new_lines: list[str] = []

    for line in lines:
        parsed = _parse_env_line(line)
        if parsed:
            key, _ = parsed
            if key in updates:
                new_lines.append(f'{key}="{_escape_value(updates[key])}"\n')
                handled_keys.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    for key, value in updates.items():
        if key not in handled_keys:
            new_lines.append(f'{key}="{_escape_value(value)}"\n')

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def _parse_env_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)', stripped)
    if not match:
        return None
    key = match.group(1)
    value = match.group(2).strip()
    if len(value) >= 2:
        if (value.startswith('"') and value.endswith('"')) or \
           (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]
    return key, value


def _escape_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')
