const ADMIN_PASSWORD = 'SPECTRA$$$Yo';

const gateEl = document.getElementById('gate');
const panelEl = document.getElementById('admin-panel');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const unlockBtn = document.getElementById('unlock-btn');
const toastEl = document.getElementById('toast');

const categoriesManageEl = document.getElementById('categories-manage');
const resultsContainerEl = document.getElementById('results-container');
const newCategoryInput = document.getElementById('new-category-input');

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function unlock() {
  gateEl.style.display = 'none';
  panelEl.style.display = 'block';
  sessionStorage.setItem('spectra_admin_unlocked', '1');
  loadManage();
}

function tryUnlock() {
  if (passwordInput.value === ADMIN_PASSWORD) {
    passwordError.textContent = '';
    unlock();
  } else {
    passwordError.textContent = 'Incorrect password. Try again.';
  }
}

unlockBtn.addEventListener('click', tryUnlock);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryUnlock();
});

if (sessionStorage.getItem('spectra_admin_unlocked') === '1') {
  unlock();
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-manage').style.display = tab === 'manage' ? 'block' : 'none';
    document.getElementById('tab-voters').style.display = tab === 'voters' ? 'block' : 'none';
    document.getElementById('tab-results').style.display = tab === 'results' ? 'block' : 'none';
    if (tab === 'results') loadResults();
    if (tab === 'voters') loadVoters();
  });
});

// Manage: categories + nominees

document.getElementById('add-category-btn').addEventListener('click', addCategory);
newCategoryInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addCategory();
});

async function addCategory() {
  const name = newCategoryInput.value.trim();
  if (!name) return;
  const { error } = await supabaseClient.from('categories').insert({ name });
  if (error) {
    console.error(error);
    showToast('Could not add category.');
    return;
  }
  newCategoryInput.value = '';
  showToast('Category added.');
  loadManage();
}

async function deleteCategory(id) {
  if (!confirm('Delete this category and all its nominees and votes?')) return;
  const { error } = await supabaseClient.from('categories').delete().eq('id', id);
  if (error) {
    console.error(error);
    showToast('Could not delete category.');
    return;
  }
  showToast('Category deleted.');
  loadManage();
}

async function addNominee(categoryId, inputEl) {
  const name = inputEl.value.trim();
  if (!name) return;
  const { error } = await supabaseClient.from('nominees').insert({ category_id: categoryId, name });
  if (error) {
    console.error(error);
    showToast('Could not add nominee.');
    return;
  }
  showToast('Nominee added.');
  loadManage();
}

async function deleteNominee(id) {
  if (!confirm('Delete this nominee and their votes?')) return;
  const { error } = await supabaseClient.from('nominees').delete().eq('id', id);
  if (error) {
    console.error(error);
    showToast('Could not delete nominee.');
    return;
  }
  showToast('Nominee deleted.');
  loadManage();
}

