<?php
/**
 * GitHub Updater class.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

use BlockstudioVendor\YahnisElsts\PluginUpdateChecker\v5\PucFactory;

/**
 * Checks GitHub releases for plugin updates using plugin-update-checker.
 *
 * @since 7.0.0
 */
class Github_Updater {

	/**
	 * Constructor.
	 */
	public function __construct() {
		$update_checker = PucFactory::buildUpdateChecker(
			'https://github.com/inline0/blockstudio/',
			BLOCKSTUDIO_FILE,
			'blockstudio'
		);

		/**
		 * Filter the GitHub token used by the built-in updater.
		 *
		 * Register before Blockstudio loads, for example in an MU plugin.
		 *
		 * @since 7.7.4
		 *
		 * @param string $token Token from BLOCKSTUDIO_GITHUB_TOKEN, or an empty string.
		 */
		$token = apply_filters(
			'blockstudio/updater/token',
			defined( 'BLOCKSTUDIO_GITHUB_TOKEN' ) ? BLOCKSTUDIO_GITHUB_TOKEN : ''
		);

		if ( is_string( $token ) && '' !== trim( $token ) ) {
			$update_checker->setAuthentication( trim( $token ) );
		}

		$update_checker->getVcsApi()->enableReleaseAssets();

		$update_checker->addResultFilter(
			function ( $info ) {
				$info->icons = array(
					'svg'     => BLOCKSTUDIO_URL . 'includes/assets/icon.svg',
					'default' => BLOCKSTUDIO_URL . 'includes/assets/icon.png',
				);
				return $info;
			}
		);
	}
}
