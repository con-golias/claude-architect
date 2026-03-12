# ML Model Monitoring

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > ML in Production |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Model Serving](model-serving.md), [Monitoring & Observability](../../12-devops-infrastructure/monitoring-observability/) |

---

## Why ML Monitoring is Different

Traditional software fails loudly -- exceptions, crashes, HTTP 500s. ML models fail silently. A model can return HTTP 200 with valid JSON while producing completely wrong predictions. Model degradation is gradual and invisible without dedicated monitoring.

### Unique Challenges

| Challenge | Description |
|-----------|-------------|
| Silent failures | Model accuracy decays without errors |
| Ground truth delay | Labels arrive hours, days, or never |
| Data distribution shift | Real-world data drifts from training data |
| Feedback loops | Model predictions influence future data |
| Non-stationarity | Relationships between features and targets change |

---

## Data Drift Detection

### Types of Drift

```
Training Data Distribution
         |
         v
[Feature Drift]     Input data distribution changes (e.g., new user demographics)
[Concept Drift]     Relationship between features and target changes (e.g., fraud patterns evolve)
[Prediction Drift]  Model output distribution shifts (symptom of feature or concept drift)
[Label Drift]       Ground truth distribution changes (e.g., different class balance)
```

### Statistical Tests for Drift

| Test | Data Type | What It Detects |
|------|-----------|----------------|
| Kolmogorov-Smirnov (KS) | Continuous | Distribution shape differences |
| Population Stability Index (PSI) | Continuous/categorical | Overall distribution shift |
| Chi-Squared | Categorical | Category frequency changes |
| Jensen-Shannon Divergence | Any distribution | Symmetric divergence measure |
| Wasserstein Distance | Continuous | "Earth mover's" distance between distributions |

```python
# Drift detection with Evidently AI
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset, TargetDriftPreset

report = Report(metrics=[
    DataDriftPreset(stattest="ks", stattest_threshold=0.05),
    TargetDriftPreset(),
])
report.run(reference_data=training_df, current_data=production_df)
report.save_html("drift_report.html")

# Extract drift results programmatically
drift_results = report.as_dict()
n_drifted = drift_results["metrics"][0]["result"]["number_of_drifted_columns"]
drift_share = drift_results["metrics"][0]["result"]["share_of_drifted_columns"]
if drift_share > 0.3:
    trigger_alert("High feature drift detected", drift_share)
```

```python
# Manual PSI calculation
import numpy as np

def calculate_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """Population Stability Index: <0.1 stable, 0.1-0.2 moderate, >0.2 significant."""
    breakpoints = np.quantile(expected, np.linspace(0, 1, bins + 1))
    expected_pct = np.histogram(expected, breakpoints)[0] / len(expected)
    actual_pct = np.histogram(actual, breakpoints)[0] / len(actual)
    expected_pct = np.clip(expected_pct, 1e-4, None)
    actual_pct = np.clip(actual_pct, 1e-4, None)
    return np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
```

---

## Model Performance Monitoring

### Key Metrics to Track

| Metric Type | Examples | Frequency |
|-------------|----------|-----------|
| Accuracy metrics | Precision, recall, F1, AUC-ROC | When ground truth available |
| Prediction distribution | Mean, variance, percentiles of outputs | Every batch / hourly |
| Latency | p50, p95, p99 inference time | Real-time |
| Throughput | Requests/second, tokens/second | Real-time |
| Error rate | 4xx/5xx, timeout rate, malformed input rate | Real-time |
| Resource utilization | GPU memory, GPU compute, CPU, RAM | Real-time |

```python
# Prometheus metrics for model monitoring
from prometheus_client import Histogram, Counter, Gauge

prediction_latency = Histogram(
    "model_prediction_latency_seconds",
    "Time to generate prediction",
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)
prediction_value = Histogram(
    "model_prediction_value",
    "Distribution of prediction outputs",
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)
prediction_count = Counter("model_predictions_total", "Total predictions", ["model_version"])
model_accuracy = Gauge("model_accuracy_rolling", "Rolling accuracy over last 1000 predictions")

@app.post("/predict")
async def predict(request: PredictRequest):
    with prediction_latency.time():
        result = model.predict(request.features)
    prediction_value.observe(result)
    prediction_count.labels(model_version="v2.3").inc()
    return {"prediction": result}
```

### Proxy Metrics (When Ground Truth Is Delayed)

When labels are unavailable, monitor proxy signals:

- **Prediction confidence distribution** -- Dropping confidence suggests out-of-distribution inputs
- **Feature value ranges** -- Out-of-range values indicate data pipeline issues
- **Prediction class balance** -- Sudden shifts suggest drift
- **User interaction rates** -- Click-through on recommendations, acceptance of suggestions

