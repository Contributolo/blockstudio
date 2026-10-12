<?php
$open = ! empty( $context['bsui/popover']['defaultOpen'] ?? false );
?>
<div
	data-wp-interactive="bsui/popover"
	data-wp-on--click="actions.toggle"
	data-bsui-popover-trigger
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array(
			'aria-haspopup'               => 'dialog',
			'aria-expanded'               => $open ? 'true' : 'false',
			'data-wp-bind--aria-expanded' => 'bsui/popover::state.ariaExpanded',
		)
	);
	?>
</div>
