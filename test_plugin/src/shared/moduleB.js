/**
 * Module B — CIRCULAR DEPENDENCY with Module A.
 * B imports A, A imports B → circular reference.
 */
const { getVersion } = require('./moduleA');

function transformData(data) {
  const version = getVersion();
  return { ...data, version, transformed: true };
}

function validateInput(input) {
  return input !== null && input !== undefined;
}

module.exports = { transformData, validateInput };
