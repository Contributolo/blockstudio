<?php

use Blockstudio\Block_Tags;
use PHPUnit\Framework\TestCase;

/**
 * Lists from page sources: nested lists keep their depth and classes reach
 * the blocks (inline0/blockstudio#97), while flat lists without a class
 * serialize exactly as before.
 */
class BlockTagsListTest extends TestCase {

	private static function serialized( string $html ): string {
		return serialize_blocks( Block_Tags::parse_all_elements( $html ) );
	}

	/**
	 * Render the parsed blocks and collapse whitespace between tags.
	 */
	private static function rendered( string $html ): string {
		$output = do_blocks( self::serialized( $html ) );

		return trim( (string) preg_replace( '/>\s+</', '><', $output ) );
	}

	public function test_flat_lists_without_a_class_serialize_as_before(): void {
		$this->assertSame(
			'<!-- wp:list {"ordered":false} --><ul class="wp-block-list"><!-- wp:list-item --><li>One</li><!-- /wp:list-item --><!-- wp:list-item --><li>Two <strong>bold</strong></li><!-- /wp:list-item --></ul><!-- /wp:list -->',
			self::serialized( "<ul>\n  <li>One</li>\n  <li>Two <strong>bold</strong></li>\n</ul>" )
		);
		$this->assertSame(
			'<!-- wp:list {"ordered":true} --><ol class="wp-block-list"><!-- wp:list-item --><li>First</li><!-- /wp:list-item --></ol><!-- /wp:list -->',
			self::serialized( '<ol><li>First</li></ol>' )
		);
	}

	public function test_the_issue_97_list_nests_and_keeps_its_class(): void {
		$blocks = Block_Tags::parse_all_elements(
			"<ul class=\"is-style-checks\">\n  <li>One\n    <ul><li>One-a</li><li>One-b</li></ul>\n  </li>\n  <li>Two</li>\n</ul>"
		);

		$this->assertCount( 1, $blocks );
		$list = $blocks[0];
		$this->assertSame( 'core/list', $list['blockName'] );
		$this->assertSame( 'is-style-checks', $list['attrs']['className'] ?? null );
		$this->assertCount( 2, $list['innerBlocks'] );

		$first = $list['innerBlocks'][0];
		$this->assertSame( 'core/list-item', $first['blockName'] );
		$this->assertSame( array( '<li>One', null, '</li>' ), $first['innerContent'] );
		$this->assertCount( 1, $first['innerBlocks'] );
		$this->assertSame( 'core/list', $first['innerBlocks'][0]['blockName'] );
		$this->assertSame(
			array( '<li>One-a</li>', '<li>One-b</li>' ),
			array_column( $first['innerBlocks'][0]['innerBlocks'], 'innerHTML' )
		);
		$this->assertSame( '<li>Two</li>', $list['innerBlocks'][1]['innerHTML'] );

		$this->assertSame(
			'<ul class="wp-block-list is-style-checks"><li>One<ul class="wp-block-list"><li>One-a</li><li>One-b</li></ul></li><li>Two</li></ul>',
			self::rendered( "<ul class=\"is-style-checks\">\n  <li>One\n    <ul><li>One-a</li><li>One-b</li></ul>\n  </li>\n  <li>Two</li>\n</ul>" )
		);
	}

	public function test_nesting_mixes_list_types_and_goes_three_levels_deep(): void {
		$this->assertSame(
			'<ol class="wp-block-list"><li>A<ul class="wp-block-list sub"><li>A1<ol class="wp-block-list"><li>A1a</li></ol></li><li>A2</li></ul></li><li>B</li></ol>',
			self::rendered( '<ol><li>A<ul class="sub"><li>A1<ol><li>A1a</li></ol></li><li>A2</li></ul></li><li>B</li></ol>' )
		);
	}

	public function test_text_after_a_nested_list_stays_in_its_item(): void {
		$this->assertSame(
			'<ul class="wp-block-list"><li>Before<ul class="wp-block-list"><li>Inner</li></ul> after</li></ul>',
			self::rendered( '<ul><li>Before<ul><li>Inner</li></ul> after</li></ul>' )
		);
	}

	public function test_items_with_attributes_are_kept_with_their_class(): void {
		$blocks = Block_Tags::parse_all_elements( '<ul><li class="done">Ship</li><li data-x="1">Test</li></ul>' );
		$items  = $blocks[0]['innerBlocks'];

		$this->assertCount( 2, $items );
		$this->assertSame( 'done', $items[0]['attrs']['className'] ?? null );
		$this->assertSame( '<li class="done">Ship</li>', $items[0]['innerHTML'] );
		$this->assertSame( '<li>Test</li>', $items[1]['innerHTML'] );
	}

	public function test_multiple_nested_lists_keep_their_order_and_surrounding_text(): void {
		$this->assertSame(
			'<ul class="wp-block-list outer"><li class="done">Before<ul class="wp-block-list first"><li>One</li></ul> between<ol class="wp-block-list second"><li>Two</li></ol> after</li><li>Last</li></ul>',
			self::rendered( '<ul class="outer"><li class="done">Before<ul class="first"><li>One</li></ul> between<ol class="second"><li>Two</li></ol> after</li><li>Last</li></ul>' )
		);
	}

	public function test_list_classes_are_decoded_and_escaped_once(): void {
		$this->assertSame(
			'<ul class="wp-block-list [&amp;&gt;li]:mb-2"><li>One</li></ul>',
			self::rendered( '<ul class="[&amp;&gt;li]:mb-2 wp-block-list"><li>One</li></ul>' )
		);
	}

	public function test_block_syntax_takes_a_class_name(): void {
		$this->assertSame(
			'<!-- wp:list {"ordered":false,"className":"is-style-checks"} --><ul class="wp-block-list is-style-checks"><!-- wp:list-item --><li>One</li><!-- /wp:list-item --></ul><!-- /wp:list -->',
			serialize_blocks( Block_Tags::parse_inner_blocks( '<block name="core/list" className="is-style-checks"><li>One</li></block>' ) )
		);
	}
}
