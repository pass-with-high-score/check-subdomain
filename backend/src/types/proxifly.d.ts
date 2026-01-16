declare module 'proxifly' {
    interface ProxiflyOptions {
        apiKey?: string;
    }

    interface GetProxyOptions {
        protocol?: 'http' | 'socks4' | 'socks5';
        anonymity?: 'transparent' | 'anonymous' | 'elite';
        country?: string;
        https?: boolean;
        speed?: number;
        format?: 'json' | 'text';
        quantity?: number;
    }

    interface ProxyResult {
        ipPort?: string;
        ip?: string;
        port?: number;
        protocol?: string;
        anonymity?: string;
        country?: string;
        https?: boolean;
        speed?: number;
    }

    class Proxifly {
        constructor(options?: ProxiflyOptions);
        getProxy(options?: GetProxyOptions): Promise<ProxyResult>;
    }

    export = Proxifly;
}
