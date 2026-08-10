/**
 * UNIQLOCK Core Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Constants & Config ---
  const TOTAL_CLIPS = 102;
  const AUDIO_FILES = [
    "01 Drum and Some.mp3",
    "02 Djembe.mp3",
    "03 I'm Getting Married.mp3",
    "04 Red Carpet.mp3",
    "05 Dancing Piano.mp3",
    "06 Vibes.mp3",
    "07 Underground.mp3",
    "08 Go.mp3",
    "09 Beep Beep.mp3",
    "10 Coming Home.mp3",
    "11 Intermezzo.mp3",
    "12 Is This Japan.mp3",
    "13 Seaside.mp3",
    "14 Blow the Bloody Doors Off.mp3",
    "15 Night Samba.mp3",
    "16 Night Washboard.mp3",
    "17 Night Drinks.mp3",
    "18 Night Flute.mp3",
    "19 Night Tapping.mp3",
    "20 Limber_Drum and Some (Hour).mp3",
    "21 Showtune_Drum and Some (Hour).mp3",
    "22 The Pips_Drum and Some (Hour).mp3",
    "23 The Pips_Night Samba (Hour).mp3",
    "24 Limber_Night Drinks (Hour).mp3"
  ];

  const CITIES = [
    { label: "TOKYO / JAPAN", timeZone: "Asia/Tokyo" },
    { label: "NEW YORK / USA", timeZone: "America/New_York" },
    { label: "LONDON / UK", timeZone: "Europe/London" },
    { label: "PARIS / FRANCE", timeZone: "Europe/Paris" },
    { label: "BARCELONA / SPAIN", timeZone: "Europe/Madrid" },
    { label: "SEOUL / KOREA", timeZone: "Asia/Seoul" },
    { label: "SYDNEY / AUSTRALIA", timeZone: "Australia/Sydney" },
    { label: "LOCAL TIME", timeZone: null }
  ];

  // --- DOM Elements ---
  const baseLayer = document.getElementById('base-layer');
  const overlayLayer = document.getElementById('overlay-layer');
  const sweepBar = document.getElementById('sweep-bar');
  const baseTimeDisplay = document.getElementById('base-time');
  const overlayTimeDisplay = document.getElementById('overlay-time');
  const baseLocDisplay = document.getElementById('base-location');
  const overlayLocDisplay = document.getElementById('overlay-location');

  const videoStage = document.getElementById('video-stage');
  const videoPlayer = document.getElementById('video-player');
  const startOverlay = document.getElementById('start-overlay');

  const trackSelect = document.getElementById('track-select');
  const citySelect = document.getElementById('city-select');
  const muteBtn = document.getElementById('mute-btn');
  const fsBtn = document.getElementById('fullscreen-btn');
  const phasePill = document.getElementById('phase-pill');

  // --- Application State ---
  let isStarted = false;
  let currentPhase = 'CLOCK'; // 'CLOCK' or 'VIDEO'
  let phaseSeconds = 0; // seconds elapsed in current phase (0..4)
  let baseTheme = 0; // 0 = Pink-on-White, 1 = White-on-Pink
  let sweepDirectionIndex = 0; // 0=L2R, 1=T2B, 2=R2L, 3=B2T
  let currentCityIndex = 0;
  let currentTrackIndex = 0;
  let isMuted = false;

  // Audio object
  const audio = new Audio();
  audio.loop = true;

  // Preload history of clips to avoid repeating immediately
  let recentClips = [];

  // --- Theme Helpers ---
  function applyThemeClass(element, themeCode) {
    element.classList.remove('theme-pink-on-white', 'theme-white-on-pink');
    if (themeCode === 0) {
      element.classList.add('theme-pink-on-white');
    } else {
      element.classList.add('theme-white-on-pink');
    }
  }

  // Init themes
  applyThemeClass(baseLayer, 0);
  applyThemeClass(overlayLayer, 1);

  const DAY_COLOR_PALETTES = [
    "#e5006d", // Uniqlo Iconic Pink
    "#e60012", // Uniqlo Red
    "#00a0e9", // Uniqlo Cyan Blue
    "#009944", // Uniqlo Vibrant Green
    "#ff9900", // Uniqlo Bright Orange
    "#920783", // Uniqlo Deep Purple
    "#ff3b93", // Uniqlo Magenta
    "#00b4d8", // Uniqlo Sky Blue
    "#70e000", // Uniqlo Lime
    "#ff5a5f"  // Uniqlo Coral
  ];

  const NIGHT_COLOR_PALETTES = [
    "#0d1020", // Deep Night Blue
    "#1c0e2a", // Dark Night Purple
    "#0a1c29", // Night Dark Cyan
    "#0b241b", // Night Emerald Black
    "#26170a", // Night Dark Amber
    "#260920", // Night Deep Wine
    "#0a1b2b", // Night Midnight Navy
    "#141926"  // Night Slate Black
  ];

  function updateMinuteColorTheme() {
    const effNow = getEffectiveDate();
    const { hour, minute } = getActiveTimeForDate(effNow);
    const isNight = (hour >= 19 || hour < 6);

    if (isNight) {
      document.body.classList.add('night-mode');
      const colorIndex = minute % NIGHT_COLOR_PALETTES.length;
      const primaryColor = NIGHT_COLOR_PALETTES[colorIndex];
      document.documentElement.style.setProperty('--uniqlo-pink', primaryColor);
      document.documentElement.style.setProperty('--clock-text-color', '#ffffff');
    } else {
      document.body.classList.remove('night-mode');
      const colorIndex = minute % DAY_COLOR_PALETTES.length;
      const primaryColor = DAY_COLOR_PALETTES[colorIndex];
      document.documentElement.style.setProperty('--uniqlo-pink', primaryColor);
      document.documentElement.style.setProperty('--clock-text-color', primaryColor);
    }
  }

  // --- Populate Controls ---
  AUDIO_FILES.forEach((file, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = file.replace(/^\d+\s*/, '').replace('.mp3', '');
    trackSelect.appendChild(opt);
  });

  CITIES.forEach((city, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = city.label;
    citySelect.appendChild(opt);
  });

  // --- Auto-detect User Timezone ---
  function autoDetectUserCity() {
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTz) {
        const matchIdx = CITIES.findIndex(c => c.timeZone && c.timeZone.toLowerCase() === userTz.toLowerCase());
        if (matchIdx !== -1) {
          return matchIdx;
        }
      }
    } catch (e) {
      console.log('Timezone auto-detect error:', e);
    }
    // Fallback to LOCAL TIME (last item in CITIES list)
    return CITIES.length - 1;
  }

  // Set initial city index based on detected user timezone
  currentCityIndex = autoDetectUserCity();
  citySelect.value = currentCityIndex;

  // --- Time Travel Simulation Offset ---
  let timeOffsetMs = 0;

  function getEffectiveDate() {
    return new Date(Date.now() + timeOffsetMs);
  }

  // --- Clock Formatting ---
  function getFormattedTimeParts(timeZone) {
    const now = getEffectiveDate();
    let hours, minutes, seconds;

    if (timeZone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      hours = parts.find(p => p.type === 'hour')?.value || '00';
      minutes = parts.find(p => p.type === 'minute')?.value || '00';
      seconds = parts.find(p => p.type === 'second')?.value || '00';
    } else {
      hours = String(now.getHours()).padStart(2, '0');
      minutes = String(now.getMinutes()).padStart(2, '0');
      seconds = String(now.getSeconds()).padStart(2, '0');
    }

    if (hours === '24') hours = '00';

    return {
      hh: hours.padStart(2, '0'),
      mm: minutes.padStart(2, '0'),
      ss: seconds.padStart(2, '0')
    };
  }

  function updateTimeElements(prefix, parts) {
    const hhEl = document.getElementById(`${prefix}-hh`);
    const mmEl = document.getElementById(`${prefix}-mm`);
    const ssEl = document.getElementById(`${prefix}-ss`);

    if (hhEl) hhEl.textContent = parts.hh;
    if (mmEl) mmEl.textContent = parts.mm;
    if (ssEl) ssEl.textContent = parts.ss;
  }

  function updateClockDisplays() {
    const city = CITIES[currentCityIndex];
    const parts = getFormattedTimeParts(city.timeZone);

    updateTimeElements('base', parts);
    updateTimeElements('overlay', parts);

    baseLocDisplay.textContent = city.label;
    overlayLocDisplay.textContent = city.label;
  }

  // Initial display update
  updateClockDisplays();

  // Ensure video player is always muted
  videoPlayer.muted = true;

  // --- 1-Second Directional Color Inversion Sweep ---
  function triggerSweep() {
    const nextTheme = 1 - baseTheme;
    applyThemeClass(overlayLayer, nextTheme);

    const dir = sweepDirectionIndex % 4;
    sweepDirectionIndex++;

    const duration = 140; // ms (Ultra snappy sweep / picado)
    const startTime = performance.now();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    sweepBar.style.opacity = '1';

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Fast, sharp linear-to-snappy progression
      const easeProgress = Math.pow(progress, 0.85);

      let clipPathStr = '';
      let barStyle = {};

      if (dir === 0) {
        // Left to Right (0% to 100%)
        const p = easeProgress * 100;
        clipPathStr = `polygon(0% 0%, ${p}% 0%, ${p}% 100%, 0% 100%)`;
        barStyle = {
          top: '0px',
          left: `calc(${p}% - 1.5px)`,
          width: '3px',
          height: '100%'
        };
      } else if (dir === 1) {
        // Top to Bottom (0% to 100%)
        const p = easeProgress * 100;
        clipPathStr = `polygon(0% 0%, 100% 0%, 100% ${p}%, 0% ${p}%)`;
        barStyle = {
          top: `calc(${p}% - 1.5px)`,
          left: '0px',
          width: '100%',
          height: '3px'
        };
      } else if (dir === 2) {
        // Right to Left (100% to 0%)
        const p = (1 - easeProgress) * 100;
        clipPathStr = `polygon(${p}% 0%, 100% 0%, 100% 100%, ${p}% 100%)`;
        barStyle = {
          top: '0px',
          left: `calc(${p}% - 1.5px)`,
          width: '3px',
          height: '100%'
        };
      } else if (dir === 3) {
        // Bottom to Top (100% to 0%)
        const p = (1 - easeProgress) * 100;
        clipPathStr = `polygon(0% ${p}%, 100% ${p}%, 100% 100%, 0% 100%)`;
        barStyle = {
          top: `calc(${p}% - 1.5px)`,
          left: '0px',
          width: '100%',
          height: '3px'
        };
      }

      overlayLayer.style.clipPath = clipPathStr;
      Object.assign(sweepBar.style, barStyle);

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        // Complete transition: commit nextTheme to baseLayer
        baseTheme = nextTheme;
        applyThemeClass(baseLayer, baseTheme);
        overlayLayer.style.clipPath = 'inset(0 100% 0 0)';
        sweepBar.style.opacity = '0';
      }
    }

    requestAnimationFrame(animate);
  }

  // --- Global Synchronized Video Clip Engine & Preloader ---
  const preloadVideo = document.createElement('video');
  preloadVideo.preload = 'auto';
  preloadVideo.muted = true;
  let preloadedClipIndex = -1;

  // Deterministically map UTC timestamp to clip index 0..TOTAL_CLIPS-1
  function getSyncClipIndexForTimestamp(ts) {
    const slot = Math.floor(ts / 10000);
    const hash = Math.abs((slot * 1103515245 + 12345) % 2147483647);
    return hash % TOTAL_CLIPS;
  }

  function checkAndPreloadNextVideoClip() {
    const effNow = getEffectiveDate().getTime();
    const currentSec = new Date(effNow).getSeconds();
    
    // Calculate timestamp of upcoming video phase (at second 5 of 10s cycle)
    const secsToNextVideo = (5 - (currentSec % 10) + 10) % 10;
    const upcomingTimestamp = effNow + (secsToNextVideo * 1000);
    const upcomingClipIndex = getSyncClipIndexForTimestamp(upcomingTimestamp);

    if (preloadedClipIndex !== upcomingClipIndex) {
      preloadedClipIndex = upcomingClipIndex;
      const clipIndexStr = String(upcomingClipIndex).padStart(3, '0');
      preloadVideo.src = `clips/clip_${clipIndexStr}.mp4`;
      preloadVideo.load();
    }
  }

  function playSyncedVideoClip() {
    const effNow = getEffectiveDate().getTime();
    const syncClipIndex = getSyncClipIndexForTimestamp(effNow);
    const clipIndexStr = String(syncClipIndex).padStart(3, '0');
    const clipUrl = `clips/clip_${clipIndexStr}.mp4`;

    videoPlayer.src = clipUrl;
    videoPlayer.currentTime = 0;
    videoPlayer.muted = true;
    videoPlayer.play().catch(e => console.log('Video play muted or blocked:', e));
  }

  // --- Phase Switcher (5s Clock / 5s Video) ---
  function switchPhase(newPhase) {
    if (currentPhase === 'HOUR_VIDEO') {
      videoPlayer.muted = true;
      // Start background music at second 30 when special hour video finishes
      if (audio && audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        audio.currentTime = 30.0 % audio.duration;
      }
    }

    currentPhase = newPhase;
    phaseSeconds = 0;

    if (currentPhase === 'CLOCK') {
      phasePill.textContent = 'CLOCK MODE';
      phasePill.style.background = '#e5006d';
      videoStage.classList.remove('active');
      videoPlayer.pause();

      updateClockDisplays();
      triggerSweep();
    } else {
      phasePill.textContent = 'DANCE MODE';
      phasePill.style.background = '#00e5a3';
      videoStage.classList.add('active');

      // Play globally synchronized video clip (muted)
      playSyncedVideoClip();
    }

    // Keep UNIQLOCK music track playing continuously across both phases
    if (isStarted && !isMuted && audio.paused) {
      audio.play().catch(() => { });
    }
  }

  // --- Audio Preloader Engine (Preloads next audio track 5s in advance) ---
  const preloadAudio = new Audio();
  let preloadedTrackIndex = -1;

  function getActiveTimeForDate(targetDate) {
    const city = CITIES[currentCityIndex];
    const now = targetDate || getEffectiveDate();
    let hour = now.getHours();
    let minute = now.getMinutes();

    if (city.timeZone) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: city.timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      const hr = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      hour = (hr === 24) ? 0 : hr;
      minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    }
    return { hour, minute };
  }

  function getSyncTrackIndexForDate(targetDate) {
    const { hour, minute } = getActiveTimeForDate(targetDate);
    const isNight = (hour >= 19 || hour < 6);

    // Minute 00: Special (Hour) tracks (Indices 19..23)
    if (minute === 0) {
      if (isNight) {
        const nightHourOffset = (hour >= 19 ? hour - 19 : hour + 5) % 2;
        return 22 + nightHourOffset;
      } else {
        const dayHourOffset = (hour - 6) % 3;
        return 19 + dayHourOffset;
      }
    }

    // Minutes 01 to 59: A different track every minute!
    if (isNight) {
      const nightOffset = (minute - 1) % 5;
      return 14 + nightOffset;
    } else {
      const dayOffset = (minute - 1) % 14;
      return dayOffset;
    }
  }

  function checkAndPreloadNextTrack() {
    const now = getEffectiveDate();
    const seconds = now.getSeconds();

    if (seconds >= 55) {
      const futureDate = new Date(now.getTime() + (60 - seconds) * 1000);
      const futureTrackIndex = getSyncTrackIndexForDate(futureDate);

      if (futureTrackIndex !== currentTrackIndex && preloadedTrackIndex !== futureTrackIndex) {
        preloadedTrackIndex = futureTrackIndex;
        preloadAudio.src = `UNIQLOCK/${AUDIO_FILES[futureTrackIndex]}`;
        preloadAudio.preload = 'auto';
        preloadAudio.load();
      }
    }
  }

  // Sync track according to Day / Night / Hour rules
  function syncTrackWithHour() {
    const targetTrackIndex = getSyncTrackIndexForDate(getEffectiveDate());
    if (currentTrackIndex !== targetTrackIndex) {
      loadAudioTrack(targetTrackIndex);
      trackSelect.value = targetTrackIndex;
    }
  }

  function playHourAnimationVideo(hour) {
    // Direct 1-to-1 match (User updated file names):
    // Hour 0 (00:00) -> hour_24.mp4 (or hour_00.mp4)
    // Hour 7 (07:00) -> hour_07.mp4
    // Hour 12 (12:00) -> hour_12.mp4
    // Hour 23 (23:00) -> hour_23.mp4
    const hourNum = (hour === 0) ? 24 : hour;
    const hourStr = String(hourNum).padStart(2, '0');
    const clipUrl = `hour_clips/hour_${hourStr}.mp4`;

    // Pause background music during special hour video
    if (audio) {
      audio.pause();
    }

    videoPlayer.src = clipUrl;
    videoPlayer.currentTime = 0;
    // Unmute video player so special hour video audio is heard
    videoPlayer.muted = isMuted;
    videoPlayer.play().catch(e => console.log('Hour video error:', e));
  }

  // --- Main Tick Engine (Synced directly with clock seconds: 0-4 = CLOCK, 5-9 = VIDEO) ---
  function onSecondTick() {
    updateClockDisplays();
    updateMinuteColorTheme();

    const effNow = getEffectiveDate();
    const { hour, minute } = getActiveTimeForDate(effNow);
    const seconds = effNow.getSeconds();
    const secondMod = seconds % 10;

    // Check track rotation at minute boundary (second 00)
    if (seconds === 0) {
      syncTrackWithHour();
    }

    // Preload next track at second 55
    if (seconds === 55) {
      checkAndPreloadNextTrack();
    }

    // Preload next video clip at second 1 (secondMod === 1)
    if (secondMod === 1) {
      checkAndPreloadNextVideoClip();
    }

    // Align audio currentTime to second of minute if drift exceeds 1.5s
    if (audio && audio.duration && !isNaN(audio.duration) && !audio.paused && currentPhase !== 'HOUR_VIDEO') {
      const targetAudioTime = (seconds + (effNow.getMilliseconds() / 1000)) % audio.duration;
      if (Math.abs(audio.currentTime - targetAudioTime) > 1.5) {
        audio.currentTime = targetAudioTime;
      }
    }

    // Minute 00 Special 30s Hour Fanfare Animation (00:00 to 00:29)
    // Plays EXCLUSIVELY the 30s special hour video, no dance clips!
    if (minute === 0 && seconds < 30) {
      if (currentPhase !== 'HOUR_VIDEO') {
        currentPhase = 'HOUR_VIDEO';
        phasePill.textContent = 'SPECIAL HOUR VIDEO';
        phasePill.style.background = '#00a0e9';
        videoStage.classList.add('active');
        playHourAnimationVideo(hour);
      }
      return;
    }

    // Seconds 30..59 of Minute 00 OR Regular Minutes 01..59: 5s Clock / 5s Video phase
    if (secondMod >= 0 && secondMod <= 4) {
      if (currentPhase !== 'CLOCK') {
        switchPhase('CLOCK');
      } else {
        triggerSweep();
      }
    } else {
      if (currentPhase !== 'VIDEO') {
        switchPhase('VIDEO');
      }
    }
  }

  // --- High-Precision Millisecond-Accurate Master RAF Engine ---
  let lastEvaluatedSecond = -1;

  function masterFrameLoop() {
    const effNow = getEffectiveDate();
    const currentSec = effNow.getSeconds();

    if (currentSec !== lastEvaluatedSecond) {
      lastEvaluatedSecond = currentSec;
      onSecondTick();
    }

    requestAnimationFrame(masterFrameLoop);
  }

  function startClockLoop() {
    updateMinuteColorTheme();
    syncTrackWithHour();
    masterFrameLoop();
  }

  // Set audio position to match current seconds of the minute (seconds + ms)
  function alignAudioWithCurrentSecond() {
    if (!audio) return;
    const now = getEffectiveDate();
    const currentSecs = now.getSeconds() + (now.getMilliseconds() / 1000);

    const setPosition = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
        audio.currentTime = currentSecs % audio.duration;
      }
    };

    if (audio.readyState >= 1) {
      setPosition();
    } else {
      audio.addEventListener('loadedmetadata', setPosition, { once: true });
    }
  }

  // --- Audio Player Manager ---
  function loadAudioTrack(index) {
    currentTrackIndex = index;
    const targetFile = AUDIO_FILES[currentTrackIndex];

    if (preloadedTrackIndex === index && preloadAudio.src) {
      audio.src = preloadAudio.src;
      preloadedTrackIndex = -1;
    } else {
      const targetSrc = `UNIQLOCK/${targetFile}`;
      if (!audio.src || !audio.src.endsWith(encodeURI(targetFile))) {
        audio.src = targetSrc;
      }
    }

    audio.playbackRate = 1.0;
    alignAudioWithCurrentSecond();

    if (isStarted && !isMuted) {
      audio.play().catch(e => console.log('Audio playback prevented:', e));
    }
  }

  // --- Debug Mode Monitor ---
  const debugPanel = document.getElementById('debug-panel');
  const debugBtn = document.getElementById('debug-btn');
  const debugCloseBtn = document.getElementById('debug-close-btn');
  let isDebugVisible = false;

  function toggleDebugMode() {
    isDebugVisible = !isDebugVisible;
    if (isDebugVisible) {
      debugPanel.classList.remove('hidden');
      updateDebugPanel();
    } else {
      debugPanel.classList.add('hidden');
    }
  }

  function updateDebugPanel() {
    if (!isDebugVisible) return;
    const now = new Date();
    const secs = now.getSeconds();
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    const dbgPhase = document.getElementById('dbg-phase');
    if (dbgPhase) dbgPhase.textContent = `${currentPhase} (${secs % 10}s / 5s)`;

    const dbgUtc = document.getElementById('dbg-utc');
    if (dbgUtc) dbgUtc.textContent = `${now.toISOString().substring(11, 19)}.${ms}`;

    const city = CITIES[currentCityIndex];
    const dbgCity = document.getElementById('dbg-city');
    if (dbgCity) dbgCity.textContent = `${city.label}`;

    const trackName = AUDIO_FILES[currentTrackIndex] || 'None';
    const dbgTrack = document.getElementById('dbg-track');
    if (dbgTrack) dbgTrack.textContent = `[${currentTrackIndex}] ${trackName.replace('.mp3', '')}`;

    const curSec = audio.currentTime ? audio.currentTime.toFixed(2) : '0.00';
    const durSec = audio.duration ? audio.duration.toFixed(2) : '0.00';
    const dbgAudioSec = document.getElementById('dbg-audio-sec');
    if (dbgAudioSec) dbgAudioSec.textContent = `${curSec}s / ${durSec}s (${audio.paused ? 'PAUSED' : 'PLAYING'})`;

    const preAudioName = preloadedTrackIndex !== -1 ? AUDIO_FILES[preloadedTrackIndex] : 'None';
    const dbgPreAudio = document.getElementById('dbg-preload-audio');
    if (dbgPreAudio) dbgPreAudio.textContent = preAudioName.replace('.mp3', '');

    const curVideoSrc = videoPlayer.src ? videoPlayer.src.split('/').pop() : 'None';
    const dbgVideo = document.getElementById('dbg-video');
    if (dbgVideo) dbgVideo.textContent = curVideoSrc;

    const preVideoSrc = preloadVideo.src ? preloadVideo.src.split('/').pop() : 'None';
    const dbgPreVideo = document.getElementById('dbg-preload-video');
    if (dbgPreVideo) dbgPreVideo.textContent = preVideoSrc;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--uniqlo-pink').trim();
    const dbgColor = document.getElementById('dbg-color');
    if (dbgColor) dbgColor.textContent = primaryColor;

    const dirs = ['Left->Right', 'Top->Bottom', 'Right->Left', 'Bottom->Top'];
    const dbgSweepDir = document.getElementById('dbg-sweep-dir');
    if (dbgSweepDir) dbgSweepDir.textContent = `${dirs[(sweepDirectionIndex - 1 + 4) % 4]} (#${sweepDirectionIndex})`;
  }

  // Update debug panel every 200ms when visible
  setInterval(updateDebugPanel, 200);

  function reSyncAllSystems() {
    currentPhase = 'IDLE'; // Reset active phase for clean state switch
    preloadedClipIndex = -1;
    preloadedTrackIndex = -1;

    // Re-evaluate audio track rules for effective simulated date
    const effDate = getEffectiveDate();
    const targetTrackIndex = getSyncTrackIndexForDate(effDate);
    currentTrackIndex = targetTrackIndex;
    if (trackSelect) trackSelect.value = targetTrackIndex;

    const targetFile = AUDIO_FILES[currentTrackIndex];
    const targetSrc = `UNIQLOCK/${targetFile}`;
    if (!audio.src || !audio.src.endsWith(encodeURI(targetFile))) {
      audio.src = targetSrc;
    }

    // Re-align audio position to current simulated seconds
    audio.playbackRate = 1.0;
    alignAudioWithCurrentSecond();

    if (isStarted && !isMuted && currentPhase !== 'HOUR_VIDEO') {
      audio.muted = false;
      audio.play().catch(e => console.log('ReSync audio play error:', e));
    }

    // Force immediate second tick & phase evaluation
    onSecondTick();
  }

  // --- Event Listeners ---
  if (debugBtn) debugBtn.addEventListener('click', toggleDebugMode);
  if (debugCloseBtn) debugCloseBtn.addEventListener('click', toggleDebugMode);

  const simH = document.getElementById('dbg-sim-h');
  const simM = document.getElementById('dbg-sim-m');
  const simS = document.getElementById('dbg-sim-s');
  const simApply = document.getElementById('dbg-sim-apply');
  const simReset = document.getElementById('dbg-sim-reset');

  if (simApply) {
    simApply.addEventListener('click', () => {
      const h = Math.max(0, Math.min(23, parseInt(simH?.value || '0', 10)));
      const m = Math.max(0, Math.min(59, parseInt(simM?.value || '0', 10)));
      const s = Math.max(0, Math.min(59, parseInt(simS?.value || '0', 10)));

      const target = new Date();
      target.setHours(h, m, s, 0);

      timeOffsetMs = target.getTime() - Date.now();
      reSyncAllSystems();
    });
  }

  if (simReset) {
    simReset.addEventListener('click', () => {
      timeOffsetMs = 0;
      if (simH) simH.value = '';
      if (simM) simM.value = '';
      if (simS) simS.value = '';

      reSyncAllSystems();
    });
  }

  // --- Bad Connection & 1-Minute Video Preloader Recovery System ---
  let isBufferingNetwork = false;
  let videoStallTimeout = null;
  let audioStallTimeout = null;

  const badConnectionOverlay = document.getElementById('bad-connection-overlay');
  const badConnectionBar = document.getElementById('bad-connection-bar');
  const badConnectionStatus = document.getElementById('bad-connection-status');
  const simBadConnBtn = document.getElementById('dbg-sim-bad-conn');

  function triggerBadConnectionRecovery() {
    if (isBufferingNetwork || !isStarted) return;
    isBufferingNetwork = true;

    if (videoStallTimeout) { clearTimeout(videoStallTimeout); videoStallTimeout = null; }
    if (audioStallTimeout) { clearTimeout(audioStallTimeout); audioStallTimeout = null; }

    // Show white background screen with red text
    if (badConnectionOverlay) badConnectionOverlay.classList.remove('hidden');
    if (badConnectionBar) badConnectionBar.style.width = '0%';
    if (badConnectionStatus) badConnectionStatus.textContent = 'Iniciando precarga (0%)...';

    const effNow = getEffectiveDate().getTime();
    const urlsToPreload = [];

    // Preload 1 minute of dance video clips (6 video slots of 10s cycles = 60s)
    for (let i = 0; i < 6; i++) {
      const futureTs = effNow + (i * 10000);
      const clipIdx = getSyncClipIndexForTimestamp(futureTs);
      const clipIndexStr = String(clipIdx).padStart(3, '0');
      urlsToPreload.push(`clips/clip_${clipIndexStr}.mp4`);
    }

    // Preload current audio track
    const currentTrackFile = AUDIO_FILES[currentTrackIndex];
    if (currentTrackFile) {
      urlsToPreload.push(`UNIQLOCK/${currentTrackFile}`);
    }

    let loadedCount = 0;
    const totalCount = urlsToPreload.length;

    const updateProgress = () => {
      loadedCount++;
      const pct = Math.floor((loadedCount / totalCount) * 100);
      if (badConnectionBar) badConnectionBar.style.width = `${pct}%`;
      if (badConnectionStatus) badConnectionStatus.textContent = `Precargando contenido... ${pct}% (${loadedCount}/${totalCount})`;
    };

    const preloadPromises = urlsToPreload.map(url => {
      return fetch(url)
        .then(res => res.blob())
        .then(() => updateProgress())
        .catch(err => {
          console.log('Preload error:', url, err);
          updateProgress();
        });
    });

    Promise.all(preloadPromises).then(() => {
      setTimeout(() => {
        if (badConnectionOverlay) badConnectionOverlay.classList.add('hidden');
        isBufferingNetwork = false;

        // Force complete system re-sync
        reSyncAllSystems();

        // Guarantee audio playback is resumed cleanly
        if (isStarted && !isMuted && currentPhase !== 'HOUR_VIDEO') {
          audio.muted = false;
          audio.play().catch(e => console.log('Audio resume error post recovery:', e));
        }
      }, 600);
    });
  }

  // Automatic Stall Detection (Only when playback is genuinely stuck for > 4 seconds)
  videoPlayer.addEventListener('waiting', () => {
    if (!videoPlayer.paused && isStarted && !isBufferingNetwork && currentPhase === 'VIDEO') {
      if (!videoStallTimeout) {
        videoStallTimeout = setTimeout(triggerBadConnectionRecovery, 4000);
      }
    }
  });

  videoPlayer.addEventListener('playing', () => {
    if (videoStallTimeout) { clearTimeout(videoStallTimeout); videoStallTimeout = null; }
  });

  videoPlayer.addEventListener('canplay', () => {
    if (videoStallTimeout) { clearTimeout(videoStallTimeout); videoStallTimeout = null; }
  });

  audio.addEventListener('waiting', () => {
    if (!audio.paused && isStarted && !isMuted && !isBufferingNetwork && currentPhase !== 'HOUR_VIDEO') {
      if (!audioStallTimeout) {
        audioStallTimeout = setTimeout(triggerBadConnectionRecovery, 4000);
      }
    }
  });

  audio.addEventListener('playing', () => {
    if (audioStallTimeout) { clearTimeout(audioStallTimeout); audioStallTimeout = null; }
  });

  if (simBadConnBtn) {
    simBadConnBtn.addEventListener('click', () => {
      triggerBadConnectionRecovery();
    });
  }

  startOverlay.addEventListener('click', () => {
    isStarted = true;
    startOverlay.classList.add('hidden');

    syncTrackWithHour();
    const trackIdx = getSyncTrackIndexForDate(new Date());
    loadAudioTrack(trackIdx);
    alignAudioWithCurrentSecond();

    // Ensure audio plays on user click gesture
    audio.play().catch(e => console.log('Audio start play error:', e));
  });

  trackSelect.addEventListener('change', (e) => {
    loadAudioTrack(parseInt(e.target.value, 10));
  });

  citySelect.addEventListener('change', (e) => {
    currentCityIndex = parseInt(e.target.value, 10);
    updateClockDisplays();
    syncTrackWithHour();
  });

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    audio.muted = isMuted;
    videoPlayer.muted = isMuted;
    muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound On';
  });

  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // Keyboard shortcut support (Space to toggle mute, F for fullscreen, D for Debug, G for Cartelera)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      muteBtn.click();
    } else if (e.code === 'KeyF') {
      fsBtn.click();
    } else if (e.code === 'KeyD') {
      toggleDebugMode();
    } else if (e.code === 'KeyG') {
      toggleCartelera();
    }
  });

  // --- Cartelera & Program Guide Engine ---
  const carteleraPanel = document.getElementById('cartelera-panel');
  const carteleraCloseBtn = document.getElementById('cartelera-close-btn');
  const carteleraSearchInput = document.getElementById('cartelera-search-input');
  const tabSongsBtn = document.getElementById('tab-songs-btn');
  const tabClipsBtn = document.getElementById('tab-clips-btn');
  const carteleraList = document.getElementById('cartelera-list');
  const dbgOpenCartelera = document.getElementById('dbg-open-cartelera');

  let activeCarteleraTab = 'SONGS';
  let isCarteleraVisible = false;

  function toggleCartelera() {
    isCarteleraVisible = !isCarteleraVisible;
    if (isCarteleraVisible) {
      if (carteleraPanel) carteleraPanel.classList.remove('hidden');
      renderCarteleraList();
    } else {
      if (carteleraPanel) carteleraPanel.classList.add('hidden');
    }
  }

  function renderCarteleraList() {
    if (!carteleraList) return;
    const query = (carteleraSearchInput?.value || '').toLowerCase().trim();
    carteleraList.innerHTML = '';

    if (activeCarteleraTab === 'SONGS') {
      AUDIO_FILES.forEach((file, idx) => {
        const cleanName = file.replace(/^\d+\s*/, '').replace('.mp3', '');
        if (query && !file.toLowerCase().includes(query) && !cleanName.toLowerCase().includes(query)) {
          return;
        }

        const item = document.createElement('div');
        item.className = 'cartelera-item';

        let categoryBadge = '';
        let scheduleInfo = '';
        let targetHour = 12;
        let targetMin = 0;

        if (idx >= 0 && idx <= 13) {
          categoryBadge = '<span class="cartelera-item-badge badge-day">CANCIÓN DE DÍA</span>';
          const minOffsets = [idx + 1, idx + 15, idx + 29, idx + 43].filter(m => m < 60);
          scheduleInfo = `Suena en horas de día (06:00 a 18:59) a los minutos: :${minOffsets.map(m => String(m).padStart(2, '0')).join(', :')}`;
          targetHour = 14;
          targetMin = minOffsets[0] || 1;
        } else if (idx >= 14 && idx <= 18) {
          categoryBadge = '<span class="cartelera-item-badge badge-night">CANCIÓN DE NOCHE</span>';
          const offset = idx - 14;
          const nightMins = [];
          for (let m = 1 + offset; m < 60; m += 5) nightMins.push(m);
          scheduleInfo = `Suena en horas de noche (19:00 a 05:59) a los minutos: :${nightMins.slice(0, 6).map(m => String(m).padStart(2, '0')).join(', :')}...`;
          targetHour = 22;
          targetMin = nightMins[0] || 1;
        } else {
          categoryBadge = '<span class="cartelera-item-badge badge-hour">HORA EN PUNTO (:00)</span>';
          scheduleInfo = `Suena en el minuto :00:00 de la hora en punto`;
          targetHour = 12;
          targetMin = 0;
        }

        item.innerHTML = `
          <div>
            <div class="cartelera-item-title">
              🎵 [${idx}] ${cleanName} ${categoryBadge}
            </div>
            <div class="cartelera-item-schedule">${scheduleInfo}</div>
          </div>
          <button class="cartelera-jump-btn" onclick="jumpToSimulatedTime(${targetHour}, ${targetMin}, 0)">▶ Reproducir Ahora</button>
        `;
        carteleraList.appendChild(item);
      });
    } else {
      // Clips Tab (24 Special Hours + Dance Clips)
      // 1. Render Special Hour Clips (hour_00 to hour_23)
      for (let h = 0; h < 24; h++) {
        const hourStr = String(h).padStart(2, '0');
        const clipName = `hour_${hourStr}`;
        if (query && !clipName.includes(query) && !`hora ${h}`.includes(query)) {
          continue;
        }

        const item = document.createElement('div');
        item.className = 'cartelera-item';
        item.innerHTML = `
          <div>
            <div class="cartelera-item-title">
              🎬 Vídeo Especial de la Hora ${hourStr}:00 <span class="cartelera-item-badge badge-hour">30S FANFARE</span>
            </div>
            <div class="cartelera-item-schedule">Se reproduce automáticamente de ${hourStr}:00:00 a ${hourStr}:00:30 (animación especial)</div>
          </div>
          <button class="cartelera-jump-btn" onclick="jumpToSimulatedTime(${h}, 0, 0)">▶ Ver Animación</button>
        `;
        carteleraList.appendChild(item);
      }

      // 2. Render Dance Clips sample (000 to 101)
      for (let c = 0; c < TOTAL_CLIPS; c++) {
        const clipStr = String(c).padStart(3, '0');
        const clipName = `clip_${clipStr}`;
        if (query && !clipName.includes(query) && !`baile ${c}`.includes(query)) {
          continue;
        }

        // Find upcoming timestamp for clip
        const effNow = getEffectiveDate().getTime();
        let sampleHour = 14;
        let sampleMin = 5;

        for (let i = 0; i < 200; i++) {
          const testTs = effNow + (i * 10000);
          if (getSyncClipIndexForTimestamp(testTs) === c) {
            const d = new Date(testTs);
            sampleHour = d.getHours();
            sampleMin = d.getMinutes();
            break;
          }
        }

        const item = document.createElement('div');
        item.className = 'cartelera-item';
        item.innerHTML = `
          <div>
            <div class="cartelera-item-title">
              💃 Clip de Baile #${c} (${clipName}.mp4) <span class="cartelera-item-badge badge-day">5S DANCE</span>
            </div>
            <div class="cartelera-item-schedule">Clip de baile sincronizado mundialmente (próximo pase a las ${String(sampleHour).padStart(2, '0')}:${String(sampleMin).padStart(2, '0')})</div>
          </div>
          <button class="cartelera-jump-btn" onclick="jumpToSimulatedTime(${sampleHour}, ${sampleMin}, 5)">▶ Ver Clip</button>
        `;
        carteleraList.appendChild(item);
      }
    }

    if (carteleraList.children.length === 0) {
      carteleraList.innerHTML = `<div style="text-align:center; padding:30px; color:rgba(255,255,255,0.4);">No se encontraron resultados para "${query}"</div>`;
    }
  }

  // Jump helper function accessible globally
  window.jumpToSimulatedTime = function(h, m, s) {
    const target = new Date();
    target.setHours(h, m, s, 0);
    timeOffsetMs = target.getTime() - Date.now();
    reSyncAllSystems();
    if (isCarteleraVisible) toggleCartelera();
  };

  if (carteleraCloseBtn) carteleraCloseBtn.addEventListener('click', toggleCartelera);
  if (dbgOpenCartelera) dbgOpenCartelera.addEventListener('click', toggleCartelera);

  if (tabSongsBtn) {
    tabSongsBtn.addEventListener('click', () => {
      activeCarteleraTab = 'SONGS';
      tabSongsBtn.classList.add('active');
      tabClipsBtn.classList.remove('active');
      renderCarteleraList();
    });
  }

  if (tabClipsBtn) {
    tabClipsBtn.addEventListener('click', () => {
      activeCarteleraTab = 'CLIPS';
      tabClipsBtn.classList.add('active');
      tabSongsBtn.classList.remove('active');
      renderCarteleraList();
    });
  }

  if (carteleraSearchInput) {
    carteleraSearchInput.addEventListener('input', () => {
      renderCarteleraList();
    });
  }

  // --- Touch & Mobile Floating Control Buttons ---
  const touchCarteleraBtn = document.getElementById('touch-cartelera-btn');
  const touchDebugBtn = document.getElementById('touch-debug-btn');
  const touchMuteBtn = document.getElementById('touch-mute-btn');
  const touchFsBtn = document.getElementById('touch-fs-btn');

  if (touchCarteleraBtn) touchCarteleraBtn.addEventListener('click', toggleCartelera);
  if (touchDebugBtn) touchDebugBtn.addEventListener('click', toggleDebugMode);

  if (touchMuteBtn) {
    touchMuteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      audio.muted = isMuted;
      videoPlayer.muted = isMuted;
      touchMuteBtn.textContent = isMuted ? '🔇' : '🔊';
      if (muteBtn) muteBtn.textContent = isMuted ? '🔇 Muted' : '🔊 Sound On';
    });
  }

  if (touchFsBtn) {
    touchFsBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  // Start loop!
  startClockLoop();
});
