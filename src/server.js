import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { config } from './config.js';
import { initializeWebSocketHandlers } from './services/websocketService.js';
import callRoutes from './routes/callRoutes.js';
import connectActionRoutes from './routes/connectActionRoutes.js';
import outboundCallRoutes from './routes/outboundCallRoutes.js';

// Create Express app
const app = express();
const port = config.server.port;

// Middleware
app.use(cors());
// IMPORTANT: urlencoded parser MUST come before json parser for Twilio webhooks
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'twilio-azure-conversation-relay',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', callRoutes);
app.use('/api', connectActionRoutes);
app.use('/api/outbound', outboundCallRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Twilio Conversation Relay with Azure AI Agents',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      incomingCall: 'POST /api/incoming-call',
      connectAction: 'POST /api/action',
      outboundInitiate: 'POST /api/outbound/initiate',
      outboundTwiml: 'POST /api/outbound/twiml',
      outboundStatus: 'POST /api/outbound/status',
      websocket: 'wss://' + (config.ngrok.domain || 'localhost:' + port)
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR: Server error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize WebSocket handlers
initializeWebSocketHandlers(wss);

// Start server
server.listen(port, () => {
  console.log('');
  console.log('');
  console.log('Twilio Conversation Relay with Azure AI Agents');
  console.log('');
  console.log('');
  console.log(`Server running on port: ${port}`);
  console.log(`Local URL: http://localhost:${port}`);
  console.log('');

  if (config.ngrok.domain) {
    // Determine if using production or development domain
    const isDevelopment = process.env.NGROK_DOMAIN && !process.env.PRODUCTION_DOMAIN;
    const domainType = isDevelopment ? 'ngrok (development)' : 'production';

    console.log(`Webhook URLs (${domainType}):`);
    console.log(`   Incoming Call: https://${config.ngrok.domain}/api/incoming-call`);
    console.log(`   Connect Action: https://${config.ngrok.domain}/api/action`);
    console.log(`   WebSocket: wss://${config.ngrok.domain}`);
    console.log('');
  } else {
    console.log('WARNING: No domain configured - you need to:');
    console.log('   For development:');
    console.log('     1. Run: ngrok http ' + port);
    console.log('     2. Add NGROK_DOMAIN to your .env file');
    console.log('   For production:');
    console.log('     1. Set PRODUCTION_DOMAIN to your deployed domain');
    console.log('   Then configure Twilio webhook URLs');
    console.log('');
  }

  console.log('Azure AI Configuration:');
  console.log(`   Project: ${config.azure.projectId}`);
  console.log(`   Agent: ${config.azure.agentId}`);
  console.log('');

  console.log('Twilio Configuration:');
  console.log(`   Account SID: ${config.twilio.accountSid}`);
  console.log(`   Workflow SID: ${config.twilio.workflowSid}`);
  console.log('');

  console.log('Supported Languages:');
  Object.keys(config.languages).forEach(lang => {
    const langConfig = config.languages[lang];
    console.log(`   ${lang}: ${langConfig.locale_code} (${langConfig.voice})`);
  });
  console.log('');

  console.log('Server ready to accept connections');
  console.log('');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('');
  console.log('SIGTERM received, shutting down gracefully...');

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('WARNING: Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('');
  console.log('SIGINT received, shutting down gracefully...');

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('WARNING: Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('ERROR: Unhandled Rejection:', reason);
  console.error('   Promise:', promise);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('ERROR: Uncaught Exception:', error);
  process.exit(1);
});

export { app, server, wss };
