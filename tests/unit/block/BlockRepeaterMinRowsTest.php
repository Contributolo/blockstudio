<?php

use Blockstudio\Block_Registry;
use Blockstudio\Block_Tags;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * A repeater with min and no stored rows renders that many rows of field defaults.
 */
class BlockRepeaterMinRowsTest extends TestCase {

	private string $name = 'repeater-min-test/list';
	private string $directory;
	private array $registry_state = array();

	protected function setUp(): void {
		parent::setUp();
		$registry = Block_Registry::instance();
		foreach ( ( new ReflectionObject( $registry ) )->getProperties() as $property ) {
			if ( ! $property->isStatic() ) {
				$this->registry_state[ $property->getName() ] = $property->getValue( $registry );
			}
		}
		$this->directory = sys_get_temp_dir() . '/bs-repeater-min-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );

		file_put_contents(
			$this->directory . '/block/block.json',
			wp_json_encode(
				array(
					'name'        => $this->name,
					'title'       => 'List',
					'blockstudio' => array(
						'attributes' => array(
							array(
								'id'         => 'entries',
								'type'       => 'repeater',
								'min'        => 2,
								'attributes' => array(
									array(
										'id'      => 'name',
										'type'    => 'text',
										'default' => 'Default Name',
									),
									array(
										'id'      => 'enabled',
										'type'    => 'toggle',
										'default' => true,
									),
								),
							),
							array(
								'id'         => 'preset',
								'type'       => 'repeater',
								'min'        => 2,
								'default'    => array( array( 'name' => 'Preset' ) ),
								'attributes' => array(
									array(
										'id'   => 'name',
										'type' => 'text',
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
<div class="repeater-min-test" data-template="<?php echo esc_attr( wp_json_encode( $a ) ); ?>"></div>
PHP
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );
	}

	protected function tearDown(): void {
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		foreach ( $this->registry_state as $name => $value ) {
			( new ReflectionProperty( Block_Registry::class, $name ) )->setValue( Block_Registry::instance(), $value );
		}
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	private function render( array $values ): array {
		$html = do_blocks( '<!-- wp:' . $this->name . ' ' . wp_json_encode( array( 'blockstudio' => array( 'attributes' => $values ) ) ) . ' /-->' );
		return $this->template_values( $html );
	}

	private function template_values( string $html ): array {
		$tags = new WP_HTML_Tag_Processor( $html );

		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'repeater-min-test' ) ), $html );

		return json_decode( (string) $tags->get_attribute( 'data-template' ), true );
	}

	public function test_min_rows_are_filled_with_field_defaults(): void {
		$row = array(
			'name'    => 'Default Name',
			'enabled' => true,
		);

		$this->assertSame( array( $row, $row ), $this->render( array() )['entries'] );
	}

	public function test_stored_rows_and_defaults_win_over_min(): void {
		$this->assertSame( array( array( 'name' => 'Stored' ) ), $this->render( array( 'entries' => array( array( 'name' => 'Stored' ) ) ) )['entries'] );
		$this->assertSame( array( array( 'name' => 'Preset' ) ), $this->render( array() )['preset'] );
	}

	public function test_explicit_empty_values_do_not_recreate_removed_rows(): void {
		foreach ( array( array(), false, null ) as $empty ) {
			$this->assertSame( is_array( $empty ) ? false : $empty, $this->render( array( 'entries' => $empty ) )['entries'] );
		}
	}

	public function test_php_rendering_and_block_tags_initialize_min_rows(): void {
		ob_start();
		try {
			bs_render_block( $this->name );
			$html = ob_get_contents();
		} finally {
			ob_end_clean();
		}
		$this->assertCount( 2, $this->template_values( $html )['entries'] );
		$this->assertCount( 2, $this->template_values( Block_Tags::render( '<block name="' . $this->name . '" />' ) )['entries'] );
		$blocks = Block_Tags::parse_all_elements( '<block name="' . $this->name . '" />' );
		$this->assertCount( 2, $this->template_values( do_blocks( serialize_blocks( $blocks ) ) )['entries'] );
	}
}
