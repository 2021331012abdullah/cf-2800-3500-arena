/**
 * CF 2800-3500 Arena - Modern, Clean & Mobile-Friendly Core
 */

// Application State
const state = {
  allProblems: [],
  filteredProblems: [],
  uniqueTags: [],
  tagCounts: {},
  
  // Handles & Codeforces Sync
  handles: [],
  handlesData: {}, // { handle: { info: {}, solvedSet: Set(), attemptedSet: Set(), loading: bool } }
  
  // Active Filters
  searchQuery: '',
  selectedRating: 'all',
  selectedTags: new Set(),
  tagFilterMode: 'or', // 'or' | 'and' | 'not'
  lengthMax: 5910,
  solvesMin: 0,
  statusFilter: 'all', // 'all' | 'unsolved_all' | 'solved_any' | 'attempted'
  starredOnly: false,
  
  // Sorting & Pagination
  currentSort: 'length_asc',
  currentPage: 1,
  pageSize: 48,
  
  // UI Settings
  viewMode: 'grid', // 'grid' | 'table'
  hideSpoilers: false,
  starredProblems: new Set(),
  notes: {}, // { problemId: text }

  // Virtual Mashup
  mashup: {
    problems: [],
    timerSeconds: 7200,
    intervalId: null,
    isPaused: true
  }
};

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-900/90 border-emerald-600 text-emerald-200' :
                  type === 'error' ? 'bg-rose-900/90 border-rose-600 text-rose-200' :
                  'bg-cyan-900/90 border-cyan-600 text-cyan-200';
  
  toast.className = `p-2.5 px-3 rounded-xl border text-xs shadow-xl backdrop-blur-md transition-all duration-300 flex items-center gap-2 ${bgClass}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-400' : type === 'error' ? 'fa-circle-exclamation text-rose-400' : 'fa-circle-info text-cyan-400'}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// Reading time calculator
function getReadingTime(words) {
  const mins = words / 150;
  if (mins < 0.5) return `${Math.max(5, Math.round(words / 3.5))}s read`;
  return `${Math.ceil(mins)}m read`;
}

// Rating badge HTML
function getRatingBadge(rating) {
  const cls = rating >= 3000 ? 'badge-lgm' : 'badge-gm';
  return `<span class="px-2 py-0.5 rounded-lg font-mono text-xs ${cls}">${rating}</span>`;
}

// Problem Status Evaluator
function getProblemStatus(prob) {
  if (state.handles.length === 0) {
    return { solvedBy: [], attemptedBy: [], isSolvedAny: false, isAttempted: false };
  }

  const k1 = `${prob.contestId}${prob.index}`;
  const k2 = `${prob.contestId}_${prob.index}`;
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
    isSolvedAny: solvedBy.length > 0,
    isAttempted: attemptedBy.length > 0 && solvedBy.length === 0
  };
}

// Load Problems Data
async function loadProblems() {
  if (window.CF_PROBLEMS_DATA && Array.isArray(window.CF_PROBLEMS_DATA)) {
    state.allProblems = window.CF_PROBLEMS_DATA;
  } else {
    try {
      const res = await fetch('./cf_2800_3500_sorted.json');
      state.allProblems = await res.json();
    } catch (e) {
      console.error('Failed to load JSON directly, checking window.CF_PROBLEMS_DATA', e);
    }
  }

  // Extract Tags
  const tagCounts = {};
  state.allProblems.forEach(p => {
    p.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });
  state.tagCounts = tagCounts;
  state.uniqueTags = Object.keys(tagCounts).sort();

  // Load saved state
  loadLocalStorage();

  // Populate drawer tags
  renderDrawerTags();
  applyFiltersAndSort();

  // Sync handles if any exist
  if (state.handles.length > 0) {
    syncAllHandles();
  }
}

// LocalStorage Persistence
function loadLocalStorage() {
  try {
    const savedHandles = localStorage.getItem('cf_arena_handles');
    if (savedHandles) state.handles = JSON.parse(savedHandles);
    
    const savedStarred = localStorage.getItem('cf_arena_starred');
    if (savedStarred) {
      state.starredProblems = new Set(JSON.parse(savedStarred));
      document.getElementById('starred-badge').textContent = state.starredProblems.size;
    }
    
    const savedNotes = localStorage.getItem('cf_arena_notes');
    if (savedNotes) state.notes = JSON.parse(savedNotes);

    const savedSpoilers = localStorage.getItem('cf_arena_spoilers');
    if (savedSpoilers === 'true') {
      state.hideSpoilers = true;
      document.body.classList.add('spoilers-hidden');
      updateSpoilerIcon();
    }
  } catch (e) {
    console.error('Error loading localStorage', e);
  }
}

function saveLocalStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error saving localStorage', e);
  }
}

// Handle Management
async function addHandle(handleName) {
  const clean = handleName.trim();
  if (!clean) return;
  if (state.handles.some(h => h.toLowerCase() === clean.toLowerCase())) {
    showToast(`Handle "${clean}" already added`, 'info');
    return;
  }

  state.handles.push(clean);
  saveLocalStorage('cf_arena_handles', state.handles);
  document.getElementById('handle-input').value = '';

  renderHandleChips();
  await syncSingleHandle(clean);
}

function removeHandle(handleName) {
  state.handles = state.handles.filter(h => h.toLowerCase() !== handleName.toLowerCase());
  delete state.handlesData[handleName.toLowerCase()];
  saveLocalStorage('cf_arena_handles', state.handles);
  
  renderHandleChips();
  applyFiltersAndSort();
  showToast(`Removed handle "${handleName}"`, 'info');
}

async function syncAllHandles() {
  renderHandleChips();
  for (const h of state.handles) {
    await syncSingleHandle(h);
  }
}

async function syncSingleHandle(handle) {
  const key = handle.toLowerCase();
  if (!state.handlesData[key]) {
    state.handlesData[key] = {
      info: null,
      solvedSet: new Set(),
      attemptedSet: new Set(),
      loading: true
    };
  } else {
    state.handlesData[key].loading = true;
  }
  renderHandleChips();

  try {
    // 1. Fetch user.info
    const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
    const infoData = await infoRes.json();
    if (infoData.status === 'OK' && infoData.result?.length > 0) {
      state.handlesData[key].info = infoData.result[0];
    }

    // 2. Fetch submissions
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`);
    const statusData = await statusRes.json();
    
    if (statusData.status === 'OK' && Array.isArray(statusData.result)) {
      const solved = new Set();
      const attempted = new Set();
      
      statusData.result.forEach(sub => {
        if (sub.problem?.contestId && sub.problem?.index) {
          const k1 = `${sub.problem.contestId}${sub.problem.index}`;
          const k2 = `${sub.problem.contestId}_${sub.problem.index}`;
          if (sub.verdict === 'OK') {
            solved.add(k1);
            solved.add(k2);
          } else {
            attempted.add(k1);
            attempted.add(k2);
          }
        }
      });

      state.handlesData[key].solvedSet = solved;
      state.handlesData[key].attemptedSet = attempted;
      state.handlesData[key].loading = false;
      showToast(`Synced ${handle}`, 'success');
    }
  } catch (err) {
    console.error(`Error syncing handle ${handle}:`, err);
    state.handlesData[key].loading = false;
    showToast(`Could not sync ${handle}`, 'error');
  }

  renderHandleChips();
  applyFiltersAndSort();
}

