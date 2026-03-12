# Native Desktop Project Structure (Qt / C++ / SwiftUI macOS)

> **AI Plugin Directive:** When generating a native desktop application using Qt/C++, SwiftUI macOS, or GTK, ALWAYS use this structure. This guide covers Qt 6 with CMake (primary) and SwiftUI macOS apps as the two dominant native desktop approaches.

**Core Rule: Separate UI code from business logic. Use the framework's recommended architecture (Qt Model/View with QML, SwiftUI MVVM with ObservableObject) and build system (CMake for Qt, Xcode/SPM for SwiftUI). NEVER mix UI rendering logic with data processing.**

---

## 1. Qt 6 / C++ Enterprise Project Structure

```
my-qt-app/
├── CMakeLists.txt                         # Root CMake configuration
├── cmake/
│   ├── CompilerWarnings.cmake             # Compiler warning flags
│   ├── StaticAnalyzers.cmake              # clang-tidy, cppcheck
│   ├── Sanitizers.cmake                   # ASan, UBSan, TSan
│   ├── Conan.cmake                        # Conan package manager integration
│   └── InstallRules.cmake                 # CPack / install rules
│
├── src/
│   ├── CMakeLists.txt                     # Source CMake (library + executable)
│   ├── main.cpp                           # Application entry point
│   │
│   ├── app/                               # Application shell
│   │   ├── Application.h                  # QApplication subclass
│   │   ├── Application.cpp
│   │   ├── AppController.h               # Top-level app controller
│   │   └── AppController.cpp
│   │
│   ├── ui/                                # UI layer
│   │   ├── qml/                           # QML files (Qt Quick UI)
│   │   │   ├── Main.qml                   # Root QML window
│   │   │   ├── qmldir                     # QML module definition
│   │   │   │
│   │   │   ├── pages/                     # Page-level views
│   │   │   │   ├── HomePage.qml
│   │   │   │   ├── UserListPage.qml
│   │   │   │   ├── UserDetailPage.qml
│   │   │   │   ├── SettingsPage.qml
│   │   │   │   └── LoginPage.qml
│   │   │   │
│   │   │   ├── components/                # Reusable QML components
│   │   │   │   ├── UserCard.qml
│   │   │   │   ├── AppButton.qml
│   │   │   │   ├── AppTextField.qml
│   │   │   │   ├── LoadingIndicator.qml
│   │   │   │   ├── SearchBar.qml
│   │   │   │   ├── NavigationRail.qml
│   │   │   │   ├── ConfirmDialog.qml
│   │   │   │   └── ErrorBanner.qml
│   │   │   │
│   │   │   ├── layouts/                   # Layout components
│   │   │   │   ├── AppLayout.qml
│   │   │   │   ├── SidebarLayout.qml
│   │   │   │   └── StackLayout.qml
│   │   │   │
│   │   │   └── theme/                     # Theming / styling
│   │   │       ├── Theme.qml              # Singleton theme object
│   │   │       ├── Colors.qml
│   │   │       └── Typography.qml
│   │   │
│   │   ├── widgets/                       # Qt Widgets UI (alternative to QML)
│   │   │   ├── MainWindow.h
│   │   │   ├── MainWindow.cpp
│   │   │   ├── MainWindow.ui             # Qt Designer form
│   │   │   ├── UserListWidget.h
│   │   │   ├── UserListWidget.cpp
│   │   │   ├── UserListWidget.ui
│   │   │   ├── SettingsDialog.h
│   │   │   ├── SettingsDialog.cpp
│   │   │   └── SettingsDialog.ui
│   │   │
│   │   └── resources/                     # Compiled resources
│   │       └── qml.qrc                    # QRC resource file for QML
│   │
│   ├── models/                            # Data models
│   │   ├── User.h
│   │   ├── User.cpp
│   │   ├── UserListModel.h               # QAbstractListModel subclass
│   │   ├── UserListModel.cpp
│   │   ├── UserFilterProxyModel.h        # QSortFilterProxyModel
│   │   ├── UserFilterProxyModel.cpp
│   │   ├── SettingsModel.h
│   │   └── SettingsModel.cpp
│   │
│   ├── viewmodels/                        # ViewModels (exposed to QML via Q_PROPERTY)
│   │   ├── UserListViewModel.h
│   │   ├── UserListViewModel.cpp
│   │   ├── UserDetailViewModel.h
│   │   ├── UserDetailViewModel.cpp
│   │   ├── SettingsViewModel.h
│   │   ├── SettingsViewModel.cpp
│   │   ├── LoginViewModel.h
│   │   └── LoginViewModel.cpp
│   │
│   ├── services/                          # Business logic services
│   │   ├── UserService.h
│   │   ├── UserService.cpp
│   │   ├── AuthService.h
│   │   ├── AuthService.cpp
│   │   ├── NetworkService.h               # HTTP client (QNetworkAccessManager)
│   │   ├── NetworkService.cpp
│   │   ├── UpdateService.h                # Application update checker
│   │   └── UpdateService.cpp
│   │
│   ├── core/                              # Infrastructure / low-level
│   │   ├── Database.h                     # SQLite wrapper (QSqlDatabase)
│   │   ├── Database.cpp
│   │   ├── HttpClient.h                   # REST API client
│   │   ├── HttpClient.cpp
│   │   ├── Settings.h                     # QSettings wrapper
│   │   ├── Settings.cpp
│   │   ├── FileManager.h                  # File I/O
│   │   ├── FileManager.cpp
│   │   ├── KeychainService.h             # Platform keychain (macOS, Windows Credential)
│   │   ├── KeychainService.cpp
│   │   ├── SingleInstance.h               # Single instance lock
│   │   └── SingleInstance.cpp
│   │
│   ├── plugins/                           # Qt plugin architecture
│   │   ├── IPlugin.h                      # Plugin interface
│   │   ├── PluginManager.h
│   │   ├── PluginManager.cpp
│   │   └── plugins/
│   │       ├── ExportPlugin/
│   │       │   ├── ExportPlugin.h
│   │       │   ├── ExportPlugin.cpp
│   │       │   └── CMakeLists.txt
│   │       └── ImportPlugin/
│   │           ├── ImportPlugin.h
│   │           ├── ImportPlugin.cpp
│   │           └── CMakeLists.txt
│   │
│   └── utils/
│       ├── Logger.h                       # Logging (spdlog or custom)
│       ├── Logger.cpp
│       ├── StringUtils.h
│       ├── StringUtils.cpp
│       ├── PlatformUtils.h               # Platform detection
│       └── PlatformUtils.cpp
│
├── tests/
│   ├── CMakeLists.txt                     # Test CMake configuration
│   ├── main.cpp                           # Test runner (Qt Test or GTest)
│   ├── test_user_service.cpp
│   ├── test_user_model.cpp
│   ├── test_http_client.cpp
│   ├── test_database.cpp
│   └── fixtures/
│       ├── test_data.json
│       └── test_database.sqlite
│
├── resources/
│   ├── app.qrc                            # Master resource file
│   ├── icons/
│   │   ├── app-icon.svg                   # Vector app icon
│   │   ├── app-icon.ico                   # Windows icon
│   │   ├── app-icon.icns                  # macOS icon
│   │   ├── toolbar/
│   │   │   ├── add.svg
│   │   │   ├── delete.svg
│   │   │   ├── edit.svg
│   │   │   ├── search.svg
│   │   │   ├── settings.svg
│   │   │   └── refresh.svg
│   │   └── status/
│   │       ├── online.svg
│   │       ├── offline.svg
│   │       └── busy.svg
│   │
│   ├── translations/                      # Internationalization
│   │   ├── app_en.ts                      # English (source)
│   │   ├── app_de.ts                      # German
│   │   ├── app_el.ts                      # Greek
│   │   ├── app_ja.ts                      # Japanese
│   │   └── app_zh.ts                      # Chinese
│   │
│   ├── fonts/
│   │   └── Inter-Variable.ttf
│   │
│   └── stylesheets/                       # Qt Style Sheets (Widgets)
│       ├── light.qss
│       └── dark.qss
│
├── packaging/
│   ├── windows/
│   │   ├── installer.nsi                  # NSIS installer script
│   │   ├── installer.iss                  # Inno Setup script (alternative)
│   │   └── app.manifest                   # Windows app manifest
│   ├── macos/
│   │   ├── Info.plist                     # macOS bundle info
│   │   ├── entitlements.plist             # Sandboxing entitlements
│   │   └── dmg-background.png
│   ├── linux/
│   │   ├── app.desktop                    # XDG desktop entry
│   │   ├── app.appdata.xml                # AppStream metadata
│   │   ├── app.flatpak.yml               # Flatpak manifest
│   │   └── app.spec                       # RPM spec file
│   └── CMakeLists.txt                     # CPack configuration
│
├── docs/
│   ├── architecture.md
│   └── coding-standards.md
│
├── .clang-format                          # C++ code formatting
├── .clang-tidy                            # Static analysis
├── .gitignore
├── vcpkg.json                             # vcpkg package manager manifest
├── conanfile.txt                          # Conan package manager (alternative)
├── Dockerfile                             # Docker build environment
└── .github/
    └── workflows/
        ├── build.yml                      # CI: build + test (Linux, macOS, Windows)
        └── release.yml                    # CD: package and publish
```

