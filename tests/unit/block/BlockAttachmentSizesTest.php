<?php

use Blockstudio\Block;
use PHPUnit\Framework\TestCase;

/**
 * The sizes of a files field value are built from wp_get_attachment_image_src(), and a hook can shorten the list.
 */
class BlockAttachmentSizesTest extends TestCase {

	private int $attachment_id = 0;
	private int $src_calls     = 0;
	private array $filters = array();

	protected function setUp(): void {
		parent::setUp();

		$file                = '2026/10/attachment-sizes.webp';
		$this->attachment_id = wp_insert_attachment(
			array(
				'post_title'     => 'Sizes image',
				'post_mime_type' => 'image/webp',
				'post_status'    => 'inherit',
				'guid'           => content_url( "uploads/$file" ),
			),
			$file
		);
		update_post_meta( $this->attachment_id, '_wp_attachment_image_alt', 'Sizes alt' );
		wp_update_attachment_metadata(
			$this->attachment_id,
			array(
				'width'  => 1200,
				'height' => 800,
				'file'   => $file,
				'sizes'  => array(
					'thumbnail' => array(
						'file'      => 'attachment-sizes-150x150.webp',
						'width'     => 150,
						'height'    => 150,
						'mime-type' => 'image/webp',
					),
					'medium'    => array(
						'file'      => 'attachment-sizes-300x200.webp',
						'width'     => 300,
						'height'    => 200,
						'mime-type' => 'image/webp',
					),
				),
			)
		);
	}

	protected function tearDown(): void {
		foreach ( $this->filters as list( $hook, $callback ) ) {
			remove_filter( $hook, $callback );
		}
		$this->filters = array();
		wp_delete_attachment( $this->attachment_id, true );
		parent::tearDown();
	}

	private function add_filter( string $hook, callable $callback, int $accepted_args = 1 ): void {
		add_filter( $hook, $callback, 10, $accepted_args );
		$this->filters[] = array( $hook, $callback );
	}

	private function count_src_calls(): void {
		$this->src_calls = 0;
		$this->add_filter(
			'wp_get_attachment_image_src',
			function ( $image ) {
				++$this->src_calls;
				return $image;
			}
		);
	}

	private function all_sizes(): array {
		return array_merge( array( 'full' ), get_intermediate_image_sizes() );
	}

	public function test_sizes_default_to_full_and_every_registered_size(): void {
		$data = Block::get_attachment_data( $this->attachment_id );

		$expected = array();
		foreach ( $this->all_sizes() as $size ) {
			$src = wp_get_attachment_image_src( $this->attachment_id, $size );
			if ( $src ) {
				$expected[ $size ]             = $src[0];
				$expected[ $size . '-width' ]  = $src[1];
				$expected[ $size . '-height' ] = $src[2];
			}
		}

		$this->assertIsArray( $data['sizes'] );
		$this->assertSame( $expected, $data['sizes'] );
		$this->assertStringEndsWith( 'attachment-sizes-150x150.webp', $data['sizes']['thumbnail'] );
	}

	public function test_sizes_pass_through_the_image_src_filter(): void {
		$this->add_filter(
			'wp_get_attachment_image_src',
			static function ( $image ) {
				if ( is_array( $image ) ) {
					$image[0] = 'https://cdn.example.test/' . basename( $image[0] );
				}
				return $image;
			}
		);

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertSame( 'https://cdn.example.test/attachment-sizes-150x150.webp', $data['sizes']['thumbnail'] );
		$this->assertSame( 'https://cdn.example.test/attachment-sizes-300x200.webp', $data['sizes']['medium'] );
	}

	public function test_default_resolves_one_source_per_size(): void {
		$this->count_src_calls();

		Block::get_attachment_data( $this->attachment_id );

		$this->assertSame( count( $this->all_sizes() ), $this->src_calls );
	}

	public function test_filter_with_an_empty_list_skips_the_sizes(): void {
		$this->add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_empty_array' );
		$this->count_src_calls();

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertNull( $data['sizes'] );
		$this->assertSame( 0, $this->src_calls );
		$this->assertSame( $this->attachment_id, $data['ID'] );
		$this->assertSame( 'Sizes alt', $data['alt'] );
		$this->assertSame( get_post( $this->attachment_id )->guid, $data['url'] );
	}

	public function test_filter_can_shorten_the_list(): void {
		$this->add_filter(
			'blockstudio/blocks/attributes/files/sizes',
			static fn( array $sizes ): array => array( 'full', 'thumbnail' )
		);
		$this->count_src_calls();

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertSame( 2, $this->src_calls );
		$this->assertSame(
			array( 'full', 'full-width', 'full-height', 'thumbnail', 'thumbnail-width', 'thumbnail-height' ),
			array_keys( $data['sizes'] )
		);
	}

