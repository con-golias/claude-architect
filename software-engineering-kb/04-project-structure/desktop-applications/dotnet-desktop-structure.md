# .NET Desktop Application Structure

> **AI Plugin Directive:** When generating a .NET desktop application (WPF, WinUI 3, or .NET MAUI), ALWAYS use this structure. Apply MVVM pattern with CommunityToolkit.Mvvm. This guide covers .NET 8+ with WinUI 3 (recommended for new Windows apps), WPF (mature Windows), and MAUI (cross-platform desktop+mobile).

**Core Rule: ALWAYS use MVVM. Views are XAML/markup only -- ZERO business logic in code-behind. ViewModels handle state and commands via source generators. Services handle business logic. Models represent data. ALL dependencies injected via Microsoft.Extensions.DependencyInjection.**

---

## 1. Enterprise Project Structure (WinUI 3 -- Primary)

```
MyApp/
├── src/
│   ├── MyApp/                                 # Main WinUI 3 application project
│   │   ├── App.xaml                           # Application resources, theme, startup
│   │   ├── App.xaml.cs                        # Host builder, DI container, activation
│   │   │
│   │   ├── Views/                             # XAML views (Pages + Windows)
│   │   │   ├── MainWindow.xaml                # App shell window
│   │   │   ├── MainWindow.xaml.cs             # Minimal code-behind (DI wire-up)
│   │   │   ├── Shell/
│   │   │   │   ├── ShellPage.xaml             # NavigationView shell (sidebar nav)
│   │   │   │   └── ShellPage.xaml.cs
│   │   │   ├── Dashboard/
│   │   │   │   ├── DashboardPage.xaml
│   │   │   │   └── DashboardPage.xaml.cs
│   │   │   ├── Users/
│   │   │   │   ├── UserListPage.xaml
│   │   │   │   ├── UserListPage.xaml.cs
│   │   │   │   ├── UserDetailPage.xaml
│   │   │   │   └── UserDetailPage.xaml.cs
│   │   │   ├── Settings/
│   │   │   │   ├── SettingsPage.xaml
│   │   │   │   └── SettingsPage.xaml.cs
│   │   │   ├── Auth/
│   │   │   │   ├── LoginPage.xaml
│   │   │   │   └── LoginPage.xaml.cs
│   │   │   └── Dialogs/
│   │   │       ├── ConfirmDialog.xaml
│   │   │       ├── ConfirmDialog.xaml.cs
│   │   │       ├── InputDialog.xaml
│   │   │       └── InputDialog.xaml.cs
│   │   │
│   │   ├── ViewModels/                        # MVVM ViewModels (CommunityToolkit.Mvvm)
│   │   │   ├── ShellViewModel.cs
│   │   │   ├── DashboardViewModel.cs
│   │   │   ├── UserListViewModel.cs
│   │   │   ├── UserDetailViewModel.cs
│   │   │   ├── LoginViewModel.cs
│   │   │   ├── SettingsViewModel.cs
│   │   │   └── Base/
│   │   │       └── ViewModelBase.cs           # Common ViewModel base (if needed)
│   │   │
│   │   ├── Models/                            # Data models / DTOs
│   │   │   ├── User.cs
│   │   │   ├── UserDto.cs
│   │   │   ├── AppSettings.cs
│   │   │   ├── NavigationItem.cs
│   │   │   └── Enums/
│   │   │       ├── UserRole.cs
│   │   │       └── AppTheme.cs
│   │   │
│   │   ├── Services/                          # Application services
│   │   │   ├── Navigation/
│   │   │   │   ├── INavigationService.cs
│   │   │   │   ├── NavigationService.cs
│   │   │   │   └── INavigationAware.cs        # ViewModel navigation hooks
│   │   │   ├── Auth/
│   │   │   │   ├── IAuthService.cs
│   │   │   │   ├── AuthService.cs
│   │   │   │   └── TokenManager.cs
│   │   │   ├── Data/
│   │   │   │   ├── IUserService.cs
│   │   │   │   └── UserService.cs
│   │   │   ├── Settings/
│   │   │   │   ├── ISettingsService.cs
│   │   │   │   └── SettingsService.cs
│   │   │   ├── Dialog/
│   │   │   │   ├── IDialogService.cs
│   │   │   │   └── DialogService.cs
│   │   │   ├── Theme/
│   │   │   │   ├── IThemeService.cs
│   │   │   │   └── ThemeService.cs
│   │   │   ├── Notification/
│   │   │   │   ├── INotificationService.cs
│   │   │   │   └── NotificationService.cs
│   │   │   └── Logging/
│   │   │       └── AppLoggerProvider.cs
│   │   │
│   │   ├── Controls/                          # Custom reusable XAML controls
│   │   │   ├── UserCard.xaml
│   │   │   ├── UserCard.xaml.cs
│   │   │   ├── LoadingOverlay.xaml
│   │   │   ├── LoadingOverlay.xaml.cs
│   │   │   ├── StatusIndicator.xaml
│   │   │   ├── StatusIndicator.xaml.cs
│   │   │   ├── SearchBox.xaml
│   │   │   └── SearchBox.xaml.cs
│   │   │
│   │   ├── Converters/                        # XAML value converters
│   │   │   ├── BoolToVisibilityConverter.cs
│   │   │   ├── InverseBoolConverter.cs
│   │   │   ├── NullToVisibilityConverter.cs
│   │   │   ├── DateTimeToStringConverter.cs
│   │   │   ├── EnumToStringConverter.cs
│   │   │   └── ColorToBrushConverter.cs
│   │   │
│   │   ├── Behaviors/                         # XAML Behaviors
│   │   │   ├── ScrollToBottomBehavior.cs
│   │   │   ├── AutoFocusBehavior.cs
│   │   │   └── CloseFlyoutOnClickBehavior.cs
│   │   │
│   │   ├── Helpers/                           # Utility/extension classes
│   │   │   ├── ResourceExtensions.cs
│   │   │   ├── FrameExtensions.cs
│   │   │   ├── WindowHelper.cs
│   │   │   └── DispatcherHelper.cs
│   │   │
│   │   ├── Activation/                        # App activation handlers
│   │   │   ├── IActivationHandler.cs
│   │   │   ├── DefaultActivationHandler.cs
│   │   │   ├── ProtocolActivationHandler.cs   # Deep link handling
│   │   │   └── ToastNotificationActivationHandler.cs
│   │   │
│   │   ├── Styles/                            # XAML resource dictionaries
│   │   │   ├── Colors.xaml
│   │   │   ├── TextStyles.xaml
│   │   │   ├── ButtonStyles.xaml
│   │   │   ├── CustomStyles.xaml
│   │   │   └── Thickness.xaml
│   │   │
│   │   ├── Assets/                            # Images, fonts, static files
│   │   │   ├── Fonts/
│   │   │   │   └── SegoeIcons.ttf
│   │   │   ├── Images/
│   │   │   │   ├── logo.png
│   │   │   │   ├── logo-dark.png
│   │   │   │   └── splash.png
│   │   │   └── app-icon.ico
│   │   │
│   │   ├── Strings/                           # Localization resources
│   │   │   ├── en-US/
│   │   │   │   └── Resources.resw
│   │   │   ├── de-DE/
│   │   │   │   └── Resources.resw
│   │   │   ├── el-GR/
│   │   │   │   └── Resources.resw
│   │   │   └── ja-JP/
│   │   │       └── Resources.resw
│   │   │
│   │   ├── Properties/
│   │   │   ├── launchSettings.json
│   │   │   └── PublishProfiles/
│   │   │       └── win-x64.pubxml
│   │   │
│   │   ├── Package.appxmanifest              # MSIX manifest
│   │   └── MyApp.csproj
│   │
│   ├── MyApp.Core/                            # Shared business logic (platform-agnostic)
│   │   ├── Interfaces/
│   │   │   ├── IRepository.cs
│   │   │   ├── IUnitOfWork.cs
│   │   │   └── ICacheService.cs
│   │   ├── Models/
│   │   │   ├── User.cs
│   │   │   ├── Result.cs                      # Result<T> pattern
│   │   │   └── PagedResult.cs
│   │   ├── Services/
│   │   │   ├── UserBusinessLogic.cs
│   │   │   └── ValidationService.cs
│   │   ├── Extensions/
│   │   │   ├── StringExtensions.cs
│   │   │   └── CollectionExtensions.cs
│   │   ├── Constants/
│   │   │   └── AppConstants.cs
│   │   └── MyApp.Core.csproj
│   │
│   ├── MyApp.Infrastructure/                  # External integrations
│   │   ├── Api/
│   │   │   ├── ApiClient.cs
│   │   │   ├── ApiEndpoints.cs
│   │   │   ├── HttpMessageHandlers/
│   │   │   │   ├── AuthHeaderHandler.cs
│   │   │   │   ├── RetryHandler.cs
│   │   │   │   └── LoggingHandler.cs
│   │   │   └── Responses/
│   │   │       ├── UserResponse.cs
│   │   │       └── ApiError.cs
│   │   ├── Database/
│   │   │   ├── AppDbContext.cs                # EF Core DbContext
│   │   │   ├── Migrations/
│   │   │   │   └── 20250101000000_Initial.cs
│   │   │   ├── Configurations/
│   │   │   │   └── UserConfiguration.cs       # Fluent API config
│   │   │   └── Repositories/
│   │   │       ├── UserRepository.cs
│   │   │       └── BaseRepository.cs
│   │   ├── Cache/
│   │   │   ├── InMemoryCacheService.cs
│   │   │   └── FileCacheService.cs
│   │   ├── FileSystem/
│   │   │   ├── IFileService.cs
│   │   │   └── FileService.cs
│   │   └── MyApp.Infrastructure.csproj
│   │
│   └── MyApp.Shared/                          # Shared between WPF/WinUI/MAUI (if multi-framework)
│       ├── Contracts/
│       │   └── IPlatformService.cs
│       ├── Mappers/
│       │   └── UserMapper.cs
│       └── MyApp.Shared.csproj
│
├── tests/
│   ├── MyApp.Tests/                           # Unit tests
│   │   ├── ViewModels/
│   │   │   ├── UserListViewModelTests.cs
│   │   │   ├── UserDetailViewModelTests.cs
│   │   │   └── LoginViewModelTests.cs
│   │   ├── Services/
│   │   │   ├── UserServiceTests.cs
│   │   │   └── AuthServiceTests.cs
│   │   ├── Helpers/
│   │   │   └── MockFactory.cs                 # Shared mock setup
│   │   └── MyApp.Tests.csproj
│   │
│   ├── MyApp.Integration.Tests/               # Integration tests
│   │   ├── Api/
│   │   │   └── ApiClientTests.cs
│   │   ├── Database/
│   │   │   └── UserRepositoryTests.cs
│   │   └── MyApp.Integration.Tests.csproj
│   │
│   └── MyApp.UITests/                         # UI automation tests
│       ├── PageObjects/
│       │   ├── LoginPageObject.cs
│       │   └── UserListPageObject.cs
│       ├── LoginFlowTests.cs
│       └── MyApp.UITests.csproj
│
├── tools/
│   └── scripts/
│       ├── build-msix.ps1                     # MSIX packaging script
│       └── generate-resources.ps1
│
├── MyApp.sln
├── Directory.Build.props                      # Shared MSBuild properties
├── Directory.Packages.props                   # Central package management
├── global.json                                # .NET SDK version
├── nuget.config                               # NuGet sources
├── .editorconfig                              # Code style enforcement
└── .github/
    └── workflows/
        ├── build.yml
        └── release.yml
```

