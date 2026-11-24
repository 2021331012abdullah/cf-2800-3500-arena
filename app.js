/**
 * CF 2800-3500 Arena - Main Application Logic
 * Supports Multi-handle CF sync, statement length & solves sorting, tag filters,
 * roulette, virtual mashup generator, training analytics, and bookmarking.
 */

// Application State
const state = {
  allProblems: [],
  filteredProblems: [],
  uniqueTags: [],
  tagCounts: {},
  
  // Handles & Solved Sync
  handles: [], // Array of handle strings
  handlesData: {}, // { handle: { info: {}, solvedSet: Set(), attemptedSet: Set() } }
  
  // Filters
  searchQuery: '',
  selectedRating: 'all',
  selectedTags: new Set(),
  tagFilterMode: 'or', // 'or' | 'and' | 'not'
  lengthRange: { min: 77, max: 5910 },
  solvesRange: { min: 0, max: 4097 },
  statusFilter: 'all', // 'all' | 'unsolved_all' | 'solved_any' | 'solved_all' | 'attempted'
  starredOnly: false,
  
  // Sorting
  currentSort: 'length_asc',
  
  // Pagination
  currentPage: 1,
  pageSize: 50,
  
  // UI State
  viewMode: 'table', // 'table' | 'grid'
  hideSpoilers: false,
  starredProblems: new Set(),
  notes: {}, // { problemId: string }

  // Virtual Mashup
  mashup: {
    problems: [],
    timerSeconds: 7200,
    intervalId: null,
    isPaused: true
  }
};

// Rating Colors & Badges Helper
function getRatingClass(rating) {
  if (rating >= 3000) return 'rating-3000';
  return 'rating-2800';
}

function getRatingBadgeHtml(rating) {
  const isNutella = rating >= 3000;
  const ratingCls = getRatingClass(rating);
  const extraCls = isNutella ? 'legendary-badge' : '';
  return `<span class="px-2 py-0.5 rounded-md font-mono font-bold text-xs border ${ratingCls} ${extraCls}">${rating}</span>`;
}

// Format reading time
function getReadingTime(words) {
  const mins = words / 150;
  if (mins < 0.5) return `${Math.max(5, Math.round(words / 3.5))}s read`;
  return `${Math.ceil(mins)}m read`;
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-900/90 border-emerald-600 text-emerald-200' :
                  type === 'error' ? 'bg-rose-900/90 border-rose-600 text-rose-200' :
                  'bg-cyan-900/90 border-cyan-600 text-cyan-200';
  
  toast.className = `p-3 rounded-xl border text-xs shadow-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 ${bgClass}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'error' ? 'fa-circle-exclamation text-rose-400' : 'fa-circle-info text-cyan-400'}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Load Data
async function loadProblems() {
  if (window.CF_PROBLEMS_DATA && Array.isArray(window.CF_PROBLEMS_DATA)) {
    state.allProblems = window.CF_PROBLEMS_DATA;
  } else {
    try {
      const res = await fetch('./cf_2800_3500_sorted.json');
      state.allProblems = await res.json();
    } catch (err) {
      console.error('Failed to load JSON directly, checking window.CF_PROBLEMS_DATA', err);
    }
  }

  // Tag extraction and counting
  const tagCounts = {};
  state.allProblems.forEach(p => {
    p.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  state.tagCounts = tagCounts;
  state.uniqueTags = Object.keys(tagCounts).sort();

  // Load saved state from LocalStorage
  loadLocalStorage();

  // Populate UI filters
  renderTagChips();
  applyFiltersAndSort();
  updateGlobalStats();

  // If handles exist, sync them
  if (state.handles.length > 0) {
    syncAllHandles();
  }
}

// LocalStorage Persistence
function loadLocalStorage() {
  try {
    const savedHandles = localStorage.getItem('cf_arena_handles');
    if (savedHandles) {
      state.handles = JSON.parse(savedHandles);
    }
    const savedStarred = localStorage.getItem('cf_arena_starred');
    if (savedStarred) {
      state.starredProblems = new Set(JSON.parse(savedStarred));
      document.getElementById('starred-badge').textContent = state.starredProblems.size;
    }
    const savedNotes = localStorage.getItem('cf_arena_notes');
    if (savedNotes) {
      state.notes = JSON.parse(savedNotes);
    }
    const savedSpoilers = localStorage.getItem('cf_arena_spoilers');
    if (savedSpoilers === 'true') {
      state.hideSpoilers = true;
      document.body.classList.add('spoilers-hidden');
      updateSpoilerBtn();
    }
  } catch (e) {
    console.error('Error loading localStorage', e);
  }
}

function saveLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to localStorage', e);
  }
}

// Render Tag Chips
function renderTagChips(filterText = '') {
  const container = document.getElementById('tag-chips-container');
  if (!container) return;

  const filtered = state.uniqueTags.filter(t => t.toLowerCase().includes(filterText.toLowerCase()));
  
  container.innerHTML = filtered.map(tag => {
    const isSelected = state.selectedTags.has(tag);
    const count = state.tagCounts[tag] || 0;
    
    let activeClass = 'bg-[#151f30] text-gray-300 border-[#223147] hover:bg-[#1e2d45]';
    if (isSelected) {
      if (state.tagFilterMode === 'not') {
        activeClass = 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/30';
      } else {
        activeClass = 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-900/30';
      }
    }

    return `
      <button 
        class="tag-chip px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer flex items-center gap-1.5 ${activeClass}" 
        data-tag="${tag}"
      >
        <span>${tag}</span>
        <span class="opacity-60 text-[10px]">(${count})</span>
      </button>
    `;
  }).join('');

  // Attach chip click listeners
  container.querySelectorAll('.tag-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-tag');
      toggleTag(tag);
    });
  });

  document.getElementById('selected-tags-count').textContent = state.selectedTags.size;
}

function toggleTag(tag) {
  if (state.selectedTags.has(tag)) {
    state.selectedTags.delete(tag);
  } else {
    state.selectedTags.add(tag);
  }
  renderTagChips(document.getElementById('tag-search-input')?.value || '');
  applyFiltersAndSort();
}

// Codeforces Multi-Handle Sync Engine
async function addHandle(handleName) {
  const clean = handleName.trim();
  if (!clean) return;
  if (state.handles.some(h => h.toLowerCase() === clean.toLowerCase())) {
    showToast(`Handle "${clean}" is already tracked`, 'info');
    return;
  }

  state.handles.push(clean);
  saveLocalStorage('cf_arena_handles', state.handles);
  document.getElementById('handle-input').value = '';

  renderHandleCards();
  await syncSingleHandle(clean);
}

function removeHandle(handleName) {
  state.handles = state.handles.filter(h => h.toLowerCase() !== handleName.toLowerCase());
  delete state.handlesData[handleName.toLowerCase()];
  saveLocalStorage('cf_arena_handles', state.handles);
  
  renderHandleCards();
  applyFiltersAndSort();
  updateGlobalStats();
  showToast(`Removed handle "${handleName}"`, 'info');
}

async function syncAllHandles() {
  renderHandleCards();
  for (const handle of state.handles) {
    await syncSingleHandle(handle);
  }
}

async function syncSingleHandle(handle) {
  const key = handle.toLowerCase();
  if (!state.handlesData[key]) {
    state.handlesData[key] = {
      info: null,
      solvedSet: new Set(),
      attemptedSet: new Set(),
      loading: true,
      error: null
    };
  } else {
    state.handlesData[key].loading = true;
  }
  renderHandleCards();

  try {
    // 1. Fetch user.info
    const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
    const infoData = await infoRes.json();
    if (infoData.status === 'OK' && infoData.result && infoData.result.length > 0) {
      state.handlesData[key].info = infoData.result[0];
    }

    // 2. Fetch user.status
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`);
    const statusData = await statusRes.json();
    
    if (statusData.status === 'OK' && Array.isArray(statusData.result)) {
      const solved = new Set();
      const attempted = new Set();
      
      statusData.result.forEach(sub => {
        if (sub.problem && sub.problem.contestId && sub.problem.index) {
          const probKey = `${sub.problem.contestId}${sub.problem.index}`;
          const altKey = `${sub.problem.contestId}_${sub.problem.index}`;
          
          if (sub.verdict === 'OK') {
            solved.add(probKey);
            solved.add(altKey);
          } else {
            attempted.add(probKey);
            attempted.add(altKey);
          }
        }
      });

      state.handlesData[key].solvedSet = solved;
      state.handlesData[key].attemptedSet = attempted;
      state.handlesData[key].loading = false;
      state.handlesData[key].error = null;
      showToast(`Synced ${handle}: ${get2800SolvedCount(key)} solves in 2800-3500`, 'success');
    } else {
      throw new Error(statusData.comment || 'Failed to fetch user submissions');
    }
  } catch (err) {
    console.error(`Error syncing handle ${handle}:`, err);
    state.handlesData[key].loading = false;
    state.handlesData[key].error = err.message || 'API error';
    showToast(`Error syncing ${handle}: ${err.message}`, 'error');
  }

  renderHandleCards();
  applyFiltersAndSort();
  updateGlobalStats();
}

