#!/usr/bin/env node

/**
 * Game Setup Script
 * 
 * This script asks questions to configure and generate a new game from templates.
 * It creates all necessary server-side files for a new game.
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class GameSetupWizard {
  constructor() {
    this._config = {};
    this._templateDir = path.join(__dirname, "template");
    this._conflicts = [];
  }

  // Helper to ask questions
  async askQuestion(question) {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  // Helper to ask yes/no questions
  async askYesNo(question) {
    const answer = await this.askQuestion(`${question} (y/n): `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  }

  // Helper to ask choice questions
  async askChoice(question, choices) {
    console.log(`\\n${question}`);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice}`);
    });
    
    let answer;
    do {
      answer = await this.askQuestion(`Choose (1-${choices.length}): `);
      const num = parseInt(answer);
      if (num >= 1 && num <= choices.length) {
        return choices[num - 1];
      }
      console.log("Invalid choice, please try again.");
    } while (true);
  }

  // Convert to camelCase
  toCamelCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, "");
  }

  // Convert to PascalCase (removes spaces and capitalizes each word)
  toPascalCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
      return word.toUpperCase();
    }).replace(/\s+/g, "");
  }

  // Validate if a string would make a valid JavaScript identifier
  isValidJavaScriptIdentifier(str) {
    // Check if it's empty
    if (!str || str.trim() === "") return false;
    
    // Check if it matches JavaScript identifier rules
    // Must start with letter, underscore, or dollar sign
    // Can contain letters, digits, underscores, dollar signs
    const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    
    if (!identifierRegex.test(str)) return false;
    
    // Check against JavaScript reserved words
    const reservedWords = [
      "break", "case", "catch", "class", "const", "continue", "debugger", "default",
      "delete", "do", "else", "export", "extends", "finally", "for", "function",
      "if", "import", "in", "instanceof", "let", "new", "return", "super", "switch",
      "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield",
      "enum", "implements", "interface", "package", "private", "protected", "public", "static"
    ];
    
    return !reservedWords.includes(str.toLowerCase());
  }

  // Suggest a valid identifier based on an invalid one
  suggestValidIdentifier(str) {
    let suggestion = str.trim();
    
    // Remove or replace invalid characters
    suggestion = suggestion.replace(/[^a-zA-Z0-9_$]/g, "");
    
    // If it starts with a number, prefix with "Game"
    if (/^[0-9]/.test(suggestion)) {
      suggestion = "Game" + suggestion;
    }
    
    // If it's empty after cleaning, use a default
    if (!suggestion) {
      suggestion = "MyGame";
    }
    
    // If it's a reserved word, append "Game"
    const reservedWords = [
      "break", "case", "catch", "class", "const", "continue", "debugger", "default",
      "delete", "do", "else", "export", "extends", "finally", "for", "function",
      "if", "import", "in", "instanceof", "let", "new", "return", "super", "switch",
      "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield",
      "enum", "implements", "interface", "package", "private", "protected", "public", "static"
    ];
    
    if (reservedWords.includes(suggestion.toLowerCase())) {
      suggestion = suggestion + "Game";
    }
    
    return suggestion;
  }

  // Convert to kebab-case (spaces become hyphens, lowercase)
  toKebabCase(str) {
    return str.trim().replace(/\s+/g, "-").toLowerCase();
  }

  // Generate a secure random token for game authentication
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Check for file conflicts
  checkConflicts() {
    this._conflicts = [];
    const gameDir = `backend-${this.toKebabCase(this._config.GAME_NAME)}`;
    
    // Check if backend directory exists
    if (fs.existsSync(gameDir)) {
      this._conflicts.push(`Directory: ${gameDir}/`);
    }

    // Check if .env files exist
    if (!fs.existsSync(".env")) {
      // No conflict for .env - we'll create it
    } else {
      this._conflicts.push("File: .env (will be updated, not overwritten)");
    }

    if (!fs.existsSync(".env.example")) {
      // No conflict for .env.example - we'll create it
    } else {
      this._conflicts.push("File: .env.example (will be updated, not overwritten)");
    }

    return this._conflicts;
  }

  // Collect all necessary information
  async collectGameInfo() {
    console.log("\\n🎮 Welcome to the Game Setup Wizard!");
    console.log("====================================\\n");
    
    // Game name with validation
    let gameName;
    let gameClassName;
    let gameCamelName;
    
    do {
      gameName = await this.askQuestion(`What is the name of your game? (e.g., "Chess", "Connect Four"): `);
      gameClassName = this.toPascalCase(gameName);
      gameCamelName = this.toCamelCase(gameName);
      
      // Check if the generated class name would be valid JavaScript
      if (this.isValidJavaScriptIdentifier(gameClassName) && this.isValidJavaScriptIdentifier(gameCamelName)) {
        this._config.GAME_NAME = gameName;
        this._config.GAME_SHORT_NAME = this.toKebabCase(gameName);
        this._config.GAME_CAMEL_NAME = gameCamelName;
        this._config.GAME_CLASS_NAME = gameClassName;
        break;
      } else {
        // Suggest a valid alternative
        const suggestion = this.suggestValidIdentifier(gameName);
        console.log(`\n⚠️  "${gameName}" would generate invalid JavaScript code.`);
        console.log(`   Generated class name would be: "${gameClassName}"`);
        console.log(`   Generated router name would be: "${gameCamelName}Router"`);
        
        const useSuggestion = await this.askYesNo(`\nWould you like to use "${suggestion}" instead?`);
        
        if (useSuggestion) {
          this._config.GAME_NAME = suggestion;
          this._config.GAME_SHORT_NAME = this.toKebabCase(suggestion);
          this._config.GAME_CAMEL_NAME = this.toCamelCase(suggestion);
          this._config.GAME_CLASS_NAME = this.toPascalCase(suggestion);
          break;
        } else {
          console.log("Please enter a different game name that will generate valid JavaScript identifiers.");
          console.log("Game names should start with a letter and contain only letters, numbers, spaces, hyphens, or underscores.");
        }
      }
    } while (true);
    
    // Indentation preference
    const indentChoices = [
      "2 spaces (..) (default)",
      "4 spaces (....)",
      "1 tab (\\t)"
    ];
    const indentChoice = await this.askChoice("What indentation style do you prefer?", indentChoices);
    
    if (indentChoice.includes("4 spaces")) {
      this._config.INDENT = "    "; // 4 spaces
      this._config.INDENT_STYLE = "4 spaces";
    } else if (indentChoice.includes("1 tab")) {
      this._config.INDENT = "\t"; // 1 tab
      this._config.INDENT_STYLE = "1 tab";
    } else {
      this._config.INDENT = "  "; // 2 spaces (default)
      this._config.INDENT_STYLE = "2 spaces";
    }
    
    // Play style
    const playStyles = [
      "single-set (turn-based, one player at a time, e.g. Tic-Tac-Toe)",
      "multi-set (all players can move simultaneously, e.g. Rock-Paper-Scissors)", 
      "multi-subset (turn-based, a subset of players at a time, e.g. team-based 2p vs. 2p)",
      "non-blocking (continuous action, game implementation decides how to handle turns, e.g. advanced Dungeon Crawler like game)"
    ];
    const playStyleChoice = await this.askChoice("What play style will your game use?", playStyles);
    this._config.PLAY_STYLE = playStyleChoice.split(" ")[0];
    this._config.PLAY_STYLE_SINGLE_SET = this._config.PLAY_STYLE === "single-set";
    
    // Multiplayer support
    this._config.IS_MULTIPLAYER = await this.askYesNo("Will this be a multiplayer game?");
    if (this._config.IS_MULTIPLAYER) {
      let maxPlayers;
      do {
        maxPlayers = await this.askQuestion("Maximum number of players (2-8): ");
        maxPlayers = parseInt(maxPlayers);
        if (maxPlayers >= 2 && maxPlayers <= 8) {
          this._config.MAX_PLAYERS = maxPlayers;
          break;
        }
        console.log("Please enter a number between 2 and 8.");
      } while (true);
    } else {
      this._config.MAX_PLAYERS = 1;
    }
    
    // Grid/Board configuration
    this._config.IS_SCROLLABLE = await this.askYesNo("Will your game have a scrollable/large grid?");
    
    if (this._config.IS_SCROLLABLE) {
      let width, height;
      do {
        width = await this.askQuestion("Default grid width (3-50): ");
        width = parseInt(width);
        if (width >= 3 && width <= 50) {
          this._config.DEFAULT_GRID_WIDTH = width;
          break;
        }
        console.log("Please enter a number between 3 and 50.");
      } while (true);
      
      do {
        height = await this.askQuestion("Default grid height (3-50): ");
        height = parseInt(height);
        if (height >= 3 && height <= 50) {
          this._config.DEFAULT_GRID_HEIGHT = height;
          break;
        }
        console.log("Please enter a number between 3 and 50.");
      } while (true);
      
      // Advanced tilemap features
      const tilemapChoices = [
        "basic-scrollable (all players share the same view of the game world)",
        "viewport-based (each player has their own independent view, enables fog-of-war and exploration)"
      ];
      const tilemapChoice = await this.askChoice("What type of scrollable grid implementation?", tilemapChoices);
      this._config.USE_VIEWPORTS = tilemapChoice.includes("viewport-based");
      this._config.USE_SCROLLABLE_TILEMAP = true;
      
      if (this._config.USE_VIEWPORTS) {
        let viewportWidth, viewportHeight;
        do {
          viewportWidth = await this.askQuestion("Default viewport width (any positive integer): ");
          viewportWidth = parseInt(viewportWidth);
          if (viewportWidth > 0 && Number.isInteger(viewportWidth)) {
            this._config.DEFAULT_VIEWPORT_WIDTH = viewportWidth;
            break;
          }
          console.log("Please enter a positive integer.");
        } while (true);
        
        do {
          viewportHeight = await this.askQuestion("Default viewport height (any positive integer): ");
          viewportHeight = parseInt(viewportHeight);
          if (viewportHeight > 0 && Number.isInteger(viewportHeight)) {
            this._config.DEFAULT_VIEWPORT_HEIGHT = viewportHeight;
            break;
          }
          console.log("Please enter a positive integer.");
        } while (true);
        
        this._config.VIEWPORT_AUTO_FOLLOW = await this.askYesNo("Should viewports automatically follow player movement?");
      }
    } else {
      let size;
      do {
        size = await this.askQuestion("Default grid size (any positive integer): ");
        size = parseInt(size);
        if (size > 0 && Number.isInteger(size)) {
          this._config.DEFAULT_GRID_WIDTH = size;
          this._config.DEFAULT_GRID_HEIGHT = size;
          break;
        }
        console.log("Please enter a positive integer.");
      } while (true);
      
      this._config.USE_VIEWPORTS = false;
      this._config.USE_SCROLLABLE_TILEMAP = false;
    }
    
    // Game State Machine recommendation
    console.log("\\n🧠 Game Complexity Assessment");
    console.log("Advanced games often benefit from a Game State Machine (GSM) for managing:");
    console.log("  • Multiple screens/phases (menu, gameplay, pause, game over)");
    console.log("  • Complex transitions (intro sequences, cutscenes)");
    console.log("  • Inventory/character management");
    console.log("  • Game scenes and pause/resume functionality");
    console.log("  • Multiple game modes or states");
    console.log("\\nSimple games typically use procedural code:");
    console.log("  • Single gameplay screen");
    console.log("  • Direct game logic without complex state management");
    console.log("  • Minimal transitions between screens");
    
    const complexity = await this.askChoice("How complex will your game be?", [
      "Simple (single screen, minimal transitions, basic game flow)",
      "Moderate (some additional screens like pause/settings, basic transitions)",
      "Complex (multiple game phases, advanced transitions, inventory/character systems)"
    ]);
    
    // Recommend GSM based on complexity but let user choose
    let recommendGSM = false;
    if (complexity.includes("Complex")) {
      recommendGSM = true;
      console.log("\\n💡 Based on your complexity choice, we RECOMMEND using the Game State Machine!");
    } else if (complexity.includes("Moderate")) {
      console.log("\\n💡 Based on your complexity choice, you MAY benefit from the Game State Machine.");
    } else {
      console.log("\\n💡 Based on your complexity choice, procedural code is likely sufficient, but you can still use GSM if desired.");
    }
    
    console.log("\\n📖 The Game State Machine (GSM) provides:");
    console.log("  • Structured state management (MenuState, GameplayState, PauseState, etc.)");
    console.log("  • Clean transitions between game phases");
    console.log("  • Built-in pause/resume functionality");
    console.log("  • Event handling per state");
    console.log("  • Easy to extend and maintain");
    console.log("\\n📖 Procedural approach provides:");
    console.log("  • Simpler, direct code flow");
    console.log("  • Less abstraction");
    console.log("  • Faster development for simple games");
    
    const defaultGSMChoice = recommendGSM ? "y" : "n";
    const gsmAnswer = await this.askQuestion(`Would you like to use the Game State Machine? ${recommendGSM ? "(RECOMMENDED) " : ""}(y/n) [${defaultGSMChoice}]: `);
    this._config.USE_STATE_MACHINE = (gsmAnswer.toLowerCase() === "y" || gsmAnswer.toLowerCase() === "yes") || 
                                   (gsmAnswer.trim() === "" && recommendGSM);
    
    if (this._config.USE_STATE_MACHINE) {
      console.log("✅ Game State Machine will be enabled in your GameEngine configuration.");
    } else {
      console.log("📝 Your game will use procedural code approach.");
    }
    
    // Game interaction type
    const gameTypes = [
      "piece-placement (players place pieces on the board, e.g., Tic-Tac-Toe, Chess, Connect Four)",
      "character-movement (players move a character around, e.g., adventure games, strategy games)",
      "other (custom interaction model)"
    ];
    const gameTypeChoice = await this.askChoice("What type of game interaction does your game use?", gameTypes);
    this._config.GAME_INTERACTION_TYPE = gameTypeChoice.split(" ")[0];
    this._config.USES_PIECES = this._config.GAME_INTERACTION_TYPE === "piece-placement";
    
    if (this._config.USES_PIECES) {
      this._config.GAME_PIECE_TYPE = await this.askQuestion(`What type of game pieces will players place? (e.g., "stone", "piece", "card"): `);
    } else if (this._config.GAME_INTERACTION_TYPE === "character-movement") {
      this._config.GAME_PIECE_TYPE = "character";
    } else {
      this._config.GAME_PIECE_TYPE = await this.askQuestion(`What will players interact with in your game? (e.g., "units", "tokens", "cards"): `);
    }
    
    // Additional features
    this._config.HAS_PLAYER_SCORE = await this.askYesNo("Will players have scores?");
    this._config.HAS_PLAYER_RESOURCES = await this.askYesNo("Will players have resources (coins, energy, etc.)?");
    
    // Only ask about piece values if the game uses pieces
    if (this._config.USES_PIECES) {
      this._config.HAS_PIECE_VALUE = await this.askYesNo("Will game pieces have different values?");
    } else {
      this._config.HAS_PIECE_VALUE = false; // No pieces = no piece values
    }
    
    this._config.HAS_SPECIAL_ACTIONS = await this.askYesNo("Will the game have special actions beyond basic moves? (e.g., power-ups, abilities, card plays)");
    this._config.HAS_INACTIVITY = await this.askYesNo("Should the game handle player inactivity timeouts?");
    this._config.SUPPORTS_AI = await this.askYesNo("Should the game support computer opponents (AI)?");
    this._config.SUPPORTS_SPECTATORS = await this.askYesNo("Should the game support spectators?");
    this._config.HAS_DATABASE = await this.askYesNo("Will your game need database integration?");
    this._config.HAS_EXTERNAL_API = await this.askYesNo("Will your game need external API integration?");
    
    // Generate secure token for game authentication
    this._config.GAME_TOKEN_SECRET_KEY = this.generateSecureToken();
    
    return this._config;
  }

  // Display configuration summary
  displaySummary() {
    console.log("\\n📋 Game Configuration Summary:");
    console.log("===============================");
    console.log(`Game Name: ${this._config.GAME_NAME}`);
    console.log(`File Names: ${this._config.GAME_SHORT_NAME} (kebab-case)`);
    console.log(`Code Names: ${this._config.GAME_CAMEL_NAME}Router, ${this._config.GAME_CLASS_NAME}Game`);
    console.log(`Directory: backend-${this._config.GAME_SHORT_NAME}`);
    console.log(`Indentation: ${this._config.INDENT_STYLE}`);
    console.log(`Play Style: ${this._config.PLAY_STYLE}`);
    console.log(`Multiplayer: ${this._config.IS_MULTIPLAYER ? "Yes" : "No"}`);
    if (this._config.IS_MULTIPLAYER) {
      console.log(`Max Players: ${this._config.MAX_PLAYERS}`);
    }
    console.log(`Scrollable Grid: ${this._config.IS_SCROLLABLE ? "Yes" : "No"}`);
    if (this._config.IS_SCROLLABLE) {
      console.log(`Grid Size: ${this._config.DEFAULT_GRID_WIDTH} x ${this._config.DEFAULT_GRID_HEIGHT}`);
      console.log(`Tilemap Type: ${this._config.USE_VIEWPORTS ? "Viewport-based" : "Basic scrollable"}`);
      if (this._config.USE_VIEWPORTS) {
        console.log(`Viewport Size: ${this._config.DEFAULT_VIEWPORT_WIDTH} x ${this._config.DEFAULT_VIEWPORT_HEIGHT}`);
        console.log(`Auto-follow: ${this._config.VIEWPORT_AUTO_FOLLOW ? "Yes" : "No"}`);
      }
    } else {
      console.log(`Grid Size: ${this._config.DEFAULT_GRID_WIDTH} x ${this._config.DEFAULT_GRID_WIDTH}`);
    }
    console.log(`Game Interaction: ${this._config.GAME_INTERACTION_TYPE}`);
    if (this._config.USES_PIECES) {
      console.log(`Game Piece Type: ${this._config.GAME_PIECE_TYPE}`);
    } else {
      console.log(`Player Interaction: ${this._config.GAME_PIECE_TYPE}`);
    }
    console.log(`Features:`);
    console.log(`  - Player Scores: ${this._config.HAS_PLAYER_SCORE ? "Yes" : "No"}`);
    console.log(`  - Player Resources: ${this._config.HAS_PLAYER_RESOURCES ? "Yes" : "No"}`);
    console.log(`  - Piece Values: ${this._config.HAS_PIECE_VALUE ? "Yes" : "No"}`);
    console.log(`  - Special Actions: ${this._config.HAS_SPECIAL_ACTIONS ? "Yes" : "No"}`);
    console.log(`  - Inactivity Handling: ${this._config.HAS_INACTIVITY ? "Yes" : "No"}`);
    console.log(`  - Computer Opponents (AI): ${this._config.SUPPORTS_AI ? "Yes" : "No"}`);
    console.log(`  - Spectator Support: ${this._config.SUPPORTS_SPECTATORS ? "Yes" : "No"}`);
    console.log(`  - Database: ${this._config.HAS_DATABASE ? "Yes" : "No"}`);
    console.log(`  - External API: ${this._config.HAS_EXTERNAL_API ? "Yes" : "No"}`);
  }

  // Process template file with mustache-like syntax
  processTemplate(content, config) {
    let result = content;
    
    // Replace simple variables
    Object.keys(config).forEach(key => {
      const value = config[key];
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      result = result.replace(regex, value);
    });
    
    // Handle conditional blocks
    Object.keys(config).forEach(key => {
      const value = config[key];
      
      // Positive conditionals {{#KEY}}...{{/KEY}}
      const positiveRegex = new RegExp(`{{#\\s*${key}\\s*}}([\\s\\S]*?){{/\\s*${key}\\s*}}`, "g");
      if (value) {
        result = result.replace(positiveRegex, "$1");
      } else {
        result = result.replace(positiveRegex, "");
      }
      
      // Negative conditionals {{^KEY}}...{{/KEY}}
      const negativeRegex = new RegExp(`{{\\^\\s*${key}\\s*}}([\\s\\S]*?){{/\\s*${key}\\s*}}`, "g");
      if (!value) {
        result = result.replace(negativeRegex, "$1");
      } else {
        result = result.replace(negativeRegex, "");
      }
    });
    
    // Comprehensive cleanup to fix formatting and spacing issues
    
    // Step 1: Clean up conditional block artifacts and fix indentation
    // Remove empty lines that result from removed conditional blocks
    result = result.replace(/\n\s*\n\s*\n/g, "\n\n"); // Triple newlines → double
    result = result.replace(/^\s*$\n/gm, ""); // Remove whitespace-only lines
    
    // Step 2: Fix indentation issues from conditional processing
    // Normalize indentation by removing leading/trailing whitespace from each line and re-indenting
    const lines = result.split("\n");
    const processedLines = [];
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines for now, we'll handle spacing later
      if (trimmedLine === "") {
        processedLines.push("");
        continue;
      }
      
      // Adjust indent level based on braces
      if (trimmedLine.includes("}") && !trimmedLine.includes("{")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Apply proper indentation (2 spaces per level)
      const indent = "  ".repeat(indentLevel);
      processedLines.push(indent + trimmedLine);
      
      // Increase indent level after opening braces
      if (trimmedLine.includes("{") && !trimmedLine.includes("}")) {
        indentLevel++;
      }
    }
    
    result = processedLines.join("\n");
    
    // Step 3: Replace {{NEWLINE}} placeholders with actual empty lines
    result = result.replace(/\{\{NEWLINE\}\}/g, "\n");
    
    // Step 4: Replace {{INDENT}} placeholders with chosen indentation
    result = result.replace(/\{\{INDENT\}\}/g, config.INDENT);
    
    // Step 5: Final cleanup
    // Remove excessive blank lines (more than 2 consecutive)
    result = result.replace(/(\n\s*){3,}/g, "\n\n");
    // Ensure file ends with single newline
    result = result.replace(/\n*$/, "\n");
    
    return result;
  }

  // Generate files from templates
  async generateFiles() {
    const gameDir = `backend-${this._config.GAME_SHORT_NAME}`;
    const routeDir = path.join(gameDir, "route");
    const entityDir = path.join(gameDir, "game-entity");
    
    try {
      // Create directories
      console.log(`\n📁 Creating directory: ${gameDir}`);
      fs.mkdirSync(gameDir, { recursive: true });
      fs.mkdirSync(routeDir, { recursive: true });
      fs.mkdirSync(entityDir, { recursive: true });
      
      // Generate game.js (main game file)
      console.log(`📄 Generating: ${gameDir}/${this._config.GAME_SHORT_NAME}.js`);
      const gameTemplate = fs.readFileSync(path.join(this._templateDir, "game.js.template"), "utf8");
      const gameContent = this.processTemplate(gameTemplate, this._config);
      fs.writeFileSync(path.join(gameDir, `${this._config.GAME_SHORT_NAME}.js`), gameContent);
      
      // Generate player-entity.js
      console.log(`📄 Generating: ${entityDir}/player-entity.js`);
      const playerTemplate = fs.readFileSync(path.join(this._templateDir, "player-entity.js.template"), "utf8");
      const playerContent = this.processTemplate(playerTemplate, this._config);
      fs.writeFileSync(path.join(entityDir, "player-entity.js"), playerContent);
      
      // Generate routes.js
      console.log(`📄 Generating: ${routeDir}/${this._config.GAME_SHORT_NAME}-routes.js`);
      const routesTemplate = fs.readFileSync(path.join(this._templateDir, "routes.js.template"), "utf8");
      const routesContent = this.processTemplate(routesTemplate, this._config);
      fs.writeFileSync(path.join(routeDir, `${this._config.GAME_SHORT_NAME}-routes.js`), routesContent);
      
      // Generate game-server.js (complete server file)
      console.log(`📄 Generating: ${gameDir}/game-server.js`);
      const gameServerTemplate = fs.readFileSync(path.join(this._templateDir, "game-server.js.template"), "utf8");
      const gameServerContent = this.processTemplate(gameServerTemplate, this._config);
      fs.writeFileSync(path.join(gameDir, "game-server.js"), gameServerContent);
      
      // Generate .env file if it doesn't exist
      if (!fs.existsSync(".env")) {
        console.log("📄 Generating: .env");
        const envTemplate = fs.readFileSync(path.join(this._templateDir, "env.template"), "utf8");
        const envContent = this.processTemplate(envTemplate, this._config);
        fs.writeFileSync(".env", envContent);
      } else {
        console.log("⚠️  .env already exists - skipping (use .env.example as reference)");
      }
      
      // Generate .env.example file if it doesn't exist
      if (!fs.existsSync(".env.example")) {
        console.log("📄 Generating: .env.example");
        const envExampleTemplate = fs.readFileSync(path.join(this._templateDir, "env.example.template"), "utf8");
        const envExampleContent = this.processTemplate(envExampleTemplate, this._config);
        fs.writeFileSync(".env.example", envExampleContent);
      } else {
        console.log("⚠️  .env.example already exists - skipping");
      }
      
      return true;
    } catch (error) {
      console.error("❌ Error generating files:", error.message);
      return false;
    }
  }

  // Main setup process
  async setup() {
    try {
      await this.collectGameInfo();
      
      this.displaySummary();
      
      // Check for conflicts
      const conflicts = this.checkConflicts();
      if (conflicts.length > 0) {
        console.log("\n⚠️  Potential conflicts detected:");
        conflicts.forEach(conflict => console.log(`  - ${conflict}`));
        
        const proceed = await this.askYesNo("\nDo you want to proceed? (existing files will be preserved)");
        if (!proceed) {
          console.log("\n❌ Setup cancelled.");
          return;
        }
      }
      
      const confirm = await this.askYesNo("\nConfirm and generate game files?");
      if (!confirm) {
        console.log("\n❌ Setup cancelled.");
        return;
      }
      
      console.log("\n🚀 Generating game files...");
      const success = await this.generateFiles();
      
      if (success) {
        console.log("\n✅ Game setup completed successfully!");
        
        // Show generated folder structure
        console.log(`\n📁 Generated Folder Structure:`);
        console.log(`backend-${this._config.GAME_SHORT_NAME}/`);
        console.log(`├── game-server.js                    # Complete Express server`);
        console.log(`├── ${this._config.GAME_SHORT_NAME}.js              # Main game logic (${this._config.GAME_CLASS_NAME}Game class)`);
        console.log(`├── route/`);
        console.log(`│   └── ${this._config.GAME_SHORT_NAME}-routes.js   # API routes (${this._config.GAME_CAMEL_NAME}Router)`);
        console.log(`└── game-entity/`);
        console.log(`    └── player-entity.js             # Player entity class`);
        if (!fs.existsSync(".env")) {
          console.log(`\n.env                                 # Environment configuration`);
        }
        if (!fs.existsSync(".env.example")) {
          console.log(`.env.example                         # Environment template`);
        }
        
        console.log(`\n📝 Next steps:`);
        console.log(`   1. Implement your game logic in backend-${this._config.GAME_SHORT_NAME}/${this._config.GAME_SHORT_NAME}.js`);
        console.log(`   2. Customize the win condition in the checkWinCondition method`);
        console.log(`   3. Add your game to the main server by importing and registering it`);
        console.log(`   4. Test your game using the generated routes`);
        
        let stepCounter = 5;
        if (this._config.HAS_SPECIAL_ACTIONS) {
          console.log(`   ${stepCounter}. Implement special actions in the routes file`);
          stepCounter++;
        }
        if (this._config.SUPPORTS_AI) {
          console.log(`   ${stepCounter}. Implement AI logic in the calculateComputerMove method`);
          stepCounter++;
        }
        if (this._config.SUPPORTS_SPECTATORS) {
          console.log(`   ${stepCounter}. Customize spectator view in getSpectatorView method`);
          stepCounter++;
        }
        
        console.log(`\n🎮 Happy game development!`);
      }
      
    } catch (error) {
      console.error("❌ Setup failed:", error.message);
    } finally {
      rl.close();
    }
  }
}

// Run the setup wizard
const wizard = new GameSetupWizard();
wizard.setup();
