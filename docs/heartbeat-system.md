# Heartbeat and Connection Management System

## Overview

The heartbeat and connection management system ensures that multiplayer games remain active and responsive by monitoring participant connections and handling disconnections gracefully. This system prevents games from becoming stuck when players lose connection or leave unexpectedly.

## Key Features

### Connection Tracking

- **Real-time monitoring** of WebSocket connections per participant
- **Connection status tracking** with timestamps and reconnection attempts
- **Automatic cleanup** of stale connections

### Heartbeat System

- **Bidirectional heartbeats** between server and clients
- **Configurable intervals** (30s server → client, 25s client → server)
- **Automatic timeout detection** (60s without heartbeat = disconnected)
- **Reconnection window** (2 minutes to allow reconnection)

### Disconnection Handling

- **Graceful disconnection detection** via WebSocket close events
- **Timeout-based disconnection** for unresponsive clients
- **Session viability checks** to prevent games with insufficient players
- **Automatic session termination** when games become unplayable

### Reconnection Support

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

// Heartbeat configuration (env-configurable, with these defaults)
const HEARTBEAT_INTERVAL = parseInt(process.env.KUBIC_HEARTBEAT_INTERVAL) || 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = parseInt(process.env.KUBIC_HEARTBEAT_TIMEOUT) || 60000; // 60 seconds
const RECONNECTION_WINDOW = parseInt(process.env.KUBIC_RECONNECTION_WINDOW) || 120000; // 2 minutes
```

**Key Methods:**

- `startHeartbeatForSession(sessionId)` - Start heartbeat for a session
- `stopHeartbeatForSession(sessionId)` - Stop heartbeat for a session
- `isParticipantConnected(sessionId, participantId)` - Check connection status
- `getConnectedParticipants(sessionId)` - List connected participants
- `cleanupSession(sessionId)` - Clean up session resources

Disconnection handling itself is internal to the service (driven by the heartbeat timeout and WebSocket close), not part of the public API.

#### GameSession (`game-server/session/game-session.js`)

`GameSession` composes the connection/participant managers; the public methods
below delegate to them. (Connection state lives on the connection and participant
managers under `game-server/session/`.)

```javascript
// Managed internally by the session's connection/participant managers
// participantId -> { connected, lastSeen, reconnectionAttempts }
```

**Key Methods:**

- `updateParticipantConnection(participantId, connected)` - Update connection status
- `handleParticipantDisconnection(participantId)` - Handle participant disconnection
- `handleParticipantReconnection(participantId)` - Handle participant reconnection
- `checkSessionViability()` - Check if session has enough connected players

Heartbeat for a session is managed by `GameEventService` (`startHeartbeatForSession` / `stopHeartbeatForSession`), not by `GameSession` directly.

#### SessionManager (`game-server/session-manager.js`)

```javascript
// Enhanced session management
getSessionsWithStatus() // Get all sessions with connection status
getViableSessions() // Get sessions with enough connected players
cleanupInactiveSessions(maxInactiveTime) // Clean up inactive sessions
getSessionStats() // Get connection statistics
```

### Client-Side Components

#### KubicKodeHelper (`client/kubic-kode-helper/`)

Heartbeat logic lives in `client/kubic-kode-helper/network/websocket-client.js`;
the client interval constant is in `client/kubic-kode-helper/core/constants.js`.

```javascript
// The heartbeat interval handle lives inside websocket-client.js, bound to the live socket.

