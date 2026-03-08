/**
 * StreakTab - Notes
 * Create notes with name, rich content, image paste. Edit and delete easily.
 */

(() => {
  const STORAGE_KEY = 'streaktab_notes';

  let notes = [];
  let currentNoteId = null;
  let saveTimeout = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
  }

  async function loadNotes() {
    const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
    notes = Array.isArray(data) ? data : [];
    notes.forEach((n) => { if (!n.createdAt) n.createdAt = Date.now(); });
  }

  async function saveNotes() {
    await chrome.storage.local.set({ [STORAGE_KEY]: notes });
  }

  function updateNotesView() {
    const notesPageMain = document.getElementById('notesPageMain');
    const mainHome = document.getElementById('mainHome');
    const notesSidebar = document.getElementById('notesSidebar');
    const notesEmptyState = document.getElementById('notesEmptyState');

    const notesSidebarOpen = notesSidebar?.classList.contains('open') && !notesSidebar?.classList.contains('closed');

    if (notesSidebarOpen) {
      notesPageMain?.classList.remove('hidden');
      mainHome?.classList.add('hidden');
      if (notes.length === 0) {
        notesEmptyState?.classList.remove('hidden');
      } else {
        notesEmptyState?.classList.add('hidden');
      }
    }
  }

  function formatNoteDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function showDateTooltip(btn) {
    const existing = document.getElementById('notesDateTooltip');
    if (existing) {
      existing.remove();
      return;
    }
    const dateStr = btn.dataset.date;
    if (!dateStr) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'notesDateTooltip';
    tooltip.className = 'notes-date-tooltip';
    tooltip.textContent = `Created ${dateStr}`;
    document.body.appendChild(tooltip);
    const rect = btn.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 6}px`;
    const close = () => {
      const t = document.getElementById('notesDateTooltip');
      if (t) t.remove();
      document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }

  function renderNotesList() {
    const ul = document.getElementById('notesEntriesList');
    if (!ul) return;
    ul.innerHTML = notes.map((n) => {
      const dateStr = formatNoteDate(n.createdAt);
      return `
      <li class="tracker-entry-item notes-entry-item" data-id="${n.id}">
        <div class="notes-entry-text">
          <span class="tracker-entry-name">${escapeHtml(n.name || 'Untitled')}</span>
        </div>
        ${dateStr ? `<button type="button" class="notes-entry-info" data-id="${n.id}" data-date="${escapeHtml(dateStr)}" title="Show date">ℹ</button>` : ''}
        <button type="button" class="tracker-entry-delete notes-entry-delete" data-id="${n.id}" aria-label="Delete">×</button>
      </li>
    `;
    }).join('');
    ul.querySelectorAll('.notes-entry-item').forEach((li) => {
      li.addEventListener('click', (e) => {
        if (e.target.closest('.notes-entry-delete') || e.target.closest('.notes-entry-info')) return;
        openNoteSheet(li.dataset.id);
      });
    });
    ul.querySelectorAll('.notes-entry-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(btn.dataset.id);
      });
    });
    ul.querySelectorAll('.notes-entry-info').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDateTooltip(btn);
      });
    });
  }

  function closeNotesSidebar() {
    document.getElementById('notesSidebar')?.classList.add('closed');
    document.getElementById('notesSidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('visible');
    document.getElementById('sidebarOverlay')?.classList.remove('notes-sheet-active');
    document.getElementById('notesSheetOverlay')?.classList.remove('visible');
    currentNoteId = null;
  }

  function openNotesSidebar() {
    const sidebar = document.getElementById('notesSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    document.getElementById('settingsPageMain')?.classList.add('hidden');
    document.getElementById('fitnessSidebar')?.classList.add('closed');
    document.getElementById('fitnessSidebar')?.classList.remove('open');
    document.getElementById('reminderSidebar')?.classList.add('closed');
    document.getElementById('reminderSidebar')?.classList.remove('open');
    document.getElementById('settingsPageMain')?.classList.add('hidden');
    document.getElementById('reminderPageMain')?.classList.add('hidden');
    document.dispatchEvent(new CustomEvent('streaktab:closeTrackerSheet'));
    overlay?.classList.add('visible');
    sidebar?.classList.remove('closed');
    sidebar?.classList.add('open');
    updateNotesView();
    renderNotesList();
    if (notes.length > 0) openNoteSheet(notes[0].id);
  }

  function openNoteSheet(id) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    currentNoteId = id;
    const titleInput = document.getElementById('notesSheetTitleInput');
    const contentEl = document.getElementById('notesSheetContent');
    if (titleInput) titleInput.value = n.name || '';
    if (contentEl) {
      contentEl.innerHTML = n.content || '<br>';
      contentEl.dataset.placeholder = 'Write anything here… Paste images with Ctrl+V';
    }
    document.getElementById('notesSheetOverlay')?.classList.add('visible');
    document.getElementById('sidebarOverlay')?.classList.add('notes-sheet-active');
    setTimeout(() => {
      contentEl?.focus();
      if (contentEl) {
        const html = contentEl.innerHTML;
        const isEmpty = !html || html === '<br>' || html === '<br/>' || html.trim() === '';
        if (isEmpty) {
          contentEl.innerHTML = '<br>';
          const sel = window.getSelection();
          const range = document.createRange();
          range.setStart(contentEl, 0);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    }, 150);
  }

  function closeNoteSheet() {
    if (currentNoteId) saveCurrentNote();
    document.getElementById('notesSheetOverlay')?.classList.remove('visible');
    document.getElementById('sidebarOverlay')?.classList.remove('notes-sheet-active');
    currentNoteId = null;
  }

  function saveCurrentNote() {
    if (!currentNoteId) return;
    const n = notes.find((x) => x.id === currentNoteId);
    if (!n) return;
    const titleInput = document.getElementById('notesSheetTitleInput');
    const contentEl = document.getElementById('notesSheetContent');
    n.name = (titleInput?.value?.trim()) || 'Untitled';
    let html = contentEl?.innerHTML || '';
    if (html === '<br>' || html === '<br/>' || !html.trim()) html = '';
    n.content = html;
    if (!n.createdAt) n.createdAt = Date.now();
    saveNotes();
    renderNotesList();
  }

  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveCurrentNote, 400);
  }

  function createNote() {
    const now = new Date();
    const note = { id: uid(), name: 'Untitled', content: '', createdAt: now.getTime() };
    notes.push(note);
    saveNotes();
    renderNotesList();
    updateNotesView();
    openNoteSheet(note.id);
  }

  function deleteNote(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    renderNotesList();
    updateNotesView();
    if (currentNoteId === id) {
      closeNoteSheet();
      if (notes.length > 0) openNoteSheet(notes[0].id);
    }
  }

  function setupImagePaste(el) {
    if (!el) return;
    el.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.src = reader.result;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.borderRadius = '8px';
            img.style.margin = '8px 0';
            const sel = window.getSelection();
            const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
            if (range) {
              range.insertNode(img);
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } else {
              el.appendChild(img);
            }
            debouncedSave();
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadNotes();
    renderNotesList();

    document.getElementById('notesToggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('notesSidebar');
      const isOpen = sidebar?.classList.contains('open') && !sidebar?.classList.contains('closed');
      if (isOpen) {
        closeNotesSidebar();
        document.getElementById('mainHome')?.classList.remove('hidden');
      } else {
        openNotesSidebar();
      }
    });

    document.getElementById('notesSidebarClose')?.addEventListener('click', () => {
      closeNotesSidebar();
      document.getElementById('mainHome')?.classList.remove('hidden');
    });

    document.getElementById('notesCreateBtn')?.addEventListener('click', createNote);

    const titleInput = document.getElementById('notesSheetTitleInput');
    const contentEl = document.getElementById('notesSheetContent');
    if (titleInput) {
      titleInput.addEventListener('input', debouncedSave);
      titleInput.addEventListener('blur', saveCurrentNote);
    }
    const contentWrap = document.querySelector('.notes-sheet-content-wrap');
    if (contentWrap) {
      contentWrap.addEventListener('click', () => contentEl?.focus());
    }
    if (contentEl) {
      contentEl.addEventListener('input', debouncedSave);
      contentEl.addEventListener('blur', saveCurrentNote);
      contentEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        contentEl.focus();
      });
      setupImagePaste(contentEl);
    }

    document.getElementById('notesSheetClose')?.addEventListener('click', closeNoteSheet);
    document.getElementById('notesSheetDeleteBtn')?.addEventListener('click', () => {
      if (currentNoteId) {
        deleteNote(currentNoteId);
        closeNoteSheet();
      }
    });

    document.getElementById('notesSheetOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'notesSheetOverlay') closeNoteSheet();
    });

    document.getElementById('railBrand')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeNotesSidebar();
    });

    document.getElementById('railHomeBtn')?.addEventListener('click', () => {
      closeNotesSidebar();
    });

    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      const notesSidebar = document.getElementById('notesSidebar');
      const isNotesOpen = notesSidebar?.classList.contains('open') && !notesSidebar?.classList.contains('closed');
      if (isNotesOpen) {
        closeNotesSidebar();
        document.getElementById('mainHome')?.classList.remove('hidden');
      }
    });
  });
})();
