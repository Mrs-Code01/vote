const categoriesEl = document.getElementById('categories');
const toastEl = document.getElementById('toast');
const deviceId = getDeviceId();

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function votedKey(categoryId) {
  return `spectra_voted_${categoryId}`;
}

function getVotedNomineeId(categoryId) {
  return localStorage.getItem(votedKey(categoryId));
}

function setVoted(categoryId, nomineeId) {
  localStorage.setItem(votedKey(categoryId), nomineeId);
}

function renderConfigWarning() {
  categoriesEl.innerHTML = `
    <div class="card empty-state">
      <div class="big">Supabase isn't configured yet</div>
      <p>Open <code>js/supabaseClient.js</code> and set your SUPABASE_URL and SUPABASE_ANON_KEY, then run the SQL in <code>supabase/schema.sql</code> against your project.</p>
    </div>`;
}

function renderEmptyState() {
  categoriesEl.innerHTML = `
    <div class="card empty-state">
      <div class="big">No categories yet</div>
      <p>Check back soon — voting will open once categories and nominees are set up.</p>
    </div>`;
}

function categoryCardHtml(category, nominees) {
  const votedNomineeId = getVotedNomineeId(category.id);
  const hasVoted = !!votedNomineeId;

  const optionsHtml = nominees.map(n => {
    const selected = n.id === votedNomineeId;
    return `
      <label class="nominee-option ${selected ? 'selected' : ''}" data-nominee-id="${n.id}">
        <input type="radio" name="nominee_${category.id}" value="${n.id}" ${selected ? 'checked' : ''} ${hasVoted ? 'disabled' : ''} />
        <span class="nominee-name">${escapeHtml(n.name)}</span>
      </label>`;
  }).join('');

  const actionHtml = hasVoted
    ? `<span class="voted-badge">&#10003; Vote recorded</span>`
    : `<button class="btn btn-gold" data-vote-category="${category.id}" ${nominees.length === 0 ? 'disabled' : ''}>Submit Vote</button>`;

  return `
    <div class="card" data-category-card="${category.id}">
      <div class="category-title">${escapeHtml(category.name)}</div>
      <div class="category-meta">${nominees.length} nominee${nominees.length === 1 ? '' : 's'}</div>
      ${nominees.length ? `<div class="nominee-list">${optionsHtml}</div>` : `<p class="small-muted">No nominees added for this category yet.</p>`}
      ${actionHtml}
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
    renderEmptyState();
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
  const nomineeId = checked.value;

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await supabaseClient.from('votes').insert({
    category_id: categoryId,
    nominee_id: nomineeId,
    device_id: deviceId,
  });

  if (error) {
    console.error(error);
    if (error.code === '23505') {
      // unique violation: already voted from this device for this category
      setVoted(categoryId, nomineeId);
      showToast('Looks like you already voted in this category.');
      loadAndRender();
      return;
    }
    showToast('Something went wrong submitting your vote.');
    btn.disabled = false;
    btn.textContent = 'Submit Vote';
    return;
  }

  setVoted(categoryId, nomineeId);
  showToast('Vote recorded — thank you!');
  loadAndRender();
}

if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
  renderConfigWarning();
} else {
  loadAndRender();
}
