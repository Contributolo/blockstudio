<?php
$disabled = ! empty( $context['bsui/collapsible']['disabled'] ?? false );
$open     = ! empty( $context['bsui/collapsible']['defaultOpen'] ?? false );
?>
<div
	data-wp-interactive="bsui/collapsible"
	data-wp-on--click="actions.toggle"
	data-bsui-collapsible-trigger
	<?php if ( $disabled ) echo 'disabled'; ?>
	style="display:inline"
>
	<?php
	echo \Blockstudio\Ui::trigger(
		(string) ( $a['trigger'] ?? '' ),
		array(
			'aria-expanded'               => $open ? 'true' : 'false',
			'data-wp-bind--aria-expanded' => 'bsui/collapsible::state.ariaExpanded',
		)
	);
	?>
</div>
