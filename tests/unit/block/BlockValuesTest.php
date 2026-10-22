<?php
/**
 * Stored block values as the template receives them.
 *
 * @package Blockstudio
 */

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

class BlockValuesTest extends TestCase {

	private const NAME = 'values-test/card';
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
		$GLOBALS['blockstudio_values_templates_run'] = 0;
		$this->directory                             = sys_get_temp_dir() . '/bs-values-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		wp_mkdir_p( $this->directory . '/extensions' );
		$this->write(
			'block/block.json',
			array(
				'name'        => self::NAME,
				'title'       => 'Values',
				'blockstudio' => array( 'attributes' => $this->fields() ),
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			'<?php ++$GLOBALS["blockstudio_values_templates_run"]; ?><div class="values-result" data-values="<?php echo esc_attr( wp_json_encode( $a ) ); ?>"></div>'
		);
		$this->write(
			'extensions/card.json',
			array(
				'name'        => array( self::NAME, 'values-test/foreign' ),
				'blockstudio' => array(
					'extend'     => true,
					'attributes' => array(
						array( 'id' => 'extra', 'type' => 'text', 'default' => 'extension default' ),
						array( 'id' => 'tone', 'type' => 'select', 'returnFormat' => 'label', 'options' => array( array( 'value' => 'warm', 'label' => 'Warm' ), array( 'value' => 'cool', 'label' => 'Cool' ) ) ),
					),
				),
			)
		);
		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ self::NAME ] );
	}

	protected function tearDown(): void {
		unregister_block_type( self::NAME );
		foreach ( $this->registry_state as $name => $value ) {
			( new ReflectionProperty( Block_Registry::class, $name ) )->setValue( Block_Registry::instance(), $value );
		}
		Files::delete_all_files( $this->directory );
		unset( $GLOBALS['blockstudio_values_templates_run'] );
		parent::tearDown();
	}

	private function write( string $path, array $data ): void {
		file_put_contents( $this->directory . '/' . $path, wp_json_encode( $data ) );
	}

	private function fields(): array {
		$options = array( array( 'value' => 'a', 'label' => 'Alpha' ), array( 'value' => 'b', 'label' => 'Beta' ) );

		return array(
			array( 'id' => 'title', 'type' => 'text', 'default' => 'Untitled' ),
			array( 'id' => 'subtitle', 'type' => 'text' ),
			array( 'id' => 'featured', 'type' => 'toggle', 'default' => true ),
			array( 'id' => 'count', 'type' => 'number' ),
			array( 'id' => 'variant', 'type' => 'select', 'options' => $options ),
			array( 'id' => 'variantLabel', 'type' => 'select', 'returnFormat' => 'label', 'options' => $options ),
			array( 'id' => 'variantBoth', 'type' => 'select', 'returnFormat' => 'both', 'options' => $options ),
			array(
				'id'         => 'rows',
				'type'       => 'repeater',
				'attributes' => array(
					array( 'id' => 'heading', 'type' => 'text' ),
					array( 'id' => 'kind', 'type' => 'select', 'returnFormat' => 'label', 'options' => $options ),
					array( 'id' => 'weight', 'type' => 'number' ),
				),
			),
			array(
				'id'         => 'seed',
				'type'       => 'repeater',
				'min'        => 2,
				'attributes' => array( array( 'id' => 'label', 'type' => 'text', 'default' => 'row' ) ),
			),
		);
	}

	private function nested( array $values, array $disabled = array() ): array {
		return array( 'blockstudio' => array( 'attributes' => $values, 'disabled' => $disabled ) );
	}

	private function rendered( array $attrs ): array {
		$html = do_blocks( '<!-- wp:' . self::NAME . ' ' . wp_json_encode( (object) $attrs ) . ' /-->' );
		$tags = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'values-result' ) ), $html );
		return json_decode( $tags->get_attribute( 'data-values' ), true );
	}

	private function json( array $values ): array {
		return json_decode( wp_json_encode( $values ), true );
	}

	public function test_unmanaged_blocks_return_null(): void {
		$this->assertNull( bs_block_values( 'missing/block', array() ) );
		$this->assertNull( bs_block_values( 'values-test/unmanaged', $this->nested( array( 'title' => 'x' ) ) ) );
	}

	public function test_defaults_apply_when_nothing_is_stored(): void {
		$values = bs_block_values( self::NAME, array() );

		$this->assertSame( 'Untitled', $values['title'] );
		$this->assertTrue( $values['featured'] );
		$this->assertFalse( $values['subtitle'] );
		$this->assertFalse( $values['rows'] );
		$this->assertCount( 2, $values['seed'] );
		$this->assertSame( 'row', $values['seed'][0]['label'] );
		$this->assertArrayNotHasKey( 'blockstudio', $values );
		$this->assertSame( 0, $GLOBALS['blockstudio_values_templates_run'] );
	}

	public function test_nested_values_win_over_top_level_ones(): void {
		$attrs  = $this->nested( array( 'title' => 'nested' ) ) + array(
			'title'    => 'top level',
			'subtitle' => 'only top level',
		);
		$values = bs_block_values( self::NAME, $attrs );

		$this->assertSame( 'nested', $values['title'] );
		$this->assertSame( 'only top level', $values['subtitle'] );
	}

	public function test_top_level_values_failing_the_registered_type_are_dropped(): void {
		$values = bs_block_values( self::NAME, array( 'variantLabel' => 'b', 'subtitle' => 'kept' ) );

		$this->assertFalse( $values['variantLabel'] );
		$this->assertSame( 'kept', $values['subtitle'] );
	}

	public function test_undeclared_top_level_keys_are_not_adopted(): void {
		$values = bs_block_values( self::NAME, array( 'className' => 'is-wide', 'anchor' => 'x', 'lock' => array( 'move' => true ) ) );

		$this->assertSame( array(), array_diff( array_keys( $values ), array_column( $this->fields(), 'id' ), array( 'tone', 'extra' ) ) );
	}

	public function test_select_return_formats_are_applied(): void {
		$values = bs_block_values( self::NAME, $this->nested( array( 'variant' => 'a', 'variantLabel' => 'b', 'variantBoth' => 'a' ) ) );

		$this->assertSame( 'a', $values['variant'] );
		$this->assertSame( 'Beta', $values['variantLabel'] );
		$this->assertSame( array( 'value' => 'a', 'label' => 'Alpha' ), $values['variantBoth'] );
	}

	public function test_repeater_rows_are_transformed(): void {
		$rows   = array(
			array( 'heading' => 'One', 'kind' => 'a', 'weight' => '2.5' ),
			array( 'heading' => 'Two', 'kind' => 'b' ),
		);
		$values = bs_block_values( self::NAME, $this->nested( array( 'rows' => $rows ) ) );

		$this->assertSame( 'Alpha', $values['rows'][0]['kind'] );
		$this->assertSame( 2.5, $values['rows'][0]['weight'] );
		$this->assertSame( 'Beta', $values['rows'][1]['kind'] );
		$this->assertSame( 'Two', $values['rows'][1]['heading'] );
	}

	public function test_disabled_fields_are_false(): void {
		$values = bs_block_values( self::NAME, $this->nested( array( 'title' => 'hidden', 'subtitle' => 'shown' ), array( 'title' ) ) );

		$this->assertFalse( $values['title'] );
		$this->assertSame( 'shown', $values['subtitle'] );
	}

	public function test_extension_fields_of_a_blockstudio_block_are_included(): void {
		$values = bs_block_values( self::NAME, $this->nested( array( 'tone' => 'cool' ) ) );

		$this->assertSame( 'Cool', $values['tone'] );
		$this->assertSame( 'extension default', $values['extra'] );
	}

	public function test_extended_foreign_block_reads_only_the_nested_object(): void {
		$attrs  = $this->nested( array( 'tone' => 'warm' ) ) + array( 'extra' => 'top level', 'className' => 'is-wide' );
		$values = bs_block_values( 'values-test/foreign', $attrs );

		$this->assertSame( array( 'extra' => 'extension default', 'tone' => 'Warm' ), $values );
	}

	public function test_malformed_blockstudio_containers_fall_back_to_defaults(): void {
		$this->assertSame( 'Untitled', bs_block_values( self::NAME, array( 'blockstudio' => 'broken' ) )['title'] );
		$this->assertSame( 'Untitled', bs_block_values( self::NAME, array( 'blockstudio' => array( 'attributes' => 'broken', 'disabled' => 'broken' ) ) )['title'] );
	}

	public function test_values_match_what_the_template_receives(): void {
		$cases = array(
			'empty'    => array(),
			'nested'   => $this->nested(
				array(
					'title'      => 'Hello',
					'variant'    => 'b',
					'variantLabel' => 'a',
					'variantBoth' => 'b',
					'count'      => '3',
					'rows'       => array( array( 'heading' => 'One', 'kind' => 'a', 'weight' => '1' ) ),
					'tone'       => 'warm',
				),
				array( 'subtitle' )
			),
			'toplevel' => array( 'title' => 'Top', 'variantLabel' => 'b', 'seed' => array( array( 'label' => 'x' ) ) ),
			'both'     => $this->nested( array( 'title' => 'Nested' ) ) + array( 'title' => 'Top', 'subtitle' => 'Only top' ),
		);

		foreach ( $cases as $label => $attrs ) {
			$this->assertEquals( $this->rendered( $attrs ), $this->json( bs_block_values( self::NAME, $attrs ) ), $label );
		}
	}
}
