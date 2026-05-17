// Aether Morse - Application Logic & Audio Engine

// 1. DICTIONARY DEFINITIONS
const MORSE_DICTIONARY = {
    'A': '.-',     'B': '-...',   'C': '-.-.',   'D': '-..',    'E': '.',
    'F': '..-.',   'G': '--.',    'H': '....',   'I': '..',     'J': '.---',
    'K': '-.-',    'L': '.-..',   'M': '--',     'N': '-.',     'O': '---',
    'P': '.--.',   'Q': '--.-',   'R': '.-.',    'S': '...',    'T': '-',
    'U': '..-',    'V': '...-',   'W': '.--',    'X': '-..-',   'Y': '-.--',
    'Z': '--..',
    '1': '.----',  '2': '..---',  '3': '...--',  '4': '....-',  '5': '.....',
    '6': '-....',  '7': '--...',  '8': '---..',  '9': '----.',  '0': '-----',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', '\'': '.----.', '!': '-.-.--',
    '/': '-..-.',  '(': '-.--.',  ')': '-.--.-', '&': '.-...',  ':': '---...',
    ';': '-.-.-.', '=': '-...-',  '+': '.-.-.',  '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
    ' ': '/'
};

// Create inverse map for quick decoding
const REVERSE_DICTIONARY = {};
Object.keys(MORSE_DICTIONARY).forEach(key => {
    REVERSE_DICTIONARY[MORSE_DICTIONARY[key]] = key;
});

// Prosigns / Common Signals for reference
const PROSIGNS = {
    'SOS': '...---...',
    'CQ': '-.-.--.-',
    'AR': '.-.-.',
    'KN': '-.--.',
    'SK': '...-.-',
    'BT': '-...-'
};

// 2. STATE MANAGEMENT
let audioContext = null;
let currentOscillator = null;
let currentGainNode = null;
let playTimeoutIds = [];
let activeOscillators = []; // Track active scheduled oscillators for real-time parameter sweeps
let activeScheduledSegments = []; // { start, end, char, charIndex }
let isPlaying = false;
let animationFrameId = null;

// Oscilloscope and sound controls state
let analyserNode = null;
let oscilloscopeDrawing = false;
let selectedWaveform = 'sine';

// Static Noise generator nodes
let staticBuffer = null;
let staticSourceNode = null;
let staticGainNode = null;

// Training Tutor game state
let tutorActive = false;
const tutorWordsList = ['SOS', 'CQ', 'AETHER', 'COSMIC', 'GALAXY', 'SPACE', 'BEACON', 'HELLO', 'AI', 'SIGNAL', 'STAR', 'VECTORS', 'PORTAL', 'TELEGRAPH'];
let tutorCurrentWord = '';
let tutorLetterIndex = 0;
let tutorLetterElements = [];

// Keyer manual state
let keyerActive = true;
let isKeyDown = false;
let keyPressStartTime = 0;
let keyInactivityTimer = null;
let keyWordSpacingTimer = null;
let keyBuffer = []; // Temp symbols for current letter
let liveOscillator = null;
let liveGainNode = null;

// Custom presets
const PRESETS = {
    sos: {
        plain: 'SOS',
        morse: '... --- ...'
    },
    hello: {
        plain: 'HELLO WORLD',
        morse: '.... . .-.. .-.. --- / .-- --- .-. .-.. -..'
    },
    antigravity: {
        plain: 'ANTIGRAVITY AI',
        morse: '.- -. - .. --. .-. .- ...- .. - -.-- / .- ..'
    },
    cq: {
        plain: 'CQ CQ CQ DX',
        morse: '-.-. --.- / -.-. --.- / -.-. --.- / -.. -..-'
    },
    stardust: {
        plain: 'STARDUST VOYAGE',
        morse: '... - .- .-. -.. ..- ... - / ...- --- -.-- .- --. .'
    }
};

// DOM ELEMENTS
const plainInput = document.getElementById('plain-input');
const morseInput = document.getElementById('morse-input');
const plainCharCount = document.getElementById('plain-char-count');
const morseWordCount = document.getElementById('morse-word-count');
const sampleSelect = document.getElementById('sample-select');

// Interactive dynamic canvas & selectors
const oscCanvas = document.getElementById('oscilloscope');
const oscCtx = oscCanvas ? oscCanvas.getContext('2d') : null;
const staticSlider = document.getElementById('static-slider');
const staticValue = document.getElementById('static-value');

// Practice Tutor DOM
const tutorToggleBtn = document.getElementById('tutor-toggle-btn');
const tutorBodyArea = document.getElementById('tutor-body-area');
const tutorWordDisplay = document.getElementById('tutor-word-display');
const tutorGuideCode = document.getElementById('tutor-guide-code');
const tutorProgressFill = document.getElementById('tutor-progress-fill');
const tutorFeedbackText = document.getElementById('tutor-feedback-text');

