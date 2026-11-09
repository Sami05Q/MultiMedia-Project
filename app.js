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
  images: {
    icon: '🖼️',
    title: 'الصور والبكسلات (Images & Pixels)',
    desc: 'سيتم تدشين هذا الدرس التفاعلي في المرحلة القادمة ليغطي التمثيل الرياضي للبكسلات، الفرق بين الصور النقطية (Raster) والمتجهة (Vector)، دقة العرض (Resolution)، وعمق الألوان (Color Depth).'
  },
  colors: {
    icon: '🎨',
    title: 'النماذج اللونية (Color Models - RGB)',
    desc: 'سيتم تدشين هذا الدرس التفاعلي في المرحلة القادمة ليغطي فضاء الألوان الجمعي (Additive RGB)، والطباعي (Subtractive CMYK)، ومعادلات قنوات الألوان وقناة الشفافية (Alpha Channel).'
  },
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

  // Switch from Concept Map view to Lesson view
  theoryMapView.classList.remove('active');
  theoryLessonView.classList.add('active');

  if (topicKey === 'intro') {
    // Open Complete Lesson
    lessonIntro.style.display = 'flex';
    lessonComingSoon.style.display = 'none';
    theoryBreadcrumbLabel.textContent = 'مقدمة في الوسائط المتعددة (Introduction)';
  } else if (upcomingTopicsData[topicKey]) {
    // Open Coming Soon view with customized metadata
    const data = upcomingTopicsData[topicKey];
    lessonIntro.style.display = 'none';
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

const integratorScore = document.getElementById('integrator-score');
const integratorFill = document.getElementById('integrator-fill');
const integratorInsight = document.getElementById('integrator-insight');

function updateMediaIntegrator() {
  if (!toggleMediaText || !toggleMediaImage || !toggleMediaAnim || !toggleMediaAudio) return;

  const hasText = toggleMediaText.checked;
  const hasImage = toggleMediaImage.checked;
  const hasAnim = toggleMediaAnim.checked;
  const hasAudio = toggleMediaAudio.checked;

  // Toggle Layer Visibilities
  demoLayerText.style.opacity = hasText ? '1' : '0';
  demoLayerImage.style.opacity = hasImage ? '1' : '0';
  demoLayerAnim.style.display = hasAnim ? 'block' : 'none';
  demoLayerAudio.style.opacity = hasAudio ? '1' : '0';

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

if (toggleMediaText) toggleMediaText.addEventListener('change', updateMediaIntegrator);
if (toggleMediaImage) toggleMediaImage.addEventListener('change', updateMediaIntegrator);
if (toggleMediaAnim) toggleMediaAnim.addEventListener('change', updateMediaIntegrator);
if (toggleMediaAudio) toggleMediaAudio.addEventListener('change', updateMediaIntegrator);
updateMediaIntegrator();

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

// Initial Setup
bgLayer.className = 'comp-layer background-layer bg-studio';
updateGridDisplay();
updateViewport();
renderKeyframes();
seekToTime(0);

