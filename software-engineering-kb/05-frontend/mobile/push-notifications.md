# Push Notifications — Complete Specification

> **AI Plugin Directive:** When a developer asks "push notifications mobile", "FCM setup", "APNs configuration", "notification channels Android", "notification permissions", "notification payload structure", "deep linking from notifications", "rich notifications", "silent push notifications", "notification analytics", or any push notification question, ALWAYS consult this directive. Push notifications are critical for re-engagement but must be implemented with respect for users. ALWAYS request permission at the RIGHT moment (not on first launch). ALWAYS use notification channels on Android. ALWAYS handle notification taps with deep linking to relevant content. ALWAYS use Firebase Cloud Messaging (FCM) as the unified service — it handles both iOS (APNs) and Android delivery.

**Core Rule: Use Firebase Cloud Messaging (FCM) for ALL push notification delivery — it provides a unified API for both iOS (via APNs) and Android. ALWAYS request notification permission IN CONTEXT (when user performs relevant action) — NEVER on first launch. ALWAYS implement deep linking from notification taps — opening the app to the home screen is a wasted engagement opportunity. ALWAYS use Android notification channels (required since Android 8.0). ALWAYS include an unsubscribe mechanism and respect user preferences.**

---

## 1. Push Notification Architecture

```
  PUSH NOTIFICATION FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  YOUR SERVER                                         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Event triggers notification                   │  │
  │  │  (new message, order update, etc.)             │  │
  │  │  → Construct payload                           │  │
  │  │  → Send to FCM API                             │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │                    ▼                                  │
  │  FIREBASE CLOUD MESSAGING (FCM)                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Receives message from your server             │  │
  │  │  Routes to correct device via token             │  │
  │  │  ┌──────────┐    ┌──────────────────────┐      │  │
  │  │  │ Android  │    │ iOS (via APNs)       │      │  │
  │  │  │ Direct   │    │ FCM → APNs → device  │      │  │
  │  │  └──────────┘    └──────────────────────┘      │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │                    ▼                                  │
  │  DEVICE                                              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  App in foreground → willPresent / onMessage   │  │
  │  │  App in background → system notification       │  │
  │  │  App killed → system notification              │  │
  │  │  User taps → deep link to content              │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Notification Types

```
  NOTIFICATION TYPES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  DISPLAY NOTIFICATION (notification message):        │
  │  • Shows system notification automatically           │
  │  • Handled by OS when app in background             │
  │  • Limited customization                             │
  │  • Use for: alerts, marketing, simple messages       │
  │                                                      │
  │  DATA-ONLY (silent push):                            │
  │  • No visible notification                           │
  │  • App processes data in background                  │
  │  • Use for: data sync, badge updates, cache refresh  │
  │  • iOS: content-available flag                       │
  │  • Android: data-only message                        │
  │                                                      │
  │  RICH NOTIFICATION:                                  │
  │  • Images, buttons, expandable content               │
  │  • iOS: Notification Service Extension               │
  │  • Android: BigPictureStyle, action buttons          │
  │  • Use for: product images, reply actions            │
  │                                                      │
  │  RECOMMENDATION: Use data+notification for most      │
  │  cases — notification for display, data for routing.  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Implementation

### 2.1 React Native (Expo)

```typescript
// Expo Notifications setup
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request permission
async function requestNotificationPermission(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'your-project-id',
  });

  // Send token to your server
  await api.post('/devices/register', { token: token.data });

  return token.data;
}

// Handle notification received (foreground)
useEffect(() => {
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    // Update badge, show in-app notification, etc.
  });

  // Handle notification tap
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    // Deep link to content
    if (data.productId) {
      router.push(`/product/${data.productId}`);
    }
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}, []);
```

### 2.2 Android (Kotlin)

```kotlin
// Android notification channels (required since Android 8.0)
class NotificationHelper(private val context: Context) {
    fun createChannels() {
        val channels = listOf(
            NotificationChannel("messages", "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Chat messages and replies"
                enableVibration(true)
            },
            NotificationChannel("orders", "Order Updates", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Order status and delivery updates"
            },
            NotificationChannel("promotions", "Promotions", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Deals and special offers"
            },
        )

        val manager = context.getSystemService<NotificationManager>()!!
        channels.forEach { manager.createNotificationChannel(it) }
    }
}

// FCM message handling
class AppFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // Send new token to your server
        CoroutineScope(Dispatchers.IO).launch {
            api.registerDevice(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data

        // Data-only message — handle in app
        if (message.notification == null) {
            handleDataMessage(data)
            return
        }

        // Build and show notification
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("product_id", data["product_id"])
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, data["channel"] ?: "messages")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(message.notification?.title)
            .setContentText(message.notification?.body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(this).notify(data["id"]?.hashCode() ?: 0, notification)
    }
}
```

---

## 3. Server-Side Sending

