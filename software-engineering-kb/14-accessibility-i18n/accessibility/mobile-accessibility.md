# Mobile Accessibility

| Property       | Value                                                                |
|---------------|----------------------------------------------------------------------|
| Domain        | Accessibility > Mobile                                               |
| Importance    | High                                                                 |
| Audience      | Mobile engineers, React Native / Flutter developers                  |
| Cross-ref     | [05-frontend accessibility](../../05-frontend/web/component-design/accessibility.md) (covers web ARIA, keyboard navigation, focus management) |

---

## Mobile Accessibility Principles

Mobile accessibility requires platform-specific implementation beyond web ARIA patterns. Screen readers on mobile (VoiceOver, TalkBack) use touch gestures instead of keyboard navigation.

Core requirements:
- **Touch targets**: Minimum 44x44pt (iOS), 48x48dp (Android), 44x44px (web)
- **Gesture alternatives**: Every gesture must have a single-tap or button alternative
- **Screen reader compatibility**: All interactive elements must have accessible names and roles
- **Dynamic Type support**: Text must scale with user font size preferences
- **Orientation**: Support both portrait and landscape (WCAG 1.3.4)

---

## iOS VoiceOver

### SwiftUI Accessibility

```swift
// Basic labels and hints
Button(action: { toggleFavorite() }) {
    Image(systemName: isFavorite ? "heart.fill" : "heart")
}
.accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
.accessibilityHint("Double tap to toggle favorite status")

// Custom actions
struct MessageRow: View {
    var body: some View {
        HStack {
            Text(message.body)
            Spacer()
            Text(message.time)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(message.sender): \(message.body), \(message.time)")
        .accessibilityAction(named: "Reply") { reply(to: message) }
        .accessibilityAction(named: "Delete") { delete(message) }
    }
}

// Grouping and ordering
VStack {
    priceLabel
    discountBadge
}
.accessibilityElement(children: .combine)
.accessibilitySortPriority(1) // Higher priority = read first
```

### UIKit Accessibility

```swift
let button = UIButton()
button.accessibilityLabel = "Submit order"
button.accessibilityHint = "Double tap to place your order"
button.accessibilityTraits = [.button]

// Dynamic announcements
UIAccessibility.post(notification: .announcement, argument: "Order placed successfully")
```

### VoiceOver Gesture Reference

| Gesture | Action |
|---------|--------|
| Single tap | Select and read element |
| Double tap | Activate selected element |
| Swipe right/left | Move to next/previous element |
| Three-finger swipe | Scroll |
| Two-finger tap | Pause/resume speech |
| Two-finger scrub (Z shape) | Go back / dismiss |
| Rotor (two-finger rotate) | Change navigation mode (headings, links, etc.) |

---

## Android TalkBack

### Jetpack Compose

```kotlin
// Basic semantics
IconButton(
    onClick = { toggleFavorite() },
    modifier = Modifier.semantics {
        contentDescription = if (isFavorite) "Remove from favorites" else "Add to favorites"
        role = Role.Button
    }
) {
    Icon(imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Default.FavoriteBorder,
         contentDescription = null) // null because parent has description
}

// Merging semantics for grouped elements
Row(
    modifier = Modifier.semantics(mergeDescendants = true) {
        contentDescription = "${product.name}, ${product.price}, ${product.rating} stars"
    }
) {
    Text(product.name)
    Text(product.price)
    RatingBar(product.rating)
}

// Custom accessibility actions
Box(
    modifier = Modifier.semantics {
        customActions = listOf(
            CustomAccessibilityAction("Delete") { deleteItem(); true },
            CustomAccessibilityAction("Share") { shareItem(); true }
        )
    }
)

// State descriptions
Switch(
    checked = isEnabled,
    onCheckedChange = { setEnabled(it) },
    modifier = Modifier.semantics {
        stateDescription = if (isEnabled) "Enabled" else "Disabled"
    }
)
```

### Android View System

```kotlin
imageView.contentDescription = "Profile photo of ${user.name}"
decorativeImage.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO

// Live regions for dynamic content
statusText.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
statusText.text = "3 items in cart" // Automatically announced
```

---

## React Native Accessibility

