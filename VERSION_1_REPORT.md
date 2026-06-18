# VERSION 1 Report

This report is based on the current files in the workspace: [index.html](C:\Users\Aira\Documents\Test\index.html), [script.js](C:\Users\Aira\Documents\Test\script.js), [styles.css](C:\Users\Aira\Documents\Test\styles.css), and [server.js](C:\Users\Aira\Documents\Test\server.js).

## Confirmed Facts

### 1. How to run the game

- The workspace includes a small Node HTTP server in [server.js](C:\Users\Aira\Documents\Test\server.js) that listens on `127.0.0.1:4173` ([server.js](C:\Users\Aira\Documents\Test\server.js):7-8, [server.js](C:\Users\Aira\Documents\Test\server.js):55-56).
- The game assets are static files served from the current folder, with `/` resolving to `index.html` ([server.js](C:\Users\Aira\Documents\Test\server.js):24-25, [server.js](C:\Users\Aira\Documents\Test\server.js):35-50).
- A code-supported run flow is:
  1. Run `node server.js` from `C:\Users\Aira\Documents\Test`.
  2. Open `http://127.0.0.1:4173`.

### 2. What the game currently does

- The page title is `Swipey Critters` and the main play surface is a full-screen `<canvas>` with score/time HUD and start/result overlays ([index.html](C:\Users\Aira\Documents\Test\index.html):9, [index.html](C:\Users\Aira\Documents\Test\index.html):13-24, [index.html](C:\Users\Aira\Documents\Test\index.html):28-48).
- The start overlay describes a "quick 45 second round" and says big critters are worth 1 point while tiny zippy critters are worth 3 points ([index.html](C:\Users\Aira\Documents\Test\index.html):32-39).
- Starting a round resets score to `0`, sets the timer to `45000` ms, clears transient effects, respawns the critters, switches to the `playing` phase, and starts audio cues ([script.js](C:\Users\Aira\Documents\Test\script.js):281-301).
- The round ends when the remaining time reaches `0`, then the result overlay shows the final score ([script.js](C:\Users\Aira\Documents\Test\script.js):305-309, [script.js](C:\Users\Aira\Documents\Test\script.js):891-894).
- The game continuously animates moving critters and visual effects with `requestAnimationFrame` ([script.js](C:\Users\Aira\Documents\Test\script.js):1158-1168).

### 3. Current controls and settings

- The visible controls are `Play Round` and `Play Again` buttons ([index.html](C:\Users\Aira\Documents\Test\index.html):39, [index.html](C:\Users\Aira\Documents\Test\index.html):48).
- The HUD shows `Score` and `Time` during play ([index.html](C:\Users\Aira\Documents\Test\index.html):18-24, [styles.css](C:\Users\Aira\Documents\Test\styles.css):93-96).
- The main gameplay configuration is hard-coded in `GAME_CONFIG`, including:
  - `roundDurationMs: 45000`
  - `critterCount: 6`
  - `portraitCritterCount: 5`
  - `critterSizeRange: 70-110`
  - `speedRange: 70-132`
  - `hitPadding: 32`
  - `respawnDelayMs: 170`
  - `burstDurationMs: 320`
  - `rippleDurationMs: 280`
  - `scorePopDurationMs: 580`
  - `touchRippleIntervalMs: 70`
  - `lureCueIntervalMs: 2800-5200`
  - `playInsets: top 92, right 26, bottom 28, left 26`
  ([script.js](C:\Users\Aira\Documents\Test\script.js):3-18).
- Audio is implemented with Web Audio when available, including start, catch, lure, ambient, music, and round-end sounds ([script.js](C:\Users\Aira\Documents\Test\script.js):369-751).

### 4. Target size and movement behavior

- There are three critter types: beetle, minnow, and mouse, each with different sway/turn/speed factors ([script.js](C:\Users\Aira\Documents\Test\script.js):31-58).
- There are two scoring/movement variants:
  - `bumper`: weight `0.44`, size multiplier `1.42`, speed multiplier `0.76`, points `1`
  - `zipper`: weight `0.56`, size multiplier `0.86`, speed multiplier `1.58`, points `3`
  ([script.js](C:\Users\Aira\Documents\Test\script.js):60-78).
- Base critter size is taken from `70-110` and then scaled by viewport size and variant multiplier ([script.js](C:\Users\Aira\Documents\Test\script.js):152-157, [script.js](C:\Users\Aira\Documents\Test\script.js):222-237).
- Viewport scaling uses `Math.min(width, height) / 820`, clamped to `0.96-1.28` ([script.js](C:\Users\Aira\Documents\Test\script.js):152-157).
- Hit radius is `size * 0.5 + 32` ([script.js](C:\Users\Aira\Documents\Test\script.js):237).
- Spawn speed is based on the base range `70-132`, then multiplied by critter-type and variant speed factors ([script.js](C:\Users\Aira\Documents\Test\script.js):228-232).
- Critters spawn at random positions inside play bounds, with random initial heading and a scheduled future turn time ([script.js](C:\Users\Aira\Documents\Test\script.js):222-246).
- While alive, critters:
  - sway their heading over time
  - occasionally get a randomized heading nudge
  - move every frame
  - bounce off the play bounds by inverting velocity on collision
  ([script.js](C:\Users\Aira\Documents\Test\script.js):828-866).
- When hit successfully, a critter enters `bursting`, disappears temporarily, and respawns after `170` ms ([script.js](C:\Users\Aira\Documents\Test\script.js):810-825, [script.js](C:\Users\Aira\Documents\Test\script.js):836-842).

### 5. Touch and pointer behavior

