import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: [
    'src/background.ts',
    'src/content.ts',
    'src/sandbox.ts',
    'src/viewer.ts',
    'src/popup.ts',
    'src/options.ts',
    'src/config.ts',
    'src/mvs-builder.ts'
  ],
  bundle:    true,
  outdir:    'dist',
  platform:  'browser',
  target:    'es2020',
  sourcemap: true,
});

console.log('✅ esbuild done');
