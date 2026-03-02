const API_URL = window.location.origin + '/api';

let pods = [];
let currentUser = null;
let allPods = []; // Store unfiltered pods
let activeFilters = {
  jobType: '',
  location: '',
  date: '',
  urgent: 'all'
};

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    currentUser = JSON.parse(user);
    showMainApp();
    loadPods();
  } else {
    showAuthScreen();
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  // Auth forms
  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
  });
  
  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
  });
  
  document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
  document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
  
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('refreshBtn').addEventListener('click', loadPods);
  
  // Filter listeners
  document.getElementById('filterJobType').addEventListener('change', handleFilterChange);
  document.getElementById('filterLocation').addEventListener('change', handleFilterChange);
  document.getElementById('filterDate').addEventListener('change', handleFilterChange);
  document.getElementById('filterUrgent').addEventListener('change', handleFilterChange);
  document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
  
  // Close modals
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
      this.closest('.modal').style.display = 'none';
    });
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.style.display = 'none';
    }
  });
  
  // Admin forms
  const addPodForm = document.getElementById('addPodForm');
  if (addPodForm) {
    addPodForm.addEventListener('submit', handleAddPod);
  }
  
  const editPodForm = document.getElementById('editPodForm');
  if (editPodForm) {
    editPodForm.addEventListener('submit', handleEditPod);
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userName').textContent = currentUser.name;
  
  let badges = [currentUser.job_family, currentUser.level];
  if (currentUser.is_manager) badges.push('Manager');
  if (currentUser.is_bar_raiser) badges.push('Bar Raiser');
  if (currentUser.is_admin) badges.push('ADMIN');
  
  document.getElementById('userInfo').textContent = `${currentUser.email} | ${badges.join(' | ')}`;
  
  // Show "Add New Pod" button only for admins
  if (currentUser.is_admin) {
    document.getElementById('addPodBtn').style.display = 'inline-block';
    document.getElementById('addPodBtn').addEventListener('click', showAddPodModal);
  }
  
  // Show "View All Pods" button for everyone
  document.getElementById('viewAllBtn').style.display = 'inline-block';
  document.getElementById('viewAllBtn').addEventListener('click', toggleAllPodsView);
}

let isAllPodsView = false;

function toggleAllPodsView() {
  isAllPodsView = !isAllPodsView;
  const btn = document.getElementById('viewAllBtn');
  btn.textContent = isAllPodsView ? 'View My Eligible Slots' : 'View All Pods';
  
  // Clear filters when switching views
  clearFilters();
  loadPods();
}

function showAddPodModal() {
  // Hide main app and show spreadsheet view
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('spreadsheetView').style.display = 'block';
  initializeSpreadsheet();
}

function showEditPodModal(pod) {
  document.getElementById('editPodId').value = pod.id;
  document.getElementById('editPodNumber').value = pod.pod_number;
  document.getElementById('editJobType').value = pod.job_type;
  document.getElementById('editLevel').value = pod.level;
  document.getElementById('editLocation').value = pod.location;
  document.getElementById('editInterviewDate').value = pod.interview_date;
  document.getElementById('editTimeSlot').value = pod.time_slot;
  document.getElementById('editTimeZone').value = pod.time_zone;
  document.getElementById('editBusinessPoc').value = pod.business_poc || '';
  
  document.getElementById('editPodModal').style.display = 'block';
}

function closeSpreadsheet() {
  document.getElementById('spreadsheetView').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
}

let spreadsheetRows = [];

function initializeSpreadsheet() {
  spreadsheetRows = [];
  // Add 10 empty rows to start
  for (let i = 0; i < 10; i++) {
    addSpreadsheetRow();
  }
  renderSpreadsheet();
}

function addSpreadsheetRow() {
  spreadsheetRows.push({
    id: Date.now() + Math.random(),
    pod_number: '',
    job_type: 'DCEO',
    level: 'L3',
    location: '',
    interview_date: '',
    time_slot: '',
    time_zone: 'PT',
    business_poc: ''
  });
}

