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
  // Ensure all views are properly hidden on load
  document.getElementById('spreadsheetView').style.display = 'none';
  document.getElementById('podManagementView').style.display = 'none';
  
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
  document.getElementById('myInterviewsBtn').addEventListener('click', showMyInterviews);
  
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
  document.getElementById('spreadsheetView').style.display = 'none';
  document.getElementById('podManagementView').style.display = 'none';
}

function showMainApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('spreadsheetView').style.display = 'none';
  document.getElementById('podManagementView').style.display = 'none';
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
  
  // Add table view toggle listener
  document.getElementById('toggleViewBtn').addEventListener('click', toggleTableView);
}

let isAllPodsView = false;

function toggleAllPodsView() {
  isAllPodsView = !isAllPodsView;
  const btn = document.getElementById('viewAllBtn');
  btn.textContent = isAllPodsView ? 'View My Eligible Slots' : 'View All Pods';
  
  // Show/hide table view toggle button
  const toggleViewBtn = document.getElementById('toggleViewBtn');
  if (isAllPodsView) {
    toggleViewBtn.style.display = 'inline-block';
  } else {
    toggleViewBtn.style.display = 'none';
    // Reset to card view when going back to eligible slots
    if (isTableView) {
      toggleTableView();
    }
  }
  
  // Clear filters when switching views
  clearFilters();
  loadPods();
}

let isTableView = false;

function toggleTableView() {
  isTableView = !isTableView;
  const viewModeText = document.getElementById('viewModeText');
  const podsContainer = document.getElementById('podsContainer');
  const podsTableContainer = document.getElementById('podsTableContainer');
  
  if (isTableView) {
    viewModeText.textContent = 'Card View';
    podsContainer.style.display = 'none';
    podsTableContainer.style.display = 'block';
    renderPodsTable();
  } else {
    viewModeText.textContent = 'Table View';
    podsContainer.style.display = 'block';
    podsTableContainer.style.display = 'none';
  }
}

function renderPodsTable() {
  const tbody = document.getElementById('podsTableBody');
  
  if (pods.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">No pods available</td></tr>';
    return;
  }
  
  tbody.innerHTML = pods.map(pod => {
    const slots = pod.slots || [];
    const getSlotText = (index) => {
      if (index >= slots.length) return '-';
      const slot = slots[index];
      return slot.interviewer_alias || 'Open';
    };
    
    // Calculate urgency class
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const podDate = parseDate(pod.interview_date);
    const daysDiff = Math.ceil((podDate - today) / (1000 * 60 * 60 * 24));
    let rowClass = '';
    if (daysDiff <= 3 && daysDiff >= 0) {
      rowClass = 'table-row-critical';
    } else if (daysDiff <= 7 && daysDiff >= 0) {
      rowClass = 'table-row-urgent';
    }
    
    const adminActions = currentUser.is_admin ? `
      <button class="btn-table btn-table-edit" onclick='editPodFromTable(${JSON.stringify(pod).replace(/'/g, "&apos;")})'>Edit</button>
      <button class="btn-table btn-table-delete" onclick="deletePodFromTable(${pod.id})">Delete</button>
    ` : '';
    
    return `
      <tr class="${rowClass}">
        <td>${pod.interview_date}</td>
        <td><strong>${pod.location}-${pod.pod_number}</strong></td>
        <td><span class="badge-small badge-${pod.job_type.toLowerCase()}">${pod.job_type}</span></td>
        <td><span class="badge-small badge-level">${pod.level}</span></td>
        <td>${pod.location}</td>
        <td>${pod.time_slot} ${pod.time_zone}</td>
        <td>${pod.debrief_date || pod.interview_date} ${pod.debrief_time || '-'}</td>
        <td class="slot-status ${slots[0]?.status === 'filled' ? 'filled' : 'open'}">${getSlotText(0)}</td>
        <td class="slot-status ${slots[1]?.status === 'filled' ? 'filled' : 'open'}">${getSlotText(1)}</td>
        <td class="slot-status ${slots[2]?.status === 'filled' ? 'filled' : 'open'}">${getSlotText(2)}</td>
        <td class="slot-status ${slots[3]?.status === 'filled' ? 'filled' : 'open'}">${getSlotText(3)}</td>
        <td class="slot-status ${slots[4]?.status === 'filled' ? 'filled' : 'open'}">${getSlotText(4)}</td>
        <td class="table-actions">${adminActions}</td>
      </tr>
    `;
  }).join('');
}

function editPodFromTable(pod) {
  showEditPodModal(pod);
}

function deletePodFromTable(podId) {
  deletePod(podId);
}

function showAddPodModal() {
  // Hide main app and show spreadsheet view directly
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('spreadsheetView').style.display = 'block';
  loadPodsIntoSpreadsheet();
  
  // Add keyboard shortcut for save (Ctrl+S or Cmd+S)
  document.addEventListener('keydown', handleSpreadsheetKeyboard);
}

function handleSpreadsheetKeyboard(e) {
  // Ctrl+S or Cmd+S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveBulkPods();
  }
}

