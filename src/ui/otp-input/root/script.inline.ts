document.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.closest<HTMLElement>('[data-bsui-otp-input]')) return;
  const root = input.closest<HTMLElement>('[data-bsui-otp-input]')!;
  const inputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[data-index]'),
  ];
  const idx = inputs.indexOf(input);

  input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);

  if (input.value && idx < inputs.length - 1) {
    inputs[idx + 1].focus({ preventScroll: true });
    inputs[idx + 1].select();
  }

  updateHidden(root, inputs);
});

document.addEventListener('keydown', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.closest<HTMLElement>('[data-bsui-otp-input]')) return;
  const root = input.closest<HTMLElement>('[data-bsui-otp-input]')!;
  const inputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[data-index]'),
  ];
  const idx = inputs.indexOf(input);

  if (e.key === 'Backspace' && !input.value && idx > 0) {
    inputs[idx - 1].focus({ preventScroll: true });
    inputs[idx - 1].select();
  }
  if (e.key === 'ArrowLeft' && idx > 0) {
    e.preventDefault();
    inputs[idx - 1].focus({ preventScroll: true });
  }
  if (e.key === 'ArrowRight' && idx < inputs.length - 1) {
    e.preventDefault();
    inputs[idx + 1].focus({ preventScroll: true });
  }
});

document.addEventListener('paste', (e) => {
  const input = e.target as HTMLInputElement;
  if (!input.closest<HTMLElement>('[data-bsui-otp-input]')) return;
  e.preventDefault();
  const root = input.closest<HTMLElement>('[data-bsui-otp-input]')!;
  const inputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[data-index]'),
  ];
  const text = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '');
  const idx = inputs.indexOf(input);

  for (let i = 0; i < text.length && idx + i < inputs.length; i++) {
    inputs[idx + i].value = text[i];
  }
  const nextIdx = Math.min(idx + text.length, inputs.length - 1);
  inputs[nextIdx].focus({ preventScroll: true });
  updateHidden(root, inputs);
});

function updateHidden(root: HTMLElement, inputs: HTMLInputElement[]) {
  const value = inputs.map((i) => i.value).join('');
  const hidden = root.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hidden) {
    hidden.value = value;
  }
  root.dispatchEvent(
    new CustomEvent('change', { bubbles: true, detail: { value: value } }),
  );
}

document.addEventListener(
  'focus',
  (e) => {
    if (
      (e.target as HTMLInputElement).closest<HTMLElement>(
        '[data-bsui-otp-input]',
      ) &&
      (e.target as HTMLInputElement).matches('input[data-index]')
    ) {
      (e.target as HTMLInputElement).select();
    }
  },
  true,
);
