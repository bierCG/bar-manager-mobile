import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Options = {
  token: string;
  onMessage: (msg: any) => void; // mensagem { event, payload } do WebSocket
  onSync: () => void;            // recarrega tudo (chamado a cada (re)conexão)
};

export function usePedidosSocket({ token, onMessage, onSync }: Options) {
  const [connected, setConnected] = useState(false);

  // refs evitam closures desatualizadas dentro do efeito
  const onMessageRef = useRef(onMessage);
  const onSyncRef = useRef(onSync);
  onMessageRef.current = onMessage;
  onSyncRef.current = onSync;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closedByUs = false;
    let wasOffline = false;

    function connect() {
      if (closedByUs) return;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const wsBase = (API_URL ?? '').replace(/^http/, 'ws');
      const socket = new WebSocket(`${wsBase}/ws/bar?token=${token}`); // ajuste o endpoint
      ws = socket;

      socket.onopen = () => {
        if (ws !== socket) return;
        setConnected(true);
        onSyncRef.current(); // sincroniza a cada conexão, cobrindo o que foi perdido
      };

      socket.onmessage = (event) => {
        try {
          onMessageRef.current(JSON.parse(event.data));
        } catch (e) {
          // ignora mensagens fora do formato
        }
      };

      socket.onerror = () => socket.close();

      socket.onclose = () => {
        if (ws !== socket) return; // socket antigo, já substituído
        setConnected(false);
        if (!closedByUs) timer = setTimeout(connect, 3000);
      };
    }

    connect();

    // Detecta queda e volta da internet
    const unsubNet = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;

      if (!online) {
        wasOffline = true;
        setConnected(false);
        return;
      }

      if (wasOffline) {
        // internet voltou: descarta o socket possivelmente morto e reconecta já
        wasOffline = false;
        clearTimeout(timer);
        const old = ws;
        ws = null;
        old?.close();
        connect();
      }
    });

    // Ao voltar do segundo plano, sincroniza e garante a conexão
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        onSyncRef.current();
        connect();
      }
    });

    return () => {
      closedByUs = true;
      clearTimeout(timer);
      unsubNet();
      appStateSub.remove();
      ws?.close();
    };
  }, [token]);

  return { connected };
}