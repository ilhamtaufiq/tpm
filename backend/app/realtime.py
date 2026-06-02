from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import uuid4
from typing import Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.utils.constants import UserRole
from app.utils.security import verify_token
from app.services.push_notification_service import enqueue_push_notification


def _normalize_role(role: Any) -> str:
    if hasattr(role, "value"):
        return str(role.value)
    return str(role or "").upper()


def scopes_for_role(role: Any) -> set[str]:
    normalized = _normalize_role(role)
    if normalized in {UserRole.ADMIN.value, UserRole.MANAGER.value}:
        return {"*"}
    if normalized == UserRole.BENGKEL.value:
        return {"bengkel", "finance", "master"}
    if normalized == UserRole.JASA_ANGKUT.value:
        return {"jasa_angkut", "finance", "master"}
    if normalized == UserRole.MOBIL.value:
        return {"mobil", "finance", "master"}
    return {"finance"}


@dataclass
class RealtimeConnection:
    websocket: WebSocket
    user_id: int
    role: str
    scopes: set[str]
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class RealtimeManager:
    def __init__(self) -> None:
        self._connections: dict[int, RealtimeConnection] = {}
        self._lock = threading.Lock()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: Optional[asyncio.AbstractEventLoop]) -> None:
        self._loop = loop

    async def connect(self, websocket: WebSocket, token: str) -> RealtimeConnection:
        print("[Realtime] Incoming websocket connection")
        await websocket.accept()

        if token.startswith("Bearer "):
            token = token.removeprefix("Bearer ").strip()

        payload = verify_token(token)
        if not payload:
            print("[Realtime] Unauthorized websocket connection")
            await websocket.send_json(
                {
                    "type": "realtime.error",
                    "error": "unauthorized",
                    "message": "Invalid or expired token",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            await websocket.close(code=4401)
            raise WebSocketDisconnect(code=4401)

        user_id = payload.get("sub")
        role = payload.get("role") or ""
        if not user_id:
            await websocket.close(code=4401)
            raise WebSocketDisconnect(code=4401)

        connection = RealtimeConnection(
            websocket=websocket,
            user_id=int(user_id),
            role=_normalize_role(role),
            scopes=scopes_for_role(role),
        )

        with self._lock:
            self._connections[id(websocket)] = connection

        print(
            "[Realtime] Connected",
            {
                "user_id": connection.user_id,
                "role": connection.role,
                "scopes": sorted(connection.scopes),
            },
        )

        await websocket.send_json(
            {
                "type": "realtime.connected",
                "user_id": connection.user_id,
                "role": connection.role,
                "scopes": sorted(connection.scopes),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return connection

    def disconnect(self, websocket: WebSocket) -> None:
        with self._lock:
            self._connections.pop(id(websocket), None)
        print("[Realtime] Disconnected")

    async def _broadcast(self, payload: dict[str, Any]) -> None:
        scope = payload.get("scope", "all")
        with self._lock:
            connections = list(self._connections.values())

        for connection in connections:
            if "*" not in connection.scopes and scope not in connection.scopes and scope != "all":
                continue
            try:
                await connection.websocket.send_json(payload)
            except Exception:
                self.disconnect(connection.websocket)

    def publish(self, payload: dict[str, Any]) -> None:
        if not self._loop:
            return
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        if running_loop and running_loop is self._loop:
            self._loop.create_task(self._broadcast(payload))
            return

        asyncio.run_coroutine_threadsafe(self._broadcast(payload), self._loop)


realtime_manager = RealtimeManager()


def publish_realtime_event(
    *,
    event: str,
    scope: str,
    entity: str,
    action: str,
    entity_id: Any | None = None,
    data: Any | None = None,
) -> None:
    event_id = str(uuid4())
    realtime_manager.publish(
        {
            "event_id": event_id,
            "type": "realtime.event",
            "event": event,
            "scope": scope,
            "entity": entity,
            "action": action,
            "entity_id": entity_id,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    enqueue_push_notification(
        {
            "event_id": event_id,
            "scope": scope,
            "entity": entity,
            "action": action,
            "entity_id": entity_id,
            "data": data,
        }
    )
