<?php
$checked   = ! empty( $a['checked'] ) ? $a['checked'] : '';
$on_change = ! empty( $a['onChange'] ) ? $a['onChange'] : '';
$bind_text = ! empty( $a['bindText'] ) ? $a['bindText'] : '';
$disabled  = ! empty( $a['disabled'] );
$initial   = ! empty( $a['defaultPressed'] ) ? 'true' : 'false';
?>
<span
	data-bsui-toggle
	data-wp-interactive="bsui/toggle"
	data-wp-context='<?php echo esc_attr( wp_json_encode( array( 'pressed' => ! empty( $a['defaultPressed'] ), 'disabled' => $disabled ) ) ); ?>'
>
	<button
		type="button"
		data-bsui-focus
		aria-pressed="<?php echo esc_attr( $initial ); ?>"
		data-wp-bind--aria-pressed="<?php echo esc_attr( $checked ?: 'state.ariaPressed' ); ?>"
		data-wp-on--click="<?php echo esc_attr( $on_change ?: 'actions.toggle' ); ?>"
		<?php if ( $disabled ) echo 'disabled'; ?>
	>
		<?php if ( $bind_text ) : ?>
		<span data-wp-text="<?php echo esc_attr( $bind_text ); ?>"><?php echo esc_html( $a['label'] ?? '' ); ?></span>
		<?php else : ?>
		<RichText attribute="label" tag="span" placeholder="Toggle" />
		<?php endif; ?>
	</button>
</span>
