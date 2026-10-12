<div
	data-wp-interactive="bsui/alert-dialog"
	data-wp-on--click="actions.open"
	data-bsui-alert-dialog-trigger
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array(
			'aria-haspopup'               => 'dialog',
			'aria-expanded'               => 'false',
			'data-wp-bind--aria-expanded' => 'bsui/alert-dialog::state.ariaExpanded',
		)
	);
	?>
</div>
