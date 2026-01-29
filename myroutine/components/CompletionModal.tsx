import { Modal, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useState } from 'react';

type Props = {
    visible: boolean;
    onClose: () => void; // Called on Skip or Cancel
    onSubmit: (text: string) => void; // Called on "Done"
};

export function CompletionModal({ visible, onClose, onSubmit }: Props) {
    const [text, setText] = useState('');
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const handleSubmit = () => {
        onSubmit(text);
        setText(''); // Reset for next time
    };

    const handleSkip = () => {
        onClose();
        setText('');
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={handleSkip}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}>
                <Pressable style={styles.centeredView} onPress={onClose}>
                    <Pressable
                        style={[styles.modalView, { backgroundColor: theme.background, borderColor: theme.text }]}
                        onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.title}>How is it going?</Text>

                        <TextInput
                            style={[styles.input, { color: theme.text, borderColor: '#ccc' }]}
                            multiline
                            placeholder="..."
                            placeholderTextColor="#999"
                            value={text}
                            onChangeText={setText}
                            autoFocus
                        />

                        <View style={styles.actions}>
                            <Pressable onPress={handleSkip} style={styles.btn}>
                                <Text style={{ color: '#999', fontSize: 14 }}>Skip</Text>
                            </Pressable>
                            <Pressable onPress={handleSubmit} style={[styles.btn, styles.primaryBtn, { backgroundColor: theme.tint }]}>
                                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Done</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)', // Lighter overlay
    },
    modalView: {
        width: '80%', // Smaller
        maxWidth: 340,
        borderWidth: 1,
        borderRadius: 16,
        padding: 20, // Reduced padding
        alignItems: 'flex-start',
        elevation: 0, // Flat
    },
    title: {
        fontSize: 20, // Smaller title
        fontWeight: 'bold',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.7,
        marginBottom: 16,
    },
    input: {
        width: '100%',
        minHeight: 60, // Smaller input
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        marginBottom: 16, // Reduced margin
        textAlignVertical: 'top',
    },
    actions: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        alignItems: 'center',
    },
    btn: {
        padding: 8,
    },
    primaryBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
});
