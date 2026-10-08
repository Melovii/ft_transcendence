# Testing Guide

Manual test recipes for every flow the frontend supports. Unless a recipe says
otherwise, run in full mock mode (`VITE_MOCK_API=true` and `VITE_MOCK_SOCKETS=true`,
see the [Frontend Developer Guide](../README.md#quick-start)). Accounts, room codes and
console commands are listed in [Mock System](MOCKS.md).

Conventions:

- "Console" means the browser DevTools console.
- `player_one` is you. Every seeded password is `codenames42`.
- Reload the page to return to the seed data.
- Check each screen at phone and desktop widths, and check that the console shows no
  errors.

## Fast Path to Any Game State

You do not need to play a whole match. From any room page:

```js
mockSockets.scenario('spymaster-turn'); // you are RED Spymaster, give a clue
mockSockets.scenario('operative-turn'); // you are RED Operative, guess
mockSockets.scenario('opponent-turn'); // BLUE is playing, you wait
mockSockets.scenario('game-over'); // RED won
mockSockets.scenario('assassin-loss'); // RED lost on the assassin
mockSockets.scenario('paused'); // staffing pause
mockSockets.scenario('spectating'); // you watch a match
mockSockets.scenario('spectator-claim'); // you can take a free seat
```

To get a room page: log in, click **Create Room**, confirm. The full scenario list is in
[Mock System › Scenarios](MOCKS.md#scenarios).

## Authentication

Start with `VITE_MOCK_AUTH=logged-out` and restart `npm run dev`.

### Successful login

1. Open `/`. Click **Log In** (or open `/login`).
2. Email `player.one@example.com`, password `codenames42`. Submit.
3. Expected: the Lobby opens; the header shows `player_one`.

### Invalid credentials

1. Log in with `player.one@example.com` and password `wrong-password`.
2. Expected: "Incorrect email or password". The dialog stays open.

### Registration and validation

1. Open `/register`.
2. Submit empty fields: client validation shows a message per field.
3. Use a username with a space, a password under 8 characters, or two different
   passwords: each shows its validation message.
4. Use the email `red.agent@example.com`: the server answers `EMAIL_TAKEN`.
5. Use a username already taken, for example `red_agent`: `USERNAME_TAKEN`.
6. Use new valid values: the account is created and the Lobby opens.

### Forced server errors

```js
mockApi.config.outcomes.login = 'server-error'; // 503
mockApi.config.outcomes.login = 'rate-limited'; // 429
mockApi.config.outcomes.login = 'network-error'; // fetch fails
```

Submit Log In after each line. Expected: an error message, no crash. Clear with
`mockApi.config.outcomes = {}`.

### Silent refresh

1. Logged in, run `mockApi.server.expireAccess()`.
2. Open the profile or any screen that calls REST.
3. Expected: nothing visible. The `401` triggers one refresh and the request retries.

Alternative: start with `VITE_MOCK_AUTH=session-expired`.

### Session revoked

1. Run `mockApi.server.revokeSession()`, then trigger any REST call.
2. Expected: the app returns to the Landing page. `/lobby` now redirects there.

### Protected routes

1. Logged out, open `/lobby` or `/room/1001`.
2. Expected: redirect to `/`.
3. Logged in, open `/login`: redirect to the Lobby.

### Log Out

1. Open the profile menu and choose **Log Out**. Confirm.
2. Expected: back on the Landing page.
3. In a running match the dialog warns that you leave the match. Use
   `mockSockets.scenario('operative-turn')` first to see it.

## Lobby and Rooms

### Create a room

1. In the Lobby, click **Create Room**. Change Max Players. Submit.
2. Expected: the room page opens with you as host and a 6-character room code.
3. A second create while in a room: force it with
   `mockApi.config.outcomes.createRoom = 'conflict'` to see `ALREADY_IN_ROOM`.

### Join by code

| Code     | Expected                                                                          |
| -------- | --------------------------------------------------------------------------------- |
| `QWER12` | Preview shows WAITING, 2 / 8 players. Join opens the room; you enter as spectator |
| `FULL44` | Preview shows FULL; Join is refused                                               |
| `BUSY77` | Preview shows IN GAME; Join opens the match as spectator                          |
| `ZZZZZZ` | Room not found                                                                    |

### Route recovery

1. Set `VITE_MOCK_AUTH=in-room`, restart, open `/lobby`.
2. Expected: you are sent into `QWER12` (`/room/1001`).
3. In a room, open `/lobby` manually. Expected: back to the room.

### Team, role and ready

1. Join `QWER12`. You start as spectator.
2. Pick a team, then a role. The seat is claimed in one step (`room.role.select`).
3. Try BLUE Spymaster: `word_wizard` holds it, so the seat is not offered.
4. Mark ready, then unready.
5. Choose "Watch instead" to go back to spectating.

### Other players move

Run in a room page:

```js
mockSockets.room().playerJoin({ user_id: 47, username: 'night_owl' });
mockSockets.room().selectRole(47, 'OPERATIVE', 'BLUE');
mockSockets.room().setReady(47, true);
mockSockets.room().playerLeave(47);
```

Expected: the member appears as spectator, moves to BLUE Operative, shows ready, then
disappears.

### Host: settings and kick

1. Create a room (you are host). Run
   `mockSockets.room().playerJoin({ user_id: 47, username: 'night_owl' })`.
2. Use the kick button next to `night_owl`, or open their profile popup and kick from
   there. Confirm the dialog.
3. Expected: `night_owl` leaves the room.
4. As non-host: join `QWER12`, then run `mockSockets.room().kick(42)`. Expected: you
   return to the Lobby with a kick notice.
5. As host, change the turn timer in the room header (No limit, 60, 90 or 120 seconds).
   Non-hosts see it read-only. The word language is always English.

### Countdown and start

1. Create a room, then run `mockSockets.room().configureStartable('OPERATIVE')`.
2. Expected: the 3-second countdown, then the game screen.
3. To see a cancelled countdown, run `mockSockets.room().setReady(43, false)` during
   the countdown.

### Leave

| State            | How                                 | Expected                            |
| ---------------- | ----------------------------------- | ----------------------------------- |
| Lobby player     | Leave button                        | Confirmation, then Lobby            |
| Spectator        | Leave button                        | Confirmation that you stop watching |
| Match, Operative | `scenario('operative-turn')`, Leave | Warning about the leave penalty     |
| Match, Spymaster | `scenario('spymaster-turn')`, Leave | Heavier penalty warning             |
| Result screen    | `scenario('game-over')`, Exit       | Leaves at once, no dialog           |

### Invites

1. In a room, open **Invite Friends**. Invite `red_agent` (online). Expected: success.
2. Invite `blue_agent` (offline). Expected: the offline error.
3. Receive an invite:

   ```js
   mockSockets.chat.inviteReceived({ user_id: 43, username: 'red_agent' }, 1001, 'QWER12');
   ```

   Accept it. Expected: you join `QWER12`.

## Game

### Spymaster

1. `mockSockets.scenario('spymaster-turn')`.
2. Verify: every card shows its team color (RED, BLUE, neutral, assassin).
3. Give a clue: one word and a number from 1 to 9. Try two words or an empty word to
   see validation.
4. Expected after submit: the clue shows in the turn header; you wait while RED
   guesses. Simulate the guesses:

   ```js
   mockSockets.guess('RED');
   mockSockets.room().passTurn();
   ```

### Operative

1. `mockSockets.scenario('operative-turn')`. The clue is `ocean 2` (3 guesses).
2. Verify: unrevealed cards show no team color.
3. Click a card. Expected: it reveals its color; guesses left decrease.
4. Use the end-turn control. Expected: the turn moves to BLUE.

### Turn outcomes

Run during an Operative turn (`scenario('operative-turn')`):

| Command                         | Expected                                   |
| ------------------------------- | ------------------------------------------ |
| `mockSockets.guess('RED')`      | Correct: score updates, RED keeps guessing |
| `mockSockets.guess('NEUTRAL')`  | Turn ends, BLUE gets the turn              |
| `mockSockets.guess('BLUE')`     | Opponent card: BLUE scores, turn ends      |
| `mockSockets.guess('ASSASSIN')` | Match ends, RED loses                      |

### Opponent turn

`mockSockets.scenario('opponent-turn')`. BLUE plays; your board is read-only. Move
BLUE yourself:

```js
mockSockets.guess('BLUE');
mockSockets.room().passTurn();
```

### Results

1. `mockSockets.scenario('game-over')` (win) or `scenario('assassin-loss')` (loss).
2. Verify the result dialog, the score and the post-game deadline.
3. Choose Back to Lobby: you return to the room lobby. Choose Exit: you leave the room.
4. Others leaving the result: `mockSockets.room().returnToLobby(43)`.
5. Shorter decision window: set `mockSockets.room().postGameMs = 15000` before the game
   ends, then end it with `mockSockets.room().endGame('RED')`.

### Staffing pause

1. `mockSockets.scenario('paused')` pauses at once with the default 120 s deadline.
   For a short deadline, set `staffingMs` before the departure instead:

   ```js
   mockSockets.scenario('operative-turn');
   mockSockets.room().staffingMs = 15000;
   mockSockets.room().playerLeave(43);
   ```

2. Expected: the game pauses; the staffing dialog shows the missing role and a
   countdown.
3. Restore staffing before the deadline:

   ```js
   mockSockets.room().playerJoin({ user_id: 47, username: 'night_owl' });
   mockSockets.room().selectRole(47, 'SPYMASTER', 'RED');
   ```

   Expected: the game resumes.

4. Let the deadline pass instead. Expected: the game is cancelled and the room closes.

### Turn timer

1. Create a room. In the room header, set **Turn timer** to 60 seconds.
2. Start a game: `mockSockets.room().configureStartable('OPERATIVE')`.
3. Verify: a countdown pill under the turn heading. It turns red in the last 10 seconds.
4. Let it run out, or run `mockSockets.room().expireTurn()`. Expected: the turn passes
   to BLUE with a fresh countdown; no card is revealed.
5. Pause the game with `mockSockets.room().playerLeave(44)`. Expected: the countdown
   disappears. Restore staffing (see above): the turn resumes with the time it had left.

### Spectator

1. `mockSockets.scenario('spectating')`, or join `BUSY77`.
2. Verify: the SPECTATOR badge; no card colors before reveal; no controls.
3. `mockSockets.scenario('spectator-claim')`: a RED Operative seat is free. Take it.
   Expected: you become RED Operative in the running match.

## Real-Time and Reconnection

| Test         | Command                                                                                    | Expected                                                      |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Short drop   | `mockSockets.room().dropConnection(500)`                                                   | Recovers without the overlay; fresh `room.state`              |
| Long drop    | `mockSockets.room().dropConnection(5000)`                                                  | Reconnecting overlay, then the room returns                   |
| Offline      | `mockSockets.offline(20000)`                                                               | Overlay; REST also fails; recovers after 20 s                 |
| Missed moves | `mockSockets.offline()`, then `mockSockets.guess('RED')`, then `mockSockets.online()`      | After reconnect the board shows the guess from the snapshot   |
| Grace expiry | `mockSockets.room().graceMs.game = 5000`, then `mockSockets.offline()` for longer than 5 s | You lose the seat; after `online()` you are back in the Lobby |
| Room gone    | Staffing pause with a short `staffingMs` (see [Staffing pause](#staffing-pause)), wait     | Room closed notice, back to the Lobby                         |

With the real backend, inspect frames in DevTools › Network › WS. In development every
frame is also logged in the console.

## Social Features

### Profile and avatar

1. Open the profile menu, then Profile.
2. Change the username. Try `red_agent` (taken) and an invalid value.
3. Pick a preset avatar. Upload an image; a file above 2 MB is refused.
4. Delete the account: the confirmation needs the exact username. Expected: back to
   the Landing page with "Your account was deleted."

### Public profile popup

Click a player name in a room or the friends list. Verify level, wins, losses and the
online status. Report the user once; a second report answers `ALREADY_REPORTED`.

### Friends

1. The list shows `red_agent`, `blue_master` (online) and `blue_agent` (offline).
2. Search users, add `word_wizard`, remove `blue_agent`.
3. Add an existing friend: `ALREADY_FRIENDS`.

### Chat

1. Open the chat with `red_agent`: recent messages. Open `blue_master`: scroll up to
   load older pages.
2. Receive messages:

   ```js
   mockSockets.chat.directMessage(43, 'hi!');
   mockSockets.chat.roomMessage(48, 'ready?'); // while in QWER12
   ```

3. Delivery faults, before sending a message:

   ```js
   mockSockets.chat.failNext(); // send fails; retry works
   mockSockets.chat.dropNextAck(); // ack lost; message still arrives
   mockSockets.chat.loseNextSend(); // ack and event lost
   mockSockets.chat.duplicateNext(); // event delivered twice; shown once
   ```

### Match history and statistics

Open the profile. Expected: five finished matches of `player_one`, newest first, and
the win/loss totals.

## Language

Switch the language (English, Türkçe, Français) in Settings. Reload: the choice stays
(`localStorage["ft_transcendence.language"]`). Check the room and game screens at phone
width in each language.

## Before Opening a Pull Request

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
```
