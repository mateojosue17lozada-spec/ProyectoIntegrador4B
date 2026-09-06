import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const patients = [
  { name: 'Maria Gomez', document: '0923456789', lastVisit: 'Control hace 2 dias' },
  { name: 'Jorge Vera', document: '0911122233', lastVisit: 'Lentes en entrega' },
  { name: 'Ana Ruiz', document: '0955566677', lastVisit: 'Examen pendiente' },
];

export default function PatientsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Pacientes</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchText}>Buscar paciente</Text>
        </View>

        <View style={styles.section}>
          {patients.map((patient) => (
            <View key={patient.document} style={styles.patientCard}>
              <View style={styles.initials}>
                <Text style={styles.initialsText}>
                  {patient.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{patient.name}</Text>
                <Text style={styles.document}>{patient.document}</Text>
                <Text style={styles.lastVisit}>{patient.lastVisit}</Text>
              </View>
            </View>
          ))}
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
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  searchText: {
    color: '#8a9692',
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
});
