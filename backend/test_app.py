import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_full_simulation_and_api():
    """Test API endpoints and verify that server starts and responds without blocking."""
    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/api/v1/health")
        assert res.status_code == 200
        health_data = res.json()
        assert health_data["status"] == "healthy"
        assert "disclaimer" in health_data

        # 2. Get all trains
        res = client.get("/api/v1/trains")
        assert res.status_code == 200
        trains = res.json()
        assert len(trains) == 5
        train_ids = {t["train_id"] for t in trains}
        assert "12952" in train_ids
        assert "12413" in train_ids
        assert "19020" in train_ids
        assert "12988" in train_ids
        assert "12910" in train_ids

        # Verify train state fields
        train_12952 = next(t for t in trains if t["train_id"] == "12952")
        assert "latitude" in train_12952
        assert "longitude" in train_12952
        assert "speed_kmph" in train_12952
        assert "heading" in train_12952
        assert "delay_minutes" in train_12952
        assert train_12952["status"] in ["RUNNING", "AT_STATION", "SIGNAL_HALT", "UNSCHEDULED_HALT", "COMPLETED"]

        # 3. Get single train live
        res = client.get("/api/v1/trains/12952/live")
        assert res.status_code == 200
        single_live = res.json()
        assert single_live["train_id"] == "12952"

        # 4. Get train route
        res = client.get("/api/v1/trains/12952/route")
        assert res.status_code == 200
        route_data = res.json()
        assert route_data["train_id"] == "12952"
        assert len(route_data["stations"]) == 9
        assert len(route_data["sections"]) == 8

        # Verify section schema fields
        sec = route_data["sections"][0]
        assert "section_id" in sec
        assert "from_station" in sec
        assert "to_station" in sec
        assert "distance_km" in sec
        assert "normal_speed_kmph" in sec
        assert "capacity_score" in sec
        assert "historical_median_time_min" in sec
        assert "historical_p90_time_min" in sec

        # 5. Get upcoming stations
        res = client.get("/api/v1/trains/12952/upcoming-stations")
        assert res.status_code == 200
        upcoming_data = res.json()
        assert upcoming_data["train_id"] == "12952"
        assert len(upcoming_data["upcoming_stations"]) > 0

        # 6. Reset simulation endpoint
        res = client.post("/api/v1/simulate/reset")
        assert res.status_code == 200
        reset_data = res.json()
        assert reset_data["status"] == "success"
        assert reset_data["active_trains_count"] == 5

        # 7. Stations list
        res = client.get("/api/v1/stations")
        assert res.status_code == 200
        stations = res.json()
        assert len(stations) == 9
        codes = [s["station_code"] for s in stations]
        assert "NDLS" in codes
        assert "MMCT" in codes

        # 8. Station detail
        res = client.get("/api/v1/stations/KOTA")
        assert res.status_code == 200
        kota = res.json()
        assert kota["station_name"] == "Kota Junction"
        assert kota["platform_count"] == 7

        # 9. Station arrivals
        res = client.get("/api/v1/stations/KOTA/arrivals")
        assert res.status_code == 200
        arrivals = res.json()
        assert arrivals["station_code"] == "KOTA"
        assert len(arrivals["arrivals"]) == 5  # all 5 trains stop at KOTA

        # 10. Station 404
        res = client.get("/api/v1/stations/INVALID")
        assert res.status_code == 404

        # 11. Sections list
        res = client.get("/api/v1/sections")
        assert res.status_code == 200
        sections = res.json()
        assert len(sections) == 8
        sec = sections[0]
        assert sec["section_id"] == "SEC_NDLS_MTJ"
        assert sec["from_station_name"] == "New Delhi"
        assert sec["to_station_name"] == "Mathura Junction"
        assert "capacity_score" in sec
        assert "historical_median_time_min" in sec
        assert "historical_p90_time_min" in sec

        # 12. Section detail
        res = client.get("/api/v1/sections/SEC_BRC_MMCT")
        assert res.status_code == 200
        s = res.json()
        assert s["distance_km"] == 392.0

        # 13. Section 404
        res = client.get("/api/v1/sections/NO_SUCH_SEC")
        assert res.status_code == 404

        # 14. Dynamic ETA Intelligence endpoint
        res = client.get("/api/v1/trains/12952/eta")
        assert res.status_code == 200
        eta = res.json()
        assert eta["train_id"] == "12952"
        assert eta["train_name"] == "Mumbai Rajdhani"
        assert "generated_at" in eta
        assert "data_freshness_seconds" in eta
        assert "current_live_state" in eta
        assert "upcoming_stations_eta" in eta
        assert len(eta["upcoming_stations_eta"]) > 0
        assert "scheduled_arrival" in eta
        assert "predicted_p10_eta" in eta
        assert "predicted_p50_eta" in eta
        assert "predicted_p90_eta" in eta
        assert "predicted_delay" in eta
        assert eta["confidence_label"] in ("HIGH", "MEDIUM", "LOW")
        assert "top_eta_factors" in eta
        assert "recovery_probability" in eta
        assert eta["delay_trend"] in ("IMPROVING", "STABLE", "WORSENING")
        
        # Verify first upcoming station has required fields
        st0 = eta["upcoming_stations_eta"][0]
        assert "station_code" in st0
        assert "predicted_p10_eta" in st0
        assert "predicted_p50_eta" in st0
        assert "predicted_p90_eta" in st0
        assert "predicted_delay" in st0
        assert st0["confidence_label"] in ("HIGH", "MEDIUM", "LOW")

        # 15. Explainability endpoint
        res = client.get("/api/v1/trains/12952/explain")
        assert res.status_code == 200
        exp = res.json()
        assert exp["train_id"] == "12952"
        assert "summary_explanation" in exp
        assert len(exp["summary_explanation"]) > 10
        assert "factor_contributions" in exp
        assert "actionable_insight" in exp

        # 16. Section Congestion endpoint
        res = client.get("/api/v1/sections/SEC_NDLS_MTJ/congestion")
        assert res.status_code == 200
        cong = res.json()
        assert cong["section_id"] == "SEC_NDLS_MTJ"
        assert 0.0 <= cong["score"] <= 1.0
        assert cong["label"] in ("LOW", "MODERATE", "HIGH")
        assert "sub_scores" in cong
        sub = cong["sub_scores"]
        assert "occupancy" in sub
        assert "trains_ahead" in sub
        assert "headway_risk" in sub
        assert "restriction_severity" in sub

        # 17. Section Congestion 404
        res = client.get("/api/v1/sections/INVALID_SEC/congestion")
        assert res.status_code == 404

        # 18. Alerts endpoint
        res = client.get("/api/v1/alerts")
        assert res.status_code == 200
        alerts = res.json()
        assert isinstance(alerts, list)

        # 19. Alerts with category filter
        res = client.get("/api/v1/alerts?category=HIGH_CONGESTION")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

        print("All API tests passed successfully!")

if __name__ == "__main__":
    test_full_simulation_and_api()

