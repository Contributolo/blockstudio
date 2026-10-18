<?php
/**
 * Block_Validator class.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

use WP_Block_Type_Registry;

/**
 * Check stored field values against the fields of a block and its extensions.
 *
 * The checks follow the render path: WordPress' attribute validation for
 * top-level attrs (WP_Block_Type::prepare_attributes_for_render()),
 * Block::transform() and Block::transform_attributes() for the block's own
 * fields, and Extensions::render_blocks() for the fields of matching
 * extensions. All of them read the attributes the attribute builder
 * registered, keyed by storage key, so groups, tabs, and repeater rows are laid
 * out the same way here. A value is reported when a render path drops it,
 * replaces it, or cannot read it. Values the renderer skips as empty and shapes
 * it normalises are not reported.
 *
 * @since 7.7.5
 */
class Block_Validator {

	/**
	 * Validate the attrs of one block.
	 *
	 * @param string $name  Block name.
	 * @param array  $attrs The block's attrs as parse_blocks() returns them.
	 *
	 * @return array|null Findings, or null when no fields apply to the block.
	 */
	public static function validate( string $name, array $attrs ): ?array {
		if ( null === bs_block_fields( $name ) && array() === bs_block_extension_fields( $name ) ) {
			return null;
		}

		$type        = WP_Block_Type_Registry::get_instance()->get_registered( $name );
		$is_block    = $type && is_array( $type->blockstudio ?? null );
		$block_atts  = $is_block ? self::field_attributes( is_array( $type->attributes ) ? $type->attributes : array() ) : array();
		$extension   = self::extension_attributes( $name );
		$definitions = $block_atts + $extension;
		$findings    = array();
		$stored      = array();

		if ( array_key_exists( 'blockstudio', $attrs ) ) {
			$container = $attrs['blockstudio'];

			if ( ! is_array( $container ) ) {
				$findings[] = self::finding( 'invalid_container', 'blockstudio', null, __( 'The blockstudio attribute must be an object.', 'blockstudio' ), $container, 'object' );
				$container  = array();
			}

			if ( array_key_exists( 'attributes', $container ) && ! is_array( $container['attributes'] ) ) {
				$findings[] = self::finding( 'invalid_container', 'blockstudio/attributes', null, __( 'The field values must be an object.', 'blockstudio' ), $container['attributes'], 'object' );
			} elseif ( is_array( $container['attributes'] ?? null ) ) {
				$stored = $container['attributes'];
			}

			if ( array_key_exists( 'disabled', $container ) && ! is_array( $container['disabled'] ) ) {
				$findings[] = self::finding( 'invalid_container', 'blockstudio/disabled', null, __( 'The list of disabled fields must be an array.', 'blockstudio' ), $container['disabled'], 'array' );
			}
		}

		$disabled = is_array( $attrs['blockstudio']['disabled'] ?? null ) ? $attrs['blockstudio']['disabled'] : array();
		$values   = array();

		foreach ( $stored as $key => $value ) {
			$values[ (string) $key ] = array( $value, false );
		}

		// Block::transform() also reads declared IDs from the top level of attrs; a nested value wins.
		if ( $is_block ) {
			foreach ( array_intersect_key( $attrs, $definitions ) as $key => $value ) {
				$key = (string) $key;

				if ( array_key_exists( $key, $stored ) ) {
					if ( $stored[ $key ] !== $value ) {
						$findings[] = self::finding( 'shadowed_value', $key, null, __( 'This field is set at the top level of the attrs and in blockstudio.attributes. The value in blockstudio.attributes is rendered.', 'blockstudio' ), $value, $stored[ $key ] );
					}
					continue;
				}

				// A disabled field renders as false or its fallback whatever is stored.
				if ( in_array( $key, $disabled, true ) ) {
					continue;
				}

				$att = $block_atts[ $key ] ?? $extension[ $key ];

				if ( isset( $block_atts[ $key ] ) ) {
					// WordPress validates registered attributes before render and drops a value of the wrong type.
					// An empty value it drops still ends as false, unless the attribute has a default.
					$valid = rest_validate_value_from_schema( $value, $att, $key );
					if ( is_wp_error( $valid ) ) {
						if ( ! self::is_empty( $att, $value ) || array_key_exists( 'default', $att ) ) {
							$findings[] = self::finding( 'wrong_type', $key, 'block', __( 'WordPress drops this top-level value before render because it does not match the attribute type. The default applies.', 'blockstudio' ), $value, $att['type'] ?? null );
						}
						continue;
					}
				}

				if ( isset( $extension[ $key ] ) && ! self::is_empty( $extension[ $key ], $value ) ) {
					$findings[] = self::finding( 'extension_top_level', $key, 'extension', __( 'Only the block template reads this value at the top level of the attrs. Extensions read their values from blockstudio.attributes.', 'blockstudio' ), $value );
				}

				$values[ $key ] = array( $value, true );
			}
		}

		foreach ( $values as $key => $entry ) {
			$key = (string) $key;

			list( $value, $top_level ) = $entry;

			// At the top level only the template reads the value, with the block's field or, failing that,
			// the extension's (Block::render() merges the definitions).
			$candidates = array();
			if ( isset( $block_atts[ $key ] ) ) {
				$candidates['block'] = $block_atts[ $key ];
			}
			if ( isset( $extension[ $key ] ) && ( ! $top_level || ! isset( $block_atts[ $key ] ) ) ) {
				$candidates['extension'] = $extension[ $key ];
			}

			if ( array() === $candidates ) {
				// A Blockstudio block forwards global HTML attributes to its root element and keeps its own bookkeeping keys.
				if ( ! self::is_size_key( $key, $definitions ) && ( ! $is_block || array() !== Block::unhandled_attributes( $name, array( $key => $value ) ) ) ) {
					$findings[] = self::finding( 'unknown_field', $key, null, __( 'No field of this block or its extensions stores this key.', 'blockstudio' ), $value, array_keys( $definitions ) );
				}
				continue;
			}

			if ( isset( $block_atts[ $key ], $extension[ $key ] ) && self::kind( $block_atts[ $key ] ) !== self::kind( $extension[ $key ] ) ) {
				$findings[] = self::finding(
					'definition_conflict',
					$key,
					null,
					__( 'The block and an extension define this key with fields that store different shapes. Each render path reads the value with its own field.', 'blockstudio' ),
					$value,
					array(
						'block'     => $block_atts[ $key ]['field'],
						'extension' => $extension[ $key ]['field'],
					)
				);
			}

			if ( in_array( $key, $disabled, true ) ) {
				continue;
			}

			foreach ( $candidates as $source => $att ) {
				$findings = array_merge( $findings, self::check_value( $att, $value, $key, $source, $disabled ) );
			}
		}

		/**
		 * Filter the findings of bs_validate_block().
		 *
		 * @since 7.7.5
		 *
		 * @param array  $findings The findings.
		 * @param string $name     The block name.
		 * @param array  $attrs    The validated attrs.
		 */
		return apply_filters( 'blockstudio/blocks/attributes/validate', $findings, $name, $attrs );
	}

