// Initialize services configuration before anything else
import './src/setup';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AppNavigator } from './src/navigation';
import { ThemeProvider, useAppTheme } from './src/context';
import { store, useAuthState, AuthProvider } from './src/core';

function AppContent() {
  const { theme } = useAppTheme();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

function AuthGate() {
  const auth = useAuthState();
  return (
    <AuthProvider value={auth}>
      <AppContent />
    </AuthProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