---

## 2. WPF Enterprise Structure (Alternative)

```
MyApp.Wpf/
├── src/
│   ├── MyApp.Wpf/                             # WPF application project
│   │   ├── App.xaml
│   │   ├── App.xaml.cs                        # Host builder, DI
│   │   ├── Views/
│   │   │   ├── MainWindow.xaml                # Shell with NavigationView
│   │   │   ├── MainWindow.xaml.cs
│   │   │   ├── Pages/                         # UserControls used as pages
│   │   │   │   ├── DashboardView.xaml
│   │   │   │   ├── DashboardView.xaml.cs
│   │   │   │   ├── UserListView.xaml
│   │   │   │   └── UserListView.xaml.cs
│   │   │   └── Dialogs/
│   │   │       ├── SettingsDialog.xaml
│   │   │       └── SettingsDialog.xaml.cs
│   │   │
│   │   ├── ViewModels/                        # Same MVVM pattern as WinUI 3
│   │   │   ├── MainWindowViewModel.cs
│   │   │   ├── DashboardViewModel.cs
│   │   │   └── UserListViewModel.cs
│   │   │
│   │   ├── Services/
│   │   ├── Models/
│   │   ├── Controls/
│   │   ├── Converters/
│   │   ├── Themes/                            # WPF themes (vs WinUI Styles)
│   │   │   ├── Generic.xaml                   # Default theme
│   │   │   ├── LightTheme.xaml
│   │   │   └── DarkTheme.xaml
│   │   ├── Resources/
│   │   │   └── Strings.resx                   # WPF uses .resx (not .resw)
│   │   └── MyApp.Wpf.csproj
│   │
│   ├── MyApp.Core/                            # Same shared project
│   └── MyApp.Infrastructure/
│
├── tests/
└── MyApp.Wpf.sln
```

---

## 3. .NET MAUI Enterprise Structure (Cross-Platform)

```
MyApp.Maui/
├── src/
│   ├── MyApp.Maui/
│   │   ├── App.xaml
│   │   ├── App.xaml.cs
│   │   ├── AppShell.xaml                      # Shell-based navigation
│   │   ├── AppShell.xaml.cs
│   │   ├── MauiProgram.cs                     # MAUI host builder (DI entry)
│   │   │
│   │   ├── Views/
│   │   │   ├── MainPage.xaml
│   │   │   ├── MainPage.xaml.cs
│   │   │   ├── Users/
│   │   │   │   ├── UserListPage.xaml
│   │   │   │   ├── UserListPage.xaml.cs
│   │   │   │   ├── UserDetailPage.xaml
│   │   │   │   └── UserDetailPage.xaml.cs
│   │   │   └── Settings/
│   │   │       ├── SettingsPage.xaml
│   │   │       └── SettingsPage.xaml.cs
│   │   │
│   │   ├── ViewModels/
│   │   │   ├── MainPageViewModel.cs
│   │   │   ├── UserListViewModel.cs
│   │   │   ├── UserDetailViewModel.cs
│   │   │   └── SettingsViewModel.cs
│   │   │
│   │   ├── Models/
│   │   ├── Services/
│   │   │
│   │   ├── Platforms/                         # Platform-specific code
│   │   │   ├── Android/
│   │   │   │   ├── AndroidManifest.xml
│   │   │   │   ├── MainApplication.cs
│   │   │   │   └── MainActivity.cs
│   │   │   ├── iOS/
│   │   │   │   ├── Info.plist
│   │   │   │   ├── AppDelegate.cs
│   │   │   │   └── Program.cs
│   │   │   ├── MacCatalyst/
│   │   │   │   ├── Info.plist
│   │   │   │   └── AppDelegate.cs
│   │   │   └── Windows/
│   │   │       ├── App.xaml
│   │   │       ├── App.xaml.cs
│   │   │       └── Package.appxmanifest
│   │   │
│   │   ├── Resources/
│   │   │   ├── AppIcon/
│   │   │   │   └── appicon.svg
│   │   │   ├── Fonts/
│   │   │   ├── Images/
│   │   │   ├── Raw/
│   │   │   ├── Splash/
│   │   │   │   └── splash.svg
│   │   │   └── Styles/
│   │   │       ├── Colors.xaml
│   │   │       └── Styles.xaml
│   │   │
│   │   ├── Handlers/                          # Custom MAUI handlers
│   │   │   └── CustomEntryHandler.cs
│   │   │
│   │   └── MyApp.Maui.csproj
│   │
│   ├── MyApp.Core/
│   └── MyApp.Infrastructure/
│
├── tests/
└── MyApp.Maui.sln
```

