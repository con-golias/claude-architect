# MLOps & ML Lifecycle Management

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > ML in Production |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Model Serving](model-serving.md), [ML Monitoring](monitoring.md), [Feature Stores](feature-stores.md) |

---

## MLOps Maturity Levels

| Level | Name | Characteristics |
|-------|------|----------------|
| 0 | Manual | Jupyter notebooks, manual deployment, no pipeline |
| 1 | ML Pipeline Automation | Automated training, continuous training triggers |
| 2 | CI/CD for ML | Automated testing, building, deployment of pipelines |

**Target Level 1 first.** Most organizations get more value from automating training pipelines than from full CI/CD. Level 2 requires significant investment in testing infrastructure.

---

## ML Lifecycle

```
Data ──> Experiment ──> Train ──> Evaluate ──> Deploy
 ^                                               │
 │              Monitor <─────────────────────────┘
 │                │
 └────── Retrain <┘
```

| Stage | Activities | Tools |
|-------|-----------|-------|
| Data | Collect, clean, validate, version | DVC, Great Expectations, dbt |
| Experiment | Feature engineering, model selection, hyperparam tuning | Notebooks, Optuna, Ray Tune |
| Train | Distributed training, GPU allocation | PyTorch, TensorFlow, Ray Train |
| Evaluate | Metrics, bias testing, comparison to baseline | MLflow, Evidently, custom |
| Deploy | Package, serve, canary release | Docker, Kubernetes, Triton |
| Monitor | Drift, performance, data quality | Evidently, Arize, Prometheus |
| Retrain | Trigger retraining on schedule or drift detection | Airflow, Kubeflow, Prefect |

---

## Experiment Tracking

### Tool Comparison

| Tool | Type | Strengths |
|------|------|-----------|
| MLflow | Open-source | Full lifecycle, model registry, broad adoption |
| Weights & Biases (W&B) | SaaS + self-host | Best visualizations, team collaboration |
| Neptune | SaaS | Clean UI, metadata flexibility |
| DVC + Studio | Open-source + SaaS | Git-native, data versioning built-in |

### MLflow Example

```python
import mlflow
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score

mlflow.set_tracking_uri("http://mlflow-server:5000")
mlflow.set_experiment("fraud-detection")

with mlflow.start_run(run_name="rf-baseline-v2") as run:
    params = {"n_estimators": 200, "max_depth": 10, "min_samples_split": 5}
    mlflow.log_params(params)

    model = RandomForestClassifier(**params)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    mlflow.log_metrics({
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred),
    })

    from mlflow.models import infer_signature
    signature = infer_signature(X_test, y_pred)
    mlflow.sklearn.log_model(model, "model", signature=signature)
```

---

## Model Registry

A model registry manages model versions and their lifecycle stages.

```python
# MLflow Model Registry workflow
client = mlflow.tracking.MlflowClient()

# Register from experiment run
mv = mlflow.register_model(f"runs:/{run_id}/model", "fraud-detector")

# Promote through stages
client.set_registered_model_alias("fraud-detector", "staging", mv.version)
# After validation passes:
client.set_registered_model_alias("fraud-detector", "production", mv.version)

# Load production model
model = mlflow.pyfunc.load_model("models:/fraud-detector@production")
```

### Model Approval Workflow

1. Data Scientist trains model and registers in registry
2. ML Engineer reviews metrics, runs evaluation suite and bias checks
3. Approved model is promoted to production with canary deployment
4. Monitoring confirms performance before full traffic rollover

---

## ML Pipelines

| Framework | Best For | Execution |
|-----------|----------|-----------|
| Kubeflow Pipelines | Kubernetes-native ML | K8s pods per step |
| Apache Airflow | General workflow orchestration | Workers/executors |
| Prefect | Python-native workflows | Dynamic task graphs |
| ZenML | ML-specific orchestration | Pluggable stack components |
| Metaflow (Netflix) | Data science pipelines | AWS Step Functions / K8s |

