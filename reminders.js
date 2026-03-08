/**
 * StreakTab - Reminders
 */

(() => {
  const KEY = 'streaktab_reminders';
  const PREFIX = 'reminder_';

  let reminders = [];
  let editingReminderId = null;

  const $ = (id) => document.getElementById(id);

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
  }


  async function loadReminders() {
    await syncFromStorage();
    const now = Date.now();
    for (const r of reminders) {
      if (r.triggered) continue;
      const [y, m, d] = (r.date || '').split('-').map(Number);
      const [h, min] = (r.time || '00:00').split(':').map(Number);
      const when = new Date(y, m - 1, d, h, min, 0).getTime();
      if (when > now) chrome.alarms.create(PREFIX + r.id, { when });
    }
  }

  async function saveReminders(deleteId = null) {
    // Always use storage as source of truth - never drop triggered reminders
    const { [KEY]: stored } = await chrome.storage.local.get(KEY);
    let toSave = Array.isArray(stored) ? [...stored] : [];

    if (deleteId) {
      toSave = toSave.filter((r) => r.id !== deleteId);
    }

    const byId = new Map(toSave.map((r) => [r.id, r]));
    for (const r of reminders) {
      const existing = byId.get(r.id);
      if (existing?.triggered) {
        byId.set(r.id, { ...r, triggered: true, triggeredAt: existing.triggeredAt, soundStopped: r.soundStopped ?? existing.soundStopped });
      } else {
        byId.set(r.id, { ...r });
      }
    }
    // Ensure we never drop a triggered reminder that was in storage (e.g. if in-memory list was stale)
    if (Array.isArray(stored)) {
      for (const s of stored) {
        if (s.triggered && s.id !== deleteId && !byId.has(s.id)) {
          byId.set(s.id, { ...s });
        }
      }
    }

    toSave = Array.from(byId.values());
    reminders = toSave;
    await chrome.storage.local.set({ [KEY]: toSave });
  }

  function scheduleAlarm(r) {
    if (r.triggered) return;
    const [y, m, d] = (r.date || '').split('-').map(Number);
    const [h, min] = (r.time || '00:00').split(':').map(Number);
    const when = new Date(y, m - 1, d, h, min, 0).getTime();
    if (when > Date.now()) chrome.alarms.create(PREFIX + r.id, { when });
  }

  function setDefaultDateTime() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateEl = $('reminderDateInput');
    const timeEl = $('reminderTimeInput');
    if (dateEl) { dateEl.value = date; dateEl.min = date; }
    if (timeEl) timeEl.value = time;
  }

  function openCreateDialog() {
    editingReminderId = null;
    $('reminderDialogTitle').textContent = 'Create Reminder';
    $('reminderDialogSubmit').textContent = 'Create Reminder';
    $('reminderDialogOverlay').classList.add('visible');
    $('reminderTextInput').value = '';
    setDefaultDateTime();
    $('reminderTextInput').focus();
  }

  function openEditDialog(id) {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    editingReminderId = id;
    $('reminderDialogTitle').textContent = 'Edit Reminder';
    $('reminderDialogSubmit').textContent = 'Save Changes';
    $('reminderDialogOverlay').classList.add('visible');
    $('reminderTextInput').value = r.text || '';
    $('reminderDateInput').value = r.date || '';
    $('reminderDateInput').removeAttribute('min');
    $('reminderTimeInput').value = r.time || '09:00';
    $('reminderTextInput').focus();
  }

  function closeReminderDialog() {
    editingReminderId = null;
    $('reminderDialogOverlay').classList.remove('visible');
  }

  async function render() {
    await syncFromStorage();
    const sidebar = $('reminderSidebar');
    if (!sidebar?.classList.contains('open') || sidebar?.classList.contains('closed')) return;

    $('reminderPageMain')?.classList.remove('hidden');
    $('mainHome')?.classList.add('hidden');
    $('trackerPageMain')?.classList.add('hidden');

    // Retry sync once if empty (avoids showing "No reminders" when storage was just updated by background)
    if (reminders.length === 0) {
      await syncFromStorage();
    }
    const hasReminders = reminders.length > 0;
    $('reminderEmptyState')?.classList.toggle('hidden', hasReminders);
    $('reminderTableWrap')?.classList.toggle('hidden', !hasReminders);

    const tbody = $('reminderTableBody');
    if (tbody && hasReminders) {
      tbody.innerHTML = reminders.map((r) => {
        const triggered = !!r.triggered;
        const rowClass = triggered ? 'reminder-row-triggered' : '';
        if (triggered) {
          const soundOn = !r.soundStopped;
          const soundDisabled = !!r.soundStopped;
          return `
          <tr data-id="${r.id}" class="${rowClass}">
            <td class="reminder-cell-text">${escapeHtml(r.text)}</td>
            <td class="reminder-cell-date">${escapeHtml(r.date || '')}</td>
            <td class="reminder-cell-time">${escapeHtml(r.time || '')}</td>
            <td class="reminder-cell-actions">
              <label class="reminder-sound-toggle ${soundDisabled ? 'reminder-sound-disabled' : ''}">
                <input type="checkbox" class="reminder-sound-checkbox" data-id="${r.id}" ${soundOn ? 'checked' : ''} ${soundDisabled ? 'disabled' : ''}>
                <span class="reminder-sound-slider"></span>
              </label>
            </td>
          </tr>
        `;
        }
        return `
          <tr data-id="${r.id}" class="${rowClass}">
            <td class="reminder-cell-text">${escapeHtml(r.text)}</td>
            <td class="reminder-cell-date">${escapeHtml(r.date || '')}</td>
            <td class="reminder-cell-time">${escapeHtml(r.time || '')}</td>
            <td class="reminder-cell-actions">
              <button type="button" class="reminder-edit-btn" data-id="${r.id}">Edit</button>
              <button type="button" class="reminder-cancel-btn" data-id="${r.id}">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  async function setSoundStopped(id, stopped) {
    await syncFromStorage();
    const r = reminders.find((x) => x.id === id);
    if (!r || !r.triggered) return;
    r.soundStopped = !!stopped;
    await saveReminders();
    render();
    if (stopped) chrome.runtime.sendMessage({ type: 'STOP_REMINDER_SOUND' }).catch(() => {});
  }

  function closeSidebar(switchToHome = false) {
    $('reminderSidebar')?.classList.add('closed');
    $('reminderSidebar')?.classList.remove('open');
    $('sidebarOverlay')?.classList.remove('visible');
    if (switchToHome) {
      $('reminderPageMain')?.classList.add('hidden');
      $('mainHome')?.classList.remove('hidden');
    } else {
      // Keep reminder content visible, ensure home stays hidden
      $('reminderPageMain')?.classList.remove('hidden');
      $('mainHome')?.classList.add('hidden');
    }
  }

  async function syncFromStorage() {
    const { [KEY]: data } = await chrome.storage.local.get(KEY);
    reminders = Array.isArray(data) ? data : [];
  }

  async function openSidebar() {
    $('settingsPageMain')?.classList.add('hidden');
    $('fitnessSidebar')?.classList.add('closed');
    $('fitnessSidebar')?.classList.remove('open');
    $('notesSidebar')?.classList.add('closed');
    $('notesSidebar')?.classList.remove('open');
    $('notesPageMain')?.classList.add('hidden');
    $('notesSheetOverlay')?.classList.remove('visible');
    $('sidebarOverlay')?.classList.remove('visible');
    $('trackerSheetOverlay')?.classList.remove('visible');
    $('mainApp')?.classList.remove('tracker-sheet-open');
    document.dispatchEvent(new CustomEvent('streaktab:closeTrackerSheet'));
    $('reminderSidebar')?.classList.remove('closed');
    $('reminderSidebar')?.classList.add('open');
    await syncFromStorage();
    render();
  }

  async function deleteReminder(id) {
    chrome.alarms.clear(PREFIX + id);
    await syncFromStorage();
    reminders = reminders.filter((r) => r.id !== id);
    await saveReminders(id);
    render();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadReminders();

    $('reminderPageMain')?.addEventListener('click', (e) => {
      const edit = e.target.closest('.reminder-edit-btn');
      const cancel = e.target.closest('.reminder-cancel-btn');
      if (edit?.dataset?.id) openEditDialog(edit.dataset.id);
      else if (cancel?.dataset?.id) deleteReminder(cancel.dataset.id);
    });

    document.addEventListener('change', (e) => {
      const toggle = e.target.closest('.reminder-sound-checkbox');
      if (toggle?.dataset?.id && !toggle.disabled) setSoundStopped(toggle.dataset.id, !toggle.checked);
    });

    $('reminderToggle')?.addEventListener('click', () => {
      const s = $('reminderSidebar');
      (s?.classList.contains('open') && !s?.classList.contains('closed')) ? closeSidebar(false) : openSidebar();
    });

    $('reminderSidebarClose')?.addEventListener('click', () => closeSidebar(false));
    $('reminderCreateBtn')?.addEventListener('click', openCreateDialog);
    $('railBrand')?.addEventListener('click', (e) => { e.preventDefault(); closeSidebar(true); });
    $('railHomeBtn')?.addEventListener('click', () => closeSidebar(true));
    $('sidebarOverlay')?.addEventListener('click', () => {
      const s = $('reminderSidebar');
      if (s?.classList.contains('open') && !s?.classList.contains('closed')) closeSidebar(false);
    });

    $('reminderForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $('reminderTextInput').value.trim();
      const date = $('reminderDateInput').value;
      const time = $('reminderTimeInput').value;
      if (!text || !date || !time) return;
      await syncFromStorage();
      if (editingReminderId) {
        const r = reminders.find((x) => x.id === editingReminderId);
        if (r) {
          chrome.alarms.clear(PREFIX + r.id);
          Object.assign(r, { text, date, time, triggered: false });
          scheduleAlarm(r);
        }
      } else {
        const r = { id: uid(), text, date, time };
        reminders.push(r);
        scheduleAlarm(r);
      }
      await saveReminders();
      closeReminderDialog();
      render();
    });

    $('reminderDialogClose')?.addEventListener('click', closeReminderDialog);
    $('reminderDialogOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'reminderDialogOverlay') closeReminderDialog();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[KEY]) return;
      const newList = changes[KEY].newValue;
      if (Array.isArray(newList)) {
        reminders = newList;
      } else {
        // Re-fetch so triggered reminders etc. are never lost
        syncFromStorage().then(() => render());
        return;
      }
      render();
    });

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type === 'REMINDER_TRIGGERED') {
        // Delay so we read storage after background has finished writing (triggered row stays visible)
        setTimeout(async () => {
          await syncFromStorage();
          render();
        }, 100);
      }
    });

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await syncFromStorage();
        if ($('reminderSidebar')?.classList.contains('open') && !$('reminderSidebar')?.classList.contains('closed')) {
          render();
        }
      }
    });
  });
})();
