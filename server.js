const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// Database setup
const DATA_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Create empty database files
const files = ['users.json', 'schools.json', 'students.json', 'guardians.json', 'reports.json', 'test_results.json', 'teachers.json'];
files.forEach(f => {
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});

function readData(f) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } 
    catch(e) { return []; }
}

function writeData(f, d) {
    try { fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2)); return true; } 
    catch(e) { return false; }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ===== API ROUTES =====

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server running' });
});

app.get('/api/schools', (req, res) => {
    res.json({ success: true, schools: readData('schools.json') });
});

app.post('/api/register-school', (req, res) => {
    const schools = readData('schools.json');
    const { name, location, phone, email, adminName, adminEmail, adminPassword } = req.body;
    
    if (schools.some(s => s.name === name)) {
        return res.json({ success: false, message: 'School already exists' });
    }

    const school = {
        id: generateId(),
        name,
        location: location || '',
        phone,
        email,
        adminName,
        adminEmail,
        students: 0,
        teachers: 0,
        verified: true,
        createdAt: new Date().toISOString()
    };
    schools.push(school);
    writeData('schools.json', schools);

    const users = readData('users.json');
    const admin = {
        id: generateId(),
        username: adminName,
        email: adminEmail,
        password: adminPassword,
        schoolId: school.id,
        isSchoolAdmin: true,
        isVerified: true,
        createdAt: new Date().toISOString()
    };
    users.push(admin);
    writeData('users.json', users);

    res.json({ success: true, message: 'School registered', school });
});

app.post('/api/signup', (req, res) => {
    const users = readData('users.json');
    const { username, email, password, phone, schoolId } = req.body;
    
    if (users.find(u => u.email === email)) {
        return res.json({ success: false, message: 'Email already registered' });
    }

    const user = {
        id: generateId(),
        username,
        email,
        password,
        phone: phone || '',
        schoolId,
        isSchoolAdmin: false,
        isVerified: true,
        createdAt: new Date().toISOString()
    };
    users.push(user);
    writeData('users.json', users);

    const userData = { ...user };
    delete userData.password;
    res.json({ success: true, message: 'Account created', user: userData });
});

app.post('/api/login', (req, res) => {
    const users = readData('users.json');
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.json({ success: false, message: 'Invalid credentials' });
    }

    const userData = { ...user };
    delete userData.password;
    res.json({ success: true, message: 'Login successful', token: 'token-' + Date.now(), user: userData });
});

app.get('/api/me', (req, res) => {
    const users = readData('users.json');
    if (users.length === 0) {
        return res.json({ success: false, message: 'No user found' });
    }
    const userData = { ...users[0] };
    delete userData.password;
    res.json({ success: true, user: userData });
});

app.post('/api/register-child', (req, res) => {
    const students = readData('students.json');
    const { childFirstName, childLastName, dateOfBirth, grade, guardianEmail, guardianPhone, schoolId } = req.body;
    
    const student = {
        id: generateId(),
        childFirstName,
        childLastName,
        fullName: `${childFirstName} ${childLastName}`,
        dateOfBirth,
        grade: parseInt(grade),
        guardianEmail,
        guardianPhone: guardianPhone || '',
        schoolId: schoolId || 'SCH001',
        verified: true,
        registrationDate: new Date().toISOString()
    };
    students.push(student);
    writeData('students.json', students);
    res.json({ success: true, message: 'Child registered', student });
});

app.get('/api/students/guardian/:email', (req, res) => {
    const students = readData('students.json');
    const filtered = students.filter(s => s.guardianEmail === req.params.email);
    res.json({ success: true, students: filtered });
});

app.get('/api/students', (req, res) => {
    res.json({ success: true, students: readData('students.json') });
});

app.delete('/api/students/:id', (req, res) => {
    let students = readData('students.json');
    students = students.filter(s => s.id !== req.params.id);
    writeData('students.json', students);
    res.json({ success: true, message: 'Student deleted' });
});

app.post('/api/reports', (req, res) => {
    const reports = readData('reports.json');
    const report = {
        id: generateId(),
        ...req.body,
        date: new Date().toISOString()
    };
    reports.push(report);
    writeData('reports.json', reports);
    res.json({ success: true, report });
});

app.get('/api/reports', (req, res) => {
    res.json({ success: true, reports: readData('reports.json') });
});

app.get('/api/reports/student/:studentId', (req, res) => {
    const reports = readData('reports.json');
    const filtered = reports.filter(r => r.studentId === req.params.studentId);
    res.json({ success: true, reports: filtered });
});

app.delete('/api/reports/:id', (req, res) => {
    let reports = readData('reports.json');
    reports = reports.filter(r => r.id !== req.params.id);
    writeData('reports.json', reports);
    res.json({ success: true, message: 'Report deleted' });
});

app.post('/api/teachers', (req, res) => {
    const teachers = readData('teachers.json');
    const teacher = {
        id: generateId(),
        ...req.body,
        addedAt: new Date().toISOString()
    };
    teachers.push(teacher);
    writeData('teachers.json', teachers);
    res.json({ success: true, teacher });
});

app.get('/api/teachers', (req, res) => {
    res.json({ success: true, teachers: readData('teachers.json') });
});

app.delete('/api/teachers/:id', (req, res) => {
    let teachers = readData('teachers.json');
    teachers = teachers.filter(t => t.id !== req.params.id);
    writeData('teachers.json', teachers);
    res.json({ success: true, message: 'Teacher deleted' });
});

app.post('/api/test-results', (req, res) => {
    const results = readData('test_results.json');
    const result = {
        id: generateId(),
        ...req.body,
        date: new Date().toISOString()
    };
    results.push(result);
    writeData('test_results.json', results);
    res.json({ success: true, testResult: result });
});

app.get('/api/test-results', (req, res) => {
    res.json({ success: true, results: readData('test_results.json') });
});

app.get('/api/test-results/child/:childId', (req, res) => {
    const results = readData('test_results.json');
    const filtered = results.filter(r => r.childId === req.params.childId);
    res.json({ success: true, results: filtered });
});

app.post('/api/verify', (req, res) => {
    res.json({ success: true, message: 'Email verified' });
});

app.post('/api/resend-verification', (req, res) => {
    res.json({ success: true, message: 'Code sent' });
});

app.post('/api/forgot-password', (req, res) => {
    res.json({ success: true, message: 'Reset code sent' });
});

app.post('/api/reset-password', (req, res) => {
    res.json({ success: true, message: 'Password reset' });
});

// ===== SERVE HTML PAGES - THIS IS WHAT YOU NEED =====

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// All HTML pages - this catches EVERY .html file
app.get('*', (req, res) => {
    // If it's an API route, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API not found' });
    }
    
    // Try to serve the file
    const filePath = path.join(__dirname, req.path);
    if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
        res.sendFile(filePath);
    } else {
        // If file doesn't exist, serve index.html
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});