```tsx
// Basic accessible component
function ProductCard({ product }: { product: Product }) {
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel={`${product.name}, ${product.price}`}
      accessibilityHint="Double tap to view product details"
      accessibilityRole="button"
      accessibilityState={{ selected: product.isSelected }}
      onPress={() => navigateToProduct(product.id)}
    >
      <Image source={{ uri: product.image }}
             accessibilityLabel={product.imageDescription} />
      <Text>{product.name}</Text>
      <Text>{product.price}</Text>
    </TouchableOpacity>
  );
}

// Custom accessibility actions
function SwipeableRow({ item, onDelete, onArchive }: SwipeableRowProps) {
  return (
    <View
      accessible={true}
      accessibilityActions={[
        { name: "delete", label: "Delete item" },
        { name: "archive", label: "Archive item" },
      ]}
      onAccessibilityAction={(event) => {
        switch (event.nativeEvent.actionName) {
          case "delete": onDelete(item.id); break;
          case "archive": onArchive(item.id); break;
        }
      }}
    >
      <Text>{item.title}</Text>
    </View>
  );
}

// Programmatic announcements
import { AccessibilityInfo } from "react-native";
AccessibilityInfo.announceForAccessibility("Form submitted successfully");
```

---

## Flutter Accessibility

```dart
// Semantics widget for custom elements
Semantics(
  label: 'Submit order',
  hint: 'Double tap to place your order',
  button: true,
  enabled: isFormValid,
  child: CustomButton(onTap: submitOrder),
)

// Excluding decorative elements
Semantics(
  excludeSemantics: true,
  child: DecorativeDivider(),
)

// Merging semantics for grouped content
MergeSemantics(
  child: Row(
    children: [
      Icon(Icons.star, semanticsLabel: ''),
      Text('4.5 out of 5 stars'),
    ],
  ),
)

// Custom semantics actions
Semantics(
  customSemanticsActions: {
    CustomSemanticsAction(label: 'Delete'): () => deleteItem(),
    CustomSemanticsAction(label: 'Share'): () => shareItem(),
  },
  child: ListTile(title: Text(item.name)),
)

// Announce dynamic changes
SemanticsService.announce('Item added to cart', TextDirection.ltr);
```

---

## Touch Target Sizing

### Platform Guidelines

| Platform | Minimum Target Size | Recommended |
|----------|-------------------|-------------|
| iOS (HIG) | 44x44pt | 44x44pt |
| Android (Material 3) | 48x48dp | 48x48dp |
| Web (WCAG 2.2 AA) | 24x24px (2.5.8) | 44x44px |

### Implementation

```css
/* CSS — ensure minimum touch target with padding */
.icon-button {
  min-width: 44px;
  min-height: 44px;
  padding: 12px; /* Expand tappable area around small icon */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Ensure spacing between adjacent targets */
.action-bar button + button {
  margin-left: 8px; /* Prevent accidental adjacent taps */
}
```

```swift
// iOS — minimum 44pt target
button.frame = CGRect(x: 0, y: 0, width: 44, height: 44)
// Or override point(inside:with:) to expand hit area beyond visual bounds
```

```kotlin
// Android — minimum 48dp target
android:minWidth="48dp"
android:minHeight="48dp"
```

---

## Gesture Accessibility

Provide single-tap or button alternatives for every complex gesture.

| Complex Gesture | Accessible Alternative |
|----------------|----------------------|
| Swipe to delete | Delete button or custom accessibility action |
| Pinch to zoom | Zoom in/out buttons |
| Long press for context menu | Visible menu button or accessibility action |
| Pull to refresh | Refresh button in toolbar |
| Shake to undo | Undo button |
| Two-finger rotate | Rotation buttons or slider |
| Drag to reorder | Move up/down buttons or accessibility actions |

---

## Dynamic Type / Font Scaling

### iOS Dynamic Type

```swift
// SwiftUI — automatic with system fonts
Text("Welcome")
    .font(.title) // Automatically scales with Dynamic Type

// UIKit — use preferred font
label.font = UIFont.preferredFont(forTextStyle: .body)
label.adjustsFontForContentSizeCategory = true

// Limit scaling for layout-sensitive elements
label.maximumContentSizeCategory = .accessibilityExtraLarge
```

### Android Font Scaling

```xml
<!-- Use sp (scale-independent pixels) for text -->
<TextView
    android:textSize="16sp"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content" />
```

```kotlin
// Jetpack Compose — sp scales automatically
Text(text = "Hello", fontSize = 16.sp)

// Limit maximum scaling if layout breaks
val scaledSize = minOf(16.sp, 16.sp * 1.5f) // Cap at 150%
```

### React Native Font Scaling

```tsx
import { Text, PixelRatio } from "react-native";

// Text scales by default; disable only when absolutely necessary
<Text allowFontScaling={true} maxFontSizeMultiplier={2.0}>
  Scaled text
</Text>

// Check font scale for layout adjustments
const fontScale = PixelRatio.getFontScale();
if (fontScale > 1.5) {
  // Switch to vertical layout for large text
}
```

