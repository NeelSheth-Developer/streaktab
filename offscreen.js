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

function playFallback(fallbackUrl) {
  const url = fallbackUrl || chrome.runtime.getURL('sounds/mixkit-battleship-alarm-1001.wav');
  try {
    currentAudio = new Audio(url);
    currentAudio.loop = true;
    currentAudio.volume = 0.8;
    currentAudio.play()
      .then(() => {}) // wait for STOP message
      .catch(() => {});
  } catch (_) {}
}

const port = chrome.runtime.connect({ name: 'streaktab-offscreen' });

port.onMessage.addListener((msg) => {
  if (msg.type === 'PLAY_REMINDER_SOUND') {
    stopSound();
    const soundData = msg.soundData;
    const fallbackUrl = msg.fallbackUrl;
    if (soundData) {
      try {
        currentAudio = new Audio(soundData);
        currentAudio.loop = true;
        currentAudio.volume = 0.8;
        currentAudio.play()
          .then(() => {}) // wait for STOP message
          .catch(() => playFallback(fallbackUrl));
      } catch (_) {
        playFallback(fallbackUrl);
      }
    } else {
      playFallback(fallbackUrl);
    }
  } else if (msg.type === 'STOP_REMINDER_SOUND') {
    stopSound();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PLAY_REMINDER_SOUND') {
    stopSound();
    const soundData = msg.soundData;
    const fallbackUrl = msg.fallbackUrl;
    if (soundData) {
      try {
        currentAudio = new Audio(soundData);
        currentAudio.loop = true;
        currentAudio.volume = 0.8;
        currentAudio.play()
          .then(() => {
            sendResponse({ ok: true });
          })
          .catch(() => { playFallback(fallbackUrl); sendResponse({ ok: true }); });
      } catch (e) {
        playFallback(fallbackUrl);
        sendResponse({ ok: true });
      }
    } else {
      playFallback(fallbackUrl);
      sendResponse({ ok: true });
    }
    return true;
  }
  if (msg.type === 'STOP_REMINDER_SOUND') {
    stopSound();
    sendResponse({ ok: true });
    return true;
  }
});
