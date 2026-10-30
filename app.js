// State Management
const state = {
  posX: 180,
  posY: 130,
  scale: 100,
  rotation: 0,
  opacity: 100,
  blendMode: 'normal',
  easing: 'linear',
  fps: 30, // Dynamic Frame Rate (Multimedia standard)
  currentTime: 0, // in seconds (0 to 5)
  duration: 5,
  isPlaying: false,
  gridVisible: false,
  keyframes: [
    { time: 0, posX: 80, posY: 60, scale: 70, rotation: 0, opacity: 100 },
    { time: 2.5, posX: 350, posY: 180, scale: 140, rotation: 180, opacity: 90 },
    { time: 5, posX: 180, posY: 120, scale: 100, rotation: 360, opacity: 100 }
  ]
};

// DOM Elements
const animTarget = document.getElementById('anim-target');
const sliderPosX = document.getElementById('slider-pos-x');
const sliderPosY = document.getElementById('slider-pos-y');
const sliderScale = document.getElementById('slider-scale');
const sliderRot = document.getElementById('slider-rot');
const sliderOpacity = document.getElementById('slider-opacity');

const valPosX = document.getElementById('val-pos-x');
const valPosY = document.getElementById('val-pos-y');
const valScale = document.getElementById('val-scale');
const valRot = document.getElementById('val-rot');
const valOpacity = document.getElementById('val-opacity');

const selectBlendMode = document.getElementById('select-blend-mode');
const blendExplanation = document.getElementById('blend-explanation');
const selectEasing = document.getElementById('select-easing');
const selectBgMode = document.getElementById('select-bg-mode');
const bgLayer = document.querySelector('.background-layer');

const viewportEl = document.getElementById('viewport');
const btnToggleFullscreen = document.getElementById('btn-toggle-maximize');

const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const btnAddKeyframe = document.getElementById('btn-add-keyframe');
const btnDelKeyframe = document.getElementById('btn-del-keyframe');
const selectFps = document.getElementById('select-fps');
const btnToggleGrid = document.getElementById('btn-toggle-grid');
const btnReset = document.getElementById('btn-reset');

const grid = document.getElementById('grid');
const playhead = document.getElementById('playhead');
const timecode = document.getElementById('timecode');
const timelineTrack = document.getElementById('timeline-track');
const keyframesContainer = document.getElementById('keyframes-container');

// Blending Mode Descriptions (Multimedia Concepts)
const blendDescriptions = {
  normal: 'النمط الحالي: <strong>Normal</strong> (لا يوجد معالجة رياضية للألوان).',
  multiply: 'النمط الحالي: <strong>Multiply</strong> [C = A × B] - يقوم بضرب قيم البكسلات فيغمق المشهد ويعزل الألوان البيضاء.',
  screen: 'النمط الحالي: <strong>Screen</strong> [C = 1 - (1-A)(1-B)] - يعكس ويضرب البكسلات فيفتح المشهد ويعزل الخلفيات السوداء.',
  overlay: 'النمط الحالي: <strong>Overlay</strong> - يدمج بين Multiply و Screen بناءً على شدة إضاءة الطبقة السفلية لزيادة التباين.',
  difference: 'النمط الحالي: <strong>Difference</strong> [C = |A - B|] - يطرح قيم البكسلات، ممتاز لاكتشاف الفروقات وتحليل الحركة.'
};

// Update Object Visuals
function updateViewport() {
  animTarget.style.left = `${state.posX}px`;
  animTarget.style.top = `${state.posY}px`;
  animTarget.style.transform = `scale(${state.scale / 100}) rotate(${state.rotation}deg)`;
  animTarget.style.opacity = state.opacity / 100;
  animTarget.style.mixBlendMode = state.blendMode;

  // Sync sliders and labels
  sliderPosX.value = state.posX;
  sliderPosY.value = state.posY;
  sliderScale.value = state.scale;
  sliderRot.value = state.rotation;
  sliderOpacity.value = state.opacity;

  valPosX.textContent = `${Math.round(state.posX)}px`;
  valPosY.textContent = `${Math.round(state.posY)}px`;
  valScale.textContent = `${Math.round(state.scale)}%`;
  valRot.textContent = `${Math.round(state.rotation)}°`;
  valOpacity.textContent = `${Math.round(state.opacity)}%`;
}

