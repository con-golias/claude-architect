class Product {
  constructor({ id, createdAt = new Date(), updatedAt = new Date() }) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  touch() {
    this.updatedAt = new Date();
  }
}

module.exports = { Product };
