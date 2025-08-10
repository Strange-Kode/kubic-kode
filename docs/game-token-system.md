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
GAME_TOKEN_SECRET_KEY=<your-secure-32-character-key>
GAME_TOKEN_ALGORITHM=aes-256-gcm
GAME_TOKEN_IV_LENGTH=16
GAME_TOKEN_SALT_LENGTH=64
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
POST /game/play-turn/:sessionId
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
- **Random IV**: 16-byte random initialization vector
- **Salt**: 64-byte random salt
- **Authentication**: Built-in GCM authentication tag

### Validation

- **Session Binding**: Tokens are bound to specific sessions
- **Participant Binding**: Tokens are bound to specific participants
- **Timestamp Validation**: Tokens include creation timestamps
- **HTTP Method Enforcement**: Only POST requests accepted
- **Middleware Protection**: All game routes protected

### Token Structure

```javascript
{
  sessionId: "session-uuid",
  participantId: 1,
  timestamp: 1640995200000,
  // Encrypted and encoded as base64
}
```

## Usage Examples

### 1. Join Session and Get Token

```javascript
// Join a session
const joinResponse = await fetch('/api/session/abc-123/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    participantName: 'Player1',
    participantType: 'user'
  })
});

const { participant_id, game_token } = await joinResponse.json();

// Store the token securely
localStorage.setItem('gameToken', game_token);
localStorage.setItem('participantId', participant_id);
```

### 2. Make a Game Move

```javascript
// Use the participant's token for game actions
const moveResponse = await fetch('/api/game/play-turn/abc-123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gameToken: localStorage.getItem('gameToken'),
    participantId: localStorage.getItem('participantId'),
    xPos: 1,
    yPos: 1
  })
});
```

## Error Responses

### Token Validation Errors

```json
{
  "error": "Game token is required",
  "code": "MISSING_TOKEN"
}
```

```json
{
  "error": "Invalid game token",
  "code": "INVALID_TOKEN"
}
```

```json
{
  "error": "Game token does not match session",
  "code": "SESSION_MISMATCH"
}
```

```json
{
  "error": "Game token does not match participant",
  "code": "PARTICIPANT_MISMATCH"
}
```

### HTTP Method Errors

```json
{
  "error": "Game tokens must be sent via POST requests",
  "code": "INVALID_METHOD"
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

1. **Secure Storage**: Store tokens securely (not in localStorage for production)
2. **HTTPS Only**: Use HTTPS in production
3. **Environment Variables**: Keep encryption keys secure
4. **Token Expiration**: Consider implementing token expiration

## Future Enhancements

- **Token Expiration**: Add TTL to tokens
- **Refresh Tokens**: Implement token refresh mechanism
- **Audit Logging**: Add comprehensive audit trails
- **Rate Limiting**: Implement rate limiting per participant
- **Token Revocation**: Add ability to revoke tokens
