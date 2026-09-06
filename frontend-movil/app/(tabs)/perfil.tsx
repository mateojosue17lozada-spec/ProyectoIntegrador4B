import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const items = ['Datos de usuario', 'Horario de atencion', 'Notificaciones', 'Ayuda'];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AM</Text>
          </View>
          <Text style={styles.name}>Administrador movil</Text>
          <Text style={styles.role}>Optica Integral</Text>
        </View>

        <View style={styles.section}>
          {items.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={styles.rowText}>{item}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          ))}
        </View>

        <View style={styles.footerCard}>
          <Text style={styles.footerTitle}>Version movil</Text>
          <Text style={styles.footerCopy}>Vistas preparadas para conectar la logica despues.</Text>
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
  profileHeader: {
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#163b35',
    padding: 18,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dff0eb',
    marginBottom: 14,
  },
  avatarText: {
    color: '#176b5b',
    fontSize: 22,
    fontWeight: '900',
  },
  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  role: {
    color: '#bddbd3',
    marginTop: 5,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  rowText: {
    color: '#1d2927',
    fontSize: 16,
    fontWeight: '800',
  },
  chevron: {
    color: '#176b5b',
    fontSize: 24,
    fontWeight: '700',
  },
  footerCard: {
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e2df',
    padding: 16,
    gap: 5,
  },
  footerTitle: {
    color: '#172522',
    fontWeight: '900',
  },
  footerCopy: {
    color: '#65736f',
    lineHeight: 20,
  },
});
