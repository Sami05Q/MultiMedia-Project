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

    // If leaving Media Lab while playing, safely auto-pause composition playback
    if (targetTabId !== 'tab-media' && typeof isCompPlaying !== 'undefined' && isCompPlaying) {
      toggleCompPlayback();
    }

    // If leaving Theory Hub while playing integrator audio, safely pause and reset
    if (targetTabId !== 'tab-theory') {
      stopIntegratorAudio();
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
    // Only handle playback shortcut when Animation Lab is the active and visible tab
    const animTab = document.getElementById('tab-animation');
    const isAnimActive = animTab && animTab.classList.contains('active') && !animTab.hasAttribute('hidden');
    if (!isAnimActive) return;

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

// ==========================================================
// Media Lab Interactive Engine (Unified Multimedia Composition Workspace)
// ==========================================================

// Central Composition State
const compositionState = {
  layers: [],             // Array of layer objects in ascending visual stacking order (index 0 is bottom, N-1 is top)
  selectedLayerId: null,  // ID of currently active/selected layer
  nextLayerId: 1,         // Unique layer ID counter
  canvasWidth: 640,       // Canonical composition coordinate width (16:9)
  canvasHeight: 360       // Canonical composition coordinate height
};

// DOM Elements
const mediaCompCanvas = document.getElementById('media-comp-canvas');
const mediaCanvasElements = document.getElementById('media-canvas-elements');
const mediaAudioElements = document.getElementById('media-audio-elements');
const compEmptyPlaceholder = document.getElementById('comp-empty-placeholder');
const mediaLayersList = document.getElementById('media-layers-list');
const compLayerCountBadge = document.getElementById('comp-layer-count-badge');
const btnDeleteActiveLayer = document.getElementById('btn-delete-active-layer');
const btnCompPlay = document.getElementById('btn-comp-play');
const btnCompStop = document.getElementById('btn-comp-stop');
const compTimecode = document.getElementById('comp-timecode');

const propsLayerTypeBadge = document.getElementById('props-layer-type-badge');
const propsSections = {
  empty: document.getElementById('props-empty'),
  text: document.getElementById('props-text'),
  image: document.getElementById('props-image'),
  video: document.getElementById('props-video'),
  audio: document.getElementById('props-audio')
};

// Properties Inspector Controls - Text
const propTextPosX = document.getElementById('prop-text-pos-x');
const propTextPosY = document.getElementById('prop-text-pos-y');
const textInput = document.getElementById('text-input');
const sliderTextSize = document.getElementById('slider-text-size');
const valTextSize = document.getElementById('val-text-size');
const sliderTextSpacing = document.getElementById('slider-text-spacing');
const valTextSpacing = document.getElementById('val-text-spacing');
const selectFontFamily = document.getElementById('select-font-family');
const pickerTextColor = document.getElementById('picker-text-color');
const textCharCount = document.getElementById('text-char-count');
const textWordCount = document.getElementById('text-word-count');
const textByteSize = document.getElementById('text-byte-size');

// Properties Inspector Controls - Image
const propImgPosX = document.getElementById('prop-img-pos-x');
const propImgPosY = document.getElementById('prop-img-pos-y');
const btnBrowseImage = document.getElementById('btn-browse-image');
const imageFileInput = document.getElementById('image-file-input');
const sliderImgOpacity = document.getElementById('slider-img-opacity');
const valImgOpacity = document.getElementById('val-img-opacity');
const sliderImgGray = document.getElementById('slider-img-gray');
const valImgGray = document.getElementById('val-img-gray');
const imgMetaDim = document.getElementById('img-meta-dim');
const imgMetaRatio = document.getElementById('img-meta-ratio');
const imgMetaSize = document.getElementById('img-meta-size');
const imgMetaType = document.getElementById('img-meta-type');

// Properties Inspector Controls - Video
const propVidPosX = document.getElementById('prop-vid-pos-x');
const propVidPosY = document.getElementById('prop-vid-pos-y');
const btnBrowseVideo = document.getElementById('btn-browse-video');
const videoFileInput = document.getElementById('video-file-input');
const selectVideoSpeed = document.getElementById('select-video-speed');
const valVidSpeed = document.getElementById('val-vid-speed');
const vidMetaRes = document.getElementById('vid-meta-res');
const vidMetaDur = document.getElementById('vid-meta-dur');
const vidMetaSize = document.getElementById('vid-meta-size');

// Properties Inspector Controls - Audio
const btnBrowseAudio = document.getElementById('btn-browse-audio');
const audioFileInput = document.getElementById('audio-file-input');
const audMetaName = document.getElementById('aud-meta-name');
const audMetaDur = document.getElementById('aud-meta-dur');
const audMetaSize = document.getElementById('aud-meta-size');

// Add-Layer Toolbar Buttons
const btnAddTextLayer = document.getElementById('btn-add-text-layer');
const btnAddImageLayer = document.getElementById('btn-add-image-layer');
const btnAddVideoLayer = document.getElementById('btn-add-video-layer');
const btnAddAudioLayer = document.getElementById('btn-add-audio-layer');

// Helper: Escape HTML strings
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Greatest Common Divisor for Aspect Ratios
function computeGcd(a, b) {
  return b === 0 ? a : computeGcd(b, a % b);
}

// Helper: Retrieve currently active layer
function getSelectedLayer() {
  return compositionState.layers.find(l => l.id === compositionState.selectedLayerId) || null;
}

// ----------------------------------------------------------
// Layer Factory Functions (Independent Multi-Instance Support)
// ----------------------------------------------------------

function createTextLayer(initialText = 'نص جديد (New Text)') {
  const id = `layer_${compositionState.nextLayerId++}`;
  const textCount = compositionState.layers.filter(l => l.type === 'text').length + 1;
  const offset = (compositionState.layers.length * 24) % 180;
  const textStr = String(initialText);

  return {
    id,
    type: 'text',
    name: `طبقة نص ${textCount}`,
    x: 80 + offset,
    y: 60 + offset,
    text: textStr,
    fontSize: 32,
    letterSpacing: 1,
    fontFamily: "'Cairo', sans-serif",
    color: '#00d2ff',
    charCount: textStr.length,
    wordCount: textStr.trim() ? textStr.trim().split(/\s+/).length : 0,
    byteSize: new Blob([textStr]).size
  };
}

function createImageLayer(file, url, width, height, gcdRatio) {
  const id = `layer_${compositionState.nextLayerId++}`;
  const imgCount = compositionState.layers.filter(l => l.type === 'image').length + 1;
  const offset = (compositionState.layers.length * 24) % 180;

  return {
    id,
    type: 'image',
    name: file.name ? file.name.substring(0, 20) : `صورة ${imgCount}`,
    x: 100 + offset,
    y: 80 + offset,
    src: url,
    opacity: 100,
    grayscale: 0,
    dimText: `${width} × ${height} px`,
    ratioText: gcdRatio,
    sizeText: `${(file.size / 1024).toFixed(1)} KB`,
    mimeType: file.type || 'image'
  };
}

function createVideoLayer(file, url, width, height, duration) {
  const id = `layer_${compositionState.nextLayerId++}`;
  const vidCount = compositionState.layers.filter(l => l.type === 'video').length + 1;
  const offset = (compositionState.layers.length * 24) % 180;

  return {
    id,
    type: 'video',
    name: file.name ? file.name.substring(0, 20) : `فيديو ${vidCount}`,
    x: 40 + offset,
    y: 30 + offset,
    src: url,
    playbackRate: 1.0,
    resText: `${width} × ${height} px`,
    durText: `${Number(duration).toFixed(1)}s`,
    sizeText: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
  };
}

function createAudioLayer(file, url, duration) {
  const id = `layer_${compositionState.nextLayerId++}`;
  const audCount = compositionState.layers.filter(l => l.type === 'audio').length + 1;

  return {
    id,
    type: 'audio',
    name: file.name ? file.name.substring(0, 20) : `صوت ${audCount}`,
    src: url,
    fileName: file.name || 'audio',
    durText: `${Number(duration).toFixed(1)}s`,
    sizeText: `${(file.size / 1024).toFixed(1)} KB`
  };
}

// ----------------------------------------------------------
// Layer Selection & Properties Inspector Synchronization
// ----------------------------------------------------------

function selectLayer(layerId) {
  compositionState.selectedLayerId = layerId;
  const layer = getSelectedLayer();

  // 1. Update Inspector Visibility & Values
  if (!layer) {
    // No layer selected / empty state
    Object.keys(propsSections).forEach((type) => {
      if (propsSections[type]) {
        propsSections[type].style.display = type === 'empty' ? 'block' : 'none';
        propsSections[type].classList.toggle('active', type === 'empty');
      }
    });
    if (propsLayerTypeBadge) propsLayerTypeBadge.textContent = 'لا توجد طبقة';
    if (btnDeleteActiveLayer) btnDeleteActiveLayer.style.display = 'none';
  } else {
    // Show matching section, hide others
    if (btnDeleteActiveLayer) btnDeleteActiveLayer.style.display = 'inline-block';
    Object.keys(propsSections).forEach((type) => {
      if (propsSections[type]) {
        const isMatch = type === layer.type;
        propsSections[type].style.display = isMatch ? 'block' : 'none';
        propsSections[type].classList.toggle('active', isMatch);
      }
    });

    const badgeNames = {
      text: 'نص (Text)',
      image: 'صورة (Image)',
      video: 'فيديو (Video)',
      audio: 'صوت (Audio)'
    };
    if (propsLayerTypeBadge) propsLayerTypeBadge.textContent = badgeNames[layer.type] || layer.type;

    // Populate inputs strictly from the selected layer's unique properties
    if (layer.type === 'text') {
      if (propTextPosX) propTextPosX.value = layer.x;
      if (propTextPosY) propTextPosY.value = layer.y;
      if (textInput) textInput.value = layer.text;
      if (sliderTextSize) sliderTextSize.value = layer.fontSize;
      if (valTextSize) valTextSize.textContent = `${layer.fontSize}px`;
      if (sliderTextSpacing) sliderTextSpacing.value = layer.letterSpacing;
      if (valTextSpacing) valTextSpacing.textContent = `${layer.letterSpacing}px`;
      if (selectFontFamily) selectFontFamily.value = layer.fontFamily;
      if (pickerTextColor) pickerTextColor.value = layer.color;
      if (textCharCount) textCharCount.textContent = layer.charCount;
      if (textWordCount) textWordCount.textContent = layer.wordCount;
      if (textByteSize) textByteSize.textContent = `${layer.byteSize} Bytes`;
    } else if (layer.type === 'image') {
      if (propImgPosX) propImgPosX.value = layer.x;
      if (propImgPosY) propImgPosY.value = layer.y;
      if (sliderImgOpacity) sliderImgOpacity.value = layer.opacity;
      if (valImgOpacity) valImgOpacity.textContent = `${layer.opacity}%`;
      if (sliderImgGray) sliderImgGray.value = layer.grayscale;
      if (valImgGray) valImgGray.textContent = `${layer.grayscale}%`;
      if (imgMetaDim) imgMetaDim.textContent = layer.dimText || '-- × --';
      if (imgMetaRatio) imgMetaRatio.textContent = layer.ratioText || '--';
      if (imgMetaSize) imgMetaSize.textContent = layer.sizeText || '-- KB';
      if (imgMetaType) imgMetaType.textContent = layer.mimeType || '--';
    } else if (layer.type === 'video') {
      if (propVidPosX) propVidPosX.value = layer.x;
      if (propVidPosY) propVidPosY.value = layer.y;
      if (selectVideoSpeed) selectVideoSpeed.value = String(layer.playbackRate);
      if (valVidSpeed) valVidSpeed.textContent = `${Number(layer.playbackRate).toFixed(1)}x`;
      if (vidMetaRes) vidMetaRes.textContent = layer.resText || '-- × --';
      if (vidMetaDur) vidMetaDur.textContent = layer.durText || '--s';
      if (vidMetaSize) vidMetaSize.textContent = layer.sizeText || '-- MB';
    } else if (layer.type === 'audio') {
      if (audMetaName) audMetaName.textContent = layer.fileName || '--';
      if (audMetaDur) audMetaDur.textContent = layer.durText || '--s';
      if (audMetaSize) audMetaSize.textContent = layer.sizeText || '-- KB';
    }
  }

  // 2. Synchronize Canvas Selection Outlines
  if (mediaCanvasElements) {
    const canvasItems = mediaCanvasElements.querySelectorAll('.canvas-layer-item');
    canvasItems.forEach((item) => {
      const isSelected = item.getAttribute('data-layer-id') === layerId;
      item.classList.toggle('canvas-layer-selected', isSelected);
    });
  }

  // 3. Synchronize Layers List Selection
  if (mediaLayersList) {
    const rows = mediaLayersList.querySelectorAll('.media-layer-row');
    rows.forEach((row) => {
      const isSelected = row.getAttribute('data-layer-id') === layerId;
      row.classList.toggle('active', isSelected);
      const pill = row.querySelector('.layer-status-pill');
      if (pill) {
        pill.textContent = isSelected ? 'نشط (Selected)' : 'جاهز';
      }
    });
  }
}

// ----------------------------------------------------------
// Layer Deletion & Strict Media Cleanup Protocol
// ----------------------------------------------------------

function deleteLayer(layerId) {
  const index = compositionState.layers.findIndex(l => l.id === layerId);
  if (index === -1) return;
  const layer = compositionState.layers[index];

  // Strict Media Cleanup Protocol
  if (layer.type === 'video') {
    const vidEl = document.querySelector(`#canvas-layer-${layer.id} video`);
    if (vidEl) {
      if (typeof vidEl.pause === 'function') vidEl.pause();
      vidEl.removeAttribute('src');
      vidEl.src = '';
      if (typeof vidEl.load === 'function') vidEl.load();
    }
    if (layer.src && layer.src.startsWith('blob:')) {
      URL.revokeObjectURL(layer.src);
    }
  } else if (layer.type === 'audio') {
    const audEl = document.getElementById(`audio-elem-${layer.id}`);
    if (audEl) {
      if (typeof audEl.pause === 'function') audEl.pause();
      audEl.removeAttribute('src');
      audEl.src = '';
      if (typeof audEl.load === 'function') audEl.load();
    }
    if (layer.src && layer.src.startsWith('blob:')) {
      URL.revokeObjectURL(layer.src);
    }
  } else if (layer.type === 'image') {
    const imgEl = document.querySelector(`#canvas-layer-${layer.id} img`);
    if (imgEl) {
      imgEl.removeAttribute('src');
      imgEl.src = '';
    }
    if (layer.src && layer.src.startsWith('blob:')) {
      URL.revokeObjectURL(layer.src);
    }
  }

  // Remove layer from composition state
  compositionState.layers.splice(index, 1);

  // If the deleted layer was active, choose next available layer
  if (compositionState.selectedLayerId === layerId) {
    if (compositionState.layers.length > 0) {
      const nextIndex = Math.min(index, compositionState.layers.length - 1);
      compositionState.selectedLayerId = compositionState.layers[nextIndex].id;
    } else {
      compositionState.selectedLayerId = null;
    }
  }

  renderCanvasLayers();
  renderLayersList();
  selectLayer(compositionState.selectedLayerId);
  if (getAllCompMediaElements().length === 0 && isCompPlaying) {
    stopCompPlayback();
  }
}

if (btnDeleteActiveLayer) {
  btnDeleteActiveLayer.addEventListener('click', () => {
    if (compositionState.selectedLayerId) {
      deleteLayer(compositionState.selectedLayerId);
    }
  });
}

// ----------------------------------------------------------
// Canvas Rendering & Interactive Dragging Pipeline
// ----------------------------------------------------------

function renderCanvasLayers() {
  if (!mediaCanvasElements || !mediaAudioElements) return;

  mediaCanvasElements.innerHTML = '';
  mediaAudioElements.innerHTML = '';

  const totalLayers = compositionState.layers.length;
  if (compEmptyPlaceholder) {
    compEmptyPlaceholder.style.display = totalLayers === 0 ? 'flex' : 'none';
  }

  // Render visual layers in ascending z-index order (index 0 = bottom, N-1 = top)
  compositionState.layers.forEach((layer, index) => {
    const zIndex = index + 1; // Direct array mapping to visual stacking order

    if (layer.type === 'text') {
      const el = document.createElement('div');
      el.className = 'canvas-layer-item canvas-text-layer';
      el.id = `canvas-layer-${layer.id}`;
      el.setAttribute('data-layer-id', layer.id);
      el.style.left = `${(layer.x / 640) * 100}%`;
      el.style.top = `${(layer.y / 360) * 100}%`;
      el.style.zIndex = zIndex;
      el.style.fontSize = `${layer.fontSize}px`;
      el.style.letterSpacing = `${layer.letterSpacing}px`;
      el.style.fontFamily = layer.fontFamily;
      el.style.color = layer.color;
      el.textContent = layer.text || '...';

      if (layer.id === compositionState.selectedLayerId) {
        el.classList.add('canvas-layer-selected');
      }

      attachVisualLayerDragHandler(el, layer);
      mediaCanvasElements.appendChild(el);

    } else if (layer.type === 'image') {
      const el = document.createElement('div');
      el.className = 'canvas-layer-item canvas-image-layer';
      el.id = `canvas-layer-${layer.id}`;
      el.setAttribute('data-layer-id', layer.id);
      el.style.left = `${(layer.x / 640) * 100}%`;
      el.style.top = `${(layer.y / 360) * 100}%`;
      el.style.zIndex = zIndex;

      const img = document.createElement('img');
      img.src = layer.src;
      img.alt = layer.name;
      img.style.opacity = layer.opacity / 100;
      img.style.filter = `grayscale(${layer.grayscale}%)`;
      el.appendChild(img);

      if (layer.id === compositionState.selectedLayerId) {
        el.classList.add('canvas-layer-selected');
      }

      attachVisualLayerDragHandler(el, layer);
      mediaCanvasElements.appendChild(el);

    } else if (layer.type === 'video') {
      const el = document.createElement('div');
      el.className = 'canvas-layer-item canvas-video-layer';
      el.id = `canvas-layer-${layer.id}`;
      el.setAttribute('data-layer-id', layer.id);
      el.style.left = `${(layer.x / 640) * 100}%`;
      el.style.top = `${(layer.y / 360) * 100}%`;
      el.style.zIndex = zIndex;

      // Visual HTML5 Video Element (Behaves as a pure visual footage layer, no native player UI)
      const vid = document.createElement('video');
      vid.src = layer.src;
      vid.playsInline = true;
      vid.playbackRate = Number(layer.playbackRate) || 1.0;

      // Synchronize timecode updates during playback
      vid.addEventListener('timeupdate', () => {
        if (isCompPlaying) {
          const maxDur = Math.max(5, ...compositionState.layers
            .filter(l => l.type === 'video' || l.type === 'audio')
            .map(l => parseFloat(l.durText) || 5));
          updateCompTimecode(vid.currentTime, maxDur);
        }
      });

      vid.addEventListener('ended', () => {
        const mediaList = getAllCompMediaElements();
        const allDone = mediaList.every(m => m.ended || m.paused);
        if (allDone && isCompPlaying) {
          stopCompPlayback();
        }
      });

      el.appendChild(vid);

      if (layer.id === compositionState.selectedLayerId) {
        el.classList.add('canvas-layer-selected');
      }

      // Dragging is active from ANYWHERE across the video frame, exactly like Image layers
      attachVisualLayerDragHandler(el, layer);
      mediaCanvasElements.appendChild(el);

    } else if (layer.type === 'audio') {
      // Non-visual audio element
      const aud = document.createElement('audio');
      aud.id = `audio-elem-${layer.id}`;
      aud.src = layer.src;

      aud.addEventListener('timeupdate', () => {
        if (isCompPlaying) {
          const maxDur = Math.max(5, ...compositionState.layers
            .filter(l => l.type === 'video' || l.type === 'audio')
            .map(l => parseFloat(l.durText) || 5));
          updateCompTimecode(aud.currentTime, maxDur);
        }
      });

      aud.addEventListener('ended', () => {
        const mediaList = getAllCompMediaElements();
        const allDone = mediaList.every(m => m.ended || m.paused);
        if (allDone && isCompPlaying) {
          stopCompPlayback();
        }
      });

      mediaAudioElements.appendChild(aud);
    }
  });
}

// Attach Dragging for All Visual Layers (Text, Image, and Video behave identically)
function attachVisualLayerDragHandler(el, layer) {
  el.addEventListener('mousedown', (e) => {
    selectLayer(layer.id);
    e.preventDefault(); // Prevent native browser drag or text selection
    initiateCanvasDrag(e, el, layer);
  });
}

// Shared Canvas Drag Engine with Independent Dual-Axis Scaling & Unrestricted Coordinates
function initiateCanvasDrag(startEvent, el, layer) {
  if (!mediaCompCanvas) return;

  const canvasRect = mediaCompCanvas.getBoundingClientRect();
  const scaleX = canvasRect.width / 640;
  const scaleY = canvasRect.height / 360;

  const startMouseX = startEvent.clientX;
  const startMouseY = startEvent.clientY;
  const startLayerX = layer.x;
  const startLayerY = layer.y;

  el.classList.add('is-dragging');

  function onMouseMove(moveEvent) {
    // Independent horizontal and vertical scaling
    const deltaX = (moveEvent.clientX - startMouseX) / (scaleX || 1);
    const deltaY = (moveEvent.clientY - startMouseY) / (scaleY || 1);

    // Unrestricted coordinates (natural canvas overflow clipping)
    layer.x = Math.round(startLayerX + deltaX);
    layer.y = Math.round(startLayerY + deltaY);

    // Live update on canvas
    el.style.left = `${(layer.x / 640) * 100}%`;
    el.style.top = `${(layer.y / 360) * 100}%`;

    // Live update in Properties Inspector numeric inputs
    if (layer.type === 'text') {
      if (propTextPosX) propTextPosX.value = layer.x;
      if (propTextPosY) propTextPosY.value = layer.y;
    } else if (layer.type === 'image') {
      if (propImgPosX) propImgPosX.value = layer.x;
      if (propImgPosY) propImgPosY.value = layer.y;
    } else if (layer.type === 'video') {
      if (propVidPosX) propVidPosX.value = layer.x;
      if (propVidPosY) propVidPosY.value = layer.y;
    }
  }

  function onMouseUp() {
    el.classList.remove('is-dragging');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// Bi-directional Numeric Input Synchronization
function handleNumericPosInput(axis, type, event) {
  const layer = getSelectedLayer();
  if (!layer || layer.type !== type) return;

  const val = Number(event.target.value);
  if (isNaN(val)) return;

  layer[axis] = Math.round(val);

  const el = document.getElementById(`canvas-layer-${layer.id}`);
  if (el) {
    if (axis === 'x') el.style.left = `${(layer.x / 640) * 100}%`;
    if (axis === 'y') el.style.top = `${(layer.y / 360) * 100}%`;
  }
}

if (propTextPosX) propTextPosX.addEventListener('input', (e) => handleNumericPosInput('x', 'text', e));
if (propTextPosY) propTextPosY.addEventListener('input', (e) => handleNumericPosInput('y', 'text', e));
if (propImgPosX) propImgPosX.addEventListener('input', (e) => handleNumericPosInput('x', 'image', e));
if (propImgPosY) propImgPosY.addEventListener('input', (e) => handleNumericPosInput('y', 'image', e));
if (propVidPosX) propVidPosX.addEventListener('input', (e) => handleNumericPosInput('x', 'video', e));
if (propVidPosY) propVidPosY.addEventListener('input', (e) => handleNumericPosInput('y', 'video', e));

// ----------------------------------------------------------
// Composition Unified Playback Engine (External Transport Controls)
// ----------------------------------------------------------

let isCompPlaying = false;

function getAllCompMediaElements() {
  const vids = mediaCanvasElements ? Array.from(mediaCanvasElements.querySelectorAll('video')) : [];
  const auds = mediaAudioElements ? Array.from(mediaAudioElements.querySelectorAll('audio')) : [];
  return [...vids, ...auds];
}

function updateCompTimecode(curr = 0, dur = 5) {
  if (!compTimecode) return;
  const fmt = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  };
  compTimecode.textContent = `${fmt(curr)} / ${fmt(dur)}`;
}

function toggleCompPlayback() {
  const mediaList = getAllCompMediaElements();
  if (mediaList.length === 0) return;

  if (isCompPlaying) {
    mediaList.forEach(m => m.pause());
    isCompPlaying = false;
    if (btnCompPlay) btnCompPlay.innerHTML = '▶ تشغيل';
  } else {
    // If all ended, restart from beginning
    const allEnded = mediaList.every(m => m.ended);
    mediaList.forEach(m => {
      if (allEnded || m.ended) m.currentTime = 0;
      m.play().catch(() => {/* Handle browser autoplay restrictions cleanly */ });
    });
    isCompPlaying = true;
    if (btnCompPlay) btnCompPlay.innerHTML = '⏸ إيقاف مؤقت';
  }
}

function stopCompPlayback() {
  const mediaList = getAllCompMediaElements();
  mediaList.forEach(m => {
    m.pause();
    m.currentTime = 0;
  });
  isCompPlaying = false;
  if (btnCompPlay) btnCompPlay.innerHTML = '▶ تشغيل';
  updateCompTimecode(0, 5);
}

if (btnCompPlay) btnCompPlay.addEventListener('click', toggleCompPlayback);
if (btnCompStop) btnCompStop.addEventListener('click', stopCompPlayback);

// ----------------------------------------------------------
// Timeline Layers List Rendering (Reverse Order: Top Row = Highest Layer)
// ----------------------------------------------------------

function renderLayersList() {
  if (!mediaLayersList) return;
  mediaLayersList.innerHTML = '';

  const total = compositionState.layers.length;
  if (compLayerCountBadge) {
    compLayerCountBadge.textContent = `${total} طبقات`;
  }

  const iconMap = { text: '📝', image: '🖼️', video: '🎬', audio: '🎵' };
  const tagMap = { text: 'Visual Overlay', image: 'Visual Graphic', video: 'Video Track', audio: 'Audio Stream' };

  // Render in reverse order so array index N-1 (highest visual z-index) sits as the top row
  for (let i = total - 1; i >= 0; i--) {
    const layer = compositionState.layers[i];
    const isSelected = layer.id === compositionState.selectedLayerId;

    const row = document.createElement('div');
    row.className = 'media-layer-row';
    if (layer.type === 'audio') row.classList.add('audio-track-row');
    if (isSelected) row.classList.add('active');
    row.setAttribute('data-layer-id', layer.id);

    row.innerHTML = `
      <span class="layer-index-badge">#${i + 1}</span>
      <div class="layer-icon">${iconMap[layer.type] || '📁'}</div>
      <div class="layer-info">
        <span class="layer-title">${escapeHtml(layer.name)}</span>
        <span class="layer-type-tag ${layer.type === 'audio' ? 'audio-tag' : ''}">${tagMap[layer.type] || layer.type}</span>
      </div>
      <div class="layer-actions">
        <button type="button" class="btn-row-delete" title="حذف هذه الطبقة">🗑</button>
      </div>
      <div class="layer-status-pill">${isSelected ? 'نشط (Selected)' : 'جاهز'}</div>
    `;

    // Click row to select layer
    row.addEventListener('click', (e) => {
      if (e.target.closest('.btn-row-delete')) return;
      selectLayer(layer.id);
    });

    // Row delete button
    const rowDeleteBtn = row.querySelector('.btn-row-delete');
    if (rowDeleteBtn) {
      rowDeleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLayer(layer.id);
      });
    }

    mediaLayersList.appendChild(row);
  }
}