// Buttons
const clearPlainBtn = document.getElementById('clear-plain-btn');
const copyPlainBtn = document.getElementById('copy-plain-btn');
const listenPlainBtn = document.getElementById('listen-plain-btn');
const clearMorseBtn = document.getElementById('clear-morse-btn');
const copyMorseBtn = document.getElementById('copy-morse-btn');
const listenMorseBtn = document.getElementById('listen-morse-btn');
const insertDotBtn = document.getElementById('insert-dot-btn');
const insertDashBtn = document.getElementById('insert-dash-btn');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');

// Sliders
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const pitchSlider = document.getElementById('pitch-slider');
const pitchValue = document.getElementById('pitch-value');

// Keyer elements
const keyerToggle = document.getElementById('keyer-toggle');
const telegraphKey = document.getElementById('telegraph-key');
const metricDuration = document.getElementById('metric-duration');
const metricSymbol = document.getElementById('metric-symbol');
const metricBuffer = document.getElementById('metric-buffer');
const engineStatusPulse = document.getElementById('engine-status-pulse');
const engineStatusText = document.getElementById('engine-status-text');
const keyerStatusPulse = document.getElementById('keyer-status-pulse');
const keyerStatusText = document.getElementById('keyer-status-text');

// Beacon
const visualBeacon = document.getElementById('visual-beacon');
const visualBeaconGlow = document.getElementById('visual-beacon-glow');
const bridgeArrowPath = document.getElementById('bridge-arrow-path');
const bridgeDirectionIndicator = document.getElementById('translation-direction-indicator');

// 3. DICTIONARY RENDERING
function renderDictionary() {
    const lettersGrid = document.getElementById('tab-letters');
    const numbersGrid = document.getElementById('tab-numbers');
    const prosignsGrid = document.getElementById('tab-prosigns');

    lettersGrid.innerHTML = '';
    numbersGrid.innerHTML = '';
    prosignsGrid.innerHTML = '';

    // Letters (A-Z)
    for (let charCode = 65; charCode <= 90; charCode++) {
        const char = String.fromCharCode(charCode);
        lettersGrid.appendChild(createDictItem(char, MORSE_DICTIONARY[char]));
    }

    // Numbers (0-9)
    for (let i = 0; i <= 9; i++) {
        const char = i.toString();
        numbersGrid.appendChild(createDictItem(char, MORSE_DICTIONARY[char]));
    }

    // Prosigns
    Object.keys(PROSIGNS).forEach(key => {
        prosignsGrid.appendChild(createDictItem(key, PROSIGNS[key]));
    });
}

function createDictItem(char, morse) {
    const item = document.createElement('div');
    item.className = 'dict-item';
    item.id = `dict-${char.toLowerCase()}`;
    item.innerHTML = `
        <span class="dict-char">${char}</span>
        <span class="dict-morse">${morse}</span>
    `;
    return item;
}

// Dictionary tabs switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dictionary-grid').forEach(g => g.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = document.getElementById(`tab-${btn.dataset.tab}`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
    });
});

// Highlight a character in the dictionary
function highlightDictChar(char, highlight = true) {
    if (!char) return;
    const cleanChar = char.toUpperCase();
    const elem = document.getElementById(`dict-${cleanChar.toLowerCase()}`);
    if (elem) {
        if (highlight) {
            elem.classList.add('highlight');
        } else {
            elem.classList.remove('highlight');
        }
    }
}

function clearAllDictHighlights() {
    document.querySelectorAll('.dict-item').forEach(item => {
        item.classList.remove('highlight');
    });
}


// 4. TRANSLATION LOGIC
function translateTextToMorse(text) {
    const cleanText = text.toUpperCase().trim();
    let result = [];
    
    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (MORSE_DICTIONARY[char] !== undefined) {
            result.push(MORSE_DICTIONARY[char]);
        } else {
            // Ignore unrecognized characters or map to space
            result.push('');
        }
    }
    
    // Join with spaces representing separation between letters
    return result.filter(x => x !== '').join(' ');
}

function translateMorseToText(morse) {
    // Standard Morse formatting: letters separated by space, words by / or multiple spaces
    const cleanMorse = morse.trim();
    if (!cleanMorse) return '';

    // Standardize spacing: spaces flanking slashes
    const standardized = cleanMorse.replace(/\s*\/\s*/g, ' / ');
    const words = standardized.split(' / ');
    let plainWords = [];

    words.forEach(word => {
        if (!word.trim()) return;
        const letters = word.trim().split(/\s+/);
        let plainWord = '';
        letters.forEach(letter => {
            if (REVERSE_DICTIONARY[letter] !== undefined) {
                plainWord += REVERSE_DICTIONARY[letter];
            } else {
                plainWord += '?'; // Unrecognized letter
            }
        });
        plainWords.push(plainWord);
    });

    return plainWords.join(' ');
}

