/**
 * ProductController — QUALITY VIOLATION: God function, mixed concerns.
 * This controller does too much in a single method.
 */
const { ProductService } = require('../../application/services/ProductService');

class ProductController {
  constructor() {
    this.productService = new ProductService();
  }

  /**
   * QUALITY: God function — handles validation, business logic, formatting,
   * logging, caching, and error handling all in one method.
   */
  async handleProductRequest(req, res) {
    const action = req.query.action;
    const startTime = Date.now();
    let result = null;
    let statusCode = 200;
    let logLevel = 'info';
    let cacheKey = null;
    let shouldCache = false;

    // Validation mixed into controller
    if (action === 'create') {
      const { name, price, category } = req.body;
      if (!name) { res.status(400).json({ error: 'Name required' }); return; }
      if (!price || price < 0) { res.status(400).json({ error: 'Valid price required' }); return; }
      if (!category) { res.status(400).json({ error: 'Category required' }); return; }
      if (name.length > 200) { res.status(400).json({ error: 'Name too long' }); return; }
      if (price > 999999) { res.status(400).json({ error: 'Price too high' }); return; }

      try {
        result = await this.productService.createProduct(name, price, category);
        statusCode = 201;
        logLevel = 'info';
      } catch (err) {
        result = { error: err.message };
        statusCode = 500;
        logLevel = 'error';
      }
    } else if (action === 'get') {
      const id = req.query.id;
      cacheKey = `product:${id}`;
      shouldCache = true;
      try {
        result = await this.productService.getProductById(id);
      } catch (err) {
        result = { error: err.message };
        statusCode = 404;
        logLevel = 'warn';
      }
    } else if (action === 'list') {
      cacheKey = 'products:all';
      shouldCache = true;
      result = await this.productService.listProducts();
    } else if (action === 'discount') {
      const { category, percent } = req.body;
      if (!category || !percent) {
        res.status(400).json({ error: 'Category and percent required' });
        return;
      }
      try {
        const count = await this.productService.applyBulkDiscount(category, percent);
        result = { updated: count, category, percent };
        logLevel = 'info';
      } catch (err) {
        result = { error: err.message };
        statusCode = 500;
        logLevel = 'error';
      }
    } else {
      result = { error: 'Unknown action' };
      statusCode = 400;
    }

    // Inline logging (should be middleware)
    const duration = Date.now() - startTime;
    console[logLevel](`[${new Date().toISOString()}] ${action} ${statusCode} ${duration}ms`);

    // Inline cache logic (should be separate concern)
    if (shouldCache && cacheKey && statusCode === 200) {
      global.__productCache = global.__productCache || {};
      global.__productCache[cacheKey] = { data: result, timestamp: Date.now() };
    }

    // Response formatting mixed in
    res.status(statusCode).json({
      data: result,
      meta: {
        action,
        duration: `${duration}ms`,
        cached: shouldCache,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

module.exports = { ProductController };
