import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, Switch, View, Platform, Alert, KeyboardAvoidingView, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';

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
    const { routine, updateRoutineItem, deleteRoutineItem, logs, revertRoutineDescription, requestChatDraft } = useAppState();

    const [item, setItem] = useState<RoutineItem | null>(null);

    // Markdown Editing State
    const [showPreview, setShowPreview] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });

    // Sync local state when modal opens or itemId changes
    useEffect(() => {
        if (visible && itemId) {
            setShowDeleteConfirm(false); // Reset delete confirm
            setShowPreview(false); // Reset preview mode (unused but kept for cleanliness)
            setIsEditing(false); // Reset editing mode
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

    // Markdown Helper Functions
    const insertText = (textToInsert: string) => {
        if (!item) return;

        const currentDesc = item.description || '';
        const newDesc =
            currentDesc.substring(0, selection.start) +
            textToInsert +
            currentDesc.substring(selection.end);

        setItem({ ...item, description: newDesc });

        // Update selection to be after the inserted text (roughly)
        // Note: TextInput selection update might lag slightly without re-focus, 
        // but this updates the content.
    };

    if (!item) return null;

    const isDark = colorScheme === 'dark';
    const inputStyle = [styles.input, { color: theme.text, borderColor: isDark ? '#333' : '#eee', backgroundColor: isDark ? '#2c2c2e' : '#f9f9f9' }];

    const markdownStyles = {
        body: {
            color: theme.text,
            fontSize: 16,
            lineHeight: 24,
        },
    };

    const ToolbarButton = ({ icon, label, onPress, active }: { icon?: any, label?: string, onPress: () => void, active?: boolean }) => (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.toolbarButton,
                active && { backgroundColor: theme.tint, borderColor: theme.tint },
                { opacity: pressed ? 0.7 : 1, borderColor: isDark ? '#444' : '#ddd' }
            ]}
        >
            {icon ? (
                <FontAwesome name={icon} size={14} color={active ? 'white' : theme.text} />
            ) : (
                <Text style={[styles.toolbarButtonText, active && { color: 'white' }]}>{label}</Text>
            )}
        </Pressable>
    );

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            {/* @ts-ignore - React Native type definition issue */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <View style={[styles.sheet, { backgroundColor: theme.background }]}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Edit Item</Text>
                            <Pressable onPress={handleSave} style={{ padding: 8 }}>
                                <FontAwesome name="check" size={20} color={theme.tint} />
                            </Pressable>
                        </View>

                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={{ gap: 20 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
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
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.label}>Description</Text>
                                        {item.previousDescription && (
                                            <Pressable
                                                onPress={() => {
                                                    revertRoutineDescription(item.id);
                                                    // Update local state to reflect the revert
                                                    setItem({ ...item, description: item.previousDescription, previousDescription: item.description });
                                                }}
                                                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: isDark ? 'rgba(255,149,0,0.15)' : 'rgba(255,149,0,0.1)', borderRadius: 6 }}
                                            >
                                                <FontAwesome name="undo" size={10} color="#ff9500" style={{ marginRight: 4 }} />
                                                <Text style={{ fontSize: 10, color: '#ff9500', fontWeight: '600' }}>Revert</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Pressable
                                            onPress={() => {
                                                requestChatDraft(`Help me refine routine ${item.title}`);
                                                onClose();
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)', borderRadius: 6 }}
                                        >
                                            <FontAwesome name="magic" size={16} color={theme.tint} />
                                        </Pressable>
                                        {isEditing && (
                                            <Pressable onPress={() => setIsEditing(false)} style={{ padding: 4 }}>
                                                <FontAwesome name="check" size={16} color={theme.tint} />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>

                                {isEditing ? (
                                    <>
                                        <View style={styles.toolbar}>
                                            <ToolbarButton label="H1" onPress={() => insertText('# ')} />
                                            <ToolbarButton label="H2" onPress={() => insertText('## ')} />
                                            <ToolbarButton label="List" icon="list-ul" onPress={() => insertText('- ')} />
                                            <ToolbarButton label="Num" icon="list-ol" onPress={() => insertText('1. ')} />
                                            <ToolbarButton label="Bold" icon="bold" onPress={() => insertText('**text**')} />
                                        </View>
                                        <TextInput
                                            style={[inputStyle, { height: 160, textAlignVertical: 'top' }]}
                                            value={item.description || ''}
                                            onChangeText={(t) => setItem({ ...item, description: t })}
                                            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                                            multiline
                                            autoFocus
                                            onBlur={() => setIsEditing(false)}
                                            placeholder="Add details... (Markdown supported)"
                                            placeholderTextColor="#999"
                                        />
                                    </>
                                ) : (
                                    <Pressable
                                        onPress={() => setIsEditing(true)}
                                        style={[inputStyle, { minHeight: 100, padding: 12, justifyContent: 'flex-start' }]}
                                    >
                                        {item.description ? (
                                            <Markdown style={markdownStyles}>{item.description}</Markdown>
                                        ) : (
                                            <Text style={{ opacity: 0.5, fontStyle: 'italic' }}>Add description...</Text>
                                        )}
                                    </Pressable>
                                )}
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

                            {/* History / Logs Section */}
                            {itemId && logs && (
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[styles.label, { marginBottom: 12 }]}>History</Text>
                                    <View style={[styles.sheet, { backgroundColor: theme.cardBackground, paddingBottom: 0, height: 'auto', borderRadius: 16, overflow: 'hidden' }]}>
                                        {logs.filter(l => l.routine_item_id === itemId).length > 0 ? (
                                            logs
                                                .filter(l => l.routine_item_id === itemId)
                                                .slice(0, 10) // Limit to 10
                                                .map((log, i) => (
                                                    <View key={log.id} style={{
                                                        padding: 16,
                                                        borderBottomWidth: i < logs.filter(l => l.routine_item_id === itemId).length - 1 ? StyleSheet.hairlineWidth : 0,
                                                        borderBottomColor: isDark ? '#444' : '#eee'
                                                    }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 10, opacity: 0.5, fontWeight: '700', textTransform: 'uppercase' }}>
                                                                {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </Text>
                                                            <Text style={{ fontSize: 10, opacity: 0.5, fontWeight: '700', textTransform: 'uppercase' }}>
                                                                {log.related_action.replace('task_', '').toUpperCase()}
                                                            </Text>
                                                        </View>
                                                        <Text style={{ fontSize: 14, opacity: 0.9 }}>{log.content}</Text>
                                                    </View>
                                                ))
                                        ) : (
                                            <View style={{ padding: 16 }}>
                                                <Text style={{ opacity: 0.5, fontStyle: 'italic', fontSize: 14 }}>No logs yet.</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView >
        </Modal >
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
    toolbar: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    toolbarButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 32,
    },
    toolbarButtonText: {
        fontSize: 12,
        fontWeight: '600',
        opacity: 0.8,
    },
});