---

## 2. Root CMakeLists.txt

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.21)

project(MyQtApp
    VERSION 1.0.0
    DESCRIPTION "My Qt Desktop Application"
    LANGUAGES CXX
)

# ─── C++ Standard ───
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ─── Qt Configuration ───
set(CMAKE_AUTOMOC ON)    # Auto-run moc (Meta-Object Compiler)
set(CMAKE_AUTORCC ON)    # Auto-compile .qrc resource files
set(CMAKE_AUTOUIC ON)    # Auto-compile .ui designer files

# Find Qt 6
find_package(Qt6 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Quick
    QuickControls2
    Qml
    Network
    Sql
    LinguistTools
    Test
    Concurrent
)

# ─── Compiler Warnings ───
include(cmake/CompilerWarnings.cmake)

# ─── Static Analyzers ───
include(cmake/StaticAnalyzers.cmake)

# ─── Source and Tests ───
add_subdirectory(src)
add_subdirectory(tests)

# ─── Packaging (CPack) ───
include(cmake/InstallRules.cmake)
```

### Source CMakeLists.txt

```cmake
# src/CMakeLists.txt

# ─── Application Library (for testing) ───
add_library(myqtapp_lib STATIC
    # App
    app/Application.h
    app/Application.cpp
    app/AppController.h
    app/AppController.cpp

    # Models
    models/User.h
    models/User.cpp
    models/UserListModel.h
    models/UserListModel.cpp
    models/UserFilterProxyModel.h
    models/UserFilterProxyModel.cpp
    models/SettingsModel.h
    models/SettingsModel.cpp

    # ViewModels
    viewmodels/UserListViewModel.h
    viewmodels/UserListViewModel.cpp
    viewmodels/UserDetailViewModel.h
    viewmodels/UserDetailViewModel.cpp
    viewmodels/SettingsViewModel.h
    viewmodels/SettingsViewModel.cpp
    viewmodels/LoginViewModel.h
    viewmodels/LoginViewModel.cpp

    # Services
    services/UserService.h
    services/UserService.cpp
    services/AuthService.h
    services/AuthService.cpp
    services/NetworkService.h
    services/NetworkService.cpp

    # Core
    core/Database.h
    core/Database.cpp
    core/HttpClient.h
    core/HttpClient.cpp
    core/Settings.h
    core/Settings.cpp
    core/FileManager.h
    core/FileManager.cpp
    core/SingleInstance.h
    core/SingleInstance.cpp

    # Utils
    utils/Logger.h
    utils/Logger.cpp
    utils/StringUtils.h
    utils/StringUtils.cpp
    utils/PlatformUtils.h
    utils/PlatformUtils.cpp
)

target_link_libraries(myqtapp_lib PUBLIC
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Qml
    Qt6::Network
    Qt6::Sql
    Qt6::Concurrent
)

target_include_directories(myqtapp_lib PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})

# ─── QML Module ───
qt_add_qml_module(myqtapp_lib
    URI MyQtApp
    VERSION 1.0
    QML_FILES
        ui/qml/Main.qml
        ui/qml/pages/HomePage.qml
        ui/qml/pages/UserListPage.qml
        ui/qml/pages/UserDetailPage.qml
        ui/qml/pages/SettingsPage.qml
        ui/qml/pages/LoginPage.qml
        ui/qml/components/UserCard.qml
        ui/qml/components/AppButton.qml
        ui/qml/components/AppTextField.qml
        ui/qml/components/LoadingIndicator.qml
        ui/qml/components/SearchBar.qml
        ui/qml/components/NavigationRail.qml
        ui/qml/components/ConfirmDialog.qml
        ui/qml/components/ErrorBanner.qml
        ui/qml/layouts/AppLayout.qml
        ui/qml/layouts/SidebarLayout.qml
        ui/qml/theme/Theme.qml
        ui/qml/theme/Colors.qml
        ui/qml/theme/Typography.qml
    RESOURCES
        ${CMAKE_SOURCE_DIR}/resources/app.qrc
)

# ─── Executable ───
qt_add_executable(MyQtApp main.cpp)
target_link_libraries(MyQtApp PRIVATE myqtapp_lib)

# ─── Translations ───
set(TS_FILES
    ${CMAKE_SOURCE_DIR}/resources/translations/app_en.ts
    ${CMAKE_SOURCE_DIR}/resources/translations/app_de.ts
    ${CMAKE_SOURCE_DIR}/resources/translations/app_el.ts
    ${CMAKE_SOURCE_DIR}/resources/translations/app_ja.ts
)

qt_add_translations(MyQtApp
    TS_FILES ${TS_FILES}
    LUPDATE_OPTIONS -no-obsolete
)

# ─── Platform-specific settings ───
if(APPLE)
    set_target_properties(MyQtApp PROPERTIES
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_GUI_IDENTIFIER "com.mycompany.myqtapp"
        MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
        MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
        MACOSX_BUNDLE_INFO_PLIST ${CMAKE_SOURCE_DIR}/packaging/macos/Info.plist
        MACOSX_BUNDLE_ICON_FILE app-icon.icns
    )
elseif(WIN32)
    set_target_properties(MyQtApp PROPERTIES
        WIN32_EXECUTABLE TRUE
    )
    # Add Windows resource file (.rc) for icon
    target_sources(MyQtApp PRIVATE ${CMAKE_SOURCE_DIR}/resources/app.rc)
