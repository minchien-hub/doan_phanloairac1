import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { push, ref, set } from 'firebase/database';
import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../config/firebaseConfig';
import { useSmartBin } from '../../constants/ApartmentContext';

export default function SettingsScreen() {
  const {
    userProfile,
    notifyEnabled,
    updateNotifyEnabled,
  } = useSmartBin();

  // Modal Phản hồi / Góp ý
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');

  // Gửi phản hồi
  const handleSendFeedback = async () => {
    if (!feedbackContent.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập nội dung góp ý!');
      return;
    }
    try {
      const feedbackRef = ref(db, 'feedbacks');
      const newRef = push(feedbackRef);
      await set(newRef, {
        content: feedbackContent.trim(),
        createdAt: new Date().toISOString(),
        userEmail: auth.currentUser?.email || 'Nhân viên thu gom',
      });
      Alert.alert('Cảm ơn bạn', 'Ý kiến đóng góp của bạn đã được ghi nhận.');
      setFeedbackContent('');
      setFeedbackModalVisible(false);
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể gửi phản hồi: ' + error.message);
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/login');
          } catch (error: any) {
            Alert.alert('Lỗi', 'Đăng xuất thất bại: ' + error.message);
          }
        },
      },
    ]);
  };

  const currentUserEmail = auth.currentUser?.email || 'quanly.thugom@chungcu.vn';
  const displayName = userProfile?.username || currentUserEmail.split('@')[0];
  const positionText = userProfile?.position || 'Bộ phận Quản lý Thu gom';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cài Đặt Hệ Thống</Text>
        <Text style={styles.headerSubtitle}>
          Quản lý tài khoản, thông báo & ứng dụng
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== USER PROFILE CARD ===== */}
        <View style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmailSub}>{currentUserEmail}</Text>
            <View style={styles.userRoleRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#1b5e20" style={{ marginRight: 4 }} />
                <Text style={styles.roleBadgeText}>{positionText}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== CÀI ĐẶT THÔNG BÁO POPUP ===== */}
        <Text style={styles.sectionHeader}>Cài đặt thông báo</Text>
        <View style={styles.card}>
          <View style={styles.switchRowOutside}>
            <View style={styles.rowAlign}>
              <View style={[styles.iconBox, { backgroundColor: '#fff3e0' }]}>
                <Ionicons name="notifications-outline" size={20} color="#f57c00" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.settingTitle}>Thông báo popup khi thùng đầy</Text>
                <Text style={styles.settingSubtitle}>
                  {notifyEnabled
                    ? 'Đang bật: Hiện popup cảnh báo khi có trạm vượt ngưỡng rác đầy'
                    : 'Đã tắt: Không hiển thị popup cảnh báo'}
                </Text>
              </View>
            </View>
            <Switch
              value={notifyEnabled}
              onValueChange={(val) => updateNotifyEnabled(val)}
              trackColor={{ false: '#ccc', true: '#81c784' }}
              thumbColor={notifyEnabled ? '#1b5e20' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ===== HỖ TRỢ & ĐÓNG GÓP Ý KIẾN ===== */}
        <Text style={styles.sectionHeader}>Hỗ trợ & Đóng góp ý kiến</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setFeedbackModalVisible(true)}
          >
            <View style={styles.rowAlign}>
              <View style={[styles.iconBox, { backgroundColor: '#ede7f6' }]}>
                <Ionicons name="chatbox-ellipses-outline" size={20} color="#7e57c2" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Góp ý phát triển hệ thống</Text>
                <Text style={styles.settingSubtitle}>Gửi ý kiến đóng góp cho chung cư thông minh</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* ===== ĐĂNG XUẤT ===== */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#d32f2f" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Đăng xuất tài khoản</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ===== MODAL: GÓP Ý / PHẢN HỒI ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={feedbackModalVisible}
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gửi Phản Hồi / Góp Ý</Text>
              <TouchableOpacity onPress={() => setFeedbackModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.feedbackArea}
              placeholder="Nhập ý kiến đóng góp hoặc phản ánh sự cố..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={feedbackContent}
              onChangeText={setFeedbackContent}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSendFeedback}>
              <Text style={styles.saveButtonText}>Gửi Phản Hồi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    backgroundColor: '#1b5e20',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // User Card
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1b5e20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  userEmailSub: { fontSize: 11, color: '#777', marginTop: 1 },
  userRoleRow: { marginTop: 4 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#1b5e20' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b5e20',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowAlign: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTitle: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  settingSubtitle: { fontSize: 11, color: '#777', marginTop: 2 },

  switchRowOutside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 1,
  },
  logoutText: { fontSize: 14, fontWeight: 'bold', color: '#d32f2f' },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 18,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 18, elevation: 5 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1b5e20' },
  feedbackArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    height: 90,
    fontSize: 13,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
    marginVertical: 10,
  },
  saveButton: {
    backgroundColor: '#1b5e20',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});
