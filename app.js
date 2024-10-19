import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from 'cors';

const app = express();
const server = createServer(app); // Correctly create the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = 3000;

// Apply CORS middleware for HTTP requests
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
}));

io.on('connection', (socket) => {
  console.log("User connected", socket.id);

  socket.on('message', ({ message, room }) => {
    console.log("message is recieved by client",{message,room})
    io.to(room).emit("receive-msg", message);
  });

  // Broadcaster starts the stream
  socket.on('start_stream', (roomId) => {
    socket.join(roomId);
    socket.isBroadcaster = true;
    console.log(`Broadcaster started stream in room: ${roomId}`);
  });

  // Handle new user joining
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);

    const broadcaster = getBroadcasterInRoom(roomId);
    if (broadcaster) {
      socket.to(broadcaster.id).emit('viewer_joined', { userId: socket.id });
    }
  });

  // Relay the broadcaster's stream
  socket.on('relay_stream', (data) => {
    const { roomId, viewerId, stream } = data;
    io.to(viewerId).emit('receive_stream', stream);
  });

  socket.on('accept_viewer', (data) => {
    const { roomId, viewerId } = data;
    io.to(viewerId).emit('view_accepted');
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.isBroadcaster) {
      console.log('Broadcaster disconnected:', socket.id);
      io.in(socket.roomId).emit('broadcaster_disconnected');
    } else {
      console.log('Viewer disconnected:', socket.id);
    }
  });
});

// Helper function to get the broadcaster in a room
function getBroadcasterInRoom(roomId) {
  const clients = io.sockets.adapter.rooms.get(roomId);
  if (clients) {
    for (let clientId of clients) {
      const clientSocket = io.sockets.sockets.get(clientId);
      if (clientSocket.isBroadcaster) {
        return clientSocket;
      }
    }
  }
  return null;
}

// Basic route
app.get('/', (req, res) => {
  res.send("Hello everyone");
});

// Start server
server.listen(PORT, () => {
  console.log(`App is running on port ${PORT}`);
});
