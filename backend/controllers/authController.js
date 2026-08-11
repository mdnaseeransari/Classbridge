const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Max failed attempts before account locks
const MAX_FAILED_ATTEMPTS = 5;

// ─── Helper: issue a signed JWT ──────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ─── Helper: safe user response (no pin/password/phone for non-admin) ─────────
function safeUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    role: user.role,
    status: user.status,
    subject: user.subject,
    classGrade: user.classGrade,
    createdAt: user.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
// For Teacher and Student self-registration only.
// ─────────────────────────────────────────────────────────────────────────────
async function signup(req, res) {
  try {
    const { name, phone, pin, role, subject, classGrade } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !phone || !pin || !role) {
      return res.status(400).json({ error: 'name, phone, pin, and role are required.' });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({
        error: 'Self-signup is only available for teacher and student roles.',
      });
    }

    // Validate 6-digit PIN before hashing
    if (!/^\d{6}$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
    }

    // Check if phone is already registered
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    // Build the new user document
    const newUser = new User({
      name: name.trim(),
      phone: phone.trim(),
      pin: String(pin), // pre-save hook will hash this
      role,
      status: 'pending', // explicit default; also set in schema
      subject: role === 'teacher' ? (subject || '').trim() || null : null,
      classGrade: role === 'student' ? (classGrade || '').trim() || null : null,
    });

    // Validate role-specific fields
    const roleError = newUser.validateRoleFields();
    if (roleError) {
      return res.status(400).json({ error: roleError });
    }

    await newUser.save();

    return res.status(201).json({
      message:
        'Account created successfully. Your account is pending approval by an administrator.',
      user: safeUserResponse(newUser),
    });
  } catch (err) {
    console.error('[AUTH] signup error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error during signup.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login/teacher-student
// Login for Teacher and Student via phone + 6-digit PIN.
// ─────────────────────────────────────────────────────────────────────────────
async function loginTeacherStudent(req, res) {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ error: 'phone and pin are required.' });
    }

    // Find user by phone; select sensitive fields explicitly for auth checks
    const user = await User.findOne({ phone }).select(
      '+pin +isLocked +failedLoginAttempts +status +role'
    );

    // ── Generic "invalid credentials" for non-existent accounts ───────────────
    if (!user || !['teacher', 'student'].includes(user.role)) {
      return res.status(401).json({ error: 'Invalid phone number or PIN.' });
    }

    // ── Account state checks ───────────────────────────────────────────────────
    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is pending approval. Please wait for an administrator to approve it.',
      });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your account has been rejected.' });
    }
    if (user.isLocked) {
      return res.status(403).json({
        error:
          'Your account is locked due to too many failed login attempts. ' +
          'Please contact an administrator to unlock it.',
      });
    }

    // ── PIN verification ──────────────────────────────────────────────────────
    const pinMatch = await user.comparePin(pin);

    if (!pinMatch) {
      // Increment failed attempts; lock if threshold reached
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.isLocked = true;
        await user.save();
        return res.status(403).json({
          error:
            'Account locked: too many failed login attempts. ' +
            'Please contact an administrator to unlock your account.',
        });
      }
      await user.save();
      const remaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
      return res.status(401).json({
        error: `Invalid phone number or PIN. ${remaining} attempt(s) remaining before lockout.`,
      });
    }

    // ── Successful login: reset failure counter ───────────────────────────────
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    await user.save();

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUserResponse(user),
    });
  } catch (err) {
    console.error('[AUTH] loginTeacherStudent error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login/admin
// Login for Admin and Super Admin via email + password.
// ─────────────────────────────────────────────────────────────────────────────
async function loginAdmin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    // Find user by email; select sensitive fields explicitly for auth checks
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
      '+password +isLocked +failedLoginAttempts +status +role'
    );

    // Generic message — don't reveal whether the email exists
    if (!user || !['admin', 'superadmin'].includes(user.role)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ── Account state checks ───────────────────────────────────────────────────
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account is not active.' });
    }
    if (user.isLocked) {
      return res.status(403).json({
        error:
          'Your account is locked due to too many failed login attempts. ' +
          'Please contact a Super Administrator.',
      });
    }

    // ── Password verification ─────────────────────────────────────────────────
    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.isLocked = true;
        await user.save();
        return res.status(403).json({
          error:
            'Account locked: too many failed login attempts. ' +
            'Please contact a Super Administrator.',
        });
      }
      await user.save();
      const remaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
      return res.status(401).json({
        error: `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`,
      });
    }

    // ── Successful login ──────────────────────────────────────────────────────
    user.failedLoginAttempts = 0;
    user.isLocked = false;
    await user.save();

    const token = signToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUserResponse(user),
    });
  } catch (err) {
    console.error('[AUTH] loginAdmin error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently authenticated user's profile.
// Protected by JWT middleware in routes.
// ─────────────────────────────────────────────────────────────────────────────
async function getMe(req, res) {
  try {
    // req.user is populated by the authenticate middleware
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
    const projection = User.safeProjection(isAdmin);

    const user = await User.findById(req.user.id, projection);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('[AUTH] getMe error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/push-token
// Register or update caller's Expo push token.
// Protected by JWT middleware in routes.
// ─────────────────────────────────────────────────────────────────────────────
async function updatePushToken(req, res) {
  try {
    const { token } = req.body;

    if (token !== null && typeof token !== 'string') {
      return res.status(400).json({ error: 'token must be a string or null.' });
    }

    const expoToken = token ? token.trim() : null;

    if (
      expoToken &&
      !expoToken.startsWith('ExponentPushToken[') &&
      !expoToken.startsWith('ExpoPushToken[')
    ) {
      return res.status(400).json({ error: 'Invalid Expo Push token format.' });
    }

    await User.findByIdAndUpdate(req.user.id, { expoPushToken: expoToken });

    return res.status(200).json({
      message: 'Push token updated successfully.',
      expoPushToken: expoToken,
    });
  } catch (err) {
    console.error('[AUTH] updatePushToken error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/profile
// Update currently authenticated user's profile details.
// Protected by JWT middleware in routes.
// ─────────────────────────────────────────────────────────────────────────────
async function updateProfile(req, res) {
  try {
    const { name, phone } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required and must be a string.' });
    }

    const updateFields = { name: name.trim() };
    if (phone !== undefined) {
      updateFields.phone = phone ? phone.trim() : null;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (err) {
    console.error('[AUTH] updateProfile error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/auth/change-password
// Allows user to update their password (admins) or PIN (teachers/students).
// Protected by JWT middleware in routes.
// ─────────────────────────────────────────────────────────────────────────────
async function changePassword(req, res) {
  try {
    const { oldCredential, newCredential } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isPin = ['teacher', 'student'].includes(user.role);

    if (isPin) {
      const pinMatch = await user.comparePin(oldCredential);
      if (!pinMatch) {
        return res.status(400).json({ error: 'Incorrect current PIN.' });
      }
      if (!newCredential || String(newCredential).length !== 6 || isNaN(newCredential)) {
        return res.status(400).json({ error: 'New PIN must be a 6-digit number.' });
      }
      user.pin = String(newCredential);
    } else {
      const passwordMatch = await user.comparePassword(oldCredential);
      if (!passwordMatch) {
        return res.status(400).json({ error: 'Incorrect current password.' });
      }
      if (!newCredential || String(newCredential).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      user.password = String(newCredential);
    }

    await user.save();

    return res.status(200).json({ message: `${isPin ? 'PIN' : 'Password'} changed successfully.` });
  } catch (err) {
    console.error('[AUTH] changePassword error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-request
// Public endpoint. Takes email (for admins/superadmins) or phone (for teachers/students)
// ─────────────────────────────────────────────────────────────────────────────
async function createForgotRequest(req, res) {
  try {
    const { email, phone } = req.body;

    let user;
    let type;

    if (email) {
      user = await User.findOne({ email: email.trim().toLowerCase() });
      type = 'password';
    } else if (phone) {
      user = await User.findOne({ phone: phone.trim() });
      type = 'pin';
    } else {
      return res.status(400).json({ error: 'Email or phone number is required.' });
    }

    if (!user) {
      return res.status(200).json({ message: 'If an account exists, a reset request has been sent to the Admin.' });
    }

    const existing = await PasswordResetRequest.findOne({ user: user._id, status: 'pending' });
    if (existing) {
      return res.status(200).json({ message: 'A reset request is already pending approval by the Admin.' });
    }

    await PasswordResetRequest.create({
      user: user._id,
      type,
    });

    return res.status(200).json({ message: 'Reset request successfully sent to the Admin.' });
  } catch (err) {
    console.error('[AUTH] createForgotRequest error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  signup,
  loginTeacherStudent,
  loginAdmin,
  getMe,
  updatePushToken,
  updateProfile,
  changePassword,
  createForgotRequest
};