	/**
	 * Keep the attributes that store a field value.
	 *
	 * @param array $attributes Registered attributes, keyed by storage key.
	 *
	 * @return array The field attributes.
	 */
	private static function field_attributes( array $attributes ): array {
		return array_filter(
			$attributes,
			static fn( $att ): bool => is_array( $att ) && isset( $att['blockstudio'], $att['field'] )
		);
	}

	/**
	 * The field attributes of every extension that matches a block.
	 *
	 * Later extensions replace earlier ones key by key, as in
	 * Block::extension_attributes() and Extensions::render_blocks().
	 *
	 * @param string $name Block name.
	 *
	 * @return array The field attributes, keyed by storage key.
	 */
	private static function extension_attributes( string $name ): array {
		$attributes = array();

		foreach ( Extensions::get_matches( $name, Build::extensions() ) as $match ) {
			foreach ( is_array( $match->attributes ?? null ) ? $match->attributes : array() as $key => $att ) {
				if ( is_array( $att ) && ( $att['field'] ?? false ) ) {
					$attributes[ $key ] = $att;
				}
			}
		}

		return $attributes;
	}

	/**
	 * Whether a key holds the image size of a files field next to it.
	 *
	 * @param string $key         Storage key.
	 * @param array  $definitions Field attributes of the same level.
	 *
	 * @return bool Whether the key is "<files field>__size".
	 */
	private static function is_size_key( string $key, array $definitions ): bool {
		if ( ! str_ends_with( $key, '__size' ) ) {
			return false;
		}

		return 'files' === ( $definitions[ substr( $key, 0, -6 ) ]['field'] ?? '' );
	}