// Update character and word displays
function updateStats() {
    const plainLen = plainInput.value.length;
    plainCharCount.textContent = `${plainLen} char${plainLen !== 1 ? 's' : ''}`;

    const morseSymbols = morseInput.value.trim().replace(/[^.-]/g, '').length;
    morseWordCount.textContent = `${morseSymbols} symbol${morseSymbols !== 1 ? 's' : ''}`;
}

// Input synchronization
plainInput.addEventListener('input', (e) => {
    // If user is actively typing in plain, copy to morse
    const morseVal = translateTextToMorse(plainInput.value);
    morseInput.value = morseVal;
    updateStats();
    animateBridge('right');
});

morseInput.addEventListener('input', (e) => {
    // If user is actively typing in morse, convert to plain
    const plainVal = translateMorseToText(morseInput.value);
    plainInput.value = plainVal;
    updateStats();
    animateBridge('left');
});

function animateBridge(direction) {
    if (direction === 'right') {
        bridgeArrowPath.setAttribute('d', 'M5 12h14M12 5l7 7-7 7');
        bridgeDirectionIndicator.style.color = 'var(--cyan-neon)';
        bridgeDirectionIndicator.style.boxShadow = '0 0 15px rgba(0, 242, 254, 0.35)';
    } else {
        bridgeArrowPath.setAttribute('d', 'M19 12H5M12 19l-7-7 7-7');
        bridgeDirectionIndicator.style.color = '#a18cd1';
        bridgeDirectionIndicator.style.boxShadow = '0 0 15px rgba(161, 140, 209, 0.35)';
    }
    setTimeout(() => {
        bridgeDirectionIndicator.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.15)';
        bridgeDirectionIndicator.style.color = 'var(--text-secondary)';
    }, 400);
}


// 5. AUDIO SYNTH ENGINE (THE AURALIZER)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Connect AnalyserNode for spectrum visualization
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.connect(audioContext.destination);

        engineStatusPulse.className = "status-pulse blue";
        engineStatusText.textContent = "SYNTH: ACTIVE";

        // Start Oscilloscope loop immediately
        startOscilloscopeLoop();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            if (analyserNode && !oscilloscopeDrawing) {
                startOscilloscopeLoop();
            }
        });
    }
}

// Neon Oscilloscope Drawing Loop
function startOscilloscopeLoop() {
    if (!oscCtx || !analyserNode || oscilloscopeDrawing) return;
    oscilloscopeDrawing = true;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!oscilloscopeDrawing) return;
        requestAnimationFrame(draw);

        analyserNode.getByteTimeDomainData(dataArray);

        // Glassmorphic matching dark background
        oscCtx.fillStyle = 'rgba(6, 8, 14, 0.4)';
        oscCtx.fillRect(0, 0, oscCanvas.width, oscCanvas.height);

        // Center line
        oscCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        oscCtx.lineWidth = 1;
        oscCtx.beginPath();
        oscCtx.moveTo(0, oscCanvas.height / 2);
        oscCtx.lineTo(oscCanvas.width, oscCanvas.height / 2);
        oscCtx.stroke();

        // Neon Glow Wave
        oscCtx.lineWidth = 2.5;
        oscCtx.strokeStyle = 'rgba(0, 242, 254, 0.85)';
        oscCtx.shadowColor = 'rgba(0, 242, 254, 0.5)';
        oscCtx.shadowBlur = 4;
        oscCtx.beginPath();

        const sliceWidth = oscCanvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * oscCanvas.height) / 2;

            if (i === 0) {
                oscCtx.moveTo(x, y);
            } else {
                oscCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        oscCtx.lineTo(oscCanvas.width, oscCanvas.height / 2);
        oscCtx.stroke();
        oscCtx.shadowBlur = 0; // Reset shadow glow
    }

    draw();
}

// Background Shortwave Static White Noise Generator
function getWhiteNoiseBuffer() {
    if (staticBuffer) return staticBuffer;
    
    const bufferSize = 2 * audioContext.sampleRate;
    staticBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = staticBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    return staticBuffer;
}

function initStaticNoise() {
    if (!audioContext || staticSourceNode) return;

    const buffer = getWhiteNoiseBuffer();
    staticSourceNode = audioContext.createBufferSource();
    staticSourceNode.buffer = buffer;
    staticSourceNode.loop = true;

    staticGainNode = audioContext.createGain();
    const sliderVal = parseInt(staticSlider.value, 10);
    staticGainNode.gain.value = (sliderVal / 100) * 0.08; // Maximum gain threshold scaled to prevent overwhelming main pitch tone

    staticSourceNode.connect(staticGainNode);
    // Connect static to our visual AnalyserNode so user sees static fizz in real time!
    staticGainNode.connect(analyserNode);

    staticSourceNode.start(0);
}

