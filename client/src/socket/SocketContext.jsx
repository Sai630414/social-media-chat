import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
const SocketContext = createContext(null);
export function SocketProvider({ children }) { const { session } = useAuth(); const [socket, setSocket] = useState(null); useEffect(() => { if (!session?.access_token) { setSocket(null); return; } const connection = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000', { auth: { token: session.access_token }, transports: ['websocket', 'polling'] }); setSocket(connection); return () => { connection.disconnect(); setSocket(null); }; }, [session?.access_token]); return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>; }
export const useSocket = () => useContext(SocketContext);
