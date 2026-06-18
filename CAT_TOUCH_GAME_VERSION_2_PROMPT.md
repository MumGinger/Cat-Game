Create Version 2 of the current Cat Touch Game in this repository.

Read the existing code before making changes.

The current repository is the external game project. Do not access or modify the separate Rubric Evolver repository.

## Objective

Revise Version 1 so the game supports longer low-assistance play, faster and larger prey-like targets, more forgiving paw/nose contact, stronger successful-hit feedback, and fewer iPad browser or fullscreen interruptions.

The central behavioral goal is:

Encourage the cat to actively chase and touch targets instead of passively watching them or keeping one paw in a fixed position.

## Evidence from Version 1 testing

The following observations were recorded during a supervised 5-minute iPad session:

- The cat remained visually interested but became less willing to touch after some time.
- The fixed 45-second round was frustrating because the cat could not restart the game independently.
- Targets moved too slowly, so the cat often stared instead of chasing.
- The cat sometimes tried to interact using its mouth or nose rather than only its paw.
- Successful hits were not reinforced strongly enough; the target disappeared, but the cat did not consistently understand that the interaction succeeded.
- Targets appeared too small for reliable paw contact.
- The cat sometimes kept one paw in a fixed position instead of tracking the target.
- The iPad repeatedly showed fullscreen-exit or keyboard-related interface interruptions.

Use these observations as the primary evidence for Version 2.

## Approved Rubric v2 priorities

The implementation should prioritize:

1. Cat-friendly touch and contact interaction
2. Active physical engagement
3. Clear success feedback
4. Low-assistance session continuity
5. iPad browser compatibility and uninterrupted presentation
6. Cat-safe and distraction-resistant UX
7. Reliability, maintainability, and validation
8. Observed-cat calibration and anti-passivity tuning

## Required Version 2 changes

### 1. Continuous or automatically restarting play

Replace the fixed 45-second round as the default experience.

Implement one of these approaches:

- continuous free-play mode; or
- automatic restart after a short result-screen delay.

Preferred behavior:

- gameplay should continue for at least a supervised five-minute session;
- the cat should not need a human to press Play Again every 45 seconds;
- targets should remain available or resume automatically;
- retain a clear human-controlled stop or reset option.

Do not create an inactive end screen that prevents further cat interaction.

### 2. Larger targets and more forgiving hit detection

Increase default target size for iPad.

Requirements:

- targets should scale more strongly with the shorter viewport dimension;
- primary targets should be visibly larger than Version 1;
- increase effective hit padding;
- support imprecise paw-edge, nose, or mouth-adjacent contact;
- repeated and multi-touch input should remain reliable;
- targets must remain inside safe reachable screen bounds.

Do not make hit detection so broad that touches anywhere on the screen score arbitrarily.

### 3. Faster and more engaging movement

Increase baseline target movement speed.

Requirements:

- movement should be noticeably faster than Version 1;
- targets must remain visually trackable;
- add variation in speed, direction, or brief prey-like dashes;
- use broader screen movement to encourage reaching;
- avoid long predictable paths repeatedly crossing the same location;
- discourage the stationary-paw strategy.

Keep speed-related values easy to tune.

### 4. Idle-engagement assistance

Add a configurable idle-assist system.

If no successful hit occurs for a configurable interval, temporarily make gameplay more enticing through one or more of:

- slightly larger targets;
- increased contrast or brightness;
- a short movement-speed increase;
- a brief lure animation;
- a soft audio lure where supported.

Return to normal behavior after successful interaction resumes.

Avoid rapid flashing or aggressive overstimulation.

### 5. Stronger successful-hit feedback

Every successful hit must produce immediate, noticeable feedback.

Improve the current feedback using several of these:

- larger burst animation;
- brief target transformation;
- ripple or reward animation near the hit location;
- clearly visible score or reward movement;
- soft sound where supported;
- optional haptic feedback only where supported.

Do not rely on vibration as the primary reward because iPad browser vibration support may be unavailable.

The game must continue normally when audio or haptics are unavailable.

### 6. Reduce iPad interruptions

Review the active play experience for:

- focusable elements;
- text inputs;
- text selection;
- callouts;
- keyboard-triggering controls;
- browser gestures;
- accidental scrolling;
- zooming;
- context menus;
- fullscreen-exit overlays.

Requirements:

- no text field or keyboard interaction should be required during play;
- prevent avoidable focus and text-selection behavior;
- hide or move human controls away from the main play surface during active play;
- do not aggressively request fullscreen if that causes repeated iPad overlays;
- prefer stable app-like presentation over unreliable fullscreen behavior;
- gameplay must remain usable when fullscreen is unavailable.

