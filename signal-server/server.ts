import WebSocket, { WebSocketServer } from 'ws';
type messageType = 'offer' | 'answer' | 'candidate' |'command'
interface baseMessage {
    type: string;
    sender: string;
    target?: string;
    timestamp?: number;
}

interface OfferMessage extends baseMessage {
    type: 'offer';
    sdp: RTCSessionDescriptionInit;
}

interface AnswerMessage extends baseMessage {
    type: 'answer';
    sdp: RTCSessionDescriptionInit;
}

interface CandidateMessage extends baseMessage {
    type: 'candidate';
    candidate: RTCIceCandidateInit;
}

interface CommandMessage extends baseMessage {
    type: 'command';
    command: 'register' | 'activate' | 'heartbeat' | string;
    payload?: Record<string, any>;
}


type SignallingMessage = OfferMessage | AnswerMessage | CandidateMessage | CommandMessage
    

const wss = new WebSocketServer({ port: 5151, host: '0.0.0.0' })
const clients = new Map<string, WebSocket>();

const isSignallingMessage = (message:any) => {
    /*
        Ensures all fields are filled out and have correct types
    */
    return (message && typeof message === 'object' && typeof message.type === "string" && typeof message.sender === "string")
}

function handleMessage(ws: WebSocket, rawMessage:WebSocket.RawData){
        
        let data: SignallingMessage;
        try {
            data = JSON.parse(rawMessage.toString())
            console.log('Received: ', data)
        } catch (e) {
            console.error("Invalid JSON:", rawMessage.toString())
            return;
        }

        if (data.type === 'command') {

            if (data.command === 'register') {
                clients.set(data.sender, ws)
                console.log(`Registerred Client: ${data.sender}`)
                return;
            }

            if (data.command === 'activate' && data.target) {
                const targetWs = clients.get(data.target)
                console.log(`Sending Activate to: ${data.target}`)
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify(data))
                    return;
                } else {
                    console.log('No target found or target is not in ready state')
                    return
                }
            }
        }

        if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
            if (!data.target) {
                console.warn("No target specified for signalling message...")
                return;
            }

            const targetWs = clients.get(data.target)
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify(data));
            } else {
                console.log('Target not registerred or not in ready state')
            }
            return;
        }
}

wss.on('connection', (ws: WebSocket) => {
    let clientId: string | null = null;
    console.log('a client has connected')
    ws.on('message', (message: WebSocket.RawData) => {
        console.log([...clients.keys()]);
        // all logic passed to this function
        handleMessage(ws, message);
    })

    ws.on('close', () => {
        if (clientId) {
            clients.delete(clientId);
            console.log(`Client: ${clientId} has disconnected`)
        }
    })
})

console.log(`Signalling Server is running on ws://localhost:5151`)