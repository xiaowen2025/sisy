import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, Switch, View, Platform, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppState } from '@/lib/appState';
import { RoutineItem } from '@/lib/types';

type Props = {
    visible: boolean;
    onClose: () => void;
    itemId: string | null;
};

export function RoutineItemModal({ visible, onClose, itemId }: Props) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const { routine, updateRoutineItem, deleteRoutineItem } = useAppState();

    const [item, setItem] = useState<RoutineItem | null>(null);

    // Sync local state when modal opens or itemId changes
    useEffect(() => {
        if (visible && itemId) {
            setShowDeleteConfirm(false); // Reset delete confirm
            const found = routine.find((i) => i.id === itemId);
            if (found) {
                setItem({ ...found }); // Clone to avoid direct mutation
            } else {
                setItem(null);
            }
        }
    }, [visible, itemId, routine]);

    function handleSave() {
        if (itemId && item) {
            updateRoutineItem(itemId, {
                title: item.title,
                time: item.time,
                auto_complete: item.auto_complete,
                description: item.description,
                repeat_interval: item.repeat_interval,
            });
        }
        onClose();
    }

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    function handleDelete() {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }
        if (itemId) deleteRoutineItem(itemId);
        onClose();
    }

    if (!item) return null;

    const isDark = colorScheme === 'dark';
    const inputStyle = [styles.input, { color: theme.text, borderColor: isDark ? '#333' : '#eee', backgroundColor: isDark ? '#2c2c2e' : '#f9f9f9' }];

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: theme.background }]}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Edit Item</Text>
                        <Pressable onPress={handleSave}>
                            <Text style={{ color: theme.tint, fontWeight: '600', fontSize: 17 }}>Done</Text>
                        </Pressable>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={inputStyle}
                                value={item.title}
                                onChangeText={(t) => setItem({ ...item, title: t })}
                                placeholder="Item Title"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.rowInputs}>
                            <View style={[styles.fieldGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Time (HH:MM)</Text>
                                <TextInput
                                    style={inputStyle}
                                    value={item.time || ''}
                                    onChangeText={(t) => setItem({ ...item, time: t })}
                                    placeholder="07:00"
                                    placeholderTextColor="#999"
                                />
                            </View>
                            <View style={[styles.fieldGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Repeat (Days)</Text>
                                <TextInput
                                    style={inputStyle}
                                    value={item.repeat_interval ? String(item.repeat_interval) : '1'}
                                    keyboardType="numeric"
                                    onChangeText={(t) => {
                                        const n = parseInt(t, 10);
                                        setItem({ ...item, repeat_interval: isNaN(n) ? 1 : n });
                                    }}
                                    placeholder="1"
                                    placeholderTextColor="#999"
                                />
                            </View>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[inputStyle, { height: 80, textAlignVertical: 'top' }]}
                                value={item.description || ''}
                                onChangeText={(t) => setItem({ ...item, description: t })}
                                multiline
                                placeholder="Add details..."
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={[styles.rowCenter, { justifyContent: 'space-between', paddingVertical: 8 }]}>
                            <View>
                                <Text style={{ fontSize: 16 }}>Auto-complete</Text>
                                <Text style={{ fontSize: 12, opacity: 0.6 }}>Mark done automatically</Text>
                            </View>
                            <Switch
                                value={item.auto_complete}
                                onValueChange={(v) => setItem({ ...item, auto_complete: v })}
                                trackColor={{ false: '#767577', true: theme.tint }}
                            />
                        </View>

                        <View style={{ marginTop: 20, alignItems: 'center', gap: 10 }}>
                            {showDeleteConfirm ? (
                                <View style={{ alignItems: 'center', gap: 10 }}>
                                    <Text style={{ color: theme.text, fontWeight: '600' }}>Are you sure?</Text>
                                    <View style={{ flexDirection: 'row', gap: 20 }}>
                                        <Pressable onPress={() => setShowDeleteConfirm(false)} style={{ padding: 10 }}>
                                            <Text style={{ color: theme.text, opacity: 0.6 }}>Cancel</Text>
                                        </Pressable>
                                        <Pressable onPress={handleDelete} style={{ padding: 10 }}>
                                            <Text style={{ color: '#ff453a', fontWeight: 'bold' }}>Yes, Delete</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ) : (
                                <Pressable onPress={handleDelete} style={{ padding: 10 }}>
                                    <Text style={{ color: '#ff453a', fontSize: 16 }}>Delete Item</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        height: '85%', // Taller sheet for editing
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#ccc',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        padding: 20,
        gap: 20,
    },
    fieldGroup: {
        gap: 8,
    },
    label: {
        fontSize: 12,
        opacity: 0.6,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
    },
    rowInputs: {
        flexDirection: 'row',
        gap: 12,
    },
    rowCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
