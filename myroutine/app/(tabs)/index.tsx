import { Platform, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { Text, View } from '@/components/Themed';
import { useAppState } from '@/lib/appState';
import { RescheduleModal } from '@/components/RescheduleModal';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { useEffect, useState } from 'react';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

function formatTimeLabel(iso: string | null): string {
  if (!iso) return 'Now';
  const d = new Date(iso);
  // Keep it simple & local.
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function PresentScreen() {
  const { nowTask, nextTask, completeTask } = useAppState();
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // Safety: If the task changes (e.g. completed/skipped), close the detail view.
  // This prevents the next task's details from automatically appearing if the modal was open (or ghost state).
  useEffect(() => {
    setDetailVisible(false);
  }, [nowTask?.id]);

  function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
    const styleAnimation = useAnimatedStyle(() => {
      return {
        transform: [{ translateX: drag.value + 100 }],
      };
    });

    return (
      <Reanimated.View style={styleAnimation}>
        <View style={styles.rightAction}>
          <Text style={styles.actionText}>Reschedule</Text>
        </View>
      </Reanimated.View>
    );
  }

  function LeftAction(prog: SharedValue<number>, drag: SharedValue<number>) {
    const styleAnimation = useAnimatedStyle(() => {
      return {
        transform: [{ translateX: drag.value - 100 }],
      };
    });

    return (
      <Reanimated.View style={styleAnimation}>
        <View style={styles.leftAction}>
          <Text style={styles.actionText}>Complete</Text>
        </View>
      </Reanimated.View>
    );
  }

  return (
    <View style={styles.container}>
      {nowTask ? (
        <View style={styles.cardContainer}>
          <ReanimatedSwipeable
            containerStyle={styles.swipeContainer}
            friction={2}
            enableTrackpadTwoFingerGesture
            rightThreshold={80}
            leftThreshold={80}
            renderRightActions={RightAction}
            renderLeftActions={LeftAction}
            onSwipeableOpen={(direction) => {
              if (direction === 'right') {
                completeTask(nowTask.id);
              } else if (direction === 'left') {
                setRescheduleVisible(true);
              }
            }}>
            <Pressable onPress={() => setDetailVisible(true)}>
              <View style={styles.card}>
                <Text style={styles.time}>{formatTimeLabel(nowTask.scheduled_time)}</Text>
                <Text style={styles.title}>{nowTask.title}</Text>
                {nextTask ? (
                  <Text style={styles.secondary} numberOfLines={1}>
                    Next: {nextTask.title}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          </ReanimatedSwipeable>

          {/* Web Actions: Explicit buttons */}
          {Platform.OS === 'web' && (
            <View style={styles.webActions}>
              <Pressable
                onPress={() => setRescheduleVisible(true)}
                style={({ pressed }) => [
                  styles.webBtn,
                  { backgroundColor: theme.background, opacity: pressed ? 0.6 : 1, borderColor: theme.text, borderWidth: 1 }
                ]}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Reschedule</Text>
              </Pressable>

              <Pressable
                onPress={() => completeTask(nowTask.id)}
                style={({ pressed }) => [
                  styles.webBtn,
                  { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }
                ]}>
                <Text style={{ color: 'white', fontWeight: '600' }}>Complete</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.title}>Breathe.</Text>
        </View>
      )}

      {nowTask && (
        <RescheduleModal
          visible={rescheduleVisible}
          onClose={() => setRescheduleVisible(false)}
          taskId={nowTask.id}
        />
      )}

      {nowTask && (
        <TaskDetailModal
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          task={nowTask}
        />
      )}

      {/* Leave space for Chat + tab bar */}
      <View style={{ height: 140 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  cardContainer: {
    width: '100%',
  },
  swipeContainer: {
    width: '100%',
  },
  card: {
    gap: 12,
    backgroundColor: 'transparent',
    paddingVertical: 12, // Add some hit area
  },
  time: {
    fontSize: 14,
    opacity: 0.7,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
  },
  secondary: {
    fontSize: 14,
    opacity: 0.7,
  },
  rightAction: {
    flex: 1,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
    borderRadius: 12,
  },
  leftAction: {
    flex: 1,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    borderRadius: 12,
  },
  actionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  webActions: {
    marginTop: 32,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'flex-start',
  },
  webBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
});
