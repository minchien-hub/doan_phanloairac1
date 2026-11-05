import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
    markLobbyCleaned,
  } = useSmartBin();

  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const alertedStationsRef = useRef<Set<string>>(new Set());

  // Danh sách các tòa để lọc
  const buildings = useMemo(() => {
    const setB = new Set<string>();
    lobbies.forEach((s) => {
      if (s.building) setB.add(s.building);
    });
    return ['ALL', ...Array.from(setB)];
  }, [lobbies]);

  // Lọc theo tòa
  const filteredLobbies = useMemo(() => {
    if (selectedBuilding === 'ALL') return lobbies;
    return lobbies.filter((s) => s.building === selectedBuilding);
  }, [lobbies, selectedBuilding]);

  // Thống kê trạm đầy hoặc nguy cơ
  const fullLobbies = lobbies.filter((st) => {
    const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
    return st.bins && Object.values(st.bins).some((b) => b.fill_percent >= limit);
  });
  const atRiskLobbies = lobbies.filter((st) => {
    const limit = st.threshold !== undefined ? st.threshold : thresholdLimit;
    return st.bins && Object.values(st.bins).some((b) => b.fill_percent >= limit - 15);
  });

  // Hiển thị thông báo popup khi có trạm vượt ngưỡng (nếu cài đặt bật)
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
        `Phát hiện trạm rác đã đạt hoặc vượt ngưỡng cảnh báo:\n\n• ${names}\n\nVui lòng nhanh chóng điều phối nhân viên thu gom rác.`
      );
    }

    // Xóa khỏi danh sách đã cảnh báo nếu trạm đã được dọn sạch
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

    if (maxPct >= limit) {
      return { text: 'Cần thu gom', color: '#d32f2f', bg: '#ffebee', isFull: true };
    }
    if (maxPct >= limit - 15) {
      return { text: 'Sắp đầy', color: '#f57c00', bg: '#fff3e0', isFull: false };
    }
    return { text: 'Bình thường', color: '#2e7d32', bg: '#e8f5e9', isFull: false };
  };

  const handleCleanLobby = (st: Lobby) => {
    Alert.alert(
      'Xác nhận thu gom rác',
      `Bạn xác nhận đã thu gom và làm sạch các ngăn rác tại "${st.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận xong',
          style: 'default',
          onPress: () => markLobbyCleaned(st.id),
        },
      ]
    );
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
        {/* ===== STATS ROW ===== */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderTopColor: '#1b5e20' }]}>
            <Text style={styles.statNumber}>{lobbies.length}</Text>
            <Text style={styles.statLabel}>Tổng sảnh</Text>
          </View>
          <View
            style={[
              styles.statCard,
              { borderTopColor: atRiskLobbies.length > 0 ? '#f57c00' : '#1b5e20' },
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                { color: atRiskLobbies.length > 0 ? '#f57c00' : '#1b5e20' },
              ]}
            >
              {atRiskLobbies.length}
            </Text>
            <Text style={styles.statLabel}>Cần dọn rác</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#0288d1' }]}>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlinePillText}>Đồng bộ</Text>
            </View>
            <Text style={styles.statLabel}>Hệ thống IoT</Text>
          </View>
        </View>

        {/* ===== ALERT BANNER ===== */}
        {fullLobbies.length > 0 ? (
          <View style={[styles.alertBanner, styles.alertBannerWarn]}>
            <Ionicons name="warning" size={18} color="#d32f2f" />
            <Text style={[styles.alertBannerText, { color: '#d32f2f' }]}>
              Có {fullLobbies.length} sảnh đạt ngưỡng đầy ({thresholdLimit}%). Cần điều phối thu gom ngay!
            </Text>
          </View>
        ) : (
          <View style={[styles.alertBanner, styles.alertBannerOk]}>
            <Ionicons name="checkmark-circle" size={18} color="#2e7d32" />
            <Text style={[styles.alertBannerText, { color: '#2e7d32' }]}>
              Tất cả các trạm sảnh đều trong ngưỡng an toàn
            </Text>
          </View>
        )}

        {/* ===== BUILDING FILTER CHIPS ===== */}
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
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {b === 'ALL' ? 'Tất cả tòa' : b}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ===== LOBBY CARDS LIST ===== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Danh Sách Sảnh Rác</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Thời gian thực</Text>
          </View>
        </View>

        {filteredLobbies.map((st) => {
          const statusInfo = getLobbyOverallStatus(st);
          const organicData = st.bins?.organic || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
          const recycleData = st.bins?.recycle || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
          const nonRecycleData = st.bins?.non_recycle || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };
          const hazardousData = st.bins?.hazardous || { fill_percent: 0, distance_cm: 0, status: 'NORMAL' };

          const organicPct = Number(organicData.fill_percent) || 0;
          const recyclePct = Number(recycleData.fill_percent) || 0;
          const nonRecyclePct = Number(nonRecycleData.fill_percent) || 0;
          const hazardousPct = Number(hazardousData.fill_percent) || 0;
          const hasWaste = organicPct > 0 || recyclePct > 0 || nonRecyclePct > 0 || hazardousPct > 0;

          const binItems = [
            { name: 'Hữu cơ', color: '#2e7d32', data: organicData },
            { name: 'Tái chế', color: '#0288d1', data: recycleData },
            { name: 'Vô cơ', color: '#555555', data: nonRecycleData },
            { name: 'Nguy hại', color: '#d32f2f', data: hazardousData },
          ];

          return (
            <View key={st.id} style={[styles.lobbyCard, statusInfo.isFull && styles.lobbyCardAlert]}>
              {/* Card Header */}
              <View style={styles.lobbyHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.lobbyTitleRow}>
                    <Text style={styles.lobbyName}>{st.name}</Text>
                  </View>
                  <Text style={styles.lobbyLocation}>
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={statusInfo.isFull ? '#d32f2f' : '#888'}
                    />{' '}
                    {st.location} (
                    <Text
                      style={[
                        styles.buildingText,
                        statusInfo.isFull && styles.buildingTextRed,
                      ]}
                    >
                      {st.building}
                    </Text>
                    )
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

              {/* Lobby Footer Actions */}
              <View style={styles.lobbyFooter}>
                <Text style={styles.lastCleanText}>
                  <Ionicons name="time-outline" size={11} color="#888" /> Thu gom: {st.lastCleaned || 'Hôm nay'}
                </Text>

                <View style={styles.lobbyFooterButtons}>
                  <TouchableOpacity
                    style={hasWaste ? styles.cleanBtnNeed : styles.cleanBtnDone}
                    onPress={() => handleCleanLobby(st)}
                  >
                    <Ionicons
                      name={hasWaste ? 'trash-outline' : 'checkmark-done'}
                      size={14}
                      color={hasWaste ? '#ffffff' : '#1b5e20'}
                    />
                    <Text style={hasWaste ? styles.cleanBtnNeedText : styles.cleanBtnDoneText}>
                      {hasWaste ? 'Thu gom' : '✓ Đã dọn xong'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

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
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
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

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 3,
    elevation: 2,
  },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: '#1b5e20' },
  statLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 6,
    borderRadius: 12,
    gap: 4,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0288d1' },
  onlinePillText: { fontSize: 10, fontWeight: 'bold', color: '#0288d1' },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    gap: 8,
  },
  alertBannerOk: { backgroundColor: '#e8f5e9' },
  alertBannerWarn: { backgroundColor: '#ffebee' },
  alertBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Filter
  filterSection: { marginBottom: 12 },
  filterScroll: { gap: 8 },
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  filterChipText: { fontSize: 12, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },

  // Section Header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1b5e20' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4caf50' },
  liveText: { fontSize: 11, color: '#4caf50', fontWeight: 'bold' },

  // Lobby Cards
  lobbyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#1b5e20',
  },
  lobbyCardAlert: {
    borderLeftColor: '#d32f2f',
    backgroundColor: '#fffcfc',
  },
  lobbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lobbyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lobbyName: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  hardwareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e1f5fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  hardwareText: { fontSize: 9, fontWeight: 'bold', color: '#0288d1' },
  lobbyLocation: { fontSize: 11, color: '#777', marginTop: 3 },
  buildingText: { color: '#777' },
  buildingTextRed: { color: '#d32f2f', fontWeight: 'bold', fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },

  // Bins Grid
  binsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fbfbfb',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  binCol: { flex: 1 },
  binColHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  binColName: { fontSize: 10, color: '#666', fontWeight: '600' },
  binColPct: { fontSize: 10, fontWeight: 'bold' },
  miniBarBg: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 3 },

  // Footer
  lobbyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  lastCleanText: { fontSize: 10, color: '#888' },
  lobbyFooterButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cleanBtnNeed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    elevation: 2,
    shadowColor: '#1b5e20',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cleanBtnNeedText: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
  cleanBtnDone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  cleanBtnDoneText: { fontSize: 12, fontWeight: 'bold', color: '#1b5e20' },
});
