<?php
/**
 * Virtual routes.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Serves whole documents for URLs that have no post behind them.
 *
 * A route renders inside Blockstudio's output buffer, so the finished HTML
 * gets its block assets, bundled UI assets and compiled Tailwind like any
 * page. The route also keeps WordPress from treating the request as a 404,
 * keeps redirect_canonical from redirecting it, and adds its URLs to static
 * prerender builds.
 *
 * @since 7.7.0
 */
final class Virtual_Routes {

	/**
	 * Template redirect priority routes render at: right after the output
	 * buffer opens, before redirect_canonical at 10.
	 */
	public const PRIORITY = Assets::BUFFER_PRIORITY + 1;

	/**
	 * Registered routes keyed by path.
	 *
	 * @var array<string, array{path:string, render:callable, prefix:bool, match:callable|null, title:string|\Closure|null, urls:array<int,string>|\Closure, status:int}>
	 */
	private static array $routes = array();

	/**
	 * Route resolved for the current request, or false when none matched.
	 *
	 * @var array{route:array, value:mixed, rest:string}|false|null
	 */
	private static array|false|null $current = null;

	/**
	 * Whether the hooks are registered.
	 *
	 * @var bool
	 */
	private static bool $hooked = false;

	/**
	 * Register a virtual route.
	 *
	 * The render callback receives the match value and the path below the
	 * route, and either echoes the document or returns it as a string. It
	 * runs at template_redirect inside Blockstudio's output buffer, after the
	 * main query, so get_header() and get_footer() work as in a template.
	 *
	 * @since 7.7.0
	 *
	 * @param string   $path    Path relative to the site home, such as `components`.
	 * @param callable $render  Render callback: function( mixed $match, string $rest ): ?string.
	 * @param array    $options {
	 *     Optional route options.
	 *
	 *     @type bool            $prefix Whether the route also serves every path below `$path`. Default false.
	 *     @type callable        $match  Receives the path below the route ('' for the route itself) and returns
	 *                                   a value for the render callback, or null or false to leave the request
	 *                                   to WordPress. Default accepts the route itself, and with `prefix` every
	 *                                   path below it.
	 *     @type string|\Closure $title  Document title, or a closure receiving the match value.
	 *     @type array|\Closure  $urls   Paths relative to the site home that static prerender builds render,
	 *                                   or a closure returning them. Default the route path without `prefix`.
	 *     @type int             $status HTTP status. Default 200.
	 * }
	 *
	 * @return void
	 */
	public static function register( string $path, callable $render, array $options = array() ): void {
		$path   = trim( wp_normalize_path( $path ), '/' );
		$prefix = ! empty( $options['prefix'] );
		$urls   = $options['urls'] ?? ( $prefix ? array() : array( $path ) );

		self::$routes[ $path ] = array(
			'path'   => $path,
			'render' => $render,
			'prefix' => $prefix,
			'match'  => isset( $options['match'] ) && is_callable( $options['match'] ) ? $options['match'] : null,
			'title'  => isset( $options['title'] ) && ( is_string( $options['title'] ) || $options['title'] instanceof \Closure ) ? $options['title'] : null,
			'urls'   => is_array( $urls ) || $urls instanceof \Closure ? $urls : array(),
			'status' => isset( $options['status'] ) && is_int( $options['status'] ) ? $options['status'] : 200,
		);

		// Longer paths first, so a nested route wins over a prefix route above it.
		uksort(
			self::$routes,
			static fn( string $a, string $b ): int => array( strlen( $b ), $a ) <=> array( strlen( $a ), $b )
		);

		self::$current = null;
		self::hook();
	}

	/**
	 * Remove a registered route.
	 *
	 * @since 7.7.0
	 *
	 * @param string $path Route path.
	 *
	 * @return void
	 */
	public static function unregister( string $path ): void {
		unset( self::$routes[ trim( wp_normalize_path( $path ), '/' ) ] );
		self::$current = null;
	}

	/**
	 * Resolve the route that serves a path.
	 *
	 * @since 7.7.0
	 *
	 * @param string $request Request path relative to the site home.
	 *
	 * @return array{path:string, value:mixed, rest:string}|null Route path, match value and path below the route, or null.
	 */
	public static function match( string $request ): ?array {
		$resolved = self::resolve( $request );

		return false === $resolved
			? null
			: array(
				'path'  => $resolved['route']['path'],
				'value' => $resolved['value'],
				'rest'  => $resolved['rest'],
			);
	}

	/**
	 * Absolute URLs of every route that static prerender builds and sitemaps
	 * should list.
	 *
	 * @since 7.7.0
	 *
	 * @return string[] URLs.
	 */
	public static function urls(): array {
		$urls = array();

		foreach ( self::$routes as $route ) {
			$paths = $route['urls'] instanceof \Closure ? call_user_func( $route['urls'] ) : $route['urls'];

			foreach ( is_array( $paths ) ? $paths : array() as $path ) {
				if ( is_string( $path ) ) {
					$path   = trim( $path, '/' );
					$urls[] = home_url( '' === $path ? '/' : '/' . $path . '/' );
				}
			}
		}

		return array_values( array_unique( $urls ) );
	}

