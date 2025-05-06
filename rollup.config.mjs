import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser  from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';
import replace from '@rollup/plugin-replace';

export default [
  // Browser Build (UMD)
  {
    input: 'src/wrapper/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'umd',
      name: 'weightedStraightSkeleton',
      sourcemap: true,
      globals: {
        // Falls die Library externe Abhängigkeiten hat
      }
    },
    plugins: [
      replace({
        'process.env.NODE_ENV': JSON.stringify('production'),
        preventAssignment: true
      }),
      resolve({ 
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({ 
        tsconfig: './tsconfig.build.json',
        sourceMap: true,
        inlineSources: true
      }),
      terser()
    ]
  },
  
  // Node.js Build (CommonJS)
  {
    input: 'src/wrapper/index.ts',
    output: {
      file: 'dist/index.node.js',
      format: 'cjs',
      sourcemap: true
    },
    external: ['fs', 'path', 'crypto'], // Externe Node.js-Module
    plugins: [
      resolve({ 
        preferBuiltins: true
      }),
      commonjs(),
      typescript({ 
        tsconfig: './tsconfig.build.json',
        sourceMap: true
      })
    ]
  },
  
  // TypeScript Deklarationsdateien
  {
    input: 'src/wrapper/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];