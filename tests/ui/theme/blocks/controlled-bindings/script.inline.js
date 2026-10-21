import { store } from '@wordpress/interactivity';

const { state } = store( 'interaction/controlled-bindings', {
	actions: {
		setCount( event ) {
			if ( event.detail?.value !== undefined ) state.count = event.detail.value;
		},
		reset() { state.count = 0; },
	},
} );