---

## 4. Project Files (.csproj)

### WinUI 3 .csproj

```xml
<!-- src/MyApp/MyApp.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
    <TargetPlatformMinVersion>10.0.17763.0</TargetPlatformMinVersion>
    <RootNamespace>MyApp</RootNamespace>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <Platforms>x86;x64;ARM64</Platforms>
    <RuntimeIdentifiers>win-x86;win-x64;win-arm64</RuntimeIdentifiers>
    <UseWinUI>true</UseWinUI>
    <EnableMsixTooling>true</EnableMsixTooling>
    <WindowsSdkPackageVersion>10.0.19041.38</WindowsSdkPackageVersion>

    <!-- Nullable and implicit usings -->
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>

    <!-- Trimming and AOT (optional, for smaller binaries) -->
    <PublishTrimmed>false</PublishTrimmed>
    <PublishAot>false</PublishAot>

    <!-- Version info -->
    <Version>1.0.0</Version>
    <AssemblyVersion>1.0.0.0</AssemblyVersion>
    <FileVersion>1.0.0.0</FileVersion>
    <Company>My Company</Company>
    <Product>My App</Product>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.3.2" />
    <PackageReference Include="CommunityToolkit.WinUI.Controls.SettingsCard" Version="8.1.240916" />
    <PackageReference Include="CommunityToolkit.WinUI.UI.Animations" Version="8.1.240916" />
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.1" />
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.1" />
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.6.240923002" />
    <PackageReference Include="Microsoft.Windows.SDK.BuildTools" Version="10.0.26100.1742" />
    <PackageReference Include="Serilog.Extensions.Hosting" Version="8.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="6.0.0" />
    <PackageReference Include="WinUIEx" Version="2.4.2" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\MyApp.Core\MyApp.Core.csproj" />
    <ProjectReference Include="..\MyApp.Infrastructure\MyApp.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

### WPF .csproj

```xml
<!-- src/MyApp.Wpf/MyApp.Wpf.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <ApplicationIcon>Assets\app-icon.ico</ApplicationIcon>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.3.2" />
    <PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.1" />
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.1" />
    <PackageReference Include="MaterialDesignThemes" Version="5.1.0" />
    <PackageReference Include="Serilog.Extensions.Hosting" Version="8.0.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\MyApp.Core\MyApp.Core.csproj" />
    <ProjectReference Include="..\MyApp.Infrastructure\MyApp.Infrastructure.csproj" />
  </ItemGroup>
</Project>
```

### .NET MAUI .csproj

```xml
<!-- src/MyApp.Maui/MyApp.Maui.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFrameworks>net8.0-android;net8.0-ios;net8.0-maccatalyst</TargetFrameworks>
    <TargetFrameworks Condition="$([MSBuild]::IsOSPlatform('windows'))">
      $(TargetFrameworks);net8.0-windows10.0.19041.0
    </TargetFrameworks>
    <OutputType>Exe</OutputType>
    <RootNamespace>MyApp.Maui</RootNamespace>
    <UseMaui>true</UseMaui>
    <SingleProject>true</SingleProject>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>

    <!-- App metadata -->
    <ApplicationTitle>My App</ApplicationTitle>
    <ApplicationId>com.mycompany.myapp</ApplicationId>
    <ApplicationDisplayVersion>1.0</ApplicationDisplayVersion>
    <ApplicationVersion>1</ApplicationVersion>

    <!-- Min platform versions -->
    <SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'ios'">15.0</SupportedOSPlatformVersion>
    <SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'maccatalyst'">14.0</SupportedOSPlatformVersion>
    <SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'android'">24.0</SupportedOSPlatformVersion>
    <SupportedOSPlatformVersion Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'windows'">10.0.17763.0</SupportedOSPlatformVersion>
  </PropertyGroup>

  <ItemGroup>
    <!-- MAUI Essentials -->
    <PackageReference Include="CommunityToolkit.Maui" Version="9.1.0" />
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.3.2" />
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.1" />
  </ItemGroup>

  <!-- Platform-specific conditional references -->
  <ItemGroup Condition="$([MSBuild]::GetTargetPlatformIdentifier('$(TargetFramework)')) == 'windows'">
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.6.240923002" />
  </ItemGroup>
</Project>
```

### Core Library .csproj

```xml
<!-- src/MyApp.Core/MyApp.Core.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="FluentValidation" Version="11.10.0" />
  </ItemGroup>
</Project>
```

### Infrastructure .csproj

```xml
<!-- src/MyApp.Infrastructure/MyApp.Infrastructure.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.10" />
    <PackageReference Include="Microsoft.Extensions.Http" Version="8.0.1" />
    <PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
    <PackageReference Include="Refit.HttpClientFactory" Version="7.2.1" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\MyApp.Core\MyApp.Core.csproj" />
  </ItemGroup>
</Project>
```

### Directory.Build.props (Shared properties)

```xml
<!-- Directory.Build.props (root of repo) -->
<Project>
  <PropertyGroup>
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisLevel>latest-recommended</AnalysisLevel>

    <!-- Versioning -->
    <Version>1.0.0</Version>
    <Authors>My Company</Authors>
    <Company>My Company</Company>
    <Copyright>Copyright (c) 2025 My Company</Copyright>
  </PropertyGroup>

  <ItemGroup>
    <!-- Analyzers for all projects -->
    <PackageReference Include="Microsoft.CodeAnalysis.NetAnalyzers" Version="8.0.0">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers</IncludeAssets>
    </PackageReference>
  </ItemGroup>
