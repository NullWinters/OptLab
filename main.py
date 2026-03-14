from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from routers.agent import router as agent_router
import os

app = FastAPI()
app.include_router(agent_router)

# 挂载静态文件目录
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

# 配置模板引擎
templates = Jinja2Templates(directory="templates")

# 首页
@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/favicon.ico")
async def read_favicon():
    return FileResponse("static/favicon.ico")



# 课程列表页
@app.get("/courses", response_class=HTMLResponse)
async def redirect_courses():
    return RedirectResponse(url="/courses/")

@app.get("/courses/", response_class=HTMLResponse)
async def read_courses(request: Request):
    return templates.TemplateResponse("courses/index.html", {"request": request})

# 统一课程页面分发
@app.get("/courses/{course_name}", response_class=HTMLResponse)
async def redirect_course_home(course_name: str):
    return RedirectResponse(url=f"/courses/{course_name}/")

@app.get("/courses/{course_name}/", response_class=HTMLResponse)
@app.get("/courses/{course_name}/{subpath:path}", response_class=HTMLResponse)
async def read_course_content(request: Request, course_name: str, subpath: str = ""):
    # 尝试直接定位文件，如果 course_name 本身就是一个 .html 文件
    if course_name.endswith(".html") and not subpath:
        template_path = f"courses/{course_name}"
    else:
        # 如果子路径为空，返回该课程的 index.html
        if not subpath:
            subpath = "index.html"

        # 构造模板相对路径：Jinja2 只接受正斜杠分隔符
        template_path = f"courses/{course_name}/{subpath}".replace("\\", "/")
    
    # 路径安全性校验 (相对于 templates 目录)
    full_path = os.path.abspath(os.path.join("templates", template_path))
    templates_dir = os.path.abspath("templates")
    if not full_path.startswith(templates_dir):
        return HTMLResponse(content="Invalid path", status_code=400)
        
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return templates.TemplateResponse(template_path, {"request": request})
    
    # HTML 资源未找到时回退到占位页
    if subpath.endswith(".html"):
        return templates.TemplateResponse("courses/placeholder.html", {"request": request}, status_code=404)
        
    return HTMLResponse(content="Not Found", status_code=404)