endif()

# ─── Install rules ───
install(TARGETS MyQtApp
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# Deploy Qt dependencies
qt_generate_deploy_app_script(
    TARGET MyQtApp
    OUTPUT_SCRIPT deploy_script
    NO_UNSUPPORTED_PLATFORM_ERROR
)
install(SCRIPT ${deploy_script})
```

### Test CMakeLists.txt

```cmake
# tests/CMakeLists.txt
enable_testing()

find_package(Qt6 REQUIRED COMPONENTS Test)

# Google Test (alternative to Qt Test)
# include(FetchContent)
# FetchContent_Declare(
#     googletest
#     URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
# )
# FetchContent_MakeAvailable(googletest)

# ─── Test executables ───
function(add_qt_test test_name test_source)
    add_executable(${test_name} ${test_source})
    target_link_libraries(${test_name} PRIVATE
        myqtapp_lib
        Qt6::Test
    )
    add_test(NAME ${test_name} COMMAND ${test_name})
endfunction()

add_qt_test(test_user_service test_user_service.cpp)
add_qt_test(test_user_model test_user_model.cpp)
add_qt_test(test_http_client test_http_client.cpp)
add_qt_test(test_database test_database.cpp)
```

---

## 3. Qt C++ Code Examples

### Main Entry Point

```cpp
// src/main.cpp
#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QIcon>
#include <QTranslator>
#include <QLocale>

#include "app/AppController.h"
#include "viewmodels/UserListViewModel.h"
#include "viewmodels/SettingsViewModel.h"
#include "core/Database.h"
#include "core/SingleInstance.h"
#include "utils/Logger.h"

int main(int argc, char *argv[])
{
    // Single instance check
    SingleInstance instance("com.mycompany.myqtapp");
    if (!instance.tryLock()) {
        // Send activation message to existing instance
        instance.sendActivateMessage();
        return 0;
    }

    QGuiApplication app(argc, argv);
    app.setApplicationName("MyQtApp");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("MyCompany");
    app.setOrganizationDomain("mycompany.com");
    app.setWindowIcon(QIcon(":/icons/app-icon.svg"));

    // Set Qt Quick Controls 2 style
    QQuickStyle::setStyle("Material");

    // Initialize logging
    Logger::init();

    // Initialize database
    Database db;
    if (!db.initialize()) {
        qCritical() << "Failed to initialize database";
        return 1;
    }
    db.runMigrations();

    // Load translations
    QTranslator translator;
    const QStringList uiLanguages = QLocale::system().uiLanguages();
    for (const QString &locale : uiLanguages) {
        if (translator.load(":/translations/app_" + QLocale(locale).name())) {
            app.installTranslator(&translator);
            break;
        }
    }

    // Create QML engine
    QQmlApplicationEngine engine;

    // Register C++ types with QML
    qmlRegisterSingletonInstance("MyQtApp", 1, 0, "AppController",
        new AppController(&engine));

    // Register ViewModels
    qmlRegisterType<UserListViewModel>("MyQtApp", 1, 0, "UserListViewModel");
    qmlRegisterType<SettingsViewModel>("MyQtApp", 1, 0, "SettingsViewModel");

    // Load main QML file
    const QUrl url(QStringLiteral("qrc:/qt/qml/MyQtApp/ui/qml/Main.qml"));
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed,
        &app, []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}
```

### ViewModel with Q_PROPERTY

```cpp
// src/viewmodels/UserListViewModel.h
#pragma once

#include <QObject>
#include <QQmlEngine>
#include <QAbstractListModel>
#include "models/UserListModel.h"
#include "models/UserFilterProxyModel.h"
#include "services/UserService.h"

class UserListViewModel : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    // Properties exposed to QML
    Q_PROPERTY(UserFilterProxyModel* users READ users CONSTANT)
    Q_PROPERTY(bool isLoading READ isLoading NOTIFY isLoadingChanged)
    Q_PROPERTY(QString searchText READ searchText WRITE setSearchText NOTIFY searchTextChanged)
    Q_PROPERTY(QString errorMessage READ errorMessage NOTIFY errorMessageChanged)
    Q_PROPERTY(int selectedIndex READ selectedIndex WRITE setSelectedIndex NOTIFY selectedIndexChanged)
    Q_PROPERTY(bool hasSelection READ hasSelection NOTIFY selectedIndexChanged)

public:
    explicit UserListViewModel(QObject *parent = nullptr);
    ~UserListViewModel() override;

    // Property getters
    UserFilterProxyModel* users() const;
    bool isLoading() const;
    QString searchText() const;
    QString errorMessage() const;
    int selectedIndex() const;
    bool hasSelection() const;

    // Property setters
    void setSearchText(const QString &text);
    void setSelectedIndex(int index);

    // Invokable methods (callable from QML)
    Q_INVOKABLE void loadUsers();
    Q_INVOKABLE void deleteUser(int index);
    Q_INVOKABLE void refreshUsers();
    Q_INVOKABLE void createUser(const QString &name, const QString &email);

signals:
    void isLoadingChanged();
    void searchTextChanged();
    void errorMessageChanged();
    void selectedIndexChanged();
    void userDeleted(int id);
    void userCreated(int id);
    void navigateToDetail(int userId);

private:
    UserListModel *m_model;
    UserFilterProxyModel *m_proxyModel;
    UserService *m_userService;
    bool m_isLoading = false;
    QString m_searchText;
    QString m_errorMessage;
    int m_selectedIndex = -1;

    void setLoading(bool loading);
    void setError(const QString &message);
};
```

```cpp
// src/viewmodels/UserListViewModel.cpp
#include "UserListViewModel.h"
#include <QDebug>

UserListViewModel::UserListViewModel(QObject *parent)
    : QObject(parent)
    , m_model(new UserListModel(this))
    , m_proxyModel(new UserFilterProxyModel(this))
    , m_userService(new UserService(this))
{
    m_proxyModel->setSourceModel(m_model);
    m_proxyModel->setFilterRole(UserListModel::NameRole);

    // Connect service signals
    connect(m_userService, &UserService::usersLoaded, this, [this](const QList<User> &users) {
        m_model->setUsers(users);
        setLoading(false);
    });

    connect(m_userService, &UserService::errorOccurred, this, [this](const QString &error) {
        setError(error);
        setLoading(false);
    });
}

UserListViewModel::~UserListViewModel() = default;

UserFilterProxyModel* UserListViewModel::users() const { return m_proxyModel; }
bool UserListViewModel::isLoading() const { return m_isLoading; }
QString UserListViewModel::searchText() const { return m_searchText; }
QString UserListViewModel::errorMessage() const { return m_errorMessage; }
int UserListViewModel::selectedIndex() const { return m_selectedIndex; }
bool UserListViewModel::hasSelection() const { return m_selectedIndex >= 0; }

void UserListViewModel::setSearchText(const QString &text) {
    if (m_searchText == text) return;
    m_searchText = text;
    m_proxyModel->setFilterFixedString(text);
    emit searchTextChanged();
}

void UserListViewModel::setSelectedIndex(int index) {
    if (m_selectedIndex == index) return;
    m_selectedIndex = index;
    emit selectedIndexChanged();
}

