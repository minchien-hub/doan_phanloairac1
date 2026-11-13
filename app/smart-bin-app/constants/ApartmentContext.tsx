import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { get, onValue, push, ref, remove, set } from 'firebase/database';
import { auth, db } from '../config/firebaseConfig';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  position?: string;
  createdAt?: string;
}

export interface BinCompartment {
  fill_percent: number;
  distance_cm: number;
  status: 'NORMAL' | 'WARNING' | 'FULL';
  sensor_ok?: boolean;
}

export interface Lobby {
  id: string;
  name: string;
  building: string;
  location: string;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  isHardwareSync?: boolean;
  camera_url?: string;
  is_door_open?: boolean;
  lastCleaned?: string;
  wifi_ssid?: string;
  threshold?: number;
  bins: Record<string, BinCompartment>;
}

interface SmartBinContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  lobbies: Lobby[];
  selectedLobbyId: string;
  setSelectedLobbyId: (id: string) => void;
  selectedLobby: Lobby;
  thresholdLimit: number;
  setThresholdLimit: (val: number) => void;
  updateLobbyThreshold: (lobbyId: string, threshold: number) => Promise<void>;
  notifyEnabled: boolean;
  updateNotifyEnabled: (val: boolean) => Promise<void>;
  hasWarning: boolean;
  toggleDoor: (lobbyId: string, open: boolean) => Promise<void>;
  addLobby: (lobby: Omit<Lobby, 'id'>) => Promise<void>;
  deleteLobby: (lobbyId: string) => Promise<void>;
  resetLobby: (lobbyId: string) => Promise<void>;
  configureWifi: (lobbyId: string, ssid: string, pass: string) => Promise<void>;
  markLobbyCleaned: (lobbyId: string) => Promise<void>;
}

const DEFAULT_LOBBIES: Lobby[] = [
  {
    id: 'lobby_a',
    name: 'Sảnh tiếp đón',
    building: 'Nhà Văn hóa Thiếu nhi',
    location: 'Cổng chính - Khu vực tiếp đón',
    status: 'ONLINE',
    isHardwareSync: true,
    camera_url: '',
    is_door_open: false,
    lastCleaned: 'Hôm nay, 13:00',
    threshold: 80,
    bins: {
      organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
    },
  },
  {
    id: 'lobby_b',
    name: 'Điểm tập kết phía Đông',
    building: 'Công viên trung tâm',
    location: 'Cổng phía Đông - Gần khu vui chơi',
    status: 'OFFLINE',
    camera_url: '',
    is_door_open: false,
    lastCleaned: 'Hôm nay, 15:25',
    threshold: 80,
    bins: {
      organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
    },
  },
  {
    id: 'lobby_c',
    name: 'Điểm sinh hoạt cộng đồng',
    building: 'Nhà Văn hóa Thiếu nhi',
    location: 'Sân sinh hoạt ngoài trời',
    status: 'OFFLINE',
    camera_url: '',
    is_door_open: false,
    lastCleaned: 'Hôm nay, 15:25',
    threshold: 80,
    bins: {
      organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
    },
  },
];

const SmartBinContext = createContext<SmartBinContextType | undefined>(undefined);

