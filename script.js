"use strict";

const GAME_CONFIG = Object.freeze({
  roundDurationMs: 45000,
  critterCount: 6,
  portraitCritterCount: 5,
  critterSizeRange: { min: 70, max: 110 },
  speedRange: { min: 70, max: 132 },
  hitPadding: 32,
  respawnDelayMs: 170,
  burstDurationMs: 320,
  rippleDurationMs: 280,
  scorePopDurationMs: 580,
  touchRippleIntervalMs: 70,
  lureCueIntervalMs: { min: 2800, max: 5200 },
  musicStepSec: 0.34,
  musicLookAheadSec: 0.28,
  playInsets: { top: 92, right: 26, bottom: 28, left: 26 },
});

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreValue = document.getElementById("scoreValue");
const timeValue = document.getElementById("timeValue");
const finalScore = document.getElementById("finalScore");
const startOverlay = document.getElementById("startOverlay");
const resultOverlay = document.getElementById("resultOverlay");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const CRITTER_TYPES = [
  {
    name: "beetle",
    palette: { body: "#166d67", accent: "#f9d27d", shadow: "rgba(7, 56, 53, 0.24)" },
    swayAmount: 0.62,
    swaySpeed: 0.0036,
    turnWindowMs: [900, 1700],
    speedFactor: 0.92,
    draw: drawBeetle,
  },
  {
    name: "minnow",
    palette: { body: "#f17457", accent: "#fff3e3", shadow: "rgba(125, 51, 34, 0.24)" },
    swayAmount: 0.35,
    swaySpeed: 0.0048,
    turnWindowMs: [1100, 1900],
    speedFactor: 1.04,
    draw: drawMinnow,
  },
  {
    name: "mouse",
    palette: { body: "#7b5f4b", accent: "#f8e3ca", shadow: "rgba(56, 38, 28, 0.24)" },
    swayAmount: 0.5,
    swaySpeed: 0.0042,
    turnWindowMs: [700, 1300],
    speedFactor: 1.09,
    draw: drawMouse,
  },
];

