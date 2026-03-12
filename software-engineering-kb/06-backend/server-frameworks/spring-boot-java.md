# Spring Boot — Java/Kotlin Server Framework

> **AI Plugin Directive — Spring Boot Production Patterns for Enterprise APIs**
> You are an AI coding assistant. When generating, reviewing, or refactoring Spring Boot
> applications, follow EVERY rule in this document. Spring Boot is the de facto standard for
> Java enterprise backends. Misconfigured Spring apps suffer from startup bloat, memory leaks,
> and security gaps. Treat each section as non-negotiable.

**Core Rule: ALWAYS use constructor injection (never field injection). ALWAYS use Spring Profiles for environment-specific configuration. ALWAYS implement global exception handling with @ControllerAdvice. ALWAYS use Spring Security for authentication and authorization. NEVER expose entity objects directly in API responses — use DTOs.**

---

## 1. Project Setup & Dependencies

```xml
<!-- pom.xml — Essential Spring Boot dependencies -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.0</version>
</parent>

<dependencies>
    <!-- Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Security -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <!-- JPA + PostgreSQL -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- Actuator (health, metrics) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>

    <!-- OpenAPI docs -->
    <dependency>
        <groupId>org.springdoc</groupId>
        <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
        <version>2.5.0</version>
    </dependency>

    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Application Configuration

```yaml
# application.yml
spring:
  application:
    name: my-api
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/mydb}
    username: ${DB_USER:postgres}
    password: ${DB_PASSWORD:}
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      connection-timeout: 5000
      idle-timeout: 300000
      max-lifetime: 600000
  jpa:
    open-in-view: false          # ALWAYS disable — prevents N+1 in views
    hibernate:
      ddl-auto: validate          # NEVER use "update" or "create" in production
    properties:
      hibernate:
        default_batch_fetch_size: 20
        order_inserts: true
        order_updates: true
        jdbc:
          batch_size: 50

server:
  port: ${PORT:8080}
  shutdown: graceful              # Graceful shutdown
  tomcat:
    threads:
      max: 200
      min-spare: 20
    connection-timeout: 5000

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: when-authorized

logging:
  pattern:
    console: '{"timestamp":"%d","level":"%p","logger":"%logger","message":"%m","mdc":{%mdc}}%n'
  level:
    root: INFO
    com.example: DEBUG
    org.hibernate.SQL: WARN
```

---

## 2. Controller Layer

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor  // Lombok — generates constructor injection
@Validated
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<PaginatedResponse<UserResponse>> list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction) {

        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.fromString(direction), sortBy));
        Page<UserResponse> result = userService.findAll(pageable);

        return ResponseEntity.ok(PaginatedResponse.from(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getById(@PathVariable UUID id) {
        UserResponse user = userService.findById(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping
    public ResponseEntity<UserResponse> create(
            @Valid @RequestBody CreateUserRequest request) {
        UserResponse user = userService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(user.id()).toUri();
        return ResponseEntity.created(location).body(user);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRequest request) {
        UserResponse user = userService.update(id, request);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

### DTOs with Bean Validation

```java
// Request DTOs — NEVER expose entities directly
public record CreateUserRequest(
    @NotBlank @Size(min = 1, max = 100) String name,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 128) String password
) {}

public record UpdateUserRequest(
    @Size(min = 1, max = 100) String name,
    @Email String email
) {}

// Response DTO
public record UserResponse(
    UUID id,
    String name,
    String email,
    String role,
    Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getRole().name(),
            user.getCreatedAt()
        );
    }
}

public record PaginatedResponse<T>(
    List<T> data,
    int page,
    int size,
    long totalElements,
    int totalPages
) {
    public static <T> PaginatedResponse<T> from(Page<T> page) {
        return new PaginatedResponse<>(
            page.getContent(),
            page.getNumber(),
            page.getSize(),
            page.getTotalElements(),
            page.getTotalPages()
        );
    }
}
```

---

## 3. Service Layer

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Page<UserResponse> findAll(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserResponse::from);
    }

    public UserResponse findById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        // Business validation
        if (userRepository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use");
        }

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);

        User saved = userRepository.save(user);
        return UserResponse.from(saved);
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));

        if (request.name() != null) user.setName(request.name());
        if (request.email() != null) {
            if (!user.getEmail().equals(request.email())
                    && userRepository.existsByEmail(request.email())) {
                throw new ConflictException("Email already in use");
            }
            user.setEmail(request.email());
        }

        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void delete(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResourceNotFoundException("User", id);
        }
        userRepository.deleteById(id);
    }
}
```

---

## 4. Entity & Repository

