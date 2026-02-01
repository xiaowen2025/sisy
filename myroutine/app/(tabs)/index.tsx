import { Platform, Pressable, StyleSheet, LayoutAnimation, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useSharedValue,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Text, View } from '@/components/Themed';
import { useAppState } from '@/lib/appState';
import { RescheduleModal } from '@/components/RescheduleModal';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { CompletionModal } from '@/components/CompletionModal';
import { useEffect, useState } from 'react';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Task } from '@/lib/types';

function formatTimeLabel(iso: string | null): string {
  if (!iso) return 'Now';
  const d = new Date(iso);
  // Keep it simple & local.
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// --- TaskCard Component ---
const TaskCard = ({
  task,
  index,
  nowIndex,
  translationY,
  onPress,
  onComplete,
  onReschedule
}: {
  task: Task,
  index: number,
  nowIndex: number,
  translationY: SharedValue<number>,
  onPress: () => void,
  onComplete: () => void,
  onReschedule: () => void
}) => {
  const isNow = index === nowIndex;
  const isCompleted = task.status === 'done';

  // Relative position logic
  // relativeIndex > 0 means "Next/Below", < 0 means "Past/Above"
  const relativeIndex = nowIndex === -1 ? 0 : index - nowIndex;

  const animatedStyle = useAnimatedStyle(() => {
    const drag = translationY.value;

    const spacing = 90;
    const baseTransY = relativeIndex * spacing;
    const finalY = baseTransY + drag;

    const dist = Math.abs(finalY);

    const scale = interpolate(dist, [0, spacing], [1, 0.95], Extrapolation.CLAMP);
    const opacity = interpolate(dist, [0, spacing, spacing * 2.5], [1, 0.4, 0], Extrapolation.CLAMP);
    const zIndex = 100 - Math.round(dist);

    return {
      transform: [
        { translateY: finalY },
        { scale: scale }
      ],
      opacity,
      zIndex,
    };
  });

  const innerCard = (
    <View style={styles.card}>
      <Text style={styles.time}>{formatTimeLabel(task.scheduled_time)}</Text>
      <Text
        style={[
          styles.title,
          isCompleted && { textDecorationLine: 'line-through', opacity: 0.6 }
        ]}
        numberOfLines={1}
      >
        {task.title}
      </Text>
      {isCompleted && (
        <Ionicons name="checkmark-circle" size={24} color={Colors.light.tint} style={{ position: 'absolute', right: 0, top: 18 }} />
      )}
    </View>
  );

  function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
    const styleAnimation = useAnimatedStyle(() => {
      const trans = interpolate(drag.value, [0, -80], [80, 0], Extrapolation.CLAMP);
      return { transform: [{ translateX: trans }] };
    });
    return (
      <Reanimated.View style={[styleAnimation, { flexDirection: 'row' }]}>
        <View style={styles.rightAction}>
          <Ionicons name="time" size={32} color="white" />
        </View>
      </Reanimated.View>
    );
  }

  function LeftAction(prog: SharedValue<number>, drag: SharedValue<number>) {
    const styleAnimation = useAnimatedStyle(() => {
      const trans = interpolate(drag.value, [0, 80], [-80, 0], Extrapolation.CLAMP);
      return { transform: [{ translateX: trans }] };
    });
    return (
      <Reanimated.View style={[styleAnimation, { flexDirection: 'row' }]}>
        <View style={styles.leftAction}>
          <Ionicons name="checkmark-circle" size={32} color="white" />
        </View>
      </Reanimated.View>
    );
  }

  // Enable Swipe for ALL incomplete tasks (Now, Past, Next) per user request
  // Unified logic: Web also uses Swipe (mouse drag supported by gesture handler)
  if (!isCompleted) {
    return (
      <Reanimated.View style={[styles.cardContainer, styles.absContainer, animatedStyle]}>
        <ReanimatedSwipeable
          containerStyle={styles.swipeContainer}
          friction={1.5}
          enableTrackpadTwoFingerGesture
          rightThreshold={60}
          leftThreshold={60}
          overshootRight={false}
          overshootLeft={false}
          renderRightActions={RightAction}
          renderLeftActions={LeftAction}
          onSwipeableOpen={(direction) => {
            if (Platform.OS !== 'web') {
              runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            }
            if (direction === 'right') {
              runOnJS(onComplete)();
            } else if (direction === 'left') {
              runOnJS(onReschedule)();
            }
          }}
        >
          <Pressable onPress={onPress}>
            {innerCard}
          </Pressable>
        </ReanimatedSwipeable>
      </Reanimated.View>
    );
  }

  return (
    <Reanimated.View style={[styles.cardContainer, styles.absContainer, animatedStyle]}>
      {innerCard}
    </Reanimated.View>
  );
};

