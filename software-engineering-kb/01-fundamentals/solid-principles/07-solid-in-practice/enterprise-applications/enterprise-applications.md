# SOLID in Enterprise Applications

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Domain         | Fundamentals > SOLID Principles > Practice > Enterprise    |
| Difficulty     | Advanced                                                   |
| Prerequisites  | SOLID Principles (all five), Spring Boot, React, Angular, Go, Python |
| Last Updated   | 2026-03-07                                                 |

---

## What It Is

SOLID principles are not academic theory confined to textbook examples with shapes and animals. They are the backbone of maintainable production systems that serve millions of users, survive years of changing requirements, and remain comprehensible to teams of dozens or hundreds of engineers.

In enterprise applications, SOLID manifests differently than in classroom exercises. The Single Responsibility Principle does not mean "a class should do one thing" -- it means organizational boundaries in your codebase should mirror organizational boundaries in your business. The Open-Closed Principle does not mean wrapping everything in an interface -- it means designing extension points where change is likely while keeping stable code closed to modification.

This document demonstrates how SOLID principles appear in real-world enterprise systems built with Spring Boot, React/TypeScript, Angular, Go, and Python. Each example shows production-quality code with annotations explaining which principle is at work and why.

---

## Spring Boot Microservices (Java)

A payment processing microservice demonstrating all five SOLID principles working together.

### SRP: Layered Architecture with Separated Concerns

Each class has one reason to change, aligned with a specific layer of the application.

```java
// === CONTROLLER LAYER ===
// SRP: Only responsible for HTTP concerns -- request parsing, response formatting, status codes.
// This class changes only when the API contract changes.

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;

    // DIP: Depends on abstraction (PaymentService interface), not concrete implementation.
    @Autowired
    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    public ResponseEntity<PaymentResponse> processPayment(
            @Valid @RequestBody PaymentRequest request) {
        PaymentResult result = paymentService.process(request.toDomain());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(PaymentResponse.fromDomain(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaymentResponse> getPayment(@PathVariable UUID id) {
        return paymentService.findById(id)
                .map(p -> ResponseEntity.ok(PaymentResponse.fromDomain(p)))
                .orElse(ResponseEntity.notFound().build());
    }
}
```

```java
// === SERVICE LAYER ===
// SRP: Only responsible for business logic -- orchestrating validation, processing, and events.
// This class changes only when business rules change.

public interface PaymentService {
    PaymentResult process(Payment payment);
    Optional<Payment> findById(UUID id);
}

@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentGateway paymentGateway;
    private final PaymentRepository paymentRepository;
    private final PaymentValidator validator;
    private final EventPublisher eventPublisher;

    // DIP: All dependencies are interfaces injected via constructor.
    @Autowired
    public PaymentServiceImpl(
            PaymentGateway paymentGateway,
            PaymentRepository paymentRepository,
            PaymentValidator validator,
            EventPublisher eventPublisher) {
        this.paymentGateway = paymentGateway;
        this.paymentRepository = paymentRepository;
        this.validator = validator;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public PaymentResult process(Payment payment) {
        validator.validate(payment);  // SRP: validation is delegated
        PaymentResult result = paymentGateway.charge(payment);  // OCP: gateway is a strategy
        paymentRepository.save(payment.withStatus(result.getStatus()));
        eventPublisher.publish(new PaymentProcessedEvent(payment, result));
        return result;
    }

    @Override
    public Optional<Payment> findById(UUID id) {
        return paymentRepository.findById(id);
    }
}
```

### OCP: Strategy Pattern for Payment Processing

New payment methods can be added without modifying existing code.

