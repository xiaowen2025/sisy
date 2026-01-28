import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Task } from '@/lib/types';

type Props = {
    visible: boolean;
    onClose: () => void;
    task: Task | null;
};

export function TaskDetailModal({ visible, onClose, task }: Props) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    if (!task) return null;

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={[styles.card, { backgroundColor: theme.background, borderColor: theme.text }]}
                    onPress={(e) => e.stopPropagation()} // Prevent closing when tapping the card itself
                >
                    <View style={styles.header}>
                        <Text style={styles.title}>{task.title}</Text>
                        <Pressable onPress={onClose} hitSlop={20}>
                            <Text style={{ color: theme.tint, fontWeight: '600' }}>Close</Text>
                        </Pressable>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Time</Text>
                            <Text style={styles.value}>
                                {task.scheduled_time
                                    ? new Date(task.scheduled_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                                    : 'Now'}
                            </Text>
                        </View>

                        {task.description ? (
                            <View style={styles.section}>
                                <Text style={styles.label}>Description</Text>
                                <Text style={styles.body}>{task.description}</Text>
                            </View>
                        ) : (
                            <View style={styles.section}>
                                <Text style={[styles.label, { fontStyle: 'italic', opacity: 0.5 }]}>No description provided</Text>
                            </View>
                        )}
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
        fontSize: 22,
        fontWeight: '700',
        flex: 1,
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
});
