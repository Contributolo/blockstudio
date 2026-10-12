<?php
?>
<nav aria-label="pagination" data-bsui-pagination>
	<InnerBlocks tag="ul" allowedBlocks='<?php echo esc_attr( wp_json_encode( array(
		'bsui/pagination-item',
		'bsui/pagination-ellipsis',
		'bsui/pagination-previous',
		'bsui/pagination-next',
	) ) ); ?>' />
</nav>
