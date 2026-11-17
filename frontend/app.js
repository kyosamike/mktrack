const API = '/api';
const COMMUNITIES = ['Bugema', 'Busiika', 'Namulonge', 'Kiwenda', 'Kiziri'];
const WASTE_TYPES = ['Organic', 'Plastic', 'Paper', 'Metal', 'General', 'Electronic'];
let token = localStorage.getItem('ecoToken') || '';
let currentUser = null;
const app = document.getElementById('app');

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));
const dateValue = value => value ? new Date(value).toISOString().slice(0,10) : '';
const dateLabel = value => value ? new Date(value).toLocaleDateString() : '—';
const communityOptions = selected => COMMUNITIES.map(c =>
  `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');

async function api(path, options = {}) {
  const headers = { ...(options.body ? {'Content-Type':'application/json'} : {}),
    ...(token ? {Authorization:`Bearer ${token}`} : {}), ...(options.headers || {}) };
  const response = await fetch(API + path, {...options, headers});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
  return data;
}
function notice(id, message, type='ok') {
  const node = document.getElementById(id);
  if (node) { node.textContent = message; node.className = `notice ${type}`; }
}
function authScreen(mode='login') {
  const setup = mode === 'setup';
  const register = mode === 'register';
  app.innerHTML = `
  <div class="auth-wrap">
    <section class="auth-art">
      <div class="logo-mark">♻</div><p class="eyebrow">COMMUNITY ENVIRONMENT PLATFORM</p>
      <h1>Cleaner communities.<br>Healthier futures.</h1>
      <p>Report waste, coordinate collection and keep your community informed.</p>
      <div class="community-chips">${COMMUNITIES.map(c=>`<span>${c}</span>`).join('')}</div>
    </section>
    <section class="auth-side"><div class="auth-card">
      <div class="auth-brand"><span>♻</span><div><b>EcoTrack</b><small>Community Services</small></div></div>
      <p class="eyebrow">${setup?'FIRST-TIME SETUP':register?'RESIDENT REGISTRATION':'WELCOME BACK'}</p>
      <h2>${setup?'Create administrator':register?'Create resident account':'Sign in to EcoTrack'}</h2>
      <p class="muted">${setup?'Create the first system administrator.':register?'Create an account for your community.':'Use your account details to open your dashboard.'}</p>
      <form id="authForm" class="stack-form">
        ${setup||register?`<label>Full name<input name="fullName" required maxlength="100" autocomplete="name"></label>`:''}
        <label>Email address<input name="email" type="email" required autocomplete="email"></label>
        ${setup?'<label>One-time setup key<input name="setupKey" type="password" required></label>':''}
        ${register?`<label>Community<select name="community" required><option value="">Choose your community</option>${communityOptions()}</select></label>`:''}
        <label>Password<input name="password" type="password" minlength="8" required autocomplete="${setup||register?'new-password':'current-password'}"></label>
        <button class="btn primary full" type="submit">${setup?'Create administrator':register?'Register':'Sign in'}</button>
      </form>
      <p id="authNotice" class="notice"></p>
      <div class="auth-links">${setup?'<a href="#login" data-screen="login">Back to sign in</a>':register?'Already registered? <a href="#login" data-screen="login">Sign in</a>':'New resident? <a href="#register" data-screen="register">Create account</a><br><br><a href="#setup" data-screen="setup">First-time administrator setup</a>'}</div>
      <p class="tiny">Public registration creates resident accounts only. Administrators create community officer accounts.</p>
    </div></section>
  </div>`;
  document.getElementById('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const endpoint = setup ? '/auth/setup-admin' : register ? '/auth/register' : '/auth/login';
      const result = await api(endpoint, {method:'POST', body:JSON.stringify(data)});
      if (setup || register) {
        notice('authNotice', result.message);
        form.reset();
        if (register) setTimeout(()=>authScreen('login'), 1200);
      } else {
        token = result.token;
        localStorage.setItem('ecoToken', token);
        currentUser = result.user;
        renderDashboard();
      }
    } catch (error) { notice('authNotice', error.message, 'error'); }
  });
  app.querySelectorAll('[data-screen]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); authScreen(link.dataset.screen);
  }));
}

function sidebarLink(section, label, icon) {
  return `<a class="nav-link" href="#${section}" data-nav="${section}"><span>${icon}</span>${label}</a>`;
}
function dashboardShell() {
  const admin = currentUser.role === 'administrator';
  const officer = currentUser.role === 'officer';
  const roleName = admin ? 'Administrator' : officer ? 'Community Officer' : 'Resident';
  app.innerHTML = `
  <aside class="sidebar">
    <div class="brand"><span class="brand-icon">♻</span><div><b>EcoTrack</b><small>Community Services</small></div></div>
    <div class="profile-mini"><div class="avatar">${esc(currentUser.fullName.charAt(0).toUpperCase())}</div><div><b>${esc(currentUser.fullName)}</b><small>${roleName}${currentUser.community?' · '+esc(currentUser.community):''}</small></div></div>
    <nav>${sidebarLink('overview','Overview','▦')}${sidebarLink('new-report','New report','＋')}${sidebarLink('reports','Waste reports','▤')}${admin?sidebarLink('users','User management','♙'):''}${admin?sidebarLink('teams','Collection teams','♟'):''}${(admin||officer)?sidebarLink('schedules','Collection schedules','▦'):''}${sidebarLink('notifications','Notifications','♧')}${(admin||officer)?sidebarLink('exports','Reports & exports','⇩'):''}${admin?sidebarLink('activity','Activity log','◷'):''}</nav>
    <div class="side-foot"><span class="live-dot"></span> Connected</div>
  </aside>
  <main class="main">
    <header class="topbar"><div><p class="eyebrow">COMMUNITY ENVIRONMENT</p><h1>${roleName} dashboard</h1></div><button id="logout" class="btn outline">Sign out ↗</button></header>
    <section id="overview">
      <div class="welcome"><div><h2>Welcome, ${esc(currentUser.fullName.split(' ')[0])}</h2><p>${admin?'Monitor reports across all five communities.':officer?`Manage collection reports for ${esc(currentUser.community)}.`:'Submit reports and follow collection progress in your community.'}</p></div><a class="btn" href="#new-report">＋ Create report</a></div>
      <div class="stats-grid">
        <article class="stat-card"><span class="stat-icon green">▤</span><p>Total reports</p><strong id="totalCount">0</strong><small>Reports you can access</small></article>
        <article class="stat-card"><span class="stat-icon orange">◷</span><p>Pending</p><strong id="pendingCount">0</strong><small>Awaiting collection</small></article>
        <article class="stat-card"><span class="stat-icon blue">↻</span><p>In progress</p><strong id="progressCount">0</strong><small>Being handled</small></article>
        <article class="stat-card"><span class="stat-icon purple">✓</span><p>Collected</p><strong id="collectedCount">0</strong><small>Completed collections</small></article>
      </div>
    </section>
    <section class="panel" id="analytics"><div class="section-heading"><div><p class="eyebrow">PERFORMANCE INSIGHTS</p><h2>Community analytics</h2></div></div><div id="analyticsContent">Loading analytics…</div></section>
    <section class="panel" id="new-report">
      <div class="section-heading"><div><p class="eyebrow">REPORT MANAGEMENT</p><h2>Create a waste report</h2></div></div>
      <form id="reportForm">
        <div class="form-grid">
          ${admin||officer?'<label>Resident / reporter name<input name="residentName" required maxlength="100" placeholder="Full name"></label>':''}
          <label>Community<select name="community" ${currentUser.role==='resident'?'disabled':''} required>${currentUser.role==='resident'?`<option value="${esc(currentUser.community)}">${esc(currentUser.community)}</option>`:'<option value="">Choose community</option>'+communityOptions()}</select></label>
          <label>Waste type<select name="wasteType" required><option value="">Choose waste type</option>${WASTE_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></label>
          <div class="quantity-row"><label>Quantity<input name="quantity" type="number" min="0.1" step="0.1" required placeholder="e.g. 5"></label><label>Unit<select name="unit"><option value="kg">kg</option><option value="bags">bags</option><option value="bins">bins</option></select></label></div>
          <label>Collection location<input name="location" required maxlength="150" placeholder="Village, road or landmark"></label>
          <label>Collection date<input name="collectionDate" type="date" required></label>
          <label class="full">Description<textarea name="description" rows="3" maxlength="1000" placeholder="Additional information"></textarea></label>
          <label class="full">Waste photograph (JPG, PNG or WEBP, max 5 MB)<input id="reportPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>
        </div>
        <div class="form-actions"><button class="btn primary" type="submit">Save report</button><button class="btn outline" type="reset">Clear</button></div>
      </form>
      <p id="reportNotice" class="notice"></p>
    </section>
    <section class="panel" id="reports">
      <div class="section-heading"><div><p class="eyebrow">RECORDS</p><h2>Waste collection reports</h2></div><span id="recordCount" class="muted">0 records</span></div>
      <div class="filters">
        <input id="searchInput" type="search" placeholder="Search reporter, location or waste type">
        ${admin?`<select id="communityFilter"><option value="">All communities</option>${communityOptions()}</select>`:''}
        <select id="statusFilter"><option value="">All statuses</option><option>Pending</option><option>In Progress</option><option>Collected</option></select>
        <button id="clearFilters" class="btn outline">Clear filters</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Reporter</th><th>Community</th><th>Waste type</th><th>Quantity</th><th>Location</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="reportsTable"><tr><td colspan="8" class="empty">Loading reports…</td></tr></tbody></table></div>
    </section>
    ${admin?`
    <section class="panel" id="users">
      <div class="section-heading"><div><p class="eyebrow">ACCESS CONTROL</p><h2>Create a community officer</h2></div></div>
      <form id="officerForm"><div class="form-grid">
        <label>Full name<input name="fullName" required maxlength="100"></label>
        <label>Email<input name="email" type="email" required></label>
        <label>Temporary password<input name="password" type="password" minlength="8" required></label>
        <label>Assigned community<select name="community" required><option value="">Choose community</option>${communityOptions()}</select></label>
        <div class="full"><button class="btn primary" type="submit">Create officer account</button></div>
      </div></form>
      <p id="userNotice" class="notice"></p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Community</th><th>Account</th><th>Action</th></tr></thead><tbody id="usersTable"><tr><td colspan="6" class="empty">Loading users…</td></tr></tbody></table></div>
    </section>`:''}

    ${admin?`<section class="panel" id="teams"><div class="section-heading"><div><p class="eyebrow">FIELD OPERATIONS</p><h2>Collection team management</h2></div></div><form id="teamForm"><div class="form-grid"><label>Community<select name="community" required><option value="">Choose community</option>${communityOptions()}</select></label><label>Team name<input name="name" required maxlength="100" placeholder="e.g. Bugema Team A"></label><label>Team leader<input name="teamLead" maxlength="100"></label><div class="full"><button class="btn primary">Create team</button></div></div></form><p id="teamNotice" class="notice"></p><div id="teamList" class="table-wrap">Loading teams…</div></section>`:''}
    ${(admin||officer)?`<section class="panel" id="schedules"><div class="section-heading"><div><p class="eyebrow">COLLECTION OPERATIONS</p><h2>Collection schedules and teams</h2></div></div>
      <form id="scheduleForm"><div class="form-grid">${admin?`<label>Community<select name="community" required><option value="">Choose community</option>${communityOptions()}</select></label>`:''}<label>Collection date<input name="collectionDate" type="date" required></label><label>Location<input name="location" required maxlength="150"></label><label>Waste type<select name="wasteType" required>${WASTE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></label><label>Collection team<select name="teamName" id="scheduleTeam" required><option value="">Choose team</option></select></label><label class="full">Notes<textarea name="notes" rows="2"></textarea></label><div class="full"><button class="btn primary">Add collection schedule</button></div></div></form><p id="scheduleNotice" class="notice"></p><div id="scheduleList" class="table-wrap">Loading schedules…</div></section>`:''}
    <section class="panel" id="notifications"><div class="section-heading"><div><p class="eyebrow">UPDATES</p><h2>Notifications</h2></div><button id="readAll" class="btn outline">Mark all as read</button></div><div id="notificationList">Loading notifications…</div></section>
    ${(admin||officer)?`<section class="panel" id="exports"><div class="section-heading"><div><p class="eyebrow">REPORTING</p><h2>Export reports</h2></div></div><p>Download the reports available to your account.</p><a class="btn outline" href="/api/exports/reports.pdf" id="pdfExport">Download PDF</a> <a class="btn outline" href="/api/exports/reports.xlsx" id="excelExport">Download Excel</a><p class="tiny">Exports require an active sign-in session; use the buttons below.</p></section>`:''}
    ${admin?`<section class="panel" id="activity"><div class="section-heading"><div><p class="eyebrow">SYSTEM AUDIT</p><h2>Recent activity</h2></div></div><div id="activityList">Loading activity…</div></section>`:''}
    <footer>EcoTrack · Bugema · Busiika · Namulonge · Kiwenda · Kiziri</footer>
  </main>
  <div id="modalRoot"></div>`;

  document.getElementById('logout').onclick = logout;
  app.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); document.getElementById(link.dataset.nav).scrollIntoView({behavior:'smooth'});
  }));
  document.getElementById('reportForm').addEventListener('submit', submitReport);
  document.getElementById('reportForm').elements.collectionDate.value = new Date().toISOString().slice(0,10);
  ['searchInput','statusFilter',...(admin?['communityFilter']:[])].forEach(id => {
    document.getElementById(id).addEventListener(id==='searchInput'?'input':'change', loadReports);
  });
  document.getElementById('clearFilters').onclick = () => {
    ['searchInput','statusFilter','communityFilter'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    loadReports();
  };
  if (admin) {
    document.getElementById('officerForm').addEventListener('submit', createOfficer);
    loadUsers();
  }
  if(document.getElementById('scheduleForm')) { document.getElementById('scheduleForm').addEventListener('submit',createSchedule); loadSchedules(); loadTeams(); }
  if(document.getElementById('teamForm')) { document.getElementById('teamForm').addEventListener('submit',createTeam); loadTeams(); }
  loadAnalytics();
  ['pdfExport','excelExport'].forEach(id=>{const link=document.getElementById(id);if(link)link.addEventListener('click',downloadExport);});
  document.getElementById('readAll').onclick=async()=>{await api('/notifications/read-all',{method:'PATCH'});loadNotifications();};
  loadNotifications();
  if(admin) loadActivity();
  loadReports();
}

function logout() {
  token = ''; currentUser = null; localStorage.removeItem('ecoToken'); authScreen('login');
}
async function renderDashboard() { dashboardShell(); }

async function submitReport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.quantity = Number(data.quantity);
  if (currentUser.role === 'resident') data.community = currentUser.community;
  try {
    const photo=document.getElementById('reportPhoto')?.files?.[0];
    if(photo){const fd=new FormData();fd.append('photo',photo);const up=await fetch(API+'/uploads/image',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});const uploaded=await up.json();if(!up.ok)throw new Error(uploaded.message||'Photo upload failed.');data.photoUrl=uploaded.url;}
    const result = await api('/reports', {method:'POST', body:JSON.stringify(data)});
    form.reset();
    form.elements.collectionDate.value = new Date().toISOString().slice(0,10);
    notice('reportNotice', result.message);
    loadReports();
  } catch (error) { notice('reportNotice', error.message, 'error'); }
}

async function loadReports() {
  const body = document.getElementById('reportsTable');
  if (!body) return;
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('searchInput').value.trim();
    const status = document.getElementById('statusFilter').value;
    const community = document.getElementById('communityFilter')?.value || '';
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (community) params.set('community', community);
    const reports = await api('/reports' + (params.size ? '?'+params.toString() : ''));
    document.getElementById('recordCount').textContent = `${reports.length} record${reports.length===1?'':'s'}`;
    document.getElementById('totalCount').textContent = reports.length;
    document.getElementById('pendingCount').textContent = reports.filter(r=>r.status==='Pending').length;
    document.getElementById('progressCount').textContent = reports.filter(r=>r.status==='In Progress').length;
    document.getElementById('collectedCount').textContent = reports.filter(r=>r.status==='Collected').length;
    body.innerHTML = reports.length ? reports.map(reportRow).join('') :
      '<tr><td colspan="8" class="empty">No reports found.</td></tr>';
    bindReportActions(reports);
  } catch (error) {
    body.innerHTML = `<tr><td colspan="8" class="empty">${esc(error.message)}</td></tr>`;
  }
}
function reportRow(r) {
  const admin = currentUser.role === 'administrator';
  const officer = currentUser.role === 'officer';
  const resident = currentUser.role === 'resident';
  const canEdit = admin || (officer && r.status !== 'Collected') || (resident && r.status === 'Pending');
  const canDelete = admin || (resident && r.status === 'Pending');
  const statusCell = admin || officer ? `<select class="status-select" data-status="${r._id}">
    ${['Pending','In Progress','Collected'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
  </select>` : `<span class="status status-${r.status.replace(/\s/g,'-')}">${esc(r.status)}</span>`;
  return `<tr>
    <td><b>${esc(r.residentName)}</b></td><td>${esc(r.community)}</td><td>${esc(r.wasteType)}</td>
    <td>${esc(r.quantity)} ${esc(r.unit)}</td><td>${esc(r.location)}${r.photoUrl?`<br><a href="${esc(r.photoUrl)}" target="_blank" rel="noopener">View photo</a>`:''}</td><td>${dateLabel(r.collectionDate)}</td>
    <td>${statusCell}</td><td>${canEdit?`<button class="text-btn" data-edit="${r._id}">Edit</button>`:''}
    ${canDelete?`<button class="text-btn danger" data-delete="${r._id}">Delete</button>`:'<span class="muted">—</span>'}</td>
  </tr>`;
}
function bindReportActions(reports) {
  document.querySelectorAll('[data-status]').forEach(select => select.addEventListener('change', async () => {
    try {
      await api('/reports/'+select.dataset.status,{method:'PUT',body:JSON.stringify({status:select.value})});
      await loadReports();
    } catch (error) { alert(error.message); loadReports(); }
  }));
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
    const report = reports.find(r=>r._id===button.dataset.edit);
    if (report) openEditModal(report);
  }));
  document.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try { await api('/reports/'+button.dataset.delete,{method:'DELETE'}); loadReports(); }
    catch (error) { alert(error.message); }
  }));
}
function openEditModal(report) {
  const admin = currentUser.role === 'administrator';
  const officer = currentUser.role === 'officer';
  const resident = currentUser.role === 'resident';
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-backdrop"><section class="modal">
    <div class="modal-head"><h3>Edit waste report</h3><button class="icon-btn" id="closeModal">✕</button></div>
    <form id="editForm"><div class="form-grid">
      ${admin||officer?`<label>Reporter name<input name="residentName" value="${esc(report.residentName)}" ${officer?'disabled':''} required></label>`:''}
      ${admin?`<label>Community<select name="community">${communityOptions(report.community)}</select></label>`:''}
      <label>Waste type<select name="wasteType">${WASTE_TYPES.map(t=>`<option ${t===report.wasteType?'selected':''}>${t}</option>`).join('')}</select></label>
      <div class="quantity-row"><label>Quantity<input name="quantity" type="number" min="0.1" step="0.1" value="${esc(report.quantity)}" required></label><label>Unit<select name="unit">${['kg','bags','bins'].map(u=>`<option ${u===report.unit?'selected':''}>${u}</option>`).join('')}</select></label></div>
      <label>Location<input name="location" value="${esc(report.location)}" required></label>
      <label>Collection date<input name="collectionDate" type="date" value="${dateValue(report.collectionDate)}" required></label>
      ${admin?`<label>Status<select name="status">${['Pending','In Progress','Collected'].map(s=>`<option ${s===report.status?'selected':''}>${s}</option>`).join('')}</select></label>`:''}
      <label class="full">Description<textarea name="description" rows="3">${esc(report.description||'')}</textarea></label>
    </div><div class="form-actions"><button class="btn primary" type="submit">Save changes</button><button class="btn outline" type="button" id="cancelEdit">Cancel</button></div><p id="editNotice" class="notice"></p></form>
  </section></div>`;
  const close = () => root.innerHTML = '';
  document.getElementById('closeModal').onclick = close;
  document.getElementById('cancelEdit').onclick = close;
  root.querySelector('.modal-backdrop').addEventListener('click', e=>{if(e.target.classList.contains('modal-backdrop'))close();});
  document.getElementById('editForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.quantity !== undefined) data.quantity = Number(data.quantity);
    if (resident) { delete data.residentName; delete data.community; delete data.status; }
    if (officer) { delete data.residentName; delete data.community; }
    try {
      await api('/reports/'+report._id,{method:'PUT',body:JSON.stringify(data)});
      close(); loadReports();
    } catch (error) { notice('editNotice',error.message,'error'); }
  });
}

async function createOfficer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await api('/users/officers',{method:'POST',body:JSON.stringify(data)});
    form.reset(); notice('userNotice',result.message); loadUsers();
  } catch (error) { notice('userNotice',error.message,'error'); }
}
async function loadUsers() {
  const body = document.getElementById('usersTable');
  if (!body) return;
  try {
    const users = await api('/users');
    body.innerHTML = users.map(user=>`<tr><td>${esc(user.fullName)}</td><td>${esc(user.email)}</td>
      <td>${esc(user.role)}</td><td>${esc(user.community||'—')}</td><td>${user.active?'Active':'Disabled'}</td>
      <td>${user.id===currentUser.id?'<span class="muted">Current account</span>':`<button class="text-btn" data-toggle="${user.id}" data-active="${user.active}">${user.active?'Disable':'Enable'}</button>`}</td></tr>`).join('');
    body.querySelectorAll('[data-toggle]').forEach(button=>button.addEventListener('click',async()=>{
      const active = button.dataset.active !== 'true';
      try { await api('/users/'+button.dataset.toggle,{method:'PATCH',body:JSON.stringify({active})}); loadUsers(); }
      catch(error){alert(error.message);}
    }));
  } catch(error) { body.innerHTML=`<tr><td colspan="6" class="empty">${esc(error.message)}</td></tr>`; }
}
async function start() {
  if (!token) {
    authScreen(location.hash==='#setup'?'setup':location.hash==='#register'?'register':'login');
    return;
  }
  try {
    const result = await api('/auth/me');
    currentUser = result.user;
    renderDashboard();
  } catch {
    token=''; localStorage.removeItem('ecoToken'); authScreen('login');
  }
}
start();

