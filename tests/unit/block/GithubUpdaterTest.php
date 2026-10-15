<?php
/**
 * Private updater integration with WordPress classes and functions.
 *
 * @package Blockstudio
 */

use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5\PucFactory;
use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5p6\Plugin\PluginInfo;
use PHPUnit\Framework\TestCase;

class GithubUpdaterTest extends TestCase {

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