```java
// OCP: This interface defines the extension point. New payment gateways
// are added by creating new implementations, not modifying existing ones.
public interface PaymentGateway {
    PaymentResult charge(Payment payment);
    boolean supports(PaymentMethod method);
}

@Component
public class StripeGateway implements PaymentGateway {
    private final StripeClient stripeClient;

    @Autowired
    public StripeGateway(StripeClient stripeClient) {
        this.stripeClient = stripeClient;
    }

    @Override
    public PaymentResult charge(Payment payment) {
        StripeCharge charge = stripeClient.createCharge(
            payment.getAmount(),
            payment.getCurrency(),
            payment.getCardToken()
        );
        return new PaymentResult(charge.getId(), PaymentStatus.COMPLETED);
    }

    @Override
    public boolean supports(PaymentMethod method) {
        return method == PaymentMethod.CREDIT_CARD;
    }
}

@Component
public class PayPalGateway implements PaymentGateway {
    private final PayPalClient paypalClient;

    @Autowired
    public PayPalGateway(PayPalClient paypalClient) {
        this.paypalClient = paypalClient;
    }

    @Override
    public PaymentResult charge(Payment payment) {
        PayPalPayment pp = paypalClient.executePayment(
            payment.getPaypalToken(),
            payment.getAmount()
        );
        return new PaymentResult(pp.getId(), PaymentStatus.COMPLETED);
    }

    @Override
    public boolean supports(PaymentMethod method) {
        return method == PaymentMethod.PAYPAL;
    }
}

// OCP: The router selects the right gateway without switch/if-else chains.
// Adding a CryptoGateway requires zero changes to this class.
@Component
public class PaymentGatewayRouter implements PaymentGateway {
    private final List<PaymentGateway> gateways;

    @Autowired
    public PaymentGatewayRouter(List<PaymentGateway> gateways) {
        this.gateways = gateways;
    }

    @Override
    public PaymentResult charge(Payment payment) {
        return gateways.stream()
                .filter(g -> g.supports(payment.getMethod()))
                .findFirst()
                .orElseThrow(() -> new UnsupportedPaymentMethodException(payment.getMethod()))
                .charge(payment);
    }

    @Override
    public boolean supports(PaymentMethod method) {
        return gateways.stream().anyMatch(g -> g.supports(method));
    }
}
```

### LSP: Proper Interface Hierarchies for Notifications

Every implementation is fully substitutable for its interface.

```java
// LSP: Every NotificationSender must fulfill the full contract.
// No implementation may throw UnsupportedOperationException or silently skip behavior.
public interface NotificationSender {
    void send(Notification notification);
    boolean isAvailable();
}

@Component
public class EmailNotificationSender implements NotificationSender {
    private final JavaMailSender mailSender;

    @Override
    public void send(Notification notification) {
        MimeMessage message = mailSender.createMimeMessage();
        // ... full email sending logic
        mailSender.send(message);
    }

    @Override
    public boolean isAvailable() {
        // Genuine health check -- LSP requires honest implementation
        try {
            mailSender.testConnection();
            return true;
        } catch (MessagingException e) {
            return false;
        }
    }
}

@Component
public class SmsNotificationSender implements NotificationSender {
    private final TwilioClient twilioClient;

    @Override
    public void send(Notification notification) {
        twilioClient.sendSms(notification.getRecipient(), notification.getBody());
    }

    @Override
    public boolean isAvailable() {
        return twilioClient.ping();
    }
}
```

### ISP: Focused Repository Interfaces

Instead of one large repository interface, responsibilities are segregated.

```java
// ISP: Separate read and write concerns. A reporting service that only
// reads data should not depend on write methods it never uses.

public interface ReadRepository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    List<T> findAll(Specification<T> spec);
    long count();
}

public interface WriteRepository<T, ID> {
    T save(T entity);
    List<T> saveAll(List<T> entities);
    void deleteById(ID id);
}

public interface PaymentReadRepository extends ReadRepository<Payment, UUID> {
    List<Payment> findByStatus(PaymentStatus status);
    List<Payment> findByDateRange(LocalDate start, LocalDate end);
}

public interface PaymentWriteRepository extends WriteRepository<Payment, UUID> {
    void updateStatus(UUID id, PaymentStatus status);
}

// A reporting service depends only on the read interface.
@Service
public class PaymentReportingService {
    private final PaymentReadRepository readRepository;  // ISP: no write methods visible

    @Autowired
    public PaymentReportingService(PaymentReadRepository readRepository) {
        this.readRepository = readRepository;
    }

    public PaymentReport generateDailyReport(LocalDate date) {
        List<Payment> payments = readRepository.findByDateRange(date, date);
        return PaymentReport.from(payments);
    }
}
```

### DIP: Constructor Injection with Spring IoC

```java
// DIP: The Spring configuration wires abstractions to implementations.
// Business logic never references concrete classes.

@Configuration
public class PaymentConfig {

    @Bean
    @Profile("production")
    public PaymentGateway stripeGateway(StripeClient client) {
        return new StripeGateway(client);
    }

    @Bean
    @Profile("test")
    public PaymentGateway testGateway() {
        return new InMemoryPaymentGateway();  // Swap implementations for testing
    }

    @Bean
    public PaymentService paymentService(
            PaymentGateway gateway,
            PaymentRepository repository,
            PaymentValidator validator,
            EventPublisher publisher) {
        return new PaymentServiceImpl(gateway, repository, validator, publisher);
    }
}
```

