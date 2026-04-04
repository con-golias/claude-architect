const { Payment } = require("../../domain/entities/Payment");
const { PaymentMapper } = require("../mappers/PaymentMapper");

async function createPayment(input, repository) {
  const entity = new Payment({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return PaymentMapper.toOutput(entity);
}

module.exports = { createPayment };
