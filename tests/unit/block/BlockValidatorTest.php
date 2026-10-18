<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * Findings of bs_validate_block(), each checked against what the template
 * receives on render for the same stored value.
 */
class BlockValidatorTest extends TestCase {

	private string $name = 'validate-test/card';
	private string $directory;
	private array $extensions;
	private int $attachment;

	protected function setUp(): void {
		$this->extensions = Build::extensions();
		$this->directory  = sys_get_temp_dir() . '/bs-validate-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		wp_mkdir_p( $this->directory . '/extensions' );

		bs_register_field_type( 'validate-test/rating', array( 'attribute' => 'number' ) );
		$this->attachment = wp_insert_attachment(
			array(
				'post_title'     => 'Validate test',
				'post_mime_type' => 'image/png',
			)
		);
		add_filter( 'blockstudio/blocks/attributes/populate', array( $this, 'populate' ) );

		$this->write(
			'block/block.json',
			array(
				'name'        => $this->name,
				'title'       => 'Card',
				'blockstudio' => array(
					'attributes' => array(
						array( 'id' => 'title', 'type' => 'text' ),
						array( 'id' => 'subtitle', 'type' => 'text' ),
						array( 'id' => 'count', 'type' => 'number' ),
						array( 'id' => 'wide', 'type' => 'toggle' ),
						array( 'id' => 'size', 'type' => 'select', 'options' => $this->options( 'small', 'large' ) ),
						array( 'id' => 'mode', 'type' => 'radio', 'options' => array( 'a', 'b' ) ),
						array( 'id' => 'tags', 'type' => 'checkbox', 'options' => array( array( 'value' => 0, 'label' => 'Zero' ), array( 'value' => 1, 'label' => 'One' ) ) ),
						array( 'id' => 'langs', 'type' => 'select', 'multiple' => true, 'options' => $this->options( 'de', 'en' ) ),
						array( 'id' => 'cta', 'type' => 'link' ),
						array( 'id' => 'image', 'type' => 'files' ),
						array( 'id' => 'html', 'type' => 'attributes' ),
						array( 'id' => 'rating', 'type' => 'validate-test/rating' ),
						array(
							'id'       => 'source',
							'type'     => 'select',
							'populate' => array(
								'type'   => 'custom',
								'custom' => 'validateTest',
							),
						),
						array(
							'id'       => 'linked',
							'type'     => 'select',
							'populate' => array(
								'type'      => 'custom',
								'custom'    => 'validateTest',
								'arguments' => array( 'after' => '{attributes.title}' ),
							),
						),
						array( 'id' => 'note', 'type' => 'message', 'value' => 'Shown in the editor only.' ),
						array(
							'id'         => 'box',
							'type'       => 'group',
							'attributes' => array(
								array( 'id' => 'heading', 'type' => 'text' ),
								array(
									'id'         => 'inner',
									'type'       => 'group',
									'attributes' => array( array( 'id' => 'deep', 'type' => 'text' ) ),
								),
							),
						),
						array(
							'type'       => 'group',
							'attributes' => array( array( 'id' => 'plain', 'type' => 'text' ) ),
						),
						array(
							'type' => 'tabs',
							'tabs' => array(
								array(
									'title'      => 'More',
									'attributes' => array( array( 'id' => 'tabbed', 'type' => 'text' ) ),
								),
							),
						),
						array(
							'id'         => 'steps',
							'type'       => 'repeater',
							'attributes' => array(
								array( 'id' => 'label', 'type' => 'text' ),
								array( 'id' => 'style', 'type' => 'select', 'options' => $this->options( 'a', 'b' ) ),
								array(
									'id'         => 'row_group',
									'type'       => 'group',
									'attributes' => array( array( 'id' => 'inside', 'type' => 'text' ) ),
								),
							),
						),
						array(
							'id'         => 'pairs',
							'type'       => 'repeater',
							'attributes' => array(
								array( 'id' => 'style', 'type' => 'select', 'options' => $this->options( 'a', 'b' ) ),
								array( 'id' => 'style', 'type' => 'toggle' ),
							),
						),
					),
				),
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="validate-test" data-template="<?php echo esc_attr( wp_json_encode( $a ) ); ?>"></div>
PHP
		);
		$this->write(
			'extensions/card.json',
			array(
				'name'        => $this->name,
				'blockstudio' => array(
					'extend'     => true,
					'attributes' => array(
						array(
							'id'      => 'tone',
							'type'    => 'select',
							'options' => $this->options( 'warm' ),
							'set'     => array(
								array(
									'attribute' => 'data-tone',
									'value'     => '{attributes.tone}',
								),
							),
						),
						array( 'id' => 'subtitle', 'type' => 'select', 'options' => $this->options( 'Hello' ) ),
					),
				),
			)
		);
		$this->write(
			'extensions/paragraph.json',
			array(
				'name'        => 'core/paragraph',
				'blockstudio' => array(
					'extend'     => true,
					'attributes' => array(
						array( 'id' => 'level', 'type' => 'number' ),
					),
				),
			)
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );
	}

	protected function tearDown(): void {
		remove_all_filters( 'blockstudio/blocks/attributes/validate' );
		remove_filter( 'blockstudio/blocks/attributes/populate', array( $this, 'populate' ) );
		bs_unregister_field_type( 'validate-test/rating' );
		wp_delete_attachment( $this->attachment, true );
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		Block_Registry::instance()->remove_block( $this->name );
		// The registry has no API to remove an extension again.
		( new ReflectionProperty( Block_Registry::class, 'extensions' ) )->setValue( Block_Registry::instance(), $this->extensions );
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	public function populate( array $options ): array {
		$options['validateTest'] = array(
			array(
				'value' => 'p1',
				'label' => 'P1',
			),
			array(
				'value' => 'p2',
				'label' => 'P2',
			),
		);

		return $options;
	}

	private function write( string $file, array $json ): void {
		file_put_contents( $this->directory . '/' . $file, wp_json_encode( $json ) );
	}

	private function options( string ...$values ): array {
		return array_map(
			static fn( string $value ): array => array(
				'value' => $value,
				'label' => ucfirst( $value ),
			),
			$values
		);
	}

	private function attrs( array $values, array $extra = array() ): array {
		return array_merge( array( 'blockstudio' => array( 'attributes' => $values ) ), $extra );
	}

	/**
	 * Render the block with the given attrs and return what the template received.
	 */
	private function render( array $attrs ): array {
		return json_decode( (string) $this->root( $attrs )->get_attribute( 'data-template' ), true );
	}

	/**
	 * Render the block and return its root element.
	 */
	private function root( array $attrs ): WP_HTML_Tag_Processor {
		$html = do_blocks( '<!-- wp:' . $this->name . ' ' . wp_json_encode( $attrs ) . ' /-->' );
		$tags = new WP_HTML_Tag_Processor( $html );

		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'validate-test' ) ), $html );

