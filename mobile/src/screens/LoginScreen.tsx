import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useAuth, checkApiHealth } from '../core';
import { useAppTheme } from '../context';
import { getApiUrl, setApiUrl } from '../setup';
import { ScanButton } from '../components/ScanButton';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
type LoginRouteProp = RouteProp<RootStackParamList, 'Login'>;

export function LoginScreen() {
  const { colors } = useAppTheme();
  const { login, loading, error } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LoginRouteProp>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrlState] = useState('');
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const testConnection = useCallback(async (url: string) => {
    setChecking(true);
    const reachable = await checkApiHealth(url);
    setApiReachable(reachable);
    setChecking(false);
  }, []);

  useEffect(() => {
    getApiUrl().then((url) => {
      setApiUrlState(url);
      testConnection(url);
    });
  }, [testConnection]);

  // Handle scanned URL coming back from ScannerScreen
  useEffect(() => {
    const scannedUrl = route.params?.scannedUrl;
    if (scannedUrl) {
      setApiUrlState(scannedUrl);
      setApiUrl(scannedUrl).then(() => testConnection(scannedUrl));
    }
  }, [route.params?.scannedUrl, testConnection]);

  const handleTestConnection = async () => {
    const cleanUrl = apiUrl.replace(/\/+$/, '');
    await setApiUrl(cleanUrl);
    setApiUrlState(cleanUrl);
    await testConnection(cleanUrl);
  };

  const handleLogin = async () => {
    try {
      await login({ username, password });
    } catch {
      // Error is handled by useAuth
    }
  };

  const handleScanPress = () => {
    navigation.navigate('Scanner', { returnTo: 'Login', field: 'url' });
  };

  const styles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center' as const,
      padding: 24,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      textAlign: 'center' as const,
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    input: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
    },
    inputStandalone: {
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    error: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: '#ef4444',
      fontSize: 14,
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    warningText: {
      color: '#f59e0b',
      fontSize: 14,
      textAlign: 'center' as const,
    },
    button: {
      backgroundColor: colors.accentBlue,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center' as const,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    changeUrlButton: {
      alignItems: 'center' as const,
      padding: 12,
      marginTop: 4,
    },
    changeUrlText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    checkingContainer: {
      alignItems: 'center' as const,
      padding: 24,
    },
    checkingText: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 12,
    },
    inputRow: {
      flexDirection: 'row' as const,
      gap: 8,
      marginBottom: 16,
    },
  }), [colors]);

  // Checking initial connection
  if (checking && apiReachable === null) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>ForgeConfig</Text>
          <View style={styles.checkingContainer}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
            <Text style={styles.checkingText}>Connecting to API server...</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // API unreachable - show URL config
  if (apiReachable === false) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>ForgeConfig</Text>

          <View style={styles.warning}>
            <Text style={styles.warningText}>
              Unable to reach the API server. Please check the URL below.
            </Text>
          </View>

          <Text style={styles.label}>API Server URL</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={setApiUrlState}
              placeholder="http://192.168.1.100:8080"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              autoFocus
            />
            <ScanButton onPress={handleScanPress} />
          </View>

          <Pressable
            style={[styles.button, (checking || !apiUrl) && styles.buttonDisabled]}
            onPress={handleTestConnection}
            disabled={checking || !apiUrl}
          >
            <Text style={styles.buttonText}>
              {checking ? 'Checking...' : 'Test Connection'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // API reachable - show login form
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>ForgeConfig</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.inputStandalone}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.inputStandalone}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={handleLogin}
        />

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.button, (loading || !username || !password) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading || !username || !password}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </Pressable>

        <Pressable style={styles.changeUrlButton} onPress={() => setApiReachable(false)}>
          <Text style={styles.changeUrlText}>Change API URL</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
