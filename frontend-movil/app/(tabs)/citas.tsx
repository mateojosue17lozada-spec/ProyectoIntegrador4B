import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const appointments = [
  { date: 'Lun 08', time: '09:00', patient: 'Maria Gomez', state: 'Confirmada' },
  { date: 'Lun 08', time: '10:30', patient: 'Jorge Vera', state: 'Pendiente' },
  { date: 'Mar 09', time: '15:00', patient: 'Ana Ruiz', state: 'Pagada' },
];

export default function AppointmentsScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Citas</Text>
        <View style={styles.calendarStrip}>
          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie'].map((day, index) => (
            <View key={day} style={[styles.dayCard, index === 0 && styles.dayCardActive]}>
              <Text style={[styles.dayName, index === 0 && styles.dayTextActive]}>{day}</Text>
              <Text style={[styles.dayNumber, index === 0 && styles.dayTextActive]}>{String(index + 8).padStart(2, '0')}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          {appointments.map((appointment) => (
            <View key={`${appointment.date}-${appointment.time}`} style={styles.card}>
              <View style={styles.hourBlock}>
                <Text style={styles.hour}>{appointment.time}</Text>
                <Text style={styles.date}>{appointment.date}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.patient}>{appointment.patient}</Text>
                <Text style={styles.meta}>Consulta optometrica</Text>
              </View>
              <Text style={styles.badge}>{appointment.state}</Text>
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
    gap: 18,
  },
  title: {
    color: '#172522',
    fontSize: 28,
    fontWeight: '900',
  },
  calendarStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  dayCard: {
    flex: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
  },
  dayCardActive: {
    backgroundColor: '#176b5b',
    borderColor: '#176b5b',
  },
  dayName: {
    color: '#697774',
    fontWeight: '800',
  },
  dayNumber: {
    color: '#24322f',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  dayTextActive: {
    color: '#fff',
  },
  section: {
    gap: 10,
  },
  card: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    padding: 14,
  },
  hourBlock: {
    width: 56,
  },
  hour: {
    color: '#176b5b',
    fontWeight: '900',
  },
  date: {
    color: '#7a8582',
    fontSize: 12,
    marginTop: 3,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  patient: {
    color: '#1d2927',
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: '#66736f',
  },
  badge: {
    color: '#176b5b',
    backgroundColor: '#e4f1ed',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
});
