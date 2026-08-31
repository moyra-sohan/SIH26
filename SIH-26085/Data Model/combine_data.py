import pandas as pd
import os

# ============================================================
# 1. DATA FOLDER
# ============================================================

DATA_FOLDER = "data"


# ============================================================
# 2. LOAD THE MAIN DATASETS
# ============================================================

print("Loading datasets...")

rainfall = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_historical_rainfall.csv")
)

elevation = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_elevation.csv")
)

landscape = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_landscape.csv")
)

drainage = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_roads_drains.csv")
)

flood = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_flood_waterlogging_events.csv")
)

humidity = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_humidity.csv")
)

temperature = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_temperature.csv")
)

forecast = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_forecast_rainfall.csv")
)

boundary = pd.read_csv(
    os.path.join(DATA_FOLDER, "kolkata_city_boundary.csv")
)


print("All datasets loaded successfully!")


# ============================================================
# 3. CREATE COMMON MERGE KEY
# ============================================================

datasets = [
    rainfall,
    elevation,
    landscape,
    drainage,
    flood,
    humidity,
    temperature,
    forecast,
    boundary
]

for df in datasets:

    # Convert Ward_ID to integer
    df["Ward_ID"] = pd.to_numeric(
        df["Ward_ID"],
        errors="coerce"
    )

    # Convert Month to string
    df["Month"] = df["Month"].astype(str)


# ============================================================
# 4. SELECT USEFUL COLUMNS FROM EACH DATASET
# ============================================================

rainfall = rainfall[
    [
        "Ward_ID",
        "Month",
        "Historical_Rainfall_mm",
        "Estimated_Rainy_Days",
        "Rainfall_Category"
    ]
]

elevation = elevation[
    [
        "Ward_ID",
        "Month",
        "Elevation_m",
        "Groundwater_Table_Depth_m"
    ]
]

landscape = landscape[
    [
        "Ward_ID",
        "Month",
        "Water_Body_Proximity",
        "Impervious_Surface_Percent",
        "Water_Surface_Percent",
        "Seasonal_Green_Cover_Percent"
    ]
]

drainage = drainage[
    [
        "Ward_ID",
        "Month",
        "Road_Density_Index_1to10",
        "Drainage_Index_1to10",
        "Storm_Drain_Coverage_Percent",
        "Drain_Load_Utilization_Percent",
        "Silt_Accumulation_Level",
        "Reported_Road_Waterlogging_Incidents"
    ]
]

flood = flood[
    [
        "Ward_ID",
        "Month",
        "Flood_Waterlogging_Events",
        "Flood_Severity_Level",
        "Estimated_Avg_Waterlogging_Duration_Hours"
    ]
]

humidity = humidity[
    [
        "Ward_ID",
        "Month",
        "Avg_Humidity_Percent",
        "Heat_Index_C"
    ]
]

temperature = temperature[
    [
        "Ward_ID",
        "Month",
        "Avg_Temperature_C",
        "Estimated_Max_Temperature_C",
        "Estimated_Min_Temperature_C"
    ]
]

forecast = forecast[
    [
        "Ward_ID",
        "Month",
        "Forecast_Rainfall_mm",
        "Forecast_Rainfall_Category"
    ]
]


# ============================================================
# 5. MERGE THE DATASETS
# ============================================================

print("Combining datasets...")

combined = rainfall

combined = combined.merge(
    elevation,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    landscape,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    drainage,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    flood,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    humidity,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    temperature,
    on=["Ward_ID", "Month"],
    how="left"
)

combined = combined.merge(
    forecast,
    on=["Ward_ID", "Month"],
    how="left"
)


# ============================================================
# 6. SAVE COMBINED DATASET
# ============================================================

output_file = os.path.join(
    DATA_FOLDER,
    "kolkata_combined_ml_dataset.csv"
)

combined.to_csv(
    output_file,
    index=False
)


# ============================================================
# 7. SHOW INFORMATION
# ============================================================

print("\n====================================")
print("COMBINATION COMPLETED")
print("====================================")

print("Rows:", len(combined))
print("Columns:", len(combined.columns))

print("\nColumns:")
for column in combined.columns:
    print("-", column)

print("\nSaved to:")
print(output_file)

print("\nFirst 5 rows:")
print(combined.head())