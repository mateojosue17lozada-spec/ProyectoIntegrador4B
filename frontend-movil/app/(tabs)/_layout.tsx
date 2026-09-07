import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const esPaciente = user?.rol === 'Paciente';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: (colorScheme === 'dark' ? Colors.dark : Colors.light).tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e0ece9',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: esPaciente ? 'Inicio' : 'Reportes',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name={esPaciente ? 'house.fill' : 'chart.bar.fill'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="citas"
        options={{
          title: esPaciente ? 'Mis Citas' : 'Citas',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pacientes"
        options={{
          href: null,
          title: 'Pacientes',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: esPaciente ? 'Mi Perfil' : 'Perfil',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.crop.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
          title: 'Oculto',
        }}
      />
    </Tabs>
  );
}