function updateStaticVolume() {
    const sliderVal = parseInt(staticSlider.value, 10);
    if (staticValue) {
        staticValue.textContent = `${sliderVal}%`;
    }

    if (sliderVal > 0) {
        initAudio();
        initStaticNoise();
        if (staticGainNode) {
            staticGainNode.gain.setValueAtTime((sliderVal / 100) * 0.08, audioContext.currentTime);
        }
    } else {
        if (staticGainNode) {
            staticGainNode.gain.setValueAtTime(0, audioContext.currentTime);
        }
    }
}

// Calculate timing units based on standard Paris formula
// WPM = 1.2 / dotDuration (in seconds)
// dotDuration = 1.2 / WPM
function getTiming() {
    const wpm = parseInt(speedSlider.value, 10);
    const dotDuration = 1.2 / wpm; // Dot length in seconds
    return {
        dot: dotDuration,
        dash: dotDuration * 3,
        intraCharGap: dotDuration,
        letterGap: dotDuration * 3,
        wordGap: dotDuration * 7
    };
}

function getPitch() {
    return parseInt(pitchSlider.value, 10);
}

// Synthesize a speech read-aloud of the plain text using Web Speech API
listenPlainBtn.addEventListener('click', () => {
    const text = plainInput.value.trim();
    if (!text) return;
    
    // Stop Morse playback if active
    stopMorseSound();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => {
        engineStatusPulse.className = "status-pulse green";
        engineStatusText.textContent = "SPEECH: READING";
    };
    utterance.onend = () => {
        engineStatusPulse.className = "status-pulse blue";
        engineStatusText.textContent = "SYNTH: ACTIVE";
    };
    
    window.speechSynthesis.cancel(); // Cancel active reading
    window.speechSynthesis.speak(utterance);
});

// Scheduling Morse Playback using High Precision Audio Scheduler
function playMorseSound() {
    initAudio();
    stopMorseSound(); // Clear any active playbacks

    const morseStr = morseInput.value.trim();
    if (!morseStr) return;

    isPlaying = true;
    playBtn.disabled = true;
    if (listenMorseBtn) listenMorseBtn.disabled = true;
    stopBtn.disabled = false;
    playBtn.classList.add('btn-secondary');
    playBtn.classList.remove('btn-primary');

    const timing = getTiming();
    const frequency = getPitch();

    let currentTime = audioContext.currentTime + 0.05; // Small buffer for scheduling smoothness
    activeScheduledSegments = []; // Reset active intervals

    // We split into letters and word boundary slashes
    const elements = morseStr.split(/(\s+)/); // Keep separator whitespace to track spacing
    
    // Map plain text char indexes to correlate highlighting
    const plainWords = plainInput.value.toUpperCase().split(/\s+/);
    let plainCharIndex = 0;

    elements.forEach((elem) => {
        const trimmed = elem.trim();
        if (trimmed === '') {
            // Ignore spacing elements because boundaries are handled within the segments
            return;
        }

        if (trimmed === '/') {
            // Word boundary gap
            // A word boundary slash adds total 7 units of gap.
            // Since the last character element added 1 unit at its end, we schedule silence for remaining 6 units.
            currentTime += timing.dot * 6;
            plainCharIndex++; // Account for space character
            return;
        }

        // It is a morse letter (e.g. ".-")
        // Find corresponding plain text char to highlight
        const plainLetter = REVERSE_DICTIONARY[trimmed] || '';

        for (let i = 0; i < trimmed.length; i++) {
            const sym = trimmed[i];
            const start = currentTime;
            let duration = 0;

            if (sym === '.') {
                duration = timing.dot;
            } else if (sym === '-') {
                duration = timing.dash;
            }

            if (duration > 0) {
                // Schedule the oscillator tone
                scheduleOscTone(start, duration, frequency);
                
                // Save coordinates for the RAF visual sync loop
                activeScheduledSegments.push({
                    start: start,
                    end: start + duration,
                    char: plainLetter,
                    charIndex: plainCharIndex
                });
                
                currentTime += duration;
            }

            // Silent gap between dots/dashes within the same letter (1 unit)
            if (i < trimmed.length - 1) {
                currentTime += timing.intraCharGap;
            }
        }

        // Silent gap between letters in a word (3 units)
        // Since we already added 1 unit gap by scheduling, we add remaining 2 units
        currentTime += timing.dot * 2;
        plainCharIndex++;
    });

    // Schedule stop event when final element finishes
    const totalDurationMs = (currentTime - audioContext.currentTime) * 1000;
    const stopTimeout = setTimeout(() => {
        stopMorseSound();
    }, totalDurationMs + 100);
    playTimeoutIds.push(stopTimeout);

    // Start precision visual sync loop
    startVisualSyncLoop();
}

