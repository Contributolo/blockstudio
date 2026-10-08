<?php
/**
 * Static prerender build identity tests.
 *
 * @package Blockstudio
 */

use Blockstudio\Static_Prerender_Content_Hasher;
use Blockstudio\Static_Prerender_Runtime;
use PHPUnit\Framework\TestCase;

/**
 * A deployment takes an artifact's build id from the shared signature after
 * rendering and compares it with the map entry it reads back after
 * activation. Neither the build's own first render nor the opcode cache may
 * change what it reads.
 */
class StaticPrerenderBuildIdentityTest extends TestCase {

	private string $root;

	/**
	 * @var string[]
	 */
	private array $created_files = array();

	/**
	 * @var string[]
	 */
	private array $created_directories = array();

	protected function setUp(): void {
		$this->root = trailingslashit( get_temp_dir() ) . 'blockstudio-build-identity-' . wp_generate_uuid4();
		wp_mkdir_p( $this->root . '/cache' );
		file_put_contents( $this->root . '/wp-config.php', "<?php\n" );
		Static_Prerender_Content_Hasher::reset();
	}

	protected function tearDown(): void {
		foreach ( array_reverse( $this->created_files ) as $file ) {
			if ( is_file( $file ) ) {
				unlink( $file );
			}
		}
		foreach ( array_reverse( $this->created_directories ) as $directory ) {
			if ( is_dir( $directory ) ) {
				rmdir( $directory );
			}
		}
		$this->created_files       = array();
		$this->created_directories = array();
		Static_Prerender_Content_Hasher::reset();
		$this->remove_directory( $this->root );
	}

	public function test_compiling_bundled_ui_assets_does_not_move_the_shared_signature(): void {
		$before = Static_Prerender_Runtime::shared_signature();

		$dist = BLOCKSTUDIO_DIR . '/includes/ui/blocks/_dist';
		$this->create_directory( $dist );
		$suffix = substr( md5( wp_generate_uuid4() ), 0, 32 );
		$this->create_file( $dist . '/global-style-' . $suffix . '.css', '.bsui{color:red}' );
		$this->create_file( $dist . '/global-script-' . $suffix . '.js', 'void 0;' );
		$this->create_directory( BLOCKSTUDIO_DIR . '/includes/ui/blocks/button/root/_dist' );
		$this->create_file(
			BLOCKSTUDIO_DIR . '/includes/ui/blocks/button/root/_dist/style.inline-' . $suffix . '.css',
			'.btn{}'
		);
		Static_Prerender_Content_Hasher::reset();

		$this->assertSame( $before, Static_Prerender_Runtime::shared_signature() );
	}

	public function test_bundled_ui_asset_sources_change_the_shared_signature(): void {
		$before = Static_Prerender_Runtime::shared_signature();
		$source = BLOCKSTUDIO_DIR . '/includes/ui/blocks/zz-build-identity-' . wp_generate_uuid4() . '.css';

		$this->create_file( $source, '.first{}' );
		Static_Prerender_Content_Hasher::reset();
		$added = Static_Prerender_Runtime::shared_signature();

		file_put_contents( $source, '.second{}' );
		Static_Prerender_Content_Hasher::reset();
		$edited = Static_Prerender_Runtime::shared_signature();

		$this->assertNotSame( $before, $added );
		$this->assertNotSame( $added, $edited );
	}

