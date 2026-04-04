const { createPayment } = require("../../application/use-cases/CreatePaymentUseCase");

class PaymentController {
  constructor(repository) {
    this.repository = repository;
  }

  async create(req, res) {
    try {
      const result = await createPayment(req.body, this.repository);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = { PaymentController };
