import React, { useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSegments } from 'expo-router';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppState } from '@/lib/appState';
import type { TabId } from '@/lib/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

function tabFromSegments(segments: string[]): TabId {
  // Typical: ['(tabs)', 'index'] etc.
  const leaf = segments[segments.length - 1] ?? 'index';
  if (leaf === 'routine') return 'routine';
  if (leaf === 'me') return 'me';
  return 'home';
}

export function Chat({ bottomOffset = 64 }: { bottomOffset?: number }) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const segments = useSegments();
  const tab = useMemo(() => tabFromSegments(segments), [segments]);
  const insets = useSafeAreaInsets();
  const bottom = bottomOffset + (Platform.OS === 'android' ? insets.bottom : 0);

  const { chat, sendChat } = useAppState();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput | null>(null);
  const justClosed = useRef(false);

  async function onSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await sendChat(tab, trimmed);
  }

  function handleClose() {
    justClosed.current = true;
    inputRef.current?.blur();
    setOpen(false);
    setTimeout(() => {
      justClosed.current = false;
    }, 500);
  }

  const placeholders: Record<TabId, string> = {
    home: 'How is it going?',
    routine: 'Want to adjust anything?',
    me: 'Update profile?',
  };

  return (
    <>
      <View pointerEvents="box-none" style={[styles.overlay, { bottom }]}>
        <Pressable
          onPress={() => {
            setOpen(true);
            // Small delay helps web focus after modal paint.
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          style={[
            styles.bar,
            {
              backgroundColor: theme.background,
              borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            },
          ]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholders[tab]}
            placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'}
            onFocus={() => {
              if (justClosed.current) return;
              setOpen(true);
            }}
            style={[styles.input, { color: theme.text }]}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={onSend}
            style={({ pressed }) => [
              styles.send,
              {
                opacity: pressed ? 0.6 : 1,
                backgroundColor: theme.tint,
              },
            ]}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent={true}
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        presentationStyle={Platform.OS === 'web' ? 'overFullScreen' : 'pageSheet'}
        onRequestClose={handleClose}>
        <View style={[styles.modalOverlay, Platform.OS === 'web' && styles.webOverlay]}>
          {/* Backdrop click to close (Web/Android mainly) */}
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <View style={[styles.drawer, Platform.OS === 'web' && styles.webDrawer, { backgroundColor: theme.background }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: theme.text }]}>Chat</Text>
              <Pressable
                onPress={handleClose}
                style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
                hitSlop={12}>
                <Text style={{ color: theme.tint, fontWeight: '600' }}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.drawerBody}>
              {chat.length === 0 ? (
                <Text style={{ color: theme.text, opacity: 0.7 }}>
                  No messages yet. Tell me what you need.
                </Text>
              ) : (
                <View style={styles.history}>
                  {chat.slice(-50).map((m) => (
                    <View
                      key={m.id}
                      style={[
                        styles.bubble,
                        m.role === 'user' ? styles.userBubble : styles.assistantBubble,
                        {
                          borderColor:
                            colorScheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
                        },
                      ]}>
                      <Text style={{ color: theme.text, opacity: m.role === 'assistant' ? 0.9 : 1 }}>
                        {m.text}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View
              style={[
                styles.drawerComposer,
                {
                  borderTopColor:
                    colorScheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
                },
              ]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message…"
                placeholderTextColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'}
                style={[styles.drawerInput, { color: theme.text }]}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />
              <Pressable
                onPress={onSend}
                style={({ pressed }) => [
                  styles.send,
                  { opacity: pressed ? 0.6 : 1, backgroundColor: theme.tint },
                ]}>
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 6,
  },
  send: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
  },
  drawer: {
    flex: 1,
    paddingTop: 14,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 8,
  },
  drawerBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  history: {
    gap: 10,
  },
  bubble: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    opacity: 0.95,
  },
  drawerComposer: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end', // Bottom sheet style
  },
  webOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)', // Dimmed backdrop for web
    justifyContent: 'center',
    padding: 20, // Add padding so drawer doesn't touch edges
  },
  webDrawer: {
    flex: 0,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderRadius: 12,
    maxHeight: '85%',
    minHeight: 400,
    zIndex: 10,
  },
});

