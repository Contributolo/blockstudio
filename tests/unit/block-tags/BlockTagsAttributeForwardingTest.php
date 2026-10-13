<?php

use Blockstudio\Block_Tags;
use Blockstudio\Page_Sync;
use PHPUnit\Framework\TestCase;

/**
 * Attributes on block tags and on element-mapped page HTML are decoded once,
 * and the global HTML attributes a block does not declare reach its root
 * element on both paths instead of being stored and dropped.
 */
class BlockTagsAttributeForwardingTest extends TestCase {

	private const BLOCK = 'blockstudio/type-block-tags-default';

	private array $added = array();

	protected function setUp(): void {
		parent::setUp();

		$this->filter(
			'blockstudio/parser/element_mapping',
			static function ( array $mapping ): array {
				$mapping['section'] = self::BLOCK;
				return $mapping;
			}
		);
	}

	protected function tearDown(): void {
		foreach ( $this->added as [$hook, $callback] ) {
			remove_filter( $hook, $callback );
		}
		$this->added = array();
		parent::tearDown();
	}

	private function filter( string $hook, callable $callback ): void {
		add_filter( $hook, $callback );
		$this->added[] = array( $hook, $callback );
	}

	/**
	 * @return array<string, string|true>
	 */
	private function root_attributes( string $html ): array {
		$processor = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $processor->next_tag(), 'The output has no element: ' . $html );

		$attributes = array();
		foreach ( $processor->get_attribute_names_with_prefix( '' ) ?? array() as $name ) {
			$attributes[ $name ] = $processor->get_attribute( $name );
		}

