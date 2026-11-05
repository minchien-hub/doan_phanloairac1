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
import { Lobby, useSmartBin } from '../../constants/ApartmentContext';

export default function SettingsScreen() {
  const {
    userProfile,
    thresholdLimit,
    setThresholdLimit,
    notifyEnabled,
    updateNotifyEnabled,
    lobbies,
    addLobby,
    deleteLobby,
    resetLobby,
    configureWifi,
  } = useSmartBin();

  // Modal Ngưỡng Cảnh Báo
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(thresholdLimit));

  // Modal Danh Sách Trạm Rác
  const [stationListModalVisible, setStationListModalVisible] = useState(false);

  // Modal Wi-Fi
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [targetWifiLobbyId, setTargetWifiLobbyId] = useState<string>(lobbies[0]?.id || '');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  // Modal Thêm Trạm Rác (Đã bỏ chữ "sảnh mới")
  const [addLobbyModalVisible, setAddLobbyModalVisible] = useState(false);
  const [newLobbyName, setNewLobbyName] = useState('');
  const [newLobbyBuilding, setNewLobbyBuilding] = useState('Tòa A');
  const [newLobbyLocation, setNewLobbyLocation] = useState('');

  // Modal Phản hồi
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState('');

  // 1. Xử lý lưu ngưỡng cảnh báo
  const executeSaveThreshold = async (parsed: number) => {
    try {
      const settingsRef = ref(db, 'smart_bin/settings/threshold');
      await set(settingsRef, parsed);
      setThresholdLimit(parsed);
      setThresholdModalVisible(false);
      Alert.alert('Thành công', `Đã cập nhật ngưỡng cảnh báo rác đầy thành ${parsed}%!`);
    } catch (error: any) {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt: ' + error.message);
    }
  };

  const handleSaveSettings = () => {
    const parsed = parseInt(thresholdInput, 10);
    if (isNaN(parsed) || parsed < 30 || parsed > 99) {
      Alert.alert('Ngưỡng không hợp lệ', 'Ngưỡng cảnh báo phải nằm trong khoảng từ 30% đến 99% để đảm bảo vận hành hợp lý!');
      return;
    }

    if (parsed !== 80) {
      const isHigher = parsed > 80;
      Alert.alert(
        'Xác nhận điều chỉnh ngưỡng cảnh báo',
        `Ngưỡng mặc định chuẩn là 80%.\n\nBạn đang ${isHigher ? 'TĂNG' : 'GIẢM'} ngưỡng lên ${parsed}% (${isHigher ? 'rác sẽ chứa nhiều hơn trước khi báo động' : 'sẽ gửi cảnh báo sớm hơn bình thường'}).\n\nBạn có chắc chắn muốn áp dụng thay đổi này không?`,
        [
          { text: 'Hủy bỏ', style: 'cancel' },
          {
            text: 'Đồng ý thay đổi',
            style: isHigher ? 'destructive' : 'default',
            onPress: () => executeSaveThreshold(parsed),
          },
        ]
      );
    } else {
      executeSaveThreshold(80);
    }
  };

  const handleResetDefaultThreshold = () => {
    setThresholdInput('80');
    executeSaveThreshold(80);
  };

  // 2. Xử lý thêm trạm rác
  const handleCreateLobby = async () => {
    if (!newLobbyName.trim() || !newLobbyLocation.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ tên trạm rác và vị trí!');
      return;
    }

    try {
      await addLobby({
        name: newLobbyName.trim(),
        building: newLobbyBuilding.trim(),
        location: newLobbyLocation.trim(),
        status: 'ONLINE',
        lastCleaned: 'Hôm nay',
        bins: {
          organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
          recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
          non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
          hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
        },
      });

      Alert.alert('Thành công', `Đã thêm trạm rác "${newLobbyName}" vào hệ thống thu gom!`);
      setNewLobbyName('');
      setNewLobbyLocation('');
      setAddLobbyModalVisible(false);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể thêm trạm rác: ' + err.message);
    }
  };

  // 3. Xử lý xóa trạm rác
  const handleDeleteStation = (st: Lobby) => {
    if (lobbies.length <= 1) {
      Alert.alert('Thông báo', 'Không thể xóa trạm rác cuối cùng trong hệ thống!');
      return;
    }

    Alert.alert(
      'Xác nhận xóa trạm rác',
      `Bạn có chắc chắn muốn xóa vĩnh viễn trạm rác "${st.name}" (${st.building}) khỏi hệ thống không?\n\nThao tác này không thể hoàn tác.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Xác nhận xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLobby(st.id);
              Alert.alert('Đã xóa', `Đã xóa trạm rác "${st.name}" khỏi hệ thống.`);
            } catch (err: any) {
              Alert.alert('Lỗi', 'Không thể xóa trạm: ' + err.message);
            }
          },
        },
      ]
    );
  };

  // 4. Xử lý reset trạm rác
  const handleResetStation = (st: Lobby) => {
    Alert.alert(
      'Xác nhận đặt lại (Reset) trạm rác',
      `Bạn có chắc muốn đặt lại dữ liệu cảm biến của "${st.name}" về 0% và ổn định trạng thái bình thường?`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Xác nhận Reset',
          style: 'default',
          onPress: async () => {
            try {
              await resetLobby(st.id);
              Alert.alert('Thành công', `Đã đặt lại (reset) dữ liệu trạm rác "${st.name}".`);
            } catch (err: any) {
              Alert.alert('Lỗi', 'Không thể reset trạm rác: ' + err.message);
            }
          },
        },
      ]
    );
  };

  // 5. Xử lý lưu Wi-Fi
  const handleSaveWifi = async () => {
    if (!wifiSsid.trim() || !wifiPassword.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ tên Wi-Fi và mật khẩu!');
      return;
    }

    try {
      const targetId = targetWifiLobbyId || lobbies[0]?.id;
      await configureWifi(targetId, wifiSsid.trim(), wifiPassword.trim());

      const targetSt = lobbies.find((l) => l.id === targetId);
      Alert.alert(
        'Thành công',
        `Đã lưu cấu hình Wi-Fi (${wifiSsid}) cho trạm rác "${targetSt?.name || 'IoT'}"!`
      );
      setWifiSsid('');
      setWifiPassword('');
      setDeviceModalVisible(false);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể gửi cấu hình Wi-Fi: ' + err.message);
    }
  };

  // 6. Gửi phản hồi
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

  // 7. Đăng xuất
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
          Quản lý trạm rác, ngưỡng cảnh báo & kết nối IoT
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

        {/* ===== QUẢN LÝ TRẠM RÁC ===== */}
        <Text style={styles.sectionHeader}>Quản lý trạm rác</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setStationListModalVisible(true)}
          >
            <View style={styles.rowAlign}>
              <View style={[styles.iconBox, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="list-outline" size={20} color="#1b5e20" />
              </View>
              <View>
                <Text style={styles.settingTitle}>Danh sách trạm rác</Text>
                <Text style={styles.settingSubtitle}>
                  Xem {lobbies.length} trạm rác, thêm trạm, Wi-Fi, reset & xóa trạm
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* ===== CÀI ĐẶT THÔNG BÁO POPUP (HIỆN RA NGOÀI MÀN HÌNH CÀI ĐẶT) ===== */}
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

      {/* ===== MODAL 1: DANH SÁCH TRẠM RÁC, XÓA & RESET ===== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={stationListModalVisible}
        onRequestClose={() => setStationListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Danh Sách Trạm Rác</Text>
                <Text style={styles.modalSubHeader}>
                  Hiện có {lobbies.length} trạm rác trong hệ thống
                </Text>
              </View>
              <TouchableOpacity onPress={() => setStationListModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {lobbies.map((st, idx) => {
                return (
                  <View key={st.id} style={styles.stationListItem}>
                    <View style={styles.stationListTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stationListName}>{st.name}</Text>
                        <Text style={styles.stationListLoc}>
                          <Ionicons name="location-outline" size={11} color="#777" /> {st.location} ({st.building})
                        </Text>
                      </View>
                    </View>

                    {/* Actions row: Reset, Wifi, Ngưỡng, Xóa */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.stationItemActionsScroll}
                      style={{ marginTop: 8 }}
                    >
                      <TouchableOpacity
                        style={styles.actionBtnReset}
                        onPress={() => handleResetStation(st)}
                      >
                        <Ionicons name="refresh-outline" size={13} color="#0288d1" />
                        <Text style={styles.actionBtnResetText}>Reset trạm</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnWifi}
                        onPress={() => {
                          setTargetWifiLobbyId(st.id);
                          setStationListModalVisible(false);
                          setDeviceModalVisible(true);
                        }}
                      >
                        <Ionicons name="wifi-outline" size={13} color="#1b5e20" />
                        <Text style={styles.actionBtnWifiText}>Wi-Fi</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnThreshold}
                        onPress={() => {
                          setThresholdInput(String(thresholdLimit));
                          setThresholdModalVisible(true);
                        }}
                      >
                        <Ionicons name="speedometer-outline" size={13} color="#e65100" />
                        <Text style={styles.actionBtnThresholdText}>Ngưỡng</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtnDelete}
                        onPress={() => handleDeleteStation(st)}
                      >
                        <Ionicons name="trash-outline" size={13} color="#d32f2f" />
                        <Text style={styles.actionBtnDeleteText}>Xóa trạm</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.primaryModalBtn}
              onPress={() => {
                setStationListModalVisible(false);
                setAddLobbyModalVisible(true);
              }}
            >
              <Ionicons name="add" size={18} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.primaryModalBtnText}>Thêm Trạm Rác Mới</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL 2: THÊM TRẠM RÁC (ĐÃ BỎ CHỮ SẢNH MỚI) ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addLobbyModalVisible}
        onRequestClose={() => setAddLobbyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm Trạm Rác</Text>
              <TouchableOpacity onPress={() => setAddLobbyModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Trạm rác sẽ được thêm vào hệ thống và theo dõi tự động cả 4 ngăn phân loại rác.
            </Text>

            <Text style={styles.inputLabel}>Tên trạm rác:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="VD: Trạm Rác Tòa D - Sakura"
              placeholderTextColor="#999"
              value={newLobbyName}
              onChangeText={setNewLobbyName}
            />

            <Text style={styles.inputLabel}>Tòa nhà / Phân khu:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="VD: Tòa D hoặc Khối Thương Mại"
              placeholderTextColor="#999"
              value={newLobbyBuilding}
              onChangeText={setNewLobbyBuilding}
            />

            <Text style={styles.inputLabel}>Vị trí cụ thể đặt trạm:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="VD: Tầng G - Cạnh thang máy số 2"
              placeholderTextColor="#999"
              value={newLobbyLocation}
              onChangeText={setNewLobbyLocation}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleCreateLobby}>
              <Text style={styles.saveButtonText}>Thêm Trạm Rác</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL 3: CẤU HÌNH WI-FI CHO TRẠM RÁC ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deviceModalVisible}
        onRequestClose={() => setDeviceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cấu Hình Wi-Fi Trạm Rác</Text>
              <TouchableOpacity onPress={() => setDeviceModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Đồng bộ kết nối mạng Internet cho trạm phần cứng IoT Raspberry Pi.
            </Text>

            <Text style={styles.inputLabel}>Chọn trạm rác áp dụng:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginVertical: 6 }}
            >
              {lobbies.map((st) => {
                const isSelected = st.id === targetWifiLobbyId;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.wifiSelectChip, isSelected && styles.wifiSelectChipActive]}
                    onPress={() => setTargetWifiLobbyId(st.id)}
                  >
                    <Text
                      style={[
                        styles.wifiSelectChipText,
                        isSelected && styles.wifiSelectChipTextActive,
                      ]}
                    >
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>Tên Wi-Fi (SSID):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Nhập tên mạng Wi-Fi trạm..."
              placeholderTextColor="#999"
              value={wifiSsid}
              onChangeText={setWifiSsid}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Mật khẩu:</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Nhập mật khẩu Wi-Fi..."
              placeholderTextColor="#999"
              secureTextEntry
              value={wifiPassword}
              onChangeText={setWifiPassword}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveWifi}>
              <Text style={styles.saveButtonText}>Lưu & Gửi Cấu Hình Wi-Fi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL 4: CẤU HÌNH NGƯỠNG CẢNH BÁO ĐẦY ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={thresholdModalVisible}
        onRequestClose={() => setThresholdModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cài Đặt Ngưỡng Cảnh Báo</Text>
              <TouchableOpacity onPress={() => setThresholdModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Mức mặc định là <Text style={{ fontWeight: 'bold', color: '#1b5e20' }}>80%</Text>. Khi ngăn rác đạt ngưỡng này, hệ thống sẽ tự động kích hoạt cảnh báo nhắc nhân viên đi thu gom.
            </Text>

            <View style={styles.thresholdContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.thresholdLabel}>Ngưỡng cảnh báo (%):</Text>
                <Text style={styles.thresholdHelper}>Khuyến nghị chuẩn: 80%</Text>
              </View>
              <TextInput
                style={styles.thresholdInput}
                keyboardType="numeric"
                value={thresholdInput}
                onChangeText={setThresholdInput}
                maxLength={3}
                textAlignVertical="center"
              />
            </View>

            {thresholdInput !== '80' && (
              <TouchableOpacity
                style={styles.resetDefaultBtn}
                onPress={handleResetDefaultThreshold}
              >
                <Ionicons name="refresh-outline" size={14} color="#1b5e20" style={{ marginRight: 4 }} />
                <Text style={styles.resetDefaultText}>Đặt lại về mức mặc định 80%</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings}>
              <Text style={styles.saveButtonText}>Lưu & Áp Dụng Ngưỡng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== MODAL 5: GÓP Ý ===== */}
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
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },

  // Station List in Modal
  stationListItem: {
    backgroundColor: '#fbfbfb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  stationListTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stationListName: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  stationListLoc: { fontSize: 11, color: '#666', marginTop: 2 },
  hardwareBadge: {
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hardwareText: { fontSize: 9, fontWeight: 'bold', color: '#0288d1' },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: 'bold' },
  miniProgressRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  miniProgLabel: { fontSize: 10, color: '#555', fontWeight: '500' },
  stationItemActionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
    paddingVertical: 2,
  },
  actionBtnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnResetText: { fontSize: 11, color: '#0288d1', fontWeight: 'bold' },
  actionBtnWifi: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnWifiText: { fontSize: 11, color: '#1b5e20', fontWeight: 'bold' },
  actionBtnThreshold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnThresholdText: { fontSize: 11, color: '#e65100', fontWeight: 'bold' },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  actionBtnDeleteText: { fontSize: 11, color: '#d32f2f', fontWeight: 'bold' },

  switchRowOutside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  modalFooterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  thresholdModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ffe0b2',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  thresholdModalBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e65100',
  },
  primaryModalBtnFlex: {
    flex: 1,
    backgroundColor: '#1b5e20',
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryModalBtn: {
    backgroundColor: '#1b5e20',
    flexDirection: 'row',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryModalBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

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
  modalSubHeader: { fontSize: 11, color: '#666', marginTop: 1 },
  modalSub: { fontSize: 11, color: '#666', marginBottom: 12, lineHeight: 16 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: '#333', marginBottom: 4, marginTop: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    backgroundColor: '#fafafa',
  },
  wifiSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  wifiSelectChipActive: {
    backgroundColor: '#1b5e20',
    borderColor: '#1b5e20',
  },
  wifiSelectChipText: { fontSize: 11, color: '#333' },
  wifiSelectChipTextActive: { color: '#fff', fontWeight: 'bold' },

  thresholdContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  thresholdLabel: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  thresholdHelper: { fontSize: 11, color: '#888', marginTop: 2 },
  thresholdInput: {
    borderWidth: 1.5,
    borderColor: '#1b5e20',
    backgroundColor: '#fff',
    width: 70,
    height: 44,
    borderRadius: 8,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 0,
    paddingHorizontal: 6,
    includeFontPadding: false,
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  resetDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginBottom: 8,
  },
  resetDefaultText: { fontSize: 12, fontWeight: 'bold', color: '#1b5e20' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  switchLabel: { fontSize: 12, color: '#444', flex: 1, marginRight: 8 },
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
