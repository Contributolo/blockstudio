<?php
/**
 * Probe scoped updater WordPress integration in a fresh process.
 *
 * @package Blockstudio
 */

define( 'WP_CLI', true );
define( 'DOING_CRON', true );
define( 'WP_PLUGIN_DIR', '/wordpress/plugins' );
define( 'WPMU_PLUGIN_DIR', '/wordpress/mu-plugins' );

class WP_CLI {
	public static array $hooks = array();
	public static function add_hook( string $name, $callback ): void {
		self::$hooks[ $name ] = $callback;
	}
}

function current_filter(): string {
	return '';
}

function get_file_data( $file, $headers, $context ): array {
	return array( 'Name' => 'Outside WordPress plugins directory' );
}

require $autoload;

$scheduler_class = 'BlockstudioVendor\\YahnisElsts\\PluginUpdateChecker\\v5p6\\Scheduler';
$scheduler = ( new ReflectionClass( $scheduler_class ) )->newInstanceWithoutConstructor();
$trigger_class = 'BlockstudioVendor\\YahnisElsts\\PluginUpdateChecker\\v5p6\\WpCliCheckTrigger';
new $trigger_class( 'plugin', $scheduler );
$assert( array( 'before_invoke:plugin status', 'before_invoke:plugin list', 'before_invoke:plugin update' ) === array_keys( WP_CLI::$hooks ), 'Scoped updater did not detect WP-CLI.' );
$assert( 42000 === ( new ReflectionMethod( $scheduler_class, 'getEffectiveCheckPeriod' ) )->invoke( $scheduler ), 'Scoped updater did not detect cron.' );
$factory = 'BlockstudioVendor\\YahnisElsts\\PluginUpdateChecker\\v5p6\\PucFactory';
$assert( true === ( new ReflectionMethod( $factory, 'isPluginFile' ) )->invoke( null, __FILE__ ), 'Scoped updater did not detect the global get_file_data function.' );
echo "Updater WordPress integration passed.\n";
