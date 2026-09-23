import logging
import time
from typing import Callable, Dict, List
from collections import deque
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.models.monitoring import ClientLog

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
        # Client-reported logs (Lag, Bug, Error from Android / Web frontend)
        self.client_logs = deque(maxlen=500)

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

    def log_client_event(self, event_type: str, title: str, message: str, platform: str = "android", duration: float = 0, status: int = 0, stack: str = None, url: str = None):
        timestamp = time.time()
        self.client_logs.appendleft({
            "id": f"cli_{int(timestamp*1000)}_{len(self.client_logs)}",
            "type": event_type,
            "title": title,
            "message": message,
            "platform": platform,
            "duration": duration,
            "status": status,
            "stack": stack,
            "url": url,
            "timestamp": timestamp
        })
        self._persist_client_log(event_type, title, message, platform, duration, status, stack, url)

    def _persist_client_log(self, event_type, title, message, platform, duration, status, stack, url):
        """Persist client event to DB so it survives server restart. Best-effort, non-blocking."""
        try:
            from app.database.connection import SessionLocal
            db = SessionLocal()
            try:
                db.add(ClientLog(
                    type=event_type,
                    title=title,
                    message=message,
                    platform=platform,
                    duration=duration or None,
                    status=status or None,
                    stack=stack,
                    url=url,
                ))
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[Monitor] Gagal persist client log: {e}")

    def get_stats(self):
        # Merge in-memory (live) with DB-persisted (survives restart), newest first.
        persisted = []
        try:
            from app.database.connection import SessionLocal
            db = SessionLocal()
            try:
                rows = (
                    db.query(ClientLog)
                    .order_by(ClientLog.id.desc())
                    .limit(500)
                    .all()
                )
                persisted = [
                    {
                        "id": f"cli_{r.id}",
                        "type": r.type,
                        "title": r.title,
                        "message": r.message,
                        "platform": r.platform,
                        "duration": r.duration,
                        "status": r.status,
                        "stack": r.stack,
                        "url": r.url,
                        "timestamp": r.created_at.timestamp() if r.created_at else 0,
                    }
                    for r in rows
                ]
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[Monitor] Gagal baca client log DB: {e}")

        live = list(self.client_logs)
        if persisted:
            seen = {p["id"] for p in persisted}
            # Prepend live entries not yet in DB (just arrived, not flushed)
            merged = [l for l in live if l["id"] not in seen] + persisted
        else:
            merged = live

        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "avg_latency": self.total_duration / max(1, self.request_count),
            "recent_history": list(self.history)[-50:], # Last 50 for graph
            "endpoint_breakdown": self.endpoint_stats,
            "client_logs": merged
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

