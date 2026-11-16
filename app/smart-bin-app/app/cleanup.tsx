import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
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

  // Lọc chỉ lấy các trạm có ngăn rác vượt ngưỡng hoặc sắp đầy cần dọn dẹp
  const needCleanLobbies = useMemo(() => {
    const list = lobbies.filter((st) => {
      // Nếu trạm phần cứng mất kết nối hoàn toàn và không có dữ liệu thực, không coi là cần dọn
      if (st.status === 'OFFLINE' && st.isHardwareSync) return false;

      const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
      if (!st.bins || Object.keys(st.bins).length === 0) return false;

      return Object.values(st.bins).some(
        (b) => (b.fill_percent || 0) >= limit - 15 && (b.fill_percent || 0) > 0
      );
    });

    // Sắp xếp điểm có mức rác đầy nhất lên đầu
    return list.sort((a, b) => {
      const maxA = a.bins
        ? Math.max(...Object.values(a.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      const maxB = b.bins
        ? Math.max(...Object.values(b.bins).map((x) => x.fill_percent || 0), 0)
        : 0;
      return maxB - maxA;
    });
  }, [lobbies, thresholdLimit]);

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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Trạm Cần Thu Gom</Text>
          <Text style={styles.headerSubtitle}>
            {needCleanLobbies.length > 0
              ? `Có ${needCleanLobbies.length} điểm tập kết cần dọn rác`
              : 'Tất cả điểm tập kết đều an toàn'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== CHỈ HIỂN THỊ DANH SÁCH TRẠM CẦN DỌN ===== */}
        {needCleanLobbies.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={56} color="#2e7d32" />
            <Text style={styles.emptyTitle}>Không có trạm rác nào cần dọn</Text>
            <Text style={styles.emptySub}>
              Tất cả các điểm tập kết đều đang trong ngưỡng an toàn.
            </Text>
          </View>
        ) : (
          needCleanLobbies.map((st) => {
            const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
            const organic = st.bins?.organic?.fill_percent || 0;
            const recycle = st.bins?.recycle?.fill_percent || 0;
            const nonRecycle = st.bins?.non_recycle?.fill_percent || 0;
            const hazardous = st.bins?.hazardous?.fill_percent || 0;

            const maxFill = Math.max(organic, recycle, nonRecycle, hazardous);
            const isCritical = maxFill >= limit;

            const binItems = [
              { name: 'Hữu cơ', color: '#2e7d32', percent: organic },
              { name: 'Tái chế', color: '#0288d1', percent: recycle },
              { name: 'Vô cơ', color: '#555555', percent: nonRecycle },
              { name: 'Nguy hại', color: '#d32f2f', percent: hazardous },
            ];

            return (
              <View key={st.id} style={styles.stationCard}>
                {/* Header thẻ trạm */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenMonitor(st)}
                  style={styles.cardHeaderRow}
                >
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
                      {isCritical ? `Rác đầy (${maxFill}%)` : `Cần dọn (${maxFill}%)`}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 4 Mini Progress Bars */}
                <View style={styles.binsGrid}>
                  {binItems.map((comp) => {
                    const isCompFull = comp.percent >= limit;
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
                            {comp.percent}%
                          </Text>
                        </View>
                        <View style={styles.miniBarBg}>
                          <View
                            style={[
                              styles.miniBarFill,
                              {
                                width: `${Math.min(comp.percent, 100)}%`,
                                backgroundColor: isCompFull ? '#d32f2f' : comp.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Footer thẻ trạm: Lần thu gom gần nhất & các nút thao tác */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.lastCleanedBox}>
                    <Ionicons name="time-outline" size={13} color="#777" />
                    <Text style={styles.lastCleanedText}>
                      Thu gom: {st.lastCleaned || 'Hôm nay'}
                    </Text>
                  </View>

                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnMonitor}
                      onPress={() => handleOpenMonitor(st)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="speedometer-outline" size={14} color="#1b5e20" />
                      <Text style={styles.actionBtnMonitorText}>Xem trạm</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnClean}
                      onPress={() => handleMarkCleaned(st)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                      <Text style={styles.actionBtnCleanText}>Đã thu gom</Text>
                    </TouchableOpacity>
                  </View>
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
    gap: 12,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    lineHeight: 18,
  },
  stationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8edf2',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  cardStationName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },
  cardStationLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  binsGrid: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  binCol: {
    flex: 1,
  },
  binColHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  binColName: {
    fontSize: 11,
    color: '#555',
    fontWeight: '500',
  },
  binColPct: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  miniBarBg: {
    height: 5,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  lastCleanedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  lastCleanedText: {
    fontSize: 11,
    color: '#777',
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnMonitor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  actionBtnMonitorText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1b5e20',
  },
  actionBtnClean: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1b5e20',
    borderRadius: 8,
  },
  actionBtnCleanText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
});
