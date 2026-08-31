import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


# ============================================================
# 1. LOAD TRAINING DATA
# ============================================================

print("Loading training dataset...")

df = pd.read_csv(
    "data/kolkata_flood_training_dataset.csv"
)

print("Dataset loaded!")
print("Rows:", len(df))
print("Columns:", len(df.columns))


# ============================================================
# 2. REMOVE TARGET FROM INPUT FEATURES
# ============================================================

X = df.drop(
    columns=["Flood_Risk_Level"]
)

y = df["Flood_Risk_Level"]


# ============================================================
# 3. REMOVE MONTH AS RAW TEXT
# ============================================================

# Month is useful, but we will convert it to a numeric
# representation instead of giving Random Forest text.

X["Month_Number"] = pd.to_datetime(
    X["Month"]
).dt.month

X = X.drop(
    columns=["Month"]
)


# ============================================================
# 4. IDENTIFY CATEGORICAL COLUMNS
# ============================================================

categorical_columns = [
    "Rainfall_Category",
    "Water_Body_Proximity",
    "Silt_Accumulation_Level",
    "Forecast_Rainfall_Category"
]


# ============================================================
# 5. IDENTIFY NUMERICAL COLUMNS
# ============================================================

numerical_columns = [
    column
    for column in X.columns
    if column not in categorical_columns
]


print("\nNumerical features:")
for column in numerical_columns:
    print("-", column)

print("\nCategorical features:")
for column in categorical_columns:
    print("-", column)


# ============================================================
# 6. PREPROCESS CATEGORICAL DATA
# ============================================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(
                handle_unknown="ignore"
            ),
            categorical_columns
        )
    ],
    remainder="passthrough"
)


# ============================================================
# 7. CREATE RANDOM FOREST
# ============================================================

random_forest = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    class_weight="balanced",
    min_samples_leaf=2
)


# ============================================================
# 8. CREATE COMPLETE PIPELINE
# ============================================================

model = Pipeline(
    steps=[
        (
            "preprocessor",
            preprocessor
        ),
        (
            "classifier",
            random_forest
        )
    ]
)


# ============================================================
# 9. SPLIT DATA
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)


print("\n====================================")
print("DATA SPLIT")
print("====================================")

print("Training records:", len(X_train))
print("Testing records:", len(X_test))


# ============================================================
# 10. TRAIN RANDOM FOREST
# ============================================================

print("\n====================================")
print("TRAINING RANDOM FOREST")
print("====================================")

model.fit(
    X_train,
    y_train
)

print("Training completed!")


# ============================================================
# 11. MAKE PREDICTIONS
# ============================================================

y_pred = model.predict(
    X_test
)


# ============================================================
# 12. MODEL ACCURACY
# ============================================================

accuracy = accuracy_score(
    y_test,
    y_pred
)

print("\n====================================")
print("MODEL PERFORMANCE")
print("====================================")

print(
    f"Accuracy: {accuracy:.2%}"
)


# ============================================================
# 13. CLASSIFICATION REPORT
# ============================================================

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        y_pred,
        zero_division=0
    )
)


# ============================================================
# 14. CONFUSION MATRIX
# ============================================================

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        y_pred
    )
)


# ============================================================
# 15. SAVE MODEL
# ============================================================

model_file = (
    "model/flood_risk_model.joblib"
)

joblib.dump(
    model,
    model_file
)

print("\n====================================")
print("MODEL SAVED")
print("====================================")

print(
    "Saved as:",
    model_file
)