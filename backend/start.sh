#!/bin/bash

# Wait for database to be ready (handled by healthcheck but extra safety)
echo "Waiting for database..."

# Run migrations
echo "Running database migrations..."
alembic upgrade head

# Start server
echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
