require('dotenv').config({ quiet: true });
const { validateEnvironment } = require('./src/config/env');
validateEnvironment();
const app = require('./src/app');
const { initializeDatabase } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database initialization error:', error.code || error.name || 'UNKNOWN');
    process.exit(1);
  }
};

startServer();
