import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api.router import api_router
from app.middleware.error_handler import setup_exception_handlers
from app.middleware.cors import setup_cors
from app.middleware.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Environment: {settings.environment}")
    print(f"Debug mode: {settings.debug}")

    yield

    # Shutdown
    print("Shutting down application...")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="""
        TPM (Tiga Putra Motor) Backend API

        Sistem manajemen bisnis untuk:
        - Bengkel (Workshop) - Spare parts & services
        - Jual Beli Mobil (Car Trading)
        - Jasa Angkut (Transportation)
        - Karyawan (Employees)
        - Keuangan (Finance)
        """,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # Setup middleware
    setup_cors(app)
    setup_logging(app)
    setup_exception_handlers(app)

    # Ensure upload directory exists
    # Use realpath to resolve symlinks (points to /var/www/tpm-frontend/uploads)
    upload_path = os.path.realpath(settings.upload_full_path)
    if not os.path.exists(upload_path):
        os.makedirs(upload_path, exist_ok=True)

    # Mount static files for uploads
    app.mount(f"/{settings.upload_dir}", StaticFiles(directory=upload_path), name="uploads")

    # Include API router
    app.include_router(api_router)

    # Monitoring Endpoints
    from app.middleware.logging import metrics
    from fastapi.responses import HTMLResponse
    from app.database.connection import SessionLocal
    from sqlalchemy import text

    def get_db_stats():
        """Fetch database statistics from MySQL with intelligent discovery."""
        try:
            db = SessionLocal()
            
            # Step 1: Detect current DB name
            current_db_res = db.execute(text("SELECT DATABASE()")).fetchone()
            detected_db = current_db_res[0] if current_db_res else settings.db_name
            
            # Step 2: Try to find tables in detected DB first, then fallback to config
            schemas_to_try = [detected_db, settings.db_name]
            
            final_tables = []
            final_db_name = detected_db

            for schema in schemas_to_try:
                if not schema: continue
                
                query = text("""
                    SELECT 
                        table_name as `name`, 
                        CAST(IFNULL(table_rows, 0) AS SIGNED) as `row_count`,
                        CAST(ROUND(((IFNULL(data_length, 0) + IFNULL(index_length, 0)) / 1024 / 1024), 2) AS DECIMAL(10,2)) as `size_mb`
                    FROM information_schema.tables 
                    WHERE table_schema = :db_name
                    AND table_type = 'BASE TABLE'
                    ORDER BY `row_count` DESC
                """)
                
                result = db.execute(query, {"db_name": schema})
                records = result.fetchall()
                
                if records:
                    final_tables = [
                        {"name": r[0], "rows": int(r[1]), "size_mb": float(r[2])} 
                        for r in records
                    ]
                    final_db_name = schema
                    break

            # If still nothing, try to find any schema that has a 'users' table
            if not final_tables:
                fallback_query = text("""
                    SELECT table_schema 
                    FROM information_schema.tables 
                    WHERE table_name = 'users' 
                    LIMIT 1
                """)
                res = db.execute(fallback_query).fetchone()
                if res and res[0]:
                    # Run the same query with this discovered schema
                    schema = res[0]
                    result = db.execute(query, {"db_name": schema})
                    records = result.fetchall()
                    if records:
                        final_tables = [
                            {"name": r[0], "rows": int(r[1]), "size_mb": float(r[2])} 
                            for r in records
                        ]
                        final_db_name = schema

            total_size = sum(t['size_mb'] for t in final_tables)
            db.close()
            
            return {
                "tables": final_tables,
                "total_size_mb": round(float(total_size), 2),
                "table_count": len(final_tables),
                "current_db": final_db_name
            }
        except Exception as e:
            print(f"[Monitor] DB Audit Error: {str(e)}")
            return {"error": str(e), "tables": [], "table_count": 0, "total_size_mb": 0}

    @app.get("/api/v1/monitor/stats", tags=["Monitoring"])
    def get_monitor_stats():
        """Get real-time server metrics including DB stats."""
        stats = metrics.get_stats()
        stats["database"] = get_db_stats()
        return stats

    @app.get("/monitor", response_class=HTMLResponse, tags=["Monitoring"])
    def monitor_dashboard():
        """Standalone monitoring dashboard (Outside the app)."""
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <title>TPM Server Monitor</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; }
                .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; }
                .stat-value { font-size: 2rem; font-weight: 800; color: #38bdf8; }
                .status-ok { color: #4ade80; }
                .status-err { color: #f87171; }
                .table { color: #cbd5e1; }
                .table th { border-bottom-color: #334155; }
                .progress { height: 8px; background: #334155; }
            </style>
        </head>
        <body class="p-4">
            <div class="container">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h1 class="h3 fw-bold m-0 underline">SYSTEM MONITOR <span class="badge bg-primary fs-6">V2.2.0</span></h1>
                    <div id="last-update" class="text-secondary small">Initializing...</div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card p-4 h-100">
                            <div class="text-secondary small fw-bold">TOTAL REQUESTS</div>
                            <div id="total-req" class="stat-value">0</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 h-100">
                            <div class="text-secondary small fw-bold">AVG LATENCY</div>
                            <div class="stat-value"><span id="avg-lat">0</span><small class="fs-6">ms</small></div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 h-100">
                            <div class="text-secondary small fw-bold">DATABASE SIZE</div>
                            <div class="stat-value"><span id="db-size">0</span><small class="fs-6">MB</small></div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card p-4 h-100">
                            <div class="text-secondary small fw-bold">SERVER STATUS</div>
                            <div class="stat-value status-ok">HEALTHY</div>
                        </div>
                    </div>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card h-100 overflow-hidden">
                            <div class="card-header bg-dark border-bottom border-secondary p-3 d-flex justify-content-between">
                                <h5 class="m-0 small fw-bold">DATABASE TABLES</h5>
                                <span id="table-count" class="badge bg-primary">0 Tables</span>
                            </div>
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-dark table-sm m-0">
                                    <thead>
                                        <tr>
                                            <th>Table</th>
                                            <th class="text-end">Rows</th>
                                            <th class="text-end">Size</th>
                                        </tr>
                                    </thead>
                                    <tbody id="db-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100 overflow-hidden">
                            <div class="card-header bg-dark border-bottom border-secondary p-3">
                                <h5 class="m-0 small fw-bold">RECENT TRAFFIC (LAST 50)</h5>
                            </div>
                            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                                <table class="table table-dark table-hover m-0">
                                    <thead>
                                        <tr>
                                            <th class="small">Path</th>
                                            <th class="small">Dur</th>
                                            <th class="small">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody id="history-body"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                async function updateStats() {
                    try {
                        const res = await fetch('/api/v1/monitor/stats');
                        const data = await res.json();
                        
                        document.getElementById('total-req').innerText = data.total_requests;
                        document.getElementById('avg-lat').innerText = (data.avg_latency * 1000).toFixed(1);
                        document.getElementById('last-update').innerText = 'Last sync: ' + new Date().toLocaleTimeString();

                        // DB Stats
                        if (data.database && !data.database.error) {
                            document.getElementById('db-size').innerText = data.database.total_size_mb;
                            document.getElementById('table-count').innerText = data.database.table_count + ' Tables';
                            
                            const dbBody = document.getElementById('db-body');
                            dbBody.innerHTML = data.database.tables.map(table => `
                                <tr>
                                    <td class="small fw-bold text-info">${table.name}</td>
                                    <td class="text-end small">${table.rows.toLocaleString()}</td>
                                    <td class="text-end small text-secondary">${table.size_mb} MB</td>
                                </tr>
                            `).join('');
                        }

                        const tbody = document.getElementById('history-body');
                        tbody.innerHTML = data.recent_history.reverse().map(req => `
                            <tr>
                                <td class="text-info font-monospace x-small" style="font-size: 11px;">
                                    <span class="badge ${req.status >= 400 ? 'bg-danger' : 'bg-success'}">${req.method}</span>
                                    ${req.path.substring(0, 30)}...
                                </td>
                                <td class="small">${(req.duration * 1000).toFixed(0)}ms</td>
                                <td class="text-secondary small" style="font-size: 10px;">${new Date(req.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</td>
                            </tr>
                        `).join('');
                    } catch (e) {
                        console.error('Failed to sync monitor:', e);
                    }
                }

                setInterval(updateStats, 2000);
                updateStats();
            </script>
        </body>
        </html>
        """

    # Serve Frontend Static Files (from frontend/dist)
    frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    
    if os.path.exists(frontend_dist_path):
        app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
        
        @app.exception_handler(404)
        async def spa_catch_all(request, exc):
            from fastapi.responses import FileResponse
            return FileResponse(os.path.join(frontend_dist_path, "index.html"))

    # Health check endpoint
    @app.get("/health", tags=["Health"])
    def health_check():
        """Health check endpoint."""
        return JSONResponse(
            content={
                "status": "healthy",
                "app": settings.app_name,
                "version": settings.app_version,
            }
        )

    # Root endpoint
    @app.get("/", tags=["Root"])
    def root():
        """Root endpoint with API info."""
        return {
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs" if settings.debug else "disabled",
            "health": "/health",
            "monitor": "/monitor"
        }


    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
