# Appointment Voice Agent

An AI-powered voice agent that schedules appointments via Telegram and phone calls. Simply send a message to the Telegram bot, and it will call the institute on your behalf to book the appointment.

## Features

- **Telegram Integration**: Natural language conversation to book appointments
- **AI Voice Calls**: Uses Bland.ai for human-like phone conversations
- **Smart Parsing**: Extracts appointment details from natural language
- **Real-time Updates**: Get notified when calls complete with confirmation details
- **Appointment Management**: View and cancel your appointments

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Telegram  │────▶│   Backend   │────▶│   Bland.ai  │────▶│   Phone     │
│    Bot      │◄────│   (Node.js) │◄────│   Voice API │◄────│   Call      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  SQLite DB  │
                    └─────────────┘
```

## Prerequisites

- Node.js 18+ 
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- A Bland.ai API Key (from [app.bland.ai](https://app.bland.ai))
- ngrok (for local webhook development)

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd appointment-voice-agent
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
BLAND_API_KEY=your_bland_api_key_here
WEBHOOK_URL=https://your-ngrok-url.ngrok.io/webhook/bland
```

### 3. Get Required API Keys

#### Telegram Bot Token
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token to your `.env` file

#### Bland.ai API Key
1. Sign up at [app.bland.ai](https://app.bland.ai)
2. Go to Settings > API Keys
3. Generate a new API key and copy it to your `.env` file

### 4. Set Up Webhooks (for local development)

Bland.ai needs a public URL to send call status webhooks. Use ngrok:

```bash
# Install ngrok if you haven't
npm install -g ngrok

# Start ngrok (in a separate terminal)
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`) and update your `.env`:

```env
WEBHOOK_URL=https://abc123.ngrok.io/webhook/bland
```

### 5. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Usage

### Booking an Appointment

Simply send a natural message to your Telegram bot:

```
Book a haircut at Salon XYZ tomorrow at 3pm, call 555-123-4567
```

Or be more flexible:

```
Schedule a dental cleaning at Smile Dental for next Tuesday afternoon, phone: 555-987-6543
```

The bot will:
1. Parse your request
2. Ask for any missing information
3. Confirm the details
4. Make the phone call
5. Notify you when complete

### Available Commands

- `/start` - Show welcome message and instructions
- `/help` - Get help and examples
- `/myappointments` - View your recent appointments
- `/cancel <appointment_id>` - Cancel an appointment

### Example Conversations

**Example 1:**
```
You: Book a table for 2 at Tony's Restaurant Friday 7pm, call 555-8888
Bot: I need to confirm the details:
     📍 Institute: Tony's Restaurant
     📞 Phone: 555-8888
     💇 Service: table
     📅 Date: Friday
     ⏰ Time: 7pm
     
     [Yes, make the call] [No, cancel] [Edit details]
```

**Example 2:**
```
You: Get me a haircut appointment
Bot: I need more details:
     - Which salon?
     - When do you want it?
     - What's their phone number?
```

## Project Structure

```
appointment-voice-agent/
├── src/
│   ├── bot/
│   │   └── telegram.js      # Telegram bot logic
│   ├── models/
│   │   └── appointment.js   # Database operations
│   ├── voice/
│   │   └── bland.js         # Bland.ai integration
│   ├── utils/
│   │   └── logger.js        # Winston logging
│   ├── server.js            # Express server & webhooks
│   └── index.js             # Application entry point
├── data/                    # SQLite database
├── logs/                    # Log files
├── .env                     # Environment variables
├── .env.example             # Example environment file
├── package.json
└── README.md
```

## API Endpoints

- `GET /health` - Health check
- `POST /webhook/bland` - Bland.ai webhook receiver
- `GET /api/appointments/:id` - Get appointment details
- `GET /api/calls/:callId` - Get Bland.ai call details

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token | Yes |
| `BLAND_API_KEY` | Your Bland.ai API key | Yes |
| `WEBHOOK_URL` | Public URL for webhooks | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `DATABASE_PATH` | SQLite database path | No |
| `LOG_LEVEL` | Logging level (info/debug/error) | No |

## Development

### Running Tests

```bash
npm test
```

### Logging

Logs are stored in:
- `logs/error.log` - Error-level logs
- `logs/combined.log` - All logs

Console output is enabled in development mode.

## Troubleshooting

### Bot not responding
- Check that `TELEGRAM_BOT_TOKEN` is correct
- Ensure the bot is started with `npm run dev`
- Check logs for errors

### Calls not being made
- Verify `BLAND_API_KEY` is valid
- Check that `WEBHOOK_URL` is publicly accessible
- Ensure ngrok is running (for local development)

### Webhooks not received
- Verify the webhook URL is correct in `.env`
- Check that the server is accessible from the internet
- Review server logs for incoming requests

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