---

## Testing Mobile Accessibility

### iOS — Xcode Accessibility Inspector

1. Open Xcode > Developer Tools > Accessibility Inspector
2. Target the simulator or connected device
3. Use the inspection pointer to examine elements
4. Run automated audit via the "Audit" tab
5. Verify: label, value, traits, frame (hit area)

### Android — Accessibility Scanner

1. Install Google Accessibility Scanner from Play Store
2. Enable in Settings > Accessibility
3. Navigate your app and tap the floating action button
4. Review suggestions for touch target size, contrast, labels

### Manual Testing Checklist

| Test | VoiceOver (iOS) | TalkBack (Android) |
|------|----------------|-------------------|
| Enable screen reader | Settings > Accessibility > VoiceOver | Settings > Accessibility > TalkBack |
| Navigate sequentially | Swipe right | Swipe right |
| Activate element | Double tap | Double tap |
| Scroll | Three-finger swipe | Two-finger swipe |
| Go back | Two-finger scrub (Z) | Back gesture |
| Read all from top | Two-finger swipe up | Swipe down then right |

---

## Best Practices

1. **Set accessible labels on every interactive element** — use `accessibilityLabel` (React Native), `contentDescription` (Android), or `accessibilityLabel` (SwiftUI).
2. **Meet platform-specific touch target minimums** — 44x44pt on iOS, 48x48dp on Android, with adequate spacing between targets.
3. **Provide alternatives for every complex gesture** — swipe, pinch, long-press, and shake must have single-tap button alternatives.
4. **Support Dynamic Type and font scaling** — use relative units (sp on Android, Dynamic Type styles on iOS) and test at 200% scale.
5. **Test with real screen readers on real devices** — simulator testing misses timing, gesture, and haptic feedback issues.
6. **Use platform-native accessibility APIs** — avoid custom implementations when SwiftUI `.accessibilityLabel`, Compose `Modifier.semantics`, or React Native `accessible` props exist.
7. **Announce dynamic content changes programmatically** — use `UIAccessibility.post`, `SemanticsService.announce`, or `AccessibilityInfo.announceForAccessibility`.
8. **Group related elements semantically** — combine price + label + rating into a single accessible element with a meaningful combined label.
9. **Support both portrait and landscape orientation** — do not lock orientation unless essential for function (WCAG 1.3.4).
10. **Exclude decorative elements from the accessibility tree** — set `importantForAccessibility="no"` (Android) or `accessibilityElementsHidden` (iOS) for decorative images and dividers.

---

## Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|------------------|
| 1 | Setting `accessible={false}` on interactive elements | Element becomes invisible to screen readers | Keep `accessible={true}` and provide a meaningful label |
| 2 | Using pixel-based font sizes (px/dp) for text | Text does not scale with user font size preferences | Use sp (Android), Dynamic Type (iOS), or `allowFontScaling` (RN) |
| 3 | Swipe-only actions without button alternatives | Screen reader users cannot access swipe gestures | Add custom accessibility actions or visible buttons |
| 4 | Touch targets smaller than 44x44pt / 48x48dp | Users with motor impairments cannot reliably tap targets | Add padding to meet minimum target size even if icon is small |
| 5 | Relying on color alone for status indicators | Users with color blindness cannot distinguish states | Add icons, text labels, or patterns alongside color |
| 6 | Auto-playing media without stop control | Screen reader audio conflicts with media audio | Provide pause/stop button and do not auto-play by default |
| 7 | Setting `maxFontSizeMultiplier={1}` on all text | Disables font scaling for users who need larger text | Only limit scaling on specific layout-critical elements with `maxFontSizeMultiplier={2}` minimum |
| 8 | Generic labels ("button", "image", "icon") | Screen reader announces meaningless labels | Use descriptive labels: "Add to cart", "Profile photo of Jane" |

---

## Enforcement Checklist

- [ ] Every interactive element has a non-empty accessible label verified by screen reader
- [ ] Touch targets meet platform minimum: 44x44pt (iOS), 48x48dp (Android)
- [ ] Complex gestures (swipe, pinch, long-press) have accessible alternatives
- [ ] Dynamic Type / font scaling tested at 200% without layout breakage
- [ ] VoiceOver tested on physical iOS device for all critical user flows
- [ ] TalkBack tested on physical Android device for all critical user flows
- [ ] Decorative elements excluded from accessibility tree
- [ ] Custom accessibility actions provided for swipeable/draggable elements
- [ ] Both portrait and landscape orientations supported
- [ ] Automated mobile a11y tests included in CI pipeline (Appium or platform-specific)
