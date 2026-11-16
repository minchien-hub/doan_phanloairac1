import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lobby, useSmartBin } from '../../constants/ApartmentContext';

export default function HomeScreen() {
  const {
    lobbies,
    thresholdLimit,
    hasWarning,
    notifyEnabled,
    setSelectedLobbyId,
  } = useSmartBin();

  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOnlyNeedClean, setFilterOnlyNeedClean] = useState<boolean>(false);
  const alertedStationsRef = useRef<Set<string>>(new Set());

  // Danh sách các tòa/khu vực tự động trích xuất từ lobbies
  const buildings = useMemo(() => {
    const setB = new Set<string>();
    lobbies.forEach((s) => {
      if (s.building) setB.add(s.building);
    });
    return ['ALL', ...Array.from(setB)];
  }, [lobbies]);

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

  // Lọc và sắp xếp danh sách điểm tập kết (Hỗ trợ khi số lượng điểm nhiều)
  const filteredLobbies = useMemo(() => {
    let list = lobbies;

    // 1. Lọc theo trạng thái "Cần dọn rác" nếu người dùng bấm vào thẻ thống kê
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

    // 2. Lọc theo tòa / khu vực được chọn từ hàng Chip
    if (selectedBuilding !== 'ALL') {
      list = list.filter((s) => s.building === selectedBuilding);
    }

    // 3. Lọc theo từ khóa tìm kiếm (tên điểm, địa chỉ, tòa nhà)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          (s.building && s.building.toLowerCase().includes(q))
      );
    }

    // 4. Sắp xếp thông minh: Điểm có mức rác đầy nhất tự động nổi lên đầu
    return [...list].sort((a, b) => {
      const maxA = a.bins
        ? Math.max(...Object.values(a.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      const maxB = b.bins
        ? Math.max(...Object.values(b.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      return maxB - maxA;
    });
  }, [lobbies, selectedBuilding, searchQuery, filterOnlyNeedClean, thresholdLimit]);

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
        {/* ===== STATS ROW (2 CARDS BẤM ĐƯỢC ĐỂ LỌC NHANH) ===== */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[
              styles.statCard,
              !filterOnlyNeedClean && styles.statCardGreenBorder,
            ]}
            onPress={() => setFilterOnlyNeedClean(false)}
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

        {/* ===== THANH TÌM KIẾM NHANH (GIẢI QUYẾT KHI SỐ LƯỢNG ĐIỂM NHIỀU) ===== */}
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="#777" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm điểm tập kết, vị trí..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ===== HÀNG CHIP LỌC THEO TÒA / KHU VỰC ===== */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {buildings.map((b) => {
              const isActive = selectedBuilding === b;
              return (
                <TouchableOpacity
                  key={b}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setSelectedBuilding(b)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {b === 'ALL' ? 'Tất cả tòa' : b}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

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
            <Ionicons name="search-outline" size={40} color="#bbb" />
            <Text style={styles.emptyTitle}>Không tìm thấy điểm tập kết phù hợp</Text>
            <Text style={styles.emptySub}>
              Thử tìm kiếm với từ khóa khác hoặc đặt lại bộ lọc tòa nhà
            </Text>
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => {
                setSelectedBuilding('ALL');
                setSearchQuery('');
                setFilterOnlyNeedClean(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.resetFilterText}>Xem tất cả điểm tập kết</Text>
            </TouchableOpacity>
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
                    Thu gom: {st.lastCleaned || 'Hôm nay, 15:25'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

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

  // Search Section
  searchSection: {
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
    borderColor: '#e2e8e2',
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#333',
    paddingVertical: 0,
  },

  // Building Filter Chips
  filterSection: {
    marginBottom: 10,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#1b5e20',
    borderColor: '#1b5e20',
  },
  filterChipText: {
    fontSize: 12.5,
    color: '#444',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },

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
});
