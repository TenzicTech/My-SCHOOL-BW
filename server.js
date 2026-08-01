require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== CORS CONFIGURATION - Allow Frontend Only =====
const allowedOrigins = [
    'https://my-school-bw-c0gh.onrender.com',
    'https://my-school-bw.onrender.com',
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// ===== DATABASE CONNECTION =====
// ONLY use MongoDB Atlas - NO localhost fallback
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s if can't connect
})
.then(() => console.log('✅ MongoDB Atlas connected successfully'))
.catch(err => {
    console.error('❌ MongoDB Atlas connection error:', err.message);
    console.error('⚠️  Please check your MONGODB_URI environment variable');
    process.exit(1); // Exit if no database connection
});

// ============================================================
// ===== MODELS =====
// ============================================================

// User Model
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, default: '' },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    isSchoolAdmin: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// School Model
const SchoolSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    type: { type: String, default: 'Public' },
    location: { type: String, default: '' },
    country: { type: String, default: 'Botswana' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    grades: { type: [String], default: [] },
    language: { type: String, default: 'English' },
    description: { type: String, default: '' },
    motto: { type: String, default: '' },
    students: { type: Number, default: 0 },
    teachers: { type: Number, default: 0 },
    totalSubjects: { type: Number, default: 0 },
    totalClasses: { type: Number, default: 0 },
    adminName: { type: String, default: '' },
    adminEmail: { type: String, default: '' },
    adminPhone: { type: String, default: '' },
    contacts: {
        mainPhone: { type: String, default: '' },
        mainEmail: { type: String, default: '' },
        altPhone: { type: String, default: '' },
        altEmail: { type: String, default: '' },
        address: { type: String, default: '' },
        postal: { type: String, default: '' }
    },
    settings: {
        currentTerm: { type: String, default: 'Term 1' },
        academicYear: { type: String, default: '2024' },
        passingGrade: { type: Number, default: 70 }
    },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

// Student Model
const StudentSchema = new mongoose.Schema({
    childFirstName: { type: String, required: true },
    childLastName: { type: String, required: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    grade: { type: Number, required: true },
    previousSchool: { type: String, default: '' },
    guardianFirstName: { type: String, required: true },
    guardianLastName: { type: String, required: true },
    guardianEmail: { type: String, required: true },
    guardianPhone: { type: String, required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    verified: { type: Boolean, default: true },
    registrationDate: { type: Date, default: Date.now }
});

// Guardian Relationship Model
const GuardianSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    guardianEmail: { type: String, required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    childName: { type: String, required: true },
    grade: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now }
});

// Admin Report Model
const AdminReportSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    subject: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    term: { type: String, required: true },
    comment: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    isAdminReport: { type: Boolean, default: true }
});

// Test Result Model
const TestResultSchema = new mongoose.Schema({
    childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    childName: { type: String, required: true },
    subject: { type: String, required: true },
    grade: { type: Number, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    totalQuestions: { type: Number, required: true },
    correctAnswers: { type: Number, required: true },
    passed: { type: Boolean, default: false },
    date: { type: Date, default: Date.now }
});

// School History Model
const SchoolHistorySchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    date: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
});

// Verification Model
const VerificationSchema = new mongoose.Schema({
    email: { type: String, required: true },
    code: { type: String, required: true },
    type: { type: String, enum: ['signup', 'register', 'school', 'password_reset'], default: 'signup' },
    timestamp: { type: Date, default: Date.now, expires: 600 },
    verified: { type: Boolean, default: false }
});

// Teacher Model
const TeacherSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    phone: { type: String, default: '' },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    addedAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', UserSchema);
const School = mongoose.model('School', SchoolSchema);
const Student = mongoose.model('Student', StudentSchema);
const Guardian = mongoose.model('Guardian', GuardianSchema);
const AdminReport = mongoose.model('AdminReport', AdminReportSchema);
const TestResult = mongoose.model('TestResult', TestResultSchema);
const SchoolHistory = mongoose.model('SchoolHistory', SchoolHistorySchema);
const Verification = mongoose.model('Verification', VerificationSchema);
const Teacher = mongoose.model('Teacher', TeacherSchema);

