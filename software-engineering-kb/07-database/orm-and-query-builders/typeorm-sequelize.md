# TypeORM & Sequelize

> **Domain:** Database > ORM & Query Builders > TypeORM & Sequelize
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

TypeORM and Sequelize are established Node.js ORMs that preceded Prisma and Drizzle. TypeORM uses TypeScript decorators with an Active Record or Data Mapper pattern. Sequelize is a mature JavaScript ORM with model-based definition. While Prisma and Drizzle are recommended for new projects, TypeORM and Sequelize are widely used in existing codebases. Understanding them is necessary for maintaining legacy projects and for teams already invested in these ecosystems.

---

## How It Works

### TypeORM

```typescript
// TypeORM — Entity definition (decorator-based)
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: string;

  @OneToMany(() => Order, order => order.user)
  orders: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('orders')
@Index(['userId', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ type: 'enum', enum: ['pending', 'shipped', 'delivered'], default: 'pending' })
  status: string;

  @ManyToOne(() => User, user => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

```typescript
// TypeORM — CRUD operations
import { AppDataSource } from './data-source';

const userRepo = AppDataSource.getRepository(User);
const orderRepo = AppDataSource.getRepository(Order);

// CREATE
const user = userRepo.create({ email: 'alice@example.com', name: 'Alice' });
await userRepo.save(user);

// READ with relations
const userWithOrders = await userRepo.findOne({
  where: { id: userId },
  relations: { orders: true },
  order: { createdAt: 'DESC' },
});

// READ with query builder (more control)
const users = await userRepo.createQueryBuilder('user')
  .leftJoinAndSelect('user.orders', 'order')
  .where('user.role = :role', { role: 'admin' })
  .andWhere('order.total > :min', { min: 100 })
  .orderBy('user.createdAt', 'DESC')
  .skip(0)
  .take(20)
  .getMany();

// UPDATE
await userRepo.update({ id: userId }, { name: 'Alice Smith' });

// DELETE
await userRepo.delete({ id: userId });

// Transaction
await AppDataSource.transaction(async (manager) => {
  const order = manager.create(Order, { userId, total: 99.99 });
  await manager.save(order);
  await manager.update(User, { id: userId }, { updatedAt: new Date() });
});

// Raw SQL
const result = await AppDataSource.query(
  `SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue
   FROM orders WHERE created_at > $1 GROUP BY month`,
  [startDate]
);
```

---

### Sequelize

```typescript
// Sequelize — Model definition
import { DataTypes, Model, Sequelize } from 'sequelize';

const sequelize = new Sequelize(process.env.DATABASE_URL!);

class User extends Model {
  declare id: string;
  declare email: string;
  declare name: string;
  declare role: string;
  declare createdAt: Date;
}

User.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'admin'), defaultValue: 'user' },
}, {
  sequelize,
  tableName: 'users',
  underscored: true,  // snake_case columns
});

class Order extends Model {
  declare id: string;
  declare total: number;
  declare status: string;
  declare userId: string;
}

Order.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'shipped', 'delivered'), defaultValue: 'pending' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
}, {
  sequelize,
  tableName: 'orders',
  underscored: true,
});

User.hasMany(Order, { foreignKey: 'userId' });
Order.belongsTo(User, { foreignKey: 'userId' });
```

```typescript
// Sequelize — CRUD operations

// CREATE
const user = await User.create({ email: 'alice@example.com', name: 'Alice' });

// READ
const userWithOrders = await User.findByPk(userId, {
  include: [{ model: Order, where: { status: 'pending' }, required: false }],
});

// READ many
const users = await User.findAndCountAll({
  where: { role: 'admin' },
  include: [Order],
  order: [['createdAt', 'DESC']],
  limit: 20,
  offset: 0,
});

// UPDATE
await User.update({ name: 'Alice Smith' }, { where: { id: userId } });

// DELETE
await User.destroy({ where: { id: userId } });

// Transaction
await sequelize.transaction(async (t) => {
  const order = await Order.create(
    { userId, total: 99.99 },
    { transaction: t }
  );
  await User.update(
    { updatedAt: new Date() },
    { where: { id: userId }, transaction: t }
  );
});

// Raw SQL
const [results] = await sequelize.query(
  `SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue
   FROM orders WHERE created_at > :startDate GROUP BY month`,
  { replacements: { startDate } }
);
```

---

### TypeORM vs Sequelize vs Prisma vs Drizzle

| Feature | TypeORM | Sequelize | Prisma | Drizzle |
|---------|---------|-----------|--------|---------|
| **Language** | TypeScript | JavaScript/TS | TypeScript | TypeScript |
| **Pattern** | Active Record + Data Mapper | Active Record | Generated Client | Query Builder |
| **Schema** | Decorators | Model.init | .prisma file | TypeScript |
| **Type safety** | Partial | Weak | Excellent | Excellent |
| **Bundle size** | Medium | Medium | Large (15MB) | Small (50KB) |
| **Maturity** | High | Very High | High | Medium |
| **Migrations** | Built-in | Built-in (sequelize-cli) | Built-in | drizzle-kit |
| **Edge runtime** | No | No | Limited | Yes |
| **Recommendation** | Legacy projects | Legacy projects | New projects | New projects |

---

## Best Practices

1. **ALWAYS use Prisma or Drizzle for new projects** — better type safety and DX
2. **ALWAYS use query builder API in TypeORM** for complex queries — findOne is limited
3. **ALWAYS pass transactions explicitly** in Sequelize — easy to forget `{ transaction: t }`
4. **ALWAYS use `underscored: true`** in Sequelize — match database conventions
5. **NEVER use eager loading without limits** — N+1 and unbounded queries
6. **NEVER migrate from TypeORM/Sequelize without cost-benefit analysis** — migration has overhead

---

## Enforcement Checklist

- [ ] New projects use Prisma or Drizzle (not TypeORM/Sequelize)
- [ ] Existing TypeORM/Sequelize projects maintained (no unnecessary migration)
- [ ] Transactions explicitly passed in all multi-operation writes
- [ ] Query builder used for complex queries (not just find methods)
- [ ] Raw SQL used for analytics and complex reports
- [ ] Relations loaded explicitly (no implicit eager loading)