### 7. Human controls

Keep human controls clear before and after play.

During active gameplay:

- move, hide, or lock controls so the cat is unlikely to trigger them;
- do not place small interactive controls inside the main play area;
- retain an obvious human-only stop/reset method;
- avoid requiring a keyboard.

### 8. Centralized tuning configuration

Keep all major gameplay tuning values in one clear configuration section.

Include settings for:

- continuous play or auto-restart;
- session or round duration;
- target count;
- portrait target count;
- target-size range;
- movement-speed range;
- hit padding;
- respawn delay;
- success-feedback duration;
- idle-assist delay;
- idle-assist size multiplier;
- idle-assist speed multiplier;
- sound enablement where practical.

Add concise comments explaining how each value affects cat behavior.

### 9. Naming and presentation

Update visible copy so it matches the Cat Touch Game goal.

The page may retain “Swipey Critters” as the game title, but the relationship should be clear and consistent.

Remove wording that implies a mandatory short 45-second round if continuous play becomes the default.

### 10. Documentation

Create or update a README containing:

- how to start the local server;
- the local browser URL;
- how to access the game from an iPad on the same network;
- any necessary LAN-binding instructions;
- known iPad fullscreen and audio limitations;
- gameplay tuning instructions;
- a manual iPad test checklist;
- a supervised cat-playtest checklist.

If LAN access is needed, allow the server to bind to `0.0.0.0` through configuration or provide a documented option. Keep localhost as a safe default where practical.

## Preserve working Version 1 behavior

Do not remove working features unless they conflict with the approved changes.

Preserve:

- canvas-based gameplay;
- pointer-event support;
- score tracking;
- target respawning;
- portrait and landscape resizing;
- safe-area layout;
- device-pixel-ratio rendering;
- graceful audio fallback;
- graceful fullscreen fallback;
- existing visual variety where useful.

## Scope restrictions

Do not add:

- authentication;
- online accounts;
- leaderboards;
- payments;
- advertisements;
- backend persistence;
- cloud deployment;
- complex frameworks;
- unrelated game modes;
- excessive visual effects;
- loud or startling sounds.

Do not rewrite the project into another framework unless the current implementation cannot support the required changes.

## Validation

After implementation, run:

- `node --check script.js`
- `node --check server.js`

Also perform or document manual verification for:

1. The game starts through the documented local URL.
2. Continuous play or automatic restart works for at least five minutes.
3. Targets are visibly larger than Version 1.
4. Hit detection accepts slightly off-center paw-like contact.
5. Touching unrelated empty screen areas does not score arbitrarily.
6. Movement is faster and more varied but remains trackable.
7. Targets do not repeatedly follow the same predictable path.
8. Idle-assist behavior activates after the configured delay.
9. A successful hit creates clear visual feedback.
10. Audio failure or muted audio does not stop gameplay.
11. Multiple rapid touches do not break scoring or target state.
12. Portrait and landscape rotation preserve target bounds and layout.
13. No text selection, keyboard, scrolling, zooming, or context menu interrupts active play.
14. Fullscreen unavailability does not prevent play.
15. Human controls are difficult for the cat to trigger accidentally.

## Versioning and reports

Before changing code:

- preserve the current Version 1 files through Git, a backup, or another clear version-history mechanism;
- briefly summarize the planned changes.

After implementation:

Create `VERSION_2_REPORT.md` containing:

- files changed;
- exact gameplay changes;
- configuration values changed;
- how continuous play works;
- how target size and speed changed;
- how hit detection changed;
- how idle assist works;
- how successful-hit feedback changed;
- iPad interruption mitigations;
- validation results;
- remaining limitations;
- assumptions that require another real-cat test.

Also create `VERSION_2_TEST_TEMPLATE.md` for the next supervised iPad cat test.

The test template should record:

- device;
- test duration;
- time before the cat notices the target;
- paw/nose/mouth attempts;
- successful hits;
- missed hits;
- passive-watching periods;
- stationary-paw behavior;
- engagement duration;
- restart or interruption events;
- fullscreen/browser interruptions;
- response to visual feedback;
- response to sound;
- signs of frustration or overstimulation.

Do not claim Version 2 is better until it has been tested with the cat.

At the end report:

1. files changed;
2. main behavioral changes;
3. validation commands and results;
4. how to run Version 2;
5. where `VERSION_2_REPORT.md` is located;
6. where `VERSION_2_TEST_TEMPLATE.md` is located;
7. remaining issues that require real iPad and cat testing.
