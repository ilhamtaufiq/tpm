from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.realtime import realtime_manager


router = APIRouter(prefix="/realtime", tags=["Realtime"])


@router.websocket("/ws")
async def realtime_ws(websocket: WebSocket):
    # Token arrives in the first frame, not the query string (access-log hygiene).
    # `authenticate` accepts the socket; `connect` then validates it.
    token = await realtime_manager.authenticate(websocket)
    if not token:
        print("[Realtime] Missing or malformed websocket auth frame")
        await websocket.close(code=4401)
        return

    connection = None
    try:
        connection = await realtime_manager.connect(websocket, token)
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        if connection:
            realtime_manager.disconnect(websocket)
