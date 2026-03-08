/**
 * StreakTab - Background Service Worker
 * Handles alarms and notifications for reminders
 */

const REMINDER_PREFIX = 'reminder_';
const QUOTE_API = 'https://type.fit/api/quotes';

const LOG = (msg, ...args) => console.log('[StreakTab]', msg, ...args);
const LOG_ERR = (msg, err) => console.error('[StreakTab]', msg, err?.message ?? err);

LOG('Service worker loaded');

let offscreenPort = null;
let newtabSoundPort = null;

// Accept connections to wake service worker when idle (MV3 workers sleep)
chrome.runtime.onConnect.addListener((port) => {
  LOG('SW woke: port connected', port.name);
  if (port.name === 'streaktab-offscreen') {
    offscreenPort = port;
    port.onDisconnect.addListener(() => { offscreenPort = null; });
  } else if (port.name === 'streaktab-sound') {
    newtabSoundPort = port;
    port.onDisconnect.addListener(() => { newtabSoundPort = null; });
  }
});

function stopReminderSound(stopPayload) {
  if (newtabSoundPort) {
    try { newtabSoundPort.postMessage(stopPayload); } catch (_) {}
  }
  if (offscreenPort) {
    try { offscreenPort.postMessage(stopPayload); } catch (_) {}
  }
  // Always broadcast via sendMessage so offscreen/newtab get STOP even if port refs are stale
  chrome.runtime.sendMessage(stopPayload).catch(() => {});
}

let currentReminderNotifId = null;
let currentReminderListeners = null;

function clearCurrentReminder() {
  if (currentReminderNotifId) {
    try {
      chrome.notifications.clear(currentReminderNotifId);
    } catch (_) {}
    currentReminderNotifId = null;
  }
  if (currentReminderListeners) {
    chrome.notifications.onClicked.removeListener(currentReminderListeners.onClick);
    chrome.notifications.onClosed.removeListener(currentReminderListeners.onClosed);
    currentReminderListeners = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  LOG('Message received:', msg?.type);
  if (msg.type === 'REMINDER_POPUP_DISMISSED' || msg.type === 'STOP_REMINDER_SOUND') {
    stopReminderSound({ type: 'STOP_REMINDER_SOUND' });
    clearCurrentReminder();
    return;
  }
  if (msg.type === 'GET_QUOTE') {
    fetch(QUOTE_API)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const withAuthor = data.filter((x) => x && x.text && x.author && x.author !== 'null' && !/^unknown$/i.test(x.author));
          const pool = withAuthor.length > 0 ? withAuthor : data;
          const q = pool[Math.floor(Math.random() * pool.length)];
          const author = q && q.author && q.author !== 'null' && !/^unknown$/i.test(q.author) ? q.author : null;
          sendResponse(q && q.text && author ? { content: q.text, author } : null);
        } else {
          sendResponse(null);
        }
      })
      .catch(() => sendResponse(null));
    return true;
  }
});

/**
 * Play sound via offscreen document. Closes any existing offscreen doc,
 * creates a fresh one, waits for port connection, then sends the payload.
 */
async function playSoundViaOffscreen(payload) {
  LOG('playSoundViaOffscreen: creating offscreen doc');
  offscreenPort = null;
  try {
    if (await chrome.offscreen.hasDocument()) {
      await chrome.offscreen.closeDocument();
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch (e) {
    LOG_ERR('closeDocument failed:', e);
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play reminder notification sound'
    });
  } catch (e) {
    LOG_ERR('createDocument failed:', e);
    return;
  }

  const portPromise = waitForOffscreenPort(3000);
  await new Promise((r) => setTimeout(r, 300));
  const hasPort = await portPromise;
  if (!hasPort) await new Promise((r) => setTimeout(r, 400));

  if (offscreenPort) {
    offscreenPort.postMessage(payload);
    LOG('Posted to offscreenPort');
  } else {
    LOG('offscreenPort not connected, sendMessage broadcast');
    chrome.runtime.sendMessage(payload).catch(() => {});
  }
}

function waitForOffscreenPort(maxMs = 3000) {
  return new Promise((resolve) => {
    if (offscreenPort) {
      resolve(true);
      return;
    }
    const timeout = setTimeout(() => resolve(false), maxMs);
    const check = () => {
      if (offscreenPort) {
        clearTimeout(timeout);
        resolve(true);
        return true;
      }
      return false;
    };
    const id = setInterval(() => {
      if (check()) clearInterval(id);
    }, 50);
  });
}

