"use strict";

const GAME_CONFIG = Object.freeze({
  // Keep free play running until a human stops it, so the cat is not blocked by end screens.
  continuousPlay: true,
  // Used for supervision guidance and HUD timing, not as a forced stop when free play is enabled.
  sessionDurationMs: 5 * 60 * 1000,
  // Short restart delay when continuousPlay is ever turned off for short rounds.
  autoRestartDelayMs: 1600,

  // More targets increases chances of chase without crowding the screen.
  critterCount: 7,
  portraitCritterCount: 6,

  // Larger defaults help paw-edge, nose, and mouth-adjacent contact on tablet screens.
  critterSizeRange: { min: 96, max: 152 },
  // Scale targets more strongly from the shorter side of the viewport for iPad play.
  sizeScaleShortSide: { divisor: 700, min: 1.04, max: 1.58 },
  // Extra padding keeps slightly off-center touches rewarding without making empty taps score.
  hitPadding: 48,
  // Additional path padding helps swipes and paw drags clip the critter reliably.
  trailHitPadding: 18,

  // Faster baseline movement encourages chasing instead of watching.
  speedRange: { min: 132, max: 220 },
  // Frequent course changes reduce predictable loops and fixed-paw waiting.
  turnJitterRadians: 1.15,
  dashIntervalMs: { min: 1100, max: 2400 },
  dashDurationMs: { min: 260, max: 520 },
  dashSpeedMultiplier: { min: 1.18, max: 1.48 },
  // Nearby touches repel critters so a parked paw does not stay optimal.
  touchRepelRadius: 170,
  touchRepelStrength: 2.6,
  touchStillThresholdMs: 420,
  touchStillBoost: 1.18,

  // Quick respawns keep targets available during long sessions.
  respawnDelayMs: 140,

  // Longer and larger feedback helps the cat notice that a touch succeeded.
  successFeedbackDurationMs: 680,
  burstDurationMs: 520,
  rippleDurationMs: 620,
  scorePopDurationMs: 760,
  rewardTrailDurationMs: 720,
  touchRippleIntervalMs: 60,

  // Idle assist nudges interest back up after inactive periods.
  idleAssistDelayMs: 9000,
  idleAssistSizeMultiplier: 1.2,
  idleAssistSpeedMultiplier: 1.16,
  idleAssistGlowStrength: 0.22,
  idleAssistPulseDurationMs: 1100,
  idleAssistSoundEnabled: true,

  // Audio stays optional so muted browsers or unsupported devices still play normally.
  soundEnabled: true,
  // Short haptic pulse sequence reinforces a catch when the browser/device supports vibration.
  catchVibrationPattern: [18, 24, 32],
  musicStepSec: 0.34,
  musicLookAheadSec: 0.28,

  // Keep the top HUD and bottom control rail out of the main reach area.
  playInsets: { top: 102, right: 24, bottom: 118, left: 24 },
  // A hold-to-stop control is harder for the cat to trigger accidentally than a tap button.
  holdToStopMs: 900,
});

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.getElementById("scoreValue");
const sessionValue = document.getElementById("sessionValue");
const statusValue = document.getElementById("statusValue");
const finalScore = document.getElementById("finalScore");
const resultSummary = document.getElementById("resultSummary");
const scoreChip = document.getElementById("scoreChip");
const startOverlay = document.getElementById("startOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const stopButton = document.getElementById("stopButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const controlHint = document.getElementById("controlHint");

const CRITTER_TYPES = [
  {
    name: "beetle",
    palette: { body: "#166d67", accent: "#f9d27d", shadow: "rgba(7, 56, 53, 0.24)" },
    swayAmount: 0.72,
    swaySpeed: 0.0039,
    turnWindowMs: [780, 1400],
    speedFactor: 0.96,
    draw: drawBeetle,
  },
  {
    name: "minnow",
    palette: { body: "#f17457", accent: "#fff3e3", shadow: "rgba(125, 51, 34, 0.24)" },
    swayAmount: 0.42,
    swaySpeed: 0.0052,
    turnWindowMs: [920, 1540],
    speedFactor: 1.05,
    draw: drawMinnow,
  },
  {
    name: "mouse",
    palette: { body: "#7b5f4b", accent: "#f8e3ca", shadow: "rgba(56, 38, 28, 0.24)" },
    swayAmount: 0.58,
    swaySpeed: 0.0046,
    turnWindowMs: [650, 1180],
    speedFactor: 1.12,
    draw: drawMouse,
  },
];

const CRITTER_VARIANTS = [
  {
    name: "bumper",
    weight: 0.44,
    sizeMultiplier: 1.52,
    speedMultiplier: 0.62,
    points: 1,
    scoreColor: "#fff4c7",
    rippleColor: "rgba(255, 223, 136, 0.78)",
  },
  {
    name: "zipper",
    weight: 0.56,
    sizeMultiplier: 0.82,
    speedMultiplier: 1.74,
    points: 3,
    scoreColor: "#ddfff4",
    rippleColor: "rgba(148, 255, 220, 0.78)",
  },
];

const MUSIC_PATTERN = [
  { bass: 196, melody: 523.25, sparkle: 659.25, kick: true },
  { melody: 587.33 },
  { bass: 220, melody: 659.25, sparkle: 783.99, kick: true },
  { melody: 587.33 },
  { bass: 246.94, melody: 698.46, sparkle: 880, kick: true },
  { melody: 659.25 },
  { bass: 220, melody: 587.33, sparkle: 739.99, kick: true },
  { melody: 523.25 },
];

const state = {
  phase: "idle",
  score: 0,
  sessionStartAt: 0,
  elapsedMs: 0,
  critters: [],
  activeTouches: new Map(),
  ripples: [],
  bursts: [],
  scorePops: [],
  rewardTrails: [],
  viewport: { width: window.innerWidth, height: window.innerHeight, dpr: 1 },
  lastFrameAt: performance.now(),
  animationFrame: 0,
  autoRestartTimer: 0,
  holdStop: {
    active: false,
    startedAt: 0,
    rafId: 0,
  },
  fullscreenSupported: false,
  audio: {
    context: null,
    masterGain: null,
    ambient: null,
    music: null,
    unlocked: false,
  },
  idleAssist: {
    active: false,
    activatedAt: 0,
    pulseUntil: 0,
  },
  lastSuccessfulHitAt: 0,
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function pickWeightedItem(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let threshold = Math.random() * totalWeight;

  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getDesiredCritterCount() {
  return state.viewport.width > state.viewport.height
    ? GAME_CONFIG.critterCount
    : GAME_CONFIG.portraitCritterCount;
}

function getCritterSizeRange() {
  const shortSide = Math.min(state.viewport.width, state.viewport.height);
  const scale = clamp(
    shortSide / GAME_CONFIG.sizeScaleShortSide.divisor,
    GAME_CONFIG.sizeScaleShortSide.min,
    GAME_CONFIG.sizeScaleShortSide.max,
  );

  return {
    min: GAME_CONFIG.critterSizeRange.min * scale,
    max: GAME_CONFIG.critterSizeRange.max * scale,
  };
}

function getPlayBounds(radius) {
  const left = GAME_CONFIG.playInsets.left + radius;
  const right = state.viewport.width - GAME_CONFIG.playInsets.right - radius;
  const top = GAME_CONFIG.playInsets.top + radius;
  const bottom = state.viewport.height - GAME_CONFIG.playInsets.bottom - radius;

  return {
    left: Math.min(left, right),
    right: Math.max(left, right),
    top: Math.min(top, bottom),
    bottom: Math.max(top, bottom),
  };
}

function getCritterScale(now) {
  if (!state.idleAssist.active) {
    return 1;
  }

  const pulseAge = Math.max(0, state.idleAssist.pulseUntil - now);
  const pulseBoost =
    pulseAge > 0
      ? Math.sin(((state.idleAssist.pulseUntil - now) / GAME_CONFIG.idleAssistPulseDurationMs) * Math.PI) *
        0.03
      : 0;

  return GAME_CONFIG.idleAssistSizeMultiplier + pulseBoost;
}

function getDisplaySize(critter, now) {
  return critter.size * getCritterScale(now);
}

function getHitRadius(critter, now) {
  return getDisplaySize(critter, now) * 0.5 + GAME_CONFIG.hitPadding;
}

function resizeCanvas() {
  state.viewport.width = window.innerWidth;
  state.viewport.height = window.innerHeight;
  state.viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(state.viewport.width * state.viewport.dpr);
  canvas.height = Math.floor(state.viewport.height * state.viewport.dpr);
  ctx.setTransform(state.viewport.dpr, 0, 0, state.viewport.dpr, 0, 0);

  reconcileCritterCount(performance.now());
  clampCrittersInsideBounds(performance.now());
}

function reconcileCritterCount(now) {
  const desiredCount = getDesiredCritterCount();

  while (state.critters.length < desiredCount) {
    state.critters.push(createCritter(state.critters.length, now));
  }

  if (state.critters.length > desiredCount) {
    state.critters.length = desiredCount;
  }
}

function chooseSpawnPoint(radius) {
  const bounds = getPlayBounds(radius);
  let bestPoint = {
    x: randomBetween(bounds.left, bounds.right),
    y: randomBetween(bounds.top, bounds.bottom),
    score: -Infinity,
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = {
      x: randomBetween(bounds.left, bounds.right),
      y: randomBetween(bounds.top, bounds.bottom),
    };
    let minDistance = Number.POSITIVE_INFINITY;

    for (const critter of state.critters) {
      if (critter.state !== "alive") {
        continue;
      }
      minDistance = Math.min(minDistance, Math.hypot(candidate.x - critter.x, candidate.y - critter.y));
    }

    for (const touch of state.activeTouches.values()) {
      minDistance = Math.min(minDistance, Math.hypot(candidate.x - touch.x, candidate.y - touch.y));
    }

    if (minDistance > bestPoint.score) {
      bestPoint = { ...candidate, score: minDistance };
    }
  }

  return { x: bestPoint.x, y: bestPoint.y };
}

function createCritter(id, now) {
  const critter = {
    id,
    type: null,
    variant: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    baseSpeed: 0,
    angle: 0,
    wobbleOffset: randomBetween(0, Math.PI * 2),
    animationOffset: randomBetween(0, Math.PI * 2),
    turnAt: now,
    nextDashAt: now,
    dashEndsAt: 0,
    dashMultiplier: 1,
    state: "alive",
    respawnAt: 0,
  };

  respawnCritter(critter, now, true);
  return critter;
}

function respawnCritter(critter, now, freshSpawn) {
  const sizeRange = getCritterSizeRange();
  const type = CRITTER_TYPES[Math.floor(Math.random() * CRITTER_TYPES.length)];
  const variant = pickWeightedItem(CRITTER_VARIANTS);
  const size = randomBetween(sizeRange.min, sizeRange.max) * variant.sizeMultiplier;
  const radius = size * 0.58;
  const spawnPoint = chooseSpawnPoint(radius);
  const angle = randomBetween(0, Math.PI * 2);
  const baseSpeed =
    randomBetween(GAME_CONFIG.speedRange.min, GAME_CONFIG.speedRange.max) *
    type.speedFactor *
    variant.speedMultiplier;

  critter.type = type;
  critter.variant = variant;
  critter.size = size;
  critter.x = spawnPoint.x;
  critter.y = spawnPoint.y;
  critter.baseSpeed = baseSpeed;
  critter.vx = Math.cos(angle) * baseSpeed;
  critter.vy = Math.sin(angle) * baseSpeed;
  critter.angle = angle;
  critter.turnAt = now + randomBetween(type.turnWindowMs[0], type.turnWindowMs[1]);
  critter.nextDashAt =
    now + randomBetween(GAME_CONFIG.dashIntervalMs.min, GAME_CONFIG.dashIntervalMs.max);
  critter.dashEndsAt = 0;
  critter.dashMultiplier = 1;
  critter.state = "alive";
  critter.respawnAt = 0;

  if (!freshSpawn) {
    createRipple(critter.x, critter.y, variant.rippleColor, 30, 56);
  }
}

function clampCrittersInsideBounds(now) {
  for (const critter of state.critters) {
    const bounds = getPlayBounds(getDisplaySize(critter, now) * 0.55 || 40);
    critter.x = clamp(critter.x, bounds.left, bounds.right);
    critter.y = clamp(critter.y, bounds.top, bounds.bottom);
  }
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.phase = phase;

  const idle = phase === "idle";
  const results = phase === "results";

  startOverlay.classList.toggle("is-visible", idle);
  resultOverlay.classList.toggle("is-visible", results);
  resultOverlay.setAttribute("aria-hidden", results ? "false" : "true");

  if (results) {
    finalScore.textContent = String(state.score);
  }
}

function syncHud() {
  scoreValue.textContent = String(state.score);
  sessionValue.textContent = formatDuration(state.elapsedMs);

  if (state.phase !== "playing") {
    statusValue.textContent = state.phase === "results" ? "Stopped" : "Ready";
    return;
  }

  statusValue.textContent = state.idleAssist.active ? "Luring" : "Chasing";
}

function clearTimers() {
  if (state.autoRestartTimer) {
    window.clearTimeout(state.autoRestartTimer);
    state.autoRestartTimer = 0;
  }
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function updateFullscreenButton() {
  state.fullscreenSupported = Boolean(document.documentElement.requestFullscreen);

  if (!state.fullscreenSupported) {
    fullscreenButton.textContent = "Fullscreen Unavailable";
    fullscreenButton.disabled = true;
    return;
  }

  fullscreenButton.disabled = false;
  fullscreenButton.textContent = isFullscreenActive() ? "Exit Fullscreen" : "Enter Fullscreen";
}

function startSession() {
  const now = performance.now();

  clearTimers();
  cancelHoldStop();
  unlockAudio();

  state.score = 0;
  state.sessionStartAt = now;
  state.elapsedMs = 0;
  state.ripples.length = 0;
  state.bursts.length = 0;
  state.scorePops.length = 0;
  state.rewardTrails.length = 0;
  state.activeTouches.clear();
  state.idleAssist.active = false;
  state.idleAssist.activatedAt = 0;
  state.idleAssist.pulseUntil = 0;
  state.lastSuccessfulHitAt = now;

  reconcileCritterCount(now);
  for (const critter of state.critters) {
    respawnCritter(critter, now, true);
  }

  setPhase("playing");
  syncHud();
  startAmbientBed();
  playStartCue();
  controlHint.textContent = "Hold to stop play";
  updateFullscreenButton();
}

function stopSession() {
  clearTimers();
  cancelHoldStop();
  state.elapsedMs = state.sessionStartAt ? performance.now() - state.sessionStartAt : state.elapsedMs;
  syncHud();
  setPhase("results");
  stopAmbientBed();
  playRoundEndCue();

  resultSummary.textContent = `Session length: ${formatDuration(
    state.elapsedMs,
  )}. Start a new supervised run whenever the cat is ready.`;
  updateFullscreenButton();
}

function scheduleAutoRestart() {
  clearTimers();
  state.autoRestartTimer = window.setTimeout(() => {
    if (state.phase === "results") {
      startSession();
    }
  }, GAME_CONFIG.autoRestartDelayMs);
}

function createRipple(x, y, color, startRadius, endRadius) {
  state.ripples.push({
    x,
    y,
    color,
    bornAt: performance.now(),
    durationMs: GAME_CONFIG.rippleDurationMs,
    startRadius,
    endRadius,
  });
}

function createBurst(x, y, color) {
  const particles = [];

  for (let index = 0; index < 11; index += 1) {
    const angle = (Math.PI * 2 * index) / 11 + randomBetween(-0.16, 0.16);
    particles.push({
      angle,
      distance: randomBetween(24, 58),
      radius: randomBetween(4, 9),
    });
  }

  state.bursts.push({
    x,
    y,
    color,
    bornAt: performance.now(),
    durationMs: GAME_CONFIG.burstDurationMs,
    particles,
  });
}

function createScorePop(x, y, text, color) {
  state.scorePops.push({
    x,
    y,
    text,
    color,
    bornAt: performance.now(),
    durationMs: GAME_CONFIG.scorePopDurationMs,
  });
}

function createRewardTrail(x, y, color) {
  const rect = scoreChip.getBoundingClientRect();
  const endX = rect.left + rect.width / 2;
  const endY = rect.top + rect.height / 2;

  state.rewardTrails.push({
    startX: x,
    startY: y,
    endX,
    endY,
    color,
    bornAt: performance.now(),
    durationMs: GAME_CONFIG.rewardTrailDurationMs,
  });
}

function unlockAudio() {
  if (!GAME_CONFIG.soundEnabled) {
    return;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  if (!state.audio.context) {
    const context = new AudioContextCtor();
    const masterGain = context.createGain();

    masterGain.gain.value = 0.09;
    masterGain.connect(context.destination);

    state.audio.context = context;
    state.audio.masterGain = masterGain;
  }

  if (state.audio.context.state === "suspended") {
    state.audio.context.resume().catch(() => {});
  }

  state.audio.unlocked = true;
}

function startAmbientBed() {
  const { context, masterGain, unlocked, ambient } = state.audio;

  if (!GAME_CONFIG.soundEnabled || !unlocked || !context || !masterGain || ambient) {
    return;
  }

  const startAt = context.currentTime;
  const filter = context.createBiquadFilter();
  const ambientGain = context.createGain();
  const shimmerGain = context.createGain();
  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();
  const drones = [
    { type: "sine", frequency: 196, gain: 0.1, detune: -3 },
    { type: "triangle", frequency: 247, gain: 0.07, detune: 4 },
    { type: "sine", frequency: 392, gain: 0.03, detune: 6 },
  ].map((config) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, startAt);
    oscillator.detune.setValueAtTime(config.detune, startAt);
    gain.gain.setValueAtTime(config.gain, startAt);
    oscillator.connect(gain);
    gain.connect(filter);

    return { oscillator, gain };
  });

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1320, startAt);
  filter.Q.value = 0.7;

  ambientGain.gain.setValueAtTime(0.0001, startAt);
  ambientGain.gain.linearRampToValueAtTime(0.52, startAt + 1.05);
  shimmerGain.gain.setValueAtTime(0.0001, startAt);
  shimmerGain.gain.linearRampToValueAtTime(0.6, startAt + 1.15);

  filter.connect(ambientGain);
  ambientGain.connect(shimmerGain);
  shimmerGain.connect(masterGain);

  pulse.type = "sine";
  pulse.frequency.setValueAtTime(0.3, startAt);
  pulseDepth.gain.setValueAtTime(0.038, startAt);
  pulse.connect(pulseDepth);
  pulseDepth.connect(ambientGain.gain);

  for (const drone of drones) {
    drone.oscillator.start(startAt);
  }
  pulse.start(startAt);

  state.audio.ambient = {
    gain: ambientGain,
    shimmerGain,
    pulse,
    drones,
  };
  state.audio.music = {
    nextAt: startAt + 0.08,
    step: 0,
  };
}

function stopAmbientBed() {
  const { context, ambient } = state.audio;

  if (!context || !ambient) {
    state.audio.music = null;
    return;
  }

  const stopAt = context.currentTime + 0.5;

  ambient.gain.gain.cancelScheduledValues(context.currentTime);
  ambient.gain.gain.setValueAtTime(Math.max(ambient.gain.gain.value, 0.0001), context.currentTime);
  ambient.gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  ambient.shimmerGain.gain.cancelScheduledValues(context.currentTime);
  ambient.shimmerGain.gain.setValueAtTime(
    Math.max(ambient.shimmerGain.gain.value, 0.0001),
    context.currentTime,
  );
  ambient.shimmerGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  for (const drone of ambient.drones) {
    drone.oscillator.stop(stopAt + 0.04);
  }
  ambient.pulse.stop(stopAt + 0.04);

  state.audio.ambient = null;
  state.audio.music = null;
}

function playTone(options) {
  const { context, masterGain, unlocked } = state.audio;
  if (!GAME_CONFIG.soundEnabled || !unlocked || !context || !masterGain) {
    return;
  }

  const {
    frequency,
    type = "sine",
    duration = 0.12,
    attack = 0.01,
    release = 0.08,
    volume = 0.8,
    detune = 0,
    endFrequency = null,
    delay = 0,
    filterFrequency = 2400,
  } = options;
  const startAt = context.currentTime + delay;
  const endAt = startAt + duration;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  if (endFrequency !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
  }
  oscillator.detune.setValueAtTime(detune, startAt);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFrequency, startAt);
  filter.Q.value = 0.8;

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.linearRampToValueAtTime(volume, startAt + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt + release);

  oscillator.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(masterGain);

  oscillator.start(startAt);
  oscillator.stop(endAt + release + 0.02);
}

function scheduleBackgroundMusic() {
  const { context, unlocked, music } = state.audio;
  if (!unlocked || !context || !music) {
    return;
  }

  const lookAhead = context.currentTime + GAME_CONFIG.musicLookAheadSec;

  while (music.nextAt <= lookAhead) {
    const delay = Math.max(0, music.nextAt - context.currentTime);
    const step = MUSIC_PATTERN[music.step];

    if (step.kick) {
      playTone({
        frequency: 118,
        endFrequency: 74,
        type: "sine",
        duration: 0.09,
        attack: 0.002,
        release: 0.12,
        volume: 0.18,
        delay,
        filterFrequency: 1200,
      });
    }

    if (step.bass) {
      playTone({
        frequency: step.bass,
        type: "triangle",
        duration: 0.16,
        attack: 0.01,
        release: 0.12,
        volume: 0.12,
        delay: delay + 0.015,
        filterFrequency: 1800,
      });
    }

    if (step.melody) {
      playTone({
        frequency: step.melody,
        endFrequency: step.melody * 1.015,
        type: "triangle",
        duration: 0.14,
        attack: 0.004,
        release: 0.1,
        volume: 0.1,
        delay: delay + 0.045,
        filterFrequency: 3000,
      });
    }

    if (step.sparkle) {
      playTone({
        frequency: step.sparkle,
        type: "sine",
        duration: 0.1,
        attack: 0.003,
        release: 0.08,
        volume: 0.06,
        delay: delay + 0.14,
        filterFrequency: 3600,
      });
    }

    music.nextAt += GAME_CONFIG.musicStepSec;
    music.step = (music.step + 1) % MUSIC_PATTERN.length;
  }
}

function playStartCue() {
  playTone({ frequency: 520, type: "triangle", duration: 0.18, volume: 0.36 });
  playTone({ frequency: 658, type: "sine", duration: 0.16, volume: 0.28, delay: 0.08 });
  playTone({ frequency: 784, type: "triangle", duration: 0.14, volume: 0.22, delay: 0.16 });
}

function playCatchCue(critter) {
  if (critter.type.name === "minnow") {
    playTone({
      frequency: 380,
      endFrequency: 540,
      type: "sine",
      duration: 0.08,
      volume: 0.16,
      filterFrequency: 2200,
    });
    playTone({
      frequency: 520,
      endFrequency: 790,
      type: "sine",
      duration: 0.1,
      volume: 0.14,
      delay: 0.05,
      filterFrequency: 2600,
    });
    return;
  }

  if (critter.type.name === "mouse") {
    playTone({
      frequency: 1340,
      endFrequency: 1760,
      type: "square",
      duration: 0.06,
      volume: 0.18,
      filterFrequency: 4200,
    });
    playTone({
      frequency: 1190,
      endFrequency: 1500,
      type: "triangle",
      duration: 0.07,
      volume: 0.16,
      delay: 0.04,
      filterFrequency: 3600,
    });
    return;
  }

  playTone({
    frequency: 340,
    endFrequency: 430,
    type: "triangle",
    duration: 0.09,
    volume: 0.13,
    filterFrequency: 2200,
  });
  playTone({
    frequency: 460,
    endFrequency: 340,
    type: "sawtooth",
    duration: 0.06,
    volume: 0.09,
    delay: 0.03,
    filterFrequency: 2100,
  });
}

function playVariantCatchCue(critter) {
  if (critter.variant.name === "bumper") {
    playTone({
      frequency: 246,
      endFrequency: 214,
      type: "triangle",
      duration: 0.16,
      volume: 0.24,
      filterFrequency: 1800,
    });
    playTone({
      frequency: 362,
      endFrequency: 330,
      type: "sine",
      duration: 0.18,
      volume: 0.18,
      delay: 0.06,
      filterFrequency: 1900,
    });
    return;
  }

  playTone({
    frequency: 1020,
    endFrequency: 1280,
    type: "square",
    duration: 0.06,
    volume: 0.15,
    attack: 0.004,
    filterFrequency: 3600,
  });
  playTone({
    frequency: 1520,
    endFrequency: 1820,
    type: "triangle",
    duration: 0.1,
    volume: 0.2,
    delay: 0.03,
    attack: 0.003,
    filterFrequency: 3800,
  });
}

function playLureCue() {
  playTone({ frequency: 960, type: "sine", duration: 0.12, volume: 0.1, attack: 0.005 });
  playTone({
    frequency: 720,
    type: "triangle",
    duration: 0.16,
    volume: 0.09,
    delay: 0.08,
    attack: 0.008,
  });
  playTone({
    frequency: 1180,
    type: "sine",
    duration: 0.09,
    volume: 0.07,
    delay: 0.16,
    attack: 0.004,
  });
}

function playRoundEndCue() {
  playTone({ frequency: 690, type: "triangle", duration: 0.15, volume: 0.2 });
  playTone({ frequency: 520, type: "sine", duration: 0.22, volume: 0.16, delay: 0.11 });
}

function triggerSuccessHaptics() {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(GAME_CONFIG.catchVibrationPattern);
  }
}

