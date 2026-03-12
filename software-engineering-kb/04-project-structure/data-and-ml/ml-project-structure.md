# ML Project Structure

> **AI Plugin Directive:** When structuring a machine learning project, ALWAYS use this guide. Apply experiment tracking, reproducible pipelines, model registry, and proper separation of research notebooks from production code. This guide covers ML projects from research to production deployment.

**Core Rule: Separate EXPERIMENTATION code from PRODUCTION code. Use experiment tracking (MLflow/W&B) from day one. Make pipelines reproducible with versioned data, code, and parameters. NEVER deploy Jupyter notebooks to production — extract tested, typed code into proper modules.**

---

## 1. ML Project Structure

```
ml-project/
├── src/                                   # Production-grade code
│   └── ml_project/
│       ├── __init__.py
│       ├── data/                          # Data loading and processing
│       │   ├── __init__.py
│       │   ├── dataset.py                 # Dataset classes
│       │   ├── preprocessing.py           # Feature engineering
│       │   ├── validation.py              # Data validation
│       │   └── splits.py                  # Train/val/test splitting
│       ├── features/                      # Feature store / engineering
│       │   ├── __init__.py
│       │   ├── numerical.py
│       │   ├── categorical.py
│       │   └── pipeline.py                # sklearn Pipeline or custom
│       ├── models/                        # Model definitions
│       │   ├── __init__.py
│       │   ├── base.py                    # Abstract model interface
│       │   ├── xgboost_model.py
│       │   ├── neural_net.py
│       │   └── ensemble.py
│       ├── training/                      # Training logic
│       │   ├── __init__.py
│       │   ├── trainer.py                 # Training loop
│       │   ├── callbacks.py               # Early stopping, checkpointing
│       │   ├── metrics.py                 # Custom metrics
│       │   └── hyperparams.py             # Hyperparameter definitions
│       ├── evaluation/                    # Model evaluation
│       │   ├── __init__.py
│       │   ├── evaluator.py
│       │   ├── plots.py                   # Confusion matrix, ROC, etc.
│       │   └── reports.py                 # Generate evaluation reports
│       ├── serving/                       # Model serving / inference
│       │   ├── __init__.py
│       │   ├── predictor.py               # Prediction service
│       │   ├── schemas.py                 # Request/response schemas
│       │   └── app.py                     # FastAPI serving app
│       ├── pipelines/                     # End-to-end pipelines
│       │   ├── __init__.py
│       │   ├── training_pipeline.py
│       │   ├── inference_pipeline.py
│       │   └── data_pipeline.py
│       └── config.py                      # Configuration management
│
├── notebooks/                             # Exploration ONLY
│   ├── 01_eda.ipynb                       # Exploratory data analysis
│   ├── 02_feature_engineering.ipynb
│   ├── 03_model_comparison.ipynb
│   └── README.md                          # Explain notebook purpose
│
├── experiments/                           # Experiment configs
│   ├── baseline.yaml
│   ├── xgboost_v2.yaml
│   └── neural_net_v1.yaml
│
├── data/                                  # Local data (gitignored)
│   ├── raw/                               # Original, immutable data
│   ├── processed/                         # Cleaned, feature-engineered
│   ├── interim/                           # Intermediate transformations
│   └── external/                          # Third-party data sources
│
├── models/                                # Saved model artifacts (gitignored)
│   └── .gitkeep
│
├── tests/
│   ├── test_data/
│   │   └── test_preprocessing.py
│   ├── test_models/
│   │   └── test_xgboost_model.py
│   ├── test_serving/
│   │   └── test_predictor.py
│   └── conftest.py
│
├── scripts/                               # CLI scripts
│   ├── train.py                           # python scripts/train.py --config experiments/baseline.yaml
│   ├── evaluate.py
│   ├── serve.py
│   └── download_data.py
│
├── docker/
│   ├── Dockerfile.training                # GPU-enabled training image
│   └── Dockerfile.serving                 # Lightweight serving image
│
├── pyproject.toml
├── Makefile
├── README.md
├── CHANGELOG.md
└── .gitignore
```

---

## 2. Configuration Management

