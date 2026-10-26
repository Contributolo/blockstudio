<?php
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	return;
}
\WP_CLI::add_hook( 'after_wp_load', static function (): void {
	$block = register_block_type( 'blockstudio-test/render-warning', array(
		'render_callback' => static function (): string {
			echo 'Incidental output';
			trigger_error( 'Render fixture warning', E_USER_WARNING );
			return '<p>Fixture</p>';
		},
	) );
	\Blockstudio\Block_Registry::instance()->register_block( 'blockstudio-test/render-warning', $block );
} );