function scheduleReminderAlarm(reminder) {
  const [y, m, d] = (reminder.date || '').split('-').map(Number);
  const [h, min] = (reminder.time || '00:00').split(':').map(Number);
  const when = new Date(y, m - 1, d, h, min, 0).getTime();
  if (when > Date.now()) {
    chrome.alarms.create(REMINDER_PREFIX + reminder.id, { when });
  }
}

async function rescheduleAllReminders() {
  const { streaktab_reminders: list = [] } = await chrome.storage.local.get('streaktab_reminders');
  const now = Date.now();
  for (const r of list) {
    if (r.triggered) continue;
    const [y, m, d] = (r.date || '').split('-').map(Number);
    const [h, min] = (r.time || '00:00').split(':').map(Number);
    const when = new Date(y, m - 1, d, h, min, 0).getTime();
    if (when > now) {
      chrome.alarms.create(REMINDER_PREFIX + r.id, { when });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  rescheduleAllReminders();
});
chrome.runtime.onStartup.addListener(() => {
  rescheduleAllReminders();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  LOG('Alarm fired:', alarm.name);

  if (!alarm.name.startsWith(REMINDER_PREFIX)) return;
  const id = alarm.name.slice(REMINDER_PREFIX.length);
  const { streaktab_reminders: list = [] } = await chrome.storage.local.get('streaktab_reminders');
  const r = list.find((x) => x.id === id);
  if (!r) {
    LOG('Reminder not found, id:', id);
    return;
  }

  const reminderText = r.text || 'Reminder';
  LOG('Reminder text:', reminderText);

  // 1. Mark reminder as triggered (keep in list, don't remove); soundStopped: false until user stops
  const updated = list.map((x) =>
    x.id === id ? { ...x, triggered: true, triggeredAt: Date.now(), soundStopped: false } : x
  );
  await chrome.storage.local.set({ streaktab_reminders: updated });
  chrome.runtime.sendMessage({ type: 'REMINDER_TRIGGERED' }).catch(() => {});

  // 2. Show notification
  const notifOpts = {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/streaktab_icon.png'),
    title: '🔔 StreakTab Reminder',
    message: r.text ? `${r.text} 💪` : 'Reminder',
    priority: 2,
    requireInteraction: true,
    silent: false
  };
  let notifId = null;
  try {
    notifId = await chrome.notifications.create(notifOpts);
    LOG('Notification created:', notifId);
  } catch (e) {
    LOG_ERR('Notification failed (retrying with fallback icon):', e);
    try {
      notifOpts.iconUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      notifId = await chrome.notifications.create(notifOpts);
      LOG('Notification created with fallback icon:', notifId);
    } catch (e2) {
      LOG_ERR('Notification fallback failed:', e2);
    }
  }

  currentReminderNotifId = notifId;

  // 3. Play sound
  const fallbackUrl = chrome.runtime.getURL('sounds/mixkit-battleship-alarm-1001.wav');
  const { streaktab_reminder_sound: soundData } = await chrome.storage.local.get('streaktab_reminder_sound');
  const payload = { type: 'PLAY_REMINDER_SOUND', soundData: soundData || null, fallbackUrl };
  const stopPayload = { type: 'STOP_REMINDER_SOUND' };

  LOG('Sound: newtabSoundPort=', !!newtabSoundPort);

  try {
    if (newtabSoundPort) {
      try {
        newtabSoundPort.postMessage(payload);
        LOG('Posted to newtabSoundPort');
      } catch (e) {
        LOG_ERR('postMessage to newtabSoundPort failed:', e);
        await playSoundViaOffscreen(payload);
      }
    } else {
      LOG('Using offscreen for sound');
      await playSoundViaOffscreen(payload);
    }
  } catch (e) {
    LOG_ERR('Sound playback failed:', e);
  }

  function doStopReminderSound() {
    stopReminderSound(stopPayload);
    clearCurrentReminder();
  }

  const onClick = (nid) => {
    if (nid === notifId) doStopReminderSound();
  };
  const onClosed = (nid) => {
    if (nid === notifId) doStopReminderSound();
  };
  currentReminderListeners = { onClick, onClosed };
  chrome.notifications.onClicked.addListener(onClick);
  chrome.notifications.onClosed.addListener(onClosed);
});
