// ============================================================
// ===== MY SCHOOL BW - UNIVERSAL SCRIPT =====
// ============================================================

// ============================================================
// ===== API CONFIGURATION =====
// ============================================================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'
    : 'https://my-school-bw-c0gh.onrender.com/api';

// ============================================================
// ===== TOKEN MANAGEMENT =====
// ============================================================
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true' && getToken();
}

// ============================================================
// ===== API HELPER =====
// ============================================================
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });
        return await res.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error. Please try again.' };
    }
}

// ============================================================
// ===== ANIMATED BACKGROUND =====
// ============================================================
function initAnimatedBackground() {
    // Check if stars already exist
    if (document.querySelector('.star')) return;
    
    const starsContainer = document.createElement('div');
    starsContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1;';
    document.body.appendChild(starsContainer);

    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--duration', (3 + Math.random() * 5) + 's');
        star.style.animationDelay = Math.random() * 5 + 's';
        star.style.width = (1 + Math.random() * 3) + 'px';
        star.style.height = star.style.width;
        starsContainer.appendChild(star);
    }

    for (let i = 0; i < 3; i++) {
        const shootingStar = document.createElement('div');
        shootingStar.className = 'shooting-star';
        shootingStar.style.top = (10 + Math.random() * 60) + '%';
        shootingStar.style.animationDelay = (2 + i * 3 + Math.random() * 2) + 's';
        shootingStar.style.width = (60 + Math.random() * 80) + 'px';
        document.body.appendChild(shootingStar);
    }
}

// ============================================================
// ===== HAMBURGER MENU =====
// ============================================================
function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburgerBtn');
    if (!hamburger) return;
    
    hamburger.addEventListener('click', function() {
        this.classList.toggle('active');
        const links = document.querySelectorAll('.topnav a:not(.brand)');
        const search = document.querySelector('.topnav .search-container');
        links.forEach(link => link.classList.toggle('mobile-show'));
        if (search) search.classList.toggle('mobile-show');
    });
}

// ============================================================
// ===== SEARCH FUNCTIONALITY =====
// ============================================================
function initSearch() {
    const searchForm = document.getElementById('search-form');
    if (!searchForm) return;
    
    // Define searchable content based on current page
    const getSearchResults = (query) => {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const results = [];
        
        // Common pages
        const pages = [
            { title: 'Home', description: 'Welcome to MY SCHOOL BW.', url: 'index.html' },
            { title: 'Registration', description: 'Register your child for school.', url: 'registration.html' },
            { title: 'My Account', description: 'View and manage your account.', url: 'account.html' },
            { title: 'Education Levels', description: 'View all grade levels.', url: 'level.html' },
            { title: 'Subjects', description: 'Explore all subjects.', url: 'subjects.html' },
            { title: 'Quick Tests', description: 'Test your child\'s knowledge.', url: 'tests.html' },
            { title: 'Administration', description: 'School management and support.', url: 'administration.html' },
            { title: 'School Selector', description: 'Find and select your school.', url: 'school-selector.html' },
            { title: 'School Profile', description: 'View school information.', url: 'school-profile.html' },
            { title: 'Child Progress', description: 'View your child\'s progress.', url: 'progress.html' }
        ];
        
        return pages.filter(p => 
            p.title.toLowerCase().includes(query.toLowerCase()) || 
            p.description.toLowerCase().includes(query.toLowerCase())
        );
    };
    
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        const container = document.getElementById('search-results');
        container.style.display = 'block';

        if (!query) {
            container.innerHTML = '<p>Please enter a search term.</p>';
            return;
        }

        const results = getSearchResults(query);

        if (results.length === 0) {
            container.innerHTML = `<p>No results found for "${query}".</p>`;
            return;
        }

        container.innerHTML = results.map(r =>
            `<div class="result-item"><h3><a href="${r.url}">${r.title}</a></h3><p>${r.description}</p></div>`
        ).join('');
    });

    document.addEventListener('click', function(e) {
        const container = document.getElementById('search-results');
        const searchContainer = document.querySelector('.search-container');
        if (container && searchContainer && !searchContainer.contains(e.target)) {
            container.style.display = 'none';
        }
    });
}

// ============================================================
// ===== SCHOOL MANAGEMENT =====
// ============================================================
function getSelectedSchool() {
    return JSON.parse(localStorage.getItem('selectedSchool'));
}

function getSelectedSchoolId() {
    return localStorage.getItem('selectedSchoolId');
}

function setSelectedSchool(school) {
    localStorage.setItem('selectedSchool', JSON.stringify(school));
    localStorage.setItem('selectedSchoolId', school.id);
}

function loadSelectedSchool() {
    const school = getSelectedSchool();
    const schoolId = getSelectedSchoolId();
    
    // Update school displays on the page
    const schoolNameElements = document.querySelectorAll('[data-school-name]');
    schoolNameElements.forEach(el => {
        el.textContent = school ? school.name : 'Not selected';
    });
    
    const schoolIdElements = document.querySelectorAll('[data-school-id]');
    schoolIdElements.forEach(el => {
        el.value = schoolId || '';
    });
    
    const schoolDisplayElements = document.querySelectorAll('[data-school-display]');
    schoolDisplayElements.forEach(el => {
        el.style.display = school ? 'block' : 'none';
    });
}

function changeSchool() {
    if (confirm('Change school? You will be redirected to the school selector.')) {
        localStorage.removeItem('selectedSchool');
        localStorage.removeItem('selectedSchoolId');
        window.location.href = 'school-selector.html';
    }
}

// ============================================================
// ===== AUTHENTICATION =====
// ============================================================
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        window.location.href = 'account.html';
        return true;
    }
    return false;
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        removeToken();
        localStorage.removeItem('user');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('selectedChildId');
        window.location.href = 'index.html';
    }
}

// ============================================================
// ===== PASSWORD TOGGLE =====
// ============================================================
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ============================================================
// ===== VERIFICATION SYSTEM =====
// ============================================================
let pendingVerificationEmail = '';

function showVerificationModal(email) {
    pendingVerificationEmail = email;
    const modal = document.getElementById('verificationModal');
    if (!modal) return;
    
    const emailDisplay = document.getElementById('verifyEmailDisplay');
    if (emailDisplay) emailDisplay.textContent = email;
    
    modal.classList.add('show');
    const codeInput = document.getElementById('verification-code');
    if (codeInput) {
        codeInput.value = '';
        codeInput.focus();
    }
}

function closeVerificationModal() {
    const modal = document.getElementById('verificationModal');
    if (modal) modal.classList.remove('show');
}

async function verifyAccount() {
    const codeInput = document.getElementById('verification-code');
    const email = pendingVerificationEmail;
    
    if (!codeInput || !email) return;
    
    const code = codeInput.value.trim();
    if (!code || code.length !== 6) {
        showError('verification-code-error', 'Please enter a valid 6-digit code.');
        return;
    }

    const response = await apiCall('/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code })
    });

    if (response.success) {
        closeVerificationModal();
        showAlert('success', '✅ Email verified successfully!', 'signupAlert');
        
        const pendingPassword = sessionStorage.getItem('pendingPassword');
        if (pendingPassword) {
            const loginResponse = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password: pendingPassword })
            });
            if (loginResponse.success) {
                setToken(loginResponse.token);
                localStorage.setItem('user', JSON.stringify(loginResponse.user));
                localStorage.setItem('isLoggedIn', 'true');
                setTimeout(() => {
                    window.location.href = 'account.html';
                }, 1000);
            }
        }
    } else {
        showError('verification-code-error', response.message || 'Invalid code.');
    }
}