async function createSchedule(event){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{const r=await api('/schedules',{method:'POST',body:JSON.stringify(data)});event.currentTarget.reset();notice('scheduleNotice',r.message);loadSchedules();}catch(e){notice('scheduleNotice',e.message,'error');}}
async function loadSchedules(){const node=document.getElementById('scheduleList');if(!node)return;try{const rows=await api('/schedules');node.innerHTML=rows.length?`<table><thead><tr><th>Community</th><th>Date</th><th>Location</th><th>Waste</th><th>Team</th><th>Status</th><th>Update</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.community)}</td><td>${dateLabel(x.collectionDate)}</td><td>${esc(x.location)}</td><td>${esc(x.wasteType)}</td><td>${esc(x.teamName)}</td><td>${esc(x.status)}</td><td>${currentUser.role!=='resident'?`<select data-schedule="${x._id}"><option ${x.status==='Scheduled'?'selected':''}>Scheduled</option><option ${x.status==='In Progress'?'selected':''}>In Progress</option><option ${x.status==='Completed'?'selected':''}>Completed</option><option ${x.status==='Cancelled'?'selected':''}>Cancelled</option></select>`:'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">No collection schedules yet.</p>';node.querySelectorAll('[data-schedule]').forEach(el=>el.addEventListener('change',async()=>{try{await api('/schedules/'+el.dataset.schedule,{method:'PATCH',body:JSON.stringify({status:el.value})});loadSchedules();}catch(e){alert(e.message);}}));}catch(e){node.textContent=e.message;}}
async function loadNotifications(){const node=document.getElementById('notificationList');if(!node)return;try{const rows=await api('/notifications');node.innerHTML=rows.length?rows.map(n=>`<article class="notice-card ${n.read?'read':'unread'}"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${dateLabel(n.createdAt)}</small>${n.read?'':' <button class="text-btn" data-notice="'+n._id+'">Mark read</button>'}</article>`).join(''):'<p class="empty">No notifications yet.</p>';node.querySelectorAll('[data-notice]').forEach(b=>b.onclick=async()=>{await api('/notifications/'+b.dataset.notice+'/read',{method:'PATCH'});loadNotifications();});}catch(e){node.textContent=e.message;}}
async function loadActivity(){const node=document.getElementById('activityList');if(!node)return;try{const rows=await api('/activity');node.innerHTML=rows.length?`<table><thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th><th>Community</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${dateLabel(x.createdAt)}</td><td>${esc(x.actorName)}</td><td>${esc(x.action)}</td><td>${esc(x.details)}</td><td>${esc(x.community||'—')}</td></tr>`).join('')}</tbody></table>`:'<p class="empty">No activity recorded yet.</p>';}catch(e){node.textContent=e.message;}}

