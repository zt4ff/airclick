import express from 'express';
import cors from 'cors';
import path from 'path';
import { networkInterfaces } from 'os';
import { app } from 'electron';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';

class RemoteServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private port: number = 3000;
  private serverUrl: string = '';
  private connectedClients: number = 0;
  private mediaControlHandler: MediaControlHandler;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['*'],
      },
      transports: ['websocket', 'polling'],
    });
    this.mediaControlHandler = new MediaControlHandler();
    this.setupMiddleware();
    this.ensureRemoteWebExists();
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(app.getAppPath(), 'remote-web')));
  }

  private ensureRemoteWebExists() {
    const remoteWebDir = path.join(app.getAppPath(), 'remote-web');

    if (!fs.existsSync(remoteWebDir)) {
      fs.mkdirSync(remoteWebDir, { recursive: true });

      // Create index.html
      const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>AirClick Remote</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background: linear-gradient(200.96deg, #2d3748 0%, #1a202c 47.67%, #171923 100%);
      color: white;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      touch-action: manipulation;
      -webkit-user-select: none;
      user-select: none;
    }
    
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 20px;
    }
    
    header {
      text-align: center;
      padding: 20px 0;
    }
    
    h1 {
      font-size: 24px;
      color: #63b3ed;
      margin-bottom: 5px;
    }
    
    .status {
      color: #a0aec0;
      font-size: 14px;
    }
    
    .connected {
      color: #48bb78;
    }
    
    .controls {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 20px;
      padding: 20px 0;
    }
    
    .button {
      background-color: rgba(45, 55, 72, 0.5);
      border: 2px solid rgba(99, 179, 237, 0.5);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    
    .button:active {
      background-color: rgba(99, 179, 237, 0.3);
      transform: scale(0.98);
    }
    
    .button svg {
      width: 24px;
      height: 24px;
      margin-right: 10px;
    }
    
    .button-row {
      display: flex;
      gap: 20px;
    }
    
    .button-row .button {
      flex: 1;
    }
    
    footer {
      text-align: center;
      padding: 20px 0;
      color: #a0aec0;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>AirClick Remote</h1>
      <div class="status">Connecting...</div>
    </header>
    
    <div class="controls">
      <div class="button-row">
        <div class="button" id="previous">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.95 5l-9.97 7 9.97 7V5zm-11.97 0v14H5V5h2.98z"/>
          </svg>
          Previous
        </div>
        <div class="button" id="next">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 5v14l9.97-7L4 5zm11.03 0v14H18V5h-2.97z"/>
          </svg>
          Next
        </div>
      </div>
      
      <div class="button" id="play-pause">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Play/Pause
      </div>
    </div>
    
    <footer>
      <p>Connected to AirClick Desktop</p>
    </footer>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const statusEl = document.querySelector('.status');
      const playPauseBtn = document.getElementById('play-pause');
      const nextBtn = document.getElementById('next');
      const previousBtn = document.getElementById('previous');
      
      // Connect to WebSocket server
      const socket = io();
      
      // Update connection status
      socket.on('connect', () => {
        statusEl.textContent = 'Connected';
        statusEl.classList.add('connected');
      });
      
      socket.on('disconnect', () => {
        statusEl.textContent = 'Disconnected';
        statusEl.classList.remove('connected');
      });
      
      // Add event listeners for buttons
      playPauseBtn.addEventListener('click', () => {
        socket.emit('media-command', 'play-pause');
        
        // Visual feedback
        playPauseBtn.style.backgroundColor = 'rgba(99, 179, 237, 0.3)';
        setTimeout(() => {
          playPauseBtn.style.backgroundColor = '';
        }, 200);
      });
      
      nextBtn.addEventListener('click', () => {
        socket.emit('media-command', 'next');
        
        // Visual feedback
        nextBtn.style.backgroundColor = 'rgba(99, 179, 237, 0.3)';
        setTimeout(() => {
          nextBtn.style.backgroundColor = '';
        }, 200);
      });
      
      previousBtn.addEventListener('click', () => {
        socket.emit('media-command', 'previous');
        
        // Visual feedback
        previousBtn.style.backgroundColor = 'rgba(99, 179, 237, 0.3)';
        setTimeout(() => {
          previousBtn.style.backgroundColor = '';
        }, 200);
      });
      
      // Prevent default touch behavior to avoid delays
      document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.button')) {
          e.preventDefault();
        }
      }, { passive: false });
    });
  </script>
