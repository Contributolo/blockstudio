<?php

use Blockstudio\Attribute_Builder;
use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Extensions;
use PHPUnit\Framework\TestCase;

/**
 * How "set" writes extension values to the block wrapper.
 */
class ExtensionSetTest extends TestCase {

	private ?array $extensions = null;

	protected function tearDown(): void {
		if ( null !== $this->extensions ) {
			$this->set_extensions( $this->extensions );
		}
		parent::tearDown();
	}

	private function extend( array $fields ): void {
		$this->extensions ??= Build::extensions();
		$this->set_extensions( array() );
		Block_Registry::instance()->register_extension(
			new WP_Block_Type(
				'unit-set/*',
				array(
					'attributes'  => ( new Attribute_Builder() )->build( $fields, false, true ),
					'blockstudio' => array(
						'extend'     => true,
						'attributes' => $fields,
					),
				)
			)
		);
	}

	// The registry has no API to remove an extension again.
	private function set_extensions( array $extensions ): void {
		( new ReflectionProperty( Block_Registry::class, 'extensions' ) )->setValue( Block_Registry::instance(), $extensions );
	}

	private function languages( array $set, array $field = array() ): array {
		return $field + array(
			'id'       => 'unitLangs',
			'type'     => 'select',
			'multiple' => true,
			'options'  => array(
				array(
					'value' => 'en-au',
					'label' => 'English',
				),
				array(
					'value' => 'de',
					'label' => 'German',
				),
				array(
					'value' => 'fr',
					'label' => 'French',
				),
			),
			'set'      => array( $set ),
		);
	}

	private function render( array $attributes, string $html = '<p>Text</p>' ): string {
		return Extensions::render_blocks(
			$html,
			array(
				'blockName' => 'unit-set/block',
				'attrs'     => array( 'blockstudio' => array( 'attributes' => $attributes ) ),
			)
		);
	}

	private function chosen( string ...$values ): array {
		$labels = array(
			'en-au' => 'English',
			'de'    => 'German',
			'fr'    => 'French',
		);

		return array_map(
			fn ( string $value ): array => array(
				'value' => $value,
				'label' => $labels[ $value ],
			),
			$values
		);
	}

	private function field( string $id, array $values, array $set, array $field = array() ): array {
		return $field + array(
			'id'       => $id,
			'type'     => 'select',
			'multiple' => true,
			'options'  => array_map(
				fn ( string $value ): array => array(
					'value' => $value,
					'label' => $value,
				),
				$values
			),
			'set'      => array( $set ),
		);
	}

	private function tags( array $set ): array {
		return array(
			'id'   => 'unitTags',
			'type' => 'token',
			'set'  => array( $set + array( 'value' => '{attributes.unitTags}' ) ),
		);
	}

	// Option and token values as the editor stores them.
	private function entries( string ...$values ): array {
		return array_map(
			fn ( string $value ): array => array(
				'value' => $value,
				'label' => $value,
			),
			$values
		);
	}

	// Without "join" every entry overwrites the attribute, as it always did.

	public function test_a_list_without_join_writes_the_last_entry_to_href(): void {
		$this->extend(
			array(
				$this->field(
					'unitLink',
					array( '/first/', '/second/' ),
					array(
						'attribute' => 'href',
						'value'     => '{attributes.unitLink}',
					)
				),
			)
		);

		$this->assertSame(
			'<a href="/second/">Text</a>',
			$this->render( array( 'unitLink' => $this->entries( '/first/', '/second/' ) ), '<a>Text</a>' )
		);
	}

	public function test_a_list_without_join_writes_the_last_entry_to_id(): void {
		$this->extend(
			array(
				$this->field(
					'unitAnchor',
					array( 'first-anchor', 'second-anchor' ),
					array(
						'attribute' => 'id',
						'value'     => '{attributes.unitAnchor}',
					)
				),
			)
		);

		$this->assertSame(
			'<p id="second-anchor">Text</p>',
			$this->render( array( 'unitAnchor' => $this->entries( 'first-anchor', 'second-anchor' ) ) )
		);
	}