async function resendVerificationCode() {
    if (!pendingVerificationEmail) return;
    
    const response = await apiCall('/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: pendingVerificationEmail })
    });
    
    if (response.success) {
        showAlert('info', 'New verification code sent to your email.', 'signupAlert');
    }
}

// ============================================================
// ===== UTILITY FUNCTIONS =====
// ============================================================
function showAlert(type, message, containerId) {
    const alert = document.getElementById(containerId);
    if (!alert) {
        // Fallback: use alert() if container not found
        alert(message);
        return;
    }
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alert.style.display = 'block';
}

function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.style.display = 'none';
}

function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ============================================================
// ===== PAGE-SPECIFIC INITIALIZATIONS =====
// ============================================================
function initPage() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    
    // Initialize common components
    initAnimatedBackground();
    initHamburgerMenu();
    initSearch();
    loadSelectedSchool();
    
    // Page-specific initialization
    switch(page) {
        case 'index.html':
            initIndexPage();
            break;
        case 'account.html':
            initAccountPage();
            break;
        case 'registration.html':
            initRegistrationPage();
            break;
        case 'admin-dashboard.html':
            initAdminDashboard();
            break;
        case 'tests.html':
            initTestsPage();
            break;
        case 'school-selector.html':
            initSchoolSelector();
            break;
        case 'school-registration.html':
            initSchoolRegistration();
            break;
        case 'school-profile.html':
            initSchoolProfile();
            break;
        case 'progress.html':
            initProgressPage();
            break;
        case 'verify.html':
            initVerifyPage();
            break;
        case 'level.html':
            initLevelPage();
            break;
        case 'subjects.html':
            initSubjectsPage();
            break;
        case 'administration.html':
            initAdministrationPage();
            break;
    }
}

// ============================================================
// ===== PAGE: INDEX (Login/Signup) =====
// ============================================================
function initIndexPage() {
    // Check if already logged in
    if (redirectIfLoggedIn()) return;
    
    // Load school if selected
    loadSelectedSchool();
    
    // Show login form by default
    showLogin();
}

function showSignup() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('forgot-password-form').style.display = 'none';
    hideAlerts();
}

function showLogin() {
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('forgot-password-form').style.display = 'none';
    hideAlerts();
}

function showForgotPassword() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('forgot-password-form').style.display = 'block';
    document.getElementById('step1').classList.add('active');
    document.getElementById('step2').classList.remove('active');
    hideAlerts();
}

function hideAlerts() {
    document.querySelectorAll('.alert').forEach(el => el.style.display = 'none');
}

// Login Form
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const schoolId = document.getElementById('login-school-id').value;

            if (!schoolId) {
                alert('Please select a school first.');
                window.location.href = 'school-selector.html';
                return;
            }

            const response = await apiCall('/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                setToken(response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('isLoggedIn', 'true');
                
                const school = getSelectedSchool();
                if (school) {
                    setSelectedSchool(school);
                }
                
                showAlert('success', '✅ Login successful! Redirecting...', 'loginAlert');
                setTimeout(() => {
                    window.location.href = 'account.html';
                }, 1000);
            } else if (response.needsVerification) {
                pendingVerificationEmail = email;
                showVerificationModal(email);
                showAlert('info', 'Please verify your email first. Check your inbox.', 'loginAlert');
            } else {
                showAlert('danger', response.message || 'Invalid email or password.', 'loginAlert');
            }
        });
    }

    // Signup Form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            let valid = true;

            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const phone = document.getElementById('signup-phone').value.trim();
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('confirm-password').value;
            const schoolId = document.getElementById('login-school-id').value;

            if (!schoolId) {
                alert('Please select a school first.');
                window.location.href = 'school-selector.html';
                return;
            }

            // Validate
            if (!username || username.length < 2) {
                showError('signup-username-error', 'Please enter your full name.');
                valid = false;
            } else {
                hideError('signup-username-error');
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('signup-email-error', 'Please enter a valid email.');
                valid = false;
            } else {
                hideError('signup-email-error');
            }

            if (phone.length < 8) {
                showError('signup-phone-error', 'Please enter a valid phone number.');
                valid = false;
            } else {
                hideError('signup-phone-error');
            }

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                showError('signup-password-error', 'Password must be 8+ characters with a number and special character.');
                valid = false;
            } else {
                hideError('signup-password-error');
            }

            if (password !== confirm) {
                showError('confirm-password-error', 'Passwords do not match.');
                valid = false;
            } else {
                hideError('confirm-password-error');
            }

            if (valid) {
                const response = await apiCall('/signup', {
                    method: 'POST',
                    body: JSON.stringify({ username, email, password, phone, schoolId })
                });

                if (response.success) {
                    pendingVerificationEmail = email;
                    sessionStorage.setItem('pendingPassword', password);
                    showVerificationModal(email);
                    showAlert('info', 'Verification code sent to your email. Please check your inbox.', 'signupAlert');
                } else {
                    showAlert('danger', response.message || 'Signup failed. Please try again.', 'signupAlert');
                }
            }
        });
    }

    // Forgot Password
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        window.sendResetCode = async function() {
            const email = document.getElementById('forgot-email').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                showError('forgot-email-error', 'Please enter a valid email.');
                return;
            }
            hideError('forgot-email-error');

            const response = await apiCall('/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                showAlert('success', '📧 Password reset code sent to your email.', 'forgotAlert');
                document.getElementById('step1').classList.remove('active');
                document.getElementById('step2').classList.add('active');
            } else {
                showAlert('danger', response.message || 'No account found with this email.', 'forgotAlert');
            }
        };

        window.resetPassword = async function() {
            const email = document.getElementById('forgot-email').value.trim();
            const code = document.getElementById('reset-code').value.trim();
            const newPassword = document.getElementById('new-password').value;
            const confirmNew = document.getElementById('confirm-new-password').value;

            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
            if (!passwordRegex.test(newPassword)) {
                showError('new-password-error', 'Password must be 8+ characters with a number and special character.');
                return;
            }
            hideError('new-password-error');

            if (newPassword !== confirmNew) {
                showError('confirm-new-password-error', 'Passwords do not match.');
                return;
            }
            hideError('confirm-new-password-error');

            const response = await apiCall('/reset-password', {
                method: 'POST',
                body: JSON.stringify({ email, code, newPassword })
            });

            if (response.success) {
                showAlert('success', '✅ Password reset successfully! Please login.', 'forgotAlert');
                setTimeout(() => showLogin(), 1500);
            } else {
                showAlert('danger', response.message || 'Invalid or expired code.', 'forgotAlert');
            }
        };
    }
});

// ============================================================
// ===== PAGE: ACCOUNT =====
// ============================================================
function initAccountPage() {
    if (!requireAuth()) return;
    loadUserData();
}

async function loadUserData() {
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const response = await apiCall('/me');
    if (!response.success) {
        if (response.message === 'Invalid or expired token') {
            removeToken();
            localStorage.removeItem('isLoggedIn');
            window.location.href = 'index.html';
            return;
        }
        // Fallback to localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        loadUserFromLocal(user);
        return;
    }

    const user = response.user;
    localStorage.setItem('user', JSON.stringify(user));
    loadUserFromLocal(user);
}

