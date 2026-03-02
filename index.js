const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Initialize database
const db = new sqlite3.Database('./interviews.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS pods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pod_number INTEGER NOT NULL,
    job_type TEXT NOT NULL CHECK(job_type IN ('ID', 'DCO', 'DCEO')),
    level TEXT NOT NULL CHECK(level IN ('L3', 'L4')),
    location TEXT NOT NULL,
    interview_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    time_zone TEXT NOT NULL,
    business_poc TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS interview_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pod_id INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    focus_area TEXT NOT NULL,
    leadership_principle TEXT NOT NULL,
    required_job_family TEXT,
    required_level TEXT,
    interviewer_name TEXT,
    interviewer_alias TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'filled')),
    FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS interviewers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    job_family TEXT NOT NULL,
    level TEXT NOT NULL,
    is_manager BOOLEAN DEFAULT 0,
    is_bar_raiser BOOLEAN DEFAULT 0,
    is_admin BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed database
  db.get('SELECT COUNT(*) as count FROM pods', [], (err, row) => {
    if (!err && row.count === 0) {
      console.log('Seeding database...');
      
      const samplePods = [
        { pod_number: 110, job_type: 'DCEO', level: 'L3', location: 'IAD', interview_date: '4/2/2026', time_slot: '1am-12pm', time_zone: 'PT', business_poc: 'umeh/castroleo' },
        { pod_number: 38, job_type: 'DCO', level: 'L4', location: 'PDX', interview_date: '4/2/2026', time_slot: '1pm-4:30pm', time_zone: 'PT', business_poc: 'umeh/castroleo' },
        { pod_number: 40, job_type: 'ID', level: 'L3', location: 'IAD - Core', interview_date: '4/1/2026', time_slot: '8:30am - 11:15 am', time_zone: 'ET', business_poc: 'leonle/noire' }
      ];
      
      samplePods.forEach(pod => {
        db.run(`INSERT INTO pods (pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [pod.pod_number, pod.job_type, pod.level, pod.location, pod.interview_date, pod.time_slot, pod.time_zone, pod.business_poc],
          function(err) {
            if (!err) {
              const podId = this.lastID;
              const slots = getSlotDefinitions(pod.job_type, pod.level);
              const numSlots = pod.level === 'L3' ? 3 : 4;
              
              slots.forEach((slot, index) => {
                if (index < numSlots) {
                  db.run(`INSERT INTO interview_slots (pod_id, slot_number, focus_area, leadership_principle, required_job_family, required_level) VALUES (?, ?, ?, ?, ?, ?)`,
                    [podId, index + 1, slot.focus_area, slot.leadership_principle, slot.required_job_family, slot.required_level]);
                }
              });
            }
          });
      });
      
      console.log('Database seeded');
    }
  });
});

// Auth middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.post('/api/register', (req, res) => {
  const { name, email, password, job_family, level, is_manager, is_bar_raiser } = req.body;
  
  // Automatically make Recruiting and Cluster Leader admins
  const is_admin = (job_family === 'Recruiting' || job_family === 'Cluster Leader') ? 1 : 0;
  
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`INSERT INTO interviewers (name, email, password, job_family, level, is_manager, is_bar_raiser, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hash, job_family, level, is_manager ? 1 : 0, is_bar_raiser ? 1 : 0, is_admin],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered' });
          return res.status(400).json({ error: err.message });
        }
        res.json({ message: 'Registration successful', id: this.lastID, is_admin });
      });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM interviewers WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!match) return res.status(401).json({ error: 'Invalid password' });
      
      const token = jwt.sign(
        { id: user.id, email: user.email, job_family: user.job_family, level: user.level, is_manager: user.is_manager, is_bar_raiser: user.is_bar_raiser, is_admin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, job_family: user.job_family, level: user.level, is_manager: user.is_manager, is_bar_raiser: user.is_bar_raiser, is_admin: user.is_admin } });
    });
  });
});

