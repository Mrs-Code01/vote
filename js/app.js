const categoriesEl = document.getElementById('categories');
const toastEl = document.getElementById('toast');

const emailStepEl = document.getElementById('auth-email-step');
const codeStepEl = document.getElementById('auth-code-step');
const emailInput = document.getElementById('email-input');
const emailError = document.getElementById('email-error');
const codeInput = document.getElementById('code-input');
const codeError = document.getElementById('code-error');
const codeSentToEl = document.getElementById('code-sent-to');
const sendCodeBtn = document.getElementById('send-code-btn');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const resendCodeBtn = document.getElementById('resend-code-btn');
const changeEmailBtn = document.getElementById('change-email-btn');
const signedInAsEl = document.getElementById('signed-in-as');
const signOutBtn = document.getElementById('sign-out-btn');
const subtitleEl = document.getElementById('page-subtitle');

let pendingEmail = '';
// Category id -> nominee id the signed-in voter already chose.
let myVotes = {};

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

// ---------- Auth ----------

async function sendCode(email) {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return error;
}

async function handleSendCode() {
  const email = emailInput.value.trim().toLowerCase();
  emailError.textContent = '';

  if (!email || !email.includes('@')) {
    emailError.textContent = 'Enter a valid email address.';
    return;
  }
  if (!isEmailDomainAllowed(email)) {
    emailError.textContent = `Voting is limited to ${ALLOWED_EMAIL_DOMAINS.join(' or ')} email addresses.`;
    return;
  }

  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = 'Sending…';

  const error = await sendCode(email);

  sendCodeBtn.disabled = false;
  sendCodeBtn.textContent = 'Send me a code';

  if (error) {
    console.error(error);
    emailError.textContent = error.message || 'Could not send the code. Try again.';
    return;
  }

  pendingEmail = email;
  codeSentToEl.textContent = email;
  emailStepEl.style.display = 'none';
  codeStepEl.style.display = 'block';
  codeInput.value = '';
  codeInput.focus();
  showToast('Code sent — check your inbox.');
}

async function handleVerifyCode() {
  const token = codeInput.value.trim();
  codeError.textContent = '';

  if (token.length < 6) {
    codeError.textContent = 'Enter the 6-digit code from your email.';
    return;
  }

  verifyCodeBtn.disabled = true;
  verifyCodeBtn.textContent = 'Verifying…';

  const { error } = await supabaseClient.auth.verifyOtp({
    email: pendingEmail,
    token,
    type: 'email',
  });

  verifyCodeBtn.disabled = false;
  verifyCodeBtn.textContent = 'Verify & start voting';

  if (error) {
    console.error(error);
    codeError.textContent = 'That code is wrong or has expired. Try again, or resend it.';
    return;
  }
  // onAuthStateChange takes it from here.
}

async function handleResendCode() {
  resendCodeBtn.disabled = true;
  const error = await sendCode(pendingEmail);
  resendCodeBtn.disabled = false;
  if (error) {
    codeError.textContent = error.message || 'Could not resend the code.';
    return;
  }
  showToast('New code sent.');
}

function showEmailStep() {
  codeStepEl.style.display = 'none';
  emailStepEl.style.display = 'block';
  categoriesEl.innerHTML = '';
  signedInAsEl.textContent = '';
  signOutBtn.style.display = 'none';
  subtitleEl.textContent = 'Verify your email to vote. One vote per person, per category.';
  emailInput.focus();
}

sendCodeBtn.addEventListener('click', handleSendCode);
emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSendCode(); });
verifyCodeBtn.addEventListener('click', handleVerifyCode);
codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleVerifyCode(); });
resendCodeBtn.addEventListener('click', handleResendCode);
changeEmailBtn.addEventListener('click', () => {
  pendingEmail = '';
  emailInput.value = '';
  emailError.textContent = '';
  codeError.textContent = '';
  showEmailStep();
});
signOutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  myVotes = {};
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
  const votedNomineeId = myVotes[category.id];
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

async function loadMyVotes() {
  const { data, error } = await supabaseClient.from('votes').select('category_id, nominee_id');
  if (error) {
    console.error(error);
    return;
  }
  myVotes = {};
  (data || []).forEach(v => { myVotes[v.category_id] = v.nominee_id; });
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
  const nomineeId = checked.value;

  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await supabaseClient.from('votes').insert({
    category_id: categoryId,
    nominee_id: nomineeId,
  });

  if (error) {
    console.error(error);
    if (error.code === '23505') {
      // Unique violation: this account already voted in this category.
      showToast('You have already voted in this category.');
      await loadMyVotes();
      loadAndRender();
      return;
    }
    showToast('Something went wrong submitting your vote.');
    btn.disabled = false;
    btn.textContent = 'Submit Vote';
    return;
  }

  myVotes[categoryId] = nomineeId;
  showToast('Vote recorded — thank you!');
  loadAndRender();
}

// ---------- Boot ----------

async function showSignedIn(session) {
  emailStepEl.style.display = 'none';
  codeStepEl.style.display = 'none';
  signedInAsEl.textContent = session.user.email;
  signOutBtn.style.display = 'inline-block';
  subtitleEl.textContent = 'Pick your favorite in each category. One vote per person, per category.';
  await loadMyVotes();
  await loadAndRender();
}

async function init() {
  if (typeof isSupabaseConfigured === 'function' && !isSupabaseConfigured()) {
    renderConfigWarning();
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await showSignedIn(session);
  } else {
    showEmailStep();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      showSignedIn(session);
    } else {
      showEmailStep();
    }
  });
}

init();
