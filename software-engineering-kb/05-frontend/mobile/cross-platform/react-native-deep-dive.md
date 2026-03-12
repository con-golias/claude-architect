# React Native Deep Dive — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to start React Native?", "Expo vs bare RN?", "React Native New Architecture", "Hermes engine", "React Navigation setup", "React Native styling", "Turbo Modules", "React Native performance", "Detox testing", "OTA updates React Native", or any React Native question, ALWAYS consult this directive. React Native is the leading cross-platform mobile framework for teams with web/React experience. ALWAYS use Expo for new projects — it provides managed infrastructure, file-based routing, OTA updates, and build services. ALWAYS use the New Architecture (Fabric + TurboModules) for new apps. ALWAYS use Hermes as the JavaScript engine — it pre-compiles bytecode for 2x faster startup.

**Core Rule: Use Expo for ALL new React Native projects — it removes native build complexity and provides expo-router (file-based navigation), EAS Build (cloud builds), and EAS Update (OTA updates). Use the New Architecture (Fabric renderer + TurboModules + JSI) for synchronous native bridge calls and concurrent rendering. ALWAYS use Hermes engine (default since RN 0.70) — it pre-compiles JavaScript to bytecode for faster startup and lower memory usage. State management, data fetching, and testing patterns are IDENTICAL to React web — use Zustand, TanStack Query, and Testing Library.**

---

## 1. React Native Architecture

```
  REACT NATIVE NEW ARCHITECTURE (0.73+)

  ┌──────────────────────────────────────────────────────┐
  │  JAVASCRIPT THREAD                                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Hermes Engine (pre-compiled bytecode)        │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  React 18 + Concurrent Features          │  │  │
  │  │  │  Zustand / TanStack Query / Jotai        │  │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ JSI (JavaScript Interface)       │
  │                    │ ← synchronous, no JSON bridge    │
  │  ┌─────────────────▼──────────────────────────────┐  │
  │  │  NATIVE LAYER                                  │  │
  │  │                                                │  │
  │  │  ┌────────────────┐  ┌──────────────────────┐  │  │
  │  │  │  FABRIC        │  │  TURBO MODULES       │  │  │
  │  │  │  (New Renderer)│  │  (New Native Modules) │  │  │
  │  │  │  C++ shadow    │  │  Codegen types       │  │  │
  │  │  │  tree (Yoga)   │  │  Direct JSI calls    │  │  │
  │  │  └────────────────┘  └──────────────────────┘  │  │
  │  │                                                │  │
  │  │  ┌──────────────────────────────────────────┐  │  │
  │  │  │  PLATFORM UI                             │  │  │
  │  │  │  iOS: UIKit views    Android: Android Views│ │  │
  │  │  └──────────────────────────────────────────┘  │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Old vs New Architecture

```
  OLD ARCHITECTURE (pre-0.73):
  ┌────────────┐    JSON Bridge    ┌────────────┐
  │ JS Thread  │ ←──────────────→  │ Native     │
  │ (JSC/Hermes)│  async, batched  │ (UIKit/    │
  │            │  serialized JSON  │  Android)  │
  └────────────┘                   └────────────┘
  PROBLEMS: Async-only, JSON serialization overhead,
  no concurrent rendering, janky gestures

  NEW ARCHITECTURE (0.73+):
  ┌────────────┐    JSI (C++)      ┌────────────┐
  │ JS Thread  │ ←──────────────→  │ Native     │
  │ (Hermes)   │  synchronous,    │ (Fabric +  │
  │            │  no serialization│  TurboMods) │
  └────────────┘                   └────────────┘
  BENEFITS: Synchronous calls, shared ownership (C++),
  concurrent rendering, lazy module loading
```

### 1.2 Expo vs Bare React Native

| Feature | Expo (Managed) | Bare React Native |
|---|---|---|
| **Setup** | `npx create-expo-app` (2 min) | `npx react-native init` (10+ min) |
| **Native code** | Config plugins (no Xcode needed) | Full Xcode/Android Studio |
| **Build** | EAS Build (cloud) | Local Xcode/Gradle |
| **OTA Updates** | EAS Update (built-in) | Manual (CodePush deprecated) |
| **Routing** | expo-router (file-based) | React Navigation (manual) |
| **Upgrade** | `npx expo install` | Manual (often painful) |
| **Native modules** | Expo Modules API + config plugins | Direct native code |
| **CI/CD** | EAS Submit (App Store/Play Store) | Manual Fastlane/Bitrise |
| **Dev client** | Expo Dev Client (custom native) | Standard Metro |

**VERDICT:** Start with Expo ALWAYS. Eject only if blocked by a native requirement that config plugins cannot handle.

### 1.3 Project Setup

```bash
# Create new Expo project
npx create-expo-app@latest my-app
cd my-app