function renderHandleChips() {
  const container = document.getElementById('active-handles-container');
  if (!container) return;

  if (state.handles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.handles.map(h => {
    const key = h.toLowerCase();
    const data = state.handlesData[key] || { loading: true };
    const rating = data.info?.rating || '---';

    return `
      <div class="inline-flex items-center gap-1.5 bg-[#090d16] px-2.5 py-1 rounded-xl border border-[#1c2638] text-xs font-mono">
        <span class="w-2 h-2 rounded-full ${data.loading ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}"></span>
        <span class="font-bold text-gray-200">${h}</span>
        <span class="text-[10px] text-gray-400">(${rating})</span>
        <button class="btn-remove-chip text-gray-500 hover:text-rose-400 ml-1 cursor-pointer" data-handle="${h}">
          <i class="fa-solid fa-xmark text-[10px]"></i>
        </button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-remove-chip').forEach(btn => {
    btn.addEventListener('click', () => removeHandle(btn.getAttribute('data-handle')));
  });
}

// Drawer Tags Rendering
function renderDrawerTags(searchQuery = '') {
  const container = document.getElementById('drawer-tags-cloud');
  if (!container) return;

  const filtered = state.uniqueTags.filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

  container.innerHTML = filtered.map(tag => {
    const isSelected = state.selectedTags.has(tag);
    const count = state.tagCounts[tag] || 0;
    
    let activeCls = 'bg-[#101623] text-gray-300 border-[#1c2638] hover:bg-[#161f31]';
    if (isSelected) {
      activeCls = state.tagFilterMode === 'not' 
        ? 'bg-rose-600 text-white border-rose-500' 
        : 'bg-cyan-600 text-white border-cyan-500';
    }

    return `
      <button 
        class="tag-drawer-pill px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1 ${activeCls}"
        data-tag="${tag}"
      >
        <span>${tag}</span>
        <span class="opacity-60 text-[10px]">(${count})</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.tag-drawer-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleTag(btn.getAttribute('data-tag'));
    });
  });

  document.getElementById('drawer-tag-count').textContent = state.selectedTags.size;
  renderActiveTagsStrip();
}

