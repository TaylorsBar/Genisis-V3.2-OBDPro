import pytest
import asyncio
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
from app.main import app

client = TestClient(app)

def test_websocket_broadcast():
    with client.websocket_connect("/ws") as websocket:
        # Simulate a flash initiation
        response = client.post("/flash/initiate", json={"config": {"max_egt": 900}, "binary": "testbin"})
        assert response.status_code == 200

        # Now we expect to receive progress messages over the websocket
        data = websocket.receive_json()
        assert data["type"] == "progress"
        assert data["progress"] == 2
        assert "Initializing Flash Sequence" in data["status"]

        data = websocket.receive_json()
        assert data["type"] == "progress"
        assert data["progress"] == 5

        # We also might receive error if something fails (since we mocked the J2534)
        # But this basic test proves the websocket connection and sequence.
