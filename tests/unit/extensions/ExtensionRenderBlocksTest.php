<?php

use Blockstudio\Attribute_Builder;
use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Extensions;
use PHPUnit\Framework\TestCase;

/**
 * Which blocks the render_block filter of extensions touches.
 */
class ExtensionRenderBlocksTest extends TestCase {

	private ?array $extensions = null;

	protected function setUp(): void {
		parent::setUp();
		$this->extensions = Build::extensions();

		$fields = array(
			array(
				'id'       => 'unitCss',
				'type'     => 'code',
				'language' => 'css',
			),
		);

		$this->set_extensions( array() );
		Block_Registry::instance()->register_extension(
			new WP_Block_Type(
				'unit-render/*',
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

	protected function tearDown(): void {
		$this->set_extensions( $this->extensions );
		parent::tearDown();
	}

	// The registry has no API to remove an extension again.
	private function set_extensions( array $extensions ): void {
		( new ReflectionProperty( Block_Registry::class, 'extensions' ) )->setValue( Block_Registry::instance(), $extensions );
	}

	private function render( string $name, array $attrs, string $html ): string {
		return Extensions::render_blocks(
			$html,
			array(
				'blockName' => $name,
				'attrs'     => $attrs,
			)
		);
	}

	public function test_unmatched_block_passes_through_unchanged(): void {
		$html = '<p class="has-text-align-center" style="color:red">Text</p>';

		$this->assertSame( $html, $this->render( 'core/paragraph', array(), $html ) );
		$this->assertSame( $html, $this->render( 'core/paragraph', array( 'align' => 'center' ), $html ) );
	}

	public function test_unmatched_block_ignores_stale_code_selector_values(): void {
		$html = '<p>Text</p>';

		$this->assertSame(
			$html,
			$this->render(
				'core/paragraph',
				array( 'blockstudio' => array( 'attributes' => array( 'unitCss' => '%selector% { color: red; }' ) ) ),
				$html
			)
		);
	}

	public function test_code_selector_on_matched_block_scopes_the_wrapper(): void {
		$output = $this->render(
			'unit-render/block',
			array( 'blockstudio' => array( 'attributes' => array( 'unitCss' => '%selector% { color: red; }' ) ) ),
			'<p>Text</p>'
		);

		$tags = new WP_HTML_Tag_Processor( $output );
		$this->assertTrue( $tags->next_tag( 'p' ), $output );

		$selector = (string) $tags->get_attribute( 'data-assets' );
		$this->assertMatchesRegularExpression( '/^blockstudio-[a-f0-9]{12}$/', $selector );
		$this->assertStringContainsString( "[data-assets='$selector']", $output );
		$this->assertStringContainsString( 'color: red', $output );
	}
}
