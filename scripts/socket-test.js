const { io } = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected with id', socket.id);
});

socket.on('status_update', (data) => {
  console.log('status_update', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

setTimeout(() => {
  console.log('Closing socket after 30s');
  socket.close();
  process.exit(0);
}, 30000);
