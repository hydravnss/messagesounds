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

let sendAudio;
let receiveAudio;
let audioUnlocked = false;

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
        console.error('[Message Sounds] Settings error:', error);
    }

    return { ...defaultSettings };
}

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}

function createAudio() {
    const basePath = new URL('.', import.meta.url);

    sendAudio = new Audio(
        new URL('send.mp3', basePath).href
    );

    receiveAudio = new Audio(
        new URL('receive.mp3', basePath).href
    );

    sendAudio.preload = 'auto';
    receiveAudio.preload = 'auto';

    sendAudio.volume = settings.volume;
    receiveAudio.volume = settings.volume;

    sendAudio.load();
    receiveAudio.load();
}

/*
 * Déverrouille l'audio après la première interaction
 * avec la page.
 */
function unlockAudio() {
    if (audioUnlocked) {
        return;
    }

    const audio = sendAudio;

    if (!audio) {
        return;
    }

    audio.muted = true;

    const promise = audio.play();

    if (promise) {
        promise
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;

                audioUnlocked = true;

                console.log(
                    '[Message Sounds] Audio unlocked'
                );
            })
            .catch(() => {
                audio.muted = false;
            });
    }
}

function playSound(audio) {
    if (!audio || !settings.enabled) {
        return;
    }

    audio.volume = settings.volume;
    audio.currentTime = 0;

    const promise = audio.play();

    if (promise) {
        promise.catch(error => {
            console.warn(
                '[Message Sounds] Playback blocked:',
                error
            );
        });
    }
}

function playSendSound() {
    if (!settings.sendEnabled) {
        return;
    }

    playSound(sendAudio);
}

function playReceiveSound() {
    if (!settings.receiveEnabled) {
        return;
    }

    playSound(receiveAudio);
}

/*
 * Première interaction utilisateur :
 * permet au navigateur d'autoriser ensuite
 * les sons déclenchés par SillyTavern.
 */
function setupAudioUnlock() {
    document.addEventListener(
        'click',
        unlockAudio,
        {
            once: true,
            capture: true
        }
    );

    document.addEventListener(
        'touchstart',
        unlockAudio,
        {
            once: true,
            capture: true
        }
    );

    document.addEventListener(
        'keydown',
        unlockAudio,
        {
            once: true,
            capture: true
        }
    );
}

function createSettingsUI() {
    const extensionPanel =
        document.querySelector('#extensions_settings');

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

    container.id = 'messagesounds-settings';

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

    enabled.addEventListener('change', event => {
        settings.enabled =
            event.target.checked;

        saveSettings();
    });

    send.addEventListener('change', event => {
        settings.sendEnabled =
            event.target.checked;

        saveSettings();
    });

    receive.addEventListener('change', event => {
        settings.receiveEnabled =
            event.target.checked;

        saveSettings();
    });

    volume.addEventListener('input', event => {
        settings.volume =
            Number(event.target.value) / 100;

        volumeValue.textContent =
            `${event.target.value}%`;

        if (sendAudio) {
            sendAudio.volume =
                settings.volume;
        }

        if (receiveAudio) {
            receiveAudio.volume =
                settings.volume;
        }

        saveSettings();
    });

    test.addEventListener('click', () => {
        audioUnlocked = true;

        playSound(sendAudio);

        setTimeout(() => {
            playSound(receiveAudio);
        }, 500);
    });
}

function init() {
    console.log(
        '[Message Sounds] Initializing...'
    );

    createAudio();

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
