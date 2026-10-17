<?php
/**
 * Private updater integration with WordPress classes and functions.
 *
 * @package Blockstudio
 */

use Blockstudio\Github_Updater;
use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5\PucFactory;
use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Plugin\PluginInfo;
use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Vcs\GitHubApi;
use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Vcs\PluginUpdateChecker;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;

class GithubUpdaterTest extends TestCase {

	private array $saved_hooks = array();

	protected function setUp(): void {
		parent::setUp();
		foreach ( $GLOBALS['wp_filter'] as $name => $hook ) {
			$this->saved_hooks[ $name ] = clone $hook;
		}
	}

	protected function tearDown(): void {
		$GLOBALS['wp_filter'] = $this->saved_hooks;
		$this->saved_hooks = array();
		parent::tearDown();
	}

	public function test_updater_without_a_token_keeps_requests_anonymous(): void {
		$this->assertFalse( defined( 'BLOCKSTUDIO_GITHUB_TOKEN' ) );
		$this->assert_request_token( $this->create_updater_api(), null );
	}

	#[DataProvider( 'filtered_tokens' )]
	public function test_token_filter_authenticates_only_nonempty_strings( mixed $value, ?string $expected ): void {
		$filter = static fn() => $value;
		add_filter( 'blockstudio/updater/token', $filter );
		try {
			$this->assert_request_token( $this->create_updater_api(), $expected );
		} finally {
			remove_filter( 'blockstudio/updater/token', $filter );
		}
	}

	public static function filtered_tokens(): array {
		return array(
			'token'          => array( 'test-filter-token', 'test-filter-token' ),
			'trimmed token'  => array( '  test-filter-token  ', 'test-filter-token' ),
			'empty'          => array( '', null ),
			'whitespace'     => array( '   ', null ),
			'false'          => array( false, null ),
			'null'           => array( null, null ),
			'number'         => array( 123, null ),
			'array'          => array( array( 'token' => 'not-supported' ), null ),
			'object'         => array( (object) array( 'token' => 'not-supported' ), null ),
		);
	}

	#[RunInSeparateProcess]
	#[PreserveGlobalState(false)]
	public function test_constant_supplies_the_default_and_filter_can_override_or_disable_it(): void {
		define( 'BLOCKSTUDIO_GITHUB_TOKEN', '  test-constant-token  ' );
		$this->assert_request_token( $this->create_updater_api(), 'test-constant-token' );

		$received = null;
		$filter = static function ( $token ) use ( &$received ) {
			$received = $token;
			return 'test-override-token';
		};
		add_filter( 'blockstudio/updater/token', $filter );
		try {
			$this->assert_request_token( $this->create_updater_api(), 'test-override-token' );
			$this->assertSame( BLOCKSTUDIO_GITHUB_TOKEN, $received );
		} finally {
			remove_filter( 'blockstudio/updater/token', $filter );
		}

		add_filter( 'blockstudio/updater/token', '__return_empty_string' );
		try {
			$this->assert_request_token( $this->create_updater_api(), null );
		} finally {
			remove_filter( 'blockstudio/updater/token', '__return_empty_string' );
		}
	}

	#[RunInSeparateProcess]
	#[PreserveGlobalState(false)]
	public function test_invalid_constant_does_not_enable_authentication(): void {
		define( 'BLOCKSTUDIO_GITHUB_TOKEN', array( 'token' => 'not-supported' ) );
		$this->assert_request_token( $this->create_updater_api(), null );
	}

	public function test_release_download_authentication_is_limited_to_the_repository_and_removed_on_redirect(): void {
		$filter = static fn() => 'test-download-token';
		add_filter( 'blockstudio/updater/token', $filter );
		try {
			$api = $this->create_updater_api();
			$args = $api->setUpdateDownloadHeaders( array( 'headers' => array() ), 'https://api.github.com/repos/inline0/blockstudio/releases/assets/123' );
			$this->assertSame( 'Basic ' . base64_encode( 'inline0:test-download-token' ), $args['headers']['Authorization'] );
			$this->assertSame( 'application/octet-stream', $args['headers']['Accept'] );

			foreach ( array( 'https://api.github.com/repos/other/plugin/releases/assets/123', 'https://example.org/plugin.zip' ) as $url ) {
				$unrelated = $api->setUpdateDownloadHeaders( array( 'headers' => array() ), $url );
				$this->assertArrayNotHasKey( 'Authorization', $unrelated['headers'] );
			}

			$location = 'https://release-assets.githubusercontent.com/example/plugin.zip';
			$api->removeAuthHeaderFromRedirects( $location, $args['headers'] );
			$this->assertArrayNotHasKey( 'Authorization', $args['headers'] );
		} finally {
			remove_filter( 'blockstudio/updater/token', $filter );
		}
	}

	private function create_updater_api(): GitHubApi {
		$registered = $GLOBALS['wp_filter']['plugins_api']->callbacks[20] ?? array();
		// WordPress already loaded the real updater. Isolate the constructor's
		// duplicate-slug guard; tearDown restores all original hooks.
		remove_all_filters( 'puc_is_slug_in_use-blockstudio' );
		new Github_Updater();
		$added = array_diff_key( $GLOBALS['wp_filter']['plugins_api']->callbacks[20] ?? array(), $registered );
		foreach ( $added as $callback ) {
			$checker = $callback['function'][0] ?? null;
			if ( $checker instanceof PluginUpdateChecker ) {
				return $checker->getVcsApi();
			}
		}
		$this->fail( 'Blockstudio did not register its GitHub updater.' );
	}

