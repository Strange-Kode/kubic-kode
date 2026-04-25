# Connection Getsessionstatus

> 38 nodes · cohesion 0.07

## Key Concepts

- **SessionConnectionManager** (14 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **InactivityManager** (13 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.getParticipants()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.markStarted()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.markEnded()** (8 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **._onTimeout()** (7 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.startTimer()** (6 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.clearTimer()** (5 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.getSessionStatus()** (5 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **._stopBroadcastInterval()** (4 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.forceDisconnectParticipant()** (4 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.getConnectionStats()** (4 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.handleParticipantDisconnection()** (4 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.cleanupInactiveSessions()** (4 connections) — `/opt/strange-kode/kubic-kode/game-server/session-manager.js`
- **.getParticipantCount()** (4 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-participant-manager.js`
- **.getDisconnectedParticipants()** (3 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.resetTimer()** (3 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **._startBroadcastInterval()** (3 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- **.handleParticipantReconnection()** (3 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.startHeartbeat()** (3 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.stopHeartbeat()** (3 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- **.handleInactivity()** (2 connections) — `/opt/strange-kode/kubic-kode/game-engine/game-interface.js`
- **.getConnectedParticipants()** (2 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.getSessionStatus()** (2 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.clearActedPlayers()** (2 connections) — `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`
- *... and 13 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `/opt/strange-kode/kubic-kode/game-engine/game-interface.js`
- `/opt/strange-kode/kubic-kode/game-server/session-manager.js`
- `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-connection-manager.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-history-manager.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-participant-manager.js`
- `/opt/strange-kode/kubic-kode/game-utility/inactivity-manager.js`

## Audit Trail

- EXTRACTED: 80 (55%)
- INFERRED: 65 (45%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*