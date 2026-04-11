module.exports = {
  apps: [{
    name: 'uirist-api',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      RIST_API_PORT: '3001',
    },
    // Graceful shutdown: let ristreceiver children finish
    kill_timeout: 5000,
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