void UserListViewModel::loadUsers() {
    setLoading(true);
    setError(QString());
    m_userService->fetchUsers();
}

void UserListViewModel::deleteUser(int index) {
    auto sourceIndex = m_proxyModel->mapToSource(m_proxyModel->index(index, 0));
    auto user = m_model->userAt(sourceIndex.row());
    if (user.id > 0) {
        m_userService->deleteUser(user.id);
        m_model->removeUser(sourceIndex.row());
        emit userDeleted(user.id);
    }
}

void UserListViewModel::refreshUsers() {
    loadUsers();
}

void UserListViewModel::createUser(const QString &name, const QString &email) {
    m_userService->createUser(name, email);
}

void UserListViewModel::setLoading(bool loading) {
    if (m_isLoading == loading) return;
    m_isLoading = loading;
    emit isLoadingChanged();
}

void UserListViewModel::setError(const QString &message) {
    if (m_errorMessage == message) return;
    m_errorMessage = message;
    emit errorMessageChanged();
}
```

### QAbstractListModel

```cpp
// src/models/UserListModel.h
#pragma once

#include <QAbstractListModel>
#include "User.h"

class UserListModel : public QAbstractListModel
{
    Q_OBJECT

public:
    enum UserRoles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        EmailRole,
        RoleRole,
        CreatedAtRole,
    };

    explicit UserListModel(QObject *parent = nullptr);

    // QAbstractListModel interface
    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    // Data manipulation
    void setUsers(const QList<User> &users);
    void addUser(const User &user);
    void removeUser(int row);
    void updateUser(int row, const User &user);
    User userAt(int row) const;

private:
    QList<User> m_users;
};
```

```cpp
// src/models/UserListModel.cpp
#include "UserListModel.h"

UserListModel::UserListModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

int UserListModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return m_users.count();
}

QVariant UserListModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() >= m_users.count())
        return {};

    const auto &user = m_users.at(index.row());

    switch (role) {
    case IdRole:        return user.id;
    case NameRole:      return user.name;
    case EmailRole:     return user.email;
    case RoleRole:      return user.role;
    case CreatedAtRole: return user.createdAt;
    default:            return {};
    }
}

QHash<int, QByteArray> UserListModel::roleNames() const
{
    return {
        { IdRole,        "userId" },
        { NameRole,      "name" },
        { EmailRole,     "email" },
        { RoleRole,      "role" },
        { CreatedAtRole, "createdAt" },
    };
}

void UserListModel::setUsers(const QList<User> &users)
{
    beginResetModel();
    m_users = users;
    endResetModel();
}

void UserListModel::addUser(const User &user)
{
    beginInsertRows(QModelIndex(), m_users.count(), m_users.count());
    m_users.append(user);
    endInsertRows();
}

void UserListModel::removeUser(int row)
{
    if (row < 0 || row >= m_users.count()) return;
    beginRemoveRows(QModelIndex(), row, row);
    m_users.removeAt(row);
    endRemoveRows();
}

User UserListModel::userAt(int row) const
{
    if (row < 0 || row >= m_users.count()) return {};
    return m_users.at(row);
}
```

### QML Pages

```qml
// src/ui/qml/Main.qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import MyQtApp 1.0

ApplicationWindow {
    id: root
    visible: true
    width: 1200
    height: 800
    minimumWidth: 800
    minimumHeight: 600
    title: qsTr("My Qt App")

    // System theme detection
    Material.theme: AppController.isDarkMode ? Material.Dark : Material.Light
    Material.accent: Theme.accentColor

    // Navigation
    property string currentPage: "home"

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Navigation rail (sidebar)
        NavigationRail {
            Layout.fillHeight: true
            Layout.preferredWidth: 64
            currentPage: root.currentPage
            onNavigate: (page) => root.currentPage = page
        }

        // Separator
        Rectangle {
            Layout.fillHeight: true
            Layout.preferredWidth: 1
            color: Theme.borderColor
        }

        // Content area
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: {
                switch (root.currentPage) {
                case "home": return 0;
                case "users": return 1;
                case "settings": return 2;
                default: return 0;
                }
            }

            HomePage {}
            UserListPage {}
            SettingsPage {}
        }
    }
}
```

```qml
// src/ui/qml/pages/UserListPage.qml
import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import MyQtApp 1.0

Page {
    id: root

    UserListViewModel {
        id: viewModel
        Component.onCompleted: viewModel.loadUsers()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 24
        spacing: 16

        // Header
        RowLayout {
            Layout.fillWidth: true

            Label {
                text: qsTr("Users")
                font.pixelSize: 24
                font.weight: Font.Bold
            }

            Item { Layout.fillWidth: true }

            AppButton {
                text: qsTr("Refresh")
                onClicked: viewModel.refreshUsers()
            }

            AppButton {
                text: qsTr("Add User")
                highlighted: true
                onClicked: addUserDialog.open()
            }
        }

        // Search
        SearchBar {
            Layout.preferredWidth: 300
            placeholderText: qsTr("Search users...")
            text: viewModel.searchText
            onTextChanged: viewModel.searchText = text
        }

        // Error banner
        ErrorBanner {
            Layout.fillWidth: true
            visible: viewModel.errorMessage.length > 0
            message: viewModel.errorMessage
        }

        // Loading indicator
        LoadingIndicator {
            Layout.alignment: Qt.AlignHCenter
            visible: viewModel.isLoading
        }

        // User list
        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            model: viewModel.users
            clip: true
            spacing: 4

            delegate: UserCard {
                width: ListView.view.width
                userName: model.name
                userEmail: model.email
                userRole: model.role

                onClicked: viewModel.selectedIndex = index
                onDeleteClicked: {
                    confirmDialog.userIndex = index
                    confirmDialog.open()
                }

                highlighted: viewModel.selectedIndex === index
            }

            // Empty state
            Label {
                anchors.centerIn: parent
                text: qsTr("No users found")
                visible: parent.count === 0 && !viewModel.isLoading
                color: Theme.textSecondaryColor
            }
        }
    }

    // Confirm delete dialog
    ConfirmDialog {
        id: confirmDialog
        property int userIndex: -1
        title: qsTr("Delete User")
        message: qsTr("Are you sure you want to delete this user?")
        onAccepted: viewModel.deleteUser(userIndex)
    }

    // Add user dialog
    Dialog {
        id: addUserDialog
        title: qsTr("Add User")
        standardButtons: Dialog.Ok | Dialog.Cancel
        anchors.centerIn: parent
        modal: true

        ColumnLayout {
            spacing: 12

            AppTextField {
                id: nameField
                placeholderText: qsTr("Name")
                Layout.fillWidth: true
            }

            AppTextField {
                id: emailField
                placeholderText: qsTr("Email")
                Layout.fillWidth: true
            }
        }

        onAccepted: {
            viewModel.createUser(nameField.text, emailField.text)
            nameField.text = ""
            emailField.text = ""
        }
    }
}
```

---

## 4. Qt Internationalization (i18n)

```cpp
// src/core/Settings.cpp -- Language loading
#include <QTranslator>
#include <QApplication>

