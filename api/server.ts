/**
 * local server entry file, for local development
 */
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:activity', (activityId: string) => {
    socket.join(activityId);
    console.log(`Client ${socket.id} joined activity: ${activityId}`);
  });

  socket.on('leave:activity', (activityId: string) => {
    socket.leave(activityId);
    console.log(`Client ${socket.id} left activity: ${activityId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