</body>
</html>
      `;

      fs.writeFileSync(path.join(remoteWebDir, 'index.html'), indexHtml);
    }
  }

  private setupRoutes() {
    // API routes for remote control
    this.app.post('/api/media/play-pause', (req, res) => {
      this.mediaControlHandler.playPause();
      res.json({ success: true, action: 'play-pause' });
    });

    this.app.post('/api/media/next', (req, res) => {
      this.mediaControlHandler.next();
      res.json({ success: true, action: 'next' });
    });

    this.app.post('/api/media/previous', (req, res) => {
      this.mediaControlHandler.previous();
      res.json({ success: true, action: 'previous' });
    });

    this.app.post('/api/media/volume', (req, res) => {
      const { level } = req.body;
      this.mediaControlHandler.setVolume(level);
      res.json({ success: true, action: 'volume', level });
    });

    // Serve the web app for remote devices
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(app.getAppPath(), 'remote-web/index.html'));
    });
  }

  private setupSocketIO() {
    this.io.on('connection', (socket) => {
      this.connectedClients++;
      console.log(`Client connected. Total clients: ${this.connectedClients}`);

      // Emit event to desktop app about new connection
      this.emitConnectionStatus();

      socket.on('media-command', (command) => {
        switch (command) {
          case 'play-pause':
            this.mediaControlHandler.playPause();
            break;
          case 'next':
            this.mediaControlHandler.next();
            break;
          case 'previous':
            this.mediaControlHandler.previous();
            break;
          default:
            console.log(`Unknown command: ${command}`);
        }
      });

      socket.on('volume', (level) => {
        this.mediaControlHandler.setVolume(level);
      });

      socket.on('disconnect', () => {
        this.connectedClients--;
        console.log(
          `Client disconnected. Total clients: ${this.connectedClients}`,
        );
        this.emitConnectionStatus();
      });
    });
  }

  private emitConnectionStatus() {
    this.io.emit('connection-status', {
      connectedClients: this.connectedClients,
    });
  }

  public getLocalIpAddress(): string {
    const interfaces = networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            return alias.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }

  public start(): Promise<string> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        const ipAddress = this.getLocalIpAddress();
        this.serverUrl = `http://${ipAddress}:${this.port}`;
        console.log(`Server running at: ${this.serverUrl}`);
        resolve(this.serverUrl);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error) => {
          if (err) {
            reject(err);
          } else {
            this.serverUrl = '';
            this.connectedClients = 0;
            console.log('Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getConnectedClients(): number {
    return this.connectedClients;
  }
}

class MediaControlHandler {
  constructor() {}

  public playPause(): void {
    this.sendMediaKey('play-pause');
  }

  public next(): void {
    this.sendMediaKey('next');
  }

  public previous(): void {
    this.sendMediaKey('previous');
  }

  public setVolume(level: number): void {
    // Volume control implementation would depend on the OS
    console.log(`Setting volume to ${level}`);
  }

  private sendMediaKey(key: string): void {
    try {
      const platform = process.platform;

      if (platform === 'darwin') {
        // macOS implementation
        switch (key) {
          case 'play-pause':
            execSync(
              'osascript -e "tell application \\"System Events\\" to key code 100"',
            );
            break;
          case 'next':
            execSync(
              'osascript -e "tell application \\"System Events\\" to key code 101"',
            );
            break;
          case 'previous':
            execSync(
              'osascript -e "tell application \\"System Events\\" to key code 98"',
            );
            break;
        }
      } else if (platform === 'win32') {
        // Windows implementation using PowerShell
        const script = `
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait('{MEDIA${this.getWindowsKeyCode(key)}}')
        `;
        execSync(`powershell -Command "${script}"`);
      } else if (platform === 'linux') {
        // Linux implementation
        switch (key) {
          case 'play-pause':
            execSync('playerctl play-pause || xdotool key XF86AudioPlay');
            break;
          case 'next':
            execSync('playerctl next || xdotool key XF86AudioNext');
            break;
          case 'previous':
            execSync('playerctl previous || xdotool key XF86AudioPrev');
            break;
        }
      }
    } catch (error) {
      console.error('Error sending media key:', error);
    }
  }

  private getWindowsKeyCode(key: string): string {
    switch (key) {
      case 'play-pause':
        return 'PLAYPAUSE';
      case 'next':
        return 'NEXTTRACK';
      case 'previous':
        return 'PREVTRACK';
      default:
        return '';
    }
  }
}

export default RemoteServer;
