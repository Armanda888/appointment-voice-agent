const express = require('express');
const logger = require('./utils/logger');
const blandService = require('./voice/bland');
const appointmentModel = require('./models/appointment');
const telegramBot = require('./bot/telegram');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'appointment-voice-agent'
      });
    });

    // Bland.ai webhook endpoint
    this.app.post('/webhook/bland', this.handleBlandWebhook.bind(this));

    // Get appointment by ID (for debugging)
    this.app.get('/api/appointments/:id', async (req, res) => {
      try {
        const appointment = await appointmentModel.getById(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        res.json(appointment);
      } catch (error) {
        logger.error('Error fetching appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get call details from Bland.ai (for debugging)
    this.app.get('/api/calls/:callId', async (req, res) => {
      try {
        const callDetails = await blandService.getCallDetails(req.params.callId);
        res.json(callDetails);
      } catch (error) {
        logger.error('Error fetching call details:', error);
        res.status(500).json({ error: 'Failed to fetch call details' });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  async handleBlandWebhook(req, res) {
    try {
      logger.info('Received Bland.ai webhook', { body: req.body });

      // Send immediate acknowledgment
      res.status(200).json({ received: true });

      // Process webhook asynchronously
      const eventData = blandService.handleWebhook(req.body);
      
      if (!eventData.appointmentId) {
        logger.warn('Webhook received without appointment metadata');
        return;
      }

      // Get appointment details
      const appointment = await appointmentModel.getById(eventData.appointmentId);
      
      if (!appointment) {
        logger.error(`Appointment not found: ${eventData.appointmentId}`);
        return;
      }

      // Handle different call statuses
      switch (eventData.status) {
        case 'completed':
        case 'finished':
          await this.handleCallCompleted(appointment, eventData);
          break;
        
        case 'failed':
        case 'error':
          await this.handleCallFailed(appointment, eventData);
          break;
        
        case 'in_progress':
          await this.handleCallInProgress(appointment, eventData);
          break;
        
        default:
          logger.info(`Unhandled call status: ${eventData.status}`);
      }
    } catch (error) {
      logger.error('Error processing webhook:', error);
      // Already sent 200 response, so just log the error
    }
  }

  async handleCallCompleted(appointment, eventData) {
    try {
      logger.info(`Call completed for appointment ${appointment.id}`);

      // Extract appointment details from transcript
      const extractedDetails = blandService.extractAppointmentDetails(eventData.transcript);
      
      // Update appointment status
      const updates = {
        call_transcript: eventData.transcript,
        notes: eventData.summary || ''
      };

      if (extractedDetails.confirmed) {
        updates.confirmed_date = extractedDetails.date || appointment.preferred_date;
        updates.confirmed_time = extractedDetails.time || appointment.preferred_time;
        
        await appointmentModel.updateStatus(
          appointment.id, 
          'confirmed', 
          updates
        );

        // Notify user of success
        await telegramBot.notifyCallComplete(
          appointment.telegram_chat_id,
          appointment,
          eventData
        );
      } else {
        await appointmentModel.updateStatus(
          appointment.id,
          'failed',
          updates
        );

        // Notify user that appointment couldn't be confirmed
        const message = `
📞 **Call Complete - Not Confirmed**

🏢 **${appointment.institute_name}**
💇 **${appointment.service}**

The call was completed but the appointment could not be confirmed. 

Possible reasons:
- No answer or voicemail
- Institute was closed
- Requested time not available
- Need to call back during business hours

You may want to call them directly at ${appointment.institute_phone}.
        `;

        await telegramBot.notifyUser(appointment.telegram_chat_id, message);
      }
    } catch (error) {
      logger.error('Error handling completed call:', error);
    }
  }

  async handleCallFailed(appointment, eventData) {
    try {
      logger.error(`Call failed for appointment ${appointment.id}`);

      await appointmentModel.updateStatus(
        appointment.id,
        'failed',
        {
          call_transcript: eventData.transcript || '',
          notes: `Call failed: ${eventData.status}`
        }
      );

      // Notify user of failure
      const message = `
❌ **Call Failed**

🏢 **${appointment.institute_name}**
💇 **${appointment.service}**

Sorry, the call could not be completed. This might be due to:
- Invalid phone number
- Network issues
- Service unavailable

Please check the phone number and try again, or call directly: ${appointment.institute_phone}
      `;

      await telegramBot.notifyUser(appointment.telegram_chat_id, message);
    } catch (error) {
      logger.error('Error handling failed call:', error);
    }
  }

  async handleCallInProgress(appointment, eventData) {
    try {
      logger.info(`Call in progress for appointment ${appointment.id}`);
      
      // Optionally notify user that call has started
      // This can be noisy, so we might skip it or make it configurable
    } catch (error) {
      logger.error('Error handling in-progress call:', error);
    }
  }

  setupErrorHandling() {
    // Global error handler
    this.app.use((err, req, res, next) => {
      logger.error('Express error:', err);
      res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new Server();
