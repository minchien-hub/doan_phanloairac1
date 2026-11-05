import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../config/firebaseConfig';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập địa chỉ email!');
      return;
    }

    setLoading(true);
    try {
      if (currentScreen === 'login') {
        if (!password.trim()) {
          Alert.alert('Thông báo', 'Vui lòng nhập mật khẩu!');
          setLoading(false);
          return;
        }

        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.replace('/(tabs)');
      } else if (currentScreen === 'register') {
        if (!password.trim() || password.length < 6) {
          Alert.alert('Thông báo', 'Mật khẩu phải từ 6 ký tự trở lên!');
          setLoading(false);
          return;
        }
        if (!fullName.trim()) {
          Alert.alert('Thông báo', 'Vui lòng nhập họ và tên!');
          setLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

        await set(ref(db, `users/${cred.user.uid}`), {
          uid: cred.user.uid,
          email: email.trim(),
          username: fullName.trim(),
          position: position.trim() || 'Nhân viên thu gom',
          createdAt: new Date().toISOString(),
        });

        Alert.alert('Đăng ký thành công! 🎉', 'Tài khoản đã được kích hoạt thành công.');
        setCurrentScreen('login');
        setPassword('');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        Alert.alert('Đã gửi email', 'Vui lòng kiểm tra hộp thư để nhận liên kết khôi phục mật khẩu!');
        setCurrentScreen('login');
      }
    } catch (error: any) {
      Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra trong quá trình xác thực.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={[styles.root, { backgroundColor: '#1b5e20' }]}>
        {/* ===== TOP HERO AREA ===== */}
        <View style={styles.heroArea}>
          {currentScreen !== 'login' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setCurrentScreen('login');
                setPassword('');
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          <View style={styles.heroContent}>
            <View style={styles.leafIconCircle}>
              <Ionicons name="trash-outline" size={32} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Hệ Thống Quản Lý Thu Gom Rác</Text>
          </View>
        </View>

        {/* ===== WHITE BOTTOM SHEET FORM ===== */}
        <ScrollView
          style={styles.formSheet}
          contentContainerStyle={styles.formSheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.formHeading}>
            {currentScreen === 'login' && 'Đăng nhập'}
            {currentScreen === 'register' && 'Đăng ký tài khoản'}
            {currentScreen === 'forgot' && 'Khôi phục mật khẩu'}
          </Text>

          {/* Form đăng ký — Họ và tên + Chức vụ */}
          {currentScreen === 'register' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Họ và tên</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="person-outline" size={18} color="#1b5e20" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="VD: Nguyễn Văn A"
                    placeholderTextColor="#bbb"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Chức vụ</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="briefcase-outline" size={18} color="#1b5e20" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="VD: Nhân viên thu gom"
                    placeholderTextColor="#bbb"
                    value={position}
                    onChangeText={setPosition}
                  />
                </View>
              </View>
            </>
          )}

          {/* Email input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Địa chỉ Email</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={18} color="#1b5e20" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nhập email của bạn"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Password input */}
          {currentScreen !== 'forgot' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu</Text>
              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={18} color="#1b5e20" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu (từ 6 ký tự)"
                  placeholderTextColor="#bbb"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {currentScreen === 'login' && (
            <TouchableOpacity
              style={styles.forgotPassContainer}
              onPress={() => {
                setCurrentScreen('forgot');
                setPassword('');
              }}
            >
              <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading
                ? 'Đang kết nối...'
                : currentScreen === 'login'
                ? 'Đăng Nhập'
                : currentScreen === 'register'
                ? 'Đăng Ký'
                : 'Khôi Phục Mật Khẩu'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* Chuyển đổi giữa Đăng nhập / Đăng ký */}
          {currentScreen === 'login' ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrentScreen('register');
                  setPassword('');
                }}
              >
                <Text style={styles.linkText}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          ) : currentScreen === 'register' ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Đã có tài khoản? </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrentScreen('login');
                  setPassword('');
                }}
              >
                <Text style={styles.linkText}>Quay lại Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heroArea: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 22,
    minHeight: SCREEN_HEIGHT * 0.25,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  heroContent: { alignItems: 'center' },
  leafIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', textAlign: 'center' },

  // Bottom Sheet
  formSheet: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 10,
  },
  formSheetContent: { padding: 20, paddingBottom: 36 },

  formHeading: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 12 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#444', marginBottom: 4 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fbf9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 13, color: '#333' },
  eyeBtn: { padding: 4 },
  forgotPassContainer: { alignSelf: 'flex-end', marginBottom: 14 },
  forgotPassText: { fontSize: 11, color: '#1b5e20', fontWeight: '600' },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    marginTop: 4,
    backgroundColor: '#1b5e20',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  footerText: { fontSize: 12, color: '#666' },
  linkText: { fontSize: 12, color: '#1b5e20', fontWeight: 'bold' },
});
