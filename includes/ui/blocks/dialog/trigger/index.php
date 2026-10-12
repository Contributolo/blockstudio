<div
	data-wp-interactive="bsui/dialog"
	data-wp-on--click="actions.open"
	data-bsui-dialog-trigger
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array( 'aria-haspopup' => 'dialog' )
	);
	?>
</div>
