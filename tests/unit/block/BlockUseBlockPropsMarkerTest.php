<?php

use Blockstudio\Block;
use PHPUnit\Framework\Attributes\DataProvider;
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

	public function test_frontend_cleanup_keeps_non_ascii_text_as_utf8(): void {
		$output = $this->replace(
			'<div useBlockProps class="x" title="Grüße"><p>مرحبا – 日本語 &amp; ü</p></div>'
		);

		$this->assertStringContainsString( '<p>مرحبا – 日本語 &amp; ü</p>', $output );
		$this->assertStringContainsString( 'title="Grüße"', $output );
		$this->assertStringNotContainsString( '&#', $output );
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

	/**
	 * @return array<string, array{0:string}>
	 */
	public static function marker_spellings(): array {
		return array(
			'bare'               => array( 'useBlockProps' ),
			'self closing slash' => array( 'useBlockProps/' ),
			'newline'            => array( "\nuseBlockProps\n" ),
			'tab'                => array( "\tuseBlockProps\t" ),
			'empty value'        => array( 'useBlockProps=""' ),
			'double quoted'      => array( 'useBlockProps="x"' ),
			'single quoted'      => array( "useBlockProps='x'" ),
			'unquoted'           => array( 'useBlockProps=x' ),
			'spaced equals'      => array( 'useBlockProps = "x"' ),
			'repeated'           => array( 'useBlockProps useBlockProps="y"' ),
		);
	}

	#[DataProvider( 'marker_spellings' )]
	public function test_frontend_reads_every_spelling_of_the_marker( string $spelling ): void {
		$output = $this->replace( '<section ' . $spelling . ' class="hero" id="intro"><p>Content</p></section>' );

		$this->assertSame( '<section class="hero" id="intro"><p>Content</p></section>', $output );
	}

	public function test_frontend_handles_nested_and_repeated_roots(): void {
		$this->assertSame(
			'<div><div>n</div></div>',
			$this->replace( '<div useBlockProps><div useBlockProps>n</div></div>' )
		);
		$this->assertSame(
			'<div>a</div><div>b</div>',
			$this->replace( '<div useBlockProps>a</div><div useBlockProps>b</div>' )
		);
	}

	public function test_frontend_applies_anchor_and_selector_to_the_marked_root_only(): void {
		$output = Block::replace_components(
			'<div class="hero" useBlockProps><p>useBlockProps</p></div>',
			'',
			false,
			(object) array( 'attributes' => array() ),
			array(),
			array( 'anchor' => 'my-anchor' ),
			array(
				'hasCodeSelector'     => true,
				'selectorAttributeId' => 'blockstudio-abc',
			)
		);
		$tags   = $this->tags( $output );

		$this->assertSame( 'hero', $tags[0]['attributes']['class'] ?? null );
		$this->assertSame( 'my-anchor', $tags[0]['attributes']['id'] ?? null );
		$this->assertSame( 'blockstudio-abc', $tags[0]['attributes']['data-assets'] ?? null );
		$this->assertArrayNotHasKey( 'useblockprops', $tags[0]['attributes'] );
		$this->assertSame( array(), $tags[1]['attributes'] );
		$this->assertStringContainsString( '<p>useBlockProps</p>', $output );
	}

	public function test_frontend_ignores_a_marker_that_only_sits_in_script_comment_or_textarea(): void {
		$this->assertSame(
			'<div>x</div>',
			$this->replace( '<script>var a = "<div useBlockProps>";</script><!-- <div useBlockProps> --><div useBlockProps>x</div>' )
		);

		$html = '<textarea><div useBlockProps></textarea><div class="r">x</div>';
		$this->assertSame( $html, $this->replace( $html ) );
	}

	public function test_frontend_keeps_the_marker_on_input_and_textarea_roots(): void {
		$this->assertSame(
			'<input useblockprops="true" type="text">',
			$this->replace( '<input useBlockProps type="text">' )
		);
		$this->assertSame(
			'<input useblockprops="true" type="text">',
			$this->replace( '<input useBlockProps="x" type="text">' )
		);
		$this->assertSame(
			'<textarea useblockprops="true">t</textarea>',
			$this->replace( '<textarea useBlockProps>t</textarea>' )
		);
	}

	public function test_frontend_renders_real_blocks_with_the_marker_on_nested_and_void_roots(): void {
		$render = static fn( string $name ) => Block::render(
			array(
				'blockstudio' => array(
					'name'       => $name,
					'attributes' => array(),
				),
			),
			'<p>inner</p>',
			'',
			''
		);

		$img = $render( 'blockstudio/component-useblockprops-img' );
		$this->assertIsString( $img );
		$tags = array_values( array_filter( $this->tags( $img ), static fn( array $tag ): bool => 'img' === $tag['tag'] ) );
		$this->assertCount( 1, $tags );
		$this->assertSame( 'blockstudio-component-useblockprops-img', $tags[0]['attributes']['id'] ?? null );
		$this->assertArrayNotHasKey( 'useblockprops', $tags[0]['attributes'] );

		foreach ( array( 'double', 'double-root', 'innerblocks-outer' ) as $suffix ) {
			$output = $render( 'blockstudio/component-useblockprops-' . $suffix );
			$this->assertIsString( $output, $suffix );
			foreach ( $this->tags( $output ) as $tag ) {
				$this->assertArrayNotHasKey( 'useblockprops', $tag['attributes'], $suffix );
			}
		}

		$double = $render( 'blockstudio/component-useblockprops-double' );
		$this->assertSame( 'blockstudio-component-useblockprops-double', $this->tags( (string) $double )[0]['attributes']['id'] ?? null );
		$this->assertStringContainsString( '<code>Block:', (string) $double );

		$outer = $render( 'blockstudio/component-useblockprops-innerblocks-outer' );
		$this->assertStringContainsString( '<p>inner</p>', (string) $outer );
	}
}