		return $tags;
	}

	private function codes( ?array $findings ): array {
		$this->assertIsArray( $findings );

		return array_map( static fn( array $finding ): string => $finding['code'] . ' ' . $finding['path'], $findings );
	}

	public function test_returns_null_when_no_fields_apply(): void {
		register_block_type( 'validate-test/plain', array() );

		$this->assertNull( bs_validate_block( 'missing/block', array() ) );
		$this->assertNull( bs_validate_block( 'validate-test/plain', array( 'blockstudio' => array( 'attributes' => array( 'x' => 1 ) ) ) ) );

		unregister_block_type( 'validate-test/plain' );
	}

	public function test_valid_values_have_no_findings(): void {
		$values = array(
			'title'      => 'Hello',
			'count'      => 3,
			'wide'       => true,
			'size'       => array(
				'value' => 'large',
				'label' => 'Large',
			),
			'mode'       => 'b',
			'tags'       => array( array( 'value' => 0 ), array( 'value' => 1 ) ),
			'langs'      => array( array( 'value' => 'de' ) ),
			'cta'        => array( 'url' => '/contact' ),
			'image'      => $this->attachment,
			'html'       => array(
				array(
					'attribute' => 'data-x',
					'value'     => '1',
				),
			),
			'image__size' => 'large',
			'box_heading' => 'Box',
			'plain'      => 'Plain',
			'tabbed'     => 'Tabbed',
			'tone'       => 'warm',
			'steps'      => array(
				array(
					'label' => 'One',
					'style' => 'a',
				),
			),
		);

		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( $values ) ) );

		$a = $this->render( $this->attrs( $values ) );
		$this->assertSame( 'Hello', $a['title'] );
		$this->assertSame( 'large', $a['size'] );
		$this->assertSame( array( 0, 1 ), $a['tags'] );
		$this->assertSame( 'Box', $a['box_heading'] );
		$this->assertSame( 'Tabbed', $a['tabbed'] );
	}

	public function test_normalised_and_empty_values_are_valid(): void {
		$values = array(
			'count' => '2.5',
			'langs' => 'en',
			'tags'  => array(
				'value' => 1,
				'label' => 'One',
			),
			'size'  => '',
			'title' => array(),
			'wide'  => false,
			'cta'   => null,
		);

		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( $values ) ) );

		$a = $this->render( $this->attrs( $values ) );
		$this->assertSame( 2.5, $a['count'] );
		$this->assertSame( array( 'en' ), $a['langs'] );
		$this->assertSame( array( 1 ), $a['tags'] );
		$this->assertFalse( $a['size'] );
		$this->assertFalse( $a['title'] );
	}

	public function test_invalid_container(): void {
		$this->assertSame( array( 'invalid_container blockstudio' ), $this->codes( bs_validate_block( $this->name, array( 'blockstudio' => 'x' ) ) ) );
		$this->assertSame(
			array( 'invalid_container blockstudio/attributes', 'invalid_container blockstudio/disabled' ),
			$this->codes(
				bs_validate_block(
					$this->name,
					array(
						'blockstudio' => array(
							'attributes' => 'x',
							'disabled'   => 'title',
						),
					)
				)
			)
		);
	}

	public function test_unknown_fields(): void {
		$values = array(
			'data-x'          => 'forwarded',
			'aria-label'      => 'forwarded',
			'key'             => 'bookkeeping',
			'typo'            => 'x',
			'note'            => 'x',
			'box_inner_deep'  => 'x',
			'deep'            => 'x',
			'title__size'     => 'x',
			'steps'           => array(
				array(
					'label'            => 'One',
					'oops'             => 'x',
					'row_group_inside' => 'x',
				),
			),
		);

		$this->assertSame(
			array(
				'unknown_field typo',
				'unknown_field note',
				'unknown_field box_inner_deep',
				'unknown_field deep',
				'unknown_field title__size',
				'unknown_field steps/0/oops',
				'unknown_field steps/0/row_group_inside',
			),
			$this->codes( bs_validate_block( $this->name, $this->attrs( $values ) ) )
		);

		$this->assertSame( 'forwarded', $this->root( $this->attrs( $values ) )->get_attribute( 'data-x' ) );

		$a = $this->render( $this->attrs( $values ) );
		foreach ( array( 'typo', 'note', 'box_inner_deep', 'deep' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $a );
		}
		// Every "__size" key and unknown keys in rows reach the template, but no field reads them.
		$this->assertSame( 'x', $a['title__size'] );
		$this->assertSame( 'x', $a['steps'][0]['oops'] );
	}

	public function test_unknown_options_render_as_false_or_are_dropped(): void {
		$values = array(
			'size'  => 'huge',
			'mode'  => 'c',
			'tags'  => array( array( 'value' => 1 ), array( 'value' => 7 ) ),
			'langs' => 'fr',
			'steps' => array(
				array( 'style' => 'z' ),
			),
		);
		$findings = bs_validate_block( $this->name, $this->attrs( $values ) );

		$this->assertSame(
			array(
				'unknown_option size',
				'unknown_option mode',
				'unknown_option tags/1',
				'unknown_option langs',
				'unknown_option steps/0/style',
			),
			$this->codes( $findings )
		);
		$this->assertSame( array( 'small', 'large' ), $findings[0]['expected'] );
		$this->assertSame( 'block', $findings[0]['source'] );
		$this->assertSame( array( 'value' => 7 ), $findings[2]['value'] );

		$a = $this->render( $this->attrs( $values ) );
		$this->assertFalse( $a['size'] );
		$this->assertFalse( $a['mode'] );
		$this->assertSame( array( 1 ), $a['tags'] );
		$this->assertFalse( $a['langs'] );
		$this->assertFalse( $a['steps'][0]['style'] );
	}

	public function test_populated_options(): void {
		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( array( 'source' => 'p2' ) ) ) );
		$this->assertSame( 'p2', $this->render( $this->attrs( array( 'source' => 'p2' ) ) )['source'] );

		$findings = bs_validate_block( $this->name, $this->attrs( array( 'source' => 'nope' ) ) );
		$this->assertSame( array( 'unknown_option source' ), $this->codes( $findings ) );
		$this->assertSame( array( 'p1', 'p2' ), $findings[0]['expected'] );
		$this->assertFalse( $this->render( $this->attrs( array( 'source' => 'nope' ) ) )['source'] );

		// The build does not resolve options whose arguments read another field, and the renderer has no other source.
		$this->assertSame( array( 'unknown_option linked' ), $this->codes( bs_validate_block( $this->name, $this->attrs( array( 'linked' => 'p1' ) ) ) ) );
		$this->assertFalse( $this->render( $this->attrs( array( 'linked' => 'p1' ) ) )['linked'] );
	}

	public function test_custom_field_types_use_their_declared_attribute_type(): void {
		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( array( 'rating' => 4 ) ) ) );

		$findings = bs_validate_block( $this->name, $this->attrs( array( 'rating' => 'many' ) ) );
		$this->assertSame( array( 'wrong_type rating' ), $this->codes( $findings ) );
		$this->assertSame( 'number', $findings[0]['expected'] );
	}

	public function test_wrong_types(): void {
		$values = array(
			'title' => array( 'Hello' ),
			'count' => 'many',
			'wide'  => 'true',
			'size'  => array( 'large' ),
			'langs' => true,
			'cta'   => '/contact',
			'image' => array( array( 'id' => 12 ) ),
			'html'  => array(
				'data-x',
				array(
					'attribute' => 'data-y',
					'value'     => array( 'a' ),
				),
			),
			'steps' => array( 'row' ),
		);

		$this->assertSame(
			array(
				'wrong_type title',
				'wrong_type count',
				'wrong_type wide',
				'wrong_type size',
				'wrong_type langs',
				'wrong_type cta',
				'wrong_type image/0',
				'wrong_type html/0',
				'wrong_type html/1',
				'wrong_type steps/0',
			),
			$this->codes( bs_validate_block( $this->name, $this->attrs( $values ) ) )
		);

		$a = $this->render( $this->attrs( array( 'count' => 'many', 'wide' => 'true' ) ) );
		// The renderer reads both without complaint: a count of 0 and a string where the template expects a boolean.
		$this->assertEquals( 0, $a['count'] );
		$this->assertSame( 'true', $a['wide'] );
	}

	public function test_conflicting_row_definitions(): void {
		$findings = bs_validate_block( $this->name, $this->attrs( array( 'pairs' => array( array( 'style' => 'a' ) ) ) ) );

		// Two row fields use the ID "style"; only the first is read, so "a" is valid.
		$this->assertSame( array( 'definition_conflict pairs/*/style' ), $this->codes( $findings ) );
		$this->assertSame( array( 'select', 'toggle' ), $findings[0]['expected'] );
		$this->assertSame( 'a', $this->render( $this->attrs( array( 'pairs' => array( array( 'style' => 'a' ) ) ) ) )['pairs'][0]['style'] );
	}

	public function test_block_and_extension_definitions(): void {
		$findings = bs_validate_block( $this->name, $this->attrs( array( 'subtitle' => 'Hi' ) ) );

		// The template reads "subtitle" as text, the extension renderer as a select with the option "Hello".
		$this->assertSame( array( 'definition_conflict subtitle', 'unknown_option subtitle' ), $this->codes( $findings ) );
		$this->assertSame( 'extension', $findings[1]['source'] );
		$this->assertSame( array( 'block' => 'text', 'extension' => 'select' ), $findings[0]['expected'] );
		$this->assertSame( 'Hi', $this->render( $this->attrs( array( 'subtitle' => 'Hi' ) ) )['subtitle'] );

		$this->assertSame( array( 'unknown_option tone' ), $this->codes( bs_validate_block( $this->name, $this->attrs( array( 'tone' => 'cold' ) ) ) ) );
	}

	public function test_extension_fields_on_a_core_block(): void {
		$this->assertSame( array(), bs_validate_block( 'core/paragraph', $this->attrs( array( 'level' => 2 ) ) ) );
		$this->assertSame(
			array( 'wrong_type level', 'unknown_field other' ),
			$this->codes(
				bs_validate_block(
					'core/paragraph',
					$this->attrs(
						array(
							'level' => 'two',
							'other' => 'x',
						)
					)
				)
			)
		);
		// WordPress' own attributes are not field values.
		$this->assertSame( array(), bs_validate_block( 'core/paragraph', array( 'content' => 'x', 'level' => 'two' ) ) );
	}

	public function test_top_level_values(): void {
		$attrs = $this->attrs(
			array( 'size' => 'small' ),
			array(
				'size'  => 'large',
				'mode'  => 'b',
				'title' => 'Top',
				'tone'  => 'warm',
			)
		);
		$findings = bs_validate_block( $this->name, $attrs );

		// A radio attribute is registered as an object, so WordPress drops the plain "b" before render.
		$this->assertSame( array( 'shadowed_value size', 'wrong_type mode', 'extension_top_level tone' ), $this->codes( $findings ) );
		$this->assertSame( 'object', $findings[1]['expected'] );

		$a = $this->render( $attrs );
		$this->assertSame( 'small', $a['size'] );
		$this->assertFalse( $a['mode'] );
		$this->assertSame( 'Top', $a['title'] );
		$this->assertSame( 'warm', $a['tone'] );
		// The extension's set binding sees the value only in blockstudio.attributes.
		$this->assertNull( $this->root( $attrs )->get_attribute( 'data-tone' ) );
		$this->assertSame( 'warm', $this->root( $this->attrs( array( 'tone' => 'warm' ) ) )->get_attribute( 'data-tone' ) );

		// Empty and disabled top-level values end as false either way.
		$empty = array(
			'count'       => '',
			'wide'        => null,
			'size'        => 'huge',
			'tone'        => '',
			'blockstudio' => array( 'disabled' => array( 'size' ) ),
		);
		$this->assertSame( array(), bs_validate_block( $this->name, $empty ) );
		$a = $this->render( $empty );
		$this->assertFalse( $a['count'] );
		$this->assertFalse( $a['size'] );
	}

	public function test_files(): void {
		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( array( 'image' => array( 'id' => $this->attachment ) ) ) ) );
		$this->assertSame( $this->attachment, $this->render( $this->attrs( array( 'image' => array( 'id' => $this->attachment ) ) ) )['image'][0]['ID'] );

		$missing = $this->attachment + 1000;
		$this->assertSame( array( 'unknown_attachment image' ), $this->codes( bs_validate_block( $this->name, $this->attrs( array( 'image' => $missing ) ) ) ) );
		$this->assertFalse( $this->render( $this->attrs( array( 'image' => $missing ) ) )['image'] );

		$disabled = array(
			'blockstudio' => array(
				'attributes' => array( 'image' => array( $this->attachment, $missing ) ),
				'disabled'   => array( 'image_' . $missing ),
			),
		);
		$this->assertSame( array(), bs_validate_block( $this->name, $disabled ) );
		$this->assertSame( array( $this->attachment ), array_column( $this->render( $disabled )['image'], 'ID' ) );

		// "0" is not an attachment; the renderer passes it through unresolved.
		$this->assertSame( array( 'unknown_attachment image' ), $this->codes( bs_validate_block( $this->name, $this->attrs( array( 'image' => '0' ) ) ) ) );
		$this->assertSame( '0', $this->render( $this->attrs( array( 'image' => '0' ) ) )['image'] );
	}

	public function test_disabled_fields_are_not_checked(): void {
		$attrs = array(
			'blockstudio' => array(
				'attributes' => array( 'size' => 'huge' ),
				'disabled'   => array( 'size' ),
			),
		);

		$this->assertSame( array(), bs_validate_block( $this->name, $attrs ) );
		$this->assertFalse( $this->render( $attrs )['size'] );
	}

	public function test_filter(): void {
		add_filter(
			'blockstudio/blocks/attributes/validate',
			function ( array $findings, string $name, array $attrs ): array {
				$this->assertSame( $this->name, $name );
				$this->assertSame( 'huge', $attrs['blockstudio']['attributes']['size'] );

				return array();
			},
			10,
			3
		);

		$this->assertSame( array(), bs_validate_block( $this->name, $this->attrs( array( 'size' => 'huge' ) ) ) );
	}
}
