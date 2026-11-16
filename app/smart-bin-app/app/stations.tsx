import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ref, set } from 'firebase/database';
import { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../config/firebaseConfig';
import { Lobby, useSmartBin } from '../constants/ApartmentContext';

export default function StationsScreen() {
  const {
    lobbies,
    thresholdLimit,
    setThresholdLimit,
    updateLobbyThreshold,
    setSelectedLobbyId,
    addLobby,
    deleteLobby,
    resetLobby,
    configureWifi,
  } = useSmartBin();

  // ===== MODAL THÊM TRẠM RÁC MỚI =====
  const [addLobbyModalVisible, setAddLobbyModalVisible] = useState(false);
  const [newLobbyName, setNewLobbyName] = useState('');
  const [newLobbyBuilding, setNewLobbyBuilding] = useState('Tòa A');
  const [newLobbyLocation, setNewLobbyLocation] = useState('');

  // ===== MODAL CẤU HÌNH WI-FI CHO TRẠM =====
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [targetWifiLobbyId, setTargetWifiLobbyId] = useState<string>(lobbies[0]?.id || '');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  // ===== MODAL CÀI ĐẶT NGƯỠNG CẢNH BÁO CHO TRẠM =====
  const [thresholdModalVisible, setThresholdModalVisible] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(thresholdLimit));
  const [targetThresholdLobbyId, setTargetThresholdLobbyId] = useState<string>('');
  const targetThresholdLobby = lobbies.find((l) => l.id === targetThresholdLobbyId) || lobbies[0];

  // ===== CÁC HÀM XỬ LÝ TRẠM RÁC =====
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

  const executeSaveThreshold = async (parsed: number) => {
    try {
      if (targetThresholdLobbyId) {
        await updateLobbyThreshold(targetThresholdLobbyId, parsed);
        const targetSt = lobbies.find((l) => l.id === targetThresholdLobbyId);
        setThresholdModalVisible(false);
        Alert.alert('Thành công', `Đã cập nhật ngưỡng cảnh báo của "${targetSt?.name || 'trạm'}" thành ${parsed}%!`);
      } else {
        const settingsRef = ref(db, 'smart_bin/settings/threshold');
        await set(settingsRef, parsed);
        setThresholdLimit(parsed);
        setThresholdModalVisible(false);
        Alert.alert('Thành công', `Đã cập nhật ngưỡng cảnh báo rác đầy thành ${parsed}%!`);
      }
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

  const handleOpenMonitor = (st: Lobby) => {
    setSelectedLobbyId(st.id);
    router.push({ pathname: '/monitor', params: { lobbyId: st.id } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Danh Sách Trạm Rác</Text>
            <Text style={styles.headerSubtitle}>
              Hiện có {lobbies.length} trạm rác trong hệ thống
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => setAddLobbyModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== DANH SÁCH CÁC TRẠM RÁC ===== */}
        {lobbies.map((st) => {
          const currentLimit = st.threshold !== undefined ? st.threshold : thresholdLimit;
          const isOffline = st.status === 'OFFLINE';

          return (
            <View key={st.id} style={styles.stationCard}>
              {/* Thông tin trạm rác */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenMonitor(st)}
                style={styles.stationCardHeader}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.stationName}>{st.name}</Text>
                  <Text style={styles.stationLocation}>
                    <Ionicons name="location-outline" size={12} color="#666" /> {st.location} ({st.building})
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: isOffline ? '#ffebee' : '#e8f5e9' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isOffline ? '#d32f2f' : '#2e7d32' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isOffline ? '#d32f2f' : '#2e7d32' },
                    ]}
                  >
                    {isOffline ? 'Ngoại tuyến' : 'Trực tuyến'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Hàng nút thao tác nhanh: Reset, Wi-Fi, Ngưỡng, Xóa, Giám sát */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionsScroll}
                style={{ marginTop: 10 }}
              >
                <TouchableOpacity
                  style={styles.actionBtnReset}
                  onPress={() => handleResetStation(st)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={13} color="#0288d1" />
                  <Text style={styles.actionBtnResetText}>Reset trạm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnWifi}
                  onPress={() => {
                    setTargetWifiLobbyId(st.id);
                    setDeviceModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="wifi-outline" size={13} color="#1b5e20" />
                  <Text style={styles.actionBtnWifiText}>Wi-Fi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnThreshold}
                  onPress={() => {
                    setTargetThresholdLobbyId(st.id);
                    setThresholdInput(String(currentLimit));
                    setThresholdModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="speedometer-outline" size={13} color="#e65100" />
                  <Text style={styles.actionBtnThresholdText}>
                    Ngưỡng ({currentLimit}%)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnMonitor}
                  onPress={() => handleOpenMonitor(st)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="hardware-chip-outline" size={13} color="#7b1fa2" />
                  <Text style={styles.actionBtnMonitorText}>Giám sát</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnDelete}
                  onPress={() => handleDeleteStation(st)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={13} color="#d32f2f" />
                  <Text style={styles.actionBtnDeleteText}>Xóa trạm</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          );
        })}

        {/* Nút thêm trạm rác mới */}
        <TouchableOpacity
          style={styles.primaryAddBtn}
          onPress={() => setAddLobbyModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.primaryAddBtnText}>Thêm Trạm Rác Mới</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ===== MODAL 1: THÊM TRẠM RÁC MỚI ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={addLobbyModalVisible}
        onRequestClose={() => setAddLobbyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm Trạm Rác Mới</Text>
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

      {/* ===== MODAL 2: CẤU HÌNH WI-FI CHO TRẠM RÁC ===== */}
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
              Đồng bộ kết nối mạng Internet cho trạm phần cứng IoT.
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

      {/* ===== MODAL 3: CÀI ĐẶT NGƯỠNG CẢNH BÁO CHO TRẠM ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={thresholdModalVisible}
        onRequestClose={() => setThresholdModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Cài Đặt Ngưỡng Cảnh Báo</Text>
                {targetThresholdLobby && (
                  <Text style={styles.modalSubHeader}>
                    {targetThresholdLobby.name} ({targetThresholdLobby.building})
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setThresholdModalVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Cài đặt ngưỡng cảnh báo độc lập cho trạm{' '}
              <Text style={{ fontWeight: 'bold', color: '#1b5e20' }}>
                {targetThresholdLobby?.name || 'này'}
              </Text>. Khi bất kỳ ngăn rác nào tại trạm đạt ngưỡng này, hệ thống sẽ tự động kích hoạt cảnh báo nhắc nhân viên đi thu gom.
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    backgroundColor: '#1b5e20',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  addHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Station Card
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8ece8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  stationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stationName: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  stationLocation: { fontSize: 11.5, color: '#666', marginTop: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: 'bold' },

  // Actions Scroll
  actionsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 6,
    paddingVertical: 2,
  },
  actionBtnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 3,
  },
  actionBtnResetText: { fontSize: 11, color: '#0288d1', fontWeight: 'bold' },
  actionBtnWifi: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 3,
  },
  actionBtnWifiText: { fontSize: 11, color: '#1b5e20', fontWeight: 'bold' },
  actionBtnThreshold: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 3,
  },
  actionBtnThresholdText: { fontSize: 11, color: '#e65100', fontWeight: 'bold' },
  actionBtnMonitor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 3,
  },
  actionBtnMonitorText: { fontSize: 11, color: '#7b1fa2', fontWeight: 'bold' },
  actionBtnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 3,
  },
  actionBtnDeleteText: { fontSize: 11, color: '#d32f2f', fontWeight: 'bold' },

  // Primary Add Button
  primaryAddBtn: {
    backgroundColor: '#1b5e20',
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
  },
  primaryAddBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Modals Overlay & Content
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