</Project>
```

### Directory.Packages.props (Central Package Management)

```xml
<!-- Directory.Packages.props -->
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>

  <ItemGroup>
    <!-- MVVM -->
    <PackageVersion Include="CommunityToolkit.Mvvm" Version="8.3.2" />

    <!-- DI / Hosting -->
    <PackageVersion Include="Microsoft.Extensions.Hosting" Version="8.0.1" />
    <PackageVersion Include="Microsoft.Extensions.Http" Version="8.0.1" />
    <PackageVersion Include="Microsoft.Extensions.DependencyInjection" Version="8.0.1" />

    <!-- Data -->
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.10" />

    <!-- Logging -->
    <PackageVersion Include="Serilog.Extensions.Hosting" Version="8.0.0" />
    <PackageVersion Include="Serilog.Sinks.File" Version="6.0.0" />
    <PackageVersion Include="Serilog.Sinks.Debug" Version="3.0.0" />

    <!-- HTTP -->
    <PackageVersion Include="Refit.HttpClientFactory" Version="7.2.1" />
    <PackageVersion Include="Polly.Extensions.Http" Version="3.0.0" />

    <!-- Validation -->
    <PackageVersion Include="FluentValidation" Version="11.10.0" />

    <!-- UI (WinUI) -->
    <PackageVersion Include="Microsoft.WindowsAppSDK" Version="1.6.240923002" />
    <PackageVersion Include="CommunityToolkit.WinUI.Controls.SettingsCard" Version="8.1.240916" />
    <PackageVersion Include="WinUIEx" Version="2.4.2" />

    <!-- Testing -->
    <PackageVersion Include="xunit" Version="2.9.2" />
    <PackageVersion Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageVersion Include="Moq" Version="4.20.72" />
    <PackageVersion Include="FluentAssertions" Version="6.12.2" />
    <PackageVersion Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
  </ItemGroup>
</Project>
```

---

## 5. MVVM with CommunityToolkit.Mvvm -- Complete Patterns

### ViewModel with Source Generators

```csharp
// ViewModels/UserListViewModel.cs
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using MyApp.Models;
using MyApp.Services.Data;
using MyApp.Services.Dialog;
using MyApp.Services.Navigation;

namespace MyApp.ViewModels;

public partial class UserListViewModel : ObservableRecipient,
    INavigationAware,
    IRecipient<UserUpdatedMessage>
{
    private readonly IUserService _userService;
    private readonly INavigationService _navigationService;
    private readonly IDialogService _dialogService;

    // Source generator creates: public ObservableCollection<User> Users { get; set; }
    // with INotifyPropertyChanged support
    [ObservableProperty]
    private ObservableCollection<User> _users = new();

    // NotifyCanExecuteChangedFor: re-evaluates CanDeleteUser when SelectedUser changes
    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(DeleteUserCommand))]
    [NotifyCanExecuteChangedFor(nameof(EditUserCommand))]
    [NotifyPropertyChangedFor(nameof(HasSelection))]
    private User? _selectedUser;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(FilteredUsers))]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private string? _errorMessage;

    // Computed property
    public bool HasSelection => SelectedUser is not null;

    public IEnumerable<User> FilteredUsers =>
        string.IsNullOrWhiteSpace(SearchText)
            ? Users
            : Users.Where(u =>
                u.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase) ||
                u.Email.Contains(SearchText, StringComparison.OrdinalIgnoreCase));

    public UserListViewModel(
        IUserService userService,
        INavigationService navigationService,
        IDialogService dialogService,
        IMessenger messenger) : base(messenger)
    {
        _userService = userService;
        _navigationService = navigationService;
        _dialogService = dialogService;

        // Register for messages when active
        IsActive = true;
    }

    // ─── Commands (source-generated) ───

    [RelayCommand]
    private async Task LoadUsersAsync(CancellationToken cancellationToken)
    {
        IsLoading = true;
        ErrorMessage = null;
        try
        {
            var users = await _userService.GetUsersAsync(cancellationToken);
            Users = new ObservableCollection<User>(users);
        }
        catch (OperationCanceledException)
        {
            // Cancelled -- ignore
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Failed to load users: {ex.Message}";
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand(CanExecute = nameof(CanDeleteUser))]
    private async Task DeleteUserAsync()
    {
        if (SelectedUser is null) return;

        var confirmed = await _dialogService.ShowConfirmationAsync(
            "Delete User",
            $"Are you sure you want to delete {SelectedUser.Name}?");

        if (!confirmed) return;

        try
        {
            await _userService.DeleteUserAsync(SelectedUser.Id);
            Users.Remove(SelectedUser);
            SelectedUser = null;

            // Notify other ViewModels
            Messenger.Send(new UserDeletedMessage(SelectedUser!.Id));
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Failed to delete user: {ex.Message}";
        }
    }

    private bool CanDeleteUser() => SelectedUser is not null;

    [RelayCommand(CanExecute = nameof(CanEditUser))]
    private void EditUser()
    {
        if (SelectedUser is null) return;
        _navigationService.NavigateTo<UserDetailPage>(SelectedUser.Id);
    }

    private bool CanEditUser() => SelectedUser is not null;

    [RelayCommand]
    private void CreateUser()
    {
        _navigationService.NavigateTo<UserDetailPage>();
    }

    [RelayCommand]
    private async Task RefreshAsync(CancellationToken cancellationToken)
    {
        await LoadUsersAsync(cancellationToken);
    }

    // ─── Property change hooks (source-generated partial methods) ───

    partial void OnSearchTextChanged(string value)
    {
        // Triggers FilteredUsers re-evaluation via NotifyPropertyChangedFor
        OnPropertyChanged(nameof(FilteredUsers));
    }

    // ─── INavigationAware ───

    public async Task OnNavigatedToAsync(object? parameter)
    {
        await LoadUsersAsync(CancellationToken.None);
    }

    public Task OnNavigatedFromAsync()
    {
        // Cleanup if needed
        return Task.CompletedTask;
    }

    // ─── IRecipient<UserUpdatedMessage> ───

    public void Receive(UserUpdatedMessage message)
    {
        // Another ViewModel updated a user -- refresh the list
        var existingUser = Users.FirstOrDefault(u => u.Id == message.UserId);
        if (existingUser is not null)
        {
            var index = Users.IndexOf(existingUser);
            Users[index] = message.UpdatedUser;
        }
    }
}
```

### Detail ViewModel with Validation

```csharp
// ViewModels/UserDetailViewModel.cs
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using System.ComponentModel.DataAnnotations;

namespace MyApp.ViewModels;

public partial class UserDetailViewModel : ObservableValidator, INavigationAware
{
    private readonly IUserService _userService;
    private readonly INavigationService _navigationService;
    private readonly IMessenger _messenger;

    private int? _userId;

    [ObservableProperty]
    [Required(ErrorMessage = "Name is required")]
    [MinLength(2, ErrorMessage = "Name must be at least 2 characters")]
    [MaxLength(100)]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    private string _name = string.Empty;

    [ObservableProperty]
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    [NotifyDataErrorInfo]
    [NotifyCanExecuteChangedFor(nameof(SaveCommand))]
    private string _email = string.Empty;

    [ObservableProperty]
    [Phone(ErrorMessage = "Invalid phone number")]
    [NotifyDataErrorInfo]
    private string? _phone;

    [ObservableProperty]
    private UserRole _selectedRole = UserRole.User;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private bool _isSaving;

    [ObservableProperty]
    private bool _isNewUser;

    public string Title => IsNewUser ? "Create User" : "Edit User";

    public UserDetailViewModel(
        IUserService userService,
        INavigationService navigationService,
        IMessenger messenger)
    {
        _userService = userService;
        _navigationService = navigationService;
        _messenger = messenger;
    }

