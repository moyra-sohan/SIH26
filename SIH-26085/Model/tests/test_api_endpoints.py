"""
Automated Integration Tests for Modular FastAPI ML API.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "endpoints" in data


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["wards_count"] > 0


def test_features_endpoint():
    response = client.get("/api/features")
    assert response.status_code == 200
    data = response.json()
    assert data["total_features"] > 0
    assert len(data["feature_columns"]) == data["total_features"]


def test_wards_endpoint():
    response = client.get("/api/wards")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 0
    assert len(data["wards"]) == data["count"]


def test_predict_endpoint():
    payload = {
        "ward_id": 120,
        "rainfall_mm": 110.0,
        "avg_humidity_percent": 88.0,
        "avg_temperature_c": 29.0,
        "drain_efficiency_index": 3.0,
        "is_monsoon": 1
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "flood_probability" in data
    assert "risk_level" in data
    assert "estimated_waterlogging_depth_cm" in data


def test_ward_forecasts_endpoint():
    response = client.get("/api/ward-forecasts?current_rainfall=95.0&is_monsoon=1")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] > 0
    assert len(data["forecasts"]) == data["count"]
    for f in data["forecasts"]:
        assert "risk_level" in f
        assert "flood_probability" in f


def test_batch_predict_endpoint():
    payload = {
        "items": [
            {"ward_id": 120, "rainfall_mm": 120.0},
            {"ward_id": "park-street-ward-63", "rainfall_mm": 30.0}
        ]
    }
    response = client.post("/api/batch-predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["success"] is True


if __name__ == "__main__":
    print("Running integration tests...")
    test_root_endpoint()
    print("[PASS] Root endpoint")
    test_health_endpoint()
    print("[PASS] Health endpoint")
    test_features_endpoint()
    print("[PASS] Features endpoint")
    test_wards_endpoint()
    print("[PASS] Wards endpoint")
    test_predict_endpoint()
    print("[PASS] Predict endpoint")
    test_ward_forecasts_endpoint()
    print("[PASS] Ward forecasts endpoint")
    test_batch_predict_endpoint()
    print("[PASS] Batch predict endpoint")
    print("\nALL API INTEGRATION TESTS PASSED SUCCESSFULLY!")
