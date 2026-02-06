import React, { useMemo, useState, useCallback } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View, LayoutAnimation, Keyboard } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DraggableFlatList, { ScaleDecorator, RenderItemParams, ShadowDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAppState } from '@/lib/appState';
import { ProfileField } from '@/lib/types';
import { SafeAreaView } from 'react-native-safe-area-context';

// Types for our FlatList items
type HeaderItem = { type: 'header'; group: string; id: string };
type FieldItem = { type: 'field'; field: ProfileField; id: string };
type FooterItem = { type: 'footer'; group: string; id: string };
type PlaceholderItem = { type: 'placeholder'; id: string }; // For empty state or spacing

type ListItem = HeaderItem | FieldItem | FooterItem | PlaceholderItem;

export default function MeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { profile, setProfile, upsertProfileField, deleteProfileField, deleteProfileGroup, highlightedIds, acknowledgeHighlight, revertProfileValue } = useAppState();

  const borderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const placeholderColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const errorColor = '#ef4444';

  // --- Interaction State ---
  const [focusedAttribute, setFocusedAttribute] = useState<string | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<{ original: string, current: string } | null>(null);

  // Deletion
  const [attributeToDelete, setAttributeToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  // Addition
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupTempName, setNewGroupTempName] = useState('');

  const [activeAddGroup, setActiveAddGroup] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // --- Data Flattening ---
  const data = useMemo(() => {
    const list: ListItem[] = [];
    if (profile.length === 0) return list;

    // Sort profile: "Basics" first, others preserve order
    const basics = profile.filter(f => (f.group || 'Other') === 'Basics');
    const others = profile.filter(f => (f.group || 'Other') !== 'Basics');
    const sortedProfile = [...basics, ...others];

    let currentGroup = sortedProfile[0].group || 'Other';

    // Add first header
    list.push({ type: 'header', group: currentGroup, id: `header-${currentGroup}-0` });

    sortedProfile.forEach((f, i) => {
      const g = f.group || 'Other';
      if (g !== currentGroup) {
        // Close previous group with footer
        list.push({ type: 'footer', group: currentGroup, id: `footer-${currentGroup}-${i}` });

        // Start new group
        currentGroup = g;
        list.push({ type: 'header', group: g, id: `header-${g}-${i}` });
      }
      list.push({ type: 'field', field: f, id: f.key });
    });

    // Close last group
    list.push({ type: 'footer', group: currentGroup, id: `footer-${currentGroup}-end` });

    // Add extra padding item at bottom
    list.push({ type: 'placeholder', id: 'bottom-pad' });

    return list;
  }, [profile]);

  // --- Key Extractor ---
  const keyExtractor = (item: ListItem) => item.id;

  // --- Drag End Handler ---
  const onDragEnd = ({ data: newData }: { data: ListItem[] }) => {
    // Reconstruct profile from the visual list
    const newProfile: ProfileField[] = [];
    let currentGroup = 'Other'; // Default

    const firstHeader = newData.find(i => i.type === 'header') as HeaderItem | undefined;
    if (firstHeader) currentGroup = firstHeader.group;

    newData.forEach(item => {
      if (item.type === 'header') {
        currentGroup = item.group;
      } else if (item.type === 'field') {
        // If the group has changed (dragged to new section), update it
        // Note: We use strict comparison.
        const updatedField = { ...item.field, group: currentGroup };
        newProfile.push(updatedField);
      }
    });

    setProfile(newProfile);
  };

  // --- Helpers ---
  const resetAddState = () => {
    setActiveAddGroup(null);
    setNewKey('');
    setNewValue('');
  };

  const moveField = (key: string, direction: number) => {
    const index = profile.findIndex(f => f.key === key);
    if (index === -1) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= profile.length) return;

    const newProfile = [...profile];
    const [removed] = newProfile.splice(index, 1);
    newProfile.splice(newIndex, 0, removed);
    setProfile(newProfile);
  };

  const handleCreateGroup = () => {
    const name = newGroupTempName.trim();
    if (!name) return;
    if (!newKey.trim() || !newValue.trim()) return;

    upsertProfileField(newKey.trim(), newValue.trim(), name, 'user');
    setCreatingGroup(false);
    setNewGroupTempName('');
    resetAddState();
  };

  const saveToGroup = (group: string) => {
    if (!newKey.trim() || !newValue.trim()) return;
    upsertProfileField(newKey.trim(), newValue.trim(), group, 'user');
    resetAddState();
  };

  const saveGroupRename = () => {
    if (!renamingGroup) return;
    const oldName = renamingGroup.original;
    const newName = renamingGroup.current.trim();

    if (newName && newName !== oldName) {
      // Update all fields in this group
      // We need to find them in the profile
      const fields = profile.filter(f => (f.group || 'Other') === oldName);
      fields.forEach(f => {
        upsertProfileField(f.key, f.value, newName, 'user');
      });
    }
    setRenamingGroup(null);
  };

  const deleteGroup = (group: string) => {
    deleteProfileGroup(group);
    setGroupToDelete(null);
  };

  // --- Render Items ---

  const renderHeader = (item: HeaderItem) => {
    const isRenaming = renamingGroup?.original === item.group;
    const isDeleting = groupToDelete === item.group;

    return (
      <View style={styles.headerWrapper}>
        <View style={styles.editHeaderRow}>
          {isDeleting ? (
            <View style={styles.deleteGroupConfirm}>
              <Text style={[styles.deleteWarning, { color: errorColor }]}>Delete {item.group}?</Text>
              <View style={styles.deleteActions}>
                <Pressable onPress={() => deleteGroup(item.group)} style={[styles.deleteConfirmBtn, { backgroundColor: errorColor }]}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
                <Pressable onPress={() => setGroupToDelete(null)}>
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : isRenaming ? (
            <>
              <TextInput
                value={renamingGroup.current}
                onChangeText={(t) => setRenamingGroup(prev => prev ? ({ ...prev, current: t }) : null)}
                onBlur={saveGroupRename}
                autoFocus
                style={[styles.headerInput, { color: theme.text, borderBottomColor: theme.tint }]}
              />
              <Pressable onPress={saveGroupRename} style={styles.iconButton}>
                <FontAwesome name="check" size={12} color={theme.tint} />
              </Pressable>
            </>
          ) : (
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => setRenamingGroup({ original: item.group, current: item.group })}
                onLongPress={() => setGroupToDelete(item.group)}
                delayLongPress={500}
              >
                <Text style={styles.sectionHeader}>{item.group}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderField = ({ item, drag, isActive }: RenderItemParams<FieldItem>) => {
    const f = item.field;
    const isSelected = focusedAttribute === f.key;
    const isDeleting = attributeToDelete === f.key;
    const isHighlighted = highlightedIds.includes(f.key);

    return (
      <ScaleDecorator>
        <View
          style={[
            styles.row,
            { backgroundColor: theme.cardBackground },
            isSelected && { backgroundColor: theme.cardBackground }, // Highlight logic?
            isActive && { backgroundColor: theme.tint, opacity: 0.9, borderRadius: 8 },
            isHighlighted && { backgroundColor: colorScheme === 'dark' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)' }
          ]}
        >
          <Pressable
            onPressIn={drag}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFocusedAttribute(f.key);
              if (isHighlighted) acknowledgeHighlight([f.key]);
            }}
            style={styles.labelContainer}
          >
            <Text style={[styles.label, (isSelected || isHighlighted) && { color: theme.tint }, isActive && { color: '#fff' }]}>{f.key}</Text>
          </Pressable>

          <TextInput
            value={f.value}
            onChangeText={(t) => upsertProfileField(f.key, t, f.group, 'user')}
            onFocus={() => {
              setFocusedAttribute(f.key);
              if (isHighlighted) acknowledgeHighlight([f.key]);
            }}
            placeholder="Value"
            placeholderTextColor={isActive ? 'rgba(255,255,255,0.6)' : placeholderColor}
            multiline
            style={[styles.valueInput, { color: isActive ? '#fff' : theme.text }]}
            editable={!isActive}
          />

          {isSelected && !isActive && (
            <View style={styles.rowActions}>
              <Pressable onPress={() => moveField(f.key, -1)} style={styles.iconButton}>
                <FontAwesome name="chevron-up" size={12} color={theme.text} style={{ opacity: 0.5 }} />
              </Pressable>
              <Pressable onPress={() => moveField(f.key, 1)} style={styles.iconButton}>
                <FontAwesome name="chevron-down" size={12} color={theme.text} style={{ opacity: 0.5 }} />
              </Pressable>
              {f.previousValue && (
                <Pressable onPress={() => revertProfileValue(f.key)} style={styles.iconButton}>
                  <FontAwesome name="undo" size={14} color="#ff9500" />
                </Pressable>
              )}
              {isDeleting ? (
                <Pressable onPress={() => { deleteProfileField(f.key); setAttributeToDelete(null); }} style={styles.iconButton}>
                  <FontAwesome name="check" size={16} color={errorColor} />
                </Pressable>
              ) : (
                <Pressable onPress={() => setAttributeToDelete(f.key)} style={styles.iconButton}>
                  <FontAwesome name="trash-o" size={16} color={theme.text} style={{ opacity: 0.3 }} />
                </Pressable>
              )}
            </View>
          )}


        </View>
        <View style={[styles.separator, { backgroundColor: 'transparent' }]} />
      </ScaleDecorator>
    );
  };

  const renderFooter = (item: FooterItem) => {
    const isAdding = activeAddGroup === item.group;
    return (
      <View style={[styles.footerContainer, { backgroundColor: theme.cardBackground }]}>
        {isAdding ? (
          <View style={[styles.row, styles.addAttributeRow, { borderTopColor: borderColor }]}>
            <TextInput
              value={newKey}
              onChangeText={setNewKey}
              placeholder="Attribute"
              placeholderTextColor={placeholderColor}
              style={[styles.smallInput, { color: theme.text, flex: 1, marginRight: 12 }]}
              autoCapitalize="words"
              autoFocus
            />
            <TextInput
              value={newValue}
              onChangeText={setNewValue}
              placeholder="Value"
              placeholderTextColor={placeholderColor}
              style={[styles.smallInput, { color: theme.text, flex: 1, marginRight: 12 }]}
              onSubmitEditing={() => saveToGroup(item.group)}
            />
            <Pressable onPress={() => saveToGroup(item.group)} style={[styles.actionButton, { backgroundColor: theme.tint }]}>
              <FontAwesome name="check" size={12} color="#fff" />
            </Pressable>
            <Pressable onPress={resetAddState} style={[styles.actionButton, { backgroundColor: 'transparent', marginLeft: 4 }]}>
              <FontAwesome name="close" size={12} color={theme.text} style={{ opacity: 0.5 }} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setActiveAddGroup(item.group)}
            style={styles.addItemButton}
          >
            <Text style={[styles.addItemText, { color: theme.tint }]}>+ Add Item</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={() => setFocusedAttribute(null)}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <DraggableFlatList
          data={data}
          onDragEnd={onDragEnd}
          keyExtractor={keyExtractor}
          containerStyle={{ flex: 1 }}
          // @ts-ignore
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          renderItem={(params) => {
            const { item } = params;
            if (item.type === 'header') return renderHeader(item);
            if (item.type === 'field') return renderField(params as RenderItemParams<FieldItem>);
            if (item.type === 'footer') return renderFooter(item);
            if (item.type === 'placeholder') return <Pressable onPress={() => setFocusedAttribute(null)} style={{ height: 100, flex: 1 }} />;
            return null;
          }}
        />

        {/* Add new Group Button (Floating or at bottom?) 
           Since DraggableFlatList takes full space, we can put this outside.
           Or adds as a footer to the whole list.
           Let's put it at the bottom.
       */}
        {!creatingGroup && (
          <View style={styles.floatingBtnContainer}>
            <Pressable
              onPress={() => { setCreatingGroup(true); resetAddState(); }}
              style={[styles.newGroupBtn, { backgroundColor: theme.tint }]}
            >
              <FontAwesome name="plus" size={16} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Modal/Overlay for New Group? Or just render it in list? 
           For complexity, let's use a simple overlay or just conditional render at bottom 
           if we didn't use DraggableFlatlist. 
           With DraggableFlatList, it's easier to use a modal or overlay.
           Let's use a simple absolute view for "New Group" creation form.
       */}
        {creatingGroup && (
          <View style={[styles.newGroupOverlay, { backgroundColor: theme.background, borderColor: theme.tint }]}>
            <Text style={[styles.label, { marginBottom: 12 }]}>New Group</Text>
            <TextInput
              value={newGroupTempName}
              onChangeText={setNewGroupTempName}
              placeholder="GROUP NAME"
              placeholderTextColor={placeholderColor}
              style={[styles.headerInput, { color: theme.text, marginBottom: 16, width: '100%' }]}
              autoFocus
            />
            <View style={styles.row}>
              <TextInput value={newKey} onChangeText={setNewKey} placeholder="Attr" placeholderTextColor={placeholderColor} style={[styles.smallInput, { color: theme.text, flex: 1, marginRight: 8 }]} />
              <TextInput value={newValue} onChangeText={setNewValue} placeholder="Value" placeholderTextColor={placeholderColor} style={[styles.smallInput, { color: theme.text, flex: 1 }]} />
            </View>
            <View style={[styles.row, { marginTop: 16, justifyContent: 'flex-end', paddingVertical: 0 }]}>
              <Pressable onPress={() => setCreatingGroup(false)} style={{ marginRight: 16 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateGroup} style={[styles.deleteConfirmBtn, { backgroundColor: theme.tint }]}>
                <Text style={styles.deleteBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  headerWrapper: {
    marginTop: 24,
    marginBottom: 8,
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
  headerRow: {
    flexDirection: 'row', alignItems: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  footerContainer: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    marginBottom: 0
  },
  // We need to handle the visual rounding manually or via styles
  // Since we have separators and such.
  // Actually, easiest is: 
  // Header -> No bg
  // Field -> Bg, sharp corners (unless first?)
  // Footer -> Bg, bottom rounded.
  // We need "first item" rounding. 
  // But RenderItem doesn't easily know "am I first in group?".
  // We can just rely on the fact headers are separators, and we can make fields have consistent look.
  // Or, we can make the Header include the top rounding of the card?
  // No, header is separate.
  // Let's just make all fields square and the footer rounded?
  // Or: ScaleDecorator might mess with borders.

  labelContainer: {
    width: 100,
    marginRight: 12,
    paddingTop: 4,
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
    marginLeft: 16, // Indent separator
  },
  rowActions: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
  },

  // Footer / Add Item
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

  // Delete Group
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

  // Floating Btn
  floatingBtnContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  newGroupBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newGroupOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  }
});
