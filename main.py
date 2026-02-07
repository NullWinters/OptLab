from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI()

# 获取项目根目录
BASE_DIR = Path(__file__).resolve().parent


@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "resources/1d_search/range_search/index.html")


# HTML 页面路由
@app.get("/index.html")
async def root():
    return FileResponse(BASE_DIR / "resources/1d_search/range_search/index.html")


@app.get("/introduction.html")
async def introduction():
    return FileResponse(BASE_DIR / "resources/1d_search/range_search/introduction.html")


@app.get("/observe_and_explore.html")
async def observe_and_explore():
    return FileResponse(BASE_DIR / "resources/1d_search/range_search/observe_and_explore.html")


@app.get("/compare_and_insight.html")
async def compare_and_insight():
    return FileResponse(BASE_DIR / "resources/1d_search/range_search/compare_and_insight.html")


# 挂载静态文件（CSS、JS）
app.mount("/styles", StaticFiles(directory=BASE_DIR / "resources/1d_search/range_search/styles"))
app.mount("/scripts", StaticFiles(directory=BASE_DIR / "resources/1d_search/range_search/scripts"))
