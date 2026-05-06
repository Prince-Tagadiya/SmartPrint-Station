import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { networkInterfaces } from 'os';

// Get the machine's LAN IP for dev mode HMR
function getLanIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const dev = process.env.NODE_ENV !== 'production';
// In dev mode, use LAN IP so HMR WebSocket works on mobile devices.
// In production, use 0.0.0.0 to bind all interfaces.
const hostname = process.env.HOSTNAME || (dev ? getLanIp() : '0.0.0.0');
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      
      // Intercept hardware routes to ensure they run in the master process
      if (parsedUrl.pathname?.startsWith('/api/hardware/')) {
        const { serialBridge } = await import('./src/services/SerialBridge');
        
        res.setHeader('Content-Type', 'application/json');

        if (parsedUrl.pathname === '/api/hardware/serial' && req.method === 'GET') {
          res.end(JSON.stringify({ success: true, data: serialBridge.getStatus() }));
          return;
        }
        
        if (parsedUrl.pathname === '/api/hardware/ports' && req.method === 'GET') {
          const ports = await serialBridge.getAvailablePorts();
          res.end(JSON.stringify({ success: true, data: ports }));
          return;
        }

        if (parsedUrl.pathname === '/api/hardware/disconnect' && req.method === 'POST') {
          const success = await serialBridge.disconnect();
          res.end(JSON.stringify({ success, message: 'Disconnected' }));
          return;
        }

        if (parsedUrl.pathname === '/api/hardware/connect' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { path } = JSON.parse(body);
              if (!path) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Port path is required' }));
                return;
              }
              const success = await serialBridge.connect(path);
              if (success) {
                res.end(JSON.stringify({ success: true, message: `Connected to ${path}` }));
              } else {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: `Failed to connect to ${path}` }));
              }
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
            }
          });
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  // Dynamically import serialBridge so it runs only on the server
  import('./src/services/SerialBridge').then(({ serialBridge }) => {
    serialBridge.setBroadcaster((message: string) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    });
  }).catch(err => {
    console.error('Failed to load SerialBridge:', err);
  });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Simple broadcast logic or channel subscription
        if (data.type === 'subscribe') {
          (ws as any).channel = data.channel;
        } else {
          // Broadcast to matching channels
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              if ((client as any).channel === data.channel || data.channel === 'global') {
                client.send(message.toString());
              }
            }
          });
        }
      } catch (e) {
        console.error('WS Error:', e);
      }
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '/', true);
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Also accessible from http://0.0.0.0:${port}`);
  });
});