function toggleTag(tag) {
  if (state.selectedTags.has(tag)) {
    state.selectedTags.delete(tag);
  } else {
    state.selectedTags.add(tag);
  }
  renderDrawerTags(document.getElementById('drawer-tag-search')?.value || '');
  applyFiltersAndSort();
}

// Active tags strip below filter bar
function renderActiveTagsStrip() {
  const strip = document.getElementById('active-tags-strip');
  const pills = document.getElementById('active-tag-pills');
  const badge = document.getElementById('active-filters-badge');
  if (!strip || !pills) return;

  let activeCount = state.selectedTags.size;
  if (state.lengthMax < 5910) activeCount++;
  if (state.solvesMin > 0) activeCount++;

  if (activeCount > 0) {
    badge.textContent = activeCount;
    badge.classList.remove('hidden');
    strip.classList.remove('hidden');

    let html = Array.from(state.selectedTags).map(t => `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161f31] text-[11px] font-mono text-cyan-300 border border-[#1c2638]">
        ${t}
        <i class="fa-solid fa-xmark text-[9px] cursor-pointer hover:text-white" onclick="toggleTag('${t}')"></i>
      </span>
    `).join('');

    if (state.lengthMax < 5910) {
      html += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161f31] text-[11px] font-mono text-amber-300 border border-[#1c2638]">&lt;${state.lengthMax}c</span>`;
    }
    if (state.solvesMin > 0) {
      html += `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161f31] text-[11px] font-mono text-amber-300 border border-[#1c2638]">≥${state.solvesMin}s</span>`;
    }

    pills.innerHTML = html;
  } else {
    badge.classList.add('hidden');
    strip.classList.add('hidden');
    pills.innerHTML = '';
  }
}

// Filtering & Sorting
function applyFiltersAndSort() {
  const q = state.searchQuery.toLowerCase().trim();
  const rating = state.selectedRating;
  const tags = Array.from(state.selectedTags);
  const tagMode = state.tagFilterMode;
  const maxLen = state.lengthMax;
  const minSolves = state.solvesMin;
  const statusFilter = state.statusFilter;
  const starredOnly = state.starredOnly;

  state.filteredProblems = state.allProblems.filter(prob => {
    // Search
    if (q) {
      const matchName = prob.name.toLowerCase().includes(q);
      const matchId = prob.id.toLowerCase().includes(q);
      const matchContest = `${prob.contestId}${prob.index}`.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchContest) return false;
    }

    // Rating
    if (rating !== 'all' && prob.rating !== parseInt(rating, 10)) return false;

    // Length & Solves
    if (prob.length > maxLen) return false;
    if (prob.solvedCount < minSolves) return false;

    // Tags
    if (tags.length > 0) {
      const pTags = prob.tags || [];
      if (tagMode === 'or') {
        if (!tags.some(t => pTags.includes(t))) return false;
      } else if (tagMode === 'and') {
        if (!tags.every(t => pTags.includes(t))) return false;
      } else if (tagMode === 'not') {
        if (tags.some(t => pTags.includes(t))) return false;
      }
    }

    // Starred
    if (starredOnly && !state.starredProblems.has(prob.id)) return false;

    // Solved status
    if (state.handles.length > 0) {
      const st = getProblemStatus(prob);
      if (statusFilter === 'unsolved_all' && st.isSolvedAny) return false;
      if (statusFilter === 'solved_any' && !st.isSolvedAny) return false;
      if (statusFilter === 'attempted' && !st.isAttempted) return false;
    }

    return true;
  });

  // Sort
  sortProblems(state.filteredProblems, state.currentSort);

  // Reset pagination
  state.currentPage = 1;

  // Render
  renderProblems();
  renderPagination();
  renderActiveTagsStrip();
}

