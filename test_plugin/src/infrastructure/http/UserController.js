/**
 * UserController — HTTP layer, handles request/response.
 * Clean: delegates to application service.
 */
const { UserDto } = require('../../application/dtos/UserDto');

class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  async create(req, res) {
    try {
      const { name, email, role } = req.body;
      const user = await this.userService.createUser(name, email, role);
      res.status(201).json(UserDto.fromEntity(user));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.json(UserDto.fromEntity(user));
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }

  async list(req, res) {
    const users = await this.userService.listUsers();
    res.json(UserDto.fromEntityList(users));
  }

  async updateEmail(req, res) {
    try {
      const user = await this.userService.updateUserEmail(req.params.id, req.body.email);
      res.json(UserDto.fromEntity(user));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = { UserController };
