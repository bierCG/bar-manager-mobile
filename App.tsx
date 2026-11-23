import React, { useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import LoginScreen from './screens/LoginScreen';
import CozinhaScreen from './screens/CozinhaScreen';
import BartenderScreen from './screens/BartenderScreen';
import ExpositorScreen from './screens/ExpositorScreen';

type Role = 'COZINHA' | 'BARTENDER' | 'EXPOSITOR';
type Payload = { role: Role; [key: string]: any };

export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function handleLogin(newToken: string) {
    const payload = jwtDecode<Payload>(newToken);
    setToken(newToken);
    setRole(payload.role);
  }

  function handleLogout() {
    setToken(null);
    setRole(null);
  }

  if (token && role === 'COZINHA') {
    return <CozinhaScreen token={token} onLogout={handleLogout} />;
  }
  if (token && role === 'BARTENDER') {
    return <BartenderScreen token={token} onLogout={handleLogout} />;
  }
  if (token && role === 'EXPOSITOR') {
    return <ExpositorScreen token={token} onLogout={handleLogout} />;
  }

  return <LoginScreen onLogin={handleLogin} />;
}