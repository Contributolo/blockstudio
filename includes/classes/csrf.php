<?php
/**
 * CSRF class.
 *
 * Provides CSRF protection for public Blockstudio endpoints.
 * Works for both logged-in and logged-out users.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Generates and verifies CSRF tokens independent of WordPress user sessions.
 *
 * @since 7.1.0
 */
class Csrf {

	/**
	 * Header name for the CSRF token.
	 *
	 * @var string
	 */
	const HEADER = 'X-BS-Token';

	/**
	 * Register credential refresh only when an API client is enabled.
	 *
	 * @return void
	 */
	public static function init(): void {
		if ( false === has_action( 'rest_api_init', array( __CLASS__, 'register_endpoint' ) ) ) {
			add_action( 'rest_api_init', array( __CLASS__, 'register_endpoint' ) );
		}
	}

	/**
	 * Register the uncached same-origin credential endpoint.
	 *
	 * @return void
	 */
	public static function register_endpoint(): void {
		register_rest_route(
			'blockstudio/v1',
			'/client/credentials',
			array(
				'methods'             => 'POST',
				'permission_callback' => array( __CLASS__, 'can_refresh' ),
				'callback'            => array( __CLASS__, 'refresh' ),
			)
		);
	}

	/**
	 * Require a non-simple request header and reject cross-origin browser calls.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return bool Whether credential refresh is allowed.
	 */
	public static function can_refresh( \WP_REST_Request $request ): bool {
		if ( '1' !== $request->get_header( 'x_bs_credentials' ) ) {
			return false;
		}
		$site = strtolower( (string) $request->get_header( 'sec_fetch_site' ) );
		if ( '' !== $site && ! in_array( $site, array( 'same-origin', 'none' ), true ) ) {
			return false;
		}
		$origin = $request->get_header( 'origin' );
		if ( null === $origin || '' === $origin ) {
			return true;
		}
		$parts = wp_parse_url( $origin );
		if ( ! is_array( $parts ) || ! in_array( $parts['scheme'] ?? '', array( 'http', 'https' ), true ) || empty( $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] ) || ! in_array( $parts['path'] ?? '', array( '', '/' ), true ) ) {
			return false;
		}
		$normalize = static function ( $url ): array {
			$p = wp_parse_url( $url );
			return array(
				strtolower( $p['scheme'] ?? '' ),
				strtolower( $p['host'] ?? '' ),
				(int) ( $p['port'] ?? ( 'https' === ( $p['scheme'] ?? '' ) ? 443 : 80 ) ),
			);
		};
		return in_array( $normalize( $origin ), array( $normalize( home_url() ), $normalize( site_url() ) ), true );
	}

	/**
	 * Issue fresh credentials for the visiting cookie session, never the cached page author.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error Credentials or a permission error.
	 */
	public static function refresh( \WP_REST_Request $request ) {
		if ( ! self::can_refresh( $request ) ) {
			return new \WP_Error( 'blockstudio_credentials_forbidden', 'Same-origin credential request required.', array( 'status' => 403 ) );
		}
		// Core clears the REST user without a nonce; the guarded refresh bootstraps that nonce.
		if ( ! is_user_logged_in() ) {
			$user_id = wp_validate_auth_cookie( '', 'logged_in' );
			if ( $user_id > 0 ) {
				wp_set_current_user( $user_id );
			}
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST && ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Shared page-cache bypass convention.
		}
		$response = rest_ensure_response(
			array(
				'nonce' => wp_create_nonce( 'wp_rest' ),
				'token' => self::generate(),
			)
		);
		$response->header( 'Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'Expires', '0' );
		$response->header( 'Vary', 'Origin, Cookie' );
		$response->header( 'X-Robots-Tag', 'noindex' );
		return $response;
	}

	/**
	 * Get the shared, idempotent API transport without embedding expiring credentials.
	 *
	 * @return string Client JavaScript.
	 */
	public static function client_script(): string {
		return 'window.bs=window.bs||{};bs._credentialsUrl=' . wp_json_encode( rest_url( 'blockstudio/v1/client/credentials' ) ) . ';'
			. file_get_contents( BLOCKSTUDIO_DIR . '/includes/assets/runtime/client-credentials.js' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Bundled generated runtime.
	}

	/**
	 * Generate a CSRF token.
	 *
	 * Uses the WordPress nonce tick (rotates every 12 hours) combined with
	 * a site-specific secret. Not tied to user ID so it works for logged-out
	 * visitors.
	 *
	 * @return string The token.
	 */
	public static function generate(): string {
		return wp_hash( wp_nonce_tick() . '|blockstudio_csrf' );
	}

	/**
	 * Verify a CSRF token.
	 *
	 * Checks both current and previous tick to handle the rotation window.
	 *
	 * @param string $token The token to verify.
	 *
	 * @return bool Whether the token is valid.
	 */
	public static function verify( string $token ): bool {
		if ( empty( $token ) ) {
			return false;
		}

		$current = wp_hash( wp_nonce_tick() . '|blockstudio_csrf' );

		if ( hash_equals( $current, $token ) ) {
			return true;
		}

		$previous = wp_hash( ( wp_nonce_tick() - 1 ) . '|blockstudio_csrf' );

		return hash_equals( $previous, $token );
	}

	/**
	 * Verify the CSRF token from a REST request.
	 *
	 * @param \WP_REST_Request $request The request.
	 *
	 * @return bool Whether the token is valid.
	 */
	public static function verify_request( $request ): bool {
		$token = $request->get_header( 'x_bs_token' );

		return self::verify( $token ?? '' );
	}
}