    [RelayCommand(CanExecute = nameof(CanSave))]
    private async Task SaveAsync()
    {
        ValidateAllProperties();
        if (HasErrors) return;

        IsSaving = true;
        try
        {
            var user = new User
            {
                Id = _userId ?? 0,
                Name = Name,
                Email = Email,
                Phone = Phone,
                Role = SelectedRole,
            };

            if (IsNewUser)
            {
                var created = await _userService.CreateUserAsync(user);
                _messenger.Send(new UserCreatedMessage(created));
            }
            else
            {
                await _userService.UpdateUserAsync(user);
                _messenger.Send(new UserUpdatedMessage(user.Id, user));
            }

            _navigationService.GoBack();
        }
        catch (Exception ex)
        {
            // Show error
        }
        finally
        {
            IsSaving = false;
        }
    }

    private bool CanSave() =>
        !HasErrors &&
        !string.IsNullOrWhiteSpace(Name) &&
        !string.IsNullOrWhiteSpace(Email) &&
        !IsSaving;

    [RelayCommand]
    private void Cancel()
    {
        _navigationService.GoBack();
    }

    public async Task OnNavigatedToAsync(object? parameter)
    {
        if (parameter is int userId)
        {
            _userId = userId;
            IsNewUser = false;
            IsLoading = true;

            var user = await _userService.GetUserAsync(userId);
            if (user is not null)
            {
                Name = user.Name;
                Email = user.Email;
                Phone = user.Phone;
                SelectedRole = user.Role;
            }

            IsLoading = false;
        }
        else
        {
            IsNewUser = true;
        }

        OnPropertyChanged(nameof(Title));
    }

    public Task OnNavigatedFromAsync() => Task.CompletedTask;
}
```

### Messenger Messages

```csharp
// Messages/UserMessages.cs
using CommunityToolkit.Mvvm.Messaging.Messages;

namespace MyApp.Messages;

// Simple message (no response)
public sealed record UserCreatedMessage(User User);
public sealed record UserDeletedMessage(int UserId);
public sealed record UserUpdatedMessage(int UserId, User UpdatedUser);

// Request message (with response)
public sealed class CurrentUserRequestMessage : RequestMessage<User?>;

// Value changed message
public sealed class ThemeChangedMessage : ValueChangedMessage<AppTheme>
{
    public ThemeChangedMessage(AppTheme value) : base(value) { }
}
```

---

## 6. Dependency Injection Setup

### WinUI 3 App.xaml.cs

```csharp
// App.xaml.cs (WinUI 3)
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.UI.Xaml;
using Serilog;

namespace MyApp;

public partial class App : Application
{
    public static IHost Host { get; private set; } = null!;

    public static T GetService<T>() where T : class =>
        Host.Services.GetRequiredService<T>();

    public App()
    {
        InitializeComponent();

        Host = Microsoft.Extensions.Hosting.Host
            .CreateDefaultBuilder()
            .UseSerilog((context, config) =>
            {
                config
                    .MinimumLevel.Debug()
                    .WriteTo.Debug()
                    .WriteTo.File(
                        Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                            "MyApp", "Logs", "app-.log"),
                        rollingInterval: RollingInterval.Day,
                        retainedFileCountLimit: 7);
            })
            .ConfigureServices((context, services) =>
            {
                // ─── Services (Singleton) ───
                services.AddSingleton<INavigationService, NavigationService>();
                services.AddSingleton<IThemeService, ThemeService>();
                services.AddSingleton<ISettingsService, SettingsService>();
                services.AddSingleton<IDialogService, DialogService>();
                services.AddSingleton<INotificationService, NotificationService>();
                services.AddSingleton<WeakReferenceMessenger>();
                services.AddSingleton<IMessenger>(sp =>
                    sp.GetRequiredService<WeakReferenceMessenger>());

                // ─── Services (Scoped/Transient) ───
                services.AddTransient<IUserService, UserService>();
                services.AddTransient<IAuthService, AuthService>();

                // ─── ViewModels (Transient -- new instance per navigation) ───
                services.AddTransient<ShellViewModel>();
                services.AddTransient<DashboardViewModel>();
                services.AddTransient<UserListViewModel>();
                services.AddTransient<UserDetailViewModel>();
                services.AddTransient<LoginViewModel>();
                services.AddTransient<SettingsViewModel>();

                // ─── Views (Transient) ───
                services.AddTransient<ShellPage>();
                services.AddTransient<DashboardPage>();
                services.AddTransient<UserListPage>();
                services.AddTransient<UserDetailPage>();
                services.AddTransient<LoginPage>();
                services.AddTransient<SettingsPage>();
                services.AddTransient<MainWindow>();

                // ─── HTTP Client with Polly retry ───
                services.AddHttpClient<IApiClient, ApiClient>(client =>
                {
                    client.BaseAddress = new Uri("https://api.myapp.com");
                    client.Timeout = TimeSpan.FromSeconds(30);
                    client.DefaultRequestHeaders.Add("Accept", "application/json");
                })
                .AddPolicyHandler(GetRetryPolicy())
                .AddHttpMessageHandler<AuthHeaderHandler>();

                services.AddTransient<AuthHeaderHandler>();

                // ─── Database (EF Core SQLite) ───
                services.AddDbContext<AppDbContext>(options =>
                {
                    var dbPath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                        "MyApp", "app.db");
                    options.UseSqlite($"Data Source={dbPath}");
                });
            })
            .Build();
    }

    protected override async void OnLaunched(LaunchActivatedEventArgs args)
    {
        await Host.StartAsync();

        // Run EF migrations
        using var scope = Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();

        // Create and show main window
        var mainWindow = GetService<MainWindow>();
        mainWindow.Activate();
    }

    private static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError()
            .WaitAndRetryAsync(3, retryAttempt =>
                TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
    }
}
```

### WPF App.xaml.cs

```csharp
// App.xaml.cs (WPF)
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Windows;

namespace MyApp.Wpf;

public partial class App : Application
{
    public static IHost AppHost { get; private set; } = null!;

    public App()
    {
        AppHost = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // Same DI setup as WinUI 3
                services.AddSingleton<INavigationService, WpfNavigationService>();
                services.AddTransient<MainWindow>();
                services.AddTransient<MainWindowViewModel>();
                // ... rest of registrations
            })
            .Build();
    }

    protected override async void OnStartup(StartupEventArgs e)
    {
        await AppHost.StartAsync();

        var mainWindow = AppHost.Services.GetRequiredService<MainWindow>();
        mainWindow.Show();

        base.OnStartup(e);
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        await AppHost.StopAsync();
        AppHost.Dispose();
        base.OnExit(e);
    }
}
```

### MAUI MauiProgram.cs

```csharp
// MauiProgram.cs (.NET MAUI)
using CommunityToolkit.Maui;
using Microsoft.Extensions.Logging;

namespace MyApp.Maui;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();

        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

#if DEBUG
        builder.Logging.AddDebug();
#endif

        // Services
        builder.Services.AddSingleton<INavigationService, MauiNavigationService>();
        builder.Services.AddTransient<IUserService, UserService>();

        // ViewModels
        builder.Services.AddTransient<MainPageViewModel>();
        builder.Services.AddTransient<UserListViewModel>();

        // Views
        builder.Services.AddTransient<MainPage>();
        builder.Services.AddTransient<UserListPage>();

        // Platform-specific services
#if WINDOWS
        builder.Services.AddSingleton<INotificationService, WindowsNotificationService>();
#elif MACCATALYST
        builder.Services.AddSingleton<INotificationService, MacNotificationService>();
#else
        builder.Services.AddSingleton<INotificationService, MobileNotificationService>();
#endif

        // HTTP
        builder.Services.AddHttpClient<ApiClient>(client =>
        {
            client.BaseAddress = new Uri("https://api.myapp.com");
        });

        return builder.Build();
    }
}
```

---

## 7. Navigation Service Implementation

```csharp
// Services/Navigation/INavigationService.cs
namespace MyApp.Services.Navigation;