async function loadPodsIntoSpreadsheet() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/pods`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }
    
    const pods = await response.json();
    
    // Convert existing pods to spreadsheet rows
    spreadsheetRows = pods.map(pod => ({
      id: pod.id, // Keep track of existing pod ID for editing
      pod_number: pod.pod_number,
      job_type: pod.job_type,
      level: pod.level,
      location: pod.location,
      interview_date: pod.interview_date,
      time_slot: pod.time_slot,
      time_zone: pod.time_zone,
      debrief_date: pod.debrief_date || '',
      debrief_time: pod.debrief_time || '',
      business_poc: pod.business_poc || '',
      slots: pod.slots || [], // Include slots data
      isExisting: true // Flag to know this is an existing pod
    }));
    
    // Add 10 empty rows for new pods
    for (let i = 0; i < 10; i++) {
      addSpreadsheetRow();
    }
    
    renderSpreadsheet();
  } catch (error) {
    console.error('Error loading pods:', error);
    alert('Failed to load pods');
  }
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
  document.removeEventListener('keydown', handleSpreadsheetKeyboard);
  loadPods();
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
    debrief_date: '',
    debrief_time: '',
    business_poc: ''
  });
}

function getSlotDisplay(row, slotIndex) {
  // If row doesn't have slots data or is empty, return dash
  if (!row.slots || row.slots.length === 0 || !row.pod_number) {
    return '-';
  }
  
  // Check if this slot index exists for this pod
  if (slotIndex >= row.slots.length) {
    return '-';
  }
  
  const slot = row.slots[slotIndex];
  
  // If slot is filled, show the user's alias
  if (slot.interviewer_alias) {
    return slot.interviewer_alias;
  }
  
  // Otherwise show "Open"
  return 'Open';
}

function renderSpreadsheet() {
  const tbody = document.getElementById('spreadsheetBody');
  tbody.innerHTML = spreadsheetRows.map((row, index) => {
    // Check if row is filled (has required fields)
    const isFilled = row.pod_number && row.location && row.interview_date && row.time_slot;
    const rowClass = isFilled ? 'row-filled' : 'row-empty';
    
    return `
    <tr class="${rowClass}">
      <td>${index + 1}</td>
      <td><input type="number" class="sheet-input" data-index="${index}" data-field="pod_number" value="${row.pod_number}" placeholder="Pod #" min="1" tabindex="${index * 9 + 1}"></td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="job_type" tabindex="${index * 9 + 2}">
          <option value="DCEO" ${row.job_type === 'DCEO' ? 'selected' : ''}>DCEO</option>
          <option value="DCO" ${row.job_type === 'DCO' ? 'selected' : ''}>DCO</option>
          <option value="ID" ${row.job_type === 'ID' ? 'selected' : ''}>ID</option>
        </select>
      </td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="level" tabindex="${index * 9 + 3}">
          <option value="L3" ${row.level === 'L3' ? 'selected' : ''}>L3</option>
          <option value="L4" ${row.level === 'L4' ? 'selected' : ''}>L4</option>
        </select>
      </td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="location" value="${row.location}" placeholder="IAD, PDX, etc." tabindex="${index * 9 + 4}"></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="interview_date" value="${row.interview_date}" placeholder="MM/DD/YYYY" tabindex="${index * 9 + 5}"></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="time_slot" value="${row.time_slot}" placeholder="1pm-4pm" tabindex="${index * 9 + 6}"></td>
      <td>
        <select class="sheet-input" data-index="${index}" data-field="time_zone" tabindex="${index * 9 + 7}">
          <option value="PT" ${row.time_zone === 'PT' ? 'selected' : ''}>PT</option>
          <option value="ET" ${row.time_zone === 'ET' ? 'selected' : ''}>ET</option>
          <option value="CT" ${row.time_zone === 'CT' ? 'selected' : ''}>CT</option>
          <option value="MT" ${row.time_zone === 'MT' ? 'selected' : ''}>MT</option>
        </select>
      </td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="debrief_date" value="${row.debrief_date || ''}" placeholder="MM/DD/YYYY" tabindex="${index * 9 + 8}"></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="debrief_time" value="${row.debrief_time || ''}" placeholder="5pm-5:30pm" tabindex="${index * 9 + 9}"></td>
      <td><input type="text" class="sheet-input" data-index="${index}" data-field="business_poc" value="${row.business_poc}" placeholder="name/name" tabindex="${index * 9 + 10}"></td>
      <td class="slot-cell slot-clickable" onclick="openSlotEditor(${index}, 0)" title="Click to manage interviewer">${getSlotDisplay(row, 0)}</td>
      <td class="slot-cell slot-clickable" onclick="openSlotEditor(${index}, 1)" title="Click to manage interviewer">${getSlotDisplay(row, 1)}</td>
      <td class="slot-cell slot-clickable" onclick="openSlotEditor(${index}, 2)" title="Click to manage interviewer">${getSlotDisplay(row, 2)}</td>
      <td class="slot-cell slot-clickable" onclick="openSlotEditor(${index}, 3)" title="Click to manage interviewer">${getSlotDisplay(row, 3)}</td>
      <td class="slot-cell slot-clickable" onclick="openSlotEditor(${index}, 4)" title="Click to manage interviewer">${getSlotDisplay(row, 4)}</td>
      <td>
        <button class="btn btn-small btn-danger" onclick="deleteSpreadsheetRow(${index})" title="Delete row" tabindex="${index * 9 + 11}">×</button>
      </td>
    </tr>
  `;
  }).join('');
  
  // Update row count and filled count
  const rowCountElement = document.getElementById('rowCount');
  if (rowCountElement) {
    const filledCount = spreadsheetRows.filter(row => 
      row.pod_number && row.location && row.interview_date && row.time_slot
    ).length;
    rowCountElement.textContent = `${spreadsheetRows.length} (${filledCount} filled)`;
  }
  
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

let currentSlotEditorRow = null;
let currentSlotEditorIndex = null;
let selectedInterviewerForSlot = null;

async function openSlotEditor(rowIndex, slotIndex) {
  const row = spreadsheetRows[rowIndex];
  
  // Check if pod exists (has an ID)
  if (!row.id) {
    alert('Please save this pod first before managing interviewers.');
    return;
  }
  
  // Check if slot exists
  if (!row.slots || slotIndex >= row.slots.length) {
    alert('This slot does not exist for this pod.');
    return;
  }
  
  currentSlotEditorRow = rowIndex;
  currentSlotEditorIndex = slotIndex;
  selectedInterviewerForSlot = null;
  
  const slot = row.slots[slotIndex];
  
  // Update modal content
  document.getElementById('slotEditorPodInfo').textContent = `${row.location}-${row.pod_number} (${row.job_type} ${row.level})`;
  const slotLabel = slot.is_bar_raiser ? 'Bar Raiser (Interviewer 5)' : 
                    slot.slot_number === 1 ? 'Interviewer 1 (Hiring Manager)' : 
                    `Interviewer ${slot.slot_number}`;
  document.getElementById('slotEditorSlotInfo').textContent = slotLabel;
  
  // Show current interviewer
  if (slot.interviewer_alias) {
    document.getElementById('currentInterviewerName').textContent = `${slot.interviewer_name} (${slot.interviewer_alias})`;
    document.getElementById('removeInterviewerBtn').style.display = 'inline-block';
  } else {
    document.getElementById('currentInterviewerName').textContent = 'None (Open)';
    document.getElementById('removeInterviewerBtn').style.display = 'none';
  }
  
  // Clear search and selection
  document.getElementById('slotInterviewerSearch').value = '';
  document.getElementById('slotInterviewerResults').innerHTML = '';
  document.getElementById('selectedInterviewerPreview').style.display = 'none';
  document.getElementById('saveInterviewerBtn').style.display = 'none';
  
  // Show modal
  document.getElementById('slotEditorModal').style.display = 'block';
}
function closeSlotEditor() {
  document.getElementById('slotEditorModal').style.display = 'none';
  currentSlotEditorRow = null;
  currentSlotEditorIndex = null;
  selectedInterviewerForSlot = null;
}

// Search for interviewers as user types
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('slotInterviewerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(searchInterviewers, 300));
  }
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function searchInterviewers() {
  const searchTerm = document.getElementById('slotInterviewerSearch').value.trim();
  const resultsDiv = document.getElementById('slotInterviewerResults');
  
  if (searchTerm.length < 2) {
    resultsDiv.innerHTML = '';
    return;
  }
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchTerm)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const users = await response.json();
      
      if (users.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No users found</p>';
      } else {
        resultsDiv.innerHTML = users.map(user => `
          <div class="interviewer-result-item" onclick="selectInterviewer(${user.id}, '${user.name.replace(/'/g, "\\'")}', '${user.email}', '${user.job_family}', '${user.level}')">
            <strong>${user.name}</strong> (${user.email})<br>
            <small>${user.job_family} • Level ${user.level}</small>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error searching interviewers:', error);
  }
}

