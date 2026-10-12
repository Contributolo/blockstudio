<?php
?>
<nav aria-label="breadcrumb" data-bsui-breadcrumb>
	<InnerBlocks tag="ol" allowedBlocks='<?php echo esc_attr( wp_json_encode( array(
		'bsui/breadcrumb-item',
		'bsui/breadcrumb-page',
		'bsui/breadcrumb-ellipsis',
	) ) ); ?>' />
</nav>
