# Graph Report - .  (2026-04-25)

## Corpus Check
- 124 files · ~96,599 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1138 nodes · 2253 edges · 36 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 834 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Engine Startgame|Engine Startgame]]
- [[_COMMUNITY_Entity Constructor|Entity Constructor]]
- [[_COMMUNITY_Constructor Setup|Constructor Setup]]
- [[_COMMUNITY_Constructor Tilemap|Constructor Tilemap]]
- [[_COMMUNITY_Event Handlers|Event Handlers]]
- [[_COMMUNITY_Chat Lobby|Chat Lobby]]
- [[_COMMUNITY_Constructor Registry|Constructor Registry]]
- [[_COMMUNITY_Init Interface|Init Interface]]
- [[_COMMUNITY_Constructor Kubic|Constructor Kubic]]
- [[_COMMUNITY_Constructor Registry|Constructor Registry]]
- [[_COMMUNITY_Constructor Options|Constructor Options]]
- [[_COMMUNITY_Getsubscriptions Subscription|Getsubscriptions Subscription]]
- [[_COMMUNITY_Scrollable Tile|Scrollable Tile]]
- [[_COMMUNITY_Constructor Machine|Constructor Machine]]
- [[_COMMUNITY_Connection Getsessionstatus|Connection Getsessionstatus]]
- [[_COMMUNITY_Jsx App|Jsx App]]
- [[_COMMUNITY_Vote Startrestartvote|Vote Startrestartvote]]
- [[_COMMUNITY_Gsm Only|Gsm Only]]
- [[_COMMUNITY_Create Creategameserver|Create Creategameserver]]
- [[_COMMUNITY_Utility Checkplayableaccess|Utility Checkplayableaccess]]
- [[_COMMUNITY_Contract Gamecontract|Contract Gamecontract]]
- [[_COMMUNITY_Sessionbrowser Usesessionbrowser|Sessionbrowser Usesessionbrowser]]
- [[_COMMUNITY_Gamecontext Jsx|Gamecontext Jsx]]
- [[_COMMUNITY_Errors Kubicclienterror|Errors Kubicclienterror]]
- [[_COMMUNITY_Rps Custom|Rps Custom]]
- [[_COMMUNITY_Contract Registry|Contract Registry]]
- [[_COMMUNITY_Sessionbrowsermodal Jsx|Sessionbrowsermodal Jsx]]
- [[_COMMUNITY_Loadingscreen Jsx|Loadingscreen Jsx]]
- [[_COMMUNITY_Container Jsx|Container Jsx]]
- [[_COMMUNITY_Welcomescreen Jsx|Welcomescreen Jsx]]
- [[_COMMUNITY_Livetimer Jsx|Livetimer Jsx]]
- [[_COMMUNITY_Gamemodal Jsx|Gamemodal Jsx]]
- [[_COMMUNITY_Proxy Kebabtocamel|Proxy Kebabtocamel]]
- [[_COMMUNITY_Health Point|Health Point]]
- [[_COMMUNITY_Action Point|Action Point]]
- [[_COMMUNITY_React Tic|React Tic]]

