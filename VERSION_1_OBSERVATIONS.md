# Version 1 Observations

## Test Setup

- **Device:** iPad
- **Test duration:** 5 minutes
- **Test subject:** Cat
- **Version tested:** Version 1

## Observed Behavior

- The cat remained interested in the game for most of the test.
- After some time, the cat continued watching the target but became less willing to touch it.
- The 45-second game duration was frustrating because the cat could not restart the game independently.
- The target moved too slowly, so the cat often stared at it instead of chasing or touching it.
- The cat sometimes missed the target because it tried to use its mouth rather than its paw.
- The iPad repeatedly displayed the “Exit Full Screen” interface because typing or keyboard-related input was being triggered.

## What Worked

1. The game successfully attracted and maintained the cat’s visual attention.
2. The target was noticeable enough for the cat to continue watching it.
3. The cat showed some intention to interact with the target.

## Problems Observed

### 1. Session Restart Accessibility

The game ends after 45 seconds, but the cat cannot restart it without human assistance.

**Observed impact:**  
The interaction stops even when the cat may still be interested.

### 2. Target Movement Is Too Slow

The target moves slowly enough that the cat often watches instead of actively chasing or touching it.

**Observed impact:**  
The game encourages passive staring rather than physical interaction.

### 3. Interaction Method Does Not Match the Cat’s Behavior

The cat sometimes tries to catch the target with its mouth instead of using its paw.

**Observed impact:**  
The cat may miss the target or interact with the edge of the iPad rather than successfully registering a touch.

### 4. Weak Success Feedback

After the cat catches the target, the target disappears, but there is no additional feedback such as vibration, sound, animation, or a visible reward.

**Observed impact:**  
The cat may not clearly understand that the interaction was successful. After several attempts, the cat becomes more passive and mainly watches the target instead of continuing to touch it.

### 5. Target Is Too Small and Encourages a Stationary Paw Strategy

The target appears too small for reliable paw interaction. Instead of actively following it, the cat often keeps one paw resting in a single location for an extended period.

**Observed impact:**  
The cat may be trying to wait for the target to pass under the paw rather than tracking and chasing it. This reduces active engagement and suggests that the target is not large, reachable, or visually rewarding enough to encourage repeated movement.

### 6. Full-Screen Interruption

The iPad repeatedly shows an “Exit Full Screen” message or interface when typing or keyboard-related input is triggered.

**Observed impact:**  
The interruption covers part of the game and may distract the cat or stop the interaction.

## Main Problems to Prioritize

1. Allow the game to restart automatically or continue without requiring human input.
2. Increase the target’s movement speed or make the speed adaptive.
3. Increase the target size and make it scale with screen size.
4. Encourage active tracking instead of allowing the cat to succeed by keeping one paw in a fixed position.
5. Make successful interaction easier for both paw and nose/mouth contact patterns.
6. Add clear and immediate success feedback after a hit, such as vibration, animation, or a soft sound.
7. Prevent keyboard or typing interactions from interrupting full-screen play.

## Initial Rubric Implications

These observations suggest that the next rubric should pay particular attention to:

- **Continuous play:** The game should not stop in a way that requires human assistance.
- **Active engagement:** Target movement should encourage chasing and touching rather than passive watching.
- **Touch accessibility:** The interaction area should support imprecise contact from a paw, nose, or mouth.
- **Target size and reachability:** The target should be large enough to support reliable paw contact and should scale with the device screen.
- **Active engagement:** Target behavior should encourage the cat to track and move rather than wait with one paw in a fixed location.
- **Success feedback:** Every successful hit should produce immediate, noticeable feedback so the cat can connect its action with the result.
- **Full-screen stability:** The game should remain in an uninterrupted play state without keyboard-related overlays.
