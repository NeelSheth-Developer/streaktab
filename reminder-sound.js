/**
 * StreakTab - Reminder sound (newtab page)
 * Plays sound when message received from background.
 */
(function () {
  const FALLBACK_URL = chrome.runtime.getURL('sounds/mixkit-battleship-alarm-1001.wav');
  const STORAGE_KEY = 'streaktab_reminder_sound';

  let currentAudio = null;

  function stopSound() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_) {}
      currentAudio = null;
    }
  }

  function playFallback() {
    try {
      currentAudio = new Audio(FALLBACK_URL);
      currentAudio.loop = true;
      currentAudio.volume = 0.8;
      currentAudio.play()
        .then(() => {}) // wait for STOP message
        .catch(() => {});
    } catch (_) {}
  }

  async function playReminderSound() {
    stopSound();
    const { [STORAGE_KEY]: soundData } = await chrome.storage.local.get(STORAGE_KEY);
    if (soundData) {
      try {
        currentAudio = new Audio(soundData);
        currentAudio.loop = true;
        currentAudio.volume = 0.8;
        currentAudio.play()
          .then(() => {}) // wait for STOP message
          .catch(() => playFallback());
      } catch (_) {
        playFallback();
      }
    } else {
      playFallback();
    }
  }

  let lastHandledAt = 0;
  const DEDUPE_MS = 2000;

  function handlePlayReminder(msg) {
    const now = Date.now();
    if (now - lastHandledAt < DEDUPE_MS) return;
    lastHandledAt = now;

    playReminderSound();
  }

  const port = chrome.runtime.connect({ name: 'streaktab-sound' });
  port.onMessage.addListener((msg) => {
    if (msg.type === 'PLAY_REMINDER_SOUND') {
      handlePlayReminder(msg);
    } else if (msg.type === 'STOP_REMINDER_SOUND') {
      stopSound();
    }
  });
  port.onDisconnect.addListener(() => {});

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PLAY_REMINDER_SOUND') {
      handlePlayReminder(msg);
    } else if (msg.type === 'STOP_REMINDER_SOUND') {
      stopSound();
    }
  });
})();
