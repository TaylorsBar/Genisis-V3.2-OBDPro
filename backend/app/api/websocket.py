import json
from fastapi import WebSocket

class WebSocketBridge:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_progress(self, progress: int, status: str):
        message = json.dumps({"type": "progress", "progress": progress, "status": status})
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_error(self, message: str):
        msg = json.dumps({"type": "error", "message": message})
        for connection in self.active_connections:
            await connection.send_text(msg)

bridge = WebSocketBridge()
