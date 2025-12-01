import { twilioClient, isValidE164 } from '../services/twilioClient.js';
import { config } from '../config.js';

/**
 * Initiate an outbound call using Twilio API
 * @param {Object} params - Call parameters
 * @param {string} params.to - Recipient phone number (E.164 format)
 * @param {string} params.from - Caller ID phone number (E.164 format)
 * @returns {Promise<Object>} Call details including SID and status
 */
export async function initiateOutboundCall({ to, from }) {
  try {
    // Validate phone numbers
    if (!isValidE164(to)) {
      throw new Error(`Invalid 'to' phone number. Must be E.164 format (e.g., +14155551212)`);
    }

    if (!isValidE164(from)) {
      throw new Error(`Invalid 'from' phone number. Must be E.164 format (e.g., +14155551212)`);
    }

    const ngrokDomain = config.ngrok.domain;

    console.log(' Initiating outbound call:');
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);

    // Create the call using Twilio API
    const call = await twilioClient.calls.create({
      to: to,
      from: from,
      url: `https://${ngrokDomain}/api/outbound/twiml`,
      statusCallback: `https://${ngrokDomain}/api/outbound/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    console.log(` Call created successfully:`);
    console.log(`   CallSid: ${call.sid}`);
    console.log(`   Status: ${call.status}`);

    return {
      success: true,
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from,
      direction: call.direction
    };
  } catch (error) {
    console.error(' Error initiating outbound call:', error.message);
    throw error;
  }
}

/**
 * Handle TwiML request for outbound calls
 * Returns TwiML to establish ConversationRelay connection
 * (Same as inbound calls - WebSocket infrastructure handles both)
 *
 * @param {Object} callData - Call details from Twilio
 * @returns {Promise<string>} TwiML response
 */
export async function handleOutboundTwiML(callData) {
  try {
    console.log(' Outbound call connected:');
    console.log(`   CallSid: ${callData.CallSid}`);
    console.log(`   To: ${callData.To}`);
    console.log(`   From: ${callData.From}`);

    const ngrokDomain = config.ngrok.domain;
    const welcomeGreeting = config.twilio.welcomeGreeting;
    const language = config.language;
    const intelligenceServiceSid = config.twilio.intelligenceServiceSid;

    // Build intelligenceService attribute if configured
    const intelligenceAttr = intelligenceServiceSid
      ? `intelligenceService="${intelligenceServiceSid}"`
      : '';

    // Build TwiML response with ConversationRelay
    // This is identical to inbound calls - the WebSocket handles the conversation
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="https://${ngrokDomain}/api/action">
    <ConversationRelay
      url="wss://${ngrokDomain}"
      dtmfDetection="true"
      interruptByDtmf="false"
      welcomeGreeting="${escapeXml(welcomeGreeting)}"${intelligenceAttr ? `\n      ${intelligenceAttr}` : ''}>
      <Language code="${language.locale_code}" ttsProvider="${language.ttsProvider}" voice="${language.voice}" transcriptionProvider="${language.transcriptionProvider}" speechModel="${language.speechModel}" />
    </ConversationRelay>
  </Connect>
</Response>`;

    if (intelligenceServiceSid) {
      console.log(`   → Conversational Intelligence enabled for this call (Service: ${intelligenceServiceSid})`);
    }

    if (config.debug) {
      console.log(' TwiML response:');
      console.log(twiml);
    }

    return twiml;
  } catch (error) {
    console.error(' Error handling outbound TwiML:', error);
    throw error;
  }
}

/**
 * Handle status callback from Twilio
 * Logs call status updates for monitoring
 *
 * @param {Object} statusData - Status callback data from Twilio
 */
export async function handleStatusCallback(statusData) {
  try {
    const { CallSid, CallStatus, From, To, Direction, Duration } = statusData;

    console.log(' Call status update:');
    console.log(`   CallSid: ${CallSid}`);
    console.log(`   Status: ${CallStatus}`);
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Direction: ${Direction}`);

    if (Duration) {
      console.log(`   Duration: ${Duration}s`);
    }

    // Optional: Add database logging here in the future
    // await saveCallStatus({ CallSid, CallStatus, Duration, ... });

    return { success: true };
  } catch (error) {
    console.error(' Error handling status callback:', error);
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

export default {
  initiateOutboundCall,
  handleOutboundTwiML,
  handleStatusCallback
};
