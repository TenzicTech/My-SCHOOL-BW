// ============================================================
// ===== LOAD ENVIRONMENT VARIABLES =====
// ============================================================
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
// ===== DATABASE - JSON FILE STORAGE =====
// ============================================================

// Data directory
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Created data directory');
}

// ===== DATA HELPERS =====

function readData(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
}

function writeData(filename, data) {
    const filePath = path.join(DATA_DIR, filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        return false;
    }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ===== DATA FILES =====
const USERS_FILE = 'users.json';
const SCHOOLS_FILE = 'schools.json';
const STUDENTS_FILE = 'students.json';
const GUARDIANS_FILE = 'guardians.json';
const REPORTS_FILE = 'reports.json';
const TEST_RESULTS_FILE = 'test_results.json';
const SCHOOL_HISTORY_FILE = 'school_history.json';
const VERIFICATIONS_FILE = 'verifications.json';
const TEACHERS_FILE = 'teachers.json';

// ===== CORS CONFIGURATION =====
const allowedOrigins = [
    'https://my-school-bw-c0gh.onrender.com',
    'https://my-school-bw.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ Blocked CORS request from:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// ===== SECURITY MIDDLEWARE =====
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", 'https://my-school-bw-c0gh.onrender.com'],
        }
    }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== RATE LIMITING =====
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// ============================================================
// ===== HELPERS =====
// ============================================================

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            schoolId: user.schoolId, 
            isSchoolAdmin: user.isSchoolAdmin || false
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
    );
};

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===== AUTHENTICATION MIDDLEWARE =====
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// ============================================================
// ===== API ROUTES =====
// ============================================================

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
    const users = readData(USERS_FILE);
    const schools = readData(SCHOOLS_FILE);
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'production',
        storage: 'JSON File Storage',
        stats: {
            users: users.length,
            schools: schools.length
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
    body('schoolId').notEmpty().withMessage('School selection is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { username, email, password, phone, schoolId } = req.body;

        // Check if user already exists
        const users = readData(USERS_FILE);
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        // Check if school exists
        const schools = readData(SCHOOLS_FILE);
        const school = schools.find(s => s.id === schoolId);
        if (!school) {
            return res.status(400).json({ success: false, message: 'School not found.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
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

        // Generate verification code
        const code = generateVerificationCode();
        const verifications = readData(VERIFICATIONS_FILE);
        verifications.push({
            email,
            code,
            type: 'signup',
            timestamp: Date.now(),
            verified: false
        });
        writeData(VERIFICATIONS_FILE, verifications);

        // Update school last active
        school.lastActive = new Date().toISOString();
        const schoolIndex = schools.findIndex(s => s.id === schoolId);
        schools[schoolIndex] = school;
        writeData(SCHOOLS_FILE, schools);

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
        res.status(500).json({ success: false, message: 'Server error during signup.' });
    }
});

// VERIFY EMAIL
app.post('/api/verify', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid verification code')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email, code } = req.body;

        const verifications = readData(VERIFICATIONS_FILE);
        const verification = verifications.find(v => v.email === email && v.code === code && !v.verified);
        
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        // Check if code expired (10 minutes)
        if (Date.now() - verification.timestamp > 600000) {
            return res.status(400).json({ success: false, message: 'Verification code expired. Please request a new one.' });
        }

        // Mark as verified
        verification.verified = true;
        const vIndex = verifications.findIndex(v => v.email === email && v.code === code);
        verifications[vIndex] = verification;
        writeData(VERIFICATIONS_FILE, verifications);

        // Update user
        const users = readData(USERS_FILE);
        const userIndex = users.findIndex(u => u.email === email);
        if (userIndex !== -1) {
            users[userIndex].isVerified = true;
            writeData(USERS_FILE, users);
        }

        res.json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification.' });
    }
});

