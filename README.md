# kubic-kode

**kubic-kode** is a modular 2D turn-based tilemap game engine, built for rapid development of grid-based games such as strategy, puzzle, and board games. It provides core abstractions for tilemaps, turn sequencing, and game state management.

The project features a Node.js/Express backend for multiplayer session handling and real-time communication via WebSockets, alongside a React-based frontend demo (e.g., tic-tac-toe) to illustrate integration and usage. kubic-kode is designed for extensibility, enabling developers to prototype and deploy custom turn-based games with minimal setup.

## Requirements

- [Node.js](https://nodejs.org/) (version 20.x or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Git (for cloning the repository)

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/Strange-Kode/kubic-kode.git
   cd kubic-kode
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy and configure the environment file for the React demo:
   ```sh
   cp client/demos/react-tic-tac-toe/.env.example client/demos/react-tic-tac-toe/.env
   # Edit client/demos/react-tic-tac-toe/.env as needed
   ```

## Usage

### Start the Backend
Run the backend server (default port: 3000):
```sh
npm run dev-server
```

### Start the Frontend Demo
In a separate terminal, start the React demo (default port: 3001):
```sh
npm run start-frontend
```

The frontend will be available at [http://localhost:3001](http://localhost:3001) and will communicate with the backend at [http://localhost:3000](http://localhost:3000).
