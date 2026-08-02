const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this-in-production';

// ============================================================
// ===== DATABASE SETUP =====
// ============================================================
const DATA_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Database collections
const collections = [
    'users.json', 
    'schools.json', 
    'students.json', 
    'guardians.json', 
    'reports.json', 
    'test_results.json',
    'teachers.json',
    'attendance.json',
    'notifications.json',
    'chat_messages.json',
    'ai_predictions.json',
    'analytics.json',
    'smart_recommendations.json'
];

collections.forEach(f => {
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
});

// Database helpers
function readData(f) {
    try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); } 
    catch(e) { return []; }
}

function writeData(f, d) {
    try { fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2)); return true; } 
    catch(e) { return false; }
}

function generateId() {
    return 'ID' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, schoolId: user.schoolId, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function verifyToken(token) {
    try { return jwt.verify(token, JWT_SECRET); }
    catch(e) { return null; }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Auth middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    req.user = decoded;
    next();
};

// Role middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        next();
    };
};

// ============================================================
// ===== AI & INTELLIGENT FEATURES =====
// ============================================================

// 1. AI Chatbot - Educational Assistant
app.post('/api/ai/chat', authenticate, async (req, res) => {
    const { message, context } = req.body;
    const user = req.user;
    
    // Store chat message
    const chats = readData('chat_messages.json');
    const chat = {
        id: generateId(),
        userId: user.id,
        message: message,
        context: context || {},
        timestamp: new Date().toISOString(),
        response: generateAIResponse(message, context)
    };
    chats.push(chat);
    writeData('chat_messages.json', chats);
    
    res.json({ 
        success: true, 
        response: chat.response,
        suggestions: generateSuggestions(message)
    });
});

// AI Response Generator
function generateAIResponse(message, context) {
    const msg = message.toLowerCase();
    
    // Educational responses
    if (msg.includes('math') || msg.includes('mathematics')) {
        return "📐 I can help with mathematics! Topics include: Algebra, Geometry, Arithmetic, and Problem Solving. What specific math concept do you need help with?";
    }
    if (msg.includes('science')) {
        return "🔬 Science is fascinating! I can help with: Biology, Chemistry, Physics, Environmental Science, and Scientific Methods. What area interests you?";
    }
    if (msg.includes('english') || msg.includes('language')) {
        return "📖 Great! I can help with: Grammar, Reading Comprehension, Writing Skills, Vocabulary Building, and Literature. What would you like to practice?";
    }
    if (msg.includes('test') || msg.includes('exam')) {
        return "📝 I can help with test preparation! Would you like: Practice Questions, Study Tips, Time Management Strategies, or Subject Reviews?";
    }
    if (msg.includes('progress') || msg.includes('grade')) {
        return "📊 Let's track your progress! I can help you with: Performance Analysis, Goal Setting, Study Plans, and Improvement Strategies.";
    }
    if (msg.includes('homework') || msg.includes('assignment')) {
        return "✏️ Homework help is here! I can assist with: Understanding the Assignment, Research Tips, Writing Help, and Reviewing Your Work.";
    }
    if (msg.includes('career') || msg.includes('future')) {
        return "🎯 Career planning is important! Let's explore: Career Paths, Skill Development, Education Requirements, and Future Opportunities.";
    }
    
    // Default response
    return "🤖 I'm your AI Learning Assistant! I can help you with: Mathematics, Science, English, Test Preparation, Progress Tracking, Homework Help, and Career Planning. What would you like to learn about?";
}

// Generate suggestions based on message
function generateSuggestions(message) {
    const suggestions = [
        "📚 Study Tips",
        "📝 Practice Tests",
        "📊 Track Progress", 
        "🎯 Set Goals",
        "📖 Learning Resources"
    ];
    return suggestions.slice(0, 3);
}

