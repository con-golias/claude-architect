# Model Serving & Inference

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > ML in Production |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [MLOps](mlops.md), [ML Monitoring](monitoring.md) |

---

## Serving Architectures

### Online (Real-Time) Inference

Serve predictions synchronously via HTTP/gRPC with latency targets under 100ms.

```python
# FastAPI real-time inference endpoint
from fastapi import FastAPI
import torch

app = FastAPI()
model = torch.jit.load("model.pt")

@app.post("/predict")
async def predict(request: PredictRequest):
    tensor = preprocess(request.features)
    with torch.no_grad():
        output = model(tensor)
    return {"prediction": output.tolist(), "model_version": "v2.3.1"}
```

**Use when:** User-facing features need immediate results -- recommendations, fraud detection, search ranking.

### Batch Inference

Process large datasets offline on a schedule. Optimize for throughput over latency.

```python
# Batch inference with Spark
from pyspark.sql import SparkSession
import mlflow

spark = SparkSession.builder.getOrCreate()
model = mlflow.pyfunc.spark_udf(spark, "models:/fraud-detector/Production")
df = spark.read.parquet("s3://data/transactions/2026-03-10/")
predictions = df.withColumn("fraud_score", model("amount", "merchant", "location"))
predictions.write.parquet("s3://predictions/fraud/2026-03-10/")
```

**Use when:** Pre-computing recommendations, daily risk scores, report generation.

### Streaming Inference

Apply models to continuous data streams with sub-second latency.

```python
# Flink-style streaming inference
from kafka import KafkaConsumer, KafkaProducer
import json, torch

consumer = KafkaConsumer("events", bootstrap_servers="kafka:9092")
producer = KafkaProducer(bootstrap_servers="kafka:9092")
model = torch.jit.load("anomaly_detector.pt")

for message in consumer:
    event = json.loads(message.value)
    score = model(torch.tensor(event["features"])).item()
    result = {**event, "anomaly_score": score}
    producer.send("predictions", json.dumps(result).encode())
```

**Use when:** IoT sensor monitoring, real-time anomaly detection, live content moderation.

---

## Serving Frameworks

| Framework | Best For | Protocol | Key Feature |
|-----------|----------|----------|-------------|
| TorchServe | PyTorch models | HTTP/gRPC | Multi-model serving, A/B testing |
| TF Serving | TensorFlow/Keras | gRPC/REST | Production-hardened, Google-backed |
| Triton | Multi-framework GPU | HTTP/gRPC | Dynamic batching, model ensemble |
| vLLM | LLM inference | OpenAI-compat API | PagedAttention, continuous batching |
| Ollama | Local LLM serving | HTTP | Simple setup, GGUF model support |
| Ray Serve | Complex pipelines | HTTP | Composable deployments, autoscaling |
| BentoML | End-to-end packaging | HTTP/gRPC | Bento packaging, Kubernetes deploy |

### vLLM for LLM Serving

```bash
# Serve a model with vLLM -- OpenAI-compatible API
pip install vllm
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --tensor-parallel-size 2 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.9 \
  --enable-prefix-caching
```

### Triton Inference Server

```
# Model repository structure for Triton
model_repository/
  resnet50/
    config.pbtxt
    1/
      model.onnx
  text_encoder/
    config.pbtxt
    1/
      model.pt
```

---

## Deployment Patterns

### Model-as-a-Service

Deploy the model behind a dedicated API. Independent scaling, versioning, and lifecycle.

```yaml
# Kubernetes deployment for model service
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fraud-model-v2
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fraud-model
      version: v2
  template:
    spec:
      containers:
      - name: model
        image: registry.io/fraud-model:v2.3.1
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "8Gi"
          requests:
            memory: "4Gi"
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
```

### Embedded Model

Package the model within the application binary. Eliminates network latency but couples model updates to app deploys.

```go
// Go embedded ONNX inference with onnxruntime-go
package main

import ort "github.com/yalue/onnxruntime_go"

func predict(features []float32) ([]float32, error) {
    session, _ := ort.NewAdvancedSession("model.onnx", nil, nil)
    defer session.Destroy()
    input := ort.NewTensor([]int64{1, len(features)}, features)
    output := ort.NewEmptyTensor[float32]([]int64{1, 1})
    session.Run([]*ort.Tensor{input}, []*ort.Tensor{output})
    return output.GetData(), nil
}
```