async function loadManage() {
  const { data: categories, error: catError } = await supabaseClient
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  if (catError) {
    console.error(catError);
    categoriesManageEl.innerHTML = `<div class="card empty-state"><div class="big">Couldn't load data</div><p>${escapeHtml(catError.message)}</p></div>`;
    return;
  }

  if (!categories || categories.length === 0) {
    categoriesManageEl.innerHTML = `<div class="card empty-state"><div class="big">No categories yet</div><p>Add your first category above.</p></div>`;
    return;
  }

  const { data: nominees, error: nomError } = await supabaseClient
    .from('nominees')
    .select('*')
    .order('created_at', { ascending: true });

  if (nomError) {
    console.error(nomError);
    showToast('Failed to load nominees.');
  }

  categoriesManageEl.innerHTML = categories.map(cat => {
    const catNominees = (nominees || []).filter(n => n.category_id === cat.id);
    const nomineeRows = catNominees.map(n => `
      <div class="nominee-row">
        <span class="nominee-name">${escapeHtml(n.name)}</span>
        <button class="btn btn-danger btn-sm" data-delete-nominee="${n.id}">Remove</button>
      </div>`).join('');

    return `
      <div class="card" data-category-id="${cat.id}">
        <div class="category-header-row">
          <div>
            <div class="category-title">${escapeHtml(cat.name)}</div>
            <div class="category-meta">${catNominees.length} nominee${catNominees.length === 1 ? '' : 's'}</div>
          </div>
          <button class="btn btn-danger btn-sm" data-delete-category="${cat.id}">Delete Category</button>
        </div>
        ${nomineeRows ? `<div style="margin-top:14px;">${nomineeRows}</div>` : ''}
        <div class="inline-form" style="margin-top:14px;">
          <input class="input" placeholder="Add nominee name" data-nominee-input="${cat.id}" />
          <button class="btn btn-outline" data-add-nominee="${cat.id}">Add</button>
        </div>
      </div>`;
  }).join('');

  categoriesManageEl.querySelectorAll('[data-delete-category]').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.deleteCategory));
  });
  categoriesManageEl.querySelectorAll('[data-delete-nominee]').forEach(btn => {
    btn.addEventListener('click', () => deleteNominee(btn.dataset.deleteNominee));
  });
  categoriesManageEl.querySelectorAll('[data-add-nominee]').forEach(btn => {
    const catId = btn.dataset.addNominee;
    const input = categoriesManageEl.querySelector(`[data-nominee-input="${catId}"]`);
    btn.addEventListener('click', () => addNominee(catId, input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addNominee(catId, input);
    });
  });
}

// Voters: who is eligible to vote

document.getElementById('add-domain-btn').addEventListener('click', addDomain);
document.getElementById('new-domain-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain();
});
document.getElementById('add-emails-btn').addEventListener('click', addEmails);

async function addDomain() {
  const input = document.getElementById('new-domain-input');
  // Accept "@spectra.com", "spectra.com" or a full address pasted by mistake.
  const domain = input.value.trim().toLowerCase().replace(/^@/, '').replace(/^.*@/, '');
  if (!domain) return;
  if (!domain.includes('.')) {
    showToast('That does not look like a domain.');
    return;
  }
  const { error } = await supabaseClient.from('allowed_domains').insert({ domain });
  if (error) {
    console.error(error);
    showToast(error.code === '23505' ? 'That domain is already added.' : 'Could not add domain.');
    return;
  }
  input.value = '';
  showToast('Domain added.');
  loadVoters();
}

async function removeDomain(domain) {
  const { error } = await supabaseClient.from('allowed_domains').delete().eq('domain', domain);
  if (error) {
    console.error(error);
    showToast('Could not remove domain.');
    return;
  }
  loadVoters();
}