// Render Keyframe Markers on Timeline
function renderKeyframes() {
  keyframesContainer.innerHTML = '';
  state.keyframes.forEach((kf, index) => {
    const diamond = document.createElement('div');
    diamond.classList.add('keyframe-diamond');
    const percent = (kf.time / state.duration) * 100;
    diamond.style.left = `${percent}%`;
    diamond.title = `Keyframe at ${kf.time.toFixed(1)}s (اضغط للتحديد | دبل كليك للحذف)`;

    // Highlight if selected
    if (Math.abs(state.currentTime - kf.time) < 0.15) {
      diamond.classList.add('active');
    }

    diamond.addEventListener('click', (e) => {
      e.stopPropagation();
      seekToTime(kf.time);
      // Load this keyframe's exact values into current state & sliders
      state.posX = kf.posX;
      state.posY = kf.posY;
      state.scale = kf.scale;
      state.rotation = kf.rotation;
      state.opacity = kf.opacity;
      updateViewport();
    });

    // Double click to delete directly
    diamond.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      deleteKeyframeAt(kf.time);
    });

    keyframesContainer.appendChild(diamond);
  });
}

// Easing Functions (Temporal Interpolation)
function applyEasing(t, type) {
  switch (type) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return t * (2 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'linear':
    default:
      return t;
  }
}

// Interpolation Engine (Calculates transforms between keyframes)
function evaluateTimeline(time) {
  if (state.keyframes.length === 0) return;

  // Sort keyframes by time
  const sorted = [...state.keyframes].sort((a, b) => a.time - b.time);

  // If time is before first keyframe
  if (time <= sorted[0].time) {
    applyKeyframeValues(sorted[0]);
    return;
  }

  // If time is after last keyframe
  if (time >= sorted[sorted.length - 1].time) {
    applyKeyframeValues(sorted[sorted.length - 1]);
    return;
  }

  // Find surrounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kf1 = sorted[i];
    const kf2 = sorted[i + 1];

    if (time >= kf1.time && time <= kf2.time) {
      const segmentDuration = kf2.time - kf1.time;
      let progress = (time - kf1.time) / segmentDuration;

      // Apply Easing (Interpolation curve)
      progress = applyEasing(progress, state.easing);

      // Linear Interpolation (LERP) formula: A + (B - A) * t
      state.posX = kf1.posX + (kf2.posX - kf1.posX) * progress;
      state.posY = kf1.posY + (kf2.posY - kf1.posY) * progress;
      state.scale = kf1.scale + (kf2.scale - kf1.scale) * progress;
      state.rotation = kf1.rotation + (kf2.rotation - kf1.rotation) * progress;
      state.opacity = kf1.opacity + (kf2.opacity - kf1.opacity) * progress;

      updateViewport();
      break;
    }
  }
}

function applyKeyframeValues(kf) {
  state.posX = kf.posX;
  state.posY = kf.posY;
  state.scale = kf.scale;
  state.rotation = kf.rotation;
  state.opacity = kf.opacity;
  updateViewport();
}

// Seek scrubber to time
function seekToTime(time) {
  state.currentTime = Math.max(0, Math.min(state.duration, time));
  const percent = (state.currentTime / state.duration) * 100;
  playhead.style.left = `${percent}%`;

  // Format timecode dynamically using state.fps
  const secs = Math.floor(state.currentTime);
  const frames = Math.floor((state.currentTime % 1) * state.fps);
  const formattedSecs = secs < 10 ? '0' + secs : secs;
  const formattedFrames = frames < 10 ? '0' + frames : frames;
  timecode.textContent = `00:00:${formattedSecs}:${formattedFrames}`;

  evaluateTimeline(state.currentTime);
  renderKeyframes(); // Updates active keyframe highlight
}

