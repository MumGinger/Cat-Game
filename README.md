# Cat Touch Game Version 2

`Swipey Critters` is the canvas-based Cat Touch Game in this repository. Version 2 keeps the existing single-page setup and shifts the default experience to continuous supervised play with larger, faster, more touch-forgiving targets.

## Start the local server

From `C:\Users\Aira\Documents\Test` run:

```powershell
node server.js
```

Default local URL:

- [http://127.0.0.1:4173](http://127.0.0.1:4173)

## Access from an iPad on the same network

The server defaults to localhost for safety. To expose it to your LAN:

```powershell
$env:HOST='0.0.0.0'
node server.js
```

Then open the game on the iPad using your computer's LAN IP and port:

- Example for this machine: [http://10.0.0.101:4173](http://10.0.0.101:4173)

If the address changes later, check it again with:

```powershell
ipconfig
```

## LAN binding notes

- `HOST` is optional. If omitted, the server listens on `127.0.0.1`.
- `PORT` is also configurable. Example: `$env:PORT='4174'; node server.js`
- If Windows Firewall prompts for access, allow the Node process on your private network so the iPad can connect.

## iPad fullscreen and audio limitations

- Version 2 does not aggressively request fullscreen. This is intentional to reduce repeated iPad fullscreen-exit overlays.
- The game remains playable without fullscreen.
- Audio is optional and uses graceful browser fallback.
- iPad Safari may still block audio until the first human interaction that starts the session.
- Browser haptics are optional and may be unavailable on iPad browsers.

## Gameplay tuning

Main tuning lives in [script.js](/C:/Users/Aira/Documents/Test/script.js) inside `GAME_CONFIG`.

High-impact settings:

- `continuousPlay`: keeps play running until a human stops it.
- `sessionDurationMs`: supervision target for a typical session.
- `critterCount` and `portraitCritterCount`: total live targets on screen.
- `critterSizeRange` and `sizeScaleShortSide`: target size on tablet screens.
- `speedRange`, `dashIntervalMs`, `dashDurationMs`, `dashSpeedMultiplier`: chase intensity and unpredictability.
- `hitPadding` and `trailHitPadding`: touch forgiveness without allowing arbitrary empty-screen scoring.
- `respawnDelayMs`: how quickly new targets reappear.
- `idleAssistDelayMs`, `idleAssistSizeMultiplier`, `idleAssistSpeedMultiplier`: low-assistance engagement recovery.
- `soundEnabled` and `idleAssistSoundEnabled`: optional audio cues.

## Manual iPad test checklist

1. Start the server and open the documented URL on the iPad.
2. Confirm the game starts from the start overlay and keeps running until a human stops it.
3. Rotate between portrait and landscape and confirm targets stay inside the play area.
4. Confirm no text cursor, keyboard, selection, callout, or context menu appears during play.
5. Confirm accidental scrolling and zooming do not interrupt active play.
6. Confirm the bottom hold-to-stop control is visible to a human but not easy for the cat to trigger accidentally.
7. Confirm fullscreen is not required for play.
8. Confirm the game still plays if audio is muted or unavailable.

## Supervised cat-playtest checklist

1. Record device, browser, orientation, and session duration.
2. Start one supervised session of at least five minutes.
3. Note time to first visual notice and time to first touch attempt.
4. Record paw, nose, and mouth-adjacent attempts separately.
5. Count successful hits, missed hits, passive-watching periods, and stationary-paw behavior.
6. Watch whether faster target motion encourages active chasing across the screen.
7. Watch whether idle assist restores attention after a quiet stretch.
8. Watch the cat's reaction to hit feedback and optional sound.
9. Stop immediately if the cat shows frustration or overstimulation.