- The game uses pointer events on the canvas rather than separate mouse/touch event handlers ([script.js](C:\Users\Aira\Documents\Test\script.js):1171-1193).
- `pointerdown` only does gameplay work during the `playing` phase. It captures the pointer, prevents the default action, and registers the touch point ([script.js](C:\Users\Aira\Documents\Test\script.js):1171-1178).
- `pointermove` only updates pointers already tracked in `activeTouches`, prevents the default action, and updates the touch point ([script.js](C:\Users\Aira\Documents\Test\script.js):1181-1187).
- `pointerup`, `pointercancel`, and `lostpointercapture` remove the pointer from `activeTouches` ([script.js](C:\Users\Aira\Documents\Test\script.js):1189-1192).
- Right-click context menus are suppressed on the canvas ([script.js](C:\Users\Aira\Documents\Test\script.js):1193).
- CSS disables browser touch gestures and overscroll behavior on the page with `touch-action: none` and `overscroll-behavior: none` ([styles.css](C:\Users\Aira\Documents\Test\styles.css):24-28).
- Each active pointer is drawn as a soft ring on the canvas while it remains active ([script.js](C:\Users\Aira\Documents\Test\script.js):912-922).
- Touch registration also attempts a hit test immediately against the nearest alive critter within hit radius ([script.js](C:\Users\Aira\Documents\Test\script.js):753-785, [script.js](C:\Users\Aira\Documents\Test\script.js):792-808).

### 6. Feedback after a successful touch

- On a successful hit, the game:
  - marks the critter as `bursting`
  - schedules respawn
  - adds the critter's point value to score
  - updates the HUD
  - creates a ripple at the touch point
  - creates a burst at the critter position
  - creates a floating `+1` or `+3` score pop
  - plays critter-specific and variant-specific catch sounds
  ([script.js](C:\Users\Aira\Documents\Test\script.js):810-825).
- Ripple, burst, and score-pop effects are time-limited and filtered out after their configured durations ([script.js](C:\Users\Aira\Documents\Test\script.js):875-877).

### 7. Mobile and tablet behavior

- The viewport meta tag includes `width=device-width`, `initial-scale=1`, `viewport-fit=cover`, and `user-scalable=no` ([index.html](C:\Users\Aira\Documents\Test\index.html):5-7).
- The app shell fills the viewport using `100vw`, `100vh`, and `100dvh` ([styles.css](C:\Users\Aira\Documents\Test\styles.css):66-70).
- HUD and overlay padding account for safe-area insets ([styles.css](C:\Users\Aira\Documents\Test\styles.css):85-86, [styles.css](C:\Users\Aira\Documents\Test\styles.css):132-133).
- On coarse-pointer devices, the canvas cursor is hidden ([styles.css](C:\Users\Aira\Documents\Test\styles.css):201-204).
- In portrait orientation, HUD chips and the overlay card are reduced in size ([styles.css](C:\Users\Aira\Documents\Test\styles.css):207-216).
- The game uses `6` critters in landscape and `5` in portrait, based on whether viewport width is greater than height ([script.js](C:\Users\Aira\Documents\Test\script.js):146-149).
- Starting a round requests fullscreen if the browser supports `requestFullscreen` and fullscreen is not already active ([script.js](C:\Users\Aira\Documents\Test\script.js):312-320).
- Canvas resize updates viewport dimensions, device pixel ratio, critter count, and critter clamping inside bounds ([script.js](C:\Users\Aira\Documents\Test\script.js):174-184, [script.js](C:\Users\Aira\Documents\Test\script.js):252-257).

### 8. Existing tests and validation results

- No automated test files, test configuration files, or package manifest were found in the current workspace root during inspection.
- `node --check script.js` completed successfully.
- `node --check server.js` completed successfully.
- `server.log` and `server.err` exist in the workspace and are currently empty.

### 9. Known limitations that can be confirmed from the code

- There is no persistence layer for score, settings, or session state; score and round state are reset in memory when a round starts or the page reloads ([script.js](C:\Users\Aira\Documents\Test\script.js):89-107, [script.js](C:\Users\Aira\Documents\Test\script.js):281-301).
- There is no pause/resume control exposed in the UI; the visible buttons are only for starting and restarting rounds ([index.html](C:\Users\Aira\Documents\Test\index.html):39, [index.html](C:\Users\Aira\Documents\Test\index.html):48).
- The game logic is only active during the `playing` phase; pointer input outside that phase is ignored for gameplay ([script.js](C:\Users\Aira\Documents\Test\script.js):753-756, [script.js](C:\Users\Aira\Documents\Test\script.js):1171-1174).
- Audio depends on browser support for `AudioContext`/`webkitAudioContext`; if unavailable, the game continues without that audio path ([script.js](C:\Users\Aira\Documents\Test\script.js):369-373).
- Fullscreen is requested only when `requestFullscreen` exists; otherwise the game continues without fullscreen ([script.js](C:\Users\Aira\Documents\Test\script.js):312-320).
- The server binds specifically to `127.0.0.1:4173`, not all interfaces ([server.js](C:\Users\Aira\Documents\Test\server.js):7-8, [server.js](C:\Users\Aira\Documents\Test\server.js):55-56).
- No keyboard controls are implemented in the inspected JavaScript.
- No settings UI, difficulty selector, or configuration panel is present in the inspected HTML.

## Assumptions

- Running `node server.js` and opening `http://127.0.0.1:4173` is the intended local development path because that is the only explicit server implementation present in the workspace.
- The report does not claim runtime behavior that was only visually verified in a browser session; behavioral statements are derived from the inspected source unless the validation section explicitly says otherwise.
- The phrase "Version 1" is treated as the current state of the files in this workspace because there is no separate versioned directory or tag in the inspected file list.
