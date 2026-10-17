<?php
/**
 * WPML media class.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

use WP_Post;

/**
 * Reports the attachments of Blockstudio fields to WPML Media Translation.
 *
 * WPML puts the texts of the media a post uses (title, caption, alt text, and
 * description) into the translation job of the post, and writes the
 * translated texts to the attachment of the target language when the job is
 * completed. It finds that media in img tags in the content, galleries, the
 * featured image, and the blocks it knows. Blockstudio stores attachment IDs
 * in the block comment, so WPML finds none of them.
 *
 * WPML passes the IDs it found, with the post ID, through the
 * wpml_ids_of_media_used_in_post filter. This class adds the attachments
 * that Blockstudio fields store in the blocks of the post content: the same
 * fields the block editor preloads as media (files fields, and attributes
 * fields with media), in groups, tabs, repeater rows, and inner blocks, and
 * the fields of extensions, which store their values in the attributes of
 * the extended block. IDs that are not attachments are left out.
 *
 * Plugin::init() calls register() on wpml_loaded, so the class is loaded only
 * with WPML.
 *
 * @since 7.7.5
 */
final class Wpml_Media {

	/**
	 * Add the filter that reports the attachments of Blockstudio fields.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_filter( 'wpml_ids_of_media_used_in_post', array( self::class, 'add_media_ids' ), 10, 2 );
	}

	/**
	 * Add the attachments of Blockstudio fields in a post to the media IDs WPML found.
	 *
	 * @param mixed $ids     Media IDs found by WPML.
	 * @param mixed $post_id Post ID.
	 *
	 * @return mixed The IDs, followed by the attachments that are not among them yet.
	 */
	public static function add_media_ids( $ids, $post_id = 0 ) {
		if ( ! is_array( $ids ) || (int) $post_id <= 0 ) {
			return $ids;
		}
		$post = get_post( (int) $post_id );

		if ( ! is_array( $ids ) || ! $post instanceof WP_Post || ! has_blocks( $post->post_content ) ) {
			return $ids;
		}

		$known = array_map( 'intval', $ids );

		foreach ( self::ids( parse_blocks( $post->post_content ) ) as $id ) {
			if ( ! in_array( $id, $known, true ) && 'attachment' === get_post_type( $id ) ) {
				$ids[]   = $id;
				$known[] = $id;
			}
		}

		return $ids;
	}

	/**
	 * Collect the media IDs that Blockstudio fields store in parsed blocks.
	 *
	 * @param array $blocks Parsed blocks, as from parse_blocks().
	 *
	 * @return array<int, int> Media IDs keyed by ID, in the order they appear.
	 */
	public static function ids( array $blocks ): array {
		$registered  = Build::blocks();
		$definitions = array();
		return self::collect( $blocks, $registered, $definitions );
	}

	/**
	 * Walk children using one registry snapshot and field map per block name.
	 *
	 * @param array $blocks      Parsed blocks.
	 * @param array $registered  Blockstudio block registry.
	 * @param array $definitions Resolved definitions, passed by reference.
	 * @return array Attachment IDs keyed by ID.
	 */
	private static function collect( array $blocks, array $registered, array &$definitions ): array {
		$ids = array();

		foreach ( $blocks as $block ) {
			$name   = is_string( $block['blockName'] ?? null ) ? $block['blockName'] : '';
			$attrs  = is_array( $block['attrs'] ?? null ) ? $block['attrs'] : array();
			$values = $attrs['blockstudio']['attributes'] ?? array();

			if ( '' !== $name && is_array( $values ) ) {
				$definitions[ $name ] ??= array_merge(
					is_array( $registered[ $name ]->blockstudio['attributes'] ?? null ) ? $registered[ $name ]->blockstudio['attributes'] : array(),
					\bs_block_extension_fields( $name )
				);
				if ( isset( $registered[ $name ] ) ) {
					$keys   = Field_Definitions::collect( $definitions[ $name ], 'block' );
					$values = array_replace( array_intersect_key( $attrs, $keys ), $values );
				}
				$ids = array_replace( $ids, Blocks::get_media_ids_from_attributes( $values, $definitions[ $name ] ) );
			}

			if ( is_array( $block['innerBlocks'] ?? null ) ) {
				$ids = array_replace( $ids, self::collect( $block['innerBlocks'], $registered, $definitions ) );
			}
		}

		return $ids;
	}
}
