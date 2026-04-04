const { Auth } = require("../../domain/entities/Auth");
const { AuthMapper } = require("../mappers/AuthMapper");

async function createAuth(input, repository) {
  const entity = new Auth({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return AuthMapper.toOutput(entity);
}

module.exports = { createAuth };
