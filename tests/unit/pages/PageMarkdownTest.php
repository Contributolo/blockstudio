<?php
/**
 * Private Markdown and YAML dependency regression tests.
 *
 * @package Blockstudio
 */

use Blockstudio\Page_Markdown;
use PHPUnit\Framework\TestCase;

class PageMarkdownTest extends TestCase {

	public function test_private_yaml_preserves_nested_frontmatter_and_anchors(): void {
		$result = Page_Markdown::split_frontmatter( "---\ndefaults: &defaults\n  title: Hello\npage:\n  <<: *defaults\n  items: [one, two]\n---\nBody" );
		$this->assertSame( array( 'title' => 'Hello', 'items' => array( 'one', 'two' ) ), $result['data']['page'] );
		$this->assertSame( 'Body', $result['body'] );
		$this->assertSame( array(), Page_Markdown::parse_yaml( 'invalid: [unterminated' ) );
	}

	public function test_private_commonmark_renders_headings_and_gfm(): void {
		$html = Page_Markdown::to_html( "# Hello World\n\n| A | B |\n| --- | --- |\n| One | Two |\n\n- [x] Done\n\n~~Removed~~\n" );
		$this->assertStringContainsString( 'id="hello-world"', $html );
		$this->assertStringContainsString( '<table>', $html );
		$this->assertStringContainsString( '<input', $html );
		$this->assertStringContainsString( '<del>Removed</del>', $html );
	}
}
