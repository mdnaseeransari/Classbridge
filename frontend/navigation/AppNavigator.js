import React, { useContext } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AuthContext } from '../context/AuthContext';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import AdminLoginScreen from '../screens/auth/AdminLoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';
import ForgotRequestScreen from '../screens/auth/ForgotRequestScreen';

// Main User Screens
import HomeScreen from '../screens/main/HomeScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UserListScreen from '../screens/admin/UserListScreen';
import PendingApprovalsScreen from '../screens/admin/PendingApprovalsScreen';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import AdminLogsScreen from '../screens/admin/AdminLogsScreen';
import CreateAdminScreen from '../screens/admin/CreateAdminScreen';
import PromoteToAdminScreen from '../screens/admin/PromoteToAdminScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminReportDetailScreen from '../screens/admin/AdminReportDetailScreen';
import AdminResetRequestsScreen from '../screens/admin/AdminResetRequestsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Unauthenticated Auth Stack Navigator
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotRequest" component={ForgotRequestScreen} />
    </Stack.Navigator>
  );
}

// Approved User Navigation (Teacher / Student)
const UserStack = createNativeStackNavigator();
import ChatInboxScreen from '../screens/chat/ChatInboxScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import NewChatSelectionScreen from '../screens/chat/NewChatSelectionScreen';
import CreateGroupScreen from '../screens/chat/CreateGroupScreen';
import GroupSettingsScreen from '../screens/chat/GroupSettingsScreen';
import GroupMemberListScreen from '../screens/chat/GroupMemberListScreen';
import JoinGroupScreen from '../screens/chat/JoinGroupScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

function UserStackNavigator() {
  return (
    <UserStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#17212b' } }}>
      <UserStack.Screen name="Home" component={ChatInboxScreen} />
      <UserStack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <UserStack.Screen name="NewChatSelection" component={NewChatSelectionScreen} />
      <UserStack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <UserStack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <UserStack.Screen name="GroupMemberList" component={GroupMemberListScreen} />
      <UserStack.Screen name="JoinGroup" component={JoinGroupScreen} />
      <UserStack.Screen name="Settings" component={SettingsScreen} />
    </UserStack.Navigator>
  );
}

function UserTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1e293b', height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="home" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatInboxScreen}
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Admin Navigation (Admin / Super Admin)
function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1e293b', height: 60, paddingBottom: 8, paddingTop: 6 },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatInboxScreen}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble" size={20} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={20} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AdminStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="AdminTabs" component={AdminTabNavigator} />
      <Stack.Screen name="UserList" component={UserListScreen} />
      <Stack.Screen name="PendingApprovals" component={PendingApprovalsScreen} />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} />
      <Stack.Screen name="AdminLogs" component={AdminLogsScreen} />
      <Stack.Screen name="CreateAdmin" component={CreateAdminScreen} />
      <Stack.Screen name="PromoteToAdmin" component={PromoteToAdminScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="NewChatSelection" component={NewChatSelectionScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
      <Stack.Screen name="GroupMemberList" component={GroupMemberListScreen} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
      <Stack.Screen name="AdminReports" component={AdminReportsScreen} />
      <Stack.Screen name="AdminReportDetail" component={AdminReportDetailScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="AdminResetRequests" component={AdminResetRequestsScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { token, user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  // 1. Not logged in -> Show Auth Stack
  if (!token || !user) {
    return <AuthStack />;
  }

  // 2. Pending approval -> Lock to Pending Approval Screen
  if (user.status === 'pending') {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} />
      </Stack.Navigator>
    );
  }

  // 3. Admin / Super Admin -> Show Admin Stack
  if (['admin', 'superadmin'].includes(user.role)) {
    return <AdminStackNavigator />;
  }

  // 4. Approved Teacher / Student -> Show User Navigation Stack
  return <UserStackNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