```java
@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    @JsonIgnore  // Extra safety — never serialize
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "updated_at")
    @UpdateTimestamp
    private Instant updatedAt;
}

// Repository — Spring Data JPA
public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByEmail(String email);
    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.role = :role")
    Page<User> findByRole(@Param("role") Role role, Pageable pageable);
}
```

---

## 5. Global Exception Handling

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("not_found", ex.getMessage()));
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("conflict", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> new FieldError(e.getField(), e.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(new ValidationErrorResponse("validation_error", "Validation failed", errors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("validation_error", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("forbidden", "Access denied"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception at {} {}", request.getMethod(), request.getRequestURI(), ex);
        // NEVER expose stack trace or internal details
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("internal_error", "An unexpected error occurred"));
    }

    public record ErrorResponse(String error, String message) {}
    public record FieldError(String field, String message) {}
    public record ValidationErrorResponse(String error, String message, List<FieldError> details) {}
}
```

---

## 6. Security Configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)  // Disable for API (using JWT)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/health", "/actuator/health").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/public/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((req, res, ex) -> {
                            res.setContentType("application/json");
                            res.setStatus(401);
                            res.getWriter().write("{\"error\":\"unauthorized\"}");
                        })
                        .accessDeniedHandler((req, res, ex) -> {
                            res.setContentType("application/json");
                            res.setStatus(403);
                            res.getWriter().write("{\"error\":\"forbidden\"}");
                        })
                )
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://app.example.com"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(86400L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

---

## 7. Testing

```java
// Controller integration test
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean UserService userService;

    @Test
    void listUsers_returnsPagedResults() throws Exception {
        Page<UserResponse> page = new PageImpl<>(List.of(
                new UserResponse(UUID.randomUUID(), "Test", "test@test.com", "USER", Instant.now())
        ));
        when(userService.findAll(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/users")
                        .header("Authorization", "Bearer " + testToken)
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("Test"))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void createUser_withInvalidEmail_returns400() throws Exception {
        var request = new CreateUserRequest("Test", "invalid-email", "password123");

        mockMvc.perform(post("/api/users")
                        .header("Authorization", "Bearer " + testToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("validation_error"));
    }
}

// Service unit test
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @InjectMocks UserService userService;

    @Test
    void create_withExistingEmail_throwsConflict() {
        when(userRepository.existsByEmail("test@test.com")).thenReturn(true);

        assertThrows(ConflictException.class, () ->
                userService.create(new CreateUserRequest("Test", "test@test.com", "password123")));
    }
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Field injection (`@Autowired` on fields) | Untestable, hidden dependencies | Constructor injection (`@RequiredArgsConstructor`) |
| Exposing JPA entities in API responses | Internal fields leak, tight coupling | Use DTO records for all responses |
| `spring.jpa.open-in-view=true` (default) | Lazy loading in controllers, N+1 queries | Set `open-in-view: false`, eager fetch in repository |
| `ddl-auto: update` in production | Schema drift, data loss risk | Use Flyway/Liquibase migrations |
| No `@Transactional(readOnly = true)` on reads | Missed DB optimization hints | `readOnly = true` on service class, `@Transactional` on writes |
| Catching `Exception` in controller | Hides bugs, inconsistent errors | `@ControllerAdvice` global exception handler |
| No request validation | Garbage data persisted | `@Valid` + Bean Validation on all request bodies |
| Monolithic config class | Hard to understand, high coupling | Separate config classes by concern |
| Not using profiles for env config | Same config in dev and prod | `application-{profile}.yml` + `SPRING_PROFILES_ACTIVE` |
| `@Component` on everything | Unclear architecture layers | `@Service`, `@Repository`, `@Controller` for clarity |

---

## 9. Enforcement Checklist

- [ ] Constructor injection used (never field injection)
- [ ] DTOs used for all request/response bodies (never entities)
- [ ] `spring.jpa.open-in-view: false` configured
- [ ] Database migrations via Flyway or Liquibase (never ddl-auto in prod)
- [ ] `@ControllerAdvice` global exception handler with safe error responses
- [ ] Bean Validation (`@Valid`) on all request bodies
- [ ] Spring Security configured with role-based authorization
- [ ] Graceful shutdown enabled (`server.shutdown: graceful`)
- [ ] Actuator health endpoint exposed (not all endpoints)
- [ ] Spring Profiles used for environment configuration
- [ ] `@Transactional(readOnly = true)` on service read methods
- [ ] Connection pool (HikariCP) configured with appropriate limits
- [ ] OpenAPI documentation auto-generated (SpringDoc)
- [ ] Integration tests with `@SpringBootTest` + `MockMvc`
