import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface ChatMessage {
    id: string;
    message: string;
    username: string;
    color: string;
    timestamp: number;
}

// Random animal names for anonymous users
const ANIMALS = [
    'Panda', 'Tiger', 'Fox', 'Wolf', 'Bear', 'Lion', 'Eagle', 'Hawk',
    'Owl', 'Rabbit', 'Deer', 'Koala', 'Penguin', 'Dolphin', 'Whale',
    'Turtle', 'Cat', 'Dog', 'Duck', 'Swan', 'Crow', 'Raven', 'Parrot',
];

// Neo-Brutalism colors - bold and easy to read
const COLORS = [
    '#FF0000', // Red
    '#0000FF', // Blue
    '#FF6600', // Orange
    '#FF00FF', // Pink/Magenta
    '#009900', // Dark Green
    '#CC0066', // Dark Pink
    '#6600CC', // Purple
    '#006699', // Dark Cyan
];

function generateUsername(): string {
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const number = Math.floor(Math.random() * 1000);
    return `${animal}${number}`;
}

function generateColor(): string {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('ChatGateway');
    private users: Map<string, { username: string; color: string }> = new Map();
    private messageHistory: ChatMessage[] = [];
    private readonly MAX_HISTORY = 50;

    // Rate limiting: track message timestamps per client
    private messageTimes: Map<string, number[]> = new Map();
    private readonly RATE_LIMIT_WINDOW = 5000; // 5 seconds
    private readonly RATE_LIMIT_MAX = 5; // max 5 messages per window
    private rateLimitedUntil: Map<string, number> = new Map();

    constructor(private readonly databaseService: DatabaseService) { }

    async afterInit() {
        try {
            // Initialize database table
            await this.databaseService.initChatMessagesTable();

            // Load message history from database
            this.messageHistory = await this.databaseService.getRecentChatMessages(this.MAX_HISTORY);
            this.logger.log(`📝 Loaded ${this.messageHistory.length} messages from database`);
        } catch (error) {
            this.logger.error('Failed to initialize chat from database', error);
        }
    }

    handleConnection(client: Socket) {
        // Check if client sent saved username/color
        const query = client.handshake.query;
        const savedUsername = typeof query.username === 'string' ? query.username : null;
        const savedColor = typeof query.color === 'string' ? query.color : null;

        // Use saved or generate new
        const username = savedUsername || generateUsername();
        const color = savedColor && COLORS.includes(savedColor) ? savedColor : generateColor();

        this.users.set(client.id, { username, color });

        this.logger.log(`Client connected: ${client.id} as ${username}${savedUsername ? ' (restored)' : ' (new)'}`);

        // Send user info to the connected client
        client.emit('userInfo', { username, color });

        // Send message history
        client.emit('messageHistory', this.messageHistory);

        // Broadcast online count
        this.broadcastOnlineCount();
    }

    handleDisconnect(client: Socket) {
        const user = this.users.get(client.id);
        this.logger.log(`Client disconnected: ${client.id} (${user?.username})`);
        this.users.delete(client.id);
        this.broadcastOnlineCount();
    }

    @SubscribeMessage('rerandomUsername')
    handleRerandomUsername(@ConnectedSocket() client: Socket) {
        const newUsername = generateUsername();
        const newColor = generateColor();
        this.users.set(client.id, { username: newUsername, color: newColor });

        this.logger.log(`Client ${client.id} rerandomized to ${newUsername}`);

        // Send new user info
        client.emit('userInfo', { username: newUsername, color: newColor });
    }

    @SubscribeMessage('sendMessage')
    handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() message: string,
    ) {
        const user = this.users.get(client.id);
        if (!user || !message?.trim()) return;

        // Check if user is rate limited
        const now = Date.now();
        const blockedUntil = this.rateLimitedUntil.get(client.id) || 0;
        if (now < blockedUntil) {
            const remainingSeconds = Math.ceil((blockedUntil - now) / 1000);
            client.emit('rateLimited', { seconds: remainingSeconds });
            return;
        }

        // Track message times for rate limiting
        const times = this.messageTimes.get(client.id) || [];
        const recentTimes = times.filter(t => now - t < this.RATE_LIMIT_WINDOW);
        recentTimes.push(now);
        this.messageTimes.set(client.id, recentTimes);

        // Check if exceeded rate limit
        if (recentTimes.length > this.RATE_LIMIT_MAX) {
            this.rateLimitedUntil.set(client.id, now + this.RATE_LIMIT_WINDOW);
            client.emit('rateLimited', { seconds: 5 });
            this.logger.warn(`Client ${client.id} (${user.username}) rate limited for spam`);
            return;
        }

        // Sanitize and limit message length
        const sanitizedMessage = message.trim().slice(0, 500);

        const chatMessage: ChatMessage = {
            id: generateId(),
            message: sanitizedMessage,
            username: user.username,
            color: user.color,
            timestamp: Date.now(),
        };

        // Add to history
        this.messageHistory.push(chatMessage);
        if (this.messageHistory.length > this.MAX_HISTORY) {
            this.messageHistory.shift();
        }

        // Broadcast to all clients
        this.server.emit('newMessage', chatMessage);

        // Save to database (async, don't block)
        this.databaseService.saveChatMessage(chatMessage).catch(err => {
            this.logger.error('Failed to save message to database', err);
        });
    }

    private broadcastOnlineCount() {
        this.server.emit('onlineCount', this.users.size);
    }
}
