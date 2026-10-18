<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * A repeater with min and no stored rows renders that many rows of field defaults.
 */
class BlockRepeaterMinRowsTest extends TestCase {

	private string $name = 'repeater-min-test/list';
	private string $directory;

	protected function setUp(): void {
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
		Block_Registry::instance()->remove_block( $this->name );
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	private function render( array $values ): array {
		$html = do_blocks( '<!-- wp:' . $this->name . ' ' . wp_json_encode( array( 'blockstudio' => array( 'attributes' => $values ) ) ) . ' /-->' );
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
}