// ----------------------------------------------------------
// Properties Inspector Controls Event Handlers
// ----------------------------------------------------------

// 1. Text Properties Updates
function handleTextInputChange() {
  const layer = getSelectedLayer();
  if (!layer || layer.type !== 'text') return;

  const content = textInput ? textInput.value : '';
  layer.text = content;
  layer.charCount = content.length;
  layer.wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  layer.byteSize = new Blob([content]).size;

  if (textCharCount) textCharCount.textContent = layer.charCount;
  if (textWordCount) textWordCount.textContent = layer.wordCount;
  if (textByteSize) textByteSize.textContent = `${layer.byteSize} Bytes`;

  const el = document.getElementById(`canvas-layer-${layer.id}`);
  if (el) el.textContent = content || '...';
}

function handleTextStyleChange() {
  const layer = getSelectedLayer();
  if (!layer || layer.type !== 'text') return;

  if (sliderTextSize) layer.fontSize = Number(sliderTextSize.value);
  if (valTextSize) valTextSize.textContent = `${layer.fontSize}px`;

  if (sliderTextSpacing) layer.letterSpacing = Number(sliderTextSpacing.value);
  if (valTextSpacing) valTextSpacing.textContent = `${layer.letterSpacing}px`;

  if (selectFontFamily) layer.fontFamily = selectFontFamily.value;
  if (pickerTextColor) layer.color = pickerTextColor.value;

  const el = document.getElementById(`canvas-layer-${layer.id}`);
  if (el) {
    el.style.fontSize = `${layer.fontSize}px`;
    el.style.letterSpacing = `${layer.letterSpacing}px`;
    el.style.fontFamily = layer.fontFamily;
    el.style.color = layer.color;
  }
}

