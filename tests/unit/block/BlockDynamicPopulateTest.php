<?php

use Blockstudio\Attribute_Builder;
use Blockstudio\Block;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

function blockstudio_unit_dependent_options( $kind ): array {
	++BlockDynamicPopulateTest::$populate_calls;
	return array(
		array(
			'value' => 'a',
			'label' => 'Item A (' . $kind . ')',
		),
	);
}

class BlockDynamicPopulateTest extends TestCase {

	public static int $populate_calls = 0;

	public function test_resolved_function_arguments_populate_options_through_rest(): void {
		$original_user = get_current_user_id();
		wp_set_current_user( 1 );
		self::$populate_calls = 0;
		try {
			foreach ( array( 'post', 'page' ) as $kind ) {
				$request = new WP_REST_Request( 'POST', '/blockstudio/v1/attributes/populate' );
				$request->set_body_params(
					array(
						'id'         => 'items',
						'type'       => 'select',
						'fromEditor' => true,
						'populate'   => array(
							'type'      => 'function',
							'function'  => 'blockstudio_unit_dependent_options',
							'arguments' => array( $kind ),
						),
					)
				);
				$response = rest_do_request( $request );
				$this->assertSame( 200, $response->get_status() );
				$this->assertSame(
					array(
						array(
							'value' => 'a',
							'label' => 'Item A (' . $kind . ')',
						),
					),
					$response->get_data()
				);
			}
			$this->assertSame( 2, self::$populate_calls );
		} finally {
			wp_set_current_user( $original_user );
		}
	}