function get2800SolvedCount(handleKey) {
  const data = state.handlesData[handleKey];
  if (!data || !data.solvedSet) return 0;
  let count = 0;
  state.allProblems.forEach(p => {
    const k1 = `${p.contestId}${p.index}`;
    const k2 = `${p.contestId}_${p.index}`;
    if (data.solvedSet.has(k1) || data.solvedSet.has(k2)) {
      count++;
    }
  });
  return count;
}

// Render Handle Cards in Header Bar
function renderHandleCards() {
  const container = document.getElementById('active-handles-container');
  if (!container) return;

  if (state.handles.length === 0) {
    container.innerHTML = `
      <div id="no-handles-notice" class="text-xs text-gray-500 italic py-2 flex items-center gap-2">
        <i class="fa-solid fa-circle-info text-cyan-400"></i>
        <span>No handles added yet. Type a handle above or click a preset to see solved statuses.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = state.handles.map(handle => {
    const key = handle.toLowerCase();
    const data = state.handlesData[key] || { loading: true };
    const info = data.info || {};
    const avatar = info.avatar || 'https://userpic.codeforces.org/no-avatar.jpg';
    const rating = info.rating || '---';
    const rank = info.rank || 'loading';
    const solvedIn2800 = get2800SolvedCount(key);
    
    // CF rank colors
    let rankColor = 'text-red-400 border-red-500/30';
    if (rating >= 3000) rankColor = 'text-rose-400 border-rose-500/50';
    else if (rating >= 2400) rankColor = 'text-red-400 border-red-500/30';
    else if (rating >= 2100) rankColor = 'text-amber-400 border-amber-500/30';
    else if (rating >= 1900) rankColor = 'text-purple-400 border-purple-500/30';

    return `
      <div class="flex items-center gap-3 bg-[#0a0e17] px-3.5 py-2 rounded-xl border border-[#223147] text-xs font-mono glow-card">
        <img src="${avatar}" alt="${handle}" class="w-8 h-8 rounded-full border border-gray-700 object-cover" onerror="this.src='https://userpic.codeforces.org/no-avatar.jpg'">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-white">${handle}</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 font-semibold">${rating}</span>
          </div>
          <div class="text-[10px] text-gray-400 flex items-center gap-2">
            <span class="${rankColor} capitalize font-semibold">${rank}</span>
            <span>•</span>
            <span class="text-emerald-400 font-bold">${solvedIn2800} / 1479 solved</span>
          </div>
        </div>
        <div class="flex items-center gap-1 ml-2">
          ${data.loading ? `<i class="fa-solid fa-spinner fa-spin text-cyan-400 text-xs"></i>` : `
            <button class="btn-refresh-handle p-1 text-gray-400 hover:text-cyan-400 cursor-pointer" data-handle="${handle}" title="Refresh submissions">
              <i class="fa-solid fa-arrows-rotate text-xs"></i>
            </button>
          `}
          <button class="btn-delete-handle p-1 text-gray-400 hover:text-rose-400 cursor-pointer" data-handle="${handle}" title="Remove handle">
            <i class="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  container.querySelectorAll('.btn-delete-handle').forEach(btn => {
    btn.addEventListener('click', () => removeHandle(btn.getAttribute('data-handle')));
  });
  container.querySelectorAll('.btn-refresh-handle').forEach(btn => {
    btn.addEventListener('click', () => syncSingleHandle(btn.getAttribute('data-handle')));
  });
}

// Problem Status Evaluator
function getProblemStatus(prob) {
  const k1 = `${prob.contestId}${prob.index}`;
  const k2 = `${prob.contestId}_${prob.index}`;
  
  if (state.handles.length === 0) {
    return { solvedBy: [], attemptedBy: [], isSolvedAll: false, isSolvedAny: false, isAttempted: false };
  }

  const solvedBy = [];
  const attemptedBy = [];

  state.handles.forEach(h => {
    const key = h.toLowerCase();
    const data = state.handlesData[key];
    if (data && data.solvedSet) {
      if (data.solvedSet.has(k1) || data.solvedSet.has(k2)) {
        solvedBy.push(h);
      } else if (data.attemptedSet && (data.attemptedSet.has(k1) || data.attemptedSet.has(k2))) {
        attemptedBy.push(h);
      }
    }
  });

  return {
    solvedBy,
    attemptedBy,
    isSolvedAll: solvedBy.length === state.handles.length && state.handles.length > 0,
    isSolvedAny: solvedBy.length > 0,
    isAttempted: attemptedBy.length > 0 && solvedBy.length === 0
  };
}

