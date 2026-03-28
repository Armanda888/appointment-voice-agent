const { google } = require('googleapis');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
    this.tokenPath = path.join(__dirname, '../../data/calendar-token.json');
    this.credentialsPath = path.join(__dirname, '../../data/calendar-credentials.json');
  }

  /**
   * Initialize the Google Calendar service
   * Checks for credentials and sets up OAuth2 client
   */
  async init() {
    try {
      // Check if credentials file exists
      if (!fs.existsSync(this.credentialsPath)) {
        logger.warn('Google Calendar credentials not found. Calendar integration disabled.');
        logger.info(`Please place your credentials file at: ${this.credentialsPath}`);
        return false;
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

      // Use the redirect URI from credentials file
      const redirectUri = redirect_uris[0] || 'http://localhost';

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri
      );

      // Check for existing token
      if (fs.existsSync(this.tokenPath)) {
        const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8'));
        this.oauth2Client.setCredentials(token);
        this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
        logger.info('Google Calendar service initialized successfully');
        return true;
      } else {
        logger.warn('Google Calendar token not found. Please authenticate first.');
        this.generateAuthUrl(client_id, redirect_uris[0]);
        return false;
      }
    } catch (error) {
      logger.error('Error initializing Google Calendar service:', error);
      return false;
    }
  }

  /**
   * Generate authentication URL for user to authorize
   */
  generateAuthUrl() {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
    });

    logger.info('Authorize this app by visiting this URL:', authUrl);
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from user
   */
  async getToken(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Save token
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokens));
      logger.info('Token stored successfully');

      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      return true;
    } catch (error) {
      logger.error('Error retrieving access token:', error);
      throw error;
    }
  }

  /**
   * Add an appointment to Google Calendar
   * @param {Object} appointment - Appointment details
   * @returns {Promise<string>} - Event ID
   */
  async addAppointment(appointment) {
    if (!this.calendar) {
      logger.warn('Google Calendar not initialized. Skipping calendar add.');
      return null;
    }

    try {
      logger.info('Adding appointment to calendar:', {
        id: appointment.id,
        service: appointment.service,
        institute: appointment.institute_name,
        confirmed_date: appointment.confirmed_date,
        confirmed_time: appointment.confirmed_time,
        preferred_date: appointment.preferred_date,
        preferred_time: appointment.preferred_time
      });

      // Parse date and time
      const dateToParse = appointment.confirmed_date || appointment.preferred_date;
      const timeToParse = appointment.confirmed_time || appointment.preferred_time;
      
      logger.info('Parsing date/time:', { dateToParse, timeToParse });
      
      const { startTime, endTime } = this.parseDateTime(dateToParse, timeToParse);

      if (!startTime) {
        logger.warn('Could not parse appointment date/time. Skipping calendar add.');
        return null;
      }
      
      logger.info('Parsed date/time successfully:', { 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString() 
      });

      const event = {
        summary: `${appointment.service} at ${appointment.institute_name}`,
        location: appointment.institute_name,
        description: this.buildEventDescription(appointment),
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'America/New_York', // You may want to make this configurable
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'America/New_York',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      logger.info(`Event created: ${response.data.htmlLink}`);
      return response.data.id;
    } catch (error) {
      logger.error('Error adding event to calendar:', error);
      throw error;
    }
  }

  /**
   * Parse date and time strings into Date objects
   * @param {string} dateStr - Date string (e.g., "tomorrow", "Monday", "3/28/2026")
   * @param {string} timeStr - Time string (e.g., "3pm", "15:00")
   * @returns {Object} - { startTime: Date, endTime: Date }
   */
  parseDateTime(dateStr, timeStr) {
    try {
      const now = new Date();
      let startTime = new Date(now);
      let durationMinutes = 60; // Default 1 hour appointment

      // Parse date
      if (dateStr) {
        const lowerDate = dateStr.toLowerCase();
        
        if (lowerDate === 'today') {
          // Keep today's date
        } else if (lowerDate === 'tomorrow') {
          startTime.setDate(startTime.getDate() + 1);
        } else if (lowerDate.includes('next')) {
          // Handle "next Monday", "next Tuesday", etc.
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = days.find(day => lowerDate.includes(day));
          if (targetDay) {
            const targetDayIndex = days.indexOf(targetDay);
            const currentDay = startTime.getDay();
            let daysUntil = targetDayIndex - currentDay;
            if (daysUntil <= 0) daysUntil += 7;
            startTime.setDate(startTime.getDate() + daysUntil + 7); // Next week
          }
        } else {
          // Try to parse as a date
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            startTime = parsedDate;
          } else {
            // Try parsing spelled-out dates like "April tenth"
            const spelledDate = this.parseSpelledOutDate(dateStr);
            if (spelledDate) {
              startTime = spelledDate;
            }
          }
        }
      }

      // Parse time
      if (timeStr) {
        const lowerTime = timeStr.toLowerCase();
        
        if (lowerTime.includes('morning')) {
          startTime.setHours(9, 0, 0, 0);
        } else if (lowerTime.includes('afternoon')) {
          startTime.setHours(14, 0, 0, 0);
        } else if (lowerTime.includes('evening')) {
          startTime.setHours(18, 0, 0, 0);
        } else if (lowerTime.includes('noon')) {
          startTime.setHours(12, 0, 0, 0);
        } else if (lowerTime.includes('midnight')) {
          startTime.setHours(0, 0, 0, 0);
        } else if (lowerTime.includes('o\'clock') || lowerTime.includes('oclock')) {
          // Handle "3 o'clock" format
          const hourMatch = timeStr.match(/(\d{1,2})/);
          if (hourMatch) {
            startTime.setHours(parseInt(hourMatch[1]), 0, 0, 0);
          }
        } else {
          // Try parsing spelled-out time like "ten A M"
          const spelledHour = this.parseSpelledOutTime(timeStr);
          if (spelledHour !== null) {
            startTime.setHours(spelledHour, 0, 0, 0);
          } else {
            // Try to parse time like "3pm" or "15:00"
            const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1]);
              const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
              const ampm = timeMatch[3];

              if (ampm) {
                if (ampm.toLowerCase() === 'pm' && hours !== 12) {
                  hours += 12;
                } else if (ampm.toLowerCase() === 'am' && hours === 12) {
                  hours = 0;
                }
              }

              startTime.setHours(hours, minutes, 0, 0);
            }
          }
        }
      } else {
        // Default to 10 AM if no time specified
        startTime.setHours(10, 0, 0, 0);
      }

      // Calculate end time
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

      return { startTime, endTime };
    } catch (error) {
      logger.error('Error parsing date/time:', error);
      return { startTime: null, endTime: null };
    }
  }

  /**
   * Parse spelled-out dates like "April tenth" or "May fifth"
   * @param {string} dateStr - Date string
   * @returns {Date|null} - Parsed date or null
   */
  parseSpelledOutDate(dateStr) {
    try {
      const monthNames = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
      };
      
      const ordinalNumbers = {
        'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
        'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
        'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14, 'fifteenth': 15,
        'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18, 'nineteenth': 19, 'twentieth': 20,
        'twenty-first': 21, 'twenty-second': 22, 'twenty-third': 23, 'twenty-fourth': 24, 'twenty-fifth': 25,
        'twenty-sixth': 26, 'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29, 'thirtieth': 30,
        'thirty-first': 31
      };
      
      const lowerStr = dateStr.toLowerCase();
      
      // Find month
      let month = -1;
      for (const [name, num] of Object.entries(monthNames)) {
        if (lowerStr.includes(name)) {
          month = num;
          break;
        }
      }
      
      if (month === -1) return null;
      
      // Find day (ordinal or number)
      let day = -1;
      for (const [name, num] of Object.entries(ordinalNumbers)) {
        if (lowerStr.includes(name)) {
          day = num;
          break;
        }
      }
      
      // If no ordinal found, try regular number
      if (day === -1) {
        const dayMatch = lowerStr.match(/(\d{1,2})(?:st|nd|rd|th)?/);
        if (dayMatch) {
          day = parseInt(dayMatch[1]);
        }
      }
      
      if (day === -1 || day < 1 || day > 31) return null;
      
      // Create date (assume current year)
      const now = new Date();
      const date = new Date(now.getFullYear(), month, day);
      
      // If date has passed, assume next year
      if (date < now) {
        date.setFullYear(date.getFullYear() + 1);
      }
      
      return date;
    } catch (error) {
      logger.error('Error parsing spelled-out date:', error);
      return null;
    }
  }

  /**
   * Parse spelled-out time like "ten A M" or "three PM"
   * @param {string} timeStr - Time string
   * @returns {number|null} - Hour (0-23) or null
   */
  parseSpelledOutTime(timeStr) {
    const hourWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12
    };
    
    const lowerStr = timeStr.toLowerCase();
    
    // Find hour word
    let hour = -1;
    for (const [word, num] of Object.entries(hourWords)) {
      if (lowerStr.includes(word)) {
        hour = num;
        break;
      }
    }
    
    if (hour === -1) return null;
    
    // Check for AM/PM
    if (lowerStr.includes('pm') || lowerStr.includes('p m')) {
      if (hour !== 12) hour += 12;
    } else if (lowerStr.includes('am') || lowerStr.includes('a m')) {
      if (hour === 12) hour = 0;
    }
    
    return hour;
  }

  /**
   * Build event description
   * @param {Object} appointment - Appointment details
   * @returns {string} - Event description
   */
  buildEventDescription(appointment) {
    let description = `📅 Appointment scheduled by Voice Agent\n\n`;
    description += `💇 Service: ${appointment.service}\n`;
    description += `🏢 Institute: ${appointment.institute_name}\n`;
    description += `📞 Phone: ${appointment.institute_phone}\n`;
    
    if (appointment.confirmed_date && appointment.confirmed_time) {
      description += `📆 Confirmed: ${appointment.confirmed_date} at ${appointment.confirmed_time}\n`;
    } else if (appointment.preferred_date && appointment.preferred_time) {
      description += `📆 Scheduled: ${appointment.preferred_date} at ${appointment.preferred_time}\n`;
    }
    
    // Extract key information from transcript instead of showing full text
    if (appointment.call_transcript) {
      const keyInfo = this.extractKeyInfoFromTranscript(appointment.call_transcript);
      if (keyInfo) {
        description += `\n📝 Key Information:\n${keyInfo}\n`;
      }
    }
    
    return description;
  }

  /**
   * Extract key appointment information from transcript
   * @param {string} transcript - Call transcript
   * @returns {string|null} - Key information summary
   */
  extractKeyInfoFromTranscript(transcript) {
    if (!transcript) return null;
    
    const lowerTranscript = transcript.toLowerCase();
    const keyPoints = [];
    
    // Extract arrival time instructions
    const arrivalMatch = transcript.match(/(?:arrive|come)\s+(?:ten|10|\d{1,2})\s+(?:minutes?\s+)?(?:early|before|prior)/i);
    if (arrivalMatch) {
      keyPoints.push(`• Arrive ${arrivalMatch[0].replace(/arrive\s+|come\s+/i, '').replace(/minutes?/, 'min')} early`);
    }
    
    // Extract what to bring (clean, concise version)
    const bringMatch = transcript.match(/(?:bring|have|need)\s+(?:your\s+)?(id|insurance\s+card|payment|credit\s+card|cash)/i);
    if (bringMatch) {
      keyPoints.push(`• Bring: ${bringMatch[1]}`);
    }
    
    // Extract cancellation notice (simplified)
    const cancelMatch = transcript.match(/(?:cancel|cancellation).{0,30}(?:one\s+day|24\s+hour|48\s+hour|\d{1,2}\s+hour).{0,20}(?:notice|prior|before)/i);
    if (cancelMatch) {
      const notice = cancelMatch[0].match(/(?:one\s+day|24\s+hour|48\s+hour|\d{1,2}\s+hour)/i);
      if (notice) {
        keyPoints.push(`• Cancel ${notice[0]} notice required`);
      }
    }
    
    // Extract duration
    const durationMatch = transcript.match(/(?:take|last|about)\s+(\d{1,2})\s*(?:minute|min|hour)/i);
    if (durationMatch) {
      keyPoints.push(`• Duration: ~${durationMatch[1]} ${durationMatch[0].includes('hour') ? 'hour' : 'min'}`);
    }
    
    // Extract parking info (only if explicitly mentioned)
    const parkingMatch = transcript.match(/(?:parking\s+(?:is\s+)?(?:available|in\s+(?:front|back|rear)))/i);
    if (parkingMatch) {
      keyPoints.push(`• Parking: ${parkingMatch[0].replace('parking is ', '').replace('parking ', '')}`);
    }
    
    return keyPoints.length > 0 ? keyPoints.join('\n') : null;
  }

  /**
   * Delete an event from Google Calendar
   * @param {string} eventId - Google Calendar event ID
   */
  async deleteEvent(eventId) {
    if (!this.calendar) {
      logger.warn('Google Calendar not initialized. Cannot delete event.');
      return;
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
      logger.info(`Event deleted: ${eventId}`);
    } catch (error) {
      logger.error('Error deleting event:', error);
      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