function sortProblems(list, sortKey) {
  list.sort((a, b) => {
    switch (sortKey) {
      case 'length_asc': return a.length - b.length || a.words - b.words;
      case 'length_desc': return b.length - a.length || b.words - a.words;
      case 'words_asc': return a.words - b.words || a.length - b.length;
      case 'words_desc': return b.words - a.words || b.length - a.length;
      case 'solves_desc': return b.solvedCount - a.solvedCount;
      case 'solves_asc': return a.solvedCount - b.solvedCount;
      case 'rating_desc': return b.rating - a.rating || b.solvedCount - a.solvedCount;
      case 'rating_asc': return a.rating - b.rating || b.solvedCount - a.solvedCount;
      case 'contest_desc': return b.contestId - a.contestId;
      case 'name_asc': return a.name.localeCompare(b.name);
      default: return a.length - b.length;
    }
  });
}

// Render Problems
function renderProblems() {
  const cardsContainer = document.getElementById('cards-container');
  const tableContainer = document.getElementById('table-container');
  const tableBody = document.getElementById('table-body');
  const emptyState = document.getElementById('empty-state');
  const total = state.filteredProblems.length;

  document.getElementById('showing-total').textContent = total;

  if (total === 0) {
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (tableBody) tableBody.innerHTML = '';
    emptyState?.classList.remove('hidden');
    document.getElementById('showing-range').textContent = '0 - 0';
    return;
  }

  emptyState?.classList.add('hidden');

  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, total);
  const pageItems = state.filteredProblems.slice(startIndex, endIndex);

  document.getElementById('showing-range').textContent = `${startIndex + 1} - ${endIndex}`;

  if (state.viewMode === 'grid') {
    cardsContainer?.classList.remove('hidden');
    tableContainer?.classList.add('hidden');
    renderCards(pageItems);
  } else {
    tableContainer?.classList.remove('hidden');
    cardsContainer?.classList.add('hidden');
    renderTable(pageItems, startIndex);
  }
}

// Render Mobile-Friendly Problem Cards
function renderCards(items) {
  const container = document.getElementById('cards-container');
  if (!container) return;

  container.innerHTML = items.map(prob => {
    const cfUrl = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
    const status = getProblemStatus(prob);
    const isStarred = state.starredProblems.has(prob.id);
    const hasNote = !!state.notes[prob.id];

    return `
      <div class="problem-card p-3.5 flex flex-col justify-between space-y-2.5 ${status.isSolvedAny ? 'card-solved' : ''}">
        
        <!-- Card Header -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <a href="${cfUrl}" target="_blank" class="font-mono text-cyan-400 font-bold text-xs flex items-center gap-1 hover:underline">
              <span>${prob.contestId}${prob.index}</span>
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-70"></i>
            </a>
            
            <div class="flex items-center gap-1.5">
              ${getRatingBadge(prob.rating)}
              <button class="btn-star text-xs cursor-pointer p-1 ${isStarred ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}" data-id="${prob.id}">
                <i class="fa-${isStarred ? 'solid' : 'regular'} fa-star"></i>
              </button>
            </div>
          </div>

          <h4 class="font-bold text-sm text-white line-clamp-1 hover:text-cyan-400 transition-colors">
            <a href="${cfUrl}" target="_blank">${prob.name}</a>
          </h4>
        </div>

        <!-- Meta Indicators -->
        <div class="flex items-center gap-2 text-[11px] font-mono text-gray-400">
          <span class="flex items-center gap-1">
            <i class="fa-solid fa-text-width text-cyan-400"></i> ${prob.length}c
          </span>
          <span>•</span>
          <span class="flex items-center gap-1">
            <i class="fa-solid fa-book-open text-gray-400"></i> ${prob.words}w (${getReadingTime(prob.words)})
          </span>
          <span>•</span>
          <span class="flex items-center gap-1">
            <i class="fa-solid fa-trophy text-amber-400"></i> ${prob.solvedCount.toLocaleString()}
          </span>
        </div>

        <!-- Solved Chip if any -->
        ${status.isSolvedAny ? `
          <div class="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
            <i class="fa-solid fa-circle-check text-emerald-400"></i>
            <span>Solved by ${status.solvedBy.join(', ')}</span>
          </div>
        ` : status.isAttempted ? `
          <div class="text-[11px] font-mono text-amber-400 flex items-center gap-1">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Attempted / WA</span>
          </div>
        ` : ''}

        <!-- Tags Row -->
        <div class="flex flex-wrap gap-1 pt-1">
          ${prob.tags.map(t => `
            <span class="problem-tag px-2 py-0.5 rounded-md bg-[#161f31] text-[10px] text-gray-300 border border-[#1c2638] cursor-pointer" data-tag="${t}">
              ${t}
            </span>
          `).join('')}
        </div>

        <!-- Card Footer Actions -->
        <div class="pt-2 border-t border-[#1c2638] flex items-center justify-between text-xs">
          <button class="btn-notes text-gray-400 hover:text-cyan-400 flex items-center gap-1 text-[11px] cursor-pointer" data-id="${prob.id}" data-name="${prob.name}">
            <i class="fa-regular fa-note-sticky ${hasNote ? 'text-cyan-400' : ''}"></i>
            <span>${hasNote ? 'Edit Note' : 'Add Note'}</span>
          </button>

          <a href="${cfUrl}" target="_blank" class="px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-xs font-semibold transition-all">
            Solve ↗
          </a>
        </div>

      </div>
    `;
  }).join('');

  attachProblemActionListeners(container);
}