function renderSpreadsheet() {
  const tbody = document.getElementById('spreadsheetBody');
  tbody.innerHTML = spreadsheetRows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><input type="number" class="sheet-input" data-index="${index}" data-field="pod_number" value="${row.pod_number}" placeholder="Pod #"></td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="job_type">
          <option value="DCEO" ${row.job_type === 'DCEO' ? 'selected' : ''}>DCEO</option>
          <option value="DCO" ${row.job_type === 'DCO' ? 'selected' : ''}>DCO</option>
          <option value="ID" ${row.job_type === 'ID' ? 'selected' : ''}>ID</option>
        </select>
      </td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="level">
          <option value="L3" ${row.level === 'L3' ? 'selected' : ''}>L3</option>
          <option value="L4" ${row.level === 'L4' ? 'selected' : ''}>L4</option>
        </select>
      </td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="location" value="${row.location}" placeholder="IAD, PDX, etc."></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="interview_date" value="${row.interview_date}" placeholder="MM/DD/YYYY"></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="time_slot" value="${row.time_slot}" placeholder="1pm-4pm"></td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="time_zone">
          <option value="PT" ${row.time_zone === 'PT' ? 'selected' : ''}>PT</option>
          <option value="ET" ${row.time_zone === 'ET' ? 'selected' : ''}>ET</option>
          <option value="CT" ${row.time_zone === 'CT' ? 'selected' : ''}>CT</option>
          <option value="MT" ${row.time_zone === 'MT' ? 'selected' : ''}>MT</option>
        </select>
      </td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="business_poc" value="${row.business_poc}" placeholder="name/name"></td>
      <td><button class="btn btn-small btn-danger" onclick="deleteSpreadsheetRow(${index})">×</button></td>
    </tr>
  `).join('');
  
  // Attach event listeners
  document.querySelectorAll('.sheet-input').forEach(input => {
    input.addEventListener('change', handleSpreadsheetChange);
    input.addEventListener('input', handleSpreadsheetChange);
  });
}

function handleSpreadsheetChange(e) {
  const index = parseInt(e.target.getAttribute('data-index'));
  const field = e.target.getAttribute('data-field');
  spreadsheetRows[index][field] = e.target.value;
}

function deleteSpreadsheetRow(index) {
  spreadsheetRows.splice(index, 1);
  renderSpreadsheet();
}

function addMoreRows() {
  for (let i = 0; i < 5; i++) {
    addSpreadsheetRow();
  }
  renderSpreadsheet();
}

async function saveBulkPods() {
  // Filter out empty rows
  const validRows = spreadsheetRows.filter(row => 
    row.pod_number && row.location && row.interview_date && row.time_slot
  );
  
  if (validRows.length === 0) {
    alert('Please fill in at least one complete row (Pod #, Location, Date, and Time are required)');
    return;
  }
  
  const confirmMsg = `You are about to create ${validRows.length} pod(s). Continue?`;
  if (!confirm(confirmMsg)) return;
  
  document.getElementById('saveBulkBtn').disabled = true;
  document.getElementById('saveBulkBtn').textContent = 'Saving...';
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const row of validRows) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/pods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pod_number: parseInt(row.pod_number),
          job_type: row.job_type,
          level: row.level,
          location: row.location,
          interview_date: row.interview_date,
          time_slot: row.time_slot,
          time_zone: row.time_zone,
          business_poc: row.business_poc
        })
      });
      
      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error('Error creating pod:', error);
      errorCount++;
    }
  }
  
  document.getElementById('saveBulkBtn').disabled = false;
  document.getElementById('saveBulkBtn').textContent = 'Save All Pods';
  
  alert(`Created ${successCount} pod(s) successfully. ${errorCount > 0 ? errorCount + ' failed.' : ''}`);
  
  if (successCount > 0) {
    closeSpreadsheet();
    loadPods();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      currentUser = data.user;
      showMainApp();
      loadPods();
    } else {
      alert('Login failed. Please check your credentials.');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const job_family = document.getElementById('registerJobFamily').value;
  const level = document.getElementById('registerLevel').value;
  const is_manager = document.getElementById('managerYes').checked;
  const is_bar_raiser = document.getElementById('barRaiserYes').checked;
  
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, job_family, level, is_manager, is_bar_raiser })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.is_admin) {
        alert('Registration successful as ADMIN! You have full access to manage pods. Please login.');
      } else {
        alert('Registration successful! Please login.');
      }
      document.getElementById('showLogin').click();
      document.getElementById('registerFormElement').reset();
    } else {
      const data = await response.json();
      alert('Registration failed: ' + data.error);
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Registration failed');
  }
}

function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  showAuthScreen();
}

async function loadPods() {
  try {
    const token = localStorage.getItem('token');
    // If viewing all pods, use all-pods endpoint, otherwise use eligible pods endpoint
    const endpoint = isAllPodsView ? `${API_URL}/all-pods` : `${API_URL}/pods`;
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }
    
    allPods = await response.json();
    populateFilterDropdowns();
    applyFilters();
  } catch (error) {
    console.error('Error loading pods:', error);
    alert('Failed to load pods. Make sure the backend server is running.');
  }
}

function populateFilterDropdowns() {
  // Get unique locations
  const locations = [...new Set(allPods.map(pod => pod.location))].sort();
  const locationSelect = document.getElementById('filterLocation');
  locationSelect.innerHTML = '<option value="">All</option>' + 
    locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
  
  // Get unique dates
  const dates = [...new Set(allPods.map(pod => pod.interview_date))].sort((a, b) => {
    // Sort dates chronologically
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA - dateB;
  });
  const dateSelect = document.getElementById('filterDate');
  dateSelect.innerHTML = '<option value="">All</option>' + 
    dates.map(date => `<option value="${date}">${date}</option>`).join('');
}

function handleFilterChange(e) {
  const filterId = e.target.id;
  if (filterId === 'filterJobType') {
    activeFilters.jobType = e.target.value;
  } else if (filterId === 'filterLocation') {
    activeFilters.location = e.target.value;
  } else if (filterId === 'filterDate') {
    activeFilters.date = e.target.value;
  } else if (filterId === 'filterUrgent') {
    activeFilters.urgent = e.target.value;
  }
  applyFilters();
}

function clearFilters() {
  activeFilters = {
    jobType: '',
    location: '',
    date: '',
    urgent: 'all'
  };
  document.getElementById('filterJobType').value = '';
  document.getElementById('filterLocation').value = '';
  document.getElementById('filterDate').value = '';
  document.getElementById('filterUrgent').value = 'all';
  applyFilters();
}

function parseDate(dateStr) {
  // Parse dates in format MM/DD/YYYY or M/D/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parts[0] - 1, parts[1]);
  }
  return new Date(dateStr);
}

function applyFilters() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  pods = allPods.filter(pod => {
    // Filter by job type
    if (activeFilters.jobType && pod.job_type !== activeFilters.jobType) {
      return false;
    }
    
    // Filter by location
    if (activeFilters.location && pod.location !== activeFilters.location) {
      return false;
    }
    
    // Filter by date
    if (activeFilters.date && pod.interview_date !== activeFilters.date) {
      return false;
    }
    
    // Filter by urgency
    if (activeFilters.urgent !== 'all') {
      const podDate = parseDate(pod.interview_date);
      const daysDiff = Math.ceil((podDate - today) / (1000 * 60 * 60 * 24));
      
      if (activeFilters.urgent === 'urgent' && daysDiff > 7) {
        return false;
      }
      if (activeFilters.urgent === 'critical' && daysDiff > 3) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort pods by date (soonest first) - ALWAYS
  pods.sort((a, b) => {
    const dateA = parseDate(a.interview_date);
    const dateB = parseDate(b.interview_date);
    return dateA - dateB;
  });
  
  renderPods();
}

function renderPods() {
  const container = document.getElementById('podsContainer');
  
  if (pods.length === 0) {
    const hasActiveFilters = activeFilters.jobType || activeFilters.location || activeFilters.date || activeFilters.urgent !== 'all';
    const message = hasActiveFilters
      ? '<div class="no-slots"><p>No pods match your current filters.</p><p>Try adjusting or clearing the filters.</p></div>'
      : isAllPodsView 
        ? '<div class="no-slots"><p>No pods available at this time.</p></div>'
        : '<div class="no-slots"><p>No eligible interview slots available at this time.</p><p>Check back later or contact your coordinator.</p></div>';
    container.innerHTML = message;
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  container.innerHTML = pods.map(pod => {
    const locationCode = pod.location.split('-')[0].split(' ')[0].toUpperCase();
    
    // Calculate urgency
    const podDate = parseDate(pod.interview_date);
    const daysDiff = Math.ceil((podDate - today) / (1000 * 60 * 60 * 24));
    let urgencyBadge = '';
    let urgencyClass = '';
    
    if (daysDiff <= 3 && daysDiff >= 0) {
      urgencyBadge = '<span class="urgency-badge critical">CRITICAL - ' + daysDiff + ' days</span>';
      urgencyClass = 'pod-critical';
    } else if (daysDiff <= 7 && daysDiff >= 0) {
      urgencyBadge = '<span class="urgency-badge urgent">URGENT - ' + daysDiff + ' days</span>';
      urgencyClass = 'pod-urgent';
    }
    
    // Only show admin buttons (Edit/Delete) for admins in all pods view
    const adminButtons = (currentUser.is_admin && isAllPodsView) ? `
      <button class="btn btn-small edit-pod-btn" data-pod='${JSON.stringify(pod).replace(/'/g, "&apos;")}'>Edit</button>
      <button class="btn btn-small btn-danger delete-pod-btn" data-pod-id="${pod.id}">Delete</button>
    ` : '';
    
    return `
      <div class="pod-card ${urgencyClass}">
        <div class="pod-header">
          <h2>
            ${locationCode}-${pod.pod_number}
            <span class="job-type-badge">${pod.job_type}</span>
            <span class="level-badge ${pod.level.toLowerCase()}">${pod.level}</span>
            ${urgencyBadge}
          </h2>
          <div class="pod-info">
            <span><strong>Location:</strong> ${pod.location}</span>
            <span><strong>Date:</strong> ${pod.interview_date}</span>
            <span><strong>Time:</strong> ${pod.time_slot} ${pod.time_zone}</span>
            ${pod.business_poc ? `<span><strong>POC:</strong> ${pod.business_poc}</span>` : ''}
          </div>
          ${adminButtons ? `<div class="admin-actions">${adminButtons}</div>` : ''}
        </div>
        <div class="slots-grid">
          ${pod.slots.map(slot => renderSlot(slot, isAllPodsView)).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners to buttons
  attachSlotEventListeners();
}

