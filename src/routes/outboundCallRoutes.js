import express from 'express';
import {
  initiateOutboundCall,
  handleOutboundTwiML,
  handleStatusCallback
} from '../controllers/outboundCallController.js';

const router = express.Router();

/**
 * POST /api/outbound/initiate
 * API endpoint to initiate an outbound call
 * Request body: { "to": "+14155551212", "from": "+15551234567" }
 */
router.post('/initiate', async (req, res) => {
  try {
    console.log(' POST /api/outbound/initiate');

    const { to, from } = req.body;

    // Validate required parameters
    if (!to || !from) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'Both "to" and "from" phone numbers are required in E.164 format (e.g., +14155551212)'
      });
    }

    // Initiate the call
    const result = await initiateOutboundCall({ to, from });

    res.status(200).json(result);
  } catch (error) {
    console.error(' Error initiating outbound call:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to initiate outbound call',
      message: error.message
    });
  }
});

/**
 * POST /api/outbound/twiml
 * Webhook endpoint for outbound call TwiML
 * Returns TwiML to establish ConversationRelay connection
 */
router.post('/twiml', async (req, res) => {
  try {
    console.log(' POST /api/outbound/twiml');

    // Merge query params and body params (Twilio can send data either way)
    const callDetails = {
      ...req.query,
      ...req.body
    };

    // Get TwiML response
    const twimlResponse = await handleOutboundTwiML(callDetails);

    // Set response type to XML
    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error(' Error processing outbound TwiML:', error);

    res.status(500).json({
      error: 'Failed to process outbound TwiML',
      message: error.message
    });
  }
});

/**
 * POST /api/outbound/status
 * Webhook endpoint for call status callbacks
 * Logs call status updates from Twilio
 */
router.post('/status', async (req, res) => {
  try {
    if (req.body.CallStatus) {
      console.log(` POST /api/outbound/status (${req.body.CallStatus})`);
    }

    // Merge query params and body params
    const statusData = {
      ...req.query,
      ...req.body
    };

    // Handle status callback
    await handleStatusCallback(statusData);

    // Acknowledge receipt (no TwiML needed for status callbacks)
    res.status(200).send('OK');
  } catch (error) {
    console.error(' Error handling status callback:', error);

    res.status(500).json({
      error: 'Failed to process status callback',
      message: error.message
    });
  }
});

export default router;
