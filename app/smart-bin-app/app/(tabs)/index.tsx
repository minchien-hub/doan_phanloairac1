import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { set, ref } from 'firebase/database';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { db } from '../../config/firebaseConfig';
import { Lobby, useSmartBin } from '../../constants/ApartmentContext';

export default function HomeScreen() {
  const {
    lobbies,
    thresholdLimit,
    setThresholdLimit,
    updateLobbyThreshold,
    hasWarning,
    notifyEnabled,
    setSelectedLobbyId,
    addLobby,
    deleteLobby,
    resetLobby,
    configureWifi,
  } = useSmartBin();

  const [filterOnlyNeedClean, setFilterOnlyNeedClean] = useState<boolean>(false);
  const alertedStationsRef = useRef<Set<string>>(new Set());

  // ===== MODAL QUẢN LÝ DANH SÁCH TRẠM RÁC =====
  const [stationListModalVisible, setStationListModalVisible] = useState(false);

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

  // Thống kê điểm tập kết đầy hoặc có nguy cơ
  const fullLobbies = lobbies.filter((st) => {
    if (!st.isHardwareSync) return false;
    const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
    return st.bins && Object.values(st.bins).some((b) => (b.fill_percent || 0) >= limit && (b.fill_percent || 0) > 0);
  });
  const atRiskLobbies = lobbies.filter((st) => {
    if (!st.isHardwareSync) return false;
    const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
    return st.bins && Object.values(st.bins).some((b) => (b.fill_percent || 0) >= limit - 15 && (b.fill_percent || 0) > 0);
  });

  // Lọc và sắp xếp danh sách điểm tập kết
  const filteredLobbies = useMemo(() => {
    let list = lobbies;

    // Lọc theo trạng thái "Cần dọn rác" nếu người dùng bấm vào thẻ thống kê
    if (filterOnlyNeedClean) {
      list = list.filter((st) => {
        const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
        return (
          st.bins &&
          Object.values(st.bins).some(
            (b) => (b.fill_percent || 0) >= limit - 15 && (b.fill_percent || 0) > 0
          )
        );
      });
    }

    // Sắp xếp: Điểm có mức rác đầy nhất tự động nổi lên đầu
    return [...list].sort((a, b) => {
      const maxA = a.bins
        ? Math.max(...Object.values(a.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      const maxB = b.bins
        ? Math.max(...Object.values(b.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      return maxB - maxA;
    });
  }, [lobbies, filterOnlyNeedClean, thresholdLimit]);

  // Hiển thị thông báo popup khi có điểm tập kết vượt ngưỡng (nếu cài đặt bật)
  useEffect(() => {
    if (!notifyEnabled) return;

    const unalertedFullLobbies = fullLobbies.filter(
      (st) => !alertedStationsRef.current.has(st.id)
    );

    if (unalertedFullLobbies.length > 0) {
      unalertedFullLobbies.forEach((st) => alertedStationsRef.current.add(st.id));
      const names = unalertedFullLobbies.map((s) => `${s.name} (${s.building})`).join('\n• ');
      Alert.alert(
        'Cảnh Báo Rác Đầy! ⚠️',
        `Phát hiện điểm tập kết đã đạt hoặc vượt ngưỡng cảnh báo:\n\n• ${names}\n\nVui lòng nhanh chóng điều phối nhân viên thu gom rác.`
      );
    }

    // Xóa khỏi danh sách đã cảnh báo nếu điểm tập kết đã được dọn sạch
    const currentFullIds = new Set(fullLobbies.map((s) => s.id));
    alertedStationsRef.current.forEach((id) => {
      if (!currentFullIds.has(id)) {
        alertedStationsRef.current.delete(id);
      }
    });
  }, [fullLobbies, notifyEnabled, thresholdLimit]);

  // Trạng thái tổng quan của trạm
  const getLobbyOverallStatus = (st: Lobby) => {
    if (!st.bins || Object.keys(st.bins).length === 0) {
      return { text: 'Bình thường', color: '#2e7d32', bg: '#e8f5e9', isFull: false };
    }
    const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
    const fills = Object.values(st.bins).map((b) => b.fill_percent || 0);
    const maxPct = Math.max(...fills, 0);

    if (maxPct >= limit && maxPct > 0) {
      return { text: 'Cần thu gom', color: '#d32f2f', bg: '#ffebee', isFull: true };
    }
    if (maxPct >= limit - 15 && maxPct > 0) {
      return { text: 'Sắp đầy', color: '#f57c00', bg: '#fff3e0', isFull: false };
    }
    return { text: 'Bình thường', color: '#2e7d32', bg: '#e8f5e9', isFull: false };
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER QUẢN LÝ THU GOM ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Ionicons name="trash" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Quản Lý Thu Gom Rác</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.notifBtn, hasWarning && styles.notifBtnWarn]}
            onPress={() => router.push('/(tabs)/notifications')}
          >
            <Ionicons
              name={hasWarning ? 'notifications' : 'notifications-outline'}
              size={20}
              color={hasWarning ? '#d32f2f' : '#fff'}
            />
            {hasWarning && <View style={styles.redDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== STATS ROW (BẤM VÀO ĐIỂM TẬP KẾT ĐỂ MỞ MODAL QUẢN LÝ TRẠM) ===== */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[
              styles.statCard,
              stationListModalVisible && styles.statCardGreenBorder,
            ]}
            onPress={() => setStationListModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.statNumberGreen}>{lobbies.length}</Text>
            <Text style={styles.statLabel}>Điểm tập kết</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              filterOnlyNeedClean && styles.statCardWarnBorder,
            ]}
            onPress={() => setFilterOnlyNeedClean((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.statNumber,
                atRiskLobbies.length > 0 && { color: '#f57c00' },
              ]}
            >
              {atRiskLobbies.length}
            </Text>
            <Text style={styles.statLabel}>
              {filterOnlyNeedClean ? 'Đang lọc cần dọn' : 'Cần dọn rác'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===== ALERT BANNER ===== */}
        {fullLobbies.length > 0 ? (
          <View style={[styles.alertBanner, styles.alertBannerWarn]}>
            <Ionicons name="warning" size={18} color="#d32f2f" />
            <Text style={[styles.alertBannerText, { color: '#d32f2f' }]}>
              Có {fullLobbies.length} điểm tập kết đạt ngưỡng đầy ({thresholdLimit}%). Cần điều phối thu gom ngay!
            </Text>
          </View>
        ) : (
          <View style={[styles.alertBanner, styles.alertBannerOk]}>
            <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
            <Text style={[styles.alertBannerText, { color: '#2e7d32' }]}>
              Tất cả điểm tập kết đang trong ngưỡng an toàn
            </Text>
          </View>
        )}

        {/* ===== SECTION HEADER ROW ===== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Các điểm tập kết</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Đang đồng bộ</Text>
          </View>
        </View>

        {/* ===== DANH SÁCH ĐIỂM TẬP KẾT HOẶC TRẠNG THÁI TRỐNG ===== */}
        {filteredLobbies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={40} color="#2e7d32" />
            <Text style={styles.emptyTitle}>Không có điểm tập kết cần dọn rác</Text>
            <Text style={styles.emptySub}>
              Tất cả các điểm tập kết đều đang ở mức an toàn.
            </Text>
            {filterOnlyNeedClean && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => setFilterOnlyNeedClean(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.resetFilterText}>Xem tất cả điểm tập kết</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredLobbies.map((st) => {
            const statusInfo = getLobbyOverallStatus(st);
            const organicData = st.bins?.organic || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
            const recycleData = st.bins?.recycle || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
            const nonRecycleData = st.bins?.non_recycle || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
            const hazardousData = st.bins?.hazardous || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };

            const binItems = [
              { name: 'Hữu cơ', color: '#2e7d32', data: organicData },
              { name: 'Tái chế', color: '#0288d1', data: recycleData },
              { name: 'Vô cơ', color: '#555555', data: nonRecycleData },
              { name: 'Nguy hại', color: '#d32f2f', data: hazardousData },
            ];

            return (
              <TouchableOpacity
                key={st.id}
                activeOpacity={0.8}
                style={[styles.lobbyCard, statusInfo.isFull && styles.lobbyCardAlert]}
                onPress={() => {
                  setSelectedLobbyId(st.id);
                  router.push({ pathname: '/monitor', params: { lobbyId: st.id } });
                }}
              >
                {/* Card Header */}
                <View style={styles.lobbyHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.lobbyName}>{st.name}</Text>
                    <Text style={styles.lobbyLocation}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={statusInfo.isFull ? '#d32f2f' : '#666'}
                      />{' '}
                      {st.location} ({st.building})
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                      {statusInfo.text}
                    </Text>
                  </View>
                </View>

                {/* 4 Mini Progress Bars */}
                <View style={styles.binsGrid}>
                  {binItems.map((comp) => {
                    const pct = Math.min(Math.max(comp.data.fill_percent || 0, 0), 100);
                    const stThreshold = st.threshold !== undefined ? st.threshold : thresholdLimit;
                    const isCompFull = pct >= stThreshold;
                    return (
                      <View key={comp.name} style={styles.binCol}>
                        <View style={styles.binColHeader}>
                          <Text style={styles.binColName}>{comp.name}</Text>
                          <Text
                            style={[
                              styles.binColPct,
                              { color: isCompFull ? '#d32f2f' : comp.color },
                            ]}
                          >
                            {pct}%
                          </Text>
                        </View>
                        <View style={styles.miniBarBg}>
                          <View
                            style={[
                              styles.miniBarFill,
                              {
                                width: `${pct}%`,
                                backgroundColor: isCompFull ? '#d32f2f' : comp.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Cảnh báo thiết bị ngoại tuyến (chỉ hiển thị nếu trạm OFFLINE) */}
                {st.status === 'OFFLINE' && (
                  <View style={styles.offlineNoticeBox}>
                    <Text style={styles.offlineNoticeText}>
                      Thiết bị ngoại tuyến · số liệu chưa được xác nhận
                    </Text>
                  </View>
                )}

                {/* Card Footer: Lần thu gom gần nhất */}
                <View style={styles.lobbyFooter}>
                  <Ionicons name="time-outline" size={13} color="#888" style={{ marginRight: 4 }} />
                  <Text style={styles.lastCleanText}>
                    Thu gom: {st.lastCleaned || 'Hôm nay, 13:00'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ===== MODAL 1: DANH SÁCH TRẠM RÁC, XÓA & RESET (KHI BẤM THẺ ĐIỂM TẬP KẾT) ===== */}
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
              {lobbies.map((st) => {
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
                          setTargetThresholdLobbyId(st.id);
                          setThresholdInput(String(st.threshold !== undefined ? st.threshold : thresholdLimit));
                          setStationListModalVisible(false);
                          setThresholdModalVisible(true);
                        }}
                      >
                        <Ionicons name="speedometer-outline" size={13} color="#e65100" />
                        <Text style={styles.actionBtnThresholdText}>
                          Ngưỡng ({st.threshold !== undefined ? st.threshold : thresholdLimit}%)
                        </Text>
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

      {/* ===== MODAL 2: THÊM TRẠM RÁC MỚI ===== */}
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
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notifBtnWarn: { backgroundColor: '#ffebee' },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#d32f2f',
  },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Stats (2 cards)
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8ece8',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statCardGreenBorder: {
    borderColor: '#a5d6a7',
    borderWidth: 1.5,
  },
  statCardWarnBorder: {
    borderColor: '#ffb74d',
    borderWidth: 1.5,
    backgroundColor: '#fffcf6',
  },
  statNumberGreen: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#1b5e20' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, fontWeight: '500' },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    gap: 8,
  },
  alertBannerOk: { backgroundColor: '#e8f5e9' },
  alertBannerWarn: { backgroundColor: '#ffebee' },
  alertBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1b5e20' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4caf50' },
  liveText: { fontSize: 12, color: '#2e7d32', fontWeight: '600' },

  // Collection Point Cards
  lobbyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#1b5e20',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  lobbyCardAlert: {
    borderLeftColor: '#d32f2f',
    backgroundColor: '#fffcfc',
  },
  lobbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  lobbyName: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  lobbyLocation: { fontSize: 11, color: '#666', marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },

  // Bins Grid
  binsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  binCol: { flex: 1 },
  binColHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  binColName: { fontSize: 10, color: '#666', fontWeight: '600' },
  binColPct: { fontSize: 10, fontWeight: 'bold' },
  miniBarBg: { height: 5, backgroundColor: '#e0e0e0', borderRadius: 2.5, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2.5 },

  // Offline Notice Box
  offlineNoticeBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 10,
    marginBottom: 2,
  },
  offlineNoticeText: {
    fontSize: 11,
    color: '#b78103',
    fontWeight: '500',
  },

  // Footer
  lobbyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  lastCleanText: { fontSize: 11, color: '#777' },

  // Empty State
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11.5,
    color: '#777',
    marginTop: 4,
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b5e20',
  },

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