function selectInterviewer(userId, userName, userEmail, jobFamily, level) {
  // Store the selected interviewer
  selectedInterviewerForSlot = { userId, userName, userEmail, jobFamily, level };
  
  // Show the selection preview
  document.getElementById('selectedInterviewerInfo').textContent = `${userName} (${userEmail}) - ${jobFamily} • Level ${level}`;
  document.getElementById('selectedInterviewerPreview').style.display = 'block';
  
  // Show the save button
  document.getElementById('saveInterviewerBtn').style.display = 'inline-block';
  
  // Clear the search results
  document.getElementById('slotInterviewerResults').innerHTML = '';
  document.getElementById('slotInterviewerSearch').value = '';
}

async function saveInterviewerAssignment() {
  if (!selectedInterviewerForSlot) {
    alert('Please select an interviewer first.');
    return;
  }
  
  const row = spreadsheetRows[currentSlotEditorRow];
  const slot = row.slots[currentSlotEditorIndex];
  
  // Disable the save button while saving
  const saveBtn = document.getElementById('saveInterviewerBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/slots/${slot.id}/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: selectedInterviewerForSlot.userId })
    });
    
    if (response.ok) {
      alert(`Successfully assigned ${selectedInterviewerForSlot.userName} to this slot!`);
      
      // Reload the spreadsheet to show updated data
      await loadPodsIntoSpreadsheet();
      
      closeSlotEditor();
    } else {
      const error = await response.json();
      alert(`Failed to assign interviewer: ${error.error || 'Unknown error'}`);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  } catch (error) {
    console.error('Error assigning interviewer:', error);
    alert('Failed to assign interviewer');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
}

