/**
 * Route definitions — wires controllers to Express routes.
 */
const { UserController } = require('../infrastructure/http/UserController');
const { ProductController } = require('../infrastructure/http/ProductController');
const { UserService } = require('../application/services/UserService');
const { UserRepositoryImpl } = require('../infrastructure/database/UserRepositoryImpl');

function setupRoutes(app) {
  const userRepo = new UserRepositoryImpl();
  const userService = new UserService(userRepo);
  const userController = new UserController(userService);
  const productController = new ProductController();

  // User routes — RESTful
  app.post('/api/users', (req, res) => userController.create(req, res));
  app.get('/api/users', (req, res) => userController.list(req, res));
  app.get('/api/users/:id', (req, res) => userController.getById(req, res));
  app.put('/api/users/:id/email', (req, res) => userController.updateEmail(req, res));
  app.delete('/api/users/:id', (req, res) => userController.delete(req, res));

  // Product routes — single endpoint (code smell)
  app.all('/api/products', (req, res) => productController.handleProductRequest(req, res));
}

module.exports = { setupRoutes };
