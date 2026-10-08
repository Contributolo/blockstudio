<?php

use Blockstudio\Blade_Renderer;
use Blockstudio\Template_Compiler;
use PHPUnit\Framework\TestCase;

/**
 * Blade page, pattern and Site Template sources compile through
 * illuminate/view directly, which jenssegers/blade 2 cannot do with
 * illuminate/view 10 and later.
 */
class BladeRendererTest extends TestCase {

	private string $root;

	protected function setUp(): void {
		if ( ! class_exists( 'Illuminate\View\Factory' ) ) {
			$this->markTestSkipped( 'illuminate/view is not installed in the test theme.' );
		}

		$this->root = trailingslashit( get_temp_dir() ) . 'blockstudio-blade-' . wp_generate_uuid4();
		wp_mkdir_p( $this->root . '/partials' );
		file_put_contents(
			$this->root . '/page.blade.php',
			"<main>@include('partials.title', ['title' => 'Tom & Jerry'])@if(\$count > 1)<p>{{ \$count }} items</p>@endif</main>"
		);
		file_put_contents( $this->root . '/partials/title.blade.php', '<h1>{{ $title }}</h1>' );
	}

	protected function tearDown(): void {
		if ( isset( $this->root ) && is_dir( $this->root ) ) {
			\Blockstudio\Files::delete_all_files( $this->root );
		}
	}

	public function test_views_render_with_data_and_dot_notation_includes(): void {
		$this->assertTrue( Blade_Renderer::available() );
		$this->assertSame(
			'<main><h1>Tom &amp; Jerry</h1><p>3 items</p></main>',
			Blade_Renderer::render( $this->root, 'page', array( 'count' => 3 ) )
		);
		$this->assertSame(
			'<main><h1>Tom &amp; Jerry</h1></main>',
			Blade_Renderer::render( $this->root, 'page', array( 'count' => 1 ) )
		);
	}

	public function test_template_sources_compile_through_the_renderer(): void {
		file_put_contents( $this->root . '/static.blade.php', "@php(\$items = ['a', 'b'])<ul>@foreach(\$items as \$item)<li>{{ strtoupper(\$item) }}</li>@endforeach</ul>" );

		$this->assertSame(
			'<ul><li>A</li><li>B</li></ul>',
			Template_Compiler::compile( $this->root . '/static.blade.php' )
		);
	}
}