// Render Table View (Alternative)
function renderTable(items, startIndex) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  tbody.innerHTML = items.map((prob, idx) => {
    const cfUrl = `https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}`;
    const status = getProblemStatus(prob);
    const isStarred = state.starredProblems.has(prob.id);

    return `
      <tr class="hover:bg-[#161f31] transition-colors">
        <td class="py-2.5 px-3 text-center text-gray-500 font-mono text-[11px]">${startIndex + idx + 1}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-cyan-400">
          <a href="${cfUrl}" target="_blank">${prob.contestId}${prob.index}</a>
        </td>
        <td class="py-2.5 px-4 font-semibold text-gray-200">
          <a href="${cfUrl}" target="_blank" class="hover:text-cyan-400 transition-colors">${prob.name}</a>
        </td>
        <td class="py-2.5 px-3 text-center">${getRatingBadge(prob.rating)}</td>
        <td class="py-2.5 px-3 text-center font-mono text-[11px] text-gray-300">${prob.length}c (${prob.words}w)</td>
        <td class="py-2.5 px-3 text-center font-mono text-[11px] text-amber-300">${prob.solvedCount.toLocaleString()}</td>
        <td class="py-2.5 px-4">
          <div class="flex flex-wrap gap-1">
            ${prob.tags.map(t => `<span class="problem-tag px-1.5 py-0.2 rounded bg-[#161f31] text-[10px] text-gray-300 border border-[#1c2638] cursor-pointer" data-tag="${t}">${t}</span>`).join('')}
          </div>
        </td>
        <td class="py-2.5 px-3 text-center font-mono text-[11px]">
          ${status.isSolvedAny ? `<span class="text-emerald-400 font-bold">✓</span>` : `<span class="text-gray-600">—</span>`}
        </td>
        <td class="py-2.5 px-3 text-center">
          <button class="btn-star text-xs cursor-pointer ${isStarred ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}" data-id="${prob.id}">
            <i class="fa-${isStarred ? 'solid' : 'regular'} fa-star"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachProblemActionListeners(tbody);
}

function attachProblemActionListeners(container) {
  container.querySelectorAll('.btn-star').forEach(btn => {
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
      renderProblems();
    });
  });

  container.querySelectorAll('.btn-notes').forEach(btn => {
    btn.addEventListener('click', () => {
      openNotesModal(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
    });
  });

  container.querySelectorAll('.problem-tag').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      toggleTag(tagEl.getAttribute('data-tag'));
      showToast(`Filter: "${tagEl.getAttribute('data-tag')}"`, 'info');
    });
  });
}

// Pagination Controls
function renderPagination() {
  const totalPages = Math.ceil(state.filteredProblems.length / state.pageSize) || 1;
  document.getElementById('current-page-display').textContent = state.currentPage;
  document.getElementById('total-pages-display').textContent = totalPages;

  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage === totalPages;
}

// Spoiler Toggle
function toggleSpoilers() {
  state.hideSpoilers = !state.hideSpoilers;
  document.body.classList.toggle('spoilers-hidden', state.hideSpoilers);
  saveLocalStorage('cf_arena_spoilers', state.hideSpoilers);
  updateSpoilerIcon();
  showToast(state.hideSpoilers ? 'Tags blurred' : 'Tags revealed', 'info');
}

function updateSpoilerIcon() {
  const icon = document.getElementById('spoiler-icon');
  icon.className = state.hideSpoilers ? 'fa-solid fa-eye text-emerald-400' : 'fa-solid fa-eye-slash text-amber-400';
}

// Roulette Modal
function openRoulette() {
  document.getElementById('modal-roulette').classList.remove('hidden');
  spinRoulette();
}

function spinRoulette() {
  let pool = state.filteredProblems;
  if (state.handles.length > 0) {
    const unsolved = pool.filter(p => !getProblemStatus(p).isSolvedAny);
    if (unsolved.length > 0) pool = unsolved;
  }

  if (pool.length === 0) {
    showToast('No problems available in current filter', 'error');
    return;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];

  document.getElementById('roulette-id').textContent = `CF-${chosen.contestId}${chosen.index}`;
  document.getElementById('roulette-title').textContent = chosen.name;
  document.getElementById('roulette-rating').innerHTML = getRatingBadge(chosen.rating);
  document.getElementById('roulette-len').textContent = `${chosen.length} chars (${chosen.words}w)`;
  document.getElementById('roulette-solves').textContent = `${chosen.solvedCount.toLocaleString()} solves`;

  document.getElementById('roulette-tags').innerHTML = chosen.tags.map(t => `<span class="px-1.5 py-0.5 rounded bg-[#161f31] border border-[#1c2638] text-gray-300">${t}</span>`).join(' ');

  document.getElementById('btn-roulette-cf').href = `https://codeforces.com/contest/${chosen.contestId}/problem/${chosen.index}`;

  if (typeof confetti === 'function') {
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
  }
}

// Virtual Mashup Contest
function openMashup() {
  document.getElementById('modal-mashup').classList.remove('hidden');
}

function generateMashup() {
  const tmpl = document.getElementById('mashup-template').value;
  const dur = parseInt(document.getElementById('mashup-duration').value, 10);

  let ratings = [2800, 3000, 3200];
  if (tmpl === '3_hard') ratings = [3000, 3200, 3400];
  else if (tmpl === '4_esc') ratings = [2800, 2900, 3100, 3300];

  const selected = [];
  ratings.forEach(r => {
    let pool = state.allProblems.filter(p => p.rating === r);
    if (state.handles.length > 0) {
      const unsolved = pool.filter(p => !getProblemStatus(p).isSolvedAny);
      if (unsolved.length > 0) pool = unsolved;
    }
    if (pool.length > 0) {
      selected.push(pool[Math.floor(Math.random() * pool.length)]);
    }
  });

  const listEl = document.getElementById('mashup-problems-list');
  const letters = ['A', 'B', 'C', 'D'];

  listEl.innerHTML = selected.map((prob, i) => `
    <div class="bg-[#090d16] p-2.5 rounded-xl border border-[#1c2638] flex items-center justify-between text-xs">
      <div class="flex items-center gap-2">
        <span class="w-6 h-6 rounded bg-amber-600/20 text-amber-400 font-bold font-mono flex items-center justify-center">${letters[i]}</span>
        <div>
          <span class="font-bold text-white">${prob.name}</span>
          <div class="text-[10px] text-gray-500 font-mono">CF-${prob.contestId}${prob.index} • ${prob.length}c</div>
        </div>
      </div>
      <a href="https://codeforces.com/contest/${prob.contestId}/problem/${prob.index}" target="_blank" class="px-2.5 py-1 bg-cyan-600 text-white rounded-lg text-[11px] font-semibold">
        Solve ↗
      </a>
    </div>
  `).join('');

  state.mashup.timerSeconds = dur;
  state.mashup.isPaused = false;
  document.getElementById('mashup-timer-box').classList.remove('hidden');
  startMashupTimer();
  showToast('Contest generated!', 'success');
}

function startMashupTimer() {
  if (state.mashup.intervalId) clearInterval(state.mashup.intervalId);
  updateTimerUI();
  state.mashup.intervalId = setInterval(() => {
    if (!state.mashup.isPaused && state.mashup.timerSeconds > 0) {
      state.mashup.timerSeconds--;
      updateTimerUI();
    }
  }, 1000);
}

function updateTimerUI() {
  const s = state.mashup.timerSeconds;
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  document.getElementById('mashup-timer-display').textContent = `${hh}:${mm}:${ss}`;
}

// Notes Modal
let activeNotesId = null;
function openNotesModal(id, name) {
  activeNotesId = id;
  document.getElementById('notes-title').textContent = name || 'Notes';
  document.getElementById('notes-textarea').value = state.notes[id] || '';
  document.getElementById('modal-notes').classList.remove('hidden');
}

function saveNotes() {
  if (!activeNotesId) return;
  const val = document.getElementById('notes-textarea').value.trim();
  if (val) state.notes[activeNotesId] = val;
  else delete state.notes[activeNotesId];

  saveLocalStorage('cf_arena_notes', state.notes);
  document.getElementById('modal-notes').classList.add('hidden');
  renderProblems();
  showToast('Note saved', 'success');
}

// Export functions
function exportCSV() {
  const headers = ['ID', 'ContestId', 'Index', 'Name', 'Rating', 'SolvedCount', 'Length', 'Words', 'Tags', 'CF_URL'];
  const rows = state.filteredProblems.map(p => [
    `"${p.id}"`, p.contestId, `"${p.index}"`, `"${p.name.replace(/"/g, '""')}"`,
    p.rating, p.solvedCount, p.length, p.words, `"${p.tags.join(';')}"`,
    `"https://codeforces.com/contest/${p.contestId}/problem/${p.index}"`
  ].join(','));

  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cf_2800_3500_export.csv`;
  a.click();
  showToast('Downloaded CSV', 'success');
}

function exportURLs() {
  const urls = state.filteredProblems.map(p => `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`).join('\n');
  navigator.clipboard.writeText(urls).then(() => {
    showToast(`Copied ${state.filteredProblems.length} URLs!`, 'success');
  });
}

// Event Listeners
function setupEventListeners() {
  // Handle Add
  const handleInput = document.getElementById('handle-input');
  const addHandleBtn = document.getElementById('btn-add-handle');

  const onAdd = () => {
    const val = handleInput.value;
    if (val.includes(',')) val.split(',').forEach(h => addHandle(h));
    else addHandle(val);
  };
  addHandleBtn.addEventListener('click', onAdd);
  handleInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAdd(); });

  // Status tabs (All / Unsolved / Solved / Attempted)
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(t => {
        t.classList.remove('active', 'bg-cyan-600', 'text-white');
        t.classList.add('text-gray-400');
      });
      tab.classList.add('active', 'bg-cyan-600', 'text-white');
      tab.classList.remove('text-gray-400');
      state.statusFilter = tab.getAttribute('data-status');
      applyFiltersAndSort();
    });
  });

  // Rating tabs
  document.querySelectorAll('.rating-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rating-tab').forEach(t => {
        t.classList.remove('active', 'bg-red-600', 'text-white');
        t.classList.add('bg-[#101623]');
      });
      tab.classList.add('active', 'bg-red-600', 'text-white');
      tab.classList.remove('bg-[#101623]');
      state.selectedRating = tab.getAttribute('data-rating');
      applyFiltersAndSort();
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('btn-clear-search');
  searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    clearSearch.classList.toggle('hidden', !e.target.value);
    applyFiltersAndSort();
  });
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearch.classList.add('hidden');
    applyFiltersAndSort();
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', e => {
    state.currentSort = e.target.value;
    applyFiltersAndSort();
  });

  // Filter Drawer open/close
  document.getElementById('btn-open-filters').addEventListener('click', () => {
    document.getElementById('modal-filters').classList.remove('hidden');
  });

  // Drawer Length slider & buttons
  const lenSlider = document.getElementById('drawer-length-slider');
  lenSlider.addEventListener('input', e => {
    state.lengthMax = parseInt(e.target.value, 10);
    document.getElementById('drawer-length-label').textContent = `< ${state.lengthMax} chars`;
    applyFiltersAndSort();
  });
  document.querySelectorAll('.len-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      lenSlider.value = val;
      state.lengthMax = val;
      document.getElementById('drawer-length-label').textContent = val === 5910 ? 'Any' : `< ${val} chars`;
      applyFiltersAndSort();
    });
  });

  // Drawer Solves slider & buttons
  const solvesSlider = document.getElementById('drawer-solves-slider');
  solvesSlider.addEventListener('input', e => {
    state.solvesMin = parseInt(e.target.value, 10);
    document.getElementById('drawer-solves-label').textContent = `≥ ${state.solvesMin} solves`;
    applyFiltersAndSort();
  });
  document.querySelectorAll('.solves-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      solvesSlider.value = val;
      state.solvesMin = val;
      document.getElementById('drawer-solves-label').textContent = val === 0 ? 'Any (0+)' : `≥ ${val} solves`;
      applyFiltersAndSort();
    });
  });

  // Drawer Tag search & modes
  document.getElementById('drawer-tag-search').addEventListener('input', e => {
    renderDrawerTags(e.target.value);
  });
  ['or', 'and', 'not'].forEach(m => {
    document.getElementById(`tag-logic-${m}`).addEventListener('click', e => {
      document.querySelectorAll('.tag-logic-btn').forEach(b => {
        b.classList.remove('active', 'bg-cyan-600', 'text-white');
        b.classList.add('text-gray-400');
      });
      e.target.classList.add('active', 'bg-cyan-600', 'text-white');
      state.tagFilterMode = m;
      renderDrawerTags();
      applyFiltersAndSort();
    });
  });

  // Clear drawer filters
  document.getElementById('btn-clear-all-drawer').addEventListener('click', () => {
    state.selectedTags.clear();
    state.lengthMax = 5910;
    state.solvesMin = 0;
    lenSlider.value = 5910;
    solvesSlider.value = 0;
    document.getElementById('drawer-length-label').textContent = '< 5910 chars';
    document.getElementById('drawer-solves-label').textContent = '≥ 0 solves';
    renderDrawerTags();
    applyFiltersAndSort();
  });

  // Reset tag strip
  document.getElementById('btn-reset-tags-strip').addEventListener('click', () => {
    state.selectedTags.clear();
    state.lengthMax = 5910;
    state.solvesMin = 0;
    renderDrawerTags();
    applyFiltersAndSort();
  });

  // View switchers
  const gridBtn = document.getElementById('view-grid-btn');
  const tableBtn = document.getElementById('view-table-btn');
  gridBtn.addEventListener('click', () => {
    state.viewMode = 'grid';
    gridBtn.classList.add('bg-cyan-600', 'text-white');
    gridBtn.classList.remove('text-gray-400');
    tableBtn.classList.remove('bg-cyan-600', 'text-white');
    tableBtn.classList.add('text-gray-400');
    renderProblems();
  });
  tableBtn.addEventListener('click', () => {
    state.viewMode = 'table';
    tableBtn.classList.add('bg-cyan-600', 'text-white');
    tableBtn.classList.remove('text-gray-400');
    gridBtn.classList.remove('bg-cyan-600', 'text-white');
    gridBtn.classList.add('text-gray-400');
    renderProblems();
  });

  // Page size
  document.getElementById('page-size-select').addEventListener('change', e => {
    state.pageSize = parseInt(e.target.value, 10);
    state.currentPage = 1;
    renderProblems();
    renderPagination();
  });

  // Pagination Next / Prev
  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderProblems();
      renderPagination();
      window.scrollTo({ top: 180, behavior: 'smooth' });
    }
  });
  document.getElementById('btn-next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredProblems.length / state.pageSize);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderProblems();
      renderPagination();
      window.scrollTo({ top: 180, behavior: 'smooth' });
    }
  });

  // Header buttons
  document.getElementById('btn-roulette').addEventListener('click', openRoulette);
  document.getElementById('btn-mashup').addEventListener('click', openMashup);
  document.getElementById('btn-toggle-spoilers').addEventListener('click', toggleSpoilers);
  
  const starFilterBtn = document.getElementById('btn-starred-filter');
  starFilterBtn.addEventListener('click', () => {
    state.starredOnly = !state.starredOnly;
    starFilterBtn.classList.toggle('bg-yellow-600', state.starredOnly);
    starFilterBtn.classList.toggle('text-white', state.starredOnly);
    applyFiltersAndSort();
  });

  document.getElementById('btn-export-modal').addEventListener('click', () => {
    document.getElementById('modal-export').classList.remove('hidden');
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-backdrop').classList.add('hidden');
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      if (e.target === m) m.classList.add('hidden');
    });
  });

  // Roulette actions
  document.getElementById('btn-spin-again').addEventListener('click', spinRoulette);

  // Mashup actions
  document.getElementById('btn-generate-mashup').addEventListener('click', generateMashup);
  document.getElementById('btn-toggle-timer').addEventListener('click', e => {
    state.mashup.isPaused = !state.mashup.isPaused;
    e.target.textContent = state.mashup.isPaused ? 'Resume' : 'Pause';
  });

  // Notes save
  document.getElementById('btn-save-notes').addEventListener('click', saveNotes);

  // Export buttons
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-urls').addEventListener('click', exportURLs);

  // Reset filter button in empty state
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    state.searchQuery = '';
    state.selectedRating = 'all';
    state.selectedTags.clear();
    state.lengthMax = 5910;
    state.solvesMin = 0;
    state.statusFilter = 'all';
    state.starredOnly = false;
    document.getElementById('search-input').value = '';
    renderDrawerTags();
    applyFiltersAndSort();
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadProblems();
});
