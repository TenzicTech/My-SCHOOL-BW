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
// ===== DATABASE SETUP =====
// ============================================================
const DATA_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize JSON files with empty arrays if they don't exist
const dataFiles = [
    'users.json', 'schools.json', 'students.json', 'guardians.json',
    'reports.json', 'test_results.json', 'school_history.json',
    'verifications.json', 'teachers.json'
];

dataFiles.forEach(file => {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
    }
});

function readData(filename) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Error reading ${filename}:`, e);
        return [];
    }
}

function writeData(filename, data) {
    try {
        const filePath = path.join(DATA_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error(`Error writing ${filename}:`, e);
        return false;
    }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + 
           Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ============================================================
// ===== MIDDLEWARE =====
// ============================================================
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// ============================================================
// ===== SERVE STATIC FILES (FRONTEND) =====
// ============================================================
// Serve all static files from the root directory
app.use(express.static(__dirname));

// IMPORTANT: Handle the root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================================
// ===== AUTH HELPERS =====
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, schoolId: user.schoolId, isSchoolAdmin: user.isSchoolAdmin || false },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// ============================================================
// ===== HEALTH CHECK =====
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is running',
        timestamp: new Date(),
        storage: 'JSON File Storage',
        dataDir: DATA_DIR,
        stats: {
            users: readData('users.json').length,
            schools: readData('schools.json').length,
            students: readData('students.json').length
        }
    });
});

// ============================================================
// ===== AUTHENTICATION ROUTES =====
// ============================================================

// SIGNUP
app.post('/api/signup', [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('schoolId').notEmpty().withMessage('School ID is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { username, email, password, phone, schoolId } = req.body;
        const users = readData('users.json');
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already registered.' 
            });
        }

        const schools = readData('schools.json');
        if (!schools.find(s => s.id === schoolId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'School not found.' 
            });
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
        writeData('users.json', users);

        const code = generateVerificationCode();
        const verifications = readData('verifications.json');
        verifications.push({ 
            email, 
            code, 
            type: 'signup', 
            timestamp: Date.now(), 
            verified: false 
        });
        writeData('verifications.json', verifications);

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
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { email, code } = req.body;
        const verifications = readData('verifications.json');
        const verification = verifications.find(v => 
            v.email === email && v.code === code && !v.verified
        );
        
        if (!verification) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired code.' 
            });
        }
        
        if (Date.now() - verification.timestamp > 600000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Code expired. Please request a new one.' 
            });
        }

        verification.verified = true;
        const vIndex = verifications.findIndex(v => v.email === email && v.code === code);
        verifications[vIndex] = verification;
        writeData('verifications.json', verifications);

        const users = readData('users.json');
        const uIndex = users.findIndex(u => u.email === email);
        if (uIndex !== -1) {
            users[uIndex].isVerified = true;
            writeData('users.json', users);
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { email, password } = req.body;
        const users = readData('users.json');
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials.' 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials.' 
            });
        }
        
        if (!user.isVerified) {
            return res.status(403).json({ 
                success: false, 
                message: 'Please verify your email first.',
                needsVerification: true 
            });
        }

        const token = generateToken(user);
        const userData = { ...user };
        delete userData.password;
        
        res.json({ 
            success: true, 
            message: 'Login successful.', 
            token, 
            user: userData 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET CURRENT USER
app.get('/api/me', authenticateToken, (req, res) => {
    try {
        const users = readData('users.json');
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found.' 
            });
        }
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
        let verifications = readData('verifications.json');
        verifications = verifications.filter(v => v.email !== email || v.verified);
        
        const code = generateVerificationCode();
        verifications.push({ 
            email, 
            code, 
            type: 'signup', 
            timestamp: Date.now(), 
            verified: false 
        });
        writeData('verifications.json', verifications);
        
        res.json({ 
            success: true, 
            message: 'New verification code sent.', 
            code 
        });
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
        const users = readData('users.json');
        if (!users.find(u => u.email === email)) {
            return res.status(404).json({ 
                success: false, 
                message: 'No account found with this email.' 
            });
        }

        const code = generateVerificationCode();
        const verifications = readData('verifications.json');
        verifications.push({ 
            email, 
            code, 
            type: 'password_reset', 
            timestamp: Date.now(), 
            verified: false 
        });
        writeData('verifications.json', verifications);
        
        res.json({ 
            success: true, 
            message: 'Password reset code sent.', 
            code 
        });
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { email, code, newPassword } = req.body;
        const verifications = readData('verifications.json');
        const verification = verifications.find(v => 
            v.email === email && v.code === code && 
            v.type === 'password_reset' && !v.verified
        );
        
        if (!verification) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired code.' 
            });
        }
        
        if (Date.now() - verification.timestamp > 600000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Code expired.' 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const users = readData('users.json');
        const uIndex = users.findIndex(u => u.email === email);
        if (uIndex !== -1) {
            users[uIndex].password = hashedPassword;
            writeData('users.json', users);
        }

        verification.verified = true;
        const vIndex = verifications.indexOf(verification);
        verifications[vIndex] = verification;
        writeData('verifications.json', verifications);
        
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
        const schools = readData('schools.json').filter(s => s.verified !== false);
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { name, type, location, country, address, phone, email, website, grades, language, description, adminName, adminEmail, adminPhone, adminPassword } = req.body;

        const schools = readData('schools.json');
        if (schools.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            return res.status(400).json({ 
                success: false, 
                message: 'School already registered.' 
            });
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
        writeData('schools.json', schools);

        // Create admin user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const users = readData('users.json');
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
        writeData('users.json', users);

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
        const school = readData('schools.json').find(s => s.id === req.params.id);
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
        const schools = readData('schools.json');
        const index = schools.findIndex(s => s.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'School not found.' });
        if (req.user.schoolId !== req.params.id) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const allowed = ['name', 'type', 'location', 'country', 'address', 'phone', 'email', 'website', 'grades', 'language', 'description', 'motto', 'contacts', 'settings'];
        allowed.forEach(key => {
            if (req.body[key] !== undefined) schools[index][key] = req.body[key];
        });

        schools[index].lastActive = new Date().toISOString();
        writeData('schools.json', schools);
        res.json({ success: true, message: 'School updated successfully.', school: schools[index] });
    } catch (error) {
        console.error('Update school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// UPDATE SCHOOL STATS
app.put('/api/school/:id/stats', authenticateToken, (req, res) => {
    try {
        const schools = readData('schools.json');
        const index = schools.findIndex(s => s.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'School not found.' });
        if (req.user.schoolId !== req.params.id) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const { students, teachers, totalSubjects, totalClasses } = req.body;
        if (students !== undefined) schools[index].students = students;
        if (teachers !== undefined) schools[index].teachers = teachers;
        if (totalSubjects !== undefined) schools[index].totalSubjects = totalSubjects;
        if (totalClasses !== undefined) schools[index].totalClasses = totalClasses;

        writeData('schools.json', schools);
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { childFirstName, childLastName, dateOfBirth, grade, previousSchool, guardianFirstName, guardianLastName, guardianEmail, guardianPhone } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData('students.json');
        if (students.some(s =>
            s.childFirstName === childFirstName &&
            s.childLastName === childLastName &&
            s.guardianEmail === guardianEmail &&
            s.schoolId === schoolId
        )) {
            return res.status(400).json({ 
                success: false, 
                message: 'Child already registered under this guardian.' 
            });
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
        writeData('students.json', students);

        // Create guardian relationship
        const guardians = readData('guardians.json');
        guardians.push({
            id: generateId(),
            studentId: student.id,
            guardianEmail,
            schoolId,
            childName: fullName,
            grade: parseInt(grade),
            registeredAt: new Date().toISOString()
        });
        writeData('guardians.json', guardians);

        // Update school stats
        const schools = readData('schools.json');
        const sIndex = schools.findIndex(s => s.id === schoolId);
        if (sIndex !== -1) {
            schools[sIndex].students = (schools[sIndex].students || 0) + 1;
            schools[sIndex].lastActive = new Date().toISOString();
            writeData('schools.json', schools);
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
        const students = readData('students.json').filter(s => s.schoolId === req.user.schoolId);
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET STUDENTS BY GUARDIAN
app.get('/api/students/guardian/:email', authenticateToken, (req, res) => {
    try {
        const students = readData('students.json').filter(s =>
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
        let students = readData('students.json');
        const index = students.findIndex(s => s.id === req.params.id && s.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Student not found.' });

        students.splice(index, 1);
        writeData('students.json', students);

        let guardians = readData('guardians.json');
        guardians = guardians.filter(g => g.studentId !== req.params.id);
        writeData('guardians.json', guardians);

        let reports = readData('reports.json');
        reports = reports.filter(r => r.studentId !== req.params.id);
        writeData('reports.json', reports);

        let testResults = readData('test_results.json');
        testResults = testResults.filter(t => t.childId !== req.params.id);
        writeData('test_results.json', testResults);

        const schools = readData('schools.json');
        const sIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (sIndex !== -1) {
            schools[sIndex].students = Math.max(0, (schools[sIndex].students || 0) - 1);
            writeData('schools.json', schools);
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
        const guardians = readData('guardians.json').filter(g => g.schoolId === req.user.schoolId);
        res.json({ success: true, guardians });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.get('/api/guardians/:email/children', authenticateToken, (req, res) => {
    try {
        const children = readData('guardians.json').filter(g =>
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { studentId, subject, score, term, comment } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData('students.json');
        const student = students.find(s => s.id === studentId && s.schoolId === schoolId);
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student not found.' 
            });
        }

        const reports = readData('reports.json');
        const report = {
            id: generateId(),
            studentId,
            studentName: student.fullName || `${student.childFirstName} ${student.childLastName}`,
            schoolId,
            subject,
            score,
            term,
            comment: comment || '',
            date: new Date().toISOString(),
            isAdminReport: true
        };
        reports.push(report);
        writeData('reports.json', reports);

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
        const reports = readData('reports.json').filter(r =>
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
        const reports = readData('reports.json').filter(r => r.schoolId === req.user.schoolId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.delete('/api/reports/:id', authenticateToken, (req, res) => {
    try {
        let reports = readData('reports.json');
        const index = reports.findIndex(r => r.id === req.params.id && r.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Report not found.' });
        reports.splice(index, 1);
        writeData('reports.json', reports);
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { childId, subject, grade, score, totalQuestions, correctAnswers } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData('students.json');
        const student = students.find(s => s.id === childId && s.schoolId === schoolId);
        if (!student) {
            return res.status(404).json({ 
                success: false, 
                message: 'Student not found.' 
            });
        }

        const testResults = readData('test_results.json');
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
        writeData('test_results.json', testResults);

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
        const results = readData('test_results.json').filter(t =>
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
        const results = readData('test_results.json').filter(t => t.schoolId === req.user.schoolId)
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { firstName, lastName, email, subject, phone } = req.body;
        const schoolId = req.user.schoolId;

        const teachers = readData('teachers.json');
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
        writeData('teachers.json', teachers);

        const schools = readData('schools.json');
        const sIndex = schools.findIndex(s => s.id === schoolId);
        if (sIndex !== -1) {
            schools[sIndex].teachers = (schools[sIndex].teachers || 0) + 1;
            schools[sIndex].lastActive = new Date().toISOString();
            writeData('schools.json', schools);
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
        const teachers = readData('teachers.json').filter(t => t.schoolId === req.user.schoolId);
        res.json({ success: true, teachers });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

app.delete('/api/teachers/:id', authenticateToken, (req, res) => {
    try {
        let teachers = readData('teachers.json');
        const index = teachers.findIndex(t => t.id === req.params.id && t.schoolId === req.user.schoolId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Teacher not found.' });
        teachers.splice(index, 1);
        writeData('teachers.json', teachers);

        const schools = readData('schools.json');
        const sIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (sIndex !== -1) {
            schools[sIndex].teachers = Math.max(0, (schools[sIndex].teachers || 0) - 1);
            writeData('schools.json', schools);
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
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false, 
            message: errors.array()[0].msg 
        });
    }

    try {
        const { date, title, description } = req.body;
        const schoolId = req.user.schoolId;

        const histories = readData('school_history.json');
        const history = {
            id: generateId(),
            schoolId,
            date,
            title,
            description,
            addedAt: new Date().toISOString()
        };
        histories.push(history);
        writeData('school_history.json', histories);

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
        const history = readData('school_history.json').filter(h => h.schoolId === req.user.schoolId)
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
// ===== CATCH-ALL ROUTE (Must be LAST) =====
// ============================================================
// This handles any routes that aren't API or static files
// It serves the index.html for client-side routing
app.get('*', (req, res) => {
    // Don't interfere with API routes
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    // Serve index.html for all other routes
    res.sendFile(path.join(__dirname, 'index.html'));
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
console.log(`📁 Data directory: ${DATA_DIR}`);

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: http://localhost:${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}/api`);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

console.log('✅ Server configuration complete');