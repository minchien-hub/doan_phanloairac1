import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lobby, useSmartBin } from '../constants/ApartmentContext';

export default function CleanupScreen() {
  const {
    lobbies,
    thresholdLimit,
    setSelectedLobbyId,
    markLobbyCleaned,
  } = useSmartBin();

  const [selectedBuilding, setSelectedBuilding] = useState<string>('Tất cả');

  // Lọc các trạm có ít nhất 1 ngăn rác đạt hoặc vượt ngưỡng cần dọn (>= limit - 15)
  const needCleanLobbies = useMemo(() => {
    return lobbies.filter((st) => {
      // Nếu trạm mất kết nối hoàn toàn và không có dữ liệu thực, không coi là cần dọn
      if (st.status === 'OFFLINE' && st.isHardwareSync) return false;

      const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
      if (!st.bins || Object.keys(st.bins).length === 0) return false;

      return Object.values(st.bins).some(
        (b) => (b.fill_percent || 0) >= limit - 15 && (b.fill_percent || 0) > 0
      );
    });
  }, [lobbies, thresholdLimit]);

  // Danh sách tòa nhà để lọc
  const buildings = useMemo(() => {
    const set = new Set<string>();
    needCleanLobbies.forEach((st) => {
      if (st.building) set.add(st.building);
    });
    return ['Tất cả', ...Array.from(set)];
  }, [needCleanLobbies]);

  // Danh sách hiển thị sau khi lọc theo tòa
  const displayedLobbies = useMemo(() => {
    let list = needCleanLobbies;
    if (selectedBuilding !== 'Tất cả') {
      list = list.filter((st) => st.building === selectedBuilding);
    }

    // Sắp xếp điểm có mức rác đầy nhất lên đầu
    return [...list].sort((a, b) => {
      const maxA = a.bins
        ? Math.max(...Object.values(a.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      const maxB = b.bins
        ? Math.max(...Object.values(b.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      return maxB - maxA;
    });
  }, [needCleanLobbies, selectedBuilding]);

  // Tổng số ngăn rác đang bị đầy
  const totalFullBinsCount = useMemo(() => {
    let count = 0;
    needCleanLobbies.forEach((st) => {
      const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
      if (st.bins) {
        Object.values(st.bins).forEach((b) => {
          if ((b.fill_percent || 0) >= limit) count++;
        });
      }
    });
    return count;
  }, [needCleanLobbies, thresholdLimit]);

  // Mở bảng điều khiển chi tiết của trạm
  const handleOpenMonitor = (st: Lobby) => {
    setSelectedLobbyId(st.id);
    router.push({ pathname: '/monitor', params: { lobbyId: st.id } });
  };

  // Xác nhận và ghi nhận thu gom rác tại trạm
  const handleMarkCleaned = (st: Lobby) => {
    Alert.alert(
      'Xác nhận đã thu gom',
      `Bạn có chắc chắn đã hoàn tất thu gom rác tại "${st.name}"?\n\nDữ liệu các ngăn rác sẽ được đặt lại về 0% và lưu vào lịch sử thu gom.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Xác nhận thu gom',
          style: 'default',
          onPress: async () => {
            try {
              await markLobbyCleaned(st.id);
              Alert.alert('Thành công', `Đã ghi nhận thu gom rác tại "${st.name}"!`);
            } catch (err: any) {
              Alert.alert('Lỗi', 'Không thể ghi nhận thu gom: ' + err.message);
            }
          },
        },
      ]
    );
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
            <Text style={styles.headerTitle}>Trạm Cần Thu Gom</Text>
            <Text style={styles.headerSubtitle}>
              {needCleanLobbies.length > 0
                ? `Có ${needCleanLobbies.length} điểm tập kết cần dọn rác`
                : 'Tất cả điểm tập kết đều an toàn'}
            </Text>
          </View>
        </View>

        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{needCleanLobbies.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== THỐNG KÊ TỔNG QUAN ===== */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewBox}>
            <Text style={styles.overviewNumberRed}>{needCleanLobbies.length}</Text>
            <Text style={styles.overviewLabel}>Điểm cần dọn</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewBox}>
            <Text style={[styles.overviewNumberRed, { color: '#e65100' }]}>
              {totalFullBinsCount}
            </Text>
            <Text style={styles.overviewLabel}>Ngăn vượt ngưỡng</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewBox}>
            <Text style={styles.overviewNumberGreen}>{thresholdLimit}%</Text>
            <Text style={styles.overviewLabel}>Ngưỡng báo động</Text>
          </View>
        </View>

        {/* ===== BỘ LỌC TÒA NHÀ (NẾU CÓ NHIỀU TÒA) ===== */}
        {buildings.length > 2 && (
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {buildings.map((b) => {
                const isActive = selectedBuilding === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setSelectedBuilding(b)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ===== DANH SÁCH HOẶC TRẠNG THÁI TRỐNG ===== */}
        {displayedLobbies.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="checkmark-done" size={48} color="#2e7d32" />
            </View>
            <Text style={styles.emptyTitle}>Tất cả điểm tập kết đều sạch sẽ!</Text>
            <Text style={styles.emptyDesc}>
              Hiện không có trạm rác nào vượt ngưỡng hoặc cần thu gom. Hệ thống cảm biến đang theo dõi tự động liên tục.
            </Text>

            <TouchableOpacity
              style={styles.emptyBackBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.emptyBackBtnText}>Quay về trang chính</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emptyStationsBtn}
              onPress={() => router.push('/stations')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyStationsBtnText}>Xem danh sách tất cả trạm rác</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayedLobbies.map((st) => {
            const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
            const organic = st.bins?.organic?.fill_percent || 0;
            const recycle = st.bins?.recycle?.fill_percent || 0;
            const nonRecycle = st.bins?.non_recycle?.fill_percent || 0;
            const hazardous = st.bins?.hazardous?.fill_percent || 0;

            const maxFill = Math.max(organic, recycle, nonRecycle, hazardous);
            const isCritical = maxFill >= limit;

            const binItems = [
              { name: 'Nguy hại', color: '#d32f2f', percent: hazardous },
              { name: 'Vô cơ', color: '#555555', percent: nonRecycle },
              { name: 'Hữu cơ', color: '#2e7d32', percent: organic },
              { name: 'Tái chế', color: '#0288d1', percent: recycle },
            ];

            return (
              <View key={st.id} style={styles.stationCard}>
                {/* Header thẻ trạm */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.cardStationName}>{st.name}</Text>
                    <Text style={styles.cardStationLocation}>
                      <Ionicons name="location-outline" size={13} color="#666" />{' '}
                      {st.location} ({st.building})
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.urgencyBadge,
                      {
                        backgroundColor: isCritical ? '#ffebee' : '#fff3e0',
                      },
                    ]}
                  >
                    <Ionicons
                      name={isCritical ? 'warning' : 'alert-circle-outline'}
                      size={14}
                      color={isCritical ? '#d32f2f' : '#e65100'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.urgencyText,
                        { color: isCritical ? '#d32f2f' : '#e65100' },
                      ]}
                    >
                      {isCritical ? `Rác đầy (${maxFill}%)` : `Sắp đầy (${maxFill}%)`}
                    </Text>
                  </View>
                </View>

                {/* Chi tiết từng ngăn rác với thanh tiến trình */}
                <View style={styles.binsSection}>
                  {binItems.map((bin) => {
                    const isBinFull = bin.percent >= limit;
                    const isBinAtRisk = bin.percent >= limit - 15 && bin.percent > 0;
                    const barColor = isBinFull ? '#d32f2f' : isBinAtRisk ? '#e65100' : bin.color;

                    return (
                      <View key={bin.name} style={styles.binRow}>
                        <View style={styles.binRowHeader}>
                          <Text style={styles.binName}>{bin.name}</Text>
                          <Text
                            style={[
                              styles.binPercent,
                              isBinFull && { color: '#d32f2f', fontWeight: 'bold' },
                              !isBinFull && isBinAtRisk && { color: '#e65100' },
                            ]}
                          >
                            {bin.percent}% {isBinFull ? '(ĐẦY)' : ''}
                          </Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min(bin.percent, 100)}%`,
                                backgroundColor: barColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Thông tin thu gom gần nhất */}
                <View style={styles.lastCleanedRow}>
                  <Ionicons name="time-outline" size={13} color="#777" />
                  <Text style={styles.lastCleanedText}>
                    Thu gom gần nhất: {st.lastCleaned || 'Hôm nay'}
                  </Text>
                </View>

                {/* Các nút hành động: Xem bảng điều khiển & Ghi nhận đã thu gom */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnMonitor}
                    onPress={() => handleOpenMonitor(st)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="speedometer-outline" size={16} color="#1b5e20" />
                    <Text style={styles.actionBtnMonitorText}>Bảng điều khiển</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnClean}
                    onPress={() => handleMarkCleaned(st)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.actionBtnCleanText}>Ghi nhận đã dọn</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  header: {
    backgroundColor: '#1b5e20',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#c8e6c9',
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  overviewRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e8edf2',
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  overviewBox: {
    alignItems: 'center',
    flex: 1,
  },
  overviewDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e0e0e0',
  },
  overviewNumberRed: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  overviewNumberGreen: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  overviewLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e8edf2',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1b5e20',
  },
  filterChipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8edf2',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1b5e20',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    justifyContent: 'center',
  },
  emptyBackBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyStationsBtn: {
    paddingVertical: 10,
  },
  emptyStationsBtnText: {
    color: '#1b5e20',
    fontSize: 13,
    fontWeight: '600',
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8edf2',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cardStationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  cardStationLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  binsSection: {
    paddingVertical: 12,
    gap: 8,
  },
  binRow: {
    marginBottom: 2,
  },
  binRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  binName: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },
  binPercent: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  lastCleanedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    marginBottom: 12,
  },
  lastCleanedText: {
    fontSize: 11,
    color: '#777',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnMonitor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
  },
  actionBtnMonitorText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  actionBtnClean: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#1b5e20',
    borderRadius: 10,
  },
  actionBtnCleanText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#fff',
  },
});
