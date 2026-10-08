<?php
/**
 * Shortcode renderer trait.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Renders core/shortcode blocks.
 */
trait Shortcode_Renderer {

	/**
	 * Render core/shortcode block.
	 *
	 * The shortcode text is the block's saved content. The generic fallback
	 * parses inner content as nested block tags, which dropped it.
	 *
	 * @param array  $attrs         The attributes.
	 * @param string $inner_content The inner content.
	 *
	 * @return array The block array.
	 */
	public function render_shortcode( array $attrs, string $inner_content ): array {
		$html = trim( $inner_content );

		return array(
			'blockName'    => 'core/shortcode',
			'attrs'        => $attrs,
			'innerBlocks'  => array(),
			'innerHTML'    => $html,
			'innerContent' => array( $html ),
		);
	}
}
