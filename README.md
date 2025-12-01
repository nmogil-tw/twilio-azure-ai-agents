# Twilio Azure AI Agents - Conversation Relay Example

A production-ready Node.js implementation demonstrating how to integrate Twilio Conversation Relay with Microsoft Azure AI Agents. This project includes both a **CLI tool** for testing and a **voice server** for phone-based AI interactions.

## Two Modes of Operation

1. **CLI Mode** - Interactive command-line chat for testing and development
2. **Voice Server Mode** - Full Twilio Conversation Relay integration for phone calls with voice capabilities

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in your Azure credentials:
   - Required variables:
     - `PROJECT_ENDPOINT` - Your Azure AI project endpoint (e.g., `https://your-project.services.ai.azure.com`)
     - `PROJECT_ID` - Your Azure AI project ID
     - `AGENT_ID` - Your Azure AI Agent ID
   - Optional variables:
     - `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` - Only needed if not using Azure CLI (`az login`) or other DefaultAzureCredential methods
     - `DEBUG` - Set to any value to enable verbose debug logging

3. **Authenticate with Azure:**
   - Either run `az login` to authenticate via Azure CLI (recommended for development)
   - Or set the Azure Service Principal credentials in your `.env` file

## Usage

Start the CLI with:

```sh
node context/twilio-azure-conversation-relay.js
```

The CLI provides an interactive chat interface with the following features:

- **Real-time streaming**: Agent responses stream in real-time using the Azure AI SDK
- **Thread management**: Create new conversation threads or continue existing ones
- **Metadata support**: Add custom metadata to conversation threads
- **Tool calling visibility**: See when the agent calls external functions or tools
- **Error handling**: Graceful handling of errors and connection issues

### Interactive prompts:

1. If `AGENT_ID` is not set in `.env`, you'll be prompted to enter it
2. Choose whether to create a new thread or use an existing one
3. Optionally add metadata to new threads
4. Type your messages and receive streaming responses
5. Type `exit` to quit the session

### Debug mode:

Enable detailed logging by setting the `DEBUG` environment variable:

```sh
DEBUG=1 node context/twilio-azure-conversation-relay.js
```

