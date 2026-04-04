/**
 * Product repository contract.
 * Infrastructure layer must provide an implementation matching these methods.
 */
class ProductRepository {
  async findById(id) { throw new Error("Not implemented"); }
  async save(entity) { throw new Error("Not implemented"); }
  async delete(id) { throw new Error("Not implemented"); }
}

module.exports = { ProductRepository };
