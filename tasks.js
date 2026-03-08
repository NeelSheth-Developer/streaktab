/**
 * StreakTab - Task Board
 * Manages daily tasks, completion state, and streak calculation
 */

(function () {
  const STORAGE_KEYS = {
    TASKS: 'streaktab_tasks',
    STREAK: 'streaktab_streak',
    LAST_ACTIVE: 'streaktab_last_active',
    USER_NAME: 'streaktab_user_name',
    DEFAULT_NOTE_DISMISSED: 'streaktab_default_note_dismissed'
  };

  const DEFAULT_NOTE = "You can do it, today's your day, be confident.";

  function getTodayKey() {
    return new Date().toISOString().split('T')[0];
  }

  async function loadTasks() {
    const { [STORAGE_KEYS.TASKS]: allTasks = {} } = await chrome.storage.local.get(STORAGE_KEYS.TASKS);
    const today = getTodayKey();
    return allTasks[today] || [];
  }

  async function saveTasks(tasks) {
    const { [STORAGE_KEYS.TASKS]: allTasks = {} } = await chrome.storage.local.get(STORAGE_KEYS.TASKS);
    const today = getTodayKey();
    allTasks[today] = tasks;
    await chrome.storage.local.set({ [STORAGE_KEYS.TASKS]: allTasks });
  }

  async function updateStreak(completedCount) {
    const today = getTodayKey();
    const { [STORAGE_KEYS.STREAK]: streak = 0, [STORAGE_KEYS.LAST_ACTIVE]: lastActive = null } =
      await chrome.storage.local.get([STORAGE_KEYS.STREAK, STORAGE_KEYS.LAST_ACTIVE]);

    if (completedCount >= 1) {
      if (!lastActive) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.STREAK]: 1,
          [STORAGE_KEYS.LAST_ACTIVE]: today
        });
        return 1;
      }
      const lastDate = new Date(lastActive);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return streak;
      }
      if (diffDays === 1) {
        const newStreak = streak + 1;
        await chrome.storage.local.set({
          [STORAGE_KEYS.STREAK]: newStreak,
          [STORAGE_KEYS.LAST_ACTIVE]: today
        });
        return newStreak;
      }
      await chrome.storage.local.set({
        [STORAGE_KEYS.STREAK]: 1,
        [STORAGE_KEYS.LAST_ACTIVE]: today
      });
      return 1;
    }
    return streak;
  }

  async function getStreak() {
    const today = getTodayKey();
    const { [STORAGE_KEYS.STREAK]: streak = 0, [STORAGE_KEYS.LAST_ACTIVE]: lastActive = null } =
      await chrome.storage.local.get([STORAGE_KEYS.STREAK, STORAGE_KEYS.LAST_ACTIVE]);

    if (!lastActive) return streak;
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      await chrome.storage.local.set({ [STORAGE_KEYS.STREAK]: 0 });
      return 0;
    }
    return streak;
  }

  const STICKY_COLORS = ['sticky-yellow', 'sticky-coral', 'sticky-mint', 'sticky-lavender', 'sticky-sky', 'sticky-peach'];
  const STICKY_HEX = { 'sticky-yellow': '#fef08a', 'sticky-coral': '#fecaca', 'sticky-mint': '#bbf7d0', 'sticky-lavender': '#e9d5ff', 'sticky-sky': '#bae6fd', 'sticky-peach': '#fed7aa' };

  function markdownToHtml(md) {
    if (!md) return '';
    let html = String(md).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^[-*] \[[xX]\] (.+)$/gm, '<li class="task-tick-done">✓ $1</li>');
    html = html.replace(/^[-*] \[ \] (.+)$/gm, '<li class="task-tick">☐ $1</li>');
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (m) => '<ul>' + m.replace(/\s+/g, '') + '</ul>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  function insertAtCursor(textarea, before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const sel = text.substring(start, end) || 'text';
    const newText = text.substring(0, start) + before + sel + after + text.substring(end);
    textarea.value = newText;
    textarea.selectionStart = textarea.selectionEnd = start + before.length + sel.length;
    textarea.focus();
    return newText;
  }

  function formatTaskDate() {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTaskTime() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  async function renderTasks(tasks) {
    const grid = document.getElementById('taskList');
    const { [STORAGE_KEYS.DEFAULT_NOTE_DISMISSED]: dismissed } = await chrome.storage.local.get(STORAGE_KEYS.DEFAULT_NOTE_DISMISSED);
    const defaultNoteHtml = !dismissed
      ? `
      <div class="task-item sticky-peach" data-default="true">
        <span class="task-text">${escapeHtml(DEFAULT_NOTE)}</span>
        <div class="task-datetime">
          <span class="task-date">${formatTaskDate()}</span>
          <span class="task-time">${formatTaskTime()}</span>
        </div>
        <button class="task-delete task-delete-default" aria-label="Remove default note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `
      : '';
    const taskCards = tasks
      .map(
        (task, origIdx) => {
          const colorClass = task.color && STICKY_COLORS.includes(task.color) ? task.color : STICKY_COLORS[origIdx % STICKY_COLORS.length];
          const completedClass = task.completed ? ' completed' : '';
          return `
      <div class="task-item ${colorClass}${completedClass}" data-idx="${origIdx}">
        <div class="task-checkbox-wrap">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark complete">
        </div>
        <span class="task-text">${markdownToHtml(task.text)}</span>
        <div class="task-datetime">
          <span class="task-date">${formatTaskDate()}</span>
          <span class="task-time">${formatTaskTime()}</span>
        </div>
        <button class="task-delete" aria-label="Delete task">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
        }
      )
      .join('');
    const emptyState = tasks.length === 0 && dismissed
      ? '<li class="tasks-empty"><span class="tasks-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>Click + to add your first note</li>'
      : '';
    grid.innerHTML = defaultNoteHtml + taskCards + emptyState;

    const dateEl = document.getElementById('taskDateDisplay');
    if (dateEl) dateEl.textContent = formatTaskDate();

    grid.querySelectorAll('.task-item').forEach((el) => {
      const isDefault = el.dataset.default === 'true';
      const idx = parseInt(el.dataset.idx, 10);
      const cb = el.querySelector('.task-checkbox');
      const del = el.querySelector('.task-delete');
      if (cb && !isDefault) cb.addEventListener('change', (e) => { e.stopPropagation(); toggleTask(idx); });
      if (del) {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isDefault) dismissDefaultNote();
          else deleteTask(idx);
        });
      }
      if (!isDefault && !isNaN(idx)) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          if (e.target.closest('.task-delete') || e.target.closest('.task-checkbox-wrap')) return;
          window.openEditDialog?.(idx);
        });
      }
    });
  }

  async function dismissDefaultNote() {
    await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_NOTE_DISMISSED]: true });
    const tasks = await loadTasks();
    renderTasks(tasks);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function addTask(text, color) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tasks = await loadTasks();
    const colorClass = color && STICKY_COLORS.includes(color) ? color : STICKY_COLORS[tasks.length % STICKY_COLORS.length];
    tasks.push({ text: trimmed, completed: false, color: colorClass });
    await saveTasks(tasks);
    renderTasks(tasks);
    const input = document.getElementById('noteMarkdownInput');
    if (input) input.value = '';
  }

  async function toggleTask(idx) {
    const tasks = await loadTasks();
    if (idx < 0 || idx >= tasks.length) return;
    tasks[idx].completed = !tasks[idx].completed;
    await saveTasks(tasks);
    const completedCount = tasks.filter((t) => t.completed).length;
    await updateStreak(completedCount);
    renderTasks(tasks);
  }

  async function deleteTask(idx) {
    const tasks = await loadTasks();
    tasks.splice(idx, 1);
    await saveTasks(tasks);
    renderTasks(tasks);
  }

  async function updateTask(idx, text, color) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tasks = await loadTasks();
    if (idx < 0 || idx >= tasks.length) return;
    tasks[idx].text = trimmed;
    if (color && STICKY_COLORS.includes(color)) tasks[idx].color = color;
    await saveTasks(tasks);
    renderTasks(tasks);
  }

  async function loadUserName() {
    const { [STORAGE_KEYS.USER_NAME]: name } = await chrome.storage.local.get(STORAGE_KEYS.USER_NAME);
    const span = document.getElementById('userName');
    span.textContent = name || 'there';
    if (!name) {
      span.contentEditable = 'true';
      span.title = 'Click to set your name';
      span.addEventListener('blur', async () => {
        const n = span.textContent.trim() || 'there';
        await chrome.storage.local.set({ [STORAGE_KEYS.USER_NAME]: n === 'there' ? '' : n });
        span.textContent = n;
      });
    }
  }

  let editingIdx = null;

  function getOrdinalSuffix(n) {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function formatDateTime() {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'long' });
    const year = now.getFullYear();
    const dateStr = `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${h}:${m}:${s}`;
    const dateEl = document.getElementById('datetimeDate');
    const timeEl = document.getElementById('datetimeTime');
    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const tasks = await loadTasks();
    renderTasks(tasks);
    await loadUserName();

    formatDateTime();
    setInterval(formatDateTime, 1000);

    const noteOverlay = document.getElementById('noteDialogOverlay');
    const noteClose = document.getElementById('noteDialogClose');
    const noteSubmitBtn = document.getElementById('noteDialogSubmitBtn');
    const noteDialogTitle = document.getElementById('noteDialogTitle');
    const noteInput = document.getElementById('noteMarkdownInput');
    const notePreview = document.getElementById('notePreview');

    function getSelectedColor() {
      if (editingIdx !== null) {
        const tasks = loadTasks();
        return tasks.then((t) => t[editingIdx]?.color || STICKY_COLORS[0]);
      }
      return Promise.resolve(STICKY_COLORS[0]);
    }

    function openNoteDialog() {
      editingIdx = null;
      if (noteDialogTitle) noteDialogTitle.textContent = 'Add Note';
      if (noteSubmitBtn) noteSubmitBtn.textContent = 'Add Note';
      if (noteOverlay) noteOverlay.classList.add('visible');
      if (noteInput) {
        noteInput.value = '';
        noteInput.focus();
      }
      if (notePreview) notePreview.innerHTML = '';
    }

    async function openEditDialog(idx) {
      const tasks = await loadTasks();
      if (idx < 0 || idx >= tasks.length) return;
      editingIdx = idx;
      if (noteDialogTitle) noteDialogTitle.textContent = 'Edit Note';
      if (noteSubmitBtn) noteSubmitBtn.textContent = 'Save';
      if (noteOverlay) noteOverlay.classList.add('visible');
      if (noteInput) {
        noteInput.value = tasks[idx].text;
        noteInput.focus();
      }
      if (notePreview) notePreview.innerHTML = markdownToHtml(tasks[idx].text) || '';
    }

    window.openEditDialog = openEditDialog;

    function closeNoteDialog() {
      editingIdx = null;
      if (noteOverlay) noteOverlay.classList.remove('visible');
    }

    function updatePreview() {
      if (notePreview && noteInput) {
        notePreview.innerHTML = markdownToHtml(noteInput.value) || '<span class="note-preview-empty">Preview will appear here…</span>';
      }
    }

    async function handleSubmit() {
      const color = await getSelectedColor();
      if (editingIdx !== null) {
        updateTask(editingIdx, noteInput?.value, color);
      } else {
        addTask(noteInput?.value, color);
      }
      closeNoteDialog();
    }

    document.getElementById('homeAddNoteBtn')?.addEventListener('click', openNoteDialog);
    noteClose?.addEventListener('click', closeNoteDialog);
    noteOverlay?.addEventListener('click', (e) => {
      if (e.target === noteOverlay) closeNoteDialog();
    });
    noteSubmitBtn?.addEventListener('click', handleSubmit);
    noteInput?.addEventListener('input', updatePreview);
    noteInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    });
  });
})();