---

## React/TypeScript Frontend

SOLID principles applied to a React application with TypeScript.

### SRP: Custom Hooks Separate Data Fetching from Rendering

```typescript
// SRP: This hook is ONLY responsible for managing order data state.
// It changes only when the data fetching logic changes.
function useOrders(filters: OrderFilters) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    orderApi.fetchOrders(filters, controller.signal)
      .then(setOrders)
      .catch(setError)
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters]);

  return { orders, loading, error };
}

// SRP: This component is ONLY responsible for rendering the order list.
// It changes only when the visual design changes.
function OrderList({ orders, loading, error }: OrderListProps) {
  if (loading) return <Skeleton count={5} />;
  if (error) return <ErrorBanner message={error.message} />;

  return (
    <ul className="order-list">
      {orders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </ul>
  );
}

// SRP: Container component orchestrates data and presentation.
function OrdersPage() {
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_FILTERS);
  const { orders, loading, error } = useOrders(filters);

  return (
    <PageLayout>
      <OrderFiltersBar filters={filters} onChange={setFilters} />
      <OrderList orders={orders} loading={loading} error={error} />
    </PageLayout>
  );
}
```

### OCP: Component Composition for Extension

```typescript
// OCP: The DataTable component is open for extension (custom columns, renderers)
// but closed for modification (core table logic never changes).

interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
}

function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  emptyState,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) =>
      sortDir === 'asc'
        ? String(a[sortKey]).localeCompare(String(b[sortKey]))
        : String(b[sortKey]).localeCompare(String(a[sortKey]))
    );
  }, [data, sortKey, sortDir]);

  return (
    <table>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={String(col.key)} onClick={() => col.sortable && setSortKey(col.key)}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map(row => (
          <tr key={row.id} onClick={() => onRowClick?.(row)}>
            {columns.map(col => (
              <td key={String(col.key)}>
                {col.render ? col.render(row[col.key], row) : String(row[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Extending without modification -- just pass new column definitions:
const userColumns: Column<User>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role', render: (val) => <RoleBadge role={val as string} /> },
  { key: 'status', header: 'Status', render: (val) => <StatusIndicator status={val as string} /> },
];
```

### ISP: Focused Prop Interfaces

```typescript
// ISP VIOLATION: One massive props interface forces all consumers to know about everything.
// interface UserCardProps {
//   user: User; onEdit: () => void; onDelete: () => void;
//   showAvatar: boolean; showBio: boolean; showStats: boolean;
//   theme: Theme; size: 'sm' | 'md' | 'lg'; variant: 'card' | 'inline';
//   analyticsId: string; testId: string;
// }

// ISP: Segregated interfaces. Each component declares exactly what it needs.
interface UserDisplayProps {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface UserActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

interface StyleProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'inline';
}

// Components compose these focused interfaces:
type UserCardProps = UserDisplayProps & UserActionsProps & StyleProps;

function UserCard({ name, email, avatarUrl, onEdit, onDelete, size = 'md' }: UserCardProps) {
  return (
    <div className={`user-card user-card--${size}`}>
      <UserAvatar name={name} url={avatarUrl} />
      <UserInfo name={name} email={email} />
      <ActionButtons onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}
```

### DIP: Context API for Service Injection

```typescript
// DIP: Define abstractions (interfaces) for services.
interface AuthService {
  login(credentials: Credentials): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): User | null;
}

interface AnalyticsService {
  track(event: string, properties?: Record<string, unknown>): void;
}

// DIP: Create context with the abstraction type.
const AuthContext = createContext<AuthService | null>(null);
const AnalyticsContext = createContext<AnalyticsService | null>(null);

function useAuth(): AuthService {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// DIP: Provider injects the concrete implementation.
function AppProviders({ children }: { children: React.ReactNode }) {
  const authService = useMemo(() => new FirebaseAuthService(), []);
  const analytics = useMemo(() => new MixpanelAnalyticsService(), []);

  return (
    <AuthContext.Provider value={authService}>
      <AnalyticsContext.Provider value={analytics}>
        {children}
      </AnalyticsContext.Provider>
    </AuthContext.Provider>
  );
}

// DIP: Components depend on abstractions, not Firebase or Mixpanel directly.
function LoginForm() {
  const auth = useAuth();
  const analytics = useAnalytics();

  const handleSubmit = async (creds: Credentials) => {
    const user = await auth.login(creds);
    analytics.track('login_success', { userId: user.id });
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

---

## Angular Enterprise App

Angular's architecture has SOLID built into its DNA through its module system, dependency injection, and TypeScript interfaces.

### SRP: Services, Pipes, and Guards

```typescript
// SRP: Service handles only business logic for orders.
@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private http: HttpClient) {}

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders');
  }

  createOrder(order: CreateOrderDto): Observable<Order> {
    return this.http.post<Order>('/api/orders', order);
  }
}