// Function to delete keyframe
function deleteKeyframeAt(time) {
  const index = state.keyframes.findIndex(k => Math.abs(k.time - time) < 0.2);
  if (index >= 0) {
    if (state.keyframes.length <= 1) {
      alert('يجب الإبقاء على Keyframe واحد على الأقل في المشروع!');
      return;
    }
    state.keyframes.splice(index, 1);
    renderKeyframes();
    evaluateTimeline(state.currentTime);
  }
}

// Animation Loop (Playback)
let animationFrameId = null;
let lastTimestamp = null;
let renderAccumulator = 0;

function playLoop(timestamp) {
  if (!state.isPlaying) return;

  if (!lastTimestamp) lastTimestamp = timestamp;
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // 1. Advance real-time playback and maintain looping
  let newTime = state.currentTime + delta;
  if (newTime >= state.duration) {
    newTime = 0; // Loop playback
    renderAccumulator = 0;
  }

  const frameInterval = 1 / state.fps;

  // 2. Significant browser delay / suspension check (> 0.25s)
  if (delta > 0.25) {
    // Drop missed frames without catch-up burst and render immediately at current time
    renderAccumulator = 0;
    seekToTime(newTime);
  } else {
    // 3. Normal frame pacing while preserving fractional remainder
    renderAccumulator += delta;

    if (renderAccumulator >= frameInterval) {
      renderAccumulator -= frameInterval;
      if (renderAccumulator > frameInterval) {
        renderAccumulator = 0;
      }
      seekToTime(newTime);
    } else {
      // Time advances internally without triggering unnecessary DOM/render work
      state.currentTime = newTime;
    }
  }

  animationFrameId = requestAnimationFrame(playLoop);
}

function togglePlay() {
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    btnPlay.textContent = '⏸ إيقاف مؤقت (Pause)';
    btnPlay.classList.remove('primary');
    btnPlay.classList.add('accent');
    lastTimestamp = null;
    renderAccumulator = 0;
    animationFrameId = requestAnimationFrame(playLoop);
  } else {
    btnPlay.textContent = '▶ تشغيل (Play)';
    btnPlay.classList.add('primary');
    btnPlay.classList.remove('accent');
    cancelAnimationFrame(animationFrameId);
    lastTimestamp = null;
    renderAccumulator = 0;
  }
}

function stopPlay() {
  state.isPlaying = false;
  btnPlay.textContent = '▶ تشغيل (Play)';
  btnPlay.classList.add('primary');
  btnPlay.classList.remove('accent');
  cancelAnimationFrame(animationFrameId);
  lastTimestamp = null;
  renderAccumulator = 0;
  seekToTime(0);
}

// Background Mode Switcher
selectBgMode.addEventListener('change', (e) => {
  const mode = e.target.value;
  bgLayer.className = `comp-layer background-layer bg-${mode}`;
});

// Event Listeners for Sliders (Live Update & Auto-Save to Keyframe if on one)
function handleSliderChange() {
  updateViewport();

  // If user is currently editing on a keyframe (within 0.15s), update that keyframe directly!
  const currentKf = state.keyframes.find(k => Math.abs(k.time - state.currentTime) < 0.15);
  if (currentKf) {
    currentKf.posX = state.posX;
    currentKf.posY = state.posY;
    currentKf.scale = state.scale;
    currentKf.rotation = state.rotation;
    currentKf.opacity = state.opacity;
  }
}

sliderPosX.addEventListener('input', (e) => { state.posX = Number(e.target.value); handleSliderChange(); });
sliderPosY.addEventListener('input', (e) => { state.posY = Number(e.target.value); handleSliderChange(); });
sliderScale.addEventListener('input', (e) => { state.scale = Number(e.target.value); handleSliderChange(); });
sliderRot.addEventListener('input', (e) => { state.rotation = Number(e.target.value); handleSliderChange(); });
sliderOpacity.addEventListener('input', (e) => { state.opacity = Number(e.target.value); handleSliderChange(); });

