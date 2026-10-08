<?php
/**
 * List renderer trait.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Renders core/list blocks.
 */
trait List_Renderer {

	/**
	 * Render core/list block.
	 *
	 * Items are split by depth, so a nested list becomes a core/list inner
	 * block of its core/list-item, the shape the editor saves. A class on the
	 * list or an item becomes its className.
	 *
	 * @param array  $attrs         The attributes.
	 * @param string $inner_content The inner content.
	 *
	 * @return array The block array.
	 */
	public function render_list( array $attrs, string $inner_content ): array {
		$ordered    = ! empty( $attrs['ordered'] );
		$class_name = self::list_class_name( $attrs );
		$items      = array();

		foreach ( self::list_item_tags( $inner_content ) as $item ) {
			$items[] = $this->list_item_block( $item['attributes'], $item['content'] );
		}

		$tag        = $ordered ? 'ol' : 'ul';
		$class      = '' === $class_name ? 'wp-block-list' : 'wp-block-list ' . $class_name;
		$open       = "<{$tag} class=\"" . esc_attr( $class ) . '">';
		$content    = array( $open );
		$list_attrs = array( 'ordered' => $ordered );

		if ( '' !== $class_name ) {
			$list_attrs['className'] = $class_name;
		}

		foreach ( $items as $item ) {
			$content[] = null;
		}
		$content[] = "</{$tag}>";

		return array(
			'blockName'    => 'core/list',
			'attrs'        => $list_attrs,
			'innerBlocks'  => $items,
			'innerHTML'    => $open . "</{$tag}>",
			'innerContent' => $content,
		);
	}

	/**
	 * Build one core/list-item, moving nested lists into inner blocks.
	 *
	 * @param string $attributes Raw attribute text of the <li> tag.
	 * @param string $content    Inner HTML of the item.
	 *
	 * @return array The block array.
	 */
	private function list_item_block( string $attributes, string $content ): array {
		$class_name = self::list_class_name( array( 'class' => self::list_attribute_value( $attributes, 'class' ) ) );
		$open       = '' === $class_name ? '<li>' : '<li class="' . esc_attr( $class_name ) . '">';
		$item_attrs = '' === $class_name ? array() : array( 'className' => $class_name );
		$lists      = self::list_nested_lists( $content );

		if ( array() === $lists ) {
			return array(
				'blockName'    => 'core/list-item',
				'attrs'        => $item_attrs,
				'innerBlocks'  => array(),
				'innerHTML'    => $open . $content . '</li>',
				'innerContent' => array( $open . $content . '</li>' ),
			);
		}

		$inner_blocks  = array();
		$inner_content = array();
		$text          = '';
		$offset        = 0;

		foreach ( $lists as $index => $list ) {
			$segment = substr( $content, $offset, $list['start'] - $offset );
			$segment = '' === trim( $segment ) ? '' : ( 0 === $index ? rtrim( $segment ) : $segment );

			$inner_content[] = ( 0 === $index ? $open : '' ) . $segment;
			$inner_content[] = null;
			$text           .= $segment;
			$inner_blocks[]  = $this->render_list(
				array(
					'ordered' => 'ol' === $list['tag'],
					'class'   => self::list_attribute_value( $list['attributes'], 'class' ),
				),
				$list['inner']
			);
			$offset          = $list['end'];
		}

		$tail            = substr( $content, $offset );
		$tail            = '' === trim( $tail ) ? '' : $tail;
		$inner_content[] = $tail . '</li>';

		return array(
			'blockName'    => 'core/list-item',
			'attrs'        => $item_attrs,
			'innerBlocks'  => $inner_blocks,
			'innerHTML'    => $open . $text . $tail . '</li>',
			'innerContent' => $inner_content,
		);
	}

	/**
	 * Split list markup into its top-level items.
	 *
	 * @param string $html Inner HTML of a list.
	 *
	 * @return array<int, array{attributes: string, content: string}> Items.
	 */
	private static function list_item_tags( string $html ): array {
		$items = array();
		$depth = 0;
		$item  = null;

		if ( ! preg_match_all( '#<(/?)li\b([^>]*)>#i', $html, $tags, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
			return $items;
		}

		foreach ( $tags as $tag ) {
			$closing = '/' === $tag[1][0];
			$start   = $tag[0][1];
			$end     = $start + strlen( $tag[0][0] );

			if ( ! $closing ) {
				if ( 0 === $depth ) {
					$item = array(
						'attributes' => $tag[2][0],
						'start'      => $end,
					);
				}
				++$depth;
				continue;
			}

			--$depth;
			if ( 0 === $depth && null !== $item ) {
				$items[] = array(
					'attributes' => $item['attributes'],
					'content'    => substr( $html, $item['start'], $start - $item['start'] ),
				);
				$item    = null;
			}
			$depth = max( 0, $depth );
		}

		return $items;
	}

	/**
	 * Find the lists directly inside an item's HTML.
	 *
	 * @param string $html Inner HTML of a list item.
	 *
	 * @return array<int, array{tag: string, attributes: string, inner: string, start: int, end: int}> Lists in order.
	 */
	private static function list_nested_lists( string $html ): array {
		$lists = array();
		$depth = 0;
		$open  = null;

		if ( ! preg_match_all( '#<(/?)(ul|ol)\b([^>]*)>#i', $html, $tags, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
			return $lists;
		}

		foreach ( $tags as $tag ) {
			$closing = '/' === $tag[1][0];
			$start   = $tag[0][1];
			$end     = $start + strlen( $tag[0][0] );

			if ( ! $closing ) {
				if ( 0 === $depth ) {
					$open = array(
						'tag'        => strtolower( $tag[2][0] ),
						'attributes' => $tag[3][0],
						'start'      => $start,
						'inner'      => $end,
					);
				}
				++$depth;
				continue;
			}

			--$depth;
			if ( 0 === $depth && null !== $open ) {
				$lists[] = array(
					'tag'        => $open['tag'],
					'attributes' => $open['attributes'],
					'inner'      => substr( $html, $open['inner'], $start - $open['inner'] ),
					'start'      => $open['start'],
					'end'        => $end,
				);
				$open    = null;
			}
			$depth = max( 0, $depth );
		}

		return $lists;
	}

	/**
	 * Read the class a list or item asks for.
	 *
	 * @param array $attrs Attributes with `class` or `className`.
	 *
	 * @return string Class names, or an empty string.
	 */
	private static function list_class_name( array $attrs ): string {
		$class = $attrs['className'] ?? $attrs['class'] ?? '';

		if ( ! is_string( $class ) ) {
			return '';
		}

		$names = preg_split( '/\s+/', trim( $class ) );
		$names = array_filter(
			is_array( $names ) ? $names : array(),
			static fn( string $name ): bool => '' !== $name && 'wp-block-list' !== $name
		);

		return implode( ' ', array_unique( $names ) );
	}

	/**
	 * Read one attribute from raw tag attribute text.
	 *
	 * @param string $attributes Raw attribute text.
	 * @param string $name       Attribute name.
	 *
	 * @return string Decoded value, or an empty string.
	 */
	private static function list_attribute_value( string $attributes, string $name ): string {
		if ( ! preg_match( '/(?:^|\s)' . preg_quote( $name, '/' ) . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $attributes, $match ) ) {
			return '';
		}

		$value = $match[1] ?? '';
		if ( '' === $value ) {
			$value = $match[2] ?? '';
		}
		if ( '' === $value ) {
			$value = $match[3] ?? '';
		}

		return html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}
}
