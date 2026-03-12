# Spring Boot Project Structure

> **AI Plugin Directive:** When generating a Java/Kotlin Spring Boot project, ALWAYS use this structure. Apply package-by-feature organization with layered architecture. This guide covers Spring Boot 3.x with Java 21+ (or Kotlin), Spring Security 6, and modern patterns.

**Core Rule: Organize Spring Boot projects by feature (package-per-feature). Each feature contains its own controller, service, repository, and DTOs. NEVER use package-per-layer (all controllers in one package) for projects beyond simple prototypes.**

---

## 1. Enterprise Project Structure

### Package-by-Feature (Recommended)

```
my-app/
├── src/
│   ├── main/
│   │   ├── java/com/example/myapp/
│   │   │   ├── MyAppApplication.java          # @SpringBootApplication
│   │   │   │
│   │   │   ├── auth/                          # Feature: Authentication
│   │   │   │   ├── AuthController.java
│   │   │   │   ├── AuthService.java
│   │   │   │   ├── TokenProvider.java
│   │   │   │   ├── dto/
│   │   │   │   │   ├── LoginRequest.java
│   │   │   │   │   ├── RegisterRequest.java
│   │   │   │   │   └── AuthResponse.java
│   │   │   │   └── exception/
│   │   │   │       └── InvalidCredentialsException.java
│   │   │   │
│   │   │   ├── user/                          # Feature: Users
│   │   │   │   ├── UserController.java
│   │   │   │   ├── UserService.java
│   │   │   │   ├── UserRepository.java        # Spring Data JPA
│   │   │   │   ├── User.java                  # @Entity
│   │   │   │   ├── UserMapper.java            # MapStruct mapper
│   │   │   │   ├── dto/
│   │   │   │   │   ├── UserCreateRequest.java
│   │   │   │   │   ├── UserUpdateRequest.java
│   │   │   │   │   └── UserResponse.java
│   │   │   │   └── exception/
│   │   │   │       └── UserNotFoundException.java
│   │   │   │
│   │   │   ├── order/                         # Feature: Orders
│   │   │   │   ├── OrderController.java
│   │   │   │   ├── OrderService.java
│   │   │   │   ├── OrderRepository.java
│   │   │   │   ├── Order.java
│   │   │   │   ├── OrderItem.java
│   │   │   │   ├── OrderMapper.java
│   │   │   │   ├── dto/
│   │   │   │   │   ├── CreateOrderRequest.java
│   │   │   │   │   └── OrderResponse.java
│   │   │   │   └── event/
│   │   │   │       └── OrderCreatedEvent.java
│   │   │   │
│   │   │   ├── common/                        # Shared code
│   │   │   │   ├── config/                    # Configuration classes
│   │   │   │   │   ├── SecurityConfig.java
│   │   │   │   │   ├── CorsConfig.java
│   │   │   │   │   ├── OpenApiConfig.java
│   │   │   │   │   └── AsyncConfig.java
│   │   │   │   ├── exception/                 # Global error handling
│   │   │   │   │   ├── GlobalExceptionHandler.java
│   │   │   │   │   ├── ApiError.java
│   │   │   │   │   └── BusinessException.java
│   │   │   │   ├── audit/                     # Auditing
│   │   │   │   │   ├── AuditableEntity.java
│   │   │   │   │   └── AuditConfig.java
│   │   │   │   ├── pagination/
│   │   │   │   │   └── PageResponse.java
│   │   │   │   └── validation/
│   │   │   │       └── UniqueEmail.java       # Custom validators
│   │   │   │
│   │   │   └── infrastructure/                # External integrations
│   │   │       ├── email/
│   │   │       │   ├── EmailService.java
│   │   │       │   └── EmailConfig.java
│   │   │       ├── storage/
│   │   │       │   └── S3StorageService.java
│   │   │       └── messaging/
│   │   │           └── RabbitMQConfig.java
│   │   │
│   │   └── resources/
│   │       ├── application.yml                # Default config
│   │       ├── application-dev.yml            # Dev profile
│   │       ├── application-staging.yml        # Staging profile
│   │       ├── application-prod.yml           # Production profile
│   │       ├── db/
│   │       │   └── migration/                 # Flyway migrations
│   │       │       ├── V1__create_users.sql
│   │       │       ├── V2__create_orders.sql
│   │       │       └── V3__add_user_role.sql
│   │       ├── static/                        # Static resources
│   │       └── templates/                     # Thymeleaf (if SSR)
│   │
│   └── test/
│       ├── java/com/example/myapp/
│       │   ├── user/
│       │   │   ├── UserControllerTest.java    # @WebMvcTest
│       │   │   ├── UserServiceTest.java       # @MockBean unit test
│       │   │   └── UserRepositoryTest.java    # @DataJpaTest
│       │   ├── order/
│       │   │   ├── OrderControllerTest.java
│       │   │   └── OrderServiceTest.java
│       │   ├── integration/                   # @SpringBootTest
│       │   │   └── UserIntegrationTest.java
│       │   └── common/
│       │       └── TestContainersConfig.java  # Testcontainers setup
│       └── resources/
│           └── application-test.yml
│
├── build.gradle (or pom.xml)
├── settings.gradle
├── gradle/
│   └── wrapper/
├── gradlew
├── gradlew.bat
├── Dockerfile
├── docker-compose.yml
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 2. Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Package | lowercase, singular | `com.example.myapp.user` |
| Entity | Singular noun | `User`, `OrderItem` |
| Controller | Feature + Controller | `UserController` |
| Service | Feature + Service | `UserService` |
| Repository | Feature + Repository | `UserRepository` |
| DTO Request | Action + Request | `UserCreateRequest` |
| DTO Response | Feature + Response | `UserResponse` |
| Mapper | Feature + Mapper | `UserMapper` |
| Config | Feature/Purpose + Config | `SecurityConfig` |
| Exception | Specific + Exception | `UserNotFoundException` |
| Event | Entity + Past tense + Event | `OrderCreatedEvent` |
| Test | Class + Test | `UserServiceTest` |

---

## 3. Application Entry Point

```java
// MyAppApplication.java
@SpringBootApplication
@EnableJpaAuditing
public class MyAppApplication {
    public static void main(String[] args) {
        SpringApplication.run(MyAppApplication.class, args);
    }
}
```

---

## 4. Controller Layer

```java
// user/UserController.java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "User management endpoints")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "List users with pagination")
    public ResponseEntity<PageResponse<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt,desc") String sort) {
        var result = userService.getUsers(page, size, sort);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user by ID")
    public ResponseEntity<UserResponse> getUser(
            @PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PostMapping
    @Operation(summary = "Create a new user")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody UserCreateRequest request) {
        var user = userService.createUser(request);
        URI location = URI.create("/api/v1/users/" + user.id());
        return ResponseEntity.created(location).body(user);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete user")
    public void deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
    }
}
```

---

## 5. Service Layer

```java
// user/UserService.java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher eventPublisher;

    public PageResponse<UserResponse> getUsers(int page, int size, String sort) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(sort));
        Page<User> users = userRepository.findAll(pageable);
        return PageResponse.from(users.map(userMapper::toResponse));
    }

    public UserResponse getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email already registered");
        }

        User user = userMapper.toEntity(request);
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        user = userRepository.save(user);
        eventPublisher.publishEvent(new UserCreatedEvent(user.getId()));

        return userMapper.toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        userMapper.updateEntity(request, user);
        user = userRepository.save(user);

        return userMapper.toResponse(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException(id);
        }
        userRepository.deleteById(id);
    }
}
```

---

## 6. Repository Layer (Spring Data JPA)

```java
// user/UserRepository.java
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.isActive = true")
    Page<User> findAllActive(Pageable pageable);

    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<User> search(@Param("query") String query, Pageable pageable);

    @Modifying
    @Query("UPDATE User u SET u.isActive = false WHERE u.id = :id")
    void deactivate(@Param("id") Long id);
}
```

---

## 7. Entity (JPA)

```java
// user/User.java
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    // Relationships
    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Post> posts = new ArrayList<>();
}