	public function test_a_list_without_join_writes_the_last_entry_to_a_data_attribute(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs}',
					)
				),
			)
		);

		$this->assertSame(
			'<p data-langs="de">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ) )
		);
	}

	public function test_join_false_writes_the_last_entry(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs}',
						'join'      => false,
					)
				),
			)
		);

		$this->assertSame(
			'<p data-langs="de">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ) )
		);
	}

	public function test_a_list_without_join_resolves_nested_values_of_the_last_entry(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-languages',
						'value'     => '{attributes.unitLangs.label}',
					),
					array( 'returnFormat' => 'both' )
				),
			)
		);

		$this->assertSame(
			'<p data-languages="French">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'fr' ) ) )
		);
	}

	public function test_a_token_list_without_join_writes_the_last_token(): void {
		$this->extend( array( $this->tags( array( 'attribute' => 'data-tags' ) ) ) );

		$this->assertSame( '<p data-tags="featured">Text</p>', $this->render( array( 'unitTags' => $this->entries( 'news', 'featured' ) ) ) );
	}

	// With "join" every entry is written, separated by spaces.

	public function test_join_writes_every_entry_to_a_data_attribute(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs}',
						'join'      => true,
					)
				),
			)
		);

		$this->assertSame(
			'<p data-langs="en-au de">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ) )
		);
	}

	public function test_join_resolves_nested_values_per_entry(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-languages',
						'value'     => '{attributes.unitLangs.label}',
						'join'      => true,
					),
					array( 'returnFormat' => 'both' )
				),
			)
		);

		$this->assertSame(
			'<p data-languages="English French">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'fr' ) ) )
		);
	}

	public function test_join_writes_every_token(): void {
		$this->extend(
			array(
				$this->tags(
					array(
						'attribute' => 'data-tags',
						'join'      => true,
					)
				),
			)
		);

		$this->assertSame( '<p data-tags="news featured">Text</p>', $this->render( array( 'unitTags' => $this->entries( 'news', 'featured' ) ) ) );
		$this->assertSame( '<p data-tags="news featured">Text</p>', $this->render( array( 'unitTags' => array( 'news', 'featured' ) ) ) );
	}

	public function test_join_writes_a_repeated_result_once(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-has-language',
						'value'     => 'yes',
						'join'      => true,
					)
				),
			)
		);

		$this->assertSame(
			'<p data-has-language="yes">Text</p>',
			$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de', 'fr' ) ) )
		);
	}

	public function test_join_skips_empty_and_repeated_results(): void {
		$labels = array(
			'a' => 'Same',
			'b' => '',
			'c' => 'Other',
			'd' => 'Same',
			'e' => ' ',
		);

		$this->extend(
			array(
				$this->field(
					'unitNames',
					array_keys( $labels ),
					array(
						'attribute' => 'data-names',
						'value'     => '{attributes.unitNames.label}',
						'join'      => true,
					),
					array(
						'returnFormat' => 'both',
						'options'      => array_map(
							fn ( string $value, string $label ): array => array(
								'value' => $value,
								'label' => $label,
							),
							array_keys( $labels ),
							$labels
						),
					)
				),
			)
		);

		$this->assertSame(
			'<p data-names="Same Other">Text</p>',
			$this->render( array( 'unitNames' => $this->entries( ...array_keys( $labels ) ) ) )
		);
	}

	public function test_join_without_any_non_empty_result_writes_nothing(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs.missing}',
						'join'      => true,
					)
				),
			)
		);

		$this->assertSame( '<p>Text</p>', $this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ) ) );
	}

	public function test_join_with_an_empty_list_writes_nothing(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs}',
						'join'      => true,
					)
				),
			)
		);

		$this->assertSame( '<p>Text</p>', $this->render( array( 'unitLangs' => array() ) ) );
	}

	public function test_join_does_not_change_a_single_value(): void {
		foreach ( array( true, false ) as $join ) {
			$this->extend(
				array(
					array(
						'id'   => 'unitTone',
						'type' => 'text',
						'set'  => array(
							array(
								'attribute' => 'data-tone',
								'value'     => 'tone-{attributes.unitTone}',
								'join'      => $join,
							),
						),
					),
				)
			);

			$this->assertSame( '<p data-tone="tone-warm">Text</p>', $this->render( array( 'unitTone' => 'warm' ) ) );
		}
	}

	// Class and style add one class or declaration per entry, with or without "join".

	public function test_a_list_adds_one_class_per_entry(): void {
		foreach ( array( false, true ) as $join ) {
			$this->extend(
				array(
					$this->languages(
						array(
							'attribute' => 'class',
							'value'     => 'lang-{attributes.unitLangs}',
							'join'      => $join,
						)
					),
				)
			);

			$this->assertSame(
				'<p class="intro lang-en-au lang-de">Text</p>',
				$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ), '<p class="intro">Text</p>' )
			);
		}
	}

	public function test_a_list_adds_one_declaration_per_entry_to_the_style(): void {
		foreach ( array( false, true ) as $join ) {
			$this->extend(
				array(
					$this->languages(
						array(
							'attribute' => 'style',
							'value'     => '--lang-{attributes.unitLangs}: 1',
							'join'      => $join,
						)
					),
				)
			);

			$this->assertSame(
				'<p style="--lang-en-au: 1; --lang-de: 1;">Text</p>',
				$this->render( array( 'unitLangs' => $this->chosen( 'en-au', 'de' ) ) )
			);
		}
	}

	public function test_a_single_value_is_written_unchanged(): void {
		$this->extend(
			array(
				array(
					'id'   => 'unitTone',
					'type' => 'text',
					'set'  => array(
						array(
							'attribute' => 'data-tone',
							'value'     => 'tone-{attributes.unitTone}',
						),
					),
				),
			)
		);

		$this->assertSame( '<p data-tone="tone-warm">Text</p>', $this->render( array( 'unitTone' => 'warm' ) ) );
	}

	public function test_an_empty_list_writes_nothing(): void {
		$this->extend(
			array(
				$this->languages(
					array(
						'attribute' => 'data-langs',
						'value'     => '{attributes.unitLangs}',
					)
				),
			)
		);

		$this->assertSame( '<p>Text</p>', $this->render( array( 'unitLangs' => array() ) ) );
	}
}
