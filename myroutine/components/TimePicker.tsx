import React, { useRef, useEffect, useState } from 'react';
import { TextInput, Platform, View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Text } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface TimePickerProps {
    value?: string; // "HH:MM"
    onChange: (time: string) => void;
}

// Generate arrays for hours and minutes
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

export function TimePicker({ value = "07:00", onChange }: TimePickerProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const isDark = colorScheme === 'dark';

    const [showPicker, setShowPicker] = useState(false);
    const [hour, minute] = value.split(':');
    const [tempHour, setTempHour] = useState(hour || '07');
    const [tempMinute, setTempMinute] = useState(minute || '00');

    useEffect(() => {
        if (showPicker) {
            const [h, m] = value.split(':');
            setTempHour(h || '07');
            setTempMinute(m || '00');
        }
    }, [showPicker, value]);

    const handleConfirm = () => {
        onChange(`${tempHour}:${tempMinute}`);
        setShowPicker(false);
    };

    // Modern wheel picker (works on all platforms)
    return (
        <View style={styles.container}>
            <Pressable
                onPress={() => setShowPicker(true)}
                style={[styles.triggerButton, {
                    backgroundColor: isDark ? '#2c2c2e' : '#f9f9f9',
                    borderColor: isDark ? '#333' : '#eee'
                }]}
            >
                <Text style={[styles.triggerText, { color: theme.text }]}>{value}</Text>
            </Pressable>

            <Modal
                visible={showPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPicker(false)}
            >
                <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
                    <Pressable
                        style={[styles.pickerContainer, { backgroundColor: theme.background }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <View style={styles.wheelContainer}>
                            <WheelColumn
                                items={HOURS}
                                value={tempHour}
                                onChange={setTempHour}
                                theme={theme}
                                isDark={isDark}
                            />
                            <Text style={[styles.separator, { color: theme.text }]}>:</Text>
                            <WheelColumn
                                items={MINUTES}
                                value={tempMinute}
                                onChange={setTempMinute}
                                theme={theme}
                                isDark={isDark}
                            />
                        </View>

                        <View style={styles.pickerFooter}>
                            <Pressable onPress={() => setShowPicker(false)} style={styles.footerButton}>
                                <FontAwesome name="times" size={22} color="#ff3b30" />
                            </Pressable>
                            <Pressable onPress={handleConfirm} style={styles.footerButton}>
                                <FontAwesome name="check" size={22} color={theme.tint} />
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

interface WheelColumnProps {
    items: string[];
    value: string;
    onChange: (value: string) => void;
    theme: typeof Colors.light;
    isDark: boolean;
}

function WheelColumn({ items, value, onChange, theme, isDark }: WheelColumnProps) {
    const scrollViewRef = useRef<ScrollView>(null);
    const currentIndex = items.indexOf(value) !== -1 ? items.indexOf(value) : 0;
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        // Scroll to the current value on mount
        if (scrollViewRef.current && !isScrollingRef.current) {
            const offset = currentIndex * ITEM_HEIGHT;
            scrollViewRef.current.scrollTo({ y: offset, animated: false });
        }
    }, []);

    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);

        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        scrollTimeoutRef.current = setTimeout(() => {
            if (index >= 0 && index < items.length && items[index] !== value) {
                onChange(items[index]);
            }
            // Snap to position
            if (scrollViewRef.current) {
                const snappedOffset = index * ITEM_HEIGHT;
                scrollViewRef.current.scrollTo({ y: snappedOffset, animated: true });
            }
        }, 100);
    };

    const handleItemPress = (item: string, index: number) => {
        onChange(item);
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
        }
    };

    return (
        <View style={styles.wheelColumn}>
            {/* Selection highlight */}
            <View style={[styles.selectionHighlight, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            }]} />

            <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
                }}
            >
                {items.map((item, index) => {
                    const isSelected = item === value;
                    return (
                        <Pressable
                            key={item}
                            onPress={() => handleItemPress(item, index)}
                            style={styles.wheelItem}
                        >
                            <Text style={[
                                styles.wheelItemText,
                                { color: theme.text },
                                isSelected && styles.wheelItemTextSelected,
                                isSelected && { color: theme.tint },
                            ]}>
                                {item}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {},
    input: {
        fontSize: 16,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 100,
    },
    triggerButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        minWidth: 90,
        alignItems: 'center',
    },
    triggerText: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        width: 280,
        borderRadius: 20,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            },
        }),
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.3)',
    },
    pickerFooter: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128,128,128,0.3)',
    },
    footerButton: {
        padding: 12,
        borderRadius: 12,
    },
    headerButton: {
        padding: 4,
        minWidth: 60,
    },
    headerButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    wheelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        paddingHorizontal: 20,
    },
    wheelColumn: {
        width: 80,
        height: ITEM_HEIGHT * VISIBLE_ITEMS,
        overflow: 'hidden',
        position: 'relative',
    },
    selectionHighlight: {
        position: 'absolute',
        top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
        left: 0,
        right: 0,
        height: ITEM_HEIGHT,
        borderRadius: 10,
        borderWidth: 1,
        zIndex: -1,
    },
    wheelItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    wheelItemText: {
        fontSize: 22,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        opacity: 0.4,
    },
    wheelItemTextSelected: {
        fontWeight: '700',
        opacity: 1,
    },
    separator: {
        fontSize: 28,
        fontWeight: '700',
        marginHorizontal: 8,
    },
});
