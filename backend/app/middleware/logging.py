import logging
import time
from typing import Callable, Dict, List
from collections import deque
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Suppress SQLAlchemy engine logs
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

logger = logging.getLogger("tpm_api")

# Global metrics storage
class MetricsCollector:
    def __init__(self, max_history=1000):
        self.request_count = 0
        self.error_count = 0
        self.total_duration = 0
        # History of recent requests: (endpoint, duration, status, timestamp)
        self.history = deque(maxlen=max_history)
        self.endpoint_stats: Dict[str, Dict] = {}

    def log_request(self, method: str, path: str, status: int, duration: float):
        self.request_count += 1
        self.total_duration += duration
        if status >= 400:
            self.error_count += 1
        
        timestamp = time.time()
        self.history.append({
            "method": method,
            "path": path,
            "status": status,
            "duration": duration,
            "timestamp": timestamp
        })

        # Update per-path stats
        if path not in self.endpoint_stats:
            self.endpoint_stats[path] = {"count": 0, "avg_duration": 0, "errors": 0}
        
        stats = self.endpoint_stats[path]
        stats["count"] += 1
        stats["errors"] += 1 if status >= 400 else 0
        # Running average
        stats["avg_duration"] = (stats["avg_duration"] * (stats["count"] - 1) + duration) / stats["count"]

    def get_stats(self):
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "avg_latency": self.total_duration / max(1, self.request_count),
            "recent_history": list(self.history)[-50:], # Last 50 for the graph
            "endpoint_breakdown": self.endpoint_stats
        }

metrics = MetricsCollector()

class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Ignore health and static files from metrics tracking
        trackable = not (request.url.path.startswith("/uploads") or 
                         request.url.path == "/health" or 
                         request.url.path == "/monitor")
        
        start_time = time.time()

        # Log request
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'unknown'}"
        )

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration = time.time() - start_time

        # Update metrics
        if trackable:
            metrics.log_request(request.method, request.url.path, response.status_code, duration)

        # Log response
        logger.info(
            f"Response: {request.method} {request.url.path} "
            f"- Status: {response.status_code} "
            f"- Duration: {duration:.3f}s"
        )

        # Add timing header
        response.headers["X-Process-Time"] = str(duration)

        return response


def setup_logging(app: FastAPI) -> None:
    """Setup logging middleware for the FastAPI app."""
    app.add_middleware(LoggingMiddleware)