```typescript
// Server-side FCM sending (Node.js)
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Send to single device
async function sendNotification(token: string, payload: NotificationPayload) {
  await admin.messaging().send({
    token,
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
    },
    data: {
      type: payload.type,
      entityId: payload.entityId,
      deepLink: payload.deepLink,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: payload.channel,
        clickAction: 'OPEN_ACTIVITY',
      },
    },
    apns: {
      payload: {
        aps: {
          badge: payload.badgeCount,
          sound: 'default',
          'mutable-content': 1,  // for rich notifications
        },
      },
    },
  });
}

// Send to topic (all subscribers)
await admin.messaging().send({
  topic: 'promotions',
  notification: { title: 'Flash Sale!', body: '50% off all items' },
});
```

### 2.3 iOS (Swift)

```swift
// iOS — UNUserNotificationCenter
import UserNotifications

class NotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationService()

    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self

        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            return granted
        } catch {
            return false
        }
    }

    // Foreground notification
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .badge]
    }

    // User tapped notification
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        if let productId = userInfo["product_id"] as? String {
            DeepLinkRouter.shared.navigate(to: .product(id: productId))
        }
    }
}
```

---

## 4. Rich Notifications

```
  RICH NOTIFICATION CAPABILITIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  iOS (Notification Service Extension):               │
  │  • Attach images, GIFs, video                        │
  │  • Custom UI (Notification Content Extension)        │
  │  • Action buttons (reply, mark as read, archive)     │
  │  • Grouped notifications with summary                │
  │                                                      │
  │  Android:                                            │
  │  • BigPictureStyle — large image                     │
  │  • BigTextStyle — expandable text                    │
  │  • InboxStyle — multiple lines                       │
  │  • MessagingStyle — conversation (bubbles)           │
  │  • Action buttons with DirectReply                   │
  │  • Progress bar for downloads                        │
  └──────────────────────────────────────────────────────┘
```

```kotlin
// Android rich notification with image and actions
fun showRichNotification(context: Context, title: String, body: String, imageUrl: String) {
    val bitmap = Glide.with(context).asBitmap().load(imageUrl).submit().get()

    val notification = NotificationCompat.Builder(context, "orders")
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigPictureStyle().bigPicture(bitmap))
        .addAction(R.drawable.ic_check, "Mark as Read", markReadPendingIntent)
        .addAction(R.drawable.ic_reply, "Reply", replyPendingIntent)
        .setAutoCancel(true)
        .build()

    NotificationManagerCompat.from(context).notify(notificationId, notification)
}
```

---

## 5. Permission Request Timing

```
  WHEN TO REQUEST NOTIFICATION PERMISSION

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  ❌ BAD: On first app launch                          │
  │  → User doesn't know your app yet                    │
  │  → High denial rate (70%+ on iOS)                    │
  │                                                      │
  │  ❌ BAD: On splash screen                             │
  │  → No context for why notifications are needed       │
  │                                                      │
  │  ✅ GOOD: After user completes meaningful action      │
  │  → After first order: "Get order updates?"           │
  │  → After following someone: "Know when they post?"   │
  │  → After chat message: "Get message alerts?"         │
  │                                                      │
  │  ✅ GOOD: Pre-permission prompt (iOS)                 │
  │  → Show custom UI explaining benefits BEFORE         │
  │    system prompt                                     │
  │  → If user says "No" → don't show system prompt      │
  │  → If user says "Yes" → show system prompt            │
  │  → This preserves one chance at system prompt         │
  │                                                      │
  │  METRICS:                                            │
  │  • Cold prompt on launch: ~30% opt-in                │
  │  • Contextual prompt: ~60-70% opt-in                 │
  │  • Pre-permission + contextual: ~70-80% opt-in       │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Permission on first launch** | 70%+ denial rate, can never ask again on iOS | Request in context after user sees value |
| **No deep linking from tap** | User taps notification, lands on home screen | Deep link to relevant content (product, message, order) |
| **No notification channels** | Android groups ALL notifications together, user disables all | Create channels per category (messages, orders, promos) |
| **Too many notifications** | User disables all notifications or uninstalls app | Respect frequency limits, provide granular preferences |
| **No server-side token management** | Notifications sent to expired tokens, wasted resources | Clean stale tokens, handle token refresh |
| **Ignoring foreground state** | Duplicate notification: system banner + in-app alert | Check app state, show in-app UI when foreground |
| **No analytics on notifications** | Can't measure open rate, conversion, or opt-out rate | Track delivered, opened, dismissed, and converted |
| **Sending PII in payload** | Personal data visible in notification text on lock screen | Show generic text, load details when app opens |

---

## 6. Enforcement Checklist

### Setup
- [ ] FCM configured for both iOS and Android
- [ ] APNs certificate/key uploaded to Firebase
- [ ] Device token registration with server
- [ ] Token refresh handling implemented
- [ ] Notification channels created (Android)

### UX
- [ ] Permission requested in context (not on launch)
- [ ] Pre-permission prompt shown before system dialog (iOS)
- [ ] Deep linking from notification tap to relevant content
- [ ] Foreground notification handling configured
- [ ] Notification preferences screen in app settings
- [ ] Unsubscribe option available

### Quality
- [ ] Rich notifications with images where appropriate
- [ ] Notification open rate tracked
- [ ] Stale token cleanup on server
- [ ] Rate limiting to prevent notification fatigue
- [ ] No PII in notification payload visible on lock screen
