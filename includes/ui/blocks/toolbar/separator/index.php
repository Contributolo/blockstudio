<?php
$orientation = 'vertical' === ( $context['bsui/toolbar']['orientation'] ?? 'horizontal' ) ? 'horizontal' : 'vertical';
?>
<div role="separator" aria-orientation="<?php echo esc_attr( $orientation ); ?>" data-orientation="<?php echo esc_attr( $orientation ); ?>" data-bsui-toolbar-separator></div>
