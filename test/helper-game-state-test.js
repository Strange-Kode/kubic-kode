/**
 * KubicKode helper game-state unit test
 *
 * Exercises turn ownership and player resolution in isolation - no server
 * needed. Participant ids (session) and player ids (engine) are separate id
 * spaces that often coincide numerically; these tests pin the mapping-based
 * behavior for the cases where they do not.
 */

import { pathToFileURL } from "url";

import { createGameState } from "../client/kubic-kode-helper/state/game-state.js";

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} - ${name}` +
      (ok ? "" : ` (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`)
  );
}

function makeHelper(participantId, participants) {
  return {
    participantId,
    events: { emit() {} },
    session: {
      participants,
      getParticipant: (id) => participants.find((p) => p.id === id),
    },
  };
}

function main() {
  // Non-coinciding ids: participant 7 is engine player 1.
  const participantsA = [
    { id: 7, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  const gameA = createGameState(makeHelper(7, participantsA));
  gameA.updateGame({ currentPlayerId: 1, playerMappings: { 7: 1, 2: 2 } });

  check("non-coinciding ids: participant 7 (player 1) is on turn", gameA.isMyTurn(), true);
  check(
    "getCurrentPlayer resolves player 1 -> participant 7",
    gameA.getCurrentPlayer()?.name,
    "Alice"
  );
  check(
    "getParticipantForPlayer resolves player 2 -> participant 2",
    gameA.getParticipantForPlayer(2)?.name,
    "Bob"
  );

  // Swapped mapping: participant 1 exists but is engine player 2. A direct
  // participant-vs-player id comparison would false-positive here.
  const participantsB = [
    { id: 1, name: "Carol" },
    { id: 2, name: "Dave" },
  ];
  const gameB = createGameState(makeHelper(1, participantsB));
  gameB.updateGame({ currentPlayerId: 1, playerMappings: { 1: 2, 2: 1 } });

  check("swapped mapping: participant 1 (player 2) is not on turn", gameB.isMyTurn(), false);
  check(
    "swapped mapping: player 1 resolves to participant 2",
    gameB.getCurrentPlayer()?.name,
    "Dave"
  );

  // Coinciding ids (the common happy path) still work.
  const gameC = createGameState(makeHelper(2, participantsA));
  gameC.updateGame({ currentPlayerId: 2, playerMappings: { 7: 1, 2: 2 } });
  check("coinciding ids: participant 2 (player 2) is on turn", gameC.isMyTurn(), true);

  // Pre-game: no mappings yet -> safe defaults.
  const gameD = createGameState(makeHelper(7, participantsA));
  check("no mappings: isMyTurn is false", gameD.isMyTurn(), false);
  check("no mappings: getCurrentPlayer is null", gameD.getCurrentPlayer(), null);
  check(
    "no current player: getParticipantForPlayer(null) is null",
    gameD.getParticipantForPlayer(null),
    null
  );

  // Unknown player id resolves to null rather than a wrong participant.
  check("unknown player id resolves to null", gameA.getParticipantForPlayer(99), null);

  // getState() composes the derived fields.
  const state = gameA.getState();
  check("getState().isMyTurn is wired", state.isMyTurn, true);
  check("getState().currentPlayer is wired", state.currentPlayer?.name, "Alice");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

// Run when executed directly.
// Compare against pathToFileURL(...).href, not a hand-built `file://` + path
// string: import.meta.url percent-encodes the path (spaces -> %20), so the raw
// string form never matches when the repo path contains a space.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