void Settings::setLanguage(const QString &locale)
{
    static QTranslator *currentTranslator = nullptr;

    if (currentTranslator) {
        qApp->removeTranslator(currentTranslator);
        delete currentTranslator;
    }

    currentTranslator = new QTranslator(qApp);
    if (currentTranslator->load(":/translations/app_" + locale)) {
        qApp->installTranslator(currentTranslator);
    }

    // Force QML re-evaluation of qsTr() strings
    QQmlEngine *engine = qobject_cast<QQmlEngine*>(qApp->findChild<QQmlApplicationEngine*>());
    if (engine) {
        engine->retranslate();
    }
}
```

```xml
<!-- resources/translations/app_en.ts -->
<?xml version="1.0" encoding="utf-8"?>
<TS version="2.1" language="en_US">
  <context>
    <name>UserListPage</name>
    <message>
      <source>Users</source>
      <translation>Users</translation>
    </message>
    <message>
      <source>Search users...</source>
      <translation>Search users...</translation>
    </message>
    <message>
      <source>Add User</source>
      <translation>Add User</translation>
    </message>
    <message>
      <source>No users found</source>
      <translation>No users found</translation>
    </message>
  </context>
</TS>
```

```xml
<!-- resources/app.qrc -->
<RCC>
  <qresource prefix="/">
    <file>icons/app-icon.svg</file>
    <file>icons/toolbar/add.svg</file>
    <file>icons/toolbar/delete.svg</file>
    <file>icons/toolbar/edit.svg</file>
    <file>icons/toolbar/search.svg</file>
    <file>icons/toolbar/settings.svg</file>
    <file>icons/toolbar/refresh.svg</file>
    <file>fonts/Inter-Variable.ttf</file>
  </qresource>
  <qresource prefix="/translations">
    <file>translations/app_en.qm</file>
    <file>translations/app_de.qm</file>
    <file>translations/app_el.qm</file>
  </qresource>
</RCC>
```

---

## 5. Qt Plugin Architecture

```cpp
// src/plugins/IPlugin.h
#pragma once

#include <QString>
#include <QObject>
#include <QtPlugin>

class IPlugin
{
public:
    virtual ~IPlugin() = default;
    virtual QString name() const = 0;
    virtual QString version() const = 0;
    virtual QString description() const = 0;
    virtual bool initialize() = 0;
    virtual void shutdown() = 0;
};

#define IPlugin_iid "com.mycompany.myqtapp.IPlugin/1.0"
Q_DECLARE_INTERFACE(IPlugin, IPlugin_iid)
```

```cpp
// src/plugins/PluginManager.h
#pragma once

#include <QObject>
#include <QList>
#include <QPluginLoader>
#include "IPlugin.h"

class PluginManager : public QObject
{
    Q_OBJECT

public:
    explicit PluginManager(QObject *parent = nullptr);
    ~PluginManager() override;

    void loadPlugins(const QString &pluginDir);
    QList<IPlugin*> loadedPlugins() const;

signals:
    void pluginLoaded(const QString &name);
    void pluginError(const QString &name, const QString &error);

private:
    QList<QPluginLoader*> m_loaders;
    QList<IPlugin*> m_plugins;
};
```

```cpp
// src/plugins/plugins/ExportPlugin/ExportPlugin.h
#pragma once

#include <QObject>
#include "../../IPlugin.h"

class ExportPlugin : public QObject, public IPlugin
{
    Q_OBJECT
    Q_PLUGIN_METADATA(IID IPlugin_iid FILE "export_plugin.json")
    Q_INTERFACES(IPlugin)

public:
    QString name() const override { return "Export Plugin"; }
    QString version() const override { return "1.0.0"; }
    QString description() const override { return "Export data to various formats"; }
    bool initialize() override;
    void shutdown() override;
};
```

---

## 6. vcpkg.json (C++ Package Management)

```json
{
  "name": "my-qt-app",
  "version": "1.0.0",
  "dependencies": [
    "spdlog",
    "nlohmann-json",
    "fmt",
    "sqlitecpp",
    "openssl",
    "gtest"
  ],
  "overrides": [],
  "builtin-baseline": "c82f74667287d3dc386bce81e44964370c91a289"
}
```

---

## 7. .clang-format and .clang-tidy

```yaml
# .clang-format
BasedOnStyle: LLVM
IndentWidth: 4
ColumnLimit: 100
BreakBeforeBraces: Attach
AllowShortFunctionsOnASingleLine: Inline
AllowShortIfStatementsOnASingleLine: Never
AllowShortLoopsOnASingleLine: false
AlwaysBreakTemplateDeclarations: Yes
PointerAlignment: Right
AccessModifierOffset: -4
NamespaceIndentation: None
SortIncludes: CaseSensitive
IncludeBlocks: Regroup
IncludeCategories:
  - Regex: '^<Q'
    Priority: 2
  - Regex: '^<'
    Priority: 3
  - Regex: '^"'
    Priority: 1
```

```yaml
# .clang-tidy
Checks: >
  -*,
  bugprone-*,
  cppcoreguidelines-*,
  modernize-*,
  performance-*,
  readability-*,
  -modernize-use-trailing-return-type,
  -readability-magic-numbers,
  -cppcoreguidelines-avoid-magic-numbers,
  -cppcoreguidelines-owning-memory

WarningsAsErrors: ''
HeaderFilterRegex: 'src/.*\.h$'

CheckOptions:
  - key: readability-identifier-naming.ClassCase
    value: CamelCase
  - key: readability-identifier-naming.FunctionCase
    value: camelBack
  - key: readability-identifier-naming.VariableCase
    value: camelBack
  - key: readability-identifier-naming.PrivateMemberPrefix
    value: m_
  - key: readability-identifier-naming.ConstantCase
    value: UPPER_CASE
