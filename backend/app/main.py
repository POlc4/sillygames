"""Point d'entrée de l'API.

Toutes les routes sont sous /api : Caddy route ce préfixe vers le backend.
"""

from fastapi import APIRouter, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth.deps import DbSession
from app.config import get_settings
from app.routers import auth, games, stats

settings = get_settings()

app = FastAPI(
    title="SillyGames API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(games.router)
api.include_router(stats.router)


@api.get("/health")
def health(db: DbSession) -> dict[str, str]:
    """Utilisé par le healthcheck Docker : vérifie aussi l'accès à la base."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "database unavailable") from exc
    return {"status": "ok", "database": "ok"}


app.include_router(api)