selectBlendMode.addEventListener('change', (e) => {
  state.blendMode = e.target.value;
  blendExplanation.innerHTML = blendDescriptions[state.blendMode] || '';
  updateViewport();
});

selectEasing.addEventListener('change', (e) => {
  state.easing = e.target.value;
});

btnPlay.addEventListener('click', togglePlay);
btnStop.addEventListener('click', stopPlay);

btnAddKeyframe.addEventListener('click', () => {
  // If playing, pause first so user can inspect
  if (state.isPlaying) {
    togglePlay();
  }

  const existingIndex = state.keyframes.findIndex(k => Math.abs(k.time - state.currentTime) < 0.15);
  const targetTime = existingIndex >= 0 ? state.keyframes[existingIndex].time : Number(state.currentTime.toFixed(2));

  const newKf = {
    time: targetTime,
    posX: state.posX,
    posY: state.posY,
    scale: state.scale,
    rotation: state.rotation,
    opacity: state.opacity
  };

  if (existingIndex >= 0) {
    state.keyframes[existingIndex] = newKf;
  } else {
    state.keyframes.push(newKf);
  }

  // Sort keyframes by time
  state.keyframes.sort((a, b) => a.time - b.time);

  renderKeyframes();
  updateViewport();

  // Visual feedback on the button
  const originalText = btnAddKeyframe.textContent;
  btnAddKeyframe.textContent = `✓ تم الحفظ عند (${targetTime}s)`;
  btnAddKeyframe.style.borderColor = '#00e676';
  btnAddKeyframe.style.color = '#00e676';
  setTimeout(() => {
    btnAddKeyframe.textContent = originalText;
    btnAddKeyframe.style.borderColor = '';
    btnAddKeyframe.style.color = '';
  }, 1200);
});

// ==========================================================
// Preview Native Fullscreen System (YouTube-style Fullscreen API)
// ==========================================================
function toggleFullscreenPreview() {
  if (!document.fullscreenElement) {
    if (viewportEl.requestFullscreen) {
      viewportEl.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }
}

// Automatic Synchronization on fullscreen change (Supports clicking button or pressing Escape)
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = !!document.fullscreenElement;
  if (isFullscreen) {
    btnToggleFullscreen.innerHTML = '🗗 خروج من ملء الشاشة (Exit Fullscreen)';
    btnToggleFullscreen.classList.add('active');
    btnToggleFullscreen.setAttribute('aria-pressed', 'true');
    btnToggleFullscreen.title = 'الخروج من وضع ملء الشاشة (Esc)';
  } else {
    btnToggleFullscreen.innerHTML = '⛶ ملء الشاشة (Fullscreen)';
    btnToggleFullscreen.classList.remove('active');
    btnToggleFullscreen.setAttribute('aria-pressed', 'false');
    btnToggleFullscreen.title = 'عرض المعاينة بملء الشاشة بالكامل (Fullscreen)';
  }
});

btnToggleFullscreen.addEventListener('click', toggleFullscreenPreview);

// Grid Overlay Functionality
function updateGridDisplay() {
  if (state.gridVisible) {
    grid.classList.add('visible');
    btnToggleGrid.classList.add('active');
    btnToggleGrid.setAttribute('aria-pressed', 'true');
    btnToggleGrid.title = 'إخفاء شبكة المحاذاة';
  } else {
    grid.classList.remove('visible');
    btnToggleGrid.classList.remove('active');
    btnToggleGrid.setAttribute('aria-pressed', 'false');
    btnToggleGrid.title = 'إظهار شبكة المحاذاة';
  }
}

btnToggleGrid.addEventListener('click', () => {
  state.gridVisible = !state.gridVisible;
  updateGridDisplay();
});