// 2. AI - Student Performance Prediction
app.post('/api/ai/predict-performance', authenticate, requireRole(['admin', 'teacher']), (req, res) => {
    const { studentId } = req.body;
    const students = readData('students.json');
    const reports = readData('reports.json');
    const tests = readData('test_results.json');
    
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    // Get student's historical data
    const studentReports = reports.filter(r => r.studentId === studentId);
    const studentTests = tests.filter(t => t.childId === studentId);
    const allScores = [...studentReports.map(r => r.score), ...studentTests.map(t => t.score)];
    
    // Calculate predictions
    const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const trend = allScores.length > 1 ? (allScores[allScores.length - 1] - allScores[0]) / allScores.length : 0;
    const predictedScore = Math.min(100, Math.max(0, avgScore + (trend * 2)));
    
    // Generate recommendations
    const recommendations = generateRecommendations(student, allScores);
    
    const prediction = {
        studentId: studentId,
        studentName: student.fullName,
        currentAvgScore: Math.round(avgScore),
        predictedScore: Math.round(predictedScore),
        confidence: Math.min(95, 70 + (allScores.length * 2)),
        trend: trend > 2 ? 'improving' : trend < -2 ? 'declining' : 'stable',
        recommendations: recommendations,
        timestamp: new Date().toISOString()
    };
    
    // Save prediction
    const predictions = readData('ai_predictions.json');
    predictions.push(prediction);
    writeData('ai_predictions.json', predictions);
    
    res.json({ success: true, prediction });
});

// Generate personalized recommendations
function generateRecommendations(student, scores) {
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const recommendations = [];
    
    if (avg < 50) {
        recommendations.push("📚 Need intensive support in core subjects. Consider one-on-one tutoring.");
        recommendations.push("📝 Daily practice exercises recommended (30 minutes per subject)");
        recommendations.push("👨‍👩‍👦 Parent-teacher meeting strongly recommended");
    } else if (avg < 70) {
        recommendations.push("📚 Focus on improving weak areas identified in recent tests");
        recommendations.push("⏰ Increase study time by 15 minutes per subject daily");
        recommendations.push("📝 Practice past papers to improve exam technique");
    } else if (avg < 85) {
        recommendations.push("🎯 Excellent progress! Focus on advanced topics");
        recommendations.push("🏆 Consider enrichment programs or competitions");
        recommendations.push("📚 Explore extension materials in strong subjects");
    } else {
        recommendations.push("🌟 Outstanding performance! Consider mentoring other students");
        recommendations.push("🎓 Prepare for advanced placement opportunities");
        recommendations.push("📖 Explore university preparation resources");
    }
    
    return recommendations.slice(0, 3);
}

// 3. AI - Smart Search
app.get('/api/ai/search/:query', authenticate, (req, res) => {
    const query = req.params.query.toLowerCase();
    const results = [];
    
    // Search students
    const students = readData('students.json');
    const matchedStudents = students.filter(s => 
        s.fullName.toLowerCase().includes(query) ||
        s.childFirstName.toLowerCase().includes(query) ||
        s.childLastName.toLowerCase().includes(query)
    );
    results.push(...matchedStudents.map(s => ({ type: 'student', data: s })));
    
    // Search teachers
    const teachers = readData('teachers.json');
    const matchedTeachers = teachers.filter(t => 
        t.fullName.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query)
    );
    results.push(...matchedTeachers.map(t => ({ type: 'teacher', data: t })));
    
    // Search schools
    const schools = readData('schools.json');
    const matchedSchools = schools.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.location.toLowerCase().includes(query)
    );
    results.push(...matchedSchools.map(s => ({ type: 'school', data: s })));
    
    // Search reports
    const reports = readData('reports.json');
    const matchedReports = reports.filter(r => 
        r.subject.toLowerCase().includes(query) ||
        r.studentName.toLowerCase().includes(query)
    );
    results.push(...matchedReports.map(r => ({ type: 'report', data: r })));
    
    res.json({ 
        success: true, 
        results: results.slice(0, 20),
        total: results.length,
        query: query
    });
});