	/**
	 * Add route URLs to the static prerender build.
	 *
	 * @param mixed $urls Public URLs.
	 *
	 * @return mixed URLs.
	 */
	public static function filter_public_urls( mixed $urls ): mixed {
		if ( ! is_array( $urls ) ) {
			return $urls;
		}

		return array_values( array_unique( array_merge( $urls, self::urls() ) ) );
	}

	/**
	 * Keep WordPress from flagging a routed request as a 404.
	 *
	 * @param mixed $preempt Whether another callback already handled it.
	 *
	 * @return mixed True for a routed request.
	 */
	public static function filter_pre_handle_404( mixed $preempt ): mixed {
		return false === self::current() ? $preempt : true;
	}

	/**
	 * Keep redirect_canonical from redirecting a routed request.
	 *
	 * The main query resolves a routed URL to nothing, so the canonical check
	 * reads a missing post and can redirect a valid route away.
	 *
	 * @param mixed $redirect Redirect URL.
	 *
	 * @return mixed False for a routed request.
	 */
	public static function filter_redirect_canonical( mixed $redirect ): mixed {
		return false === self::current() ? $redirect : false;
	}

	/**
	 * Serve the routed request and end it.
	 *
	 * @return void
	 */
	public static function serve(): void {
		if ( self::render_current() ) {
			exit;
		}
	}

	/**
	 * Render the routed request into the open output buffers.
	 *
	 * @since 7.7.0
	 *
	 * @return bool Whether a route rendered.
	 */
	public static function render_current(): bool {
		$current = self::current();
		if ( false === $current ) {
			return false;
		}

		$route = $current['route'];
		$title = $route['title'];
		if ( null !== $title ) {
			$title = $title instanceof \Closure ? call_user_func( $title, $current['value'] ) : $title;
			if ( is_string( $title ) && '' !== $title ) {
				add_filter( 'pre_get_document_title', static fn(): string => $title, 99 );
			}
		}

		self::reset_main_query();
		status_header( $route['status'] );

		$output = call_user_func( $route['render'], $current['value'], $current['rest'] );
		if ( is_string( $output ) ) {
			echo $output; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- The route callback owns its markup.
		}

		return true;
	}

	/**
	 * Remove every route and forget the resolved request.
	 *
	 * @return void
	 */
	public static function reset(): void {
		self::$routes  = array();
		self::$current = null;
	}

	/**
	 * Forget the route resolved for the current request.
	 *
	 * @return void
	 */
	public static function reset_request(): void {
		self::$current = null;
	}

	/**
	 * Register the request hooks once a route exists.
	 *
	 * @return void
	 */
	private static function hook(): void {
		if ( self::$hooked ) {
			return;
		}

		self::$hooked = true;

		add_action( 'parse_request', array( self::class, 'reset_request' ), 0 );
		add_filter( 'pre_handle_404', array( self::class, 'filter_pre_handle_404' ) );
		add_filter( 'redirect_canonical', array( self::class, 'filter_redirect_canonical' ) );
		add_action( 'template_redirect', array( self::class, 'serve' ), self::PRIORITY );
		add_filter( 'blockstudio/static_prerender/public_urls', array( self::class, 'filter_public_urls' ) );
	}

	/**
	 * Resolve the route for the current request once.
	 *
	 * @return array{route:array, value:mixed, rest:string}|false
	 */
	private static function current(): array|false {
		if ( null !== self::$current ) {
			return self::$current;
		}

		$wp = $GLOBALS['wp'] ?? null;
		if ( is_admin() || ! $wp instanceof \WP || ! is_string( $wp->request ?? null ) ) {
			return false;
		}

		self::$current = self::resolve( $wp->request );

		return self::$current;
	}

	/**
	 * Find the route serving a request path.
	 *
	 * @param string $request Request path relative to the site home.
	 *
	 * @return array{route:array, value:mixed, rest:string}|false
	 */
	private static function resolve( string $request ): array|false {
		$request = trim( $request, '/' );

		foreach ( self::$routes as $path => $route ) {
			if ( $request === $path ) {
				$rest = '';
			} elseif ( $route['prefix'] && ( '' === $path || str_starts_with( $request, $path . '/' ) ) ) {
				$rest = '' === $path ? $request : substr( $request, strlen( $path ) + 1 );
			} else {
				continue;
			}

			$value = null === $route['match'] ? $rest : call_user_func( $route['match'], $rest );
			if ( null === $value || false === $value ) {
				continue;
			}

			return array(
				'route' => $route,
				'value' => $value,
				'rest'  => $rest,
			);
		}

		return false;
	}

	/**
	 * Clear the singular state the main query reports for a routed URL.
	 *
	 * Rewrites often resolve such a URL to a page name without a post, so
	 * template tags would read a post that does not exist.
	 *
	 * @return void
	 */
	private static function reset_main_query(): void {
		$query = $GLOBALS['wp_query'] ?? null;
		if ( ! $query instanceof \WP_Query ) {
			return;
		}

		$query->is_404            = false;
		$query->is_page           = false;
		$query->is_single         = false;
		$query->is_singular       = false;
		$query->is_attachment     = false;
		$query->is_home           = false;
		$query->is_archive        = false;
		$query->is_category       = false;
		$query->is_tag            = false;
		$query->is_tax            = false;
		$query->post              = null;
		$query->posts             = array();
		$query->post_count        = 0;
		$query->queried_object    = null;
		$query->queried_object_id = 0;
		$GLOBALS['post']          = null; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- The routed document has no post.
	}
}
