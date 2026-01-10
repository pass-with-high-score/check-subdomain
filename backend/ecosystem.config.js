module.exports = {
    apps: [
        {
            name: 'cleanup-backend',
            script: 'dist/main.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: {
                NODE_ENV: 'production',
                PORT: 3010,
            },
        },
    ],
};