// 4. AI - Smart Notifications
app.post('/api/ai/notifications', authenticate, (req, res) => {
    const { userId, type, data } = req.body;
    const notifications = readData('notifications.json');
    
    const notification = {
        id: generateId(),
        userId: userId,
        type: type || 'general',
        data: data || {},
        read: false,
        createdAt: new Date().toISOString(),
        aiGenerated: true,
        priority: calculatePriority(type, data)
    };
    
    notifications.push(notification);
    writeData('notifications.json', notifications);
    
    res.json({ success: true, notification });
});

function calculatePriority(type, data) {
    const priorities = {
        'urgent': 5,
        'academic': 4,
        'parent': 4,
        'general': 3,
        'system': 2,
        'low': 1
    };
    return priorities[type] || 3;
}

// 5. AI - Analytics Dashboard
app.get('/api/ai/analytics', authenticate, requireRole(['admin']), (req, res) => {
    const students = readData('students.json');
    const reports = readData('reports.json');
    const tests = readData('test_results.json');
    const teachers = readData('teachers.json');
    const schools = readData('schools.json');
    const attendance = readData('attendance.json');
    
    // Calculate analytics
    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalSchools = schools.length;
    const totalAssessments = reports.length + tests.length;
    
    // Pass rates
    const passingReports = reports.filter(r => r.score >= 70);
    const passingTests = tests.filter(t => t.score >= 70);
    const passRate = totalAssessments > 0 
        ? ((passingReports.length + passingTests.length) / totalAssessments * 100).toFixed(1)
        : 0;
    
    // Grade distribution
    const gradeDistribution = {};
    students.forEach(s => {
        const grade = s.grade || 'Unknown';
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });
    
    // Subject performance
    const subjectPerformance = {};
    [...reports, ...tests].forEach(a => {
        const subject = a.subject;
        if (!subjectPerformance[subject]) {
            subjectPerformance[subject] = { total: 0, passes: 0, scores: [] };
        }
        subjectPerformance[subject].total++;
        subjectPerformance[subject].scores.push(a.score);
        if (a.score >= 70) subjectPerformance[subject].passes++;
    });
    
    // Calculate subject averages
    Object.keys(subjectPerformance).forEach(subject => {
        const data = subjectPerformance[subject];
        data.average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        data.passRate = (data.passes / data.total * 100).toFixed(1);
        delete data.scores;
    });
    
    // AI Insights
    const insights = generateInsights(students, reports, tests);
    
    const analytics = {
        summary: {
            totalStudents,
            totalTeachers,
            totalSchools,
            totalAssessments,
            overallPassRate: passRate,
            activeUsers: students.filter(s => s.active !== false).length,
            newRegistrations: students.filter(s => {
                const date = new Date(s.registrationDate);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length
        },
        gradeDistribution,
        subjectPerformance,
        attendance: {
            present: attendance.filter(a => a.status === 'present').length,
            absent: attendance.filter(a => a.status === 'absent').length,
            late: attendance.filter(a => a.status === 'late').length
        },
        insights: insights,
        recommendations: generateInsightRecommendations(insights),
        timestamp: new Date().toISOString()
    };
    
    // Save analytics
    const analyticsData = readData('analytics.json');
    analyticsData.push(analytics);
    if (analyticsData.length > 100) analyticsData.shift(); // Keep last 100 records
    writeData('analytics.json', analyticsData);
    
    res.json({ success: true, analytics });
});

function generateInsights(students, reports, tests) {
    const insights = [];
    
    // Overall performance insight
    const allScores = [...reports.map(r => r.score), ...tests.map(t => t.score)];
    if (allScores.length > 0) {
        const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        if (avg < 60) {
            insights.push("⚠️ Overall performance is below target. Consider implementing additional support programs.");
        } else if (avg < 75) {
            insights.push("📊 Overall performance is adequate but has room for improvement. Focus on strengthening core subjects.");
        } else if (avg >= 85) {
            insights.push("🌟 Excellent overall performance! Students are exceeding expectations.");
        }
    }
    
    // Student growth insight
    if (students.length > 10) {
        insights.push("📈 Student population is growing. Consider expanding facilities and teaching staff.");
    }
    
    // Assessment insight
    if (tests.length > reports.length * 2) {
        insights.push("📝 Students are taking more tests than formal assessments. Consider balancing test frequency.");
    }
    
    return insights.slice(0, 3);
}

function generateInsightRecommendations(insights) {
    const recommendations = [];
    insights.forEach(insight => {
        if (insight.includes('below target')) {
            recommendations.push("📚 Implement targeted intervention programs for struggling students.");
            recommendations.push("👨‍👩‍👦 Schedule parent-teacher conferences for all students.");
        }
        if (insight.includes('room for improvement')) {
            recommendations.push("🎯 Set specific improvement goals for each subject.");
            recommendations.push("📖 Provide additional learning resources and practice materials.");
        }
        if (insight.includes('Excellent')) {
            recommendations.push("🏆 Establish an honors program for top-performing students.");
            recommendations.push("📚 Introduce advanced learning materials and enrichment activities.");
        }
    });
    return recommendations.slice(0, 3);
}

// 6. AI - Student Progress Tracking
app.get('/api/ai/progress/:studentId', authenticate, (req, res) => {
    const { studentId } = req.params;
    const reports = readData('reports.json');
    const tests = readData('test_results.json');
    const students = readData('students.json');
    
    const student = students.find(s => s.id === studentId);
    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
    }
    
    const studentReports = reports.filter(r => r.studentId === studentId);
    const studentTests = tests.filter(t => t.childId === studentId);
    
    // Combine all assessments
    const allAssessments = [
        ...studentReports.map(r => ({ ...r, type: 'report' })),
        ...studentTests.map(t => ({ ...t, type: 'test' }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate progress metrics
    const scores = allAssessments.map(a => a.score);
    const progress = scores.length > 1 ? (scores[scores.length - 1] - scores[0]) / scores.length : 0;
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Subject breakdown
    const subjectProgress = {};
    allAssessments.forEach(a => {
        if (!subjectProgress[a.subject]) {
            subjectProgress[a.subject] = { scores: [], dates: [] };
        }
        subjectProgress[a.subject].scores.push(a.score);
        subjectProgress[a.subject].dates.push(a.date);
    });
    
    // Calculate subject trends
    Object.keys(subjectProgress).forEach(subject => {
        const data = subjectProgress[subject];
        data.average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        data.trend = data.scores.length > 1 
            ? (data.scores[data.scores.length - 1] - data.scores[0]) / data.scores.length
            : 0;
        data.passing = data.average >= 70;
        delete data.scores;
        delete data.dates;
    });
    
    res.json({
        success: true,
        student: {
            id: student.id,
            name: student.fullName,
            grade: student.grade
        },
        metrics: {
            currentAverage: Math.round(avgScore),
            progressRate: Math.round(progress),
            totalAssessments: allAssessments.length,
            consistency: scores.length > 1 ? Math.round((1 - (Math.max(...scores) - Math.min(...scores)) / 100) * 100) : 0,
            assessmentBreakdown: {
                reports: studentReports.length,
                tests: studentTests.length
            }
        },
        subjectProgress: subjectProgress,
        recentAssessments: allAssessments.slice(-5),
        recommendations: generateRecommendations(student, scores),
        timestamp: new Date().toISOString()
    });
});

// 7. AI - Smart Scheduling & Reminders
app.post('/api/ai/schedule', authenticate, (req, res) => {
    const { studentId, type, details } = req.body;
    const schedules = readData('schedules.json') || [];
    
    // Generate smart schedule based on student performance
    const reports = readData('reports.json');
    const studentReports = reports.filter(r => r.studentId === studentId);
    const weakSubjects = studentReports
        .filter(r => r.score < 70)
        .map(r => r.subject);
    
    const schedule = {
        id: generateId(),
        studentId: studentId,
        type: type || 'study',
        details: details || {},
        recommendedSubjects: weakSubjects.length > 0 ? weakSubjects : ['Mathematics', 'English', 'Science'],
        schedule: generateStudySchedule(weakSubjects),
        createdAt: new Date().toISOString(),
        aiGenerated: true,
        priority: weakSubjects.length > 2 ? 'high' : 'medium'
    };
    
    schedules.push(schedule);
    writeData('schedules.json', schedules);
    
    res.json({ success: true, schedule });
});

function generateStudySchedule(weakSubjects) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const schedule = {};
    
    days.forEach((day, index) => {
        const subject = weakSubjects[index % weakSubjects.length] || 'Review';
        schedule[day] = {
            subject: subject,
            duration: '45 minutes',
            time: `${9 + index}:00 AM`,
            focus: 'Core Concepts',
            activity: `Practice ${subject} exercises`
        };
    });
    
    return schedule;
}

// ============================================================
// ===== ENHANCED AUTHENTICATION =====
// ============================================================

// Register with email verification
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password, phone, schoolId, role } = req.body;
    const users = readData('users.json');
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const user = {
        id: generateId(),
        username,
        email,
        password: hashedPassword,
        phone: phone || '',
        schoolId,
        role: role || 'parent',
        isVerified: false,
        verificationCode: verificationCode,
        createdAt: new Date().toISOString()
    };
    
    users.push(user);
    writeData('users.json', users);
    
    // Send verification code (simulated)
    console.log(`📧 Verification code for ${email}: ${verificationCode}`);
    
    const userData = { ...user };
    delete userData.password;
    delete userData.verificationCode;
    
    res.json({ 
        success: true, 
        message: 'Registration successful. Please verify your email.',
        user: userData,
        verificationCode: verificationCode // Remove in production
    });
});

