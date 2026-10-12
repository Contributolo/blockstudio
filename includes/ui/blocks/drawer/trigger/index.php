<div
	data-wp-interactive="bsui/drawer"
	data-wp-on--click="actions.open"
	data-bsui-drawer-trigger
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array(
			'aria-haspopup'               => 'dialog',
			'aria-expanded'               => 'false',
			'data-wp-bind--aria-expanded' => 'bsui/drawer::state.ariaExpanded',
		)
	);
	?>
</div>