# Add essential dependencies
npx expo install expo-router expo-image react-native-reanimated
npx expo install @tanstack/react-query zustand
npx expo install react-native-safe-area-context react-native-screens

# Start development
npx expo start
```

```
  EXPO PROJECT STRUCTURE

  app/
  ├── _layout.tsx              ← Root layout (providers, fonts)
  ├── index.tsx                ← / (home screen)
  ├── (tabs)/                  ← Tab navigator group
  │   ├── _layout.tsx          ← Tab bar configuration
  │   ├── index.tsx            ← Home tab
  │   ├── explore.tsx          ← Explore tab
  │   └── profile.tsx          ← Profile tab
  ├── (auth)/                  ← Auth group (no tabs)
  │   ├── _layout.tsx          ← Stack navigator
  │   ├── login.tsx            ← Login screen
  │   └── register.tsx         ← Register screen
  ├── settings/
  │   ├── _layout.tsx          ← Stack navigator
  │   ├── index.tsx            ← /settings
  │   └── [id].tsx             ← /settings/:id (dynamic)
  ├── product/
  │   └── [id].tsx             ← /product/:id
  └── +not-found.tsx           ← 404 screen

  src/
  ├── components/              ← Shared UI components
  │   ├── ui/                  ← Primitives (Button, Input)
  │   └── features/            ← Feature components
  ├── hooks/                   ← Custom hooks
  ├── stores/                  ← Zustand stores
  ├── api/                     ← API client + queries
  ├── utils/                   ← Utility functions
  └── constants/               ← App constants
```

---

## 2. Navigation (expo-router)

```tsx
// app/_layout.tsx — Root layout
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

```tsx
// app/(tabs)/_layout.tsx — Tab navigator
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

```tsx
// Navigation API
import { router, useLocalSearchParams, Link } from 'expo-router';

// Imperative navigation
router.push('/product/123');
router.replace('/home');
router.back();

// Type-safe params
function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Text>Product: {id}</Text>;
}

// Declarative navigation
<Link href="/product/123" asChild>
  <Pressable>
    <Text>View Product</Text>
  </Pressable>
</Link>
```

---

## 3. Styling Patterns

```tsx
// StyleSheet.create — the native performant approach
import { StyleSheet, View, Text } from 'react-native';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 4,
  },
});

function ProductCard({ product }: { product: Product }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{product.name}</Text>
      <Text style={styles.price}>${product.price}</Text>
    </View>
  );
}
```

```tsx
// NativeWind (Tailwind CSS for React Native) — RECOMMENDED for teams that know Tailwind
import { View, Text } from 'react-native';

function ProductCard({ product }: { product: Product }) {
  return (
    <View className="bg-white rounded-xl p-4 shadow-md">
      <Text className="text-lg font-semibold text-gray-900">{product.name}</Text>
      <Text className="text-base font-bold text-blue-600 mt-1">${product.price}</Text>
    </View>
  );
}

