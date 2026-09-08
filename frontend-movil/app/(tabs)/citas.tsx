import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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

export type Cita = {
  id_cita: number;
  id_usuario?: number;
  fecha_cita: string;
  hora_cita: string;
  estado: string;
  motivo?: string;
  motivo_cancelacion?: string;
  observacion?: string;
  paciente_nombre?: string;
  profesional_nombre?: string;
  pago_previo?: boolean;
  actualizado_en?: string;
  creado_en?: string;
};

export type Doctor = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  nombre_rol?: string;
};

// Especialistas por defecto en caso de retraso en la red
const DOCTORES_FALLBACK: Doctor[] = [
  { id_usuario: 2, nombre: 'Ana', apellido: 'Valencia', nombre_rol: 'Optómetra' },
  { id_usuario: 1, nombre: 'Mateo', apellido: 'Lozada', nombre_rol: 'Optómetra' },
  { id_usuario: 7, nombre: 'Alejandro', apellido: 'Tipán', nombre_rol: 'Optómetra' },
  { id_usuario: 6, nombre: 'Matius', apellido: 'Bonilla', nombre_rol: 'Optómetra' },
];

const HORARIOS_DISPONIBLES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

const MOTIVOS_RAPIDOS = [
  'Examen de la vista',
  'Control de lentes',
  'Consulta general',
  'Molestia ocular',
  'Renovación de armazón',
];

const estadoColor: Record<string, { text: string; bg: string }> = {
  Confirmada: { text: '#166534', bg: '#dcfce7' },
  Pendiente: { text: '#92400e', bg: '#fef3c7' },
  Pagada: { text: '#0f766e', bg: '#ccfbf1' },
  Cancelada: { text: '#991b1b', bg: '#fee2e2' },
  Atendida: { text: '#1e40af', bg: '#dbeafe' },
  'No asistio': { text: '#4b5563', bg: '#f3f4f6' },
};