// WebSocket URL, simplified. The real builder also applies a configurable path
// (helper.config.websocketPath) and omits the port and participantId segments
// when they are not set.
const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${sessionId}&participantId=${participantId}`;
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
    "totalParticipants": 2,
    "connectedParticipants": 1,
    "disconnectedParticipants": 1,
    "playableParticipants": 2,
    "requiredParticipants": 2,
    "viable": false,
    "heartbeatStarted": true
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

Server broadcasts carry the `kubic::` namespace prefix in their `type` field.

#### `kubic::connectionConfirmed`

Sent when WebSocket connection is established with participant ID.

```json
{
  "type": "kubic::connectionConfirmed",
  "payload": {
    "sessionId": "uuid",
    "participantId": 1
  }
}
```

#### `kubic::heartbeat`

Server heartbeat sent every 30 seconds.

```json
{
  "type": "kubic::heartbeat",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

#### `kubic::heartbeatResponse`

Response to client heartbeat.

```json
{
  "type": "kubic::heartbeatResponse",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

#### `kubic::participantDisconnected`

Broadcast when a participant is considered disconnected.

```json
{
  "type": "kubic::participantDisconnected",
  "payload": {
    "participantId": 1,
    "participantName": "Alice",
    "disconnectedAt": "2023-12-31T12:00:00.000Z"
  }
}
```

#### `kubic::participantReconnected`

Broadcast when a participant successfully reconnects.

```json
{
  "type": "kubic::participantReconnected",
  "payload": {
    "participantId": 1,
    "participantName": "Alice",
    "reconnectedAt": "2023-12-31T12:05:00.000Z"
  }
}
```

#### `kubic::sessionEnded`

Broadcast when session ends due to insufficient players.

```json
{
  "type": "kubic::sessionEnded",
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

Client heartbeat sent every 25 seconds. The client sends the bare type; the
server accepts both `heartbeat` and `kubic::heartbeat`.

```json
{
  "type": "heartbeat",
  "payload": {
    "timestamp": 1640995200000
  }
}
```

The heartbeat is the only client to server WebSocket message the server acts on; any other inbound message is ignored. Game actions are not sent over the socket - they go over REST (for example `POST /api/game/:sessionId/play-turn`), which is also where game-token auth is enforced. The WebSocket is used purely for server to client broadcasts (game state, participant events) and for liveness via heartbeats.

## Configuration

### Heartbeat Timing

```javascript
// Server configuration (game-server/game-event-service.js)
// Defaults shown; each is overridable via the matching env var.
const HEARTBEAT_INTERVAL = parseInt(process.env.KUBIC_HEARTBEAT_INTERVAL) || 30000; // server sends heartbeat
const HEARTBEAT_TIMEOUT = parseInt(process.env.KUBIC_HEARTBEAT_TIMEOUT) || 60000; // consider disconnected if no heartbeat
const RECONNECTION_WINDOW = parseInt(process.env.KUBIC_RECONNECTION_WINDOW) || 120000; // time to allow reconnection

// Client configuration (client/kubic-kode-helper/core/constants.js)
export const HEARTBEAT_INTERVAL = 25000; // 25 seconds - client sends heartbeat
```

### Session Cleanup

Cleanup of inactive sessions is on demand, not automatic. `sessionManager.cleanupInactiveSessions(maxInactiveTime)` removes sessions idle longer than `maxInactiveTime` (default `30 * 60 * 1000`, i.e. 30 minutes) and is invoked through the cleanup REST route; nothing runs it on a timer.

The only periodic timer is an optional session monitor, enabled with `KUBIC_SESSION_MONITOR=true` (interval `KUBIC_SESSION_MONITOR_INTERVAL`, default 60000ms). It only logs a summary of open sessions; it does not clean anything up.

## Usage Examples

### Server-Side

```javascript
// Start heartbeat for a session (also started automatically when a game starts)
GameEventService.startHeartbeatForSession(sessionId);

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

// Listen for connection events. Server-broadcast events keep the kubic:: prefix.
kubicKode.events.on("kubic::participantDisconnected", (data) => {
  console.log(`${data.participantName} disconnected`);
});

kubicKode.events.on("kubic::participantReconnected", (data) => {
  console.log(`${data.participantName} reconnected`);
});

kubicKode.events.on("kubic::sessionEnded", (data) => {
  console.log(`Session ended: ${data.message}`);
});

// Heartbeat starts automatically when WebSocket connects
kubicKode.connectWebSocket();
```

## Testing

There is currently no dedicated `heartbeat-test.js` in this repository. Connection and heartbeat behavior is exercised indirectly by the E2E tests that open WebSocket connections:

```bash
npm run test:tic-tac-toe
npm run test:lobby
```

The covered scenarios include:

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
import { kubicLog } from "./kubic-log.js";
kubicLog.setMode(true, "debug");
```

Monitor connection events:

```javascript
// Server-side
kubicLog.debug(`[GameEventService] Participant ${participantId} connected`);
kubicLog.debug(`[GameEventService] Participant ${participantId} disconnected`);

// Client-side
console.log("Heartbeat sent");
console.log("WebSocket connected");
console.log("Participant disconnected");
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
