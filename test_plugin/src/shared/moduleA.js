/**
 * Module A — CIRCULAR DEPENDENCY with Module B.
 * A imports B, B imports A → circular reference.
 */
const { transformData } = require('./moduleB');

function processInput(data) {
  const transformed = transformData(data);
  return { processed: true, result: transformed };
}

function getVersion() {
  return '1.0.0';
}

module.exports = { processInput, getVersion };
