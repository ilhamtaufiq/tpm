# Rencana Implementasi WebSocket Real-Time (TPM Super App)

Dokumen ini merinci langkah-langkah untuk mengintegrasikan WebSocket ke dalam ekosistem TPM (FastAPI Backend + React Native Frontend) guna menggantikan REST polling dengan pembaruan data real-time yang lebih efisien.

## 1. Arsitektur Backend (FastAPI)

### A. Connection Manager (`backend/app/core/websocket.py`)
Mengelola koneksi aktif dan menyediakan fungsi broadcast.

```python
from typing import Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Menyimpan koneksi berdasarkan user_id
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except Exception:
                # Membersihkan koneksi yang rusak secara otomatis
                pass

manager = ConnectionManager()
```

### B. Endpoint dengan Auth (`backend/app/api/endpoints/ws.py`)
WebSocket memerlukan token via Query Parameter karena header custom tidak didukung secara native oleh semua client browser/mobile.

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from app.core.websocket import manager

router = APIRouter()

async def get_token_ws(token: str = Query(...)):
    # Logika validasi JWT Anda di sini
    if not token_valid(token):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    return token

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: str,
    token: str = Depends(get_token_ws)
):
    await manager.connect(user_id, websocket)
    try:
        while True:
            # Menunggu pesan (bisa heartbeat/keep-alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
```

## 2. Arsitektur Frontend (React Native)

### A. useRealTime Hook (`frontend/hooks/useRealTime.ts`)
Menggunakan Event Driven Invalidation.

```typescript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useRealTime = (userId: string, token: string) => {
  const queryClient = useQueryClient();
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      // Tambahkan token sebagai query param
      ws.current = new WebSocket(`ws://api.tpm.com/ws/${userId}?token=${token}`);

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        // Case: Refresh data spesifik berdasarkan modul
        if (msg.module) {
          queryClient.invalidateQueries({ queryKey: [msg.module] });
        }
      };

      ws.current.onclose = () => setTimeout(connect, 3000);
    };

    if (userId && token) connect();
    return () => ws.current?.close();
  }, [userId, token]);
};
```

## 3. Strategi Keamanan & Skalabilitas

1.  **JWT via Query**: Pastikan endpoint WebSocket hanya menerima koneksi dengan token yang valid.
2.  **Invalidate over Push**: Jangan mengirim data besar lewat WebSocket. Kirim "sinyal" untuk memicu React Query mengambil data via REST. Ini menjaga agar logika validasi dan transformasi data terpusat di REST API.
3.  **Broadcaster (Optional)**: Jika nanti menggunakan multiple worker (Gunicorn/Uvicorn), gunakan `broadcaster` dengan Redis agar pesan sampai ke semua worker.

---

> [!TIP]
> **Done**: File ini telah disimpan sebagai referensi implementasi tim.
