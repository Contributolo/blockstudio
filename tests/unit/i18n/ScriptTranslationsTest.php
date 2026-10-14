<?php
/**
 * Tests for editor and admin script translation loading.
 *
 * @package Blockstudio
 */

use Blockstudio\Admin;
use Blockstudio\Admin_Page;
use Blockstudio\Blocks;
use PHPUnit\Framework\TestCase;

class ScriptTranslationsTest extends TestCase {

	private $previous_scripts;
	private $previous_styles;
	private bool $previous_capture;
	private $translation_filter;

	protected function setUp(): void {
		$this->previous_scripts = $GLOBALS['wp_scripts'] ?? null;
		$this->previous_styles  = $GLOBALS['wp_styles'] ?? null;
		$GLOBALS['wp_scripts'] = new WP_Scripts();
		$GLOBALS['wp_styles']  = new WP_Styles();

		$property = new ReflectionProperty( Admin::class, 'capturing_assets' );
		$this->previous_capture = $property->getValue();
		$property->setValue( null, true );

		$this->translation_filter = static function ( $file, $handle, $domain ) {
			if ( 'blockstudio' === $domain && in_array( $handle, array( 'blockstudio-blocks', 'blockstudio-admin-page' ), true ) ) {
				return BLOCKSTUDIO_DIR . '/tests/theme/fixtures/script-translations.json';
			}

			return $file;
		};
		add_filter( 'load_script_translation_file', $this->translation_filter, 10, 3 );
	}

	protected function tearDown(): void {
		remove_filter( 'load_script_translation_file', $this->translation_filter, 10 );
		$GLOBALS['wp_scripts'] = $this->previous_scripts;
		$GLOBALS['wp_styles']  = $this->previous_styles;
		$property = new ReflectionProperty( Admin::class, 'capturing_assets' );
		$property->setValue( null, $this->previous_capture );
		parent::tearDown();
	}

	public function test_editor_bundle_loads_script_translations(): void {
		// Avoid attaching duplicate enqueue hooks to the shared test process.
		$blocks = ( new ReflectionClass( Blocks::class ) )->newInstanceWithoutConstructor();
		$blocks->enqueue_editor_assets();
		$this->assert_translations( 'blockstudio-blocks' );
	}

	public function test_admin_bundle_loads_script_translations(): void {
		$admin = ( new ReflectionClass( Admin_Page::class ) )->newInstanceWithoutConstructor();
		$admin->enqueue_admin_assets( 'tools_page_blockstudio-admin' );
		$this->assert_translations( 'blockstudio-admin-page' );
	}

	public function test_admin_bundle_is_not_registered_on_other_screens(): void {
		$admin = ( new ReflectionClass( Admin_Page::class ) )->newInstanceWithoutConstructor();
		$admin->enqueue_admin_assets( 'edit.php' );
		$this->assertFalse( wp_script_is( 'blockstudio-admin-page', 'registered' ) );
	}

	private function assert_translations( string $handle ): void {
		$scripts = wp_scripts();
		$this->assertTrue( wp_script_is( $handle, 'enqueued' ) );
		$this->assertSame( 'blockstudio', $scripts->registered[ $handle ]->textdomain );
		$this->assertContains( 'wp-i18n', $scripts->registered[ $handle ]->deps );
		$translations = $scripts->print_translations( $handle, false );
		$this->assertIsString( $translations );
		$this->assertStringContainsString( 'wp.i18n.setLocaleData', $translations );
		$this->assertStringContainsString( '"Mehr"', $translations );
		$this->assertStringContainsString( '"Uebersicht"', $translations );
	}
}