btnReset.addEventListener('click', () => {
  state.posX = 180;
  state.posY = 130;
  state.scale = 100;
  state.rotation = 0;
  state.opacity = 100;
  state.blendMode = 'normal';
  selectBlendMode.value = 'normal';
  blendExplanation.innerHTML = blendDescriptions['normal'];
  updateViewport();
});

// Change Frame Rate (FPS)
selectFps.addEventListener('change', (e) => {
  state.fps = Number(e.target.value);
  renderAccumulator = 0;
  seekToTime(state.currentTime); // Recalculate timecode with new FPS
});

// Delete Keyframe Button
btnDelKeyframe.addEventListener('click', () => {
  deleteKeyframeAt(state.currentTime);
});

// Real-Time Scrubbing System (Drag to scrub live)
let isDraggingTimeline = false;

function handleTimelineScrub(e) {
  const rect = timelineTrack.getBoundingClientRect();
  // Support both mouse clientX and touch clientX
  const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
  const clickX = clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
  seekToTime(ratio * state.duration);
}

timelineTrack.addEventListener('mousedown', (e) => {
  // If clicking on a keyframe diamond, let diamond handle it
  if (e.target.classList.contains('keyframe-diamond')) return;

  isDraggingTimeline = true;
  if (state.isPlaying) togglePlay(); // Pause playback while scrubbing
  handleTimelineScrub(e);
});

// Mobile Touch Support for Timeline Scrubbing
timelineTrack.addEventListener('touchstart', (e) => {
  if (e.target.classList.contains('keyframe-diamond')) return;
  isDraggingTimeline = true;
  if (state.isPlaying) togglePlay();
  handleTimelineScrub(e);
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!isDraggingTimeline) return;
  handleTimelineScrub(e);
}, { passive: true });

window.addEventListener('touchend', () => {
  if (isDraggingTimeline) {
    isDraggingTimeline = false;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingTimeline) return;
  handleTimelineScrub(e);
});

window.addEventListener('mouseup', () => {
  if (isDraggingTimeline) {
    isDraggingTimeline = false;
  }
});

// ==========================================================
// Navigation & Tab Switching System
// ==========================================================
const navTabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

navTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetTabId = tab.getAttribute('data-tab');
    if (!targetTabId) return;

    // If leaving Animation Lab while playing, safely auto-pause playback
    if (targetTabId !== 'tab-animation' && state.isPlaying) {
      togglePlay(); // Uses existing playback toggle to pause cleanly
    }

    // Update active tab buttons
    navTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active tab panels
    tabPanes.forEach((pane) => {
      if (pane.id === targetTabId) {
        pane.classList.add('active');
        pane.removeAttribute('hidden');
      } else {
        pane.classList.remove('active');
        pane.setAttribute('hidden', '');
      }
    });
  });
});

// ==========================================================
// Keyboard Shortcuts System (Space to Play/Pause in Normal & Fullscreen)
// ==========================================================
window.addEventListener('keydown', (e) => {
  // Support both e.code === 'Space' and e.key === ' '
  if (e.code === 'Space' || e.key === ' ') {
    // Check if user is typing or interacting with an editable/interactive control
    const activeEl = document.activeElement;
    const tagName = activeEl ? activeEl.tagName.toUpperCase() : '';
    const isInteractive = 
      tagName === 'INPUT' || 
      tagName === 'TEXTAREA' || 
      tagName === 'SELECT' || 
      tagName === 'BUTTON' || 
      (activeEl && activeEl.isContentEditable);

    // If focused on an interactive form control, allow native behavior (e.g. typing or activating button)
    if (isInteractive) return;

    // Prevent default browser scrolling
    e.preventDefault();

    // Toggle Play/Pause seamlessly across normal view and native fullscreen
    togglePlay();
  }
});

// Initial Setup
bgLayer.className = 'comp-layer background-layer bg-studio';
updateGridDisplay();
updateViewport();
renderKeyframes();
seekToTime(0);

