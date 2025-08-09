# Kubic Log Configuration

The server-side application now includes a comprehensive logging system (Kubic Log) that controls terminal output based on configuration settings.

## Environment Variables

### DEBUG_MODE

Controls whether debug output is enabled:

- `true` or `1`: Debug mode enabled
- `false` or `0` (default): Debug mode disabled
- Any other value: Debug mode disabled

### DEBUG_LEVEL

Controls the verbosity level of debug output (when DEBUG_MODE is enabled):

- `error` (0): Only error messages
- `warn` (1): Error and warning messages
- `info` (2): Error, warning, and info messages (default)
- `debug` (3): Error, warning, info, and debug messages
- `trace` (4): All messages including trace-level details

## Usage Examples

### Enable Debug Mode

```bash
# Enable debug mode with default info level
DEBUG_MODE=true node game-server.js

# Enable debug mode with specific level
DEBUG_MODE=true DEBUG_LEVEL=debug node game-server.js

# Enable debug mode with trace level for maximum verbosity
DEBUG_MODE=true DEBUG_LEVEL=trace node game-server.js
```

### Disable Debug Mode

```bash
# Debug mode disabled (default)
node game-server.js

# Explicitly disable debug mode
DEBUG_MODE=false node game-server.js
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
import { kubicLog } from './kubic-log.js';

// Enable debug mode at runtime
kubicLog.setMode(true, 'debug');

// Check if debug is enabled
if (kubicLog.isEnabled()) {
  // Do debug-specific operations
}

// Log at different levels
kubicLog.error('Critical error occurred');
kubicLog.warn('Warning message');
kubicLog.info('Informational message');
kubicLog.debug('Debug information');
kubicLog.trace('Trace-level details');
```

## Output Format

When debug mode is enabled, all log messages include:

- Timestamp in ISO format
- Log level in uppercase
- Original message and arguments

Example output:

```text

[2024-01-15T10:30:45.123Z] [INFO] Kubic Kode Server running at http://localhost:3000
[2024-01-15T10:30:45.124Z] [INFO] Debug mode: enabled
[2024-01-15T10:30:45.125Z] [INFO] Debug level: info
[2024-01-15T10:30:45.126Z] [DEBUG] [GameEventService] New WebSocket connection for session: abc123
```

## Performance Impact

- When debug mode is disabled, there is minimal performance impact
- Debug messages are only processed when DEBUG_MODE is enabled
- The system uses conditional logging to avoid unnecessary string formatting
- Timestamps are only generated when messages will actually be logged
