<?php

use Blockstudio\Attribute_Builder;
use Blockstudio\Block;
use Blockstudio\Field_Registry;
use Blockstudio\Field_Type_Registry;
use Blockstudio\Populate;
use PHPUnit\Framework\TestCase;

class BlockDynamicSelectTest extends TestCase {

	private array $post_ids = array();

	protected function setUp(): void {
		Field_Registry::instance()->reset();
		Field_Type_Registry::instance()->reset();
	}

	protected function tearDown(): void {
		foreach ( $this->post_ids as $post_id ) {
			wp_delete_post( $post_id, true );
		}

		$this->post_ids = array();
	}

	private function dynamic_function_populate(): array {
		return array(
			'type'      => 'function',
			'function'  => 'lab_items',
			'arguments' => array( '{attributes.kind}' ),
		);
	}

	private function render_field( array $field, mixed $stored ): mixed {
		$field = array_merge( array( 'id' => 'items' ), $field );
		$built = ( new Attribute_Builder() )->build( array( $field ) );

		$attributes      = array( 'items' => $stored );
		$attribute_names = array();
		$attribute_data  = array();

		Block::transform_attributes(
			$attributes,
			$attribute_names,
			array(),
			'test/dynamic-select',
			array( 'name' => 'test/dynamic-select' ),
			false,
			$built,
			$attribute_data
		);

		return $attributes['items'];
	}

	private function insert_post( string $title ): int {
		$post_id = wp_insert_post(
			array(
				'post_title'  => $title,
				'post_status' => 'publish',
			)
		);

		$this->post_ids[] = $post_id;

		return $post_id;
	}

	// registered definition