```python
# ZenML pipeline example
from zenml import pipeline, step

@step
def load_data() -> pd.DataFrame:
    return pd.read_parquet("s3://data/transactions.parquet")

@step
def train_model(X: np.ndarray, y: np.ndarray) -> ClassifierMixin:
    model = RandomForestClassifier(n_estimators=200)
    model.fit(X, y)
    return model

@step
def evaluate(model: ClassifierMixin, X: np.ndarray, y: np.ndarray) -> float:
    score = model.score(X, y)
    if score < 0.95:
        raise ValueError(f"Accuracy {score} below threshold")
    return score

@pipeline
def training_pipeline():
    df = load_data()
    X, y = preprocess(df)
    model = train_model(X, y)
    evaluate(model, X, y)
```

---

## Data Versioning

Model reproducibility requires versioned code AND versioned data. Same code + different data = different model.

| Tool | Approach | Best For |
|------|----------|----------|
| DVC | Git-like for data | Files and directories |
| Delta Lake | ACID table format | Tabular data at scale |
| lakeFS | Git for data lakes | Data lake branching |

```bash
# DVC workflow
dvc init && dvc remote add -d myremote s3://my-bucket/dvc-store
dvc add data/training_data.parquet
git add data/training_data.parquet.dvc data/.gitignore
git commit -m "Add training data v1" && dvc push

# Reproduce exact training data from any commit
git checkout v1.0.0 && dvc checkout
```

---

## CI/CD for ML

| Traditional CI/CD | ML CI/CD Additions |
|-------------------|-------------------|
| Lint, test, build code | Validate data schema and quality |
| Unit tests | Model performance tests (accuracy gates) |
| Integration tests | Training pipeline integration tests |
| Deploy application | Deploy model + serving infrastructure |
| Monitor uptime | Monitor drift and model performance |

```yaml
# GitHub Actions CI/CD for ML
name: ML Pipeline
on:
  push:
    paths: ["models/**", "features/**", "pipelines/**"]
  schedule:
    - cron: "0 6 * * *"  # Daily retraining

jobs:
  data-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python scripts/validate_data.py
      - run: python scripts/data_quality_checks.py

  train:
    needs: data-validation
    runs-on: [self-hosted, gpu]
    steps:
      - uses: actions/checkout@v4
      - run: dvc pull
      - run: python pipelines/train.py --config configs/production.yaml
      - run: python pipelines/evaluate.py --min-f1 0.95 --min-precision 0.90

  deploy:
    needs: train
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: python scripts/promote_model.py --stage staging
      - run: pytest tests/integration/ -v
      - run: python scripts/deploy_canary.py --traffic-pct 10
```

### Evaluation Gates

```python
def evaluation_gate(candidate: dict, baseline: dict, thresholds: dict) -> bool:
    """Return True if candidate model passes all gates."""
    checks = [
        candidate["f1"] >= thresholds["min_f1"],
        candidate["precision"] >= thresholds["min_precision"],
        candidate["f1"] >= baseline["f1"] - thresholds["max_f1_regression"],
    ]
    # Bias checks across protected groups
    for group in thresholds["protected_groups"]:
        checks.append(abs(candidate[f"f1_{group}"] - candidate["f1"]) < thresholds["max_fairness_gap"])
    return all(checks)
```

---

## Model Governance

### Model Cards

Document every production model with standardized metadata: intended use, training data, performance by segment, bias evaluation, and known limitations.

```yaml
# model_card.yaml
model_name: fraud-detector
version: "3.2.1"
owner: ml-platform-team
intended_use: "Real-time fraud scoring for payment transactions"
performance:
  overall: { precision: 0.94, recall: 0.87, f1: 0.90 }
bias_evaluation:
  protected_attributes: ["country", "age_group"]
  fairness_metric: "equalized_odds"
  max_disparity: 0.05
limitations:
  - "Lower recall for new merchant categories not in training data"
```

### Explainability

Use SHAP or LIME to provide per-prediction explanations for auditing and debugging. Log feature contributions alongside predictions for high-stakes models.

---

## LLMOps vs Traditional MLOps

