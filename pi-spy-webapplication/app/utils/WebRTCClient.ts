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

export class WebRTCClient {
    private signalingUrl: string;
    private remoteVideoElement: HTMLVideoElement | null = null;
    private pc: RTCPeerConnection | null = null;
    private ws: WebSocket | null = null;
    private localStream: MediaStream | null = null;
    private clientId: string;
    private targetId?: string;


    constructor(signalingUrl: string, clientId:string) {
        this.signalingUrl = signalingUrl;
        this.clientId = clientId
    }

    public setTarget(id:string) {
        this.targetId = id;
    }

    public setVideoElement(element: HTMLVideoElement) {
        this.remoteVideoElement = element;
    }

    public async start(): Promise<void> {
        this.ws = new WebSocket(this.signalingUrl);
        this.ws.onmessage = (msg) => this.handleSignal(JSON.parse(msg.data));
        this.ws.onopen = () => {
            console.log('Websocket connected')
            const registerMessage: CommandMessage = {
                type: 'command', 
                command: 'register',
                sender: this.clientId,
                timestamp: Date.now()
            };
            this.sendMessage(registerMessage)
        }
    }

    public async onTrackHandler(event: RTCTrackEvent) {
        if (this.remoteVideoElement) {
            this.remoteVideoElement.srcObject = event.streams[0]
        } else {
            console.warn('No video element set to attach stream')
        }
    }

    private async initPeerConnection(): Promise<void> {
        const config: RTCConfiguration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };

        this.pc = new RTCPeerConnection(config);

        this.pc.ontrack = (event: RTCTrackEvent) => {
            this.onTrackHandler(event)
        };

        this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate && this.targetId && this.ws && this.ws.readyState === WebSocket.OPEN) {
                const message: SignallingMessage = { type: 'candidate', sender: this.clientId, target:this.targetId, timestamp: Date.now(), candidate: event.candidate.toJSON() };
                this.ws.send(JSON.stringify(message));
            } else {
                console.warn('Failed to send ice candidate. Either target is missing or target is unable to receive messages')
            };
        };
    };
    public sendMessage(message: object): void {
        console.log(message)
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        } else {
            console.warn('Websocket is not open cant send data', message)
        }
    }

    public sendActivate(target:string): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const activateMsg: CommandMessage = {
                type: 'command',
                command: 'activate',
                target: target,
                sender: this.clientId,
                timestamp: Date.now()
            }
            this.ws.send(JSON.stringify(activateMsg))
        }
    }
    private async handleSignal(message: SignallingMessage): Promise<void> {
        if (!this.pc) {
            await this.initPeerConnection();
        }

        if (!this.pc) {
            console.error('PeerConnection not initialized')
            return;
        }

        console.log(`message: ${message}`)
        switch (message.type) {
            case 'offer':
                try {
                    await this.pc.setRemoteDescription(new RTCSessionDescription(message.sdp))
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({ type: 'answer', target: this.targetId, sender: this.clientId, sdp: this.pc.localDescription }))
                    }
                } catch (error) {
                    console.error('Error handling offer:', error)
                }
                break;

            case 'candidate':
                if (message.candidate){
                    try {
                        await this.pc.addIceCandidate(new RTCIceCandidate(message.candidate))
                    } catch (error) {
                        console.error('Error adding ICE Candidate', error)
                    }
                }
                break;

            default:
                console.warn('Unhandled message type:', message.type)
        }
    }

    public close(): void {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.remoteVideoElement) {
            this.remoteVideoElement.srcObject = null;
        }
    }
}