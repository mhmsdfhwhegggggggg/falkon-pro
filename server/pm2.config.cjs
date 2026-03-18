module.exports = {
  apps: [
    {
      name: 'dragon-api',
      script: './dist/index.js',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: 5000,
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'dragon-worker',
      script: './dist/worker.js',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
      min_uptime: 5000,
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
