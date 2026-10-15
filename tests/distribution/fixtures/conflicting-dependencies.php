<?php
/**
 * Deliberately incompatible public dependencies supplied by another plugin.
 *
 * @package Blockstudio
 */

namespace League\CommonMark {
	class GithubFlavoredMarkdownConverter {
		public function __construct() {
			throw new \LogicException( 'Public CommonMark must not be used.' );
		}
	}
}
namespace Symfony\Component\Yaml {
	class Yaml {
		public static function parse( $input ) {
			throw new \LogicException( 'Public YAML must not be used.' );
		}
	}
}
namespace YahnisElsts\PluginUpdateChecker\v5 {
	class PucFactory {
		public static function addVersion( ...$args ) {
			throw new \LogicException( 'Public update checker must not be used.' );
		}
	}
}
namespace Nette\Schema {
	class Processor {
		public function __construct() {
			throw new \LogicException( 'Public transitive dependencies must not be used.' );
		}
	}
}
namespace {
	class Parsedown {
		public function __construct() {
			throw new \LogicException( 'Public Parsedown must not be used.' );
		}
	}
	function trigger_deprecation( ...$args ) {
		throw new \LogicException( 'Public deprecation helpers must not be used.' );
	}
}
