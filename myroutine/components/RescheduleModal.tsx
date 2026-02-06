import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, TextInput } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppState } from '@/lib/appState';

type Props = {
    visible: boolean;
    onClose: () => void;
    taskId: string;
};

export function RescheduleModal({ visible, onClose, taskId }: Props) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const { rescheduleTask, skipTask } = useAppState();

    const [delayHours, setDelayHours] = useState('1');

    function handleReschedule(option: 'custom' | 'skip') {
        const now = new Date();
        let newTime: string | null = null;

        if (option === 'skip') {
            skipTask(taskId);
            onClose();
            return;
        }

        if (option === 'custom') {
            const hours = parseFloat(delayHours) || 0;
            if (hours <= 0) return; // or handle error
            now.setHours(now.getHours() + hours);
            newTime = now.toISOString();
        }

        rescheduleTask(taskId, newTime);
        onClose();
    }

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: theme.background }]}>
                    <Text style={styles.title}>Reschedule</Text>

                    <View style={styles.options}>
                        {/* Custom Delay Row */}
                        <View style={styles.row}>
                            <Pressable
                                style={({ pressed }) => [styles.option, styles.flex1, { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 1 }]}
                                onPress={() => handleReschedule('custom')}>
                                <Text style={styles.optionTextLight}>Delay</Text>
                            </Pressable>

                            <View style={[styles.inputContainer, { backgroundColor: colorScheme === 'dark' ? '#333' : '#eee' }]}>
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    keyboardType="numeric"
                                    value={delayHours}
                                    onChangeText={setDelayHours}
                                    selectTextOnFocus
                                />
                                <Text style={{ color: theme.text }}>h</Text>
                            </View>
                        </View>

                        <Pressable
                            style={({ pressed }) => [
                                styles.option,
                                {
                                    backgroundColor: colorScheme === 'dark' ? '#333' : '#eee',
                                    opacity: pressed ? 0.6 : 1
                                }
                            ]}
                            onPress={() => handleReschedule('skip')}>
                            <Text style={[styles.optionText, { color: theme.text }]}>Skip</Text>
                        </Pressable>
                    </View>

                    <Pressable onPress={onClose} style={styles.cancelBtn}>
                        <Text style={{ color: theme.text, opacity: 0.6 }}>Cancel</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        padding: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        gap: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 10,
    },
    options: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    flex1: {
        flex: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        paddingHorizontal: 16,
        width: 80,
    },
    input: {
        fontSize: 18,
        fontWeight: '600',
        marginRight: 4,
        textAlign: 'right',
        minWidth: 20,
    },
    option: {
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionTextLight: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    optionText: {
        fontWeight: '600',
        fontSize: 16,
    },
    cancelBtn: {
        alignItems: 'center',
        marginTop: 10,
        padding: 10,
    },
});
