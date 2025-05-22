const cryptoRoutes = require('./cryptoRoutes');
const healthRoutes = require('./healthRoutes');

module.exports = (app) => {
  app.use('/api', cryptoRoutes);
  app.use('/api/health', healthRoutes);
}; 