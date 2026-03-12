# React Native Project Structure

> **AI Plugin Directive:** When generating a React Native project, ALWAYS use this structure. Apply feature-first organization with Expo (recommended) or bare React Native CLI. This guide covers Expo SDK 52+, Expo Router v4, and modern patterns including TypeScript, Zustand/TanStack Query, NativeWind, and the New Architecture (Fabric + TurboModules + JSI). Default to Expo unless the user explicitly needs bare workflow. NEVER create flat `screens/` + `components/` structures.

**Core Rule: Use Expo unless native modules require bare workflow. Organize by feature with shared components. NEVER use a flat `screens/` + `components/` structure for production apps. Use TanStack Query for server state and Zustand for client state. Use Expo Router for file-based navigation.**

---

## 1. Expo vs Bare Workflow Decision

### 1.1 Decision Tree

```
START: Expo or Bare?
│
├── Q1: Do you need custom native code (Objective-C/Swift/Java/Kotlin)?
│   ├── No ──→ Expo (managed) ✓
│   ├── Yes, but only a few modules
│   │   └── Expo with Development Client ──→ best of both ✓
│   └── Yes, extensive native customization
│       └── Bare React Native CLI ✓
│
├── Q2: Do you need these specific features?
│   ├── Bluetooth LE (complex) ──→ Bare or Expo Dev Client
│   ├── Custom camera pipeline ──→ Bare or Expo Dev Client
│   ├── Background audio ──→ Expo Dev Client (expo-av supports basic)
│   ├── CallKit / ConnectionService ──→ Bare
│   ├── App Extensions (iOS) ──→ Bare or Expo with config plugins
│   ├── Custom native views ──→ Expo Dev Client
│   └── Standard features (push, GPS, camera) ──→ Expo ✓
│
└── Q3: What is your CI/CD preference?
    ├── Cloud builds (no macOS CI) ──→ Expo (EAS Build) ✓
    ├── Local builds required ──→ Bare or Expo Dev Client
    └── OTA updates needed ──→ Expo (EAS Update) ✓

VERDICT: Use Expo for ~90% of apps. Use Expo Dev Client for ~8%.
         Use bare RN only for the remaining ~2% with extreme native needs.
```

### 1.2 Comparison Table

| Factor | Expo (Managed) | Expo Dev Client | Bare React Native |
|--------|---------------|----------------|-------------------|
| Setup time | 2 minutes | 10 minutes | 30-60 minutes |
| Native modules | Expo SDK only | Expo SDK + any native | Full native access |
| OTA updates | EAS Update (built-in) | EAS Update | Manual (CodePush) |
| Build service | EAS Build (cloud) | EAS Build (cloud) | Local Xcode/Gradle |
| Config plugins | Yes (modify native) | Yes | Manual native config |
| Upgrade path | `npx expo install --fix` | `npx expo install --fix` | Manual + upgrade-helper |
| Native debugging | Limited | Full (Xcode/AS) | Full (Xcode/AS) |
| Binary size | 15-25MB | 15-30MB | 10-25MB |
| When to use | Default for most apps | Need custom native modules | Extreme native customization |

---

## 2. Enterprise Project Structure (Expo Router, 70+ files)