// Verify email
app.post('/api/auth/verify', (req, res) => {
    const { email, code } = req.body;
    const users = readData('users.json');
    const user = users.find(u => u.email === email && u.verificationCode === code);
    
    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }
    
    user.isVerified = true;
    user.verificationCode = null;
    writeData('users.json', users);
    
    res.json({ success: true, message: 'Email verified successfully' });
});

// Login with JWT
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const users = readData('users.json');
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    if (!user.isVerified) {
        return res.status(403).json({ 
            success: false, 
            message: 'Please verify your email first',
            needsVerification: true 
        });
    }
    
    const token = generateToken(user);
    const userData = { ...user };
    delete userData.password;
    delete userData.verificationCode;
    
    res.json({ 
        success: true, 
        message: 'Login successful',
        token,
        user: userData
    });
});

// ============================================================
// ===== ENHANCED FEATURES =====
// ============================================================

// 1. Attendance Tracking
app.post('/api/attendance', authenticate, requireRole(['admin', 'teacher']), (req, res) => {
    const { studentId, date, status, notes } = req.body;
    const attendance = readData('attendance.json');
    
    const record = {
        id: generateId(),
        studentId,
        date: date || new Date().toISOString().split('T')[0],
        status: status || 'present', // present, absent, late
        notes: notes || '',
        createdAt: new Date().toISOString()
    };
    
    attendance.push(record);
    writeData('attendance.json', attendance);
    
    res.json({ success: true, record });
});

