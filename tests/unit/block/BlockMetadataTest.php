<?php
/**
 * Public block metadata helpers.
 *
 * @package Blockstudio
 */

use Blockstudio\Assets;
use Blockstudio\Block_Registry;
use PHPUnit\Framework\TestCase;

class BlockMetadataTest extends TestCase {

	private string $name = 'blockstudio/metadata-test';
	private string $directory;
	private array $filters = array();

	protected function setUp(): void {
		$this->directory = WP_CONTENT_DIR . '/blockstudio-metadata-' . uniqid();
		wp_mkdir_p( $this->directory . '/_dist' );
	}

	protected function tearDown(): void {
		foreach ( $this->filters as $filter ) {
			remove_filter( $filter[0], $filter[1] );
		}
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		Block_Registry::instance()->remove_block( $this->name );
		$files = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $this->directory, FilesystemIterator::SKIP_DOTS ), RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $files as $file ) {
			$file->isDir() ? rmdir( $file->getPathname() ) : unlink( $file->getPathname() );
		}
		rmdir( $this->directory );
		parent::tearDown();
	}

	private function register( array $fields = array(), array $assets = array() ): void {
		register_block_type( $this->name, array( 'blockstudio' => array( 'attributes' => $fields ) ) );
		Block_Registry::instance()->set_block_data(
			$this->name,
			array( 'name' => $this->name, 'path' => $this->directory . '/block.json', 'assets' => $assets )
		);
	}

	private function asset( string $name, string $contents, bool $inline = false, bool $editor = false ): array {
		$path = $this->directory . '/' . $name;
		file_put_contents( $path, $contents );
		return array( 'path' => $path, 'type' => $inline ? 'inline' : 'external', 'editor' => $editor );
	}

	public function test_unknown_and_non_blockstudio_blocks_are_distinct_from_empty_fields(): void {
		$this->assertNull( bs_block_fields( 'missing/block' ) );
		$this->assertSame( array(), bs_block_assets( 'missing/block' ) );
		$this->assertNull( bs_block_fields( 'core/heading' ) );
		$this->assertSame( array(), bs_block_assets( 'core/heading' ) );
		$this->register();
		$this->assertSame( array(), bs_block_fields( $this->name ) );
		$this->assertSame( array(), bs_block_assets( $this->name ) );
	}

	public function test_field_definitions_preserve_nested_structure_and_are_returned_by_value(): void {
		$fields = array(
			array( 'type' => 'tabs', 'tabs' => array( array( 'title' => 'Content', 'attributes' => array( array( 'id' => 'title', 'type' => 'text' ) ) ) ) ),
			array( 'id' => 'items', 'type' => 'repeater', 'attributes' => array( array( 'id' => 'label', 'type' => 'text' ) ) ),
		);
		$this->register( $fields );
		$this->assertSame( $fields, bs_block_fields( $this->name ) );
		$copy          = bs_block_fields( $this->name );
		$copy[0]['id'] = 'changed';
		$this->assertSame( $fields, bs_block_fields( $this->name ) );

		$registered = WP_Block_Type_Registry::get_instance()->get_registered( 'blockstudio/type-text' );
		$this->assertNotNull( $registered );
		$this->assertSame( $registered->blockstudio['attributes'], bs_block_fields( 'blockstudio/type-text' ) );
	}

	public function test_assets_use_compiled_urls_inline_markup_and_contexts_without_enqueuing(): void {
		$assets = array(
			'style.css'            => $this->asset( 'style.css', '.source{}' ),
			'style.inline.css'     => $this->asset( 'style.inline.css', '.inline{}', true ),
			'script.js'            => $this->asset( 'script.js', 'window.shared = true;' ),
			'script.view.js'       => $this->asset( 'script.view.js', 'window.view = true;' ),
			'style.editor.css'     => $this->asset( 'style.editor.css', '.editor{}', false, true ),
			'admin-style.css'      => $this->asset( 'admin-style.css', '.admin{}' ),
			'block-editor-app.js'  => $this->asset( 'block-editor-app.js', 'window.editor = true;' ),
			'global-style.css'     => $this->asset( 'global-style.css', '.global{}' ),
			'script.inline.js'     => $this->asset( 'script.inline.js', 'window.inline = true;', true ),
			'uncompiled.scss'      => $this->asset( 'uncompiled.scss', '$color: red;' ),
			'empty.css'            => $this->asset( 'empty.css', '' ),
			'missing.css'          => array( 'path' => $this->directory . '/missing.css' ),
		);
		file_put_contents( $this->directory . '/_dist/style-123.css', '.compiled{}' );
		$this->register( array(), $assets );
		$scripts = wp_scripts()->queue;
		$styles  = wp_styles()->queue;
		$records = bs_block_assets( $this->name );
		$this->assertCount( 7, $records );
		$this->assertSame( $scripts, wp_scripts()->queue );
		$this->assertSame( $styles, wp_styles()->queue );
		$this->assertSame( 'style', $records[0]['type'] );
		$this->assertSame( Assets::get_id( 'style.css', array( 'name' => $this->name ) ), $records[0]['handle'] );
		$this->assertStringContainsString( '/_dist/style-123.css?ver=', $records[0]['url'] );
		$this->assertStringContainsString( $records[0]['url'], $records[0]['html'] );
		$this->assertFalse( $records[0]['inline'] );
		$this->assertTrue( $records[1]['inline'] );
		$this->assertNull( $records[1]['url'] );
		$this->assertStringContainsString( '.inline{}', $records[1]['html'] );
		$this->assertSame( 'module', $records[2]['type'] );
		$this->assertSame( array( 'frontend', 'editor' ), $records[2]['scope'] );
		$this->assertSame( array( 'frontend' ), $records[3]['scope'] );
		$this->assertSame( array( 'editor' ), $records[4]['scope'] );
		$this->assertSame( array( 'frontend', 'editor' ), $records[5]['scope'] );
		$this->assertSame( 'module', $records[6]['type'] );
		$this->assertStringContainsString( 'type="module"', $records[6]['html'] );
		$this->assertNotContains( Assets::get_id( 'admin-style.css', array( 'name' => $this->name ) ), array_column( $records, 'handle' ) );
		$this->assertNotContains( Assets::get_id( 'block-editor-app.js', array( 'name' => $this->name ) ), array_column( $records, 'handle' ) );
	}

	public function test_disabled_assets_are_not_reported(): void {
		$this->register( array(), array( 'style.css' => $this->asset( 'style.css', '.example{}' ) ) );
		$disable = fn () => array( Assets::get_id( 'style.css', array( 'name' => $this->name ) ) );
		add_filter( 'blockstudio/assets/disable', $disable );
		$this->filters[] = array( 'blockstudio/assets/disable', $disable );
		$this->assertSame( array(), bs_block_assets( $this->name ) );
	}
}
