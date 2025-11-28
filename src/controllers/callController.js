import { config } from '../config.js';

/**
 * @typedef {import('../types/index.js').CallDetails} CallDetails
 */

/**
 * Handle incoming call webhook from Twilio
 * Returns TwiML to establish ConversationRelay connection
 *
 * @param {CallDetails} callData - Call details from Twilio webhook
 * @returns {Promise<string>} TwiML response
 */
export async function handleIncomingCall(callData) {
  try {
    // Validate call data
    if (!callData) {
      throw new Error('Invalid call data received');
    }

    console.log(' Incoming call:');
    console.log(`   From: ${callData.From || callData.Caller}`);
    console.log(`   To: ${callData.To || callData.Called}`);
    console.log(`   CallSid: ${callData.CallSid}`);

    const ngrokDomain = config.ngrok.domain;
    const welcomeGreeting = config.twilio.welcomeGreeting;
    const languages = config.languages;

    // Build TwiML response with ConversationRelay
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="https://${ngrokDomain}/api/action">
    <ConversationRelay
      url="wss://${ngrokDomain}"
      dtmfDetection="true"
      interruptByDtmf="false"
      welcomeGreeting="${escapeXml(welcomeGreeting)}">
      <Language code="${languages.english.locale_code}" ttsProvider="${languages.english.ttsProvider}" voice="${languages.english.voice}" transcriptionProvider="${languages.english.transcriptionProvider}" speechModel="${languages.english.speechModel}" />
      <Language code="${languages.spanish.locale_code}" ttsProvider="${languages.spanish.ttsProvider}" voice="${languages.spanish.voice}" transcriptionProvider="${languages.spanish.transcriptionProvider}" speechModel="${languages.spanish.speechModel}" />
    </ConversationRelay>
  </Connect>
</Response>`;

    if (config.debug) {
      console.log(' TwiML response:');
      console.log(twiml);
    }

    return twiml;
  } catch (error) {
    console.error(' Error handling incoming call:', error);
    throw error;
  }
}

/**
 * Escape XML special characters for TwiML
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeXml(str) {
  if (!str) return '';

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default { handleIncomingCall };
