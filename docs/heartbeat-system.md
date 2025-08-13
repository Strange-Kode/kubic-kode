# Heartbeat and Connection Management System

## Overview

The heartbeat and connection management system ensures that multiplayer games remain active and responsive by monitoring participant connections and handling disconnections gracefully. This system prevents games from becoming stuck when players lose connection or leave unexpectedly.

## Key Features

### 🔗 Connection Tracking

- **Real-time monitoring** of WebSocket connections per participant
- **Connection status tracking** with timestamps and reconnection attempts
- **Automatic cleanup** of stale connections

### 💓 Heartbeat System

- **Bidirectional heartbeats** between server and clients
- **Configurable intervals** (30s server → client, 25s client → server)
- **Automatic timeout detection** (60s without heartbeat = disconnected)
- **Reconnection window** (2 minutes to allow reconnection)

### 🚨 Disconnection Handling

- **Graceful disconnection detection** via WebSocket close events
- **Timeout-based disconnection** for unresponsive clients
- **Session viability checks** to prevent games with insufficient players
- **Automatic session termination** when games become unplayable

### 🔄 Reconnection Support

- **Seamless reconnection** for temporarily disconnected players
- **Connection state restoration** upon successful reconnection
- **Broadcast notifications** for reconnection events

## Architecture

### Server-Side Components

#### GameEventService (`game-server/game-event-service.js`)

```javascript
// Connection tracking maps
const participantConnections = new Map(); // sessionId -> Map(participantId -> ws)
const heartbeatIntervals = new Map(); // sessionId -> interval
const connectionTimeouts = new Map(); // sessionId -> Map(participantId -> timeout)

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
const RECONNECTION_WINDOW = 120000; // 2 minutes
```

**Key Methods:**

- `startHeartbeatForSession(sessionId)` - Start heartbeat for a session
- `stopHeartbeatForSession(sessionId)` - Stop heartbeat for a session
- `isParticipantConnected(sessionId, participantId)` - Check connection status
- `handleParticipantDisconnection(sessionId, participantId)` - Handle disconnections
- `cleanupSession(sessionId)` - Clean up session resources

#### GameSession (`game-server/game-session.js`)

```javascript
// Connection management properties
this._connectionStatus = new Map(); // participantId -> { connected, lastSeen, reconnectionAttempts }
this._heartbeatStarted = false;
```

**Key Methods:**

- `updateParticipantConnection(participantId, connected)` - Update connection status
- `handleParticipantDisconnection(participantId)` - Handle participant disconnection
- `handleParticipantReconnection(participantId)` - Handle participant reconnection
- `checkSessionViability()` - Check if session has enough connected players
- `startHeartbeat()` / `stopHeartbeat()` - Manage heartbeat for session

#### SessionManager (`game-server/session-manager.js`)

```javascript
// Enhanced session management
getSessionsWithStatus() // Get all sessions with connection status
getViableSessions() // Get sessions with enough connected players
cleanupInactiveSessions(maxInactiveTime) // Clean up inactive sessions
getSessionStats() // Get connection statistics
```

### Client-Side Components

#### KubicKodeHelper (`client/kubic-kode-helper.js`)

