<?php

use Blockstudio\Rest;
use Blockstudio\Utils;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class IconSetPathTest extends TestCase {

	private const FIXTURE_SET = '../../tests/unit/icons/fixtures/outside';

	private function svg( string $file, string $icon ): string {
		$set = json_decode( file_get_contents( BLOCKSTUDIO_DIR . '/includes/icons/' . $file . '.json' ), true );

		return $set[ $icon . '.svg' ];
	}

	public static function invalid_sets(): array {
		return array(
			'parent traversal' => array( self::FIXTURE_SET ),
			'absolute path'    => array( BLOCKSTUDIO_DIR . '/tests/unit/icons/fixtures/outside' ),
			'file extension'   => array( 'octicons.json' ),
			'subdirectory'     => array( 'fixtures/octicons' ),
			'backslash'        => array( 'fixtures\\octicons' ),
			'trailing newline' => array( "octicons\n" ),
			'null byte'        => array( "octicons\0" ),
			'uppercase'        => array( 'OCTICONS' ),
			'unknown set'      => array( 'no-such-set' ),
			'empty'            => array( '' ),
		);
	}

	public static function invalid_sets_after_sanitizing(): array {
		return array_diff_key(
			self::invalid_sets(),
			array(
				'trailing newline' => true,
				'null byte'        => true,
			)
		);
	}

	public function test_fixture_sits_where_the_traversal_set_points(): void {
		$this->assertFileExists( BLOCKSTUDIO_DIR . '/includes/icons/' . self::FIXTURE_SET . '.json' );
	}

	public function test_bundled_set_paths_match_every_shipped_file(): void {
		$root = BLOCKSTUDIO_DIR . '/includes/icons';
		foreach ( glob( $root . '/*.json' ) as $file ) {
			$this->assertSame( $file, Utils::icon_set_path( $root, basename( $file, '.json' ) ) );
		}
	}

	public function test_symlinks_cannot_escape_the_icon_directory(): void {
		$directory = sys_get_temp_dir() . '/bs-icon-path-' . uniqid();
		mkdir( $directory );
		$link = $directory . '/linked.json';
		try {
			if ( ! symlink( __DIR__ . '/fixtures/outside.json', $link ) ) {
				$this->markTestSkipped( 'Symlinks are unavailable.' );
			}
			$this->assertSame( '', Utils::icon_set_path( $directory, 'linked' ) );
		} finally {
			if ( is_link( $link ) ) {
				unlink( $link );
			}
			rmdir( $directory );
		}
	}

	public function test_invalid_cached_icon_is_not_served(): void {
		$key = 'blockstudio_1_icon_' . md5( self::FIXTURE_SET . 'probe' );
		set_transient( $key, '<svg id="outside"></svg>', 60 );
		try {
			$this->assertSame( '', bs_icon( array( 'set' => self::FIXTURE_SET, 'icon' => 'probe' ) ) );
		} finally {
			delete_transient( $key );
		}
	}

	public function test_malformed_saved_values_render_nothing(): void {
		foreach ( array( array(), array( 'set' => array(), 'icon' => 'heart' ), array( 'set' => 'octicons', 'icon' => array() ), array( 'set' => 'fontawesome-free', 'subSet' => array(), 'icon' => 'heart' ) ) as $value ) {
			$this->assertSame( '', bs_icon( $value ) );
		}
	}

	public function test_renders_icon_of_a_set(): void {
		$this->assertSame(
			$this->svg( 'octicons', 'alert-16' ),
			bs_icon(
				array(
					'set'  => 'octicons',
					'icon' => 'alert-16',
				)
			)
		);
	}

	public function test_renders_icon_of_a_sub_set(): void {
		$this->assertSame(
			$this->svg( 'fontawesome-free-solid', 'heart' ),
			bs_icon(
				array(
					'set'    => 'fontawesome-free',
					'subSet' => 'solid',
					'icon'   => 'heart',
				)
			)
		);
	}

	#[DataProvider( 'invalid_sets' )]
	public function test_invalid_set_renders_nothing( string $set ): void {
		foreach ( array( 'probe', 'alert-16' ) as $icon ) {
			$this->assertSame(
				'',
				bs_icon(
					array(
						'set'  => $set,
						'icon' => $icon,
					)
				)
			);
		}
	}

	#[DataProvider( 'invalid_sets' )]
	public function test_invalid_sub_set_renders_nothing( string $sub_set ): void {
		$this->assertSame(
			'',
			bs_icon(
				array(
					'set'    => 'fontawesome-free',
					'subSet' => $sub_set,
					'icon'   => 'heart',
				)
			)
		);
	}

	public function test_unknown_sub_set_of_a_valid_set_renders_nothing(): void {
		$this->assertSame(
			'',
			bs_icon(
				array(
					'set'    => 'fontawesome-free',
					'subSet' => 'no-such-sub-set',
					'icon'   => 'heart',
				)
			)
		);
	}

	public function test_rest_returns_the_set_file(): void {
		$icons = ( new Rest() )->icons( array( 'set' => 'octicons' ) );

		$this->assertIsArray( $icons );
		$this->assertSame( $this->svg( 'octicons', 'alert-16' ), $icons['alert-16.svg'] );
	}

	public function test_rest_returns_the_sub_set_file(): void {
		$icons = ( new Rest() )->icons(
			array(
				'set'    => 'fontawesome-free',
				'subSet' => 'solid',
			)
		);

		$this->assertIsArray( $icons );
		$this->assertSame( $this->svg( 'fontawesome-free-solid', 'heart' ), $icons['heart.svg'] );
	}

	#[DataProvider( 'invalid_sets_after_sanitizing' )]
	public function test_rest_rejects_invalid_set( string $set ): void {
		$result = ( new Rest() )->icons( array( 'set' => $set ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'Invalid icon set or subset', $result->get_error_message() );
	}

	#[DataProvider( 'invalid_sets' )]
	public function test_rest_rejects_invalid_sub_set( string $sub_set ): void {
		$result = ( new Rest() )->icons(
			array(
				'set'    => 'fontawesome-free',
				'subSet' => $sub_set,
			)
		);

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'Invalid icon set or subset', $result->get_error_message() );
	}

	public function test_rest_rejects_unknown_sub_set_of_a_valid_set(): void {
		$result = ( new Rest() )->icons(
			array(
				'set'    => 'fontawesome-free',
				'subSet' => 'no-such-sub-set',
			)
		);

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'Invalid icon set or subset', $result->get_error_message() );
	}
}
