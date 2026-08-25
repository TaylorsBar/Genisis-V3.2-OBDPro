from fastapi import FastAPI, WebSocket, BackgroundTasks
from pydantic import BaseModel
from .services.flash_manager import FlashManager
from .api.websocket import bridge

app = FastAPI()
manager = FlashManager(secret_key=b"S3CUR3_K4R4P1R0", dll_path="C:/drivers/j2534.dll")

class FlashRequest(BaseModel):
    config: dict
    binary: str

@app.post("/flash/initiate")
async def initiate_flash(payload: FlashRequest, background_tasks: BackgroundTasks):
    """
    Endpoint called by the React UI. 
    Runs the flash in a background task to avoid blocking the API.
    """
    
    async def run_pipeline():
        try:
            # This is the 'Glue' function that updates the WebSocket
            async def ui_update(progress, status):
                await bridge.broadcast_progress(progress, status)

            # Convert binary string to bytes (assuming base64 or similar in real app)
            binary_bytes = payload.binary.encode('utf-8')

            await manager.execute_flash_workflow(
                tune_config=payload.config, 
                binary_payload=binary_bytes, 
                ui_callback=ui_update
            )
        except Exception as e:
            await bridge.broadcast_error(str(e))

    background_tasks.add_task(run_pipeline)
    return {"status": "Pipeline Initiated", "job_id": "flash_001"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await bridge.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except Exception:
        bridge.disconnect(websocket)
