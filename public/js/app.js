/* app.js — TinyLink dashboard script (FULL updated)
   - showConfirm supports types: 'info' | 'success' | 'error'
   - Health button shows blocking confirm (success/error)
   - Toasts remain for non-blocking messages
   - All previous behaviors preserved
*/

const apiBase = '/api/links';

const form = document.getElementById('createForm');
const targetInput = document.getElementById('target');
const customInput = document.getElementById('customCode');
const submitBtn = document.getElementById('submitBtn');
//const formMsg = document.getElementById('formMsg');

const linksBody = document.getElementById('linksBody');
const search = document.getElementById('search');
const healthBtn = document.getElementById('healthBtn');

/* -----------------------
   Helpers
------------------------ */
function humanDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

/* Toast helper */
function toast(msg, ms = 2200) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => (t.style.display = 'none'), ms);
}

/* =======================
   Confirm modal (with type)
   type: 'info' | 'success' | 'error'
   ======================= */
function showConfirm(message, title = 'Notice', onOk = null, type = 'info') {
  const modal = document.getElementById('confirmModal');
  const msgEl = document.getElementById('confirmMessage');
  const titleEl = document.getElementById('confirmTitle');
  const okBtn = document.getElementById('confirmOk');
  const closeBtn = document.getElementById('confirmClose');
  const box = modal.querySelector('.confirm-box');

  if (!modal || !msgEl || !okBtn || !box) {
    // fallback to toast if confirm modal missing
    toast(message);
    if (typeof onOk === 'function') onOk();
    return;
  }

  titleEl.textContent = title;
  msgEl.textContent = message;

  // apply type class
  box.classList.remove('success', 'error', 'info');
  box.classList.add(type || 'info');

  // show modal
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  // focus management
  const previouslyFocused = document.activeElement;
  box.focus();

  function cleanup() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    okBtn.removeEventListener('click', handleOk);
    closeBtn.removeEventListener('click', handleClose);
    document.removeEventListener('keydown', onEsc);
    box.classList.remove('success', 'error', 'info');
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
  }

  function handleOk() {
    cleanup();
    if (typeof onOk === 'function') onOk();
  }
  function handleClose() {
    cleanup();
  }
  function onEsc(e) {
    if (e.key === 'Escape') handleClose();
  }

  okBtn.addEventListener('click', handleOk);
  closeBtn.addEventListener('click', handleClose);
  document.addEventListener('keydown', onEsc);
}

/* -----------------------
   Sorting (simple)
------------------------ */
let sortKey = 'created_at', sortDir = 'desc';
function sortRows(rows) {
  return rows.sort((a, b) => {
    const v1 = a[sortKey] || '';
    const v2 = b[sortKey] || '';
    if (v1 === v2) return 0;
    if (sortDir === 'asc') return v1 > v2 ? 1 : -1;
    return v1 < v2 ? 1 : -1;
  });
}

/* -----------------------
   Fetch & render table
------------------------ */
async function fetchLinks() {
  linksBody.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  try {
    const r = await fetch(apiBase);
    const rows = await r.json();
    const sorted = sortRows(rows);
    renderTable(sorted);
  } catch {
    linksBody.innerHTML = '<tr><td colspan="5">Error loading</td></tr>';
  }
}

