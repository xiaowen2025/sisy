
import { Alert, Platform } from 'react-native';

export const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
    destructive = true
) => {
    if (Platform.OS === 'web') {
        // Web strict confirmation - deferred to avoid event conflicts
        setTimeout(() => {
            if (window.confirm(`${title}\n\n${message}`)) {
                onConfirm();
            }
        }, 50);
    } else {
        // Native Alert
        Alert.alert(
            title,
            message,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: destructive ? 'Delete' : 'OK',
                    style: destructive ? 'destructive' : 'default',
                    onPress: onConfirm
                },
            ]
        );
    }
};
