import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, TextInput } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { FontAwesome } from '@expo/vector-icons';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Task } from '@/lib/types';

type Props = {
    visible: boolean;
    onClose: () => void;
    task: Task | null;
    onComplete?: (comment?: string) => void;
    onSkip?: (comment?: string) => void;
    onReschedule?: (comment?: string) => void;
    onEdit?: () => void;
};

export function TaskDetailModal({ visible, onClose, task, onComplete, onSkip, onReschedule, onEdit }: Props) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const [comment, setComment] = useState('');

    if (!task) return null;

    const markdownStyles = {
        body: {
            color: theme.text,
            fontSize: 16,
            lineHeight: 24,
        },
        // Add more styles if needed to match app theme
    };

    const handleComplete = () => {
        onComplete?.(comment);
        onClose();
        setComment(''); // Reset comment
    };

    const timeLabel = task.scheduled_time
        ? new Date(task.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : 'Now';

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.card, { backgroundColor: theme.background, borderColor: theme.text }]}
                    onPress={(e) => e.stopPropagation()} // Prevent closing when tapping the card itself
                >
                    <View style={styles.header}>
                        <Pressable onPress={onClose} hitSlop={20}>
                            <FontAwesome name="close" size={20} color={theme.text} style={{ opacity: 0.6 }} />
                        </Pressable>
                        <Text style={styles.title} numberOfLines={1}>
                            {timeLabel} - {task.title}
                        </Text>
                        {task.routine_item_id && onEdit && (
                            <Pressable onPress={onEdit} hitSlop={20}>
                                <FontAwesome name="pencil" size={20} color={theme.text} style={{ opacity: 0.6 }} />
                            </Pressable>
                        )}
                    </View>

                    <View style={styles.content}>
                        {task.description ? (
                            <View style={styles.section}>
                                <Text style={styles.label}>Description</Text>
                                <Markdown style={markdownStyles}>
                                    {task.description}
                                </Markdown>
                            </View>
                        ) : null}

                        <View style={styles.section}>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.text }]}
                                placeholder="Comment / Log..."
                                placeholderTextColor="#999"
                                value={comment}
                                onChangeText={setComment}
                            />
                        </View>

                        <View style={styles.actions}>
                            <Pressable
                                onPress={handleComplete}
                                style={[styles.actionBtn, { backgroundColor: '#34C759', flex: 2 }]} // Green, wider
                            >
                                <Text style={styles.actionBtnText}>Complete</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => { onSkip?.(comment); onClose(); }}
                                style={[styles.actionBtn, { backgroundColor: '#8E8E93', flex: 1 }]} // Gray
                            >
                                <Text style={styles.actionBtnText}>Skip</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => { onReschedule?.(comment); onClose(); }}
                                style={[styles.actionBtn, { backgroundColor: '#FFCC00', flex: 1 }]}
                            >
                                <Text style={styles.actionBtnText}>Delay</Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        borderRadius: 20,
        padding: 24,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
    },
    content: {
        gap: 20,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    section: {
        gap: 8,
    },
    label: {
        fontSize: 12,
        opacity: 0.6,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    value: {
        fontSize: 18,
        fontWeight: '500',
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
        opacity: 0.9,
    },
    input: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        justifyContent: 'center',
    },
    actionBtn: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        minWidth: 90,
        alignItems: 'center',
    },
    actionBtnText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
});