### Serverless Inference

Use cloud functions for sporadic traffic. Pay-per-invocation, zero management, but cold start penalties.

```python
# AWS Lambda handler for inference
import json, boto3, numpy as np

# Load model during cold start
model = load_model_from_s3("s3://models/classifier/v2.onnx")

def handler(event, context):
    body = json.loads(event["body"])
    features = np.array(body["features"], dtype=np.float32)
    prediction = model.predict(features)
    return {
        "statusCode": 200,
        "body": json.dumps({"prediction": prediction.tolist()})
    }
```

---

## Hardware Acceleration & Quantization

### GPU Serving

| Platform | GPU | Use Case |
|----------|-----|----------|
| NVIDIA A100/H100 | 80GB HBM | Large model training and serving |
| NVIDIA L4/T4 | 16-24GB | Cost-effective inference |
| AMD MI300X | 192GB HBM3 | High-memory LLM serving |
| AWS Inferentia2 | Custom ASIC | Cost-optimized inference on AWS |

### Quantization Techniques

Reduce model size and speed up inference by lowering numerical precision.

| Method | Precision | Speed Gain | Quality Loss | Best For |
|--------|-----------|------------|--------------|----------|
| FP16 | 16-bit float | 2x | Negligible | Default GPU serving |
| INT8 | 8-bit integer | 3-4x | Minimal | Production inference |
| GPTQ | 4-bit | 4-6x | Small | LLM serving on consumer GPU |
| AWQ | 4-bit activation-aware | 4-6x | Smaller than GPTQ | Quality-sensitive LLM serving |
| GGUF | 2-8 bit mixed | 3-8x | Varies | CPU/edge inference (llama.cpp) |

```python
# Quantize a model with bitsandbytes for serving
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype="bfloat16",
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=quantization_config,
    device_map="auto",
)
```

---

## Scaling Inference

### Horizontal Scaling

Replicate model instances behind a load balancer. Use session-less inference endpoints.

### Model Parallelism

Split a single large model across multiple GPUs when it exceeds single-GPU memory.

- **Tensor parallelism** -- Split individual layers across GPUs (intra-layer). Best for latency.
- **Pipeline parallelism** -- Split sequential layers across GPUs (inter-layer). Best for throughput.

### KV-Cache Optimization (LLMs)

- **PagedAttention (vLLM)** -- Manage KV-cache in non-contiguous pages like OS virtual memory. Reduces waste from 60-80% to under 4%.
- **Prefix caching** -- Share KV-cache across requests with identical system prompts.
- **Quantized KV-cache** -- Store cached values in FP8 to double effective cache capacity.

---

## API Design for ML Endpoints

```typescript
// TypeScript types for ML prediction API
interface PredictionRequest {
  id: string;                    // Client-generated request ID
  features: Record<string, number | string>;
  options?: {
    model_version?: string;      // Pin to specific version
    explain?: boolean;           // Return feature importances
    timeout_ms?: number;         // Client timeout hint
  };
}

interface PredictionResponse {
  id: string;
  prediction: number | string | number[];
  confidence: number;
  model_version: string;
  latency_ms: number;
  explanation?: Record<string, number>;  // SHAP values
}

// Async prediction with webhook callback
interface AsyncPredictionRequest {
  id: string;
  features: Record<string, number | string>;
  webhook_url: string;          // POST results here when ready
  priority?: "low" | "normal" | "high";
}
```

---

## Performance Optimization

### Dynamic Batching

Accumulate requests and process as a batch for GPU efficiency.

```python
# Triton dynamic batching config
# config.pbtxt
dynamic_batching {
  preferred_batch_size: [8, 16, 32]
  max_queue_delay_microseconds: 5000  # Wait up to 5ms to fill batch
}
```

### Speculative Decoding

Use a small "draft" model to generate candidate tokens, then verify with the large model in parallel. Achieve 2-3x speedup with identical output quality.

