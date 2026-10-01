import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
for (const name of ['vision', 'photo'])
  await build({
    entryPoints: [
      fileURLToPath(
        new URL(
          name === 'vision' ? '../src/vision/vision.worker.ts' : '../src/photo/photo.worker.ts',
          import.meta.url,
        ),
      ),
    ],
    outfile: fileURLToPath(new URL(`../public/vision/${name}.worker.js`, import.meta.url)),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
  });
