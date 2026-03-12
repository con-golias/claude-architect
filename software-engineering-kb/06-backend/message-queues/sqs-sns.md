# AWS SQS & SNS

> **AI Plugin Directive — SQS Queue Operations, SNS Fan-Out & Event Bus Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring SQS/SNS code,
> follow EVERY rule in this document. Incorrect SQS configuration causes message loss,
> duplicate processing, and invisible failures. Treat each section as non-negotiable.

**Core Rule: ALWAYS configure dead-letter queues for SQS. ALWAYS use FIFO queues when ordering matters. ALWAYS delete messages after successful processing. ALWAYS use SNS for fan-out to multiple consumers. ALWAYS set visibility timeout > processing time.**

---

## 1. SQS + SNS Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              SNS → SQS Fan-Out Pattern                        │
│                                                               │
│  Producer → SNS Topic "order-events"                        │
│             ├── SQS "order-processor" (main processing)     │
│             ├── SQS "notification-sender" (send emails)     │
│             └── SQS "analytics-ingestor" (data pipeline)    │
│                                                               │
│  Each SQS queue:                                             │
│  ├── Independent consumer (scales separately)               │
│  ├── Own dead-letter queue                                  │
│  ├── Own retry policy                                       │
│  └── Own visibility timeout                                 │
│                                                               │
│  Standard Queue: at-least-once, best-effort ordering        │
│  FIFO Queue: exactly-once, strict ordering (lower throughput)│
│                                                               │
│  Rule: Use SNS + SQS fan-out instead of multiple publishes  │
│  Rule: Use FIFO only when ordering is required              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation

```typescript
import { SQSClient, SendMessageCommand, ReceiveMessageCommand,
         DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });

// Publish via SNS (fan-out to multiple SQS queues)
async function publishEvent(event: OrderEvent): Promise<void> {
  await sns.send(new PublishCommand({
    TopicArn: process.env.ORDER_TOPIC_ARN,
    Message: JSON.stringify(event),
    MessageAttributes: {
      eventType: { DataType: "String", StringValue: event.type },
    },
    // For FIFO topics:
    // MessageGroupId: event.orderId,
    // MessageDeduplicationId: event.id,
  }));
}

// Consumer: poll SQS queue
async function pollQueue(): Promise<void> {
  while (true) {
    const { Messages } = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: process.env.ORDER_QUEUE_URL,
      MaxNumberOfMessages: 10,       // Batch up to 10
      WaitTimeSeconds: 20,           // Long polling (ALWAYS use)
      VisibilityTimeout: 300,        // 5 min (> processing time)
      MessageAttributeNames: ["All"],
    }));

    if (!Messages?.length) continue;

    for (const message of Messages) {
      try {
        const event = JSON.parse(message.Body!);
        await processOrder(event);

        // Delete after successful processing
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: process.env.ORDER_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        }));
      } catch (error) {
        logger.error("Processing failed", {
          messageId: message.MessageId,
          error: (error as Error).message,
        });
        // Message returns to queue after visibility timeout
      }
    }
  }
}
```

---

## 3. Go Implementation

```go
import (
    "github.com/aws/aws-sdk-go-v2/service/sqs"
    "github.com/aws/aws-sdk-go-v2/service/sns"
)

func PublishEvent(ctx context.Context, snsClient *sns.Client, topicArn string, event any) error {
    body, _ := json.Marshal(event)
    _, err := snsClient.Publish(ctx, &sns.PublishInput{
        TopicArn: aws.String(topicArn),
        Message:  aws.String(string(body)),
    })
    return err
}

func PollQueue(ctx context.Context, sqsClient *sqs.Client, queueURL string, handler func([]byte) error) error {
    for {
        select {
        case <-ctx.Done():
            return nil
        default:
        }

        result, err := sqsClient.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{
            QueueUrl:            aws.String(queueURL),
            MaxNumberOfMessages: 10,
            WaitTimeSeconds:     20, // Long polling
            VisibilityTimeout:   300,
        })
        if err != nil {
            slog.Error("receive error", "error", err)
            continue
        }

        for _, msg := range result.Messages {
            if err := handler([]byte(*msg.Body)); err != nil {
                slog.Error("processing failed", "messageId", *msg.MessageId, "error", err)
                continue
            }

            sqsClient.DeleteMessage(ctx, &sqs.DeleteMessageInput{
                QueueUrl:      aws.String(queueURL),
                ReceiptHandle: msg.ReceiptHandle,
            })
        }
    }
}
```

---

## 4. Python Implementation

```python
import boto3

sqs = boto3.client("sqs")
sns = boto3.client("sns")

def publish_event(topic_arn: str, event: dict) -> None:
    sns.publish(
        TopicArn=topic_arn,
        Message=json.dumps(event),
        MessageAttributes={
            "eventType": {"DataType": "String", "StringValue": event["type"]},
        },
    )

def poll_queue(queue_url: str, handler) -> None:
    while True:
        response = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=10,
            WaitTimeSeconds=20,        # Long polling
            VisibilityTimeout=300,
        )
        for msg in response.get("Messages", []):
            try:
                event = json.loads(msg["Body"])
                handler(event)
                sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=msg["ReceiptHandle"])
            except Exception as e:
                logger.error("Processing failed", extra={"messageId": msg["MessageId"], "error": str(e)})
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Short polling | High API costs, no messages | `WaitTimeSeconds: 20` |
| Visibility timeout < processing time | Message redelivered while processing | Timeout > max processing |
| No DLQ | Failed messages reprocess forever | `maxReceiveCount: 3` + DLQ |
| Delete before processing | Message lost on crash | Delete after success only |
| Standard queue when ordering needed | Out-of-order processing | FIFO queue |
| Direct publish to multiple queues | Partial failure | SNS fan-out pattern |

---

## 6. Enforcement Checklist

- [ ] Long polling configured (`WaitTimeSeconds: 20`)
- [ ] Dead-letter queue with `maxReceiveCount: 3`
- [ ] Visibility timeout > max processing time
- [ ] Messages deleted only after successful processing
- [ ] SNS used for fan-out to multiple consumers
- [ ] FIFO queues used when ordering is required
- [ ] Message deduplication for FIFO (MessageDeduplicationId)
- [ ] Consumer idempotency implemented
