const { createApp } = require('../dist/serverless');

module.exports = async function handler(req, res) {
  const app = await createApp();
  app(req, res);
};