function activateIdleAssist(now) {
  state.idleAssist.active = true;
  state.idleAssist.activatedAt = now;
  state.idleAssist.pulseUntil = now + GAME_CONFIG.idleAssistPulseDurationMs;
  syncHud();

  if (GAME_CONFIG.idleAssistSoundEnabled) {
    playLureCue();
  }
}

function deactivateIdleAssist() {
  state.idleAssist.active = false;
  state.idleAssist.activatedAt = 0;
  state.idleAssist.pulseUntil = 0;
  syncHud();
}

function distancePointToSegment(pointX, pointY, ax, ay, bx, by) {
  const abX = bx - ax;
  const abY = by - ay;
  const apX = pointX - ax;
  const apY = pointY - ay;
  const abLengthSq = abX * abX + abY * abY;

  if (abLengthSq === 0) {
    return Math.hypot(pointX - ax, pointY - ay);
  }

  const t = clamp((apX * abX + apY * abY) / abLengthSq, 0, 1);
  const closestX = ax + abX * t;
  const closestY = ay + abY * t;

  return Math.hypot(pointX - closestX, pointY - closestY);
}

function getEventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function registerTouch(event, isMove) {
  if (state.phase !== "playing") {
    return;
  }

  unlockAudio();
  const point = getEventPoint(event);
  const now = performance.now();
  const activeTouch = state.activeTouches.get(event.pointerId);
  const previousPoint = activeTouch
    ? { x: activeTouch.x, y: activeTouch.y }
    : { x: point.x, y: point.y };

  if (!activeTouch) {
    state.activeTouches.set(event.pointerId, {
      x: point.x,
      y: point.y,
      lastX: point.x,
      lastY: point.y,
      bornAt: now,
      lastMoveAt: now,
      lastRippleAt: now,
    });
    createRipple(point.x, point.y, "rgba(255, 250, 244, 0.82)", 16, 34);
  } else {
    const movedDistance = Math.hypot(point.x - activeTouch.x, point.y - activeTouch.y);

    activeTouch.lastX = activeTouch.x;
    activeTouch.lastY = activeTouch.y;
    activeTouch.x = point.x;
    activeTouch.y = point.y;

    if (movedDistance > 6) {
      activeTouch.lastMoveAt = now;
    }

    if (isMove && now - activeTouch.lastRippleAt >= GAME_CONFIG.touchRippleIntervalMs) {
      activeTouch.lastRippleAt = now;
      createRipple(point.x, point.y, "rgba(255, 250, 244, 0.52)", 11, 24);
    }
  }

  tryHitCritterPath(previousPoint.x, previousPoint.y, point.x, point.y, now);
}

