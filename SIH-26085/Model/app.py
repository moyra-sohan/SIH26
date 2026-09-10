"""
Urban Flood Nowcasting ML API - Root Entry Point (Backward Compatible).
Exposes `app` for `uvicorn app:app` and direct script execution via `python app.py`.
"""
import uvicorn
from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
