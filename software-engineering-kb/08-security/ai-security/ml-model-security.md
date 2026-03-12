# ML Model Security

## Metadata
- **Category**: AI Security / Machine Learning Security
- **Audience**: ML engineers, security engineers, data scientists, MLOps engineers
- **Complexity**: Advanced
- **Prerequisites**: Machine learning fundamentals, model training/deployment, Python, PyTorch/scikit-learn
- **Version**: 1.0
- **Last Updated**: 2026-03-10

---

## Table of Contents

1. [Introduction](#introduction)
2. [Model Theft and Extraction](#model-theft-and-extraction)
3. [Adversarial Attacks](#adversarial-attacks)
4. [Training Data Poisoning](#training-data-poisoning)
5. [Model Integrity and Supply Chain Security](#model-integrity-and-supply-chain-security)
6. [Inference Security](#inference-security)
7. [Model Privacy](#model-privacy)
8. [Model Bias and Fairness as Security Concern](#model-bias-and-fairness-as-security-concern)
9. [Secure Model Deployment](#secure-model-deployment)
10. [Model Monitoring](#model-monitoring)
11. [NIST AI Risk Management Framework](#nist-ai-risk-management-framework)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## Introduction

Machine learning models are increasingly deployed in security-sensitive, safety-critical,
and revenue-critical applications. From fraud detection to medical diagnosis, autonomous
vehicles to content moderation, ML models make decisions that have real-world consequences.
This makes them high-value targets for attackers.

ML model security encompasses a broad set of concerns: protecting models from theft,
defending against adversarial inputs designed to cause misclassification, preventing
training data poisoning, ensuring model integrity throughout the supply chain, protecting
training data privacy, and maintaining fairness to prevent discriminatory harm.

This guide covers the complete lifecycle of ML model security -- from training data
validation to secure deployment and runtime monitoring -- with practical implementation
guidance and code examples.

The fundamental principle: **ML models are software artifacts with unique attack surfaces.
Traditional application security is necessary but not sufficient. Model-specific defenses
must be layered on top of standard security controls.**

---

## Model Theft and Extraction

### Model Stealing Attacks

Model extraction attacks allow an adversary to create a functionally equivalent copy of a
model by querying it systematically and training a substitute model on the input-output
pairs.

```
Model Extraction Attack Flow
==============================
1. Attacker queries the target model API with crafted inputs
2. Attacker collects model predictions (labels, probabilities, embeddings)
3. Attacker trains a substitute model on the (input, prediction) pairs
4. Substitute model approximates the target model's behavior
5. Attacker uses the substitute for free or to craft adversarial examples

Attack Complexity:
- Classification models: ~O(n * k) queries (n = input features, k = classes)
- Regression models: ~O(n^2) queries with active learning
- Deep models: Requires more queries but is still feasible
```

### Rate Limiting Inference API

```python
# src/ml_security/api/rate_limiter.py

import time
import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple
from functools import wraps
import logging

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for model API rate limiting."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    max_batch_size: int = 32
    min_request_interval_ms: int = 100
    # Stricter limits for unauthenticated users
    unauth_requests_per_minute: int = 10
    unauth_requests_per_day: int = 100


@dataclass
class UserRequestHistory:
    timestamps: list = field(default_factory=list)
    total_queries: int = 0
    daily_queries: int = 0
    last_request_time: float = 0
    consecutive_identical: int = 0
    last_input_hash: str = ''


class ModelAPIRateLimiter:
    """
    Rate limiter specifically designed to prevent model extraction attacks.

    Beyond standard rate limiting, this monitors query patterns that indicate
    systematic model probing.
    """

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self.user_history: Dict[str, UserRequestHistory] = defaultdict(UserRequestHistory)

    def check_request(
        self,
        user_id: str,
        input_data: bytes,
        is_authenticated: bool = True,
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a request should be allowed.

        Returns:
            (allowed, reason) - reason is None if allowed, explanation if denied.
        """
        now = time.time()
        history = self.user_history[user_id]

        # Select limits based on authentication status
        per_minute = (self.config.requests_per_minute if is_authenticated
                      else self.config.unauth_requests_per_minute)
        per_day = (self.config.requests_per_day if is_authenticated
                   else self.config.unauth_requests_per_day)

        # Check minimum request interval
        if history.last_request_time > 0:
            interval_ms = (now - history.last_request_time) * 1000
            if interval_ms < self.config.min_request_interval_ms:
                return False, 'Requests too frequent. Minimum interval not met.'

        # Clean old timestamps
        one_minute_ago = now - 60
        one_hour_ago = now - 3600
        one_day_ago = now - 86400

        history.timestamps = [t for t in history.timestamps if t > one_day_ago]

        # Check per-minute rate
        recent_minute = sum(1 for t in history.timestamps if t > one_minute_ago)
        if recent_minute >= per_minute:
            return False, f'Rate limit exceeded: {per_minute} requests per minute'

        # Check per-hour rate
        recent_hour = sum(1 for t in history.timestamps if t > one_hour_ago)
        if recent_hour >= self.config.requests_per_hour:
            return False, f'Rate limit exceeded: {self.config.requests_per_hour} requests per hour'

        # Check per-day rate
        if len(history.timestamps) >= per_day:
            return False, f'Rate limit exceeded: {per_day} requests per day'

        # Check for extraction patterns: consecutive identical inputs
        input_hash = hashlib.sha256(input_data).hexdigest()
        if input_hash == history.last_input_hash:
            history.consecutive_identical += 1
            if history.consecutive_identical > 5:
                logger.warning(
                    'Potential extraction: %d consecutive identical queries from %s',
                    history.consecutive_identical, user_id,
                )
                return False, 'Suspicious query pattern detected'
        else:
            history.consecutive_identical = 0

        # Update history
        history.timestamps.append(now)
        history.last_request_time = now
        history.last_input_hash = input_hash
        history.total_queries += 1

        return True, None


def rate_limit(limiter: ModelAPIRateLimiter):
    """Decorator for rate-limiting model inference endpoints."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_id = kwargs.get('user_id', 'anonymous')
            input_data = kwargs.get('input_data', b'')
            if isinstance(input_data, str):
                input_data = input_data.encode()

            allowed, reason = limiter.check_request(
                user_id=user_id,
                input_data=input_data,
                is_authenticated=kwargs.get('authenticated', False),
            )

            if not allowed:
                raise PermissionError(f'Request denied: {reason}')

            return func(*args, **kwargs)
        return wrapper
    return decorator
```

### Model Watermarking

```python
# src/ml_security/watermark/model_watermark.py

import numpy as np
import torch
import torch.nn as nn
from typing import Dict, List, Optional, Tuple
import hashlib
import json
import logging

logger = logging.getLogger(__name__)


class ModelWatermarker:
    """
    Embed watermarks in ML models for ownership verification.

    Approach: Train the model to produce specific outputs for a set of
    specially crafted "trigger" inputs. These trigger-response pairs serve
    as a watermark that can verify ownership.

    The watermark should:
    - Not degrade model performance on normal inputs
    - Be difficult to remove without retraining
    - Be verifiable with statistical confidence
    - Be unique to the model owner
    """

    def __init__(
        self,
        owner_id: str,
        num_triggers: int = 100,
        trigger_strength: float = 0.01,
    ):
        self.owner_id = owner_id
        self.num_triggers = num_triggers
        self.trigger_strength = trigger_strength
        self.trigger_inputs: Optional[torch.Tensor] = None
        self.trigger_labels: Optional[torch.Tensor] = None

    def generate_triggers(
        self,
        input_shape: Tuple[int, ...],
        num_classes: int,
        seed: Optional[int] = None,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Generate watermark trigger inputs and their expected outputs.

        Uses a deterministic seed derived from the owner_id for reproducibility.
        """
        if seed is None:
            seed = int(hashlib.sha256(self.owner_id.encode()).hexdigest()[:8], 16)

        rng = np.random.RandomState(seed)

        # Generate random trigger inputs
        trigger_data = rng.randn(self.num_triggers, *input_shape).astype(np.float32)
        self.trigger_inputs = torch.tensor(trigger_data)

        # Generate random target labels
        trigger_labels = rng.randint(0, num_classes, size=self.num_triggers)
        self.trigger_labels = torch.tensor(trigger_labels, dtype=torch.long)

        return self.trigger_inputs, self.trigger_labels

    def create_watermark_loss(
        self,
        model: nn.Module,
        standard_loss: torch.Tensor,
    ) -> torch.Tensor:
        """
        Combine standard training loss with watermark embedding loss.

        The watermark loss is weighted to be small enough not to impact
        normal performance but strong enough to embed the watermark.
        """
        if self.trigger_inputs is None or self.trigger_labels is None:
            raise ValueError("Generate triggers first with generate_triggers()")

        device = next(model.parameters()).device
        triggers = self.trigger_inputs.to(device)
        labels = self.trigger_labels.to(device)

        # Forward pass on trigger inputs
        trigger_outputs = model(triggers)
        watermark_loss = nn.CrossEntropyLoss()(trigger_outputs, labels)

        # Combined loss
        total_loss = standard_loss + self.trigger_strength * watermark_loss

        return total_loss

    def verify_watermark(
        self,
        model: nn.Module,
        confidence_threshold: float = 0.9,
    ) -> Dict[str, float]:
        """
        Verify if a model contains the watermark.

        Returns verification results with statistical confidence.
        """
        if self.trigger_inputs is None or self.trigger_labels is None:
            raise ValueError("Generate triggers first with generate_triggers()")

        device = next(model.parameters()).device
        model.eval()

        with torch.no_grad():
            triggers = self.trigger_inputs.to(device)
            labels = self.trigger_labels.to(device)

            outputs = model(triggers)
            predictions = outputs.argmax(dim=1)

            correct = (predictions == labels).float()
            accuracy = correct.mean().item()

            # Random chance baseline
            num_classes = outputs.shape[1]
            random_chance = 1.0 / num_classes

            # Confidence: how much better than random chance
            confidence = min(1.0, max(0.0,
                (accuracy - random_chance) / (1.0 - random_chance)
            ))

        result = {
            'watermark_accuracy': accuracy,
            'random_chance': random_chance,
            'confidence': confidence,
            'is_watermarked': confidence >= confidence_threshold,
            'num_triggers_tested': self.num_triggers,
        }

        logger.info(
            'Watermark verification: accuracy=%.3f, confidence=%.3f, verified=%s',
            accuracy, confidence, result['is_watermarked'],
        )

        return result

    def export_verification_key(self) -> str:
        """
        Export the verification key (triggers + labels) as a signed JSON blob.

        This key is needed to verify watermark ownership and should be
        stored securely.
        """
        if self.trigger_inputs is None or self.trigger_labels is None:
            raise ValueError("Generate triggers first")

        key_data = {
            'owner_id': self.owner_id,
            'num_triggers': self.num_triggers,
            'trigger_inputs_hash': hashlib.sha256(
                self.trigger_inputs.numpy().tobytes()
            ).hexdigest(),
            'trigger_labels_hash': hashlib.sha256(
                self.trigger_labels.numpy().tobytes()
            ).hexdigest(),
        }

        return json.dumps(key_data, indent=2)
```

### Monitoring for Extraction Patterns

```python
# src/ml_security/monitoring/extraction_detector.py

import numpy as np
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class ExtractionAlert:
    user_id: str
    alert_type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    detail: str
    evidence: Dict


class ModelExtractionDetector:
    """
    Detect model extraction (stealing) attacks by monitoring query patterns.

    Extraction attacks exhibit characteristic patterns:
    1. Systematic exploration of input space
    2. Queries at decision boundaries
    3. High volume of queries with small perturbations
    4. Focus on extracting confidence scores
    5. Grid-like or random-walk query patterns
    """

    def __init__(self, feature_dim: int):
        self.feature_dim = feature_dim
        self.user_queries: Dict[str, List[np.ndarray]] = defaultdict(list)
        self.user_outputs: Dict[str, List[np.ndarray]] = defaultdict(list)
        self.alert_history: List[ExtractionAlert] = []

    def record_query(
        self,
        user_id: str,
        input_features: np.ndarray,
        output_probabilities: np.ndarray,
    ) -> List[ExtractionAlert]:
        """Record a query and check for extraction patterns."""
        alerts: List[ExtractionAlert] = []

        self.user_queries[user_id].append(input_features.flatten())
        self.user_outputs[user_id].append(output_probabilities.flatten())

        queries = self.user_queries[user_id]

        # Only analyze after sufficient query history
        if len(queries) < 20:
            return alerts

        # Detection 1: Grid-like pattern (systematic space exploration)
        if len(queries) >= 50:
            grid_score = self._detect_grid_pattern(queries[-50:])
            if grid_score > 0.7:
                alerts.append(ExtractionAlert(
                    user_id=user_id,
                    alert_type='grid_exploration',
                    severity='high',
                    detail=f'Systematic grid-like query pattern detected (score: {grid_score:.2f})',
                    evidence={'grid_score': grid_score, 'query_count': len(queries)},
                ))

        # Detection 2: Decision boundary probing
        if len(queries) >= 30:
            boundary_score = self._detect_boundary_probing(
                queries[-30:], self.user_outputs[user_id][-30:]
            )
            if boundary_score > 0.6:
                alerts.append(ExtractionAlert(
                    user_id=user_id,
                    alert_type='boundary_probing',
                    severity='critical',
                    detail=f'Decision boundary probing detected (score: {boundary_score:.2f})',
                    evidence={'boundary_score': boundary_score},
                ))

        # Detection 3: Small perturbation pattern
        if len(queries) >= 20:
            perturbation_score = self._detect_perturbation_pattern(queries[-20:])
            if perturbation_score > 0.8:
                alerts.append(ExtractionAlert(
                    user_id=user_id,
                    alert_type='perturbation_attack',
                    severity='high',
                    detail=f'Small perturbation query pattern (score: {perturbation_score:.2f})',
                    evidence={'perturbation_score': perturbation_score},
                ))

        # Detection 4: Unusual query volume
        if len(queries) > 1000:
            alerts.append(ExtractionAlert(
                user_id=user_id,
                alert_type='high_volume',
                severity='medium',
                detail=f'Unusual query volume: {len(queries)} queries',
                evidence={'query_count': len(queries)},
            ))

        self.alert_history.extend(alerts)

        for alert in alerts:
            logger.warning(
                'Extraction alert: user=%s, type=%s, severity=%s, detail=%s',
                alert.user_id, alert.alert_type, alert.severity, alert.detail,
            )

        return alerts

    def _detect_grid_pattern(self, queries: List[np.ndarray]) -> float:
        """Detect grid-like systematic exploration of input space."""
        if len(queries) < 10:
            return 0.0

        # Check if queries form regular intervals in each dimension
        query_matrix = np.array(queries)
        grid_scores = []

        for dim in range(min(self.feature_dim, query_matrix.shape[1])):
            values = np.sort(query_matrix[:, dim])
            if len(values) < 3:
                continue
            diffs = np.diff(values)
            diffs = diffs[diffs > 1e-8]  # Remove zero diffs
            if len(diffs) < 2:
                continue
            # Regular spacing has low coefficient of variation
            cv = np.std(diffs) / (np.mean(diffs) + 1e-10)
            grid_scores.append(1.0 - min(cv, 1.0))

        return float(np.mean(grid_scores)) if grid_scores else 0.0

    def _detect_boundary_probing(
        self,
        queries: List[np.ndarray],
        outputs: List[np.ndarray],
    ) -> float:
        """Detect queries concentrated near decision boundaries."""
        if len(outputs) < 10:
            return 0.0

        # High entropy in outputs = queries near decision boundary
        entropies = []
        for out in outputs:
            probs = np.clip(out, 1e-10, 1.0)
            probs = probs / probs.sum()
            entropy = -np.sum(probs * np.log(probs))
            max_entropy = np.log(len(probs))
            entropies.append(entropy / max_entropy if max_entropy > 0 else 0)

        # High proportion of high-entropy queries = boundary probing
        high_entropy_ratio = np.mean([e > 0.7 for e in entropies])
        return float(high_entropy_ratio)

    def _detect_perturbation_pattern(self, queries: List[np.ndarray]) -> float:
        """Detect small perturbation patterns (adversarial example crafting)."""
        if len(queries) < 5:
            return 0.0

        # Calculate consecutive query distances
        distances = []
        for i in range(1, len(queries)):
            dist = np.linalg.norm(queries[i] - queries[i - 1])
            distances.append(dist)

        if not distances:
            return 0.0

        # Many very small distances = perturbation attack
        median_dist = np.median(distances)
        small_ratio = np.mean([d < median_dist * 0.1 for d in distances])

        return float(small_ratio)
```

---

## Adversarial Attacks

### Adversarial Training Defense

```python
# src/ml_security/adversarial/adversarial_training.py

import torch
import torch.nn as nn
import torch.optim as optim
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class PGDAttack:
    """
    Projected Gradient Descent (PGD) attack for adversarial training.

    PGD is a strong iterative attack that generates adversarial examples
    by repeatedly taking gradient steps within an epsilon ball around
    the original input.
    """

    def __init__(
        self,
        model: nn.Module,
        epsilon: float = 0.03,  # Maximum perturbation (L-inf norm)
        alpha: float = 0.007,   # Step size per iteration
        num_steps: int = 10,    # Number of PGD steps
        random_start: bool = True,
    ):
        self.model = model
        self.epsilon = epsilon
        self.alpha = alpha
        self.num_steps = num_steps
        self.random_start = random_start

    def generate(
        self,
        inputs: torch.Tensor,
        labels: torch.Tensor,
    ) -> torch.Tensor:
        """Generate adversarial examples using PGD."""
        self.model.eval()
        adv_inputs = inputs.clone().detach()

        if self.random_start:
            # Start from a random point within the epsilon ball
            adv_inputs = adv_inputs + torch.empty_like(adv_inputs).uniform_(
                -self.epsilon, self.epsilon
            )
            adv_inputs = torch.clamp(adv_inputs, 0.0, 1.0)

        for _ in range(self.num_steps):
            adv_inputs.requires_grad_(True)

            outputs = self.model(adv_inputs)
            loss = nn.CrossEntropyLoss()(outputs, labels)

            self.model.zero_grad()
            loss.backward()

            # Take gradient step
            grad = adv_inputs.grad.detach()
            adv_inputs = adv_inputs.detach() + self.alpha * grad.sign()

            # Project back into epsilon ball around original input
            perturbation = torch.clamp(
                adv_inputs - inputs, min=-self.epsilon, max=self.epsilon
            )
            adv_inputs = torch.clamp(inputs + perturbation, 0.0, 1.0)

        self.model.train()
        return adv_inputs.detach()


def adversarial_training_epoch(
    model: nn.Module,
    train_loader: torch.utils.data.DataLoader,
    optimizer: optim.Optimizer,
    device: torch.device,
    epsilon: float = 0.03,
    adv_ratio: float = 0.5,
) -> dict:
    """
    Train one epoch with adversarial examples mixed in.

    Args:
        model: The model to train.
        train_loader: Training data loader.
        optimizer: Optimizer.
        device: Device (CPU/GPU).
        epsilon: Maximum perturbation for adversarial examples.
        adv_ratio: Fraction of batch to replace with adversarial examples.

    Returns:
        Training metrics for the epoch.
    """
    model.train()
    pgd = PGDAttack(model, epsilon=epsilon)
    criterion = nn.CrossEntropyLoss()

    total_loss = 0.0
    correct = 0
    total = 0
    adv_correct = 0
    adv_total = 0

    for batch_idx, (inputs, labels) in enumerate(train_loader):
        inputs, labels = inputs.to(device), labels.to(device)

        # Split batch: some clean, some adversarial
        split_idx = int(len(inputs) * (1 - adv_ratio))
        clean_inputs = inputs[:split_idx]
        clean_labels = labels[:split_idx]
        adv_inputs_orig = inputs[split_idx:]
        adv_labels = labels[split_idx:]

        # Generate adversarial examples
        if len(adv_inputs_orig) > 0:
            adv_inputs = pgd.generate(adv_inputs_orig, adv_labels)

            # Combine clean and adversarial
            combined_inputs = torch.cat([clean_inputs, adv_inputs])
            combined_labels = torch.cat([clean_labels, adv_labels])

            # Track adversarial accuracy separately
            model.eval()
            with torch.no_grad():
                adv_outputs = model(adv_inputs)
                adv_preds = adv_outputs.argmax(dim=1)
                adv_correct += (adv_preds == adv_labels).sum().item()
                adv_total += len(adv_labels)
            model.train()
        else:
            combined_inputs = clean_inputs
            combined_labels = clean_labels

        # Forward pass
        outputs = model(combined_inputs)
        loss = criterion(outputs, combined_labels)

        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        preds = outputs.argmax(dim=1)
        correct += (preds == combined_labels).sum().item()
        total += len(combined_labels)

    metrics = {
        'loss': total_loss / len(train_loader),
        'accuracy': correct / total if total > 0 else 0,
        'adversarial_accuracy': adv_correct / adv_total if adv_total > 0 else 0,
    }

    logger.info(
        'Adversarial training epoch: loss=%.4f, acc=%.3f, adv_acc=%.3f',
        metrics['loss'], metrics['accuracy'], metrics['adversarial_accuracy'],
    )

    return metrics
```

### Input Preprocessing Defense

```python
# src/ml_security/adversarial/input_preprocessing.py

import numpy as np
import torch
from typing import Optional


class InputPreprocessingDefense:
    """
    Input preprocessing techniques to neutralize adversarial perturbations.

    These are model-agnostic defenses that process inputs before they reach
    the model, aiming to remove adversarial perturbations while preserving
    legitimate signal.
    """

    @staticmethod
    def spatial_smoothing(
        image: np.ndarray,
        kernel_size: int = 3,
    ) -> np.ndarray:
        """
        Apply spatial smoothing (median filter) to remove small perturbations.

        Adversarial perturbations are typically high-frequency noise that
        can be reduced by smoothing.
        """
        from scipy.ndimage import median_filter
        return median_filter(image, size=kernel_size)

    @staticmethod
    def jpeg_compression(
        image: np.ndarray,
        quality: int = 75,
    ) -> np.ndarray:
        """
        Apply JPEG compression to remove adversarial perturbations.

        JPEG compression removes high-frequency components that often
        correspond to adversarial noise.
        """
        from PIL import Image
        import io

        # Convert to PIL Image
        if image.dtype == np.float32 or image.dtype == np.float64:
            img_uint8 = (image * 255).clip(0, 255).astype(np.uint8)
        else:
            img_uint8 = image

        if len(img_uint8.shape) == 3 and img_uint8.shape[0] in (1, 3):
            img_uint8 = np.transpose(img_uint8, (1, 2, 0))

        pil_image = Image.fromarray(img_uint8)

        # Compress and decompress
        buffer = io.BytesIO()
        pil_image.save(buffer, format='JPEG', quality=quality)
        buffer.seek(0)
        compressed = np.array(Image.open(buffer)).astype(np.float32) / 255.0

        if len(image.shape) == 3 and image.shape[0] in (1, 3):
            compressed = np.transpose(compressed, (2, 0, 1))

        return compressed

    @staticmethod
    def feature_squeezing(
        inputs: torch.Tensor,
        bit_depth: int = 4,
    ) -> torch.Tensor:
        """
        Reduce color bit depth to remove small perturbations.

        Quantizes input values to fewer levels, eliminating
        the fine-grained perturbations used in adversarial attacks.
        """
        levels = 2 ** bit_depth
        squeezed = torch.round(inputs * (levels - 1)) / (levels - 1)
        return squeezed.clamp(0.0, 1.0)

    @staticmethod
    def randomized_smoothing(
        model: torch.nn.Module,
        inputs: torch.Tensor,
        num_samples: int = 100,
        noise_std: float = 0.25,
    ) -> torch.Tensor:
        """
        Apply randomized smoothing for certified robustness.

        Adds Gaussian noise to the input multiple times and takes the
        majority vote. Provides a certified radius within which the
        prediction is guaranteed to be robust.
        """
        model.eval()
        device = next(model.parameters()).device
        inputs = inputs.to(device)

        # Collect predictions over noisy versions of the input
        all_predictions = []
        with torch.no_grad():
            for _ in range(num_samples):
                noise = torch.randn_like(inputs) * noise_std
                noisy_input = (inputs + noise).clamp(0.0, 1.0)
                output = model(noisy_input)
                predictions = output.argmax(dim=1)
                all_predictions.append(predictions)

        # Stack and take majority vote
        all_preds = torch.stack(all_predictions, dim=0)
        # Mode along the sample dimension
        majority_vote, _ = torch.mode(all_preds, dim=0)

        return majority_vote
```

### Robustness Testing

```python
# src/ml_security/testing/robustness_test.py

import numpy as np
import torch
import torch.nn as nn
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class RobustnessReport:
    clean_accuracy: float
    adversarial_accuracies: Dict[str, float]  # attack_name -> accuracy
    robustness_score: float  # 0-1, higher is more robust
    vulnerable_classes: List[int]
    recommendations: List[str]


class ModelRobustnessTester:
    """
    Comprehensive robustness testing for ML models.

    Tests model resilience against multiple attack types and perturbation
    levels to assess vulnerability before deployment.
    """

    def __init__(self, model: nn.Module, device: torch.device):
        self.model = model
        self.device = device

    def run_full_assessment(
        self,
        test_loader: torch.utils.data.DataLoader,
        epsilon_values: List[float] = [0.01, 0.03, 0.05, 0.1],
    ) -> RobustnessReport:
        """Run comprehensive robustness assessment."""
        self.model.eval()
        self.model.to(self.device)

        # Measure clean accuracy
        clean_acc = self._measure_accuracy(test_loader)

        # Test FGSM at multiple epsilon values
        adv_accuracies: Dict[str, float] = {}
        for eps in epsilon_values:
            fgsm_acc = self._test_fgsm(test_loader, epsilon=eps)
            adv_accuracies[f'FGSM_eps={eps}'] = fgsm_acc

        # Test PGD at key epsilon
        pgd_acc = self._test_pgd(test_loader, epsilon=0.03)
        adv_accuracies['PGD_eps=0.03'] = pgd_acc

        # Find most vulnerable classes
        vulnerable = self._find_vulnerable_classes(test_loader)

        # Calculate overall robustness score
        avg_adv_acc = np.mean(list(adv_accuracies.values()))
        robustness_score = avg_adv_acc / clean_acc if clean_acc > 0 else 0

        # Generate recommendations
        recommendations = self._generate_recommendations(
            clean_acc, adv_accuracies, robustness_score,
        )

        return RobustnessReport(
            clean_accuracy=clean_acc,
            adversarial_accuracies=adv_accuracies,
            robustness_score=robustness_score,
            vulnerable_classes=vulnerable,
            recommendations=recommendations,
        )

    def _measure_accuracy(self, loader: torch.utils.data.DataLoader) -> float:
        correct = 0
        total = 0
        with torch.no_grad():
            for inputs, labels in loader:
                inputs, labels = inputs.to(self.device), labels.to(self.device)
                outputs = self.model(inputs)
                preds = outputs.argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += len(labels)
        return correct / total if total > 0 else 0

    def _test_fgsm(
        self,
        loader: torch.utils.data.DataLoader,
        epsilon: float,
    ) -> float:
        """Test model against FGSM (Fast Gradient Sign Method) attack."""
        correct = 0
        total = 0
        criterion = nn.CrossEntropyLoss()

        for inputs, labels in loader:
            inputs = inputs.to(self.device).requires_grad_(True)
            labels = labels.to(self.device)

            outputs = self.model(inputs)
            loss = criterion(outputs, labels)
            self.model.zero_grad()
            loss.backward()

            # Generate FGSM perturbation
            perturbation = epsilon * inputs.grad.sign()
            adv_inputs = (inputs + perturbation).clamp(0, 1).detach()

            # Evaluate
            with torch.no_grad():
                adv_outputs = self.model(adv_inputs)
                preds = adv_outputs.argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += len(labels)

        return correct / total if total > 0 else 0

    def _test_pgd(
        self,
        loader: torch.utils.data.DataLoader,
        epsilon: float,
        num_steps: int = 20,
        step_size: float = 0.003,
    ) -> float:
        """Test model against PGD attack."""
        correct = 0
        total = 0
        criterion = nn.CrossEntropyLoss()

        for inputs, labels in loader:
            inputs, labels = inputs.to(self.device), labels.to(self.device)
            adv_inputs = inputs.clone().detach()

            # Random start
            adv_inputs += torch.empty_like(adv_inputs).uniform_(-epsilon, epsilon)
            adv_inputs = adv_inputs.clamp(0, 1)

            for _ in range(num_steps):
                adv_inputs.requires_grad_(True)
                outputs = self.model(adv_inputs)
                loss = criterion(outputs, labels)
                self.model.zero_grad()
                loss.backward()

                grad = adv_inputs.grad.detach()
                adv_inputs = adv_inputs.detach() + step_size * grad.sign()
                perturbation = torch.clamp(adv_inputs - inputs, -epsilon, epsilon)
                adv_inputs = torch.clamp(inputs + perturbation, 0, 1)

            with torch.no_grad():
                adv_outputs = self.model(adv_inputs)
                preds = adv_outputs.argmax(dim=1)
                correct += (preds == labels).sum().item()
                total += len(labels)

        return correct / total if total > 0 else 0

    def _find_vulnerable_classes(
        self,
        loader: torch.utils.data.DataLoader,
        epsilon: float = 0.03,
    ) -> List[int]:
        """Find classes most vulnerable to adversarial attacks."""
        from collections import defaultdict
        class_correct = defaultdict(int)
        class_total = defaultdict(int)
        criterion = nn.CrossEntropyLoss()

        for inputs, labels in loader:
            inputs = inputs.to(self.device).requires_grad_(True)
            labels = labels.to(self.device)

            outputs = self.model(inputs)
            loss = criterion(outputs, labels)
            self.model.zero_grad()
            loss.backward()

            adv_inputs = (inputs + epsilon * inputs.grad.sign()).clamp(0, 1).detach()

            with torch.no_grad():
                adv_outputs = self.model(adv_inputs)
                preds = adv_outputs.argmax(dim=1)
                for pred, label in zip(preds, labels):
                    class_total[label.item()] += 1
                    if pred == label:
                        class_correct[label.item()] += 1

        # Find classes with lowest adversarial accuracy
        class_acc = {
            cls: class_correct[cls] / class_total[cls]
            for cls in class_total
        }
        sorted_classes = sorted(class_acc.items(), key=lambda x: x[1])
        return [cls for cls, _ in sorted_classes[:5]]

    def _generate_recommendations(
        self,
        clean_acc: float,
        adv_accs: Dict[str, float],
        robustness_score: float,
    ) -> List[str]:
        recommendations = []

        if robustness_score < 0.3:
            recommendations.append(
                'CRITICAL: Model is highly vulnerable to adversarial attacks. '
                'Implement adversarial training before deployment.'
            )
        elif robustness_score < 0.6:
            recommendations.append(
                'WARNING: Model has moderate adversarial vulnerability. '
                'Consider adversarial training and input preprocessing.'
            )

        min_adv_acc = min(adv_accs.values()) if adv_accs else 0
        if min_adv_acc < 0.1:
            recommendations.append(
                'Model accuracy drops below 10% under attack. '
                'Do not deploy for security-critical applications without hardening.'
            )

        if clean_acc > 0.95 and robustness_score < 0.5:
            recommendations.append(
                'High clean accuracy with low robustness suggests overfitting. '
                'Adversarial training can improve robustness at minimal clean accuracy cost.'
            )

        recommendations.append(
            'Implement input preprocessing (feature squeezing, JPEG compression) '
            'as a lightweight defense layer.'
        )
        recommendations.append(
            'Deploy adversarial input detection at inference time to reject '
            'suspicious inputs.'
        )

        return recommendations
```

---

## Training Data Poisoning

### Backdoor Attack Detection

```python
# src/ml_security/poisoning/backdoor_detector.py

import numpy as np
import torch
import torch.nn as nn
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class BackdoorScanResult:
    is_suspicious: bool
    confidence: float
    detected_triggers: List[Dict]
    scan_details: Dict


class NeuralCleanseDetector:
    """
    Detect backdoor (trojan) attacks in trained neural networks.

    Based on the Neural Cleanse approach: for each class, try to find
    the smallest perturbation (trigger) that causes all inputs to be
    classified as that class. If one class requires a significantly
    smaller trigger than others, it may be a backdoor target class.
    """

    def __init__(
        self,
        model: nn.Module,
        num_classes: int,
        device: torch.device,
        input_shape: Tuple[int, ...],
    ):
        self.model = model
        self.num_classes = num_classes
        self.device = device
        self.input_shape = input_shape

    def scan(
        self,
        clean_loader: torch.utils.data.DataLoader,
        optimization_steps: int = 500,
        trigger_norm_threshold: float = 2.0,
    ) -> BackdoorScanResult:
        """
        Scan model for potential backdoor triggers.

        For each target class, attempts to find a minimal trigger pattern
        that causes misclassification.
        """
        self.model.eval()
        self.model.to(self.device)

        trigger_norms: Dict[int, float] = {}
        trigger_patterns: Dict[int, np.ndarray] = {}

        for target_class in range(self.num_classes):
            norm, pattern = self._find_trigger_for_class(
                clean_loader, target_class, optimization_steps,
            )
            trigger_norms[target_class] = norm
            trigger_patterns[target_class] = pattern

        # Analyze results
        all_norms = list(trigger_norms.values())
        median_norm = np.median(all_norms)
        mad = np.median([abs(n - median_norm) for n in all_norms])

        detected_triggers = []
        for cls, norm in trigger_norms.items():
            # Anomaly detection: significantly smaller trigger than median
            anomaly_score = (median_norm - norm) / (mad + 1e-10)
            if anomaly_score > trigger_norm_threshold:
                detected_triggers.append({
                    'target_class': cls,
                    'trigger_norm': norm,
                    'anomaly_score': anomaly_score,
                })

        is_suspicious = len(detected_triggers) > 0
        confidence = max(
            [t['anomaly_score'] / 5.0 for t in detected_triggers], default=0.0
        )
        confidence = min(confidence, 1.0)

        result = BackdoorScanResult(
            is_suspicious=is_suspicious,
            confidence=confidence,
            detected_triggers=detected_triggers,
            scan_details={
                'trigger_norms': trigger_norms,
                'median_norm': median_norm,
                'mad': mad,
            },
        )

        if is_suspicious:
            logger.critical(
                'Potential backdoor detected! Suspicious classes: %s',
                [t['target_class'] for t in detected_triggers],
            )

        return result

    def _find_trigger_for_class(
        self,
        loader: torch.utils.data.DataLoader,
        target_class: int,
        steps: int,
    ) -> Tuple[float, np.ndarray]:
        """Find the minimum-norm trigger for a specific target class."""
        # Initialize trigger mask and pattern
        mask = torch.zeros(1, *self.input_shape, device=self.device, requires_grad=True)
        pattern = torch.zeros(1, *self.input_shape, device=self.device, requires_grad=True)

        optimizer = torch.optim.Adam([mask, pattern], lr=0.1)
        target = torch.tensor([target_class], device=self.device)

        for step in range(steps):
            total_loss = 0.0
            count = 0

            for inputs, _ in loader:
                inputs = inputs.to(self.device)
                batch_target = target.expand(len(inputs))

                # Apply trigger: x' = (1 - m) * x + m * p
                triggered = (1 - torch.sigmoid(mask)) * inputs + torch.sigmoid(mask) * pattern

                outputs = self.model(triggered)
                cls_loss = nn.CrossEntropyLoss()(outputs, batch_target)

                # Regularize trigger size (minimize mask norm)
                reg_loss = torch.sigmoid(mask).norm(p=1)

                loss = cls_loss + 0.01 * reg_loss
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                count += 1

                if count > 10:  # Limit batches per step for speed
                    break

        final_mask = torch.sigmoid(mask).detach().cpu().numpy()
        trigger_norm = float(np.sum(np.abs(final_mask)))

        return trigger_norm, final_mask


class TrainingDataValidator:
    """
    Validate training data for poisoning indicators.
    """

    @staticmethod
    def detect_label_anomalies(
        features: np.ndarray,
        labels: np.ndarray,
        contamination: float = 0.05,
    ) -> np.ndarray:
        """
        Detect potentially mislabeled samples that may indicate poisoning.

        Uses an isolation forest on features within each class to find outliers.
        """
        from sklearn.ensemble import IsolationForest

        anomaly_mask = np.zeros(len(labels), dtype=bool)

        for cls in np.unique(labels):
            cls_mask = labels == cls
            cls_features = features[cls_mask]

            if len(cls_features) < 10:
                continue

            clf = IsolationForest(contamination=contamination, random_state=42)
            predictions = clf.fit_predict(cls_features)

            # -1 = anomaly, 1 = normal
            cls_anomalies = predictions == -1
            anomaly_indices = np.where(cls_mask)[0][cls_anomalies]
            anomaly_mask[anomaly_indices] = True

        logger.info(
            'Label anomaly detection: %d/%d samples flagged (%.1f%%)',
            anomaly_mask.sum(), len(labels),
            100 * anomaly_mask.sum() / len(labels),
        )

        return anomaly_mask
```

---

## Model Integrity and Supply Chain Security

### Model Signing and Verification

```python
# src/ml_security/integrity/model_signing.py

import hashlib
import json
import os
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Optional
import hmac
import logging

logger = logging.getLogger(__name__)


@dataclass
class ModelSignature:
    model_name: str
    model_version: str
    model_hash: str          # SHA-256 of model weights file
    config_hash: str         # SHA-256 of model config/architecture
    signed_by: str           # Identity of signer
    signed_at: str           # ISO timestamp
    framework: str           # e.g., 'pytorch', 'tensorflow', 'sklearn'
    training_data_hash: str  # Hash of training dataset
    hmac_signature: str      # HMAC of all above fields


class ModelSigner:
    """
    Sign and verify ML model artifacts for supply chain security.

    Provides tamper detection for model files downloaded from registries
    (HuggingFace, MLflow, custom registries) or transferred between
    environments.
    """

    def __init__(self, signing_key: str):
        self.signing_key = signing_key.encode('utf-8')

    def sign_model(
        self,
        model_path: str,
        model_name: str,
        model_version: str,
        framework: str,
        config_path: Optional[str] = None,
        training_data_path: Optional[str] = None,
        signer_identity: str = 'unknown',
    ) -> ModelSignature:
        """Sign a model file and produce a signature."""
        # Hash model weights
        model_hash = self._compute_file_hash(model_path)

        # Hash config if provided
        config_hash = ''
        if config_path and os.path.exists(config_path):
            config_hash = self._compute_file_hash(config_path)

        # Hash training data if provided
        training_data_hash = ''
        if training_data_path and os.path.exists(training_data_path):
            training_data_hash = self._compute_file_hash(training_data_path)

        # Create signature fields
        signed_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

        # Compute HMAC over all fields
        message = f"{model_name}|{model_version}|{model_hash}|{config_hash}|{signer_identity}|{signed_at}|{framework}|{training_data_hash}"
        hmac_sig = hmac.new(
            self.signing_key, message.encode('utf-8'), hashlib.sha256
        ).hexdigest()

        signature = ModelSignature(
            model_name=model_name,
            model_version=model_version,
            model_hash=model_hash,
            config_hash=config_hash,
            signed_by=signer_identity,
            signed_at=signed_at,
            framework=framework,
            training_data_hash=training_data_hash,
            hmac_signature=hmac_sig,
        )

        logger.info(
            'Model signed: %s v%s, hash=%s',
            model_name, model_version, model_hash[:16],
        )

        return signature

    def verify_signature(
        self,
        model_path: str,
        signature: ModelSignature,
    ) -> Dict[str, bool]:
        """Verify a model against its signature."""
        results = {}

        # Verify model hash
        current_hash = self._compute_file_hash(model_path)
        results['model_hash_match'] = current_hash == signature.model_hash

        # Verify HMAC
        message = (
            f"{signature.model_name}|{signature.model_version}|"
            f"{signature.model_hash}|{signature.config_hash}|"
            f"{signature.signed_by}|{signature.signed_at}|"
            f"{signature.framework}|{signature.training_data_hash}"
        )
        expected_hmac = hmac.new(
            self.signing_key, message.encode('utf-8'), hashlib.sha256
        ).hexdigest()
        results['hmac_valid'] = hmac.compare_digest(
            expected_hmac, signature.hmac_signature
        )

        results['overall_valid'] = all(results.values())

        if not results['overall_valid']:
            logger.critical(
                'Model signature verification FAILED for %s v%s: %s',
                signature.model_name, signature.model_version, results,
            )
        else:
            logger.info(
                'Model signature verified: %s v%s',
                signature.model_name, signature.model_version,
            )

        return results

    def save_signature(self, signature: ModelSignature, output_path: str) -> None:
        """Save signature to a JSON file."""
        with open(output_path, 'w') as f:
            json.dump(asdict(signature), f, indent=2)

    def load_signature(self, signature_path: str) -> ModelSignature:
        """Load signature from a JSON file."""
        with open(signature_path, 'r') as f:
            data = json.load(f)
        return ModelSignature(**data)

    @staticmethod
    def _compute_file_hash(file_path: str) -> str:
        """Compute SHA-256 hash of a file."""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
```

### Model Provenance with MLflow

```python
# src/ml_security/integrity/model_provenance.py

import mlflow
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class SecureModelRegistry:
    """
    Secure model registration with provenance tracking using MLflow.

    Tracks the full lineage of a model: training data, code version,
    hyperparameters, environment, and all intermediate artifacts.
    """

    @staticmethod
    def register_model_with_provenance(
        model: Any,
        model_name: str,
        training_data_path: str,
        code_version: str,
        hyperparameters: Dict[str, Any],
        metrics: Dict[str, float],
        signer_identity: str,
    ) -> str:
        """Register a model with full provenance metadata."""
        with mlflow.start_run() as run:
            # Log hyperparameters
            mlflow.log_params(hyperparameters)

            # Log metrics
            mlflow.log_metrics(metrics)

            # Log provenance metadata
            provenance = {
                'training_data_path': training_data_path,
                'training_data_hash': _compute_hash(training_data_path),
                'code_version': code_version,
                'trained_by': signer_identity,
                'trained_at': datetime.now(timezone.utc).isoformat(),
                'framework_versions': _get_framework_versions(),
            }

            mlflow.log_dict(provenance, 'provenance.json')

            # Log the model
            mlflow.sklearn.log_model(
                model,
                artifact_path='model',
                registered_model_name=model_name,
            )

            # Tag with security metadata
            mlflow.set_tag('security.signed_by', signer_identity)
            mlflow.set_tag('security.provenance_verified', 'true')
            mlflow.set_tag('security.code_version', code_version)

            return run.info.run_id

    @staticmethod
    def verify_model_provenance(run_id: str) -> Dict[str, Any]:
        """Verify the provenance chain of a registered model."""
        run = mlflow.get_run(run_id)

        verification = {
            'run_id': run_id,
            'model_name': run.data.tags.get('mlflow.runName', 'unknown'),
            'signed_by': run.data.tags.get('security.signed_by', 'unknown'),
            'code_version': run.data.tags.get('security.code_version', 'unknown'),
            'provenance_verified': run.data.tags.get(
                'security.provenance_verified', 'false'
            ) == 'true',
            'parameters': dict(run.data.params),
            'metrics': dict(run.data.metrics),
            'start_time': run.info.start_time,
            'end_time': run.info.end_time,
        }

        return verification


def _compute_hash(file_path: str) -> str:
    sha256 = hashlib.sha256()
    try:
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    except FileNotFoundError:
        return 'FILE_NOT_FOUND'


def _get_framework_versions() -> Dict[str, str]:
    versions = {}
    try:
        import torch
        versions['pytorch'] = torch.__version__
    except ImportError:
        pass
    try:
        import sklearn
        versions['scikit-learn'] = sklearn.__version__
    except ImportError:
        pass
    try:
        import numpy
        versions['numpy'] = numpy.__version__
    except ImportError:
        pass
    return versions
```

---

## Inference Security

### Model Input Validation

```python
# src/ml_security/inference/input_validator.py

import numpy as np
import torch
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Union


@dataclass
class InputValidationResult:
    is_valid: bool
    issues: List[str]
    sanitized_input: Optional[np.ndarray] = None


class ModelInputValidator:
    """
    Validate and sanitize inputs before model inference.

    Defends against:
    - Out-of-distribution inputs
    - Adversarial inputs
    - Malformed inputs
    - Inputs designed to cause model errors (NaN, Inf)
    """

    def __init__(
        self,
        expected_shape: Tuple[int, ...],
        feature_ranges: Optional[Dict[int, Tuple[float, float]]] = None,
        expected_dtypes: Optional[List[str]] = None,
    ):
        self.expected_shape = expected_shape
        self.feature_ranges = feature_ranges or {}
        self.expected_dtypes = expected_dtypes or ['float32', 'float64']

    def validate(self, input_data: Union[np.ndarray, torch.Tensor]) -> InputValidationResult:
        """Validate a model input."""
        issues: List[str] = []

        # Convert torch tensor to numpy for validation
        if isinstance(input_data, torch.Tensor):
            input_data = input_data.detach().cpu().numpy()

        # Check 1: Data type
        if str(input_data.dtype) not in self.expected_dtypes:
            issues.append(f'Unexpected dtype: {input_data.dtype}')

        # Check 2: Shape (ignoring batch dimension)
        input_shape = input_data.shape[1:] if len(input_data.shape) > len(self.expected_shape) else input_data.shape
        if input_shape != self.expected_shape:
            issues.append(
                f'Shape mismatch: expected {self.expected_shape}, got {input_shape}'
            )

        # Check 3: NaN and Inf values
        if np.any(np.isnan(input_data)):
            issues.append('Input contains NaN values')

        if np.any(np.isinf(input_data)):
            issues.append('Input contains Inf values')

        # Check 4: Feature range validation
        sanitized = input_data.copy()
        for feature_idx, (min_val, max_val) in self.feature_ranges.items():
            if feature_idx < input_data.shape[-1]:
                values = input_data[..., feature_idx]
                if np.any(values < min_val) or np.any(values > max_val):
                    issues.append(
                        f'Feature {feature_idx} out of range '
                        f'[{min_val}, {max_val}]'
                    )
                    # Clip to valid range
                    sanitized[..., feature_idx] = np.clip(values, min_val, max_val)

        # Check 5: Statistical outlier detection
        if len(input_data.shape) >= 2:
            for feature_idx in range(min(input_data.shape[-1], 100)):
                values = input_data[..., feature_idx].flatten()
                if len(values) > 0:
                    mean = np.mean(values)
                    std = np.std(values)
                    if std > 0:
                        z_scores = np.abs((values - mean) / std)
                        if np.any(z_scores > 10):
                            issues.append(
                                f'Feature {feature_idx}: extreme values detected '
                                f'(max z-score: {z_scores.max():.1f})'
                            )

        return InputValidationResult(
            is_valid=len(issues) == 0,
            issues=issues,
            sanitized_input=sanitized if issues else None,
        )
```

### Output Filtering and Confidence Thresholds

```python
# src/ml_security/inference/output_filter.py

import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


@dataclass
class FilteredPrediction:
    predicted_class: Optional[int]
    confidence: float
    is_reliable: bool
    rejection_reason: Optional[str]
    all_probabilities: Dict[int, float]


class PredictionOutputFilter:
    """
    Filter and validate model predictions before returning to the caller.

    Applies:
    - Confidence thresholds (reject low-confidence predictions)
    - Consistency checks (detect adversarial indicators)
    - Class-specific thresholds (higher confidence for high-impact decisions)
    """

    def __init__(
        self,
        default_threshold: float = 0.5,
        class_thresholds: Optional[Dict[int, float]] = None,
        max_entropy_threshold: float = 0.8,
    ):
        self.default_threshold = default_threshold
        self.class_thresholds = class_thresholds or {}
        self.max_entropy_threshold = max_entropy_threshold

    def filter_prediction(
        self,
        probabilities: np.ndarray,
    ) -> FilteredPrediction:
        """Filter a single prediction based on confidence and consistency."""
        # Ensure valid probability distribution
        probs = np.clip(probabilities, 1e-10, 1.0)
        probs = probs / probs.sum()

        predicted_class = int(np.argmax(probs))
        confidence = float(probs[predicted_class])

        # Build probabilities dict
        all_probs = {i: float(p) for i, p in enumerate(probs)}

        # Check 1: Minimum confidence threshold
        threshold = self.class_thresholds.get(predicted_class, self.default_threshold)
        if confidence < threshold:
            return FilteredPrediction(
                predicted_class=None,
                confidence=confidence,
                is_reliable=False,
                rejection_reason=f'Below confidence threshold ({confidence:.3f} < {threshold})',
                all_probabilities=all_probs,
            )

        # Check 2: Prediction entropy (uncertainty measure)
        entropy = -np.sum(probs * np.log(probs))
        max_entropy = np.log(len(probs))
        normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0

        if normalized_entropy > self.max_entropy_threshold:
            return FilteredPrediction(
                predicted_class=None,
                confidence=confidence,
                is_reliable=False,
                rejection_reason=f'High prediction entropy ({normalized_entropy:.3f})',
                all_probabilities=all_probs,
            )

        # Check 3: Margin between top two predictions
        sorted_probs = np.sort(probs)[::-1]
        margin = sorted_probs[0] - sorted_probs[1] if len(sorted_probs) > 1 else 1.0

        if margin < 0.1:
            return FilteredPrediction(
                predicted_class=predicted_class,
                confidence=confidence,
                is_reliable=False,
                rejection_reason=f'Low margin between top predictions ({margin:.3f})',
                all_probabilities=all_probs,
            )

        return FilteredPrediction(
            predicted_class=predicted_class,
            confidence=confidence,
            is_reliable=True,
            rejection_reason=None,
            all_probabilities=all_probs,
        )
```

---

## Model Privacy

### Membership Inference Defense

```python
# src/ml_security/privacy/membership_defense.py

import numpy as np
import torch
import torch.nn as nn
from typing import Dict, Tuple


class MembershipInferenceDefense:
    """
    Defend against membership inference attacks.

    Membership inference attacks determine whether a specific data point
    was used in the model's training set. This can reveal sensitive
    information about the training data composition.

    Defenses:
    1. Output perturbation (add noise to predictions)
    2. Confidence masking (reduce prediction precision)
    3. Regularization (prevent overfitting that enables inference)
    4. Differential privacy in training
    """

    @staticmethod
    def perturb_output(
        probabilities: np.ndarray,
        noise_scale: float = 0.05,
    ) -> np.ndarray:
        """
        Add calibrated noise to prediction probabilities.

        Reduces the information available for membership inference while
        maintaining prediction utility.
        """
        noised = probabilities + np.random.laplace(
            loc=0.0, scale=noise_scale, size=probabilities.shape
        )
        # Ensure valid probability distribution
        noised = np.clip(noised, 0.0, 1.0)
        noised = noised / noised.sum(axis=-1, keepdims=True)
        return noised

    @staticmethod
    def mask_confidence(
        probabilities: np.ndarray,
        precision: int = 2,
    ) -> np.ndarray:
        """
        Reduce the precision of output probabilities.

        Membership inference often relies on subtle differences in confidence
        scores. Reducing precision limits this information leakage.
        """
        rounded = np.round(probabilities, decimals=precision)
        # Re-normalize
        rounded = rounded / rounded.sum(axis=-1, keepdims=True)
        return rounded

    @staticmethod
    def top_k_only(
        probabilities: np.ndarray,
        k: int = 3,
    ) -> Dict[int, float]:
        """
        Return only top-k class probabilities.

        Prevents attackers from observing the full probability distribution,
        which contains more information for membership inference.
        """
        top_indices = np.argsort(probabilities)[::-1][:k]
        return {int(idx): float(probabilities[idx]) for idx in top_indices}
```

### Differential Privacy in Training

```python
# src/ml_security/privacy/dp_training.py

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class DPSGDTrainer:
    """
    Differentially Private Stochastic Gradient Descent (DP-SGD) trainer.

    Provides formal privacy guarantees by:
    1. Clipping per-sample gradients to bound sensitivity
    2. Adding calibrated Gaussian noise to clipped gradients
    3. Tracking privacy budget (epsilon) throughout training

    Uses the Opacus library concepts for practical implementation.
    """

    def __init__(
        self,
        model: nn.Module,
        max_grad_norm: float = 1.0,
        noise_multiplier: float = 1.0,
        delta: float = 1e-5,
    ):
        """
        Args:
            model: The model to train with DP.
            max_grad_norm: Maximum L2 norm for per-sample gradient clipping.
            noise_multiplier: Standard deviation of noise = noise_multiplier * max_grad_norm.
            delta: Target delta for (epsilon, delta)-differential privacy.
        """
        self.model = model
        self.max_grad_norm = max_grad_norm
        self.noise_multiplier = noise_multiplier
        self.delta = delta
        self.steps_taken = 0

    def train_step(
        self,
        inputs: torch.Tensor,
        labels: torch.Tensor,
        optimizer: torch.optim.Optimizer,
        criterion: nn.Module,
    ) -> float:
        """Execute one DP-SGD training step."""
        self.model.train()
        batch_size = inputs.size(0)

        # Compute per-sample gradients
        optimizer.zero_grad()
        outputs = self.model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()

        # Clip gradients per-sample (simplified; use Opacus for production)
        total_norm = torch.nn.utils.clip_grad_norm_(
            self.model.parameters(), self.max_grad_norm
        )

        # Add Gaussian noise to gradients
        for param in self.model.parameters():
            if param.grad is not None:
                noise = torch.normal(
                    mean=0,
                    std=self.noise_multiplier * self.max_grad_norm / batch_size,
                    size=param.grad.shape,
                    device=param.grad.device,
                )
                param.grad += noise

        optimizer.step()
        self.steps_taken += 1

        return loss.item()

    def get_epsilon(self, sample_rate: float) -> float:
        """
        Estimate current privacy budget (epsilon) spent.

        This is a simplified estimate. Use Opacus or TensorFlow Privacy
        for precise privacy accounting.
        """
        import math

        if self.steps_taken == 0:
            return 0.0

        # Simplified privacy accounting (use RDP accountant in production)
        q = sample_rate  # Sampling probability
        sigma = self.noise_multiplier
        T = self.steps_taken

        # Basic composition bound (use tight RDP bounds in production)
        epsilon = q * math.sqrt(2 * T * math.log(1 / self.delta)) / sigma

        return epsilon
```

---

## Model Bias and Fairness as Security Concern

### Bias Detection and Fairness Testing

```python
# src/ml_security/fairness/bias_detector.py

import numpy as np
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class FairnessMetrics:
    demographic_parity_ratio: float
    equalized_odds_ratio: float
    predictive_parity_ratio: float
    group_accuracies: Dict[str, float]
    group_sizes: Dict[str, int]
    is_fair: bool
    violations: List[str] = field(default_factory=list)


class BiasDetector:
    """
    Detect bias in ML model predictions as a security concern.

    Biased models can cause discriminatory harm, regulatory violations,
    reputational damage, and systematic errors for certain populations.
    These are security concerns because they represent a failure of the
    model to perform safely and equitably.
    """

    def __init__(
        self,
        fairness_threshold: float = 0.8,  # 80% rule (4/5ths rule)
    ):
        self.fairness_threshold = fairness_threshold

    def evaluate_fairness(
        self,
        predictions: np.ndarray,
        labels: np.ndarray,
        protected_attribute: np.ndarray,
        group_names: Optional[Dict[Any, str]] = None,
    ) -> FairnessMetrics:
        """
        Evaluate model fairness across groups defined by a protected attribute.
        """
        violations: List[str] = []
        unique_groups = np.unique(protected_attribute)
        group_names = group_names or {g: str(g) for g in unique_groups}

        # Per-group metrics
        group_positive_rates: Dict[str, float] = {}
        group_accuracies: Dict[str, float] = {}
        group_tprs: Dict[str, float] = {}
        group_fprs: Dict[str, float] = {}
        group_ppvs: Dict[str, float] = {}
        group_sizes: Dict[str, int] = {}

        for group in unique_groups:
            mask = protected_attribute == group
            name = group_names.get(group, str(group))

            g_preds = predictions[mask]
            g_labels = labels[mask]
            group_sizes[name] = int(mask.sum())

            # Positive rate (for demographic parity)
            group_positive_rates[name] = g_preds.mean()

            # Accuracy
            group_accuracies[name] = (g_preds == g_labels).mean()

            # True positive rate (for equalized odds)
            positives = g_labels == 1
            if positives.sum() > 0:
                group_tprs[name] = g_preds[positives].mean()
            else:
                group_tprs[name] = 0.0

            # False positive rate
            negatives = g_labels == 0
            if negatives.sum() > 0:
                group_fprs[name] = g_preds[negatives].mean()
            else:
                group_fprs[name] = 0.0

            # Positive predictive value (for predictive parity)
            predicted_pos = g_preds == 1
            if predicted_pos.sum() > 0:
                group_ppvs[name] = g_labels[predicted_pos].mean()
            else:
                group_ppvs[name] = 0.0

        # Demographic Parity: ratio of positive rates between groups
        pos_rates = list(group_positive_rates.values())
        dp_ratio = min(pos_rates) / max(pos_rates) if max(pos_rates) > 0 else 1.0

        if dp_ratio < self.fairness_threshold:
            violations.append(
                f'Demographic parity violation: ratio={dp_ratio:.3f} '
                f'(threshold: {self.fairness_threshold})'
            )

        # Equalized Odds: ratio of TPR between groups
        tpr_values = [v for v in group_tprs.values() if v > 0]
        eo_ratio = min(tpr_values) / max(tpr_values) if tpr_values and max(tpr_values) > 0 else 1.0

        if eo_ratio < self.fairness_threshold:
            violations.append(
                f'Equalized odds violation: TPR ratio={eo_ratio:.3f}'
            )

        # Predictive Parity: ratio of PPV between groups
        ppv_values = [v for v in group_ppvs.values() if v > 0]
        pp_ratio = min(ppv_values) / max(ppv_values) if ppv_values and max(ppv_values) > 0 else 1.0

        if pp_ratio < self.fairness_threshold:
            violations.append(
                f'Predictive parity violation: PPV ratio={pp_ratio:.3f}'
            )

        return FairnessMetrics(
            demographic_parity_ratio=dp_ratio,
            equalized_odds_ratio=eo_ratio,
            predictive_parity_ratio=pp_ratio,
            group_accuracies=group_accuracies,
            group_sizes=group_sizes,
            is_fair=len(violations) == 0,
            violations=violations,
        )
```

---

## Secure Model Deployment

### Model Encryption at Rest

```python
# src/ml_security/deployment/model_encryption.py

import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class ModelEncryptor:
    """
    Encrypt model files at rest to protect intellectual property
    and prevent unauthorized access to model weights.
    """

    def __init__(self, encryption_key: Optional[bytes] = None):
        if encryption_key is None:
            self.key = AESGCM.generate_key(bit_length=256)
        else:
            if len(encryption_key) != 32:
                raise ValueError("Key must be 32 bytes for AES-256")
            self.key = encryption_key

    def encrypt_model(self, model_path: str, output_path: str) -> dict:
        """Encrypt a model file using AES-256-GCM."""
        nonce = os.urandom(12)
        aesgcm = AESGCM(self.key)

        with open(model_path, 'rb') as f:
            plaintext = f.read()

        ciphertext = aesgcm.encrypt(nonce, plaintext, None)

        # Write nonce + ciphertext
        with open(output_path, 'wb') as f:
            f.write(nonce)
            f.write(ciphertext)

        logger.info('Model encrypted: %s -> %s', model_path, output_path)

        return {
            'original_size': len(plaintext),
            'encrypted_size': len(nonce) + len(ciphertext),
            'algorithm': 'AES-256-GCM',
        }

    def decrypt_model(self, encrypted_path: str, output_path: str) -> None:
        """Decrypt an encrypted model file."""
        with open(encrypted_path, 'rb') as f:
            data = f.read()

        nonce = data[:12]
        ciphertext = data[12:]

        aesgcm = AESGCM(self.key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)

        with open(output_path, 'wb') as f:
            f.write(plaintext)

        logger.info('Model decrypted: %s -> %s', encrypted_path, output_path)

    def decrypt_to_memory(self, encrypted_path: str) -> bytes:
        """Decrypt model directly to memory (avoid writing plaintext to disk)."""
        with open(encrypted_path, 'rb') as f:
            data = f.read()

        nonce = data[:12]
        ciphertext = data[12:]

        aesgcm = AESGCM(self.key)
        return aesgcm.decrypt(nonce, ciphertext, None)
```

---

## Model Monitoring

### Drift Detection and Adversarial Input Detection

```python
# src/ml_security/monitoring/model_monitor.py

import numpy as np
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class MonitoringAlert:
    alert_type: str
    severity: str
    timestamp: str
    detail: str
    metrics: Dict


class ModelSecurityMonitor:
    """
    Runtime security monitoring for deployed ML models.

    Monitors for:
    1. Data drift (input distribution changes)
    2. Concept drift (prediction distribution changes)
    3. Performance degradation
    4. Adversarial input detection
    5. Extraction attack patterns
    """

    def __init__(
        self,
        feature_dim: int,
        num_classes: int,
        window_size: int = 1000,
    ):
        self.feature_dim = feature_dim
        self.num_classes = num_classes
        self.window_size = window_size

        # Baseline statistics (set during calibration)
        self.baseline_feature_means: Optional[np.ndarray] = None
        self.baseline_feature_stds: Optional[np.ndarray] = None
        self.baseline_prediction_dist: Optional[np.ndarray] = None
        self.baseline_confidence_mean: Optional[float] = None
        self.baseline_confidence_std: Optional[float] = None

        # Rolling windows
        self.recent_inputs: Deque[np.ndarray] = deque(maxlen=window_size)
        self.recent_predictions: Deque[int] = deque(maxlen=window_size)
        self.recent_confidences: Deque[float] = deque(maxlen=window_size)

    def calibrate(
        self,
        calibration_inputs: np.ndarray,
        calibration_predictions: np.ndarray,
        calibration_confidences: np.ndarray,
    ) -> None:
        """Set baseline statistics from calibration data."""
        self.baseline_feature_means = np.mean(calibration_inputs, axis=0)
        self.baseline_feature_stds = np.std(calibration_inputs, axis=0) + 1e-10

        pred_counts = np.bincount(calibration_predictions, minlength=self.num_classes)
        self.baseline_prediction_dist = pred_counts / pred_counts.sum()

        self.baseline_confidence_mean = float(np.mean(calibration_confidences))
        self.baseline_confidence_std = float(np.std(calibration_confidences))

        logger.info(
            'Monitor calibrated with %d samples. Baseline confidence: %.3f +/- %.3f',
            len(calibration_inputs),
            self.baseline_confidence_mean,
            self.baseline_confidence_std,
        )

    def record_prediction(
        self,
        input_features: np.ndarray,
        predicted_class: int,
        confidence: float,
    ) -> List[MonitoringAlert]:
        """Record a prediction and check for anomalies."""
        alerts: List[MonitoringAlert] = []
        now = datetime.now(timezone.utc).isoformat()

        self.recent_inputs.append(input_features.flatten())
        self.recent_predictions.append(predicted_class)
        self.recent_confidences.append(confidence)

        # Check 1: Data drift
        if self.baseline_feature_means is not None and len(self.recent_inputs) >= 100:
            drift_alert = self._check_data_drift(now)
            if drift_alert:
                alerts.append(drift_alert)

        # Check 2: Prediction distribution shift
        if self.baseline_prediction_dist is not None and len(self.recent_predictions) >= 100:
            pred_alert = self._check_prediction_drift(now)
            if pred_alert:
                alerts.append(pred_alert)

        # Check 3: Confidence anomaly
        if self.baseline_confidence_mean is not None:
            conf_alert = self._check_confidence_anomaly(confidence, now)
            if conf_alert:
                alerts.append(conf_alert)

        # Check 4: Adversarial input detection (individual input)
        adv_alert = self._check_adversarial_indicators(input_features, confidence, now)
        if adv_alert:
            alerts.append(adv_alert)

        return alerts

    def _check_data_drift(self, timestamp: str) -> Optional[MonitoringAlert]:
        """Detect data drift using Population Stability Index (PSI)."""
        recent = np.array(list(self.recent_inputs))
        recent_means = np.mean(recent, axis=0)

        # Normalized mean shift
        shift = np.abs(
            (recent_means - self.baseline_feature_means) / self.baseline_feature_stds
        )
        avg_shift = float(np.mean(shift))

        if avg_shift > 2.0:
            return MonitoringAlert(
                alert_type='data_drift',
                severity='high' if avg_shift > 3.0 else 'medium',
                timestamp=timestamp,
                detail=f'Input distribution drift detected (avg z-shift: {avg_shift:.2f})',
                metrics={'average_z_shift': avg_shift},
            )
        return None

    def _check_prediction_drift(self, timestamp: str) -> Optional[MonitoringAlert]:
        """Detect prediction distribution shift."""
        recent_preds = np.array(list(self.recent_predictions))
        recent_dist = np.bincount(recent_preds, minlength=self.num_classes)
        recent_dist = recent_dist / recent_dist.sum()

        # KL divergence
        kl_div = 0.0
        for i in range(self.num_classes):
            if recent_dist[i] > 0 and self.baseline_prediction_dist[i] > 0:
                kl_div += recent_dist[i] * np.log(
                    recent_dist[i] / self.baseline_prediction_dist[i]
                )

        if kl_div > 0.5:
            return MonitoringAlert(
                alert_type='prediction_drift',
                severity='high' if kl_div > 1.0 else 'medium',
                timestamp=timestamp,
                detail=f'Prediction distribution shift (KL divergence: {kl_div:.3f})',
                metrics={
                    'kl_divergence': kl_div,
                    'current_distribution': recent_dist.tolist(),
                    'baseline_distribution': self.baseline_prediction_dist.tolist(),
                },
            )
        return None

    def _check_confidence_anomaly(
        self, confidence: float, timestamp: str,
    ) -> Optional[MonitoringAlert]:
        """Detect unusually low confidence that may indicate adversarial input."""
        z_score = abs(
            (confidence - self.baseline_confidence_mean) / (self.baseline_confidence_std + 1e-10)
        )

        if z_score > 3.0 and confidence < self.baseline_confidence_mean:
            return MonitoringAlert(
                alert_type='confidence_anomaly',
                severity='medium',
                timestamp=timestamp,
                detail=f'Unusually low confidence: {confidence:.3f} (z-score: {z_score:.1f})',
                metrics={'confidence': confidence, 'z_score': z_score},
            )
        return None

    def _check_adversarial_indicators(
        self,
        input_features: np.ndarray,
        confidence: float,
        timestamp: str,
    ) -> Optional[MonitoringAlert]:
        """Detect indicators of adversarial inputs."""
        if self.baseline_feature_means is None:
            return None

        flat = input_features.flatten()
        if len(flat) != len(self.baseline_feature_means):
            return None

        # Feature-level anomaly: many features at extreme z-scores
        z_scores = np.abs(
            (flat - self.baseline_feature_means) / self.baseline_feature_stds
        )
        extreme_features = np.sum(z_scores > 4.0)
        extreme_ratio = extreme_features / len(z_scores)

        # High number of extreme features with low confidence = likely adversarial
        if extreme_ratio > 0.3 and confidence < 0.7:
            return MonitoringAlert(
                alert_type='adversarial_input',
                severity='high',
                timestamp=timestamp,
                detail=(
                    f'Potential adversarial input: {extreme_ratio:.1%} features are extreme, '
                    f'confidence={confidence:.3f}'
                ),
                metrics={
                    'extreme_feature_ratio': extreme_ratio,
                    'confidence': confidence,
                    'max_z_score': float(z_scores.max()),
                },
            )
        return None
```

---

## NIST AI Risk Management Framework

The NIST AI Risk Management Framework (AI RMF 1.0) provides a structured approach to
managing AI risks. Key functions and their security relevance:

```
NIST AI RMF Core Functions
============================

1. GOVERN
   - Establish AI risk management policies
   - Define roles and responsibilities for AI security
   - Integrate AI risk into enterprise risk management
   - Ensure third-party AI model governance

2. MAP
   - Identify AI system context and intended purpose
   - Document potential harms (to individuals, groups, organizations)
   - Assess data privacy and security risks
   - Map dependencies and supply chain risks

3. MEASURE
   - Quantify AI system performance across demographics (fairness)
   - Test adversarial robustness
   - Measure model drift and degradation
   - Evaluate privacy guarantees (membership inference, model inversion)

4. MANAGE
   - Implement controls based on risk assessment
   - Monitor AI systems in production
   - Maintain incident response procedures for AI failures
   - Support human oversight and intervention capabilities

Implementation Priority for Security Teams:
---------------------------------------------
P0 (Immediate): Model integrity verification, inference API security,
                 input validation, output filtering
P1 (Near-term):  Adversarial robustness testing, extraction detection,
                 training data validation, fairness evaluation
P2 (Ongoing):    Drift monitoring, privacy assessment, bias detection,
                 supply chain audit, compliance documentation
```

---

## Best Practices

### 1. Sign and Verify All Model Artifacts
Compute cryptographic hashes of model weights, configurations, and training data. Verify
signatures before deploying models. Treat unsigned models as untrusted.

### 2. Test Adversarial Robustness Before Deployment
Run comprehensive robustness assessments (FGSM, PGD, boundary probing) before deploying
any model to production. Set minimum robustness thresholds.

### 3. Validate Training Data for Poisoning
Scan training datasets for anomalies, mislabeled samples, and potential backdoor triggers.
Maintain dataset integrity with cryptographic fingerprints.

### 4. Rate Limit and Monitor Inference APIs
Implement rate limiting designed to prevent model extraction. Monitor query patterns for
systematic probing, boundary exploration, and perturbation attacks.

### 5. Apply Differential Privacy for Sensitive Training Data
When training on sensitive data, use DP-SGD or equivalent techniques to provide formal
privacy guarantees. Track and enforce privacy budget limits.

### 6. Filter and Validate Model Outputs
Apply confidence thresholds, entropy checks, and class-specific thresholds. Never return
raw probabilities when prediction labels suffice.

### 7. Evaluate Fairness Across Protected Groups
Test model predictions for demographic parity, equalized odds, and predictive parity.
Treat fairness violations as security findings that require remediation.

### 8. Encrypt Models at Rest and In Transit
Use AES-256-GCM or equivalent for encrypting model files. Decrypt to memory when possible
to avoid writing plaintext weights to disk.

### 9. Implement Continuous Model Monitoring
Deploy runtime monitoring for data drift, prediction distribution shift, confidence
anomalies, and adversarial input indicators. Alert on deviations from baseline.

### 10. Follow NIST AI RMF for Governance
Use the NIST AI Risk Management Framework to structure AI security governance, risk
assessment, measurement, and ongoing management.

---

## Anti-Patterns

### 1. Deploying Models Without Robustness Testing
Pushing models to production without adversarial robustness assessment. Even models with
high accuracy can be completely defeated by minimal adversarial perturbations.

### 2. Returning Full Probability Distributions
Exposing detailed probability vectors through inference APIs when only class labels are
needed. Full probabilities enable model extraction and membership inference attacks.

### 3. Using Unverified Models from Public Registries
Downloading and deploying models from HuggingFace or other registries without verifying
integrity, provenance, or scanning for backdoors.

### 4. Training Without Data Validation
Using training datasets without checking for poisoning, label manipulation, or
adversarial contamination. Poisoned training data creates permanently vulnerable models.

### 5. Ignoring Model Fairness
Treating fairness testing as optional or cosmetic. Biased models create systematic harm,
regulatory liability, and reputational damage.

### 6. Static Model Deployment Without Monitoring
Deploying models and never monitoring for drift, degradation, or adversarial inputs.
Model performance degrades over time as data distributions change.

### 7. No Rate Limiting on Inference APIs
Exposing model inference endpoints without rate limiting, enabling model extraction
through systematic querying.

### 8. Training on Sensitive Data Without Privacy Controls
Using personally identifiable or confidential data for model training without differential
privacy, data anonymization, or membership inference defense.

---

## Enforcement Checklist

### Model Development

- [ ] Training data validated for poisoning indicators and anomalies
- [ ] Label quality verified with outlier detection
- [ ] Data provenance documented (source, collection method, preprocessing)
- [ ] Differential privacy applied when training on sensitive data
- [ ] Fairness evaluated across protected demographic groups
- [ ] Adversarial robustness tested at multiple perturbation levels
- [ ] Model watermarked for ownership verification

### Model Integrity

- [ ] Model weights signed with cryptographic hash
- [ ] Model configuration signed and versioned
- [ ] Training data fingerprint recorded
- [ ] Model provenance tracked (MLflow or equivalent)
- [ ] Models from external registries verified before deployment
- [ ] Supply chain for model dependencies audited

### Inference Security

- [ ] Input validation enforced (shape, type, range, NaN/Inf checks)
- [ ] Rate limiting on inference API configured
- [ ] Output filtering with confidence thresholds implemented
- [ ] Probabilities masked or limited to top-k when full distribution not needed
- [ ] Model endpoint authenticated and authorized
- [ ] Extraction detection monitoring active

### Model Privacy

- [ ] Membership inference risk assessed
- [ ] Model inversion risk assessed
- [ ] Prediction outputs perturbed or precision-limited if privacy sensitive
- [ ] Privacy budget tracked for DP-trained models
- [ ] Training data retention and deletion policies in place

### Deployment Security

- [ ] Model encrypted at rest
- [ ] Model encrypted in transit (TLS)
- [ ] Model decrypted to memory (not disk) when possible
- [ ] Deployment infrastructure hardened (container security, network isolation)
- [ ] Rollback capability available for model versions
- [ ] Incident response plan covers model security scenarios

### Runtime Monitoring

- [ ] Data drift detection calibrated and active
- [ ] Prediction distribution monitoring active
- [ ] Confidence anomaly detection running
- [ ] Adversarial input detection enabled
- [ ] Model performance metrics tracked continuously
- [ ] Automated alerting for security-relevant anomalies
- [ ] Extraction pattern detection monitoring query logs
- [ ] Model performance degradation triggers investigation
