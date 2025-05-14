import { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage: (channel: string, ...args: any[]) => void;
        on: (channel: string, func: (...args: any[]) => void) => () => void;
        once: (channel: string, func: (...args: any[]) => void) => void;
      };
      server: {
        start: () => void;
        stop: () => void;
        onStatusChange: (
          callback: (status: {
            running: boolean;
            url: string;
            connectedClients: number;
          }) => void,
        ) => () => void;
        onClientConnected: (callback: (count: number) => void) => () => void;
        onClientDisconnected: (callback: (count: number) => void) => () => void;
      };
    };
  }
}

function MainApp() {
  const [serverRunning, setServerRunning] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [connectedClients, setConnectedClients] = useState(0);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    // Listen for server status changes
    const unsubscribe = window.electron.server.onStatusChange((status) => {
      setServerRunning(status.running);
      setServerUrl(status.url);
      setConnectedClients(status.connectedClients);

      if (status.url) {
        // Generate QR code URL using a free QR code API
        setQrCodeUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(status.url)}`,
        );
      } else {
        setQrCodeUrl('');
      }
    });

    // Listen for client connection events
    const unsubscribeConnected = window.electron.server.onClientConnected(
      (count) => {
        setConnectedClients(count);
      },
    );

    const unsubscribeDisconnected = window.electron.server.onClientDisconnected(
      (count) => {
        setConnectedClients(count);
      },
    );

    return () => {
      unsubscribe();
      unsubscribeConnected();
      unsubscribeDisconnected();
    };
  }, []);

  const handleStartServer = () => {
    window.electron.server.start();
  };

  const handleStopServer = () => {
    window.electron.server.stop();
  };

  return (
    <div className="container">
      <div className="logo">
        <img width="150" alt="icon" src={icon} />
        <h1>AirClick</h1>
        <p>Remote Media Control</p>
      </div>

      <div className="server-controls">
        {!serverRunning ? (
          <button
            type="button"
            className="start-button"
            onClick={handleStartServer}
          >
            Start Server
          </button>
        ) : (
          <button
            type="button"
            className="stop-button"
            onClick={handleStopServer}
          >
            Stop Server
          </button>
        )}
      </div>

      {serverRunning && (
        <div className="server-info">
          <div className="url-display">
            <h3>Connect your mobile device</h3>
            <p>Open this URL on your mobile device:</p>
            <div className="url-box">{serverUrl}</div>
          </div>

          <div className="qr-code">
            <p>Or scan this QR code:</p>
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" width="150" height="150" />
            )}
          </div>

          <div className="client-info">
            <p>
              Connected clients:{' '}
              <span className="client-count">{connectedClients}</span>
            </p>
          </div>
        </div>
      )}

      <div className="footer">
        <p>Controls your media players via system media keys</p>
        <p>Works with Spotify, YouTube, VLC, and other media players</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
      </Routes>
    </Router>
  );
}