async function loadAnalytics(){const node=document.getElementById('analyticsContent');if(!node)return;try{const a=await api('/analytics');const max=Math.max(1,...a.byCommunity.map(x=>x.total));node.innerHTML=`<div class="analytics-kpis"><div><b>${a.total}</b><span>Total reports</span></div><div><b>${a.pending}</b><span>Pending</span></div><div><b>${a.inProgress}</b><span>In progress</span></div><div><b>${a.collected}</b><span>Collected</span></div></div><h3>Reports by community</h3><div class="bar-list">${a.byCommunity.map(x=>`<div class="bar-row"><span>${esc(x.name)}</span><div class="bar-track"><i style="width:${Math.round(x.total/max*100)}%"></i></div><b>${x.total}</b></div>`).join('')}</div><h3>Waste categories</h3><div class="category-list">${a.byWasteType.map(x=>`<span>${esc(x.name)}: <b>${x.total}</b></span>`).join('')}</div><h3>Last six months</h3><div class="month-list">${a.byMonth.map(x=>`<span>${esc(x.month)} <b>${x.total}</b></span>`).join('')}</div>`;}catch(e){node.textContent=e.message;}}
async function downloadExport(event){event.preventDefault();const link=event.currentTarget;try{const response=await fetch(link.href,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Export failed.');}const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=link.id==='pdfExport'?'ecotrack-waste-reports.pdf':'ecotrack-waste-reports.xlsx';a.click();URL.revokeObjectURL(url);}catch(e){alert(e.message);}}

async function createTeam(event){event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{const r=await api('/teams',{method:'POST',body:JSON.stringify(data)});event.currentTarget.reset();notice('teamNotice',r.message);loadTeams();}catch(e){notice('teamNotice',e.message,'error');}}
async function loadTeams(){try{const teams=await api('/teams');const select=document.getElementById('scheduleTeam');if(select){const current=select.value;select.innerHTML='<option value="">Choose team</option>'+teams.filter(t=>t.active).map(t=>`<option value="${esc(t.name)}" ${current===t.name?'selected':''}>${esc(t.community)} · ${esc(t.name)}</option>`).join('');}const list=document.getElementById('teamList');if(list)list.innerHTML=teams.length?`<table><thead><tr><th>Community</th><th>Team</th><th>Team leader</th><th>Status</th><th>Action</th></tr></thead><tbody>${teams.map(t=>`<tr><td>${esc(t.community)}</td><td>${esc(t.name)}</td><td>${esc(t.teamLead||'—')}</td><td>${t.active?'Active':'Inactive'}</td><td><button class="text-btn" data-team="${t._id}" data-active="${t.active}">${t.active?'Deactivate':'Activate'}</button></td></tr>`).join('')}</tbody></table>`:'<p class="empty">No teams created yet.</p>';list?.querySelectorAll('[data-team]').forEach(btn=>btn.onclick=async()=>{try{await api('/teams/'+btn.dataset.team,{method:'PATCH',body:JSON.stringify({active:btn.dataset.active!=='true'})});loadTeams();}catch(e){alert(e.message);}});}catch(e){const list=document.getElementById('teamList');if(list)list.textContent=e.message;}}
