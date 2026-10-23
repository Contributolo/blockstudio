<?php
/**
 * Portable source locations for synced pages.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Translate persisted page locations without request-time discovery or writes.
 */
final class Page_Paths {

	/**
	 * Store theme files independently of the current installation root.
	 *
	 * @param string $path Source path or logical page identity.
	 * @return string Portable path, or the original external/logical identity.
	 */
	public static function encode( string $path ): string {
		$path = wp_normalize_path( $path );
		foreach ( self::roots() as $prefix => $root ) {
			if ( self::within( $path, $root ) ) {
				return $prefix . ltrim( substr( $path, strlen( $root ) ), '/' );
			}
		}
		return $path;
	}

	/**
	 * Resolve a stored source before any filesystem operation.
	 *
	 * Legacy absolute theme paths are rebased lexically, never probed first.
	 * External paths remain supported when allowed by the current PHP host.
	 *
	 * @param string $path Stored source path or logical page identity.
	 * @return string Current path, or an empty string for unsafe locations.
	 */
	public static function resolve( string $path ): string {
		$path = wp_normalize_path( $path );
		if ( str_contains( $path, "\0" ) || preg_match( '#(?:^|[:/])(?:\.|\.\.)(?:/|$)#', $path ) ) {
			return '';
		}
		$roots = self::roots();
		foreach ( $roots as $prefix => $root ) {
			if ( str_starts_with( $path, $prefix ) ) {
				$resolved = $root . ( '' !== substr( $path, strlen( $prefix ) ) ? '/' . ltrim( substr( $path, strlen( $prefix ) ), '/' ) : '' );
				return self::allowed( $resolved ) ? $resolved : '';
			}
			if ( self::within( $path, $root ) ) {
				return self::allowed( $path ) ? $path : '';
			}
		}

		if ( str_starts_with( $path, '/' ) || preg_match( '#^[a-z]:/#i', $path ) ) {
			foreach ( $roots as $root ) {
				$marker   = '/' . basename( dirname( $root ) ) . '/' . basename( $root ) . '/';
				$position = strpos( $path, $marker );
				if ( false === $position ) {
					$marker   = '/' . basename( $root ) . '/';
					$position = strpos( $path, $marker );
				}
				if ( false !== $position || str_ends_with( $path, '/' . basename( $root ) ) ) {
					$relative = false !== $position ? substr( $path, $position + strlen( $marker ) ) : '';
					$resolved = $root . ( '' !== $relative ? '/' . $relative : '' );
					return self::allowed( $resolved ) ? $resolved : '';
				}
			}
			return self::allowed( $path ) ? $path : '';
		}

		// A source identity such as docs/index.md is not a filesystem URL.
		return preg_match( '#^[a-z][a-z0-9+.-]*:#i', $path ) ? '' : $path;
	}

	/**
	 * Read and resolve one synced page location.
	 *
	 * @param int    $post_id Post ID.
	 * @param string $key     Meta key.
	 * @return string Current source location.
	 */
	public static function from_meta( int $post_id, string $key ): string {
		$value = get_post_meta( $post_id, $key, true );
		return is_string( $value ) ? self::resolve( $value ) : '';
	}

	/**
	 * Get distinct child and parent theme locations without scanning files.
	 *
	 * @return array<string, string> Prefixes mapped to theme roots.
	 */
	private static function roots(): array {
		return array(
			'theme:'        => untrailingslashit( wp_normalize_path( get_stylesheet_directory() ) ),
			'parent-theme:' => untrailingslashit( wp_normalize_path( get_template_directory() ) ),
		);
	}

	/**
	 * Check a path boundary without touching the filesystem.
	 *
	 * @param string $path Path to check.
	 * @param string $root Root directory.
	 * @return bool Whether the path is inside this root.
	 */
	private static function within( string $path, string $root ): bool {
		return $path === $root || str_starts_with( $path, $root . '/' );
	}

	/**
	 * Avoid open_basedir warnings before a caller probes a stored path.
	 *
	 * @param string $path Absolute source path.
	 * @return bool Whether PHP allows this location.
	 */
	private static function allowed( string $path ): bool {
		$restriction = (string) ini_get( 'open_basedir' );
		if ( '' === $restriction ) {
			return true;
		}
		foreach ( explode( PATH_SEPARATOR, $restriction ) as $root ) {
			if ( '' === $root ) {
				continue;
			}
			$root = '.' === $root ? (string) getcwd() : $root;
			if ( self::within( $path, untrailingslashit( wp_normalize_path( $root ) ) ) ) {
				return true;
			}
		}
		return false;
	}
}
