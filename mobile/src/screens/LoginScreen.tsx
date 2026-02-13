import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../core';
import { useAppTheme } from '../context';

export function LoginScreen() {
  const { colors } = useAppTheme();
  const { login, loading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      await login({ username, password });
    } catch {
      // Error is handled by useAuth
    }
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
    button: {
      backgroundColor: colors.accentBlue,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center' as const,
      opacity: loading || !username || !password ? 0.5 : 1,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
  }), [colors, loading, username, password]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.title}>ZTP Manager</Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
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
          style={styles.input}
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
          style={styles.button}
          onPress={handleLogin}
          disabled={loading || !username || !password}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
