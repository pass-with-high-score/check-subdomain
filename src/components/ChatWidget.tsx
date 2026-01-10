'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import styles from './ChatWidget.module.css';

interface ChatMessage {
    id: string;
    message: string;
    username: string;
    color: string;
    timestamp: number;
}

interface UserInfo {
    username: string;
    color: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3001';
const STORAGE_KEY = 'devtools_chat_user';

// Load saved user from localStorage
function loadSavedUser(): UserInfo | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

// Save user to localStorage
function saveUser(user: UserInfo) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
        // Ignore storage errors
    }
}

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const savedUser = loadSavedUser();

        const socket = io(`${BACKEND_URL}/chat`, {
            transports: ['websocket', 'polling'],
            query: savedUser ? { username: savedUser.username, color: savedUser.color } : {},
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('userInfo', (info: UserInfo) => {
            setUserInfo(info);
            saveUser(info); // Save to localStorage
        });

        socket.on('messageHistory', (history: ChatMessage[]) => {
            setMessages(history);
        });

        socket.on('newMessage', (message: ChatMessage) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('onlineCount', (count: number) => {
            setOnlineCount(count);
        });

        socket.on('rateLimited', (data: { seconds: number }) => {
            setRateLimitSeconds(data.seconds);
            // Countdown timer
            const timer = setInterval(() => {
                setRateLimitSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    const sendMessage = () => {
        const trimmed = inputValue.trim();
        if (!trimmed || !socketRef.current) return;

        socketRef.current.emit('sendMessage', trimmed);
        setInputValue('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const rerandomUsername = () => {
        if (!socketRef.current) return;
        // Clear saved user and request new one
        localStorage.removeItem(STORAGE_KEY);
        socketRef.current.emit('rerandomUsername');
    };

    return (
        <>
            {/* Chat Toggle Button */}
            <button
                className={`${styles.toggleButton} ${isOpen ? styles.open : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle chat"
            >
                {isOpen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}
                {!isOpen && onlineCount > 0 && (
                    <span className={styles.badge}>{onlineCount}</span>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className={styles.chatWindow}>
                    <div className={styles.header}>
                        <div className={styles.headerInfo}>
                            <span className={styles.title}>Anonymous Chat</span>
                            <span className={styles.status}>
                                <span className={`${styles.statusDot} ${isConnected ? styles.connected : ''}`} />
                                {onlineCount} online
                            </span>
                        </div>
                        {userInfo && (
                            <div className={styles.userRow}>
                                <span className={styles.username} style={{ color: userInfo.color }}>
                                    You: {userInfo.username}
                                </span>
                                <button
                                    className={styles.rerandomBtn}
                                    onClick={rerandomUsername}
                                    title="Get new random name"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M23 4v6h-6" />
                                        <path d="M1 20v-6h6" />
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.messages}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No messages yet</p>
                                <p className={styles.emptyHint}>Be the first to say hi! 👋</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`${styles.message} ${msg.username === userInfo?.username ? styles.own : ''}`}
                                >
                                    <div className={styles.messageHeader}>
                                        <span className={styles.messageUser} style={{ color: msg.color }}>
                                            {msg.username}
                                        </span>
                                        <span className={styles.messageTime}>
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <div className={styles.messageContent}>{msg.message}</div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        {rateLimitSeconds > 0 ? (
                            <div className={styles.rateLimitWarning}>
                                Slow down! Wait {rateLimitSeconds}s...
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Type a message..."
                                    maxLength={500}
                                    disabled={!isConnected}
                                    className={styles.input}
                                />
                                <button
                                    onClick={sendMessage}
                                    disabled={!inputValue.trim() || !isConnected}
                                    className={styles.sendButton}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