		return $attributes;
	}

	private function stored_attributes( string $html ): array {
		$blocks = Block_Tags::parse_all_elements( $html );
		$this->assertSame( self::BLOCK, $blocks[0]['blockName'] ?? null );

		return $blocks[0]['attrs']['blockstudio']['attributes'] ?? array();
	}

	private function render_page_html( string $html ): string {
		return do_blocks( serialize_blocks( Block_Tags::parse_all_elements( $html ) ) );
	}

	// Decoding

	public function test_page_attributes_are_decoded_once(): void {
		$attributes = $this->stored_attributes(
			'<section title="Tom &amp; Jerry" data-a="&amp;_p" data-b="[&>span]:fade" data-c="say &quot;hi&quot;" data-d=\'it&#39;s\' data-e="&lt;b&gt;">x</section>'
		);

		$this->assertSame( 'Tom & Jerry', $attributes['title'] );
		$this->assertSame( '&_p', $attributes['data-a'] );
		$this->assertSame( '[&>span]:fade', $attributes['data-b'] );
		$this->assertSame( 'say "hi"', $attributes['data-c'] );
		$this->assertSame( "it's", $attributes['data-d'] );
		$this->assertSame( '<b>', $attributes['data-e'] );
	}

	public function test_encoded_json_attribute_values_decode_into_arrays(): void {
		$attributes = $this->stored_attributes( '<section data-config="{&quot;a&quot;:1}">x</section>' );

		$this->assertSame( array( 'a' => 1 ), $attributes['data-config'] );
	}

	public function test_tag_passthrough_encodes_ampersands_once(): void {
		$output = Block_Tags::render(
			'<bs:blockstudio-type-block-tags-default title="A" data-x="[&amp;>p]:a" data-y="[&>p]:b"></bs:blockstudio-type-block-tags-default>'
		);
		$root   = $this->root_attributes( $output );

		$this->assertSame( '[&>p]:a', $root['data-x'] );
		$this->assertSame( '[&>p]:b', $root['data-y'] );
		$this->assertStringNotContainsString( '&amp;amp;', $output );
	}

	// Self-closing tags with ">" in a value

	public function test_self_closing_bs_tag_with_an_angle_bracket_in_a_value_renders(): void {
		$output = Block_Tags::render( '<p>Before</p><bs:blockstudio-type-block-tags-default title="Arrow" data-animate="[&>span]:fade" /><p>After</p>' );

		$this->assertStringNotContainsString( '<bs:', $output );
		$this->assertStringContainsString( '<p>Before</p>', $output );
		$this->assertStringContainsString( '<p>After</p>', $output );
		$this->assertStringContainsString( 'Arrow', $output );

		$processor = new WP_HTML_Tag_Processor( $output );
		$this->assertTrue( $processor->next_tag( array( 'class_name' => 'bs-block-tags' ) ) );
		$this->assertSame( '[&>span]:fade', $processor->get_attribute( 'data-animate' ) );
	}

	public function test_self_closing_block_element_and_alias_with_an_angle_bracket_render(): void {
		$this->filter(
			'blockstudio/block_tags/tag_aliases',
			static function ( array $aliases ): array {
				$aliases['unit-arrow-card'] = self::BLOCK;
				return $aliases;
			}
		);

		$output = Block_Tags::render(
			'<block name="blockstudio/type-block-tags-default" title="One" data-a="a>b" />'
			. '<unit-arrow-card title="Two" data-b="c>d" />'
		);

		$this->assertStringNotContainsString( '<block ', $output );
		$this->assertStringNotContainsString( '<unit-arrow-card', $output );
		$this->assertStringContainsString( 'One', $output );
		$this->assertStringContainsString( 'Two', $output );
		$this->assertStringContainsString( 'data-a="a&gt;b"', $output );
		$this->assertStringContainsString( 'data-b="c&gt;d"', $output );
	}

	// Forwarding

	public function test_page_synced_blocks_forward_undeclared_global_attributes(): void {
		$root = $this->root_attributes(
			$this->render_page_html(
				'<section id="hero" style="color:red" role="region" aria-hidden="true" aria-label="A &amp; B" data-animate="[&>span]:fade" html-lang="de" dir="ltr" tabindex="-1" hidden>x</section>'
			)
		);

		$this->assertSame( 'hero', $root['id'] );
		$this->assertSame( 'color:red', $root['style'] );
		$this->assertSame( 'region', $root['role'] );
		$this->assertSame( 'true', $root['aria-hidden'] );
		$this->assertSame( 'A & B', $root['aria-label'] );
		$this->assertSame( '[&>span]:fade', $root['data-animate'] );
		$this->assertSame( 'de', $root['lang'] );
		$this->assertSame( 'ltr', $root['dir'] );
		$this->assertSame( '-1', $root['tabindex'] );
		$this->assertTrue( $root['hidden'] );
		$this->assertSame( 'bs-block-tags', $root['class'] );
	}

	public function test_forwarding_survives_a_template_that_reassigns_locals(): void {
		// PHP templates run in the render method's scope; this one clobbers
		// $name and $blocks, which root forwarding used to read afterwards.
		$block = array(
			'blockName'    => 'blockstudio/type-editor-utility-layout',
			'attrs'        => array(
				'blockstudio' => array(
					'attributes' => array( 'data-probe' => 'kept' ),
					'editor'     => '<?php $name = "Shadowed"; $blocks = array(); ?><div class="probe">x</div>',
				),
			),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);

		$root = $this->root_attributes( render_block( $block ) );

		$this->assertSame( 'kept', $root['data-probe'] );
		$this->assertSame( 'probe', $root['class'] );
	}

	public function test_component_tag_attributes_are_escaped_once(): void {
		$block = array(
			'blockName'    => 'blockstudio/type-editor-utility-layout',
			'attrs'        => array(
				'blockstudio' => array(
					'editor' => '<div useBlockProps class="probe"><InnerBlocks class="<?php echo esc_attr( "[&>div]:h-12 a&b" ); ?>" /><RichText attribute="missing" tag="p" title="Tom &amp; Jerry" /></div>',
				),
			),
			'innerBlocks'  => array(),
			'innerHTML'    => '',
			'innerContent' => array(),
		);

		$html = render_block( $block );

		$this->assertStringContainsString( 'class="[&amp;&gt;div]:h-12 a&amp;b"', $html );
		$this->assertStringNotContainsString( '&amp;amp;', $html );

		$processor = new WP_HTML_Tag_Processor( $html );
		$this->assertTrue( $processor->next_tag( array( 'class_name' => 'a&b' ) ) );
		$this->assertSame( '[&>div]:h-12 a&b', $processor->get_attribute( 'class' ) );
	}

	public function test_block_tags_forward_the_same_global_attributes(): void {
		$root = $this->root_attributes(
			Block_Tags::render( '<bs:blockstudio-type-block-tags-default id="hero" style="color:red" role="note" aria-label="Card" lang="de" />' )
		);

		$this->assertSame( 'hero', $root['id'] );
		$this->assertSame( 'color:red', $root['style'] );
		$this->assertSame( 'note', $root['role'] );
		$this->assertSame( 'Card', $root['aria-label'] );
		$this->assertSame( 'de', $root['lang'] );
	}

	public function test_a_declared_field_is_not_forwarded(): void {
		$output = $this->render_page_html( '<section title="Field value">x</section>' );
		$root   = $this->root_attributes( $output );

		$this->assertArrayNotHasKey( 'title', $root );
		$this->assertStringContainsString( 'Field value', $output );
	}

	public function test_forwarded_styles_go_through_the_css_filter(): void {
		$root = $this->root_attributes(
			$this->render_page_html( '<section style="--gap: 2rem; color: red; background: url(javascript:alert(1))">x</section>' )
		);

		$this->assertSame( '--gap: 2rem;color: red', $root['style'] );
	}

	public function test_stored_html_attributes_forward_only_global_attributes(): void {
		$root = $this->root_attributes(
			$this->render_page_html( '<section html-role="note" html-onclick="alert(1)" html-class="injected" onclick="alert(2)">x</section>' )
		);

		$this->assertSame( 'note', $root['role'] );
		$this->assertArrayNotHasKey( 'onclick', $root );
		$this->assertSame( 'bs-block-tags', $root['class'] );
	}

	public function test_attribute_text_stored_through_kses_is_encoded_once(): void {
		$output = render_block(
			array(
				'blockName'    => self::BLOCK,
				'attrs'        => array(
					'blockstudio' => array(
						'attributes' => array(
							'data-animate' => '[&amp;&gt;span]:fade',
							'aria-label'   => 'A &amp; B',
						),
					),
				),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);
		$root   = $this->root_attributes( $output );

		$this->assertSame( '[&>span]:fade', $root['data-animate'] );
		$this->assertSame( 'A & B', $root['aria-label'] );
		$this->assertStringNotContainsString( '&amp;amp;', $output );
	}

	public function test_top_level_wordpress_attributes_are_not_forwarded(): void {
		$output = render_block(
			array(
				'blockName'    => self::BLOCK,
				'attrs'        => array(
					'title' => 'Top level',
					'style' => array( 'color' => array( 'text' => 'red' ) ),
				),
				'innerBlocks'  => array(),
				'innerHTML'    => '',
				'innerContent' => array(),
			)
		);

		$this->assertArrayNotHasKey( 'style', $this->root_attributes( $output ) );
	}

	// Reporting

	public function test_sync_report_lists_attributes_that_are_neither_fields_nor_forwarded(): void {
		$blocks = Block_Tags::parse_all_elements(
			'<section class="hero" foo="bar" id="kept" data-kept="1" title="Field"><section html-onclick="x">y</section></section>'
		);

		$this->assertSame(
			array( self::BLOCK => array( 'class', 'foo', 'html-onclick' ) ),
			Page_Sync::dropped_attributes( $blocks )
		);
	}

	public function test_block_tags_report_dropped_attributes_with_wp_debug(): void {
		$messages = array();
		$collect  = static function ( string $function_name, string $message ) use ( &$messages ): void {
			if ( 'Blockstudio\Block_Tags::render' === $function_name ) {
				$messages[] = $message;
			}
		};
		add_action( 'doing_it_wrong_run', $collect, 10, 2 );
		$this->filter( 'doing_it_wrong_trigger_error', '__return_false' );

		try {
			Block_Tags::render( '<bs:blockstudio-type-block-tags-default title="A" unit-unknown="1" data-fine="1" id="fine" />' );
		} finally {
			remove_action( 'doing_it_wrong_run', $collect, 10 );
		}

		$this->assertCount( 1, $messages );
		$this->assertStringContainsString( '&quot;unit-unknown&quot;', $messages[0] );
		$this->assertStringContainsString( self::BLOCK, $messages[0] );
	}
}
