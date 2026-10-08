<?php
/**
 * Blade renderer.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Renders Blade views with the installed illuminate/view package.
 *
 * The jenssegers/blade 2 wrapper bootstraps Laravel's view service provider,
 * which fails with illuminate/view 10 and later ("Target class
 * [blade.compiler] does not exist"). The view factory is assembled from
 * illuminate/view directly instead, which works from illuminate/view 8 on,
 * whether it was installed on its own or as a dependency of jenssegers/blade.
 *
 * @since 7.7.0
 */
final class Blade_Renderer {

	/**
	 * View factories keyed by view directory.
	 *
	 * @var array<string, object>
	 */
	private static array $factories = array();

	/**
	 * Whether Blade views can be rendered.
	 *
	 * @since 7.7.0
	 *
	 * @return bool Whether illuminate/view or jenssegers/blade is installed.
	 */
	public static function available(): bool {
		return self::has_view_package() || class_exists( 'Jenssegers\Blade\Blade' );
	}

	/**
	 * Render one Blade view.
	 *
	 * @since 7.7.0
	 *
	 * @param string               $directory View directory.
	 * @param string               $view      View name in dot notation, relative to the directory.
	 * @param array<string, mixed> $data      View data.
	 *
	 * @return string|null Rendered HTML, or null when no Blade package is installed.
	 */
	public static function render( string $directory, string $view, array $data = array() ): ?string {
		if ( self::has_view_package() ) {
			return (string) self::factory( $directory )->make( $view, $data )->render();
		}

		if ( class_exists( 'Jenssegers\Blade\Blade' ) ) {
			$blade = new \Jenssegers\Blade\Blade( $directory, self::cache_directory() );

			return (string) $blade->render( $view, $data );
		}

		return null;
	}

	/**
	 * Whether the illuminate/view classes the factory needs are installed.
	 *
	 * @return bool
	 */
	private static function has_view_package(): bool {
		return class_exists( 'Illuminate\View\Factory' )
			&& class_exists( 'Illuminate\View\Compilers\BladeCompiler' )
			&& class_exists( 'Illuminate\View\Engines\CompilerEngine' )
			&& class_exists( 'Illuminate\Filesystem\Filesystem' )
			&& class_exists( 'Illuminate\Events\Dispatcher' )
			&& class_exists( 'Illuminate\Container\Container' );
	}

	/**
	 * Build or reuse the view factory for a directory.
	 *
	 * @param string $directory View directory.
	 *
	 * @return \Illuminate\View\Factory Factory.
	 */
	private static function factory( string $directory ): object {
		if ( isset( self::$factories[ $directory ] ) ) {
			return self::$factories[ $directory ];
		}

		$files    = new \Illuminate\Filesystem\Filesystem();
		$compiler = new \Illuminate\View\Compilers\BladeCompiler( $files, self::cache_directory() );
		$resolver = new \Illuminate\View\Engines\EngineResolver();
		$resolver->register(
			'blade',
			static fn() => new \Illuminate\View\Engines\CompilerEngine( $compiler, $files )
		);

		self::$factories[ $directory ] = new \Illuminate\View\Factory(
			$resolver,
			new \Illuminate\View\FileViewFinder( $files, array( $directory ) ),
			new \Illuminate\Events\Dispatcher( new \Illuminate\Container\Container() )
		);

		return self::$factories[ $directory ];
	}

	/**
	 * Directory compiled views are written to.
	 *
	 * @return string Directory.
	 */
	private static function cache_directory(): string {
		$directory = rtrim( sys_get_temp_dir(), '/\\' ) . '/blockstudio-blade';

		if ( ! is_dir( $directory ) ) {
			wp_mkdir_p( $directory );
		}

		return $directory;
	}
}
