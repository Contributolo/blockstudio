<?php

use Blockstudio\Block;
use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * Post content primes the attachments of all its Blockstudio blocks at once.
 */
class BlockPagePrimingTest extends TestCase {

	private string $name = 'page-priming-test/image';
	private string $directory;
	private array $registry_state = array();
	private array $attachment_ids = array();
	private array $queries        = array();

	protected function setUp(): void {
		parent::setUp();
		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->directory = sys_get_temp_dir() . '/bs-page-priming-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		wp_mkdir_p( $this->directory . '/extensions' );
		file_put_contents(
			$this->directory . '/extensions/files.json',
			wp_json_encode(
				array(
					'name' => array( $this->name, 'core/paragraph' ),
					'blockstudio' => array(
						'extend' => true,
						'attributes' => array(
							array( 'id' => 'extra', 'type' => 'files' ),
							array( 'id' => 'extraTop', 'type' => 'files' ),
							array( 'id' => 'idOnly', 'type' => 'files', 'returnFormat' => 'id' ),
						),
					),
				)
			)
		);

		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'Image',
					'blockstudio' => array(
						'attributes' => array(
							array(
								'id'   => 'image',
								'type' => 'files',
							),
							array(
								'id'         => 'slides',
								'type'       => 'repeater',
								'attributes' => array(
									array(
										'id'   => 'photo',
										'type' => 'files',
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
<div class="page-priming-test" data-template="<?php echo esc_attr( wp_json_encode( $a ) ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );

		for ( $i = 0; $i < 12; $i++ ) {
			$this->attachment_ids[] = $this->create_attachment( $i );
		}

		add_filter( 'query', array( $this, 'record_query' ) );
	}

	protected function tearDown(): void {
		remove_filter( 'query', array( $this, 'record_query' ) );
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

	public function record_query( $query ) {
		$this->queries[] = $query;

		return $query;
	}

	private function create_attachment( int $index ): int {
		$file = "2026/10/page-priming-$index.webp";
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
				'sizes'  => array(),
			)
		);

		return $id;
	}

	/**
	 * One block comment whose image and first slide point at the given attachments.
	 */
	private function block( int $image, int $photo ): string {
		return '<!-- wp:' . $this->name . ' ' . wp_json_encode(
			array(
				'blockstudio' => array(
					'attributes' => array(
						'image'  => $image,
						'slides' => array( array( 'photo' => $photo ) ),
					),
				),
			)
		) . ' /-->';
	}

	/**
	 * Content with one block per attachment pair, every second block inside a group.
	 */
	private function content( int $blocks ): string {
		$content = '';
		for ( $i = 0; $i < $blocks; $i++ ) {
			$block    = $this->block( $this->attachment_ids[ $i * 2 ], $this->attachment_ids[ $i * 2 + 1 ] );
			$content .= 1 === $i % 2
				? '<!-- wp:group --><div class="wp-block-group">' . $block . '</div><!-- /wp:group -->'
				: $block;
		}

		return $content;
	}

	/**
	 * Render content through `the_content` with cold attachment caches.
	 *
	 * @return array{0: string, 1: array<int, string>} The HTML and every query the render ran.
	 */
	private function render( string $content ): array {
		foreach ( $this->attachment_ids as $id ) {
			clean_post_cache( $id );
		}

		$this->queries = array();
		$html          = apply_filters( 'the_content', $content ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core WordPress filter.

		return array( $html, $this->queries );
	}

	/**
	 * Keep the queries that load attachments and their meta.
	 *
	 * @param array<int, string> $queries All queries.
	 *
	 * @return array<int, string>
	 */
	private function attachment_queries( array $queries ): array {
		global $wpdb;

		return array_values(
			array_filter(
				$queries,
				function ( string $query ) use ( $wpdb ): bool {
					$pattern = '/FROM (?:' . preg_quote( $wpdb->posts, '/' ) . ' WHERE ID|'
						. preg_quote( $wpdb->postmeta, '/' ) . ' WHERE post_id) IN \(([0-9, ]+)\)/';
					if ( ! preg_match( $pattern, $query, $match ) ) {
						return false;
					}
					return array() !== array_intersect( $this->attachment_ids, array_map( 'intval', explode( ',', $match[1] ) ) );
				}
			)
		);
	}

	private function prime( string $name, array $attrs ): array {
		foreach ( $this->attachment_ids as $id ) {
			clean_post_cache( $id );
		}
		$content = serialize_block( array( 'blockName' => $name, 'attrs' => $attrs, 'innerBlocks' => array(), 'innerHTML' => '', 'innerContent' => array() ) );
		$this->assertSame( $content, Block::prime_content_attachments( $content ) );

		return array_values( array_filter( $this->attachment_ids, static fn( $id ): bool => false !== wp_cache_get( $id, 'posts' ) ) );
	}

	public function test_page_priming_is_registered_before_core_block_rendering(): void {
		$this->assertSame( 8, has_filter( 'the_content', array( Block::class, 'prime_content_attachments' ) ) );
		$this->assertLessThan( has_filter( 'the_content', 'do_blocks' ), 8 );
	}

	public function test_extensions_repeaters_and_disabled_and_id_only_files_match_rendering(): void {
		$ids = $this->attachment_ids;
		$primed = $this->prime(
			$this->name,
			array(
				'blockstudio' => array(
					'attributes' => array( 'image' => $ids[0], 'slides' => array( array( 'photo' => $ids[1] ) ), 'extra' => $ids[2], 'extraTop' => $ids[3], 'idOnly' => $ids[4] ),
					'disabled' => array( 'extraTop_' . $ids[3] ),
				),
			)
		);

		$this->assertSame( array_slice( $ids, 0, 3 ), $primed );
	}

	public function test_foreign_extensions_do_not_adopt_top_level_field_values(): void {
		$primed = $this->prime(
			'core/paragraph',
			array( 'extraTop' => $this->attachment_ids[0], 'blockstudio' => array( 'attributes' => array( 'extra' => $this->attachment_ids[1] ) ) )
		);

		$this->assertSame( array( $this->attachment_ids[1] ), $primed );
	}

	public function test_unknown_blocks_cannot_prime_a_named_blockstudio_blocks_files(): void {
		$primed = $this->prime(
			'not-managed/block',
			array( 'blockstudio' => array( 'name' => $this->name, 'attributes' => array( 'image' => $this->attachment_ids[0] ) ) )
		);

		$this->assertSame( array(), $primed );
	}

	public function test_malformed_containers_do_not_break_the_prepass(): void {
		$this->assertSame( array(), $this->prime( $this->name, array( 'blockstudio' => 'broken' ) ) );
		$this->assertSame( array(), $this->prime( $this->name, array( 'blockstudio' => array( 'attributes' => 'broken', 'disabled' => 'broken' ) ) ) );
		$this->assertSame(
			array( $this->attachment_ids[0] ),
			$this->prime( $this->name, array( 'blockstudio' => array( 'attributes' => array( 'image' => $this->attachment_ids[0] ), 'disabled' => 'broken' ) ) )
		);
	}

	public function test_attachments_of_all_blocks_load_in_one_query_pair(): void {
		list( , $queries ) = $this->render( $this->content( 6 ) );
		$queries           = $this->attachment_queries( $queries );

		$this->assertCount( 2, $queries, implode( "\n", $queries ) );
		$this->assertStringContainsString( "{$GLOBALS['wpdb']->posts} WHERE ID IN", $queries[0] );
		$this->assertStringContainsString( "{$GLOBALS['wpdb']->postmeta} WHERE post_id IN", $queries[1] );
	}

	public function test_query_count_does_not_grow_with_the_number_of_blocks(): void {
		list( , $two_blocks ) = $this->render( $this->content( 2 ) );
		list( , $six_blocks ) = $this->render( $this->content( 6 ) );

		$this->assertSame( count( $two_blocks ), count( $six_blocks ), implode( "\n", $six_blocks ) );
	}

	public function test_output_is_identical_without_page_priming(): void {
		list( $primed ) = $this->render( $this->content( 6 ) );

		remove_filter( 'the_content', array( Block::class, 'prime_content_attachments' ), 8 );
		try {
			list( $unprimed ) = $this->render( $this->content( 6 ) );
		} finally {
			add_filter( 'the_content', array( Block::class, 'prime_content_attachments' ), 8 );
		}

		$this->assertSame( 6, substr_count( $primed, 'class="page-priming-test"' ) );
		$this->assertSame( $unprimed, $primed );
	}

	public function test_blocks_rendered_outside_the_content_still_prime_their_own_attachments(): void {
		foreach ( $this->attachment_ids as $id ) {
			clean_post_cache( $id );
		}

		$this->queries = array();
		$html          = do_blocks( $this->content( 3 ) );

		$this->assertSame( 3, substr_count( $html, 'class="page-priming-test"' ) );
		$this->assertStringContainsString( '"ID":' . $this->attachment_ids[0], html_entity_decode( $html ) );
	}

	public function test_content_without_blockstudio_blocks_is_not_parsed(): void {
		$parses = 0;
		$count  = static function ( $class ) use ( &$parses ) {
			++$parses;

			return $class;
		};
		add_filter( 'block_parser_class', $count );

		$content = Block::prime_content_attachments( '<!-- wp:paragraph --><p>Text</p><!-- /wp:paragraph -->' );
		remove_filter( 'block_parser_class', $count );

		$this->assertSame( 0, $parses );
		$this->assertSame( '<!-- wp:paragraph --><p>Text</p><!-- /wp:paragraph -->', $content );
	}

	public function test_attachments_already_in_the_cache_cost_no_query(): void {
		$content = $this->content( 4 );
		$this->render( $content );

		$this->queries = array();
		apply_filters( 'the_content', $content ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core WordPress filter.

		$this->assertSame( array(), $this->attachment_queries( $this->queries ) );
	}
}
