<?php

use Blockstudio\Admin;
use PHPUnit\Framework\TestCase;

class AdminFrontendCaptureTest extends TestCase {

	private int $expected_id_reads = 0;

	protected function setUp(): void {
		wp_scripts();
		wp_styles();
		add_filter( 'pre_transient_blockstudio_editor_expected_capture_assets_id', array( $this, 'count_expected_id_read' ) );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_transient_blockstudio_editor_expected_capture_assets_id', array( $this, 'count_expected_id_read' ) );
		unset( $_GET['blockstudio_editor_capture_assets_id'] );
		delete_transient( 'blockstudio_editor_expected_capture_assets_id' );
		delete_transient( 'blockstudio_editor_captured_frontend_scripts' );
		delete_transient( 'blockstudio_editor_captured_frontend_styles' );
	}

	public function count_expected_id_read( $pre ) {
		++$this->expected_id_reads;

		return $pre;
	}

	public function test_regular_frontend_view_does_not_read_the_capture_transient(): void {
		Admin::capture_frontend_assets();

		$this->assertSame( 0, $this->expected_id_reads );
		$this->assertFalse( get_transient( 'blockstudio_editor_captured_frontend_scripts' ) );
	}

	public function test_matching_capture_id_stores_frontend_assets(): void {
		set_transient( 'blockstudio_editor_expected_capture_assets_id', 'abc123', MINUTE_IN_SECONDS );
		$_GET['blockstudio_editor_capture_assets_id'] = 'abc123';

		Admin::capture_frontend_assets();

		$this->assertSame( 1, $this->expected_id_reads );
		$this->assertIsArray( get_transient( 'blockstudio_editor_captured_frontend_scripts' ) );
		$this->assertIsArray( get_transient( 'blockstudio_editor_captured_frontend_styles' ) );
	}

	public function test_mismatched_capture_id_stores_nothing(): void {
		set_transient( 'blockstudio_editor_expected_capture_assets_id', 'abc123', MINUTE_IN_SECONDS );
		$_GET['blockstudio_editor_capture_assets_id'] = 'other';

		Admin::capture_frontend_assets();

		$this->assertFalse( get_transient( 'blockstudio_editor_captured_frontend_scripts' ) );
	}
}