	public function test_registered_definition_of_a_dynamic_select_has_no_options(): void {
		$built = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'       => 'items',
					'type'     => 'select',
					'populate' => $this->dynamic_function_populate(),
				),
			)
		);

		$this->assertSame( array(), $built['items']['options'] );
		$this->assertArrayNotHasKey( 'optionsPopulate', $built['items'] );
	}

	// single select

	public function test_single_select_keeps_the_stored_value(): void {
		$this->assertSame(
			'a',
			$this->render_field(
				array(
					'type'     => 'select',
					'populate' => $this->dynamic_function_populate(),
				),
				array(
					'value' => 'a',
					'label' => 'Item A (post)',
				)
			)
		);
	}

	public static function return_format_provider(): array {
		$item = array(
			'value' => 'a',
			'label' => 'Item A (post)',
		);

		return array(
			'value' => array( 'value', 'a', array( 'a', 'b' ) ),
			'label' => array( 'label', 'Item A (post)', array( 'Item A (post)', 'Item B (post)' ) ),
			'both'  => array(
				'both',
				$item,
				array(
					$item,
					array(
						'value' => 'b',
						'label' => 'Item B (post)',
					),
				),
			),
		);
	}

	#[\PHPUnit\Framework\Attributes\DataProvider( 'return_format_provider' )]
	public function test_single_select_applies_every_return_format( string $format, mixed $expected ): void {
		$this->assertSame(
			$expected,
			$this->render_field(
				array(
					'type'         => 'select',
					'returnFormat' => $format,
					'populate'     => $this->dynamic_function_populate(),
				),
				array(
					'value' => 'a',
					'label' => 'Item A (post)',
				)
			)
		);
	}

	// multiple select

	#[\PHPUnit\Framework\Attributes\DataProvider( 'return_format_provider' )]
	public function test_multiple_select_applies_every_return_format( string $format, mixed $first, array $expected ): void {
		$this->assertSame(
			$expected,
			$this->render_field(
				array(
					'type'         => 'select',
					'multiple'     => true,
					'returnFormat' => $format,
					'populate'     => $this->dynamic_function_populate(),
				),
				array(
					array(
						'value' => 'a',
						'label' => 'Item A (post)',
					),
					array(
						'value' => 'b',
						'label' => 'Item B (post)',
					),
				)
			)
		);
	}

	public function test_multiple_select_keeps_the_stored_order(): void {
		$this->assertSame(
			array( 'b', 'a' ),
			$this->render_field(
				array(
					'type'     => 'select',
					'multiple' => true,
					'populate' => $this->dynamic_function_populate(),
				),
				array(
					array(
						'value' => 'b',
						'label' => 'Item B (post)',
					),
					array(
						'value' => 'a',
						'label' => 'Item A (post)',
					),
				)
			)
		);
	}

	public function test_multiple_select_reads_a_single_option_as_a_list(): void {
		$this->assertSame(
			array( 'a' ),
			$this->render_field(
				array(
					'type'     => 'select',
					'multiple' => true,
					'populate' => $this->dynamic_function_populate(),
				),
				array(
					'value' => 'a',
					'label' => 'Item A (post)',
				)
			)
		);
	}

	public function test_dynamic_select_reads_plain_values_as_their_own_label(): void {
		$field = array(
			'type'         => 'select',
			'returnFormat' => 'both',
			'populate'     => $this->dynamic_function_populate(),
		);

		$this->assertSame(
			array(
				'value' => 'a',
				'label' => 'a',
			),
			$this->render_field( $field, 'a' )
		);
		$this->assertSame(
			array(
				array(
					'value' => 'a',
					'label' => 'a',
				),
				array(
					'value' => 'b',
					'label' => 'b',
				),
			),
			$this->render_field( array_merge( $field, array( 'multiple' => true ) ), array( 'a', 'b' ) )
		);
	}

	public function test_dynamic_select_keeps_numeric_values(): void {
		$this->assertSame(
			array( 7, 9 ),
			$this->render_field(
				array(
					'type'     => 'select',
					'multiple' => true,
					'populate' => $this->dynamic_function_populate(),
				),
				array(
					array(
						'value' => 7,
						'label' => 'Seven',
					),
					array(
						'value' => 9,
						'label' => 'Nine',
					),
				)
			)
		);
	}

	public function test_empty_multiple_dynamic_select_stays_false(): void {
		$this->assertFalse(
			$this->render_field(
				array(
					'type'     => 'select',
					'multiple' => true,
					'populate' => $this->dynamic_function_populate(),
				),
				array()
			)
		);
	}

	// query populate

	public function test_dynamic_posts_query_returns_the_post_object(): void {
		$post_id = $this->insert_post( 'Dynamic Post' );
		$stored  = array(
			'value' => $post_id,
			'label' => 'Dynamic Post',
		);
		$field   = array(
			'type'     => 'select',
			'populate' => array(
				'type'      => 'query',
				'query'     => 'posts',
				'arguments' => array( 'post_type' => '{attributes.kind}' ),
			),
		);

		$post = $this->render_field( $field, $stored );

		$this->assertInstanceOf( WP_Post::class, $post );
		$this->assertSame( $post_id, $post->ID );

		$list = $this->render_field( array_merge( $field, array( 'multiple' => true ) ), array( $stored ) );

		$this->assertCount( 1, $list );
		$this->assertSame( $post_id, $list[0]->ID );
	}

	public function test_dynamic_posts_query_returns_the_id_when_asked(): void {
		$post_id = $this->insert_post( 'Dynamic Post' );

		$this->assertSame(
			$post_id,
			$this->render_field(
				array(
					'type'     => 'select',
					'populate' => array(
						'type'         => 'query',
						'query'        => 'posts',
						'arguments'    => array( 'post_type' => '{attributes.kind}' ),
						'returnFormat' => array( 'value' => 'id' ),
					),
				),
				array(
					'value' => $post_id,
					'label' => 'Dynamic Post',
				)
			)
		);
	}

	public function test_dynamic_users_and_terms_queries_return_their_objects(): void {
		$user = $this->render_field(
			array(
				'type'     => 'select',
				'populate' => array(
					'type'      => 'query',
					'query'     => 'users',
					'arguments' => array( 'role' => '{attributes.kind}' ),
				),
			),
			array(
				'value' => 1,
				'label' => 'Admin',
			)
		);
		$term = $this->render_field(
			array(
				'type'     => 'select',
				'populate' => array(
					'type'      => 'query',
					'query'     => 'terms',
					'arguments' => array( 'taxonomy' => '{attributes.kind}' ),
				),
			),
			array(
				'value' => 1,
				'label' => 'Uncategorized',
			)
		);

		$this->assertInstanceOf( WP_User::class, $user );
		$this->assertSame( 1, $user->ID );
		$this->assertInstanceOf( WP_Term::class, $term );
		$this->assertSame( 1, $term->term_id );
	}

	public function test_dynamic_query_type_keeps_the_stored_value(): void {
		$this->assertSame(
			12,
			$this->render_field(
				array(
					'type'     => 'select',
					'populate' => array(
						'type'  => 'query',
						'query' => '{attributes.kind.value}',
					),
				),
				array(
					'value' => 12,
					'label' => 'Twelve',
				)
			)
		);
	}

	// unchanged behaviour

	public function test_static_select_still_maps_through_its_options(): void {
		$field = array(
			'type'    => 'select',
			'options' => array(
				array(
					'value' => 'post',
					'label' => 'Post',
				),
			),
		);

		$this->assertSame(
			'post',
			$this->render_field(
				$field,
				array(
					'value' => 'post',
					'label' => 'Stale label',
				)
			)
		);
		$this->assertFalse(
			$this->render_field(
				$field,
				array(
					'value' => 'gone',
					'label' => 'Gone',
				)
			)
		);
		$this->assertSame(
			'Post',
			$this->render_field(
				array_merge( $field, array( 'returnFormat' => 'label' ) ),
				array(
					'value' => 'post',
					'label' => 'Stale label',
				)
			)
		);
	}

	public function test_populate_without_dynamic_arguments_still_maps_through_its_options(): void {
		add_filter(
			'blockstudio/blocks/attributes/populate',
			static function ( array $options ): array {
				$options['dynamic_select_test'] = array(
					array(
						'value' => 'a',
						'label' => 'Item A',
					),
				);

				return $options;
			}
		);

		$field = array(
			'type'         => 'select',
			'returnFormat' => 'label',
			'populate'     => array(
				'type'   => 'custom',
				'custom' => 'dynamic_select_test',
			),
		);

		try {
			$this->assertSame(
				'Item A',
				$this->render_field(
					$field,
					array(
						'value' => 'a',
						'label' => 'Stale label',
					)
				)
			);
			$this->assertFalse(
				$this->render_field(
					$field,
					array(
						'value' => 'gone',
						'label' => 'Gone',
					)
				)
			);
		} finally {
			remove_all_filters( 'blockstudio/blocks/attributes/populate' );
		}
	}

	public function test_radio_with_dynamic_arguments_is_left_alone(): void {
		$this->assertFalse(
			$this->render_field(
				array(
					'type'     => 'radio',
					'populate' => $this->dynamic_function_populate(),
				),
				array(
					'value' => 'a',
					'label' => 'Item A (post)',
				)
			)
		);
	}

	// default and fallback

	public static function default_provider(): array {
		$a = array(
			'value' => 'a',
			'label' => 'a',
		);
		$b = array(
			'value' => 'b',
			'label' => 'Item B',
		);

		return array(
			'single scalar'      => array( false, 'a', $a ),
			'single object'      => array(
				false,
				$b,
				$b,
			),
			'multiple scalars'   => array(
				true,
				array( 'a', 'c' ),
				array(
					$a,
					array(
						'value' => 'c',
						'label' => 'c',
					),
				),
			),
			'multiple objects'   => array( true, array( $b, $a ), array( $b, $a ) ),
			'multiple one value' => array( true, 'a', array( $a ) ),
		);
	}

	private function registered_attribute( bool $multiple, string $item, mixed $value ): array {
		$built = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'       => 'items',
					'type'     => 'select',
					'multiple' => $multiple,
					'populate' => $this->dynamic_function_populate(),
					$item      => $value,
				),
			)
		);

		return $built['items'];
	}

	#[\PHPUnit\Framework\Attributes\DataProvider( 'default_provider' )]
	public function test_dynamic_select_registers_its_default( bool $multiple, mixed $default, mixed $expected ): void {
		$this->assertSame( $expected, $this->registered_attribute( $multiple, 'default', $default )['default'] );
	}

	#[\PHPUnit\Framework\Attributes\DataProvider( 'default_provider' )]
	public function test_dynamic_select_registers_its_fallback( bool $multiple, mixed $fallback, mixed $expected ): void {
		$this->assertSame( $expected, $this->registered_attribute( $multiple, 'fallback', $fallback )['fallback'] );
	}

	public function test_dynamic_select_renders_its_default_without_a_stored_value(): void {
		$cases = array(
			array( false, 'both', 'a', array( 'value' => 'a', 'label' => 'a' ) ),
			array( false, 'value', array( 'value' => 'b', 'label' => 'Item B' ), 'b' ),
			array( true, 'value', array( 'a', 'c' ), array( 'a', 'c' ) ),
			array( true, 'label', array( array( 'value' => 'b', 'label' => 'Item B' ) ), array( 'Item B' ) ),
		);

		foreach ( $cases as list( $multiple, $format, $default, $expected ) ) {
			$field = array(
				'id'           => 'items',
				'type'         => 'select',
				'multiple'     => $multiple,
				'returnFormat' => $format,
				'default'      => $default,
				'populate'     => $this->dynamic_function_populate(),
			);
			$built = ( new Attribute_Builder() )->build( array( $field ) );

			$attributes = array();
			$block      = array( 'name' => 'test/dynamic-select' );
			Block::transform( $attributes, $block, 'test/dynamic-select', false, false, $built );

			$this->assertSame( $expected, $attributes['items'] );
		}
	}

	public function test_dynamic_select_renders_its_fallback_for_an_empty_value(): void {
		$field = array(
			'id'       => 'items',
			'type'     => 'select',
			'fallback' => 'a',
			'populate' => $this->dynamic_function_populate(),
		);
		$built = ( new Attribute_Builder() )->build( array( $field ) );

		$attributes = array( 'blockstudio' => array( 'attributes' => array( 'items' => '' ) ) );
		$block      = array( 'name' => 'test/dynamic-select' );
		Block::transform( $attributes, $block, 'test/dynamic-select', false, false, $built );

		$this->assertSame(
			array(
				'value' => 'a',
				'label' => 'a',
			),
			$attributes['items']
		);
	}

	public function test_fetch_select_keeps_the_label_of_a_single_object_default(): void {
		$object = array(
			'value' => 'b',
			'label' => 'Item B',
		);
		$built  = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'       => 'items',
					'type'     => 'select',
					'default'  => $object,
					'populate' => array(
						'type'  => 'query',
						'query' => 'posts',
						'fetch' => true,
					),
				),
			)
		);

		$this->assertSame( $object, $built['items']['default'] );
	}

	public function test_static_select_default_and_fallback_still_map_through_the_options(): void {
		$options = array(
			array(
				'value' => 'a',
				'label' => 'Item A',
			),
			array(
				'value' => 'b',
				'label' => 'Item B',
			),
		);
		$built   = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'       => 'single',
					'type'     => 'select',
					'options'  => $options,
					'default'  => array(
						'value' => 'a',
						'label' => 'Stale label',
					),
					'fallback' => 'b',
				),
				array(
					'id'       => 'multi',
					'type'     => 'select',
					'multiple' => true,
					'options'  => $options,
					'default'  => array( 'a', 'gone' ),
				),
			)
		);

		$this->assertSame( $options[0], $built['single']['default'] );
		$this->assertSame( $options[1], $built['single']['fallback'] );
		$this->assertSame(
			array(
				$options[0],
				array(
					'value' => false,
					'label' => false,
				),
			),
			$built['multi']['default']
		);
	}

	public function test_populate_without_dynamic_arguments_still_maps_its_default_through_the_options(): void {
		add_filter(
			'blockstudio/blocks/attributes/populate',
			static function ( array $options ): array {
				$options['dynamic_select_default_test'] = array(
					array(
						'value' => 'a',
						'label' => 'Item A',
					),
				);

				return $options;
			}
		);

		try {
			$built = ( new Attribute_Builder() )->build(
				array(
					array(
						'id'       => 'items',
						'type'     => 'select',
						'default'  => 'a',
						'populate' => array(
							'type'   => 'custom',
							'custom' => 'dynamic_select_default_test',
						),
					),
				)
			);
		} finally {
			remove_all_filters( 'blockstudio/blocks/attributes/populate' );
		}

		$this->assertSame(
			array(
				'value' => 'a',
				'label' => 'Item A',
			),
			$built['items']['default']
		);
	}

	// Populate::has_dynamic_arguments()

	public function test_has_dynamic_arguments_finds_references_at_any_depth(): void {
		$this->assertTrue( Populate::has_dynamic_arguments( array( 'arguments' => array( '{attributes.kind}' ) ) ) );
		$this->assertTrue( Populate::has_dynamic_arguments( array( 'arguments' => array( 'meta' => array( 'key' => 'x-{attributes.a.b}' ) ) ) ) );
		$this->assertTrue( Populate::has_dynamic_arguments( array( 'query' => '{attributes.kind.value}' ) ) );
	}

	public function test_has_dynamic_arguments_ignores_everything_else(): void {
		$this->assertFalse( Populate::has_dynamic_arguments( array() ) );
		$this->assertFalse( Populate::has_dynamic_arguments( array( 'type' => 'query', 'query' => 'posts' ) ) );
		$this->assertFalse( Populate::has_dynamic_arguments( array( 'arguments' => array( '{other.kind}' ) ) ) );
	}
}