```

---

## 8. SwiftUI macOS App Enterprise Structure

```
MyMacApp/
├── MyMacApp.xcodeproj/                    # Xcode project (or use SPM)
│   └── project.pbxproj
│
├── MyMacApp/
│   ├── MyMacAppApp.swift                  # @main App entry point
│   ├── ContentView.swift                  # Root view
│   │
│   ├── Features/                          # Feature modules (domain-driven)
│   │   ├── Dashboard/
│   │   │   ├── Views/
│   │   │   │   └── DashboardView.swift
│   │   │   └── ViewModels/
│   │   │       └── DashboardViewModel.swift
│   │   │
│   │   ├── Users/
│   │   │   ├── Views/
│   │   │   │   ├── UserListView.swift
│   │   │   │   ├── UserDetailView.swift
│   │   │   │   ├── UserRowView.swift
│   │   │   │   └── CreateUserSheet.swift
│   │   │   ├── ViewModels/
│   │   │   │   ├── UserListViewModel.swift
│   │   │   │   └── UserDetailViewModel.swift
│   │   │   └── Models/
│   │   │       ├── User.swift
│   │   │       └── UserRole.swift
│   │   │
│   │   ├── Settings/
│   │   │   ├── Views/
│   │   │   │   ├── SettingsView.swift
│   │   │   │   ├── GeneralSettingsView.swift
│   │   │   │   ├── AppearanceSettingsView.swift
│   │   │   │   └── AccountSettingsView.swift
│   │   │   └── ViewModels/
│   │   │       └── SettingsViewModel.swift
│   │   │
│   │   ├── Editor/
│   │   │   ├── Views/
│   │   │   │   ├── EditorView.swift
│   │   │   │   └── EditorToolbar.swift
│   │   │   └── ViewModels/
│   │   │       └── EditorViewModel.swift
│   │   │
│   │   └── Auth/
│   │       ├── Views/
│   │       │   └── LoginView.swift
│   │       └── ViewModels/
│   │           └── AuthViewModel.swift
│   │
│   ├── Core/                              # Shared infrastructure
│   │   ├── Network/
│   │   │   ├── APIClient.swift
│   │   │   ├── APIEndpoints.swift
│   │   │   ├── APIError.swift
│   │   │   └── NetworkMonitor.swift
│   │   │
│   │   ├── Storage/
│   │   │   ├── PersistenceController.swift  # Core Data stack
│   │   │   ├── UserDefaultsManager.swift
│   │   │   └── KeychainManager.swift
│   │   │
│   │   ├── Navigation/
│   │   │   ├── AppNavigation.swift         # NavigationSplitView routing
│   │   │   ├── Route.swift                 # Type-safe route enum
│   │   │   └── DeepLinkHandler.swift
│   │   │
│   │   ├── Services/
│   │   │   ├── UpdateService.swift         # Sparkle integration
│   │   │   ├── AnalyticsService.swift
│   │   │   └── CrashReportingService.swift
│   │   │
│   │   └── Utilities/
│   │       ├── Logger.swift                # OSLog wrapper
│   │       ├── Formatters.swift
│   │       └── Constants.swift
│   │
│   ├── Shared/                            # Shared UI components
│   │   ├── Components/
│   │   │   ├── LoadingView.swift
│   │   │   ├── ErrorView.swift
│   │   │   ├── EmptyStateView.swift
│   │   │   ├── SearchField.swift
│   │   │   ├── StatusBadge.swift
│   │   │   └── ConfirmationDialog.swift
│   │   │
│   │   ├── Modifiers/
│   │   │   ├── CardModifier.swift
│   │   │   ├── ShakeModifier.swift
│   │   │   └── ConditionalModifier.swift
│   │   │
│   │   ├── Extensions/
│   │   │   ├── Color+Extensions.swift
│   │   │   ├── View+Extensions.swift
│   │   │   ├── Date+Extensions.swift
│   │   │   └── String+Extensions.swift
│   │   │
│   │   └── Styles/
│   │       ├── ButtonStyles.swift
│   │       ├── TextFieldStyles.swift
│   │       └── ListStyles.swift
│   │
│   ├── Resources/
│   │   ├── Assets.xcassets/               # App icons, colors, images
│   │   │   ├── AppIcon.appiconset/
│   │   │   ├── AccentColor.colorset/
│   │   │   └── Images/
│   │   ├── Localizable.xcstrings          # String catalog (modern i18n)
│   │   ├── InfoPlist.xcstrings            # Info.plist localization
│   │   └── Preview Content/
│   │       └── Preview Assets.xcassets
│   │
│   ├── CoreData/
│   │   ├── MyMacApp.xcdatamodeld/         # Core Data model
│   │   │   └── MyMacApp.xcdatamodel/
│   │   └── Entities/
│   │       ├── UserEntity+CoreDataClass.swift
│   │       └── UserEntity+CoreDataProperties.swift
│   │
│   ├── Menu/
│   │   └── AppCommands.swift              # Custom menu bar commands
│   │
│   ├── Info.plist
│   └── MyMacApp.entitlements              # Sandbox entitlements
│
├── MyMacAppTests/
│   ├── ViewModels/
│   │   ├── UserListViewModelTests.swift
│   │   └── AuthViewModelTests.swift
│   ├── Services/
│   │   ├── APIClientTests.swift
│   │   └── KeychainManagerTests.swift
│   ├── Mocks/
│   │   ├── MockAPIClient.swift
│   │   └── MockUserService.swift
│   └── Fixtures/
│       └── test_users.json
│
├── MyMacAppUITests/
│   ├── UserFlowTests.swift
│   └── SettingsFlowTests.swift
│
├── Packages/                              # Local Swift packages (modularization)
│   ├── NetworkKit/
│   │   ├── Package.swift
│   │   ├── Sources/
│   │   │   └── NetworkKit/
│   │   │       ├── APIClient.swift
│   │   │       └── Endpoint.swift
│   │   └── Tests/
│   │       └── NetworkKitTests/
│   └── DesignSystem/
│       ├── Package.swift
│       ├── Sources/
│       │   └── DesignSystem/
│       │       ├── Colors.swift
│       │       ├── Typography.swift
│       │       └── Components/
│       └── Tests/
│
└── .swiftlint.yml                         # SwiftLint configuration
```

---

## 9. SwiftUI macOS Code Examples

### App Entry Point

```swift
// MyMacAppApp.swift
import SwiftUI
import Sparkle  // For auto-updates

@main
struct MyMacAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var authViewModel = AuthViewModel()
    private let updaterController: SPUStandardUpdaterController

    init() {
        // Initialize Sparkle updater
        updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
    }

    var body: some Scene {
        // Main window
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(authViewModel)
                .frame(minWidth: 800, minHeight: 600)
                .onOpenURL { url in
                    // Handle deep links (myapp://...)
                    DeepLinkHandler.shared.handle(url)
                }
        }
        .commands {
            AppCommands(updater: updaterController.updater)
        }
        .defaultSize(width: 1200, height: 800)

        // Settings window
        Settings {
            SettingsView()
                .environmentObject(appState)
        }

        // Document-based (optional)
        // DocumentGroup(newDocument: MyDocument()) { file in
        //     EditorView(document: file.$document)
        // }

        // Menu bar extra (tray app)
        MenuBarExtra("My App", systemImage: "app.fill") {
            MenuBarView()
                .environmentObject(appState)
        }
        .menuBarExtraStyle(.window)
    }
}
```

### Navigation with NavigationSplitView

```swift
// ContentView.swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedRoute: Route? = .dashboard

    var body: some View {
        NavigationSplitView {
            // Sidebar
            List(selection: $selectedRoute) {
                Section("General") {
                    Label("Dashboard", systemImage: "gauge")
                        .tag(Route.dashboard)

                    Label("Users", systemImage: "person.2")
                        .tag(Route.users)
                }

                Section("Tools") {
                    Label("Editor", systemImage: "doc.text")
                        .tag(Route.editor)
                }
            }
            .listStyle(.sidebar)
            .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 300)
        } detail: {
            // Detail view based on route
            switch selectedRoute {
            case .dashboard:
                DashboardView()
            case .users:
                UserListView()
            case .editor:
                EditorView()
            case .userDetail(let id):
                UserDetailView(userId: id)
            case .none:
                Text("Select an item from the sidebar")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle(selectedRoute?.title ?? "My App")
    }
}
```

```swift
// Core/Navigation/Route.swift
import Foundation

enum Route: Hashable, Identifiable {
    case dashboard
    case users
    case userDetail(id: UUID)
    case editor

    var id: String {
        switch self {
        case .dashboard: return "dashboard"
        case .users: return "users"
        case .userDetail(let id): return "user-\(id.uuidString)"
        case .editor: return "editor"
        }
    }