	public function test_filter_receives_the_default_list_the_id_and_the_requested_size(): void {
		$received = array();
		$this->add_filter(
			'blockstudio/blocks/attributes/files/sizes',
			static function ( $sizes, $id, $size ) use ( &$received ) {
				$received = array( $sizes, $id, $size );
				return $sizes;
			},
			3
		);

		Block::get_attachment_data( $this->attachment_id, false, 0, 'medium' );

		$this->assertSame( $this->all_sizes(), $received[0] );
		$this->assertSame( $this->attachment_id, $received[1] );
		$this->assertSame( 'medium', $received[2] );
	}

	public function test_the_requested_size_still_sets_the_url_when_sizes_are_skipped(): void {
		$this->add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_empty_array' );

		$data = Block::get_attachment_data( $this->attachment_id, false, 0, 'thumbnail' );

		$this->assertStringEndsWith( 'attachment-sizes-150x150.webp', $data['url'] );
		$this->assertNull( $data['sizes'] );
	}

	public function test_a_filter_returning_a_non_array_skips_the_sizes(): void {
		$this->add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_false' );

		$this->assertNull( Block::get_attachment_data( $this->attachment_id )['sizes'] );
	}

	public function test_invalid_size_entries_are_ignored_and_duplicates_resolve_once(): void {
		$this->add_filter(
			'blockstudio/blocks/attributes/files/sizes',
			static fn(): array => array( 'thumbnail', '', false, null, array( 100, 100 ), new stdClass(), 'thumbnail' )
		);
		$this->count_src_calls();

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertSame( 1, $this->src_calls );
		$this->assertSame( array( 'thumbnail', 'thumbnail-width', 'thumbnail-height' ), array_keys( $data['sizes'] ) );
	}

	public function test_url_return_format_does_not_build_a_sizes_map(): void {
		$calls = 0;
		$this->add_filter(
			'blockstudio/blocks/attributes/files/sizes',
			static function ( $sizes ) use ( &$calls ) {
				++$calls;
				return array();
			}
		);
		$attributes = array( 'image' => $this->attachment_id );
		$names = array();
		Block::transform_attributes(
			$attributes,
			$names,
			array(),
			'test/files-url',
			array(),
			false,
			array( 'image' => array( 'blockstudio' => true, 'field' => 'files', 'type' => 'number', 'returnFormat' => 'url', 'returnSize' => 'thumbnail' ) )
		);

		$this->assertStringEndsWith( 'attachment-sizes-150x150.webp', $attributes['image'] );
		$this->assertSame( 0, $calls );
	}

	public function test_no_registered_sizes_keeps_the_existing_null_result(): void {
		$this->add_filter( 'intermediate_image_sizes', '__return_empty_array' );
		$this->count_src_calls();

		$this->assertNull( Block::get_attachment_data( $this->attachment_id )['sizes'] );
		$this->assertSame( 0, $this->src_calls );
	}

	public function test_the_filter_can_request_full_when_no_intermediate_sizes_are_registered(): void {
		$this->add_filter( 'intermediate_image_sizes', '__return_empty_array' );
		$this->add_filter( 'blockstudio/blocks/attributes/files/sizes', static fn(): array => array( 'full' ) );
		$this->count_src_calls();

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertSame( 1, $this->src_calls );
		$this->assertSame( array( 'full', 'full-width', 'full-height' ), array_keys( $data['sizes'] ) );
	}

	public function test_non_image_attachments_without_preview_metadata_have_no_sizes_key(): void {
		wp_update_post( array( 'ID' => $this->attachment_id, 'post_mime_type' => 'application/pdf' ) );
		wp_update_attachment_metadata( $this->attachment_id, array( 'sizes' => array() ) );

		$this->assertArrayNotHasKey( 'sizes', Block::get_attachment_data( $this->attachment_id ) );
	}

	public function test_a_pdf_with_a_generated_preview_can_have_image_sizes(): void {
		wp_update_post( array( 'ID' => $this->attachment_id, 'post_mime_type' => 'application/pdf' ) );
		update_post_meta( $this->attachment_id, '_wp_attached_file', '2026/10/attachment-sizes.pdf' );
		wp_update_attachment_metadata(
			$this->attachment_id,
			array( 'sizes' => array( 'full' => array( 'file' => 'attachment-sizes-pdf.jpg', 'width' => 1200, 'height' => 800, 'mime-type' => 'image/jpeg' ) ) )
		);

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertStringEndsWith( 'attachment-sizes-pdf.jpg', $data['sizes']['full'] );
		$this->assertSame( 1200, $data['sizes']['full-width'] );
		$this->assertSame( 800, $data['sizes']['full-height'] );
	}
}