function renderTable(rows) {
  const q = (search.value || '').toLowerCase().trim();

  const filtered = rows.filter(r =>
    !q || r.code.toLowerCase().includes(q) || r.target.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    linksBody.innerHTML = '<tr><td colspan="5">No links yet</td></tr>';
    return;
  }

  linksBody.innerHTML = filtered.map(r => `
    <tr>
      <td><a class="code-link" href="/code/${r.code}">${r.code}</a></td>

      <!-- Short URL shown -->
      <td>
        <a class="short-link" href="/${r.code}" target="_blank" rel="noopener noreferrer">
          ${location.origin}/${r.code}
        </a>
      </td>

      <td>${r.clicks}</td>
      <td>${r.last_clicked ? humanDate(r.last_clicked) : '-'}</td>

      <td class="actions">
        <button class="btn-delete" onclick="deleteLink('${r.code}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

/* -----------------------
   Delete link
------------------------ */
async function deleteLink(code) {
  if (!confirm(`Delete ${code}?`)) return;

  const r = await fetch(`/api/links/${code}`, { method: 'DELETE' });

  if (r.status === 204) {
    toast('Short link deleted successfully 🗑️');
    fetchLinks();
  } else {
    toast('Failed to delete link ❌');
  }
}

/* -----------------------
   Create link (form)
------------------------ */
form.addEventListener('submit', async e => {
  e.preventDefault();
  //formMsg.textContent = '';

  const target = targetInput.value.trim();
  const code = customInput.value.trim();

  if (!target) {
    showConfirm('Please enter a URL', 'Invalid', null, 'error');
    //formMsg.textContent = 'URL required';
    return;
  }

  // validate URL format
  try {
    const u = new URL(target);
    if (!(u.protocol === 'http:' || u.protocol === 'https:')) {
      showConfirm('URL must start with http:// or https://', 'Invalid URL', null, 'error');
      return;
    }
  } catch {
    showConfirm('Invalid URL format', 'Invalid URL', null, 'error');
    return;
  }

  if (code && !/^[A-Za-z0-9]{6,8}$/.test(code)) {
    showConfirm('Invalid custom code — must be 6–8 letters/numbers', 'Invalid code', null, 'error');
    //formMsg.textContent = 'Invalid custom code';
    return;
  }

  submitBtn.disabled = true;

  try {
    const r = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, code: code || undefined })
    });

    const j = await r.json().catch(() => null);

    if (r.status === 201) {
      // use blocking confirm styled as success
      showConfirm(`Short link created!\n\n${j.shortUrl}`, 'Created', () => {
        // after OK, focus URL input for quick next entry
        targetInput.focus();
      }, 'success');

      //formMsg.textContent = ''; // keep inline minimal
      targetInput.value = '';
      customInput.value = '';
      fetchLinks();
    } else if (r.status === 409) {
      showConfirm('Custom code already exists. Choose another code or leave blank to auto-generate.', 'Code exists', null, 'error');
     // formMsg.textContent = 'Code already exists';
    } else {
      showConfirm(j?.error || 'Create failed', 'Error', null, 'error');
    }
  } catch {
    showConfirm('Network error — please try again', 'Network error', null, 'error');
   // formMsg.textContent = 'Network error';
  }

  submitBtn.disabled = false;
});

search.addEventListener('input', fetchLinks);

/* sort header (click to toggle) */
document.querySelectorAll('#linksTable thead th').forEach((th, i) => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const map = ['code', 'target', 'clicks', 'last_clicked'];
    const key = map[i] || 'created_at';
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    fetchLinks();
  });
});

/* initial load */
fetchLinks();

/* -----------------------
   Modal logic (stats)
------------------------ */
const statsModal = document.getElementById('statsModal');
const closeModalBtn = document.getElementById('closeModal');

const modalCodeEl = document.getElementById('modalCode');
const modalShortUrl = document.getElementById('modalShortUrl');
const modalTarget = document.getElementById('modalTarget');
const modalClicks = document.getElementById('modalClicks');
const modalLast = document.getElementById('modalLast');
const modalCreated = document.getElementById('modalCreated');

let lastFocusedElement = null;

function openStatsModal() {
  statsModal.style.display = 'flex';
  statsModal.setAttribute('aria-hidden', 'false');
}

function closeStatsModal() {
  statsModal.style.display = 'none';
  statsModal.setAttribute('aria-hidden', 'true');
  if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

closeModalBtn.addEventListener('click', closeStatsModal);
statsModal.querySelector('[data-modal-backdrop]').addEventListener('click', closeStatsModal);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && statsModal.style.display === 'flex') closeStatsModal();
});

/* delegated click handling for table anchors */
document.getElementById('linksTable').addEventListener('click', async e => {
  const a = e.target.closest('a');
  if (!a) return;

  const url = new URL(a.href, location.origin);

  // If code link (/code/<code>), open modal instead of navigating
  if (url.pathname.startsWith('/code/')) {
    e.preventDefault();
    lastFocusedElement = a;
    const code = url.pathname.split('/')[2];

    try {
      const resp = await fetch(`/api/links/${code}`);
      if (resp.status !== 200) {
        showConfirm('Unable to load stats for this code', 'Not found', null, 'error');
        return;
      }
      const j = await resp.json();
      modalCodeEl.textContent = j.code;
      modalShortUrl.href = `${location.origin}/${j.code}`;
      modalShortUrl.textContent = `${location.origin}/${j.code}`;
      modalTarget.textContent = j.target;
      modalClicks.textContent = j.clicks;
      modalLast.textContent = j.last_clicked ? humanDate(j.last_clicked) : '-';
      modalCreated.textContent = j.created_at ? humanDate(j.created_at) : '-';
      openStatsModal();
    } catch (err) {
      console.error(err);
      showConfirm('Error loading stats', 'Error', null, 'error');
    }
    return;
  }

  // If short-link clicked (e.g. "/abc123"), allow redirect but schedule refresh
  const codeMatch = url.pathname.match(/^\/([A-Za-z0-9]{6,8})$/);
  if (codeMatch) {
    // user will be redirected (often to a new tab); refresh table after a short delay
    setTimeout(fetchLinks, 900);

    // also refresh on focus return if user opened in a new tab
    let bound = false;
    if (!bound) {
      bound = true;
      const onFocus = () => {
        fetchLinks();
        window.removeEventListener('focus', onFocus);
        bound = false;
      };
      window.addEventListener('focus', onFocus);
    }
    return;
  }
});

/* -----------------------
   Health check (confirm-style output)
------------------------ */
if (healthBtn) {
  healthBtn.addEventListener('click', async () => {
    try {
      const r = await fetch('/healthz');
      if (r.status !== 200) {
        showConfirm('Health check failed — server returned an error. Please try again later.', 'Health check failed', null, 'error');
        return;
      }
      const j = await r.json();
      showConfirm(`System OK ✔\n\nVersion: ${j.version || '1.0'}`, 'System OK', null, 'success');
    } catch (err) {
      showConfirm('Unable to reach server. Check your connection or try again later.', 'Server unreachable', null, 'error');
    }
  });
}
