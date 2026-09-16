import { eventSource, event_types } from '../../../../script.js';

const MODULE_NAME = 'messagesounds';
const SETTINGS_KEY = `${MODULE_NAME}_settings`;

const defaultSettings = {
    enabled: true,
    sendEnabled: true,
    receiveEnabled: true,
    volume: 0.7
};

let settings = loadSettings();

let audioContext = null;
let sendBuffer = null;
let receiveBuffer = null;
let loadingPromise = null;

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);

        if (saved) {
            return {
                ...defaultSettings,
                ...JSON.parse(saved)
            };
        }
    } catch (error) {
        console.error(
            '[Message Sounds] Settings error:',
            error
        );
    }

    return { ...defaultSettings };
}

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}

/*
 * Création du contexte audio.
 *
 * Contrairement à new Audio(), on n'utilise
 * aucun lecteur média HTML.
 */
function getAudioContext() {
    if (audioContext) {
        return audioContext;
    }

    const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContext) {
        console.warn(
            '[Message Sounds] Web Audio API unavailable.'
        );

        return null;
    }

    try {
        audioContext = new AudioContext();

        return audioContext;
    } catch (error) {
        console.error(
            '[Message Sounds] Failed to create audio context:',
            error
        );

        return null;
    }
}

/*
 * Charge un MP3 dans un AudioBuffer.
 */
async function loadSound(filename) {
    const context = getAudioContext();

    if (!context) {
        return null;
    }

    try {
        const url = new URL(
            filename,
            import.meta.url
        ).href;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const arrayBuffer =
            await response.arrayBuffer();

        return await context.decodeAudioData(
            arrayBuffer
        );
    } catch (error) {
        console.error(
            `[Message Sounds] Failed to load ${filename}:`,
            error
        );

        return null;
    }
}

/*
 * Précharge les deux sons.
 */
async function loadSounds() {
    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        sendBuffer =
            await loadSound('send.mp3');

        receiveBuffer =
            await loadSound('receive.mp3');

        console.log(
            '[Message Sounds] Sounds loaded.'
        );
    })();

    return loadingPromise;
}

/*
 * Réactive uniquement le contexte audio.
 *
 * IMPORTANT :
 * aucun son n'est joué ici.
 * On ne fait donc plus le ancien :
 *
 * audio.play()
 * audio.pause()
 *
 * qui pouvait provoquer des problèmes avec
 * la musique en cours.
 */
async function resumeAudio() {
    const context = getAudioContext();

    if (!context) {
        return;
    }

    try {
        if (context.state === 'suspended') {
            await context.resume();
        }
    } catch (error) {
        console.debug(
            '[Message Sounds] Audio resume skipped:',
            error
        );
    }
}

/*
 * Joue un AudioBuffer sans créer de lecteur <audio>.
 */
async function playSound(buffer) {
    if (!buffer || !settings.enabled) {
        return;
    }

    const context = getAudioContext();

    if (!context) {
        return;
    }

    try {
        await resumeAudio();

        const source =
            context.createBufferSource();

        const gain =
            context.createGain();

        source.buffer = buffer;

        gain.gain.value =
            settings.volume;

        source.connect(gain);
        gain.connect(context.destination);

        source.start(0);

        source.onended = () => {
            try {
                source.disconnect();
                gain.disconnect();
            } catch {
                // Rien à faire
            }
        };
    } catch (error) {
        console.warn(
            '[Message Sounds] Playback error:',
            error
        );
    }
}

async function playSendSound() {
    if (!settings.sendEnabled) {
        return;
    }

    await loadSounds();

    playSound(sendBuffer);
}

async function playReceiveSound() {
    if (!settings.receiveEnabled) {
        return;
    }

    await loadSounds();

    playSound(receiveBuffer);
}

/*
 * Prépare l'audio après la première interaction
 * sans jouer de son.
 */
