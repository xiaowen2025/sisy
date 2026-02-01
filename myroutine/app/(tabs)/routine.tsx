import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import { useAppState } from '@/lib/appState';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { RoutineItem } from '@/lib/types';
import { RoutineItemModal } from '@/components/RoutineItemModal';

export default function RoutineScreen() {
  const { routine, addRoutineItem, highlightedIds, acknowledgeHighlight } = useAppState();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // No auto-dismiss for highlights - they persist until interaction.

  // Modal State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleInteraction = (id: string) => {
    if (highlightedIds.includes(id)) {
      acknowledgeHighlight([id]);
    }
    setEditingItemId(id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.timeline}>
          {/* Timeline Line */}
          <View style={[styles.timelineLine, { backgroundColor: colorScheme === 'dark' ? '#333' : '#e0e0e0' }]} />

          {routine.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              onPress={() => handleInteraction(item.id)}
              theme={theme}
              isDark={colorScheme === 'dark'}
              isHighlighted={highlightedIds.includes(item.id)}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={addRoutineItem}>
          <FontAwesome name="plus" size={16} color="white" />
          <Text style={styles.addButtonText}>Add Routine Item</Text>
        </Pressable>

        {/* Spacer for bottom tab bar / omni chat */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <RoutineItemModal
        visible={!!editingItemId}
        itemId={editingItemId}
        onClose={() => setEditingItemId(null)}
      />
    </View>
  );
}

function TimelineItem({
  item,
  onPress,
  theme,
  isDark,
  isHighlighted,
}: {
  item: RoutineItem;
  onPress: () => void;
  theme: typeof Colors.light;
  isDark: boolean;
  isHighlighted?: boolean;
}) {
  const repeatLabel = item.repeat_interval && item.repeat_interval > 1
    ? `Every ${item.repeat_interval} days`
    : null;

  return (
    <View style={styles.itemRow}>
      {/* Time Column */}
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{item.time || '--:--'}</Text>
      </View>

      {/* Connector Dot */}
      <View style={[styles.dot, {
        backgroundColor: isHighlighted ? theme.tint : theme.tint,
        borderColor: isHighlighted ? theme.tint : theme.background
      }]} />

      {/* Card */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isHighlighted
              ? (isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.08)')
              : (isDark ? '#1c1c1e' : '#ffffff'),
            borderColor: isHighlighted
              ? theme.tint
              : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
            opacity: pressed ? 0.7 : 1,
            borderWidth: isHighlighted ? 1.5 : 1,
          },
        ]}>
        <View>
          <Text style={[styles.itemTitle, item.auto_complete && styles.autoCompleteText, isHighlighted && { color: theme.tint }]}>
            {item.title}
          </Text>
          {repeatLabel && (
            <Text style={styles.repeatLabel}>{repeatLabel}</Text>
          )}
        </View>
        <FontAwesome name="chevron-right" size={12} color={theme.text} style={{ opacity: 0.2 }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 60,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  timeline: {
    position: 'relative',
    paddingLeft: 10,
  },
  timelineLine: {
    position: 'absolute',
    left: 68, // Adjust based on time column width + styling
    top: 0,
    bottom: 0,
    width: 2,
    zIndex: -1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeColumn: {
    width: 50,
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginRight: 10,
    zIndex: 1,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    // Shadow for elevation
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
      }
    }),
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  autoCompleteText: {
    fontWeight: '400',
    opacity: 0.6,
  },
  repeatLabel: {
    fontSize: 11,
    opacity: 0.5,
    fontWeight: '500',
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    marginHorizontal: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