app.get('/api/attendance/:studentId', authenticate, (req, res) => {
    const attendance = readData('attendance.json');
    const records = attendance.filter(a => a.studentId === req.params.studentId);
    res.json({ success: true, records });
});

// 2. Notifications System
app.get('/api/notifications/:userId', authenticate, (req, res) => {
    const notifications = readData('notifications.json');
    const userNotifications = notifications.filter(n => n.userId === req.params.userId);
    res.json({ success: true, notifications: userNotifications });
});

app.put('/api/notifications/:id/read', authenticate, (req, res) => {
    const notifications = readData('notifications.json');
    const index = notifications.findIndex(n => n.id === req.params.id);
    if (index !== -1) {
        notifications[index].read = true;
        writeData('notifications.json', notifications);
        res.json({ success: true, notification: notifications[index] });
    } else {
        res.status(404).json({ success: false, message: 'Notification not found' });
    }
});

// 3. Bulk Import Students
app.post('/api/students/bulk-import', authenticate, requireRole(['admin']), (req, res) => {
    const { students } = req.body;
    const existingStudents = readData('students.json');
    
    const imported = [];
    const errors = [];
    
    students.forEach((student, index) => {
        try {
            const newStudent = {
                id: generateId(),
                ...student,
                verified: true,
                registrationDate: new Date().toISOString()
            };
            existingStudents.push(newStudent);
            imported.push(newStudent);
        } catch (error) {
            errors.push({ index, error: error.message });
        }
    });
    
    writeData('students.json', existingStudents);
    
    res.json({ 
        success: true, 
        message: `Imported ${imported.length} students`,
        imported,
        errors
    });
});