// Admin: Get ALL pods with all slots (filled and unfilled)
app.get('/api/admin/pods', verifyToken, (req, res) => {
  const user = req.user;
  
  if (!user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const query = `
    SELECT p.*, 
           json_group_array(
             json_object(
               'id', i.id,
               'slot_number', i.slot_number,
               'focus_area', i.focus_area,
               'leadership_principle', i.leadership_principle,
               'required_job_family', i.required_job_family,
               'required_level', i.required_level,
               'interviewer_name', i.interviewer_name,
               'interviewer_alias', i.interviewer_alias,
               'status', i.status
             )
           ) as slots
    FROM pods p
    LEFT JOIN interview_slots i ON p.id = i.pod_id
    GROUP BY p.id
    ORDER BY p.interview_date, p.time_slot
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const pods = rows.map(row => ({
      ...row,
      slots: JSON.parse(row.slots).filter(s => s.id !== null)
    }));
    
    res.json(pods);
  });
});

// Everyone: Get ALL pods with all slots (for "View All Pods" feature)
app.get('/api/all-pods', verifyToken, (req, res) => {
  const query = `
    SELECT p.*, 
           json_group_array(
             json_object(
               'id', i.id,
               'slot_number', i.slot_number,
               'focus_area', i.focus_area,
               'leadership_principle', i.leadership_principle,
               'required_job_family', i.required_job_family,
               'required_level', i.required_level,
               'interviewer_name', i.interviewer_name,
               'interviewer_alias', i.interviewer_alias,
               'status', i.status
             )
           ) as slots
    FROM pods p
    LEFT JOIN interview_slots i ON p.id = i.pod_id
    GROUP BY p.id
    ORDER BY p.interview_date, p.time_slot
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const pods = rows.map(row => ({
      ...row,
      slots: JSON.parse(row.slots).filter(s => s.id !== null)
    }));
    
    res.json(pods);
  });
});

