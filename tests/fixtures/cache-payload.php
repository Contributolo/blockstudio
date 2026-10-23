<?php

if ( 'cli' !== PHP_SAPI ) {
	exit;
}

define( 'ABSPATH', __DIR__ );

function apply_filters( string $hook, bool $value, string $scope ): bool {
	$GLOBALS['observed_scope'] = $scope;
	return match ( $GLOBALS['argv'][1] ?? 'default' ) {
		'plain' => false,
		'compressed' => true,
		default => $value,
	};
}

require dirname( __DIR__, 2 ) . '/includes/classes/build-cache.php';

$file = $argv[2];
$payload = array(
	'value' => str_repeat( 'expanded' === ( $argv[1] ?? '' ) ? "'\\\0" : 'x', (int) ( $argv[3] ?? 256 ) ),
	'nested' => array( 'string' => "quote'\\\0", 'int' => 7, 'float' => 1.5, 'false' => false, 'null' => null, 'list' => array( 'a', 'b' ) ),
);
$method = new ReflectionMethod( Blockstudio\Build_Cache::class, 'export_payload' );
$contents = $method->invoke( null, $payload, 'runtime', $file );
file_put_contents( $file, $contents );
$first = include $file;
$first['nested']['string'] = 'changed';
$second = include $file;
if ( $second !== $payload ) {
	throw new RuntimeException( 'Payload did not round-trip unchanged.' );
}
echo json_encode( array(
	'compressed' => str_contains( $contents, 'unserialize(' ),
	'roundTrip' => true,
	'cached' => function_exists( 'opcache_is_script_cached' ) && @opcache_is_script_cached( $file ),
	'scope' => $GLOBALS['observed_scope'] ?? null,
) );
