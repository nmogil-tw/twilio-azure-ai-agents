# Twilio Azure AI Agents - Conversation Relay Example

A production-ready Node.js voice server demonstrating how to integrate Twilio Conversation Relay with Microsoft Azure AI Agents for phone-based AI interactions.

The voice server provides full phone integration with your Azure AI Agent, allowing callers to interact with your AI via voice.

## Features

### Core Capabilities
- **Real-time voice conversation** - Bidirectional voice communication with streaming responses
- **Inbound calling** - Handle incoming phone calls with AI agent responses
- **DTMF input handling** - Support for keypad input (phone number collection)
- **Human agent handoff** - Seamless transfer to live agents via Twilio Flex/TaskRouter
- **Automatic reconnection** - Handles network interruptions gracefully with state persistence
- **Session management** - Maintains conversation context across the entire call

### Technical Features
- WebSocket real-time communication
- Express HTTP server with Twilio webhook endpoints
- State management with automatic cleanup
- Idle timeout handling for DTMF collection
- Comprehensive logging and error handling

## Prerequisites

1. **Twilio Account**
   - Sign up at https://www.twilio.com
   - Get your Account SID and Auth Token
   - Purchase a phone number (or use an existing one)
   - If using human agent handoff: Set up Twilio Flex and get your Workflow SID

2. **ngrok** (for local development)
   - Install from https://ngrok.com
   - Used to expose your local server to Twilio's webhooks

3. **Azure AI Agent**
   - Your agent should be configured with any tools/functions it needs
   - The server will handle tool execution automatically through Azure's SDK

## Setup for Voice Server

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in the required variables. See `.env.example` for detailed descriptions of all configuration options including:
- Azure AI credentials (PROJECT_ENDPOINT, PROJECT_ID, AGENT_ID)
- Twilio credentials (ACCOUNT_SID, AUTH_TOKEN)
- ngrok domain for local development
- Optional features (human agent handoff, conversation analytics)

### 2. Start ngrok

Open a terminal and start ngrok to expose your local server:

```bash
ngrok http 3000
```

Copy the **Forwarding** URL (without `https://`). For example:
- Full URL: `https://abc123.ngrok.app`
- Add to .env: `NGROK_DOMAIN=abc123.ngrok.app`

**Important**: Keep this terminal window open while testing!

### 3. Configure Twilio Phone Number

