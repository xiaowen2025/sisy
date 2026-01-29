import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View, ScrollView, Platform, LayoutAnimation } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAppState } from '@/lib/appState';

export default function MeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { profile, upsertProfileField, deleteProfileField, deleteProfileGroup, logs } = useAppState();

  const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const placeholderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const iconColor = theme.tint; // Use brand color for icons
  const errorColor = '#ef4444';

  // State for UI interactions
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [focusedAttribute, setFocusedAttribute] = useState<string | null>(null);
  const [groupRenameVal, setGroupRenameVal] = useState('');

  const groups = useMemo(() => {
    const grouped: Record<string, typeof profile> = {};
    profile.forEach(f => {
      const grp = f.group || 'Other';
      if (!grouped[grp]) grouped[grp] = [];
      grouped[grp].push(f);
    });
    return grouped;
  }, [profile]);

  // Determine group order
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groups);
    const order = ['Basics', 'Health', 'Preferences', 'Other'];
    return keys.sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groups]);

  const getFieldObj = (key: string) => profile.find((f) => f.key === key);

  const setField = (key: string, val: string) => {
    const existing = getFieldObj(key);
    const grp = existing?.group || 'Other';
    upsertProfileField(key, val, grp, 'user');
  };

  // Group Renaming
  const startRenameGroup = (group: string) => {
    setSelectedGroup(group);
    setGroupRenameVal(group);
    setFocusedAttribute(null);
  };

  const saveGroupRename = (oldName: string, shouldClose = true) => {
    const newName = groupRenameVal.trim();
    if (!newName || newName === oldName) {
      if (shouldClose) setSelectedGroup(null);
      return;
    }
    const items = groups[oldName] || [];
    items.forEach(f => {
      upsertProfileField(f.key, f.value, newName, 'user');
    });
    if (shouldClose) setSelectedGroup(null);
  };

  // Deletion States
  const [attributeToDelete, setAttributeToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const initiateDeleteGroup = (groupName: string) => setGroupToDelete(groupName);
  const confirmDeleteGroup = (groupName: string) => {
    deleteProfileGroup(groupName);
    setSelectedGroup(null);
    setGroupToDelete(null);
  };
  const cancelDeleteGroup = () => setGroupToDelete(null);

  const initiateDeleteAttribute = (key: string) => setAttributeToDelete(key);
  const confirmAttributeDeletion = (key: string) => {
    deleteProfileField(key);
    setAttributeToDelete(null);
  };
  const cancelAttributeDeletion = () => setAttributeToDelete(null);

  // New Item States
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupTempName, setNewGroupTempName] = useState('');

  // Per-group "Add Attribute" state
  const [activeAddGroup, setActiveAddGroup] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const resetAddState = () => {
    setActiveAddGroup(null);
    setNewKey('');
    setNewValue('');
  };

  const saveToGroup = (groupName: string) => {
    if (!newKey.trim() || !newValue.trim()) return;
    upsertProfileField(newKey.trim(), newValue.trim(), groupName, 'user');
    resetAddState();
  };

  const saveNewGroup = () => {
    const name = newGroupTempName.trim();
    if (!name) {
      Alert.alert('Group Name Required', 'Please enter a name for the new group.');
      return;
    }
    if (!newKey.trim() || !newValue.trim()) return;

    upsertProfileField(newKey.trim(), newValue.trim(), name, 'user');
    setCreatingGroup(false);
    setNewGroupTempName('');
    resetAddState();
  };

  const renderAddAttributeRow = (groupName: string, onSave: () => void) => (
    <View style={[styles.row, styles.addAttributeRow, { borderTopColor: borderColor }]}>
      <TextInput
        value={newKey}
        onChangeText={setNewKey}
        placeholder="Attribute"
        placeholderTextColor={placeholderColor}
        style={[styles.smallInput, { color: theme.text, flex: 1, marginRight: 12 }]}
        autoCapitalize="words"
        autoFocus
        returnKeyType="next"
      />
      <TextInput
        value={newValue}
        onChangeText={setNewValue}
        placeholder="Value"
        placeholderTextColor={placeholderColor}
        style={[styles.smallInput, { color: theme.text, flex: 1, marginRight: 12 }]}
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      <Pressable onPress={onSave} style={[styles.actionButton, { backgroundColor: theme.tint }]}>
        <FontAwesome name="check" size={12} color="#fff" />
      </Pressable>
      <Pressable onPress={resetAddState} style={[styles.actionButton, { backgroundColor: 'transparent', marginLeft: 4 }]}>
        <FontAwesome name="close" size={12} color={theme.text} style={{ opacity: 0.5 }} />
      </Pressable>
    </View>
  );

  const renderRow = (f: { key: string; value: string }) => {
    const isSelected = focusedAttribute === f.key;
    const isDeleting = attributeToDelete === f.key;

    return (
      <View style={[styles.row, isSelected && { backgroundColor: theme.cardBackground }]} key={f.key}>
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFocusedAttribute(f.key);
            setSelectedGroup(null);
            resetAddState();
          }}
          style={styles.labelContainer}
        >
          <Text style={[styles.label, isSelected && { color: theme.tint }]}>{f.key}</Text>
        </Pressable>

        <TextInput
          value={f.value}
          onChangeText={(t) => setField(f.key, t)}
          onFocus={() => {
            setFocusedAttribute(f.key);
            setSelectedGroup(null);
            resetAddState();
          }}
          placeholder="Value"
          placeholderTextColor={placeholderColor}
          multiline
          style={[styles.valueInput, { color: theme.text }]}
        />

        {isSelected && (
          <View style={styles.rowActions}>
            {isDeleting ? (
              <View style={styles.confirmDeleteContainer}>
                <Text style={[styles.confirmText, { color: theme.text }]}>Delete?</Text>
                <Pressable onPress={() => confirmAttributeDeletion(f.key)} style={styles.iconButton}>
                  <FontAwesome name="check" size={16} color={errorColor} />
                </Pressable>
                <Pressable onPress={cancelAttributeDeletion} style={styles.iconButton}>
                  <FontAwesome name="close" size={16} color={theme.text} style={{ opacity: 0.5 }} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => initiateDeleteAttribute(f.key)} style={styles.iconButton} hitSlop={8}>
                <FontAwesome name="trash-o" size={16} color={theme.text} style={{ opacity: 0.3 }} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >

      {sortedGroupKeys.map(grpName => {
        const items = groups[grpName];
        if (!items || items.length === 0) return null;
        const isGroupSelected = selectedGroup === grpName;
        const isDeletingGroup = groupToDelete === grpName;

        return (
          <View key={grpName} style={styles.section}>
            {/* Group Header */}
            <View style={styles.headerWrapper}>
              {isGroupSelected ? (
                <View style={styles.editHeaderRow}>
                  {isDeletingGroup ? (
                    <View style={styles.deleteGroupConfirm}>
                      <Text style={[styles.deleteWarning, { color: errorColor }]}>Delete entire group?</Text>
                      <View style={styles.deleteActions}>
                        <Pressable onPress={() => confirmDeleteGroup(grpName)} style={[styles.deleteConfirmBtn, { backgroundColor: errorColor }]}>
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </Pressable>
                        <Pressable onPress={cancelDeleteGroup}>
                          <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        value={groupRenameVal}
                        onChangeText={setGroupRenameVal}
                        onBlur={() => saveGroupRename(grpName, false)}
                        autoFocus
                        style={[styles.headerInput, { color: theme.text, borderBottomColor: theme.tint }]}
                      />
                      <View style={styles.headerActions}>
                        <Pressable onPress={() => saveGroupRename(grpName, true)} style={styles.iconButton}>
                          <FontAwesome name="check" size={16} color={theme.tint} />
                        </Pressable>
                        <Pressable onPress={() => initiateDeleteGroup(grpName)} style={styles.iconButton}>
                          <FontAwesome name="trash-o" size={16} color={theme.text} style={{ opacity: 0.4 }} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ) : (
                <Pressable
                  onPress={() => startRenameGroup(grpName)}
                  style={styles.headerPressable}
                >
                  <Text style={styles.sectionHeader}>{grpName}</Text>
                  <FontAwesome name="pencil" size={12} color={theme.text} style={{ opacity: 0, marginLeft: 8 }} />
                </Pressable>
              )}
            </View>

            {/* Card Content */}
            <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
              {items.map((f, i) => (
                <React.Fragment key={f.key}>
                  {i > 0 && <View style={[styles.separator, { backgroundColor: borderColor }]} />}
                  {renderRow(f)}
                </React.Fragment>
              ))}

              {/* Add Item Footer */}
              {activeAddGroup === grpName ? (
                renderAddAttributeRow(grpName, () => saveToGroup(grpName))
              ) : (
                <Pressable
                  onPress={() => {
                    setActiveAddGroup(grpName);
                    setSelectedGroup(null);
                    setFocusedAttribute(null);
                  }}
                  style={styles.addItemButton}
                >
                  <Text style={[styles.addItemText, { color: theme.tint }]}>+ Add Item</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      {/* New Group Button */}
      {creatingGroup ? (
        <View style={styles.section}>
          <View style={styles.headerWrapper}>
            <TextInput
              value={newGroupTempName}
              onChangeText={setNewGroupTempName}
              placeholder="NEW GROUP NAME"
              placeholderTextColor={placeholderColor}
              autoFocus
              style={[styles.headerInput, { color: theme.text, borderBottomColor: theme.tint, width: '100%' }]}
            />
          </View>
          <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
            {renderAddAttributeRow('new', saveNewGroup)}
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setCreatingGroup(true);
            resetAddState();
            setFocusedAttribute(null);
            setSelectedGroup(null);
          }}
          style={[styles.newGroupBtn, { backgroundColor: theme.tint }]}
        >
          <FontAwesome name="plus" size={16} color="#fff" />
        </Pressable>
      )}

      {/* Logs Section */}
      <View style={styles.section}>
        <View style={styles.headerWrapper}>
          <Text style={styles.sectionHeader}>Logs</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
          {logs && logs.length > 0 ? (
            logs.map((log, i) => (
              <React.Fragment key={log.id}>
                {i > 0 && <View style={[styles.separator, { backgroundColor: borderColor }]} />}
                <View style={styles.logRow}>
                  <Text style={[styles.logTime, { color: theme.text }]}>
                    {new Date(log.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                  <Text style={[styles.logContent, { color: theme.text }]}>{log.content}</Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <View style={styles.row}>
              <Text style={[styles.label, { textTransform: 'none', opacity: 0.5 }]}>Empty.</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
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
  headerWrapper: {
    marginBottom: 12,
    minHeight: 32,
    justifyContent: 'flex-end',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    opacity: 0.5,
  },
  headerPressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInput: {
    fontSize: 16,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingVertical: 4,
    minWidth: 150,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    // Minimal shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  labelContainer: {
    width: 100,
    marginRight: 12,
    paddingTop: 4, // Align with text input baseline
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  valueInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    padding: 0,
  },
  separator: {
    height: 1,
    width: '100%',
  },
  rowActions: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },
  confirmDeleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confirmText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },

  // Add Attribute Styles
  addItemButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  addItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addAttributeRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  smallInput: {
    fontSize: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Delete Group Styles
  deleteGroupConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
  deleteWarning: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteConfirmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },

  // New Group Button
  newGroupBtn: {
    marginTop: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 40, // consistent spacing
  },

  // Logs Styles
  logRow: {
    padding: 16,
    gap: 4,
  },
  logTime: {
    fontSize: 10, // Small timestamp
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
