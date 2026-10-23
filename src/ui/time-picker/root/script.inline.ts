import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  disabled: boolean;
  hour: number | null;
  minute: number | null;
  step: number;
  syncedValue: unknown;
  valueBinding: string;
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function pad(n: number | null) {
  return n !== null ? String(n).padStart(2, '0') : '';
}

function fireChange(ref: HTMLElement, ctx: Context) {
  const root = ref.closest<HTMLElement>('[data-bsui-time-picker]');
  if (!root) return;
  const value =
    ctx.hour !== null && ctx.minute !== null
      ? pad(ctx.hour) + ':' + pad(ctx.minute)
      : '';
  root.dispatchEvent(
    new CustomEvent('change', { bubbles: true, detail: { value: value } }),
  );
}

store('bsui/time-picker', {
  callbacks: {
    syncValue() {
      const ctx = getContext<Context>();
      const value = window.__bsui.resolveBinding(
        ctx.valueBinding,
        'bsui/time-picker',
        getContext,
        store,
      ) as string | undefined;
      if (value === undefined || value === ctx.syncedValue) return;
      if (value !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
      ctx.syncedValue = value;
      const parts = value.split(':');
      ctx.hour = value === '' ? null : Number(parts[0]);
      ctx.minute = value === '' ? null : Number(parts[1]);
      const root = (
        getElement() as ReturnType<typeof getElement> & {
          ref: HTMLInputElement;
        }
      ).ref;
      root.querySelector<HTMLInputElement>('[data-bsui-time-hour]')!.value =
        pad(ctx.hour);
      root.querySelector<HTMLInputElement>('[data-bsui-time-minute]')!.value =
        pad(ctx.minute);
    },
  },
  state: {
    get displayHour() {
      const { hour } = getContext<Context>();
      return hour !== null ? pad(hour) : '';
    },
    get displayMinute() {
      const { minute } = getContext<Context>();
      return minute !== null ? pad(minute) : '';
    },
    get formValue() {
      const { hour, minute } = getContext<Context>();
      if (hour === null || minute === null) return '';
      return pad(hour) + ':' + pad(minute);
    },
  },
  actions: {
    handleHourInput() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      const raw = ref.value.replace(/[^0-9]/g, '');

      if (raw === '') {
        ctx.hour = null;
        ref.value = '';
        return;
      }

      const num = clamp(parseInt(raw, 10), 0, 23);
      ctx.hour = num;

      if (raw.length >= 2 || num > 2) {
        ref.value = pad(num);
        fireChange(ref, ctx);
        const root = ref.closest<HTMLElement>('[data-bsui-time-picker]')!;
        const minuteInput = root.querySelector<HTMLInputElement>(
          '[data-bsui-time-minute]',
        );
        if (minuteInput) {
          minuteInput.focus({ preventScroll: true });
          minuteInput.select();
        }
      }
    },
    handleMinuteInput() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      const raw = ref.value.replace(/[^0-9]/g, '');

      if (raw === '') {
        ctx.minute = null;
        ref.value = '';
        return;
      }

      const num = clamp(parseInt(raw, 10), 0, 59);
      ctx.minute = num;

      if (raw.length >= 2) {
        ref.value = pad(num);
        fireChange(ref, ctx);
      }
    },
    handleHourKeydown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      const step = event.shiftKey ? 10 : 1;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        ctx.hour = ctx.hour !== null ? (ctx.hour + step) % 24 : 0;
        ref.value = pad(ctx.hour);
        fireChange(ref, ctx);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        ctx.hour = ctx.hour !== null ? (ctx.hour - step + 24) % 24 : 23;
        ref.value = pad(ctx.hour);
        fireChange(ref, ctx);
      }
    },
    handleMinuteKeydown(event: KeyboardEvent) {
      const ctx = getContext<Context>();
      if (ctx.disabled) return;
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      const step = event.shiftKey ? 10 : ctx.step;

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        ctx.minute = ctx.minute !== null ? (ctx.minute + step) % 60 : 0;
        ref.value = pad(ctx.minute);
        fireChange(ref, ctx);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        ctx.minute = ctx.minute !== null ? (ctx.minute - step + 60) % 60 : 59;
        ref.value = pad(ctx.minute);
        fireChange(ref, ctx);
      } else if (event.key === 'Backspace' && ref.value === '') {
        event.preventDefault();
        const root = ref.closest<HTMLElement>('[data-bsui-time-picker]')!;
        const hourInput = root.querySelector<HTMLInputElement>(
          '[data-bsui-time-hour]',
        );
        if (hourInput) {
          hourInput.focus({ preventScroll: true });
          hourInput.select();
        }
      }
    },
    selectAll() {
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      ref.select();
    },
    padHour() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      if (ctx.hour !== null) {
        ref.value = pad(ctx.hour);
      }
      fireChange(ref, ctx);
    },
    padMinute() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLInputElement;
      };
      if (ctx.minute !== null) {
        ref.value = pad(ctx.minute);
      }
      fireChange(ref, ctx);
    },
  },
});