// SRP: Pipe handles only data transformation for display.
@Pipe({ name: 'currencyFormat' })
export class CurrencyFormatPipe implements PipeTransform {
  transform(value: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  }
}

// SRP: Guard handles only route access control.
@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.currentUser?.role === 'admin') {
      return true;
    }
    this.router.navigate(['/unauthorized']);
    return false;
  }
}
```

### OCP: Directive Composition for Extension

```typescript
// OCP: Base tooltip directive provides core behavior.
@Directive({ selector: '[appTooltip]' })
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') content: string = '';
  @Input() position: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltipElement: HTMLElement | null = null;

  @HostListener('mouseenter')
  show() {
    this.tooltipElement = this.createTooltip();
    document.body.appendChild(this.tooltipElement);
  }

  @HostListener('mouseleave')
  hide() {
    this.tooltipElement?.remove();
    this.tooltipElement = null;
  }

  private createTooltip(): HTMLElement { /* ... */ }
  ngOnDestroy() { this.hide(); }
}

// OCP: Extended directive adds rich content without modifying the base.
@Directive({ selector: '[appRichTooltip]' })
export class RichTooltipDirective extends TooltipDirective {
  @Input() tooltipTemplate?: TemplateRef<any>;

  // Override createTooltip to support HTML templates
  // Base tooltip remains untouched
}
```

### DIP: Angular's Built-In DI with Injection Tokens

```typescript
// DIP: Define abstraction with an InjectionToken.
export interface Logger {
  log(message: string): void;
  error(message: string, error?: Error): void;
  warn(message: string): void;
}

export const LOGGER = new InjectionToken<Logger>('Logger');

// DIP: Concrete implementations.
@Injectable()
export class ConsoleLogger implements Logger {
  log(message: string) { console.log(`[LOG] ${message}`); }
  error(message: string, err?: Error) { console.error(`[ERROR] ${message}`, err); }
  warn(message: string) { console.warn(`[WARN] ${message}`); }
}

@Injectable()
export class DatadogLogger implements Logger {
  constructor(private datadogClient: DatadogClient) {}
  log(message: string) { this.datadogClient.sendLog('info', message); }
  error(message: string, err?: Error) { this.datadogClient.sendLog('error', message, err); }
  warn(message: string) { this.datadogClient.sendLog('warn', message); }
}

// DIP: Module provides the concrete implementation.
@NgModule({
  providers: [
    {
      provide: LOGGER,
      useClass: environment.production ? DatadogLogger : ConsoleLogger,
    },
  ],
})
export class CoreModule {}

// DIP: Components depend on the token (abstraction), not the concrete class.
@Component({ selector: 'app-dashboard', templateUrl: './dashboard.component.html' })
export class DashboardComponent {
  constructor(@Inject(LOGGER) private logger: Logger) {
    this.logger.log('Dashboard initialized');
  }
}
```

---

## Go Microservice

Go's philosophy of simplicity and explicit interfaces makes it a natural fit for SOLID principles.

### SRP: Package-Level Organization

```go
// Package structure mirrors SRP at the package level:
// /cmd/server/main.go       -- application entry point
// /internal/handler/         -- HTTP request handling
// /internal/service/         -- business logic
// /internal/repository/      -- data access
// /internal/model/           -- domain types

// === handler/order.go ===
// SRP: Only handles HTTP concerns.
package handler

type OrderHandler struct {
    service service.OrderService
}

func NewOrderHandler(svc service.OrderService) *OrderHandler {
    return &OrderHandler{service: svc}
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request body", http.StatusBadRequest)
        return
    }

    order, err := h.service.CreateOrder(r.Context(), req.ToDomain())
    if err != nil {
        handleError(w, err)
        return
    }

    w.WriteHeader(http.StatusCreated)
    json.NewEncoder(w).Encode(OrderResponse{}.FromDomain(order))
}

// === service/order.go ===
// SRP: Only handles business logic.
package service

type OrderService interface {
    CreateOrder(ctx context.Context, order model.Order) (*model.Order, error)
    GetOrder(ctx context.Context, id string) (*model.Order, error)
}