import { RoutineItemModal } from '@/components/RoutineItemModal';

export default function PresentScreen() {
  const { nowTask, nextTask, pastTask, timeline, completeTask, addLog, skipTask } = useAppState();
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  // Track which task is being acted upon (Reschedule/Detail)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const colorScheme = useColorScheme();

  // Vertical Scroll State
  const translationY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // ... (previous useEffects remain unchanged) ...

  // Find index of 'Now' task in timeline
  const nowIndex = timeline.findIndex(t => t.id === nowTask?.id);

  // Reset scroll when task changes
  useEffect(() => {
    translationY.value = withSpring(0);
  }, [nowTask?.id]);

  // Safety: If the task changes (e.g. completed/skipped), close the detail view.
  useEffect(() => {
    setDetailVisible(false);
  }, [nowTask?.id]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
  }, [nowTask?.id, nextTask?.id]);

  // --- Gestures ---
  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translationY.value = e.translationY * 0.5;
    })
    .onEnd(() => {
      isDragging.value = false;
      translationY.value = withSpring(0, { stiffness: 150, damping: 20 });
    });

  const handleQuickComplete = (task: Task) => {
    completeTask(task.id);
  };

  const handleCompleteWithComment = (task: Task) => {
    completeTask(task.id);
    setCompletionVisible(true);
  };

  const handleDetailComplete = (task: Task, comment?: string) => {
    completeTask(task.id, comment);
  };

  const handleSkip = (task: Task, comment?: string) => {
    skipTask(task.id, comment);
  };

  const handleReschedule = (task: Task) => {
    setSelectedTask(task);
    setRescheduleVisible(true);
  };

  const handleEditRoutine = (task: Task) => {
    if (task.routine_item_id) {
      setDetailVisible(false);
      setEditingRoutineId(task.routine_item_id);
    }
  };

  const handleLogSubmit = (text: string) => {
    if (text.trim()) {
      addLog(text, 'task_complete');
    }
    setCompletionVisible(false);
  };

  const handleLogClose = () => {
    setCompletionVisible(false);
  };

  const handlePress = (task: Task) => {
    // Unified Logic: Tap opens details. Swipe handles actions.
    setSelectedTask(task);
    setDetailVisible(true);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        <View style={styles.stackWrapper}>

          {timeline.map((task, index) => {
            const VISIBILITY_WINDOW = 1;
            // Limit visibility to 3 items: Now +/- 1 (User request: "3 is enough")
            if (nowIndex !== -1 && Math.abs(index - nowIndex) > VISIBILITY_WINDOW) return null;

            return (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                nowIndex={nowIndex}
                translationY={translationY}
                onPress={() => handlePress(task)}
                onComplete={() => handleQuickComplete(task)}
                onReschedule={() => handleReschedule(task)}
              />
            );
          })}

          {timeline.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.title}>All caught up. Enjoy your moment.</Text>
            </View>
          )}

        </View>

        <RescheduleModal
          visible={rescheduleVisible}
          onClose={() => setRescheduleVisible(false)}
          taskId={selectedTask?.id || nowTask?.id || ''}
        />

        <TaskDetailModal
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          task={selectedTask || nowTask}
          onComplete={(comment) => {
            if (selectedTask || nowTask) handleDetailComplete(selectedTask || nowTask!, comment);
          }}
          onSkip={(comment) => {
            if (selectedTask || nowTask) handleSkip(selectedTask || nowTask!, comment);
          }}
          onReschedule={(comment) => {
            if (selectedTask || nowTask) handleReschedule(selectedTask || nowTask!); // Modal handles its own logic, assuming comment lost for now or passed if I modify handleReschedule
          }}
          onEdit={() => {
            if (selectedTask || nowTask) handleEditRoutine(selectedTask || nowTask!);
          }}
        />

        <CompletionModal
          visible={completionVisible}
          onClose={handleLogClose}
          onSubmit={handleLogSubmit}
        />

        <RoutineItemModal
          visible={!!editingRoutineId}
          onClose={() => setEditingRoutineId(null)}
          itemId={editingRoutineId}
        />

        <View style={{ height: 140 }} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  stackWrapper: {
    position: 'relative',
    width: '100%',
    height: 100,
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 10,
  },
  cardContainer: {
    width: '100%',
  },
  absContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  },
  swipeContainer: {
    width: '100%',
    overflow: 'visible',
    backgroundColor: 'transparent',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  card: {
    gap: 12,
    backgroundColor: 'transparent',
    paddingVertical: 12,
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
  rightAction: {
    width: 80,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  leftAction: {
    width: 80,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
});
