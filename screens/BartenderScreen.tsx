import React, { useEffect, useState } from 'react';
import { usePedidosSocket } from '../hooks/usePedidosSocket';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL

type Pedido = {
  id: number;
  drink: string;
  cliente_nome: string;
  status: string;
};

type Props = { token: string; onLogout: () => void };

export default function BartenderScreen({ token, onLogout }: Props) {
  const [cliente, setCliente] = useState('');
  const [drink, setDrink] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [sending, setSending] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  async function carregarPedidos(silent = false) {
    try {
      const res = await fetch(`${API_URL}/pedidos/bartender`, { headers: authHeaders });

      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.status !== 200) throw new Error('Falha ao buscar pedidos');

      const data: Pedido[] = await res.json();
      setPedidos(data);
    } catch (e) {
      if (!silent) Alert.alert('Erro', 'Não foi possível carregar os pedidos.');
    } finally {
      setLoadingList(false);
    }
  }

  // carga inicial
  useEffect(() => {
    carregarPedidos();
  }, []);

  const { connected } = usePedidosSocket({
    token,
    onSync: () => carregarPedidos(true),
    onMessage: (msg) => {
      if (msg.event === 'pedido.updated') {
        setPedidos((atual) =>
          atual.map((p) => (p.id === msg.payload.id ? { ...p, status: msg.payload.status } : p))
        );
      }
    },
  });

  async function handleEnviar() {
    if (!cliente.trim() || !drink.trim()) {
      Alert.alert('Atenção', 'Preencha o nome do cliente e o drink.');
      return;
    }

    try {
      setSending(true);
      const res = await fetch(`${API_URL}/pedidos/`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          drink: drink.trim(),
          cliente_nome: cliente.trim(),
        }),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      if (res.status !== 200) throw new Error('Falha ao criar pedido');

      const criado: Pedido = await res.json();
      setPedidos((atual) => [criado, ...atual]);
      setCliente('');
      setDrink('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar o pedido.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bartender</Text>
          <Text style={styles.subtitle}>Novo pedido</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {!connected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexão. Reconectando…</Text>
        </View>
      )}

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nome do cliente"
          placeholderTextColor="#9CA3AF"
          value={cliente}
          onChangeText={setCliente}
        />
        <TextInput
          style={styles.input}
          placeholder="Nome do drink"
          placeholderTextColor="#9CA3AF"
          value={drink}
          onChangeText={setDrink}
        />
        <TouchableOpacity
          style={[styles.button, sending && styles.buttonDisabled]}
          onPress={handleEnviar}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Enviar pedido</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Pedidos ({pedidos.length})</Text>

      {loadingList ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#2563EB" />
      ) : (
        <FlatList
          style={styles.list}
          data={pedidos}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido ainda.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.accent} />
              <View style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardDrink}>{item.drink}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardCliente}>{item.cliente_nome}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  logoutText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  button: {
    height: 50,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  list: { flex: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 24 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  accent: { width: 5, backgroundColor: '#2563EB' },
  cardContent: { flex: 1, paddingVertical: 14, paddingHorizontal: 16 },
  cardDrink: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cardCliente: { fontSize: 14, color: '#6B7280', marginTop: 3 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  offlineText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
});