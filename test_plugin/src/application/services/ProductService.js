/**
 * ProductService — APPLICATION LAYER VIOLATION!
 * This service imports directly from infrastructure instead of using
 * a domain repository interface. This breaks the dependency rule.
 */
const { Product } = require('../../domain/entities/Product');
// VIOLATION: Application layer importing from Infrastructure layer
const { getDatabase } = require('../../infrastructure/database/connection');

class ProductService {
  async createProduct(name, price, category) {
    const db = getDatabase();
    const id = Date.now().toString(36);
    const product = new Product(id, name, price, category);
    // VIOLATION: Direct SQL in application layer (should be in repository)
    db.prepare('INSERT INTO products (id, name, price, category) VALUES (?, ?, ?, ?)')
      .run(product.id, product.name, product.price, product.category);
    return product;
  }

  async getProductById(id) {
    const db = getDatabase();
    // SECURITY: SQL injection vulnerability — concatenating user input
    const row = db.prepare(`SELECT * FROM products WHERE id = '${id}'`).get();
    if (!row) throw new Error('Product not found');
    return new Product(row.id, row.name, row.price, row.category);
  }

  async listProducts() {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM products').all();
    return rows.map(r => new Product(r.id, r.name, r.price, r.category));
  }

  async applyBulkDiscount(category, percent) {
    const db = getDatabase();
    const products = db.prepare('SELECT * FROM products WHERE category = ?').all(category);
    for (const row of products) {
      const product = new Product(row.id, row.name, row.price, row.category);
      product.applyDiscount(percent);
      db.prepare('UPDATE products SET price = ? WHERE id = ?').run(product.price, product.id);
    }
    return products.length;
  }
}

module.exports = { ProductService };
