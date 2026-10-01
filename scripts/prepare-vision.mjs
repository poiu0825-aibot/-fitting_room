import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
await import('./build-worker.mjs');
const root = new URL('../public/vision/', import.meta.url);
await mkdir(root, { recursive: true });
await cp(
  new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  new URL('wasm/', root),
  { recursive: true },
);
const models = [
  [
    'selfie_multiclass.tflite',
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite',
    'c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0',
  ],
  [
    'face_landmarker.task',
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  ],
  [
    'pose_landmarker_lite.task',
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  ],
];
for (const [name, url, expected] of models) {
  const path = new URL(name, root);
  let data;
  try {
    data = await readFile(path);
  } catch {
    /* Download absent model. */
  }
  const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
  if (!data || (expected && sha(data) !== expected)) {
    // curl honors HTTPS_PROXY in cloud environments; TLS verification stays enabled.
    data = execFileSync(
      'curl',
      [
        '--fail',
        '--location',
        '--silent',
        '--show-error',
        '--retry',
        '2',
        '--max-time',
        '120',
        url,
      ],
      { maxBuffer: 32 * 1024 * 1024 },
    );
  }
  if (expected && sha(data) !== expected) throw new Error(`SHA-256 mismatch: ${name}`);
  await writeFile(path, data);
  console.log(`${name}: ${sha(data)}`);
}
