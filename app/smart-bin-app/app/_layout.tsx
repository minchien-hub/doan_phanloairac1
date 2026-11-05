import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { SmartBinProvider } from '../constants/ApartmentContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Đặt màn hình login làm điểm khởi đầu khi mở app
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SmartBinProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Màn hình Đăng nhập hiển thị đầu tiên */}
          <Stack.Screen name="login" options={{ headerShown: false }} />
          
          {/* Nhóm các tab chức năng chính sau khi đăng nhập */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          
          {/* Modal hệ thống nếu có */}
          <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </SmartBinProvider>
    </ThemeProvider>
  );
}
