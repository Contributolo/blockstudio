<?php

use Blockstudio\Block_Registry;
use Blockstudio\Build;
use Blockstudio\Files;
use Blockstudio\Wpml_Config;
use PHPUnit\Framework\TestCase;

/**
 * Storage keys defined by a registered block and by its extensions, checked
 * against what the template and the extension renderer receive on render.
 */
class WpmlConfigRenderPathsTest extends TestCase {

	private string $name = 'wpml-test/conflicts';
	private string $directory;
	private array $extensions;

	protected function setUp(): void {
		$this->extensions = Build::extensions();
		$this->directory  = sys_get_temp_dir() . '/bs-wpml-conflicts-' . uniqid();
		wp_mkdir_p( $this->directory . '/block' );
		wp_mkdir_p( $this->directory . '/extensions' );

		$this->write(
			'block/block.json',
			array(
				'name'        => $this->name,
				'title'       => 'Conflicts',
				'blockstudio' => array(
					'attributes' => array(
						array( 'id' => 'tone', 'type' => 'text', 'label' => 'Tone' ),
						array( 'id' => 'size', 'type' => 'select', 'label' => 'Size', 'options' => array( $this->option( 'small' ) ) ),
						array( 'id' => 'note', 'type' => 'text', 'label' => 'Note' ),
						array( 'id' => 'cta', 'type' => 'link', 'label' => 'Button' ),
						array(
							'id'         => 'items',
							'type'       => 'repeater',
							'label'      => 'Items',
							'attributes' => array(
								array( 'id' => 'title', 'type' => 'text', 'label' => 'Title' ),
								array( 'id' => 'caption', 'type' => 'text', 'label' => 'Caption' ),
							),
						),
					),
				),
			)
		);
		file_put_contents(
			$this->directory . '/block/index.php',
			<<<'PHP'
<div class="wpml-test" data-template="<?php echo esc_attr( wp_json_encode( array( 'tone' => $a['tone'], 'note' => $a['note'], 'mood' => $a['mood'] ) ) ); ?>"></div>
PHP
		);
		// Discovery reads the extension files in path order.
		$this->write(
			'extensions/a-first.json',
			$this->extension(
				array(
					array( 'id' => 'tone', 'type' => 'select', 'options' => array( $this->option( 'warm' ) ), 'set' => $this->set( 'data-tone', 'tone' ) ),
					array( 'id' => 'size', 'type' => 'text' ),
					array( 'id' => 'note', 'type' => 'textarea', 'set' => $this->set( 'data-note', 'note' ) ),
					array( 'id' => 'cta', 'type' => 'link' ),
					array( 'id' => 'mood', 'type' => 'text', 'set' => $this->set( 'data-mood-text', 'mood' ) ),
					array(
						'id'         => 'items',
						'type'       => 'repeater',
						'attributes' => array(
							array( 'id' => 'title', 'type' => 'select', 'options' => array( $this->option( 'a' ) ) ),
						),
					),
				)
			)
		);
		$this->write(
			'extensions/b-second.json',
			$this->extension(
				array(
					array( 'id' => 'mood', 'type' => 'select', 'options' => array( $this->option( 'calm' ) ), 'set' => $this->set( 'data-mood', 'mood' ) ),
				)
			)
		);

		Build::init( array( 'dir' => $this->directory ) );
		register_block_type( Build::blocks()[ $this->name ] );
	}

	protected function tearDown(): void {
		if ( WP_Block_Type_Registry::get_instance()->is_registered( $this->name ) ) {
			unregister_block_type( $this->name );
		}
		Block_Registry::instance()->remove_block( $this->name );
		// The registry has no API to remove an extension again.
		( new ReflectionProperty( Block_Registry::class, 'extensions' ) )->setValue( Block_Registry::instance(), $this->extensions );
		Files::delete_all_files( $this->directory );
		parent::tearDown();
	}

	private function write( string $file, array $json ): void {
		file_put_contents( $this->directory . '/' . $file, wp_json_encode( $json ) );
	}

	private function option( string $value ): array {
		return array(
			'value' => $value,
			'label' => ucfirst( $value ),
		);
	}