	/**
	 * Whether Block::transform_attributes() leaves a value untransformed.
	 *
	 * @param array $att   Field attribute.
	 * @param mixed $value Stored value.
	 *
	 * @return bool Whether the value counts as empty.
	 */
	private static function is_empty( array $att, $value ): bool {
		return ! ( ! empty( $value ) || '0' === $value || ( 0 === $value && Block::is_multiple_option_field( $att ) ) );
	}

	/**
	 * The shape a field stores, to compare two definitions of one key.
	 *
	 * @param array $att Field attribute.
	 *
	 * @return string The shape.
	 */
	private static function kind( array $att ): string {
		$field = (string) ( $att['field'] ?? '' );

		if ( in_array( $field, Field_Type_Config::STRING_TYPES, true ) ) {
			return 'string';
		}
		if ( in_array( $field, Field_Type_Config::NUMBER_TYPES, true ) ) {
			return 'number';
		}
		if ( Block::is_multiple_option_field( $att ) ) {
			return 'options';
		}
		if ( 'select' === $field || 'radio' === $field ) {
			return 'option';
		}

		return $field;
	}

	/**
	 * Check one stored value against one field attribute.
	 *
	 * @param array  $att      Field attribute.
	 * @param mixed  $value    Stored value.
	 * @param string $path     Storage path.
	 * @param string $source   "block" or "extension".
	 * @param array  $disabled Disabled keys of the block.
	 *
	 * @return array Findings.
	 */
	private static function check_value( array $att, $value, string $path, string $source, array $disabled = array() ): array {
		$field = (string) $att['field'];

		if ( self::is_empty( $att, $value ) ) {
			return array();
		}

		$kind = self::kind( $att );

		if ( 'string' === $kind ) {
			return self::is_text( $value ) ? array() : array( self::wrong_type( $path, $source, $value, 'string' ) );
		}

		if ( 'number' === $kind ) {
			return is_numeric( $value ) ? array() : array( self::wrong_type( $path, $source, $value, 'number' ) );
		}

		switch ( $field ) {
			case 'toggle':
				return is_bool( $value ) ? array() : array( self::wrong_type( $path, $source, $value, 'boolean' ) );

			case 'select':
			case 'radio':
			case 'checkbox':
				return self::check_options( $att, $value, $path, $source );

			case 'token':
				if ( ! is_array( $value ) || array_key_exists( 'value', $value ) ) {
					return array( self::wrong_type( $path, $source, $value, 'array' ) );
				}
				return array();

			case 'files':
				return self::check_files( $att, $value, $path, $source, $disabled );

			case 'repeater':
				return self::check_repeater( $att, $value, $path, $source );

			case 'attributes':
				return self::check_html_attributes( $value, $path, $source );

			case 'link':
			case 'icon':
			case 'color':
			case 'gradient':
				return is_array( $value ) ? array() : array( self::wrong_type( $path, $source, $value, 'object' ) );
		}

		// Custom field types: the attribute type they declare.
		$declared = $att['type'] ?? null;
		if ( is_string( $declared ) && ! self::matches_type( $value, $declared ) ) {
			return array( self::wrong_type( $path, $source, $value, $declared ) );
		}

		return array();
	}

	/**
	 * Check a select, radio, or checkbox value against its options.
	 *
	 * Multiple selects and checkboxes are read with Block::multiple_option_values(),
	 * and each option is looked up with Block::get_option_value(), like on render.
	 * An option the renderer turns into false is unknown. Only a select whose
	 * options are fetched in the editor passes its value through unchanged.
	 *
	 * @param array  $att    Field attribute.
	 * @param mixed  $value  Stored value.
	 * @param string $path   Storage path.
	 * @param string $source "block" or "extension".
	 *
	 * @return array Findings.
	 */
	private static function check_options( array $att, $value, string $path, string $source ): array {
		$populate = is_array( $att['populate'] ?? null ) ? $att['populate'] : array();

		if ( 'select' === $att['field'] && 'fetch' === ( $populate['type'] ?? '' ) ) {
			return array();
		}

		if ( Block::is_multiple_option_field( $att ) ) {
			if ( ! is_array( $value ) && ! self::is_text( $value ) ) {
				return array( self::wrong_type( $path, $source, $value, 'array' ) );
			}

			$selections = Block::multiple_option_values( $value );
			$single     = ! is_array( $value ) || array_key_exists( 'value', $value );
		} else {
			$selections = array( $value );
			$single     = true;
		}

		$findings = array();
		$expected = null;

		foreach ( $selections as $index => $selection ) {
			$item_path = $single ? $path : $path . '/' . $index;
			$option    = is_array( $selection ) ? ( $selection['value'] ?? null ) : $selection;

			// Block::get_option_value() reads the value of an option object, otherwise the selection itself.
			if ( ! is_scalar( $option ) ) {
				$findings[] = self::wrong_type( $item_path, $source, $selection, 'option' );
				continue;
			}

			$resolved = Block::get_option_value( $att, $att['returnFormat'] ?? 'value', $selection, $populate );

			if ( false === $resolved || null === $resolved ) {
				$expected ??= self::option_values( $att );

				$findings[] = self::finding(
					'unknown_option',
					$item_path,
					$source,
					__( 'This value is not an option of the field.', 'blockstudio' ),
					$selection,
					$expected
				);
			}
		}

		return $findings;
	}

