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

let sendAudio = null;
let receiveAudio = null;

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
        console.error('[Message Sounds] Failed to load settings:', error);
    }

    return { ...defaultSettings };
}

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}

function createAudioFiles() {
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
}

function playSound(audio) {
    if (!audio || !settings.enabled) {
        return;
    }

    try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = settings.volume;

        const promise = audio.play();

        if (promise instanceof Promise) {
            promise.catch(error => {
                console.warn(
                    '[Message Sounds] Audio playback blocked:',
                    error
                );
            });
        }
    } catch (error) {
        console.error(
            '[Message Sounds] Failed to play sound:',
            error
        );
    }
}

function handleMessageSent() {
    if (!settings.sendEnabled) {
        return;
    }

    playSound(sendAudio);
}

function handleMessageReceived() {
    if (!settings.receiveEnabled) {
        return;
    }

    playSound(receiveAudio);
}

function createSettingsUI() {
    const container = document.createElement('div');

    container.id = 'messagesounds-settings';

    container.innerHTML = `
        <div class="messagesounds-title">
            🔊 Message Sounds
        </div>

        <div class="messagesounds-option">
            <label>
                <input
                    type="checkbox"
                    id="messagesounds-enabled"
                    ${settings.enabled ? 'checked' : ''}
                >
                Activer les sons
            </label>
        </div>

        <div class="messagesounds-option">
            <label>
                <input
                    type="checkbox"
                    id="messagesounds-send"
                    ${settings.sendEnabled ? 'checked' : ''}
                >
                📤 Son à l'envoi
            </label>
        </div>

        <div class="messagesounds-option">
            <label>
                <input
                    type="checkbox"
                    id="messagesounds-receive"
                    ${settings.receiveEnabled ? 'checked' : ''}
                >
                📥 Son à la réponse du bot
            </label>
        </div>

        <div class="messagesounds-volume">
            <label for="messagesounds-volume">
                🔉 Volume
            </label>

            <input
                type="range"
                id="messagesounds-volume"
                min="0"
                max="100"
                value="${Math.round(settings.volume * 100)}"
            >

            <span id="messagesounds-volume-value">
                ${Math.round(settings.volume * 100)}%
            </span>
        </div>
    `;

    const extensionPanel =
        document.querySelector('#extensions_settings');

    if (!extensionPanel) {
        return;
    }

    extensionPanel.appendChild(container);

    const enabled =
        document.querySelector('#messagesounds-enabled');

    const send =
        document.querySelector('#messagesounds-send');

    const receive =
        document.querySelector('#messagesounds-receive');

    const volume =
        document.querySelector('#messagesounds-volume');

    const volumeValue =
        document.querySelector('#messagesounds-volume-value');

    enabled?.addEventListener('change', event => {
        settings.enabled = event.target.checked;
        saveSettings();
    });

    send?.addEventListener('change', event => {
        settings.sendEnabled = event.target.checked;
        saveSettings();
    });

    receive?.addEventListener('change', event => {
        settings.receiveEnabled = event.target.checked;
        saveSettings();
    });

    volume?.addEventListener('input', event => {
        settings.volume =
            Number(event.target.value) / 100;

        volumeValue.textContent =
            `${event.target.value}%`;

        if (sendAudio) {
            sendAudio.volume = settings.volume;
        }

        if (receiveAudio) {
            receiveAudio.volume = settings.volume;
        }

        saveSettings();
    });
}

function init() {
    console.log('[Message Sounds] Initializing...');

    createAudioFiles();

    eventSource.on(
        event_types.MESSAGE_SENT,
        handleMessageSent
    );

    eventSource.on(
        event_types.MESSAGE_RECEIVED,
        handleMessageReceived
    );

    createSettingsUI();

    console.log('[Message Sounds] Ready!');
}

if (
    typeof eventSource !== 'undefined' &&
    typeof event_types !== 'undefined'
) {
    init();
}