async function addEmails() {
  const input = document.getElementById('new-emails-input');
  const emails = input.value
    .split(/[\s,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'));

  if (!emails.length) {
    showToast('Enter at least one email address.');
    return;
  }

  const unique = [...new Set(emails)];
  const { error } = await supabaseClient
    .from('eligible_voters')
    .upsert(unique.map(email => ({ email })), { onConflict: 'email' });

  if (error) {
    console.error(error);
    showToast('Could not add voters.');
    return;
  }
  input.value = '';
  showToast(`${unique.length} voter${unique.length === 1 ? '' : 's'} added.`);
  loadVoters();
}

async function removeVoter(email) {
  const { error } = await supabaseClient.from('eligible_voters').delete().eq('email', email);
  if (error) {
    console.error(error);
    showToast('Could not remove voter.');
    return;
  }
  loadVoters();
}

async function loadVoters() {
  const [{ data: domains, error: domError }, { data: voters, error: votError }] = await Promise.all([
    supabaseClient.from('allowed_domains').select('*').order('domain'),
    supabaseClient.from('eligible_voters').select('*').order('email'),
  ]);

  const statusEl = document.getElementById('eligibility-status');

  if (domError || votError) {
    console.error(domError || votError);
    statusEl.innerHTML = `<div class="card empty-state"><div class="big">Couldn't load voter rules</div><p>Have you run <code>migration-002-voter-eligibility.sql</code> in the Supabase SQL editor?</p></div>`;
    return;
  }

  const hasRules = (domains || []).length > 0 || (voters || []).length > 0;
  statusEl.innerHTML = hasRules
    ? `<div class="card" style="border-color: rgba(53,201,143,0.4);">
         <span class="voted-badge">&#10003; Voting is restricted</span>
         <p class="small-muted" style="margin-bottom:0; margin-top:10px;">
           Only the domains and people listed below can vote — one vote each.
         </p>
       </div>`
    : `<div class="card" style="border-color: rgba(244,196,48,0.5);">
         <div class="category-title" style="font-size:16px;">&#9888; Voting is open to anyone</div>
         <p class="small-muted" style="margin-bottom:0;">
           Any email address can register and vote right now, so one person with
           several addresses could vote more than once. Add your work domain
           below to close that.
         </p>
       </div>`;

  document.getElementById('domains-list').innerHTML = (domains || []).length
    ? domains.map(d => `
        <div class="nominee-row">
          <span class="nominee-name">@${escapeHtml(d.domain)}</span>
          <button class="btn btn-danger btn-sm" data-remove-domain="${escapeHtml(d.domain)}">Remove</button>
        </div>`).join('')
    : '<p class="small-muted">No domains added yet.</p>';

  document.getElementById('voters-list').innerHTML = (voters || []).length
    ? `<div class="category-meta">${voters.length} individual voter${voters.length === 1 ? '' : 's'}</div>`
      + voters.map(v => `
        <div class="nominee-row">
          <span class="nominee-name">${escapeHtml(v.email)}</span>
          <button class="btn btn-danger btn-sm" data-remove-voter="${escapeHtml(v.email)}">Remove</button>
        </div>`).join('')
    : '<p class="small-muted">No individual voters added.</p>';

  document.querySelectorAll('[data-remove-domain]').forEach(btn => {
    btn.addEventListener('click', () => removeDomain(btn.dataset.removeDomain));
  });
  document.querySelectorAll('[data-remove-voter]').forEach(btn => {
    btn.addEventListener('click', () => removeVoter(btn.dataset.removeVoter));
  });
}

// Results

async function loadResults() {
  const { data: categories, error: catError } = await supabaseClient
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: results, error: resError } = await supabaseClient.rpc('get_results');

  if (catError || resError) {
    console.error(catError || resError);
    resultsContainerEl.innerHTML = `<div class="card empty-state"><div class="big">Couldn't load results</div></div>`;
    return;
  }

  if (!categories || categories.length === 0) {
    resultsContainerEl.innerHTML = `<div class="card empty-state"><div class="big">No categories yet</div></div>`;
    return;
  }

  resultsContainerEl.innerHTML = categories.map(cat => {
    const rows = (results || [])
      .filter(r => r.category_id === cat.id)
      .sort((a, b) => b.vote_count - a.vote_count);

    const totalVotes = rows.reduce((sum, r) => sum + Number(r.vote_count), 0);
    const maxVotes = rows.length ? Math.max(...rows.map(r => Number(r.vote_count))) : 0;

    const rowsHtml = rows.map((r, i) => {
      const pct = maxVotes > 0 ? (Number(r.vote_count) / maxVotes) * 100 : 0;
      return `
        <div class="result-row">
          <div class="result-row-top">
            <span class="${i === 0 && r.vote_count > 0 ? 'result-leader' : ''}">${escapeHtml(r.nominee_name)}</span>
            <span>${r.vote_count} vote${Number(r.vote_count) === 1 ? '' : 's'}</span>
          </div>
          <div class="result-bar-track"><div class="result-bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');

    return `
      <div class="card">
        <div class="category-title">${escapeHtml(cat.name)}</div>
        <div class="category-meta">${totalVotes} total vote${totalVotes === 1 ? '' : 's'}</div>
        ${rowsHtml || '<p class="small-muted">No nominees in this category yet.</p>'}
      </div>`;
  }).join('');
}
