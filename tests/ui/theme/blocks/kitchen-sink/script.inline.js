import { store, getContext } from '@wordpress/interactivity';

function update( key, event ) {
	const value = event.detail?.value ?? event.target.value;
	if ( value !== undefined ) getContext()[ key ] = value;
}

store( 'app/kitchen-sink', {
	actions: {
		reset() {
			Object.assign( getContext(), {
				checkboxOn: false, switchOn: false, toggleOn: false,
				colorValue: '#000000', inputValue: '',
				numberValue: 0, passwordValue: '',
				ratingValue: 0, radioValue: '', sliderValue: 0,
				textareaValue: '', timeValue: '00:00',
			} );
		},
		setCheckbox() { const ctx = getContext(); ctx.checkboxOn = ! ctx.checkboxOn; },
		setSwitch() { const ctx = getContext(); ctx.switchOn = ! ctx.switchOn; },
		setToggle() { const ctx = getContext(); ctx.toggleOn = ! ctx.toggleOn; },
		setColor( event ) { update( 'colorValue', event ); },
		setDate( event ) { update( 'dateValue', event ); },
		setInput( event ) { update( 'inputValue', event ); },
		setNumber( event ) {
			if ( event.detail?.value !== undefined ) getContext().numberValue = event.detail.value;
		},
		setOtp( event ) { update( 'otpValue', event ); },
		setPassword( event ) { update( 'passwordValue', event ); },
		setPhone( event ) { update( 'phoneValue', event ); },
		setRating( event ) { update( 'ratingValue', event ); },
		setRadio( event ) { update( 'radioValue', event ); },
		setSelect( event ) { update( 'selectValue', event ); },
		setSlider( event ) { update( 'sliderValue', event ); },
		setTextarea( event ) { update( 'textareaValue', event ); },
		setTime( event ) {
			if ( event.detail?.value !== undefined ) getContext().timeValue = event.detail.value;
		},
	},
} );
