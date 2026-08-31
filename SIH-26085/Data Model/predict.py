import pandas as pd
import joblib

# ==========================================
# 1. LOAD TRAINED MODEL
# ==========================================

model = joblib.load(
    "model/flood_risk_model.joblib"
)

print("====================================")
print("FLOOD RISK PREDICTION")
print("====================================")
print("Trained model loaded successfully!")


# ==========================================
# 2. LOAD DATASET
# ==========================================

df = pd.read_csv(
    "data/kolkata_flood_training_dataset.csv"
)


# ==========================================
# 3. SELECT ONE RECORD
# ==========================================

sample = df.drop(
    columns=["Flood_Risk_Level"]
).iloc[[0]]

actual_risk = df[
    "Flood_Risk_Level"
].iloc[0]


# ==========================================
# 4. CONVERT MONTH TO MONTH NUMBER
# ==========================================

sample["Month_Number"] = pd.to_datetime(
    sample["Month"]
).dt.month

sample = sample.drop(
    columns=["Month"]
)


# ==========================================
# 5. PREDICT
# ==========================================

prediction = model.predict(sample)

probabilities = model.predict_proba(sample)


# ==========================================
# 6. DISPLAY RESULT
# ==========================================

print("\nInput data:")
print(
    sample.to_string(index=False)
)

print("\n------------------------------------")

print(
    "Actual Risk:",
    actual_risk
)

print(
    "Predicted Risk:",
    prediction[0]
)

print("\nPrediction Probabilities:")

classes = model.classes_

for class_name, probability in zip(
    classes,
    probabilities[0]
):
    print(
        f"{class_name}: {probability:.2%}"
    )

print("\n====================================")
print("PREDICTION COMPLETED")
print("====================================")