import express from 'express';
import { sessionManager } from './session-manager.js';  // Holds all active GameSession instances

const sessionRouter = express.Router();

// Creates and secures a singleton session for simplicity.
sessionRouter.get('/session/init', (req, res) => {
    let sessionState, session_created;
    if (sessionManager.hasSessions()) {
        sessionState = sessionManager.getSessions()[0];
        session_created = false;
    }
    else {
        sessionState = sessionManager.createSession();
        session_created = true;
    }
    console.log(`session-routes.js::session created: ${session_created}`);
    console.log(`session-routes.js::session id: ${sessionState.sessionId}`);
    res.json({
        session_id: sessionState.sessionId,
        session_created: session_created
    });
});

// Join session
sessionRouter.post('/session/:sessionId/join', (req, res) => {
    const { sessionId } = req.params;
    const { participantId, participantName } = req.body;

    const session = sessionManager.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
    }

    try {
        const entity = sessionManager.createGameEntityForParticipant(sessionId, participantId);
        session.addParticipant(participantId, participantName, entity);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Leave session
sessionRouter.post('/session/:sessionId/leave', (req, res) => {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    const session = sessionManager.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
    }

    try {
        session.removeParticipant(participantId);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// List participants
sessionRouter.get('/session/:sessionId/participants', (req, res) => {
    const { sessionId } = req.params;

    const session = sessionManager.getSession(sessionId);

    if (!session) {
        return res.status(404).json({ error: 'Session not found.' });
    }

    res.json(session.listParticipants());
});

// Test session routes
sessionRouter.get('/session/test', (req, res) => {
    res.json({
        status: 'it works'
    });
});

export default sessionRouter;