// common/audit/AuditableEntity.java
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public abstract class AuditableEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    @LastModifiedBy
    @Column(name = "modified_by")
    private String modifiedBy;
}
```

---

## 8. DTOs (Java Records)

```java
// user/dto/UserCreateRequest.java
public record UserCreateRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 1, max = 100) String fullName,
    @NotBlank @Size(min = 8, max = 128) String password
) {}


// user/dto/UserUpdateRequest.java
public record UserUpdateRequest(
    @Email String email,
    @Size(min = 1, max = 100) String fullName,
    Boolean isActive
) {}


// user/dto/UserResponse.java
public record UserResponse(
    Long id,
    String email,
    String fullName,
    Boolean isActive,
    Role role,
    Instant createdAt,
    Instant updatedAt
) {}
```

---

## 9. MapStruct Mapper

```java
// user/UserMapper.java
@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toResponse(User user);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "isActive", constant = "true")
    @Mapping(target = "role", constant = "USER")
    User toEntity(UserCreateRequest request);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "passwordHash", ignore = true)
    void updateEntity(UserUpdateRequest request, @MappingTarget User user);
}
```

---

## 10. Global Exception Handling

```java
// common/exception/GlobalExceptionHandler.java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiError handleNotFound(UserNotFoundException ex) {
        return new ApiError(HttpStatus.NOT_FOUND.value(), ex.getMessage());
    }

    @ExceptionHandler(BusinessException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiError handleBusiness(BusinessException ex) {
        return new ApiError(HttpStatus.CONFLICT.value(), ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(
            error -> errors.put(error.getField(), error.getDefaultMessage())
        );
        return new ApiError(HttpStatus.BAD_REQUEST.value(), "Validation failed", errors);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiError handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return new ApiError(500, "An unexpected error occurred");
    }
}


// common/exception/ApiError.java
public record ApiError(
    int status,
    String message,
    Map<String, String> errors
) {
    public ApiError(int status, String message) {
        this(status, message, null);
    }
}
```

---

## 11. Configuration (application.yml)

```yaml
# src/main/resources/application.yml
spring:
  application:
    name: my-app
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}

  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/myapp}
    username: ${DATABASE_USER:postgres}
    password: ${DATABASE_PASSWORD:postgres}
    hikari:
      maximum-pool-size: ${DB_POOL_SIZE:10}
      minimum-idle: 5

  jpa:
    hibernate:
      ddl-auto: validate  # NEVER use 'update' or 'create' in production
    open-in-view: false    # ALWAYS disable OSIV
    properties:
      hibernate:
        default_schema: public
        format_sql: true

  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: ${SERVER_PORT:8080}
  error:
    include-message: always
    include-binding-errors: always

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html

