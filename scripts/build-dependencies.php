<?php
/**
 * Rebuild the private runtime from locked development dependencies.
 *
 * @package Blockstudio
 */

declare(strict_types=1);

$root     = dirname( __DIR__ );
$manifest = json_decode( file_get_contents( $root . '/composer.json' ), true, 512, JSON_THROW_ON_ERROR );
$lock     = json_decode( file_get_contents( $root . '/composer.lock' ), true, 512, JSON_THROW_ON_ERROR );
$packages = array_column( array_merge( $lock['packages'], $lock['packages-dev'] ), null, 'name' );
$selected = array();
$pending  = $manifest['extra']['blockstudio-scoped-packages'];

while ( $pending ) {
	$name = array_pop( $pending );
	if ( isset( $selected[ $name ] ) || 'php' === $name || str_starts_with( $name, 'ext-' ) || str_starts_with( $name, 'lib-' ) ) {
		continue;
	}
	if ( ! isset( $packages[ $name ] ) ) {
		throw new RuntimeException( 'Missing locked runtime dependency: ' . $name );
	}
	$selected[ $name ] = $packages[ $name ];
	array_push( $pending, ...array_keys( $packages[ $name ]['require'] ?? array() ) );
}
ksort( $selected );

$temporary = realpath( sys_get_temp_dir() ) . '/blockstudio-scope-' . bin2hex( random_bytes( 8 ) );
$output    = $temporary . '/scoped';
$check     = in_array( '--check', $argv, true );

$run = static function ( array $command ): void {
	$process = proc_open( $command, array( STDIN, STDOUT, STDERR ), $pipes );
	if ( ! is_resource( $process ) || 0 !== proc_close( $process ) ) {
		throw new RuntimeException( 'Dependency build command failed: ' . implode( ' ', $command ) );
	}
};
$remove = static function ( string $directory ) use ( &$remove ): void {
	if ( ! is_dir( $directory ) ) {
		return;
	}
	foreach ( new FilesystemIterator( $directory ) as $entry ) {
		$entry->isDir() && ! $entry->isLink() ? $remove( $entry->getPathname() ) : unlink( $entry->getPathname() );
	}
	rmdir( $directory );
};
$inventory = static function ( string $directory ): array {
	$files = array();
	if ( is_dir( $directory ) ) {
		foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $directory, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
			$files[ substr( $file->getPathname(), strlen( $directory ) + 1 ) ] = hash_file( 'sha256', $file->getPathname() );
		}
	}
	ksort( $files );
	return $files;
};