function setupAudioUnlock() {
    const unlock = async () => {
        await resumeAudio();
        loadSounds();
    };

    document.addEventListener(
        'pointerdown',
        unlock,
        {
            once: true,
            capture: true,
            passive: true
        }
    );

    document.addEventListener(
        'keydown',
        unlock,
        {
            once: true,
            capture: true,
            passive: true
        }
    );

    document.addEventListener(
        'touchstart',
        unlock,
        {
            once: true,
            capture: true,
            passive: true
        }
    );
}

function createSettingsUI() {
    const extensionPanel =
        document.querySelector(
            '#extensions_settings'
        );

    if (!extensionPanel) {
        return;
    }

    if (
        document.querySelector(
            '#messagesounds-settings'
        )
    ) {
        return;
    }

    const container =
        document.createElement('div');

    container.id =
        'messagesounds-settings';

    container.innerHTML = `
        <div class="messagesounds-title">
            🔊 Message Sounds
        </div>

        <label class="messagesounds-option">
            <input
                type="checkbox"
                id="messagesounds-enabled"
                ${settings.enabled ? 'checked' : ''}
            >
            <span>Activer les sons</span>
        </label>

        <label class="messagesounds-option">
            <input
                type="checkbox"
                id="messagesounds-send"
                ${settings.sendEnabled ? 'checked' : ''}
            >
            <span>📤 Son à l'envoi</span>
        </label>

        <label class="messagesounds-option">
            <input
                type="checkbox"
                id="messagesounds-receive"
                ${settings.receiveEnabled ? 'checked' : ''}
            >
            <span>📥 Son à la réponse du bot</span>
        </label>

        <div class="messagesounds-volume">
            <div class="messagesounds-volume-label">
                🔉 Volume
                <span id="messagesounds-volume-value">
                    ${Math.round(settings.volume * 100)}%
                </span>
            </div>

            <input
                type="range"
                id="messagesounds-volume"
                min="0"
                max="100"
                value="${Math.round(settings.volume * 100)}"
            >
        </div>

        <button
            id="messagesounds-test"
            class="menu_button"
        >
            🔊 Tester les sons
        </button>
    `;

    extensionPanel.appendChild(container);

    const enabled =
        document.querySelector(
            '#messagesounds-enabled'
        );

    const send =
        document.querySelector(
            '#messagesounds-send'
        );

    const receive =
        document.querySelector(
            '#messagesounds-receive'
        );

    const volume =
        document.querySelector(
            '#messagesounds-volume'
        );

    const volumeValue =
        document.querySelector(
            '#messagesounds-volume-value'
        );

    const test =
        document.querySelector(
            '#messagesounds-test'
        );

    enabled?.addEventListener(
        'change',
        event => {
            settings.enabled =
                event.target.checked;

            saveSettings();
        }
    );

    send?.addEventListener(
        'change',
        event => {
            settings.sendEnabled =
                event.target.checked;

            saveSettings();
        }
    );

    receive?.addEventListener(
        'change',
        event => {
            settings.receiveEnabled =
                event.target.checked;

            saveSettings();
        }
    );

    volume?.addEventListener(
        'input',
        event => {
            settings.volume =
                Number(event.target.value) / 100;

            volumeValue.textContent =
                `${event.target.value}%`;

            saveSettings();
        }
    );

    test?.addEventListener(
        'click',
        async () => {
            await resumeAudio();
            await loadSounds();

            playSound(sendBuffer);

            setTimeout(() => {
                playSound(receiveBuffer);
            }, 500);
        }
    );
}

function init() {
    console.log(
        '[Message Sounds] Initializing...'
    );

    setupAudioUnlock();

    eventSource.on(
        event_types.MESSAGE_SENT,
        playSendSound
    );

    eventSource.on(
        event_types.MESSAGE_RECEIVED,
        playReceiveSound
    );

    createSettingsUI();

    console.log(
        '[Message Sounds] Ready!'
    );
}

init();