---

## Monitoring Tools

| Tool | Type | Strengths |
|------|------|-----------|
| Evidently AI | Open-source library | Drift reports, test suites, dashboards |
| Arize | SaaS platform | Auto-drift detection, embedding analysis |
| WhyLabs | SaaS platform | Data profiling, anomaly detection |
| NannyML | Open-source | Performance estimation without ground truth |
| Prometheus + Grafana | Infrastructure | Custom metrics, alerting, dashboards |
| Datadog ML Monitoring | SaaS platform | Integrated with APM, log correlation |

### Evidently Monitoring Pipeline

```python
# Automated monitoring pipeline with Evidently
from evidently.test_suite import TestSuite
from evidently.tests import (
    TestShareOfDriftedColumns,
    TestColumnDrift,
    TestMeanInNSigmas,
)

def run_monitoring_checks(reference_df, current_df):
    suite = TestSuite(tests=[
        TestShareOfDriftedColumns(lt=0.3),           # <30% features drifted
        TestColumnDrift("prediction", stattest="ks"), # Prediction drift check
        TestMeanInNSigmas("amount", n=3),             # Feature within 3 sigma
    ])
    suite.run(reference_data=reference_df, current_data=current_df)
    results = suite.as_dict()

    if not results["summary"]["all_passed"]:
        failed = [t for t in results["tests"] if t["status"] == "FAIL"]
        send_alert(f"Monitoring checks failed: {len(failed)} tests", failed)
    return results
```

---

## Alert Strategies

### Tiered Alerting

| Severity | Trigger | Action |
|----------|---------|--------|
| Info | PSI 0.1-0.2 for any feature | Log, update dashboard |
| Warning | PSI > 0.2, accuracy drop > 2% | Slack notification, create ticket |
| Critical | PSI > 0.5, accuracy drop > 5%, prediction distribution collapse | Page on-call, auto-rollback |

### Avoid Alert Fatigue

- Set thresholds based on historical variance, not arbitrary values
- Use windowed metrics (rolling 1-hour, 24-hour) to smooth noise
- Differentiate between transient spikes and sustained drift
- Group related alerts -- feature drift often triggers prediction drift

---

## LLM-Specific Monitoring

### Metrics for LLM Applications

| Metric | How to Measure |
|--------|----------------|
| Token usage | Track input/output tokens per request and cost |
| Latency (TTFT) | Time to first token for streaming responses |
| Latency (TPS) | Tokens per second throughput |
| Hallucination rate | LLM-as-judge, factual grounding checks |
| Response quality | Rubric-based scoring, user ratings |
| Safety violations | Classifier-based toxicity/bias detection |
| Refusal rate | Track "I can't help with that" responses |
| Context utilization | How much of context window is used |

```python
# LLM monitoring with custom metrics
import time
from dataclasses import dataclass

@dataclass
class LLMRequestMetrics:
    request_id: str
    model: str
    input_tokens: int
    output_tokens: int
    total_latency_ms: float
    time_to_first_token_ms: float
    cost_usd: float
    safety_score: float        # 0-1, from safety classifier
    quality_score: float | None # From LLM-as-judge evaluation

def log_llm_request(metrics: LLMRequestMetrics):
    prometheus_input_tokens.observe(metrics.input_tokens)
    prometheus_output_tokens.observe(metrics.output_tokens)
    prometheus_latency.observe(metrics.total_latency_ms / 1000)
    prometheus_cost.inc(metrics.cost_usd)
    if metrics.safety_score < 0.8:
        safety_violation_counter.inc()
        alert_safety_team(metrics)
```

### Hallucination Detection Approaches

- **LLM-as-judge** -- Use a second LLM to evaluate factual accuracy against source documents
- **Semantic similarity** -- Compare response embeddings to grounding documents
- **Citation verification** -- Check that cited sources actually support the claims
- **Consistency checking** -- Ask the same question multiple times and flag inconsistencies

---

## Feedback Loops

### User Feedback Collection

```typescript
// Implicit and explicit feedback collection
interface FeedbackEvent {
  predictionId: string;
  feedbackType: "explicit" | "implicit";
  signal: "positive" | "negative" | "correction";
  value?: string;         // User-provided correction
  timestamp: string;
  userId: string;
}

// Implicit signals for recommendation models
interface ImplicitFeedback {
  recommendationId: string;
  shown: boolean;
  clicked: boolean;
  dwellTimeMs: number;     // Time spent on recommended item
  converted: boolean;      // Completed desired action
  position: number;        // Position in list (for position bias correction)
}
```

