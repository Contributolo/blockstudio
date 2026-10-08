<?php

use Blockstudio\Assets;
use Blockstudio\Virtual_Routes;
use PHPUnit\Framework\TestCase;

/**
 * Virtual routes serve whole documents for URLs without a post, inside
 * Blockstudio's output buffer and before redirect_canonical.
 */
class VirtualRoutesTest extends TestCase {

	private string $request = '';

	private ?WP_Query $query = null;

	private mixed $screen = null;

	protected function setUp(): void {
		parent::setUp();
		Virtual_Routes::reset();
		$this->request = (string) ( $GLOBALS['wp']->request ?? '' );
		$this->query   = $GLOBALS['wp_query'] ?? null;
		// Routes serve frontend requests; earlier tests can leave an admin screen set.
		$this->screen = $GLOBALS['current_screen'] ?? null;
		unset( $GLOBALS['current_screen'] );
	}

	protected function tearDown(): void {
		Virtual_Routes::reset();
		$GLOBALS['wp']->request = $this->request;
		$GLOBALS['wp_query']    = $this->query;
		if ( null !== $this->screen ) {
			$GLOBALS['current_screen'] = $this->screen;
		}
		remove_all_filters( 'pre_get_document_title' );
		parent::tearDown();
	}

	private function request( string $path ): void {
		$GLOBALS['wp']->request = $path;
		Virtual_Routes::reset_request();
	}

	private function register_components(): void {
		Virtual_Routes::register(
			'components',
			static fn( mixed $component, string $rest ): string => '<main class="p-4">' . esc_html( (string) $component ) . '|' . esc_html( $rest ) . '</main>',
			array(
				'prefix' => true,
				'match'  => static fn( string $rest ): ?string => '' === $rest ? 'index' : ( in_array( $rest, array( 'button', 'card' ), true ) ? strtoupper( $rest ) : null ),
				'title'  => static fn( string $component ): string => $component . ' component',
				'urls'   => static fn(): array => array( 'components', 'components/button', 'components/card' ),
			)
		);
	}

	public function test_routes_match_their_path_and_let_the_match_callback_decline(): void {
		$this->register_components();
		Virtual_Routes::register( 'components/changelog', static fn(): string => 'changelog' );

		$this->assertSame(
			array(
				'path'  => 'components',
				'value' => 'BUTTON',
				'rest'  => 'button',
			),
			Virtual_Routes::match( '/components/button/' )
		);
		$this->assertSame( 'index', Virtual_Routes::match( 'components' )['value'] ?? null );
		$this->assertSame( 'components/changelog', Virtual_Routes::match( 'components/changelog' )['path'] ?? null );
		$this->assertNull( Virtual_Routes::match( 'components/unknown' ) );
		$this->assertNull( Virtual_Routes::match( 'componentsx' ) );
		$this->assertNull( Virtual_Routes::match( 'about' ) );
	}

	public function test_a_routed_request_is_neither_a_404_nor_redirected(): void {
		$this->register_components();

		$this->request( 'components/card' );
		$this->assertTrue( apply_filters( 'pre_handle_404', false, $GLOBALS['wp_query'] ) );
		$this->assertFalse( apply_filters( 'redirect_canonical', 'https://example.com/elsewhere/', 'https://example.com/components/card/' ) );

		$this->request( 'components/unknown' );
		$this->assertFalse( apply_filters( 'pre_handle_404', false, $GLOBALS['wp_query'] ) );
		$this->assertSame( 'https://example.com/elsewhere/', apply_filters( 'redirect_canonical', 'https://example.com/elsewhere/', 'https://example.com/components/unknown/' ) );
	}

	public function test_the_route_renders_its_document_with_a_title_and_status(): void {
		$this->register_components();
		$this->request( 'components/button' );

		$query                    = new WP_Query();
		$query->is_404            = true;
		$query->is_singular       = true;
		$query->queried_object_id = 42;
		$GLOBALS['wp_query']      = $query;

		$statuses = array();
		$record   = static function ( string $header, int $code ) use ( &$statuses ): string {
			$statuses[] = $code;

			return $header;
		};
		add_filter( 'status_header', $record, 10, 2 );

		ob_start();
		try {
			$rendered = Virtual_Routes::render_current();
		} finally {
			$output = (string) ob_get_clean();
			remove_filter( 'status_header', $record, 10 );
		}

		$this->assertTrue( $rendered );
		$this->assertSame( '<main class="p-4">BUTTON|button</main>', $output );
		$this->assertSame( array( 200 ), $statuses );
		$this->assertSame( 'BUTTON component', apply_filters( 'pre_get_document_title', '' ) );
		$this->assertFalse( $query->is_404 );
		$this->assertFalse( $query->is_singular );
		$this->assertSame( 0, $query->queried_object_id );

		$this->request( 'about' );
		$this->assertFalse( Virtual_Routes::render_current() );
	}

	public function test_routes_render_inside_the_output_buffer_and_before_canonical_redirects(): void {
		$this->register_components();

		$this->assertSame( Assets::BUFFER_PRIORITY, has_action( 'template_redirect', array( Assets::init(), 'maybe_buffer_output' ) ) );
		$this->assertSame( Virtual_Routes::PRIORITY, has_action( 'template_redirect', array( Virtual_Routes::class, 'serve' ) ) );
		$this->assertGreaterThan( Assets::BUFFER_PRIORITY, Virtual_Routes::PRIORITY );
		$this->assertLessThan( has_action( 'template_redirect', 'redirect_canonical' ), Virtual_Routes::PRIORITY );
	}

	public function test_route_urls_join_static_prerender_builds(): void {
		$this->register_components();
		Virtual_Routes::register( 'status', static fn(): string => 'ok' );

		$urls = apply_filters( 'blockstudio/static_prerender/public_urls', array( home_url( '/' ) ) );

		$this->assertSame(
			array(
				home_url( '/' ),
				home_url( '/components/' ),
				home_url( '/components/button/' ),
				home_url( '/components/card/' ),
				home_url( '/status/' ),
			),
			$urls
		);
	}
}