function clearTouch(event) {
  state.activeTouches.delete(event.pointerId);
}

function tryHitCritterPath(ax, ay, bx, by, now) {
  let closestCritter = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const critter of state.critters) {
    if (critter.state !== "alive") {
      continue;
    }

    const distance = distancePointToSegment(critter.x, critter.y, ax, ay, bx, by);
    const hitRadius = getHitRadius(critter, now) + GAME_CONFIG.trailHitPadding;

    if (distance <= hitRadius && distance < closestDistance) {
      closestCritter = critter;
      closestDistance = distance;
    }
  }

  if (!closestCritter) {
    return;
  }

  closestCritter.state = "bursting";
  closestCritter.respawnAt = now + GAME_CONFIG.respawnDelayMs;
  state.score += closestCritter.variant.points;
  state.lastSuccessfulHitAt = now;

  if (state.idleAssist.active) {
    deactivateIdleAssist();
  } else {
    syncHud();
  }

  createRipple(bx, by, closestCritter.variant.rippleColor, 20, 54);
  createRipple(closestCritter.x, closestCritter.y, "rgba(255, 255, 255, 0.85)", 16, 70);
  createBurst(closestCritter.x, closestCritter.y, closestCritter.type.palette.accent);
  createScorePop(
    closestCritter.x,
    closestCritter.y - closestCritter.size * 0.16,
    `+${closestCritter.variant.points}`,
    closestCritter.variant.scoreColor,
  );
  createRewardTrail(closestCritter.x, closestCritter.y, closestCritter.variant.rippleColor);
  playCatchCue(closestCritter);
  playVariantCatchCue(closestCritter);
  triggerSuccessHaptics();
  syncHud();
}

