from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import assistant, health, recommendations, search
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title="AI Commerce Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(assistant.router)
app.include_router(recommendations.router)
app.include_router(search.router)
