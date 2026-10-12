<?php

use Blockstudio\Ui;
use PHPUnit\Framework\TestCase;

class BsuiAccessibilityTest extends TestCase {

	private function render( string $template, array $attributes = array(), array $context = array() ): string {
		$a = $attributes;

		ob_start();
		include BLOCKSTUDIO_DIR . '/includes/ui/blocks/' . $template . '/index.php';

		return (string) ob_get_clean();
	}

	private function source( string $template ): string {
		return (string) file_get_contents( BLOCKSTUDIO_DIR . '/includes/ui/blocks/' . $template . '/index.php' );
	}

	public function test_trigger_attributes_go_on_the_first_control(): void {
		$html = Ui::trigger(
			'<span class="lead"><button data-bsui-button>Open</button><a href="#">Other</a></span>',
			array(
				'aria-expanded' => 'false',
				'aria-haspopup' => 'dialog',
			)
		);

		$this->assertSame(
			'<span class="lead"><button aria-expanded="false" aria-haspopup="dialog" data-bsui-button>Open</button><a href="#">Other</a></span>',
			$html
		);
	}

	public function test_trigger_keeps_attributes_the_control_already_has(): void {
		$html = Ui::trigger(
			'<a href="#" aria-haspopup="menu">Open</a>',
			array( 'aria-haspopup' => 'dialog' )
		);

		$this->assertSame( '<a href="#" aria-haspopup="menu">Open</a>', $html );
	}

	public function test_trigger_without_a_control_is_unchanged(): void {
		$html = '<span>Plain text</span>';

		$this->assertSame( $html, Ui::trigger( $html, array( 'aria-expanded' => 'false' ) ) );
	}

	public function test_disclosure_triggers_put_aria_state_on_the_button(): void {
		$triggers = array(
			'alert-dialog/trigger' => 'bsui/alert-dialog',
			'collapsible/trigger'  => 'bsui/collapsible',
			'drawer/trigger'       => 'bsui/drawer',
			'menu/trigger'         => 'bsui/menu',
			'popover/trigger'      => 'bsui/popover',
		);

		foreach ( $triggers as $template => $namespace ) {
			$output = $this->render( $template, array( 'trigger' => '<button data-bsui-button>Open</button>' ) );
			$wrapper = substr( $output, 0, (int) strpos( $output, '>' ) );

			$this->assertStringNotContainsString( 'aria-', $wrapper, $template );
			$this->assertStringContainsString(
				'data-wp-bind--aria-expanded="' . $namespace . '::state.ariaExpanded"',
				$output,
				$template
			);
			$this->assertMatchesRegularExpression( '/<button[^>]* aria-expanded="(true|false)"/', $output, $template );
		}

		$menu = $this->render( 'menu/trigger', array( 'trigger' => '<button>Open</button>' ) );
		$this->assertStringContainsString( 'aria-haspopup="menu"', $menu );
		$this->assertStringContainsString( 'data-wp-bind--id="bsui/menu::context.triggerId"', $menu );

		$dialog = $this->render( 'dialog/trigger', array( 'trigger' => '<button>Open</button>' ) );
		$this->assertStringContainsString( '<button aria-haspopup="dialog">', $dialog );
	}

	public function test_choice_controls_are_named_by_their_label(): void {
		foreach ( array( 'checkbox/root', 'switch/root', 'radio-group/item' ) as $template ) {
			$source = $this->source( $template );

			$this->assertStringContainsString( 'id="<?php echo esc_attr( $control ); ?>"', $source, $template );
			$this->assertSame( 2, substr_count( $source, "'for' => \$control" ), $template );
		}

		$label = $this->render(
			'label/root',
			array(
				'for'  => 'bsui-checkbox-7',
				'text' => 'Accept',
			)
		);
		$this->assertStringContainsString( 'for="bsui-checkbox-7"', $label );
	}

	public function test_list_and_table_containers_have_no_wrapper_between_their_rows(): void {
		$this->assertStringContainsString( '<InnerBlocks tag="ol"', $this->source( 'breadcrumb/root' ) );
		$this->assertStringContainsString( '<InnerBlocks tag="ul"', $this->source( 'pagination/root' ) );
		$this->assertStringContainsString( '<InnerBlocks tag="ul"', $this->source( 'navigation-menu/root' ) );

		foreach ( array( 'table/root' => 'table', 'table/header' => 'tr', 'table/body' => 'tbody', 'table/row' => 'tr' ) as $template => $tag ) {
			$source = $this->source( $template );

			$this->assertMatchesRegularExpression( '/<InnerBlocks\s+tag="' . $tag . '"/', $source, $template );
			$this->assertStringNotContainsString( '<' . $tag . '>', $source, $template );
		}
	}

	public function test_inner_blocks_tag_replaces_the_default_wrapper(): void {
		$content = '<nav><InnerBlocks tag="ol" allowedBlocks="[]" /></nav>';

		Blockstudio\Block::replace_custom_tag( $content, '<li>One</li>', (object) array(), array(), 'InnerBlocks', 'InnerBlocks' );

		$this->assertStringContainsString( '<ol ', $content );
		$this->assertStringContainsString( '<li>One</li></ol>', $content );
		$this->assertStringNotContainsString( '<div', $content );
	}

	public function test_password_toggle_reports_its_state_and_input_accepts_names(): void {
		$output = $this->render(
			'password-input/root',
			array(
				'name'         => '',
				'nameAlt'      => '',
				'inputId'      => 'account-password',
				'ariaLabel'    => 'Password',
				'autocomplete' => 'new-password',
			)
		);

		$this->assertStringContainsString( 'id="account-password"', $output );
		$this->assertStringContainsString( 'aria-label="Password"', $output );
		$this->assertStringContainsString( 'autocomplete="new-password"', $output );
		$this->assertStringContainsString( 'aria-pressed="false"', $output );
		$this->assertStringContainsString( 'data-wp-bind--aria-pressed="state.ariaPressed"', $output );

		$plain = $this->render(
			'password-input/root',
			array(
				'name'    => '',
				'nameAlt' => '',
			)
		);
		$this->assertStringNotContainsString( 'autocomplete=', $plain );

		$input = $this->render(
			'input/root',
			array(
				'name'         => '',
				'nameAlt'      => '',
				'autocomplete' => 'email',
			)
		);
		$this->assertStringContainsString( 'autocomplete="email"', $input );
	}

	public function test_toggle_group_does_not_put_orientation_on_a_group(): void {
		$output = $this->render( 'toggle-group/root', array( 'orientation' => 'vertical' ) );

		$this->assertStringContainsString( 'role="group"', $output );
		$this->assertStringContainsString( 'data-orientation="vertical"', $output );
		$this->assertStringNotContainsString( 'aria-orientation', $output );
	}

	public function test_looping_indicators_stop_for_reduced_motion(): void {
		foreach ( array( 'spinner', 'skeleton' ) as $component ) {
			$css = (string) file_get_contents( BLOCKSTUDIO_DIR . '/includes/ui/blocks/' . $component . '/root/style.inline.css' );

			$this->assertMatchesRegularExpression(
				'/@media \(prefers-reduced-motion: reduce\) \{\s*\[data-bsui-' . $component . '\] \{\s*animation: none;/',
				$css,
				$component
			);
		}

		$this->assertStringContainsString( 'data-bsui-carousel-viewport data-bsui-focus tabindex="0"', $this->source( 'carousel/root' ) );
	}
}