if (textInput) textInput.addEventListener('input', handleTextInputChange);
if (sliderTextSize) sliderTextSize.addEventListener('input', handleTextStyleChange);
if (sliderTextSpacing) sliderTextSpacing.addEventListener('input', handleTextStyleChange);
if (selectFontFamily) selectFontFamily.addEventListener('change', handleTextStyleChange);
if (pickerTextColor) pickerTextColor.addEventListener('input', handleTextStyleChange);

// 2. Image Properties Updates
function handleImageFilterChange() {
  const layer = getSelectedLayer();
  if (!layer || layer.type !== 'image') return;

  if (sliderImgOpacity) layer.opacity = Number(sliderImgOpacity.value);
  if (valImgOpacity) valImgOpacity.textContent = `${layer.opacity}%`;

  if (sliderImgGray) layer.grayscale = Number(sliderImgGray.value);
  if (valImgGray) valImgGray.textContent = `${layer.grayscale}%`;

  const imgEl = document.querySelector(`#canvas-layer-${layer.id} img`);
  if (imgEl) {
    imgEl.style.opacity = layer.opacity / 100;
    imgEl.style.filter = `grayscale(${layer.grayscale}%)`;
  }
}

if (sliderImgOpacity) sliderImgOpacity.addEventListener('input', handleImageFilterChange);
if (sliderImgGray) sliderImgGray.addEventListener('input', handleImageFilterChange);

// 3. Video Properties Updates
function handleVideoSpeedChange() {
  const layer = getSelectedLayer();
  if (!layer || layer.type !== 'video') return;

  if (selectVideoSpeed) {
    layer.playbackRate = Number(selectVideoSpeed.value);
    if (valVidSpeed) valVidSpeed.textContent = `${layer.playbackRate.toFixed(1)}x`;
  }

  const vidEl = document.querySelector(`#canvas-layer-${layer.id} video`);
  if (vidEl) {
    vidEl.playbackRate = layer.playbackRate;
  }
}

if (selectVideoSpeed) selectVideoSpeed.addEventListener('change', handleVideoSpeedChange);

// ----------------------------------------------------------
// Standard File Ingestion & Toolbar Actions (Repeated Upload Support)
// ----------------------------------------------------------

// Add Text Layer
if (btnAddTextLayer) {
  btnAddTextLayer.addEventListener('click', () => {
    const textLayer = createTextLayer(`نص جديد ${compositionState.layers.filter(l => l.type === 'text').length + 1}`);
    compositionState.layers.push(textLayer);
    compositionState.selectedLayerId = textLayer.id;
    renderCanvasLayers();
    renderLayersList();
    selectLayer(textLayer.id);
  });
}

