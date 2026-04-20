/* ============================================================
   ATTENDANCE PRO — script.js
   Shared across ALL pages. No React. Pure Vanilla JS.
   ============================================================ */

/* ══════════════════════════════════════════
   GLOBAL STATE  (persisted in localStorage)
══════════════════════════════════════════ */
let students   = JSON.parse(localStorage.getItem('students')   || '[]');
let attendance = JSON.parse(localStorage.getItem('attendance') || '{}');

/* ══════════════════════════════════════════
   SAVE HELPERS
══════════════════════════════════════════ */
function saveStudents()   { localStorage.setItem('students',   JSON.stringify(students)); }
function saveAttendance() { localStorage.setItem('attendance', JSON.stringify(attendance)); }

function saveAndRefresh() {
  saveAttendance();
  renderAttendance();
  loadDashboard();
  loadActivity();
  loadChart();
  loadAttendanceTable();
}

/* ══════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  let wrap = document.getElementById('toastWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toastWrap';
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }

  const icons = { success: 'fas fa-check-circle', error: 'fas fa-times-circle', info: 'fas fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="${icons[type]}"></i><span>${msg}</span>`;
  wrap.appendChild(t);

  setTimeout(() => t.remove(), 3000);
}

/* ══════════════════════════════════════════
   DARK / LIGHT MODE
══════════════════════════════════════════ */
function toggleDarkMode() {
  document.body.classList.toggle('light');
  const isLight = document.body.classList.contains('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  const btn = document.querySelector('.dark-btn');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
}

// Apply saved theme on load
(function applyTheme() {
  const t = localStorage.getItem('theme');
  if (t === 'light') document.body.classList.add('light');
})();

/* ══════════════════════════════════════════
   LIVE CLOCK
══════════════════════════════════════════ */
function updateDateTime() {
  const el = document.getElementById('dateTime');
  if (!el) return;
  const now  = new Date();
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.textContent = time;
}
setInterval(updateDateTime, 1000);
updateDateTime();

/* ══════════════════════════════════════════
   STUDENTS
══════════════════════════════════════════ */
function addStudent() {
  const nameEl = document.getElementById('studentName');
  const rollEl = document.getElementById('studentRoll');
  const deptEl = document.getElementById('studentDept');
  const yearEl = document.getElementById('studentYear');

  const name = nameEl?.value.trim();
  const roll = rollEl?.value.trim();
  const dept = deptEl?.value || 'CSE';
  const year = yearEl?.value || '1st Year';

  if (!name || !roll) {
    showToast('Name and Roll No are required', 'error');
    return;
  }

  // Check duplicate roll
  if (students.some(s => s.roll.toLowerCase() === roll.toLowerCase())) {
    showToast('Roll number already exists', 'error');
    return;
  }

  students.push({ name, roll, dept, year });
  saveStudents();

  if (nameEl) nameEl.value = '';
  if (rollEl) rollEl.value = '';

  renderStudents();
  showToast(`${name} added successfully`, 'success');

  // Close modal if open
  const modal = document.getElementById('addStudentModal');
  if (modal) modal.classList.add('hidden');
}

function deleteStudent(index) {
  const name = students[index]?.name;
  if (!confirm(`Delete ${name}? Their attendance records will also be removed.`)) return;

  students.splice(index, 1);

  // Rebuild attendance keys after deletion
  const newAtt = {};
  Object.entries(attendance).forEach(([k, v]) => {
    const ki = parseInt(k);
    if (ki < index) newAtt[ki] = v;
    else if (ki > index) newAtt[ki - 1] = v;
  });
  attendance = newAtt;

  saveStudents();
  saveAttendance();
  renderStudents();
  loadDashboard();
  loadChart();
  showToast(`${name} removed`, 'info');
}

/* Search + filter state */
let studentSearch  = '';
let studentFilter  = 'all';

function renderStudents() {
  const list = document.getElementById('studentList');
  if (!list) return;

  // Filter
  let filtered = students.map((s, i) => ({ ...s, _i: i }));

  if (studentSearch) {
    const q = studentSearch.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.roll.toLowerCase().includes(q) ||
      (s.dept||'').toLowerCase().includes(q)
    );
  }

  if (studentFilter !== 'all') {
    filtered = filtered.filter(s => (s.dept||'CSE') === studentFilter);
  }

  // Update count
  const countEl = document.getElementById('studentCount');
  if (countEl) countEl.textContent = `${filtered.length} of ${students.length} students`;

  if (filtered.length === 0) {
    list.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <i class="fas fa-user-graduate"></i>
        <p>${students.length === 0 ? 'No students added yet. Click "+ Add Student" to get started.' : 'No students match your search.'}</p>
      </div>
    </td></tr>`;
    return;
  }

  list.innerHTML = filtered.map(s => {
    const pct = calcStudentPct(s._i);
    const color = pct >= 75 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
    const status = attendance[s._i] || 'not-marked';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);
              display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0;">
              ${s.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600;">${s.name}</div>
              <div style="font-size:11px;color:var(--text3);">${s._i < 9 ? 'S00' : 'S0'}${s._i + 1}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:var(--font-mono);font-size:13px;">${s.roll}</span></td>
        <td><span class="tag">${s.dept || 'CSE'}</span></td>
        <td><span class="tag">${s.year || '1st Year'}</span></td>
        <td>
          <div class="progress-wrap" style="min-width:120px;">
            <div class="progress-bar">
              <div class="progress-fill" style="width:${pct}%;background:${color};"></div>
            </div>
            <span class="progress-val" style="color:${color};">${pct}%</span>
          </div>
        </td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="badge ${status === 'not-marked' ? 'not-marked' : status.toLowerCase()}">
              ${status === 'not-marked' ? '— Not Marked' : status}
            </span>
            <button class="btn btn-danger btn-xs" onclick="deleteStudent(${s._i})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function calcStudentPct(index) {
  const s = students[index];
  if (!s) return 0;
  // Simple: use attendance marked today as proxy
  const status = attendance[index];
  if (!status) return 0;
  return status === 'Present' ? 100 : status === 'Late' ? 70 : 0;
}

/* ══════════════════════════════════════════
   ATTENDANCE
══════════════════════════════════════════ */
function renderAttendance() {
  const list = document.getElementById('attendanceMarkList');
  if (!list) return;

  if (students.length === 0) {
    list.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <i class="fas fa-check-circle"></i>
        <p>No students found. <a href="students.html" style="color:var(--accent);">Add students first →</a></p>
      </div>
    </td></tr>`;
    return;
  }

  list.innerHTML = students.map((s, i) => {
    const status = attendance[i] || '';
    return `
      <tr id="att-row-${i}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);
              display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">
              ${s.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:600;font-size:13px;">${s.name}</div>
              <div style="font-size:11px;color:var(--text3);">${s.roll}</div>
            </div>
          </div>
        </td>
        <td><span class="tag">${s.dept || 'CSE'}</span></td>
        <td id="att-time-${i}" style="font-family:var(--font-mono);font-size:12px;color:var(--text3);">
          ${status ? new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '—'}
        </td>
        <td id="att-status-${i}">
          ${status
            ? `<span class="badge ${status.toLowerCase()}">${status}</span>`
            : `<span class="badge not-marked">— Not Marked</span>`
          }
        </td>
        <td>
          <div class="att-actions">
            <button class="btn btn-green btn-sm ${status==='Present'?'active':''}" onclick="markStatus(${i},'Present')">
              <i class="fas fa-check"></i> Present
            </button>
            <button class="btn btn-amber btn-sm ${status==='Late'?'active':''}" onclick="markStatus(${i},'Late')">
              <i class="fas fa-clock"></i> Late
            </button>
            <button class="btn btn-danger btn-sm ${status==='Absent'?'active':''}" onclick="markStatus(${i},'Absent')">
              <i class="fas fa-times"></i> Absent
            </button>
            <button class="btn btn-purple btn-sm ${status==='Leave'?'active':''}" onclick="markStatus(${i},'Leave')">
              <i class="fas fa-calendar-minus"></i> Leave
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function markStatus(i, status) {
  attendance[i] = status;
  saveAndRefresh();

  // Update just that row (for performance)
  const statusCell = document.getElementById(`att-status-${i}`);
  const timeCell   = document.getElementById(`att-time-${i}`);
  if (statusCell) statusCell.innerHTML = `<span class="badge ${status.toLowerCase()}">${status}</span>`;
  if (timeCell)   timeCell.textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});

  showToast(`${students[i]?.name} marked ${status}`, 'success');
}

// Legacy aliases (keep your original functions working)
function markPresent(i) { markStatus(i, 'Present'); }
function markAbsent(i)  { markStatus(i, 'Absent'); }
function markLate(i)    { markStatus(i, 'Late'); }
function markLeave(i)   { markStatus(i, 'Leave'); }

/* Bulk mark all */
function markAllPresent() {
  if (students.length === 0) { showToast('No students to mark', 'error'); return; }
  students.forEach((_, i) => { attendance[i] = 'Present'; });
  saveAndRefresh();
  showToast(`All ${students.length} students marked Present`, 'success');
}

function clearAllAttendance() {
  if (!confirm('Clear all attendance for today?')) return;
  attendance = {};
  saveAndRefresh();
  showToast('Attendance cleared', 'info');
}

/* ══════════════════════════════════════════
   DASHBOARD — stat cards
══════════════════════════════════════════ */
function loadDashboard() {
  const vals    = Object.values(attendance);
  const present = vals.filter(a => a === 'Present').length;
  const late    = vals.filter(a => a === 'Late').length;
  const absent  = vals.filter(a => a === 'Absent').length;
  const leave   = vals.filter(a => a === 'Leave').length;
  const total   = students.length;
  const percent = total === 0 ? 0 : Math.round((present / total) * 100);

  setEl('totalStudents',    total);
  setEl('presentCount',     present);
  setEl('lateCount',        late);
  setEl('attendancePercent',percent + '%');
  setEl('absentCount',      absent);
  setEl('presentLegend',    present);
  setEl('lateLegend',       late);
  setEl('absentLegend',     absent);
  setEl('leaveLegend',      leave);
  setEl('centerPercent',    percent + '%');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ══════════════════════════════════════════
   DASHBOARD — Today's Attendance Table
══════════════════════════════════════════ */
function loadAttendanceTable() {
  const table = document.getElementById('attendanceList');
  if (!table) return;

  if (students.length === 0) {
    table.innerHTML = `<tr><td colspan="3">
      <div class="empty-state" style="padding:28px;">
        <i class="fas fa-users"></i>
        <p>No students yet. <a href="students.html" style="color:var(--accent);">Add students →</a></p>
      </div>
    </td></tr>`;
    return;
  }

  table.innerHTML = students.map((s, i) => {
    const status = attendance[i] || 'not-marked';
    const time   = status !== 'not-marked'
      ? new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
      : '—';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);
              display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">
              ${s.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight:500;font-size:13px;">${s.name}</div>
              <div style="font-size:11px;color:var(--text3);">${s.roll}</div>
            </div>
          </div>
        </td>
        <td style="font-family:var(--font-mono);font-size:12px;color:var(--text3);">${time}</td>
        <td>
          <span class="badge ${status === 'not-marked' ? 'not-marked' : status.toLowerCase()}">
            ${status === 'not-marked' ? '—' : status}
          </span>
        </td>
      </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════
   ACTIVITY FEED
══════════════════════════════════════════ */
function loadActivity() {
  const box = document.getElementById('activityFeed');
  if (!box) return;

  const entries = Object.entries(attendance);
  if (entries.length === 0) {
    box.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px;">No activity yet today.</div>`;
    return;
  }

  const colorMap = { Present:'var(--green)', Late:'var(--amber)', Absent:'var(--red)', Leave:'var(--purple)' };
  const iconMap  = { Present:'fa-check', Late:'fa-clock', Absent:'fa-times', Leave:'fa-calendar-minus' };

  box.innerHTML = entries.map(([i, status]) => {
    const s = students[i];
    if (!s) return '';
    const color = colorMap[status] || 'var(--text3)';
    const time  = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    return `
      <div class="activity-item">
        <div class="activity-dot" style="background:${color};"></div>
        <div class="activity-text">
          <strong>${s.name}</strong> marked <strong style="color:${color};">${status}</strong>
        </div>
        <div class="activity-time">${time}</div>
      </div>`;
  }).reverse().join('');
}

/* ══════════════════════════════════════════
   CHART
══════════════════════════════════════════ */
let chartInstance = null;

function loadChart() {
  const ctx = document.getElementById('attendanceChart');
  if (!ctx) return;

  const vals    = Object.values(attendance);
  const present = vals.filter(a => a === 'Present').length;
  const late    = vals.filter(a => a === 'Late').length;
  const absent  = vals.filter(a => a === 'Absent').length;
  const leave   = vals.filter(a => a === 'Leave').length;
  const total   = students.length || 1;
  const percent = Math.round((present / total) * 100);

  if (chartInstance) chartInstance.destroy();

  const isEmpty = (present + late + absent + leave) === 0;

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Late', 'Absent', 'Leave'],
      datasets: [{
        data: isEmpty ? [1, 0, 0, 0] : [present, late, absent, leave],
        backgroundColor: isEmpty
          ? ['#1e2d42']
          : ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 4,
      }]
    },
    options: {
      cutout: '72%',
      animation: {
        animateRotate: true,
        animateScale: false,
        duration: 1000,
        easing: 'easeOutQuart',
        onProgress(anim) {
          const prog = anim.currentStep / anim.numSteps;
          const el = document.getElementById('centerPercent');
          if (el) el.textContent = Math.round(prog * percent) + '%';
        },
        onComplete() {
          const el = document.getElementById('centerPercent');
          if (el) el.textContent = percent + '%';
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: !isEmpty } }
    }
  });
}

/* ══════════════════════════════════════════
   LOGIN
══════════════════════════════════════════ */
function login() {
  const email = document.getElementById('loginEmail')?.value.trim();
  const pass  = document.getElementById('loginPass')?.value.trim();
  const btn   = document.getElementById('loginBtn');

  if (!email || !pass) { showToast('Please enter email and password', 'error'); return; }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner spin"></i> Signing in…';
  }

  setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
}

function fillDemo() {
  const e = document.getElementById('loginEmail');
  const p = document.getElementById('loginPass');
  if (e) e.value = 'admin@school.edu';
  if (p) p.value = 'admin123';
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
window.onload = () => {
  updateDateTime();
  renderStudents();
  renderAttendance();
  loadDashboard();
  loadActivity();
  loadChart();
  loadAttendanceTable();

  // Student search live
  const searchEl = document.getElementById('searchStudents');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      studentSearch = e.target.value;
      renderStudents();
    });
  }
};