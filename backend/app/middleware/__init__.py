from app.middleware.error_handler import setup_exception_handlers
from app.middleware.cors import setup_cors

__all__ = ["setup_exception_handlers", "setup_cors"]