async function removeSlotInterviewer() {
  if (!confirm('Are you sure you want to remove this interviewer from the slot?')) {
    return;
  }
  
  const row = spreadsheetRows[currentSlotEditorRow];
  const slot = row.slots[currentSlotEditorIndex];
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/admin/slots/${slot.id}/remove`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      alert('Interviewer removed successfully!');
      
      // Reload the spreadsheet to show updated data
      await loadPodsIntoSpreadsheet();
      
      closeSlotEditor();
    } else {
      const error = await response.json();
      alert(`Failed to remove interviewer: ${error.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error removing interviewer:', error);
    alert('Failed to remove interviewer');
  }
}

function addMoreRows() {
  for (let i = 0; i < 5; i++) {
    addSpreadsheetRow();
  }
  renderSpreadsheet();
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        alert('Excel file appears to be empty or has no data rows.');
        return;
      }
      
      // Get headers (first row)
      const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
      
      // Map column names to our field names
      const columnMap = {
        'pod number': 'pod_number',
        'pod #': 'pod_number',
        'pod': 'pod_number',
        'job type': 'job_type',
        'type': 'job_type',
        'level': 'level',
        'location': 'location',
        'interview date': 'interview_date',
        'date': 'interview_date',
        'time slot': 'time_slot',
        'time': 'time_slot',
        'interview time': 'time_slot',
        'time zone': 'time_zone',
        'timezone': 'time_zone',
        'tz': 'time_zone',
        'debrief date': 'debrief_date',
        'debrief time': 'debrief_time',
        'business poc': 'business_poc',
        'poc': 'business_poc'
      };
      
      // Clear existing rows and add new ones from Excel
      spreadsheetRows = [];
      
      // Process data rows (skip header row)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const newRow = {
          pod_number: '',
          job_type: 'DCEO',
          level: 'L3',
          location: '',
          interview_date: '',
          time_slot: '',
          time_zone: 'PT',
          debrief_date: '',
          debrief_time: '',
          business_poc: ''
        };
        
        // Map each column to our fields
        headers.forEach((header, index) => {
          const fieldName = columnMap[header];
          if (fieldName && row[index] !== undefined && row[index] !== null && row[index] !== '') {
            let value = String(row[index]).trim();
            
            // Handle specific field validations
            if (fieldName === 'job_type') {
              value = value.toUpperCase();
              if (!['DCEO', 'DCO', 'ID'].includes(value)) {
                value = 'DCEO'; // Default
              }
            } else if (fieldName === 'level') {
              value = value.toUpperCase();
              if (!['L3', 'L4'].includes(value)) {
                value = 'L3'; // Default
              }
            } else if (fieldName === 'time_zone') {
              value = value.toUpperCase();
              if (!['PT', 'ET', 'CT', 'MT'].includes(value)) {
                value = 'PT'; // Default
              }
            }
            
            newRow[fieldName] = value;
          }
        });
        
        // Only add row if it has at least a pod number
        if (newRow.pod_number) {
          spreadsheetRows.push(newRow);
        }
      }
      
      // Add some empty rows at the end
      for (let i = 0; i < 5; i++) {
        addSpreadsheetRow();
      }
      
      renderSpreadsheet();
      
      alert(`Successfully imported ${spreadsheetRows.length - 5} pods from Excel file!`);
      
    } catch (error) {
      console.error('Error parsing Excel file:', error);
      alert('Error reading Excel file. Please make sure it\'s a valid Excel file with the correct format.');
    }
  };
  
  reader.readAsArrayBuffer(file);
  
  // Reset the file input so the same file can be uploaded again
  event.target.value = '';
}

