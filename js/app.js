const categoriesEl = document.getElementById('categories');
const toastEl = document.getElementById('toast');

const nameStepEl = document.getElementById('name-step');
const nameInput = document.getElementById('name-input');
const nameError = document.getElementById('name-error');
const startVotingBtn = document.getElementById('start-voting-btn');
const votingAsEl = document.getElementById('voting-as');
const changeNameBtn = document.getElementById('change-name-btn');
const subtitleEl = document.getElementById('page-subtitle');

const NAME_STORAGE_KEY = 'spectra_voter_name';

let voterName = '';
// Category ids this voter has already voted in.
let votedCategories = new Set();

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Collapse runs of whitespace so " Mercy   Idubor " matches "Mercy Idubor".
// The database normalises the same way when enforcing one-vote-per-name.
function tidyName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

function isFullName(name) {
  return tidyName(name).split(' ').filter(Boolean).length >= 2;
}

// ---------- Name step ----------

function showNameStep() {
  nameStepEl.style.display = 'block';
  categoriesEl.innerHTML = '';
  votingAsEl.textContent = '';
  changeNameBtn.style.display = 'none';
  subtitleEl.textContent = 'Enter your full name to vote. One vote per person, per category.';
  nameInput.focus();
}

async function startVoting() {
  const entered = tidyName(nameInput.value);
  nameError.textContent = '';

  if (!entered) {
    nameError.textContent = 'Please enter your name.';
    return;
  }
  if (!isFullName(entered)) {
    nameError.textContent = 'Please enter your full name — first and last.';
    return;
  }

  voterName = entered;
  localStorage.setItem(NAME_STORAGE_KEY, voterName);
  await showVoting();
}

startVotingBtn.addEventListener('click', startVoting);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') startVoting(); });

changeNameBtn.addEventListener('click', () => {
  voterName = '';
  votedCategories = new Set();
  localStorage.removeItem(NAME_STORAGE_KEY);
  nameInput.value = '';
  nameError.textContent = '';
  showNameStep();
});

// ---------- Voting ----------

function renderConfigWarning() {
  categoriesEl.innerHTML = `
    <div class="card empty-state">
      <div class="big">Supabase isn't configured yet</div>
      <p>Open <code>js/supabaseClient.js</code> and set your SUPABASE_URL and SUPABASE_ANON_KEY, then run the SQL in <code>supabase/schema.sql</code> against your project.</p>
    </div>`;
}

function categoryCardHtml(category, nominees) {
  const hasVoted = votedCategories.has(category.id);

  const optionsHtml = nominees.map(n => `
      <label class="nominee-option" data-nominee-id="${n.id}">
        <input type="radio" name="nominee_${category.id}" value="${n.id}" ${hasVoted ? 'disabled' : ''} />
        <span class="nominee-name">${escapeHtml(n.name)}</span>
      </label>`).join('');

  const actionHtml = hasVoted
    ? `<span class="voted-badge">&#10003; You have voted in this category</span>`
    : `<button class="btn btn-gold" data-vote-category="${category.id}" ${nominees.length === 0 ? 'disabled' : ''}>Submit Vote</button>`;

  return `
    <div class="card" data-category-card="${category.id}">
      <div class="category-title">${escapeHtml(category.name)}</div>
      <div class="category-meta">${nominees.length} nominee${nominees.length === 1 ? '' : 's'}</div>
      ${nominees.length ? `<div class="nominee-list">${optionsHtml}</div>` : `<p class="small-muted">No nominees added for this category yet.</p>`}
      ${actionHtml}
    </div>`;
}

// Ask the database which categories this name already voted in, so the page is
// correct even on a different device or after clearing browser data.
async function loadVotedCategories() {
  const { data, error } = await supabaseClient.rpc('voted_categories', { check_name: voterName });
  if (error) {
    console.error(error);
    return;
  }
  votedCategories = new Set((data || []).map(r => r.category_id));
}

async function loadAndRender() {
  const { data: categories, error: catError } = await supabaseClient
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (catError) {
    console.error(catError);
    showToast('Failed to load categories.');
    return;
  }

  if (!categories || categories.length === 0) {
    categoriesEl.innerHTML = `
      <div class="card empty-state">
        <div class="big">No categories yet</div>
        <p>Check back soon — voting will open once categories and nominees are set up.</p>
      </div>`;
    return;
  }

  const { data: nominees, error: nomError } = await supabaseClient
    .from('nominees')
    .select('*')
    .order('created_at', { ascending: true });

  if (nomError) {
    console.error(nomError);
    showToast('Failed to load nominees.');
    return;
  }

  categoriesEl.innerHTML = categories.map(cat => {
    const catNominees = (nominees || []).filter(n => n.category_id === cat.id);
    return categoryCardHtml(cat, catNominees);
  }).join('');

  attachHandlers();
}

function attachHandlers() {
  categoriesEl.querySelectorAll('.nominee-option').forEach(label => {
    label.addEventListener('click', () => {
      if (label.querySelector('input').disabled) return;
      const card = label.closest('[data-category-card]');
      card.querySelectorAll('.nominee-option').forEach(o => o.classList.remove('selected'));
      label.classList.add('selected');
    });
  });

  categoriesEl.querySelectorAll('[data-vote-category]').forEach(btn => {
    btn.addEventListener('click', () => submitVote(btn.dataset.voteCategory, btn));
  });
}

async function submitVote(categoryId, btn) {
  const card = document.querySelector(`[data-category-card="${categoryId}"]`);
  const checked = card.querySelector('input[type="radio"]:checked');
  if (!checked) {
    showToast('Pick a nominee first.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await supabaseClient.from('votes').insert({
    category_id: categoryId,
    nominee_id: checked.value,
    voter_name: voterName,
  });

  if (error) {
    console.error(error);
    if (error.code === '23505') {
      // Unique violation: this name already voted in this category.
      showToast(`A vote has already been recorded for ${voterName} in this category.`);
      votedCategories.add(categoryId);
      loadAndRender();
      return;
    }
    showToast('Something went wrong submitting your vote.');
    btn.disabled = false;
    btn.textContent = 'Submit Vote';
    return;
  }

  votedCategories.add(categoryId);
  showToast('Vote recorded — thank you!');
  loadAndRender();
}

// ---------- Boot ----------

async function showVoting() {
  nameStepEl.style.display = 'none';
  votingAsEl.textContent = `Voting as ${voterName}`;
  changeNameBtn.style.display = 'inline-block';
  subtitleEl.textContent = 'Pick your favorite in each category. One vote per person, per category.';
  await loadVotedCategories();
  await loadAndRender();
}

async function init() {
  if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
    renderConfigWarning();
    return;
  }

  const saved = localStorage.getItem(NAME_STORAGE_KEY);
  if (saved && isFullName(saved)) {
    voterName = tidyName(saved);
    await showVoting();
  } else {
    showNameStep();
  }
}

init();
