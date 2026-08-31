import pandas as pd

# ==========================================
# 1. LOAD COMBINED DATASET
# ==========================================

df = pd.read_csv(
    "data/kolkata_combined_ml_dataset.csv"
)

print("Original dataset:")
print("Rows:", len(df))
print("Columns:", len(df.columns))


# ==========================================
# 2. CREATE FLOOD RISK TARGET
# ==========================================

def create_risk(row):

    events = row["Flood_Waterlogging_Events"]
    severity = row["Flood_Severity_Level"]

    # No flood/waterlogging event
    if events == 0:
        return "No Risk"

    # Flood event exists
    if severity == "Minor":
        return "Minor"

    if severity == "Moderate":
        return "Moderate"

    if severity == "Major":
        return "Major"

    return "No Risk"


df["Flood_Risk_Level"] = df.apply(
    create_risk,
    axis=1
)


# ==========================================
# 3. CHECK TARGET
# ==========================================

print("\nFlood Risk Distribution:")
print(
    df["Flood_Risk_Level"].value_counts()
)


# ==========================================
# 4. REMOVE DATA-LEAKAGE COLUMNS
# ==========================================

columns_to_remove = [
    "Flood_Waterlogging_Events",
    "Flood_Severity_Level",
    "Estimated_Avg_Waterlogging_Duration_Hours"
]

training_df = df.drop(
    columns=columns_to_remove
)


# ==========================================
# 5. SAVE TRAINING DATA
# ==========================================

output_file = (
    "data/kolkata_flood_training_dataset.csv"
)

training_df.to_csv(
    output_file,
    index=False
)


print("\n====================================")
print("TRAINING DATA CREATED")
print("====================================")

print("Rows:", len(training_df))
print("Columns:", len(training_df.columns))

print("\nSaved to:")
print(output_file)

print("\nFinal columns:")

for column in training_df.columns:
    print("-", column)