import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [correo, setCorreo] = useState('paciente@opticaintegral.demo');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (emailToUse?: string, passToUse?: string) => {
    const finalEmail = (emailToUse || correo).trim();
    const finalPass = passToUse || password;

    if (!finalEmail || !finalPass) {
      setError('Por favor ingresa correo y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(finalEmail, finalPass);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const seleccionarDemo = (rol: 'Paciente' | 'Admin') => {
    if (rol === 'Paciente') {
      setCorreo('paciente@opticaintegral.demo');
      setPassword('123456');
      setError('');
    } else {
      setCorreo('mateojosue17lozada@gmail.com');
      setPassword('123456');
      setError('');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>OI</Text>
            </View>
            <Text style={styles.title}>Óptica Integral</Text>
            <Text style={styles.subtitle}>Aplicación Móvil</Text>
          </View>

          {/* Botones de Acceso Rápido para Pruebas */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Selecciona un perfil para probar:</Text>
            <View style={styles.demoButtonsRow}>
              <Pressable
                style={[
                  styles.btnDemo,
                  correo === 'paciente@opticaintegral.demo' && styles.btnDemoActive,
                ]}
                onPress={() => seleccionarDemo('Paciente')}
              >
                <Text style={styles.btnDemoIcon}>👤</Text>
                <Text
                  style={[
                    styles.btnDemoText,
                    correo === 'paciente@opticaintegral.demo' && styles.btnDemoTextActive,
                  ]}
                >
                  Paciente
                </Text>
                <Text style={styles.btnDemoSub}>Citas y Agendar</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.btnDemo,
                  correo === 'mateojosue17lozada@gmail.com' && styles.btnDemoActive,
                ]}
                onPress={() => seleccionarDemo('Admin')}
              >
                <Text style={styles.btnDemoIcon}>📊</Text>
                <Text
                  style={[
                    styles.btnDemoText,
                    correo === 'mateojosue17lozada@gmail.com' && styles.btnDemoTextActive,
                  ]}
                >
                  Administrador
                </Text>
                <Text style={styles.btnDemoSub}>Solo Reportes</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={correo}
                onChangeText={setCorreo}
                placeholder="tu@correo.com"
                placeholderTextColor="#8a9692"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#8a9692"
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={() => handleLogin()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Iniciar Sesión</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f7f6',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoCircle: {
    width: 74,
    height: 74,
    borderRadius: 20,
    backgroundColor: '#163b35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#172522',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#65736f',
    marginTop: 2,
  },

  // Demo box
  demoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d7e2df',
    gap: 10,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#172522',
    textAlign: 'center',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnDemo: {
    flex: 1,
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#d7e2df',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
  },
  btnDemoActive: {
    borderColor: '#176b5b',
    backgroundColor: '#eef8f5',
  },
  btnDemoIcon: {
    fontSize: 20,
  },
  btnDemoText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4b5563',
  },
  btnDemoTextActive: {
    color: '#176b5b',
  },
  btnDemoSub: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },

  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d2927',
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2df',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#172522',
  },
  error: {
    color: '#d64545',
    fontWeight: '700',
    textAlign: 'center',
  },
  button: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#176b5b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});
