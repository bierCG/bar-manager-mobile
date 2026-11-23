import React, { useEffect, useState } from 'react';
import { usePedidosSocket } from '../hooks/usePedidosSocket';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Status = 'ABERTO' | 'PRONTO' | 'ENTREGUE';

type Pedido = {
  id: number;
  drink: string;
  cliente_nome: string;
  status: Status;
};

type Props = { token: string; onLogout: () => void };

export default function CozinhaScreen({ token, onLogout }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Atualiza o pedido se já existe, ou adiciona no topo se for novo
  function upsertPedido(pedido: Pedido) {
    setPedidos((atual) => {
      const existe = atual.some((p) => p.id === pedido.id);
      if (existe) return atual.map((p) => (p.id === pedido.id ? pedido : p));
      return [pedido, ...atual];
    });
  }

  async function carregarPedidos(silent = false) {
    try {
      const res = await fetch(`${API_URL}/pedidos/`, { headers: authHeaders });

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
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  const { connected } = usePedidosSocket({
    token,
    onSync: () => carregarPedidos(true),
    onMessage: (msg) => {
      if (msg.event === 'pedido.created' || msg.event === 'pedido.updated') {
        upsertPedido(msg.payload);
      }
    },
  });

  async function alterarStatus(pedido: Pedido, novoStatus: Status) {
    try {
      setUpdatingId(pedido.id);
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: novoStatus }),
      });

      if (res.status === 401) {
        onLogout();
        return;
      }
      if (res.status !== 200) throw new Error('Falha ao atualizar status');

      const atualizado: Pedido = await res.json();
      upsertPedido(atualizado);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar o pedido.');
    } finally {
      setUpdatingId(null);
    }
  }

  const abertos = pedidos.filter((p) => p.status === 'ABERTO');
  const prontos = pedidos.filter((p) => p.status === 'PRONTO');
  const entregues = pedidos.filter((p) => p.status === 'ENTREGUE');

  function renderCard(
    item: Pedido,
    label: string,
    proximo: Status,
    color: string
  ) {
    const busy = updatingId === item.id;
    return (
      <View style={styles.card}>
        <Text style={styles.cardDrink}>{item.drink}</Text>
        <Text style={styles.cardCliente}>{item.cliente_nome}</Text>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: color }, busy && styles.disabled]}
          onPress={() => alterarStatus(item, proximo)}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionText}>{label}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cozinha</Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#2563EB" />
      ) : (
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.columnTitle}>Abertos ({abertos.length})</Text>
            <FlatList
              data={abertos}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido.</Text>}
              renderItem={({ item }) => renderCard(item, 'Finalizar', 'PRONTO', '#2563EB')}
            />
          </View>

          <View style={styles.column}>
            <Text style={styles.columnTitle}>Finalizados ({prontos.length})</Text>
            <FlatList
              data={prontos}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido.</Text>}
              renderItem={({ item }) => renderCard(item, 'Entregar', 'ENTREGUE', '#16A34A')}
            />
          </View>
        </View>
      )}

      {/* Menu oculto: pedidos entregues */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.modalRoot}>
          <SafeAreaView style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Entregues ({entregues.length})</Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <Text style={styles.drawerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={entregues}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido entregue.</Text>}
              renderItem={({ item }) => (
                <View style={styles.deliveredCard}>
                  <Text style={styles.cardDrink}>{item.drink}</Text>
                  <Text style={styles.cardCliente}>{item.cliente_nome}</Text>
                </View>
              )}
            />
          </SafeAreaView>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: { fontSize: 20, color: '#374151' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  logoutText: { color: '#374151', fontSize: 14, fontWeight: '600' },

  columns: { flex: 1, flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  columnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 16, fontSize: 13 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardDrink: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardCliente: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 10 },
  actionButton: {
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.7 },

  modalRoot: { flex: 1, flexDirection: 'row' },
  drawer: {
    width: '75%',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  drawerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  drawerClose: { fontSize: 20, color: '#6B7280' },
  deliveredCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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