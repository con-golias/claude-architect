/**
 * Product domain entity.
 */
class Product {
  constructor(id, name, price, category) {
    this.id = id;
    this.name = name;
    this.price = price;
    this.category = category;
    this.active = true;
  }

  applyDiscount(percent) {
    if (percent < 0 || percent > 100) {
      throw new Error('Discount must be between 0 and 100');
    }
    this.price = this.price * (1 - percent / 100);
  }

  deactivate() {
    this.active = false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      price: this.price,
      category: this.category,
      active: this.active,
    };
  }
}

module.exports = { Product };
