<div
	data-wp-interactive="bsui/menu"
	data-wp-on--click="actions.toggle"
	data-wp-on--keydown="actions.handleTriggerKeyDown"
	data-bsui-menu-trigger
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array(
			'aria-haspopup'               => 'menu',
			'aria-expanded'               => 'false',
			'data-wp-bind--id'            => 'bsui/menu::context.triggerId',
			'data-wp-bind--aria-expanded' => 'bsui/menu::state.ariaExpanded',
			'data-wp-bind--aria-controls' => 'bsui/menu::context.popupId',
		)
	);
	?>
</div>
