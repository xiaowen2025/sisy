import React from 'react';
import { TextInput, Platform, View, StyleSheet } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

interface TimePickerProps {
    value?: string; // "HH:MM"
    onChange: (time: string) => void;
}

export function TimePicker({ value = "07:00", onChange }: TimePickerProps) {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const isDark = colorScheme === 'dark';

    // React Native Web: using native input for proper time picker support
    if (Platform.OS === 'web') {
        return (
            <View style={styles.container}>
                {/* @ts-ignore - React Native types don't know about native web elements */}
                <input
                    type="time"
                    style={{
                        fontSize: 16,
                        padding: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        minWidth: 100,
                        color: theme.text,
                        backgroundColor: isDark ? '#2c2c2e' : '#f9f9f9',
                        borderColor: isDark ? '#333' : '#eee',
                        borderStyle: 'solid',
                        outline: 'none'
                    }}
                    value={value}
                    onChange={(e: any) => onChange(e.target.value)}
                />
            </View>
        );
    }

    // Native Fallback (since we don't have datetimepicker installed)
    return (
        <View style={styles.container}>
            <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: isDark ? '#2c2c2e' : '#f9f9f9', borderColor: isDark ? '#333' : '#eee' }]}
                value={value}
                onChangeText={onChange}
                placeholder="HH:MM"
                placeholderTextColor="#999"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        // minWidth: 100,
    },
    input: {
        fontSize: 16,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        minWidth: 100,
    }
});
