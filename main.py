from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from routers.agent import router as agent_router
from routers.auth import router as auth_router
from routers.experiments import router as experiments_router
from routers.notes import router as notes_router
from core.scheduler import init_scheduler, start_scheduler, shutdown_scheduler
import os
import logging
from logging.handlers import TimedRotatingFileHandler

# 获取项目根目录的绝对路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
LOG_DIR = os.path.join(BASE_DIR, "logs")

# 确保必要的目录存在
for directory in [STATIC_DIR, LOG_DIR]:
    if not os.path.exists(directory):
        os.makedirs(directory)


def setup_logging():
    """配置日志系统，支持按日期轮转和多 worker 模式"""
    log_format = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    log_file = os.path.join(LOG_DIR, "optlab.log")

    # 使用 TimedRotatingFileHandler 按天轮转，保留 30 天
    file_handler = TimedRotatingFileHandler(
        log_file, when="midnight", interval=1, backupCount=30, encoding="utf-8"
    )
    file_handler.setFormatter(log_format)
    file_handler.setLevel(logging.INFO)

    # 获取 root logger 并设置
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    if not any(isinstance(h, TimedRotatingFileHandler) for h in root_logger.handlers):
        root_logger.addHandler(file_handler)

    # 过滤终端输出的 INFO 信息，只保留 WARNING 及以上级别
    for h in root_logger.handlers:
        if not isinstance(h, TimedRotatingFileHandler):
            h.setLevel(logging.WARNING)

    # 配置相关 loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "watchfiles.main"]:
        u_logger = logging.getLogger(logger_name)
        if logger_name == "watchfiles.main":
            # 过滤 watchfiles 的 INFO 级别 "1 change detected" 等日志
            u_logger.setLevel(logging.WARNING)
        
        if not any(isinstance(h, TimedRotatingFileHandler) for h in u_logger.handlers):
            u_logger.addHandler(file_handler)

        # 确保这些 logger 自身的终端 handler 也被过滤
        for h in u_logger.handlers:
            if not isinstance(h, TimedRotatingFileHandler):
                h.setLevel(logging.WARNING)

        # 避免日志向上冒泡到 root logger 导致重复记录
        u_logger.propagate = False


# 初始化日志
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时
    init_scheduler()
    start_scheduler()
    yield
    # 关闭时
    shutdown_scheduler()


app = FastAPI(lifespan=lifespan)
app.include_router(agent_router)
app.include_router(auth_router)
app.include_router(experiments_router)
app.include_router(notes_router)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)

NO_CACHE = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
}


@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    # starlette 的 TemplateResponse 签名为 (request, name, context)
    return templates.TemplateResponse(request, "index.html")


@app.get("/favicon.ico", include_in_schema=False)
async def read_favicon():
    return FileResponse(os.path.join(STATIC_DIR, "favicon.ico"))


@app.get("/profile", response_class=HTMLResponse)
async def read_profile(request: Request):
    return templates.TemplateResponse(request, "profile.html")


@app.get("/settings", response_class=HTMLResponse)
async def read_settings(request: Request):
    return templates.TemplateResponse(request, "settings.html")


@app.get("/courses", response_class=HTMLResponse)
async def redirect_courses_no_slash():
    return RedirectResponse(url="/courses/", status_code=302)


@app.get("/courses/", response_class=HTMLResponse)
async def read_courses(request: Request):
    return templates.TemplateResponse(request, "courses/index.html")


@app.get("/auth/login", response_class=HTMLResponse)
async def read_login_page(request: Request):
    return templates.TemplateResponse(request, "auth/login.html")


@app.get("/auth/register", response_class=HTMLResponse)
async def read_register_page(request: Request):
    return templates.TemplateResponse(request, "auth/register.html")


@app.get("/courses/{experiment_name}/", response_class=HTMLResponse)
async def read_experiment(request: Request, experiment_name: str):
    # 操作系统兼容性修复：Jinja2 模板路径应始终使用正斜杠 "/"
    template_path = f"courses/{experiment_name}/index.html"
    file_path = os.path.join(TEMPLATES_DIR, "courses", experiment_name, "index.html")
    if os.path.exists(file_path):
        return templates.TemplateResponse(request, template_path, headers=NO_CACHE)
    placeholder_path = os.path.join(TEMPLATES_DIR, "courses", "placeholder.html")
    if os.path.exists(placeholder_path):
        # 修正 TemplateResponse 调用参数签名 (Starlette 0.27.0+)
        return templates.TemplateResponse(
            request,
            "courses/placeholder.html",
            status_code=404,
        )
    return {"error": "Not Found"}, 404


@app.get("/courses/{course_name}", response_class=HTMLResponse)
async def redirect_course_home(course_name: str):
    return RedirectResponse(url=f"/courses/{course_name}/", status_code=302)


@app.get("/courses/{course_name}/{subpath:path}", response_class=HTMLResponse)
async def read_course_subpage(request: Request, course_name: str, subpath: str):
    base_dir = os.path.abspath(os.path.join(TEMPLATES_DIR, "courses", course_name))
    templates_courses = os.path.abspath(os.path.join(TEMPLATES_DIR, "courses"))
    if not base_dir.startswith(templates_courses):
        return {"error": "Invalid path"}, 400
    if not os.path.isdir(base_dir):
        return {"error": "Not Found"}, 404
    file_path = os.path.normpath(os.path.join(base_dir, subpath))
    if not os.path.abspath(file_path).startswith(base_dir):
        return {"error": "Invalid path"}, 400
    if os.path.isfile(file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".html":
            # 使用 TemplateResponse 渲染 Jinja 模板
            # 操作系统兼容性修复：Jinja2 模板路径应始终使用正斜杠 "/"
            template_path = f"courses/{course_name}/{subpath}"
            return templates.TemplateResponse(request, template_path, headers=NO_CACHE)
        elif ext == ".css":
            return FileResponse(
                file_path, headers=NO_CACHE, media_type="text/css; charset=utf-8"
            )
        elif ext == ".js":
            return FileResponse(
                file_path,
                headers=NO_CACHE,
                media_type="application/javascript; charset=utf-8",
            )
    placeholder_path = os.path.join(TEMPLATES_DIR, "courses", "placeholder.html")
    if subpath.endswith(".html") and os.path.exists(placeholder_path):
        return FileResponse(placeholder_path, status_code=404)
    return {"error": "Not Found"}, 404