```javascript
// Heartbeat properties
this.heartbeatInterval = null;

// Enhanced WebSocket connection with participant ID
const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${this.sessionId}&participantId=${this.participantId}`;
```

**Key Methods:**

- `startHeartbeat()` - Start client-side heartbeat
- `stopHeartbeat()` - Stop client-side heartbeat
- `sendHeartbeat()` - Send heartbeat to server
- `handleHeartbeat(data)` - Handle server heartbeat
- `sendRestHeartbeat()` - Send REST heartbeat as backup

## API Endpoints

### Connection Management

#### GET `/api/session/:sessionId/status`

Get detailed connection status for a session.

**Response:**

```json
{
  "success": true,
  "session_id": "uuid",
  "status": {
    "sessionId": "uuid",
    "started": false,
    "totalParticipants": 2,
    "connectedParticipants": 1,
    "disconnectedParticipants": 1,
    "playableParticipants": 2,
    "requiredParticipants": 2,
    "viable": false
  },
  "participants": [...]
}
```

#### GET `/api/sessions/status`

Get status of all sessions with connection information.

#### GET `/api/sessions/viable`

Get sessions that have enough connected players to be viable.

#### POST `/api/session/:sessionId/heartbeat`

Send heartbeat to confirm participant is still alive.

**Request:**

```json
{
  "participantId": 1
}
```

#### POST `/api/sessions/cleanup`

Clean up inactive sessions.

**Request:**

```json
{
  "maxInactiveTime": 1800000 // 30 minutes
}
```

#### POST `/api/session/:sessionId/disconnect`

Force disconnect a participant (admin function).

**Request:**

```json
{
  "participantId": 1,
  "reason": "Admin disconnect"
}
```

## WebSocket Events

### Server → Client Events

#### `connectionConfirmed`

Sent when WebSocket connection is established with participant ID.

```json
{
  "type": "connectionConfirmed",
  "payload": {
    "sessionId": "uuid",
    "participantId": 1
  }
}
```

#### `heartbeat`

Server heartbeat sent every 30 seconds.

```json
{
  "type": "heartbeat",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

#### `heartbeatResponse`

Response to client heartbeat.

```json
{
  "type": "heartbeatResponse",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

#### `participantDisconnected`

Broadcast when a participant is considered disconnected.

```json
{
  "type": "participantDisconnected",
  "payload": {
    "participantId": 1,
    "participantName": "Alice",
    "disconnectedAt": "2023-12-31T12:00:00.000Z"
  }
}
```

#### `participantReconnected`

Broadcast when a participant successfully reconnects.

```json
{
  "type": "participantReconnected",
  "payload": {
    "participantId": 1,
    "participantName": "Alice",
    "reconnectedAt": "2023-12-31T12:05:00.000Z"
  }
}
```

#### `sessionEnded`

Broadcast when session ends due to insufficient players.

```json
{
  "type": "sessionEnded",
  "payload": {
    "reason": "insufficient_players",
    "message": "Session ended due to insufficient connected players",
    "connectedParticipants": 1,
    "requiredParticipants": 2
  }
}
```

### Client → Server Events

#### `heartbeat`

Client heartbeat sent every 25 seconds.

```json
{
  "type": "heartbeat",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

#### `gameAction`

Any game action (resets timeout).

```json
{
  "type": "gameAction",
  "payload": {
    "action": "playTurn",
    "data": {...}
  }
}
```

## Configuration

### Heartbeat Timing

```javascript
// Server configuration (game-server/game-event-service.js)
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - server sends heartbeat
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - consider disconnected if no heartbeat
const RECONNECTION_WINDOW = 120000; // 2 minutes - time to allow reconnection

// Client configuration (client/kubic-kode-helper.js)
const CLIENT_HEARTBEAT_INTERVAL = 25000; // 25 seconds - client sends heartbeat
```

### Session Cleanup

```javascript
// Default cleanup settings
const DEFAULT_INACTIVE_TIME = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

## Usage Examples

### Server-Side

```javascript
// Start heartbeat for a session
session.startHeartbeat();

// Check participant connection
if (session.isParticipantConnected(participantId)) {
  console.log("Participant is connected");
}

// Handle disconnection
session.handleParticipantDisconnection(participantId);

// Check session viability
if (!session.checkSessionViability()) {
  console.log("Session ended due to insufficient players");
}
```

### Client-Side

```javascript
// Initialize with heartbeat support
const kubicKode = new KubicKodeHelper();

// Listen for connection events
kubicKode.events.on("participantDisconnected", (data) => {
  console.log(`${data.participantName} disconnected`);
});

kubicKode.events.on("participantReconnected", (data) => {
  console.log(`${data.participantName} reconnected`);
});

kubicKode.events.on("sessionEnded", (data) => {
  console.log(`Session ended: ${data.message}`);
});

// Heartbeat starts automatically when WebSocket connects
kubicKode.connectWebSocket();
```

## Testing

Run the heartbeat system tests:

```bash
node test/heartbeat-test.js
```

The test suite covers:

- Session creation and participant management
- Connection tracking and status updates
- Heartbeat system functionality
- Disconnection handling
- Session viability checks
- Reconnection handling
- Session cleanup

## Best Practices

### Server-Side

1. **Always start heartbeat** when a game session starts
2. **Monitor session viability** after disconnection events
3. **Clean up resources** when sessions end
4. **Log connection events** for debugging
5. **Handle edge cases** like rapid connect/disconnect cycles

### Client-Side

1. **Listen for disconnection events** to inform users
2. **Implement reconnection logic** for better UX
3. **Show connection status** to users
4. **Handle session end events** gracefully
5. **Use both WebSocket and REST heartbeats** for reliability

### Configuration

1. **Adjust heartbeat intervals** based on network conditions
2. **Set appropriate timeout values** for your use case
3. **Configure cleanup intervals** based on server load
4. **Monitor connection statistics** for optimization

## Troubleshooting

### Common Issues

1. **Participants not showing as disconnected**
   - Check WebSocket close event handling
   - Verify timeout configuration
   - Ensure participant ID is passed in WebSocket URL

2. **Heartbeats not working**
   - Verify WebSocket connection includes participant ID
   - Check server heartbeat interval configuration
   - Ensure client responds to server heartbeats

3. **Sessions not ending when players disconnect**
   - Check session viability logic
   - Verify disconnection event handling
   - Ensure cleanup is called

4. **Memory leaks from inactive sessions**
   - Verify cleanup is running regularly
   - Check that sessions are properly removed
   - Monitor session statistics

### Debugging

Enable debug logging:

```javascript
// In kubic-log.js
kubicLog.setLevel("debug");
```

Monitor connection events:

```javascript
// Server-side
kubicLog.debug(`[GameEventService] Participant ${participantId} connected`);
kubicLog.debug(`[GameEventService] Participant ${participantId} disconnected`);

// Client-side
console.log("💓 Heartbeat sent");
console.log("🔌 WebSocket connected");
console.log("⚠️ Participant disconnected");
```

## Performance Considerations

1. **Heartbeat frequency** - Balance responsiveness with server load
2. **Timeout values** - Set appropriate for your network conditions
3. **Cleanup intervals** - Regular cleanup prevents memory leaks
4. **Connection pooling** - Efficient WebSocket management
5. **Event broadcasting** - Minimize unnecessary broadcasts

## Security Considerations

1. **Validate participant IDs** - Prevent unauthorized access
2. **Rate limit heartbeats** - Prevent abuse
3. **Sanitize disconnection reasons** - Prevent injection
4. **Log security events** - Monitor for suspicious activity
5. **Validate session ownership** - Ensure participants belong to sessions
