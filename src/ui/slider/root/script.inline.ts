import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  max: number;
  min: number;
  orientation: string;
  step: number;
  value: number;
}

function setSliderValue(ctx: Context, el: HTMLElement, val: number) {
  ctx.value = val;
  const p =
    ctx.max > ctx.min ? ((val - ctx.min) / (ctx.max - ctx.min)) * 100 : 0;
  el.style.setProperty('--bs-ui-slider-percent', p + '%');
  el.dispatchEvent(
    new CustomEvent('change', { bubbles: true, detail: { value: val } }),
  );
}

function clampStep(val: number, min: number, max: number, step: number) {
  return Math.round(Math.max(min, Math.min(max, val)) / step) * step;
}

store('bsui/slider', {
  state: {
    get currentValue() {
      return getContext<Context>().value;
    },
    get percent() {
      const { value, min, max } = getContext<Context>();
      return max > min ? ((value - min) / (max - min)) * 100 : 0;
    },
    get percentStr() {
      const { value, min, max } = getContext<Context>();
      const p = max > min ? ((value - min) / (max - min)) * 100 : 0;
      return p + '%';
    },
    get valueText() {
      return String(getContext<Context>().value);
    },
  },
  actions: {
    handleKeyDown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;

      const { value, min, max, step } = ctx;

      let newValue = value;
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          event.preventDefault();
          newValue = Math.min(max, value + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          event.preventDefault();
          newValue = Math.max(min, value - step);
          break;
        case 'Home':
          event.preventDefault();
          newValue = min;
          break;
        case 'End':
          event.preventDefault();
          newValue = max;
          break;
        case 'PageUp':
          event.preventDefault();
          newValue = Math.min(max, value + step * 10);
          break;
        case 'PageDown':
          event.preventDefault();
          newValue = Math.max(min, value - step * 10);
          break;
        default:
          return;
      }
      setSliderValue(
        ctx,
        event.currentTarget as HTMLElement,
        Math.round(newValue / step) * step,
      );
    },
    handlePointerDown(event: PointerEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;

      const el = event.currentTarget as HTMLElement;
      const vertical = ctx.orientation === 'vertical';

      function posToValue(e: PointerEvent) {
        const r = el.getBoundingClientRect();
        const pos = vertical
          ? 1 - (e.clientY - r.top) / r.height
          : (e.clientX - r.left) / r.width;
        return clampStep(
          ctx.min + pos * (ctx.max - ctx.min),
          ctx.min,
          ctx.max,
          ctx.step,
        );
      }

      setSliderValue(ctx, el, posToValue(event));

      const onMove = function (e: PointerEvent) {
        setSliderValue(ctx, el, posToValue(e));
      };
      const onUp = function () {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
  },
  callbacks: {
    syncValue() {
      window.__bsui.syncValue('bsui/slider', getContext, store);
    },
    syncPercent() {
      const ctx = getContext<Context>();
      const p =
        ctx.max > ctx.min
          ? ((ctx.value - ctx.min) / (ctx.max - ctx.min)) * 100
          : 0;
      (getElement() as { ref: HTMLElement }).ref.style.setProperty(
        '--bs-ui-slider-percent',
        p + '%',
      );
    },
  },
});
