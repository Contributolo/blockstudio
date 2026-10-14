<?php

use Blockstudio\Build;
use PHPUnit\Framework\TestCase;

class OptionSaveTest extends TestCase {

	private array $posts = array();
	private array $original_fields;
	private const OPTION = 'blockstudio_option_save_regression';
	private const BLOCK = 'blockstudio/type-storage-option';

	protected function setUp(): void {
		$block = Build::blocks()[ self::BLOCK ];
		$this->original_fields = $block->blockstudio['attributes'];
		$block->blockstudio['attributes'] = array(
			array( 'id' => 'value', 'type' => 'text', 'storage' => array( 'type' => array( 'option', 'postMeta' ), 'optionKey' => self::OPTION, 'postMetaKey' => self::OPTION ) ),
			array( 'id' => 'added', 'type' => 'text', 'storage' => array( 'type' => 'option', 'optionKey' => self::OPTION . '_added' ) ),
			array( 'id' => 'rows', 'type' => 'repeater', 'attributes' => array(
				array( 'id' => 'label', 'type' => 'text', 'storage' => array( 'type' => 'option', 'optionKey' => self::OPTION . '_rows' ) ),
			) ),
		);
		delete_option( self::OPTION );
		delete_option( self::OPTION . '_added' );
		delete_option( self::OPTION . '_rows' );
	}

	protected function tearDown(): void {
		Build::blocks()[ self::BLOCK ]->blockstudio['attributes'] = $this->original_fields;
		foreach ( $this->posts as $post_id ) {
			wp_delete_post( $post_id, true );
		}
		delete_option( self::OPTION );
		delete_option( self::OPTION . '_added' );
		delete_option( self::OPTION . '_rows' );
	}

	private function content( array $values, string $key = 'settings' ): string {
		return serialize_block( array(
			'blockName' => self::BLOCK,
			'attrs' => array( '__BLOCKSTUDIO_KEY' => $key, 'blockstudio' => array( 'attributes' => $values ) ),
			'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array(),
		) );
	}

	private function create_post( array $values, string $status = 'publish' ): int {
		$id = wp_insert_post( array( 'post_title' => 'Option save regression', 'post_type' => 'page', 'post_status' => $status, 'post_content' => $this->content( $values ) ), true );
		$this->assertIsInt( $id );
		$this->posts[] = $id;
		return $id;
	}

	public function test_draft_and_pending_saves_only_update_post_meta_until_publication(): void {
		update_option( self::OPTION, 'live' );
		$id = $this->create_post( array( 'value' => 'draft value' ), 'draft' );
		$this->assertSame( 'live', get_option( self::OPTION ) );
		$this->assertSame( 'draft value', get_post_meta( $id, self::OPTION, true ) );
		wp_update_post( array( 'ID' => $id, 'post_status' => 'pending' ) );
		$this->assertSame( 'live', get_option( self::OPTION ) );
		wp_update_post( array( 'ID' => $id, 'post_status' => 'publish' ) );
		$this->assertSame( 'draft value', get_option( self::OPTION ) );
		wp_update_post( array( 'ID' => $id, 'post_status' => 'draft', 'post_content' => $this->content( array( 'value' => 'unpublished' ) ) ) );
		$this->assertSame( 'draft value', get_option( self::OPTION ) );
	}

	public function test_unchanged_stale_copy_does_not_revert_another_posts_option(): void {
		$first = $this->create_post( array( 'value' => 'first' ) );
		$this->create_post( array( 'value' => 'newer' ) );
		wp_update_post( array( 'ID' => $first, 'post_title' => 'Only the title changed' ) );
		$this->assertSame( 'newer', get_option( self::OPTION ) );
		wp_update_post( array( 'ID' => $first, 'post_content' => $this->content( array( 'value' => 'intentionally changed' ) ) ) );
		$this->assertSame( 'intentionally changed', get_option( self::OPTION ) );
	}

	public function test_missing_fields_preserve_options_and_explicit_null_clears_them(): void {
		update_option( self::OPTION . '_added', 'existing' );
		$id = $this->create_post( array( 'value' => 'saved' ) );
		$this->assertSame( 'existing', get_option( self::OPTION . '_added' ) );
		wp_update_post( array( 'ID' => $id, 'post_content' => $this->content( array( 'value' => null ) ) ) );
		$this->assertFalse( get_option( self::OPTION ) );
		$this->assertSame( 'existing', get_option( self::OPTION . '_added' ) );
		foreach ( array( '', false, 0 ) as $value ) {
			wp_update_post( array( 'ID' => $id, 'post_content' => $this->content( array( 'value' => $value ) ) ) );
			$this->assertNotSame( 'missing', get_option( self::OPTION, 'missing' ) );
			$this->assertSame( (string) $value, (string) get_option( self::OPTION ) );
		}
	}

	public function test_keyed_block_reordering_does_not_republish_stale_options(): void {
		$id = $this->create_post( array( 'value' => 'saved' ) );
		update_option( self::OPTION, 'newer elsewhere' );
		wp_update_post( array( 'ID' => $id, 'post_content' => '<!-- wp:paragraph --><p>Before</p><!-- /wp:paragraph -->' . $this->content( array( 'value' => 'saved' ) ) ) );
		$this->assertSame( 'newer elsewhere', get_option( self::OPTION ) );
	}

	public function test_nested_repeater_options_ignore_unchanged_and_omitted_values(): void {
		$id = $this->create_post( array( 'rows' => array( array( 'label' => 'one' ), array( 'label' => 'two' ) ) ) );
		$this->assertSame( array( 'one', 'two' ), get_option( self::OPTION . '_rows' ) );
		update_option( self::OPTION . '_rows', array( 'newer' ) );
		wp_update_post( array( 'ID' => $id, 'post_title' => 'Title only' ) );
		$this->assertSame( array( 'newer' ), get_option( self::OPTION . '_rows' ) );
		wp_update_post( array( 'ID' => $id, 'post_content' => $this->content( array() ) ) );
		$this->assertSame( array( 'newer' ), get_option( self::OPTION . '_rows' ) );
		wp_update_post( array( 'ID' => $id, 'post_content' => $this->content( array( 'rows' => array() ) ) ) );
		$this->assertSame( array(), get_option( self::OPTION . '_rows' ) );
	}

	public function test_revision_does_not_write_options(): void {
		$id = $this->create_post( array( 'value' => 'live' ) );
		$revision = wp_insert_post( array( 'post_type' => 'revision', 'post_status' => 'inherit', 'post_parent' => $id, 'post_content' => $this->content( array( 'value' => 'revision' ) ) ), true );
		$this->assertIsInt( $revision );
		$this->posts[] = $revision;
		$this->assertSame( 'live', get_option( self::OPTION ) );
	}
}
