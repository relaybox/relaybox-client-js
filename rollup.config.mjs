import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';

console.log(process.env.UWS_SERVER_HOST);

export default {
  input: 'dist/index.js',
  output: [
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs',
      sourcemap: false
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm',
      sourcemap: false
    }
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({ babelHelpers: 'bundled' }),
    replace({
      'process.env.UWS_SERVER_HOST': JSON.stringify(process.env.UWS_SERVER_HOST),
      preventAssignment: true
    }),
    terser({
      compress: {
        drop_console: true
      }
    })
  ]
};
