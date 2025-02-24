import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useColorScheme } from '@/hooks/useColorScheme';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colorScheme === 'dark' ? '#1f1f1f' : '#f5f5f5',
          borderTopWidth: 0,
          height: 70,
          paddingBottom: 10,
          elevation: 10,
          shadowColor: colorScheme === 'dark' ? '#000' : '#aaa',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={35} color={color} />,
        }}
      />
      <Tabs.Screen
        name="panier"
        options={{
          title: 'Panier',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cart" size={35} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tournee"
        options={{
          title: 'Tournée',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="flag" size={35} color={color} />,
        }}
      />
      <Tabs.Screen
        name="depot"
        options={{
          title: 'Depot',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="warehouse" size={35} color={color} />,
        }}
      />
      {/* Vérifie que les noms ici correspondent à ceux des fichiers */}
      <Tabs.Screen
        name="QRCodeScreen" // Assure-toi que le nom est correct
        options={{
          title: 'QRCode',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="qrcode" size={35} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ScannerScreen" // Assure-toi que le nom est correct
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="barcode-scan" size={35} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarIcon: {
    fontSize: 35,
    marginTop: 5,
  },
});
