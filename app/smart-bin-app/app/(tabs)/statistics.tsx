import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ComponentProps } from 'react';
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
import { useSmartBin } from '../../constants/ApartmentContext';

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

export default function StatisticsScreen() {
  const {
    lobbies,
    selectedLobbyId,
    setSelectedLobbyId,
    selectedLobby,
    toggleDoor,
    thresholdLimit,
  } = useSmartBin();

  const handleToggleDoor = async (value: boolean) => {
    try {
      await toggleDoor(selectedLobby.id, value);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể gửi lệnh điều khiển servo: ' + err.message);
    }
  };

  const binEntries = Object.entries(selectedLobby.bins || {}).map(([key, data]) => {
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Giám Sát Trạm IoT</Text>
            <Text style={styles.headerSubtitle}>{selectedLobby.name}</Text>
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
              const isSelected = st.id === selectedLobbyId;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[styles.lobbyChip, isSelected && styles.lobbyChipActive]}
                  onPress={() => setSelectedLobbyId(st.id)}
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
            <Text style={styles.lobbyInfoName}>{selectedLobby.name}</Text>
            <Text style={styles.lobbyInfoLoc}>
              <Ionicons name="location-outline" size={12} color="#666" /> {selectedLobby.location} (
              {selectedLobby.building})
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.thresholdBadge}>
              <Ionicons name="speedometer-outline" size={11} color="#e65100" />
              <Text style={styles.thresholdBadgeText}>
                Ngưỡng: {selectedLobby.threshold !== undefined ? selectedLobby.threshold : thresholdLimit}%
              </Text>
            </View>

            {selectedLobby.status === 'ONLINE' ? (
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
            {selectedLobby.camera_url ? (
              <WebView
                source={{ uri: selectedLobby.camera_url }}
                style={styles.webview}
                scalesPageToFit={true}
                scrollEnabled={false}
                androidLayerType={'hardware'}
              />
            ) : (
              <View style={styles.loadingCam}>
                <Ionicons name="videocam-outline" size={38} color="#777" />
                <Text style={styles.loadingText}>
                  {selectedLobby.isHardwareSync
                    ? 'Đang chờ Raspberry Pi đồng bộ stream URL...'
                    : 'Chưa cấu hình camera cho trạm này'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cameraSubText}>
            {selectedLobby.camera_url
              ? `Đang phát luồng: ${selectedLobby.camera_url}`
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
                  { backgroundColor: selectedLobby.is_door_open ? '#e8f5e9' : '#e3f2fd' },
                ]}
              >
                <Ionicons
                  name={selectedLobby.is_door_open ? 'lock-open-outline' : 'lock-closed-outline'}
                  size={22}
                  color={selectedLobby.is_door_open ? '#1b5e20' : '#0288d1'}
                />
              </View>
              <View>
                <Text style={styles.servoTitle}>Cửa Thả Rác Sảnh ({selectedLobby.building})</Text>
                <View
                  style={[
                    styles.servoStatusBadge,
                    { backgroundColor: selectedLobby.is_door_open ? '#e8f5e9' : '#fff3e0' },
                  ]}
                >
                  <View
                    style={[
                      styles.servoStatusDot,
                      { backgroundColor: selectedLobby.is_door_open ? '#1b5e20' : '#f57c00' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.servoStatusText,
                      { color: selectedLobby.is_door_open ? '#1b5e20' : '#f57c00' },
                    ]}
                  >
                    {selectedLobby.is_door_open ? 'Cửa Đang Mở' : 'Cửa Đang Đóng'}
                  </Text>
                </View>
              </View>
            </View>

            <Switch
              value={!!selectedLobby.is_door_open}
              onValueChange={handleToggleDoor}
              trackColor={{ false: '#ccc', true: '#81c784' }}
              thumbColor={selectedLobby.is_door_open ? '#1b5e20' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* ===== SENSOR DETAILS ===== */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Thông Số Khoảng Cách Phần Cứng</Text>
        </View>

        <View style={styles.card}>
          {binEntries.map((sensor, idx) => {
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
                        Khoảng cách: {Math.round(Number(sensor.distance_cm) || 0)} cm
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 20 }} />
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  headerLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  chipRealBadge: {
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  chipRealText: { fontSize: 9, color: '#0288d1', fontWeight: 'bold' },

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
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  thresholdBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#e65100',
  },
  lobbyStatusTagOn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  dotOn: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2e7d32' },
  lobbyStatusTextOn: { fontSize: 11, fontWeight: 'bold', color: '#2e7d32' },

  lobbyStatusTagOff: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eeeeee',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  dotOff: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#757575' },
  lobbyStatusTextOff: { fontSize: 11, fontWeight: 'bold', color: '#757575' },

  // Section Row
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    marginTop: 4,
  },

  // Camera Card
  cameraCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    overflow: 'hidden',
    padding: 12,
    marginBottom: 14,
    elevation: 3,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cameraLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211,47,47,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d32f2f' },
  liveText: { fontSize: 10, fontWeight: 'bold', color: '#ef5350' },
  cameraLabel: { fontSize: 11, color: '#aaa' },
  cameraBox: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0d0d1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingCam: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  loadingText: { fontSize: 11, color: '#888', textAlign: 'center' },
  cameraSubText: { fontSize: 10, color: '#888', textAlign: 'center', marginTop: 8 },

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
  servoLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  servoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  servoTitle: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  servoStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  servoStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  servoStatusText: { fontSize: 10, fontWeight: 'bold' },

  // Sensor Rows
  sensorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sensorDivider: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  sensorColorBar: { width: 4, height: 36, borderRadius: 2, marginRight: 10 },
  sensorContent: { flex: 1 },
  sensorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sensorName: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  sensorBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  sensorBadgeText: { fontSize: 10, fontWeight: 'bold' },
  sensorMetricsRow: { flexDirection: 'row', gap: 12 },
  sensorMetric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sensorMetricText: { fontSize: 11, color: '#666' },
});
