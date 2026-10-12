<?php
$name        = ! empty( $a['name'] ?: $a['nameAlt'] ) ? $a['name'] ?: $a['nameAlt'] : '';
$placeholder = ! empty( $a['placeholder'] ) ? $a['placeholder'] : 'Enter password';
$disabled    = ! empty( $a['disabled'] );
$value       = ! empty( $a['value'] ) ? $a['value'] : '';
$on_change   = ! empty( $a['onChange'] ) ? $a['onChange'] : '';
$input_id    = (string) ( $a['inputId'] ?? '' );
$label       = (string) ( $a['ariaLabel'] ?? '' );
$complete    = (string) ( $a['autocomplete'] ?? '' );
?>
<div
	data-bsui-password-input
	data-wp-interactive="bsui/password-input"
	data-wp-context='<?php echo esc_attr( wp_json_encode( array( 'visible' => false ) ) ); ?>'
>
	<input
		data-bsui-focus
		data-wp-bind--type="state.inputType"
		type="password"
		<?php if ( '' !== $input_id ) echo 'id="' . esc_attr( $input_id ) . '"'; ?>
		<?php if ( '' !== $label ) echo 'aria-label="' . esc_attr( $label ) . '"'; ?>
		<?php if ( '' !== $complete ) echo 'autocomplete="' . esc_attr( $complete ) . '"'; ?>
		placeholder="<?php echo esc_attr( $placeholder ); ?>"
		<?php if ( '' !== $name ) echo 'name="' . esc_attr( $name ) . '"'; ?>
		<?php if ( $value ) echo 'data-wp-bind--value="' . esc_attr( $value ) . '"'; ?>
		<?php if ( $on_change ) echo 'data-wp-on--input="' . esc_attr( $on_change ) . '"'; ?>
		<?php if ( $disabled ) echo 'disabled'; ?>
	/>
	<button type="button" aria-label="Show password" aria-pressed="false" data-wp-bind--aria-pressed="state.ariaPressed" data-wp-on--click="actions.toggle">
		<span data-bsui-password-icon></span>
	</button>
</div>
