import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
  plugins: [nodeResolve(), commonjs(), babel({ babelHelpers: 'bundled' })]
};
