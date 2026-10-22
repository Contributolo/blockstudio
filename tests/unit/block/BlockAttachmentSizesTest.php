<?php

use Blockstudio\Block;
use PHPUnit\Framework\TestCase;

/**
 * The sizes of a files field value are built from wp_get_attachment_image_src(), and a hook can shorten the list.
 */
class BlockAttachmentSizesTest extends TestCase {

	private int $attachment_id = 0;
	private int $src_calls     = 0;

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
		remove_all_filters( 'blockstudio/blocks/attributes/files/sizes' );
		remove_all_filters( 'wp_get_attachment_image_src' );
		wp_delete_attachment( $this->attachment_id, true );
		parent::tearDown();
	}

	private function count_src_calls(): void {
		$this->src_calls = 0;
		add_filter(
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
		add_filter(
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
		add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_empty_array' );
		$this->count_src_calls();

		$data = Block::get_attachment_data( $this->attachment_id );

		$this->assertNull( $data['sizes'] );
		$this->assertSame( 0, $this->src_calls );
		$this->assertSame( $this->attachment_id, $data['ID'] );
		$this->assertSame( 'Sizes alt', $data['alt'] );
		$this->assertSame( get_post( $this->attachment_id )->guid, $data['url'] );
	}

	public function test_filter_can_shorten_the_list(): void {
		add_filter(
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
		add_filter(
			'blockstudio/blocks/attributes/files/sizes',
			static function ( $sizes, $id, $size ) use ( &$received ) {
				$received = array( $sizes, $id, $size );
				return $sizes;
			},
			10,
			3
		);

		Block::get_attachment_data( $this->attachment_id, false, 0, 'medium' );

		$this->assertSame( $this->all_sizes(), $received[0] );
		$this->assertSame( $this->attachment_id, $received[1] );
		$this->assertSame( 'medium', $received[2] );
	}

	public function test_the_requested_size_still_sets_the_url_when_sizes_are_skipped(): void {
		add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_empty_array' );

		$data = Block::get_attachment_data( $this->attachment_id, false, 0, 'thumbnail' );

		$this->assertStringEndsWith( 'attachment-sizes-150x150.webp', $data['url'] );
		$this->assertNull( $data['sizes'] );
	}

	public function test_a_filter_returning_a_non_array_skips_the_sizes(): void {
		add_filter( 'blockstudio/blocks/attributes/files/sizes', '__return_false' );

		$this->assertNull( Block::get_attachment_data( $this->attachment_id )['sizes'] );
	}
}
