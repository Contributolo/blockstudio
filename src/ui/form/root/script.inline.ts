import { store, getContext, getElement } from '@wordpress/interactivity';

interface Context {
  action: string;
  block: string;
  errors: Record<string, string | string[]>;
  fieldName: string;
  formError: string;
  submitted: boolean;
  submitting: boolean;
}

function syncFields(
  ref: HTMLElement,
  errors: Record<string, string | string[]>,
) {
  ref
    .querySelectorAll<HTMLElement>('[data-bsui-field-root]')
    .forEach(function (field) {
      const input = field.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input, select, textarea');
      if (!input || !input.name) return;

      const err = errors[input.name];
      const hasError = !!err;
      const message = hasError ? (Array.isArray(err) ? err[0] : err) : '';

      field.classList.toggle('bs-ui-invalid', hasError);

      let alert = field.querySelector<HTMLElement>('[role="alert"]');
      if (!alert) {
        alert = document.createElement('span');
        alert.setAttribute('role', 'alert');
        alert.hidden = true;
        const wrapper = field.querySelector<HTMLElement>(':scope > div');
        if (wrapper) wrapper.appendChild(alert);
      }
      alert.hidden = !hasError;
      alert.textContent = message;
    });
}

store('bsui/form', {
  state: {
    get isSubmitting() {
      return getContext<Context>().submitting;
    },
    get isSubmitted() {
      return getContext<Context>().submitted;
    },
    get hasFormError() {
      return getContext<Context>().formError !== '';
    },
    get hasFieldError() {
      const { errors, fieldName } = getContext<Context>();
      return !!fieldName && !!errors && !!errors[fieldName];
    },
    get fieldError() {
      const { errors, fieldName } = getContext<Context>();
      if (!fieldName || !errors) return '';
      const err = errors[fieldName];
      if (!err) return '';
      return Array.isArray(err) ? err[0] : err;
    },
    get isFieldInvalid() {
      const { errors, fieldName } = getContext<Context>();
      return !!fieldName && !!errors && !!errors[fieldName];
    },
  },
  actions: {
    *handleSubmit(
      event: SubmitEvent,
    ): Generator<Promise<FormResponse>, void, FormResponse> {
      event.preventDefault();
      const ctx = getContext<Context>();
      const { ref } = getElement() as ReturnType<typeof getElement> & {
        ref: HTMLFormElement;
      };

      if (!ctx.block || !window.bs?.db) return;

      ctx.errors = {};
      ctx.formError = '';
      ctx.submitting = true;
      ctx.submitted = false;

      const formData = new FormData(ref);
      const data = Object.fromEntries(formData.entries());
      const db = window.bs.db(ctx.block);
      const action = ctx.action || 'create';

      let response;
      try {
        if ('update' === action) {
          const id = data.id;
          delete data.id;
          response = yield db.update(id, data);
        } else if ('delete' === action) {
          response = yield db.delete(data.id);
        } else {
          response = yield db.create(data);
        }
      } catch {
        ctx.formError = 'Network error.';
        ctx.submitting = false;
        return;
      }

      ctx.submitting = false;

      if (response?.code) {
        const errEv = new CustomEvent('formerror', {
          detail: response,
          bubbles: true,
          cancelable: true,
        });
        if (ref.dispatchEvent(errEv)) {
          if (response.data?.errors) {
            ctx.errors = response.data.errors;
          }
          ctx.formError = response.message || 'An error occurred.';
        }
      } else {
        const ev = new CustomEvent('formsuccess', {
          detail: response,
          bubbles: true,
          cancelable: true,
        });
        if (ref.dispatchEvent(ev)) {
          ctx.submitted = true;
        }
        ref.reset();
      }
    },
    handleReset() {
      const ctx = getContext<Context>();
      ctx.errors = {};
      ctx.formError = '';
      ctx.submitting = false;
    },
    clearFieldError() {
      const ctx = getContext<Context>();
      if (ctx.fieldName && ctx.errors && ctx.errors[ctx.fieldName]) {
        const next = { ...ctx.errors };
        delete next[ctx.fieldName];
        ctx.errors = next;
      }
    },
  },
  callbacks: {
    initForm() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };

      ref.addEventListener('input', function (e) {
        const name = (e.target as HTMLInputElement).name;
        if (name && ctx.errors && ctx.errors[name]) {
          const next = Object.assign({}, ctx.errors);
          delete next[name];
          ctx.errors = next;
        }
      });
    },
    syncErrors() {
      const ctx = getContext<Context>();
      const { ref } = getElement() as { ref: HTMLElement };
      syncFields(ref, ctx.errors || {});
    },
    initField() {
      const ctx = getContext<Context>();
      if (ctx.fieldName) return;
      const { ref } = getElement() as { ref: HTMLElement };
      const input = ref.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input, select, textarea');
      if (input && input.name) {
        ctx.fieldName = input.name;
      }
    },
  },
});
