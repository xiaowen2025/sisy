import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { Chat } from '@/components/chat/Chat';

import { useAppState } from '@/lib/appState';

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

  const hasRoutineUpdates = React.useMemo(() => {
    // Check if any highlighted ID belongs to a routine item
    return routine.some(r => highlightedIds.includes(r.id));
  }, [highlightedIds, routine]);

  const hasProfileUpdates = React.useMemo(() => {
    // Check if any highlighted ID belongs to a profile field
    return profile.some(f => highlightedIds.includes(f.key));
  }, [highlightedIds, profile]);

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
        />
        <Tabs.Screen
          name="routine"
          options={{
            title: 'Routine',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="list" color={color} showBadge={hasRoutineUpdates} />,
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: 'Me',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="user" color={color} showBadge={hasProfileUpdates} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="cog" color={color} />,
          }}
        />
      </Tabs>

      {/* Persistent input anchored above tab bar */}
      <Chat bottomOffset={64} />
    </View>
  );
}
