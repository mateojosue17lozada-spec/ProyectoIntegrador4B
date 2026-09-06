import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';

type DashboardData = {
  pacientes: number;
  citas_hoy: number;
  citas_pagadas: number;
  citas_pendientes: number;
  stock_bajo: number;
  atenciones_hoy: number;
  ventas_hoy?: number;
};

type Cita = {
  id_cita: number;
  hora_cita: string;
  profesional_nombre?: string;
  motivo?: string;
  estado: string;
  // from staff endpoint
  paciente_nombre?: string;
};

export default function HomeScreen() {
  const { token, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [proximas, setProximas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const citasEndpoint = user?.rol === 'Paciente' ? '/api/citas/mis-citas' : '/api/citas';
      const [dash, citas] = await Promise.all([
        user?.rol === 'Paciente'
          ? Promise.resolve(null)
          : apiFetch<DashboardData>('/api/dashboard', { token }).catch(() => null),
        apiFetch<Cita[]>(citasEndpoint, { token }).catch(() => []),
      ]);
      setDashboard(dash);
      // Take first 3 appointments for "next" section
      setProximas(Array.isArray(citas) ? citas.slice(0, 3) : []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [token, user?.rol]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#176b5b" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Óptica Integral</Text>
            <Text style={styles.title}>
              Hola, {user?.nombre || 'Panel Móvil'}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nombre?.charAt(0)?.toUpperCase() || 'O'}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dashboard?.citas_hoy ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Citas hoy</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dashboard?.citas_pendientes ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Pendientes</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dashboard?.pacientes ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Pacientes</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{dashboard?.atenciones_hoy ?? '—'}</Text>
            <Text style={styles.summaryLabel}>Atenciones hoy</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximas atenciones</Text>
          {proximas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Sin citas registradas</Text>
            </View>
          ) : (
            proximas.map((cita) => (
              <View key={cita.id_cita} style={styles.appointmentCard}>
                <Text style={styles.time}>{cita.hora_cita?.slice(0, 5) || '—'}</Text>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.cardTitle}>
                    {cita.paciente_nombre || cita.profesional_nombre || 'Paciente'}
                  </Text>
                  <Text style={styles.cardMeta}>{cita.motivo || cita.estado}</Text>
                </View>
                <View
                  style={[
                    styles.statusDot,
                    cita.estado === 'Pendiente' && { backgroundColor: '#e4a853' },
                    cita.estado === 'Cancelada' && { backgroundColor: '#d64545' },
                  ]}
                />
              </View>
            ))
          )}
        </View>

        {dashboard?.stock_bajo != null && dashboard.stock_bajo > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>⚠ Stock bajo</Text>
            <Text style={styles.bannerCopy}>
              {dashboard.stock_bajo} producto(s) con stock bajo o agotado.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#65736f',
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 18,
  },
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#176b5b',
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: '#172522',
    fontSize: 24,
    fontWeight: '900',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#163b35',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
  },
  errorBanner: {
    borderRadius: 8,
    backgroundColor: '#fce4e4',
    padding: 12,
  },
  errorText: {
    color: '#d64545',
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 100,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    padding: 16,
  },
  summaryValue: {
    color: '#176b5b',
    fontSize: 34,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#65736f',
    marginTop: 4,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: '#1e2d2a',
    fontSize: 18,
    fontWeight: '900',
  },
  appointmentCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    padding: 14,
  },
  time: {
    width: 52,
    color: '#176b5b',
    fontWeight: '900',
  },
  appointmentInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: '#1d2927',
    fontSize: 16,
    fontWeight: '800',
  },
  cardMeta: {
    color: '#66736f',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2d9c7f',
  },
  emptyCard: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    padding: 14,
  },
  emptyText: {
    color: '#8a9692',
    fontWeight: '700',
  },
  banner: {
    borderRadius: 8,
    backgroundColor: '#fff3e0',
    padding: 16,
    gap: 6,
  },
  bannerTitle: {
    color: '#8b5e00',
    fontSize: 17,
    fontWeight: '900',
  },
  bannerCopy: {
    color: '#8b5e00',
    lineHeight: 20,
  },
});
