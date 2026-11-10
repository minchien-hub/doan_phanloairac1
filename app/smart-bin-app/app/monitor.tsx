import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useSmartBin } from '../constants/ApartmentContext';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface BinMetaItem {
  name: string;
  color: string;
  icon: IoniconsName;
}

const BIN_META: Record<string, BinMetaItem> = {
  organic: { name: 'Ngăn Hữu cơ', color: '#2e7d32', icon: 'leaf-outline' },
  recycle: { name: 'Ngăn Tái chế', color: '#0288d1', icon: 'reload-outline' },
  non_recycle: { name: 'Ngăn Vô cơ', color: '#555555', icon: 'trash-outline' },
  hazardous: { name: 'Ngăn Nguy hại', color: '#d32f2f', icon: 'warning-outline' },
};

export default function MonitorScreen() {
  const params = useLocalSearchParams<{ lobbyId?: string }>();
  const {
    lobbies,
    selectedLobbyId,
    setSelectedLobbyId,
    selectedLobby,
    toggleDoor,
    thresholdLimit,
  } = useSmartBin();

  // Quản lý ID trạm sảnh đang được chọn hiển thị, mặc định ưu tiên param từ màn hình trước
  const [activeLobbyId, setActiveLobbyId] = useState<string>(
    params.lobbyId || selectedLobbyId || 'lobby_a'
  );

  // Cập nhật khi nhận param từ Dashboard
  useEffect(() => {
    if (params.lobbyId) {
      setActiveLobbyId(params.lobbyId);
      setSelectedLobbyId(params.lobbyId);
    }
  }, [params.lobbyId]);

  // Chuyển đổi sảnh nhanh khi bấm vào các chip sảnh
  const handleSelectLobby = (lobbyId: string) => {
    setActiveLobbyId(lobbyId);
    setSelectedLobbyId(lobbyId);
  };

  const currentLobby =
    lobbies.find((l) => l.id === activeLobbyId) ||
    lobbies.find((l) => l.id === selectedLobbyId) ||
    selectedLobby ||
    lobbies[0];

  const handleToggleDoor = async (value: boolean) => {
    try {
      await toggleDoor(currentLobby.id, value);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể gửi lệnh điều khiển servo: ' + err.message);
    }
  };

  const binEntries = Object.entries(currentLobby.bins || {}).map(([key, data]) => {
    const meta = BIN_META[key] || {
      name: key,
      color: '#4caf50',
      icon: 'trash-outline' as IoniconsName,
    };
    return {
      key,
      ...meta,
      ...data,
    };
  });

  const stThreshold = currentLobby.threshold !== undefined ? currentLobby.threshold : thresholdLimit;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Giám Sát Trạm IoT</Text>
            <Text style={styles.headerSubtitle}>{currentLobby.name}</Text>
          </View>
        </View>
        <View style={styles.headerIconBox}>
          <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== LOBBY SELECTOR CHIPS ===== */}
        <View style={styles.selectorSection}>
          <Text style={styles.sectionTitle}>Chọn trạm sảnh cần giám sát:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectorScroll}
          >
            {lobbies.map((st) => {
              const isSelected = st.id === currentLobby.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.lobbyChip, isSelected && styles.lobbyChipActive]}
                  onPress={() => handleSelectLobby(st.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="business-outline"
                    size={14}
                    color={isSelected ? '#fff' : '#1b5e20'}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.lobbyChipText, isSelected && styles.lobbyChipTextActive]}>
                    {st.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ===== LOBBY INFO SUMMARY CARD ===== */}
        <View style={styles.lobbyInfoCard}>
          <View style={styles.lobbyInfoLeft}>
            <Text style={styles.lobbyInfoName}>{currentLobby.name}</Text>
            <Text style={styles.lobbyInfoLoc}>
              <Ionicons name="location-outline" size={12} color="#666" /> {currentLobby.location} (
              {currentLobby.building})
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.thresholdBadge}>
              <Ionicons name="speedometer-outline" size={11} color="#e65100" />
              <Text style={styles.thresholdBadgeText}>
                Ngưỡng: {stThreshold}%
              </Text>
            </View>

            {currentLobby.status === 'ONLINE' ? (
              <View style={styles.lobbyStatusTagOn}>
                <View style={styles.dotOn} />
                <Text style={styles.lobbyStatusTextOn}>ON</Text>
              </View>
            ) : (
              <View style={styles.lobbyStatusTagOff}>
                <View style={styles.dotOff} />
                <Text style={styles.lobbyStatusTextOff}>OFF</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== CAMERA AI LIVE STREAM ===== */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Camera AI Phân Loại Rác</Text>
          <Text style={styles.subNote}>Luồng trực tiếp tại sảnh</Text>
        </View>

        <View style={styles.cameraCard}>
          <View style={styles.cameraHeader}>
            <View style={styles.cameraLiveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.cameraBox}>
            {currentLobby.camera_url ? (
              <WebView
                source={{ uri: currentLobby.camera_url }}
                style={styles.webview}
                scalesPageToFit={true}
                scrollEnabled={false}
                androidLayerType={'hardware'}
              />
            ) : (
              <View style={styles.loadingCam}>
                <Ionicons name="videocam-outline" size={38} color="#777" />
                <Text style={styles.loadingText}>
                  {currentLobby.isHardwareSync
                    ? 'Đang chờ Raspberry Pi đồng bộ stream URL...'
                    : 'Chưa cấu hình camera cho trạm này'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cameraSubText}>
            {currentLobby.camera_url
              ? `Đang phát luồng: ${currentLobby.camera_url}`
              : 'Trạng thái: Sẵn sàng kết nối qua giao thức RTSP/HTTP'}
          </Text>
        </View>

        {/* ===== SERVO DOOR CONTROL ===== */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Điều Khiển Servo Cửa Thả Rác</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.servoRow}>
            <View style={styles.servoLeft}>
              <View
                style={[
                  styles.servoIconBox,
                  { backgroundColor: currentLobby.is_door_open ? '#e8f5e9' : '#e3f2fd' },
                ]}
              >
                <Ionicons
                  name={currentLobby.is_door_open ? 'lock-open-outline' : 'lock-closed-outline'}
                  size={22}
                  color={currentLobby.is_door_open ? '#1b5e20' : '#0288d1'}
                />
              </View>
              <View>
                <Text style={styles.servoTitle}>Cửa Thả Rác Sảnh ({currentLobby.building})</Text>
                <View
                  style={[
                    styles.servoStatusBadge,
                    { backgroundColor: currentLobby.is_door_open ? '#e8f5e9' : '#fff3e0' },
                  ]}
                >
                  <View
                    style={[
                      styles.servoStatusDot,
                      { backgroundColor: currentLobby.is_door_open ? '#1b5e20' : '#f57c00' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.servoStatusText,
                      { color: currentLobby.is_door_open ? '#1b5e20' : '#f57c00' },
                    ]}
                  >
                    {currentLobby.is_door_open ? 'Cửa Đang Mở' : 'Cửa Đang Đóng'}
                  </Text>
                </View>
              </View>
            </View>

            <Switch
              value={!!currentLobby.is_door_open}
              onValueChange={handleToggleDoor}
              trackColor={{ false: '#ccc', true: '#81c784' }}
              thumbColor={currentLobby.is_door_open ? '#1b5e20' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ===== SENSOR DETAILS ===== */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Thông Số Khoảng Cách Phần Cứng</Text>
          <Text style={styles.subNote}>Cảm biến siêu âm HC-SR04</Text>
        </View>

        <View style={styles.card}>
          {binEntries.map((sensor, idx) => {
            const dist = Math.round(Number(sensor.distance_cm) || 0);

            return (
              <View
                key={sensor.key}
                style={[styles.sensorItem, idx < binEntries.length - 1 && styles.sensorDivider]}
              >
                <View style={[styles.sensorColorBar, { backgroundColor: sensor.color }]} />
                <View style={styles.sensorContent}>
                  <View style={styles.sensorTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={sensor.icon}
                        size={15}
                        color={sensor.color}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.sensorName}>{sensor.name}</Text>
                    </View>
                    <View
                      style={[
                        styles.sensorBadge,
                        { backgroundColor: sensor.sensor_ok !== false ? '#e8f5e9' : '#ffebee' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sensorBadgeText,
                          { color: sensor.sensor_ok !== false ? '#1b5e20' : '#d32f2f' },
                        ]}
                      >
                        {sensor.sensor_ok !== false ? 'Cảm biến OK' : 'Báo lỗi'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sensorMetricsRow}>
                    <View style={styles.sensorMetric}>
                      <Ionicons name="resize-outline" size={13} color="#666" />
                      <Text style={styles.sensorMetricText}>
                        Khoảng cách: {dist > 0 ? `${dist} cm` : '0 cm'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
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
  headerLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Selector
  selectorSection: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b5e20', marginBottom: 8 },
  subNote: { fontSize: 11, color: '#888' },
  selectorScroll: { gap: 8, paddingBottom: 4 },
  lobbyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  lobbyChipActive: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  lobbyChipText: { fontSize: 12, color: '#333', fontWeight: '500' },
  lobbyChipTextActive: { color: '#fff', fontWeight: 'bold' },

  // Info Card
  lobbyInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    elevation: 2,
  },
  lobbyInfoLeft: { flex: 1 },
  lobbyInfoName: { fontSize: 14, fontWeight: 'bold', color: '#1b5e20' },
  lobbyInfoLoc: { fontSize: 11, color: '#666', marginTop: 2 },
  thresholdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  thresholdBadgeText: { fontSize: 10, color: '#e65100', fontWeight: 'bold' },
  lobbyStatusTagOn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  dotOn: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2e7d32' },
  lobbyStatusTextOn: { fontSize: 10, fontWeight: 'bold', color: '#2e7d32' },
  lobbyStatusTagOff: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dotOff: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9e9e9e' },
  lobbyStatusTextOff: { fontSize: 10, fontWeight: 'bold', color: '#9e9e9e' },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },

  // Camera Card
  cameraCard: {
    backgroundColor: '#1e1e24',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    elevation: 3,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cameraLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d32f2f', marginRight: 5 },
  liveText: { color: '#d32f2f', fontSize: 10, fontWeight: 'bold' },
  cameraBox: {
    height: 190,
    backgroundColor: '#121214',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
  loadingCam: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { color: '#aaa', fontSize: 11, marginTop: 8, textAlign: 'center' },
  cameraSubText: { color: '#888', fontSize: 10, marginTop: 8, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },

  // Servo
  servoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  servoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servoTitle: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  servoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    gap: 4,
  },
  servoStatusDot: { width: 6, height: 6, borderRadius: 3 },
  servoStatusText: { fontSize: 10, fontWeight: 'bold' },

  // Sensor Items
  sensorItem: { flexDirection: 'row', paddingVertical: 10 },
  sensorDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  sensorColorBar: { width: 4, borderRadius: 2, marginRight: 10 },
  sensorContent: { flex: 1 },
  sensorTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sensorName: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  sensorBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sensorBadgeText: { fontSize: 10, fontWeight: 'bold' },
  sensorMetricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 6 },
  sensorMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sensorMetricText: { fontSize: 11, color: '#555' },
  miniBarBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 3 },
});