// ============================================================
// ===== AUTHENTICATION MIDDLEWARE =====
// ============================================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// ============================================================
// ===== HELPER FUNCTIONS =====
// ============================================================

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id, 
            email: user.email, 
            schoolId: user.schoolId, 
            isSchoolAdmin: user.isSchoolAdmin 
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// ============================================================
// ===== API ROUTES =====
// ============================================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Server is running', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'production',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// ============================================================
// ===== AUTHENTICATION ROUTES =====
// ============================================================

// Signup
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

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(400).json({ success: false, message: 'School not found.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            username,
            email,
            password: hashedPassword,
            phone: phone || '',
            schoolId,
            isVerified: false
        });
        await user.save();

        const code = generateVerificationCode();
        const verification = new Verification({
            email,
            code,
            type: 'signup'
        });
        await verification.save();

        school.lastActive = new Date();
        await school.save();

        const userData = user.toObject();
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

// Verify Email
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

        const verification = await Verification.findOne({ email, code, verified: false });
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
        }

        if (Date.now() - new Date(verification.timestamp).getTime() > 600000) {
            return res.status(400).json({ success: false, message: 'Verification code expired. Please request a new one.' });
        }

        verification.verified = true;
        await verification.save();

        const user = await User.findOne({ email });
        if (user) {
            user.isVerified = true;
            await user.save();
        }

        res.json({ success: true, message: 'Email verified successfully.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification.' });
    }
});

// Login
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

        const user = await User.findOne({ email });
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

        if (user.schoolId) {
            await School.findByIdAndUpdate(user.schoolId, { lastActive: new Date() });
        }

        const token = generateToken(user);
        const userData = user.toObject();
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