const CRITTER_VARIANTS = [
  {
    name: "bumper",
    weight: 0.44,
    sizeMultiplier: 1.42,
    speedMultiplier: 0.76,
    points: 1,
    scoreColor: "#fff4c7",
    rippleColor: "rgba(255, 223, 136, 0.72)",
  },
  {
    name: "zipper",
    weight: 0.56,
    sizeMultiplier: 0.86,
    speedMultiplier: 1.58,
    points: 3,
    scoreColor: "#ddfff4",
    rippleColor: "rgba(148, 255, 220, 0.74)",
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
  remainingMs: GAME_CONFIG.roundDurationMs,
  roundEndsAt: 0,
  critters: [],
  activeTouches: new Map(),
  ripples: [],
  bursts: [],
  scorePops: [],
  viewport: { width: window.innerWidth, height: window.innerHeight, dpr: 1 },
  lastFrameAt: performance.now(),
  animationFrame: 0,
  nextLureAt: 0,
  audio: {
    context: null,
    masterGain: null,
    ambient: null,
    music: null,
    unlocked: false,
  },
};

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scheduleFromRange(range, now) {
  return now + randomBetween(range.min, range.max);
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

function currentTimeSeconds() {
  return Math.ceil(state.remainingMs / 1000);
}

function getDesiredCritterCount() {
  return state.viewport.width > state.viewport.height
    ? GAME_CONFIG.critterCount
    : GAME_CONFIG.portraitCritterCount;
}

function getCritterSizeRange() {
  const scale = clamp(Math.min(state.viewport.width, state.viewport.height) / 820, 0.96, 1.28);
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

function resizeCanvas() {
  state.viewport.width = window.innerWidth;
  state.viewport.height = window.innerHeight;
  state.viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.floor(state.viewport.width * state.viewport.dpr);
  canvas.height = Math.floor(state.viewport.height * state.viewport.dpr);
  ctx.setTransform(state.viewport.dpr, 0, 0, state.viewport.dpr, 0, 0);

  reconcileCritterCount(performance.now());
  clampCrittersInsideBounds();
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
    hitRadius: 0,
    angle: 0,
    wobbleOffset: randomBetween(0, Math.PI * 2),
    animationOffset: randomBetween(0, Math.PI * 2),
    turnAt: now,
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
  const bounds = getPlayBounds(size * 0.55);
  const angle = randomBetween(0, Math.PI * 2);
  const speed =
    randomBetween(GAME_CONFIG.speedRange.min, GAME_CONFIG.speedRange.max) *
    type.speedFactor *
    variant.speedMultiplier;

  critter.type = type;
  critter.variant = variant;
  critter.size = size;
  critter.hitRadius = size * 0.5 + GAME_CONFIG.hitPadding;
  critter.x = randomBetween(bounds.left, bounds.right);
  critter.y = randomBetween(bounds.top, bounds.bottom);
  critter.vx = Math.cos(angle) * speed;
  critter.vy = Math.sin(angle) * speed;
  critter.angle = angle;
  critter.turnAt = now + randomBetween(type.turnWindowMs[0], type.turnWindowMs[1]);
  critter.state = "alive";
  critter.respawnAt = 0;

  if (!freshSpawn) {
    createRipple(critter.x, critter.y, variant.rippleColor, 24, 44);
  }
}

function clampCrittersInsideBounds() {
  for (const critter of state.critters) {
    const bounds = getPlayBounds(critter.size * 0.55 || 30);
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
  timeValue.textContent = String(currentTimeSeconds());
}

function startRound() {
  const now = performance.now();
  unlockAudio();
  state.score = 0;
  state.remainingMs = GAME_CONFIG.roundDurationMs;
  state.roundEndsAt = now + GAME_CONFIG.roundDurationMs;
  state.ripples.length = 0;
  state.bursts.length = 0;
  state.scorePops.length = 0;
  state.activeTouches.clear();
  state.nextLureAt = scheduleFromRange(GAME_CONFIG.lureCueIntervalMs, now);

  reconcileCritterCount(now);
  for (const critter of state.critters) {
    respawnCritter(critter, now, true);
  }

  setPhase("playing");
  syncHud();
  requestImmersiveMode();
  startAmbientBed();
  playStartCue();
}

function endRound() {
  state.remainingMs = 0;
  syncHud();
  setPhase("results");
  stopAmbientBed();
  playRoundEndCue();
}

function requestImmersiveMode() {
  const root = document.documentElement;

  if (document.fullscreenElement || !root.requestFullscreen) {
    return;
  }

  root.requestFullscreen().catch(() => {});
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

  for (let index = 0; index < 7; index += 1) {
    const angle = (Math.PI * 2 * index) / 7 + randomBetween(-0.12, 0.12);
    particles.push({
      angle,
      distance: randomBetween(18, 42),
      radius: randomBetween(3, 6),
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

function unlockAudio() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  if (!state.audio.context) {
    const context = new AudioContextCtor();
    const masterGain = context.createGain();

    masterGain.gain.value = 0.095;
    masterGain.connect(context.destination);

    state.audio.context = context;
    state.audio.masterGain = masterGain;
  }

  const { context } = state.audio;

  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  state.audio.unlocked = true;
}

function startAmbientBed() {
  const { context, masterGain, unlocked, ambient } = state.audio;

  if (!unlocked || !context || !masterGain || ambient) {
    return;
  }

  const startAt = context.currentTime;
  const filter = context.createBiquadFilter();
  const ambientGain = context.createGain();
  const shimmerGain = context.createGain();
  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();
  const drones = [
    { type: "sine", frequency: 196, gain: 0.12, detune: -3 },
    { type: "triangle", frequency: 247, gain: 0.085, detune: 4 },
    { type: "sine", frequency: 392, gain: 0.038, detune: 6 },
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
  filter.frequency.setValueAtTime(1280, startAt);
  filter.Q.value = 0.7;

  ambientGain.gain.setValueAtTime(0.0001, startAt);
  ambientGain.gain.linearRampToValueAtTime(0.58, startAt + 1.1);
  shimmerGain.gain.setValueAtTime(0.0001, startAt);
  shimmerGain.gain.linearRampToValueAtTime(0.62, startAt + 1.2);

  filter.connect(ambientGain);
  ambientGain.connect(shimmerGain);
  shimmerGain.connect(masterGain);

  pulse.type = "sine";
  pulse.frequency.setValueAtTime(0.28, startAt);
  pulseDepth.gain.setValueAtTime(0.04, startAt);
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

  const stopAt = context.currentTime + 0.55;

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
  if (!unlocked || !context || !masterGain) {
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
        volume: 0.2,
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
        volume: 0.14,
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
        volume: 0.13,
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
        volume: 0.08,
        delay: delay + 0.14,
        filterFrequency: 3600,
      });
    }

    music.nextAt += GAME_CONFIG.musicStepSec;
    music.step = (music.step + 1) % MUSIC_PATTERN.length;
  }
}

function playStartCue() {
  playTone({ frequency: 520, type: "triangle", duration: 0.18, volume: 0.42 });
  playTone({ frequency: 658, type: "sine", duration: 0.16, volume: 0.34, delay: 0.08 });
  playTone({ frequency: 784, type: "triangle", duration: 0.14, volume: 0.26, delay: 0.16 });
}

function playCatchCue(critter) {
  if (critter.type.name === "minnow") {
    playTone({
      frequency: 360,
      endFrequency: 510,
      type: "sine",
      duration: 0.07,
      volume: 0.14,
      filterFrequency: 2200,
    });
    playTone({
      frequency: 510,
      endFrequency: 760,
      type: "sine",
      duration: 0.09,
      volume: 0.13,
      delay: 0.05,
      filterFrequency: 2600,
    });
    playTone({
      frequency: 420,
      endFrequency: 620,
      type: "triangle",
      duration: 0.08,
      volume: 0.09,
      delay: 0.1,
      filterFrequency: 2400,
    });
    return;
  }

  if (critter.type.name === "mouse") {
    playTone({
      frequency: 1320,
      endFrequency: 1710,
      type: "square",
      duration: 0.05,
      volume: 0.16,
      filterFrequency: 4200,
    });
    playTone({
      frequency: 1160,
      endFrequency: 1480,
      type: "triangle",
      duration: 0.065,
      volume: 0.15,
      delay: 0.04,
      filterFrequency: 3600,
    });
    return;
  }

  playTone({
    frequency: 340,
    endFrequency: 430,
    type: "triangle",
    duration: 0.08,
    volume: 0.11,
    filterFrequency: 2200,
  });
  playTone({
    frequency: 460,
    endFrequency: 330,
    type: "sawtooth",
    duration: 0.055,
    volume: 0.08,
    delay: 0.03,
    filterFrequency: 2100,
  });
}

function playVariantCatchCue(critter) {
  if (critter.variant.name === "bumper") {
    playTone({
      frequency: 246,
      endFrequency: 212,
      type: "triangle",
      duration: 0.16,
      volume: 0.24,
      filterFrequency: 1800,
    });
    playTone({
      frequency: 362,
      endFrequency: 328,
      type: "sine",
      duration: 0.18,
      volume: 0.19,
      delay: 0.06,
      filterFrequency: 1900,
    });
    return;
  }

  playTone({
    frequency: 980,
    endFrequency: 1220,
    type: "square",
    duration: 0.06,
    volume: 0.15,
    attack: 0.004,
    filterFrequency: 3600,
  });
  playTone({
    frequency: 1480,
    endFrequency: 1780,
    type: "triangle",
    duration: 0.1,
    volume: 0.22,
    delay: 0.03,
    attack: 0.003,
    filterFrequency: 3800,
  });
}

function playLureCue() {
  playTone({ frequency: 960, type: "sine", duration: 0.12, volume: 0.12, attack: 0.005 });
  playTone({
    frequency: 720,
    type: "triangle",
    duration: 0.16,
    volume: 0.1,
    delay: 0.08,
    attack: 0.008,
  });
  playTone({
    frequency: 1180,
    type: "sine",
    duration: 0.09,
    volume: 0.08,
    delay: 0.16,
    attack: 0.004,
  });
}

function playRoundEndCue() {
  playTone({ frequency: 690, type: "triangle", duration: 0.15, volume: 0.22 });
  playTone({ frequency: 520, type: "sine", duration: 0.22, volume: 0.18, delay: 0.11 });
}

function registerTouch(event, isMove) {
  if (state.phase !== "playing") {
    return;
  }

  unlockAudio();
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  const now = performance.now();
  const activeTouch = state.activeTouches.get(event.pointerId);

  if (!activeTouch) {
    state.activeTouches.set(event.pointerId, {
      x: point.x,
      y: point.y,
      lastRippleAt: now,
    });
    createRipple(point.x, point.y, "rgba(255, 250, 244, 0.8)", 14, 30);
  } else {
    activeTouch.x = point.x;
    activeTouch.y = point.y;

    if (isMove && now - activeTouch.lastRippleAt >= GAME_CONFIG.touchRippleIntervalMs) {
      activeTouch.lastRippleAt = now;
      createRipple(point.x, point.y, "rgba(255, 250, 244, 0.5)", 10, 22);
    }
  }

  tryHitCritter(point.x, point.y, now);
}

function clearTouch(event) {
  state.activeTouches.delete(event.pointerId);
}

function tryHitCritter(x, y, now) {
  let closestCritter = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const critter of state.critters) {
    if (critter.state !== "alive") {
      continue;
    }

    const distance = Math.hypot(critter.x - x, critter.y - y);
    if (distance <= critter.hitRadius && distance < closestDistance) {
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
  syncHud();
  createRipple(x, y, closestCritter.variant.rippleColor, 18, 36);
  createBurst(closestCritter.x, closestCritter.y, closestCritter.type.palette.accent);
  createScorePop(
    closestCritter.x,
    closestCritter.y - closestCritter.size * 0.18,
    `+${closestCritter.variant.points}`,
    closestCritter.variant.scoreColor,
  );
  playCatchCue(closestCritter);
  playVariantCatchCue(closestCritter);
}

function nudgeCritterHeading(critter, now) {
  const heading = Math.atan2(critter.vy, critter.vx) + randomBetween(-0.95, 0.95);
  const speed = Math.hypot(critter.vx, critter.vy);
  critter.vx = Math.cos(heading) * speed;
  critter.vy = Math.sin(heading) * speed;
  critter.turnAt = now + randomBetween(critter.type.turnWindowMs[0], critter.type.turnWindowMs[1]);
}

function updateCritter(critter, dtSeconds, now) {
  if (critter.state === "bursting") {
    if (now >= critter.respawnAt) {
      respawnCritter(critter, now, false);
    }
    return;
  }

  if (now >= critter.turnAt) {
    nudgeCritterHeading(critter, now);
  }

  const speed = Math.hypot(critter.vx, critter.vy);
  const currentHeading = Math.atan2(critter.vy, critter.vx);
  const sway =
    Math.sin(now * critter.type.swaySpeed + critter.wobbleOffset) * critter.type.swayAmount;
  const heading = currentHeading + sway * dtSeconds;

  critter.vx = Math.cos(heading) * speed;
  critter.vy = Math.sin(heading) * speed;
  critter.x += critter.vx * dtSeconds;
  critter.y += critter.vy * dtSeconds;

  const bounds = getPlayBounds(critter.size * 0.55);

  if (critter.x <= bounds.left || critter.x >= bounds.right) {
    critter.x = clamp(critter.x, bounds.left, bounds.right);
    critter.vx *= -1;
  }

  if (critter.y <= bounds.top || critter.y >= bounds.bottom) {
    critter.y = clamp(critter.y, bounds.top, bounds.bottom);
    critter.vy *= -1;
  }

  critter.angle = Math.atan2(critter.vy, critter.vx);
}

function updateEffects(now) {
  state.ripples = state.ripples.filter((ripple) => now - ripple.bornAt <= ripple.durationMs);
  state.bursts = state.bursts.filter((burst) => now - burst.bornAt <= burst.durationMs);
  state.scorePops = state.scorePops.filter((scorePop) => now - scorePop.bornAt <= scorePop.durationMs);
}

function updateGame(now) {
  const dtMs = Math.min(40, now - state.lastFrameAt || 16.6);
  const dtSeconds = dtMs / 1000;

  state.lastFrameAt = now;

  if (state.phase === "playing") {
    scheduleBackgroundMusic();
  }

  if (state.phase === "playing") {
    state.remainingMs = Math.max(0, state.roundEndsAt - now);
    if (state.remainingMs <= 0) {
      endRound();
    } else {
      syncHud();

      if (state.audio.unlocked && now >= state.nextLureAt) {
        playLureCue();
        state.nextLureAt = scheduleFromRange(GAME_CONFIG.lureCueIntervalMs, now);
      }
    }
  }

  for (const critter of state.critters) {
    updateCritter(critter, dtSeconds, now);
  }

  updateEffects(now);
}

function drawActiveTouches() {
  for (const touch of state.activeTouches.values()) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#fffaf4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(touch.x, touch.y, 22, 0, Math.PI * 2);
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
    ctx.globalAlpha = 0.35 * (1 - progress);
    ctx.strokeStyle = ripple.color;
    ctx.lineWidth = 4 - progress * 2.4;
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
    ctx.globalAlpha = 0.6 * (1 - progress);

    for (const particle of burst.particles) {
      const travel = particle.distance * easeOutCubic(progress);
      const px = burst.x + Math.cos(particle.angle) * travel;
      const py = burst.y + Math.sin(particle.angle) * travel;
      const radius = particle.radius * (1 - progress * 0.45);

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
    const rise = 26 * easeOutCubic(progress);

    ctx.save();
    ctx.globalAlpha = 0.95 * (1 - progress);
    ctx.fillStyle = scorePop.color;
    ctx.strokeStyle = "rgba(22, 50, 44, 0.18)";
    ctx.lineWidth = 5;
    ctx.font = "700 24px Trebuchet MS, Avenir Next, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(scorePop.text, scorePop.x, scorePop.y - rise);
    ctx.fillText(scorePop.text, scorePop.x, scorePop.y - rise);
    ctx.restore();
  }
}

function drawCritters(now) {
  for (const critter of state.critters) {
    if (critter.state !== "alive") {
      continue;
    }

    critter.type.draw(critter, now);
  }
}

function drawScene(now) {
  ctx.clearRect(0, 0, state.viewport.width, state.viewport.height);
  drawRipples(now);
  drawCritters(now);
  drawBursts(now);
  drawScorePops(now);
  drawActiveTouches();
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function drawBeetle(critter, now) {
  const flap = Math.sin(now * 0.012 + critter.animationOffset) * 0.18;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(critter.size / 76, critter.size / 76);

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

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.beginPath();
  ctx.arc(18, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMinnow(critter, now) {
  const wiggle = Math.sin(now * 0.014 + critter.animationOffset) * 5;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(critter.size / 80, critter.size / 80);

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

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
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
  const tailSwing = Math.sin(now * 0.013 + critter.animationOffset) * 10;

  ctx.save();
  ctx.translate(critter.x, critter.y);
  ctx.rotate(critter.angle);
  ctx.scale(critter.size / 78, critter.size / 78);

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

function boot() {
  resizeCanvas();
  syncHud();
  setPhase("idle");
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
startButton.addEventListener("click", startRound);
restartButton.addEventListener("click", startRound);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAmbientBed();
  } else if (state.phase === "playing") {
    startAmbientBed();
  }
});

boot();
