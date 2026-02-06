import React, { useRef, useCallback } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useSegments } from 'expo-router';
import { View, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { Chat } from '@/components/chat/Chat';

import { useAppState } from '@/lib/appState';

// Emit custom events for double-tap scroll-to-top
const DOUBLE_TAP_DELAY = 300; // ms

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  showBadge?: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View>
      <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
      {props.showBadge && (
        <View style={{
          position: 'absolute',
          top: -2,
          right: -4,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: theme.tabIconBadge,
          borderWidth: 2,
          borderColor: 'white', // Should ideally match background but white is safe for now or transparent
        }} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { highlightedIds, routine, profile } = useAppState();
  const segments = useSegments();

  // Track last tap timestamps for double-tap detection
  const lastTapRef = useRef<{ [key: string]: number }>({});

  const hasRoutineUpdates = React.useMemo(() => {
    // Check if any highlighted ID belongs to a routine item
    return routine.some(r => highlightedIds.includes(r.id));
  }, [highlightedIds, routine]);

  const hasProfileUpdates = React.useMemo(() => {
    // Check if any highlighted ID belongs to a profile field
    return profile.some(f => highlightedIds.includes(f.key));
  }, [highlightedIds, profile]);

  // Get current active tab from segments
  const getCurrentTab = useCallback((): string => {
    const leaf = segments[segments.length - 1] ?? 'index';
    return String(leaf);
  }, [segments]);

  // Handle tab press with double-tap detection
  const handleTabPress = useCallback((tabName: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[tabName] || 0;
    const currentTab = getCurrentTab();

    if (currentTab === tabName && now - lastTap < DOUBLE_TAP_DELAY) {
      // Double-tap on active tab - emit scroll-to-top event
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // Dispatch custom event for scroll-to-top
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scrollToTop', { detail: { tab: tabName } }));
      }
    }

    lastTapRef.current[tabName] = now;
  }, [getCurrentTab]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Present',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="home" color={color} />,
          }}
          listeners={{
            tabPress: () => {
              handleTabPress('index');
            },
          }}
        />
        <Tabs.Screen
          name="routine"
          options={{
            title: 'Routine',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="list" color={color} showBadge={hasRoutineUpdates} />,
          }}
          listeners={{
            tabPress: () => {
              handleTabPress('routine');
            },
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: 'Me',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="user" color={color} showBadge={hasProfileUpdates} />,
          }}
          listeners={{
            tabPress: () => {
              handleTabPress('me');
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="cog" color={color} />,
          }}
          listeners={{
            tabPress: () => {
              handleTabPress('settings');
            },
          }}
        />
      </Tabs>

      {/* Persistent input anchored above tab bar */}
      <Chat bottomOffset={64} />
    </View>
  );
}

