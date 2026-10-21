<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * Files fields load their attachments in one query, however many files a block holds.
 */
class BlockFilesQueryCountTest extends TestCase {

	private string $name = 'files-query-test/gallery';
	private string $directory;
	private array $registry_state = array();
	private array $attachment_ids = array();

	protected function setUp(): void {
		parent::setUp();
		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->directory = sys_get_temp_dir() . '/bs-files-query-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );

		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'Gallery',
					'blockstudio' => array(
						'attributes' => array(
							array(
								'id'         => 'slides',
								'type'       => 'repeater',
								'attributes' => array(
									array(
										'id'   => 'image',
										'type' => 'files',
									),
									array(
										'id'           => 'thumbnail',
										'type'         => 'files',
										'returnFormat' => 'url',
										'returnSize'   => 'thumbnail',
									),
								),
							),
						),
					),
				)
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="files-query-test" data-template="<?php echo esc_attr( wp_json_encode( $a ) ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );

		for ( $i = 0; $i < 12; $i++ ) {
			$this->attachment_ids[] = $this->create_attachment( $i );
		}
	}

	protected function tearDown(): void {
		foreach ( $this->attachment_ids as $id ) {
			wp_delete_attachment( $id, true );
		}
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		foreach ( $this->registry_state as $name => $value ) {
			( new ReflectionProperty( Block_Registry::class, $name ) )->setValue( Block_Registry::instance(), $value );
		}
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	private function create_attachment( int $index ): int {
		$file = "2026/10/files-query-$index.webp";
		$id   = wp_insert_attachment(
			array(
				'post_title'     => "Image $index",
				'post_mime_type' => 'image/webp',
				'post_status'    => 'inherit',
				'guid'           => content_url( "uploads/$file" ),
			),
			$file
		);
		update_post_meta( $id, '_wp_attachment_image_alt', "Alt $index" );
		wp_update_attachment_metadata(
			$id,
			array(
				'width'  => 1200,
				'height' => 800,
				'file'   => $file,
				'sizes'  => array(
					'thumbnail' => array(
						'file'      => "files-query-$index-150x150.webp",
						'width'     => 150,
						'height'    => 150,
						'mime-type' => 'image/webp',
					),
				),
			)
		);

		return $id;
	}

	private function render_slides( int $count ): array {
		$slides = array();
		foreach ( array_slice( $this->attachment_ids, 0, $count * 2, true ) as $i => $id ) {
			$slides[ intdiv( $i, 2 ) ][ 0 === $i % 2 ? 'image' : 'thumbnail' ] = $id;
		}

		foreach ( $this->attachment_ids as $id ) {
			clean_post_cache( $id );
		}

		global $wpdb;
		$queries = $wpdb->num_queries;
		$html    = do_blocks( '<!-- wp:' . $this->name . ' ' . wp_json_encode( array( 'blockstudio' => array( 'attributes' => array( 'slides' => array_values( $slides ) ) ) ) ) . ' /-->' );
		$queries = $wpdb->num_queries - $queries;

		$tags = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'files-query-test' ) ), $html );

		return array( $queries, json_decode( (string) $tags->get_attribute( 'data-template' ), true ) );
	}

	public function test_query_count_does_not_grow_with_the_number_of_files(): void {
		list( $two_slides ) = $this->render_slides( 2 );
		list( $six_slides ) = $this->render_slides( 6 );

		$this->assertSame( $two_slides, $six_slides );
	}

	public function test_files_still_resolve_after_priming(): void {
		list( , $template ) = $this->render_slides( 3 );

		$this->assertCount( 3, $template['slides'] );
		foreach ( $template['slides'] as $i => $slide ) {
			$this->assertSame( $this->attachment_ids[ $i * 2 ], $slide['image']['ID'] );
			$this->assertSame( 'Alt ' . ( $i * 2 ), $slide['image']['alt'] );
			$this->assertStringEndsWith( 'files-query-' . ( $i * 2 + 1 ) . '-150x150.webp', $slide['thumbnail'] );
		}
	}
}