type orderService struct {
    repo       repository.OrderRepository
    inventory  InventoryChecker
    notifier   Notifier
}

// DIP: Constructor accepts interfaces, not concrete types.
func NewOrderService(
    repo repository.OrderRepository,
    inv InventoryChecker,
    notifier Notifier,
) OrderService {
    return &orderService{repo: repo, inventory: inv, notifier: notifier}
}

func (s *orderService) CreateOrder(ctx context.Context, order model.Order) (*model.Order, error) {
    if err := order.Validate(); err != nil {
        return nil, fmt.Errorf("validation failed: %w", err)
    }
    available, err := s.inventory.Check(ctx, order.Items)
    if err != nil {
        return nil, fmt.Errorf("inventory check failed: %w", err)
    }
    if !available {
        return nil, ErrOutOfStock
    }
    saved, err := s.repo.Save(ctx, &order)
    if err != nil {
        return nil, fmt.Errorf("saving order: %w", err)
    }
    s.notifier.Notify(ctx, "order_created", saved)
    return saved, nil
}
```

### ISP: Small Interfaces (Go's Natural Strength)

```go
// ISP: Go idiom -- interfaces should have 1-3 methods.
// Instead of one large Repository interface, use focused ones.

type OrderReader interface {
    GetByID(ctx context.Context, id string) (*model.Order, error)
    List(ctx context.Context, filter OrderFilter) ([]*model.Order, error)
}

type OrderWriter interface {
    Save(ctx context.Context, order *model.Order) (*model.Order, error)
    Update(ctx context.Context, order *model.Order) error
}

type OrderDeleter interface {
    Delete(ctx context.Context, id string) error
}

// Full repository composes the focused interfaces.
type OrderRepository interface {
    OrderReader
    OrderWriter
    OrderDeleter
}

// A reporting service only needs to read.
type ReportService struct {
    orders OrderReader  // ISP: depends only on what it uses
}

// ISP: Standard library examples -- io.Reader, io.Writer, fmt.Stringer
// These 1-method interfaces are the gold standard of ISP.
```

### OCP: Middleware Chains

```go
// OCP: Middleware adds behavior without modifying the handler.
type Middleware func(http.Handler) http.Handler

func WithLogging(logger *slog.Logger) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()
            next.ServeHTTP(w, r)
            logger.Info("request",
                "method", r.Method,
                "path", r.URL.Path,
                "duration", time.Since(start),
            )
        })
    }
}

func WithAuth(verifier TokenVerifier) Middleware {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := r.Header.Get("Authorization")
            if _, err := verifier.Verify(token); err != nil {
                http.Error(w, "unauthorized", http.StatusUnauthorized)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// OCP: Stack middleware without modifying any handler.
func main() {
    handler := NewOrderHandler(orderService)
    mux := http.NewServeMux()
    mux.Handle("/orders", Chain(handler, WithLogging(logger), WithAuth(verifier)))
}

func Chain(h http.Handler, middlewares ...Middleware) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        h = middlewares[i](h)
    }
    return h
}
```

---

## Python Django/FastAPI

### SRP: Layered Architecture in FastAPI

```python
# === models/order.py ===
# SRP: Only defines the data model.
from sqlalchemy import Column, String, Float, DateTime, Enum
from app.database import Base

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True)
    customer_id = Column(String, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(Enum("pending", "paid", "shipped"), default="pending")
    created_at = Column(DateTime, server_default=func.now())


# === schemas/order.py ===
# SRP: Only handles serialization / validation.
from pydantic import BaseModel, Field

class OrderCreate(BaseModel):
    customer_id: str
    items: list[OrderItemCreate]

class OrderResponse(BaseModel):
    id: str
    customer_id: str
    total: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# === services/order_service.py ===
# SRP: Only handles business logic.
from typing import Protocol

class PaymentProcessor(Protocol):
    def charge(self, amount: float, customer_id: str) -> str: ...

class OrderNotifier(Protocol):
    def notify(self, order_id: str, event: str) -> None: ...

class OrderService:
    def __init__(
        self,
        repo: OrderRepository,
        payment: PaymentProcessor,        # DIP: Protocol, not concrete class
        notifier: OrderNotifier,          # DIP: Protocol, not concrete class
    ):
        self.repo = repo
        self.payment = payment
        self.notifier = notifier

    async def create_order(self, data: OrderCreate) -> Order:
        order = Order(
            id=str(uuid4()),
            customer_id=data.customer_id,
            total=self._calculate_total(data.items),
        )
        payment_id = self.payment.charge(order.total, order.customer_id)
        order.payment_id = payment_id
        order.status = "paid"
        saved = await self.repo.save(order)
        self.notifier.notify(saved.id, "order_created")
        return saved

    def _calculate_total(self, items: list) -> float:
        return sum(item.price * item.quantity for item in items)


# === routers/order_router.py ===
# SRP: Only handles HTTP routing.
from fastapi import APIRouter, Depends

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/", response_model=OrderResponse, status_code=201)
async def create_order(
    data: OrderCreate,
    service: OrderService = Depends(get_order_service),  # DIP: injected
):
    order = await service.create_order(data)
    return OrderResponse.from_attributes(order)
```

### OCP: Class-Based Views with Extension Points

```python
# OCP in Django: Class-based views let you extend behavior via method overrides
# without modifying the base class.

from rest_framework import generics, serializers, permissions

class BaseListView(generics.ListAPIView):
    """Base view with standard pagination and filtering.
    Extend by overriding get_queryset, filterset_class, or serializer_class.
    """
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, OrderingFilter]

    def get_queryset(self):
        raise NotImplementedError("Subclasses must define get_queryset")


