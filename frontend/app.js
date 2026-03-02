const API_URL = window.location.origin + '/api';

let pods = [];
let currentUser = null;

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
  
  // Show admin buttons if user is admin
  if (currentUser.is_admin) {
    document.getElementById('addPodBtn').style.display = 'inline-block';
    document.getElementById('viewAllBtn').style.display = 'inline-block';
    
    // Setup admin button listeners
    document.getElementById('addPodBtn').addEventListener('click', showAddPodModal);
    document.getElementById('viewAllBtn').addEventListener('click', toggleAdminView);
  }
}

let isAdminView = false;

function toggleAdminView() {
  isAdminView = !isAdminView;
  const btn = document.getElementById('viewAllBtn');
  btn.textContent = isAdminView ? 'View My Eligible Slots' : 'View All Pods';
  loadPods();
}

function showAddPodModal() {
  document.getElementById('addPodModal').style.display = 'block';
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
    const endpoint = (currentUser.is_admin && isAdminView) ? `${API_URL}/admin/pods` : `${API_URL}/pods`;
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }
    
    pods = await response.json();
    renderPods();
  } catch (error) {
    console.error('Error loading pods:', error);
    alert('Failed to load pods. Make sure the backend server is running.');
  }
}

function renderPods() {
  const container = document.getElementById('podsContainer');
  
  if (pods.length === 0) {
    container.innerHTML = '<div class="no-slots"><p>No eligible interview slots available at this time.</p><p>Check back later or contact your coordinator.</p></div>';
    return;
  }
  
  container.innerHTML = pods.map(pod => {
    const locationCode = pod.location.split('-')[0].split(' ')[0].toUpperCase();
    const adminButtons = (currentUser.is_admin && isAdminView) ? `
      <button class="btn btn-small edit-pod-btn" data-pod='${JSON.stringify(pod).replace(/'/g, "&apos;")}'>Edit</button>
      <button class="btn btn-small btn-danger delete-pod-btn" data-pod-id="${pod.id}">Delete</button>
    ` : '';
    
    return `
      <div class="pod-card">
        <div class="pod-header">
          <h2>
            ${locationCode}-${pod.pod_number}
            <span class="job-type-badge">${pod.job_type}</span>
            <span class="level-badge ${pod.level.toLowerCase()}">${pod.level}</span>
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
          ${pod.slots.map(slot => renderSlot(slot, isAdminView)).join('')}
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
  
  // In admin view, show all slots. In regular view, only show open slots
  if (!showAll && isFilled) return '';
  
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
      ` : `
        <div class="slot-actions">
          <button class="btn btn-small btn-primary signup-btn" data-slot-id="${slot.id}">Sign Up</button>
        </div>
      `}
    </div>
  `;
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