    var title: String {
        switch self {
        case .dashboard: return "Dashboard"
        case .users: return "Users"
        case .userDetail: return "User Details"
        case .editor: return "Editor"
        }
    }
}
```

### ViewModel with @Observable (Swift 5.9+)

```swift
// Features/Users/ViewModels/UserListViewModel.swift
import Foundation
import Observation

@Observable
final class UserListViewModel {
    // State
    var users: [User] = []
    var selectedUser: User?
    var searchText: String = ""
    var isLoading: Bool = false
    var errorMessage: String?
    var showCreateSheet: Bool = false

    // Computed
    var filteredUsers: [User] {
        if searchText.isEmpty {
            return users
        }
        return users.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.email.localizedCaseInsensitiveContains(searchText)
        }
    }

    var hasSelection: Bool { selectedUser != nil }

    // Dependencies
    private let apiClient: APIClient
    private let logger = Logger(subsystem: "com.mycompany.myapp", category: "Users")

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    // ─── Actions ───

    @MainActor
    func loadUsers() async {
        isLoading = true
        errorMessage = nil

        do {
            users = try await apiClient.fetchUsers()
            logger.info("Loaded \(self.users.count) users")
        } catch {
            errorMessage = "Failed to load users: \(error.localizedDescription)"
            logger.error("Failed to load users: \(error)")
        }

        isLoading = false
    }

    @MainActor
    func deleteUser(_ user: User) async {
        do {
            try await apiClient.deleteUser(id: user.id)
            users.removeAll { $0.id == user.id }
            if selectedUser?.id == user.id {
                selectedUser = nil
            }
            logger.info("Deleted user: \(user.name)")
        } catch {
            errorMessage = "Failed to delete user: \(error.localizedDescription)"
        }
    }

    @MainActor
    func createUser(name: String, email: String) async {
        do {
            let newUser = try await apiClient.createUser(name: name, email: email)
            users.append(newUser)
            showCreateSheet = false
            logger.info("Created user: \(name)")
        } catch {
            errorMessage = "Failed to create user: \(error.localizedDescription)"
        }
    }

    @MainActor
    func refreshUsers() async {
        await loadUsers()
    }
}
```

### SwiftUI Views

```swift
// Features/Users/Views/UserListView.swift
import SwiftUI