## God Nodes (most connected - your core abstractions)
1. `GameSession` - 55 edges
2. `KubicKodeGame` - 44 edges
3. `broadcastToSession()` - 43 edges
4. `GameEngine` - 42 edges
5. `GameOptions` - 38 edges
6. `SessionParticipantManager` - 35 edges
7. `GameHistory` - 33 edges
8. `TicTacToeGame` - 30 edges
9. `GameStateMachine` - 28 edges
10. `handleGameStart()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `End-to-End Test Suite` --conceptually_related_to--> `Spectator Functionality`  [INFERRED]
  test/README.md → README.md
- `Game Token Authentication` --shares_data_with--> `Playable Access Middleware`  [INFERRED]
  README.md → docs/spectator-functionality.md
- `End-to-End Test Suite` --conceptually_related_to--> `Heartbeat Connection Management`  [INFERRED]
  test/README.md → docs/heartbeat-system.md
- `handleGameStart()` --calls--> `serializeRecursively()`  [INFERRED]
  /opt/strange-kode/kubic-kode/game-module/modules/game-module.js → /opt/strange-kode/kubic-kode/game-utility/game-utility.js
- `processTileMapData()` --calls--> `serializeRecursively()`  [INFERRED]
  /opt/strange-kode/kubic-kode/game-module/modules/tilemap-module.js → /opt/strange-kode/kubic-kode/game-utility/game-utility.js

## Hyperedges (group relationships)
- **State and visibility control pattern** — game_state_machine_gsm_architecture, scrollable_tilemap_viewport_system, spectator_functionality_playable_access_middleware [INFERRED 0.70]
- **Extensible game architecture pattern** — heads_or_tails_tutorial_game_contract, heads_or_tails_tutorial_kubickodegame_wrapper, module_system_dynamic_loader, heads_or_tails_tutorial_game_registry [INFERRED 0.81]
- **Real-time session resilience stack** — heartbeat_system_connection_management, spectator_functionality_spectator_role, client_readme_kubickode_helper, rps_example_kubic_events [INFERRED 0.84]

## Communities

### Community 0 - "Engine Startgame"
Cohesion: 0.03
Nodes (3): GameEngine, GameHistory, KubicKodeGame

### Community 1 - "Entity Constructor"
Cohesion: 0.03
Nodes (6): GameEntity, GameEntityPlayer, GameSession, MarkEntity, PlayerEntity, Viewport

### Community 2 - "Constructor Setup"
Cohesion: 0.07
Nodes (20): init(), login(), E2ETestRunner, checkGameContractCompliance(), validateGameInstance(), LobbySystemTest, main(), basicSetup() (+12 more)

### Community 3 - "Constructor Tilemap"
Cohesion: 0.04
Nodes (7): minimax(), minimaxTicTacToe(), PlayStatus, TicTacToeGame, TileMap, init(), processTileMapData()

### Community 4 - "Event Handlers"
Cohesion: 0.03
Nodes (23): createConfigEventHandlers(), createConfigState(), createConnectionEventHandlers(), createEventEmitter(), createFlowState(), createGameEventHandlers(), createGameRegistry(), createGameRoutes() (+15 more)

### Community 5 - "Chat Lobby"
Cohesion: 0.07
Nodes (22): getChatMessages(), init(), sendChatMessage(), serializeRecursively(), deleteLobbyConfig(), getLobbyConfig(), getReadyStates(), init() (+14 more)

### Community 6 - "Constructor Registry"
Cohesion: 0.07
Nodes (35): validate(), broadcastToSession(), checkSessionViability(), cleanupSession(), clearParticipantTimeout(), deregisterBroadcast(), getConnectedParticipants(), getRegisteredBroadcasts() (+27 more)

### Community 7 - "Init Interface"
Cohesion: 0.07
Nodes (23): _broadcastComputerTurn(), _handleComputerTie(), _handleComputerWin(), hasComputerPlayers(), init(), processComputerTurns(), GameInterface, handleGameStart() (+15 more)

### Community 8 - "Constructor Kubic"
Cohesion: 0.05
Nodes (20): createErrorResponse(), ErrorFactory, KubicAuthenticationError, KubicBroadcastError, KubicConfigurationError, KubicConflictError, KubicContractError, KubicGameError (+12 more)

### Community 9 - "Constructor Registry"
Cohesion: 0.06
Nodes (6): GameRegistry, clear(), register(), run(), unregister(), SessionParticipantManager

### Community 10 - "Constructor Options"
Cohesion: 0.06
Nodes (5): getGameOptions(), GameOptions, ConfigurableTicTacToeFactory(), ConfigurableTicTacToeGame, TicTacToeClassicFactory()

### Community 11 - "Getsubscriptions Subscription"
Cohesion: 0.06
Nodes (16): SessionHistoryManager, SessionManager, cleanupInactiveSessions(), getGameHistory(), getLobbyStatus(), getSessionsByVariant(), getSessionStatus(), getSessionsWithStatus() (+8 more)

### Community 12 - "Scrollable Tile"
Cohesion: 0.05
Nodes (3): ScrollableTileMapManager, ScrollableTileMap, ViewportPlayer

### Community 13 - "Constructor Machine"
Cohesion: 0.06
Nodes (3): GameState, GameStateMachine, StateTransition

### Community 14 - "Connection Getsessionstatus"
Cohesion: 0.07
Nodes (2): InactivityManager, SessionConnectionManager

### Community 15 - "Jsx App"
Cohesion: 0.09
Nodes (8): App(), AppContent(), GameCanvas(), useGame(), usePlayerWins(), useRestartVoting(), useSession(), useTicTacToe()

### Community 16 - "Vote Startrestartvote"
Cohesion: 0.15
Nodes (4): SessionVoteManager, init(), startRestartVote(), submitRestartVote()

### Community 17 - "Gsm Only"
Cohesion: 0.12
Nodes (20): Use GSM only for complex games, GSM Architecture, Heartbeat Connection Management, Prevent stuck games on disconnect, KubicKode Error Hierarchy, Structured JSON Logging, Dynamic Module Loader, Module Lifecycle Hooks (+12 more)

### Community 18 - "Create Creategameserver"
Cohesion: 0.35
Nodes (7): createGameServer(), setupCORS(), setupErrorHandlers(), setupHelmet(), validateEnvironment(), getKubicKodeModulesPath(), initModuleSystem()

### Community 19 - "Utility Checkplayableaccess"
Cohesion: 0.36
Nodes (8): checkPlayableAccess(), generateSessionId(), pickProperties(), shuffleArray(), sleep(), validateParticipant(), validatePlayableParticipant(), validateSession()

### Community 20 - "Contract Gamecontract"
Cohesion: 0.22
Nodes (1): GameContract

### Community 21 - "Sessionbrowser Usesessionbrowser"
Cohesion: 0.33
Nodes (2): SessionBrowser(), useSessionBrowser()

### Community 22 - "Gamecontext Jsx"
Cohesion: 0.67
Nodes (2): GameProvider(), useGame()

### Community 23 - "Errors Kubicclienterror"
Cohesion: 0.5
Nodes (1): KubicClientError

### Community 24 - "Rps Custom"
Cohesion: 0.67
Nodes (4): Custom Broadcast Registration, KubicKode Helper, Alpine RPS Component, RPS WebSocket Event Handlers

### Community 25 - "Contract Registry"
Cohesion: 0.5
Nodes (4): Game Contract, Game Registry, KubicKodeGame Wrapper, No-boilerplate game design intent

### Community 26 - "Sessionbrowsermodal Jsx"
Cohesion: 0.67
Nodes (1): SessionBrowserModal()

### Community 27 - "Loadingscreen Jsx"
Cohesion: 0.67
Nodes (1): LoadingScreen()

### Community 28 - "Container Jsx"
Cohesion: 0.67
Nodes (1): Container()

### Community 29 - "Welcomescreen Jsx"
Cohesion: 0.67
Nodes (1): WelcomeScreen()

### Community 30 - "Livetimer Jsx"
Cohesion: 0.67
Nodes (1): LiveTimer()

### Community 31 - "Gamemodal Jsx"
Cohesion: 0.67
Nodes (1): GameModal()

### Community 32 - "Proxy Kebabtocamel"
Cohesion: 0.67
Nodes (1): kebabToCamel()

### Community 33 - "Health Point"
Cohesion: 0.67
Nodes (1): HealthPointComponent()

### Community 34 - "Action Point"
Cohesion: 0.67
Nodes (1): ActionPointComponent()

### Community 55 - "React Tic"
Cohesion: 1.0
Nodes (1): React Tic-Tac-Toe Vite Entry

## Ambiguous Edges - Review These
- `RPS WebSocket Event Handlers` → `Custom Broadcast Registration`  [AMBIGUOUS]
  client/rps-example.html · relation: references

## Knowledge Gaps
- **8 isolated node(s):** `React Tic-Tac-Toe Vite Entry`, `Game Registry`, `No-boilerplate game design intent`, `Process only visible tiles for performance`, `Use GSM only for complex games` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Connection Getsessionstatus`** (38 nodes): `.handleInactivity()`, `session-connection-manager.js`, `.getConnectedParticipants()`, `.getDisconnectedParticipants()`, `.getParticipants()`, `.getSessionStatus()`, `.markEnded()`, `.markStarted()`, `inactivity-manager.js`, `InactivityManager`, `.clearActedPlayers()`, `.clearTimer()`, `.getTimeRemaining()`, `.haveAllPlayersActed()`, `.markPlayerActed()`, `._onTimeout()`, `.resetTimer()`, `._startBroadcastInterval()`, `.startTimer()`, `._stopBroadcastInterval()`, `session-connection-manager.js`, `inactivity-manager.js`, `SessionConnectionManager`, `.constructor()`, `.forceDisconnectParticipant()`, `.getConnectionStats()`, `.getParticipantsWithConnectionIssues()`, `.getSessionStatus()`, `.handleParticipantDisconnection()`, `.handleParticipantReconnection()`, `.isHeartbeatStarted()`, `.resetAllConnectionStatus()`, `.startHeartbeat()`, `.stopHeartbeat()`, `.addSessionEndedEvent()`, `.addSessionStartedEvent()`, `.cleanupInactiveSessions()`, `.getParticipantCount()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Contract Gamecontract`** (9 nodes): `GameContract`, `.constructor()`, `.getAllMethods()`, `.getDocumentation()`, `.isOptional()`, `.isRequired()`, `.isWrapperMethod()`, `game-contract.js`, `game-contract.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sessionbrowser Usesessionbrowser`** (6 nodes): `SessionBrowser.jsx`, `useSessionBrowser.js`, `SessionBrowser.jsx`, `useSessionBrowser.js`, `SessionBrowser()`, `useSessionBrowser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gamecontext Jsx`** (4 nodes): `GameContext.jsx`, `GameProvider()`, `useGame()`, `GameContext.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Errors Kubicclienterror`** (4 nodes): `errors.js`, `KubicClientError`, `.constructor()`, `errors.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sessionbrowsermodal Jsx`** (3 nodes): `SessionBrowserModal.jsx`, `SessionBrowserModal.jsx`, `SessionBrowserModal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loadingscreen Jsx`** (3 nodes): `LoadingScreen.jsx`, `LoadingScreen()`, `LoadingScreen.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Container Jsx`** (3 nodes): `Container.jsx`, `Container()`, `Container.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Welcomescreen Jsx`** (3 nodes): `WelcomeScreen.jsx`, `WelcomeScreen.jsx`, `WelcomeScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Livetimer Jsx`** (3 nodes): `LiveTimer.jsx`, `LiveTimer()`, `LiveTimer.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gamemodal Jsx`** (3 nodes): `GameModal.jsx`, `GameModal()`, `GameModal.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Proxy Kebabtocamel`** (3 nodes): `proxy.js`, `proxy.js`, `kebabToCamel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Health Point`** (3 nodes): `health-point-component.js`, `HealthPointComponent()`, `health-point-component.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Action Point`** (3 nodes): `ActionPointComponent()`, `action-point-component.js`, `action-point-component.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Tic`** (1 nodes): `React Tic-Tac-Toe Vite Entry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `RPS WebSocket Event Handlers` and `Custom Broadcast Registration`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `setupEventHandlers()` connect `Constructor Setup` to `Event Handlers`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `ErrorFactory` connect `Constructor Kubic` to `Engine Startgame`, `Constructor Registry`, `Entity Constructor`, `Constructor Registry`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `GameEngine` connect `Engine Startgame` to `Constructor Tilemap`, `Init Interface`, `Constructor Registry`, `Scrollable Tile`, `Constructor Machine`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `broadcastToSession()` (e.g. with `._onTimeout()` and `handleWinCondition()`) actually correct?**
  _`broadcastToSession()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `React Tic-Tac-Toe Vite Entry`, `Game Registry`, `No-boilerplate game design intent` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Engine Startgame` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._