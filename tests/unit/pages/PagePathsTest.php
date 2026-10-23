<?php

use Blockstudio\Page_Paths;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\TestCase;

class PagePathsTest extends TestCase {

	public function test_theme_paths_round_trip_without_storing_the_installation_root(): void {
		$root = wp_normalize_path( get_stylesheet_directory() );
		$this->assertSame( 'theme:pages/docs/index.md', Page_Paths::encode( $root . '/pages/docs/index.md' ) );
		$this->assertSame( $root . '/pages/docs/index.md', Page_Paths::resolve( 'theme:pages/docs/index.md' ) );
		$this->assertSame( 'theme:', Page_Paths::encode( $root ) );
		$this->assertSame( $root, Page_Paths::resolve( 'theme:' ) );
		$this->assertSame( 'docs/index.md', Page_Paths::resolve( 'docs/index.md' ) );
		$this->assertSame( 'docs/loader.php:generated-page', Page_Paths::resolve( 'docs/loader.php:generated-page' ) );
		$this->assertSame( 'theme:pages/docs/index.md', Page_Paths::encode( 'theme:pages/docs/index.md' ) );
	}

	public function test_parent_and_child_paths_keep_their_owner_with_identical_relative_names(): void {
		$child  = static fn(): string => '/srv/themes/child';
		$parent = static fn(): string => '/srv/themes/parent';
		add_filter( 'stylesheet_directory', $child );
		add_filter( 'template_directory', $parent );
		try {
			$this->assertSame( 'theme:pages/index.md', Page_Paths::encode( '/srv/themes/child/pages/index.md' ) );
			$this->assertSame( 'parent-theme:pages/index.md', Page_Paths::encode( '/srv/themes/parent/pages/index.md' ) );
			$this->assertSame( '/srv/themes/parent/pages/index.md', Page_Paths::resolve( 'parent-theme:pages/index.md' ) );
			$this->assertSame( '/srv/themes/child/pages/index.md', Page_Paths::resolve( '/jailed/old/themes/child/pages/index.md' ) );
			$this->assertSame( '/srv/themes/parent/pages/index.md', Page_Paths::resolve( 'C:\\old\\themes\\parent\\pages\\index.md' ) );
			$this->assertSame( '/srv/themes/child-extra/page.md', Page_Paths::encode( '/srv/themes/child-extra/page.md' ) );
		} finally {
			remove_filter( 'stylesheet_directory', $child );
			remove_filter( 'template_directory', $parent );
		}
	}

	public function test_rejects_traversal_streams_and_invalid_metadata(): void {
		foreach ( array( 'theme:../private.php', 'theme:pages/../../private.php', 'parent-theme:./index.md', 'file:///etc/passwd', 'php://filter/resource=test', "theme:bad\0.php" ) as $path ) {
			$this->assertSame( '', Page_Paths::resolve( $path ), $path );
		}
		$post_id = (int) wp_insert_post( array( 'post_title' => 'Invalid path metadata', 'post_status' => 'draft' ) );
		try {
			update_post_meta( $post_id, '_blockstudio_page_content_path', array( 'invalid' ) );
			$this->assertSame( '', Page_Paths::from_meta( $post_id, '_blockstudio_page_content_path' ) );
		} finally {
			wp_delete_post( $post_id, true );
		}
	}

	public function test_external_paths_remain_supported(): void {
		$path = wp_normalize_path( get_temp_dir() ) . 'external-page-fixture/index.md';
		$this->assertSame( $path, Page_Paths::encode( $path ) );
		$this->assertSame( $path, Page_Paths::resolve( $path ) );
	}

	#[RunInSeparateProcess]
	#[PreserveGlobalState(false)]
	public function test_jailed_legacy_paths_are_rebased_before_open_basedir_probes(): void {
		$root = wp_normalize_path( get_stylesheet_directory() );
		$old  = '/jailed/site/wp-content/themes/' . basename( $root ) . '/pages/docs/index.md';
		ini_set( 'open_basedir', ABSPATH . PATH_SEPARATOR . sys_get_temp_dir() );
		set_error_handler( static function ( int $severity, string $message ): never {
			throw new ErrorException( $message, 0, $severity );
		} );
		try {
			$this->assertSame( $root . '/pages/docs/index.md', Page_Paths::resolve( $old ) );
			$this->assertFileExists( Page_Paths::resolve( $old ) );
			$this->assertSame( '', Page_Paths::resolve( '/not-allowed/external/index.md' ) );
		} finally {
			restore_error_handler();
		}
	}
}