**Note:** For voice integration with phone calls, see the [Voice Server Mode](#voice-server-mode---twilio-conversation-relay) section below. Run with `npm run dev`.

## Features

- **SDK-based streaming**: Uses Azure AI Agents SDK for efficient real-time responses
- **Comprehensive event handling**: Tracks run states, tool calls, message creation, and errors
- **Visual feedback**: Progress indicators for agent thinking and tool execution
- **Flexible authentication**: Uses DefaultAzureCredential for secure authentication
- **Production-ready**: Error handling, input validation, and clean shutdown

---

# Voice Server Mode - Twilio Conversation Relay

The voice server provides full phone integration with your Azure AI Agent, allowing callers to interact with your AI via voice.

## Features

### Core Capabilities
- **Real-time voice conversation** - Bidirectional voice communication with streaming responses
- **Inbound & outbound calling** - Handle incoming calls and programmatically initiate outbound calls via API
- **DTMF input handling** - Support for keypad input (phone number collection, menu selections, language switching)
- **Dynamic language switching** - Support for multiple languages (English, Spanish) during calls
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
- Optional features (outbound calling, human agent handoff, conversation analytics)

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

- **Press 1**: Switch to Spanish
- **Press 2**: Switch to English
- **Phone number collection**: When the agent asks for a phone number, enter 10 digits
- **Date of birth**: When asked, enter 8 digits (MMDDYYYY)

### Testing Language Switching

Your Azure agent can request a language switch by calling a tool/function with the target language. The server will automatically send the appropriate language configuration to Twilio.

### Testing Human Agent Handoff

If your Azure agent calls a handoff tool/function, the server will automatically:
1. Transfer the call to Twilio TaskRouter
2. Pass conversation context and summary to the human agent
3. Enqueue the caller for the next available agent

## Outbound Calling

The voice server now supports **outbound calling**, allowing you to programmatically initiate phone calls to users via API. Outbound calls use the same Azure AI agent and WebSocket infrastructure as inbound calls.

### Configuration

Add your Twilio phone number to `.env` (optional, can also be provided per-call):

```bash
TWILIO_PHONE_NUMBER=+15551234567
```

### Making Outbound Calls

**Initiate a call via API:**

```bash
curl -X POST https://your-subdomain.ngrok.app/api/outbound/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+14155551212",
    "from": "+15551234567"
  }'
```

**Response:**
```json
{
  "success": true,
  "callSid": "CAxxxxxxxxxxxxxxxxxxxxx",
  "status": "queued",
  "to": "+14155551212",
  "from": "+15551234567",
  "direction": "outbound-api"
}
```

### How Outbound Calls Work

1. **API Request** - Your application calls `/api/outbound/initiate` with phone numbers
2. **Twilio Creates Call** - Twilio REST API initiates the call to the recipient
3. **TwiML Request** - When answered, Twilio requests TwiML from `/api/outbound/twiml`
4. **ConversationRelay** - TwiML establishes WebSocket connection (identical to inbound)
5. **Azure Agent** - Your AI agent handles the conversation with the same capabilities as inbound calls
6. **Status Updates** - Twilio posts status updates to `/api/outbound/status`

### Outbound Call Features

Outbound calls support **all the same features** as inbound calls:
- Real-time voice conversation with streaming responses
- DTMF input handling
- Language switching
- Human agent handoff
- Automatic reconnection
- Session state management

### Integration Example

```javascript
// Example: Trigger an outbound call from your application
async function callCustomer(customerPhone) {
  const response = await fetch('https://your-domain.ngrok.app/api/outbound/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: customerPhone,
      from: process.env.TWILIO_PHONE_NUMBER
    })
  });

  const result = await response.json();
  console.log('Call initiated:', result.callSid);
  return result;
}

// Call a customer for appointment reminder
await callCustomer('+14155551212');
```

### Use Cases

- **Appointment reminders** - Automated reminder calls before appointments
- **Order notifications** - Call customers about order status changes
- **Surveys** - Conduct automated phone surveys
- **Lead follow-up** - Reach out to new leads automatically
- **Alerts** - Notify users of important events or updates
- **Customer support** - Proactive outreach for unresolved issues

## Conversational Intelligence (Optional)

**Optional** integration with Twilio Conversational Intelligence for AI agent observability and analytics. Automatically captures transcripts, enables post-call analysis, and provides conversation insights for quality assurance and compliance.

### Setup

1. In Twilio Console, navigate to **Conversational Intelligence > Services**
2. Create a service and copy the Service SID (starts with `GA`)
3. Add to `.env`:
   ```bash
   TWILIO_INTELLIGENCE_SERVICE_SID=GAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Restart the server - all calls (inbound, outbound, reconnections) will be tracked automatically

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

### Outbound Call - Initiate
```
POST /api/outbound/initiate
```
API endpoint to programmatically initiate outbound calls.

**Request Body:**
```json
{
  "to": "+14155551212",
  "from": "+15551234567"
}
```

**Response:**
```json
{
  "success": true,
  "callSid": "CAxxxxxxxxxxxxxxxxxxxxx",
  "status": "queued",
  "to": "+14155551212",
  "from": "+15551234567",
  "direction": "outbound-api"
}
```

### Outbound Call - TwiML
```
POST /api/outbound/twiml
```
Twilio webhook for outbound calls. Returns TwiML to establish ConversationRelay connection (identical to inbound calls).

### Outbound Call - Status
```
POST /api/outbound/status
```
Twilio webhook for outbound call status updates. Receives status callbacks for call events (initiated, ringing, answered, completed).

## Troubleshooting

**ngrok/webhook errors** - Verify ngrok is running and `NGROK_DOMAIN` in `.env` matches your ngrok URL

**No audio or garbled speech** - Check Azure agent configuration and verify language codes in `src/config.js`

**Agent doesn't respond** - Verify Azure credentials (`az login`) and `AGENT_ID`. Enable `DEBUG=1` for detailed logs

**DTMF input not working** - Check idle timer timeout (default 10 seconds) and look for timeout messages in logs

**Enable debug mode** for verbose logging: `DEBUG=1 npm run dev`

## Docker Deployment

This application is Docker-ready with production-optimized containers for easy deployment to cloud platforms.

### Quick Start with Docker Compose

The fastest way to run the application with Docker:

```bash
# 1. Create your .env file
cp .env.example .env
# Edit .env with your credentials and set PRODUCTION_DOMAIN

# 2. Build and run with Docker Compose
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

### Cloud Platform Deployment

Deploy to production on major cloud platforms:

#### AWS ECS Fargate
```bash
# Build and push to ECR
docker tag twilio-azure-agent:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/twilio-azure-agent:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/twilio-azure-agent:latest

# Use the provided task definition template
# See deployment/aws-ecs-task-definition.json
```

#### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT/twilio-azure-agent
gcloud run deploy twilio-azure-agent \
  --image gcr.io/YOUR_PROJECT/twilio-azure-agent \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

#### Azure Container Apps
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
   - AWS: Secrets Manager + ECS secrets
   - GCP: Secret Manager + Cloud Run secrets
   - Azure: Key Vault + Container Apps secrets

3. **Configure SSL/TLS**: All cloud platforms provide automatic SSL

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

- **Base Image**: node:20-alpine (minimal, secure)
- **Image Size**: ~150MB (optimized multi-stage build)
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
3. Adjust language options in `src/config.js`
4. Customize DTMF behavior in `src/services/dtmfHelper.js`
5. Set up outbound calling by adding `TWILIO_PHONE_NUMBER` to `.env`
6. Integrate outbound calling API into your application for automated calls
7. Enable Conversational Intelligence for conversation analytics and AI agent observability
8. Add custom middleware or authentication
9. Integrate with your CRM or database
10. Set up production deployment
