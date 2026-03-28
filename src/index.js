require('dotenv').config();

const logger = require('./utils/logger');
const appointmentModel = require('./models/appointment');
const server = require('./server');
const telegramBot = require('./bot/telegram');

async function main() {
  try {
    logger.info('Starting Appointment Voice Agent...');

    // Validate required environment variables
    const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'BLAND_API_KEY', 'WEBHOOK_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      logger.error('Please set them in your .env file');
      process.exit(1);
    }

    // Initialize database
    logger.info('Initializing database...');
    await appointmentModel.init();

    // Start Express server (needed for webhooks)
    logger.info('Starting server...');
    await server.start();

    // Start Telegram bot
    logger.info('Starting Telegram bot...');
    telegramBot.start();

    logger.info('Appointment Voice Agent is running!');
    logger.info(`Server listening on port ${process.env.PORT || 3000}`);
    logger.info('Telegram bot is active');

    // Handle graceful shutdown
    setupGracefulShutdown();

  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      // Stop Telegram bot
      telegramBot.stop();
      logger.info('Telegram bot stopped');

      // Stop server
      await server.stop();
      logger.info('Server stopped');

      // Close database
      await appointmentModel.close();
      logger.info('Database connection closed');

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

// Start the application
main();
