from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from routers.agent import router as agent_router
import os

app = FastAPI()
app.include_router(agent_router)

# 挂载静态文件目录
if not os.path.exists("static"):
    os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

# 首页
@app.get("/")
async def read_index():
    return FileResponse("templates/index.html")

# 实验中心占位页
@app.get("/lab")
async def read_lab():
    return FileResponse("templates/lab.html")

# 课程列表页
@app.get("/courses/")
async def read_courses():
    return FileResponse("templates/courses/index.html")

# 实验子页面（泛匹配）
@app.get("/courses/{experiment_name}/")
async def read_experiment(experiment_name: str):
    # 构建路径：templates/courses/{experiment_name}/index.html
    file_path = f"templates/courses/{experiment_name}/index.html"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    # 如果路径不存在，返回 404 或默认占位
    placeholder_path = "templates/courses/placeholder.html"
    if os.path.exists(placeholder_path):
        return FileResponse(placeholder_path, status_code=404)
    return {"error": "Not Found"}, 404


# 一维搜索方法实验网页资源路径（静态子页面与脚本、样式等）
@app.get("/courses/line-search/{subpath:path}")
async def read_line_search_assets(subpath: str):
    base_dir = os.path.join("templates", "courses", "line-search")
    file_path = os.path.normpath(os.path.join(base_dir, subpath))
    # 路径安全性校验，避免越权访问
    if not os.path.abspath(file_path).startswith(os.path.abspath(base_dir)):
        return {"error": "Invalid path"}, 400
    if os.path.exists(file_path) and os.path.isfile(file_path):
        resp = FileResponse(file_path)
        # 开发阶段禁用缓存，确保浏览器始终获取最新文件
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return resp
    # HTML 资源未找到时回退到占位页；其他类型直接 404
    placeholder_path = "templates/courses/placeholder.html"
    if subpath.endswith(".html") and os.path.exists(placeholder_path):
        return FileResponse(placeholder_path, status_code=404)
    return {"error": "Not Found"}, 404