```
my-app/
├── app/                                   # Expo Router (file-based routing)
│   ├── _layout.tsx                        # Root layout (providers, fonts, splash)
│   ├── index.tsx                          # / (landing/redirect based on auth)
│   │
│   ├── (auth)/                            # Auth group (no tab bar)
│   │   ├── _layout.tsx                    # Stack layout for auth screens
│   │   ├── login.tsx                      # /login
│   │   ├── register.tsx                   # /register
│   │   ├── forgot-password.tsx            # /forgot-password
│   │   └── verify-email.tsx               # /verify-email
│   │
│   ├── (tabs)/                            # Main app with bottom tab bar
│   │   ├── _layout.tsx                    # Tab bar configuration
│   │   ├── index.tsx                      # Home tab (/)
│   │   ├── explore.tsx                    # Explore tab (/explore)
│   │   ├── notifications.tsx              # Notifications tab (/notifications)
│   │   └── profile.tsx                    # Profile tab (/profile)
│   │
│   ├── (modals)/                          # Modal group
│   │   ├── _layout.tsx                    # Modal presentation config
│   │   ├── create-post.tsx                # Modal: create post
│   │   └── image-picker.tsx               # Modal: image picker
│   │
│   ├── users/
│   │   ├── index.tsx                      # /users (list)
│   │   └── [id].tsx                       # /users/:id (detail)
│   │
│   ├── posts/
│   │   ├── index.tsx                      # /posts (list)
│   │   ├── [id].tsx                       # /posts/:id (detail)
│   │   └── [id]/
│   │       └── comments.tsx               # /posts/:id/comments
│   │
│   ├── settings/
│   │   ├── _layout.tsx                    # Settings stack
│   │   ├── index.tsx                      # /settings (main)
│   │   ├── account.tsx                    # /settings/account
│   │   ├── notifications.tsx              # /settings/notifications
│   │   ├── privacy.tsx                    # /settings/privacy
│   │   └── about.tsx                      # /settings/about
│   │
│   └── +not-found.tsx                     # 404 screen
│
├── src/
│   ├── features/                          # Feature modules (domain-driven)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── login-form.tsx
│   │   │   │   ├── register-form.tsx
│   │   │   │   ├── social-login-buttons.tsx
│   │   │   │   └── auth-guard.tsx         # Redirect if not authenticated
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts            # Auth state + actions
│   │   │   │   ├── use-login.ts           # Login mutation
│   │   │   │   └── use-register.ts        # Register mutation
│   │   │   ├── api/
│   │   │   │   └── auth-api.ts            # Auth API calls
│   │   │   ├── store/
│   │   │   │   └── auth-store.ts          # Zustand store (client state)
│   │   │   ├── utils/
│   │   │   │   └── token-manager.ts       # SecureStore token helpers
│   │   │   └── types.ts                   # Auth types
│   │   │
│   │   ├── users/
│   │   │   ├── components/
│   │   │   │   ├── user-card.tsx
│   │   │   │   ├── user-list.tsx
│   │   │   │   ├── user-avatar.tsx
│   │   │   │   ├── user-detail-header.tsx
│   │   │   │   └── user-stats.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-users.ts           # TanStack Query: user list
│   │   │   │   ├── use-user-detail.ts     # TanStack Query: single user
│   │   │   │   ├── use-user-search.ts     # Search with debounce
│   │   │   │   └── use-user-mutations.ts  # Create/update/delete
│   │   │   ├── api/
│   │   │   │   └── users-api.ts           # User API calls
│   │   │   └── types.ts
│   │   │
│   │   ├── posts/
│   │   │   ├── components/
│   │   │   │   ├── post-card.tsx
│   │   │   │   ├── post-list.tsx
│   │   │   │   ├── post-detail.tsx
│   │   │   │   ├── comment-list.tsx
│   │   │   │   └── create-post-form.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-posts.ts
│   │   │   │   ├── use-post-detail.ts
│   │   │   │   ├── use-comments.ts
│   │   │   │   └── use-post-mutations.ts
│   │   │   ├── api/
│   │   │   │   ├── posts-api.ts
│   │   │   │   └── comments-api.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── components/
│   │   │   │   ├── notification-item.tsx
│   │   │   │   └── notification-list.tsx
│   │   │   ├── hooks/
│   │   │   │   └── use-notifications.ts
│   │   │   ├── api/
│   │   │   │   └── notifications-api.ts
│   │   │   └── types.ts
│   │   │
│   │   └── settings/
│   │       ├── components/
│   │       │   ├── settings-row.tsx
│   │       │   ├── settings-section.tsx
│   │       │   └── theme-picker.tsx
│   │       ├── hooks/
│   │       │   └── use-settings.ts
│   │       └── store/
│   │           └── settings-store.ts      # Zustand store (preferences)
│   │
│   ├── components/                        # Shared UI components
│   │   ├── ui/                            # Atomic UI primitives
│   │   │   ├── button.tsx
│   │   │   ├── text-input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── chip.tsx
│   │   │   ├── divider.tsx
│   │   │   ├── loading-spinner.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── bottom-sheet.tsx
│   │   │   ├── modal.tsx
│   │   │   └── index.ts                   # Barrel export
│   │   ├── layout/
│   │   │   ├── safe-area-view.tsx
│   │   │   ├── screen-container.tsx
│   │   │   ├── keyboard-avoiding-view.tsx
│   │   │   ├── section-header.tsx
│   │   │   └── pull-to-refresh.tsx
│   │   ├── lists/
│   │   │   ├── infinite-list.tsx           # FlashList wrapper
│   │   │   ├── empty-state.tsx
│   │   │   └── list-separator.tsx
│   │   ├── feedback/
│   │   │   ├── error-boundary.tsx
│   │   │   ├── error-fallback.tsx
│   │   │   ├── network-error.tsx
│   │   │   └── retry-button.tsx
│   │   └── platform/
│   │       ├── haptic-feedback.tsx
│   │       └── status-bar-config.tsx
│   │
│   ├── lib/                               # Core infrastructure
│   │   ├── api-client.ts                  # Axios/ky wrapper with interceptors
│   │   ├── query-client.ts                # TanStack Query client config
│   │   ├── storage.ts                     # AsyncStorage/SecureStore wrapper
│   │   ├── mmkv.ts                        # MMKV storage (fast key-value)
│   │   ├── analytics.ts                   # Analytics wrapper (Mixpanel/Amplitude)
│   │   ├── sentry.ts                      # Error reporting setup
│   │   ├── i18n.ts                        # i18next configuration
│   │   ├── linking.ts                     # Deep linking configuration
│   │   └── utils.ts                       # General utilities
│   │
│   ├── config/                            # Configuration
│   │   ├── constants.ts                   # API URLs, app constants
│   │   ├── theme.ts                       # Colors, spacing, typography tokens
│   │   ├── env.ts                         # Environment variables (expo-constants)
│   │   └── feature-flags.ts              # Feature flag config
│   │
│   ├── hooks/                             # Shared hooks
│   │   ├── use-debounce.ts
│   │   ├── use-keyboard.ts
│   │   ├── use-network.ts
│   │   ├── use-app-state.ts              # AppState (foreground/background)
│   │   ├── use-biometrics.ts
│   │   ├── use-permissions.ts
│   │   └── use-theme.ts
│   │
│   ├── providers/                         # React context providers
│   │   ├── app-providers.tsx              # Composition root (wraps all)
│   │   ├── auth-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── notification-provider.tsx
│   │
│   └── types/                             # Global types
│       ├── navigation.ts                  # Route params
│       ├── api.ts                         # API response types
│       └── env.d.ts                       # Environment variable types
│
├── assets/                                # Static assets
│   ├── images/
│   │   ├── logo.png
│   │   └── onboarding/
│   ├── fonts/
│   │   ├── Inter-Regular.ttf
│   │   ├── Inter-Medium.ttf
│   │   └── Inter-Bold.ttf
│   ├── icons/
│   │   └── tab-icons/
│   ├── animations/                        # Lottie files
│   │   ├── loading.json
│   │   └── success.json
│   └── adaptive-icon.png
│
├── native-modules/                        # Custom native modules (if needed)
│   ├── specs/                             # TurboModule specs
│   │   └── NativeLocalStorage.ts
│   ├── android/
│   │   └── app/src/main/java/
│   └── ios/
│
├── scripts/                               # Build/dev scripts
│   ├── generate-icons.sh
│   ├── check-deps.sh
│   └── reset-cache.sh
│
├── __tests__/                             # Test files
│   ├── setup.ts                           # Jest setup
│   ├── test-utils.tsx                     # Custom render with providers
│   ├── mocks/
│   │   ├── handlers.ts                    # MSW handlers
│   │   └── server.ts                      # MSW server setup
│   └── e2e/
│       ├── auth.e2e.ts                    # Detox/Maestro E2E tests
│       ├── navigation.e2e.ts
│       └── .detoxrc.js                    # Detox config
│
├── app.json                               # Expo app config
├── app.config.ts                          # Dynamic Expo config
├── eas.json                               # EAS Build/Submit/Update config
├── babel.config.js                        # Babel config
├── metro.config.js                        # Metro bundler config
├── tailwind.config.js                     # NativeWind config
├── nativewind-env.d.ts                    # NativeWind types
├── tsconfig.json                          # TypeScript config
├── package.json                           # Dependencies
├── .env                                   # Environment variables
├── .env.staging                           # Staging environment
├── .env.production                        # Production environment
├── .eslintrc.js                           # ESLint config
├── .prettierrc                            # Prettier config
└── .gitignore
```

---

## 3. Root Layout and Providers

```typescript
// app/_layout.tsx — Root layout
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProviders } from "@/providers/app-providers";

import "../global.css"; // NativeWind

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
          <Stack.Screen name="users/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="posts/[id]" options={{ headerShown: true }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppProviders>
    </GestureHandlerRootView>
  );
}


// src/providers/app-providers.tsx — Composition root
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { NotificationProvider } from "./notification-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

---

## 4. Navigation Patterns (Expo Router)

### 4.1 Tab Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { Redirect } from "expo-router";

export default function TabLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: true,
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
          tabBarBadge: 3,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### 4.2 Dynamic Routes

```typescript
// app/users/[id].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { ScreenContainer } from "@/components/layout/screen-container";
import { UserDetailHeader } from "@/features/users/components/user-detail-header";
import { UserStats } from "@/features/users/components/user-stats";
import { useUserDetail } from "@/features/users/hooks/use-user-detail";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorFallback } from "@/components/feedback/error-fallback";

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user, isLoading, error, refetch } = useUserDetail(id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorFallback error={error} onRetry={refetch} />;
  if (!user) return null;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: user.name }} />
      <UserDetailHeader user={user} />
      <UserStats userId={user.id} />
    </ScreenContainer>
  );
}
```

### 4.3 Typed Routes (Expo Router v4)

```typescript
// With Expo Router typed routes enabled in app.json:
// "experiments": { "typedRoutes": true }

import { router } from "expo-router";

// Type-safe navigation
router.push("/users/123");           // OK
router.push("/users");               // OK
router.push("/nonexistent");         // TypeScript ERROR

// Type-safe params
router.push({
  pathname: "/users/[id]",
  params: { id: "123" },
});
```

---

## 5. Data Fetching (TanStack Query)

```typescript
// src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 minutes
      gcTime: 10 * 60 * 1000,         // 10 minutes (was cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,     // Mobile: no window focus
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});


// src/lib/api-client.ts
import axios from "axios";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { env } from "@/config/env";

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach auth token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);


// src/features/users/api/users-api.ts
import { apiClient } from "@/lib/api-client";
import type { User, CreateUserInput, PaginatedResponse } from "../types";

export const usersApi = {
  getAll: async (page = 1, limit = 20) => {
    const { data } = await apiClient.get<PaginatedResponse<User>>("/users", {
      params: { page, limit },
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<User>(`/users/${id}`);
    return data;
  },

  create: async (input: CreateUserInput) => {
    const { data } = await apiClient.post<User>("/users", input);
    return data;
  },

  update: async (id: string, input: Partial<CreateUserInput>) => {
    const { data } = await apiClient.patch<User>(`/users/${id}`, input);
    return data;
  },

  delete: async (id: string) => {
    await apiClient.delete(`/users/${id}`);
  },

  search: async (query: string) => {
    const { data } = await apiClient.get<User[]>("/users/search", {
      params: { q: query },
    });
    return data;
  },
};


// src/features/users/hooks/use-users.ts
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { usersApi } from "../api/users-api";

// Query keys factory
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (page: number) => [...userKeys.lists(), page] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  search: (query: string) => [...userKeys.all, "search", query] as const,
};

// Paginated list
export function useUsers(page = 1) {
  return useQuery({
    queryKey: userKeys.list(page),
    queryFn: () => usersApi.getAll(page),
  });
}

// Infinite scroll list
export function useUsersInfinite() {
  return useInfiniteQuery({
    queryKey: userKeys.lists(),
    queryFn: ({ pageParam = 1 }) => usersApi.getAll(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.items.length === 20 ? allPages.length + 1 : undefined;
    },
  });
}

// Single user detail
export function useUserDetail(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  });
}

// Search with debounce
export function useUserSearch(query: string) {
  return useQuery({
    queryKey: userKeys.search(query),
    queryFn: () => usersApi.search(query),
    enabled: query.length >= 2,
  });
}

// Mutations
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

---

## 6. State Management (Zustand)

```typescript
// src/features/auth/store/auth-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "../types";

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  // Actions
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      login: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);


// src/features/settings/store/settings-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MMKV } from "react-native-mmkv";

const storage = new MMKV();

// MMKV Zustand storage adapter
const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface SettingsState {
  theme: "light" | "dark" | "system";
  language: string;
  notificationsEnabled: boolean;

  setTheme: (theme: "light" | "dark" | "system") => void;
  setLanguage: (language: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      language: "en",
      notificationsEnabled: true,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (enabled) =>
        set({ notificationsEnabled: enabled }),
    }),
    {
      name: "settings-storage",
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
```

---

## 7. Platform-Specific Files

```typescript
// React Native platform-specific file resolution:
// component.tsx         → Both platforms (default)
// component.ios.tsx     → iOS only
// component.android.tsx → Android only

// Example: Platform-specific haptic feedback
// src/components/platform/haptic-feedback.ios.tsx
import * as Haptics from "expo-haptics";

export const HapticFeedback = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  selection: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

// src/components/platform/haptic-feedback.android.tsx
import { Platform, Vibration } from "react-native";

export const HapticFeedback = {
  light: () => Vibration.vibrate(10),
  medium: () => Vibration.vibrate(20),
  heavy: () => Vibration.vibrate(30),
  selection: () => Vibration.vibrate(5),
  success: () => Vibration.vibrate([0, 10, 50, 10]),
  error: () => Vibration.vibrate([0, 30, 50, 30]),
};


// Example: Platform-specific styling
import { Platform, StyleSheet } from "react-native";

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
});
```

---

## 8. Metro Bundler Configuration

```javascript
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add support for SVG imports
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts.push("svg");

// Monorepo support (if applicable)
// config.watchFolders = [path.resolve(__dirname, "../../packages")];

module.exports = withNativeWind(config, { input: "./global.css" });
```

---

## 9. EAS Build/Submit Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      },
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_ENV": "staging"
      },
      "channel": "preview"
    },
    "production": {
      "env": {
        "APP_ENV": "production"
      },
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "123456789",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal"
      }
    }
  }
}
```

```typescript
// app.config.ts — Dynamic Expo config
import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_ENV === "production" ? "MyApp" : "MyApp (Dev)",
  slug: "my-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "myapp",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.myorg.myapp",
    associatedDomains: ["applinks:myapp.com"],
    infoPlist: {
      NSCameraUsageDescription: "Used for profile photos",
      NSPhotoLibraryUsageDescription: "Used for selecting profile photos",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.myorg.myapp",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "myapp.com", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#007AFF",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  updates: {
    url: "https://u.expo.dev/your-project-id",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
```

---

## 10. New Architecture (Fabric, TurboModules, JSI)

### 10.1 Architecture Overview

```
OLD ARCHITECTURE (Bridge):
┌──────────────┐    JSON Bridge     ┌──────────────┐
│  JavaScript  │ ◄──serialization──►│    Native    │
│   (Hermes)   │   (asynchronous)   │  (iOS/Andr)  │
└──────────────┘                    └──────────────┘

NEW ARCHITECTURE (JSI):
┌──────────────┐    JSI (C++)       ┌──────────────┐
│  JavaScript  │ ◄──direct call────►│    Native    │
│   (Hermes)   │   (synchronous)    │  (iOS/Andr)  │
└──────────────┘                    └──────────────┘

COMPONENTS:
├── JSI (JavaScript Interface)
│   ├── Direct C++ binding between JS and native
│   ├── No serialization overhead
│   ├── Synchronous calls possible
│   └── Shared C++ layer
│
├── Fabric (New Renderer)
│   ├── Replaces old UIManager
│   ├── C++ core for layout (Yoga)
│   ├── Synchronous layout measurement
│   ├── Concurrent rendering support (React 18)
│   ├── Interruptible rendering
│   └── Better list performance
│
├── TurboModules (New Native Modules)
│   ├── Type-safe specs (TypeScript → Codegen)
│   ├── Lazy loading (loaded on first use)
│   ├── Direct JSI binding (no bridge serialization)
│   └── Codegen generates C++/ObjC/Java interfaces
│
└── Codegen
    ├── TypeScript spec → native interfaces
    ├── Runs at build time
    ├── Generates type-safe bridges
    └── Ensures JS/native contract
```

### 10.2 TurboModule Example

```typescript
// native-modules/specs/NativeDeviceInfo.ts
import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  getDeviceId(): string;
  getBatteryLevel(): Promise<number>;
  getAvailableStorage(): Promise<number>;
  isTablet(): boolean;
}

export default TurboModuleRegistry.getEnforcing<Spec>("NativeDeviceInfo");
```

```kotlin
// Android implementation (Kotlin)
package com.myapp.nativemodules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Promise

class NativeDeviceInfoModule(reactContext: ReactApplicationContext)
  : NativeDeviceInfoSpec(reactContext) {

  override fun getName() = NAME

  override fun getDeviceId(): String {
    return android.provider.Settings.Secure.getString(
      reactApplicationContext.contentResolver,
      android.provider.Settings.Secure.ANDROID_ID
    )
  }

  override fun getBatteryLevel(promise: Promise) {
    val batteryManager = reactApplicationContext.getSystemService(
      android.content.Context.BATTERY_SERVICE
    ) as android.os.BatteryManager
    val level = batteryManager.getIntProperty(
      android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY
    )
    promise.resolve(level.toDouble())
  }

  override fun getAvailableStorage(promise: Promise) {
    val stat = android.os.StatFs(android.os.Environment.getDataDirectory().path)
    val available = stat.availableBlocksLong * stat.blockSizeLong
    promise.resolve(available.toDouble())
  }

  override fun isTablet(): Boolean {
    val config = reactApplicationContext.resources.configuration
    return config.smallestScreenWidthDp >= 600
  }

  companion object {
    const val NAME = "NativeDeviceInfo"
  }
}
```

---

## 11. Monorepo with Shared Packages

```
my-monorepo/
├── apps/
│   ├── mobile/                        # React Native (Expo) app
│   │   ├── app/                       # Expo Router
│   │   ├── src/
│   │   ├── app.json
│   │   ├── metro.config.js
│   │   └── package.json
│   │
│   ├── web/                           # Next.js web app
│   │   ├── src/
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── admin/                         # Admin dashboard
│       └── package.json
│
├── packages/
│   ├── shared-types/                  # TypeScript types shared everywhere
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── post.ts
│   │   │   └── api.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared-api/                    # API client shared between apps
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── users.ts
│   │   │   └── posts.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared-utils/                  # Utility functions
│   │   ├── src/
│   │   │   ├── format.ts
│   │   │   ├── validate.ts
│   │   │   └── date.ts
│   │   └── package.json
│   │
│   ├── ui/                            # Shared UI components (web + mobile)
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   └── input.tsx
│   │   └── package.json
│   │
│   └── eslint-config/                 # Shared ESLint config
│       └── package.json
│
├── turbo.json                         # Turborepo config
├── pnpm-workspace.yaml                # Workspace config
├── package.json                       # Root package.json
└── tsconfig.base.json                 # Shared TypeScript config
```

---

## 12. Testing

### 12.1 Jest Configuration

```javascript
// jest.config.js (or in package.json)
module.exports = {
  preset: "jest-expo",
  setupFilesAfterSetup: ["<rootDir>/__tests__/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/types.ts",
    "!src/**/index.ts",
  ],
};
```

### 12.2 Test Utilities

```typescript
// __tests__/test-utils.tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={testQueryClient}>
      {ui}
    </QueryClientProvider>
  );
}

export * from "@testing-library/react-native";
export { renderWithProviders as render };
```

### 12.3 Component Test Example

```typescript
// src/features/users/components/__tests__/user-card.test.tsx
import { render, screen, fireEvent } from "@tests/test-utils";
import { UserCard } from "../user-card";

const mockUser = {
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  avatar: "https://example.com/avatar.jpg",
};

describe("UserCard", () => {
  it("renders user information", () => {
    render(<UserCard user={mockUser} onPress={jest.fn()} />);

    expect(screen.getByText("John Doe")).toBeTruthy();
    expect(screen.getByText("john@example.com")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<UserCard user={mockUser} onPress={onPress} />);

    fireEvent.press(screen.getByText("John Doe"));
    expect(onPress).toHaveBeenCalledWith("1");
  });

  it("shows placeholder when no avatar", () => {
    render(
      <UserCard user={{ ...mockUser, avatar: null }} onPress={jest.fn()} />
    );

    expect(screen.getByTestId("avatar-placeholder")).toBeTruthy();
  });
});
```

### 12.4 E2E Testing (Detox / Maestro)

```yaml
# e2e/auth-flow.yaml (Maestro)
appId: com.myorg.myapp
---
- launchApp
- assertVisible: "Log in"
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Log in"
- assertVisible: "Home"
- assertVisible: "Welcome back"
```

---

## 13. Essential Packages (2025+)

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-splash-screen": "~0.28.0",
    "expo-secure-store": "~14.0.0",
    "expo-notifications": "~0.29.0",
    "expo-image": "~2.0.0",
    "expo-haptics": "~14.0.0",
    "expo-localization": "~16.0.0",
    "expo-constants": "~17.0.0",

    "react": "18.3.1",
    "react-native": "0.76.x",

    "@tanstack/react-query": "^5.60.0",
    "zustand": "^5.0.0",

    "axios": "^1.7.0",
    "zod": "^3.23.0",

    "nativewind": "^4.1.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "@shopify/flash-list": "1.7.0",

    "@react-native-async-storage/async-storage": "2.1.0",
    "react-native-mmkv": "^3.1.0",

    "react-native-svg": "^15.8.0",
    "@gorhom/bottom-sheet": "^5.0.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0",

    "i18next": "^24.0.0",
    "react-i18next": "^15.1.0",

    "@sentry/react-native": "^6.2.0"
  },
  "devDependencies": {
    "typescript": "~5.6.0",
    "@types/react": "~18.3.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0",

    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "@testing-library/react-native": "^12.8.0",
    "@testing-library/jest-native": "^5.4.0",

    "msw": "^2.6.0"
  }
}
```

---

## 14. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Flat structure | `screens/`, `components/`, `utils/` at root | Unscalable, no feature boundaries | Feature-first: `features/auth/`, `features/users/` |
| `useEffect` for server data | `useEffect` + `useState` + loading/error | Race conditions, no cache, no retry | TanStack Query for all API data |
| Inline styles everywhere | `style={{ marginTop: 10, padding: 20 }}` | Inconsistent, not themeable | NativeWind or StyleSheet.create + theme tokens |
| No error boundaries | Unhandled errors crash the app | White screen of death | ErrorBoundary per screen + error fallback UI |
| Hardcoded API URLs | `fetch('http://192.168.1.5:3000/api')` | Breaks in staging/production | Environment config + constants file |
| No offline handling | App unusable without network | Poor user experience | TanStack Query cache + offline detection |
| Navigation in deep components | `useNavigation()` deep in widget tree | Tight coupling, hard to test | Pass callbacks from screens, navigate at screen level |
| Ignoring keyboard | Forms hidden behind keyboard | Users cannot see input fields | KeyboardAvoidingView or react-native-keyboard-aware |
| No TypeScript strict mode | `strict: false` in tsconfig | Runtime type errors | Enable `strict: true`, no `any` |
| Giant components | 500+ line screen components | Hard to read, test, maintain | Extract into feature components + hooks |
| Multiple state libraries | Redux + Context + Zustand + MobX | Inconsistency, confusion | Zustand for client state, TanStack Query for server state |
| Not using FlashList | FlatList for large lists | Dropped frames, memory issues | Replace FlatList with @shopify/flash-list |
| Skipping accessibility | No accessibilityLabel props | Screen readers cannot use the app | Add labels, roles, hints to all interactive elements |
| No loading states | Screen shows nothing during fetch | Confusing UX | Skeleton screens or loading spinners |
| Raw fetch() calls | `fetch()` scattered across components | No interceptors, no retry, inconsistent | Centralized API client with interceptors |
| Ignoring safe areas | Content behind notch/status bar | Broken UI on newer phones | SafeAreaView from react-native-safe-area-context |

---

## 15. Enforcement Checklist

- [ ] Feature-first organization -- screens co-located with hooks, API, store, types
- [ ] Expo Router for navigation -- file-based routing with typed routes enabled
- [ ] TanStack Query for ALL server data -- NO manual `useEffect` + `useState` fetching
- [ ] Zustand for client-only state (auth, preferences, UI) -- persisted via AsyncStorage/MMKV
- [ ] Zod validation on all API responses and form inputs
- [ ] NativeWind or themed StyleSheet -- NO random inline styles
- [ ] API client centralized in `lib/api-client.ts` with auth + error interceptors
- [ ] ErrorBoundary wrapping every screen/feature boundary
- [ ] FlashList for all large/infinite lists -- NEVER bare FlatList for 50+ items
- [ ] Assets organized in `assets/` by type (images, fonts, icons, animations)
- [ ] EAS Build for CI + EAS Update for OTA patches
- [ ] TypeScript strict mode enabled -- no `any`, no implicit returns
- [ ] Platform-specific files used for platform differences (.ios.tsx, .android.tsx)
- [ ] Safe area handling on all screens (SafeAreaView or useSafeAreaInsets)
- [ ] Accessibility labels on all interactive elements
- [ ] Test utilities with provider wrappers (QueryClient, etc.)
- [ ] E2E tests for critical flows (auth, navigation, core features)
- [ ] Environment variables via expo-constants, NEVER hardcoded
- [ ] Deep linking configured and tested for both platforms
- [ ] Sentry or equivalent error reporting configured
