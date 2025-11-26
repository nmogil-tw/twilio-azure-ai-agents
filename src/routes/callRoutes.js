import express from 'express';
import { handleIncomingCall } from '../controllers/callController.js';

const router = express.Router();

/**
 * POST /api/incoming-call
 * Webhook endpoint for incoming Twilio calls
 * Returns TwiML to establish ConversationRelay connection
 */
router.post('/incoming-call', async (req, res) => {
  try {
    console.log(' POST /api/incoming-call');

    // Merge query params and body params (Twilio can send data either way)
    const callDetails = {
      ...req.query,
      ...req.body
    };

    // Handle the incoming call and get TwiML response
    const twimlResponse = await handleIncomingCall(callDetails);

    // Set response type to XML
    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error(' Error processing incoming call:', error);

    res.status(500).json({
      error: 'Failed to process incoming call',
      message: error.message
    });
  }
});

export default router;
