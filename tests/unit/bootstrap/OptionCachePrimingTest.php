<?php

use Blockstudio\Build_Cache;
use Blockstudio\Pages;
use Blockstudio\Plugin;
use Blockstudio\Runtime_Cache;
use Blockstudio\Settings;
use Blockstudio\Static_Prerender_Runtime;
use PHPUnit\Framework\TestCase;

class OptionCachePrimingTest extends TestCase {

	private const REQUEST_OPTIONS = array(
		'blockstudio_settings',
		'blockstudio_static_prerender_feature_state',
		'blockstudio_build_lock_cleanup_version',
		'blockstudio_pages_collection_manifests',
		'blockstudio_collection_post_types_signature',
		'blockstudio_populate_cache_version',
		'blockstudio_pages_template_for',
	);

	private array $queries = array();

	protected function tearDown(): void {
		remove_filter( 'query', array( $this, 'record_query' ) );
	}

	public function record_query( string $query ): string {
		if ( str_starts_with( ltrim( $query ), 'SELECT' ) ) {
			foreach ( self::REQUEST_OPTIONS as $option ) {
				if ( str_contains( $query, "'{$option}'" ) ) {
					$this->queries[] = $query;
					break;
				}
			}
		}

		return $query;
	}

	public function test_request_options_are_read_with_one_query(): void {
		$this->forget_option_caches();
		add_filter( 'query', array( $this, 'record_query' ) );

		$this->invoke( Plugin::get_instance(), 'prime_option_caches' );

		new Settings();
		$this->invoke( Static_Prerender_Runtime::class, 'reconcile_feature_state' );
		Runtime_Cache::init();
		$this->invoke( Pages::class, 'persisted_collection_manifests', array( array() ) );
		Pages::maybe_register_collection_post_types();
		Build_Cache::get_populate_cache_version();
		Pages::filter_template_for_post_type_args( array(), 'post' );

		$this->assertCount( 1, $this->queries, implode( "\n", $this->queries ) );
	}

	private function forget_option_caches(): void {
		foreach ( self::REQUEST_OPTIONS as $option ) {
			wp_cache_delete( $option, 'options' );
		}

		$notoptions = wp_cache_get( 'notoptions', 'options' );

		if ( is_array( $notoptions ) ) {
			wp_cache_set( 'notoptions', array_diff_key( $notoptions, array_flip( self::REQUEST_OPTIONS ) ), 'options' );
		}
	}

	private function invoke( object|string $target, string $method, array $args = array() ): mixed {
		$reflection = new ReflectionMethod( $target, $method );

		return $reflection->invokeArgs( is_object( $target ) ? $target : null, $args );
	}
}