try {
	$directories = array();
	$installed   = json_decode( file_get_contents( $root . '/vendor/composer/installed.json' ), true, 512, JSON_THROW_ON_ERROR );
	$installed   = array_column( $installed['packages'], null, 'name' );
	foreach ( array_keys( $selected ) as $name ) {
		$directory = $root . '/vendor/' . $name;
		if ( ! is_dir( $directory ) || ( $installed[ $name ]['version'] ?? '' ) !== $selected[ $name ]['version'] || ( $installed[ $name ]['source']['reference'] ?? '' ) !== ( $selected[ $name ]['source']['reference'] ?? '' ) ) {
			throw new RuntimeException( 'Run composer install with development dependencies before building: ' . $name );
		}
		$directories[] = $directory;
	}
	putenv( 'BLOCKSTUDIO_SCOPE_DIRS=' . json_encode( $directories, JSON_THROW_ON_ERROR ) );
	$run( array( PHP_BINARY, $root . '/vendor/bin/php-scoper', 'add-prefix', '--config=' . $root . '/scoper.inc.php', '--output-dir=' . $output, '--no-interaction' ) );
	foreach ( new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $output, FilesystemIterator::SKIP_DOTS ) ) as $file ) {
		if ( 'scoper-autoload.php' === $file->getFilename() ) {
			unlink( $file->getPathname() );
		}
	}

	// Composer supplies the class parser; its temporary autoloader is not shipped.
	file_put_contents( $output . '/composer.json', json_encode( array( 'autoload' => array( 'classmap' => array( '.' ) ) ), JSON_THROW_ON_ERROR ) );
	$run( array( 'composer', 'dump-autoload', '--working-dir=' . $output, '--no-dev', '--classmap-authoritative', '--no-scripts', '--no-plugins' ) );
	$classmap = require $output . '/vendor/composer/autoload_classmap.php';
	$map      = array();
	foreach ( $classmap as $class => $file ) {
		if ( str_starts_with( $class, 'Composer\\' ) ) {
			continue;
		}
		if ( ! str_starts_with( $class, 'BlockstudioVendor\\' ) ) {
			throw new RuntimeException( 'Unprefixed dependency class: ' . $class );
		}
		$map[ $class ] = substr( $file, strlen( $output ) + 1 );
	}
	ksort( $map );
	$files   = array();
	$visited = array();
	$visit   = static function ( string $name ) use ( &$visit, &$visited, &$files, $selected, $output ): void {
		if ( isset( $visited[ $name ] ) ) {
			return;
		}
		$visited[ $name ] = true;
		foreach ( array_keys( $selected[ $name ]['require'] ?? array() ) as $dependency ) {
			if ( isset( $selected[ $dependency ] ) ) {
				$visit( $dependency );
			}
		}
		foreach ( $selected[ $name ]['autoload']['files'] ?? array() as $file ) {
			if ( ! is_file( $output . '/' . $name . '/' . $file ) ) {
				throw new RuntimeException( 'Missing scoped bootstrap: ' . $name . '/' . $file );
			}
			$files[] = $name . '/' . $file;
		}
	};
	foreach ( array_keys( $selected ) as $name ) {
		$visit( $name );
	}
	$remove( $output . '/vendor' );
	unlink( $output . '/composer.json' );
	if ( is_file( $output . '/scoper-autoload.php' ) ) {
		unlink( $output . '/scoper-autoload.php' );
	}
	mkdir( $output . '/dependencies' );
	foreach ( array( 'classmap' => $map, 'files' => $files ) as $name => $data ) {
		file_put_contents( $output . '/dependencies/' . $name . '.php', "<?php\n\n// Generated by composer scope.\nreturn " . var_export( $data, true ) . ";\n" );
	}
	$native = "<?php\n\n// Generated native PHP compatibility functions. Never replace an existing function.\n";
	foreach ( array( 'alnum', 'alpha', 'cntrl', 'digit', 'graph', 'lower', 'print', 'punct', 'space', 'upper', 'xdigit' ) as $suffix ) {
		$function = 'ctype_' . $suffix;
		$native .= "if (!function_exists('" . $function . "')) {\n    function " . $function . "(mixed \$text): bool {\n        return \\BlockstudioVendor\\Symfony\\Polyfill\\Ctype\\Ctype::" . $function . "(\$text);\n    }\n}\n";
	}
	file_put_contents( $output . '/dependencies/native-functions.php', $native );
	// Every package under lib/ is listed, including the ones this script does not rebuild.
	$bundled = array_keys( $selected );
	foreach ( glob( $root . '/lib/*/*', GLOB_ONLYDIR ) as $directory ) {
		$bundled[] = basename( dirname( $directory ) ) . '/' . basename( $directory );
	}
	$bundled = array_unique( $bundled );
	sort( $bundled );
	$versions = array();
	foreach ( $bundled as $name ) {
		if ( ! isset( $packages[ $name ] ) ) {
			throw new RuntimeException( 'Bundled package is missing from composer.lock: ' . $name );
		}
		$versions[ $name ] = $packages[ $name ]['version'];
	}
	file_put_contents( $output . '/dependencies/versions.json', json_encode( $versions, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR ) . "\n" );

	foreach ( array_merge( array_keys( $selected ), array( 'dependencies' ) ) as $name ) {
		$source = $output . '/' . $name;
		$target = $root . '/lib/' . $name;
		if ( $check ) {
			if ( $inventory( $source ) !== $inventory( $target ) ) {
				throw new RuntimeException( 'Private dependency is stale. Run composer scope: ' . $name );
			}
			continue;
		}
		$remove( $target );
		if ( ! is_dir( dirname( $target ) ) ) {
			mkdir( dirname( $target ), 0777, true );
		}
		if ( ! rename( $source, $target ) ) {
			throw new RuntimeException( 'Cannot install scoped dependency: ' . $name );
		}
	}
	echo $check ? "Private dependencies match the lockfile.\n" : "Private dependencies rebuilt. Run composer dump-autoload.\n";
} finally {
	putenv( 'BLOCKSTUDIO_SCOPE_DIRS' );
	$remove( $temporary );
}
