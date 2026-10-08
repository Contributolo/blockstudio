<?php

use Blockstudio\Block;
use PHPUnit\Framework\TestCase;

/**
 * The useBlockProps marker is an attribute name in a template's start tag.
 * Rendered text and attribute values that mention the word are content.
 */
class BlockUseBlockPropsMarkerTest extends TestCase {

	private function replace( string $content, bool $is_editor = false, array $attributes = array() ): string {
		return Block::replace_components(
			$content,
			'',
			$is_editor,
			(object) array( 'attributes' => array() ),
			$attributes,
			array(),
			array()
		);
	}

	/**
	 * @return array<int, array{tag:string,attributes:array<string,string|true>}>
	 */
	private function tags( string $html ): array {
		$processor = new WP_HTML_Tag_Processor( $html );
		$tags      = array();

		while ( $processor->next_tag() ) {
			$attributes = array();
			foreach ( $processor->get_attribute_names_with_prefix( '' ) ?? array() as $name ) {
				$attributes[ $name ] = $processor->get_attribute( $name );
			}
			$tags[] = array(
				'tag'        => strtolower( $processor->get_tag() ),
				'attributes' => $attributes,
			);
		}

		return $tags;
	}

	public function test_frontend_keeps_the_word_in_text_and_attribute_values(): void {
		$output = $this->replace(
			'<div useBlockProps class="docs" title="How useBlockProps works"><p>Call useBlockProps on the root.</p></div>'
		);
		$tags   = $this->tags( $output );

		$this->assertStringContainsString( 'Call useBlockProps on the root.', $output );
		$this->assertCount( 2, $tags );
		$this->assertSame( 'div', $tags[0]['tag'] );
		$this->assertSame( 'How useBlockProps works', $tags[0]['attributes']['title'] ?? null );
		$this->assertArrayNotHasKey( 'useblockprops', $tags[0]['attributes'] );
		$this->assertStringContainsString( 'docs', (string) ( $tags[0]['attributes']['class'] ?? '' ) );
		$this->assertSame( 'p', $tags[1]['tag'] );
		$this->assertSame( array(), $tags[1]['attributes'] );
	}

	public function test_frontend_richtext_content_that_mentions_the_marker_renders_literally(): void {
		$output = Block::render(
			array(
				'blockstudio' => array(
					'name'       => 'blockstudio/component-useblockprops-richtext-default',
					'attributes' => array( 'richtext' => 'Call useBlockProps on the root.' ),
				),
			),
			'',
			'',
			''
		);

		$this->assertIsString( $output );
		$this->assertStringContainsString( 'Call useBlockProps on the root.', $output );
		$this->assertStringNotContainsString( 'useblockprops="true"', $output );
		$this->assertStringNotContainsString( '<RichText', $output );

		$tags = array_values(
			array_filter(
				$this->tags( $output ),
				static fn( array $tag ): bool => 'h1' === $tag['tag']
			)
		);
		$this->assertCount( 1, $tags );
		$this->assertArrayNotHasKey( 'useblockprops', $tags[0]['attributes'] );
		$this->assertSame( 'blockstudio-component-useblockprops-richtext-default', $tags[0]['attributes']['id'] ?? null );
	}

	public function test_frontend_block_without_a_marker_keeps_a_mention_in_its_text(): void {
		$output = $this->replace( '<div class="docs"><p>Wrap the root in useBlockProps to get block classes.</p></div>' );

		$this->assertSame( '<div class="docs"><p>Wrap the root in useBlockProps to get block classes.</p></div>', $output );
	}

	public function test_frontend_marker_output_is_unchanged_for_templates_without_mentions(): void {
		$this->assertSame(
			'<div class="hero" id="intro"><p>Content</p></div>',
			$this->replace( '<div useBlockProps class="hero" id="intro"><p>Content</p></div>' )
		);
		$this->assertSame(
			'<img src="https://example.com/a.png" alt="A">',
			$this->replace( '<img useBlockProps src="https://example.com/a.png" alt="A" />' )
		);
	}

	public function test_editor_marks_only_the_root_attribute(): void {
		$output = $this->replace(
			'<div useBlockProps class="docs" title="How useBlockProps works"><p>Call useBlockProps on the root.</p></div>',
			true
		);
		$tags   = $this->tags( $output );

		$this->assertStringContainsString( 'Call useBlockProps on the root.', $output );
		$this->assertSame( 'true', $tags[0]['attributes']['useblockprops'] ?? null );
		$this->assertSame( 'How useBlockProps works', $tags[0]['attributes']['title'] ?? null );
		$this->assertArrayNotHasKey( 'useblockprops', $tags[1]['attributes'] );
		$this->assertSame( 1, substr_count( $output, 'useblockprops="true"' ) );
	}

	public function test_editor_marks_a_root_written_after_other_attributes(): void {
		$output = $this->replace( '<section class="hero" useBlockProps data-label="useBlockProps"><InnerBlocks /></section>', true );
		$tags   = $this->tags( $output );

		$this->assertSame( 'true', $tags[0]['attributes']['useblockprops'] ?? null );
		$this->assertSame( 'useBlockProps', $tags[0]['attributes']['data-label'] ?? null );
	}
}