function renderSlot(slot, showAll = false) {
  const isFilled = slot.status === 'filled';
  const cardClass = isFilled ? 'slot-card filled' : 'slot-card open';
  
  // Check if current user is eligible for this slot
  const isEligible = checkSlotEligibility(slot);
  
  return `
    <div class="${cardClass}">
      <div class="slot-header">Interviewer ${slot.slot_number}</div>
      <div class="slot-details">
        <div><strong>Focus:</strong> ${slot.focus_area}</div>
        <div><strong>LP:</strong> ${slot.leadership_principle}</div>
        <div><strong>Required:</strong> ${slot.required_job_family} (${slot.required_level})</div>
      </div>
      ${isFilled ? `
        <div class="slot-interviewer">
          <div>✓ ${slot.interviewer_name}</div>
          <div class="interviewer-email">${slot.interviewer_alias}</div>
        </div>
      ` : isEligible ? `
        <div class="slot-actions">
          <button class="btn btn-small btn-primary signup-btn" data-slot-id="${slot.id}">Sign Up</button>
        </div>
      ` : `
        <div class="slot-ineligible">
          <span>Not eligible for this slot</span>
        </div>
      `}
    </div>
  `;
}

function checkSlotEligibility(slot) {
  // Cluster Leaders can sign up for any slot
  if (currentUser.job_family === 'Cluster Leader') {
    return true;
  }
  
  const slotLevel = slot.required_level;
  const userLevel = currentUser.level;
  const requiredFamily = slot.required_job_family;
  
  // Check level requirements
  if (slotLevel.includes('L4+')) {
    if (!['L4', 'L5', 'L6', 'L7', 'L8'].includes(userLevel)) {
      return false;
    }
  } else if (slotLevel.includes('Manager')) {
    if (!currentUser.is_manager) {
      return false;
    }
  }
  
  // Check job family requirements
  if (requiredFamily === 'Any') {
    return true;
  }
  
  // Check if slot requires a manager from specific job family
  if (requiredFamily.includes('Manager')) {
    const familyPart = requiredFamily.replace(' Manager', '').replace('/Chief Engineer', '');
    
    if (!currentUser.is_manager) {
      return false;
    }
    if (!familyPart.includes(currentUser.job_family)) {
      return false;
    }
    
    return true;
  }
  
  // For non-manager slots, check if user's job family matches
  if (requiredFamily === currentUser.job_family) {
    return true;
  }
  
  return false;
}