// Add / Browse Image Layer
function triggerImagePicker() {
  if (imageFileInput) {
    imageFileInput.value = ''; // Clear value so selecting the same file triggers 'change' every time
    imageFileInput.click();
  }
}

if (btnAddImageLayer) btnAddImageLayer.addEventListener('click', triggerImagePicker);
if (btnBrowseImage) btnBrowseImage.addEventListener('click', triggerImagePicker);

if (imageFileInput) {
  imageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة صالح!');
        return;
      }

      const url = URL.createObjectURL(file); // Unique Blob URL per layer
      const tempImg = new Image();
      tempImg.onload = () => {
        const gcd = computeGcd(tempImg.naturalWidth, tempImg.naturalHeight);
        const ratio = `${tempImg.naturalWidth / gcd}:${tempImg.naturalHeight / gcd}`;
        const imgLayer = createImageLayer(file, url, tempImg.naturalWidth, tempImg.naturalHeight, ratio);

        // If replacing an active image layer via the inspector
        const active = getSelectedLayer();
        if (active && active.type === 'image' && e.target === imageFileInput && document.activeElement === btnBrowseImage) {
          if (active.src && active.src.startsWith('blob:')) URL.revokeObjectURL(active.src);
          active.src = url;
          active.dimText = imgLayer.dimText;
          active.ratioText = imgLayer.ratioText;
          active.sizeText = imgLayer.sizeText;
          active.mimeType = imgLayer.mimeType;
          active.name = imgLayer.name;
        } else {
          // Add as new independent image layer
          compositionState.layers.push(imgLayer);
          compositionState.selectedLayerId = imgLayer.id;
        }

        renderCanvasLayers();
        renderLayersList();
        selectLayer(compositionState.selectedLayerId);
      };
      tempImg.src = url;
    }
  });
}

// Add / Browse Video Layer
function triggerVideoPicker() {
  if (videoFileInput) {
    videoFileInput.value = ''; // Clear value so selecting same video triggers 'change' every time
    videoFileInput.click();
  }
}

if (btnAddVideoLayer) btnAddVideoLayer.addEventListener('click', triggerVideoPicker);
if (btnBrowseVideo) btnBrowseVideo.addEventListener('click', triggerVideoPicker);

if (videoFileInput) {
  videoFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('video/')) {
        alert('يرجى اختيار ملف فيديو صالح!');
        return;
      }

      const url = URL.createObjectURL(file); // Unique Blob URL per layer
      const tempVid = document.createElement('video');
      tempVid.onloadedmetadata = () => {
        const vidLayer = createVideoLayer(file, url, tempVid.videoWidth, tempVid.videoHeight, tempVid.duration);

        // If replacing active video layer
        const active = getSelectedLayer();
        if (active && active.type === 'video' && document.activeElement === btnBrowseVideo) {
          if (active.src && active.src.startsWith('blob:')) URL.revokeObjectURL(active.src);
          active.src = url;
          active.resText = vidLayer.resText;
          active.durText = vidLayer.durText;
          active.sizeText = vidLayer.sizeText;
          active.name = vidLayer.name;
        } else {
          // Add as new independent video layer
          compositionState.layers.push(vidLayer);
          compositionState.selectedLayerId = vidLayer.id;
        }

        renderCanvasLayers();
        renderLayersList();
        selectLayer(compositionState.selectedLayerId);
      };
      tempVid.src = url;
    }
  });
}

// Add / Browse Audio Layer
function triggerAudioPicker() {
  if (audioFileInput) {
    audioFileInput.value = ''; // Clear value so selecting same audio triggers 'change' every time
    audioFileInput.click();
  }
}

if (btnAddAudioLayer) btnAddAudioLayer.addEventListener('click', triggerAudioPicker);
if (btnBrowseAudio) btnBrowseAudio.addEventListener('click', triggerAudioPicker);

if (audioFileInput) {
  audioFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('audio/')) {
        alert('يرجى اختيار ملف صوتي صالح!');
        return;
      }

      const url = URL.createObjectURL(file); // Unique Blob URL per layer
      const tempAud = document.createElement('audio');
      tempAud.onloadedmetadata = () => {
        const audLayer = createAudioLayer(file, url, tempAud.duration);

        // If replacing active audio layer
        const active = getSelectedLayer();
        if (active && active.type === 'audio' && document.activeElement === btnBrowseAudio) {
          if (active.src && active.src.startsWith('blob:')) URL.revokeObjectURL(active.src);
          active.src = url;
          active.fileName = audLayer.fileName;
          active.durText = audLayer.durText;
          active.sizeText = audLayer.sizeText;
          active.name = audLayer.name;
        } else {
          // Add as new independent audio layer
          compositionState.layers.push(audLayer);
          compositionState.selectedLayerId = audLayer.id;
        }

        renderCanvasLayers();
        renderLayersList();
        selectLayer(compositionState.selectedLayerId);
      };
      tempAud.src = url;
    }
  });
}

// ----------------------------------------------------------
// Initialize Media Lab Default Composition State
// ----------------------------------------------------------

// Boot with 1 default main Text Layer so users have an immediate canvas object to interact with
const initialMainTextLayer = createTextLayer('After Effects & Multimedia Computing Lab');
initialMainTextLayer.name = 'طبقة النص الرئيسية';
initialMainTextLayer.x = 110;
initialMainTextLayer.y = 135;

compositionState.layers.push(initialMainTextLayer);
compositionState.selectedLayerId = initialMainTextLayer.id;

renderCanvasLayers();
renderLayersList();
selectLayer(initialMainTextLayer.id);

// ==========================================================
// Theory Hub Engine (Interactive Concept Map & Lessons)
// ==========================================================

// Metadata for upcoming topics (Coming Soon)
const upcomingTopicsData = {
  animation: {
    icon: '🎬',
    title: 'أساسيات التحريك (Animation Fundamentals)',
    desc: 'سيتم تدشين هذا الدرس التفاعلي في المرحلة القادمة ليغطي مبادئ التحريك الكلاسيكية، مفاهيم الإطارات الرئيسية (Keyframing)، والاستيفاء الزمني والمكاني (Spatial & Temporal Interpolation).'
  },
  audio: {
    icon: '🎵',
    title: 'الصوت الرقمي (Digital Audio)',
    desc: 'سيتم تدشين هذا الدرس التفاعلي في المرحلة القادمة ليغطي خصائص الموجات الصوتية (Frequency & Amplitude)، معدل أخذ العينات (Sampling Rate)، وعمق البت وتنسيقات الضغط (WAV vs MP3).'
  },
  video: {
    icon: '🎥',
    title: 'الفيديو الرقمي (Digital Video)',
    desc: 'سيتم تدشين هذا الدرس التفاعلي في المرحلة القادمة ليغطي تتابع الإطارات، معدل الإطارات (FPS)، المسح التدريجي والمتشابك (Progressive vs Interlaced)، وبرمجيات ترميز وضغط الفيديو (Codecs).'
  }
};

// Theory Hub Elements
const theoryHubWrapper = document.getElementById('theory-hub-wrapper');
const theoryMapView = document.getElementById('theory-map-view');
const theoryLessonView = document.getElementById('theory-lesson-view');
const lessonIntro = document.getElementById('lesson-intro');
const lessonImages = document.getElementById('lesson-images');
const lessonColors = document.getElementById('lesson-colors');
const lessonComingSoon = document.getElementById('lesson-coming-soon');
const btnTheoryBack = document.getElementById('btn-theory-back');
const btnCsBack = document.getElementById('btn-cs-back');
const theoryBreadcrumbLabel = document.getElementById('theory-current-topic-label');
const csTopicIcon = document.getElementById('cs-topic-icon');
const csTopicTitle = document.getElementById('cs-topic-title');
const csTopicDesc = document.getElementById('cs-topic-desc');

// Concept Nodes Click & Keyboard Handling
const conceptNodes = document.querySelectorAll('.concept-node');

function openTheoryTopic(topicKey) {
  if (!topicKey) return;

  // Stop integrator audio when navigating to any topic other than Lesson 1
  if (topicKey !== 'intro') {
    stopIntegratorAudio();
  }

  // Switch from Concept Map view to Lesson view
  theoryMapView.classList.remove('active');
  theoryLessonView.classList.add('active');

  if (topicKey === 'intro') {
    // Open Complete Lesson 1
    lessonIntro.style.display = 'flex';
    if (lessonImages) lessonImages.style.display = 'none';
    if (lessonColors) lessonColors.style.display = 'none';
    lessonComingSoon.style.display = 'none';
    theoryBreadcrumbLabel.textContent = 'مقدمة في الوسائط المتعددة (Introduction)';
  } else if (topicKey === 'images') {
    // Open Complete Lesson 2
    lessonIntro.style.display = 'none';
    if (lessonImages) lessonImages.style.display = 'flex';
    if (lessonColors) lessonColors.style.display = 'none';
    lessonComingSoon.style.display = 'none';
    theoryBreadcrumbLabel.textContent = 'الصور والبكسلات (Images & Pixels)';

    if (window.ImagesLessonModule) {
      ImagesLessonModule.init();
      ImagesLessonModule.renderSimulator();
    }
  } else if (topicKey === 'colors') {
    // Open Complete Lesson 3
    lessonIntro.style.display = 'none';
    if (lessonImages) lessonImages.style.display = 'none';
    if (lessonColors) lessonColors.style.display = 'flex';
    lessonComingSoon.style.display = 'none';
    theoryBreadcrumbLabel.textContent = 'النماذج اللونية (Color Models)';

    if (window.ColorsLessonModule) {
      window.ColorsLessonModule.init();
    }
  } else if (upcomingTopicsData[topicKey]) {
    // Open Coming Soon view with customized metadata
    const data = upcomingTopicsData[topicKey];
    lessonIntro.style.display = 'none';
    if (lessonImages) lessonImages.style.display = 'none';
    if (lessonColors) lessonColors.style.display = 'none';
    lessonComingSoon.style.display = 'flex';
    csTopicIcon.textContent = data.icon;
    csTopicTitle.textContent = data.title;
    csTopicDesc.textContent = data.desc;
    theoryBreadcrumbLabel.textContent = data.title;
  }

  // Scroll smoothly to top of the content
  if (theoryHubWrapper) {
    theoryHubWrapper.scrollTop = 0;
  }
}

function returnToConceptMap() {
  stopIntegratorAudio();
  theoryLessonView.classList.remove('active');
  theoryMapView.classList.add('active');
  if (theoryHubWrapper) {
    theoryHubWrapper.scrollTop = 0;
  }
}

const conceptMapStage = document.getElementById('concept-map-stage');