function formatFechaLegible(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const clean = dateStr.slice(0, 10);
    const [year, month, day] = clean.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

function getProximosDias() {
  const dias = [];
  const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${nombres[date.getDay()]} ${dd}`;
    dias.push({ iso, label, sub: `${dd}/${mm}` });
  }
  return dias;
}

export default function AppointmentsScreen() {
  const { token, user } = useAuth();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filtros
  const [filtro, setFiltro] = useState<'Todas' | 'Pendientes' | 'Confirmadas' | 'Canceladas' | 'Historial'>('Todas');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modoModal, setModoModal] = useState<'crear' | 'reagendar'>('crear');
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null);

  // Formulario de agendamiento
  const [doctores, setDoctores] = useState<Doctor[]>(DOCTORES_FALLBACK);
  const [selectedDoctor, setSelectedDoctor] = useState<number>(2); // Ana Valencia por defecto
  const [loadingDoctores, setLoadingDoctores] = useState(false);

  const hoyStr = new Date().toISOString().slice(0, 10);
  const [fechaCita, setFechaCita] = useState(hoyStr);
  const [horaCita, setHoraCita] = useState('');
  const [motivo, setMotivo] = useState('Examen de la vista');
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // 1. Cargar Citas: siempre consulta las citas del usuario (paciente o administrador actuando como cliente)
  const fetchCitas = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      // Endpoint principal: mis citas como paciente
      const data = await apiFetch<Cita[]>('/api/citas/mis-citas', { token });
      setCitas(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn('Fallo /api/citas/mis-citas:', err?.message);
      // Fallback a /api/citas si es rol de staff
      try {
        const staffData = await apiFetch<Cita[]>('/api/citas', { token });
        setCitas(Array.isArray(staffData) ? staffData : []);
      } catch (fallbackErr: any) {
        setError(err?.message || 'Error al cargar citas');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // 2. Cargar Lista de Especialistas (como en web con /citas/profesionales)
  const cargarDoctores = useCallback(async () => {
    setLoadingDoctores(true);
    try {
      const res = await apiFetch<Doctor[]>('/api/citas/profesionales', { token });
      if (Array.isArray(res) && res.length > 0) {
        setDoctores(res);
        // Si no hay doctor seleccionado o el actual no está en la lista, selecciona el primero
        setSelectedDoctor((prev) => {
          const existe = res.some((d) => d.id_usuario === prev);
          return existe ? prev : res[0].id_usuario;
        });
      }
    } catch (e) {
      console.warn('Usando especialistas en caché:', e);
    } finally {
      setLoadingDoctores(false);
    }
  }, [token]);

  // Carga inicial y al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchCitas();
      cargarDoctores();
    }, [fetchCitas, cargarDoctores]),
  );

  useEffect(() => {
    cargarDoctores();
  }, [cargarDoctores]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCitas();
    cargarDoctores();
  };

  // 3. Cargar disponibilidad en tiempo real cuando cambia médico, fecha o se abre el modal
  useEffect(() => {
    if (!selectedDoctor || !fechaCita || !modalVisible) return;
    setLoadingDisponibilidad(true);
    apiFetch<string[]>(`/api/citas/disponibilidad?id_usuario=${selectedDoctor}&fecha_cita=${fechaCita}`, { token })
      .then((res) => {
        setHorasOcupadas(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        setHorasOcupadas([]);
      })
      .finally(() => {
        setLoadingDisponibilidad(false);
      });
  }, [token, selectedDoctor, fechaCita, modalVisible]);

  // Abrir modal de Agendar Cita
  const abrirAgendar = () => {
    setModoModal('crear');
    setCitaSeleccionada(null);
    setFechaCita(hoyStr);
    setHoraCita('');
    setMotivo('Examen de la vista');
    cargarDoctores();
    setModalVisible(true);
  };

  // Abrir modal de Reagendar Cita
  const abrirReagendar = (cita: Cita) => {
    setModoModal('reagendar');
    setCitaSeleccionada(cita);
    if (cita.id_usuario) {
      setSelectedDoctor(cita.id_usuario);
    }
    setFechaCita(cita.fecha_cita?.slice(0, 10) || hoyStr);
    setHoraCita('');
    setModalVisible(true);
  };

  // Guardar (Crear o Reagendar)
  const handleGuardarCita = async () => {
    if (!selectedDoctor || !fechaCita || !horaCita) {
      Alert.alert('Datos incompletos', 'Por favor selecciona el especialista, la fecha y el horario deseado.');
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
            motivo: motivo || 'Examen de la vista',
          },
        });
        Alert.alert('¡Cita Agendada!', 'Tu cita ha sido programada exitosamente.');
      } else if (modoModal === 'reagendar' && citaSeleccionada) {
        await apiFetch(`/api/citas/mis-citas/${citaSeleccionada.id_cita}/reagendar`, {
          token,
          method: 'POST',
          body: {
            fecha_cita: fechaCita,
            hora_cita: horaCita,
          },
        });
        Alert.alert('¡Cita Reagendada!', 'Tu cita ha sido actualizada con la nueva fecha y hora.');
      }
      setModalVisible(false);
      fetchCitas();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo procesar la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  // Cancelar cita con confirmación
  const handleCancelar = (cita: Cita) => {
    Alert.alert(
      'Cancelar Cita',
      `¿Estás seguro de que deseas cancelar tu cita del ${formatFechaLegible(cita.fecha_cita)} a las ${cita.hora_cita?.slice(0, 5)}?`,
      [
        { text: 'Mantener cita', style: 'cancel' },
        {
          text: 'Sí, cancelar cita',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/citas/mis-citas/${cita.id_cita}/cancelar`, {
                token,
                method: 'POST',
                body: { motivo: 'Cancelada por el paciente desde la app móvil' },
              });
              Alert.alert('Cita Cancelada', 'La cita ha sido cancelada correctamente.');
              fetchCitas();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo cancelar la cita.');
            }
          },
        },
      ]
    );
  };

  // Filtrado de citas
  const conteoPendientes = citas.filter((c) => c.estado === 'Pendiente').length;
  const conteoConfirmadas = citas.filter((c) => ['Confirmada', 'Pagada'].includes(c.estado)).length;
  const conteoCanceladas = citas.filter((c) => c.estado === 'Cancelada').length;
  const conteoHistorial = citas.filter((c) => ['Atendida', 'No asistio'].includes(c.estado)).length;

  const citasFiltradas = citas.filter((c) => {
    if (filtro === 'Pendientes') return c.estado === 'Pendiente';
    if (filtro === 'Confirmadas') return ['Confirmada', 'Pagada'].includes(c.estado);
    if (filtro === 'Canceladas') return c.estado === 'Cancelada';
    if (filtro === 'Historial') return ['Atendida', 'No asistio'].includes(c.estado);
    return true;
  });

  const filtrosList: Array<{ id: 'Todas' | 'Pendientes' | 'Confirmadas' | 'Canceladas' | 'Historial'; label: string; count: number }> = [
    { id: 'Todas', label: 'Todas', count: citas.length },
    { id: 'Pendientes', label: 'Pendientes', count: conteoPendientes },
    { id: 'Confirmadas', label: 'Confirmadas', count: conteoConfirmadas },
    { id: 'Canceladas', label: 'Canceladas', count: conteoCanceladas },
    { id: 'Historial', label: 'Historial', count: conteoHistorial },
  ];

  const proximosDias = getProximosDias();
  const doctorSeleccionadoObj = doctores.find((d) => d.id_usuario === selectedDoctor);

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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#176b5b']} />}
      >
        {/* Encabezado */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Mis Citas</Text>
            <Text style={styles.subtitle}>
              Consulta, agenda, reagenda o cancela tus citas
            </Text>
          </View>
          <Pressable style={styles.btnNuevaCita} onPress={abrirAgendar}>
            <Text style={styles.btnNuevaCitaText}>+ Agendar</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Filtros tipo Pills con Contador */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {filtrosList.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.filterChip, filtro === item.id && styles.filterChipActive]}
                onPress={() => setFiltro(item.id)}
              >
                <Text style={[styles.filterChipText, filtro === item.id && styles.filterChipTextActive]}>
                  {item.label} ({item.count})
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Listado de Citas */}
        <View style={styles.citasList}>
          {citasFiltradas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyTitle}>No hay citas en &quot;{filtro}&quot;</Text>
              <Text style={styles.emptySubtitle}>
                {citas.length === 0
                  ? 'No tienes citas registradas. Presiona el botón "+ Agendar" para agendar una consulta.'
                  : `Tienes ${citas.length} citas en total, pero ninguna bajo el filtro de ${filtro}.`}
              </Text>
              <Pressable style={styles.btnEmptyAgendar} onPress={abrirAgendar}>
                <Text style={styles.btnEmptyAgendarText}>Agendar una Cita Ahora</Text>
              </Pressable>
            </View>
          ) : (
            citasFiltradas.map((cita) => {
              const puedeModificar = ['Pendiente', 'Confirmada', 'Pagada'].includes(cita.estado);
              const estiloBadge = estadoColor[cita.estado] || { text: '#176b5b', bg: '#e6f2ee' };
              const esReagendada = Boolean(cita.actualizado_en && cita.creado_en && cita.actualizado_en !== cita.creado_en);

              return (
                <View key={cita.id_cita} style={styles.citaCard}>
                  {/* Fila Superior: Fecha y Estado */}
                  <View style={styles.citaCardHeader}>
                    <View style={styles.fechaBadge}>
                      <Text style={styles.fechaBadgeIcon}>📅</Text>
                      <Text style={styles.fechaBadgeText}>{formatFechaLegible(cita.fecha_cita)}</Text>
                      {esReagendada && (
                        <View style={styles.tagReagendada}>
                          <Text style={styles.tagReagendadaText}>🔄 Reagendada</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.estadoPill, { backgroundColor: estiloBadge.bg }]}>
                      <Text style={[styles.estadoPillText, { color: estiloBadge.text }]}>
                        {cita.estado}
                      </Text>
                    </View>
                  </View>

                  {/* Fila Central: Hora, Especialista y Motivo */}
                  <View style={styles.citaCardBody}>
                    <View style={styles.horaContainer}>
                      <Text style={styles.horaGrande}>{cita.hora_cita?.slice(0, 5) || '—'}</Text>
                      <Text style={styles.horaEtiqueta}>Horario</Text>
                    </View>

                    <View style={styles.infoDetalle}>
                      <Text style={styles.nombreDoctor} numberOfLines={1}>
                        👨‍⚕️ {cita.profesional_nombre ? `Dr(a). ${cita.profesional_nombre}` : 'Optometrista Especialista'}
                      </Text>
                      <Text style={styles.motivoTexto}>
                        Motivo: <Text style={styles.motivoValor}>{cita.motivo || 'Examen visual general'}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Si está Cancelada, mostrar motivo y botón para volver a agendar */}
                  {cita.estado === 'Cancelada' && (
                    <View style={styles.canceladaInfoBox}>
                      <Text style={styles.canceladaInfoText}>
                        Motivo cancelación: {cita.motivo_cancelacion || 'Cancelada por el paciente'}
                      </Text>
                      <Pressable
                        style={styles.btnReagendarCancelada}
                        onPress={() => {
                          if (cita.id_usuario) setSelectedDoctor(cita.id_usuario);
                          setModoModal('crear');
                          setFechaCita(hoyStr);
                          setHoraCita('');
                          setMotivo(cita.motivo || 'Examen de la vista');
                          setModalVisible(true);
                        }}
                      >
                        <Text style={styles.btnReagendarCanceladaText}>📅 Volver a agendar cita</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Fila Inferior: Botones de Acción (Reagendar / Cancelar) */}
                  {puedeModificar && (
                    <View style={styles.citaCardActions}>
                      <Pressable
                        style={styles.btnReagendar}
                        onPress={() => abrirReagendar(cita)}
                      >
                        <Text style={styles.btnReagendarText}>🔄 Reagendar</Text>
                      </Pressable>

                      <Pressable
                        style={styles.btnCancelar}
                        onPress={() => handleCancelar(cita)}
                      >
                        <Text style={styles.btnCancelarText}>✕ Cancelar</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ===================== MODAL DE AGENDAR / REAGENDAR ===================== */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modoModal === 'crear' ? '📅 Agendar Nueva Cita' : '🔄 Reagendar Cita'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormContent}>
              {/* PASO 1: SELECCIONAR MÉDICO / OPTÓMETRA (como en frontend-web) */}
              {modoModal === 'crear' && (
                <View style={styles.formSection}>
                  <View style={styles.sectionHeaderFlex}>
                    <Text style={styles.formLabel}>1. Profesional (Optómetra) *</Text>
                    {loadingDoctores && (
                      <View style={styles.loadingMini}>
                        <ActivityIndicator size="small" color="#176b5b" />
                        <Text style={styles.loadingMiniText}>Actualizando...</Text>
                      </View>
                    )}
                  </View>

                  {/* Selector visual de especialistas disponibles */}
                  <View style={styles.docList}>
                    {doctores.map((doc) => {
                      const selected = selectedDoctor === doc.id_usuario;
                      const esDoctora = doc.nombre.toLowerCase().includes('ana') || doc.nombre.toLowerCase().includes('maría');
                      return (
                        <Pressable
                          key={doc.id_usuario}
                          style={[styles.docItem, selected && styles.docItemSelected]}
                          onPress={() => setSelectedDoctor(doc.id_usuario)}
                        >
                          <View style={[styles.docAvatar, selected && styles.docAvatarSelected]}>
                            <Text style={styles.docAvatarText}>{esDoctora ? '👩‍⚕️' : '👨‍⚕️'}</Text>
                          </View>
                          <View style={styles.docTextContainer}>
                            <Text style={[styles.docName, selected && styles.docNameSelected]}>
                              {esDoctora ? 'Dra.' : 'Dr.'} {doc.nombre} {doc.apellido}
                            </Text>
                            <Text style={styles.docSpecialty}>
                              {doc.nombre_rol || 'Optómetra'} · Salud y Control Visual
                            </Text>
                          </View>
                          <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                            {selected && <View style={styles.radioInner} />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Si estamos en modo reagendar, mostramos el especialista asignado */}
              {modoModal === 'reagendar' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Especialista Asignado:</Text>
                  <View style={[styles.docItem, styles.docItemSelected]}>
                    <View style={[styles.docAvatar, styles.docAvatarSelected]}>
                      <Text style={styles.docAvatarText}>👨‍⚕️</Text>
                    </View>
                    <View style={styles.docTextContainer}>
                      <Text style={[styles.docName, styles.docNameSelected]}>
                        {citaSeleccionada?.profesional_nombre
                          ? `Dr(a). ${citaSeleccionada.profesional_nombre}`
                          : `Dr(a). ${doctorSeleccionadoObj?.nombre} ${doctorSeleccionadoObj?.apellido}`}
                      </Text>
                      <Text style={styles.docSpecialty}>Optometría Clínica</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* PASO 2: SELECCIONAR FECHA (con botones rápidos) */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>
                  {modoModal === 'crear' ? '2. Selecciona la Fecha:' : '1. Selecciona la Nueva Fecha:'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.diasScroll}>
                  {proximosDias.map((d) => {
                    const isSelected = fechaCita === d.iso;
                    return (
                      <Pressable
                        key={d.iso}
                        style={[styles.diaChip, isSelected && styles.diaChipSelected]}
                        onPress={() => setFechaCita(d.iso)}
                      >
                        <Text style={[styles.diaLabel, isSelected && styles.diaLabelSelected]}>
                          {d.label}
                        </Text>
                        <Text style={[styles.diaSub, isSelected && styles.diaSubSelected]}>
                          {d.sub}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.inputFechaManual}>
                  <Text style={styles.labelManual}>Fecha seleccionada (YYYY-MM-DD):</Text>
                  <TextInput
                    style={styles.textInputManual}
                    value={fechaCita}
                    onChangeText={setFechaCita}
                    placeholder="2026-09-15"
                  />
                </View>
              </View>

              {/* PASO 3: SELECCIONAR HORARIO DISPONIBLE */}
              <View style={styles.formSection}>
                <View style={styles.horarioHeaderRow}>
                  <Text style={styles.formLabel}>
                    {modoModal === 'crear' ? '3. Horarios Disponibles:' : '2. Nuevos Horarios Disponibles:'}
                  </Text>
                  {loadingDisponibilidad && (
                    <View style={styles.loadingMini}>
                      <ActivityIndicator size="small" color="#176b5b" />
                      <Text style={styles.loadingMiniText}>Consultando cupos...</Text>
                    </View>
                  )}
                </View>

                <View style={styles.slotsGrid}>
                  {HORARIOS_DISPONIBLES.map((slot) => {
                    const ocupado = horasOcupadas.includes(slot);
                    const seleccionado = horaCita === slot;

                    return (
                      <Pressable
                        key={slot}
                        disabled={ocupado}
                        style={[
                          styles.slotButton,
                          ocupado && styles.slotButtonOcupado,
                          seleccionado && styles.slotButtonSeleccionado,
                        ]}
                        onPress={() => setHoraCita(slot)}
                      >
                        <Text
                          style={[
                            styles.slotButtonText,
                            ocupado && styles.slotButtonTextOcupado,
                            seleccionado && styles.slotButtonTextSeleccionado,
                          ]}
                        >
                          {slot}
                        </Text>
                        <Text
                          style={[
                            styles.slotStatusSub,
                            ocupado && styles.slotStatusSubOcupado,
                            seleccionado && styles.slotStatusSubSeleccionado,
                          ]}
                        >
                          {ocupado ? 'Ocupado' : 'Libre'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* PASO 4: MOTIVO DE CONSULTA (solo al crear) */}
              {modoModal === 'crear' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>4. Motivo de la Consulta:</Text>
                  <View style={styles.motivosRow}>
                    {MOTIVOS_RAPIDOS.map((m) => {
                      const sel = motivo === m;
                      return (
                        <Pressable
                          key={m}
                          style={[styles.motivoChip, sel && styles.motivoChipSelected]}
                          onPress={() => setMotivo(m)}
                        >
                          <Text style={[styles.motivoChipText, sel && styles.motivoChipTextSelected]}>
                            {m}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={styles.textInputMotivo}
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Escribe el motivo de tu consulta..."
                  />
                </View>
              )}

              {/* Botón Guardar / Confirmar */}
              <Pressable
                style={[
                  styles.btnConfirmarModal,
                  (guardando || !horaCita) && styles.btnConfirmarDisabled,
                ]}
                disabled={guardando || !horaCita}
                onPress={handleGuardarCita}
              >
                {guardando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btnConfirmarModalText}>
                    {modoModal === 'crear' ? 'Confirmar y Agendar Cita' : 'Confirmar Reagendamiento'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
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
  content: { padding: 18, paddingBottom: 40, gap: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  title: { color: '#172522', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#65736f', fontSize: 13, marginTop: 2 },
  btnNuevaCita: {
    backgroundColor: '#176b5b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#176b5b',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnNuevaCitaText: { color: '#ffffff', fontWeight: '900', fontSize: 14 },

  errorBanner: { borderRadius: 8, backgroundColor: '#fce4e4', padding: 12 },
  errorText: { color: '#d64545', fontWeight: '700' },

  // Filtros
  filterScroll: { marginHorizontal: -4 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e2df',
  },
  filterChipActive: { backgroundColor: '#176b5b', borderColor: '#176b5b' },
  filterChipText: { fontSize: 13, fontWeight: '700', color: '#65736f' },
  filterChipTextActive: { color: '#ffffff' },

  tagReagendada: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagReagendadaText: {
    color: '#0369a1',
    fontSize: 10,
    fontWeight: '800',
  },

  canceladaInfoBox: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fed7d7',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  canceladaInfoText: {
    fontSize: 12,
    color: '#c53030',
    fontWeight: '600',
  },
  btnReagendarCancelada: {
    alignSelf: 'flex-start',
    backgroundColor: '#176b5b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnReagendarCanceladaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Listado de Citas
  citasList: { gap: 14 },
  citaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e2df',
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  citaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f0',
    paddingBottom: 8,
  },
  fechaBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fechaBadgeIcon: { fontSize: 14 },
  fechaBadgeText: { fontSize: 13, fontWeight: '800', color: '#172522' },
  estadoPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoPillText: { fontSize: 11, fontWeight: '800' },

  citaCardBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  horaContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
  },
  horaGrande: { fontSize: 18, fontWeight: '900', color: '#176b5b' },
  horaEtiqueta: { fontSize: 10, fontWeight: '700', color: '#65736f', marginTop: 2 },
  infoDetalle: { flex: 1, gap: 4 },
  nombreDoctor: { fontSize: 15, fontWeight: '800', color: '#172522' },
  motivoTexto: { fontSize: 13, color: '#65736f' },
  motivoValor: { fontWeight: '700', color: '#374151' },

  citaCardActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#edf2f0',
    paddingTop: 10,
  },
  btnReagendar: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnReagendarText: { color: '#374151', fontSize: 13, fontWeight: '800' },
  btnCancelar: {
    flex: 1,
    backgroundColor: '#fee2e2',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCancelarText: { color: '#991b1b', fontSize: 13, fontWeight: '800' },

  // Empty state
  emptyCard: {
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d7e2df',
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#172522' },
  emptySubtitle: { fontSize: 13, color: '#65736f', textAlign: 'center', lineHeight: 18 },
  btnEmptyAgendar: {
    marginTop: 8,
    backgroundColor: '#176b5b',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnEmptyAgendarText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f0',
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#172522' },
  modalCloseIcon: { fontSize: 18, fontWeight: '900', color: '#65736f', padding: 4 },
  modalFormContent: { gap: 16, paddingBottom: 20 },

  formSection: { gap: 8 },
  sectionHeaderFlex: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formLabel: { fontSize: 14, fontWeight: '800', color: '#172522' },
  loadingMini: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loadingMiniText: { fontSize: 11, color: '#176b5b', fontWeight: '600' },

  // Médico
  docList: { gap: 8 },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  docItemSelected: { borderColor: '#176b5b', backgroundColor: '#eef8f5' },
  docAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0ece9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docAvatarSelected: { backgroundColor: '#cbe4dc' },
  docAvatarText: { fontSize: 20 },
  docTextContainer: { flex: 1 },
  docName: { fontSize: 15, fontWeight: '800', color: '#172522' },
  docNameSelected: { color: '#176b5b' },
  docSpecialty: { fontSize: 12, color: '#65736f', marginTop: 2 },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: '#176b5b' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#176b5b' },

  // Fechas rápidas
  diasScroll: { flexDirection: 'row', marginVertical: 4 },
  diaChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    marginRight: 8,
    minWidth: 64,
  },
  diaChipSelected: { backgroundColor: '#176b5b' },
  diaLabel: { fontSize: 12, fontWeight: '800', color: '#374151' },
  diaLabelSelected: { color: '#ffffff' },
  diaSub: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  diaSubSelected: { color: '#dcfce7' },

  inputFechaManual: { marginTop: 6, gap: 4 },
  labelManual: { fontSize: 12, color: '#65736f' },
  textInputManual: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e2df',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#172522',
  },

  // Horarios
  horarioHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotButton: {
    width: '30%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  slotButtonOcupado: { backgroundColor: '#f9fafb', borderColor: '#f3f4f6', opacity: 0.5 },
  slotButtonSeleccionado: { backgroundColor: '#176b5b', borderColor: '#176b5b' },
  slotButtonText: { fontSize: 13, fontWeight: '800', color: '#1f2937' },
  slotButtonTextOcupado: { color: '#9ca3af', textDecorationLine: 'line-through' },
  slotButtonTextSeleccionado: { color: '#ffffff' },
  slotStatusSub: { fontSize: 10, color: '#16a34a', marginTop: 1 },
  slotStatusSubOcupado: { color: '#ef4444' },
  slotStatusSubSeleccionado: { color: '#dcfce7' },

  // Motivos
  motivosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  motivoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  motivoChipSelected: { backgroundColor: '#e0ece9' },
  motivoChipText: { fontSize: 12, fontWeight: '700', color: '#4b5563' },
  motivoChipTextSelected: { color: '#176b5b' },
  textInputMotivo: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7e2df',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#172522',
  },

  // Confirmar
  btnConfirmarModal: {
    backgroundColor: '#176b5b',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnConfirmarDisabled: { opacity: 0.5 },
  btnConfirmarModalText: { color: '#ffffff', fontSize: 15, fontWeight: '900' },
});
