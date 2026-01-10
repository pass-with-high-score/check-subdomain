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
                // Add local bin to PATH for yt-dlp
                PATH: `${process.env.HOME}/.local/bin:${process.env.HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin`,
            },
        },
    ],
};