| Dimension | Traditional MLOps | LLMOps |
|-----------|------------------|--------|
| Training | Custom training on your data | Fine-tuning or prompt engineering |
| Versioning | Model weights + code | Prompts + model version + config |
| Evaluation | Standard metrics (F1, AUC) | LLM-as-judge, human eval, rubrics |
| Cost model | Compute for training | Per-token API costs |
| Monitoring | Accuracy, drift | Hallucination, toxicity, cost |

### LLMOps-Specific Practices

```python
# Prompt versioning
@dataclass
class PromptVersion:
    name: str
    version: str
    template: str
    model: str
    temperature: float
    eval_score: float | None = None

# LLM evaluation pipeline
def evaluate_prompt(prompt: PromptVersion, eval_dataset: list[dict]) -> dict:
    scores = []
    for sample in eval_dataset:
        response = generate(prompt, sample["input"])
        score = llm_judge(response=response, reference=sample["expected"],
                          criteria=["accuracy", "completeness", "conciseness"])
        scores.append(score)
    return {"mean_score": np.mean(scores), "pass_rate": np.mean([s > 0.7 for s in scores])}
```

---

## Infrastructure

| Strategy | When to Use | Cost |
|----------|-------------|------|
| On-demand GPU instances | Unpredictable training needs | High per-hour |
| Reserved instances | Steady training workload | 40-60% discount |
| Spot/preemptible | Fault-tolerant training with checkpointing | 60-90% discount |

Checkpoint training runs frequently. GPU failures and spot preemptions are common -- resume from checkpoints rather than restart.

---

## 10 Best Practices

1. **Automate the training pipeline before optimizing the model.** A reproducible pipeline delivers more long-term value than a marginally better model trained manually.
2. **Version everything: code, data, models, configs, and prompts.** Reproducibility requires all artifacts to be versioned and linked together.
3. **Implement evaluation gates before automated deployment.** Never auto-deploy a model without passing accuracy thresholds, bias checks, and regression tests.
4. **Use a model registry as the single source of truth.** All production models must be registered with metadata, metrics, and lineage.
5. **Start at MLOps Level 1 before targeting Level 2.** Automated training pipelines with manual deployment is a practical intermediate step.
6. **Separate training and serving infrastructure.** Training needs burst GPU capacity. Serving needs consistent low-latency. Different scaling profiles.
7. **Checkpoint training runs frequently.** GPU failures and spot instance preemptions are common. Resume from checkpoints, do not restart.
8. **Create model cards for every production model.** Document intended use, limitations, bias evaluation, and performance by segment.
9. **Treat prompt versions like model versions in LLMOps.** Version, evaluate, A/B test, and roll back prompts with the same rigor as model weights.
10. **Budget for ML infrastructure as a recurring cost.** Training, serving, monitoring, and storage costs compound. Track and optimize continuously.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Notebook-to-production | No reproducibility, no testing, no versioning | Convert to pipeline with proper engineering |
| Training without data validation | Model trained on corrupted data | Add data quality checks before training |
| No evaluation baseline | Cannot tell if new model is better | Always compare against current production model |
| Manual model deployment | Slow, error-prone, no audit trail | Automate deployment pipeline with approval gates |
| Ignoring training cost | GPU bills spiral without visibility | Track cost per experiment, use spot instances |
| One model, no fallback | Single point of failure in production | Maintain previous version as instant rollback |
| Skipping bias testing | Unfair model deployed, regulatory risk | Include fairness checks in evaluation gates |
| Treating LLMs like traditional ML | Wrong eval methods, no prompt management | Adopt LLMOps: prompt versioning, LLM-as-judge |

---

## Enforcement Checklist

- [ ] Training pipeline is automated and triggered by schedule or data changes
- [ ] Experiment tracking captures parameters, metrics, and artifacts for every run
- [ ] Model registry holds all production models with version, metrics, and lineage
- [ ] Data versioning is in place (DVC, Delta Lake, or equivalent)
- [ ] Evaluation gates block deployment when quality thresholds are not met
- [ ] Model cards document intended use, limitations, and bias evaluation
- [ ] CI/CD pipeline includes data validation, training, evaluation, and deployment
- [ ] GPU costs are tracked per experiment and per model
- [ ] Rollback procedure is tested and documented for every production model
- [ ] LLM prompts are versioned and evaluated with structured eval pipelines