	/**
	 * Check a files value: one attachment, or a list of them.
	 *
	 * With the return format "id" the stored value reaches the template as it
	 * is. Otherwise each entry is read with get_post() (Block::get_attachment_data())
	 * or as an attachment URL, and an entry that is not a stored post ID renders
	 * as false.
	 *
	 * @param array  $att      Field attribute.
	 * @param mixed  $value    Stored value.
	 * @param string $path     Storage path.
	 * @param string $source   "block" or "extension".
	 * @param array  $disabled Disabled keys of the block.
	 *
	 * @return array Findings.
	 */
	private static function check_files( array $att, $value, string $path, string $source, array $disabled ): array {
		$return_format = $att['returnFormat'] ?? 'object';
		$is_list       = is_array( $value );
		$items         = $is_list ? array_values( $value ) : array( $value );
		$findings      = array();

		foreach ( $items as $index => $item ) {
			$item_path = $is_list ? $path . '/' . $index : $path;

			if ( ! self::is_text( $item ) ) {
				$findings[] = self::wrong_type( $item_path, $source, $item, 'attachment' );
				continue;
			}

			if ( 'id' === $return_format || in_array( $path . '_' . $item, $disabled, true ) ) {
				continue;
			}

			// get_post() falls back to the global post for 0.
			$post = is_numeric( $item ) && (int) $item > 0 ? get_post( (int) $item ) : null;

			if ( ! $post || ( 'url' === $return_format && 'attachment' !== $post->post_type ) ) {
				$findings[] = self::finding( 'unknown_attachment', $item_path, $source, __( 'The renderer cannot resolve this ID to an attachment.', 'blockstudio' ), $item );
			}
		}

		return $findings;
	}

	/**
	 * Check the value of an attributes field: a list of attribute and value pairs.
	 *
	 * Extensions::render_blocks() writes each entry to the root element.
	 *
	 * @param mixed  $value  Stored value.
	 * @param string $path   Storage path.
	 * @param string $source "block" or "extension".
	 *
	 * @return array Findings.
	 */
	private static function check_html_attributes( $value, string $path, string $source ): array {
		if ( ! is_array( $value ) ) {
			return array( self::wrong_type( $path, $source, $value, 'array' ) );
		}

		$findings = array();
		foreach ( $value as $index => $entry ) {
			// WP_HTML_Tag_Processor::set_attribute() takes a name and a string or boolean.
			if (
				! is_array( $entry ) ||
				! is_string( $entry['attribute'] ?? null ) ||
				'' === $entry['attribute'] ||
				! ( self::is_text( $entry['value'] ?? null ) || is_bool( $entry['value'] ?? null ) )
			) {
				$findings[] = self::wrong_type( $path . '/' . $index, $source, $entry, 'attribute' );
			}
		}

		return $findings;
	}

