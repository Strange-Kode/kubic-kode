# Contributing to kubic-kode

This document describes how kubic-kode is developed: how to get the project
running locally, and the branch, commit, and pull-request conventions the
project follows. If you are filing an issue or opening a PR, this is the
workflow to match.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- npm (ships with Node)
- Git

## Getting set up

```sh
git clone https://github.com/Strange-Kode/kubic-kode.git
cd kubic-kode
npm install
cp .env.example .env
```

Then open `.env` and set `KUBIC_GAME_TOKEN_SECRET_KEY` to a value of at least
32 characters. The server refuses to start without one.

## Running the server

```sh
npm run dev-server
```

This starts the backend with nodemon (auto-reload) and debug logging, listening
on port 3000 by default. Override the port with `KUBIC_PORT` in `.env`. For a
plain, non-watching start, use `npm run start-server`.

The server exposes HTTP and WebSocket endpoints at `http://localhost:3000`.
Consumer apps connect through the client helper in `client/kubic-kode-helper/`.

## Running tests

Run the suite before opening a pull request, and make sure it passes. The
end-to-end suites talk to a live server, so start one first:

```sh
npm run start-server   # terminal 1
npm test               # terminal 2
```

`npm test` runs three things in order:

| Script | What it covers | Needs a server |
|--------|----------------|----------------|
| `npm run test:unit` | `*.test.js` files under `client/` and `game-server/` (`node --test`) | no |
| `npm run test:tic-tac-toe` | full games against the built-in tic-tac-toe demo, over HTTP and WebSocket | yes |
| `npm run test:lobby` | session listing, auto-join, host, lobby config and chat | yes |

The end-to-end runners target `http://localhost:3000`. If your server runs on
another port, point them at it with `KUBIC_TEST_BASE_URL=http://localhost:<port>`
and `KUBIC_TEST_WS_URL=ws://localhost:<port>`. The shared HTTP/WebSocket test
utilities live in `test/e2e-test-runner.js`.

## Branch naming

Branch off `main`, named after the issue you're working on:
`<issue-number>-<short-kebab-description>`. The branch name is what ties the
work to its issue.

```
161-rebuild-client-readme
145-structured-json-logs
```

## Commit messages

There is no enforced commit-message format. Write clear, descriptive messages,
and use the body for any context worth keeping (rationale, file references,
related tickets).

## Pull requests

- Open PRs against `main`.
- Write a description that explains the *why*, not just the *what*, especially
  for design or architectural changes.
- Make sure the branch is up to date with `main` and `npm test` passes before
  requesting review.

## Filing issues

Open issues on the [GitHub tracker](https://github.com/Strange-Kode/kubic-kode/issues).
For bugs, include what you expected, what actually happened, and the steps to
reproduce. For features, describe the use case before the proposed solution.

## Code style

Match the style of the surrounding code.