	public function test_activation_reads_back_the_entry_it_installed_with_opcache_on(): void {
		if ( ! extension_loaded( 'Zend OPcache' ) ) {
			$this->markTestSkipped( 'The opcode cache extension is not loaded.' );
		}

		$script = $this->root . '/activate-twice.php';
		file_put_contents( $script, $this->activation_script() );

		$command = implode(
			' ',
			array(
				escapeshellarg( PHP_BINARY ),
				'-d opcache.enable=1',
				'-d opcache.enable_cli=1',
				'-d opcache.validate_timestamps=1',
				'-d opcache.revalidate_freq=60',
				'-d opcache.file_update_protection=0',
				'-d opcache.file_cache=',
				escapeshellarg( $script ),
				escapeshellarg( ABSPATH . 'wp-load.php' ),
				escapeshellarg( (string) ( $_SERVER['HTTP_HOST'] ?? 'localhost' ) ),
				escapeshellarg( $this->root ),
				'2>&1',
			)
		);
		$output = (string) shell_exec( $command );

		$this->assertSame( 1, preg_match( '/^RESULT (\{.*\})$/m', $output, $match ), $output );
		$result = json_decode( $match[1], true );
		$this->assertTrue( $result['opcache'], 'The subprocess must run with the opcode cache on.' );
		$this->assertTrue( $result['installed'] );
		$this->assertSame( str_repeat( '1', 32 ), $result['first'] );
		$this->assertSame( str_repeat( '2', 32 ), $result['second'] );
	}

	private function activation_script(): string {
		return <<<'PHP'
<?php
$_SERVER['HTTP_HOST']   = $argv[2];
$_SERVER['REQUEST_URI'] = '/';
require $argv[1];

$root = $argv[3];
add_filter( 'blockstudio/cache/dir', static fn(): string => $root . '/runtime-cache' );
add_filter( 'blockstudio/cache/site_key', static fn(): string => 'unit-build-identity' );
add_filter( 'blockstudio/performance/staticPrerender/enabled', '__return_true' );
add_filter( 'blockstudio/performance/staticPrerender/earlyServe', '__return_true' );
\Blockstudio\Settings::reset();
\Blockstudio\Runtime_Settings::reset();
\Blockstudio\Static_Prerender_Early_Serve::override_content_dir_for_testing( $root );
\Blockstudio\Static_Prerender_Early_Serve::override_config_path_for_testing( $root . '/wp-config.php' );

$site = \Blockstudio\Static_Prerender_Early_Serve::current_site_identity();
$key  = str_repeat( 'a', 64 );
file_put_contents( $root . '/cache/' . $key . '.html', '<html>Route</html>' );

$entry = array(
	'host'            => $site['host'],
	'home_path'       => $site['home_path'],
	'site_id'         => get_current_blog_id(),
	'mode'            => 'graph',
	'build_id'        => str_repeat( '1', 32 ),
	'signature'       => str_repeat( 'c', 32 ),
	'ttl'             => 3600,
	'serve_logged_in' => false,
	'dynamic'         => array(),
	'routes'          => array( $site['home_path'] => $key ),
);

$installed = \Blockstudio\Static_Prerender_Early_Serve::install_artifact_entry( $entry, $root . '/cache' );
$first     = \Blockstudio\Static_Prerender_Early_Serve::installed_map_entries()[ $site['key'] ]['build_id'] ?? null;

$entry['build_id'] = str_repeat( '2', 32 );
$installed         = \Blockstudio\Static_Prerender_Early_Serve::install_artifact_entry( $entry, $root . '/cache' ) && $installed;
$second            = \Blockstudio\Static_Prerender_Early_Serve::installed_map_entries()[ $site['key'] ]['build_id'] ?? null;
$status            = function_exists( 'opcache_get_status' ) ? opcache_get_status( false ) : false;

echo 'RESULT ' . wp_json_encode(
	array(
		'installed' => $installed,
		'first'     => $first,
		'second'    => $second,
		'opcache'   => is_array( $status ) && ! empty( $status['opcache_enabled'] ),
	)
) . "\n";
PHP;
	}

	private function create_directory( string $directory ): void {
		if ( is_dir( $directory ) ) {
			return;
		}
		$this->assertTrue( wp_mkdir_p( $directory ) );
		$this->created_directories[] = $directory;
	}

	private function create_file( string $file, string $contents ): void {
		$this->assertNotFalse( file_put_contents( $file, $contents ) );
		$this->created_files[] = $file;
	}

	private function remove_directory( string $directory ): void {
		if ( ! is_dir( $directory ) ) {
			return;
		}

		$items = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $directory, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $items as $item ) {
			if ( $item->isDir() ) {
				rmdir( $item->getPathname() );
			} else {
				unlink( $item->getPathname() );
			}
		}
		rmdir( $directory );
	}
}