function downloadExcelTemplate() {
  // Create a sample template with headers and example data
  const templateData = [
    ['Pod Number', 'Job Type', 'Level', 'Location', 'Interview Date', 'Time Slot', 'Time Zone', 'Debrief Date', 'Debrief Time', 'Business POC', 'Interviewer 1 (HM)', 'Interviewer 2', 'Interviewer 3', 'Interviewer 4', 'Interviewer 5 (BR)'],
    [1, 'DCEO', 'L3', 'IAD', '03/15/2026', '1pm-4pm', 'ET', '03/15/2026', '4:30pm-5pm', 'John/Jane', '', '', '', '', ''],
    [2, 'DCO', 'L4', 'PDX', '03/20/2026', '9am-12pm', 'PT', '03/20/2026', '1pm-1:30pm', 'Alice/Bob', '', '', '', '', ''],
    [3, 'ID', 'L3', 'DFW', '03/25/2026', '2pm-5pm', 'CT', '03/25/2026', '5:30pm-6pm', 'Charlie/Dana', '', '', '', '', '']
  ];
  
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Pod Number
    { wch: 10 }, // Job Type
    { wch: 8 },  // Level
    { wch: 12 }, // Location
    { wch: 15 }, // Interview Date
    { wch: 15 }, // Time Slot
    { wch: 12 }, // Time Zone
    { wch: 15 }, // Debrief Date
    { wch: 15 }, // Debrief Time
    { wch: 15 }, // Business POC
    { wch: 16 }, // Interviewer 1 (HM)
    { wch: 12 }, // Interviewer 2
    { wch: 12 }, // Interviewer 3
    { wch: 12 }, // Interviewer 4
    { wch: 16 }  // Interviewer 5 (BR)
  ];
  
  // Add a note/instruction sheet
  const instructionsData = [
    ['Pod Upload Template - Instructions'],
    [''],
    ['Required Fields:'],
    ['- Pod Number: Unique number for the pod'],
    ['- Job Type: Must be DCEO, DCO, or ID'],
    ['- Level: Must be L3 or L4'],
    ['- Location: Airport code (IAD, PDX, DFW, etc.)'],
    ['- Interview Date: Format MM/DD/YYYY'],
    ['- Time Slot: Format like "1pm-4pm"'],
    ['- Time Zone: Must be PT, ET, CT, or MT'],
    [''],
    ['Optional Fields:'],
    ['- Debrief Date: Format MM/DD/YYYY (defaults to Interview Date if empty)'],
    ['- Debrief Time: Format like "4:30pm-5pm"'],
    ['- Business POC: Name/Name format'],
    ['- Interviewer 1-5: Leave empty for now (interviewers managed after pod creation)'],
    [''],
    ['Notes:'],
    ['- Interviewer 1 is always the Hiring Manager slot'],
    ['- L3 pods have 3 interviewers'],
    ['- L4 pods have 4 interviewers + 1 Bar Raiser (Interviewer 5)'],
    ['- Interviewer columns are for reference only - use the web interface to assign interviewers'],
    ['- After uploading, click on interviewer cells in the spreadsheet to assign interviewers']
  ];
  
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 80 }];
  
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
  XLSX.utils.book_append_sheet(wb, ws, 'Pod Template');
  
  // Generate and download the file
  XLSX.writeFile(wb, 'Pod_Upload_Template.xlsx');
}

async function saveBulkPods() {
  const token = localStorage.getItem('token');
  let successCount = 0;
  let errorCount = 0;
  
  document.getElementById('saveBulkBtn').disabled = true;
  document.getElementById('saveBulkBtn').textContent = 'Saving...';
  
  for (const row of spreadsheetRows) {
    // Skip empty rows
    if (!row.pod_number || !row.location || !row.interview_date || !row.time_slot) {
      continue;
    }
    
    try {
      const podData = {
        pod_number: parseInt(row.pod_number),
        job_type: row.job_type,
        level: row.level,
        location: row.location,
        interview_date: row.interview_date,
        time_slot: row.time_slot,
        time_zone: row.time_zone,
        debrief_date: row.debrief_date || '',
        debrief_time: row.debrief_time || '',
        business_poc: row.business_poc
      };
      
      // If row has an ID and isExisting flag, update it; otherwise create new
      const url = row.isExisting && row.id 
        ? `${API_URL}/admin/pods/${row.id}`
        : `${API_URL}/admin/pods`;
      
      const method = row.isExisting && row.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(podData)
      });
      
      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error('Error saving pod:', error);
      errorCount++;
    }
  }
  
  document.getElementById('saveBulkBtn').disabled = false;
  document.getElementById('saveBulkBtn').textContent = 'Save All Pods';
  
  alert(`Saved ${successCount} pod(s) successfully. ${errorCount > 0 ? errorCount + ' failed.' : ''}`);
  
  if (successCount > 0) {
    closeSpreadsheet();
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
  const alias = document.getElementById('registerAlias').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const timezone = document.getElementById('registerTimezone').value;
  const job_family = document.getElementById('registerJobFamily').value;
  const level = document.getElementById('registerLevel').value;
  const is_manager = document.getElementById('managerYes').checked;
  const is_bar_raiser = document.getElementById('barRaiserYes').checked;
  
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, alias, email, password, timezone, job_family, level, is_manager, is_bar_raiser })
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

// Timezone conversion utilities
const timezoneOffsets = {
  'PT': -8,  // Pacific Time (UTC-8)
  'MT': -7,  // Mountain Time (UTC-7)
  'CT': -6,  // Central Time (UTC-6)
  'ET': -5   // Eastern Time (UTC-5)
};

