"""
Urban Flood Nowcasting ML API - Root Main Entry Point.
Exposes `app` for `uvicorn main:app` and direct execution via `python main.py`.
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
