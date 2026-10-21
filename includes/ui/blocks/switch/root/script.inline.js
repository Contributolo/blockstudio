import { store, getContext, getElement } from '@wordpress/interactivity';

store( 'bsui/switch', {
	state: {
		get ariaChecked() {
			return getContext().checked ? 'true' : 'false';
		},
		get ariaReadOnly() {
			return getContext().readOnly ? 'true' : undefined;
		},
		get ariaRequired() {
			return getContext().required ? 'true' : undefined;
		},
		get formValue() {
			const ctx = getContext();
			const { checkedValue, uncheckedValue } = ctx;
			const bound = window.__bsui.resolveBinding( ctx.checkedBinding, 'bsui/switch', getContext, store );
			return ( bound === undefined ? ctx.checked : bound )
				? ( checkedValue || 'on' )
				: ( uncheckedValue || '' );
		},
	},
	actions: {
		toggle() {
			const ctx = getContext();
			if ( ctx.disabled || ctx.readOnly ) return;
			ctx.checked = ! ctx.checked;
			const { ref } = getElement();
			ref.closest( '[data-bsui-switch]' )?.dispatchEvent(
				new CustomEvent( 'change', { bubbles: true, detail: { value: ctx.checked } } )
			);
		},
	},
} );
