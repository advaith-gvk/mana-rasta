import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NAVY = '#002B5C';
const GOLD = '#F5A623';

function TabIcon({ focused, name }: { focused: boolean; name: string }) {
  const icons: Record<string, string> = {
    home:      '🏠',
    reports:   '📋',
    rewards:   '⭐',
    profile:   '👤',
  };
  return (
    <View style={styles.tabIcon}>
      <Text style={{ fontSize: 16 }}>{icons[name]}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E0E0E0',
          height: 58,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   NAVY,
        tabBarInactiveTintColor: '#aaa',
        tabBarLabelStyle: {
          fontSize: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home" />,
        }}
      />
      <Tabs.Screen
        name="my-reports"
        options={{
          title: 'My Reports',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="reports" />,
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="rewards" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="profile" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { alignItems: 'center', justifyContent: 'center' },
});
