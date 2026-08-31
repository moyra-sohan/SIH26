import pandas as pd

# Load combined dataset
df = pd.read_csv("data/kolkata_combined_ml_dataset.csv")

print("====================================")
print("DATASET INFORMATION")
print("====================================")

print("Rows:", len(df))
print("Columns:", len(df.columns))

print("\nMissing values:")
print(df.isnull().sum())

print("\n====================================")
print("FLOOD EVENTS")
print("====================================")

print(df["Flood_Waterlogging_Events"].value_counts(dropna=False))

print("\n====================================")
print("FLOOD SEVERITY")
print("====================================")

print(df["Flood_Severity_Level"].value_counts(dropna=False))

print("\n====================================")
print("WATERLOGGING DURATION")
print("====================================")

print(df["Estimated_Avg_Waterlogging_Duration_Hours"].describe())

print("\n====================================")
print("SAMPLE TARGET DATA")
print("====================================")

print(
    df[
        [
            "Ward_ID",
            "Month",
            "Flood_Waterlogging_Events",
            "Flood_Severity_Level",
            "Estimated_Avg_Waterlogging_Duration_Hours"
        ]
    ].head(20)
)