// Filtering & Sorting Core
function applyFiltersAndSort() {
  const query = state.searchQuery.toLowerCase().trim();
  const selRating = state.selectedRating;
  const selTags = Array.from(state.selectedTags);
  const tagMode = state.tagFilterMode;
  const maxLen = state.lengthRange.max;
  const minSolves = state.solvesRange.min;
  const statusFilter = state.statusFilter;
  const starredOnly = state.starredOnly;

  state.filteredProblems = state.allProblems.filter(prob => {
    // 1. Search Query
    if (query) {
      const matchName = prob.name.toLowerCase().includes(query);
      const matchId = prob.id.toLowerCase().includes(query);
      const matchContest = `${prob.contestId}${prob.index}`.toLowerCase().includes(query);
      if (!matchName && !matchId && !matchContest) return false;
    }

    // 2. Rating Filter
    if (selRating !== 'all' && prob.rating !== parseInt(selRating, 10)) {
      return false;
    }

    // 3. Length & Solves Sliders
    if (prob.length > maxLen) return false;
    if (prob.solvedCount < minSolves) return false;

    // 4. Tags Filter
    if (selTags.length > 0) {
      const probTags = prob.tags || [];
      if (tagMode === 'or') {
        const matchesAny = selTags.some(t => probTags.includes(t));
        if (!matchesAny) return false;
      } else if (tagMode === 'and') {
        const matchesAll = selTags.every(t => probTags.includes(t));
        if (!matchesAll) return false;
      } else if (tagMode === 'not') {
        const matchesAny = selTags.some(t => probTags.includes(t));
        if (matchesAny) return false;
      }
    }

    // 5. Starred Filter
    if (starredOnly && !state.starredProblems.has(prob.id)) {
      return false;
    }

    // 6. Solved Status Filter
    if (state.handles.length > 0) {
      const status = getProblemStatus(prob);
      if (statusFilter === 'unsolved_all' && status.isSolvedAny) return false;
      if (statusFilter === 'solved_any' && !status.isSolvedAny) return false;
      if (statusFilter === 'solved_all' && !status.isSolvedAll) return false;
      if (statusFilter === 'attempted' && !status.isAttempted) return false;
    }

    return true;
  });

  // Sort
  sortProblems(state.filteredProblems, state.currentSort);

  // Reset pagination to page 1
  state.currentPage = 1;

  // Render
  renderProblemList();
  renderPagination();
  updateStatusFilterCounts();
}

function sortProblems(list, sortKey) {
  list.sort((a, b) => {
    switch (sortKey) {
      case 'length_asc':
        return a.length - b.length || a.words - b.words;
      case 'length_desc':
        return b.length - a.length || b.words - a.words;
      case 'words_asc':
        return a.words - b.words || a.length - b.length;
      case 'words_desc':
        return b.words - a.words || b.length - a.length;
      case 'solves_desc':
        return b.solvedCount - a.solvedCount;
      case 'solves_asc':
        return a.solvedCount - b.solvedCount;
      case 'rating_desc':
        return b.rating - a.rating || b.solvedCount - a.solvedCount;
      case 'rating_asc':
        return a.rating - b.rating || b.solvedCount - a.solvedCount;
      case 'contest_desc':
        return b.contestId - a.contestId || b.index.localeCompare(a.index);
      case 'contest_asc':
        return a.contestId - b.contestId || a.index.localeCompare(b.index);
      case 'name_asc':
        return a.name.localeCompare(b.name);
      default:
        return a.length - b.length;
    }
  });
}

// Render Table & Grid Views
function renderProblemList() {
  const tableBody = document.getElementById('problems-table-body');
  const gridContainer = document.getElementById('grid-view-container');
  const emptyState = document.getElementById('empty-state');
  const total = state.filteredProblems.length;

  document.getElementById('total-filtered-count').textContent = total;
  document.getElementById('stat-showing').textContent = total;

  if (total === 0) {
    if (tableBody) tableBody.innerHTML = '';
    if (gridContainer) gridContainer.innerHTML = '';
    emptyState?.classList.remove('hidden');
    document.getElementById('current-range').textContent = '0 - 0';
    return;
  }

  emptyState?.classList.add('hidden');

  // Slice for pagination
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, total);
  const pageItems = state.filteredProblems.slice(startIndex, endIndex);

  document.getElementById('current-range').textContent = `${startIndex + 1} - ${endIndex}`;

  if (state.viewMode === 'table') {
    renderTableView(pageItems, startIndex);
  } else {
    renderGridView(pageItems);
  }
}