// Regular users: Get eligible pods only
app.get('/api/pods', verifyToken, (req, res) => {
  const user = req.user;
  
  const query = `
    SELECT p.*, 
           json_group_array(
             json_object(
               'id', i.id,
               'slot_number', i.slot_number,
               'focus_area', i.focus_area,
               'leadership_principle', i.leadership_principle,
               'required_job_family', i.required_job_family,
               'required_level', i.required_level,
               'interviewer_name', i.interviewer_name,
               'interviewer_alias', i.interviewer_alias,
               'status', i.status
             )
           ) as slots
    FROM pods p
    LEFT JOIN interview_slots i ON p.id = i.pod_id
    GROUP BY p.id
    ORDER BY p.interview_date, p.time_slot
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const pods = rows.map(row => ({
      ...row,
      slots: JSON.parse(row.slots).filter(s => s.id !== null)
    }));
    
    const eligiblePods = pods.map(pod => ({
      ...pod,
      slots: pod.slots.filter(slot => {
        if (slot.status === 'filled') return false;
        
        // Cluster Leaders can sign up for ANY slot
        if (user.job_family === 'Cluster Leader') return true;
        
        const slotLevel = slot.required_level;
        const userLevel = user.level;
        const requiredFamily = slot.required_job_family;
        
        // Check level requirements
        if (slotLevel.includes('L4+')) {
          if (!['L4', 'L5', 'L6', 'L7', 'L8'].includes(userLevel)) return false;
        } else if (slotLevel.includes('Manager')) {
          if (!user.is_manager) return false;
        }
        
        // Check job family requirements
        if (requiredFamily === 'Any') {
          return true; // Anyone can fill this slot (if they meet level requirements)
        }
        
        // Check if slot requires a manager from specific job family
        if (requiredFamily.includes('Manager')) {
          // Extract the job family from "DCEO Manager", "ID Manager", etc.
          const familyPart = requiredFamily.replace(' Manager', '').replace('/Chief Engineer', '');
          
          // User must be a manager AND match the job family
          if (!user.is_manager) return false;
          if (!familyPart.includes(user.job_family)) return false;
          
          return true;
        }
        
        // For non-manager slots, check if user's job family matches
        // Handle cases like "DCEO" or "DCO" (exact match required)
        if (requiredFamily === user.job_family) {
          return true;
        }
        
        return false;
      })
    })).filter(pod => pod.slots.length > 0);
    
    res.json(eligiblePods);
  });
});

app.post('/api/slots/:id/signup', verifyToken, (req, res) => {
  const { id } = req.params;
  const user = req.user;
  
  db.get('SELECT * FROM interviewers WHERE id = ?', [user.id], (err, interviewer) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.run(`UPDATE interview_slots SET interviewer_name = ?, interviewer_alias = ?, status = 'filled' WHERE id = ?`,
      [interviewer.name, interviewer.email, id],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Signed up successfully' });
      });
  });
});

function getSlotDefinitions(jobType, level) {
  const definitions = {
    'DCEO': {
      'L3': [
        { focus_area: 'Electrical', leadership_principle: 'Bias for Action', required_job_family: 'DCEO Manager/Chief Engineer', required_level: 'Manager+' },
        { focus_area: 'Any', leadership_principle: 'Customer Obsession/Dive Deep', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Mechanical', leadership_principle: 'Learn & Be Curious', required_job_family: 'DCEO', required_level: 'L4+' }
      ],
      'L4': [
        { focus_area: 'Electrical', leadership_principle: 'Bias for Action', required_job_family: 'DCEO Manager', required_level: 'Manager' },
        { focus_area: 'Any', leadership_principle: 'Customer Obsession/Dive Deep', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Mechanical', leadership_principle: 'Learn & Be Curious', required_job_family: 'DCEO', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Insist on the Highest Standards/Deliver Results', required_job_family: 'Any', required_level: 'L4+' }
      ]
    },
    'ID': {
      'L3': [
        { focus_area: 'Tech', leadership_principle: 'Earn Trust', required_job_family: 'ID Manager', required_level: 'Manager' },
        { focus_area: 'Any', leadership_principle: 'Bias for Action/Customer Obsession', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Learn & Be Curious/Deliver Results', required_job_family: 'Any', required_level: 'L4+' }
      ],
      'L4': [
        { focus_area: 'Tech', leadership_principle: 'Earn Trust', required_job_family: 'ID Manager', required_level: 'Manager' },
        { focus_area: 'Any', leadership_principle: 'Bias for Action/Customer Obsession', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Learn & Be Curious/Deliver Results', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Ownership/Have Backbone Disagree & Commit', required_job_family: 'Any', required_level: 'L4+' }
      ]
    },
    'DCO': {
      'L3': [
        { focus_area: 'Ownership', leadership_principle: 'Insist on the Highest Standards', required_job_family: 'DCO Manager', required_level: 'Manager' },
        { focus_area: 'Hardware Troubleshooting + Networking', leadership_principle: 'Hardware Troubleshooting + Networking', required_job_family: 'DCO', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Customer Obsession/Learn And Be Curious', required_job_family: 'Any', required_level: 'L4+' }
      ],
      'L4': [
        { focus_area: 'Ownership', leadership_principle: 'Insist on the Highest Standards', required_job_family: 'DCO Manager', required_level: 'Manager' },
        { focus_area: 'Hardware Troubleshooting + Networking', leadership_principle: 'Hardware Troubleshooting + Networking', required_job_family: 'DCO', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Customer Obsession/Learn And Be Curious', required_job_family: 'Any', required_level: 'L4+' },
        { focus_area: 'Any', leadership_principle: 'Earn Trust/Deliver Results', required_job_family: 'Any', required_level: 'L4+' }
      ]
    }
  };
  
  return definitions[jobType]?.[level] || [];
}

// Admin: Create pod
app.post('/api/admin/pods', verifyToken, (req, res) => {
  const user = req.user;
  
  if (!user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc } = req.body;
  
  db.run(
    `INSERT INTO pods (pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      const podId = this.lastID;
      const numSlots = level === 'L3' ? 3 : 4;
      const slots = getSlotDefinitions(job_type, level);
      
      const stmt = db.prepare(`
        INSERT INTO interview_slots (pod_id, slot_number, focus_area, leadership_principle, required_job_family, required_level)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      slots.forEach((slot, index) => {
        if (index < numSlots) {
          stmt.run(podId, index + 1, slot.focus_area, slot.leadership_principle, slot.required_job_family, slot.required_level);
        }
      });
      
      stmt.finalize();
      res.json({ id: podId, message: 'Pod created successfully' });
    }
  );
});

// Admin: Delete pod
app.delete('/api/admin/pods/:id', verifyToken, (req, res) => {
  const user = req.user;
  
  if (!user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  db.run('DELETE FROM pods WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Pod deleted successfully' });
  });
});

// Admin: Update pod
app.put('/api/admin/pods/:id', verifyToken, (req, res) => {
  const user = req.user;
  
  if (!user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  const { pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc } = req.body;
  
  db.run(
    `UPDATE pods SET pod_number = ?, job_type = ?, level = ?, location = ?, interview_date = ?, time_slot = ?, time_zone = ?, business_poc = ? WHERE id = ?`,
    [pod_number, job_type, level, location, interview_date, time_slot, time_zone, business_poc, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Pod updated successfully' });
    }
  );
});

// Admin: Remove interviewer from slot
app.post('/api/admin/slots/:id/remove', verifyToken, (req, res) => {
  const user = req.user;
  
  if (!user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  db.run(
    `UPDATE interview_slots SET interviewer_name = NULL, interviewer_alias = NULL, status = 'open' WHERE id = ?`,
    [id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Interviewer removed successfully' });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
