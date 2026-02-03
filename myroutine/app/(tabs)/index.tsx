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
  runOnJS,
  useDerivedValue
} from 'react-native-reanimated';
import { GestureDetector, Gesture, TouchableOpacity } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

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
  scrollY,
  onPress,
  onComplete,
  onReschedule
}: {
  task: Task,
  index: number,
  scrollY: SharedValue<number>,
  onPress: () => void,
  onComplete: () => void,
  onReschedule: () => void
}) => {
  // Use scrollY instead of relative index logic
  // We want the card to be at position `index * 90`
  // The view is effectively "camera at scrollY", so position is `(index * 90) - scrollY`

  const ITEM_HEIGHT = 90;
  const isCompleted = task.status === 'done';

  const animatedStyle = useAnimatedStyle(() => {
    // Current absolute position of this card in the list
    const cardY = index * ITEM_HEIGHT;
    // Where it should be relative to the view center/top
    // If scrollY matches cardY, this card is in the main focus spot (0 offset)
    const relativeY = cardY - scrollY.value;

    const dist = Math.abs(relativeY);

    // Scale down as it moves away
    const scale = interpolate(dist, [0, ITEM_HEIGHT], [1, 0.95], Extrapolation.CLAMP);
    // User requested "only display 3 maximal".
    const opacity = interpolate(dist, [0, ITEM_HEIGHT, ITEM_HEIGHT * 1.6], [1, 0.5, 0], Extrapolation.CLAMP);
    // Higher zIndex for closer items
    const zIndex = 100 - Math.round(dist);

    return {
      transform: [
        { translateY: relativeY },
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
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onComplete();
          }}
          style={{ position: 'absolute', right: 0, top: 18 }}
        >
          <Ionicons name="checkmark-circle" size={24} color={Colors.light.tint} />
        </Pressable>
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
          <TouchableOpacity onPress={onPress} activeOpacity={1}>
            {innerCard}
          </TouchableOpacity>
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
  const { nowTask, timeline, completeTask, uncompleteTask, addLog, skipTask } = useAppState();
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  // Track which task is being acted upon (Reschedule/Detail)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const ITEM_HEIGHT = 90;

  // Find index of 'Now' task in timeline logic
  // We compute it fresh each render to know where 'now' is
  const currentNowIndex = timeline.findIndex(t => t.id === nowTask?.id);
  // Fallback to 0 if no nowTask
  const safeNowIndex = currentNowIndex === -1 ? 0 : currentNowIndex;

  // We maintain a focusedIndex in React state to know which items to render
  // Initialize with safeNowIndex
  const [focusedIndex, setFocusedIndex] = useState(safeNowIndex);

  // Vertical Scroll State: Absolute position (e.g. index * 90)
  const scrollY = useSharedValue(safeNowIndex * ITEM_HEIGHT);
  const startScrollY = useSharedValue(0); // To store initial value on gesture start

  // Sync scrollY and focusedIndex when the screen gains focus
  // usage: user assumes state is reset to "Now" only when navigating TO this tab
  useFocusEffect(
    useCallback(() => {
      // Re-find the latest now index
      const freshNowIndex = timeline.findIndex(t => t.id === nowTask?.id);
      const targetIndex = freshNowIndex === -1 ? 0 : freshNowIndex;

      setFocusedIndex(targetIndex);
      scrollY.value = withSpring(targetIndex * ITEM_HEIGHT);
    }, [nowTask?.id, timeline]) // Depend on nowTask/timeline so if data changed while away, we reset
  );

  // Update focused index based on scroll position for rendering optimization
  // We use useDerivedValue to track it on UI thread, but we need to update JS state for rendering range.
  // Using a listener or runOnJS in gesture end is cleaner.

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      startScrollY.value = scrollY.value;
    })
    .onUpdate((e) => {
      // -translationY because dragging UP means moving DOWN the list (view moves up, scroll value increases)
      // Actually standard scroll: Drag Up -> Content moves Up -> We see items below.
      // If index 0 is at top, index 1 is at 90.
      // To see index 1, we need scrollY to increase to 90.
      // Dragging Up (negative translation) should INCREASE scrollY.
      scrollY.value = startScrollY.value - e.translationY;
    })
    .onEnd((e) => {
      // Snap to nearest item
      // Predict end position with velocity
      const velocity = -e.velocityY * 0.2; // slight momentum factor
      const projectedY = scrollY.value + velocity;

      // Calculate target index
      const rawIndex = Math.round(projectedY / ITEM_HEIGHT);

      // Clamp index to 0..length-1
      const maxIndex = Math.max(0, timeline.length - 1);
      const targetIndex = Math.min(Math.max(0, rawIndex), maxIndex);

      const targetY = targetIndex * ITEM_HEIGHT;

      scrollY.value = withSpring(targetY, { stiffness: 150, damping: 20 });

      // Update JS state for rendering optimization
      runOnJS(setFocusedIndex)(targetIndex);
    });

  const handleQuickComplete = (task: Task) => {
    if (task.status === 'done') {
      uncompleteTask(task.id);
    } else {
      completeTask(task.id);
    }
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
    setDetailVisible(false);
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


            return (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                scrollY={scrollY}
                onPress={() => handlePress(task)}
                onComplete={() => handleQuickComplete(task)}
                onReschedule={() => handleReschedule(task)}
              />
            );
          })}

        </View>

        {timeline.length > 0 && timeline.filter(task => task.status === 'todo').length === 0 && (
          <View style={styles.card}>
            <Text style={styles.title}>All caught up. Enjoy your moment.</Text>
          </View>
        )}

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
            if (selectedTask || nowTask) handleReschedule(selectedTask || nowTask!);
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


