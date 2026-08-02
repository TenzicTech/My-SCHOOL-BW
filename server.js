const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// ===== DATABASE SETUP =====
// ============================================================
const DATA_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize all database files
const dataFiles = [
    'users.json', 
    'schools.json', 
    'students.json', 
    'guardians.json', 
    'reports.json', 
    'test_results.json', 
    'school_history.json', 
    'verifications.json', 
    'teachers.json'
];

dataFiles.forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }
});

// ============================================================
// ===== DATABASE HELPERS =====
// ============================================================
function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + 
           Math.random().toString(36).substr(2, 4).toUpperCase();
}

// ============================================================
// ===== MIDDLEWARE =====
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ============================================================
// ===== API ROUTES =====
// ============================================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server running!',
        timestamp: new Date().toISOString()
    });
});

// ===== SCHOOL ROUTES =====

// Get all schools
app.get('/api/schools', (req, res) => {
    const schools = readData('schools.json');
    res.json({ success: true, schools });
});

// Get school by ID
app.get('/api/school/:id', (req, res) => {
    const schools = readData('schools.json');
    const school = schools.find(s => s.id === req.params.id);
    res.json({ success: true, school: school || null });
});

// Register school
app.post('/api/register-school', (req, res) => {
    const schools = readData('schools.json');
    const { name, location, phone, email, adminName, adminEmail, adminPassword } = req.body;
    
    if (schools.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        return res.json({ success: false, message: 'School already registered' });
    }

    const newSchool = {
        id: generateId(),
        name,
        type: req.body.type || 'Public',
        location: location || '',
        country: req.body.country || 'Botswana',
        address: req.body.address || '',
        phone,
        email,
        website: req.body.website || '',
        description: req.body.description || '',
        grades: req.body.grades || [],
        language: req.body.language || 'English',
        students: 0,
        teachers: 0,
        totalSubjects: 0,
        totalClasses: 0,
        adminName,
        adminEmail,
        adminPhone: req.body.adminPhone || '',
        verified: true,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
    };

    schools.push(newSchool);
    writeData('schools.json', schools);

    // Create admin user
    const users = readData('users.json');
    const adminUser = {
        id: generateId(),
        username: adminName,
        email: adminEmail,
        password: adminPassword,
        phone: req.body.adminPhone || '',
        schoolId: newSchool.id,
        isSchoolAdmin: true,
        isVerified: true,
        createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    writeData('users.json', users);

    res.json({
        success: true,
        message: 'School registered successfully',
        school: newSchool,
        user: { id: adminUser.id, username: adminUser.username, email: adminUser.email }
    });
});

// ===== USER ROUTES =====

// Signup
app.post('/api/signup', (req, res) => {
    const users = readData('users.json');
    const { username, email, password, phone, schoolId } = req.body;
    
    if (users.find(u => u.email === email)) {
        return res.json({ success: false, message: 'Email already registered' });
    }

    const newUser = {
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
    
    users.push(newUser);
    writeData('users.json', users);

    const userData = { ...newUser };
    delete userData.password;

    res.json({
        success: true,
        message: 'User created successfully',
        user: userData,
        verificationCode: '123456'
    });
});

// Login
app.post('/api/login', (req, res) => {
    const users = readData('users.json');
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.json({ success: false, message: 'Invalid credentials' });
    }

    const userData = { ...user };
    delete userData.password;

    res.json({
        success: true,
        message: 'Login successful',
        token: 'token-' + Date.now(),
        user: userData
    });
});

// Get current user
app.get('/api/me', (req, res) => {
    const users = readData('users.json');
    const user = users.length > 0 ? users[0] : null;
    if (user) {
        const userData = { ...user };
        delete userData.password;
        res.json({ success: true, user: userData });
    } else {
        res.json({ success: false, message: 'No user found' });
    }
});

// ===== STUDENT ROUTES =====

// Register child
app.post('/api/register-child', (req, res) => {
    const students = readData('students.json');
    const { childFirstName, childLastName, dateOfBirth, grade, guardianEmail, guardianPhone, guardianFirstName, guardianLastName } = req.body;
    
    const fullName = `${childFirstName} ${childLastName}`;
    const newStudent = {
        id: generateId(),
        childFirstName,
        childLastName,
        fullName,
        dateOfBirth,
        grade: parseInt(grade),
        previousSchool: req.body.previousSchool || '',
        guardianFirstName: guardianFirstName || '',
        guardianLastName: guardianLastName || '',
        guardianEmail,
        guardianPhone: guardianPhone || '',
        schoolId: req.body.schoolId || 'SCH001',
        verified: true,
        registrationDate: new Date().toISOString()
    };
    
    students.push(newStudent);
    writeData('students.json', students);

    // Add to guardians
    const guardians = readData('guardians.json');
    guardians.push({
        id: generateId(),
        studentId: newStudent.id,
        guardianEmail,
        schoolId: req.body.schoolId || 'SCH001',
        childName: fullName,
        grade: parseInt(grade),
        registeredAt: new Date().toISOString()
    });
    writeData('guardians.json', guardians);

    res.json({
        success: true,
        message: 'Child registered successfully',
        student: newStudent
    });
});

// Get students by guardian
app.get('/api/students/guardian/:email', (req, res) => {
    const students = readData('students.json');
    const filtered = students.filter(s => s.guardianEmail === req.params.email);
    res.json({ success: true, students: filtered });
});

// Get all students
app.get('/api/students', (req, res) => {
    const students = readData('students.json');
    res.json({ success: true, students });
});

// Delete student
app.delete('/api/students/:id', (req, res) => {
    let students = readData('students.json');
    students = students.filter(s => s.id !== req.params.id);
    writeData('students.json', students);
    res.json({ success: true, message: 'Student deleted' });
});

// ===== REPORT ROUTES =====

// Add report
app.post('/api/reports', (req, res) => {
    const reports = readData('reports.json');
    const { studentId, subject, score, term, comment } = req.body;
    
    const students = readData('students.json');
    const student = students.find(s => s.id === studentId);
    
    const newReport = {
        id: generateId(),
        studentId,
        studentName: student ? student.fullName : 'Unknown',
        subject,
        score: parseInt(score),
        term,
        comment: comment || '',
        date: new Date().toISOString(),
        isAdminReport: true
    };
    
    reports.push(newReport);
    writeData('reports.json', reports);
    res.json({ success: true, report: newReport });
});

// Get all reports
app.get('/api/reports', (req, res) => {
    const reports = readData('reports.json');
    res.json({ success: true, reports });
});

// Get reports by student
app.get('/api/reports/student/:studentId', (req, res) => {
    const reports = readData('reports.json');
    const filtered = reports.filter(r => r.studentId === req.params.studentId);
    res.json({ success: true, reports: filtered });
});

// Delete report
app.delete('/api/reports/:id', (req, res) => {
    let reports = readData('reports.json');
    reports = reports.filter(r => r.id !== req.params.id);
    writeData('reports.json', reports);
    res.json({ success: true, message: 'Report deleted' });
});

// ===== TEACHER ROUTES =====

// Add teacher
app.post('/api/teachers', (req, res) => {
    const teachers = readData('teachers.json');
    const { firstName, lastName, email, subject, phone } = req.body;
    
    const newTeacher = {
        id: generateId(),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email,
        subject,
        phone: phone || '',
        schoolId: req.body.schoolId || 'SCH001',
        addedAt: new Date().toISOString()
    };
    
    teachers.push(newTeacher);
    writeData('teachers.json', teachers);
    res.json({ success: true, teacher: newTeacher });
});

// Get all teachers
app.get('/api/teachers', (req, res) => {
    const teachers = readData('teachers.json');
    res.json({ success: true, teachers });
});

// Delete teacher
app.delete('/api/teachers/:id', (req, res) => {
    let teachers = readData('teachers.json');
    teachers = teachers.filter(t => t.id !== req.params.id);
    writeData('teachers.json', teachers);
    res.json({ success: true, message: 'Teacher deleted' });
});

// ===== TEST RESULT ROUTES =====

// Save test result
app.post('/api/test-results', (req, res) => {
    const results = readData('test_results.json');
    const { childId, subject, grade, score, totalQuestions, correctAnswers } = req.body;
    
    const students = readData('students.json');
    const student = students.find(s => s.id === childId);
    
    const newResult = {
        id: generateId(),
        childId,
        childName: student ? student.fullName : 'Unknown',
        subject,
        grade: parseInt(grade),
        score: parseInt(score),
        totalQuestions: parseInt(totalQuestions),
        correctAnswers: parseInt(correctAnswers),
        passed: parseInt(score) >= 70,
        date: new Date().toISOString()
    };
    
    results.push(newResult);
    writeData('test_results.json', results);
    res.json({ success: true, testResult: newResult });
});

// Get all test results
app.get('/api/test-results', (req, res) => {
    const results = readData('test_results.json');
    res.json({ success: true, results });
});

// Get test results by child
app.get('/api/test-results/child/:childId', (req, res) => {
    const results = readData('test_results.json');
    const filtered = results.filter(r => r.childId === req.params.childId);
    res.json({ success: true, results: filtered });
});

// ===== VERIFICATION ROUTES =====

// Verify email (simplified)
app.post('/api/verify', (req, res) => {
    res.json({ success: true, message: 'Email verified successfully' });
});

// Resend verification
app.post('/api/resend-verification', (req, res) => {
    res.json({ success: true, message: 'Verification code sent' });
});

// Forgot password
app.post('/api/forgot-password', (req, res) => {
    res.json({ success: true, message: 'Password reset code sent' });
});

// Reset password
app.post('/api/reset-password', (req, res) => {
    res.json({ success: true, message: 'Password reset successfully' });
});

// ============================================================
// ===== FRONTEND - Serve All HTML Pages =====
// ============================================================

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve all HTML files
app.get('/*.html', (req, res) => {
    const filePath = path.join(__dirname, req.path);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Page not found');
    }
});

// ============================================================
// ===== START SERVER =====
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📁 Database: ${DATA_DIR}`);
    console.log(`🌐 URL: https://my-school-bw-c0gh.onrender.com`);
});