function scheduleOscTone(startTime, duration, freq) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    // Route to dynamic spectrum analyser node instead of direct destination
    gain.connect(analyserNode);

    osc.type = selectedWaveform;
    osc.frequency.setValueAtTime(freq, startTime);

    // Audio envelope windowing (prevents annoying speaker pops)
    const attackTime = 0.005; // 5ms rise
    const releaseTime = 0.005; // 5ms fall

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.4, startTime + attackTime);
    gain.gain.setValueAtTime(0.4, startTime + duration - releaseTime);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);

    // Track active scheduled oscillators for real-time adjustments
    activeOscillators.push(osc);

    // Remove from active list when finished playing
    const durationMs = (startTime + duration + 0.01 - audioContext.currentTime) * 1000;
    setTimeout(() => {
        const index = activeOscillators.indexOf(osc);
        if (index > -1) {
            activeOscillators.splice(index, 1);
        }
    }, Math.max(0, durationMs));
}

function stopMorseSound() {
    isPlaying = false;
    playBtn.disabled = false;
    if (listenMorseBtn) listenMorseBtn.disabled = false;
    stopBtn.disabled = true;
    playBtn.classList.remove('btn-secondary');
    playBtn.classList.add('btn-primary');

    // Cancel all schedule timeouts
    playTimeoutIds.forEach(id => clearTimeout(id));
    playTimeoutIds = [];

    // Stop high-precision RAF loops
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Reset indicator highlights
    visualBeacon.classList.remove('active');
    visualBeaconGlow.classList.remove('active');
    clearAllDictHighlights();
    
    // Disconnect scheduled oscillators instantly
    activeOscillators.forEach(osc => {
        try {
            osc.stop();
        } catch(e) {}
    });
    activeOscillators = [];
    
    // Disconnect oscillators if any are immediate
    if (currentOscillator) {
        try {
            currentOscillator.stop();
        } catch(e) {}
        currentOscillator = null;
    }
}

// High Precision requestAnimationFrame Sync Loop
function startVisualSyncLoop() {
    if (!audioContext) return;
    
    function tick() {
        if (!isPlaying) return;

        const curTime = audioContext.currentTime;
        let activeTone = false;
        let activeChar = null;

        for (let i = 0; i < activeScheduledSegments.length; i++) {
            const seg = activeScheduledSegments[i];
            if (curTime >= seg.start && curTime <= seg.end) {
                activeTone = true;
                activeChar = seg.char;
                break;
            }
        }

        // Toggle Beacon Visual Glow
        if (activeTone) {
            visualBeacon.classList.add('active');
            visualBeaconGlow.classList.add('active');
            
            // Highlight current playing character in Cheat Sheet dictionary
            clearAllDictHighlights();
            if (activeChar) {
                highlightDictChar(activeChar, true);
            }
        } else {
            visualBeacon.classList.remove('active');
            visualBeaconGlow.classList.remove('active');
            clearAllDictHighlights();
        }

        animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
}

// 6. TELEGRAPH MANUAL STATION KEYER
function startLiveOscillator() {
    initAudio();
    if (liveOscillator) return; // Already running

    liveOscillator = audioContext.createOscillator();
    liveGainNode = audioContext.createGain();

    liveOscillator.connect(liveGainNode);
    // Route to spectrum analyser instead of direct destination
    liveGainNode.connect(analyserNode);

    liveOscillator.type = selectedWaveform;
    liveOscillator.frequency.value = getPitch();

    // Soft rise
    liveGainNode.gain.setValueAtTime(0, audioContext.currentTime);
    liveGainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.003);

    liveOscillator.start();
}

function stopLiveOscillator() {
    if (!liveOscillator) return;
    
    const curGain = liveGainNode;
    const curOsc = liveOscillator;
    
    // Soft fall
    curGain.gain.setValueAtTime(curGain.gain.value, audioContext.currentTime);
    curGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.005);
    
    setTimeout(() => {
        try {
            curOsc.stop();
            curOsc.disconnect();
        } catch(e) {}
    }, 15);

    liveOscillator = null;
    liveGainNode = null;
}

// Handle Keyer press-down
function handleKeyerDown(e) {
    if (e) e.preventDefault(); // Stop spacebar scrolling
    if (!keyerActive || isKeyDown) return;
    if (isPlaying) stopMorseSound(); // Terminate automated playbacks

    isKeyDown = true;
    keyPressStartTime = Date.now();
    telegraphKey.classList.add('pressed');
    visualBeacon.classList.add('active');
    visualBeaconGlow.classList.add('active');

    keyerStatusPulse.className = "status-pulse blue";
    keyerStatusText.textContent = "KEYER: TRANSMITTING";

    // Play oscillator tone
    startLiveOscillator();

    // Clear word/letter spacing idle timers
    clearTimeout(keyInactivityTimer);
    clearTimeout(keyWordSpacingTimer);
}

