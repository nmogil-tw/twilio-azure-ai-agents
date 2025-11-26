import express from 'express';
import { handleConnectAction } from '../controllers/connectActionController.js';

const router = express.Router();

/**
 * POST /api/action
 * Webhook endpoint for ConversationRelay connect action
 * Called when ConversationRelay ends (normally or abnormally)
 * Handles agent handoff and reconnection scenarios
 */
router.post('/action', async (req, res) => {
  try {
    console.log(' POST /api/action');

    // Get action payload from request body
    const actionPayload = req.body;

    // Handle the connect action and get TwiML response
    const twimlResponse = await handleConnectAction(actionPayload);

    // Set response type to XML
    res.type('text/xml');
    res.status(200).send(twimlResponse);
  } catch (error) {
    console.error(' Error processing connect action:', error);

    res.status(500).json({
      error: 'Failed to process connect action',
      message: error.message
    });
  }
});

export default router;
