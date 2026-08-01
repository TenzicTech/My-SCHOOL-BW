require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// ===== JSON FILE STORAGE (NO MONGODB) =====
// ============================================================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { return []; }
}

function writeData(filename, data) {
    try { fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2)); return true; }
    catch (e) { return false; }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ============================================================
// ===== MIDDLEWARE =====
// ============================================================
app.use(cors({
    origin: function (origin, callback) {
        const allowed = ['https://my-school-bw-c0gh.onrender.com', 'https://my-school-bw.onrender.com', 'http://localhost:3000', 'http://localhost:3001'];
        if (!origin || allowed.indexOf(origin) !== -1) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(helmet());
app.use(express.json());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// ============================================================
// ===== AUTH HELPERS =====
// ============================================================
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, schoolId: user.schoolId, isSchoolAdmin: user.isSchoolAdmin || false },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
};

const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Access denied.' });
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token.' });
        req.user = user;
        next();
    });
};

// ============================================================
// ===== DATA FILES =====
// ============================================================
const USERS_FILE = 'users.json';
const SCHOOLS_FILE = 'schools.json';
const STUDENTS_FILE = 'students.json';
const GUARDIANS_FILE = 'guardians.json';
const REPORTS_FILE = 'reports.json';
const TEST_RESULTS_FILE = 'test_results.json';
const SCHOOL_HISTORY_FILE = 'school_history.json';
const VERIFICATIONS_FILE = 'verifications.json';
const TEACHERS_FILE = 'teachers.json';

// ============================================================
// ===== HEALTH CHECK =====
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date(),
        storage: 'JSON File Storage',
        stats: {
            users: readData(USERS_FILE).length,
            schools: readData(SCHOOLS_FILE).length
        }
    });
});

// ============================================================
// ===== AUTHENTICATION ROUTES =====
// ============================================================

