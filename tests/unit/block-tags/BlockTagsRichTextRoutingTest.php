<?php

use Blockstudio\Block_Registry;
use Blockstudio\Block_Tags;
use PHPUnit\Framework\TestCase;

/**
 * A `<p>` mapped to a custom block with a `content` richtext field keeps its
 * inline HTML, including tags that are element-mapped at block level.
 */
class BlockTagsRichTextRoutingTest extends TestCase {

	private array $added = array();

	protected function setUp(): void {
		parent::setUp();

		$this->register_blockstudio_block(
			'custom/routed-paragraph',
			array(
				array(
					'id'   => 'content',
					'type' => 'richtext',
				),
			)
		);
		$this->register_blockstudio_block(
			'custom/routed-image',
			array(
				array(
					'id'   => 'src',
					'type' => 'text',
				),
				array(
					'id'   => 'alt',
					'type' => 'text',
				),
			)
		);
		$this->map( 'p', 'custom/routed-paragraph' );
	}

	protected function tearDown(): void {
		foreach ( $this->added as [$hook, $cb] ) {
			remove_filter( $hook, $cb );
		}
		$this->added = array();
		parent::tearDown();
	}

	private function map( string $tag, string $block_name ): void {
		$filter = static function ( array $mapping ) use ( $tag, $block_name ): array {
			$mapping[ $tag ] = $block_name;
			return $mapping;
		};
		add_filter( 'blockstudio/parser/element_mapping', $filter );
		$this->added[] = array( 'blockstudio/parser/element_mapping', $filter );
	}

	private function register_blockstudio_block( string $name, array $attributes ): void {
		$block              = new WP_Block_Type( $name, array( 'category' => 'blockstudio-test-unit' ) );
		$block->blockstudio = array(
			'attributes' => $attributes,
			'data'       => array(
				'path' => get_stylesheet_directory() . '/blockstudio/unit/' . str_replace( '/', '-', $name ),
			),
		);

		Block_Registry::instance()->register_block( $name, $block );
	}

	private static function attributes_of( array $block ): array {
		return $block['attrs']['blockstudio']['attributes'] ?? array();
	}

	public function test_inline_code_is_routed_although_code_is_element_mapped(): void {
		$blocks = Block_Tags::parse_all_elements( '<p>Run <code>wp bs pages sync</code> after editing a page.</p>' );

		$this->assertCount( 1, $blocks );
		$this->assertSame( 'custom/routed-paragraph', $blocks[0]['blockName'] );
		$this->assertSame(
			'Run <code>wp bs pages sync</code> after editing a page.',
			self::attributes_of( $blocks[0] )['content'] ?? null
		);
		$this->assertSame( array(), $blocks[0]['innerBlocks'] );
	}

	public function test_links_and_strong_are_routed(): void {
		$blocks = Block_Tags::parse_all_elements( '<p>Read the <a href="/docs/">docs</a> and <strong>sync</strong>.</p>' );

		$this->assertSame(
			'Read the <a href="/docs/">docs</a> and <strong>sync</strong>.',
			self::attributes_of( $blocks[0] )['content'] ?? null
		);
	}

	public function test_mixed_inline_markup_is_routed_when_every_inline_tag_is_mapped(): void {
		$this->map( 'a', 'custom/routed-link' );
		$this->map( 'strong', 'custom/routed-strong' );

		$blocks = Block_Tags::parse_all_elements(
			'<p>Use <a href="https://example.com"><code>bs_tw_merge()</code></a>, <em>not</em> <strong>raw</strong> classes.<br>Then sync.</p>'
		);

		$this->assertCount( 1, $blocks );
		$this->assertSame(
			'Use <a href="https://example.com"><code>bs_tw_merge()</code></a>, <em>not</em> <strong>raw</strong> classes.<br>Then sync.',
			self::attributes_of( $blocks[0] )['content'] ?? null
		);
	}

	public function test_inline_image_beside_text_is_routed(): void {
		$blocks = Block_Tags::parse_all_elements( '<p>Logo <img src="/logo.png" alt="Logo"> beside text.</p>' );

		$this->assertCount( 1, $blocks );
		$this->assertSame( 'custom/routed-paragraph', $blocks[0]['blockName'] );
		$this->assertSame( 'Logo <img src="/logo.png" alt="Logo"> beside text.', self::attributes_of( $blocks[0] )['content'] ?? null );
	}

