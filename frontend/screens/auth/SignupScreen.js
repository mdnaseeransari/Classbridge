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
      navigation.navigate('Login');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>ClassBridge</Text>
            <Text style={styles.subtitle}>Join the ClassBridge Community</Text>
          </View>

          <View style={styles.form}>
            {/* Role Selection Toggle */}
            <Text style={styles.label}>ACCOUNT TYPE</Text>
            <View style={styles.roleToggleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'teacher' ? styles.roleButtonActive : styles.roleButtonInactive]}
                onPress={() => setRole('teacher')}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleButtonText, role === 'teacher' ? styles.roleTextActive : styles.roleTextInactive]}>
                  Teacher
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleButton, role === 'student' ? styles.roleButtonActive : styles.roleButtonInactive]}
                onPress={() => setRole('student')}
                activeOpacity={0.8}
              >
                <Text style={[styles.roleButtonText, role === 'student' ? styles.roleTextActive : styles.roleTextInactive]}>
                  Student
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#708499"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +1234567890"
              placeholderTextColor="#708499"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>6-DIGIT SECURITY PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Create 6-digit PIN"
              placeholderTextColor="#708499"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pin}
              onChangeText={setPin}
            />

            {/* Conditional Role Fields */}
            {role === 'teacher' ? (
              <>
                <Text style={styles.label}>TEACHING SUBJECT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mathematics, Science"
                  placeholderTextColor="#708499"
                  value={subject}
                  onChangeText={setSubject}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>CLASS / GRADE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Grade 10, Class A"
                  placeholderTextColor="#708499"
                  value={classGrade}
                  onChangeText={setClassGrade}
                />
              </>
            )}

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>
                  Already registered? <Text style={styles.linkBold}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17212b',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#17212b',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#5288c1',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#708499',
    marginTop: 6,
    fontWeight: '400',
  },
  form: {
    width: '100%',
  },
  roleToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  roleButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  roleButtonActive: {
    backgroundColor: '#5288c1',
  },
  roleButtonInactive: {
    backgroundColor: '#2b3a4b',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#ffffff',
  },
  roleTextInactive: {
    color: '#708499',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    borderWidth: 0,
    color: '#ffffff',
    paddingHorizontal: 16,
    height: 52,
    fontSize: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
    marginBottom: 14,
    marginLeft: 2,
  },
  button: {
    backgroundColor: '#5288c1',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#708499',
    fontSize: 14,
  },
  linkBold: {
    color: '#5288c1',
    fontWeight: '600',
  },
});