	/**
	 * Check a repeater value and its rows.
	 *
	 * A row key is read with the first row attribute whose ID equals it
	 * (Block::attribute_definition()). Row counts are not checked: the built
	 * repeater attribute carries no min or max.
	 *
	 * @param array  $att    Field attribute.
	 * @param mixed  $value  Stored value.
	 * @param string $path   Storage path.
	 * @param string $source "block" or "extension".
	 *
	 * @return array Findings.
	 */
	private static function check_repeater( array $att, $value, string $path, string $source ): array {
		if ( ! is_array( $value ) ) {
			return array( self::wrong_type( $path, $source, $value, 'array' ) );
		}

		$findings = array();
		$rows     = array();

		foreach ( is_array( $att['attributes'] ?? null ) ? $att['attributes'] : array() as $row_att ) {
			$id = is_array( $row_att ) ? ( $row_att['id'] ?? null ) : null;

			// Row keys are compared as strings, so a numeric ID never matches.
			if ( ! is_string( $id ) ) {
				continue;
			}

			if ( ! array_key_exists( $id, $rows ) ) {
				$rows[ $id ] = $row_att;
			} elseif ( isset( $rows[ $id ]['field'], $row_att['field'] ) && self::kind( $rows[ $id ] ) !== self::kind( $row_att ) ) {
				$findings[] = self::finding(
					'definition_conflict',
					$path . '/*/' . $id,
					$source,
					__( 'Two fields of the repeater rows use this ID with different shapes. Only the first one is read.', 'blockstudio' ),
					null,
					array( $rows[ $id ]['field'], $row_att['field'] )
				);
			}
		}

		foreach ( $value as $index => $row ) {
			$row_path = $path . '/' . $index;

			if ( ! is_array( $row ) ) {
				$findings[] = self::wrong_type( $row_path, $source, $row, 'object' );
				continue;
			}

			foreach ( $row as $key => $row_value ) {
				$key = (string) $key;

				if ( ! array_key_exists( $key, $rows ) ) {
					if ( ! self::is_size_key( $key, $rows ) ) {
						$findings[] = self::finding( 'unknown_field', $row_path . '/' . $key, $source, __( 'No field of the repeater rows stores this key.', 'blockstudio' ), $row_value, array_keys( $rows ) );
					}
					continue;
				}

				// A matching entry without a built field is not transformed.
				if ( isset( $rows[ $key ]['field'] ) ) {
					$findings = array_merge( $findings, self::check_value( $rows[ $key ], $row_value, $row_path . '/' . $key, $source ) );
				}
			}
		}

		return $findings;
	}

	/**
	 * The option values a field declares.
	 *
	 * @param array $att Field attribute.
	 *
	 * @return array The values.
	 */
	private static function option_values( array $att ): array {
		$values = array();

		foreach ( is_array( $att['options'] ?? null ) ? $att['options'] : array() as $option ) {
			if ( is_array( $option ) && array_key_exists( 'value', $option ) ) {
				$values[] = $option['value'];
			} elseif ( is_scalar( $option ) ) {
				$values[] = $option;
			}
		}

		return $values;
	}

	/**
	 * Whether a value is a string or a number.
	 *
	 * @param mixed $value The value.
	 *
	 * @return bool Whether it is.
	 */
	private static function is_text( $value ): bool {
		return is_string( $value ) || is_int( $value ) || is_float( $value );
	}

	/**
	 * Whether a value matches a declared attribute type.
	 *
	 * @param mixed  $value The value.
	 * @param string $type  The declared type.
	 *
	 * @return bool Whether it matches. Unknown types always match.
	 */
	private static function matches_type( $value, string $type ): bool {
		switch ( $type ) {
			case 'string':
				return self::is_text( $value );
			case 'number':
			case 'integer':
				return is_numeric( $value );
			case 'boolean':
				return is_bool( $value );
			case 'object':
			case 'array':
				return is_array( $value );
		}

		return true;
	}

	/**
	 * A wrong_type finding.
	 *
	 * @param string $path     Storage path.
	 * @param string $source   "block" or "extension".
	 * @param mixed  $value    Stored value.
	 * @param string $expected The expected shape.
	 *
	 * @return array The finding.
	 */
	private static function wrong_type( string $path, string $source, $value, string $expected ): array {
		return self::finding( 'wrong_type', $path, $source, __( 'The value does not have the shape this field stores.', 'blockstudio' ), $value, $expected );
	}

	/**
	 * Build a finding.
	 *
	 * @param string      $code     Finding code.
	 * @param string      $path     Storage path.
	 * @param string|null $source   "block", "extension", or null when no field applies.
	 * @param string      $message  Message.
	 * @param mixed       $value    The value as stored.
	 * @param mixed       $expected What was expected, where it applies.
	 *
	 * @return array The finding.
	 */
	private static function finding( string $code, string $path, ?string $source, string $message, $value, $expected = null ): array {
		return array(
			'code'     => $code,
			'path'     => $path,
			'source'   => $source,
			'message'  => $message,
			'value'    => $value,
			'expected' => $expected,
		);
	}
}