function renderTableView(items, startIndex) {
  const tbody = document.getElementById('problems-table-body');
  if (!tbody) return;

  tbody.innerHTML = items.map((prob, idx) => {
    const cfUrl = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
    const status = getProblemStatus(prob);
    const isStarred = state.starredProblems.has(prob.id);
    const hasNote = !!state.notes[prob.id];

    // Status HTML
    let statusHtml = '<span class="text-gray-500 font-mono text-[11px]">—</span>';
    let rowClass = 'problem-row';

    if (state.handles.length > 0) {
      if (status.solvedBy.length > 0) {
        rowClass += ' row-solved';
        statusHtml = `
          <div class="flex items-center justify-center gap-1 flex-wrap" title="Solved by: ${status.solvedBy.join(', ')}">
            <i class="fa-solid fa-circle-check text-emerald-400 text-xs"></i>
            <span class="text-[10px] text-emerald-300 font-bold font-mono">${status.solvedBy.length}/${state.handles.length}</span>
          </div>
        `;
      } else if (status.attemptedBy.length > 0) {
        rowClass += ' row-attempted';
        statusHtml = `
          <div class="flex items-center justify-center gap-1" title="Attempted by: ${status.attemptedBy.join(', ')}">
            <i class="fa-solid fa-triangle-exclamation text-amber-400 text-xs"></i>
            <span class="text-[10px] text-amber-300 font-mono">WA</span>
          </div>
        `;
      } else {
        statusHtml = '<span class="text-gray-500 font-mono text-[10px]">Unsolved</span>';
      }
    }

    // Length visual indicator
    let lenBadgeClass = 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
    if (prob.length > 1000) lenBadgeClass = 'text-rose-400 bg-rose-950/40 border-rose-800/40';
    else if (prob.length > 500) lenBadgeClass = 'text-amber-400 bg-amber-950/40 border-amber-800/40';

    // Tags list
    const tagsHtml = prob.tags.map(t => `
      <span class="problem-tag px-1.5 py-0.5 rounded bg-[#172236] hover:bg-[#20304c] text-[10px] text-gray-300 border border-[#25344d] cursor-pointer inline-block" data-tag="${t}">
        ${t}
      </span>
    `).join(' ');

    return `
      <tr class="${rowClass} border-b border-[#182338]">
        <td class="py-3 px-3 text-center text-gray-500 font-mono text-[11px]">${startIndex + idx + 1}</td>
        
        <td class="py-3 px-3 font-mono font-bold text-cyan-400">
          <a href="${cfUrl}" target="_blank" class="hover:underline flex items-center gap-1" title="Open on Codeforces">
            <span>${prob.contestId}${prob.index}</span>
            <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-70"></i>
          </a>
        </td>

        <td class="py-3 px-4 font-semibold text-gray-100 max-w-xs">
          <a href="${cfUrl}" target="_blank" class="hover:text-cyan-400 transition-colors line-clamp-1" title="${prob.name}">
            ${prob.name}
          </a>
        </td>

        <td class="py-3 px-3 text-center">
          ${getRatingBadgeHtml(prob.rating)}
        </td>

        <td class="py-3 px-3 text-center font-mono">
          <span class="font-bold text-gray-200">${prob.solvedCount.toLocaleString()}</span>
          <div class="w-16 h-1 bg-gray-800 rounded-full mx-auto mt-1 overflow-hidden">
            <div class="h-full bg-amber-500 rounded-full" style="width: ${Math.min(100, (prob.solvedCount / 3000) * 100)}%"></div>
          </div>
        </td>

        <td class="py-3 px-3 text-center font-mono">
          <span class="px-2 py-0.5 rounded border text-[11px] font-bold ${lenBadgeClass}">
            ${prob.length} <span class="text-[9px] font-normal opacity-70">chars</span>
          </span>
          <div class="text-[10px] text-gray-500 mt-0.5">${getReadingTime(prob.words)}</div>
        </td>

        <td class="py-3 px-3 text-center font-mono text-gray-300">
          ${prob.words}
        </td>

        <td class="py-3 px-4">
          <div class="flex flex-wrap gap-1">
            ${tagsHtml || '<span class="text-gray-600 italic text-[10px]">No tags</span>'}
          </div>
        </td>

        <td class="py-3 px-3 text-center">
          ${statusHtml}
        </td>

        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button class="btn-toggle-star p-1 text-xs cursor-pointer ${isStarred ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}" data-id="${prob.id}" title="${isStarred ? 'Unstar' : 'Star for practice'}">
              <i class="fa-${isStarred ? 'solid' : 'regular'} fa-star"></i>
            </button>
            <button class="btn-open-notes p-1 text-xs cursor-pointer ${hasNote ? 'text-cyan-400' : 'text-gray-500 hover:text-cyan-400'}" data-id="${prob.id}" data-name="${prob.name}" title="${hasNote ? 'Edit Notes' : 'Add Note'}">
              <i class="fa-regular fa-note-sticky"></i>
            </button>
            <a href="${cfUrl}" target="_blank" class="p-1 text-gray-500 hover:text-cyan-400 text-xs" title="Open Codeforces">
              <i class="fa-solid fa-external-link"></i>
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachRowActionListeners(tbody);
}

function renderGridView(items) {
  const container = document.getElementById('grid-view-container');
  if (!container) return;

  container.innerHTML = items.map(prob => {
    const cfUrl = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
    const status = getProblemStatus(prob);
    const isStarred = state.starredProblems.has(prob.id);
    const hasNote = !!state.notes[prob.id];

    let borderClass = 'border-[#1f293d]';
    if (status.isSolvedAny) borderClass = 'border-emerald-600/40 bg-emerald-950/10';

    return `
      <div class="bg-[#111827] rounded-xl p-4 border ${borderClass} glow-card flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="font-mono text-cyan-400 font-bold text-xs">${prob.contestId}${prob.index}</span>
            <div class="flex items-center gap-1.5">
              ${getRatingBadgeHtml(prob.rating)}
              <button class="btn-toggle-star text-xs cursor-pointer ${isStarred ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}" data-id="${prob.id}">
                <i class="fa-${isStarred ? 'solid' : 'regular'} fa-star"></i>
              </button>
            </div>
          </div>

          <h4 class="font-bold text-sm text-gray-100 hover:text-cyan-400 transition-colors line-clamp-1 mb-2">
            <a href="${cfUrl}" target="_blank">${prob.name}</a>
          </h4>

          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-400 bg-[#0a0e17] p-2 rounded-lg border border-[#1b2538] mb-3">
            <div><i class="fa-solid fa-text-width text-cyan-400 mr-1"></i>${prob.length} chars (${prob.words} words)</div>
            <div><i class="fa-solid fa-trophy text-amber-400 mr-1"></i>${prob.solvedCount.toLocaleString()} solves</div>
          </div>

          <div class="flex flex-wrap gap-1">
            ${prob.tags.map(t => `
              <span class="problem-tag px-1.5 py-0.5 rounded bg-[#172236] text-[10px] text-gray-300 border border-[#25344d] cursor-pointer" data-tag="${t}">
                ${t}
              </span>
            `).join('')}
          </div>
        </div>

        <div class="pt-3 border-t border-[#1f293d] flex items-center justify-between text-xs">
          <div>
            ${status.solvedBy.length > 0 ? `
              <span class="text-emerald-400 font-bold font-mono text-[11px] flex items-center gap-1">
                <i class="fa-solid fa-circle-check"></i> Solved (${status.solvedBy.join(', ')})
              </span>
            ` : `
              <span class="text-gray-500 font-mono text-[11px]">Unsolved</span>
            `}
          </div>

          <div class="flex items-center gap-2">
            <button class="btn-open-notes text-gray-400 hover:text-cyan-400 cursor-pointer text-xs" data-id="${prob.id}" data-name="${prob.name}">
              <i class="fa-regular fa-note-sticky ${hasNote ? 'text-cyan-400' : ''}"></i>
            </button>
            <a href="${cfUrl}" target="_blank" class="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-[11px] font-semibold transition-all">
              Solve <i class="fa-solid fa-arrow-up-right-from-square text-[9px] ml-0.5"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  attachRowActionListeners(container);
}

function attachRowActionListeners(container) {
  // Star button
  container.querySelectorAll('.btn-toggle-star').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      if (state.starredProblems.has(id)) {
        state.starredProblems.delete(id);
        showToast('Removed from bookmarks', 'info');
      } else {
        state.starredProblems.add(id);
        showToast('Saved to bookmarks', 'success');
      }
      saveLocalStorage('cf_arena_starred', Array.from(state.starredProblems));
      document.getElementById('starred-badge').textContent = state.starredProblems.size;
      renderProblemList();
    });
  });

  // Notes button
  container.querySelectorAll('.btn-open-notes').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      openNotesModal(id, name);
    });
  });

  // Click tag to filter
  container.querySelectorAll('.problem-tag').forEach(tagEl => {
    tagEl.addEventListener('click', (e) => {
      e.preventDefault();
      const tag = tagEl.getAttribute('data-tag');
      toggleTag(tag);
      showToast(`Filtering by tag: "${tag}"`, 'info');
    });
  });
}

