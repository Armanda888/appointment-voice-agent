require('dotenv').config();

const logger = require('./utils/logger');
const appointmentModel = require('./models/appointment');
const server = require('./server');
const telegramBot = require('./bot/telegram');
const calendarService = require('./services/calendar');

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

    // Initialize Google Calendar service
    logger.info('Initializing Google Calendar service...');
    const calendarInitialized = await calendarService.init();
    if (!calendarInitialized) {
      logger.warn('Google Calendar not initialized. Appointments will not be added to calendar.');
    }

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
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
      // Stop Telegram bot (only if it was started)
      try {
        telegramBot.stop();
        logger.info('Telegram bot stopped');
      } catch (err) {
        // Bot might not be running, ignore
      }

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
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

// Start the application
main();
