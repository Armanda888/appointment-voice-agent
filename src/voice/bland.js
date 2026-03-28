const Bland = require('bland');
const logger = require('../utils/logger');

class BlandVoiceService {
  constructor() {
    this.client = new Bland({
      apiKey: process.env.BLAND_API_KEY,
    });
    this.webhookUrl = process.env.WEBHOOK_URL;
  }

  /**
   * Create a voice call to schedule an appointment
   * @param {Object} appointment - Appointment details
   * @param {string} appointment.institute_phone - Phone number to call
   * @param {string} appointment.institute_name - Name of the institute
   * @param {string} appointment.service - Service being requested
   * @param {string} appointment.preferred_date - Preferred date
   * @param {string} appointment.preferred_time - Preferred time
   * @param {string} appointment.customer_name - Customer name
   * @returns {Promise<string>} - Call ID
   */
  async createCall(appointment) {
    try {
      const prompt = this.buildPrompt(appointment);
      
      const callOptions = {
        phone_number: appointment.institute_phone,
        task: prompt,
        voice: 'nat',
        wait_for_greeting: true,
        record: true,
        webhook: this.webhookUrl,
        metadata: {
          appointment_id: appointment.id,
          telegram_user_id: appointment.telegram_user_id,
          telegram_chat_id: appointment.telegram_chat_id
        }
      };

      logger.info(`Initiating call to ${appointment.institute_phone} for ${appointment.institute_name}`);
      
      const response = await this.client.calls.create(callOptions);
      
      logger.info(`Call initiated successfully. Call ID: ${response.call_id}`);
      
      return response.call_id;
    } catch (error) {
      logger.error('Error creating Bland.ai call:', error);
      throw error;
    }
  }

  /**
   * Build the AI prompt for the voice call
   * @param {Object} appointment - Appointment details
   * @returns {string} - Formatted prompt
   */
  buildPrompt(appointment) {
    const { institute_name, service, preferred_date, preferred_time, customer_name } = appointment;
    
    return `You are a helpful AI assistant calling to schedule an appointment on behalf of a customer.

INSTITUTE INFORMATION:
- Name: ${institute_name}
- Service needed: ${service}

CUSTOMER INFORMATION:
- Name: ${customer_name || 'a customer'}
- Preferred date: ${preferred_date || 'as soon as possible'}
- Preferred time: ${preferred_time || 'any convenient time'}

YOUR TASK:
1. Call ${institute_name} and introduce yourself politely
2. Explain that you're calling to schedule a ${service} appointment for ${customer_name || 'a customer'}
3. Ask about availability for ${preferred_date || 'the earliest available date'} around ${preferred_time || 'any convenient time'}
4. If the preferred time is not available, negotiate alternative times that work
5. Once an appointment is scheduled, confirm ALL details:
   - Date of appointment
   - Time of appointment
   - Service being provided
   - Any preparation needed
   - Cancellation policy if mentioned
6. Thank the representative and end the call professionally

IMPORTANT INSTRUCTIONS:
- Be polite, professional, and conversational
- Listen carefully to the representative
- If asked, explain that you're an AI assistant helping with scheduling
- If the call goes to voicemail, leave a clear message with callback information
- If the institute doesn't answer, note this in your response
- Do not provide any payment information
- Confirm all details before ending the call

CONVERSATION STYLE:
- Speak naturally with appropriate pauses
- Acknowledge what the representative says
- Ask clarifying questions if needed
- Be patient and flexible with scheduling`;
  }

  /**
   * Get call details and transcript
   * @param {string} callId - Bland.ai call ID
   * @returns {Promise<Object>} - Call details
   */
  async getCallDetails(callId) {
    try {
      logger.info(`Fetching call details for ${callId}`);
      const response = await this.client.calls.get(callId);
      return response;
    } catch (error) {
      logger.error(`Error fetching call details for ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Handle webhook events from Bland.ai
   * @param {Object} webhookData - Webhook payload
   * @returns {Object} - Parsed event data
   */
  handleWebhook(webhookData) {
    try {
      logger.info('Received Bland.ai webhook:', webhookData);
      
      const { call_id, status, transcript, recording_url, metadata, summary } = webhookData;
      
      // Extract appointment info from metadata
      const appointmentId = metadata?.appointment_id;
      const telegramUserId = metadata?.telegram_user_id;
      const telegramChatId = metadata?.telegram_chat_id;
      
      return {
        callId: call_id,
        status: status,
        transcript: transcript,
        recordingUrl: recording_url,
        summary: summary,
        appointmentId: appointmentId,
        telegramUserId: telegramUserId,
        telegramChatId: telegramChatId,
        raw: webhookData
      };
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Extract appointment confirmation details from transcript
   * @param {string} transcript - Call transcript
   * @returns {Object} - Extracted details
   */
  extractAppointmentDetails(transcript) {
    // Simple extraction logic - can be enhanced with NLP
    const details = {
      confirmed: false,
      date: null,
      time: null,
      notes: []
    };

    if (!transcript) {
      return details;
    }

    const lowerTranscript = transcript.toLowerCase();
    
    // Check for confirmation indicators
    const confirmationIndicators = [
      'appointment is confirmed',
      'you are all set',
      'see you then',
      'appointment scheduled',
      'booked for',
      'confirmed for'
    ];
    
    details.confirmed = confirmationIndicators.some(indicator => 
      lowerTranscript.includes(indicator)
    );

    // Extract date patterns (basic regex for common formats)
    const datePatterns = [
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i
    ];

    for (const pattern of datePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        details.date = match[0];
        break;
      }
    }

    // Extract time patterns
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i
    ];

    for (const pattern of timePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        details.time = match[0];
        break;
      }
    }

    return details;
  }

  /**
   * End an active call
   * @param {string} callId - Call ID to end
   * @returns {Promise<void>}
   */
  async endCall(callId) {
    try {
      logger.info(`Ending call ${callId}`);
      await this.client.calls.end(callId);
      logger.info(`Call ${callId} ended successfully`);
    } catch (error) {
      logger.error(`Error ending call ${callId}:`, error);
      throw error;
    }
  }
}

module.exports = new BlandVoiceService();