# OCP: Extend without modifying the base.
class OrderListView(BaseListView):
    serializer_class = OrderSerializer
    filterset_class = OrderFilter
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user)


class AdminOrderListView(BaseListView):
    serializer_class = AdminOrderSerializer
    filterset_class = AdminOrderFilter
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return Order.objects.all()
```

---

## SOLID in Microservices Architecture

SOLID principles scale beyond individual codebases to govern how services interact in a distributed system.

### SRP: Single-Purpose Microservices

Each microservice owns one bounded context and has one reason to change.

| Service          | Responsibility                  | Changes When...                        |
|------------------|---------------------------------|----------------------------------------|
| `user-service`   | User identity and profiles      | Authentication rules change            |
| `order-service`  | Order lifecycle management      | Order workflow changes                 |
| `payment-service`| Payment processing              | Payment methods or providers change    |
| `notification-service` | Sending notifications     | Notification channels change           |
| `inventory-service` | Stock management             | Inventory business rules change        |

### OCP: API Versioning and Backward Compatibility

```
GET /api/v1/orders       # Original API -- never modified
GET /api/v2/orders       # New fields added, new behavior
GET /api/v2/orders?expand=items   # Extended without breaking v1 clients
```

New capabilities are added via new versions or optional query parameters, not by modifying existing endpoints.

### LSP: Contract Testing Between Services

Consumer-driven contract tests (using Pact or Spring Cloud Contract) ensure that any implementation of a service API can be substituted for another without breaking consumers.

```yaml
# Pact contract: order-service expects payment-service to behave this way
interaction:
  description: "a request to charge a credit card"
  request:
    method: POST
    path: /api/v1/charges
    body:
      amount: 99.99
      currency: USD
  response:
    status: 201
    body:
      id: "ch_abc123"
      status: "succeeded"
```

### ISP: Focused API Endpoints

Instead of one monolithic API, each service exposes focused endpoints that serve specific client needs. A mobile BFF (Backend For Frontend) exposes only what the mobile app needs, while an admin BFF exposes admin-specific endpoints.

### DIP: Service Mesh and Message Queues as Abstractions

Services communicate through abstractions (message queues, service mesh) rather than direct HTTP calls:

```
Order Service --publish--> [Message Queue] --subscribe--> Notification Service
                                           --subscribe--> Analytics Service
                                           --subscribe--> Inventory Service
```

The Order Service depends on the abstraction (the message queue interface), not on concrete downstream services. New consumers can subscribe without modifying the publisher.

---

## Sources

- Fowler, M. (2002). *Patterns of Enterprise Application Architecture*. Addison-Wesley.
- Martin, R.C. (2017). *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall.
- Martin, R.C. (2008). *Clean Code: A Handbook of Agile Software Craftsmanship*. Prentice Hall.
- Spring Framework Documentation: https://docs.spring.io/spring-framework/reference/
- Angular Documentation: https://angular.io/guide/dependency-injection
- Go Proverbs: https://go-proverbs.github.io/
- FastAPI Documentation: https://fastapi.tiangolo.com/
- Newman, S. (2021). *Building Microservices*, 2nd Edition. O'Reilly Media.
- Richardson, C. (2018). *Microservices Patterns*. Manning Publications.
