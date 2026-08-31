import requests

# ==========================================
# TEST DATA
# ==========================================

data = {
    "Ward_ID": 1,
    "Month": "2026-08",
    "Historical_Rainfall_mm": 285.3,
    "Estimated_Rainy_Days": 19,
    "Rainfall_Category": "Wet",
    "Elevation_m": 3,
    "Groundwater_Table_Depth_m": 0.78,
    "Water_Body_Proximity": "Yes (Hooghly-adjacent)",
    "Impervious_Surface_Percent": 87,
    "Water_Surface_Percent": 3,
    "Seasonal_Green_Cover_Percent": 11.5,
    "Road_Density_Index_1to10": 6,
    "Drainage_Index_1to10": 4,
    "Storm_Drain_Coverage_Percent": 42,
    "Drain_Load_Utilization_Percent": 84.8,
    "Silt_Accumulation_Level": "Moderate",
    "Reported_Road_Waterlogging_Incidents": 2,
    "Avg_Humidity_Percent": 86,
    "Heat_Index_C": 37.4,
    "Avg_Temperature_C": 29.4,
    "Estimated_Max_Temperature_C": 32.4,
    "Estimated_Min_Temperature_C": 26.4,
    "Forecast_Rainfall_mm": 282.2,
    "Forecast_Rainfall_Category": "Wet"
}


# ==========================================
# SEND DATA TO FLASK
# ==========================================

url = "http://127.0.0.1:5000/predict"

response = requests.post(
    url,
    json=data
)


# ==========================================
# DISPLAY RESULT
# ==========================================

print("====================================")
print("API TEST")
print("====================================")

print("Status Code:", response.status_code)

print("\nResponse:")

print(response.json())