// Pagination Controls
function renderPagination() {
  const container = document.getElementById('pagination-controls');
  if (!container) return;

  const totalPages = Math.ceil(state.filteredProblems.length / state.pageSize) || 1;
  document.getElementById('current-page-num').textContent = state.currentPage;
  document.getElementById('total-pages-num').textContent = totalPages;

  let html = '';
  // Prev button
  html += `
    <button class="page-btn p-1.5 px-3 rounded-lg border border-[#27364f] text-xs font-mono ${state.currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#1a2333] cursor-pointer'}" data-page="${state.currentPage - 1}" ${state.currentPage === 1 ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page numbers logic
  const maxButtons = 5;
  let start = Math.max(1, state.currentPage - 2);
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) {
    start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
    html += `<button class="page-btn px-3 py-1 rounded-lg border border-[#27364f] text-xs font-mono hover:bg-[#1a2333] cursor-pointer" data-page="1">1</button>`;
    if (start > 2) html += `<span class="px-1 text-gray-600">...</span>`;
  }

  for (let i = start; i <= end; i++) {
    const isActive = i === state.currentPage;
    html += `
      <button class="page-btn px-3 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-all ${isActive ? 'bg-cyan-600 border-cyan-500 text-white' : 'border-[#27364f] text-gray-300 hover:bg-[#1a2333]'}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="px-1 text-gray-600">...</span>`;
    html += `<button class="page-btn px-3 py-1 rounded-lg border border-[#27364f] text-xs font-mono hover:bg-[#1a2333] cursor-pointer" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next button
  html += `
    <button class="page-btn p-1.5 px-3 rounded-lg border border-[#27364f] text-xs font-mono ${state.currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#1a2333] cursor-pointer'}" data-page="${state.currentPage + 1}" ${state.currentPage === totalPages ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.getAttribute('data-page'), 10);
      if (page >= 1 && page <= totalPages) {
        state.currentPage = page;
        renderProblemList();
        renderPagination();
        window.scrollTo({ top: 350, behavior: 'smooth' });
      }
    });
  });
}

// Global Stats & Status Filter Counts
function updateGlobalStats() {
  document.getElementById('stat-total').textContent = state.allProblems.length;
  
  // Calculate total solved by union of active handles
  let solvedCount = 0;
  state.allProblems.forEach(p => {
    const st = getProblemStatus(p);
    if (st.isSolvedAny) solvedCount++;
  });

  const pct = ((solvedCount / (state.allProblems.length || 1)) * 100).toFixed(1);
  document.getElementById('stat-solved').textContent = solvedCount;
  document.getElementById('stat-solved-pct').textContent = `${pct}%`;

  updateStatusFilterCounts();
}

function updateStatusFilterCounts() {
  let countUnsolved = 0;
  let countSolvedAny = 0;
  let countSolvedAll = 0;
  let countAttempted = 0;

  state.allProblems.forEach(p => {
    const st = getProblemStatus(p);
    if (!st.isSolvedAny) countUnsolved++;
    if (st.isSolvedAny) countSolvedAny++;
    if (st.isSolvedAll) countSolvedAll++;
    if (st.isAttempted) countAttempted++;
  });

  document.getElementById('status-count-all').textContent = state.allProblems.length;
  document.getElementById('status-count-unsolved').textContent = countUnsolved;
  document.getElementById('status-count-solved-any').textContent = countSolvedAny;
  document.getElementById('status-count-solved-all').textContent = countSolvedAll;
  document.getElementById('status-count-attempted').textContent = countAttempted;
}

// Spoilers Toggle
function toggleSpoilers() {
  state.hideSpoilers = !state.hideSpoilers;
  if (state.hideSpoilers) {
    document.body.classList.add('spoilers-hidden');
    showToast('Tag spoilers hidden (simulate contest pressure)', 'info');
  } else {
    document.body.classList.remove('spoilers-hidden');
    showToast('Tags revealed', 'info');
  }
  saveLocalStorage('cf_arena_spoilers', state.hideSpoilers);
  updateSpoilerBtn();
}

function updateSpoilerBtn() {
  const icon = document.getElementById('spoiler-icon');
  const text = document.getElementById('spoiler-text');
  if (state.hideSpoilers) {
    icon.className = 'fa-solid fa-eye text-emerald-400';
    text.textContent = 'Show Tags';
  } else {
    icon.className = 'fa-solid fa-eye-slash text-amber-400';
    text.textContent = 'Hide Tags';
  }
}

// Roulette / Random Problem Picker Modal
function openRouletteModal() {
  const modal = document.getElementById('modal-roulette');
  modal.classList.remove('hidden');
  spinRoulette();
}

