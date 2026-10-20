<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * The editor sends the edited post as `postId`. Templates rendered through the
 * REST endpoints should see it as the global post, as they do on the edit
 * screen, so get_the_ID(), get_the_title() and get_the_author() work.
 */
class BlockRenderPostTest extends TestCase {

	private string $name = 'render-post-test/probe';
	private string $directory;
	private array $registry_state = array();
	private array $globals        = array();
	private array $posts          = array();
	private array $users          = array();

	protected function setUp(): void {
		parent::setUp();
		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->globals = array(
			'post'       => $GLOBALS['post'] ?? null,
			'authordata' => $GLOBALS['authordata'] ?? null,
			'id'         => $GLOBALS['id'] ?? null,
			'get'        => $_GET, // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			'user'       => get_current_user_id(),
		);

		$this->directory = sys_get_temp_dir() . '/bs-render-post-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'Render post probe',
					'blockstudio' => true,
				)
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="render-post-probe" data-the-id="<?php echo esc_attr( (string) get_the_ID() ); ?>" data-title="<?php echo esc_attr( get_the_title() ); ?>" data-author="<?php echo esc_attr( get_the_author() ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );

		unset( $GLOBALS['post'], $GLOBALS['authordata'], $GLOBALS['id'] );
		wp_set_current_user( 1 );
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
		if ( $this->users ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';
			foreach ( $this->users as $user_id ) {
				wp_delete_user( $user_id );
			}
		}
		$GLOBALS['post']       = $this->globals['post'];
		$GLOBALS['authordata'] = $this->globals['authordata'];
		$GLOBALS['id']         = $this->globals['id'];
		$_GET                  = $this->globals['get'];
		wp_set_current_user( $this->globals['user'] );
		parent::tearDown();
	}

	private function create_post(): int {
		$id            = wp_insert_post(
			array(
				'post_type'   => 'post',
				'post_status' => 'publish',
				'post_title'  => 'Edited post',
				'post_author' => 1,
			)
		);
		$this->posts[] = $id;

		return $id;
	}

	private function post_params( int $post_id ): array {
		return array(
			'blockstudioMode' => 'editor',
			'postId'          => (string) $post_id,
			'contextPostId'   => (string) $post_id,
			'contextPostType' => 'post',
		);
	}

	/**
	 * Read the probe values from rendered markup.
	 *
	 * @param string $html Rendered markup.
	 * @return array<string, string>
	 */
	private function probe( string $html ): array {
		$tags = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'render-post-probe' ) ), 'probe block did not render: ' . $html );

		return array(
			'id'     => (string) $tags->get_attribute( 'data-the-id' ),
			'title'  => (string) $tags->get_attribute( 'data-title' ),
			'author' => (string) $tags->get_attribute( 'data-author' ),
		);
	}

	private function render_all( int $post_id ): array {
		$request = new WP_REST_Request( 'POST', '/blockstudio/v1/gutenberg/block/render/all' );
		$request->set_body_params(
			array(
				'data' => array(
					'editor:probe' => array(
						'clientId'   => 'editor:probe',
						'attributes' => array(),
						'context'    => array(),
						'name'       => $this->name,
						'post'       => $this->post_params( $post_id ),
					),
				),
			)
		);
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );

		return $this->probe( $response->get_data()['editor:probe'] );
	}

	public function test_single_render_sets_up_the_requested_post(): void {
		$post_id = $this->create_post();
		$params  = $this->post_params( $post_id );
		$_GET    = $params;

		$request = new WP_REST_Request( 'POST', '/blockstudio/v1/gutenberg/block/render/' . $this->name );
		$request->set_query_params( $params );
		$request->set_body_params(
			array(
				'attributes' => array(),
				'context'    => array(),
			)
		);
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );

		$probe = $this->probe( $response->get_data()['rendered'] );
		$this->assertSame( (string) $post_id, $probe['id'] );
		$this->assertSame( 'Edited post', $probe['title'] );
		$this->assertSame( get_userdata( 1 )->display_name, $probe['author'] );
	}

	public function test_batch_render_sets_up_the_requested_post(): void {
		$post_id = $this->create_post();

		$probe = $this->render_all( $post_id );

		$this->assertSame( (string) $post_id, $probe['id'] );
		$this->assertSame( 'Edited post', $probe['title'] );
		$this->assertSame( get_userdata( 1 )->display_name, $probe['author'] );
	}

	public function test_batch_render_skips_a_post_the_user_cannot_edit(): void {
		$post_id       = $this->create_post();
		$contributor   = wp_insert_user(
			array(
				'user_login' => 'render-post-contributor-' . uniqid(),
				'user_pass'  => wp_generate_password(),
				'role'       => 'contributor',
			)
		);
		$this->users[] = $contributor;
		wp_set_current_user( $contributor );

		$probe = $this->render_all( $post_id );

		$this->assertSame( '', $probe['id'] );
		$this->assertSame( '', $probe['title'] );
	}
}
