"""
Structured Logging Configuration for FastAPI ML Service.
"""
import logging
import sys


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configures and returns the application root logger."""
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    logger = logging.getLogger("FloodNowcastML")
    return logger


logger = setup_logging()