// NativeWind supports:
// - All Tailwind utilities (adapted for React Native)
// - Dark mode (dark:bg-gray-900)
// - Platform variants (ios:pt-12 android:pt-8)
// - Responsive (requires manual breakpoint setup)
```

### 3.1 Platform-Specific Styling

```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// Platform-specific files (automatic resolution)
// Button.ios.tsx — iOS-specific component
// Button.android.tsx — Android-specific component
// Button.tsx — shared fallback
// Import `Button` and Metro resolves the correct file per platform
```

---

## 4. State Management & Data Fetching

```tsx
// Zustand store — identical to React web
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthStore {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: async (email, password) => {
        const { token, user } = await api.login(email, password);
        set({ token, user });
      },
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage), // persist to AsyncStorage
    },
  ),
);
```

```tsx
// TanStack Query — data fetching (identical to React web)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductInput) => api.post('/products', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// In component
function ProductList() {
  const { data, isLoading, error, refetch } = useProducts();

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) return <ErrorView message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductCard product={item} />}
      onRefresh={refetch}
      refreshing={isLoading}
    />
  );
}
```

---

## 5. Performance Optimization

```
  PERFORMANCE RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LISTS: FlatList with optimization props             │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  <FlatList                                    │  │
  │  │    data={items}                               │  │
  │  │    renderItem={renderItem}                    │  │
  │  │    keyExtractor={(item) => item.id}           │  │
  │  │    getItemLayout={getItemLayout}  ← skip meas │  │
  │  │    windowSize={5}                 ← render window│ │
  │  │    maxToRenderPerBatch={10}       ← batch size │  │
  │  │    removeClippedSubviews={true}   ← Android    │  │
  │  │    initialNumToRender={10}        ← first paint│  │
  │  │  />                                           │  │
  │  │                                                │  │
  │  │  For very long lists (1000+):                  │  │
  │  │  Use FlashList from @shopify/flash-list        │  │
  │  │  → 5x faster than FlatList via cell recycling  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  IMAGES: expo-image (NOT Image from react-native)    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  import { Image } from 'expo-image';          │  │
  │  │  <Image                                       │  │
  │  │    source={{ uri: product.imageUrl }}          │  │
  │  │    placeholder={blurhash}                     │  │
  │  │    contentFit="cover"                         │  │
  │  │    transition={200}                           │  │
  │  │    cachePolicy="memory-disk"                  │  │
  │  │    style={{ width: 200, height: 200 }}        │  │
  │  │  />                                           │  │
  │  │  → Built-in blurhash placeholders             │  │
  │  │  → Memory + disk caching                      │  │
  │  │  → Animated transitions                       │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ANIMATIONS: react-native-reanimated (UI thread)     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  import Animated, {                           │  │
  │  │    useSharedValue,                            │  │
  │  │    useAnimatedStyle,                          │  │
  │  │    withSpring,                                │  │
  │  │  } from 'react-native-reanimated';            │  │
  │  │                                                │  │
  │  │  function AnimatedCard() {                    │  │
  │  │    const scale = useSharedValue(1);           │  │
  │  │    const style = useAnimatedStyle(() => ({    │  │
  │  │      transform: [{ scale: scale.value }],     │  │
  │  │    }));                                       │  │
  │  │    return <Animated.View style={style} />;    │  │
  │  │  }                                            │  │
  │  │                                                │  │
  │  │  NEVER use Animated API for complex animations │  │
  │  │  → Runs on JS thread → crosses bridge → jank  │  │
  │  │  Reanimated runs on UI thread → 60fps always  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  MEMOIZATION:                                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  // Memoize list items to prevent re-renders  │  │
  │  │  const ProductCard = React.memo(({ product }) =>│ │
  │  │    <View>...</View>                           │  │
  │  │  );                                           │  │
  │  │                                                │  │
  │  │  // Memoize renderItem callback               │  │
  │  │  const renderItem = useCallback(              │  │
  │  │    ({ item }) => <ProductCard product={item} />,│ │
  │  │    []                                         │  │
  │  │  );                                           │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Hermes Engine

```
  HERMES — REACT NATIVE'S JS ENGINE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  WITHOUT HERMES (old — JavaScriptCore):              │
  │  JS source → Parse at runtime → Interpret → Execute  │
  │  Cold start: ~1.5s                                   │
  │  Memory: ~200MB                                      │
  │                                                      │
  │  WITH HERMES (default since RN 0.70):                │
  │  JS source → Compile to bytecode at BUILD time       │
  │  → Load pre-compiled bytecode → Execute directly     │
  │  Cold start: ~0.7s (2x faster)                       │
  │  Memory: ~100MB (50% less)                           │
  │                                                      │
  │  BENEFITS:                                           │
  │  • Pre-compiled bytecode → no parse time at startup  │
  │  • Smaller memory footprint                          │
  │  • Better garbage collection (GenGC)                 │
  │  • Supports Chrome DevTools Protocol                 │
  │                                                      │
  │  ALREADY DEFAULT — no configuration needed.          │
  │  Verify: global.HermesInternal != null               │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Testing

```typescript
// Unit + Component: Jest + React Native Testing Library
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

describe('LoginForm', () => {
  it('submits login form with email and password', () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('Email'), 'test@test.com');
    fireEvent.changeText(screen.getByLabelText('Password'), 'password');
    fireEvent.press(screen.getByText('Sign In'));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password',
    });
  });

  it('shows validation error for empty email', () => {
    render(<LoginForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByText('Sign In'));

    expect(screen.getByText('Email is required')).toBeTruthy();
  });
});

// Testing with TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

it('shows products after loading', async () => {
  server.use(
    http.get('/api/products', () => {
      return HttpResponse.json([{ id: '1', name: 'Product A' }]);
    }),
  );

  renderWithProviders(<ProductList />);

  await waitFor(() => {
    expect(screen.getByText('Product A')).toBeTruthy();
  });
});
```

```typescript
// E2E: Detox (preferred for React Native)
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('logs in successfully', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password');
    await element(by.text('Sign In')).tap();
    await expect(element(by.text('Dashboard'))).toBeVisible();
  });

  it('shows error for invalid credentials', async () => {
    await element(by.id('email-input')).typeText('wrong@example.com');
    await element(by.id('password-input')).typeText('wrong');
    await element(by.text('Sign In')).tap();
    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });
});

// Alternative E2E: Maestro (YAML-based, simpler)
// login.yaml:
// appId: com.example.myapp
// ---
// - tapOn: "Email"
// - inputText: "test@example.com"
// - tapOn: "Password"
// - inputText: "password"
// - tapOn: "Sign In"
// - assertVisible: "Dashboard"
```

---

## 7. OTA Updates (EAS Update)

```bash
# EAS Update — ship JS changes without App Store review
npx eas update --branch production --message "Fix login bug"