function retargetCritterHeading(critter, now, biasRadians = 0) {
  const currentHeading = Math.atan2(critter.vy, critter.vx);
  const centerHeading = Math.atan2(
    state.viewport.height * 0.5 - critter.y,
    state.viewport.width * 0.5 - critter.x,
  );
  const randomHeading = currentHeading + randomBetween(-GAME_CONFIG.turnJitterRadians, GAME_CONFIG.turnJitterRadians);
  const heading = randomBetween(0, 1) > 0.45 ? centerHeading + biasRadians : randomHeading;
  const speed = Math.max(1, Math.hypot(critter.vx, critter.vy));

  critter.vx = Math.cos(heading) * speed;
  critter.vy = Math.sin(heading) * speed;
  critter.turnAt = now + randomBetween(critter.type.turnWindowMs[0], critter.type.turnWindowMs[1]);
}

function beginDash(critter, now) {
  const touchInfluence = getTouchInfluence(critter, now);
  const currentHeading = Math.atan2(critter.vy, critter.vx);
  let heading = currentHeading + randomBetween(-0.55, 0.55);

  if (touchInfluence.weight > 0) {
    heading = Math.atan2(touchInfluence.y, touchInfluence.x);
  }

  critter.dashMultiplier = randomBetween(
    GAME_CONFIG.dashSpeedMultiplier.min,
    GAME_CONFIG.dashSpeedMultiplier.max,
  );
  critter.dashEndsAt = now + randomBetween(GAME_CONFIG.dashDurationMs.min, GAME_CONFIG.dashDurationMs.max);
  critter.nextDashAt =
    critter.dashEndsAt + randomBetween(GAME_CONFIG.dashIntervalMs.min, GAME_CONFIG.dashIntervalMs.max);

  critter.vx = Math.cos(heading) * critter.baseSpeed * critter.dashMultiplier;
  critter.vy = Math.sin(heading) * critter.baseSpeed * critter.dashMultiplier;
  critter.angle = heading;
}

