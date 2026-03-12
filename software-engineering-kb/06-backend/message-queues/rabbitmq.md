# RabbitMQ

> **AI Plugin Directive — RabbitMQ Exchanges, Queues & Routing Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring RabbitMQ code,
> follow EVERY rule in this document. Incorrect RabbitMQ configuration causes message loss,
> queue overflow, and connection exhaustion. Treat each section as non-negotiable.

**Core Rule: ALWAYS declare queues as durable. ALWAYS publish with `persistent: true`. ALWAYS use manual acknowledgement. ALWAYS configure dead-letter exchanges (DLX). ALWAYS set prefetch count to limit in-flight messages per consumer.**

---

## 1. RabbitMQ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              RabbitMQ Routing                                  │
│                                                               │
│  Producer → Exchange → Queue → Consumer                      │
│                                                               │
│  Exchange types:                                             │
│  ├── direct: route by exact routing key                     │
│  ├── topic: route by pattern (order.* , *.created)         │
│  ├── fanout: broadcast to all bound queues                  │
│  └── headers: route by message headers                      │
│                                                               │
│  Example:                                                    │
│  Exchange "events" (topic)                                   │
│  ├── Queue "order-processor" ← binding: order.*             │
│  ├── Queue "notification"    ← binding: *.created           │
│  └── Queue "audit-log"       ← binding: #  (all messages)  │
│                                                               │
│  Dead-letter flow:                                           │
│  Queue → reject/expire → DLX → DLQ → manual investigation  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript Implementation (amqplib)

```typescript
import amqp from "amqplib";

class RabbitMQService {
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;

  async connect(): Promise<void> {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL!);
    this.channel = await this.connection.createChannel();

    // Prefetch: process 10 messages at a time per consumer
    await this.channel.prefetch(10);

    // Declare exchange
    await this.channel.assertExchange("events", "topic", { durable: true });

    // Declare queue with dead-letter
    await this.channel.assertQueue("order-processor", {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": "events.dlx",
        "x-dead-letter-routing-key": "order.failed",
        "x-message-ttl": 86_400_000, // 24h message TTL
      },
    });

    // Bind queue to exchange
    await this.channel.bindQueue("order-processor", "events", "order.*");

    // Dead-letter queue
    await this.channel.assertExchange("events.dlx", "direct", { durable: true });
    await this.channel.assertQueue("order-processor.dlq", { durable: true });
    await this.channel.bindQueue("order-processor.dlq", "events.dlx", "order.failed");
  }

  async publish(routingKey: string, data: unknown): Promise<void> {
    this.channel.publish("events", routingKey, Buffer.from(JSON.stringify(data)), {
      persistent: true,             // ALWAYS persist messages
      messageId: randomUUID(),
      timestamp: Date.now(),
      contentType: "application/json",
      headers: { "x-retry-count": 0 },
    });
  }

  async consume(queue: string, handler: (msg: any) => Promise<void>): Promise<void> {
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        await handler(data);
        this.channel.ack(msg);        // ACK after success
      } catch (error) {
        const retryCount = (msg.properties.headers?.["x-retry-count"] ?? 0) as number;
        if (retryCount >= 3) {
          this.channel.nack(msg, false, false); // Send to DLQ
          logger.error("Message sent to DLQ", { messageId: msg.properties.messageId });
        } else {
          // Republish with incremented retry count
          this.channel.publish("events", msg.fields.routingKey, msg.content, {
            ...msg.properties,
            headers: { ...msg.properties.headers, "x-retry-count": retryCount + 1 },
          });
          this.channel.ack(msg); // Ack original
        }
      }
    }, { noAck: false }); // ALWAYS manual ack
  }
}
```

---

## 3. Go Implementation

```go
import amqp "github.com/rabbitmq/amqp091-go"

func SetupRabbitMQ(conn *amqp.Connection) (*amqp.Channel, error) {
    ch, err := conn.Channel()
    if err != nil {
        return nil, err
    }
    ch.Qos(10, 0, false) // Prefetch 10

    // Declare exchange
    ch.ExchangeDeclare("events", "topic", true, false, false, false, nil)

    // Queue with DLX
    ch.QueueDeclare("order-processor", true, false, false, false, amqp.Table{
        "x-dead-letter-exchange":    "events.dlx",
        "x-dead-letter-routing-key": "order.failed",
    })
    ch.QueueBind("order-processor", "order.*", "events", false, nil)

    // DLQ
    ch.ExchangeDeclare("events.dlx", "direct", true, false, false, false, nil)
    ch.QueueDeclare("order-processor.dlq", true, false, false, false, nil)
    ch.QueueBind("order-processor.dlq", "order.failed", "events.dlx", false, nil)

    return ch, nil
}

func Publish(ch *amqp.Channel, routingKey string, body any) error {
    data, _ := json.Marshal(body)
    return ch.PublishWithContext(context.Background(), "events", routingKey, false, false,
        amqp.Publishing{
            ContentType:  "application/json",
            DeliveryMode: amqp.Persistent, // ALWAYS persist
            MessageId:    uuid.New().String(),
            Timestamp:    time.Now(),
            Body:         data,
        })
}

func Consume(ch *amqp.Channel, queue string, handler func([]byte) error) {
    msgs, _ := ch.Consume(queue, "", false, false, false, false, nil) // noAck=false

    for msg := range msgs {
        if err := handler(msg.Body); err != nil {
            slog.Error("processing failed", "error", err, "messageId", msg.MessageId)
            msg.Nack(false, false) // Send to DLQ
        } else {
            msg.Ack(false)
        }
    }
}
```

---

## 4. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Non-durable queue | Messages lost on restart | `durable: true` always |
| Non-persistent messages | Messages lost on broker restart | `persistent: true` |
| `noAck: true` | Messages lost on consumer crash | Manual acknowledgement |
| No prefetch limit | Consumer overwhelmed | `prefetch: 10-50` |
| No dead-letter exchange | Failed messages disappear | DLX + DLQ per queue |
| Single channel for publish + consume | Channel blocking | Separate channels |

---

## 5. Enforcement Checklist

- [ ] Queues declared as durable
- [ ] Messages published with `persistent: true`
- [ ] Manual acknowledgement enabled (`noAck: false`)
- [ ] Prefetch count set (10-50)
- [ ] Dead-letter exchange configured for every queue
- [ ] DLQ monitored with alerting
- [ ] Connection/channel recovery on failure
- [ ] Message TTL configured to prevent unbounded growth
