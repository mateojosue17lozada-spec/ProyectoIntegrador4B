import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/services/api';

type Cita = {
  id_cita: number;
  fecha_cita: string;
  hora_cita: string;
  estado: string;
  motivo?: string;
  paciente_nombre?: string;
  profesional_nombre?: string;
  pago_previo?: boolean;
};

type Doctor = {
  id_usuario: number;
  nombre: string;
  apellido: string;
};

const HORARIOS_DISPONIBLES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

const estadoColor: Record<string, string> = {
  Confirmada: '#176b5b',
  Pendiente: '#c78a20',
  Pagada: '#2d9c7f',
  Cancelada: '#d64545',
  Atendida: '#3578b2',
  'No asistio': '#888',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

export default function AppointmentsScreen() {
  const { token, user } = useAuth();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [modalVisible, setModalVisible] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'reagendar'>('crear');
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null);

  // Form state
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const hoyStr = new Date().toISOString().slice(0, 10);
  const [fechaCita, setFechaCita] = useState(hoyStr);
  const [horaCita, setHoraCita] = useState('');
  const [motivo, setMotivo] = useState('');
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const fetchCitas = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const endpoint = user?.rol === 'Paciente' ? '/api/citas/mis-citas' : '/api/citas';
      const data = await apiFetch<Cita[]>(endpoint, { token });
      setCitas(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar citas');
    } finally {
      setLoading(false);
    }
  }, [token, user?.rol]);

  useFocusEffect(
    useCallback(() => {
      fetchCitas();
    }, [fetchCitas]),
  );

  // Load doctores
  useEffect(() => {
    if (!token) return;
    apiFetch<Doctor[]>('/api/citas/profesionales', { token })
      .then((res) => {
        if (Array.isArray(res)) {
          setDoctores(res);
          if (res.length > 0 && !selectedDoctor) {
            setSelectedDoctor(res[0].id_usuario);
          }
        }
      })
      .catch(() => {});
  }, [token]);

  // Load availability when doctor or date changes
  useEffect(() => {
    if (!token || !selectedDoctor || !fechaCita) return;
    setLoadingDisponibilidad(true);
    apiFetch<string[]>(`/api/citas/disponibilidad?id_usuario=${selectedDoctor}&fecha_cita=${fechaCita}`, { token })
      .then((res) => setHorasOcupadas(Array.isArray(res) ? res : []))
      .catch(() => setHorasOcupadas([]))
      .finally(() => setLoadingDisponibilidad(false));
  }, [token, selectedDoctor, fechaCita]);

  const abrirAgendar = () => {
    setModoModal('crear');
    setCitaSeleccionada(null);
    setHoraCita('');
    setMotivo('');
    setModalVisible(true);
  };

  const abrirReagendar = (cita: Cita) => {
    setModoModal('reagendar');
    setCitaSeleccionada(cita);
    setFechaCita(cita.fecha_cita || hoyStr);
    setHoraCita('');
    setModalVisible(true);
  };

  const handleGuardarCita = async () => {
    if (!selectedDoctor || !fechaCita || !horaCita) {
      Alert.alert('Campos requeridos', 'Por favor selecciona la fecha, el médico y la hora de atención.');
      return;
    }
    setGuardando(true);
    try {
      if (modoModal === 'crear') {
        await apiFetch('/api/citas/mis-citas', {
          token,
          method: 'POST',
          body: {
            id_usuario: selectedDoctor,
            fecha_cita: fechaCita,
            hora_cita: horaCita,
            motivo: motivo || 'Consulta general',
          },
        });
        Alert.alert('Éxito', 'Cita agendada correctamente.');
      } else if (modoModal === 'reagendar' && citaSeleccionada) {
        await apiFetch(`/api/citas/mis-citas/${citaSeleccionada.id_cita}/reagendar`, {
          token,
          method: 'POST',
          body: {
            fecha_cita: fechaCita,
            hora_cita: horaCita,
          },
        });
        Alert.alert('Éxito', 'Cita reagendada correctamente.');
      }
      setModalVisible(false);
      fetchCitas();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la cita.');
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelar = (cita: Cita) => {
    Alert.alert(
      'Cancelar cita',
      '¿Estás seguro de que deseas cancelar esta cita?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/citas/mis-citas/${cita.id_cita}/cancelar`, {
                token,
                method: 'POST',
                body: { motivo: 'Cancelada desde la aplicación móvil' },
              });
              Alert.alert('Cancelada', 'La cita fue cancelada.');
              fetchCitas();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo cancelar la cita.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#176b5b" />
          <Text style={styles.loadingText}>Cargando citas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Citas</Text>
          {user?.rol === 'Paciente' && (
            <Pressable style={styles.btnAgendar} onPress={abrirAgendar}>
              <Text style={styles.btnAgendarText}>+ Nueva cita</Text>
            </Pressable>
          )}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          {citas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No hay citas registradas</Text>
            </View>
          ) : (
            citas.map((cita) => {
              const esEditable = !['Cancelada', 'Atendida'].includes(cita.estado) && user?.rol === 'Paciente';
              return (
                <View key={cita.id_cita} style={styles.cardContainer}>
                  <View style={styles.card}>
                    <View style={styles.hourBlock}>
                      <Text style={styles.hour}>{cita.hora_cita?.slice(0, 5) || '—'}</Text>
                      <Text style={styles.date}>{formatDate(cita.fecha_cita)}</Text>
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.patient}>
                        {cita.profesional_nombre || cita.paciente_nombre || 'Consulta médica'}
                      </Text>
                      <Text style={styles.meta}>{cita.motivo || 'Consulta'}</Text>
                    </View>
                    <Text
                      style={[
                        styles.badge,
                        { color: estadoColor[cita.estado] || '#176b5b' },
                        { backgroundColor: (estadoColor[cita.estado] || '#176b5b') + '18' },
                      ]}
                    >
                      {cita.estado}
                    </Text>
                  </View>

                  {esEditable && (
                    <View style={styles.actionRow}>
                      <Pressable style={styles.actionBtnSec} onPress={() => abrirReagendar(cita)}>
                        <Text style={styles.actionBtnSecText}>Reagendar</Text>
                      </Pressable>
                      <Pressable style={styles.actionBtnDanger} onPress={() => handleCancelar(cita)}>
                        <Text style={styles.actionBtnDangerText}>Cancelar</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Modal para Agendar / Reagendar Cita */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modoModal === 'crear' ? 'Agendar Nueva Cita' : 'Reagendar Cita'}
            </Text>

            {modoModal === 'crear' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Selecciona Profesional:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docRow}>
                  {doctores.map((doc) => (
                    <Pressable
                      key={doc.id_usuario}
                      style={[
                        styles.docChip,
                        selectedDoctor === doc.id_usuario && styles.docChipActive,
                      ]}
                      onPress={() => setSelectedDoctor(doc.id_usuario)}
                    >
                      <Text
                        style={[
                          styles.docChipText,
                          selectedDoctor === doc.id_usuario && styles.docChipTextActive,
                        ]}
                      >
                        Dr. {doc.nombre} {doc.apellido}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Fecha (YYYY-MM-DD):</Text>
              <TextInput
                style={styles.input}
                value={fechaCita}
                onChangeText={setFechaCita}
                placeholder="2026-09-10"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Horarios Disponibles:</Text>
              {loadingDisponibilidad ? (
                <ActivityIndicator size="small" color="#176b5b" />
              ) : (
                <View style={styles.slotsGrid}>
                  {HORARIOS_DISPONIBLES.map((slot) => {
                    const ocupado = horasOcupadas.includes(slot);
                    const seleccionado = horaCita === slot;
                    return (
                      <Pressable
                        key={slot}
                        disabled={ocupado}
                        style={[
                          styles.slotBtn,
                          ocupado && styles.slotOcupado,
                          seleccionado && styles.slotSeleccionado,
                        ]}
                        onPress={() => setHoraCita(slot)}
                      >
                        <Text
                          style={[
                            styles.slotText,
                            ocupado && styles.slotTextOcupado,
                            seleccionado && styles.slotTextSeleccionado,
                          ]}
                        >
                          {slot} {ocupado ? '(X)' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {modoModal === 'crear' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Motivo de consulta:</Text>
                <TextInput
                  style={styles.input}
                  value={motivo}
                  onChangeText={setMotivo}
                  placeholder="Ej: Examen de vista"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.btnCancelModal}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnCancelModalText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.btnConfirmModal}
                disabled={guardando || !horaCita}
                onPress={handleGuardarCita}
              >
                <Text style={styles.btnConfirmModalText}>
                  {guardando ? 'Guardando...' : 'Confirmar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#65736f', fontWeight: '700' },
  content: { padding: 18, paddingBottom: 32, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#172522', fontSize: 28, fontWeight: '900' },
  btnAgendar: { backgroundColor: '#176b5b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnAgendarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errorBanner: { borderRadius: 8, backgroundColor: '#fce4e4', padding: 12 },
  errorText: { color: '#d64545', fontWeight: '700' },
  section: { gap: 12 },
  cardContainer: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  card: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  hourBlock: { width: 56 },
  hour: { color: '#176b5b', fontWeight: '900' },
  date: { color: '#7a8582', fontSize: 12, marginTop: 3 },
  info: { flex: 1, gap: 3 },
  patient: { color: '#1d2927', fontSize: 16, fontWeight: '800' },
  meta: { color: '#66736f' },
  badge: {
    color: '#176b5b',
    backgroundColor: '#e4f1ed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f4f3',
    backgroundColor: '#fafcfc',
  },
  actionBtnSec: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  actionBtnSecText: { color: '#176b5b', fontWeight: '700', fontSize: 13 },
  actionBtnDanger: { flex: 1, paddingVertical: 10, alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#f0f4f3' },
  actionBtnDangerText: { color: '#d64545', fontWeight: '700', fontSize: 13 },
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
  emptyText: { color: '#8a9692', fontWeight: '700' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#172522' },
  formGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700', color: '#465451' },
  input: { borderWidth: 1, borderColor: '#d7e2df', borderRadius: 8, paddingHorizontal: 12, height: 42, fontSize: 15 },
  docRow: { flexDirection: 'row', paddingVertical: 4 },
  docChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#d7e2df', marginRight: 8, backgroundColor: '#f4f7f6' },
  docChipActive: { backgroundColor: '#176b5b', borderColor: '#176b5b' },
  docChipText: { color: '#465451', fontWeight: '600', fontSize: 13 },
  docChipTextActive: { color: '#fff', fontWeight: '800' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  slotBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#176b5b', backgroundColor: '#fff' },
  slotOcupado: { borderColor: '#e2e8f0', backgroundColor: '#f1f5f9' },
  slotSeleccionado: { backgroundColor: '#176b5b' },
  slotText: { color: '#176b5b', fontSize: 12, fontWeight: '700' },
  slotTextOcupado: { color: '#94a3b8', textDecorationLine: 'line-through' },
  slotTextSeleccionado: { color: '#fff' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  btnCancelModal: { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#d7e2df', alignItems: 'center', justifyContent: 'center' },
  btnCancelModalText: { color: '#64748b', fontWeight: '700' },
  btnConfirmModal: { flex: 1, height: 44, borderRadius: 8, backgroundColor: '#176b5b', alignItems: 'center', justifyContent: 'center' },
  btnConfirmModalText: { color: '#fff', fontWeight: '900' },
});
