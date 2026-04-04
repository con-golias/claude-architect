const { Order } = require("../../domain/entities/Order");
const { OrderMapper } = require("../mappers/OrderMapper");

async function createOrder(input, repository) {
  const entity = new Order({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return OrderMapper.toOutput(entity);
}

module.exports = { createOrder };
