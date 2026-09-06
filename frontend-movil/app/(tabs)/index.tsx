import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const nextAppointments = [
  { time: '09:00', name: 'Maria Gomez', service: 'Control visual' },
  { time: '10:30', name: 'Jorge Vera', service: 'Entrega de lentes' },
  { time: '12:00', name: 'Ana Ruiz', service: 'Examen optometrico' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Optica Integral</Text>
            <Text style={styles.title}>Panel movil</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>OI</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>12</Text>
            <Text style={styles.summaryLabel}>Citas hoy</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>4</Text>
            <Text style={styles.summaryLabel}>Pendientes</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proximas atenciones</Text>
          {nextAppointments.map((appointment) => (
            <View key={`${appointment.time}-${appointment.name}`} style={styles.appointmentCard}>
              <Text style={styles.time}>{appointment.time}</Text>
              <View style={styles.appointmentInfo}>
                <Text style={styles.cardTitle}>{appointment.name}</Text>
                <Text style={styles.cardMeta}>{appointment.service}</Text>
              </View>
              <View style={styles.statusDot} />
            </View>
          ))}
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Revision rapida</Text>
          <Text style={styles.bannerCopy}>Agenda, pacientes y perfil estan listos como vistas navegables.</Text>
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
    fontSize: 28,
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
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 112,
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
  banner: {
    borderRadius: 8,
    backgroundColor: '#dff0eb',
    padding: 16,
    gap: 6,
  },
  bannerTitle: {
    color: '#163b35',
    fontSize: 17,
    fontWeight: '900',
  },
  bannerCopy: {
    color: '#41514d',
    lineHeight: 20,
  },
});
