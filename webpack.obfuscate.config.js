/**
 * Webpack Configuration for Code Obfuscation
 * 
 * This configuration uses javascript-obfuscator to protect the code
 * from reverse engineering and unauthorized modifications.
 * 
 * @author Manus AI
 * @version 2.0.0
 */

const path = require('path');
const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = {
  mode: 'production',
  target: 'node',
  
  entry: {
    index: './dist/index.js',
    worker: './dist/worker.js',
  },
  
  output: {
    path: path.resolve(__dirname, 'dist-obfuscated'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  
  externals: {
    // Don't bundle node_modules
    express: 'commonjs express',
    'ioredis': 'commonjs ioredis',
    'bullmq': 'commonjs bullmq',
    'drizzle-orm': 'commonjs drizzle-orm',
    'telegram': 'commonjs telegram',
    'postgres': 'commonjs postgres',
    'mysql2': 'commonjs mysql2',
  },
  
  plugins: [
    new JavaScriptObfuscator({
      // String obfuscation
      stringArray: true,
      stringArrayThreshold: 0.75,
      stringArrayEncoding: ['base64'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      
      // Control flow obfuscation
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      
      // Dead code injection
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      
      // Identifier obfuscation
      identifierNamesGenerator: 'hexadecimal',
      identifiersPrefix: '_0x',
      renameGlobals: false,
      renameProperties: false,
      
      // Self-defending
      selfDefending: true,
      
      // Debug protection
      debugProtection: true,
      debugProtectionInterval: 4000,
      
      // Disable console output
      disableConsoleOutput: true,
      
      // Transform object keys
      transformObjectKeys: true,
      
      // Unicode escape
      unicodeEscapeSequence: true,
      
      // Compact code
      compact: true,
      
      // Simplify
      simplify: true,
      
      // Split strings
      splitStrings: true,
      splitStringsChunkLength: 10,
      
      // Target
      target: 'node',
      
      // Seed for reproducible builds
      seed: 0,
      
      // Source map (disable in production)
      sourceMap: false,
      sourceMapMode: 'separate',
    }, [
      // Exclude these files from obfuscation
      'node_modules/**',
    ])
  ],
  
  optimization: {
    minimize: true,
    moduleIds: 'deterministic',
  },
  
  resolve: {
    extensions: ['.js', '.json'],
  },
  
  node: {
    __dirname: false,
    __filename: false,
  },
};
