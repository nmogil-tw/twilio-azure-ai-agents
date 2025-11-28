import twilio from 'twilio';
import { config } from '../config.js';

const { twiml } = twilio;

/**
 * Handle connect action webhook from Twilio
 * Called when ConversationRelay ends (normally or abnormally)
 * Handles human agent handoff and reconnection scenarios
 *
 * @param {Object} actionPayload - Action payload from Twilio
 * @returns {Promise<string>} TwiML response
 */
export async function handleConnectAction(actionPayload) {
  try {
    console.log(' Connect action received:');
    console.log(`   CallStatus: ${actionPayload.CallStatus}`);
    console.log(`   ErrorCode: ${actionPayload.ErrorCode || 'None'}`);

    // Handle WebSocket error 64105 (connection ended abruptly)
    // This typically indicates a network issue - attempt to reconnect
    if (
      actionPayload.CallStatus === 'in-progress' &&
      actionPayload.ErrorCode === '64105'
    ) {
      console.log(' WebSocket ended abruptly (likely network issue), attempting reconnection...');

      const ngrokDomain = config.ngrok.domain;
      const languages = config.languages;

      // Restart ConversationRelay session (reconnection)
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect action="https://${ngrokDomain}/api/action">
    <ConversationRelay
      url="wss://${ngrokDomain}"
      dtmfDetection="true"
      interruptByDtmf="false">
      <Language code="${languages.english.locale_code}" ttsProvider="${languages.english.ttsProvider}" voice="${languages.english.voice}" transcriptionProvider="${languages.english.transcriptionProvider}" speechModel="${languages.english.speechModel}" />
      <Language code="${languages.spanish.locale_code}" ttsProvider="${languages.spanish.ttsProvider}" voice="${languages.spanish.voice}" transcriptionProvider="${languages.spanish.transcriptionProvider}" speechModel="${languages.spanish.speechModel}" />
    </ConversationRelay>
  </Connect>
</Response>`;

      return twiml;
    }

    // Create TwiML response
    const voiceResponse = new twiml.VoiceResponse();

    // Check if this is a handoff to a human agent
    if (actionPayload.HandoffData) {
      console.log(' Human agent handoff requested');
      console.log(`   Handoff data: ${actionPayload.HandoffData}`);

      // Parse handoff data
      let handoffData;
      try {
        handoffData = typeof actionPayload.HandoffData === 'string'
          ? JSON.parse(actionPayload.HandoffData)
          : actionPayload.HandoffData;
      } catch (error) {
        console.error(' Error parsing handoff data:', error);
        handoffData = { reason: 'unknown', context: actionPayload.HandoffData };
      }

      // Use Twilio TaskRouter to enqueue the call for a human agent
      const workflowSid = config.twilio.workflowSid;

      if (!workflowSid) {
        console.error(' TWILIO_WORKFLOW_SID not configured');
        voiceResponse.say('I apologize, but I\'m unable to transfer you to an agent at this time. Please try again later.');
        voiceResponse.hangup();
        return voiceResponse.toString();
      }

      // Enqueue the call with handoff context
      const enqueue = voiceResponse.enqueue({
        workflowSid: workflowSid
      });

      // Add task attributes with handoff context
      enqueue.task({}, JSON.stringify({
        type: 'AI_handoff',
        reason: handoffData.reason || 'User requested',
        context: handoffData.context || '',
        summary: handoffData.summary || '',
        userInfo: handoffData.userInfo || {},
        timestamp: new Date().toISOString()
      }));

      console.log(' Call enqueued for human agent');
      return voiceResponse.toString();
    }

    // No handoff data - normal call completion
    console.log(' Call completed normally, hanging up');
    voiceResponse.hangup();
    return voiceResponse.toString();
  } catch (error) {
    console.error(' Error handling connect action:', error);

    // Return error TwiML
    const voiceResponse = new twiml.VoiceResponse();
    voiceResponse.say('An error occurred. Goodbye.');
    voiceResponse.hangup();
    return voiceResponse.toString();
  }
}

export default { handleConnectAction };
