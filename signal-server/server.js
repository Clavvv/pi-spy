import WebSocket, { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 5151, host: '0.0.0.0' });
const clients = new Map();
wss.on('connection', (ws) => {
    let clientId = null;
    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        }
        catch (e) {
            console.error('Invalid JSON:', message.toString());
            return;
        }
        if (data.type === 'register' && data.id) {
            clientId = data.id;
            clients.set(clientId, ws);
            console.log(`Registered Client ${clientId}`);
            return;
        }
        if (data.command === 'activate' && data.target) {
            const targetWs = clients.get(data.target);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify(data));
            }
            return;
        }
        if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
            if (!data.target) {
                console.warn("No target specified for signalling message");
                return;
            }
            const targetWs = clients.get(data.target);
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify(data));
            }
            return;
        }
    });
    ws.on('close', () => {
        if (clientId) {
            clients.delete(clientId);
            console.log(`Client: ${clientId} has disconnected`);
        }
    });
});
console.log(`Signalling Server is running on ws://localhost:5151`);
