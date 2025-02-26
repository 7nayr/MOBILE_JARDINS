import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import MapDepot from '../screens/MapDepot';
import QRCodeReader from '../screens/QRCodeReader';


const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            position: 'absolute',
            bottom: 10,
            left: 10,
            right: 10,
            borderRadius: 20,
            height: 70,
          },
          tabBarActiveTintColor: 'white',
          tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        }}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{
            title: "Accueil",
            tabBarIcon: ({ size }) => (
              <MaterialCommunityIcons name="home" color="white" size={size} />
            ),
          }}
        />

        <Tab.Screen 
          name="Depot" 
          component={MapDepot} 
          options={{
            title: "Dépôt",
            tabBarIcon: ({ size }) => (
              <MaterialCommunityIcons name="warehouse" color="white" size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="QRCodeReader"
          component={QRCodeReader}
          options={{
            title: "Scanner",
            tabBarIcon: ({ size }) => (
              <MaterialCommunityIcons name="qrcode-scan" color="white" size={size} />
            ),
          }}
        />

      </Tab.Navigator>
    </NavigationContainer>
  );
}
