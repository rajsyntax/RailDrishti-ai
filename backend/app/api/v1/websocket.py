from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
import logging

from app.services.websocket import ws_manager
from app.services.store import train_store

router = APIRouter(tags=["WebSocket Real-Time Feed"])

@router.websocket("/ws/live-updates")
async def websocket_live_updates(websocket: WebSocket):
    """
    WebSocket endpoint streaming live train updates every 5 seconds.
    Emits messages in format:
    {
      "type": "TRAIN_UPDATE",
      "timestamp": "2026-10-01T15:00:00Z",
      "data": [ ...list of live train states... ]
    }
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshots upon connection
        current_states = await train_store.get_all_train_states()
        now_iso = datetime.now(timezone.utc).isoformat()
        await websocket.send_json({
            "type": "TRAIN_UPDATE",
            "timestamp": now_iso,
            "data": current_states
        })

        from app.services.congestion_engine import get_all_congestion
        from app.services.alert_store import alert_store
        
        congs = await get_all_congestion()
        if congs:
            await websocket.send_json({
                "type": "CONGESTION_UPDATE",
                "timestamp": now_iso,
                "data": congs
            })

        active_alerts = await alert_store.get_all(active_only=True, limit=20)
        if active_alerts:
            await websocket.send_json({
                "type": "ALERT_UPDATE",
                "timestamp": now_iso,
                "data": active_alerts
            })

        # Keep connection open to receive any client messages or pings
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "PONG", "timestamp": datetime.now(timezone.utc).isoformat()})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logging.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)
