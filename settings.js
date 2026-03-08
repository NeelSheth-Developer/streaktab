/**
 * StreakTab - Settings Tab
 * Rail settings: custom reminder sound (.mp4 / .wav) in main content area
 */

(() => {
  const STORAGE_KEY = 'streaktab_reminder_sound';
  const FILENAME_KEY = 'streaktab_reminder_sound_filename';

  let previewAudio = null;

  function showFilename(name) {
    const previewEl = document.getElementById('reminderSoundPreview');
    const filenameEl = document.getElementById('reminderSoundFilename');
    const chooseBtn = document.getElementById('chooseReminderSoundBtn');
    if (previewEl) {
      previewEl.classList.toggle('hidden', !name);
    }
    if (filenameEl) {
      filenameEl.textContent = name || '';
    }
    if (chooseBtn) {
      chooseBtn.disabled = !!name;
      chooseBtn.title = name ? 'Clear current sound to upload a different one' : 'Choose file';
    }
  }

  async function loadSoundStatus() {
    const { [STORAGE_KEY]: data, [FILENAME_KEY]: filename } = await chrome.storage.local.get([STORAGE_KEY, FILENAME_KEY]);
    showFilename(data ? (filename || 'Custom sound') : '');
  }

  function hideSettingsTab() {
    document.getElementById('settingsPageMain')?.classList.add('hidden');
    document.getElementById('mainHome')?.classList.remove('hidden');
  }

  function showSettingsTab() {
    document.getElementById('fitnessSidebar')?.classList.add('closed');
    document.getElementById('fitnessSidebar')?.classList.remove('open');
    document.getElementById('reminderSidebar')?.classList.add('closed');
    document.getElementById('reminderSidebar')?.classList.remove('open');
    document.getElementById('reminderPageMain')?.classList.add('hidden');
    document.getElementById('notesSidebar')?.classList.add('closed');
    document.getElementById('notesSidebar')?.classList.remove('open');
    document.getElementById('notesPageMain')?.classList.add('hidden');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
    document.getElementById('mainHome')?.classList.add('hidden');
    document.getElementById('settingsPageMain')?.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadSoundStatus();

    document.getElementById('settingsToggle')?.addEventListener('click', () => {
      const page = document.getElementById('settingsPageMain');
      const isVisible = page && !page.classList.contains('hidden');
      if (isVisible) {
        hideSettingsTab();
      } else {
        showSettingsTab();
      }
    });

    document.getElementById('chooseReminderSoundBtn')?.addEventListener('click', () => {
      document.getElementById('reminderSoundInput')?.click();
    });

    document.getElementById('reminderSoundInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const { [STORAGE_KEY]: existing } = await chrome.storage.local.get(STORAGE_KEY);
      if (existing) {
        e.target.value = '';
        return;
      }
      const ext = (file.name || '').toLowerCase();
      if (!ext.endsWith('.mp4') && !ext.endsWith('.wav')) {
        showFilename('Please use .mp4 or .wav');
        e.target.value = '';
        return;
      }
      showFilename(file.name);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          await chrome.storage.local.set({ [STORAGE_KEY]: base64, [FILENAME_KEY]: file.name });
          await loadSoundStatus();
        } catch (err) {
          showFilename('');
          console.warn('Save failed:', err);
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('clearReminderSound')?.addEventListener('click', async () => {
      await chrome.storage.local.remove([STORAGE_KEY, FILENAME_KEY]);
      document.getElementById('reminderSoundInput').value = '';
      showFilename('');
    });

    document.getElementById('previewReminderSoundBtn')?.addEventListener('click', async () => {
      const { [STORAGE_KEY]: soundData } = await chrome.storage.local.get(STORAGE_KEY);
      if (!soundData) return;
      try {
        if (previewAudio) previewAudio.pause();
        previewAudio = new Audio(soundData);
        previewAudio.volume = 0.8;
        previewAudio.onended = () => { previewAudio = null; };
        await previewAudio.play();
      } catch (err) {
        console.warn('Preview failed:', err);
      }
    });

    document.getElementById('pauseReminderSoundBtn')?.addEventListener('click', () => {
      if (previewAudio) {
        previewAudio.pause();
      }
    });

    document.getElementById('stopReminderSoundBtn')?.addEventListener('click', () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.currentTime = 0;
        previewAudio = null;
      }
    });

    document.getElementById('railBrand')?.addEventListener('click', (e) => {
      e.preventDefault();
      hideSettingsTab();
    });

    document.getElementById('railHomeBtn')?.addEventListener('click', () => {
      hideSettingsTab();
    });
  });
})();
