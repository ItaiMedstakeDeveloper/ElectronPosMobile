import { Alert, Platform } from 'react-native';

// Simple message alert (no choices). Uses the browser alert on web where RN's
// Alert renders nothing.
export function notify(message: string, title = 'Notice') {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined') window.alert(message);
  } else {
    Alert.alert(title, message);
  }
}

// Cross-platform confirm. React Native's Alert doesn't render buttons on web, so
// fall back to the browser's native confirm there.
export function confirmAction(message: string, onConfirm: () => void, title = 'Confirm') {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  }
}