// Handle Keyer release-up
function handleKeyerUp(e) {
    if (e) e.preventDefault();
    if (!keyerActive || !isKeyDown) return;

    isKeyDown = false;
    telegraphKey.classList.remove('pressed');
    visualBeacon.classList.remove('active');
    visualBeaconGlow.classList.remove('active');

    keyerStatusPulse.className = "status-pulse green";
    keyerStatusText.textContent = "KEYER: IDLE";

    // Mute oscillator
    stopLiveOscillator();

    const pressDuration = Date.now() - keyPressStartTime;
    metricDuration.textContent = `${pressDuration} ms`;

    // Dynamic thresholds based on active WPM slider
    const timing = getTiming();
    const dotDurationMs = timing.dot * 1000;
    
    // Determine symbol: standard dot = 1 unit, dash = 3 units.
    // Threshold set in the middle = 2.2 units
    const symbolThreshold = dotDurationMs * 2.2;
    const symbol = pressDuration <= symbolThreshold ? '.' : '-';

    metricSymbol.textContent = symbol === '.' ? '• Dot' : '▬ Dash';

    // Append to live keyer buffer
    keyBuffer.push(symbol);
    metricBuffer.textContent = keyBuffer.join(' ');

    // Character completion timeout (inactive for 3.5 units)
    keyInactivityTimer = setTimeout(() => {
        completeManualCharacter();
    }, dotDurationMs * 3.5);

    // Word completion timeout (inactive for 7.5 units)
    keyWordSpacingTimer = setTimeout(() => {
        completeManualWord();
    }, dotDurationMs * 7.5);
}

// Trigger a manual symbol (dot or dash) directly from keydown (e.g. '.' or '-')
function triggerManualSymbol(symbol) {
    if (!keyerActive) return;
    if (isPlaying) stopMorseSound(); // Terminate automated playbacks

    // Visual indicators
    telegraphKey.classList.add('pressed');
    visualBeacon.classList.add('active');
    visualBeaconGlow.classList.add('active');

    keyerStatusPulse.className = "status-pulse blue";
    keyerStatusText.textContent = "KEYER: TRANSMITTING";

    // Play tone for the duration of the symbol
    const timing = getTiming();
    const dotDurationMs = timing.dot * 1000;
    const durationMs = symbol === '.' ? dotDurationMs : dotDurationMs * 3;

    // Reset visual indicator after the tone duration
    setTimeout(() => {
        telegraphKey.classList.remove('pressed');
        visualBeacon.classList.remove('active');
        visualBeaconGlow.classList.remove('active');
        keyerStatusPulse.className = "status-pulse green";
        keyerStatusText.textContent = "KEYER: IDLE";
    }, durationMs);

    // Play synthesized tone
    const frequency = getPitch();
    const startTime = audioContext.currentTime;
    const durationSec = durationMs / 1000;
    
    initAudio();
    scheduleOscTone(startTime, durationSec, frequency);

    metricDuration.textContent = `${Math.round(durationMs)} ms`;
    metricSymbol.textContent = symbol === '.' ? '• Dot' : '▬ Dash';

    // Clear word/letter spacing idle timers
    clearTimeout(keyInactivityTimer);
    clearTimeout(keyWordSpacingTimer);

    // Append to live keyer buffer
    keyBuffer.push(symbol);
    metricBuffer.textContent = keyBuffer.join(' ');

    // Character completion timeout (inactive for 3.5 units)
    keyInactivityTimer = setTimeout(() => {
        completeManualCharacter();
    }, dotDurationMs * 3.5);

    // Word completion timeout (inactive for 7.5 units)
    keyWordSpacingTimer = setTimeout(() => {
        completeManualWord();
    }, dotDurationMs * 7.5);
}

function completeManualCharacter() {
    if (keyBuffer.length === 0) return;
    
    const morseChar = keyBuffer.join('');
    keyBuffer = []; // Clear
    metricBuffer.textContent = '...';

    // Highlight tapped character in dictionary cheat sheet
    const plainChar = REVERSE_DICTIONARY[morseChar];
    if (plainChar) {
        highlightDictChar(plainChar, true);
        setTimeout(() => highlightDictChar(plainChar, false), 400);
    }

    if (tutorActive) {
        handleTutorTap(morseChar, plainChar);
        return; // Intercept keyer to flow inside tutor instead of translation areas
    }

    // Append standard space if Morse input already has content
    if (morseInput.value.length > 0 && !morseInput.value.endsWith(' ') && !morseInput.value.endsWith('/')) {
        morseInput.value += ' ';
    }
    
    morseInput.value += morseChar;
    
    // Trigger translation
    const plainVal = translateMorseToText(morseInput.value);
    plainInput.value = plainVal;
    updateStats();
}

