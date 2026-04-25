# Graph Report - kubic-kode  (2026-04-25)

## Corpus Check
- 111 files · ~96,835 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1024 nodes · 2014 edges · 24 communities detected
- Extraction: 59% EXTRACTED · 41% INFERRED · 0% AMBIGUOUS · INFERRED: 834 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `GameSession` - 54 edges
2. `KubicKodeGame` - 43 edges
3. `broadcastToSession()` - 42 edges
4. `GameEngine` - 41 edges
5. `GameOptions` - 37 edges
6. `SessionParticipantManager` - 34 edges
7. `GameHistory` - 32 edges
8. `TicTacToeGame` - 29 edges
9. `GameStateMachine` - 27 edges
10. `handleGameStart()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `serializeRecursively()` --calls--> `handleGameStart()`  [INFERRED]
  game-utility/game-utility.js → game-module/modules/game-module.js
- `serializeRecursively()` --calls--> `processTileMapData()`  [INFERRED]
  game-utility/game-utility.js → game-module/modules/tilemap-module.js
- `sessionManagement()` --calls--> `initSession()`  [INFERRED]
  client/rps-usage-example.js → game-module/modules/session-module.js
- `sessionManagement()` --calls--> `joinSession()`  [INFERRED]
  client/rps-usage-example.js → game-module/modules/participant-module.js
- `handleWinCondition()` --calls--> `broadcastToSession()`  [INFERRED]
  game-module/modules/turn-module.js → game-server/game-event-service.js

## Hyperedges (group relationships)
- **State and visibility control pattern** — game_state_machine_gsm_architecture, scrollable_tilemap_viewport_system, spectator_functionality_playable_access_middleware [INFERRED 0.70]
- **Extensible game architecture pattern** — heads_or_tails_tutorial_game_contract, heads_or_tails_tutorial_kubickodegame_wrapper, module_system_dynamic_loader, heads_or_tails_tutorial_game_registry [INFERRED 0.81]
- **Real-time session resilience stack** — heartbeat_system_connection_management, spectator_functionality_spectator_role, client_readme_kubickode_helper, rps_example_kubic_events [INFERRED 0.84]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (4): GameEngine, GameHistory, shuffleArray(), KubicKodeGame

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (6): GameEntity, GameSession, MarkEntity, processHeartbeat(), PlayerEntity, Viewport

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (18): init(), login(), E2ETestRunner, checkGameContractCompliance(), validateGameInstance(), LobbySystemTest, main(), basicSetup() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (7): minimax(), minimaxTicTacToe(), PlayStatus, TicTacToeGame, TileMap, init(), processTileMapData()

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (23): getChatMessages(), sendChatMessage(), broadcastToSession(), checkSessionViability(), handleParticipantDisconnection(), handleSessionTermination(), serializeRecursively(), deleteLobbyConfig() (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (21): _broadcastComputerTurn(), _handleComputerTie(), _handleComputerWin(), hasComputerPlayers(), processComputerTurns(), GameInterface, handleGameStart(), handleGameStop() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (14): GameHistoryManager, SessionHistoryManager, SessionManager, cleanupInactiveSessions(), getGameHistory(), getSessionsByVariant(), getSessionsWithStatus(), getSubscriptions() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (4): GameEntityPlayer, GameState, GameStateMachine, StateTransition

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (3): GameRegistry, register(), SessionParticipantManager

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (23): createConfigEventHandlers(), createConfigState(), createConnectionEventHandlers(), createEventEmitter(), createFlowState(), createGameEventHandlers(), createGameRegistry(), createGameRoutes() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (3): ScrollableTileMapManager, ScrollableTileMap, ViewportPlayer

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (3): getGameOptions(), GameOptions, ConfigurableTicTacToeGame

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (12): cleanupSession(), clearParticipantTimeout(), deregisterBroadcast(), handleHeartbeat(), isBroadcastRegistered(), registerBroadcast(), resetParticipantTimeout(), startHeartbeatForSession() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (18): createErrorResponse(), KubicAuthenticationError, KubicBroadcastError, KubicConfigurationError, KubicConflictError, KubicContractError, KubicGameError, KubicGameOptionsError (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (22): validate(), init(), init(), createGameServer(), setupCORS(), setupErrorHandlers(), setupHelmet(), validateEnvironment() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (2): GameContract, ErrorFactory

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (20): Use GSM only for complex games, GSM Architecture, Heartbeat Connection Management, Prevent stuck games on disconnect, KubicKode Error Hierarchy, Structured JSON Logging, Dynamic Module Loader, Module Lifecycle Hooks (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (4): SessionVoteManager, init(), startRestartVote(), submitRestartVote()

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (7): AppContent(), GameCanvas(), useGame(), usePlayerWins(), useRestartVoting(), useSession(), useTicTacToe()

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (1): SessionChatManager

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (2): SessionBrowser(), useSessionBrowser()

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (4): Game Contract, Game Registry, KubicKodeGame Wrapper, No-boilerplate game design intent

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (1): KubicClientError

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (2): Custom Broadcast Registration, KubicKode Helper

## Knowledge Gaps
- **9 isolated node(s):** `KubicKode Helper`, `Custom Broadcast Registration`, `Game Registry`, `No-boilerplate game design intent`, `Process only visible tiles for performance` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 15`** (22 nodes): `GameContract`, `.constructor()`, `.getAllMethods()`, `.getDocumentation()`, `.isOptional()`, `.isRequired()`, `.isWrapperMethod()`, `.validateGameInstance()`, `game-contract.js`, `ErrorFactory`, `.authentication()`, `.broadcast()`, `.conflict()`, `.contract()`, `.gameOptions()`, `.network()`, `.notFound()`, `.participant()`, `.permission()`, `.session()`, `.websocket()`, `.trace()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (12 nodes): `session-chat-manager.js`, `.getLobbyStatus()`, `SessionChatManager`, `.clearChatMessages()`, `.constructor()`, `.getAllChatMessages()`, `.getChatMessageById()`, `.getChatMessages()`, `.getChatMessagesByParticipant()`, `.getChatMessagesByType()`, `.getChatStats()`, `.getRecentChat()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (4 nodes): `SessionBrowser.jsx`, `useSessionBrowser.js`, `SessionBrowser()`, `useSessionBrowser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `errors.js`, `KubicClientError`, `.constructor()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `Custom Broadcast Registration`, `KubicKode Helper`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `setupEventHandlers()` connect `Community 2` to `Community 9`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `broadcastToSession()` connect `Community 4` to `Community 0`, `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 12`, `Community 14`, `Community 15`, `Community 17`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `handleGameStart()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 11`, `Community 12`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `broadcastToSession()` (e.g. with `._onTimeout()` and `handleWinCondition()`) actually correct?**
  _`broadcastToSession()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `KubicKode Helper`, `Custom Broadcast Registration`, `Game Registry` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._