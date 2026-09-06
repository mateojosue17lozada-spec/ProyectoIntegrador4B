import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

type Paciente = {
  id_paciente: number;
  nombre: string;
  apellido: string;
  cedula: string;
  correo?: string;
  telefono?: string;
};

export default function PatientsScreen() {
  const { token } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [filtered, setFiltered] = useState<Paciente[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPacientes = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<Paciente[]>('/api/pacientes', { token });
      const list = Array.isArray(data) ? data : [];
      setPacientes(list);
      setFiltered(list);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pacientes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchPacientes();
    }, [fetchPacientes]),
  );

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(pacientes);
      return;
    }
    const q = text.toLowerCase();
    setFiltered(
      pacientes.filter(
        (p) =>
          `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
          p.cedula?.includes(q),
      ),
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#176b5b" />
          <Text style={styles.loadingText}>Cargando pacientes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Pacientes</Text>

        <TextInput
          style={styles.searchBox}
          value={search}
          onChangeText={handleSearch}
          placeholder="Buscar paciente..."
          placeholderTextColor="#8a9692"
        />

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {search ? 'Sin resultados' : 'No hay pacientes registrados'}
              </Text>
            </View>
          ) : (
            filtered.map((patient) => (
              <View key={patient.id_paciente} style={styles.patientCard}>
                <View style={styles.initials}>
                  <Text style={styles.initialsText}>
                    {`${patient.nombre?.charAt(0) || ''}${patient.apellido?.charAt(0) || ''}`
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>
                    {patient.nombre} {patient.apellido}
                  </Text>
                  <Text style={styles.document}>{patient.cedula}</Text>
                  {patient.telefono ? (
                    <Text style={styles.lastVisit}>{patient.telefono}</Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
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
    gap: 16,
  },
  title: {
    color: '#172522',
    fontSize: 28,
    fontWeight: '900',
  },
  searchBox: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#172522',
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
  section: {
    gap: 10,
  },
  patientCard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    padding: 14,
  },
  initials: {
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dff0eb',
  },
  initialsText: {
    color: '#176b5b',
    fontWeight: '900',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: '#1d2927',
    fontSize: 16,
    fontWeight: '900',
  },
  document: {
    color: '#465451',
    fontWeight: '700',
  },
  lastVisit: {
    color: '#6f7c78',
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
});
