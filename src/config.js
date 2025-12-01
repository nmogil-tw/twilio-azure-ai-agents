import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validates that a required environment variable is present
 * @param {string} name - Variable name
 * @param {string} value - Variable value
 * @throws {Error} if variable is missing or empty
 */
function validateRequired(name, value) {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

/**
 * Validates Twilio Account SID format
 * @param {string} sid - Account SID
 * @returns {boolean}
 */
function isValidTwilioSid(sid) {
  return sid && sid.startsWith('AC') && sid.length === 34;
}

/**
 * Validates Twilio Workflow SID format
 * @param {string} sid - Workflow SID
 * @returns {boolean}
 */
function isValidWorkflowSid(sid) {
  return sid && sid.startsWith('WW') && sid.length === 34;
}

/**
 * Validates Twilio Intelligence Service SID format or Unique Name
 * @param {string} value - Intelligence Service SID or Unique Name
 * @returns {boolean}
 */
function isValidIntelligenceService(value) {
  if (!value) return false;
  // Valid if it's a Service SID (starts with GA, 34 chars) or a Unique Name (alphanumeric/underscore)
  const isSid = value.startsWith('GA') && value.length === 34;
  const isUniqueName = /^[a-zA-Z0-9_-]+$/.test(value);
  return isSid || isUniqueName;
}

// Validate required Azure configuration
validateRequired('PROJECT_ENDPOINT', process.env.PROJECT_ENDPOINT);
validateRequired('PROJECT_ID', process.env.PROJECT_ID);
validateRequired('AGENT_ID', process.env.AGENT_ID);

// Validate required Twilio configuration
validateRequired('TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID);
validateRequired('TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN);
validateRequired('TWILIO_WORKFLOW_SID', process.env.TWILIO_WORKFLOW_SID);
validateRequired('NGROK_DOMAIN', process.env.NGROK_DOMAIN);

// Validate Twilio SID formats
if (!isValidTwilioSid(process.env.TWILIO_ACCOUNT_SID)) {
  console.warn('WARNING: TWILIO_ACCOUNT_SID format looks incorrect (should start with AC and be 34 chars)');
}

if (!isValidWorkflowSid(process.env.TWILIO_WORKFLOW_SID)) {
  console.warn('WARNING: TWILIO_WORKFLOW_SID format looks incorrect (should start with WW and be 34 chars)');
}

// Validate optional Intelligence Service SID format
if (process.env.TWILIO_INTELLIGENCE_SERVICE_SID && !isValidIntelligenceService(process.env.TWILIO_INTELLIGENCE_SERVICE_SID)) {
  console.warn('WARNING: TWILIO_INTELLIGENCE_SERVICE_SID format looks incorrect (should start with GA and be 34 chars, or be a valid Unique Name)');
}

/**
 * Language configuration for Conversation Relay
 * @typedef {Object} LanguageOption
 * @property {string} locale_code - Language locale code (e.g., 'en-US')
 * @property {string} ttsProvider - Text-to-speech provider
 * @property {string} voice - Voice identifier
 * @property {string} transcriptionProvider - Speech-to-text provider
 * @property {string} speechModel - Speech model to use
 */

/**
 * Language options for conversation
 */
export const languageOptions = {
  english: {
    locale_code: 'en-US',
    ttsProvider: process.env.TTS_PROVIDER || 'google',
    voice: process.env.TTS_VOICE_EN || 'en-US-Journey-O',
    transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'google',
    speechModel: process.env.SPEECH_MODEL || 'telephony'
  },
  spanish: {
    locale_code: 'es-US',
    ttsProvider: process.env.TTS_PROVIDER || 'google',
    voice: process.env.TTS_VOICE_ES || 'es-US-Journey-F',
    transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER || 'google',
    speechModel: process.env.SPEECH_MODEL || 'telephony'
  }
};

/**
 * Application configuration object
 */
export const config = {
  // Azure AI Configuration
  azure: {
    projectEndpoint: process.env.PROJECT_ENDPOINT,
    projectId: process.env.PROJECT_ID,
    agentId: process.env.AGENT_ID,
    // Optional Azure credentials (if not using az login)
    clientId: process.env.AZURE_CLIENT_ID,
    tenantId: process.env.AZURE_TENANT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    workflowSid: process.env.TWILIO_WORKFLOW_SID,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER, // Optional: default phone number for outbound calls
    welcomeGreeting: process.env.WELCOME_GREETING || "Hello! I'm your AI assistant. How can I help you today?",
    intelligenceServiceSid: process.env.TWILIO_INTELLIGENCE_SERVICE_SID || null // Optional: Conversational Intelligence Service SID or Unique Name
  },

  // ngrok Configuration
  ngrok: {
    domain: process.env.NGROK_DOMAIN.replace(/^(https?:\/\/|wss?:\/\/)/, '')
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10)
  },

  // Language Options
  languages: languageOptions,

  // Debug mode
  debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true'
};

/**
 * Utility function to mask sensitive information for logging
 * @param {Object} config - Configuration object
 * @returns {Object} Masked configuration
 */
export function maskSensitiveConfig(config) {
  return {
    azure: {
      ...config.azure,
      clientSecret: config.azure.clientSecret ? '****' : undefined
    },
    twilio: {
      ...config.twilio,
      authToken: config.twilio.authToken.slice(0, 4) + '****'
    },
    ngrok: config.ngrok,
    server: config.server,
    debug: config.debug
  };
}

// Log configuration on startup (with masked sensitive values)
if (process.env.NODE_ENV !== 'production') {
  console.log('✓ Configuration loaded:');
  console.log(JSON.stringify(maskSensitiveConfig(config), null, 2));
}

// Log Conversational Intelligence status
if (config.twilio.intelligenceServiceSid) {
  console.log(`✓ Conversational Intelligence ENABLED: Service ${config.twilio.intelligenceServiceSid}`);
  console.log('  → ConversationRelay transcripts will be sent to Twilio Conversational Intelligence for analysis');
} else {
  console.log('ℹ Conversational Intelligence DISABLED (TWILIO_INTELLIGENCE_SERVICE_SID not set)');
}
