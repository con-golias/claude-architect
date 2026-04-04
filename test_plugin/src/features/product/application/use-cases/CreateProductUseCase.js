const { Product } = require("../../domain/entities/Product");
const { ProductMapper } = require("../mappers/ProductMapper");

async function createProduct(input, repository) {
  const entity = new Product({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return ProductMapper.toOutput(entity);
}

module.exports = { createProduct };