logging:
  level:
    root: INFO
    com.example.myapp: DEBUG
    org.hibernate.SQL: DEBUG


# src/main/resources/application-prod.yml
spring:
  jpa:
    show-sql: false
    properties:
      hibernate:
        format_sql: false

springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false

logging:
  level:
    root: WARN
    com.example.myapp: INFO
    org.hibernate.SQL: WARN
```

---

## 12. Security Configuration

```java
// common/config/SecurityConfig.java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/items/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

---

## 13. Testing

```java
// user/UserControllerTest.java — Slice test
@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturnUserById() throws Exception {
        var user = new UserResponse(1L, "test@example.com", "Test User",
            true, Role.USER, Instant.now(), Instant.now());
        when(userService.getUserById(1L)).thenReturn(user);

        mockMvc.perform(get("/api/v1/users/1")
                .with(jwt()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("test@example.com"));
    }
}


// user/UserServiceTest.java — Unit test
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserMapper userMapper;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ApplicationEventPublisher eventPublisher;
    @InjectMocks private UserService userService;

    @Test
    void shouldCreateUser() {
        var request = new UserCreateRequest("test@example.com", "Test", "password");
        var user = User.builder().id(1L).email("test@example.com").build();

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userMapper.toEntity(request)).thenReturn(user);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any())).thenReturn(user);

        userService.createUser(request);

        verify(userRepository).save(any());
        verify(eventPublisher).publishEvent(any(UserCreatedEvent.class));
    }
}


// integration/UserIntegrationTest.java — Full stack test
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void shouldCreateAndRetrieveUser() {
        // ... integration test with real database
    }
}
```