// Helper to clear active connector states
function clearActiveConnectors() {
  document.querySelectorAll('.map-connector.active').forEach((c) => c.classList.remove('active'));
}

// When mouse moves over the concept map stage, return to mouse interaction mode without blurring activeElement
if (conceptMapStage) {
  conceptMapStage.addEventListener('pointermove', () => {
    conceptMapStage.classList.remove('keyboard-active');
  });
}

conceptNodes.forEach((node) => {
  const topicKey = node.getAttribute('data-topic');
  const connector = document.querySelector(`.map-connector[data-connector="${topicKey}"]`);

  // Handle keyboard focus priority (Tab navigation)
  node.addEventListener('focus', () => {
    if (conceptMapStage) {
      conceptMapStage.classList.add('keyboard-active');
    }
    clearActiveConnectors();
    if (connector) {
      connector.classList.add('active');
    }
  });

  node.addEventListener('blur', () => {
    clearActiveConnectors();
  });

  // Handle mouse hover (active only when not in keyboard navigation mode)
  node.addEventListener('mouseenter', () => {
    if (conceptMapStage && !conceptMapStage.classList.contains('keyboard-active')) {
      clearActiveConnectors();
      if (connector) {
        connector.classList.add('active');
      }
    }
  });

  node.addEventListener('mouseleave', () => {
    if (conceptMapStage && !conceptMapStage.classList.contains('keyboard-active')) {
      clearActiveConnectors();
    }
  });

  node.addEventListener('click', () => {
    openTheoryTopic(topicKey);
  });

  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openTheoryTopic(topicKey);
    }
  });
});

if (btnTheoryBack) btnTheoryBack.addEventListener('click', returnToConceptMap);
if (btnCsBack) btnCsBack.addEventListener('click', returnToConceptMap);

// ----------------------------------------------------------
// Section 3: Interactive Media Composer (Integrator Simulator)
// ----------------------------------------------------------
const toggleMediaText = document.getElementById('toggle-media-text');
const toggleMediaImage = document.getElementById('toggle-media-image');
const toggleMediaAnim = document.getElementById('toggle-media-anim');
const toggleMediaAudio = document.getElementById('toggle-media-audio');

const demoLayerText = document.getElementById('demo-layer-text');
const demoLayerImage = document.getElementById('demo-layer-image');
const demoLayerAnim = document.getElementById('demo-layer-anim');
const demoLayerAudio = document.getElementById('demo-layer-audio');
const integratorAudioPlayer = document.getElementById('integrator-audio-player');

const integratorScore = document.getElementById('integrator-score');
const integratorFill = document.getElementById('integrator-fill');
const integratorInsight = document.getElementById('integrator-insight');

function stopIntegratorAudio() {
  const audio = integratorAudioPlayer || document.getElementById('integrator-audio-player');
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function updateMediaIntegrator(isUserTriggered = false) {
  if (!toggleMediaText || !toggleMediaImage || !toggleMediaAnim || !toggleMediaAudio) return;

  const hasText = toggleMediaText.checked;
  const hasImage = toggleMediaImage.checked;
  const hasAnim = toggleMediaAnim.checked;
  const hasAudio = toggleMediaAudio.checked;

  // Toggle Layer Visibilities
  demoLayerText.style.opacity = hasText ? '1' : '0';
  demoLayerImage.style.opacity = hasImage ? '1' : '0';
  demoLayerAnim.style.opacity = hasAnim ? '1' : '0';
  demoLayerAudio.style.opacity = hasAudio ? '1' : '0';

  // Handle Audio Playback
  const audio = integratorAudioPlayer || document.getElementById('integrator-audio-player');
  if (audio) {
    if (hasAudio) {
      if (isUserTriggered) {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn('Audio playback was prevented:', err);
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  // Calculate Engagement / Richness Score (25% per active element)
  const activeCount = (hasText ? 1 : 0) + (hasImage ? 1 : 0) + (hasAnim ? 1 : 0) + (hasAudio ? 1 : 0);
  const scorePercent = activeCount * 25;

  integratorScore.textContent = `${scorePercent}%`;
  integratorFill.style.width = `${scorePercent}%`;

  // Educational Feedback based on active combination
  if (activeCount === 4) {
    integratorInsight.innerHTML = '🌟 <strong>تجربة وسائط متعددة متكاملة وغامرة:</strong> تضافر النص والصورة والحركة والصوت يضمن إيصال الرسالة بأعلى قدر من الجاذبية والوضوح!';
  } else if (activeCount === 3) {
    integratorInsight.innerHTML = '⚡ <strong>تجربة وسائط غنية ومؤثرة:</strong> تكامل ثلاثة وسائط يرفع معدل استيعاب المتلقي بنسبة عالية جداً.';
  } else if (activeCount === 2) {
    integratorInsight.innerHTML = '👍 <strong>بداية تفاعل وسائط مزدوجة:</strong> دمج عنصرين أفضل من وسيط منفرد، ولكن تفتقر التجربة إلى عنصر الحركة أو الصوت.';
  } else if (activeCount === 1) {
    integratorInsight.innerHTML = '📄 <strong>وسيط منفرد (Single Media):</strong> تجربة تواصل أحادية تقليدية تفتقر للتفاعل والإبهار الحسي.';
  } else {
    integratorInsight.innerHTML = '🚫 <strong>لا يوجد أي وسيط نشط:</strong> شاشة معطلة تماماً تؤكد أن غياب الوسائط يعني انعدام التواصل!';
  }
}

if (toggleMediaText) toggleMediaText.addEventListener('change', () => updateMediaIntegrator(false));
if (toggleMediaImage) toggleMediaImage.addEventListener('change', () => updateMediaIntegrator(false));
if (toggleMediaAnim) toggleMediaAnim.addEventListener('change', () => updateMediaIntegrator(false));
if (toggleMediaAudio) toggleMediaAudio.addEventListener('change', () => updateMediaIntegrator(true));
updateMediaIntegrator(false);

// ----------------------------------------------------------
// Section 6: Quick Knowledge Check (Quiz Engine)
// ----------------------------------------------------------
const quizCards = document.querySelectorAll('.quiz-card');
const btnResetQuiz = document.getElementById('btn-reset-quiz');
const quizSummaryScore = document.getElementById('quiz-summary-score');

const quizExplanations = {
  1: {
    correct: '✓ إجابة صحيحة ومثالية! الوسائط المتعددة تعني تكامل النص والصورة والصوت والفيديو والتحريك عبر الحاسوب.',
    incorrect: '✗ إجابة غير دقيقة. الوسائط المتعددة لا تعني وسيطاً منفرداً؛ بل دمج وتناغم عناصر متعددة معاً.'
  },
  2: {
    correct: '✓ إجابة صحيحة! التحريك (Animation) هو خلق وهم الحركة بواسطة تتابع سريع لرسومات أو نماذج متسلسلة.',
    incorrect: '✗ إجابة غير دقيقة. العنصر المعني بخلق وهم الحركة الرسومية هو التحريك (Animation).'
  },
  3: {
    correct: '✓ إجابة صحيحة! دمج الوسائط يبسط المفاهيم المعقدة ويضاعف تركيز وتفاعل المتلقي.',
    incorrect: '✗ إجابة غير دقيقة. الهدف الأساسي من الوسائط المتعددة هو تعزيز الفهم وزيادة التفاعل والوضوح.'
  }
};

let quizUserScores = { 1: null, 2: null, 3: null };

function updateQuizTotalScore() {
  let answeredCount = 0;
  let correctCount = 0;

  Object.keys(quizUserScores).forEach(qNum => {
    if (quizUserScores[qNum] !== null) {
      answeredCount++;
      if (quizUserScores[qNum] === true) correctCount++;
    }
  });

  if (answeredCount === 0) {
    quizSummaryScore.textContent = 'النتيجة: -- / 3';
  } else {
    quizSummaryScore.textContent = `النتيجة: ${correctCount} / 3`;
  }
}

quizCards.forEach((card) => {
  const qNum = card.getAttribute('data-quiz');
  const correctIdx = Number(card.getAttribute('data-correct'));
  const options = card.querySelectorAll('.quiz-opt');
  const feedbackEl = card.querySelector('.quiz-feedback');

  options.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedIdx = Number(btn.getAttribute('data-index'));

      // Clear previous styles on this card's options
      options.forEach(opt => {
        opt.classList.remove('selected-correct', 'selected-incorrect');
      });

      feedbackEl.hidden = false;

      if (selectedIdx === correctIdx) {
        btn.classList.add('selected-correct');
        feedbackEl.className = 'quiz-feedback correct-feedback';
        feedbackEl.textContent = quizExplanations[qNum].correct;
        quizUserScores[qNum] = true;
      } else {
        btn.classList.add('selected-incorrect');
        feedbackEl.className = 'quiz-feedback incorrect-feedback';
        feedbackEl.textContent = quizExplanations[qNum].incorrect;
        quizUserScores[qNum] = false;
      }

      updateQuizTotalScore();
    });
  });
});

if (btnResetQuiz) {
  btnResetQuiz.addEventListener('click', () => {
    quizUserScores = { 1: null, 2: null, 3: null };
    quizCards.forEach((card) => {
      const options = card.querySelectorAll('.quiz-opt');
      const feedbackEl = card.querySelector('.quiz-feedback');
      options.forEach(opt => opt.classList.remove('selected-correct', 'selected-incorrect'));
      feedbackEl.hidden = true;
      feedbackEl.textContent = '';
      feedbackEl.className = 'quiz-feedback';
    });
    updateQuizTotalScore();
  });
}