function convertTimeToUserTimezone(timeSlot, fromTimezone, toTimezone) {
  if (fromTimezone === toTimezone) {
    return timeSlot; // No conversion needed
  }
  
  // Extract time range (e.g., "1pm-4:30pm" or "8:30am - 11:15 am")
  const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
  const match = timeSlot.match(timePattern);
  
  if (!match) {
    return timeSlot + ` (${fromTimezone})`; // Return original if can't parse
  }
  
  const [_, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
  
  // Convert to 24-hour format
  let start24 = parseInt(startHour);
  if (startPeriod.toLowerCase() === 'pm' && start24 !== 12) start24 += 12;
  if (startPeriod.toLowerCase() === 'am' && start24 === 12) start24 = 0;
  
  let end24 = parseInt(endHour);
  if (endPeriod.toLowerCase() === 'pm' && end24 !== 12) end24 += 12;
  if (endPeriod.toLowerCase() === 'am' && end24 === 12) end24 = 0;
  
  // Calculate hour difference
  const hourDiff = timezoneOffsets[toTimezone] - timezoneOffsets[fromTimezone];
  
  // Apply conversion
  let newStart = start24 + hourDiff;
  let newEnd = end24 + hourDiff;
  
  // Handle day overflow/underflow
  let dayNote = '';
  if (newStart < 0) {
    newStart += 24;
    dayNote = ' (prev day)';
  } else if (newStart >= 24) {
    newStart -= 24;
    dayNote = ' (next day)';
  }
  
  if (newEnd < 0) {
    newEnd += 24;
  } else if (newEnd >= 24) {
    newEnd -= 24;
  }
  
  // Convert back to 12-hour format
  const formatTime = (hour24, minutes) => {
    const period = hour24 >= 12 ? 'pm' : 'am';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    return minutes ? `${hour12}:${minutes}${period}` : `${hour12}${period}`;
  };
  
  const startFormatted = formatTime(newStart, startMin);
  const endFormatted = formatTime(newEnd, endMin);
  
  return `${startFormatted}-${endFormatted}${dayNote}`;
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
    
    // Convert time to user's timezone
    const convertedTime = convertTimeToUserTimezone(pod.time_slot, pod.time_zone, currentUser.timezone);
    const timeDisplay = currentUser.timezone === pod.time_zone 
      ? `${pod.time_slot} ${pod.time_zone}`
      : `${convertedTime} ${currentUser.timezone} <span class="original-time">(${pod.time_slot} ${pod.time_zone})</span>`;
    
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
          <div class="pod-date-header">
            <span class="interview-date-large">📅 ${pod.interview_date}</span>
          </div>
          <h2>
            ${locationCode}-${pod.pod_number}
            <span class="job-type-badge">${pod.job_type}</span>
            <span class="level-badge ${pod.level.toLowerCase()}">${pod.level}</span>
            ${urgencyBadge}
          </h2>
          <div class="pod-info">
            <span><strong>Location:</strong> ${pod.location}</span>
            <span><strong>Interview Time:</strong> ${timeDisplay}</span>
            ${pod.debrief_date || pod.debrief_time ? `<span><strong>Debrief:</strong> ${pod.debrief_date || pod.interview_date} at ${pod.debrief_time ? convertTimeToUserTimezone(pod.debrief_time, pod.time_zone, currentUser.timezone) + ' ' + currentUser.timezone : 'TBD'}${pod.debrief_time && currentUser.timezone !== pod.time_zone ? ` <span class="original-time">(${pod.debrief_time} ${pod.time_zone})</span>` : ''}</span>` : ''}
            ${pod.business_poc ? `<span><strong>POC:</strong> ${pod.business_poc}</span>` : ''}
          </div>
          ${adminButtons ? `<div class="admin-actions">${adminButtons}</div>` : ''}
        </div>
        <div class="slots-grid">
          ${pod.slots.map(slot => renderSlot(slot, isAllPodsView, pod)).join('')}
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners to buttons
  attachSlotEventListeners();
  
  // Also render table view if in table mode
  if (isTableView) {
    renderPodsTable();
  }
}

function renderSlot(slot, showAll = false, pod = null) {
  const isFilled = slot.status === 'filled';
  const isBarRaiser = slot.is_bar_raiser || slot.required_job_family === 'Bar Raiser';
  const isHiringManager = slot.slot_number === 1;
  const cardClass = isFilled ? 'slot-card filled' : 
                    isBarRaiser ? 'slot-card open bar-raiser-slot' : 
                    isHiringManager ? 'slot-card open hiring-manager-slot' :
                    'slot-card open';
  
  // Check if current user is eligible for this slot
  const isEligible = checkSlotEligibility(slot);
  
  // Check if current user is the one who signed up for this slot
  const isCurrentUserSlot = isFilled && currentUser && slot.interviewer_alias === currentUser.email;
  
  // Combine focus area and leadership principle into competency
  const competency = isBarRaiser 
    ? slot.leadership_principle 
    : slot.focus_area === 'Any' 
      ? slot.leadership_principle 
      : `${slot.focus_area} / ${slot.leadership_principle}`;
  
  return `
    <div class="${cardClass}">
      <div class="slot-header">${isBarRaiser ? '⭐ Bar Raiser (Debrief Only)' : slot.slot_number === 1 ? '👔 Interviewer 1 (Hiring Manager)' : `Interviewer ${slot.slot_number}`}</div>
      <div class="slot-details">
        <div><strong>Competency:</strong> ${competency}</div>
        <div><strong>Required:</strong> ${slot.required_job_family} (${slot.required_level})</div>
        ${isBarRaiser ? '<div class="debrief-note">⏰ Attends debrief only, not the interview</div>' : ''}
      </div>
      ${isFilled ? `
        <div class="slot-interviewer">
          <div>✓ ${slot.interviewer_name}</div>
          <div class="interviewer-email">${slot.interviewer_alias}</div>
        </div>
        ${isCurrentUserSlot && pod ? `
          <div class="slot-actions">
            <button class="btn btn-small btn-secondary calendar-btn" 
                    data-pod='${JSON.stringify(pod).replace(/'/g, "&apos;")}' 
                    data-slot='${JSON.stringify(slot).replace(/'/g, "&apos;")}'>
              📅 Add Calendar Placeholder
            </button>
          </div>
        ` : ''}
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
  const focusArea = slot.focus_area || '';
  const lp = slot.leadership_principle || '';
  
  // Bar Raiser slots - only for Bar Raisers
  if (requiredFamily === 'Bar Raiser' || slot.is_bar_raiser) {
    return currentUser.is_bar_raiser;
  }
  
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
    // "Other" job family restrictions for "Any" slots
    if (currentUser.job_family === 'Other') {
      // Cannot do slots with these technical focus areas
      const restrictedFocusAreas = ['Electrical', 'Mechanical', 'Hardware Troubleshooting + Networking', 'Tech'];
      const combinedText = `${focusArea} ${lp}`.toLowerCase();
      
      // Check if any restricted term appears in focus area or LP
      const hasRestrictedContent = restrictedFocusAreas.some(term => 
        combinedText.includes(term.toLowerCase())
      ) || combinedText.includes('networking');
      
      if (hasRestrictedContent) {
        return false;
      }
    }
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
  
  // "Other" job family can do specific job family slots if not restricted
  if (currentUser.job_family === 'Other') {
    // Cannot do slots with these technical focus areas
    const restrictedFocusAreas = ['Electrical', 'Mechanical', 'Hardware Troubleshooting + Networking', 'Tech'];
    const combinedText = `${focusArea} ${lp}`.toLowerCase();
    
    // Check if any restricted term appears
    const hasRestrictedContent = restrictedFocusAreas.some(term => 
      combinedText.includes(term.toLowerCase())
    ) || combinedText.includes('networking');
    
    if (hasRestrictedContent) {
      return false;
    }
    
    // Can do non-restricted slots from specific job families
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
  
  // Calendar placeholder buttons
  document.querySelectorAll('.calendar-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const pod = JSON.parse(this.getAttribute('data-pod').replace(/&apos;/g, "'"));
      const slot = JSON.parse(this.getAttribute('data-slot').replace(/&apos;/g, "'"));
      downloadCalendarInvite(pod, slot);
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
      const data = await response.json();
      alert('Successfully signed up!');
      
      // Show calendar invite download option
      if (confirm('Would you like to download a placeholder calendar invite?')) {
        downloadCalendarInvite(data.pod, data.slot);
      }
      
      loadPods();
    } else if (response.status === 409) {
      // Conflict error
      const error = await response.json();
      alert(error.message || 'Time conflict: You are already signed up for another interview at this time.');
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to sign up');
    }
  } catch (error) {
    console.error('Error signing up:', error);
    alert('Failed to sign up');
  }
}

function downloadCalendarInvite(pod, slot) {
  // Parse the date
  const dateParts = pod.interview_date.split('/');
  const year = dateParts[2];
  const month = dateParts[0].padStart(2, '0');
  const day = dateParts[1].padStart(2, '0');
  
  // Parse the time slot (e.g., "1pm-4pm" or "8:30am-11:15am")
  const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)\s*-\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
  const match = pod.time_slot.match(timePattern);
  
  if (!match) {
    alert('Unable to parse time format');
    return;
  }
  
  const [_, startHour, startMin, startPeriod, endHour, endMin, endPeriod] = match;
  
  // Convert to 24-hour format
  let start24 = parseInt(startHour);
  if (startPeriod.toLowerCase() === 'pm' && start24 !== 12) start24 += 12;
  if (startPeriod.toLowerCase() === 'am' && start24 === 12) start24 = 0;
  
  let end24 = parseInt(endHour);
  if (endPeriod.toLowerCase() === 'pm' && end24 !== 12) end24 += 12;
  if (endPeriod.toLowerCase() === 'am' && end24 === 12) end24 = 0;
  
  // Format for iCalendar (YYYYMMDDTHHMMSS)
  const startTime = `${year}${month}${day}T${start24.toString().padStart(2, '0')}${(startMin || '00')}00`;
  const endTime = `${year}${month}${day}T${end24.toString().padStart(2, '0')}${(endMin || '00')}00`;
  
  // Get timezone abbreviation for iCal format
  const tzidMap = {
    'PT': 'America/Los_Angeles',
    'MT': 'America/Denver',
    'CT': 'America/Chicago',
    'ET': 'America/New_York'
  };
  const tzid = tzidMap[pod.time_zone] || 'America/Los_Angeles';
  
  // Generate unique ID
  const uid = `${pod.id}-${slot.id}-${Date.now()}@ais-interviewer-signup`;
  
  // Create iCalendar content
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AIS Interviewer POD Sign Up//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;TZID=${tzid}:${startTime}`,
    `DTEND;TZID=${tzid}:${endTime}`,
    `SUMMARY:PLACEHOLDER - ${pod.job_type} ${pod.level} Interview Pod ${pod.pod_number}`,
    `LOCATION:${pod.location}`,
    `DESCRIPTION:Interview Pod Details:\\n` +
    `Pod Number: ${pod.pod_number}\\n` +
    `Job Type: ${pod.job_type}\\n` +
    `Level: ${pod.level}\\n` +
    `Your Role: ${slot.focus_area}\\n` +
    `Leadership Principle: ${slot.leadership_principle}\\n` +
    `\\n` +
    `NOTE: This is a PLACEHOLDER calendar invite. ` +
    `You will receive the official calendar invite with candidate details and Chime link closer to the interview date.\\n` +
    `\\n` +
    `Business POC: ${pod.business_poc || 'TBD'}`,
    'STATUS:TENTATIVE',
    'SEQUENCE:0',
    `ORGANIZER;CN=AIS Recruiting:mailto:recruiting@example.com`,
    `ATTENDEE;CN=${currentUser.name};RSVP=TRUE:mailto:${currentUser.email}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview Pod Tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  
  // Create blob and download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = `PLACEHOLDER-Pod${pod.pod_number}-${pod.job_type}-${pod.level}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
      loadPodsIntoSpreadsheet();
    } else {
      alert('Failed to delete pod');
    }
  } catch (error) {
    console.error('Error deleting pod:', error);
    alert('Failed to delete pod');
  }
}




