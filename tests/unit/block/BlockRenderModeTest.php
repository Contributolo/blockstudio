<?php

use Blockstudio\Block_Registry;
use Blockstudio\Block_Tags;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * bs_is_editor() and bs_is_preview() report the mode Block::render() hands templates.
 */
class BlockRenderModeTest extends TestCase {

	private string $name = 'render-mode-test/probe';
	private string $directory;
	private array $registry_state = array();
	private array $previous_get = array();

	protected function setUp(): void {
		parent::setUp();
		$this->previous_get = $_GET;
		unset( $_GET['blockstudioMode'] );

		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->directory = sys_get_temp_dir() . '/bs-render-mode-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );

		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'Probe',
					'blockstudio' => true,
				)
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="render-mode-test" data-modes="<?php echo esc_attr( wp_json_encode( array( 'isEditor' => $isEditor, 'isPreview' => $isPreview, 'bs_is_editor' => bs_is_editor(), 'bs_is_preview' => bs_is_preview() ) ) ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );
	}

	protected function tearDown(): void {
		$_GET = $this->previous_get;
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		foreach ( $this->registry_state as $name => $value ) {
			( new ReflectionProperty( Block_Registry::class, $name ) )->setValue( Block_Registry::instance(), $value );
		}
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	private function modes( string $html ): array {
		$tags = new WP_HTML_Tag_Processor( $html );

		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'render-mode-test' ) ), $html );

		return json_decode( (string) $tags->get_attribute( 'data-modes' ), true );
	}

	private function render(): array {
		return $this->modes( do_blocks( '<!-- wp:' . $this->name . ' /-->' ) );
	}

	public function test_false_by_default(): void {
		$this->assertFalse( bs_is_editor() );
		$this->assertFalse( bs_is_preview() );
		$this->assertSame(
			array(
				'isEditor'      => false,
				'isPreview'     => false,
				'bs_is_editor'  => false,
				'bs_is_preview' => false,
			),
			$this->render()
		);
	}

	public function test_editor_mode(): void {
		$_GET['blockstudioMode'] = 'editor';

		$this->assertTrue( bs_is_editor() );
		$this->assertFalse( bs_is_preview() );
		$this->assertSame(
			array(
				'isEditor'      => true,
				'isPreview'     => false,
				'bs_is_editor'  => true,
				'bs_is_preview' => false,
			),
			$this->render()
		);
	}

	public function test_preview_mode(): void {
		$_GET['blockstudioMode'] = 'preview';

		$this->assertFalse( bs_is_editor() );
		$this->assertTrue( bs_is_preview() );
		$this->assertSame(
			array(
				'isEditor'      => false,
				'isPreview'     => true,
				'bs_is_editor'  => false,
				'bs_is_preview' => true,
			),
			$this->render()
		);
	}

	public function test_unknown_mode_is_neither(): void {
		$_GET['blockstudioMode'] = 'frontend';

		$this->assertFalse( bs_is_editor() );
		$this->assertFalse( bs_is_preview() );
	}

	public function test_block_tags_render_frontend_inside_an_editor_request(): void {
		$_GET['blockstudioMode'] = 'editor';

		$this->assertSame(
			array(
				'isEditor'      => false,
				'isPreview'     => false,
				'bs_is_editor'  => false,
				'bs_is_preview' => false,
			),
			$this->modes( Block_Tags::render( '<block name="' . $this->name . '" />' ) )
		);
		$this->assertTrue( bs_is_editor() );
	}
}
