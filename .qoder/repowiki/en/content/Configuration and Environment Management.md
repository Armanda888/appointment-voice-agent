# Configuration and Environment Management

<cite>
**Referenced Files in This Document**
- [src/index.js](file://src/index.js)
- [src/server.js](file://src/server.js)
- [src/bot/telegram.js](file://src/bot/telegram.js)
- [src/voice/bland.js](file://src/voice/bland.js)
- [src/utils/logger.js](file://src/utils/logger.js)
- [src/models/appointment.js](file://src/models/appointment.js)
- [package.json](file://package.json)
- [README.md](file://README.md)
- [.gitignore](file://.gitignore)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive documentation for the three required environment variables: TELEGRAM_BOT_TOKEN, BLAND_API_KEY, and WEBHOOK_URL
- Updated validation section to reflect the new environment variable requirements
- Enhanced troubleshooting guide with specific guidance for the three required variables
- Added detailed deployment scenarios covering all three required variables
- Updated architecture diagrams to show the relationship between environment variables and application components

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive guidance for configuration and environment management in the Appointment Voice Agent. It covers all environment variables, their roles, validation mechanisms, security considerations, and best practices for deploying the system across different environments. The system now requires three critical environment variables: TELEGRAM_BOT_TOKEN for Telegram bot authentication, BLAND_API_KEY for Bland.ai voice service access, and WEBHOOK_URL for webhook delivery. These variables form the foundation of the application's external integrations and must be properly configured for the system to function correctly.

## Project Structure
The application is structured around four primary runtime concerns with enhanced environment variable management:
- Entry point validates required environment variables before initialization
- Express server exposes endpoints and manages webhooks with proper validation
- Telegram bot integrates with Telegram APIs using a configured token
- Voice service integrates with Bland.ai using an API key and webhook URL
- Logger reads log level from environment and writes to files/console
- SQLite database path is configurable via environment variable

```mermaid
graph TB
A["src/index.js<br/>Entry point with validation"] --> B["src/server.js<br/>Express server with webhook handling"]
A --> C["src/bot/telegram.js<br/>Telegram bot with token validation"]
A --> D["src/models/appointment.js<br/>SQLite database with path config"]
B --> E["src/voice/bland.js<br/>Bland.ai service with API key validation"]
B --> F["src/utils/logger.js<br/>Logging with level config"]
C --> F
E --> F
D --> F
```

**Diagram sources**
- [src/index.js:1-91](file://src/index.js#L1-L91)
- [src/server.js:1-266](file://src/server.js#L1-L266)
- [src/bot/telegram.js:1-461](file://src/bot/telegram.js#L1-L461)
- [src/voice/bland.js:1-272](file://src/voice/bland.js#L1-L272)
- [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)
- [src/models/appointment.js:1-238](file://src/models/appointment.js#L1-L238)

**Section sources**
- [src/index.js:1-91](file://src/index.js#L1-L91)
- [src/server.js:1-266](file://src/server.js#L1-L266)
- [src/bot/telegram.js:1-461](file://src/bot/telegram.js#L1-L461)
- [src/voice/bland.js:1-272](file://src/voice/bland.js#L1-L272)
- [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)
- [src/models/appointment.js:1-238](file://src/models/appointment.js#L1-L238)
- [package.json:1-35](file://package.json#L1-L35)
- [README.md:154-175](file://README.md#L154-L175)

## Core Components
This section documents each environment variable, its purpose, and how it affects application behavior.

### Required Environment Variables

**TELEGRAM_BOT_TOKEN**
- Purpose: Authenticates the Telegram bot client and enables communication with Telegram's Bot API
- Usage locations:
  - Telegram bot initialization constructs the Telegraf client with this token
  - Required for all Telegram bot functionality including message handling and user interactions
- Impact: Without a valid token, the Telegram bot cannot connect to Telegram APIs and users cannot interact with the bot
- Security: Treat as a secret credential; never commit to version control
- Validation: Entry point performs early validation to ensure this required variable is present

**BLAND_API_KEY**
- Purpose: Authenticates requests to the Bland.ai voice service API for making automated phone calls
- Usage locations:
  - Bland voice service constructor uses this key to initialize the client
  - Used when creating calls and retrieving call details from Bland.ai
  - Required for all voice call functionality
- Impact: Invalid or missing key prevents voice calls and webhook processing from Bland.ai
- Security: Treat as a secret credential; never commit to version control
- Validation: Entry point validates this required variable during startup

**WEBHOOK_URL**
- Purpose: Public URL where Bland.ai sends call status webhooks and where the Express server receives them
- Usage locations:
  - Bland voice service stores this URL and passes it to Bland.ai when creating calls
  - Express server exposes a webhook endpoint (`/webhook/bland`) to receive and process these events
  - Must be publicly accessible for Bland.ai to deliver webhook notifications
- Impact: Incorrect or unreachable URL causes missed call status updates and prevents proper call lifecycle management
- Security: Ensure the URL is HTTPS and only accessible to Bland.ai; avoid exposing internal network details
- Validation: Entry point validates this required variable during startup

### Optional Environment Variables

**PORT**
- Purpose: TCP port on which the Express server listens for incoming connections
- Usage locations:
  - Server class reads this environment variable to configure the listening port
- Impact: If unset, defaults to 3000
- Best practice: Bind to a non-root privileged port in production; ensure firewall allows inbound connections

**NODE_ENV**
- Purpose: Controls environment mode and error reporting behavior
- Usage locations:
  - Express error handler conditionally includes error messages in development mode
  - Logger adds console transport when not in production
- Impact: Development mode enables verbose error messages and console logging; production mode suppresses sensitive details

**DATABASE_PATH**
- Purpose: Path to the SQLite database file for storing appointment data
- Usage locations:
  - Appointment model resolves this path for database initialization
- Impact: If unset, defaults to a path under the data directory
- Best practice: Use absolute paths in production; ensure write permissions for the application user

**LOG_LEVEL**
- Purpose: Controls logging verbosity and output levels
- Usage locations:
  - Logger configuration reads this environment variable to set the minimum log level
- Impact: Lower levels increase log volume; higher levels reduce noise
- Best practice: Use info in production; debug for development troubleshooting

**Section sources**
- [src/index.js:12-20](file://src/index.js#L12-L20)
- [src/bot/telegram.js:8](file://src/bot/telegram.js#L8)
- [src/voice/bland.js:5-6](file://src/voice/bland.js#L5-L6)
- [src/server.js:10](file://src/server.js#L10)
- [src/server.js:44](file://src/server.js#L44)
- [src/utils/logger.js:4](file://src/utils/logger.js#L4)
- [src/models/appointment.js:5](file://src/models/appointment.js#L5)

## Architecture Overview
The configuration system centers on environment variables consumed by multiple subsystems. The entry point performs comprehensive validation of required variables before initializing any subsystems, while other modules read configuration passively. The server exposes endpoints for health checks and Bland.ai webhooks, and the Telegram bot and voice service rely on tokens and URLs respectively.

```mermaid
graph TB
subgraph "Required Environment Variables"
TV["TELEGRAM_BOT_TOKEN<br/>Telegram Authentication"]
BV["BLAND_API_KEY<br/>Voice Service Access"]
WV["WEBHOOK_URL<br/>Webhook Delivery"]
end
subgraph "Optional Environment Variables"
PV["PORT<br/>Server Port"]
NV["NODE_ENV<br/>Environment Mode"]
DV["DATABASE_PATH<br/>Database Location"]
LV["LOG_LEVEL<br/>Logging Verbosity"]
end
subgraph "Application Modules"
IDX["src/index.js<br/>Startup & Validation"]
SRV["src/server.js<br/>Express Server"]
BOT["src/bot/telegram.js<br/>Telegram Bot"]
BLND["src/voice/bland.js<br/>Bland.ai Service"]
LOG["src/utils/logger.js<br/>Logging"]
DB["src/models/appointment.js<br/>Database"]
end
TV --> BOT
BV --> BLND
WV --> BLND
WV --> SRV
PV --> SRV
NV --> SRV
NV --> LOG
DV --> DB
LV --> LOG
IDX --> SRV
IDX --> BOT
IDX --> DB
SRV --> BLND
SRV --> LOG
BOT --> LOG
BLND --> LOG
DB --> LOG
```

**Diagram sources**
- [src/index.js:12-20](file://src/index.js#L12-L20)
- [src/server.js:10](file://src/server.js#L10)
- [src/server.js:44](file://src/server.js#L44)
- [src/bot/telegram.js:8](file://src/bot/telegram.js#L8)
- [src/voice/bland.js:5-6](file://src/voice/bland.js#L5-L6)
- [src/utils/logger.js:4](file://src/utils/logger.js#L4)
- [src/models/appointment.js:5](file://src/models/appointment.js#L5)

## Detailed Component Analysis

### Environment Validation and Startup
The entry point performs comprehensive validation of required environment variables before initializing any subsystems. It validates TELEGRAM_BOT_TOKEN, BLAND_API_KEY, and WEBHOOK_URL, and logs startup progress while setting up graceful shutdown handlers.

```mermaid
sequenceDiagram
participant Proc as "Process"
participant Entry as "src/index.js"
participant Logger as "src/utils/logger.js"
participant Model as "src/models/appointment.js"
participant Server as "src/server.js"
participant Bot as "src/bot/telegram.js"
Proc->>Entry : "Load dotenv"
Entry->>Entry : "Validate required env vars : <br/>TELEGRAM_BOT_TOKEN,<br/>BLAND_API_KEY,<br/>WEBHOOK_URL"
alt "Missing required vars"
Entry->>Logger : "Log error and exit"
Entry->>Proc : "Exit with code 1"
else "All present"
Entry->>Model : "init()"
Model-->>Entry : "Database ready"
Entry->>Server : "start()"
Server-->>Entry : "Server listening"
Entry->>Bot : "start()"
Bot-->>Entry : "Bot active"
Entry->>Logger : "Log success"
end
```

**Diagram sources**
- [src/index.js:12-20](file://src/index.js#L12-L20)
- [src/index.js:22-36](file://src/index.js#L22-L36)
- [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)
- [src/models/appointment.js:12-24](file://src/models/appointment.js#L12-L24)
- [src/server.js:242-249](file://src/server.js#L242-L249)
- [src/bot/telegram.js:449-457](file://src/bot/telegram.js#L449-L457)

**Section sources**
- [src/index.js:1-91](file://src/index.js#L1-L91)

### Express Server Configuration and Webhooks
The server reads the port from environment variables and exposes endpoints for health checks and Bland.ai webhooks. It validates webhook requests and routes webhook payloads to the voice service for processing.

```mermaid
flowchart TD
Start(["Server start"]) --> ReadPort["Read PORT from env"]
ReadPort --> SetupMW["Setup middleware and routes"]
SetupMW --> ExposeHealth["Expose /health endpoint"]
SetupMW --> ExposeWebhook["Expose /webhook/bland endpoint"]
ExposeWebhook --> ReceiveReq["Receive webhook POST"]
ReceiveReq --> Ack["Send immediate 200 ack"]
Ack --> ProcessAsync["Process webhook asynchronously"]
ProcessAsync --> ValidateEvent["Validate webhook data"]
ValidateEvent --> LookupApt["Lookup appointment by ID"]
LookupApt --> HandleStatus{"Status?"}
HandleStatus --> |completed/finished| Completed["handleCallCompleted"]
HandleStatus --> |failed/error| Failed["handleCallFailed"]
HandleStatus --> |in_progress| InProgress["handleCallInProgress"]
HandleStatus --> |other| Unhandled["Log unhandled status"]
```

**Diagram sources**
- [src/server.js:10](file://src/server.js#L10)
- [src/server.js:34-75](file://src/server.js#L34-L75)
- [src/server.js:77-123](file://src/server.js#L77-L123)
- [src/server.js:125-229](file://src/server.js#L125-L229)

**Section sources**
- [src/server.js:1-266](file://src/server.js#L1-L266)

### Telegram Bot Configuration
The Telegram bot uses the configured token to initialize the Telegraf client. It registers commands and handlers, and logs errors encountered during operation.

```mermaid
classDiagram
class TelegramBot {
+constructor()
+setupHandlers()
+handleStart(ctx)
+handleHelp(ctx)
+handleMyAppointments(ctx)
+handleCancel(ctx)
+handleTextMessage(ctx)
+parseAppointmentRequest(ctx,text)
+showConfirmation(ctx,session)
+initiateCall(ctx,session)
+notifyUser(chatId,message)
+notifyCallComplete(chatId,appointment,callDetails)
+start()
+stop()
}
```

**Diagram sources**
- [src/bot/telegram.js:6-461](file://src/bot/telegram.js#L6-L461)

**Section sources**
- [src/bot/telegram.js:1-461](file://src/bot/telegram.js#L1-L461)

### Bland.ai Voice Service Configuration
The voice service uses the API key and webhook URL to create calls and handle webhook events. It extracts appointment details from transcripts and ends calls when necessary.

```mermaid
sequenceDiagram
participant Bot as "TelegramBot"
participant Model as "AppointmentModel"
participant Voice as "BlandVoiceService"
participant Bland as "Bland.ai API"
participant Server as "Express Server"
Bot->>Model : "create(appointment)"
Model-->>Bot : "appointmentId"
Bot->>Model : "updateStatus(appointmentId,'calling')"
Bot->>Voice : "createCall(appointment)"
Voice->>Bland : "POST calls with webhook URL"
Bland-->>Voice : "call_id"
Voice-->>Bot : "call_id"
Bot->>Model : "updateStatus(appointmentId,'calling', {call_id})"
Note over Server,Bland : "Bland posts webhook to /webhook/bland"
Server->>Voice : "handleWebhook(payload)"
Voice-->>Server : "parsed event"
Server->>Model : "updateStatus(..., {call_transcript, notes})"
Server->>Bot : "notifyUser(...) with completion"
```

**Diagram sources**
- [src/bot/telegram.js:373-405](file://src/bot/telegram.js#L373-L405)
- [src/voice/bland.js:23-64](file://src/voice/bland.js#L23-L64)
- [src/voice/bland.js:148-174](file://src/voice/bland.js#L148-L174)
- [src/server.js:77-123](file://src/server.js#L77-L123)

**Section sources**
- [src/voice/bland.js:1-272](file://src/voice/bland.js#L1-L272)

### Database Configuration
The appointment model resolves the database path from environment variables and creates the required table on initialization.

```mermaid
flowchart TD
Init(["AppointmentModel.init()"]) --> ResolvePath["Resolve DATABASE_PATH"]
ResolvePath --> OpenDB["Open SQLite database"]
OpenDB --> CreateTable["CREATE TABLE IF NOT EXISTS appointments"]
CreateTable --> Ready["Model ready"]
```

**Diagram sources**
- [src/models/appointment.js:5](file://src/models/appointment.js#L5)
- [src/models/appointment.js:12-60](file://src/models/appointment.js#L12-L60)

**Section sources**
- [src/models/appointment.js:1-238](file://src/models/appointment.js#L1-L238)

### Logging Configuration
The logger reads the log level from environment variables and configures transports for file and console output depending on the environment mode.

```mermaid
flowchart TD
Load(["Logger module load"]) --> ReadLevel["Read LOG_LEVEL from env"]
ReadLevel --> SetupFile["Setup file transports (error.log, combined.log)"]
SetupFile --> CheckEnv{"NODE_ENV == production?"}
CheckEnv --> |No| AddConsole["Add console transport with colors"]
CheckEnv --> |Yes| SkipConsole["Skip console transport"]
AddConsole --> Ready["Logger ready"]
SkipConsole --> Ready
```

**Diagram sources**
- [src/utils/logger.js:4](file://src/utils/logger.js#L4)
- [src/utils/logger.js:18-25](file://src/utils/logger.js#L18-L25)

**Section sources**
- [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)

## Dependency Analysis
The following diagram shows how environment variables flow through the system and which modules depend on them.

```mermaid
graph LR
subgraph "Required Variables"
T["TELEGRAM_BOT_TOKEN"] --> BOT["TelegramBot"]
B["BLAND_API_KEY"] --> VOICE["BlandVoiceService"]
W["WEBHOOK_URL"] --> VOICE
W --> SRV["Express Server"]
end
subgraph "Optional Variables"
P["PORT"] --> SRV
N["NODE_ENV"] --> SRV
N --> LOG["Logger"]
D["DATABASE_PATH"] --> DB["AppointmentModel"]
L["LOG_LEVEL"] --> LOG
end
```

**Diagram sources**
- [src/bot/telegram.js:8](file://src/bot/telegram.js#L8)
- [src/voice/bland.js:5-6](file://src/voice/bland.js#L5-L6)
- [src/server.js:10](file://src/server.js#L10)
- [src/server.js:44](file://src/server.js#L44)
- [src/utils/logger.js:4](file://src/utils/logger.js#L4)
- [src/models/appointment.js:5](file://src/models/appointment.js#L5)

**Section sources**
- [src/index.js:12-20](file://src/index.js#L12-L20)
- [src/server.js:1-266](file://src/server.js#L1-L266)
- [src/bot/telegram.js:1-461](file://src/bot/telegram.js#L1-L461)
- [src/voice/bland.js:1-272](file://src/voice/bland.js#L1-L272)
- [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)
- [src/models/appointment.js:1-238](file://src/models/appointment.js#L1-L238)

## Performance Considerations
- Port binding: Ensure the chosen port is available and firewalled appropriately. Avoid binding to low-numbered ports in production without proper privilege separation.
- Logging overhead: Higher log levels increase disk I/O. Use appropriate levels per environment.
- Database path: Using a mounted persistent volume for the database path improves reliability and performance in containerized deployments.
- Webhook URL stability: Use a reliable reverse proxy or cloud platform to expose the webhook endpoint securely and with minimal latency.
- Environment variable validation: Early validation prevents wasted resources on failed startups and ensures all required services are available before initialization.

## Troubleshooting Guide
Common configuration issues and resolutions:

### Required Environment Variables Issues

**Missing Required Environment Variables**
- Symptom: Application exits immediately after startup with an error indicating missing variables
- Resolution: Ensure TELEGRAM_BOT_TOKEN, BLAND_API_KEY, and WEBHOOK_URL are set in the environment
- Prevention: Use a proper environment management system and validate variables before deployment
- Reference: [src/index.js:12-20](file://src/index.js#L12-L20)

**Telegram Bot Not Responding**
- Symptom: Users cannot interact with the bot
- Possible causes:
  - Invalid TELEGRAM_BOT_TOKEN
  - Bot not started or crashed
  - Network connectivity issues
- Resolution: Verify the token is correct and the application is running; check logs for errors; ensure the bot has proper network access
- Reference: [src/bot/telegram.js:8](file://src/bot/telegram.js#L8), [src/utils/logger.js:1-28](file://src/utils/logger.js#L1-L28)

**Calls Not Being Made or Webhooks Not Received**
- Symptom: No call initiation or webhook notifications
- Possible causes:
  - Invalid BLAND_API_KEY
  - WEBHOOK_URL is incorrect or unreachable
  - Local development requires a tunnel (e.g., ngrok) for webhook delivery
  - Firewall blocking webhook traffic
- Resolution: Validate API key, ensure webhook URL is publicly accessible, confirm the server is reachable from the internet, check firewall rules
- Reference: [src/voice/bland.js:5-6](file://src/voice/bland.js#L5-L6), [src/server.js:44](file://src/server.js#L44)

### Additional Configuration Issues

**Port Conflicts or Accessibility Issues**
- Symptom: Server fails to start or cannot accept incoming webhooks
- Resolution: Change PORT to an available port and ensure network/firewall allows inbound connections
- Reference: [src/server.js:10](file://src/server.js#L10)

**Database Connectivity Problems**
- Symptom: Errors when initializing or querying the database
- Resolution: Verify DATABASE_PATH is writable and accessible; ensure the path exists or is creatable by the application user
- Reference: [src/models/appointment.js:5](file://src/models/appointment.js#L5), [src/models/appointment.js:12-24](file://src/models/appointment.js#L12-L24)

**Excessive or Insufficient Logging**
- Symptom: Too much or too little log output
- Resolution: Adjust LOG_LEVEL to control verbosity; NODE_ENV controls console transport in development vs production
- Reference: [src/utils/logger.js:4](file://src/utils/logger.js#L4), [src/utils/logger.js:18-25](file://src/utils/logger.js#L18-L25)

**Section sources**
- [src/index.js:12-20](file://src/index.js#L12-L20)
- [src/bot/telegram.js:8](file://src/bot/telegram.js#L8)
- [src/voice/bland.js:5-6](file://src/voice/bland.js#L5-L6)
- [src/server.js:10](file://src/server.js#L10)
- [src/server.js:44](file://src/server.js#L44)
- [src/models/appointment.js:5](file://src/models/appointment.js#L5)
- [src/models/appointment.js:12-24](file://src/models/appointment.js#L12-L24)
- [src/utils/logger.js:4](file://src/utils/logger.js#L4)
- [src/utils/logger.js:18-25](file://src/utils/logger.js#L18-L25)

## Conclusion
Proper configuration and environment management are critical for the Appointment Voice Agent's reliability and security. The system now requires three essential environment variables: TELEGRAM_BOT_TOKEN for Telegram bot authentication, BLAND_API_KEY for Bland.ai API access, and WEBHOOK_URL for webhook delivery. This guide outlined how each environment variable influences behavior, validated the startup process with comprehensive environment variable checking, and provided practical troubleshooting steps. By following the best practices described here—especially around secret handling, webhook exposure, and logging—you can deploy the system confidently across development, staging, and production environments.

## Appendices

### Environment Variables Reference

**Required Variables**
- `TELEGRAM_BOT_TOKEN`: Required for Telegram bot authentication and all Telegram API interactions
- `BLAND_API_KEY`: Required for Bland.ai API access and voice call functionality
- `WEBHOOK_URL`: Required for Bland.ai webhook delivery and call status notifications

**Optional Variables**
- `PORT`: Optional; defaults to 3000 if unset
- `NODE_ENV`: Optional; controls error reporting and console logging behavior
- `DATABASE_PATH`: Optional; defaults to a path under the data directory
- `LOG_LEVEL`: Optional; controls logging verbosity

**Section sources**
- [README.md:184-195](file://README.md#L184-L195)

### Secret Handling Best Practices

**Critical Security Guidelines**
- Never commit .env files to version control; they are already ignored by the repository configuration
- Use a secrets manager or environment-specific configuration management in production
- Rotate API keys regularly and revoke compromised tokens promptly
- Restrict webhook URL exposure to trusted endpoints only
- Use HTTPS for all webhook URLs in production environments
- Implement proper access controls for environment variable management systems

**Section sources**
- [.gitignore:9-12](file://.gitignore#L9-L12)

### Deployment Scenarios

**Local Development**
- Use development scripts and environment variables loaded via dotenv
- Expose the webhook URL using a tunnel (e.g., ngrok) for testing
- Keep NODE_ENV unset or set to development to enable console logging and verbose error messages
- Ensure all three required variables are properly configured locally

**Staging**
- Use a dedicated staging environment with its own secrets
- Ensure WEBHOOK_URL points to a staging endpoint and is reachable from Bland.ai
- Set NODE_ENV to production to suppress sensitive error details
- Test all three required variables thoroughly before promotion to production

**Production**
- Use a managed secrets store to inject environment variables at runtime
- Bind to a non-root privileged port and secure network access
- Persist the database path on durable storage and monitor logs
- Implement monitoring for webhook delivery and API key validation
- Regularly audit environment variable configurations and access logs

**Section sources**
- [README.md:72-88](file://README.md#L72-L88)
- [src/server.js:10](file://src/server.js#L10)
- [src/utils/logger.js:18-25](file://src/utils/logger.js#L18-L25)