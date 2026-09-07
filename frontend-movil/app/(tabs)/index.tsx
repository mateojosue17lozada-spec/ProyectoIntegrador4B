import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
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
  fecha_cita: string;
  hora_cita: string;
  profesional_nombre?: string;
  paciente_nombre?: string;
  motivo?: string;
  estado: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const esPaciente = user?.rol === 'Paciente';

  const fetchData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      if (esPaciente) {
        // Cargar citas del paciente
        const myCitas = await apiFetch<Cita[]>('/api/citas/mis-citas', { token }).catch(() => []);
        setCitas(Array.isArray(myCitas) ? myCitas : []);
      } else {
        // Cargar dashboard y citas del staff/admin
        const [dash, staffCitas] = await Promise.all([
          apiFetch<DashboardData>('/api/dashboard', { token }).catch(() => null),
          apiFetch<Cita[]>('/api/citas', { token }).catch(() => []),
        ]);
        setDashboard(dash);
        setCitas(Array.isArray(staffCitas) ? staffCitas : []);
      }
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, esPaciente]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#176b5b" />
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Cita más próxima para el paciente
  const proximaCita = esPaciente
    ? citas.find((c) => ['Pendiente', 'Confirmada', 'Pagada'].includes(c.estado))
    : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#176b5b']} />}
      >
        {/* Cabecera personalizada */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.eyebrow}>
              {esPaciente ? 'Portal del Paciente' : 'Panel de Administración'}
            </Text>
            <Text style={styles.title} numberOfLines={1}>
              Hola, {user?.nombre || 'Usuario'}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.rol || 'Usuario'}</Text>
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ===================== VISTA PARA EL PACIENTE ===================== */}
        {esPaciente ? (
          <>
            {/* Tarjeta de Próxima Cita */}
            <View style={styles.cardProxima}>
              <View style={styles.cardProximaHeader}>
                <Text style={styles.cardProximaTitle}>📅 Tu Próxima Cita</Text>
                {proximaCita && (
                  <View style={[styles.badgeEstado, { backgroundColor: '#e2f5ee' }]}>
                    <Text style={[styles.badgeEstadoText, { color: '#176b5b' }]}>
                      {proximaCita.estado}
                    </Text>
                  </View>
                )}
              </View>

              {proximaCita ? (
                <View style={styles.proximaInfo}>
                  <View style={styles.proximaRow}>
                    <Text style={styles.proximaLabel}>Especialista:</Text>
                    <Text style={styles.proximaValue}>
                      {proximaCita.profesional_nombre ? `Dr(a). ${proximaCita.profesional_nombre}` : 'Optometrista'}
                    </Text>
                  </View>
                  <View style={styles.proximaRow}>
                    <Text style={styles.proximaLabel}>Fecha y Hora:</Text>
                    <Text style={styles.proximaValueBold}>
                      {proximaCita.fecha_cita} a las {proximaCita.hora_cita?.slice(0, 5)}
                    </Text>
                  </View>
                  <View style={styles.proximaRow}>
                    <Text style={styles.proximaLabel}>Motivo:</Text>
                    <Text style={styles.proximaValue}>{proximaCita.motivo || 'Consulta general'}</Text>
                  </View>
                  <Pressable
                    style={styles.btnVerDetalles}
                    onPress={() => router.push('/(tabs)/citas')}
                  >
                    <Text style={styles.btnVerDetallesText}>Gestionar mis citas →</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.noCitasBox}>
                  <Text style={styles.noCitasText}>No tienes citas programadas actualmente.</Text>
                  <Pressable
                    style={styles.btnAgendarGrande}
                    onPress={() => router.push('/(tabs)/citas')}
                  >
                    <Text style={styles.btnAgendarGrandeText}>+ Agendar Nueva Cita</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Acciones Rápidas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
              <View style={styles.quickGrid}>
                <Pressable
                  style={styles.quickCard}
                  onPress={() => router.push('/(tabs)/citas')}
                >
                  <Text style={styles.quickIcon}>🗓️</Text>
                  <Text style={styles.quickTitle}>Mis Citas</Text>
                  <Text style={styles.quickSubtitle}>Revisa, agenda o reagenda tus citas</Text>
                </Pressable>

                <Pressable
                  style={styles.quickCard}
                  onPress={() => router.push('/(tabs)/perfil')}
                >
                  <Text style={styles.quickIcon}>👤</Text>
                  <Text style={styles.quickTitle}>Mi Perfil</Text>
                  <Text style={styles.quickSubtitle}>Tus datos de contacto y cuenta</Text>
                </Pressable>
              </View>
            </View>

            {/* Consejos Visuales */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerTitle}>💡 Consejo de Salud Visual</Text>
              <Text style={styles.infoBannerText}>
                Aplica la regla 20-20-20: cada 20 minutos de uso de pantallas, mira hacia un objeto a 20 pies (6 metros) de distancia durante al menos 20 segundos.
              </Text>
            </View>
          </>
        ) : (
          /* ===================== VISTA PARA EL ADMINISTRADOR (REPORTES) ===================== */
          <>
            <View style={styles.reportesHeader}>
              <Text style={styles.sectionTitle}>📊 Resumen Ejecutivo</Text>
              <Text style={styles.sectionSubtitle}>Métricas y rendimiento de la óptica hoy</Text>
            </View>

            {/* Métricas Principales (KPIs) */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>${dashboard?.ventas_hoy != null ? dashboard.ventas_hoy.toFixed(2) : '0.00'}</Text>
                <Text style={styles.summaryLabel}>Ventas hoy</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{dashboard?.citas_hoy ?? 0}</Text>
                <Text style={styles.summaryLabel}>Citas hoy</Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{dashboard?.pacientes ?? 0}</Text>
                <Text style={styles.summaryLabel}>Total pacientes</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{dashboard?.atenciones_hoy ?? 0}</Text>
                <Text style={styles.summaryLabel}>Atenciones hoy</Text>
              </View>
            </View>

            {/* Desglose de Citas de Hoy */}
            <View style={styles.kpiCard}>
              <Text style={styles.kpiCardTitle}>Estado de Citas de Hoy</Text>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiNumber, { color: '#176b5b' }]}>
                    {dashboard?.citas_pagadas ?? 0}
                  </Text>
                  <Text style={styles.kpiText}>Pagadas</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiNumber, { color: '#d97706' }]}>
                    {dashboard?.citas_pendientes ?? 0}
                  </Text>
                  <Text style={styles.kpiText}>Pendientes</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiCol}>
                  <Text style={[styles.kpiNumber, { color: '#2563eb' }]}>
                    {dashboard?.citas_hoy ?? 0}
                  </Text>
                  <Text style={styles.kpiText}>Totales</Text>
                </View>
              </View>
            </View>

            {/* Alerta de Stock si aplica */}
            {dashboard?.stock_bajo != null && dashboard.stock_bajo > 0 && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertTitle}>⚠️ Alerta de Inventario</Text>
                <Text style={styles.alertCopy}>
                  Hay {dashboard.stock_bajo} producto(s) con stock igual o inferior al mínimo permitido.
                </Text>
              </View>
            )}

            {/* Actividad Reciente de Citas */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Últimas Citas Registradas</Text>
                <Pressable onPress={() => router.push('/(tabs)/citas')}>
                  <Text style={styles.linkText}>Ver todas →</Text>
                </Pressable>
              </View>

              {citas.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>Sin citas registradas hoy</Text>
                </View>
              ) : (
                citas.slice(0, 4).map((c) => (
                  <View key={c.id_cita} style={styles.citaAdminCard}>
                    <View style={styles.citaAdminHour}>
                      <Text style={styles.citaAdminHourText}>{c.hora_cita?.slice(0, 5) || '—'}</Text>
                      <Text style={styles.citaAdminDateText}>{c.fecha_cita?.slice(5)}</Text>
                    </View>
                    <View style={styles.citaAdminInfo}>
                      <Text style={styles.citaAdminPatient} numberOfLines={1}>
                        {c.paciente_nombre || 'Paciente'}
                      </Text>
                      <Text style={styles.citaAdminDoc} numberOfLines={1}>
                        Dr(a). {c.profesional_nombre || 'Especialista'} • {c.motivo || 'Consulta'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badgeMini,
                        c.estado === 'Confirmada' && { backgroundColor: '#dcfce7' },
                        c.estado === 'Pendiente' && { backgroundColor: '#fef3c7' },
                        c.estado === 'Atendida' && { backgroundColor: '#dbeafe' },
                        c.estado === 'Cancelada' && { backgroundColor: '#fee2e2' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeMiniText,
                          c.estado === 'Confirmada' && { color: '#166534' },
                          c.estado === 'Pendiente' && { color: '#92400e' },
                          c.estado === 'Atendida' && { color: '#1e40af' },
                          c.estado === 'Cancelada' && { color: '#991b1b' },
                        ]}
                      >
                        {c.estado}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#65736f', fontWeight: '700' },
  content: { padding: 18, paddingBottom: 36, gap: 18 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  headerTextContainer: { flex: 1, marginRight: 12 },
  eyebrow: { color: '#176b5b', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: '#172522', fontSize: 24, fontWeight: '900', marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6f2ee',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeText: { color: '#176b5b', fontSize: 11, fontWeight: '800' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#163b35',
  },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 18 },

  errorBanner: { borderRadius: 8, backgroundColor: '#fce4e4', padding: 12 },
  errorText: { color: '#d64545', fontWeight: '700' },

  // Tarjeta de Próxima Cita (Paciente)
  cardProxima: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d7e2df',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardProximaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f0',
    paddingBottom: 8,
  },
  cardProximaTitle: { fontSize: 16, fontWeight: '800', color: '#172522' },
  badgeEstado: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeEstadoText: { fontSize: 12, fontWeight: '800' },
  proximaInfo: { gap: 8 },
  proximaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proximaLabel: { color: '#65736f', fontSize: 13, fontWeight: '600' },
  proximaValue: { color: '#172522', fontSize: 14, fontWeight: '700' },
  proximaValueBold: { color: '#176b5b', fontSize: 15, fontWeight: '900' },
  btnVerDetalles: {
    marginTop: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f0f7f5',
  },
  btnVerDetallesText: { color: '#176b5b', fontWeight: '800', fontSize: 13 },
  noCitasBox: { alignItems: 'center', paddingVertical: 14, gap: 12 },
  noCitasText: { color: '#65736f', fontSize: 14, textAlign: 'center' },
  btnAgendarGrande: {
    backgroundColor: '#176b5b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnAgendarGrandeText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },

  // Quick Actions (Paciente)
  section: { gap: 10 },
  sectionTitle: { color: '#1e2d2a', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: '#65736f', fontSize: 13 },
  quickGrid: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d7e2df',
    gap: 4,
  },
  quickIcon: { fontSize: 24, marginBottom: 4 },
  quickTitle: { fontSize: 15, fontWeight: '800', color: '#172522' },
  quickSubtitle: { fontSize: 12, color: '#65736f', lineHeight: 16 },

  infoBanner: {
    backgroundColor: '#eaf5f2',
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#176b5b',
    gap: 6,
  },
  infoBannerTitle: { fontSize: 14, fontWeight: '800', color: '#163b35' },
  infoBannerText: { fontSize: 13, color: '#2d4b44', lineHeight: 18 },

  // Admin Section
  reportesHeader: { gap: 2, marginBottom: -4 },
  summaryGrid: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e2df',
    padding: 14,
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 24, fontWeight: '900', color: '#176b5b' },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: '#65736f', marginTop: 4 },

  kpiCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e2df',
    padding: 14,
    gap: 12,
  },
  kpiCardTitle: { fontSize: 15, fontWeight: '800', color: '#172522' },
  kpiRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  kpiCol: { alignItems: 'center' },
  kpiNumber: { fontSize: 20, fontWeight: '900' },
  kpiText: { fontSize: 12, fontWeight: '600', color: '#65736f', marginTop: 2 },
  kpiDivider: { width: 1, height: 28, backgroundColor: '#e2ece9' },

  alertBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
    gap: 4,
  },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#92400e' },
  alertCopy: { fontSize: 12, color: '#78350f', lineHeight: 16 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkText: { color: '#176b5b', fontSize: 13, fontWeight: '800' },
  citaAdminCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  citaAdminHour: { width: 50, alignItems: 'center' },
  citaAdminHourText: { fontSize: 14, fontWeight: '800', color: '#176b5b' },
  citaAdminDateText: { fontSize: 11, color: '#65736f', fontWeight: '600' },
  citaAdminInfo: { flex: 1, gap: 2 },
  citaAdminPatient: { fontSize: 14, fontWeight: '800', color: '#172522' },
  citaAdminDoc: { fontSize: 12, color: '#65736f' },
  badgeMini: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeMiniText: { fontSize: 11, fontWeight: '800' },

  emptyCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    alignItems: 'center',
  },
  emptyText: { color: '#8a9692', fontWeight: '600', fontSize: 13 },
});
