<?php
/**
 * Verify dependency isolation in fresh PHP processes, including production ZIPs.
 *
 * @package Blockstudio
 */

declare(strict_types=1);

$root = realpath( $argv[1] ?? dirname( __DIR__, 2 ) );
if ( false === $root ) {
	throw new RuntimeException( 'Missing package directory.' );
}
$mode = $argv[2] ?? '';
$autoload = $argv[3] ?? $root . ( is_dir( $root . '/tests' ) ? '/lib/runtime-autoload.php' : '/vendor/autoload.php' );
if ( '' === $mode ) {
	foreach ( array( false, true ) as $without_ctype ) {
		foreach ( array( 'clean', 'before', 'after' ) as $order ) {
			$command = array( PHP_BINARY );
			if ( $without_ctype ) {
				$command[] = '-d';
				$command[] = 'disable_functions=ctype_alnum,ctype_alpha,ctype_cntrl,ctype_digit,ctype_graph,ctype_lower,ctype_print,ctype_punct,ctype_space,ctype_upper,ctype_xdigit';
			}
			array_push( $command, __FILE__, $root, $order, $autoload );
			$process = proc_open( $command, array( STDIN, STDOUT, STDERR ), $pipes );
			if ( ! is_resource( $process ) || 0 !== proc_close( $process ) ) {
				exit( 1 );
			}
		}
	}
	$process = proc_open( array( PHP_BINARY, __FILE__, $root, 'updater', $autoload ), array( STDIN, STDOUT, STDERR ), $pipes );
	if ( ! is_resource( $process ) || 0 !== proc_close( $process ) ) {
		exit( 1 );
	}
	exit( 0 );
}

$assert = static function ( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
};
if ( 'updater' === $mode ) {
	require __DIR__ . '/fixtures/updater-wordpress.php';
	exit( 0 );
}
$public = array(
	'League\\CommonMark\\GithubFlavoredMarkdownConverter',
	'Symfony\\Component\\Yaml\\Yaml',
	'YahnisElsts\\PluginUpdateChecker\\v5\\PucFactory',
	'Nette\\Schema\\Processor',
	'Parsedown',
);

if ( 'before' === $mode ) {
	require __DIR__ . '/fixtures/conflicting-dependencies.php';
}

// The working tree's development autoloader intentionally contains public tools.
require $autoload;
require_once $root . '/includes/classes/page-markdown.php';

if ( 'before' !== $mode ) {
	foreach ( $public as $class ) {
		$assert( ! class_exists( $class ), 'Package exposes public class: ' . $class );
	}
	$assert( ! function_exists( 'trigger_deprecation' ), 'Package exposes a public function.' );
}
if ( 'after' === $mode ) {
	require __DIR__ . '/fixtures/conflicting-dependencies.php';
}

$yaml = \Blockstudio\Page_Markdown::parse_yaml( "defaults: &defaults\n  title: Hello\npage:\n  <<: *defaults\n  items: [one, two]\n  order: 42\n" );
$assert( array( 'title' => 'Hello', 'items' => array( 'one', 'two' ), 'order' => 42 ) === $yaml['page'], 'Nested YAML, numeric scalars or anchors failed.' );
$assert( array() === \Blockstudio\Page_Markdown::parse_yaml( 'invalid: [unterminated' ), 'Malformed YAML must be rejected.' );
$html = \Blockstudio\Page_Markdown::to_html( "| A | B |\n| --- | --- |\n| One | Two |\n\n- [x] Done\n\n~~Removed~~\n" );
foreach ( array( '<table>', '<input', '<del>Removed</del>' ) as $expected ) {
	$assert( str_contains( $html, $expected ), 'GFM failed: ' . $expected );
}
$parsedown = new \BlockstudioVendor\Parsedown();
$assert( str_contains( $parsedown->text( '**Release notes**' ), '<strong>Release notes</strong>' ), 'Updater Markdown parser failed.' );
$factory = 'BlockstudioVendor\\YahnisElsts\\PluginUpdateChecker\\v5\\PucFactory';
$assert( class_exists( $factory ), 'Private updater factory missing.' );
$assert( is_subclass_of( $factory, 'BlockstudioVendor\\YahnisElsts\\PluginUpdateChecker\\v5p6\\PucFactory' ), 'Updater factory hierarchy failed.' );
foreach ( array( 'Plugin\\UpdateChecker', 'Theme\\UpdateChecker', 'Vcs\\PluginUpdateChecker', 'Vcs\\ThemeUpdateChecker', 'GitHubApi' ) as $key ) {
	$resolved = $factory::getLatestClassVersion( $key );
	$assert( is_string( $resolved ) && str_starts_with( $resolved, 'BlockstudioVendor\\YahnisElsts\\' ) && class_exists( $resolved ), 'Updater lookup key was incorrectly scoped: ' . $key );
}

$classes = require $root . '/lib/dependencies/classmap.php';
foreach ( $classes as $class => $file ) {
	$assert( str_starts_with( $class, 'BlockstudioVendor\\' ) && is_file( $root . '/lib/' . $file ), 'Invalid private class map: ' . $class );
	if ( 'clean' === $mode ) {
		$original = substr( $class, strlen( 'BlockstudioVendor\\' ) );
		if ( ( class_exists( $original, false ) || interface_exists( $original, false ) ) && ( new ReflectionClass( $original ) )->isInternal() ) {
			continue;
		}
		$assert( ! class_exists( $original ) && ! interface_exists( $original ) && ! trait_exists( $original ), 'Public dependency symbol leaked: ' . $original );
	}
}
echo 'Dependency isolation passed (' . $mode . ").\n";
