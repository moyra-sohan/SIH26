"""
Central Configuration & Path Management for FastAPI ML Service.
"""
import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "Urban Flood Nowcasting Machine Learning API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "High-resolution Machine Learning backend for Kolkata urban flood risk nowcasting and waterlogging prediction."
    API_V1_STR: str = "/api"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Base Paths
    ROOT_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    @property
    def MODEL_PATH(self) -> str:
        # Check artifacts directory first, then root directory
        candidate = os.path.join(self.ROOT_DIR, "artifacts", "best_flood_model.pkl")
        if os.path.exists(candidate):
            return candidate
        return os.path.join(self.ROOT_DIR, "best_flood_model.pkl")

    @property
    def FEATURES_PATH(self) -> str:
        candidate = os.path.join(self.ROOT_DIR, "artifacts", "feature_columns.pkl")
        if os.path.exists(candidate):
            return candidate
        return os.path.join(self.ROOT_DIR, "feature_columns.pkl")

    @property
    def PREPROCESSOR_PATH(self) -> str:
        candidate = os.path.join(self.ROOT_DIR, "artifacts", "preprocessor.pkl")
        if os.path.exists(candidate):
            return candidate
        return os.path.join(self.ROOT_DIR, "preprocessor.pkl")

    @property
    def META_PATH(self) -> str:
        candidate = os.path.join(self.ROOT_DIR, "artifacts", "feature_meta.json")
        if os.path.exists(candidate):
            return candidate
        return os.path.join(self.ROOT_DIR, "feature_meta.json")


settings = Settings()