1. Go to the [Twilio Console](https://console.twilio.com)
2. Navigate to **Phone Numbers > Manage > Active Numbers**
3. Select a phone number (or buy a new one)
4. Under **Voice Configuration**:
   - "A call comes in": **Webhook**
   - URL: `https://your-subdomain.ngrok.app/api/incoming-call`
   - HTTP Method: **POST**
5. Click **Save configuration**

### 4. (Optional) Configure TaskRouter for Human Handoff

If your agent needs to transfer calls to live agents:

1. In Twilio Console, go to **TaskRouter > Workspaces**
2. Select your Flex workspace
3. Go to **Workflows**
4. Copy the Workflow SID (starts with `WW...`)
5. Add it to your `.env` as `TWILIO_WORKFLOW_SID`

## Running the Voice Server

Start the voice server with:

```bash
npm run dev
```

You should see output like:

```

Twilio Conversation Relay with Azure AI Agents


Server running on port: 3000
Local URL: http://localhost:3000

Webhook URLs (configure in Twilio Console):
   Incoming Call: https://abc123.ngrok.app/api/incoming-call
   Connect Action: https://abc123.ngrok.app/api/action
   WebSocket: wss://abc123.ngrok.app

Azure AI Configuration:
   Project: your_project_id
   Agent: your_agent_id

Server ready to accept connections
```

## Testing the Voice Integration

### Basic Call Flow

1. **Call your Twilio number**
2. **Hear the welcome greeting**
3. **Speak to the AI agent** - Your speech is converted to text and sent to Azure
4. **Hear the AI response** - The agent's text response is converted to speech
5. **Continue the conversation** - Full bidirectional conversation with context

### Testing DTMF Input

During a call, you can press keys on your phone keypad:

- **Phone number collection**: When the agent asks for a phone number, enter 10 digits

### Testing Human Agent Handoff

If your Azure agent calls a handoff tool/function, the server will automatically:
1. Transfer the call to Twilio TaskRouter
2. Pass conversation context and summary to the human agent
3. Enqueue the caller for the next available agent

## Conversational Intelligence (Optional)

**Optional** integration with Twilio Conversational Intelligence for AI agent observability and analytics. Automatically captures transcripts, enables post-call analysis, and provides conversation insights for quality assurance and compliance.

### Setup

1. In Twilio Console, navigate to **Conversational Intelligence > Services**
2. Create a service and copy the Service SID (starts with `GA`)
3. Add to `.env`:
   ```bash
   TWILIO_INTELLIGENCE_SERVICE_SID=GAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the server - all calls will be tracked automatically

Access data via Twilio Console or Intelligence API. May incur additional Twilio charges. [Documentation](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay/intelligence)

## Architecture

### Directory Structure

```
src/
 server.js                     # Main Express + WebSocket server
 config.js                     # Configuration management
 types/
    index.js                  # JSDoc type definitions
 controllers/
    callController.js         # Handles incoming call webhooks
    connectActionController.js # Handles call completion/handoff
    outboundCallController.js # Handles outbound call initiation
 routes/
    callRoutes.js             # /api/incoming-call endpoint
    connectActionRoutes.js    # /api/action endpoint
    outboundCallRoutes.js     # /api/outbound/* endpoints
 services/
     azureAgentService.js      # Azure AI Agents SDK wrapper
     websocketService.js       # WebSocket message handling
     stateManager.js           # Session state persistence
     dtmfHelper.js             # DTMF input state machine
     idleTimer.js              # Timeout handling
     twilioClient.js           # Twilio REST API client
```

### Message Flow

```
Caller → Twilio → Webhook → Express Server
                              ↓
                         WebSocket Connection
                              ↓
                      Azure Agent Service
                              ↓
                      Azure AI Agents SDK
                              ↓
                      Streaming Response
                              ↓
                         WebSocket → Twilio → Caller
```

### Key Components

**Azure Agent Service** (`azureAgentService.js`)
- Wraps Azure AI Agents SDK for voice integration
- Manages threads and message streaming
- Emits events for WebSocket communication
- Handles tool call detection

**WebSocket Service** (`websocketService.js`)
- Handles all WebSocket messages from Twilio
- Coordinates between Azure Agent, DTMF, and timers
- Manages session lifecycle and reconnection
- Routes messages between Twilio and Azure

**DTMF Helper** (`dtmfHelper.js`)
- State machine for keypad input
- Supports multiple input types (language, phone, DOB)
- Validates and formats collected digits

**State Manager** (`stateManager.js`)
- Persists session state for reconnection
- 30-minute state retention
- Automatic cleanup of expired sessions

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status

### Incoming Call
```
POST /api/incoming-call
```
Twilio webhook for incoming calls. Returns TwiML to establish ConversationRelay connection.

### Connect Action
```
POST /api/action
```
Twilio webhook for call completion. Handles:
- Normal call termination
- WebSocket reconnection (error 64105)
- Human agent handoff

## Troubleshooting

**ngrok/webhook errors** - Verify ngrok is running and `NGROK_DOMAIN` in `.env` matches your ngrok URL

**No audio or garbled speech** - Check Azure agent configuration and verify language codes in `src/config.js`

**Agent doesn't respond** - Verify Azure credentials (`az login`) and `AGENT_ID`. Enable `DEBUG=1` for detailed logs

**DTMF input not working** - Check idle timer timeout (default 10 seconds) and look for timeout messages in logs

**Enable debug mode** for verbose logging: `DEBUG=1 npm run dev`

## Docker Deployment

> ⚠️ **Important**: This is an example configuration. Review and customize all settings for your specific production environment, security requirements, and compliance needs before deploying to production. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guidance.

This application is Docker-ready with production-optimized containers for easy deployment to cloud platforms.

### Quick Start with Docker Compose

The fastest way to run the application with Docker:

```bash
# 1. Create your .env file
cp .env.example .env
# Edit .env with your credentials

# 2. IMPORTANT: Add Azure Service Principal credentials
# Docker containers cannot access 'az login' credentials
# Create service principal:
az ad sp create-for-rbac --name "twilio-azure-ai-agents-docker" --role Contributor

# Add the output to your .env file:
# AZURE_CLIENT_ID=<appId from output>
# AZURE_TENANT_ID=<tenant from output>
# AZURE_CLIENT_SECRET=<password from output>

# 3. Build and run with Docker Compose
npm run docker:compose:up

# Or use docker-compose directly
docker-compose up
```

The application will be available at `http://localhost:3000`.

### Docker Scripts

Convenient npm scripts are provided:

```bash
npm run docker:build           # Build the Docker image
npm run docker:run             # Run the container with .env file
npm run docker:compose:up      # Start with docker-compose
npm run docker:compose:down    # Stop docker-compose
npm run docker:compose:build   # Rebuild and start
```

### Azure Container Apps Deployment
```bash
# Build and push to ACR
az acr build --registry YOUR_REGISTRY --image twilio-azure-agent:latest .

# Deploy to Container Apps
az containerapp create \
  --name twilio-azure-agent \
  --image YOUR_REGISTRY.azurecr.io/twilio-azure-agent:latest
```

### Production Configuration

For production deployment:

1. **Set PRODUCTION_DOMAIN** instead of NGROK_DOMAIN:
   ```bash
   PRODUCTION_DOMAIN=your-app.example.com
   ```

2. **Use secrets management** (not .env files):
   - Use Azure Key Vault + Container Apps secrets for production credentials

3. **Configure SSL/TLS**: Azure Container Apps provides automatic SSL

4. **Update Twilio webhooks** to your production domain:
   ```
   https://your-app.example.com/api/incoming-call
   ```

5. **For horizontal scaling**: Use sticky sessions for WebSocket connections (see DEPLOYMENT.md)

### Comprehensive Deployment Guide

For detailed deployment instructions including:
- Platform-specific configuration templates
- Environment variable management
- SSL/TLS setup
- Monitoring and logging
- Scaling strategies
- Troubleshooting

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete guide.

### Docker Image Details

- **Base Image**: node:20-slim (Debian-based for reliable SSL/TLS)
- **Image Size**: ~200MB (optimized multi-stage build)
- **Security**: Runs as non-root user
- **Health Check**: Built-in `/health` endpoint monitoring
- **Port**: Exposes 3000 (configurable via PORT env var)

## Monitoring

The server logs:
- Active session count every minute
- All incoming calls with caller details
- WebSocket connections and disconnections
- Agent responses and tool calls
- Errors and reconnection attempts

Monitor these logs to understand usage patterns and troubleshoot issues.

## Next Steps

1. Customize the welcome greeting in `.env`
2. Configure your Azure agent with custom tools/functions
3. Customize DTMF behavior in `src/services/dtmfHelper.js`
4. Enable Conversational Intelligence for conversation analytics and AI agent observability
5. Add custom middleware or authentication
6. Integrate with your CRM or database
7. Set up production deployment
