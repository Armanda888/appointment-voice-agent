const { Telegraf, Markup } = require('telegraf');
const logger = require('../utils/logger');
const appointmentModel = require('../models/appointment');
const blandService = require('../voice/bland');

class TelegramBot {
  constructor() {
    this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    this.userSessions = new Map(); // Store user conversation state
    this.setupHandlers();
  }

  setupHandlers() {
    // Start command
    this.bot.command('start', this.handleStart.bind(this));
    
    // Help command
    this.bot.command('help', this.handleHelp.bind(this));
    
    // My appointments command
    this.bot.command('myappointments', this.handleMyAppointments.bind(this));
    
    // Cancel appointment command
    this.bot.command('cancel', this.handleCancel.bind(this));
    
    // Handle text messages
    this.bot.on('text', this.handleTextMessage.bind(this));
    
    // Handle callback queries (button clicks)
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    
    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Telegram bot error:', err);
      ctx.reply('Sorry, something went wrong. Please try again.');
    });
  }

  async handleStart(ctx) {
    const welcomeMessage = `
Welcome to Appointment Voice Agent! 🤖

I can help you schedule appointments by making phone calls to institutes on your behalf.

Here's how to use me:
1. Send me a message like: "Book a haircut at Salon XYZ tomorrow at 3pm, their number is 555-1234"
2. I'll confirm the details with you
3. I'll make the call and handle the conversation
4. You'll get updates on the call progress and confirmation

Commands:
/start - Show this welcome message
/help - Get help and examples
/myappointments - View your recent appointments
/cancel <appointment_id> - Cancel an appointment

Let's get started!`;

    await ctx.reply(welcomeMessage);
  }

  async handleHelp(ctx) {
    const helpMessage = `
**How to book an appointment:**

Just send me a natural message with the details:
• "Book a dental cleaning at Smile Dental for next Tuesday at 2pm, call 555-0199"
• "Make a reservation at Tony's Restaurant for Friday 7pm, phone: 555-8888"
• "Schedule a haircut tomorrow afternoon at 3pm at Cut & Style, 555-2345"

**What I need:**
- Service type (haircut, dental, dinner, etc.)
- Institute name
- Preferred date and time
- Phone number

**Tips:**
- You can be flexible with time: "morning", "afternoon", "evening"
- Dates: "tomorrow", "next Monday", "this Friday"
- I'll ask for missing information

**During the call:**
- I'll negotiate alternative times if needed
- I'll confirm all details before ending
- You'll get real-time updates

Need more help? Just ask!`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  async handleMyAppointments(ctx) {
    try {
      const userId = ctx.from.id.toString();
      const appointments = await appointmentModel.getByUserId(userId, 5);

      if (appointments.length === 0) {
        await ctx.reply('You don\'t have any appointments yet. Send me a message to book one!');
        return;
      }

      let message = '📋 **Your Recent Appointments:**\n\n';
      
      appointments.forEach((apt, index) => {
        const statusEmoji = this.getStatusEmoji(apt.status);
        message += `${index + 1}. **${apt.institute_name}**\n`;
        message += `   Service: ${apt.service}\n`;
        message += `   Status: ${statusEmoji} ${apt.status}\n`;
        message += `   When: ${apt.preferred_date || 'TBD'} at ${apt.preferred_time || 'TBD'}\n`;
        if (apt.confirmed_date) {
          message += `   Confirmed: ${apt.confirmed_date} at ${apt.confirmed_time}\n`;
        }
        message += `   ID: \`${apt.id}\`\n\n`;
      });

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('Error fetching appointments:', error);
      await ctx.reply('Sorry, I couldn\'t fetch your appointments. Please try again.');
    }
  }

  async handleCancel(ctx) {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      await ctx.reply('Please provide an appointment ID. Example: /cancel 123');
      return;
    }

    const appointmentId = args[1];
    
    try {
      const appointment = await appointmentModel.getById(appointmentId);
      
      if (!appointment) {
        await ctx.reply('Appointment not found. Check the ID with /myappointments');
        return;
      }

      if (appointment.telegram_user_id !== ctx.from.id.toString()) {
        await ctx.reply('You can only cancel your own appointments.');
        return;
      }

      if (appointment.status === 'cancelled') {
        await ctx.reply('This appointment is already cancelled.');
        return;
      }

      await appointmentModel.updateStatus(appointmentId, 'cancelled', {
        notes: 'Cancelled by user via Telegram'
      });

      await ctx.reply(`✅ Appointment #${appointmentId} has been cancelled.`);
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      await ctx.reply('Sorry, I couldn\'t cancel the appointment. Please try again.');
    }
  }

  async handleTextMessage(ctx) {
    const userId = ctx.from.id.toString();
    const text = ctx.message.text;

    // Check if user is in a conversation flow
    const session = this.userSessions.get(userId);
    
    if (session && session.state === 'awaiting_phone') {
      await this.handlePhoneInput(ctx, session, text);
      return;
    }

    if (session && session.state === 'awaiting_confirmation') {
      await this.handleConfirmation(ctx, session, text);
      return;
    }

    // Parse new appointment request
    await this.parseAppointmentRequest(ctx, text);
  }

  async parseAppointmentRequest(ctx, text) {
    try {
      // Extract appointment details from natural language
      const details = this.extractAppointmentDetails(text);
      
      if (!details.service) {
        await ctx.reply('I couldn\'t understand what service you need. Please include the service type (e.g., haircut, dental cleaning, dinner reservation).');
        return;
      }

      if (!details.instituteName) {
        await ctx.reply('Please include the name of the place you want to book with (e.g., "at Salon XYZ").');
        return;
      }

      // Store in session
      const session = {
        state: details.phone ? 'awaiting_confirmation' : 'awaiting_phone',
        data: {
          telegram_user_id: ctx.from.id.toString(),
          telegram_chat_id: ctx.chat.id.toString(),
          service: details.service,
          institute_name: details.instituteName,
          institute_phone: details.phone,
          preferred_date: details.date,
          preferred_time: details.time,
          customer_name: ctx.from.first_name || ctx.from.username || 'Customer'
        }
      };

      this.userSessions.set(ctx.from.id.toString(), session);

      if (!details.phone) {
        await ctx.reply(`I need the phone number for ${details.instituteName}. Please provide it:`);
        return;
      }

      await this.showConfirmation(ctx, session);
    } catch (error) {
      logger.error('Error parsing appointment request:', error);
      await ctx.reply('Sorry, I had trouble understanding your request. Please try again with more details.');
    }
  }

  extractAppointmentDetails(text) {
    const lowerText = text.toLowerCase();
    
    // Extract service
    const servicePatterns = [
      /(?:book|schedule|make|reserve|get)\s+(?:a\s+)?(haircut|appointment|reservation|cleaning|consultation|meeting|dinner|lunch|table)/i,
      /(haircut|dental cleaning|doctor appointment|massage|consultation|reservation|table)/i
    ];
    
    let service = null;
    for (const pattern of servicePatterns) {
      const match = text.match(pattern);
      if (match) {
        service = match[1];
        break;
      }
    }

    // Extract institute name (text after "at" or "with")
    let instituteName = null;
    const instituteMatch = text.match(/(?:at|with)\s+([A-Za-z0-9\s&'\.]+?)(?:\s+(?:for|on|tomorrow|today|next|call|phone|at\s+\d)|\s*,|\s*$)/i);
    if (instituteMatch) {
      instituteName = instituteMatch[1].trim();
    }

    // Extract phone number
    let phone = null;
    const phoneMatch = text.match(/(?:call|phone|number|#)\s*:?\s*(\+?\d[\d\s\-\(\)\.]{7,})/i);
    if (phoneMatch) {
      phone = phoneMatch[1].replace(/[\s\-\(\)\.]/g, '');
    }

    // Extract date
    let date = null;
    const datePatterns = [
      { pattern: /tomorrow/i, value: 'tomorrow' },
      { pattern: /today/i, value: 'today' },
      { pattern: /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, value: null },
      { pattern: /this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, value: null },
      { pattern: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, value: null },
      { pattern: /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/, value: null }
    ];

    for (const { pattern } of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        date = match[0];
        break;
      }
    }

    // Extract time
    let time = null;
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(morning|afternoon|evening|noon|night)/i
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        time = match[0];
        break;
      }
    }

    return { service, instituteName, phone, date, time };
  }

  async handlePhoneInput(ctx, session, phone) {
    // Clean phone number
    const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    
    if (cleanedPhone.length < 10) {
      await ctx.reply('That doesn\'t look like a valid phone number. Please provide a valid number (e.g., 555-123-4567):');
      return;
    }

    session.data.institute_phone = cleanedPhone;
    session.state = 'awaiting_confirmation';
    
    await this.showConfirmation(ctx, session);
  }

  async showConfirmation(ctx, session) {
    const { data } = session;
    
    const message = `
Please confirm the appointment details:

📍 **Institute:** ${data.institute_name}
📞 **Phone:** ${data.institute_phone}
💇 **Service:** ${data.service}
📅 **Date:** ${data.preferred_date || 'Flexible'}
⏰ **Time:** ${data.preferred_time || 'Flexible'}
👤 **For:** ${data.customer_name}

Should I proceed with the call?`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Yes, make the call', 'confirm_yes'),
        Markup.button.callback('❌ No, cancel', 'confirm_no')
      ],
      [
        Markup.button.callback('✏️ Edit details', 'confirm_edit')
      ]
    ]);

    await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  }

  async handleConfirmation(ctx, session, text) {
    // This handles text responses when waiting for confirmation
    // Mainly handles the edit flow
    if (text.toLowerCase().includes('edit') || text.toLowerCase().includes('change')) {
      session.state = 'awaiting_phone';
      await ctx.reply('Let\'s start over. Please send me your complete appointment request.');
      return;
    }
  }

  async handleCallbackQuery(ctx) {
    const action = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();
    const session = this.userSessions.get(userId);

    await ctx.answerCbQuery();

    if (action === 'confirm_yes') {
      if (!session) {
        await ctx.reply('Session expired. Please send your appointment request again.');
        return;
      }

      await this.initiateCall(ctx, session);
      this.userSessions.delete(userId);
    } else if (action === 'confirm_no') {
      this.userSessions.delete(userId);
      await ctx.editMessageText('Appointment cancelled. Send me a new request when you\'re ready!');
    } else if (action === 'confirm_edit') {
      session.state = 'awaiting_phone';
      await ctx.editMessageText('Let\'s start over. Please send me your complete appointment request with all details.');
    }
  }

  async initiateCall(ctx, session) {
    try {
      // Save appointment to database
      const appointmentId = await appointmentModel.create(session.data);
      
      await ctx.reply(`📞 Initiating call to ${session.data.institute_name}...\n\nI'll update you on the progress.`);

      // Update status to calling
      await appointmentModel.updateStatus(appointmentId, 'calling');

      // Get full appointment data
      const appointment = await appointmentModel.getById(appointmentId);

      // Initiate Bland.ai call
      const callId = await blandService.createCall(appointment);

      // Update appointment with call ID
      await appointmentModel.updateStatus(appointmentId, 'calling', { call_id: callId });

      await ctx.reply(`✅ Call initiated!\n\n📋 Appointment ID: \`${appointmentId}\`\n📞 Call ID: \`${callId}\`\n\nI'll notify you when the call is complete.`, { parse_mode: 'Markdown' });

    } catch (error) {
      logger.error('Error initiating call:', error);
      await ctx.reply('❌ Sorry, I couldn\'t initiate the call. Please try again later.');
      
      // Update status to failed
      if (session.data.appointmentId) {
        await appointmentModel.updateStatus(session.data.appointmentId, 'failed', {
          notes: error.message
        });
      }
    }
  }

  getStatusEmoji(status) {
    const emojis = {
      pending: '⏳',
      calling: '📞',
      confirmed: '✅',
      failed: '❌',
      cancelled: '🚫'
    };
    return emojis[status] || '❓';
  }

  async notifyUser(telegramChatId, message) {
    try {
      await this.bot.telegram.sendMessage(telegramChatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error(`Error notifying user ${telegramChatId}:`, error);
    }
  }

  async notifyCallComplete(telegramChatId, appointment, callDetails) {
    const { confirmed, date, time } = blandService.extractAppointmentDetails(callDetails.transcript);
    
    let message = `📞 **Call Complete!**\n\n`;
    message += `🏢 **${appointment.institute_name}**\n`;
    message += `💇 **${appointment.service}**\n\n`;

    if (confirmed) {
      message += `✅ **Appointment Confirmed!**\n`;
      if (date) message += `📅 **Date:** ${date}\n`;
      if (time) message += `⏰ **Time:** ${time}\n`;
    } else {
      message += `⚠️ **Could not confirm appointment**\n`;
      message += `The representative may need you to call back or visit in person.\n`;
    }

    if (callDetails.recording_url) {
      message += `\n🎙️ [Listen to call recording](${callDetails.recording_url})`;
    }

    await this.notifyUser(telegramChatId, message);
  }

  start() {
    this.bot.launch();
    logger.info('Telegram bot started');
  }

  stop() {
    this.bot.stop();
    logger.info('Telegram bot stopped');
  }
}

module.exports = new TelegramBot();