	private function assert_request_token( GitHubApi $api, ?string $token ): void {
		$requests = array();
		$intercept = static function ( $preempt, $args, $url ) use ( &$requests ) {
			$requests[] = array( 'url' => $url, 'args' => $args );
			return array(
				'headers'  => array(),
				'body'     => '[]',
				'response' => array( 'code' => 200, 'message' => 'OK' ),
				'cookies'  => array(),
			);
		};
		add_filter( 'pre_http_request', $intercept, 10, 3 );
		try {
			$api->getLatestTag();
			wp_remote_get( 'https://example.org/unrelated' );
			$this->assertCount( 2, $requests );
			$this->assertSame( 'https://api.github.com/repos/inline0/blockstudio/tags', $requests[0]['url'] );
			$this->assertStringNotContainsString( 'token', $requests[0]['url'] );
			if ( null === $token ) {
				$this->assertFalse( $api->isAuthenticationEnabled() );
				$this->assertArrayNotHasKey( 'Authorization', $requests[0]['args']['headers'] );
			} else {
				$this->assertTrue( $api->isAuthenticationEnabled() );
				$this->assertSame( 'Basic ' . base64_encode( 'inline0:' . $token ), $requests[0]['args']['headers']['Authorization'] );
			}
			$this->assertArrayNotHasKey( 'Authorization', $requests[1]['args']['headers'] );
		} finally {
			remove_filter( 'pre_http_request', $intercept, 10 );
		}
	}

	public function test_update_uri_excludes_wordpress_org_without_disabling_the_github_checker(): void {
		$data = get_plugin_data( BLOCKSTUDIO_FILE, false, false );
		$this->assertSame( 'https://blockstudio.dev', $data['UpdateURI'] );
		$this->assertSame( 'blockstudio.dev', wp_parse_url( $data['UpdateURI'], PHP_URL_HOST ) );
	}

	public function test_private_factory_builds_github_checker_and_enables_release_assets(): void {
		$checker = PucFactory::buildUpdateChecker( 'https://github.com/inline0/blockstudio/', BLOCKSTUDIO_FILE, 'blockstudio-isolation-test', 0 );
		try {
			$this->assertInstanceOf( \BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Vcs\PluginUpdateChecker::class, $checker );
			$this->assertInstanceOf( \BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Vcs\GitHubApi::class, $checker->getVcsApi() );
			$checker->getVcsApi()->enableReleaseAssets();
			$this->assertStringContainsString( 'inline0/blockstudio', $checker->getVcsApi()->buildArchiveDownloadUrl() );
		} finally {
			$checker->removeHooks();
		}
	}

	public function test_invalid_metadata_uses_native_wordpress_error(): void {
		$validate = new ReflectionMethod( PluginInfo::class, 'validateMetadata' );
		$error    = $validate->invoke( new PluginInfo(), (object) array() );
		$this->assertInstanceOf( WP_Error::class, $error );
		$this->assertSame( 'puc-invalid-metadata', $error->get_error_code() );
		$this->assertSame( '7.7.2', PluginInfo::fromJson( '{"name":"Blockstudio","version":"7.7.2"}' )->toWpFormat()->version );
	}

	public function test_private_updater_restores_cached_state_from_the_public_namespace(): void {
		$option = 'blockstudio_test_legacy_updater_state';
		update_site_option(
			$option,
			(object) array(
				'lastCheck'       => 1000,
				'checkedVersion'  => '7.7.1',
				'updateClass'     => 'YahnisElsts\\PluginUpdateChecker\\v5p6\\Plugin\\Update',
				'updateBaseClass' => 'Plugin\\Update',
				'update'          => (object) array( 'slug' => 'blockstudio', 'version' => '7.7.2' ),
			)
		);
		try {
			$store = new \BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\StateStore( $option );
			$this->assertSame( 1000, $store->getLastCheck() );
			$this->assertSame( '7.7.1', $store->getCheckedVersion() );
			$this->assertInstanceOf( \BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Plugin\Update::class, $store->getUpdate() );
			$this->assertSame( '7.7.2', $store->getUpdate()->version );
			$store->save();
			$this->assertSame( \BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Plugin\Update::class, get_site_option( $option )->updateClass );
		} finally {
			delete_site_option( $option );
		}
	}

	public function test_private_readme_parser_uses_wordpress_sanitization(): void {
		$parser = new \BlockstudioVendor\PucReadmeParser();
		$result = $parser->parse_readme_contents( "=== Test Plugin ===\nContributors: author\nStable tag: 1.0\n\n== Description ==\n**Safe** <script>alert(1)</script>\n" );
		$this->assertStringContainsString( '<strong>Safe</strong>', $result['sections']['description'] );
		$this->assertStringNotContainsString( '<script>', $result['sections']['description'] );
	}
}
