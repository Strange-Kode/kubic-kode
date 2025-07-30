#!/usr/bin/env node

/**
 * Game Setup Script
 * 
 * This script asks questions to configure and generate a new game from templates.
 * It creates all necessary server-side files for a new game.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class GameSetupWizard {
  constructor() {
    this.config = {};
    this.templateDir = path.join(__dirname, 'template');
    this.conflicts = [];
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
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
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
    }).replace(/\s+/g, '');
  }

  // Convert to PascalCase (removes spaces and capitalizes each word)
  toPascalCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
      return word.toUpperCase();
    }).replace(/\s+/g, '');
  }

  // Convert to kebab-case (spaces become hyphens, lowercase)
  toKebabCase(str) {
    return str.trim().replace(/\s+/g, '-').toLowerCase();
  }

  // Check for file conflicts
  checkConflicts() {
    this.conflicts = [];
    const gameDir = `backend-${this.toKebabCase(this.config.GAME_NAME)}`;
    
    // Check if backend directory exists
    if (fs.existsSync(gameDir)) {
      this.conflicts.push(`Directory: ${gameDir}/`);
    }

    // Check if .env files exist
    if (!fs.existsSync('.env')) {
      // No conflict for .env - we'll create it
    } else {
      this.conflicts.push('File: .env (will be updated, not overwritten)');
    }

    if (!fs.existsSync('.env.example')) {
      // No conflict for .env.example - we'll create it
    } else {
      this.conflicts.push('File: .env.example (will be updated, not overwritten)');
    }

    return this.conflicts;
  }

  // Collect all necessary information
  async collectGameInfo() {
    console.log("\\n🎮 Welcome to the Game Setup Wizard!");
    console.log("====================================\\n");
    
    // Game name
    this.config.GAME_NAME = await this.askQuestion("What is the name of your game? (e.g., 'Chess', 'Connect Four'): ");
    this.config.GAME_SHORT_NAME = this.toKebabCase(this.config.GAME_NAME);
    this.config.GAME_CAMEL_NAME = this.toCamelCase(this.config.GAME_NAME);
    this.config.GAME_CLASS_NAME = this.toPascalCase(this.config.GAME_NAME);
    
    // Play style
    const playStyles = [
      "single-set (turn-based, one player at a time, e.g. Tic-Tac-Toe)",
      "multi-set (all players can move simultaneously, e.g. Rock-Paper-Scissors)", 
      "non-blocking (continuous action, game implementation decides how to handle turns)"
    ];
    const playStyleChoice = await this.askChoice("What play style will your game use?", playStyles);
    this.config.PLAY_STYLE = playStyleChoice.split(' ')[0];
    this.config.PLAY_STYLE_SINGLE_SET = this.config.PLAY_STYLE === "single-set";
    
    // Multiplayer support
    this.config.IS_MULTIPLAYER = await this.askYesNo("Will this be a multiplayer game?");
    if (this.config.IS_MULTIPLAYER) {
      let maxPlayers;
      do {
        maxPlayers = await this.askQuestion("Maximum number of players (2-8): ");
        maxPlayers = parseInt(maxPlayers);
        if (maxPlayers >= 2 && maxPlayers <= 8) {
          this.config.MAX_PLAYERS = maxPlayers;
          break;
        }
        console.log("Please enter a number between 2 and 8.");
      } while (true);
    } else {
      this.config.MAX_PLAYERS = 1;
    }
    
    // Grid/Board configuration
    this.config.IS_SCROLLABLE = await this.askYesNo("Will your game have a scrollable/large grid?");
    
    if (this.config.IS_SCROLLABLE) {
      let width, height;
      do {
        width = await this.askQuestion("Default grid width (3-50): ");
        width = parseInt(width);
        if (width >= 3 && width <= 50) {
          this.config.DEFAULT_GRID_WIDTH = width;
          break;
        }
        console.log("Please enter a number between 3 and 50.");
      } while (true);
      
      do {
        height = await this.askQuestion("Default grid height (3-50): ");
        height = parseInt(height);
        if (height >= 3 && height <= 50) {
          this.config.DEFAULT_GRID_HEIGHT = height;
          break;
        }
        console.log("Please enter a number between 3 and 50.");
      } while (true);
    } else {
      let size;
      do {
        size = await this.askQuestion("Default grid size (any positive integer): ");
        size = parseInt(size);
        if (size > 0 && Number.isInteger(size)) {
          this.config.DEFAULT_GRID_WIDTH = size;
          this.config.DEFAULT_GRID_HEIGHT = size;
          break;
        }
        console.log("Please enter a positive integer.");
      } while (true);
    }
    
    // Game piece type
    this.config.GAME_PIECE_TYPE = await this.askQuestion("What type of game pieces will players place? (e.g., 'stone', 'piece', 'card'): ");
    
    // Additional features
    this.config.HAS_PLAYER_SCORE = await this.askYesNo("Will players have scores?");
    this.config.HAS_PLAYER_RESOURCES = await this.askYesNo("Will players have resources (coins, energy, etc.)?");
    this.config.HAS_PIECE_VALUE = await this.askYesNo("Will game pieces have different values?");
    this.config.HAS_SPECIAL_ACTIONS = await this.askYesNo("Will the game have special actions beyond basic moves? (e.g., power-ups, abilities, card plays)");
    this.config.HAS_INACTIVITY = await this.askYesNo("Should the game handle player inactivity timeouts?");
    this.config.HAS_DATABASE = await this.askYesNo("Will your game need database integration?");
    this.config.HAS_EXTERNAL_API = await this.askYesNo("Will your game need external API integration?");
    
    return this.config;
  }

  // Display configuration summary
  displaySummary() {
    console.log("\\n📋 Game Configuration Summary:");
    console.log("===============================");
    console.log(`Game Name: ${this.config.GAME_NAME}`);
    console.log(`File Names: ${this.config.GAME_SHORT_NAME} (kebab-case)`);
    console.log(`Code Names: ${this.config.GAME_CAMEL_NAME}Router, ${this.config.GAME_CLASS_NAME}Game`);
    console.log(`Directory: backend-${this.config.GAME_SHORT_NAME}`);
    console.log(`Play Style: ${this.config.PLAY_STYLE}`);
    console.log(`Multiplayer: ${this.config.IS_MULTIPLAYER ? 'Yes' : 'No'}`);
    if (this.config.IS_MULTIPLAYER) {
      console.log(`Max Players: ${this.config.MAX_PLAYERS}`);
    }
    console.log(`Scrollable Grid: ${this.config.IS_SCROLLABLE ? 'Yes' : 'No'}`);
    if (this.config.IS_SCROLLABLE) {
      console.log(`Grid Size: ${this.config.DEFAULT_GRID_WIDTH} x ${this.config.DEFAULT_GRID_HEIGHT}`);
    } else {
      console.log(`Grid Size: ${this.config.DEFAULT_GRID_WIDTH} x ${this.config.DEFAULT_GRID_WIDTH}`);
    }
    console.log(`Game Piece Type: ${this.config.GAME_PIECE_TYPE}`);
    console.log(`Features:`);
    console.log(`  - Player Scores: ${this.config.HAS_PLAYER_SCORE ? 'Yes' : 'No'}`);
    console.log(`  - Player Resources: ${this.config.HAS_PLAYER_RESOURCES ? 'Yes' : 'No'}`);
    console.log(`  - Piece Values: ${this.config.HAS_PIECE_VALUE ? 'Yes' : 'No'}`);
    console.log(`  - Special Actions: ${this.config.HAS_SPECIAL_ACTIONS ? 'Yes' : 'No'}`);
    console.log(`  - Inactivity Handling: ${this.config.HAS_INACTIVITY ? 'Yes' : 'No'}`);
    console.log(`  - Database: ${this.config.HAS_DATABASE ? 'Yes' : 'No'}`);
    console.log(`  - External API: ${this.config.HAS_EXTERNAL_API ? 'Yes' : 'No'}`);
  }

  // Process template file with mustache-like syntax
  processTemplate(content, config) {
    let result = content;
    
    // Replace simple variables
    Object.keys(config).forEach(key => {
      const value = config[key];
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    });
    
    // Handle conditional blocks
    Object.keys(config).forEach(key => {
      const value = config[key];
      
      // Positive conditionals {{#KEY}}...{{/KEY}}
      const positiveRegex = new RegExp(`{{#\\s*${key}\\s*}}([\\s\\S]*?){{/\\s*${key}\\s*}}`, 'g');
      if (value) {
        result = result.replace(positiveRegex, '$1');
      } else {
        result = result.replace(positiveRegex, '');
      }
      
      // Negative conditionals {{^KEY}}...{{/KEY}}
      const negativeRegex = new RegExp(`{{\\^\\s*${key}\\s*}}([\\s\\S]*?){{/\\s*${key}\\s*}}`, 'g');
      if (!value) {
        result = result.replace(negativeRegex, '$1');
      } else {
        result = result.replace(negativeRegex, '');
      }
    });
    
    // Comprehensive cleanup to fix formatting and spacing issues
    
    // Step 1: Clean up conditional block artifacts and fix indentation
    // Remove empty lines that result from removed conditional blocks
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n'); // Triple newlines → double
    result = result.replace(/^\s*$\n/gm, ''); // Remove whitespace-only lines
    
    // Step 2: Fix indentation issues from conditional processing
    // Normalize indentation by removing leading/trailing whitespace from each line and re-indenting
    const lines = result.split('\n');
    const processedLines = [];
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines for now, we'll handle spacing later
      if (trimmedLine === '') {
        processedLines.push('');
        continue;
      }
      
      // Adjust indent level based on braces
      if (trimmedLine.includes('}') && !trimmedLine.includes('{')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      // Apply proper indentation (2 spaces per level)
      const indent = '  '.repeat(indentLevel);
      processedLines.push(indent + trimmedLine);
      
      // Increase indent level after opening braces
      if (trimmedLine.includes('{') && !trimmedLine.includes('}')) {
        indentLevel++;
      }
    }
    
    result = processedLines.join('\n');
    
    // Step 3: Add proper spacing between methods and major code blocks
    // Add blank line before method declarations
    result = result.replace(/(\n  )([a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{)/g, '$1\n$2');
    // Add blank line before class declarations
    result = result.replace(/(\n)(class\s+\w+)/g, '$1\n$2');
    // Add blank line before constructor
    result = result.replace(/(\n  )(constructor\s*\()/g, '$1\n$2');
    // Add blank line before comments that precede methods
    result = result.replace(/(\n  )(\/\/\s*[A-Z])/g, '$1\n$2');
    
    // Step 4: Final cleanup
    // Remove excessive blank lines (more than 2 consecutive)
    result = result.replace(/(\n\s*){3,}/g, '\n\n');
    // Ensure file ends with single newline
    result = result.replace(/\n*$/, '\n');
    
    return result;
  }

  // Generate files from templates
  async generateFiles() {
    const gameDir = `backend-${this.config.GAME_SHORT_NAME}`;
    const routeDir = path.join(gameDir, 'route');
    const entityDir = path.join(gameDir, 'game-entity');
    
    try {
      // Create directories
      console.log(`\n📁 Creating directory: ${gameDir}`);
      fs.mkdirSync(gameDir, { recursive: true });
      fs.mkdirSync(routeDir, { recursive: true });
      fs.mkdirSync(entityDir, { recursive: true });
      
      // Generate game.js (main game file)
      console.log(`📄 Generating: ${gameDir}/${this.config.GAME_SHORT_NAME}.js`);
      const gameTemplate = fs.readFileSync(path.join(this.templateDir, 'game.js.template'), 'utf8');
      const gameContent = this.processTemplate(gameTemplate, this.config);
      fs.writeFileSync(path.join(gameDir, `${this.config.GAME_SHORT_NAME}.js`), gameContent);
      
      // Generate player-entity.js
      console.log(`📄 Generating: ${entityDir}/player-entity.js`);
      const playerTemplate = fs.readFileSync(path.join(this.templateDir, 'player-entity.js.template'), 'utf8');
      const playerContent = this.processTemplate(playerTemplate, this.config);
      fs.writeFileSync(path.join(entityDir, 'player-entity.js'), playerContent);
      
      // Generate routes.js
      console.log(`📄 Generating: ${routeDir}/${this.config.GAME_SHORT_NAME}-routes.js`);
      const routesTemplate = fs.readFileSync(path.join(this.templateDir, 'routes.js.template'), 'utf8');
      const routesContent = this.processTemplate(routesTemplate, this.config);
      fs.writeFileSync(path.join(routeDir, `${this.config.GAME_SHORT_NAME}-routes.js`), routesContent);
      
      // Generate game-server.js (complete server file)
      console.log(`📄 Generating: ${gameDir}/game-server.js`);
      const gameServerTemplate = fs.readFileSync(path.join(this.templateDir, 'game-server.js.template'), 'utf8');
      const gameServerContent = this.processTemplate(gameServerTemplate, this.config);
      fs.writeFileSync(path.join(gameDir, 'game-server.js'), gameServerContent);
      
      // Generate .env file if it doesn't exist
      if (!fs.existsSync('.env')) {
        console.log('📄 Generating: .env');
        const envTemplate = fs.readFileSync(path.join(this.templateDir, 'env.template'), 'utf8');
        const envContent = this.processTemplate(envTemplate, this.config);
        fs.writeFileSync('.env', envContent);
      } else {
        console.log('⚠️  .env already exists - skipping (use .env.example as reference)');
      }
      
      // Generate .env.example file if it doesn't exist
      if (!fs.existsSync('.env.example')) {
        console.log('📄 Generating: .env.example');
        const envExampleTemplate = fs.readFileSync(path.join(this.templateDir, 'env.example.template'), 'utf8');
        const envExampleContent = this.processTemplate(envExampleTemplate, this.config);
        fs.writeFileSync('.env.example', envExampleContent);
      } else {
        console.log('⚠️  .env.example already exists - skipping');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error generating files:', error.message);
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
        console.log(`backend-${this.config.GAME_SHORT_NAME}/`);
        console.log(`├── game-server.js                    # Complete Express server`);
        console.log(`├── ${this.config.GAME_SHORT_NAME}.js              # Main game logic (${this.config.GAME_CLASS_NAME}Game class)`);
        console.log(`├── route/`);
        console.log(`│   └── ${this.config.GAME_SHORT_NAME}-routes.js   # API routes (${this.config.GAME_CAMEL_NAME}Router)`);
        console.log(`└── game-entity/`);
        console.log(`    └── player-entity.js             # Player entity class`);
        if (!fs.existsSync('.env')) {
          console.log(`\n.env                                 # Environment configuration`);
        }
        if (!fs.existsSync('.env.example')) {
          console.log(`.env.example                         # Environment template`);
        }
        
        console.log(`\n📝 Next steps:`);
        console.log(`   1. Implement your game logic in backend-${this.config.GAME_SHORT_NAME}/${this.config.GAME_SHORT_NAME}.js`);
        console.log(`   2. Customize the win condition in the checkWinCondition method`);
        console.log(`   3. Add your game to the main server by importing and registering it`);
        console.log(`   4. Test your game using the generated routes`);
        
        if (this.config.HAS_SPECIAL_ACTIONS) {
          console.log(`   5. Implement special actions in the routes file`);
        }
        
        console.log(`\n🎮 Happy game development!`);
      }
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
    } finally {
      rl.close();
    }
  }
}

// Run the setup wizard
const wizard = new GameSetupWizard();
wizard.setup();