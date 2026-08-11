import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';

export default function SignupScreen({ navigation }) {
  const [role, setRole] = useState('teacher'); // 'teacher' | 'student'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [subject, setSubject] = useState('');
  const [classGrade, setClassGrade] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signup } = useContext(AuthContext);

  const handleSignup = async () => {
    setErrorMsg('');
    if (!name.trim() || !phone.trim() || !pin.trim()) {
      setErrorMsg('Name, phone number, and 6-digit PIN are required.');
      return;
    }

    if (!/^\d{6}$/.test(pin.trim())) {
      setErrorMsg('PIN must be exactly 6 digits.');
      return;
    }

    if (role === 'teacher' && !subject.trim()) {
      setErrorMsg('Subject is required for teacher accounts.');
      return;
    }

    if (role === 'student' && !classGrade.trim()) {
      setErrorMsg('Class/grade is required for student accounts.');
      return;
    }

    setIsSubmitting(true);
    const result = await signup({
      name: name.trim(),
      phone: phone.trim(),
      pin: pin.trim(),
      role,
      subject: role === 'teacher' ? subject.trim() : undefined,
      classGrade: role === 'student' ? classGrade.trim() : undefined,
    });
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error);
    } else {
      // On successful signup, navigate to login with a notice
      navigation.navigate('Login');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>ClassBridge</Text>
          <Text style={styles.subtitle}>Join the ClassBridge Community</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {/* Role Selection Toggle */}
          <Text style={styles.label}>Select Role</Text>
          <View style={styles.roleToggleContainer}>
            <TouchableOpacity
              style={[styles.roleButton, role === 'teacher' && styles.roleButtonActive]}
              onPress={() => setRole('teacher')}
            >
              <Text style={[styles.roleButtonText, role === 'teacher' && styles.roleTextActive]}>
                Teacher
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
              onPress={() => setRole('student')}
            >
              <Text style={[styles.roleButtonText, role === 'student' && styles.roleTextActive]}>
                Student
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. +1234567890"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>6-Digit Security PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Create 6-digit PIN"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />

          {/* Conditional Role Fields */}
          {role === 'teacher' ? (
            <>
              <Text style={styles.label}>Teaching Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mathematics, Science"
                placeholderTextColor="#94a3b8"
                value={subject}
                onChangeText={setSubject}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Class / Grade</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Grade 10, Class A"
                placeholderTextColor="#94a3b8"
                value={classGrade}
                onChangeText={setClassGrade}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Submit Registration</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Log In</Text></Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2563eb',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#2563eb',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  roleTextActive: {
    color: '#ffffff',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#f1f5f9',
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    color: '#64748b',
    fontSize: 14,
  },
  linkBold: {
    color: '#2563eb',
    fontWeight: '700',
  },
});
