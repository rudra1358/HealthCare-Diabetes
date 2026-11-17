from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from flask import Flask, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "diabetes_prediction_dataset.xls"
MODEL_PATH = BASE_DIR / "best_fraud_pipeline.pkl"
EXPECTED_SKLEARN_VERSION = "1.7.2"
FEATURE_COLUMNS = [
    "gender",
    "age",
    "hypertension",
    "heart_disease",
    "smoking_history",
    "bmi",
    "HbA1c_level",
    "blood_glucose_level",
]
REQUIRED_COLUMNS = FEATURE_COLUMNS + ["diabetes"]
SMOKING_VALUES = {"never", "former", "current", "not current", "ever"}
NUMERIC_RANGES = {
    "age": (0.08, 80),
    "bmi": (10.01, 95.69),
    "HbA1c_level": (3.5, 9),
    "blood_glucose_level": (80, 300),
}

app = Flask(__name__)

if not DATA_PATH.is_file():
    raise FileNotFoundError(f"Dataset not found: {DATA_PATH}")

dataset = pd.read_csv(DATA_PATH)
missing_columns = sorted(set(REQUIRED_COLUMNS) - set(dataset.columns))
if missing_columns:
    raise ValueError(f"Dataset is missing required columns: {', '.join(missing_columns)}")
model_training_data = dataset[dataset["smoking_history"] != "No Info"]


def iqr_bounds(values):
    first_quartile, third_quartile = values.quantile([0.25, 0.75])
    spread = third_quartile - first_quartile
    return (
        float(first_quartile - 1.5 * spread),
        float(third_quartile + 1.5 * spread),
    )


BMI_BOUNDS = iqr_bounds(model_training_data["bmi"])
GLUCOSE_BOUNDS = iqr_bounds(model_training_data["blood_glucose_level"])
HBA1C_BOUNDS = iqr_bounds(model_training_data["HbA1c_level"])

model = None
model_error = None
if not MODEL_PATH.is_file():
    model_error = f"Saved model not found: {MODEL_PATH.name}"
elif sklearn.__version__ != EXPECTED_SKLEARN_VERSION:
    model_error = (
        f"The saved model requires scikit-learn {EXPECTED_SKLEARN_VERSION}; "
        f"the active environment has {sklearn.__version__}. "
        "Install the dependencies from requirements.txt and restart the app."
    )
else:
    try:
        model = joblib.load(MODEL_PATH)
    except (ImportError, OSError, AttributeError, ValueError) as exc:
        model_error = f"Could not load {MODEL_PATH.name}: {exc}"


def build_dashboard_data():
    data = dataset
    counts = data["diabetes"].value_counts().reindex([0, 1], fill_value=0)
    known_smoking_data = model_training_data
    model_target_counts = known_smoking_data["diabetes"].value_counts().reindex(
        [0, 1], fill_value=0
    )
    heart_by_gender = known_smoking_data.groupby("gender")["heart_disease"].sum()
    hypertension_by_gender = known_smoking_data.groupby("gender")["hypertension"].sum()
    diabetes_by_gender = known_smoking_data.groupby("gender")["diabetes"].sum()

    sample = data.sample(n=min(1400, len(data)), random_state=42)
    plot_sample = data.groupby("diabetes", group_keys=False).sample(
        n=min(1200, int(counts.min())), random_state=42
    )

    numeric_columns = [
        "age",
        "bmi",
        "HbA1c_level",
        "blood_glucose_level",
    ]
    distributions = {}
    grouped_values = {}
    for column in numeric_columns:
        lower = float(data[column].min())
        upper = float(data[column].max())
        edges = np.linspace(lower, upper, 41)
        centers = ((edges[:-1] + edges[1:]) / 2).round(2)
        grouped = {}
        for label in (0, 1):
            values = data.loc[data["diabetes"] == label, column].to_numpy()
            grouped[str(label)], _ = np.histogram(values, bins=edges)
        distributions[column] = {
            "labels": centers.tolist(),
            "noDiabetes": grouped["0"].tolist(),
            "diabetes": grouped["1"].tolist(),
        }
        grouped_values[column] = {
            str(label): plot_sample.loc[
                plot_sample["diabetes"] == label, column
            ].round(2).tolist()
            for label in (0, 1)
        }

    smoking_counts = data["smoking_history"].value_counts().reindex(
        ["never", "No Info", "former", "current", "not current", "ever"], fill_value=0
    )
    smoking_crosstab = pd.crosstab(
        data["smoking_history"], data["diabetes"], normalize="index"
    ).reindex(smoking_counts.index).reindex(columns=[0, 1], fill_value=0)

    pair_columns = [
        "age",
        "hypertension",
        "heart_disease",
        "bmi",
        "HbA1c_level",
        "blood_glucose_level",
    ]
    pair_sample = data.sample(n=min(320, len(data)), random_state=7)

    return {
        "summary": {
            "records": int(len(data)),
            "diabetes": int(counts[1]),
            "diabetesRate": round(float(counts[1] / len(data) * 100), 1),
            "duplicates": int(data.duplicated().sum()),
            "hypertension": int(data["hypertension"].sum()),
            "heartDisease": int(data["heart_disease"].sum()),
            "averageAge": round(float(data["age"].mean()), 1),
            "averageBmi": round(float(data["bmi"].mean()), 1),
            "modelScopeRecords": int(len(known_smoking_data)),
            "modelScopeDiabetes": int(model_target_counts[1]),
            "diabetesWithHeartDisease": int(
                ((known_smoking_data["diabetes"] == 1) & (known_smoking_data["heart_disease"] == 1)).sum()
            ),
            "diabetesByGender": {key: int(diabetes_by_gender.get(key, 0)) for key in ("Female", "Male")},
            "heartDiseaseByGender": {key: int(heart_by_gender.get(key, 0)) for key in ("Female", "Male")},
            "hypertensionByGender": {key: int(hypertension_by_gender.get(key, 0)) for key in ("Female", "Male")},
            "modelMetrics": {
                "accuracy": 89.81,
                "precision": 52.02,
                "recall": 92.41,
                "f1": 66.56,
                "rocAuc": 97.70,
                "prAuc": 89.44,
            },
        },
        "targetCounts": [int(counts[0]), int(counts[1])],
        "smokingCounts": {
            "labels": smoking_counts.index.tolist(),
            "values": smoking_counts.astype(int).tolist(),
        },
        "smokingDiabetes": {
            "labels": smoking_crosstab.index.tolist(),
            "noDiabetes": smoking_crosstab[0].round(4).tolist(),
            "diabetes": smoking_crosstab[1].round(4).tolist(),
        },
        "distributions": distributions,
        "groupedValues": grouped_values,
        "correlation": {
            "labels": data.select_dtypes(include="number").columns.tolist(),
            "values": data.select_dtypes(include="number")
            .corr()
            .round(2)
            .values.tolist(),
        },
        "scatter": {
            "bmiAge": {
                "x": sample["bmi"].round(2).tolist(),
                "y": sample["age"].round(2).tolist(),
                "target": sample["diabetes"].astype(int).tolist(),
            },
            "glucoseHba1c": {
                "x": sample["blood_glucose_level"].round(2).tolist(),
                "y": sample["HbA1c_level"].round(2).tolist(),
                "target": sample["diabetes"].astype(int).tolist(),
            },
            "ageGlucose": {
                "x": sample["age"].round(2).tolist(),
                "y": sample["blood_glucose_level"].round(2).tolist(),
                "target": sample["diabetes"].astype(int).tolist(),
            },
        },
        "pairPlot": {
            "dimensions": [
                {
                    "label": column.replace("_", " "),
                    "values": pair_sample[column].round(2).tolist(),
                }
                for column in pair_columns
            ],
            "target": pair_sample["diabetes"].astype(int).tolist(),
        },
    }