function getTouchInfluence(critter, now) {
  let repelX = 0;
  let repelY = 0;
  let weight = 0;

  for (const touch of state.activeTouches.values()) {
    const dx = critter.x - touch.x;
    const dy = critter.y - touch.y;
    const distance = Math.max(1, Math.hypot(dx, dy));

    if (distance > GAME_CONFIG.touchRepelRadius) {
      continue;
    }

    const normalized = 1 - distance / GAME_CONFIG.touchRepelRadius;
    const stillBoost = now - touch.lastMoveAt >= GAME_CONFIG.touchStillThresholdMs
      ? GAME_CONFIG.touchStillBoost
      : 1;
    const localWeight = normalized * GAME_CONFIG.touchRepelStrength * stillBoost;

    repelX += (dx / distance) * localWeight;
    repelY += (dy / distance) * localWeight;
    weight += localWeight;
  }

  return {
    x: repelX,
    y: repelY,
    weight,
  };
}

function updateCritter(critter, dtSeconds, now) {
  if (critter.state === "bursting") {
    if (now >= critter.respawnAt) {
      respawnCritter(critter, now, false);
    }
    return;
  }

  if (now >= critter.turnAt) {
    retargetCritterHeading(critter, now);
  }

  if (now >= critter.nextDashAt) {
    beginDash(critter, now);
  }

  if (now >= critter.dashEndsAt) {
    critter.dashMultiplier = 1;
  }

  const speedNow = Math.max(1, Math.hypot(critter.vx, critter.vy));
  let targetSpeed =
    critter.baseSpeed *
    critter.dashMultiplier *
    (state.idleAssist.active ? GAME_CONFIG.idleAssistSpeedMultiplier : 1);
  let heading = Math.atan2(critter.vy, critter.vx);

  const sway =
    Math.sin(now * critter.type.swaySpeed + critter.wobbleOffset) * critter.type.swayAmount;
  heading += sway * dtSeconds;

  const touchInfluence = getTouchInfluence(critter, now);
  if (touchInfluence.weight > 0) {
    const fleeHeading = Math.atan2(touchInfluence.y, touchInfluence.x);
    heading = heading * 0.72 + fleeHeading * 0.28;
    targetSpeed *= 1.06;
  }

  const adjustedSpeed = speedNow + (targetSpeed - speedNow) * 0.08;
  critter.vx = Math.cos(heading) * adjustedSpeed;
  critter.vy = Math.sin(heading) * adjustedSpeed;
  critter.x += critter.vx * dtSeconds;
  critter.y += critter.vy * dtSeconds;

  const bounds = getPlayBounds(getDisplaySize(critter, now) * 0.55);
  let bounced = false;

  if (critter.x <= bounds.left || critter.x >= bounds.right) {
    critter.x = clamp(critter.x, bounds.left, bounds.right);
    critter.vx *= -1;
    bounced = true;
  }

  if (critter.y <= bounds.top || critter.y >= bounds.bottom) {
    critter.y = clamp(critter.y, bounds.top, bounds.bottom);
    critter.vy *= -1;
    bounced = true;
  }

  if (bounced) {
    critter.turnAt = now + randomBetween(220, 520);
    critter.nextDashAt = Math.max(critter.nextDashAt, now + randomBetween(300, 760));
  }

  critter.angle = Math.atan2(critter.vy, critter.vx);
}