function attachSlotEventListeners() {
  // Sign up buttons
  document.querySelectorAll('.signup-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const slotId = this.getAttribute('data-slot-id');
      if (confirm('Sign up for this interview slot?')) {
        handleDirectSignup(slotId);
      }
    });
  });
  
  // Edit pod buttons
  document.querySelectorAll('.edit-pod-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const pod = JSON.parse(this.getAttribute('data-pod').replace(/&apos;/g, "'"));
      showEditPodModal(pod);
    });
  });
  
  // Delete pod buttons
  document.querySelectorAll('.delete-pod-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const podId = this.getAttribute('data-pod-id');
      if (confirm('Are you sure you want to delete this pod? This cannot be undone.')) {
        deletePod(podId);
      }
    });
  });
}

async function handleDirectSignup(slotId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/slots/${slotId}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      alert('Successfully signed up!');
      loadPods();
    } else {
      alert('Failed to sign up');
    }
  } catch (error) {
    console.error('Error signing up:', error);
    alert('Failed to sign up');
  }
}

async function handleAddPod(e) {
  e.preventDefault();
  
  const podData = {
    pod_number: parseInt(document.getElementById('podNumber').value),
    job_type: document.getElementById('jobType').value,
    level: document.getElementById('level').value,
    location: document.getElementById('location').value,
    interview_date: document.getElementById('interviewDate').value,
    time_slot: document.getElementById('timeSlot').value,
    time_zone: document.getElementById('timeZone').value,
    business_poc: document.getElementById('businessPoc').value
  };
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/pods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(podData)
    });
    
    if (response.ok) {
      alert('Pod created successfully!');
      document.getElementById('addPodModal').style.display = 'none';
      document.getElementById('addPodForm').reset();
      loadPods();
    } else {
      const data = await response.json();
      alert('Failed to create pod: ' + data.error);
    }
  } catch (error) {
    console.error('Error creating pod:', error);
    alert('Failed to create pod');
  }
}

async function handleEditPod(e) {
  e.preventDefault();
  
  const podId = document.getElementById('editPodId').value;
  const podData = {
    pod_number: parseInt(document.getElementById('editPodNumber').value),
    job_type: document.getElementById('editJobType').value,
    level: document.getElementById('editLevel').value,
    location: document.getElementById('editLocation').value,
    interview_date: document.getElementById('editInterviewDate').value,
    time_slot: document.getElementById('editTimeSlot').value,
    time_zone: document.getElementById('editTimeZone').value,
    business_poc: document.getElementById('editBusinessPoc').value
  };
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/pods/${podId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(podData)
    });
    
    if (response.ok) {
      alert('Pod updated successfully!');
      document.getElementById('editPodModal').style.display = 'none';
      loadPods();
    } else {
      const data = await response.json();
      alert('Failed to update pod: ' + data.error);
    }
  } catch (error) {
    console.error('Error updating pod:', error);
    alert('Failed to update pod');
  }
}

async function deletePod(podId) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/pods/${podId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      alert('Pod deleted successfully!');
      loadPods();
    } else {
      alert('Failed to delete pod');
    }
  } catch (error) {
    console.error('Error deleting pod:', error);
    alert('Failed to delete pod');
  }
}


