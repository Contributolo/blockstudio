<?php
/**
 * Group renderer trait.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Renders core/group blocks.
 */
trait Group_Renderer {

	/**
	 * Render core/group block.
	 *
	 * @param array  $attrs         The attributes.
	 * @param string $inner_content The inner content.
	 *
	 * @return array The block array.
	 */
	public function render_group( array $attrs, string $inner_content ): array {
		$inner_blocks = Block_Tags::parse_inner_blocks( $inner_content );
		$tag          = 'div';

		// Match the HTML elements offered by the core/group editor setting.
		if ( isset( $attrs['tagName'] ) ) {
			$tag_name = is_string( $attrs['tagName'] ) ? strtolower( trim( $attrs['tagName'] ) ) : '';
			if ( in_array( $tag_name, array( 'header', 'main', 'section', 'article', 'aside', 'footer' ), true ) ) {
				$tag              = $tag_name;
				$attrs['tagName'] = $tag_name;
			} elseif ( 'div' !== $tag_name ) {
				unset( $attrs['tagName'] );
			}
		}

		// Row and stack variants share the core/group renderer.
		$class = 'wp-block-group';
		if ( isset( $attrs['layout'] ) ) {
			if ( is_string( $attrs['layout'] ) ) {
				$attrs['layout'] = json_decode( $attrs['layout'], true );
			}
			if ( isset( $attrs['layout']['type'] ) && 'flex' === $attrs['layout']['type'] ) {
				$class .= ' is-layout-flex';
				if ( isset( $attrs['layout']['orientation'] ) && 'vertical' === $attrs['layout']['orientation'] ) {
					$class .= ' is-vertical';
				}
			}
		}

		$content = array( '<' . $tag . ' class="' . $class . '">' );
		foreach ( $inner_blocks as $block ) {
			$content[] = null;
		}
		$content[] = '</' . $tag . '>';

		return array(
			'blockName'    => 'core/group',
			'attrs'        => $attrs,
			'innerBlocks'  => $inner_blocks,
			'innerHTML'    => '<' . $tag . ' class="' . $class . '"></' . $tag . '>',
			'innerContent' => $content,
		);
	}
}