function updateEffects(now) {
  state.ripples = state.ripples.filter((ripple) => now - ripple.bornAt <= ripple.durationMs);
  state.bursts = state.bursts.filter((burst) => now - burst.bornAt <= burst.durationMs);
  state.scorePops = state.scorePops.filter((scorePop) => now - scorePop.bornAt <= scorePop.durationMs);
  state.rewardTrails = state.rewardTrails.filter(
    (rewardTrail) => now - rewardTrail.bornAt <= rewardTrail.durationMs,
  );
}

function updateGame(now) {
  const dtMs = Math.min(40, now - state.lastFrameAt || 16.6);
  const dtSeconds = dtMs / 1000;

  state.lastFrameAt = now;

  if (state.phase === "playing") {
    scheduleBackgroundMusic();
    state.elapsedMs = now - state.sessionStartAt;

    if (!state.idleAssist.active && now - state.lastSuccessfulHitAt >= GAME_CONFIG.idleAssistDelayMs) {
      activateIdleAssist(now);
    }

    syncHud();
  }

  for (const critter of state.critters) {
    updateCritter(critter, dtSeconds, now);
  }

  updateEffects(now);
}

function drawActiveTouches() {
  for (const touch of state.activeTouches.values()) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fffaf4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(touch.x, touch.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRipples(now) {
  for (const ripple of state.ripples) {
    const age = now - ripple.bornAt;
    const progress = clamp(age / ripple.durationMs, 0, 1);
    const radius =
      ripple.startRadius + (ripple.endRadius - ripple.startRadius) * easeOutCubic(progress);

    ctx.save();
    ctx.globalAlpha = 0.38 * (1 - progress);
    ctx.strokeStyle = ripple.color;
    ctx.lineWidth = 5 - progress * 2.6;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBursts(now) {
  for (const burst of state.bursts) {
    const age = now - burst.bornAt;
    const progress = clamp(age / burst.durationMs, 0, 1);

    ctx.save();
    ctx.fillStyle = burst.color;
    ctx.globalAlpha = 0.68 * (1 - progress);

    for (const particle of burst.particles) {
      const travel = particle.distance * easeOutCubic(progress);
      const px = burst.x + Math.cos(particle.angle) * travel;
      const py = burst.y + Math.sin(particle.angle) * travel;
      const radius = particle.radius * (1 - progress * 0.42);

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawScorePops(now) {
  for (const scorePop of state.scorePops) {
    const age = now - scorePop.bornAt;
    const progress = clamp(age / scorePop.durationMs, 0, 1);
    const rise = 32 * easeOutCubic(progress);

    ctx.save();
    ctx.globalAlpha = 0.95 * (1 - progress);
    ctx.fillStyle = scorePop.color;
    ctx.strokeStyle = "rgba(22, 50, 44, 0.18)";
    ctx.lineWidth = 6;
    ctx.font = "700 28px Trebuchet MS, Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(scorePop.text, scorePop.x, scorePop.y - rise);
    ctx.fillText(scorePop.text, scorePop.x, scorePop.y - rise);
    ctx.restore();
  }
}

function drawRewardTrails(now) {
  for (const rewardTrail of state.rewardTrails) {
    const age = now - rewardTrail.bornAt;
    const progress = clamp(age / rewardTrail.durationMs, 0, 1);
    const eased = easeOutCubic(progress);
    const x = rewardTrail.startX + (rewardTrail.endX - rewardTrail.startX) * eased;
    const y = rewardTrail.startY + (rewardTrail.endY - rewardTrail.startY) * eased;

    ctx.save();
    ctx.globalAlpha = 0.92 * (1 - progress * 0.35);
    ctx.fillStyle = rewardTrail.color;
    ctx.beginPath();
    ctx.arc(x, y, 11 - progress * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.35 * (1 - progress);
    ctx.strokeStyle = rewardTrail.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rewardTrail.startX, rewardTrail.startY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawIdleAssistHalo(critter, now, size) {
  if (!state.idleAssist.active) {
    return;
  }

  const pulse =
    1 + Math.sin((now - state.idleAssist.activatedAt + critter.animationOffset * 200) * 0.01) * 0.04;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.globalAlpha = GAME_CONFIG.idleAssistGlowStrength;
  ctx.fillStyle = "#fff5ce";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.72 * pulse, size * 0.5 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVariantAura(critter, size) {
  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.globalAlpha = critter.variant.name === "bumper" ? 0.18 : 0.24;
  ctx.fillStyle = critter.variant.name === "bumper" ? "#ffe9a8" : "#c5fff0";
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCritters(now) {
  for (const critter of state.critters) {
    if (critter.state !== "alive") {
      continue;
    }

    const displaySize = getDisplaySize(critter, now);

    drawVariantAura(critter, displaySize);
    drawIdleAssistHalo(critter, now, displaySize);
    critter.type.draw(critter, now);
  }
}

function drawScene(now) {
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawRipples(now);
  drawRewardTrails(now);
  drawCritters(now);
  drawBursts(now);
  drawScorePops(now);
  drawActiveTouches();
}

function drawBeetle(critter, now) {
  const size = getDisplaySize(critter, now);
  const flap = Math.sin(now * 0.012 + critter.animationOffset) * 0.18;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(size / 76, size / 76);

  ctx.fillStyle = critter.type.palette.shadow;
  ctx.beginPath();
  ctx.ellipse(3, 18, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = critter.type.palette.body;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-10, side * 8);
    ctx.lineTo(-28, side * (18 + flap * 5));
    ctx.moveTo(4, side * 8);
    ctx.lineTo(28, side * (18 - flap * 5));
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(18, -6);
  ctx.quadraticCurveTo(30, -12, 36, -24);
  ctx.moveTo(18, 6);
  ctx.quadraticCurveTo(30, 12, 36, 24);
  ctx.stroke();

  ctx.fillStyle = critter.type.palette.body;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 28, 21, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = critter.type.palette.accent;
  ctx.beginPath();
  ctx.ellipse(14, 0, 17, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.36)";
  ctx.beginPath();
  ctx.arc(18, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMinnow(critter, now) {
  const size = getDisplaySize(critter, now);
  const wiggle = Math.sin(now * 0.014 + critter.animationOffset) * 5;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(size / 80, size / 80);

  ctx.fillStyle = critter.type.palette.shadow;
  ctx.beginPath();
  ctx.ellipse(-2, 18, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = critter.type.palette.body;
  ctx.beginPath();
  ctx.moveTo(-34, 0);
  ctx.quadraticCurveTo(-8, -22, 22, -4);
  ctx.quadraticCurveTo(36, 0, 22, 4);
  ctx.quadraticCurveTo(-8, 22, -34, 0);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-38, 0);
  ctx.lineTo(-58, -16 - wiggle * 0.25);
  ctx.lineTo(-50, 0);
  ctx.lineTo(-58, 16 + wiggle * 0.25);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = critter.type.palette.accent;
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.quadraticCurveTo(6, -20 - wiggle * 0.5, 18, -10);
  ctx.quadraticCurveTo(6, -6, -2, -4);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.beginPath();
  ctx.arc(18, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = critter.type.palette.shadow;
  ctx.beginPath();
  ctx.arc(18, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMouse(critter, now) {
  const size = getDisplaySize(critter, now);
  const tailSwing = Math.sin(now * 0.013 + critter.animationOffset) * 10;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(size / 78, size / 78);

  ctx.fillStyle = critter.type.palette.shadow;
  ctx.beginPath();
  ctx.ellipse(-6, 18, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#c59274";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-30, 6);
  ctx.quadraticCurveTo(-56, 18 + tailSwing * 0.3, -66, -6 + tailSwing * 0.55);
  ctx.stroke();

  ctx.fillStyle = critter.type.palette.body;
  ctx.beginPath();
  ctx.ellipse(-4, 0, 28, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(18, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = critter.type.palette.accent;
  ctx.beginPath();
  ctx.arc(8, -14, 8, 0, Math.PI * 2);
  ctx.arc(8, 14, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fffaf4";
  ctx.beginPath();
  ctx.arc(24, -3, 3.8, 0, Math.PI * 2);
  ctx.arc(24, 3, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = critter.type.palette.shadow;
  ctx.beginPath();
  ctx.arc(24, -3, 1.5, 0, Math.PI * 2);
  ctx.arc(24, 3, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function gameLoop(now) {
  updateGame(now);
  drawScene(now);
  state.animationFrame = window.requestAnimationFrame(gameLoop);
}

function beginHoldStop() {
  if (state.phase !== "playing" || state.holdStop.active) {
    return;
  }

  state.holdStop.active = true;
  state.holdStop.startedAt = performance.now();
  controlHint.textContent = "Keep holding to stop";

  const step = () => {
    if (!state.holdStop.active) {
      return;
    }

    const progress = clamp(
      (performance.now() - state.holdStop.startedAt) / GAME_CONFIG.holdToStopMs,
      0,
      1,
    );
    stopButton.style.setProperty("--hold-progress", `${progress * 100}%`);

    if (progress >= 1) {
      stopButton.style.setProperty("--hold-progress", "100%");
      stopSession();
      return;
    }

    state.holdStop.rafId = window.requestAnimationFrame(step);
  };

  step();
}

function cancelHoldStop() {
  state.holdStop.active = false;
  if (state.holdStop.rafId) {
    window.cancelAnimationFrame(state.holdStop.rafId);
    state.holdStop.rafId = 0;
  }

  stopButton.style.setProperty("--hold-progress", "0%");
  controlHint.textContent = state.phase === "playing" ? "Hold to stop play" : "Human control";
}

function preventPlayInterruptions(event) {
  if (state.phase === "playing") {
    event.preventDefault();
  }
}

async function toggleFullscreen() {
  if (!state.fullscreenSupported) {
    updateFullscreenButton();
    return;
  }

  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch (_error) {
    // Keep the game usable if the browser rejects fullscreen.
  } finally {
    updateFullscreenButton();
  }
}

function boot() {
  resizeCanvas();
  syncHud();
  setPhase("idle");
  updateFullscreenButton();
  state.lastFrameAt = performance.now();
  state.animationFrame = window.requestAnimationFrame(gameLoop);
}

canvas.addEventListener("pointerdown", (event) => {
  if (state.phase !== "playing") {
    return;
  }

  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  registerTouch(event, false);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.activeTouches.has(event.pointerId)) {
    return;
  }

  event.preventDefault();
  registerTouch(event, true);
});

canvas.addEventListener("pointerup", clearTouch);
canvas.addEventListener("pointercancel", clearTouch);
canvas.addEventListener("lostpointercapture", clearTouch);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => window.setTimeout(resizeCanvas, 120));
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAmbientBed();
  } else if (state.phase === "playing") {
    startAmbientBed();
  }
});
document.addEventListener("selectstart", preventPlayInterruptions);
document.addEventListener("dragstart", preventPlayInterruptions);
document.addEventListener("gesturestart", preventPlayInterruptions);
document.addEventListener("gesturechange", preventPlayInterruptions);
document.addEventListener("gestureend", preventPlayInterruptions);
document.addEventListener(
  "touchmove",
  (event) => {
    if (state.phase === "playing") {
      event.preventDefault();
    }
  },
  { passive: false },
);

startButton.addEventListener("click", () => {
  startButton.blur();
  startSession();
});
restartButton.addEventListener("click", () => {
  restartButton.blur();
  startSession();
});

stopButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  beginHoldStop();
});
stopButton.addEventListener("pointerup", cancelHoldStop);
stopButton.addEventListener("pointercancel", cancelHoldStop);
stopButton.addEventListener("pointerleave", cancelHoldStop);
stopButton.addEventListener("lostpointercapture", cancelHoldStop);
fullscreenButton.addEventListener("click", () => {
  fullscreenButton.blur();
  toggleFullscreen();
});

boot();
