import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import Firebase Realtime Database
import { onValue, ref } from 'firebase/database';
import { db } from '../../config/firebaseConfig';

// Cấu hình tiếng Việt cho lịch
LocaleConfig.locales['vi'] = {
  monthNames: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
  monthNamesShort: ['Th.1', 'Th.2', 'Th.3', 'Th.4', 'Th.5', 'Th.6', 'Th.7', 'Th.8', 'Th.9', 'Th.10', 'Th.11', 'Th.12'],
  dayNames: ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
  dayNamesShort: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  today: 'Hôm nay',
};
LocaleConfig.defaultLocale = 'vi';

export default function NotificationsScreen() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'WARN' | 'CLEAN'>('ALL');

  // State lưu trữ danh sách thông báo lấy từ Firebase
  const [notifications, setNotifications] = useState<any[]>([]);

  // Lắng nghe dữ liệu thông báo từ Firebase theo thời gian thực
  useEffect(() => {
    const notifRef = ref(db, 'smart_bin/notifications');

    const unsubscribe = onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const notifList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        // Đẩy thông báo mới nhất lên đầu danh sách
        notifList.reverse();

        setNotifications(notifList);
      } else {
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const formatDateVN = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Lọc thông báo theo ngày và theo loại
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchDate = !item.date || item.date === selectedDate;
      if (!matchDate) return false;

      if (filterType === 'WARN') {
        return item.color === '#d32f2f' || item.title?.includes('Cảnh báo') || item.title?.includes('đầy');
      }
      if (filterType === 'CLEAN') {
        return (
          item.color === '#2e7d32' ||
          item.color === '#1b5e20' ||
          item.title?.includes('thu gom') ||
          item.title?.includes('dọn')
        );
      }
      return true;
    });
  }, [notifications, selectedDate, filterType]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lịch Sử & Thông Báo</Text>
          <Text style={styles.headerSubtitle}>
            Đồng bộ thời gian thực từ Firebase ({notifications.length} bản ghi)
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{filteredNotifications.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ===== DATE PICKER ===== */}
        <View style={styles.datePickerRow}>
          <TouchableOpacity
            style={styles.datePickerBox}
            onPress={() => setCalendarVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.datePickerLeft}>
              <View style={styles.dateIconBox}>
                <Ionicons name="calendar" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.datePickerLabel}>Ngày theo dõi</Text>
                <Text style={styles.datePickerValue}>{formatDateVN(selectedDate)}</Text>
              </View>
            </View>
            <View style={styles.dateChevron}>
              <Ionicons name="chevron-down" size={16} color="#1b5e20" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ===== TYPE FILTER CHIPS ===== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipScroll}
        >
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'WARN', label: 'Cảnh báo đầy' },
            { key: 'CLEAN', label: 'Lịch sử thu gom' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                filterType === f.key && styles.filterChipActive,
              ]}
              onPress={() => setFilterType(f.key as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterType === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ===== NOTIFICATIONS LIST ===== */}
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((item) => {
            const cardColor = item.color || '#1b5e20';
            return (
              <View key={item.id} style={[styles.notificationCard, { borderLeftColor: cardColor }]}>
                <View style={[styles.iconBox, { backgroundColor: cardColor + '15' }]}>
                  <Ionicons name={item.icon || 'notifications-outline'} size={20} color={cardColor} />
                </View>
                <View style={styles.contentColumn}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.notifTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={10} color="#888" style={{ marginRight: 3 }} />
                      <Text style={styles.notifTime}>{item.time || 'Vừa xong'}</Text>
                    </View>
                  </View>
                  <Text style={styles.notifDesc}>{item.desc}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={38} color="#aaa" />
            </View>
            <Text style={styles.emptyTitle}>Không có thông báo nào</Text>
            <Text style={styles.emptyText}>
              Các trạm sảnh trong ngày {selectedDate} đều hoạt động ổn định.
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ===== POPUP CALENDAR ===== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngày xem thông báo</Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <Calendar
              onDayPress={(day: { dateString: string }) => {
                setSelectedDate(day.dateString);
                setCalendarVisible(false);
              }}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: '#1b5e20' },
              }}
              theme={{
                backgroundColor: '#ffffff',
                calendarBackground: '#ffffff',
                selectedDayBackgroundColor: '#1b5e20',
                selectedDayTextColor: '#ffffff',
                todayTextColor: '#1b5e20',
                dayTextColor: '#2d4150',
                arrowColor: '#1b5e20',
                monthTextColor: '#1b5e20',
                textMonthFontWeight: 'bold',
                textDayFontSize: 13,
                textMonthFontSize: 15,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendarStyle}
            />
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
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 11, color: '#c8e6c9', marginTop: 2 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  scrollContent: { padding: 16, paddingBottom: 24 },

  // Date Picker
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  datePickerBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    elevation: 2,
  },
  datePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1b5e20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerLabel: { fontSize: 10, color: '#888' },
  datePickerValue: { fontSize: 13, fontWeight: 'bold', color: '#1b5e20', marginTop: 2 },
  dateChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filter Chips
  filterChipScroll: { gap: 8, paddingBottom: 12 },
  filterChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterChipActive: { backgroundColor: '#1b5e20', borderColor: '#1b5e20' },
  filterChipText: { fontSize: 11, color: '#555', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: 'bold' },

  // Notification Cards
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  contentColumn: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifTitle: { fontSize: 13, fontWeight: 'bold', color: '#222', flex: 1, marginRight: 6 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  notifTime: { fontSize: 10, color: '#888' },
  notifDesc: { fontSize: 11, color: '#666', lineHeight: 16 },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  emptyText: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4, maxWidth: 240 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 16,
    padding: 18,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#1b5e20' },
  calendarStyle: { borderRadius: 12 },
});