function completeManualWord() {
    if (morseInput.value.length === 0 || morseInput.value.endsWith(' / ') || morseInput.value.endsWith('/')) return;
    
    morseInput.value += ' / ';
    
    const plainVal = translateMorseToText(morseInput.value);
    plainInput.value = plainVal;
    updateStats();
}

// 7. LISTENERS & TRIGGERS

// Playback
playBtn.addEventListener('click', playMorseSound);
stopBtn.addEventListener('click', stopMorseSound);

// Sliders updates
speedSlider.addEventListener('input', () => {
    speedValue.textContent = `${speedSlider.value} WPM`;
});

pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = `${pitchSlider.value} Hz`;
    const newPitch = parseInt(pitchSlider.value, 10);
    // Real-time frequency adjustment during active playbacks
    activeOscillators.forEach(osc => {
        try {
            osc.frequency.setValueAtTime(newPitch, audioContext.currentTime);
        } catch(e) {}
    });
});

// Clear Textareas
clearPlainBtn.addEventListener('click', () => {
    plainInput.value = '';
    morseInput.value = '';
    updateStats();
    stopMorseSound();
});

clearMorseBtn.addEventListener('click', () => {
    plainInput.value = '';
    morseInput.value = '';
    updateStats();
    stopMorseSound();
});

// Clipboard Utilities
copyPlainBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(plainInput.value);
    const origText = copyPlainBtn.innerHTML;
    copyPlainBtn.innerHTML = 'Copied!';
    setTimeout(() => { copyPlainBtn.innerHTML = origText; }, 1000);
});

copyMorseBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(morseInput.value);
    const origText = copyMorseBtn.innerHTML;
    copyMorseBtn.innerHTML = 'Copied!';
    setTimeout(() => { copyMorseBtn.innerHTML = origText; }, 1000);
});

// Hear Morse Code trigger listener
if (listenMorseBtn) {
    listenMorseBtn.addEventListener('click', playMorseSound);
}

// Insert utilities
insertDotBtn.addEventListener('click', () => {
    morseInput.value += '.';
    plainInput.value = translateMorseToText(morseInput.value);
    updateStats();
});

insertDashBtn.addEventListener('click', () => {
    morseInput.value += '-';
    plainInput.value = translateMorseToText(morseInput.value);
    updateStats();
});

// Presets Loading
sampleSelect.addEventListener('change', () => {
    const val = sampleSelect.value;
    if (PRESETS[val]) {
        plainInput.value = PRESETS[val].plain;
        morseInput.value = PRESETS[val].morse;
        updateStats();
        stopMorseSound();
    }
});

// Keyer Activator Toggle
keyerToggle.addEventListener('change', () => {
    keyerActive = keyerToggle.checked;
    if (keyerActive) {
        keyerStatusPulse.className = "status-pulse green";
        keyerStatusText.textContent = "KEYER: IDLE";
    } else {
        keyerStatusPulse.className = "status-pulse";
        keyerStatusText.textContent = "KEYER: INACTIVE";
        clearTimeout(keyInactivityTimer);
        clearTimeout(keyWordSpacingTimer);
        keyBuffer = [];
        metricBuffer.textContent = '...';
    }
});

// Telegraph Station Mouse Handlers
telegraphKey.addEventListener('mousedown', handleKeyerDown);
telegraphKey.addEventListener('mouseup', handleKeyerUp);
telegraphKey.addEventListener('mouseleave', handleKeyerUp);

// Mobile Touch Handlers for keyer
telegraphKey.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleKeyerDown();
});
telegraphKey.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleKeyerUp();
});

// Spacebar, Dot (dit), and Dash (dah) Keyboard Listeners
window.addEventListener('keydown', (e) => {
    // Bypass if typing in text inputs or focusable input/select fields
    if (e.target === plainInput || e.target === morseInput || e.target === sampleSelect || e.target === speedSlider || e.target === pitchSlider || e.target === staticSlider) {
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        handleKeyerDown(e);
    } else if (e.key === '.' || e.code === 'Period' || e.code === 'NumpadDecimal') {
        if (e.repeat) return;
        e.preventDefault();
        triggerManualSymbol('.');
    } else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        if (e.repeat) return;
        e.preventDefault();
        triggerManualSymbol('-');
    }
});

window.addEventListener('keyup', (e) => {
    if (e.target === plainInput || e.target === morseInput || e.target === sampleSelect || e.target === speedSlider || e.target === pitchSlider || e.target === staticSlider) {
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        handleKeyerUp(e);
    }
});

// Waveform Selector Click Handler
document.querySelectorAll('.waveform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.waveform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedWaveform = btn.dataset.wave;

        if (liveOscillator) {
            liveOscillator.type = selectedWaveform;
        }

        // Real-time waveform adjustment during active playbacks
        activeOscillators.forEach(osc => {
            try {
                osc.type = selectedWaveform;
            } catch(e) {}
        });
    });
});

