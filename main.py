from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from routers.agent import router as agent_router
from routers.auth import router as auth_router
from routers.experiments import router as experiments_router
from routers.notes import router as notes_router
import os

app = FastAPI()
app.include_router(agent_router)
app.include_router(auth_router)
app.include_router(experiments_router)
app.include_router(notes_router)

if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}


@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/favicon.ico", include_in_schema=False)
async def read_favicon():
    return FileResponse(os.path.join("static", "favicon.ico"))


@app.get("/profile", response_class=HTMLResponse)
async def read_profile(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})


@app.get("/courses", response_class=HTMLResponse)
async def redirect_courses_no_slash():
    return RedirectResponse(url="/courses/", status_code=302)


@app.get("/courses/", response_class=HTMLResponse)
async def read_courses(request: Request):
    return templates.TemplateResponse("courses/index.html", {"request": request})


@app.get("/auth/login", response_class=HTMLResponse)
async def read_login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@app.get("/auth/register", response_class=HTMLResponse)
async def read_register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", {"request": request})


@app.get("/courses/{experiment_name}/", response_class=HTMLResponse)
async def read_experiment(request: Request, experiment_name: str):
    template_path = f"courses/{experiment_name}/index.html"
    file_path = os.path.join("templates", template_path)
    if os.path.exists(file_path):
        return templates.TemplateResponse(
            template_path,
            {"request": request},
            headers=NO_CACHE,
        )
    placeholder_path = os.path.join("templates", "courses", "placeholder.html")
    if os.path.exists(placeholder_path):
        return templates.TemplateResponse(
            "courses/placeholder.html",
            {"request": request},
            status_code=404,
        )
    return {"error": "Not Found"}, 404


@app.get("/courses/{course_name}", response_class=HTMLResponse)
async def redirect_course_home(course_name: str):
    return RedirectResponse(url=f"/courses/{course_name}/", status_code=302)


@app.get("/courses/{course_name}/{subpath:path}", response_class=HTMLResponse)
async def read_course_subpage(request: Request, course_name: str, subpath: str):
    base_dir = os.path.abspath(os.path.join("templates", "courses", course_name))
    templates_courses = os.path.abspath(os.path.join("templates", "courses"))
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
            template_path = os.path.join("courses", course_name, subpath)
            return templates.TemplateResponse(
                template_path,
                {"request": request},
                headers=NO_CACHE,
            )
        elif ext == ".css":
            return FileResponse(file_path, headers=NO_CACHE, media_type="text/css; charset=utf-8")
        elif ext == ".js":
            return FileResponse(file_path, headers=NO_CACHE, media_type="application/javascript; charset=utf-8")
    placeholder_path = "templates/courses/placeholder.html"
    if subpath.endswith(".html") and os.path.exists(placeholder_path):
        return FileResponse(placeholder_path, status_code=404)
    return {"error": "Not Found"}, 404