// ==========================================================
// Lesson 2: Images & Pixels Interactive Module (Isolated Scope)
// ==========================================================
const ImagesLessonModule = {
  isInitialized: false,
  simWidth: 32,
  simHeight: 24,
  simGridVisible: false,
  currentDepth: 24,
  quizScores: { 1: null, 2: null, 3: null },

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.initSimulator();
    this.initBitDepthVisualizer();
    this.initCalculator();
    this.initQuiz();
  },

  // --------------------------------------------------------
  // A. Pixel & Resolution Simulator
  // --------------------------------------------------------
  initSimulator() {
    const resButtons = document.querySelectorAll('.btn-sim-res');
    const toggleGridBtn = document.getElementById('btn-toggle-img-grid');

    resButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        resButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.simWidth = parseInt(btn.getAttribute('data-w'), 10);
        this.simHeight = parseInt(btn.getAttribute('data-h'), 10);
        this.renderSimulator();
      });
    });

    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => {
        this.simGridVisible = !this.simGridVisible;
        const gridOverlay = document.getElementById('sim-grid-overlay');
        if (gridOverlay) {
          if (this.simGridVisible) {
            gridOverlay.style.display = 'block';
            gridOverlay.style.backgroundSize = `${320 / this.simWidth}px ${240 / this.simHeight}px`;
          } else {
            gridOverlay.style.display = 'none';
          }
        }
      });
    }

    this.renderSimulator();
  },

  renderSimulator() {
    const canvas = document.getElementById('img-sim-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const targetW = 320;
    const targetH = 240;

    // Create an off-screen buffer at the internal resolution
    const offCanvas = document.createElement('canvas');
    offCanvas.width = this.simWidth;
    offCanvas.height = this.simHeight;
    const offCtx = offCanvas.getContext('2d');

    const w = this.simWidth;
    const h = this.simHeight;

    // Draw reference educational scene on the offscreen canvas
    // 1) Sky gradient
    const skyGrad = offCtx.createLinearGradient(0, 0, 0, h * 0.65);
    skyGrad.addColorStop(0, '#1565c0');
    skyGrad.addColorStop(1, '#64b5f6');
    offCtx.fillStyle = skyGrad;
    offCtx.fillRect(0, 0, w, h * 0.65);

    // 2) Sun circle
    offCtx.fillStyle = '#ffb300';
    offCtx.beginPath();
    offCtx.arc(w * 0.8, h * 0.22, Math.max(1, w * 0.1), 0, Math.PI * 2);
    offCtx.fill();

    // 3) Back mountain
    offCtx.fillStyle = '#2e7d32';
    offCtx.beginPath();
    offCtx.moveTo(w * 0.1, h * 0.65);
    offCtx.lineTo(w * 0.45, h * 0.25);
    offCtx.lineTo(w * 0.8, h * 0.65);
    offCtx.closePath();
    offCtx.fill();

    // 4) Front hill
    offCtx.fillStyle = '#43a047';
    offCtx.beginPath();
    offCtx.moveTo(0, h * 0.65);
    offCtx.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.65);
    offCtx.lineTo(w, h * 0.65);
    offCtx.lineTo(w, h);
    offCtx.lineTo(0, h);
    offCtx.closePath();
    offCtx.fill();

    // 5) Multimedia geometric elements (Purple star/diamond & red flag)
    offCtx.fillStyle = '#9d4edd';
    offCtx.beginPath();
    offCtx.moveTo(w * 0.2, h * 0.55);
    offCtx.lineTo(w * 0.25, h * 0.42);
    offCtx.lineTo(w * 0.3, h * 0.55);
    offCtx.lineTo(w * 0.25, h * 0.68);
    offCtx.closePath();
    offCtx.fill();

    // Red flag / cube
    offCtx.fillStyle = '#e53935';
    offCtx.fillRect(w * 0.7, h * 0.52, Math.max(1, w * 0.12), Math.max(1, h * 0.16));

    // Upscale off-screen canvas to the 320x240 display canvas with nearest-neighbor (pixelated)
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(offCanvas, 0, 0, targetW, targetH);

    // Update overlay grid cell size if visible
    const gridOverlay = document.getElementById('sim-grid-overlay');
    if (gridOverlay && this.simGridVisible) {
      gridOverlay.style.backgroundSize = `${targetW / this.simWidth}px ${targetH / this.simHeight}px`;
    }

    // Update readout texts
    const resBadge = document.getElementById('sim-res-badge');
    const pixelCount = document.getElementById('sim-pixel-count');
    const detailNote = document.getElementById('sim-detail-note');

    const total = this.simWidth * this.simHeight;
    if (resBadge) resBadge.textContent = `${this.simWidth} × ${this.simHeight}`;
    if (pixelCount) pixelCount.textContent = `${total.toLocaleString()} بكسل`;

    if (detailNote) {
      if (this.simWidth === 16) {
        detailNote.textContent = '💡 ملاحظة: عند الدقة 16 × 12 (192 بكسل)، تظهر بكسلة فائقة وتفقد كافة الأشكال تفاصيلها وتتحول إلى كتل ملونة ضخمة.';
      } else if (this.simWidth === 32) {
        detailNote.textContent = '💡 ملاحظة: عند الدقة 32 × 24 (768 بكسل)، تصبح الملامح العامة مرئية ولكن مع تسنن حاد وواضح على الحواف المائلة والمنحنيات.';
      } else if (this.simWidth === 64) {
        detailNote.textContent = '💡 ملاحظة: عند الدقة 64 × 48 (3,072 بكسل)، تبدأ التفاصيل بالتماسك وتصبح حواف الأشكال أكثر دقة مع بقاء خشونة خفيفة.';
      } else if (this.simWidth === 128) {
        detailNote.textContent = '💡 ملاحظة: عند الدقة 128 × 96 (12,288 بكسل)، تقترب الصورة من الوضوح العالي وتغدو البكسلات الفردية صعبة الملاحظة من بعد.';
      } else {
        detailNote.textContent = '💡 ملاحظة: عند الدقة الكاملة 320 × 240 (76,800 بكسل)، تظهر الصورة بنعومتها الأصلية التامة (1:1 Native Pixel Mapping).';
      }
    }
  },

  // --------------------------------------------------------
  // B. Bit Depth Visualizer
  // --------------------------------------------------------
  initBitDepthVisualizer() {
    const depthButtons = document.querySelectorAll('.btn-depth-mode');
    depthButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        depthButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentDepth = parseInt(btn.getAttribute('data-depth'), 10);
        this.renderBitDepthPreview();
      });
    });

    this.renderBitDepthPreview();
  },

  renderBitDepthPreview() {
    const canvas = document.getElementById('depth-preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = 480;
    const h = 140;

    ctx.clearRect(0, 0, w, h);

    if (this.currentDepth === 1) {
      // 1-bit Binary: Strict Black & White
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';

      // Half screen black, sharp shapes with dithering/steps
      ctx.fillRect(0, 0, w * 0.45, h);

      // Circles & shapes pure black / pure white
      ctx.beginPath();
      ctx.arc(w * 0.65, h * 0.5, 45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.25, h * 0.5, 45, 0, Math.PI * 2);
      ctx.fill();

      // Step bars
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#000000' : '#ffffff';
        ctx.fillRect(w * 0.8 + (i * 10), 20, 10, h - 40);
      }
    } else if (this.currentDepth === 8) {
      // 8-bit Grayscale: 256 smooth luminance levels
      const grad = ctx.createLinearGradient(15, 0, w - 15, 0);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.5, '#7f7f7f');
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.fillRect(15, 20, w - 30, 45);

      // Spheres / shapes with smooth grayscale shading
      const radGrad = ctx.createRadialGradient(w * 0.35, h * 0.72, 5, w * 0.35, h * 0.72, 35);
      radGrad.addColorStop(0, '#ffffff');
      radGrad.addColorStop(0.7, '#666666');
      radGrad.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(w * 0.35, h * 0.72, 30, 0, Math.PI * 2);
      ctx.fill();

      const radGrad2 = ctx.createRadialGradient(w * 0.65, h * 0.72, 5, w * 0.65, h * 0.72, 35);
      radGrad2.addColorStop(0, '#cccccc');
      radGrad2.addColorStop(0.6, '#444444');
      radGrad2.addColorStop(1, '#050505');
      ctx.fillStyle = radGrad2;
      ctx.beginPath();
      ctx.arc(w * 0.65, h * 0.72, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.currentDepth === 24) {
      // 24-bit True Color: Full RGB Spectrum (Fully Opaque)
      const grad = ctx.createLinearGradient(15, 0, w - 15, 0);
      grad.addColorStop(0, '#ff0000');
      grad.addColorStop(0.2, '#ffff00');
      grad.addColorStop(0.4, '#00ff00');
      grad.addColorStop(0.6, '#00ffff');
      grad.addColorStop(0.8, '#0000ff');
      grad.addColorStop(1, '#ff00ff');

      ctx.fillStyle = grad;
      ctx.fillRect(15, 20, w - 30, 40);

      // 3 overlapping primary color circles (Opaque)
      ctx.fillStyle = '#ff3366';
      ctx.beginPath();
      ctx.arc(w * 0.36, h * 0.72, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#33cc66';
      ctx.beginPath();
      ctx.arc(w * 0.50, h * 0.72, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3399ff';
      ctx.beginPath();
      ctx.arc(w * 0.64, h * 0.72, 28, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.currentDepth === 32) {
      // 32-bit RGBA: True Color + Alpha Transparency over checkerboard
      const opacities = [1.0, 0.75, 0.5, 0.25];
      const colors = [
        'rgba(255, 51, 102,',
        'rgba(157, 78, 221,',
        'rgba(0, 212, 255,',
        'rgba(0, 230, 118,'
      ];

      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `${colors[i]} ${opacities[i]})`;
        ctx.beginPath();
        ctx.arc(60 + (i * 105), h * 0.48, 42, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`α = ${Math.round(opacities[i] * 100)}%`, 60 + (i * 105), h * 0.52);
      }
    }

    // Update Meta and Channels UI
    const titleEl = document.getElementById('depth-info-title');
    const bpcEl = document.getElementById('depth-info-bpc');
    const channelsEl = document.getElementById('depth-channels-display');
    const textEl = document.getElementById('depth-info-text');

    if (this.currentDepth === 1) {
      if (titleEl) titleEl.textContent = '1-bit Binary (الصورة الثنائية)';
      if (bpcEl) bpcEl.textContent = '1 بت لكل بكسل (2 مستويات)';
      if (channelsEl) {
        channelsEl.innerHTML = `
          <div class="channel-pill" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #fff;">
            <span class="ch-name">قناة أحادية (Monochrome):</span> <span class="ch-val mono">1 بت (0 = أسود، 1 = أبيض)</span>
          </div>
        `;
      }
      if (textEl) textEl.textContent = 'تسمح بتمثيل لونين فقط دون أي تدرجات رمادية بينهما. مثالية للمستندات النصية والماسحات الضوئية للوثائق والفاكس، وتوفر أصغر حجم ممكن لبيانات البكسل.';
    } else if (this.currentDepth === 8) {
      if (titleEl) titleEl.textContent = '8-bit Grayscale (التدرج الرمادي)';
      if (bpcEl) bpcEl.textContent = '8 بت لكل بكسل (1 بايت = 256 مستوى)';
      if (channelsEl) {
        channelsEl.innerHTML = `
          <div class="channel-pill" style="background: rgba(200,200,200,0.15); border: 1px solid rgba(200,200,200,0.4); color: #e0e0e0;">
            <span class="ch-name">قناة الشدة الضوئية (Luminance):</span> <span class="ch-val mono">8 بت (القيم من 0 إلى 255)</span>
          </div>
        `;
      }
      if (textEl) textEl.textContent = 'تتألف من قناة إضاءة وحيدة تتيح 256 درجة رمادية متدرجة بنعومة من الأسود التام (0) إلى الأبيض الساطع (255)، وتُستخدم بكثرة في التصوير الشعاعي الطبي والمعالجات الأحادية.';
    } else if (this.currentDepth === 24) {
      if (titleEl) titleEl.textContent = '24-bit True Color (الألوان الحقيقية RGB)';
      if (bpcEl) bpcEl.textContent = '24 بت لكل بكسل (3 بايت = 16.77 مليون لون)';
      if (channelsEl) {
        channelsEl.innerHTML = `
          <div class="channel-pill red"><span class="ch-name">Red (الأحمر):</span> <span class="ch-val mono">8 بت (0-255)</span></div>
          <div class="channel-pill green"><span class="ch-name">Green (الأخضر):</span> <span class="ch-val mono">8 بت (0-255)</span></div>
          <div class="channel-pill blue"><span class="ch-name">Blue (الأزرق):</span> <span class="ch-val mono">8 بت (0-255)</span></div>
        `;
      }
      if (textEl) textEl.textContent = 'المعيار القياسي للصور الفوتوغرافية والشاشات الملونة. كل قناة لونية تمتلك 256 مستوى شدة، لينتج عن مزجها 16,777,216 احتمالاً لونياً حقيقياً معتم بالكامل.';
    } else if (this.currentDepth === 32) {
      if (titleEl) titleEl.textContent = '32-bit RGBA (الألوان الحقيقية مع الشفافية)';
      if (bpcEl) bpcEl.textContent = '32 بت لكل بكسل (4 بايت = 16.77M لون + قناة ألفا)';
      if (channelsEl) {
        channelsEl.innerHTML = `
          <div class="channel-pill red"><span class="ch-name">Red:</span> <span class="ch-val mono">8 بت</span></div>
          <div class="channel-pill green"><span class="ch-name">Green:</span> <span class="ch-val mono">8 بت</span></div>
          <div class="channel-pill blue"><span class="ch-name">Blue:</span> <span class="ch-val mono">8 بت</span></div>
          <div class="channel-pill alpha"><span class="ch-name">Alpha (الشفافية):</span> <span class="ch-val mono">8 بت شفافية</span></div>
        `;
      }
      if (textEl) textEl.textContent = 'تحتفظ بنفس الدقة اللونية الكاملة (RGB بمجموع 24 بت) مضافاً إليها قناة ألفا (Alpha Channel) بحجم 8 بت للتحكم بدرجة التعتيم وتراكب الطبقات الرسومية فوق بعضها بسلاسة.';
    }
  },

  // --------------------------------------------------------
  // C. Raw File Size Calculator
  // --------------------------------------------------------
  initCalculator() {
    const widthInput = document.getElementById('calc-img-w');
    const heightInput = document.getElementById('calc-img-h');
    const depthSelect = document.getElementById('calc-img-depth');
    const presetButtons = document.querySelectorAll('.btn-preset');

    const updateCalc = () => this.calculateFileSize();

    if (widthInput) widthInput.addEventListener('input', updateCalc);
    if (heightInput) heightInput.addEventListener('input', updateCalc);
    if (depthSelect) depthSelect.addEventListener('change', updateCalc);

    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const pw = btn.getAttribute('data-w');
        const ph = btn.getAttribute('data-h');
        if (widthInput) widthInput.value = pw;
        if (heightInput) heightInput.value = ph;
        updateCalc();
      });
    });

    this.calculateFileSize();
  },

  calculateFileSize() {
    const widthInput = document.getElementById('calc-img-w');
    const heightInput = document.getElementById('calc-img-h');
    const depthSelect = document.getElementById('calc-img-depth');
    const stepsOutput = document.getElementById('calc-steps-output');
    const sizeResult = document.getElementById('calc-size-result');
    const sizeSubunits = document.getElementById('calc-size-subunits');

    if (!widthInput || !heightInput || !depthSelect) return;

    const w = Math.max(1, parseInt(widthInput.value, 10) || 1);
    const h = Math.max(1, parseInt(heightInput.value, 10) || 1);
    const depth = parseInt(depthSelect.value, 10) || 24;

    const totalPixels = w * h;
    const totalBits = totalPixels * depth;
    const totalBytes = totalBits / 8;
    const totalKB = totalBytes / 1024;
    const totalMB = totalKB / 1024;

    if (stepsOutput) {
      stepsOutput.innerHTML = `
        1) إجمالي البكسلات = ${w.toLocaleString()} × ${h.toLocaleString()} = ${totalPixels.toLocaleString()} بكسل<br>
        2) إجمالي البتات = ${totalPixels.toLocaleString()} × ${depth} بت = ${totalBits.toLocaleString()} بت<br>
        3) الحجم بالبايت = ${totalBits.toLocaleString()} ÷ 8 = ${Math.round(totalBytes).toLocaleString()} بايت
      `;
    }

    if (sizeResult) {
      sizeResult.textContent = `${Math.round(totalBytes).toLocaleString()} Bytes`;
    }

    if (sizeSubunits) {
      const kbStr = totalKB >= 1 ? totalKB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalKB.toFixed(4);
      const mbStr = totalMB >= 1 ? totalMB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : totalMB.toFixed(4);
      sizeSubunits.textContent = `≈ ${kbStr} KB • ${mbStr} MB`;
    }
  },

  // --------------------------------------------------------
  // D. Course-Aligned Quiz
  // --------------------------------------------------------
  initQuiz() {
    const quizCardsImg = document.querySelectorAll('.quiz-card-img');
    const btnReset = document.getElementById('btn-reset-quiz-img');
    const scoreBadge = document.getElementById('quiz-summary-score-img');

    const explanations = {
      1: {
        correct: '✓ إجابة صحيحة ومتقنة! العرض الفيزيائي = أبعاد البكسل ÷ كثافة البكسل = 600 ÷ 300 = 2 بوصة.',
        incorrect: '✗ إجابة غير صحيحة. المعادلة المعتمدة هي: الحجم الفيزيائي (بالبوصة) = أبعاد البكسل ÷ PPI (أي 600 ÷ 300 = 2 بوصة).'
      },
      2: {
        correct: '✓ إجابة صحيحة ومتقنة! الفرق الأساسي هو أن 32-bit تضيف قناة ألفا (Alpha Channel) بحجم 8 بت المخصصة للتحكم بالشفافية وتراكب الطبقات.',
        incorrect: '✗ إجابة غير صحيحة. قنوات الألوان الثلاث (RGB) متطابقة وتوفر 16.77 مليون لون في الحالتين، لكن عمق 32-bit يضيف قناة رابعة (Alpha) للشفافية.'
      },
      3: {
        correct: '✓ إجابة صحيحة ومتقنة! بالمعادلة: (800 × 600 × 24) ÷ 8 = 480,000 × 3 = 1,440,000 بايت (أي 1.37 ميجابايت تقريباً).',
        incorrect: '✗ إجابة غير صحيحة. بتطبيق المعادلة: الحجم بالبايت = (العرض × الارتفاع × عمق البت) ÷ 8 = (800 × 600 × 24) ÷ 8 = 1,440,000 بايت.'
      }
    };

    const updateScore = () => {
      let answeredCount = 0;
      let correctCount = 0;

      Object.keys(this.quizScores).forEach(qNum => {
        if (this.quizScores[qNum] !== null) {
          answeredCount++;
          if (this.quizScores[qNum] === true) correctCount++;
        }
      });

      if (!scoreBadge) return;
      if (answeredCount === 0) {
        scoreBadge.textContent = 'النتيجة: -- / 3';
      } else {
        scoreBadge.textContent = `النتيجة: ${correctCount} / 3`;
      }
    };

    quizCardsImg.forEach(card => {
      const qNum = card.getAttribute('data-quiz');
      const correctIdx = Number(card.getAttribute('data-correct'));
      const options = card.querySelectorAll('.quiz-opt-img');
      const feedbackEl = card.querySelector('.quiz-feedback-img');

      options.forEach(btn => {
        btn.addEventListener('click', () => {
          const selectedIdx = Number(btn.getAttribute('data-index'));

          options.forEach(opt => {
            opt.classList.remove('selected-correct', 'selected-incorrect');
          });

          if (feedbackEl) feedbackEl.hidden = false;

          if (selectedIdx === correctIdx) {
            btn.classList.add('selected-correct');
            if (feedbackEl) {
              feedbackEl.className = 'quiz-feedback-img correct-feedback';
              feedbackEl.textContent = explanations[qNum].correct;
            }
            this.quizScores[qNum] = true;
          } else {
            btn.classList.add('selected-incorrect');
            if (feedbackEl) {
              feedbackEl.className = 'quiz-feedback-img incorrect-feedback';
              feedbackEl.textContent = explanations[qNum].incorrect;
            }
            this.quizScores[qNum] = false;
          }

          updateScore();
        });
      });
    });

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.quizScores = { 1: null, 2: null, 3: null };
        quizCardsImg.forEach(card => {
          const options = card.querySelectorAll('.quiz-opt-img');
          const feedbackEl = card.querySelector('.quiz-feedback-img');
          options.forEach(opt => opt.classList.remove('selected-correct', 'selected-incorrect'));
          if (feedbackEl) {
            feedbackEl.hidden = true;
            feedbackEl.textContent = '';
            feedbackEl.className = 'quiz-feedback-img';
          }
        });
        updateScore();
      });
    }
  }
};