async function showMyInterviews() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/my-interviews`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status === 401) {
      handleLogout();
      return;
    }
    
    const myPods = await response.json();
    
    const modal = document.getElementById('myInterviewsModal');
    const calendar = document.getElementById('myInterviewsCalendar');
    
    if (myPods.length === 0) {
      calendar.innerHTML = '<div class="no-interviews"><p>You are not scheduled for any interviews yet.</p></div>';
      modal.style.display = 'block';
      return;
    }
    
    // Group events by date
    const eventsByDate = {};
    myPods.forEach(pod => {
      const interviewDate = pod.interview_date;
      const debriefDate = pod.debrief_date || pod.interview_date;
      
      // Add interview
      if (!eventsByDate[interviewDate]) {
        eventsByDate[interviewDate] = [];
      }
      eventsByDate[interviewDate].push({
        type: 'interview',
        pod: pod,
        slot: pod.slots[0]
      });
      
      // Add debrief
      if (!eventsByDate[debriefDate]) {
        eventsByDate[debriefDate] = [];
      }
      eventsByDate[debriefDate].push({
        type: 'debrief',
        pod: pod
      });
    });
    
    // Get date range
    const allDates = Object.keys(eventsByDate).map(d => parseDate(d));
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    
    // Generate calendar months
    const months = [];
    let currentMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    while (currentMonth <= endMonth) {
      months.push(new Date(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    calendar.innerHTML = months.map(monthDate => renderCalendarMonth(monthDate, eventsByDate)).join('');
    
    modal.style.display = 'block';
  } catch (error) {
    console.error('Error loading my interviews:', error);
    alert('Failed to load your scheduled interviews');
  }
}

function renderCalendarMonth(monthDate, eventsByDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
  
  // Build calendar grid
  let calendarHTML = `
    <div class="calendar-month">
      <div class="calendar-month-header">
        <h3>${monthName}</h3>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekday">Sun</div>
        <div class="calendar-weekday">Mon</div>
        <div class="calendar-weekday">Tue</div>
        <div class="calendar-weekday">Wed</div>
        <div class="calendar-weekday">Thu</div>
        <div class="calendar-weekday">Fri</div>
        <div class="calendar-weekday">Sat</div>
  `;
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarHTML += '<div class="calendar-cell empty"></div>';
  }
  
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${month + 1}/${day}/${year}`;
    const events = eventsByDate[dateStr] || [];
    const hasEvents = events.length > 0;
    const today = new Date();
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    
    calendarHTML += `
      <div class="calendar-cell ${hasEvents ? 'has-events' : ''} ${isToday ? 'today' : ''}">
        <div class="cell-date">${day}</div>
        ${hasEvents ? `
          <div class="cell-events">
            ${events.map(event => {
              if (event.type === 'interview') {
                const locationCode = event.pod.location.split('-')[0].split(' ')[0].toUpperCase();
                const isBarRaiser = event.slot.is_bar_raiser;
                const convertedTime = convertTimeToUserTimezone(event.pod.time_slot, event.pod.time_zone, currentUser.timezone);
                const timeStr = currentUser.timezone === event.pod.time_zone ? event.pod.time_slot : convertedTime;
                
                return `
                  <div class="cell-event interview-event ${isBarRaiser ? 'bar-raiser-mini' : ''}" title="${locationCode}-${event.pod.pod_number} Interview at ${timeStr}">
                    ${isBarRaiser ? '⭐' : '🎤'} ${timeStr.split('-')[0]} ${locationCode}-${event.pod.pod_number}
                  </div>
                `;
              } else {
                const locationCode = event.pod.location.split('-')[0].split(' ')[0].toUpperCase();
                const debriefTime = event.pod.debrief_time || 'TBD';
                const convertedTime = debriefTime !== 'TBD' ? convertTimeToUserTimezone(debriefTime, event.pod.time_zone, currentUser.timezone) : 'TBD';
                const timeStr = debriefTime === 'TBD' ? 'TBD' : (currentUser.timezone === event.pod.time_zone ? debriefTime : convertedTime);
                
                return `
                  <div class="cell-event debrief-event" title="${locationCode}-${event.pod.pod_number} Debrief at ${timeStr}">
                    💬 ${timeStr !== 'TBD' ? timeStr.split('-')[0] : 'TBD'} ${locationCode}-${event.pod.pod_number}
                  </div>
                `;
              }
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  calendarHTML += `
      </div>
    </div>
  `;
  
  return calendarHTML;
}