// 4. Export Data (CSV/JSON)
app.get('/api/export/:type', authenticate, requireRole(['admin']), (req, res) => {
    const { type } = req.params;
    let data = [];
    
    switch(type) {
        case 'students':
            data = readData('students.json');
            break;
        case 'teachers':
            data = readData('teachers.json');
            break;
        case 'reports':
            data = readData('reports.json');
            break;
        case 'analytics':
            data = readData('analytics.json');
            break;
        default:
            return res.status(400).json({ success: false, message: 'Invalid export type' });
    }
    
    res.json({ success: true, data, count: data.length, type });
});

// 5. Dashboard Stats
app.get('/api/dashboard/stats', authenticate, (req, res) => {
    const students = readData('students.json');
    const teachers = readData('teachers.json');
    const reports = readData('reports.json');
    const tests = readData('test_results.json');
    const notifications = readData('notifications.json');
    const attendance = readData('attendance.json');
    const schools = readData('schools.json');
    
    // Get user-specific stats
    const userSchoolId = req.user.schoolId;
    const schoolStudents = students.filter(s => s.schoolId === userSchoolId);
    const schoolTeachers = teachers.filter(t => t.schoolId === userSchoolId);
    const schoolReports = reports.filter(r => r.schoolId === userSchoolId);
    
    const stats = {
        students: {
            total: schoolStudents.length,
            active: schoolStudents.filter(s => s.active !== false).length,
            newThisMonth: schoolStudents.filter(s => {
                const date = new Date(s.registrationDate);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length
        },
        teachers: {
            total: schoolTeachers.length,
            active: schoolTeachers.filter(t => t.active !== false).length
        },
        assessments: {
            total: schoolReports.length + tests.length,
            reports: schoolReports.length,
            tests: tests.filter(t => t.schoolId === userSchoolId).length
        },
        performance: {
            averageScore: schoolReports.length > 0 
                ? Math.round(schoolReports.reduce((a, b) => a + b.score, 0) / schoolReports.length)
                : 0,
            passRate: schoolReports.length > 0
                ? Math.round((schoolReports.filter(r => r.score >= 70).length / schoolReports.length) * 100)
                : 0
        },
        notifications: notifications.filter(n => n.userId === req.user.id && !n.read).length,
        attendance: {
            today: attendance.filter(a => a.date === new Date().toISOString().split('T')[0]).length,
            overall: attendance.length
        },
        schools: schools.length,
        recentActivities: getRecentActivities(schoolStudents, schoolTeachers, schoolReports)
    };
    
    res.json({ success: true, stats });
});

function getRecentActivities(students, teachers, reports) {
    const activities = [];
    
    // Recent student registrations
    students.slice(-5).forEach(s => {
        activities.push({
            type: 'student',
            action: 'registered',
            name: s.fullName,
            date: s.registrationDate
        });
    });
    
    // Recent reports
    reports.slice(-5).forEach(r => {
        activities.push({
            type: 'report',
            action: 'added',
            subject: r.subject,
            score: r.score,
            date: r.date
        });
    });
    
    return activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
}

// ============================================================
// ===== ORIGINAL ROUTES (Keep all existing functionality) =====
// ============================================================

// Keep all your original routes here (schools, students, etc.)
// ... (your existing routes)

// ============================================================
// ===== SERVE HTML PAGES =====
// ============================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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
    console.log(`✅ AI-Powered Server running on port ${PORT}`);
    console.log(`🤖 AI Features: Chat, Predictions, Analytics, Recommendations`);
    console.log(`📊 Database: ${DATA_DIR}`);
});