public interface INavigationService
{
    bool CanGoBack { get; }
    void NavigateTo<TPage>(object? parameter = null) where TPage : Page;
    void NavigateTo(Type pageType, object? parameter = null);
    void GoBack();
}

// Services/Navigation/INavigationAware.cs
public interface INavigationAware
{
    Task OnNavigatedToAsync(object? parameter);
    Task OnNavigatedFromAsync();
}
```

```csharp
// Services/Navigation/NavigationService.cs (WinUI 3)
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;

namespace MyApp.Services.Navigation;

public class NavigationService : INavigationService
{
    private Frame? _frame;
    private object? _lastParameter;

    public bool CanGoBack => _frame?.CanGoBack ?? false;

    public void Initialize(Frame frame)
    {
        _frame = frame;
        _frame.Navigated += OnNavigated;
    }

    public void NavigateTo<TPage>(object? parameter = null) where TPage : Page
    {
        NavigateTo(typeof(TPage), parameter);
    }

    public void NavigateTo(Type pageType, object? parameter = null)
    {
        if (_frame is null) throw new InvalidOperationException("Frame not initialized");

        // Don't navigate to the same page with same parameter
        if (_frame.Content?.GetType() == pageType && _lastParameter == parameter)
            return;

        _lastParameter = parameter;
        _frame.Navigate(pageType, parameter);
    }

    public void GoBack()
    {
        if (_frame?.CanGoBack == true)
            _frame.GoBack();
    }

    private async void OnNavigated(object sender, NavigationEventArgs e)
    {
        // Notify old page
        if (e.Content is FrameworkElement { DataContext: INavigationAware oldVm } oldPage)
        {
            // This fires for the OLD page -- use NavigatedFrom on the previous content
        }

        // Resolve ViewModel via DI and set DataContext
        if (e.Content is Page page)
        {
            var viewModelType = GetViewModelType(page.GetType());
            if (viewModelType is not null)
            {
                var viewModel = App.GetService(viewModelType);
                page.DataContext = viewModel;

                if (viewModel is INavigationAware navigationAware)
                {
                    await navigationAware.OnNavigatedToAsync(e.Parameter);
                }
            }
        }
    }

    private static Type? GetViewModelType(Type pageType)
    {
        // Convention: UserListPage -> UserListViewModel
        var viewModelName = pageType.FullName!
            .Replace(".Views.", ".ViewModels.")
            .Replace("Page", "ViewModel");

        return Type.GetType(viewModelName);
    }
}
```

---

## 8. Views (XAML)

### Shell Page with NavigationView

```xml
<!-- Views/Shell/ShellPage.xaml (WinUI 3) -->
<Page
    x:Class="MyApp.Views.Shell.ShellPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <NavigationView
        x:Name="NavView"
        IsBackButtonVisible="Auto"
        IsBackEnabled="{x:Bind ViewModel.CanGoBack, Mode=OneWay}"
        BackRequested="NavView_BackRequested"
        ItemInvoked="NavView_ItemInvoked"
        PaneDisplayMode="Left"
        OpenPaneLength="240">

        <NavigationView.MenuItems>
            <NavigationViewItem
                Content="Dashboard"
                Icon="Home"
                Tag="Dashboard" />
            <NavigationViewItem
                Content="Users"
                Icon="People"
                Tag="Users" />
            <NavigationViewItemSeparator />
        </NavigationView.MenuItems>

        <NavigationView.FooterMenuItems>
            <NavigationViewItem
                Content="Settings"
                Icon="Setting"
                Tag="Settings" />
        </NavigationView.FooterMenuItems>

        <Frame x:Name="ContentFrame" />
    </NavigationView>
</Page>
```

### User List Page with Data Binding

```xml
<!-- Views/Users/UserListPage.xaml (WinUI 3) -->
<Page
    x:Class="MyApp.Views.Users.UserListPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    xmlns:models="using:MyApp.Models"
    xmlns:controls="using:MyApp.Controls"
    mc:Ignorable="d">

    <Page.Resources>
        <DataTemplate x:Key="UserItemTemplate" x:DataType="models:User">
            <Grid Padding="8" ColumnSpacing="12">
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width="Auto" />
                    <ColumnDefinition Width="*" />
                    <ColumnDefinition Width="Auto" />
                </Grid.ColumnDefinitions>

                <PersonPicture
                    Grid.Column="0"
                    DisplayName="{x:Bind Name}"
                    Width="40" Height="40" />

                <StackPanel Grid.Column="1" VerticalAlignment="Center">
                    <TextBlock
                        Text="{x:Bind Name}"
                        Style="{StaticResource BodyStrongTextBlockStyle}" />
                    <TextBlock
                        Text="{x:Bind Email}"
                        Style="{StaticResource CaptionTextBlockStyle}"
                        Foreground="{ThemeResource TextFillColorSecondaryBrush}" />
                </StackPanel>

                <TextBlock
                    Grid.Column="2"
                    Text="{x:Bind Role}"
                    VerticalAlignment="Center"
                    Style="{StaticResource CaptionTextBlockStyle}" />
            </Grid>
        </DataTemplate>
    </Page.Resources>

    <Grid Padding="24" RowSpacing="16">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto" />
            <RowDefinition Height="Auto" />
            <RowDefinition Height="*" />
        </Grid.RowDefinitions>

        <!-- Header -->
        <Grid Grid.Row="0">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="Auto" />
            </Grid.ColumnDefinitions>

            <TextBlock
                Text="Users"
                Style="{StaticResource TitleTextBlockStyle}" />

            <StackPanel Grid.Column="1" Orientation="Horizontal" Spacing="8">
                <Button
                    Content="Refresh"
                    Command="{x:Bind ViewModel.RefreshCommand}" />
                <Button
                    Content="Add User"
                    Style="{StaticResource AccentButtonStyle}"
                    Command="{x:Bind ViewModel.CreateUserCommand}" />
            </StackPanel>
        </Grid>

        <!-- Search -->
        <AutoSuggestBox
            Grid.Row="1"
            QueryIcon="Find"
            PlaceholderText="Search users..."
            Text="{x:Bind ViewModel.SearchText, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"
            Width="300"
            HorizontalAlignment="Left" />

        <!-- Content -->
        <Grid Grid.Row="2">
            <!-- Loading overlay -->
            <ProgressRing
                IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}"
                Visibility="{x:Bind ViewModel.IsLoading, Mode=OneWay}" />

            <!-- Error message -->
            <InfoBar
                IsOpen="{x:Bind ViewModel.ErrorMessage, Mode=OneWay, Converter={StaticResource NullToBoolConverter}}"
                Severity="Error"
                Title="Error"
                Message="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}"
                IsClosable="True" />

            <!-- User list -->
            <ListView
                ItemsSource="{x:Bind ViewModel.FilteredUsers, Mode=OneWay}"
                ItemTemplate="{StaticResource UserItemTemplate}"
                SelectedItem="{x:Bind ViewModel.SelectedUser, Mode=TwoWay}"
                SelectionMode="Single"
                IsItemClickEnabled="True">
                <ListView.ItemContainerStyle>
                    <Style TargetType="ListViewItem">
                        <Setter Property="HorizontalContentAlignment" Value="Stretch" />
                    </Style>
                </ListView.ItemContainerStyle>
            </ListView>
        </Grid>
    </Grid>
