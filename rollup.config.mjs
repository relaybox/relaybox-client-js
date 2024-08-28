import 'dotenv/config';
import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';

console.log(`Building with server host: ${process.env.UWS_SERVER_HOST}:${process.env.NODE_ENV}`);

const isProd = process.env.NODE_ENV === 'production';

export default {
  input: 'dist/index.js',
  output: [
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: !isProd
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: !isProd
    }
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({ babelHelpers: 'bundled' }),
    replace({
      'process.env.UWS_SERVER_HOST': JSON.stringify(process.env.UWS_SERVER_HOST),
      'process.env.UWS_HTTP_HOST': JSON.stringify(process.env.UWS_HTTP_HOST),
      'process.env.RB_AUTH_SERVICE_HOST': JSON.stringify(process.env.RB_AUTH_SERVICE_HOST),
      preventAssignment: true
    }),
    terser({
      compress: {
        drop_console: isProd
      }
    })
  ]
};