---

## 14. Build Configuration (Gradle)

```groovy
// build.gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
}

group = 'com.example'
version = '1.0.0'

java {
    sourceCompatibility = '21'
}

dependencies {
    // Spring Boot starters
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'

    // Database
    runtimeOnly 'org.postgresql:postgresql'
    implementation 'org.flywaydb:flyway-core'

    // OpenAPI
    implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.3.0'

    // Mapping
    implementation 'org.mapstruct:mapstruct:1.5.5.Final'
    annotationProcessor 'org.mapstruct:mapstruct-processor:1.5.5.Final'

    // Lombok
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok-mapstruct-binding:0.2.0'

    // Testing
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
    testImplementation 'org.testcontainers:junit-jupiter'
    testImplementation 'org.testcontainers:postgresql'
}
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Package-per-layer | `controllers/`, `services/`, `repositories/` at top level | Package-per-feature: `user/`, `order/`, `auth/` |
| Open Session in View | Lazy loading in views, N+1 queries | Set `spring.jpa.open-in-view=false`, use DTOs |
| `ddl-auto: update` in prod | Schema drift, data loss risk | Use Flyway/Liquibase for migrations, set `validate` |
| Anemic domain model | All logic in services, entities are just data holders | Put behavior in entities where appropriate |
| No DTOs | Exposing JPA entities directly in API responses | ALWAYS map Entity → Response DTO via MapStruct |
| Fat controllers | Business logic in `@RestController` methods | Controller → Service → Repository, controller does HTTP only |
| Field injection | `@Autowired` on fields | Use constructor injection via `@RequiredArgsConstructor` |
| Missing @Transactional | Inconsistent data on failures | `@Transactional` on service methods, `readOnly=true` default |
| No test slices | All tests are `@SpringBootTest` (slow) | Use `@WebMvcTest`, `@DataJpaTest`, `@MockBean` |
| Hardcoded config | Values in Java code | Use `application.yml` + `@Value` or `@ConfigurationProperties` |

---

## 16. Enforcement Checklist

- [ ] Package-per-feature organization — each feature self-contained
- [ ] Application entry point has ONLY `@SpringBootApplication`
- [ ] Controllers handle HTTP mapping only — delegate to services
- [ ] Services annotated with `@Transactional(readOnly = true)` by default
- [ ] Spring Data JPA repositories — NEVER manual JDBC in service layer
- [ ] Java Records for DTOs — immutable request/response objects
- [ ] MapStruct for Entity ↔ DTO mapping — NEVER manual mapping
- [ ] `@RestControllerAdvice` for centralized exception handling
- [ ] Configuration via `application.yml` with profile-specific overrides
- [ ] `spring.jpa.open-in-view=false` — ALWAYS disabled
- [ ] `ddl-auto=validate` — Flyway manages ALL schema changes
- [ ] Constructor injection via Lombok `@RequiredArgsConstructor`
- [ ] OpenAPI/Swagger annotations on controllers
- [ ] Test slices: `@WebMvcTest` for controllers, `@DataJpaTest` for repos
- [ ] Testcontainers for integration tests — NEVER use H2 for production DB tests