### Active Learning Pipeline

Use model uncertainty to prioritize which samples need human labeling:

1. Score production data with model confidence
2. Route low-confidence predictions to human reviewers
3. Incorporate labeled samples into next training cycle
4. Track labeling cost vs accuracy improvement

---

## Incident Response for ML

### Model Rollback Strategy

```python
# Automated rollback on performance degradation
from model_registry import ModelRegistry

def check_and_rollback(current_metrics: dict, threshold: dict):
    registry = ModelRegistry()
    current = registry.get_production_model("fraud-detector")

    if current_metrics["precision"] < threshold["min_precision"]:
        previous = registry.get_model_version(
            "fraud-detector", current.version - 1
        )
        registry.promote_to_production("fraud-detector", previous.version)
        notify_team(
            f"Auto-rollback: {current.version} -> {previous.version}. "
            f"Precision dropped to {current_metrics['precision']:.3f}"
        )
        return True
    return False
```

### Fallback Strategies

| Strategy | When to Use |
|----------|-------------|
| Previous model version | Performance regression detected |
| Simpler model (heuristic) | All ML models failing |
| Default/cached predictions | Complete inference failure |
| Human-in-the-loop | High-stakes decisions with low confidence |

---

## Dashboard Design

### Model Health Dashboard Components

| Panel | Metrics | Visualization |
|-------|---------|---------------|
| Status overview | Model version, uptime, last retrain | Status indicators |
| Prediction volume | Requests/sec, daily volume | Time series |
| Latency | p50, p95, p99 | Histogram + time series |
| Accuracy (if available) | Precision, recall, F1 | Time series with threshold |
| Drift indicators | PSI per feature, prediction drift | Heatmap + time series |
| Data quality | Missing values, out-of-range, schema violations | Counters + time series |
| Resource usage | GPU util, memory, queue depth | Gauges + time series |

---

## 10 Best Practices

1. **Monitor data inputs, not just model outputs.** Feature drift is a leading indicator of performance degradation. Catch it before predictions suffer.
2. **Establish baselines during model validation.** Record metric distributions from validation data as the reference point for drift detection.
3. **Use proxy metrics when ground truth is delayed.** Prediction confidence, output distribution, and user interaction rates signal problems before labels arrive.
4. **Implement tiered alerting to prevent fatigue.** Not every drift is critical. Classify alerts by severity and route appropriately.
5. **Automate rollback for critical models.** Define automated rollback triggers for production models serving high-stakes decisions.
6. **Track LLM cost alongside quality.** Monitor token usage and cost per request. A quality improvement is not worth 10x cost increase.
7. **Log every prediction with its input features.** Enable retroactive analysis when problems are discovered. Store in columnar format for efficient querying.
8. **Run monitoring checks on a schedule, not just on-demand.** Automated hourly or daily drift reports catch slow degradation.
9. **Compare production data against training data, not just yesterday.** Gradual drift over weeks is invisible in day-over-day comparisons.
10. **Include business metrics alongside ML metrics.** Conversion rate, revenue impact, and user satisfaction are the ultimate measures of model health.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Monitoring only infrastructure metrics | Model degrades while CPU looks healthy | Add data drift and prediction quality metrics |
| Using training accuracy as production metric | Overfitting to stale data goes undetected | Track rolling production accuracy separately |
| Alerting on every feature drift | Alert fatigue, team ignores warnings | Use tiered alerts with impact-weighted thresholds |
| No prediction logging | Cannot debug issues retroactively | Log all predictions with features and metadata |
| Manual monitoring checks | Checks stop happening after initial excitement | Automate monitoring in CI/CD and scheduled jobs |
| Ignoring ground truth delay | Wait too long to detect accuracy drops | Use proxy metrics and feedback signals |
| Same thresholds for all models | Low-risk model alerts drown out critical ones | Set thresholds per model based on business impact |
| No rollback plan | Stuck with degraded model during investigation | Pre-configure automated and manual rollback |

---

## Enforcement Checklist

- [ ] Data drift detection is automated on a schedule (hourly or daily)
- [ ] Statistical test thresholds are calibrated from historical data
- [ ] Prediction logging captures inputs, outputs, model version, and latency
- [ ] Tiered alerting is configured (info/warning/critical)
- [ ] Automated rollback is configured for critical models
- [ ] Dashboard shows model health, drift, latency, and prediction volume
- [ ] LLM monitoring tracks token usage, cost, and safety violations
- [ ] Feedback collection is implemented (explicit and implicit signals)
- [ ] Ground truth labels are joined to predictions when available
- [ ] Monitoring coverage exists for every production model, not just new ones
