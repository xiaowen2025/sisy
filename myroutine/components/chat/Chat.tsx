import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useSegments } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppState } from '@/lib/appState';
import type { TabId, ChatMessage } from '@/lib/types';

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
  const [image, setImage] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const justClosed = useRef(false);

  async function onSend() {
    const trimmed = text.trim();
    if (!trimmed && !image) return;

    // Clear state immediately to feel responsive
    const currentText = trimmed;
    const currentImage = image;
    setText('');
    setImage(null);

    await sendChat(tab, currentText, currentImage ?? undefined);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // base64: true, // we handle conversion in client if needed, or let client wrapper do it
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      // Ensure drawer is open or stays open
      setOpen(true);
    }
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

  // Reverse chat for inverted list (Newest first)
  const reversedChat = useMemo(() => [...chat].reverse(), [chat]);

  return (
    <>
      {!open && (
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
                borderColor:
                  colorScheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
              },
            ]}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder={placeholders[tab]}
              placeholderTextColor={
                colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
              }
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
      )}

      <Modal
        visible={open}
        transparent={true}
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        presentationStyle={Platform.OS === 'web' ? 'overFullScreen' : 'pageSheet'}
        onRequestClose={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <View style={[styles.modalOverlay, Platform.OS === 'web' && styles.webOverlay]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

            <View
              style={[
                styles.drawer,
                Platform.OS === 'web' && styles.webDrawer,
                { backgroundColor: theme.background },
              ]}>
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
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.text, opacity: 0.7 }}>
                      No messages yet. Tell me what you need.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={reversedChat}
                    inverted
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.history}
                    renderItem={({ item: m }: { item: ChatMessage }) => (
                      <View
                        style={[
                          styles.bubble,
                          m.role === 'user' ? styles.userBubble : styles.assistantBubble,
                          {
                            borderColor:
                              colorScheme === 'dark'
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(0,0,0,0.1)',
                            backgroundColor:
                              m.role === 'user'
                                ? theme.tint // User messages get tint color
                                : colorScheme === 'dark'
                                  ? '#2C2C2E'
                                  : '#F2F2F7', // Assistant gets gray
                          },
                        ]}>
                        {m.imageUri && (
                          <Image
                            source={{ uri: m.imageUri }}
                            style={{
                              width: 200,
                              height: 200,
                              borderRadius: 8,
                              marginBottom: 8,
                            }}
                            resizeMode="cover"
                          />
                        )}
                        {m.text ? (
                          <Markdown
                            style={{
                              body: {
                                color: m.role === 'user' ? '#fff' : theme.text,
                                fontSize: 16,
                              },
                            }}>
                            {m.text}
                          </Markdown>
                        ) : null}
                      </View>
                    )}
                  />
                )}
              </View>

              {/* Image Preview */}
              {image && (
                <View style={styles.imagePreview}>
                  <Image
                    source={{ uri: image }}
                    style={{ width: 60, height: 60, borderRadius: 6 }}
                  />
                  <Pressable onPress={() => setImage(null)} style={styles.removeImage}>
                    <Ionicons name="close-circle" size={20} color={theme.text} />
                  </Pressable>
                </View>
              )}

              <View
                style={[
                  styles.drawerComposer,
                  {
                    borderTopColor:
                      colorScheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)',
                  },
                ]}>
                <Pressable onPress={pickImage} style={{ padding: 10 }}>
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={theme.text}
                    style={{ opacity: 0.7 }}
                  />
                </Pressable>

                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Message…"
                  placeholderTextColor={
                    colorScheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'
                  }
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
        </KeyboardAvoidingView>
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
    paddingTop: 16,
    gap: 12,
  },
  bubble: {
    borderRadius: 18, // Slightly rounder for modern look
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4, // subtle differentiation
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  drawerComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
  },
  drawerInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  imagePreview: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  removeImage: {
    marginLeft: -10,
    marginTop: -10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
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
    overflow: 'hidden', // Contain children
  },
});