### Continuous Batching

Process new requests as soon as any request in the batch completes, rather than waiting for the entire batch. vLLM and TensorRT-LLM implement this natively.

---

## Containerization for ML

```dockerfile
# Multi-stage Dockerfile for ML model serving
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04 AS base
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM dependencies AS runtime
COPY model/ /app/model/
COPY serve.py /app/
WORKDIR /app
EXPOSE 8080
HEALTHCHECK --interval=30s CMD curl -f http://localhost:8080/health || exit 1
CMD ["python3", "serve.py"]
```

**Key practices:**
- Separate model weights from application code -- mount or download at startup
- Use NVIDIA Container Toolkit for GPU access (`--gpus all`)
- Pin CUDA versions to match training environment
- Use multi-stage builds to minimize image size

---

## Cloud ML Services

| Service | Provider | Strengths |
|---------|----------|-----------|
| SageMaker Endpoints | AWS | Deep AWS integration, multi-model endpoints |
| Vertex AI Prediction | GCP | AutoML, custom containers, Model Garden |
| Azure ML Endpoints | Azure | Managed online/batch, responsible AI |
| Replicate | Independent | One-command deploy, pay-per-second |
| Modal | Independent | Serverless GPU, Python-native deploy |
| Baseten | Independent | Truss packaging, autoscaling GPU |

---

## 10 Best Practices

1. **Version every served model.** Tag model artifacts with version, training data hash, and metrics. Never serve an unversioned model.
2. **Implement health checks and readiness probes.** Distinguish between "container is alive" and "model is loaded and ready to serve." GPU model loading can take minutes.
3. **Set explicit timeout and fallback behavior.** Define what happens when inference exceeds latency SLO -- return cached result, default prediction, or error.
4. **Use dynamic batching for GPU workloads.** Accumulating requests into batches can improve throughput 4-10x with minimal latency increase.
5. **Quantize models for production serving.** FP16 is the minimum; INT8 or 4-bit quantization dramatically reduces cost with acceptable quality trade-offs.
6. **Separate model artifacts from serving code.** Store weights in object storage (S3, GCS) and download at startup. Avoid baking 10GB+ weights into Docker images.
7. **Canary deploy new model versions.** Route 5-10% of traffic to the new version, compare metrics, then gradually increase.
8. **Monitor inference latency at p50, p95, and p99.** Tail latencies reveal GPU memory pressure, batching inefficiency, or resource contention.
9. **Implement graceful shutdown.** Drain in-flight requests before terminating pods. LLM responses can take 10-30 seconds for long generations.
10. **Load test before production deployment.** Profile throughput, latency distribution, and GPU memory usage under realistic traffic patterns.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Baking model weights into Docker image | 15GB+ images, slow deploys, coupled releases | Mount weights from object storage at startup |
| No model versioning | Cannot rollback, no reproducibility | Use model registry with semantic versioning |
| Synchronous inference for long tasks | Timeouts, blocked threads, poor UX | Use async endpoints with webhooks or polling |
| Single replica serving | Zero fault tolerance, no scaling | Minimum 2 replicas with load balancer |
| Ignoring cold start latency | First requests fail or timeout | Pre-warm instances, keep minimum replicas |
| GPU over-provisioning | Wasted cost on idle GPUs | Right-size instances, use spot/preemptible |
| No input validation | Model crashes on malformed data | Validate schema, ranges, and types before inference |
| Tight coupling to one framework | Vendor lock-in, migration pain | Export to ONNX or use framework-agnostic serving |

---

## Enforcement Checklist

- [ ] Every model artifact has a version tag and metadata (training date, dataset, metrics)
- [ ] Health and readiness endpoints are implemented and tested
- [ ] Latency SLOs are defined and monitored (p50, p95, p99)
- [ ] Model weights are stored in object storage, not baked into images
- [ ] Input validation rejects malformed requests before inference
- [ ] Graceful shutdown drains in-flight requests
- [ ] Canary or blue/green deployment is configured for model updates
- [ ] GPU utilization and memory are monitored
- [ ] Fallback behavior is defined for timeout and error scenarios
- [ ] Load testing is completed before production traffic is enabled
