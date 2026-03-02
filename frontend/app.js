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
  
  // Signup form
  document.getElementById('signupForm').addEventListener('submit', handleSignup);
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
    const response = await fetch(`${API_URL}/pods`, {
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
  
  container.innerHTML = pods.map(pod => `
    <div class="pod-card">
      <div class="pod-header">
        <h2>
          Pod #${pod.pod_number}
          <span class="job-type-badge">${pod.job_type}</span>
          <span class="level-badge ${pod.level.toLowerCase()}">${pod.level}</span>
        </h2>
        <div class="pod-info">
          <span><strong>Location:</strong> ${pod.location}</span>
          <span><strong>Date:</strong> ${pod.interview_date}</span>
          <span><strong>Time:</strong> ${pod.time_slot} ${pod.time_zone}</span>
          ${pod.business_poc ? `<span><strong>POC:</strong> ${pod.business_poc}</span>` : ''}
        </div>
      </div>
      <div class="slots-grid">
        ${pod.slots.map(slot => renderSlot(slot)).join('')}
      </div>
    </div>
  `).join('');
  
  // Attach event listeners to buttons
  attachSlotEventListeners();
}

function renderSlot(slot) {
  return `
    <div class="slot-card open">
      <div class="slot-header">Interviewer ${slot.slot_number}</div>
      <div class="slot-details">
        <div><strong>Focus:</strong> ${slot.focus_area}</div>
        <div><strong>LP:</strong> ${slot.leadership_principle}</div>
        <div><strong>Required:</strong> ${slot.required_job_family} (${slot.required_level})</div>
      </div>
      <div class="slot-actions">
        <button class="btn btn-small btn-primary signup-btn" data-slot-id="${slot.id}">Sign Up</button>
      </div>
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