// SIGNUP
app.post('/api/signup', [
    body('username').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('schoolId').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { username, email, password, phone, schoolId } = req.body;
        const users = readData(USERS_FILE);
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        const schools = readData(SCHOOLS_FILE);
        if (!schools.find(s => s.id === schoolId)) {
            return res.status(400).json({ success: false, message: 'School not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = {
            id: generateId(),
            username,
            email,
            password: hashedPassword,
            phone: phone || '',
            schoolId,
            isSchoolAdmin: false,
            isVerified: false,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        writeData(USERS_FILE, users);

        const code = generateVerificationCode();
        const verifications = readData(VERIFICATIONS_FILE);
        verifications.push({ email, code, type: 'signup', timestamp: Date.now(), verified: false });
        writeData(VERIFICATIONS_FILE, verifications);

        const userData = { ...newUser };
        delete userData.password;
        res.status(201).json({
            success: true,
            message: 'User created. Please verify your email.',
            user: userData,
            verificationCode: code
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// VERIFY EMAIL
app.post('/api/verify', [
    body('email').isEmail(),
    body('code').isLength({ min: 6, max: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { email, code } = req.body;
        const verifications = readData(VERIFICATIONS_FILE);
        const verification = verifications.find(v => v.email === email && v.code === code && !v.verified);
        if (!verification) return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
        if (Date.now() - verification.timestamp > 600000) return res.status(400).json({ success: false, message: 'Code expired.' });

        verification.verified = true;
        const vIndex = verifications.findIndex(v => v.email === email && v.code === code);
        verifications[vIndex] = verification;
        writeData(VERIFICATIONS_FILE, verifications);

        const users = readData(USERS_FILE);
        const uIndex = users.findIndex(u => u.email === email);
        if (uIndex !== -1) {
            users[uIndex].isVerified = true;
            writeData(USERS_FILE, users);
        }

        res.json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// LOGIN
app.post('/api/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { email, password } = req.body;
        const users = readData(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        if (!user.isVerified) return res.status(403).json({ success: false, message: 'Please verify your email.', needsVerification: true });

        const token = generateToken(user);
        const userData = { ...user };
        delete userData.password;
        res.json({ success: true, message: 'Login successful.', token, user: userData });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET CURRENT USER
app.get('/api/me', authenticateToken, (req, res) => {
    try {
        const users = readData(USERS_FILE);
        const user = users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
        const userData = { ...user };
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// RESEND VERIFICATION
app.post('/api/resend-verification', [
    body('email').isEmail()
], (req, res) => {
    try {
        const { email } = req.body;
        let verifications = readData(VERIFICATIONS_FILE);
        verifications = verifications.filter(v => v.email !== email || v.verified);
        writeData(VERIFICATIONS_FILE, verifications);

        const code = generateVerificationCode();
        verifications.push({ email, code, type: 'signup', timestamp: Date.now(), verified: false });
        writeData(VERIFICATIONS_FILE, verifications);
        res.json({ success: true, message: 'New verification code sent.', code });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// FORGOT PASSWORD
app.post('/api/forgot-password', [
    body('email').isEmail()
], (req, res) => {
    try {
        const { email } = req.body;
        const users = readData(USERS_FILE);
        if (!users.find(u => u.email === email)) return res.status(404).json({ success: false, message: 'No account found.' });

        const code = generateVerificationCode();
        const verifications = readData(VERIFICATIONS_FILE);
        verifications.push({ email, code, type: 'password_reset', timestamp: Date.now(), verified: false });
        writeData(VERIFICATIONS_FILE, verifications);
        res.json({ success: true, message: 'Password reset code sent.', code });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// RESET PASSWORD
app.post('/api/reset-password', [
    body('email').isEmail(),
    body('code').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 8 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { email, code, newPassword } = req.body;
        const verifications = readData(VERIFICATIONS_FILE);
        const verification = verifications.find(v => v.email === email && v.code === code && v.type === 'password_reset' && !v.verified);
        if (!verification) return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
        if (Date.now() - verification.timestamp > 600000) return res.status(400).json({ success: false, message: 'Code expired.' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const users = readData(USERS_FILE);
        const uIndex = users.findIndex(u => u.email === email);
        if (uIndex !== -1) {
            users[uIndex].password = hashedPassword;
            writeData(USERS_FILE, users);
        }

        const vIndex = verifications.indexOf(verification);
        verifications[vIndex].verified = true;
        writeData(VERIFICATIONS_FILE, verifications);
        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== SCHOOL ROUTES =====
// ============================================================

// GET ALL SCHOOLS
app.get('/api/schools', (req, res) => {
    try {
        const schools = readData(SCHOOLS_FILE).filter(s => s.verified !== false);
        res.json({ success: true, schools });
    } catch (error) {
        console.error('Get schools error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// REGISTER SCHOOL
app.post('/api/register-school', [
    body('name').notEmpty(),
    body('location').notEmpty(),
    body('phone').notEmpty(),
    body('email').isEmail(),
    body('adminName').notEmpty(),
    body('adminEmail').isEmail(),
    body('adminPassword').isLength({ min: 8 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { name, type, location, country, address, phone, email, website, grades, language, description, adminName, adminEmail, adminPhone, adminPassword } = req.body;

        const schools = readData(SCHOOLS_FILE);
        if (schools.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'School already registered.' });
        }

        const school = {
            id: generateId(),
            name,
            type: type || 'Public',
            location: location || '',
            country: country || 'Botswana',
            address: address || '',
            phone,
            email,
            website: website || '',
            grades: grades || [],
            language: language || 'English',
            description: description || '',
            motto: '',
            students: 0,
            teachers: 0,
            totalSubjects: 0,
            totalClasses: 0,
            adminName,
            adminEmail,
            adminPhone: adminPhone || '',
            contacts: {
                mainPhone: phone,
                mainEmail: email,
                altPhone: '',
                altEmail: '',
                address: address || '',
                postal: ''
            },
            settings: {
                currentTerm: 'Term 1',
                academicYear: '2024',
                passingGrade: 70
            },
            verified: true,
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };

        schools.push(school);
        writeData(SCHOOLS_FILE, schools);

        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const users = readData(USERS_FILE);
        const adminUser = {
            id: generateId(),
            username: adminName,
            email: adminEmail,
            password: hashedPassword,
            phone: adminPhone || '',
            schoolId: school.id,
            isSchoolAdmin: true,
            isVerified: true,
            createdAt: new Date().toISOString()
        };
        users.push(adminUser);
        writeData(USERS_FILE, users);

        const token = generateToken(adminUser);
        const userData = { ...adminUser };
        delete userData.password;

        res.status(201).json({
            success: true,
            message: 'School registered successfully.',
            school,
            token,
            user: userData
        });
    } catch (error) {
        console.error('Register school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET SCHOOL BY ID
app.get('/api/school/:id', (req, res) => {
    try {
        const school = readData(SCHOOLS_FILE).find(s => s.id === req.params.id);
        if (!school) return res.status(404).json({ success: false, message: 'School not found.' });
        res.json({ success: true, school });
    } catch (error) {
        console.error('Get school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// UPDATE SCHOOL PROFILE
app.put('/api/school/:id', authenticateToken, (req, res) => {
    try {
        const schools = readData(SCHOOLS_FILE);
        const index = schools.findIndex(s => s.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'School not found.' });
        if (req.user.schoolId !== req.params.id) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const allowed = ['name', 'type', 'location', 'country', 'address', 'phone', 'email', 'website', 'grades', 'language', 'description', 'motto', 'contacts', 'settings'];
        allowed.forEach(key => {
            if (req.body[key] !== undefined) schools[index][key] = req.body[key];
        });

        schools[index].lastActive = new Date().toISOString();
        writeData(SCHOOLS_FILE, schools);
        res.json({ success: true, message: 'School updated successfully.', school: schools[index] });
    } catch (error) {
        console.error('Update school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// UPDATE SCHOOL STATS
app.put('/api/school/:id/stats', authenticateToken, (req, res) => {
    try {
        const schools = readData(SCHOOLS_FILE);
        const index = schools.findIndex(s => s.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'School not found.' });
        if (req.user.schoolId !== req.params.id) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const { students, teachers, totalSubjects, totalClasses } = req.body;
        if (students !== undefined) schools[index].students = students;
        if (teachers !== undefined) schools[index].teachers = teachers;
        if (totalSubjects !== undefined) schools[index].totalSubjects = totalSubjects;
        if (totalClasses !== undefined) schools[index].totalClasses = totalClasses;

        writeData(SCHOOLS_FILE, schools);
        res.json({ success: true, message: 'Stats updated successfully.', school: schools[index] });
    } catch (error) {
        console.error('Update stats error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== STUDENT ROUTES =====
// ============================================================

// REGISTER CHILD
app.post('/api/register-child', authenticateToken, [
    body('childFirstName').notEmpty(),
    body('childLastName').notEmpty(),
    body('dateOfBirth').notEmpty(),
    body('grade').notEmpty(),
    body('guardianEmail').isEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { childFirstName, childLastName, dateOfBirth, grade, previousSchool, guardianFirstName, guardianLastName, guardianEmail, guardianPhone } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData(STUDENTS_FILE);
        if (students.some(s =>
            s.childFirstName === childFirstName &&
            s.childLastName === childLastName &&
            s.guardianEmail === guardianEmail &&
            s.schoolId === schoolId
        )) {
            return res.status(400).json({ success: false, message: 'Child already registered under this guardian.' });
        }

        const fullName = `${childFirstName} ${childLastName}`;
        const student = {
            id: generateId(),
            childFirstName,
            childLastName,
            fullName,
            dateOfBirth,
            grade: parseInt(grade),
            previousSchool: previousSchool || '',
            guardianFirstName,
            guardianLastName,
            guardianEmail,
            guardianPhone,
            schoolId,
            verified: true,
            registrationDate: new Date().toISOString()
        };

        students.push(student);
        writeData(STUDENTS_FILE, students);

        // Create guardian relationship
        const guardians = readData(GUARDIANS_FILE);
        guardians.push({
            id: generateId(),
            studentId: student.id,
            guardianEmail,
            schoolId,
            childName: fullName,
            grade: parseInt(grade),
            registeredAt: new Date().toISOString()
        });
        writeData(GUARDIANS_FILE, guardians);

        // Update school stats
        const schools = readData(SCHOOLS_FILE);
        const sIndex = schools.findIndex(s => s.id === schoolId);
        if (sIndex !== -1) {
            schools[sIndex].students = (schools[sIndex].students || 0) + 1;
            schools[sIndex].lastActive = new Date().toISOString();
            writeData(SCHOOLS_FILE, schools);
        }

        res.status(201).json({
            success: true,
            message: 'Child registered successfully.',
            student
        });
    } catch (error) {
        console.error('Register child error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET STUDENTS BY SCHOOL
app.get('/api/students', authenticateToken, (req, res) => {
    try {
        const students = readData(STUDENTS_FILE).filter(s => s.schoolId === req.user.schoolId);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET STUDENTS BY GUARDIAN
app.get('/api/students/guardian/:email', authenticateToken, (req, res) => {
    try {
        const students = readData(STUDENTS_FILE).filter(s =>
            s.guardianEmail === req.params.email &&
            s.schoolId === req.user.schoolId
        );
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get guardian students error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE STUDENT
app.delete('/api/students/:id', authenticateToken, (req, res) => {
    try {
        let students = readData(STUDENTS_FILE);
        const index = students.findIndex(s => s.id === req.params.id && s.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Student not found.' });

        students.splice(index, 1);
        writeData(STUDENTS_FILE, students);

        // Remove guardian relationships
        let guardians = readData(GUARDIANS_FILE);
        guardians = guardians.filter(g => g.studentId !== req.params.id);
        writeData(GUARDIANS_FILE, guardians);

        // Remove reports
        let reports = readData(REPORTS_FILE);
        reports = reports.filter(r => r.studentId !== req.params.id);
        writeData(REPORTS_FILE, reports);

        // Remove test results
        let testResults = readData(TEST_RESULTS_FILE);
        testResults = testResults.filter(t => t.childId !== req.params.id);
        writeData(TEST_RESULTS_FILE, testResults);

        // Update school stats
        const schools = readData(SCHOOLS_FILE);
        const sIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (sIndex !== -1) {
            schools[sIndex].students = Math.max(0, (schools[sIndex].students || 0) - 1);
            writeData(SCHOOLS_FILE, schools);
        }

        res.json({ success: true, message: 'Student deleted successfully.' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== GUARDIAN ROUTES =====
// ============================================================

app.get('/api/guardians', authenticateToken, (req, res) => {
    try {
        const guardians = readData(GUARDIANS_FILE).filter(g => g.schoolId === req.user.schoolId);
        res.json({ success: true, guardians });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/guardians/:email/children', authenticateToken, (req, res) => {
    try {
        const children = readData(GUARDIANS_FILE).filter(g =>
            g.guardianEmail === req.params.email &&
            g.schoolId === req.user.schoolId
        );
        res.json({ success: true, children });
    } catch (error) {
        console.error('Get children error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== REPORT ROUTES =====
// ============================================================

app.post('/api/reports', authenticateToken, [
    body('studentId').notEmpty(),
    body('subject').notEmpty(),
    body('score').isInt({ min: 0, max: 100 }),
    body('term').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { studentId, subject, score, term, comment } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData(STUDENTS_FILE);
        if (!students.find(s => s.id === studentId && s.schoolId === schoolId)) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const reports = readData(REPORTS_FILE);
        const report = {
            id: generateId(),
            studentId,
            schoolId,
            subject,
            score,
            term,
            comment: comment || '',
            date: new Date().toISOString(),
            isAdminReport: true
        };
        reports.push(report);
        writeData(REPORTS_FILE, reports);

        res.status(201).json({
            success: true,
            message: 'Report added successfully.',
            report
        });
    } catch (error) {
        console.error('Add report error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/reports/student/:studentId', authenticateToken, (req, res) => {
    try {
        const reports = readData(REPORTS_FILE).filter(r =>
            r.studentId === req.params.studentId &&
            r.schoolId === req.user.schoolId
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/reports', authenticateToken, (req, res) => {
    try {
        const reports = readData(REPORTS_FILE).filter(r => r.schoolId === req.user.schoolId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.delete('/api/reports/:id', authenticateToken, (req, res) => {
    try {
        let reports = readData(REPORTS_FILE);
        const index = reports.findIndex(r => r.id === req.params.id && r.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Report not found.' });
        reports.splice(index, 1);
        writeData(REPORTS_FILE, reports);
        res.json({ success: true, message: 'Report deleted successfully.' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== TEST RESULT ROUTES =====
// ============================================================

app.post('/api/test-results', authenticateToken, [
    body('childId').notEmpty(),
    body('subject').notEmpty(),
    body('grade').notEmpty(),
    body('score').isInt({ min: 0, max: 100 }),
    body('totalQuestions').notEmpty(),
    body('correctAnswers').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { childId, subject, grade, score, totalQuestions, correctAnswers } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData(STUDENTS_FILE);
        const student = students.find(s => s.id === childId && s.schoolId === schoolId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const testResults = readData(TEST_RESULTS_FILE);
        const testResult = {
            id: generateId(),
            childId,
            schoolId,
            childName: student.fullName,
            subject,
            grade: parseInt(grade),
            score,
            totalQuestions,
            correctAnswers,
            passed: score >= 70,
            date: new Date().toISOString()
        };
        testResults.push(testResult);
        writeData(TEST_RESULTS_FILE, testResults);

        res.status(201).json({
            success: true,
            message: 'Test result saved successfully.',
            testResult
        });
    } catch (error) {
        console.error('Save test result error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/test-results/child/:childId', authenticateToken, (req, res) => {
    try {
        const results = readData(TEST_RESULTS_FILE).filter(t =>
            t.childId === req.params.childId &&
            t.schoolId === req.user.schoolId
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, results });
    } catch (error) {
        console.error('Get test results error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/test-results', authenticateToken, (req, res) => {
    try {
        const results = readData(TEST_RESULTS_FILE).filter(t => t.schoolId === req.user.schoolId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, results });
    } catch (error) {
        console.error('Get all test results error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== TEACHER ROUTES =====
// ============================================================

app.post('/api/teachers', authenticateToken, [
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('email').isEmail(),
    body('subject').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { firstName, lastName, email, subject, phone } = req.body;
        const schoolId = req.user.schoolId;

        const teachers = readData(TEACHERS_FILE);
        const teacher = {
            id: generateId(),
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email,
            subject,
            phone: phone || '',
            schoolId,
            addedAt: new Date().toISOString()
        };
        teachers.push(teacher);
        writeData(TEACHERS_FILE, teachers);

        // Update school stats
        const schools = readData(SCHOOLS_FILE);
        const sIndex = schools.findIndex(s => s.id === schoolId);
        if (sIndex !== -1) {
            schools[sIndex].teachers = (schools[sIndex].teachers || 0) + 1;
            schools[sIndex].lastActive = new Date().toISOString();
            writeData(SCHOOLS_FILE, schools);
        }

        res.status(201).json({
            success: true,
            message: 'Teacher added successfully.',
            teacher
        });
    } catch (error) {
        console.error('Add teacher error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/teachers', authenticateToken, (req, res) => {
    try {
        const teachers = readData(TEACHERS_FILE).filter(t => t.schoolId === req.user.schoolId);
        res.json({ success: true, teachers });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.delete('/api/teachers/:id', authenticateToken, (req, res) => {
    try {
        let teachers = readData(TEACHERS_FILE);
        const index = teachers.findIndex(t => t.id === req.params.id && t.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Teacher not found.' });
        teachers.splice(index, 1);
        writeData(TEACHERS_FILE, teachers);

        // Update school stats
        const schools = readData(SCHOOLS_FILE);
        const sIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (sIndex !== -1) {
            schools[sIndex].teachers = Math.max(0, (schools[sIndex].teachers || 0) - 1);
            writeData(SCHOOLS_FILE, schools);
        }

        res.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== SCHOOL HISTORY ROUTES =====
// ============================================================

app.post('/api/school-history', authenticateToken, [
    body('date').notEmpty(),
    body('title').notEmpty(),
    body('description').notEmpty()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const { date, title, description } = req.body;
        const schoolId = req.user.schoolId;

        const histories = readData(SCHOOL_HISTORY_FILE);
        const history = {
            id: generateId(),
            schoolId,
            date,
            title,
            description,
            addedAt: new Date().toISOString()
        };
        histories.push(history);
        writeData(SCHOOL_HISTORY_FILE, histories);

        res.status(201).json({
            success: true,
            message: 'History entry added successfully.',
            history
        });
    } catch (error) {
        console.error('Add history error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/school-history', authenticateToken, (req, res) => {
    try {
        const history = readData(SCHOOL_HISTORY_FILE).filter(h => h.schoolId === req.user.schoolId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== CSRF TOKEN =====
// ============================================================

app.get('/api/csrf-token', (req, res) => {
    const token = require('crypto').randomBytes(32).toString('hex');
    res.json({ csrfToken: token });
});

// ============================================================
// ===== ERROR HANDLING =====
// ============================================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ============================================================
// ===== START SERVER =====
// ============================================================

console.log('🚀 Starting server...');

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 API URL: https://my-school-bw-c0gh.onrender.com/api`);
    console.log(`🌐 Health check: https://my-school-bw-c0gh.onrender.com/api/health`);
    console.log(`📁 Data stored in: ${DATA_DIR}`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

console.log('✅ Server configuration complete');