```yaml
# experiments/baseline.yaml
experiment:
  name: churn-prediction-baseline
  tags:
    project: customer-churn
    team: data-science

data:
  source: s3://my-bucket/data/customers.parquet
  target_column: churned
  test_size: 0.2
  random_state: 42

features:
  numerical:
    - tenure_months
    - monthly_charges
    - total_charges
  categorical:
    - contract_type
    - payment_method
    - internet_service
  preprocessing:
    numerical_strategy: standard_scaler
    categorical_strategy: one_hot

model:
  type: xgboost
  params:
    n_estimators: 500
    max_depth: 6
    learning_rate: 0.1
    subsample: 0.8
    colsample_bytree: 0.8
    early_stopping_rounds: 50

training:
  cv_folds: 5
  metric: f1_score
  direction: maximize

mlflow:
  tracking_uri: http://mlflow.internal:5000
  experiment_name: customer-churn
```

```python
# src/ml_project/config.py

from pydantic import BaseModel
from pathlib import Path
import yaml

class DataConfig(BaseModel):
    source: str
    target_column: str
    test_size: float = 0.2
    random_state: int = 42

class ModelConfig(BaseModel):
    type: str
    params: dict

class TrainingConfig(BaseModel):
    cv_folds: int = 5
    metric: str = "f1_score"
    direction: str = "maximize"

class ExperimentConfig(BaseModel):
    experiment: dict
    data: DataConfig
    model: ModelConfig
    training: TrainingConfig

    @classmethod
    def from_yaml(cls, path: str | Path) -> "ExperimentConfig":
        with open(path) as f:
            return cls(**yaml.safe_load(f))
```

---

## 3. Training Script

```python
# scripts/train.py

import argparse
import mlflow
from ml_project.config import ExperimentConfig
from ml_project.data.dataset import load_dataset
from ml_project.data.splits import train_test_split
from ml_project.features.pipeline import build_feature_pipeline
from ml_project.models import get_model
from ml_project.training.trainer import Trainer
from ml_project.evaluation.evaluator import evaluate_model

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Path to experiment config")
    args = parser.parse_args()

    config = ExperimentConfig.from_yaml(args.config)

    mlflow.set_tracking_uri(config.mlflow["tracking_uri"])
    mlflow.set_experiment(config.mlflow["experiment_name"])

    with mlflow.start_run(run_name=config.experiment["name"]):
        # Log configuration
        mlflow.log_params(config.model.params)
        mlflow.set_tags(config.experiment.get("tags", {}))

        # Data
        df = load_dataset(config.data.source)
        X_train, X_test, y_train, y_test = train_test_split(
            df, config.data.target_column, config.data.test_size
        )

        # Features
        pipeline = build_feature_pipeline(config.features)
        X_train = pipeline.fit_transform(X_train)
        X_test = pipeline.transform(X_test)

        # Train
        model = get_model(config.model.type, config.model.params)
        trainer = Trainer(model, config.training)
        trainer.fit(X_train, y_train)

        # Evaluate
        metrics = evaluate_model(trainer.model, X_test, y_test)
        mlflow.log_metrics(metrics)

        # Save
        mlflow.sklearn.log_model(trainer.model, "model")
        mlflow.log_artifact(args.config, "config")

        print(f"Run ID: {mlflow.active_run().info.run_id}")
        print(f"Metrics: {metrics}")

if __name__ == "__main__":
    main()
```

---

## 4. Model Serving

```python
# src/ml_project/serving/app.py

from fastapi import FastAPI
from pydantic import BaseModel
import mlflow

app = FastAPI(title="Churn Prediction API")

class PredictionRequest(BaseModel):
    tenure_months: float
    monthly_charges: float
    total_charges: float
    contract_type: str
    payment_method: str
    internet_service: str

class PredictionResponse(BaseModel):
    prediction: int
    probability: float
    model_version: str

# Load model on startup
model = None
model_version = ""

@app.on_event("startup")
async def load_model():
    global model, model_version
    model_uri = "models:/customer-churn/Production"
    model = mlflow.pyfunc.load_model(model_uri)
    model_version = model.metadata.run_id

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    features = request.model_dump()
    prediction = model.predict([features])
    probability = model.predict_proba([features])[0][1]

    return PredictionResponse(
        prediction=int(prediction[0]),
        probability=float(probability),
        model_version=model_version,
    )

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model is not None}
```

---

## 5. Experiment Tracking