window.ImagesLessonModule = ImagesLessonModule;

// ==========================================================
// LESSON 3: COLOR & COLOR MODELS MODULE
// ==========================================================
const ColorsLessonModule = {
  isInitialized: false,
  r: 230,
  g: 57,
  b: 70,
  currentVennMode: 'additive',
  quizScores: { 1: null, 2: null, 3: null },

  init() {
    if (this.isInitialized) return;

    this.initRGBMixer();
    this.initVennLab();
    this.initQuiz();
    this.isInitialized = true;
  },

  // --------------------------------------------------------
  // A. RGB Mixer & Code Explorer
  // --------------------------------------------------------
  initRGBMixer() {
    const sliderR = document.getElementById('color-slider-r');
    const sliderG = document.getElementById('color-slider-g');
    const sliderB = document.getElementById('color-slider-b');
    const valR = document.getElementById('color-val-r');
    const valG = document.getElementById('color-val-g');
    const valB = document.getElementById('color-val-b');
    const previewBox = document.getElementById('color-preview-box');
    const codeDec = document.getElementById('color-code-decimal');
    const codeHex = document.getElementById('color-code-hex');
    const codeBin = document.getElementById('color-code-binary');
    const presetButtons = document.querySelectorAll('#lesson-colors .btn-color-preset');

    const updateMixer = () => {
      // Keep channel values within valid bounds [0, 255]
      this.r = Math.max(0, Math.min(255, Math.round(this.r)));
      this.g = Math.max(0, Math.min(255, Math.round(this.g)));
      this.b = Math.max(0, Math.min(255, Math.round(this.b)));

      // 1. Synchronize range sliders
      if (sliderR && Number(sliderR.value) !== this.r) sliderR.value = this.r;
      if (sliderG && Number(sliderG.value) !== this.g) sliderG.value = this.g;
      if (sliderB && Number(sliderB.value) !== this.b) sliderB.value = this.b;

      // 2. Synchronize value badges
      if (valR) valR.textContent = this.r;
      if (valG) valG.textContent = this.g;
      if (valB) valB.textContent = this.b;

      // 3. Live Preview Swatch
      if (previewBox) {
        previewBox.style.backgroundColor = `rgb(${this.r}, ${this.g}, ${this.b})`;
      }

      // 4. Synchronize Code Outputs
      // Decimal: rgb(R, G, B)
      if (codeDec) {
        codeDec.textContent = `rgb(${this.r}, ${this.g}, ${this.b})`;
      }

      // Hexadecimal: #RRGGBB
      const hexR = this.r.toString(16).padStart(2, '0').toUpperCase();
      const hexG = this.g.toString(16).padStart(2, '0').toUpperCase();
      const hexB = this.b.toString(16).padStart(2, '0').toUpperCase();
      if (codeHex) {
        codeHex.textContent = `#${hexR}${hexG}${hexB}`;
      }

      // Binary: 8-bit per channel
      const binR = this.r.toString(2).padStart(8, '0');
      const binG = this.g.toString(2).padStart(8, '0');
      const binB = this.b.toString(2).padStart(8, '0');
      if (codeBin) {
        codeBin.textContent = `${binR} ${binG} ${binB}`;
      }
    };

    // Attach slider input listeners
    if (sliderR) {
      sliderR.addEventListener('input', (e) => {
        this.r = Number(e.target.value);
        updateMixer();
      });
    }
    if (sliderG) {
      sliderG.addEventListener('input', (e) => {
        this.g = Number(e.target.value);
        updateMixer();
      });
    }
    if (sliderB) {
      sliderB.addEventListener('input', (e) => {
        this.b = Number(e.target.value);
        updateMixer();
      });
    }

    // Attach preset buttons listeners
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const pr = btn.getAttribute('data-r');
        const pg = btn.getAttribute('data-g');
        const pb = btn.getAttribute('data-b');
        if (pr !== null && pg !== null && pb !== null) {
          this.r = Number(pr);
          this.g = Number(pg);
          this.b = Number(pb);
          updateMixer();
        }
      });
    });

    // Initial render of mixer
    updateMixer();
  },

  // --------------------------------------------------------
  // B. Additive vs. Subtractive Venn Lab
  // --------------------------------------------------------
  setVennMode(mode) {
    const btnAdditive = document.getElementById('color-btn-additive');
    const btnSubtractive = document.getElementById('color-btn-subtractive');
    const vennStage = document.getElementById('color-venn-stage');
    const label1 = document.getElementById('color-venn-label-1');
    const label2 = document.getElementById('color-venn-label-2');
    const label3 = document.getElementById('color-venn-label-3');
    const centerBadge = document.getElementById('color-venn-center');
    const vennTitle = document.getElementById('color-venn-title');
    const vennRules = document.getElementById('color-venn-rules');

    this.currentVennMode = mode;

    if (vennStage) {
      vennStage.classList.toggle('mode-subtractive', mode === 'subtractive');
      vennStage.classList.toggle('mode-additive', mode !== 'subtractive');
    }

    if (mode === 'subtractive') {
      if (btnAdditive) btnAdditive.classList.remove('active');
      if (btnSubtractive) btnSubtractive.classList.add('active');

      if (label1) label1.textContent = 'Cyan';
      if (label2) label2.textContent = 'Magenta';
      if (label3) label3.textContent = 'Yellow';
      if (centerBadge) centerBadge.textContent = 'Black (أسود)';

      if (vennTitle) vennTitle.textContent = 'النموذج الطرّحي (CMY Pigment / Ink Synthesis)';
      if (vennRules) {
        vennRules.innerHTML = `
          <li><strong>الخلفية:</strong> بيضاء تمثل سطح الورقة العاكسة للضوء.</li>
          <li><strong>تراكب زوجي:</strong> C + M = أزرق (Blue)، M + Y = أحمر (Red)، C + Y = أخضر (Green).</li>
          <li><strong>التراكب الكلي بالمركز:</strong> امتصاص كافة موجات الضوء ينتج <strong>الأسود النظري</strong> ($C + M + Y = \\text{Black}$).</li>
        `;
      }
    } else {
      if (btnAdditive) btnAdditive.classList.add('active');
      if (btnSubtractive) btnSubtractive.classList.remove('active');

      if (label1) label1.textContent = 'Red';
      if (label2) label2.textContent = 'Green';
      if (label3) label3.textContent = 'Blue';
      if (centerBadge) centerBadge.textContent = 'White (أبيض)';

      if (vennTitle) vennTitle.textContent = 'النموذج الجمعي (RGB Light Synthesis)';
      if (vennRules) {
        vennRules.innerHTML = `
          <li><strong>الخلفية:</strong> سوداء تمثل انعدام الإضاءة في الشاشات.</li>
          <li><strong>تراكب زوجي:</strong> R + G = أصفر (Yellow)، G + B = سماوي (Cyan)، R + B = أرجواني (Magenta).</li>
          <li><strong>التراكب الكلي بالمركز:</strong> دمج كافة حزم الضوء ينتج <strong>الأبيض التام</strong> ($R + G + B = \\text{White}$).</li>
        `;
      }
    }
  },

  initVennLab() {
    const btnAdditive = document.getElementById('color-btn-additive');
    const btnSubtractive = document.getElementById('color-btn-subtractive');

    if (btnAdditive) {
      btnAdditive.addEventListener('click', () => {
        this.setVennMode('additive');
      });
    }

    if (btnSubtractive) {
      btnSubtractive.addEventListener('click', () => {
        this.setVennMode('subtractive');
      });
    }

    this.setVennMode(this.currentVennMode || 'additive');
  },

  // --------------------------------------------------------
  // C. Knowledge Check Quiz
  // --------------------------------------------------------
  initQuiz() {
    const quizCards = document.querySelectorAll('#lesson-colors .quiz-card-color');
    const btnReset = document.getElementById('btn-reset-quiz-color');
    const scoreBadge = document.getElementById('quiz-summary-score-color');

    const explanations = {
      1: {
        correct: '✓ إجابة صحيحة! تستطيع العين البشرية السليمة التمييز بين 7 إلى 9 ملايين لون مختلف تقريباً كما ورد بالمنهج.',
        incorrect: '✗ إجابة غير دقيقة. تؤكد الشرائح المعتمدة أن العين البشرية تستطيع التمييز بين حوالي 7 إلى 9 ملايين لون.'
      },
      2: {
        correct: '✓ إجابة صحيحة ومثالية! RGB نموذج جمعي يبدأ من الشاشة السوداء ويضيف الضوء، بينما CMYK طرّحي يبدأ من الورق الأبيض ويمتص الضوء بالصبغات.',
        incorrect: '✗ إجابة غير صحيحة. الفارق الجوهري: RGB يعتمد على انبعاث الضوء وجمعه من نقطة الصفر (الأسود)، بينما CMYK يعتمد على امتصاص الضوء المنعكس من الورقة (الأبيض).'
      },
      3: {
        correct: '✓ إجابة صحيحة ومتقنة! قيمة R=0 تقابلها 00، وقيمة G=255 تقابلها FF، وقيمة B=0 تقابلها 00، فيكون الرمز الست عشري #00FF00.',
        incorrect: '✗ إجابة غير صحيحة. القنوات مرتبة كـ R ثم G ثم B؛ وبما أن الأخضر G=255 والأحمر والأزرق صفران، فالتمثيل الصحيح هو #00FF00 (#FF0000 للأحمر و #0000FF للأزرق).'
      }
    };

    const updateScore = () => {
      let answeredCount = 0;
      let correctCount = 0;

      Object.keys(this.quizScores).forEach(qNum => {
        if (this.quizScores[qNum] !== null) {
          answeredCount++;
          if (this.quizScores[qNum] === true) correctCount++;
        }
      });

      if (!scoreBadge) return;
      if (answeredCount === 0) {
        scoreBadge.textContent = 'النتيجة: -- / 3';
      } else {
        scoreBadge.textContent = `النتيجة: ${correctCount} / 3`;
      }
    };

    quizCards.forEach(card => {
      const qNum = card.getAttribute('data-quiz');
      const correctIdx = Number(card.getAttribute('data-correct'));
      const options = card.querySelectorAll('.quiz-opt-color');
      const feedbackEl = card.querySelector('.quiz-feedback-color');

      options.forEach(btn => {
        btn.addEventListener('click', () => {
          // Prevent changing or answering if already answered
          if (this.quizScores[qNum] !== null) return;

          const selectedIdx = Number(btn.getAttribute('data-index'));

          // Disable options in this card to prevent further interaction
          options.forEach(opt => {
            opt.disabled = true;
          });

          if (feedbackEl) feedbackEl.hidden = false;

          if (selectedIdx === correctIdx) {
            btn.classList.add('selected-correct');
            if (feedbackEl) {
              feedbackEl.className = 'quiz-feedback-color correct-feedback';
              feedbackEl.textContent = explanations[qNum] ? explanations[qNum].correct : '✓ إجابة صحيحة!';
            }
            this.quizScores[qNum] = true;
          } else {
            btn.classList.add('selected-incorrect');
            if (feedbackEl) {
              feedbackEl.className = 'quiz-feedback-color incorrect-feedback';
              feedbackEl.textContent = explanations[qNum] ? explanations[qNum].incorrect : '✗ إجابة غير صحيحة.';
            }
            this.quizScores[qNum] = false;
          }

          updateScore();
        });
      });
    });

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.quizScores = { 1: null, 2: null, 3: null };
        quizCards.forEach(card => {
          const options = card.querySelectorAll('.quiz-opt-color');
          const feedbackEl = card.querySelector('.quiz-feedback-color');

          options.forEach(opt => {
            opt.disabled = false;
            opt.classList.remove('selected-correct', 'selected-incorrect');
          });

          if (feedbackEl) {
            feedbackEl.hidden = true;
            feedbackEl.textContent = '';
            feedbackEl.className = 'quiz-feedback-color';
          }
        });

        updateScore();
      });
    }
  }
};

window.ColorsLessonModule = ColorsLessonModule;

// Initial Setup
bgLayer.className = 'comp-layer background-layer bg-studio';
updateGridDisplay();
updateViewport();
renderKeyframes();
seekToTime(0);

