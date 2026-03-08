/**
 * StreakTab - Simple Tracker
 * Create custom trackers with text/checkbox columns. No spreadsheet.
 */

(() => {
  const STORAGE_KEY = 'streaktab_trackers';

  let trackers = [];
  let currentTrackerId = null;
  let editingTrackerId = null;

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t || '';
    return d.innerHTML;
  }

  async function loadTrackers() {
    const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
    trackers = Array.isArray(data) ? data : [];
  }

  async function saveTrackers() {
    await chrome.storage.local.set({ [STORAGE_KEY]: trackers });
  }

  function openCreateDialog() {
    editingTrackerId = null;
    document.getElementById('trackerCreateDialogTitle').textContent = 'Create Tracker';
    document.getElementById('trackerCreateDialogSubmit').textContent = 'Create Tracker';
    document.getElementById('trackerCreateDialogOverlay').classList.add('visible');
    document.getElementById('trackerNameInput').value = '';
    document.getElementById('trackerNameInput').focus();
  }

  function openEditDialog(trackerId) {
    const t = trackers.find((x) => x.id === trackerId);
    if (!t) return;
    editingTrackerId = trackerId;
    document.getElementById('trackerCreateDialogTitle').textContent = 'Edit Tracker';
    document.getElementById('trackerCreateDialogSubmit').textContent = 'Save Changes';
    document.getElementById('trackerNameInput').value = t.name || '';
    document.getElementById('trackerCreateDialogOverlay').classList.add('visible');
    const cols = (t.columns || []).length ? [...t.columns] : [{ name: '', type: 'text' }];
    renderColumnsList(cols);
    document.getElementById('trackerNameInput').focus();
  }

  function closeCreateDialog() {
    editingTrackerId = null;
    document.getElementById('trackerCreateDialogOverlay').classList.remove('visible');
  }

  function renderColumnsList(columns) {
    const list = document.getElementById('trackerColumnsList');
    if (!list) return;
    list.innerHTML = columns.map((col, i) => `
      <div class="tracker-column-row" data-i="${i}">
        <input type="text" class="tracker-column-name" placeholder="Column name" value="${escapeHtml(col.name || '')}" data-i="${i}">
        <select class="tracker-column-type" data-i="${i}">
          <option value="text" ${(col.type || 'text') === 'text' ? 'selected' : ''}>Text</option>
          <option value="checkbox" ${(col.type || 'text') === 'checkbox' ? 'selected' : ''}>Checkbox</option>
        </select>
        <button type="button" class="tracker-remove-column" data-i="${i}" aria-label="Remove">×</button>
      </div>
    `).join('');
    list.querySelectorAll('.tracker-remove-column').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        columns.splice(i, 1);
        renderColumnsList(columns);
      });
    });
    list.querySelectorAll('.tracker-column-name, .tracker-column-type').forEach((el) => {
      el.addEventListener('change', () => {
        const i = parseInt(el.dataset.i, 10);
        if (el.classList.contains('tracker-column-name')) columns[i].name = el.value;
        else columns[i].type = el.value;
      });
      el.addEventListener('input', () => {
        const i = parseInt(el.dataset.i, 10);
        if (el.classList.contains('tracker-column-name')) columns[i].name = el.value;
      });
    });
  }

  function getColumnsFromForm() {
    const list = document.getElementById('trackerColumnsList');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.tracker-column-row')).map((row) => {
      const nameEl = row.querySelector('.tracker-column-name');
      const typeEl = row.querySelector('.tracker-column-type');
      return {
        name: (nameEl?.value?.trim()) || 'Column',
        type: (typeEl?.value) || 'text'
      };
    });
  }

  function renderSidebarList() {
    const ul = document.getElementById('trackerEntriesList');
    if (!ul) return;
    if (trackers.length === 0) {
      ul.innerHTML = '';
      updateMainContentView();
      return;
    }
    ul.innerHTML = trackers.map((t) => `
      <li class="tracker-entry-item" data-id="${t.id}">
        <span class="tracker-entry-name">${escapeHtml(t.name)}</span>
        <button type="button" class="tracker-entry-delete" data-id="${t.id}" aria-label="Delete">×</button>
      </li>
    `).join('');
    ul.querySelectorAll('.tracker-entry-item').forEach((li) => {
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('tracker-entry-delete')) return;
        openTrackerSheet(li.dataset.id);
      });
    });
    ul.querySelectorAll('.tracker-entry-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTracker(btn.dataset.id);
      });
    });
    updateMainContentView();
  }

  // ─── When tracker sidebar open: show tracker content (first tracker or empty page). Hide home. ───
  // Like reminder: opening tracker tab shows tracker content, not home page.
  function updateMainContentView() {
    const trackerPageMain = document.getElementById('trackerPageMain');
    const mainHome = document.getElementById('mainHome');
    const sidebar = document.getElementById('fitnessSidebar');
    const reminderPageMain = document.getElementById('reminderPageMain');
    if (!trackerPageMain || !mainHome || !sidebar) return;
    // If reminder view is visible (user closed reminder sidebar but stayed on reminder content), don't switch to home
    if (reminderPageMain && !reminderPageMain.classList.contains('hidden')) {
      mainHome.classList.add('hidden');
      return;
    }
    const sidebarOpen = sidebar.classList.contains('open') && !sidebar.classList.contains('closed');
    const showTrackerPage = sidebarOpen && trackers.length === 0;
    const trackerSheetVisible = !!currentTrackerId;
    // Hide home when: sidebar open (tracker mode) OR tracker sheet is open
    const hideHome = sidebarOpen || trackerSheetVisible;
    if (showTrackerPage) {
      trackerPageMain.classList.remove('hidden');
      mainHome.classList.add('hidden');
    } else {
      trackerPageMain.classList.add('hidden');
      if (hideHome) {
        mainHome.classList.add('hidden');
      } else {
        mainHome.classList.remove('hidden');
      }
    }
  }

  // ─── KEY FIX: Dynamically set tracker sheet left offset based on sidebar state ───
  function updateTrackerSheetPosition() {
    const overlay = document.getElementById('trackerSheetOverlay');
    if (!overlay) return;
    const sidebar = document.getElementById('fitnessSidebar');
    const sidebarOpen = sidebar && sidebar.classList.contains('open') && !sidebar.classList.contains('closed');

    const railWidth = 56; // --rail-width
    const sidebarWidth = 300; // --sidebar-width

    if (sidebarOpen) {
      overlay.style.left = (railWidth + sidebarWidth) + 'px';
    } else {
      overlay.style.left = railWidth + 'px';
    }
  }

  function openTrackerSheet(id) {
    currentTrackerId = id;
    const t = trackers.find((x) => x.id === id);
    if (!t) return;
    document.getElementById('trackerSheetTitle').textContent = t.name;

    // Sidebar opens only when user clicks the tracker icon in the rail — do not auto-open here
    // Show the tracker sheet
    const sheetOverlay = document.getElementById('trackerSheetOverlay');
    sheetOverlay.classList.add('visible');

    // Position sheet correctly next to the open sidebar
    updateTrackerSheetPosition();

    document.getElementById('mainApp')?.classList.add('tracker-sheet-open');
    renderTrackerTable(t);
  }

  function closeTrackerSheet() {
    document.getElementById('trackerSheetOverlay').classList.remove('visible');
    document.getElementById('mainApp')?.classList.remove('tracker-sheet-open');
    currentTrackerId = null;
  }

  document.addEventListener('streaktab:closeTrackerSheet', closeTrackerSheet);

  function renderTrackerTable(tracker) {
    const thead = document.getElementById('trackerTableHead');
    const tbody = document.getElementById('trackerTableBody');
    if (!thead || !tbody) return;
    const cols = tracker.columns || [];
    if (cols.length === 0) {
      thead.innerHTML = '<tr><th>No columns</th></tr>';
      tbody.innerHTML = '<tr><td colspan="1" class="tracker-empty-cell">Add columns when editing the tracker</td></tr>';
      return;
    }
    thead.innerHTML = `<tr>${cols.map((c) => `<th>${escapeHtml(c.name)}</th>`).join('')}<th class="tracker-row-actions-th"></th></tr>`;
    tbody.innerHTML = '';
    const rows = tracker.rows || [];
    rows.forEach((row, ri) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIndex = String(ri);
      tr.innerHTML = cols.map((col, ci) => {
        const val = row?.[ci] !== undefined ? row[ci] : (col.type === 'checkbox' ? false : '');
        if (col.type === 'checkbox') {
          const checked = val === true || val === 'true' || val === '1';
          return `<td style="text-align:center;vertical-align:middle;"><input type="checkbox" data-row="${ri}" data-col="${ci}" ${checked ? 'checked' : ''}></td>`;
        }
        return `<td><input type="text" data-row="${ri}" data-col="${ci}" value="${escapeHtml(String(val || ''))}" placeholder="${escapeHtml(col.name)}"></td>`;
      }).join('') + `<td class="tracker-row-actions"><button type="button" class="tracker-row-delete" data-row="${ri}" aria-label="Delete row">×</button></td>`;
      tbody.appendChild(tr);
    });
    bindTableEvents(tracker);
  }

  function bindTableEvents(tracker) {
    const tbody = document.getElementById('trackerTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('input').forEach((input) => {
      const save = () => saveTrackerCell(tracker, input);
      input.addEventListener('change', save);
      input.addEventListener('blur', save);
    });
    tbody.querySelectorAll('.tracker-row-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ri = parseInt(btn.dataset.row, 10);
        if (!tracker.rows) tracker.rows = [];
        tracker.rows.splice(ri, 1);
        saveTrackers();
        renderTrackerTable(tracker);
      });
    });
  }

  function saveTrackerCell(tracker, input) {
    const ri = parseInt(input.dataset.row, 10);
    const ci = parseInt(input.dataset.col, 10);
    if (!tracker.rows) tracker.rows = [];
    while (tracker.rows.length <= ri) tracker.rows.push([]);
    const row = tracker.rows[ri];
    while (row.length <= ci) row.push('');
    const col = (tracker.columns || [])[ci];
    if (col && col.type === 'checkbox') {
      row[ci] = input.checked;
    } else {
      row[ci] = input.value;
    }
    saveTrackers();
  }

  function addRow(tracker) {
    if (!tracker.rows) tracker.rows = [];
    const cols = tracker.columns || [];
    tracker.rows.push(cols.map((c) => (c.type === 'checkbox' ? false : '')));
    saveTrackers();
    renderTrackerTable(tracker);
  }

  function deleteTracker(id) {
    trackers = trackers.filter((t) => t.id !== id);
    saveTrackers();
    renderSidebarList();
    if (currentTrackerId === id) closeTrackerSheet();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await loadTrackers();
    renderSidebarList();

    // ─── Tracker sidebar: opens ONLY when user clicks tracker icon in left rail ───
    // Architecture: Left rail = universal (always visible). Tracker sidebar = separate,
    // not universal — appears only on tracker icon click. Never auto-open.
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      const sidebar = document.getElementById('fitnessSidebar');
      const overlay = document.getElementById('sidebarOverlay');
      const isOpen = sidebar?.classList.contains('open') && !sidebar?.classList.contains('closed');
      if (isOpen) {
        sidebar?.classList.add('closed');
        sidebar?.classList.remove('open');
        overlay?.classList.remove('visible');
      } else {
        document.getElementById('settingsPageMain')?.classList.add('hidden');
        document.getElementById('reminderSidebar')?.classList.add('closed');
        document.getElementById('reminderSidebar')?.classList.remove('open');
        document.getElementById('reminderPageMain')?.classList.add('hidden');
        document.getElementById('notesSidebar')?.classList.add('closed');
        document.getElementById('notesSidebar')?.classList.remove('open');
        document.getElementById('notesPageMain')?.classList.add('hidden');
        document.getElementById('settingsPageMain')?.classList.add('hidden');
        sidebar?.classList.remove('closed');
        sidebar?.classList.add('open');
        overlay?.classList.add('visible');
        if (trackers.length > 0) {
          openTrackerSheet(trackers[0].id);
        }
      }
      updateMainContentView();
      updateTrackerSheetPosition();
    });

    document.getElementById('sidebarClose').addEventListener('click', () => {
      document.getElementById('fitnessSidebar').classList.add('closed');
      document.getElementById('fitnessSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('visible');
      updateMainContentView();
      updateTrackerSheetPosition();
    });

    document.getElementById('railBrand')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('reminderSidebar')?.classList.add('closed');
      document.getElementById('reminderSidebar')?.classList.remove('open');
      document.getElementById('reminderPageMain')?.classList.add('hidden');
      document.getElementById('notesSidebar')?.classList.add('closed');
      document.getElementById('notesSidebar')?.classList.remove('open');
      document.getElementById('notesPageMain')?.classList.add('hidden');
      document.getElementById('fitnessSidebar')?.classList.add('closed');
      document.getElementById('fitnessSidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('visible');
      document.dispatchEvent(new CustomEvent('streaktab:closeTrackerSheet'));
      document.getElementById('mainHome')?.classList.remove('hidden');
      updateMainContentView();
      updateTrackerSheetPosition();
    });

    document.getElementById('railHomeBtn')?.addEventListener('click', () => {
      // Close tracker sheet FIRST so updateMainContentView shows home (it hides home when sheet is open)
      document.dispatchEvent(new CustomEvent('streaktab:closeTrackerSheet'));
      document.getElementById('reminderSidebar')?.classList.add('closed');
      document.getElementById('reminderSidebar')?.classList.remove('open');
      document.getElementById('reminderPageMain')?.classList.add('hidden');
      document.getElementById('notesSidebar')?.classList.add('closed');
      document.getElementById('notesSidebar')?.classList.remove('open');
      document.getElementById('notesPageMain')?.classList.add('hidden');
      document.getElementById('fitnessSidebar')?.classList.add('closed');
      document.getElementById('fitnessSidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('visible');
      document.getElementById('mainHome')?.classList.remove('hidden');
      updateMainContentView();
      updateTrackerSheetPosition();
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
      if (currentTrackerId) return;
      const reminderOpen = document.getElementById('reminderSidebar')?.classList.contains('open');
      const notesOpen = document.getElementById('notesSidebar')?.classList.contains('open');
      if (reminderOpen || notesOpen) return;
      document.getElementById('fitnessSidebar').classList.add('closed');
      document.getElementById('fitnessSidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('visible');
      updateMainContentView();
      updateTrackerSheetPosition();
    });

    // ─── Create Tracker ───
    document.getElementById('trackerCreateBtn').addEventListener('click', () => {
      openCreateDialog();
      renderColumnsList([{ name: '', type: 'text' }]);
    });

    document.getElementById('trackerAddColumnBtn').addEventListener('click', () => {
      const cols = getColumnsFromForm();
      cols.push({ name: '', type: 'text' });
      renderColumnsList(cols);
    });

    document.getElementById('trackerCreateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('trackerNameInput').value.trim();
      if (!name) return;
      let columns = getColumnsFromForm();
      if (columns.length === 0) {
        columns.push({ name: 'Item', type: 'text' });
      }
      const newColumns = columns.map((c) => ({ name: c.name || 'Column', type: c.type || 'text' }));

      if (editingTrackerId) {
        const t = trackers.find((x) => x.id === editingTrackerId);
        if (t) {
          t.name = name;
          t.columns = newColumns;
          const numCols = newColumns.length;
          (t.rows || []).forEach((row) => {
            while (row.length > numCols) row.pop();
            while (row.length < numCols) {
              const col = newColumns[row.length];
              row.push(col?.type === 'checkbox' ? false : '');
            }
          });
          saveTrackers();
          renderSidebarList();
          closeCreateDialog();
          document.getElementById('trackerSheetTitle').textContent = t.name;
          renderTrackerTable(t);
        }
      } else {
        const tracker = {
          id: uid(),
          name,
          columns: newColumns,
          rows: []
        };
        trackers.push(tracker);
        saveTrackers();
        renderSidebarList();
        closeCreateDialog();
        updateMainContentView();
        openTrackerSheet(tracker.id);
      }
    });

    document.getElementById('trackerCreateDialogClose').addEventListener('click', closeCreateDialog);
    document.getElementById('trackerCreateDialogOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'trackerCreateDialogOverlay') closeCreateDialog();
    });

    // ─── Tracker Sheet actions ───
    document.getElementById('trackerSheetClose').addEventListener('click', closeTrackerSheet);

    document.getElementById('trackerAddRowBtn').addEventListener('click', () => {
      if (!currentTrackerId) return;
      const t = trackers.find((x) => x.id === currentTrackerId);
      if (t) addRow(t);
    });

    document.getElementById('trackerEditBtn')?.addEventListener('click', () => {
      if (currentTrackerId) openEditDialog(currentTrackerId);
    });
  });
})();