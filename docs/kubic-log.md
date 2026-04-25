# Kubic Log Configuration

The server-side application now includes a comprehensive logging system (Kubic Log) that controls terminal output based on configuration settings.

## Environment Variables

### KUBIC_DEBUG_MODE / DEBUG_MODE

Controls whether debug output is enabled:

- `true` or `1`: Debug mode enabled
- `false` or `0` (default): Debug mode disabled
- Any other value: Debug mode disabled

`KUBIC_DEBUG_MODE` is preferred. `DEBUG_MODE` is still supported by the current scripts.

### KUBIC_LOG_LEVEL / KUBIC_DEBUG_LEVEL / DEBUG_LEVEL

Controls the verbosity level of debug output (when DEBUG_MODE is enabled):

- `error` (0): Only error messages
- `warn` (1): Error and warning messages
- `info` (2): Error, warning, and info messages (default)
- `debug` (3): Error, warning, info, and debug messages
- `trace` (4): All messages including trace-level details

`KUBIC_LOG_LEVEL` is checked first, then `KUBIC_DEBUG_LEVEL`, then `DEBUG_LEVEL`.

## Usage Examples

### Enable Debug Mode

```bash
# Enable debug mode with default info level
KUBIC_DEBUG_MODE=true KUBIC_LOG_LEVEL=info node game-server/game-server.js

# Enable debug mode with specific level
KUBIC_DEBUG_MODE=true KUBIC_LOG_LEVEL=debug node game-server/game-server.js

# Enable debug mode with trace level for maximum verbosity
KUBIC_DEBUG_MODE=true KUBIC_LOG_LEVEL=trace node game-server/game-server.js
```

### Disable Debug Mode

```bash
# Debug mode disabled (default)
node game-server/game-server.js

# Explicitly disable debug mode
KUBIC_DEBUG_MODE=false node game-server/game-server.js
```

## Debug Levels Explained

### Error Level (0)

Only critical errors are logged:

- Uncaught exceptions
- Unhandled promise rejections
- Critical system failures

### Warn Level (1)

Includes errors plus warnings:

- Deprecated API usage
- Non-critical system issues
- Session removal warnings

### Info Level (2) - Default

Includes errors, warnings, plus informational messages:

- Server startup messages
- Session creation/management
- WebSocket connection events
- Game state changes

### Debug Level (3)

Includes all above plus detailed debug information:

- WebSocket connection counts
- Game engine state details
- Tile map serialization
- Computer turn processing

### Trace Level (4)

Maximum verbosity including:

- Full message payloads
- Detailed object serialization
- Step-by-step process tracking

## Runtime Configuration

The debug system can also be configured at runtime through the debug utility:

```javascript
import { kubicLog } from "./kubic-log.js";

// Enable debug mode at runtime
kubicLog.setMode(true, "debug");

// Check if debug is enabled
if (kubicLog.isEnabled()) {
  // Do debug-specific operations
}

// Log at different levels
kubicLog.error("Critical error occurred");
kubicLog.warn("Warning message");
kubicLog.info("Informational message");
kubicLog.debug("Debug information");
kubicLog.trace("Trace-level details");
```

## Output Format

When debug mode is enabled, all log messages are output as structured JSON (one line per entry). This makes logs machine-parseable for log aggregation and querying.

Each entry contains:
- `timestamp` - ISO 8601 format
- `level` - error, warn, info, debug, or trace
- `message` - the log message string
- `data` - (optional) additional arguments passed to the log call

Example output:

```json
{"timestamp":"2026-03-26T10:30:45.123Z","level":"info","message":"Kubic Kode Server running at http://localhost:3000"}
{"timestamp":"2026-03-26T10:30:45.126Z","level":"debug","message":"[GameEventService] New WebSocket connection for session: abc123"}
{"timestamp":"2026-03-26T10:30:45.130Z","level":"warn","message":"Session not found","data":"abc123"}
```

## Performance Impact

- When debug mode is disabled, there is minimal performance impact
- Debug messages are only processed when `KUBIC_DEBUG_MODE`/`DEBUG_MODE` is enabled
- The system uses conditional logging to avoid unnecessary string formatting
- Timestamps are only generated when messages will actually be logged
