import { DEFAULT_CALIBRATION } from '../config/tryOnConfig';
import type { CalibrationState } from '../vision/types';
export function CalibrationPanel({
  value,
  onChange,
  disabled,
}: {
  value: CalibrationState;
  onChange: (value: CalibrationState) => void;
  disabled: boolean;
}) {
  const controls = [
    {
      key: 'scale',
      label: '大小',
      min: 0.3,
      max: 2.5,
      step: 0.01,
      display: `${Math.round(value.scale * 100)}%`,
    },
    { key: 'offsetY', label: '上下', min: -250, max: 250, step: 1, display: `${value.offsetY} px` },
    { key: 'offsetX', label: '左右', min: -250, max: 250, step: 1, display: `${value.offsetX} px` },
    {
      key: 'rotation',
      label: '旋轉',
      min: -90,
      max: 90,
      step: 1,
      display: `${Math.round((value.rotation * 180) / Math.PI)}°`,
    },
  ] as const;
  return (
    <section className="calibration-panel">
      <div className="section-heading">
        <h2>微調位置</h2>
        <button disabled={disabled} onClick={() => onChange({ ...DEFAULT_CALIBRATION })}>
          ↺ 重設
        </button>
      </div>
      <fieldset disabled={disabled}>
        <legend className="sr-only">調整圖片</legend>
        {controls.map((control) => (
          <label className="slider-row" key={control.key}>
            <span>{control.label}</span>
            <input
              aria-label={control.label}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={
                control.key === 'rotation'
                  ? Math.round((value.rotation * 180) / Math.PI)
                  : value[control.key]
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  [control.key]:
                    Number(event.target.value) * (control.key === 'rotation' ? Math.PI / 180 : 1),
                })
              }
            />
            <output>{control.display}</output>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