function loadUserFromLocal(user) {
    // Update profile
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const dateEl = document.getElementById('registerDate');
    
    if (nameEl) nameEl.textContent = user.username || 'User';
    if (emailEl) emailEl.textContent = user.email || 'No email';
    if (dateEl) dateEl.textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available';

    // Load school info
    const school = getSelectedSchool();
    const schoolNameEl = document.getElementById('accountSchoolName');
    if (schoolNameEl) {
        schoolNameEl.textContent = school ? school.name : 'No school selected';
    }

    // Load children
    loadChildren(user.email);
}

async function loadChildren(guardianEmail) {
    const response = await apiCall(`/students/guardian/${encodeURIComponent(guardianEmail)}`);
    const children = response.success ? response.students : [];

    // Update children count
    const countEl = document.getElementById('childrenCount');
    if (countEl) countEl.textContent = children.length;

    // Update account status
    const user = JSON.parse(localStorage.getItem('user'));
    const statusEl = document.getElementById('accountStatus');
    const badgeEl = document.getElementById('userBadge');

    if (user && user.isVerified) {
        if (statusEl) statusEl.innerHTML = '<span style="color: #34D399;">✅ Verified</span>';
        if (badgeEl) {
            badgeEl.className = 'badge verified';
            badgeEl.textContent = '✅ Verified Account';
        }
    } else {
        if (statusEl) statusEl.innerHTML = '<span style="color: #fca5a5;">⏳ Unverified</span>';
        if (badgeEl) {
            badgeEl.className = 'badge unverified';
            badgeEl.textContent = '⏳ Please Verify';
        }
        // Add verify button if not present
        const profileCard = document.querySelector('.profile-card');
        if (profileCard && !profileCard.querySelector('.btn-verify')) {
            const verifyBtn = document.createElement('button');
            verifyBtn.className = 'btn-verify';
            verifyBtn.textContent = '📧 Verify Account';
            verifyBtn.onclick = async function() {
                const response = await apiCall('/resend-verification', {
                    method: 'POST',
                    body: JSON.stringify({ email: user?.email })
                });
                if (response.success) {
                    alert('📧 Verification code sent to your email. Check your inbox.');
                    window.location.href = `verify.html?email=${encodeURIComponent(user?.email)}`;
                } else {
                    alert(response.message || 'Failed to send verification code.');
                }
            };
            profileCard.appendChild(verifyBtn);
        }
    }

    // Display children
    const container = document.getElementById('childrenList');
    if (!container) return;

    if (children.length === 0) {
        container.innerHTML = `
            <p style="color: var(--text-muted); text-align: center; padding: 1rem;">
                No children registered yet. 
                <a href="registration.html" style="color: #60A5FA;">Register your child here</a>
            </p>
        `;
    } else {
        container.innerHTML = children.map(child => `
            <div class="child-item">
                <div class="info">
                    <span class="name">👶 ${child.fullName || child.childFirstName + ' ' + child.childLastName}</span>
                    <span class="grade">Grade ${child.grade}</span>
                </div>
                <div class="actions">
                    <span class="status ${child.verified ? 'active' : 'pending'}">
                        ${child.verified ? '✅ Active' : '⏳ Pending'}
                    </span>
                    <button class="btn-progress" onclick="viewProgress('${child._id || child.id}')">
                        📊 View Progress
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Update avatar
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        const name = user?.username || 'User';
        avatar.textContent = name.charAt(0).toUpperCase();
    }
}

function viewProgress(childId) {
    localStorage.setItem('selectedChildId', childId);
    window.location.href = 'progress.html';
}

// ============================================================
// ===== PAGE: REGISTRATION =====
// ============================================================
function initRegistrationPage() {
    // Check if logged in, if not, still allow registration but with warning
    if (!isLoggedIn()) {
        // Allow registration but show a note
        const alert = document.getElementById('autofillAlert');
        if (alert) {
            alert.style.display = 'block';
            document.getElementById('autofillMessage').textContent = 
                'ℹ️ You are not logged in. Please login or create an account first.';
        }
        return;
    }
    loadGuardianData();
}

async function loadGuardianData() {
    const token = getToken();
    if (!token) return;

    const response = await apiCall('/me');
    if (response.success) {
        const user = response.user;
        // Auto-fill guardian fields
        if (user.username) {
            const nameParts = user.username.split(' ');
            const firstNameEl = document.getElementById('guardian-first-name');
            const lastNameEl = document.getElementById('guardian-last-name');
            if (firstNameEl) firstNameEl.value = nameParts[0] || '';
            if (lastNameEl) lastNameEl.value = nameParts.slice(1).join(' ') || '';
        }
        
        const emailEl = document.getElementById('guardian-email');
        if (emailEl && user.email) {
            emailEl.value = user.email;
            const label = document.getElementById('guardian-email-label');
            if (label) label.textContent = '📧 Auto-filled from your account';
        }
        
        const phoneEl = document.getElementById('guardian-phone');
        if (phoneEl && user.phone) {
            phoneEl.value = user.phone;
            const label = document.getElementById('guardian-phone-label');
            if (label) label.textContent = '📱 Auto-filled from your account';
        }

        const alert = document.getElementById('autofillAlert');
        if (alert) {
            alert.style.display = 'block';
            document.getElementById('autofillMessage').textContent = 
                `🔄 Guardian information auto-filled from your account (${user.email})`;
        }
    }
}

// Registration Form
document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            let valid = true;

            const schoolId = getSelectedSchoolId();
            if (!schoolId) {
                alert('Please select a school first.');
                window.location.href = 'school-selector.html';
                return;
            }

            // Validate all fields
            const fields = [
                { id: 'child-first-name', error: 'child-first-name-error' },
                { id: 'child-last-name', error: 'child-last-name-error' },
                { id: 'child-dob', error: 'child-dob-error' },
                { id: 'child-grade', error: 'child-grade-error' },
                { id: 'guardian-first-name', error: 'guardian-first-error' },
                { id: 'guardian-last-name', error: 'guardian-last-error' },
                { id: 'guardian-email', error: 'guardian-email-error' },
                { id: 'guardian-phone', error: 'guardian-phone-error' }
            ];

            fields.forEach(f => {
                const el = document.getElementById(f.id);
                if (el && !el.value.trim()) {
                    showError(f.error, 'This field is required.');
                    valid = false;
                } else {
                    hideError(f.error);
                }
            });

            // Validate email
            const email = document.getElementById('guardian-email').value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showError('guardian-email-error', 'Please enter a valid email.');
                valid = false;
            }

            // Validate phone
            const phone = document.getElementById('guardian-phone').value.trim();
            if (phone.length < 8) {
                showError('guardian-phone-error', 'Please enter a valid phone number.');
                valid = false;
            }

            // Validate password
            const password = document.getElementById('register-password').value;
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
            if (!passwordRegex.test(password)) {
                showError('register-password-error', 'Password must be 8+ characters with a number and special character.');
                valid = false;
            }

            // Validate confirm password
            const confirm = document.getElementById('confirm-password').value;
            if (password !== confirm) {
                showError('confirm-password-error', 'Passwords do not match.');
                valid = false;
            }

            if (valid) {
                const childData = {
                    childFirstName: document.getElementById('child-first-name').value.trim(),
                    childLastName: document.getElementById('child-last-name').value.trim(),
                    dateOfBirth: document.getElementById('child-dob').value,
                    grade: parseInt(document.getElementById('child-grade').value),
                    previousSchool: document.getElementById('previous-school').value.trim(),
                    guardianFirstName: document.getElementById('guardian-first-name').value.trim(),
                    guardianLastName: document.getElementById('guardian-last-name').value.trim(),
                    guardianEmail: document.getElementById('guardian-email').value.trim(),
                    guardianPhone: document.getElementById('guardian-phone').value.trim(),
                    password: password
                };

                const response = await apiCall('/register-child', {
                    method: 'POST',
                    body: JSON.stringify(childData)
                });

                if (response.success) {
                    const alert = document.getElementById('registerAlert');
                    alert.className = 'alert alert-success';
                    alert.textContent = '✅ Child registered successfully! Redirecting...';
                    alert.style.display = 'block';
                    
                    setTimeout(() => {
                        window.location.href = 'account.html';
                    }, 1500);
                } else {
                    const alert = document.getElementById('registerAlert');
                    alert.className = 'alert alert-danger';
                    alert.textContent = response.message || 'Registration failed. Please try again.';
                    alert.style.display = 'block';
                }
            }
        });
    }
});

// ============================================================
// ===== PAGE: ADMIN DASHBOARD =====
// ============================================================
function initAdminDashboard() {
    if (!requireAuth()) return;
    
    // Load admin info
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        const nameEl = document.getElementById('adminName');
        const emailEl = document.getElementById('adminEmail');
        if (nameEl) nameEl.textContent = '👤 ' + (user.username || 'Admin');
        if (emailEl) emailEl.textContent = user.email || 'admin@school.com';
    }
    
    loadAdminData();
}

async function loadAdminData() {
    await loadStudents();
    await loadReports();
    await loadTeachers();
    await loadStats();
    await loadStudentSelect();
    await loadSchoolProfile();
}

async function loadStudents() {
    const response = await apiCall('/students');
    const students = response.success ? response.students : [];
    renderStudents(students);
}

function renderStudents(students) {
    const tbody = document.getElementById('studentsBody');
    if (!tbody) return;
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No students registered.</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr>
            <td><strong>${student.fullName || student.childFirstName + ' ' + student.childLastName}</strong></td>
            <td>Grade ${student.grade}</td>
            <td>${student.guardianEmail || 'N/A'}</td>
            <td><span class="status-badge ${student.verified ? 'active' : 'pending'}">${student.verified ? 'Active' : 'Pending'}</span></td>
            <td>
                <div class="actions">
                    <button class="btn-action primary" onclick="editStudent('${student._id || student.id}')">✏️ Edit</button>
                    <button class="btn-action danger" onclick="deleteStudent('${student._id || student.id}')">🗑️ Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadReports() {
    const response = await apiCall('/reports');
    const reports = response.success ? response.reports : [];
    renderReports(reports);
}

function renderReports(reports) {
    const tbody = document.getElementById('reportsBody');
    if (!tbody) return;
    
    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No report cards added.</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(report => `
        <tr>
            <td>${report.studentName || 'Unknown'}</td>
            <td>${report.subject}</td>
            <td><strong>${report.score}%</strong></td>
            <td>${report.score >= 70 ? '🟢 Pass' : '🔴 Fail'}</td>
            <td>${report.term}</td>
            <td>
                <div class="actions">
                    <button class="btn-action primary" onclick="editReport('${report._id || report.id}')">✏️ Edit</button>
                    <button class="btn-action danger" onclick="deleteReport('${report._id || report.id}')">🗑️ Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadTeachers() {
    const response = await apiCall('/teachers');
    const teachers = response.success ? response.teachers : [];
    renderTeachers(teachers);
}

function renderTeachers(teachers) {
    const tbody = document.getElementById('teachersBody');
    if (!tbody) return;
    
    if (teachers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No teachers added.</td></tr>';
        return;
    }

    tbody.innerHTML = teachers.map(teacher => `
        <tr>
            <td><strong>${teacher.fullName || teacher.firstName + ' ' + teacher.lastName}</strong></td>
            <td>${teacher.subject}</td>
            <td>${teacher.email}</td>
            <td><span class="status-badge active">Active</span></td>
            <td>
                <div class="actions">
                    <button class="btn-action primary" onclick="editTeacher('${teacher._id || teacher.id}')">✏️ Edit</button>
                    <button class="btn-action danger" onclick="deleteTeacher('${teacher._id || teacher.id}')">🗑️ Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadStats() {
    const students = await apiCall('/students');
    const reports = await apiCall('/reports');
    const teachers = await apiCall('/teachers');

    const totalStudents = students.success ? students.students.length : 0;
    const totalTeachers = teachers.success ? teachers.teachers.length : 0;
    const totalReports = reports.success ? reports.reports.length : 0;

    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('totalTeachers').textContent = totalTeachers;
    document.getElementById('totalReports').textContent = totalReports;

    if (reports.success && reports.reports.length > 0) {
        const avg = reports.reports.reduce((sum, r) => sum + r.score, 0) / reports.reports.length;
        document.getElementById('avgPerformance').textContent = Math.round(avg) + '%';
    } else {
        document.getElementById('avgPerformance').textContent = 'N/A';
    }
}

function loadStudentSelect() {
    const select = document.getElementById('reportStudent');
    if (!select) return;
    
    // This will be populated when adding reports
}

// Admin Dashboard Form Handlers
document.addEventListener('DOMContentLoaded', function() {
    // Add Student Form
    const addStudentForm = document.getElementById('addStudentForm');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const schoolId = getSelectedSchoolId();
            
            const studentData = {
                childFirstName: document.getElementById('studentFirstName').value.trim(),
                childLastName: document.getElementById('studentLastName').value.trim(),
                dateOfBirth: document.getElementById('studentDob').value,
                grade: parseInt(document.getElementById('studentGrade').value),
                guardianEmail: document.getElementById('studentGuardianEmail').value.trim(),
                guardianPhone: document.getElementById('studentGuardianPhone').value.trim(),
                schoolId: schoolId
            };

            const response = await apiCall('/register-child', {
                method: 'POST',
                body: JSON.stringify(studentData)
            });

            if (response.success) {
                closeModal('addStudentModal');
                addStudentForm.reset();
                loadAdminData();
                alert('✅ Student added successfully!');
            } else {
                alert(response.message || 'Failed to add student.');
            }
        });
    }

    // Add Report Form
    const addReportForm = document.getElementById('addReportForm');
    if (addReportForm) {
        addReportForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const studentId = document.getElementById('reportStudent').value;
            const subject = document.getElementById('reportSubject').value;
            const score = parseInt(document.getElementById('reportScore').value);
            const term = document.getElementById('reportTerm').value;
            const comment = document.getElementById('reportComment').value.trim();

            if (!studentId) {
                alert('Please select a student.');
                return;
            }

            const response = await apiCall('/reports', {
                method: 'POST',
                body: JSON.stringify({ studentId, subject, score, term, comment })
            });

            if (response.success) {
                closeModal('addReportModal');
                addReportForm.reset();
                loadAdminData();
                alert('✅ Report card added successfully!');
            } else {
                alert(response.message || 'Failed to add report.');
            }
        });
    }

    // Add Teacher Form
    const addTeacherForm = document.getElementById('addTeacherForm');
    if (addTeacherForm) {
        addTeacherForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const teacherData = {
                firstName: document.getElementById('teacherFirstName').value.trim(),
                lastName: document.getElementById('teacherLastName').value.trim(),
                email: document.getElementById('teacherEmail').value.trim(),
                subject: document.getElementById('teacherSubject').value,
                phone: document.getElementById('teacherPhone').value.trim()
            };

            const response = await apiCall('/teachers', {
                method: 'POST',
                body: JSON.stringify(teacherData)
            });

            if (response.success) {
                closeModal('addTeacherModal');
                addTeacherForm.reset();
                loadAdminData();
                alert('✅ Teacher added successfully!');
            } else {
                alert(response.message || 'Failed to add teacher.');
            }
        });
    }
});

// Admin Dashboard Functions
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.admin-tabs button').forEach(el => el.classList.remove('active'));
    
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.classList.add('active');
    
    const btn = document.querySelector(`.admin-tabs button[onclick="switchTab('${tab}')"]`);
    if (btn) btn.classList.add('active');
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function deleteStudent(id) {
    if (confirm('Are you sure you want to delete this student?')) {
        apiCall(`/students/${id}`, { method: 'DELETE' })
            .then(() => loadAdminData())
            .catch(() => alert('Failed to delete student.'));
    }
}

function deleteReport(id) {
    if (confirm('Are you sure you want to delete this report?')) {
        apiCall(`/reports/${id}`, { method: 'DELETE' })
            .then(() => loadAdminData())
            .catch(() => alert('Failed to delete report.'));
    }
}

function deleteTeacher(id) {
    if (confirm('Are you sure you want to delete this teacher?')) {
        apiCall(`/teachers/${id}`, { method: 'DELETE' })
            .then(() => loadAdminData())
            .catch(() => alert('Failed to delete teacher.'));
    }
}

function editStudent(id) { alert('Edit student functionality coming soon.'); }
function editReport(id) { alert('Edit report functionality coming soon.'); }
function editTeacher(id) { alert('Edit teacher functionality coming soon.'); }
function refreshData() { loadAdminData(); alert('Data refreshed!'); }

// ============================================================
// ===== PAGE: TESTS =====
// ============================================================
function initTestsPage() {
    loadTest();
}

// Question Bank
const questionBank = {
    math: {
        1: {
            title: '🔢 Mathematics Quiz - Grade 1',
            questions: [
                { q: 'What is 2 + 3?', options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'], answer: 'C' },
                { q: 'What is 5 - 2?', options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'], answer: 'C' },
                { q: 'How many sides does a triangle have?', options: ['A) 1', 'B) 2', 'C) 3', 'D) 4'], answer: 'C' },
                { q: 'What number comes after 7?', options: ['A) 6', 'B) 7', 'C) 8', 'D) 9'], answer: 'C' },
                { q: 'What is 4 + 4?', options: ['A) 6', 'B) 7', 'C) 8', 'D) 9'], answer: 'C' }
            ]
        },
        // ... more grades would be added here
    },
    english: {
        1: {
            title: '📖 English Quiz - Grade 1',
            questions: [
                { q: 'What is the capital letter of "a"?', options: ['A) A', 'B) B', 'C) C', 'D) D'], answer: 'A' },
                { q: 'What rhymes with "cat"?', options: ['A) Dog', 'B) Bat', 'C) Cow', 'D) Fox'], answer: 'B' },
                { q: 'What is the plural of "dog"?', options: ['A) Dog', 'B) Dogs', 'C) Doges', 'D) Doggies'], answer: 'B' },
                { q: 'What color is the sky?', options: ['A) Blue', 'B) Red', 'C) Green', 'D) Yellow'], answer: 'A' },
                { q: 'What is the opposite of "happy"?', options: ['A) Sad', 'B) Joyful', 'C) Happy', 'D) Glad'], answer: 'A' }
            ]
        }
        // ... more grades would be added here
    },
    science: {
        1: {
            title: '🔬 Science Quiz - Grade 1',
            questions: [
                { q: 'What is the sun?', options: ['A) A planet', 'B) A star', 'C) A moon', 'D) A comet'], answer: 'B' },
                { q: 'What do plants need to grow?', options: ['A) Sunlight and water', 'B) Darkness and air', 'C) Food only', 'D) Water only'], answer: 'A' },
                { q: 'What is water in solid form?', options: ['A) Steam', 'B) Water', 'C) Ice', 'D) Rain'], answer: 'C' },
                { q: 'What comes after day?', options: ['A) Morning', 'B) Afternoon', 'C) Night', 'D) Evening'], answer: 'C' },
                { q: 'What is the color of the sun?', options: ['A) Blue', 'B) Yellow', 'C) Red', 'D) Green'], answer: 'B' }
            ]
        }
        // ... more grades would be added here
    },
    setswana: {
        1: {
            title: '🗣️ Setswana Quiz - Grade 1',
            questions: [
                { q: 'What is "dog" in Setswana?', options: ['A) Ntša', 'B) Katse', 'C) Poo', 'D) Nku'], answer: 'A' },
                { q: 'What is "house" in Setswana?', options: ['A) Ntlo', 'B) Kgoro', 'C) Tsela', 'D) Noka'], answer: 'A' },
                { q: 'What is "water" in Setswana?', options: ['A) Mosi', 'B) Metsi', 'C) Mollo', 'D) Moya'], answer: 'B' },
                { q: 'What is "mother" in Setswana?', options: ['A) Mme', 'B) Rre', 'C) Ntate', 'D) Koko'], answer: 'A' },
                { q: 'What is "food" in Setswana?', options: ['A) Metsi', 'B) Mosi', 'C) Dijo', 'D) Mollo'], answer: 'C' }
            ]
        }
        // ... more grades would be added here
    }
};

let currentSubject = 'math';
let currentGrade = 1;
let currentQuestions = [];

function loadTest() {
    const subjectSelect = document.getElementById('subjectSelect');
    const gradeSelect = document.getElementById('gradeSelect');
    
    if (subjectSelect) currentSubject = subjectSelect.value;
    if (gradeSelect) currentGrade = parseInt(gradeSelect.value);

    // Update display
    const subjectNames = { math: 'Mathematics', english: 'English', science: 'Science', setswana: 'Setswana' };
    const displaySubject = document.getElementById('displaySubject');
    const displayGrade = document.getElementById('displayGrade');
    if (displaySubject) displaySubject.textContent = subjectNames[currentSubject];
    if (displayGrade) displayGrade.textContent = `Grade ${currentGrade}`;

    const questions = questionBank[currentSubject]?.[currentGrade];
    if (!questions) {
        const container = document.getElementById('questionsContainer');
        if (container) container.innerHTML = '<p style="color: var(--text-muted);">No questions available for this combination.</p>';
        return;
    }

    currentQuestions = questions.questions;
    const titleEl = document.getElementById('testTitle');
    if (titleEl) titleEl.textContent = questions.title;

    // Render questions
    const container = document.getElementById('questionsContainer');
    if (!container) return;
    
    container.innerHTML = currentQuestions.map((q, index) => `
        <div class="question">
            <p>${index + 1}. ${q.q}</p>
            <div class="options">
                ${q.options.map(opt => `
                    <label>
                        <input type="radio" name="q${index}" value="${opt.charAt(0)}">
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Reset progress and results
    const progressBar = document.getElementById('progressBar');
    if (progressBar) progressBar.style.width = '0%';
    const resultBox = document.getElementById('resultBox');
    if (resultBox) resultBox.style.display = 'none';
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = false;
}

function submitTest() {
    const questions = currentQuestions;
    let score = 0;
    let answered = 0;

    questions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        if (selected) {
            answered++;
            if (selected.value === q.answer) {
                score++;
            }
        }
    });

    // Update progress
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${(answered / questions.length) * 100}%`;
    }

    // Show result
    const resultBox = document.getElementById('resultBox');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const feedback = document.getElementById('feedbackDisplay');

    if (!resultBox || !scoreDisplay || !feedback) return;

    resultBox.style.display = 'block';
    const percentage = (score / questions.length) * 100;

    if (percentage >= 70) {
        resultBox.className = 'result-box pass';
        scoreDisplay.textContent = `⭐ ${score}/${questions.length} (${percentage}%)`;
        feedback.textContent = '🎉 Excellent work! Your child has passed this test! Keep up the great effort!';
    } else {
        resultBox.className = 'result-box fail';
        scoreDisplay.textContent = `📝 ${score}/${questions.length} (${percentage}%)`;
        feedback.textContent = '📚 Keep practicing! Review the material and try again. You can do it!';
    }

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = true;

    // Save result to API
    saveTestResult(percentage, score, questions.length);
}

async function saveTestResult(score, correct, total) {
    const childId = localStorage.getItem('selectedChildId');
    if (!childId) {
        console.log('No child selected, saving to localStorage only');
        saveToLocalStorage(score, correct, total);
        return;
    }

    const response = await apiCall('/test-results', {
        method: 'POST',
        body: JSON.stringify({
            childId,
            subject: currentSubject,
            grade: currentGrade,
            score: Math.round(score),
            totalQuestions: total,
            correctAnswers: correct
        })
    });

    if (!response.success) {
        console.log('Failed to save to API, saving to localStorage');
        saveToLocalStorage(score, correct, total);
    }
}

function saveToLocalStorage(score, correct, total) {
    const results = JSON.parse(localStorage.getItem('testResults')) || [];
    results.push({
        id: 'T' + Date.now(),
        childId: localStorage.getItem('selectedChildId') || 'unknown',
        subject: currentSubject,
        grade: currentGrade,
        score: Math.round(score),
        totalQuestions: total,
        correctAnswers: correct,
        date: new Date().toISOString()
    });
    localStorage.setItem('testResults', JSON.stringify(results));
}

// ============================================================
// ===== PAGE: SCHOOL SELECTOR =====
// ============================================================
function initSchoolSelector() {
    loadSchools();
}

function getSchools() {
    return JSON.parse(localStorage.getItem('schools')) || [];
}

function saveSchools(schools) {
    localStorage.setItem('schools', JSON.stringify(schools));
}

function loadSchools() {
    let schools = getSchools();
    
    if (schools.length === 0) {
        schools = getDefaultSchools();
        saveSchools(schools);
    }

    renderSchools(schools);
}

function getDefaultSchools() {
    return [
        {
            id: 'SCH001',
            name: 'Gaborone Primary School',
            location: 'Gaborone, Botswana',
            type: 'Public',
            contactEmail: 'info@gaboroneprimary.bw',
            description: 'A leading primary school in Gaborone with a focus on academic excellence.',
            students: 450,
            teachers: 25,
            createdAt: new Date().toISOString()
        },
        {
            id: 'SCH002',
            name: 'Francistown Academy',
            location: 'Francistown, Botswana',
            type: 'Private',
            contactEmail: 'info@francistownacademy.bw',
            description: 'Providing quality education in Francistown with modern facilities.',
            students: 320,
            teachers: 18,
            createdAt: new Date().toISOString()
        },
        {
            id: 'SCH003',
            name: 'Maun Community School',
            location: 'Maun, Botswana',
            type: 'Community',
            contactEmail: 'info@maunschool.bw',
            description: 'A community-driven school in Maun focused on accessible education.',
            students: 280,
            teachers: 15,
            createdAt: new Date().toISOString()
        },
        {
            id: 'SCH004',
            name: 'Lobatse International School',
            location: 'Lobatse, Botswana',
            type: 'International',
            contactEmail: 'info@lobatseinternational.bw',
            description: 'An international school in Lobatse offering a globally recognized curriculum.',
            students: 200,
            teachers: 12,
            createdAt: new Date().toISOString()
        },
        {
            id: 'SCH005',
            name: 'Palapye Primary School',
            location: 'Palapye, Botswana',
            type: 'Public',
            contactEmail: 'info@palapyeprimary.bw',
            description: 'A well-established primary school in Palapye with a strong academic record.',
            students: 380,
            teachers: 22,
            createdAt: new Date().toISOString()
        }
    ];
}

function renderSchools(schools) {
    const grid = document.getElementById('schoolGrid');
    if (!grid) return;
    
    if (schools.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🏫</div>
                <p>No schools found. Add your school to get started!</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = schools.map(school => `
        <div class="school-card" onclick="selectSchool('${school.id}')">
            <div class="icon">🏫</div>
            <h3>${school.name}</h3>
            <div class="location">📍 ${school.location}</div>
            <span class="school-badge">${school.type}</span>
            <div class="stats">
                <span>👨‍🎓 ${school.students || 0} students</span>
                <span>👩‍🏫 ${school.teachers || 0} teachers</span>
            </div>
            <button class="btn-select" onclick="event.stopPropagation(); selectSchool('${school.id}')">
                Select This School
            </button>
        </div>
    `).join('');
}

function filterSchools() {
    const query = document.getElementById('schoolSearch')?.value.toLowerCase().trim() || '';
    const schools = getSchools();
    
    if (!query) {
        renderSchools(schools);
        return;
    }

    const filtered = schools.filter(school => 
        school.name.toLowerCase().includes(query) ||
        school.location.toLowerCase().includes(query) ||
        school.type.toLowerCase().includes(query)
    );

    renderSchools(filtered);
}

function selectSchool(schoolId) {
    const schools = getSchools();
    const school = schools.find(s => s.id === schoolId);
    
    if (school) {
        setSelectedSchool(school);
        alert(`🏫 Welcome to ${school.name}!\n\nYou have selected this school. You can now register or login.`);
        window.location.href = 'index.html';
    }
}

// ============================================================
// ===== PAGE: SCHOOL REGISTRATION =====
// ============================================================
function initSchoolRegistration() {
    // Add school registration form handler
    const form = document.getElementById('schoolRegForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            registerSchool();
        });
    }
}

function registerSchool() {
    // Validate all fields
    const fields = [
        { id: 'schoolName', error: 'schoolName-error' },
        { id: 'schoolType', error: 'schoolType-error' },
        { id: 'schoolLocation', error: 'schoolLocation-error' },
        { id: 'schoolCountry', error: 'schoolCountry-error' },
        { id: 'schoolPhone', error: 'schoolPhone-error' },
        { id: 'schoolEmail', error: 'schoolEmail-error' },
        { id: 'adminName', error: 'adminName-error' },
        { id: 'adminEmail', error: 'adminEmail-error' }
    ];

    let valid = true;
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el && !el.value.trim()) {
            showError(f.error, 'This field is required.');
            valid = false;
        } else {
            hideError(f.error);
        }
    });

    if (!valid) return;

    const schoolData = {
        name: document.getElementById('schoolName').value.trim(),
        type: document.getElementById('schoolType').value,
        location: document.getElementById('schoolLocation').value.trim(),
        country: document.getElementById('schoolCountry').value,
        address: document.getElementById('schoolAddress').value.trim(),
        phone: document.getElementById('schoolPhone').value.trim(),
        email: document.getElementById('schoolEmail').value.trim(),
        website: document.getElementById('schoolWebsite').value.trim(),
        grades: Array.from(document.getElementById('schoolGrades').selectedOptions).map(opt => opt.value),
        language: document.getElementById('schoolLanguage').value,
        description: document.getElementById('schoolDescription').value.trim(),
        adminName: document.getElementById('adminName').value.trim(),
        adminEmail: document.getElementById('adminEmail').value.trim(),
        adminPhone: document.getElementById('adminPhone').value.trim(),
        adminPassword: document.getElementById('adminPassword').value
    };

    // Save to localStorage (since we're creating school + admin)
    const schools = getSchools();
    const newSchool = {
        id: 'SCH' + Date.now().toString(36).toUpperCase(),
        ...schoolData,
        students: 0,
        teachers: 0,
        totalSubjects: 0,
        totalClasses: 0,
        verified: true,
        createdAt: new Date().toISOString()
    };

    schools.push(newSchool);
    saveSchools(schools);

    // Create admin user
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const adminUser = {
        id: 'USR' + Date.now().toString(36).toUpperCase(),
        username: schoolData.adminName,
        email: schoolData.adminEmail,
        password: schoolData.adminPassword, // In production, this would be hashed
        phone: schoolData.adminPhone || '',
        schoolId: newSchool.id,
        isSchoolAdmin: true,
        isVerified: true,
        createdAt: new Date().toISOString()
    };
    users.push(adminUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Auto-login
    setSelectedSchool(newSchool);
    localStorage.setItem('user', JSON.stringify(adminUser));
    localStorage.setItem('isLoggedIn', 'true');

    showAlert('success', '✅ School registered successfully! Redirecting to dashboard...', 'schoolRegAlert');
    setTimeout(() => {
        window.location.href = 'admin-dashboard.html';
    }, 2000);
}

// ============================================================
// ===== PAGE: SCHOOL PROFILE =====
// ============================================================
function initSchoolProfile() {
    loadSchoolProfile();
}

function loadSchoolProfile() {
    const school = getSelectedSchool();
    const container = document.getElementById('schoolProfile');
    if (!container) return;
    
    if (!school) {
        container.innerHTML = `
            <div style="text-align:center; padding:3rem; color: var(--text-muted);">
                <p>No school selected. <a href="school-selector.html" style="color: #60A5FA;">Select a school</a></p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="school-header">
            <h1>🏫 ${school.name}</h1>
            <span class="badge ${(school.type || 'public').toLowerCase()}">${school.type || 'Public School'}</span>
            <p style="color: var(--text-secondary); margin-top: 0.5rem;">${school.location || ''}${school.country ? ', ' + school.country : ''}</p>
            ${school.description ? `<p style="color: var(--text-secondary); margin-top: 0.5rem;">${school.description}</p>` : ''}
        </div>

        <div class="school-stats">
            <div class="stat-box">
                <div class="number">${school.students || 0}</div>
                <div class="label">👨‍🎓 Students</div>
            </div>
            <div class="stat-box">
                <div class="number">${school.teachers || 0}</div>
                <div class="label">👩‍🏫 Teachers</div>
            </div>
            <div class="stat-box">
                <div class="number">${school.totalSubjects || 0}</div>
                <div class="label">📚 Subjects</div>
            </div>
            <div class="stat-box">
                <div class="number">${school.totalClasses || 0}</div>
                <div class="label">🏫 Classes</div>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-card">
                <h3>📞 Contact Information</h3>
                ${school.phone ? `<div class="contact-item"><span class="icon">📞</span><span class="value">${school.phone}</span></div>` : ''}
                ${school.email ? `<div class="contact-item"><span class="icon">📧</span><span class="value">${school.email}</span></div>` : ''}
                ${school.website ? `<div class="contact-item"><span class="icon">🌐</span><span class="value"><a href="${school.website}" target="_blank" style="color: #60A5FA;">${school.website}</a></span></div>` : ''}
                ${school.address ? `<div class="contact-item"><span class="icon">📍</span><span class="value">${school.address}</span></div>` : ''}
            </div>

            <div class="info-card">
                <h3>📋 School Details</h3>
                <div class="contact-item"><span class="icon">🏛️</span><span class="value">Type: ${school.type || 'N/A'}</span></div>
                <div class="contact-item"><span class="icon">🌍</span><span class="value">Country: ${school.country || 'N/A'}</span></div>
                <div class="contact-item"><span class="icon">📚</span><span class="value">Grades: ${school.grades ? school.grades.join(', ') : 'N/A'}</span></div>
                <div class="contact-item"><span class="icon">🗣️</span><span class="value">Language: ${school.language || 'N/A'}</span></div>
            </div>
        </div>
    `;
}

// ============================================================
// ===== PAGE: PROGRESS =====
// ============================================================
function initProgressPage() {
    if (!requireAuth()) return;
    loadChildren();
}

async function loadChildren() {
    const user = JSON.parse(localStorage.getItem('user'));
    const school = getSelectedSchool();
    
    if (!user || !school) {
        window.location.href = 'school-selector.html';
        return;
    }

    const response = await apiCall(`/students/guardian/${encodeURIComponent(user.email)}`);
    const students = response.success ? response.students : [];

    const childSelector = document.getElementById('childSelector');
    if (!childSelector) return;

    if (students.length === 0) {
        childSelector.innerHTML = `
            <p style="color: var(--text-muted); text-align: center; width: 100%;">
                No children registered. <a href="registration.html" style="color: #60A5FA;">Register your child</a>
            </p>
        `;
        return;
    }

    childSelector.innerHTML = students.map((child, index) => `
        <button class="${index === 0 ? 'active' : ''}" onclick="selectChild('${child._id || child.id}')">
            👶 ${child.fullName || child.childFirstName + ' ' + child.childLastName} (Grade ${child.grade})
        </button>
    `).join('');

    if (students.length > 0) {
        selectChild(students[0]._id || students[0].id);
    }
}

function selectChild(childId) {
    localStorage.setItem('selectedChildId', childId);
    loadChildProgress(childId);
}

async function loadChildProgress(childId) {
    const reportsResponse = await apiCall(`/reports/student/${childId}`);
    const testsResponse = await apiCall(`/test-results/child/${childId}`);
    
    const reports = reportsResponse.success ? reportsResponse.reports : [];
    const tests = testsResponse.success ? testsResponse.results : [];

    // Update stats
    const allAssessments = [
        ...reports.map(r => ({ score: r.score, type: 'admin' })),
        ...tests.map(t => ({ score: t.score, type: 'parent' }))
    ];

    document.getElementById('totalTests').textContent = allAssessments.length;

    if (allAssessments.length > 0) {
        const scores = allAssessments.map(a => a.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const passCount = allAssessments.filter(a => a.score >= 70).length;
        const passRate = (passCount / allAssessments.length) * 100;

        document.getElementById('passRate').textContent = `${Math.round(passRate)}%`;
        document.getElementById('avgScore').textContent = `${Math.round(avgScore)}%`;
    }

    // Render reports
    const adminContainer = document.getElementById('adminReportsContainer');
    if (adminContainer) {
        if (reports.length === 0) {
            adminContainer.innerHTML = `
                <div class="no-tests">
                    <div class="icon">🏫</div>
                    <p>No report cards from teachers yet</p>
                </div>
            `;
        } else {
            adminContainer.innerHTML = reports.map(report => `
                <div class="test-item">
                    <div class="info">
                        <span class="subject">📚 ${report.subject}</span>
                        <span class="source admin">🏫 Teacher</span>
                        <span class="grade">${report.term}</span>
                        <span class="date">${new Date(report.date).toLocaleDateString()}</span>
                        ${report.comment ? `<div class="report-comment">💬 "${report.comment}"</div>` : ''}
                    </div>
                    <span class="score ${report.score >= 70 ? 'pass' : 'fail'}">${report.score}%</span>
                </div>
            `).join('');
        }
    }

    // Render tests
    const testsContainer = document.getElementById('quickTestsContainer');
    if (testsContainer) {
        if (tests.length === 0) {
            testsContainer.innerHTML = `
                <div class="no-tests">
                    <div class="icon">📝</div>
                    <p>No quick tests taken yet</p>
                    <a href="tests.html" style="color: #60A5FA;">Take a quick test →</a>
                </div>
            `;
        } else {
            testsContainer.innerHTML = tests.map(test => `
                <div class="test-item">
                    <div class="info">
                        <span class="subject">📝 ${test.subject}</span>
                        <span class="source parent">👨‍👩‍👧 Parent</span>
                        <span class="grade">Grade ${test.grade}</span>
                        <span class="date">${new Date(test.date).toLocaleDateString()}</span>
                        <span style="font-size:0.8rem; color:var(--text-muted);">${test.correctAnswers}/${test.totalQuestions} correct</span>
                    </div>
                    <span class="score ${test.score >= 70 ? 'pass' : 'fail'}">${test.score}%</span>
                </div>
            `).join('');
        }
    }
}

// ============================================================
// ===== PAGE: VERIFY =====
// ============================================================
function initVerifyPage() {
    const email = getQueryParam('email');
    if (email) {
        const emailInput = document.getElementById('verify-email');
        if (emailInput) emailInput.value = email;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        verifyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('verify-email').value.trim();
            const code = document.getElementById('verify-code').value.trim();

            if (!email || !code || code.length !== 6) {
                alert('Please enter a valid 6-digit code.');
                return;
            }

            const response = await apiCall('/verify', {
                method: 'POST',
                body: JSON.stringify({ email, code })
            });

            if (response.success) {
                showAlert('success', '✅ Email verified successfully! Redirecting...', 'verifyAlert');
                setTimeout(() => {
                    window.location.href = 'account.html';
                }, 1500);
            } else {
                showAlert('danger', response.message || 'Invalid code. Please try again.', 'verifyAlert');
            }
        });
    }

    // Resend code function
    window.resendCode = async function() {
        const email = document.getElementById('verify-email').value.trim();
        if (!email) {
            alert('Please enter your email address.');
            return;
        }

        const response = await apiCall('/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        if (response.success) {
            showAlert('info', '📧 New verification code sent to your email.', 'verifyAlert');
        } else {
            showAlert('danger', response.message || 'Failed to send verification code.', 'verifyAlert');
        }
    };
});

// ============================================================
// ===== PAGE: LEVEL =====
// ============================================================
function initLevelPage() {
    // Level data is already in the HTML
    // Just ensure the detail view works
}

function showLevelDetail(level) {
    const levelData = {
        1: { title: 'Grade 1', age: 'Ages 6-7', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies'] },
        2: { title: 'Grade 2', age: 'Ages 7-8', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies'] },
        3: { title: 'Grade 3', age: 'Ages 8-9', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies', '🧪 Science'] },
        4: { title: 'Grade 4', age: 'Ages 9-10', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies', '🧪 Science'] },
        5: { title: 'Grade 5', age: 'Ages 10-11', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies', '🧪 Science', '🎭 Cultural Studies'] },
        6: { title: 'Grade 6', age: 'Ages 11-12', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies', '🧪 Science', '🎭 Cultural Studies'] },
        7: { title: 'Grade 7', age: 'Ages 12-13', subjects: ['📖 English', '🗣️ Setswana', '🔢 Mathematics', '🌍 Environmental Science', '🎨 Creative Arts', '💻 Computer Studies', '🧪 Science', '🎭 Cultural Studies', '📚 Social Studies'] }
    };

    const data = levelData[level];
    if (!data) return;

    const titleEl = document.getElementById('detailTitle');
    const ageEl = document.getElementById('detailAge');
    const subjectsContainer = document.getElementById('detailSubjects');
    const detailEl = document.getElementById('levelDetail');

    if (titleEl) titleEl.textContent = data.title;
    if (ageEl) ageEl.textContent = data.age;
    if (subjectsContainer) {
        subjectsContainer.innerHTML = data.subjects.map(s => `<span>${s}</span>`).join('');
    }
    if (detailEl) {
        detailEl.classList.add('active');
        detailEl.scrollIntoView({ behavior: 'smooth' });
    }
}

function closeLevelDetail() {
    const detailEl = document.getElementById('levelDetail');
    if (detailEl) detailEl.classList.remove('active');
}

// ============================================================
// ===== PAGE: SUBJECTS =====
// ============================================================
function initSubjectsPage() {
    // Subjects page is static HTML with JavaScript functions
}

function enrollSubject(subject) {
    document.getElementById('enroll-section').style.display = 'block';
    document.getElementById('enroll-title').textContent = `📚 ${subject}`;
    document.getElementById('enroll-message').textContent = `You are about to enroll in ${subject}. This will add the subject to your child's curriculum.`;
    document.getElementById('enroll-section').scrollIntoView({ behavior: 'smooth' });
}

function confirmEnrollment() {
    const title = document.getElementById('enroll-title');
    if (title) {
        const subject = title.textContent.replace('📚 ', '');
        alert(`✅ Successfully enrolled in ${subject}!`);
        document.getElementById('enroll-section').style.display = 'none';
    }
}

function closeEnroll() {
    document.getElementById('enroll-section').style.display = 'none';
}

// ============================================================
// ===== PAGE: ADMINISTRATION =====
// ============================================================
function initAdministrationPage() {
    loadStats();
}

function loadStats() {
    const students = JSON.parse(localStorage.getItem('students')) || [];
    const teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    const subjects = JSON.parse(localStorage.getItem('subjects')) || [];

    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalTeachers').textContent = teachers.length || 12;
    document.getElementById('totalSubjects').textContent = subjects.length || 8;
    document.getElementById('totalClasses').textContent = 7;
}

function toggleHelp(card) {
    const detail = card.querySelector('.help-detail');
    const btn = card.querySelector('.btn-help');
    
    if (!detail || !btn) return;
    
    // Close all other help details
    document.querySelectorAll('.admin-card .help-detail').forEach(d => {
        if (d !== detail && d.classList.contains('show')) {
            d.classList.remove('show');
            const otherBtn = d.closest('.admin-card')?.querySelector('.btn-help');
            if (otherBtn) otherBtn.classList.remove('active');
        }
    });
    
    detail.classList.toggle('show');
    btn.classList.toggle('active');
    btn.textContent = detail.classList.contains('show') ? 'Hide Help' : 'Get Help';
}

// ============================================================
// ===== INITIALIZE ON PAGE LOAD =====
// ============================================================
document.addEventListener('DOMContentLoaded', initPage);