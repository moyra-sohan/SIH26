from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os

# ==========================================
# CREATE FLASK APPLICATION
# ==========================================

app = Flask(__name__)
# Enable CORS for all routes and origins
CORS(app, resources={r"/*": {"origins": "*"}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "model")

# ==========================================
# LOAD TRAINED RANDOM FOREST MODEL
# ==========================================

model_path = os.path.join(MODEL_DIR, "flood_risk_model.joblib")
model = joblib.load(model_path)

print("====================================")
print("FLOOD RISK & NOWCASTING API")
print("====================================")
print("Random Forest model loaded successfully from:", model_path)

# ==========================================
# LOAD DATASETS FOR ENRICHED QUERIES
# ==========================================

try:
    df_combined = pd.read_csv(os.path.join(DATA_DIR, "kolkata_combined_ml_dataset.csv"))
    df_boundary = pd.read_csv(os.path.join(DATA_DIR, "kolkata_city_boundary.csv"))
    df_training = pd.read_csv(os.path.join(DATA_DIR, "kolkata_flood_training_dataset.csv"))
    df_hist_12m = pd.read_csv(os.path.join(DATA_DIR, "kolkata_historical_rainfall_wardwise_12_months.csv"))
    print("Datasets loaded successfully!")
except Exception as e:
    print("Warning loading datasets:", e)
    df_combined = None
    df_boundary = None
    df_training = None
    df_hist_12m = None


# Helper to compute risk score (0 to 1) from probabilities
def calculate_risk_score(prob_dict):
    major_p = prob_dict.get("Major", 0.0)
    mod_p = prob_dict.get("Moderate", 0.0)
    minor_p = prob_dict.get("Minor", 0.0)
    return round(float(major_p * 1.0 + mod_p * 0.6 + minor_p * 0.25), 3)


# ==========================================
# 1. HEALTH CHECK
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "success",
        "service": "Kolkata Urban Flood Nowcasting ML API",
        "version": "2.0.0",
        "model": "Random Forest Classifier (200 Estimators)",
        "endpoints": [
            "/predict",
            "/api/wards",
            "/api/ward/<id>",
            "/api/stats",
            "/api/rainfall-trend",
            "/api/alerts",
            "/api/forecast"
        ]
    })


# ==========================================
# 2. FLOOD PREDICTION ENDPOINT (WITH AUTO-FILL)
# ==========================================

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"status": "error", "message": "No JSON payload provided"}), 400

        # Handle single object or list
        is_list = isinstance(data, list)
        records = data if is_list else [data]

        filled_records = []
        for r in records:
            # Look up baseline features for this ward or default to ward 1
            ward_id = int(r.get("Ward_ID", 1))
            baseline = {}
            if df_training is not None:
                matches = df_training[df_training["Ward_ID"] == ward_id]
                if not matches.empty:
                    baseline = matches.iloc[0].to_dict()
                else:
                    baseline = df_training.iloc[0].to_dict()
            
            # Merge provided inputs on top of baseline
            combined_record = {**baseline, **r}
            filled_records.append(combined_record)

        input_df = pd.DataFrame(filled_records)

        # Convert Month to Month_Number
        if "Month" in input_df.columns:
            input_df["Month_Number"] = pd.to_datetime(input_df["Month"]).dt.month
            input_df = input_df.drop(columns=["Month"])
        elif "Month_Number" not in input_df.columns:
            input_df["Month_Number"] = 8  # Default to August (monsoon peak)

        # Remove extra columns that might be present in UI payload but not in model features
        for extra in ["Ward_Name", "Zone", "Latitude", "Longitude", "Flood_Risk_Level", "Predicted_Risk", "id", "name"]:
            if extra in input_df.columns:
                input_df = input_df.drop(columns=[extra])

        # Make prediction
        predictions = model.predict(input_df)
        probabilities = model.predict_proba(input_df)
        classes = model.classes_

        results = []
        for i, (pred, prob_row) in enumerate(zip(predictions, probabilities)):
            prob_dict = {cls_name: round(float(p), 4) for cls_name, p in zip(classes, prob_row)}
            score = calculate_risk_score(prob_dict)
            results.append({
                "predicted_risk": str(pred),
                "risk_score": score,
                "probabilities": prob_dict
            })

        if not is_list:
            return jsonify({
                "status": "success",
                "predicted_risk": results[0]["predicted_risk"],
                "risk_score": results[0]["risk_score"],
                "probabilities": results[0]["probabilities"]
            })
        else:
            return jsonify({
                "status": "success",
                "count": len(results),
                "predictions": results
            })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 400