</Page>
```

### Code-Behind (Minimal)

```csharp
// Views/Users/UserListPage.xaml.cs
namespace MyApp.Views.Users;

public sealed partial class UserListPage : Page
{
    public UserListViewModel ViewModel => (UserListViewModel)DataContext;

    public UserListPage()
    {
        InitializeComponent();
        // DataContext is set by NavigationService via DI
    }
}
```

---

## 9. Service Layer Patterns

### Repository Pattern with EF Core

```csharp
// Infrastructure/Database/AppDbContext.cs
using Microsoft.EntityFrameworkCore;

namespace MyApp.Infrastructure.Database;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Setting> Settings => Set<Setting>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
```

```csharp
// Infrastructure/Database/Configurations/UserConfiguration.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MyApp.Infrastructure.Database.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Name).HasMaxLength(100).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(255).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.Role).HasConversion<string>();
    }
}
```

### HTTP API Client with Refit

```csharp
// Infrastructure/Api/IMyAppApi.cs
using Refit;

namespace MyApp.Infrastructure.Api;

public interface IMyAppApi
{
    [Get("/api/users")]
    Task<List<UserDto>> GetUsersAsync(CancellationToken cancellationToken = default);

    [Get("/api/users/{id}")]
    Task<UserDto> GetUserAsync(int id, CancellationToken cancellationToken = default);

    [Post("/api/users")]
    Task<UserDto> CreateUserAsync([Body] CreateUserRequest request,
        CancellationToken cancellationToken = default);

    [Put("/api/users/{id}")]
    Task<UserDto> UpdateUserAsync(int id, [Body] UpdateUserRequest request,
        CancellationToken cancellationToken = default);

    [Delete("/api/users/{id}")]
    Task DeleteUserAsync(int id, CancellationToken cancellationToken = default);
}
```

### Dialog Service

```csharp
// Services/Dialog/DialogService.cs (WinUI 3)
using Microsoft.UI.Xaml.Controls;

namespace MyApp.Services.Dialog;

public class DialogService : IDialogService
{
    private readonly IServiceProvider _serviceProvider;

    public DialogService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<bool> ShowConfirmationAsync(string title, string message)
    {
        var dialog = new ContentDialog
        {
            Title = title,
            Content = message,
            PrimaryButtonText = "Yes",
            SecondaryButtonText = "No",
            DefaultButton = ContentDialogButton.Secondary,
            XamlRoot = GetCurrentXamlRoot(),
        };

        var result = await dialog.ShowAsync();
        return result == ContentDialogResult.Primary;
    }

    public async Task ShowErrorAsync(string title, string message)
    {
        var dialog = new ContentDialog
        {
            Title = title,
            Content = message,
            CloseButtonText = "OK",
            XamlRoot = GetCurrentXamlRoot(),
        };

        await dialog.ShowAsync();
    }

    public async Task<string?> ShowInputAsync(string title, string placeholder)
    {
        var inputBox = new TextBox { PlaceholderText = placeholder };

        var dialog = new ContentDialog
        {
            Title = title,
            Content = inputBox,
            PrimaryButtonText = "OK",
            SecondaryButtonText = "Cancel",
            XamlRoot = GetCurrentXamlRoot(),
        };

        var result = await dialog.ShowAsync();
        return result == ContentDialogResult.Primary ? inputBox.Text : null;
    }

    private XamlRoot GetCurrentXamlRoot()
    {
        // Get XamlRoot from the current window
        var mainWindow = App.GetService<MainWindow>();
        return mainWindow.Content.XamlRoot;
    }
}
```

---

## 10. Testing

### ViewModel Unit Tests

```csharp
// tests/MyApp.Tests/ViewModels/UserListViewModelTests.cs
using CommunityToolkit.Mvvm.Messaging;
using FluentAssertions;
using Moq;
using Xunit;

namespace MyApp.Tests.ViewModels;

public class UserListViewModelTests
{
    private readonly Mock<IUserService> _userServiceMock;
    private readonly Mock<INavigationService> _navigationMock;
    private readonly Mock<IDialogService> _dialogMock;
    private readonly IMessenger _messenger;
    private readonly UserListViewModel _sut;

    public UserListViewModelTests()
    {
        _userServiceMock = new Mock<IUserService>();
        _navigationMock = new Mock<INavigationService>();
        _dialogMock = new Mock<IDialogService>();
        _messenger = new WeakReferenceMessenger();

        _sut = new UserListViewModel(
            _userServiceMock.Object,
            _navigationMock.Object,
            _dialogMock.Object,
            _messenger);
    }

