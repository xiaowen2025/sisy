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
  Alert,
} from 'react-native';
import { useSegments } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppState } from '@/lib/appState';
import type { TabId, ChatMessage } from '@/lib/types';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TypingIndicator({ color }: { color: string }) {
  // Simple "..." animation could be done with reanimated, but for now static or simple pulse
  // Let's use a simple text for MVP speed, user can request animation later if strictly needed.
  return (
    <View style={styles.typingContainer}>
      <Text style={[styles.typingText, { color }]}>•••</Text>
    </View>
  );
}

function SuggestionChips({ onSelect, theme }: { onSelect: (text: string) => void; theme: any }) {
  const chips = [
    'Review my day',
    'Add a task',
    'Start a routine',
  ];

  return (
    <View style={styles.chipsContainer}>
      {chips.map((chip) => (
        <Pressable
          key={chip}
          onPress={() => onSelect(chip)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: theme.tint, opacity: pressed ? 0.8 : 0.15 },
          ]}>
          <Text style={[styles.chipText, { color: theme.tint }]}>{chip}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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

  const { chat, sendChat, isTyping } = useAppState();
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

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleLongPress = async (content?: string) => {
    if (!content) return;
    await Clipboard.setStringAsync(content);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Copied', 'Text copied to clipboard');
  };

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
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 4,
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
              <Ionicons name="arrow-up" size={20} color="#fff" />
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
        <View style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            style={{ flex: 1 }}>
            <View style={[styles.modalOverlay, Platform.OS === 'web' && styles.webOverlay]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

              <View
                style={[
                  styles.drawer,
                  Platform.OS === 'web' && styles.webDrawer,
                  { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) },
                ]}>
                <View style={[styles.drawerHeader, { borderBottomColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.drawerTitle, { color: theme.text }]}>Chat</Text>
                  <Pressable
                    onPress={handleClose}
                    style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
                    hitSlop={12}>
                    <View style={[styles.closeIconContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <Ionicons name="close" size={20} color={theme.text} />
                    </View>
                  </Pressable>
                </View>

                <View style={styles.drawerBody}>
                  {chat.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
                      <Ionicons name="chatbubbles-outline" size={48} color={theme.text} style={{ marginBottom: 16 }} />
                      <Text style={{ color: theme.text, fontSize: 16, marginBottom: 24 }}>
                        How can I help you today?
                      </Text>
                      <SuggestionChips onSelect={(t) => setText(t)} theme={theme} />
                    </View>
                  ) : (
                    <FlatList
                      data={reversedChat}
                      inverted
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.history}
                      showsVerticalScrollIndicator={false}
                      ListHeaderComponent={
                        isTyping ? (
                          <View style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                            <TypingIndicator color={theme.text} />
                          </View>
                        ) : null
                      }
                      renderItem={({ item: m, index }: { item: ChatMessage; index: number }) => {
                        const isUser = m.role === 'user';
                        // Check timestamp with *next* item (which is older in reversed list)
                        const nextMsg = reversedChat[index + 1];
                        let showTimestamp = false;
                        if (!nextMsg) {
                          showTimestamp = true;
                        } else {
                          const currTime = new Date(m.created_at || 0).getTime();
                          const prevTime = new Date(nextMsg.created_at || 0).getTime();
                          if (currTime - prevTime > 30 * 60 * 1000) {
                            showTimestamp = true;
                          }
                        }

                        return (
                          <View>
                            {showTimestamp && (
                              <View style={styles.timestampContainer}>
                                <Text style={[styles.timestampText, { color: theme.text }]}>
                                  {formatTimestamp(m.created_at || new Date().toISOString())}
                                </Text>
                              </View>
                            )}
                            <Pressable
                              onLongPress={() => m.text && handleLongPress(m.text)}
                              delayLongPress={500}
                              style={[
                                styles.bubble,
                                isUser ? styles.userBubble : styles.assistantBubble,
                                {
                                  backgroundColor: isUser
                                    ? theme.tint
                                    : colorScheme === 'dark'
                                      ? '#1C1C1E'
                                      : '#F2F2F7',
                                },
                              ]}>
                              {m.imageUri && (
                                <Image
                                  source={{ uri: m.imageUri }}
                                  style={{
                                    width: 200,
                                    height: 200,
                                    borderRadius: 12,
                                    marginBottom: 8,
                                  }}
                                  resizeMode="cover"
                                />
                              )}
                              {m.text ? (
                                <Markdown
                                  style={{
                                    body: {
                                      color: isUser ? '#fff' : theme.text,
                                      fontSize: 16,
                                      lineHeight: 24,
                                    },
                                    link: {
                                      color: isUser ? '#fff' : theme.tint,
                                      textDecorationLine: 'underline',
                                    }
                                  }}>
                                  {m.text}
                                </Markdown>
                              ) : null}
                            </Pressable>
                          </View>
                        );
                      }}
                    />
                  )}
                </View>

                {/* Image Preview */}
                {image && (
                  <View style={styles.imagePreview}>
                    <Image
                      source={{ uri: image }}
                      style={{ width: 60, height: 60, borderRadius: 8 }}
                    />
                    <Pressable onPress={() => setImage(null)} style={styles.removeImage}>
                      <Ionicons name="close-circle" size={22} color={theme.text} />
                    </Pressable>
                  </View>
                )}

                <View
                  style={[
                    styles.drawerComposer,
                    {
                      borderTopColor:
                        colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      marginBottom: Platform.OS === 'android' ? 10 : 0
                    },
                  ]}>
                  <Pressable onPress={pickImage} style={styles.iconButton}>
                    <Ionicons
                      name="image-outline"
                      size={24}
                      color={theme.tint}
                    />
                  </Pressable>

                  <View style={[styles.inputContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder="Message..."
                      placeholderTextColor={
                        colorScheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'
                      }
                      style={[styles.drawerInput, { color: theme.text }]}
                      returnKeyType="send"
                      onSubmitEditing={onSend}
                      multiline
                    />
                  </View>

                  <Pressable
                    onPress={onSend}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      { opacity: pressed || (!text.trim() && !image) ? 0.5 : 1, backgroundColor: theme.tint },
                    ]}
                    disabled={!text.trim() && !image}
                  >
                    <Ionicons name="arrow-up" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View >
      </Modal >
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24, // Pill shape
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  send: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
  },
  drawer: {
    flex: 1,
    // paddingTop calculated dynamically
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  drawerHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    // padding: 4,
  },
  closeIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  history: {
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  drawerComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align bottom for multiline
    gap: 12,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16, // Extra padding for Android
    borderTopWidth: 1,
  },
  iconButton: {
    padding: 8,
    marginBottom: 4,
  },
  inputContainer: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8, // Internal padding
    minHeight: 40,
    justifyContent: 'center',
  },
  drawerInput: {
    fontSize: 16,
    maxHeight: 100,
    paddingTop: 0, // Reset
    paddingBottom: 0, // Reset
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2, // Align with input
  },
  imagePreview: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  removeImage: {
    marginLeft: -10,
    marginTop: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webOverlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  webDrawer: {
    flex: 0,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderRadius: 24,
    maxHeight: '85%',
    minHeight: 500,
    zIndex: 10,
  },
  typingContainer: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 8,
  },
  typingText: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestampContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  timestampText: {
    fontSize: 12,
    opacity: 0.5,
  },
});

