import React, { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, TextInput, View, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Clipboard from 'expo-clipboard';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAppState } from '@/lib/appState';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const { loadRoutineTemplate, routine, profile, importRoutine, importProfile, logs } = useAppState();

    const [importVisible, setImportVisible] = useState(false);
    const [importMode, setImportMode] = useState<'routine' | 'profile'>('routine');
    const [importText, setImportText] = useState('');

    // Confirmation state for Default Template
    const [defaultConfirmVisible, setDefaultConfirmVisible] = useState(false);

    // Selection state for Template
    const [templateSelectionVisible, setTemplateSelectionVisible] = useState(false);

    function confirmLoadDefault() {
        setDefaultConfirmVisible(false);
        loadRoutineTemplate();
        if (Platform.OS === 'web') {
            window.alert('Default routine loaded!');
        } else {
            Alert.alert('Done', 'Default routine loaded!');
        }
    }



    async function handleExportRoutine() {
        const json = JSON.stringify(routine, null, 2);
        await Clipboard.setStringAsync(json);
        Alert.alert('Copied', 'Routine data copied to clipboard.');
    }

    async function handleExportProfile() {
        const json = JSON.stringify(profile, null, 2);
        await Clipboard.setStringAsync(json);
        Alert.alert('Copied', 'Profile data copied to clipboard.');
    }

    function handleImportSubmit() {
        if (!importText.trim()) return;
        if (importMode === 'routine') {
            importRoutine(importText);
        } else {
            importProfile(importText);
        }
        setImportVisible(false);
        setImportText('');
    }

    const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    const SettingsRow = ({ icon, label, onPress, destructive = false }: { icon: any, label: string, onPress: () => void, destructive?: boolean }) => (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                {
                    backgroundColor: pressed ? (colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)') : 'transparent'
                }
            ]}>
            <View style={styles.rowContent}>
                <View style={[styles.iconContainer, { backgroundColor: destructive ? 'rgba(239,68,68,0.1)' : (colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}>
                    <FontAwesome name={icon} size={16} color={destructive ? '#ef4444' : theme.tint} />
                </View>
                <Text style={[styles.rowText, destructive && { color: '#ef4444' }]}>{label}</Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color={theme.text} style={{ opacity: 0.3 }} />
        </Pressable>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>


                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Templates</Text>
                    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                        <SettingsRow
                            icon="download"
                            label="Load Routine Template"
                            onPress={() => setTemplateSelectionVisible(true)}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Data & Sync</Text>
                    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                        <SettingsRow
                            icon="copy"
                            label="Export Routine (Copy JSON)"
                            onPress={handleExportRoutine}
                        />
                        <View style={[styles.separator, { backgroundColor: borderColor }]} />
                        <SettingsRow
                            icon="paste"
                            label="Import Routine (Paste JSON)"
                            onPress={() => { setImportMode('routine'); setImportVisible(true); }}
                        />
                        <View style={[styles.separator, { backgroundColor: borderColor }]} />
                        <SettingsRow
                            icon="user-circle-o"
                            label="Export Profile (Copy JSON)"
                            onPress={handleExportProfile}
                        />
                        <View style={[styles.separator, { backgroundColor: borderColor }]} />
                        <SettingsRow
                            icon="user-plus"
                            label="Import Profile (Paste JSON)"
                            onPress={() => { setImportMode('profile'); setImportVisible(true); }}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionHeader}>Audit Log</Text>
                    <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                        {logs.length === 0 && (
                            <View style={{ padding: 16 }}>
                                <Text style={{ opacity: 0.5, fontSize: 13, color: theme.text }}>No recent activity.</Text>
                            </View>
                        )}
                        {logs.map((log, i) => (
                            <React.Fragment key={log.id}>
                                {i > 0 && <View style={[styles.separator, { backgroundColor: borderColor, marginLeft: 16 }]} />}
                                <View style={styles.logRow}>
                                    <Text style={[styles.logTime, { color: theme.text }]}>
                                        {new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <Text style={[styles.logContent, { color: theme.text }]}>{log.content}</Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>

                <View style={{ height: 100 }} />

                <Modal animationType="slide" visible={importVisible} presentationStyle="pageSheet" onRequestClose={() => setImportVisible(false)}>
                    <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Import {importMode === 'routine' ? 'Routine' : 'Profile'}</Text>
                            <Pressable onPress={() => setImportVisible(false)} hitSlop={10}>
                                <Text style={{ color: theme.tint, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                            </Pressable>
                        </View>
                        <View style={{ padding: 20, flex: 1 }}>
                            <Text style={[styles.modalLabel, { color: theme.text }]}>Paste JSON Data</Text>
                            <TextInput
                                style={[styles.textArea, {
                                    color: theme.text,
                                    backgroundColor: theme.cardBackground,
                                    borderColor: borderColor
                                }]}
                                multiline
                                value={importText}
                                onChangeText={setImportText}
                                placeholder="{ ... }"
                                placeholderTextColor={colorScheme === 'dark' ? '#555' : '#999'}
                                autoCapitalize="none"
                            />
                            <Pressable
                                onPress={handleImportSubmit}
                                style={({ pressed }) => [styles.importBtn, { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1 }]}
                            >
                                <Text style={styles.importBtnText}>Import Data</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>

                {/* Template Selection Modal */}
                <Modal animationType="fade" transparent visible={templateSelectionVisible} onRequestClose={() => setTemplateSelectionVisible(false)}>
                    <View style={styles.centeredModalOverlay}>
                        <View style={[styles.alertBox, { backgroundColor: theme.cardBackground }]}>
                            <View style={styles.alertContent}>
                                <Text style={[styles.alertTitle, { color: theme.text }]}>Choose Template</Text>
                                <Text style={[styles.alertMessage, { color: theme.text }]}>
                                    Select a starting routine to merge into your schedule.
                                </Text>
                            </View>

                            <View style={{ borderTopWidth: 1, borderTopColor: borderColor }}>
                                <Pressable
                                    onPress={() => { setTemplateSelectionVisible(false); setDefaultConfirmVisible(true); }}
                                    style={{ padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: borderColor }}
                                >
                                    <Text style={{ color: theme.tint, fontSize: 16, fontWeight: '600' }}>Basic Routine</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setTemplateSelectionVisible(false)}
                                    style={{ padding: 16, alignItems: 'center' }}
                                >
                                    <Text style={{ color: theme.text, fontSize: 16, opacity: 0.7 }}>Cancel</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Default Routine Confirmation Modal */}
                <Modal animationType="fade" transparent visible={defaultConfirmVisible} onRequestClose={() => setDefaultConfirmVisible(false)}>
                    <View style={styles.centeredModalOverlay}>
                        <View style={[styles.alertBox, { backgroundColor: theme.cardBackground }]}>
                            <View style={styles.alertContent}>
                                <Text style={[styles.alertTitle, { color: theme.text }]}>Load Default Template?</Text>
                                <Text style={[styles.alertMessage, { color: theme.text }]}>
                                    This will merge the default routine into your current schedule.
                                </Text>
                            </View>

                            <View style={[styles.alertButtons, { borderTopColor: borderColor }]}>
                                <Pressable
                                    onPress={() => setDefaultConfirmVisible(false)}
                                    style={styles.alertButton}
                                >
                                    <Text style={[styles.alertButtonText, { color: theme.text, opacity: 0.7 }]}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={confirmLoadDefault}
                                    style={[styles.alertButton, { borderLeftWidth: 1, borderLeftColor: borderColor }]}
                                >
                                    <Text style={[styles.alertButtonText, { color: theme.tint, fontWeight: '600' }]}>Load</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>


            </ScrollView >
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    pageTitle: {
        fontSize: 34,
        fontWeight: '700',
        marginBottom: 32,
        letterSpacing: -0.5,
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        opacity: 0.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        minHeight: 64,
    },
    rowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: {
        fontSize: 16,
        fontWeight: '500',
    },
    separator: {
        height: 1,
        width: '100%',
        marginLeft: 64, // Indent separator to text start
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        opacity: 0.6,
        marginBottom: 8,
    },
    textArea: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginBottom: 16,
    },
    importBtn: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 20,
    },
    importBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },

    // Alert Styles
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertBox: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 20,
        overflow: 'hidden',
    },
    alertContent: {
        padding: 24,
        alignItems: 'center',
    },
    alertTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    alertMessage: {
        fontSize: 14,
        textAlign: 'center',
        opacity: 0.7,
        lineHeight: 20,
    },
    alertButtons: {
        flexDirection: 'row',
        borderTopWidth: 1,
        height: 50,
    },
    alertButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    // Logs Styles
    logRow: {
        padding: 16,
        gap: 4,
    },
    logTime: {
        fontSize: 10,
        opacity: 0.5,
        textTransform: 'uppercase',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    logContent: {
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.9,
    },
});