```
MLflow experiment tracking structure:

Experiment: customer-churn
├── Run: baseline-xgboost (run_id: abc123)
│   ├── Parameters: n_estimators=500, max_depth=6, lr=0.1
│   ├── Metrics: f1=0.82, precision=0.85, recall=0.79, auc=0.91
│   ├── Artifacts:
│   │   ├── model/ (serialized model)
│   │   ├── config/baseline.yaml
│   │   ├── confusion_matrix.png
│   │   └── feature_importance.png
│   └── Tags: team=data-science, version=v1
│
├── Run: xgboost-tuned (run_id: def456)
│   ├── Parameters: n_estimators=1000, max_depth=8, lr=0.05
│   ├── Metrics: f1=0.86, precision=0.88, recall=0.84, auc=0.93
│   └── ...
│
└── Run: neural-net-v1 (run_id: ghi789)
    ├── Parameters: layers=[128,64,32], dropout=0.3
    ├── Metrics: f1=0.84, precision=0.86, recall=0.82, auc=0.92
    └── ...

Model Registry:
  customer-churn
  ├── Version 1 (run: abc123) — Archived
  ├── Version 2 (run: def456) — Production ✅
  └── Version 3 (run: ghi789) — Staging
```

---

## 6. Notebook Rules

```
Notebooks are for EXPLORATION, not production.

✅ Use notebooks for:
  - Exploratory data analysis (EDA)
  - Visualization and prototyping
  - Quick hypothesis testing
  - Stakeholder presentations

❌ NEVER use notebooks for:
  - Production training pipelines
  - Scheduled jobs or cron tasks
  - Model serving
  - Data validation in production

Notebook conventions:
  - Number sequentially: 01_eda, 02_features, 03_modeling
  - Clear markdown headers explaining purpose
  - Run top-to-bottom without errors
  - Pin dependencies in notebook header
  - Extract validated code to src/ modules
  - Clear all outputs before committing

Migration path:
  Notebook prototype → Extract to src/ → Write tests → Deploy
```

---

## 7. Makefile

```makefile
.PHONY: train evaluate serve test lint

# ─── Data ─────────────────────────────────────────────────
data:
	python scripts/download_data.py

# ─── Training ─────────────────────────────────────────────
train:
	python scripts/train.py --config experiments/$(CONFIG).yaml

train-baseline:
	python scripts/train.py --config experiments/baseline.yaml

# ─── Evaluation ───────────────────────────────────────────
evaluate:
	python scripts/evaluate.py --run-id $(RUN_ID)

# ─── Serving ──────────────────────────────────────────────
serve:
	uvicorn src.ml_project.serving.app:app --host 0.0.0.0 --port 8000

serve-docker:
	docker build -f docker/Dockerfile.serving -t ml-serving .
	docker run -p 8000:8000 ml-serving

# ─── Quality ──────────────────────────────────────────────
test:
	pytest tests/ -v --cov=src/ml_project

lint:
	ruff check src/ scripts/
	mypy src/

# ─── Notebooks ────────────────────────────────────────────
notebooks-clean:
	jupyter nbconvert --clear-output notebooks/*.ipynb
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Notebooks in production | Unreliable, untestable pipelines | Extract to modules, deploy proper code |
| No experiment tracking | Can't reproduce results | MLflow/W&B from day one |
| Data in Git repo | Huge repo, versioning issues | DVC, S3, or data lake |
| No config files | Hardcoded hyperparameters | YAML configs per experiment |
| Training and serving coupled | Model update requires redeploy | Model registry + separate serving |
| No data validation | Model trains on corrupt data | Great Expectations or Pandera |
| No test/val split | Overfitting, unreliable metrics | Fixed splits with random_state |
| Global state in modules | Tests interfere with each other | Dependency injection, pure functions |
| No model versioning | Can't rollback bad models | MLflow Model Registry |
| Pickle files shared via Slack | No reproducibility | Artifact store (MLflow, S3) |

---

## 9. Enforcement Checklist

- [ ] src/ layout — production code separated from notebooks
- [ ] Experiment configs — YAML files per experiment, versioned in Git
- [ ] Experiment tracking — MLflow or W&B, logged from day one
- [ ] Model registry — versioned models with staging/production stages
- [ ] Data versioning — DVC or artifact store, NOT Git
- [ ] Feature pipeline — reproducible, tested transformations
- [ ] Training script — CLI entry point, config-driven
- [ ] Serving API — FastAPI with Pydantic schemas, health check
- [ ] Tests for data, features, models, and serving
- [ ] Notebooks numbered and cleared — exploration only
- [ ] Makefile — standard commands: train, evaluate, serve, test
- [ ] Docker images — separate training (GPU) and serving (lightweight)
- [ ] Data validation — schema and quality checks before training