// LOGIN
app.post('/api/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        const users = readData(USERS_FILE);
        const user = users.find(u => u.email === email);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        if (!user.isVerified) {
            return res.status(403).json({ success: false, message: 'Please verify your email first.', needsVerification: true });
        }

        // Update school last active
        const schools = readData(SCHOOLS_FILE);
        const schoolIndex = schools.findIndex(s => s.id === user.schoolId);
        if (schoolIndex !== -1) {
            schools[schoolIndex].lastActive = new Date().toISOString();
            writeData(SCHOOLS_FILE, schools);
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
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// GET CURRENT USER
app.get('/api/me', authenticateToken, (req, res) => {
    try {
        const users = readData(USERS_FILE);
        const user = users.find(u => u.id === req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const userData = { ...user };
        delete userData.password;
        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// RESEND VERIFICATION CODE
app.post('/api/resend-verification', [
    body('email').isEmail().withMessage('Valid email is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email } = req.body;
        
        // Remove old verifications
        let verifications = readData(VERIFICATIONS_FILE);
        verifications = verifications.filter(v => v.email !== email || v.verified);
        writeData(VERIFICATIONS_FILE, verifications);

        const code = generateVerificationCode();
        verifications.push({
            email,
            code,
            type: 'signup',
            timestamp: Date.now(),
            verified: false
        });
        writeData(VERIFICATIONS_FILE, verifications);

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
    body('email').isEmail().withMessage('Valid email is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email } = req.body;

        const users = readData(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email.' });
        }

        const code = generateVerificationCode();
        const verifications = readData(VERIFICATIONS_FILE);
        verifications.push({
            email,
            code,
            type: 'password_reset',
            timestamp: Date.now(),
            verified: false
        });
        writeData(VERIFICATIONS_FILE, verifications);

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
    body('email').isEmail().withMessage('Valid email is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid code'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email, code, newPassword } = req.body;

        const verifications = readData(VERIFICATIONS_FILE);
        const verification = verifications.find(v => 
            v.email === email && 
            v.code === code && 
            v.type === 'password_reset' && 
            !v.verified
        );
        
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
        }

        if (Date.now() - verification.timestamp > 600000) {
            return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const users = readData(USERS_FILE);
        const userIndex = users.findIndex(u => u.email === email);
        if (userIndex !== -1) {
            users[userIndex].password = hashedPassword;
            writeData(USERS_FILE, users);
        }

        // Mark verification as used
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
    body('name').notEmpty().withMessage('School name is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('adminName').notEmpty().withMessage('Admin name is required'),
    body('adminEmail').isEmail().withMessage('Valid admin email is required'),
    body('adminPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const {
            name, type, location, country, address, phone, email, website,
            grades, language, description, adminName, adminEmail, adminPhone, adminPassword
        } = req.body;

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
        const schools = readData(SCHOOLS_FILE);
        const school = schools.find(s => s.id === req.params.id);
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }
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
        const schoolIndex = schools.findIndex(s => s.id === req.params.id);
        
        if (schoolIndex === -1) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        if (req.user.schoolId !== req.params.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this school.' });
        }

        const updates = req.body;
        const allowedUpdates = ['name', 'type', 'location', 'country', 'address', 'phone', 'email', 'website', 'grades', 'language', 'description', 'motto', 'contacts', 'settings'];
        
        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                schools[schoolIndex][key] = updates[key];
            }
        });

        schools[schoolIndex].lastActive = new Date().toISOString();
        writeData(SCHOOLS_FILE, schools);

        res.json({ success: true, message: 'School updated successfully.', school: schools[schoolIndex] });
    } catch (error) {
        console.error('Update school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// UPDATE SCHOOL STATS
app.put('/api/school/:id/stats', authenticateToken, (req, res) => {
    try {
        const schools = readData(SCHOOLS_FILE);
        const schoolIndex = schools.findIndex(s => s.id === req.params.id);
        
        if (schoolIndex === -1) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        if (req.user.schoolId !== req.params.id) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const { students, teachers, totalSubjects, totalClasses } = req.body;
        
        if (students !== undefined) schools[schoolIndex].students = students;
        if (teachers !== undefined) schools[schoolIndex].teachers = teachers;
        if (totalSubjects !== undefined) schools[schoolIndex].totalSubjects = totalSubjects;
        if (totalClasses !== undefined) schools[schoolIndex].totalClasses = totalClasses;

        writeData(SCHOOLS_FILE, schools);
        res.json({ success: true, message: 'Stats updated successfully.', school: schools[schoolIndex] });
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
    body('childFirstName').notEmpty().withMessage('Child first name is required'),
    body('childLastName').notEmpty().withMessage('Child last name is required'),
    body('dateOfBirth').notEmpty().withMessage('Date of birth is required'),
    body('grade').notEmpty().withMessage('Grade is required'),
    body('guardianEmail').isEmail().withMessage('Valid guardian email is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const {
            childFirstName, childLastName, dateOfBirth, grade, previousSchool,
            guardianFirstName, guardianLastName, guardianEmail, guardianPhone
        } = req.body;

        const schoolId = req.user.schoolId;

        const students = readData(STUDENTS_FILE);
        
        // Check if child already exists
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
        const schoolIndex = schools.findIndex(s => s.id === schoolId);
        if (schoolIndex !== -1) {
            schools[schoolIndex].students = (schools[schoolIndex].students || 0) + 1;
            schools[schoolIndex].lastActive = new Date().toISOString();
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
        const studentIndex = students.findIndex(s => s.id === req.params.id && s.schoolId === req.user.schoolId);
        
        if (studentIndex === -1) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        students.splice(studentIndex, 1);
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
        const schoolIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (schoolIndex !== -1) {
            schools[schoolIndex].students = Math.max(0, (schools[schoolIndex].students || 0) - 1);
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
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('score').isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
    body('term').notEmpty().withMessage('Term is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { studentId, subject, score, term, comment } = req.body;
        const schoolId = req.user.schoolId;

        const students = readData(STUDENTS_FILE);
        const student = students.find(s => s.id === studentId && s.schoolId === schoolId);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found in this school.' });
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
        const reportIndex = reports.findIndex(r => r.id === req.params.id && r.schoolId === req.user.schoolId);
        
        if (reportIndex === -1) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }

        reports.splice(reportIndex, 1);
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
    body('childId').notEmpty().withMessage('Child ID is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('grade').notEmpty().withMessage('Grade is required'),
    body('score').isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
    body('totalQuestions').notEmpty().withMessage('Total questions is required'),
    body('correctAnswers').notEmpty().withMessage('Correct answers is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

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
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

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
        const schoolIndex = schools.findIndex(s => s.id === schoolId);
        if (schoolIndex !== -1) {
            schools[schoolIndex].teachers = (schools[schoolIndex].teachers || 0) + 1;
            schools[schoolIndex].lastActive = new Date().toISOString();
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
        const teacherIndex = teachers.findIndex(t => t.id === req.params.id && t.schoolId === req.user.schoolId);
        
        if (teacherIndex === -1) {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }

        teachers.splice(teacherIndex, 1);
        writeData(TEACHERS_FILE, teachers);

        // Update school stats
        const schools = readData(SCHOOLS_FILE);
        const schoolIndex = schools.findIndex(s => s.id === req.user.schoolId);
        if (schoolIndex !== -1) {
            schools[schoolIndex].teachers = Math.max(0, (schools[schoolIndex].teachers || 0) - 1);
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
    body('date').notEmpty().withMessage('Date is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

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

// Increase timeout values for Render
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

console.log('✅ Server configuration complete');