"""Finding Nemo: Quiz Adventure — FastAPI Backend Entry Point."""

import os
import sys

# Ensure backend directory is in sys.path so imports work from any working directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes.auth_routes import router as auth_router
from routes.quiz_routes import router as quiz_router
from routes.leaderboard_routes import router as leaderboard_router
from routes.user_routes import router as user_router
from routes.room_routes import router as room_router

load_dotenv()

# Create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Finding Nemo: Quiz Adventure API",
    description="Backend API for the Finding Nemo educational quiz game",
    version="1.0.0"
)

# CORS middleware - allow any origin for public tunnel & cloud deployments
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(quiz_router)
app.include_router(leaderboard_router)
app.include_router(user_router)
app.include_router(room_router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


# Mount production frontend build if available
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't hijack /api or /docs
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

