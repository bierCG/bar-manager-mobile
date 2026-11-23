import React, { useEffect, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { usePedidosSocket } from '../hooks/usePedidosSocket';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
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

export default function ExpositorScreen({ token, onLogout }: Props) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const numColumns = width >= 900 ? 2 : 1;

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Entregue sai da tela; os demais são atualizados ou adicionados
  function upsertPedido(pedido: Pedido) {
    setPedidos((atual) => {
      if (pedido.status === 'ENTREGUE') {
        return atual.filter((p) => p.id !== pedido.id);
      }
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
      setPedidos(data.filter((p) => p.status !== 'ENTREGUE'));
    } catch (e) {
      if (!silent) Alert.alert('Erro', 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarPedidos();
  }, []);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.unlockAsync();
    };
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

  const abertos = pedidos.filter((p) => p.status === 'ABERTO');
  const prontos = pedidos.filter((p) => p.status === 'PRONTO');

  function renderCard(item: Pedido, color: string) {
    return (
      <View style={styles.card}>
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={styles.cardContent}>
          <Text style={styles.cardDrink}>{item.drink}</Text>
          <Text style={styles.cardCliente}>{item.cliente_nome}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expositor</Text>
        <TouchableOpacity
          onLongPress={onLogout}
          delayLongPress={1500}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      {!connected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexão. Reconectando…</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#2563EB" />
      ) : (
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={[styles.columnTitle, { color: '#2563EB' }]}>
              Abertos ({abertos.length})
            </Text>
            <FlatList
              key={numColumns}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
              data={abertos}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido.</Text>}
              renderItem={({ item }) => renderCard(item, '#2563EB')}
            />
          </View>

          <View style={styles.column}>
            <Text style={[styles.columnTitle, { color: '#16A34A' }]}>
              Finalizados ({prontos.length})
            </Text>
            <FlatList
              key={numColumns}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
              data={prontos}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum pedido.</Text>}
              renderItem={({ item }) => renderCard(item, '#16A34A')}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#111827' },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  logoutText: { color: '#374151', fontSize: 14, fontWeight: '600' },

  offlineBanner: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  offlineText: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },

  columns: { flex: 1, flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  columnTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
  },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 18 },

  card: {
    flex: 1,
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
  accent: { width: 8 },
  cardContent: { flex: 1, paddingVertical: 20, paddingHorizontal: 18 },
  cardDrink: { fontSize: 28, fontWeight: '700', color: '#111827' },
  cardCliente: { fontSize: 22, color: '#6B7280', marginTop: 4 },
});