# ==========================================
# 3. GET ALL WARDS WITH MODEL PREDICTIONS
# ==========================================

@app.route("/api/wards", methods=["GET"])
def get_wards():
    try:
        target_month = request.args.get("month", "2026-08")
        
        filtered_train = df_training[df_training["Month"] == target_month].copy()
        if filtered_train.empty:
            filtered_train = df_training.tail(18).copy()

        filtered_boundary = df_boundary[df_boundary["Month"] == target_month].copy()
        if filtered_boundary.empty:
            filtered_boundary = df_boundary.tail(18).copy()

        X = filtered_train.copy()
        X["Month_Number"] = pd.to_datetime(X["Month"]).dt.month
        X_features = X.drop(columns=["Flood_Risk_Level", "Month"])

        preds = model.predict(X_features)
        probs = model.predict_proba(X_features)
        classes = model.classes_

        wards = []
        for idx, (_, row) in enumerate(filtered_train.iterrows()):
            ward_id = int(row["Ward_ID"])
            
            b_row = filtered_boundary[filtered_boundary["Ward_ID"] == ward_id]
            ward_name = b_row["Ward_Name"].values[0] if not b_row.empty else f"Ward {ward_id}"
            zone = b_row["Zone"].values[0] if not b_row.empty else "Kolkata"
            lat = float(b_row["Latitude"].values[0]) if not b_row.empty else 22.5726
            lng = float(b_row["Longitude"].values[0]) if not b_row.empty else 88.3639
            area = float(b_row["Approx_Ward_Area_Sqkm"].values[0]) if not b_row.empty else 5.0
            dist_center = float(b_row["Distance_from_City_Center_km"].values[0]) if not b_row.empty else 5.0

            prob_dict = {cls_name: round(float(p), 4) for cls_name, p in zip(classes, probs[idx])}
            risk_score = calculate_risk_score(prob_dict)
            pred_risk = str(preds[idx])

            ward_obj = {
                "ward_id": ward_id,
                "ward_name": ward_name,
                "zone": zone,
                "latitude": lat,
                "longitude": lng,
                "area_sqkm": area,
                "distance_from_center_km": dist_center,
                "month": target_month,
                
                # ML Predictions
                "predicted_risk": pred_risk,
                "risk_score": risk_score,
                "probabilities": prob_dict,

                # Key Environmental & Infrastructure Metrics
                "historical_rainfall_mm": float(row.get("Historical_Rainfall_mm", 0.0)),
                "forecast_rainfall_mm": float(row.get("Forecast_Rainfall_mm", 0.0)),
                "estimated_rainy_days": int(row.get("Estimated_Rainy_Days", 0)),
                "elevation_m": float(row.get("Elevation_m", 0.0)),
                "drain_load_utilization_percent": float(row.get("Drain_Load_Utilization_Percent", 0.0)),
                "drainage_index": float(row.get("Drainage_Index_1to10", 0.0)),
                "road_density_index": float(row.get("Road_Density_Index_1to10", 0.0)),
                "storm_drain_coverage_percent": float(row.get("Storm_Drain_Coverage_Percent", 0.0)),
                "impervious_surface_percent": float(row.get("Impervious_Surface_Percent", 0.0)),
                "green_cover_percent": float(row.get("Seasonal_Green_Cover_Percent", 0.0)),
                "water_surface_percent": float(row.get("Water_Surface_Percent", 0.0)),
                "water_body_proximity": str(row.get("Water_Body_Proximity", "")),
                "silt_accumulation_level": str(row.get("Silt_Accumulation_Level", "")),
                "reported_waterlogging_incidents": int(row.get("Reported_Road_Waterlogging_Incidents", 0)),
                "avg_humidity_percent": float(row.get("Avg_Humidity_Percent", 0.0)),
                "avg_temperature_c": float(row.get("Avg_Temperature_C", 0.0)),
                "heat_index_c": float(row.get("Heat_Index_C", 0.0)),
            }
            wards.append(ward_obj)

        return jsonify({
            "status": "success",
            "count": len(wards),
            "month": target_month,
            "wards": wards
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 4. GET SINGLE WARD DETAIL & 12M HISTORY
# ==========================================

@app.route("/api/ward/<int:ward_id>", methods=["GET"])
def get_ward_detail(ward_id):
    try:
        target_month = request.args.get("month", "2026-08")
        ward_train = df_training[(df_training["Ward_ID"] == ward_id) & (df_training["Month"] == target_month)]
        if ward_train.empty:
            ward_train = df_training[df_training["Ward_ID"] == ward_id].tail(1)
        if ward_train.empty:
            return jsonify({"status": "error", "message": f"Ward ID {ward_id} not found"}), 404

        row = ward_train.iloc[0]
        
        X = ward_train.copy()
        X["Month_Number"] = pd.to_datetime(X["Month"]).dt.month
        X_features = X.drop(columns=["Flood_Risk_Level", "Month"])
        pred = model.predict(X_features)[0]
        probs = model.predict_proba(X_features)[0]
        prob_dict = {cls_name: round(float(p), 4) for cls_name, p in zip(model.classes_, probs)}

        b_row = df_boundary[(df_boundary["Ward_ID"] == ward_id) & (df_boundary["Month"] == target_month)]
        if b_row.empty:
            b_row = df_boundary[df_boundary["Ward_ID"] == ward_id].tail(1)
        
        ward_name = b_row["Ward_Name"].values[0] if not b_row.empty else f"Ward {ward_id}"
        zone = b_row["Zone"].values[0] if not b_row.empty else "Kolkata"
        lat = float(b_row["Latitude"].values[0]) if not b_row.empty else 22.5726
        lng = float(b_row["Longitude"].values[0]) if not b_row.empty else 88.3639

        hist_records = []
        if df_combined is not None:
            ward_all_months = df_combined[df_combined["Ward_ID"] == ward_id].sort_values("Month")
            for _, h_row in ward_all_months.iterrows():
                hist_records.append({
                    "month": str(h_row["Month"]),
                    "rainfall_mm": float(h_row.get("Historical_Rainfall_mm", 0.0)),
                    "forecast_rainfall_mm": float(h_row.get("Forecast_Rainfall_mm", 0.0)),
                    "drain_load_utilization": float(h_row.get("Drain_Load_Utilization_Percent", 0.0)),
                    "waterlogging_events": int(h_row.get("Flood_Waterlogging_Events", 0)),
                    "severity": str(h_row.get("Flood_Severity_Level", "None")),
                    "humidity": float(h_row.get("Avg_Humidity_Percent", 0.0)),
                    "temp": float(h_row.get("Avg_Temperature_C", 0.0)),
                })

        return jsonify({
            "status": "success",
            "ward_id": ward_id,
            "ward_name": ward_name,
            "zone": zone,
            "latitude": lat,
            "longitude": lng,
            "predicted_risk": str(pred),
            "risk_score": calculate_risk_score(prob_dict),
            "probabilities": prob_dict,
            "features": {
                "historical_rainfall_mm": float(row.get("Historical_Rainfall_mm", 0.0)),
                "forecast_rainfall_mm": float(row.get("Forecast_Rainfall_mm", 0.0)),
                "elevation_m": float(row.get("Elevation_m", 0.0)),
                "drain_load_utilization_percent": float(row.get("Drain_Load_Utilization_Percent", 0.0)),
                "drainage_index": float(row.get("Drainage_Index_1to10", 0.0)),
                "road_density_index": float(row.get("Road_Density_Index_1to10", 0.0)),
                "impervious_surface_percent": float(row.get("Impervious_Surface_Percent", 0.0)),
                "green_cover_percent": float(row.get("Seasonal_Green_Cover_Percent", 0.0)),
                "water_body_proximity": str(row.get("Water_Body_Proximity", "")),
                "reported_waterlogging_incidents": int(row.get("Reported_Road_Waterlogging_Incidents", 0)),
                "humidity": float(row.get("Avg_Humidity_Percent", 0.0)),
                "temperature": float(row.get("Avg_Temperature_C", 0.0)),
            },
            "history_12m": hist_records
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 5. GET CITY STATS & KPIS
# ==========================================

@app.route("/api/stats", methods=["GET"])
def get_stats():
    try:
        target_month = request.args.get("month", "2026-08")
        ward_id = request.args.get("ward_id")

        if ward_id:
            wid = int(ward_id)
            target = df_training[(df_training["Ward_ID"] == wid) & (df_training["Month"] == target_month)]
            if target.empty:
                target = df_training[df_training["Ward_ID"] == wid].tail(1)
            row = target.iloc[0]

            X = target.copy()
            X["Month_Number"] = pd.to_datetime(X["Month"]).dt.month
            X_features = X.drop(columns=["Flood_Risk_Level", "Month"])
            pred = model.predict(X_features)[0]
            probs = model.predict_proba(X_features)[0]
            prob_dict = {cls_name: round(float(p), 4) for cls_name, p in zip(model.classes_, probs)}
            risk_score = calculate_risk_score(prob_dict)

            return jsonify({
                "status": "success",
                "scope": f"Ward {wid}",
                "rainfall_24h": round(float(row.get("Historical_Rainfall_mm", 0.0)), 1),
                "flood_risk_level": str(pred),
                "flood_risk_score": risk_score,
                "water_level_m": 4.2 if "Hooghly" in str(row.get("Water_Body_Proximity", "")) else 2.8,
                "drain_utilization_percent": round(float(row.get("Drain_Load_Utilization_Percent", 0.0)), 1),
                "affected_roads": int(row.get("Reported_Road_Waterlogging_Incidents", 0)),
                "elevation_m": float(row.get("Elevation_m", 0.0)),
                "drainage_status": "Overloaded" if float(row.get("Drain_Load_Utilization_Percent", 0.0)) > 90 else "Operational",
            })
        else:
            aug = df_training[df_training["Month"] == target_month].copy()
            if aug.empty:
                aug = df_training.tail(18).copy()

            aug["Month_Number"] = 8
            X = aug.drop(columns=["Flood_Risk_Level", "Month"])
            preds = model.predict(X)

            major_count = sum(1 for p in preds if p == "Major")
            mod_count = sum(1 for p in preds if p == "Moderate")
            minor_count = sum(1 for p in preds if p == "Minor")
            safe_count = sum(1 for p in preds if p == "No Risk")

            avg_rainfall = round(float(aug["Historical_Rainfall_mm"].mean()), 1)
            avg_drain = round(float(aug["Drain_Load_Utilization_Percent"].mean()), 1)
            total_incidents = int(aug["Reported_Road_Waterlogging_Incidents"].sum())

            return jsonify({
                "status": "success",
                "scope": "Kolkata City Overview",
                "total_wards": len(aug),
                "major_risk_wards": major_count,
                "moderate_risk_wards": mod_count,
                "minor_risk_wards": minor_count,
                "safe_wards": safe_count,
                "avg_rainfall_mm": avg_rainfall,
                "avg_drain_utilization_percent": avg_drain,
                "total_affected_roads": total_incidents,
                "hooghly_water_level_m": 4.2,
                "city_overall_risk": "Major" if major_count >= 4 else "Moderate",
                "rainfall_24h": avg_rainfall,
                "flood_risk_level": "Major" if major_count >= 4 else "Moderate",
                "flood_risk_score": 0.82 if major_count >= 4 else 0.58
            })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 6. GET RAINFALL TRENDS
# ==========================================

@app.route("/api/rainfall-trend", methods=["GET"])
def get_rainfall_trend():
    try:
        ward_id = request.args.get("ward_id")
        period = request.args.get("period", "24h")

        if ward_id and str(ward_id).isdigit():
            wid = int(ward_id)
            ward_data = df_combined[df_combined["Ward_ID"] == wid].sort_values("Month")
            if not ward_data.empty:
                trend = []
                for _, r in ward_data.iterrows():
                    month_label = str(r["Month"])
                    trend.append({
                        "time": month_label,
                        "rainfall": round(float(r.get("Historical_Rainfall_mm", 0.0)), 1),
                        "forecast": round(float(r.get("Forecast_Rainfall_mm", 0.0)), 1),
                        "drainLoad": round(float(r.get("Drain_Load_Utilization_Percent", 0.0)), 1)
                    })
                return jsonify({
                    "status": "success",
                    "ward_id": wid,
                    "trend": trend
                })

        months = df_combined["Month"].unique() if df_combined is not None else []
        city_trend = []
        for m in sorted(months):
            m_df = df_combined[df_combined["Month"] == m]
            city_trend.append({
                "time": str(m),
                "rainfall": round(float(m_df["Historical_Rainfall_mm"].mean()), 1),
                "forecast": round(float(m_df["Forecast_Rainfall_mm"].mean()), 1),
                "drainLoad": round(float(m_df["Drain_Load_Utilization_Percent"].mean()), 1)
            })

        return jsonify({
            "status": "success",
            "scope": "City Trend",
            "trend": city_trend
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 7. GET DYNAMIC ALERTS
# ==========================================

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    try:
        target_month = request.args.get("month", "2026-08")
        aug = df_training[df_training["Month"] == target_month].copy()
        if aug.empty:
            aug = df_training.tail(18).copy()

        aug["Month_Number"] = 8
        X = aug.drop(columns=["Flood_Risk_Level", "Month"])
        preds = model.predict(X)

        merged = aug.merge(df_boundary[df_boundary["Month"] == target_month][["Ward_ID", "Ward_Name", "Zone"]], on="Ward_ID")
        merged["Predicted_Risk"] = preds

        alerts = []
        alert_id = 1

        major_wards = merged[merged["Predicted_Risk"] == "Major"]["Ward_Name"].tolist()
        if major_wards:
            alerts.append({
                "id": alert_id,
                "severity": "high",
                "message": f"CRITICAL: Major flood risk predicted in {', '.join(major_wards[:4])}. Severe waterlogging expected.",
                "time": "Just now",
                "iconName": "AlertTriangle",
                "type": "model_prediction"
            })
            alert_id += 1

        overloaded_drains = merged[merged["Drain_Load_Utilization_Percent"] > 95]["Ward_Name"].tolist()
        if overloaded_drains:
            alerts.append({
                "id": alert_id,
                "severity": "warning",
                "message": f"Drainage Alert: Capacity utilization >95% in {', '.join(overloaded_drains[:3])}.",
                "time": "12 mins ago",
                "iconName": "AlertTriangle",
                "type": "drainage"
            })
            alert_id += 1

        alerts.append({
            "id": alert_id,
            "severity": "info",
            "message": "Heavy monsoon rainfall forecasted (280-350mm). Pumping stations on high alert.",
            "time": "25 mins ago",
            "iconName": "Info",
            "type": "weather"
        })

        advisories = [
            f"Avoid low-lying routes in {', '.join(major_wards[:3]) if major_wards else 'South & East zones'}.",
            "High tide in Hooghly river may slow lock-gate drainage discharge.",
            "Park vehicles in elevated zones and keep emergency contact numbers handy.",
            "Municipal pumping units deployed across Behala, Kasba, Topsia, and Garden Reach."
        ]

        return jsonify({
            "status": "success",
            "alerts": alerts,
            "advisories": advisories
        })

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# START SERVER
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )