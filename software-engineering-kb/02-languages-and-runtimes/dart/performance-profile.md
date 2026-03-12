# Dart: Performance Profile

> **Domain:** Languages > Dart
> **Difficulty:** Advanced
> **Last Updated:** 2026-03

## Dart Performance Context

Dart's performance profile is unique: it's not a general-purpose backend language competing on throughput benchmarks. Dart exists primarily for **Flutter UI rendering at 60/120fps**. Performance is measured in frame times, jank, and app startup — not requests/second.

## Compilation Strategies

### JIT (Development)

| Metric | Value |
|--------|-------|
| Startup | 2-5 seconds (includes compilation) |
| Hot reload | **<1 second** (stateful) |
| Optimization | Profile-guided, runtime adaptation |
| Memory | Higher (includes compiler + VM) |
| Use case | Development only |

### AOT (Production)

| Metric | Value |
|--------|-------|
| Startup | **~100-300ms** (app launch to first frame) |
| Optimization | Tree shaking, dead code elimination |
| Memory | Lower (no compiler, no mirrors) |
| Binary size | 5-15MB (depends on assets) |
| Use case | Release builds |

### Compilation Target Comparison

| Target | Performance | Size | Use Case |
|--------|------------|------|----------|
| **ARM64 AOT** (iOS/Android) | Best | 5-15MB | Mobile production |
| **x64 AOT** (Desktop) | Best | 10-20MB | Desktop production |
| **dart2wasm** (WebAssembly) | Very Good | 2-5MB | Web (modern browsers) |
| **dart2js** (JavaScript) | Good | 1-3MB (minified) | Web (compatibility) |
| **JIT VM** | Good | N/A | Development, scripting |

## Flutter Rendering Performance

### Rendering Pipeline

```
User Input
    ↓
Build Phase — widget tree → element tree → render tree
    ↓
Layout Phase — calculate sizes and positions
    ↓
Paint Phase — generate display list (Layer tree)
    ↓
Compositing — send to GPU
    ↓
Rasterization — GPU renders pixels
    ↓
VSync — display frame

Target: Complete all phases in <16.6ms (60fps) or <8.3ms (120fps)
```

### Impeller vs Skia

| Feature | Skia (legacy) | Impeller (new) |
|---------|-------------|----------------|
| First-frame jank | Common (shader compilation) | **Eliminated** (pre-compiled) |
| Shader compilation | Runtime (causes jank) | **Build-time** |
| Metal support | Via wrapper | **Native** |
| Vulkan support | Via wrapper | **Native** |
| Status (2025) | Deprecated for mobile | **Default** on iOS and Android |

**Impeller** eliminates the most common Flutter performance complaint: shader compilation jank on first render of complex UI elements.

## Frame Performance Targets

| Refresh Rate | Frame Budget | Common Devices |
|-------------|-------------|----------------|
| 60 Hz | 16.6ms | Older phones, most desktop |
| 90 Hz | 11.1ms | Mid-range modern phones |
| 120 Hz | 8.3ms | Flagship phones, iPads |

### Common Jank Causes

| Cause | Impact | Fix |
|-------|--------|-----|
| Large widget trees | Slow build phase | Break into smaller widgets |
| Expensive `build()` | Rebuilds too slow | `const` widgets, memoization |
| Missing keys | Unnecessary widget recreation | Add `ValueKey` |
| Image decoding on UI thread | Frame drops | `precacheImage()`, `Image.memory()` |
| Heavy computation on UI thread | Complete freeze | Use `Isolate.run()` or `compute()` |
| Excessive `setState()` | Too many rebuilds | Targeted state management (Riverpod) |
| Unbounded lists | Memory + layout explosion | `ListView.builder` (lazy rendering) |
| saveLayer / Opacity widget | GPU overdraw | `AnimatedOpacity`, avoid `Opacity` |

## Memory Model

### Dart GC

| Feature | Detail |
|---------|--------|
| Type | Generational, mark-sweep |
| Generations | Young (new space) + Old (old space) |
| Young space GC | ~1ms, very frequent |
| Old space GC | ~5-10ms, infrequent |
| Compaction | Sliding compaction in old space |

### Flutter Memory Guidelines

```dart
// BAD: Creating objects in build method (called 60x/second)
Widget build(BuildContext context) {
  final style = TextStyle(fontSize: 16);   // new object every frame!
  return Text('Hello', style: style);
}

// GOOD: const or cached
static const _style = TextStyle(fontSize: 16);  // created once

Widget build(BuildContext context) {
  return const Text('Hello', style: TextStyle(fontSize: 16));  // const
}
```

## Startup Performance

### Flutter App Startup

| Phase | Time (typical) | Optimization |
|-------|---------------|-------------|
| Native initialization | 50-100ms | Minimal |
| Engine initialization | 100-200ms | Minimal |
| Framework initialization | 50-100ms | Reduce init work |
| First meaningful frame | 200-500ms total | Deferred loading |

### App Size Optimization

| Technique | Impact |
|-----------|--------|
| Tree shaking (default) | Removes unused code |
| Deferred imports | Lazy-load features |
| `--split-debug-info` | Strip debug symbols |
| `--obfuscate` | Obfuscate code |
| Asset compression | Compress images, fonts |
| ProGuard/R8 (Android) | Additional minification |

```bash
# Optimized release build
flutter build apk --release --shrink --obfuscate \
  --split-debug-info=build/debug-info \
  --tree-shake-icons

# Check app size
flutter build apk --analyze-size
```

### Typical App Sizes

| Platform | Minimal App | Medium App | Large App |
|----------|------------|-----------|-----------|
| Android APK | ~8MB | ~15-30MB | ~50-100MB |
| iOS IPA | ~15MB | ~25-50MB | ~60-120MB |
| Web (JS) | ~1.5MB | ~3-5MB | ~10MB+ |
| Web (WASM) | ~2MB | ~4-6MB | ~12MB+ |

## Web Performance (dart2js vs dart2wasm)

| Metric | dart2js | dart2wasm |
|--------|---------|-----------|
| Initial load | Faster (JS is streaming) | Slower (WASM download) |
| Runtime performance | Good | **Better** (~2x for computation) |
| GC | Browser GC (optimized for JS) | WasmGC (Dart's own) |
| Numeric performance | JS number semantics | Native int/double |
| Browser support | All browsers | Modern browsers (WasmGC) |
| Bundle size | Smaller (minified JS) | Larger (WASM binary) |

## Benchmarks — Dart vs Others

### Computer Language Benchmarks Game (CLBG)

| Benchmark | Dart AOT | Go | Java | JavaScript (V8) |
|-----------|----------|-----|------|-----------------|
| n-body | 1.2x | 1.0x | 0.9x | 1.1x |
| binary-trees | 1.5x | 1.0x | 0.8x | 1.2x |
| spectral-norm | 1.1x | 1.0x | 0.9x | 1.0x |
| fannkuch | 1.3x | 1.0x | 0.9x | 1.1x |

*Values relative to Go (1.0x). Lower is better.*

**Note**: Dart AOT performance is comparable to Go/Java for computational benchmarks. However, Dart is rarely used for backend computation — these benchmarks are relevant for mobile/desktop performance.

### Flutter vs Native — UI Performance

| Metric | Flutter | Native (iOS/Android) | React Native |
|--------|---------|---------------------|-------------|
| 60fps consistency | 95%+ (Impeller) | 99%+ | 80-90% |
| App startup | 200-500ms | 100-300ms | 500-1000ms |
| Memory usage | 30-50MB | 20-40MB | 50-100MB |
| Animation smoothness | Excellent | Best | Good |
| List scrolling | Very Good | Best | Good |

## Profiling Tools

| Tool | Type | Key Feature |
|------|------|-------------|
| **Flutter DevTools** | Full profiler | Timeline, memory, network, layout inspector |
| **Performance Overlay** | FPS monitor | Shows UI/GPU frame times in-app |
| **Timeline Events** | Tracing | Frame-by-frame analysis |
| **Dart Observatory** | VM profiler | CPU, memory, allocation profiling |
| **Android Studio Profiler** | Android | CPU, memory, network, energy |
| **Xcode Instruments** | iOS | Time Profiler, Leaks, Allocations |

```dart
// Performance overlay (add to MaterialApp)
MaterialApp(
  showPerformanceOverlay: true,
  // Green bars = good (<16.6ms), red bars = jank
)

// Timeline tracing
import 'dart:developer';
Timeline.startSync('fetchData');
final data = await fetchData();
Timeline.finishSync();
```

## Real-World Performance Stories

### Google Ads (Flutter)
- One of the largest Flutter apps
- Reduced codebase from 2 platforms to 1
- Maintained 60fps performance across devices

### BMW
- Flutter for connected car app
- Complex animations for vehicle controls
- Consistent performance across iOS and Android

### Alibaba (Xianyu)
- 50M+ users on Flutter
- Performance comparable to native
- Reduced development time by 50%

### Nubank
- Largest digital bank in Latin America
- Flutter for both iOS and Android
- 40M+ customers, performance-critical financial app

## Sources

- [Flutter Performance Best Practices](https://docs.flutter.dev/perf/best-practices)
- [Impeller Rendering Engine](https://docs.flutter.dev/perf/impeller)
- [Dart VM Internals](https://mrale.ph/dartvm/)
- [Flutter DevTools](https://docs.flutter.dev/tools/devtools)
