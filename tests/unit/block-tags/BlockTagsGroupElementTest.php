<?php

use Blockstudio\Block_Tags;
use PHPUnit\Framework\TestCase;

/**
 * Sectioning elements in page, pattern and Site Template sources become
 * core/group blocks that keep their element, and core/group block tags
 * honor tagName.
 */
class BlockTagsGroupElementTest extends TestCase {

	private static function serialized( string $html ): string {
		return serialize_blocks( Block_Tags::parse_all_elements( $html ) );
	}

	public function test_divs_and_sections_serialize_as_before(): void {
		$this->assertSame(
			'<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>A</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
			self::serialized( '<div><p>A</p></div>' )
		);
		$this->assertSame(
			'<!-- wp:group --><div class="wp-block-group"><!-- wp:paragraph --><p>B</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
			self::serialized( '<section><p>B</p></section>' )
		);
	}

	public function test_sectioning_elements_become_groups_that_keep_their_element(): void {
		foreach ( array( 'main', 'header', 'footer', 'article', 'aside' ) as $element ) {
			$this->assertSame(
				'<!-- wp:group {"tagName":"' . $element . '"} --><' . $element . ' class="wp-block-group"><!-- wp:heading {"level":1} --><h1 class="wp-block-heading">Title</h1><!-- /wp:heading --></' . $element . '><!-- /wp:group -->',
				self::serialized( '<' . $element . '><h1>Title</h1></' . $element . '>' ),
				$element
			);
		}
	}

	public function test_the_site_template_example_keeps_its_main_element_and_inner_blocks(): void {
		$blocks = Block_Tags::parse_all_elements(
			'<div class="site-shell"><block name="core/template-part" slug="header" /><main><h1>Welcome</h1><block name="core/post-content" /></main></div>'
		);

		$main = $blocks[0]['innerBlocks'][1] ?? array();
		$this->assertSame( 'core/group', $main['blockName'] ?? null );
		$this->assertSame( 'main', $main['attrs']['tagName'] ?? null );
		$this->assertSame(
			array( 'core/heading', 'core/post-content' ),
			array_column( $main['innerBlocks'], 'blockName' )
		);
		$this->assertStringNotContainsString( 'wp:html', serialize_blocks( $blocks ) );
	}

	public function test_group_block_tags_honor_tag_name(): void {
		$this->assertSame(
			'<!-- wp:group {"tagName":"main"} --><main class="wp-block-group"><!-- wp:paragraph --><p>A</p><!-- /wp:paragraph --></main><!-- /wp:group -->',
			self::serialized( '<block name="core/group" tagName="main"><p>A</p></block>' )
		);
		$this->assertSame(
			'<!-- wp:group --><div class="wp-block-group"></div><!-- /wp:group -->',
			self::serialized( '<block name="core/group" tagName="script"></block>' )
		);
	}

	public function test_rendered_groups_use_their_element(): void {
		$html = do_blocks( self::serialized( '<header><p>Top</p></header>' ) );

		$this->assertStringStartsWith( '<header class="wp-block-group', trim( $html ) );
		$this->assertStringEndsWith( '</header>', trim( $html ) );
	}
}
