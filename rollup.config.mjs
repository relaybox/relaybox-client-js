import babel from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'dist/index.js', // This should be the entry point file compiled by TypeScript
  output: [
    {
      file: 'dist/bundle.cjs.js', // Output file for CommonJS
      format: 'cjs',
      sourcemap: false
    },
    {
      file: 'dist/bundle.esm.js', // Output file for ES Module
      format: 'esm',
      sourcemap: false
    }
  ],
  plugins: [nodeResolve(), commonjs(), babel({ babelHelpers: 'bundled' })]
};
