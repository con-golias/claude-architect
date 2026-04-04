const { createOrder } = require("../../application/use-cases/CreateOrderUseCase");

class OrderController {
  constructor(repository) {
    this.repository = repository;
  }

  async create(req, res) {
    try {
      const result = await createOrder(req.body, this.repository);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = { OrderController };
