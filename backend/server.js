require('dotenv').config();
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
    console.error('Database initialization error:', error.message);
    process.exit(1);
  }
};

startServer();
