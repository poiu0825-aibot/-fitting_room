import type { TryOnItemType } from '../vision/types';
export function ItemTypeSelector({
  mode,
  onChange,
}: {
  mode: TryOnItemType;
  onChange: (mode: TryOnItemType) => void;
}) {
  return (
    <div className="mode-selector" role="group" aria-label="試穿類型">
      <button aria-pressed={mode === 'hairstyle'} onClick={() => onChange('hairstyle')}>
        <span aria-hidden="true">✂</span> 髮型
      </button>
      <button aria-pressed={mode === 'top'} onClick={() => onChange('top')}>
        <span aria-hidden="true">♧</span> 上衣 <small>基礎版</small>
      </button>
    </div>
  );
}
