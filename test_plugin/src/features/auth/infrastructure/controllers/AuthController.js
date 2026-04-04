const { createAuth } = require("../../application/use-cases/CreateAuthUseCase");

class AuthController {
  constructor(repository) {
    this.repository = repository;
  }

  async create(req, res) {
    try {
      const result = await createAuth(req.body, this.repository);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = { AuthController };