	private function set( string $attribute, string $id ): array {
		return array(
			array(
				'attribute' => $attribute,
				'value'     => '{attributes.' . $id . '}',
			),
		);
	}

	private function extension( array $fields ): array {
		return array(
			'name'        => $this->name,
			'blockstudio' => array(
				'extend'     => true,
				'attributes' => $fields,
			),
		);
	}

	/**
	 * Render the block with stored values; return what the template received and the attributes of the root element.
	 */
	private function render( array $values ): array {
		$html = do_blocks( '<!-- wp:' . $this->name . ' ' . wp_json_encode( array( 'blockstudio' => array( 'attributes' => $values ) ) ) . ' /-->' );
		$tags = new WP_HTML_Tag_Processor( $html );

		$this->assertTrue( $tags->next_tag( array( 'class_name' => 'wpml-test' ) ), $html );

		$element = array();
		foreach ( array( 'data-tone', 'data-note', 'data-mood', 'data-mood-text' ) as $attribute ) {
			$element[ $attribute ] = $tags->get_attribute( $attribute );
		}

		return array( json_decode( (string) $tags->get_attribute( 'data-template' ), true ), $element );
	}

	public function test_the_registered_block_declares_agreeing_keys_and_reports_conflicting_ones(): void {
		$this->assertSame(
			array( 'tone', 'size', 'note', 'cta', 'mood', 'items', 'mood' ),
			array_column( bs_block_extension_fields( $this->name ), 'id' ),
			'the extensions in registration order'
		);

		$blocks  = Wpml_Config::registered_blocks();
		$section = Wpml_Config::section( array( $this->name => $blocks[ $this->name ] ) );

		$this->assertSame( array_column( bs_block_fields( $this->name ), 'id' ), array_column( $blocks[ $this->name ]['fields'], 'id' ) );
		$this->assertSame(
			array(
				'wpml-test/conflicts: tone (text in the block, select in an extension)',
				'wpml-test/conflicts: size (select in the block, text in an extension)',
				'wpml-test/conflicts: items/*/title (text in the block, select in an extension)',
			),
			$section['conflicts']
		);
		$this->assertSame( array(), $section['skipped'] );

		$expected = <<<'XML'
		<gutenberg-block type="wpml-test/conflicts" translate="1" label="Conflicts">
			<key name="blockstudio">
				<key name="attributes">
					<key name="note" label="Note" />
					<key name="cta">
						<key name="title" label="Button: Link text" />
						<key name="url" type="link" label="Button: URL" />
					</key>
					<key name="items">
						<key name="*">
							<key name="caption" label="Items: Caption" />
						</key>
					</key>
				</key>
			</key>
		</gutenberg-block>
XML;

		$this->assertStringContainsString( $expected, $section['xml'] );
	}

	public function test_the_template_and_the_extension_read_a_conflicting_key_with_their_own_definitions(): void {
		// The block's text control writes a string.
		[ $template, $element ] = $this->render( array( 'tone' => 'Hello' ) );

		$this->assertSame( 'Hello', $template['tone'] );
		$this->assertNull( $element['data-tone'], 'the extension reads it as a select option and finds none' );

		// The extension's select control writes an option.
		[ $template, $element ] = $this->render( array( 'tone' => $this->option( 'warm' ) ) );

		$this->assertSame( $this->option( 'warm' ), $template['tone'], 'the template gets the option object unchanged' );
		$this->assertSame( 'warm', $element['data-tone'] );
	}

	public function test_the_template_and_the_extension_read_an_agreeing_key_as_the_same_text(): void {
		[ $template, $element ] = $this->render( array( 'note' => 'Opening hours' ) );

		$this->assertSame( 'Opening hours', $template['note'] );
		$this->assertSame( 'Opening hours', $element['data-note'] );
	}

	public function test_the_template_and_the_extension_both_use_the_later_extension(): void {
		[ $template, $element ] = $this->render( array( 'mood' => $this->option( 'calm' ) ) );

		$this->assertSame( 'calm', $template['mood'], 'the template gets the option value of the later select' );
		$this->assertSame( 'calm', $element['data-mood'] );
		$this->assertNull( $element['data-mood-text'], 'the text field of the earlier extension is not applied' );
	}
}
