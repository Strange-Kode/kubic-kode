# Chat Lobby

> 72 nodes · cohesion 0.07

## Key Concepts

- **setLobbyConfig()** (18 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- **SessionLobbyManager** (18 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-lobby-manager.js`
- **.getParticipantById()** (16 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **leaveSession()** (16 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **.getPlayableParticipants()** (14 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **autoJoinSession()** (14 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **startSyncPhase()** (13 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- **SessionChatManager** (13 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-chat-manager.js`
- **.getChatManager()** (11 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **deleteLobbyConfig()** (11 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- **kickParticipant()** (11 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **participant-module.js** (10 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **setParticipantReady()** (10 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- **participant-module.js** (10 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **.getHost()** (10 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-participant-manager.js`
- **.getLobbyManager()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **.getParticipantManager()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- **getLobbyConfig()** (9 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- **joinSession()** (9 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **transferHost()** (9 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- **.addSystemMessage()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-chat-manager.js`
- **.getLobbyStatus()** (9 connections) — `/opt/strange-kode/kubic-kode/game-server/session/session-lobby-manager.js`
- **sendChatMessage()** (8 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/chat-module.js`
- **serializeRecursively()** (8 connections) — `/opt/strange-kode/kubic-kode/game-utility/game-utility.js`
- **getReadyStates()** (8 connections) — `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- *... and 47 more nodes in this community*

## Relationships

- No strong cross-community connections detected

## Source Files

- `/opt/strange-kode/kubic-kode/game-module/modules/chat-module.js`
- `/opt/strange-kode/kubic-kode/game-module/modules/lobby-module.js`
- `/opt/strange-kode/kubic-kode/game-module/modules/participant-module.js`
- `/opt/strange-kode/kubic-kode/game-server/session/game-session.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-chat-manager.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-lobby-manager.js`
- `/opt/strange-kode/kubic-kode/game-server/session/session-participant-manager.js`
- `/opt/strange-kode/kubic-kode/game-utility/game-utility.js`

## Audit Trail

- EXTRACTED: 180 (42%)
- INFERRED: 252 (58%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*