DASHBOARD_DATA = build_dashboard_data()


@app.get("/")
def home():
    return render_template(
        "index.html",
        model_ready=model is not None,
        model_message=model_error,
    )


@app.get("/api/eda")
def eda_data():
    return jsonify(DASHBOARD_DATA)


def parse_prediction_input(payload):
    if not isinstance(payload, dict):
        raise ValueError("Please submit the form as a JSON object.")

    missing = [column for column in FEATURE_COLUMNS if column not in payload]
    if missing:
        raise ValueError(f"Please complete all fields: {', '.join(missing)}.")

    gender = payload["gender"]
    if not isinstance(gender, str):
        raise ValueError("Choose a valid gender option.")
    if gender not in {"Female", "Male", "Other"}:
        raise ValueError("Choose a valid gender option.")

    smoking_history = payload["smoking_history"]
    if not isinstance(smoking_history, str):
        raise ValueError("Choose a smoking history represented in the model's training data.")
    if smoking_history not in SMOKING_VALUES:
        raise ValueError(
            "Choose a smoking history represented in the model's training data."
        )

    result = {"gender": gender, "smoking_history": smoking_history}
    for field in ("hypertension", "heart_disease"):
        value = payload[field]
        if value not in (0, 1, False, True):
            raise ValueError(f"{field.replace('_', ' ').title()} must be Yes or No.")
        result[field] = int(value)

    for field, (minimum, maximum) in NUMERIC_RANGES.items():
        value = payload[field]
        if isinstance(value, bool):
            raise ValueError(f"{field.replace('_', ' ')} must be a number.")
        try:
            number = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field.replace('_', ' ')} must be a number.") from exc
        if not np.isfinite(number) or not minimum <= number <= maximum:
            raise ValueError(
                f"{field.replace('_', ' ')} must be between {minimum:g} and {maximum:g}."
            )
        result[field] = number

    if result["bmi"] < 16:
        result["bmi"] = BMI_BOUNDS[0]
    elif result["bmi"] > 40:
        result["bmi"] = BMI_BOUNDS[1]
    if result["blood_glucose_level"] > 250:
        result["blood_glucose_level"] = GLUCOSE_BOUNDS[1]
    if result["HbA1c_level"] > 8.2:
        result["HbA1c_level"] = HBA1C_BOUNDS[1]

    return pd.DataFrame([result], columns=FEATURE_COLUMNS)


@app.post("/api/predict")
def predict():
    if model is None:
        return jsonify({"error": model_error or "The prediction model is unavailable."}), 503

    try:
        row = parse_prediction_input(request.get_json())
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        prediction = int(model.predict(row)[0])
        probabilities = model.predict_proba(row)[0]
    except (AttributeError, ImportError, ValueError) as exc:
        return jsonify(
            {
                "error": (
                    "The saved model could not make a prediction with the active "
                    f"dependencies: {exc}"
                )
            }
        ), 503

    classes = list(model.classes_)
    positive_index = classes.index(1)
    probability = float(probabilities[positive_index])
    return jsonify(
        {
            "prediction": prediction,
            "probability": round(probability, 4),
            "model": "CatBoost",
            "message": (
                "The model flagged this profile for follow-up."
                if prediction == 1
                else "The model did not flag this profile in this screening."
            ),
        }
    )


if __name__ == "__main__":
    app.run(debug=False)
