# Game Token System Documentation

## Overview

The Game Token System provides secure authentication for game actions in KubicKodeGame. **Each participant in a session receives their own unique game token** that they use to authenticate their turns and other game actions.

## Key Features

- **Participant-Specific Tokens**: Each participant gets a unique encrypted token
- **Secure Encryption**: Uses AES-256-GCM with PBKDF2 key derivation
- **POST-Only Transmission**: Tokens can only be passed via POST requests
- **Express Middleware**: Built-in validation and security enforcement
- **Session Binding**: Tokens are bound to specific sessions and participants
- **Automatic Generation**: Tokens are generated when participants join sessions

## Architecture

### Token Generation Flow

1. **Session Creation**: A new game session is created
2. **Participant Joins**: When a participant joins, a unique token is generated
3. **Token Storage**: The token is stored in the session's participant token map
4. **Token Delivery**: The token is returned to the participant in the join response
5. **Authentication**: Participant uses token for subsequent game actions

### Components

- **`GameTokenService`**: Core token generation, encryption, and validation
- **`GameTokenMiddleware`**: Express middleware for token validation
- **`GameSession`**: Manages participant-specific tokens
- **`SessionManager`**: Coordinates session and participant management

## Setup

### 1. Environment Configuration

Configure the root .env file with the game token encryption settings.

```env
# Game Token Encryption
KUBIC_GAME_TOKEN_SECRET_KEY=<your-secure-32-character-key>
KUBIC_GAME_TOKEN_ALGORITHM=aes-256-gcm
KUBIC_GAME_TOKEN_IV_LENGTH=16
KUBIC_GAME_TOKEN_SALT_LENGTH=64
```

### 2. Dependencies

The system uses Node.js built-in modules:

- `crypto` for encryption/decryption

## API Changes

### Session Initialization

**Before (Session-level token):**

```json
{
  "session_id": "abc-123",
  "session_created": true,
  "game_token": "encrypted-session-token"
}
```

**After (No session token):**

```json
{
  "session_id": "abc-123",
  "session_created": true
}
```

### Participant Join

**New Response Format:**

```json
{
  "success": true,
  "participant_id": 1,
  "game_token": "encrypted-participant-token"
}
```

### Game Routes

All game routes now require participant-specific tokens:

```http
POST /api/game/:sessionId/play-turn
Content-Type: application/json

{
  "gameToken": "participant-specific-token",
  "participantId": 1,
  "xPos": 0,
  "yPos": 0
}
```

## Security Features

### Token Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Random IV**: 16-byte random initialization vector (default; `KUBIC_GAME_TOKEN_IV_LENGTH`)
- **Salt**: 64-byte random salt (default; `KUBIC_GAME_TOKEN_SALT_LENGTH`)
- **Authentication**: Built-in GCM authentication tag

### Validation

- **Session Binding**: Tokens encode a session and are rejected on session mismatch
- **Participant Binding**: Tokens encode a participant; when a request also supplies `participantId`, a mismatch is rejected (the check is skipped if the request omits it)
- **Expiration**: Tokens carry a creation timestamp and are rejected after a 24-hour max age
- **HTTP Method Enforcement**: Only POST requests accepted
- **Middleware Protection**: All game routes protected

### Token Structure

This is the plaintext payload that gets encrypted:

```javascript
{
  sessionId: "session-uuid",
  participantId: 1,
  timestamp: 1640995200000,
  nonce: "<random hex>" // 16 random bytes; validation rejects tokens without it
}
```

The payload above is AES-256-GCM encrypted; the token string handed to the client is `base64(salt + iv + authTag + ciphertext)`, not a base64 encoding of the raw object.

## Usage Examples

### 1. Join Session and Get Token

```javascript
// Join a session
const joinResponse = await fetch("/api/session/abc-123/join", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    participantName: "Player1",
    participantType: "user"
  })
});

const { participant_id, game_token } = await joinResponse.json();

// The KubicKode helper stores tokens for you under the single localStorage key
// `kubic_game_tokens`, as a nested { [sessionId]: { [participantId]: token } } map.
// If you manage tokens yourself, mirror that scheme rather than flat keys.
```

### 2. Make a Game Move

```javascript
// Use the participant's token for game actions. With the helper, this is
// handled for you: KubicKode.playTurn(1, 1) injects the stored gameToken and
// participantId automatically. The raw request looks like:
const moveResponse = await fetch("/api/game/abc-123/play-turn", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    gameToken: "participant-specific-token",
    participantId: 1,
    xPos: 1,
    yPos: 1
  })
});
```

## Error Responses

Error responses use the shape `{ error: true, message, code }` (some include extra
context fields). HTTP status codes are noted per case.

### Token Validation Errors

```json
// 401
{
  "error": true,
  "message": "Game token is required",
  "code": "MISSING_GAME_TOKEN"
}
```

```json
// 401
{
  "error": true,
  "message": "Invalid or expired game token",
  "code": "INVALID_GAME_TOKEN"
}
```

```json
// 403 (also includes tokenSessionId / requestSessionId)
{
  "error": true,
  "message": "Game token is not valid for this session",
  "code": "TOKEN_SESSION_MISMATCH"
}
```

```json
// 403 (also includes tokenParticipantId / requestParticipantId)
{
  "error": true,
  "message": "Game token is not valid for this participant",
  "code": "TOKEN_PARTICIPANT_MISMATCH"
}
```

### HTTP Method Errors

```json
// 405 (no code field; includes the offending method)
{
  "error": true,
  "message": "Game token validation only allowed via POST requests",
  "method": "GET"
}
```

## Troubleshooting

### Common Issues

1. **Token Not Found**: Ensure participant has joined the session
2. **Invalid Token**: Check token format and encryption
3. **Session Mismatch**: Verify session ID matches token
4. **Participant Mismatch**: Ensure participant ID matches token
5. **HTTP Method Error**: Use POST for all token operations

## Security Best Practices

1. **Secure Storage**: Store tokens securely
2. **HTTPS Only**: Use HTTPS in production
3. **Environment Variables**: Keep encryption keys secure

Tokens already expire after a fixed 24-hour max age (enforced in
`GameTokenService.validateToken`); this is currently hardcoded, not configurable.

## Future Enhancements

- **Configurable Expiration**: Make the 24-hour token TTL configurable
- **Refresh Tokens**: Implement token refresh mechanism
- **Audit Logging**: Add comprehensive audit trails
- **Rate Limiting**: Implement rate limiting per participant
- **Token Revocation**: Add ability to revoke tokens

## See also

- [Building and Playing a Game](./building-and-playing-a-game.md) - the game routes that require these tokens, and how the KubicKode helper supplies them for you
