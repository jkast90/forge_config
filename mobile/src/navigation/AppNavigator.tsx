import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DevicesHubScreen } from '../screens/DevicesHubScreen';
import { VendorsScreen } from '../screens/VendorsScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';
import { DhcpOptionsScreen } from '../screens/DhcpOptionsScreen';
import { DeviceFormScreen } from '../screens/DeviceFormScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { TemplatizerScreen } from '../screens/TemplatizerScreen';
import { IpamScreen } from '../screens/IpamScreen';
import { LocationsScreen } from '../screens/LocationsScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { VariablesScreen } from '../screens/VariablesScreen';
import { InspectorScreen } from '../screens/InspectorScreen';
import { DeviceModelsScreen } from '../screens/DeviceModelsScreen';
import { TopologiesScreen } from '../screens/TopologiesScreen';
import { ActionsScreen } from '../screens/ActionsScreen';
import { JobsScreen } from '../screens/JobsScreen';
import { DataExplorerScreen } from '../screens/DataExplorerScreen';
import { CredentialsScreen } from '../screens/CredentialsScreen';
import { useAuth } from '../core';
import { LoginScreen } from '../screens/LoginScreen';
import { useAppTheme } from '../context';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgCard,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DevicesTab"
        component={DevicesHubScreen}
        options={{
          title: 'Devices',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="devices" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TemplatesTab"
        component={TemplatesScreen}
        options={{
          title: 'Templates',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="description" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ConfigTab"
        component={ConfigStack}
        options={{
          title: 'Config',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="tune" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Config Stack for Vendors, DHCP Options, and Settings
const ConfigStackNav = createNativeStackNavigator();

function ConfigStack() {
  const { colors } = useAppTheme();

  return (
    <ConfigStackNav.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgCard,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <ConfigStackNav.Screen
        name="ConfigMenu"
        component={ConfigMenuScreen}
        options={{ title: 'Configuration' }}
      />
      <ConfigStackNav.Screen
        name="Vendors"
        component={VendorsScreen}
        options={{ title: 'Vendors' }}
      />
      <ConfigStackNav.Screen
        name="DhcpOptions"
        component={DhcpOptionsScreen}
        options={{ title: 'DHCP Options' }}
      />
      <ConfigStackNav.Screen
        name="SettingsConfig"
        component={SettingsScreen}
        options={{ title: 'Server Settings' }}
      />
      <ConfigStackNav.Screen
        name="DeviceModels"
        component={DeviceModelsScreen}
        options={{ title: 'Device Models' }}
      />
      <ConfigStackNav.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ title: 'Groups' }}
      />
      <ConfigStackNav.Screen
        name="Variables"
        component={VariablesScreen}
        options={{ title: 'Variables' }}
      />
      <ConfigStackNav.Screen
        name="Inspector"
        component={InspectorScreen}
        options={{ title: 'Variable Inspector' }}
      />
      <ConfigStackNav.Screen
        name="Topologies"
        component={TopologiesScreen}
        options={{ title: 'Topologies' }}
      />
      <ConfigStackNav.Screen
        name="Actions"
        component={ActionsScreen}
        options={{ title: 'Actions' }}
      />
      <ConfigStackNav.Screen
        name="Jobs"
        component={JobsScreen}
        options={{ title: 'Jobs' }}
      />
      <ConfigStackNav.Screen
        name="Ipam"
        component={IpamScreen}
        options={{ title: 'IPAM' }}
      />
      <ConfigStackNav.Screen
        name="Locations"
        component={LocationsScreen}
        options={{ title: 'Locations' }}
      />
      <ConfigStackNav.Screen
        name="DataExplorer"
        component={DataExplorerScreen}
        options={{ title: 'Data Explorer' }}
      />
      <ConfigStackNav.Screen
        name="Credentials"
        component={CredentialsScreen}
        options={{ title: 'Credentials' }}
      />
    </ConfigStackNav.Navigator>
  );
}

// Config Menu Screen with Theme Selection
function ConfigMenuScreen() {
  const navigation = useNavigation();
  const { colors, theme, setTheme, themeOptions } = useAppTheme();

  const menuItems = [
    { title: 'Server Settings', subtitle: 'API connection and server config', icon: 'settings', screen: 'SettingsConfig' },
    { title: 'Vendors', subtitle: 'Manage vendor configurations', icon: 'business', screen: 'Vendors' },
    { title: 'DHCP Options', subtitle: 'Configure DHCP options', icon: 'lan', screen: 'DhcpOptions' },
    { title: 'Device Models', subtitle: 'Hardware models and port layouts', icon: 'memory', screen: 'DeviceModels' },
    { title: 'Topologies', subtitle: 'Network fabric topologies', icon: 'hub', screen: 'Topologies' },
    { title: 'Groups', subtitle: 'Device groups with variables', icon: 'group-work', screen: 'Groups' },
    { title: 'Variables', subtitle: 'Per-device variable keys', icon: 'vpn-key', screen: 'Variables' },
    { title: 'Inspector', subtitle: 'Resolve variables for a device', icon: 'search', screen: 'Inspector' },
    { title: 'IPAM', subtitle: 'IP address management', icon: 'account-tree', screen: 'Ipam' },
    { title: 'Locations', subtitle: 'Regions, campuses, datacenters', icon: 'location-city', screen: 'Locations' },
    { title: 'Actions', subtitle: 'Vendor quick commands', icon: 'play-arrow', screen: 'Actions' },
    { title: 'Credentials', subtitle: 'SSH and API key credentials', icon: 'vpn-key', screen: 'Credentials' },
    { title: 'Jobs', subtitle: 'View job history', icon: 'schedule', screen: 'Jobs' },
    { title: 'Data Explorer', subtitle: 'Inspect Redux store data', icon: 'storage', screen: 'DataExplorer' },
  ];

  const dynamicStyles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      padding: 16,
    },
    menuItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: `${colors.accentBlue}15`,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: 16,
    },
    menuTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textPrimary,
      marginBottom: 2,
    },
    menuSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 8,
    },
    themeOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 2,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.accentBlue,
      backgroundColor: `${colors.accentBlue}10`,
    },
    themeOptionText: {
      flex: 1,
    },
    themeOptionLabel: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: colors.textPrimary,
    },
    themeOptionDescription: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
  }), [colors]);

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {menuItems.map((item) => (
        <Pressable
          key={item.screen}
          style={dynamicStyles.menuItem}
          onPress={() => navigation.navigate(item.screen as never)}
        >
          <View style={dynamicStyles.iconContainer}>
            <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={24} color={colors.accentBlue} />
          </View>
          <View style={menuStyles.textContainer}>
            <Text style={dynamicStyles.menuTitle}>{item.title}</Text>
            <Text style={dynamicStyles.menuSubtitle}>{item.subtitle}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
        </Pressable>
      ))}

      <Text style={dynamicStyles.sectionTitle}>Appearance</Text>

      {themeOptions.map((option) => {
        const isActive = theme === option.value;
        // Map web icon names to React Native MaterialIcons names
        const iconName = option.value === 'dark' ? 'dark-mode' :
                        option.value === 'light' ? 'light-mode' :
                        'check-box-outline-blank';

        return (
          <Pressable
            key={option.value}
            style={[
              dynamicStyles.themeOption,
              isActive && dynamicStyles.themeOptionActive,
            ]}
            onPress={() => setTheme(option.value)}
          >
            <View style={[dynamicStyles.iconContainer, { marginRight: 12 }]}>
              <MaterialIcons
                name={iconName as keyof typeof MaterialIcons.glyphMap}
                size={22}
                color={isActive ? colors.accentBlue : colors.textMuted}
              />
            </View>
            <View style={dynamicStyles.themeOptionText}>
              <Text style={dynamicStyles.themeOptionLabel}>{option.label}</Text>
              <Text style={dynamicStyles.themeOptionDescription}>{option.description}</Text>
            </View>
            {isActive && (
              <MaterialIcons name="check-circle" size={24} color={colors.accentBlue} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const menuStyles = StyleSheet.create({
  textContainer: {
    flex: 1,
  },
});

export function AppNavigator() {
  const { colors } = useAppTheme();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const navigationTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.accentBlue,
      background: colors.bgPrimary,
      card: colors.bgCard,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accentBlue,
    },
  }), [colors]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer key={isAuthenticated ? 'auth' : 'unauth'} theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.bgCard,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: colors.bgPrimary,
          },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeviceForm"
              component={DeviceFormScreen}
              options={{ title: 'Device' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              name="Scanner"
              component={ScannerScreen}
              options={{
                title: 'Scan Barcode',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="Templatizer"
              component={TemplatizerScreen}
              options={{
                title: 'Create Template from Config',
                presentation: 'modal',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
