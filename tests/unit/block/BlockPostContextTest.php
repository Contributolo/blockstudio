<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * The post a template receives as `$post_id` and `$block['postId']`.
 *
 * WordPress passes the post to a block as `postId` block context: from the
 * global post when render_block() runs, and from each item in a Query Loop.
 * A render outside the main query, such as a REST request or WP-CLI, has no
 * queried object, so `$block['postId']` used to be 0 there.
 */
class BlockPostContextTest extends TestCase {

	private string $name = 'post-context-test/probe';
	private string $directory;
	private array $registry_state = array();
	private array $globals        = array();
	private array $posts          = array();

	protected function setUp(): void {
		parent::setUp();
		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->globals = array(
			'wp_query'     => $GLOBALS['wp_query'] ?? null,
			'wp_the_query' => $GLOBALS['wp_the_query'] ?? null,
			'post'         => $GLOBALS['post'] ?? null,
			'get'          => $_GET, // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		);

		$this->directory = sys_get_temp_dir() . '/bs-post-context-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'Post context probe',
					'blockstudio' => true,
				)
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="post-context-probe" data-post-id="<?php echo esc_attr( (string) $post_id ); ?>" data-block-post-id="<?php echo esc_attr( (string) $b['postId'] ); ?>" data-block-post-type="<?php echo esc_attr( (string) $b['postType'] ); ?>" data-context-post-id="<?php echo esc_attr( (string) ( $b['context']['postId'] ?? '' ) ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );

		$this->set_main_query( new WP_Query() );
		unset( $GLOBALS['post'], $_GET['postId'], $_GET['blockstudioMode'] );
	}

	protected function tearDown(): void {
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		foreach ( $this->registry_state as $name => $value ) {
			( new ReflectionProperty( Block_Registry::class, $name ) )->setValue( Block_Registry::instance(), $value );
		}
		Files::delete_all_files( $this->directory );
		foreach ( $this->posts as $post_id ) {
			wp_delete_post( $post_id, true );
		}
		$GLOBALS['wp_query']     = $this->globals['wp_query'];
		$GLOBALS['wp_the_query'] = $this->globals['wp_the_query'];
		$GLOBALS['post']         = $this->globals['post'];
		$_GET                    = $this->globals['get'];
		parent::tearDown();
	}

	private function create_post( string $type, string $title ): int {
		$id            = wp_insert_post(
			array(
				'post_type'   => $type,
				'post_status' => 'publish',
				'post_title'  => $title,
			)
		);
		$this->posts[] = $id;

		return $id;
	}

	private function set_main_query( WP_Query $query ): void {
		$GLOBALS['wp_query']     = $query;
		$GLOBALS['wp_the_query'] = $query;
	}

	/**
	 * Read the probe values of every rendered instance.
	 *
	 * @param string $html Rendered markup.
	 * @return array<int, array<string, string>>
	 */
	private function probes( string $html ): array {
		$tags   = new WP_HTML_Tag_Processor( $html );
		$probes = array();
		while ( $tags->next_tag( array( 'class_name' => 'post-context-probe' ) ) ) {
			$probes[] = array(
				'post_id'         => (string) $tags->get_attribute( 'data-post-id' ),
				'block_post_id'   => (string) $tags->get_attribute( 'data-block-post-id' ),
				'block_post_type' => (string) $tags->get_attribute( 'data-block-post-type' ),
				'context_post_id' => (string) $tags->get_attribute( 'data-context-post-id' ),
			);
		}
		$this->assertNotEmpty( $probes, 'probe block did not render: ' . $html );

		return $probes;
	}

	public function test_render_outside_the_main_query_uses_the_global_post(): void {
		$post_id         = $this->create_post( 'post', 'Global post' );
		$GLOBALS['post'] = get_post( $post_id );

		$probe = $this->probes( do_blocks( '<!-- wp:' . $this->name . ' /-->' ) )[0];

		$this->assertSame( (string) $post_id, $probe['context_post_id'] );
		$this->assertSame( (string) $post_id, $probe['post_id'] );
		$this->assertSame( (string) $post_id, $probe['block_post_id'] );
		$this->assertSame( 'post', $probe['block_post_type'] );
	}

	public function test_block_context_post_reaches_the_template_without_a_global_post(): void {
		$post_id = $this->create_post( 'post', 'Context post' );
		$parsed  = parse_blocks( '<!-- wp:' . $this->name . ' /-->' )[0];

		$html  = ( new WP_Block(
			$parsed,
			array(
				'postId'   => $post_id,
				'postType' => 'post',
			)
		) )->render();
		$probe = $this->probes( $html )[0];

		$this->assertSame( (string) $post_id, $probe['post_id'] );
		$this->assertSame( (string) $post_id, $probe['block_post_id'] );
		$this->assertSame( 'post', $probe['block_post_type'] );
	}

	public function test_query_loop_items_keep_the_queried_post_in_block_post_id(): void {
		$page  = $this->create_post( 'page', 'Listing page' );
		$first = $this->create_post( 'post', 'Loop item one' );
		$last  = $this->create_post( 'post', 'Loop item two' );
		$query = new WP_Query( array( 'page_id' => $page ) );
		$this->set_main_query( $query );
		$query->the_post();

		$html = do_blocks(
			'<!-- wp:query {"queryId":1,"query":{"perPage":2,"postType":"post","inherit":false,"include":[' . $first . ',' . $last . ']}} -->' .
			'<!-- wp:post-template --><!-- wp:' . $this->name . ' /--><!-- /wp:post-template -->' .
			'<!-- /wp:query -->'
		);

		$items = array();
		foreach ( $this->probes( $html ) as $probe ) {
			$this->assertSame( $probe['context_post_id'], $probe['post_id'] );
			$this->assertSame( (string) $page, $probe['block_post_id'] );
			$this->assertSame( 'page', $probe['block_post_type'] );
			$items[] = (int) $probe['context_post_id'];
		}
		sort( $items );
		$this->assertSame( array( $first, $last ), $items );
	}

	public function test_request_post_id_wins_over_block_context(): void {
		$requested       = $this->create_post( 'page', 'Edited page' );
		$context         = $this->create_post( 'post', 'Context post' );
		$GLOBALS['post'] = get_post( $context );
		$_GET['postId']  = (string) $requested;

		$probe = $this->probes( do_blocks( '<!-- wp:' . $this->name . ' /-->' ) )[0];

		$this->assertSame( (string) $context, $probe['context_post_id'] );
		$this->assertSame( (string) $requested, $probe['post_id'] );
		$this->assertSame( (string) $requested, $probe['block_post_id'] );
		$this->assertSame( 'page', $probe['block_post_type'] );
	}
}
