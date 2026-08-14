const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  signup,
  loginTeacherStudent,
  loginAdmin,
  getMe,
  updatePushToken,
  updateProfile,
  changePassword,
  createForgotRequest,
  changePin,
  forgotPin
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Login-specific rate limiter ──────────────────────────────────────────────
// 5 attempts per 15 minutes per IP address.
// This is the IP-level guard; per-account lockout is handled inside the controller.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true, // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false,
  message: {
    error:
      'Too many login attempts from this IP address. ' +
      'Please try again after 15 minutes.',
  },
  // Don't count requests that result in successful logins against the limit
  skipSuccessfulRequests: true,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/auth/signup
 * @desc    Self-registration for Teacher and Student accounts.
 *          Created with status "pending"; requires admin approval to log in.
 * @access  Public
 * @body    { name, phone, pin, role: 'teacher'|'student', subject?, classGrade? }
 */
router.post('/signup', signup);

/**
 * @route   POST /api/auth/login/teacher-student
 * @desc    Login for Teacher and Student via phone number + 6-digit PIN.
 *          Returns a JWT on success. Locks account after 5 failed attempts.
 * @access  Public (rate limited: 5 attempts / 15 min per IP)
 * @body    { phone, pin }
 */
router.post('/login/teacher-student', loginRateLimiter, loginTeacherStudent);

/**
 * @route   POST /api/auth/login/admin
 * @desc    Login for Admin and Super Admin via email + password.
 *          Returns a JWT on success. Locks account after 5 failed attempts.
 * @access  Public (rate limited: 5 attempts / 15 min per IP)
 * @body    { email, password }
 */
router.post('/login/admin', loginRateLimiter, loginAdmin);

/**
 * @route   GET /api/auth/me
 * @desc    Returns the currently authenticated user's profile.
 *          Phone is excluded unless the caller is an admin/superadmin.
 * @access  Private (requires valid JWT)
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PATCH /api/auth/profile
 * @desc    Update user's profile (name, phone).
 * @access  Private (requires valid JWT)
 * @body    { name, phone }
 */
router.patch('/profile', authenticate, updateProfile);

/**
 * @route   PATCH /api/auth/change-password
 * @desc    Change user's password or PIN.
 * @access  Private (requires valid JWT)
 * @body    { oldCredential, newCredential }
 */
router.patch('/change-password', authenticate, changePassword);

/**
 * @route   PATCH /api/auth/change-pin
 * @desc    Allows forced change of PIN on next login.
 * @access  Private (requires valid JWT)
 * @body    { newPin, confirmPin }
 */
router.patch('/change-pin', authenticate, changePin);

/**
 * @route   POST /api/auth/forgot-request
 * @desc    Create a forgot password/PIN reset request.
 * @access  Public
 * @body    { email, phone }
 */
router.post('/forgot-request', createForgotRequest);

/**
 * @route   POST /api/auth/forgot-pin
 * @desc    Create a PIN reset request.
 * @access  Public
 * @body    { phone }
 */
router.post('/forgot-pin', forgotPin);

/**
 * @route   POST /api/auth/push-token
 * @desc    Register or update user's Expo push token.
 * @access  Private (requires valid JWT)
 * @body    { token: string | null }
 */
router.post('/push-token', authenticate, updatePushToken);

module.exports = router;