export function SmartBinProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>(DEFAULT_LOBBIES);
  const [selectedLobbyId, setSelectedLobbyId] = useState<string>('lobby_a');
  const [thresholdLimit, setThresholdLimit] = useState<number>(80);
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(true);

  // 1. Lắng nghe trạng thái đăng nhập Firebase Auth và tải profile từ Database
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = ref(db, `users/${user.uid}`);
          const snapshot = await get(userDocRef);
          if (snapshot.exists()) {
            const data = snapshot.val() as UserProfile;
            setUserProfile(data);
          } else {
            // Nếu tài khoản chưa có profile, tạo mới
            const newProf: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              username: user.displayName || 'Nhân viên',
              position: 'Nhân viên thu gom',
              createdAt: new Date().toISOString(),
            };

            await set(userDocRef, newProf);
            setUserProfile(newProf);
          }
        } catch (e) {
          console.warn('Lỗi tải thông tin tài khoản:', e);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Lắng nghe cấu hình hệ thống từ Firebase
  useEffect(() => {
    const settingsRef = ref(db, 'smart_bin/settings');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.threshold !== undefined) setThresholdLimit(Number(data.threshold));
        if (data.notifyFullBin !== undefined) setNotifyEnabled(data.notifyFullBin);
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. Lắng nghe dữ liệu phần cứng thật (Raspberry Pi) từ smart_bin
  useEffect(() => {
    const binsRef = ref(db, 'smart_bin/bins');
    const cameraRef = ref(db, 'smart_bin/camera');
    const controlRef = ref(db, 'smart_bin/control');
    const statusRef = ref(db, 'smart_bin/status');

    const unsubBins = onValue(binsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Có dữ liệu từ cảm biến thực tế => Trạm phần cứng đang hoạt động ONLINE
        const hasSensors = !!(data && Object.keys(data).length > 0);
        setLobbies((prev) =>
          prev.map((lb) => {
            if (lb.isHardwareSync) {
              return {
                ...lb,
                status: hasSensors ? 'ONLINE' : lb.status,
                bins: {
                  organic: data.organic || lb.bins.organic,
                  recycle: data.recycle || lb.bins.recycle,
                  non_recycle: data.non_recycle || lb.bins.non_recycle,
                  hazardous: data.hazardous || lb.bins.hazardous,
                },
              };
            }
            return lb;
          })
        );
      }
    });

    const unsubCamera = onValue(cameraRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.stream_url) {
          setLobbies((prev) =>
            prev.map((lb) => {
              if (lb.isHardwareSync) {
                return {
                  ...lb,
                  camera_url: data.stream_url,
                };
              }
              return lb;
            })
          );
        }
      }
    });

    const unsubStatus = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const isOnline = val === 'ONLINE' || val === 'ON' || val === true;
        setLobbies((prev) =>
          prev.map((lb) =>
            lb.isHardwareSync ? { ...lb, status: isOnline ? 'ONLINE' : 'OFFLINE' } : lb
          )
        );
      }
    });

    const unsubControl = onValue(controlRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.command) {
          setLobbies((prev) =>
            prev.map((lb) =>
              lb.isHardwareSync ? { ...lb, is_door_open: data.command === 'OPEN' } : lb
            )
          );
        }
      }
    });

    return () => {
      unsubBins();
      unsubCamera();
      unsubStatus();
      unsubControl();
    };
  }, []);

  // 4. Lắng nghe danh sách trạm sảnh từ Firebase (node: smart_bin/lobbies/)
  useEffect(() => {
    const lobbiesRef = ref(db, 'smart_bin/lobbies');
    const unsubLobbies = onValue(lobbiesRef, async (snapshot) => {
      if (snapshot.exists()) {
        const firebaseLobbiesObj = snapshot.val();
        const firebaseList: Lobby[] = Object.keys(firebaseLobbiesObj).map((key) => {
          const item = firebaseLobbiesObj[key];
          return {
            id: key,
            ...item,
            status: item.status || 'OFFLINE',
          };
        });

        // Nếu Firebase đang lưu ONLINE từ dữ liệu mẫu cũ, cập nhật về OFFLINE vì hiện chưa cắm điện trạm nào
        firebaseList.forEach((lb) => {
          if (lb.status === 'ONLINE' && !lb.isHardwareSync) {
            const lbStatusRef = ref(db, `smart_bin/lobbies/${lb.id}/status`);
            set(lbStatusRef, 'OFFLINE');
            lb.status = 'OFFLINE';
          }
          // Nếu trạm không có phần cứng đồng bộ thật, đặt lại bins về 0% và đồng bộ Firebase để tránh dữ liệu ảo
          if (!lb.isHardwareSync) {
            const hasWaste = lb.bins && Object.values(lb.bins).some((b) => (b.fill_percent || 0) > 0);
            if (hasWaste) {
              const cleanBins = {
                organic: { fill_percent: 0, distance_cm: 0, status: 'NORMAL' as const, sensor_ok: true },
                recycle: { fill_percent: 0, distance_cm: 0, status: 'NORMAL' as const, sensor_ok: true },
                non_recycle: { fill_percent: 0, distance_cm: 0, status: 'NORMAL' as const, sensor_ok: true },
                hazardous: { fill_percent: 0, distance_cm: 0, status: 'NORMAL' as const, sensor_ok: true },
              };
              lb.bins = cleanBins;
              const lbBinsRef = ref(db, `smart_bin/lobbies/${lb.id}/bins`);
              set(lbBinsRef, cleanBins);
            }
          }
        });

        setLobbies((prev) => {
          return firebaseList.map((st) => {
            if (st.isHardwareSync) {
              const prevHw = prev.find((p) => p.isHardwareSync);
              const isHwOnline = (prevHw && prevHw.status === 'ONLINE') || st.status === 'ONLINE';
              return {
                ...st,
                status: isHwOnline ? 'ONLINE' : 'OFFLINE',
                camera_url: prevHw?.camera_url || st.camera_url,
                is_door_open:
                  prevHw?.is_door_open !== undefined ? prevHw.is_door_open : st.is_door_open,
              };
            }
            return {
              ...st,
              status: st.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            };
          });
        });
      } else {
        // Tự động khởi tạo danh sách trạm mẫu lên Firebase nếu chưa có
        const initialMap: Record<string, Lobby> = {};
        DEFAULT_LOBBIES.forEach((lb) => {
          initialMap[lb.id] = lb;
        });
        await set(lobbiesRef, initialMap);
        setLobbies(DEFAULT_LOBBIES);
      }
    });

    return () => unsubLobbies();
  }, []);

  const hasWarning = lobbies.some((lb) => {
    // Chỉ cảnh báo khi trạm có phần cứng thực tế (isHardwareSync) có rác đầy
    if (!lb.isHardwareSync) return false;
    const limit = lb.threshold !== undefined ? lb.threshold : thresholdLimit;
    return lb.bins && Object.values(lb.bins).some((b) => (b.fill_percent || 0) >= limit && (b.fill_percent || 0) > 0);
  });

  const alertedBinsRef = useRef<Set<string>>(new Set());

  // Tự động đẩy thông báo rác đầy lên Firebase khi có ngăn đạt/vượt ngưỡng để đến thu gom
  useEffect(() => {
    if (!notifyEnabled) return;

    const compNames: Record<string, string> = {
      organic: 'Hữu cơ',
      recycle: 'Tái chế',
      non_recycle: 'Vô cơ',
      hazardous: 'Nguy hại',
    };

    lobbies.forEach((lb) => {
      // Chỉ cảnh báo khi trạm có kết nối phần cứng thực tế (isHardwareSync)
      if (!lb.isHardwareSync) return;

      const limit = lb.threshold !== undefined ? lb.threshold : thresholdLimit;
      if (!lb.bins) return;

      Object.entries(lb.bins).forEach(([compKey, compData]) => {
        const pct = Math.min(Math.max(Number(compData.fill_percent) || 0, 0), 100);
        const alertKey = `${lb.id}_${compKey}`;

        // Cảnh báo khi cảm biến đo được mức rác thật vượt ngưỡng
        if (pct >= limit && pct > 0) {
          if (!alertedBinsRef.current.has(alertKey)) {
            alertedBinsRef.current.add(alertKey);
            const compName = compNames[compKey] || compKey;
            const timeNow = new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const dateNow = new Date().toISOString().split('T')[0];

            const notifRef = ref(db, 'smart_bin/notifications');
            push(notifRef, {
              lobbyId: lb.id,
              lobbyName: lb.name,
              building: lb.building,
              location: lb.location,
              title: `Cảnh báo rác đầy (${lb.name})`,
              desc: `Ngăn ${compName} đã đạt ${pct}% (vượt ngưỡng ${limit}%). Cần điều phối nhân viên đến thu gom!`,
              date: dateNow,
              time: timeNow,
              color: '#d32f2f',
              icon: 'warning-outline',
              type: 'FULL_ALERT',
              binKey: compKey,
              percent: pct,
              threshold: limit,
              timestamp: Date.now(),
            }).catch((err) => console.warn('Lỗi gửi thông báo đầy:', err));
          }
        } else {
          // Khi mức rác giảm xuống dưới ngưỡng (sau khi nhân viên đã thu gom), giải phóng để có thể cảnh báo tiếp
          alertedBinsRef.current.delete(alertKey);
        }
      });
    });
  }, [lobbies, notifyEnabled, thresholdLimit]);

  // Dọn dẹp các thông báo rác đầy giả lập từ dữ liệu mẫu cũ khi thiết bị chưa cắm điện
  useEffect(() => {
    const notifRef = ref(db, 'smart_bin/notifications');
    get(notifRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.keys(data).forEach((key) => {
            const item = data[key];
            if (
              item.title?.includes('Sảnh Khu Thương Mại') ||
              item.title?.includes('Sảnh Tòa C') ||
              item.title?.includes('Sảnh Tòa B')
            ) {
              remove(ref(db, `smart_bin/notifications/${key}`));
            }
          });
        }
      })
      .catch(() => {});
  }, []);

  const updateLobbyThreshold = async (lobbyId: string, threshold: number) => {
    setLobbies((prev) =>
      prev.map((l) => (l.id === lobbyId ? { ...l, threshold } : l))
    );

    const target = lobbies.find((l) => l.id === lobbyId);
    if (target?.isHardwareSync) {
      const settingsThresholdRef = ref(db, 'smart_bin/settings/threshold');
      await set(settingsThresholdRef, threshold);
      setThresholdLimit(threshold);
    }

    const lobbyThresholdRef = ref(db, `smart_bin/lobbies/${lobbyId}/threshold`);
    await set(lobbyThresholdRef, threshold);
  };

  const toggleDoor = async (lobbyId: string, open: boolean) => {
    const cmd = open ? 'OPEN' : 'CLOSE';
    const target = lobbies.find((l) => l.id === lobbyId);

    setLobbies((prev) =>
      prev.map((l) => (l.id === lobbyId ? { ...l, is_door_open: open } : l))
    );

    if (target?.isHardwareSync) {
      const controlRef = ref(db, 'smart_bin/control');
      await set(controlRef, { command: cmd, timestamp: Date.now() });
    }
    const lobbyRef = ref(db, `smart_bin/lobbies/${lobbyId}/is_door_open`);
    await set(lobbyRef, open);
  };

  const addLobby = async (newLobbyData: Omit<Lobby, 'id'>) => {
    const id = `lobby_${Date.now()}`;
    const newLobby: Lobby = { ...newLobbyData, id };

    setLobbies((prev) => [...prev, newLobby]);

    const lobbyRef = ref(db, `smart_bin/lobbies/${id}`);
    await set(lobbyRef, newLobby);
  };

  const deleteLobby = async (lobbyId: string) => {
    setLobbies((prev) => {
      const updated = prev.filter((l) => l.id !== lobbyId);
      if (selectedLobbyId === lobbyId && updated.length > 0) {
        setSelectedLobbyId(updated[0].id);
      }
      return updated;
    });

    try {
      const lobbyRef = ref(db, `smart_bin/lobbies/${lobbyId}`);
      await remove(lobbyRef);
    } catch (e) {
      console.warn('Lỗi xóa trạm trên Firebase:', e);
    }
  };

  const resetLobby = async (lobbyId: string) => {
    const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const resetBins: Record<string, BinCompartment> = {
      organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
      hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL', sensor_ok: true },
    };

    setLobbies((prev) =>
      prev.map((l) => {
        if (l.id === lobbyId) {
          return {
            ...l,
            is_door_open: false,
            status: 'ONLINE',
            lastCleaned: `Reset lúc ${timeNow}`,
            bins: resetBins,
          };
        }
        return l;
      })
    );

    const target = lobbies.find((l) => l.id === lobbyId);
    if (target?.isHardwareSync) {
      const controlRef = ref(db, 'smart_bin/control');
      await set(controlRef, { command: 'CLOSE', timestamp: Date.now() });
      const binsRef = ref(db, 'smart_bin/bins');
      await set(binsRef, resetBins);
    }

    const lobbyBinsRef = ref(db, `smart_bin/lobbies/${lobbyId}/bins`);
    await set(lobbyBinsRef, resetBins);
    const lobbyDoorRef = ref(db, `smart_bin/lobbies/${lobbyId}/is_door_open`);
    await set(lobbyDoorRef, false);
    const lobbyCleanRef = ref(db, `smart_bin/lobbies/${lobbyId}/lastCleaned`);
    await set(lobbyCleanRef, `Reset lúc ${timeNow}`);
  };

  const configureWifi = async (lobbyId: string, ssid: string, pass: string) => {
    setLobbies((prev) =>
      prev.map((l) => (l.id === lobbyId ? { ...l, wifi_ssid: ssid } : l))
    );

    const target = lobbies.find((l) => l.id === lobbyId);
    if (target?.isHardwareSync) {
      const wifiRef = ref(db, 'smart_bin/wifi');
      await set(wifiRef, { ssid, password: pass, timestamp: Date.now() });
    }

    const lobbyWifiRef = ref(db, `smart_bin/lobbies/${lobbyId}/wifi_ssid`);
    await set(lobbyWifiRef, ssid);
  };

  const markLobbyCleaned = async (lobbyId: string) => {
    const timeNow = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const cleanStr = `Hôm nay, ${timeNow}`;
    const cleanBins = {
      organic: { fill_percent: 0, distance_cm: 50, status: 'NORMAL' as const, sensor_ok: true },
      recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL' as const, sensor_ok: true },
      non_recycle: { fill_percent: 0, distance_cm: 50, status: 'NORMAL' as const, sensor_ok: true },
      hazardous: { fill_percent: 0, distance_cm: 50, status: 'NORMAL' as const, sensor_ok: true },
    };

    setLobbies((prev) =>
      prev.map((l) => {
        if (l.id === lobbyId) {
          return {
            ...l,
            lastCleaned: cleanStr,
            bins: cleanBins,
          };
        }
        return l;
      })
    );

    const target = lobbies.find((l) => l.id === lobbyId);

    // Đồng bộ lên Firebase smart_bin/lobbies/{lobbyId}
    const lobbyCleanRef = ref(db, `smart_bin/lobbies/${lobbyId}/lastCleaned`);
    await set(lobbyCleanRef, cleanStr);
    const lobbyBinsRef = ref(db, `smart_bin/lobbies/${lobbyId}/bins`);
    await set(lobbyBinsRef, cleanBins);

    if (target?.isHardwareSync) {
      const binsRef = ref(db, 'smart_bin/bins');
      await set(binsRef, cleanBins);
    }

    // Đồng bộ lịch sử thu gom (smart_bin/history)
    const historyRef = ref(db, 'smart_bin/history');
    await push(historyRef, {
      lobbyId,
      lobbyName: target?.name || lobbyId,
      building: target?.building || '',
      location: target?.location || '',
      date: new Date().toISOString().split('T')[0],
      time: timeNow,
      timestamp: Date.now(),
      collector: userProfile?.username || auth.currentUser?.email || 'Nhân viên thu gom',
      status: 'COMPLETED',
    });
  };

  const updateNotifyEnabled = async (val: boolean) => {
    setNotifyEnabled(val);
    try {
      const notifyRef = ref(db, 'smart_bin/settings/notifyFullBin');
      await set(notifyRef, val);
    } catch (e) {
      console.warn('Lỗi lưu cấu hình thông báo:', e);
    }
  };

  const selectedLobby =
    lobbies.find((l) => l.id === selectedLobbyId) || lobbies[0] || DEFAULT_LOBBIES[0];

  return (
    <SmartBinContext.Provider
      value={{
        currentUser,
        userProfile,
        lobbies,
        selectedLobbyId,
        setSelectedLobbyId,
        selectedLobby,
        thresholdLimit,
        setThresholdLimit,
        updateLobbyThreshold,
        notifyEnabled,
        updateNotifyEnabled,
        hasWarning,
        toggleDoor,
        addLobby,
        deleteLobby,
        resetLobby,
        configureWifi,
        markLobbyCleaned,
      }}
    >
      {children}
    </SmartBinContext.Provider>
  );
}

export function useSmartBin() {
  const context = useContext(SmartBinContext);
  if (!context) {
    throw new Error('useSmartBin must be used within a SmartBinProvider');
  }
  return context;
}
