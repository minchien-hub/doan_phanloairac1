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
import { onValue, ref } from 'firebase/database';
import { db } from '../config/firebaseConfig';
import { Lobby, useSmartBin } from '../constants/ApartmentContext';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface HistoryRecord {
  id: string;
  lobbyId: string;
  lobbyName?: string;
  time: string;
  date: string;
  collector?: string;
  status?: string;
}

export default function MonitorScreen() {
  const params = useLocalSearchParams<{ lobbyId?: string }>();
  const {
    lobbies,
    selectedLobbyId,
    setSelectedLobbyId,
    selectedLobby,
    toggleDoor,
    thresholdLimit,
    updateLobbyThreshold,
    markLobbyCleaned,
  } = useSmartBin();

  const [activeLobbyId, setActiveLobbyId] = useState<string>(
    params.lobbyId || selectedLobbyId || 'lobby_a'
  );

  // Accordion toggle states (mặc định mở Camera và Điều khiển theo hình mẫu của người dùng)
  const [isCameraExpanded, setIsCameraExpanded] = useState<boolean>(true);
  const [isDoorExpanded, setIsDoorExpanded] = useState<boolean>(true);
  const [isSensorExpanded, setIsSensorExpanded] = useState<boolean>(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);

  // Lịch sử thu gom từ Firebase
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    if (params.lobbyId) {
      setActiveLobbyId(params.lobbyId);
      setSelectedLobbyId(params.lobbyId);
    }
  }, [params.lobbyId]);

  const currentLobby: Lobby =
    lobbies.find((l) => l.id === activeLobbyId) ||
    lobbies.find((l) => l.id === selectedLobbyId) ||
    selectedLobby ||
    lobbies[0];

  // Lấy lịch sử thu gom riêng của trạm này
  useEffect(() => {
    const historyRef = ref(db, 'smart_bin/history');
    const unsub = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const records: HistoryRecord[] = Object.keys(val).map((k) => ({
          id: k,
          ...val[k],
        }));
        const filtered = records.filter(
          (r) => r.lobbyId === currentLobby.id || r.lobbyName === currentLobby.name
        );
        setHistoryList(filtered.reverse());
      } else {
        setHistoryList([]);
      }
    });
    return () => unsub();
  }, [currentLobby.id]);

  const stThreshold = currentLobby.threshold !== undefined ? currentLobby.threshold : thresholdLimit;

  // Xử lý tăng / giảm ngưỡng đầy rác
  const handleDecreaseThreshold = async () => {
    const newVal = Math.max(stThreshold - 5, 10);
    try {
      await updateLobbyThreshold(currentLobby.id, newVal);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  const handleIncreaseThreshold = async () => {
    const newVal = Math.min(stThreshold + 5, 100);
    try {
      await updateLobbyThreshold(currentLobby.id, newVal);
    } catch (err: any) {
      Alert.alert('Lỗi', err.message);
    }
  };

  // Điều khiển servo cửa thả rác
  const handleToggleDoor = async (value: boolean) => {
    try {
      await toggleDoor(currentLobby.id, value);
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể gửi lệnh điều khiển servo: ' + err.message);
    }
  };

  // Ghi nhận đã thu gom rác
  const handleClean = () => {
    Alert.alert(
      'Xác nhận thu gom rác',
      `Bạn xác nhận đã thu gom và dọn sạch các ngăn rác tại "${currentLobby.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận xong',
          style: 'default',
          onPress: async () => {
            try {
              await markLobbyCleaned(currentLobby.id);
              Alert.alert('Thành công', 'Đã ghi nhận thu gom rác thành công.');
            } catch (err: any) {
              Alert.alert('Lỗi', err.message);
            }
          },
        },
      ]
    );
  };

  // Tính toán mức đầy cho 4 ngăn rác theo thứ tự hình mẫu: Nguy hại -> Vô cơ -> Hữu cơ -> Tái chế
  const hazardousPct = Math.round(Number(currentLobby.bins?.hazardous?.fill_percent) || 0);
  const nonRecyclePct = Math.round(Number(currentLobby.bins?.non_recycle?.fill_percent) || 0);
  const organicPct = Math.round(Number(currentLobby.bins?.organic?.fill_percent) || 0);
  const recyclePct = Math.round(Number(currentLobby.bins?.recycle?.fill_percent) || 0);

  const binOverviewItems = [
    {
      key: 'hazardous',
      name: 'Ngăn Nguy hại',
      icon: 'warning-outline' as IoniconsName,
      color: '#d32f2f',
      pct: hazardousPct,
    },
    {
      key: 'non_recycle',
      name: 'Ngăn Vô cơ',
      icon: 'trash-outline' as IoniconsName,
      color: '#555555',
      pct: nonRecyclePct,
    },
    {
      key: 'organic',
      name: 'Ngăn Hữu cơ',
      icon: 'leaf-outline' as IoniconsName,
      color: '#2e7d32',
      pct: organicPct,
    },
    {
      key: 'recycle',
      name: 'Ngăn Tái chế',
      icon: 'sync-outline' as IoniconsName,
      color: '#0288d1',
      pct: recyclePct,
    },
  ];

  // Tính số ngăn cần dọn và mức đầy cao nhất
  const fullBinsCount = binOverviewItems.filter((b) => b.pct >= stThreshold && b.pct > 0).length;
  const maxFillPct = Math.max(hazardousPct, nonRecyclePct, organicPct, recyclePct, 0);

  // Danh sách cảm biến khoảng cách theo thứ tự hình mẫu
  const sensorItems = [
    {
      key: 'hazardous',
      name: 'Ngăn Nguy hại',
      icon: 'warning-outline' as IoniconsName,
      color: '#d32f2f',
      data: currentLobby.bins?.hazardous,
    },
    {
      key: 'non_recycle',
      name: 'Ngăn Vô cơ',
      icon: 'trash-outline' as IoniconsName,
      color: '#555555',
      data: currentLobby.bins?.non_recycle,
    },
    {
      key: 'organic',
      name: 'Ngăn Hữu cơ',
      icon: 'leaf-outline' as IoniconsName,
      color: '#2e7d32',
      data: currentLobby.bins?.organic,
    },
    {
      key: 'recycle',
      name: 'Ngăn Tái chế',
      icon: 'sync-outline' as IoniconsName,
      color: '#0288d1',
      data: currentLobby.bins?.recycle,
    },
  ];

  // Giờ cập nhật mẫu hoặc thời gian hiện tại
  const timeUpdatedString = '14:06 10-11';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{currentLobby.name}</Text>
          <Text style={styles.headerSubtitle}>
            {currentLobby.building} · {currentLobby.location}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== THẺ CHÍNH: BẢNG ĐIỀU KHIỂN ===== */}
        <View style={styles.mainCard}>
          {/* Header trong thẻ */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.chipIconBox}>
                <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Bảng điều khiển</Text>
                <Text style={styles.cardSubtitle}>
                  {currentLobby.name} · {currentLobby.location}
                </Text>
              </View>
            </View>

            <View style={styles.syncStatusBadge}>
              <View style={styles.orangeDot} />
              <Text style={styles.syncStatusText}>DỮ LIỆU ĐÃ ĐỒNG BỘ</Text>
            </View>
          </View>

          {/* Dòng ghi chú thời gian cập nhật */}
          <View style={styles.updateTimeRow}>
            <Ionicons name="time-outline" size={13} color="#888" />
            <Text style={styles.updateTimeText}>Dữ liệu cập nhật lúc {timeUpdatedString}</Text>
          </View>

          {/* ===== NGƯỠNG ĐẦY RÁC ===== */}
          <View style={styles.thresholdBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.thresholdTitle}>Ngưỡng đầy rác</Text>
              <Text style={styles.thresholdSub}>Cảnh báo khi thùng đạt mức này</Text>
            </View>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={handleDecreaseThreshold}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color="#1b5e20" />
              </TouchableOpacity>
              <Text style={styles.stepperVal}>{stThreshold}%</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={handleIncreaseThreshold}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color="#1b5e20" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ===== TỔNG QUAN THÙNG RÁC ===== */}
          <View style={styles.overviewSection}>
            <View style={styles.overviewHeaderRow}>
              <View>
                <Text style={styles.overviewTitle}>Tổng quan thùng rác</Text>
                <Text style={styles.overviewSub}>Mức đầy hiện tại tại điểm tập kết</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: fullBinsCount > 0 ? '#ffebee' : '#e8f5e9' },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    { color: fullBinsCount > 0 ? '#d32f2f' : '#2e7d32' },
                  ]}
                >
                  {fullBinsCount > 0 ? 'Cần dọn' : 'Ổn định'}
                </Text>
              </View>
            </View>

            {/* Khối thống kê 2 số lớn */}
            <View style={styles.statsTwoCol}>
              <View style={styles.statsCol}>
                <Text
                  style={[
                    styles.statsBigNum,
                    { color: fullBinsCount > 0 ? '#d32f2f' : '#1b5e20' },
                  ]}
                >
                  {fullBinsCount}/4
                </Text>
                <Text style={styles.statsLabel}>Ngăn cần dọn</Text>
              </View>

              <View style={styles.statsDivider} />

              <View style={styles.statsCol}>
                <Text
                  style={[
                    styles.statsBigNum,
                    { color: maxFillPct >= stThreshold ? '#d32f2f' : '#222' },
                  ]}
                >
                  {maxFillPct}%
                </Text>
                <Text style={styles.statsLabel}>Mức đầy cao nhất</Text>
              </View>
            </View>

            {/* 4 dòng danh sách mức đầy rác */}
            <View style={styles.binRowsContainer}>
              {binOverviewItems.map((item, idx) => {
                const isFull = item.pct >= stThreshold && item.pct > 0;
                return (
                  <View key={item.key}>
                    <View style={styles.binRow}>
                      <View style={styles.binRowLeft}>
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={item.color}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.binRowName}>{item.name}</Text>
                      </View>
                      <Text
                        style={[
                          styles.binRowPct,
                          { color: isFull ? '#d32f2f' : item.color },
                        ]}
                      >
                        {item.pct}%
                      </Text>
                    </View>
                    {idx < binOverviewItems.length - 1 && <View style={styles.binRowDivider} />}
                  </View>
                );
              })}
            </View>

            {/* Lần thu gom gần nhất */}
            <Text style={styles.lastCleanLabel}>
              Thu gom gần nhất: {currentLobby.lastCleaned || 'Hôm nay, 13:00'}
            </Text>

            {/* Nút Ghi nhận đã thu gom */}
            <TouchableOpacity
              style={styles.cleanActionBtn}
              onPress={handleClean}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.cleanActionText}>Ghi nhận đã thu gom</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== ACCORDION 1: CAMERA AI PHÂN LOẠI RÁC ===== */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsCameraExpanded(!isCameraExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionIconBox}>
              <Ionicons name="videocam-outline" size={20} color="#1b5e20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accordionTitle}>Camera AI phân loại rác</Text>
              <Text style={styles.accordionSub}>Xem luồng camera tại điểm tập kết</Text>
            </View>
            <Ionicons
              name={isCameraExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#1b5e20"
            />
          </TouchableOpacity>

          {isCameraExpanded && (
            <View style={styles.cameraContent}>
              <View style={styles.cameraBox}>
                <View style={styles.cameraLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>TRỰC TIẾP</Text>
                </View>

                {currentLobby.camera_url ? (
                  <WebView
                    source={{ uri: currentLobby.camera_url }}
                    style={styles.webview}
                    scalesPageToFit={true}
                    scrollEnabled={false}
                    androidLayerType={'hardware'}
                  />
                ) : (
                  <View style={styles.noCameraView}>
                    <Ionicons name="cloud-offline-outline" size={42} color="#888" />
                    <Text style={styles.noCameraTitle}>Không thể kết nối camera</Text>
                    <Text style={styles.noCameraSub}>Kiểm tra mạng hoặc địa chỉ luồng camera.</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cameraFooterCaption}>Camera tại điểm tập kết</Text>
            </View>
          )}
        </View>

        {/* ===== ACCORDION 2: ĐIỀU KHIỂN CỬA THẢ RÁC ===== */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsDoorExpanded(!isDoorExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionIconBox}>
              <Ionicons name="lock-closed-outline" size={20} color="#1b5e20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accordionTitle}>Điều khiển cửa thả rác</Text>
              <Text style={styles.accordionSub}>
                {currentLobby.is_door_open ? 'Cửa hiện đang mở' : 'Cửa hiện đang đóng'}
              </Text>
            </View>
            <Ionicons
              name={isDoorExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#1b5e20"
            />
          </TouchableOpacity>

          {isDoorExpanded && (
            <View style={styles.doorContent}>
              <View style={styles.doorInnerCard}>
                <View
                  style={[
                    styles.doorIconCircle,
                    { backgroundColor: currentLobby.is_door_open ? '#e8f5e9' : '#e1f5fe' },
                  ]}
                >
                  <Ionicons
                    name={currentLobby.is_door_open ? 'lock-open-outline' : 'lock-closed-outline'}
                    size={22}
                    color={currentLobby.is_door_open ? '#1b5e20' : '#0288d1'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doorTitle}>Cửa trạm · {currentLobby.building}</Text>
                  <Text
                    style={[
                      styles.doorStatusText,
                      { color: currentLobby.is_door_open ? '#1b5e20' : '#f57c00' },
                    ]}
                  >
                    {currentLobby.is_door_open ? 'Đang mở' : 'Đang đóng'}
                  </Text>
                </View>
                <Switch
                  value={!!currentLobby.is_door_open}
                  onValueChange={handleToggleDoor}
                  trackColor={{ false: '#e0e0e0', true: '#81c784' }}
                  thumbColor={currentLobby.is_door_open ? '#1b5e20' : '#ffffff'}
                />
              </View>
            </View>
          )}
        </View>

        {/* ===== ACCORDION 3: CẢM BIẾN KHOẢNG CÁCH ===== */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setIsSensorExpanded(!isSensorExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.accordionIconBox}>
              <Ionicons name="speedometer-outline" size={20} color="#1b5e20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accordionTitle}>Cảm biến khoảng cách</Text>
              <Text style={styles.accordionSub}>4 cảm biến tại trạm</Text>
            </View>
            <Ionicons
              name={isSensorExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#1b5e20"
            />
          </TouchableOpacity>

          {isSensorExpanded && (
            <View style={styles.sensorContent}>
              <View style={styles.sensorSubHeaderRow}>
                <Text style={styles.sensorSubHeaderTitle}>Khoảng cách theo từng ngăn</Text>
                <Text style={styles.sensorThresholdText}>Ngưỡng {stThreshold}%</Text>
              </View>

              <View style={styles.sensorInnerCard}>
                {sensorItems.map((s, idx) => {
                  const dist = Math.round(Number(s.data?.distance_cm) || 0);
                  const isOk = s.data?.sensor_ok !== false;

                  return (
                    <View key={s.key}>
                      <View style={styles.sensorRow}>
                        <View style={[styles.sensorColorBar, { backgroundColor: s.color }]} />
                        <View style={styles.sensorRowLeft}>
                          <Ionicons
                            name={s.icon}
                            size={16}
                            color={s.color}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.sensorRowName}>{s.name}</Text>
                        </View>
                        {isOk ? (
                          <View style={styles.sensorOkBadge}>
                            <Text style={styles.sensorOkText}>
                              {dist > 0 ? `${dist} cm` : 'Cảm biến OK'}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.sensorErrBadge}>
                            <Text style={styles.sensorErrText}>Mất kết nối</Text>
                          </View>
                        )}
                      </View>
                      {idx < sensorItems.length - 1 && <View style={styles.binRowDivider} />}
                    </View>
                  );
                })}
              </View>

              <Text style={styles.realtimeNoticeText}>
                Thông tin thiết bị được đồng bộ theo thời gian thực
              </Text>
            </View>
          )}
        </View>

        {/* ===== PHẦN 4: LỊCH SỬ THU GOM ===== */}
        <View style={styles.historyCard}>
          <TouchableOpacity
            style={styles.historyHeader}
            onPress={() => setIsHistoryExpanded(!isHistoryExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.historyIconBox}>
              <Ionicons name="time-outline" size={20} color="#1b5e20" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>Lịch sử thu gom</Text>
              <Text style={styles.historySub}>Các lần thu gom tại địa điểm này</Text>
            </View>
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>{historyList.length}</Text>
            </View>
            <Ionicons
              name={isHistoryExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#1b5e20"
            />
          </TouchableOpacity>

          {isHistoryExpanded && (
            <View style={styles.historyContent}>
              {historyList.length === 0 ? (
                <Text style={styles.emptyHistoryText}>
                  Chưa có bản ghi thu gom nào tại điểm tập kết này.
                </Text>
              ) : (
                historyList.map((item, idx) => (
                  <View key={item.id} style={styles.historyItemRow}>
                    <View style={styles.historyDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyItemTime}>
                        {item.date} - {item.time}
                      </Text>
                      <Text style={styles.historyItemCollector}>
                        Nhân viên: {item.collector || 'Nhân viên thu gom'}
                      </Text>
                    </View>
                    <View style={styles.historyDoneTag}>
                      <Text style={styles.historyDoneText}>Hoàn thành</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  scrollContent: { padding: 14, paddingBottom: 30 },

  // Main Card
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chipIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1b5e20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1b5e20' },
  cardSubtitle: { fontSize: 11, color: '#666', marginTop: 2 },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  orangeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f57c00' },
  syncStatusText: { fontSize: 10, fontWeight: 'bold', color: '#e65100' },

  updateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    marginBottom: 14,
  },
  updateTimeText: { fontSize: 11, color: '#777' },

  // Threshold Box
  thresholdBox: {
    backgroundColor: '#f8faf8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e8f0e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  thresholdTitle: { fontSize: 14, fontWeight: 'bold', color: '#222' },
  thresholdSub: { fontSize: 11, color: '#777', marginTop: 2 },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperVal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1b5e20',
    minWidth: 42,
    textAlign: 'center',
  },

  // Overview Section
  overviewSection: {},
  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewTitle: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  overviewSub: { fontSize: 11, color: '#777', marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusPillText: { fontSize: 11, fontWeight: 'bold' },

  statsTwoCol: {
    flexDirection: 'row',
    backgroundColor: '#f8faf8',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eef2ee',
  },
  statsCol: { flex: 1, alignItems: 'center' },
  statsBigNum: { fontSize: 22, fontWeight: 'bold' },
  statsLabel: { fontSize: 11, color: '#666', marginTop: 3 },
  statsDivider: { width: 1, height: '70%', backgroundColor: '#e0e0e0', alignSelf: 'center' },

  binRowsContainer: {
    marginBottom: 8,
  },
  binRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  binRowLeft: { flexDirection: 'row', alignItems: 'center' },
  binRowName: { fontSize: 13, fontWeight: '600', color: '#333' },
  binRowPct: { fontSize: 13, fontWeight: 'bold' },
  binRowDivider: { height: 1, backgroundColor: '#f0f0f0' },

  lastCleanLabel: { fontSize: 11, color: '#777', marginVertical: 12 },
  cleanActionBtn: {
    backgroundColor: '#1b5e20',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    elevation: 2,
    shadowColor: '#1b5e20',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cleanActionText: { fontSize: 14, fontWeight: 'bold', color: '#fff' },

  // Accordion Cards
  accordionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8f0e8',
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  accordionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0f7f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  accordionTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b5e20' },
  accordionSub: { fontSize: 11, color: '#777', marginTop: 2 },

  // Camera Accordion
  cameraContent: { paddingHorizontal: 12, paddingBottom: 10 },
  cameraBox: {
    height: 190,
    backgroundColor: '#121214',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraLiveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211,47,47,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff5252', marginRight: 4 },
  liveText: { fontSize: 10, fontWeight: 'bold', color: '#ff5252' },
  webview: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
  noCameraView: { alignItems: 'center', padding: 20 },
  noCameraTitle: { fontSize: 13, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  noCameraSub: { fontSize: 11, color: '#aaa', marginTop: 4, textAlign: 'center' },
  cameraFooterCaption: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 8 },

  // Door Accordion
  doorContent: { paddingHorizontal: 12, paddingBottom: 12 },
  doorInnerCard: {
    backgroundColor: '#f8faf8',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8f0e8',
  },
  doorIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  doorTitle: { fontSize: 13, fontWeight: 'bold', color: '#222' },
  doorStatusText: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Sensor Accordion
  sensorContent: { paddingHorizontal: 12, paddingBottom: 12 },
  sensorSubHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sensorSubHeaderTitle: { fontSize: 13, fontWeight: 'bold', color: '#1b5e20' },
  sensorThresholdText: { fontSize: 11, fontWeight: 'bold', color: '#e65100' },
  sensorInnerCard: {
    backgroundColor: '#f8faf8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e8f0e8',
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  sensorColorBar: { width: 3.5, height: 16, borderRadius: 2, marginRight: 8 },
  sensorRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sensorRowName: { fontSize: 13, fontWeight: '600', color: '#333' },
  sensorOkBadge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sensorOkText: { fontSize: 11, fontWeight: '600', color: '#1b5e20' },
  sensorErrBadge: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sensorErrText: { fontSize: 11, fontWeight: '600', color: '#d32f2f' },
  realtimeNoticeText: { fontSize: 11, color: '#888', textAlign: 'center', marginTop: 12 },

  // History Card
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8f0e8',
    marginBottom: 14,
    overflow: 'hidden',
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  historyTitle: { fontSize: 14, fontWeight: 'bold', color: '#1b5e20' },
  historySub: { fontSize: 11, color: '#777', marginTop: 2 },
  historyBadge: {
    backgroundColor: '#f0f4f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 6,
  },
  historyBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#1b5e20' },
  historyContent: { padding: 12, paddingTop: 0 },
  emptyHistoryText: { fontSize: 11, color: '#888', textAlign: 'center', paddingVertical: 10 },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1b5e20', marginRight: 10 },
  historyItemTime: { fontSize: 12, fontWeight: '600', color: '#333' },
  historyItemCollector: { fontSize: 10, color: '#888', marginTop: 2 },
  historyDoneTag: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyDoneText: { fontSize: 10, fontWeight: 'bold', color: '#1b5e20' },
});