function spinRoulette() {
  // Filter for unsolved from currently filtered set if possible
  let pool = state.filteredProblems;
  if (state.handles.length > 0) {
    const unsolvedPool = pool.filter(p => !getProblemStatus(p).isSolvedAny);
    if (unsolvedPool.length > 0) pool = unsolvedPool;
  }

  if (pool.length === 0) {
    showToast('No problems available to roll in current filter', 'error');
    return;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  // Animate slot
  const card = document.getElementById('roulette-card');
  card.classList.add('animate-subtle-pulse');

  setTimeout(() => {
    card.classList.remove('animate-subtle-pulse');
    document.getElementById('roulette-id').textContent = `${chosen.contestId}${chosen.index}`;
    document.getElementById('roulette-name').textContent = chosen.name;
    document.getElementById('roulette-rating').innerHTML = getRatingBadgeHtml(chosen.rating);
    document.getElementById('roulette-length').textContent = `${chosen.length} chars (${chosen.words} words)`;
    document.getElementById('roulette-solves').textContent = `${chosen.solvedCount.toLocaleString()} solves`;

    const tagsContainer = document.getElementById('roulette-tags');
    tagsContainer.innerHTML = chosen.tags.map(t => `<span class="problem-tag px-1.5 py-0.5 rounded bg-[#172236] border border-[#25344d] text-gray-300">${t}</span>`).join(' ');

    const openBtn = document.getElementById('btn-roulette-open');
    openBtn.href = `https://codeforces.com/contest/${chosen.contestId}/problem/${chosen.index}`;
    openBtn.classList.remove('pointer-events-none', 'opacity-50');

    // Confetti effect
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  }, 350);
}

// Virtual Mashup Contest Builder
function openMashupModal() {
  document.getElementById('modal-mashup').classList.remove('hidden');
}

function generateMashupSet() {
  const template = document.getElementById('mashup-template').value;
  const lengthPref = document.getElementById('mashup-length-pref').value;
  const duration = parseInt(document.getElementById('mashup-duration').value, 10);

  // Target ratings per template
  let targetRatings = [2800, 3000, 3200];
  if (template === '3_hard') targetRatings = [3000, 3200, 3400];
  else if (template === '4_grandmaster') targetRatings = [2800, 2900, 3100, 3300];
  else if (template === '5_tourist') targetRatings = [2800, 2900, 3100, 3300, 3500];

  // Candidates: prefer unsolved by all handles
  const selectedProblems = [];
  targetRatings.forEach(rating => {
    let pool = state.allProblems.filter(p => p.rating === rating);
    if (state.handles.length > 0) {
      const unsolved = pool.filter(p => !getProblemStatus(p).isSolvedAny);
      if (unsolved.length > 0) pool = unsolved;
    }
    if (lengthPref === 'short') {
      const shortPool = pool.filter(p => p.length < 500);
      if (shortPool.length > 0) pool = shortPool;
    } else if (lengthPref === 'med') {
      const medPool = pool.filter(p => p.length < 1000);
      if (medPool.length > 0) pool = medPool;
    }

    if (pool.length > 0) {
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      selectedProblems.push(chosen);
    }
  });

  state.mashup.problems = selectedProblems;
  state.mashup.timerSeconds = duration;
  state.mashup.isPaused = false;

  // Render mashup problems list
  const listEl = document.getElementById('mashup-problems-list');
  const letterLabels = ['A', 'B', 'C', 'D', 'E'];

  listEl.innerHTML = selectedProblems.map((prob, idx) => {
    const cfUrl = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
    const status = getProblemStatus(prob);

    return `
      <div class="bg-[#0b101c] p-3 rounded-xl border border-[#1e2a40] flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <span class="w-7 h-7 rounded-lg bg-amber-600/20 text-amber-300 font-bold font-mono flex items-center justify-center border border-amber-500/40">${letterLabels[idx]}</span>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-white">${prob.name}</span>
              ${getRatingBadgeHtml(prob.rating)}
            </div>
            <div class="text-[10px] text-gray-400 font-mono">
              CF-${prob.contestId}${prob.index} • ${prob.length} chars • ${prob.solvedCount} solves
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${status.solvedBy.length > 0 ? `
            <span class="text-emerald-400 font-mono font-bold text-[11px]"><i class="fa-solid fa-circle-check"></i> Solved</span>
          ` : `
            <a href="${cfUrl}" target="_blank" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer">
              Open Problem <i class="fa-solid fa-arrow-up-right-from-square text-[9px] ml-1"></i>
            </a>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Setup Timer Box
  const timerBox = document.getElementById('mashup-timer-box');
  timerBox.classList.remove('hidden');
  startMashupTimer();
  showToast('Generated mashup contest set!', 'success');
}

function startMashupTimer() {
  if (state.mashup.intervalId) clearInterval(state.mashup.intervalId);

  updateTimerDisplay();
  state.mashup.intervalId = setInterval(() => {
    if (!state.mashup.isPaused && state.mashup.timerSeconds > 0) {
      state.mashup.timerSeconds--;
      updateTimerDisplay();
      if (state.mashup.timerSeconds === 0) {
        clearInterval(state.mashup.intervalId);
        showToast('Mashup Contest Time is UP! Great effort!', 'info');
      }
    }
  }, 1000);
}

function updateTimerDisplay() {
  const sec = state.mashup.timerSeconds;
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  document.getElementById('mashup-timer-display').textContent = `${h}:${m}:${s}`;
}

// Analytics Modal & Charts
let ratingsChart = null;
let tagsChart = null;

function openAnalyticsModal() {
  const modal = document.getElementById('modal-analytics');
  modal.classList.remove('hidden');
  renderAnalyticsCharts();
}

function renderAnalyticsCharts() {
  // 1. Rating Distribution Chart
  const ratings = [2800, 2900, 3000, 3100, 3200, 3300, 3400, 3500];
  const totalByRating = ratings.map(r => state.allProblems.filter(p => p.rating === r).length);
  const solvedByRating = ratings.map(r => state.allProblems.filter(p => p.rating === r && getProblemStatus(p).isSolvedAny).length);

  const ctxRating = document.getElementById('chart-ratings');
  if (ctxRating) {
    if (ratingsChart) ratingsChart.destroy();
    ratingsChart = new Chart(ctxRating, {
      type: 'bar',
      data: {
        labels: ratings.map(r => `${r}`),
        datasets: [
          {
            label: 'Total Problems',
            data: totalByRating,
            backgroundColor: 'rgba(239, 68, 68, 0.35)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Solved by Active Handles',
            data: solvedByRating,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Fira Code', size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { family: 'Fira Code' } }, grid: { color: '#1f293d' } },
          y: { ticks: { color: '#9ca3af', font: { family: 'Fira Code' } }, grid: { color: '#1f293d' } }
        }
      }
    });
  }

  // 2. Top Tags Chart
  const topTags = Object.entries(state.tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const ctxTags = document.getElementById('chart-tags');
  if (ctxTags) {
    if (tagsChart) tagsChart.destroy();
    tagsChart = new Chart(ctxTags, {
      type: 'bar',
      data: {
        labels: topTags.map(t => t[0]),
        datasets: [{
          label: 'Problems Count',
          data: topTags.map(t => t[1]),
          backgroundColor: 'rgba(6, 182, 212, 0.65)',
          borderColor: '#06b6d4',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: '#9ca3af', font: { family: 'Fira Code' } }, grid: { color: '#1f293d' } },
          y: { ticks: { color: '#9ca3af', font: { family: 'Fira Code', size: 10 } }, grid: { color: '#1f293d' } }
        }
      }
    });
  }

  // 3. Handles Comparison Table
  const tableEl = document.getElementById('analytics-handles-table');
  if (tableEl) {
    if (state.handles.length === 0) {
      tableEl.innerHTML = '<div class="text-gray-500 italic py-2">Add handles to see comparative performance.</div>';
    } else {
      tableEl.innerHTML = `
        <table class="w-full text-left font-mono">
          <thead>
            <tr class="border-b border-[#27364f] text-gray-400">
              <th class="py-2">Handle</th>
              <th class="py-2">Current Rating</th>
              <th class="py-2">Rank</th>
              <th class="py-2 text-center">2800-3500 Solved</th>
              <th class="py-2 text-center">Solve %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#1e2a40]">
            ${state.handles.map(h => {
              const k = h.toLowerCase();
              const info = state.handlesData[k]?.info || {};
              const solved = get2800SolvedCount(k);
              const pct = ((solved / state.allProblems.length) * 100).toFixed(1);
              return `
                <tr>
                  <td class="py-2 text-white font-bold">${h}</td>
                  <td class="py-2 text-rose-400 font-bold">${info.rating || '---'}</td>
                  <td class="py-2 text-gray-300 capitalize">${info.rank || '---'}</td>
                  <td class="py-2 text-center text-emerald-400 font-bold">${solved}</td>
                  <td class="py-2 text-center text-cyan-400">${pct}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }
}

// Notes Modal
let activeNotesProblemId = null;

function openNotesModal(probId, probName) {
  activeNotesProblemId = probId;
  document.getElementById('notes-problem-id').textContent = `Problem ID: ${probId}`;
  document.getElementById('notes-problem-title').textContent = probName || 'Problem Notes';
  document.getElementById('notes-textarea').value = state.notes[probId] || '';
  document.getElementById('modal-notes').classList.remove('hidden');
}

function saveActiveNotes() {
  if (!activeNotesProblemId) return;
  const noteText = document.getElementById('notes-textarea').value.trim();
  if (noteText) {
    state.notes[activeNotesProblemId] = noteText;
  } else {
    delete state.notes[activeNotesProblemId];
  }
  saveLocalStorage('cf_arena_notes', state.notes);
  document.getElementById('modal-notes').classList.add('hidden');
  renderProblemList();
  showToast('Note saved successfully', 'success');
}

// Export Engine
function openExportModal() {
  document.getElementById('export-count').textContent = state.filteredProblems.length;
  document.getElementById('modal-export').classList.remove('hidden');
}

function exportCSV() {
  const headers = ['ID', 'ContestId', 'Index', 'Name', 'Rating', 'SolvedCount', 'LengthChars', 'Words', 'Tags', 'SolvedStatus', 'CF_URL'];
  const rows = state.filteredProblems.map(p => {
    const status = getProblemStatus(p);
    const solvedStr = status.solvedBy.length > 0 ? `Solved (${status.solvedBy.join(';')})` : 'Unsolved';
    const cfUrl = `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`;
    return [
      `"${p.id}"`,
      p.contestId,
      `"${p.index}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      p.rating,
      p.solvedCount,
      p.length,
      p.words,
      `"${p.tags.join(';')}"`,
      `"${solvedStr}"`,
      `"${cfUrl}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cf_2800_3500_problems_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded CSV export', 'success');
}

function exportURLs() {
  const urls = state.filteredProblems.map(p => `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`).join('\n');
  navigator.clipboard.writeText(urls).then(() => {
    showToast(`Copied ${state.filteredProblems.length} URLs to clipboard!`, 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
}

function exportJSON() {
  const jsonStr = JSON.stringify(state.filteredProblems, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cf_2800_3500_filtered_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded JSON export', 'success');
}

// Reset All Filters
function resetAllFilters() {
  state.searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('btn-clear-search').classList.add('hidden');

  state.selectedRating = 'all';
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-rating') === 'all');
    btn.classList.toggle('bg-red-600', btn.getAttribute('data-rating') === 'all');
    btn.classList.toggle('text-white', btn.getAttribute('data-rating') === 'all');
  });

  state.selectedTags.clear();
  renderTagChips();

  state.lengthRange.max = 5910;
  document.getElementById('length-max-slider').value = 5910;
  document.getElementById('length-label').textContent = 'Any (77 - 5910 chars)';

  state.solvesRange.min = 0;
  document.getElementById('solves-min-slider').value = 0;
  document.getElementById('solves-label').textContent = 'Any (0 - 4097)';

  state.statusFilter = 'all';
  document.querySelectorAll('.status-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-status') === 'all');
    btn.classList.toggle('bg-cyan-600', btn.getAttribute('data-status') === 'all');
  });

  state.starredOnly = false;
  document.getElementById('btn-starred-filter').classList.remove('bg-yellow-600', 'text-white');

  applyFiltersAndSort();
  showToast('Reset all filters to default', 'info');
}

// Event Listeners Binding
function setupEventListeners() {
  // Add Handle Form
  const handleInput = document.getElementById('handle-input');
  const btnAddHandle = document.getElementById('btn-add-handle');

  const submitHandle = () => {
    const val = handleInput.value;
    if (val.includes(',')) {
      val.split(',').forEach(h => addHandle(h));
    } else {
      addHandle(val);
    }
  };

  btnAddHandle.addEventListener('click', submitHandle);
  handleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitHandle();
  });

  // Preset handle clicks
  document.querySelectorAll('.preset-handle-btn').forEach(btn => {
    btn.addEventListener('click', () => addHandle(btn.getAttribute('data-handle')));
  });

  // Solved Status Filter Pills
  document.querySelectorAll('.status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-pill').forEach(b => {
        b.classList.remove('active', 'bg-cyan-600', 'text-white');
        b.classList.add('bg-[#1a2333]', 'text-gray-300');
      });
      btn.classList.add('active', 'bg-cyan-600', 'text-white');
      btn.classList.remove('bg-[#1a2333]', 'text-gray-300');
      
      state.statusFilter = btn.getAttribute('data-status');
      applyFiltersAndSort();
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearSearchBtn.classList.toggle('hidden', !e.target.value);
    applyFiltersAndSort();
  });
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    applyFiltersAndSort();
  });

  // Rating buttons
  document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rating-btn').forEach(b => {
        b.classList.remove('active', 'bg-red-600', 'text-white');
        b.classList.add('bg-[#172236]');
      });
      btn.classList.add('active', 'bg-red-600', 'text-white');
      btn.classList.remove('bg-[#172236]');
      
      state.selectedRating = btn.getAttribute('data-rating');
      applyFiltersAndSort();
    });
  });

  // Sort dropdown
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    applyFiltersAndSort();
  });

  // Table header clicks for sorting
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.getAttribute('data-sort');
      // Toggle direction if already active
      if (state.currentSort === sortKey) {
        state.currentSort = sortKey.endsWith('_asc') ? sortKey.replace('_asc', '_desc') : sortKey.replace('_desc', '_asc');
      } else {
        state.currentSort = sortKey;
      }
      sortSelect.value = state.currentSort;
      applyFiltersAndSort();
    });
  });

  // Length slider & presets
  const lenSlider = document.getElementById('length-max-slider');
  lenSlider.addEventListener('input', (e) => {
    state.lengthRange.max = parseInt(e.target.value, 10);
    document.getElementById('length-label').textContent = `< ${state.lengthRange.max} chars`;
    applyFiltersAndSort();
  });

  document.querySelectorAll('.len-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-reset')) {
        lenSlider.value = 5910;
        state.lengthRange.max = 5910;
        document.getElementById('length-label').textContent = 'Any (77 - 5910 chars)';
      } else {
        const max = parseInt(btn.getAttribute('data-max') || '5910', 10);
        lenSlider.value = max;
        state.lengthRange.max = max;
        document.getElementById('length-label').textContent = `< ${max} chars`;
      }
      applyFiltersAndSort();
    });
  });

  // Solves slider & presets
  const solvesSlider = document.getElementById('solves-min-slider');
  solvesSlider.addEventListener('input', (e) => {
    state.solvesRange.min = parseInt(e.target.value, 10);
    document.getElementById('solves-label').textContent = `≥ ${state.solvesRange.min} solves`;
    applyFiltersAndSort();
  });

  document.querySelectorAll('.solves-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.getAttribute('data-reset')) {
        solvesSlider.value = 0;
        state.solvesRange.min = 0;
        document.getElementById('solves-label').textContent = 'Any (0 - 4097)';
      } else {
        const min = parseInt(btn.getAttribute('data-min') || '0', 10);
        solvesSlider.value = min;
        state.solvesRange.min = min;
        document.getElementById('solves-label').textContent = `≥ ${min} solves`;
      }
      applyFiltersAndSort();
    });
  });

  // Tag search & Tag modes
  document.getElementById('tag-search-input')?.addEventListener('input', (e) => {
    renderTagChips(e.target.value);
  });

  document.getElementById('btn-clear-tags')?.addEventListener('click', () => {
    state.selectedTags.clear();
    renderTagChips();
    applyFiltersAndSort();
  });

  ['or', 'and', 'not'].forEach(mode => {
    document.getElementById(`tag-mode-${mode}`)?.addEventListener('click', (e) => {
      document.querySelectorAll('.tag-mode-btn').forEach(b => {
        b.classList.remove('active', 'bg-cyan-600', 'text-white');
        b.classList.add('text-gray-400');
      });
      e.target.classList.add('active', 'bg-cyan-600', 'text-white');
      e.target.classList.remove('text-gray-400');
      state.tagFilterMode = mode;
      renderTagChips();
      applyFiltersAndSort();
    });
  });

  // View switchers
  const viewTableBtn = document.getElementById('view-table-btn');
  const viewGridBtn = document.getElementById('view-grid-btn');
  viewTableBtn.addEventListener('click', () => {
    state.viewMode = 'table';
    viewTableBtn.classList.add('bg-cyan-600', 'text-white');
    viewTableBtn.classList.remove('text-gray-400');
    viewGridBtn.classList.remove('bg-cyan-600', 'text-white');
    viewGridBtn.classList.add('text-gray-400');
    document.getElementById('table-view-container').classList.remove('hidden');
    document.getElementById('grid-view-container').classList.add('hidden');
    renderProblemList();
  });

  viewGridBtn.addEventListener('click', () => {
    state.viewMode = 'grid';
    viewGridBtn.classList.add('bg-cyan-600', 'text-white');
    viewGridBtn.classList.remove('text-gray-400');
    viewTableBtn.classList.remove('bg-cyan-600', 'text-white');
    viewTableBtn.classList.add('text-gray-400');
    document.getElementById('grid-view-container').classList.remove('hidden');
    document.getElementById('table-view-container').classList.add('hidden');
    renderProblemList();
  });

  // Page size select
  document.getElementById('page-size-select').addEventListener('change', (e) => {
    state.pageSize = parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderProblemList();
    renderPagination();
  });

  // Action buttons in Top Nav
  document.getElementById('btn-toggle-spoilers').addEventListener('click', toggleSpoilers);
  document.getElementById('btn-roulette').addEventListener('click', openRouletteModal);
  document.getElementById('btn-mashup').addEventListener('click', openMashupModal);
  document.getElementById('btn-analytics').addEventListener('click', openAnalyticsModal);
  document.getElementById('btn-export-modal').addEventListener('click', openExportModal);

  // Starred filter button in Nav
  const btnStarred = document.getElementById('btn-starred-filter');
  btnStarred.addEventListener('click', () => {
    state.starredOnly = !state.starredOnly;
    btnStarred.classList.toggle('bg-yellow-600', state.starredOnly);
    btnStarred.classList.toggle('text-white', state.starredOnly);
    applyFiltersAndSort();
  });

  // Modals close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop').classList.add('hidden');
    });
  });

  // Modal backdrop click to close
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Roulette buttons
  document.getElementById('btn-spin-again')?.addEventListener('click', spinRoulette);

  // Mashup buttons
  document.getElementById('btn-generate-mashup')?.addEventListener('click', generateMashupSet);
  document.getElementById('btn-toggle-timer')?.addEventListener('click', (e) => {
    state.mashup.isPaused = !state.mashup.isPaused;
    e.target.textContent = state.mashup.isPaused ? 'Resume' : 'Pause';
  });

  // Notes Save
  document.getElementById('btn-save-notes')?.addEventListener('click', saveActiveNotes);

  // Export buttons
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);
  document.getElementById('btn-export-urls')?.addEventListener('click', exportURLs);
  document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);

  // Reset Filters Button
  document.getElementById('btn-reset-all-filters')?.addEventListener('click', resetAllFilters);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Focus search on '/'
    if (e.key === '/' && document.activeElement !== searchInput && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      searchInput.focus();
    }
    // 'r' for roulette
    if ((e.key === 'r' || e.key === 'R') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openRouletteModal();
    }
    // 'h' for spoiler toggle
    if ((e.key === 'h' || e.key === 'H') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      toggleSpoilers();
    }
    // Escape to close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    }
  });

  // Keyboard shortcuts popup
  document.getElementById('btn-keyboard-help')?.addEventListener('click', () => {
    showToast('Shortcuts: [/] Search • [R] Roulette • [H] Hide Tags • [Esc] Close Modals', 'info');
  });
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadProblems();
});