// Atmospheric Static Slider Handler
if (staticSlider) {
    staticSlider.addEventListener('input', updateStaticVolume);
}

// Tutoring Station Engine
if (tutorToggleBtn) {
    tutorToggleBtn.addEventListener('click', () => {
        if (tutorActive) {
            stopTutorMode();
        } else {
            startTutorMode();
        }
    });
}

function startTutorMode() {
    tutorActive = true;
    tutorToggleBtn.textContent = 'Exit Practice';
    tutorToggleBtn.classList.remove('btn-secondary');
    tutorToggleBtn.classList.add('btn-danger');

    tutorBodyArea.style.display = 'flex';

    // Clear translation fields for training clarity
    plainInput.value = '';
    morseInput.value = '';
    updateStats();

    startNextTutorWord();
}

function stopTutorMode() {
    tutorActive = false;
    tutorToggleBtn.textContent = 'Start Practice';
    tutorToggleBtn.classList.remove('btn-danger');
    tutorToggleBtn.classList.add('btn-secondary');

    tutorBodyArea.style.display = 'none';
}

function startNextTutorWord() {
    if (!tutorActive) return;

    let word = tutorWordsList[Math.floor(Math.random() * tutorWordsList.length)];
    while (word === tutorCurrentWord && tutorWordsList.length > 1) {
        word = tutorWordsList[Math.floor(Math.random() * tutorWordsList.length)];
    }

    tutorCurrentWord = word;
    tutorLetterIndex = 0;
    tutorProgressFill.style.width = '0%';
    tutorProgressFill.style.background = 'var(--gradient-accent)';
    tutorFeedbackText.textContent = 'Tap the letters using the manual telegraph key!';
    tutorFeedbackText.style.color = 'var(--text-secondary)';

    tutorWordDisplay.innerHTML = '';
    tutorLetterElements = [];

    for (let i = 0; i < tutorCurrentWord.length; i++) {
        const span = document.createElement('span');
        span.className = i === 0 ? 'tutor-letter active' : 'tutor-letter';
        span.textContent = tutorCurrentWord[i];
        tutorWordDisplay.appendChild(span);
        tutorLetterElements.push(span);
    }

    updateTutorGuide();
}

function updateTutorGuide() {
    if (tutorLetterIndex < tutorCurrentWord.length) {
        const letter = tutorCurrentWord[tutorLetterIndex];
        const morse = MORSE_DICTIONARY[letter];
        tutorGuideCode.textContent = `"${letter}" = ${morse}`;
    } else {
        tutorGuideCode.textContent = 'Done!';
    }
}

function handleTutorTap(morseChar, plainChar) {
    if (!tutorActive) return;

    const expectedLetter = tutorCurrentWord[tutorLetterIndex];
    const expectedMorse = MORSE_DICTIONARY[expectedLetter];
    const currentSpan = tutorLetterElements[tutorLetterIndex];

    if (plainChar === expectedLetter) {
        currentSpan.className = 'tutor-letter correct';
        tutorFeedbackText.textContent = `Correct! You tapped "${plainChar}" (${morseChar})`;
        tutorFeedbackText.style.color = '#2ed573';

        tutorLetterIndex++;

        const progressPct = (tutorLetterIndex / tutorCurrentWord.length) * 100;
        tutorProgressFill.style.width = `${progressPct}%`;

        if (tutorLetterIndex < tutorCurrentWord.length) {
            tutorLetterElements[tutorLetterIndex].className = 'tutor-letter active';
            updateTutorGuide();
        } else {
            tutorFeedbackText.textContent = `Excellent! Word completed successfully!`;
            tutorFeedbackText.style.color = 'var(--cyan-neon)';
            tutorProgressFill.style.background = 'linear-gradient(90deg, #2ed573, #00f2fe)';

            setTimeout(() => {
                if (tutorActive) {
                    startNextTutorWord();
                }
            }, 1500);
        }
    } else {
        currentSpan.className = 'tutor-letter incorrect';
        tutorFeedbackText.textContent = `Incorrect! Tapped "${plainChar || '?'}" (${morseChar}), expected "${expectedLetter}" (${expectedMorse})`;
        tutorFeedbackText.style.color = 'var(--danger-color)';

        const tempIndex = tutorLetterIndex;
        setTimeout(() => {
            if (tutorActive && tutorLetterIndex === tempIndex) {
                currentSpan.className = 'tutor-letter active';
            }
        }, 1000);
    }
}

// 8. ON INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    renderDictionary();
    updateStats();

    plainInput.value = "HELLO WORLD";
    morseInput.value = translateTextToMorse("HELLO WORLD");
    updateStats();
});