struct UserListView: View {
    @State private var viewModel = UserListViewModel()
    @State private var showDeleteConfirmation = false
    @State private var userToDelete: User?

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar area
            HStack {
                Text("Users")
                    .font(.title)
                    .fontWeight(.bold)

                Spacer()

                Button("Refresh") {
                    Task { await viewModel.refreshUsers() }
                }

                Button("Add User") {
                    viewModel.showCreateSheet = true
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()

            // Search
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search users...", text: $viewModel.searchText)
                    .textFieldStyle(.plain)

                if !viewModel.searchText.isEmpty {
                    Button {
                        viewModel.searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
            .padding(.horizontal)

            Divider()
                .padding(.top, 8)

            // Content
            if viewModel.isLoading {
                Spacer()
                ProgressView("Loading users...")
                Spacer()
            } else if let error = viewModel.errorMessage {
                ErrorView(message: error) {
                    Task { await viewModel.refreshUsers() }
                }
            } else if viewModel.filteredUsers.isEmpty {
                EmptyStateView(
                    title: "No Users Found",
                    description: viewModel.searchText.isEmpty
                        ? "Add a user to get started"
                        : "Try a different search term",
                    systemImage: "person.2.slash"
                )
            } else {
                List(viewModel.filteredUsers, selection: $viewModel.selectedUser) { user in
                    UserRowView(user: user)
                        .contextMenu {
                            Button("Edit") {
                                viewModel.selectedUser = user
                            }
                            Divider()
                            Button("Delete", role: .destructive) {
                                userToDelete = user
                                showDeleteConfirmation = true
                            }
                        }
                        .tag(user)
                }
                .listStyle(.inset)
            }
        }
        .task {
            await viewModel.loadUsers()
        }
        .sheet(isPresented: $viewModel.showCreateSheet) {
            CreateUserSheet { name, email in
                Task { await viewModel.createUser(name: name, email: email) }
            }
        }
        .confirmationDialog(
            "Delete User",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let user = userToDelete {
                    Task { await viewModel.deleteUser(user) }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete \(userToDelete?.name ?? "this user")?")
        }
        .navigationTitle("Users")
    }
}
```

### Custom Menu Commands

```swift
// Menu/AppCommands.swift
import SwiftUI
import Sparkle

struct AppCommands: Commands {
    let updater: SPUUpdater

    var body: some Commands {
        // Replace About menu
        CommandGroup(replacing: .appInfo) {
            Button("About My App") {
                NSApplication.shared.orderFrontStandardAboutPanel(options: [
                    .applicationName: "My App",
                    .applicationVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
                    .credits: NSAttributedString(string: "Built with SwiftUI"),
                ])
            }
        }

        // File menu
        CommandGroup(after: .newItem) {
            Button("Open File...") {
                // Handle file open
            }
            .keyboardShortcut("o")

            Divider()
        }

        // Edit menu additions
        CommandGroup(after: .pasteboard) {
            Button("Find...") {
                NotificationCenter.default.post(name: .showFind, object: nil)
            }
            .keyboardShortcut("f")
        }

        // Check for Updates (Sparkle)
        CommandGroup(after: .appInfo) {
            CheckForUpdatesView(updater: updater)
        }

        // Custom menu
        CommandMenu("Tools") {
            Button("Export Data...") {
                NotificationCenter.default.post(name: .exportData, object: nil)
            }
            .keyboardShortcut("e", modifiers: [.command, .shift])

            Button("Import Data...") {
                NotificationCenter.default.post(name: .importData, object: nil)
            }
            .keyboardShortcut("i", modifiers: [.command, .shift])
        }
    }
}
```

### Sandboxing Entitlements

```xml
<!-- MyMacApp.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Sandbox (required for Mac App Store) -->
    <key>com.apple.security.app-sandbox</key>
    <true/>

    <!-- Network access -->
    <key>com.apple.security.network.client</key>
    <true/>

    <!-- File access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.files.bookmarks.app-scope</key>
    <true/>

    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>
</dict>
</plist>
```

### SwiftLint Configuration

```yaml
# .swiftlint.yml
disabled_rules:
  - trailing_whitespace
  - todo

opt_in_rules:
  - closure_body_length
  - collection_alignment
  - contains_over_filter_count
  - empty_count
  - empty_string
  - enum_case_associated_values_count
  - fatal_error_message
  - file_name
  - first_where
  - force_unwrapping
  - identical_operands
  - implicit_return
  - last_where
  - modifier_order
  - multiline_arguments
  - multiline_parameters
  - operator_usage_whitespace
  - overridden_super_call
  - prefer_self_in_static_references
  - prefer_self_type_over_type_of_self
  - private_action
  - private_outlet
  - redundant_nil_coalescing
  - sorted_first_last
  - unneeded_parentheses_in_closure_argument
  - yoda_condition

excluded:
  - Packages
  - DerivedData
  - .build

line_length:
  warning: 120
  error: 200

type_body_length:
  warning: 300
  error: 500

file_length:
  warning: 500
  error: 1000

function_body_length:
  warning: 50
  error: 100

identifier_name:
  min_length: 2
  max_length: 50
  excluded:
    - id
    - x
    - y
    - i

nesting:
  type_level: 3
  function_level: 3
```

---

## 10. Core Data Integration (SwiftUI macOS)

```swift
// Core/Storage/PersistenceController.swift
import CoreData

struct PersistenceController {
    static let shared = PersistenceController()

    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        let viewContext = controller.container.viewContext

        // Create sample data
        for i in 0..<10 {
            let user = UserEntity(context: viewContext)
            user.id = UUID()
            user.name = "User \(i)"
            user.email = "user\(i)@example.com"
            user.createdAt = Date()
        }

        do {
            try viewContext.save()
        } catch {
            fatalError("Preview data error: \(error)")
        }

        return controller
    }()

    let container: NSPersistentContainer

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "MyMacApp")

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { _, error in
            if let error = error as NSError? {
                fatalError("Core Data error: \(error), \(error.userInfo)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
}
```

---

## 11. Framework Decision (Qt vs SwiftUI)

| Factor | Qt 6 (C++) | SwiftUI macOS | GTK 4 (C/Rust) |
|--------|-----------|---------------|-----------------|
| Platforms | Windows, macOS, Linux, embedded, mobile | macOS only (14+) | Linux primary, macOS, Windows |
| Language | C++ (17/20) | Swift 5.9+ | C, Rust (gtk-rs), Python (PyGObject) |
| UI paradigm | QML (declarative) or Widgets (imperative) | Declarative (SwiftUI) | Blueprint (declarative) or imperative |
| Build system | CMake | Xcode / SPM | Meson / CMake |
| Package manager | vcpkg, Conan | SPM, CocoaPods | system packages, cargo |
| State management | Q_PROPERTY + signals/slots | @Observable, @State, @Binding | GObject properties + signals |
| Data binding | QML property binding | SwiftUI bindings | GObject binding |
| Styling | Qt Style Sheets (.qss) or QML themes | Native macOS appearance | CSS-like GTK CSS |
| Performance | Excellent (native C++) | Excellent (Apple silicon optimized) | Good |
| Learning curve | High (C++ + Qt specifics) | Medium (Swift + Apple ecosystem) | Medium-High |
| Best for | Cross-platform native, industrial | macOS-only premium apps | Linux-native GNOME apps |
| Licensing | LGPLv3 or commercial | Free (Apple platforms) | LGPLv2.1+ |
| Auto-updates | Custom (QtWebEngine + server) | Sparkle framework | Flatpak/Snap (built-in) |
| Accessibility | QAccessible | Built-in (excellent) | ATK/AT-SPI |
| Testing | Qt Test, Google Test | XCTest, Swift Testing | GTest, custom |

---

## 12. Anti-Patterns

### Qt Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| UI logic in data models | Rendering code in model classes | Separate models from views, use MVVM with Q_PROPERTY |
| No build system / qmake only | IDE-dependent builds, no CI | CMake (Qt 6 standard), cross-platform builds |
| Global state via singletons | Tight coupling, untestable | Dependency injection (constructor parameters) |
| `#ifdef WIN32` scattered | Platform code everywhere | Abstraction layer for platform APIs, separate files |
| Raw `new` without ownership | Memory leaks, double-free | Use Qt parent-child ownership or `std::unique_ptr` |
| Blocking the event loop | UI freezes during network/IO | Use `QFuture`, `QtConcurrent::run`, `QNetworkAccessManager` async |
| No `beginResetModel`/`endResetModel` | Model/View crashes, stale data | Always call begin/end model mutation methods |
| QML with excessive JavaScript | Slow performance, hard to debug | Move logic to C++ ViewModels, expose via Q_PROPERTY |
| No `.qrc` resource management | Missing files at runtime, path issues | Bundle all assets in `.qrc` files |
| No i18n from start | Expensive to add later | Use `qsTr()` / `tr()` for ALL user-visible strings from day one |
| Widget UI in C++ code | Unmaintainable UI layout code | Use Qt Designer `.ui` files or QML |
| No signal-slot connection type | Race conditions in threaded code | Specify `Qt::QueuedConnection` for cross-thread signals |

### SwiftUI macOS Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Massive View body | 200+ line body, hard to read | Extract sub-views, use computed properties |
| Business logic in View | Network calls inside View body | Move to ViewModel with `@Observable` |
| Force unwrapping | Runtime crashes | Guard let, optional chaining, nil coalescing |
| No `@MainActor` on UI updates | Purple runtime warnings, data races | Mark ViewModel methods that update state with `@MainActor` |
| ObservableObject when @Observable works | Unnecessary `@Published` boilerplate | Use `@Observable` macro (Swift 5.9+) for new code |
| Environment object abuse | Passing unrelated data through environment | Use specific dependencies, not god environment objects |
| No preview data | Cannot use SwiftUI previews | Create preview fixtures, use `PersistenceController.preview` |
| Ignoring app lifecycle | Missing `onAppear` / `task` modifiers | Use `.task { }` for async loading, `.onDisappear` for cleanup |
| Not using `NavigationSplitView` | Poor macOS navigation experience | `NavigationSplitView` for sidebar-detail pattern |
| No keyboard shortcuts | Users cannot use keyboard | Add `.keyboardShortcut()` modifiers to actions |
| No sandboxing | App rejected from Mac App Store | Configure entitlements, request minimum permissions |

---

## 13. Enforcement Checklist

### Qt / C++
- [ ] UI separated from business logic -- QML + C++ ViewModels (Q_PROPERTY)
- [ ] CMake build system configured (Qt 6 standard)
- [ ] `QAbstractListModel` for list data -- NEVER raw arrays in QML
- [ ] Signals and slots for all communication -- NO global state
- [ ] Platform-specific code isolated behind interfaces (separate .cpp files)
- [ ] `.qrc` resource files for ALL bundled assets
- [ ] `qsTr()` / `tr()` for ALL user-visible strings (i18n ready)
- [ ] `.clang-format` and `.clang-tidy` configured
- [ ] vcpkg or Conan for third-party C++ dependencies
- [ ] Qt Test or Google Test for unit tests
- [ ] Packaging scripts for all targets (NSIS, DMG, AppImage, Flatpak)
- [ ] Single-instance lock for desktop apps
- [ ] Proper memory management (Qt parent-child or smart pointers)
- [ ] `beginInsertRows`/`endInsertRows` for all model mutations

### SwiftUI macOS
- [ ] `@Observable` ViewModels -- Views are declarative UI only
- [ ] `@MainActor` on all ViewModel methods that update published state
- [ ] `NavigationSplitView` for sidebar-detail layout
- [ ] `WindowGroup` + `Settings` scenes in `@main` App
- [ ] Custom `Commands` for menu bar actions with keyboard shortcuts
- [ ] Sandboxing entitlements configured for distribution
- [ ] String Catalog (`.xcstrings`) for localization
- [ ] SwiftLint configured and passing
- [ ] XCTest unit tests for ViewModels
- [ ] Preview data for SwiftUI previews
- [ ] Core Data or SwiftData for local persistence
- [ ] Keychain Services for sensitive data (tokens, passwords)
- [ ] Sparkle framework for auto-updates (non-App Store)
- [ ] Notarization configured for direct distribution
- [ ] `async/await` for all async operations -- NO completion handlers
- [ ] Local Swift Packages for modularization (NetworkKit, DesignSystem)