    [Fact]
    public async Task LoadUsersCommand_ShouldPopulateUsers()
    {
        // Arrange
        var users = new List<User>
        {
            new() { Id = 1, Name = "John", Email = "john@test.com" },
            new() { Id = 2, Name = "Jane", Email = "jane@test.com" },
        };
        _userServiceMock.Setup(s => s.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(users);

        // Act
        await _sut.LoadUsersCommand.ExecuteAsync(null);

        // Assert
        _sut.Users.Should().HaveCount(2);
        _sut.IsLoading.Should().BeFalse();
        _sut.ErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task LoadUsersCommand_WhenError_ShouldSetErrorMessage()
    {
        // Arrange
        _userServiceMock.Setup(s => s.GetUsersAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Network error"));

        // Act
        await _sut.LoadUsersCommand.ExecuteAsync(null);

        // Assert
        _sut.Users.Should().BeEmpty();
        _sut.ErrorMessage.Should().Contain("Network error");
    }

    [Fact]
    public void DeleteUserCommand_WhenNoSelection_ShouldBeDisabled()
    {
        // Arrange
        _sut.SelectedUser = null;

        // Assert
        _sut.DeleteUserCommand.CanExecute(null).Should().BeFalse();
    }

    [Fact]
    public async Task DeleteUserCommand_WhenConfirmed_ShouldRemoveUser()
    {
        // Arrange
        var user = new User { Id = 1, Name = "John" };
        _sut.Users.Add(user);
        _sut.SelectedUser = user;
        _dialogMock.Setup(d => d.ShowConfirmationAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);

        // Act
        await _sut.DeleteUserCommand.ExecuteAsync(null);

        // Assert
        _sut.Users.Should().BeEmpty();
        _userServiceMock.Verify(s => s.DeleteUserAsync(1), Times.Once);
    }

    [Fact]
    public void SearchText_ShouldFilterUsers()
    {
        // Arrange
        _sut.Users.Add(new User { Name = "John Doe", Email = "john@test.com" });
        _sut.Users.Add(new User { Name = "Jane Smith", Email = "jane@test.com" });

        // Act
        _sut.SearchText = "John";

        // Assert
        _sut.FilteredUsers.Should().HaveCount(1);
        _sut.FilteredUsers.First().Name.Should().Be("John Doe");
    }
}
```

### Test .csproj

```xml
<!-- tests/MyApp.Tests/MyApp.Tests.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" />
    <PackageReference Include="xunit" />
    <PackageReference Include="xunit.runner.visualstudio" />
    <PackageReference Include="Moq" />
    <PackageReference Include="FluentAssertions" />
    <PackageReference Include="coverlet.collector" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\..\src\MyApp\MyApp.csproj" />
  </ItemGroup>
</Project>
```

---

## 11. Packaging (MSIX)

```xml
<!-- Package.appxmanifest (WinUI 3 MSIX) -->
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:mp="http://schemas.microsoft.com/appx/2014/phone/manifest"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">

  <Identity
    Name="MyCompany.MyApp"
    Publisher="CN=MyCompany"
    Version="1.0.0.0" />

  <Properties>
    <DisplayName>My App</DisplayName>
    <PublisherDisplayName>My Company</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Universal" MinVersion="10.0.17763.0"
                        MaxVersionTested="10.0.22621.0" />
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0"
                        MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <Resources>
    <Resource Language="x-generate" />
  </Resources>

  <Applications>
    <Application Id="App"
      Executable="$targetnametoken$.exe"
      EntryPoint="$targetentrypoint$">

      <uap:VisualElements
        DisplayName="My App"
        Description="My desktop application"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
        <uap:SplashScreen Image="Assets\SplashScreen.png" />
      </uap:VisualElements>

      <!-- File association -->
      <Extensions>
        <uap:Extension Category="windows.fileTypeAssociation">
          <uap:FileTypeAssociation Name="myapp-file">
            <uap:DisplayName>My App File</uap:DisplayName>
            <uap:SupportedFileTypes>
              <uap:FileType>.myapp</uap:FileType>
            </uap:SupportedFileTypes>
          </uap:FileTypeAssociation>
        </uap:Extension>

        <!-- Protocol activation (deep linking) -->
        <uap:Extension Category="windows.protocol">
          <uap:Protocol Name="myapp">
            <uap:DisplayName>My App Protocol</uap:DisplayName>
          </uap:Protocol>
        </uap:Extension>

        <!-- Startup task -->
        <uap3:Extension Category="windows.startupTask">
          <uap3:StartupTask
            TaskId="MyAppStartup"
            Enabled="false"
            DisplayName="My App" />
        </uap3:Extension>
      </Extensions>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <Capability Name="internetClient" />
  </Capabilities>
</Package>
```

---

## 12. WPF vs WinUI 3 vs MAUI Key Differences

| Aspect | WPF | WinUI 3 | .NET MAUI |
|--------|-----|---------|-----------|
| Platform | Windows only | Windows only | Win, macOS, iOS, Android |
| .NET version | .NET 8+ (or Framework) | .NET 8+ | .NET 8+ |
| XAML flavor | WPF XAML | WinUI XAML (UWP-based) | MAUI XAML (Xamarin.Forms-based) |
| Rendering | DirectX / WPF rendering | DirectX / Composition | Native per-platform |
| Resources | `.resx` files | `.resw` files | `.resx` files |
| Navigation | Frame or custom | Frame + NavigationView | Shell navigation |
| Theming | ResourceDictionary merging | ThemeResource + system theme | AppThemeBinding |
| Dialogs | MessageBox, custom Window | ContentDialog | DisplayAlert / custom |
| Packaging | ClickOnce, MSIX, direct exe | MSIX (required) | MSIX (Win), .app (Mac) |
| Data binding | `{Binding}` or `{x:Bind}` | `{x:Bind}` (compiled) preferred | `{Binding}` |
| CommunityToolkit | CommunityToolkit.Mvvm | CommunityToolkit.Mvvm + WinUI toolkit | CommunityToolkit.Mvvm + MAUI toolkit |
| Maturity | Very mature (2006) | Modern (2021) | Evolving (2022) |
| Recommendation | Existing apps, legacy support | New Windows-only apps | Cross-platform apps |

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Business logic in code-behind | `Button_Click` handlers with HTTP calls, DB queries | Use `[RelayCommand]` in ViewModel, bind with `Command="{x:Bind}"` |
| No DI | `new UserService()` scattered in ViewModels | `Microsoft.Extensions.DependencyInjection` + Host builder |
| God ViewModel | 1000+ line ViewModel with 20+ properties | Split into sub-ViewModels, extract logic to services |
| Direct service calls in View | `_api.GetUsers()` in Page code-behind | ViewModel calls services, View binds to ViewModel |
| Manual INotifyPropertyChanged | `OnPropertyChanged("Name")` boilerplate | `CommunityToolkit.Mvvm` source generators: `[ObservableProperty]` |
| Hardcoded strings in XAML | `Text="Login"` | Use `.resw`/`.resx` resource files, `x:Uid` for WinUI |
| No async/await | Blocking UI thread with `.Result` or `.Wait()` | Always `async Task` in commands, never block |
| Tight coupling View-ViewModel | ViewModel references View types | Use interfaces, messaging (`IMessenger`), navigation abstraction |
| No error handling in commands | Unhandled exceptions crash app | try/catch in every async command, expose `ErrorMessage` property |
| Synchronous ObservableCollection updates from background thread | `CollectionChanged` crash on non-UI thread | Marshal to UI thread with `DispatcherQueue.TryEnqueue` |
| Converter abuse | Complex logic in value converters | Move logic to ViewModel computed properties |
| No test coverage for ViewModels | Bugs found only through manual testing | Unit test all ViewModel commands and state transitions |
| Monolithic .csproj | Single project with everything | Separate: App, Core, Infrastructure, Tests |
| No central package management | Version mismatches across projects | `Directory.Packages.props` with central versioning |
| Platform code in shared project | `#if WINDOWS` blocks in Core logic | Platform-specific DI registrations, interface abstractions |
| No resource cleanup | Memory leaks from event subscriptions | Use `WeakReferenceMessenger`, unsubscribe in disposal |

---

## 14. Enforcement Checklist

### MVVM (MANDATORY)
- [ ] Views have ZERO business logic in code-behind
- [ ] `CommunityToolkit.Mvvm` for `[ObservableProperty]`, `[RelayCommand]`
- [ ] ViewModels use `ObservableObject` or `ObservableRecipient` base class
- [ ] Commands use `[RelayCommand]` with `CanExecute` where needed
- [ ] Async commands use `[RelayCommand]` with `CancellationToken`
- [ ] Property validation via `ObservableValidator` + `[NotifyDataErrorInfo]`
- [ ] Inter-ViewModel communication via `IMessenger` (not direct references)

### Architecture
- [ ] DI via `Microsoft.Extensions.DependencyInjection` with Host builder
- [ ] Navigation abstracted behind `INavigationService`
- [ ] Services handle ALL business logic -- ViewModels orchestrate
- [ ] Dialogs abstracted behind `IDialogService`
- [ ] Multi-project solution: App, Core (shared logic), Infrastructure (external)
- [ ] `Directory.Build.props` for shared MSBuild settings
- [ ] `Directory.Packages.props` for central NuGet management

### UI
- [ ] Custom controls in `Controls/` -- reusable across views
- [ ] Resource dictionaries for styles (`Colors.xaml`, `TextStyles.xaml`)
- [ ] Theme support (dark/light/system) via `ThemeResource`
- [ ] Resource files (`.resw`/`.resx`) for ALL user-facing strings
- [ ] XAML data binding: prefer `{x:Bind}` (compiled) over `{Binding}` in WinUI

### Testing
- [ ] Unit tests for ALL ViewModels -- mock services via interfaces
- [ ] Unit tests for Core business logic services
- [ ] Integration tests for Infrastructure (API client, database)
- [ ] xUnit + Moq + FluentAssertions
- [ ] Test .csproj references main project

### Packaging and Distribution
- [ ] MSIX packaging configured for WinUI 3
- [ ] `Package.appxmanifest` with correct capabilities
- [ ] File associations and protocol handlers registered
- [ ] CI/CD pipeline for build, test, package
- [ ] Code analysis enabled (`EnforceCodeStyleInBuild`)
