import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Platform, View } from 'react-native';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconsName;
  color: any;
  focused: boolean;
}

function TabIcon({ name, color, focused }: TabIconProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={22} color={color} />
      {focused && (
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#1b5e20',
            marginTop: 3,
          }}
        />
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1b5e20',
        tabBarInactiveTintColor: '#9e9e9e',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          height: Platform.OS === 'ios' ? 85 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* Tab 1: Bảng điều khiển thu gom */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bảng Điều Khiển',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'business' : 'business-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* Tab 2: Giám sát IoT (Đã gộp vào Bảng Điều Khiển khi bấm vào từng thẻ trạm) */}
      <Tabs.Screen
        name="statistics"
        options={{
          href: null,
        }}
      />

      {/* Tab 3: Thông báo điều phối & cảnh báo */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Thông Báo',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'notifications' : 'notifications-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* Tab 4: Cài đặt hệ thống */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Cài Đặt',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} color={color} focused={focused} />
          ),
        }}
      />

      {/* Ẩn file resident nếu còn tồn tại */}
      <Tabs.Screen
        name="resident"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
