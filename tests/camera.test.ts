import { expect, it } from 'vitest';
import { cameraError } from '../src/hooks/useCamera';
it.each([
  ['NotAllowedError', '相機權限遭拒絕'],
  ['NotFoundError', '找不到可用的相機'],
  ['NotReadableError', '其他程式使用'],
  ['SecurityError', '相機權限遭拒絕'],
])('translates camera error %s without exposing stack traces', (name, expected) => {
  expect(cameraError(new DOMException('sensitive technical message', name))).toContain(expected);
  expect(cameraError(new DOMException('sensitive technical message', name))).not.toContain(
    'sensitive',
  );
});
it('handles non-DOM camera errors', () =>
  expect(cameraError(new Error('failure'))).toContain('HTTPS'));