# Preview before shipping
npx eas update --branch preview --message "Test new feature"
```

```
  OTA UPDATE FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Developer pushes JS update:                         │
  │  npx eas update --branch production                  │
  │                          │                           │
  │                          ▼                           │
  │  EAS servers store the update bundle                 │
  │                          │                           │
  │                          ▼                           │
  │  App launches → checks for update → downloads        │
  │                          │                           │
  │                          ▼                           │
  │  Update applied on NEXT app launch                   │
  │  (not during current session)                        │
  │                                                      │
  │  OTA LIMITS:                                         │
  │  ✅ JavaScript/TypeScript changes                     │
  │  ✅ Images and assets                                 │
  │  ✅ Styling changes                                   │
  │  ❌ Native modules (need new binary)                  │
  │  ❌ Native code changes (Swift/Kotlin)                │
  │  ❌ app.json/app.config.js changes                    │
  │  ❌ Expo SDK version changes                          │
  │                                                      │
  │  STRATEGY:                                           │
  │  • Bug fixes → OTA (instant, no review)              │
  │  • Feature flags → OTA (toggle remotely)             │
  │  • Native changes → New binary (App Store review)    │
  └──────────────────────────────────────────────────────┘
```

---

## 8. Native Modules & Expo Modules API

```tsx
// Expo Modules API — create native modules without leaving Expo
// modules/haptics/src/HapticsModule.ts
import { NativeModule, requireNativeModule } from 'expo-modules-core';

declare class HapticsModule extends NativeModule {
  impact(style: 'light' | 'medium' | 'heavy'): void;
  notification(type: 'success' | 'warning' | 'error'): void;
}

export default requireNativeModule<HapticsModule>('Haptics');

// Expo config plugin for native configuration
// app.config.js
export default {
  expo: {
    plugins: [
      ['expo-camera', { cameraPermission: 'Allow camera for scanning' }],
      ['expo-location', { locationAlwaysPermission: 'For navigation' }],
    ],
  },
};

// RULE: Prefer Expo SDK packages over community packages
// expo-camera, expo-location, expo-notifications, expo-image,
// expo-file-system, expo-secure-store, expo-haptics, expo-av
```

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **ScrollView + map for lists** | All items rendered — OOM on 1000+ items | Use `FlatList` or `FlashList` |
| **Inline styles** | `style={{ padding: 10 }}` — new object every render | `StyleSheet.create()` — memoized |
| **Animated API for complex animations** | Janky, <60fps — crosses JS bridge | `react-native-reanimated` — UI thread |
| **Not using Hermes** | 2x slower startup, more memory | Enable Hermes (default since RN 0.70) |
| **Starting without Expo** | Manual native setup, painful upgrades | Start with Expo ALWAYS |
| **console.log in production** | Bridge traffic — performance drops | Gate behind `__DEV__` flag |
| **Images in React state** | Base64 in state — memory explosion | Use file system or CDN URLs |
| **No error boundaries** | One crash kills entire app | Wrap every screen in error boundary |
| **Image from react-native** | No caching, no placeholders, no transitions | Use `expo-image` with blurhash + caching |
| **Direct AsyncStorage for auth tokens** | Tokens stored in plaintext, accessible to other apps | Use `expo-secure-store` for sensitive data |
| **Not memoizing list items** | Every parent re-render rebuilds entire list | `React.memo` on list item + `useCallback` on renderItem |

---

## 10. Enforcement Checklist

### Setup
- [ ] Expo used for project scaffolding (`create-expo-app`)
- [ ] New Architecture enabled
- [ ] Hermes engine active (verify `global.HermesInternal`)
- [ ] expo-router for file-based navigation
- [ ] TypeScript strict mode enabled
- [ ] EAS Build configured for cloud builds
- [ ] EAS Update configured for OTA deployments

### Performance
- [ ] FlatList/FlashList for ALL lists (never ScrollView + map)
- [ ] expo-image with caching and blurhash placeholders
- [ ] react-native-reanimated for animations (not Animated API)
- [ ] StyleSheet.create for styles (no inline objects)
- [ ] React.memo on list item components
- [ ] No console.log in production (gate with `__DEV__`)
- [ ] Images loaded at display size (not full resolution)

### State & Data
- [ ] Zustand for client state (persisted with AsyncStorage)
- [ ] TanStack Query for server state
- [ ] expo-secure-store for sensitive data (tokens, keys)
- [ ] MSW for API mocking in development/testing

### Quality
- [ ] Unit tests with React Native Testing Library
- [ ] E2E tests with Detox or Maestro
- [ ] Error boundaries on every screen
- [ ] Real device testing before release (not just simulator)
- [ ] Accessibility: accessibilityLabel on interactive elements
- [ ] Deep linking configured and tested
