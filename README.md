# GlucoGuide

A responsive diabetes education and prediction dashboard built from the supplied notebook, dataset, and saved CatBoost pipeline.

## Run locally

The saved model was serialized with scikit-learn 1.7.2. Use Python 3.12 for the most compatible setup.
Open a PowerShell terminal in the project folder before running these commands:

```powershell
py -3.12 -m venv ".venv"
& ".\.venv\Scripts\python.exe" -m pip install -r ".\requirements.txt"
& ".\.venv\Scripts\python.exe" ".\app.py"
```

Then open <http://127.0.0.1:5000>.

The app reads `diabetes_prediction_dataset.xls` as CSV because that is the format of the supplied file. Keep the dataset and `best_fraud_pipeline.pkl` beside `app.py`. The model filename is retained as supplied; the notebook and pipeline identify it as the diabetes CatBoost model.

The interactive charts load Plotly.js from its CDN, so an internet connection is needed to render charts. Prediction applies the notebook’s “No Info” exclusion and BMI, glucose, and HbA1c outlier-handling rules before calling the saved pipeline.

## About the dashboard

- **Your health:** general prevention and care information; not individual medical advice.
- **Data insights:** interactive views of the notebook’s distributions, outlier checks, categorical counts, scatter plots, violin plots, correlation heatmap, pairplot, and model metrics.
- **Risk screening:** runs the supplied model on the entered profile. The notebook excludes records with smoking history marked “No Info” before training, so that value is not offered in the form.

The full dataset contains 100,000 rows. The model was evaluated on a held-out test set after excluding “No Info” smoking-history records; its reported metrics are shown with that scope. The prediction is an educational model estimate, not a diagnosis, screening test, or treatment recommendation. Do not use it to make medical decisions.

The EDA charts use the full dataset for aggregate counts and distributions. Scatter, box, violin, and pairplot views use samples for browser performance.