	public function test_block_level_children_are_not_routed(): void {
		$blocks = Block_Tags::parse_all_elements( '<p>Before<ul><li>One</li></ul></p>' );

		$this->assertSame( 'custom/routed-paragraph', $blocks[0]['blockName'] );
		$this->assertArrayNotHasKey( 'content', self::attributes_of( $blocks[0] ) );

		$blocks = Block_Tags::parse_all_elements( '<p><div>Block</div></p>' );

		$this->assertArrayNotHasKey( 'content', self::attributes_of( $blocks[0] ) );
	}

	public function test_image_only_paragraph_resolves_through_the_image_mapping(): void {
		$this->map( 'img', 'custom/routed-image' );

		$blocks = Block_Tags::parse_all_elements( '<p class="figure">  <img src="/diagram.png" alt="A &gt; B" />  </p>' );

		$this->assertCount( 1, $blocks );
		$this->assertSame( 'custom/routed-image', $blocks[0]['blockName'] );
		$this->assertSame( '/diagram.png', self::attributes_of( $blocks[0] )['src'] ?? null );
		$this->assertSame( 'A &gt; B', self::attributes_of( $blocks[0] )['alt'] ?? null );
	}

	public function test_image_only_paragraph_uses_the_default_core_image_mapping(): void {
		$blocks = Block_Tags::parse_all_elements( '<p><img src="https://example.com/a.png" alt="A"></p>' );

		$this->assertCount( 1, $blocks );
		$this->assertSame( 'core/image', $blocks[0]['blockName'] );
		$this->assertSame( 'https://example.com/a.png', $blocks[0]['attrs']['url'] ?? null );
	}

	public function test_core_paragraph_keeps_an_image_only_paragraph(): void {
		$this->map( 'p', 'core/paragraph' );

		$blocks = Block_Tags::parse_all_elements( '<p><img src="https://example.com/a.png" alt="A"></p>' );

		$this->assertSame( 'core/paragraph', $blocks[0]['blockName'] );
		$this->assertSame( '<p><img src="https://example.com/a.png" alt="A"></p>', $blocks[0]['innerHTML'] );
	}

	public function test_paragraph_serialization_without_mapped_inline_tags_is_unchanged(): void {
		$this->assertSame(
			'<!-- wp:custom/routed-paragraph {"blockstudio":{"attributes":{"class":"lede","content":"Hello \u003cstrong\u003eworld\u003c/strong\u003e"}}} /-->',
			serialize_blocks( Block_Tags::parse_all_elements( '<p class="lede">Hello <strong>world</strong></p>' ) )
		);

		$this->map( 'p', 'core/paragraph' );

		$this->assertSame(
			'<!-- wp:paragraph --><p>Plain <em>text</em> and <code>code</code></p><!-- /wp:paragraph -->',
			serialize_blocks( Block_Tags::parse_all_elements( '<p>Plain <em>text</em> and <code>code</code></p>' ) )
		);
	}

	public function test_shortcode_block_keeps_its_text(): void {
		$blocks = Block_Tags::parse_all_elements( '<block name="core/shortcode">[sleek-ai-chatbot id="1318"]</block>' );

		$this->assertCount( 1, $blocks );
		$this->assertSame( 'core/shortcode', $blocks[0]['blockName'] );
		$this->assertSame( '[sleek-ai-chatbot id="1318"]', $blocks[0]['innerHTML'] );
		$this->assertSame( array( '[sleek-ai-chatbot id="1318"]' ), $blocks[0]['innerContent'] );
		$this->assertSame(
			'<!-- wp:shortcode -->[sleek-ai-chatbot id="1318"]<!-- /wp:shortcode -->',
			serialize_blocks( $blocks )
		);

		$blocks = Block_Tags::parse_all_elements( "<bs:core-shortcode>\n  [gallery ids=\"1,2\"]\n</bs:core-shortcode>" );

		$this->assertSame( '[gallery ids="1,2"]', $blocks[0]['innerHTML'] ?? null );
	}
}
