import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import http from "http";
import express from "express";
import { kubicLog } from "../kubic-log.js";
import { initModuleSystem } from "../game-module/module-system/index.js";
import sessionRouter from "./route/session-routes.js";
import gameRouter from "./route/game-routes.js";
import { GameEventService } from "./game-event-service.js";

/**
 * Validates and loads environment variables
 */
function validateEnvironment() {
  // Check if .env file exists before loading
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error("❌ Missing .env file!");
    console.error(`Expected .env file at: ${envPath}`);
    console.error("");
    console.error("📋 To fix this issue:");
    console.error("1. Copy the example environment file:");
    console.error("   cp .env.example .env");
    console.error("");
    console.error("2. Or create a .env file manually with required variables:");
    console.error("   KUBIC_GAME_TOKEN_SECRET_KEY=your-secret-key-here-at-least-32-chars");
    console.error("   KUBIC_PORT=3000");
    console.error("");
    console.error("3. Ensure your secret key is at least 32 characters long");
    console.error("");
    process.exit(1);
  }

  // Load environment variables from .env file FIRST, before any other imports
  dotenv.config();

  // Check critical environment variables
  const requiredEnvVars = [
    'KUBIC_GAME_TOKEN_SECRET_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach(varName => {
      console.error(`   ${varName}`);
    });
    console.error("");
    console.error("📋 Please add these to your .env file:");
    console.error("   KUBIC_GAME_TOKEN_SECRET_KEY=your-secret-key-here-at-least-32-chars");
    console.error("");
    console.error("💡 The secret key must be at least 32 characters long");
    console.error("");
    process.exit(1);
  }

  // Log only KUBIC_ environment variables (protecting sensitive ones)
  console.log("=== KUBIC Environment Variables Loaded ===");
  Object.keys(process.env)
    .filter(key => key.startsWith("KUBIC_"))
    .forEach(key => {
      const value = process.env[key];
      // Protect sensitive keys by showing [SET] instead of actual value
      if (key.includes("SECRET") || key.includes("PASSWORD") || key.includes("KEY")) {
        console.log(`${key}:`, value ? "[SET]" : "[NOT SET]");
      } else {
        console.log(`${key}:`, value);
      }
    });
  console.log("=====================================");
}

/**
 * Sets up error handlers for uncaught exceptions and unhandled rejections
 */
function setupErrorHandlers() {
  process.on("uncaughtException", (err) => {
    kubicLog.error("Uncaught Exception:", err.stack || err);
  });
  process.on("unhandledRejection", (reason, promise) => {
    kubicLog.error("Unhandled Rejection:", reason.stack || reason);
  });
}

/**
 * Attempts to load and configure helmet middleware
 * @param {boolean|object} helmetOption - Helmet configuration (true, false, or config object)
 * @returns {Function|null} Helmet middleware or null if not available
 */
async function setupHelmet(helmetOption) {
  if (helmetOption === false) {
    return null;
  }

  try {
    const helmet = await import('helmet');
    const helmetMiddleware = helmet.default || helmet;
    const helmetConfig = helmetOption === true ? {} : helmetOption;
    return helmetMiddleware(helmetConfig);
  } catch (error) {
    kubicLog.warn('Helmet not available - continuing without security headers');
    return null;
  }
}

/**
 * Sets up CORS middleware
 * @param {string[]} allowedOrigins - Array of allowed origin URLs
 * @returns {Function} CORS middleware function
 */
function setupCORS(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  };
}

/**
 * Creates and configures a Kubic Kode game server
 * @param {Object} options - Configuration options
 * @param {number} [options.port] - Server port (default: process.env.KUBIC_PORT || 3000)
 * @param {string[]} [options.corsOrigins] - Allowed CORS origins (default: ['http://localhost:3001'] or KUBIC_ALLOWED_ORIGINS)
 * @param {string|string[]} [options.staticPaths] - Static file paths (default: '../client')
 * @param {Array<{path: string, router: Router}>} [options.gameRouters] - Custom game routers (default: [])
 * @param {string} [options.modulesPath] - Module system path (default: 'game-module/modules')
 * @param {Function} [options.rootHandler] - Root route handler (default: simple "It works!" response)
 * @param {boolean|object} [options.helmet] - Helmet configuration (default: true)
 * @param {boolean} [options.startServer] - Auto-start server (default: true)
 * @param {Function} [options.onReady] - Callback when server is ready (app, server)
 * @returns {Promise<{app: Express, server: Server}>} Express app and HTTP server
 */
export async function createGameServer(options = {}) {
  // Validate environment first
  validateEnvironment();

  // Set up error handlers
  setupErrorHandlers();

  // Extract options with defaults
  const {
    port = process.env.KUBIC_PORT || 3000,
    corsOrigins = process.env.KUBIC_ALLOWED_ORIGINS 
      ? process.env.KUBIC_ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3001'],
    staticPaths = '../client',
    gameRouters = [],
    modulesPath = 'game-module/modules',
    rootHandler = (req, res) => res.send("It works!"),
    helmet: helmetOption = true,
    startServer = true,
    onReady
  } = options;

  // Create Express app
  const app = express();

  // Set up helmet (optional dependency)
  const helmetMiddleware = await setupHelmet(helmetOption);
  if (helmetMiddleware) {
    app.use(helmetMiddleware);
  }

  // Set up CORS
  app.use(setupCORS(corsOrigins));

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Serve static files
  const staticPathArray = Array.isArray(staticPaths) ? staticPaths : [staticPaths];
  staticPathArray.forEach((staticPath, index) => {
    const mountPath = staticPathArray.length === 1 ? "/static" : `/static/${index}`;
    app.use(mountPath, express.static(staticPath));
  });

  // Register core routers
  app.use("/api", sessionRouter);
  app.use("/api", gameRouter);

  // Dynamically register game specific routers
  gameRouters.forEach(({ path: routerPath, router }) => {
    app.use(routerPath, router);
  });

  // Root route handler
  app.get("/", rootHandler);

  // Initialize module system
  const resolvedModulesPath = path.resolve(process.cwd(), modulesPath);
  await initModuleSystem(resolvedModulesPath);
  kubicLog.info("Module system initialized");

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize WebSocket server (needs server instance, even if not listening yet)
  GameEventService.initWebSocketServer(server);

  // Start server if requested
  if (startServer) {
    server.listen(port, () => {
      console.log(`Kubic Kode Server running at http://localhost:${port}`);
      console.log(`Debug mode: ${kubicLog.isEnabled() ? "enabled" : "disabled"}`);
      if (kubicLog.isEnabled()) {
        console.log(`Debug level: ${process.env.KUBIC_LOG_LEVEL || process.env.DEBUG_LEVEL || "info"}`);
      }
    });
  }

  // Call onReady callback if provided
  if (onReady) {
    onReady(app, server);
  }

  return { app, server };
}

