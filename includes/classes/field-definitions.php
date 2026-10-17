<?php
/**
 * Shared field storage definitions.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Describes field storage keys without rendering or resolving populate callbacks.
 *
 * @since 7.7.5
 * @internal
 */
final class Field_Definitions {

	/**
	 * Collect each definition of a storage key, preserving source and order.
	 *
	 * @param array  $fields  Resolved fields.
	 * @param string $source  Block or extension.
	 * @param string $prefix  Group prefix.
	 * @param array  $parents Parent labels.
	 * @param bool   $hidden  Hidden ancestor.
	 * @return array<string, array<int, array>> Definitions by storage key.
	 */
	public static function collect( array $fields, string $source, string $prefix = '', array $parents = array(), bool $hidden = false ): array {
		$definitions = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$type      = is_string( $field['type'] ?? null ) ? $field['type'] : '';
			$id        = is_string( $field['id'] ?? null ) || is_int( $field['id'] ?? null ) ? (string) $field['id'] : '';
			$key       = '' === $prefix ? $id : $prefix . '_' . $id;
			$is_hidden = $hidden || ! empty( $field['hidden'] );
			$inner     = is_array( $field['attributes'] ?? null ) ? $field['attributes'] : array();

			if ( 'tabs' === $type ) {
				foreach ( is_array( $field['tabs'] ?? null ) ? $field['tabs'] : array() as $tab ) {
					$tab_fields  = is_array( $tab['attributes'] ?? null ) ? $tab['attributes'] : array();
					$definitions = self::combine( $definitions, self::collect( $tab_fields, $source, $prefix, $parents, $is_hidden ) );
				}
				continue;
			}
			if ( 'group' === $type ) {
				$definitions = self::combine(
					$definitions,
					self::collect(
						self::children( $inner ),
						$source,
						'' === $id ? $prefix : $key,
						'' === $id ? $parents : array_merge( $parents, array( self::label( $field, $id ) ) ),
						$is_hidden
					)
				);
				continue;
			}
			if ( '' === $id || '' === $type || 'message' === $type ) {
				continue;
			}
			$definitions[ $key ][] = array(
				'field'   => $field,
				'source'  => $source,
				'parents' => $parents,
				'hidden'  => $is_hidden,
			);
		}
		return $definitions;
	}

	/**
	 * Flatten anonymous groups and omit ID-bearing groups inside a container.
	 *
	 * @param array $fields Container children.
	 * @return array Supported child fields, in order.
	 */
	public static function children( array $fields ): array {
		$result = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( 'group' === ( $field['type'] ?? '' ) ) {
				if ( empty( $field['id'] ) && is_array( $field['attributes'] ?? null ) ) {
					$result = array_merge( $result, self::children( $field['attributes'] ) );
				}
				continue;
			}
			$result[] = $field;
		}
		return $result;
	}

	/**
	 * Keep the last block or extension definition of each root storage key.
	 *
	 * Repeater row definitions deliberately do not use this precedence.
	 *
	 * @param array $definitions Definitions by key.
	 * @return array Effective definitions by key.
	 */
	public static function latest( array $definitions ): array {
		return array_map( static fn( array $entries ): array => array_slice( $entries, -1 ), $definitions );
	}

	/**
	 * Combine definitions without discarding keys shared by two render paths.
	 *
	 * @param array $definitions First definitions.
	 * @param array $more        Additional definitions.
	 * @return array Combined definitions by key.
	 */
	public static function combine( array $definitions, array $more ): array {
		foreach ( $more as $key => $entries ) {
			$definitions[ $key ] = array_merge( $definitions[ $key ] ?? array(), $entries );
		}
		return $definitions;
	}

	/**
	 * Get the label used for a field definition.
	 *
	 * @param array  $field Field definition.
	 * @param string $id    Fallback storage key.
	 * @return string Label.
	 */
	public static function label( array $field, string $id ): string {
		foreach ( array( 'label', 'title' ) as $property ) {
			if ( is_string( $field[ $property ] ?? null ) && '' !== trim( $field[ $property ] ) ) {
				return trim( $field[ $property ] );
			}
		}
		return $id;
	}
}