// Get Current User
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Resend Verification Code
app.post('/api/resend-verification', [
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email } = req.body;
        await Verification.deleteMany({ email, verified: false });

        const code = generateVerificationCode();
        const verification = new Verification({
            email,
            code,
            type: 'signup'
        });
        await verification.save();

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

// Forgot Password
app.post('/api/forgot-password', [
    body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email.' });
        }

        const code = generateVerificationCode();
        const verification = new Verification({
            email,
            code,
            type: 'password_reset'
        });
        await verification.save();

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

// Reset Password
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

        const verification = await Verification.findOne({ email, code, type: 'password_reset', verified: false });
        if (!verification) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code.' });
        }

        if (Date.now() - new Date(verification.timestamp).getTime() > 600000) {
            return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.updateOne({ email }, { password: hashedPassword });
        verification.verified = true;
        await verification.save();

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== SCHOOL ROUTES =====
// ============================================================

// Get all schools
app.get('/api/schools', async (req, res) => {
    try {
        const schools = await School.find({ verified: true }).sort({ name: 1 });
        res.json({ success: true, schools });
    } catch (error) {
        console.error('Get schools error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Register School
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

        const existingSchool = await School.findOne({ name });
        if (existingSchool) {
            return res.status(400).json({ success: false, message: 'School already registered.' });
        }

        const school = new School({
            name,
            type: type || 'Public',
            location,
            country: country || 'Botswana',
            address: address || '',
            phone,
            email,
            website: website || '',
            grades: grades || [],
            language: language || 'English',
            description: description || '',
            adminName,
            adminEmail,
            adminPhone: adminPhone || '',
            verified: true,
            createdAt: new Date(),
            lastActive: new Date()
        });
        await school.save();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const adminUser = new User({
            username: adminName,
            email: adminEmail,
            password: hashedPassword,
            phone: adminPhone || '',
            schoolId: school._id,
            isSchoolAdmin: true,
            isVerified: true
        });
        await adminUser.save();

        const token = generateToken(adminUser);

        res.status(201).json({
            success: true,
            message: 'School registered successfully.',
            school: school.toObject(),
            token,
            user: {
                username: adminUser.username,
                email: adminUser.email,
                schoolId: adminUser.schoolId,
                isSchoolAdmin: adminUser.isSchoolAdmin
            }
        });
    } catch (error) {
        console.error('Register school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get school by ID
app.get('/api/school/:id', async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }
        res.json({ success: true, school });
    } catch (error) {
        console.error('Get school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update school profile
app.put('/api/school/:id', authenticateToken, async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        if (req.user.schoolId !== req.params.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this school.' });
        }

        const updates = req.body;
        const allowedUpdates = ['name', 'type', 'location', 'country', 'address', 'phone', 'email', 'website', 'grades', 'language', 'description', 'motto', 'contacts', 'settings'];
        
        allowedUpdates.forEach(key => {
            if (updates[key] !== undefined) {
                school[key] = updates[key];
            }
        });

        school.lastActive = new Date();
        await school.save();

        res.json({ success: true, message: 'School updated successfully.', school });
    } catch (error) {
        console.error('Update school error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update school stats
app.put('/api/school/:id/stats', authenticateToken, async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found.' });
        }

        if (req.user.schoolId !== req.params.id) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }

        const { students, teachers, totalSubjects, totalClasses } = req.body;
        
        if (students !== undefined) school.students = students;
        if (teachers !== undefined) school.teachers = teachers;
        if (totalSubjects !== undefined) school.totalSubjects = totalSubjects;
        if (totalClasses !== undefined) school.totalClasses = totalClasses;

        await school.save();
        res.json({ success: true, message: 'Stats updated successfully.', school });
    } catch (error) {
        console.error('Update stats error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== STUDENT ROUTES =====
// ============================================================

// Register child
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

        const existingStudent = await Student.findOne({
            childFirstName,
            childLastName,
            guardianEmail,
            schoolId
        });
        if (existingStudent) {
            return res.status(400).json({ success: false, message: 'Child already registered under this guardian.' });
        }

        const fullName = `${childFirstName} ${childLastName}`;

        const student = new Student({
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
            verified: true
        });
        await student.save();

        const guardian = new Guardian({
            studentId: student._id,
            guardianEmail,
            schoolId,
            childName: fullName,
            grade: parseInt(grade)
        });
        await guardian.save();

        await School.findByIdAndUpdate(schoolId, { 
            $inc: { students: 1 },
            lastActive: new Date()
        });

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

// Get students by school
app.get('/api/students', authenticateToken, async (req, res) => {
    try {
        const students = await Student.find({ schoolId: req.user.schoolId }).sort({ fullName: 1 });
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get students by guardian email
app.get('/api/students/guardian/:email', authenticateToken, async (req, res) => {
    try {
        const students = await Student.find({ 
            guardianEmail: req.params.email,
            schoolId: req.user.schoolId 
        });
        res.json({ success: true, students });
    } catch (error) {
        console.error('Get guardian students error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Delete student
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findOneAndDelete({ 
            _id: req.params.id, 
            schoolId: req.user.schoolId 
        });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }
        
        await Guardian.deleteMany({ studentId: req.params.id });
        await AdminReport.deleteMany({ studentId: req.params.id });
        await TestResult.deleteMany({ childId: req.params.id });
        
        await School.findByIdAndUpdate(req.user.schoolId, { 
            $inc: { students: -1 }
        });

        res.json({ success: true, message: 'Student deleted successfully.' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== GUARDIAN ROUTES =====
// ============================================================

// Get guardians by school
app.get('/api/guardians', authenticateToken, async (req, res) => {
    try {
        const guardians = await Guardian.find({ schoolId: req.user.schoolId });
        res.json({ success: true, guardians });
    } catch (error) {
        console.error('Get guardians error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get children by guardian
app.get('/api/guardians/:email/children', authenticateToken, async (req, res) => {
    try {
        const children = await Guardian.find({ 
            guardianEmail: req.params.email,
            schoolId: req.user.schoolId 
        });
        res.json({ success: true, children });
    } catch (error) {
        console.error('Get children error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== REPORT ROUTES =====
// ============================================================

// Add admin report
app.post('/api/reports', authenticateToken, [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('score').isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
    body('term').notEmpty().withMessage('Term is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { studentId, subject, score, term, comment } = req.body;
        const schoolId = req.user.schoolId;

        const student = await Student.findOne({ _id: studentId, schoolId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found in this school.' });
        }

        const report = new AdminReport({
            studentId,
            schoolId,
            subject,
            score,
            term,
            comment: comment || '',
            date: new Date()
        });
        await report.save();

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

// Get reports by student
app.get('/api/reports/student/:studentId', authenticateToken, async (req, res) => {
    try {
        const reports = await AdminReport.find({ 
            studentId: req.params.studentId,
            schoolId: req.user.schoolId 
        }).sort({ date: -1 });
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all reports by school
app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
        const reports = await AdminReport.find({ schoolId: req.user.schoolId }).sort({ date: -1 });
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Delete report
app.delete('/api/reports/:id', authenticateToken, async (req, res) => {
    try {
        const report = await AdminReport.findOneAndDelete({ 
            _id: req.params.id, 
            schoolId: req.user.schoolId 
        });
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found.' });
        }
        res.json({ success: true, message: 'Report deleted successfully.' });
    } catch (error) {
        console.error('Delete report error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== TEST RESULT ROUTES =====
// ============================================================

// Save test result
app.post('/api/test-results', authenticateToken, [
    body('childId').notEmpty().withMessage('Child ID is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('grade').notEmpty().withMessage('Grade is required'),
    body('score').isInt({ min: 0, max: 100 }).withMessage('Score must be between 0 and 100'),
    body('totalQuestions').notEmpty().withMessage('Total questions is required'),
    body('correctAnswers').notEmpty().withMessage('Correct answers is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { childId, subject, grade, score, totalQuestions, correctAnswers } = req.body;
        const schoolId = req.user.schoolId;

        const student = await Student.findOne({ _id: childId, schoolId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        const testResult = new TestResult({
            childId,
            schoolId,
            childName: student.fullName,
            subject,
            grade: parseInt(grade),
            score,
            totalQuestions,
            correctAnswers,
            passed: score >= 70,
            date: new Date()
        });
        await testResult.save();

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

// Get test results by child
app.get('/api/test-results/child/:childId', authenticateToken, async (req, res) => {
    try {
        const results = await TestResult.find({ 
            childId: req.params.childId,
            schoolId: req.user.schoolId 
        }).sort({ date: -1 });
        res.json({ success: true, results });
    } catch (error) {
        console.error('Get test results error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all test results by school
app.get('/api/test-results', authenticateToken, async (req, res) => {
    try {
        const results = await TestResult.find({ schoolId: req.user.schoolId }).sort({ date: -1 });
        res.json({ success: true, results });
    } catch (error) {
        console.error('Get all test results error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== TEACHER ROUTES =====
// ============================================================

// Add teacher
app.post('/api/teachers', authenticateToken, [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { firstName, lastName, email, subject, phone } = req.body;
        const schoolId = req.user.schoolId;

        const teacher = new Teacher({
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email,
            subject,
            phone: phone || '',
            schoolId
        });
        await teacher.save();

        await School.findByIdAndUpdate(schoolId, { 
            $inc: { teachers: 1 },
            lastActive: new Date()
        });

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

// Get teachers by school
app.get('/api/teachers', authenticateToken, async (req, res) => {
    try {
        const teachers = await Teacher.find({ schoolId: req.user.schoolId }).sort({ fullName: 1 });
        res.json({ success: true, teachers });
    } catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Delete teacher
app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
    try {
        const teacher = await Teacher.findOneAndDelete({ 
            _id: req.params.id, 
            schoolId: req.user.schoolId 
        });
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found.' });
        }
        
        await School.findByIdAndUpdate(req.user.schoolId, { 
            $inc: { teachers: -1 }
        });

        res.json({ success: true, message: 'Teacher deleted successfully.' });
    } catch (error) {
        console.error('Delete teacher error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ============================================================
// ===== SCHOOL HISTORY ROUTES =====
// ============================================================

// Add school history
app.post('/api/school-history', authenticateToken, [
    body('date').notEmpty().withMessage('Date is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { date, title, description } = req.body;
        const schoolId = req.user.schoolId;

        const history = new SchoolHistory({
            schoolId,
            date,
            title,
            description
        });
        await history.save();

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

// Get school history
app.get('/api/school-history', authenticateToken, async (req, res) => {
    try {
        const history = await SchoolHistory.find({ schoolId: req.user.schoolId }).sort({ date: -1 });
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

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API URL: https://my-school-bw-c0gh.onrender.com/api`);
    console.log(`🌐 Frontend URL: https://my-school-bw.onrender.com`);
});