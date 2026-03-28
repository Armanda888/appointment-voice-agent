const logger = require('../utils/logger');

class BlandVoiceService {
  constructor() {
    this.apiKey = process.env.BLAND_API_KEY;
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.baseUrl = 'https://api.bland.ai/v1';
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
        voice: process.env.BLAND_VOICE || 'nat',
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
      
      const response = await fetch(`${this.baseUrl}/calls`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callOptions)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bland API error: ${error}`);
      }

      const data = await response.json();
      
      logger.info(`Call initiated successfully. Call ID: ${data.call_id}`);
      
      return data.call_id;
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
      
      const response = await fetch(`${this.baseUrl}/calls/${callId}`, {
        method: 'GET',
        headers: {
          'Authorization': this.apiKey
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bland API error: ${error}`);
      }

      const data = await response.json();
      return data;
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
      logger.info('Received Bland.ai webhook. Keys:', Object.keys(webhookData).join(', '));
      
      // Bland.ai may send data in different formats
      const { 
        call_id, 
        status, 
        transcript, 
        call_transcript,
        concatenated_transcript,
        recording_url, 
        metadata, 
        summary,
        call_summary,
        analysis,
        recording_url: recUrl
      } = webhookData;
      
      // Try multiple possible transcript fields
      // Priority: concatenated_transcript (full conversation) > transcript/call_transcript > summary
      let actualTranscript = concatenated_transcript || transcript || call_transcript;
      
      // If no transcript found, try to build from analysis or summary
      if (!actualTranscript) {
        actualTranscript = summary || call_summary || analysis?.transcript;
      }
      
      logger.info('Extracted transcript length:', actualTranscript ? actualTranscript.length : 0);
      if (actualTranscript) {
        logger.info('Transcript preview:', actualTranscript.substring(0, 200));
      } else {
        logger.warn('No transcript found in webhook data');
      }
      
      // Extract appointment info from metadata
      const appointmentId = metadata?.appointment_id;
      const telegramUserId = metadata?.telegram_user_id;
      const telegramChatId = metadata?.telegram_chat_id;
      
      return {
        callId: call_id,
        status: status,
        transcript: actualTranscript,
        recordingUrl: recording_url || recUrl,
        summary: summary || call_summary,
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
    
    // Debug: log the full transcript to see what we're working with
    logger.info('Full transcript for confirmation check:', {
      transcript: lowerTranscript.substring(0, 500),
      containsSeeYou: lowerTranscript.includes('see you'),
      containsWell: lowerTranscript.includes('well'),
      containsConfirmed: lowerTranscript.includes('confirmed')
    });
    
    // Check for confirmation indicators - expanded list
    const confirmationIndicators = [
      'appointment is confirmed',
      'you are all set',
      'see you then',
      'appointment scheduled',
      'booked for',
      'confirmed for',
      'you\'re confirmed',
      'youre confirmed',
      'we\'ll see you',
      'well see you',
      'we will see you',
      'you\'re all set',
      'youre all set',
      'that works',
      'perfect',
      'great',
      'sounds good',
      'i\'ll put you down',
      'ill put you down',
      'you\'re booked',
      'youre booked',
      'we have you scheduled',
      'you\'re scheduled',
      'youre scheduled',
      'see you on',
      'see you then',
      'see you next'
    ];
    
    // Also check for negative indicators
    const negativeIndicators = [
      'not available',
      'can\'t schedule',
      'fully booked',
      'no openings',
      'we\'re closed',
      'call back',
      'voicemail',
      'not taking appointments'
    ];
    
    const hasConfirmation = confirmationIndicators.some(indicator => 
      lowerTranscript.includes(indicator)
    );
    
    const hasNegative = negativeIndicators.some(indicator =>
      lowerTranscript.includes(indicator)
    );
    
    logger.info('Confirmation check:', { 
      hasConfirmation, 
      hasNegative, 
      transcriptLength: lowerTranscript.length,
      transcriptPreview: lowerTranscript.substring(0, 100)
    });
    
    // Consider it confirmed if we have positive indicators and no strong negative ones
    details.confirmed = hasConfirmation && !hasNegative;
    
    // If no clear indicators but we have a date/time, it might still be confirmed
    if (!details.confirmed && !hasNegative) {
      // Check if the conversation seems to have reached a conclusion with scheduling
      const hasDate = details.date !== null;
      const hasTime = details.time !== null;
      const hasGoodbye = lowerTranscript.includes('bye') || lowerTranscript.includes('goodbye');
      const hasThanks = lowerTranscript.includes('thank you') || lowerTranscript.includes('thanks');
      const hasSeeYou = lowerTranscript.includes('see you');
      
      logger.info('Fallback check:', { hasDate, hasTime, hasGoodbye, hasThanks, hasSeeYou });
      
      // Strong indicator: we have both date and time extracted from the conversation
      if (hasDate && hasTime) {
        logger.info('Fallback confirmation: found both date and time in transcript');
        details.confirmed = true;
      }
    }

    // Extract date patterns (basic regex for common formats)
    const datePatterns = [
      /(tomorrow|today)/i,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|twenty|thirtieth)/i
    ];

    for (const pattern of datePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        details.date = match[0];
        logger.info(`Extracted date from transcript: ${details.date}`);
        break;
      }
    }

    // Extract time patterns - expanded to catch more formats
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm|a m|p m)/i,
      /(\d{1,2})\s*(am|pm|a m|p m)/i,
      /(morning|afternoon|evening|noon|midnight)/i,
      /(\d{1,2})\s*o\'?clock/i,
      /(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm|a m|p m)/i
    ];

    for (const pattern of timePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        details.time = match[0];
        logger.info(`Extracted time from transcript: ${details.time}`);
        break;
      }
    }
    
    // If no time found, try to extract from phrases like "at 3" or "around 2"
    if (!details.time) {
      const looseTimeMatch = transcript.match(/\b(at|around|about)\s+(\d{1,2})\b/i);
      if (looseTimeMatch) {
        details.time = looseTimeMatch[2];
        logger.info(`Extracted loose time from transcript: ${details.time}`);
      }
    }

    logger.info(`Extracted appointment details:`, details);
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
      
      const response = await fetch(`${this.baseUrl}/calls/${callId}/end`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey
        }
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bland API error: ${error}`);
      }

      logger.info(`Call ${callId} ended successfully`);
    } catch (error) {
      logger.error(`Error ending call ${callId}:`, error);
      throw error;
    }
  }
}

module.exports = new BlandVoiceService();