	public function test_saved_dynamic_selects_reach_the_php_template_without_changing_content(): void {
		$option = array( 'value' => 'a', 'label' => 'Item A (post)' );
		$stored = array(
			'kind'     => array( 'value' => 'post', 'label' => 'Post' ),
			'single'   => $option,
			'multiple' => array( $option ),
			'label'    => $option,
			'both'     => $option,
		);
		$content = '<!-- wp:blockstudio/type-select-dependent ' . wp_json_encode( array( 'blockstudio' => array( 'attributes' => $stored ) ) ) . ' /-->';
		$before = $content;
		$html = do_blocks( $content );
		$tags = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'blockstudio-test__block' ) ), $html );
		$this->assertSame(
			array( 'kind' => 'post', 'single' => 'a', 'multiple' => array( 'a' ), 'label' => $option['label'], 'both' => $option ),
			json_decode( $tags->get_attribute( 'data-dependent-values' ), true )
		);
		$this->assertSame( $before, $content );
	}

	public static function selection_provider(): array {
		$first  = array(
			'value' => 'a',
			'label' => 'Item A (post)',
		);
		$second = array(
			'value' => 'b',
			'label' => 'Item B (post)',
		);
		$zero   = array(
			'value' => 0,
			'label' => 'Zero',
		);

		return array(
			'single value'    => array( 'select', false, 'value', $first, 'a' ),
			'single label'    => array( 'select', false, 'label', $first, $first['label'] ),
			'single both'     => array( 'select', false, 'both', $first, $first ),
			'multiple value'  => array( 'select', true, 'value', array( $second, $first ), array( 'b', 'a' ) ),
			'multiple label'  => array( 'select', true, 'label', array( $second, $first ), array( $second['label'], $first['label'] ) ),
			'multiple both'   => array( 'select', true, 'both', array( $second, $first ), array( $second, $first ) ),
			'single scalar'   => array( 'select', false, 'value', 'a', 'a' ),
			'scalar label'    => array( 'select', false, 'label', 'a', 'a' ),
			'scalar both'     => array(
				'select',
				false,
				'both',
				'a',
				array(
					'value' => 'a',
					'label' => 'a',
				),
			),
			'multiple scalar' => array( 'select', true, 'value', 'a', array( 'a' ) ),
			'scalar list'     => array( 'select', true, 'value', array( 'b', 'a' ), array( 'b', 'a' ) ),
			'zero option'     => array( 'select', false, 'value', $zero, 0 ),
			'zero list'       => array( 'select', true, 'value', array( $zero ), array( 0 ) ),
			'missing label'   => array( 'select', false, 'label', array( 'value' => 'a' ), 'a' ),
			'empty selection' => array( 'select', false, 'value', '', false ),
			'empty multiple'  => array( 'select', true, 'value', array(), false ),
			'radio label'     => array( 'radio', false, 'label', $first, $first['label'] ),
			'checkbox values' => array( 'checkbox', true, 'value', array( $second, $first ), array( 'b', 'a' ) ),
		);
	}

	#[DataProvider( 'selection_provider' )]
	public function test_dynamic_selections_keep_their_return_format(
		string $type,
		bool $multiple,
		string $format,
		mixed $stored,
		mixed $expected
	): void {
		self::$populate_calls = 0;
		$definitions          = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'           => 'items',
					'type'         => $type,
					'multiple'     => $multiple,
					'returnFormat' => $format,
					'options'      => array(),
					'populate'     => array(
						'type'      => 'function',
						'function'  => 'blockstudio_unit_dependent_options',
						'arguments' => array( '{attributes.kind}' ),
					),
				),
			)
		);
		$this->assertSame( array(), $definitions['items']['options'] );
		$attributes = array( 'items' => $stored );
		$names      = array();

		Block::transform_attributes( $attributes, $names, array(), 'test/dependent', array(), false, $definitions );

		$this->assertSame( $expected, $attributes['items'] );
		$this->assertSame( 0, self::$populate_calls );
		$this->assertSame( array(), $definitions['items']['options'] );
	}

	public function test_static_options_still_win_and_unknown_static_selections_are_rejected(): void {
		$field   = array(
			'options' => array(
				array(
					'value' => 'a',
					'label' => 'Current label',
				),
			),
		);
		$saved   = array(
			'value' => 'a',
			'label' => 'Saved label',
		);
		$dynamic = array(
			'type'   => 'custom',
			'custom' => '{attributes.dataset}',
		);

		$this->assertSame( 'Current label', Block::get_option_value( $field, 'label', $saved, $dynamic ) );
		$this->assertSame(
			'b',
			Block::get_option_value(
				$field,
				'value',
				array(
					'value' => 'b',
					'label' => 'B',
				),
				$dynamic
			)
		);
		$this->assertFalse(
			Block::get_option_value(
				$field,
				'value',
				array(
					'value' => 'b',
					'label' => 'B',
				)
			)
		);
		$this->assertFalse(
			Block::get_option_value(
				array( 'options' => array() ),
				'value',
				$saved,
				array(
					'type'     => 'function',
					'function' => 'missing_static_callback',
				)
			)
		);
	}

	public function test_dynamic_query_keeps_query_object_and_id_return_formats(): void {
		$post_id  = wp_insert_post(
			array(
				'post_title'  => 'Dynamic query target',
				'post_status' => 'publish',
			)
		);
		$populate = array(
			'type'      => 'query',
			'query'     => 'posts',
			'arguments' => array( 'post_type' => '{attributes.kind}' ),
		);
		$saved    = array(
			'value' => $post_id,
			'label' => 'Saved query title',
		);
		$field    = array( 'options' => array() );

		try {
			$this->assertSame( $post_id, Block::get_option_value( $field, 'value', $saved, $populate )->ID );
			$this->assertSame( 'Saved query title', Block::get_option_value( $field, 'label', $saved, $populate ) );
			$populate['returnFormat'] = array( 'value' => 'id' );
			$this->assertSame( $post_id, Block::get_option_value( $field, 'value', $saved, $populate ) );
			$field['options'] = array(
				array(
					'value' => 'all',
					'label' => 'All posts',
				),
			);
			unset( $populate['returnFormat'] );
			$this->assertSame(
				'all',
				Block::get_option_value(
					$field,
					'value',
					array(
						'value' => 'all',
						'label' => 'Saved',
					),
					$populate
				)
			);
		} finally {
			wp_delete_post( $post_id, true );
		}
	}

	public function test_dynamic_selections_render_inside_repeaters(): void {
		$definitions = ( new Attribute_Builder() )->build(
			array(
				array(
					'id'         => 'rows',
					'type'       => 'repeater',
					'attributes' => array(
						array(
							'id'       => 'items',
							'type'     => 'select',
							'multiple' => true,
							'populate' => array(
								'type'   => 'custom',
								'custom' => '{attributes.dataset}',
							),
						),
					),
				),
			)
		);
		$attributes  = array(
			'rows' => array(
				array(
					'items' => array(
						array(
							'value' => 'a',
							'label' => 'A',
						),
					),
				),
			),
		);
		$names       = array();

		Block::transform_attributes( $attributes, $names, array(), 'test/dependent', array(), false, $definitions );

		$this->assertSame( array( 'rows' => array( array( 'items' => array( 'a' ) ) ) ), $attributes );
	}
}
