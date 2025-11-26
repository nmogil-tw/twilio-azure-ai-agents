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
node twilio-azure-conversation-relay.js
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
DEBUG=1 node twilio-azure-conversation-relay.js
```

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

Copy `.env.example` to `.env` and fill in the required variables:

```bash
# Azure AI Configuration (already set up for CLI)
PROJECT_ENDPOINT=https://your-project.services.ai.azure.com
PROJECT_ID=your_project_id
AGENT_ID=your_agent_id

# Twilio Configuration (new for voice server)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WORKFLOW_SID=WWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NGROK_DOMAIN=your-subdomain.ngrok.app
WELCOME_GREETING="Hello! I'm your AI assistant. How can I help you today?"

# Server Configuration
PORT=3000
DEBUG=1
```

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
 routes/
    callRoutes.js             # /api/incoming-call endpoint
    connectActionRoutes.js    # /api/action endpoint
 services/
     azureAgentService.js      # Azure AI Agents SDK wrapper
     websocketService.js       # WebSocket message handling
     stateManager.js           # Session state persistence
     dtmfHelper.js             # DTMF input state machine
     idleTimer.js              # Timeout handling
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

### Common Issues

**1. "Missing required environment variable"**
- Ensure all required variables are set in `.env`
- Check for typos in variable names

**2. "Connection refused" or webhook errors**
- Verify ngrok is running
- Check that `NGROK_DOMAIN` matches your ngrok URL
- Ensure Twilio webhook URL is correct

**3. No audio or garbled speech**
- Check your Azure agent configuration
- Verify language codes in `config.js` match your needs
- Test with different TTS providers if needed

**4. Agent doesn't respond**
- Check Azure credentials are valid (`az login`)
- Verify `AGENT_ID` is correct
- Enable `DEBUG=1` to see detailed logs

**5. DTMF input not working**
- Ensure `dtmfDetection="true"` in TwiML
- Check idle timer timeout (default 10 seconds)
- Look for timeout messages in logs

### Debug Mode

Enable verbose logging:

```bash
DEBUG=1 npm run dev
```

This will show:
- All WebSocket messages
- Azure AI SDK events
- DTMF state transitions
- Tool call details
- Session management events

## Production Deployment

For production deployment:

1. **Use a permanent domain** instead of ngrok
2. **Enable HTTPS** with valid SSL certificates
3. **Set up monitoring** and error alerting
4. **Configure environment variables** securely (not in `.env` files)
5. **Use process manager** (PM2, Docker, or cloud platform)
6. **Scale horizontally** with load balancer and session affinity
7. **Implement rate limiting** and request validation
8. **Add authentication** to webhook endpoints
9. **Set up logging** to external service (CloudWatch, Application Insights)
10. **Consider Redis** for distributed state management

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
5. Add custom middleware or authentication
6. Integrate with your CRM or database
7. Set up production deployment

## Running Both Modes

- **CLI Mode**: `npm start` (test your agent via command line)
- **Voice Server**: `npm run dev` (handle phone calls)

Both modes use the same Azure AI agent and configuration!
