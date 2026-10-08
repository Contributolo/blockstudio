<?php

use Blockstudio\Block_Discovery;
use Blockstudio\Build;
use Blockstudio\Files;
use PHPUnit\Framework\TestCase;

/**
 * Extension files as the documentation writes them: `extend` set to true,
 * the order at the top level, several files extending the same blocks.
 */
class ExtensionRegistrationTest extends TestCase {

	private string $tmp_dir;

	protected function setUp(): void {
		$this->tmp_dir = sys_get_temp_dir() . '/blockstudio-extension-registration-' . uniqid();
		mkdir( $this->tmp_dir . '/extensions', 0755, true );
	}

	protected function tearDown(): void {
		if ( is_dir( $this->tmp_dir ) ) {
			Files::delete_all_files( $this->tmp_dir );
		}
	}

	private function write_extension( string $file, array $json ): void {
		file_put_contents( $this->tmp_dir . '/extensions/' . $file, wp_json_encode( $json ) );
	}

	private function extension( string $id, array $blockstudio = array(), array $top = array() ): array {
		return $top + array(
			'name'        => 'unit-extension/*',
			'blockstudio' => $blockstudio + array(
				'extend'     => true,
				'attributes' => array(
					array(
						'id'   => $id,
						'type' => 'text',
					),
				),
			),
		);
	}

	/**
	 * @return array<string, WP_Block_Type> Registered unit extensions keyed by their field id.
	 */
	private function registered(): array {
		$found = array();

		foreach ( Build::extensions() as $extension ) {
			if ( 'unit-extension/*' !== $extension->name ) {
				continue;
			}
			foreach ( $extension->blockstudio['attributes'] ?? array() as $attribute ) {
				if ( is_string( $attribute['id'] ?? null ) ) {
					$found[ $attribute['id'] ] = $extension;
				}
			}
		}

		return $found;
	}

	public function test_extension_files_with_the_same_name_are_all_discovered(): void {
		$this->write_extension( 'color.json', $this->extension( 'unitColor' ) );
		$this->write_extension( 'spacing.json', $this->extension( 'unitSpacing' ) );

		$results = ( new Block_Discovery() )->discover( $this->tmp_dir, 'unit-extensions' );
		$fields  = array();
		foreach ( $results['registerable'] as $item ) {
			$this->assertSame( 'unit-extension/*', $item['block_json']['name'] );
			$fields[] = $item['block_json']['blockstudio']['attributes'][0]['id'];
		}
		sort( $fields );

		$this->assertSame( array( 'unitColor', 'unitSpacing' ), $fields );
	}

	public function test_documented_priority_and_group_reach_the_registered_extension(): void {
		$this->write_extension( 'top.json', $this->extension( 'unitTop', array( 'group' => 'styles' ), array( 'priority' => 7 ) ) );
		$this->write_extension(
			'nested.json',
			$this->extension(
				'unitNested',
				array( 'extend' => array( 'priority' => 3 ) ),
				array( 'priority' => 9 )
			)
		);
		$this->write_extension( 'plain.json', $this->extension( 'unitPlain' ) );

		Build::init( array( 'dir' => $this->tmp_dir ) );
		$registered = $this->registered();

		$this->assertSame( array( 'priority' => 7 ), $registered['unitTop']->blockstudio['extend'] ?? null );
		$this->assertSame( 'styles', $registered['unitTop']->blockstudio['group'] ?? null );
		$this->assertSame( array( 'priority' => 3 ), $registered['unitNested']->blockstudio['extend'] ?? null );
		$this->assertTrue( $registered['unitPlain']->blockstudio['extend'] ?? null );
	}

	public function test_the_extension_schema_accepts_the_documented_shape(): void {
		$schema = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/schemas/extend.json' ), true );
		$extend = $schema['properties']['blockstudio']['properties']['extend'] ?? array();

		$this->assertContains( 'boolean', (array) ( $extend['type'] ?? array() ) );
		$this->assertContains( 'object', (array) ( $extend['type'] ?? array() ) );
		$this->assertArrayHasKey( 'priority', $extend['properties'] ?? array() );
		$this->assertArrayHasKey( 'group', $schema['properties']['blockstudio']['properties'] );
		$this->assertSame( 'number', $schema['properties']['priority']['type'] ?? null );
	}
}
